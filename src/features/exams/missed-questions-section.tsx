"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowUpRight, ChevronRight, RotateCcw, X } from "lucide-react";
import { MissedQuestionDetail } from "./missed-question-detail";
import type { MissedQuestion, MissedReview } from "./missed-review-types";

export function MissedQuestionsSection({ review }: { readonly review: MissedReview }) {
  const [specialty, setSpecialty] = useState("ALL");
  const [source, setSource] = useState("ALL");
  const [selected, setSelected] = useState<MissedQuestion | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const specialtyNames = useMemo(() => Array.from(new Set(review.questions.map(q => q.specialty))), [review.questions]);
  const sourceKinds = useMemo(() => Array.from(new Set(review.questions.map(q => q.sourceKind))), [review.questions]);
  const filtered = useMemo(() => review.questions.filter(q =>
    (specialty === "ALL" || q.specialty === specialty) &&
    (source === "ALL" || q.sourceKind === source),
  ), [review.questions, specialty, source]);
  const grouped = useMemo(() => {
    const result = new Map<string, Map<string, MissedQuestion[]>>();
    for (const q of filtered) {
      if (!result.has(q.specialty)) result.set(q.specialty, new Map());
      const sources = result.get(q.specialty)!;
      const label = q.sourceKind === "PAST" ? `Exam · ${q.sourceLabel}` : q.sourceLabel;
      if (!sources.has(label)) sources.set(label, []);
      sources.get(label)!.push(q);
    }
    return result;
  }, [filtered]);

  useEffect(() => {
    const current = dialog.current;
    if (!current) return;
    if (selected && !current.open) current.showModal();
    if (!selected && current.open) current.close();
  }, [selected]);

  return <section id="most-missed-questions" aria-labelledby="most-missed-title" className="rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-teal-700"><RotateCcw className="size-5" aria-hidden="true" /><span className="text-xs font-bold uppercase tracking-wide">Focus area</span></div>
        <h2 id="most-missed-title" className="mt-2 text-xl font-semibold text-slate-950 sm:text-2xl">Most Missed Questions</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Review questions you answered incorrectly in completed exams, grouped by specialty and exam type. The most frequently missed appear first.</p>
      </div>
      <div className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">
        {review.mistakes} {review.mistakes===1 ? "incorrect answer" : "incorrect answers"} recorded
      </div>
    </div>
    {review.questions.length === 0
      ? <div className="mt-6 flex items-start gap-3 rounded-2xl border border-dashed p-5"><AlertCircle className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden="true" /><p className="text-sm leading-6 text-slate-600">No incorrect answers from completed exams yet. Finish an exam to see personalized questions to review.</p></div>
      : <>
        <div className="mt-6 flex flex-wrap gap-3">
          <label className="min-w-[12rem] flex-1 text-xs font-semibold text-slate-600">
            Specialty
            <select value={specialty} onChange={e=>{setSpecialty(e.target.value);setSource("ALL");}} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 focus-visible:outline-2 focus-visible:outline-teal-600">
              <option value="ALL">All specialties</option>
              {specialtyNames.map(name=><option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="min-w-[12rem] flex-1 text-xs font-semibold text-slate-600">
            Exam type
            <select value={source} onChange={e=>setSource(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 focus-visible:outline-2 focus-visible:outline-teal-600">
              <option value="ALL">All exam types</option>
              {sourceKinds.map(kind=><option key={kind} value={kind}>{kind === "PAST" ? "Published exams" : kind === "RANDOM" ? "Random questions" : kind === "ALL" ? "All questions" : kind === "CHAPTER" ? "Chapter questions" : kind === "SHARED" ? "Shared exams" : "Clinical cases"}</option>)}
            </select>
          </label>
        </div>
        <p className="mt-4 text-xs text-slate-500">{filtered.length} {filtered.length === 1 ? "question" : "questions"} shown{review.uniqueQuestions > review.questions.length ? ` · Top ${review.questions.length} by miss count` : ""}</p>
        <div className="mt-5 space-y-7">
          {Array.from(grouped.entries()).map(([name, sources]) => <div key={name}>
            <h3 className="mb-3 border-l-4 border-teal-600 pl-3 text-lg font-bold text-slate-950">{name}</h3>
            <div className="space-y-4">{Array.from(sources.entries()).map(([label, items])=><div key={label} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
              <div className="mb-3 flex items-center gap-2"><ChevronRight className="size-4 text-teal-700" aria-hidden="true" /><h4 className="text-sm font-semibold text-slate-800">{label}</h4><span className="text-xs text-slate-500">({items.length})</span></div>
              <div className="space-y-2">{items.map(q=>{
                const key = `${q.bankId}-${q.sourceKind}-${q.questionId}`;
                const row = <><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-medium leading-6 text-slate-900">{q.questionText}</p><p className="mt-1 text-xs text-slate-500">{q.sourceNumber ? `Question ${q.sourceNumber} · ` : ""}{q.wrongCount} {q.wrongCount===1 ? "miss" : "misses"}</p></div><ArrowUpRight className="size-4 shrink-0 text-teal-700" aria-hidden="true" /></>;
                const classes="flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-[border-color,background-color,box-shadow] hover:border-teal-500 hover:bg-teal-50 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600";
                return <div key={key}>
                  <button type="button" className={`hidden md:flex ${classes}`} onClick={()=>setSelected(q)} aria-label={`Review question missed ${q.wrongCount} times: ${q.questionText.slice(0,80)}`}>{row}</button>
                  <Link className={`flex md:hidden ${classes}`} href={`/student/exams/review/${encodeURIComponent(q.questionId)}?source=${q.sourceKind}` as Route} aria-label={`Open question review: ${q.questionText.slice(0,80)}`}>{row}</Link>
                </div>;
              })}</div>
            </div>)}</div>
          </div>)}
        </div>
      </>}
    <dialog ref={dialog} onClose={()=>setSelected(null)} aria-label="Missed question and correct answer"
      className="m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-0 text-slate-700 shadow-2xl backdrop:bg-slate-950/65">
      {selected && <div className="p-5 sm:p-7">
        <div className="mb-5 flex items-center justify-between gap-3 border-b pb-4"><h2 className="text-lg font-semibold text-slate-950">Review your answer</h2><button autoFocus type="button" className="grid size-11 shrink-0 place-items-center rounded-xl border hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-600" onClick={()=>{dialog.current?.close();setSelected(null);}} aria-label="Close review"><X className="size-5" /></button></div>
        <MissedQuestionDetail question={selected} />
      </div>}
    </dialog>
  </section>;
}
