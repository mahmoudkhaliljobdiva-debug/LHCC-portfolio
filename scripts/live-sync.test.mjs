import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(path,mocks={}){const exports={};const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;new Function('require','exports',code)(name=>name in mocks?mocks[name]:require(name),exports);return exports;}
const {affectsRoute,liveRoute,parseLiveHint}=load('src/lib/live-sync/routing.ts');
test('scope identifies protected banks/exams and public catalogs',()=>{
 assert(liveRoute('/student/banks/bank/setup').protected);assert.equal(liveRoute('/teacher/question-banks/bank').bankId,'bank');
 assert(liveRoute('/programs/nursing').publicCatalog);assert(!liveRoute('/login').publicCatalog);
});
test('source publication never replaces a frozen attempt',()=>{
 const path='/student/exams/984b3c1a-7cab-4bd7-aa5c-39c6c63d093f';
 for(const kind of ['catalog','questions','exams'])assert(!affectsRoute({kind,bankId:'bank'},path));
 assert(affectsRoute({kind:'access'},path));assert(affectsRoute({kind:'attempt',attemptId:path.split('/').at(-1)},path));
 assert(!affectsRoute({kind:'attempt',attemptId:'other'},path));
});
test('invalidation targets related routes, not unrelated wallet or bank screens',()=>{
 assert(!affectsRoute({kind:'wallet'},'/student/question-banks'));assert(affectsRoute({kind:'wallet'},'/admin/wallet'));
 assert(!affectsRoute({kind:'attempt'},'/teacher/profile'));assert(!affectsRoute({kind:'attempt'},'/admin/wallet'));
 assert(!affectsRoute({kind:'exams',bankId:'one'},'/student/banks/two/past-exams'));
 assert(affectsRoute({kind:'exams',bankId:'one'},'/student/banks/one/past-exams'));
});
test('hints are allowlisted; private/authoritative payload fields are discarded',()=>{
 assert.equal(parseLiveHint({kind:'grant-admin'}),null);
 assert.deepEqual(parseLiveHint({kind:'access',bankId:'bank',correctOptionId:'secret',email:'private'}),{kind:'access',bankId:'bank'});
});
test('single provider owns subscriptions and cleans up timers/listeners/channels',()=>{
 const code=readFileSync('src/features/live-sync/live-sync-provider.tsx','utf8');
 assert(code.includes('db.removeChannel(channel)'));assert(code.includes('clearInterval(interval)'));
 assert(code.includes('subscription.unsubscribe()'));assert(code.includes('visibilitychange'));
 assert(code.includes('navigator.onLine'));assert(code.includes('60000'));assert(!code.includes('location.reload'));
 assert.equal(code.match(/\.channel\(/g).length,1);assert(code.includes('private: true'));
});
test('SQL preserves private answer boundary and uses database-only hints',()=>{
 const sql=readFileSync('supabase/migrations/20261019173647_live_synchronization.sql','utf8');
 assert(sql.includes('create policy lhcc_receive_live_hints'));assert(!/create policy[^;]+for insert/is.test(sql));
 assert(sql.includes('for update'));assert(sql.includes("errcode='40001'"));assert(sql.includes('private.lock_exam_access'));
 assert(!/truncate |delete from |disable row level security/i.test(sql));
 assert(!/replica identity full|alter publication/i.test(sql));
});
test('version conflict returns a safe distinct error, without accepting injected scores',async()=>{
 const paths=[];
 const zod=require('zod');
 const actions=load('src/actions/exams.ts',{
  'next/cache':{revalidatePath:path=>paths.push(path)},
  '@/lib/auth/server':{getAuthenticatedProfile:async()=>({role:'STUDENT'}),getEffectiveProfileStatus:async()=>'ACTIVE'},
  '@/lib/supabase/server':{createClient:async()=>({rpc:async()=>({data:null,error:{code:'40001',message:'private database conflict'}})})},
  '@/lib/validation/exam':{contentId:zod.z.string().min(1),examId:zod.z.uuid()},
  '@/lib/validation/past-exam':{learningSetupSchema:zod.z.object({})},
 });
 const input={attemptId:'984b3c1a-7cab-4bd7-aa5c-39c6c63d093f',questionId:'q',optionId:'a',expectedVersion:0};
 const r=await actions.saveExamAnswer(input);assert(!r.ok);assert.equal(r.error.code,'CONFLICT');assert(!JSON.stringify(r).includes('private database'));
 assert(!(await actions.saveExamAnswer({...input,score:100})).ok);assert.equal(paths.length,0);
});
test('confirmed profile denial clears live identity; network failures are not mistaken for approval',async()=>{
 const routing={liveRoute};let code='42501';
 const actions=load('src/actions/live-sync.ts',{
  '@/lib/auth/server':{getAuthenticatedUser:async()=>({id:'user'})},
  '@/lib/live-sync/routing':routing,
  '@/lib/supabase/server':{createClient:async()=>({rpc:async()=>({data:null,error:{code}})})},
 });
 assert.equal(await actions.readLiveState('/student'),null);
 code='NETWORK';await assert.rejects(()=>actions.readLiveState('/student'),/could not be verified/);
});
