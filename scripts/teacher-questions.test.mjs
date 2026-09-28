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
  new Function('require','exports',js)(name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(resolve('src',name.slice(2)+'.ts'),mocks) : require(name),exports);
  return exports;
}
const question = { text: 'New question', status: 'active', answers: [{ id: 'a', text: 'First', isCorrect: true }, { id: 'b', text: 'Second', isCorrect: false }] };
function fixture(role = 'TEACHER', status = 'ACTIVE', denied = false) {
  const calls = [], paths = [];
  const action = load(resolve('src/actions/teacher-questions.ts'), {
    'next/cache': { revalidatePath: (...args) => paths.push(args) },
    '@/lib/auth/server': { getAuthenticatedProfile: async () => role ? { role } : null, getEffectiveProfileStatus: async () => status },
    '@/lib/supabase/server': { createClient: async () => ({ rpc: async (...args) => { calls.push(args); return { error: denied ? { code: '42501' } : null }; } }) },
  });
  return { ...action, calls, paths };
}
test('teacher add uses only insert RPC and refreshes all affected portals', async () => {
  const f=fixture(); assert.equal((await f.addTeacherQuestion('assigned-bank',question)).ok,true);
  assert.equal(f.calls[0][0],'teacher_add_question'); assert.match(f.calls[0][1].item_id,/^[a-f0-9-]{36}$/);
  assert.equal(f.calls[0][1].payload.bankId,'assigned-bank'); assert.equal(f.paths.length,3);
});
for(const role of ['ADMIN','STUDENT',null]) test(`${role ?? 'anonymous'} cannot author as teacher`,async()=>{
  const f=fixture(role);assert.equal((await f.addTeacherQuestion('bank',question)).ok,false);assert.equal(f.calls.length,0);
});
test('inactive teacher cannot author',async()=>{const f=fixture('TEACHER','INACTIVE');assert.equal((await f.addTeacherQuestion('bank',question)).ok,false);assert.equal(f.calls.length,0);});
test('unassigned-bank rejection is propagated',async()=>{const f=fixture('TEACHER','ACTIVE',true);assert.equal((await f.addTeacherQuestion('bank',question)).ok,false);assert.equal(f.paths.length,0);});
test('no edit/delete identifiers or invalid answer keys accepted',async()=>{
  for(const payload of [{...question,id:'existing-question'},{...question,status:'inactive'},{...question,answers:question.answers.map(a=>({...a,isCorrect:true}))}]) {const f=fixture();assert.equal((await f.addTeacherQuestion('bank',payload)).ok,false);assert.equal(f.calls.length,0);}
});
test('managed teachers require at least one assignment, students do not',()=>{
  const {managedUserSchema}=load(resolve('src/lib/validation/admin-user.ts'),{'server-only':{}});
  const user={fullName:'Managed User',email:'managed@example.com',age:null,gender:null,homeAddress:'',role:'teacher',status:'active',activationStartDate:'2026-09-28',activationMonths:1};
  assert.equal(managedUserSchema.safeParse(user).success,false);
  assert.equal(managedUserSchema.safeParse({...user,teacherBankIds:['bank']}).success,true);
  assert.equal(managedUserSchema.safeParse({...user,teacherBankIds:['bank','bank']}).success,false);
  assert.equal(managedUserSchema.safeParse({...user,role:'student'}).success,true);
});
