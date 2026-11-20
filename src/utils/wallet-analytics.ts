import type { WalletTransaction } from "@/types/user-management";

export interface WalletSummary { readonly totalEarned: number; readonly totalSpent: number; readonly currentBalance: number; readonly bankSales: number; readonly otherIncome: number; readonly totalExpenses: number; }
export interface WalletChartPoint { readonly period: string; readonly earned: number; readonly spent: number; }

export function getWalletSummary(transactions: readonly WalletTransaction[]): WalletSummary {
  const totalEarned = transactions.reduce((sum, item) => sum + Math.max(0, item.amount), 0);
  const totalSpent = Math.abs(transactions.reduce((sum, item) => sum + Math.min(0, item.amount), 0));
  return {
    totalEarned,
    totalSpent,
    currentBalance: totalEarned - totalSpent,
    bankSales: transactions.filter((item) => item.type === "bank_sale").reduce((sum, item) => sum + item.amount, 0),
    otherIncome: transactions.filter((item) => item.type === "manual_income").reduce((sum, item) => sum + item.amount, 0),
    totalExpenses: Math.abs(transactions.filter((item) => item.type === "manual_expense").reduce((sum, item) => sum + item.amount, 0)),
  };
}

export function getWalletChartData(transactions: readonly WalletTransaction[]): readonly WalletChartPoint[] {
  const groups = new Map<string, { earned: number; spent: number }>();
  transactions.forEach((item) => {
    const period = item.transactionDate.slice(0, 7);
    const group = groups.get(period) ?? { earned: 0, spent: 0 };
    if (item.amount >= 0) group.earned += item.amount; else group.spent += Math.abs(item.amount);
    groups.set(period, group);
  });
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, values]) => ({ period, ...values }));
}

export function getRecentTransactions(transactions: readonly WalletTransaction[], limit = 8): readonly WalletTransaction[] {
  return [...transactions].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate) || b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}
