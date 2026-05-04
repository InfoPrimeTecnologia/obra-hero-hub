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
      admin_allowlist: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      communications_log: {
        Row: {
          body: string | null
          channel: Database["public"]["Enums"]["communication_channel"]
          created_at: string
          customer_id: string
          error: string | null
          id: string
          invoice_id: string | null
          provider_message_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["communication_status"]
          subject: string | null
          trigger: Database["public"]["Enums"]["communication_trigger"]
        }
        Insert: {
          body?: string | null
          channel: Database["public"]["Enums"]["communication_channel"]
          created_at?: string
          customer_id: string
          error?: string | null
          id?: string
          invoice_id?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["communication_status"]
          subject?: string | null
          trigger: Database["public"]["Enums"]["communication_trigger"]
        }
        Update: {
          body?: string | null
          channel?: Database["public"]["Enums"]["communication_channel"]
          created_at?: string
          customer_id?: string
          error?: string | null
          id?: string
          invoice_id?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["communication_status"]
          subject?: string | null
          trigger?: Database["public"]["Enums"]["communication_trigger"]
        }
        Relationships: [
          {
            foreignKeyName: "communications_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_log_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          asaas_customer_id: string | null
          company_name: string | null
          cpf_cnpj: string | null
          created_at: string
          created_by: string | null
          email: string
          id: string
          name: string
          notes: string | null
          owner_user_id: string | null
          phone: string | null
          status: Database["public"]["Enums"]["customer_status"]
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          asaas_customer_id?: string | null
          company_name?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          name: string
          notes?: string | null
          owner_user_id?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          asaas_customer_id?: string | null
          company_name?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          name?: string
          notes?: string | null
          owner_user_id?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      empresas: {
        Row: {
          cnpj: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      integration_settings: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_active: boolean
          last_test_at: string | null
          last_test_status: string | null
          provider: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          last_test_at?: string | null
          last_test_status?: string | null
          provider: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          last_test_at?: string | null
          last_test_status?: string | null
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          asaas_payment_id: string | null
          bank_slip_url: string | null
          created_at: string
          customer_id: string
          description: string | null
          due_date: string
          id: string
          invoice_url: string | null
          paid_at: string | null
          payment_link: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          status: Database["public"]["Enums"]["invoice_status"]
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          asaas_payment_id?: string | null
          bank_slip_url?: string | null
          created_at?: string
          customer_id: string
          description?: string | null
          due_date: string
          id?: string
          invoice_url?: string | null
          paid_at?: string | null
          payment_link?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["invoice_status"]
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          asaas_payment_id?: string | null
          bank_slip_url?: string | null
          created_at?: string
          customer_id?: string
          description?: string | null
          due_date?: string
          id?: string
          invoice_url?: string | null
          paid_at?: string | null
          payment_link?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["invoice_status"]
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["communication_channel"]
          created_at: string
          id: string
          is_active: boolean
          subject: string | null
          trigger: Database["public"]["Enums"]["communication_trigger"]
          updated_at: string
        }
        Insert: {
          body: string
          channel: Database["public"]["Enums"]["communication_channel"]
          created_at?: string
          id?: string
          is_active?: boolean
          subject?: string | null
          trigger: Database["public"]["Enums"]["communication_trigger"]
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["communication_channel"]
          created_at?: string
          id?: string
          is_active?: boolean
          subject?: string | null
          trigger?: Database["public"]["Enums"]["communication_trigger"]
          updated_at?: string
        }
        Relationships: []
      }
      obra_diario_fotos: {
        Row: {
          caption: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          diario_id: string
          id: string
          obra_id: string
          storage_path: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          diario_id: string
          id?: string
          obra_id: string
          storage_path: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          diario_id?: string
          id?: string
          obra_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_diario_fotos_diario_id_fkey"
            columns: ["diario_id"]
            isOneToOne: false
            referencedRelation: "obra_diarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_diario_fotos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_diarios: {
        Row: {
          activities: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          diary_date: string
          id: string
          notes: string | null
          obra_id: string
          updated_at: string
          weather: string | null
          workforce: string | null
        }
        Insert: {
          activities?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          diary_date?: string
          id?: string
          notes?: string | null
          obra_id: string
          updated_at?: string
          weather?: string | null
          workforce?: string | null
        }
        Update: {
          activities?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          diary_date?: string
          id?: string
          notes?: string | null
          obra_id?: string
          updated_at?: string
          weather?: string | null
          workforce?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obra_diarios_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          contact_email: string | null
          contact_name: string | null
          contact_whatsapp: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          description: string | null
          empresa_id: string | null
          expected_end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          description?: string | null
          empresa_id?: string | null
          expected_end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_whatsapp?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          description?: string | null
          empresa_id?: string | null
          expected_end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_etapas: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          dt_fim_prevista: string | null
          dt_fim_real: string | null
          dt_inicio_prevista: string | null
          dt_inicio_real: string | null
          id: string
          nome: string
          obra_id: string
          ordem: number
          percentual: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          dt_fim_prevista?: string | null
          dt_fim_real?: string | null
          dt_inicio_prevista?: string | null
          dt_inicio_real?: string | null
          id?: string
          nome: string
          obra_id: string
          ordem?: number
          percentual?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          dt_fim_prevista?: string | null
          dt_fim_real?: string | null
          dt_inicio_prevista?: string | null
          dt_inicio_real?: string | null
          id?: string
          nome?: string
          obra_id?: string
          ordem?: number
          percentual?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_etapas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_subetapas: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          etapa_id: string
          id: string
          nome: string
          ordem: number
          tipo: string | null
          updated_at: string
          valor_orcado: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          etapa_id: string
          id?: string
          nome: string
          ordem?: number
          tipo?: string | null
          updated_at?: string
          valor_orcado?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          etapa_id?: string
          id?: string
          nome?: string
          ordem?: number
          tipo?: string | null
          updated_at?: string
          valor_orcado?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_subetapas_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "orcamento_etapas"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          cycle: Database["public"]["Enums"]["plan_cycle"]
          description: string | null
          display_order: number
          features: string[]
          id: string
          is_active: boolean
          is_featured: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle?: Database["public"]["Enums"]["plan_cycle"]
          description?: string | null
          display_order?: number
          features?: string[]
          id?: string
          is_active?: boolean
          is_featured?: boolean
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle?: Database["public"]["Enums"]["plan_cycle"]
          description?: string | null
          display_order?: number
          features?: string[]
          id?: string
          is_active?: boolean
          is_featured?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          asaas_subscription_id: string | null
          canceled_at: string | null
          created_at: string
          customer_id: string
          cycle: Database["public"]["Enums"]["plan_cycle"]
          due_day: number
          id: string
          next_due_date: string | null
          plan_id: string
          price: number
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          asaas_subscription_id?: string | null
          canceled_at?: string | null
          created_at?: string
          customer_id: string
          cycle: Database["public"]["Enums"]["plan_cycle"]
          due_day: number
          id?: string
          next_due_date?: string | null
          plan_id: string
          price: number
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          asaas_subscription_id?: string | null
          canceled_at?: string | null
          created_at?: string
          customer_id?: string
          cycle?: Database["public"]["Enums"]["plan_cycle"]
          due_day?: number
          id?: string
          next_due_date?: string | null
          plan_id?: string
          price?: number
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          attachments: Json
          author_id: string | null
          body: string
          created_at: string
          id: string
          is_from_admin: boolean
          ticket_id: string
        }
        Insert: {
          attachments?: Json
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_from_admin?: boolean
          ticket_id: string
        }
        Update: {
          attachments?: Json
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_from_admin?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
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
      webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_type: string
          external_id: string | null
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          provider: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type: string
          external_id?: string | null
          id?: string
          payload: Json
          processed?: boolean
          processed_at?: string | null
          provider: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string
          external_id?: string | null
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          provider?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_customer_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "company_owner"
      communication_channel: "email" | "whatsapp"
      communication_status: "queued" | "sent" | "delivered" | "failed"
      communication_trigger:
        | "welcome"
        | "invoice_created"
        | "invoice_reminder"
        | "invoice_overdue"
        | "manual"
      customer_status: "active" | "inactive" | "overdue" | "canceled"
      invoice_status: "pending" | "paid" | "overdue" | "canceled" | "refunded"
      payment_method:
        | "boleto"
        | "credit_card"
        | "pix"
        | "transfer"
        | "undefined"
      plan_cycle: "monthly" | "quarterly" | "semiannual" | "annual"
      subscription_status: "active" | "paused" | "canceled" | "expired"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status:
        | "open"
        | "in_progress"
        | "waiting_customer"
        | "resolved"
        | "closed"
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
      app_role: ["admin", "company_owner"],
      communication_channel: ["email", "whatsapp"],
      communication_status: ["queued", "sent", "delivered", "failed"],
      communication_trigger: [
        "welcome",
        "invoice_created",
        "invoice_reminder",
        "invoice_overdue",
        "manual",
      ],
      customer_status: ["active", "inactive", "overdue", "canceled"],
      invoice_status: ["pending", "paid", "overdue", "canceled", "refunded"],
      payment_method: ["boleto", "credit_card", "pix", "transfer", "undefined"],
      plan_cycle: ["monthly", "quarterly", "semiannual", "annual"],
      subscription_status: ["active", "paused", "canceled", "expired"],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: [
        "open",
        "in_progress",
        "waiting_customer",
        "resolved",
        "closed",
      ],
    },
  },
} as const
