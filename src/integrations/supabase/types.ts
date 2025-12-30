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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      application_matches: {
        Row: {
          application_id: string
          created_at: string
          id: string
          notes: string | null
          vehicle_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          notes?: string | null
          vehicle_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_matches_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "finance_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_matches_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_applications: {
        Row: {
          account_number: string | null
          account_type: string | null
          area_code: string | null
          bank_name: string | null
          buyer_type: string | null
          created_at: string
          declined_reason: string | null
          deposit_amount: number | null
          email: string
          employer_name: string | null
          employment_period: string | null
          employment_status: string | null
          expenses_summary: string | null
          first_name: string | null
          full_name: string
          gender: string | null
          gross_salary: number | null
          id: string
          id_number: string | null
          job_title: string | null
          kin_contact: string | null
          kin_name: string | null
          last_name: string | null
          loan_term_months: number | null
          marital_status: string | null
          monthly_income: number | null
          net_salary: number | null
          notes: string | null
          phone: string
          popia_consent: boolean | null
          preferred_vehicle_text: string | null
          qualification: string | null
          source_of_funds: string | null
          status: string
          street_address: string | null
          updated_at: string
          user_id: string
          vehicle_id: string | null
        }
        Insert: {
          account_number?: string | null
          account_type?: string | null
          area_code?: string | null
          bank_name?: string | null
          buyer_type?: string | null
          created_at?: string
          declined_reason?: string | null
          deposit_amount?: number | null
          email: string
          employer_name?: string | null
          employment_period?: string | null
          employment_status?: string | null
          expenses_summary?: string | null
          first_name?: string | null
          full_name: string
          gender?: string | null
          gross_salary?: number | null
          id?: string
          id_number?: string | null
          job_title?: string | null
          kin_contact?: string | null
          kin_name?: string | null
          last_name?: string | null
          loan_term_months?: number | null
          marital_status?: string | null
          monthly_income?: number | null
          net_salary?: number | null
          notes?: string | null
          phone: string
          popia_consent?: boolean | null
          preferred_vehicle_text?: string | null
          qualification?: string | null
          source_of_funds?: string | null
          status?: string
          street_address?: string | null
          updated_at?: string
          user_id: string
          vehicle_id?: string | null
        }
        Update: {
          account_number?: string | null
          account_type?: string | null
          area_code?: string | null
          bank_name?: string | null
          buyer_type?: string | null
          created_at?: string
          declined_reason?: string | null
          deposit_amount?: number | null
          email?: string
          employer_name?: string | null
          employment_period?: string | null
          employment_status?: string | null
          expenses_summary?: string | null
          first_name?: string | null
          full_name?: string
          gender?: string | null
          gross_salary?: number | null
          id?: string
          id_number?: string | null
          job_title?: string | null
          kin_contact?: string | null
          kin_name?: string | null
          last_name?: string | null
          loan_term_months?: number | null
          marital_status?: string | null
          monthly_income?: number | null
          net_salary?: number | null
          notes?: string | null
          phone?: string
          popia_consent?: boolean | null
          preferred_vehicle_text?: string | null
          qualification?: string | null
          source_of_funds?: string | null
          status?: string
          street_address?: string | null
          updated_at?: string
          user_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_applications_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string
          id: string
          notes: string | null
          source: string
          status: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          source?: string
          status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          source?: string
          status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          contact_email: string
          contact_phone: string
          created_at: string
          default_interest_rate: number
          facebook_url: string
          hero_headline: string
          hero_subheadline: string
          id: string
          instagram_url: string
          is_maintenance_mode: boolean
          max_balloon_percent: number
          min_balloon_percent: number
          updated_at: string
          whatsapp_number: string
        }
        Insert: {
          contact_email?: string
          contact_phone?: string
          created_at?: string
          default_interest_rate?: number
          facebook_url?: string
          hero_headline?: string
          hero_subheadline?: string
          id?: string
          instagram_url?: string
          is_maintenance_mode?: boolean
          max_balloon_percent?: number
          min_balloon_percent?: number
          updated_at?: string
          whatsapp_number?: string
        }
        Update: {
          contact_email?: string
          contact_phone?: string
          created_at?: string
          default_interest_rate?: number
          facebook_url?: string
          hero_headline?: string
          hero_subheadline?: string
          id?: string
          instagram_url?: string
          is_maintenance_mode?: boolean
          max_balloon_percent?: number
          min_balloon_percent?: number
          updated_at?: string
          whatsapp_number?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          body_type: string | null
          color: string | null
          created_at: string
          description: string | null
          engine_code: string | null
          finance_available: boolean | null
          fuel_type: string
          id: string
          images: string[] | null
          is_generic_listing: boolean | null
          make: string
          mileage: number
          model: string
          price: number
          service_history: string | null
          status: string
          transmission: string
          updated_at: string
          variant: string | null
          vin: string | null
          year: number
          youtube_url: string | null
        }
        Insert: {
          body_type?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          engine_code?: string | null
          finance_available?: boolean | null
          fuel_type: string
          id?: string
          images?: string[] | null
          is_generic_listing?: boolean | null
          make: string
          mileage: number
          model: string
          price: number
          service_history?: string | null
          status?: string
          transmission: string
          updated_at?: string
          variant?: string | null
          vin?: string | null
          year: number
          youtube_url?: string | null
        }
        Update: {
          body_type?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          engine_code?: string | null
          finance_available?: boolean | null
          fuel_type?: string
          id?: string
          images?: string[] | null
          is_generic_listing?: boolean | null
          make?: string
          mileage?: number
          model?: string
          price?: number
          service_history?: string | null
          status?: string
          transmission?: string
          updated_at?: string
          variant?: string | null
          vin?: string | null
          year?: number
          youtube_url?: string | null
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          created_at: string
          id: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
