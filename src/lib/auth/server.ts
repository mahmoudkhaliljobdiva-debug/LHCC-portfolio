import "server-only";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole, UserStatus } from "@/types/profile";

export interface AuthenticatedUser {
  readonly id: string;
}

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export const getAuthenticatedUser = cache(async (): Promise<AuthenticatedUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;

  if (error || !userId) return null;
  return { id: userId };
});

export const getAuthenticatedProfile = cache(async (): Promise<Profile | null> => {
  const user = await getAuthenticatedUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw new Error("Unable to load the authenticated profile.");
  return data;
});

export async function getEffectiveProfileStatus(
  profile: Profile,
  client?: ServerSupabaseClient,
): Promise<UserStatus> {
  if (profile.status === "INACTIVE" || profile.status === "EXPIRED") return profile.status;
  // React.cache is request-local. Explicit transaction clients remain uncached.
  if (!client) return getRequestProfileStatus(profile.status, profile.role, profile.expiration_date);
  return evaluateProfileStatus(profile.status, profile.role, profile.expiration_date, client);
}

const getRequestProfileStatus = cache(async (status: Profile["status"], role: Profile["role"], expiration: Profile["expiration_date"]) =>
  evaluateProfileStatus(status, role, expiration, await createClient()),
);

async function evaluateProfileStatus(
  status: Profile["status"], role: Profile["role"], expiration: Profile["expiration_date"], supabase: ServerSupabaseClient,
): Promise<UserStatus> {
  if (status === "INACTIVE") return "INACTIVE";
  if (status === "EXPIRED") return "EXPIRED";

  const { data, error } = await supabase.rpc("is_profile_access_active", {
    // PostgreSQL accepts NULL here; generated RPC argument types do not encode
    // nullable function parameters, so preserve the runtime value explicitly.
    profile_expiration_date: expiration as string,
    profile_role: role,
    profile_status: status,
  });

  if (error) throw new Error("Unable to evaluate account access.");
  return data ? "ACTIVE" : "EXPIRED";
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login?reason=auth-required");
  return user;
}

export async function requireActiveProfile(): Promise<Profile> {
  await requireAuthenticatedUser();
  const profile = await getAuthenticatedProfile();
  if (!profile) redirect("/unauthorized?reason=profile");

  const status = await getEffectiveProfileStatus(profile);
  if (status === "INACTIVE") redirect("/account/inactive" as Route);
  if (status === "EXPIRED") redirect("/account/expired" as Route);
  return profile;
}

export async function requireRole(role: UserRole): Promise<Profile> {
  const profile = await requireActiveProfile();
  if (profile.role !== role) redirect("/unauthorized");
  return profile;
}

export function portalForRole(role: UserRole): "/admin" | "/teacher" | "/student" {
  if (role === "ADMIN") return "/admin";
  if (role === "TEACHER") return "/teacher";
  return "/student";
}
