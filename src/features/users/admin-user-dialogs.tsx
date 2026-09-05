"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";
import type { ServerResult } from "@/types/server-result";
import type { ManagedUserRole, PlatformUser, PlatformUserInput, UserAccountStatus } from "@/types/user-management";
import { addCalendarMonths, getTodayDate } from "@/utils/user-activation";

export type UserDialogState =
  | { readonly mode: "add"; readonly user?: never }
  | { readonly mode: "edit"; readonly user: PlatformUser };

interface UserFormDialogProps {
  readonly state: UserDialogState;
  readonly users: readonly PlatformUser[];
  readonly bankNames: readonly string[];
  readonly onCancel: () => void;
  readonly onSave: (input: PlatformUserInput) => Promise<ServerResult<PlatformUser>>;
}

export function UserFormDialog({ state, users, bankNames, onCancel, onSave }: UserFormDialogProps) {
  const editing = state.mode === "edit" ? state.user : undefined;
  const [fullName, setFullName] = useState(editing?.fullName ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [role, setRole] = useState<ManagedUserRole>(editing?.role ?? "student");
  const [start, setStart] = useState(editing?.activationStartDate ?? getTodayDate());
  const [months, setMonths] = useState(editing?.role === "teacher" ? (editing.activationMonths ?? 1) : 1);
  const [status, setStatus] = useState<Exclude<UserAccountStatus, "expired">>(editing?.status === "inactive" ? "inactive" : "active");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const expiration = safeExpiration(start, role === "student" ? 1 : months);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!fullName.trim()) next.fullName = "Full name is required.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = "Enter a valid email address.";
    if (users.some((user) => user.id !== editing?.id && user.email.trim().toLocaleLowerCase() === email.trim().toLocaleLowerCase())) next.email = "This email address is already in use.";
    if (!start) next.activationStartDate = "Activation start date is required.";
    if (role === "teacher" && (!Number.isInteger(months) || months < 1 || months > 36)) next.activationMonths = "Choose between 1 and 36 months.";
    if (phone.trim().length > 50) next.phone = "Phone number is too long.";
    setErrors(next);
    setGeneralError("");
    if (Object.keys(next).length) return;

    setIsSaving(true);
    try {
      const result = await onSave({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role,
        status,
        activationStartDate: start,
        activationMonths: role === "student" ? 1 : months,
      });
      if (!result.ok) {
        const fieldErrors = Object.fromEntries(
          Object.entries(result.error.fieldErrors ?? {}).map(([key, messages]) => [key, messages[0] ?? result.error.message]),
        );
        setErrors(fieldErrors);
        setGeneralError(result.error.message);
        setIsSaving(false);
      }
    } catch {
      setGeneralError("Unable to save the user. Please try again.");
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/55 p-4">
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="user-form-title" className="my-6 w-full max-w-3xl rounded-2xl border bg-white p-5 shadow-2xl sm:p-7">
        <h2 id="user-form-title" className="text-xl font-semibold text-slate-950">{editing ? "Edit user" : "Add user"}</h2>
        <p className="mt-2 text-sm text-slate-500">{editing ? "Changes are applied to Supabase Auth and the linked profile." : "The user receives an email invitation to set a private password."}</p>
        {generalError && <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{generalError}</div>}
        <div className="mt-6 grid gap-5">
          <TextField label="Full name" value={fullName} error={errors.fullName} onChange={setFullName} />
          <TextField label="Email" type="email" value={email} error={errors.email} onChange={setEmail} />
          <TextField label="Phone (optional)" type="tel" value={phone} error={errors.phone} onChange={setPhone} />
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-700">Role<select value={role} onChange={(event) => { const next = event.target.value as ManagedUserRole; setRole(next); if (next === "student") setMonths(1); }} className="h-11 rounded-xl border bg-slate-50 px-3"><option value="student">Student</option><option value="teacher">Teacher</option></select></label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">Status<select value={status} onChange={(event) => setStatus(event.target.value as "active" | "inactive")} className="h-11 rounded-xl border bg-slate-50 px-3"><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
            <TextField label="Activation start date" type="date" value={start} error={errors.activationStartDate} onChange={setStart} />
            {role === "student" ? <label className="grid gap-2 text-sm font-medium text-slate-700">Activation duration<input value="1 calendar month" readOnly className="h-11 rounded-xl border bg-slate-100 px-3 text-slate-600" /></label> : <TextField label="Activation duration in months" type="number" min={1} max={36} value={String(months)} error={errors.activationMonths} onChange={(value) => setMonths(Number(value))} />}
          </div>
          <div className="rounded-xl border bg-teal-50 p-4 text-sm"><p className="text-xs font-medium text-slate-500">Preview only — server recalculates expiration</p><p className="mt-1 font-semibold text-slate-900">{expiration ? formatDate(expiration) : "Select a valid date"}</p></div>
          <section className="border-t pt-5 opacity-70">
            <h3 className="font-semibold text-slate-950">Question Bank Access</h3>
            <p className="mt-1 text-xs text-slate-500">Deferred to a later Supabase phase. These mock controls are intentionally disabled.</p>
            <div className="mt-4 grid gap-3">{bankNames.map((name) => <label key={name} className="flex items-center gap-3 rounded-xl border bg-slate-50 p-4 text-sm font-semibold text-slate-600"><input type="checkbox" disabled className="size-4" />{name}<span className="ml-auto text-xs font-normal">Not migrated</span></label>)}</div>
          </section>
        </div>
        <div className="mt-7 flex justify-end gap-3"><button type="button" disabled={isSaving} onClick={onCancel} className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">Cancel</button><button type="submit" disabled={isSaving} className="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{isSaving ? "Saving…" : editing ? "Save Changes" : "Send Invitation"}</button></div>
      </form>
    </div>
  );
}

