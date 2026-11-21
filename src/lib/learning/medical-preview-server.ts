import "server-only";
import { z } from "zod";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

const studyQuestionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  options: z.array(z.object({ id: z.string(), text: z.string() })),
  quality: z.enum(["SOURCE_EXTRACTED", "NEEDS_OCR_REVIEW"]),
  filename: z.string().min(1),
  pageStart: z.number().int().positive().nullable(),
});
const studyPreviewSchema = z.object({
  bank: z.object({ id: z.string(), name: z.string(), description: z.string() }),
  page: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  questions: z.array(studyQuestionSchema),
});

export type MedicalStudyPreview = z.infer<typeof studyPreviewSchema>;

/** Student-only OCR study view of all staged Medicine drafts.
 * Private solution keys, correctOptionId, and grading are excluded.
 * Unreliable text/choices remain explicitly labelled as OCR drafts.
 */
export async function getMedicalStudyPreview(bankId: string,page: number): Promise<MedicalStudyPreview> {
  await requireRole("STUDENT");
  if (!bankId || bankId.length > 200 || !Number.isInteger(page) || page < 0 || page > 1000) {
    throw new Error("Invalid study page.");
  }
  const db = await createClient();
  const { data,error } = await db.rpc("student_medical_subject_preview",{
    target_bank_id:bankId,page_number:page,
  });
  if (error || !data) throw new Error("Medical study questions could not be loaded.");
  return studyPreviewSchema.parse(data);
}
