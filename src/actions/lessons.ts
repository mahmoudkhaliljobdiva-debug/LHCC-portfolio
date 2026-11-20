"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeActiveAdmin } from "@/lib/auth/admin";
import { getAdminSubjectLessons } from "@/lib/learning/lessons";
import { createClient } from "@/lib/supabase/server";
import { approveLessonDocumentSchema, lessonDraftSchema, lessonSaveResultSchema, registerLessonDocumentSchema } from "@/lib/validation/lessons";
import type { Json } from "@/lib/supabase/database.types";
import type { AdminLessonsData } from "@/types/lesson";
import type { ServerResult } from "@/types/server-result";

function refreshLessons() { revalidatePath("/admin/subjects", "layout"); }

export async function loadAdminLessons(bankId: string, lessonId: string | null = null): Promise<ServerResult<AdminLessonsData>> {
  return getAdminSubjectLessons(bankId, lessonId);
}

export async function saveLesson(input: unknown): Promise<ServerResult<{ id: string; revision: number }>> {
  const auth = await authorizeActiveAdmin();
  if (!auth.ok) return auth;
  const parsed = lessonDraftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Check the lesson fields." } };
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("save_lesson", { payload: parsed.data as Json });
    const result = lessonSaveResultSchema.safeParse(data);
    if (error || !result.success) return { ok: false, error: { code: "CONFLICT", message: "Lesson not saved. Check its chapter, reviewed answers and source documents. Another administrator may have saved a newer revision; reload before retrying." } };
    refreshLessons();
    return { ok: true, data: result.data };
  } catch {
    return { ok: false, error: { code: "INTERNAL_ERROR", message: "Unable to save the lesson. Your draft remains on this screen." } };
  }
}

export async function registerLessonDocument(input: unknown): Promise<ServerResult<string>> {
  const auth = await authorizeActiveAdmin();
  if (!auth.ok) return auth;
  const parsed = registerLessonDocumentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Check the PDF source and permission notes." } };
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("register_lesson_document", { payload: parsed.data as Json });
    if (error || !z.uuid().safeParse(data).success || typeof data !== "string") return { ok: false, error: { code: "CONFLICT", message: "The private upload could not be registered. The lesson must exist, and this PDF may already be attached. No Student approval was granted." } };
    refreshLessons();
    return { ok: true, data };
  } catch {
    return { ok: false, error: { code: "INTERNAL_ERROR", message: "Private PDF registration failed. No Student approval was granted." } };
  }
}

export async function approveLessonDocument(input: unknown): Promise<ServerResult<null>> {
  const auth = await authorizeActiveAdmin();
  if (!auth.ok) return auth;
  const parsed = approveLessonDocumentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Choose a valid document approval." } };
  try {
    const db = await createClient();
    const { error } = await db.rpc("approve_lesson_document", { document_id: parsed.data.documentId, approved: parsed.data.approved });
    if (error) return { ok: false, error: { code: "CONFLICT", message: "The PDF approval was not changed. Reload and retry." } };
    refreshLessons();
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: { code: "INTERNAL_ERROR", message: "Unable to change this PDF approval." } };
  }
}

/** Admin-only, document-scoped access. Never return this link from a Student catalog. */
export async function getAdminLessonDocumentLink(documentId: string, lessonId: string): Promise<ServerResult<string>> {
  const auth = await authorizeActiveAdmin();
  if (!auth.ok) return auth;
  if (!z.object({ documentId: z.uuid(), lessonId: z.uuid() }).safeParse({ documentId, lessonId }).success) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Choose a valid lesson PDF." } };
  try {
    const db = await createClient();
    const { data, error } = await db.from("lesson_documents").select("id,lesson_id,storage_path").eq("id", documentId).eq("lesson_id", lessonId).single();
    if (error || !data || data.storage_path !== `${lessonId}/${documentId}.pdf`) return { ok: false, error: { code: "FORBIDDEN", message: "This private lesson PDF is unavailable." } };
    const result = await db.storage.from("lesson-source-pdfs").createSignedUrl(data.storage_path, 60);
    if (result.error || !result.data) return { ok: false, error: { code: "INTERNAL_ERROR", message: "Unable to open this private lesson PDF." } };
    return { ok: true, data: result.data.signedUrl };
  } catch {
    return { ok: false, error: { code: "INTERNAL_ERROR", message: "Unable to open this private lesson PDF." } };
  }
}
