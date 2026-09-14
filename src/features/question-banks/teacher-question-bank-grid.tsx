import { BookOpen } from "lucide-react";

import type { TeacherBankSummary } from "@/lib/data/server";

export function TeacherQuestionBankGrid({ banks }: { readonly banks: readonly TeacherBankSummary[] }) {
  if (!banks.length) return <div className="rounded-2xl border border-dashed bg-white px-6 py-16 text-center"><BookOpen className="mx-auto size-9 text-slate-400" /><h2 className="mt-4 font-semibold text-slate-900">No active question banks are available.</h2></div>;
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{banks.map((bank) => <article key={bank.id} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-xl bg-teal-50 text-teal-700"><BookOpen className="size-5" /></span><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Published</span></div><h2 className="mt-5 font-semibold text-slate-950">{bank.name}</h2><p className="mt-2 min-h-10 text-sm leading-5 text-slate-500">{bank.description}</p><dl className="mt-5 grid grid-cols-3 gap-3 border-t pt-4 text-sm"><div><dt className="text-xs text-slate-500">Questions</dt><dd className="mt-1 font-semibold text-slate-900">{bank.questionCount}</dd></div><div><dt className="text-xs text-slate-500">Attempts</dt><dd className="mt-1 font-semibold text-slate-900">{bank.attempts}</dd></div><div><dt className="text-xs text-slate-500">Average</dt><dd className="mt-1 font-semibold text-slate-900">{bank.averageScore}%</dd></div></dl></article>)}</div>;
}
