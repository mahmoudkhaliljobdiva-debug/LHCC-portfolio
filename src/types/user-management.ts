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
  readonly questionsViewed: number;
  readonly questionsAnswered: number;
  readonly correctAnswers: number;
  readonly incorrectAnswers: number;
  readonly attemptsCount: number;
  readonly lastActivityAt: string | null;
}

export interface UserManagementData {
  readonly users: readonly PlatformUser[];
  readonly usage: readonly StudentBankUsage[];
  readonly bankAccess: readonly UserBankAccess[];
  readonly walletTransactions: readonly WalletTransaction[];
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

export interface StudentQuestionActivityInput {
  readonly studentId: string;
  readonly bankId: string;
  readonly viewed?: number;
  readonly answered?: number;
  readonly correct?: number;
  readonly incorrect?: number;
  readonly attempts?: number;
  readonly occurredAt?: string;
}

export interface UserBankAccess {
  readonly id: string;
  readonly userId: string;
  readonly bankId: string;
  readonly price: number;
  readonly isActive: boolean;
  readonly grantedAt: string;
  readonly revokedAt?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
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
  readonly bankId?: string;
  readonly userBankAccessId?: string;
  readonly category?: string;
  readonly createdAt: string;
}

export interface WalletTicketInput {
  readonly name: string;
  readonly description?: string;
  readonly type: "manual_income" | "manual_expense";
  readonly amount: number;
  readonly transactionDate: string;
  readonly category?: string;
}
