import type { ManagedUserRole, PlatformUserInput } from "@/types/user-management";

export interface UserIdInput {
  readonly userId: string;
}

export interface UpdateManagedUserInput extends PlatformUserInput {
  readonly userId: string;
}

export interface ReactivateTeacherInput extends UserIdInput {
  readonly activationMonths: number;
}

export interface ManagedUserActionData {
  readonly userId: string;
  readonly role: ManagedUserRole;
}
