"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteSubjectQuestion, manageSubjectImport } from "@/actions/subject-questions";
import { ModalPanel } from "@/components/ui/modal-panel";
import { Select } from "@/components/ui/select";
import { SubjectPdfImport } from "@/features/learning/subject-pdf-import";
import type { StagedSubjectQuestion, SubjectDraft, SubjectQuestionsData, SubjectStageInput } from "@/types/subject-question";

export const subjectFieldClass = "min-h-12 w-full min-w-0 rounded-xl border bg-white px-3 py-2 text-base text-slate-950 focus-visible:outline-2 focus-visible:outline-teal-600 dark:bg-slate-900 dark:text-slate-100";
export const subjectButtonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-teal-600 disabled:opacity-50";
const card = "min-w-0 rounded-2xl border bg-white p-5 sm:p-6 dark:bg-slate-900";
const blankDraft = (): SubjectDraft => ({ text: "", options: [{ id: "a", text: "" }, { id: "b", text: "" }], correctOptionId: null, explanation: "", evidence: "", chapterId: null, visualsReviewed: false, duplicatesReviewed: false, explanationOrigin: "ADMIN" });
const chapterLabel = (item: SubjectQuestionsData["items"][number]) => "chapters" in item ? item.chapters[0] ?? "Unassigned questions" : "Pending review";

