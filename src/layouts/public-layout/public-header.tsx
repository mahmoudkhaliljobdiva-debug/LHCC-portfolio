"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Brand } from "@/components/ui/brand";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/cn";

const links = [
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/platform", label: "Platform" },
  { href: "/contact", label: "Contact" },
] as const;

export function PublicHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 lg:px-8">
        <Brand />
        <nav aria-label="Primary navigation" className="hidden items-center gap-6 lg:flex xl:gap-8">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-950"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex xl:gap-3">
          <ThemeToggle />
          <Link href="/login" className="px-3 py-2 text-sm font-semibold text-slate-700">
            Sign in
          </Link>
          <Link href="/signup" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-950">
            Create account
          </Link>
          <Link
            href="/student"
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Explore platform
          </Link>
        </div>
        <button
          type="button"
          className="grid size-11 place-items-center rounded-xl text-slate-700 hover:bg-slate-50 lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      <div
        className={cn(
          "border-t border-slate-100 bg-white px-5 py-5 lg:hidden",
          !open && "hidden",
        )}
      >
        <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
          <div className="mb-2 flex items-center justify-between rounded-lg px-3 py-2">
            <span className="text-sm font-medium text-slate-600">Appearance</span>
            <ThemeToggle />
          </div>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-3 font-medium text-slate-700 hover:bg-slate-50"
            >
              {link.label}
            </Link>
          ))}
          <Link href="/login" onClick={() => setOpen(false)} className="mt-2 rounded-xl border px-3 py-3 text-center font-semibold">
            Sign in
          </Link>
          <Link href="/signup" onClick={() => setOpen(false)} className="rounded-lg bg-teal-700 px-3 py-3 text-center font-semibold text-white hover:bg-teal-800">
            Create account
          </Link>
          <Link href="/student" onClick={() => setOpen(false)} className="rounded-xl bg-slate-950 px-3 py-3 text-center font-semibold text-white hover:bg-slate-800">
            Explore platform
          </Link>
        </nav>
      </div>
    </header>
  );
}
