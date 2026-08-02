import type { PlatformUser, UserBankAccess, WalletTransaction } from "@/types/user-management";
import { getTodayDate } from "@/utils/user-activation";

// This frontend wallet is a demo only.
// Production financial records and authorization must be enforced by the backend.
export function createBankAccessSaleTransaction(access: UserBankAccess, user: PlatformUser, bankName: string, existing: readonly WalletTransaction[]): WalletTransaction | null {
  if (existing.some((transaction) => transaction.type === "bank_sale" && transaction.userBankAccessId === access.id)) return null;
  return { id: crypto.randomUUID(), type: "bank_sale", name: `${bankName} access`, description: `${bankName} access purchased by ${user.fullName}`, amount: access.price, transactionDate: getTodayDate(), userId: user.id, bankId: access.bankId, userBankAccessId: access.id, createdAt: new Date().toISOString() };
}
