// Focused responsive regression: local auth/session only, no business-data writes.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {startBrowser,login,waitFor} from './qa-browser.mjs';
const m=JSON.parse(await readFile('.test-artifacts/archive-qa.private.json','utf8'));
assert(['localhost','127.0.0.1'].includes(new URL(m.url).hostname));
const db=createClient(m.url,m.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
function checked(r){assert.ifError(r.error);return r.data;}
checked(await db.auth.signInWithPassword(m.users.student));
const banks=checked(await db.from('question_banks').select('id,name').like('name','[TEST] Chapter Material %').order('created_at',{ascending:false}).limit(1));
const bank=banks[0];assert(bank,'Run chapter-browser.mjs first');
const metadata=checked(await db.rpc('exam_bank_data',{bank_id:bank.id}));const chapter=metadata.chapters.find(c=>c.questionCount>0);assert(chapter);
const browser=await startBrowser('http://localhost:3100',{port:9353}),widths=[320,375,390,430,768,1024,1366,1440,1920];
try{const p=await browser.page();await login(p,m.users.student,'/student');
 for(const source of ['RANDOM','CHAPTER']){await p.goto(`/student/banks/${bank.id}/setup?source=${source}${source==='CHAPTER'?'&sourceId='+chapter.id:''}`);
  for(const dark of [false,true])for(const width of widths){await p.resize(width);await p.evaluate(`document.documentElement.classList.toggle('dark',${dark})`);
   for(const mode of ['PRACTICE','EXAM']){await p.fillLabel('Learning mode',mode);await waitFor(()=>p.evaluate(`document.querySelector('#learning-mode-help').textContent.startsWith('${mode==='EXAM'?'Exam:':'Practice:'}')`),'mode description');assert.equal(await p.evaluate("document.querySelector('select').selectedOptions[0].textContent"),mode==='EXAM'?'Exam':'Practice');await p.healthy(source+' '+width+' '+mode);}
   if([320,768,1366,1920].includes(width))await p.screenshot('chapter-setup-label-'+source+'-'+width+'-'+dark);
  }
 }
 assert.deepEqual(browser.errors,[]);assert.deepEqual(browser.failedResponses,[]);
 await writeFile('.test-artifacts/chapter-setup-results.json',JSON.stringify({passed:true,widths,themes:2,modes:2,screenTypes:2,businessMutations:false,physicalSamsung:false}));console.log('PASS short untruncated mode labels and reactive help; generated/chapter setup, nine widths, both themes/modes; no business-data changes.');
}finally{await browser.close();}
