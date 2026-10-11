// Real local browser/SSR/Supabase routes, without business-data mutations.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { startBrowser, login, waitFor, pause } from './qa-browser.mjs';
const label=process.argv[2]??'after';
const m=JSON.parse(await readFile('.test-artifacts/archive-qa.private.json','utf8'));
assert(['localhost','127.0.0.1'].includes(new URL(m.url).hostname));
const db=createClient(m.url,m.anonKey,{auth:{persistSession:false}});
assert.ifError((await db.auth.signInWithPassword(m.users.student)).error);
const {data:bank,error}=await db.rpc('exam_bank_data',{bank_id:m.bankId});assert.ifError(error);
const active=bank.attempts.find(a=>a.status==='IN_PROGRESS'),completed=bank.attempts.find(a=>a.status==='COMPLETED');
const b=await startBrowser('http://localhost:3100');const issues=[],tested=[];
const widths=[320,360,375,390,412,430,480,600,767,768,900,1024,1366,1440,1920];
try{
 const publicPage=await b.page(),student=await b.page(),teacher=await b.page(),admin=await b.page();
 await login(student,m.users.student,'/student');await login(teacher,m.users.teacher,'/teacher');await login(admin,m.users.admin,'/admin');
 const routes=[...['/','/about','/services','/platform','/contact','/login','/signup','/login/forgot-password'].map(r=>[publicPage,r]),...['/student','/student/question-banks',`/student/banks/${m.bankId}`,`/student/banks/${m.bankId}/past-exams`,`/student/banks/${m.bankId}/setup`,...(active?[`/student/exams/${active.id}`]:[]),...(completed?[`/student/exams/${completed.id}/result`]:[]),'/student/exams','/student/analytics','/student/profile','/account/settings'].map(r=>[student,r]),...['/teacher','/teacher/questions','/teacher/question-banks',`/teacher/question-banks/${m.bankId}`,'/teacher/profile'].map(r=>[teacher,r]),...['/admin','/admin/users','/admin/question-banks',`/admin/question-banks/${m.bankId}`,`/admin/question-banks/${m.bankId}/questions/new`,`/admin/question-banks/${m.bankId}/questions/${m.prefix}-q1/edit`,`/admin/question-banks/${m.bankId}/past-exams`,'/admin/access-requests','/admin/portfolio','/admin/wallet','/admin/settings'].map(r=>[admin,r])];
 for(const [page,route] of routes){
  await page.goto(route);
  for(const dark of [false,true])for(const width of widths){
   await page.resize(width);await page.evaluate(`document.documentElement.classList.toggle('dark',${dark});document.documentElement.style.colorScheme=${JSON.stringify(dark?'dark':'only light')}`);
   try{await page.healthy(route+' '+width+' '+dark);}catch(error){issues.push({route,width,dark,error:error.message});}
   if([320,768,1366,1920].includes(width)&&dark){await page.screenshot('mobile-'+label+'-'+route.replace(/[^a-z0-9]+/gi,'-').slice(0,75)+'-'+width);}
  }
  for(const [w,h] of [[915,412],[844,390],[1024,768]]){await page.resize(w,h);try{await page.healthy(route+' landscape');}catch(error){issues.push({route,width:w,height:h,error:error.message});}}
  tested.push(route);
  console.log('Checked '+route);
 }
 // Mobile drawer must not expose hidden links to keyboard navigation.
 if(label==='after'){
  await teacher.goto('/teacher');await teacher.resize(320);await teacher.evaluate(`document.querySelector('button[aria-label="Open navigation"]').click()`);
  await waitFor(()=>teacher.evaluate('document.querySelector("aside").getAttribute("aria-modal")==="true"'),'mobile dialog');
  assert(await teacher.evaluate('document.body.style.overflow==="hidden" && document.querySelector("aside").contains(document.activeElement)'));
  await teacher.cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await pause(100);
  assert(await teacher.evaluate('document.querySelector("aside").inert && document.body.style.overflow!=="hidden"'));
  await teacher.resize(1366);await waitFor(()=>teacher.evaluate('!document.querySelector("aside").inert'),'desktop navigation restored');
  // Storage-denied system dark preference and a working manual toggle.
  const restricted=await b.page();await restricted.cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});
  await restricted.cdp('Page.addScriptToEvaluateOnNewDocument',{source:'Storage.prototype.getItem=function(){throw new DOMException("Blocked","SecurityError")};Storage.prototype.setItem=function(){throw new DOMException("Blocked","SecurityError")};'});
  await restricted.goto('/login');assert(await restricted.evaluate('document.documentElement.classList.contains("dark")'));
  await restricted.evaluate(`document.querySelector('button[aria-label="Switch to light theme"]').click()`);
  assert(await restricted.evaluate('!document.documentElement.classList.contains("dark") && ["light","only"].every(token=>document.documentElement.style.colorScheme.split(" ").includes(token))'));
  await admin.goto('/admin/users');await admin.resize(320);await admin.click('Add User');await admin.healthy('user dialog 320');await admin.screenshot('mobile-after-user-dialog-320');await admin.click('Cancel','document.querySelector("[role=dialog]")');
 }
 assert.deepEqual(b.errors,[]);assert.deepEqual(b.failedResponses,[]);
 await writeFile(`.test-artifacts/mobile-ui-${label}.json`,JSON.stringify({tested,widths,issues},null,2));
 console.log(JSON.stringify({routes:tested.length,widths:widths.length,themes:2,landscape:3,issues}));
 if(label==='after')assert.deepEqual(issues,[]);
}finally{await b.close();}
