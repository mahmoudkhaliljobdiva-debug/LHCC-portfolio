import Link from "next/link";
import { LearningProgress } from "./learning-progress";
import { RecentAnswers } from "./recent-answers";
import type { Route } from "next";
import { requireRole } from "@/lib/auth/server";
import { getPortalPreviewContext } from "@/lib/portal-preview/server";
import { createClient } from "@/lib/supabase/server";
import { readAllRows } from "@/lib/supabase/pagination";

export async function ExamHistory({ subjectId, previewBase }: { subjectId?: string; previewBase?: string }) {
  const profile = subjectId ? (await getPortalPreviewContext("student",subjectId)).subject : await requireRole("STUDENT");
  const db = await createClient();
  // Completed and in-progress exams remain visible only in the student's
  // enrolled specialty, even if old legacy grants included other specialties.
  const { data: scopedBanks, error: scopeError } = profile.specialty_id
    ? await db.from("question_banks").select("id").eq("specialty_id",profile.specialty_id)
    : {data:[],error:null};
  if (scopeError) throw new Error("Unable to load your specialty history.");
  const allowedIds = (scopedBanks ?? []).map(bank => bank.id);
  const attempts = allowedIds.length ? await readAllRows((from,to) => db.from("question_attempts").select("id,question_bank_id,bank_name_snapshot,status,started_at,total_questions,score_percentage,exam_title_snapshot,exam_year_snapshot,learning_mode,source_kind")
    .eq("student_id",profile.id).in("question_bank_id",allowedIds).eq("mode","EXAM").neq("status","ABANDONED").order("started_at", { ascending:false }).order("id").range(from,to)) : [];
  return <div className="space-y-6"><section className="rounded-2xl border bg-white p-5 sm:p-7"><h1 className="text-2xl font-semibold text-slate-950">My Exams</h1><p className="mt-2 text-sm text-slate-600">Saved exams, progress, and completed results.</p>{!attempts.length ? <p className="mt-6 text-slate-500">No exams yet. Open an approved question bank to start.</p> : <ul className="mt-5 divide-y">{attempts.map(a => <li key={a.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><h2 className="font-semibold text-slate-950">{a.exam_title_snapshot ?? a.bank_name_snapshot}{a.exam_year_snapshot ? ` · ${a.exam_year_snapshot}` : ""}</h2><p className="mt-1 text-xs text-slate-500">{a.bank_name_snapshot} · {a.learning_mode.toLowerCase()} · {a.source_kind.toLowerCase()}</p><p className="mt-1 text-sm text-slate-500">{a.total_questions} questions · {a.status === "COMPLETED" ? `${Number(a.score_percentage).toFixed(2)}%` : "In progress"}</p></div><Link className="rounded-xl border px-4 py-3 text-sm font-semibold text-slate-700" href={`${previewBase ?? "/student"}/exams/${a.id}` as Route}>{a.status === "COMPLETED" ? "View Answers & Result" : previewBase ? "Inspect Exam" : "Continue Exam"}</Link></li>)}</ul>}<Link href={`${previewBase ?? "/student"}/question-banks` as Route} className="mt-5 inline-block py-3 font-semibold text-teal-700 dark:text-teal-200">Browse Question Banks</Link></section>{!subjectId && <RecentAnswers />}{!subjectId && <LearningProgress />}</div>;
}
