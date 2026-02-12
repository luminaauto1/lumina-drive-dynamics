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
          addons_data: Json | null
          aftersales_expenses: Json | null
          application_id: string | null
          bank_initiation_fee: number | null
          client_deposit: number | null
          cost_price: number | null
          created_at: string | null
          dealer_deposit_contribution: number | null
          delivery_address: string | null
          delivery_date: string | null
          delivery_photos: string[] | null
          dic_amount: number | null
          discount_amount: number | null
          external_admin_fee: number | null
          gross_profit: number | null
          id: string
          is_shared_capital: boolean | null
          next_service_date: string | null
          next_service_km: number | null
          partner_capital_contribution: number | null
          partner_profit_amount: number | null
          partner_split_percent: number | null
          partner_split_type: string | null
          partner_split_value: number | null
          recon_cost: number | null
          referral_commission_amount: number | null
          referral_income_amount: number | null
          referral_person_name: string | null
          sale_date: string | null
          sales_rep_commission: number | null
          sales_rep_name: string | null
          sold_mileage: number | null
          sold_price: number | null
          total_financed_amount: number | null
          vehicle_id: string | null
        }
        Insert: {
          addons_data?: Json | null
          aftersales_expenses?: Json | null
          application_id?: string | null
          bank_initiation_fee?: number | null
          client_deposit?: number | null
          cost_price?: number | null
          created_at?: string | null
          dealer_deposit_contribution?: number | null
          delivery_address?: string | null
          delivery_date?: string | null
          delivery_photos?: string[] | null
          dic_amount?: number | null
          discount_amount?: number | null
          external_admin_fee?: number | null
          gross_profit?: number | null
          id?: string
          is_shared_capital?: boolean | null
          next_service_date?: string | null
          next_service_km?: number | null
          partner_capital_contribution?: number | null
          partner_profit_amount?: number | null
          partner_split_percent?: number | null
          partner_split_type?: string | null
          partner_split_value?: number | null
          recon_cost?: number | null
          referral_commission_amount?: number | null
          referral_income_amount?: number | null
          referral_person_name?: string | null
          sale_date?: string | null
          sales_rep_commission?: number | null
          sales_rep_name?: string | null
          sold_mileage?: number | null
          sold_price?: number | null
          total_financed_amount?: number | null
          vehicle_id?: string | null
        }
        Update: {
          addons_data?: Json | null
          aftersales_expenses?: Json | null
          application_id?: string | null
          bank_initiation_fee?: number | null
          client_deposit?: number | null
          cost_price?: number | null
          created_at?: string | null
          dealer_deposit_contribution?: number | null
          delivery_address?: string | null
          delivery_date?: string | null
          delivery_photos?: string[] | null
          dic_amount?: number | null
          discount_amount?: number | null
          external_admin_fee?: number | null
          gross_profit?: number | null
          id?: string
          is_shared_capital?: boolean | null
          next_service_date?: string | null
          next_service_km?: number | null
          partner_capital_contribution?: number | null
          partner_profit_amount?: number | null
          partner_split_percent?: number | null
          partner_split_type?: string | null
          partner_split_value?: number | null
          recon_cost?: number | null
          referral_commission_amount?: number | null
          referral_income_amount?: number | null
          referral_person_name?: string | null
          sale_date?: string | null
          sales_rep_commission?: number | null
          sales_rep_name?: string | null
          sold_mileage?: number | null
          sold_price?: number | null
          total_financed_amount?: number | null
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
      delivery_tasks: {
        Row: {
          application_id: string
          completed_at: string | null
          created_at: string | null
          id: string
          is_completed: boolean | null
          task_name: string
        }
        Insert: {
          application_id: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          task_name: string
        }
        Update: {
          application_id?: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          task_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_tasks_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "finance_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_content: string
          created_at: string
          cta_text: string | null
          cta_url: string | null
          heading: string
          id: string
          is_active: boolean | null
          status_key: string
          subject: string
          updated_at: string
        }
        Insert: {
          body_content: string
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          heading: string
          id?: string
          is_active?: boolean | null
          status_key: string
          subject: string
          updated_at?: string
        }
        Update: {
          body_content?: string
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          heading?: string
          id?: string
          is_active?: boolean | null
          status_key?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      extra_service_incomes: {
        Row: {
          category: string
          cost_price: number | null
          created_at: string | null
          description: string
          id: string
          provider_name: string | null
          selling_price: number | null
          status: string | null
          transaction_date: string | null
        }
        Insert: {
          category: string
          cost_price?: number | null
          created_at?: string | null
          description: string
          id?: string
          provider_name?: string | null
          selling_price?: number | null
          status?: string | null
          transaction_date?: string | null
        }
        Update: {
          category?: string
          cost_price?: number | null
          created_at?: string | null
          description?: string
          id?: string
          provider_name?: string | null
          selling_price?: number | null
          status?: string | null
          transaction_date?: string | null
        }
        Relationships: []
      }
      finance_applications: {
        Row: {
          access_token: string | null
          account_number: string | null
          account_type: string | null
          additional_income: number | null
          approved_budget: number | null
          area_code: string | null
          bank_name: string | null
          buyer_type: string | null
          contract_bank_name: string | null
          contract_url: string | null
          created_at: string
          credit_score_status: string | null
          deal_type: string | null
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
          internal_status: string | null
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
          access_token?: string | null
          account_number?: string | null
          account_type?: string | null
          additional_income?: number | null
          approved_budget?: number | null
          area_code?: string | null
          bank_name?: string | null
          buyer_type?: string | null
          contract_bank_name?: string | null
          contract_url?: string | null
          created_at?: string
          credit_score_status?: string | null
          deal_type?: string | null
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
          internal_status?: string | null
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
          access_token?: string | null
          account_number?: string | null
          account_type?: string | null
          additional_income?: number | null
          approved_budget?: number | null
          area_code?: string | null
          bank_name?: string | null
          buyer_type?: string | null
          contract_bank_name?: string | null
          contract_url?: string | null
          created_at?: string
          credit_score_status?: string | null
          deal_type?: string | null
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
          internal_status?: string | null
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
      finance_banks: {
        Row: {
          created_at: string | null
          id: string
          name: string
          signing_url: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          signing_url?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          signing_url?: string | null
        }
        Relationships: []
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
      lead_notes: {
        Row: {
          admin_id: string
          content: string
          created_at: string | null
          id: string
          profile_id: string
        }
        Insert: {
          admin_id: string
          content: string
          created_at?: string | null
          id?: string
          profile_id: string
        }
        Update: {
          admin_id?: string
          content?: string
          created_at?: string | null
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          activity_log: Json | null
          admin_last_viewed_at: string | null
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string
          deal_headline: string | null
          desired_deposit: number | null
          desired_term: number | null
          id: string
          id_number: string | null
          is_archived: boolean | null
          last_activity_at: string | null
          lead_score: number | null
          lead_temperature: string | null
          next_action_date: string | null
          next_action_note: string | null
          next_follow_up: string | null
          notes: string | null
          pipeline_stage: string | null
          source: string
          status: string
          status_updated_at: string | null
          trade_in_estimated_value: number | null
          trade_in_make_model: string | null
          trade_in_mileage: number | null
          trade_in_year: number | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          activity_log?: Json | null
          admin_last_viewed_at?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          deal_headline?: string | null
          desired_deposit?: number | null
          desired_term?: number | null
          id?: string
          id_number?: string | null
          is_archived?: boolean | null
          last_activity_at?: string | null
          lead_score?: number | null
          lead_temperature?: string | null
          next_action_date?: string | null
          next_action_note?: string | null
          next_follow_up?: string | null
          notes?: string | null
          pipeline_stage?: string | null
          source?: string
          status?: string
          status_updated_at?: string | null
          trade_in_estimated_value?: number | null
          trade_in_make_model?: string | null
          trade_in_mileage?: number | null
          trade_in_year?: number | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          activity_log?: Json | null
          admin_last_viewed_at?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          deal_headline?: string | null
          desired_deposit?: number | null
          desired_term?: number | null
          id?: string
          id_number?: string | null
          is_archived?: boolean | null
          last_activity_at?: string | null
          lead_score?: number | null
          lead_temperature?: string | null
          next_action_date?: string | null
          next_action_note?: string | null
          next_follow_up?: string | null
          notes?: string | null
          pipeline_stage?: string | null
          source?: string
          status?: string
          status_updated_at?: string | null
          trade_in_estimated_value?: number | null
          trade_in_make_model?: string | null
          trade_in_mileage?: number | null
          trade_in_year?: number | null
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
          admin_notes: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          internal_status: string | null
          last_active_at: string | null
          last_contacted_at: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          internal_status?: string | null
          last_active_at?: string | null
          last_contacted_at?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          internal_status?: string | null
          last_active_at?: string | null
          last_contacted_at?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rental_logs: {
        Row: {
          amount: number
          created_at: string | null
          description: string
          id: string
          log_date: string | null
          rental_id: string | null
          type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description: string
          id?: string
          log_date?: string | null
          rental_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string
          id?: string
          log_date?: string | null
          rental_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_logs_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      rentals: {
        Row: {
          created_at: string | null
          deposit_amount: number | null
          end_date: string | null
          id: string
          initial_recon_cost: number | null
          monthly_rent: number
          notes: string | null
          payment_day: number | null
          purchase_price: number | null
          registration_number: string
          renter_contact: string | null
          renter_id_number: string | null
          renter_name: string | null
          start_date: string | null
          status: string | null
          vehicle_make_model: string
          vin_number: string | null
        }
        Insert: {
          created_at?: string | null
          deposit_amount?: number | null
          end_date?: string | null
          id?: string
          initial_recon_cost?: number | null
          monthly_rent: number
          notes?: string | null
          payment_day?: number | null
          purchase_price?: number | null
          registration_number: string
          renter_contact?: string | null
          renter_id_number?: string | null
          renter_name?: string | null
          start_date?: string | null
          status?: string | null
          vehicle_make_model: string
          vin_number?: string | null
        }
        Update: {
          created_at?: string | null
          deposit_amount?: number | null
          end_date?: string | null
          id?: string
          initial_recon_cost?: number | null
          monthly_rent?: number
          notes?: string | null
          payment_day?: number | null
          purchase_price?: number | null
          registration_number?: string
          renter_contact?: string | null
          renter_id_number?: string | null
          renter_name?: string | null
          start_date?: string | null
          status?: string | null
          vehicle_make_model?: string
          vin_number?: string | null
        }
        Relationships: []
      }
      sell_car_requests: {
        Row: {
          admin_notes: string | null
          client_contact: string
          client_email: string | null
          client_name: string
          condition: string | null
          created_at: string | null
          desired_price: number | null
          id: string
          photos_urls: string[] | null
          status: string | null
          vehicle_make: string
          vehicle_mileage: number | null
          vehicle_model: string
          vehicle_year: number | null
        }
        Insert: {
          admin_notes?: string | null
          client_contact: string
          client_email?: string | null
          client_name: string
          condition?: string | null
          created_at?: string | null
          desired_price?: number | null
          id?: string
          photos_urls?: string[] | null
          status?: string | null
          vehicle_make: string
          vehicle_mileage?: number | null
          vehicle_model: string
          vehicle_year?: number | null
        }
        Update: {
          admin_notes?: string | null
          client_contact?: string
          client_email?: string | null
          client_name?: string
          condition?: string | null
          created_at?: string | null
          desired_price?: number | null
          id?: string
          photos_urls?: string[] | null
          status?: string | null
          vehicle_make?: string
          vehicle_mileage?: number | null
          vehicle_model?: string
          vehicle_year?: number | null
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
      vehicle_expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          date_incurred: string | null
          description: string
          id: string
          receipt_url: string | null
          vehicle_id: string
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          date_incurred?: string | null
          description: string
          id?: string
          receipt_url?: string | null
          vehicle_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          date_incurred?: string | null
          description?: string
          id?: string
          receipt_url?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          body_type: string | null
          color: string | null
          cost_price: number | null
          created_at: string
          description: string | null
          engine_code: string | null
          estimated_profit: number | null
          finance_available: boolean | null
          fsh_status: string | null
          fuel_type: string
          id: string
          images: string[] | null
          is_featured: boolean | null
          is_generic_listing: boolean | null
          last_service_date: string | null
          last_service_km: number | null
          make: string
          mileage: number
          model: string
          next_service_date: string | null
          next_service_km: number | null
          price: number
          purchase_price: number | null
          reconditioning_cost: number | null
          registration_number: string | null
          reserved_for_application_id: string | null
          service_history: string | null
          service_plan_expiry_date: string | null
          sourced_count: number | null
          spare_keys: boolean | null
          status: string
          stock_number: string | null
          transmission: string
          updated_at: string
          variant: string | null
          variants: Json | null
          vin: string | null
          warranty_expiry_date: string | null
          year: number
          youtube_url: string | null
        }
        Insert: {
          body_type?: string | null
          color?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          engine_code?: string | null
          estimated_profit?: number | null
          finance_available?: boolean | null
          fsh_status?: string | null
          fuel_type: string
          id?: string
          images?: string[] | null
          is_featured?: boolean | null
          is_generic_listing?: boolean | null
          last_service_date?: string | null
          last_service_km?: number | null
          make: string
          mileage: number
          model: string
          next_service_date?: string | null
          next_service_km?: number | null
          price: number
          purchase_price?: number | null
          reconditioning_cost?: number | null
          registration_number?: string | null
          reserved_for_application_id?: string | null
          service_history?: string | null
          service_plan_expiry_date?: string | null
          sourced_count?: number | null
          spare_keys?: boolean | null
          status?: string
          stock_number?: string | null
          transmission: string
          updated_at?: string
          variant?: string | null
          variants?: Json | null
          vin?: string | null
          warranty_expiry_date?: string | null
          year: number
          youtube_url?: string | null
        }
        Update: {
          body_type?: string | null
          color?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          engine_code?: string | null
          estimated_profit?: number | null
          finance_available?: boolean | null
          fsh_status?: string | null
          fuel_type?: string
          id?: string
          images?: string[] | null
          is_featured?: boolean | null
          is_generic_listing?: boolean | null
          last_service_date?: string | null
          last_service_km?: number | null
          make?: string
          mileage?: number
          model?: string
          next_service_date?: string | null
          next_service_km?: number | null
          price?: number
          purchase_price?: number | null
          reconditioning_cost?: number | null
          registration_number?: string | null
          reserved_for_application_id?: string | null
          service_history?: string | null
          service_plan_expiry_date?: string | null
          sourced_count?: number | null
          spare_keys?: boolean | null
          status?: string
          stock_number?: string | null
          transmission?: string
          updated_at?: string
          variant?: string | null
          variants?: Json | null
          vin?: string | null
          warranty_expiry_date?: string | null
          year?: number
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_reserved_for_application_id_fkey"
            columns: ["reserved_for_application_id"]
            isOneToOne: false
            referencedRelation: "finance_applications"
            referencedColumns: ["id"]
          },
        ]
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
