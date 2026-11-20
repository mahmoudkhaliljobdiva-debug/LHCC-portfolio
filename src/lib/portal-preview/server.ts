import "server-only";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { authorizeActiveAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PortalPreviewContext, PreviewRole } from "@/types/portal-preview";

export async function requirePreviewAdmin() {
  const result = await authorizeActiveAdmin();
  if (!result.ok) {
    if (result.error.code === "INTERNAL_ERROR") throw new Error("Unable to verify preview access.");
    redirect(result.error.code === "UNAUTHENTICATED" ? "/login" : "/unauthorized");
  }
  return result.data;
}

export function parsePreviewRole(value: string): PreviewRole {
  if (value !== "student" && value !== "teacher") notFound();
  return value;
}

export async function getPortalPreviewContext(role: PreviewRole, id: string): Promise<PortalPreviewContext> {
  const actor = await requirePreviewAdmin();
  if (!z.uuid().safeParse(id).success) notFound();
  const db = createAdminClient();
  const { data: subject, error } = await db.from("profiles").select("*").eq("id", id).eq("role", role === "student" ? "STUDENT" : "TEACHER").maybeSingle();
  if (error) throw new Error("Unable to load preview subject.");
  if (!subject) notFound();
  const auth = await db.auth.admin.getUserById(subject.id);
  if (auth.error) {
    if (auth.error.status === 404) notFound();
    throw new Error("Unable to load preview account.");
  }
  // Structured server-only logging: no email, password, tokens, or answer keys.
  console.info(JSON.stringify({ action: "VIEW_AS", actor_user_id: actor.id, target_user_id: subject.id, target_role: subject.role, read_only: true }));
  return { actor, subject, email: auth.data.user.email ?? "", role };
}
