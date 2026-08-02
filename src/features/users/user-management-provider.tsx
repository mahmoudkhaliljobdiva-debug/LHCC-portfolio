"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { loadUserManagementData, persistUserManagementData, USER_MANAGEMENT_STORAGE_KEY } from "@/services/user-management.storage";
import { createBankAccessSaleTransaction } from "@/services/wallet-transactions";
import type { PlatformUser, PlatformUserInput, StudentBankUsage, StudentQuestionActivityInput, UserBankAccess, UserManagementData, WalletTicketInput, WalletTransaction } from "@/types/user-management";
import { addCalendarMonths, getTodayDate } from "@/utils/user-activation";

interface UserManagementContextValue {
  readonly users: readonly PlatformUser[];
  readonly usage: readonly StudentBankUsage[];
  readonly bankAccess: readonly UserBankAccess[];
  readonly walletTransactions: readonly WalletTransaction[];
  readonly isReady: boolean;
  readonly addUser: (input: PlatformUserInput) => PlatformUser;
  readonly updateUser: (id: string, input: PlatformUserInput) => void;
  readonly deleteUser: (id: string) => void;
  readonly activateUser: (id: string, months: number) => void;
  readonly deactivateUser: (id: string) => void;
  readonly reactivateUser: (id: string, months: number) => void;
  readonly getUserById: (id: string) => PlatformUser | undefined;
  readonly getStudentUsage: (studentId: string) => readonly StudentBankUsage[];
  readonly recordStudentQuestionActivity: (input: StudentQuestionActivityInput) => void;
  readonly getUserBankAccess: (userId: string) => readonly UserBankAccess[];
  readonly hasUserBankAccess: (userId: string, bankId: string) => boolean;
  readonly grantUserBankAccess: (userId: string, bankId: string, price: number, bankName: string) => void;
  readonly updateUserBankPrice: (accessId: string, newPrice: number, bankName: string) => void;
  readonly revokeUserBankAccess: (accessId: string) => void;
  readonly refundUserBankAccess: (accessId: string, bankName: string) => void;
  readonly addWalletTicket: (input: WalletTicketInput) => void;
  readonly updateWalletTicket: (id: string, input: WalletTicketInput) => void;
  readonly deleteWalletTicket: (id: string) => void;
}

const UserManagementContext = createContext<UserManagementContextValue | null>(null);

