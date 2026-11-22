"use client";

import Link from "next/link";
import type { Route } from "next";
import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileText, Pencil, Plus, Trash2, ClipboardList, FileWarning } from "lucide-react";
import { bulkSetSubjectQuestionStatus, deleteSubjectQuestion, saveReviewedSubjectQuestion, reviewAndImportStagedSubjectQuestion } from "@/actions/subject-questions";
import { ModalPanel } from "@/components/ui/modal-panel";
import { Select } from "@/components/ui/select";
import { PendingButton } from "@/components/ui/pending-button";
import type { SubjectQuestion, StagedSubjectQuestion, SubjectDraft, SubjectQuestionsData, SubjectStageInput } from "@/types/subject-question";

const subjectFieldClass = "min-h-12 w-full min-w-0 rounded-xl border bg-white px-3 py-2 text-base text-slate-950 focus-visible:outline-2 focus-visible:outline-teal-600 dark:bg-slate-900 dark:text-slate-100";
const subjectButtonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-teal-600 disabled:opacity-50";
const card = "min-w-0 rounded-2xl border bg-white p-5 sm:p-6 dark:bg-slate-900";
const blankDraft = (): SubjectDraft => ({ text: "", options: [{ id: "a", text: "" }, { id: "b", text: "" }], correctOptionId: null, explanation: "", evidence: "", chapterId: null, visualsReviewed: false, duplicatesReviewed: false, explanationOrigin: "ADMIN" });
const chapterLabel = (item: SubjectQuestion) => item.chapters[0] ?? "Unassigned questions";

