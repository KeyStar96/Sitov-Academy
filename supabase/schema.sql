-- Sitov Academy v2 – Supabase Schema Reference
-- Projekt-ID: wcaslabeiwtvygxtzcio
-- Basis: synchronisiert mit Live-Datenbank (2026-09-02)
-- Ergänzt: 20260909155919_monthly_bookings_teacher_notes.sql
-- und 20260909165848_profile_dashboard_workflow.sql, live angewendet am 2026-09-09.
-- Live-Migrationsversionen: 20260909172738 bzw. 20260909172746.
-- Live ergänzt am 2026-09-10: 20260910133125_vocabulary_bidirectional_learning.sql
-- und 20260910135831_vocabulary_context_content.sql.
-- Live-Migrationsversionen: 20260910140547 bzw. 20260910140553.
-- Live ergänzt am 2026-09-10: 20260910151457_neural_audio_cache.sql
-- und 20260910151533_vocabulary_answer_receipts.sql.
-- Live-Migrationsversionen: 20260910153135 bzw. 20260910153144.
-- Private Hilfstabellen/-funktionen, Grants und Backfill: siehe diese Migrationen.
--
-- WARNING: Dieses Schema dient als Referenz und Kontext für Agenten.
-- Es ist nicht als vollständiges Setup-Skript gedacht. Tabellenreihenfolge
-- und Abhängigkeiten sind für manuelle Ausführung nicht garantiert.

-- =============================================================================
-- TABLES
-- =============================================================================

CREATE TABLE public.courses (
  id text NOT NULL,
  booking_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  translation_key text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['presence'::text, 'online'::text])),
  price numeric NOT NULL,
  instructor text NOT NULL,
  unit_duration integer NOT NULL,
  sessions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  title text,
  start_date date,
  end_date date,
  trial_lessons boolean DEFAULT true,
  CONSTRAINT courses_pkey PRIMARY KEY (id)
);

CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  birth_date text NOT NULL,
  email text NOT NULL,
  phone text,
  street text,
  zip text,
  city text,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

CREATE TABLE public.registrations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'rejected'::text, 'cancelled'::text])),
  privacy_accepted boolean NOT NULL DEFAULT false,
  start_date date,
  total_price numeric,
  agb_accepted boolean NOT NULL DEFAULT false,
  revocation_waiver_accepted boolean NOT NULL DEFAULT false,
  user_id uuid NOT NULL,
  video_recording_accepted boolean,
  course_ids text[] DEFAULT '{}'::text[],
  confirmation_mail_sent boolean DEFAULT false,
  course_prices jsonb DEFAULT '{}'::jsonb,
  cancellation_mail_sent boolean DEFAULT false,
  CONSTRAINT registrations_pkey PRIMARY KEY (id),
  CONSTRAINT registrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

CREATE TABLE public.enrollments (
  registration_id uuid NOT NULL,
  course_id text NOT NULL,
  assigned_at timestamp with time zone DEFAULT now(),
  price numeric,
  CONSTRAINT enrollments_pkey PRIMARY KEY (registration_id, course_id),
  CONSTRAINT enrollments_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.registrations(id),
  CONSTRAINT enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);

CREATE TABLE public.course_exceptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  date date NOT NULL,
  reason text NOT NULL,
  course_ids text[],
  CONSTRAINT course_exceptions_pkey PRIMARY KEY (id)
);

CREATE TABLE public.cancellations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  course_name text,
  termination_date date,
  termination_type text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  confirmation_mail_sent boolean DEFAULT false,
  CONSTRAINT cancellations_pkey PRIMARY KEY (id)
);

CREATE TABLE public.trial_lessons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  email text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  course_id text,
  trial_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text])),
  confirmation_mail_sent boolean DEFAULT false,
  cancellation_mail_sent boolean DEFAULT false,
  birth_date text,
  street text,
  zip text,
  city text,
  video_recording_accepted boolean,
  CONSTRAINT trial_lessons_pkey PRIMARY KEY (id),
  CONSTRAINT trial_lessons_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  name text,
  email text NOT NULL,
  native_language text CHECK (native_language = ANY (ARRAY['Deutsch'::text, 'Englisch'::text, 'Russisch'::text, 'Türkisch'::text, 'Ukrainisch'::text, 'Andere'::text])),
  subscription_status text DEFAULT 'kostenlos'::text CHECK (subscription_status = ANY (ARRAY['kostenlos'::text, 'aktiv'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  stripe_customer_id text,
  stripe_subscription_id text,
  role text DEFAULT 'student'::text CHECK (role IN ('student', 'teacher', 'admin')),
  legacy_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  phone text,
  street text,
  zip_code text,
  city text,
  -- Persistente Oberflächensprache (Locale-Code). Standard 'de'; wird bei der
  -- Registrierung aus der Erstsprache abgeleitet, im Profil manuell änderbar.
  ui_language text NOT NULL DEFAULT 'de'::text CHECK (ui_language = ANY (ARRAY['de'::text, 'en'::text, 'uk'::text, 'ru'::text, 'tr'::text])),
  -- Explizit freigeschaltete Sprachniveaus (feingranular, z. B. A1.1). Leeres Array = kein Zugriff.
  -- Admin/Teacher haben unabhängig davon Vollzugriff (siehe lib/access/levels.ts).
  allowed_levels text[] NOT NULL DEFAULT '{}'::text[],
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

CREATE TABLE public.vocabulary_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lesson text NOT NULL,
  word_de text NOT NULL,
  article text CHECK (article = ANY (ARRAY['der'::text, 'die'::text, 'das'::text, 'none'::text])),
  plural text,
  translation_ru text,
  translation_tr text,
  translation_en text,
  image_url text,
  audio_url text,
  is_hard_for_ru boolean DEFAULT false,
  is_hard_for_tr boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  level text NOT NULL DEFAULT 'A1.1'::text CHECK (level = ANY (ARRAY['A1.1'::text, 'A1.2'::text, 'A2.1'::text, 'A2.2'::text, 'B1.1'::text, 'B1.2'::text])),
  CONSTRAINT vocabulary_cards_pkey PRIMARY KEY (id),
  translation_uk text,
  context_sentence_de text,
  context_sentence_en text,
  context_sentence_ru text,
  context_sentence_uk text,
  context_sentence_tr text,
  sentence_practice boolean NOT NULL DEFAULT false,
  CONSTRAINT vocabulary_sentence_target_check CHECK (NOT sentence_practice OR (
    nullif(btrim(context_sentence_de), '') IS NOT NULL AND nullif(btrim(context_sentence_en), '') IS NOT NULL
    AND nullif(btrim(context_sentence_ru), '') IS NOT NULL AND nullif(btrim(context_sentence_uk), '') IS NOT NULL
    AND nullif(btrim(context_sentence_tr), '') IS NOT NULL))
);

CREATE TABLE public.user_vocabulary_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  card_id uuid NOT NULL,
  -- Phase-6-Leitner: 1–6 = aktive Lernphasen, 7 = dauerhaft gelernt
  box_number integer DEFAULT 1 CHECK (box_number >= 1 AND box_number <= 7),
  next_review_date timestamp with time zone DEFAULT now(),
  -- Anzahl der Rückstufungen um eine Phase (falsche Antworten)
  lapses integer NOT NULL DEFAULT 0,
  last_answered_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_vocabulary_progress_pkey PRIMARY KEY (id),
  CONSTRAINT user_vocabulary_progress_user_id_card_id_key UNIQUE (user_id, card_id),
  CONSTRAINT user_vocabulary_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT user_vocabulary_progress_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.vocabulary_cards(id)
);

CREATE TABLE public.videos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  lesson text NOT NULL,
  video_url text,
  external_url text,
  is_external boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  level text NOT NULL DEFAULT 'A1.1'::text CHECK (level = ANY (ARRAY['A1.1'::text, 'A1.2'::text, 'A2.1'::text, 'A2.2'::text, 'B1.1'::text, 'B1.2'::text])),
  CONSTRAINT videos_pkey PRIMARY KEY (id)
);

CREATE TABLE public.pronunciation_prompts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cefr_level text NOT NULL CHECK (cefr_level = ANY (ARRAY['A1'::text, 'A2'::text, 'B1'::text, 'B2'::text, 'C1'::text, 'C2'::text])),
  sentence_de text NOT NULL,
  focus text,
  audio_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pronunciation_prompts_pkey PRIMARY KEY (id)
);

CREATE TABLE public.exercises (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lesson text NOT NULL,
  topic text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['fill_in_blank'::text, 'multiple_choice'::text, 'sentence_building'::text])),
  content jsonb NOT NULL,
  hint_ru text,
  hint_tr text,
  created_at timestamp with time zone DEFAULT now(),
  level text NOT NULL DEFAULT 'A1.1'::text CHECK (level = ANY (ARRAY['A1.1'::text, 'A1.2'::text, 'A2.1'::text, 'A2.2'::text, 'B1.1'::text, 'B1.2'::text])),
  -- Optionale MP3-URL für den Tap-to-Listen-Button der Lösung.
  solution_audio_url text,
  CONSTRAINT exercises_pkey PRIMARY KEY (id)
);

-- content-JSONB je Übungstyp:
--   fill_in_blank    { text_before, text_after, correct_answer, options?: string[], smart_hint?: string }
--   multiple_choice  { question, options: string[], correct_answer }
--   sentence_building{ parts: string[] }
-- `options` sind die Auswahl-Chips. Fehlt der Key, generiert die Anwendung sie
-- aus der passenden Wortfamilie (siehe lib/exercise-chips.ts).

CREATE TABLE public.user_exercise_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  exercise_id uuid NOT NULL,
  completed boolean DEFAULT false,
  score integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  -- Anzahl der Antwortversuche; ab 2 Fehlversuchen erscheint ein Smart Hint.
  attempts integer NOT NULL DEFAULT 0,
  hint_shown boolean NOT NULL DEFAULT false,
  CONSTRAINT user_exercise_progress_pkey PRIMARY KEY (id),
  CONSTRAINT user_exercise_progress_user_id_exercise_id_key UNIQUE (user_id, exercise_id),
  CONSTRAINT user_exercise_progress_score_range CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  CONSTRAINT user_exercise_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT user_exercise_progress_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.exercises(id)
);

CREATE TABLE public.submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['audio'::text, 'text'::text])),
  content_url text,
  text_content text,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'reviewed'::text])),
  created_at timestamp with time zone DEFAULT now(),
  parent_id uuid,
  attempt_number integer DEFAULT 1,
  level text NOT NULL DEFAULT 'A1.1'::text CHECK (level = ANY (ARRAY['A1.1'::text, 'A1.2'::text, 'A2.1'::text, 'A2.2'::text, 'B1.1'::text, 'B1.2'::text])),
  CONSTRAINT submissions_pkey PRIMARY KEY (id),
  CONSTRAINT submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT submissions_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.submissions(id)
);

CREATE TABLE public.teacher_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  feedback_text text NOT NULL,
  feedback_audio_url text,
  created_at timestamp with time zone DEFAULT now(),
  -- NULL = der Schüler hat das Feedback noch nicht geöffnet (Dashboard-Hinweis)
  seen_at timestamp with time zone,
  CONSTRAINT teacher_feedback_pkey PRIMARY KEY (id),
  CONSTRAINT teacher_feedback_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(id),
  CONSTRAINT teacher_feedback_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.monthly_course_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_month date NOT NULL,
  course_ids uuid[] NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  CONSTRAINT monthly_course_bookings_user_month_key UNIQUE (user_id, target_month),
  CONSTRAINT monthly_course_bookings_month_check CHECK (
    isfinite(target_month) AND target_month >= DATE '0001-01-01'
    AND target_month <= DATE '9999-12-01' AND extract(day FROM target_month) = 1
  ),
  CONSTRAINT monthly_course_bookings_courses_check CHECK (
    (cardinality(course_ids) = 0 AND status = 'cancelled') OR
    (cardinality(course_ids) BETWEEN 1 AND 100 AND array_ndims(course_ids) = 1
    AND array_lower(course_ids, 1) = 1 AND array_position(course_ids, NULL) IS NULL)
  )
);
CREATE TABLE public.teacher_student_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  note_text text NOT NULL CHECK (char_length(btrim(note_text)) BETWEEN 1 AND 5000),
  discount_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100)
);

