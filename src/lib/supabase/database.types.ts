// Application-facing contracts for profiles and the approved course-access migrations.
// Nullable RPC arguments reflect PostgreSQL runtime behavior.
import type { BankAccess, BankAccessRequest, CourseBank } from "@/types/bank-access";
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type ReadTable<T> = { Row: { [K in keyof T]: T[K] }; Insert: never; Update: never; Relationships: [] };

export interface Database {
  public: {
    Tables: {
      question_banks: ReadTable<CourseBank>;
      user_bank_access_requests: ReadTable<BankAccessRequest>;
      user_bank_access: ReadTable<BankAccess>;
      bank_questions: ReadTable<{ id: string; question_bank_id: string; text: string; status: string; options: Json; created_at: string; updated_at: string }>;
      profiles: {
        Row: {
          activation_months: number | null;
          activation_start: string | null;
          age: number | null;
          avatar_url: string | null;
          created_at: string;
          created_by: string | null;
          country_code: string | null;
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
          country_code?: string | null;
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
          country_code?: string | null;
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
      request_bank_access: { Args: { bank_id: string }; Returns: string };
      review_bank_access: { Args: { request_id: string; decision: string; reason?: string | null }; Returns: undefined };
      list_bank_access_requests: { Args: Record<string, never>; Returns: Json };
      submit_bank_answer: { Args: { question_id: string; option_id: string }; Returns: boolean };
      admin_bank_data: { Args: Record<string, never>; Returns: Json };
      manage_bank_content: { Args: { operation: string; item_id: string; payload?: Json }; Returns: undefined };
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
