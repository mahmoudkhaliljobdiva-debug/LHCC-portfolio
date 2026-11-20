import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const exports = {};
  const js = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "exports", js)(name => name in mocks ? mocks[name]
    : name.startsWith("@/") ? load(resolve("src", name.slice(2) + ".ts"), mocks)
      : name.startsWith("./") ? load(resolve(dirname(path), name + ".ts"), mocks) : require(name), exports);
  return exports;
}

const { extractLessonText } = load(resolve("src/lib/learning/lesson-extraction.ts"));
const {
  lessonQuestionSchema, lessonDraftSchema, registerLessonDocumentSchema,
  approveLessonDocumentSchema, lessonSaveResultSchema,
} = load(resolve("src/lib/validation/lessons.ts"));
const lessonId = "984b3c1a-7cab-4bd7-aa5c-39c6c63d093f";
const chapterId = "07a442c7-18c6-4b9d-9b67-e8d116f5e194";
const documentId = "be974208-541b-42c4-a32d-e5ef4954fbf0";
const question = {
  id: "local-question", reuseQuestionId: null, duplicateReviewed: false,
  sourceNumber: "1", text: "Original non-medical fixture question",
  options: [{ id: "A", text: "First fixture option" }, { id: "B", text: "Second fixture option" }],
  correctOptionId: null, verified: false, includeInBank: false,
  caseId: null, caseTitle: "", caseDescription: "", warnings: [],
  explanation: "", documentId: null, sourcePage: null,
};
const lesson = {
  id: lessonId, bankId: "local-subject", chapterId, title: "Local lesson العربية",
  description: "Local reversible test only", displayOrder: 0, language: "mixed",
  status: "DRAFT", expectedRevision: 0, questions: [question],
};
const document = {
  id: documentId, lessonId, filename: "authorized-local-fixture.pdf",
  storagePath: `${lessonId}/${documentId}.pdf`, sha256: "a".repeat(64), sizeBytes: 1024,
  documentRole: "ORIGINAL", provenance: "Existing synthetic QA fixture; not medical teaching content.",
};
const reviewed = { ...question, correctOptionId: "B", verified: true, explanation: "Admin-reviewed source rationale explaining why this fixture answer is correct." };

test("lesson extraction preserves existing English MCQs, order and explicit answer keys", () => {
  const result = extractLessonText("1. Original first fixture\nA. First\nB. Second\n2. Original second fixture\nA. Third\nB. Fourth\nAnswer key\n1: B\n2: A", documentId);
  assert.deepEqual(result.questions.map(q => q.sourceNumber), ["1", "2"]);
  assert.deepEqual(result.questions.map(q => q.text), ["Original first fixture", "Original second fixture"]);
  assert.deepEqual(result.questions.map(q => q.correctOptionId), ["B", "A"]);
  assert(result.questions.every(q => !q.verified && q.documentId === documentId && q.sourcePage === null && q.explanation === ""));
  assert(result.warnings.some(warning => /draft|review/i.test(warning)));
});

test("Arabic MCQs retain original text and source numerals with explicit Arabic keys", () => {
  const result = extractLessonText("السؤال ١. نص السؤال الأصلي\nأ. الخيار الأول\nب. الخيار الثاني\n٢- سؤال ثان\nأ- خيار ثالث\nب- خيار رابع\nمفتاح الإجابات\n١: ب\n٢: أ", documentId);
  assert.equal(result.questions.length, 2);
  assert.deepEqual(result.questions.map(q => q.sourceNumber), ["١", "٢"]);
  assert.equal(result.questions[0].text, "نص السؤال الأصلي");
  assert.deepEqual(result.questions[0].options.map(option => option.text), ["الخيار الأول", "الخيار الثاني"]);
  assert.deepEqual(result.questions.map(q => q.correctOptionId), ["B", "A"]);
  assert(result.questions.every(q => !q.verified));
});

test("mixed RTL/LTR and Persian source labels are not translated or reordered", () => {
  const result = extractLessonText("Question ۱: Original English / سؤال أصلي\nA. English / العربية\nب، عربي / English\nCorrect answers\n۱: ب", documentId);
  assert.equal(result.questions.length, 1);
  assert.equal(result.questions[0].sourceNumber, "۱");
  assert.equal(result.questions[0].text, "Original English / سؤال أصلي");
  assert.equal(result.questions[0].options[1].text, "عربي / English");
  assert.equal(result.questions[0].correctOptionId, "B");
});

