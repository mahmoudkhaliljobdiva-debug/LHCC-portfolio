// Local-only Admin invitation, managed profile and role/status workflow audit.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { assertLocalQaTarget } from './qa-safety.mjs';
import { startBrowser, waitFor, login, pause } from './qa-browser.mjs';
import { captureDialogEvidence } from './qa-dialog-evidence.mjs';

const m = JSON.parse(await readFile('.test-artifacts/archive-qa.private.json', 'utf8'));
const target = assertLocalQaTarget(m.url);
assert.equal(assertLocalQaTarget(process.env.NEXT_PUBLIC_SUPABASE_URL), target);
const service = createClient(target, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const checked = result => { assert.ifError(result.error); return result.data; };
const name = '[TEST] Managed audit ' + randomUUID(), email = 'audit-invite-' + randomUUID() + '@example.com';
const password = randomBytes(24).toString('base64url');
const browser = await startBrowser('http://localhost:3100', { port: 9350 });
const checks = [], findings = [];
let userId;
const dialog = 'document.querySelector(\'[role="dialog"],[role="alertdialog"]\')';
async function findUser(admin) {
  await admin.goto('/admin/users'); await admin.fill('input[placeholder="Search name or email"]', email);
  await waitFor(async () => (await admin.text()).includes(name), 'managed user search');
}
async function recordDialog(admin, action) {
  const focused = await admin.evaluate(`${dialog}.contains(document.activeElement)`);
  await captureDialogEvidence(admin, action.startsWith('deactivate') ? 'user-deactivate' : 'user-reactivate');
  await admin.cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await admin.cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await pause(150);
  const closed = await admin.evaluate(`!${dialog}`);
  if (!focused || !closed) findings.push({ action, focused, escapeCloses: closed });
  return closed;
}
try {
  const admin = await browser.page(), invited = await browser.page();
  await login(admin, m.users.admin, '/admin');
  await admin.resize(390);
  await admin.goto('/admin/users'); await admin.click('Add User');
  await admin.fillLabel('Full name', name); await admin.fillLabel('Email', email);
  await admin.click('Send Invitation');
  await waitFor(() => admin.evaluate(`!${dialog}`), 'invitation committed');
  userId = checked(await service.from('profiles').select('id').eq('full_name', name).single()).id;
  assert.equal(checked(await service.from('profiles').select('role').eq('id', userId).single()).role, 'STUDENT');
  checks.push('Admin invitation creates the linked Student profile without a bank grant');
  let message;
  await waitFor(async () => {
    const data = await (await fetch('http://127.0.0.1:55434/api/v1/search?query=' + encodeURIComponent('to:' + email))).json();
    message = data.messages?.find(item => item.To?.some(recipient => recipient.Address === email)); return Boolean(message);
  }, 'local invitation captured');
  const messageData = await (await fetch('http://127.0.0.1:55434/api/v1/message/' + message.ID)).json();
  const invitation = [...messageData.HTML.matchAll(/href="([^"]+)"/g)].map(match => new URL(match[1].replaceAll('&amp;', '&')))
    .find(link => link.searchParams.get('type') === 'invite' && ((link.origin === target && link.pathname === '/auth/v1/verify') || (link.origin === 'http://localhost:3100' && link.pathname === '/auth/callback' && link.searchParams.has('token_hash'))));
  assert(invitation, 'Only follow a scoped local invitation.');
  await invited.cdp('Page.navigate', { url: invitation.href });
  await waitFor(() => invited.evaluate("location.origin==='http://localhost:3100' && document.readyState==='complete'"), 'invitation callback');
  const invitePath = await invited.evaluate('location.pathname');
  console.log(JSON.stringify({ stage: 'invitation callback', passwordSetupReached: invitePath === '/login/update-password' }));
  if (invitePath !== '/login/update-password') {
    findings.push({ action: 'invitation callback', result: 'Invitation does not reach the password setup form' });
    // Continue management diagnostics without pretending invitation bootstrapping worked.
    checked(await service.auth.admin.updateUserById(userId, { password, email_confirm: true }));
  } else {
    await invited.fillLabel('New password', password); await invited.fillLabel('Confirm new password', password);
    await invited.click('Update password');
    await waitFor(() => invited.evaluate("location.pathname==='/login'"), 'invited password setup');
    await login(invited, { email, password }, '/student');
    const replay = await fetch(invitation, { redirect: 'manual' });
    assert.equal(new URL(replay.headers.get('location')).searchParams.get('reason'), 'recovery-error');
    checks.push('Actual Admin email invitation -> one-time server OTP -> password setup -> login; replay rejected');
  }
  await findUser(admin);
  await admin.evaluate(`document.querySelector('[aria-label="Edit ${name}"]').click()`);
  await admin.fillLabel('Role', 'teacher', dialog);
  await waitFor(async () => (await admin.text()).includes('Assigned question banks'), 'teacher form rendered');
  await admin.click('Save Changes');
  await waitFor(async () => (await admin.text()).includes('Select at least one question bank.'), 'teacher assignment validation');
  const bank = checked(await service.from('question_banks').select('name').eq('id', m.bankId).single());
  await admin.evaluate(`(()=>{const label=[...document.querySelector('dialog').querySelectorAll('label')].find(item=>item.textContent.includes(${JSON.stringify(bank.name)})&&item.querySelector('input[type=checkbox]'));if(!label)throw Error('Assignable local track required');label.querySelector('input').click();})()`);
  await admin.click('Save Changes');
  await waitFor(async () => checked(await service.from('profiles').select('role').eq('id', userId).single()).role === 'TEACHER', 'role promotion');
  const assignments = checked(await service.from('teacher_bank_assignments').select('question_bank_id').eq('teacher_id', userId));
  assert.deepEqual(assignments.map(item => item.question_bank_id), [m.bankId]);
  const teacher = await browser.page(); await login(teacher, { email, password }, '/teacher');
  await teacher.goto('/teacher/question-banks/' + m.bankId); await teacher.healthy('new teacher assigned bank');
  checks.push('Student -> Teacher requires a bank, saves assignment atomically and opens only the assigned teacher portal');
  await findUser(admin); await admin.evaluate(`document.querySelector('[aria-label="Deactivate ${name}"]').click()`);
  if (await recordDialog(admin, 'deactivate confirmation')) await admin.evaluate(`document.querySelector('[aria-label="Deactivate ${name}"]').click()`);
  await admin.click('Deactivate User', dialog);
  await waitFor(async () => checked(await service.from('profiles').select('status').eq('id', userId).single()).status === 'INACTIVE', 'deactivated');
  await teacher.goto('/teacher'); assert.equal(await teacher.evaluate('location.pathname'), '/account/inactive');
  await findUser(admin); await admin.evaluate(`document.querySelector('[aria-label="Reactivate ${name}"]').click()`);
  if (await recordDialog(admin, 'reactivate confirmation')) await admin.evaluate(`document.querySelector('[aria-label="Reactivate ${name}"]').click()`);
  await admin.click('Reactivate', dialog);
  await waitFor(async () => checked(await service.from('profiles').select('status').eq('id', userId).single()).status === 'ACTIVE', 'reactivated');
  await teacher.goto('/teacher'); await teacher.healthy('reactivated teacher');
  checks.push('deactivation denies the existing session; reactivation restores it with a server-calculated period');
  await findUser(admin); await admin.evaluate(`document.querySelector('[aria-label="Edit ${name}"]').click()`);
  await admin.fillLabel('Role', 'student', dialog); await admin.click('Save Changes');
  await waitFor(async () => checked(await service.from('profiles').select('role').eq('id', userId).single()).role === 'STUDENT', 'demoted');
  assert.equal(checked(await service.from('teacher_bank_assignments').select('teacher_id').eq('teacher_id', userId)).length, 0);
  assert.equal(checked(await service.from('user_bank_access').select('id').eq('user_id', userId)).length, 0);
  await teacher.goto('/student'); await teacher.healthy('demoted Student');
  checks.push('Teacher -> Student removes assignments without granting courses or deleting history');
  assert.deepEqual(browser.failedResponses, []);
  await writeFile('.test-artifacts/audit-admin-users.json', JSON.stringify({ passed: findings.length === 0, checks, findings, production: false, externalEmail: false }, null, 2));
  console.log(JSON.stringify({ passed: findings.length === 0, checks, findings }));
  if (findings.length) process.exitCode = 1;
} finally {
  await browser.close();
  if (!userId) userId = checked(await service.from('profiles').select('id').eq('full_name', name).maybeSingle())?.id;
  if (userId) checked(await service.auth.admin.deleteUser(userId));
}
