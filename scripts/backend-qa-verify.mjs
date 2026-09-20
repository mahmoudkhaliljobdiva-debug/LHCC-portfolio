// Live, opt-in QA against the explicitly recorded test identities only.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { checked, getAdmin, loadManifest, loginAccount, publicClient, saveManifest } from "./backend-qa-data.mjs";

const manifest = await loadManifest();
assert(manifest.setupCompleted, "Finish setup before verification.");
const admin = getAdmin();
const clients = {};
for (const [role, account] of Object.entries(manifest.users)) clients[role] = await loginAccount(account);
const userIds = Object.values(manifest.users).map((user) => user.id);
const bankIds = manifest.banks.map((bank) => bank.id);
const results = [];
async function test(name, fn) { await fn(); results.push({ name, status: "PASS" }); console.log("PASS: " + name); }
const rows = async (client, table, filter) => checked(filter(client.from(table).select("*")), table);
const own = (id) => (query) => query.eq("student_id", id);
const expectDenied = async (query) => { const { data, error } = await query; assert(error || data?.length === 0, "Protected operation must fail or expose no rows"); };

// Preserve a fingerprint of pre-existing records, excluding explicit QA IDs.
const preserved = {};
for (const table of ["profiles", "question_banks", "bank_questions", "user_bank_access_requests", "user_bank_access", "question_attempts", "question_attempt_answers", "wallet_transactions"]) {
  const data = await rows(admin, table, (q) => q.order("id"));
  const testAttemptIds = (await rows(admin, "question_attempts", (q) => q.in("student_id", userIds))).map((r) => r.id);
  const existing = data.filter((r) => !userIds.includes(r.id) && !userIds.includes(r.user_id) && !userIds.includes(r.student_id) && !userIds.includes(r.created_by) && !bankIds.includes(r.id) && !bankIds.includes(r.question_bank_id) && !testAttemptIds.includes(r.attempt_id));
  preserved[table] = { ids: existing.map((r) => r.id), hash: createHash("sha256").update(JSON.stringify(existing)).digest("hex") };
}
if (manifest.preserved) assert.deepEqual(preserved, manifest.preserved, "Non-test production rows remain unchanged");
else { manifest.preserved = preserved; await saveManifest(manifest); }

