"use client";

import { Bell, LogOut, Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { logout } from "@/actions/auth";
import { ContextBoundaryLink } from "@/features/portal-preview/context-boundary-link";
import { Brand } from "@/components/ui/brand";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ROLE_NAVIGATION } from "@/constants/navigation";
import { cn } from "@/lib/cn";
import type { UserRole } from "@/types/roles";

export function DashboardShell({
  role,
  displayName,
  children,
}: {
  readonly role: UserRole;
  readonly displayName: string;
  readonly children: React.ReactNode;
}) {
  const pathname = usePathname();
  const NavigationLink = pathname.startsWith("/admin/view-as/") ? ContextBoundaryLink : Link;
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen min-h-dvh bg-[#f6f8fb]">
      {open && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[min(268px,calc(100vw-32px))] flex-col overflow-y-auto border-r bg-white px-4 py-5 transition-transform lg:w-[268px] lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-2">
          <Brand />
          <button aria-label="Close sidebar" onClick={() => setOpen(false)} className="grid size-11 place-items-center rounded-xl hover:bg-slate-50 lg:hidden">
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-7 rounded-xl bg-slate-50 px-3 py-3">
          <p className="text-xs font-medium text-slate-500">Current workspace</p>
          <p className="mt-1 text-sm font-semibold text-slate-900 capitalize">{role} portal</p>
        </div>
        {role === "admin" && <nav aria-label="Admin portal switcher" className="mt-3 grid gap-1 text-sm font-medium text-slate-700">
          <NavigationLink href="/admin" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 hover:bg-slate-50">Admin Portal</NavigationLink>
          <NavigationLink href={"/admin/view-as/student" as import("next").Route} onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 hover:bg-slate-50">View Student Portal</NavigationLink>
          <NavigationLink href={"/admin/view-as/teacher" as import("next").Route} onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 hover:bg-slate-50">View Teacher Portal</NavigationLink>
        </nav>}
        <nav aria-label={`${role} navigation`} className="mt-6 grid gap-1">
          {ROLE_NAVIGATION[role].map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <NavigationLink
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-[#e8f4f5] text-teal-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                )}
              >
                <Icon className="size-[18px]" aria-hidden="true" />
                {label}
              </NavigationLink>
            );
          })}
        </nav>
        <div className="mt-auto rounded-2xl bg-[#304f60] p-4 text-white">
          <p className="text-sm font-semibold">Need a quick tour?</p>
          <p className="mt-1 text-xs leading-5 text-sky-100">Use the navigation to move between your workspaces.</p>
          <NavigationLink href="/" className="mt-3 inline-block text-xs font-semibold text-teal-200">Back to website →</NavigationLink>
        </div>
      </aside>

      <div className="lg:pl-[268px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center gap-2 border-b bg-white/95 px-3 backdrop-blur sm:gap-4 sm:px-7">
          <button aria-label="Open navigation" onClick={() => setOpen(true)} className="grid size-11 shrink-0 place-items-center rounded-xl hover:bg-slate-50 lg:hidden">
            <Menu className="size-5" />
          </button>
          <div className="relative hidden max-w-sm flex-1 sm:block">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input aria-label="Search" placeholder="Search the platform" className="h-10 w-full rounded-xl border bg-slate-50 pr-3 pl-10 text-sm" />
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <button aria-label="Notifications" className="grid size-11 place-items-center rounded-xl border text-slate-600 hover:bg-slate-50">
              <Bell className="size-[18px]" />
            </button>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-900">{displayName}</p>
              <p className="text-xs text-slate-500 capitalize">{role}</p>
            </div>
            <NavigationLink href="/account/settings" aria-label="Account settings" className="hidden size-11 shrink-0 place-items-center rounded-xl bg-teal-700 text-sm font-semibold text-white min-[390px]:grid">
              {displayName.split(" ").map((part) => part[0]).join("").slice(-2).toUpperCase()}
            </NavigationLink>
            <form action={logout}>
              <button type="submit" aria-label="Sign out" title="Sign out" className="grid size-11 place-items-center rounded-xl border text-slate-600 hover:bg-slate-50">
                <LogOut className="size-[18px]" />
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto min-w-0 max-w-[1500px] p-4 sm:p-7 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