export function UserManagementProvider({ children }: { readonly children: React.ReactNode }) {
  const [data, setData] = useState<UserManagementData>({ users: [], usage: [], bankAccess: [], walletTransactions: [] });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => { setData(loadUserManagementData()); setIsReady(true); }, 0);
    function sync(event: StorageEvent) { if (event.key === null || event.key === USER_MANAGEMENT_STORAGE_KEY) setData(loadUserManagementData()); }
    window.addEventListener("storage", sync);
    return () => { window.clearTimeout(timer); window.removeEventListener("storage", sync); };
  }, []);

  const commit = useCallback((updater: (current: UserManagementData) => UserManagementData) => {
    setData((current) => { const next = updater(current); persistUserManagementData(next); return next; });
  }, []);

  const addUser = useCallback((input: PlatformUserInput) => {
    const now = new Date().toISOString();
    const months = input.role === "student" ? 1 : input.activationMonths;
    const user: PlatformUser = { ...input, id: crypto.randomUUID(), activationMonths: months, expirationDate: addCalendarMonths(input.activationStartDate, months), createdAt: now, updatedAt: now };
    commit((current) => ({ ...current, users: [...current.users, user] }));
    return user;
  }, [commit]);

  const updateUser = useCallback((id: string, input: PlatformUserInput) => {
    const months = input.role === "student" ? 1 : input.activationMonths;
    commit((current) => ({ ...current, users: current.users.map((user) => user.id === id ? { ...user, ...input, activationMonths: months, expirationDate: addCalendarMonths(input.activationStartDate, months), updatedAt: new Date().toISOString() } : user) }));
  }, [commit]);

  const deleteUser = useCallback((id: string) => { commit((current) => ({ ...current, users: current.users.filter((user) => user.id !== id), usage: current.usage.filter((item) => item.studentId !== id), bankAccess: current.bankAccess.filter((item) => item.userId !== id) })); }, [commit]);
  const deactivateUser = useCallback((id: string) => { commit((current) => ({ ...current, users: current.users.map((user) => user.id === id ? { ...user, status: "inactive", updatedAt: new Date().toISOString() } : user) })); }, [commit]);

  const reactivateUser = useCallback((id: string, months: number) => {
    const start = getTodayDate();
    commit((current) => ({ ...current, users: current.users.map((user) => user.id === id ? { ...user, status: "active", activationStartDate: start, activationMonths: user.role === "student" ? 1 : months, expirationDate: addCalendarMonths(start, user.role === "student" ? 1 : months), updatedAt: new Date().toISOString() } : user) }));
  }, [commit]);

  const recordStudentQuestionActivity = useCallback((input: StudentQuestionActivityInput) => {
    commit((current) => {
      const existing = current.usage.find((item) => item.studentId === input.studentId && item.bankId === input.bankId);
      const activity: StudentBankUsage = {
        studentId: input.studentId,
        bankId: input.bankId,
        questionsViewed: (existing?.questionsViewed ?? 0) + (input.viewed ?? 0),
        questionsAnswered: (existing?.questionsAnswered ?? 0) + (input.answered ?? 0),
        correctAnswers: (existing?.correctAnswers ?? 0) + (input.correct ?? 0),
        incorrectAnswers: (existing?.incorrectAnswers ?? 0) + (input.incorrect ?? 0),
        attemptsCount: (existing?.attemptsCount ?? 0) + (input.attempts ?? 0),
        lastActivityAt: input.occurredAt ?? new Date().toISOString(),
      };
      return { ...current, usage: existing ? current.usage.map((item) => item.studentId === input.studentId && item.bankId === input.bankId ? activity : item) : [...current.usage, activity] };
    });
  }, [commit]);

  const grantUserBankAccess = useCallback((userId: string, bankId: string, price: number, bankName: string) => {
    commit((current) => {
      if (current.bankAccess.some((item) => item.userId === userId && item.bankId === bankId && item.isActive)) return current;
      const user = current.users.find((item) => item.id === userId);
      if (!user || !Number.isFinite(price) || price <= 0) return current;
      const now = new Date().toISOString();
      const access: UserBankAccess = { id: crypto.randomUUID(), userId, bankId, price, isActive: true, grantedAt: now, revokedAt: null, createdAt: now, updatedAt: now };
      const sale = createBankAccessSaleTransaction(access, user, bankName, current.walletTransactions);
      return { ...current, bankAccess: [...current.bankAccess, access], walletTransactions: sale ? [...current.walletTransactions, sale] : current.walletTransactions };
    });
  }, [commit]);

  const updateUserBankPrice = useCallback((accessId: string, newPrice: number, bankName: string) => {
    commit((current) => {
      const access = current.bankAccess.find((item) => item.id === accessId);
      const user = access ? current.users.find((item) => item.id === access.userId) : undefined;
      if (!access || !user || !Number.isFinite(newPrice) || newPrice <= 0 || access.price === newPrice) return current;
      const difference = newPrice - access.price;
      const transaction: WalletTransaction = { id: crypto.randomUUID(), type: "bank_price_adjustment", name: `${bankName} price adjustment`, description: `${user.fullName} — ${bankName}: ${access.price.toFixed(2)} USD changed to ${newPrice.toFixed(2)} USD (${difference >= 0 ? "+" : ""}${difference.toFixed(2)} USD)`, amount: difference, transactionDate: getTodayDate(), userId: user.id, bankId: access.bankId, userBankAccessId: access.id, createdAt: new Date().toISOString() };
      return { ...current, bankAccess: current.bankAccess.map((item) => item.id === accessId ? { ...item, price: newPrice, updatedAt: new Date().toISOString() } : item), walletTransactions: [...current.walletTransactions, transaction] };
    });
  }, [commit]);

  const revokeUserBankAccess = useCallback((accessId: string) => { commit((current) => ({ ...current, bankAccess: current.bankAccess.map((item) => item.id === accessId ? { ...item, isActive: false, revokedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : item) })); }, [commit]);
  const refundUserBankAccess = useCallback((accessId: string, bankName: string) => {
    commit((current) => {
      const access = current.bankAccess.find((item) => item.id === accessId);
      const user = access ? current.users.find((item) => item.id === access.userId) : undefined;
      if (!access || !user || current.walletTransactions.some((item) => item.type === "refund" && item.userBankAccessId === accessId)) return current;
      const refund: WalletTransaction = { id: crypto.randomUUID(), type: "refund", name: `${bankName} access refund`, description: `${bankName} access refunded to ${user.fullName}`, amount: -Math.abs(access.price), transactionDate: getTodayDate(), userId: user.id, bankId: access.bankId, userBankAccessId: access.id, createdAt: new Date().toISOString() };
      return { ...current, bankAccess: current.bankAccess.map((item) => item.id === accessId ? { ...item, isActive: false, revokedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : item), walletTransactions: [...current.walletTransactions, refund] };
    });
  }, [commit]);

  const addWalletTicket = useCallback((input: WalletTicketInput) => { commit((current) => ({ ...current, walletTransactions: [...current.walletTransactions, { ...input, id: crypto.randomUUID(), amount: input.type === "manual_expense" ? -Math.abs(input.amount) : Math.abs(input.amount), createdAt: new Date().toISOString() }] })); }, [commit]);
  const updateWalletTicket = useCallback((id: string, input: WalletTicketInput) => { commit((current) => ({ ...current, walletTransactions: current.walletTransactions.map((item) => item.id === id && (item.type === "manual_income" || item.type === "manual_expense") ? { ...item, ...input, amount: input.type === "manual_expense" ? -Math.abs(input.amount) : Math.abs(input.amount) } : item) })); }, [commit]);
  const deleteWalletTicket = useCallback((id: string) => { commit((current) => ({ ...current, walletTransactions: current.walletTransactions.filter((item) => item.id !== id || (item.type !== "manual_income" && item.type !== "manual_expense")) })); }, [commit]);

  const value = useMemo<UserManagementContextValue>(() => ({
    users: data.users, usage: data.usage, bankAccess: data.bankAccess, walletTransactions: data.walletTransactions, isReady, addUser, updateUser, deleteUser,
    activateUser: reactivateUser, deactivateUser, reactivateUser,
    getUserById: (id) => data.users.find((user) => user.id === id),
    getStudentUsage: (studentId) => data.usage.filter((item) => item.studentId === studentId),
    recordStudentQuestionActivity,
    getUserBankAccess: (userId) => data.bankAccess.filter((item) => item.userId === userId),
    hasUserBankAccess: (userId, bankId) => data.bankAccess.some((item) => item.userId === userId && item.bankId === bankId && item.isActive),
    grantUserBankAccess, updateUserBankPrice, revokeUserBankAccess, refundUserBankAccess,
    addWalletTicket, updateWalletTicket, deleteWalletTicket,
  }), [addUser, addWalletTicket, data, deactivateUser, deleteUser, deleteWalletTicket, grantUserBankAccess, isReady, reactivateUser, recordStudentQuestionActivity, refundUserBankAccess, revokeUserBankAccess, updateUser, updateUserBankPrice, updateWalletTicket]);

  return <UserManagementContext.Provider value={value}>{children}</UserManagementContext.Provider>;
}

export function useUserManagement(): UserManagementContextValue {
  const context = useContext(UserManagementContext);
  if (!context) throw new Error("useUserManagement must be used within UserManagementProvider");
  return context;
}
