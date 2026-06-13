export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          access_token: string
          company: string | null
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string
          id: string
          notes: string | null
          pickup_date: string
          reference: string | null
          reserved_period: unknown
          return_date: string
          status: Database["public"]["Enums"]["reservation_status"]
          terms_accepted_at: string | null
          updated_at: string
          vat_id: string | null
          vehicle_id: string
        }
        Insert: {
          access_token?: string
          company?: string | null
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone: string
          id?: string
          notes?: string | null
          pickup_date: string
          reference?: string | null
          reserved_period?: unknown
          return_date: string
          status?: Database["public"]["Enums"]["reservation_status"]
          terms_accepted_at?: string | null
          updated_at?: string
          vat_id?: string | null
          vehicle_id: string
        }
        Update: {
          access_token?: string
          company?: string | null
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          notes?: string | null
          pickup_date?: string
          reference?: string | null
          reserved_period?: unknown
          return_date?: string
          status?: Database["public"]["Enums"]["reservation_status"]
          terms_accepted_at?: string | null
          updated_at?: string
          vat_id?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          cargo_height_cm: number | null
          cargo_length_cm: number | null
          cargo_width_cm: number | null
          category: Database["public"]["Enums"]["vehicle_category"]
          created_at: string
          daily_rate: number
          deposit: number
          fuel_type: string | null
          id: string
          is_active: boolean
          km_limit: number | null
          make: string | null
          model: string | null
          monthly_rate: number
          name: string
          payload_capacity_kg: number | null
          per_extra_km_rate: number
          photos: string[]
          production_year: number | null
          seats: number | null
          transmission: Database["public"]["Enums"]["transmission_type"] | null
          updated_at: string
        }
        Insert: {
          cargo_height_cm?: number | null
          cargo_length_cm?: number | null
          cargo_width_cm?: number | null
          category: Database["public"]["Enums"]["vehicle_category"]
          created_at?: string
          daily_rate: number
          deposit: number
          fuel_type?: string | null
          id?: string
          is_active?: boolean
          km_limit?: number | null
          make?: string | null
          model?: string | null
          monthly_rate: number
          name: string
          payload_capacity_kg?: number | null
          per_extra_km_rate: number
          photos?: string[]
          production_year?: number | null
          seats?: number | null
          transmission?: Database["public"]["Enums"]["transmission_type"] | null
          updated_at?: string
        }
        Update: {
          cargo_height_cm?: number | null
          cargo_length_cm?: number | null
          cargo_width_cm?: number | null
          category?: Database["public"]["Enums"]["vehicle_category"]
          created_at?: string
          daily_rate?: number
          deposit?: number
          fuel_type?: string | null
          id?: string
          is_active?: boolean
          km_limit?: number | null
          make?: string | null
          model?: string | null
          monthly_rate?: number
          name?: string
          payload_capacity_kg?: number | null
          per_extra_km_rate?: number
          photos?: string[]
          production_year?: number | null
          seats?: number | null
          transmission?: Database["public"]["Enums"]["transmission_type"] | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      available_vehicles: {
        Args: { p_pickup: string; p_return: string }
        Returns: {
          cargo_height_cm: number | null
          cargo_length_cm: number | null
          cargo_width_cm: number | null
          category: Database["public"]["Enums"]["vehicle_category"]
          created_at: string
          daily_rate: number
          deposit: number
          fuel_type: string | null
          id: string
          is_active: boolean
          km_limit: number | null
          make: string | null
          model: string | null
          monthly_rate: number
          name: string
          payload_capacity_kg: number | null
          per_extra_km_rate: number
          photos: string[]
          production_year: number | null
          seats: number | null
          transmission: Database["public"]["Enums"]["transmission_type"] | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "vehicles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      base36_encode: { Args: { p_value: number }; Returns: string }
      create_reservation_request: {
        Args: {
          p_company?: string
          p_customer_email: string
          p_customer_name: string
          p_customer_phone: string
          p_notes?: string
          p_pickup: string
          p_return: string
          p_terms_accepted: boolean
          p_vat_id?: string
          p_vehicle_id: string
        }
        Returns: {
          access_token: string
          reference: string
          result: string
        }[]
      }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_reservation_status: {
        Args: { p_token: string }
        Returns: {
          created_at: string
          customer_email: string
          customer_name: string
          pickup_date: string
          reference: string
          return_date: string
          status: Database["public"]["Enums"]["reservation_status"]
          vehicle_category: Database["public"]["Enums"]["vehicle_category"]
          vehicle_daily_rate: number
          vehicle_deposit: number
          vehicle_make: string
          vehicle_model: string
          vehicle_production_year: number
        }[]
      }
      get_vehicle_busy_ranges: {
        Args: { p_vehicle_id: string }
        Returns: {
          pickup_date: string
          return_date: string
        }[]
      }
    }
    Enums: {
      app_role: "employee" | "admin"
      reservation_status: "pending" | "confirmed" | "rejected" | "cancelled"
      transmission_type: "manual" | "automatic"
      vehicle_category:
        | "cargo_van"
        | "passenger_van"
        | "car_transporter"
        | "refrigerated_truck"
        | "flatbed_truck"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["employee", "admin"],
      reservation_status: ["pending", "confirmed", "rejected", "cancelled"],
      transmission_type: ["manual", "automatic"],
      vehicle_category: [
        "cargo_van",
        "passenger_van",
        "car_transporter",
        "refrigerated_truck",
        "flatbed_truck",
      ],
    },
  },
} as const

