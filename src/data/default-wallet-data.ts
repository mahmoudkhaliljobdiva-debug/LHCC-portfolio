import type { UserBankAccess, WalletTransaction } from "@/types/user-management";

export const DEFAULT_USER_BANK_ACCESS = [
  { id: "access-maya-anatomy", userId: "student-maya", bankId: "anatomy", price: 5, isActive: true, grantedAt: "2026-07-02T09:00:00.000Z", revokedAt: null, createdAt: "2026-07-02T09:00:00.000Z", updatedAt: "2026-07-02T09:00:00.000Z" },
  { id: "access-maya-physiology", userId: "student-maya", bankId: "physiology", price: 7, isActive: true, grantedAt: "2026-07-05T09:00:00.000Z", revokedAt: null, createdAt: "2026-07-05T09:00:00.000Z", updatedAt: "2026-07-05T09:00:00.000Z" },
  { id: "access-sarah-anatomy", userId: "student-sarah", bankId: "anatomy", price: 5, isActive: true, grantedAt: "2026-07-08T09:00:00.000Z", revokedAt: null, createdAt: "2026-07-08T09:00:00.000Z", updatedAt: "2026-07-08T09:00:00.000Z" },
] as const satisfies readonly UserBankAccess[];

export const DEFAULT_WALLET_TRANSACTIONS = [
  { id: "wallet-sale-maya-anatomy", type: "bank_sale", name: "Human Anatomy access", description: "Human Anatomy access purchased by Maya Carter", amount: 5, transactionDate: "2026-07-02", userId: "student-maya", bankId: "anatomy", userBankAccessId: "access-maya-anatomy", createdAt: "2026-07-02T09:00:00.000Z" },
  { id: "wallet-sale-maya-physiology", type: "bank_sale", name: "Medical Physiology access", description: "Medical Physiology access purchased by Maya Carter", amount: 7, transactionDate: "2026-07-05", userId: "student-maya", bankId: "physiology", userBankAccessId: "access-maya-physiology", createdAt: "2026-07-05T09:00:00.000Z" },
  { id: "wallet-sale-sarah-anatomy", type: "bank_sale", name: "Human Anatomy access", description: "Human Anatomy access purchased by Sarah Ahmad", amount: 5, transactionDate: "2026-07-08", userId: "student-sarah", bankId: "anatomy", userBankAccessId: "access-sarah-anatomy", createdAt: "2026-07-08T09:00:00.000Z" },
  { id: "wallet-training-income", type: "manual_income", name: "Training registration", description: "Registration income from the summer training session.", amount: 50, transactionDate: "2026-07-12", category: "Training", createdAt: "2026-07-12T12:00:00.000Z" },
  { id: "wallet-advertising-expense", type: "manual_expense", name: "Advertising campaign", description: "Digital campaign for the new learning term.", amount: -20, transactionDate: "2026-07-18", category: "Marketing", createdAt: "2026-07-18T12:00:00.000Z" },
] as const satisfies readonly WalletTransaction[];
