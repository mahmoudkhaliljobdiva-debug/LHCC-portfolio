// Safe cleanup for one recorded QA run. Dry-run is the default.
import assert from "node:assert/strict";
import { checked, getAdmin, loadManifest, projectRef } from "./backend-qa-data.mjs";

const manifest = await loadManifest();
assert.equal(manifest.projectRef, projectRef, "Refuse to use a different Supabase project.");
assert.match(manifest.run, /^\d{8}-[a-f0-9]{6}$/);
assert.equal(manifest.tag, `[TEST] QA ${manifest.run}`);
const admin = getAdmin();
const userIds = Object.values(manifest.users).map((user) => user.id);
const bankIds = manifest.banks.map((bank) => bank.id);
const questionIds = manifest.questions.map((question) => question.id);
const attempts = await checked(admin.from("question_attempts").select("id").in("student_id", userIds), "Locate QA attempts");
const attemptIds = attempts.map((row) => row.id);
const grants = await checked(admin.from("user_bank_access").select("id").in("user_id", userIds), "Locate QA grants");
const grantIds = grants.map((row) => row.id);
const wallet = await checked(admin.from("wallet_transactions").select("id").or([
  `user_id.in.(${userIds.join(",")})`, `question_bank_id.in.(${bankIds.join(",")})`,
  `user_bank_access_id.in.(${grantIds.join(",")})`, `created_by.eq.${manifest.users.admin.id}`,
].join(",")), "Locate QA wallet rows");
const walletIds = [...new Set([...manifest.walletIds, ...wallet.map((row) => row.id)])];
const plan = { projectRef, run: manifest.run, profilesAndAuthUsers: userIds, questionBanks: bankIds,
  bankQuestions: questionIds, accessRequestsForUsers: userIds, grants: grantIds, attempts: attemptIds,
  walletTransactions: walletIds, portfolioSection: manifest.browser?.portfolio ? "about" : null };
console.log(JSON.stringify(plan, null, 2));
if (process.argv[2] !== "--confirm-run" || process.argv[3] !== manifest.run) {
  console.log(`DRY RUN only. To execute this exact plan: node --env-file=.env.local scripts/backend-qa-cleanup.mjs --confirm-run ${manifest.run}`);
  process.exit(0);
}

for (const [key, user] of Object.entries(manifest.users)) {
  assert.equal(user.email, `lhcc-qa-${manifest.run}-${key}@example.com`);
  const profile = await checked(admin.from("profiles").select("full_name").eq("id", user.id).single(), "Validate QA profile");
  assert.equal(profile.full_name, `${manifest.tag} ${key}`);
}
for (const bank of manifest.banks) assert(bank.name.startsWith(manifest.tag));
for (const question of manifest.questions) assert(question.text.startsWith(manifest.tag));
if (manifest.browser?.portfolio) {
  const current = await checked(admin.from("portfolio_content").select("content").eq("section_key", "about").single(), "Validate QA portfolio marker");
  const expected = structuredClone(manifest.portfolioOriginal);
  expected.description += ` ${manifest.portfolioMarker}`;
  assert.deepEqual(current.content, expected, "Portfolio changed after QA; restore it manually rather than overwriting newer work.");
  await checked(admin.from("portfolio_content").update({ content: manifest.portfolioOriginal }).eq("section_key", "about").select("section_key").single(), "Restore About content");
}
async function remove(table, column, ids) {
  if (ids.length) await checked(admin.from(table).delete().in(column, ids), `Delete QA ${table}`);
}
await remove("wallet_transactions", "id", walletIds);
await remove("question_attempt_answers", "attempt_id", attemptIds);
await remove("question_attempts", "id", attemptIds);
await remove("user_bank_access", "id", grantIds);
await remove("user_bank_access_requests", "user_id", userIds);
await remove("bank_questions", "id", questionIds);
await remove("question_banks", "id", bankIds);
for (const user of Object.values(manifest.users)) {
  const revoke = await admin.auth.admin.signOut(user.id, "global");
  if (revoke.error) throw revoke.error;
  await checked(admin.auth.admin.deleteUser(user.id), "Delete QA Auth user");
}
console.log(`QA run ${manifest.run} removed. The local manifest is retained as an audit record.`);
