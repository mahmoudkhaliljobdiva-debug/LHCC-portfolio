"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeActiveAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import type { ServerResult } from "@/types/server-result";
import { questionContentSchema, questionSectionSchema } from "@/lib/validation/question-content";

const bankSchema = z.object({ name: z.string().trim().min(1).max(200), description: z.string().trim().min(1).max(5000), status: z.enum(["active", "inactive"]), displayOrder: z.number().int().min(0).optional(), imageUrl: z.url().max(2000).optional().or(z.literal("")), price: z.number().finite().min(0).max(9999999999.99) });

export async function manageBankContent(operation: "save_bank" | "delete_bank" | "save_section" | "delete_section" | "save_question" | "delete_question", id: string, input: unknown = {}): Promise<ServerResult<null>> {
  const auth = await authorizeActiveAdmin();
  if (!auth.ok) return auth;
  if (!z.string().min(1).max(200).safeParse(id).success) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid content ID." } };
  const schema = operation === "save_bank" ? bankSchema : operation === "save_section" ? questionSectionSchema : operation === "save_question" ? questionContentSchema : z.object({});
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "VALIDATION_ERROR", message: operation === "save_section" ? "Enter a case title, description, and valid order." : "Check the content fields and provide exactly one correct answer per question." } };
  try {
    const db = await createClient();
    const { error } = await db.rpc("manage_bank_content", { operation, item_id: id, payload: parsed.data as Json });
    if (error) return { ok: false, error: { code: "CONFLICT", message: error.code === "23505" ? "This display order is already used in the bank." : error.code === "23503" ? "This content has linked history and cannot be deleted." : error.code === "23514" ? "The case or question does not belong to this bank." : "Unable to save content. Please try again." } };
    revalidatePath("/admin", "layout");
    revalidatePath("/student", "layout");
    revalidatePath("/teacher", "layout");
    return { ok: true, data: null };
  } catch { return { ok: false, error: { code: "INTERNAL_ERROR", message: "Unable to save content. Please try again." } }; }
}
