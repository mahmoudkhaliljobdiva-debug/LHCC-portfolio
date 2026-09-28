import type { z } from "zod";
import type { examSchema, examBankSchema } from "@/lib/validation/exam";
export type ExamAttempt = z.infer<typeof examSchema>;
export type ExamBank = z.infer<typeof examBankSchema>;
