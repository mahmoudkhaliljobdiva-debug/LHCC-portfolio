import Link from "next/link";
import type { Route } from "next";
import { requireRole } from "@/lib/auth/server";
import { getPortalPreviewContext } from "@/lib/portal-preview/server";
import { createClient } from "@/lib/supabase/server";
import { readAllRows } from "@/lib/supabase/pagination";

export async function ExamHistory({ subjectId, previewBase }: { subjectId?: string; previewBase?: string }) {
  const profile = subjectId ? (await getPortalPreviewContext("student",subjectId)).subject : await requireRole("STUDENT");
  const db = await createClient();
  const attempts = await readAllRows((from,to) => db.from("question_attempts").select("id,question_bank_id,bank_name_snapshot,status,started_at,total_questions,score_percentage")
    .eq("student_id",profile.id).eq("mode","EXAM").neq("status","ABANDONED").order("started_at", { ascending:false }).order("id").range(from,to));
  return <section className="rounded-2xl border bg-white p-5 sm:p-7"><h1 className="text-2xl font-semibold text-slate-950">Your Exams</h1><p className="mt-2 text-sm text-slate-600">Saved exams, progress, and completed results.</p>{!attempts.length ? <p className="mt-6 text-slate-500">No exams yet. Open an approved question bank to start.</p> : <ul className="mt-5 divide-y">{attempts.map(a => <li key={a.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><h2 className="font-semibold text-slate-950">{a.bank_name_snapshot}</h2><p className="mt-1 text-sm text-slate-500">{a.total_questions} questions · {a.status === "COMPLETED" ? `${Number(a.score_percentage).toFixed(2)}%` : "In progress"}</p></div><Link className="rounded-xl border px-4 py-3 text-sm font-semibold text-slate-700" href={`${previewBase ?? "/student"}/exams/${a.id}` as Route}>{a.status === "COMPLETED" ? "View Result" : previewBase ? "Inspect Exam" : "Continue Exam"}</Link></li>)}</ul>}<Link href={`${previewBase ?? "/student"}/question-banks` as Route} className="mt-5 inline-block py-3 font-semibold text-teal-700 dark:text-teal-200">Browse Question Banks</Link></section>;
}
