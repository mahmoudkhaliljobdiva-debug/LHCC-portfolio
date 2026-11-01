// Local browser -> Server Action -> guarded RPC -> persisted lesson/PDF verification.
// Start a build using archive-qa.env first. This script never loads .env.local.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { assertLocalQaTarget } from "./qa-safety.mjs";
import { startBrowser, login, waitFor, pause, card } from "./qa-browser.mjs";

async function prepareSafePdf() {
  // Reportlab is not installed on this Windows host. Reuse archive QA's simple
  // real-PDF construction, containing only synthetic reading text and no keys.
  const lines = ["[TEST] Private reading workflow", "Non-medical local verification fixture.", "This page contains no questions, answer keys or solutions.", "Its only purpose is to verify explicit review and revocation.", "No Student access is enabled by this test."];
  const stream = "BT /F1 12 Tf 50 750 Td 24 TL\n" + lines.map((line, index) => (index ? "T* " : "") + "(" + line.replace(/[()\\]/g, "\\$&") + ") Tj").join("\n") + "\nET";
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  for (let index = 0; index < objects.length; index++) { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.map(offset => String(offset).padStart(10, "0") + " 00000 n \n").join("") + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  await writeFile(".test-artifacts/lesson-student-safe-fixture.pdf", pdf);
  console.log("Created synthetic reading fixture. Render and visually review before running browser approval QA.");
}
if (process.argv.includes("--prepare-safe-pdf")) {
  assert.deepEqual(process.argv.slice(2), ["--prepare-safe-pdf"]);
  await prepareSafePdf();
  process.exit(0);
}
assert.equal(process.argv.length, 2, "Usage: node scripts/lesson-browser.mjs [--prepare-safe-pdf]");

const manifest = JSON.parse(await readFile(".test-artifacts/archive-qa.private.json", "utf8"));
const env = Object.fromEntries((await readFile(".test-artifacts/archive-qa.env", "utf8")).split(/\r?\n/).filter(Boolean).map(line => {
  const index = line.indexOf("=");
  assert(index > 0, "Malformed isolated QA environment file.");
  return [line.slice(0, index), line.slice(index + 1)];
}));
const target = assertLocalQaTarget(manifest.url);
assert.equal(assertLocalQaTarget(env.NEXT_PUBLIC_SUPABASE_URL), target);
if (process.env.NEXT_PUBLIC_SUPABASE_URL) assert.equal(assertLocalQaTarget(process.env.NEXT_PUBLIC_SUPABASE_URL), target);
const base = new URL(process.env.LHCC_QA_BASE ?? "http://localhost:3100");
assert(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) && !base.username && !base.password && base.pathname === "/", "Lesson browser QA requires an isolated localhost app.");
const container = "supabase_db_archive-db";
// Before any fixture mutation, require the exact isolated Docker project to be running.
const containerInfo = JSON.parse(execFileSync("docker", ["inspect", container], { encoding: "utf8", windowsHide: true }))[0];
assert.equal(containerInfo.Config.Labels["com.supabase.cli.project"], "archive-db");
assert.equal(containerInfo.State.Running, true);
assert.equal(execFileSync("docker", ["exec", container, "psql", "-X", "-q", "-U", "postgres", "-d", "postgres", "-Atc", "select to_regprocedure('public.save_learning_material(jsonb)') is not null and to_regprocedure('public.admin_subject_lessons(text,uuid)') is not null;"], { encoding: "utf8", windowsHide: true }).trim(), "t", "Apply reviewed local Phase 2/3 migrations before browser QA; this script never applies migrations.");

