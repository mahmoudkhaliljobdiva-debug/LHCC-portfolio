import assert from "node:assert/strict";
import test from "node:test";
import { readAllRows } from "../src/lib/supabase/pagination.ts";
import { getScoreReporting, getUniqueQuestionCount, sortRecentActivity } from "../src/utils/dashboard-reporting.ts";
import { getWalletSummary, getWalletChartData } from "../src/utils/wallet-analytics.ts";

test("pagination reads beyond API caps, including caps below requested size", async () => {
  const records = Array.from({ length: 1201 }, (_, id) => ({ id }));
  const actual = await readAllRows(async (from, to) => ({ data: records.slice(from, Math.min(to + 1, from + 100)), error: null }));
  assert.deepEqual(actual, records);
});

test("a later query failure cannot silently return a partial total", async () => {
  await assert.rejects(readAllRows(async (from) => from === 0
    ? { data: [{ id: 1 }], error: null }
    : { data: null, error: { message: "Database unavailable" } }), /Unable to load records/);
  assert.deepEqual(await readAllRows(async () => ({ data: [], error: null })), []);
});

test("empty analytics contains zero counts and no invented trend", () => {
  const report = getScoreReporting([]);
  assert.equal(report.averageScore, 0);
  assert.deepEqual(report.scoreTrend, []);
  assert(report.scoreDistribution.every((bin) => bin.students === 0));
});

test("analytics groups by completion month and includes score boundaries once", () => {
  const attempts = [0, 49, 50, 59, 60, 69, 70, 79, 80, 89, 90, 100].map((score_percentage) => ({
    score_percentage, started_at: "2026-08-31T23:00:00Z", submitted_at: "2026-09-01T00:00:00Z",
  }));
  const report = getScoreReporting(attempts);
  assert.equal(report.scoreDistribution.reduce((sum, bin) => sum + bin.students, 0), attempts.length);
  assert(report.scoreDistribution.every((bin) => bin.students === 2));
  assert.equal(report.scoreTrend[0].period, "2026-09");
  assert.equal(report.averageScore, Math.round(attempts.reduce((sum, item) => sum + item.score_percentage, 0) / attempts.length));
});

test("progress counts unique currently published questions across retries", () => {
  assert.equal(getUniqueQuestionCount([{ question_id: "a" }, { question_id: "a" }, { question_id: "removed" }], [{ id: "a" }, { id: "b" }]), 1);
});

test("recent activity is ordered by event time across event types", () => {
  const events = [
    { id: "attempt:1", title: "Bank", detail: "Completed", occurredAt: "2026-09-03T00:00:00Z" },
    { id: "request:1", title: "Bank", detail: "Requested", occurredAt: "2026-09-01T00:00:00Z" },
    { id: "review:1", title: "Bank", detail: "Approved", occurredAt: "2026-09-02T00:00:00Z" },
  ];
  assert.deepEqual(sortRecentActivity(events).map((event) => event.id), ["attempt:1", "review:1", "request:1"]);
});

test("wallet totals and charts use only the supplied ledger", () => {
  assert.equal(getWalletSummary([]).currentBalance, 0);
  assert.deepEqual(getWalletChartData([]), []);
  const ledger = [
    { type: "bank_sale", amount: 25, transactionDate: "2026-09-01" },
    { type: "manual_expense", amount: -5, transactionDate: "2026-09-02" },
    { type: "refund", amount: -10, transactionDate: "2026-09-03" },
  ];
  assert.equal(getWalletSummary(ledger).currentBalance, 10);
  assert.deepEqual(getWalletChartData(ledger), [{ period: "2026-09", earned: 25, spent: 15 }]);
});
