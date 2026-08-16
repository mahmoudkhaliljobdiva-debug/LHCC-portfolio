"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { requestPasswordReset } from "@/actions/auth";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const result = await requestPasswordReset({ email });
      if (result.ok) {
        setSuccess("If an account exists for that email, a password recovery link has been sent.");
      } else {
        setError(result.error.fieldErrors?.email?.[0] ?? result.error.message);
      }
    } catch {
      setError("Unable to send the recovery email. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="w-full max-w-md">
      <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700"><ArrowLeft className="size-4" />Back to sign in</Link>
      <p className="mt-8 text-sm font-semibold text-teal-700">Account recovery</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Reset your password</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">Enter your account email and we’ll send a secure recovery link.</p>
      {error && <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      {success && <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>}
      <form onSubmit={submit} className="mt-7 grid gap-5">
        <label className="grid gap-2 text-sm font-medium text-slate-700">Email address<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@institution.edu" className="h-12 rounded-xl border bg-white px-4 text-slate-900 placeholder:text-slate-400" /></label>
        <button type="submit" disabled={isSubmitting || Boolean(success)} className="rounded-xl bg-teal-700 px-5 py-3.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? "Sending…" : "Send recovery link"}</button>
      </form>
    </section>
  );
}
