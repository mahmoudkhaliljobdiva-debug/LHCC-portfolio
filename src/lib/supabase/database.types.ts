// Synchronized with the connected Supabase project after the profile
// demographics migration. The nullable RPC argument reflects PostgreSQL runtime behavior.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          activation_months: number | null;
          activation_start: string | null;
          age: number | null;
          avatar_url: string | null;
          created_at: string;
          created_by: string | null;
          deactivated_at: string | null;
          expiration_date: string | null;
          full_name: string;
          gender: Database["public"]["Enums"]["profile_gender"] | null;
          home_address: string | null;
          id: string;
          phone: string | null;
          role: Database["public"]["Enums"]["user_role"];
          reactivated_at: string | null;
          status: Database["public"]["Enums"]["user_status"];
          updated_at: string;
        };
        Insert: {
          activation_months?: number | null;
          activation_start?: string | null;
          age?: number | null;
          avatar_url?: string | null;
          created_at?: string;
          created_by?: string | null;
          deactivated_at?: string | null;
          expiration_date?: string | null;
          full_name: string;
          gender?: Database["public"]["Enums"]["profile_gender"] | null;
          home_address?: string | null;
          id: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          reactivated_at?: string | null;
          status?: Database["public"]["Enums"]["user_status"];
          updated_at?: string;
        };
        Update: {
          activation_months?: number | null;
          activation_start?: string | null;
          age?: number | null;
          avatar_url?: string | null;
          created_at?: string;
          created_by?: string | null;
          deactivated_at?: string | null;
          expiration_date?: string | null;
          full_name?: string;
          gender?: Database["public"]["Enums"]["profile_gender"] | null;
          home_address?: string | null;
          id?: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          reactivated_at?: string | null;
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
      profile_gender: "MALE" | "FEMALE";
      user_role: "ADMIN" | "TEACHER" | "STUDENT";
      user_status: "ACTIVE" | "INACTIVE" | "EXPIRED";
    };
    CompositeTypes: Record<never, never>;
  };
}
