import { DEFAULT_STUDENT_BANK_USAGE } from "@/data/default-student-usage";
import { createDefaultUsers } from "@/data/default-users";
import { DEFAULT_USER_BANK_ACCESS, DEFAULT_WALLET_TRANSACTIONS } from "@/data/default-wallet-data";
import { MAX_HOME_ADDRESS_LENGTH, MAX_PROFILE_AGE, MIN_PROFILE_AGE } from "@/constants/profile";
import type { PlatformUser, StudentBankUsage, UserBankAccess, UserManagementData, WalletTransaction } from "@/types/user-management";
import { getEffectiveUserStatus } from "@/utils/user-activation";

export const USER_MANAGEMENT_STORAGE_KEY = "lhcc-user-management";

function isText(value: unknown): value is string { return typeof value === "string"; }
function isUser(value: unknown): value is PlatformUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Record<string, unknown>;
  return isText(user.id) && isText(user.fullName) && isText(user.email) && (user.role === "student" || user.role === "teacher") &&
    (user.status === "active" || user.status === "inactive" || user.status === "expired") && isText(user.activationStartDate) &&
    typeof user.activationMonths === "number" && isText(user.expirationDate) && isText(user.createdAt) && isText(user.updatedAt);
}
function isUsage(value: unknown): value is StudentBankUsage {
  if (!value || typeof value !== "object") return false;
  const usage = value as Record<string, unknown>;
  return isText(usage.studentId) && isText(usage.bankId) && ["questionsViewed", "questionsAnswered", "correctAnswers", "incorrectAnswers", "attemptsCount"].every((key) => typeof usage[key] === "number") && (usage.lastActivityAt === null || isText(usage.lastActivityAt));
}
function isBankAccess(value: unknown): value is UserBankAccess { if (!value || typeof value !== "object") return false; const item = value as Record<string, unknown>; return isText(item.id) && isText(item.userId) && isText(item.bankId) && typeof item.price === "number" && Number.isFinite(item.price) && typeof item.isActive === "boolean" && isText(item.grantedAt) && (item.revokedAt === undefined || item.revokedAt === null || isText(item.revokedAt)) && isText(item.createdAt) && isText(item.updatedAt); }
function isWalletTransaction(value: unknown): value is WalletTransaction { if (!value || typeof value !== "object") return false; const item = value as Record<string, unknown>; return isText(item.id) && ["bank_sale", "bank_price_adjustment", "refund", "manual_income", "manual_expense"].includes(String(item.type)) && isText(item.name) && typeof item.amount === "number" && Number.isFinite(item.amount) && item.amount !== 0 && isText(item.transactionDate) && isText(item.createdAt); }

function normalizeExpiredUsers(data: UserManagementData): UserManagementData {
  const users = data.users.map((user) => {
    const normalized = {
      ...user,
      age: Number.isInteger(user.age) && user.age !== null && user.age >= MIN_PROFILE_AGE && user.age <= MAX_PROFILE_AGE ? user.age : null,
      gender: user.gender === "male" || user.gender === "female" ? user.gender : null,
      homeAddress: typeof user.homeAddress === "string" && user.homeAddress.trim().length <= MAX_HOME_ADDRESS_LENGTH ? user.homeAddress : null,
    };
    return getEffectiveUserStatus(normalized) === "expired" && normalized.status !== "expired"
      ? { ...normalized, status: "expired" as const, updatedAt: new Date().toISOString() }
      : normalized;
  });
  return { ...data, users };
}

export function loadUserManagementData(): UserManagementData {
  if (typeof window === "undefined") return { users: createDefaultUsers(), usage: DEFAULT_STUDENT_BANK_USAGE, bankAccess: DEFAULT_USER_BANK_ACCESS, walletTransactions: DEFAULT_WALLET_TRANSACTIONS };
  try {
    const saved = window.localStorage.getItem(USER_MANAGEMENT_STORAGE_KEY);
    const parsed: unknown = saved ? JSON.parse(saved) : null;
    const record = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
    const raw = record && Array.isArray(record.users) && record.users.every(isUser) && Array.isArray(record.usage) && record.usage.every(isUsage)
      ? { users: record.users, usage: record.usage, bankAccess: Array.isArray(record.bankAccess) && record.bankAccess.every(isBankAccess) ? record.bankAccess : DEFAULT_USER_BANK_ACCESS, walletTransactions: Array.isArray(record.walletTransactions) && record.walletTransactions.every(isWalletTransaction) ? record.walletTransactions : DEFAULT_WALLET_TRANSACTIONS }
      : { users: createDefaultUsers(), usage: DEFAULT_STUDENT_BANK_USAGE, bankAccess: DEFAULT_USER_BANK_ACCESS, walletTransactions: DEFAULT_WALLET_TRANSACTIONS };
    const normalized = normalizeExpiredUsers(raw);
    window.localStorage.setItem(USER_MANAGEMENT_STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return { users: createDefaultUsers(), usage: DEFAULT_STUDENT_BANK_USAGE, bankAccess: DEFAULT_USER_BANK_ACCESS, walletTransactions: DEFAULT_WALLET_TRANSACTIONS };
  }
}

export function persistUserManagementData(data: UserManagementData): void { window.localStorage.setItem(USER_MANAGEMENT_STORAGE_KEY, JSON.stringify(data)); }
