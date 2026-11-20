"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { addTeacherQuestion } from "@/actions/teacher-questions";
import type { QuestionAnswer } from "@/types/question-bank";

const fieldClass = "mt-2 w-full min-w-0 rounded-xl border bg-white px-4 py-3 text-base text-slate-900 sm:text-sm";

export function TeacherQuestionForm({ bankId }: { readonly bankId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [answers, setAnswers] = useState<readonly QuestionAnswer[]>([{ id: "answer-1", text: "", isCorrect: false }, { id: "answer-2", text: "", isCorrect: false }]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setFeedback(null);
    try {
      const result = await addTeacherQuestion(bankId, { text, status: "active", answers });
      if (!result.ok) { setFeedback({ success: false, message: result.error.message }); return; }
      setText(""); setAnswers([{ id: "answer-1", text: "", isCorrect: false }, { id: "answer-2", text: "", isCorrect: false }]);
      setFeedback({ success: true, message: "Question added successfully." }); router.refresh();
    } catch { setFeedback({ success: false, message: "Unable to add the question. Please try again." }); }
    finally { setSaving(false); }
  }
  return <form onSubmit={submit} className="mt-6 rounded-2xl border bg-white p-5 sm:p-6">
    <h2 className="text-xl font-semibold text-slate-950">Add question</h2>
    <p className="mt-2 text-sm text-slate-500">Provide 2–10 answers and select exactly one correct answer. Existing questions cannot be edited or deleted.</p>
    <fieldset disabled={saving} className="mt-5 min-w-0"><legend className="sr-only">New question and answers</legend>
      <label className="block text-sm font-medium text-slate-700">Question<textarea required maxLength={10000} rows={3} value={text} onChange={event => setText(event.target.value)} className={fieldClass} /></label>
      <div className="mt-4 grid gap-4">{answers.map((answer, index) => <div key={answer.id} className="flex items-center gap-3 rounded-xl border bg-slate-50 p-3"><input type="radio" name="correct-answer" aria-label={`Answer ${index + 1} is correct`} checked={answer.isCorrect} onChange={() => setAnswers(current => current.map(item => ({ ...item, isCorrect: item.id === answer.id })))} className="size-4 shrink-0 accent-teal-700" /><label className="min-w-0 flex-1 text-sm font-medium text-slate-700">Answer {index + 1}<input required maxLength={5000} value={answer.text} onChange={event => setAnswers(current => current.map(item => item.id === answer.id ? { ...item, text: event.target.value } : item))} className={fieldClass} /></label><button type="button" aria-label={`Remove draft answer ${index + 1}`} disabled={answers.length <= 2} onClick={() => setAnswers(current => current.filter(item => item.id !== answer.id))} className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border text-rose-700 disabled:opacity-40"><Trash2 className="size-4" /></button></div>)}</div>
      <button type="button" disabled={answers.length >= 10} onClick={() => setAnswers(current => [...current, { id: crypto.randomUUID(), text: "", isCorrect: false }])} className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-40"><Plus className="size-4" />Add answer</button>
    </fieldset>
    {feedback && <p role={feedback.success ? "status" : "alert"} className={`mt-4 text-sm ${feedback.success ? "text-teal-700" : "text-rose-700"}`}>{feedback.message}</p>}
    <button type="submit" disabled={saving} className="mt-5 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Add Question"}</button>
  </form>;
}
