export type LiveKind = "access" | "profile" | "catalog" | "questions" | "exams" | "attempt" | "users" | "wallet" | "portfolio";
export interface LiveHint { kind: LiveKind; bankId?: string; attemptId?: string }
export function liveRoute(path: string) {
  const bank = path.match(/\/(?:banks|question-banks)\/([^/]+)/)?.[1];
  const attempt = path.match(/^\/student\/exams\/([0-9a-f-]{36})(?:\/|$)/)?.[1];
  return { bankId: bank ?? null, attemptId: attempt ?? null,
    protected: /^\/(student|teacher|admin)(?:\/|$)|^\/account\/settings/.test(path),
    publicCatalog: ["/", "/about", "/services", "/platform", "/contact"].includes(path) || path.startsWith("/programs/") };
}
export function affectsRoute(hint: LiveHint, path: string): boolean {
  const route = liveRoute(path);
  if (hint.kind === "profile" || hint.kind === "access") return true;
  if (hint.kind === "attempt") return (Boolean(route.attemptId) && (!hint.attemptId || route.attemptId === hint.attemptId))
    || (Boolean(route.bankId) && (!hint.bankId || route.bankId === hint.bankId))
    || /^\/(student|teacher|admin)(\/analytics|\/exams)?$/.test(path) || /\/activity$/.test(path);
  if (hint.kind === "wallet") return path === "/admin" || path.startsWith("/admin/wallet");
  if (hint.kind === "users") return path === "/admin" || path.startsWith("/admin/users");
  if (hint.kind === "portfolio") return route.publicCatalog || path.startsWith("/admin/portfolio");
  // Never replace a frozen in-progress exam because its source bank was edited.
  if (route.attemptId) return false;
  return (!hint.bankId || !route.bankId || hint.bankId === route.bankId)
    && (route.protected || route.publicCatalog);
}
export function parseLiveHint(value: unknown): LiveHint | null {
  if (!value || typeof value !== "object" || !("kind" in value)) return null;
  const v = value as Record<string, unknown>;
  if (!["access","profile","catalog","questions","exams","attempt","users","wallet","portfolio"].includes(String(v.kind))) return null;
  return { kind: v.kind as LiveKind, ...(typeof v.bankId === "string" ? { bankId: v.bankId } : {}),
    ...(typeof v.attemptId === "string" ? { attemptId: v.attemptId } : {}) };
}
