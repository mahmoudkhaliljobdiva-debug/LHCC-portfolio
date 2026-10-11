"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Plus, Upload, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { extractExamText } from "@/lib/exams/pdf-extraction";
import { registerExamSource, savePastExam, getExamSourceLink } from "@/actions/past-exams";
import { useAdminQuestionBanks } from "@/features/question-banks/admin-question-bank-provider";
import { ImportQuestionEditor } from "./import-question-editor";
import type { ImportQuestion, PastExamDraft } from "@/types/past-exam";

const inputClass = "min-h-12 w-full min-w-0 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-900";
type ManagementData = { exams:PastExamDraft[]; sources:{ id:string; filename:string; storagePath:string }[] };
function emptyQuestion():ImportQuestion { return { id:crypto.randomUUID(),reuseQuestionId:null,duplicateReviewed:false,sourceNumber:"",text:"",options:[{ id:"a",text:"" },{ id:"b",text:"" }],correctOptionId:null,verified:false,includeInBank:true,caseId:null,caseTitle:"",caseDescription:"",warnings:[] }; }
export function AdminPastExams({ bankId,initial }: { bankId:string; initial:ManagementData }) {
  const store = useAdminQuestionBanks(); const router = useRouter(); const fileInput = useRef<HTMLInputElement>(null);
  const [draft,setDraft] = useState<PastExamDraft | null>(null); const [saved,setSaved] = useState("");
  const [busy,setBusy] = useState(false); const [notice,setNotice] = useState(""); const [error,setError] = useState("");
  const [rawText,setRawText] = useState(""); const [warnings,setWarnings] = useState<string[]>([]); const [detectedYears,setDetectedYears] = useState<number[]>([]);
  const [sourceLink,setSourceLink] = useState<string | null>(null);
  const [questionPage,setQuestionPage] = useState(0);
  const pageCount = Math.max(1,Math.ceil((draft?.questions.length ?? 0)/10));
  const currentPage = Math.min(questionPage,pageCount-1);
  const dirty = draft !== null && JSON.stringify(draft)!==saved;
  useEffect(()=>{ const guard=(event:BeforeUnloadEvent)=>{ if (dirty || busy) event.preventDefault(); }; window.addEventListener("beforeunload",guard); return ()=>window.removeEventListener("beforeunload",guard); },[dirty,busy]);
  const bank = store.getQuestionBankById(bankId); const existing = store.getQuestionsByBankId(bankId); const sections = store.getSectionsByBankId(bankId);
  function open(value:PastExamDraft | null) { if (dirty && !window.confirm("Discard unsaved exam changes?")) return; setDraft(value); setSaved(value ? JSON.stringify(value) : ""); setRawText(""); setWarnings([]); setDetectedYears([]); setSourceLink(null); setQuestionPage(0); setError(""); setNotice(""); }
  function create() { open({ id:crypto.randomUUID(),bankId,sourceId:null,title:"",year:null,session:"",timeLimitMinutes:null,provenance:"",status:"DRAFT",questions:[] }); }
  async function upload(file:File) {
    if (!draft || busy) return;
    if (file.size>20*1024*1024 || !file.name.toLowerCase().endsWith(".pdf")) { setError("Choose a PDF no larger than 20 MB."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const buffer = await file.arrayBuffer(); const bytes = new Uint8Array(buffer); if (new TextDecoder().decode(bytes.slice(0,5))!=="%PDF-") throw new Error("Invalid PDF header.");
      const sourceId = crypto.randomUUID(); const storagePath = `${bankId}/${sourceId}.pdf`;
      const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256",buffer))].map(b=>b.toString(16).padStart(2,"0")).join("");
      const db = createClient(); const uploaded = await db.storage.from("exam-source-pdfs").upload(storagePath,file,{ contentType:"application/pdf",upsert:false });
      if (uploaded.error) throw new Error("Private PDF upload failed. Check admin access and storage configuration.");
      const registered = await registerExamSource({ id:sourceId,bankId,filename:file.name,storagePath,sha256:hash });
      if (!registered.ok) throw new Error(registered.error.message);
      const attached = { ...draft,sourceId,title:draft.title || file.name.replace(/\.pdf$/i,""),provenance:`Source: ${file.name}\nSHA-256: ${hash}`,status:"DRAFT" as const };
      setDraft(attached); router.refresh();
      try {
        const { readPdfText } = await import("@/lib/exams/pdf-reader"); const text = await readPdfText(file); const extracted = extractExamText(text);
        setRawText(text); setWarnings(extracted.warnings); setDetectedYears(extracted.detectedYears);
        if (draft.questions.length && !window.confirm("Replace this draft's question list with the extraction? Existing bank questions are not changed.")) { setNotice("Source attached. Existing draft questions retained."); return; }
        setDraft({ ...attached,questions:extracted.questions }); setQuestionPage(0); setNotice("PDF stored privately. Extraction is ready for review; the year still needs your confirmation.");
      } catch (cause) { setError(`PDF stored privately, but extraction failed: ${cause instanceof Error ? cause.message : "Manual review required."} You can transcribe questions or re-extract corrected text below.`); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Import failed."); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value=""; }
  }
  async function save(status:PastExamDraft["status"]) {
    if (!draft || busy) return; if (status==="PUBLISHED" && !window.confirm("Publish this reviewed examination? Students with approved bank access will be able to start it.")) return;
    setBusy(true); setError(""); setNotice(""); const value={ ...draft,status };
    try { const result=await savePastExam(value); if (!result.ok) setError(result.error.message); else { setDraft(value); setSaved(JSON.stringify(value)); setNotice(`Exam ${status==="PUBLISHED" ? "published" : status==="ARCHIVED" ? "archived" : "saved as draft"} successfully.`); router.refresh(); } }
    catch { setError("Unable to save. Draft changes remain on this screen."); } finally { setBusy(false); }
  }
  async function viewSource() {
    if (!draft?.sourceId || busy) return;
    setBusy(true); setError(""); setSourceLink(null);
    try { const result=await getExamSourceLink(draft.sourceId); if (result.ok) setSourceLink(result.data); else setError(result.error.message); }
    catch { setError("Unable to open the private source. Please retry."); }
    finally { setBusy(false); }
  }
  function changeQuestion(index:number,value:ImportQuestion) { if (!draft) return; const previous=draft.questions[index]; const changedCase=previous?.caseId && previous.caseId===value.caseId && (previous.caseTitle!==value.caseTitle || previous.caseDescription!==value.caseDescription); setDraft({ ...draft,questions:draft.questions.map((q,i)=>i===index ? value : changedCase && q.caseId===value.caseId ? { ...q,caseTitle:value.caseTitle,caseDescription:value.caseDescription,verified:false } : q) }); }
  function moveQuestion(index:number,direction:number) { if (!draft) return; const questions=[...draft.questions]; const current=questions[index]; const adjacent=questions[index+direction]; if (!current || !adjacent) return; questions[index]=adjacent; questions[index+direction]=current; setDraft({ ...draft,questions }); }
  return <div className="min-w-0 space-y-6"><header><Link href={`/admin/question-banks/${bankId}` as Route} className="text-sm font-semibold text-teal-700 dark:text-teal-200">Back to {bank?.name ?? "question bank"}</Link><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold text-slate-950">Past Year Exam Management</h1><p className="mt-2 text-sm text-slate-600">Private PDF sources → review → verify → publish. Existing clinical content stays intact.</p></div><button disabled={busy} onClick={create} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white"><Plus className="size-4" />Create / Import exam</button></div></header>
    {notice && <p role="status" className="rounded-xl border p-4 text-sm text-teal-700 dark:text-teal-200">{notice}</p>}{error && <p role="alert" className="rounded-xl border p-4 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
    {sourceLink && <p role="status" className="rounded-xl border p-4 text-sm text-slate-700"><a href={sourceLink} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-teal-700 dark:text-teal-200">View original PDF in a new tab</a><span className="block">Private link expires after 60 seconds. Use Open original PDF again if it expires.</span></p>}
    {!draft ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{initial.exams.map(e=><button key={e.id} onClick={()=>open(e)} className="min-w-0 rounded-2xl border bg-white p-5 text-left"><p className="text-3xl font-semibold text-slate-950">{e.year ?? "Year unconfirmed"}</p><h2 className="mt-3 break-words font-semibold text-slate-950">{e.title}</h2><p className="mt-2 break-words text-sm text-slate-500">{e.session || "No session label"} · {e.questions.length} questions · {e.status.toLowerCase()}</p></button>)}{!initial.exams.length && <p className="rounded-2xl border border-dashed bg-white p-6 text-sm text-slate-500 sm:col-span-2">No historical exams yet. Import an authorized PDF or create a reviewed exam.</p>}</div> : <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><button disabled={busy} onClick={()=>open(null)} className="min-h-11 rounded-xl border px-4 text-sm">Back to archive</button><p aria-live="polite" className="text-sm text-slate-600">{dirty ? "Unsaved changes" : "Saved"} · {draft.status.toLowerCase()}</p></div>
      <fieldset disabled={busy} className="min-w-0 space-y-6"><section className="rounded-2xl border bg-white p-5 sm:p-6"><h2 className="font-semibold text-slate-950">1. Source and exam details</h2><p className="mt-2 text-sm text-slate-500">Upload only materials you have permission to use. Source PDFs are admin-only and immutable.</p><input ref={fileInput} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label="Import examination PDF" onChange={e=>{ const file=e.target.files?.[0]; if (file) void upload(file); }} /><div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={()=>fileInput.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold"><Upload className="size-4" />{busy ? "Importing…" : "Import PDF"}</button>{draft.sourceId && <button type="button" onClick={()=>void viewSource()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm"><FileText className="size-4" />Open original PDF</button>}</div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm text-slate-700">Exam title<input value={draft.title} onChange={e=>setDraft({ ...draft,title:e.target.value })} className={inputClass} /></label><label className="grid gap-2 text-sm text-slate-700">Confirmed exam year<input type="number" min={1900} max={2200} value={draft.year ?? ""} placeholder="Confirm from source" onChange={e=>setDraft({ ...draft,year:e.target.value ? Number(e.target.value) : null })} className={inputClass} />{detectedYears.length>0 && <span className="text-xs text-slate-500">Candidate numbers: {detectedYears.join(", ")}. These are not automatically assigned.</span>}</label><label className="grid gap-2 text-sm text-slate-700">Session label<input value={draft.session} onChange={e=>setDraft({ ...draft,session:e.target.value })} className={inputClass} /></label><label className="grid gap-2 text-sm text-slate-700">Optional time limit (minutes)<input type="number" min={1} max={1440} value={draft.timeLimitMinutes ?? ""} onChange={e=>setDraft({ ...draft,timeLimitMinutes:e.target.value ? Number(e.target.value) : null })} className={inputClass} /></label><label className="grid gap-2 text-sm text-slate-700 sm:col-span-2">Attach existing private source (multiple sessions may share a PDF)<Select value={draft.sourceId ?? ""} onChange={e=>setDraft({ ...draft,sourceId:e.target.value || null })} className={inputClass}><option value="">No PDF attached</option>{initial.sources.map(s=><option key={s.id} value={s.id}>{s.filename}</option>)}</Select></label><label className="grid gap-2 text-sm text-slate-700 sm:col-span-2">Source provenance / permission notes<textarea rows={3} value={draft.provenance} onChange={e=>setDraft({ ...draft,provenance:e.target.value })} className={inputClass} /></label></div>
      </section>
      <section className="rounded-2xl border bg-white p-5 sm:p-6"><h2 className="font-semibold text-slate-950">2. Extraction review</h2>{warnings.map((w,i)=><p key={i} className="mt-2 text-sm text-amber-800 dark:text-amber-200">{w}</p>)}<details className="mt-4"><summary className="cursor-pointer text-sm font-medium text-slate-700">Review / correct extracted text</summary><label className="mt-3 grid gap-2 text-sm text-slate-700">Source text<textarea rows={10} value={rawText} onChange={e=>setRawText(e.target.value)} className={inputClass} /></label><button type="button" disabled={!rawText} onClick={()=>{ if (!window.confirm("Replace this draft's questions using this text?")) return; const result=extractExamText(rawText); setDraft({ ...draft,questions:result.questions,status:"DRAFT" }); setWarnings(result.warnings); setDetectedYears(result.detectedYears); }} className="mt-3 min-h-11 rounded-xl border px-4 text-sm">Re-extract as unverified draft</button></details><p className="mt-4 text-sm text-slate-500">{draft.questions.filter(q=>q.verified).length} / {draft.questions.length} verified. Resolve every warning before publishing. Reordering changes only this examination association.</p></section>
      <section className="space-y-3"><h2 className="font-semibold text-slate-950">3. Questions, clinical cases and answer keys</h2>{draft.questions.slice(currentPage*10,currentPage*10+10).map((q,offset)=>{ const i=currentPage*10+offset; return <ImportQuestionEditor key={q.id} question={q} index={i} total={draft.questions.length} existing={existing} sections={sections} onChange={value=>changeQuestion(i,value)} onMove={direction=>moveQuestion(i,direction)} onRemove={()=>{ if (window.confirm("Remove this association from the draft? Existing bank questions are not deleted.")) setDraft({ ...draft,questions:draft.questions.filter((_,n)=>n!==i) }); }} />; })}<nav aria-label="Import question pages" className="flex flex-wrap items-center gap-3"><button type="button" disabled={currentPage===0} onClick={()=>setQuestionPage(Math.max(0,currentPage-1))} className="min-h-11 rounded-xl border px-4 text-sm disabled:opacity-40">Previous review page</button><span className="text-sm text-slate-600">Review page {currentPage+1} / {pageCount}</span><button type="button" disabled={currentPage+1>=pageCount} onClick={()=>setQuestionPage(currentPage+1)} className="min-h-11 rounded-xl border px-4 text-sm disabled:opacity-40">Next review page</button></nav><button type="button" disabled={draft.questions.length>=1000} onClick={()=>{ setQuestionPage(Math.floor(draft.questions.length/10)); setDraft({ ...draft,questions:[...draft.questions,emptyQuestion()] }); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm"><Plus className="size-4" />Add question to draft</button></section></fieldset>
      <div className="flex flex-wrap gap-3 rounded-2xl border bg-white p-4"><button disabled={busy} onClick={()=>void save("DRAFT")} className="min-h-12 rounded-xl border px-4 font-semibold">{busy ? "Working…" : "Save draft / Unpublish"}</button><button disabled={busy} onClick={()=>void save("PUBLISHED")} className="min-h-12 rounded-xl bg-teal-700 px-4 font-semibold text-white disabled:opacity-40">Publish reviewed exam</button><button disabled={busy} onClick={()=>void save("ARCHIVED")} className="min-h-12 rounded-xl border px-4 text-slate-700">Archive</button></div>
    </div>}
  </div>;
}
