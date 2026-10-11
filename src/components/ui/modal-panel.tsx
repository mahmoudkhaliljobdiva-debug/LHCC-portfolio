"use client";
import { useEffect, useRef } from "react";

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
    return () => { dialog?.close(); document.body.style.overflow = overflow; };
  }, []);
  return <dialog ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelledBy}
    onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}
    className="viewport-modal m-auto w-[calc(100%-2rem)] max-w-3xl rounded-2xl border bg-white p-0 text-slate-700 shadow-2xl backdrop:bg-slate-950/55">
    {children}
  </dialog>;
}
