import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, ArrowRight, BookOpenText, ShieldAlert, FileQuestion, CircleAlert } from "lucide-react";
import { notFound } from "next/navigation";
import { getLearningCatalog } from "@/lib/learning/server";
import { getMedicalStudyPreview } from "@/lib/learning/medical-preview-server";
import { getStudentBanks } from "@/lib/bank-access/server";

const PAGE_SIZE=20;
export default async function MedicalSubjectStudyPage({
  params,searchParams,
}: {
  params:Promise<{ bankId:string }>;
  searchParams:Promise<{ page?:string }>;
}) {
  const {bankId}=await params;
  const {page:rawPage}=await searchParams;
  if (rawPage && !/^(0|[1-9]\d{0,2})$/.test(rawPage)) notFound();
  const page=rawPage ? Number(rawPage) : 0;
  const med=(await getLearningCatalog()).find(s => s.slug==="medical");
  if (!med?.materials.some(m => m.id===bankId && m.materialKind==="SUBJECT")) notFound();
  const bank=(await getStudentBanks()).find(item => item.id===bankId && item.material_kind==="SUBJECT");
  if (!bank || bank.accessState!=="APPROVED") {
    return <section className="rounded-2xl border bg-white p-6"><h1 className="text-xl font-semibold text-slate-950">Course access required</h1><p className="mt-3 text-sm text-slate-600">Request access to this course and wait for LHCC administration to approve it before reading its study questions.</p><Link href="/student/question-banks" className="mt-5 inline-flex min-h-11 items-center font-semibold text-teal-700">Browse courses</Link></section>;
  }
  const study=await getMedicalStudyPreview(bankId,page);
  if (page>0 && page*PAGE_SIZE>=study.total) notFound();
  const lastPage=Math.max(1,Math.ceil(study.total/PAGE_SIZE));
  return <main className="mx-auto max-w-5xl space-y-6">
    <Link href="/student/specialties/medical" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-teal-700">
      <ArrowLeft className="size-4" aria-hidden="true" />Medicine subjects
    </Link>
    <header className="rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
      <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-teal-700"><BookOpenText className="size-4"/>Medicine · Study preview</span>
      <h1 className="mt-3 break-words text-2xl font-semibold text-slate-950 sm:text-3xl">{study.bank.name}</h1>
      <p className="mt-2 text-sm text-slate-600">{study.total} extracted question drafts · Page {page+1} of {lastPage}</p>
      <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true"/>
        <p>All extracted source drafts are included, including incomplete OCR. Many have unverified or missing answer keys. They are ungraded and cannot be used in scored exams until corrected and approved. Always check the original PDF before relying on medical details.</p>
      </div>
    </header>
    <section aria-label="Medical study questions" className="space-y-4">
      {study.questions.map((q,i)=><article key={q.id} className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Question {page*PAGE_SIZE+i+1} of {study.total}</p>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${q.quality === "SOURCE_EXTRACTED" ? "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-700 dark:bg-teal-950/30 dark:text-teal-100" : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100"}`}>
            {q.quality === "SOURCE_EXTRACTED" ? "Extracted · ungraded" : "Needs OCR review"}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-500">Source: {q.filename}{q.pageStart ? ` · PDF page ${q.pageStart}` : ""}</p>
        <h2 className="mt-3 whitespace-pre-wrap break-words text-base font-semibold leading-7 text-slate-950 sm:text-lg">{q.text || "Question text needs manual transcription from the PDF."}</h2>
        {q.quality === "NEEDS_OCR_REVIEW" && <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          This OCR draft may have missing or merged choices, diagrams, or transcription errors. It has not been verified.
        </p>}
        {q.options.length > 0 ? <ol className="mt-5 grid gap-2 sm:grid-cols-2">{q.options.map((option,index)=><li key={`${option.id}-${index}`} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
          <span className="shrink-0 font-semibold">{String.fromCharCode(65+index)}.</span>
          <span className="min-w-0 whitespace-pre-wrap break-words">{option.text}</span>
        </li>)}</ol> : <p className="mt-4 flex items-start gap-2 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:text-slate-300">
          <FileQuestion className="mt-0.5 size-4 shrink-0" aria-hidden="true"/>
          Answer choices could not be extracted. Refer to the original PDF page.
        </p>}
      </article>)}
    </section>
    <nav aria-label="Study question pages" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4">
      {page>0 ? <Link className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold text-teal-700" href={`/student/medical/${bankId}?page=${page-1}` as Route}><ArrowLeft className="size-4"/>Previous 20</Link> : <span/>}
      <span className="text-sm text-slate-600">Page {page+1} / {lastPage}</span>
      {(page+1)*PAGE_SIZE<study.total
        ? <Link className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white" href={`/student/medical/${bankId}?page=${page+1}` as Route}>Next 20 <ArrowRight className="size-4"/></Link>
        : <Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-teal-700" href="/student/specialties/medical">Other subjects <ArrowRight className="size-4"/></Link>}
    </nav>
  </main>;
}
