"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Check, X } from "lucide-react";
import { AnswerFeedback, answerOptionTone } from "@/features/learning/answer-feedback";
import { checkPracticeAnswer, readCurrentExam, saveExamAnswer, submitExam } from "@/actions/exams";
import type { ExamAttempt } from "@/types/exam";

export function ExamForm({ exam, readOnly = false }: { exam: ExamAttempt; readOnly?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null); const heading = useRef<HTMLHeadingElement>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string,string>>(() => Object.fromEntries(exam.questions.filter(q => q.selectedOptionId).map(q => [q.id,q.selectedOptionId!])));
  const [feedback, setFeedback] = useState<Record<string,{ outcome: boolean; correctOptionId: string }>>(() => Object.fromEntries(exam.questions.filter(q => q.correctOptionId !== undefined).map(q => [q.id,{ outcome: q.outcome!, correctOptionId: q.correctOptionId! }])));
  const [saving, setSaving] = useState(false); const [checking, setChecking] = useState(false);
  const [saveIssue, setSaveIssue] = useState<{ questionId: string; message: string; conflict: boolean } | null>(null);
  const [errors, setErrors] = useState<Record<string,string>>({}); const [submitting, setSubmitting] = useState(false); const [submitError, setSubmitError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [version, setVersion] = useState(exam.answerVersion);
  const [previousExam, setPreviousExam] = useState(exam);
  const [conflict, setConflict] = useState(false);
  const locks = useRef(false); const submitLock = useRef(false); const autoSubmitted = useRef(false);
  // All saves are versioned and run serially. Navigation can be optimistic.
  const queue = useRef<Array<{ questionId: string; optionId: string }>>([]);
  const writing = useRef(false);
  const writeBlocked = useRef(false);
  const versionRef = useRef(exam.answerVersion);
  const [queuedCount, setQueuedCount] = useState(0);
  const failed = Object.values(errors).some(Boolean) || Boolean(saveIssue);
  const answered = Object.keys(answers).length;
  const pendingAnswers = saving || queuedCount > 0;
  // Preserve the current question and any unsaved selection while accepting
  // confirmed changes from another tab. A conflict requires explicit review.
  if (previousExam !== exam && exam.answerVersion >= version && !saving && !writing.current && queue.current.length === 0 && !checking && !failed && !submitting) {
    setPreviousExam(exam); setVersion(exam.answerVersion); versionRef.current = exam.answerVersion;
    setAnswers(Object.fromEntries(exam.questions.filter(q => q.selectedOptionId).map(q => [q.id,q.selectedOptionId!])));
    setFeedback(Object.fromEntries(exam.questions.filter(q => q.correctOptionId !== undefined).map(q => [q.id,{ outcome:q.outcome!,correctOptionId:q.correctOptionId! }])));
  }
  // The validated snapshot is nonempty, and navigation only selects persisted indices.
  const question = exam.questions[index]!; const checked = feedback[question.id];
  const expired = remaining !== null && remaining <= 0;
  const finish = useCallback(async (automatic = false) => {
    if (readOnly || submitLock.current || locks.current || writing.current || queue.current.length > 0 || (failed && !automatic)) return;
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
  async function flushAnswers() {
    if (writing.current || writeBlocked.current || queue.current.length === 0) return;
    writing.current = true; setSaving(true);
    try {
      while (queue.current.length > 0) {
        const item = queue.current[0]!;
        let result: Awaited<ReturnType<typeof saveExamAnswer>>;
        try {
          result = await saveExamAnswer({
            attemptId: exam.id, questionId: item.questionId,
            optionId: item.optionId, expectedVersion: versionRef.current,
          });
        } catch {
          writeBlocked.current = true;
          const message = "Connection interrupted. Retry to save this answer.";
          setErrors(prev => ({ ...prev, [item.questionId]: message }));
          setSaveIssue({ questionId: item.questionId, message, conflict: false });
          break;
        }
        if (!result.ok) {
          writeBlocked.current = true;
          setErrors(prev => ({ ...prev, [item.questionId]: result.error.message }));
          setConflict(result.error.code === "CONFLICT");
          setSaveIssue({ questionId: item.questionId, message: result.error.message, conflict: result.error.code === "CONFLICT" });
          break;
        }
        versionRef.current = result.data;
        setVersion(result.data);
        queue.current.shift();
        setQueuedCount(queue.current.length);
        setErrors(prev => ({ ...prev, [item.questionId]: "" }));
      }
    } finally {
      writing.current = false;
      setSaving(false);
    }
  }

  function chooseAnswer(optionId: string) {
    if (readOnly || expired || checked || submitting || checking || locks.current || submitLock.current || writeBlocked.current) return;
    const chosenId = question.id;
    if (answers[chosenId] !== optionId) {
      setAnswers(prev => ({ ...prev, [chosenId]: optionId }));
      setErrors(prev => ({ ...prev, [chosenId]: "" }));
      // Keep an in-flight item immutable, coalescing only later queued changes.
      const existing = queue.current.findIndex((entry, position) =>
        position >= (writing.current ? 1 : 0) && entry.questionId === chosenId,
      );
      if (existing >= 0) queue.current[existing] = { questionId: chosenId, optionId };
      else queue.current.push({ questionId: chosenId, optionId });
      setQueuedCount(queue.current.length);
      void flushAnswers();
    }
    // Exam questions advance immediately; Practice retains Check answer feedback.
    if (exam.learningMode === "EXAM" && index < exam.questions.length - 1) {
      setIndex(index + 1);
      requestAnimationFrame(() => heading.current?.focus());
    }
  }

  function retryAnswers() {
    if (!saveIssue || writing.current) return;
    if (saveIssue.conflict) { void loadLatest(); return; }
    writeBlocked.current = false;
    setSaveIssue(null);
    setErrors({});
    void flushAnswers();
  }
  async function loadLatest() {
    if (locks.current || writing.current) return;
    locks.current=true; setSaving(true);
    try {
      const latest=await readCurrentExam(exam.id);
      if (!latest) { setSubmitError("Access could not be verified. Your last confirmed answers remain saved."); return; }
      versionRef.current=latest.answerVersion; setVersion(latest.answerVersion); setPreviousExam(exam);
      queue.current=[]; setQueuedCount(0); writeBlocked.current=false; setSaveIssue(null);
      setAnswers(Object.fromEntries(latest.questions.filter(q=>q.selectedOptionId).map(q=>[q.id,q.selectedOptionId!])));
      setFeedback(Object.fromEntries(latest.questions.filter(q=>q.correctOptionId!==undefined).map(q=>[q.id,{outcome:q.outcome!,correctOptionId:q.correctOptionId!}])));
      setErrors({}); setConflict(false);
      if (latest.status==='COMPLETED') window.location.replace(`/student/exams/${exam.id}/result`);
    } catch { setSubmitError("Unable to load the latest answers. Reconnect and retry."); }
    finally { locks.current=false; setSaving(false); }
  }
  async function check() {
    if (readOnly || locks.current || writing.current || queue.current.length > 0 || checked || !answers[question.id] || failed || expired) return;
    locks.current = true; setChecking(true); setSubmitError("");
    try { const result = await checkPracticeAnswer(exam.id,question.id); if (result.ok) setFeedback(prev => ({ ...prev,[question.id]:result.data })); else setSubmitError(result.error.message); }
    catch { setSubmitError("Unable to check answer. Retry."); }
    finally { locks.current = false; setChecking(false); }
  }
  function navigate(next: number) { if (locks.current || checking || submitting || next < 0 || next >= exam.questions.length) return; setIndex(next); requestAnimationFrame(() => heading.current?.focus()); }
  return <div className="mx-auto min-w-0 max-w-5xl space-y-5">
    <header className="overflow-hidden rounded-3xl border border-t-4 border-t-teal-600 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="text-sm font-medium text-teal-700 dark:text-teal-200">{exam.learningMode === "PRACTICE" ? "Practice · feedback after checking" : "Exam · feedback after submission"}</p><h1 className="mt-2 break-words text-2xl font-semibold text-slate-950">{exam.title ?? exam.bankName}{exam.year ? ` · ${exam.year}` : ""}</h1><p className="mt-2 text-sm text-slate-600">{exam.bankName}</p></div>{remaining !== null && <p className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 font-mono text-slate-900" aria-label="Time remaining"><Clock className="size-4" />{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,"0")}</p>}</div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="font-semibold text-slate-800">Answered {answered} of {exam.totalQuestions}</p>
        <p role="status" aria-live="polite" className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${failed ? "border-rose-300 text-rose-700" : pendingAnswers ? "border-amber-300 text-amber-700" : "border-emerald-300 text-emerald-700"}`}>
          <span className={`size-2 rounded-full ${failed ? "bg-rose-500" : pendingAnswers ? "bg-amber-500" : "bg-emerald-500"}`} aria-hidden="true" />
          {failed ? "Save failed — action required" : pendingAnswers ? "Saving answers…" : "All answers saved"}
        </p>
      </div>
      <div role="progressbar" aria-label="Questions answered" aria-valuenow={answered} aria-valuemin={0} aria-valuemax={exam.totalQuestions} className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div className="h-full rounded-full bg-teal-700 transition-[width] duration-200" style={{ width: `${100 * answered / exam.totalQuestions}%` }} />
      </div>
      {readOnly && <p className="mt-4 text-sm text-slate-600">Read-only preview. Answer selection, checking and submission are disabled.</p>}
      {expired && <p role="status" className="mt-4 text-sm font-semibold text-rose-700 dark:text-rose-300">Time has expired. New answers cannot be saved.</p>}
    </header>
    {saveIssue && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
      <p className="min-w-0 flex-1">Question {exam.questions.find(q => q.id === saveIssue.questionId)?.order}: {saveIssue.message} Unsaved answers will not be submitted.</p>
      <button type="button" onClick={retryAnswers} disabled={saving || checking} className="min-h-11 rounded-xl border border-rose-400 px-4 font-semibold">{saveIssue.conflict ? "Load latest saved answers" : "Retry saving"}</button>
    </div>}
    <section className="min-w-0 rounded-3xl border bg-white p-5 shadow-sm sm:p-7" aria-labelledby="question-heading">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-teal-800 dark:bg-slate-800 dark:text-teal-200">Question {index+1} of {exam.totalQuestions}</span><span className="text-xs font-medium text-slate-500">{exam.learningMode === "EXAM" ? "Select an answer to continue automatically" : "Check your answer before continuing"}</span></div>
      {question.caseTitle && <div className="mb-6 rounded-xl border border-teal-200 bg-teal-50 p-4 dark:bg-slate-800"><h2 className="break-words font-semibold text-slate-950">{question.caseTitle}</h2><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{question.caseDescription}</p></div>}
      <h2 id="question-heading" ref={heading} tabIndex={-1} className="whitespace-pre-wrap break-words text-lg font-semibold leading-7 text-slate-950 outline-none sm:text-xl">{question.text}</h2>
      {question.sourceNumber && <p className="mt-2 break-words text-sm text-slate-500">Original source question: {question.sourceNumber}</p>}
      <fieldset disabled={readOnly || expired || submitting || checking || Boolean(checked) || Boolean(saveIssue)} className="mt-6"><legend className="sr-only">Choose one answer</legend><div className="grid gap-3 md:grid-cols-2">{question.options.map((option,i) => <label key={option.id} className={`group flex min-h-20 cursor-pointer items-start gap-3 rounded-2xl border p-4 text-sm leading-6 text-slate-700 shadow-sm transition-[border-color,background-color,box-shadow] duration-150 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-teal-600 sm:p-5 ${answerOptionTone(checked ? checked.correctOptionId===option.id : undefined, answers[question.id]===option.id)} ${answers[question.id]===option.id ? "ring-2 ring-teal-500/40" : "hover:border-teal-500/60 hover:shadow-md"}`}><input className="mt-1 size-5 shrink-0 accent-teal-700" type="radio" name={question.id} value={option.id} checked={answers[question.id] === option.id} onChange={() => chooseAnswer(option.id)} /><span className="flex min-w-0 gap-2"><span className="shrink-0 font-semibold">{String.fromCharCode(65+i)}.</span><span className="whitespace-pre-wrap break-words">{option.text}</span></span>{checked?.correctOptionId === option.id ? <Check aria-label="Correct answer" className="size-5 shrink-0 text-emerald-700 dark:text-emerald-200"/> : checked && answers[question.id]===option.id ? <X aria-label="Incorrect answer" className="size-5 shrink-0 text-rose-700 dark:text-rose-200"/> : null}</label>)}</div></fieldset>
      {checked && <AnswerFeedback key={question.id} correct={checked.outcome}/>}
      {exam.learningMode === "EXAM" && !readOnly && !expired && <p className="mt-4 text-xs text-slate-500">Your choice saves in the background. Use Previous or the navigator to change an answer before submitting.</p>}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5"><button disabled={index===0 || checking || submitting} onClick={() => navigate(index-1)} className="inline-flex min-h-11 items-center gap-1 rounded-xl border px-3 text-sm font-semibold disabled:opacity-40"><ChevronLeft className="size-4" />Previous</button>{exam.learningMode === "PRACTICE" && !readOnly && <button disabled={!answers[question.id] || failed || pendingAnswers || checking || Boolean(checked) || expired} onClick={() => void check()} className="min-h-11 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white disabled:opacity-40">{checking ? "Checking…" : checked ? "Checked" : "Check answer"}</button>}<button disabled={index===exam.questions.length-1 || checking || submitting} onClick={() => navigate(index+1)} className="inline-flex min-h-11 items-center gap-1 rounded-xl border px-3 text-sm font-semibold disabled:opacity-40">Next<ChevronRight className="size-4" /></button></div>
    </section>
    <nav aria-label="Question navigator" className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="font-semibold text-slate-950">Question navigator</h2><p className="mt-1 text-xs text-slate-500">Jump to any question, including answered ones.</p></div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-teal-700" />Current</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-emerald-500" />Answered</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full border border-slate-400" />Unanswered</span>
        </div>
      </div>
      <div className="grid max-h-64 grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-2 overflow-y-auto p-1">
        {exam.questions.map((q,i) => {
          const selected = Boolean(answers[q.id]);
          const current = i === index;
          return <button type="button" key={q.id} disabled={checking || submitting} onClick={() => navigate(i)}
            aria-current={current ? "step" : undefined}
            aria-label={`Question ${q.order}: ${current ? "current, " : ""}${selected ? "answered" : "unanswered"}`}
            title={`Question ${q.order} — ${selected ? "Answered" : "Not answered"}`}
            className={`relative flex h-12 min-w-0 items-center justify-center rounded-xl border text-sm font-semibold transition-[background-color,border-color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-50 ${current ? "border-teal-700 bg-teal-700 text-white shadow-[0_0_0_3px_rgba(63,101,119,0.22)]" : selected ? "border-emerald-400 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-200" : "border-slate-300 bg-white text-slate-700 hover:border-teal-500 hover:bg-teal-50"}`}>
            {q.order}
            {selected && <Check aria-hidden="true" className={`absolute right-0.5 top-0.5 size-3 ${current ? "text-white" : "text-emerald-600 dark:text-emerald-300"}`} />}
          </button>;
        })}
      </div>
    </nav>
    {submitError && <p role="alert" className="rounded-xl border p-4 text-sm text-rose-700 dark:text-rose-300">{submitError}</p>}
    {!readOnly && <div className="pb-5"><button disabled={pendingAnswers || checking || (failed && !expired) || submitting} onClick={() => expired ? void finish(true) : dialog.current?.showModal()} className="min-h-12 rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white disabled:opacity-50">{submitting ? "Submitting…" : "Submit Exam"}</button><p className="mt-3 text-sm text-slate-500">Unanswered questions count toward the final score. Answers are final after submission.</p></div>}
    <dialog ref={dialog} aria-labelledby="submit-exam-title" onCancel={event => { if (submitting) event.preventDefault(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border bg-white p-6 text-slate-700 shadow-xl backdrop:bg-slate-950/60 dark:bg-slate-900"><h2 id="submit-exam-title" className="text-xl font-semibold text-slate-950">Submit Exam?</h2><p className="mt-4">Answered: {answered}<br />Unanswered: {exam.totalQuestions-answered}</p><p className="mt-4 text-sm">You will not be able to change your answers after submission.</p>{submitError && <p role="alert" className="mt-3 text-sm text-rose-700">{submitError}</p>}<div className="mt-6 flex flex-wrap justify-end gap-3"><button disabled={submitting} onClick={() => dialog.current?.close()} className="rounded-xl border px-4 py-3">Cancel</button><button disabled={submitting || pendingAnswers || checking || failed} onClick={() => void finish()} className="rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{submitting ? "Submitting…" : "Submit Exam"}</button></div></dialog>
  </div>;
}
