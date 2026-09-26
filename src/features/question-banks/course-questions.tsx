"use client";

import { useState, useTransition } from "react";

import { submitBankAnswer } from "@/actions/bank-access";
import type { RecordedAnswer, StudentQuestion } from "@/types/bank-access";

export function CourseQuestions({ questions, recordedAnswers, readOnly = false }: { readonly questions: StudentQuestion[]; readonly recordedAnswers: RecordedAnswer[]; readonly readOnly?: boolean }) {
  if (!questions.length) {
    return <p className="rounded-2xl border bg-white p-6 text-slate-600">Your access is approved. Questions will appear here when published.</p>;
  }

  const answerMap = new Map(recordedAnswers.map((answer) => [answer.questionId, answer]));
  return <div className="grid gap-5">{questions.map((question) => <Question key={question.id} question={question} recordedAnswer={answerMap.get(question.id)} readOnly={readOnly} />)}</div>;
}

function Question({ question, recordedAnswer, readOnly }: { readonly question: StudentQuestion; readonly recordedAnswer: RecordedAnswer | undefined; readonly readOnly: boolean }) {
  const [selected, setSelected] = useState(recordedAnswer?.selectedOptionId ?? "");
  const [feedback, setFeedback] = useState(recordedAnswer ? recordedAnswer.isCorrect ? "Correct answer." : "That answer is incorrect." : "");
  const [answered, setAnswered] = useState(Boolean(recordedAnswer));
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (readOnly) return;
    startTransition(async () => {
      try {
        const result = await submitBankAnswer(question.id, selected);
        if (result.ok) {
          setAnswered(true);
          setFeedback(result.data.correct ? "Correct answer." : "That answer is incorrect.");
        } else {
          setFeedback(result.error.message);
        }
      } catch {
        setFeedback("Unable to submit your answer. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
      <fieldset disabled={readOnly || pending || answered}>
        <legend className="font-semibold text-slate-950">{question.text}</legend>
        <div className="mt-5 grid gap-3">
          {question.options.map((option) => (
            <label key={option.id} className="flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm text-slate-700">
              <input required type="radio" name={question.id} value={option.id} checked={selected === option.id} onChange={() => { setSelected(option.id); setFeedback(""); }} />
              {option.text}
            </label>
          ))}
        </div>
      </fieldset>
      <button disabled={readOnly || pending || answered || !selected} className="mt-5 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Checking…" : answered ? "Answer recorded" : "Submit Answer"}
      </button>
      {readOnly && <p className="mt-3 text-xs text-slate-500">Read-only preview. Answers and attempts cannot be submitted as this student.</p>}
      {feedback && <p role="status" className="mt-4 text-sm text-slate-700">{feedback}</p>}
    </form>
  );
}
