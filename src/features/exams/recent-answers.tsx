import Link from "next/link";
import type {Route} from "next";
import {CheckCircle2,XCircle,History} from "lucide-react";
import {getStudentRecentAnswers} from "@/lib/exams/recent-answers-server";

export async function RecentAnswers(){
  const answers=await getStudentRecentAnswers(15);
  return <section aria-labelledby="recent-answers-title" className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
    <div className="flex items-start gap-3">
      <History className="mt-1 size-6 shrink-0 text-teal-700"/>
      <div>
        <h2 id="recent-answers-title" className="text-xl font-semibold text-slate-950">Your latest answers</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">The last 15 answers from your completed exams, with your choice and the correct answer. Only your specialty and completed exam results appear.</p>
      </div>
    </div>
    {!answers.length && <p className="mt-6 rounded-xl border border-dashed p-4 text-sm text-slate-600">Finish an exam to see your recently answered questions and correct choices here.</p>}
    <ol className="mt-5 space-y-4">{answers.map((answer,index)=><li key={`${answer.attemptId}-${answer.questionId}-${index}`}
      className="rounded-xl border border-slate-200 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-teal-700">{answer.examTitle || answer.bankName}</span>
        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${answer.isCorrect?"bg-emerald-100 text-emerald-900":"bg-rose-100 text-rose-900"}`}>
          {answer.isCorrect?<CheckCircle2 className="size-4"/>:<XCircle className="size-4"/>}
          {answer.isCorrect?"Correct":"Incorrect"}
        </span>
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-slate-950">{answer.questionText}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-rose-950 dark:border-rose-700 dark:text-rose-50">
          <p className="text-xs font-semibold text-rose-800 dark:text-rose-200">Your answer</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{answer.selectedText ?? "Unavailable"}</p>
        </div>
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-emerald-950 dark:border-emerald-700 dark:text-emerald-50">
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">Correct answer</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{answer.correctText ?? "Unavailable"}</p>
        </div>
      </div>
      <Link href={`/student/exams/${answer.attemptId}/result` as Route}
        className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-teal-700">
        View full exam review
      </Link>
    </li>)}</ol>
  </section>;
}
