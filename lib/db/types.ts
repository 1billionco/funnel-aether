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
      ai_daily_spend: {
        Row: {
          actual_usd: number;
          breached_at: string | null;
          day: string;
          reserved_usd: number;
        };
        ComputedFields: never;
        Insert: {
          actual_usd?: number;
          breached_at?: string | null;
          day: string;
          reserved_usd?: number;
        };
        Update: {
          actual_usd?: number;
          breached_at?: string | null;
          day?: string;
          reserved_usd?: number;
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
      approval_events: {
        Row: {
          action: Database["public"]["Enums"]["approval_action"];
          actor: string | null;
          at: string;
          draft_id: string;
          id: number;
          note: string | null;
          org_id: string;
        };
        ComputedFields: never;
        Insert: {
          action: Database["public"]["Enums"]["approval_action"];
          actor?: string | null;
          at?: string;
          draft_id: string;
          id?: never;
          note?: string | null;
          org_id: string;
        };
        Update: {
          action?: Database["public"]["Enums"]["approval_action"];
          actor?: string | null;
          at?: string;
          draft_id?: string;
          id?: never;
          note?: string | null;
          org_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "approval_events_draft_id_fkey";
            columns: ["draft_id"];
            isOneToOne: false;
            referencedRelation: "drafts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approval_events_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
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
      brand_chunks: {
        Row: {
          brand_id: string;
          chunk_index: number;
          content: string;
          created_at: string;
          document_id: string;
          embedding: string;
          embedding_model: string;
          id: string;
          org_id: string;
          token_count: number;
        };
        ComputedFields: never;
        Insert: {
          brand_id: string;
          chunk_index: number;
          content: string;
          created_at?: string;
          document_id: string;
          embedding: string;
          embedding_model: string;
          id?: string;
          org_id: string;
          token_count?: number;
        };
        Update: {
          brand_id?: string;
          chunk_index?: number;
          content?: string;
          created_at?: string;
          document_id?: string;
          embedding?: string;
          embedding_model?: string;
          id?: string;
          org_id?: string;
          token_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "brand_chunks_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_chunks_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "brand_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_chunks_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      brand_documents: {
        Row: {
          brand_id: string;
          char_count: number;
          chunk_count: number;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          doc_type: string;
          error: string | null;
          filename: string | null;
          id: string;
          keep_original: boolean;
          mime: string | null;
          org_id: string;
          processed_at: string | null;
          size_bytes: number | null;
          source: Database["public"]["Enums"]["document_source"];
          source_url: string | null;
          status: Database["public"]["Enums"]["document_status"];
          storage_path: string | null;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          brand_id: string;
          char_count?: number;
          chunk_count?: number;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          doc_type?: string;
          error?: string | null;
          filename?: string | null;
          id?: string;
          keep_original?: boolean;
          mime?: string | null;
          org_id: string;
          processed_at?: string | null;
          size_bytes?: number | null;
          source: Database["public"]["Enums"]["document_source"];
          source_url?: string | null;
          status?: Database["public"]["Enums"]["document_status"];
          storage_path?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          brand_id?: string;
          char_count?: number;
          chunk_count?: number;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          doc_type?: string;
          error?: string | null;
          filename?: string | null;
          id?: string;
          keep_original?: boolean;
          mime?: string | null;
          org_id?: string;
          processed_at?: string | null;
          size_bytes?: number | null;
          source?: Database["public"]["Enums"]["document_source"];
          source_url?: string | null;
          status?: Database["public"]["Enums"]["document_status"];
          storage_path?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brand_documents_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "brand_documents_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
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
      credit_ledger: {
        Row: {
          balance_after: number;
          created_at: string;
          delta: number;
          id: number;
          note: string | null;
          org_id: string;
          reason: Database["public"]["Enums"]["ledger_reason"];
          ref_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          balance_after: number;
          created_at?: string;
          delta: number;
          id?: never;
          note?: string | null;
          org_id: string;
          reason: Database["public"]["Enums"]["ledger_reason"];
          ref_id?: string | null;
        };
        Update: {
          balance_after?: number;
          created_at?: string;
          delta?: number;
          id?: never;
          note?: string | null;
          org_id?: string;
          reason?: Database["public"]["Enums"]["ledger_reason"];
          ref_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "credit_ledger_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      draft_versions: {
        Row: {
          body: string;
          created_at: string;
          created_by: string | null;
          draft_id: string;
          feedback_text: string | null;
          id: string;
          metadata: NonNullable<Json>;
          model_used: string | null;
          org_id: string;
          source: Database["public"]["Enums"]["version_source"];
          version: number;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          created_at?: string;
          created_by?: string | null;
          draft_id: string;
          feedback_text?: string | null;
          id?: string;
          metadata?: NonNullable<Json>;
          model_used?: string | null;
          org_id: string;
          source: Database["public"]["Enums"]["version_source"];
          version: number;
        };
        Update: {
          body?: string;
          created_at?: string;
          created_by?: string | null;
          draft_id?: string;
          feedback_text?: string | null;
          id?: string;
          metadata?: NonNullable<Json>;
          model_used?: string | null;
          org_id?: string;
          source?: Database["public"]["Enums"]["version_source"];
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "draft_versions_draft_id_fkey";
            columns: ["draft_id"];
            isOneToOne: false;
            referencedRelation: "drafts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "draft_versions_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      drafts: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          body: string;
          brand_id: string;
          brand_match_reasons: NonNullable<Json>;
          brand_match_score: number | null;
          channel: string;
          created_at: string;
          created_by: string | null;
          credits_used: number;
          error: string | null;
          flags: NonNullable<Json>;
          generation_started_at: string | null;
          id: string;
          is_mock: boolean;
          metadata: NonNullable<Json>;
          model_used: string | null;
          org_id: string;
          posted_at: string | null;
          prompt_version: string | null;
          rejected_reason: string | null;
          router_reason: string | null;
          scheduled_for: string | null;
          sent_at: string | null;
          status: Database["public"]["Enums"]["draft_status"];
          tier: string | null;
          title: string | null;
          type: Database["public"]["Enums"]["draft_type"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          body?: string;
          brand_id: string;
          brand_match_reasons?: NonNullable<Json>;
          brand_match_score?: number | null;
          channel: string;
          created_at?: string;
          created_by?: string | null;
          credits_used?: number;
          error?: string | null;
          flags?: NonNullable<Json>;
          generation_started_at?: string | null;
          id?: string;
          is_mock?: boolean;
          metadata?: NonNullable<Json>;
          model_used?: string | null;
          org_id: string;
          posted_at?: string | null;
          prompt_version?: string | null;
          rejected_reason?: string | null;
          router_reason?: string | null;
          scheduled_for?: string | null;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["draft_status"];
          tier?: string | null;
          title?: string | null;
          type: Database["public"]["Enums"]["draft_type"];
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          body?: string;
          brand_id?: string;
          brand_match_reasons?: NonNullable<Json>;
          brand_match_score?: number | null;
          channel?: string;
          created_at?: string;
          created_by?: string | null;
          credits_used?: number;
          error?: string | null;
          flags?: NonNullable<Json>;
          generation_started_at?: string | null;
          id?: string;
          is_mock?: boolean;
          metadata?: NonNullable<Json>;
          model_used?: string | null;
          org_id?: string;
          posted_at?: string | null;
          prompt_version?: string | null;
          rejected_reason?: string | null;
          router_reason?: string | null;
          scheduled_for?: string | null;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["draft_status"];
          tier?: string | null;
          title?: string | null;
          type?: Database["public"]["Enums"]["draft_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "drafts_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "drafts_org_id_fkey";
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
      generation_reservations: {
        Row: {
          actual_cost_usd: number | null;
          actual_millicredits: number | null;
          created_at: string;
          day: string;
          draft_id: string | null;
          est_cost_usd: number;
          est_millicredits: number;
          id: string;
          org_id: string;
          settled_at: string | null;
          status: Database["public"]["Enums"]["reservation_status"];
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          actual_cost_usd?: number | null;
          actual_millicredits?: number | null;
          created_at?: string;
          day?: string;
          draft_id?: string | null;
          est_cost_usd?: number;
          est_millicredits: number;
          id?: string;
          org_id: string;
          settled_at?: string | null;
          status?: Database["public"]["Enums"]["reservation_status"];
          user_id?: string | null;
        };
        Update: {
          actual_cost_usd?: number | null;
          actual_millicredits?: number | null;
          created_at?: string;
          day?: string;
          draft_id?: string | null;
          est_cost_usd?: number;
          est_millicredits?: number;
          id?: string;
          org_id?: string;
          settled_at?: string | null;
          status?: Database["public"]["Enums"]["reservation_status"];
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "generation_reservations_org_id_fkey";
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
      model_prices: {
        Row: {
          cache_read_per_mtok: number | null;
          cache_write_per_mtok: number | null;
          input_per_mtok: number | null;
          model: string;
          notes: string | null;
          output_per_mtok: number | null;
          provider: string;
          updated_at: string;
          verified_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          cache_read_per_mtok?: number | null;
          cache_write_per_mtok?: number | null;
          input_per_mtok?: number | null;
          model: string;
          notes?: string | null;
          output_per_mtok?: number | null;
          provider: string;
          updated_at?: string;
          verified_at?: string | null;
        };
        Update: {
          cache_read_per_mtok?: number | null;
          cache_write_per_mtok?: number | null;
          input_per_mtok?: number | null;
          model?: string;
          notes?: string | null;
          output_per_mtok?: number | null;
          provider?: string;
          updated_at?: string;
          verified_at?: string | null;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          business_address: string | null;
          created_at: string;
          created_by: string | null;
          credit_balance_milli: number;
          credits_granted_for: string | null;
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
          credit_balance_milli?: number;
          credits_granted_for?: string | null;
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
          credit_balance_milli?: number;
          credits_granted_for?: string | null;
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
      usage_events: {
        Row: {
          at: string;
          cache_write_tokens: number;
          cached_tokens: number;
          est_cost_usd: number;
          feature: string;
          id: number;
          input_tokens: number;
          is_mock: boolean;
          latency_ms: number | null;
          model: string;
          org_id: string | null;
          output_tokens: number;
          provider: string;
          ref_id: string | null;
          router_reason: string | null;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          at?: string;
          cache_write_tokens?: number;
          cached_tokens?: number;
          est_cost_usd?: number;
          feature: string;
          id?: never;
          input_tokens?: number;
          is_mock?: boolean;
          latency_ms?: number | null;
          model: string;
          org_id?: string | null;
          output_tokens?: number;
          provider: string;
          ref_id?: string | null;
          router_reason?: string | null;
          user_id?: string | null;
        };
        Update: {
          at?: string;
          cache_write_tokens?: number;
          cached_tokens?: number;
          est_cost_usd?: number;
          feature?: string;
          id?: never;
          input_tokens?: number;
          is_mock?: boolean;
          latency_ms?: number | null;
          model?: string;
          org_id?: string | null;
          output_tokens?: number;
          provider?: string;
          ref_id?: string | null;
          router_reason?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "usage_events_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      brand_centroid: { Args: { p_brand: string; p_model: string }; Returns: string };
      brand_document_stats: {
        Args: { p_brand: string };
        Returns: {
          chunk_count: number;
          doc_types: string[];
          document_count: number;
        }[];
      };
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
          credit_balance_milli: number;
          credits_granted_for: string | null;
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
      ensure_credit_grant: { Args: { p_allowance: number; p_org: string }; Returns: number };
      get_signup_mode: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["signup_mode"];
      };
      match_brand_chunks: {
        Args: { p_brand: string; p_k?: number; p_model: string; p_query: string };
        Returns: {
          content: string;
          document_id: string;
          id: string;
          similarity: number;
        }[];
      };
      rate_limit_take: {
        Args: { p_capacity: number; p_cost?: number; p_key: string; p_refill_per_second: number };
        Returns: boolean;
      };
      refund_generation: {
        Args: { p_actual_cost_usd?: number; p_reservation: string };
        Returns: number;
      };
      reserve_generation: {
        Args: {
          p_allowance: number;
          p_daily_cap: number;
          p_draft: string;
          p_est_cost_usd: number;
          p_est_millicredits: number;
          p_org: string;
          p_user: string;
        };
        Returns: Json;
      };
      set_org_market: {
        Args: { p_market: Database["public"]["Enums"]["market"]; p_org: string };
        Returns: {
          business_address: string | null;
          created_at: string;
          created_by: string | null;
          credit_balance_milli: number;
          credits_granted_for: string | null;
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
      settle_generation: {
        Args: { p_actual_cost_usd: number; p_actual_millicredits: number; p_reservation: string };
        Returns: number;
      };
      sweep_stuck_drafts: { Args: { p_older_than?: string }; Returns: number };
      touch_org_activity: { Args: { p_org: string }; Returns: undefined };
    };
    Enums: {
      approval_action:
        | "approve"
        | "edit"
        | "reject"
        | "regenerate"
        | "schedule"
        | "send"
        | "post"
        | "undo"
        | "archive";
      currency: "GBP" | "NGN";
      document_source: "upload" | "paste" | "url";
      document_status: "uploading" | "queued" | "processing" | "ready" | "failed";
      draft_status:
        | "generating"
        | "partial"
        | "failed"
        | "pending"
        | "approved"
        | "rejected"
        | "scheduled"
        | "sent"
        | "posted"
        | "archived";
      draft_type:
        "social_post" | "email" | "whatsapp" | "landing_copy" | "seo_brief" | "campaign_step";
      feedback_kind: "nps" | "bug" | "idea" | "draft_rating";
      job_status: "queued" | "running" | "succeeded" | "failed";
      ledger_reason: "monthly_grant" | "generation" | "pack_purchase" | "refund" | "admin_adjust";
      market: "UK" | "NG";
      member_role: "owner" | "editor" | "reviewer";
      org_status: "active" | "dormant" | "pruned";
      plan_id: "free" | "growth" | "advanced";
      reservation_status: "reserved" | "settled" | "refunded";
      signup_mode: "open" | "invite" | "closed";
      version_source: "ai" | "human_edit" | "ai_regen";
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
      approval_action: [
        "approve",
        "edit",
        "reject",
        "regenerate",
        "schedule",
        "send",
        "post",
        "undo",
        "archive",
      ],
      currency: ["GBP", "NGN"],
      document_source: ["upload", "paste", "url"],
      document_status: ["uploading", "queued", "processing", "ready", "failed"],
      draft_status: [
        "generating",
        "partial",
        "failed",
        "pending",
        "approved",
        "rejected",
        "scheduled",
        "sent",
        "posted",
        "archived",
      ],
      draft_type: [
        "social_post",
        "email",
        "whatsapp",
        "landing_copy",
        "seo_brief",
        "campaign_step",
      ],
      feedback_kind: ["nps", "bug", "idea", "draft_rating"],
      job_status: ["queued", "running", "succeeded", "failed"],
      ledger_reason: ["monthly_grant", "generation", "pack_purchase", "refund", "admin_adjust"],
      market: ["UK", "NG"],
      member_role: ["owner", "editor", "reviewer"],
      org_status: ["active", "dormant", "pruned"],
      plan_id: ["free", "growth", "advanced"],
      reservation_status: ["reserved", "settled", "refunded"],
      signup_mode: ["open", "invite", "closed"],
      version_source: ["ai", "human_edit", "ai_regen"],
    },
  },
} as const;