-- =============================================================================
-- INDEXES (zusätzlich zu Primary Keys)
-- =============================================================================

CREATE INDEX idx_cancellations_mail_sent ON public.cancellations USING btree (confirmation_mail_sent);
CREATE INDEX idx_exercises_level_lesson ON public.exercises USING btree (level, lesson);
CREATE INDEX idx_user_exercise_progress_user_completed ON public.user_exercise_progress USING btree (user_id, completed);
CREATE INDEX idx_user_vocabulary_progress_due ON public.user_vocabulary_progress USING btree (user_id, next_review_date, box_number);
CREATE INDEX idx_profiles_stripe_customer_id ON public.profiles USING btree (stripe_customer_id);
CREATE INDEX idx_profiles_stripe_subscription_id ON public.profiles USING btree (stripe_subscription_id);
CREATE INDEX submissions_parent_id_idx ON public.submissions USING btree (parent_id);
CREATE INDEX idx_submissions_user_level_created ON public.submissions USING btree (user_id, level, created_at DESC);
CREATE INDEX idx_teacher_feedback_unseen ON public.teacher_feedback USING btree (submission_id) WHERE seen_at IS NULL;
CREATE UNIQUE INDEX trial_lessons_person_unique ON public.trial_lessons USING btree (lower(email), lower(first_name), lower(last_name));

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_native text := new.raw_user_meta_data->>'native_language';
BEGIN
  INSERT INTO public.profiles (id, email, name, native_language, ui_language)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'name',
    v_native,
    CASE v_native
      WHEN 'Russisch' THEN 'ru'
      WHEN 'Türkisch' THEN 'tr'
      WHEN 'Ukrainisch' THEN 'uk'
      WHEN 'Englisch' THEN 'en'
      WHEN 'Deutsch' THEN 'de'
      ELSE 'de'
    END
  );
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_registration_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  cid text;
  c_price numeric;
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    IF NEW.course_ids IS NOT NULL THEN
      FOREACH cid IN ARRAY NEW.course_ids
      LOOP
        BEGIN
          c_price := (NEW.course_prices ->> cid)::numeric;
        EXCEPTION WHEN OTHERS THEN
          c_price := 0;
        END;

        INSERT INTO public.enrollments (registration_id, course_id, assigned_at, price)
        VALUES (NEW.id, cid, now(), c_price)
        ON CONFLICT (registration_id, course_id)
        DO UPDATE SET price = EXCLUDED.price;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Markiert das Feedback einer eigenen Einreichung als gelesen.
-- SECURITY DEFINER, weil der Schüler bewusst keine UPDATE-Policy auf
-- teacher_feedback erhält: so bleibt der Feedback-Text für ihn unveränderlich.
CREATE OR REPLACE FUNCTION public.mark_feedback_seen(p_submission_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_updated integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.teacher_feedback AS tf
  SET seen_at = now()
  WHERE tf.submission_id = p_submission_id
    AND tf.seen_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = tf.submission_id
        AND s.user_id = auth.uid()
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_feedback_seen(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_feedback_seen(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_feedback_seen(uuid) TO authenticated;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER on_registration_confirmed
  AFTER UPDATE OF status ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION handle_registration_confirmation();

-- Edge Function: notify-new-enrollment (Service-Role-Key nicht im Repo speichern)
CREATE TRIGGER "notify-registration-insert"
  AFTER INSERT ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request(
    'https://wcaslabeiwtvygxtzcio.supabase.co/functions/v1/notify-new-enrollment',
    'POST',
    '{"Content-type":"application/json","Authorization":"Bearer <SUPABASE_SERVICE_ROLE_KEY>"}',
    '{}',
    '5000'
  );

CREATE TRIGGER "notify-trial-insert"
  AFTER INSERT ON public.trial_lessons
  FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request(
    'https://wcaslabeiwtvygxtzcio.supabase.co/functions/v1/notify-new-enrollment',
    'POST',
    '{"Content-type":"application/json","Authorization":"Bearer <SUPABASE_SERVICE_ROLE_KEY>"}',
    '{}',
    '5000'
  );

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.cancellations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pronunciation_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_exercise_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_vocabulary_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocabulary_cards ENABLE ROW LEVEL SECURITY;

-- cancellations
CREATE POLICY "Enable insert for everyone" ON public.cancellations FOR INSERT TO public WITH CHECK (true);

-- course_exceptions
CREATE POLICY "Public read access" ON public.course_exceptions FOR SELECT TO public USING (true);
CREATE POLICY "Admin write access" ON public.course_exceptions FOR INSERT TO public WITH CHECK (true);

-- courses
CREATE POLICY "Courses are publicly viewable" ON public.courses FOR SELECT TO public USING (true);

-- enrollments
CREATE POLICY "Anyone can insert enrollments" ON public.enrollments FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Enrollments viewable by service_role only" ON public.enrollments FOR SELECT TO service_role USING (true);
CREATE POLICY "Service Role Full Access Enrollments" ON public.enrollments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- exercises
CREATE POLICY "Nutzer können Übungen sehen" ON public.exercises FOR SELECT TO public USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins und Lehrer dürfen Übungen einfügen" ON public.exercises FOR INSERT TO public WITH CHECK ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['admin'::text, 'teacher'::text]));
CREATE POLICY "Admins und Lehrer dürfen Übungen bearbeiten" ON public.exercises FOR UPDATE TO public USING ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['admin'::text, 'teacher'::text]));
CREATE POLICY "Admins und Lehrer dürfen Übungen löschen" ON public.exercises FOR DELETE TO public USING ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['admin'::text, 'teacher'::text]));

-- profiles
CREATE POLICY "Benutzer können eigenes Profil sehen" ON public.profiles FOR SELECT
  TO authenticated USING ((SELECT auth.uid()) = id);
CREATE POLICY "Benutzer können eigenes Profil aktualisieren" ON public.profiles FOR UPDATE
  TO authenticated USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY "Admins und Lehrer können Profile updaten" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin'))
  WITH CHECK ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin'));

-- registrations
CREATE POLICY "Anyone can insert registration" ON public.registrations FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Registrations viewable by service_role only" ON public.registrations FOR SELECT TO service_role USING (true);
CREATE POLICY "Service Role Full Access Registrations" ON public.registrations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- submissions
CREATE POLICY "Studenten können Submissions erstellen" ON public.submissions FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Studenten sehen eigene Submissions" ON public.submissions FOR SELECT TO public USING (auth.uid() = user_id);
CREATE POLICY "Lehrer sehen alle Submissions" ON public.submissions FOR SELECT TO authenticated
  USING ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin'));
CREATE POLICY "Lehrer können Submissions updaten" ON public.submissions FOR UPDATE TO authenticated
  USING ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin'))
  WITH CHECK ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin'));

-- teacher_feedback
CREATE POLICY "Lehrer können Feedback erstellen" ON public.teacher_feedback FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = teacher_id
    AND (SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin'));
CREATE POLICY "Lehrer sehen alle Feedbacks" ON public.teacher_feedback FOR SELECT TO authenticated
  USING ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin'));
CREATE POLICY "Studenten sehen ihr Feedback" ON public.teacher_feedback FOR SELECT TO public USING (EXISTS (SELECT 1 FROM submissions WHERE submissions.id = teacher_feedback.submission_id AND submissions.user_id = auth.uid()));

-- trial_lessons
CREATE POLICY "Anyone can insert trial_lessons" ON public.trial_lessons FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "trial_lessons viewable by service_role" ON public.trial_lessons FOR SELECT TO service_role USING (true);
CREATE POLICY "trial_lessons updatable by service_role" ON public.trial_lessons FOR UPDATE TO service_role USING (true);

-- user_exercise_progress
CREATE POLICY "Nutzer können eigenen Übungsfortschritt anlegen" ON public.user_exercise_progress FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Nutzer sehen eigenen Übungsfortschritt" ON public.user_exercise_progress FOR SELECT TO public USING (auth.uid() = user_id);
CREATE POLICY "Nutzer können eigenen Übungsfortschritt updaten" ON public.user_exercise_progress FOR UPDATE TO public USING (auth.uid() = user_id);

-- user_vocabulary_progress
CREATE POLICY "Nutzer können eigenen Lernfortschritt einfügen" ON public.user_vocabulary_progress FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Nutzer sehen eigenen Lernfortschritt" ON public.user_vocabulary_progress FOR SELECT TO public USING (auth.uid() = user_id);
CREATE POLICY "Nutzer können eigenen Lernfortschritt aktualisieren" ON public.user_vocabulary_progress FOR UPDATE TO public USING (auth.uid() = user_id);
CREATE POLICY "Nutzer können eigenen Lernfortschritt löschen" ON public.user_vocabulary_progress FOR DELETE TO public USING (auth.uid() = user_id);

-- users
CREATE POLICY "Users viewable by service_role only" ON public.users FOR SELECT TO service_role USING (true);
CREATE POLICY "Service Role Full Access Users" ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- pronunciation_prompts
CREATE POLICY "Nutzer können Übungssätze sehen" ON public.pronunciation_prompts FOR SELECT TO public USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins und Lehrer dürfen Übungssätze einfügen" ON public.pronunciation_prompts FOR INSERT TO public WITH CHECK ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['admin'::text, 'teacher'::text]));
CREATE POLICY "Admins und Lehrer dürfen Übungssätze bearbeiten" ON public.pronunciation_prompts FOR UPDATE TO public USING ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['admin'::text, 'teacher'::text]));
CREATE POLICY "Admins und Lehrer dürfen Übungssätze löschen" ON public.pronunciation_prompts FOR DELETE TO public USING ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['admin'::text, 'teacher'::text]));

-- videos
CREATE POLICY "Nutzer können Videos sehen" ON public.videos FOR SELECT TO public USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins und Lehrer dürfen Videos einfügen" ON public.videos FOR INSERT TO public WITH CHECK ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['admin'::text, 'teacher'::text]));
CREATE POLICY "Admins und Lehrer dürfen Videos bearbeiten" ON public.videos FOR UPDATE TO public USING ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['admin'::text, 'teacher'::text]));
CREATE POLICY "Admins und Lehrer dürfen Videos löschen" ON public.videos FOR DELETE TO public USING ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['admin'::text, 'teacher'::text]));

-- vocabulary_cards
CREATE POLICY "Jeder darf Vokabelkarten lesen" ON public.vocabulary_cards FOR SELECT TO public USING (true);
CREATE POLICY "Admins und Lehrer dürfen Vokabelkarten einfügen" ON public.vocabulary_cards FOR INSERT TO public WITH CHECK ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['admin'::text, 'teacher'::text]));
CREATE POLICY "Admins und Lehrer dürfen Vokabelkarten bearbeiten" ON public.vocabulary_cards FOR UPDATE TO public USING ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['admin'::text, 'teacher'::text]));
CREATE POLICY "Admins und Lehrer dürfen Vokabelkarten löschen" ON public.vocabulary_cards FOR DELETE TO public USING ((SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['admin'::text, 'teacher'::text]));

