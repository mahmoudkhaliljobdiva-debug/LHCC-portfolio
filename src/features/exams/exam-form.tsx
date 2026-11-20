"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, Check, ListChecks, LoaderCircle, ShieldCheck, BarChart3, FileCheck2, X } from "lucide-react";
import { AnswerFeedback, answerOptionTone } from "@/features/learning/answer-feedback";
import { checkPracticeAnswer, readCurrentExam, saveExamAnswer, submitExam, submitExamWithAnswers } from "@/actions/exams";
import type { ExamAttempt } from "@/types/exam";

export function ExamForm({ exam, readOnly = false }: { exam: ExamAttempt; readOnly?: boolean }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null); const heading = useRef<HTMLHeadingElement>(null);
  const [index, setIndex] = useState(0);
  const examMode = exam.learningMode === "EXAM";
  const [draftReady, setDraftReady] = useState(false);
  const [localChanges, setLocalChanges] = useState(false);
  const [processingStep, setProcessingStep] = useState<"saving"|"grading"|"preparing"|"done">("saving");
  const [answers, setAnswers] = useState<Record<string,string>>(() => Object.fromEntries(exam.questions.filter(q => q.selectedOptionId).map(q => [q.id,q.selectedOptionId!])));
  const [feedback, setFeedback] = useState<Record<string,{ outcome: boolean; correctOptionId: string }>>(() => Object.fromEntries(exam.questions.filter(q => q.correctOptionId !== undefined).map(q => [q.id,{ outcome: q.outcome!, correctOptionId: q.correctOptionId! }])));
  const [saving, setSaving] = useState(false); const [checking, setChecking] = useState(false);
  const [saveIssue, setSaveIssue] = useState<{ questionId: string; message: string; conflict: boolean } | null>(null);
  const [errors, setErrors] = useState<Record<string,string>>({}); const [submitting, setSubmitting] = useState(false); const [submitError, setSubmitError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [version, setVersion] = useState(exam.answerVersion);
  const [previousExam, setPreviousExam] = useState(exam);
  const locks = useRef(false); const submitLock = useRef(false); const autoSubmitted = useRef(false);
  // All saves are versioned and run serially. Navigation can be optimistic.
  const queue = useRef<Array<{ questionId: string; optionId: string }>>([]);
  const writing = useRef(false);
  const writeBlocked = useRef(false);
  const versionRef = useRef(exam.answerVersion);
  const [queuedCount, setQueuedCount] = useState(0);
  const failed = Object.values(errors).some(Boolean) || Boolean(saveIssue);
  const answered = Object.keys(answers).length;
  // Practice answers must be saved immediately for "Check answer".
  // Exam mode stores draft selections only in this browser until confirmation.
  const pendingAnswers = examMode ? false : saving || queuedCount > 0;
  // Preserve the current question and any unsaved selection while accepting
  // confirmed changes from another tab. A conflict requires explicit review.
  if (previousExam !== exam && exam.answerVersion >= version && !localChanges && !submitting && !saving && !writing.current && queue.current.length === 0 && !checking && !failed) {
    setPreviousExam(exam); setVersion(exam.answerVersion); versionRef.current = exam.answerVersion;
    setAnswers(Object.fromEntries(exam.questions.filter(q => q.selectedOptionId).map(q => [q.id,q.selectedOptionId!])));
    setFeedback(Object.fromEntries(exam.questions.filter(q => q.correctOptionId !== undefined).map(q => [q.id,{ outcome:q.outcome!,correctOptionId:q.correctOptionId! }])));
  }
  // Keep in-progress exam-mode selections in the current browser tab across
  // accidental reloads. This is not a server save and never grades an answer.
  useEffect(() => {
    if (readOnly || !examMode) { setDraftReady(true); return; }
    try {
      const raw = window.sessionStorage.getItem(`lhcc:exam-draft:${exam.id}`);
      if (raw) {
        const draft = JSON.parse(raw) as { version?: number; answers?: Record<string,unknown> };
        if (draft && draft.version === exam.answerVersion && draft.answers && typeof draft.answers === "object") {
          const allowed = new Map(exam.questions.map(q => [q.id, new Set(q.options.map(o => o.id))]));
          const restored: Record<string,string> = {};
          for (const [id, optionId] of Object.entries(draft.answers)) {
            if (typeof optionId === "string" && allowed.get(id)?.has(optionId)) restored[id] = optionId;
          }
          if (Object.keys(restored).length) { setAnswers(previous => ({ ...previous, ...restored })); setLocalChanges(true); }
        }
      }
    } catch {
      // Session storage is optional; a restricted browser can still run exams.
    }
    setDraftReady(true);
  }, [exam.id,exam.answerVersion,exam.questions,examMode,readOnly]);
  useEffect(() => {
    if (!draftReady || readOnly || !examMode || submitting) return;
    try { window.sessionStorage.setItem(`lhcc:exam-draft:${exam.id}`, JSON.stringify({ version: exam.answerVersion, answers })); } catch { /* restricted browser */ }
  }, [answers,draftReady,readOnly,examMode,exam.id,exam.answerVersion,submitting]);
  useEffect(() => {
    if (!submitting) return;
    setProcessingStep("saving");
    const grading = window.setTimeout(() => setProcessingStep("grading"), 950);
    const preparing = window.setTimeout(() => setProcessingStep("preparing"), 2200);
    return () => { window.clearTimeout(grading); window.clearTimeout(preparing); };
  }, [submitting]);

  // The validated snapshot is nonempty, and navigation only selects persisted indices.
  const question = exam.questions[index]!; const checked = feedback[question.id];
  const expired = remaining !== null && remaining <= 0;
  const finish = useCallback(async (automatic = false) => {
    if (readOnly || submitLock.current || locks.current || (examMode && !draftReady)
      || (!examMode && (writing.current || queue.current.length > 0 || (failed && !automatic)))) return;
    // Native modal dialogs render in the browser's top layer. Close the
    // confirmation first so the full-screen progress overlay is visible
    // immediately after the student confirms submission.
    const wasConfirming = Boolean(dialog.current?.open);
    if (wasConfirming) dialog.current?.close();
    submitLock.current = true; setSubmitting(true); setProcessingStep("saving"); setSubmitError("");
    let completed = false;
    try {
      const result = examMode
        ? await submitExamWithAnswers({ attemptId: exam.id, answers, expectedVersion: versionRef.current })
        : await submitExam(exam.id);
      if (result.ok) {
        completed = true;
        setProcessingStep("done");
        try { window.sessionStorage.removeItem(`lhcc:exam-draft:${exam.id}`); } catch { /* restricted browser */ }
        dialog.current?.close();
        // Results are loaded from the completed server snapshot, never from
        // guessed client-side scoring or a cached in-progress route.
        window.location.replace(`/student/exams/${exam.id}/result`);
      } else {
        setSubmitError(result.error.message);
      }
    } catch {
      setSubmitError("Submission could not be confirmed. Your selected answers are still available here. Please retry.");
    } finally {
      // Keep the progress screen visible until successful navigation.
      // If saving or grading fails, dismiss it and reopen the confirmation
      // with the error, so the student can retry without losing selections.
      if (!completed) {
        submitLock.current = false;
        setSubmitting(false);
        if (wasConfirming && !dialog.current?.open) dialog.current?.showModal();
      }
    }
  }, [exam.id,answers,examMode,draftReady,failed,readOnly]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (saving || checking || submitting || failed || (examMode && localChanges)) event.preventDefault();
    };
    window.addEventListener("beforeunload",handler); return () => window.removeEventListener("beforeunload",handler);
  }, [saving,checking,submitting,failed,examMode,localChanges]);
  useEffect(() => {
    if (!exam.deadlineAt) return;
    const tick = () => setRemaining(Math.max(0,Math.ceil((Date.parse(exam.deadlineAt!)-Date.now())/1000)));
    tick(); const interval = window.setInterval(tick,1000); return () => window.clearInterval(interval);
  }, [exam.deadlineAt]);
  useEffect(() => {
    if (expired && draftReady && !readOnly && !saving && !checking && !submitting && !autoSubmitted.current) { autoSubmitted.current = true; void finish(true); }
  }, [expired,draftReady,readOnly,saving,checking,submitting,finish]);
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
    if (readOnly || expired || checked || submitting || checking || locks.current || submitLock.current || (writeBlocked.current && !examMode)) return;
    const chosenId = question.id;
    if (answers[chosenId] !== optionId) {
      setAnswers(previous => ({ ...previous, [chosenId]: optionId }));
      if (examMode) {
        // No network requests or grading during exam selection.
        setLocalChanges(true);
      } else {
        // Practice mode retains its existing versioned save/check workflow.
        setErrors(previous => ({ ...previous, [chosenId]: "" }));
        const queuedIndex = queue.current.findIndex((entry,position) =>
          position >= (writing.current ? 1 : 0) && entry.questionId === chosenId,
        );
        if (queuedIndex >= 0) queue.current[queuedIndex] = { questionId: chosenId, optionId };
        else queue.current.push({ questionId: chosenId, optionId });
        setQueuedCount(queue.current.length);
        void flushAnswers();
      }
    }
    if (examMode && index < exam.questions.length - 1) {
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
      setErrors({});
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
  function backToCourse() {
    // Do not leave while a queued answer is unsaved or being checked.
    if (pendingAnswers || failed || checking || submitting || locks.current || submitLock.current) return;
    if (examMode && localChanges && !window.confirm("Your exam has not been submitted. Selected answers are saved only in this tab. Leave the exam?")) return;
    router.push(`/student/banks/${exam.bankId}` as Route);
  }
  return <div className="mx-auto min-w-0 max-w-5xl space-y-5">
    {!readOnly && <div className="flex items-center justify-between">
      <button type="button" onClick={backToCourse}
        disabled={pendingAnswers || failed || checking || submitting}
        className="lhcc-desktop-back group min-h-11 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold text-teal-800 shadow-sm transition-[border-color,background-color,transform] duration-150 hover:border-teal-600 hover:bg-teal-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-900 dark:text-teal-200"
        aria-label="Back to course" title="Back to course">
        <ArrowLeft aria-hidden="true" className="size-[18px] transition-transform duration-150 motion-safe:group-hover:-translate-x-0.5" strokeWidth={2} />
        <span>Back to course</span>
      </button>
    </div>}
    <header className="overflow-hidden rounded-3xl border border-t-4 border-t-teal-600 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="text-sm font-medium text-teal-700 dark:text-teal-200">{exam.learningMode === "PRACTICE" ? "Practice · feedback after checking" : "Exam · feedback after submission"}</p><h1 className="mt-2 break-words text-2xl font-semibold text-slate-950">{exam.title ?? exam.bankName}{exam.year ? ` · ${exam.year}` : ""}</h1><p className="mt-2 text-sm text-slate-600">{exam.bankName}</p></div>{remaining !== null && <p className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 font-mono text-slate-900" aria-label="Time remaining"><Clock className="size-4" />{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,"0")}</p>}</div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="font-semibold text-slate-800">Answered {answered} of {exam.totalQuestions}</p>
        {examMode
          ? <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <ShieldCheck className="size-4 text-teal-700 dark:text-teal-300" aria-hidden="true" />
              Your answers will be saved when you submit
            </p>
          : <p role="status" aria-live="polite" className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${failed ? "border-rose-300 text-rose-700" : pendingAnswers ? "border-amber-300 text-amber-700" : "border-emerald-300 text-emerald-700"}`}>
              <span className={`size-2 rounded-full ${failed ? "bg-rose-500" : pendingAnswers ? "bg-amber-500" : "bg-emerald-500"}`} aria-hidden="true" />
              {failed ? "Save failed — action required" : pendingAnswers ? "Saving answers…" : "All answers saved"}
            </p>}
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
      {exam.learningMode === "EXAM" && !readOnly && !expired && <p className="mt-4 text-xs text-slate-500">Your selections are kept in this tab and saved to the exam when you confirm submission. Use Previous or the navigator to review them.</p>}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5"><button disabled={index===0 || checking || submitting} onClick={() => navigate(index-1)} className="inline-flex min-h-11 items-center gap-1 rounded-xl border px-3 text-sm font-semibold disabled:opacity-40"><ChevronLeft className="size-4" />Previous</button>{exam.learningMode === "PRACTICE" && !readOnly && <button disabled={!answers[question.id] || failed || pendingAnswers || checking || Boolean(checked) || expired} onClick={() => void check()} className="min-h-11 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white disabled:opacity-40">{checking ? "Checking…" : checked ? "Checked" : "Check answer"}</button>}<button disabled={index===exam.questions.length-1 || checking || submitting} onClick={() => navigate(index+1)} className="inline-flex min-h-11 items-center gap-1 rounded-xl border px-3 text-sm font-semibold disabled:opacity-40">Next<ChevronRight className="size-4" /></button></div>
    </section>
    <nav aria-label="Question navigator" className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="inline-flex items-center gap-2 font-semibold text-slate-950"><ListChecks aria-hidden="true" className="size-[18px] text-teal-700" strokeWidth={2} />Question navigator</h2><p className="mt-1 text-xs text-slate-500">Jump to any question, including answered ones.</p></div>
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
    {!readOnly && <div className="pb-5"><button disabled={pendingAnswers || checking || (failed && !expired) || submitting || (examMode && !draftReady)} onClick={() => expired ? void finish(true) : dialog.current?.showModal()} className="min-h-12 rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white disabled:opacity-50">{submitting ? "Finishing…" : "Finish & Submit Exam"}</button><p className="mt-3 text-sm text-slate-500">You'll confirm before answers are saved, graded, and finalized. Unanswered questions count toward your final score.</p></div>}
    <dialog ref={dialog} aria-labelledby="submit-exam-title"
      onCancel={event => { if (submitting) event.preventDefault(); }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 text-slate-700 shadow-2xl backdrop:bg-slate-950/65 dark:border-slate-700 dark:bg-slate-900 sm:p-7">
      <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-slate-800 dark:text-teal-200"><ShieldCheck className="size-6" aria-hidden="true" /></div>
      <h2 id="submit-exam-title" className="mt-4 text-xl font-bold text-slate-950">Ready to submit your exam?</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Are you sure? Your answers will be saved and graded together. You cannot edit them once submission is complete.</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-teal-50 p-4 dark:bg-slate-800"><p className="text-xs text-slate-600">Answered</p><p className="mt-1 text-2xl font-bold text-teal-800 dark:text-teal-200">{answered}</p></div>
        <div className="rounded-xl bg-slate-100 p-4 dark:bg-slate-800"><p className="text-xs text-slate-600">Unanswered</p><p className="mt-1 text-2xl font-bold text-slate-800">{exam.totalQuestions-answered}</p></div>
      </div>
      {submitError && <p role="alert" className="mt-4 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">{submitError}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button disabled={submitting} onClick={() => dialog.current?.close()} className="min-h-11 rounded-xl border px-4 text-sm font-semibold">Keep reviewing</button>
        <button disabled={submitting || pendingAnswers || checking || (failed && !examMode)} onClick={() => void finish()}
          className="min-h-11 rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">{submitting ? "Processing…" : "Yes, submit exam"}</button>
      </div>
    </dialog>
    {submitting && <div role="status" aria-live="polite" aria-busy="true"
      className="fixed inset-0 z-[100] flex min-h-dvh items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur-md">
      <div className="w-full max-w-md rounded-3xl border border-white/15 bg-[#112632] p-7 text-center text-white shadow-2xl sm:p-9">
        <div className="relative mx-auto grid size-20 place-items-center rounded-3xl bg-teal-400/10">
          {processingStep === "done" ? <Check className="size-10 text-emerald-300" aria-hidden="true" /> : <LoaderCircle className="size-10 animate-spin text-teal-300 motion-reduce:animate-none" aria-hidden="true" />}
        </div>
        <h2 className="mt-6 text-xl font-bold">{processingStep === "done" ? "Exam submitted successfully" : "Finishing your exam"}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">{processingStep === "done" ? "Your result is ready. Opening it now…" : "Please keep this page open while we securely save your answers and prepare your results."}</p>
        <div className="mt-7 space-y-3 text-left">
          {[
            { step: "saving", label: "Saving your answers", Icon: ShieldCheck },
            { step: "grading", label: "Analyzing and grading questions", Icon: BarChart3 },
            { step: "preparing", label: "Preparing your result and correct answers", Icon: FileCheck2 },
          ].map((item, i) => {
            const steps = ["saving","grading","preparing","done"];
            const activeStep = steps.indexOf(processingStep);
            return <div key={item.step} className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${processingStep === "done" || i === activeStep ? "border-teal-400/30 bg-teal-400/10" : "border-white/10 bg-white/[0.03]"}`}>
              {processingStep === "done"
                ? <Check className="size-5 shrink-0 text-emerald-300" aria-hidden="true" />
                : <item.Icon className={`size-5 shrink-0 ${i === activeStep ? "text-teal-300" : "text-slate-500"}`} aria-hidden="true" />}
              <span className={`text-sm ${processingStep === "done" || i === activeStep ? "font-semibold text-white" : "text-slate-400"}`}>{item.label}</span>
              {i === activeStep && processingStep !== "done" && <LoaderCircle className="ml-auto size-4 animate-spin text-teal-300 motion-reduce:animate-none" aria-hidden="true" />}
            </div>;
          })}
        </div>
        <p className="mt-5 text-xs text-slate-400">This may take a moment. Please do not close the page.</p>
      </div>
    </div>}
  </div>;
}
