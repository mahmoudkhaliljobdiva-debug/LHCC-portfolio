"use client";

import { ArrowLeft, Edit3, FileQuestion, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useAdminQuestionBanks } from "@/features/question-banks/admin-question-bank-provider";
import { cn } from "@/lib/cn";
import type { AdminQuestion, QuestionBankStatus } from "@/types/question-bank";

export function AdminQuestionBankDetail({ bankId, saved }: { readonly bankId: string; readonly saved?: string | undefined }) {
  const store = useAdminQuestionBanks();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | QuestionBankStatus>("all");
  const [deleteQuestion, setDeleteQuestion] = useState<AdminQuestion | null>(null);
  const [success, setSuccess] = useState(saved === "created" ? "Question added successfully." : saved === "updated" ? "Question updated successfully." : null);
  const bank = store.getQuestionBankById(bankId);
  const bankQuestions = store.getQuestionsByBankId(bankId);
  const visibleQuestions = useMemo(() => bankQuestions.filter((question) => (filter === "all" || question.status === filter) && question.text.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [bankQuestions, filter, search]);

  if (!store.isReady) return <div className="h-80 animate-pulse rounded-2xl border bg-white" aria-label="Loading bank" />;
  if (!bank) return <div className="rounded-2xl border bg-white p-8 text-center"><FileQuestion className="mx-auto size-9 text-slate-400" /><h1 className="mt-4 text-xl font-semibold text-slate-950">Question bank not found</h1><Link href="/admin/question-banks" className="mt-5 inline-flex rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white">Back to Question Banks</Link></div>;

  function confirmDelete() {
    if (!deleteQuestion) return;
    store.deleteQuestion(deleteQuestion.id);
    setSuccess("Question deleted successfully.");
    setDeleteQuestion(null);
  }

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-xs text-slate-500"><Link href="/admin/question-banks" className="hover:text-slate-900">Question Banks</Link><span>/</span><span className="text-slate-700">{bank.name}</span></nav>
      <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div><Link href="/admin/question-banks" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700"><ArrowLeft className="size-4" />Back to Question Banks</Link><div className="mt-5 flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{bank.name}</h1><span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold capitalize", bank.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>{bank.status}</span></div><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">{bank.description}</p><p className="mt-4 text-sm font-medium text-slate-700">{bankQuestions.length} total {bankQuestions.length === 1 ? "question" : "questions"}</p></div>
          <Link href={`/admin/question-banks/${bank.id}/questions/new`} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white"><Plus className="size-4" />Add Question</Link>
        </div>
      </div>

      {success && <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{success}</div>}

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-semibold text-slate-950">Questions</h2><p className="mt-1 text-xs text-slate-500">Only questions assigned to {bank.name} are shown.</p></div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative"><span className="sr-only">Search question text</span><Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search questions" className="h-10 w-full rounded-xl border bg-slate-50 pr-3 pl-9 text-sm sm:w-64" /></label>
            <label><span className="sr-only">Filter by status</span><select value={filter} onChange={(event) => setFilter(event.target.value as "all" | QuestionBankStatus)} className="h-10 w-full rounded-xl border bg-slate-50 px-3 text-sm"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          </div>
        </div>

        {visibleQuestions.length === 0 ? (
          <div className="px-6 py-16 text-center"><FileQuestion className="mx-auto size-9 text-slate-400" /><h3 className="mt-4 font-semibold text-slate-900">{bankQuestions.length === 0 ? `No questions have been added to ${bank.name} yet.` : "No questions match your search and filter."}</h3><p className="mt-2 text-sm text-slate-500">{bankQuestions.length === 0 ? "Add the first QCU question to this bank." : "Try changing the search text or status filter."}</p>{bankQuestions.length === 0 && <Link href={`/admin/question-banks/${bank.id}/questions/new`} className="mt-5 inline-flex rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white">Add Question</Link>}</div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-3 font-medium">Question</th><th className="px-5 py-3 font-medium">Type</th><th className="px-5 py-3 font-medium">Answers</th><th className="px-5 py-3 font-medium">Correct answer</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium">Created</th><th className="px-5 py-3 font-medium"><span className="sr-only">Actions</span></th></tr></thead><tbody>{visibleQuestions.map((question) => <tr key={question.id} className="border-t align-top"><td className="max-w-sm px-5 py-4 font-medium text-slate-900">{question.text}</td><td className="px-5 py-4 text-slate-600"><span title="Question à Choix Unique">QCU</span></td><td className="px-5 py-4 text-slate-600">{question.answers.length}</td><td className="max-w-48 px-5 py-4 text-slate-600">{question.answers.find((answer) => answer.isCorrect)?.text}</td><td className="px-5 py-4"><span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold capitalize", question.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>{question.status}</span></td><td className="px-5 py-4 text-slate-500">{formatDate(question.createdAt)}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><Link aria-label={`Edit ${question.text}`} href={`/admin/question-banks/${bank.id}/questions/${question.id}/edit`} className="rounded-lg border p-2 text-slate-600 hover:bg-slate-50"><Edit3 className="size-4" /></Link><button type="button" aria-label={`Delete ${question.text}`} onClick={() => { setDeleteQuestion(question); setSuccess(null); }} className="rounded-lg border p-2 text-rose-700 hover:bg-rose-50"><Trash2 className="size-4" /></button></div></td></tr>)}</tbody></table></div>
        )}
      </section>

      {deleteQuestion && <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4"><div role="alertdialog" aria-modal="true" aria-labelledby="delete-question-title" className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-2xl"><h2 id="delete-question-title" className="text-lg font-semibold text-slate-950">Delete this question?</h2><p className="mt-3 text-sm leading-6 text-slate-500">“{truncate(deleteQuestion.text, 90)}” will be permanently removed from {bank.name}.</p><div className="mt-6 flex justify-end gap-3"><button type="button" autoFocus onClick={() => setDeleteQuestion(null)} className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button type="button" onClick={confirmDelete} className="rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white">Delete question</button></div></div></div>}
    </div>
  );
}

function truncate(value: string, length: number): string { return value.length > length ? `${value.slice(0, length)}…` : value; }
function formatDate(value: string): string { return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value)); }
