import { z } from "zod";
import { contentId } from "@/lib/validation/exam";

export const materialKinds = ["SUBJECT", "EXAM_TRACK"] as const;
export const examCategories = ["COLLOQUIUM", "PROMETRIC", "OTHER"] as const;
export const materialIcons = ["book", "brain", "stethoscope", "nursing", "dentistry", "graduation", "clipboard", "other"] as const;
export const materialLanguages = ["auto", "ar", "en", "mixed"] as const;
export const publicationStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

const materialFields = z.object({
  // Legacy bank IDs and descriptions are read as stored, without truncation.
  id: z.string(),
  name: z.string(),
  description: z.string(),
  specialtyId: z.uuid().nullable(),
  materialKind: z.enum(materialKinds),
  examCategory: z.enum(examCategories).nullable(),
  publicationStatus: z.enum(publicationStatuses),
  icon: z.enum(materialIcons),
  language: z.enum(materialLanguages),
  displayOrder: z.number().int().min(0).max(2147483647),
  status: z.enum(["active", "inactive"]),
}).strict();

function validateClassification(value: z.infer<typeof materialFields>, context: z.RefinementCtx) {
  if (value.materialKind === "SUBJECT" && (value.specialtyId === null || value.examCategory !== null)) {
    context.addIssue({ code: "custom", message: "A subject needs a specialty and cannot have an exam category.", path: ["specialtyId"] });
  }
  if (value.materialKind === "EXAM_TRACK" && value.examCategory === null) {
    context.addIssue({ code: "custom", message: "Choose an exam category.", path: ["examCategory"] });
  }
}

export const materialRecordSchema = materialFields.extend({ questionCount: z.number().int().nonnegative().optional(), chapterCount: z.number().int().nonnegative().optional() }).superRefine(validateClassification);
export const subjectMetadataSchema = materialFields.extend({
  materialKind: z.literal("SUBJECT"), name: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(3000), displayOrder: z.number().int().min(0).max(10000),
}).superRefine(validateClassification);

/** Subjects remain unavailable until the lesson and subject-access flows exist. */
export const materialSchema = materialFields.extend({
  id: contentId.regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, "Choose a valid material identifier."),
  name: z.string().trim().min(1, "Enter a material name.").max(200),
  description: z.string().trim().min(1, "Enter a material description.").max(3000),
  displayOrder: z.number().int().min(0).max(10000),
}).superRefine(validateClassification).superRefine((value, context) => {
  if (value.materialKind === "SUBJECT" && (value.publicationStatus !== "DRAFT" || value.status !== "inactive")) {
    context.addIssue({ code: "custom", message: "Subjects must remain Draft and Inactive in this foundation.", path: ["publicationStatus"] });
  }
});

export const adminMaterialsSchema = z.object({
  items: z.array(materialRecordSchema).max(20),
  total: z.number().int().min(0),
  folders: z.array(z.object({ id: z.string(), name: z.string(), displayOrder: z.number(), total: z.number().int().nonnegative() })).optional(),
}).strict();
export const materialSpecialtyOptionsSchema = z.array(z.object({ id: z.uuid(), name: z.string() }).strict());
export const materialListQuerySchema = z.object({ kind: z.enum(materialKinds), page: z.number().int().min(0).max(100000) }).strict();

export function materialPageNumber(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 0;
  const page = Number(value);
  return Number.isSafeInteger(page) && page <= 100000 ? page : 0;
}
