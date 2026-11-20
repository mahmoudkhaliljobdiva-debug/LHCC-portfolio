export const USER_ROLES = ["student", "teacher", "admin"] as const;

export type UserRole = (typeof USER_ROLES)[number];

