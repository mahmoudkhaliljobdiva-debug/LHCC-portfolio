import type { Database } from "@/lib/supabase/database.types";

export type UserRole = Database["public"]["Enums"]["user_role"];
export type UserStatus = Database["public"]["Enums"]["user_status"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