test("no answer key means no invented answer or generated explanation", () => {
  const result = extractLessonText("1. Choose the fixture marked correct\nA. Correct answer\nB. Other answer", documentId);
  assert.equal(result.questions[0].correctOptionId, null);
  assert.equal(result.questions[0].explanation, "");
  assert(result.questions[0].warnings.some(warning => /no explicit answer/i.test(warning)));
  assert.equal(result.questions[0].verified, false);
});

test("an explicit key that does not name a detected option is not accepted", () => {
  const result = extractLessonText("1. Fixture\nA. First\nB. Second\nAnswer key\n1: C", documentId);
  assert.equal(result.questions[0].correctOptionId, null);
  assert(result.questions[0].warnings.length > 0);
});

test("scanned, blank and lecture-prose sources require manual transcription without generating questions", () => {
  for (const source of ["", "   \n\t", "Authorized lecture prose only. No pre-existing multiple choice questions.", "نص محاضرة فقط دون أسئلة منظمة."]) {
    const result = extractLessonText(source, documentId);
    assert.deepEqual(result.questions, []);
    assert(result.warnings.some(warning => /manual transcription|scanned/i.test(warning)));
    assert(result.warnings.some(warning => /no questions|already present|not.*generat/i.test(warning)));
  }
});

test("incomplete questions and repeated source numbers remain explicitly unverified drafts", () => {
  const result = extractLessonText("1. Original\nA. Only choice\n1. Repeated source\nA. Yes\nB. No", documentId);
  assert(result.questions[0].warnings.some(warning => /fewer than two/i.test(warning)));
  assert(result.questions[1].warnings.some(warning => /repeated source number/i.test(warning)));
  assert(result.questions.every(q => !q.verified && q.correctOptionId === null));
});

test("Arabic case context and manual page references remain source review data", () => {
  const result = extractLessonText("حالة سريرية ١\nالنص الأصلي للحالة.\n١. السؤال\nأ. الأول\nب. الثاني\nمفتاح الإجابة\n١: أ", documentId);
  assert.equal(result.questions[0].caseTitle, "حالة سريرية ١");
  assert.equal(result.questions[0].caseDescription, "النص الأصلي للحالة.");
  assert(result.questions[0].caseId);
  assert.equal(result.questions[0].documentId, documentId);
  assert.equal(result.questions[0].sourcePage, null, "Flattened text must not invent page numbers.");
  assert(result.warnings.some(warning => /page references.*manual review/i.test(warning)));
});

test("lesson extraction does not opt questions into a canonical exam bank", () => {
  assert(extractLessonText("1. Fixture\nA. First\nB. Second", documentId).questions.every(q => q.includeInBank === false));
});

test("manual transcription and incomplete extraction drafts can persist without verification", () => {
  assert(lessonDraftSchema.safeParse(lesson).success);
  assert(lessonDraftSchema.safeParse({ ...lesson, questions: [{ ...question, text: "", options: [], warnings: ["Manual review required"] }] }).success);
  assert(lessonDraftSchema.safeParse({ ...lesson, questions: [] }).success);
  assert(lessonDraftSchema.safeParse({ ...lesson, title: "  Mixed العربية  " }).data.title === "Mixed العربية");
  assert(lessonQuestionSchema.safeParse({ ...question, documentId, sourcePage: 200, explanation: "Admin-reviewed explanation / شرح" }).success);
});

test("lesson questions and options reject unknown fields rather than silently stripping them", () => {
  for (const change of [{ role: "ADMIN" }, { isCorrect: true }, { answerKey: "B" }, { storagePath: "other.pdf" }]) {
    assert.equal(lessonQuestionSchema.safeParse({ ...question, ...change }).success, false);
  }
  assert.equal(lessonQuestionSchema.safeParse({ ...question, options: [{ ...question.options[0], isCorrect: true }] }).success, false);
  assert.equal(lessonDraftSchema.safeParse({ ...lesson, approved: true }).success, false);
});

