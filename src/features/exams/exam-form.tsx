"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Check, X } from "lucide-react";
import { AnswerFeedback, answerOptionTone } from "@/features/learning/answer-feedback";
import { checkPracticeAnswer, saveExamAnswer, submitExam } from "@/actions/exams";
import type { ExamAttempt } from "@/types/exam";

export function ExamForm({ exam, readOnly = false }: { exam: ExamAttempt; readOnly?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null); const heading = useRef<HTMLHeadingElement>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string,string>>(() => Object.fromEntries(exam.questions.filter(q => q.selectedOptionId).map(q => [q.id,q.selectedOptionId!])));
  const [feedback, setFeedback] = useState<Record<string,{ outcome: boolean; correctOptionId: string }>>(() => Object.fromEntries(exam.questions.filter(q => q.correctOptionId !== undefined).map(q => [q.id,{ outcome: q.outcome!, correctOptionId: q.correctOptionId! }])));
  const [saving, setSaving] = useState(false); const [checking, setChecking] = useState(false);
  const [errors, setErrors] = useState<Record<string,string>>({}); const [submitting, setSubmitting] = useState(false); const [submitError, setSubmitError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const locks = useRef(false); const submitLock = useRef(false); const autoSubmitted = useRef(false);
  const failed = Object.values(errors).some(Boolean); const answered = Object.keys(answers).length;
  // The validated snapshot is nonempty, and navigation only selects persisted indices.
  const question = exam.questions[index]!; const checked = feedback[question.id];
  const expired = remaining !== null && remaining <= 0;
  const finish = useCallback(async (automatic = false) => {
    if (readOnly || submitLock.current || locks.current || (failed && !automatic)) return;
    submitLock.current = true; setSubmitting(true); setSubmitError("");
    try {
      const result = await submitExam(exam.id);
      if (result.ok) {
        dialog.current?.close();
        // Finalization must read the completed snapshot, never a prefetched
        // in-progress redirect retained by the client router after resuming.
        window.location.replace(`/student/exams/${exam.id}/result`);
      }
      else setSubmitError(result.error.message);
    } catch { setSubmitError("Submission failed. Saved answers are retained. Please retry."); }
    finally { submitLock.current = false; setSubmitting(false); }
  }, [exam.id,failed,readOnly]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (saving || checking || failed) event.preventDefault(); };
    window.addEventListener("beforeunload",handler); return () => window.removeEventListener("beforeunload",handler);
  }, [saving,checking,failed]);
  useEffect(() => {
    if (!exam.deadlineAt) return;
    const tick = () => setRemaining(Math.max(0,Math.ceil((Date.parse(exam.deadlineAt!)-Date.now())/1000)));
    tick(); const interval = window.setInterval(tick,1000); return () => window.clearInterval(interval);
  }, [exam.deadlineAt]);
  useEffect(() => {
    if (expired && !readOnly && !saving && !checking && !autoSubmitted.current) { autoSubmitted.current = true; void finish(true); }
  }, [expired,readOnly,saving,checking,finish]);
  async function save(optionId: string) {
    if (readOnly || expired || checked || submitLock.current || locks.current) return;
    locks.current = true; setAnswers(prev => ({ ...prev,[question.id]:optionId })); setSaving(true); setErrors(prev => ({ ...prev,[question.id]:"" }));
    try { const result = await saveExamAnswer({ attemptId:exam.id,questionId:question.id,optionId }); if (!result.ok) setErrors(prev => ({ ...prev,[question.id]:result.error.message })); }
    catch { setErrors(prev => ({ ...prev,[question.id]:"Answer not saved. Retry before continuing." })); }
    finally { locks.current = false; setSaving(false); }
  }
  async function check() {
    if (readOnly || locks.current || checked || !answers[question.id] || failed || expired) return;
    locks.current = true; setChecking(true); setSubmitError("");
    try { const result = await checkPracticeAnswer(exam.id,question.id); if (result.ok) setFeedback(prev => ({ ...prev,[question.id]:result.data })); else setSubmitError(result.error.message); }
    catch { setSubmitError("Unable to check answer. Retry."); }
    finally { locks.current = false; setChecking(false); }
  }
  function navigate(next: number) { if (locks.current) return; setIndex(next); requestAnimationFrame(() => heading.current?.focus()); }
  return <div className="mx-auto min-w-0 max-w-5xl space-y-5">
    <header className="rounded-2xl border border-t-4 border-t-teal-600 bg-white p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="text-sm font-medium text-teal-700 dark:text-teal-200">{exam.learningMode === "PRACTICE" ? "Practice · feedback after checking" : "Exam · feedback after submission"}</p><h1 className="mt-2 break-words text-2xl font-semibold text-slate-950">{exam.title ?? exam.bankName}{exam.year ? ` · ${exam.year}` : ""}</h1><p className="mt-2 text-sm text-slate-600">{exam.bankName}</p></div>{remaining !== null && <p className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 font-mono text-slate-900" aria-label="Time remaining"><Clock className="size-4" />{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,"0")}</p>}</div>
      <p aria-live="polite" className="mt-5 text-sm text-slate-700">Answered {answered} of {exam.totalQuestions} · {saving ? "Saving…" : failed ? "Unsaved selection — retry" : "Selections saved"}</p><progress className="mt-3 h-2 w-full accent-teal-700" value={answered} max={exam.totalQuestions} aria-label="Questions answered" />
      {readOnly && <p className="mt-4 text-sm text-slate-600">Read-only preview. Answer selection, checking and submission are disabled.</p>}
      {expired && <p role="status" className="mt-4 text-sm font-semibold text-rose-700 dark:text-rose-300">Time has expired. New answers cannot be saved.</p>}
    </header>
    <section className="min-w-0 rounded-2xl border bg-white p-5 shadow-sm sm:p-7" aria-labelledby="question-heading">
      <p className="mb-5 text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-200">Question {index+1} / {exam.totalQuestions}</p>
      {question.caseTitle && <div className="mb-6 rounded-xl border border-teal-200 bg-teal-50 p-4 dark:bg-slate-800"><h2 className="break-words font-semibold text-slate-950">{question.caseTitle}</h2><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{question.caseDescription}</p></div>}
      <h2 id="question-heading" ref={heading} tabIndex={-1} className="whitespace-pre-wrap break-words text-lg font-semibold leading-7 text-slate-950 outline-none sm:text-xl">{question.text}</h2>
      <fieldset disabled={readOnly || expired || submitting || saving || checking || Boolean(checked)} className="mt-6"><legend className="sr-only">Choose one answer</legend><div className="grid gap-3 md:grid-cols-2">{question.options.map((option,i) => <label key={option.id} className={`flex min-h-14 items-start gap-3 rounded-xl border p-4 text-sm text-slate-700 transition-colors duration-200 focus-within:outline-2 focus-within:outline-teal-600 ${answerOptionTone(checked ? checked.correctOptionId===option.id : undefined, answers[question.id]===option.id)}`}><input className="mt-1 size-4 shrink-0 accent-teal-700" type="radio" name={question.id} value={option.id} checked={answers[question.id] === option.id} onChange={() => void save(option.id)} /><span className="flex min-w-0 gap-2"><span className="shrink-0 font-semibold">{String.fromCharCode(65+i)}.</span><span className="whitespace-pre-wrap break-words">{option.text}</span></span>{checked?.correctOptionId === option.id ? <Check aria-label="Correct answer" className="size-5 shrink-0 text-emerald-700 dark:text-emerald-200"/> : checked && answers[question.id]===option.id ? <X aria-label="Incorrect answer" className="size-5 shrink-0 text-rose-700 dark:text-rose-200"/> : null}</label>)}</div></fieldset>
      {checked && <AnswerFeedback key={question.id} correct={checked.outcome}/>}
      {errors[question.id] && <div role="alert" className="mt-4 text-sm text-rose-700 dark:text-rose-300"><p>{errors[question.id]}</p><button disabled={saving || expired} onClick={() => { const answer=answers[question.id]; if (answer) void save(answer); }} className="mt-2 min-h-11 rounded-xl border px-4">Retry save</button></div>}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5"><button disabled={index===0 || saving || checking} onClick={() => navigate(index-1)} className="inline-flex min-h-11 items-center gap-1 rounded-xl border px-3 text-sm font-semibold disabled:opacity-40"><ChevronLeft className="size-4" />Previous</button>{exam.learningMode === "PRACTICE" && !readOnly && <button disabled={!answers[question.id] || failed || saving || checking || Boolean(checked) || expired} onClick={() => void check()} className="min-h-11 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white disabled:opacity-40">{checking ? "Checking…" : checked ? "Checked" : "Check answer"}</button>}<button disabled={index===exam.questions.length-1 || saving || checking} onClick={() => navigate(index+1)} className="inline-flex min-h-11 items-center gap-1 rounded-xl border px-3 text-sm font-semibold disabled:opacity-40">Next<ChevronRight className="size-4" /></button></div>
    </section>
    <nav aria-label="Question navigator" className="rounded-2xl border bg-white p-4"><p className="mb-3 text-sm text-slate-600">Jump to a question · filled buttons have an answer</p><div className="flex max-h-60 flex-wrap gap-2 overflow-y-auto">{exam.questions.map((q,i) => <button key={q.id} disabled={saving || checking} onClick={() => navigate(i)} aria-current={i===index ? "step" : undefined} aria-label={`Question ${q.order}, ${answers[q.id] ? "answered" : "unanswered"}`} className={`inline-flex size-11 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${i===index ? "ring-2 ring-teal-500 ring-offset-2" : ""} ${answers[q.id] ? "bg-teal-700 text-white" : "text-slate-700"}`}>{q.order}</button>)}</div></nav>
    {submitError && <p role="alert" className="rounded-xl border p-4 text-sm text-rose-700 dark:text-rose-300">{submitError}</p>}
    {!readOnly && <div className="pb-5"><button disabled={saving || checking || (failed && !expired) || submitting} onClick={() => expired ? void finish(true) : dialog.current?.showModal()} className="min-h-12 rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white disabled:opacity-50">{submitting ? "Submitting…" : "Submit Exam"}</button><p className="mt-3 text-sm text-slate-500">Unanswered questions count toward the final score. Answers are final after submission.</p></div>}
    <dialog ref={dialog} aria-labelledby="submit-exam-title" onCancel={event => { if (submitting) event.preventDefault(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border bg-white p-6 text-slate-700 shadow-xl backdrop:bg-slate-950/60 dark:bg-slate-900"><h2 id="submit-exam-title" className="text-xl font-semibold text-slate-950">Submit Exam?</h2><p className="mt-4">Answered: {answered}<br />Unanswered: {exam.totalQuestions-answered}</p><p className="mt-4 text-sm">You will not be able to change your answers after submission.</p>{submitError && <p role="alert" className="mt-3 text-sm text-rose-700">{submitError}</p>}<div className="mt-6 flex flex-wrap justify-end gap-3"><button disabled={submitting} onClick={() => dialog.current?.close()} className="rounded-xl border px-4 py-3">Cancel</button><button disabled={submitting || saving || checking || failed} onClick={() => void finish()} className="rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{submitting ? "Submitting…" : "Submit Exam"}</button></div></dialog>
  </div>;
}
