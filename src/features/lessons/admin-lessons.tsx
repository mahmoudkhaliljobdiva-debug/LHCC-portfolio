"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { FileText, Plus, Upload } from "lucide-react";
import { saveChapter } from "@/actions/chapters";
import { approveLessonDocument, getAdminLessonDocumentLink, loadAdminLessons, registerLessonDocument, saveLesson } from "@/actions/lessons";
import { MaterialIcon } from "@/components/ui/material-icon";
import { ModalPanel } from "@/components/ui/modal-panel";
import { Select } from "@/components/ui/select";
import { ImportQuestionEditor } from "@/features/exams/import-question-editor";
import { extractLessonText } from "@/lib/learning/lesson-extraction";
import { createClient } from "@/lib/supabase/client";
import { saveChapterSchema } from "@/lib/validation/chapters";
import { lessonDraftSchema } from "@/lib/validation/lessons";
import { materialLanguages } from "@/lib/validation/material";
import type { AdminLessonsData, LessonDocument, LessonDraft, LessonQuestion } from "@/types/lesson";
import type { ImportQuestion } from "@/types/past-exam";

const fieldClass = "min-h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";
const buttonClass = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200";
const primaryClass = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:opacity-50";
const cardClass = "min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-700 dark:bg-slate-900";
const languageLabels = { auto: "Automatic", ar: "Arabic", en: "English", mixed: "Arabic & English" } as const;
type Chapter = AdminLessonsData["chapters"][number];

function emptyQuestion(): LessonQuestion {
  return { id: crypto.randomUUID(), reuseQuestionId: null, duplicateReviewed: false, sourceNumber: "", text: "", options: [{ id: crypto.randomUUID(), text: "" }, { id: crypto.randomUUID(), text: "" }], correctOptionId: null, verified: false, includeInBank: false, caseId: null, caseTitle: "", caseDescription: "", warnings: [], explanation: "", documentId: null, sourcePage: null };
}

