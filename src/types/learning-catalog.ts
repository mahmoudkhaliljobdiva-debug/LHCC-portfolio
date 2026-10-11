import type { z } from "zod";
import type { catalogSchema, specialtySchema, sharedDefinitionSchema, generateSharedSchema, saveSharedSchema } from "@/lib/validation/learning-catalog";
export type LearningCatalog = z.infer<typeof catalogSchema>;
export type Specialty = z.infer<typeof specialtySchema>;
export type SharedDefinition = z.infer<typeof sharedDefinitionSchema>;
export type GenerateSharedInput = z.infer<typeof generateSharedSchema>;
export type SaveSharedInput = z.infer<typeof saveSharedSchema>;
