import { Check, X } from "lucide-react";
export function AnswerFeedback({ correct, unanswered = false }: { correct: boolean; unanswered?: boolean }) {
  const Icon=correct ? Check : X;
  return <p role="status" className={`answer-feedback mt-4 inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${correct ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:text-emerald-200" : "border-rose-300 bg-rose-50 text-rose-800 dark:text-rose-200"}`}><span className="answer-feedback-mark grid size-6 shrink-0 place-items-center"><Icon className="size-5" aria-hidden="true"/></span>{unanswered ? "Unanswered" : correct ? "Correct Answer" : "Incorrect Answer"}</p>;
}
/** Call only with feedback returned after an authorized check/final submission. */
export function answerOptionTone(correct: boolean | undefined, selected: boolean) {
  return correct===true ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:text-emerald-200" : correct===false && selected ? "border-rose-500 bg-rose-50 text-rose-800 dark:text-rose-200" : selected ? "border-teal-600 bg-slate-50" : "hover:bg-slate-50";
}
