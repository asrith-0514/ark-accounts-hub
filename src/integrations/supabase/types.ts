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
      activities: {
        Row: {
          at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          message: string
          type: string
          user_name: string
        }
        Insert: {
          at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message: string
          type: string
          user_name?: string
        }
        Update: {
          at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string
          type?: string
          user_name?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          after_data: Json | null
          at: string
          before_data: Json | null
          event: string
          id: string
          row_id: string | null
          table_name: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          after_data?: Json | null
          at?: string
          before_data?: Json | null
          event: string
          id?: string
          row_id?: string | null
          table_name: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          after_data?: Json | null
          at?: string
          before_data?: Json | null
          event?: string
          id?: string
          row_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      bill_documents: {
        Row: {
          bill_id: string
          created_at: string
          id: string
          mime_type: string
          name: string
          replaced_at: string | null
          size: number
          storage_path: string
          uploaded_by: string | null
          uploaded_by_name: string | null
        }
        Insert: {
          bill_id: string
          created_at?: string
          id?: string
          mime_type: string
          name: string
          replaced_at?: string | null
          size: number
          storage_path: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Update: {
          bill_id?: string
          created_at?: string
          id?: string
          mime_type?: string
          name?: string
          replaced_at?: string | null
          size?: number
          storage_path?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_documents_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_workflow_events: {
        Row: {
          at: string
          bill_id: string
          comment: string | null
          from_status: string | null
          id: string
          to_status: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          at?: string
          bill_id: string
          comment?: string | null
          from_status?: string | null
          id?: string
          to_status: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          at?: string
          bill_id?: string
          comment?: string | null
          from_status?: string | null
          id?: string
          to_status?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_workflow_events_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          cgst_amount: number | null
          created_at: string
          deleted_at: string | null
          discount: number
          due_date: string
          grand_total: number
          gst: number
          gst_rate: number
          gst_type: string
          id: string
          igst_amount: number | null
          invoice_date: string
          invoice_number: string
          other_charges: number
          remarks: string | null
          round_off: number
          sgst_amount: number | null
          status: string
          subtotal: number
          supplier_id: string
          taxable_value: number
          total: number
          updated_at: string
          workflow_status: string
        }
        Insert: {
          cgst_amount?: number | null
          created_at?: string
          deleted_at?: string | null
          discount?: number
          due_date: string
          grand_total: number
          gst?: number
          gst_rate?: number
          gst_type?: string
          id?: string
          igst_amount?: number | null
          invoice_date: string
          invoice_number: string
          other_charges?: number
          remarks?: string | null
          round_off?: number
          sgst_amount?: number | null
          status?: string
          subtotal?: number
          supplier_id: string
          taxable_value: number
          total?: number
          updated_at?: string
          workflow_status?: string
        }
        Update: {
          cgst_amount?: number | null
          created_at?: string
          deleted_at?: string | null
          discount?: number
          due_date?: string
          grand_total?: number
          gst?: number
          gst_rate?: number
          gst_type?: string
          id?: string
          igst_amount?: number | null
          invoice_date?: string
          invoice_number?: string
          other_charges?: number
          remarks?: string | null
          round_off?: number
          sgst_amount?: number | null
          status?: string
          subtotal?: number
          supplier_id?: string
          taxable_value?: number
          total?: number
          updated_at?: string
          workflow_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string
          city: string
          company_name: string
          company_state: string
          currency: string
          default_credit_days: number
          default_gst_rate: number
          email: string
          financial_year_start: number
          gst_number: string
          id: string
          invoice_prefix: string
          logo_data_url: string | null
          notification_channels: Json
          notify_overdue: boolean
          notify_today: boolean
          notify_tomorrow: boolean
          owner_name: string
          pan_number: string
          phone: string
          reminder_days: Json
          theme: string
          updated_at: string
        }
        Insert: {
          address?: string
          city?: string
          company_name?: string
          company_state?: string
          currency?: string
          default_credit_days?: number
          default_gst_rate?: number
          email?: string
          financial_year_start?: number
          gst_number?: string
          id?: string
          invoice_prefix?: string
          logo_data_url?: string | null
          notification_channels?: Json
          notify_overdue?: boolean
          notify_today?: boolean
          notify_tomorrow?: boolean
          owner_name?: string
          pan_number?: string
          phone?: string
          reminder_days?: Json
          theme?: string
          updated_at?: string
        }
        Update: {
          address?: string
          city?: string
          company_name?: string
          company_state?: string
          currency?: string
          default_credit_days?: number
          default_gst_rate?: number
          email?: string
          financial_year_start?: number
          gst_number?: string
          id?: string
          invoice_prefix?: string
          logo_data_url?: string | null
          notification_channels?: Json
          notify_overdue?: boolean
          notify_today?: boolean
          notify_tomorrow?: boolean
          owner_name?: string
          pan_number?: string
          phone?: string
          reminder_days?: Json
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          bill_id: string
          created_at: string
          id: string
          mode: string
          payment_date: string
          reference: string
          remarks: string | null
          supplier_id: string
        }
        Insert: {
          amount: number
          bill_id: string
          created_at?: string
          id?: string
          mode: string
          payment_date: string
          reference?: string
          remarks?: string | null
          supplier_id: string
        }
        Update: {
          amount?: number
          bill_id?: string
          created_at?: string
          id?: string
          mode?: string
          payment_date?: string
          reference?: string
          remarks?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      supplier_history: {
        Row: {
          action: string
          at: string
          details: string | null
          id: string
          supplier_id: string
          user_name: string
        }
        Insert: {
          action: string
          at?: string
          details?: string | null
          id?: string
          supplier_id: string
          user_name?: string
        }
        Update: {
          action?: string
          at?: string
          details?: string | null
          id?: string
          supplier_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_history_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          account_holder_name: string
          account_number: string
          address: string
          alt_phone: string
          archived: boolean
          bank_name: string
          category: string
          city: string
          code: string
          company_name: string
          contact_person: string
          country: string
          created_at: string
          credit_days: number
          email: string
          gst_number: string
          id: string
          ifsc: string
          notes: string
          opening_balance_date: string | null
          opening_outstanding: number
          pan_number: string
          payment_terms: string
          phone: string
          pincode: string
          preferred_payment_method: string
          remarks: string
          state: string
          status: string
          supplier_name: string
          updated_at: string
          upi_id: string
        }
        Insert: {
          account_holder_name?: string
          account_number?: string
          address?: string
          alt_phone?: string
          archived?: boolean
          bank_name?: string
          category?: string
          city?: string
          code: string
          company_name?: string
          contact_person?: string
          country?: string
          created_at?: string
          credit_days?: number
          email?: string
          gst_number?: string
          id?: string
          ifsc?: string
          notes?: string
          opening_balance_date?: string | null
          opening_outstanding?: number
          pan_number?: string
          payment_terms?: string
          phone?: string
          pincode?: string
          preferred_payment_method?: string
          remarks?: string
          state?: string
          status?: string
          supplier_name: string
          updated_at?: string
          upi_id?: string
        }
        Update: {
          account_holder_name?: string
          account_number?: string
          address?: string
          alt_phone?: string
          archived?: boolean
          bank_name?: string
          category?: string
          city?: string
          code?: string
          company_name?: string
          contact_person?: string
          country?: string
          created_at?: string
          credit_days?: number
          email?: string
          gst_number?: string
          id?: string
          ifsc?: string
          notes?: string
          opening_balance_date?: string | null
          opening_outstanding?: number
          pan_number?: string
          payment_terms?: string
          phone?: string
          pincode?: string
          preferred_payment_method?: string
          remarks?: string
          state?: string
          status?: string
          supplier_name?: string
          updated_at?: string
          upi_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "owner" | "accountant"
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
      app_role: ["owner", "accountant"],
    },
  },
} as const
