import type { z } from "zod";
import type { adminMaterialsSchema, materialRecordSchema, materialSchema, materialSpecialtyOptionsSchema } from "@/lib/validation/material";

export type LearningMaterial = z.infer<typeof materialRecordSchema>;
export type MaterialInput = z.infer<typeof materialSchema>;
export type MaterialKind = LearningMaterial["materialKind"];
export type MaterialIconName = LearningMaterial["icon"];
export type MaterialSpecialtyOption = z.infer<typeof materialSpecialtyOptionsSchema>[number];
export type AdminMaterialsData = z.infer<typeof adminMaterialsSchema> & { specialties: MaterialSpecialtyOption[] };
