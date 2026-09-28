// Read-only release checks; does not create accounts or modify backend data.
import assert from 'node:assert/strict';
import { startBrowser } from './qa-browser.mjs';

const browser = await startBrowser(process.env.QA_BASE_URL ?? 'http://localhost:3100');
try {
  const page = await browser.page();
  for (const width of [390, 768, 1366]) {
    await page.resize(width);
    for (const path of ['/', '/signup', '/login']) {
      await page.goto(path);
      for (const dark of [false, true]) {
        await page.evaluate(`document.documentElement.classList.toggle('dark',${dark})`);
        await page.healthy(`${path} ${width}px ${dark ? 'dark' : 'light'}`);
      }
      if (path === '/') assert(!/Admin portal/i.test(await page.text()), 'Admin portal card removed');
    }
    console.log(`PASS public pages ${width}px light/dark`);
  }
  for (const path of ['/admin', '/teacher', '/teacher/questions', '/account/settings']) {
    await page.goto(path);
    assert.equal(await page.evaluate('location.pathname'), '/login', `Anonymous guarded: ${path}`);
  }
  assert.deepEqual(browser.failedResponses, []);
  assert.deepEqual(browser.errors, []);
  console.log('PASS anonymous guards; no browser errors or server failures');
} finally { await browser.close(); }