export function AdminSubjectQuestions({ data, page, view, search, chapter }: { data: SubjectQuestionsData; page: number; view: "questions" | "review"; search: string; chapter: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<StagedSubjectQuestion | "new" | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [feedback, setFeedback] = useState("");
  const [grouped, setGrouped] = useState(false);
  const visibleItems = grouped && view === "questions" ? [...data.items].sort((a, b) => chapterLabel(a).localeCompare(chapterLabel(b))) : data.items;
  const path = `/admin/subjects/${encodeURIComponent(data.bank.id)}/questions`;
  const query = (next: number, tab = view) => `${path}?${new URLSearchParams({ view: tab, page: String(next), search, chapter: tab === "questions" ? chapter : "" })}` as Route;
  async function decide(operation: "approve" | "reject" | "needs_review" | "import", item: StagedSubjectQuestion) {
    if (busy) return; setBusy(true); setFeedback("");
    try {
      const result = await manageSubjectImport(operation, data.bank.id, item.id, { expectedRevision: item.revision });
      if (!result.ok) { setFeedback(result.error.message); return; }
      setFeedback(operation === "import" ? "Approved question imported. Repeating import does not create another question." : "Review decision saved."); router.refresh();
    } catch { setFeedback("Unable to save the decision. Please retry."); } finally { setBusy(false); }
  }
  async function remove() {
    if (!deleting || busy) return; setBusy(true);
    try { const result = await deleteSubjectQuestion(data.bank.id, deleting); setFeedback(result.ok ? "Question deleted; its audit history is retained." : result.error.message); if (result.ok) { setDeleting(null); router.refresh(); } }
    catch { setFeedback("Unable to delete this question. Please retry."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5">
    <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm"><Link className="text-teal-700 dark:text-teal-300" href="/admin/subjects">Subjects</Link><span>/</span><span>{data.bank.specialtyName ?? "Unassigned specialty"}</span><span>/</span><span>{data.bank.name}</span><span>/ Questions</span></nav>
    <header className={card}><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h1 className="break-words text-2xl font-semibold sm:text-3xl">{data.bank.name} questions</h1><p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{data.questionCount} questions · {data.pendingCount} pending reviews</p></div><button onClick={() => setEditing("new")} className={subjectButtonClass}><Plus className="size-4" />Add question</button></div>
      <p className="mt-4 text-sm leading-6 text-amber-800 dark:text-amber-200">Source verified is not approved. Existing pending questions remain visible here for audit. Only explicitly approved answers are eligible for Student access; Subject questions never enter exam-track pools.</p>
      <Link href={`/admin/subjects/${encodeURIComponent(data.bank.id)}/lessons`} className={`${subjectButtonClass} mt-4`}>Chapters & lessons</Link>
    </header>
    <SubjectPdfImport bankId={data.bank.id} />
    <details className={card}><summary className="cursor-pointer font-semibold">Source PDFs & page coverage</summary><ul className="mt-4 space-y-3">{data.sources.map(source => <li key={source.id} className="break-words text-sm"><span className="font-medium">{source.filename}</span> · {source.processedPages}/{source.pages} pages processed · {source.needsReviewPages} pages need review {source.kind === "PDF" && /^[A-Za-z0-9_-]{10,200}$/.test(source.driveFileId) ? <a className="ml-2 inline-flex min-h-11 items-center gap-2 text-teal-700 underline dark:text-teal-300" target="_blank" rel="noreferrer noopener" href={`https://drive.google.com/file/d/${source.driveFileId}/view`}><FileText className="size-4" />Open original PDF</a> : null}</li>)}</ul></details>
    {feedback ? <p role="status" className="rounded-xl border bg-slate-50 p-4 text-sm dark:bg-slate-800">{feedback}</p> : null}
    <nav aria-label="Question views" className="flex flex-wrap gap-3"><Link aria-current={view === "questions" ? "page" : undefined} className={subjectButtonClass} href={query(0, "questions")}>Questions</Link><Link aria-current={view === "review" ? "page" : undefined} className={subjectButtonClass} href={query(0, "review")}>Import review</Link></nav>
    <form action={path} className={`${card} grid gap-4 sm:grid-cols-[1fr_1fr_auto]`}><input type="hidden" name="view" value={view} /><label className="grid min-w-0 gap-2 text-sm">Search questions<input name="search" defaultValue={search} maxLength={200} className={subjectFieldClass} /></label><label className="grid min-w-0 gap-2 text-sm">Chapter<Select name="chapter" defaultValue={view === "questions" ? chapter : ""} disabled={view === "review"} className={subjectFieldClass}><option value="">All questions (including unassigned)</option>{data.chapters.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</Select></label><button className={`${subjectButtonClass} self-end`}>Apply filters</button></form>
    <p className="text-sm text-slate-600 dark:text-slate-300">{data.total} matching records · Page {page + 1} of {Math.max(1, Math.ceil(data.total / 20))}</p>
    {view === "questions" && data.chapters.length ? <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={grouped} onChange={event => setGrouped(event.target.checked)} />Group this page by first chapter (including unassigned questions)</label> : null}
    {!data.items.length ? <p className={card}>No {view === "review" ? "staged questions" : "questions"} match these filters. No existing content has been removed.</p> : null}
    <ol className="space-y-4">{visibleItems.map((item, index) => <li key={item.id}>
      {grouped && (index === 0 || chapterLabel(visibleItems[index - 1]!) !== chapterLabel(item)) ? <h2 className="mb-3 text-lg font-semibold">{chapterLabel(item)}</h2> : null}
      {"draft" in item ? <article className={card}>
        <div className="flex flex-wrap justify-between gap-3"><h2 className="min-w-0 break-words font-semibold">Draft {page * 20 + index + 1} · {item.filename}</h2><span className="text-sm">{item.reviewStatus} · {item.answerStatus}</span></div>
        <p className="mt-3 whitespace-pre-wrap break-words leading-7" dir="auto">{typeof item.draft.text === "string" ? item.draft.text : typeof item.draft.question === "string" ? item.draft.question : "Incomplete extraction — compare the original PDF."}</p>
        <p className="mt-3 break-words text-sm text-slate-600 dark:text-slate-300">Pages {item.pageStart}–{item.pageEnd} · Original question {item.sourceNumber ?? "not identified"} · {item.possibleDuplicates} possible duplicates{item.questionId ? " · Existing question ID retained" : ""}{item.importedAt ? " · Imported" : ""}</p>
        {item.reviewedBy ? <p className="mt-2 break-all text-xs">Reviewed by {item.reviewedBy} at {item.reviewedAt}</p> : null}
        <div className="mt-4 flex flex-wrap gap-3"><button disabled={busy} className={subjectButtonClass} onClick={() => setEditing(item)}><Pencil className="size-4" />Review & edit</button><button disabled={busy || item.reviewStatus === "APPROVED"} className={subjectButtonClass} onClick={() => void decide("approve", item)}>Approve question</button><button disabled={busy || item.reviewStatus !== "APPROVED"} className={subjectButtonClass} onClick={() => void decide("import", item)}>Import approved</button><button disabled={busy} className={subjectButtonClass} onClick={() => void decide("needs_review", item)}>Needs review</button><button disabled={busy} className={subjectButtonClass} onClick={() => void decide("reject", item)}>Reject</button></div>
      </article> : <article className={card}>
        <div className="flex flex-wrap justify-between gap-3"><h2 className="font-semibold">Question {item.displayOrder ?? page * 20 + index + 1}</h2><span className="text-sm">{item.status} · {item.approvalStatus}</span></div>
        {item.groupInstructions ? <p className="mt-3 whitespace-pre-wrap rounded-xl border p-4" dir="auto">{item.groupInstructions}</p> : null}
        {item.caseTitle || item.caseDescription ? <section className="mt-3 rounded-xl border p-4"><h3 className="font-semibold" dir="auto">{item.caseTitle}</h3><p dir="auto" className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{item.caseDescription}</p></section> : null}
        <p className="mt-4 whitespace-pre-wrap break-words text-base leading-7" dir="auto">{item.text}</p>
        <ol className="mt-4 space-y-2">{(item.options.length ? item.options : item.sharedOptions ?? []).map(option => <li key={option.id} dir="auto" className={`whitespace-pre-wrap break-words rounded-xl border p-4 text-sm leading-6 ${option.id === item.correctOptionId ? "border-teal-500 bg-teal-50 dark:bg-teal-950/40" : "bg-slate-50 dark:bg-slate-800"}`}><strong>{option.id.toUpperCase()}.</strong> {option.text}{option.id === item.correctOptionId ? <span className="ml-2 font-semibold">Correct answer (Admin only)</span> : null}</li>)}</ol>
        {item.explanation ? <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6"><strong>Explanation ({item.explanationOrigin ?? "origin not recorded"}):</strong> {item.explanation}</p> : null}
        <p className="mt-4 break-words text-sm text-slate-600 dark:text-slate-300">Source: {item.filename ?? "No PDF linked"} · Page {item.pageStart ?? "—"} · Original number {item.sourceNumber ?? "—"} · Chapters: {item.chapters.join(", ") || "Unassigned"}</p>
        {item.assetCount ? <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">{item.assetCount} source assets: compare the original PDF before review.</p> : null}
        <div className="mt-4 flex flex-wrap gap-3"><Link className={subjectButtonClass} href={(item.lessonId ? `/admin/subjects/${encodeURIComponent(data.bank.id)}/lessons?lesson=${item.lessonId}` : `${path}?view=review&search=${encodeURIComponent(item.text.slice(0, 150))}`) as Route}><Pencil className="size-4" />Edit question</Link><button aria-label={`Delete question ${item.id}`} className={`${subjectButtonClass} text-rose-700 dark:text-rose-300`} onClick={() => setDeleting(item.id)}><Trash2 className="size-4" />Delete</button></div>
      </article>}
    </li>)}</ol>
    <nav aria-label="Subject question pagination" className="flex flex-wrap justify-between gap-3">{page > 0 ? <Link className={subjectButtonClass} href={query(page - 1)}>Previous page</Link> : <span />}{(page + 1) * 20 < data.total ? <Link className={subjectButtonClass} href={query(page + 1)}>Next page</Link> : null}</nav>
    {editing ? <SubjectQuestionEditor bankId={data.bank.id} initial={editing === "new" ? null : editing} sources={data.sources} chapters={data.chapters} onClose={() => setEditing(null)} /> : null}
    {deleting ? <ModalPanel labelledBy="delete-subject-question" onCancel={() => { if (!busy) setDeleting(null); }} busy={busy}><section className="p-6"><h2 id="delete-subject-question" className="text-xl font-semibold">Delete this Subject question?</h2><p className="mt-3 text-sm leading-6">This cannot remove protected attempts or lesson history. Existing audit decisions are retained.</p><div className="mt-5 flex flex-wrap gap-3"><button autoFocus className={subjectButtonClass} disabled={busy} onClick={() => setDeleting(null)}>Cancel</button><button className={`${subjectButtonClass} text-rose-700`} disabled={busy} onClick={() => void remove()}>{busy ? "Deleting…" : "Delete question"}</button></div></section></ModalPanel> : null}
  </div>;
}

function normalizedDraft(initial: StagedSubjectQuestion | null): SubjectDraft {
  if (!initial) return blankDraft();
  const raw = initial.draft;
  const options = Array.isArray(raw.options) ? raw.options.flatMap(value => value && typeof value === "object" && "id" in value && "text" in value && typeof value.id === "string" && typeof value.text === "string" ? [{ id: value.id, text: value.text }] : []) : [];
  return { ...blankDraft(), text: typeof raw.text === "string" ? raw.text : typeof raw.question === "string" ? raw.question : "", options,
    correctOptionId: typeof raw.correctOptionId === "string" ? raw.correctOptionId : typeof raw.answer_from_source === "string" ? raw.answer_from_source : null,
    explanation: typeof raw.explanation === "string" ? raw.explanation : "", evidence: typeof raw.evidence === "string" ? raw.evidence : "",
    chapterId: typeof raw.chapterId === "string" ? raw.chapterId : null, answerPage: typeof raw.answerPage === "number" ? raw.answerPage : null, visualsReviewed: raw.visualsReviewed === true, duplicatesReviewed: raw.duplicatesReviewed === true,
    explanationOrigin: raw.explanationOrigin === "SOURCE" ? "SOURCE" : "ADMIN" };
}

function SubjectQuestionEditor({ bankId, initial, sources, chapters, onClose }: { bankId: string; initial: StagedSubjectQuestion | null; sources: SubjectQuestionsData["sources"]; chapters: SubjectQuestionsData["chapters"]; onClose: () => void }) {
  const router = useRouter(), titleId = useId();
  const [draft, setDraft] = useState(() => normalizedDraft(initial));
  const [sourceId, setSource] = useState(initial?.sourceId ?? ""), [pageStart, setStart] = useState(initial?.pageStart ?? 1), [pageEnd, setEnd] = useState(initial?.pageEnd ?? 1), [number, setNumber] = useState(initial?.sourceNumber ?? "");
  const [answerStatus, setAnswerStatus] = useState<SubjectStageInput["answerStatus"]>((["SOURCE_VERIFIED", "AMBIGUOUS", "MISSING_IN_SOURCE", "MEDICALLY_REVIEWED"].includes(initial?.answerStatus ?? "") ? initial?.answerStatus : "UNVERIFIED") as SubjectStageInput["answerStatus"]);
  const [notes, setNotes] = useState(initial?.notes ?? ""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    try { const result = await manageSubjectImport("stage", bankId, initial?.id ?? crypto.randomUUID(), { sourceId: sourceId || null, expectedRevision: initial?.revision ?? null, pageStart, pageEnd, sourceNumber: number, answerStatus, notes, draft });
      if (!result.ok) { setError(result.error.message); return; } router.refresh(); onClose();
    } catch { setError("Unable to save this draft."); } finally { setBusy(false); }
  }
  return <ModalPanel labelledBy={titleId} busy={busy} onCancel={onClose}><form onSubmit={save} className="p-5 sm:p-7"><h2 id={titleId} className="text-2xl font-semibold">{initial ? "Review & edit question" : "Add Subject question"}</h2><p className="mt-3 text-sm leading-6">Saving creates a pending draft, not approval or publication. Compare the complete original source; flag corrections separately.</p>
    <fieldset disabled={busy} className="mt-5 grid min-w-0 gap-4"><legend className="sr-only">Question review</legend>
      <label className="grid gap-2 text-sm">Question text<textarea autoFocus dir="auto" rows={6} maxLength={10000} className={subjectFieldClass} value={draft.text} onChange={event => setDraft({ ...draft, text: event.target.value })} /></label>
      {draft.options.map((option, index) => <div key={option.id} className="grid min-w-0 gap-2 rounded-xl border p-3"><label className="grid gap-2 text-sm">Answer {index + 1}<textarea dir="auto" rows={2} maxLength={5000} className={subjectFieldClass} value={option.text} onChange={event => setDraft({ ...draft, options: draft.options.map(item => item.id === option.id ? { ...item, text: event.target.value } : item) })} /></label><div className="flex flex-wrap items-center justify-between gap-3"><label className="flex min-h-11 items-center gap-3 text-sm"><input type="radio" name="correctOption" checked={draft.correctOptionId === option.id} onChange={() => setDraft({ ...draft, correctOptionId: option.id })} />Correct answer</label><button type="button" aria-label={`Remove answer ${index + 1}`} disabled={draft.options.length <= 2} className={subjectButtonClass} onClick={() => setDraft({ ...draft, options: draft.options.filter(item => item.id !== option.id), correctOptionId: draft.correctOptionId === option.id ? null : draft.correctOptionId })}><Trash2 className="size-4" /></button></div></div>)}
      <button type="button" className={subjectButtonClass} disabled={draft.options.length >= 10} onClick={() => setDraft({ ...draft, options: [...draft.options, { id: crypto.randomUUID(), text: "" }] })}>Add answer choice</button>
      <label className="grid gap-2 text-sm">Answer verification<Select className={subjectFieldClass} value={answerStatus} onChange={event => setAnswerStatus(event.target.value as SubjectStageInput["answerStatus"])}><option value="UNVERIFIED">Unverified</option><option value="SOURCE_VERIFIED">Explicit answer in source</option><option value="MISSING_IN_SOURCE">Missing in source</option><option value="AMBIGUOUS">Ambiguous</option><option value="MEDICALLY_REVIEWED">Admin correction — not the source key</option></Select></label>
      <label className="grid gap-2 text-sm">Answer evidence<textarea dir="auto" rows={3} maxLength={10000} className={subjectFieldClass} value={draft.evidence} onChange={event => setDraft({ ...draft, evidence: event.target.value })} /></label>
      <label className="grid gap-2 text-sm">Answer source page (optional)<input type="number" min={1} max={2000} value={draft.answerPage ?? ""} onChange={event => setDraft({ ...draft, answerPage: event.target.value ? event.target.valueAsNumber : null })} className={subjectFieldClass} /></label>
      <label className="grid gap-2 text-sm">Why this answer is correct<textarea dir="auto" rows={4} maxLength={10000} className={subjectFieldClass} value={draft.explanation} onChange={event => setDraft({ ...draft, explanation: event.target.value })} /></label>
      <label className="grid gap-2 text-sm">Explanation origin<Select className={subjectFieldClass} value={draft.explanationOrigin} onChange={event => setDraft({ ...draft, explanationOrigin: event.target.value as SubjectDraft["explanationOrigin"] })}><option value="ADMIN">Admin explanation (not quoted from source)</option><option value="SOURCE">Explicit explanation in source</option></Select></label>
      <label className="grid gap-2 text-sm">Source PDF<Select className={subjectFieldClass} value={sourceId} disabled={Boolean(initial)} onChange={event => setSource(event.target.value)}><option value="">Admin authored — no PDF</option>{sources.map(source => <option key={source.id} value={source.id}>{source.filename}</option>)}</Select></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm">Start page<input type="number" min={1} max={2000} value={pageStart} onChange={event => setStart(event.target.valueAsNumber)} className={subjectFieldClass} /></label><label className="grid gap-2 text-sm">End page<input type="number" min={pageStart} max={2000} value={pageEnd} onChange={event => setEnd(event.target.valueAsNumber)} className={subjectFieldClass} /></label></div>
      <label className="grid gap-2 text-sm">Original question number<input value={number} maxLength={100} onChange={event => setNumber(event.target.value)} className={subjectFieldClass} /></label>
      <label className="grid gap-2 text-sm">Optional chapter<Select value={draft.chapterId ?? ""} className={subjectFieldClass} onChange={event => setDraft({ ...draft, chapterId: event.target.value || null })}><option value="">Unassigned</option>{chapters.map(chapter => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</Select></label>
      <label className="grid gap-2 text-sm">Review notes / proposed corrections<textarea rows={3} maxLength={5000} value={notes} onChange={event => setNotes(event.target.value)} className={subjectFieldClass} /></label>
      <label className="flex min-h-11 items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 size-5 shrink-0" checked={draft.visualsReviewed} onChange={event => setDraft({ ...draft, visualsReviewed: event.target.checked })} />I compared the source and all required text, tables and visual information are complete. No essential diagram is missing.</label>
      <label className="flex min-h-11 items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 size-5 shrink-0" checked={draft.duplicatesReviewed} onChange={event => setDraft({ ...draft, duplicatesReviewed: event.target.checked })} />I reviewed possible duplicates and confirmed this is a distinct question or the existing linked record.</label>
    </fieldset>{error ? <p role="alert" className="mt-4 text-rose-700 dark:text-rose-300">{error}</p> : null}<div className="mt-6 flex flex-wrap gap-3"><button disabled={busy} className={subjectButtonClass}>{busy ? "Saving…" : "Save pending draft"}</button><button type="button" disabled={busy} onClick={onClose} className={subjectButtonClass}>Cancel</button></div>
  </form></ModalPanel>;
}
