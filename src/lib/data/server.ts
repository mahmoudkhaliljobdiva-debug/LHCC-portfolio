import "server-only";

import { requireRole } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DashboardData, DashboardMetric, StudentActivityData } from "@/types/dashboard";
import type { UserRole as AppUserRole } from "@/types/roles";
import type { StudentBankUsage, UserUsageSummary } from "@/types/user-management";

type DbRole = "ADMIN" | "TEACHER" | "STUDENT";
type Attempt = { id: string; student_id: string; question_bank_id: string; started_at: string; submitted_at: string | null; total_questions: number; correct_answers: number; incorrect_answers: number; score_percentage: number; status: string };
type AttemptAnswer = { attempt_id: string; question_id: string; is_correct: boolean; answered_at: string };
type Bank = { id: string; name: string; description: string; status: string; display_order: number };

export interface TeacherBankSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly questionCount: number;
  readonly attempts: number;
  readonly averageScore: number;
}

export async function getDashboardData(role: AppUserRole): Promise<DashboardData> {
  const dbRole = role.toUpperCase() as DbRole;
  const profile = await requireRole(dbRole);
  const admin = createAdminClient();
  const [profilesResult, banksResult, questionsResult, attemptsResult, answersResult, requestsResult, accessResult, walletResult] = await Promise.all([
    admin.from("profiles").select("id,full_name,role,status"),
    admin.from("question_banks").select("id,name,description,status,display_order").order("display_order"),
    admin.from("bank_questions").select("id,question_bank_id,status"),
    admin.from("question_attempts").select("id,student_id,question_bank_id,started_at,submitted_at,total_questions,correct_answers,incorrect_answers,score_percentage,status"),
    admin.from("question_attempt_answers").select("attempt_id,question_id,is_correct,answered_at"),
    admin.from("user_bank_access_requests").select("id,user_id,question_bank_id,status,requested_at"),
    admin.from("user_bank_access").select("id,user_id,question_bank_id,status"),
    admin.from("wallet_transactions").select("id,name,amount,created_at"),
  ]);
  const failed = [profilesResult, banksResult, questionsResult, attemptsResult, answersResult, requestsResult, accessResult, walletResult].find((result) => result.error);
  if (failed?.error) throw new Error("Dashboard data could not be loaded.");

  const profiles = profilesResult.data ?? [];
  const banks = (banksResult.data ?? []) as Bank[];
  const questions = questionsResult.data ?? [];
  const allAttempts = (attemptsResult.data ?? []) as Attempt[];
  const allAnswers = (answersResult.data ?? []) as AttemptAnswer[];
  const attempts = role === "student" ? allAttempts.filter((item) => item.student_id === profile.id) : allAttempts;
  const attemptIds = new Set(attempts.map((item) => item.id));
  const answers = role === "student" ? allAnswers.filter((item) => attemptIds.has(item.attempt_id)) : allAnswers;
  const completed = attempts.filter((item) => item.status === "COMPLETED");
  const answerTotal = answers.length;
  const averageScore = completed.length ? Math.round(completed.reduce((sum, item) => sum + Number(item.score_percentage), 0) / completed.length) : 0;
  const activeBanks = banks.filter((bank) => bank.status === "active");
  const ownRequests = (requestsResult.data ?? []).filter((item) => role !== "student" || item.user_id === profile.id);
  const ownAccess = (accessResult.data ?? []).filter((item) => role !== "student" || item.user_id === profile.id);
  const walletBalance = (walletResult.data ?? []).reduce((sum, item) => sum + Number(item.amount), 0);
  const metrics = createMetrics(role, {
    totalUsers: profiles.filter((item) => item.role !== "ADMIN").length,
    activeStudents: profiles.filter((item) => item.role === "STUDENT" && item.status === "ACTIVE").length,
    activeTeachers: profiles.filter((item) => item.role === "TEACHER" && item.status === "ACTIVE").length,
    banks: activeBanks.length,
    questions: questions.filter((item) => item.status === "active").length,
    pending: ownRequests.filter((item) => item.status === "PENDING").length,
    approved: ownAccess.filter((item) => item.status === "ACTIVE").length,
    attempts: attempts.length,
    completedAttempts: completed.length,
    answers: answerTotal,
    averageScore,
    walletBalance,
  });

  const scoreTrend = [...groupScores(completed).entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, values]) => ({ period, score: Math.round(values.total / values.count) }));
  const scoreDistribution = [
    { range: "0–49", students: completed.filter((item) => Number(item.score_percentage) < 50).length },
    { range: "50–59", students: completed.filter((item) => inScore(item, 50, 60)).length },
    { range: "60–69", students: completed.filter((item) => inScore(item, 60, 70)).length },
    { range: "70–79", students: completed.filter((item) => inScore(item, 70, 80)).length },
    { range: "80–89", students: completed.filter((item) => inScore(item, 80, 90)).length },
    { range: "90–100", students: completed.filter((item) => inScore(item, 90, 101)).length },
  ];
  const bankProgress = activeBanks.map((bank) => {
    const bankAttempts = attempts.filter((item) => item.question_bank_id === bank.id);
    const bankAttemptIds = new Set(bankAttempts.map((item) => item.id));
    const answered = answers.filter((item) => bankAttemptIds.has(item.attempt_id)).length;
    const completedBank = bankAttempts.filter((item) => item.status === "COMPLETED");
    return { id: bank.id, name: bank.name, answered, totalQuestions: questions.filter((item) => item.question_bank_id === bank.id && item.status === "active").length, averageScore: completedBank.length ? Math.round(completedBank.reduce((sum, item) => sum + Number(item.score_percentage), 0) / completedBank.length) : 0 };
  }).filter((item) => role !== "student" || item.answered > 0 || ownAccess.some((access) => access.question_bank_id === item.id && access.status === "ACTIVE"));
  const recentActivity = attempts.slice().sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 5).map((item) => ({ id: item.id, title: banks.find((bank) => bank.id === item.question_bank_id)?.name ?? "Question bank", detail: item.status === "COMPLETED" ? `${Number(item.score_percentage).toFixed(0)}% completed attempt` : "Attempt in progress", occurredAt: item.submitted_at ?? item.started_at }));

  return { displayName: profile.full_name, metrics, scoreTrend, scoreDistribution, bankProgress, recentActivity };
}

