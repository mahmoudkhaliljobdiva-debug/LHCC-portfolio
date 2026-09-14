"use client";

import { AlertCircle } from "lucide-react";

export function DashboardDataError({ reset }: { readonly reset: () => void }) {
  return (
    <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
      <AlertCircle className="size-6" aria-hidden="true" />
      <h1 className="mt-4 text-lg font-semibold">This workspace could not be loaded</h1>
      <p className="mt-2 text-sm text-rose-800">The platform could not retrieve the latest records. Please try again.</p>
      <button type="button" onClick={reset} className="mt-5 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-800">
        Try again
      </button>
    </section>
  );
}
