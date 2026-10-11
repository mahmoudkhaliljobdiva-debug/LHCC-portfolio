import { z } from "zod";
import { contentId } from "@/lib/validation/exam";

export const specialtyIcons = ["nursing", "medical", "dentistry", "pharmacy", "laboratory", "radiology", "physiotherapy", "other"] as const;
export const specialtySchema = z.object({
  id: z.uuid(), slug: z.string().max(100).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name: z.string().trim().min(1).max(200), description: z.string().max(3000),
  icon: z.enum(specialtyIcons), published: z.boolean(), displayOrder: z.number().int().min(0).max(10000),
});
export const catalogSchema = z.array(specialtySchema.pick({ id: true, slug: true, name: true, description: true, icon: true }).extend({
  materials: z.array(z.object({ id: contentId, name: z.string(), description: z.string() })),
}));
export const generateSharedSchema = z.object({
  id: z.uuid(), bankId: contentId, title: z.string().trim().min(1).max(500),
  count: z.number().int().min(1).max(1000), timeLimitMinutes: z.number().int().min(1).max(1440).nullable(),
}).strict();
export const saveSharedSchema = z.object({
  id: z.uuid(), title: z.string().trim().min(1).max(500), status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  timeLimitMinutes: z.number().int().min(1).max(1440).nullable(), questionIds: z.array(contentId).min(1).max(1000),
}).strict().refine(x => new Set(x.questionIds).size === x.questionIds.length, "Question IDs must be unique.");
export const sharedDefinitionSchema = z.object({
  id: z.uuid(), bankId: contentId, title: z.string(), status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  questionCount: z.number().int(), timeLimitMinutes: z.number().nullable(),
  questions: z.array(z.object({
    questionId: contentId, position: z.number().int(), text: z.string(),
    options: z.array(z.object({ id: contentId, text: z.string() })),
    case_title: z.string().nullable(), case_description: z.string().nullable(), correct_option_id: contentId,
  })),
});
