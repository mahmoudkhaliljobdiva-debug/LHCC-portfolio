// Read-only inventory for one isolated QA run. No deletion capability.
import assert from "node:assert/strict";
import { checked, getAdmin, loadManifest, projectRef } from "./backend-qa-data.mjs";

assert.equal(process.argv.length, 2, "Read-only inventory. Record cleanup requires separate approval and a verified recovery plan.");

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
console.log("READ ONLY: no accounts, database records, CMS content or files were changed. Review scope and recovery before any separately approved cleanup.");
