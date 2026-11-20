// Local-only save round trips. Captures timings, never credentials or request bodies.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {assertLocalQaTarget} from './qa-safety.mjs';
import {startBrowser,login,waitFor,pause} from './qa-browser.mjs';
const label=process.argv[2]??'after';
assert(['before','after'].includes(label));
const fixture=JSON.parse(await readFile('.test-artifacts/archive-qa.private.json','utf8'));
assertLocalQaTarget(fixture.url);
const browser=await startBrowser('http://localhost:3100',{port:9361});
const samples=[];
try {
 const page=await browser.page();await login(page,fixture.users.admin,'/admin');await page.goto('/account/settings');
 await pause(1000);
 await page.evaluate(`window.qaRequests=[];window.qaFetch=window.fetch;window.fetch=async function(input,init){const url=new URL(typeof input==='string'?input:input.url??input,location.href),headers=new Headers(init?.headers??input.headers),method=init?.method??input.method??'GET',start=performance.now(),entry={method,action:headers.get('Next-Action'),rsc:headers.has('RSC'),ms:0};if(url.origin===location.origin&&url.pathname==='/account/settings')window.qaRequests.push(entry);try{return await window.qaFetch.apply(this,arguments);}finally{entry.ms=performance.now()-start;}}`);
 for(let index=0;index<3;index++){
  await page.evaluate('window.qaRequests=[]');
  await page.fill('input[name=fullName]','[TEST] Motion QA '+label+' '+Date.now()+' '+index);
  const started=Date.now();await page.click('Save Changes');
  await waitFor(async()=> (await page.text()).includes('Your profile has been updated.'),'profile saved');
  const feedbackMs=Date.now()-started;await pause(1000);
  const requests=await page.evaluate('window.qaRequests');
  const saveAction=requests.find(r=>r.action&&r.method==='POST')?.action;
  assert(saveAction);assert.equal(requests.filter(r=>r.action===saveAction).length,1,'No duplicate save submission');
  if(label==='after')assert(requests.filter(r=>r.rsc&&r.method==='GET').length<=1,'Only legitimate live reconciliation may fetch the page again');
  samples.push({feedbackMs,requests});
 }
 assert.deepEqual(browser.errors,[]);assert.deepEqual(browser.failedResponses,[]);
 await writeFile('.test-artifacts/interaction-timings-'+label+'.json',JSON.stringify({local:true,throttled:false,samples},null,2));
 console.log(JSON.stringify({label,samples}));
}finally{await browser.close();}
