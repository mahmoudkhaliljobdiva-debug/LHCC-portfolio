import { StudentActivityPage } from "@/features/users/student-activity-page";

export default async function UserActivityPage({ params }: { readonly params: Promise<{ userId: string }> }) { const { userId } = await params; return <StudentActivityPage userId={userId} />; }
