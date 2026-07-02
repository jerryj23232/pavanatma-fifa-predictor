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
      achievements: {
        Row: {
          code: Database["public"]["Enums"]["achievement_code"]
          description: string
          emoji: string
          name: string
          sort_order: number
        }
        Insert: {
          code: Database["public"]["Enums"]["achievement_code"]
          description: string
          emoji: string
          name: string
          sort_order?: number
        }
        Update: {
          code?: Database["public"]["Enums"]["achievement_code"]
          description?: string
          emoji?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      bonus_challenges: {
        Row: {
          correct_teams: Json | null
          created_at: string
          deadline: string
          description: string | null
          evaluated_at: string | null
          id: string
          is_active: boolean
          team_pool: Json
          title: string
          updated_at: string
        }
        Insert: {
          correct_teams?: Json | null
          created_at?: string
          deadline: string
          description?: string | null
          evaluated_at?: string | null
          id?: string
          is_active?: boolean
          team_pool?: Json
          title: string
          updated_at?: string
        }
        Update: {
          correct_teams?: Json | null
          created_at?: string
          deadline?: string
          description?: string | null
          evaluated_at?: string | null
          id?: string
          is_active?: boolean
          team_pool?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      bonus_predictions: {
        Row: {
          awarded_at: string | null
          challenge_id: string
          created_at: string
          id: string
          points_awarded: number
          teams: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          awarded_at?: string | null
          challenge_id: string
          created_at?: string
          id?: string
          points_awarded?: number
          teams: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          awarded_at?: string | null
          challenge_id?: string
          created_at?: string
          id?: string
          points_awarded?: number
          teams?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_predictions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "bonus_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_flag: string | null
          away_score: number | null
          away_team: string
          created_at: string
          external_id: string | null
          group_name: string | null
          home_flag: string | null
          home_score: number | null
          home_team: string
          id: string
          kickoff_at: string
          minute: number | null
          stage: string
          status: Database["public"]["Enums"]["match_status"]
          updated_at: string
          venue: string | null
          winner: string | null
        }
        Insert: {
          away_flag?: string | null
          away_score?: number | null
          away_team: string
          created_at?: string
          external_id?: string | null
          group_name?: string | null
          home_flag?: string | null
          home_score?: number | null
          home_team: string
          id?: string
          kickoff_at: string
          minute?: number | null
          stage?: string
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          venue?: string | null
          winner?: string | null
        }
        Update: {
          away_flag?: string | null
          away_score?: number | null
          away_team?: string
          created_at?: string
          external_id?: string | null
          group_name?: string | null
          home_flag?: string | null
          home_score?: number | null
          home_team?: string
          id?: string
          kickoff_at?: string
          minute?: number | null
          stage?: string
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          venue?: string | null
          winner?: string | null
        }
        Relationships: []
      }
      predictions: {
        Row: {
          created_at: string
          id: string
          match_id: string
          points: number
          predicted_away: number
          predicted_home: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          points?: number
          predicted_away: number
          predicted_home: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          points?: number
          predicted_away?: number
          predicted_home?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          course: string | null
          created_at: string
          full_name: string
          id: string
          updated_at: string
          year: string | null
        }
        Insert: {
          avatar_url?: string | null
          course?: string | null
          created_at?: string
          full_name?: string
          id: string
          updated_at?: string
          year?: string | null
        }
        Update: {
          avatar_url?: string | null
          course?: string | null
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
          year?: string | null
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          code: Database["public"]["Enums"]["achievement_code"]
          earned_at: string
          user_id: string
        }
        Insert: {
          code: Database["public"]["Enums"]["achievement_code"]
          earned_at?: string
          user_id: string
        }
        Update: {
          code?: Database["public"]["Enums"]["achievement_code"]
          earned_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["code"]
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
      user_stats: {
        Row: {
          accuracy_percentage: number
          average_points_per_match: number
          best_matchday_score: number
          bonus_points: number
          completed_predictions: number
          correct_winners: number
          current_rank: number | null
          current_streak: number
          exact_scores: number
          longest_streak: number
          prediction_points: number
          predictions_count: number
          previous_rank: number | null
          rank_snapshot_at: string | null
          total_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy_percentage?: number
          average_points_per_match?: number
          best_matchday_score?: number
          bonus_points?: number
          completed_predictions?: number
          correct_winners?: number
          current_rank?: number | null
          current_streak?: number
          exact_scores?: number
          longest_streak?: number
          prediction_points?: number
          predictions_count?: number
          previous_rank?: number | null
          rank_snapshot_at?: string | null
          total_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy_percentage?: number
          average_points_per_match?: number
          best_matchday_score?: number
          bonus_points?: number
          completed_predictions?: number
          correct_winners?: number
          current_rank?: number | null
          current_streak?: number
          exact_scores?: number
          longest_streak?: number
          prediction_points?: number
          predictions_count?: number
          previous_rank?: number | null
          rank_snapshot_at?: string | null
          total_points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calc_points: {
        Args: { _ah: number; _aw: number; _pa: number; _ph: number }
        Returns: number
      }
      evaluate_bonus_challenge: {
        Args: { _challenge_id: string; _correct_teams: Json }
        Returns: number
      }
      get_leaderboard: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
          badges: Json
          course: string
          current_rank: number
          full_name: string
          hits: number
          predictions_made: number
          previous_rank: number
          total_points: number
          user_id: string
        }[]
      }
      get_match_trends: {
        Args: { _match_id: string; _min_predictions?: number }
        Returns: Json
      }
      get_period_leaderboard: {
        Args: { _limit?: number; _period: string }
        Returns: {
          avatar_url: string
          full_name: string
          total_points: number
          user_id: string
        }[]
      }
      get_user_stats: { Args: { _user_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recalc_user_stats: { Args: { _user_id: string }; Returns: undefined }
      snapshot_leaderboard_ranks: { Args: never; Returns: undefined }
      verify_sync_webhook: { Args: { _token: string }; Returns: boolean }
    }
    Enums: {
      achievement_code:
        | "first_exact"
        | "streak_5"
        | "winners_10"
        | "points_100"
        | "veteran_50"
        | "top_3"
        | "league_leader"
      app_role: "admin" | "user"
      match_status: "scheduled" | "live" | "completed"
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
      achievement_code: [
        "first_exact",
        "streak_5",
        "winners_10",
        "points_100",
        "veteran_50",
        "top_3",
        "league_leader",
      ],
      app_role: ["admin", "user"],
      match_status: ["scheduled", "live", "completed"],
    },
  },
} as const
