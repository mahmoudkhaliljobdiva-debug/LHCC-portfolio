import "server-only";

import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { WalletTransaction } from "@/types/user-management";

export async function getAdminWalletTransactions(): Promise<readonly WalletTransaction[]> {
  await requireRole("ADMIN");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_wallet_data");
  if (error || !Array.isArray(data)) throw new Error("Unable to load wallet transactions.");
  return data as unknown as WalletTransaction[];
}
