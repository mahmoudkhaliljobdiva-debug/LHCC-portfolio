import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { assertLocalQaTarget } from './qa-safety.mjs';
import { startBrowser,login,waitFor,card,pause } from './qa-browser.mjs';
const m=JSON.parse(await readFile('.test-artifacts/archive-qa.private.json','utf8')),f=JSON.parse(await readFile('.test-artifacts/subject-qa.private.json','utf8'));
const target=assertLocalQaTarget(m.url),adminDb=createClient(target,m.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
assert.ifError((await adminDb.auth.signInWithPassword(m.users.admin)).error);
const checked=r=>{assert.ifError(r.error);return r.data;};
const b=await startBrowser('http://localhost:3100',{port:9355}),widths=[320,360,375,390,412,430,768,1024,1366,1440,1920],screens=[];
const text='[TEST] UI Subject '+randomUUID(),scope=card(text),dialog='document.querySelector("dialog")';
async function responsive(p,name){for(const dark of [false,true])for(const width of widths){await p.resize(width);await p.evaluate(`document.documentElement.classList.toggle('dark',${dark})`);await pause(80);await p.healthy(name);if([320,768,1366,1920].includes(width))await p.screenshot('subject-'+name+'-'+width+'-'+(dark?'dark':'light'));}for(const [w,h]of[[844,390],[1024,768]]){await p.resize(w,h);await p.healthy(name+' landscape');}screens.push(name);}
try{
 const p=await b.page();await login(p,m.users.admin,'/admin');await p.goto('/admin/subjects?specialty='+f.medical);
 for(let page=0;page<20;page++) {if(await p.evaluate(`Boolean(document.querySelector('a[href="/admin/subjects/${f.bankId}/questions"]'))`))break;await p.click('Next page');await pause(700);}
 await responsive(p,'folders');assert((await p.text()).includes('Medicine'));assert((await p.text()).includes('Nursing'));assert((await p.text()).includes('Dentistry'));
 await p.evaluate(`document.querySelector('a[href="/admin/subjects/${f.bankId}/questions"]').click()`);await waitFor(()=>p.evaluate("document.querySelector('h1')?.textContent==='Cardiology questions'"),'Cardiology hierarchy');assert(!/Import review|Import approved|Extract PDF into pending/.test(await p.text()));await responsive(p,'questions');
 await p.click('Chapters & lessons');await waitFor(()=>p.evaluate("document.querySelector('h1')?.textContent.includes('Cardiology: Chapters')"),'chapters');await responsive(p,'chapters');
 // Existing subjects never depend on a nonempty chapter list.
 await p.goto('/admin/subjects/'+f.bankId+'/questions');await p.click('Add question');
 await p.fillLabel('Question text',text);await p.fillLabel('Answer 1','First synthetic choice');await p.fillLabel('Answer 2','Second synthetic choice');
 await p.evaluate(`${dialog}.querySelector('input[type=radio]').click()`);
 await p.fillLabel('Answer verification','MEDICALLY_REVIEWED');await p.fillLabel('Answer evidence','[TEST] Controlled non-medical example.');await p.fillLabel('Why this answer is correct','[TEST] Synthetic fixture explanation, not clinical guidance.');
 await p.evaluate(`${dialog}.querySelectorAll('input[type=checkbox]').forEach(input=>input.click())`);
 await responsive(p,'question-editor');await p.click('Save reviewed question');await waitFor(()=>p.evaluate('!document.querySelector("dialog")'),'reviewed question saved');
 let qid;await waitFor(async()=>{qid=checked(await adminDb.rpc('admin_subject_questions',{bank_id:f.bankId})).items.find(row=>row.text===text)?.id;return Boolean(qid);},'question saved directly');
 assert(!/Import review|Import approved|Extract PDF into pending/.test(await p.text()));
 await responsive(p,'approved-question');
 await p.click('Edit question',scope);await waitFor(()=>p.evaluate('Boolean(document.querySelector("dialog"))'),'direct edit dialog');
 await p.fillLabel('Question text',text+' edited');await p.evaluate(`${dialog}.querySelectorAll('input[type=checkbox]').forEach(input=>input.click())`);
 await p.click('Save reviewed question');await waitFor(()=>p.evaluate('!document.querySelector("dialog")'),'reviewed edit saved');
 await waitFor(async()=>checked(await adminDb.rpc('admin_subject_questions',{bank_id:f.bankId})).items.some(row=>row.id===qid&&row.text===text+' edited'),'existing ID preserved by direct save');
 await p.goto('/admin/subjects/'+f.bankId+'/questions');await p.evaluate(`document.querySelector('[aria-label="Delete question ${qid}"]').click()`);await responsive(p,'delete-confirmation');await p.click('Delete question',dialog);
 await waitFor(async()=>!checked(await adminDb.rpc('admin_subject_questions',{bank_id:f.bankId})).items.some(row=>row.id===qid),'delete persisted');
 for(const name of ['Neurology','Endocrinology']){const bank=f.banks.find(item=>item.name===name);await p.goto('/admin/subjects/'+bank.id+'/questions');assert((await p.text()).includes(name+' questions'));assert(!(await p.text()).includes('Chapters & lessons'));assert(!await p.evaluate("Boolean(document.querySelector('input[type=file]'))"));await responsive(p,'empty-'+name.toLowerCase());}
 const student=await b.page();await login(student,m.users.student,'/student');await student.goto('/admin/subjects/'+f.bankId+'/questions');assert(['/unauthorized','/student'].includes(await student.evaluate('location.pathname')));
 assert.deepEqual(b.errors,[]);assert.deepEqual(b.failedResponses,[]);
 await writeFile('.test-artifacts/subject-review-browser.json',JSON.stringify({passed:true,production:false,screens,widths,themes:2,landscapes:2,checks:screens.length*(widths.length*2+2),physicalSamsung:false},null,2));
 console.log(JSON.stringify({passed:true,screens,checks:screens.length*(widths.length*2+2),workflows:'folders -> direct questions -> genuine chapter view -> explicit reviewed save -> direct edit retaining ID -> confirmed delete; no PDF/import controls; no empty chapter buttons; Student denial'}));
}finally{await b.close();await adminDb.auth.signOut();}
