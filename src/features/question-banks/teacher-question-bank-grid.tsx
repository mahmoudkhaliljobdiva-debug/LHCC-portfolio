import { BookOpen } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import type { TeacherBankSummary } from "@/lib/data/server";

export function TeacherQuestionBankGrid({ banks, previewBase }: { readonly banks: readonly TeacherBankSummary[]; readonly previewBase?: string }) {
  if (!banks.length) return <div className="rounded-2xl border border-dashed bg-white px-6 py-16 text-center"><BookOpen className="mx-auto size-9 text-slate-400" /><h2 className="mt-4 font-semibold text-slate-900">No active question banks are assigned.</h2><p className="mt-2 text-sm text-slate-500">Ask your administrator to assign a question bank.</p></div>;
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{banks.map(bank => <article key={bank.id} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-xl bg-teal-50 text-teal-700"><BookOpen className="size-5" /></span><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Assigned</span></div><h2 className="mt-5 font-semibold text-slate-950">{bank.name}</h2><p className="mt-2 text-sm leading-5 text-slate-500">{bank.description}</p><p className="mt-5 border-t pt-4 text-sm text-slate-600">{bank.questionCount} questions</p><Link prefetch={false} href={(previewBase ? `${previewBase}/banks/${bank.id}` : `/teacher/question-banks/${bank.id}`) as Route} className="mt-4 inline-flex rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white">{previewBase ? "View Questions" : "View / Add Questions"}</Link></article>)}</div>;
}
