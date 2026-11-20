import "server-only";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { contentId } from "@/lib/validation/exam";
import { adminChaptersSchema } from "@/lib/validation/chapters";
export async function getAdminChapters(bankId: string, page: number, search: string) {
  await requireRole("ADMIN");
  if (!contentId.safeParse(bankId).success || !Number.isInteger(page) || page < 0 || page > 100000 || search.length > 200) return null;
  const db = await createClient();
  const { data, error } = await db.rpc("admin_chapters", { bank_id: bankId, page_number: page, search_text: search });
  if (error) throw new Error("Unable to load chapter management.");
  if (!data || typeof data !== "object" || Array.isArray(data) || !data.bankName) return null;
  return adminChaptersSchema.parse(data);
}