export function AdminLessons({ initial }: { initial: AdminLessonsData }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [data, setData] = useState(initial);
  const [draft, setDraft] = useState<LessonDraft | null>(initial.draft);
  const [saved, setSaved] = useState(() => initial.draft ? JSON.stringify(initial.draft) : "");
  const [savedLessonId, setSavedLessonId] = useState<string | null>(initial.draft?.id ?? null);
  const [operationBusy, setBusy] = useState(false);
  const [chapterBusy, setChapterBusy] = useState(false);
  const [chapterDirty, setChapterDirty] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const navigationSnapshot = useRef<{ url: string; state: unknown } | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [chapterEditing, setChapterEditing] = useState<Chapter | "new" | null>(null);
  const [documentRole, setDocumentRole] = useState<LessonDocument["documentRole"]>("ORIGINAL");
  const [provenance, setProvenance] = useState("");
  const [rawText, setRawText] = useState("");
  const [rawTextDirty, setRawTextDirty] = useState(false);
  const [sourceDocumentId, setSourceDocumentId] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [questionPage, setQuestionPage] = useState(0);
  const [sourceLink, setSourceLink] = useState<{ id: string; url: string } | null>(null);
  const [reviewedDocuments, setReviewedDocuments] = useState<string[]>([]);
  const dirty = chapterDirty || (draft !== null && (JSON.stringify(draft) !== saved || rawTextDirty));
  const busy = operationBusy || chapterBusy;
  const editingLocked = busy || needsReload;
  const pageCount = Math.max(1, Math.ceil((draft?.questions.length ?? 0) / 10));
  const currentPage = Math.min(questionPage, pageCount - 1);
  const bankId = data.bank.id;

  useEffect(() => {
    navigationSnapshot.current = { url: window.location.href, state: window.history.state as unknown };
    const guard = (event: BeforeUnloadEvent) => { if (dirty || busy) { event.preventDefault(); event.returnValue = ""; } };
    const linkGuard = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest("a[href]")) return;
      if (!busy && (target.closest("a[target='_blank']") || event.ctrlKey || event.metaKey || event.shiftKey)) return;
      if (busy || (dirty && !window.confirm("Discard unsaved lesson changes and leave this page?"))) { event.preventDefault(); event.stopPropagation(); }
    };
    const historyGuard = (event: PopStateEvent) => {
      if (!busy && (!dirty || window.confirm("Discard unsaved changes and leave this page?"))) return;
      // A cancelled Back/Forward restores only this entry; the router/history APIs are not patched.
      event.stopImmediatePropagation();
      const snapshot = navigationSnapshot.current;
      if (snapshot) window.history.pushState(snapshot.state, "", snapshot.url);
      if (busy) setNotice("Please wait for the current operation before navigating away.");
    };
    window.addEventListener("beforeunload", guard);
    window.addEventListener("popstate", historyGuard, true);
    document.addEventListener("click", linkGuard, true);
    return () => { window.removeEventListener("beforeunload", guard); window.removeEventListener("popstate", historyGuard, true); document.removeEventListener("click", linkGuard, true); };
  }, [dirty, busy]);

  function resetExtraction() { setRawText(""); setRawTextDirty(false); setSourceDocumentId(null); setWarnings([]); setSourceLink(null); setReviewedDocuments([]); setQuestionPage(0); setProvenance(""); setDocumentRole("ORIGINAL"); }
  function canReplace() { return !busy && (!dirty || window.confirm("Discard unsaved lesson changes?")); }
  function createLesson(chapterId: string) {
    if (!canReplace()) return;
    setDraft({ id: crypto.randomUUID(), bankId, chapterId, title: "", description: "", displayOrder: 0, language: data.bank.language, status: "DRAFT", expectedRevision: 0, questions: [] });
    setData(previous => ({ ...previous, documents: [] }));
    setSaved(""); setSavedLessonId(null); setNeedsReload(false); resetExtraction(); setError(""); setNotice("Save the lesson draft before uploading a PDF.");
  }
  async function selectLesson(lessonId: string | null) {
    if (!canReplace()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await loadAdminLessons(bankId, lessonId);
      if (!result.ok) { setError(result.error.message); return; }
      setData(result.data); setDraft(result.data.draft); setSaved(result.data.draft ? JSON.stringify(result.data.draft) : ""); setSavedLessonId(result.data.draft?.id ?? null); setNeedsReload(false); resetExtraction();
      router.replace(`/admin/subjects/${encodeURIComponent(bankId)}/lessons${lessonId ? `?lesson=${encodeURIComponent(lessonId)}` : ""}` as Route, { scroll: false });
    } catch { setError("Unable to load this lesson. Your current changes remain on this screen."); }
    finally { setBusy(false); }
  }
  async function refreshData(lessonId: string | null) {
    const result = await loadAdminLessons(bankId, lessonId);
    if (!result.ok) throw new Error(result.error.message);
    setData(result.data);
    return result.data;
  }
  async function save(status: LessonDraft["status"]) {
    if (!draft || editingLocked) return;
    if (status === "PUBLISHED" && !window.confirm("Mark this reviewed lesson as published? The Subject remains draft-only and Student reading is not enabled in this phase.")) return;
    if (status === "ARCHIVED" && !window.confirm("Archive this lesson? Its private documents and reviewed questions will be retained.")) return;
    const value = { ...draft, status };
    const parsed = lessonDraftSchema.safeParse(value);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check the lesson fields."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await saveLesson(parsed.data);
      if (!result.ok) { setError(result.error.message); return; }
      setSavedLessonId(result.data.id);
      setNeedsReload(true);
      // Read the persisted revision and normalized draft, rather than assuming the submitted object was stored.
      let persisted: AdminLessonsData;
      try { persisted = await refreshData(result.data.id); }
      catch { throw new Error("The lesson was saved, but its persisted draft could not be reloaded. Use Reload saved lesson before editing or saving again."); }
      if (!persisted.draft) throw new Error("The lesson was saved, but its persisted draft could not be loaded. Reload before editing again.");
      setDraft(persisted.draft); setSaved(JSON.stringify(persisted.draft)); setRawTextDirty(false); setNeedsReload(false);
      router.replace(`/admin/subjects/${encodeURIComponent(bankId)}/lessons?lesson=${encodeURIComponent(result.data.id)}` as Route, { scroll: false });
      setNotice(`Lesson ${status === "PUBLISHED" ? "marked published" : status === "ARCHIVED" ? "archived" : "saved as draft"}. Student reading and practice remain unavailable.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save the lesson. Your changes remain on this screen."); }
    finally { setBusy(false); }
  }
  function applyExtraction(text: string, documentId: string | null) {
    if (!draft || !documentId) return;
    const extracted = extractLessonText(text, documentId);
    setWarnings(extracted.warnings);
    if (extracted.questions.length === 0) { setNotice("No existing questions could be extracted. Review the PDF and transcribe questions manually; OCR and question generation are not enabled."); return; }
    if (draft.questions.length && !window.confirm("Replace this lesson draft's questions with unverified questions extracted from this PDF? Saved content is unchanged until you save.")) { setNotice("Private PDF attached; existing draft questions retained."); return; }
    setDraft({ ...draft, questions: extracted.questions.map(question => ({ ...question, includeInBank: false })), status: "DRAFT" }); setQuestionPage(0);
    setNotice("Existing PDF questions extracted as an unverified draft. Compare text, answers and explanations with the authorized source before saving or publishing.");
  }
  async function upload(file: File) {
    if (!draft || editingLocked) return;
    if (draft.expectedRevision < 1) { setError("Save this lesson draft before uploading its private PDF."); return; }
    if (!provenance.trim()) { setError("Provide the PDF source and permission/provenance notes before uploading."); return; }
    if (file.size === 0 || file.size > 20 * 1024 * 1024 || !file.name.toLowerCase().endsWith(".pdf")) { setError("Choose a non-empty PDF no larger than 20 MB."); return; }
    setBusy(true); setError(""); setNotice("");
    let registeredId: string | null = null;
    try {
      const buffer = await file.arrayBuffer();
      if (new TextDecoder().decode(new Uint8Array(buffer).slice(0, 5)) !== "%PDF-") throw new Error("This file does not have a valid PDF header.");
      const documentId = crypto.randomUUID();
      const storagePath = `${draft.id}/${documentId}.pdf`;
      const sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))].map(byte => byte.toString(16).padStart(2, "0")).join("");
      const db = createClient();
      const uploaded = await db.storage.from("lesson-source-pdfs").upload(storagePath, file, { contentType: "application/pdf", upsert: false });
      if (uploaded.error) throw new Error("Private PDF upload failed. Check administrator access and Storage configuration.");
      const registered = await registerLessonDocument({ id: documentId, lessonId: draft.id, filename: file.name, storagePath, sha256, sizeBytes: file.size, documentRole, provenance: provenance.trim() });
      if (!registered.ok) throw new Error(`${registered.error.message} The uploaded object remains private; no automatic deletion or approval was performed.`);
      registeredId = registered.data;
      setSourceDocumentId(registered.data); setReviewedDocuments([]); setSourceLink(null); setProvenance("");
      await refreshData(draft.id);
      setNotice("PDF stored privately and unapproved. Student-safe approval requires a separate explicit review.");
      try {
        const { readPdfText } = await import("@/lib/exams/pdf-reader");
        const text = await readPdfText(file);
        setRawText(text); setRawTextDirty(false); applyExtraction(text, registered.data);
      } catch (cause) { setWarnings([`Private PDF retained, but text extraction failed: ${cause instanceof Error ? cause.message : "Unreadable PDF."} Scanned PDFs need manual transcription; OCR is not enabled. Do not invent questions from lecture prose.`]); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Private PDF import failed."); if (registeredId) setNotice("The registered PDF remains private and unapproved. Reload its document list before retrying."); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  }
  async function openDocument(document: LessonDocument) {
    if (!draft || busy) return;
    setBusy(true); setError(""); setSourceLink(null);
    try {
      const result = await getAdminLessonDocumentLink(document.id, draft.id);
      if (result.ok) setSourceLink({ id: document.id, url: result.data }); else setError(result.error.message);
    } catch { setError("Unable to open this private PDF. Please retry."); }
    finally { setBusy(false); }
  }
  async function setApproval(document: LessonDocument, approved: boolean) {
    if (!draft || busy || (approved && !reviewedDocuments.includes(document.id))) return;
    if (!window.confirm(approved ? "Approve this reviewed PDF as Student-safe? Confirm it does not expose protected answer keys or private solutions before authorized feedback." : "Remove Student-safe approval from this PDF? The private document will be retained.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await approveLessonDocument({ documentId: document.id, approved });
      if (!result.ok) { setError(result.error.message); return; }
      await refreshData(draft.id); setReviewedDocuments(ids => ids.filter(id => id !== document.id)); setSourceLink(null);
      setNotice(approved ? "Student-safe PDF approval recorded. No Student document link or reading access is enabled in this phase." : "Student-safe PDF approval removed. The document remains private.");
    } catch { setError("Unable to reload the approval. Check the document status before retrying."); }
    finally { setBusy(false); }
  }
  function changeQuestion(index: number, value: ImportQuestion) {
    if (!draft) return;
    const previous = draft.questions[index];
    if (!previous) return;
    const changedCase = previous.caseId && previous.caseId === value.caseId && (previous.caseTitle !== value.caseTitle || previous.caseDescription !== value.caseDescription);
    setDraft({ ...draft, questions: draft.questions.map((question, position) => position === index ? { ...previous, ...value, explanation: previous.explanation, documentId: previous.documentId, sourcePage: previous.sourcePage, includeInBank: false } : changedCase && question.caseId === value.caseId ? { ...question, caseTitle: value.caseTitle, caseDescription: value.caseDescription, verified: false } : question) });
  }
  function moveQuestion(index: number, direction: number) {
    if (!draft) return;
    const questions = [...draft.questions], current = questions[index], adjacent = questions[index + direction];
    if (!current || !adjacent) return;
    questions[index] = adjacent; questions[index + direction] = current; setDraft({ ...draft, questions });
  }

  return <div className="min-w-0 space-y-6 pb-[env(safe-area-inset-bottom)] text-slate-800 dark:text-slate-100">
    <header><Link href="/admin/subjects" className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-700 dark:text-teal-200">Back to Subjects</Link><Link href={`/admin/subjects/${encodeURIComponent(data.bank.id)}/questions`} className="ml-4 inline-flex min-h-11 items-center text-sm font-semibold text-teal-700 dark:text-teal-200">Back to questions</Link><div className="mt-3 flex min-w-0 items-start gap-4"><span className="shrink-0 rounded-xl bg-teal-50 p-3 text-teal-700 dark:bg-teal-950/40 dark:text-teal-200"><MaterialIcon icon={data.bank.icon} className="size-12" /></span><div className="min-w-0"><p dir="auto" className="break-words text-sm text-slate-500 dark:text-slate-400">{data.bank.specialtyName ?? "Unassigned specialty"}</p><h1 dir="auto" className="mt-1 break-words text-2xl font-semibold text-slate-950 dark:text-slate-50">{data.bank.name}: Chapters & lessons</h1><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Organize real lesson content, retain private originals and review existing PDF questions. Lesson questions never enter exam question pools automatically.</p></div></div></header>
    <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">Admin authoring only: Subjects remain draft-only. Lesson publication and reviewed PDF approval do not enable Student reading, practice or access. Upload only authorized materials; original uploads are private and never automatically approved.</p>
    {notice ? <p role="status" className="rounded-xl border border-teal-200 p-4 text-sm text-teal-800 dark:border-teal-800 dark:text-teal-200">{notice}</p> : null}
    {error ? <p role="alert" className="rounded-xl border border-rose-200 p-4 text-sm text-rose-700 dark:border-rose-800 dark:text-rose-300">{error}</p> : null}
    {needsReload && !busy ? <p role="alert" className="rounded-xl border border-amber-300 p-4 text-sm text-amber-900 dark:border-amber-700 dark:text-amber-200">The save completed, but this editor has not loaded the persisted revision. Editing and saving are disabled. Use Reload saved lesson to continue.</p> : null}
    <section className={cardClass}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Chapters & lessons</h2><button type="button" disabled={busy} className={primaryClass} onClick={() => setChapterEditing("new")}><Plus aria-hidden="true" className="size-5" />Add chapter</button></div>
      {data.chapters.length === 0 ? <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">No chapters yet. Add a chapter before creating a lesson; no sample educational content is seeded.</p> : <div className="mt-5 space-y-4">{data.chapters.map(chapter => <article key={chapter.id} className="min-w-0 rounded-xl border border-slate-200 p-4 dark:border-slate-700"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h3 dir="auto" className="break-words font-semibold">{chapter.displayOrder}. {chapter.title}</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{chapter.published ? "Chapter marked published" : "Chapter draft"} · Student access not enabled</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} className={buttonClass} onClick={() => setChapterEditing(chapter)}>Edit chapter</button><button type="button" disabled={busy} className={buttonClass} onClick={() => createLesson(chapter.id)}>Add lesson</button></div></div>
        <ul className="mt-3 space-y-2">{data.lessons.filter(lesson => lesson.chapterId === chapter.id).map(lesson => <li key={lesson.id}><button type="button" disabled={busy} onClick={() => void selectLesson(lesson.id)} aria-current={draft?.id === lesson.id ? "true" : undefined} className="flex min-h-14 w-full min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-teal-600 disabled:opacity-50 dark:border-slate-600"><span dir="auto" className="min-w-0 break-words font-medium">{lesson.title}</span><span className="text-xs text-slate-500 dark:text-slate-400">{lesson.status.toLowerCase()} · {lesson.questionCount} questions · revision {lesson.revision}</span></button></li>)}</ul>
      </article>)}</div>}
    </section>
    {draft ? <section aria-label="Lesson editor" className="min-w-0 space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{draft.expectedRevision > 0 ? "Edit lesson" : "New lesson draft"}</h2><div className="flex flex-wrap items-center gap-3"><span role="status" className="text-sm text-slate-600 dark:text-slate-300">{dirty ? "Unsaved changes" : "Saved"} · {draft.status.toLowerCase()} · revision {draft.expectedRevision}</span><button type="button" disabled={busy} className={buttonClass} onClick={() => void selectLesson(null)}>Close lesson</button></div></div>
      <fieldset disabled={editingLocked} className="min-w-0 space-y-6"><legend className="sr-only">Lesson authoring</legend><section className={cardClass}><h3 className="text-lg font-semibold">1. Lesson details</h3><div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2"><label className="grid min-w-0 gap-2 text-sm font-medium sm:col-span-2">Title<input dir="auto" required maxLength={300} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} className={fieldClass} /></label><label className="grid min-w-0 gap-2 text-sm font-medium sm:col-span-2">Description<textarea dir="auto" rows={3} maxLength={5000} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} className={fieldClass} /></label><label className="grid min-w-0 gap-2 text-sm font-medium">Chapter<Select value={draft.chapterId} className={fieldClass} onChange={event => setDraft({ ...draft, chapterId: event.target.value })}>{data.chapters.map(chapter => <option key={chapter.id} value={chapter.id} dir="auto">{chapter.title}</option>)}</Select></label><label className="grid min-w-0 gap-2 text-sm font-medium">Language<Select value={draft.language} className={fieldClass} onChange={event => setDraft({ ...draft, language: event.target.value as LessonDraft["language"] })}>{materialLanguages.map(language => <option key={language} value={language}>{languageLabels[language]}</option>)}</Select></label><label className="grid min-w-0 gap-2 text-sm font-medium">Display order<input type="number" min={0} max={100000} step={1} value={Number.isFinite(draft.displayOrder) ? draft.displayOrder : ""} onChange={event => setDraft({ ...draft, displayOrder: event.target.valueAsNumber })} className={fieldClass} /></label></div></section>
      <section className={cardClass}><h3 className="text-lg font-semibold">2. Private lesson PDFs</h3><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Save a lesson draft first. Each immutable upload is unapproved, including a Student-safe derivative. Review the entire PDF for protected answer keys and private solutions before separately approving it.</p><div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2"><label className="grid min-w-0 gap-2 text-sm font-medium">Document role<Select value={documentRole} onChange={event => setDocumentRole(event.target.value as LessonDocument["documentRole"])} className={fieldClass}><option value="ORIGINAL">Original private source</option><option value="STUDENT_SAFE">Student-safe derivative (unapproved)</option></Select></label><label className="grid min-w-0 gap-2 text-sm font-medium sm:col-span-2">Source / permission / derivative provenance<textarea dir="auto" rows={3} maxLength={3000} value={provenance} onChange={event => setProvenance(event.target.value)} className={fieldClass} placeholder="Describe your authorization and any redactions or derivative source." /></label></div><input ref={fileInput} type="file" accept="application/pdf,.pdf" aria-label="Upload private lesson PDF" className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); }} /><button type="button" disabled={draft.expectedRevision < 1 || !provenance.trim()} className={`${buttonClass} mt-4`} onClick={() => fileInput.current?.click()}><Upload aria-hidden="true" className="size-5" />Upload private PDF (max 20 MB)</button>{draft.expectedRevision < 1 ? <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">Save draft to enable PDF upload.</p> : null}
        <div className="mt-5 space-y-4">{data.documents.map(document => <article key={document.id} className="min-w-0 rounded-xl border border-slate-200 p-4 dark:border-slate-700"><h4 dir="auto" className="break-words font-semibold">{document.filename}</h4><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{document.documentRole === "ORIGINAL" ? "Original" : "Student-safe derivative"} · {document.approvedForStudents ? "Reviewed Student-safe approval recorded" : "Private / unapproved"}</p><p dir="auto" className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600 dark:text-slate-300">{document.provenance}</p><p className="mt-2 break-all font-mono text-xs text-slate-500 dark:text-slate-400">SHA-256: {document.sha256}</p><button type="button" className={`${buttonClass} mt-3`} onClick={() => void openDocument(document)}><FileText aria-hidden="true" className="size-5" />Open private PDF for review</button>{sourceLink?.id === document.id ? <p className="mt-3 text-sm"><a href={sourceLink.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-teal-700 underline dark:text-teal-200">View private PDF in a new tab</a><span className="block text-slate-500 dark:text-slate-400">Admin-only link expires in 60 seconds; request a new link if needed.</span></p> : null}
          {document.approvedForStudents ? <button type="button" className={`${buttonClass} mt-3`} onClick={() => void setApproval(document, false)}>Remove Student-safe approval</button> : <div className="mt-4 space-y-3"><label className="flex min-h-12 items-start gap-3 text-sm leading-6"><input type="checkbox" checked={reviewedDocuments.includes(document.id)} onChange={event => setReviewedDocuments(ids => event.target.checked ? [...ids, document.id] : ids.filter(id => id !== document.id))} className="mt-1 size-5 shrink-0 accent-teal-700" /><span>I reviewed this PDF as Student-safe, including embedded answers and private solutions.</span></label><button type="button" disabled={!reviewedDocuments.includes(document.id)} className={buttonClass} onClick={() => void setApproval(document, true)}>Approve reviewed PDF as Student-safe</button></div>}
        </article>)}</div>
      </section>
      <section className={cardClass}><h3 className="text-lg font-semibold">3. Existing-question extraction review</h3><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Extract only questions already present in an authorized PDF. Scanned or unreadable PDFs need manual transcription. No OCR, invented medical content or automatic lecture-to-question generation is enabled.</p>{warnings.length ? <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-amber-800 dark:text-amber-200">{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul> : null}<details className="mt-4"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Review / correct extracted source text</summary><label className="mt-3 grid min-w-0 gap-2 text-sm font-medium">Private source document<Select value={sourceDocumentId ?? ""} onChange={event => setSourceDocumentId(event.target.value || null)} className={fieldClass}><option value="">Choose the source PDF</option>{data.documents.map(document => <option key={document.id} value={document.id}>{document.filename}</option>)}</Select></label><label className="mt-4 grid min-w-0 gap-2 text-sm font-medium">Source text<textarea dir="auto" rows={10} maxLength={1500000} value={rawText} onChange={event => { setRawText(event.target.value); setRawTextDirty(true); }} className={fieldClass} /></label><button type="button" disabled={!rawText.trim() || !sourceDocumentId} className={`${buttonClass} mt-3`} onClick={() => applyExtraction(rawText, sourceDocumentId)}>Extract existing questions as unverified draft</button></details><p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{draft.questions.filter(question => question.verified).length} / {draft.questions.length} verified. Resolve every warning before lesson publication.</p></section>
      <section className="min-w-0 space-y-4"><h3 className="text-lg font-semibold">4. Questions, answers & explanations</h3>{draft.questions.slice(currentPage * 10, currentPage * 10 + 10).map((question, offset) => { const index = currentPage * 10 + offset; return <article key={question.id} className="min-w-0 space-y-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
        <div dir="auto" className="min-w-0 [&_textarea]:[unicode-bidi:plaintext] [&_input]:dark:border-slate-600 [&_input]:dark:bg-slate-950 [&_input]:dark:text-slate-100 [&_textarea]:dark:border-slate-600 [&_textarea]:dark:bg-slate-950 [&_textarea]:dark:text-slate-100 [&_select]:dark:border-slate-600 [&_select]:dark:bg-slate-950 [&_select]:dark:text-slate-100 [&_details]:dark:border-slate-700 [&_details]:dark:bg-slate-900 [&_summary]:dark:text-slate-100 [&_label]:dark:text-slate-200"><ImportQuestionEditor showBankInclusion={false} question={question} index={index} total={draft.questions.length} existing={[]} sections={[]} onChange={value => changeQuestion(index, value)} onMove={direction => moveQuestion(index, direction)} onRemove={() => { if (window.confirm("Remove this question from the draft? Saved content is retained until you save.")) setDraft({ ...draft, questions: draft.questions.filter((_, position) => position !== index) }); }} /></div>
        <label className="grid min-w-0 gap-2 text-sm font-medium">Why this answer is correct (required before publishing)<textarea dir="auto" rows={3} maxLength={10000} className={fieldClass} value={question.explanation} onChange={event => setDraft({ ...draft, questions: draft.questions.map((value, position) => position === index ? { ...value, explanation: event.target.value, verified: false } : value) })} /><span className="text-xs font-normal leading-5 text-slate-600 dark:text-slate-300">Write and review the explanation against a reliable source; explanations are never generated automatically. Drafts may leave this empty. Future Student feedback will show it only after an authorized answer check or submission; Student practice is not enabled in this phase.</span></label><div className="grid min-w-0 gap-3 sm:grid-cols-2"><label className="grid min-w-0 gap-2 text-sm font-medium">Question source PDF<Select value={question.documentId ?? ""} className={fieldClass} onChange={event => setDraft({ ...draft, questions: draft.questions.map((value, position) => position === index ? { ...value, documentId: event.target.value || null, sourcePage: event.target.value === value.documentId ? value.sourcePage : null, verified: false } : value) })}><option value="">Manual transcription / no PDF reference</option>{data.documents.map(document => <option key={document.id} value={document.id}>{document.filename}</option>)}</Select></label><label className="grid min-w-0 gap-2 text-sm font-medium">Source page (optional)<input disabled={!question.documentId} type="number" min={1} max={200} step={1} className={fieldClass} value={question.sourcePage ?? ""} onChange={event => setDraft({ ...draft, questions: draft.questions.map((value, position) => position === index ? { ...value, sourcePage: event.target.value ? event.target.valueAsNumber : null, verified: false } : value) })} /></label></div>
      </article>; })}<nav aria-label="Lesson question review pages" className="flex flex-wrap items-center gap-3"><button type="button" disabled={currentPage === 0} className={buttonClass} onClick={() => setQuestionPage(currentPage - 1)}>Previous review page</button><span className="text-sm text-slate-600 dark:text-slate-300">Page {currentPage + 1} of {pageCount}</span><button type="button" disabled={currentPage + 1 >= pageCount} className={buttonClass} onClick={() => setQuestionPage(currentPage + 1)}>Next review page</button></nav><button type="button" disabled={draft.questions.length >= 1000} className={buttonClass} onClick={() => { setQuestionPage(Math.floor(draft.questions.length / 10)); setDraft({ ...draft, questions: [...draft.questions, emptyQuestion()] }); }}><Plus aria-hidden="true" className="size-5" />Add manual question</button></section>
      </fieldset><div className={`${cardClass} flex flex-wrap gap-3`}><button type="button" disabled={editingLocked} className={buttonClass} onClick={() => void save("DRAFT")}>{busy ? "Working…" : "Save draft / Unpublish"}</button><button type="button" disabled={editingLocked} className={primaryClass} onClick={() => void save("PUBLISHED")}>Publish reviewed lesson</button><button type="button" disabled={editingLocked} className={buttonClass} onClick={() => void save("ARCHIVED")}>Archive lesson</button><button type="button" disabled={busy || (draft.expectedRevision === 0 && savedLessonId !== draft.id)} className={buttonClass} onClick={() => void selectLesson(draft.id)}>Reload saved lesson</button></div>
    </section> : null}
    {chapterEditing ? <SubjectChapterForm key={chapterEditing === "new" ? "new" : chapterEditing.id} chapter={chapterEditing === "new" ? null : chapterEditing} bankId={bankId} onBusyChange={setChapterBusy} onDirtyChange={setChapterDirty} onClose={() => { setChapterEditing(null); setChapterBusy(false); setChapterDirty(false); }} onSaved={async () => { try { await refreshData(draft && draft.expectedRevision > 0 ? draft.id : null); setNotice("Chapter saved. Student access is not enabled."); } catch { setError("Chapter saved, but the list could not be refreshed. Reload before creating another chapter."); } finally { setChapterEditing(null); setChapterBusy(false); setChapterDirty(false); } }} /> : null}
  </div>;
}

function SubjectChapterForm({ chapter, bankId, onClose, onSaved, onBusyChange, onDirtyChange }: { chapter: Chapter | null; bankId: string; onClose: () => void; onSaved: () => Promise<void>; onBusyChange: (busy: boolean) => void; onDirtyChange: (dirty: boolean) => void }) {
  const titleId = useId();
  const [value, setValue] = useState(() => ({ id: chapter?.id ?? crypto.randomUUID(), bankId, title: chapter?.title ?? "", description: chapter?.description ?? "", displayOrder: chapter?.displayOrder ?? 0, published: chapter?.published ?? false }));
  const [initial] = useState(() => JSON.stringify(value));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(value) !== initial;
  useEffect(() => { onBusyChange(busy); }, [busy, onBusyChange]);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  function close() { if (!busy && (!dirty || window.confirm("Discard unsaved chapter changes?"))) onClose(); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const parsed = saveChapterSchema.safeParse(value);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check the chapter fields."); return; }
    setBusy(true); setError("");
    try { const result = await saveChapter(parsed.data); if (!result.ok) { setError(result.error.message); return; } await onSaved(); }
    catch { setError("Unable to save this chapter. Please retry."); }
    finally { setBusy(false); }
  }
  return <ModalPanel labelledBy={titleId} busy={busy} onCancel={close}><form onSubmit={submit} className="bg-white p-5 text-slate-800 sm:p-7 dark:bg-slate-900 dark:text-slate-100"><h2 id={titleId} className="text-2xl font-semibold">{chapter ? "Edit chapter" : "Add chapter"}</h2><p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">Subject organization only. This form does not change generated-exam settings or enable Student reading.</p><fieldset disabled={busy} className="mt-5 min-w-0 space-y-4"><legend className="sr-only">Chapter details</legend><label className="grid min-w-0 gap-2 text-sm font-medium">Title<input autoFocus required dir="auto" maxLength={200} value={value.title} onChange={event => setValue({ ...value, title: event.target.value })} className={fieldClass} /></label><label className="grid min-w-0 gap-2 text-sm font-medium">Description<textarea dir="auto" rows={3} maxLength={3000} value={value.description} onChange={event => setValue({ ...value, description: event.target.value })} className={fieldClass} /></label><label className="grid min-w-0 gap-2 text-sm font-medium">Display order<input required type="number" min={0} max={100000} step={1} value={Number.isFinite(value.displayOrder) ? value.displayOrder : ""} onChange={event => setValue({ ...value, displayOrder: event.target.valueAsNumber })} className={fieldClass} /></label><label className="flex min-h-12 items-start gap-3 text-sm"><input type="checkbox" checked={value.published} onChange={event => setValue({ ...value, published: event.target.checked })} className="mt-1 size-5 shrink-0 accent-teal-700" /><span>Mark chapter published (Student access remains gated by Subject publication and future access rules).</span></label></fieldset>{error ? <p role="alert" className="mt-4 text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}<div className="mt-6 flex flex-wrap gap-3"><button type="submit" disabled={busy} className={primaryClass}>{busy ? "Saving…" : "Save chapter"}</button><button type="button" disabled={busy} onClick={close} className={buttonClass}>Cancel</button></div></form></ModalPanel>;
}
