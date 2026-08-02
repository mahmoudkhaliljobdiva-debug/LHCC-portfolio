import type { ManagedUserRole } from "@/types/user-management";

const SESSION_KEY = "lhcc-demo-session";
export interface DemoSession { readonly userId: string; readonly role: ManagedUserRole; }

export function getDemoSession(): DemoSession | null {
  if (typeof window === "undefined") return null;
  try { const value: unknown = JSON.parse(window.localStorage.getItem(SESSION_KEY) ?? "null"); return value && typeof value === "object" && typeof (value as Record<string, unknown>).userId === "string" && ((value as Record<string, unknown>).role === "student" || (value as Record<string, unknown>).role === "teacher") ? value as DemoSession : null; } catch { return null; }
}
export function saveDemoSession(session: DemoSession): void { window.localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
export function clearDemoSession(): void { window.localStorage.removeItem(SESSION_KEY); }
