import { LogOut } from "lucide-react";
import Link from "next/link";

import { logout } from "@/actions/auth";

export function AccountAccessMessage({ eyebrow, title, message, allowSignOut = true }: { readonly eyebrow: string; readonly title: string; readonly message: string; readonly allowSignOut?: boolean }) {
  return (
    <section className="w-full max-w-md">
      <p className="text-sm font-semibold text-teal-700">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
      <p className="mt-4 text-sm leading-7 text-slate-600">{message}</p>
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <Link href="/" className="rounded-xl border px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50">Return home</Link>
        {allowSignOut && <form action={logout}><button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white"><LogOut className="size-4" />Sign out</button></form>}
      </div>
    </section>
  );
}
