// k6 readiness test. Only for an isolated staging environment.
// 300 distinct active student JWTs (and optional staging web session cookies).
// Mode "browse": read-only catalog, student preview and missed-question RPCs.
// Mode "submit": one atomic exam submission per unique preseeded student/attempt.
// Never commit private fixture JSON or run this against production.

import http from "k6/http";
import { check, sleep } from "k6";
import exec from "k6/execution";
import { Rate, Trend } from "k6/metrics";

const mode = __ENV.K6_MODE || "browse";
if (!["browse", "submit"].includes(mode)) throw new Error("K6_MODE must be browse or submit");

const supabaseUrl = (__ENV.K6_SUPABASE_URL || "").replace(/\/$/, "");
const webUrl = (__ENV.K6_WEB_URL || "").replace(/\/$/, "");
const publishableKey = __ENV.K6_SUPABASE_ANON_KEY;
const medBank = __ENV.K6_MEDICAL_BANK_ID;
if (!supabaseUrl || !publishableKey || !medBank)
  throw new Error("Set K6_SUPABASE_URL, K6_SUPABASE_ANON_KEY and K6_MEDICAL_BANK_ID from isolated staging");
if (!/^https:\/\//.test(supabaseUrl))
  throw new Error("Use HTTPS for the staging Supabase URL");

// Explicit guards against accidentally sending 300 VUs to LHCC production.
const forbidden = /lcazjsmmegwwnmuupsko|lhcc-lb\.com|lhcc-portfolio\.vercel\.app/i;
if (forbidden.test(supabaseUrl) || (webUrl && forbidden.test(webUrl)))
  throw new Error("PRODUCTION TARGET BLOCKED. Clone database/schema to isolated staging first.");
if (webUrl && !/^https:\/\//.test(webUrl))
  throw new Error("K6_WEB_URL must be an HTTPS staging origin");
if (__ENV.K6_STAGING_CONFIRMED !== "ISOLATED")
  throw new Error("Set K6_STAGING_CONFIRMED=ISOLATED to confirm staging-only testing");

const fixturePath = __ENV.K6_USERS_FILE || "../.test-artifacts/lhcc-300-users.private.json";
const users = JSON.parse(open(fixturePath));
if (!Array.isArray(users) || users.length < 300)
  throw new Error("The fixture must contain at least 300 distinct staging student sessions");
if (new Set(users.slice(0, 300).map(u => u.access_token)).size !== 300)
  throw new Error("Each of the first 300 student sessions must have a distinct access token");
if (users.slice(0, 300).some(u => !u.access_token || typeof u.access_token !== "string"))
  throw new Error("Missing student JWT in the fixture");
if (webUrl && users.slice(0, 300).some(u => !u.cookie))
  throw new Error("K6_WEB_URL needs a staging session cookie for every student");
if (mode === "submit" && users.slice(0, 300).some(u =>
  !u.attemptId || !u.answerMap || !Number.isInteger(u.expectedVersion)))
  throw new Error("Submission mode requires a separate in-progress test attempt, answerMap, expectedVersion per user");

const passed = new Rate("lhcc_success");
const rpcMs = new Trend("lhcc_rpc_ms", true);
const webMs = new Trend("lhcc_web_ms", true);

export const options = {
  scenarios: mode === "submit" ? {
    simultaneous_submissions: {
      executor: "per-vu-iterations", vus: 300, iterations: 1,
      maxDuration: "120s",
    },
  } : {
    student_browsing: {
      executor: "ramping-vus", startVUs: 0,
      stages: [
        {duration: "60s", target: 100},
        {duration: "60s", target: 300},
        {duration: "5m", target: 300},
        {duration: "30s", target: 0},
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    lhcc_success: ["rate>0.99"],
    lhcc_rpc_ms: ["p(95)<1200", "p(99)<2500"],
    ...(webUrl ? {lhcc_web_ms: ["p(95)<2500", "p(99)<4500"]} : {}),
  },
};

function rpc(user, endpoint, params) {
  const response = http.post(`${supabaseUrl}/rest/v1/rpc/${endpoint}`, JSON.stringify(params), {
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${user.access_token}`,
      "Content-Type": "application/json",
    },
    timeout: "15s",
    tags: { name: `RPC ${endpoint}` },
  });
  const ok = response.status === 200;
  passed.add(ok);
  rpcMs.add(response.timings.duration);
  check(response, { "RPC response 200": r => r.status === 200 });
}

export default function () {
  const user = users[exec.vu.idInTest - 1];
  if (!user) throw new Error("Each virtual user requires a unique test session");

  if (mode === "submit") {
    // Each attempt is submitted ONLY once, and exists in disposable staging.
    rpc(user, "submit_exam_with_answers", {
      attempt_id: user.attemptId,
      answer_map: user.answerMap,
      expected_version: user.expectedVersion,
    });
    return;
  }

  rpc(user, "learning_catalog", {});
  rpc(user, "student_medical_subject_preview", {
    target_bank_id: medBank, page_number: 0,
  });
  rpc(user, "student_missed_question_review", {
    max_questions: 3,
  });

  if (webUrl) {
    const result = http.get(`${webUrl}/student`, {
      headers: {Cookie: user.cookie},
      redirects: 0,
      timeout: "20s",
      tags: { name: "Student dashboard SSR" },
    });
    const ok = result.status === 200;
    passed.add(ok);
    webMs.add(result.timings.duration);
    check(result, {"Authenticated dashboard 200": r => r.status === 200});
  }
  sleep(1 + Math.random() * 2);
}
