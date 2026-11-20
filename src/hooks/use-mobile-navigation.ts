"use client";
import { useEffect, useRef, useState } from "react";

/** Drawer keyboard/scroll behavior is enabled only below the existing lg breakpoint. */
export function useMobileNavigation(open: boolean, close: () => void) {
  const panelRef = useRef<HTMLElement>(null);
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const media = matchMedia("(min-width: 1024px)");
    const sync = () => setDesktop(media.matches);
    sync(); media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (!open || desktop) return;
    const panel = panelRef.current;
    if (!panel) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const controls = () => [...panel.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(element => element.getClientRects().length > 0);
    controls()[0]?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key !== "Tab") return;
      const items = controls(), first = items[0], last = items.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keyboard);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keyboard); previous?.focus(); };
  }, [open, desktop, close]);
  return { panelRef, desktop };
}
