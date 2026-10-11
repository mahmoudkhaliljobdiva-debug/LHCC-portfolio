// Production-mode local lab; never writes production data. Keep credentials ignored.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { startBrowser, login } from './qa-browser.mjs';
const label = process.argv[2] ?? 'before';
const m = JSON.parse(await readFile('.test-artifacts/archive-qa.private.json', 'utf8'));
assert(['localhost', '127.0.0.1'].includes(new URL(m.url).hostname));
const db = createClient(m.url, m.anonKey, { auth: { persistSession: false } });
await db.auth.signInWithPassword(m.users.student);
const { data: bank, error } = await db.rpc('exam_bank_data', { bank_id: m.bankId });
assert.ifError(error);
const active = bank.attempts.find(a => a.status === 'IN_PROGRESS');
const completed = bank.attempts.find(a => a.status === 'COMPLETED');
const browser = await startBrowser('http://localhost:3100');
const rows = [];
try {
 const publicPage = await browser.page(), student = await browser.page(), admin = await browser.page();
 await login(student, m.users.student, '/student'); await login(admin, m.users.admin, '/admin');
 const pages = [[publicPage,'/'],[publicPage,'/login'],[student,'/student'],[student,'/student/question-banks'],[student,`/student/banks/${m.bankId}`],[student,`/student/banks/${m.bankId}/setup`],...(active?[[student,`/student/exams/${active.id}`]]:[]),...(completed?[[student,`/student/exams/${completed.id}/result`]]:[]),[admin,'/admin'],[admin,'/admin/users']];
 for (const [page, route] of pages) {
  await page.resize(412, 915);
  await page.cdp('Page.addScriptToEvaluateOnNewDocument', { source: `window.audit={lcp:0,cls:0};new PerformanceObserver(l=>l.getEntries().forEach(e=>window.audit.lcp=e.startTime)).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>l.getEntries().forEach(e=>{if(!e.hadRecentInput)window.audit.cls+=e.value})).observe({type:'layout-shift',buffered:true});` });
  // Reproducible mobile lab, not a claim of actual Android/browser performance.
  await page.cdp('Network.emulateNetworkConditions', { offline:false, latency:150, downloadThroughput:200000, uploadThroughput:93750 });
  await page.cdp('Emulation.setCPUThrottlingRate', { rate:4 });
  for(let sample=0;sample<3;sample++) {
   const start=Date.now();await page.goto(route);await page.healthy(route);
   const result=await page.evaluate(`(()=>{const n=performance.getEntriesByType('navigation')[0],r=performance.getEntriesByType('resource');return {ttfbMs:n.responseStart,loadMs:n.loadEventEnd,lcpMs:window.audit.lcp,cls:window.audit.cls,requests:r.length+1,transferBytes:n.transferSize+r.reduce((s,e)=>s+e.transferSize,0),jsTransferBytes:r.filter(e=>e.name.includes('.js')).reduce((s,e)=>s+e.transferSize,0)}})()`);
   const queryLog=(await readFile('.test-artifacts/fetch-metrics.jsonl','utf8')).trim().split('\n').map(JSON.parse).filter(e=>e.time>=start);
   rows.push({route,sample,...result,serverRequests:queryLog.length,statusQueries:queryLog.filter(e=>e.path.endsWith('/is_profile_access_active')).length,bankDataQueries:queryLog.filter(e=>e.path.endsWith('/admin_bank_data')).length,queryMs:queryLog.reduce((s,e)=>s+e.ms,0)});
  }
 }
 assert.deepEqual(browser.errors,[]);assert.deepEqual(browser.failedResponses,[]);
 await writeFile(`.test-artifacts/mobile-performance-${label}.json`, JSON.stringify(rows,null,2));
 console.log(JSON.stringify(rows));
} finally { await browser.close(); }
