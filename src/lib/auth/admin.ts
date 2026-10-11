import "server-only";

import { getAuthenticatedUser, getAuthenticatedProfile, getEffectiveProfileStatus } from "@/lib/auth/server";
import type { Profile } from "@/types/profile";
import type { ServerResult } from "@/types/server-result";

export async function authorizeActiveAdmin(): Promise<ServerResult<Profile>> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return failure("UNAUTHENTICATED", "Sign in as an administrator to continue.");
    }

    const profile = await getAuthenticatedProfile();
    if (!profile) {
      return failure("PROFILE_MISSING", "The administrator profile is unavailable.");
    }

    if (profile.role !== "ADMIN") {
      return failure("FORBIDDEN", "Administrator access is required.");
    }

    const effectiveStatus = await getEffectiveProfileStatus(profile);
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
