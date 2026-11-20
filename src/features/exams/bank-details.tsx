import Link from "next/link";
import type { Route } from "next";
import type { ExamBank } from "@/types/exam";
import { CalendarDays, BrainCircuit, Users, BookOpen } from "lucide-react";


export function ExamBankDetails({ bank, previewBase }: { bank: ExamBank; previewBase?: string }) {
  const unfinished = bank.attempts.find(a => a.mode === "EXAM" && a.status === "IN_PROGRESS");
  const completed = bank.attempts.filter(a => a.status === "COMPLETED");
  const best = completed.length ? Math.max(...completed.map(a => a.score ?? 0)) : null;
  const generatedCount = Math.min(bank.generation.defaultCount, bank.examCount);
  const examUrl = (id: string) => `${previewBase ?? "/student"}/exams/${id}` as Route;
  return <div className="space-y-6"><header><h1 className="text-2xl font-semibold text-slate-950 sm:text-3xl">{bank.name}</h1><p className="mt-3 text-slate-600">{bank.description}</p></header>
    {!previewBase && <>
      <h2 className="text-xl font-semibold text-slate-950">Available learning options</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {bank.pastExams.length > 0 && <Link href={bank.pastExams.length === 1
          ? `/student/banks/${bank.id}/setup?source=PAST&sourceId=${bank.pastExams[0]!.id}` as Route
          : `/student/banks/${bank.id}/past-exams` as Route}
          className="learning-card lhcc-card-stack group rounded-2xl border bg-white p-5 shadow-sm transition-colors hover:border-teal-500 sm:p-6">
          <CalendarDays className="size-6 text-teal-700" aria-hidden="true" />
          <h3 className="mt-4 font-semibold text-slate-950">{bank.pastExams.length === 1 ? bank.pastExams[0]!.title : "Published Exams"}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{bank.pastExams.length === 1
            ? `${bank.pastExams[0]!.questionCount} questions · ${bank.pastExams[0]!.timeLimitMinutes ? `${bank.pastExams[0]!.timeLimitMinutes} minute limit` : "No fixed time limit"}`
            : `${bank.pastExams.length} exams available by year and session`}</p>
          <span className="lhcc-card-footer text-sm font-semibold text-teal-700">{bank.pastExams.length === 1 ? "Start exam" : "Choose an exam"} →</span>
        </Link>}
        {bank.available > 0 && <Link href={`/student/banks/${bank.id}/setup?source=ALL` as Route}
          className="learning-card lhcc-card-stack group rounded-2xl border bg-white p-5 shadow-sm transition-colors hover:border-teal-500 sm:p-6">
          <BookOpen className="size-6 text-teal-700" aria-hidden="true" />
          <h3 className="mt-4 font-semibold text-slate-950">Practice Questions</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{bank.available} questions available for practice.</p>
          <span className="lhcc-card-footer text-sm font-semibold text-teal-700">Start practice →</span>
        </Link>}
        {bank.available > 0 && bank.examCount > 0 && <Link href={`/student/banks/${bank.id}/setup?source=RANDOM` as Route}
          className="learning-card lhcc-card-stack group rounded-2xl border bg-white p-5 shadow-sm transition-colors hover:border-teal-500 sm:p-6">
          <BrainCircuit className="size-6 text-teal-700" aria-hidden="true" />
          <h3 className="mt-4 font-semibold text-slate-950">Random Question Exam</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">Create an exam from ${bank.available} available questions.</p>
          <span className="lhcc-card-footer text-sm font-semibold text-teal-700">Set up exam →</span>
        </Link>}
        {bank.chapters.some(chapter => chapter.questionCount > 0) && <Link href={`/student/banks/${bank.id}/chapters` as Route}
          className="learning-card lhcc-card-stack group rounded-2xl border bg-white p-5 shadow-sm transition-colors hover:border-teal-500 sm:p-6">
          <BookOpen className="size-6 text-teal-700" aria-hidden="true" />
          <h3 className="mt-4 font-semibold text-slate-950">Chapter Questions</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">Practice questions from {bank.chapters.filter(chapter => chapter.questionCount > 0).length} available chapters.</p>
          <span className="lhcc-card-footer text-sm font-semibold text-teal-700">View chapters →</span>
        </Link>}
        {bank.sharedExams.length > 0 && <Link href={`/student/banks/${bank.id}/shared-exams` as Route}
          className="learning-card lhcc-card-stack group rounded-2xl border bg-white p-5 shadow-sm transition-colors hover:border-teal-500 sm:p-6">
          <Users className="size-6 text-teal-700" aria-hidden="true" />
          <h3 className="mt-4 font-semibold text-slate-950">Shared Exams</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{bank.sharedExams.length} shared exam sets available.</p>
          <span className="lhcc-card-footer text-sm font-semibold text-teal-700">Choose a shared exam →</span>
        </Link>}
      </div>
    </>}
    {(bank.available > 0 || unfinished || completed.length > 0) && <section className="rounded-2xl border bg-white p-5 sm:p-7"><h2 className="text-lg font-semibold text-slate-950">Your Course Progress</h2>
      <dl className="mt-5 grid grid-cols-2 gap-5 text-sm sm:grid-cols-4">{[["Practice questions",bank.available],["Random exam size",generatedCount],["Completed attempts",completed.length],["Best score",best === null ? "—" : `${best.toFixed(2)}%`]].map(([label,value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-2 text-xl font-semibold text-slate-950">{value}</dd></div>)}</dl>
      {unfinished && <Link className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white" href={examUrl(unfinished.id)}>{previewBase ? "Inspect Exam" : "Continue Exam"}</Link>}
    </section>}
    {bank.cases.some(item => item.questionCount > 0) && <section className="rounded-2xl border bg-white p-5 sm:p-7"><h2 className="text-lg font-semibold text-slate-950">Clinical cases</h2><p className="mt-1 text-sm text-slate-600">Explore the cases included in this question bank.</p>{bank.cases.length ? <div className="mt-5 grid gap-4 md:grid-cols-2">{bank.cases.map(item => <article key={item.id} className="rounded-xl border bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold text-slate-950">{item.displayOrder}. {item.title}</h3><span className="shrink-0 text-xs text-slate-500">{item.questionCount} questions</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.description}</p>{!previewBase && item.questionCount>0 && <Link href={`/student/banks/${bank.id}/setup?source=CASE&sourceId=${encodeURIComponent(item.id)}` as Route} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-teal-700 dark:text-teal-200">Practice this case</Link>}</article>)}</div> : <p className="mt-4 text-sm text-slate-500">No clinical cases are available yet.</p>}</section>}
    {bank.attempts.length > 0 && <section className="rounded-2xl border bg-white p-5 sm:p-7"><h2 className="text-lg font-semibold text-slate-950">Previous Attempts</h2>{!bank.attempts.length ? <p className="mt-4 text-sm text-slate-500">No attempts yet.</p> : <ul className="mt-4 divide-y">{bank.attempts.map(a => <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"><div><p className="font-medium text-slate-950">{new Date(a.submittedAt ?? a.startedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</p><p className="mt-1 text-slate-500">{a.totalQuestions} questions · {a.status.replaceAll("_", " ").toLowerCase()} {a.mode === "PRACTICE" ? "· Previous practice" : ""}</p></div>{a.score !== null && <span className="font-semibold text-teal-700 dark:text-teal-200">{a.score.toFixed(2)}%</span>}{a.mode === "EXAM" && a.status !== "ABANDONED" && <Link className="rounded-lg border px-4 py-3 font-semibold text-slate-700" href={examUrl(a.id)}>{a.status === "COMPLETED" ? "View Result" : previewBase ? "Inspect Exam" : "Continue Exam"}</Link>}</li>)}</ul>}</section>}
  </div>;
}
