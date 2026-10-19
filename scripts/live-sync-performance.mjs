// Checks connection reuse and burst coalescing without changing business records.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {assertLocalQaTarget} from './qa-safety.mjs';
import {startBrowser,login,waitFor,pause} from './qa-browser.mjs';
const m=JSON.parse(await readFile('.test-artifacts/archive-qa.private.json','utf8'));assertLocalQaTarget(m.url);
const browser=await startBrowser('http://localhost:3100',{port:9351});
try{
 const p=await browser.page();
 await p.cdp('Page.addScriptToEvaluateOnNewDocument',{source:'window.__qaWsCount=0; const QAWebSocket=window.WebSocket; window.WebSocket=class extends QAWebSocket { constructor(...args){super(...args);window.__qaWsCount++;} };'});
 await p.goto('/');await pause(1200);assert.equal(await p.evaluate('window.__qaWsCount'),0);
 await login(p,m.users.student,'/student');await waitFor(async()=>(await p.text()).includes('Live updates connected'),'live connection');await pause(1000);
 assert.equal(await p.evaluate('window.__qaWsCount'),1);
 await p.evaluate("document.documentElement.dataset.qaDocument='persistent'");
 await p.click('Question Banks');await waitFor(()=>p.evaluate("location.pathname==='/student/question-banks'"),'SPA bank navigation');
 await p.click('Dashboard');await waitFor(()=>p.evaluate("location.pathname==='/student'"),'SPA dashboard navigation');await pause(1000);
 assert.equal(await p.evaluate('window.__qaWsCount'),1);assert.equal(await p.evaluate('document.documentElement.dataset.qaDocument'),'persistent');
 await p.evaluate("performance.clearResourceTimings(); for(let i=0;i<5;i++)window.dispatchEvent(new Event('focus'))");await pause(1600);
 const fetches=await p.evaluate("performance.getEntriesByType('resource').filter(r=>r.initiatorType==='fetch').length");assert(fetches<=3,'focus burst must not trigger five full refreshes');
 assert.deepEqual(browser.errors,[]);assert.deepEqual(browser.failedResponses,[]);
 const result={passed:true,anonymousWebSockets:0,authenticatedWebSockets:1,afterNavigationWebSockets:1,focusBurstFetches:fetches,production:false};
 await writeFile('.test-artifacts/live-sync-performance.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
