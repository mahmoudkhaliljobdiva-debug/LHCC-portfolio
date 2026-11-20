import "server-only";
import { cache } from "react";
import { z } from "zod";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { readAllRows } from "@/lib/supabase/pagination";
import { catalogSchema, specialtySchema, sharedDefinitionSchema } from "@/lib/validation/learning-catalog";

// Request-local only. Public payload explicitly excludes questions, keys and PDFs.
export const getLearningCatalog = cache(async () => {
  const db = await createClient(); const { data, error } = await db.rpc("learning_catalog");
  if (error) throw new Error("Unable to load the learning catalog.");
  return catalogSchema.parse(data);
});
export async function getAdminCatalog() {
  await requireRole("ADMIN"); const db = await createClient();
  const [specialties, banks] = await Promise.all([
    readAllRows((from,to) => db.from("specialties").select("id,slug,name,description,icon,published,display_order").order("display_order").order("id").range(from,to)),
    readAllRows((from,to) => db.from("question_banks").select("id,name,specialty_id").order("display_order").order("id").range(from,to)),
  ]);
  return { specialties: z.array(specialtySchema).parse(specialties.map(s => ({ ...s, displayOrder: s.display_order }))), banks };
}
export async function getAdminSharedExams(bankId: string, page = 0) {
  await requireRole("ADMIN"); const db = await createClient();
  const { data,error } = await db.rpc("admin_shared_exams", { bank_id: bankId, page_number: page });
  if (error) throw new Error("Unable to load shared exam management.");
  return z.array(sharedDefinitionSchema).parse(data);
}
