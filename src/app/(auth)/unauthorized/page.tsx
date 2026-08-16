import { AccountAccessMessage } from "@/features/users/account-access-message";

export default async function UnauthorizedPage({ searchParams }: { readonly searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return <AccountAccessMessage eyebrow="Access denied" title="You cannot access this workspace." message={reason === "profile" ? "Your account profile is not ready. Please contact the administrator." : "Your account does not have permission to open the requested portal."} />;
}
