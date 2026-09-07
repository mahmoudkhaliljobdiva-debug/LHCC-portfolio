"use client";
import { useState, useTransition } from "react";
import { submitBankAnswer } from "@/actions/bank-access";
import type { StudentQuestion } from "@/types/bank-access";
export function CourseQuestions({ questions }: { readonly questions: StudentQuestion[] }) {
  if (!questions.length) return <p className="rounded-2xl border bg-white p-6 text-slate-600">Your access is approved. Questions will appear here when published.</p>;
  return <div className="grid gap-5">{questions.map((question) => <Question key={question.id} question={question} />)}</div>;
}
function Question({ question }: { readonly question: StudentQuestion }) {
  const [selected, setSelected] = useState("");
  const [feedback, setFeedback] = useState("");
  const [pending, startTransition] = useTransition();
  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      try {
        const result = await submitBankAnswer(question.id, selected);
        setFeedback(result.ok ? result.data ? "Correct answer." : "That answer is incorrect. Try again." : result.error.message);
      } catch { setFeedback("Unable to submit your answer. Please try again."); }
    });
  }
  return <form onSubmit={submit} className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6"><fieldset disabled={pending}><legend className="font-semibold text-slate-950">{question.text}</legend><div className="mt-5 grid gap-3">{question.options.map((option) => <label key={option.id} className="flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm text-slate-700"><input required type="radio" name={question.id} value={option.id} checked={selected === option.id} onChange={() => { setSelected(option.id); setFeedback(""); }} />{option.text}</label>)}</div></fieldset><button disabled={pending || !selected} className="mt-5 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Checking…" : "Submit Answer"}</button>{feedback && <p role="status" className="mt-4 text-sm text-slate-700">{feedback}</p>}</form>;
}
