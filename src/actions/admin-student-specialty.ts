"use server";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {requireRole} from "@/lib/auth/server";
import {createClient} from "@/lib/supabase/server";
import type {ServerResult} from "@/types/server-result";
const schema=z.object({userId:z.uuid(),specialty:z.enum(["dentistry","medical","nursing"])}).strict();
export async function setAdminStudentSpecialty(input:unknown):Promise<ServerResult<string>>{
  await requireRole("ADMIN");
  const parsed=schema.safeParse(input);
  if(!parsed.success)return {ok:false,error:{code:"VALIDATION_ERROR",message:"Choose a valid student and specialty."}};
  const {data,error}=await (await createClient()).rpc("admin_set_student_specialty",{
    target_user:parsed.data.userId,selected_slug:parsed.data.specialty
  });
  if(error||!data)return {ok:false,error:{code:"FORBIDDEN",message:"Unable to assign specialty. Check the selected student."}};
  revalidatePath("/admin/users");
  revalidatePath("/admin/view-as","layout");
  return {ok:true,data:data as string};
}
