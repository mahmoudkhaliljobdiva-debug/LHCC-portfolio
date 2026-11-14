import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

function load(guard, query) {
  const exports = {};
  const code = ts.transpileModule(readFileSync('src/lib/bank-access/server.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const modules = {
    'server-only': {}, react: { cache: fn => fn },
    '@/lib/auth/server': { requireRole: guard },
    '@/lib/supabase/server': { createClient: async () => ({ from: () => query }) },
    '@/lib/supabase/pagination': { readAllRows: async fetch => (await fetch(0, 499)).data },
    '@/lib/supabase/admin': {}, '@/lib/portal-preview/server': {},
  };
  new Function('require', 'exports', code)(name => { assert(name in modules, name); return modules[name]; }, exports);
  return exports;
}
test('teacher assignment choices exclude Subjects but preserve inactive and draft Exam Tracks', async () => {
  const filters = [];
  const query = {
    select: () => query,
    eq: (key, value) => { filters.push([key, value]); return query; },
    order: () => query,
    range: async () => ({ data: [{ id: 'retained-track', name: 'Draft track' }], error: null }),
  };
  const { getAdminBankOptions } = load(async role => assert.equal(role, 'ADMIN'), query);
  assert.deepEqual(await getAdminBankOptions(), [{ id: 'retained-track', name: 'Draft track' }]);
  assert.deepEqual(filters, [['material_kind', 'EXAM_TRACK']]);
});
test('assignment choice reads remain Admin guarded before querying', async () => {
  const { getAdminBankOptions } = load(async () => { throw Error('Denied'); }, null);
  await assert.rejects(getAdminBankOptions(), /Denied/);
});
