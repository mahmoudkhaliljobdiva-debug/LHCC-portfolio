"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeActiveAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { specialtySchema, generateSharedSchema, saveSharedSchema } from "@/lib/validation/learning-catalog";
import { contentId } from "@/lib/validation/exam";
import type { Json } from "@/lib/supabase/database.types";
import type { ServerResult } from "@/types/server-result";

function invalidate() { revalidatePath("/student","layout"); revalidatePath("/admin","layout"); revalidatePath("/services"); revalidatePath("/programs","layout"); }
const failure = (message: string): ServerResult<never> => ({ ok:false,error:{ code:"VALIDATION_ERROR",message } });
export async function saveSpecialty(input: unknown): Promise<ServerResult<string>> {
  const auth=await authorizeActiveAdmin(); if(!auth.ok)return auth;
  const parsed=specialtySchema.safeParse(input);if(!parsed.success)return failure(parsed.error.issues[0]?.message ?? "Check specialty fields.");
  try {const db=await createClient();const {data,error}=await db.rpc("save_specialty",{payload:parsed.data});
    if(error||!data)return failure("Specialty not saved. Check its unique URL name and fields.");invalidate();return {ok:true,data};
  }catch{return failure("Unable to save specialty. Please retry.");}
}
export async function assignMaterial(input: unknown): Promise<ServerResult<null>> {
  const auth=await authorizeActiveAdmin();if(!auth.ok)return auth;
  const parsed=z.object({bankId:contentId,specialtyId:z.uuid().nullable()}).strict().safeParse(input);if(!parsed.success)return failure("Choose a material and specialty.");
  try {const db=await createClient();const {error}=await db.rpc("assign_bank_specialty",{bank_id:parsed.data.bankId,...(parsed.data.specialtyId ? {specialty_id:parsed.data.specialtyId} : {})});
    if(error)return failure("Assignment not saved.");invalidate();return {ok:true,data:null};
  }catch{return failure("Unable to save assignment.");}
}
export async function generateSharedExam(input: unknown): Promise<ServerResult<string>> {
  const auth=await authorizeActiveAdmin();if(!auth.ok)return auth;
  const parsed=generateSharedSchema.safeParse(input);if(!parsed.success)return failure(parsed.error.issues[0]?.message ?? "Check generation fields.");
  try{const db=await createClient();const {data,error}=await db.rpc("generate_shared_exam",{payload:parsed.data});
    if(error||!data)return failure("No exam generated. Check eligible questions, title and count.");invalidate();return {ok:true,data};
  }catch{return failure("Generation failed. Retry with the same request; it cannot duplicate the definition.");}
}
export async function saveSharedExam(input: unknown): Promise<ServerResult<null>> {
  const auth=await authorizeActiveAdmin();if(!auth.ok)return auth;
  const parsed=saveSharedSchema.safeParse(input);if(!parsed.success)return failure(parsed.error.issues[0]?.message ?? "Check definition fields.");
  try{const db=await createClient();const {error}=await db.rpc("save_shared_exam",{payload:parsed.data as Json});
    if(error)return failure("Definition not saved. Published exams are immutable; generate a new definition to change them.");invalidate();return {ok:true,data:null};
  }catch{return failure("Unable to save definition. Please retry.");}
}
