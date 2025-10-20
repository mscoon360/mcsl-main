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
      access_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          expires_at: string | null
          id: string
          requested_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          requested_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          requested_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      accounts_payable: {
        Row: {
          amount: number
          amount_paid: number | null
          bill_date: string
          bill_number: string
          created_at: string | null
          description: string | null
          due_date: string
          id: string
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          status: string | null
          updated_at: string | null
          user_id: string
          vendor_id: string | null
          vendor_name: string
        }
        Insert: {
          amount: number
          amount_paid?: number | null
          bill_date: string
          bill_number: string
          created_at?: string | null
          description?: string | null
          due_date: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          vendor_id?: string | null
          vendor_name: string
        }
        Update: {
          amount?: number
          amount_paid?: number | null
          bill_date?: string
          bill_number?: string
          created_at?: string | null
          description?: string | null
          due_date?: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          vendor_id?: string | null
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_payable_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_receivable: {
        Row: {
          amount: number
          amount_paid: number | null
          created_at: string | null
          customer_id: string | null
          customer_name: string
          description: string | null
          due_date: string
          id: string
          invoice_date: string
          invoice_id: string | null
          invoice_number: string
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          amount_paid?: number | null
          created_at?: string | null
          customer_id?: string | null
          customer_name: string
          description?: string | null
          due_date: string
          id?: string
          invoice_date: string
          invoice_id?: string | null
          invoice_number: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          amount_paid?: number | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string
          description?: string | null
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_id?: string | null
          invoice_number?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_name: string
          account_number: string
          account_subtype: Database["public"]["Enums"]["account_subtype"]
          account_type: Database["public"]["Enums"]["account_type"]
          balance: number | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          parent_account_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_name: string
          account_number: string
          account_subtype: Database["public"]["Enums"]["account_subtype"]
          account_type: Database["public"]["Enums"]["account_type"]
          balance?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          parent_account_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          account_subtype?: Database["public"]["Enums"]["account_subtype"]
          account_type?: Database["public"]["Enums"]["account_type"]
          balance?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          parent_account_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_activity_log: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          customer_id: string | null
          id: string
          user_id: string
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          customer_id?: string | null
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          customer_id?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_activity_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          company: string | null
          created_at: string | null
          email: string
          id: string
          last_purchase: string | null
          name: string
          phone: string | null
          status: string | null
          total_sales: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          company?: string | null
          created_at?: string | null
          email: string
          id?: string
          last_purchase?: string | null
          name: string
          phone?: string | null
          status?: string | null
          total_sales?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          company?: string | null
          created_at?: string | null
          email?: string
          id?: string
          last_purchase?: string | null
          name?: string
          phone?: string | null
          status?: string | null
          total_sales?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      department_visibility: {
        Row: {
          created_at: string
          department: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      expenditures: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          date: string
          description: string
          id: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string | null
          date: string
          description: string
          id?: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          date?: string
          description?: string
          id?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      finance_test_cases: {
        Row: {
          created_at: string
          expected_entries: Json
          id: string
          last_run_at: string | null
          last_run_error: string | null
          last_run_status: string | null
          payload: Json
          test_name: string
          test_type: string
        }
        Insert: {
          created_at?: string
          expected_entries: Json
          id?: string
          last_run_at?: string | null
          last_run_error?: string | null
          last_run_status?: string | null
          payload: Json
          test_name: string
          test_type: string
        }
        Update: {
          created_at?: string
          expected_entries?: Json
          id?: string
          last_run_at?: string | null
          last_run_error?: string | null
          last_run_status?: string | null
          payload?: Json
          test_name?: string
          test_type?: string
        }
        Relationships: []
      }
      fulfillment_items: {
        Row: {
          created_at: string | null
          customer: string
          delivery_address: string | null
          id: string
          notes: string | null
          product: string
          quantity: number
          sale_id: string
          scheduled_date: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          customer: string
          delivery_address?: string | null
          id?: string
          notes?: string | null
          product: string
          quantity: number
          sale_id: string
          scheduled_date?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          customer?: string
          delivery_address?: string | null
          id?: string
          notes?: string | null
          product?: string
          quantity?: number
          sale_id?: string
          scheduled_date?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          created_at: string | null
          description: string
          id: string
          invoice_id: string
          product_id: string | null
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          invoice_id: string
          product_id?: string | null
          quantity: number
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          invoice_id?: string
          product_id?: string | null
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string | null
          customer_id: string
          customer_name: string
          due_date: string
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          payment_terms: string | null
          status: string | null
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          customer_name: string
          due_date: string
          id?: string
          invoice_number: string
          issue_date: string
          notes?: string | null
          payment_terms?: string | null
          status?: string | null
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          customer_name?: string
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          payment_terms?: string | null
          status?: string | null
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ledger_backfill_logs: {
        Row: {
          batch_id: string
          created_at: string
          error_message: string | null
          id: string
          source_id: string
          source_type: string
          status: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          source_id: string
          source_type: string
          status: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          source_id?: string
          source_type?: string
          status?: string
        }
        Relationships: []
      }
      ledger_entries: {
        Row: {
          balance_hash: string
          created_at: string
          entries: Json
          id: string
          meta: Json | null
          posted_at: string
          source_id: string
          source_type: string
          status: string
          total_credit: number
          total_debit: number
          transaction_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_hash: string
          created_at?: string
          entries: Json
          id?: string
          meta?: Json | null
          posted_at?: string
          source_id: string
          source_type: string
          status?: string
          total_credit?: number
          total_debit?: number
          transaction_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_hash?: string
          created_at?: string
          entries?: Json
          id?: string
          meta?: Json | null
          posted_at?: string
          source_id?: string
          source_type?: string
          status?: string
          total_credit?: number
          total_debit?: number
          transaction_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_schedules: {
        Row: {
          amount: number
          created_at: string | null
          customer: string
          due_date: string
          id: string
          paid_date: string | null
          payment_method: string | null
          product: string
          sale_id: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          customer: string
          due_date: string
          id?: string
          paid_date?: string | null
          payment_method?: string | null
          product: string
          sale_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          customer?: string
          due_date?: string
          id?: string
          paid_date?: string | null
          payment_method?: string | null
          product?: string
          sale_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      product_items: {
        Row: {
          barcode: string
          created_at: string
          destination_address: string | null
          id: string
          product_id: string
          status: string
          updated_at: string
        }
        Insert: {
          barcode: string
          created_at?: string
          destination_address?: string | null
          id?: string
          product_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          barcode?: string
          created_at?: string
          destination_address?: string | null
          id?: string
          product_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          cost_price: number | null
          created_at: string | null
          description: string | null
          id: string
          is_rental: boolean | null
          is_rental_only: boolean | null
          last_sold: string | null
          min_stock: number | null
          name: string
          price: number
          rental_price: number | null
          sku: string
          status: string | null
          stock: number | null
          supplier_name: string | null
          units: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_rental?: boolean | null
          is_rental_only?: boolean | null
          last_sold?: string | null
          min_stock?: number | null
          name: string
          price: number
          rental_price?: number | null
          sku: string
          status?: string | null
          stock?: number | null
          supplier_name?: string | null
          units?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_rental?: boolean | null
          is_rental_only?: boolean | null
          last_sold?: string | null
          min_stock?: number | null
          name?: string
          price?: number
          rental_price?: number | null
          sku?: string
          status?: string | null
          stock?: number | null
          supplier_name?: string | null
          units?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department: string
          id: string
          name: string
          needs_password_change: boolean | null
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          department: string
          id: string
          name: string
          needs_password_change?: boolean | null
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          department?: string
          id?: string
          name?: string
          needs_password_change?: boolean | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          contract_length: string | null
          created_at: string | null
          end_date: string | null
          id: string
          is_rental: boolean | null
          payment_period: string | null
          price: number
          product_name: string
          quantity: number
          sale_id: string
          start_date: string | null
        }
        Insert: {
          contract_length?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_rental?: boolean | null
          payment_period?: string | null
          price: number
          product_name: string
          quantity: number
          sale_id: string
          start_date?: string | null
        }
        Update: {
          contract_length?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_rental?: boolean | null
          payment_period?: string | null
          price?: number
          product_name?: string
          quantity?: number
          sale_id?: string
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string | null
          customer_name: string
          date: string
          id: string
          status: string | null
          total: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          customer_name: string
          date: string
          id?: string
          status?: string | null
          total: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          customer_name?: string
          date?: string
          id?: string
          status?: string | null
          total?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      supplies: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          last_restock_date: string | null
          min_stock_level: number | null
          name: string
          price: number | null
          quantity: number
          status: string | null
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          last_restock_date?: string | null
          min_stock_level?: number | null
          name: string
          price?: number | null
          quantity?: number
          status?: string | null
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          last_restock_date?: string | null
          min_stock_level?: number | null
          name?: string
          price?: number | null
          quantity?: number
          status?: string | null
          unit?: string | null
          updated_at?: string
          user_id?: string
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
      vendors: {
        Row: {
          address: string | null
          city: string | null
          contact_person: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      compute_balance_hash: {
        Args: { entries: Json }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      account_subtype:
        | "current-asset"
        | "fixed-asset"
        | "other-asset"
        | "current-liability"
        | "long-term-liability"
        | "equity"
        | "operating-revenue"
        | "other-revenue"
        | "cost-of-goods-sold"
        | "operating-expense"
        | "other-expense"
      account_type: "asset" | "liability" | "equity" | "revenue" | "expense"
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
      account_subtype: [
        "current-asset",
        "fixed-asset",
        "other-asset",
        "current-liability",
        "long-term-liability",
        "equity",
        "operating-revenue",
        "other-revenue",
        "cost-of-goods-sold",
        "operating-expense",
        "other-expense",
      ],
      account_type: ["asset", "liability", "equity", "revenue", "expense"],
      app_role: ["admin", "user"],
    },
  },
} as const
