// Local browser -> Server Action -> guarded RPC -> persisted read verification.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { assertLocalQaTarget } from './qa-safety.mjs';
import { startBrowser, login, waitFor, pause, card } from './qa-browser.mjs';

const target = assertLocalQaTarget(process.env.NEXT_PUBLIC_SUPABASE_URL);
const manifest = JSON.parse(await readFile('.test-artifacts/archive-qa.private.json', 'utf8'));
assert.equal(target, assertLocalQaTarget(manifest.url));
const service = createClient(target, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const adminDb = createClient(target, manifest.anonKey, { auth: { persistSession: false } });
const studentDb = createClient(target, manifest.anonKey, { auth: { persistSession: false } });
const checked = response => { if (response.error) throw Error(response.error.message); return response.data; };
checked(await adminDb.auth.signInWithPassword(manifest.users.admin));
checked(await studentDb.auth.signInWithPassword(manifest.users.student));
const specialty = checked(await service.from('specialties').select('id,slug').eq('slug', 'medical').single());
const tag = '[TEST] Material UI ' + randomUUID().slice(0, 8);
const subjectName = tag + ' الطب النفسي Psychiatry';
const trackName = tag + ' Exam track';
const created = [];
const browser = await startBrowser('http://localhost:3100', { port: 9358 });
const admin = await browser.page(), student = await browser.page(), publicPage = await browser.page();
const checks = [];
const widths = [320, 360, 375, 390, 412, 430, 768, 1024, 1366, 1440, 1920];

async function responsive(page, name) {
  for (const dark of [false, true]) for (const width of widths) {
    await page.resize(width);
    await page.evaluate(`document.documentElement.classList.toggle('dark',${dark});document.documentElement.style.colorScheme=${JSON.stringify(dark ? 'dark' : 'only light')}`);
    await pause(100);
    await page.healthy(`${name} ${width} ${dark}`);
    checks.push({ screen: name, width, dark, pass: true });
    if ([320, 768, 1366, 1920].includes(width)) await page.screenshot(`material-${name}-${width}-${dark ? 'dark' : 'light'}`);
  }
  for (const [width, height] of [[844, 390], [1024, 768]]) {
    await page.resize(width, height);
    await page.healthy(`${name} landscape ${width}`);
    checks.push({ screen: name, width, height, landscape: true, pass: true });
  }
}

async function form(page, name, subject) {
  await page.fillLabel('Name', name);
  await page.fillLabel('Description', 'Local UI verification only — مواد تعليمية للاختبار، not medical guidance.');
  await page.fillLabel('Specialty', specialty.id);
  await page.fillLabel('Icon', subject ? 'brain' : 'graduation');
  await page.fillLabel('Language', 'mixed');
  await page.fillLabel('Display order', '0');
}

async function locateMaterial(page, path, name) {
  // Local audit fixtures can span multiple real pages. A successful save need
  // not place a new UUID-sorted material on page one.
  for (let number = 0; number <= 100000; number++) {
    await page.goto(path + (number ? '?page=' + number : ''));
    if (await page.evaluate(`Boolean(${card(name)})`)) return;
    assert(await page.evaluate("[...document.querySelectorAll('a')].some(link=>link.textContent.trim()==='Next page')"), 'Saved material must exist in the paginated listing.');
  }
  throw Error('Saved material not found.');
}

try {
  await login(admin, manifest.users.admin, '/admin');
  await login(student, manifest.users.student, '/student');
  await admin.goto('/admin/subjects');
  await admin.click('Add subject');
  await form(admin, subjectName, true);
  assert(await admin.evaluate("[...document.querySelectorAll('label')].find(l=>l.textContent.startsWith('Publication status')).querySelector('select').disabled"));
  await responsive(admin, 'subject-form');
  await admin.resize(320, 844);
  await admin.evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Save material').scrollIntoView({block:'center'})");
  await admin.screenshot('material-subject-form-mobile-submit');
  await admin.click('Save material');
  await waitFor(async () => !(await admin.evaluate("Boolean(document.querySelector('dialog[open]'))")), 'subject saved');
  const subject = checked(await service.from('question_banks').select('*').eq('name', subjectName).single());
  created.push(subject.id);
  assert.equal(subject.material_kind, 'SUBJECT'); assert.equal(subject.exam_category, null);
  assert.equal(subject.publication_status, 'DRAFT'); assert.equal(subject.status, 'inactive');
  assert.equal(subject.price, 0); assert.equal(subject.content_language, 'mixed');
  await locateMaterial(admin, '/admin/subjects', subjectName); assert((await admin.text()).includes(subjectName));
  await responsive(admin, 'subjects');

  await admin.goto('/admin/exam-tracks'); await admin.click('Add exam track');
  await form(admin, trackName, false); await admin.fillLabel('Exam category', 'PROMETRIC');
  await responsive(admin, 'track-form');
  await admin.resize(375, 844);
  await admin.evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Save material').scrollIntoView({block:'center'})");
  await admin.click('Save material');
  await waitFor(async () => !(await admin.evaluate("Boolean(document.querySelector('dialog[open]'))")), 'track saved');
  const track = checked(await service.from('question_banks').select('*').eq('name', trackName).single());
  created.push(track.id); assert.equal(track.publication_status, 'DRAFT'); assert.equal(track.status, 'inactive');
  await locateMaterial(admin, '/admin/exam-tracks', trackName);
  await admin.click('Edit', card(trackName));
  await admin.fillLabel('Publication status', 'PUBLISHED'); await admin.fillLabel('Availability', 'active');
  await admin.click('Save material');
  await waitFor(async () => checked(await service.from('question_banks').select('status').eq('id', track.id).single()).status === 'active', 'track published');
  await responsive(admin, 'tracks');
  await student.goto('/student/specialties/' + specialty.slug);
  assert((await student.text()).includes('Prometric Exams')); assert((await student.text()).includes(trackName));
  assert(!(await student.text()).includes(subjectName)); assert(!(await student.text()).includes('Free access'));
  await responsive(student, 'student-specialty');
  await publicPage.goto('/programs/' + specialty.slug);
  assert((await publicPage.text()).includes('Prometric Exams')); assert(!(await publicPage.text()).includes(subjectName));
  await responsive(publicPage, 'public-specialty');
  assert((await studentDb.rpc('request_bank_access', { bank_id: subject.id })).error);
  assert((await studentDb.rpc('save_learning_material', { payload: {} })).error);
  assert((await studentDb.rpc('admin_learning_materials', { kind: 'SUBJECT' })).error);
  await student.goto('/admin/subjects');
  assert(!(await student.evaluate("location.pathname === '/admin/subjects' && Boolean([...document.querySelectorAll('button')].find(b=>b.textContent==='Add subject'))")));
  assert.equal(browser.errors.length, 0, JSON.stringify(browser.errors));
  assert.equal(browser.failedResponses.length, 0, JSON.stringify(browser.failedResponses));
  console.log(`PASS material browser UI/actions/persistence/authorization; ${checks.length} responsive screen combinations.`);
  await writeFile('.test-artifacts/material-browser.json', JSON.stringify({ checks, errors: browser.errors, failedResponses: browser.failedResponses }, null, 2));
} finally {
  await browser.close();
  // Exact generated fixture IDs only; no user, question, attempt or ledger cleanup.
  if (created.length) checked(await service.from('question_banks').delete().in('id', created));
  await adminDb.auth.signOut(); await studentDb.auth.signOut();
}
