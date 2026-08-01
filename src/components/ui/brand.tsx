import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/cn";

export function Brand({ inverse = false }: { readonly inverse?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="L.H.C.C home"
      className={cn(
        "inline-flex items-center gap-2.5 font-semibold tracking-[-0.02em]",
        inverse ? "text-white" : "text-slate-950",
      )}
    >
      <Image
        src="/images/lhcc-logo.png"
        alt=""
        width={40}
        height={40}
        priority
        className="size-10 rounded-full object-cover"
      />
      <span className="leading-tight">
        <span className="block text-xl">L.H.C.C</span>
        <span className={cn("hidden text-[9px] font-medium tracking-wide sm:block", inverse ? "text-slate-300" : "text-slate-500 dark:text-slate-400")}>
          Lebanese Health &amp; Competence Center
        </span>
      </span>
    </Link>
  );
}
