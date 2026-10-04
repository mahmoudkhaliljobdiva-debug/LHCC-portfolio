import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(path,mocks) {
  const exports={};const js=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  new Function('require','exports',js)(name=>name in mocks?mocks[name]:name.startsWith('@/')?load(resolve('src',name.slice(2)+'.ts'),mocks):require(name),exports);return exports;
}
const id='984b3c1a-7cab-4bd7-aa5c-39c6c63d093f';
function fixture(role='STUDENT',status='ACTIVE',denied=false) {
  const calls=[];const paths=[];
  const actions=load(resolve('src/actions/exams.ts'),{
    'next/cache':{revalidatePath:(...args)=>paths.push(args)},
    '@/lib/auth/server':{getAuthenticatedProfile:async()=>role?{role}:null,getEffectiveProfileStatus:async()=>status},
    '@/lib/supabase/server':{createClient:async()=>({rpc:async(...args)=>{calls.push(args);return{data:id,error:denied?{code:'42501',message:'private SQL internal'}:null};}})},
  });return{...actions,calls,paths};
}
test('start/answer/submit use trusted RPC allowlists',async()=>{
  const f=fixture();assert((await f.startExam('bank')).ok);assert((await f.saveExamAnswer({attemptId:id,questionId:'q',optionId:'a'})).ok);assert((await f.submitExam(id)).ok);
  assert.deepEqual(f.calls,[['start_exam',{bank_id:'bank'}],['save_exam_answer',{attempt_id:id,question_id:'q',option_id:'a'}],['submit_exam',{attempt_id:id}]]);
});
for(const role of ['ADMIN','TEACHER',null]) test(`${role??'anonymous'} cannot mutate exams`,async()=>{const f=fixture(role);assert(!(await f.startExam('bank')).ok);assert(!(await f.saveExamAnswer({attemptId:id,questionId:'q',optionId:'a'})).ok);assert(!(await f.submitExam(id)).ok);assert.equal(f.calls.length,0);});
test('inactive student cannot mutate exams',async()=>{const f=fixture('STUDENT','INACTIVE');assert(!(await f.startExam('bank')).ok);assert(!(await f.submitExam(id)).ok);assert.equal(f.calls.length,0);});
test('invalid IDs and injected authoritative scores rejected',async()=>{const f=fixture();assert(!(await f.startExam('')).ok);assert(!(await f.submitExam('bad')).ok);assert(!(await f.saveExamAnswer({attemptId:id,questionId:'q',optionId:'a',score:100})).ok);assert.equal(f.calls.length,0);});
test('backend denial returns safe feedback',async()=>{const f=fixture('STUDENT','ACTIVE',true);const result=await f.submitExam(id);assert(!result.ok);assert(!JSON.stringify(result).includes('SQL'));assert.equal(f.paths.length,0);});
const {examSchema}=load(resolve('src/lib/validation/exam.ts'),{});
const exam={id,bankId:'bank',bankName:'Bank',status:'IN_PROGRESS',totalQuestions:1,startedAt:'2026-09-28',submittedAt:null,result:null,questions:[{id:'q',text:'Question',order:1,caseTitle:'Case',caseDescription:'Clinical context',options:[{id:'a',text:'Answer',is_correct:true}],selectedOptionId:null}]};
test('safe schema strips foreign key properties',()=>{assert(!JSON.stringify(examSchema.parse(exam)).includes('is_correct'));});
test('exam schema retains frozen case context and strips answer keys',()=>{const parsed=examSchema.parse(exam);assert.equal(parsed.questions[0].caseDescription,'Clinical context');assert(!JSON.stringify(parsed).includes('correct_option_id'));});
test('pre-submit grading or corrupted frozen set rejected',()=>{for(const changed of [{...exam,result:{correct:1,incorrect:0,score:100}},{...exam,questions:[{...exam.questions[0],outcome:true}]},{...exam,totalQuestions:2}])assert(!examSchema.safeParse(changed).success);});
