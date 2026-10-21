import type { z } from "zod";
import type { adminChaptersSchema, chapterSchema } from "@/lib/validation/chapters";
export type Chapter = z.infer<typeof chapterSchema>;
export type AdminChaptersData = z.infer<typeof adminChaptersSchema>;
