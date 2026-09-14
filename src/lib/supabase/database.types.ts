export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bank_questions: {
        Row: {
          created_at: string
          id: string
          options: Json
          question_bank_id: string
          status: string
          text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          options: Json
          question_bank_id: string
          status?: string
          text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          options?: Json
          question_bank_id?: string
          status?: string
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_questions_question_bank_id_fkey"
            columns: ["question_bank_id"]
            isOneToOne: false
            referencedRelation: "question_banks"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_content: {
        Row: {
          content: Json
          created_at: string
          default_content: Json
          published: boolean
          revision: number
          section_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content: Json
          created_at?: string
          default_content: Json
          published?: boolean
          revision?: number
          section_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: Json
          created_at?: string
          default_content?: Json
          published?: boolean
          revision?: number
          section_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_content_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activation_months: number | null
          activation_start: string | null
          age: number | null
          avatar_url: string | null
          country_code: string | null
          created_at: string
          created_by: string | null
          deactivated_at: string | null
          expiration_date: string | null
          full_name: string
          gender: Database["public"]["Enums"]["profile_gender"] | null
          home_address: string | null
          id: string
          phone: string | null
          reactivated_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          activation_months?: number | null
          activation_start?: string | null
          age?: number | null
          avatar_url?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          expiration_date?: string | null
          full_name: string
          gender?: Database["public"]["Enums"]["profile_gender"] | null
          home_address?: string | null
          id: string
          phone?: string | null
          reactivated_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          activation_months?: number | null
          activation_start?: string | null
          age?: number | null
          avatar_url?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          deactivated_at?: string | null
          expiration_date?: string | null
          full_name?: string
          gender?: Database["public"]["Enums"]["profile_gender"] | null
          home_address?: string | null
          id?: string
          phone?: string | null
          reactivated_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: []
      }
      question_attempt_answers: {
        Row: {
          answered_at: string
          attempt_id: string
          created_at: string
          id: string
          is_correct: boolean
          question_id: string
          selected_option_id: string
        }
        Insert: {
          answered_at?: string
          attempt_id: string
          created_at?: string
          id?: string
          is_correct: boolean
          question_id: string
          selected_option_id: string
        }
        Update: {
          answered_at?: string
          attempt_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          selected_option_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_attempt_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "question_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_attempt_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "bank_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_attempts: {
        Row: {
          correct_answers: number
          created_at: string
          id: string
          incorrect_answers: number
          question_bank_id: string
          score_percentage: number
          started_at: string
          status: string
          student_id: string
          submitted_at: string | null
          total_questions: number
          updated_at: string
        }
        Insert: {
          correct_answers?: number
          created_at?: string
          id?: string
          incorrect_answers?: number
          question_bank_id: string
          score_percentage?: number
          started_at?: string
          status?: string
          student_id: string
          submitted_at?: string | null
          total_questions: number
          updated_at?: string
        }
        Update: {
          correct_answers?: number
          created_at?: string
          id?: string
          incorrect_answers?: number
          question_bank_id?: string
          score_percentage?: number
          started_at?: string
          status?: string
          student_id?: string
          submitted_at?: string | null
          total_questions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_attempts_question_bank_id_fkey"
            columns: ["question_bank_id"]
            isOneToOne: false
            referencedRelation: "question_banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      question_banks: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          display_order: number
          id: string
          image_url: string | null
          name: string
          price: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          display_order?: number
          id?: string
          image_url?: string | null
          name: string
          price?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          display_order?: number
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_banks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_bank_access: {
        Row: {
          created_at: string
          granted_at: string
          granted_by: string
          id: string
          price: number
          question_bank_id: string
          request_id: string | null
          revoked_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_at?: string
          granted_by: string
          id?: string
          price?: number
          question_bank_id: string
          request_id?: string | null
          revoked_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_at?: string
          granted_by?: string
          id?: string
          price?: number
          question_bank_id?: string
          request_id?: string | null
          revoked_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_bank_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_bank_access_question_bank_id_fkey"
            columns: ["question_bank_id"]
            isOneToOne: false
            referencedRelation: "question_banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_bank_access_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "user_bank_access_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_bank_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_bank_access_requests: {
        Row: {
          created_at: string
          id: string
          question_bank_id: string
          rejection_reason: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          question_bank_id: string
          rejection_reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          question_bank_id?: string
          rejection_reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_bank_access_requests_question_bank_id_fkey"
            columns: ["question_bank_id"]
            isOneToOne: false
            referencedRelation: "question_banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_bank_access_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_bank_access_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          question_bank_id: string | null
          transaction_date: string
          transaction_type: string
          updated_at: string
          user_bank_access_id: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          question_bank_id?: string | null
          transaction_date?: string
          transaction_type: string
          updated_at?: string
          user_bank_access_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          question_bank_id?: string | null
          transaction_date?: string
          transaction_type?: string
          updated_at?: string
          user_bank_access_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_question_bank_id_fkey"
            columns: ["question_bank_id"]
            isOneToOne: false
            referencedRelation: "question_banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_user_bank_access_id_fkey"
            columns: ["user_bank_access_id"]
            isOneToOne: false
            referencedRelation: "user_bank_access"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_bank_data: { Args: never; Returns: Json }
      admin_wallet_data: { Args: never; Returns: Json }
      is_profile_access_active: {
        Args: {
          profile_expiration_date: string
          profile_role: Database["public"]["Enums"]["user_role"]
          profile_status: Database["public"]["Enums"]["user_status"]
        }
        Returns: boolean
      }
      list_bank_access_requests: { Args: never; Returns: Json }
      manage_bank_content: {
        Args: { item_id: string; operation: string; payload?: Json }
        Returns: undefined
      }
      manage_wallet_transaction: {
        Args: { item_id: string; operation: string; payload?: Json }
        Returns: undefined
      }
      request_bank_access: { Args: { bank_id: string }; Returns: string }
      reset_portfolio_content: { Args: never; Returns: undefined }
      review_bank_access: {
        Args: { decision: string; reason?: string; request_id: string }
        Returns: undefined
      }
      save_portfolio_content: { Args: { payload: Json }; Returns: undefined }
      submit_bank_answer: {
        Args: { option_id: string; question_id: string }
        Returns: Json
      }
    }
    Enums: {
      profile_gender: "MALE" | "FEMALE"
      user_role: "ADMIN" | "TEACHER" | "STUDENT"
      user_status: "ACTIVE" | "INACTIVE" | "EXPIRED"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      profile_gender: ["MALE", "FEMALE"],
      user_role: ["ADMIN", "TEACHER", "STUDENT"],
      user_status: ["ACTIVE", "INACTIVE", "EXPIRED"],
    },
  },
} as const
