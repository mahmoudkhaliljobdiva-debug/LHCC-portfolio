import { z } from "zod";
import { contentId } from "@/lib/validation/exam";

export const importQuestionSchema = z.object({
  id: contentId,
  reuseQuestionId: contentId.nullable().default(null),
  duplicateReviewed: z.boolean().default(false),
  sourceNumber: z.string().max(100),
  text: z.string().trim().max(10000),
  options: z.array(z.object({ id: contentId, text: z.string().trim().max(3000) })).max(10),
  correctOptionId: contentId.nullable(),
  verified: z.boolean(),
  includeInBank: z.boolean(),
  caseId: contentId.nullable(),
  caseTitle: z.string().max(500),
  caseDescription: z.string().max(10000),
  warnings: z.array(z.string().max(500)).max(20),
}).superRefine((question, ctx) => {
  if (new Set(question.options.map(o => o.id)).size !== question.options.length) ctx.addIssue({ code: "custom", message: "Option IDs must be unique." });
  if (question.verified && (!question.text || question.options.length<2 || question.options.some(o=>!o.text) || !question.options.some(o => o.id === question.correctOptionId))) ctx.addIssue({ code: "custom", message: "Verified questions require complete text, options and a valid answer key." });
  if (question.verified && Boolean(question.caseTitle) !== Boolean(question.caseDescription)) ctx.addIssue({ code: "custom", message: "Provide both a case title and description." });
});
export const pastExamDraftSchema = z.object({
  id: z.uuid(), bankId: contentId, sourceId: z.uuid().nullable(),
  title: z.string().trim().min(1).max(500), year: z.number().int().min(1900).max(2200).nullable(),
  session: z.string().max(200), timeLimitMinutes: z.number().int().min(1).max(1440).nullable(),
  provenance: z.string().trim().min(1).max(3000),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  questions: z.array(importQuestionSchema).max(1000),
}).superRefine((exam, ctx) => {
  if (new Set(exam.questions.map(q => q.id)).size !== exam.questions.length) ctx.addIssue({ code: "custom", message: "Question IDs must be unique." });
  if (exam.status === "PUBLISHED" && (exam.year === null || !exam.questions.length || exam.questions.some(q => !q.verified || !q.correctOptionId || q.warnings.length))) ctx.addIssue({ code: "custom", message: "Confirm the year, resolve warnings, and verify every answer before publishing." });
});
export const learningSetupSchema = z.object({
  bankId: contentId, source: z.enum(["RANDOM", "ALL", "CASE", "PAST", "SHARED", "CHAPTER"]),
  prioritizeIncorrect: z.boolean().optional(),
  sourceId: contentId.nullable(), mode: z.enum(["PRACTICE", "EXAM"]),
  count: z.number().int().min(1).max(30).default(30), timeLimitMinutes: z.number().int().min(1).max(1440).nullable(),
}).superRefine((setup,ctx)=>{
  if ((setup.source === "PAST" || setup.source === "SHARED") && !z.uuid().safeParse(setup.sourceId).success) ctx.addIssue({code:"custom",message:"Choose a published exam definition."});
  if (setup.source === "CASE" && !setup.sourceId) ctx.addIssue({code:"custom",message:"Choose a clinical case."});
  if (setup.source === "CHAPTER" && !z.uuid().safeParse(setup.sourceId).success) ctx.addIssue({code:"custom",message:"Choose a published chapter."});
});
export const pastExamCardSchema = z.object({
  id: z.uuid(), title: z.string(), year: z.number().nullable(), session: z.string(),
  questionCount: z.number(), timeLimitMinutes: z.number().nullable(),
  completed: z.number(), bestScore: z.number().nullable(),
});
