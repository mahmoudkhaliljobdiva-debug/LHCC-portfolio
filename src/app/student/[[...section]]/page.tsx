import { RoleScreen } from "@/features/dashboard/role-screen";
import { getStudentBanks } from "@/lib/bank-access/server";
import { notFound, redirect } from "next/navigation";
import { StudentLearningOverview } from "@/features/exams/student-learning-overview";
import { StudentReviewDashboard } from "@/features/exams/student-review-dashboard";
import { getStudentMissedReview } from "@/lib/exams/missed-review-server";
import { BookOpen, ClipboardList, ArrowRight } from "lucide-react";
import Link from "next/link";

export default async function StudentPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section } = await params;
  if (section) {
    if (section.length !== 1 || !["exams", "analytics", "profile"].includes(section[0] ?? "")) notFound();
    if (section[0] === "exams") redirect("/student/exams");
    return <RoleScreen role="student" section={section[0]} />;
  }
  const [banks, review] = await Promise.all([getStudentBanks(), getStudentMissedReview(3)]);
  const approved = banks.filter(bank => bank.accessState === "APPROVED");
  return <div className="space-y-7">
    <header>
      <p className="text-sm font-semibold text-teal-700">Your learning workspace</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">My Learning</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Pick up an unfinished exam, open your courses, or review your results—all in one place.</p>
    </header>
    <StudentLearningOverview banks={approved} />
    <StudentReviewDashboard review={review} />
    <section aria-label="More student actions" className="grid gap-4 sm:grid-cols-2">
      <Link href="/student/question-banks" className="lhcc-card-stack group rounded-2xl border bg-white p-5 shadow-sm transition-colors hover:border-teal-500 sm:p-6">
        <BookOpen className="size-6 text-teal-700" aria-hidden="true" />
        <h2 className="mt-3 font-semibold text-slate-950">Browse Courses</h2>
        <p className="mt-2 text-sm text-slate-600">Explore available question banks and request access.</p>
        <span className="lhcc-card-footer inline-flex items-center gap-2 text-sm font-semibold text-teal-700">View courses <ArrowRight aria-hidden="true" className="size-4" /></span>
      </Link>
      <Link href="/student/exams" className="lhcc-card-stack group rounded-2xl border bg-white p-5 shadow-sm transition-colors hover:border-teal-500 sm:p-6">
        <ClipboardList className="size-6 text-teal-700" aria-hidden="true" />
        <h2 className="mt-3 font-semibold text-slate-950">My Exams & Results</h2>
        <p className="mt-2 text-sm text-slate-600">Continue saved exams and review your scores and performance.</p>
        <span className="lhcc-card-footer inline-flex items-center gap-2 text-sm font-semibold text-teal-700">View exams <ArrowRight aria-hidden="true" className="size-4" /></span>
      </Link>
    </section>
  </div>;
}