export async function getTeacherBankSummaries(): Promise<readonly TeacherBankSummary[]> {
  await requireRole("TEACHER");
  const admin = createAdminClient();
  const [banks, questions, attempts] = await Promise.all([
    admin.from("question_banks").select("id,name,description,status,display_order").eq("status", "active").order("display_order"),
    admin.from("bank_questions").select("id,question_bank_id,status").eq("status", "active"),
    admin.from("question_attempts").select("question_bank_id,score_percentage,status"),
  ]);
  if (banks.error || questions.error || attempts.error) throw new Error("Question-bank reporting could not be loaded.");
  return banks.data.map((bank) => {
    const completed = attempts.data.filter((item) => item.question_bank_id === bank.id && item.status === "COMPLETED");
    return { id: bank.id, name: bank.name, description: bank.description, questionCount: questions.data.filter((item) => item.question_bank_id === bank.id).length, attempts: completed.length, averageScore: completed.length ? Math.round(completed.reduce((sum, item) => sum + Number(item.score_percentage), 0) / completed.length) : 0 };
  });
}

export async function getAdminUserUsageSummaries(): Promise<readonly UserUsageSummary[]> {
  await requireRole("ADMIN");
  const admin = createAdminClient();
  const { data, error } = await admin.from("question_attempts").select("student_id,correct_answers,incorrect_answers,started_at");
  if (error) throw new Error("User usage could not be loaded.");
  const groups = new Map<string, { correct: number; incorrect: number; attempts: number; last: string | null }>();
  for (const item of data) {
    const group = groups.get(item.student_id) ?? { correct: 0, incorrect: 0, attempts: 0, last: null };
    group.correct += item.correct_answers; group.incorrect += item.incorrect_answers; group.attempts += 1;
    group.last = !group.last || item.started_at > group.last ? item.started_at : group.last;
    groups.set(item.student_id, group);
  }
  return [...groups.entries()].map(([studentId, item]) => ({ studentId, questionsAnswered: item.correct + item.incorrect, attemptsCount: item.attempts, accuracy: item.correct + item.incorrect ? Math.round(item.correct * 100 / (item.correct + item.incorrect)) : 0, lastActivityAt: item.last }));
}