const checked = (result, label = "Local QA query") => { if (result.error) throw Error(`${label}: ${result.error.code ?? ""} ${result.error.message}`); return result.data; };
const service = createClient(target, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const client = () => createClient(target, manifest.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const adminDb = client(), studentDb = client(), teacherDb = client(), anonymousDb = client();
const bankId = randomUUID(), tag = "[TEST] Lesson UI " + bankId.slice(0, 8);
const subjectName = tag + " مادة / Subject", chapterTitle = tag + " فصل / Chapter", lessonTitle = tag + " درس / Lesson";
const lessonIds = new Set(), checks = [], responsiveChecks = [], focusedScreenshots = [], timings = [];
const widths = [320, 375, 390, 430, 768, 1024, 1366, 1440, 1920];
const editor = "document.querySelector('section[aria-label=\"Lesson editor\"]')";
const dialog = "document.querySelector('dialog[open]')";
const questionArticle = index => `[...${editor}.querySelectorAll('article')].filter(element=>element.querySelector('details'))[${index}]`;
let browser, fixtureCreated = false;

async function createQaSubject(specialtyId) {
  // Same typed lifecycle as material QA; no direct question_banks insert or guessed mapping.
  assertLocalQaTarget(adminDb.supabaseUrl);
  assert.equal(checked(await adminDb.from("question_banks").select("id").eq("id", bankId).maybeSingle()), null);
  const payload = { id: bankId, name: subjectName, description: "Synthetic local verification only; not educational or medical advice.", specialtyId, materialKind: "SUBJECT", examCategory: null, publicationStatus: "DRAFT", icon: "book", language: "mixed", displayOrder: 0, status: "inactive" };
  assert.equal(checked(await adminDb.rpc("save_learning_material", { payload })), bankId);
  fixtureCreated = true;
  const persisted = checked(await service.from("question_banks").select("material_kind,publication_status,status,price").eq("id", bankId).single());
  assert.equal(persisted.material_kind, "SUBJECT");
  assert.equal(persisted.publication_status, "DRAFT");
  assert.equal(persisted.status, "inactive");
  assert.equal(Number(persisted.price), 0);
}

async function data(lessonId = null) {
  return checked(await adminDb.rpc("admin_subject_lessons", { bank_id: bankId, lesson_id: lessonId }), "Read persisted lesson");
}

async function responsive(page, screen) {
  for (const dark of [false, true]) for (const width of widths) {
    await page.resize(width);
    await page.evaluate(`document.documentElement.classList.toggle('dark',${dark});document.documentElement.style.colorScheme=${JSON.stringify(dark ? "dark" : "only light")};window.scrollTo(0,0)`);
    await pause(250);
    await page.healthy(`${screen} ${width} ${dark ? "dark" : "light"}`);
    if (await page.evaluate("Boolean(document.querySelector('dialog[open]'))")) {
      assert(await page.evaluate("(() => {const d=document.querySelector('dialog[open]');return d.scrollWidth<=d.clientWidth;})()"), "No modal horizontal overflow: " + screen);
    }
    responsiveChecks.push({ screen, width, dark, pass: true });
    if ([320, 390, 768, 1366, 1920].includes(width)) {
      if (["private-extraction-review", "unapproved-pdf-roles"].includes(screen)) {
        await page.evaluate(`(() => {const documents=[...${editor}.querySelectorAll('article')].filter(element=>element.querySelector('h4'));const target=documents[${screen === "unapproved-pdf-roles" ? "documents.length-1" : "0"}];if(target){target.style.scrollMarginTop='96px';target.scrollIntoView({block:'start',behavior:'instant'});}})()`);
      } else if (["verified-question-review", "manual-question"].includes(screen)) {
        await page.evaluate(`(() => {const target=${questionArticle(screen === "manual-question" ? 2 : 0)};if(target){target.style.scrollMarginTop='96px';target.scrollIntoView({block:'start',behavior:'instant'});}})()`);
      }
      await page.screenshot(`lesson-${screen}-${width}-${dark ? "dark" : "light"}`);
    }
  }
  for (const [width, height] of [[844, 390], [1024, 768]]) {
    await page.resize(width, height);
    await page.healthy(`${screen} landscape ${width}`);
    responsiveChecks.push({ screen, width, height, landscape: true, pass: true });
  }
  console.log(`PASS lesson responsive screen: ${screen}`);
}

async function focusedShots(page, screen, expression, screenshotWidths = [320, 390, 768, 1366, 1920]) {
  for (const dark of [false, true]) for (const width of screenshotWidths) {
    await page.resize(width);
    await page.evaluate(`document.documentElement.classList.toggle('dark',${dark});document.documentElement.style.colorScheme=${JSON.stringify(dark ? "dark" : "only light")};(() => {const target=${expression};target.style.scrollMarginTop='96px';target.scrollIntoView({block:'start',behavior:'instant'});})()`);
    await pause(250);
    await page.healthy(`${screen} focused ${width} ${dark}`);
    await page.screenshot(`lesson-${screen}-${width}-${dark ? "dark" : "light"}`);
    focusedScreenshots.push({ screen, width, dark });
  }
  console.log(`PASS lesson focused screenshots: ${screen}`);
}

async function save(page, lessonId, status = "DRAFT") {
  const before = lessonId ? (await data(lessonId)).draft.expectedRevision : 0;
  const start = Date.now();
  await page.click(status === "PUBLISHED" ? "Publish reviewed lesson" : status === "ARCHIVED" ? "Archive lesson" : "Save draft / Unpublish", editor);
  await waitFor(async () => {
    const id = lessonId ?? await page.evaluate("new URL(location.href).searchParams.get('lesson')");
    if (!id) return false;
    lessonIds.add(id);
    const persisted = (await data(id)).draft;
    return persisted?.expectedRevision > before && persisted.status === status;
  }, `lesson ${status.toLowerCase()} persisted`);
  await waitFor(() => page.evaluate(`${editor} && !${editor}.querySelector('fieldset').disabled`), "lesson editor ready after save");
  timings.push({ event: `actual UI ${status.toLowerCase()} through server/RPC to persistence`, ms: Date.now() - start });
  return lessonId ?? page.evaluate("new URL(location.href).searchParams.get('lesson')");
}

async function uploadPdf(page, filename, role = "ORIGINAL", safeReading = false) {
  await page.fillLabel("Document role", role, editor);
  await page.fillLabel("Source / permission / derivative provenance", safeReading ? "Synthetic non-medical reading fixture generated locally for explicit approval/revocation QA. Rendered and visually reviewed; no questions, answer keys or solutions." : "Existing synthetic QA PDF. Explicit fixture keys are present; retain private and unapproved. Not a reviewed Student-safe educational source.", editor);
  const pdf = (await readFile(safeReading ? ".test-artifacts/lesson-student-safe-fixture.pdf" : ".test-artifacts/archive-2025-fixture.pdf")).toString("base64");
  const before = (await data([...lessonIds][0])).documents.length;
  await page.evaluate(`(() => {const bytes=Uint8Array.from(atob(${JSON.stringify(pdf)}),character=>character.charCodeAt(0));const file=new File([bytes],${JSON.stringify(filename)},{type:'application/pdf'});const transfer=new DataTransfer();transfer.items.add(file);const input=document.querySelector('input[aria-label="Upload private lesson PDF"]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await waitFor(async () => (await data([...lessonIds][0])).documents.length === before + 1, "private PDF registered", 90000);
  await waitFor(() => page.evaluate(`${editor} && !${editor}.querySelector('fieldset').disabled`), "PDF extraction finished", 90000);
  const document = (await data([...lessonIds][0])).documents.find(item => item.filename === filename);
  assert(document);
  assert.equal(document.documentRole, role);
  assert.equal(document.approvedForStudents, false, "No upload role grants automatic Student-safe approval.");
  return document;
}

async function reviewQuestion(page, index, { manual = false, explanation = "[TEST] Reviewed explanation only; not medical instruction. شرح المراجع." } = {}) {
  const scope = questionArticle(index);
  await page.evaluate(`${scope}.querySelector('details').open=true`);
  if (manual) {
    await page.fillLabel("Original source question number", "M1", scope);
    await page.fillLabel("Question text", "[TEST] Manual transcription / نص يدوي", scope);
    await page.fillLabel("Option A", "First local fixture option / الأول", scope);
    await page.fillLabel("Option B", "Second local fixture option / الثاني", scope);
    const answer = await page.evaluate(`${scope}.querySelector('label').textContent && [...${scope}.querySelectorAll('label')].find(label=>label.textContent.startsWith('Verified correct answer')).querySelector('select').options[2].value`);
    await page.fillLabel("Verified correct answer", answer, scope);
  }
  await page.fillLabel("Why this answer is correct", explanation, scope);
  if (!manual) await page.fillLabel("Source page (optional)", "1", scope);
  if (await page.evaluate(`Boolean([...${scope}.querySelectorAll('button')].find(button=>button.textContent.startsWith('I reviewed and resolved these warnings')))`)) await page.click("I reviewed and resolved these warnings", scope);
  await page.evaluate(`(() => {const label=[...${scope}.querySelectorAll('label')].find(label=>label.textContent.includes('I compared this question, options, case and correct answer'));const input=label.querySelector('input');if(input.disabled)throw Error('Question review still requires an answer or warning resolution');if(!input.checked)input.click();})()`);
}

function cleanupFixtures() {
  if (!fixtureCreated) return;
  const info = JSON.parse(execFileSync("docker", ["inspect", container], { encoding: "utf8", windowsHide: true }))[0];
  assert.equal(info.Config.Labels["com.supabase.cli.project"], "archive-db");
  assert(/^[a-f0-9-]{36}$/.test(bankId));
  // All targets are exact generated bank-owned rows. No users, grants, attempts or ledgers.
  const ids = `select id from public.lessons where question_bank_id='${bankId}'`;
  const questionIds = `select id from public.bank_questions where question_bank_id='${bankId}'`;
  const sql = `begin;
delete from private.lesson_question_explanations where lesson_id in (${ids});
delete from private.lesson_question_owners where lesson_id in (${ids});
delete from private.lesson_case_owners where lesson_id in (${ids});
delete from private.lesson_drafts where lesson_id in (${ids});
delete from public.lesson_questions where lesson_id in (${ids});
delete from public.lesson_documents where lesson_id in (${ids});
delete from public.lessons where question_bank_id='${bankId}';
delete from private.question_solutions where question_id in (${questionIds});
delete from public.bank_questions where question_bank_id='${bankId}';
delete from public.question_sections where question_bank_id='${bankId}';
delete from public.bank_chapters where question_bank_id='${bankId}';
delete from public.question_banks where id='${bankId}';
commit;
select not exists(select 1 from public.question_banks where id='${bankId}');`;
  const result = execFileSync("docker", ["exec", "-i", container, "psql", "-X", "-q", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], { input: sql, encoding: "utf8", windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  assert.equal(result.trim(), "t", "Exact generated fixture cleanup completed.");
}

try {
  for (const [db, user] of [[adminDb, manifest.users.admin], [studentDb, manifest.users.student], [teacherDb, manifest.users.teacher]]) checked(await db.auth.signInWithPassword(user), "Sign in isolated QA role");
  const specialty = checked(await service.from("specialties").select("id,slug").eq("slug", "medical").single(), "Read existing explicit QA specialty");
  await createQaSubject(specialty.id);
  browser = await startBrowser(base.origin, { port: Number(process.env.LHCC_QA_DEBUG_PORT ?? 9359) });
  const admin = await browser.page(), stale = await browser.page(), student = await browser.page(), teacher = await browser.page();
  await admin.confirmDialogs(); await stale.confirmDialogs();
  await login(admin, manifest.users.admin, "/admin");
  const path = `/admin/subjects/${bankId}/lessons`;
  await admin.goto(path);
  assert((await admin.text()).includes("No chapters yet"));
  await responsive(admin, "empty-authoring");
  await admin.click("Add chapter");
  await admin.fillLabel("Title", chapterTitle, dialog);
  await admin.fillLabel("Description", "Synthetic mixed-language chapter / فصل للاختبار المحلي فقط", dialog);
  await admin.fillLabel("Display order", "2", dialog);
  await responsive(admin, "chapter-form");
  await admin.resize(320, 844); await admin.click("Save chapter", dialog);
  await waitFor(async () => (await data()).chapters.length === 1 && !(await admin.evaluate("Boolean(document.querySelector('dialog[open]'))")), "actual UI chapter save");
  const chapter = (await data()).chapters[0];
  assert.equal(chapter.title, chapterTitle); assert.equal(chapter.displayOrder, 2); assert.equal(chapter.published, false);
  await admin.goto(path); assert((await admin.text()).includes(chapterTitle));
  await admin.click("Add lesson", card(chapterTitle));
  await admin.fillLabel("Title", lessonTitle, editor);
  await admin.fillLabel("Description", "Synthetic lesson metadata / وصف الدرس", editor);
  await admin.fillLabel("Language", "mixed", editor);
  await admin.fillLabel("Display order", "3", editor);
  assert(await admin.evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Upload private PDF')).disabled"));
  await responsive(admin, "new-lesson");
  await admin.resize(375, 844);
  const lessonId = await save(admin, null);
  lessonIds.add(lessonId);
  await admin.goto(`${path}?lesson=${lessonId}`);
  let persisted = (await data(lessonId)).draft;
  assert.equal(persisted.title, lessonTitle); assert.equal(persisted.chapterId, chapter.id); assert.equal(persisted.language, "mixed"); assert.equal(persisted.displayOrder, 3);
  assert(await admin.evaluate(`${editor}.querySelector('input').value===${JSON.stringify(lessonTitle)}`));
  checks.push("Actual UI chapter/lesson create and mobile submit; server/RPC revision, mixed text, chapter/order/language survive full navigation reload");

  await login(stale, manifest.users.admin, "/admin"); await stale.goto(`${path}?lesson=${lessonId}`);
  await admin.fillLabel("Description", "First administrator revision / محفوظ", editor); await save(admin, lessonId);
  await stale.fillLabel("Description", "Stale administrator text must remain unsaved", editor);
  await stale.click("Save draft / Unpublish", editor);
  await waitFor(async () => (await stale.text()).includes("newer revision"), "stale revision conflict");
  assert.equal((await data(lessonId)).draft.description, "First administrator revision / محفوظ");
  assert.equal(await stale.evaluate(`(() => {const label=[...${editor}.querySelectorAll('label')].find(label=>label.textContent.startsWith('Description'));return label.querySelector('textarea').value;})()`), "Stale administrator text must remain unsaved");
  await stale.click("Reload saved lesson", editor);
  await waitFor(() => stale.evaluate(`!${editor}.textContent.includes('Unsaved changes')`), "explicit conflict reload");
  checks.push("Two actual Admin pages reject stale optimistic revision without overwriting persisted content or silently discarding unsaved local input");

  // Controlled same-document history entries let native Back exercise the guard
  // without crossing the helper's about:blank/full-document navigation boundary.
  await admin.evaluate(`history.pushState(history.state,'','/admin/subjects');history.pushState(history.state,'',${JSON.stringify(`${path}?lesson=${lessonId}`)})`);
  await admin.fillLabel("Description", "Unsaved text retained after cancelled Back / محفوظ", editor);
  await pause(200);
  await admin.evaluate("window.lessonQaConfirm=window.confirm;window.confirm=message=>{window.lessonQaBackPrompt=message;return false;};history.back()");
  await waitFor(() => admin.evaluate("Boolean(window.lessonQaBackPrompt)"), "native Back requested unsaved-change confirmation");
  assert(await admin.evaluate(`location.pathname===${JSON.stringify(path)} && new URL(location.href).searchParams.get('lesson')===${JSON.stringify(lessonId)}`));
  assert.equal(await admin.evaluate(`[...${editor}.querySelectorAll('label')].find(label=>label.textContent.startsWith('Description')).querySelector('textarea').value`), "Unsaved text retained after cancelled Back / محفوظ");
  await admin.evaluate("window.confirm=window.lessonQaConfirm;delete window.lessonQaConfirm;delete window.lessonQaBackPrompt");
  await admin.click("Reload saved lesson", editor);
  await waitFor(() => admin.evaluate(`!${editor}.textContent.includes('Unsaved changes')`), "discard only after explicit reload confirmation");
  const pendingRevision = (await data(lessonId)).draft.expectedRevision;
  await admin.fillLabel("Description", "Pending operation navigation guard / حفظ", editor);
  await admin.evaluate("window.lessonQaFetch=window.fetch;window.fetch=(...args)=>{if(args[1]?.method==='POST'){window.fetch=window.lessonQaFetch;return new Promise(resolve=>setTimeout(resolve,1500)).then(()=>window.lessonQaFetch(...args));}return window.lessonQaFetch(...args);}");
  await admin.click("Save draft / Unpublish", editor);
  await waitFor(() => admin.evaluate(`${editor}.querySelector('fieldset').disabled`), "controlled pending save");
  await admin.click("Back to Subjects");
  assert(await admin.evaluate(`location.pathname===${JSON.stringify(path)}`), "Pending save blocks route link navigation.");
  await waitFor(async () => (await data(lessonId)).draft.expectedRevision > pendingRevision, "pending save persisted after blocked navigation");
  await waitFor(() => admin.evaluate(`!${editor}.querySelector('fieldset').disabled`), "pending operation unlocked after persisted readback");
  await admin.evaluate("window.fetch=window.lessonQaFetch;delete window.lessonQaFetch");
  checks.push("Native dirty Back cancellation retains route/input; a controlled in-flight actual save blocks route links until server persistence/readback finishes");

  const original = await uploadPdf(admin, "lesson-original-fixture.pdf");
  await waitFor(async () => (await admin.text()).includes("0 / 2 verified"), "existing PDF questions extracted for review");
  await responsive(admin, "private-extraction-review");
  await admin.resize(320, 844); await save(admin, lessonId);
  persisted = (await data(lessonId)).draft;
  assert.equal(persisted.questions.length, 2); assert(persisted.questions.every(question => !question.verified && question.documentId === original.id && question.sourcePage === null && question.includeInBank === false));
  await admin.click("Publish reviewed lesson", editor);
  await waitFor(async () => (await admin.text()).includes("Verify every published question"), "unverified publication blocked");
  assert.equal((await data(lessonId)).draft.status, "DRAFT");
  const documentScope = card("lesson-original-fixture.pdf");
  assert(await admin.evaluate(`[...${documentScope}.querySelectorAll('button')].find(button=>button.textContent.startsWith('Approve reviewed PDF')).disabled`));
  await admin.click("Open private PDF for review", documentScope);
  await waitFor(() => admin.evaluate(`Boolean([...${documentScope}.querySelectorAll('a')].find(link=>link.textContent.startsWith('View private PDF')))`), "Admin-scoped private signed link");
  const privateLink = await admin.evaluate(`[...${documentScope}.querySelectorAll('a')].find(link=>link.textContent.startsWith('View private PDF')).href`);
  assert.equal(new URL(privateLink).origin, target);
  const reviewedPdf = await fetch(privateLink);
  assert.equal(reviewedPdf.status, 200); assert((await reviewedPdf.text()).startsWith("%PDF-"));
  assert((await studentDb.storage.from("lesson-source-pdfs").download(`${lessonId}/${original.id}.pdf`)).error);
  assert((await studentDb.storage.from("lesson-source-pdfs").createSignedUrl(`${lessonId}/${original.id}.pdf`, 60)).error);
  assert.equal(checked(await studentDb.from("lesson_documents").select("id")).length, 0);
  const anonymousDocuments = await anonymousDb.from("lesson_documents").select("id");
  assert(anonymousDocuments.error || anonymousDocuments.data.length === 0);
  const publicPdf = await fetch(anonymousDb.storage.from("lesson-source-pdfs").getPublicUrl(`${lessonId}/${original.id}.pdf`).data.publicUrl);
  assert.notEqual(publicPdf.status, 200, "Private bucket must not expose original uploads through a public URL.");
  checks.push("Actual real PDF upload/extraction/save remains private and unapproved; scoped temporary Admin review succeeds; Student/anonymous direct metadata, download, signed URL and public URL denied");

  for (let index = 0; index < 2; index++) await reviewQuestion(admin, index);
  await reviewQuestion(admin, 0, { explanation: "   " });
  await admin.click("Publish reviewed lesson", editor);
  await waitFor(async () => (await admin.text()).includes("Explain why the correct answer is right"), "blank correct-answer rationale blocks publication");
  assert.equal((await data(lessonId)).draft.status, "DRAFT");
  await reviewQuestion(admin, 0);
  await responsive(admin, "verified-question-review");
  await focusedShots(admin, "clinical-options", `[...${questionArticle(0)}.querySelectorAll('label')].find(label=>label.textContent.startsWith('Option A'))`);
  await focusedShots(admin, "explanation-source", `[...${questionArticle(0)}.querySelectorAll('label')].find(label=>label.textContent.startsWith('Why this answer is correct'))`);
  await save(admin, lessonId, "PUBLISHED");
  persisted = (await data(lessonId)).draft;
  assert(persisted.questions.every(question => question.verified && question.correctOptionId && question.warnings.length === 0 && question.sourcePage === 1 && question.explanation.includes("Reviewed explanation")));
  await admin.goto(`${path}?lesson=${lessonId}`);
  assert((await admin.text()).includes("2 / 2 verified"));
  assert((await admin.text()).includes("Student reading, practice or access"));
  checks.push("Publication fails before review and when a verified answer has a blank rationale; existing explicit keys, source pages and Admin-written why-correct explanations publish and reload only after actual UI verification");

  await admin.click("Add manual question", editor);
  const manualScope = questionArticle(2);
  await admin.evaluate(`${manualScope}.querySelector('details').open=true`);
  await admin.fillLabel("Question text", "[TEST] Manual transcription pending review", manualScope);
  await save(admin, lessonId);
  persisted = (await data(lessonId)).draft;
  assert.equal(persisted.questions.length, 3); assert.equal(persisted.questions[2].documentId, null); assert.equal(persisted.questions[2].correctOptionId, null); assert.equal(persisted.questions[2].verified, false);
  await reviewQuestion(admin, 2, { manual: true });
  await responsive(admin, "manual-question");
  await focusedShots(admin, "mobile-save-footer", `${editor}.lastElementChild`, [320, 390]);
  await save(admin, lessonId, "PUBLISHED");
  assert.equal((await data(lessonId)).draft.questions[2].sourceNumber, "M1");
  checks.push("Actual UI manual transcription persists incomplete without an invented key; manual options/key/explanation require explicit review before publishing");

  // The separate rendered no-key reading fixture can be truthfully reviewed safe.
  // The keyed original always remains unapproved.
  const derivative = await uploadPdf(admin, "lesson-student-safe-fixture.pdf", "STUDENT_SAFE", true);
  assert.equal((await data(lessonId)).draft.questions.length, 3);
  assert((await data(lessonId)).documents.every(document => !document.approvedForStudents));
  assert((await studentDb.storage.from("lesson-source-pdfs").download(`${lessonId}/${derivative.id}.pdf`)).error);
  await responsive(admin, "unapproved-pdf-roles");
  const safeDocumentScope = card("lesson-student-safe-fixture.pdf");
  assert(await admin.evaluate(`[...${safeDocumentScope}.querySelectorAll('button')].find(button=>button.textContent.startsWith('Approve reviewed PDF')).disabled`));
  await admin.click("Open private PDF for review", safeDocumentScope);
  await waitFor(() => admin.evaluate(`Boolean([...${safeDocumentScope}.querySelectorAll('a')].find(link=>link.textContent.startsWith('View private PDF')))`), "safe reading review link");
  await admin.evaluate(`[...${safeDocumentScope}.querySelectorAll('label')].find(label=>label.textContent.includes('I reviewed this PDF as Student-safe')).querySelector('input').click()`);
  await admin.click("Approve reviewed PDF as Student-safe", safeDocumentScope);
  await waitFor(async () => (await data(lessonId)).documents.find(document => document.id === derivative.id).approvedForStudents, "explicit reviewed PDF approval persisted");
  assert.equal((await data(lessonId)).documents.find(document => document.id === original.id).approvedForStudents, false);
  assert((await studentDb.storage.from("lesson-source-pdfs").download(`${lessonId}/${derivative.id}.pdf`)).error, "Review approval alone never enables Student reads in Phase 3.");
  await admin.goto(`${path}?lesson=${lessonId}`);
  assert((await admin.text()).includes("Reviewed Student-safe approval recorded"));
  await focusedShots(admin, "approved-pdf-revocation", card("lesson-student-safe-fixture.pdf"));
  await admin.click("Remove Student-safe approval", card("lesson-student-safe-fixture.pdf"));
  await waitFor(async () => !(await data(lessonId)).documents.find(document => document.id === derivative.id).approvedForStudents, "explicit reviewed PDF approval revoked");
  await focusedShots(admin, "revoked-pdf-review", card("lesson-student-safe-fixture.pdf"));
  await save(admin, lessonId, "ARCHIVED");
  assert.equal((await data(lessonId)).draft.questions.length, 3);
  await save(admin, lessonId, "DRAFT");
  assert.equal((await data(lessonId)).documents.length, 2);
  checks.push("Both PDF roles default unapproved; no-key reading derivative requires review checkbox and confirmation for approval, survives reload and explicitly revokes; keyed original never approved; archive/unpublish retain private content");

  await admin.click("Edit chapter", card(chapterTitle));
  await admin.fillLabel("Title", chapterTitle + " updated", dialog); await admin.fillLabel("Display order", "0", dialog); await admin.click("Save chapter", dialog);
  await waitFor(async () => (await data()).chapters[0].title.endsWith("updated"), "chapter edit persisted");
  await admin.goto(`${path}?lesson=${lessonId}`); await responsive(admin, "persisted-authoring");
  for (const db of [studentDb, teacherDb, anonymousDb]) assert((await db.rpc("admin_subject_lessons", { bank_id: bankId, lesson_id: lessonId })).error);
  assert((await studentDb.rpc("save_lesson", { payload: persisted })).error);
  assert((await studentDb.rpc("approve_lesson_document", { document_id: original.id, approved: true })).error);
  assert((await studentDb.rpc("request_bank_access", { bank_id: bankId })).error);
  assert((await studentDb.rpc("exam_bank_data", { bank_id: bankId })).error);
  await login(student, manifest.users.student, "/student"); await student.goto(`/student/specialties/${specialty.slug}`); assert(!(await student.text()).includes(subjectName));
  await student.goto(`${path}?lesson=${lessonId}`); assert(!await student.evaluate("Boolean(document.querySelector('section[aria-label=\"Lesson editor\"]'))"));
  await login(teacher, manifest.users.teacher, "/teacher"); await teacher.goto(`${path}?lesson=${lessonId}`); assert(!await teacher.evaluate("Boolean(document.querySelector('section[aria-label=\"Lesson editor\"]'))"));
  const material = checked(await service.from("question_banks").select("publication_status,status").eq("id", bankId).single());
  assert.equal(material.publication_status, "DRAFT"); assert.equal(material.status, "inactive");
  assert.deepEqual(browser.errors, []); assert.deepEqual(browser.failedResponses, []);
  checks.push("Student/Teacher/anonymous RPC and UI authoring denied; Subject cannot enter legacy requests/exams or the published Student catalog and remains draft/inactive");
  await writeFile(".test-artifacts/lesson-browser-results.json", JSON.stringify({ passed: true, production: false, physicalSamsung: false, realAuthorizedMedicalSample: false, studentSafeApprovalExercised: true, checks, widths, responsiveChecks, focusedScreenshots, timings, errors: browser.errors, failedResponses: browser.failedResponses }, null, 2));
  console.log(JSON.stringify({ passed: true, checks, responsiveCombinations: responsiveChecks.length, focusedScreenshots: focusedScreenshots.length, physicalSamsung: false, realAuthorizedMedicalSample: false, studentSafeApprovalExercised: true, timings }));
} catch (error) {
  console.error(JSON.stringify({ error: error.message, browserErrors: browser?.errors ?? [], failedResponses: browser?.failedResponses ?? [] }));
  throw error;
} finally {
  await browser?.close();
  if (fixtureCreated) {
    // Discover only documents under this new, exact fixture Subject, including a partial failed upload.
    const generatedLessons = checked(await service.from("lessons").select("id").eq("question_bank_id", bankId));
    for (const lesson of generatedLessons) lessonIds.add(lesson.id);
    for (const id of lessonIds) {
      assert(/^[a-f0-9-]{36}$/.test(id));
      const objects = checked(await service.storage.from("lesson-source-pdfs").list(id, { limit: 100 }));
      assert(objects.length < 100, "Refuse truncated fixture cleanup.");
      const paths = objects.filter(object => object.id).map(object => `${id}/${object.name}`);
      if (paths.length) checked(await service.storage.from("lesson-source-pdfs").remove(paths));
    }
    cleanupFixtures();
    console.log("PASS exact generated lesson/PDF fixture cleanup; no users, access grants, attempts or financial rows changed.");
  }
  for (const db of [adminDb, studentDb, teacherDb]) await db.auth.signOut();
}
