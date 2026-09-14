"use client";

import { AlertCircle } from "lucide-react";

export default function PortfolioPageError({ reset }: { readonly reset: () => void }) {
  return (
    <section role="alert" className="mx-auto max-w-3xl px-5 py-24 text-center">
      <AlertCircle className="mx-auto size-8 text-rose-600" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-semibold text-slate-950">This page could not be loaded</h1>
      <p className="mt-2 text-sm text-slate-600">The latest portfolio content is temporarily unavailable.</p>
      <button type="button" onClick={reset} className="mt-6 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white">
        Try again
      </button>
    </section>
  );
}
