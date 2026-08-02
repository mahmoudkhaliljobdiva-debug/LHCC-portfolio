"use client";

import { ArrowLeft, CheckCircle2, Plus, Trash2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAdminQuestionBanks } from "@/features/question-banks/admin-question-bank-provider";
import { cn } from "@/lib/cn";
import type { AdminQuestion, AdminQuestionBank, QuestionAnswer, QuestionBankStatus, QuestionInput } from "@/types/question-bank";

type EditableAnswer = QuestionAnswer;

export function AdminQuestionForm({ bankId, questionId }: { readonly bankId: string; readonly questionId?: string | undefined }) {
  const store = useAdminQuestionBanks();
  const bank = store.getQuestionBankById(bankId);
  const existingQuestion = questionId ? store.getQuestionById(questionId) : undefined;

  if (!store.isReady) return <div className="h-96 animate-pulse rounded-2xl border bg-white" aria-label="Loading question form" />;
  if (!bank) return <MissingState title="Question bank not found" href={"/admin/question-banks" as Route} label="Back to Question Banks" />;
  if (questionId && (!existingQuestion || existingQuestion.bankId !== bankId)) return <MissingState title="Question not found in this bank" href={`/admin/question-banks/${bankId}` as Route} label={`Back to ${bank.name}`} />;

  return <ReadyAdminQuestionForm bank={bank} existingQuestion={existingQuestion} />;
}

