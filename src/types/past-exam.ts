import type { z } from "zod";
import type { importQuestionSchema, pastExamDraftSchema, learningSetupSchema, pastExamCardSchema } from "@/lib/validation/past-exam";
export type ImportQuestion = z.infer<typeof importQuestionSchema>;
export type PastExamDraft = z.infer<typeof pastExamDraftSchema>;
export type LearningSetup = z.infer<typeof learningSetupSchema>;
export type PastExamCard = z.infer<typeof pastExamCardSchema>;