await test("Auth users have corresponding profiles and intended roles", async () => {
  for (const [role, user] of Object.entries(manifest.users)) {
    const authUser = await checked(admin.auth.admin.getUserById(user.id), "Auth identity");
    assert.equal(authUser.user.email, user.email);
    const profile = await checked(admin.from("profiles").select("*").eq("id", user.id).single(), "Profile");
    assert.equal(profile.role, role === "admin" ? "ADMIN" : role === "teacher" ? "TEACHER" : "STUDENT");
    assert(profile.full_name.startsWith(manifest.tag));
  }
});
await test("QCU keys are admin-only; every seeded question has four options and one correct answer", async () => {
  const data = await checked(clients.admin.rpc("admin_bank_data"), "Admin questions");
  for (const id of manifest.questions.map((q) => q.id)) {
    const q = data.questions.find((q) => q.id === id);
    assert.equal(q.answers.length, 4); assert.equal(q.answers.filter((a) => a.isCorrect).length, 1);
  }
  const safe = await rows(clients.approved, "bank_questions", (q) => q.eq("question_bank_id", bankIds[0]));
  assert.equal(safe.length, 3);
  assert(!/is_correct|isCorrect|correct_option/.test(JSON.stringify(safe)));
  await expectDenied(clients.approved.schema("private").from("question_solutions").select("*"));
  await expectDenied(clients.approved.rpc("admin_bank_data"));
});
await test("Anonymous, locked and rejected students cannot read protected questions", async () => {
  for (const client of [publicClient(), clients.locked, clients.rejected]) await expectDenied(client.from("bank_questions").select("*").eq("question_bank_id", bankIds[0]));
});
await test("Students cannot read another student's attempts, grants, or profile", async () => {
  assert.deepEqual(await rows(clients.locked, "question_attempts", own(manifest.users.completed.id)), []);
  assert.deepEqual(await rows(clients.locked, "user_bank_access", (q) => q.eq("user_id", manifest.users.completed.id)), []);
  assert.deepEqual(await rows(clients.locked, "profiles", (q) => q.eq("id", manifest.users.admin.id)), []);
});
await test("Students cannot promote themselves, grant access, or rewrite attempt scores", async () => {
  await expectDenied(clients.locked.from("profiles").update({ role: "ADMIN" }).eq("id", manifest.users.locked.id).select("id"));
  await expectDenied(clients.locked.from("user_bank_access").insert({ user_id: manifest.users.locked.id, question_bank_id: bankIds[0], status: "ACTIVE" }).select("id"));
  await expectDenied(clients.locked.from("question_attempts").update({ score_percentage: 100 }).eq("student_id", manifest.users.completed.id).select("id"));
  await expectDenied(clients.locked.from("wallet_transactions").insert({ transaction_type: "MANUAL_INCOME", name: manifest.tag, amount: 999 }).select("id"));
  assert.equal((await checked(admin.from("profiles").select("role").eq("id", manifest.users.locked.id).single(), "Unchanged student role")).role, "STUDENT");
});
await test("Wallet and admin mutations deny student/teacher callers", async () => {
  for (const client of [clients.locked, clients.teacher]) {
    await expectDenied(client.rpc("admin_wallet_data"));
    await expectDenied(client.from("wallet_transactions").select("*"));
    await expectDenied(client.rpc("manage_bank_content", { operation: "save_bank", item_id: bankIds[0], payload: { name: "UNAUTHORIZED" } }));
    await expectDenied(client.rpc("review_bank_access", { request_id: manifest.users.pending.requestId, decision: "APPROVED" }));
  }
});
await test("Missing banks/questions and invalid answers fail without changing progress", async () => {
  await expectDenied(clients.approved.rpc("request_bank_access", { bank_id: "[TEST]-missing-bank" }));
  await expectDenied(clients.approved.rpc("submit_bank_answer", { question_id: "[TEST]-missing-question", option_id: "A" }));
  await expectDenied(clients.approved.rpc("submit_bank_answer", { question_id: manifest.questions[0].id, option_id: "INVALID" }));
  await expectDenied(clients.locked.rpc("submit_bank_answer", { question_id: manifest.questions[0].id, option_id: "A" }));
});
await test("Duplicate requests and reviewed approval retries cannot create duplicate grants or sales", async () => {
  const before = await rows(admin, "wallet_transactions", (q) => q.eq("user_id", manifest.users.approved.id));
  await expectDenied(clients.admin.rpc("review_bank_access", { request_id: manifest.users.approved.requestId, decision: "APPROVED" }));
  await expectDenied(clients.approved.rpc("request_bank_access", { bank_id: bankIds[0] }));
  await expectDenied(clients.pending.rpc("request_bank_access", { bank_id: bankIds[0] }));
  assert.deepEqual(await rows(admin, "wallet_transactions", (q) => q.eq("user_id", manifest.users.approved.id)), before);
  assert.equal(before.filter((r) => r.transaction_type === "BANK_SALE").length, 1);
});
await test("Completed attempt and answer rows preserve backend-calculated score and timestamps", async () => {
  const attempts = await rows(clients.completed, "question_attempts", own(manifest.users.completed.id));
  assert.equal(attempts.length, 1);
  const a = attempts[0]; assert.equal(a.status, "COMPLETED"); assert.equal(a.total_questions, 3);
  assert.equal(a.correct_answers, 2); assert.equal(a.incorrect_answers, 1); assert.equal(Number(a.score_percentage), 66.67);
  assert(a.started_at && a.submitted_at && a.updated_at);
  assert.equal((await rows(clients.completed, "question_attempt_answers", (q) => q.eq("attempt_id", a.id))).length, 3);
  assert((await rows(clients.teacher, "question_attempts", (q) => q.eq("id", a.id))).length === 1);
});
await test("Sequential and concurrent completed-answer retries preserve the original attempt and answers", async () => {
  const attempts = await rows(clients.completed, "question_attempts", own(manifest.users.completed.id));
  const before = attempts[0];
  const answers = await rows(clients.completed, "question_attempt_answers", (q) => q.eq("attempt_id", before.id).order("id"));
  for (const answer of answers) {
    const result = await checked(clients.completed.rpc("submit_bank_answer", { question_id: answer.question_id, option_id: answer.selected_option_id }), "Completed answer retry");
    assert.equal(result.attemptId, before.id); assert.equal(result.completed, true); assert.equal(result.correct, answer.is_correct);
  }
  const results = await Promise.all(Array.from({ length: 6 }, (_, i) => checked(clients.completed.rpc("submit_bank_answer", { question_id: answers[i % answers.length].question_id, option_id: answers[i % answers.length].selected_option_id }), "Concurrent completed retry")));
  assert(results.every((r) => r.attemptId === before.id && r.completed));
  assert.deepEqual(await rows(clients.completed, "question_attempts", own(manifest.users.completed.id)), attempts);
  assert.deepEqual(await rows(clients.completed, "question_attempt_answers", (q) => q.eq("attempt_id", before.id).order("id")), answers);
});
await test("Empty student has zero attempts and grants", async () => {
  assert.equal((await rows(clients.locked, "question_attempts", own(manifest.users.locked.id))).length, 0);
  assert.equal((await rows(clients.locked, "user_bank_access", (q) => q.eq("user_id", manifest.users.locked.id))).length, 0);
});
await test("Wallet RPC amounts match stored ledger exactly", async () => {
  const ledger = await rows(admin, "wallet_transactions", (q) => q.order("id"));
  const rpc = await checked(clients.admin.rpc("admin_wallet_data"), "Wallet RPC");
  assert.equal(rpc.reduce((sum, r) => sum + Number(r.amount), 0), ledger.reduce((sum, r) => sum + Number(r.amount), 0));
});
const inventory = {};
for (const [table, column, ids] of [["profiles", "id", userIds], ["question_banks", "id", bankIds], ["bank_questions", "question_bank_id", bankIds], ["user_bank_access_requests", "user_id", userIds], ["user_bank_access", "user_id", userIds], ["question_attempts", "student_id", userIds], ["wallet_transactions", "created_by", [manifest.users.admin.id]]]) {
  const records = await rows(admin, table, (q) => q.in(column, ids).order("id"));
  inventory[table] = records.map((r) => ({ id: r.id, ...(r.status ? { status: r.status } : {}), ...(r.amount ? { amount: r.amount, type: r.transaction_type } : {}) }));
}
manifest.inventory = inventory; await saveManifest(manifest);
await writeFile(".test-artifacts/backend-qa-results.json", JSON.stringify({ run: manifest.run, results, inventory, preservedRecordsUnchanged: true }, null, 2));
console.log(JSON.stringify({ counts: Object.fromEntries(Object.entries(inventory).map(([name, rows]) => [name, rows.length])) }));
