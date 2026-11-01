import type { z } from "zod";
import type { adminLessonsSchema, lessonDraftSchema, lessonQuestionSchema, lessonDocumentSchema } from "@/lib/validation/lessons";

export type LessonDraft = z.infer<typeof lessonDraftSchema>;
export type LessonQuestion = z.infer<typeof lessonQuestionSchema>;
export type LessonDocument = z.infer<typeof lessonDocumentSchema>;
export type AdminLessonsData = z.infer<typeof adminLessonsSchema>;
