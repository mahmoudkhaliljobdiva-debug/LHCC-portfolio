"use client";

import { BookOpen, CalendarDays, Edit3, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useAdminQuestionBanks } from "@/features/question-banks/admin-question-bank-provider";
import { cn } from "@/lib/cn";
import type { AdminQuestionBank, QuestionBankInput, QuestionBankStatus } from "@/types/question-bank";

type BankDialogState = { readonly mode: "add"; readonly bank?: never } | { readonly mode: "edit"; readonly bank: AdminQuestionBank };

export function AdminQuestionBankList() {
  const router = useRouter();
  const store = useAdminQuestionBanks();
  const [dialog, setDialog] = useState<BankDialogState | null>(null);
  const [deleteBank, setDeleteBank] = useState<AdminQuestionBank | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const banks = useMemo(() => [...store.banks].sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999) || a.name.localeCompare(b.name)), [store.banks]);

  if (!store.isReady) return <div className="h-80 animate-pulse rounded-2xl border bg-white" aria-label="Loading question banks" />;

  function handleSave(input: QuestionBankInput) {
    if (dialog?.mode === "edit") {
      store.updateQuestionBank(dialog.bank.id, input);
      setSuccess(`${input.name} updated successfully.`);
    } else {
      store.addQuestionBank(input);
      setSuccess(`${input.name} added successfully.`);
    }
    setDialog(null);
  }

  function confirmDelete() {
    if (!deleteBank) return;
    store.deleteQuestionBank(deleteBank.id);
    setSuccess(`${deleteBank.name} and all linked questions were deleted.`);
    setDeleteBank(null);
  }

  return (
    <div>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-semibold text-teal-700">Content management</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Question banks</h1><p className="mt-2 text-sm text-slate-500">Create banks and manage their single-choice questions.</p></div>
        <button type="button" onClick={() => { setDialog({ mode: "add" }); setSuccess(null); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800"><Plus className="size-4" />Add Question Bank</button>
      </div>

      {success && <div role="status" className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{success}</div>}

      <div className="mb-5 flex items-center justify-between"><p className="text-sm font-medium text-slate-600">{banks.length} {banks.length === 1 ? "bank" : "banks"}</p></div>
      {banks.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-white px-6 py-16 text-center"><BookOpen className="mx-auto size-9 text-slate-400" /><h2 className="mt-4 font-semibold text-slate-900">No question banks yet</h2><p className="mt-2 text-sm text-slate-500">Add the first question bank to begin organizing questions.</p></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {banks.map((bank) => {
            const questionCount = store.getQuestionsByBankId(bank.id).length;
            return (
              <article key={bank.id} role="link" tabIndex={0} onClick={() => router.push(`/admin/question-banks/${bank.id}`)} onKeyDown={(event) => { if (event.key === "Enter") router.push(`/admin/question-banks/${bank.id}`); }} className="cursor-pointer rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-teal-600">
                <div className="flex items-start justify-between gap-4"><span className="grid size-11 place-items-center rounded-xl bg-teal-50 text-teal-700"><BookOpen className="size-5" /></span><span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize", bank.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>{bank.status}</span></div>
                <h2 className="mt-5 text-lg font-semibold text-slate-950">{bank.name}</h2>
                <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{bank.description}</p>
                <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs"><div><p className="text-slate-500">Questions</p><p className="mt-1 font-semibold text-slate-900">{questionCount}</p></div><div><p className="text-slate-500">Created</p><p className="mt-1 flex items-center gap-1 font-semibold text-slate-900"><CalendarDays className="size-3" />{formatDate(bank.createdAt)}</p></div></div>
                <div className="mt-5 flex items-center gap-2 border-t pt-4">
                  <button type="button" onClick={(event) => { event.stopPropagation(); router.push(`/admin/question-banks/${bank.id}`); }} className="mr-auto rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white">Open Bank</button>
                  <button type="button" aria-label={`Edit ${bank.name}`} onClick={(event) => { event.stopPropagation(); setDialog({ mode: "edit", bank }); setSuccess(null); }} className="rounded-lg border p-2 text-slate-600 hover:bg-slate-50"><Edit3 className="size-4" /></button>
                  <button type="button" aria-label={`Delete ${bank.name}`} onClick={(event) => { event.stopPropagation(); setDeleteBank(bank); setSuccess(null); }} className="rounded-lg border p-2 text-rose-700 hover:bg-rose-50"><Trash2 className="size-4" /></button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {dialog && <BankFormDialog state={dialog} existingBanks={store.banks} onCancel={() => setDialog(null)} onSave={handleSave} />}
      {deleteBank && <DeleteBankDialog bank={deleteBank} questionCount={store.getQuestionsByBankId(deleteBank.id).length} onCancel={() => setDeleteBank(null)} onConfirm={confirmDelete} />}
    </div>
  );
}

function BankFormDialog({ state, existingBanks, onCancel, onSave }: { readonly state: BankDialogState; readonly existingBanks: readonly AdminQuestionBank[]; readonly onCancel: () => void; readonly onSave: (input: QuestionBankInput) => void }) {
  const [name, setName] = useState(state.mode === "edit" ? state.bank.name : "");
  const [description, setDescription] = useState(state.mode === "edit" ? state.bank.description : "");
  const [status, setStatus] = useState<QuestionBankStatus>(state.mode === "edit" ? state.bank.status : "active");
  const [displayOrder, setDisplayOrder] = useState(state.mode === "edit" && state.bank.displayOrder !== undefined ? String(state.bank.displayOrder) : "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = "Bank name is required.";
    const duplicate = existingBanks.some((bank) => bank.id !== (state.mode === "edit" ? state.bank.id : "") && bank.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase());
    if (duplicate) nextErrors.name = "A question bank with this name already exists.";
    if (!description.trim()) nextErrors.description = "Description is required.";
    if (displayOrder && (!Number.isInteger(Number(displayOrder)) || Number(displayOrder) < 0)) nextErrors.displayOrder = "Display order must be a positive whole number.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const base = { name: name.trim(), description: description.trim(), status };
    onSave(displayOrder ? { ...base, displayOrder: Number(displayOrder) } : base);
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="bank-form-title" className="w-full max-w-xl rounded-2xl border bg-white p-5 shadow-2xl sm:p-7">
        <h2 id="bank-form-title" className="text-xl font-semibold text-slate-950">{state.mode === "edit" ? "Edit question bank" : "Add question bank"}</h2>
        <p className="mt-1 text-sm text-slate-500">Configure the bank shown in the admin question library.</p>
        <div className="mt-6 grid gap-5">
          <Field label="Bank name" value={name} error={errors.name} autoFocus onChange={(value) => { setName(value); setErrors((current) => ({ ...current, name: "" })); }} />
          <Field label="Description" value={description} error={errors.description} multiline onChange={(value) => { setDescription(value); setErrors((current) => ({ ...current, description: "" })); }} />
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-700">Status<select value={status} onChange={(event) => setStatus(event.target.value as QuestionBankStatus)} className="h-11 rounded-xl border bg-slate-50 px-3"><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
            <Field label="Display order (optional)" value={displayOrder} error={errors.displayOrder} inputMode="numeric" onChange={setDisplayOrder} />
          </div>
        </div>
        <div className="mt-7 flex justify-end gap-3"><button type="button" onClick={onCancel} className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button type="submit" className="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white">Save Question Bank</button></div>
      </form>
    </div>
  );
}

function DeleteBankDialog({ bank, questionCount, onCancel, onConfirm }: { readonly bank: AdminQuestionBank; readonly questionCount: number; readonly onCancel: () => void; readonly onConfirm: () => void }) {
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4"><div role="alertdialog" aria-modal="true" aria-labelledby="delete-bank-title" className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-2xl"><h2 id="delete-bank-title" className="text-lg font-semibold text-slate-950">Delete {bank.name}?</h2><p className="mt-3 text-sm leading-6 text-slate-500">This permanently deletes the bank and all {questionCount} linked {questionCount === 1 ? "question" : "questions"}. This action cannot be undone.</p><div className="mt-6 flex justify-end gap-3"><button type="button" autoFocus onClick={onCancel} className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button type="button" onClick={onConfirm} className="rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white">Delete bank and questions</button></div></div></div>;
}

function Field({ label, value, error, multiline = false, autoFocus = false, inputMode, onChange }: { readonly label: string; readonly value: string; readonly error?: string | undefined; readonly multiline?: boolean; readonly autoFocus?: boolean; readonly inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; readonly onChange: (value: string) => void }) {
  const field = multiline ? <textarea rows={4} value={value} autoFocus={autoFocus} aria-invalid={Boolean(error)} onChange={(event) => onChange(event.target.value)} className={cn("rounded-xl border bg-slate-50 px-3.5 py-3 text-sm", error && "border-rose-400")} /> : <input value={value} autoFocus={autoFocus} inputMode={inputMode} aria-invalid={Boolean(error)} onChange={(event) => onChange(event.target.value)} className={cn("h-11 rounded-xl border bg-slate-50 px-3.5 text-sm", error && "border-rose-400")} />;
  return <label className="grid gap-2 text-sm font-medium text-slate-700">{label}{field}{error && <span className="text-xs text-rose-700">{error}</span>}</label>;
}

function formatDate(value: string): string { return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value)); }
