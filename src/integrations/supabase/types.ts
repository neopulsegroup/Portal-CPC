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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      companies: {
        Row: {
          company_name: string
          created_at: string
          description: string | null
          id: string
          location: string | null
          nif: string | null
          sector: string | null
          updated_at: string
          user_id: string
          verified: boolean | null
          website: string | null
        }
        Insert: {
          company_name: string
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          nif?: string | null
          sector?: string | null
          updated_at?: string
          user_id: string
          verified?: boolean | null
          website?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          nif?: string | null
          sector?: string | null
          updated_at?: string
          user_id?: string
          verified?: boolean | null
          website?: string | null
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          applicant_id: string
          cover_letter: string | null
          created_at: string
          id: string
          job_id: string
          status: Database["public"]["Enums"]["application_status"] | null
          updated_at: string
        }
        Insert: {
          applicant_id: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          job_id: string
          status?: Database["public"]["Enums"]["application_status"] | null
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          job_id?: string
          status?: Database["public"]["Enums"]["application_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      job_offers: {
        Row: {
          applications_count: number | null
          company_id: string
          contract_type: string | null
          created_at: string
          description: string | null
          id: string
          location: string | null
          requirements: string | null
          salary_range: string | null
          sector: string | null
          status: Database["public"]["Enums"]["job_status"] | null
          title: string
          updated_at: string
        }
        Insert: {
          applications_count?: number | null
          company_id: string
          contract_type?: string | null
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          requirements?: string | null
          salary_range?: string | null
          sector?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
          title: string
          updated_at?: string
        }
        Update: {
          applications_count?: number | null
          company_id?: string
          contract_type?: string | null
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          requirements?: string | null
          salary_range?: string | null
          sector?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_offers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          created_at: string
          id: string
          migrant_id: string
          notes: string | null
          professional_id: string | null
          scheduled_date: string
          scheduled_time: string
          session_type: string
          status: Database["public"]["Enums"]["session_status"] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          migrant_id: string
          notes?: string | null
          professional_id?: string | null
          scheduled_date: string
          scheduled_time: string
          session_type: string
          status?: Database["public"]["Enums"]["session_status"] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          migrant_id?: string
          notes?: string | null
          professional_id?: string | null
          scheduled_date?: string
          scheduled_time?: string
          session_type?: string
          status?: Database["public"]["Enums"]["session_status"] | null
          updated_at?: string
        }
        Relationships: []
      }
      trail_modules: {
        Row: {
          content_text: string | null
          content_type: string
          content_url: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          order_index: number
          title: string
          trail_id: string
        }
        Insert: {
          content_text?: string | null
          content_type: string
          content_url?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          order_index: number
          title: string
          trail_id: string
        }
        Update: {
          content_text?: string | null
          content_type?: string
          content_url?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          order_index?: number
          title?: string
          trail_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trail_modules_trail_id_fkey"
            columns: ["trail_id"]
            isOneToOne: false
            referencedRelation: "trails"
            referencedColumns: ["id"]
          },
        ]
      }
      trails: {
        Row: {
          category: string
          created_at: string
          description: string | null
          difficulty: string | null
          duration_minutes: number | null
          id: string
          is_active: boolean | null
          modules_count: number | null
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          difficulty?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          modules_count?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          difficulty?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          modules_count?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      triage: {
        Row: {
          answers: Json | null
          completed: boolean | null
          completed_at: string | null
          created_at: string
          housing_status: Database["public"]["Enums"]["housing_status"] | null
          id: string
          interests: string[] | null
          language_level: Database["public"]["Enums"]["language_level"] | null
          legal_status: Database["public"]["Enums"]["legal_status"] | null
          updated_at: string
          urgencies: string[] | null
          user_id: string
          work_status: Database["public"]["Enums"]["work_status"] | null
        }
        Insert: {
          answers?: Json | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          housing_status?: Database["public"]["Enums"]["housing_status"] | null
          id?: string
          interests?: string[] | null
          language_level?: Database["public"]["Enums"]["language_level"] | null
          legal_status?: Database["public"]["Enums"]["legal_status"] | null
          updated_at?: string
          urgencies?: string[] | null
          user_id: string
          work_status?: Database["public"]["Enums"]["work_status"] | null
        }
        Update: {
          answers?: Json | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          housing_status?: Database["public"]["Enums"]["housing_status"] | null
          id?: string
          interests?: string[] | null
          language_level?: Database["public"]["Enums"]["language_level"] | null
          legal_status?: Database["public"]["Enums"]["legal_status"] | null
          updated_at?: string
          urgencies?: string[] | null
          user_id?: string
          work_status?: Database["public"]["Enums"]["work_status"] | null
        }
        Relationships: []
      }
      user_trail_progress: {
        Row: {
          completed_at: string | null
          id: string
          modules_completed: number | null
          progress_percent: number | null
          started_at: string
          trail_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          modules_completed?: number | null
          progress_percent?: number | null
          started_at?: string
          trail_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          modules_completed?: number | null
          progress_percent?: number | null
          started_at?: string
          trail_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_trail_progress_trail_id_fkey"
            columns: ["trail_id"]
            isOneToOne: false
            referencedRelation: "trails"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      application_status:
        | "submitted"
        | "viewed"
        | "interview"
        | "accepted"
        | "rejected"
      housing_status: "stable" | "temporary" | "precarious" | "homeless"
      job_status: "active" | "paused" | "closed" | "pending_review"
      language_level: "native" | "advanced" | "intermediate" | "basic" | "none"
      legal_status: "regularized" | "pending" | "not_regularized" | "refugee"
      session_status: "pending" | "confirmed" | "completed" | "cancelled"
      user_role:
        | "migrant"
        | "company"
        | "mediator"
        | "lawyer"
        | "psychologist"
        | "manager"
        | "coordinator"
        | "admin"
      work_status:
        | "employed"
        | "unemployed_seeking"
        | "unemployed_not_seeking"
        | "student"
        | "self_employed"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      application_status: [
        "submitted",
        "viewed",
        "interview",
        "accepted",
        "rejected",
      ],
      housing_status: ["stable", "temporary", "precarious", "homeless"],
      job_status: ["active", "paused", "closed", "pending_review"],
      language_level: ["native", "advanced", "intermediate", "basic", "none"],
      legal_status: ["regularized", "pending", "not_regularized", "refugee"],
      session_status: ["pending", "confirmed", "completed", "cancelled"],
      user_role: [
        "migrant",
        "company",
        "mediator",
        "lawyer",
        "psychologist",
        "manager",
        "coordinator",
        "admin",
      ],
      work_status: [
        "employed",
        "unemployed_seeking",
        "unemployed_not_seeking",
        "student",
        "self_employed",
      ],
    },
  },
} as const
