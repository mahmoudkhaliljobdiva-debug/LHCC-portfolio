import { redirect } from "next/navigation";
import { parsePreviewRole, requirePreviewAdmin } from "@/lib/portal-preview/server";

// Old bookmarks now use the single existing Users selection workflow.
export default async function PreviewSelectorRedirect({ params }: { readonly params: Promise<{ role: string }> }) {
  await requirePreviewAdmin();
  const role = parsePreviewRole((await params).role);
  redirect(`/admin/users?role=${role === "student" ? "STUDENT" : "TEACHER"}`);
}
