import type { z } from "zod";
import type { adminSubjectQuestionsSchema, stagedSubjectQuestionSchema, subjectDraftSchema, subjectQuestionSchema, subjectStageInputSchema } from "@/lib/validation/subject-question";
export type SubjectQuestionsData = z.infer<typeof adminSubjectQuestionsSchema>;
export type SubjectQuestion = z.infer<typeof subjectQuestionSchema>;
export type StagedSubjectQuestion = z.infer<typeof stagedSubjectQuestionSchema>;
export type SubjectDraft = z.infer<typeof subjectDraftSchema>;
export type SubjectStageInput = z.infer<typeof subjectStageInputSchema>;
