import {
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileQuestion,
  GraduationCap,
  Settings,
  Target,
  TrendingUp,
  UserCircle,
  Users,
} from "lucide-react";

import { PerformanceChart } from "@/components/charts/performance-chart";
import { Progress } from "@/components/ui/progress";
import { QUESTION_BANKS } from "@/data/question-banks.mock";
import { WALLET_SUMMARY, WALLET_TRANSACTIONS } from "@/data/wallet.mock";
import { MetricCard } from "@/features/dashboard/metric-card";
import { QuestionBankGrid } from "@/features/question-banks/question-bank-grid";
import { PortfolioEditor } from "@/features/portfolio-content/portfolio-editor";
import type { UserRole } from "@/types/roles";

const roleCopy = {
  student: { title: "Good morning, Maya", subtitle: "Here’s where your learning stands today." },
  teacher: { title: "Good morning, Dr. Harris", subtitle: "Your cohorts are making steady progress." },
  admin: { title: "Platform overview", subtitle: "Monitor learning activity and operational health." },
} as const;

const sectionTitles: Record<string, string> = {
  "question-banks": "Question banks",
  questions: "Question management",
  exams: "Exams & assessments",
  wallet: "Learning wallet",
  analytics: "Performance analytics",
  profile: "Your profile",
  students: "Student cohorts",
  users: "User management",
  reports: "Reports",
  settings: "Platform settings",
  portfolio: "Portfolio content",
};

export function RoleScreen({
  role,
  section,
}: {
  readonly role: UserRole;
  readonly section: string | undefined;
}) {
  const title = section ? sectionTitles[section] ?? "Workspace" : roleCopy[role].title;

  if (section === "wallet" && role !== "admin") {
    return <DashboardHome role={role} />;
  }

  if (section === "question-banks") {
    return <Page title={title} subtitle="Browse, manage, and monitor structured learning collections."><QuestionBankGrid /></Page>;
  }

  if (section === "portfolio" && role === "admin") return <PortfolioEditor />;

  if (section === "wallet") return <WalletPage />;
  if (section === "analytics" || section === "reports") return <AnalyticsPage title={title} />;
  if (section === "settings" || section === "profile") return <SettingsPage title={title} section={section} />;
  if (section === "questions" || section === "exams" || section === "students" || section === "users") {
    return <ManagementPage title={title} section={section} />;
  }

  return <DashboardHome role={role} />;
}

function Page({ title, subtitle, children }: { readonly title: string; readonly subtitle: string; readonly children: React.ReactNode }) {
  return (
    <>
      <div className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
      </div>
      {children}
    </>
  );
}

function DashboardHome({ role }: { readonly role: UserRole }) {
  const metrics = role === "student"
    ? [
        ["Average score", "84%", "+6% this month", Target],
        ["Questions answered", "1,441", "72% of study plan", BookOpen],
        ["Study time", "42h", "6.2 hours this week", Clock3],
        ["Study streak", "12 days", "Personal best", Award],
      ] as const
    : role === "teacher"
      ? [
          ["Active students", "128", "+8 this month", Users],
          ["Average score", "78%", "+4% this term", TrendingUp],
          ["Assignments", "16", "5 currently active", FileQuestion],
          ["Completion rate", "86%", "Across all cohorts", CheckCircle2],
        ] as const
      : [
          ["Total users", "2,840", "+124 this month", Users],
          ["Active learners", "1,986", "70% monthly active", GraduationCap],
          ["Question banks", "6", "2,730 questions", BookOpen],
          ["Credits issued", "84.2K", "+9% this month", CircleDollarSign],
        ] as const;

  return (
    <Page title={roleCopy[role].title} subtitle={roleCopy[role].subtitle}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, helper, icon]) => <MetricCard key={label} label={label} value={value} helper={helper} icon={icon} />)}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_.85fr]">
        <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between">
            <div><h2 className="font-semibold text-slate-950">Performance trend</h2><p className="mt-1 text-xs text-slate-500">Average score over six months</p></div>
            <span className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">Last 6 months</span>
          </div>
          <div className="mt-5"><PerformanceChart /></div>
        </section>
        <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
          <h2 className="font-semibold text-slate-950">{role === "student" ? "Your study plan" : "Recent activity"}</h2>
          <p className="mt-1 text-xs text-slate-500">Priority items for today</p>
          <div className="mt-6 grid gap-5">
            {QUESTION_BANKS.slice(0, 3).map((bank) => (
              <div key={bank.id}>
                <div className="mb-2 flex justify-between text-sm"><span className="font-medium text-slate-700">{bank.title}</span><span className="text-slate-400">{bank.averageScore}%</span></div>
                <Progress value={Math.round((bank.completedCount / bank.questionCount) * 100)} label={`${bank.completedCount} completed`} />
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4 sm:px-6"><h2 className="font-semibold text-slate-950">Upcoming schedule</h2></div>
        {[
          ["Cardiovascular systems exam", "Tomorrow · 10:00 AM", "Exam"],
          ["Pharmacology review session", "Thursday · 2:30 PM", "Live session"],
          ["Pathology assignment due", "Friday · 11:59 PM", "Assignment"],
        ].map(([item, time, type]) => (
          <div key={item} className="flex flex-col gap-3 border-b px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:px-6">
            <span className="grid size-10 place-items-center rounded-xl bg-slate-50 text-slate-600"><CalendarDays className="size-[18px]" /></span>
            <div className="flex-1"><p className="text-sm font-medium text-slate-900">{item}</p><p className="mt-1 text-xs text-slate-500">{time}</p></div>
            <span className="w-fit rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">{type}</span>
          </div>
        ))}
      </section>
    </Page>
  );
}

function WalletPage() {
  return (
    <Page title="Learning wallet" subtitle="Monitor and administer virtual learning credits across the platform.">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Current balance" value={WALLET_SUMMARY.balance.toLocaleString()} helper="Available learning credits" icon={CircleDollarSign} />
        <MetricCard label="Total rewards" value={`+${WALLET_SUMMARY.rewards}`} helper="Credits earned this term" icon={Award} />
        <MetricCard label="Total losses" value={`-${WALLET_SUMMARY.losses}`} helper="Learning challenge adjustments" icon={TrendingUp} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_.85fr]">
        <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="font-semibold text-slate-950">Balance trend</h2><p className="mt-1 text-xs text-slate-500">Virtual credits over six months</p><div className="mt-5"><PerformanceChart variant="wallet" /></div></section>
        <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="font-semibold text-slate-950">Recent transactions</h2><div className="mt-5 grid gap-1">{WALLET_TRANSACTIONS.map((item) => <div key={item.id} className="flex items-center gap-3 border-b py-4 last:border-0"><span className="grid size-9 place-items-center rounded-full bg-slate-50"><CircleDollarSign className="size-4 text-teal-700" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{item.description}</p><p className="text-xs text-slate-400">Learning activity</p></div><span className={`text-sm font-semibold ${item.credits > 0 ? "text-emerald-700" : "text-rose-700"}`}>{item.credits > 0 ? "+" : ""}{item.credits}</span></div>)}</div></section>
      </div>
    </Page>
  );
}

