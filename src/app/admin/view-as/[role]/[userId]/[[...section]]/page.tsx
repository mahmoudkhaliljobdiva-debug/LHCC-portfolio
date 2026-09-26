import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { AnalyticsPage, DashboardHome } from "@/features/dashboard/role-screen";
import { ContextBoundaryLink } from "@/features/portal-preview/context-boundary-link";
import { CourseQuestions } from "@/features/question-banks/course-questions";
import { QuestionBankGrid } from "@/features/question-banks/question-bank-grid";
import { TeacherQuestionBankGrid } from "@/features/question-banks/teacher-question-bank-grid";
import { getStudentBanksForAdmin, getStudentCourseForAdmin } from "@/lib/bank-access/server";
import { getDashboardDataForAdmin, getTeacherBankSummariesForAdmin } from "@/lib/data/server";
import { getEffectiveProfileStatus } from "@/lib/auth/server";
import { getPortalPreviewContext, parsePreviewRole } from "@/lib/portal-preview/server";

export default async function PortalPreview({ params }: { readonly params: Promise<{ role: string; userId: string; section?: string[] }> }) {
  const values = await params;
  const role = parsePreviewRole(values.role);
  const context = await getPortalPreviewContext(role, values.userId);
  const base = `/admin/view-as/${role}/${context.subject.id}`;
  const section = values.section?.[0] ?? "dashboard";
  const label = role === "student" ? "Student" : "Teacher";
  const sections = role === "student" ? ["dashboard", "question-banks", "exams", "analytics", "profile"] : ["dashboard", "questions", "question-banks", "exams", "students", "analytics"];
  if (!sections.includes(section) && !(role === "student" && section === "banks" && values.section?.length === 2)) notFound();
  if (section !== "banks" && (values.section?.length ?? 0) > 1) notFound();
  const status = await getEffectiveProfileStatus(context.subject);
  let content: React.ReactNode;
  if (status !== "ACTIVE") {
    content = <p className="rounded-2xl border bg-white p-6 text-slate-600">This account is {status.toLowerCase()}. Its normal portal is unavailable. No learning actions are available.</p>;
  } else if (section === "question-banks" || section === "questions") {
    content = role === "student" ? <QuestionBankGrid banks={await getStudentBanksForAdmin(context.subject.id)} previewBase={base} /> : <TeacherQuestionBankGrid banks={await getTeacherBankSummariesForAdmin(context.subject.id)} />;
  } else if (section === "banks") {
    const course = await getStudentCourseForAdmin(context.subject.id, values.section![1]!);
    content = course ? <><h1 className="mb-6 text-2xl font-semibold text-slate-950">{course.bank.name}</h1><CourseQuestions questions={course.questions} recordedAnswers={course.recordedAnswers} readOnly /></> : <p className="rounded-2xl border bg-white p-6 text-slate-600">This course is unavailable to the selected student.</p>;
  } else if (section === "profile") {
    content = <section className="rounded-2xl border bg-white p-6"><h1 className="text-2xl font-semibold text-slate-950">Your profile</h1><dl className="mt-5 grid gap-4 text-sm text-slate-700"><div><dt>Full name</dt><dd className="font-semibold">{context.subject.full_name}</dd></div><div><dt>Email</dt><dd>{context.email}</dd></div><div><dt>Role</dt><dd>{context.subject.role}</dd></div></dl></section>;
  } else if (section === "exams") {
    content = <p className="rounded-2xl border bg-white p-6 text-slate-600">Exams are not configured for this platform yet.</p>;
  } else {
    const data = await getDashboardDataForAdmin(role, context.subject.id);
    content = section === "dashboard" ? <><DashboardHome role={role} data={data} />{role === "student" && <section className="mt-7"><h2 className="mb-4 text-xl font-semibold text-slate-950">Explore courses</h2><QuestionBankGrid banks={await getStudentBanksForAdmin(context.subject.id)} previewBase={base} /></section>}</> : <AnalyticsPage title={section === "students" ? "Student cohorts" : "Performance analytics"} data={data} />;
  }
  return <>
    <section aria-label="View-as mode" className="sticky top-[72px] z-10 mb-6 rounded-2xl border border-teal-200 bg-teal-50 p-4 shadow-sm dark:border-teal-800 dark:bg-slate-900 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="text-sm font-semibold text-teal-800 dark:text-teal-200">{label} Portal · Read-only</p><p className="mt-1 break-words font-semibold text-slate-950">Viewing: {context.subject.full_name}</p><p className="break-all text-sm text-slate-600">{context.email}</p><p className="mt-2 text-xs text-slate-600">Signed in as {context.actor.full_name} — Administrator</p></div><div className="flex flex-wrap gap-2"><ContextBoundaryLink href={`/admin/users?role=${role === "student" ? "STUDENT" : "TEACHER"}`} className="rounded-xl border bg-white px-4 py-3 text-sm font-semibold text-slate-700">Back to {role === "student" ? "Students" : "Teachers"}</ContextBoundaryLink><ContextBoundaryLink href="/admin" className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white">Exit View</ContextBoundaryLink><ContextBoundaryLink href="/" className="rounded-xl border bg-white px-4 py-3 text-sm font-semibold text-slate-700">Back to Website</ContextBoundaryLink></div></div>
      <p className="mt-3 text-xs text-slate-600">Inspection only. Personal requests, answers, and submissions are disabled. Use Admin navigation for management.</p>
      <nav aria-label="Preview portal navigation" className="mt-4 flex flex-wrap gap-2">{sections.map(item => <Link prefetch={false} aria-current={section === item ? "page" : undefined} key={item} href={`${base}/${item === "dashboard" ? "" : item}` as Route} className={`rounded-lg px-3 py-2.5 text-sm font-medium capitalize ${section === item ? "bg-teal-700 text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`}>{item.replaceAll("-", " ")}</Link>)}</nav>
    </section>
    {content}
  </>;
}
