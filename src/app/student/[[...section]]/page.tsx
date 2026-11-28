import { RoleScreen } from "@/features/dashboard/role-screen";
import { getStudentBanks, getStudentCoursePackages } from "@/lib/bank-access/server";
import { notFound, redirect } from "next/navigation";
import { StudentLearningOverview } from "@/features/exams/student-learning-overview";
import { CoursePackageGrid } from "@/features/question-banks/course-package-grid";
import { StudentReviewDashboard } from "@/features/exams/student-review-dashboard";
import { getStudentMissedReview } from "@/lib/exams/missed-review-server";
import { BookOpen, ClipboardList, ArrowRight } from "lucide-react";
import Link from "next/link";
import { requireRole } from "@/lib/auth/server";

export default async function StudentPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section } = await params;
  if (section) {
    if (section.length !== 1 || !["exams", "analytics", "profile"].includes(section[0] ?? "")) notFound();
    if (section[0] === "exams") redirect("/student/exams");
    return <RoleScreen role="student" section={section[0]} />;
  }
  const [banks, packages, review, profile] = await Promise.all([getStudentBanks(), getStudentCoursePackages(), getStudentMissedReview(3), requireRole("STUDENT")]);
  const firstName = profile.full_name.trim().replace(/^(?:Dr\\.?|Doctor)\\s+/i,"").split(/\\s+/)[0] || "Student";
  const greetings = [
    `Welcome Dr ${firstName}!`,
    `Keep going, Dr ${firstName} — every question brings progress.`,
    `Ready to learn, Dr ${firstName}?`,
    `Your next achievement starts here, Dr ${firstName}.`,
    `Great to see you, Dr ${firstName}!`,
  ];
  const greeting = greetings[Math.floor(Math.random() * greetings.length)]!;
  const approved = banks.filter(bank => bank.accessState === "APPROVED" && bank.material_kind === "EXAM_TRACK");
  return <div className="space-y-7">
    <header>
      <p className="text-sm font-semibold text-teal-700">Your learning workspace</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{greeting}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Pick up an unfinished exam, open your courses, or review your results—all in one place.</p>
    </header>
    <StudentLearningOverview banks={approved} showCourses={false} />
    <section aria-labelledby="student-courses-heading" className="space-y-4">
      <div>
        <h2 id="student-courses-heading" className="text-xl font-semibold text-slate-950">Courses</h2>
        <p className="mt-1 text-sm text-slate-600">Your selected specialty only. Request access once to see its courses and exams.</p>
      </div>
      <CoursePackageGrid packages={packages} />
    </section>
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
