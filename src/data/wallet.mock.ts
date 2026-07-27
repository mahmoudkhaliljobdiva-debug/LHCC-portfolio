import type {
  WalletSummary,
  WalletTransaction,
  WalletTrendPoint,
} from "@/types/wallet";

export const WALLET_SUMMARY = {
  balance: 2450,
  rewards: 780,
  losses: 190,
} as const satisfies WalletSummary;

export const WALLET_TRANSACTIONS = [
  {
    id: "txn-001",
    type: "reward",
    description: "Clinical medicine exam completion",
    credits: 120,
    occurredAt: "2026-07-24T10:30:00.000Z",
  },
  {
    id: "txn-002",
    type: "loss",
    description: "Incorrect challenge answer",
    credits: -25,
    occurredAt: "2026-07-22T14:15:00.000Z",
  },
  {
    id: "txn-003",
    type: "reward",
    description: "Seven-day study streak",
    credits: 80,
    occurredAt: "2026-07-20T08:00:00.000Z",
  },
] as const satisfies readonly WalletTransaction[];

export const WALLET_TREND = [
  { period: "Feb", balance: 1280 },
  { period: "Mar", balance: 1490 },
  { period: "Apr", balance: 1725 },
  { period: "May", balance: 1890 },
  { period: "Jun", balance: 2160 },
  { period: "Jul", balance: 2450 },
] as const satisfies readonly WalletTrendPoint[];