CREATE POLICY "Staff can read profiles" ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin'));

CREATE POLICY "Own bookings or admin" ON public.monthly_course_bookings
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT monthly_booking_private.current_profile_role()) = 'admin')
  WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT monthly_booking_private.current_profile_role()) = 'admin');

CREATE POLICY "Staff read notes" ON public.teacher_student_notes FOR SELECT TO authenticated
  USING ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin'));

CREATE POLICY "Staff insert notes as themselves" ON public.teacher_student_notes FOR INSERT TO authenticated
  WITH CHECK ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin')
    AND teacher_id = (SELECT auth.uid()));

CREATE POLICY "Staff update notes" ON public.teacher_student_notes FOR UPDATE TO authenticated
  USING ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin'))
  WITH CHECK ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin'));

CREATE POLICY "Staff delete notes" ON public.teacher_student_notes FOR DELETE TO authenticated
  USING ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin'));

ALTER TABLE public.monthly_course_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_student_notes ENABLE ROW LEVEL SECURITY;

-- New indexes, immutable-author/booking triggers, UUID-array FK projection,
-- contact migration audit, private role helper and column grants are defined in
-- migrations/20260909155919_monthly_bookings_teacher_notes.sql. Apply that file,
-- not this deliberately partial reference. Browser profile UPDATE grants cover
-- only name, native_language, ui_language, phone, street, zip_code, city.

-- Profile dashboard follow-up: migrations/20260909165848_profile_dashboard_workflow.sql
-- defines save_next_month_booking (SECURITY INVOKER, owner-bound, compare-and-swap),
-- the private confirmed-email synchronization trigger, and profiles_legacy_user_idx.
-- legacy_user_id has no browser UPDATE grant; only verified/trusted associations
-- are retained so an auth email change does not unlink existing enrollments.


-- Bidirectional vocabulary learning: the legacy progress table stays intact.
-- Private mutation RPCs and compatibility trigger: see 20260910133125 migration.
CREATE TABLE public.vocabulary_direction_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.vocabulary_cards(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('de_to_native','native_to_de')),
  box_number integer CHECK (box_number BETWEEN 1 AND 7) DEFAULT 1,
  next_review_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  lapses integer NOT NULL DEFAULT 0,
  last_answered_at timestamptz,
  UNIQUE (user_id,card_id,direction)
);
ALTER TABLE public.vocabulary_direction_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vocabulary_direction_progress FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vocabulary_direction_progress TO authenticated;
GRANT ALL ON public.vocabulary_direction_progress TO service_role;
CREATE POLICY vocabulary_direction_owner_read ON public.vocabulary_direction_progress FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE TABLE public.vocabulary_learning_state (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_card_id uuid REFERENCES public.vocabulary_cards(id) ON DELETE SET NULL,
  last_reviewed_at timestamptz
);
ALTER TABLE public.vocabulary_learning_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vocabulary_learning_state FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vocabulary_learning_state TO authenticated;
GRANT ALL ON public.vocabulary_learning_state TO service_role;
CREATE POLICY vocabulary_state_owner_read ON public.vocabulary_learning_state FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE TABLE public.vocabulary_onboarding (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2')),
  status text NOT NULL CHECK (status IN ('skipped', 'completed')),
  started_lesson text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, level)
);
ALTER TABLE public.vocabulary_onboarding ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vocabulary_onboarding FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vocabulary_onboarding TO authenticated;
GRANT ALL ON public.vocabulary_onboarding TO service_role;
CREATE POLICY vocabulary_onboarding_owner_read ON public.vocabulary_onboarding FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Neural audio: public content-addressed MP3 retrieval; only server service-role uploads.
-- Bucket creation and compatibility assertions: 20260910151457_neural_audio_cache.sql.
-- storage.buckets: audio_cache, public=true, file_size_limit=1048576,
-- allowed_mime_types={'audio/mpeg'}. No client object mutation/listing policy.
-- vocabulary_cards.audio_url stores the canonical German headword recording only.

CREATE TABLE vocabulary_private.answer_receipts (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  progress_id uuid NOT NULL,
  is_correct boolean,
  typed_answer text CHECK (length(typed_answer) <= 4000),
  ui_language text NOT NULL CHECK (ui_language IN ('de','en','ru','uk','tr')),
  response jsonb NOT NULL CHECK (jsonb_typeof(response) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id)
);
ALTER TABLE vocabulary_private.answer_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vocabulary_private.answer_receipts FROM PUBLIC, anon, authenticated, service_role;
-- No direct table policies by design. Migration 20260910151533 defines the
-- authenticated, owner-bound private submit_answer_once and public invoker wrapper
-- submit_vocabulary_answer_once(uuid,uuid,boolean,text,text). Exact request replay
-- returns the committed response without grading twice or moving the cursor.

-- Learning platform refresh, 2026-09-10. Additive definitions; legacy data retained.

-- Source: 20260910184129_secure_registration_manual_invoicing.sql
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Keep submitted contact details separate from the established student record.
-- Public registration must never change an existing person's identity.
ALTER TABLE public.registrations ADD COLUMN contact_snapshot jsonb;
ALTER TABLE public.registrations ADD CONSTRAINT registrations_contact_snapshot_object
  CHECK (contact_snapshot IS NULL OR jsonb_typeof(contact_snapshot) = 'object');

-- All public enrollment writes already go through a rate-limited server action.
-- Direct anonymous writes could bypass pending status and consent validation.
DROP POLICY IF EXISTS "Anyone can insert registration" ON public.registrations;
DROP POLICY IF EXISTS "Anyone can insert enrollments" ON public.enrollments;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.registrations, public.enrollments, public.users FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS users_normalized_email_idx ON public.users (lower(btrim(email)));
CREATE INDEX IF NOT EXISTS registrations_status_start_idx ON public.registrations(status, start_date);

-- No email/name argument is accepted. Auth confirms email ownership, and the
-- association is saved atomically so later email changes cannot claim a second
-- person. Shared addresses and an already claimed legacy record stay unlinked.
CREATE FUNCTION monthly_booking_private.claim_verified_legacy_profile()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid();
  verified_email text;
  existing_link uuid;
  candidate uuid;
  matches integer;
  person public.users;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT lower(btrim(email)) INTO verified_email FROM auth.users
    WHERE id = actor AND email_confirmed_at IS NOT NULL;
  IF verified_email IS NULL THEN RETURN jsonb_build_object('id', NULL, 'unresolved', false); END IF;
  SELECT legacy_user_id INTO existing_link FROM public.profiles WHERE id = actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile missing' USING ERRCODE = '42501'; END IF;
  IF existing_link IS NOT NULL THEN RETURN jsonb_build_object('id', existing_link, 'unresolved', false); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('legacy-email:' || verified_email, 0));
  SELECT count(*), (array_agg(id))[1] INTO matches, candidate FROM public.users WHERE lower(btrim(email)) = verified_email;
  IF matches <> 1 THEN RETURN jsonb_build_object('id', NULL, 'unresolved', matches > 1); END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE legacy_user_id = candidate AND id <> actor) THEN
    RETURN jsonb_build_object('id', NULL, 'unresolved', true);
  END IF;
  SELECT * INTO person FROM public.users WHERE id = candidate;
  UPDATE public.profiles SET legacy_user_id = candidate,
    name = btrim(person.first_name || ' ' || person.last_name),
    phone = coalesce(phone, person.phone), street = coalesce(street, person.street),
    zip_code = coalesce(zip_code, person.zip), city = coalesce(city, person.city), updated_at = now()
    WHERE id = actor AND legacy_user_id IS NULL;
  RETURN jsonb_build_object('id', candidate, 'unresolved', false);
END $$;
REVOKE ALL ON FUNCTION monthly_booking_private.claim_verified_legacy_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION monthly_booking_private.claim_verified_legacy_profile() TO authenticated;
CREATE FUNCTION public.claim_verified_legacy_profile() RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT monthly_booking_private.claim_verified_legacy_profile();
$$;
REVOKE ALL ON FUNCTION public.claim_verified_legacy_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_verified_legacy_profile() TO authenticated;

CREATE TABLE public.manual_invoice_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid REFERENCES public.registrations(id) ON DELETE RESTRICT,
  monthly_booking_id uuid REFERENCES public.monthly_course_bookings(id) ON DELETE RESTRICT,
  target_month date NOT NULL CHECK (extract(day FROM target_month) = 1),
  status text NOT NULL DEFAULT 'outstanding' CHECK (status IN ('outstanding', 'created')),
  invoice_reference text CHECK (char_length(invoice_reference) <= 120),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  invoice_created_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(registration_id, monthly_booking_id) = 1),
  CHECK ((status = 'created') = (invoice_created_at IS NOT NULL))
);
CREATE UNIQUE INDEX manual_invoice_registration_month_idx ON public.manual_invoice_status(registration_id, target_month) WHERE registration_id IS NOT NULL;
CREATE UNIQUE INDEX manual_invoice_booking_month_idx ON public.manual_invoice_status(monthly_booking_id, target_month) WHERE monthly_booking_id IS NOT NULL;
CREATE INDEX manual_invoice_month_status_idx ON public.manual_invoice_status(target_month, status);
CREATE INDEX manual_invoice_created_by_idx ON public.manual_invoice_status(created_by);
ALTER TABLE public.manual_invoice_status ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.manual_invoice_status FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.manual_invoice_status TO authenticated;
GRANT ALL ON public.manual_invoice_status TO service_role;
CREATE POLICY "Staff read manual invoice status" ON public.manual_invoice_status FOR SELECT TO authenticated
  USING ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin'));

