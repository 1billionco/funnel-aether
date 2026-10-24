export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      admin_audit: {
        Row: {
          action: string;
          actor: string | null;
          at: string;
          id: number;
          payload: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor?: string | null;
          at?: string;
          id?: never;
          payload?: NonNullable<Json>;
        };
        Update: {
          action?: string;
          actor?: string | null;
          at?: string;
          id?: never;
          payload?: NonNullable<Json>;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          ai_daily_budget_usd: number;
          ai_kill_switch: boolean;
          id: boolean;
          max_orgs: number;
          signup_mode: Database["public"]["Enums"]["signup_mode"];
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          ai_daily_budget_usd?: number;
          ai_kill_switch?: boolean;
          id?: boolean;
          max_orgs?: number;
          signup_mode?: Database["public"]["Enums"]["signup_mode"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          ai_daily_budget_usd?: number;
          ai_kill_switch?: boolean;
          id?: boolean;
          max_orgs?: number;
          signup_mode?: Database["public"]["Enums"]["signup_mode"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      beta_invites: {
        Row: {
          code: string;
          created_at: string;
          created_by: string | null;
          expires_at: string | null;
          market: Database["public"]["Enums"]["market"] | null;
          max_uses: number;
          note: string | null;
          used_count: number;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          market?: Database["public"]["Enums"]["market"] | null;
          max_uses?: number;
          note?: string | null;
          used_count?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          market?: Database["public"]["Enums"]["market"] | null;
          max_uses?: number;
          note?: string | null;
          used_count?: number;
        };
        Relationships: [];
      };
      brands: {
        Row: {
          audience: string | null;
          chunk_count: number;
          compliance_rules: string[];
          created_at: string;
          deleted_at: string | null;
          do_say: string[];
          document_count: number;
          dont_say: string[];
          example_ctas: string[];
          id: string;
          industry: string | null;
          name: string;
          offer: string | null;
          org_id: string;
          primary_language: string;
          summary: string | null;
          summary_approved_at: string | null;
          summary_approved_by: string | null;
          summary_status: string;
          tone_sliders: NonNullable<Json>;
          training_quality_score: number;
          updated_at: string;
          website_url: string | null;
          whatsapp_number: string | null;
        };
        ComputedFields: never;
        Insert: {
          audience?: string | null;
          chunk_count?: number;
          compliance_rules?: string[];
          created_at?: string;
          deleted_at?: string | null;
          do_say?: string[];
          document_count?: number;
          dont_say?: string[];
          example_ctas?: string[];
          id?: string;
          industry?: string | null;
          name: string;
          offer?: string | null;
          org_id: string;
          primary_language?: string;
          summary?: string | null;
          summary_approved_at?: string | null;
          summary_approved_by?: string | null;
          summary_status?: string;
          tone_sliders?: NonNullable<Json>;
          training_quality_score?: number;
          updated_at?: string;
          website_url?: string | null;
          whatsapp_number?: string | null;
        };
        Update: {
          audience?: string | null;
          chunk_count?: number;
          compliance_rules?: string[];
          created_at?: string;
          deleted_at?: string | null;
          do_say?: string[];
          document_count?: number;
          dont_say?: string[];
          example_ctas?: string[];
          id?: string;
          industry?: string | null;
          name?: string;
          offer?: string | null;
          org_id?: string;
          primary_language?: string;
          summary?: string | null;
          summary_approved_at?: string | null;
          summary_approved_by?: string | null;
          summary_status?: string;
          tone_sliders?: NonNullable<Json>;
          training_quality_score?: number;
          updated_at?: string;
          website_url?: string | null;
          whatsapp_number?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "brands_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          at: string;
          id: number;
          name: string;
          org_id: string | null;
          props: NonNullable<Json>;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          at?: string;
          id?: never;
          name: string;
          org_id?: string | null;
          props?: NonNullable<Json>;
          user_id?: string | null;
        };
        Update: {
          at?: string;
          id?: never;
          name?: string;
          org_id?: string | null;
          props?: NonNullable<Json>;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "events_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      feedback: {
        Row: {
          created_at: string;
          draft_id: string | null;
          id: string;
          kind: Database["public"]["Enums"]["feedback_kind"];
          org_id: string | null;
          page: string | null;
          score: number | null;
          text: string | null;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          draft_id?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["feedback_kind"];
          org_id?: string | null;
          page?: string | null;
          score?: number | null;
          text?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          draft_id?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["feedback_kind"];
          org_id?: string | null;
          page?: string | null;
          score?: number | null;
          text?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "feedback_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      invite_redemptions: {
        Row: {
          code: string;
          org_id: string;
          redeemed_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          org_id: string;
          redeemed_at?: string;
          user_id: string;
        };
        Update: {
          code?: string;
          org_id?: string;
          redeemed_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invite_redemptions_code_fkey";
            columns: ["code"];
            isOneToOne: false;
            referencedRelation: "beta_invites";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "invite_redemptions_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      jobs: {
        Row: {
          attempts: number;
          created_at: string;
          error: string | null;
          finished_at: string | null;
          id: string;
          org_id: string;
          payload: NonNullable<Json>;
          progress: number;
          result: Json | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["job_status"];
          type: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          created_at?: string;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          org_id: string;
          payload?: NonNullable<Json>;
          progress?: number;
          result?: Json | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["job_status"];
          type: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          org_id?: string;
          payload?: NonNullable<Json>;
          progress?: number;
          result?: Json | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["job_status"];
          type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      memberships: {
        Row: {
          created_at: string;
          invited_by: string | null;
          org_id: string;
          role: Database["public"]["Enums"]["member_role"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          invited_by?: string | null;
          org_id: string;
          role?: Database["public"]["Enums"]["member_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          invited_by?: string | null;
          org_id?: string;
          role?: Database["public"]["Enums"]["member_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          business_address: string | null;
          created_at: string;
          created_by: string | null;
          currency: Database["public"]["Enums"]["currency"];
          deleted_at: string | null;
          id: string;
          is_demo: boolean;
          last_active_at: string;
          lite_mode_default: boolean;
          market: Database["public"]["Enums"]["market"];
          market_locked: boolean;
          name: string;
          onboarding_completed_at: string | null;
          plan: Database["public"]["Enums"]["plan_id"];
          plan_period_end: string;
          plan_period_start: string;
          slug: string;
          status: Database["public"]["Enums"]["org_status"];
          timezone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          business_address?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency: Database["public"]["Enums"]["currency"];
          deleted_at?: string | null;
          id?: string;
          is_demo?: boolean;
          last_active_at?: string;
          lite_mode_default?: boolean;
          market: Database["public"]["Enums"]["market"];
          market_locked?: boolean;
          name: string;
          onboarding_completed_at?: string | null;
          plan?: Database["public"]["Enums"]["plan_id"];
          plan_period_end?: string;
          plan_period_start?: string;
          slug: string;
          status?: Database["public"]["Enums"]["org_status"];
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          business_address?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency"];
          deleted_at?: string | null;
          id?: string;
          is_demo?: boolean;
          last_active_at?: string;
          lite_mode_default?: boolean;
          market?: Database["public"]["Enums"]["market"];
          market_locked?: boolean;
          name?: string;
          onboarding_completed_at?: string | null;
          plan?: Database["public"]["Enums"]["plan_id"];
          plan_period_end?: string;
          plan_period_start?: string;
          slug?: string;
          status?: Database["public"]["Enums"]["org_status"];
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          full_name: string | null;
          is_founder_admin: boolean;
          onboarding_state: NonNullable<Json>;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          is_founder_admin?: boolean;
          onboarding_state?: NonNullable<Json>;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          is_founder_admin?: boolean;
          onboarding_state?: NonNullable<Json>;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      check_invite_code: { Args: { p_code: string }; Returns: boolean };
      complete_onboarding: { Args: { p_org: string }; Returns: undefined };
      create_organization: {
        Args: {
          p_invite_code?: string;
          p_market: Database["public"]["Enums"]["market"];
          p_name: string;
          p_timezone?: string;
        };
        Returns: {
          business_address: string | null;
          created_at: string;
          created_by: string | null;
          currency: Database["public"]["Enums"]["currency"];
          deleted_at: string | null;
          id: string;
          is_demo: boolean;
          last_active_at: string;
          lite_mode_default: boolean;
          market: Database["public"]["Enums"]["market"];
          market_locked: boolean;
          name: string;
          onboarding_completed_at: string | null;
          plan: Database["public"]["Enums"]["plan_id"];
          plan_period_end: string;
          plan_period_start: string;
          slug: string;
          status: Database["public"]["Enums"]["org_status"];
          timezone: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "organizations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_signup_mode: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["signup_mode"];
      };
      rate_limit_take: {
        Args: { p_capacity: number; p_cost?: number; p_key: string; p_refill_per_second: number };
        Returns: boolean;
      };
      set_org_market: {
        Args: { p_market: Database["public"]["Enums"]["market"]; p_org: string };
        Returns: {
          business_address: string | null;
          created_at: string;
          created_by: string | null;
          currency: Database["public"]["Enums"]["currency"];
          deleted_at: string | null;
          id: string;
          is_demo: boolean;
          last_active_at: string;
          lite_mode_default: boolean;
          market: Database["public"]["Enums"]["market"];
          market_locked: boolean;
          name: string;
          onboarding_completed_at: string | null;
          plan: Database["public"]["Enums"]["plan_id"];
          plan_period_end: string;
          plan_period_start: string;
          slug: string;
          status: Database["public"]["Enums"]["org_status"];
          timezone: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "organizations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      touch_org_activity: { Args: { p_org: string }; Returns: undefined };
    };
    Enums: {
      currency: "GBP" | "NGN";
      feedback_kind: "nps" | "bug" | "idea" | "draft_rating";
      job_status: "queued" | "running" | "succeeded" | "failed";
      market: "UK" | "NG";
      member_role: "owner" | "editor" | "reviewer";
      org_status: "active" | "dormant" | "pruned";
      plan_id: "free" | "growth" | "advanced";
      signup_mode: "open" | "invite" | "closed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      currency: ["GBP", "NGN"],
      feedback_kind: ["nps", "bug", "idea", "draft_rating"],
      job_status: ["queued", "running", "succeeded", "failed"],
      market: ["UK", "NG"],
      member_role: ["owner", "editor", "reviewer"],
      org_status: ["active", "dormant", "pruned"],
      plan_id: ["free", "growth", "advanced"],
      signup_mode: ["open", "invite", "closed"],
    },
  },
} as const;
