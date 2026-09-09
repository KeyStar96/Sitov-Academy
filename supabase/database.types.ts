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
      cancellations: {
        Row: {
          confirmation_mail_sent: boolean | null
          course_name: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          termination_date: string | null
          termination_type: string
        }
        Insert: {
          confirmation_mail_sent?: boolean | null
          course_name?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          termination_date?: string | null
          termination_type: string
        }
        Update: {
          confirmation_mail_sent?: boolean | null
          course_name?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          termination_date?: string | null
          termination_type?: string
        }
        Relationships: []
      }
      course_exceptions: {
        Row: {
          course_ids: string[] | null
          date: string
          id: string
          reason: string
        }
        Insert: {
          course_ids?: string[] | null
          date: string
          id?: string
          reason: string
        }
        Update: {
          course_ids?: string[] | null
          date?: string
          id?: string
          reason?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          booking_id: string
          created_at: string | null
          end_date: string | null
          id: string
          instructor: string
          price: number
          sessions: Json
          start_date: string | null
          title: string | null
          translation_key: string
          trial_lessons: boolean | null
          type: string
          unit_duration: number
        }
        Insert: {
          booking_id?: string
          created_at?: string | null
          end_date?: string | null
          id: string
          instructor: string
          price: number
          sessions?: Json
          start_date?: string | null
          title?: string | null
          translation_key: string
          trial_lessons?: boolean | null
          type: string
          unit_duration: number
        }
        Update: {
          booking_id?: string
          created_at?: string | null
          end_date?: string | null
          id?: string
          instructor?: string
          price?: number
          sessions?: Json
          start_date?: string | null
          title?: string | null
          translation_key?: string
          trial_lessons?: boolean | null
          type?: string
          unit_duration?: number
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          assigned_at: string | null
          course_id: string
          price: number | null
          registration_id: string
        }
        Insert: {
          assigned_at?: string | null
          course_id: string
          price?: number | null
          registration_id: string
        }
        Update: {
          assigned_at?: string | null
          course_id?: string
          price?: number | null
          registration_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          content: Json
          created_at: string | null
          hint_ru: string | null
          hint_tr: string | null
          id: string
          lesson: string
          level: string
          solution_audio_url: string | null
          topic: string
          type: string
        }
        Insert: {
          content: Json
          created_at?: string | null
          hint_ru?: string | null
          hint_tr?: string | null
          id?: string
          lesson: string
          level?: string
          solution_audio_url?: string | null
          topic: string
          type: string
        }
        Update: {
          content?: Json
          created_at?: string | null
          hint_ru?: string | null
          hint_tr?: string | null
          id?: string
          lesson?: string
          level?: string
          solution_audio_url?: string | null
          topic?: string
          type?: string
        }
        Relationships: []
      }
      monthly_course_bookings: {
        Row: {
          id: string
          user_id: string
          target_month: string
          course_ids: string[]
          status: string
        }
        Insert: {
          id?: string
          user_id?: string
          target_month: string
          course_ids: string[]
          status?: string
        }
        Update: {
          id?: string
          user_id?: string
          target_month?: string
          course_ids?: string[]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_course_bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_student_notes: {
        Row: {
          id: string
          student_id: string
          teacher_id: string
          note_text: string
          discount_percent: number
        }
        Insert: {
          id?: string
          student_id: string
          teacher_id?: string
          note_text: string
          discount_percent?: number
        }
        Update: {
          id?: string
          student_id?: string
          teacher_id?: string
          note_text?: string
          discount_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "teacher_student_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_student_notes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          legacy_user_id: string | null
          phone: string | null
          street: string | null
          zip_code: string | null
          city: string | null
          allowed_levels: string[]
          created_at: string | null
          email: string
          id: string
          name: string | null
          native_language: string | null
          role: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          ui_language: string
          updated_at: string | null
        }
        Insert: {
          legacy_user_id?: string | null
          phone?: string | null
          street?: string | null
          zip_code?: string | null
          city?: string | null
          allowed_levels?: string[]
          created_at?: string | null
          email: string
          id: string
          name?: string | null
          native_language?: string | null
          role?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          ui_language?: string
          updated_at?: string | null
        }
        Update: {
          legacy_user_id?: string | null
          phone?: string | null
          street?: string | null
          zip_code?: string | null
          city?: string | null
          allowed_levels?: string[]
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          native_language?: string | null
          role?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          ui_language?: string
          updated_at?: string | null
        }
        Relationships: [{
          foreignKeyName: "profiles_legacy_user_id_fkey"
          columns: ["legacy_user_id"]
          isOneToOne: false
          referencedRelation: "users"
          referencedColumns: ["id"]
        }]
      }
      pronunciation_prompts: {
        Row: {
          audio_url: string | null
          cefr_level: string
          created_at: string | null
          focus: string | null
          id: string
          sentence_de: string
          sort_order: number
        }
        Insert: {
          audio_url?: string | null
          cefr_level: string
          created_at?: string | null
          focus?: string | null
          id?: string
          sentence_de: string
          sort_order?: number
        }
        Update: {
          audio_url?: string | null
          cefr_level?: string
          created_at?: string | null
          focus?: string | null
          id?: string
          sentence_de?: string
          sort_order?: number
        }
        Relationships: []
      }
      registrations: {
        Row: {
          agb_accepted: boolean
          cancellation_mail_sent: boolean | null
          confirmation_mail_sent: boolean | null
          course_ids: string[] | null
          course_prices: Json | null
          created_at: string | null
          id: string
          privacy_accepted: boolean
          revocation_waiver_accepted: boolean
          start_date: string | null
          status: string
          total_price: number | null
          user_id: string
          video_recording_accepted: boolean | null
        }
        Insert: {
          agb_accepted?: boolean
          cancellation_mail_sent?: boolean | null
          confirmation_mail_sent?: boolean | null
          course_ids?: string[] | null
          course_prices?: Json | null
          created_at?: string | null
          id?: string
          privacy_accepted?: boolean
          revocation_waiver_accepted?: boolean
          start_date?: string | null
          status?: string
          total_price?: number | null
          user_id: string
          video_recording_accepted?: boolean | null
        }
        Update: {
          agb_accepted?: boolean
          cancellation_mail_sent?: boolean | null
          confirmation_mail_sent?: boolean | null
          course_ids?: string[] | null
          course_prices?: Json | null
          created_at?: string | null
          id?: string
          privacy_accepted?: boolean
          revocation_waiver_accepted?: boolean
          start_date?: string | null
          status?: string
          total_price?: number | null
          user_id?: string
          video_recording_accepted?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          attempt_number: number | null
          content_url: string | null
          created_at: string | null
          id: string
          level: string
          parent_id: string | null
          status: string | null
          text_content: string | null
          type: string
          user_id: string
        }
        Insert: {
          attempt_number?: number | null
          content_url?: string | null
          created_at?: string | null
          id?: string
          level?: string
          parent_id?: string | null
          status?: string | null
          text_content?: string | null
          type: string
          user_id: string
        }
        Update: {
          attempt_number?: number | null
          content_url?: string | null
          created_at?: string | null
          id?: string
          level?: string
          parent_id?: string | null
          status?: string | null
          text_content?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_feedback: {
        Row: {
          created_at: string | null
          feedback_audio_url: string | null
          feedback_text: string
          id: string
          seen_at: string | null
          submission_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string | null
          feedback_audio_url?: string | null
          feedback_text: string
          id?: string
          seen_at?: string | null
          submission_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string | null
          feedback_audio_url?: string | null
          feedback_text?: string
          id?: string
          seen_at?: string | null
          submission_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_feedback_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_feedback_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_lessons: {
        Row: {
          birth_date: string | null
          cancellation_mail_sent: boolean | null
          city: string | null
          confirmation_mail_sent: boolean | null
          course_id: string | null
          created_at: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string | null
          status: string
          street: string | null
          trial_date: string
          video_recording_accepted: boolean | null
          zip: string | null
        }
        Insert: {
          birth_date?: string | null
          cancellation_mail_sent?: boolean | null
          city?: string | null
          confirmation_mail_sent?: boolean | null
          course_id?: string | null
          created_at?: string | null
          email: string
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          status?: string
          street?: string | null
          trial_date: string
          video_recording_accepted?: boolean | null
          zip?: string | null
        }
        Update: {
          birth_date?: string | null
          cancellation_mail_sent?: boolean | null
          city?: string | null
          confirmation_mail_sent?: boolean | null
          course_id?: string | null
          created_at?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          status?: string
          street?: string | null
          trial_date?: string
          video_recording_accepted?: boolean | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trial_lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_exercise_progress: {
        Row: {
          attempts: number
          completed: boolean | null
          created_at: string | null
          exercise_id: string
          hint_shown: boolean
          id: string
          score: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          completed?: boolean | null
          created_at?: string | null
          exercise_id: string
          hint_shown?: boolean
          id?: string
          score?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          completed?: boolean | null
          created_at?: string | null
          exercise_id?: string
          hint_shown?: boolean
          id?: string
          score?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_exercise_progress_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_exercise_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_vocabulary_progress: {
        Row: {
          box_number: number | null
          card_id: string
          created_at: string | null
          id: string
          lapses: number
          last_answered_at: string | null
          next_review_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          box_number?: number | null
          card_id: string
          created_at?: string | null
          id?: string
          lapses?: number
          last_answered_at?: string | null
          next_review_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          box_number?: number | null
          card_id?: string
          created_at?: string | null
          id?: string
          lapses?: number
          last_answered_at?: string | null
          next_review_date?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_vocabulary_progress_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "vocabulary_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_vocabulary_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          birth_date: string
          city: string | null
          created_at: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string | null
          street: string | null
          zip: string | null
        }
        Insert: {
          birth_date: string
          city?: string | null
          created_at?: string | null
          email: string
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          street?: string | null
          zip?: string | null
        }
        Update: {
          birth_date?: string
          city?: string | null
          created_at?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          street?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      videos: {
        Row: {
          created_at: string | null
          description: string | null
          external_url: string | null
          id: string
          is_external: boolean | null
          lesson: string
          level: string
          title: string
          video_url: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          external_url?: string | null
          id?: string
          is_external?: boolean | null
          lesson: string
          level?: string
          title: string
          video_url?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          external_url?: string | null
          id?: string
          is_external?: boolean | null
          lesson?: string
          level?: string
          title?: string
          video_url?: string | null
        }
        Relationships: []
      }
      vocabulary_cards: {
        Row: {
          article: string | null
          audio_url: string | null
          created_at: string | null
          id: string
          image_url: string | null
          is_hard_for_ru: boolean | null
          is_hard_for_tr: boolean | null
          lesson: string
          level: string
          plural: string | null
          translation_en: string | null
          translation_ru: string | null
          translation_tr: string | null
          word_de: string
        }
        Insert: {
          article?: string | null
          audio_url?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_hard_for_ru?: boolean | null
          is_hard_for_tr?: boolean | null
          lesson: string
          level?: string
          plural?: string | null
          translation_en?: string | null
          translation_ru?: string | null
          translation_tr?: string | null
          word_de: string
        }
        Update: {
          article?: string | null
          audio_url?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_hard_for_ru?: boolean | null
          is_hard_for_tr?: boolean | null
          lesson?: string
          level?: string
          plural?: string | null
          translation_en?: string | null
          translation_ru?: string | null
          translation_tr?: string | null
          word_de?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      save_next_month_booking: {
        Args: {
          p_target_month: string
          p_course_ids: string[]
          p_paused: boolean
          p_expected_id?: string | null
          p_expected_course_ids?: string[] | null
          p_expected_status?: string | null
        }
        Returns: Database["public"]["Tables"]["monthly_course_bookings"]["Row"][]
      }
      mark_feedback_seen: {
        Args: { p_submission_id: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
