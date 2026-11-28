"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { ServerResult } from "@/types/server-result";

const allowed = z.enum(["dentistry","medical","nursing"]);
export async function chooseStudentSpecialty(input: unknown): Promise<ServerResult<string>> {
  const parsed = allowed.safeParse(input);
  if (!parsed.success) return { ok:false,error:{code:"VALIDATION_ERROR",message:"Select Dentistry, Medicine or Nursing."} };
  const profile = await requireRole("STUDENT");
  if (profile.specialty_id) return { ok:false,error:{code:"FORBIDDEN",message:"Your specialty is already selected. Contact LHCC to request a change."} };
  const { data,error } = await (await createClient()).rpc("choose_student_specialty", { specialty_slug:parsed.data });
  if (error || !data) return { ok:false,error:{code:"FORBIDDEN",message:"Unable to confirm this specialty. Refresh and try again."} };
  revalidatePath("/student","layout");
  return { ok:true,data };
}