export function ReactivateDialog({ user, onCancel, onConfirm }: { readonly user: PlatformUser; readonly onCancel: () => void; readonly onConfirm: (months: number) => Promise<ServerResult<PlatformUser>> }) {
  const [months, setMonths] = useState(user.role === "student" ? 1 : Math.max(1, user.activationMonths ?? 1));
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const expiration = addCalendarMonths(getTodayDate(), user.role === "student" ? 1 : months);
  async function confirm() { setIsPending(true); setError(""); const result = await onConfirm(user.role === "student" ? 1 : months); if (!result.ok) { setError(result.error.message); setIsPending(false); } }
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4"><div role="dialog" aria-modal="true" aria-labelledby="reactivate-title" className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-2xl"><h2 id="reactivate-title" className="text-lg font-semibold text-slate-950">Reactivate {user.fullName}</h2><p className="mt-2 text-sm text-slate-500">A new activation period begins on the server today.</p>{error && <div role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}{user.role === "student" ? <p className="mt-5 rounded-xl bg-teal-50 p-4 text-sm text-slate-700">Student duration: <strong>1 calendar month</strong></p> : <label className="mt-5 grid gap-2 text-sm font-medium text-slate-700">Activation months<input type="number" min={1} max={36} value={months} onChange={(event) => setMonths(Math.min(36, Math.max(1, Number(event.target.value))))} className="h-11 rounded-xl border bg-slate-50 px-3" /></label>}<p className="mt-4 text-sm text-slate-600">Preview expiration: <strong>{formatDate(expiration)}</strong></p><div className="mt-6 flex justify-end gap-3"><button type="button" disabled={isPending} onClick={onCancel} className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">Cancel</button><button type="button" disabled={isPending} onClick={confirm} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{isPending ? "Reactivating…" : "Reactivate"}</button></div></div></div>;
}

export function DeactivateDialog({ user, onCancel, onConfirm }: { readonly user: PlatformUser; readonly onCancel: () => void; readonly onConfirm: () => Promise<ServerResult<PlatformUser>> }) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  async function confirm() { setIsPending(true); setError(""); const result = await onConfirm(); if (!result.ok) { setError(result.error.message); setIsPending(false); } }
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4"><div role="alertdialog" aria-modal="true" aria-labelledby="deactivate-user-title" className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-2xl"><h2 id="deactivate-user-title" className="text-lg font-semibold text-slate-950">Deactivate {user.fullName}?</h2><p className="mt-3 text-sm leading-6 text-slate-500">Access stops on the next protected request. The Auth identity and historical records are retained.</p>{error && <div role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}<div className="mt-6 flex justify-end gap-3"><button type="button" autoFocus disabled={isPending} onClick={onCancel} className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">Cancel</button><button type="button" disabled={isPending} onClick={confirm} className="rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{isPending ? "Deactivating…" : "Deactivate User"}</button></div></div></div>;
}

function TextField({ label, value, error, type = "text", min, max, onChange }: { readonly label: string; readonly value: string; readonly error?: string | undefined; readonly type?: "text" | "email" | "tel" | "date" | "number"; readonly min?: number; readonly max?: number; readonly onChange: (value: string) => void }) { return <label className="grid gap-2 text-sm font-medium text-slate-700">{label}<input type={type} min={min} max={max} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} className={cn("h-11 rounded-xl border bg-slate-50 px-3", error && "border-rose-400")} />{error && <span className="text-xs text-rose-700">{error}</span>}</label>; }
function safeExpiration(start: string, months: number): string { try { return start ? addCalendarMonths(start, months) : ""; } catch { return ""; } }
function formatDate(value: string): string { return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`)); }
