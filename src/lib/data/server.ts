import "server-only";

import { requireRole } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { readAllRows } from "@/lib/supabase/pagination";
import { getAdminWalletTransactions } from "@/lib/wallet/server";
import type { Database } from "@/lib/supabase/database.types";
import type { DashboardData, DashboardMetric, StudentActivityData } from "@/types/dashboard";
import type { UserRole as AppUserRole } from "@/types/roles";
import type { StudentBankUsage, UserUsageSummary } from "@/types/user-management";
import { getScoreReporting, getUniqueQuestionCount, sortRecentActivity } from "@/utils/dashboard-reporting";
import { getWalletSummary } from "@/utils/wallet-analytics";

type DbRole = Database["public"]["Enums"]["user_role"];
type Activity = DashboardData["recentActivity"][number];
const dbRoles: Record<AppUserRole, DbRole> = { admin: "ADMIN", teacher: "TEACHER", student: "STUDENT" };
const attemptFields = "id,student_id,question_bank_id,started_at,submitted_at,total_questions,correct_answers,incorrect_answers,score_percentage,status,updated_at";

export interface TeacherBankSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly questionCount: number;
  readonly attempts: number;
  readonly averageScore: number;
}

export async function getDashboardData(role: AppUserRole): Promise<DashboardData> {
  const profile = await requireRole(dbRoles[role]);
  const db = await createClient();
  // Learning queries use the caller's session and RLS. Only verified admins
  // request the profile directory (own-profile RLS) or the guarded wallet RPC.
  const [profiles, banks, questions, attempts, answers, requests, access, wallet, portfolio] = await Promise.all([
    role === "admin" ? readAllRows((from, to) => createAdminClient().from("profiles").select("id,full_name,role,status,expiration_date,created_at").order("id").range(from, to)) : [],
    readAllRows((from, to) => db.from("question_banks").select("id,name,description,status,display_order").order("display_order").order("id").range(from, to)),
    readAllRows((from, to) => db.from("bank_questions").select("id,question_bank_id,status").order("id").range(from, to)),
    readAllRows((from, to) => {
      const query = db.from("question_attempts").select(attemptFields).order("id");
      return (role === "student" ? query.eq("student_id", profile.id) : query).range(from, to);
    }),
    readAllRows((from, to) => db.from("question_attempt_answers").select("attempt_id,question_id,is_correct,answered_at").order("id").range(from, to)),
    role === "teacher" ? [] : readAllRows((from, to) => db.from("user_bank_access_requests").select("id,user_id,question_bank_id,status,requested_at,reviewed_at").order("id").range(from, to)),
    role === "teacher" ? [] : readAllRows((from, to) => db.from("user_bank_access").select("id,user_id,question_bank_id,status").order("id").range(from, to)),
    role === "admin" ? getAdminWalletTransactions() : [],
    role === "admin" ? readAllRows((from, to) => db.from("portfolio_content").select("section_key,revision,updated_at").order("section_key").range(from, to)) : [],
  ]);
  const completed = attempts.filter((item) => item.status === "COMPLETED");
  const reporting = getScoreReporting(completed);
  const activeBanks = banks.filter((bank) => bank.status === "active");
  const activeBankIds = new Set(activeBanks.map((bank) => bank.id));
  const approvedBankIds = new Set(access.filter((item) => item.status === "ACTIVE" && activeBankIds.has(item.question_bank_id)).map((item) => item.question_bank_id));
  const pendingBankIds = new Set(requests.filter((item) => item.status === "PENDING" && activeBankIds.has(item.question_bank_id) && !approvedBankIds.has(item.question_bank_id)).map((item) => item.question_bank_id));
  const metrics = createMetrics(role, {
    totalUsers: profiles.filter((item) => item.role !== "ADMIN").length,
    activeStudents: profiles.filter((item) => item.role === "STUDENT" && item.status === "ACTIVE").length,
    activeTeachers: profiles.filter((item) => item.role === "TEACHER" && item.status === "ACTIVE" && item.expiration_date && Date.parse(item.expiration_date) > Date.now()).length,
    participatingStudents: new Set(attempts.map((item) => item.student_id)).size,
    banks: activeBanks.length,
    questions: questions.filter((item) => item.status === "active").length,
    pending: role === "student" ? pendingBankIds.size : requests.filter((item) => item.status === "PENDING").length,
    approved: approvedBankIds.size,
    attempts: attempts.length,
    completedAttempts: completed.length,
    answers: answers.length,
    averageScore: reporting.averageScore,
    walletBalance: getWalletSummary(wallet).currentBalance,
  });

  const bankProgress = activeBanks.map((bank) => {
    const bankAttempts = attempts.filter((item) => item.question_bank_id === bank.id);
    const ids = new Set(bankAttempts.map((item) => item.id));
    const activeQuestions = questions.filter((item) => item.question_bank_id === bank.id && item.status === "active");
    const bankAnswers = answers.filter((item) => ids.has(item.attempt_id));
    return {
      id: bank.id, name: bank.name,
      answered: getUniqueQuestionCount(bankAnswers, activeQuestions),
      totalQuestions: activeQuestions.length,
      averageScore: getScoreReporting(bankAttempts.filter((item) => item.status === "COMPLETED")).averageScore,
    };
  }).filter((item) => role !== "student" || item.answered > 0 || approvedBankIds.has(item.id));

  const bankName = (id: string) => banks.find((bank) => bank.id === id)?.name ?? "Question bank";
  const activity: Activity[] = attempts.map((item) => ({ id: "attempt:" + item.id, title: bankName(item.question_bank_id), detail: item.status === "COMPLETED" ? Number(item.score_percentage).toFixed(0) + "% completed attempt" : "Attempt in progress", occurredAt: item.submitted_at ?? item.updated_at }));
  for (const item of requests) {
    activity.push({ id: "request:" + item.id, title: bankName(item.question_bank_id), detail: "Access requested", occurredAt: item.requested_at });
    if (item.reviewed_at) activity.push({ id: "review:" + item.id, title: bankName(item.question_bank_id), detail: item.status === "APPROVED" ? "Access approved" : "Access rejected", occurredAt: item.reviewed_at });
  }
  for (const item of wallet) activity.push({ id: "wallet:" + item.id, title: item.name, detail: "Wallet transaction recorded", occurredAt: item.createdAt });
  for (const item of profiles) activity.push({ id: "profile:" + item.id, title: item.full_name, detail: "Account created", occurredAt: item.created_at });
  for (const item of portfolio.filter((item) => item.revision > 1)) activity.push({ id: "portfolio:" + item.section_key, title: item.section_key + " page", detail: "Portfolio content updated", occurredAt: item.updated_at });
  return { displayName: profile.full_name, metrics, scoreTrend: reporting.scoreTrend, scoreDistribution: reporting.scoreDistribution, bankProgress, recentActivity: sortRecentActivity(activity) };
}

