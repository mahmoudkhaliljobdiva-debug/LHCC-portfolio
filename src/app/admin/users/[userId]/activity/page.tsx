import { StudentActivityPage } from "@/features/users/student-activity-page";
import { getStudentActivityData } from "@/lib/data/server";

export default async function UserActivityPage({ params }: { readonly params: Promise<{ userId: string }> }) { const { userId } = await params; return <StudentActivityPage data={await getStudentActivityData(userId)} />; }
