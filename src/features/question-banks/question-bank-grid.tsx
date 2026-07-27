import { ArrowRight, BookOpen } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { QUESTION_BANKS } from "@/data/question-banks.mock";

export function QuestionBankGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {QUESTION_BANKS.map((bank) => {
        const progress = Math.round((bank.completedCount / bank.questionCount) * 100);
        return (
          <article key={bank.id} className="group rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between">
              <span className="grid size-11 place-items-center rounded-xl bg-teal-50 text-teal-700"><BookOpen className="size-5" /></span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{bank.difficulty}</span>
            </div>
            <h3 className="mt-5 font-semibold text-slate-950">{bank.title}</h3>
            <p className="mt-2 min-h-10 text-sm leading-5 text-slate-500">{bank.description}</p>
            <div className="mt-6"><Progress value={progress} label={`${bank.completedCount} of ${bank.questionCount} completed`} /></div>
            <div className="mt-5 flex items-center justify-between border-t pt-4 text-sm">
              <span className="text-slate-500">Average <strong className="text-slate-900">{bank.averageScore}%</strong></span>
              <button className="text-teal-700" aria-label={`Open ${bank.title}`}><ArrowRight className="size-4" /></button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

