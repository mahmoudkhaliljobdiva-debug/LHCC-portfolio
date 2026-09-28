"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedProfile, getEffectiveProfileStatus } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { teacherQuestionSchema } from "@/lib/validation/question-content";
import type { Json } from "@/lib/supabase/database.types";
import type { QuestionInput } from "@/types/question-bank";
import type { ServerResult } from "@/types/server-result";

export async function addTeacherQuestion(bankId: string, input: QuestionInput): Promise<ServerResult<null>> {
  const parsed = teacherQuestionSchema.safeParse({ ...input, bankId });
  if (!parsed.success) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Complete the question and provide exactly one correct answer." } };
  try {
    const profile = await getAuthenticatedProfile();
    if (profile?.role !== "TEACHER" || await getEffectiveProfileStatus(profile) !== "ACTIVE") return { ok: false, error: { code: "FORBIDDEN", message: "An active teacher account is required." } };
    const db = await createClient();
    // Assignment checks and INSERT-only behavior are repeated by the database.
    const { error } = await db.rpc("teacher_add_question", { item_id: crypto.randomUUID(), payload: parsed.data as Json });
    if (error) return { ok: false, error: { code: "FORBIDDEN", message: "Unable to add the question. Check your bank assignment and try again." } };
    for (const role of ["teacher", "admin", "student"]) revalidatePath(`/${role}`, "layout");
    return { ok: true, data: null };
  } catch { return { ok: false, error: { code: "INTERNAL_ERROR", message: "Unable to add the question. Please try again." } }; }
}
