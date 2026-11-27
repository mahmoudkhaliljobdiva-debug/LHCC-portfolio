import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, BookOpen, Clock3, FileText, Play, ScrollText } from "lucide-react";
import { getStudentBanks } from "@/lib/bank-access/server";
import { getExamBank } from "@/lib/exams/server";
import type { StudentBank } from "@/types/bank-access";

export async function StudentLearningOverview({ banks: providedBanks, showCourses = true }: { readonly banks?: readonly StudentBank[]; readonly showCourses?: boolean } = {}) {
  const approved = (providedBanks ?? await getStudentBanks()).filter(bank => bank.accessState === "APPROVED" && bank.material_kind === "EXAM_TRACK");
  const loaded = await Promise.all(approved.map(bank => getExamBank(bank.id)));
  const courses = loaded.filter((bank): bank is NonNullable<typeof bank> => bank !== null);
  const unfinished = courses.flatMap(course =>
    course.attempts.filter(attempt => attempt.mode === "EXAM" && attempt.status === "IN_PROGRESS")
      .map(attempt => ({ ...attempt, bankName: course.name })),
  ).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));

  return <div className="space-y-6">
    {unfinished.length > 0 && <section aria-labelledby="resume-heading" className="rounded-2xl border border-teal-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center gap-2"><Clock3 aria-hidden="true" className="size-5 text-teal-700" /><h2 id="resume-heading" className="text-lg font-semibold text-slate-950">Continue your exams</h2></div>
      <p className="mt-2 text-sm text-slate-600">Your saved answers are waiting. Continue where you stopped.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {unfinished.map(attempt => <Link key={attempt.id} href={`/student/exams/${attempt.id}` as Route}
          className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50/40 p-4 transition-colors hover:border-teal-600 hover:bg-teal-50">
          <div className="min-w-0"><p className="break-words font-semibold text-slate-950">{attempt.bankName}</p><p className="mt-1 text-xs text-slate-600">{attempt.totalQuestions} questions · In progress</p></div>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-teal-700">Resume <ArrowRight aria-hidden="true" className="size-4" /></span>
        </Link>)}
      </div>
    </section>}
    {showCourses && <section aria-labelledby="my-courses-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h2 id="my-courses-heading" className="text-xl font-semibold text-slate-950">My Courses</h2><p className="mt-1 text-sm text-slate-600">Only courses with available questions or published exams appear here.</p></div>
        <Link href="/student/question-banks" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-teal-700">All courses <ArrowRight aria-hidden="true" className="size-4" /></Link>
      </div>
      {courses.length ? <div className="grid gap-4 md:grid-cols-2">
        {courses.map(course => {
          const firstExam = course.pastExams[0];
          const primary = firstExam && course.pastExams.length === 1
            ? { href: `/student/banks/${course.id}/setup?source=PAST&sourceId=${firstExam.id}`, label: `Start ${firstExam.title}`, icon: Play }
            : { href: `/student/banks/${course.id}`, label: "Open Course", icon: BookOpen };
          const PrimaryIcon = primary.icon;
          return <article key={course.id} className="lhcc-card-stack rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
            <div className="lhcc-card-body">
              <h3 className="break-words text-lg font-semibold text-slate-950">{course.name}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {course.available > 0 ? `${course.available} practice questions` : "Exam-only course"}
                {course.pastExams.length > 0 ? ` · ${course.pastExams.length} published ${course.pastExams.length === 1 ? "exam" : "exams"}` : ""}
              </p>
            </div>
            <div className="lhcc-card-footer flex flex-wrap items-center gap-3">
              <Link href={primary.href as Route} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800">
                <PrimaryIcon aria-hidden="true" className="size-4" />{primary.label}
              </Link>
              {course.pastExams.length > 1 && <Link href={`/student/banks/${course.id}/past-exams` as Route} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-teal-700"><ScrollText aria-hidden="true" className="size-4" />All exams</Link>}
              {course.available > 0 && <Link href={`/student/banks/${course.id}/setup?source=ALL` as Route} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-teal-700"><FileText aria-hidden="true" className="size-4" />Practice</Link>}
            </div>
          </article>;
        })}
      </div> : <div className="rounded-2xl border border-dashed bg-white p-6">
        <p className="text-sm text-slate-600">No approved courses yet. Find an available course and request access to start.</p>
        <Link href="/student/question-banks" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white">
          <BookOpen aria-hidden="true" className="size-4" />Browse courses
        </Link>
      </div>}
    </section>}
  </div>;
}
