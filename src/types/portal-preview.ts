import type { Profile } from "@/types/profile";

export type PreviewRole = "student" | "teacher";
export interface PortalPreviewContext {
  readonly actor: Profile;
  readonly subject: Profile;
  readonly email: string;
  readonly role: PreviewRole;
}
