import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type PendingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly pending: boolean;
  readonly pendingLabel?: string;
};

/** Feedback starts with the real request, never with a fake timer or success. */
export function PendingButton({ pending, pendingLabel = "Saving…", children, className, disabled, type = "submit", ...props }: PendingButtonProps) {
  return <button {...props} type={type} disabled={pending || disabled} aria-busy={pending}
    className={cn("lhcc-press inline-flex min-h-11 items-center justify-center gap-2", className)}>
    {pending ? <><span aria-hidden="true" className="lhcc-spinner size-4 shrink-0 rounded-full border-2 border-current border-r-transparent" /><span role="status">{pendingLabel}</span></> : children}
  </button>;
}
