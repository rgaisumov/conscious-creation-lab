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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      batches: {
        Row: {
          completed: Json
          created_at: string
          created_by: string | null
          due_date: string
          id: string
          note: string | null
          number: string
          ordered_qty: number
          product_id: string
          route_override: Json | null
          shipped_qty: number
          updated_at: string
        }
        Insert: {
          completed?: Json
          created_at?: string
          created_by?: string | null
          due_date: string
          id: string
          note?: string | null
          number: string
          ordered_qty?: number
          product_id: string
          route_override?: Json | null
          shipped_qty?: number
          updated_at?: string
        }
        Update: {
          completed?: Json
          created_at?: string
          created_by?: string | null
          due_date?: string
          id?: string
          note?: string | null
          number?: string
          ordered_qty?: number
          product_id?: string
          route_override?: Json | null
          shipped_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_deliveries: {
        Row: {
          contract_id: string
          date: string
          id: string
          quantity: number
        }
        Insert: {
          contract_id: string
          date: string
          id: string
          quantity?: number
        }
        Update: {
          contract_id?: string
          date?: string
          id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_deliveries_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          counterparty: string
          created_at: string
          created_by: string | null
          decimal_number: string
          id: string
          note: string | null
          number: string
          product_id: string
          signed_date: string
          updated_at: string
        }
        Insert: {
          counterparty: string
          created_at?: string
          created_by?: string | null
          decimal_number: string
          id: string
          note?: string | null
          number: string
          product_id: string
          signed_date: string
          updated_at?: string
        }
        Update: {
          counterparty?: string
          created_at?: string
          created_by?: string | null
          decimal_number?: string
          id?: string
          note?: string | null
          number?: string
          product_id?: string
          signed_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_batches: {
        Row: {
          batch_id: string
          delivery_id: string
        }
        Insert: {
          batch_id: string
          delivery_id: string
        }
        Update: {
          batch_id?: string
          delivery_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_batches_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "contract_deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          archived: boolean
          assembled_operation_id: string | null
          components: Json
          created_at: string
          created_by: string | null
          id: string
          name: string
          note: string | null
          operation_groups: Json
          operations: Json
          tested_operation_id: string | null
          updated_at: string
          version: string
        }
        Insert: {
          archived?: boolean
          assembled_operation_id?: string | null
          components?: Json
          created_at?: string
          created_by?: string | null
          id: string
          name: string
          note?: string | null
          operation_groups?: Json
          operations?: Json
          tested_operation_id?: string | null
          updated_at?: string
          version?: string
        }
        Update: {
          archived?: boolean
          assembled_operation_id?: string | null
          components?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          note?: string | null
          operation_groups?: Json
          operations?: Json
          tested_operation_id?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          display_name: string | null
          id: string
          role_title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          display_name?: string | null
          id: string
          role_title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          display_name?: string | null
          id?: string
          role_title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transfer_times: {
        Row: {
          created_at: string
          from_node: string
          hours: number
          id: string
          to_node: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_node: string
          hours?: number
          id: string
          to_node: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_node?: string
          hours?: number
          id?: string
          to_node?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workcenters: {
        Row: {
          created_at: string
          hours_per_worker_per_week: number
          id: string
          name: string
          note: string | null
          updated_at: string
          workers: number
        }
        Insert: {
          created_at?: string
          hours_per_worker_per_week?: number
          id: string
          name: string
          note?: string | null
          updated_at?: string
          workers?: number
        }
        Update: {
          created_at?: string
          hours_per_worker_per_week?: number
          id?: string
          name?: string
          note?: string | null
          updated_at?: string
          workers?: number
        }
        Relationships: []
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
      app_role: "admin" | "production_manager" | "workcenter_master" | "viewer"
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
      app_role: ["admin", "production_manager", "workcenter_master", "viewer"],
    },
  },
} as const
