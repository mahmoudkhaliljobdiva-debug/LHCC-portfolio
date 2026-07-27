export type WalletTransactionType = "reward" | "loss";

export interface WalletTransaction {
  readonly id: string;
  readonly type: WalletTransactionType;
  readonly description: string;
  readonly credits: number;
  readonly occurredAt: string;
}

export interface WalletSummary {
  readonly balance: number;
  readonly rewards: number;
  readonly losses: number;
}

export interface WalletTrendPoint {
  readonly period: string;
  readonly balance: number;
}