export async function getTeacherBankSummaries(): Promise<readonly TeacherBankSummary[]> {
  await requireRole("TEACHER");
  const db = await createClient();
  const [banks, questions, attempts] = await Promise.all([
    readAllRows((from, to) => db.from("question_banks").select("id,name,description").eq("status", "active").order("display_order").order("id").range(from, to)),
    readAllRows((from, to) => db.from("bank_questions").select("id,question_bank_id").eq("status", "active").order("id").range(from, to)),
    readAllRows((from, to) => db.from("question_attempts").select("question_bank_id,score_percentage,started_at,submitted_at").eq("status", "COMPLETED").order("id").range(from, to)),
  ]);
  return banks.map((bank) => {
    const completed = attempts.filter((item) => item.question_bank_id === bank.id);
    return { id: bank.id, name: bank.name, description: bank.description, questionCount: questions.filter((item) => item.question_bank_id === bank.id).length, attempts: completed.length, averageScore: getScoreReporting(completed).averageScore };
  });
}

export async function getAdminUserUsageSummaries(): Promise<readonly UserUsageSummary[]> {
  await requireRole("ADMIN");
  const db = await createClient();
  const data = await readAllRows((from, to) => db.from("question_attempts").select("student_id,correct_answers,incorrect_answers,updated_at").order("id").range(from, to));
  const groups = new Map<string, { correct: number; incorrect: number; attempts: number; last: string | null }>();
  for (const item of data) {
    const group = groups.get(item.student_id) ?? { correct: 0, incorrect: 0, attempts: 0, last: null };
    group.correct += item.correct_answers; group.incorrect += item.incorrect_answers; group.attempts += 1;
    group.last = !group.last || item.updated_at > group.last ? item.updated_at : group.last;
    groups.set(item.student_id, group);
  }
  return [...groups.entries()].map(([studentId, item]) => ({ studentId, questionsAnswered: item.correct + item.incorrect, attemptsCount: item.attempts, accuracy: item.correct + item.incorrect ? Math.round(item.correct * 100 / (item.correct + item.incorrect)) : 0, lastActivityAt: item.last }));
}

