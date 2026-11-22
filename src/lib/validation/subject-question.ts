import { z } from "zod";
import { contentId } from "@/lib/validation/exam";

export const subjectOptionSchema = z.object({ id: z.string().min(1).max(200), text: z.string().max(5000) }).strict();
export const subjectDraftSchema = z.object({
  text: z.string().max(10000), options: z.array(subjectOptionSchema).max(10), correctOptionId: z.string().max(200).nullable(),
  explanation: z.string().max(10000), evidence: z.string().max(10000), chapterId: z.uuid().nullable(),
  visualsReviewed: z.boolean(), duplicatesReviewed: z.boolean(), explanationOrigin: z.enum(["SOURCE", "ADMIN"]),
  answerPage: z.number().int().min(1).max(2000).nullable().optional(),
}).strict();
export const subjectStageInputSchema = z.object({
  sourceId: z.uuid().nullable(), expectedRevision: z.number().int().positive().nullable(),
  pageStart: z.number().int().min(1).max(2000), pageEnd: z.number().int().min(1).max(2000), sourceNumber: z.string().max(100),
  answerStatus: z.enum(["UNVERIFIED", "SOURCE_VERIFIED", "AMBIGUOUS", "MISSING_IN_SOURCE", "MEDICALLY_REVIEWED"]),
  notes: z.string().max(5000), draft: subjectDraftSchema,
}).strict().refine(value => value.pageEnd >= value.pageStart, "End page must follow the start page.");
export const subjectSourceInputSchema = z.object({ filename: z.string().trim().min(1).max(500), driveFileId: z.string().regex(/^[A-Za-z0-9_-]{10,200}$/), pages: z.number().int().min(1).max(2000), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const subjectPageInputSchema = z.object({ sourceId: z.uuid(), page: z.number().int().min(1).max(2000), text: z.string().max(200000), status: z.enum(["EXTRACTED", "NEEDS_REVIEW"]), warnings: z.array(z.string().max(1000)).max(100) }).strict();
export const subjectDecisionSchema = z.object({ expectedRevision: z.number().int().positive(), notes: z.string().max(5000).optional() }).strict();
export const reviewedSubjectQuestionSchema = subjectStageInputSchema.safeExtend({ approvalConfirmed: z.literal(true) });
export const subjectSourceSchema = z.object({ id: z.uuid(), filename: z.string(), driveFileId: z.string(), pages: z.number().int(), kind: z.enum(["PDF", "ADMIN"]), processedPages: z.number().int(), needsReviewPages: z.number().int() });
export const subjectQuestionSchema = z.object({
  id: contentId, text: z.string(), options: z.array(subjectOptionSchema), status: z.string(), displayOrder: z.number().nullable(), correctOptionId: z.string().nullable(),
  approvalStatus: z.string(), explanation: z.string().nullable(), evidence: z.string().nullable(), filename: z.string().nullable(), driveFileId: z.string().nullable(),
  pageStart: z.number().nullable(), pageEnd: z.number().nullable(), sourceNumber: z.string().nullable(), stagingId: z.uuid().nullable(), chapters: z.array(z.string()),
  groupInstructions: z.string().nullable(), sharedOptions: z.array(subjectOptionSchema).nullable(), assetCount: z.number().int(),
  caseTitle: z.string().nullable().optional(), caseDescription: z.string().nullable().optional(), answerStatus: z.string().nullable().optional(), explanationOrigin: z.string().nullable().optional(), answerPage: z.number().nullable().optional(),
  lessonId: z.uuid().nullable().optional(),
  stagingRevision: z.number().int().positive().nullable().optional(),
  chapterId: z.uuid().nullable().optional(),
});
export const stagedSubjectQuestionSchema = z.object({
  id: z.uuid(), revision: z.number().int(), draft: z.record(z.string(), z.unknown()), answerStatus: z.string(), reviewStatus: z.string(), notes: z.string().nullable(),
  sourceId: z.uuid(), filename: z.string(), pageStart: z.number(), pageEnd: z.number(), sourceNumber: z.string().nullable(), questionId: z.string().nullable(),
  importedAt: z.string().nullable(), reviewedBy: z.uuid().nullable(), reviewedAt: z.string().nullable(), createdAt: z.string(), possibleDuplicates: z.number(),
});
export const adminSubjectQuestionsSchema = z.object({
  bank: z.object({ id: contentId, name: z.string(), specialtyName: z.string().nullable() }), questionCount: z.number().int(), extractedCount: z.number().int().nonnegative(), pendingCount: z.number().int(),
  chapters: z.array(z.object({ id: z.uuid(), title: z.string() })), sources: z.array(subjectSourceSchema),
  items: z.array(subjectQuestionSchema.or(stagedSubjectQuestionSchema)), total: z.number().int(),
});
