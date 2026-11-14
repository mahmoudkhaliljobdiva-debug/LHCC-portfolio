"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeActiveAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { subjectDecisionSchema, subjectPageInputSchema, subjectSourceInputSchema, subjectStageInputSchema } from "@/lib/validation/subject-question";
import type { Json } from "@/lib/supabase/database.types";
import type { ServerResult } from "@/types/server-result";

export async function manageSubjectImport(operation: "source" | "page" | "stage" | "approve" | "reject" | "needs_review" | "import", bankId: string, id: string, input: unknown): Promise<ServerResult<{ id: string; revision?: number | undefined; questionId?: string | null | undefined }>> {
  const auth = await authorizeActiveAdmin(); if (!auth.ok) return auth;
  const schema = operation === "source" ? subjectSourceInputSchema : operation === "page" ? subjectPageInputSchema : operation === "stage" ? subjectStageInputSchema : subjectDecisionSchema;
  const parsed = schema.safeParse(input);
  if (!parsed.success || !z.uuid().safeParse(id).success || !z.string().min(1).max(200).safeParse(bankId).success) return { ok: false, error: { code: "VALIDATION_ERROR", message: parsed.error?.issues[0]?.message ?? "Invalid Subject import." } };
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("manage_subject_import", { operation, bank_id: bankId, item_id: id, payload: parsed.data as Json });
    if (error) return { ok: false, error: { code: "CONFLICT", message: error.code === "40001" ? "This draft changed. Reload before continuing." : error.code === "42501" ? "Explicit Admin approval is required before import." : "Unable to complete this operation. Check the source, complete options, answer evidence, explanation, visual review and duplicate review." } };
    revalidatePath("/admin/subjects", "layout");
    return { ok: true, data: z.object({ id: z.uuid(), revision: z.number().optional(), questionId: z.string().nullable().optional() }).parse(data) };
  } catch { return { ok: false, error: { code: "INTERNAL_ERROR", message: "Subject changes could not be saved." } }; }
}
export async function deleteSubjectQuestion(bankId: string, questionId: string): Promise<ServerResult<null>> {
  const auth = await authorizeActiveAdmin(); if (!auth.ok) return auth;
  if (![bankId, questionId].every(id => z.string().min(1).max(200).safeParse(id).success)) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid question." } };
  try {
    const { error } = await (await createClient()).rpc("delete_subject_question", { bank_id: bankId, question_id: questionId });
    if (error) return { ok: false, error: { code: "CONFLICT", message: "This question could not be deleted. Questions with protected learning history must be retained." } };
    revalidatePath("/admin/subjects", "layout"); return { ok: true, data: null };
  } catch { return { ok: false, error: { code: "INTERNAL_ERROR", message: "Unable to delete this question." } }; }
}
