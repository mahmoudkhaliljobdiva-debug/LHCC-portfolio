// Existing QA accounts only; restore personal fields through the same UI.
import assert from 'node:assert/strict';
import { loadManifest, getAdmin, checked } from './backend-qa-data.mjs';
import { startBrowser, login, waitFor } from './qa-browser.mjs';

const m = await loadManifest();
const db = getAdmin();
const browser = await startBrowser('http://localhost:3100');
async function profile(id) { return checked(db.from('profiles').select('*').eq('id', id).single(), 'QA profile'); }
try {
  for (const [key, role, route] of [['admin', 'admin', '/admin/settings'], ['teacher', 'teacher', '/teacher/profile'], ['approved', 'student', '/student/profile']]) {
    const account = m.users[key];
    const before = await profile(account.id);
    const page = await browser.page();
    await login(page, account, '/' + role);
    await page.goto('/account/settings');
    assert(await page.evaluate("Boolean(document.querySelector('input[name=fullName]'))"));
    for (const dark of [false, true]) for (const width of [390, 768, 1366]) {
      await page.resize(width);
      await page.evaluate(`document.documentElement.classList.toggle('dark',${dark})`);
      await page.healthy(role + ' profile ' + width);
      if (role === 'student' && width === 390 && dark) await page.screenshot('own-profile-mobile-dark');
    }
    await page.resize(1366, 768);
    try {
      await page.fill('input[name=fullName]', before.full_name + ' Profile');
      await page.click('Save Changes');
      await waitFor(() => page.evaluate("document.body.innerText.includes('Your profile has been updated.')"), 'profile saved');
      const saved = await profile(account.id);
      assert.equal(saved.full_name, before.full_name + ' Profile');
      for (const field of ['role', 'status', 'expiration_date', 'activation_months', 'activation_start']) assert.equal(saved[field], before[field]);
      await page.goto('/account/settings');
      assert.equal(await page.evaluate("document.querySelector('input[name=fullName]').value"), saved.full_name);
      await page.goto(route);
      assert.equal(await page.evaluate("document.querySelector('input[name=fullName]').value"), saved.full_name);
    } finally {
      await page.goto('/account/settings');
      const current = await page.evaluate("document.querySelector('input[name=fullName]').value");
      if (current !== before.full_name) {
        await page.fill('input[name=fullName]', before.full_name);
        await page.click('Save Changes');
        await waitFor(() => page.evaluate("document.body.innerText.includes('Your profile has been updated.')"), 'QA name restored');
      }
      const restored = await profile(account.id);
      for (const field of ['full_name', 'phone', 'country_code', 'age', 'gender', 'home_address', 'role', 'status']) assert.equal(restored[field], before[field]);
    }
    console.log('PASS ' + role + ': save, persistence, role route, protected fields, responsive light/dark; QA name restored');
  }
  assert.deepEqual(browser.failedResponses, []);
  assert.deepEqual(browser.errors, []);
} finally { await browser.close(); }
