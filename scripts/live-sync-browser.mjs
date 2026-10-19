// Multi-session integration against isolated LOCAL Supabase. No production writes.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {assertLocalQaTarget} from './qa-safety.mjs';
import {startBrowser,login,waitFor,card,pause} from './qa-browser.mjs';
const m=JSON.parse(await readFile('.test-artifacts/archive-qa.private.json','utf8'));
const settings=Object.fromEntries((await readFile('.test-artifacts/archive-qa.env','utf8')).trim().split(/\r?\n/).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1)];}));
const url=assertLocalQaTarget(m.url);assert.equal(assertLocalQaTarget(settings.NEXT_PUBLIC_SUPABASE_URL),url);
const service=createClient(url,settings.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
function checked(r){assert.ifError(r.error);return r.data;}
const user={email:'live-'+randomUUID()+'@example.com',password:randomBytes(24).toString('base64url'),name:'[TEST] Live '+randomBytes(4).toString('hex')};
user.id=checked(await service.auth.admin.createUser({email:user.email,password:user.password,email_confirm:true,user_metadata:{full_name:user.name}})).user.id;
const adminDb=createClient(url,m.anonKey,{auth:{persistSession:false}});checked(await adminDb.auth.signInWithPassword(m.users.admin));
const studentDb=createClient(url,m.anonKey,{auth:{persistSession:false}});checked(await studentDb.auth.signInWithPassword(user));
const bankId=randomUUID(),bankName='[TEST] Live Bank '+bankId.slice(0,8),rejectId=randomUUID(),rejectName='[TEST] Reject '+bankId.slice(0,8);
for(const [id,name]of [[bankId,bankName],[rejectId,rejectName]])checked(await adminDb.rpc('manage_bank_content',{operation:'save_bank',item_id:id,payload:{name,description:'Local realtime regression',status:'active',price:0}}));
for(let i=1;i<=2;i++)checked(await adminDb.rpc('manage_bank_content',{operation:'save_question',item_id:bankId+'-q'+i,payload:{bankId,text:'[TEST] Live question '+i,status:'active',answers:[{id:'a',text:'First option',isCorrect:true},{id:'b',text:'Second option',isCorrect:false}]}}));
const browser=await startBrowser('http://localhost:3100',{port:9348}),checks=[],latencies=[];
async function soon(fn,label){await waitFor(fn,label,15000);}
async function screenshot(p,label){for(const dark of [false,true])for(const width of [320,375,390,430,768,1024,1366,1440,1920]){await p.resize(width);await p.evaluate(`document.documentElement.classList.toggle('dark',${dark})`);await p.healthy(label);if([320,768,1366,1920].includes(width))await p.screenshot('live-'+label+'-'+width+'-'+dark);}}
try{
 const admin=await browser.page(),student=await browser.page(),second=await browser.page();
 await admin.confirmDialogs();await login(admin,m.users.admin,'/admin');await admin.goto('/admin/access-requests');
 await login(student,user,'/student');await student.goto('/student/question-banks');
 await login(second,user,'/student');await second.goto('/student/question-banks');
 for(const p of [admin,student,second])await soon(async()=>(await p.text()).includes('Live updates connected'),'private channel joined');
 let started=Date.now();await student.click('Request Access',card(bankName));
 await soon(async()=>(await admin.text()).includes(user.name),'Admin receives request without navigation');latencies.push({event:'request',ms:Date.now()-started});
 started=Date.now();await admin.click('Approve',card(user.name));
 for(const p of [student,second])await soon(()=>p.evaluate(`${card(bankName)}?.innerText.includes('Access Granted')`),'same-page approval in both sessions');
 latencies.push({event:'approval',ms:Date.now()-started});checks.push('request → Admin live queue → confirmed approval → both student sessions unlock, no reload');
 await screenshot(student,'approval');
 await student.click('Open Course',card(bankName));await soon(()=>student.evaluate(`location.pathname==='/student/banks/${bankId}'`),'open approved material');
 // Revocation while protected material is already open, not only a catalog badge.
 await admin.fillLabel('Request status','ALL');await admin.click('Revoke Access',card(user.name));
 await soon(async()=>(await student.text()).includes('no longer available'),'protected material removed after revocation');
 await soon(async()=>(await second.text()).includes('Access revoked'),'other session revocation status');
 assert((await studentDb.rpc('start_exam',{bank_id:bankId})).error);checks.push('Admin revocation clears loaded material and backend denies learning');
 await second.click('Request Access',card(rejectName));
 await soon(()=>admin.evaluate(`${card(user.name)}?.innerText.includes('PENDING') || [...document.querySelectorAll('article')].some(a=>a.innerText.includes(${JSON.stringify(rejectName)})&&a.innerText.includes('PENDING'))`),'second request appears');
 await admin.click('Reject',`[...document.querySelectorAll('article')].find(a=>a.innerText.includes(${JSON.stringify(rejectName)})&&a.innerText.includes(${JSON.stringify(user.name)}))`);
 await soon(()=>second.evaluate(`${card(rejectName)}?.innerText.includes('Access Request Rejected')`),'live rejection');checks.push('rejection updates without navigation');
 // Missed events: change grant while offline; online wake must reconcile.
 await second.cdp('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 checked(await service.from('user_bank_access').update({status:'ACTIVE',revoked_at:null}).eq('user_id',user.id).eq('question_bank_id',bankId));
 await pause(500);await second.cdp('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await second.evaluate("window.dispatchEvent(new Event('online'))");
 await soon(()=>second.evaluate(`${card(bankName)}?.innerText.includes('Access Granted')`),'online reconciles missed approval');checks.push('offline/reconnect restores confirmed access automatically');
 // Publication updates an already-open shared-exam list without touching attempts.
 await student.goto(`/student/banks/${bankId}/shared-exams`);
 const definitionId=randomUUID();checked(await adminDb.rpc('generate_shared_exam',{payload:{id:definitionId,bankId,title:'[TEST] Live shared publication',count:2,timeLimitMinutes:null}}));
 const definitions=checked(await adminDb.rpc('admin_shared_exams',{bank_id:bankId}));const definition=definitions.find(d=>d.id===definitionId);
 checked(await adminDb.rpc('save_shared_exam',{payload:{id:definitionId,title:definition.title,status:'PUBLISHED',timeLimitMinutes:null,questionIds:definition.questions.map(q=>q.questionId)}}));
 await soon(async()=>(await student.text()).includes(definition.title),'published definition appears');checks.push('shared publication refreshes active eligible catalog');
 await screenshot(student,'shared');
 // Real exam cross-session saving and conflict enforcement.
 const attempt=checked(await studentDb.rpc('start_learning_exam',{config:{bankId,source:'RANDOM',sourceId:null,mode:'EXAM',count:2,timeLimitMinutes:null}}));
 await student.goto('/student/exams/'+attempt);await second.goto('/student/exams/'+attempt);
 await soon(()=>student.evaluate("Boolean(document.querySelector('fieldset input'))"),'exam ready');
 const q=await student.evaluate("document.querySelector('fieldset input').name");
 await student.evaluate("document.querySelector('fieldset input[value=a]').click()");
 await soon(()=>second.evaluate("document.querySelector('fieldset input[value=a]')?.checked"),'other exam tab reflects saved answer');
 const stale=await studentDb.rpc('save_exam_answer_versioned',{attempt_id:attempt,question_id:q,option_id:'b',expected_version:0});assert.equal(stale.error?.code,'40001');
 await second.evaluate("document.querySelector('fieldset input[value=b]').click()");
 await soon(()=>student.evaluate("document.querySelector('fieldset input[value=b]')?.checked"),'newer answer reaches first tab');
 checks.push('exam tabs reconcile saved answers; stale version cannot overwrite newer answer');
 await screenshot(student,'exam');
 // Account changes use existing Admin status, not a new activation system.
 checked(await service.from('profiles').update({status:'INACTIVE'}).eq('id',user.id));
 for(const p of [student,second])await soon(()=>p.evaluate("location.pathname==='/account/inactive'"),'disabled account redirects');
 checked(await service.from('profiles').update({status:'ACTIVE'}).eq('id',user.id));
 for(const p of [student,second])await soon(()=>p.evaluate("location.pathname==='/student'"),'reactivation restores active session');
 checks.push('account deactivate/reactivate propagates across active sessions');
 // Actual channel authorization, including denial to another user/admin topic.
 for(const topic of [`lhcc:user:${m.users.admin.id}`,'lhcc:admin']){
  const channel=studentDb.channel(topic,{config:{private:true}});
  const status=await new Promise(resolve=>{const timer=setTimeout(()=>resolve('TIMEOUT'),10000);channel.subscribe(s=>{if(s==='SUBSCRIBED'||s==='CHANNEL_ERROR'){clearTimeout(timer);resolve(s);}});});
  assert.equal(status,'CHANNEL_ERROR','explicit denial of unauthorized channel '+topic);await studentDb.removeChannel(channel);
 }
 assert((await studentDb.rpc('review_bank_access',{request_id:randomUUID(),decision:'APPROVED'})).error);
 checks.push('other-user/admin private channels and self-approval denied');
 assert.deepEqual(browser.errors,[]);assert.deepEqual(browser.failedResponses,[]);
 await writeFile('.test-artifacts/live-sync-browser.json',JSON.stringify({passed:true,production:false,checks,latencies,physicalSamsung:false},null,2));
 console.log(JSON.stringify({passed:true,checks,latencies}));
}finally{await browser.close();await studentDb.removeAllChannels();await adminDb.removeAllChannels();}
