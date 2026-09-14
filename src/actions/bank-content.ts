"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeActiveAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import type { ServerResult } from "@/types/server-result";

const bankSchema = z.object({ name: z.string().trim().min(1).max(200), description: z.string().trim().min(1).max(5000), status: z.enum(["active", "inactive"]), displayOrder: z.number().int().min(0).optional(), imageUrl: z.url().max(2000).optional().or(z.literal("")), price: z.number().finite().min(0).max(9999999999.99) });
const questionSchema = z.object({ bankId: z.string().min(1).max(200), text: z.string().trim().min(1).max(10000), status: z.enum(["active", "inactive"]), answers: z.array(z.object({ id: z.string().min(1).max(200), text: z.string().trim().min(1).max(5000), isCorrect: z.boolean() })).min(2).max(10) }).refine((value) => value.answers.filter((answer) => answer.isCorrect).length === 1 && new Set(value.answers.map((answer) => answer.id)).size === value.answers.length);

export async function manageBankContent(operation: "save_bank" | "delete_bank" | "save_question" | "delete_question", id: string, input: unknown = {}): Promise<ServerResult<null>> {
  const auth = await authorizeActiveAdmin();
  if (!auth.ok) return auth;
  if (!z.string().min(1).max(200).safeParse(id).success) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid content ID." } };
  const schema = operation === "save_bank" ? bankSchema : operation === "save_question" ? questionSchema : z.object({});
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Check the content fields and provide exactly one correct answer per question." } };
  try {
    const db = await createClient();
    const { error } = await db.rpc("manage_bank_content", { operation, item_id: id, payload: parsed.data as Json });
    if (error) return { ok: false, error: { code: "CONFLICT", message: error.code === "23503" ? "This bank has access history. Make it inactive instead of deleting it." : "Unable to save content. Please try again." } };
    revalidatePath("/admin", "layout");
    revalidatePath("/student", "layout");
    return { ok: true, data: null };
  } catch { return { ok: false, error: { code: "INTERNAL_ERROR", message: "Unable to save content. Please try again." } }; }
}