function ReadyAdminQuestionForm({ bank, existingQuestion }: { readonly bank: AdminQuestionBank; readonly existingQuestion: AdminQuestion | undefined }) {
  const router = useRouter();
  const store = useAdminQuestionBanks();
  const bankId = bank.id;
  const initialAnswers = useMemo<readonly EditableAnswer[]>(() => existingQuestion?.answers ?? [
    { id: "new-answer-1", text: "", isCorrect: false },
    { id: "new-answer-2", text: "", isCorrect: false },
  ], [existingQuestion]);
  const [text, setText] = useState(existingQuestion?.text ?? "");
  const [status, setStatus] = useState<QuestionBankStatus>(existingQuestion?.status ?? "active");
  const [answers, setAnswers] = useState<readonly EditableAnswer[]>(initialAnswers);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const isEdit = Boolean(existingQuestion);
  const isDirty = text !== (existingQuestion?.text ?? "") || status !== (existingQuestion?.status ?? "active") || JSON.stringify(answers) !== JSON.stringify(initialAnswers);

  useEffect(() => {
    function warn(event: BeforeUnloadEvent) { if (isDirty) event.preventDefault(); }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  function updateAnswer(id: string, value: string) {
    setAnswers((current) => current.map((answer) => answer.id === id ? { ...answer, text: value } : answer));
    setErrors((current) => ({ ...current, [`answer.${id}`]: "", answers: "" }));
  }

  function selectCorrect(id: string) {
    setAnswers((current) => current.map((answer) => ({ ...answer, isCorrect: answer.id === id })));
    setErrors((current) => ({ ...current, correctAnswer: "" }));
  }

  function removeAnswer(id: string) {
    setAnswers((current) => current.filter((answer) => answer.id !== id));
    setErrors((current) => ({ ...current, answers: "", correctAnswer: "" }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const validationErrors = validateQuestion(text, answers);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setIsSaving(true);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 300));
    const normalizedAnswers = answers.filter((answer) => answer.text.trim()).map((answer) => ({ ...answer, text: answer.text.trim() }));
    const input: QuestionInput = { text: text.trim(), status, answers: normalizedAnswers };
    if (existingQuestion) store.updateQuestion(existingQuestion.id, input);
    else store.addQuestion(bankId, input);
    router.push(`/admin/question-banks/${bankId}?saved=${existingQuestion ? "updated" : "created"}`);
  }

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-xs text-slate-500"><Link href="/admin/question-banks">Question Banks</Link><span>/</span><Link href={`/admin/question-banks/${bank.id}`}>{bank.name}</Link><span>/</span><span className="text-slate-700">{isEdit ? "Edit question" : "New question"}</span></nav>
      <div className="mb-7"><Link href={`/admin/question-banks/${bank.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700"><ArrowLeft className="size-4" />Back to {bank.name}</Link><h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{isEdit ? "Edit QCU question" : "Add QCU question"}</h1><p className="mt-2 text-sm text-slate-500">Question à Choix Unique requires exactly one correct answer.</p></div>

      <form onSubmit={submit} className="grid gap-6">
        <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
          <h2 className="font-semibold text-slate-950">Question details</h2>
          <div className="mt-5 grid gap-5">
            <label className="grid gap-2 text-sm font-medium text-slate-700">Question text <span className="sr-only">required</span><textarea rows={5} value={text} onChange={(event) => { setText(event.target.value); setErrors((current) => ({ ...current, text: "" })); }} aria-invalid={Boolean(errors.text)} className={cn("rounded-xl border bg-slate-50 px-3.5 py-3 text-sm", errors.text && "border-rose-400")} />{errors.text && <span className="text-xs text-rose-700">{errors.text}</span>}</label>
            <label className="grid max-w-xs gap-2 text-sm font-medium text-slate-700">Status<select value={status} onChange={(event) => setStatus(event.target.value as QuestionBankStatus)} className="h-11 rounded-xl border bg-slate-50 px-3"><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-slate-950">Answers</h2><p className="mt-1 text-xs text-slate-500">Add at least two answers and select exactly one correct answer.</p></div><button type="button" onClick={() => setAnswers((current) => [...current, createAnswer()])} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Plus className="size-4" />Add Another Answer</button></div>
          {(errors.answers || errors.correctAnswer || errors.duplicateAnswers) && <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{errors.answers || errors.correctAnswer || errors.duplicateAnswers}</div>}
          <fieldset className="mt-5 grid gap-4"><legend className="sr-only">Select the one correct answer</legend>{answers.map((answer, index) => <div key={answer.id} className="rounded-xl border bg-slate-50 p-4"><div className="flex items-start gap-3"><label className="mt-3 flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-600"><input type="radio" name="correct-answer" checked={answer.isCorrect} onChange={() => selectCorrect(answer.id)} className="size-4 accent-teal-700" /><span className="hidden sm:inline">Correct</span></label><label className="min-w-0 flex-1 text-sm font-medium text-slate-700">Answer {index + 1}<input value={answer.text} onChange={(event) => updateAnswer(answer.id, event.target.value)} aria-invalid={Boolean(errors[`answer.${answer.id}`])} className={cn("mt-2 h-11 w-full rounded-xl border bg-white px-3.5 text-sm", errors[`answer.${answer.id}`] && "border-rose-400")} />{errors[`answer.${answer.id}`] && <span className="mt-1 block text-xs text-rose-700">{errors[`answer.${answer.id}`]}</span>}</label><button type="button" disabled={answers.length <= 2} onClick={() => removeAnswer(answer.id)} aria-label={`Remove answer ${index + 1}`} className="mt-7 rounded-lg border p-2 text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="size-4" /></button></div></div>)}</fieldset>
        </section>

        <div className="sticky bottom-4 z-10 flex flex-col-reverse gap-3 rounded-2xl border bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:justify-end"><Link href={`/admin/question-banks/${bank.id}`} className="rounded-xl border px-5 py-3 text-center text-sm font-semibold text-slate-700">Cancel</Link><button type="submit" disabled={isSaving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 className="size-4" />{isSaving ? "Saving…" : "Save Question"}</button></div>
      </form>
    </div>
  );
}

function validateQuestion(text: string, answers: readonly EditableAnswer[]): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!text.trim()) errors.text = "Question text is required.";
  const nonEmptyAnswers = answers.filter((answer) => answer.text.trim());
  if (nonEmptyAnswers.length < 2) errors.answers = "At least two non-empty answers are required.";
  answers.forEach((answer) => { if (!answer.text.trim()) errors[`answer.${answer.id}`] = "Answer text is required."; });
  const normalized = nonEmptyAnswers.map((answer) => answer.text.trim().toLocaleLowerCase());
  if (new Set(normalized).size !== normalized.length) errors.duplicateAnswers = "Duplicate answers are not allowed within the same question.";
  const correctAnswers = nonEmptyAnswers.filter((answer) => answer.isCorrect);
  if (correctAnswers.length !== 1) errors.correctAnswer = "Select exactly one correct answer.";
  if (answers.some((answer) => answer.isCorrect && !answer.text.trim())) errors.correctAnswer = "The correct answer must be a non-empty answer in the current list.";
  return errors;
}

function createAnswer(): EditableAnswer { return { id: crypto.randomUUID(), text: "", isCorrect: false }; }

function MissingState({ title, href, label }: { readonly title: string; readonly href: Route; readonly label: string }) { return <div className="rounded-2xl border bg-white p-8 text-center"><h1 className="text-xl font-semibold text-slate-950">{title}</h1><Link href={href} className="mt-5 inline-flex rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white">{label}</Link></div>; }
