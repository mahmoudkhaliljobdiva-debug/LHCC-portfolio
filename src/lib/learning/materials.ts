import "server-only";

import { authorizeActiveAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { readAllRows } from "@/lib/supabase/pagination";
import { adminMaterialsSchema, materialListQuerySchema, materialSpecialtyOptionsSchema } from "@/lib/validation/material";
import type { AdminMaterialsData, MaterialKind } from "@/types/material";
import type { ServerResult } from "@/types/server-result";

export async function getAdminMaterials(kind: MaterialKind, page = 0): Promise<ServerResult<AdminMaterialsData>> {
  const auth = await authorizeActiveAdmin();
  if (!auth.ok) return auth;
  const query = materialListQuerySchema.safeParse({ kind, page });
  if (!query.success) return { ok: false, error: { code: "VALIDATION_ERROR", message: "Choose a valid material page." } };
  try {
    const db = await createClient();
    const [materials, specialties] = await Promise.all([
      db.rpc("admin_learning_materials", { kind: query.data.kind, page_number: query.data.page }),
      readAllRows((from, to) => db.from("specialties").select("id,name").order("display_order").order("id").range(from, to)),
    ]);
    if (materials.error) throw new Error("Material read failed.");
    const parsed = adminMaterialsSchema.parse(materials.data);
    if (parsed.items.some(item => item.materialKind !== kind)) throw new Error("Unexpected material kind.");
    return { ok: true, data: { ...parsed, specialties: materialSpecialtyOptionsSchema.parse(specialties) } };
  } catch {
    return { ok: false, error: { code: "INTERNAL_ERROR", message: "Unable to load materials. Please retry." } };
  }
}