CREATE FUNCTION monthly_booking_private.confirm_staff_registration(p_source text, p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE current_status text;
BEGIN
  IF auth.uid() IS NULL OR coalesce(monthly_booking_private.current_profile_role(), '') NOT IN ('teacher', 'admin') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_source = 'registration' THEN
    SELECT status INTO current_status FROM public.registrations WHERE id = p_id FOR UPDATE;
    IF current_status = 'pending' THEN UPDATE public.registrations SET status = 'confirmed' WHERE id = p_id; END IF;
  ELSIF p_source = 'monthly_booking' THEN
    SELECT status INTO current_status FROM public.monthly_course_bookings WHERE id = p_id FOR UPDATE;
    IF current_status = 'pending' THEN UPDATE public.monthly_course_bookings SET status = 'confirmed' WHERE id = p_id; END IF;
  ELSE RAISE EXCEPTION 'Invalid source' USING ERRCODE = '23514';
  END IF;
  IF current_status IS NULL THEN RAISE EXCEPTION 'Not found' USING ERRCODE = 'P0002'; END IF;
  IF current_status NOT IN ('pending', 'confirmed') THEN RAISE EXCEPTION 'Registration changed' USING ERRCODE = '40001'; END IF;
  RETURN jsonb_build_object('status', 'confirmed');
END $$;
REVOKE ALL ON FUNCTION monthly_booking_private.confirm_staff_registration(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION monthly_booking_private.confirm_staff_registration(text, uuid) TO authenticated;
CREATE FUNCTION public.confirm_staff_registration(p_source text, p_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT monthly_booking_private.confirm_staff_registration(p_source, p_id); $$;
REVOKE ALL ON FUNCTION public.confirm_staff_registration(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_staff_registration(text, uuid) TO authenticated;

CREATE FUNCTION monthly_booking_private.set_manual_invoice_status(p_source text, p_id uuid, p_month date, p_created boolean, p_reference text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE saved public.manual_invoice_status; current_status text; source_month date;
BEGIN
  IF auth.uid() IS NULL OR coalesce(monthly_booking_private.current_profile_role(), '') NOT IN ('teacher', 'admin') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_month IS NULL OR extract(day FROM p_month) <> 1 OR p_created IS NULL OR char_length(p_reference) > 120 THEN
    RAISE EXCEPTION 'Invalid input' USING ERRCODE = '23514';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('invoice:' || p_source || ':' || p_id::text || ':' || p_month::text, 0));
  IF p_source = 'registration' THEN
    SELECT status, date_trunc('month', start_date)::date INTO current_status, source_month FROM public.registrations WHERE id = p_id FOR SHARE;
    IF p_month < source_month THEN RAISE EXCEPTION 'Invalid month' USING ERRCODE = '23514'; END IF;
  ELSIF p_source = 'monthly_booking' THEN
    SELECT status, target_month INTO current_status, source_month FROM public.monthly_course_bookings WHERE id = p_id FOR SHARE;
    IF p_month IS DISTINCT FROM source_month THEN RAISE EXCEPTION 'Invalid month' USING ERRCODE = '23514'; END IF;
  ELSE RAISE EXCEPTION 'Invalid source' USING ERRCODE = '23514';
  END IF;
  IF current_status IS DISTINCT FROM 'confirmed' AND p_created THEN
    RAISE EXCEPTION 'Booking not confirmed' USING ERRCODE = '40001';
  END IF;
  SELECT * INTO saved FROM public.manual_invoice_status WHERE target_month = p_month
    AND (CASE WHEN p_source = 'registration' THEN registration_id = p_id ELSE monthly_booking_id = p_id END) FOR UPDATE;
  IF saved.id IS NULL THEN
    INSERT INTO public.manual_invoice_status(registration_id, monthly_booking_id, target_month)
    VALUES(CASE WHEN p_source = 'registration' THEN p_id END, CASE WHEN p_source = 'monthly_booking' THEN p_id END, p_month)
    RETURNING * INTO saved;
  END IF;
  UPDATE public.manual_invoice_status SET status = CASE WHEN p_created THEN 'created' ELSE 'outstanding' END,
    invoice_reference = CASE WHEN p_created THEN nullif(btrim(p_reference), '') ELSE NULL END,
    created_by = CASE WHEN p_created THEN auth.uid() ELSE NULL END,
    invoice_created_at = CASE WHEN p_created THEN coalesce(saved.invoice_created_at, now()) ELSE NULL END, updated_at = now()
    WHERE id = saved.id RETURNING * INTO saved;
  RETURN to_jsonb(saved);
END $$;
REVOKE ALL ON FUNCTION monthly_booking_private.set_manual_invoice_status(text, uuid, date, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION monthly_booking_private.set_manual_invoice_status(text, uuid, date, boolean, text) TO authenticated;
CREATE FUNCTION public.set_manual_invoice_status(p_source text, p_id uuid, p_month date, p_created boolean, p_reference text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
 SELECT monthly_booking_private.set_manual_invoice_status(p_source, p_id, p_month, p_created, p_reference);
$$;
REVOKE ALL ON FUNCTION public.set_manual_invoice_status(text, uuid, date, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_manual_invoice_status(text, uuid, date, boolean, text) TO authenticated;
COMMIT;


-- Source: 20260910184438_pronunciation_reading_conversations.sql
-- Additive upgrade: original submissions, feedback and public files remain intact.
ALTER TABLE public.pronunciation_prompts ADD COLUMN IF NOT EXISTS level text
  CHECK (level IN ('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2'));
ALTER TABLE public.pronunciation_prompts ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.pronunciation_prompts ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS pronunciation_prompts_level_active_idx ON public.pronunciation_prompts (level, sort_order) WHERE is_active;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS prompt_id uuid REFERENCES public.pronunciation_prompts(id) ON DELETE SET NULL;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS prompt_title text;
CREATE INDEX IF NOT EXISTS submissions_prompt_id_idx ON public.submissions(prompt_id);
CREATE SCHEMA IF NOT EXISTS pronunciation_private;
REVOKE ALL ON SCHEMA pronunciation_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA pronunciation_private TO authenticated;
CREATE OR REPLACE FUNCTION pronunciation_private.can_access_submission(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS (
   SELECT 1 FROM public.submissions s WHERE s.id = p_id AND
   (s.user_id = (SELECT auth.uid()) OR (SELECT monthly_booking_private.current_profile_role()) IN ('teacher','admin'))
 );
$$;
REVOKE ALL ON FUNCTION pronunciation_private.can_access_submission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pronunciation_private.can_access_submission(uuid) TO authenticated;
CREATE TABLE public.pronunciation_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
 sender_id uuid NOT NULL REFERENCES public.profiles(id),
 sender_role text NOT NULL DEFAULT 'student' CHECK (sender_role IN ('student','teacher','admin')),
 text_content text NOT NULL DEFAULT '' CHECK (char_length(text_content) <= 5000),
 audio_path text,
 created_at timestamptz NOT NULL DEFAULT now(),
 seen_at timestamptz,
 CONSTRAINT pronunciation_message_not_empty CHECK (length(btrim(text_content)) > 0 OR audio_path IS NOT NULL)
);
CREATE INDEX pronunciation_messages_thread_created_idx ON public.pronunciation_messages(submission_id,created_at,id);
CREATE INDEX pronunciation_messages_sender_idx ON public.pronunciation_messages(sender_id);
CREATE INDEX pronunciation_messages_unseen_idx ON public.pronunciation_messages(submission_id) WHERE seen_at IS NULL;
ALTER TABLE public.pronunciation_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pronunciation_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.pronunciation_messages TO authenticated;
CREATE POLICY "Conversation participants read messages" ON public.pronunciation_messages FOR SELECT TO authenticated
 USING ((SELECT pronunciation_private.can_access_submission(submission_id)));
CREATE POLICY "Participants send their own messages" ON public.pronunciation_messages FOR INSERT TO authenticated
 WITH CHECK (sender_id = (SELECT auth.uid()) AND (SELECT pronunciation_private.can_access_submission(submission_id)));
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('pronunciation_audio','pronunciation_audio',false,26214400,ARRAY['audio/webm','audio/mp4','audio/ogg','audio/wav','audio/mpeg'])
 ON CONFLICT(id) DO NOTHING;
CREATE POLICY "Pronunciation owners upload" ON storage.objects FOR INSERT TO authenticated
 WITH CHECK (bucket_id = 'pronunciation_audio' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY "Pronunciation participants listen" ON storage.objects FOR SELECT TO authenticated USING (
 bucket_id = 'pronunciation_audio' AND (
 (storage.foldername(name))[1] = (SELECT auth.uid())::text
 OR (SELECT monthly_booking_private.current_profile_role()) IN ('teacher','admin')
 OR EXISTS(SELECT 1 FROM public.pronunciation_messages m WHERE m.audio_path = 'storage://pronunciation_audio/' || name AND pronunciation_private.can_access_submission(m.submission_id))
 ));
CREATE OR REPLACE FUNCTION pronunciation_private.validate_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := (SELECT auth.uid()); actual_role text;
BEGIN
 IF actor IS NULL OR NEW.sender_id <> actor OR NOT pronunciation_private.can_access_submission(NEW.submission_id) THEN
   RAISE EXCEPTION 'Not authorized';
 END IF;
 actual_role := (SELECT p.role FROM public.profiles p WHERE p.id = actor);
 NEW.sender_role := CASE WHEN actual_role IN ('teacher','admin') THEN actual_role ELSE 'student' END;
 NEW.created_at := now(); NEW.seen_at := NULL;
 IF NEW.audio_path IS NOT NULL AND (
   NEW.audio_path NOT LIKE 'storage://pronunciation_audio/' || actor::text || '/%'
   OR NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'pronunciation_audio' AND 'storage://pronunciation_audio/' || o.name = NEW.audio_path)
 ) THEN RAISE EXCEPTION 'Invalid recording'; END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION pronunciation_private.validate_message() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER pronunciation_message_validate BEFORE INSERT ON public.pronunciation_messages
 FOR EACH ROW EXECUTE FUNCTION pronunciation_private.validate_message();
CREATE OR REPLACE FUNCTION pronunciation_private.update_conversation_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NEW.sender_id <> (SELECT auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 UPDATE public.submissions SET status = CASE WHEN NEW.sender_role IN ('teacher','admin') THEN 'reviewed' ELSE 'pending' END WHERE id = NEW.submission_id;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION pronunciation_private.update_conversation_status() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER pronunciation_message_status AFTER INSERT ON public.pronunciation_messages
 FOR EACH ROW EXECUTE FUNCTION pronunciation_private.update_conversation_status();
CREATE OR REPLACE FUNCTION pronunciation_private.mark_seen(p_submission_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT pronunciation_private.can_access_submission(p_submission_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 UPDATE public.pronunciation_messages SET seen_at = now()
 WHERE submission_id = p_submission_id AND sender_id <> (SELECT auth.uid()) AND seen_at IS NULL
 AND (CASE WHEN (SELECT monthly_booking_private.current_profile_role()) IN ('teacher','admin') THEN sender_role = 'student' ELSE sender_role IN ('teacher','admin') END);
END;
$$;
REVOKE ALL ON FUNCTION pronunciation_private.mark_seen(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pronunciation_private.mark_seen(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.mark_pronunciation_seen(p_submission_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT pronunciation_private.mark_seen(p_submission_id); $$;
REVOKE ALL ON FUNCTION public.mark_pronunciation_seen(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_pronunciation_seen(uuid) TO authenticated;
-- Exact level access also applies to REST reads. Legacy family texts stay available to staff.
DROP POLICY IF EXISTS "Nutzer können Übungssätze sehen" ON public.pronunciation_prompts;
CREATE POLICY "Readers access released pronunciation levels" ON public.pronunciation_prompts FOR SELECT TO authenticated USING (
 (SELECT monthly_booking_private.current_profile_role()) IN ('teacher','admin') OR
 (is_active AND level = ANY(COALESCE((SELECT p.allowed_levels FROM public.profiles p WHERE p.id = (SELECT auth.uid())), ARRAY[]::text[])))
);
ALTER POLICY "Admins und Lehrer dürfen Übungssätze einfügen" ON public.pronunciation_prompts TO authenticated
 WITH CHECK ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher','admin'));
ALTER POLICY "Admins und Lehrer dürfen Übungssätze bearbeiten" ON public.pronunciation_prompts TO authenticated
 USING ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher','admin'))
 WITH CHECK ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher','admin'));
ALTER POLICY "Admins und Lehrer dürfen Übungssätze löschen" ON public.pronunciation_prompts TO authenticated
 USING ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher','admin'));

-- Reading catalog: 60 seed records live in the linked migration.
-- Snapshot the reading text server-side, never trust a caller's text or level.
CREATE OR REPLACE FUNCTION pronunciation_private.create_submission(p_prompt_id uuid, p_audio_path text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := (SELECT auth.uid()); prompt public.pronunciation_prompts%ROWTYPE; result uuid;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 SELECT * INTO prompt FROM public.pronunciation_prompts WHERE id = p_prompt_id AND is_active;
 IF NOT FOUND OR prompt.level IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = actor AND
   (p.role IN ('teacher','admin') OR prompt.level = ANY(COALESCE(p.allowed_levels,ARRAY[]::text[])))) THEN RAISE EXCEPTION 'Level not allowed'; END IF;
 IF p_audio_path NOT LIKE 'storage://pronunciation_audio/' || actor::text || '/%' OR NOT EXISTS(
 SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'pronunciation_audio' AND 'storage://pronunciation_audio/' || o.name = p_audio_path)
 THEN RAISE EXCEPTION 'Invalid recording'; END IF;
 INSERT INTO public.submissions(user_id,type,content_url,text_content,status,level,prompt_id,prompt_title)
 VALUES(actor,'audio',p_audio_path,prompt.sentence_de,'pending',prompt.level,prompt.id,prompt.title) RETURNING id INTO result;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION pronunciation_private.create_submission(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pronunciation_private.create_submission(uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.create_pronunciation_submission(p_prompt_id uuid,p_audio_path text)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT pronunciation_private.create_submission(p_prompt_id,p_audio_path); $$;
REVOKE ALL ON FUNCTION public.create_pronunciation_submission(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_pronunciation_submission(uuid,text) TO authenticated;


-- Source: 20260910184937_grammar_curriculum_and_progress.sql
-- Apply through the bound project migration workflow, alongside the application.
-- No existing exercises or progress rows are removed.
CREATE SCHEMA IF NOT EXISTS grammar_private;
REVOKE ALL ON SCHEMA grammar_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA grammar_private TO authenticated;

-- Direct client writes could otherwise bypass answer checks and grant scores.
REVOKE INSERT, UPDATE, DELETE ON public.user_exercise_progress FROM anon, authenticated;
GRANT SELECT ON public.user_exercise_progress TO authenticated;

CREATE POLICY exercises_level_guard ON public.exercises AS RESTRICTIVE
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid())
    AND (p.role IN ('teacher', 'admin') OR exercises.level = ANY(coalesce(p.allowed_levels, ARRAY[]::text[]))))
);

CREATE FUNCTION grammar_private.record_attempt(p_exercise_id uuid, p_answer text, p_hint_shown boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid();
  target public.exercises;
  correct boolean;
  answer_normalized text;
  attempt_count integer;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF p_answer IS NULL OR length(btrim(p_answer)) = 0 OR length(p_answer) > 1000 THEN
    RAISE EXCEPTION 'invalid_answer' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO target FROM public.exercises WHERE id = p_exercise_id;
  IF NOT FOUND OR target.type NOT IN ('fill_in_blank', 'multiple_choice') THEN
    RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = actor
    AND (p.role IN ('teacher','admin') OR target.level = ANY(coalesce(p.allowed_levels, ARRAY[]::text[])))) THEN
    RAISE EXCEPTION 'level_access_denied' USING ERRCODE = '42501';
  END IF;
  IF coalesce(target.content->>'correct_answer', '') = '' THEN
    RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE = '22023';
  END IF;
  answer_normalized := lower(regexp_replace(btrim(p_answer), '\s+', ' ', 'g'));
  correct := answer_normalized = lower(regexp_replace(btrim(target.content->>'correct_answer'), '\s+', ' ', 'g'));

  INSERT INTO public.user_exercise_progress AS progress
    (user_id, exercise_id, attempts, completed, score, hint_shown, updated_at)
  VALUES (actor, p_exercise_id, 1, correct, CASE WHEN correct THEN 100 ELSE 0 END, coalesce(p_hint_shown,false), now())
  ON CONFLICT (user_id, exercise_id) DO UPDATE SET
    attempts = progress.attempts + 1,
    completed = coalesce(progress.completed, false) OR correct,
    hint_shown = progress.hint_shown OR coalesce(p_hint_shown, false),
    score = greatest(coalesce(progress.score, 0), CASE WHEN correct THEN
      CASE WHEN progress.attempts + 1 <= 1 THEN 100 WHEN progress.attempts + 1 = 2 THEN 80
        WHEN progress.attempts + 1 = 3 THEN 60 ELSE 40 END ELSE 0 END),
    updated_at = now()
  RETURNING attempts INTO attempt_count;
  RETURN jsonb_build_object('success', true, 'attempts', attempt_count, 'isCorrect', correct);
END;
$$;
REVOKE ALL ON FUNCTION grammar_private.record_attempt(uuid,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION grammar_private.record_attempt(uuid,text,boolean) TO authenticated;

CREATE FUNCTION public.record_grammar_attempt(p_exercise_id uuid, p_answer text, p_hint_shown boolean DEFAULT false)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT grammar_private.record_attempt(p_exercise_id, p_answer, p_hint_shown);
$$;
REVOKE ALL ON FUNCTION public.record_grammar_attempt(uuid,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_grammar_attempt(uuid,text,boolean) TO authenticated;



-- Additional per-pupil invoice guard.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE OR REPLACE FUNCTION monthly_booking_private.set_manual_invoice_status(p_source text, p_id uuid, p_month date, p_created boolean, p_reference text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE saved public.manual_invoice_status; current_status text; source_month date; person_id uuid;
BEGIN
  IF auth.uid() IS NULL OR coalesce(monthly_booking_private.current_profile_role(), '') NOT IN ('teacher', 'admin') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_month IS NULL OR extract(day FROM p_month) <> 1 OR p_created IS NULL OR char_length(p_reference) > 120 THEN
    RAISE EXCEPTION 'Invalid input' USING ERRCODE = '23514';
  END IF;
  IF p_source = 'registration' THEN
    SELECT status, date_trunc('month', start_date)::date, user_id INTO current_status, source_month, person_id FROM public.registrations WHERE id = p_id FOR SHARE;
    IF p_month < source_month THEN RAISE EXCEPTION 'Invalid month' USING ERRCODE = '23514'; END IF;
  ELSIF p_source = 'monthly_booking' THEN
    SELECT b.status, b.target_month, coalesce(p.legacy_user_id, p.id) INTO current_status, source_month, person_id
      FROM public.monthly_course_bookings b JOIN public.profiles p ON p.id = b.user_id WHERE b.id = p_id FOR SHARE OF b;
    IF p_month IS DISTINCT FROM source_month THEN RAISE EXCEPTION 'Invalid month' USING ERRCODE = '23514'; END IF;
  ELSE RAISE EXCEPTION 'Invalid source' USING ERRCODE = '23514';
  END IF;
  IF current_status IS DISTINCT FROM 'confirmed' AND p_created THEN
    RAISE EXCEPTION 'Booking not confirmed' USING ERRCODE = '40001';
  END IF;
  IF person_id IS NULL THEN RAISE EXCEPTION 'Not found' USING ERRCODE = 'P0002'; END IF;
  -- Serialize by pupil and month, including when a new registration or monthly
  -- selection replaces a previously invoiced source. Staff can reopen the old
  -- label first; the same pupil must never accidentally appear twice as due.
  PERFORM pg_advisory_xact_lock(hashtextextended('invoice-person:' || person_id::text || ':' || p_month::text, 0));
  IF p_created AND EXISTS (
    SELECT 1 FROM public.manual_invoice_status i
    LEFT JOIN public.registrations r ON r.id = i.registration_id
    LEFT JOIN public.monthly_course_bookings b ON b.id = i.monthly_booking_id
    LEFT JOIN public.profiles p ON p.id = b.user_id
    WHERE i.target_month = p_month AND i.status = 'created'
      AND coalesce(r.user_id, p.legacy_user_id, p.id) = person_id
      AND ((p_source = 'registration' AND i.registration_id = p_id)
        OR (p_source = 'monthly_booking' AND i.monthly_booking_id = p_id)) IS NOT TRUE
  ) THEN RAISE EXCEPTION 'Invoice already recorded for this pupil and month' USING ERRCODE = '40001'; END IF;
  SELECT * INTO saved FROM public.manual_invoice_status WHERE target_month = p_month
    AND (CASE WHEN p_source = 'registration' THEN registration_id = p_id ELSE monthly_booking_id = p_id END) FOR UPDATE;
  IF saved.id IS NULL THEN
    INSERT INTO public.manual_invoice_status(registration_id, monthly_booking_id, target_month)
    VALUES(CASE WHEN p_source = 'registration' THEN p_id END, CASE WHEN p_source = 'monthly_booking' THEN p_id END, p_month)
    RETURNING * INTO saved;
  END IF;
  UPDATE public.manual_invoice_status SET status = CASE WHEN p_created THEN 'created' ELSE 'outstanding' END,
    invoice_reference = CASE WHEN p_created THEN nullif(btrim(p_reference), '') ELSE NULL END,
    created_by = CASE WHEN p_created THEN auth.uid() ELSE NULL END,
    invoice_created_at = CASE WHEN p_created THEN coalesce(saved.invoice_created_at, now()) ELSE NULL END, updated_at = now()
    WHERE id = saved.id RETURNING * INTO saved;
  RETURN to_jsonb(saved);
END $$;

COMMIT;

-- Longer reading texts require a bounded two-megabyte synthesized reference cache.
UPDATE storage.buckets SET file_size_limit = 2097152 WHERE id = 'audio_cache';
-- Trigger execution does not require clients to call these functions directly.
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.handle_registration_confirmation() SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.handle_new_user(), public.handle_registration_confirmation() FROM PUBLIC, anon, authenticated;

-- Curriculum content proofread: 20260910190329_grammar_curriculum_proofread.sql;
-- same IDs, guarded content-only updates, no schema or learner data changes.

-- Source: 20260910195205_complete_learning_reset.sql
-- Defines an opt-in, resumable reset. This migration does not reset any account.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
CREATE SCHEMA learning_reset_private;
REVOKE ALL ON SCHEMA learning_reset_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA learning_reset_private TO authenticated;
CREATE TABLE learning_reset_private.jobs (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 active boolean NOT NULL DEFAULT true,
 requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 completed_at timestamptz
);
CREATE TABLE learning_reset_private.audio_objects (
 user_id uuid NOT NULL REFERENCES learning_reset_private.jobs(user_id) ON DELETE CASCADE,
 object_id uuid NOT NULL,
 bucket_id text NOT NULL CHECK (bucket_id IN ('audio_submissions','pronunciation_audio')),
 object_name text NOT NULL,
 PRIMARY KEY(user_id, object_id)
);
ALTER TABLE learning_reset_private.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_reset_private.audio_objects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON learning_reset_private.jobs, learning_reset_private.audio_objects FROM PUBLIC, anon, authenticated;
-- No API table grants. Only the owner-checked functions below access this schema.

CREATE FUNCTION learning_reset_private.matches_audio(p_reference text,p_bucket text,p_name text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(p_reference='storage://' || p_bucket || '/' || p_name OR
 split_part(p_reference,'?',1) IN (
 'https://wcaslabeiwtvygxtzcio.supabase.co/storage/v1/object/public/' || p_bucket || '/' || p_name,
 'https://wcaslabeiwtvygxtzcio.supabase.co/storage/v1/object/sign/' || p_bucket || '/' || p_name,
 'https://wcaslabeiwtvygxtzcio.supabase.co/storage/v1/object/authenticated/' || p_bucket || '/' || p_name),false);
$$;
REVOKE ALL ON FUNCTION learning_reset_private.matches_audio(text,text,text) FROM PUBLIC,anon,authenticated;

-- Lock order matches the existing vocabulary RPCs, then serializes all learning
-- writes for this learner. A pending reset cannot be repopulated by other tabs.
CREATE FUNCTION learning_reset_private.assert_writable(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE was_active boolean;
BEGIN
 IF p_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 SELECT active INTO was_active FROM learning_reset_private.jobs WHERE user_id=p_user;
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:' || p_user::text,0));
 IF coalesce(was_active,false) OR EXISTS(SELECT 1 FROM learning_reset_private.jobs WHERE user_id=p_user AND
   (active OR completed_at > transaction_timestamp())) THEN
  RAISE EXCEPTION 'learning_reset_in_progress' USING ERRCODE='55000';
 END IF;
END;
$$;
REVOKE ALL ON FUNCTION learning_reset_private.assert_writable(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION learning_reset_private.guard_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE learner uuid; reference text;
BEGIN
 -- Only the reset owner may detach an unchanged foreign legacy child before
 -- deleting its own parent. Do not cascade-delete another learner's submission.
 IF TG_TABLE_NAME='submissions' THEN
  IF TG_OP='UPDATE' THEN
   IF NEW.parent_id IS NULL AND OLD.parent_id IS NOT NULL
    AND (to_jsonb(NEW)-'parent_id')=(to_jsonb(OLD)-'parent_id')
    AND EXISTS(SELECT 1 FROM public.submissions s JOIN learning_reset_private.jobs j ON j.user_id=s.user_id
      WHERE s.id=OLD.parent_id AND j.active AND s.user_id=(SELECT auth.uid())) THEN RETURN NEW; END IF;
  END IF;
 END IF;
 IF TG_TABLE_NAME IN ('submissions','pronunciation_messages','teacher_feedback') THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
  IF TG_TABLE_NAME='submissions' THEN reference:=NEW.content_url;
  ELSIF TG_TABLE_NAME='pronunciation_messages' THEN reference:=NEW.audio_path;
  ELSE reference:=NEW.feedback_audio_url; END IF;
  IF EXISTS(SELECT 1 FROM learning_reset_private.audio_objects a JOIN learning_reset_private.jobs j USING(user_id)
    WHERE j.active AND learning_reset_private.matches_audio(reference,a.bucket_id,a.object_name)) THEN
   RAISE EXCEPTION 'learning_reset_in_progress' USING ERRCODE='55000';
  END IF;
 END IF;
 IF TG_TABLE_NAME IN ('pronunciation_messages','teacher_feedback') THEN
  SELECT user_id INTO learner FROM public.submissions WHERE id=NEW.submission_id;
 ELSE learner:=NEW.user_id;
 END IF;
 IF learner IS NOT NULL THEN PERFORM learning_reset_private.assert_writable(learner); END IF;
 IF TG_TABLE_NAME='submissions' THEN
  IF NEW.parent_id IS NOT NULL AND EXISTS(
   SELECT 1 FROM public.submissions WHERE id=NEW.parent_id AND user_id<>NEW.user_id) THEN
   RAISE EXCEPTION 'submission_owner_mismatch' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION learning_reset_private.guard_write() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER learning_reset_guard BEFORE INSERT OR UPDATE ON public.user_vocabulary_progress FOR EACH ROW EXECUTE FUNCTION learning_reset_private.guard_write();
CREATE TRIGGER learning_reset_guard BEFORE INSERT OR UPDATE ON public.vocabulary_direction_progress FOR EACH ROW EXECUTE FUNCTION learning_reset_private.guard_write();
CREATE TRIGGER learning_reset_guard BEFORE INSERT OR UPDATE ON public.vocabulary_learning_state FOR EACH ROW EXECUTE FUNCTION learning_reset_private.guard_write();
CREATE TRIGGER learning_reset_guard BEFORE INSERT OR UPDATE ON public.vocabulary_onboarding FOR EACH ROW EXECUTE FUNCTION learning_reset_private.guard_write();
CREATE TRIGGER learning_reset_guard BEFORE INSERT OR UPDATE ON vocabulary_private.answer_receipts FOR EACH ROW EXECUTE FUNCTION learning_reset_private.guard_write();
CREATE TRIGGER learning_reset_guard BEFORE INSERT OR UPDATE ON public.user_exercise_progress FOR EACH ROW EXECUTE FUNCTION learning_reset_private.guard_write();
CREATE TRIGGER learning_reset_guard BEFORE INSERT OR UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION learning_reset_private.guard_write();
CREATE TRIGGER learning_reset_guard BEFORE INSERT OR UPDATE ON public.teacher_feedback FOR EACH ROW EXECUTE FUNCTION learning_reset_private.guard_write();
CREATE TRIGGER learning_reset_guard BEFORE INSERT OR UPDATE ON public.pronunciation_messages FOR EACH ROW EXECUTE FUNCTION learning_reset_private.guard_write();

CREATE FUNCTION learning_reset_private.storage_writable(p_bucket text,p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_bucket NOT IN ('audio_submissions','pronunciation_audio') THEN RETURN true; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 IF EXISTS(SELECT 1 FROM learning_reset_private.audio_objects a JOIN learning_reset_private.jobs j USING(user_id)
   WHERE a.object_id=p_id AND j.active) THEN RAISE EXCEPTION 'learning_reset_in_progress' USING ERRCODE='55000'; END IF;
 PERFORM learning_reset_private.assert_writable((SELECT auth.uid()));
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION learning_reset_private.storage_writable(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION learning_reset_private.storage_writable(text,uuid) TO authenticated;
CREATE POLICY "No audio uploads during learning reset" ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (learning_reset_private.storage_writable(bucket_id,id));
CREATE POLICY "No audio overwrites during learning reset" ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING (learning_reset_private.storage_writable(bucket_id,id)) WITH CHECK (learning_reset_private.storage_writable(bucket_id,id));

CREATE FUNCTION learning_reset_private.begin_reset(p_confirmation text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); job learning_reset_private.jobs;
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor) THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_confirmation IS DISTINCT FROM 'RESET_LEARNING_DATA' THEN RAISE EXCEPTION 'confirmation_required' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:' || actor::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:' || actor::text,0));
 SELECT * INTO job FROM learning_reset_private.jobs WHERE user_id=actor FOR UPDATE;
 IF FOUND AND job.active THEN RETURN job.token; END IF;
 INSERT INTO learning_reset_private.jobs(user_id) VALUES(actor)
 ON CONFLICT(user_id) DO UPDATE SET token=gen_random_uuid(),active=true,requested_at=clock_timestamp(),completed_at=NULL
 RETURNING * INTO job;
 DELETE FROM learning_reset_private.audio_objects WHERE user_id=actor;
 -- Storage is read-only in SQL: snapshot object identities; the Action uses remove().
 -- Never trust a student's arbitrary content_url as proof of file ownership.
 INSERT INTO learning_reset_private.audio_objects(user_id,object_id,bucket_id,object_name)
 SELECT actor,o.id,o.bucket_id,o.name FROM storage.objects o
 WHERE o.bucket_id IN ('audio_submissions','pronunciation_audio') AND (
   o.owner_id=actor::text
   OR (o.owner_id IS NULL AND (o.name LIKE actor::text || '/%' OR o.name LIKE actor::text || '-%'))
   OR EXISTS(SELECT 1 FROM public.teacher_feedback f JOIN public.submissions s ON s.id=f.submission_id
     WHERE s.user_id=actor AND (o.owner_id=f.teacher_id::text OR (o.owner_id IS NULL AND o.name LIKE 'feedback/' || s.id::text || '_%'))
     AND learning_reset_private.matches_audio(f.feedback_audio_url,o.bucket_id,o.name))
   OR EXISTS(SELECT 1 FROM public.pronunciation_messages m JOIN public.submissions s ON s.id=m.submission_id
     WHERE s.user_id=actor AND o.owner_id=m.sender_id::text AND learning_reset_private.matches_audio(m.audio_path,o.bucket_id,o.name))
 )
 -- A teacher's clip shared with another learner must remain available there.
 AND NOT EXISTS(SELECT 1 FROM public.submissions s WHERE s.user_id<>actor AND learning_reset_private.matches_audio(s.content_url,o.bucket_id,o.name))
 AND NOT EXISTS(SELECT 1 FROM public.teacher_feedback f JOIN public.submissions s ON s.id=f.submission_id
   WHERE s.user_id<>actor AND learning_reset_private.matches_audio(f.feedback_audio_url,o.bucket_id,o.name))
 AND NOT EXISTS(SELECT 1 FROM public.pronunciation_messages m JOIN public.submissions s ON s.id=m.submission_id
   WHERE s.user_id<>actor AND learning_reset_private.matches_audio(m.audio_path,o.bucket_id,o.name));
 RETURN job.token;
END;
$$;
REVOKE ALL ON FUNCTION learning_reset_private.begin_reset(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION learning_reset_private.begin_reset(text) TO authenticated;
CREATE FUNCTION public.begin_learning_reset(p_confirmation text)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT learning_reset_private.begin_reset(p_confirmation); $$;
REVOKE ALL ON FUNCTION public.begin_learning_reset(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.begin_learning_reset(text) TO authenticated;

CREATE FUNCTION learning_reset_private.can_remove_audio(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS(
 SELECT 1 FROM learning_reset_private.audio_objects a JOIN learning_reset_private.jobs j USING(user_id)
 WHERE a.user_id=(SELECT auth.uid()) AND a.object_id=p_id AND j.active);
$$;
REVOKE ALL ON FUNCTION learning_reset_private.can_remove_audio(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION learning_reset_private.can_remove_audio(uuid) TO authenticated;
CREATE POLICY "Learning reset reads approved audio objects" ON storage.objects FOR SELECT TO authenticated
 USING (learning_reset_private.can_remove_audio(id));
CREATE POLICY "Learning reset deletes approved audio objects" ON storage.objects FOR DELETE TO authenticated
 USING (learning_reset_private.can_remove_audio(id));

CREATE FUNCTION learning_reset_private.audio_batch(p_token uuid)
RETURNS TABLE(bucket_id text,object_name text) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid());
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM learning_reset_private.jobs WHERE user_id=actor AND token=p_token) THEN
  RAISE EXCEPTION 'reset_owner_required' USING ERRCODE='42501';
 END IF;
 RETURN QUERY SELECT a.bucket_id,a.object_name FROM learning_reset_private.audio_objects a
 JOIN storage.objects o ON o.id=a.object_id AND o.bucket_id=a.bucket_id AND o.name=a.object_name
 JOIN learning_reset_private.jobs j ON j.user_id=a.user_id
 WHERE a.user_id=actor AND j.active ORDER BY a.bucket_id,a.object_name LIMIT 500;
END;
$$;
REVOKE ALL ON FUNCTION learning_reset_private.audio_batch(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION learning_reset_private.audio_batch(uuid) TO authenticated;
CREATE FUNCTION public.learning_reset_audio_batch(p_token uuid)
RETURNS TABLE(bucket_id text,object_name text) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT * FROM learning_reset_private.audio_batch(p_token);
$$;
REVOKE ALL ON FUNCTION public.learning_reset_audio_batch(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.learning_reset_audio_batch(uuid) TO authenticated;

CREATE FUNCTION learning_reset_private.finish_reset(p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); job learning_reset_private.jobs;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:' || actor::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:' || actor::text,0));
 SELECT * INTO job FROM learning_reset_private.jobs WHERE user_id=actor AND token=p_token FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'reset_owner_required' USING ERRCODE='42501'; END IF;
 IF NOT job.active THEN RETURN true; END IF;
 IF EXISTS(SELECT 1 FROM learning_reset_private.audio_objects a JOIN storage.objects o ON o.id=a.object_id
   WHERE a.user_id=actor) THEN RAISE EXCEPTION 'audio_removal_incomplete' USING ERRCODE='55000'; END IF;
 -- Keep other learners' data even if an old row had an invalid cross-user parent.
 UPDATE public.submissions SET parent_id=NULL WHERE user_id<>actor AND parent_id IN(SELECT id FROM public.submissions WHERE user_id=actor);
 DELETE FROM public.pronunciation_messages WHERE submission_id IN(SELECT id FROM public.submissions WHERE user_id=actor);
 DELETE FROM public.teacher_feedback WHERE submission_id IN(SELECT id FROM public.submissions WHERE user_id=actor);
 DELETE FROM public.submissions WHERE user_id=actor;
 DELETE FROM vocabulary_private.answer_receipts WHERE user_id=actor;
 DELETE FROM public.user_vocabulary_progress WHERE user_id=actor;
 DELETE FROM public.vocabulary_direction_progress WHERE user_id=actor;
 DELETE FROM public.vocabulary_learning_state WHERE user_id=actor;
 DELETE FROM public.vocabulary_onboarding WHERE user_id=actor;
 DELETE FROM public.user_exercise_progress WHERE user_id=actor;
 DELETE FROM learning_reset_private.audio_objects WHERE user_id=actor;
 UPDATE learning_reset_private.jobs SET active=false,completed_at=clock_timestamp() WHERE user_id=actor;
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION learning_reset_private.finish_reset(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION learning_reset_private.finish_reset(uuid) TO authenticated;
CREATE FUNCTION public.finish_learning_reset(p_token uuid)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT learning_reset_private.finish_reset(p_token); $$;
REVOKE ALL ON FUNCTION public.finish_learning_reset(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finish_learning_reset(uuid) TO authenticated;
COMMIT;


-- Per-student trainer access (2026-09-10)
-- Missing per-trainer overrides inherit existing level access. No student data is changed.
CREATE TABLE public.student_trainer_access (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2')),
  trainer text NOT NULL CHECK (trainer IN ('vocabulary','exercises','pronunciation','videos')),
  enabled boolean NOT NULL,
  PRIMARY KEY (user_id, level, trainer)
);
ALTER TABLE public.student_trainer_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.student_trainer_access FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_trainer_access TO authenticated, service_role;
CREATE POLICY trainer_overrides_read ON public.student_trainer_access FOR SELECT TO authenticated
 USING (user_id = (SELECT auth.uid()) OR (SELECT monthly_booking_private.current_profile_role()) IN ('teacher','admin'));
CREATE POLICY trainer_overrides_staff ON public.student_trainer_access FOR ALL TO authenticated
 USING ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher','admin'))
 WITH CHECK ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher','admin'));

CREATE SCHEMA trainer_access_private;
REVOKE ALL ON SCHEMA trainer_access_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA trainer_access_private TO authenticated;
-- Definer avoids recursive policies; the subject is always the authenticated user.
CREATE FUNCTION trainer_access_private.allowed(p_level text, p_trainer text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (
   SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND
   (p.role IN ('teacher','admin') OR (
     p_level = ANY(COALESCE(p.allowed_levels, ARRAY[]::text[])) AND
     p_trainer IN ('vocabulary','exercises','pronunciation','videos') AND
     COALESCE((SELECT a.enabled FROM public.student_trainer_access a
       WHERE a.user_id = p.id AND a.level = p_level AND a.trainer = p_trainer), true)
   ))
 );
$$;
REVOKE ALL ON FUNCTION trainer_access_private.allowed(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION trainer_access_private.allowed(text,text) TO authenticated;

CREATE POLICY vocabulary_trainer_guard ON public.vocabulary_cards AS RESTRICTIVE FOR SELECT TO authenticated
 USING (trainer_access_private.allowed(level,'vocabulary'));
-- The legacy vocabulary SELECT policy was public; unauthenticated catalog access must also close.
CREATE POLICY vocabulary_authenticated_guard ON public.vocabulary_cards AS RESTRICTIVE FOR SELECT TO anon USING(false);
CREATE POLICY exercises_trainer_guard ON public.exercises AS RESTRICTIVE FOR SELECT TO authenticated
 USING (trainer_access_private.allowed(level,'exercises'));
CREATE POLICY videos_trainer_guard ON public.videos AS RESTRICTIVE FOR SELECT TO authenticated
 USING (trainer_access_private.allowed(level,'videos'));
CREATE POLICY pronunciation_trainer_guard ON public.pronunciation_prompts AS RESTRICTIVE FOR SELECT TO authenticated
 USING (trainer_access_private.allowed(level,'pronunciation'));

-- Legacy direct progress writes must obey the same rights as current RPCs.
CREATE POLICY vocabulary_progress_trainer_insert ON public.user_vocabulary_progress AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(EXISTS(SELECT 1 FROM public.vocabulary_cards c WHERE c.id=card_id));
CREATE POLICY vocabulary_progress_trainer_update ON public.user_vocabulary_progress AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(EXISTS(SELECT 1 FROM public.vocabulary_cards c WHERE c.id=card_id))
 WITH CHECK(EXISTS(SELECT 1 FROM public.vocabulary_cards c WHERE c.id=card_id));

-- Existing conversations are retained. Their contents are visible again when access returns.
CREATE OR REPLACE FUNCTION pronunciation_private.can_access_submission(p_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS (
   SELECT 1 FROM public.submissions s WHERE s.id=p_id AND
   ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher','admin') OR
    (s.user_id=(SELECT auth.uid()) AND trainer_access_private.allowed(s.level,'pronunciation')))
 );
$$;
CREATE POLICY submission_trainer_read ON public.submissions AS RESTRICTIVE FOR SELECT TO authenticated
 USING(type IS DISTINCT FROM 'audio' OR trainer_access_private.allowed(level,'pronunciation'));
CREATE POLICY submission_trainer_insert ON public.submissions AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(type IS DISTINCT FROM 'audio' OR trainer_access_private.allowed(level,'pronunciation'));

-- Reference audio remains separate; new learner recordings require at least one pronunciation entitlement.
CREATE FUNCTION trainer_access_private.can_record()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND
   (p.role IN ('teacher','admin') OR EXISTS(SELECT 1 FROM unnest(p.allowed_levels) l WHERE trainer_access_private.allowed(l,'pronunciation'))));
$$;
REVOKE ALL ON FUNCTION trainer_access_private.can_record() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION trainer_access_private.can_record() TO authenticated;
CREATE POLICY trainer_audio_upload_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(bucket_id NOT IN ('pronunciation_audio','audio_submissions') OR (SELECT trainer_access_private.can_record()));
CREATE OR REPLACE FUNCTION pronunciation_private.create_submission(p_prompt_id uuid, p_audio_path text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor uuid := (SELECT auth.uid()); prompt public.pronunciation_prompts%ROWTYPE; result uuid;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 SELECT * INTO prompt FROM public.pronunciation_prompts WHERE id = p_prompt_id AND is_active;
 IF NOT FOUND OR prompt.level IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = actor AND
   (p.role IN ('teacher','admin') OR prompt.level = ANY(COALESCE(p.allowed_levels,ARRAY[]::text[])))) THEN RAISE EXCEPTION 'Level not allowed'; END IF;
  IF NOT trainer_access_private.allowed(prompt.level, 'pronunciation') THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 IF p_audio_path NOT LIKE 'storage://pronunciation_audio/' || actor::text || '/%' OR NOT EXISTS(
 SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'pronunciation_audio' AND 'storage://pronunciation_audio/' || o.name = p_audio_path)
 THEN RAISE EXCEPTION 'Invalid recording'; END IF;
 INSERT INTO public.submissions(user_id,type,content_url,text_content,status,level,prompt_id,prompt_title)
 VALUES(actor,'audio',p_audio_path,prompt.sentence_de,'pending',prompt.level,prompt.id,prompt.title) RETURNING id INTO result;
 RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION grammar_private.record_attempt(p_exercise_id uuid, p_answer text, p_hint_shown boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  actor uuid := auth.uid();
  target public.exercises;
  correct boolean;
  answer_normalized text;
  attempt_count integer;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF p_answer IS NULL OR length(btrim(p_answer)) = 0 OR length(p_answer) > 1000 THEN
    RAISE EXCEPTION 'invalid_answer' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO target FROM public.exercises WHERE id = p_exercise_id;
  IF NOT FOUND OR target.type NOT IN ('fill_in_blank', 'multiple_choice') THEN
    RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = actor
    AND (p.role IN ('teacher','admin') OR target.level = ANY(coalesce(p.allowed_levels, ARRAY[]::text[])))) THEN
    RAISE EXCEPTION 'level_access_denied' USING ERRCODE = '42501';
  END IF;
  IF NOT trainer_access_private.allowed(target.level, 'exercises') THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
  IF coalesce(target.content->>'correct_answer', '') = '' THEN
    RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE = '22023';
  END IF;
  answer_normalized := lower(regexp_replace(btrim(p_answer), '\s+', ' ', 'g'));
  correct := answer_normalized = lower(regexp_replace(btrim(target.content->>'correct_answer'), '\s+', ' ', 'g'));

  INSERT INTO public.user_exercise_progress AS progress
    (user_id, exercise_id, attempts, completed, score, hint_shown, updated_at)
  VALUES (actor, p_exercise_id, 1, correct, CASE WHEN correct THEN 100 ELSE 0 END, coalesce(p_hint_shown,false), now())
  ON CONFLICT (user_id, exercise_id) DO UPDATE SET
    attempts = progress.attempts + 1,
    completed = coalesce(progress.completed, false) OR correct,
    hint_shown = progress.hint_shown OR coalesce(p_hint_shown, false),
    score = greatest(coalesce(progress.score, 0), CASE WHEN correct THEN
      CASE WHEN progress.attempts + 1 <= 1 THEN 100 WHEN progress.attempts + 1 = 2 THEN 80
        WHEN progress.attempts + 1 = 3 THEN 60 ELSE 40 END ELSE 0 END),
    updated_at = now()
  RETURNING attempts INTO attempt_count;
  RETURN jsonb_build_object('success', true, 'attempts', attempt_count, 'isCorrect', correct);
END;
$function$
;

CREATE OR REPLACE FUNCTION vocabulary_private.initialize_cards(p_decisions jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  actor uuid := auth.uid();
  item jsonb;
  target uuid;
  known boolean;
  touched integer;
  known_count integer := 0;
  new_count integer := 0;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p_decisions) IS DISTINCT FROM 'array' OR jsonb_array_length(p_decisions) > 1000 THEN
    RAISE EXCEPTION 'invalid_decisions' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:' || actor::text, 0));
  FOR item IN SELECT value FROM jsonb_array_elements(p_decisions) LOOP
    IF jsonb_typeof(item->'alreadyKnown') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'invalid_decision' USING ERRCODE = '22023';
    END IF;
    target := (item->>'cardId')::uuid;
    known := (item->>'alreadyKnown')::boolean;
    IF NOT EXISTS (
      SELECT 1 FROM public.vocabulary_cards c JOIN public.profiles p ON p.id = actor
      WHERE c.id = target AND trainer_access_private.allowed(c.level, 'vocabulary') AND (p.role IN ('teacher','admin') OR c.level = ANY(coalesce(p.allowed_levels, ARRAY[]::text[])))
    ) THEN RAISE EXCEPTION 'level_access_denied' USING ERRCODE = '42501'; END IF;
    INSERT INTO public.vocabulary_direction_progress(user_id, card_id, direction, box_number, next_review_date)
      SELECT actor, target, d, CASE WHEN known THEN 6 ELSE 1 END,
        CASE WHEN known THEN now() + interval '90 days' ELSE now() END
      FROM unnest(ARRAY['de_to_native','native_to_de']) d
      ON CONFLICT (user_id, card_id, direction) DO NOTHING;
    GET DIAGNOSTICS touched = ROW_COUNT;
    -- Retain the old application/dashboard contract. Its mirror only updates the
    -- forward direction; ON CONFLICT keeps an existing learner's legacy state.
    INSERT INTO public.user_vocabulary_progress(id,user_id,card_id,box_number,next_review_date,created_at,updated_at,lapses,last_answered_at)
    SELECT id,user_id,card_id,box_number,next_review_date,created_at,updated_at,lapses,last_answered_at
      FROM public.vocabulary_direction_progress WHERE user_id=actor AND card_id=target AND direction='de_to_native'
      ON CONFLICT(user_id,card_id) DO NOTHING;
    -- The UI reports words, while each word has two independent records.
    IF touched > 0 THEN
      IF known THEN known_count := known_count + 1; ELSE new_count := new_count + 1; END IF;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('addedKnown', known_count, 'addedNew', new_count);
END;
$function$
;

CREATE OR REPLACE FUNCTION vocabulary_private.skip_assessment(p_level text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor uuid := auth.uid(); first_lesson text; decisions jsonb; result jsonb;
BEGIN
  IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = actor
    AND (p.role IN ('teacher','admin') OR p_level = ANY(coalesce(p.allowed_levels, ARRAY[]::text[])))) THEN
    RAISE EXCEPTION 'level_access_denied' USING ERRCODE = '42501';
  END IF;
  IF NOT trainer_access_private.allowed(p_level, 'vocabulary') THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
  SELECT c.lesson INTO first_lesson FROM public.vocabulary_cards c WHERE c.level = p_level
    ORDER BY nullif(substring(c.lesson from '[0-9]+'),'')::integer NULLS LAST, c.lesson, c.id LIMIT 1;
  IF first_lesson IS NULL THEN RAISE EXCEPTION 'lesson_not_found' USING ERRCODE = '22023'; END IF;
  SELECT jsonb_agg(jsonb_build_object('cardId',id,'alreadyKnown',false)) INTO decisions
    FROM public.vocabulary_cards WHERE level = p_level AND lesson = first_lesson;
  result := vocabulary_private.initialize_cards(decisions);
  INSERT INTO public.vocabulary_onboarding(user_id,level,status,started_lesson)
    VALUES(actor,p_level,'skipped',first_lesson)
    ON CONFLICT(user_id,level) DO UPDATE SET status='skipped',started_lesson=excluded.started_lesson,updated_at=now();
  RETURN result || jsonb_build_object('lesson',first_lesson);
END;
$function$
;

CREATE OR REPLACE FUNCTION vocabulary_private.submit_answer(p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  actor uuid := auth.uid(); progress public.vocabulary_direction_progress; card public.vocabulary_cards;
  profile public.profiles; previous_card uuid; prompt text; correct boolean; sentence boolean;
  old_phase integer; new_phase integer; new_box integer; days integer; difficult boolean;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF p_ui_language NOT IN ('de','en','ru','uk','tr') OR p_ui_language IS NULL THEN
    RAISE EXCEPTION 'invalid_language' USING ERRCODE = '22023';
  END IF;
  IF length(p_typed_answer) > 4000 THEN RAISE EXCEPTION 'answer_too_long' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:' || actor::text, 0));
  SELECT * INTO progress FROM public.vocabulary_direction_progress WHERE id = p_progress_id AND user_id = actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'progress_not_found' USING ERRCODE = '42501'; END IF;
  SELECT * INTO card FROM public.vocabulary_cards WHERE id = progress.card_id;
  SELECT * INTO profile FROM public.profiles WHERE id = actor;
  IF NOT (coalesce(profile.role IN ('teacher','admin'),false) OR card.level = ANY(coalesce(profile.allowed_levels,ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'level_access_denied' USING ERRCODE = '42501';
  END IF;
  IF NOT trainer_access_private.allowed(card.level, 'vocabulary') THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
  IF progress.box_number = 7 OR progress.next_review_date > now() THEN
    RAISE EXCEPTION 'review_not_due' USING ERRCODE = '40001';
  END IF;
  SELECT last_card_id INTO previous_card FROM public.vocabulary_learning_state WHERE user_id = actor;
  IF previous_card = progress.card_id THEN
    RAISE EXCEPTION 'vocabulary_spacing_required' USING ERRCODE = '40001';
  END IF;
  prompt := CASE p_ui_language WHEN 'de' THEN card.context_sentence_de WHEN 'en' THEN card.context_sentence_en
    WHEN 'ru' THEN card.context_sentence_ru WHEN 'uk' THEN card.context_sentence_uk WHEN 'tr' THEN card.context_sentence_tr END;
  sentence := card.sentence_practice AND progress.direction = 'native_to_de';
  IF sentence AND (nullif(btrim(prompt),'') IS NULL OR nullif(btrim(card.context_sentence_de),'') IS NULL) THEN
    RAISE EXCEPTION 'sentence_content_missing' USING ERRCODE='23514';
  END IF;
  IF sentence THEN
    -- Byte-exact comparison: no trimming, case folding, punctuation removal or client grading.
    correct := coalesce(convert_to(p_typed_answer,'UTF8') = convert_to(card.context_sentence_de,'UTF8'),false);
  ELSE
    IF p_is_correct IS NULL THEN RAISE EXCEPTION 'answer_required' USING ERRCODE = '22023'; END IF;
    correct := p_is_correct;
  END IF;
  old_phase := least(6,greatest(1,coalesce(progress.box_number,1)));
  new_phase := CASE WHEN correct THEN least(6,old_phase+1) ELSE greatest(1,old_phase-1) END;
  new_box := CASE WHEN correct AND old_phase=6 THEN 7 ELSE new_phase END;
  days := CASE new_phase WHEN 1 THEN 1 WHEN 2 THEN 1 WHEN 3 THEN 3 WHEN 4 THEN 9 WHEN 5 THEN 29 ELSE 90 END;
  difficult := CASE profile.native_language WHEN 'Russisch' THEN coalesce(card.is_hard_for_ru,false)
    WHEN 'Türkisch' THEN coalesce(card.is_hard_for_tr,false) ELSE false END;
  IF difficult THEN days := greatest(1,days/2); END IF;
  UPDATE public.vocabulary_direction_progress SET box_number=new_box,next_review_date=now()+make_interval(days=>days),
    lapses=lapses+CASE WHEN NOT correct THEN 1 ELSE 0 END,last_answered_at=now(),updated_at=now()
    WHERE id = progress.id;
  IF progress.direction='de_to_native' THEN
    UPDATE public.user_vocabulary_progress SET box_number=new_box,next_review_date=now()+make_interval(days=>days),
      lapses=progress.lapses+CASE WHEN NOT correct THEN 1 ELSE 0 END,last_answered_at=now(),updated_at=now()
      WHERE user_id=actor AND card_id=progress.card_id;
  END IF;
  INSERT INTO public.vocabulary_learning_state(user_id,last_card_id,last_reviewed_at)
    VALUES(actor,progress.card_id,now()) ON CONFLICT(user_id) DO UPDATE
    SET last_card_id=excluded.last_card_id,last_reviewed_at=excluded.last_reviewed_at;
  RETURN jsonb_build_object('success',true,'isCorrect',correct,'previousPhase',old_phase,'newPhase',new_phase,
    'becameLearned',new_box=7,'movedBack',new_phase<old_phase,'intervalInDays',days)
    || CASE WHEN sentence THEN jsonb_build_object('correctAnswer',card.context_sentence_de) ELSE '{}'::jsonb END;
END;
$function$
;

CREATE OR REPLACE FUNCTION vocabulary_private.submit_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  actor uuid := auth.uid();
  receipt vocabulary_private.answer_receipts;
  result jsonb;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR p_progress_id IS NULL
    OR p_ui_language IS NULL OR p_ui_language NOT IN ('de','en','ru','uk','tr')
    OR length(p_typed_answer) > 4000 THEN
    RAISE EXCEPTION 'invalid_answer_request' USING ERRCODE = '22023';
  END IF;

  -- Use the SAME first lock as submit_answer. PostgreSQL transaction advisory
  -- locks are reentrant, so its nested acquisition cannot deadlock with us.
  -- Serialize lookup + grade + receipt together, including concurrent retries.
  PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:' || actor::text, 0));
  IF NOT EXISTS (SELECT 1 FROM public.vocabulary_direction_progress v JOIN public.vocabulary_cards c ON c.id=v.card_id
    WHERE v.id=p_progress_id AND v.user_id=actor AND trainer_access_private.allowed(c.level,'vocabulary')) THEN
    RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501';
  END IF;
  SELECT * INTO receipt FROM vocabulary_private.answer_receipts
    WHERE user_id = actor AND request_id = p_request_id;
  IF FOUND THEN
    IF receipt.progress_id IS DISTINCT FROM p_progress_id
      OR receipt.is_correct IS DISTINCT FROM p_is_correct
      OR convert_to(receipt.typed_answer, 'UTF8') IS DISTINCT FROM convert_to(p_typed_answer, 'UTF8')
      OR receipt.ui_language IS DISTINCT FROM p_ui_language THEN
      RAISE EXCEPTION 'vocabulary_request_conflict' USING ERRCODE = '22023';
    END IF;
    -- Return before due/spacing checks: the first call already committed this
    -- exact answer, and a later review may have moved the persistent cursor.
    RETURN receipt.response;
  END IF;

  result := vocabulary_private.submit_answer(p_progress_id, p_is_correct, p_typed_answer, p_ui_language);
  INSERT INTO vocabulary_private.answer_receipts(
    user_id, request_id, progress_id, is_correct, typed_answer, ui_language, response
  ) VALUES (actor, p_request_id, p_progress_id, p_is_correct, p_typed_answer, p_ui_language, result);
  -- Both grading and receipt commit with this RPC; any exception rolls back both.
  RETURN result;
END;
$function$
;

-- Signed playback of submitted private audio also respects per-level revocation.
-- Keep reset-manifest reads available so account resets can still remove locked recordings.
CREATE FUNCTION trainer_access_private.audio_readable(p_bucket text, p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN p_bucket <> 'pronunciation_audio' THEN true
 WHEN (SELECT monthly_booking_private.current_profile_role()) IN ('teacher','admin') THEN true
 WHEN EXISTS(SELECT 1 FROM public.submissions s WHERE s.content_url='storage://pronunciation_audio/'||p_name)
   OR EXISTS(SELECT 1 FROM public.pronunciation_messages m WHERE m.audio_path='storage://pronunciation_audio/'||p_name)
 THEN EXISTS(SELECT 1 FROM public.submissions s WHERE s.content_url='storage://pronunciation_audio/'||p_name AND pronunciation_private.can_access_submission(s.id))
   OR EXISTS(SELECT 1 FROM public.pronunciation_messages m WHERE m.audio_path='storage://pronunciation_audio/'||p_name AND pronunciation_private.can_access_submission(m.submission_id))
 ELSE trainer_access_private.can_record() END;
$$;
REVOKE ALL ON FUNCTION trainer_access_private.audio_readable(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION trainer_access_private.audio_readable(text,text) TO authenticated;
CREATE POLICY trainer_audio_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
 USING(trainer_access_private.audio_readable(bucket_id,name) OR learning_reset_private.can_remove_audio(id));

-- Keep one permissive policy per command, avoiding duplicate SELECT evaluation.
DROP POLICY trainer_overrides_staff ON public.student_trainer_access;
CREATE POLICY trainer_overrides_insert ON public.student_trainer_access FOR INSERT TO authenticated
 WITH CHECK ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher','admin'));
CREATE POLICY trainer_overrides_update ON public.student_trainer_access FOR UPDATE TO authenticated
 USING ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher','admin'))
 WITH CHECK ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher','admin'));
CREATE POLICY trainer_overrides_delete ON public.student_trainer_access FOR DELETE TO authenticated
 USING ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher','admin'));
