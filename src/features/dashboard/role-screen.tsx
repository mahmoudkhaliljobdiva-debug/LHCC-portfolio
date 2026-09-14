import { Award, BookOpen, CircleDollarSign, Clock3, FileQuestion, GraduationCap, Target, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { PerformanceChart } from "@/components/charts/performance-chart";
import { Progress } from "@/components/ui/progress";
import { MetricCard } from "@/features/dashboard/metric-card";
import { PortfolioEditor } from "@/features/portfolio-content/portfolio-editor";
import { TeacherQuestionBankGrid } from "@/features/question-banks/teacher-question-bank-grid";
import { getDashboardData, getTeacherBankSummaries } from "@/lib/data/server";
import { getPortfolioContent } from "@/lib/portfolio/server";
import { requireRole } from "@/lib/auth/server";
import type { DashboardData, DashboardMetric } from "@/types/dashboard";
import type { UserRole } from "@/types/roles";

const sectionTitles: Record<string, string> = { "question-banks": "Question banks", questions: "Question management", exams: "Exams & assessments", analytics: "Performance analytics", profile: "Your profile", students: "Student cohorts", users: "User management", settings: "Platform settings", portfolio: "Portfolio content" };
const icons: Record<DashboardMetric["icon"], LucideIcon> = { users: Users, students: GraduationCap, banks: BookOpen, wallet: CircleDollarSign, score: Target, answers: BookOpen, attempts: Award, pending: Clock3 };

export async function RoleScreen({ role, section }: { readonly role: UserRole; readonly section: string | undefined }) {
  if (section === "portfolio" && role === "admin") {
    await requireRole("ADMIN");
    const content = await getPortfolioContent();
    return content ? <PortfolioEditor initialContent={content} /> : <RealFeatureState title="Portfolio content" message="Portfolio content has not been configured yet." />;
  }
  if (section === "exams") return <RealFeatureState title="Exams & assessments" message="Exams are not configured for this platform yet." />;
  if (section === "questions") return <RealFeatureState title="Question management" message={role === "teacher" ? "Explore published questions and learning performance by question bank." : "Manage published questions from their question bank."} href={role === "admin" ? "/admin/question-banks" : "/teacher/question-banks"} action="Open question banks" />;
  if (section === "question-banks" && role === "teacher") return <Page title="Question banks" subtitle="Published courses and learner performance."><TeacherQuestionBankGrid banks={await getTeacherBankSummaries()} /></Page>;
  if (section === "profile" || section === "settings") {
    const profile = await requireRole(role === "admin" ? "ADMIN" : role === "teacher" ? "TEACHER" : "STUDENT");
    return <ProfilePage title={section === "settings" ? "Account settings" : "Your profile"} role={role} displayName={profile.full_name} />;
  }
  const data = await getDashboardData(role);
  const title = section ? sectionTitles[section] ?? "Workspace" : role === "admin" ? "Platform overview" : `Welcome, ${data.displayName}`;

  if (section === "analytics") return <AnalyticsPage title={title} data={data} />;
  if (section === "students") return <AnalyticsPage title={title} data={data} />;
  return <DashboardHome role={role} data={data} />;
}

function Page({ title, subtitle, children }: { readonly title: string; readonly subtitle: string; readonly children: React.ReactNode }) { return <><div className="mb-7"><h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{title}</h1><p className="mt-2 text-sm text-slate-500">{subtitle}</p></div>{children}</>; }

function DashboardHome({ role, data }: { readonly role: UserRole; readonly data: DashboardData }) {
  return <Page title={role === "admin" ? "Platform overview" : `Welcome, ${data.displayName}`} subtitle="Your latest learning activity and performance.">
    <MetricGrid metrics={data.metrics} />
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_.85fr]">
      <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6"><h2 className="font-semibold text-slate-950">Performance trend</h2><p className="mt-1 text-xs text-slate-500">Average completed-attempt score by month</p><div className="mt-5">{data.scoreTrend.length ? <PerformanceChart data={data.scoreTrend} /> : <EmptyText>No completed attempts yet.</EmptyText>}</div></section>
      <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6"><h2 className="font-semibold text-slate-950">{role === "student" ? "Your bank progress" : "Question-bank activity"}</h2><p className="mt-1 text-xs text-slate-500">Calculated from recorded attempts and answers</p><div className="mt-6 grid gap-5">{data.bankProgress.length ? data.bankProgress.slice(0, 5).map((bank) => <div key={bank.id}><div className="mb-2 flex justify-between gap-3 text-sm"><span className="font-medium text-slate-700">{bank.name}</span><span className="text-slate-400">{bank.averageScore}%</span></div><Progress value={bank.totalQuestions ? Math.min(100, Math.round(bank.answered * 100 / bank.totalQuestions)) : 0} label={`${bank.answered} unique questions answered`} /></div>) : <EmptyText>No course activity yet.</EmptyText>}</div></section>
    </div>
    <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b px-5 py-4 sm:px-6"><h2 className="font-semibold text-slate-950">Recent activity</h2></div>{data.recentActivity.length ? data.recentActivity.map((item) => <div key={item.id} className="flex flex-col gap-2 border-b px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><p className="text-sm font-medium text-slate-900">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.detail}</p></div><time className="text-xs text-slate-500" dateTime={item.occurredAt}>{formatDate(item.occurredAt)}</time></div>) : <div className="px-6 py-12"><EmptyText>No activity has been recorded.</EmptyText></div>}</section>
  </Page>;
}

