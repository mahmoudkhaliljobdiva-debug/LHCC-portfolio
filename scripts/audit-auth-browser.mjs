// Full local signup/recovery/session story, using a loopback-only SMTP capture.
// No production credentials, users, external email or recovery links are logged.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { assertLocalQaTarget } from './qa-safety.mjs';
import { startBrowser, waitFor, login } from './qa-browser.mjs';

const manifest = JSON.parse(await readFile('.test-artifacts/archive-qa.private.json', 'utf8'));
const target = assertLocalQaTarget(manifest.url);
assert.equal(assertLocalQaTarget(process.env.NEXT_PUBLIC_SUPABASE_URL), target);
const service = createClient(target, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const client = createClient(target, manifest.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const checked = result => { assert.ifError(result.error); return result.data; };
const email = `audit-auth-${randomUUID()}@example.com`, name = '[TEST] Audit recovery ' + randomUUID();
const password = randomBytes(24).toString('base64url'), nextPassword = randomBytes(24).toString('base64url');
const mail = 'http://127.0.0.1:55434';
const browser = await startBrowser('http://localhost:3100', { port: 9349 });
const checks = [];
let userId;
try {
  const page = await browser.page();
  await page.resize(390);
  await page.goto('/signup');
  for (const [field, value] of [['Full name', name], ['Email address', email], ['Country', 'LB'], ['Phone number', '71056331'], ['Age', '30'], ['Gender', 'male'], ['Home Address', 'Local synthetic audit address'], ['Password', password], ['Confirm password', password]]) await page.fillLabel(field, value);
  await page.click('Create Account');
  await waitFor(() => page.evaluate("location.pathname==='/'"), 'signup session enters homepage');
  const profile = checked(await service.from('profiles').select('id,role,status,phone,country_code').eq('full_name', name).single());
  userId = profile.id;
  assert.equal(profile.role, 'STUDENT'); assert.equal(profile.status, 'ACTIVE');
  assert.equal(profile.phone, '+96171056331'); assert.equal(profile.country_code, 'LB');
  assert.equal(checked(await service.from('user_bank_access').select('id').eq('user_id', userId)).length, 0);
  await page.goto('/student'); await page.healthy('new Student session');
  await page.goto('/student'); await page.healthy('Student refresh');
  await page.goto('/admin'); assert(['/unauthorized', '/student'].includes(await page.evaluate('location.pathname')));
  await page.goto('/student');
  await page.evaluate('document.querySelector(\'button[aria-label="Sign out"]\').click()');
  await waitFor(() => page.evaluate("location.pathname==='/login'"), 'logout');
  await page.goto('/student'); assert.equal(await page.evaluate('location.pathname'), '/login');
  checks.push('signup -> retained session -> ACTIVE STUDENT/LB phone/no grants -> refresh -> Admin denial -> logout -> protected-route denial');

  await page.goto('/login/forgot-password');
  await page.fillLabel('Email address', email);
  await page.click('Send recovery link');
  await waitFor(async () => (await page.text()).includes('If an account exists'), 'recovery action success');
  let message;
  await waitFor(async () => {
    const response = await fetch(mail + '/api/v1/search?query=' + encodeURIComponent('to:' + email));
    assert.equal(response.status, 200);
    const data = await response.json();
    message = data.messages?.find(item => item.To?.some(recipient => recipient.Address === email));
    return Boolean(message);
  }, 'local recovery email captured');
  assert.match(message.ID, /^[a-zA-Z0-9-]+$/);
  const payload = await (await fetch(mail + '/api/v1/message/' + message.ID)).json();
  const links = [...payload.HTML.matchAll(/href="([^"]+)"/g)].map(match => new URL(match[1].replaceAll('&amp;', '&')));
  const recovery = links.find(link => link.origin === target && link.pathname === '/auth/v1/verify' && link.searchParams.get('type') === 'recovery');
  assert(recovery, 'Recovery must point only to the local Supabase verification endpoint.');
  await page.cdp('Page.navigate', { url: recovery.href });
  await waitFor(() => page.evaluate("location.pathname==='/login/update-password' && document.querySelectorAll('input[type=password]').length===2"), 'PKCE callback and recovery form');
  await waitFor(() => page.evaluate("Object.keys(document.querySelector('form')).some(key=>key.startsWith('__reactProps$'))"), 'recovery form hydrated');
  await page.fillLabel('New password', nextPassword); await page.fillLabel('Confirm new password', nextPassword);
  await page.click('Update password');
  try { await waitFor(() => page.evaluate("location.pathname==='/login' && location.search.includes('password-updated')"), 'password change signs out'); }
  catch (error) {
    console.error(JSON.stringify({ stage: 'password update', path: await page.evaluate('location.pathname'), feedback: await page.evaluate("[...document.querySelectorAll('[role=alert],[role=status]')].map(element=>element.textContent)"), errors: browser.errors, failedResponses: browser.failedResponses }));
    throw error;
  }
  assert((await client.auth.signInWithPassword({ email, password })).error, 'Old password no longer works.');
  await login(page, { email, password: nextPassword }, '/student');
  await page.evaluate('document.querySelector(\'button[aria-label="Sign out"]\').click()');
  await waitFor(() => page.evaluate("location.pathname==='/login'"), 'recovered account logout');
  checks.push('browser recovery request -> captured local email -> PKCE callback -> update password -> old password denied -> new login -> logout');
  await page.goto('/auth/callback?next=https://untrusted.invalid');
  assert.equal(await page.evaluate('location.pathname'), '/login');
  assert((await page.evaluate('location.search')).includes('recovery-error'));
  checks.push('invalid callback and external next parameter cannot redirect off-site');
  assert.deepEqual(browser.errors, []); assert.deepEqual(browser.failedResponses, []);
  await writeFile('.test-artifacts/audit-auth-browser.json', JSON.stringify({ passed: true, checks, production: false, externalEmail: false }, null, 2));
  console.log(JSON.stringify({ passed: true, checks }));
} finally {
  await browser.close();
  if (!userId) userId = checked(await service.from('profiles').select('id').eq('full_name', name).maybeSingle())?.id;
  if (userId) checked(await service.auth.admin.deleteUser(userId));
}
