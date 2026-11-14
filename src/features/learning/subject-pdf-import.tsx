"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { manageSubjectImport } from "@/actions/subject-questions";
import { completeSubjectText, extractSubjectPages } from "@/lib/learning/subject-extraction";
import { readSubjectPdf } from "@/lib/learning/subject-pdf-reader";

/** Local browser extraction; original PDFs and private keys are never sent to an external parser. */
export function SubjectPdfImport({ bankId }: { bankId: string }) {
  const input = useRef<HTMLInputElement>(null), router = useRouter();
  const [driveId, setDriveId] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  async function extract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const file = input.current?.files?.[0]; if (!file || busy) return;
    if (!/^[A-Za-z0-9_-]{10,200}$/.test(driveId)) { setMessage("Enter the exact source Drive file ID, not a folder or another subject's PDF."); return; }
    setBusy(true); setMessage("Reading every PDF page locally…");
    try {
      const pages = await readSubjectPdf(file, (page, total) => setMessage(`Reading PDF page ${page} of ${total}…`));
      const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))].map(value => value.toString(16).padStart(2, "0")).join("");
      const registration = await manageSubjectImport("source", bankId, crypto.randomUUID(), { filename: file.name, driveFileId: driveId, pages: pages.length, sha256: hash });
      if (!registration.ok) throw new Error(registration.error.message);
      const sourceId = registration.data.id;
      for (const page of pages) {
        const warnings = [...(!page.text.trim() ? ["No text layer. Scanned page requires OCR/manual transcription and visual review."] : []), ...(page.hasImages ? ["Image/diagram/table may contain required information. Review the original page."] : [])];
        const saved = await manageSubjectImport("page", bankId, crypto.randomUUID(), { sourceId, page: page.page, text: page.text, status: warnings.length ? "NEEDS_REVIEW" : "EXTRACTED", warnings });
        if (!saved.ok) throw new Error(saved.error.message);
        setMessage(`Saved page coverage ${page.page} of ${pages.length}…`);
      }
      const extraction = extractSubjectPages(pages); let staged = 0;
      for (const item of extraction.questions) {
        const q = item.question;
        const saved = await manageSubjectImport("stage", bankId, q.id, { sourceId, expectedRevision: null, pageStart: item.pageStart, pageEnd: item.pageEnd, sourceNumber: q.sourceNumber,
          answerStatus: q.correctOptionId ? "SOURCE_VERIFIED" : "UNVERIFIED", notes: item.warnings.join("\n"), draft: { text: completeSubjectText(q), options: q.options, correctOptionId: q.correctOptionId, explanation: "", evidence: "", chapterId: null, visualsReviewed: false, duplicatesReviewed: false, explanationOrigin: "SOURCE" } });
        if (!saved.ok) throw new Error(saved.error.message); staged++;
      }
      setMessage(`${pages.length} pages processed; ${staged} candidate questions staged. No questions approved or published. ${pages.filter(page => page.hasImages || !page.text.trim()).length} pages require visual/OCR review.`);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "PDF extraction stopped. Saved pages remain recorded; nothing was approved."); }
    finally { setBusy(false); }
  }
  return <details className="min-w-0 rounded-2xl border bg-white p-5 dark:bg-slate-900"><summary className="cursor-pointer font-semibold">Extract PDF into pending review</summary><form onSubmit={extract} className="mt-4 grid min-w-0 gap-4">
    <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">Use the PDF belonging to this Subject. Page coverage and source identity are retained. Scans, diagrams, missing keys and explanations require manual review. Extraction never approves medical content.</p>
    <label className="grid min-w-0 gap-2 text-sm">Source Drive file ID<input required value={driveId} maxLength={200} disabled={busy} onChange={event => setDriveId(event.target.value)} className="min-h-12 min-w-0 rounded-xl border bg-transparent px-3" /></label>
    <label className="grid min-w-0 gap-2 text-sm">Source PDF<input ref={input} type="file" accept="application/pdf,.pdf" required disabled={busy} className="min-h-12 w-full min-w-0 rounded-xl border p-3 text-sm" /></label>
    <button disabled={busy} className="min-h-12 justify-self-start rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Processing…" : "Extract to staging"}</button>
    {message ? <p role="status" className="break-words text-sm leading-6">{message}</p> : null}
  </form></details>;
}
