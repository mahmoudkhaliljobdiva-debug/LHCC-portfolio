import "server-only";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { authorizeActiveAdmin } from "@/lib/auth/admin";
import { getEffectiveProfileStatus } from "@/lib/auth/server";
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

export async function getPreviewDirectory(role: PreviewRole, search: string, status: string, requestedPage: number) {
  await requirePreviewAdmin();
  const db = createAdminClient();
  const term = search.trim().slice(0, 100).replace(/[^\p{L}\p{N}@ ._+-]/gu, "");
  // Auth's directory API has no email filter. Scan bounded pages server-side
  // only when searching; never send the complete Auth directory to the browser.
  const emailIds: string[] = [];
  if (term) {
    for (let authPage = 1; ; authPage++) {
      const result = await db.auth.admin.listUsers({ page: authPage, perPage: 500 });
      if (result.error) throw new Error("Unable to search accounts.");
      emailIds.push(...result.data.users.filter(user => user.email?.toLowerCase().includes(term.toLowerCase())).map(user => user.id));
      if (result.data.users.length < 500) break;
    }
  }
  let query = db.from("profiles").select("*", { count: "exact" }).eq("role", role === "student" ? "STUDENT" : "TEACHER");
  if (term) query = query.or(`full_name.ilike.%${term}%,id.in.(${emailIds.length ? emailIds.join(",") : "00000000-0000-0000-0000-000000000000"})`);
  if (["ACTIVE", "INACTIVE", "EXPIRED"].includes(status)) query = query.eq("status", status as "ACTIVE" | "INACTIVE" | "EXPIRED");
  const page = Math.min(100000, Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1));
  const result = await query.order("full_name").order("id").range((page - 1) * 20, page * 20 - 1);
  if (result.error) throw new Error("Unable to load preview directory.");
  const users = await Promise.all(result.data.map(async profile => {
    const auth = await db.auth.admin.getUserById(profile.id);
    if (auth.error) throw new Error("Unable to load account details.");
    return { id: profile.id, name: profile.full_name, email: auth.data.user.email ?? "", status: await getEffectiveProfileStatus(profile) };
  }));
  return { users, page, total: result.count ?? 0 };
}
