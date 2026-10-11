import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(path,mocks={}) { const exports={}; const js=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText; new Function('require','exports',js)(name=>name in mocks ? mocks[name] : name.startsWith('@/') ? load(resolve('src',name.slice(2)+'.ts'),mocks) : name.startsWith('./') ? load(resolve(path,'..',name+'.ts'),mocks) : require(name),exports); return exports; }
const { extractExamText }=load(resolve('src/lib/exams/pdf-extraction.ts'));
test('extracts original order, case context and explicit keys but never verifies automatically',()=>{
 const result=extractExamText('Nursing 2025\nClinical case 1\nOriginal clinical narrative.\n1. First question\nA. First option\nB. Second option\n2. Second question\nA. Yes\nB. No\nAnswer key\n1: B\n2: A');
 assert.equal(result.questions.length,2); assert.equal(result.questions[0].sourceNumber,'1'); assert.equal(result.questions[1].correctOptionId,'A',JSON.stringify(result)); assert.equal(result.questions[0].caseDescription,'Original clinical narrative.'); assert.equal(result.questions[0].caseId,result.questions[1].caseId); assert(result.questions.every(q=>!q.verified)); assert.deepEqual(result.detectedYears,[2025]);
});
test('missing keys and incomplete options remain review warnings, not invented answers',()=>{ const r=extractExamText('1. Question\nA. Only option'); assert.equal(r.questions[0].correctOptionId,null); assert.equal(r.questions[0].warnings.length,2); assert.equal(r.detectedYears.length,0); });
test('scanned/empty PDF text requires manual transcription',()=>{ assert.equal(extractExamText('').questions.length,0); assert.match(extractExamText('').warnings[0],/manual/); });
test('repeated source numbers flag multiple-session review',()=>{ const r=extractExamText('1. First\nA. Yes\nB. No\n1. Other session\nA. Yes\nB. No'); assert(r.questions[1].warnings.some(w=>w.includes('multiple sessions'))); });
const { pastExamDraftSchema,learningSetupSchema }=load(resolve('src/lib/validation/past-exam.ts'));
const id='984b3c1a-7cab-4bd7-aa5c-39c6c63d093f';
const draft={ id,bankId:'bank',sourceId:null,title:'Source examination',year:null,session:'A',timeLimitMinutes:null,provenance:'Original PDF',status:'DRAFT',questions:extractExamText('1. Question').questions };
test('incomplete unverified draft can persist for review',()=>{ assert(pastExamDraftSchema.safeParse(draft).success); });
test('publishing requires confirmed year and reliable reviewed keys',()=>{ assert(!pastExamDraftSchema.safeParse({...draft,status:'PUBLISHED'}).success); const question={...draft.questions[0],options:[{id:'a',text:'First'},{id:'b',text:'Second'}],correctOptionId:'a',verified:true,warnings:[]}; assert(pastExamDraftSchema.safeParse({...draft,status:'PUBLISHED',year:2025,questions:[question]}).success); assert(!pastExamDraftSchema.safeParse({...draft,status:'PUBLISHED',year:2025,questions:[{...question,correctOptionId:'not-option'}]}).success); });
test('setup rejects invalid counts, timers and unsupported modes',()=>{ const c={bankId:'bank',source:'RANDOM',sourceId:null,mode:'EXAM',count:30,timeLimitMinutes:null}; assert(learningSetupSchema.safeParse(c).success); for(const changed of [{count:31},{count:0},{timeLimitMinutes:0},{mode:'ADMIN'},{source:'SQL'}]) assert(!learningSetupSchema.safeParse({...c,...changed}).success); });
const { examSchema }=load(resolve('src/lib/validation/exam.ts'));
const exam={id,bankId:'bank',bankName:'Bank',status:'IN_PROGRESS',totalQuestions:1,startedAt:'2026-10-11',submittedAt:null,result:null,questions:[{id:'q',text:'Question',order:1,caseTitle:null,caseDescription:null,options:[{id:'a',text:'First'},{id:'b',text:'Second'}],selectedOptionId:'b',outcome:false,correctOptionId:'a'}]};
test('active exam rejects feedback, checked practice permits it',()=>{ assert(!examSchema.safeParse(exam).success); assert(examSchema.safeParse({...exam,learningMode:'PRACTICE'}).success); });
test('archive schema does not truncate original exams larger than thirty',()=>{ const questions=Array.from({length:80},(_,i)=>({...exam.questions[0],id:'q'+i,order:i+1,outcome:undefined,correctOptionId:undefined})); assert(examSchema.safeParse({...exam,totalQuestions:80,questions}).success); });
test('new mutations deny admin view-as, teachers and inactive students before RPC',async()=>{
 for(const role of ['ADMIN','TEACHER',null]) { let calls=0; const actions=load(resolve('src/actions/exams.ts'),{'next/cache':{revalidatePath:()=>{}},'@/lib/auth/server':{getAuthenticatedProfile:async()=>role?{role}:null,getEffectiveProfileStatus:async()=> 'ACTIVE'},'@/lib/supabase/server':{createClient:async()=>{calls++;return {};}}}); assert(!(await actions.startLearningExam({bankId:'bank',source:'RANDOM',sourceId:null,mode:'EXAM',count:30,timeLimitMinutes:null})).ok); assert(!(await actions.checkPracticeAnswer(id,'q')).ok); assert.equal(calls,0); }
});
