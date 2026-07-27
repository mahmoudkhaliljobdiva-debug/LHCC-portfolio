import Link from "next/link";

import { Brand } from "@/components/ui/brand";

export function PublicFooter() {
  return (
    <footer className="bg-[#0b1f33] text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 md:grid-cols-[1.5fr_1fr_1fr] lg:px-8">
        <div>
          <Brand inverse />
          <p className="mt-5 max-w-sm text-sm leading-7 text-slate-400">
            Thoughtful learning tools for the people shaping the future of healthcare.
          </p>
        </div>
        <div>
          <p className="mb-4 text-sm font-semibold text-white">Platform</p>
          <div className="grid gap-3 text-sm">
            <Link href="/platform">Question banks</Link>
            <Link href="/platform">Performance analytics</Link>
            <Link href="/services">For educators</Link>
          </div>
        </div>
        <div>
          <p className="mb-4 text-sm font-semibold text-white">Company</p>
          <div className="grid gap-3 text-sm">
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/login">Sign in</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 px-5 py-5 text-center text-xs text-slate-500">
        © 2026 MedLumen. Frontend demonstration only.
      </div>
    </footer>
  );
}

