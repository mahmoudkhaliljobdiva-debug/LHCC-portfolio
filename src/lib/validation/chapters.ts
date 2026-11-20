import { z } from "zod";
import { contentId } from "./exam";
export const chapterSchema = z.object({
  id: z.uuid(), title: z.string().trim().min(1).max(200), description: z.string().max(3000),
  displayOrder: z.number().int().min(0).max(100000), published: z.boolean(), questionCount: z.number().int().min(0).default(0),
});
export const saveChapterSchema = chapterSchema.omit({ questionCount: true }).extend({ bankId: contentId }).strict();
export const assignChapterSchema = z.object({ bankId: contentId, questionId: contentId,
  chapterIds: z.array(z.uuid()).max(100), difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).nullable(),
}).strict().refine(v => new Set(v.chapterIds).size === v.chapterIds.length, "Choose each chapter once.");
export const generationSchema = z.object({ bankId: contentId, defaultCount: z.number().int().min(1).max(30), prioritizeIncorrect: z.boolean() }).strict();
export const adminChaptersSchema = z.object({ bankId: contentId, bankName: z.string(), specialtyName: z.string().nullable(),
  defaultCount: z.number().int().min(1).max(30), prioritizeIncorrect: z.boolean(), total: z.number().int(), chapters: z.array(chapterSchema),
  questions: z.array(z.object({ id: contentId, text: z.string(), status: z.string(), difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).nullable(), chapters: z.array(z.uuid()) })),
});
