"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeActiveAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { pastExamDraftSchema } from "@/lib/validation/past-exam";
import type { Json } from "@/lib/supabase/database.types";
import type { ServerResult } from "@/types/server-result";

export async function savePastExam(input: unknown): Promise<ServerResult<string>> {
  const auth = await authorizeActiveAdmin(); if (!auth.ok) return auth;
  const parsed = pastExamDraftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Check exam fields." } };
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("save_past_exam", { payload: parsed.data as Json });
    if (error || !data) return { ok: false, error: { code: "CONFLICT", message: "Exam not saved. Verify keys, source, case relationships and explicit question reuse. Existing content is protected." } };
    revalidatePath("/admin", "layout"); revalidatePath("/student", "layout");
    return { ok: true, data };
  } catch { return { ok: false, error: { code: "INTERNAL_ERROR", message: "Unable to save the exam." } }; }
}
export async function registerExamSource(input: unknown): Promise<ServerResult<string>> {
  const auth = await authorizeActiveAdmin(); if (!auth.ok) return auth;
  const parsed = z.object({ id: z.uuid(), bankId: z.string().min(1).max(200), filename: z.string().min(1).max(500), storagePath: z.string().min(1).max(1000), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict().safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid PDF source." } };
  const db = await createClient(); const { data, error } = await db.rpc("register_exam_source", { payload: parsed.data });
  return error || !data ? { ok: false, error: { code: "INTERNAL_ERROR", message: "PDF uploaded but source registration failed. Retry registration; the original remains private." } } : { ok: true, data };
}
export async function getExamSourceLink(sourceId: string): Promise<ServerResult<string>> {
  const auth = await authorizeActiveAdmin(); if (!auth.ok) return auth;
  if (!z.uuid().safeParse(sourceId).success) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid source." } };
  const db = await createClient(); const { data } = await db.from("exam_sources").select("storage_path").eq("id",sourceId).single();
  if (!data) return { ok: false, error: { code: "FORBIDDEN", message: "Source unavailable." } };
  const result = await db.storage.from("exam-source-pdfs").createSignedUrl(data.storage_path,60);
  return result.data ? { ok: true, data: result.data.signedUrl } : { ok: false, error: { code: "INTERNAL_ERROR", message: "Unable to open source." } };
}
