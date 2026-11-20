"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authorizeActiveAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import type { ServerResult } from "@/types/server-result";
import type { WalletTicketInput } from "@/types/user-management";

const ticketSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  type: z.enum(["manual_income", "manual_expense"]),
  amount: z.number().finite().positive().max(9999999999.99),
  transactionDate: z.iso.date(),
  category: z.string().trim().max(100).optional(),
});
const idSchema = z.uuid();

export async function createWalletTicket(id: string, input: WalletTicketInput): Promise<ServerResult<null>> {
  return mutate("create", id, input);
}

export async function updateWalletTicket(id: string, input: WalletTicketInput): Promise<ServerResult<null>> {
  return mutate("update", id, input);
}

export async function deleteWalletTicket(id: string): Promise<ServerResult<null>> {
  return mutate("delete", id, {});
}

async function mutate(operation: "create" | "update" | "delete", id: string, input: unknown): Promise<ServerResult<null>> {
  const authorization = await authorizeActiveAdmin();
  if (!authorization.ok) return authorization;
  if (!idSchema.safeParse(id).success) return failure("Invalid wallet transaction.");
  const parsed = operation === "delete" ? { success: true, data: {} } as const : ticketSchema.safeParse(input);
  if (!parsed.success) return failure("Check the transaction fields and try again.");
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("manage_wallet_transaction", { operation, item_id: id, payload: parsed.data as Json });
    if (error) return failure("Unable to save the wallet transaction.");
    revalidatePath("/admin/wallet");
    revalidatePath("/admin");
    return { ok: true, data: null };
  } catch {
    return failure("Unable to save the wallet transaction.");
  }
}

function failure(message: string): ServerResult<never> {
  return { ok: false, error: { code: "VALIDATION_ERROR", message } };
}
