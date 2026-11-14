// Actual local browser -> Server Action -> Supabase -> readback. Never accepts production.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { assertLocalQaTarget } from './qa-safety.mjs';
import { startBrowser, login, waitFor, pause } from './qa-browser.mjs';
import { captureDialogEvidence } from './qa-dialog-evidence.mjs';

assert(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === '--probe-dialogs'));
const probe = process.argv.includes('--probe-dialogs');
const manifest = JSON.parse(await readFile('.test-artifacts/archive-qa.private.json', 'utf8'));
const target = assertLocalQaTarget(manifest.url);
assert.equal(assertLocalQaTarget(process.env.NEXT_PUBLIC_SUPABASE_URL), target);
const service = createClient(target, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const manager = createClient(target, manifest.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const checked = result => { assert.ifError(result.error); return result.data; };
checked(await manager.auth.signInWithPassword(manifest.users.admin));
const browser = await startBrowser('http://localhost:3100', { port: 9348 });
const results = [], marker = '[TEST] Audit ' + randomUUID();
let originalPortfolio, ticketId;
const dialog = 'document.querySelector(\'[role="dialog"],[role="alertdialog"]\')';
async function escape(page) {
  await page.cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await page.cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await pause(150);
}
try {
  const admin = await browser.page(), visitor = await browser.page();
  await login(admin, manifest.users.admin, '/admin');
  await admin.resize(320, 568);
  for (const [route, button] of [['/admin/wallet', 'Add Ticket'], ['/admin/portfolio', 'Reset to defaults']]) {
    await admin.goto(route);
    await admin.click(button);
    await waitFor(() => admin.evaluate(`Boolean(${dialog})`), button + ' dialog');
    const focused = await admin.evaluate(`${dialog}.contains(document.activeElement)`);
    if (!probe) await captureDialogEvidence(admin, route.endsWith('wallet') ? 'wallet-editor' : 'cms-reset');
    await escape(admin);
    const closed = await admin.evaluate(`!${dialog}`);
    const result = { route, focusContainedOnOpen: focused, escapeCloses: closed };
    results.push(result);
    if (probe) { console.log(JSON.stringify(result)); continue; }
    assert(focused, 'Dialog receives focus: ' + route);
    assert(closed, 'Escape closes dialog: ' + route);
  }
  if (!probe) {
    await admin.goto('/admin/wallet');
    await admin.click('Add Ticket');
    await admin.fillLabel('Ticket name', marker);
    await admin.fillLabel('Amount (USD)', '12.34');
    await admin.click('Save Ticket');
    await waitFor(async () => (await admin.text()).includes('Ticket added successfully.'), 'ticket saved');
    const rows = checked(await service.from('wallet_transactions').select('id,amount,transaction_type').eq('name', marker));
    assert.equal(rows.length, 1); ticketId = rows[0].id;
    assert.equal(Number(rows[0].amount), 12.34);
    await admin.goto('/admin/wallet');
    await admin.evaluate(`document.querySelector('[aria-label="Edit ${marker}"]').click()`);
    await admin.fillLabel('Amount (USD)', '5.67');
    await admin.fillLabel('Type', 'manual_expense');
    await admin.click('Save Ticket');
    await waitFor(async () => Number(checked(await service.from('wallet_transactions').select('amount').eq('id', ticketId).single()).amount) === -5.67, 'edited signed amount');
    await admin.goto('/admin/wallet');
    await admin.evaluate(`document.querySelector('[aria-label="Delete ${marker}"]').click()`);
    assert(await admin.evaluate(`${dialog}.contains(document.activeElement)`));
    await captureDialogEvidence(admin, 'wallet-delete');
    await admin.click('Delete ticket', dialog);
    await waitFor(async () => checked(await service.from('wallet_transactions').select('id').eq('id', ticketId)).length === 0, 'manual ticket deleted');
    ticketId = null;
    results.push('manual ledger create/read/update/delete via browser and persisted signed amounts');

    originalPortfolio = Object.fromEntries(checked(await service.from('portfolio_content').select('section_key,content')).map(row => [row.section_key, row.content]));
    await visitor.goto('/about');
    await admin.goto('/admin/portfolio');
    await admin.fillLabel('Main description', originalPortfolio.about.description + ' ' + marker);
    assert((await admin.text()).includes('Unsaved changes'));
    await admin.click('Save Changes');
    await waitFor(async () => (await admin.text()).includes('Portfolio content updated successfully.'), 'CMS saved');
    assert(checked(await service.from('portfolio_content').select('content').eq('section_key', 'about').single()).content.description.includes(marker));
    // Already-open anonymous page: do not navigate or reload it to make this pass.
    await waitFor(async () => (await visitor.text()).includes(marker), 'open public page reconciles CMS revision', 80000);
    await admin.goto('/admin/portfolio');
    assert(await admin.evaluate(`document.querySelector('textarea').value.includes(${JSON.stringify(marker)})`));
    await admin.click('Reset to defaults');
    await admin.click('Reset content', dialog);
    try { await waitFor(async () => (await admin.text()).includes('Default portfolio content restored.'), 'CMS reset'); }
    catch (error) {
      console.error(JSON.stringify({ stage: 'CMS reset', feedback: await admin.evaluate("[...document.querySelectorAll('[role=alert],[role=status]')].map(element=>element.textContent)"), dialogOpen: await admin.evaluate(`Boolean(${dialog})`), persistedDefaults: checked(await service.from('portfolio_content').select('content,default_content')).every(row => JSON.stringify(row.content) === JSON.stringify(row.default_content)) }));
      throw error;
    }
    const defaults = checked(await service.from('portfolio_content').select('content,default_content'));
    for (const row of defaults) assert.deepEqual(row.content, row.default_content);
    results.push('CMS dirty/save/persistence, already-open public page updates, confirmed default reset');
    assert.deepEqual(browser.errors, []);
    assert.deepEqual(browser.failedResponses, []);
  }
  await writeFile(`.test-artifacts/audit-admin-${probe ? 'probe' : 'workflows'}.json`, JSON.stringify({ probe, results, production: false }, null, 2));
  console.log(JSON.stringify({ passed: !probe, results }));
} finally {
  await browser.close();
  if (ticketId) checked(await manager.rpc('manage_wallet_transaction', { operation: 'delete', item_id: ticketId, payload: {} }));
  if (originalPortfolio) checked(await manager.rpc('save_portfolio_content', { payload: originalPortfolio }));
  await manager.auth.signOut();
}
