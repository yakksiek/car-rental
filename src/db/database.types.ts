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
      email_deliveries: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          error: string | null
          id: string
          recipient: string
          status: string
          template: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          error?: string | null
          id?: string
          recipient: string
          status: string
          template: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          error?: string | null
          id?: string
          recipient?: string
          status?: string
          template?: string
        }
        Relationships: []
      }
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
      protocol_damage_photos: {
        Row: {
          damage_id: string
          id: string
          path: string
        }
        Insert: {
          damage_id: string
          id?: string
          path: string
        }
        Update: {
          damage_id?: string
          id?: string
          path?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocol_damage_photos_damage_id_fkey"
            columns: ["damage_id"]
            isOneToOne: false
            referencedRelation: "protocol_damages"
            referencedColumns: ["id"]
          },
        ]
      }
      protocol_damages: {
        Row: {
          baseline_damage_id: string | null
          id: string
          location: string
          protocol_id: string
          size: string | null
          type: Database["public"]["Enums"]["protocol_damage_type"]
        }
        Insert: {
          baseline_damage_id?: string | null
          id: string
          location: string
          protocol_id: string
          size?: string | null
          type: Database["public"]["Enums"]["protocol_damage_type"]
        }
        Update: {
          baseline_damage_id?: string | null
          id?: string
          location?: string
          protocol_id?: string
          size?: string | null
          type?: Database["public"]["Enums"]["protocol_damage_type"]
        }
        Relationships: [
          {
            foreignKeyName: "protocol_damages_baseline_damage_id_fkey"
            columns: ["baseline_damage_id"]
            isOneToOne: false
            referencedRelation: "protocol_damages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocol_damages_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      protocol_photos: {
        Row: {
          id: string
          path: string
          protocol_id: string
          slot: Database["public"]["Enums"]["protocol_photo_slot"]
        }
        Insert: {
          id?: string
          path: string
          protocol_id: string
          slot: Database["public"]["Enums"]["protocol_photo_slot"]
        }
        Update: {
          id?: string
          path?: string
          protocol_id?: string
          slot?: Database["public"]["Enums"]["protocol_photo_slot"]
        }
        Relationships: [
          {
            foreignKeyName: "protocol_photos_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      protocols: {
        Row: {
          baseline_protocol_id: string | null
          created_at: string
          created_by: string | null
          customer_ack: boolean
          fuel_eighths: number
          id: string
          odometer_km: number
          pdf_path: string | null
          reservation_id: string
          signature: string
          signed_at: string
          type: Database["public"]["Enums"]["protocol_type"]
        }
        Insert: {
          baseline_protocol_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_ack: boolean
          fuel_eighths: number
          id: string
          odometer_km: number
          pdf_path?: string | null
          reservation_id: string
          signature: string
          signed_at: string
          type: Database["public"]["Enums"]["protocol_type"]
        }
        Update: {
          baseline_protocol_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_ack?: boolean
          fuel_eighths?: number
          id?: string
          odometer_km?: number
          pdf_path?: string | null
          reservation_id?: string
          signature?: string
          signed_at?: string
          type?: Database["public"]["Enums"]["protocol_type"]
        }
        Relationships: [
          {
            foreignKeyName: "protocols_baseline_protocol_id_fkey"
            columns: ["baseline_protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocols_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
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
          rejection_note: string | null
          rejection_reason: string | null
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
          rejection_note?: string | null
          rejection_reason?: string | null
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
          rejection_note?: string | null
          rejection_reason?: string | null
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
          plate: string
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
          plate: string
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
          plate?: string
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
          plate: string
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
      count_overdue_returns: { Args: never; Returns: number }
      create_protocol: {
        Args: {
          p_customer_ack: boolean
          p_damages: Json
          p_fuel_eighths: number
          p_id: string
          p_odometer_km: number
          p_photos: Json
          p_reservation_id: string
          p_signature: string
          p_signed_at: string
        }
        Returns: {
          protocol_id: string
          result: string
        }[]
      }
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
      create_return_protocol: {
        Args: {
          p_baseline_protocol_id: string
          p_customer_ack: boolean
          p_damages: Json
          p_fuel_eighths: number
          p_id: string
          p_odometer_km: number
          p_photos: Json
          p_reservation_id: string
          p_signature: string
          p_signed_at: string
        }
        Returns: {
          protocol_id: string
          result: string
        }[]
      }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      decide_reservation: {
        Args: {
          p_decision: string
          p_id: string
          p_note?: string
          p_reason?: string
        }
        Returns: {
          access_token: string
          customer_email: string
          customer_name: string
          pickup_date: string
          reference: string
          result: string
          return_date: string
          vehicle_daily_rate: number
          vehicle_deposit: number
          vehicle_make: string
          vehicle_model: string
          vehicle_production_year: number
        }[]
      }
      get_protocol: {
        Args: { p_id: string }
        Returns: {
          baseline_protocol_id: string
          created_at: string
          customer_ack: boolean
          customer_email: string
          customer_name: string
          damages: Json
          delivery_created_at: string
          delivery_status: string
          fuel_eighths: number
          id: string
          odometer_km: number
          pdf_path: string
          photos: Json
          pickup_date: string
          reference: string
          reservation_id: string
          return_date: string
          signature: string
          signed_at: string
          type: Database["public"]["Enums"]["protocol_type"]
          vehicle_make: string
          vehicle_model: string
          vehicle_plate: string
        }[]
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
      get_return_baseline: {
        Args: { p_reservation_id: string }
        Returns: {
          baseline_damages: Json
          baseline_fuel_eighths: number
          baseline_odometer_km: number
          baseline_protocol_id: string
          customer_email: string
          customer_name: string
          pickup_date: string
          reference: string
          reservation_id: string
          return_date: string
          return_protocol_id: string
          vehicle_make: string
          vehicle_model: string
          vehicle_plate: string
        }[]
      }
      get_vehicle_busy_ranges: {
        Args: { p_vehicle_id: string }
        Returns: {
          pickup_date: string
          return_date: string
        }[]
      }
      list_dispatch_today: {
        Args: never
        Returns: {
          customer_email: string
          customer_name: string
          delivery_created_at: string
          delivery_status: string
          last_odometer_km: number
          pdf_path: string
          pickup_date: string
          protocol_id: string
          reference: string
          reservation_id: string
          return_date: string
          vehicle_id: string
          vehicle_make: string
          vehicle_model: string
          vehicle_plate: string
        }[]
      }
      list_pending_reservations: {
        Args: never
        Returns: {
          company: string
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string
          id: string
          notes: string
          pickup_date: string
          reference: string
          return_date: string
          vat_id: string
          vehicle_daily_rate: number
          vehicle_deposit: number
          vehicle_id: string
          vehicle_make: string
          vehicle_model: string
          vehicle_production_year: number
        }[]
      }
      list_reservations_for_calendar: {
        Args: { p_end: string; p_start: string }
        Returns: {
          customer_name: string
          id: string
          pickup_date: string
          reference: string
          return_date: string
          status: Database["public"]["Enums"]["reservation_status"]
          vehicle_id: string
          vehicle_make: string
          vehicle_model: string
        }[]
      }
      list_returns_today: {
        Args: never
        Returns: {
          baseline_fuel_eighths: number
          baseline_odometer_km: number
          baseline_protocol_id: string
          customer_email: string
          customer_name: string
          customer_phone: string
          delivery_created_at: string
          delivery_status: string
          pdf_path: string
          pickup_date: string
          reference: string
          reservation_id: string
          return_date: string
          return_protocol_id: string
          vehicle_id: string
          vehicle_make: string
          vehicle_model: string
          vehicle_plate: string
        }[]
      }
      record_email_delivery: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_error?: string
          p_recipient: string
          p_status: string
          p_template: string
        }
        Returns: undefined
      }
      set_protocol_pdf: {
        Args: { p_id: string; p_path: string }
        Returns: {
          result: string
        }[]
      }
      set_vehicle_active: {
        Args: { p_active: boolean; p_id: string }
        Returns: {
          result: string
        }[]
      }
    }
    Enums: {
      app_role: "employee" | "admin"
      protocol_damage_type: "scratch" | "dent" | "crack" | "missing"
      protocol_photo_slot:
        | "front"
        | "rear"
        | "left"
        | "right"
        | "interior"
        | "dashboard"
      protocol_type: "issue" | "return"
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
      protocol_damage_type: ["scratch", "dent", "crack", "missing"],
      protocol_photo_slot: [
        "front",
        "rear",
        "left",
        "right",
        "interior",
        "dashboard",
      ],
      protocol_type: ["issue", "return"],
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

