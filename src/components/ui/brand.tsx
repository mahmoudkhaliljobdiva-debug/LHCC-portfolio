import Link from "next/link";

import { cn } from "@/lib/cn";

export function Brand({ inverse = false }: { readonly inverse?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="MedLumen home"
      className={cn(
        "inline-flex items-center gap-2.5 font-semibold tracking-[-0.02em]",
        inverse ? "text-white" : "text-slate-950",
      )}
    >
      <span className="relative grid size-9 place-items-center rounded-xl bg-teal-600 shadow-sm">
        <span className="h-4 w-1.5 rounded-full bg-white" />
        <span className="absolute h-1.5 w-4 rounded-full bg-white" />
      </span>
      <span className="text-xl">MedLumen</span>
    </Link>
  );
}

