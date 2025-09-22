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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      "Requested Quotes": {
        Row: {
          cif_value: string | null
          clearance_urgency: string | null
          comments: string | null
          commercial_value: string | null
          company: string | null
          container_type: string | null
          country_of_manufacture: string | null
          created_at: string
          currency: string | null
          customer_name: string | null
          customs_brokerage: boolean | null
          delivery_address: string | null
          destination: string | null
          email: string | null
          final_dimensions: string | null
          final_weight: string | null
          goods: string | null
          height: string | null
          hs_code: string | null
          id: string
          import_export_type: string | null
          insurance: boolean | null
          length: string | null
          needs_transportation: boolean | null
          origin: string | null
          package_type: string | null
          permit_license: string | null
          phone: string | null
          pieces: string | null
          purpose_of_import: string | null
          service_type: string | null
          shipment_type: string | null
          shipping_terms: string | null
          shipping_type: string | null
          tax_exemption_details: string | null
          tax_exemption_eligible: string | null
          unit_system: string | null
          user_id: string
          value: string | null
          weight: string | null
          width: string | null
        }
        Insert: {
          cif_value?: string | null
          clearance_urgency?: string | null
          comments?: string | null
          commercial_value?: string | null
          company?: string | null
          container_type?: string | null
          country_of_manufacture?: string | null
          created_at?: string
          currency?: string | null
          customer_name?: string | null
          customs_brokerage?: boolean | null
          delivery_address?: string | null
          destination?: string | null
          email?: string | null
          final_dimensions?: string | null
          final_weight?: string | null
          goods?: string | null
          height?: string | null
          hs_code?: string | null
          id?: string
          import_export_type?: string | null
          insurance?: boolean | null
          length?: string | null
          needs_transportation?: boolean | null
          origin?: string | null
          package_type?: string | null
          permit_license?: string | null
          phone?: string | null
          pieces?: string | null
          purpose_of_import?: string | null
          service_type?: string | null
          shipment_type?: string | null
          shipping_terms?: string | null
          shipping_type?: string | null
          tax_exemption_details?: string | null
          tax_exemption_eligible?: string | null
          unit_system?: string | null
          user_id: string
          value?: string | null
          weight?: string | null
          width?: string | null
        }
        Update: {
          cif_value?: string | null
          clearance_urgency?: string | null
          comments?: string | null
          commercial_value?: string | null
          company?: string | null
          container_type?: string | null
          country_of_manufacture?: string | null
          created_at?: string
          currency?: string | null
          customer_name?: string | null
          customs_brokerage?: boolean | null
          delivery_address?: string | null
          destination?: string | null
          email?: string | null
          final_dimensions?: string | null
          final_weight?: string | null
          goods?: string | null
          height?: string | null
          hs_code?: string | null
          id?: string
          import_export_type?: string | null
          insurance?: boolean | null
          length?: string | null
          needs_transportation?: boolean | null
          origin?: string | null
          package_type?: string | null
          permit_license?: string | null
          phone?: string | null
          pieces?: string | null
          purpose_of_import?: string | null
          service_type?: string | null
          shipment_type?: string | null
          shipping_terms?: string | null
          shipping_type?: string | null
          tax_exemption_details?: string | null
          tax_exemption_eligible?: string | null
          unit_system?: string | null
          user_id?: string
          value?: string | null
          weight?: string | null
          width?: string | null
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
          role?: Database["public"]["Enums"]["app_role"]
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
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["app_role"]
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
