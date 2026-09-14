import type { ProfileGender } from "@/types/account";

export type ManagedUserRole = "student" | "teacher";
export type UserAccountStatus = "active" | "inactive" | "expired";
export type EffectiveUserStatus = UserAccountStatus | "expiring-soon";

export interface PlatformUser {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly phone?: string | null;
  readonly age: number | null;
  readonly gender: ProfileGender | null;
  readonly homeAddress: string | null;
  readonly role: ManagedUserRole;
  readonly status: UserAccountStatus;
  readonly activationStartDate: string | null;
  readonly activationMonths: number | null;
  readonly expirationDate: string | null;
  readonly createdBy?: string | null;
  readonly deactivatedAt?: string | null;
  readonly reactivatedAt?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StudentBankUsage {
  readonly studentId: string;
  readonly bankId: string;
  readonly questionsAnswered: number;
  readonly correctAnswers: number;
  readonly incorrectAnswers: number;
  readonly attemptsCount: number;
  readonly lastActivityAt: string | null;
}

export interface PlatformUserInput {
  readonly fullName: string;
  readonly email: string;
  readonly phone?: string;
  readonly age: number | null;
  readonly gender: ProfileGender | null;
  readonly homeAddress: string;
  readonly role: ManagedUserRole;
  readonly status: Exclude<UserAccountStatus, "expired">;
  readonly activationStartDate: string;
  readonly activationMonths: number;
}

export type WalletTransactionType = "bank_sale" | "bank_price_adjustment" | "refund" | "manual_income" | "manual_expense";

export interface WalletTransaction {
  readonly id: string;
  readonly type: WalletTransactionType;
  readonly name: string;
  readonly description?: string;
  readonly amount: number;
  readonly transactionDate: string;
  readonly userId?: string;
  readonly userName?: string | null;
  readonly bankId?: string;
  readonly bankName?: string | null;
  readonly userBankAccessId?: string;
  readonly category?: string;
  readonly createdAt: string;
}

export interface UserUsageSummary {
  readonly studentId: string;
  readonly questionsAnswered: number;
  readonly attemptsCount: number;
  readonly accuracy: number;
  readonly lastActivityAt: string | null;
}

export interface WalletTicketInput {
  readonly name: string;
  readonly description?: string;
  readonly type: "manual_income" | "manual_expense";
  readonly amount: number;
  readonly transactionDate: string;
  readonly category?: string;
}
