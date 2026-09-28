import { z } from "zod";

export const questionContentSchema = z.object({
  bankId: z.string().trim().min(1).max(200),
  text: z.string().trim().min(1).max(10000),
  status: z.enum(["active", "inactive"]),
  answers: z.array(z.object({ id: z.string().min(1).max(200), text: z.string().trim().min(1).max(5000), isCorrect: z.boolean() })).min(2).max(10),
}).strict().refine(value => value.answers.filter(answer => answer.isCorrect).length === 1 && new Set(value.answers.map(answer => answer.id)).size === value.answers.length);

export const teacherQuestionSchema = questionContentSchema.safeExtend({ status: z.literal("active") });
