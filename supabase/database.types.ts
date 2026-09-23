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
    PostgrestVersion: "14.6"
  }
  public: {
    Tables: {
      booking_items: {
        Row: {
          amount: number
          booking_id: string
          course_id: string
          id: string
          requested_units: number | null
          title_snapshot: string
          unit_minutes: number
          unit_price: number
          units: number
        }
        Insert: {
          amount: number
          booking_id: string
          course_id: string
          id?: string
          requested_units?: number | null
          title_snapshot: string
          unit_minutes: number
          unit_price: number
          units: number
        }
        Update: {
          amount?: number
          booking_id?: string
          course_id?: string
          id?: string
          requested_units?: number | null
          title_snapshot?: string
          unit_minutes?: number
          unit_price?: number
          units?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_items_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          agb_accepted: boolean
          confirmed_at: string | null
          confirmed_by: string | null
          contact_birth_date: string | null
          contact_city: string | null
          contact_email: string
          contact_name: string
          contact_phone: string | null
          contact_postal_code: string | null
          contact_street: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["booking_kind"]
          person_id: string
          privacy_accepted: boolean
          recording_accepted: boolean | null
          revision: number
          revocation_accepted: boolean
          start_date: string
          status: Database["public"]["Enums"]["booking_status"]
          target_month: string
          updated_at: string
        }
        Insert: {
          agb_accepted: boolean
          confirmed_at?: string | null
          confirmed_by?: string | null
          contact_birth_date?: string | null
          contact_city?: string | null
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          contact_postal_code?: string | null
          contact_street?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["booking_kind"]
          person_id: string
          privacy_accepted: boolean
          recording_accepted?: boolean | null
          revision?: number
          revocation_accepted?: boolean
          start_date: string
          status?: Database["public"]["Enums"]["booking_status"]
          target_month: string
          updated_at?: string
        }
        Update: {
          agb_accepted?: boolean
          confirmed_at?: string | null
          confirmed_by?: string | null
          contact_birth_date?: string | null
          contact_city?: string | null
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          contact_postal_code?: string | null
          contact_street?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["booking_kind"]
          person_id?: string
          privacy_accepted?: boolean
          recording_accepted?: boolean | null
          revision?: number
          revocation_accepted?: boolean
          start_date?: string
          status?: Database["public"]["Enums"]["booking_status"]
          target_month?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_requests: {
        Row: {
          course_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          processed_at: string | null
          termination_date: string | null
          termination_type: Database["public"]["Enums"]["cancellation_type"]
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          processed_at?: string | null
          termination_date?: string | null
          termination_type: Database["public"]["Enums"]["cancellation_type"]
        }
        Update: {
          course_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          processed_at?: string | null
          termination_date?: string | null
          termination_type?: Database["public"]["Enums"]["cancellation_type"]
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_requests_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      cefr_levels: {
        Row: {
          code: Database["public"]["Enums"]["cefr_code"]
        }
        Insert: {
          code: Database["public"]["Enums"]["cefr_code"]
        }
        Update: {
          code?: Database["public"]["Enums"]["cefr_code"]
        }
        Relationships: []
      }
      course_audiences: {
        Row: {
          code: string
        }
        Insert: {
          code: string
        }
        Update: {
          code?: string
        }
        Relationships: []
      }
      course_exceptions: {
        Row: {
          course_id: string | null
          date: string
          id: string
          reason: string
        }
        Insert: {
          course_id?: string | null
          date: string
          id?: string
          reason: string
        }
        Update: {
          course_id?: string | null
          date?: string
          id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_exceptions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_schedules: {
        Row: {
          course_id: string
          end_time: string
          id: string
          start_time: string
          weekday: number
        }
        Insert: {
          course_id: string
          end_time: string
          id?: string
          start_time: string
          weekday: number
        }
        Update: {
          course_id?: string
          end_time?: string
          id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_schedules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_translations: {
        Row: {
          course_id: string
          description: string
          locale: string
          title: string
        }
        Insert: {
          course_id: string
          description?: string
          locale: string
          title: string
        }
        Update: {
          course_id?: string
          description?: string
          locale?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_translations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_translations_locale_fkey"
            columns: ["locale"]
            isOneToOne: false
            referencedRelation: "locales"
            referencedColumns: ["code"]
          },
        ]
      }
      courses: {
        Row: {
          archived_at: string | null
          audience_code: string | null
          category: Database["public"]["Enums"]["course_category"]
          created_at: string
          description: string
          end_date: string | null
          id: string
          level: string | null
          slug: string
          sort_order: number
          start_date: string | null
          title: string
          trial_lessons: boolean
          type: Database["public"]["Enums"]["course_type"]
          unit_minutes: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          audience_code?: string | null
          category: Database["public"]["Enums"]["course_category"]
          created_at?: string
          description?: string
          end_date?: string | null
          id?: string
          level?: string | null
          slug: string
          sort_order?: number
          start_date?: string | null
          title: string
          trial_lessons?: boolean
          type: Database["public"]["Enums"]["course_type"]
          unit_minutes?: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          audience_code?: string | null
          category?: Database["public"]["Enums"]["course_category"]
          created_at?: string
          description?: string
          end_date?: string | null
          id?: string
          level?: string | null
          slug?: string
          sort_order?: number
          start_date?: string | null
          title?: string
          trial_lessons?: boolean
          type?: Database["public"]["Enums"]["course_type"]
          unit_minutes?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_audience_code_fkey"
            columns: ["audience_code"]
            isOneToOne: false
            referencedRelation: "course_audiences"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "courses_level_fkey"
            columns: ["level"]
            isOneToOne: false
            referencedRelation: "learning_levels"
            referencedColumns: ["code"]
          },
        ]
      }
      grammar_translations: {
        Row: {
          exercise_id: string
          explanation: string | null
          hint: string | null
          locale: string
          prompt: string | null
          smart_hint: string | null
        }
        Insert: {
          exercise_id: string
          explanation?: string | null
          hint?: string | null
          locale: string
          prompt?: string | null
          smart_hint?: string | null
        }
        Update: {
          exercise_id?: string
          explanation?: string | null
          hint?: string | null
          locale?: string
          prompt?: string | null
          smart_hint?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grammar_locale_fk"
            columns: ["locale"]
            isOneToOne: false
            referencedRelation: "locales"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "grammar_translations_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "learning_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_cases: {
        Row: {
          booking_id: string
          created_by: string | null
          id: string
          invoice_created_at: string | null
          invoice_reference: string | null
          person_id: string
          status: Database["public"]["Enums"]["invoice_status"]
          target_month: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_by?: string | null
          id?: string
          invoice_created_at?: string | null
          invoice_reference?: string | null
          person_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
          target_month: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_by?: string | null
          id?: string
          invoice_created_at?: string | null
          invoice_reference?: string | null
          person_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          target_month?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_cases_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_cases_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_activity_days: {
        Row: {
          auth_user_id: string
          day: string
        }
        Insert: {
          auth_user_id: string
          day: string
        }
        Update: {
          auth_user_id?: string
          day?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_activity_days_auth_user_id_fkey"
            columns: ["auth_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_exercises: {
        Row: {
          content: Json
          content_status:
            | Database["public"]["Enums"]["learning_content_status"]
            | null
          content_version: number
          created_at: string | null
          id: string
          solution_audio_url: string | null
          topic: string
          type: Database["public"]["Enums"]["exercise_type"]
          unit_id: string
        }
        Insert: {
          content: Json
          content_status?:
            | Database["public"]["Enums"]["learning_content_status"]
            | null
          content_version?: number
          created_at?: string | null
          id?: string
          solution_audio_url?: string | null
          topic: string
          type: Database["public"]["Enums"]["exercise_type"]
          unit_id: string
        }
        Update: {
          content?: Json
          content_status?:
            | Database["public"]["Enums"]["learning_content_status"]
            | null
          content_version?: number
          created_at?: string | null
          id?: string
          solution_audio_url?: string | null
          topic?: string
          type?: Database["public"]["Enums"]["exercise_type"]
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_exercises_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "learning_units"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_levels: {
        Row: {
          cefr_level: Database["public"]["Enums"]["cefr_code"]
          code: string
          is_active: boolean
          sort_order: number
        }
        Insert: {
          cefr_level: Database["public"]["Enums"]["cefr_code"]
          code: string
          is_active?: boolean
          sort_order: number
        }
        Update: {
          cefr_level?: Database["public"]["Enums"]["cefr_code"]
          code?: string
          is_active?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "learning_levels_cefr_fk"
            columns: ["cefr_level"]
            isOneToOne: false
            referencedRelation: "cefr_levels"
            referencedColumns: ["code"]
          },
        ]
      }
      learning_reading_texts: {
        Row: {
          audio_url: string | null
          created_at: string | null
          focus: string | null
          id: string
          sentence_de: string
          unit_id: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string | null
          focus?: string | null
          id?: string
          sentence_de: string
          unit_id: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string | null
          focus?: string | null
          id?: string
          sentence_de?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_reading_texts_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: true
            referencedRelation: "learning_units"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_trainer_grants: {
        Row: {
          auth_user_id: string
          enabled: boolean
          level: string
          trainer: Database["public"]["Enums"]["trainer_code"]
          unit_mode: Database["public"]["Enums"]["unit_access_mode"]
        }
        Insert: {
          auth_user_id: string
          enabled: boolean
          level: string
          trainer: Database["public"]["Enums"]["trainer_code"]
          unit_mode?: Database["public"]["Enums"]["unit_access_mode"]
        }
        Update: {
          auth_user_id?: string
          enabled?: boolean
          level?: string
          trainer?: Database["public"]["Enums"]["trainer_code"]
          unit_mode?: Database["public"]["Enums"]["unit_access_mode"]
        }
        Relationships: [
          {
            foreignKeyName: "learning_grants_trainer_fk"
            columns: ["trainer"]
            isOneToOne: false
            referencedRelation: "learning_trainers"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "learning_trainer_grants_level_fkey"
            columns: ["level"]
            isOneToOne: false
            referencedRelation: "learning_levels"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "learning_trainer_grants_user_id_fkey"
            columns: ["auth_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_trainers: {
        Row: {
          code: Database["public"]["Enums"]["trainer_code"]
        }
        Insert: {
          code: Database["public"]["Enums"]["trainer_code"]
        }
        Update: {
          code?: Database["public"]["Enums"]["trainer_code"]
        }
        Relationships: []
      }
      learning_unit_grants: {
        Row: {
          auth_user_id: string
          level: string
          trainer: Database["public"]["Enums"]["trainer_code"]
          unit_id: string
        }
        Insert: {
          auth_user_id: string
          level: string
          trainer: Database["public"]["Enums"]["trainer_code"]
          unit_id: string
        }
        Update: {
          auth_user_id?: string
          level?: string
          trainer?: Database["public"]["Enums"]["trainer_code"]
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_unit_grants_level_fkey"
            columns: ["level"]
            isOneToOne: false
            referencedRelation: "learning_levels"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "learning_unit_grants_unit_id_level_trainer_fkey"
            columns: ["unit_id", "level", "trainer"]
            isOneToOne: false
            referencedRelation: "learning_units"
            referencedColumns: ["id", "level", "trainer"]
          },
          {
            foreignKeyName: "learning_unit_grants_user_id_level_trainer_fkey"
            columns: ["auth_user_id", "level", "trainer"]
            isOneToOne: false
            referencedRelation: "learning_trainer_grants"
            referencedColumns: ["auth_user_id", "level", "trainer"]
          },
        ]
      }
      learning_units: {
        Row: {
          id: string
          is_active: boolean
          label: string
          level: string
          owner_auth_user_id: string | null
          sort_order: number
          trainer: Database["public"]["Enums"]["trainer_code"]
        }
        Insert: {
          id?: string
          is_active?: boolean
          label: string
          level: string
          owner_auth_user_id?: string | null
          sort_order?: number
          trainer: Database["public"]["Enums"]["trainer_code"]
        }
        Update: {
          id?: string
          is_active?: boolean
          label?: string
          level?: string
          owner_auth_user_id?: string | null
          sort_order?: number
          trainer?: Database["public"]["Enums"]["trainer_code"]
        }
        Relationships: [
          {
            foreignKeyName: "learning_units_level_fkey"
            columns: ["level"]
            isOneToOne: false
            referencedRelation: "learning_levels"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "learning_units_trainer_fk"
            columns: ["trainer"]
            isOneToOne: false
            referencedRelation: "learning_trainers"
            referencedColumns: ["code"]
          },
        ]
      }
      learning_videos: {
        Row: {
          created_at: string | null
          description: string | null
          file_size: number | null
          folder_id: string | null
          id: string
          source_url: string | null
          storage_path: string | null
          title: string | null
          unit_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          file_size?: number | null
          folder_id?: string | null
          id?: string
          source_url?: string | null
          storage_path?: string | null
          title?: string | null
          unit_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          file_size?: number | null
          folder_id?: string | null
          id?: string
          source_url?: string | null
          storage_path?: string | null
          title?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_videos_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "lms_media_folder"
            referencedColumns: ["folder_id"]
          },
          {
            foreignKeyName: "learning_videos_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "learning_units"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_vocabulary_cards: {
        Row: {
          alternative_answers_de: string[]
          article: Database["public"]["Enums"]["grammatical_article"] | null
          audio_url: string | null
          created_at: string | null
          id: string
          image_url: string | null
          plural: string | null
          sentence_practice: boolean
          unit_id: string
          word_de: string
        }
        Insert: {
          alternative_answers_de?: string[]
          article?: Database["public"]["Enums"]["grammatical_article"] | null
          audio_url?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          plural?: string | null
          sentence_practice?: boolean
          unit_id: string
          word_de: string
        }
        Update: {
          alternative_answers_de?: string[]
          article?: Database["public"]["Enums"]["grammatical_article"] | null
          audio_url?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          plural?: string | null
          sentence_practice?: boolean
          unit_id?: string
          word_de?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_vocabulary_cards_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "learning_units"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_media_folder: {
        Row: {
          course_id: string | null
          created_at: string
          folder_id: string
          level: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          folder_id?: string
          level: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          folder_id?: string
          level?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_media_folder_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lms_media_folder_level_fkey"
            columns: ["level"]
            isOneToOne: false
            referencedRelation: "learning_levels"
            referencedColumns: ["code"]
          },
        ]
      }
      lms_presentation_asset: {
        Row: {
          asset_id: string
          created_at: string
          file_name: string
          file_size: number
          folder_id: string
          mime_type: string
          sort_order: number
          storage_path: string
          updated_at: string
        }
        Insert: {
          asset_id?: string
          created_at?: string
          file_name: string
          file_size: number
          folder_id: string
          mime_type: string
          sort_order?: number
          storage_path: string
          updated_at?: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          file_name?: string
          file_size?: number
          folder_id?: string
          mime_type?: string
          sort_order?: number
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lms_presentation_asset_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "lms_media_folder"
            referencedColumns: ["folder_id"]
          },
          {
            foreignKeyName: "lms_presentation_asset_mime_type_fkey"
            columns: ["mime_type"]
            isOneToOne: false
            referencedRelation: "media_mime_types"
            referencedColumns: ["mime_type"]
          },
        ]
      }
      locales: {
        Row: {
          code: string
        }
        Insert: {
          code: string
        }
        Update: {
          code?: string
        }
        Relationships: []
      }
      media_mime_types: {
        Row: {
          format: Database["public"]["Enums"]["media_format"]
          mime_type: string
        }
        Insert: {
          format: Database["public"]["Enums"]["media_format"]
          mime_type: string
        }
        Update: {
          format?: Database["public"]["Enums"]["media_format"]
          mime_type?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          auth_user_id: string | null
          birth_date: string | null
          city: string | null
          created_at: string
          display_name: string
          email: string
          id: string
          phone: string | null
          postal_code: string | null
          preferred_locale: string
          street: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          birth_date?: string | null
          city?: string | null
          created_at?: string
          display_name: string
          email: string
          id?: string
          phone?: string | null
          postal_code?: string | null
          preferred_locale?: string
          street?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          birth_date?: string | null
          city?: string | null
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          phone?: string | null
          postal_code?: string | null
          preferred_locale?: string
          street?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_auth_user_id_fkey"
            columns: ["auth_user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_preferred_locale_fkey"
            columns: ["preferred_locale"]
            isOneToOne: false
            referencedRelation: "locales"
            referencedColumns: ["code"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          id: string
          native_language: string | null
          role: Database["public"]["Enums"]["profile_role"] | null
          ui_language: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          native_language?: string | null
          role?: Database["public"]["Enums"]["profile_role"] | null
          ui_language?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          native_language?: string | null
          role?: Database["public"]["Enums"]["profile_role"] | null
          ui_language?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_native_language_fkey"
            columns: ["native_language"]
            isOneToOne: false
            referencedRelation: "locales"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "profiles_ui_language_fkey"
            columns: ["ui_language"]
            isOneToOne: false
            referencedRelation: "locales"
            referencedColumns: ["code"]
          },
        ]
      }
      pronunciation_messages: {
        Row: {
          audio_path: string | null
          created_at: string
          id: string
          seen_at: string | null
          sender_id: string
          sender_role: Database["public"]["Enums"]["profile_role"]
          submission_id: string
          text_content: string
        }
        Insert: {
          audio_path?: string | null
          created_at?: string
          id?: string
          seen_at?: string | null
          sender_id: string
          sender_role?: Database["public"]["Enums"]["profile_role"]
          submission_id: string
          text_content?: string
        }
        Update: {
          audio_path?: string | null
          created_at?: string
          id?: string
          seen_at?: string | null
          sender_id?: string
          sender_role?: Database["public"]["Enums"]["profile_role"]
          submission_id?: string
          text_content?: string
        }
        Relationships: [
          {
            foreignKeyName: "pronunciation_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pronunciation_messages_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      student_level_access: {
        Row: {
          auth_user_id: string
          level: string
        }
        Insert: {
          auth_user_id: string
          level: string
        }
        Update: {
          auth_user_id?: string
          level?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_level_access_level_fkey"
            columns: ["level"]
            isOneToOne: false
            referencedRelation: "learning_levels"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "student_level_access_user_id_fkey"
            columns: ["auth_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          auth_user_id: string
          content_url: string | null
          created_at: string | null
          id: string
          level: string
          prompt_id: string | null
          status: Database["public"]["Enums"]["submission_status"] | null
          text_content: string | null
          type: Database["public"]["Enums"]["submission_type"]
        }
        Insert: {
          auth_user_id: string
          content_url?: string | null
          created_at?: string | null
          id?: string
          level?: string
          prompt_id?: string | null
          status?: Database["public"]["Enums"]["submission_status"] | null
          text_content?: string | null
          type: Database["public"]["Enums"]["submission_type"]
        }
        Update: {
          auth_user_id?: string
          content_url?: string | null
          created_at?: string | null
          id?: string
          level?: string
          prompt_id?: string | null
          status?: Database["public"]["Enums"]["submission_status"] | null
          text_content?: string | null
          type?: Database["public"]["Enums"]["submission_type"]
        }
        Relationships: [
          {
            foreignKeyName: "submissions_level_fk"
            columns: ["level"]
            isOneToOne: false
            referencedRelation: "learning_levels"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "submissions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "learning_reading_texts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_user_id_fkey"
            columns: ["auth_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_student_notes: {
        Row: {
          created_at: string
          id: string
          note_text: string
          student_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          note_text: string
          student_id: string
          teacher_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          note_text?: string
          student_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_student_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
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
      user_exercise_progress: {
        Row: {
          attempts: number
          auth_user_id: string
          completed: boolean | null
          created_at: string | null
          exercise_id: string
          hint_shown: boolean
          id: string
          score: number | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number
          auth_user_id: string
          completed?: boolean | null
          created_at?: string | null
          exercise_id: string
          hint_shown?: boolean
          id?: string
          score?: number | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number
          auth_user_id?: string
          completed?: boolean | null
          created_at?: string | null
          exercise_id?: string
          hint_shown?: boolean
          id?: string
          score?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_exercise_progress_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "learning_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_exercise_progress_user_id_fkey"
            columns: ["auth_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vocabulary_direction_progress: {
        Row: {
          auth_user_id: string
          box_number: number
          card_id: string
          created_at: string | null
          direction: Database["public"]["Enums"]["vocabulary_direction"]
          id: string
          lapses: number
          last_answered_at: string | null
          next_review_date: string
          updated_at: string | null
        }
        Insert: {
          auth_user_id: string
          box_number?: number
          card_id: string
          created_at?: string | null
          direction: Database["public"]["Enums"]["vocabulary_direction"]
          id?: string
          lapses?: number
          last_answered_at?: string | null
          next_review_date?: string
          updated_at?: string | null
        }
        Update: {
          auth_user_id?: string
          box_number?: number
          card_id?: string
          created_at?: string | null
          direction?: Database["public"]["Enums"]["vocabulary_direction"]
          id?: string
          lapses?: number
          last_answered_at?: string | null
          next_review_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vocabulary_direction_progress_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "learning_vocabulary_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vocabulary_direction_progress_user_id_fkey"
            columns: ["auth_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vocabulary_learning_state: {
        Row: {
          auth_user_id: string
          last_card_id: string | null
          last_reviewed_at: string | null
        }
        Insert: {
          auth_user_id: string
          last_card_id?: string | null
          last_reviewed_at?: string | null
        }
        Update: {
          auth_user_id?: string
          last_card_id?: string | null
          last_reviewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vocabulary_learning_state_last_card_id_fkey"
            columns: ["last_card_id"]
            isOneToOne: false
            referencedRelation: "learning_vocabulary_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vocabulary_learning_state_user_id_fkey"
            columns: ["auth_user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vocabulary_onboarding: {
        Row: {
          auth_user_id: string
          level: string
          started_unit_id: string
          status: Database["public"]["Enums"]["onboarding_status"]
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          level: string
          started_unit_id: string
          status: Database["public"]["Enums"]["onboarding_status"]
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          level?: string
          started_unit_id?: string
          status?: Database["public"]["Enums"]["onboarding_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vocabulary_onboarding_level_fk"
            columns: ["level"]
            isOneToOne: false
            referencedRelation: "learning_levels"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "vocabulary_onboarding_unit_fk"
            columns: ["started_unit_id"]
            isOneToOne: false
            referencedRelation: "learning_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vocabulary_onboarding_user_id_fkey"
            columns: ["auth_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vocabulary_translations: {
        Row: {
          card_id: string
          context_sentence: string | null
          is_difficult: boolean
          locale: string
          translation: string | null
        }
        Insert: {
          card_id: string
          context_sentence?: string | null
          is_difficult?: boolean
          locale: string
          translation?: string | null
        }
        Update: {
          card_id?: string
          context_sentence?: string | null
          is_difficult?: boolean
          locale?: string
          translation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vocabulary_locale_fk"
            columns: ["locale"]
            isOneToOne: false
            referencedRelation: "locales"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "vocabulary_translations_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "learning_vocabulary_cards"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_own_vocabulary: {
        Args: {
          p_article: string | null
          p_level: string
          p_locale: string
          p_translation: string
          p_word_de: string
        }
        Returns: Json
      }
      begin_learning_reset: { Args: { p_confirmation: string }; Returns: Json }
      check_vocabulary_retry: {
        Args: {
          p_progress_id: string
          p_typed_answer: string
          p_ui_language?: string
        }
        Returns: Json
      }
      claim_mail_jobs: {
        Args: { p_limit?: number; p_worker_id: string }
        Returns: Json
      }
      claim_verified_person: { Args: never; Returns: Json }
      complete_mail_job: {
        Args: { p_id: string; p_lease_token: string; p_message_id: string }
        Returns: Json
      }
      complete_media_upload: { Args: { p_payload: Json }; Returns: Json }
      confirm_business_booking: { Args: { p_id: string }; Returns: Json }
      consume_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: Json
      }
      create_pronunciation_submission: {
        Args: { p_audio_path: string; p_prompt_id: string }
        Returns: Json
      }
      decline_business_booking: { Args: { p_id: string }; Returns: Json }
      delete_course_exception: { Args: { p_id: string }; Returns: Json }
      delete_own_vocabulary: {
        Args: { p_card_id: string }
        Returns: Json
      }
      delete_learning_content: {
        Args: { p_id: string; p_trainer: string }
        Returns: Json
      }
      fail_mail_job: {
        Args: {
          p_error: string
          p_id: string
          p_lease_token: string
          p_permanent?: boolean
        }
        Returns: Json
      }
      finish_learning_reset: { Args: { p_token: string }; Returns: Json }
      get_all_students_progress_data:
        | { Args: never; Returns: Json }
        | { Args: { p_course_id: string; p_student_id: string }; Returns: Json }
      initialize_vocabulary_cards: {
        Args: { p_decisions: Json }
        Returns: Json
      }
      learning_reset_audio_batch: { Args: { p_token: string }; Returns: Json }
      list_registration_identity_conflicts: { Args: never; Returns: Json }
      mark_business_invoice: {
        Args: {
          p_booking: string
          p_created: boolean
          p_month: string
          p_reference?: string
        }
        Returns: Json
      }
      mark_pronunciation_seen: {
        Args: { p_submission_id: string }
        Returns: Json
      }
      media_storage_usage: { Args: never; Returns: Json }
      prepare_business_month: { Args: { p_month: string }; Returns: Json }
      pronunciation_reply_senders: {
        Args: never
        Returns: {
          display_name: string | null
          sender_id: string
        }[]
      }
      queue_transactional_email: {
        Args: {
          p_dedupe_key: string
          p_kind: string
          p_locale: string
          p_payload: Json
          p_recipient: string
        }
        Returns: Json
      }
      record_grammar_attempt: {
        Args: {
          p_answer: string
          p_exercise_id: string
          p_hint_shown?: boolean
        }
        Returns: Json
      }
      reset_student_level_progress: {
        Args: { p_level: string; p_student_id: string }
        Returns: Json
      }
      reset_vocabulary_lesson_progress: {
        Args: { p_unit_id: string }
        Returns: Json
      }
      resolve_registration_identity: {
        Args: { p_auth_user_id: string; p_person_id: string }
        Returns: Json
      }
      save_business_course: { Args: { p_data: Json }; Returns: Json }
      save_business_month: {
        Args: {
          p_course_selections: Json
          p_expected?: string
          p_month: string
          p_paused: boolean
          p_revision?: number
        }
        Returns: Json
      }
      save_course_exception: {
        Args: { p_course_id: string; p_date: string; p_reason: string }
        Returns: Json
      }
      save_learning_content: {
        Args: { p_id?: string; p_payload: Json; p_trainer: string }
        Returns: Json
      }
      save_student_blackboard: {
        Args: {
          p_expected_note_id?: string
          p_note_text: string
          p_student_id: string
        }
        Returns: Json
      }
      set_student_level_access: {
        Args: { p_levels: string[]; p_user_id: string }
        Returns: Json
      }
      set_student_trainer_access: {
        Args: {
          p_enabled: boolean
          p_level: string
          p_replace_units?: boolean
          p_trainer: string
          p_unit_ids?: string[]
          p_user_id: string
        }
        Returns: Json
      }
      skip_vocabulary_assessment: { Args: { p_level: string }; Returns: Json }
      submit_business_cancellation: {
        Args: {
          p_course_id?: string
          p_date?: string
          p_email: string
          p_locale?: string
          p_name: string
          p_type?: string
        }
        Returns: Json
      }
      submit_business_registration: {
        Args: {
          p_consents: Json
          p_contact: Json
          p_course_selections: Json
          p_locale?: string
          p_start: string
          p_trial?: boolean
        }
        Returns: Json
      }
      submit_vocabulary_answer: {
        Args: {
          p_is_correct?: boolean
          p_progress_id: string
          p_typed_answer?: string
          p_ui_language?: string
        }
        Returns: Json
      }
      submit_vocabulary_answer_once: {
        Args: {
          p_is_correct?: boolean
          p_progress_id: string
          p_request_id: string
          p_typed_answer?: string
          p_ui_language?: string
        }
        Returns: Json
      }
      submit_vocabulary_self_rating_once: {
        Args: {
          p_known: boolean
          p_progress_id: string
          p_request_id: string
          p_ui_language?: string
        }
        Returns: Json
      }
    }
    Enums: {
      booking_kind: "registration" | "monthly" | "trial"
      booking_status: "pending" | "confirmed" | "cancelled" | "rejected"
      cancellation_type: "asap" | "specific_date"
      cefr_code: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
      course_category: "german" | "speaking" | "online" | "private"
      course_type: "presence" | "online"
      exercise_type: "fill_in_blank" | "multiple_choice" | "sentence_building"
      grammatical_article: "der" | "die" | "das" | "none"
      invoice_status: "outstanding" | "created"
      learning_content_status: "incomplete" | "ready"
      mail_kind:
        | "registration_received"
        | "registration_confirmed"
        | "booking_cancelled"
        | "cancellation_requested"
        | "trial_confirmed"
        | "trial_cancelled"
        | "new_enrollment"
        | "feedback_available"
        | "raw"
        | "course_exception_added"
      mail_status: "pending" | "processing" | "sent" | "failed"
      media_format: "mp4" | "webm" | "pdf" | "pptx" | "key"
      onboarding_status: "skipped" | "completed"
      profile_role: "student" | "teacher" | "admin"
      submission_status: "pending" | "reviewed"
      submission_type: "audio" | "text"
      trainer_code: "vocabulary" | "exercises" | "pronunciation" | "videos"
      unit_access_mode: "all" | "selected"
      vocabulary_direction: "de_to_native" | "native_to_de"
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
      booking_kind: ["registration", "monthly", "trial"],
      booking_status: ["pending", "confirmed", "cancelled", "rejected"],
      cancellation_type: ["asap", "specific_date"],
      cefr_code: ["A1", "A2", "B1", "B2", "C1", "C2"],
      course_category: ["german", "speaking", "online", "private"],
      course_type: ["presence", "online"],
      exercise_type: ["fill_in_blank", "multiple_choice", "sentence_building"],
      grammatical_article: ["der", "die", "das", "none"],
      invoice_status: ["outstanding", "created"],
      learning_content_status: ["incomplete", "ready"],
      mail_kind: [
        "registration_received",
        "registration_confirmed",
        "booking_cancelled",
        "cancellation_requested",
        "trial_confirmed",
        "trial_cancelled",
        "new_enrollment",
        "feedback_available",
        "raw",
        "course_exception_added",
      ],
      mail_status: ["pending", "processing", "sent", "failed"],
      media_format: ["mp4", "webm", "pdf", "pptx", "key"],
      onboarding_status: ["skipped", "completed"],
      profile_role: ["student", "teacher", "admin"],
      submission_status: ["pending", "reviewed"],
      submission_type: ["audio", "text"],
      trainer_code: ["vocabulary", "exercises", "pronunciation", "videos"],
      unit_access_mode: ["all", "selected"],
      vocabulary_direction: ["de_to_native", "native_to_de"],
    },
  },
} as const
