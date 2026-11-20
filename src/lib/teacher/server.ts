import "server-only";
import { z } from "zod";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPortalPreviewContext } from "@/lib/portal-preview/server";
import { readAllRows } from "@/lib/supabase/pagination";

const safeQuestion = z.object({ id: z.string(), text: z.string(), status: z.string(), options: z.array(z.object({ id: z.string(), text: z.string() })) });

export async function getTeacherBank(bankId: string) {
  await requireRole("TEACHER");
  return readBank(await createClient(), bankId);
}

export async function getTeacherBankForAdmin(subjectId: string, bankId: string) {
  await getPortalPreviewContext("teacher", subjectId);
  const db = createAdminClient();
  const { data, error } = await db.from("teacher_bank_assignments").select("question_bank_id").eq("teacher_id", subjectId).eq("question_bank_id", bankId).maybeSingle();
  if (error) throw new Error("Unable to load assignment.");
  return data ? readBank(db, bankId) : null;
}

async function readBank(db: Awaited<ReturnType<typeof createClient>>, bankId: string) {
  const { data: bank, error } = await db.from("question_banks").select("id,name,description").eq("id", bankId).eq("status", "active").maybeSingle();
  if (error) throw new Error("Unable to load assigned bank.");
  if (!bank) return null;
  const rows = await readAllRows((from, to) => db.from("bank_questions").select("id,text,status,options").eq("question_bank_id", bankId).order("created_at").order("id").range(from, to));
  return { bank, questions: z.array(safeQuestion).parse(rows) };
}