export async function getStudentActivityData(userId: string): Promise<StudentActivityData> {
  await requireRole("ADMIN");
  const admin = createAdminClient();
  const [profileResult, authResult, banksResult, attemptsResult, answersResult] = await Promise.all([
    admin.from("profiles").select("id,full_name,role").eq("id", userId).maybeSingle(),
    admin.auth.admin.getUserById(userId),
    admin.from("question_banks").select("id,name"),
    admin.from("question_attempts").select("id,student_id,question_bank_id,started_at,correct_answers,incorrect_answers,status").eq("student_id", userId),
    admin.from("question_attempt_answers").select("attempt_id,is_correct,answered_at"),
  ]);
  if (profileResult.error || banksResult.error || attemptsResult.error || answersResult.error) throw new Error("Student activity could not be loaded.");
  const profile = profileResult.data;
  const email = authResult.data.user?.email;
  if (!profile || profile.role !== "STUDENT" || !email) return { student: null, usage: [], bankNames: {} };
  const answers = answersResult.data as AttemptAnswer[];
  const usage: StudentBankUsage[] = banksResult.data.map((bank) => {
    const bankAttempts = attemptsResult.data.filter((attempt) => attempt.question_bank_id === bank.id);
    const ids = new Set(bankAttempts.map((attempt) => attempt.id));
    const bankAnswers = answers.filter((answer) => ids.has(answer.attempt_id));
    return { studentId: userId, bankId: bank.id, questionsAnswered: bankAnswers.length, correctAnswers: bankAnswers.filter((answer) => answer.is_correct).length, incorrectAnswers: bankAnswers.filter((answer) => !answer.is_correct).length, attemptsCount: bankAttempts.length, lastActivityAt: bankAnswers.map((answer) => answer.answered_at).sort().at(-1) ?? bankAttempts.map((attempt) => attempt.started_at).sort().at(-1) ?? null };
  }).filter((item) => item.attemptsCount > 0);
  return { student: { id: profile.id, fullName: profile.full_name, email }, usage, bankNames: Object.fromEntries(banksResult.data.map((bank) => [bank.id, bank.name])) };
}

function groupScores(attempts: readonly Attempt[]) {
  const groups = new Map<string, { total: number; count: number }>();
  for (const attempt of attempts) { const period = attempt.started_at.slice(0, 7); const value = groups.get(period) ?? { total: 0, count: 0 }; value.total += Number(attempt.score_percentage); value.count += 1; groups.set(period, value); }
  return groups;
}
function inScore(attempt: Attempt, min: number, max: number) { const score = Number(attempt.score_percentage); return score >= min && score < max; }
function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value); }

function createMetrics(role: AppUserRole, value: { totalUsers: number; activeStudents: number; activeTeachers: number; banks: number; questions: number; pending: number; approved: number; attempts: number; completedAttempts: number; answers: number; averageScore: number; walletBalance: number }): readonly DashboardMetric[] {
  if (role === "student") return [
    { label: "Average score", value: `${value.averageScore}%`, helper: "Completed attempts", icon: "score" },
    { label: "Questions answered", value: String(value.answers), helper: "Persisted answers", icon: "answers" },
    { label: "Attempts", value: String(value.attempts), helper: "Across all banks", icon: "attempts" },
    { label: "Approved banks", value: String(value.approved), helper: `${value.pending} pending · ${Math.max(0, value.banks - value.approved - value.pending)} locked`, icon: "banks" },
  ];
  if (role === "teacher") return [
    { label: "Active students", value: String(value.activeStudents), helper: "Enabled learner accounts", icon: "students" },
    { label: "Average score", value: `${value.averageScore}%`, helper: "Completed attempts", icon: "score" },
    { label: "Completed attempts", value: String(value.completedAttempts), helper: `${value.answers} answers recorded`, icon: "attempts" },
    { label: "Published questions", value: String(value.questions), helper: `${value.banks} active banks`, icon: "banks" },
  ];
  return [
    { label: "Managed users", value: String(value.totalUsers), helper: `${value.activeStudents} active students`, icon: "users" },
    { label: "Active teachers", value: String(value.activeTeachers), helper: "Enabled educator accounts", icon: "students" },
    { label: "Question banks", value: String(value.banks), helper: `${value.questions} published questions`, icon: "banks" },
    { label: "Wallet balance", value: money(value.walletBalance), helper: `${value.pending} access requests pending`, icon: "wallet" },
  ];
}
