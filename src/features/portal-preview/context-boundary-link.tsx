import type { MouseEventHandler, ReactNode } from "react";

/** Leaving a subject context starts a fresh server render rather than reusing
 * Next's cached nested portal tree. Auth cookies are retained by the browser. */
export function ContextBoundaryLink({ href, className, children, onClick, ...props }: {
  readonly href: string;
  readonly className: string;
  readonly children: ReactNode;
  readonly onClick?: MouseEventHandler<HTMLAnchorElement>;
  readonly "aria-label"?: string;
}) {
  return <a href={href} className={className} onClick={onClick} {...props}>{children}</a>;
}
