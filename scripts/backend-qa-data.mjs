// Controlled, opt-in Supabase QA data. Never imported by the application.
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

export const projectRef = "lcazjsmmegwwnmuupsko";
export const manifestPath = ".test-artifacts/backend-qa.private.json";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(new URL(url).hostname, projectRef + ".supabase.co", "Refuse to use a different Supabase project.");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
// Lazy initialization permits anonymous read diagnostics without an admin secret.
let privilegedClient;
export function getAdmin() {
  return privilegedClient ??= createClient(url, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, options);
}
export const publicClient = () => createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
export async function checked(result, label) {
  const { data, error } = await result;
  if (error) throw new Error(label + ": " + error.code + " " + error.message);
  return data;
}
export const loadManifest = async () => JSON.parse(await readFile(manifestPath, "utf8"));
export async function saveManifest(value) {
  await mkdir(".test-artifacts", { recursive: true });
  await writeFile(manifestPath, JSON.stringify(value, null, 2), { mode: 0o600 });
}
export async function loginAccount(account) {
  const client = publicClient();
  await checked(client.auth.signInWithPassword({ email: account.email, password: account.password }), "QA sign-in");
  return client;
}
async function snapshot() {
  const admin = getAdmin();
  const result = {};
  for (const table of ["profiles", "question_banks", "bank_questions", "user_bank_access_requests", "user_bank_access", "question_attempts", "question_attempt_answers", "wallet_transactions", "portfolio_content"]) {
    const rows = await checked(admin.from(table).select("*").order(table === "portfolio_content" ? "section_key" : "id"), "Snapshot " + table);
    result[table] = { ids: rows.map((row) => row.id ?? row.section_key), hash: createHash("sha256").update(JSON.stringify(rows)).digest("hex") };
  }
  return result;
}
async function setup() {
  const hasAdminKey = Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  const admin = hasAdminKey ? getAdmin() : null;
  let existing;
  try { existing = await loadManifest(); } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (existing) {
    assert.equal(existing.projectRef, projectRef);
    console.log("Existing QA manifest retained; use inspect/verify. Run: " + existing.run);
    return;
  }
  const run = new Date().toISOString().slice(0, 10).replaceAll("-", "") + "-" + randomBytes(3).toString("hex");
  const data = { projectRef, run, tag: "[TEST] QA " + run, createdAt: new Date().toISOString(), users: {}, banks: [], questions: [], walletIds: [], baseline: admin ? await snapshot() : null };
  await saveManifest(data);
  for (const [key, role] of [["admin", "ADMIN"], ["teacher", "TEACHER"], ["locked", "STUDENT"], ["pending", "STUDENT"], ["approved", "STUDENT"], ["rejected", "STUDENT"], ["completed", "STUDENT"]]) {
    const account = { email: "lhcc-qa-" + run + "-" + key + "@example.com", password: randomBytes(24).toString("base64url"), name: data.tag + " " + key };
    const metadata = { full_name: account.name, phone: "+96171056331", country_code: "LB", age: 25, gender: "male", home_address: data.tag + " address" };
    const created = await checked(admin
      ? admin.auth.admin.createUser({ email: account.email, password: account.password, email_confirm: true, user_metadata: metadata })
      : publicClient().auth.signUp({ email: account.email, password: account.password, options: { data: metadata } }), "Create QA Auth user");
    account.id = created.user.id;
    data.users[key] = account;
    await saveManifest(data);
    // Only this newly created, explicitly recorded QA identity is promoted.
    if (admin && role !== "STUDENT") {
      const activation = role === "TEACHER" ? { activation_start: new Date().toISOString(), activation_months: 12, expiration_date: new Date(Date.now() + 365 * 86400000).toISOString() } : {};
      await checked(admin.from("profiles").update({ role, status: "ACTIVE", ...activation }).eq("id", account.id).eq("full_name", account.name).select("id").single(), "Assign QA role");
    }
  }
  console.log(JSON.stringify({ run, users: Object.fromEntries(Object.entries(data.users).map(([key, account]) => [key, { id: account.id, email: account.email, name: account.name }])) }, null, 2));
  if (!admin) {
    console.log("Users created through Auth signup. A trusted operator must assign the recorded admin/teacher roles before running seed. No existing user may be modified.");
    return;
  }
  await seed();
}
async function seed() {
  const data = await loadManifest();
  assert.equal(data.projectRef, projectRef);
  assert.equal(data.banks.length, 0, "Do not reseed an existing or partially seeded run.");
  const manager = await loginAccount(data.users.admin);
  for (const [index, subject] of ["Human Anatomy", "Cardiology", "Nursing Fundamentals"].entries()) {
    const bank = { id: randomUUID(), name: data.tag + " " + subject, price: index === 2 ? 0 : 25 };
    data.banks.push(bank); await saveManifest(data);
    await checked(manager.rpc("manage_bank_content", { operation: "save_bank", item_id: bank.id, payload: { name: bank.name, description: data.tag + " controlled workflow verification; not educational guidance.", status: "active", price: bank.price, displayOrder: 100 + index } }), "Create QA bank");
    for (let number = 1; number <= 3; number++) {
      const question = { id: randomUUID(), bankId: bank.id, text: data.tag + " " + subject + " question " + number + ": select option A.", correct: "A" };
      data.questions.push(question); await saveManifest(data);
      await checked(manager.rpc("manage_bank_content", { operation: "save_question", item_id: question.id, payload: { bankId: bank.id, text: question.text, status: "active", answers: ["A", "B", "C", "D"].map((id) => ({ id, text: "Option " + id, isCorrect: id === "A" })) } }), "Create QA QCU");
    }
  }
  for (const key of ["pending", "approved", "rejected", "completed"]) {
    const student = await loginAccount(data.users[key]);
    const bank = data.banks[key === "rejected" ? 1 : 0];
    const request = await checked(student.rpc("request_bank_access", { bank_id: bank.id }), "Request QA bank");
    data.users[key].requestId = request; await saveManifest(data);
    if (key !== "pending") await checked(manager.rpc("review_bank_access", { request_id: request, decision: key === "rejected" ? "REJECTED" : "APPROVED", reason: data.tag + " review" }), "Review QA request");
    if (key === "completed") for (const [index, q] of data.questions.filter((q) => q.bankId === bank.id).entries()) {
      await checked(student.rpc("submit_bank_answer", { question_id: q.id, option_id: index === 2 ? "B" : "A" }), "Submit QA answer");
    }
  }
  for (const [type, amount] of [["manual_income", 12], ["manual_expense", 5]]) {
    const id = randomUUID(); data.walletIds.push(id); await saveManifest(data);
    await checked(manager.rpc("manage_wallet_transaction", { operation: "create", item_id: id, payload: { name: data.tag + " " + type, description: data.tag, type, amount, transactionDate: new Date().toISOString().slice(0, 10) } }), "QA wallet");
  }
  data.setupCompleted = true; await saveManifest(data);
  console.log(JSON.stringify({ run: data.run, banks: data.banks, questions: data.questions.length, credentials: manifestPath }, null, 2));
}
async function inspect() {
  const first = await publicClient().from("portfolio_content").select("section_key").order("section_key").range(0, 499);
  const next = await publicClient().from("portfolio_content").select("section_key").order("section_key").range(first.data?.length ?? 0, 999);
  console.log(JSON.stringify({ first: { status: first.status, length: first.data?.length, error: first.error }, next: { status: next.status, length: next.data?.length, error: next.error } }));
}
if (process.argv[1]?.endsWith("backend-qa-data.mjs")) {
  const command = process.argv[2];
  if (command === "setup") await setup();
  else if (command === "seed") await seed();
  else if (command === "inspect") await inspect();
  else throw new Error("Use setup, seed or inspect.");
}
