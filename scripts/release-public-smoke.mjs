// Read-only release checks; does not create accounts or modify backend data.
import assert from 'node:assert/strict';
import { startBrowser } from './qa-browser.mjs';

const browser = await startBrowser(process.env.QA_BASE_URL ?? 'http://localhost:3100');
const widths = process.env.LHCC_AUDIT_FULL_VIEWPORTS === '1'
  ? [320, 360, 375, 390, 412, 430, 768, 1024, 1366, 1440, 1920]
  : [390, 768, 1366];
try {
  const page = await browser.page();
  for (const width of widths) {
    await page.resize(width);
    for (const path of ['/', '/about', '/services', '/platform', '/contact', '/programs/medical', '/programs/nursing', '/programs/dentistry', '/signup', '/login']) {
      await page.goto(path);
      for (const dark of [false, true]) {
        await page.evaluate(`document.documentElement.classList.toggle('dark',${dark})`);
        await page.healthy(`${path} ${width}px ${dark ? 'dark' : 'light'}`);
        if (process.env.LHCC_AUDIT_FULL_VIEWPORTS === '1' && [320, 768, 1366, 1920].includes(width) && ['/', '/programs/medical', '/signup'].includes(path)) {
          await page.screenshot(`audit-public-${path.replaceAll('/', '-') || 'home'}-${width}-${dark ? 'dark' : 'light'}`);
        }
      }
      if (path === '/') assert(!/Admin portal/i.test(await page.text()), 'Admin portal card removed');
    }
    console.log(`PASS public pages ${width}px light/dark`);
  }
  for (const path of ['/admin', '/admin/subjects', '/admin/exam-tracks', '/admin/subjects/release-readonly-check/lessons', '/admin/question-banks', '/admin/users', '/admin/wallet', '/admin/portfolio', '/teacher', '/teacher/questions', '/student', '/student/question-banks', '/student/exams', '/student/analytics', '/account/settings']) {
    await page.goto(path);
    assert.equal(await page.evaluate('location.pathname'), '/login', `Anonymous guarded: ${path}`);
  }
  assert.deepEqual(browser.failedResponses, []);
  assert.deepEqual(browser.errors, []);
  console.log('PASS anonymous guards; no browser errors or server failures');
} finally { await browser.close(); }
