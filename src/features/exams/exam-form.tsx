"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { saveExamAnswer, submitExam } from "@/actions/exams";
import type { ExamAttempt } from "@/types/exam";

export function ExamForm({ exam, readOnly = false }: { exam: ExamAttempt; readOnly?: boolean }) {
  const router = useRouter(); const dialog = useRef<HTMLDialogElement>(null);
  const [answers, setAnswers] = useState<Record<string,string>>(() => Object.fromEntries(exam.questions.filter(q => q.selectedOptionId).map(q => [q.id,q.selectedOptionId!])));
  const [saving, setSaving] = useState<Record<string,boolean>>({}); const [errors, setErrors] = useState<Record<string,string>>({});
  const [submitting, setSubmitting] = useState(false); const [submitError, setSubmitError] = useState("");
  const locks = useRef(new Set<string>()); const submitLock = useRef(false);
  const busy = Object.values(saving).some(Boolean); const failed = Object.values(errors).some(Boolean); const answered = Object.keys(answers).length;
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (busy || failed) event.preventDefault(); };
    window.addEventListener("beforeunload", handler); return () => window.removeEventListener("beforeunload", handler);
  }, [busy, failed]);
  async function save(questionId: string, optionId: string) {
    if (readOnly || submitting || submitLock.current || locks.current.has(questionId)) return;
    locks.current.add(questionId); setAnswers(prev => ({ ...prev, [questionId]: optionId }));
    setSaving(prev => ({ ...prev, [questionId]: true })); setErrors(prev => ({ ...prev, [questionId]: "" }));
    try { const result = await saveExamAnswer({ attemptId: exam.id, questionId, optionId }); if (!result.ok) setErrors(prev => ({ ...prev, [questionId]: result.error.message })); }
    catch { setErrors(prev => ({ ...prev, [questionId]: "Answer not saved. Please retry." })); }
    finally { locks.current.delete(questionId); setSaving(prev => ({ ...prev, [questionId]: false })); }
  }
  async function finish() {
    if (readOnly || submitLock.current || locks.current.size || failed) return;
    submitLock.current = true; setSubmitting(true); setSubmitError("");
    try { const result = await submitExam(exam.id); if (result.ok) { dialog.current?.close(); router.replace(`/student/exams/${exam.id}/result` as Route); router.refresh(); } else setSubmitError(result.error.message); }
    catch { setSubmitError("Submission failed. Your saved answers are retained. Please retry."); }
    finally { submitLock.current = false; setSubmitting(false); }
  }
  return <div className="mx-auto max-w-4xl space-y-6">
    <header className="rounded-2xl border-t-4 border-teal-600 bg-white p-5 shadow-sm sm:p-7"><h1 className="break-words text-2xl font-semibold text-slate-950">{exam.bankName}</h1><p className="mt-2 text-slate-600">Question Bank Exam · {exam.totalQuestions} Questions</p><p aria-live="polite" className="mt-5 text-sm font-medium text-slate-700">Answered {answered} of {exam.totalQuestions} {busy ? "· Saving…" : failed ? "· Unsaved answers — retry below" : "· All selections saved"}</p><progress className="mt-3 h-2 w-full accent-teal-700" value={answered} max={exam.totalQuestions} aria-label="Questions answered" />{readOnly && <p className="mt-4 text-sm text-slate-600">Read-only preview. Answer selection and submission are disabled.</p>}</header>
    <nav aria-label="Question navigator" className="flex flex-wrap gap-2 rounded-2xl border bg-white p-4">{exam.questions.map(q => <a key={q.id} href={`#question-${q.order}`} aria-label={`Question ${q.order}, ${answers[q.id] ? "answered" : "unanswered"}`} className={`inline-flex size-11 items-center justify-center rounded-lg border text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ${answers[q.id] ? "bg-teal-700 text-white" : "text-slate-700"}`}>{q.order}</a>)}</nav>
    {exam.questions.map(q => <section key={q.id} id={`question-${q.order}`} className="scroll-mt-28 rounded-2xl border bg-white p-5 shadow-sm sm:p-7"><fieldset disabled={readOnly || submitting || saving[q.id]}><legend className="break-words text-base font-semibold text-slate-950">{q.order}. {q.text}</legend><div className="mt-5 grid gap-3">{q.options.map(option => <label key={option.id} className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm text-slate-700 focus-within:outline-2 focus-within:outline-teal-600 ${answers[q.id] === option.id ? "border-teal-600 bg-teal-50 dark:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}><input className="mt-0.5 size-4 shrink-0 accent-teal-700" type="radio" name={q.id} value={option.id} checked={answers[q.id] === option.id} onChange={() => void save(q.id,option.id)} /><span className="min-w-0 break-words">{option.text}</span></label>)}</div></fieldset>{saving[q.id] && <p role="status" className="mt-3 text-sm text-slate-500">Saving answer…</p>}{errors[q.id] && <div role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300"><p>{errors[q.id]}</p><button className="mt-2 rounded-lg border px-4 py-3 font-semibold" disabled={submitting || saving[q.id]} onClick={() => void save(q.id,answers[q.id]!)}>Retry save</button></div>}</section>)}
    {!readOnly && <div className="pb-5"><button disabled={busy || failed || submitting} onClick={() => dialog.current?.showModal()} className="rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white disabled:opacity-50">Submit Exam</button><p className="mt-3 text-sm text-slate-500">Unanswered questions count as incorrect. You cannot change answers after submission.</p></div>}
    <dialog ref={dialog} aria-labelledby="submit-exam-title" onCancel={event => { if (submitting) event.preventDefault(); }} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border bg-white p-6 text-slate-700 shadow-xl backdrop:bg-slate-950/60 dark:bg-slate-900"><h2 id="submit-exam-title" className="text-xl font-semibold text-slate-950">Submit Exam?</h2><p className="mt-4">Answered: {answered}<br />Unanswered: {exam.totalQuestions-answered}</p><p className="mt-4 text-sm">You will not be able to change your answers after submission.</p>{submitError && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{submitError}</p>}<div className="mt-6 flex flex-wrap justify-end gap-3"><button disabled={submitting} onClick={() => dialog.current?.close()} className="rounded-xl border px-4 py-3">Cancel</button><button disabled={submitting || busy || failed} onClick={() => void finish()} className="rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{submitting ? "Submitting…" : "Submit Exam"}</button></div></dialog>
  </div>;
}