function AnalyticsPage({ title, data }: { readonly title: string; readonly data: DashboardData }) { return <Page title={title} subtitle="Performance reporting from completed attempts."><MetricGrid metrics={data.metrics} /><div className="mt-6 grid gap-6 xl:grid-cols-2"><section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="font-semibold text-slate-950">Score trend</h2><p className="mt-1 text-xs text-slate-500">Average performance by month</p><div className="mt-5">{data.scoreTrend.length ? <PerformanceChart data={data.scoreTrend} /> : <EmptyText>No completed attempts yet.</EmptyText>}</div></section><section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="font-semibold text-slate-950">Score distribution</h2><p className="mt-1 text-xs text-slate-500">Completed attempts grouped by score range</p><div className="mt-5"><PerformanceChart variant="histogram" data={data.scoreDistribution} /></div></section></div></Page>; }

function MetricGrid({ metrics }: { readonly metrics: readonly DashboardMetric[] }) { return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <MetricCard key={metric.label} label={metric.label} value={metric.value} helper={metric.helper} icon={icons[metric.icon]} />)}</div>; }
function ProfilePage({ title, role, displayName }: { readonly title: string; readonly role: UserRole; readonly displayName: string }) { return <Page title={title} subtitle="Your account information."><section className="max-w-2xl rounded-2xl border bg-white p-6 shadow-sm"><dl className="grid gap-5 sm:grid-cols-2"><div><dt className="text-xs font-medium text-slate-500">Full name</dt><dd className="mt-2 font-semibold text-slate-900">{displayName}</dd></div><div><dt className="text-xs font-medium text-slate-500">Role</dt><dd className="mt-2 font-semibold capitalize text-slate-900">{role}</dd></div></dl><p className="mt-6 border-t pt-5 text-sm text-slate-500">Profile changes are managed by an administrator.</p></section></Page>; }
function RealFeatureState({ title, message, href, action }: { readonly title: string; readonly message: string; readonly href?: string; readonly action?: string }) { return <Page title={title} subtitle="Your learning workspace."><section className="rounded-2xl border border-dashed bg-white px-6 py-16 text-center"><FileQuestion className="mx-auto size-9 text-slate-400" /><h2 className="mt-4 font-semibold text-slate-900">{message}</h2>{href && action && <Link href={href as Route} className="mt-5 inline-flex rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white">{action}</Link>}</section></Page>; }
function EmptyText({ children }: { readonly children: React.ReactNode }) { return <p className="py-10 text-center text-sm text-slate-500">{children}</p>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
