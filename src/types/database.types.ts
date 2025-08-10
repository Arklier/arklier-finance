export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      exchange_connections: {
        Row: {
          api_key: string
          api_secret: string
          client_id: string
          created_at: string
          exchange: string
          id: string
          label: string | null
          last_synced_at: string | null
          sync_cursor: Json | null
          sync_error: string | null
          sync_metadata: Json | null
          sync_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          api_secret: string
          client_id: string
          created_at?: string
          exchange: string
          id?: string
          label?: string | null
          last_synced_at?: string | null
          sync_cursor?: Json | null
          sync_error?: string | null
          sync_metadata?: Json | null
          sync_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          api_secret?: string
          client_id?: string
          created_at?: string
          exchange?: string
          id?: string
          label?: string | null
          last_synced_at?: string | null
          sync_cursor?: Json | null
          sync_error?: string | null
          sync_metadata?: Json | null
          sync_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      normalized_transactions: {
        Row: {
          base_amount: number | null
          base_asset: string | null
          connection_id: string
          fee_amount: number | null
          fee_asset: string | null
          id: number
          metadata: Json | null
          occurred_at: string
          order_id: string | null
          price: number | null
          quote_amount: number | null
          quote_asset: string | null
          source_raw_id: number
          txid: string | null
          txn_type: Database["public"]["Enums"]["txn_type"]
          user_id: string
        }
        Insert: {
          base_amount?: number | null
          base_asset?: string | null
          connection_id: string
          fee_amount?: number | null
          fee_asset?: string | null
          id?: number
          metadata?: Json | null
          occurred_at: string
          order_id?: string | null
          price?: number | null
          quote_amount?: number | null
          quote_asset?: string | null
          source_raw_id: number
          txid?: string | null
          txn_type: Database["public"]["Enums"]["txn_type"]
          user_id: string
        }
        Update: {
          base_amount?: number | null
          base_asset?: string | null
          connection_id?: string
          fee_amount?: number | null
          fee_asset?: string | null
          id?: number
          metadata?: Json | null
          occurred_at?: string
          order_id?: string | null
          price?: number | null
          quote_amount?: number | null
          quote_asset?: string | null
          source_raw_id?: number
          txid?: string | null
          txn_type?: Database["public"]["Enums"]["txn_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "normalized_transactions_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "exchange_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "normalized_transactions_source_raw_id_fkey"
            columns: ["source_raw_id"]
            isOneToOne: false
            referencedRelation: "raw_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_transactions: {
        Row: {
          connection_id: string
          id: number
          ingested_at: string
          kind: string | null
          occurred_at: string | null
          payload: Json
          provider: string
          provider_tx_id: string | null
          user_id: string
        }
        Insert: {
          connection_id: string
          id?: number
          ingested_at?: string
          kind?: string | null
          occurred_at?: string | null
          payload: Json
          provider: string
          provider_tx_id?: string | null
          user_id: string
        }
        Update: {
          connection_id?: string
          id?: number
          ingested_at?: string
          kind?: string | null
          occurred_at?: string | null
          payload?: Json
          provider?: string
          provider_tx_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_transactions_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "exchange_connections"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      txn_type:
        | "buy"
        | "sell"
        | "deposit"
        | "withdrawal"
        | "send"
        | "transfer"
        | "staking"
        | "bonus"
        | "fee"
        | "rebate"
        | "trade_match"
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
      txn_type: [
        "buy",
        "sell",
        "deposit",
        "withdrawal",
        "send",
        "transfer",
        "staking",
        "bonus",
        "fee",
        "rebate",
        "trade_match",
      ],
    },
  },
} as const
