"use client";

import { Select } from "@/components/ui/select";
import { ChevronDown, Edit3, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAdminQuestionBanks } from "@/features/question-banks/admin-question-bank-provider";
import { DeleteSectionDialog, SectionFormDialog } from "@/features/question-banks/admin-section-dialogs";
import type { AdminQuestion, QuestionBankStatus, QuestionSection, QuestionSectionInput } from "@/types/question-bank";

export function AdminQuestionBankDetail({ bankId, saved }: { readonly bankId: string; readonly saved?: string | undefined }) {
  const store = useAdminQuestionBanks();
  const bank = store.getQuestionBankById(bankId);
  const questions = store.getQuestionsByBankId(bankId);
  const sections = [...store.getSectionsByBankId(bankId)].sort((a, b) => a.displayOrder - b.displayOrder || a.title.localeCompare(b.title));
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | QuestionBankStatus>("all");
  const [editing, setEditing] = useState<QuestionSection | "new" | null>(null);
  const [deleting, setDeleting] = useState<QuestionSection | null>(null);
  const [deleteQuestion, setDeleteQuestion] = useState<AdminQuestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(saved ? { type: "success", message: `Question ${saved} successfully.` } : null);
  const visible = questions.filter(q => (filter === "all" || q.status === filter) && q.text.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  if (!bank) return <div className="rounded-2xl border bg-white p-8 text-center"><h1 className="text-xl font-semibold">Question bank not found</h1><Link href="/admin/question-banks" className="mt-5 inline-flex rounded-xl bg-teal-700 px-4 py-3 text-white">Back to Question Banks</Link></div>;

  async function saveSection(input: QuestionSectionInput) {
    if (editing && editing !== "new") await store.updateSection(editing.id, input);
    else await store.addSection(input);
    setNotice({ type: "success", message: "Clinical case saved successfully." }); setEditing(null);
  }
  async function removeSection() {
    if (!deleting) return;
    await store.deleteSection(deleting.id);
    setNotice({ type: "success", message: "Case deleted. Its questions are now unassigned." }); setDeleting(null);
  }
  async function removeQuestion() {
    if (!deleteQuestion || busy) return;
    setBusy(true);
    try { await store.deleteQuestion(deleteQuestion.id); setNotice({ type: "success", message: "Question deleted successfully." }); setDeleteQuestion(null); }
    catch (cause) { setNotice({ type: "error", message: cause instanceof Error ? cause.message : "Unable to delete question." }); setDeleteQuestion(null); }
    finally { setBusy(false); }
  }
  const groups: { section: QuestionSection | null; items: AdminQuestion[] }[] = [
    ...sections.map(section => ({ section, items: visible.filter(q => q.sectionId === section.id) })),
    { section: null, items: visible.filter(q => !q.sectionId || !sections.some(section => section.id === q.sectionId)) },
  ];
  return <div>
    <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-xs text-slate-500"><Link href="/admin/question-banks">Question Banks</Link><span>/</span><span>{bank.name}</span></nav>
    <header className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7"><Link href="/admin/question-banks" className="text-sm font-semibold text-teal-700">Back to Question Banks</Link><div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-2xl font-semibold text-slate-950 sm:text-3xl">{bank.name}</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">{bank.description}</p><p className="mt-3 text-sm font-medium text-slate-700">{sections.length} clinical cases · {questions.length} questions</p></div><div className="flex flex-wrap gap-2"><button onClick={() => setEditing("new")} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold text-slate-700"><Plus className="size-4" />Add case</button><Link href={`/admin/question-banks/${bankId}/questions/new`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white"><Plus className="size-4" />Add question</Link></div></div></header>
    {notice && <div role={notice.type === "error" ? "alert" : "status"} className={`mt-5 rounded-xl border px-4 py-3 text-sm ${notice.type === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{notice.message}</div>}
    <div className="mt-6 flex flex-col gap-3 rounded-2xl border bg-white p-4 sm:flex-row"><label className="relative flex-1"><span className="sr-only">Search question text</span><Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search questions" className="h-11 w-full rounded-xl border bg-slate-50 pl-9 pr-3 text-sm" /></label><label><span className="sr-only">Filter questions by status</span><Select value={filter} onChange={event => setFilter(event.target.value as typeof filter)} className="h-11 w-full rounded-xl border bg-slate-50 px-3 text-sm"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></Select></label></div>
    <div className="mt-5 space-y-4">{groups.map(({ section, items }) => <details key={section?.id ?? "unassigned"} open={search || filter !== "all" ? true : undefined} className="group rounded-2xl border bg-white shadow-sm"><summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden"><div className="flex min-w-0 items-start gap-3"><ChevronDown className="mt-1 size-5 shrink-0 text-slate-500 transition-transform group-open:rotate-180" /><div><h2 className="font-semibold text-slate-950">{section ? `${section.displayOrder}. ${section.title}` : "Unassigned Questions"}</h2><p className="mt-1 text-xs text-slate-500">{section ? questions.filter(q => q.sectionId === section.id).length : questions.filter(q => !q.sectionId || !sections.some(s => s.id === q.sectionId)).length} questions</p></div></div></summary><div className="border-t px-5 pb-5"><div className="flex flex-wrap items-start justify-between gap-3 py-4"><p className="max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-600">{section?.description ?? "Questions without a clinical case are listed here."}</p><div className="flex flex-wrap gap-2">{section && <><button aria-label={`Edit case ${section.title}`} onClick={() => setEditing(section)} className="grid size-11 place-items-center rounded-xl border text-slate-700"><Edit3 className="size-4" /></button><button aria-label={`Delete case ${section.title}`} onClick={() => setDeleting(section)} className="grid size-11 place-items-center rounded-xl border text-rose-700"><Trash2 className="size-4" /></button></>}<Link href={`/admin/question-banks/${bankId}/questions/new${section ? `?sectionId=${encodeURIComponent(section.id)}` : ""}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold text-teal-700"><Plus className="size-4" />Add question</Link></div></div>{items.length ? <ol className="space-y-2">{[...items].sort((a,b) => (a.displayOrder ?? 2147483647) - (b.displayOrder ?? 2147483647) || a.createdAt.localeCompare(b.createdAt)).map(q => <li key={q.id} className="flex flex-col gap-3 rounded-xl border bg-slate-50 p-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="break-words text-sm font-medium text-slate-900">{q.displayOrder ? `${q.displayOrder}. ` : ""}{q.text}</p><p className="mt-2 text-xs text-slate-500">QCU · {q.answers.length} answers · {q.status}</p></div><div className="flex shrink-0 gap-2"><Link aria-label={`Edit ${q.text}`} href={`/admin/question-banks/${bankId}/questions/${q.id}/edit`} className="grid size-11 place-items-center rounded-xl border bg-white text-slate-700"><Edit3 className="size-4" /></Link><button aria-label={`Delete ${q.text}`} onClick={() => setDeleteQuestion(q)} className="grid size-11 place-items-center rounded-xl border bg-white text-rose-700"><Trash2 className="size-4" /></button></div></li>)}</ol> : <p className="py-4 text-sm text-slate-500">{search || filter !== "all" ? "No matching questions in this group." : "No questions in this group yet."}</p>}</div></details>)}</div>
    {editing && <SectionFormDialog bankId={bankId} section={editing === "new" ? undefined : editing} suggestedOrder={Math.max(0, ...sections.map(s => s.displayOrder)) + 1} onCancel={() => setEditing(null)} onSave={saveSection} />}
    {deleting && <DeleteSectionDialog section={deleting} questionCount={questions.filter(q => q.sectionId === deleting.id).length} onCancel={() => setDeleting(null)} onConfirm={removeSection} />}
    {deleteQuestion && <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4"><div role="alertdialog" aria-modal="true" aria-labelledby="delete-question-title" className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-2xl"><h2 id="delete-question-title" className="text-lg font-semibold text-slate-950">Delete this question?</h2><p className="mt-3 break-words text-sm text-slate-600">{deleteQuestion.text}</p><div className="mt-6 flex flex-wrap justify-end gap-3"><button autoFocus onClick={() => setDeleteQuestion(null)} className="rounded-xl border px-4 py-3 text-sm font-semibold">Cancel</button><button disabled={busy} onClick={() => void removeQuestion()} className="rounded-xl bg-rose-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Delete question</button></div></div></div>}
  </div>;
}
