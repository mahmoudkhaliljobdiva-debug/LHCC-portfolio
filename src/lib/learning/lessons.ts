import "server-only";

import { z } from "zod";
import { authorizeActiveAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { contentId } from "@/lib/validation/exam";
import { adminLessonsSchema } from "@/lib/validation/lessons";
import type { AdminLessonsData } from "@/types/lesson";
import type { ServerResult } from "@/types/server-result";

export async function getAdminSubjectLessons(bankId: string, lessonId: string | null = null): Promise<ServerResult<AdminLessonsData>> {
  const auth = await authorizeActiveAdmin();
  if (!auth.ok) return auth;
  const query = z.object({ bankId: contentId, lessonId: z.uuid().nullable() }).safeParse({ bankId, lessonId });
  if (!query.success) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Choose a valid subject and lesson." } };
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("admin_subject_lessons", { bank_id: query.data.bankId, lesson_id: query.data.lessonId });
    if (error) throw new Error("Lesson read failed.");
    const parsed = adminLessonsSchema.parse(data);
    if (parsed.bank.id !== bankId || (lessonId && parsed.draft?.id !== lessonId)) throw new Error("Lesson unavailable.");
    return { ok: true, data: parsed };
  } catch {
    return { ok: false, error: { code: "NOT_FOUND", message: "Unable to load this subject's lessons. Check access and retry." } };
  }
}
