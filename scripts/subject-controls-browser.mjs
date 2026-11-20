// Isolated Admin metadata save and removal of unused Subject controls.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertLocalQaTarget} from './qa-safety.mjs';
import {startBrowser,login,waitFor,pause} from './qa-browser.mjs';
const m=JSON.parse(await readFile('.test-artifacts/archive-qa.private.json','utf8'));
const f=JSON.parse(await readFile('.test-artifacts/subject-qa.private.json','utf8'));
assertLocalQaTarget(m.url);
const b=await startBrowser('http://localhost:3100',{port:9357});
try{
 const p=await b.page();await login(p,m.users.admin,'/admin');await p.goto('/admin/subjects?specialty='+f.medical);
 const link=`a[href="/admin/subjects/${f.bankId}/questions"]`;
 for(let page=0;page<20;page++){if(await p.evaluate(`Boolean(document.querySelector(${JSON.stringify(link)}))`))break;await p.click('Next page');await pause(700);}
 await p.click('Edit',`document.querySelector(${JSON.stringify(link)}).closest('article')`);await p.fillLabel('Description','[TEST] Direct Subject management.');await p.click('Save material');
 await waitFor(()=>p.evaluate('!document.querySelector("dialog")'),'metadata saved');assert((await p.text()).includes('Material saved.'));
 await p.goto('/admin/subjects/'+f.banks[1].id+'/questions?view=review');
 assert(!(await p.text()).includes('Import review'));assert(!(await p.text()).includes('Chapters & lessons'));
 assert(!await p.evaluate("Boolean(document.querySelector('input[type=file]'))"));
 await p.click('Add question');assert((await p.text()).includes('I explicitly approve'));assert(!await p.evaluate('document.querySelector("dialog input[type=checkbox]:checked")!==null'));
 assert.deepEqual(b.errors,[]);assert.deepEqual(b.failedResponses,[]);
 console.log('PASS direct Subject controls; no PDF upload/import queue or empty chapter links; explicit approval defaults unchecked; published metadata save preserved.');
}finally{await b.close();}
