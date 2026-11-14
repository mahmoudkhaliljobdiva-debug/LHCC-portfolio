import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { readAllRows } from "@/lib/supabase/pagination";

type AnswerOption = { id: string; text: string };

function readableOptions(value: unknown): AnswerOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((option: unknown) => {
    if (!option || typeof option !== "object") return [];
    const item = option as Record<string, unknown>;
    if (typeof item.id !== "string" || typeof item.text !== "string") return [];
    return [{ id: item.id, text: item.text }];
  });
}

export default async function SubjectQuestionsPage({
  params,
}: {
  readonly params: Promise<{ bankId: string }>;
}) {
  await requireRole("ADMIN");
  const { bankId } = await params;
  const db = await createClient();
  const { data: subject, error: subjectError } = await db.from("question_banks")
    .select("id,name,material_kind")
    .eq("id", bankId)
    .eq("material_kind", "SUBJECT")
    .maybeSingle();

  if (subjectError) throw new Error("Unable to load the subject.");
  if (!subject) notFound();

  // The admin-only RLS policy permits inspection of subject questions.
  // Subject writes deliberately use the separate, verified lesson-authoring workflow.
  const questions = await readAllRows(
    (from, to) => db.from("bank_questions")
      .select("id,text,status,options,display_order")
      .eq("question_bank_id", bankId)
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .order("id")
      .range(from, to),
    "Unable to load subject questions.",
  );

  return <main className="space-y-6">
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
      <Link href="/admin/subjects" className="font-medium text-teal-700 hover:underline dark:text-teal-300">Subjects</Link>
      <span aria-hidden="true">/</span>
      <span>{subject.name}</span>
      <span aria-hidden="true">/</span>
      <span>Questions</span>
    </nav>
    <header className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 sm:p-7">
      <h1 className="text-2xl font-semibold text-slate-950 dark:text-slate-50 sm:text-3xl">{subject.name} questions</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        {questions.length} {questions.length === 1 ? "question" : "questions"} currently imported into this subject.
      </p>
      <p className="mt-3 text-sm leading-6 text-amber-800 dark:text-amber-200">
        This is a read-only view of verified existing records. PDF import and editing for subjects
        are separate from exam-track question management; missing questions are not yet imported.
      </p>
      <Link href={`/admin/subjects/${encodeURIComponent(bankId)}/lessons`}
        className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-teal-700 dark:border-slate-600 dark:text-teal-300">
        Chapters &amp; lessons
      </Link>
    </header>
    {questions.length === 0 ? <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-7 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="font-semibold text-slate-950 dark:text-slate-50">No imported questions yet</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        The source PDF still requires verified extraction and import. No questions have been removed.
      </p>
    </section> : <ol className="space-y-4">
      {questions.map((question, index) => <li key={question.id}>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-teal-800 dark:text-teal-300">Question {question.display_order ?? index + 1}</h2>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{question.status}</span>
          </div>
          <p className="whitespace-pre-wrap break-words text-base leading-7 text-slate-900 dark:text-slate-100">{question.text}</p>
          <ol className="mt-5 space-y-2">
            {readableOptions(question.options).map(option => <li key={option.id}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
              <span className="mr-2 font-semibold">{option.id.toUpperCase()}.</span>
              <span className="whitespace-pre-wrap break-words">{option.text}</span>
            </li>)}
          </ol>
        </article>
      </li>)}
    </ol>}
  </main>;
}
