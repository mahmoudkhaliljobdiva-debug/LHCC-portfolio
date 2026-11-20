import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, BarChart3, Target } from "lucide-react";
import type { MissedReview } from "./missed-review-types";

export function StudentReviewDashboard({ review }: { readonly review: MissedReview }) {
  const max = Math.max(1, ...review.scoreHistogram.map(item => item.count));
  return <section aria-labelledby="review-dashboard-heading" className="grid gap-4 lg:grid-cols-2">
    <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-2">
        <BarChart3 aria-hidden="true" className="size-5 text-teal-700" />
        <h2 id="review-dashboard-heading" className="font-semibold text-slate-950">Exam score histogram</h2>
      </div>
      <p className="mt-2 text-sm text-slate-600">Number of completed exams in each score range.</p>
      <div className="mt-5 grid grid-cols-5 gap-2 sm:gap-3" role="img" aria-label={`Exam scores: ${review.scoreHistogram.map(item=>`${item.label}: ${item.count} exams`).join(", ")}`}>
        {review.scoreHistogram.map(bucket => <div key={bucket.label} className="flex min-w-0 flex-col items-center">
          <span className="text-xs font-semibold tabular-nums text-slate-700">{bucket.count}</span>
          <div className="relative mt-2 h-28 w-full overflow-hidden rounded-t-lg bg-slate-100 sm:h-36">
            <div className="absolute bottom-0 left-0 right-0 rounded-t-lg bg-teal-600 transition-[height] duration-300" style={{ height: `${bucket.count === 0 ? 0 : Math.max(6,(bucket.count/max)*100)}%` }} />
          </div>
          <span className="mt-2 text-center text-[10px] font-medium leading-4 text-slate-500 sm:text-xs">{bucket.label}</span>
        </div>)}
      </div>
      <p className="mt-3 text-xs text-slate-500">{review.completedExams} completed {review.completedExams === 1 ? "exam" : "exams"}</p>
    </div>
    <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-2"><Target aria-hidden="true" className="size-5 text-teal-700" /><h2 className="font-semibold text-slate-950">Questions to revisit</h2></div>
      <p className="mt-2 text-sm text-slate-600">Your most frequently missed questions from completed exams.</p>
      {review.questions.length ? <div className="mt-4 space-y-2">
        {review.questions.slice(0,3).map(item => <Link key={`${item.questionId}-${item.sourceKind}`}
          href={`/student/exams/review/${encodeURIComponent(item.questionId)}?source=${item.sourceKind}` as Route}
          className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:border-teal-500 hover:bg-teal-50">
          <div className="min-w-0"><p className="text-xs font-semibold text-teal-700">{item.specialty} · {item.sourceLabel}</p><p className="mt-1 line-clamp-2 text-sm text-slate-800">{item.questionText}</p></div>
          <span className="shrink-0 text-xs font-semibold text-rose-700">{item.wrongCount}× missed</span>
        </Link>)}
      </div> : <p className="mt-5 rounded-xl border border-dashed p-5 text-sm text-slate-600">No missed questions from completed exams yet.</p>}
      <Link href="/student/exams" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-teal-700">Review all mistakes <ArrowRight aria-hidden="true" className="size-4"/></Link>
    </div>
  </section>;
}
