import "server-only";
import { z } from "zod";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { pastExamDraftSchema } from "@/lib/validation/past-exam";
export async function getAdminMaterialIdentity(bankId: string) {
  await requireRole("ADMIN"); const db = await createClient();
  const { data, error } = await db.from("question_banks").select("name,specialties(name)").eq("id", bankId).single();
  if (error) throw new Error("Unable to identify this PDF's material.");
  return { material: data.name, specialty: data.specialties?.name ?? "No specialty assigned" };
}
export async function getAdminPastExams(bankId: string) {
  await requireRole("ADMIN"); const db = await createClient(); const { data,error } = await db.rpc("admin_past_exams",{ bank_id:bankId });
  if (error) throw new Error("Unable to load past exam management.");
  return z.object({ exams:z.array(pastExamDraftSchema),sources:z.array(z.object({ id:z.uuid(),filename:z.string(),storagePath:z.string() })) }).parse(data);
}
