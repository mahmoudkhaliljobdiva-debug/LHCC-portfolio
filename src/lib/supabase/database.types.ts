// Temporary Phase 1 type surface matching the initial profiles migration.
// Replace this file with Supabase CLI-generated types after linking a project.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          activation_months: number | null;
          activation_start: string | null;
          avatar_url: string | null;
          created_at: string;
          expiration_date: string | null;
          full_name: string;
          id: string;
          phone: string | null;
          role: Database["public"]["Enums"]["user_role"];
          status: Database["public"]["Enums"]["user_status"];
          updated_at: string;
        };
        Insert: {
          activation_months?: number | null;
          activation_start?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          expiration_date?: string | null;
          full_name: string;
          id: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          status?: Database["public"]["Enums"]["user_status"];
          updated_at?: string;
        };
        Update: {
          activation_months?: number | null;
          activation_start?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          expiration_date?: string | null;
          full_name?: string;
          id?: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          status?: Database["public"]["Enums"]["user_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      is_profile_access_active: {
        Args: {
          profile_expiration_date: string | null;
          profile_role: Database["public"]["Enums"]["user_role"];
          profile_status: Database["public"]["Enums"]["user_status"];
        };
        Returns: boolean;
      };
    };
    Enums: {
      user_role: "ADMIN" | "TEACHER" | "STUDENT";
      user_status: "ACTIVE" | "INACTIVE" | "EXPIRED";
    };
    CompositeTypes: Record<never, never>;
  };
}