export function AdminSubjectQuestions({ data, page, search, chapter, view }: { data: SubjectQuestionsData; page: number; search: string; chapter: string; view: "questions" | "review" }) {
  const [editing, setEditing] = useState<SubjectQuestion | "new" | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [feedback, setFeedback] = useState("");
  const [grouped, setGrouped] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState<"active" | "inactive" | null>(null);
  const questions = data.items.filter((item): item is SubjectQuestion => !("draft" in item));
  const visibleItems = grouped ? [...questions].sort((a,b) => chapterLabel(a).localeCompare(chapterLabel(b))) : questions;
  const path = `/admin/subjects/${encodeURIComponent(data.bank.id)}/questions`;
  const query = (next: number) => `${path}?${new URLSearchParams({ page: String(next), search, chapter })}` as Route;
  const visibleIds = visibleItems.map((item) => item.id);
  const allOnPageSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  function toggleQuestion(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  function togglePageSelection() {
    setSelectedIds((current) =>
      allOnPageSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : [...new Set([...current, ...visibleIds])],
    );
  }
  async function applyBulkStatus() {
    if (busy || !bulkMode || selectedIds.length === 0) return;
    setBusy(true);
    try {
      const result = await bulkSetSubjectQuestionStatus(data.bank.id, selectedIds, bulkMode);
      if (!result.ok) {
        setFeedback(result.error.message);
        setBulkMode(null);
        return;
      }
      setFeedback(`${result.data.updated} questions set to ${bulkMode}.`);
      setSelectedIds([]);
      setBulkMode(null);
      // The action revalidates this Subject; no second RSC request is needed.
    } catch {
      setFeedback("Bulk status change failed. Please retry.");
      setBulkMode(null);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleting || busy) return; setBusy(true);
    try { const result = await deleteSubjectQuestion(data.bank.id, deleting); setFeedback(result.ok ? "Question deleted; audit history is retained." : result.error.message); if (result.ok) setDeleting(null); }
    catch { setFeedback("Unable to delete this question. Please retry."); } finally { setBusy(false); }
  }
  if (view === "review") return <AdminSubjectDrafts data={data} page={page} search={search} />;
  return <div className="space-y-5">
    <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm"><Link className="text-teal-700 dark:text-teal-300" href="/admin/subjects">Subjects</Link><span>/</span><span>{data.bank.specialtyName ?? "Unassigned specialty"}</span><span>/</span><span>{data.bank.name}</span><span>/ Questions</span></nav>
    <header className={card}><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h1 className="break-words text-2xl font-semibold sm:text-3xl">{data.bank.name} questions</h1><p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{data.extractedCount} extracted entries · {data.questionCount} imported questions · {data.pendingCount} awaiting review/import</p></div><button onClick={() => setEditing("new")} className={subjectButtonClass}><Plus className="size-4" />Add question</button></div>
      <div className="mt-4 flex flex-wrap gap-3">
        <span className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Imported questions ({data.questionCount})</span>
        <Link href={`/admin/subjects/${encodeURIComponent(data.bank.id)}/questions?view=review` as Route} className={subjectButtonClass}>
          <FileWarning className="size-4" aria-hidden="true" />Review OCR drafts ({data.pendingCount})
        </Link>
      </div>
      <p className="mt-4 text-sm leading-6 text-amber-800 dark:text-amber-200">Student OCR previews include unverified content. Only explicitly reviewed and approved questions are eligible for scored exams.</p>
      {data.chapters.length ? <Link href={`/admin/subjects/${encodeURIComponent(data.bank.id)}/lessons`} className={`${subjectButtonClass} mt-4`}>Chapters & lessons</Link> : null}
    </header>
    {feedback ? <p role="status" className="lhcc-feedback rounded-xl border bg-slate-50 p-4 text-sm dark:bg-slate-800">{feedback}</p> : null}
    <form action={path} className={`${card} grid gap-4 ${data.chapters.length ? "sm:grid-cols-[1fr_1fr_auto]" : "sm:grid-cols-[1fr_auto]"}`}><label className="grid min-w-0 gap-2 text-sm">Search questions<input name="search" defaultValue={search} maxLength={200} className={subjectFieldClass} /></label>{data.chapters.length ? <label className="grid min-w-0 gap-2 text-sm">Chapter<Select name="chapter" defaultValue={chapter} className={subjectFieldClass}><option value="">All questions (including unassigned)</option>{data.chapters.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</Select></label> : null}<button className={`${subjectButtonClass} self-end`}>Apply filters</button></form>
    <p className="text-sm text-slate-600 dark:text-slate-300">{data.total} matching questions · Page {page + 1} of {Math.max(1, Math.ceil(data.total / 20))}</p>
    <div className={`${card} flex flex-wrap items-center gap-3`} aria-label="Bulk question status actions">
      <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={allOnPageSelected} onChange={togglePageSelection} disabled={busy || !visibleIds.length} aria-label="Select all questions on this page" />
        Select all on this page
      </label>
      <span role="status" className="text-sm text-slate-600 dark:text-slate-300">{selectedIds.length} selected</span>
      <button type="button" className={subjectButtonClass} disabled={busy || selectedIds.length === 0} onClick={() => setBulkMode("active")}>Activate selected</button>
      <button type="button" className={subjectButtonClass} disabled={busy || selectedIds.length === 0} onClick={() => setBulkMode("inactive")}>Deactivate selected</button>
    </div>
    {data.chapters.length ? <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={grouped} onChange={event => setGrouped(event.target.checked)} />Group this page by first chapter (including unassigned questions)</label> : null}
    {!questions.length ? <p className={card}>No questions match these filters. Questions do not require chapters; unverified source content remains private until reviewed.</p> : null}
    <ol className="space-y-4">{visibleItems.map((item,index) => <li key={item.id}>
      {grouped && (index === 0 || chapterLabel(visibleItems[index - 1]!) !== chapterLabel(item)) ? <h2 className="mb-3 text-lg font-semibold">{chapterLabel(item)}</h2> : null}
      <article className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><label className="inline-flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleQuestion(item.id)} disabled={busy} aria-label={`Select question ${item.displayOrder ?? page * 20 + index + 1}`} />Select</label><h2 className="font-semibold">Question {item.displayOrder ?? page * 20 + index + 1}</h2></div><span className="text-sm">{item.status} · {item.approvalStatus}</span></div>
        {item.groupInstructions ? <p className="mt-3 whitespace-pre-wrap rounded-xl border p-4" dir="auto">{item.groupInstructions}</p> : null}
        {item.caseTitle || item.caseDescription ? <section className="mt-3 rounded-xl border p-4"><h3 className="font-semibold" dir="auto">{item.caseTitle}</h3><p dir="auto" className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{item.caseDescription}</p></section> : null}
        <p className="mt-4 whitespace-pre-wrap break-words text-base leading-7" dir="auto">{item.text}</p>
        <ol className="mt-4 space-y-2">{(item.options.length ? item.options : item.sharedOptions ?? []).map(option => <li key={option.id} dir="auto" className={`whitespace-pre-wrap break-words rounded-xl border p-4 text-sm leading-6 ${option.id === item.correctOptionId ? "border-teal-500 bg-teal-50 dark:bg-teal-950/40" : "bg-slate-50 dark:bg-slate-800"}`}><strong>{option.id.toUpperCase()}.</strong> {option.text}{option.id === item.correctOptionId ? <span className="ml-2 font-semibold">Correct answer (Admin only)</span> : null}</li>)}</ol>
        {item.explanation ? <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6"><strong>Explanation ({item.explanationOrigin ?? "origin not recorded"}):</strong> {item.explanation}</p> : null}
        <p className="mt-4 break-words text-sm text-slate-600 dark:text-slate-300">Source: {item.filename ?? "Admin authored"} · Page {item.pageStart ?? "—"} · Original number {item.sourceNumber ?? "—"}{data.chapters.length ? ` · Chapters: ${item.chapters.join(", ") || "Unassigned"}` : ""}</p>
        {item.driveFileId && /^[A-Za-z0-9_-]{10,200}$/.test(item.driveFileId) ? <a className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm text-teal-700 underline dark:text-teal-300" target="_blank" rel="noreferrer noopener" href={`https://drive.google.com/file/d/${item.driveFileId}/view`}><FileText className="size-4" />View source PDF</a> : null}
        {item.assetCount ? <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">Compare all source images and tables before reviewing this question.</p> : null}
        <div className="mt-4 flex flex-wrap gap-3">{item.lessonId ? <Link className={subjectButtonClass} href={`/admin/subjects/${encodeURIComponent(data.bank.id)}/lessons?lesson=${item.lessonId}` as Route}><Pencil className="size-4" />Edit question</Link> : <button className={subjectButtonClass} onClick={() => setEditing(item)}><Pencil className="size-4" />Edit question</button>}<button aria-label={`Delete question ${item.id}`} className={`${subjectButtonClass} text-rose-700 dark:text-rose-300`} onClick={() => setDeleting(item.id)}><Trash2 className="size-4" />Delete</button></div>
      </article>
    </li>)}</ol>
    <nav aria-label="Subject question pagination" className="flex flex-wrap justify-between gap-3">{page > 0 ? <Link className={subjectButtonClass} href={query(page - 1)}>Previous page</Link> : <span />}{(page + 1) * 20 < data.total ? <Link className={subjectButtonClass} href={query(page + 1)}>Next page</Link> : null}</nav>
    {editing ? <SubjectQuestionEditor bankId={data.bank.id} initial={editing === "new" ? null : editing} sources={data.sources} chapters={data.chapters} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setFeedback("Question saved after explicit review."); }} /> : null}
    {bulkMode ? <ModalPanel labelledBy="subject-bulk-status-title" busy={busy} onCancel={() => { if (!busy) setBulkMode(null); }}><section className="p-6"><h2 id="subject-bulk-status-title" className="text-xl font-semibold">{bulkMode === "active" ? "Activate" : "Deactivate"} {selectedIds.length} selected questions?</h2><p className="mt-3 text-sm leading-6">{bulkMode === "active" ? "Only questions with approved answers can be activated. Unreviewed imported questions remain inactive." : "Selected questions will become inactive and will be removed from complete-bank exams."} No unselected questions will be changed.</p><div className="mt-5 flex flex-wrap gap-3"><button type="button" autoFocus className={subjectButtonClass} disabled={busy} onClick={() => setBulkMode(null)}>Cancel</button><button type="button" className={subjectButtonClass} disabled={busy} onClick={() => void applyBulkStatus()}>{busy ? "Saving…" : "Confirm status change"}</button></div></section></ModalPanel> : null}
    {deleting ? <ModalPanel labelledBy="delete-subject-question" onCancel={() => { if (!busy) setDeleting(null); }} busy={busy}><section className="p-6"><h2 id="delete-subject-question" className="text-xl font-semibold">Delete this Subject question?</h2><p className="mt-3 text-sm leading-6">Protected attempts and lesson history cannot be deleted. Existing audit decisions are retained.</p><div className="mt-5 flex flex-wrap gap-3"><button autoFocus className={subjectButtonClass} disabled={busy} onClick={() => setDeleting(null)}>Cancel</button><button className={`${subjectButtonClass} text-rose-700`} disabled={busy} onClick={() => void remove()}>{busy ? "Deleting…" : "Delete question"}</button></div></section></ModalPanel> : null}
  </div>;
}


function AdminSubjectDrafts({ data, page, search }: { data: SubjectQuestionsData; page: number; search: string }) {
  const router = useRouter();
  const [reviewing, setReviewing] = useState<StagedSubjectQuestion | null>(null);
  const [feedback, setFeedback] = useState("");
  const records = data.items.filter((item): item is StagedSubjectQuestion => "draft" in item);
  const bankPath = `/admin/subjects/${encodeURIComponent(data.bank.id)}/questions`;
  const query = (next: number) => `${bankPath}?${new URLSearchParams({view:"review", page:String(next), search})}` as Route;
  const getText = (row: StagedSubjectQuestion): string => {
    const source = row.draft.text ?? row.draft.question;
    return typeof source === "string" && source.trim()
      ? source : "[Question text requires correction from the PDF]";
  };
  const getOptions = (row: StagedSubjectQuestion): Array<{ id: string; text: string }> => {
    if (!Array.isArray(row.draft.options)) return [];
    return row.draft.options.flatMap((value, index) => {
      if (!value || typeof value !== "object") return [];
      const obj = value as Record<string, unknown>;
      return [{ id: typeof obj.id === "string" ? obj.id : String.fromCharCode(65+index),
        text: typeof obj.text === "string" ? obj.text : "[Unrecognized answer choice]" }];
    }).slice(0,10);
  };
  return <main className="space-y-5">
    <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm">
      <Link className="text-teal-700 dark:text-teal-300" href="/admin/subjects">Subjects</Link><span>/</span>
      <span>{data.bank.specialtyName ?? "Unassigned specialty"}</span><span>/</span>
      <span>{data.bank.name}</span><span>/ OCR drafts</span>
    </nav>
    <header className={card}>
      <div className="flex items-start gap-3">
        <ClipboardList className="mt-1 size-7 shrink-0 text-teal-700" aria-hidden="true"/>
        <div className="min-w-0"><h1 className="break-words text-2xl font-semibold sm:text-3xl">{data.bank.name} — extracted questions</h1>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            {data.extractedCount} total extracted · {data.questionCount} imported · {data.pendingCount} OCR drafts awaiting import
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={bankPath as Route} className={subjectButtonClass}>Imported questions ({data.questionCount})</Link>
        <span className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white">OCR drafts ({data.pendingCount})</span>
      </div>
      <p className="mt-4 text-sm leading-6 text-amber-800 dark:text-amber-200">These PDF entries are already visible as ungraded student study drafts. They are not approved scored questions. Compare each with its original PDF and explicitly verify the correct answer before importing.</p>
    </header>
    {feedback ? <p role="status" className={card}>{feedback}</p> : null}
    <form action={bankPath} className={`${card} flex flex-wrap items-end gap-3`}>
      <input type="hidden" name="view" value="review"/>
      <label className="min-w-[12rem] flex-1 text-sm font-semibold">Search extracted drafts
        <input name="search" defaultValue={search} maxLength={200} className={`${subjectFieldClass} mt-2`} />
      </label>
      <button className={subjectButtonClass}>Search</button>
    </form>
    <p className="text-sm text-slate-600 dark:text-slate-300">
      {data.total} matching OCR drafts · Page {page+1} of {Math.max(1,Math.ceil(data.total/20))}
    </p>
    {records.length===0 ? <p className={card}>No remaining OCR drafts match these filters. Imported questions are available in the other tab.</p> : null}
    <ol className="space-y-4">{records.map((item,index)=>{
      const source = data.sources.find(src => src.id===item.sourceId);
      const options = getOptions(item);
      return <li key={item.id}><article className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Extracted entry {page*20+index+1}</h2>
          <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">{item.reviewStatus} · {item.answerStatus}</span>
        </div>
        <p className="mt-3 break-words text-sm text-slate-600 dark:text-slate-300">
          Source: {item.filename} · PDF page {item.pageStart}{item.pageEnd!==item.pageStart ? `–${item.pageEnd}` : ""}{item.sourceNumber ? ` · Original question ${item.sourceNumber}` : ""}
          {item.possibleDuplicates ? ` · ${item.possibleDuplicates} possible duplicates` : ""}
        </p>
        <p className="mt-4 whitespace-pre-wrap break-words text-base leading-7">{getText(item)}</p>
        {options.length ? <ol className="mt-4 grid gap-2 sm:grid-cols-2">{options.map((option,i)=>
          <li key={i} className="whitespace-pre-wrap break-words rounded-xl border bg-slate-50 p-3 text-sm leading-6 dark:bg-slate-800"><strong>{String.fromCharCode(65+i)}.</strong> {option.text}</li>
        )}</ol> : <p className="mt-4 text-sm text-amber-800 dark:text-amber-200">No answer choices extracted. Check the original PDF.</p>}
        {item.notes ? <p className="mt-4 whitespace-pre-wrap text-sm text-amber-800 dark:text-amber-200">OCR/review notes: {item.notes}</p> : null}
        <div className="mt-5 flex flex-wrap gap-3 border-t pt-4">
          <button type="button" className={subjectButtonClass} onClick={()=>setReviewing(item)}><Pencil className="size-4" aria-hidden="true"/>Review &amp; import</button>
          {source?.driveFileId && /^[A-Za-z0-9_-]{10,200}$/.test(source.driveFileId) ? <a href={`https://drive.google.com/file/d/${source.driveFileId}/view`} target="_blank" rel="noopener noreferrer" className={subjectButtonClass}><FileText className="size-4" aria-hidden="true"/>Open source PDF</a> : null}
        </div>
      </article></li>;
    })}</ol>
    <nav aria-label="OCR draft pagination" className="flex items-center justify-between gap-3">
      {page>0 ? <Link href={query(page-1)} className={subjectButtonClass}>Previous page</Link> : <span/>}
      {(page+1)*20<data.total ? <Link href={query(page+1)} className={subjectButtonClass}>Next page</Link> : null}
    </nav>
    {reviewing ? <SubjectQuestionEditor key={reviewing.id} bankId={data.bank.id} initial={null}
      staged={reviewing} sources={data.sources} chapters={data.chapters} onClose={()=>setReviewing(null)}
      onSaved={()=>{setReviewing(null);setFeedback("Reviewed question imported successfully.");router.refresh();}}/> : null}
  </main>;
}

function normalizedDraft(initial: SubjectQuestion | null, staged?: StagedSubjectQuestion): SubjectDraft {
  if (staged) {
    const raw = staged.draft;
    const defaults = blankDraft();
    const options = Array.isArray(raw.options) ? raw.options.flatMap((value, index) => {
      if (!value || typeof value !== "object") return [];
      const option = value as Record<string, unknown>;
      return [{ id: typeof option.id === "string" && option.id.trim() ? option.id : String.fromCharCode(97+index),
        text: typeof option.text === "string" ? option.text : "" }];
    }).slice(0,10) : [];
    const seen = new Set<string>();
    const distinct = options.filter(option => { if (seen.has(option.id)) return false; seen.add(option.id); return true; });
    const text = typeof raw.text === "string" ? raw.text : typeof raw.question === "string" ? raw.question : "";
    const correct = typeof raw.correctOptionId === "string" && distinct.some(o=>o.id===raw.correctOptionId) ? raw.correctOptionId : null;
    return { ...defaults, text:text.slice(0,10000), options: distinct.length>=2 ? distinct : defaults.options,
      correctOptionId:correct, explanation:typeof raw.explanation==="string" ? raw.explanation : "",
      evidence:typeof raw.evidence==="string" ? raw.evidence : "", explanationOrigin:raw.explanationOrigin==="SOURCE" ? "SOURCE" : "ADMIN",
      answerPage:typeof raw.answerPage==="number" ? raw.answerPage : null,
      chapterId:typeof raw.chapterId==="string" ? raw.chapterId : null,
      visualsReviewed:false, duplicatesReviewed:false };
  }
  if (!initial) return blankDraft();
  return { ...blankDraft(), text: initial.text, options: initial.options.length ? initial.options : initial.sharedOptions ?? [],
    correctOptionId: initial.correctOptionId, explanation: initial.explanation ?? "", evidence: initial.evidence ?? "",
    chapterId: initial.chapterId ?? null, answerPage: initial.answerPage ?? null,
    explanationOrigin: initial.explanationOrigin === "SOURCE" ? "SOURCE" : "ADMIN" };
}

function SubjectQuestionEditor({ bankId, initial, staged, sources, chapters, onClose, onSaved }: { bankId: string; initial: SubjectQuestion | null; staged?: StagedSubjectQuestion; sources: SubjectQuestionsData["sources"]; chapters: SubjectQuestionsData["chapters"]; onClose: () => void; onSaved: () => void }) {
  const titleId = useId();
  const [draft, setDraft] = useState(() => normalizedDraft(initial, staged));
  const [sourceId, setSource] = useState(staged?.sourceId ?? sources.find(s => s.driveFileId === initial?.driveFileId)?.id ?? ""), [pageStart, setStart] = useState(staged?.pageStart ?? initial?.pageStart ?? 1), [pageEnd, setEnd] = useState(staged?.pageEnd ?? initial?.pageEnd ?? 1), [number, setNumber] = useState(staged?.sourceNumber ?? initial?.sourceNumber ?? "");
  const [answerStatus, setAnswerStatus] = useState<SubjectStageInput["answerStatus"]>((["SOURCE_VERIFIED","MEDICALLY_REVIEWED"].includes(staged?.answerStatus ?? initial?.answerStatus ?? "") ? staged?.answerStatus ?? initial?.answerStatus : "UNVERIFIED") as SubjectStageInput["answerStatus"]);
  const [notes, setNotes] = useState(staged?.notes ?? ""), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    try { const payload = { sourceId: sourceId || null, expectedRevision: staged?.revision ?? initial?.stagingRevision ?? null, pageStart, pageEnd, sourceNumber: number, answerStatus, notes, draft, approvalConfirmed: confirmed };
      const result = staged ? await reviewAndImportStagedSubjectQuestion(bankId, staged.id, payload)
        : await saveReviewedSubjectQuestion(bankId, initial?.id ?? null, payload);
      if (!result.ok) { setError(result.error.message); return; } onSaved();
    } catch { setError("Unable to save this question."); } finally { setBusy(false); }
  }
  return <ModalPanel labelledBy={titleId} busy={busy} onCancel={onClose}><form onSubmit={save} className="p-5 sm:p-7"><h2 id={titleId} className="text-2xl font-semibold">{staged ? "Review and import extracted question" : initial ? "Edit question" : "Add Subject question"}</h2><p className="mt-3 text-sm leading-6">Save only complete, reviewed content. Existing pending records are never silently approved. Confirm the supported answer and all required context before saving.</p>
    <fieldset disabled={busy} className="mt-5 grid min-w-0 gap-4"><legend className="sr-only">Question review</legend>
      <label className="grid gap-2 text-sm">Question text<textarea autoFocus dir="auto" rows={6} maxLength={10000} className={subjectFieldClass} value={draft.text} onChange={event => setDraft({ ...draft, text: event.target.value })} /></label>
      {draft.options.map((option, index) => <div key={option.id} className="grid min-w-0 gap-2 rounded-xl border p-3"><label className="grid gap-2 text-sm">Answer {index + 1}<textarea dir="auto" rows={2} maxLength={5000} className={subjectFieldClass} value={option.text} onChange={event => setDraft({ ...draft, options: draft.options.map(item => item.id === option.id ? { ...item, text: event.target.value } : item) })} /></label><div className="flex flex-wrap items-center justify-between gap-3"><label className="flex min-h-11 items-center gap-3 text-sm"><input type="radio" name="correctOption" checked={draft.correctOptionId === option.id} onChange={() => setDraft({ ...draft, correctOptionId: option.id })} />Correct answer</label><button type="button" aria-label={`Remove answer ${index + 1}`} disabled={draft.options.length <= 2} className={subjectButtonClass} onClick={() => setDraft({ ...draft, options: draft.options.filter(item => item.id !== option.id), correctOptionId: draft.correctOptionId === option.id ? null : draft.correctOptionId })}><Trash2 className="size-4" /></button></div></div>)}
      <button type="button" className={subjectButtonClass} disabled={draft.options.length >= 10} onClick={() => setDraft({ ...draft, options: [...draft.options, { id: crypto.randomUUID(), text: "" }] })}>Add answer choice</button>
      <label className="grid gap-2 text-sm">Answer verification<Select className={subjectFieldClass} value={answerStatus} onChange={event => setAnswerStatus(event.target.value as SubjectStageInput["answerStatus"])}><option value="UNVERIFIED">Unverified</option><option value="SOURCE_VERIFIED">Explicit answer in source</option><option value="MISSING_IN_SOURCE">Missing in source</option><option value="AMBIGUOUS">Ambiguous</option><option value="MEDICALLY_REVIEWED">Admin correction — not the source key</option></Select></label>
      <label className="grid gap-2 text-sm">Answer evidence<textarea dir="auto" rows={3} maxLength={10000} className={subjectFieldClass} value={draft.evidence} onChange={event => setDraft({ ...draft, evidence: event.target.value })} /></label>
      <label className="grid gap-2 text-sm">Answer source page (optional)<input type="number" min={1} max={2000} value={draft.answerPage ?? ""} onChange={event => setDraft({ ...draft, answerPage: event.target.value ? event.target.valueAsNumber : null })} className={subjectFieldClass} /></label>
      <label className="grid gap-2 text-sm">Why this answer is correct<textarea dir="auto" rows={4} maxLength={10000} className={subjectFieldClass} value={draft.explanation} onChange={event => setDraft({ ...draft, explanation: event.target.value })} /></label>
      <label className="grid gap-2 text-sm">Explanation origin<Select className={subjectFieldClass} value={draft.explanationOrigin} onChange={event => setDraft({ ...draft, explanationOrigin: event.target.value as SubjectDraft["explanationOrigin"] })}><option value="ADMIN">Admin explanation (not quoted from source)</option><option value="SOURCE">Explicit explanation in source</option></Select></label>
      <label className="grid gap-2 text-sm">Source PDF<Select className={subjectFieldClass} value={sourceId} disabled={Boolean(initial?.stagingId || staged)} onChange={event => setSource(event.target.value)}><option value="">Admin authored — no PDF</option>{sources.map(source => <option key={source.id} value={source.id}>{source.filename}</option>)}</Select></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm">Start page<input type="number" min={1} max={2000} value={pageStart} onChange={event => setStart(event.target.valueAsNumber)} className={subjectFieldClass} /></label><label className="grid gap-2 text-sm">End page<input type="number" min={pageStart} max={2000} value={pageEnd} onChange={event => setEnd(event.target.valueAsNumber)} className={subjectFieldClass} /></label></div>
      <label className="grid gap-2 text-sm">Original question number<input value={number} maxLength={100} onChange={event => setNumber(event.target.value)} className={subjectFieldClass} /></label>
      {chapters.length ? <label className="grid gap-2 text-sm">Optional chapter<Select value={draft.chapterId ?? ""} className={subjectFieldClass} onChange={event => setDraft({ ...draft, chapterId: event.target.value || null })}><option value="">Unassigned</option>{chapters.map(chapter => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</Select></label> : null}
      <label className="grid gap-2 text-sm">Review notes / proposed corrections<textarea rows={3} maxLength={5000} value={notes} onChange={event => setNotes(event.target.value)} className={subjectFieldClass} /></label>
      <label className="flex min-h-11 items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 size-5 shrink-0" checked={draft.visualsReviewed} onChange={event => setDraft({ ...draft, visualsReviewed: event.target.checked })} />I compared the source and all required text, tables and visual information are complete. No essential diagram is missing.</label>
      <label className="flex min-h-11 items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 size-5 shrink-0" checked={draft.duplicatesReviewed} onChange={event => setDraft({ ...draft, duplicatesReviewed: event.target.checked })} />I reviewed possible duplicates and confirmed this is a distinct question or the existing linked record.</label>

      <label className="flex min-h-11 items-start gap-3 text-sm leading-6"><input required type="checkbox" className="mt-1 size-5 shrink-0" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I explicitly approve this complete question and its supported answer.</label>
    </fieldset>{error ? <p role="alert" className="mt-4 text-rose-700 dark:text-rose-300">{error}</p> : null}<div className="mt-6 flex flex-wrap gap-3"><PendingButton pending={busy} className={subjectButtonClass}>{staged ? "Approve and import question" : "Save reviewed question"}</PendingButton><button type="button" disabled={busy} onClick={onClose} className={subjectButtonClass}>Cancel</button></div>
  </form></ModalPanel>;
}
