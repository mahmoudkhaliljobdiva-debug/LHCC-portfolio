import { getAdminCatalog } from "@/lib/learning/server";
import { AdminSpecialties } from "@/features/learning/admin-specialties";
export default async function Page() {return <AdminSpecialties {...await getAdminCatalog()}/>;}
