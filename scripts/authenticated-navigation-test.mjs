import assert from 'node:assert/strict';
import { loadManifest } from './backend-qa-data.mjs';
import { startBrowser, login, waitFor } from './qa-browser.mjs';

const base = process.env.LHCC_TEST_URL ?? 'http://localhost:3100';
const m = await loadManifest();
const browser = await startBrowser(base);
const navigate = async (page, label, destination) => {
 await page.click(label);
 await waitFor(()=>page.evaluate(`location.pathname === ${JSON.stringify(destination)}`),label);
};
try {
 for (const [key,portal] of [['admin','/admin'],['teacher','/teacher'],['approved','/student']]) {
  const page=await browser.page(); await login(page,m.users[key],portal);
  await navigate(page,'Back to website','/');
  for(const dark of [false,true]) for(const width of [390,430,768,1366,1920]) {
   await page.resize(width);await page.evaluate(`document.documentElement.classList.toggle('dark',${dark})`);
   if(width<1024) await page.evaluate("if(document.querySelector('button[aria-label=\"Open menu\"]'))document.querySelector('button[aria-label=\"Open menu\"]').click()");
   await page.healthy(key+' public '+width);
   assert(await page.evaluate(`[...document.querySelectorAll('header a')].filter(a=>a.textContent.trim()==='Dashboard').every(a=>a.getAttribute('href')===${JSON.stringify(portal)})`));
   assert(await page.evaluate("!document.querySelector('header a[href=\"/login\"]')"));
   assert(await page.evaluate("document.querySelector('header a[href=\"/account/settings\"]').getBoundingClientRect().width>=44"));
  }
  await page.resize(1366,768);await navigate(page,'Dashboard',portal);
  await page.goto(portal);await page.healthy('portal refresh');
  await navigate(page,'Back to website','/');await page.goto('/');
  await page.evaluate("document.querySelector('a[href=\"/account/settings\"]').click()");
  await waitFor(()=>page.evaluate("location.pathname==='/account/settings'"),'account');
  assert((await page.text()).includes(m.users[key].name));
  await page.goto('/');await navigate(page,'Dashboard',portal);
  for(const wrong of ['/admin','/teacher','/student'].filter(p=>p!==portal)) {
   await page.goto(wrong);assert(await page.evaluate("location.pathname==='/unauthorized'"));
   await page.goto('/unauthorized');await navigate(page,'Back to Dashboard',portal);
   await page.healthy('recovered '+key);
  }
  await page.evaluate("document.querySelector('button[aria-label=\"Sign out\"]').click()");
  await waitFor(()=>page.evaluate("location.pathname==='/login'"),'logout');
  await page.goto('/');assert(await page.evaluate("Boolean(document.querySelector('header a[href=\"/login\"]'))"));
  await page.goto('/unauthorized');assert((await page.text()).includes('Sign In'));
  console.log('PASS '+key+': login, role dashboard, account, refresh, cross-role denial/recovery, responsive light/dark, logout');
 }
 assert.deepEqual(browser.errors,[]);assert.deepEqual(browser.failedResponses,[]);
 console.log('PASS console and network: '+base);
} finally {await browser.close();}
