import { AccountAccessMessage } from "@/features/users/account-access-message";

export default function ExpiredAccountPage() {
  return <AccountAccessMessage eyebrow="Subscription expired" title="Your subscription has expired." message="Please contact the administrator to reactivate your account." />;
}
