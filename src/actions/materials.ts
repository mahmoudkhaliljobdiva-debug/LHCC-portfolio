"use server";

import { revalidatePath } from "next/cache";
import { authorizeActiveAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { materialSchema } from "@/lib/validation/material";
import type { Json } from "@/lib/supabase/database.types";
import type { ServerResult } from "@/types/server-result";

export async function saveMaterial(input: unknown): Promise<ServerResult<string>> {
  const auth = await authorizeActiveAdmin();
  if (!auth.ok) return auth;
  const parsed = materialSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Check the material fields." } };
  }
  try {
    const db = await createClient();
    // RPC enforces new-record draft/inactive status, dependency-safe kinds and admin authorization.
    // Price and legacy exam settings are deliberately absent from this payload.
    const { data, error } = await db.rpc("save_learning_material", { payload: parsed.data as Json });
    if (error || typeof data !== "string" || data.length === 0) {
      return { ok: false, error: { code: "INTERNAL_ERROR", message: "Material not saved. Check its fields and retry." } };
    }
    for (const path of ["/admin/subjects", "/admin/exam-tracks", "/admin/specialties", "/admin/question-banks", "/services"]) revalidatePath(path);
    revalidatePath("/programs", "layout");
    revalidatePath("/student", "layout");
    return { ok: true, data };
  } catch {
    return { ok: false, error: { code: "INTERNAL_ERROR", message: "Unable to save material. Please retry." } };
  }
}
