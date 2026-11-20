// Real browser/server/RPC flow; all mutations are restricted to isolated LOCAL Supabase.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { startBrowser, login, waitFor, pause } from './qa-browser.mjs';
const m=JSON.parse(await readFile('.test-artifacts/archive-qa.private.json','utf8'));
assert(['localhost','127.0.0.1'].includes(new URL(m.url).hostname));
const status=JSON.parse(execFileSync('cmd.exe',['/d','/s','/c','npx.cmd supabase status --workdir .test-artifacts/archive-db -o json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
assert.equal(status.API_URL,m.url);
const checked=(r)=>{if(r.error)throw Error(r.error.message);return r.data;};
const service=createClient(m.url,status.SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const two={email:m.prefix+'-two-'+randomBytes(4).toString('hex')+'@example.com',password:randomBytes(24).toString('base64url')};
const bankName='[TEST] Archive Bank '+m.prefix.slice(-8);
checked(await service.from('question_banks').update({name:bankName,specialty_id:null}).eq('id',m.bankId));
two.id=checked(await service.auth.admin.createUser({email:two.email,password:two.password,email_confirm:true,user_metadata:{full_name:'[TEST] Independent learning student'}})).user.id;
checked(await service.from('user_bank_access').insert({user_id:two.id,question_bank_id:m.bankId,status:'ACTIVE',granted_by:m.users.admin.id}));
function client(){return createClient(m.url,m.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});}
const adminDb=client(),oneDb=client(),twoDb=client(),lockedDb=client(),anon=client();
for(const [db,user] of [[adminDb,m.users.admin],[oneDb,m.users.student],[twoDb,two],[lockedDb,m.users.locked]])checked(await db.auth.signInWithPassword(user));
const services=checked(await service.from('portfolio_content').select('content').eq('section_key','services').single());
checked(await service.from('portfolio_content').update({content:{...services.content,catalogHeading:'Explore Our Learning Programs'}}).eq('section_key','services'));
const catalog=checked(await anon.rpc('learning_catalog'));const nursing=catalog.find(s=>s.slug==='nursing');
const browser=await startBrowser('http://localhost:3100',{port:9342});const checks=[],timings=[];
const widths=[320,375,390,430,768,1024,1366,1440,1920];
async function responsive(p,name){
 for(const dark of [false,true])for(const width of widths){await p.resize(width);await p.evaluate(`document.documentElement.classList.toggle('dark',${dark})`);await pause(250);await p.healthy(name+' '+width+' '+dark);if([320,768,1366,1920].includes(width)){if(name==='services'||name==='student-catalog')await p.evaluate("[...document.querySelectorAll('h2')].find(h=>/Explore (Your Learning|Our Learning Programs)/.test(h.textContent))?.scrollIntoView({block:'center',behavior:'instant'})");await p.screenshot('learning-'+name+'-'+width+'-'+(dark?'dark':'light'));}}
 for(const [w,h] of [[844,390],[1024,768]]){await p.resize(w,h);await p.healthy(name+' landscape');}
 checks.push(name+': nine widths, light/dark, two landscape sizes');
}
async function measure(p,path){const samples=[];for(let i=0;i<3;i++){await p.goto(path);samples.push(await p.evaluate("(()=>{const n=performance.getEntriesByType('navigation')[0];return {ttfb:n.responseStart,dom:n.domContentLoadedEventEnd,load:n.loadEventEnd,resources:performance.getEntriesByType('resource').length,bytes:performance.getEntriesByType('resource').reduce((s,r)=>s+r.transferSize,0)};})()"));}timings.push({path,samples});}
async function payload(db,id){return checked(await db.rpc('exam_data',{attempt_id:id}));}
async function finish(p,db,id){await waitFor(()=>p.evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent==='Submit Exam'&&!b.disabled)"),'submit ready');await p.click('Submit Exam');await p.click('Submit Exam','document.querySelector("dialog")');try{await waitFor(()=>p.evaluate("location.pathname.endsWith('/result')"),'results navigation');}catch(e){console.log(JSON.stringify({path:await p.evaluate('location.pathname'),body:(await p.text()).slice(0,2000),errors:browser.errors,status:(await payload(db,id)).status}));throw e;}return payload(db,id);}
async function start(p,source,id){await p.goto(`/student/banks/${m.bankId}/setup?source=${source}${id?'&sourceId='+id:''}`);await p.click('Start session');await waitFor(()=>p.evaluate("Boolean(document.querySelector('nav[aria-label=\"Question navigator\"]'))"),'started '+source);return p.evaluate("location.pathname.split('/').at(-1)");}
async function select(p,db,id,value){const questionId=await p.evaluate("document.querySelector('fieldset input').name");await p.evaluate(`document.querySelector('fieldset input[value="${value}"]').click()`);await waitFor(async()=>{const data=await payload(db,id);return data.questions.find(q=>q.id===questionId)?.selectedOptionId===value;},'answer persisted');await waitFor(()=>p.evaluate("!document.querySelector('fieldset').disabled"),'selection ready');}
try{
 const admin=await browser.page();await admin.confirmDialogs();await login(admin,m.users.admin,'/admin');
 await admin.goto('/admin/specialties');await responsive(admin,'admin-specialties');
 await admin.fill(`select[aria-label="Specialty for ${bankName}"]`,nursing.id);
 await waitFor(async()=>checked(await anon.rpc('learning_catalog')).find(s=>s.slug==='nursing').materials.some(b=>b.id===m.bankId),'assignment persisted');
 await admin.click('Edit');await admin.fillLabel('Description','Nursing learning materials and clinical preparation.');await admin.click('Save specialty');
 await waitFor(async()=>checked(await anon.rpc('learning_catalog')).find(s=>s.slug==='nursing').description==='Nursing learning materials and clinical preparation.','specialty edit persisted');
 const visitor=await browser.page();await visitor.goto('/services');assert((await visitor.text()).includes('Explore Our Learning Programs'));await responsive(visitor,'services');await measure(visitor,'/services');
 for(const slug of ['nursing','medical','dentistry']){await visitor.goto('/programs/'+slug);await responsive(visitor,'public-'+slug);if(slug==='nursing')assert((await visitor.text()).includes('[TEST] Archive Bank'));else assert(!(await visitor.text()).includes('[TEST] Archive Bank'));}
 assert(!/correct_option_id|answer_key|storage_path|options/.test(JSON.stringify(checked(await anon.rpc('learning_catalog')))));
 await admin.goto('/admin/portfolio');await admin.click('Services page');await admin.fillLabel('Learning catalog heading','[TEST] Live Learning Programs');await admin.click('Save Changes');await waitFor(()=>admin.evaluate("document.body.innerText.includes('Portfolio content updated successfully.')"),'catalog CMS save');
 await visitor.goto('/services');assert((await visitor.text()).includes('[TEST] Live Learning Programs'));await responsive(admin,'catalog-cms');
 await admin.goto(`/admin/question-banks/${m.bankId}/shared-exams`);await responsive(admin,'shared-empty');
 await admin.fillLabel('Exam title','[TEST] Fixed Exam A');await admin.fillLabel('Requested questions','35');await admin.click('Generate draft');
 await waitFor(()=>admin.evaluate("Boolean(document.querySelector('details'))"),'generated draft');
 let definition=checked(await adminDb.rpc('admin_shared_exams',{bank_id:m.bankId}))[0];assert.equal(definition.questionCount,35);assert.equal(checked(await oneDb.rpc('exam_bank_data',{bank_id:m.bankId})).sharedExams.length,0);
 await admin.evaluate("document.querySelector('details').open=true;document.querySelector('button[aria-label=\"Move question 1 down\"]').click()");await responsive(admin,'shared-draft');
 await admin.click('Save draft');await waitFor(async()=>checked(await adminDb.rpc('admin_shared_exams',{bank_id:m.bankId}))[0].questions[0].questionId===definition.questions[1].questionId,'saved reordering');
 await admin.click('Publish exam');await waitFor(async()=>checked(await oneDb.rpc('exam_bank_data',{bank_id:m.bankId})).sharedExams.length===1,'published shared exam');
 await admin.goto(`/admin/question-banks/${m.bankId}/shared-exams`);assert(await admin.evaluate("document.querySelector('input').disabled===false && document.querySelectorAll('fieldset')[1].disabled"));await responsive(admin,'shared-published');
 definition=checked(await adminDb.rpc('admin_shared_exams',{bank_id:m.bankId}))[0];
 const one=await browser.page(),second=await browser.page();await login(one,m.users.student,'/student');await login(second,two,'/student');
 // A prior regression run may leave checked practice open. Finish only this local fixture's attempt.
 for(const db of [oneDb,twoDb]){const b=checked(await db.rpc('exam_bank_data',{bank_id:m.bankId}));for(const a of b.attempts.filter(a=>a.status==='IN_PROGRESS'))checked(await db.rpc('submit_exam',{attempt_id:a.id}));}
 await one.goto('/student');await responsive(one,'student-catalog');await measure(one,'/student');
 for(const slug of ['nursing','medical','dentistry']){await one.goto('/student/specialties/'+slug);await responsive(one,'student-'+slug);if(slug==='nursing')assert((await one.text()).includes('[TEST] Archive Bank'));else assert(!(await one.text()).includes('[TEST] Archive Bank'));}
 await one.goto(`/student/banks/${m.bankId}`);for(const label of ['Random Questions From Different Years','Past Year Exams','Shared Random Exams'])assert((await one.text()).includes(label));await responsive(one,'material');
 await one.goto(`/student/banks/${m.bankId}/shared-exams`);await responsive(one,'shared-list');await one.click('[TEST] Fixed Exam A');await waitFor(()=>one.evaluate("document.body.innerText.includes('Prepare your session')"),'shared setup');await responsive(one,'shared-setup');
 const ids=[];for(const [p,db] of [[one,oneDb],[second,twoDb]]){
  const id=await start(p,'SHARED',definition.id);ids.push(id);const data=await payload(db,id);assert.equal(data.totalQuestions,35);assert.deepEqual(data.questions.map(q=>q.id),definition.questions.map(q=>q.questionId));assert(!/correctOptionId|outcome|answer_key/.test(JSON.stringify(data)));
  await responsive(p,'shared-question-'+ids.length);
  const option=ids.length===1?definition.questions[0].correct_option_id:definition.questions[0].options.find(o=>o.id!==definition.questions[0].correct_option_id).id;
  await select(p,db,id,option);assert.equal(await p.evaluate("document.querySelectorAll('fieldset svg').length"),0);
  await p.goto('/student/exams/'+id);assert.deepEqual((await payload(db,id)).questions.map(q=>q.id),data.questions.map(q=>q.id));
  const result=await finish(p,db,id);assert.equal(result.result.correct,ids.length===1?1:0);await responsive(p,'shared-result-'+ids.length);
 }
 assert.notEqual(ids[0],ids[1]);assert((await twoDb.rpc('exam_data',{attempt_id:ids[0]})).error);
 assert((await lockedDb.rpc('start_learning_exam',{config:{bankId:m.bankId,source:'SHARED',sourceId:definition.id,mode:'EXAM',count:30,timeLimitMinutes:null}})).error);
 assert((await lockedDb.from('shared_exams').select('id')).data.every(e=>e.id!==definition.id));
 const past=checked(await oneDb.rpc('exam_bank_data',{bank_id:m.bankId})).pastExams[0];const pastOrders=[];
 for(const [p,db] of [[one,oneDb],[second,twoDb]]){const id=await start(p,'PAST',past.id);pastOrders.push((await payload(db,id)).questions.map(q=>q.id));await finish(p,db,id);}assert.deepEqual(...pastOrders);
 const randomOrders=[];for(const [p,db] of [[one,oneDb],[second,twoDb]]){const id=await start(p,'RANDOM');const q=(await payload(db,id)).questions.map(q=>q.id);assert.equal(q.length,30);assert.equal(new Set(q).size,30);randomOrders.push(q);await p.goto('/student/exams/'+id);assert.deepEqual((await payload(db,id)).questions.map(q=>q.id),q);await finish(p,db,id);}assert.notDeepEqual(...randomOrders);
 const practice=await start(one,'ALL');let data=await payload(oneDb,practice);assert(!data.questions[0].correctOptionId);const q=data.questions[0],key=q.text==='First imported fixture question'?'B':q.text==='Second imported fixture question'?'A':'a';
 await select(one,oneDb,practice,key);await one.click('Check answer');await waitFor(()=>one.evaluate("document.body.innerText.includes('Correct Answer')"),'green feedback');assert(await one.evaluate("document.querySelector('fieldset').disabled && document.querySelector('[aria-label=\"Correct answer\"]')!==null"));await responsive(one,'correct-feedback');
 await one.click('Next');data=await payload(oneDb,practice);const q2=data.questions[1],key2=q2.text==='First imported fixture question'?'B':q2.text==='Second imported fixture question'?'A':'a';await select(one,oneDb,practice,q2.options.find(o=>o.id!==key2).id);await one.click('Check answer');await waitFor(()=>one.evaluate("document.body.innerText.includes('Incorrect Answer')"),'red feedback');assert(await one.evaluate("document.querySelector('fieldset').disabled && document.querySelector('[aria-label=\"Incorrect answer\"]')!==null"));await responsive(one,'incorrect-feedback');
 await one.cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});assert.equal(await one.evaluate("getComputedStyle(document.querySelector('.answer-feedback-mark')).animationName"),'none');
 await finish(one,oneDb,practice);
 await admin.goto(`/admin/question-banks/${m.bankId}/shared-exams`);await admin.click('Archive exam');await waitFor(async()=>checked(await oneDb.rpc('exam_bank_data',{bank_id:m.bankId})).sharedExams.length===0,'archiving');assert.equal((await payload(oneDb,ids[0])).status,'COMPLETED');
 assert((await oneDb.rpc('start_learning_exam',{config:{bankId:m.bankId,source:'SHARED',sourceId:definition.id,mode:'EXAM',count:30,timeLimitMinutes:null}})).error);
 for(let i=0;i<6;i++)checked(await adminDb.rpc('generate_shared_exam',{payload:{id:crypto.randomUUID(),bankId:m.bankId,title:'[TEST] Paging '+i,count:1,timeLimitMinutes:null}}));
 await admin.goto(`/admin/question-banks/${m.bankId}/shared-exams?page=1`);assert((await admin.text()).includes('Page 2'));assert.equal(await admin.evaluate("document.querySelectorAll('details').length"),2);
 await responsive(admin,'shared-paged');await admin.fillLabel('Exam title','[TEST] Generated from page two');await admin.fillLabel('Requested questions','2');await admin.click('Generate draft');await waitFor(()=>admin.evaluate("location.search==='' && document.body.innerText.includes('[TEST] Generated from page two')"),'new draft visible from later page');
 await admin.goto('/admin/specialties');const assignment=`select[aria-label="Specialty for ${bankName}"]`;await admin.fill(assignment,'');await waitFor(async()=>checked(await adminDb.from('question_banks').select('specialty_id').eq('id',m.bankId).single()).specialty_id===null,'null assignment');await admin.fill(assignment,nursing.id);await waitFor(async()=>checked(await anon.rpc('learning_catalog')).find(s=>s.slug==='nursing').materials.some(b=>b.id===m.bankId),'assignment restored');
 checks.push('Browser Admin assignment/edit/generation/reorder/publish/archive, CMS persistence; public summaries only; two-student SHARED/PAST/RANDOM; frozen/resumed order; independent scores; neutral exam selections; green/red checked practice; immutable checked answers; reduced motion; locked RLS and student isolation');
 assert.deepEqual(browser.errors,[]);assert.deepEqual(browser.failedResponses,[]);
 await writeFile('.test-artifacts/learning-browser-results.json',JSON.stringify({passed:true,checks,widths,timings,physicalSamsung:false,production:false},null,2));console.log(JSON.stringify({passed:true,checks,timings}));
}finally{await browser.close();}
