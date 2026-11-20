// Real browser -> server actions -> isolated LOCAL Supabase. No production mutations.
import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { startBrowser,login,waitFor,pause } from './qa-browser.mjs';
const manifest=JSON.parse(await readFile('.test-artifacts/archive-qa.private.json','utf8'));
assert(['localhost','127.0.0.1'].includes(new URL(manifest.url).hostname));
const browser=await startBrowser('http://localhost:3100');const checks=[];
async function checked(result,label){if(result.error)throw Error(label+': '+result.error.message);return result.data;}
function client(){return createClient(manifest.url,manifest.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});}
const adminDb=client();const studentDb=client();const lockedDb=client();
await checked(await adminDb.auth.signInWithPassword(manifest.users.admin),'Admin sign-in');await checked(await studentDb.auth.signInWithPassword(manifest.users.student),'Student sign-in');await checked(await lockedDb.auth.signInWithPassword(manifest.users.locked),'Locked sign-in');
const widths=[320,375,390,430,768,1024,1366,1440,1920];
async function responsive(page,screen,exercise){
 for(const dark of [false,true])for(const width of widths){await page.resize(width);await page.evaluate(`document.documentElement.classList.toggle('dark',${dark})`);await pause(250);await page.healthy(screen+' '+width+' '+dark);if(exercise)await exercise(page);if([320,768,1366,1920].includes(width)){await page.evaluate('window.scrollTo(0,0)');await page.screenshot('archive-'+screen+'-'+width+'-'+(dark?'dark':'light'));}}
 for(const [width,height] of [[844,390],[1024,768]]){await page.resize(width,height);await page.healthy(screen+' landscape '+width);if(exercise)await exercise(page);}
 checks.push(screen+' at nine widths, both themes, plus landscape');
}
try {
 const admin=await browser.page();await admin.confirmDialogs();await login(admin,manifest.users.admin,'/admin');
 await admin.goto('/admin/question-banks/'+manifest.bankId+'/past-exams');await responsive(admin,'admin-archive');
 await admin.click('Create / Import exam');
 const pdf=(await readFile('.test-artifacts/archive-2025-fixture.pdf')).toString('base64');
 await admin.evaluate(`(()=>{const bytes=Uint8Array.from(atob(${JSON.stringify(pdf)}),c=>c.charCodeAt(0));const file=new File([bytes],'archive-2025-fixture.pdf',{type:'application/pdf'});const transfer=new DataTransfer();transfer.items.add(file);const input=document.querySelector('input[type=file]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await waitFor(()=>admin.evaluate("document.body.innerText.includes('Extraction is ready for review')"),'real PDF extraction',90000);
 assert(await admin.evaluate("[...document.querySelectorAll('label')].find(l=>l.textContent.startsWith('Confirmed exam year')).querySelector('input').value===''"),'No invented year');
 await admin.fillLabel('Confirmed exam year','2025');await admin.fillLabel('Session label','A');
 await responsive(admin,'admin-review');
 await admin.evaluate("[...document.querySelectorAll('label')].filter(l=>l.textContent.includes('I compared this question')).forEach(l=>l.querySelector('input').click())");
 await admin.click('Save draft');await waitFor(()=>admin.evaluate("document.body.innerText.includes('saved as draft successfully')"),'draft save');
 let adminData=await checked(await adminDb.rpc('admin_past_exams',{bank_id:manifest.bankId}),'Admin draft');const examId=adminData.exams[0].id;const source=adminData.sources[0];assert.equal(adminData.exams[0].questions.length,2);
 let bank=await checked(await studentDb.rpc('exam_bank_data',{bank_id:manifest.bankId}),'Student bank');assert.equal(bank.pastExams.length,0);assert.equal(bank.available,40);
 assert((await studentDb.storage.from('exam-source-pdfs').download(source.storagePath)).error,'Student cannot download original');
 assert.equal((await checked(await studentDb.from('exam_sources').select('id'),'Private source RLS')).length,0);
 await admin.click('Publish reviewed exam');await waitFor(()=>admin.evaluate("document.body.innerText.includes('published successfully')"),'publish');
 await admin.click('Publish reviewed exam');await waitFor(()=>admin.evaluate("document.body.innerText.includes('published successfully')"),'repeat publish');
 bank=await checked(await studentDb.rpc('exam_bank_data',{bank_id:manifest.bankId}),'Published archive');assert.equal(bank.available,42);assert.equal(bank.pastExams.length,1);assert.equal(bank.cases.find(c=>c.id===manifest.sectionId).questionCount,40);
 checks.push('PDF private upload, extraction, year confirmation, verified-key review, draft, publish, repeat publish and clinical-content preservation');
 const student=await browser.page();await login(student,manifest.users.student,'/student');await responsive(student,'dashboard');
 await student.goto('/student/banks/'+manifest.bankId);await responsive(student,'complete-bank');
 await student.goto('/student/banks/'+manifest.bankId+'/past-exams');await responsive(student,'year-archive',async page=>{await page.fill('input[placeholder="Search title or session"]','fixture');await page.fill('select','2025');assert((await page.text()).includes('Open Exam'));await page.fill('input[placeholder="Search title or session"]','');});
 await student.click('Open Exam');await waitFor(()=>student.evaluate("document.body.innerText.includes('Prepare your session')"),'past setup');await responsive(student,'setup');await student.click('Start session');
 await waitFor(()=>student.evaluate("Boolean(document.querySelector('nav[aria-label=\"Question navigator\"]'))"),'exam interface');
 const attempt=await student.evaluate("location.pathname.split('/').at(-1)");let payload=await checked(await studentDb.rpc('exam_data',{attempt_id:attempt}),'Frozen past exam');assert.equal(payload.totalQuestions,2);assert.equal(payload.questions[0].text,'First imported fixture question');assert(!/correctOptionId|outcome/.test(JSON.stringify(payload)));
 await responsive(student,'question',async page=>{await page.click('Next');await waitFor(()=>page.evaluate("document.body.innerText.toLowerCase().includes('question 2 / 2')"),'next question');await page.click('Previous');await waitFor(()=>page.evaluate("document.body.innerText.toLowerCase().includes('question 1 / 2')"),'previous question');await page.click('Submit Exam');assert(await page.evaluate("document.querySelector('dialog').open"));await page.healthy('submission dialog');await page.click('Cancel','document.querySelector("dialog")');});
 await student.evaluate("document.querySelector('fieldset input[value=A]').click()");await waitFor(()=>student.evaluate("document.querySelector('fieldset').disabled===false && document.body.innerText.includes('Selections saved')"),'save first');await student.click('Next');await student.evaluate("document.querySelector('fieldset input[value=A]').click()");await waitFor(()=>student.evaluate("document.querySelector('fieldset').disabled===false"),'save second');
 await student.goto('/student/exams/'+attempt);assert(await student.evaluate("document.querySelector('fieldset input[value=A]').checked"));await student.click('Submit Exam');await student.click('Submit Exam','document.querySelector("dialog")');await waitFor(()=>student.evaluate("location.pathname.endsWith('/result') && document.body.innerText.includes('50.00%')"),'past score');await responsive(student,'result');
 assert((await lockedDb.rpc('exam_data',{attempt_id:attempt})).error);assert((await lockedDb.rpc('start_learning_exam',{config:{bankId:manifest.bankId,source:'PAST',sourceId:examId,mode:'EXAM',count:30,timeLimitMinutes:null}})).error);
 const submitted=await Promise.all([studentDb.rpc('submit_exam',{attempt_id:attempt}),studentDb.rpc('submit_exam',{attempt_id:attempt})]);assert(submitted.every(r=>!r.error&&r.data===attempt));
 await student.goto('/student/exams');await responsive(student,'progress');assert((await student.text()).includes('2025'));
 await student.goto('/student/banks/'+manifest.bankId+'/setup?source=RANDOM');await student.click('Start session');await waitFor(()=>student.evaluate("document.body.innerText.toLowerCase().includes('question 1 / 30')"),'random thirty');const randomAttempt=await student.evaluate("location.pathname.split('/').at(-1)");
 const frozenRandom=await checked(await studentDb.rpc('exam_data',{attempt_id:randomAttempt}),'Random snapshot');
 await student.evaluate("window.qaOriginalFetch=window.fetch;window.fetch=(...args)=>{if(args[1]?.method==='POST'){window.fetch=window.qaOriginalFetch;return Promise.reject(new Error('Controlled QA connection failure'));}return window.qaOriginalFetch(...args);};document.querySelector('fieldset input').click()");
 await waitFor(()=>student.evaluate("document.body.innerText.includes('Answer not saved')"),'random failed-save feedback');
 await student.click('Retry save');await waitFor(async()=>Boolean((await studentDb.rpc('exam_data',{attempt_id:randomAttempt})).data.questions[0].selectedOptionId),'random retry persisted');
 await student.goto('/student/exams/'+randomAttempt);assert(await student.evaluate("Boolean(document.querySelector('fieldset input:checked'))"));
 await student.goto('/student/banks/'+manifest.bankId);await student.click('Continue Exam');await waitFor(()=>student.evaluate(`location.pathname==='/student/exams/${randomAttempt}'`),'random resume');
 const resumedRandom=await checked(await studentDb.rpc('exam_data',{attempt_id:randomAttempt}),'Resumed snapshot');assert.deepEqual(resumedRandom.questions.map(q=>q.id),frozenRandom.questions.map(q=>q.id));assert(resumedRandom.questions[0].selectedOptionId);
 await waitFor(()=>student.evaluate("Boolean(document.querySelector('nav[aria-label=\"Question navigator\"]')) && [...document.querySelectorAll('button')].some(b=>b.textContent==='Submit Exam' && !b.disabled)"),'resumed exam controls ready');
 await student.click('Submit Exam');await student.click('Submit Exam','document.querySelector("dialog")');await waitFor(()=>student.evaluate("location.pathname.endsWith('/result')"),'random result');assert.equal((await checked(await studentDb.rpc('exam_data',{attempt_id:randomAttempt}),'Random result')).totalQuestions,30);
 await student.goto('/student/banks/'+manifest.bankId+'/setup?source=ALL');await student.click('Start session');await waitFor(()=>student.evaluate("document.body.innerText.toLowerCase().includes('question 1 / 42')"),'all practice');const practiceId=await student.evaluate("location.pathname.split('/').at(-1)");await student.evaluate("document.querySelector('fieldset input').click()");await waitFor(()=>student.evaluate("document.querySelector('fieldset').disabled===false"),'practice saved');await student.click('Check answer');await waitFor(()=>student.evaluate("document.body.innerText.includes('Correct Answer')"),'practice feedback');payload=await checked(await studentDb.rpc('exam_data',{attempt_id:practiceId}),'Checked practice');assert(payload.questions[0].correctOptionId);assert(!payload.questions[1].correctOptionId);assert((await studentDb.rpc('save_exam_answer',{attempt_id:practiceId,question_id:payload.questions[0].id,option_id:payload.questions[0].options[1].id})).error);await responsive(student,'practice');
 checks.push('past-year fixed order, exam key protection, answer save/reload, score/year persistence, user isolation, approval guard, idempotent submit, random 30 and complete 42-question practice with immutable checked feedback');
 assert.deepEqual(browser.failedResponses,[]);assert.deepEqual(browser.errors,[]);
 await writeFile('.test-artifacts/archive-browser-results.json',JSON.stringify({passed:true,checks,widths,production:false},null,2));console.log(JSON.stringify({passed:true,checks}));
}finally{await browser.close();}
