import "server-only";

import { getEffectiveProfileStatus } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/profile";
import type { ServerResult } from "@/types/server-result";

export async function authorizeActiveAdmin(): Promise<ServerResult<Profile>> {
  try {
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims.sub;

    if (claimsError || !userId) {
      return failure("UNAUTHENTICATED", "Sign in as an administrator to continue.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      return failure("PROFILE_MISSING", "The administrator profile is unavailable.");
    }

    if (profile.role !== "ADMIN") {
      return failure("FORBIDDEN", "Administrator access is required.");
    }

    const effectiveStatus = await getEffectiveProfileStatus(profile, supabase);
    if (effectiveStatus !== "ACTIVE") {
      return failure(
        effectiveStatus === "INACTIVE" ? "ACCOUNT_INACTIVE" : "ACCOUNT_EXPIRED",
        "This administrator account is not active.",
      );
    }

    return { ok: true, data: profile };
  } catch {
    return failure("INTERNAL_ERROR", "Unable to verify administrator access.");
  }
}

function failure(
  code: "UNAUTHENTICATED" | "PROFILE_MISSING" | "FORBIDDEN" | "ACCOUNT_INACTIVE" | "ACCOUNT_EXPIRED" | "INTERNAL_ERROR",
  message: string,
): ServerResult<never> {
  return { ok: false, error: { code, message } };
}
