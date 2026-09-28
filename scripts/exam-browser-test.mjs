import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getAdmin, checked, loginAccount } from './backend-qa-data.mjs';
import { startBrowser, login, waitFor } from './qa-browser.mjs';
const m=JSON.parse(await readFile('.test-artifacts/exam-qa.private.json','utf8'));
const db=getAdmin();
const identity=await checked(db.auth.admin.getUserById(m.users[0].id),'Verify TEST identity');
assert.equal(identity.user.email,m.users[0].email);assert(identity.user.user_metadata.full_name.startsWith('[TEST] Exam'));
await checked(db.from('question_attempts').delete().eq('student_id',m.users[0].id).in('question_bank_id',m.banks.map(b=>b.id)),'Reset only controlled TEST attempts');
const browser=await startBrowser(process.env.QA_BASE_URL ?? 'http://localhost:3100');
try {
  const page=await browser.page(); await login(page,m.users[0],'/student');
  const bank=m.banks.find(b=>b.count===40);
  await page.goto('/student/banks/'+bank.id); await page.click('Start Exam');
  await waitFor(()=>page.evaluate("location.pathname.startsWith('/student/exams/') && document.querySelectorAll('fieldset').length===30"),'30 question exam');
  const attempt=await page.evaluate("location.pathname.split('/').at(-1)");
  const original=await page.evaluate("[...document.querySelectorAll('fieldset')].map(f=>({text:f.querySelector('legend').textContent,id:f.querySelector('input').name}))");
  for(const dark of [false,true]) for(const width of [390,430,768,1366,1920]) {
    await page.resize(width); await page.evaluate(`document.documentElement.classList.toggle('dark',${dark})`); await page.healthy('Exam '+width+' '+dark);
    await page.click('Submit Exam'); assert(await page.evaluate("document.querySelector('dialog').open")); await page.healthy('Confirmation '+width+' '+dark); await page.click('Cancel',"document.querySelector('dialog')");
  }
  await page.resize(390); await page.evaluate("document.documentElement.classList.add('dark')"); await page.screenshot('exam-mobile-dark');
  // One real request is fault-injected; retry must persist to the real backend.
  await page.evaluate("window.examOriginalFetch=window.fetch; window.fetch=(...args)=>{if(args[1]?.method==='POST'){window.fetch=window.examOriginalFetch;return Promise.reject(new Error('Controlled QA connection failure'));}return window.examOriginalFetch(...args);}; document.querySelector('fieldset input[value=b]').click()");
  await waitFor(()=>page.evaluate("document.body.innerText.includes('Answer not saved')"),'failed save feedback');
  assert(await page.evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Submit Exam').disabled"));
  await page.click('Retry save'); await waitFor(()=>page.evaluate("document.body.innerText.includes('All selections saved')"),'save retry');
  for(let i=0;i<20;i++) {
    await page.evaluate(`document.querySelectorAll('fieldset')[${i}].querySelector('input[value="a"]').click()`);
    await waitFor(()=>page.evaluate(`document.querySelectorAll('fieldset')[${i}].disabled===false && [...document.querySelectorAll('input:checked')].length===${i+1} && document.body.innerText.includes('All selections saved')`),'save '+i);
  }
  const answers=await checked(db.from('question_attempt_answers').select('selected_option_id,is_correct').eq('attempt_id',attempt),'Read persisted answers');
  assert.equal(answers.length,20);assert(answers.every(a=>a.is_correct===null));
  await page.goto('/student/exams/'+attempt);
  assert.deepEqual(await page.evaluate("[...document.querySelectorAll('fieldset')].map(f=>({text:f.querySelector('legend').textContent,id:f.querySelector('input').name}))"),original);
  assert.equal(await page.evaluate("document.querySelectorAll('input:checked').length"),20);
  const returning=await browser.page(); await login(returning,m.users[0],'/student');
  await returning.goto('/student/exams/'+attempt);
  assert.equal(await returning.evaluate("document.querySelectorAll('input:checked').length"),20);
  await page.goto('/student/banks/'+bank.id); await page.click('Continue Exam');
  await waitFor(()=>page.evaluate(`location.pathname==='/student/exams/${attempt}' && document.querySelectorAll('fieldset').length===30`),'resume same attempt');
  assert.equal(await page.evaluate("document.querySelectorAll('input:checked').length"),20);
  const locked=await loginAccount(m.users[1]);
  assert((await locked.rpc('exam_data',{attempt_id:attempt})).error); assert((await locked.rpc('start_exam',{bank_id:bank.id})).error);
  const student=await loginAccount(m.users[0]);const safe=await checked(student.rpc('exam_data',{attempt_id:attempt}),'Safe exam payload');
  assert(!/is_correct|correct_option_id|answer_key|outcome/.test(JSON.stringify(safe)));
  const starts=await Promise.all([student.rpc('start_exam',{bank_id:bank.id}),student.rpc('start_exam',{bank_id:bank.id})]); assert(starts.every(r=>!r.error&&r.data===attempt));
  await page.click('Submit Exam'); await page.click('Submit Exam',"document.querySelector('dialog')");
  await waitFor(()=>page.evaluate("location.pathname.endsWith('/result') && document.body.innerText.includes('66.67%')"),'graded result');
  for(const dark of [false,true]) for(const width of [390,430,768,1366,1920]) {await page.resize(width);await page.evaluate(`document.documentElement.classList.toggle('dark',${dark})`);await page.healthy('Result '+width+' '+dark);}
  await page.screenshot('exam-result-desktop-dark');
  const retries=await Promise.all([student.rpc('submit_exam',{attempt_id:attempt}),student.rpc('submit_exam',{attempt_id:attempt})]);assert(retries.every(r=>!r.error&&r.data===attempt));
  await page.goto('/student'); assert((await page.text()).includes('66.67%')); await page.goto('/student/banks/'+bank.id);assert((await page.text()).includes('66.67%'));
  await page.goto('/student/exams');assert((await page.text()).includes('66.67%'));
  for(const count of [30,12]) {
    await page.goto('/student/banks/'+m.banks.find(b=>b.count===count).id);await page.click('Start Exam');
    await waitFor(()=>page.evaluate(`document.querySelectorAll('fieldset').length===${count}`),'size '+count);
  }
  await page.goto('/student/banks/'+m.banks.find(b=>b.count===0).id);
  assert(await page.evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Start Exam')?.disabled"));
  assert.deepEqual(browser.failedResponses,[]);assert.deepEqual(browser.errors,[]);
  console.log('PASS real browser start/save/refresh/resume/submit/result/history/dashboard; 30/12/zero; security; concurrent retries; five widths light/dark');
} finally { await browser.close(); }
