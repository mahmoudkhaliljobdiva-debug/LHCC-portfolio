import {notFound} from "next/navigation";
import {requireRole} from "@/lib/auth/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {AdminStudentSpecialtyForm} from "@/features/users/admin-student-specialty-form";
export default async function AdminStudentSpecialtyPage({params}:{params:Promise<{userId:string}>;}){
  await requireRole("ADMIN");
  const {userId}=await params;
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(userId))notFound();
  const db=createAdminClient();
  const [user,choices]=await Promise.all([
    db.from("profiles").select("id,full_name,specialty_id").eq("id",userId).eq("role","STUDENT").maybeSingle(),
    db.from("specialties").select("id,slug,name").in("slug",["dentistry","medical","nursing"]).eq("published",true).order("display_order"),
  ]);
  if(user.error || !user.data || choices.error || !choices.data)notFound();
  return <AdminStudentSpecialtyForm userId={user.data.id} fullName={user.data.full_name} current={user.data.specialty_id} specialties={choices.data}/>;
}
