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
      aftersales_records: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_id: string
          customer_name: string
          customer_phone: string | null
          finance_application_id: string | null
          id: string
          notes: string | null
          sale_date: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_id: string
          customer_name: string
          customer_phone?: string | null
          finance_application_id?: string | null
          id?: string
          notes?: string | null
          sale_date?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_id?: string
          customer_name?: string
          customer_phone?: string | null
          finance_application_id?: string | null
          id?: string
          notes?: string | null
          sale_date?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aftersales_records_finance_application_id_fkey"
            columns: ["finance_application_id"]
            isOneToOne: false
            referencedRelation: "finance_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aftersales_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          page_path: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          page_path?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          page_path?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
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
      client_comments: {
        Row: {
          admin_id: string
          client_id: string
          content: string
          created_at: string | null
          id: string
        }
        Insert: {
          admin_id: string
          client_id: string
          content: string
          created_at?: string | null
          id?: string
        }
        Update: {
          admin_id?: string
          client_id?: string
          content?: string
          created_at?: string | null
          id?: string
        }
        Relationships: []
      }
      client_documents: {
        Row: {
          client_id: string
          file_path: string
          id: string
          name: string
          uploaded_at: string | null
        }
        Insert: {
          client_id: string
          file_path: string
          id?: string
          name: string
          uploaded_at?: string | null
        }
        Update: {
          client_id?: string
          file_path?: string
          id?: string
          name?: string
          uploaded_at?: string | null
        }
        Relationships: []
      }
      deal_records: {
        Row: {
          aftersales_expenses: Json | null
          application_id: string | null
          created_at: string | null
          delivery_address: string | null
          delivery_date: string | null
          id: string
          next_service_date: string | null
          next_service_km: number | null
          sales_rep_commission: number | null
          sales_rep_name: string | null
          sold_mileage: number | null
          sold_price: number | null
          vehicle_id: string | null
        }
        Insert: {
          aftersales_expenses?: Json | null
          application_id?: string | null
          created_at?: string | null
          delivery_address?: string | null
          delivery_date?: string | null
          id?: string
          next_service_date?: string | null
          next_service_km?: number | null
          sales_rep_commission?: number | null
          sales_rep_name?: string | null
          sold_mileage?: number | null
          sold_price?: number | null
          vehicle_id?: string | null
        }
        Update: {
          aftersales_expenses?: Json | null
          application_id?: string | null
          created_at?: string | null
          delivery_address?: string | null
          delivery_date?: string | null
          id?: string
          next_service_date?: string | null
          next_service_km?: number | null
          sales_rep_commission?: number | null
          sales_rep_name?: string | null
          sold_mileage?: number | null
          sold_price?: number | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_records_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "finance_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_records_vehicle_id_fkey"
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
          approved_budget: number | null
          area_code: string | null
          bank_name: string | null
          buyer_type: string | null
          created_at: string
          credit_score_status: string | null
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
          has_drivers_license: boolean | null
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
          selected_vehicle_id: string | null
          signature_url: string | null
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
          approved_budget?: number | null
          area_code?: string | null
          bank_name?: string | null
          buyer_type?: string | null
          created_at?: string
          credit_score_status?: string | null
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
          has_drivers_license?: boolean | null
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
          selected_vehicle_id?: string | null
          signature_url?: string | null
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
          approved_budget?: number | null
          area_code?: string | null
          bank_name?: string | null
          buyer_type?: string | null
          created_at?: string
          credit_score_status?: string | null
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
          has_drivers_license?: boolean | null
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
          selected_vehicle_id?: string | null
          signature_url?: string | null
          source_of_funds?: string | null
          status?: string
          street_address?: string | null
          updated_at?: string
          user_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_applications_selected_vehicle_id_fkey"
            columns: ["selected_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_applications_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_offers: {
        Row: {
          admin_fee: number | null
          application_id: string
          balloon_amount: number | null
          bank_name: string
          cash_price: number | null
          created_at: string
          delivery_fee: number | null
          id: string
          initiation_fee: number | null
          instalment_fixed: number | null
          instalment_linked: number | null
          interest_rate_fixed: number | null
          interest_rate_linked: number | null
          license_fee: number | null
          principal_debt: number | null
          status: string
          total_fees: number | null
          updated_at: string
          vap_amount: number | null
        }
        Insert: {
          admin_fee?: number | null
          application_id: string
          balloon_amount?: number | null
          bank_name: string
          cash_price?: number | null
          created_at?: string
          delivery_fee?: number | null
          id?: string
          initiation_fee?: number | null
          instalment_fixed?: number | null
          instalment_linked?: number | null
          interest_rate_fixed?: number | null
          interest_rate_linked?: number | null
          license_fee?: number | null
          principal_debt?: number | null
          status?: string
          total_fees?: number | null
          updated_at?: string
          vap_amount?: number | null
        }
        Update: {
          admin_fee?: number | null
          application_id?: string
          balloon_amount?: number | null
          bank_name?: string
          cash_price?: number | null
          created_at?: string
          delivery_fee?: number | null
          id?: string
          initiation_fee?: number | null
          instalment_fixed?: number | null
          instalment_linked?: number | null
          interest_rate_fixed?: number | null
          interest_rate_linked?: number | null
          license_fee?: number | null
          principal_debt?: number | null
          status?: string
          total_fees?: number | null
          updated_at?: string
          vap_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_offers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "finance_applications"
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
          finance_email: string
          hero_headline: string
          hero_subheadline: string
          id: string
          instagram_url: string
          is_maintenance_mode: boolean
          max_balloon_percent: number
          max_interest: number | null
          min_balloon_percent: number
          min_deposit_percent: number | null
          min_interest: number | null
          physical_address: string | null
          primary_email: string
          primary_phone: string
          sales_reps: Json | null
          secondary_phone: string | null
          show_finance_tab: boolean
          show_physical_location: boolean
          tiktok_url: string
          updated_at: string
          whatsapp_number: string
        }
        Insert: {
          contact_email?: string
          contact_phone?: string
          created_at?: string
          default_interest_rate?: number
          facebook_url?: string
          finance_email?: string
          hero_headline?: string
          hero_subheadline?: string
          id?: string
          instagram_url?: string
          is_maintenance_mode?: boolean
          max_balloon_percent?: number
          max_interest?: number | null
          min_balloon_percent?: number
          min_deposit_percent?: number | null
          min_interest?: number | null
          physical_address?: string | null
          primary_email?: string
          primary_phone?: string
          sales_reps?: Json | null
          secondary_phone?: string | null
          show_finance_tab?: boolean
          show_physical_location?: boolean
          tiktok_url?: string
          updated_at?: string
          whatsapp_number?: string
        }
        Update: {
          contact_email?: string
          contact_phone?: string
          created_at?: string
          default_interest_rate?: number
          facebook_url?: string
          finance_email?: string
          hero_headline?: string
          hero_subheadline?: string
          id?: string
          instagram_url?: string
          is_maintenance_mode?: boolean
          max_balloon_percent?: number
          max_interest?: number | null
          min_balloon_percent?: number
          min_deposit_percent?: number | null
          min_interest?: number | null
          physical_address?: string | null
          primary_email?: string
          primary_phone?: string
          sales_reps?: Json | null
          secondary_phone?: string | null
          show_finance_tab?: boolean
          show_physical_location?: boolean
          tiktok_url?: string
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
          estimated_profit: number | null
          finance_available: boolean | null
          fuel_type: string
          id: string
          images: string[] | null
          is_featured: boolean | null
          is_generic_listing: boolean | null
          make: string
          mileage: number
          model: string
          price: number
          purchase_price: number | null
          reconditioning_cost: number | null
          service_history: string | null
          sourced_count: number | null
          status: string
          stock_number: string | null
          transmission: string
          updated_at: string
          variant: string | null
          variants: Json | null
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
          estimated_profit?: number | null
          finance_available?: boolean | null
          fuel_type: string
          id?: string
          images?: string[] | null
          is_featured?: boolean | null
          is_generic_listing?: boolean | null
          make: string
          mileage: number
          model: string
          price: number
          purchase_price?: number | null
          reconditioning_cost?: number | null
          service_history?: string | null
          sourced_count?: number | null
          status?: string
          stock_number?: string | null
          transmission: string
          updated_at?: string
          variant?: string | null
          variants?: Json | null
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
          estimated_profit?: number | null
          finance_available?: boolean | null
          fuel_type?: string
          id?: string
          images?: string[] | null
          is_featured?: boolean | null
          is_generic_listing?: boolean | null
          make?: string
          mileage?: number
          model?: string
          price?: number
          purchase_price?: number | null
          reconditioning_cost?: number | null
          service_history?: string | null
          sourced_count?: number | null
          status?: string
          stock_number?: string | null
          transmission?: string
          updated_at?: string
          variant?: string | null
          variants?: Json | null
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
