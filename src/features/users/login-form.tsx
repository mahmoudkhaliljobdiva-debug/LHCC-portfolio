"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { saveDemoSession } from "@/services/demo-session";
import { useUserManagement } from "@/features/users/user-management-provider";
import { getEffectiveUserStatus } from "@/utils/user-activation";

export function LoginForm({ reason }: { readonly reason?: string | undefined }) {
  const router = useRouter();
  const { users, isReady } = useUserManagement();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(reasonMessage(reason));
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const user = users.find((item) => item.email.trim().toLocaleLowerCase() === email.trim().toLocaleLowerCase());
    if (!user) { setError("No student or teacher account matches this email address."); return; }
    const status = getEffectiveUserStatus(user);
    if (status === "inactive") { setError("Your account is inactive. Please contact the administrator."); return; }
    if (status === "expired") { setError("Your subscription has expired. Please contact the administrator to reactivate your account."); return; }
    setIsSubmitting(true);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 250));
    saveDemoSession({ userId: user.id, role: user.role });
    router.push(user.role === "student" ? "/student" : "/teacher");
  }

  return <section className="w-full max-w-md"><p className="text-sm font-semibold text-teal-700">Welcome back</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Sign in to your workspace</h1><p className="mt-3 text-sm leading-6 text-slate-500">Use a demo student or teacher account. Password validation is not implemented.</p>{error && <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}<form onSubmit={submit} className="mt-7 grid gap-5"><label className="grid gap-2 text-sm font-medium text-slate-700">Email address<input type="email" required value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="you@institution.edu" className="h-12 rounded-xl border bg-white px-4 text-slate-900 placeholder:text-slate-400" /></label><label className="grid gap-2 text-sm font-medium text-slate-700">Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Demo password" className="h-12 rounded-xl border bg-white px-4 text-slate-900 placeholder:text-slate-400" /></label><button type="submit" disabled={!isReady || isSubmitting} className="mt-1 rounded-xl bg-teal-700 px-5 py-3.5 text-center text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">{isSubmitting ? "Checking account…" : "Continue to demo"}</button></form><div className="mt-6 rounded-xl border bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-700">Quick-fill active demo accounts</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setEmail("maya@example.edu")} className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-slate-600">Student</button><button type="button" onClick={() => setEmail("daniel@example.edu")} className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-slate-600">Teacher</button></div></div><Link href="/admin" className="mt-5 block rounded-lg border px-3 py-2 text-center text-xs font-semibold text-slate-600 hover:bg-slate-50">Open admin demo</Link></section>;
}

function reasonMessage(reason: string | undefined): string { if (reason === "inactive") return "Your account is inactive. Please contact the administrator."; if (reason === "expired") return "Your subscription has expired. Please contact the administrator to reactivate your account."; if (reason === "role") return "This account cannot access the requested portal."; return ""; }
