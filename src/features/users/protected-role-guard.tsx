"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { clearDemoSession, getDemoSession } from "@/services/demo-session";
import type { ManagedUserRole } from "@/types/user-management";
import { getEffectiveUserStatus } from "@/utils/user-activation";
import { useUserManagement } from "@/features/users/user-management-provider";

// Frontend route protection is for demo purposes only.
// Production authorization must be enforced by the backend.
export function ProtectedRoleGuard({ role, children }: { readonly role: ManagedUserRole; readonly children: React.ReactNode }) {
  const router = useRouter();
  const { isReady, getUserById } = useUserManagement();
  const session = isReady ? getDemoSession() : null;
  const user = session ? getUserById(session.userId) : undefined;
  const status = user ? getEffectiveUserStatus(user) : null;
  const allowed = Boolean(user && session?.role === role && user.role === role && (status === "active" || status === "expiring-soon"));

  useEffect(() => {
    if (!isReady || allowed) return;
    const reason = status === "inactive" ? "inactive" : status === "expired" ? "expired" : session && session.role !== role ? "role" : "session";
    clearDemoSession();
    router.replace(`/login?reason=${reason}`);
  }, [allowed, isReady, role, router, session, status]);

  if (!isReady || !allowed) return <main className="grid min-h-screen place-items-center bg-slate-50"><div className="text-center"><div className="mx-auto size-9 animate-spin rounded-full border-2 border-slate-200 border-t-teal-700" /><p className="mt-4 text-sm text-slate-500">Checking account access…</p></div></main>;
  return children;
}
