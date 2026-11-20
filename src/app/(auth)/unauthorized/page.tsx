import { AccountAccessMessage } from "@/features/users/account-access-message";
import { getAuthenticatedProfile, getEffectiveProfileStatus, portalForRole } from "@/lib/auth/server";

export default async function UnauthorizedPage({ searchParams }: { readonly searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const profile = await getAuthenticatedProfile();
  const active = profile && await getEffectiveProfileStatus(profile) === "ACTIVE";
  return <AccountAccessMessage eyebrow="Access denied" title="You cannot access this workspace." message={reason === "profile" ? "Your account profile is not ready. Please contact the administrator." : "Your account does not have permission to open the requested portal."} dashboardHref={active ? portalForRole(profile.role) : undefined} allowSignOut={Boolean(profile)} showSignIn={!profile} />;
}
