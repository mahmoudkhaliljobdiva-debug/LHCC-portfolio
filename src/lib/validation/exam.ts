import { z } from "zod";

export const examId = z.uuid();
export const contentId = z.string().trim().min(1).max(200);
export const examSchema = z.object({
  id: examId, bankId: contentId, bankName: z.string(), status: z.enum(["IN_PROGRESS", "COMPLETED", "ABANDONED"]),
  totalQuestions: z.number().int().min(1).max(30), startedAt: z.string(), submittedAt: z.string().nullable(),
  result: z.object({ correct: z.number(), incorrect: z.number(), score: z.number() }).nullable(),
  questions: z.array(z.object({ id: contentId, text: z.string(), order: z.number().int(),
    options: z.array(z.object({ id: contentId, text: z.string() })), selectedOptionId: z.string().nullable(), outcome: z.boolean().optional(),
  })),
}).superRefine((exam,context) => {
  if (exam.questions.length !== exam.totalQuestions || new Set(exam.questions.map(q => q.id)).size !== exam.totalQuestions
    || exam.questions.some((q,index) => q.order !== index+1)) context.addIssue({ code:"custom",message:"Invalid persisted question set" });
  if (exam.status !== "COMPLETED" && (exam.result !== null || exam.questions.some(q => q.outcome !== undefined))) context.addIssue({ code:"custom",message:"Premature grading data" });
});
export const examBankSchema = z.object({
  id: contentId, name: z.string(), description: z.string(), available: z.number().int(), examCount: z.number().int().min(0).max(30),
  attempts: z.array(z.object({ id: examId, status: z.enum(["IN_PROGRESS", "COMPLETED", "ABANDONED"]), mode: z.enum(["PRACTICE", "EXAM"]),
    startedAt: z.string(), submittedAt: z.string().nullable(), totalQuestions: z.number(), score: z.number().nullable(),
  })),
});
