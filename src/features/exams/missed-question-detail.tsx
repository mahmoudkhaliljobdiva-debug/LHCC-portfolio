import { CheckCircle2, CircleAlert, GraduationCap, XCircle } from "lucide-react";
import type { MissedQuestion } from "./missed-review-types";

export function MissedQuestionDetail({ question }: { readonly question: MissedQuestion }) {
  const correct = question.options.find(option => option.id === question.correctOptionId);
  const selected = question.options.find(option => option.id === question.selectedOptionId);
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
      <span className="rounded-full bg-teal-50 px-3 py-1.5 text-teal-800 dark:bg-slate-800 dark:text-teal-200">{question.specialty}</span>
      <span>{question.sourceLabel}</span>
      <span>·</span>
      <span>{question.wrongCount} {question.wrongCount === 1 ? "miss" : "misses"}</span>
    </div>
    {question.caseTitle && <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="font-semibold text-slate-900">{question.caseTitle}</h3>
      {question.caseDescription && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{question.caseDescription}</p>}
    </section>}
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">{question.sourceNumber ? `Question ${question.sourceNumber}` : "Question review"}</p>
      <h3 className="mt-2 whitespace-pre-wrap break-words text-lg font-semibold leading-7 text-slate-950">{question.questionText}</h3>
    </div>
    <ul className="space-y-2" aria-label="Answer choices">
      {question.options.map((option,index) => {
        const isCorrect = option.id === question.correctOptionId;
        const isWrongSelection = option.id === question.selectedOptionId && !isCorrect;
        return <li key={option.id} className={`flex items-start gap-3 rounded-xl border p-4 text-sm leading-6 ${isCorrect ? "border-emerald-400 bg-emerald-50 text-emerald-950" : isWrongSelection ? "border-rose-300 bg-rose-50 text-rose-950" : "border-slate-200 bg-white text-slate-700"}`}>
          <span className="w-5 shrink-0 font-bold">{String.fromCharCode(65+index)}.</span>
          <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{option.text}</span>
          {isCorrect ? <CheckCircle2 aria-label="Correct answer" className="size-5 shrink-0 text-emerald-700" /> : null}
          {isWrongSelection ? <XCircle aria-label="Your incorrect answer" className="size-5 shrink-0 text-rose-700" /> : null}
        </li>;
      })}
    </ul>
    <div className="grid gap-3 sm:grid-cols-2">
      <section className="rounded-xl border border-rose-200 bg-rose-50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-rose-800"><XCircle className="size-4" aria-hidden="true" />Your answer</div>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-rose-950">{selected?.text ?? "Not available"}</p>
      </section>
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle2 className="size-4" aria-hidden="true" />Correct answer</div>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-emerald-950">{correct?.text ?? "Answer unavailable"}</p>
      </section>
    </div>
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <h4 className="inline-flex items-center gap-2 font-semibold text-slate-950"><GraduationCap className="size-5 text-teal-700" aria-hidden="true" />Explanation</h4>
      {question.explanation
        ? <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{question.explanation}</p>
        : <p className="mt-3 inline-flex items-start gap-2 text-sm leading-6 text-slate-600"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />No reviewed explanation is available for this question yet. The correct choice above is from your completed exam.</p>}
    </section>
  </div>;
}
