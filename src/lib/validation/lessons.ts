import { z } from "zod";
import { contentId } from "@/lib/validation/exam";
import { importQuestionSchema } from "@/lib/validation/past-exam";
import { materialIcons, materialLanguages } from "@/lib/validation/material";

export const lessonQuestionSchema = importQuestionSchema.safeExtend({
  options: z.array(importQuestionSchema.shape.options.element.strict()).max(10),
  explanation: z.string().max(10000).default(""),
  documentId: z.uuid().nullable().default(null),
  sourcePage: z.number().int().min(1).max(200).nullable().default(null),
}).strict().superRefine((question, context) => {
  if (question.sourcePage !== null && question.documentId === null) {
    context.addIssue({ code: "custom", message: "Select a source PDF before recording a page reference." });
  }
  if (question.verified && Boolean(question.caseId) !== Boolean(question.caseTitle.trim())) {
    context.addIssue({ code: "custom", message: "Reviewed clinical questions require a case identifier, title and description." });
  }
});

export const lessonDraftSchema = z.object({
  id: z.uuid(), bankId: contentId, chapterId: z.uuid(),
  title: z.string().trim().min(1).max(300), description: z.string().max(5000),
  displayOrder: z.number().int().min(0).max(100000), language: z.enum(materialLanguages),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  expectedRevision: z.number().int().min(0).max(2147483646),
  questions: z.array(lessonQuestionSchema).max(1000),
}).strict().superRefine((lesson, context) => {
  if (new Set(lesson.questions.map(question => question.id)).size !== lesson.questions.length) {
    context.addIssue({ code: "custom", message: "Question identifiers must be unique." });
  }
  if (lesson.status === "PUBLISHED" && lesson.questions.some(question => !question.verified || !question.correctOptionId || question.warnings.length > 0)) {
    context.addIssue({ code: "custom", message: "Verify every published question and resolve its warnings." });
  }
  if (lesson.status === "PUBLISHED" && lesson.questions.some(question => !question.explanation.trim())) {
    context.addIssue({ code: "custom", message: "Explain why the correct answer is right for every question before publishing." });
  }
  if (new TextEncoder().encode(JSON.stringify(lesson)).byteLength > 2500000) {
    context.addIssue({ code: "custom", message: "Split this lesson into smaller lessons before saving." });
  }
});

export const registerLessonDocumentSchema = z.object({
  id: z.uuid(), lessonId: z.uuid(), filename: z.string().trim().min(1).max(500),
  storagePath: z.string().max(300), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  sizeBytes: z.number().int().positive().max(20971520),
  documentRole: z.enum(["ORIGINAL", "STUDENT_SAFE"]),
  provenance: z.string().trim().min(1).max(3000),
}).strict().superRefine((document, context) => {
  if (document.storagePath !== `${document.lessonId}/${document.id}.pdf`) {
    context.addIssue({ code: "custom", message: "Invalid lesson document path." });
  }
});

export const approveLessonDocumentSchema = z.object({ documentId: z.uuid(), approved: z.boolean() }).strict();
export const lessonSaveResultSchema = z.object({ id: z.uuid(), revision: z.number().int().positive() }).strict();
export const lessonDocumentSchema = z.object({
  id: z.uuid(), lessonId: z.uuid(), filename: z.string(), sha256: z.string(),
  documentRole: z.enum(["ORIGINAL", "STUDENT_SAFE"]), approvedForStudents: z.boolean(),
  provenance: z.string(), createdAt: z.string(),
});
export const adminLessonsSchema = z.object({
  bank: z.object({ id: contentId, name: z.string(), specialtyName: z.string().nullable(), icon: z.enum(materialIcons), language: z.enum(materialLanguages) }),
  chapters: z.array(z.object({ id: z.uuid(), title: z.string(), description: z.string(), displayOrder: z.number().int(), published: z.boolean() })),
  lessons: z.array(z.object({ id: z.uuid(), chapterId: z.uuid(), title: z.string(), description: z.string(), displayOrder: z.number().int(), language: z.enum(materialLanguages), status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]), revision: z.number().int(), questionCount: z.number().int() })),
  draft: lessonDraftSchema.nullable(),
  documents: z.array(lessonDocumentSchema),
});
