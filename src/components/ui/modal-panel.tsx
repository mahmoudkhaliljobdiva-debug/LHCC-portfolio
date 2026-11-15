"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/** Native top-layer dialog supplies focus containment and restoration on mobile. */
export function ModalPanel({ children, labelledBy, onCancel, busy = false }: {
  readonly children: React.ReactNode;
  readonly labelledBy: string;
  readonly onCancel: () => void;
  readonly busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    // A mobile-only close control must not steal initial focus, then disappear
    // with it when the viewport crosses sm (rotation or an external keyboard).
    if (dialog?.querySelector("[data-modal-controls]")?.contains(document.activeElement)) {
      const first = [...dialog.querySelectorAll<HTMLElement>('input:not(:disabled):not([type="hidden"]),textarea:not(:disabled),select:not(:disabled),button:not(:disabled),a[href],[tabindex="0"]')]
        .find(element => !element.closest("[data-modal-controls]") && element.getClientRects().length > 0);
      first?.focus();
    }
    return () => { dialog?.close(); document.body.style.overflow = overflow; };
  }, []);
  return <dialog ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-busy={busy}
    onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}
    className="viewport-modal lhcc-modal m-auto w-[calc(100%-2rem)] max-w-3xl rounded-2xl border bg-white p-0 text-slate-700 shadow-2xl backdrop:bg-slate-950/55">
    <div data-modal-controls className="sticky top-0 z-10 flex items-center justify-end border-b bg-white px-3 py-1 sm:hidden">
      <span aria-hidden="true" className="absolute left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-slate-300" />
      <button type="button" aria-label="Close dialog" disabled={busy} onClick={onCancel} className="lhcc-press grid size-11 place-items-center rounded-xl hover:bg-slate-50 disabled:opacity-50"><X aria-hidden="true" className="size-5" /></button>
    </div>
    {children}
  </dialog>;
}
