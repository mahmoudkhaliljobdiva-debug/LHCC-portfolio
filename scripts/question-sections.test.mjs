import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, mocks) {
  const exports = {};
  const js = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'exports', js)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(resolve('src', name.slice(2) + '.ts'), mocks) : require(name), exports);
  return exports;
}
const validation = load(resolve('src/lib/validation/question-content.ts'), {});
const section = { bankId: 'bank', title: 'Case', description: 'Clinical history', displayOrder: 1 };
const question = { bankId: 'bank', text: 'Clinical question?', status: 'active', sectionId: 'case', displayOrder: 1, answers: [{ id: 'a', text: 'A', isCorrect: true }, { id: 'b', text: 'B', isCorrect: false }] };

test('case validation requires description, bank, and nonnegative order', () => {
  assert(validation.questionSectionSchema.safeParse(section).success);
  assert(!validation.questionSectionSchema.safeParse({ ...section, bankId: '' }).success);
  assert(!validation.questionSectionSchema.safeParse({ ...section, description: '' }).success);
  assert(!validation.questionSectionSchema.safeParse({ ...section, displayOrder: -1 }).success);
});
test('admin question accepts case and order; teacher cannot choose either', () => {
  assert(validation.questionContentSchema.safeParse(question).success);
  assert(!validation.questionContentSchema.safeParse({ ...question, displayOrder: 0 }).success);
  assert(!validation.teacherQuestionSchema.safeParse(question).success);
  assert(validation.teacherQuestionSchema.safeParse({ bankId: question.bankId, text: question.text, status: 'active', answers: question.answers }).success);
});

function fixture(admin) {
  const calls = [];
  const action = load(resolve('src/actions/bank-content.ts'), {
    'next/cache': { revalidatePath: () => {} },
    '@/lib/auth/admin': { authorizeActiveAdmin: async () => admin ? { ok: true, data: {} } : { ok: false, error: { code: 'FORBIDDEN', message: 'Admin required' } } },
    '@/lib/supabase/server': { createClient: async () => ({ rpc: async (...args) => { calls.push(args); return { error: null }; } }) },
  });
  return { action, calls };
}
test('only admin sends validated case mutations to the database RPC', async () => {
  const id = 'case-id'; const no = fixture(false);
  assert(!(await no.action.manageBankContent('save_section', id, section)).ok);
  assert.equal(no.calls.length, 0);
  const yes = fixture(true);
  assert(!(await yes.action.manageBankContent('save_section', id, { ...section, description: '' })).ok);
  assert.equal(yes.calls.length, 0);
  assert((await yes.action.manageBankContent('save_section', id, section)).ok);
  assert((await yes.action.manageBankContent('delete_section', id)).ok);
  assert.deepEqual(yes.calls.map(call => call[1].operation), ['save_section', 'delete_section']);
});
test('migration snapshots case context and forbids cross-bank case assignment', () => {
  const sql = readFileSync(resolve('supabase/migrations/20261004100547_clinical_question_sections.sql'), 'utf8');
  assert.match(sql, /case_description_snapshot/);
  assert.match(sql, /x\.question_bank_id=payload->>'bankId'/);
  assert.match(sql, /on delete set null/i);
  assert.match(sql, /set search_path=''/);
  assert.doesNotMatch(sql, /truncate\s+public\./i);
});
