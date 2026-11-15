"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeActiveAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { reviewedSubjectQuestionSchema } from "@/lib/validation/subject-question";
import type { Json } from "@/lib/supabase/database.types";
import type { ServerResult } from "@/types/server-result";

export async function saveReviewedSubjectQuestion(bankId: string, questionId: string | null, input: unknown): Promise<ServerResult<{ questionId: string }>> {
  const auth = await authorizeActiveAdmin(); if (!auth.ok) return auth;
  const parsed = reviewedSubjectQuestionSchema.safeParse(input);
  if (!parsed.success || !z.string().min(1).max(200).safeParse(bankId).success || !z.string().min(1).max(200).nullable().safeParse(questionId).success) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Complete the question, source evidence and explicit review confirmation." } };
  try {
    const { data, error } = await (await createClient()).rpc("save_reviewed_subject_question", { bank_id: bankId, question_id: questionId, payload: parsed.data as Json });
    if (error) return { ok: false, error: { code: "CONFLICT", message: error.code === "40001" ? "This question changed. Reload before saving." : "Unable to save. Check complete choices, a supported answer, explanation, source, visual review and duplicates." } };
    revalidatePath("/admin/subjects", "layout");
    return { ok: true, data: z.object({ questionId: z.string() }).parse(data) };
  } catch { return { ok: false, error: { code: "INTERNAL_ERROR", message: "Question changes could not be saved." } }; }
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

/**
 * Apply a status change to a selected set of Subject questions.
 * The database enforces administrative permission and approved-answer eligibility.
 */
export async function bulkSetSubjectQuestionStatus(
  bankId: string,
  questionIds: string[],
  status: "active" | "inactive",
): Promise<ServerResult<{ updated: number }>> {
  const auth = await authorizeActiveAdmin();
  if (!auth.ok) return auth;
  const parsed = z.object({
    bankId: z.string().trim().min(1).max(200),
    questionIds: z.array(z.string().trim().min(1).max(200)).min(1).max(100)
      .refine((ids) => new Set(ids).size === ids.length, "Select distinct questions."),
    status: z.enum(["active", "inactive"]),
  }).safeParse({ bankId, questionIds, status });
  if (!parsed.success) return {
    ok: false,
    error: { code: "VALIDATION_ERROR", message: "Select 1 to 100 distinct questions." },
  };
  try {
    const { data, error } = await (await createClient()).rpc("bulk_update_subject_question_status", {
      bank_id: parsed.data.bankId,
      question_ids: parsed.data.questionIds,
      target_status: parsed.data.status,
    });
    if (error) return {
      ok: false,
      error: {
        code: "CONFLICT",
        message: status === "active"
          ? "Activation requires each selected question to have an administratively approved answer and complete choices."
          : "Unable to update the selected questions. Check their Subject and try again.",
      },
    };
    const result = z.object({ updated: z.number().int().min(0) }).parse(data);
    revalidatePath("/admin/subjects", "layout");
    return { ok: true, data: result };
  } catch {
    return { ok: false, error: { code: "INTERNAL_ERROR", message: "Bulk status update could not be completed." } };
  }
}
