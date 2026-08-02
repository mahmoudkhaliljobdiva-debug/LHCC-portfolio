"use client";

import { ArrowRight, BookOpen, LockKeyhole } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { QUESTION_BANKS } from "@/data/question-banks.mock";
import { useUserManagement } from "@/features/users/user-management-provider";
import { getDemoSession } from "@/services/demo-session";

export function QuestionBankGrid() {
  const { hasUserBankAccess, isReady } = useUserManagement();
  const session = isReady ? getDemoSession() : null;

  // Frontend bank access is for demo purposes only.
  // Production bank authorization must be enforced by the backend.
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {QUESTION_BANKS.map((bank) => {
        const progress = Math.round((bank.completedCount / bank.questionCount) * 100);
        const hasAccess = Boolean(session && hasUserBankAccess(session.userId, bank.id));
        return (
          <article key={bank.id} className="group rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-start justify-between">
              <span className="grid size-11 place-items-center rounded-xl bg-teal-50 text-teal-700"><BookOpen className="size-5" /></span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${hasAccess ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{hasAccess ? "Access granted" : "Locked"}</span>
            </div>
            <h3 className="mt-5 font-semibold text-slate-950">{bank.title}</h3>
            <p className="mt-2 min-h-10 text-sm leading-5 text-slate-500">{bank.description}</p>
            <div className="mt-6"><Progress value={progress} label={`${bank.completedCount} of ${bank.questionCount} completed`} /></div>
            <div className="mt-5 flex items-center justify-between border-t pt-4 text-sm">
              <span className="text-slate-500">Average <strong className="text-slate-900">{bank.averageScore}%</strong></span>
              <button type="button" disabled={!hasAccess} className="text-teal-700 disabled:cursor-not-allowed disabled:text-slate-300" aria-label={hasAccess ? `Open ${bank.title}` : `${bank.title} is locked`}>
                {hasAccess ? <ArrowRight className="size-4" /> : <LockKeyhole className="size-4" />}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
