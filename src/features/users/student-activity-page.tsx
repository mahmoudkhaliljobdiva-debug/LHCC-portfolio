"use client";

import { ArrowLeft, Award, BookOpen, CheckCircle2, Clock3, Eye, Target, XCircle } from "lucide-react";
import Link from "next/link";

import { useAdminQuestionBanks } from "@/features/question-banks/admin-question-bank-provider";
import { MetricCard } from "@/features/dashboard/metric-card";
import { StudentActivityCharts } from "@/features/users/student-activity-charts";
import { useUserManagement } from "@/features/users/user-management-provider";

export function StudentActivityPage({ userId }: { readonly userId: string }) {
  const users = useUserManagement();
  const banks = useAdminQuestionBanks();
  const user = users.getUserById(userId);
  const usage = users.getStudentUsage(userId);
  if (!users.isReady || !banks.isReady) return <div className="h-80 animate-pulse rounded-2xl border bg-white" aria-label="Loading student activity" />;
  if (!user || user.role !== "student") return <div className="rounded-2xl border bg-white p-8 text-center"><h1 className="text-xl font-semibold text-slate-950">Student activity not found</h1><Link href="/admin/users" className="mt-5 inline-flex rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white">Back to Users</Link></div>;

  const totals = usage.reduce((result, item) => ({ viewed: result.viewed + item.questionsViewed, answered: result.answered + item.questionsAnswered, correct: result.correct + item.correctAnswers, incorrect: result.incorrect + item.incorrectAnswers, attempts: result.attempts + item.attemptsCount }), { viewed: 0, answered: 0, correct: 0, incorrect: 0, attempts: 0 });
  const accuracy = totals.answered ? Math.round((totals.correct / totals.answered) * 100) : 0;
  const used = usage.filter((item) => item.questionsAnswered > 0).sort((a, b) => b.questionsAnswered - a.questionsAnswered);
  const bankName = (id: string) => banks.getQuestionBankById(id)?.name ?? id;
  const lastActivity = usage.map((item) => item.lastActivityAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;

  return <div><nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-2 text-xs text-slate-500"><Link href="/admin/users">Users</Link><span>/</span><span>{user.fullName}</span><span>/</span><span className="text-slate-700">Activity</span></nav><div className="mb-7"><Link href="/admin/users" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700"><ArrowLeft className="size-4" />Back to Users</Link><h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{user.fullName} activity</h1><p className="mt-2 text-sm text-slate-500">Question-bank usage calculated directly from persisted student activity records.</p></div>
    {usage.length === 0 ? <div className="rounded-2xl border border-dashed bg-white px-6 py-16 text-center"><BookOpen className="mx-auto size-9 text-slate-400" /><h2 className="mt-4 font-semibold text-slate-900">This student has not used any question banks yet.</h2></div> : <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Questions viewed" value={String(totals.viewed)} helper={`${usage.length} banks used`} icon={Eye} /><MetricCard label="Questions answered" value={String(totals.answered)} helper={`${totals.attempts} total attempts`} icon={Target} /><MetricCard label="Correct answers" value={String(totals.correct)} helper={`${accuracy}% accuracy`} icon={CheckCircle2} /><MetricCard label="Incorrect answers" value={String(totals.incorrect)} helper={lastActivity ? `Last active ${formatDate(lastActivity)}` : "No recent activity"} icon={XCircle} /></div><div className="mt-6"><StudentActivityCharts byBank={used.map((item) => ({ name: bankName(item.bankId), answered: item.questionsAnswered }))} correct={totals.correct} incorrect={totals.incorrect} /></div><section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b p-5"><h2 className="font-semibold text-slate-950">Usage by question bank</h2><div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500"><span className="flex items-center gap-1"><Award className="size-3.5" />Most used: {used[0] ? bankName(used[0].bankId) : "—"}</span><span className="flex items-center gap-1"><Clock3 className="size-3.5" />Least used: {used.at(-1) ? bankName(used.at(-1)?.bankId ?? "") : "—"}</span></div></div><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["Question bank", "Viewed", "Answered", "Correct", "Incorrect", "Accuracy", "Attempts", "Last activity"].map((item) => <th key={item} className="px-5 py-3 font-medium">{item}</th>)}</tr></thead><tbody>{used.map((item) => <tr key={item.bankId} className="border-t"><td className="px-5 py-4 font-semibold text-slate-900">{bankName(item.bankId)}</td><td className="px-5 py-4 text-slate-600">{item.questionsViewed}</td><td className="px-5 py-4 text-slate-600">{item.questionsAnswered}</td><td className="px-5 py-4 text-emerald-700">{item.correctAnswers}</td><td className="px-5 py-4 text-rose-700">{item.incorrectAnswers}</td><td className="px-5 py-4 text-slate-600">{item.questionsAnswered ? Math.round(item.correctAnswers / item.questionsAnswered * 100) : 0}%</td><td className="px-5 py-4 text-slate-600">{item.attemptsCount}</td><td className="px-5 py-4 text-slate-500">{item.lastActivityAt ? formatDate(item.lastActivityAt) : "Never"}</td></tr>)}</tbody></table></div></section></>}
  </div>;
}

function formatDate(value: string): string { return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value)); }
