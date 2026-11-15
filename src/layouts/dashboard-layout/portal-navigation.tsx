"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { NavigationPending } from "@/components/ui/navigation-pending";
import { ROLE_NAVIGATION } from "@/constants/navigation";
import { ContextBoundaryLink } from "@/features/portal-preview/context-boundary-link";
import { activeNavigationIndex } from "@/lib/navigation";
import type { UserRole } from "@/types/roles";

export function PortalNavigation({ role, pathname, onNavigate }: {
  readonly role: UserRole; readonly pathname: string; readonly onNavigate: () => void;
}) {
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const items = ROLE_NAVIGATION[role];
  const active = activeNavigationIndex(pathname, items.map(item => item.href));
  const target = highlighted ?? active;
  const boundary = pathname.startsWith("/admin/view-as/");
  const NavigationLink = boundary ? ContextBoundaryLink : Link;
  return <nav aria-label={`${role} navigation`} className="lhcc-portal-nav relative mt-6"
    onPointerLeave={() => setHighlighted(null)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setHighlighted(null); }}>
    <span aria-hidden="true" className="lhcc-navigation-indicator pointer-events-none absolute inset-x-0 top-0 h-11 rounded-xl bg-[#e8f4f5]"
      style={{ "--lhcc-active-y": `calc(${Math.max(0, active)} * 3rem)`, "--lhcc-active-visible": active < 0 ? 0 : 1, opacity: target < 0 ? 0 : 1, transform: `translateY(calc(${Math.max(0, target)} * 3rem))` } as CSSProperties} />
    <ul className="relative grid gap-1">
      {items.map(({ href, label, icon: Icon }, index) => <li key={href}
        onPointerEnter={event => { if (event.pointerType === "mouse" && window.matchMedia("(hover: hover) and (pointer: fine)").matches) setHighlighted(index); }} onFocus={() => setHighlighted(index)}>
        <NavigationLink href={href} onClick={onNavigate} aria-current={index === active ? "page" : undefined} aria-label={label} title={label}
          className={`lhcc-nav-link relative flex h-11 min-w-0 items-center gap-3 rounded-xl px-3 text-sm font-medium ${index === active ? "text-teal-800" : "text-slate-600 hover:text-slate-950"}`}>
          <span className="lhcc-nav-icon grid size-5 shrink-0 place-items-center"><Icon className="size-[18px]" aria-hidden="true" /></span>
          <span className="lhcc-sidebar-label truncate">{label}</span>
          {!boundary ? <NavigationPending /> : null}
        </NavigationLink>
      </li>)}
    </ul>
  </nav>;
}
