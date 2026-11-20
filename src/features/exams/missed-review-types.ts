import { z } from "zod";

export const sourceKindSchema = z.enum(["RANDOM", "ALL", "CASE", "PAST", "SHARED", "CHAPTER"]);
export const missedQuestionSchema = z.object({
  questionId: z.string().min(1).max(200),
  bankId: z.string(),
  specialty: z.string(),
  bankName: z.string(),
  sourceKind: sourceKindSchema,
  sourceLabel: z.string(),
  questionText: z.string(),
  options: z.array(z.object({ id: z.string(), text: z.string() })),
  caseTitle: z.string().nullable(),
  caseDescription: z.string().nullable(),
  sourceNumber: z.string().nullable(),
  selectedOptionId: z.string(),
  correctOptionId: z.string(),
  wrongCount: z.number().int().nonnegative(),
  lastMissedAt: z.string(),
  explanation: z.string().nullable(),
});
export const missedReviewSchema = z.object({
  mistakes: z.number().int().nonnegative(),
  uniqueQuestions: z.number().int().nonnegative(),
  completedExams: z.number().int().nonnegative(),
  specialties: z.array(z.object({ name: z.string(), mistakes: z.number().int().nonnegative() })),
  scoreHistogram: z.array(z.object({ label: z.string(), count: z.number().int().nonnegative() })),
  questions: z.array(missedQuestionSchema),
});
export type MissedQuestion = z.infer<typeof missedQuestionSchema>;
export type MissedReview = z.infer<typeof missedReviewSchema>;
export type SourceKind = z.infer<typeof sourceKindSchema>;
