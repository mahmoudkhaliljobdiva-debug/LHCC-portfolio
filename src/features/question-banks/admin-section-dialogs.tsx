"use client";

import { useState } from "react";
import type { QuestionSection, QuestionSectionInput } from "@/types/question-bank";

export function SectionFormDialog({ bankId, section, suggestedOrder, onCancel, onSave }: { bankId: string; section?: QuestionSection | undefined; suggestedOrder: number; onCancel: () => void; onSave: (input: QuestionSectionInput) => Promise<void> }) {
  const [title, setTitle] = useState(section?.title ?? "");
  const [description, setDescription] = useState(section?.description ?? "");
  const [order, setOrder] = useState(String(section?.displayOrder ?? suggestedOrder));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !description.trim() || !Number.isInteger(Number(order)) || Number(order) < 0) {
      setError("Enter a title, description, and non-negative whole-number order."); return;
    }
    setSaving(true); setError("");
    try { await onSave({ bankId, title: title.trim(), description: description.trim(), displayOrder: Number(order) }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save case."); }
    finally { setSaving(false); }
  }
  return <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/55 p-4"><form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="case-form-title" className="w-full max-w-xl rounded-2xl border bg-white p-5 shadow-2xl sm:p-7"><h2 id="case-form-title" className="text-xl font-semibold text-slate-950">{section ? "Edit clinical case" : "Add clinical case"}</h2><p className="mt-2 text-sm text-slate-500">The case description appears above its questions in new exams.</p>{error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}<div className="mt-6 grid gap-5"><label className="grid gap-2 text-sm font-medium text-slate-700">Case title<input autoFocus required maxLength={500} value={title} onChange={event => setTitle(event.target.value)} className="h-11 rounded-xl border bg-slate-50 px-3" /></label><label className="grid gap-2 text-sm font-medium text-slate-700">Case description<textarea required rows={7} maxLength={10000} value={description} onChange={event => setDescription(event.target.value)} className="rounded-xl border bg-slate-50 px-3 py-2" /></label><label className="grid gap-2 text-sm font-medium text-slate-700">Case order<input required type="number" min={0} step={1} value={order} onChange={event => setOrder(event.target.value)} className="h-11 rounded-xl border bg-slate-50 px-3" /></label></div><div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={onCancel} className="rounded-xl border px-4 py-3 text-sm font-semibold">Cancel</button><button disabled={saving} className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save case"}</button></div></form></div>;
}

export function DeleteSectionDialog({ section, questionCount, onCancel, onConfirm }: { section: QuestionSection; questionCount: number; onCancel: () => void; onConfirm: () => Promise<void> }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  async function confirm() { setDeleting(true); try { await onConfirm(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to delete case."); } finally { setDeleting(false); } }
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4"><div role="alertdialog" aria-modal="true" aria-labelledby="case-delete-title" className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-2xl"><h2 id="case-delete-title" className="text-lg font-semibold text-slate-950">Delete {section.title}?</h2><p className="mt-3 text-sm text-slate-600">{questionCount} linked {questionCount === 1 ? "question" : "questions"} will become unassigned, not deleted. Existing exam snapshots will keep their original case context.</p>{error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}<div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" autoFocus onClick={onCancel} className="rounded-xl border px-4 py-3 text-sm font-semibold">Cancel</button><button type="button" disabled={deleting} onClick={() => void confirm()} className="rounded-xl bg-rose-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{deleting ? "Deleting…" : "Delete case"}</button></div></div></div>;
}
