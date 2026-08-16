import { AccountAccessMessage } from "@/features/users/account-access-message";

export default function InactiveAccountPage() {
  return <AccountAccessMessage eyebrow="Account unavailable" title="Your account is inactive." message="Please contact the administrator to restore access to your learning workspace." />;
}
