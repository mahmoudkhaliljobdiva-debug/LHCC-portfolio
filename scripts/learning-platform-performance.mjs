// Same-machine, same-database comparison against a separately built prior commit.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {startBrowser,login} from './qa-browser.mjs';
const m=JSON.parse(await readFile('.test-artifacts/archive-qa.private.json','utf8'));
assert(['localhost','127.0.0.1'].includes(new URL(m.url).hostname));
const results=[];
for(const [version,port] of [['baseline-0cc6cdd',3101],['upgrade',3100]]){
 const browser=await startBrowser('http://localhost:'+port,{port:9344});
 try{const p=await browser.page();await login(p,m.users.student,'/student');await p.cdp('Network.setCacheDisabled',{cacheDisabled:true});
  for(const width of [390,1366]){await p.resize(width);
   for(const path of ['/services','/student','/student/banks/'+m.bankId]){
    await p.goto(path);const samples=[];for(let i=0;i<5;i++){await p.goto(path);await p.healthy(version+' '+path);samples.push(await p.evaluate("(()=>{const n=performance.getEntriesByType('navigation')[0],r=performance.getEntriesByType('resource');return {ttfb:n.responseStart,dom:n.domContentLoadedEventEnd,load:n.loadEventEnd,jsBytes:r.filter(x=>new URL(x.name).pathname.endsWith('.js')).reduce((a,x)=>a+x.encodedBodySize,0),requests:r.length};})()"));}
    const median=key=>samples.map(s=>s[key]).sort((a,b)=>a-b)[2];results.push({version,width,path,median:{ttfb:median('ttfb'),dom:median('dom'),load:median('load'),jsBytes:median('jsBytes'),requests:median('requests')},samples});
   }
  }assert.deepEqual(browser.errors,[]);assert.deepEqual(browser.failedResponses,[]);
 }finally{await browser.close();}
}
await writeFile('.test-artifacts/learning-performance.json',JSON.stringify({environment:'Local Node 22.23.2, production builds, Edge headless, cache disabled, five samples after warmup, same isolated backend; no device/network throttling',results},null,2));
console.log(JSON.stringify(results.map(r=>({version:r.version,width:r.width,path:r.path,median:r.median}))));
