import "server-only";
import { z } from "zod";
import { authorizeActiveAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { adminSubjectQuestionsSchema } from "@/lib/validation/subject-question";
import type { ServerResult } from "@/types/server-result";
import type { SubjectQuestionsData } from "@/types/subject-question";

export async function getSubjectQuestions(bankId: string, page: number, search: string, view: string, chapter: string | null): Promise<ServerResult<SubjectQuestionsData>> {
  const auth = await authorizeActiveAdmin(); if (!auth.ok) return auth;
  if (!z.object({ bankId: z.string().min(1).max(200), page: z.number().int().min(0).max(100000), search: z.string().max(200), view: z.enum(["questions", "review"]), chapter: z.uuid().nullable() }).safeParse({ bankId, page, search, view, chapter }).success) {
    return { ok: false, error: { code: "VALIDATION_ERROR", message: "Choose a valid Subject question filter." } };
  }
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("admin_subject_questions", { bank_id: bankId, page_number: page, search_text: search, view_kind: view, chapter_filter: chapter });
    if (error) throw new Error("Read failed");
    return { ok: true, data: adminSubjectQuestionsSchema.parse(data) };
  } catch { return { ok: false, error: { code: "INTERNAL_ERROR", message: "Unable to load Subject questions. Please retry." } }; }
}
