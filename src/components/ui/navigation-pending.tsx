"use client";

import { useLinkStatus } from "next/link";

export function NavigationPending() {
  const { pending } = useLinkStatus();
  return pending ? <span role="status" className="lhcc-navigation-pending absolute right-2 grid size-6 place-items-center rounded-full bg-white dark:bg-slate-800">
    <span aria-hidden="true" className="lhcc-spinner size-3 rounded-full border-2 border-current border-r-transparent" />
    <span className="sr-only">Opening page…</span>
  </span> : null;
}
