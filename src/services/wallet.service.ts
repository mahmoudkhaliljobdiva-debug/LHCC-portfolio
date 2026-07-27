import {
  WALLET_SUMMARY,
  WALLET_TRANSACTIONS,
  WALLET_TREND,
} from "@/data/wallet.mock";

export function getWalletSnapshot() {
  return {
    summary: WALLET_SUMMARY,
    transactions: WALLET_TRANSACTIONS,
    trend: WALLET_TREND,
  };
}

