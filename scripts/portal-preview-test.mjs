// Read-only live verification using existing QA identities. No test data writes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadManifest, getAdmin, loginAccount, checked } from './backend-qa-data.mjs';
import { startBrowser, login, waitFor } from './qa-browser.mjs';

const base = process.env.LHCC_TEST_URL ?? 'http://localhost:3100';
const m = await loadManifest();
const db = getAdmin();
async function fingerprint() {
 const values = [];
 for (const table of ['question_attempts','question_attempt_answers','user_bank_access_requests','user_bank_access','wallet_transactions']) {
  const rows = await checked(db.from(table).select('*').order('id'), table);
  values.push([table,rows]);
 }
 return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}
const before = await fingerprint();
const browser = await startBrowser(base);
const body = page => page.evaluate(`(() => {const node=document.querySelector('main').cloneNode(true);node.querySelector('[aria-label="View-as mode"]')?.remove();return node.textContent.replace(/Read-only preview\\. Access requests must be made by the student\\./g,'').replace(/\\s+/g,' ').trim();})()`);
const path = (role,key,section='') => `/admin/view-as/${role}/${m.users[key].id}${section ? '/'+section : ''}`;
async function clickRoute(page,label,destination) {
 await page.click(label);
 await waitFor(()=>page.evaluate(`location.pathname===${JSON.stringify(destination)}`), label);
 await waitFor(()=>page.evaluate("document.readyState==='complete' && Boolean(document.querySelector('main h1'))"),label+' ready');
}
try {
 const expected = {};
 for (const key of ['approved','completed','locked','pending','rejected','teacher']) {
  const role = key==='teacher' ? 'teacher' : 'student';
  const page = await browser.page(); await login(page,m.users[key],'/'+role);
  expected[key] = {dashboard:await body(page)};
  await page.goto('/'+role+'/analytics'); expected[key].analytics=await body(page);
  await page.goto('/'+role+'/question-banks');
  expected[key].banks=await page.evaluate("[...document.querySelectorAll('main article')].map(el=>el.textContent.replace(/\\s+/g,' ').trim())");
  await page.goto(path('student','completed'));assert(await page.evaluate("location.pathname==='/unauthorized'"),'non-admin route denied');
  console.log('PASS normal '+key+': reference data and preview denial');
 }
 const page=await browser.page();await login(page,m.users.admin,'/admin');
 for (const role of ['student','teacher']) {
  await page.goto('/admin/view-as/'+role);
  for(const dark of [false,true]) for(const width of [390,430,768,1366,1920]) {
   await page.resize(width);await page.evaluate(`document.documentElement.classList.toggle('dark',${dark})`);await page.healthy(role+' selector '+width);
   if ((dark && width===390) || (!dark && width===1366)) await page.screenshot(`preview-${role}-selector-${width}-${dark?'dark':'light'}`);
  }
  const key=role==='student'?'completed':'teacher';
  await page.goto('/admin/view-as/'+role+'?q='+encodeURIComponent(m.users[key].email));
  assert(await page.evaluate(`document.querySelectorAll('tbody tr').length===1 && document.querySelector('tbody').textContent.includes(${JSON.stringify(m.users[key].name)})`),'email search');
  await page.evaluate("document.querySelector('tbody a').click()");
  await waitFor(()=>page.evaluate(`location.pathname===${JSON.stringify(path(role,key))}`),'selected target');
  await page.goto(path(role,key));
  assert.equal(await body(page),expected[key].dashboard,'dashboard equals actual subject');
  for(const dark of [false,true]) for(const width of [390,430,768,1366,1920]) {
   await page.resize(width);await page.evaluate(`document.documentElement.classList.toggle('dark',${dark})`);await page.healthy(role+' banner '+width);
   if ((dark && width===390) || (!dark && width===1366)) await page.screenshot(`preview-${role}-banner-${width}-${dark?'dark':'light'}`);
  }
  await page.resize(1366,768);
  assert((await page.text()).includes('Signed in as '+m.users.admin.name+' — Administrator'));
  await clickRoute(page,'Change '+(role==='student'?'Student':'Teacher'),'/admin/view-as/'+role);
  if(role==='student') {
   await page.goto(path(role,'approved'));assert.equal(await body(page),expected.approved.dashboard,'change student context');
  } else {
   await page.goto(path(role,key));assert.equal(await body(page),expected[key].dashboard,'teacher reselection');
  }
  await clickRoute(page,'Exit View','/admin');
  await page.goto(path(role,key));await clickRoute(page,'Back to Website','/');
  assert(await page.evaluate("document.querySelector('header a[href=\"/admin\"]').textContent==='Dashboard'"),'public identity remains admin');
  await clickRoute(page,'Dashboard','/admin');
  console.log('PASS '+role+': selector/search, subject data, change/exit, refresh, actor/session, responsive light/dark');
 }
 for(const key of ['approved','completed','locked','pending','rejected','teacher']) {
  const role=key==='teacher'?'teacher':'student';
  await page.goto(path(role,key));assert.equal(await body(page),expected[key].dashboard,key+' dashboard data');
  await page.goto(path(role,key,'analytics'));assert.equal(await body(page),expected[key].analytics,key+' analytics data');
  await page.goto(path(role,key,'question-banks'));
  const cards=await page.evaluate("[...document.querySelectorAll('main article')].map(el=>el.textContent.replace(/Read-only preview\\. Access requests must be made by the student\\./g,'').replace(/\\s+/g,' ').trim())");
  assert.deepEqual(cards,expected[key].banks,key+' bank grants/requests');
  assert(await page.evaluate("[...document.querySelectorAll('main article button')].every(el=>el.disabled)"),'no access-request writes');
 }
 await page.goto(path('student','completed','banks/'+m.banks[0].id));
 assert(await page.evaluate("document.querySelectorAll('main form fieldset').length>0 && [...document.querySelectorAll('main form button,main form fieldset')].every(el=>el.disabled)"),'no answer writes');
 for(const invalid of ['/admin/view-as/student/random-id',path('student','teacher'),path('teacher','approved')]) {
  await page.goto(invalid);assert((await page.text()).includes('Page not found'),'invalid target safely rejected');
 }
 // Read-only security regressions against unchanged RLS and guarded RPCs.
 for(const key of ['approved','teacher']) {
  const client=await loginAccount(m.users[key]);
  const result=await client.rpc('admin_bank_data');assert(result.error,'admin RPC denied');
  const wallet=await client.from('wallet_transactions').select('*');assert(wallet.error || wallet.data.length===0,'wallet isolation');
 }
 const student=await loginAccount(m.users.locked);
 for(const [table,column,id] of [['question_attempts','student_id',m.users.completed.id],['user_bank_access','user_id',m.users.approved.id],['profiles','id',m.users.admin.id]]) {
  const rows=await checked(student.from(table).select('*').eq(column,id),table);assert.deepEqual(rows,[],'student isolation');
 }
 const keys=await student.schema('private').from('question_solutions').select('*');assert(keys.error,'answer-key protection');
 assert.equal(await fingerprint(),before,'preview has no business-data writes');
 assert.deepEqual(browser.failedResponses,[]);assert.deepEqual(browser.errors.filter(error=>!error.includes('404')),[]);
 console.log('PASS data equality for 5 students/teacher, target validation, non-admin guards, read-only/RLS/answer security: '+base);
} finally {await browser.close();}
