"use server";
import { revalidatePath } from "next/cache";
import { authorizeActiveAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { saveChapterSchema, assignChapterSchema, generationSchema } from "@/lib/validation/chapters";
import type { Json } from "@/lib/supabase/database.types";
import type { ServerResult } from "@/types/server-result";

async function mutate(operation: string, payload: Json): Promise<ServerResult<null>> {
  try {
    const db = await createClient(); const { error } = await db.rpc("manage_chapters", { operation, payload });
    if (error) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Changes were not saved. Check the bank, chapters and fields." } };
    revalidatePath("/admin/question-banks", "layout"); revalidatePath("/student", "layout");
    return { ok: true, data: null };
  } catch { return { ok: false, error: { code: "VALIDATION_ERROR", message: "Unable to save. Please retry." } }; }
}
export async function saveChapter(input: unknown): Promise<ServerResult<null>> {
  const auth = await authorizeActiveAdmin(); if (!auth.ok) return auth;
  const parsed = saveChapterSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Check the chapter title, order and fields." } };
  return mutate("save_chapter", parsed.data);
}
export async function assignQuestionChapters(input: unknown): Promise<ServerResult<null>> {
  const auth = await authorizeActiveAdmin(); if (!auth.ok) return auth;
  const parsed = assignChapterSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Select valid chapters and reviewed difficulty." } };
  return mutate("assign_question", parsed.data);
}
export async function saveGenerationSettings(input: unknown): Promise<ServerResult<null>> {
  const auth = await authorizeActiveAdmin(); if (!auth.ok) return auth;
  const parsed = generationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Choose a default count from 1 to 30." } };
  return mutate("save_generation", parsed.data);
}
