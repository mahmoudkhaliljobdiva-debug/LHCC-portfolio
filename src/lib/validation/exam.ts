import { z } from "zod";

export const examId = z.uuid();
export const contentId = z.string().trim().min(1).max(200);
export const examSchema = z.object({
  id: examId, bankId: contentId, bankName: z.string(), status: z.enum(["IN_PROGRESS", "COMPLETED", "ABANDONED"]),
  totalQuestions: z.number().int().min(1), startedAt: z.string(), submittedAt: z.string().nullable(),
  title: z.string().optional(), year: z.number().nullable().optional(),
  learningMode: z.enum(["PRACTICE", "EXAM"]).default("EXAM"), source: z.enum(["RANDOM", "ALL", "CASE", "PAST", "SHARED"]).default("RANDOM"),
  deadlineAt: z.string().nullable().default(null), unanswered: z.number().optional(), timeTakenSeconds: z.number().nullable().optional(),
  result: z.object({ correct: z.number(), incorrect: z.number(), score: z.number() }).nullable(),
  questions: z.array(z.object({ id: contentId, text: z.string(), order: z.number().int(),
    caseTitle: z.string().nullable(), caseDescription: z.string().nullable(),
    options: z.array(z.object({ id: contentId, text: z.string() })), selectedOptionId: z.string().nullable(), outcome: z.boolean().optional(), correctOptionId: contentId.optional(),
  })),
}).superRefine((exam,context) => {
  if (exam.questions.length !== exam.totalQuestions || new Set(exam.questions.map(q => q.id)).size !== exam.totalQuestions
    || exam.questions.some((q,index) => q.order !== index+1)) context.addIssue({ code:"custom",message:"Invalid persisted question set" });
  if (exam.status !== "COMPLETED" && (exam.result !== null || (exam.learningMode !== "PRACTICE" && exam.questions.some(q => q.outcome !== undefined || q.correctOptionId !== undefined)))) context.addIssue({ code:"custom",message:"Premature grading data" });
  if (exam.questions.some(q => (q.correctOptionId !== undefined) !== (q.outcome !== undefined) && exam.learningMode === "PRACTICE")) context.addIssue({ code:"custom",message:"Invalid practice feedback" });
});
export const examBankSchema = z.object({
  id: contentId, name: z.string(), description: z.string(), available: z.number().int(), examCount: z.number().int().min(0).max(30),
  cases: z.array(z.object({ id: contentId, title: z.string(), description: z.string(), displayOrder: z.number().int(), questionCount: z.number().int().min(0) })),
  pastExams: z.array(z.object({ id: examId, title: z.string(), year: z.number().nullable(), session: z.string(), questionCount: z.number(), timeLimitMinutes: z.number().nullable(), completed: z.number(), bestScore: z.number().nullable() })).default([]),
  sharedExams: z.array(z.object({ id: examId, title: z.string(), questionCount: z.number().int(), timeLimitMinutes: z.number().nullable() })).default([]),
  attempts: z.array(z.object({ id: examId, status: z.enum(["IN_PROGRESS", "COMPLETED", "ABANDONED"]), mode: z.enum(["PRACTICE", "EXAM"]),
    startedAt: z.string(), submittedAt: z.string().nullable(), totalQuestions: z.number(), score: z.number().nullable(),
  })),
});
