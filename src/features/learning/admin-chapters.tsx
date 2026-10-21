"use client";
import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { saveChapter, assignQuestionChapters, saveGenerationSettings } from "@/actions/chapters";
import type { AdminChaptersData, Chapter } from "@/types/chapters";
import type { ServerResult } from "@/types/server-result";

const inputClass = "min-h-12 w-full min-w-0 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-900";
const buttonClass = "inline-flex min-h-12 items-center justify-center rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
function useSave() {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [feedback, setFeedback] = useState(""); const [failed, setFailed] = useState(false);
  async function run(action: () => Promise<ServerResult<null>>, done?: () => void) {
    if (busy) return; setBusy(true); setFeedback("");
    try { const result = await action(); setFailed(!result.ok); setFeedback(result.ok ? "Changes saved." : result.error.message); if (result.ok) { done?.(); router.refresh(); } }
    catch { setFailed(true); setFeedback("Unable to save. Please retry."); } finally { setBusy(false); }
  }
  return { busy, run, message: feedback ? <p role={failed ? "alert" : "status"} className={`mt-3 text-sm ${failed ? "text-rose-700 dark:text-rose-300" : "text-teal-700 dark:text-teal-200"}`}>{feedback}</p> : null };
}
export function AdminChapters({ data, page, search }: { data: AdminChaptersData; page: number; search: string }) {
  const [editing, setEditing] = useState<Chapter | "new" | null>(null);
  const url = (next: number) => `/admin/question-banks/${data.bankId}/chapters?page=${next}&q=${encodeURIComponent(search)}` as Route;
  return <div className="space-y-6"><header><Link href={`/admin/question-banks/${data.bankId}` as Route} className="text-sm font-semibold text-teal-700 dark:text-teal-200">Back to {data.bankName}</Link><p className="mt-4 text-sm text-slate-500">{data.specialtyName ?? "No specialty assigned"} / {data.bankName}</p><h1 className="mt-2 text-2xl font-semibold text-slate-950">Chapters & generated exams</h1><p className="mt-2 text-sm leading-6 text-slate-600">Manage real chapters and assign existing questions. Clinical cases and PDF source relationships remain unchanged.</p></header>
    <section className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-950">Chapters</h2><button type="button" onClick={() => setEditing("new")} className={buttonClass}>Add chapter</button></div>
      {data.chapters.length ? <ul className="mt-4 divide-y">{data.chapters.map(chapter => <li key={chapter.id} className="flex flex-wrap items-start justify-between gap-3 py-4"><div className="min-w-0"><h3 className="break-words font-semibold text-slate-950">{chapter.displayOrder}. {chapter.title}</h3><p className="mt-1 text-sm text-slate-600">{chapter.published ? "Published" : "Draft / unpublished"} · {chapter.questionCount} assigned questions</p></div><button type="button" onClick={() => setEditing(chapter)} className="min-h-11 rounded-xl border px-4 text-sm font-semibold text-teal-700">Edit chapter</button></li>)}</ul> : <p className="mt-4 text-sm text-slate-500">No chapters created. Create only chapters appropriate to the actual material.</p>}
      {editing && <ChapterForm key={editing === "new" ? "new" : editing.id} chapter={editing === "new" ? null : editing} bankId={data.bankId} onClose={() => setEditing(null)} />}
    </section>
    <GenerationForm key={`${data.defaultCount}:${data.prioritizeIncorrect}`} data={data} />
    <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-semibold text-slate-950">Question assignments & reviewed difficulty</h2><p className="mt-2 text-sm text-slate-600">A question may belong to multiple chapters. Unknown difficulty remains unknown; do not guess medical metadata.</p>
      <form className="mt-4 flex flex-col gap-3 sm:flex-row"><label className="min-w-0 flex-1"><span className="sr-only">Search existing questions</span><input name="q" defaultValue={search} maxLength={200} placeholder="Search existing questions" className={inputClass}/></label><button className={buttonClass}>Search</button></form>
      <div className="mt-5 space-y-4">{data.questions.map(question => <QuestionAssignment key={`${question.id}:${question.difficulty}:${question.chapters.join(",")}`} question={question} chapters={data.chapters} bankId={data.bankId}/>)}</div>
      {!data.questions.length && <p className="mt-4 text-sm text-slate-500">No questions match this page.</p>}
      <nav aria-label="Question assignment pages" className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600"><span>{data.total} questions · Page {page + 1}</span><div className="flex gap-3">{page > 0 && <Link className="inline-flex min-h-11 items-center rounded-xl border px-4" href={url(page - 1)}>Previous page</Link>}{(page + 1) * 20 < data.total && <Link className="inline-flex min-h-11 items-center rounded-xl border px-4" href={url(page + 1)}>Next page</Link>}</div></nav>
    </section>
  </div>;
}
function ChapterForm({ chapter, bankId, onClose }: { chapter: Chapter | null; bankId: string; onClose: () => void }) {
  const [id] = useState(() => chapter?.id ?? crypto.randomUUID());
  const [title, setTitle] = useState(chapter?.title ?? ""), [description, setDescription] = useState(chapter?.description ?? "");
  const [order, setOrder] = useState(chapter?.displayOrder ?? 0), [published, setPublished] = useState(chapter?.published ?? false); const save = useSave();
  return <form onSubmit={e => { e.preventDefault(); void save.run(() => saveChapter({ id, bankId, title, description, displayOrder: order, published }), onClose); }} className="mt-5 space-y-4 rounded-xl border bg-slate-50 p-4">
    <h3 className="font-semibold text-slate-950">{chapter ? "Edit chapter" : "New chapter"}</h3><label className="grid gap-2 text-sm text-slate-700">Chapter title<input required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} className={inputClass}/></label>
    <label className="grid gap-2 text-sm text-slate-700">Description<textarea maxLength={3000} value={description} onChange={e => setDescription(e.target.value)} rows={3} className={inputClass}/></label>
    <label className="grid gap-2 text-sm text-slate-700">Display order<input type="number" min={0} max={100000} value={order} onChange={e => setOrder(Number(e.target.value))} className={inputClass}/></label>
    <label className="flex min-h-12 items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} className="size-4 accent-teal-700"/>Published to approved Students</label>
    <p className="text-xs text-slate-500">Unpublish to hide a chapter and prevent new starts. Existing attempts and results are retained.</p>{save.message}<div className="flex flex-wrap gap-3"><button disabled={save.busy} className={buttonClass}>{save.busy ? "Saving…" : "Save chapter"}</button><button type="button" disabled={save.busy} onClick={onClose} className="min-h-12 rounded-xl border px-4 text-sm text-slate-700">Cancel</button></div>
  </form>;
}
function GenerationForm({ data }: { data: AdminChaptersData }) {
  const [count, setCount] = useState(data.defaultCount), [prioritize, setPrioritize] = useState(data.prioritizeIncorrect); const save = useSave();
  return <form onSubmit={e => { e.preventDefault(); void save.run(() => saveGenerationSettings({ bankId: data.bankId, defaultCount: count, prioritizeIncorrect: prioritize })); }} className="space-y-4 rounded-2xl border bg-white p-5"><h2 className="text-lg font-semibold text-slate-950">Generated exam defaults</h2><p className="text-sm text-slate-600">Selection uses existing reviewed questions—not an external AI model. Chapters, published exam years and reviewed difficulty guide balanced selection where available.</p>
    <label className="grid gap-2 text-sm text-slate-700">Default question count (1–30)<input type="number" min={1} max={30} required value={count} onChange={e => setCount(Number(e.target.value))} className={inputClass}/></label><label className="flex min-h-12 items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={prioritize} onChange={e => setPrioritize(e.target.checked)} className="size-4 shrink-0 accent-teal-700"/>Default to previously incorrect questions within each group</label>{save.message}<button disabled={save.busy} className={buttonClass}>{save.busy ? "Saving…" : "Save generation settings"}</button></form>;
}
function QuestionAssignment({ question, chapters, bankId }: { question: AdminChaptersData["questions"][number]; chapters: Chapter[]; bankId: string }) {
  const [ids, setIds] = useState(question.chapters); const [difficulty, setDifficulty] = useState(question.difficulty ?? ""); const save = useSave();
  return <form onSubmit={e => { e.preventDefault(); void save.run(() => assignQuestionChapters({ bankId, questionId: question.id, chapterIds: ids, difficulty: difficulty || null })); }} className="min-w-0 space-y-4 rounded-xl border p-4"><p className="break-words text-sm font-medium text-slate-950">{question.text}</p><p className="text-xs text-slate-500">{question.status}</p><fieldset><legend className="text-sm font-semibold text-slate-700">Assigned chapters</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{chapters.map(chapter => <label key={chapter.id} className="flex min-h-11 min-w-0 items-center gap-3 rounded-lg border px-3 py-2 text-sm text-slate-700"><input type="checkbox" checked={ids.includes(chapter.id)} onChange={e => setIds(e.target.checked ? [...ids, chapter.id] : ids.filter(id => id !== chapter.id))} className="size-4 shrink-0 accent-teal-700"/><span className="break-words">{chapter.title}{!chapter.published && " (unpublished)"}</span></label>)}</div>{!chapters.length && <p className="mt-2 text-xs text-slate-500">Create a chapter before assigning questions.</p>}</fieldset>
    <label className="grid gap-2 text-sm text-slate-700">Reviewed difficulty<Select value={difficulty} onChange={e => setDifficulty(e.target.value as typeof difficulty)} className={inputClass}><option value="">Unknown / not reviewed</option><option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option></Select></label>{save.message}<button disabled={save.busy} className={buttonClass}>{save.busy ? "Saving…" : "Save assignment"}</button></form>;
}
