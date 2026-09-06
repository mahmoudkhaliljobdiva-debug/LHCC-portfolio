"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";

import { login } from "@/actions/auth";

interface LoginFeedback {
  readonly type: "error" | "success";
  readonly message: string;
}

export function LoginForm({ reason }: { readonly reason?: string | undefined }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<LoginFeedback | null>(() => reasonFeedback(reason));
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, readonly string[]>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const result = await login({ email, password });
      if (!result.ok) {
        setFeedback({ type: "error", message: result.error.message });
        setFieldErrors(result.error.fieldErrors ?? {});
        setIsSubmitting(false);
      }
    } catch {
      setFeedback({ type: "error", message: "Sign in is temporarily unavailable. Please try again." });
      setIsSubmitting(false);
    }
  }

  return (
    <section className="w-full max-w-md">
      <p className="text-sm font-semibold text-teal-700">Welcome back</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Sign in to your workspace</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">Use your L.H.C.C account email and password.</p>

      {feedback && (
        <div role={feedback.type === "error" ? "alert" : "status"} className={`mt-5 rounded-xl border px-4 py-3 text-sm ${feedback.type === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          {feedback.message}
        </div>
      )}

      <form onSubmit={submit} className="mt-7 grid gap-5">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Email address
          <input type="email" required autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setFieldErrors({}); }} placeholder="you@institution.edu" aria-invalid={Boolean(fieldErrors.email?.length)} className="h-12 rounded-xl border bg-white px-4 text-slate-900 placeholder:text-slate-400" />
          {fieldErrors.email?.[0] && <span className="text-xs text-rose-700">{fieldErrors.email[0]}</span>}
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Password
          <input type="password" required autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setFieldErrors({}); }} placeholder="Your password" aria-invalid={Boolean(fieldErrors.password?.length)} className="h-12 rounded-xl border bg-white px-4 text-slate-900 placeholder:text-slate-400" />
          {fieldErrors.password?.[0] && <span className="text-xs text-rose-700">{fieldErrors.password[0]}</span>}
        </label>
        <div className="flex justify-end">
          <Link href={"/login/forgot-password" as Route} className="text-sm font-semibold text-teal-700 hover:text-teal-800">Forgot password?</Link>
        </div>
        <button type="submit" disabled={isSubmitting} className="mt-1 rounded-xl bg-teal-700 px-5 py-3.5 text-center text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        New to L.H.C.C?{" "}
        <Link href={"/signup" as Route} className="font-semibold text-teal-700 hover:text-teal-800">
          Create an account
        </Link>
      </p>
    </section>
  );
}

function reasonFeedback(reason: string | undefined): LoginFeedback | null {
  if (reason === "auth-required") return { type: "error", message: "Sign in to access that workspace." };
  if (reason === "recovery-error") return { type: "error", message: "The password recovery link is invalid or has expired." };
  if (reason === "password-updated") return { type: "success", message: "Your password was updated successfully. Sign in with your new password." };
  if (reason === "registration-confirmed") return { type: "success", message: "Your email is confirmed. An administrator must activate your account before you can sign in." };
  return null;
}
