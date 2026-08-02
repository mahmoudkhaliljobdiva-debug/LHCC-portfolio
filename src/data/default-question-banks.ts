import type { AdminQuestionBank } from "@/types/question-bank";

export const DEFAULT_ADMIN_QUESTION_BANKS = [
  { id: "anatomy", name: "Human Anatomy", description: "Structural organization of the human body and its systems.", status: "active", displayOrder: 1, createdAt: "2026-01-12T09:00:00.000Z", updatedAt: "2026-07-24T11:30:00.000Z" },
  { id: "physiology", name: "Medical Physiology", description: "Functions and mechanisms of cells, organs, and body systems.", status: "active", displayOrder: 2, createdAt: "2026-01-15T09:00:00.000Z", updatedAt: "2026-07-22T10:15:00.000Z" },
  { id: "pharmacology", name: "Pharmacology", description: "Drug actions, therapeutic uses, and adverse effects.", status: "active", displayOrder: 3, createdAt: "2026-02-03T09:00:00.000Z", updatedAt: "2026-07-20T14:45:00.000Z" },
  { id: "pathology", name: "General Pathology", description: "Disease mechanisms, cellular injury, and tissue responses.", status: "active", displayOrder: 4, createdAt: "2026-02-16T09:00:00.000Z", updatedAt: "2026-07-18T13:20:00.000Z" },
  { id: "microbiology", name: "Medical Microbiology", description: "Clinically significant organisms and infectious diseases.", status: "inactive", displayOrder: 5, createdAt: "2026-03-02T09:00:00.000Z", updatedAt: "2026-07-15T08:40:00.000Z" },
  { id: "clinical-medicine", name: "Clinical Medicine", description: "Integrated diagnosis and management across clinical systems.", status: "active", displayOrder: 6, createdAt: "2026-03-18T09:00:00.000Z", updatedAt: "2026-07-25T16:10:00.000Z" },
] as const satisfies readonly AdminQuestionBank[];