test("lesson schemas bound identifiers, language, titles, revision and source references", () => {
  for (const change of [
    { id: "bad" }, { bankId: "" }, { chapterId: "bad" }, { title: " " }, { title: "x".repeat(301) },
    { description: "x".repeat(5001) }, { displayOrder: -1 }, { displayOrder: 100001 }, { displayOrder: 1.5 },
    { language: "unknown" }, { status: "LIVE" }, { expectedRevision: -1 }, { expectedRevision: 1.5 },
    { expectedRevision: "1" }, { expectedRevision: null }, { expectedRevision: undefined },
  ]) assert.equal(lessonDraftSchema.safeParse({ ...lesson, ...change }).success, false, JSON.stringify(change));
  for (const change of [
    { documentId: "bad" }, { sourcePage: 0 }, { sourcePage: 201 }, { sourcePage: 1.5 },
    { sourcePage: "1" }, { explanation: "x".repeat(10001) }, { warnings: Array(21).fill("review") },
  ]) assert.equal(lessonQuestionSchema.safeParse({ ...question, ...change }).success, false, JSON.stringify(change));
});

test("manual transcription cannot claim a PDF page without a source document", () => {
  assert(lessonQuestionSchema.safeParse({ ...question, documentId: null, sourcePage: null }).success);
  assert.equal(lessonQuestionSchema.safeParse({ ...question, documentId: null, sourcePage: 1 }).success, false);
  assert(lessonQuestionSchema.safeParse({ ...question, documentId, sourcePage: 1 }).success);
});

test("verified cases require their case identity and revision increments cannot overflow Postgres integer", () => {
  const clinical = { ...reviewed, caseId: chapterId, caseTitle: "Original fixture case", caseDescription: "Original fixture narrative" };
  assert(lessonQuestionSchema.safeParse(clinical).success);
  assert.equal(lessonQuestionSchema.safeParse({ ...clinical, caseId: null }).success, false);
  assert.equal(lessonQuestionSchema.safeParse({ ...clinical, caseTitle: "", caseDescription: "" }).success, false);
  assert(lessonDraftSchema.safeParse({ ...lesson, expectedRevision: 2147483646 }).success);
  assert.equal(lessonDraftSchema.safeParse({ ...lesson, expectedRevision: 2147483647 }).success, false);
});

test("duplicate lesson question and option IDs cannot overwrite one another", () => {
  assert.equal(lessonDraftSchema.safeParse({ ...lesson, questions: [question, question] }).success, false);
  assert.equal(lessonQuestionSchema.safeParse({ ...question, options: [question.options[0], question.options[0]] }).success, false);
});

test("published questions require a real verified key and no unresolved warnings", () => {
  assert(lessonDraftSchema.safeParse({ ...lesson, status: "PUBLISHED", questions: [reviewed] }).success);
  for (const change of [
    { verified: false }, { correctOptionId: null }, { correctOptionId: "missing" },
    { warnings: ["Compare with source"] }, { text: "" }, { options: [{ id: "A", text: "Only choice" }] },
    { options: [{ id: "A", text: "" }, { id: "B", text: "Other" }] },
    { caseTitle: "Case without narrative" }, { caseDescription: "Narrative without title" },
  ]) assert.equal(lessonDraftSchema.safeParse({ ...lesson, status: "PUBLISHED", questions: [{ ...reviewed, ...change }] }).success, false, JSON.stringify(change));
});

test("published questions require an Admin-written explanation of why the correct answer is correct", () => {
  assert(lessonDraftSchema.safeParse({ ...lesson, status: "PUBLISHED", questions: [reviewed] }).success);
  for (const explanation of ["", "   \n\t", undefined]) {
    assert.equal(lessonDraftSchema.safeParse({ ...lesson, status: "PUBLISHED", questions: [{ ...reviewed, explanation }] }).success, false);
    assert(lessonDraftSchema.safeParse({ ...lesson, status: "DRAFT", questions: [{ ...question, explanation }] }).success, "Incomplete explanations remain valid manual-review drafts.");
  }
  assert.equal(extractLessonText("1. Fixture\nA. First\nB. Second\nAnswer key\n1: B", documentId).questions[0].explanation, "", "Extraction must never invent a rationale.");
});

