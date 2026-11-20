"use client";

import { useState } from "react";

import { updatePassword } from "@/actions/auth";

export function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await updatePassword({ password, confirmPassword });
      if (!result.ok) {
        setError(result.error.fieldErrors?.password?.[0] ?? result.error.fieldErrors?.confirmPassword?.[0] ?? result.error.message);
        setIsSubmitting(false);
      }
    } catch {
      setError("Unable to update the password. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <section className="w-full max-w-md">
      <p className="text-sm font-semibold text-teal-700">Account recovery</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Choose a new password</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">Use at least eight characters and keep your password private.</p>
      {error && <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      <form onSubmit={submit} className="mt-7 grid gap-5">
        <label className="grid gap-2 text-sm font-medium text-slate-700">New password<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 rounded-xl border bg-white px-4 text-slate-900" /></label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">Confirm new password<input type="password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="h-12 rounded-xl border bg-white px-4 text-slate-900" /></label>
        <button type="submit" disabled={isSubmitting} className="rounded-xl bg-teal-700 px-5 py-3.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? "Updating…" : "Update password"}</button>
      </form>
    </section>
  );
}
