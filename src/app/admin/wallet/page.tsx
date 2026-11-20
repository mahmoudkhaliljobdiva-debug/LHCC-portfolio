import { AdminWalletPage } from "@/features/wallet/admin-wallet-page";
import { getAdminWalletTransactions } from "@/lib/wallet/server";

export default async function WalletPage() {
  const transactions = await getAdminWalletTransactions();
  return <AdminWalletPage transactions={transactions} />;
}
