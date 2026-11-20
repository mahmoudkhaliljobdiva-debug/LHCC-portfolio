import { notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { BookOpen } from "lucide-react";
import { getExamBank } from "@/lib/exams/server";
export default async function Page({ params }: { params: Promise<{ bankId: string }> }) {
  const { bankId } = await params; const bank = await getExamBank(bankId); if (!bank) notFound();
  return <div className="space-y-6"><header><Link href={`/student/banks/${bank.id}` as Route} className="text-sm font-semibold text-teal-700 dark:text-teal-200">Back to {bank.name}</Link>
    <h1 className="mt-4 text-2xl font-semibold text-slate-950">Chapter Questions</h1><p className="mt-2 text-slate-600">Practice or take an exam using a published chapter. Clinical cases retain their context.</p></header>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{bank.chapters.map(chapter => <article key={chapter.id} className="learning-card min-w-0 rounded-2xl border bg-white p-5">
      <BookOpen className="size-6 text-teal-700" aria-hidden="true" /><h2 className="mt-4 break-words font-semibold text-slate-950">{chapter.title}</h2>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{chapter.description}</p><p className="mt-4 text-sm text-slate-500">{chapter.questionCount} available questions · {chapter.completed} completed sessions</p>
      {chapter.bestScore !== null && <p className="mt-2 text-sm text-teal-700 dark:text-teal-200">Best score: {chapter.bestScore.toFixed(2)}%</p>}
      {chapter.questionCount > 0 ? <Link href={`/student/banks/${bank.id}/setup?source=CHAPTER&sourceId=${chapter.id}` as Route} className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-teal-700 px-4 font-semibold text-white">Practice or start exam</Link> : <p className="mt-4 text-sm text-slate-500">No reviewed questions are available yet.</p>}
    </article>)}</div>{!bank.chapters.length && <p className="rounded-2xl border border-dashed bg-white p-6 text-slate-600">No chapters have been published yet. The complete question bank is still available.</p>}</div>;
}
