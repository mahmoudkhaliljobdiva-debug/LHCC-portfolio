import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import test from 'node:test';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(path,mocks={}){const exports={};const js=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;new Function('require','exports',js)(n=>n in mocks?mocks[n]:n.startsWith('@/')?load(resolve('src',n.slice(2)+'.ts'),mocks):require(n),exports);return exports;}
const {specialtySchema,generateSharedSchema,saveSharedSchema}=load(resolve('src/lib/validation/learning-catalog.ts'));
const {learningSetupSchema}=load(resolve('src/lib/validation/past-exam.ts'));
const id='984b3c1a-7cab-4bd7-aa5c-39c6c63d093f';
test('specialty configuration rejects ambiguous slugs and unknown field icons',()=>{const s={id,slug:'nursing',name:'Nursing',description:'',icon:'nursing',published:true,displayOrder:0};assert(specialtySchema.safeParse(s).success);assert(!specialtySchema.safeParse({...s,slug:'Nursing/Medical'}).success);assert(!specialtySchema.safeParse({...s,icon:'unlicensed'}).success);});
test('shared generation validates independent definition and bounded count',()=>{const s={id,bankId:'bank',title:'Shared exam',count:50,timeLimitMinutes:null};assert(generateSharedSchema.safeParse(s).success);for(const change of [{count:0},{count:1001},{timeLimitMinutes:0},{title:''}])assert(!generateSharedSchema.safeParse({...s,...change}).success);});
test('shared review rejects duplicate or empty question IDs',()=>{const s={id,title:'Shared exam',status:'PUBLISHED',timeLimitMinutes:null,questionIds:['q1','q2']};assert(saveSharedSchema.safeParse(s).success);assert(!saveSharedSchema.safeParse({...s,questionIds:['q1','q1']}).success);assert(!saveSharedSchema.safeParse({...s,questionIds:[]}).success);});
test('fixed learning sources require a real definition ID',()=>{const s={bankId:'bank',source:'SHARED',sourceId:id,mode:'EXAM',count:30,timeLimitMinutes:null};assert(learningSetupSchema.safeParse(s).success);assert(!learningSetupSchema.safeParse({...s,sourceId:null}).success);assert(!learningSetupSchema.safeParse({...s,source:'PAST',sourceId:'not-a-uuid'}).success);});
test('catalog defaults preserve backward-compatible CMS records',()=>{const {portfolioContentSchema}=load(resolve('src/lib/validation/portfolio.ts'));const p={subtitle:'Sub',title:'Title',description:'Description',sectionHeading:'Heading',buttonLabel:'Open',items:[{id:'one',title:'Title',description:'Description'}]};const c=portfolioContentSchema.parse({about:p,services:p,platform:p,contact:{...p,email:'test@example.invalid',phone:'123',address:'Here'}});assert.equal(c.services.catalogHeading,'Explore Our Learning Programs');assert(c.services.catalogDescription.length>0);});
test('all new admin actions deny unauthorized identities before database access',async()=>{let reached=false;const a=load(resolve('src/actions/learning-catalog.ts'),{'@/lib/auth/admin':{authorizeActiveAdmin:async()=>({ok:false,error:{code:'FORBIDDEN',message:'Admin required'}})},'@/lib/supabase/server':{createClient:async()=>{reached=true;throw Error('Should not query');}},'next/cache':{revalidatePath(){}}});for(const method of ['saveSpecialty','assignMaterial','generateSharedExam','saveSharedExam'])assert.equal((await a[method]({})).ok,false);assert.equal(reached,false);});
test('authorized mutations use trusted RPCs and omit a cleared specialty to use its SQL null default',async()=>{
 const calls=[];const a=load(resolve('src/actions/learning-catalog.ts'),{'@/lib/auth/admin':{authorizeActiveAdmin:async()=>({ok:true,data:{}})},'@/lib/supabase/server':{createClient:async()=>({rpc:async(name,args)=>{calls.push([name,args]);return {data:['save_specialty','generate_shared_exam'].includes(name)?id:null,error:null};}})},'next/cache':{revalidatePath(){}}});
 assert((await a.saveSpecialty({id,slug:'nursing',name:'Nursing',description:'',icon:'nursing',published:true,displayOrder:0})).ok);
 assert((await a.assignMaterial({bankId:'bank',specialtyId:null})).ok);
 assert((await a.generateSharedExam({id,bankId:'bank',title:'Shared',count:35,timeLimitMinutes:null})).ok);
 assert((await a.saveSharedExam({id,title:'Shared',status:'PUBLISHED',questionIds:['q2','q1'],timeLimitMinutes:null})).ok);
 assert.deepEqual(calls.map(c=>c[0]),['save_specialty','assign_bank_specialty','generate_shared_exam','save_shared_exam']);assert.deepEqual(calls[1][1],{bank_id:'bank'});
});
test('invalid admin mutation input cannot reach RPCs',async()=>{
 let queries=0;const a=load(resolve('src/actions/learning-catalog.ts'),{'@/lib/auth/admin':{authorizeActiveAdmin:async()=>({ok:true,data:{}})},'@/lib/supabase/server':{createClient:async()=>{queries++;throw Error('Invalid input reached database');}},'next/cache':{revalidatePath(){}}});
 for(const method of ['saveSpecialty','assignMaterial','generateSharedExam','saveSharedExam'])assert.equal((await a[method]({id,role:'ADMIN',score:100})).ok,false);assert.equal(queries,0);
});