export async function getStudentActivityData(userId: string): Promise<StudentActivityData> {
  await requireRole("ADMIN");
  const admin = createAdminClient();
  const db = await createClient();
  const [profileResult, authResult, banks, attempts] = await Promise.all([
    admin.from("profiles").select("id,full_name,role").eq("id", userId).maybeSingle(),
    admin.auth.admin.getUserById(userId),
    readAllRows((from, to) => db.from("question_banks").select("id,name").order("id").range(from, to)),
    readAllRows((from, to) => db.from("question_attempts").select(attemptFields).eq("student_id", userId).order("id").range(from, to)),
  ]);
  if (profileResult.error || (authResult.error && authResult.error.status !== 404)) throw new Error("Student activity could not be loaded.");
  const profile = profileResult.data;
  if (!profile || profile.role !== "STUDENT") return { student: null, usage: [], bankNames: {} };
  const usage: StudentBankUsage[] = banks.map((bank) => {
    const bankAttempts = attempts.filter((attempt) => attempt.question_bank_id === bank.id);
    const correct = bankAttempts.reduce((sum, item) => sum + item.correct_answers, 0);
    const incorrect = bankAttempts.reduce((sum, item) => sum + item.incorrect_answers, 0);
    return { studentId: userId, bankId: bank.id, questionsAnswered: correct + incorrect, correctAnswers: correct, incorrectAnswers: incorrect, attemptsCount: bankAttempts.length, lastActivityAt: bankAttempts.map((attempt) => attempt.updated_at).sort().at(-1) ?? null };
  }).filter((item) => item.attemptsCount > 0);
  return { student: { id: profile.id, fullName: profile.full_name, email: authResult.data.user?.email ?? "" }, usage, bankNames: Object.fromEntries(banks.map((bank) => [bank.id, bank.name])) };
}

function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value); }

function createMetrics(role: AppUserRole, value: { totalUsers: number; activeStudents: number; activeTeachers: number; participatingStudents: number; banks: number; questions: number; pending: number; approved: number; attempts: number; completedAttempts: number; answers: number; averageScore: number; walletBalance: number }): readonly DashboardMetric[] {
  if (role === "student") return [
    { label: "Average score", value: `${value.averageScore}%`, helper: "Completed attempts", icon: "score" },
    { label: "Questions answered", value: String(value.answers), helper: "Recorded answers", icon: "answers" },
    { label: "Attempts", value: String(value.attempts), helper: "Across all banks", icon: "attempts" },
    { label: "Approved banks", value: String(value.approved), helper: `${value.pending} pending · ${Math.max(0, value.banks - value.approved - value.pending)} locked`, icon: "banks" },
  ];
  if (role === "teacher") return [
    { label: "Participating students", value: String(value.participatingStudents), helper: "Learners with recorded attempts", icon: "students" },
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