test("lesson draft limits cover question count and UTF-8 payload size", () => {
  const questions = Array.from({ length: 1000 }, (_, index) => ({ ...question, id: `q-${index}` }));
  assert(lessonDraftSchema.safeParse({ ...lesson, questions }).success);
  assert.equal(lessonDraftSchema.safeParse({ ...lesson, questions: [...questions, { ...question, id: "q-1000" }] }).success, false);
  const oversized = { ...lesson, questions: Array.from({ length: 150 }, (_, index) => ({ ...question, id: `large-${index}`, text: "س".repeat(9000) })) };
  assert(new TextEncoder().encode(JSON.stringify(oversized)).byteLength > 2500000);
  const result = lessonDraftSchema.safeParse(oversized);
  assert.equal(result.success, false);
  assert(result.error.issues.some(issue => /split this lesson/i.test(issue.message)));
});

test("private PDF registration accepts only the exact generated document-scoped path", () => {
  assert(registerLessonDocumentSchema.safeParse(document).success);
  assert(registerLessonDocumentSchema.safeParse({ ...document, documentRole: "STUDENT_SAFE", sizeBytes: 20971520 }).success);
  for (const storagePath of ["other.pdf", `../${documentId}.pdf`, `${chapterId}/${documentId}.pdf`, `${lessonId}/${chapterId}.pdf`, `${lessonId}/${documentId}.PDF`, `/${document.storagePath}`]) {
    assert.equal(registerLessonDocumentSchema.safeParse({ ...document, storagePath }).success, false);
  }
});

test("private PDF metadata rejects malformed hashes, oversize files, unknown approval and missing provenance", () => {
  for (const change of [
    { id: "bad" }, { lessonId: "bad" }, { filename: " " }, { filename: "x".repeat(501) },
    { sha256: "A".repeat(64) }, { sha256: "a".repeat(63) }, { sizeBytes: 0 }, { sizeBytes: -1 },
    { sizeBytes: 20971521 }, { sizeBytes: 1.5 }, { sizeBytes: "1024" }, { documentRole: "PUBLIC" },
    { provenance: " " }, { provenance: "x".repeat(3001) }, { approvedForStudents: true }, { public: true },
  ]) assert.equal(registerLessonDocumentSchema.safeParse({ ...document, ...change }).success, false, JSON.stringify(change));
});

test("approval and save results are strict typed contracts, not truthy coercions", () => {
  assert(approveLessonDocumentSchema.safeParse({ documentId, approved: true }).success);
  assert(approveLessonDocumentSchema.safeParse({ documentId, approved: false }).success);
  for (const input of [{ documentId, approved: "true" }, { documentId, approved: 1 }, { documentId, approved: true, role: "ADMIN" }, { documentId: "bad", approved: true }]) assert.equal(approveLessonDocumentSchema.safeParse(input).success, false);
  assert(lessonSaveResultSchema.safeParse({ id: lessonId, revision: 1 }).success);
  for (const input of [{ id: lessonId, revision: 0 }, { id: lessonId, revision: -1 }, { id: lessonId, revision: "1" }, { id: lessonId, revision: 1.5 }, { id: lessonId, revision: 1, storagePath: "private" }]) assert.equal(lessonSaveResultSchema.safeParse(input).success, false);
});

const allowed = { authorizeActiveAdmin: async () => ({ ok: true, data: {} }) };
const denied = { authorizeActiveAdmin: async () => ({ ok: false, error: { code: "FORBIDDEN", message: "Administrator access is required." } }) };
function actions(auth, db, revalidatePath = () => {}) {
  return load(resolve("src/actions/lessons.ts"), {
    "@/lib/auth/admin": auth, "@/lib/learning/lessons": {},
    "@/lib/supabase/server": { createClient: db }, "next/cache": { revalidatePath },
  });
}

test("unauthorized lesson mutations and private links fail before database access", async () => {
  let reached = false;
  const api = actions(denied, async () => { reached = true; throw Error("Must not query"); });
  for (const [method, args] of [
    ["saveLesson", [lesson]], ["registerLessonDocument", [document]],
    ["approveLessonDocument", [{ documentId, approved: true }]],
    ["getAdminLessonDocumentLink", [documentId, lessonId]],
  ]) assert.equal((await api[method](...args)).ok, false);
  assert.equal(reached, false);
});

