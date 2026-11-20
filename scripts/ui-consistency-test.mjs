import assert from 'node:assert/strict';
import { loadManifest } from './backend-qa-data.mjs';
import { startBrowser, login, waitFor } from './qa-browser.mjs';
const m = await loadManifest();
const browser = await startBrowser('http://localhost:3100');
try {
 for (const role of ['admin','teacher','approved']) {
  const page = await browser.page();
  const portal = role==='approved'?'/student':'/'+role;
  await login(page,m.users[role],portal);
  assert(!/temporarily unavailable/.test(await page.text()));
  await page.click('Back to website');
  await new Promise(r=>setTimeout(r,1000));
  assert(await page.evaluate("Boolean(document.querySelector('a[href=\"/account/settings\"]'))"));
  for (const width of [390,430,768,1024,1366,1536,1920]) {
   await page.resize(width); await page.healthy('header '+width);
   assert(await page.evaluate("document.querySelector('a[href=\"/account/settings\"]').getBoundingClientRect().width >= 44"));
  }
  await page.goto('/account/settings');
  assert((await page.text()).includes(m.users[role].name));
  await page.click('Return to portal');
  await waitFor(()=>page.evaluate('location.pathname === '+JSON.stringify(portal)), 'return to '+portal);
  console.log('PASS session and account navigation: '+role);
 }
 const page=await browser.page(); await login(page,m.users.admin,'/admin');
 for(const route of ['/admin/users','/admin/wallet','/admin/portfolio','/admin/question-banks','/admin/access-requests','/signup']) {
  await page.goto(route);
  for(const dark of [false,true]) {
   await page.evaluate(`document.documentElement.classList.toggle('dark',${dark})`);
   for(const width of [390,430,768,1024,1366,1536,1920]) {await page.resize(width);await page.healthy(route+' '+width+' dark='+dark);}
   assert(await page.evaluate("[...document.querySelectorAll('select')].every(el=>getComputedStyle(el).appearance==='none')"));
  }
  console.log('PASS responsive light/dark: '+route);
 }
 await page.goto('/admin/users'); await page.resize(1366,768);
 assert(await page.evaluate("[...document.querySelectorAll('td,td p,td span')].every(el=>getComputedStyle(el).overflowWrap==='normal')"));
 assert(await page.evaluate("document.querySelector('.table-scroll-region table').scrollWidth>document.querySelector('.table-scroll-region').clientWidth"));
 console.log('PASS intact table words and horizontal scrolling');
 const invalid=await browser.page();await invalid.goto('/login');
 await invalid.fill('input[type=email]',m.users.approved.email);await invalid.fill('input[type=password]','Invalid-QA-password');await invalid.click('Sign in');
 await waitFor(async()=> (await invalid.text()).includes('Incorrect email or password.'),'genuine login failure');
 console.log('PASS incorrect password feedback');
 assert.deepEqual(browser.errors,[]);assert.deepEqual(browser.failedResponses,[]);
 console.log('PASS console and network');
} finally { await browser.close(); }
