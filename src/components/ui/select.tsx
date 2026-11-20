import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Native interaction preserves touch pickers, keyboard navigation and form semantics. */
export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("h-12 min-w-0 rounded-xl border bg-white px-3 text-sm text-slate-900 hover:border-slate-400 disabled:opacity-50", className)} />;
}
