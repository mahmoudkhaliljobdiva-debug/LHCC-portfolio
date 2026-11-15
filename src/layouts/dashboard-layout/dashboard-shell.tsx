"use client";

import { Bell, House, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { useMobileNavigation } from "@/hooks/use-mobile-navigation";
import { LiveConnectionStatus } from "@/features/live-sync/live-sync-provider";

import { logout } from "@/actions/auth";
import { ContextBoundaryLink } from "@/features/portal-preview/context-boundary-link";
import { Brand } from "@/components/ui/brand";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { PortalNavigation } from "@/layouts/dashboard-layout/portal-navigation";
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
  const [collapsed, setCollapsed] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { panelRef, desktop } = useMobileNavigation(open, close);

  return (
    <div className="lhcc-portal-shell min-h-screen min-h-dvh bg-[#f6f8fb]" data-sidebar-collapsed={collapsed}>
      {open && (
        <button
          aria-label="Close navigation"
          className="lhcc-drawer-backdrop fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        ref={panelRef}
        id="portal-navigation"
        inert={!open && !desktop}
        role={open && !desktop ? "dialog" : undefined}
        aria-modal={open && !desktop ? true : undefined}
        aria-label={`${role} navigation`}
        className={cn(
          "portal-sidebar fixed inset-y-0 left-0 z-40 flex w-[min(268px,calc(100vw-32px))] flex-col overflow-y-auto border-r bg-white px-4 py-5 lg:w-[268px] lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="lhcc-sidebar-brand flex items-center justify-between px-2">
          <Brand compact />
          <button aria-label="Close sidebar" onClick={() => setOpen(false)} className="grid size-11 place-items-center rounded-xl hover:bg-slate-50 lg:hidden">
            <X className="size-5" />
          </button>
        </div>
        <div className="lhcc-sidebar-details mt-7 rounded-xl bg-slate-50 px-3 py-3">
          <p className="text-xs font-medium text-slate-500">Current workspace</p>
          <p className="mt-1 text-sm font-semibold text-slate-900 capitalize">{role} portal</p>
        </div>
        <PortalNavigation role={role} pathname={pathname} onNavigate={close} />
        <div className="mt-auto space-y-3 pt-6">
          <button type="button" aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} aria-expanded={!collapsed} aria-controls="portal-navigation" title={collapsed ? "Expand navigation" : "Collapse navigation"}
            className="lhcc-press hidden min-h-11 w-full items-center justify-center gap-3 rounded-xl border px-3 text-sm text-slate-600 hover:bg-slate-50 lg:flex" onClick={() => setCollapsed(current => !current)}>
            {collapsed ? <PanelLeftOpen className="size-5 shrink-0" /> : <PanelLeftClose className="size-5 shrink-0" />}<span className="lhcc-sidebar-label">Collapse navigation</span>
          </button>
          <NavigationLink href="/" aria-label="Back to website" className="lhcc-collapsed-home hidden min-h-11 items-center justify-center rounded-xl border text-teal-700"><House className="size-5" /></NavigationLink>
          <div className="lhcc-sidebar-details rounded-2xl bg-[#304f60] p-4 text-white">
          <p className="text-sm font-semibold">Need a quick tour?</p>
          <p className="mt-1 text-xs leading-5 text-sky-100">Use the navigation to move between your workspaces.</p>
          <NavigationLink href="/" className="mt-3 inline-block text-xs font-semibold text-teal-200">Back to website →</NavigationLink>
        </div></div>
      </aside>

      <div className="portal-workspace lg:pl-[268px]">
        <header className="portal-header sticky top-0 z-20 flex min-h-[72px] items-center gap-2 border-b bg-white/95 px-3 backdrop-blur sm:gap-4 sm:px-7">
          <button aria-label="Open navigation" aria-expanded={open} aria-controls="portal-navigation" onClick={() => setOpen(true)} className="grid size-11 shrink-0 place-items-center rounded-xl hover:bg-slate-50 lg:hidden">
            <Menu className="size-5" />
          </button>
          <div className="relative hidden min-w-0 max-w-sm flex-1 sm:block">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input aria-label="Search" placeholder="Search the platform" className="h-10 w-full rounded-xl border bg-slate-50 pr-3 pl-10 text-sm" />
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <button aria-label="Notifications" className="grid size-11 shrink-0 place-items-center rounded-xl border text-slate-600 hover:bg-slate-50">
              <Bell className="size-[18px]" />
            </button>
            <div className="hidden min-w-0 max-w-40 text-right sm:block">
              <p title={displayName} className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
              <p className="text-xs text-slate-500 capitalize">{role}</p>
            </div>
            <NavigationLink href="/account/settings" aria-label="Account settings" className="hidden size-11 shrink-0 place-items-center rounded-xl bg-teal-700 text-sm font-semibold text-white min-[390px]:grid">
              {displayName.split(" ").map((part) => part[0]).join("").slice(-2).toUpperCase()}
            </NavigationLink>
            <form action={logout} className="shrink-0">
              <button type="submit" aria-label="Sign out" title="Sign out" className="grid size-11 place-items-center rounded-xl border text-slate-600 hover:bg-slate-50">
                <LogOut className="size-[18px]" />
              </button>
            </form>
          </div>
        </header>
        <main className="portal-content mx-auto min-w-0 max-w-[1500px] p-4 sm:p-7 lg:p-8"><div className="mb-3"><LiveConnectionStatus /></div><div key={pathname} className="lhcc-route-content min-w-0">{children}</div></main>
      </div>
    </div>
  );
}
