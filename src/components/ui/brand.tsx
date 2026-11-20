import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/cn";

export function Brand({ inverse = false, compact = false }: { readonly inverse?: boolean; readonly compact?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="L.H.C.C home"
      className={cn(
        "inline-flex min-w-0 items-center gap-2.5 font-semibold tracking-[-0.02em]",
        inverse ? "text-white" : "text-slate-950",
      )}
    >
      <Image
        src="/images/lhcc-logo.png"
        alt=""
        width={40}
        height={40}
        priority
        className="size-10 shrink-0 rounded-full object-cover"
      />
      <span className="min-w-0 leading-tight">
        <span className="block text-xl">L.H.C.C</span>
        <span className={cn("hidden text-xs font-medium tracking-wide", !compact && "sm:block", inverse ? "text-slate-300" : "text-slate-500 dark:text-slate-400")}>
          Lebanese Health &amp; Competence Center
        </span>
      </span>
    </Link>
  );
}