test("authorized malformed lesson input cannot reach the database", async () => {
  let reached = false;
  const api = actions(allowed, async () => { reached = true; throw Error("Must not query"); });
  assert.equal((await api.saveLesson({ ...lesson, expectedRevision: -1 })).ok, false);
  assert.equal((await api.registerLessonDocument({ ...document, approvedForStudents: true })).ok, false);
  assert.equal((await api.approveLessonDocument({ documentId, approved: "true" })).ok, false);
  assert.equal((await api.getAdminLessonDocumentLink("bad", lessonId)).ok, false);
  assert.equal(reached, false);
});

test("lesson save forwards its optimistic revision only to the guarded lesson RPC", async () => {
  const calls = [], paths = [];
  const api = actions(allowed, async () => ({ rpc: async (...args) => { calls.push(args); return { data: { id: lessonId, revision: 4 }, error: null }; } }), (...args) => paths.push(args));
  assert.deepEqual(await api.saveLesson({ ...lesson, expectedRevision: 3 }), { ok: true, data: { id: lessonId, revision: 4 } });
  assert.deepEqual(calls, [["save_lesson", { payload: { ...lesson, expectedRevision: 3 } }]]);
  assert(paths.some(([path]) => path === "/admin/subjects"));
});

test("PDF registration and separate approval use different guarded RPCs", async () => {
  const calls = [];
  const api = actions(allowed, async () => ({ rpc: async (name, args) => { calls.push([name, args]); return { data: name === "register_lesson_document" ? documentId : null, error: null }; } }));
  assert.deepEqual(await api.registerLessonDocument(document), { ok: true, data: documentId });
  assert.deepEqual(await api.approveLessonDocument({ documentId, approved: false }), { ok: true, data: null });
  assert.deepEqual(calls, [["register_lesson_document", { payload: document }], ["approve_lesson_document", { document_id: documentId, approved: false }]]);
});

test("conflicts, invalid RPC results and backend details stay generic", async () => {
  for (const result of [{ data: null, error: { message: "PRIVATE SQL internals" } }, { data: { id: lessonId, revision: 0 }, error: null }]) {
    const api = actions(allowed, async () => ({ rpc: async () => result }));
    const saved = await api.saveLesson(lesson);
    assert.equal(saved.ok, false);
    assert.equal(JSON.stringify(saved).includes("PRIVATE"), false);
    assert.match(saved.error.message, /revision|reload/i);
  }
});

test("Admin private links are short-lived and exact lesson/document scoped", async () => {
  const calls = [];
  const chain = { select: fields => { calls.push(["select", fields]); return chain; }, eq: (...args) => { calls.push(["eq", ...args]); return chain; }, single: async () => ({ data: { id: documentId, lesson_id: lessonId, storage_path: document.storagePath }, error: null }) };
  const api = actions(allowed, async () => ({ from: table => { calls.push(["from", table]); return chain; }, storage: { from: bucket => ({ createSignedUrl: async (...args) => { calls.push(["signed", bucket, ...args]); return { data: { signedUrl: "https://local.invalid/private-temporary" }, error: null }; } }) } }));
  assert((await api.getAdminLessonDocumentLink(documentId, lessonId)).ok);
  assert.deepEqual(calls, [["from", "lesson_documents"], ["select", "id,lesson_id,storage_path"], ["eq", "id", documentId], ["eq", "lesson_id", lessonId], ["signed", "lesson-source-pdfs", document.storagePath, 60]]);
});

test("mismatched document paths never produce a signed URL", async () => {
  let signed = false;
  const chain = { select: () => chain, eq: () => chain, single: async () => ({ data: { storage_path: "unrelated/original.pdf" }, error: null }) };
  const api = actions(allowed, async () => ({ from: () => chain, storage: { from: () => ({ createSignedUrl: async () => { signed = true; } }) } }));
  assert.equal((await api.getAdminLessonDocumentLink(documentId, lessonId)).ok, false);
  assert.equal(signed, false);
});
