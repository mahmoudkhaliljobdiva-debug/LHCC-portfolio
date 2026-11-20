import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import test from 'node:test';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(file,mocks={}){const exports={};const js=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;new Function('require','exports',js)(name=>name in mocks?mocks[name]:name.startsWith('@/')?load(resolve('src',name.slice(2)+'.ts'),mocks):name.startsWith('./')?load(resolve(file,'..',name+'.ts'),mocks):require(name),exports);return exports;}
const schemas=load('src/lib/validation/chapters.ts');const id='984b3c1a-7cab-4bd7-aa5c-39c6c63d093f';
test('chapter inputs require bounded real metadata and unique memberships',()=>{
 const c={id,bankId:'bank',title:'Chapter',description:'',displayOrder:0,published:false};assert(schemas.saveChapterSchema.safeParse(c).success);
 for(const patch of [{title:''},{displayOrder:-1},{role:'ADMIN'}])assert(!schemas.saveChapterSchema.safeParse({...c,...patch}).success);
 const a={bankId:'bank',questionId:'q',chapterIds:[id],difficulty:null};assert(schemas.assignChapterSchema.safeParse(a).success);
 assert(!schemas.assignChapterSchema.safeParse({...a,chapterIds:[id,id]}).success);assert(!schemas.assignChapterSchema.safeParse({...a,difficulty:'invented'}).success);
});
test('chapter setup requires a real chapter ID and supports explicit revision preference',()=>{
 const {learningSetupSchema}=load('src/lib/validation/past-exam.ts');const c={bankId:'bank',source:'CHAPTER',sourceId:id,mode:'PRACTICE',count:30,timeLimitMinutes:null};
 assert(learningSetupSchema.safeParse(c).success);assert(!learningSetupSchema.safeParse({...c,sourceId:null}).success);
 assert(!learningSetupSchema.safeParse({...c,sourceId:'invalid'}).success);assert(learningSetupSchema.safeParse({...c,source:'RANDOM',sourceId:null,prioritizeIncorrect:true}).success);
});
test('all chapter actions require active Admin before database access',async()=>{
 let calls=0;const a=load('src/actions/chapters.ts',{'next/cache':{revalidatePath(){}},'@/lib/auth/admin':{authorizeActiveAdmin:async()=>({ok:false,error:{code:'FORBIDDEN',message:'Admin required'}})},'@/lib/supabase/server':{createClient:async()=>{calls++;throw Error('Forbidden');}}});
 for(const method of ['saveChapter','assignQuestionChapters','saveGenerationSettings'])assert(!(await a[method]({})).ok);assert.equal(calls,0);
});
test('chapter actions send only validated payload to guarded RPC',async()=>{
 const calls=[];const a=load('src/actions/chapters.ts',{'next/cache':{revalidatePath(){}},'@/lib/auth/admin':{authorizeActiveAdmin:async()=>({ok:true,data:{}})},'@/lib/supabase/server':{createClient:async()=>({rpc:async(...args)=>{calls.push(args);return{data:null,error:null};}})}});
 assert((await a.saveChapter({id,bankId:'bank',title:'Chapter',description:'',displayOrder:0,published:true})).ok);
 assert((await a.assignQuestionChapters({bankId:'bank',questionId:'q',chapterIds:[id],difficulty:null})).ok);
 assert((await a.saveGenerationSettings({bankId:'bank',defaultCount:30,prioritizeIncorrect:false})).ok);
 assert(!(await a.saveGenerationSettings({bankId:'bank',defaultCount:31,prioritizeIncorrect:false})).ok);
 assert(calls.every(c=>c[0]==='manage_chapters'));assert.equal(calls.length,3);
});
test('private selector preserves canonical records and isolates frozen fixed exam paths',()=>{
 const sql=readFileSync('supabase/migrations/20261021172927_chapter_learning_modes.sql','utf8');
 assert(sql.includes('partition by chapter_bucket,year_bucket,difficulty_bucket'));assert(sql.includes('private.lock_exam_access(bid)'));
 assert(sql.includes('foreign key(question_id,question_bank_id)'));assert(sql.includes('source_number_snapshot'));
 assert(!/truncate|insert into public.bank_questions|update public.question_banks|disable row level security/i.test(sql));
});
