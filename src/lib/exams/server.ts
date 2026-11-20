import "server-only";
import { requireRole } from "@/lib/auth/server";
import { getPortalPreviewContext } from "@/lib/portal-preview/server";
import { createClient } from "@/lib/supabase/server";
import { contentId, examId, examSchema, examBankSchema } from "@/lib/validation/exam";

export async function getExamBank(bankId: string, subjectId?: string) {
  if (subjectId) await getPortalPreviewContext("student", subjectId); else await requireRole("STUDENT");
  if (!contentId.safeParse(bankId).success) return null;
  const db = await createClient();
  const { data, error } = await db.rpc("exam_bank_data", { bank_id: bankId, ...(subjectId ? { subject_id: subjectId } : {}) });
  if (error?.code === "42501") return null;
  if (error) throw new Error("Unable to load question bank details.");
  return examBankSchema.parse(data);
}
export async function getExamAttempt(attemptId: string, subjectId?: string) {
  if (subjectId) await getPortalPreviewContext("student", subjectId); else await requireRole("STUDENT");
  if (!examId.safeParse(attemptId).success) return null;
  const db = await createClient();
  const { data, error } = await db.rpc("exam_data", { attempt_id: attemptId, ...(subjectId ? { subject_id: subjectId } : {}) });
  if (error?.code === "42501") return null;
  if (error) throw new Error("Unable to load this exam.");
  return examSchema.parse(data);
}