function AnalyticsPage({ title }: { readonly title: string }) {
  return (
    <Page title={title} subtitle="Understand performance patterns with clear, actionable reporting.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Average score" value="84%" helper="+6% over previous period" icon={Target} />
        <MetricCard label="Completion" value="86%" helper="+3% over previous period" icon={CheckCircle2} />
        <MetricCard label="Study time" value="42h" helper="6.2 hours this week" icon={Clock3} />
        <MetricCard label="Credits earned" value="780" helper="+8% over previous period" icon={Award} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="font-semibold text-slate-950">Score trend</h2><p className="mt-1 text-xs text-slate-500">Average performance by month</p><div className="mt-5"><PerformanceChart /></div></section>
        <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="font-semibold text-slate-950">Score distribution</h2><p className="mt-1 text-xs text-slate-500">Learners grouped by score range</p><div className="mt-5"><PerformanceChart variant="histogram" /></div></section>
      </div>
    </Page>
  );
}

function ManagementPage({ title, section }: { readonly title: string; readonly section: string }) {
  const labels = section === "users" || section === "students" ? ["Maya Carter", "Noah Williams", "Sophia Lee", "Ethan Walker", "Amelia Clark"] : section === "questions" ? ["Cardiac output regulation", "Renal acid-base balance", "Antimicrobial resistance", "Cellular adaptation", "Brachial plexus anatomy"] : ["Cardiovascular systems", "Clinical pharmacology", "General pathology", "Integrated medicine", "Medical microbiology"];
  return (
    <Page title={title} subtitle="A structured overview with reusable management controls.">
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-slate-950">All {title.toLowerCase()}</h2><p className="mt-1 text-xs text-slate-500">Mock records for demonstration</p></div><button className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white">Create new</button></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-6 py-3 font-medium">Name</th><th className="px-6 py-3 font-medium">Status</th><th className="px-6 py-3 font-medium">Progress</th><th className="px-6 py-3 font-medium">Updated</th></tr></thead>
            <tbody>{labels.map((label, index) => <tr key={label} className="border-t"><td className="px-6 py-4 font-medium text-slate-900">{label}</td><td className="px-6 py-4"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{index === 3 ? "Draft" : "Active"}</span></td><td className="px-6 py-4 text-slate-600">{72 + index * 3}%</td><td className="px-6 py-4 text-slate-500">{index + 1} day{index ? "s" : ""} ago</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </Page>
  );
}

function SettingsPage({ title, section }: { readonly title: string; readonly section: string }) {
  return (
    <Page title={title} subtitle={section === "profile" ? "Manage your personal demo preferences." : "Configure the frontend demonstration experience."}>
      <div className="grid gap-6 lg:grid-cols-[.75fr_1.25fr]">
        <aside className="h-fit rounded-2xl border bg-white p-3 shadow-sm">{["General information", "Notifications", "Appearance", "Privacy"].map((item, index) => <button key={item} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium ${index === 0 ? "bg-teal-50 text-teal-800" : "text-slate-600"}`}><Settings className="size-4" />{item}</button>)}</aside>
        <section className="rounded-2xl border bg-white p-6 shadow-sm"><div className="flex items-center gap-4 border-b pb-6"><span className="grid size-14 place-items-center rounded-2xl bg-teal-700 text-white"><UserCircle /></span><div><h2 className="font-semibold text-slate-950">General information</h2><p className="mt-1 text-xs text-slate-500">This data is for demonstration only.</p></div></div><div className="mt-6 grid gap-5 sm:grid-cols-2">{["Full name", "Email address", "Institution", "Role"].map((label) => <label key={label} className="grid gap-2 text-sm font-medium text-slate-700">{label}<input className="h-11 rounded-xl border bg-slate-50 px-3 text-slate-700" defaultValue={label === "Role" ? "Student" : label === "Institution" ? "L.H.C.C Academy" : label === "Email address" ? "maya@example.edu" : "Maya Carter"} /></label>)}</div><button className="mt-7 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white">Save changes</button></section>
      </div>
    </Page>
  );
}
