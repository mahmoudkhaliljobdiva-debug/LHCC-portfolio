// Regression checks against isolated Supabase; never uses production fixtures.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { assertLocalQaTarget } from './qa-safety.mjs';
import { startBrowser, login, waitFor, card, pause } from './qa-browser.mjs';

const manifest = JSON.parse(await readFile('.test-artifacts/archive-qa.private.json', 'utf8'));
const url = assertLocalQaTarget(manifest.url);
const settings = Object.fromEntries((await readFile('.test-artifacts/archive-qa.env', 'utf8')).trim().split('\n')
  .map(line => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).trim()]; }));
assert.equal(assertLocalQaTarget(settings.NEXT_PUBLIC_SUPABASE_URL), url);
const service = createClient(url, settings.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
function checked(result) { assert.ifError(result.error); return result.data; }
const bank = checked(await service.from('question_banks').select('name').eq('id', manifest.bankId).single());
const suffix = randomBytes(5).toString('hex');
const account = { email: `cleanup-local-${suffix}@example.com`, password: randomBytes(24).toString('base64url') };
const name = `[TEST] Cleanup Student ${suffix}`, checks = [];
const browser = await startBrowser('http://localhost:3100', { port: 9347 });
try {
  const student = await browser.page(); await student.resize(390); await student.goto('/signup');
  for (const [field, value] of [['Full name', name], ['Email address', account.email], ['Country', 'LB'],
    ['Phone number', '71056331'], ['Age', '30'], ['Gender', 'male'], ['Home Address', 'Isolated QA address'],
    ['Password', account.password], ['Confirm password', account.password]]) await student.fillLabel(field, value);
  await student.click('Create Account'); await waitFor(() => student.evaluate("location.pathname==='/'"), 'signup enters homepage');
  const profile = checked(await service.from('profiles').select('id,role,status,phone,country_code').eq('full_name', name).single());
  assert.equal(profile.role, 'STUDENT'); assert.equal(profile.status, 'ACTIVE'); assert.equal(profile.phone, '+96171056331'); assert.equal(profile.country_code, 'LB');
  await student.goto('/student'); await student.healthy('new student dashboard');
  assert.equal(checked(await service.from('user_bank_access').select('id').eq('user_id', profile.id)).length, 0);
  checks.push('signup retains session, ACTIVE STUDENT, normalized LB phone, no implicit course grants');

  await student.goto('/student/question-banks'); await student.click('Request Access', card(bank.name));
  await waitFor(async () => (await student.text()).includes('Pending Approval'), 'pending request');
  const admin = await browser.page(); await login(admin, manifest.users.admin, '/admin');
  await admin.goto('/admin/access-requests'); await admin.click('Approve', card(name));
  await waitFor(async () => checked(await service.from('user_bank_access').select('id').eq('user_id', profile.id).eq('question_bank_id', manifest.bankId)).length === 1, 'approved grant');
  await student.goto(`/student/banks/${manifest.bankId}`); await student.healthy('approved material');
  assert(!(await student.text()).includes('Locked'));
  checks.push('student request → Admin approval → approved material');

  const locked = await browser.page(); await login(locked, manifest.users.locked, '/student');
  await locked.goto('/student/question-banks'); await locked.click('Request Access', card(bank.name));
  await waitFor(async () => checked(await service.from('user_bank_access_requests').select('status').eq('user_id', manifest.users.locked.id).eq('question_bank_id', manifest.bankId)).some(r => r.status === 'PENDING'), 'locked request');
  await admin.goto('/admin/access-requests'); await admin.click('Reject', card(manifest.users.locked.name));
  await waitFor(async () => checked(await service.from('user_bank_access_requests').select('status').eq('user_id', manifest.users.locked.id).eq('question_bank_id', manifest.bankId)).some(r => r.status === 'REJECTED'), 'rejected request');
  await locked.goto('/student/question-banks'); assert((await locked.text()).includes('Access Request Rejected'));
  checks.push('rejection persists and does not grant access');

  const teacher = await browser.page(); await login(teacher, manifest.users.teacher, '/teacher');
  await teacher.goto(`/teacher/question-banks/${manifest.bankId}`); await teacher.resize(320);
  await teacher.fillLabel('Question', `[TEST] Teacher cleanup regression ${suffix}`);
  await teacher.fillLabel('Answer 1', 'First isolated option'); await teacher.fillLabel('Answer 2', 'Second isolated option');
  await teacher.evaluate("document.querySelector('input[aria-label=\"Answer 1 is correct\"]').click()");
  await teacher.click('Add Question'); await waitFor(async () => (await teacher.text()).includes('Question added successfully.'), 'teacher question saved');
  assert.equal(checked(await service.from('bank_questions').select('id').eq('question_bank_id', manifest.bankId).eq('text', `[TEST] Teacher cleanup regression ${suffix}`)).length, 1);
  assert(!await teacher.evaluate("[...document.querySelectorAll('button')].some(b=>/delete question|edit question/i.test(b.textContent+' '+b.getAttribute('aria-label')))"));
  checks.push('assigned teacher can add/view questions, not edit/delete existing questions');

  for (const [page, user] of [[student, { id: profile.id }], [teacher, manifest.users.teacher], [admin, manifest.users.admin]]) {
    const before = checked(await service.from('profiles').select('full_name,role,status,expiration_date').eq('id', user.id).single());
    await page.goto('/account/settings'); await page.fill('input[name=fullName]', before.full_name + ' Edited');
    await page.click('Save Changes'); await waitFor(async () => (await page.text()).includes('Your profile has been updated.'), 'profile saved');
    const saved = checked(await service.from('profiles').select('full_name,role,status,expiration_date').eq('id', user.id).single());
    assert.equal(saved.full_name, before.full_name + ' Edited');
    for (const field of ['role', 'status', 'expiration_date']) assert.equal(saved[field], before[field]);
    await page.fill('input[name=fullName]', before.full_name); await page.click('Save Changes');
    await waitFor(async () => checked(await service.from('profiles').select('full_name').eq('id', user.id).single()).full_name === before.full_name, 'profile restored');
    for (const dark of [false, true]) for (const width of [320, 375, 390, 430, 768, 1024, 1366, 1440, 1920]) {
      await page.resize(width); await page.evaluate(`document.documentElement.classList.toggle('dark',${dark})`); await pause(250); await page.healthy('profile ' + width);
    }
  }
  checks.push('all three roles edit only personal fields; nine widths and both themes');
  assert.deepEqual(browser.errors, []); assert.deepEqual(browser.failedResponses, []);
  await writeFile('.test-artifacts/production-cleanup-browser.json', JSON.stringify({ passed: true, checks, production: false }, null, 2));
  console.log(JSON.stringify({ passed: true, checks }));
} finally { await browser.close(); }
