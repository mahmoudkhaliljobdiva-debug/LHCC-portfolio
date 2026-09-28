"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveOwnProfile } from "@/actions/profile";
import { Select } from "@/components/ui/select";
import type { CountryOption } from "@/data/countries";
import type { OwnProfileInput } from "@/types/own-profile";
import type { UserRole } from "@/types/profile";

const inputClass = "mt-2 w-full min-w-0 rounded-xl border bg-white px-4 py-3 text-base text-slate-900 sm:text-sm";

export function ProfileEditor({ initial, role, countries }: { readonly initial: OwnProfileInput; readonly role: UserRole; readonly countries: readonly CountryOption[] }) {
  const router = useRouter();
  const [baseline, setBaseline] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [errors, setErrors] = useState<Readonly<Record<string, readonly string[]>>>({});
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  function update<K extends keyof OwnProfileInput>(key: K, value: OwnProfileInput[K]) {
    setDraft(current => ({ ...current, [key]: value }));
    setFeedback(null);
    setErrors({});
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFeedback(null);
    setErrors({});
    try {
      const result = await saveOwnProfile(draft);
      if (!result.ok) {
        setErrors(result.error.fieldErrors ?? {});
        setFeedback({ success: false, message: result.error.message });
        return;
      }
      setBaseline(result.data);
      setDraft(result.data);
      setFeedback({ success: true, message: "Your profile has been updated." });
      router.refresh();
    } catch {
      setFeedback({ success: false, message: "Your profile could not be saved. Please try again." });
    } finally { setSaving(false); }
  }
  return <form onSubmit={submit} className="max-w-3xl rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
    <p className="mb-6 text-sm text-slate-500">Edit your personal information. Your role and account access are managed by an administrator.</p>
    <fieldset disabled={saving} className="grid min-w-0 gap-5 sm:grid-cols-2">
      <Field label="Full name" error={errors.fullName}><input name="fullName" autoComplete="name" required minLength={2} maxLength={200} value={draft.fullName} onChange={event => update("fullName", event.target.value)} className={inputClass} aria-invalid={Boolean(errors.fullName)} /></Field>
      <div><p className="text-sm font-medium text-slate-700">Role</p><p className="mt-3 font-semibold text-slate-900">{role === "ADMIN" ? "Admin" : role === "TEACHER" ? "Teacher" : "Student"}</p></div>
      <Field label="Country" error={errors.countryCode}><Select value={draft.countryCode ?? ""} onChange={event => update("countryCode", event.target.value || null)} className={inputClass} autoComplete="country"><option value="">Not provided</option>{countries.map(country => <option key={country.code} value={country.code}>{country.flag} {country.name} ({country.callingCode})</option>)}</Select></Field>
      <Field label="Phone number" error={errors.phone}><input type="tel" autoComplete="tel" value={draft.phone ?? ""} maxLength={30} onChange={event => update("phone", event.target.value || null)} className={inputClass} aria-invalid={Boolean(errors.phone)} /></Field>
      <Field label="Age" error={errors.age}><input type="number" min={1} max={120} step={1} value={draft.age ?? ""} onChange={event => update("age", event.target.value === "" ? null : Number(event.target.value))} className={inputClass} aria-invalid={Boolean(errors.age)} /></Field>
      <Field label="Gender" error={errors.gender}><Select value={draft.gender ?? ""} onChange={event => update("gender", event.target.value === "male" || event.target.value === "female" ? event.target.value : null)} className={inputClass}><option value="">Not provided</option><option value="male">Male</option><option value="female">Female</option></Select></Field>
      <div className="sm:col-span-2"><Field label="Home address" error={errors.homeAddress}><textarea autoComplete="street-address" rows={3} maxLength={500} value={draft.homeAddress ?? ""} onChange={event => update("homeAddress", event.target.value || null)} className={inputClass} aria-invalid={Boolean(errors.homeAddress)} /></Field></div>
    </fieldset>
    {feedback && <p role={feedback.success ? "status" : "alert"} className={`mt-5 text-sm ${feedback.success ? "text-teal-700" : "text-rose-700"}`}>{feedback.message}</p>}
    <div className="mt-6 flex flex-wrap items-center gap-3 border-t pt-5"><button type="submit" disabled={saving || !dirty} className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save Changes"}</button><button type="button" disabled={saving || !dirty} onClick={() => { setDraft(baseline); setErrors({}); setFeedback(null); }} className="rounded-xl border px-5 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50">Cancel</button>{dirty && <span className="text-sm text-slate-500">Unsaved changes</span>}</div>
  </form>;
}

function Field({ label, error, children }: { readonly label: string; readonly error: readonly string[] | undefined; readonly children: React.ReactNode }) {
  return <label className="block min-w-0 text-sm font-medium text-slate-700">{label}{children}{error && <span className="mt-1 block text-xs text-rose-700">{error.join(" ")}</span>}</label>;
}
