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
        <nav aria-label="Primary navigation" className="hidden items-center gap-8 md:flex">
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
        <div className="hidden items-center gap-3 md:flex">
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
            Explore demo
          </Link>
        </div>
        <button
          type="button"
          className="rounded-lg p-2 text-slate-700 md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      <div
        className={cn(
          "border-t border-slate-100 bg-white px-5 py-5 md:hidden",
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
          <Link href="/login" className="mt-2 rounded-lg border px-3 py-3 text-center font-semibold">
            Sign in
          </Link>
          <Link href="/signup" onClick={() => setOpen(false)} className="rounded-lg bg-teal-700 px-3 py-3 text-center font-semibold text-white hover:bg-teal-800">
            Create account
          </Link>
        </nav>
      </div>
    </header>
  );
}
