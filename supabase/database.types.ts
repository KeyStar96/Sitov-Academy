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
          kind: string
          person_id: string
          privacy_accepted: boolean
          recording_accepted: boolean | null
          revision: number
          revocation_accepted: boolean
          start_date: string
          status: string
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
          kind?: string
          person_id: string
          privacy_accepted: boolean
          recording_accepted?: boolean | null
          revision?: number
          revocation_accepted?: boolean
          start_date: string
          status?: string
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
          kind?: string
          person_id?: string
          privacy_accepted?: boolean
          recording_accepted?: boolean | null
          revision?: number
          revocation_accepted?: boolean
          start_date?: string
          status?: string
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
          course_name: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          processed_at: string | null
          termination_date: string | null
          termination_type: string
        }
        Insert: {
          course_name?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          processed_at?: string | null
          termination_date?: string | null
          termination_type: string
        }
        Update: {
          course_name?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          processed_at?: string | null
          termination_date?: string | null
          termination_type?: string
        }
        Relationships: []
      }
      cefr_levels: {
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
          category: string
          created_at: string
          description: string
          end_date: string | null
          id: string
          level: string
          slug: string
          sort_order: number
          start_date: string | null
          title: string
          trial_lessons: boolean
          type: string
          unit_minutes: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          category: string
          created_at?: string
          description?: string
          end_date?: string | null
          id?: string
          level?: string
          slug: string
          sort_order?: number
          start_date?: string | null
          title: string
          trial_lessons?: boolean
          type: string
          unit_minutes?: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          category?: string
          created_at?: string
          description?: string
          end_date?: string | null
          id?: string
          level?: string
          slug?: string
          sort_order?: number
          start_date?: string | null
          title?: string
          trial_lessons?: boolean
          type?: string
          unit_minutes?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      grammar_translations: {
        Row: {
          exercise_id: string
          explanation: string | null
          hint: string | null
          locale: string
          smart_hint: string | null
        }
        Insert: {
          exercise_id: string
          explanation?: string | null
          hint?: string | null
          locale: string
          smart_hint?: string | null
        }
        Update: {
          exercise_id?: string
          explanation?: string | null
          hint?: string | null
          locale?: string
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
          status: string
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
          status?: string
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
          status?: string
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
      learning_exercises: {
        Row: {
          content: Json
          content_version: number
          created_at: string | null
          id: string
          solution_audio_url: string | null
          topic: string
          type: string
          unit_id: string
        }
        Insert: {
          content: Json
          content_version?: number
          created_at?: string | null
          id?: string
          solution_audio_url?: string | null
          topic: string
          type: string
          unit_id: string
        }
        Update: {
          content?: Json
          content_version?: number
          created_at?: string | null
          id?: string
          solution_audio_url?: string | null
          topic?: string
          type?: string
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
          cefr_level: string
          code: string
          is_active: boolean
          sort_order: number
        }
        Insert: {
          cefr_level: string
          code: string
          is_active?: boolean
          sort_order: number
        }
        Update: {
          cefr_level?: string
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
          enabled: boolean
          level: string
          trainer: string
          unit_mode: string
          user_id: string
        }
        Insert: {
          enabled: boolean
          level: string
          trainer: string
          unit_mode?: string
          user_id: string
        }
        Update: {
          enabled?: boolean
          level?: string
          trainer?: string
          unit_mode?: string
          user_id?: string
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
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_trainers: {
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
      learning_unit_grants: {
        Row: {
          level: string
          trainer: string
          unit_id: string
          user_id: string
        }
        Insert: {
          level: string
          trainer: string
          unit_id: string
          user_id: string
        }
        Update: {
          level?: string
          trainer?: string
          unit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_unit_grants_unit_id_level_trainer_fkey"
            columns: ["unit_id", "level", "trainer"]
            isOneToOne: false
            referencedRelation: "learning_units"
            referencedColumns: ["id", "level", "trainer"]
          },
          {
            foreignKeyName: "learning_unit_grants_user_id_level_trainer_fkey"
            columns: ["user_id", "level", "trainer"]
            isOneToOne: false
            referencedRelation: "learning_trainer_grants"
            referencedColumns: ["user_id", "level", "trainer"]
          },
        ]
      }
      learning_units: {
        Row: {
          id: string
          is_active: boolean
          label: string
          level: string
          sort_order: number
          trainer: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          label: string
          level: string
          sort_order?: number
          trainer: string
        }
        Update: {
          id?: string
          is_active?: boolean
          label?: string
          level?: string
          sort_order?: number
          trainer?: string
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
          id: string
          source_url: string | null
          unit_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          source_url?: string | null
          unit_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          source_url?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_videos_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: true
            referencedRelation: "learning_units"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_vocabulary_cards: {
        Row: {
          alternative_answers_de: string[]
          article: string | null
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
          article?: string | null
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
          article?: string | null
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
          role: string | null
          ui_language: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          native_language?: string | null
          role?: string | null
          ui_language?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          native_language?: string | null
          role?: string | null
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
          sender_role: string
          submission_id: string
          text_content: string
        }
        Insert: {
          audio_path?: string | null
          created_at?: string
          id?: string
          seen_at?: string | null
          sender_id: string
          sender_role?: string
          submission_id: string
          text_content?: string
        }
        Update: {
          audio_path?: string | null
          created_at?: string
          id?: string
          seen_at?: string | null
          sender_id?: string
          sender_role?: string
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
          level: string
          user_id: string
        }
        Insert: {
          level: string
          user_id: string
        }
        Update: {
          level?: string
          user_id?: string
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
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          content_url: string | null
          created_at: string | null
          id: string
          level: string
          prompt_id: string | null
          prompt_title: string | null
          status: string | null
          text_content: string | null
          type: string
          user_id: string
        }
        Insert: {
          content_url?: string | null
          created_at?: string | null
          id?: string
          level?: string
          prompt_id?: string | null
          prompt_title?: string | null
          status?: string | null
          text_content?: string | null
          type: string
          user_id: string
        }
        Update: {
          content_url?: string | null
          created_at?: string | null
          id?: string
          level?: string
          prompt_id?: string | null
          prompt_title?: string | null
          status?: string | null
          text_content?: string | null
          type?: string
          user_id?: string
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
            columns: ["user_id"]
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
            referencedRelation: "learning_exercises"
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
      vocabulary_direction_progress: {
        Row: {
          box_number: number
          card_id: string
          created_at: string | null
          direction: string
          id: string
          lapses: number
          last_answered_at: string | null
          next_review_date: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          box_number?: number
          card_id: string
          created_at?: string | null
          direction: string
          id?: string
          lapses?: number
          last_answered_at?: string | null
          next_review_date?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          box_number?: number
          card_id?: string
          created_at?: string | null
          direction?: string
          id?: string
          lapses?: number
          last_answered_at?: string | null
          next_review_date?: string
          updated_at?: string | null
          user_id?: string
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
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vocabulary_learning_state: {
        Row: {
          last_card_id: string | null
          last_reviewed_at: string | null
          user_id: string
        }
        Insert: {
          last_card_id?: string | null
          last_reviewed_at?: string | null
          user_id: string
        }
        Update: {
          last_card_id?: string | null
          last_reviewed_at?: string | null
          user_id?: string
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
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vocabulary_onboarding: {
        Row: {
          level: string
          started_unit_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          level: string
          started_unit_id: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          level?: string
          started_unit_id?: string
          status?: string
          updated_at?: string
          user_id?: string
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
            columns: ["user_id"]
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
      begin_learning_reset: {
        Args: { p_confirmation: string }
        Returns: string
      }
      claim_mail_jobs: {
        Args: { p_limit?: number; p_worker_id: string }
        Returns: unknown[]
        SetofOptions: {
          from: "*"
          to: "mail_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_verified_person: { Args: never; Returns: Json }
      complete_mail_job: {
        Args: { p_id: string; p_lease_token: string; p_message_id: string }
        Returns: boolean
      }
      confirm_business_booking: { Args: { p_id: string }; Returns: undefined }
      consume_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: {
          remaining: number
          reset_at: string
          success: boolean
        }[]
      }
      create_pronunciation_submission: {
        Args: { p_audio_path: string; p_prompt_id: string }
        Returns: string
      }
      decline_business_booking: { Args: { p_id: string }; Returns: undefined }
      delete_learning_content: {
        Args: { p_id: string; p_trainer: string }
        Returns: undefined
      }
      fail_mail_job: {
        Args: {
          p_error: string
          p_id: string
          p_lease_token: string
          p_permanent?: boolean
        }
        Returns: boolean
      }
      finish_learning_reset: { Args: { p_token: string }; Returns: boolean }
      initialize_vocabulary_cards: {
        Args: { p_decisions: Json }
        Returns: Json
      }
      learning_reset_audio_batch: {
        Args: { p_token: string }
        Returns: {
          bucket_id: string
          object_name: string
        }[]
      }
      mark_business_invoice: {
        Args: {
          p_booking: string
          p_created: boolean
          p_month: string
          p_reference?: string
        }
        Returns: undefined
      }
      mark_pronunciation_seen: {
        Args: { p_submission_id: string }
        Returns: undefined
      }
      prepare_business_month: { Args: { p_month: string }; Returns: number }
      queue_transactional_email: {
        Args: {
          p_dedupe_key: string
          p_kind: string
          p_locale: string
          p_payload: Json
          p_recipient: string
        }
        Returns: string
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
        Returns: undefined
      }
      reset_vocabulary_lesson_progress: {
        Args: { p_unit_id: string }
        Returns: undefined
      }
      save_business_course: { Args: { p_data: Json }; Returns: string }
      save_business_month: {
        Args: {
          p_course_selections: Json
          p_expected?: string
          p_month: string
          p_paused: boolean
          p_revision?: number
        }
        Returns: string
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
        Returns: {
          created_at: string
          id: string
          note_text: string
          student_id: string
          teacher_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "teacher_student_notes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_student_level_access: {
        Args: { p_levels: string[]; p_user_id: string }
        Returns: undefined
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
        Returns: undefined
      }
      skip_vocabulary_assessment: { Args: { p_level: string }; Returns: Json }
      submit_business_cancellation: {
        Args: {
          p_course: string
          p_date?: string
          p_email: string
          p_locale?: string
          p_name: string
          p_type: string
        }
        Returns: string
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
        Returns: string
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
    Enums: {},
  },
} as const
