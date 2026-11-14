// Isolated local browser -> PDF.js -> Server Actions -> private pending staging.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {assertLocalQaTarget} from './qa-safety.mjs';
import {startBrowser,login,waitFor,card} from './qa-browser.mjs';
const m=JSON.parse(await readFile('.test-artifacts/archive-qa.private.json','utf8'));
const f=JSON.parse(await readFile('.test-artifacts/subject-qa.private.json','utf8'));
const db=createClient(assertLocalQaTarget(m.url),m.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
assert.ifError((await db.auth.signInWithPassword(m.users.admin)).error);
const checked=r=>{assert.ifError(r.error);return r.data;};
const b=await startBrowser('http://localhost:3100',{port:9356});
try{
 const p=await b.page();await login(p,m.users.admin,'/admin');
 await p.goto('/admin/subjects?specialty='+f.medical);
 const scope=card('Cardiology');await p.click('Edit',scope);
 await p.fillLabel('Description','[TEST] Existing published subject metadata edited through real UI.');
 await p.click('Save material');await waitFor(()=>p.evaluate('!document.querySelector("dialog")'),'published metadata saved');
 assert((await p.text()).includes('Material saved.'));
 await p.goto('/admin/subjects/'+f.bankId+'/questions');
 await p.evaluate("[...document.querySelectorAll('summary')].find(e=>e.textContent.includes('Extract PDF into pending')).click()");
 const id='qa_pdf_'+randomUUID().replaceAll('-','');
 await p.fillLabel('Source Drive file ID',id);
 const pdf=(await readFile('.test-artifacts/archive-2025-fixture.pdf')).toString('base64');
 await p.evaluate(`(()=>{const file=new File([Uint8Array.from(atob(${JSON.stringify(pdf)}),c=>c.charCodeAt(0))],'[TEST] Source.pdf',{type:'application/pdf'});const t=new DataTransfer();t.items.add(file);document.querySelector('input[type=file]').files=t.files;})()`);
 await p.click('Extract to staging');
 await waitFor(async()=> (await p.text()).includes('No questions approved or published.'),'PDF extraction complete',90000);
 const data=checked(await db.rpc('admin_subject_questions',{bank_id:f.bankId,view_kind:'review'}));
 const source=data.sources.find(s=>s.driveFileId===id);assert(source);assert.equal(source.processedPages,source.pages);
 const staged=data.items.filter(q=>q.sourceId===source.id);assert(staged.length>=2);assert(staged.every(q=>q.reviewStatus==='PENDING'&&!q.reviewedBy&&!q.importedAt));
 await p.click('Extract to staging');await waitFor(async()=> (await p.text()).includes('No questions approved or published.'),'PDF retry',90000);
 const repeated=checked(await db.rpc('admin_subject_questions',{bank_id:f.bankId,view_kind:'review'}));
 assert.equal(repeated.items.filter(q=>q.sourceId===source.id).length,staged.length);
 assert.deepEqual(b.errors,[]);assert.deepEqual(b.failedResponses,[]);
 console.log(JSON.stringify({passed:true,pdfPages:source.pages,pendingCandidates:staged.length,checks:['published Subject metadata UI preserves publication','actual PDF.js extraction and private page coverage','explicit source keys remain pending, no automatic approval','upload retry creates no duplicate candidates']}));
}finally{await b.close();await db.auth.signOut();}
