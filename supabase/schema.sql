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
-- Live ergänzt bis 2026-09-12 mit weiteren lokalen Migrationen (Grammar, Alternativen, Trainer Access).
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
  lesson text NOT NULL DEFAULT 'Lektion 1',
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
  allowed_lessons text[],
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
-- Add hint column
ALTER TABLE public.exercises ADD COLUMN hint jsonb;

-- Migrate hint_ru and hint_tr to the new hint column
UPDATE public.exercises
SET hint = jsonb_build_object(
  'ru', hint_ru,
  'tr', hint_tr
)
WHERE hint_ru IS NOT NULL OR hint_tr IS NOT NULL;

-- Drop old hint columns
ALTER TABLE public.exercises DROP COLUMN hint_ru;
ALTER TABLE public.exercises DROP COLUMN hint_tr;

-- Migrate explanation inside content to be localized
UPDATE public.exercises
SET content = jsonb_set(
  content,
  '{explanation}',
  jsonb_build_object('de', content->>'explanation')
)
WHERE content->>'explanation' IS NOT NULL AND jsonb_typeof(content->'explanation') = 'string';

-- Migrate smart_hint inside content to be localized
UPDATE public.exercises
SET content = jsonb_set(
  content,
  '{smart_hint}',
  jsonb_build_object('de', content->>'smart_hint')
)
WHERE content->>'smart_hint' IS NOT NULL AND jsonb_typeof(content->'smart_hint') = 'string';
-- Automatisch generiertes Skript für Übersetzungen

UPDATE public.exercises SET content = '{"options": ["Welche", "Welcher", "Welches"], "smart_hint": {"de": "Wer fragt nach Personen, wo nach Orten, woher nach Herkunft, wann nach Zeit.", "ru": "«Wer» (кто) используется для людей, «wo» (где) для мест, «woher» (откуда) для происхождения, «wann» (когда) для времени.", "tr": "«Wer» (kim) kişileri, «wo» (nerede) yerleri, «woher» (nereden) kökeni, «wann» (ne zaman) zamanı sorar.", "en": "«Wer» (who) asks about people, «wo» (where) about places, «woher» (where from) about origin, «wann» (when) about time.", "uk": "«Wer» (хто) питає про людей, «wo» (де) про місця, «woher» (звідки) про походження, «wann» (коли) про час."}, "text_after": " Sprache sprichst du? – Arabisch.", "text_before": "", "correct_answer": "Welche"}'::jsonb WHERE id = '0007227a-9615-5b6b-afe3-1e35d7de84d6';
UPDATE public.exercises SET content = '{"options": ["Busse", "Bus", "Bussen"], "smart_hint": {"de": "Nach Zahlen größer als eins steht das Nomen im Plural.", "ru": "После числительных больше одного существительное стоит во множественном числе.", "tr": "Birden büyük sayılardan sonra isim çoğul halde kullanılır.", "en": "After numbers greater than one, the noun is in the plural.", "uk": "Після чисел більше одного іменник стоїть у множині."}, "text_after": ".", "text_before": "Vor der Schule warten zwei ", "correct_answer": "Busse"}'::jsonb WHERE id = '0039b8e2-52d2-50d6-a9b3-50e825d1e07d';
UPDATE public.exercises SET content = '{"options": ["großer", "größte", "größer"], "smart_hint": {"de": "Beim Vergleichen steht nach dem Komparativ als; einige Formen sind unregelmäßig.", "ru": "При сравнении после сравнительной степени (Komparativ) ставится «als»; некоторые формы являются исключениями.", "tr": "Karşılaştırma yaparken karşılaştırma derecesinden (Komparativ) sonra «als» kullanılır; bazı formlar düzensizdir.", "en": "When comparing, «als» is used after the comparative; some forms are irregular.", "uk": "При порівнянні після вищого ступеня (Komparativ) ставиться «als»; деякі форми є неправильними."}, "text_after": " als die alte.", "text_before": "Meine neue Wohnung ist ", "correct_answer": "größer"}'::jsonb WHERE id = '008adbd0-b8b9-5973-a466-085e0ee13c18';
UPDATE public.exercises SET content = '{"options": ["erklären", "erklärst", "erklärt"], "smart_hint": {"de": "Bei Uhrzeiten steht um, bei Wochentagen am; das Verb richtet sich nach dem Subjekt.", "ru": "С указанием времени используется «um», с днями недели «am»; глагол согласуется с подлежащим.", "tr": "Saatlerde «um», haftanın günlerinde «am» kullanılır; fiil özneye göre çekimlenir.", "en": "For times, use «um», for days of the week use «am»; the verb agrees with the subject.", "uk": "Із зазначенням часу використовується «um», з днями тижня «am»; дієслово узгоджується з підметом."}, "text_after": " ein Wort.", "text_before": "Die Lehrerin ", "correct_answer": "erklärt"}'::jsonb WHERE id = '00c03b8e-7035-58c6-a028-e3f574a1fcbd';
UPDATE public.exercises SET content = '{"options": ["muss", "müssen", "müsst"], "smart_hint": {"de": "Nach einem Modalverb steht der Infinitiv am Satzende; die Personalform steht an Position zwei.", "ru": "После модального глагола инфинитив стоит в конце предложения; спрягаемый глагол находится на второй позиции.", "tr": "Modal fiilden sonra mastar (infinitiv) cümlenin sonunda yer alır; çekimli fiil ise ikinci pozisyondadır.", "en": "After a modal verb, the infinitive goes at the end of the sentence; the conjugated verb is in position two.", "uk": "Після модального дієслова інфінітив стоїть у кінці речення; відмінюване дієслово знаходиться на другій позиції."}, "text_after": " um acht ins Bett gehen.", "text_before": "Die Kinder ", "correct_answer": "müssen"}'::jsonb WHERE id = '014f63f0-87fd-5d00-a78d-43626070637e';
UPDATE public.exercises SET content = '{"options": ["sind", "bist", "seid"], "question": "Ihr ___ im Raum zwölf.", "explanation": {"de": "Das Verb passt zur Person: ich bin, du bist, er/sie ist, wir sind, ihr seid.", "ru": "Глагол согласуется с лицом: ich bin, du bist, er/sie ist, wir sind, ihr seid.", "tr": "Fiil kişiye uyar: ich bin, du bist, er/sie ist, wir sind, ihr seid.", "en": "The verb matches the person: ich bin, du bist, er/sie ist, wir sind, ihr seid.", "uk": "Дієслово узгоджується з особою: ich bin, du bist, er/sie ist, wir sind, ihr seid."}, "correct_answer": "seid"}'::jsonb WHERE id = '01b236c3-3b14-5944-a62a-8ce79e418cf0';
UPDATE public.exercises SET content = '{"options": ["der", "den", "dem"], "question": "Der Brief, ___ ich gestern erhalten habe, ist wichtig.", "explanation": {"de": "Der Kasus des Relativpronomens ergibt sich aus seiner Funktion im Relativsatz.", "ru": "Падеж относительного местоимения зависит от его функции в придаточном предложении.", "tr": "İlgi zamirinin hali (Kasus), ilgi cümlesindeki (Relativsatz) görevine göre belirlenir.", "en": "The case of the relative pronoun depends on its function in the relative clause.", "uk": "Відмінок відносного займенника залежить від його функції в підрядному реченні."}, "correct_answer": "den"}'::jsonb WHERE id = '023ff09f-3475-51b8-a3c3-7a5492731bb1';
UPDATE public.exercises SET content = '{"options": ["Hättet", "Hätten", "Hättest"], "smart_hint": {"de": "Könnte, hätte, wäre und würde machen Bitten und Wünsche höflicher.", "ru": "Формы «könnte», «hätte», «wäre» и «würde» делают просьбы и пожелания более вежливыми.", "tr": "«könnte», «hätte», «wäre» ve «würde» formları ricaları ve dilekleri daha kibar hale getirir.", "en": "The forms «könnte», «hätte», «wäre», and «würde» make requests and wishes more polite.", "uk": "Форми «könnte», «hätte», «wäre» та «würde» роблять прохання та побажання більш ввічливими."}, "text_after": " Sie noch einen Termin am Freitag?", "text_before": "", "correct_answer": "Hätten"}'::jsonb WHERE id = '0298a74d-2b63-5e4d-aee3-66b456b3c119';
UPDATE public.exercises SET content = '{"options": ["Als", "Ob", "Wenn"], "smart_hint": {"de": "Als beschreibt ein einmaliges Ereignis in der Vergangenheit, wenn Wiederholungen oder Bedingungen.", "ru": "«Als» описывает однократное событие в прошлом, «wenn» — повторяющиеся события или условия.", "tr": "«Als» geçmişteki tek seferlik bir olayı tanımlarken, «wenn» tekrarlanan olayları veya koşulları tanımlar.", "en": "«Als» describes a single event in the past, «wenn» describes repetitions or conditions.", "uk": "«Als» описує одноразову подію в минулому, «wenn» — повторювані події або умови."}, "text_after": " ich Zeit habe, gehe ich spazieren.", "text_before": "", "correct_answer": "Wenn"}'::jsonb WHERE id = '031bb6a6-a8dc-52ce-a68c-b0917c0f65dc';
UPDATE public.exercises SET content = '{"options": ["nach", "in", "zu"], "smart_hint": {"de": "Wo? beschreibt einen Ort; wohin? beschreibt eine Richtung. Lerne feste Wendungen zusammen.", "ru": "«Wo?» (Где?) описывает место; «wohin?» (Куда?) описывает направление. Учите устойчивые выражения целиком.", "tr": "«Wo?» (Nerede?) bir yeri; «wohin?» (Nereye?) ise bir yönü belirtir. Kalıplaşmış ifadeleri bir bütün olarak öğrenin.", "en": "«Wo?» describes a place; «wohin?» describes a direction. Learn fixed expressions together.", "uk": "«Wo?» описує місце; «wohin?» описує напрямок. Вчіть сталі вирази разом."}, "text_after": " Hause.", "text_before": "Wir sind ", "correct_answer": "zu"}'::jsonb WHERE id = '032a7684-4e63-5ad8-a925-b504bceaf648';
UPDATE public.exercises SET content = '{"options": ["keine", "kein", "keinen"], "smart_hint": {"de": "Kein verneint ein Nomen mit unbestimmtem Artikel; nicht verneint unter anderem Adjektive und Verben.", "ru": "«Kein» отрицает существительное с неопределенным артиклем; «nicht» отрицает, среди прочего, прилагательные и глаголы.", "tr": "«Kein» belirsiz artikelli bir ismi olumsuz yapar; «nicht» ise sıfatları ve fiilleri olumsuz yapar.", "en": "«Kein» negates a noun with an indefinite article; «nicht» negates adjectives and verbs, among other things.", "uk": "«Kein» заперечує іменник з неозначеним артиклем; «nicht» заперечує, серед іншого, прикметники та дієслова."}, "text_after": " Apotheke.", "text_before": "Hier ist ", "correct_answer": "keine"}'::jsonb WHERE id = '03303919-15ca-5099-a05a-08d8ff6241c3';
UPDATE public.exercises SET content = '{"options": ["gute", "guter", "guten"], "smart_hint": {"de": "Ohne Artikel muss die Adjektivendung Kasus, Genus und Numerus anzeigen.", "ru": "Без артикля окончание прилагательного должно указывать на падеж, род и число.", "tr": "Artikelsiz kullanıldığında sıfatın takısı hali (Kasus), cinsi (Genus) ve çoğul/tekil durumunu (Numerus) göstermelidir.", "en": "Without an article, the adjective ending must indicate the case, gender, and number.", "uk": "Без артикля закінчення прикметника має вказувати на відмінок, рід і число."}, "text_after": " Besserung.", "text_before": "Ich wünsche dir ", "correct_answer": "gute"}'::jsonb WHERE id = '038180bc-4948-5a14-a8e1-97ce90e4bc2f';
UPDATE public.exercises SET content = '{"options": ["hat", "habe", "haben"], "question": "Die Erklärung war kurz, trotzdem ___ ich alles verstanden.", "explanation": {"de": "Obwohl leitet einen Nebensatz ein; nach trotzdem steht ein Hauptsatz mit dem Verb an zweiter Stelle.", "ru": "«Obwohl» начинает придаточное предложение; после «trotzdem» следует главное предложение с глаголом на втором месте.", "tr": "«Obwohl» bir yan cümleyi başlatır; «trotzdem» kelimesinden sonra fiilin ikinci sırada olduğu bir ana cümle gelir.", "en": "«Obwohl» introduces a subordinate clause; after «trotzdem» comes a main clause with the verb in the second position.", "uk": "«Obwohl» починає підрядне речення; після «trotzdem» йде головне речення з дієсловом на другому місці."}, "correct_answer": "habe"}'::jsonb WHERE id = '042fa22d-25c4-54ee-a808-f8ff99d3dd98';
UPDATE public.exercises SET content = '{"options": ["wärmer", "wärmste", "warme"], "smart_hint": {"de": "Beim Vergleichen steht nach dem Komparativ als; einige Formen sind unregelmäßig.", "ru": "При сравнении после сравнительной степени (Komparativ) ставится «als»; некоторые формы являются исключениями.", "tr": "Karşılaştırma yaparken karşılaştırma derecesinden (Komparativ) sonra «als» kullanılır; bazı formlar düzensizdir.", "en": "When comparing, «als» is used after the comparative; some forms are irregular.", "uk": "При порівнянні після вищого ступеня (Komparativ) ставиться «als»; деякі форми є неправильними."}, "text_after": " als im Winter.", "text_before": "Im Sommer ist es ", "correct_answer": "wärmer"}'::jsonb WHERE id = '04754fa4-c038-5eaf-ac17-d2e650073d76';
UPDATE public.exercises SET content = '{"options": ["ich schicke", "schicken ich", "schicke ich"], "smart_hint": {"de": "Im Hauptsatz steht das finite Verb an Position zwei; im Nebensatz am Ende. Pronomen stehen meist vor Nomenobjekten.", "ru": "В главном предложении спрягаемый глагол стоит на втором месте; в придаточном — в конце. Местоимения обычно стоят перед дополнениями-существительными.", "tr": "Ana cümlede çekimli fiil ikinci sıradadır; yan cümlede ise en sondadır. Zamirler genellikle isim nesnelerinden önce gelir.", "en": "In the main clause, the finite verb is in position two; in the subordinate clause, at the end. Pronouns usually come before noun objects.", "uk": "У головному реченні відмінюване дієслово стоїть на другій позиції; у підрядному — в кінці. Займенники зазвичай стоять перед іменниковими додатками."}, "text_after": " dir heute Abend.", "text_before": "Den Brief ", "correct_answer": "schicke ich"}'::jsonb WHERE id = '0516efb3-0195-5fdc-ae11-e16a43d28cec';
UPDATE public.exercises SET content = '{"options": ["auf", "an", "für"], "smart_hint": {"de": "Formelle Schreiben benötigen klare Satzverbindungen, höfliche Formen und passende Kasus.", "ru": "Для официальных писем требуются четкие связки предложений, вежливые формы обращения и правильные падежи.", "tr": "Resmi yazışmalar net cümle bağlantıları, kibar formlar ve uygun ismin hallerini gerektirir.", "en": "Formal letters require clear sentence connections, polite forms, and appropriate cases.", "uk": "Офіційні листи вимагають чітких зв''язків між реченнями, ввічливих форм і правильних відмінків."}, "text_after": " Ihre Rückmeldung.", "text_before": "Ich danke Ihnen ", "correct_answer": "für"}'::jsonb WHERE id = '05aa0367-e456-51f8-a422-c5a05973d44b';
UPDATE public.exercises SET content = '{"options": ["schöner", "schöne", "schönen"], "smart_hint": {"de": "Der unbestimmte Artikel zeigt nicht jede Endung; das Adjektiv ergänzt fehlende Signale.", "ru": "Неопределенный артикль показывает не все окончания; прилагательное восполняет недостающие грамматические признаки.", "tr": "Belirsiz artikel her takıyı göstermez; sıfat eksik sinyalleri tamamlar.", "en": "The indefinite article does not show every ending; the adjective provides the missing grammatical signals.", "uk": "Неозначений артикль показує не всі закінчення; прикметник доповнює відсутні граматичні ознаки."}, "text_after": " Ausflug gemacht.", "text_before": "Wir haben einen ", "correct_answer": "schönen"}'::jsonb WHERE id = '062e2391-06e0-5cf3-a99c-582f60887a45';
UPDATE public.exercises SET content = '{"options": ["war", "wart", "waren"], "question": "Die Geschäfte ___ am Sonntag geschlossen.", "explanation": {"de": "In Berichten über die Vergangenheit sind war und hatte üblich.", "ru": "В рассказах о прошлом обычно используются «war» (был) и «hatte» (имел).", "tr": "Geçmişle ilgili anlatımlarda «war» ve «hatte» yaygındır.", "en": "In reports about the past, «war» and «hatte» are common.", "uk": "У розповідях про минуле зазвичай використовуються «war» (був) і «hatte» (мав)."}, "correct_answer": "waren"}'::jsonb WHERE id = '06dc9397-780f-5840-a33e-1d4ea3261d66';
UPDATE public.exercises SET content = '{"options": ["zu schreiben", "schreiben zu", "zu geschrieben"], "smart_hint": {"de": "Bei gleichem Subjekt stehen ohne zu und anstatt zu mit Infinitiv; bei anderem Subjekt verwendet man ohne dass.", "ru": "При одинаковом подлежащем используются «ohne zu» и «anstatt zu» с инфинитивом; при разных подлежащих используется «ohne dass».", "tr": "Aynı özne olduğunda «ohne zu» ve «anstatt zu» mastarla kullanılır; farklı özne olduğunda «ohne dass» kullanılır.", "en": "With the same subject, use «ohne zu» and «anstatt zu» with an infinitive; with a different subject, use «ohne dass».", "uk": "При однаковому підметі використовуються «ohne zu» і «anstatt zu» з інфінітивом; при різних підметах використовується «ohne dass»."}, "text_after": ".", "text_before": "Sie rief an, anstatt eine Nachricht ", "correct_answer": "zu schreiben"}'::jsonb WHERE id = '07343a77-a217-5c19-a2b3-7e3203f1fe95';
UPDATE public.exercises SET content = '{"options": ["nach", "durch", "ohne"], "smart_hint": {"de": "Seit beschreibt einen Beginn bis heute, vor einen Zeitpunkt in der Vergangenheit und für eine Dauer.", "ru": "«Seit» указывает на начало действия, длящегося до сих пор, «vor» на момент в прошлом, а «für» на продолжительность.", "tr": "«Seit» bugüne kadar devam eden bir başlangıcı, «vor» geçmişteki bir anı, «für» ise bir süreyi ifade eder.", "en": "«Seit» describes a beginning until today, «vor» a point in time in the past, and «für» a duration.", "uk": "«Seit» вказує на початок дії, що триває досі, «vor» на момент у минулому, а «für» на тривалість."}, "text_after": " dem Unterricht.", "text_before": "Wir treffen uns ", "correct_answer": "nach"}'::jsonb WHERE id = '07b7e71a-057c-5b10-a573-5f2588fd846e';
UPDATE public.exercises SET content = '{"options": ["Lest", "Liest", "Lies"], "question": "___ bitte den ersten Satz vor, Anna.", "explanation": {"de": "Eine höfliche Aufforderung mit Sie beginnt mit dem Infinitiv; du- und ihr-Formen sind kürzer.", "ru": "Вежливая просьба с «Sie» начинается с инфинитива; формы для «du» и «ihr» короче.", "tr": "«Sie» ile yapılan kibar bir rica mastarla başlar; «du» ve «ihr» formları ise daha kısadır.", "en": "A polite request with «Sie» starts with the infinitive; «du» and «ihr» forms are shorter.", "uk": "Ввічливе прохання з «Sie» починається з інфінітива; форми для «du» та «ihr» коротші."}, "correct_answer": "Lies"}'::jsonb WHERE id = '0863c8ab-068b-5c02-ab8e-1577559cebe5';
UPDATE public.exercises SET content = '{"options": ["um", "am", "im"], "smart_hint": {"de": "Bei Uhrzeiten steht um, bei Wochentagen am; das Verb richtet sich nach dem Subjekt.", "ru": "С указанием времени используется «um», с днями недели «am»; глагол согласуется с подлежащим.", "tr": "Saatlerde «um», haftanın günlerinde «am» kullanılır; fiil özneye göre çekimlenir.", "en": "For times, use «um», for days of the week use «am»; the verb agrees with the subject.", "uk": "Із зазначенням часу використовується «um», з днями тижня «am»; дієслово узгоджується з підметом."}, "text_after": " halb elf.", "text_before": "Die Pause ist ", "correct_answer": "um"}'::jsonb WHERE id = '08a94af1-782e-5c57-a21d-af10eea35988';
UPDATE public.exercises SET content = '{"options": ["sie", "ihr", "ihn"], "smart_hint": {"de": "Bei helfen, danken, gefallen und gehören steht ein Dativobjekt.", "ru": "С глаголами «helfen», «danken», «gefallen» и «gehören» требуется дополнение в дательном падеже (Dativ).", "tr": "«helfen», «danken», «gefallen» ve «gehören» fiillerinden sonra Dativ nesnesi kullanılır.", "en": "The verbs «helfen», «danken», «gefallen», and «gehören» take a dative object.", "uk": "З дієсловами «helfen», «danken», «gefallen» і «gehören» потрібен додаток у давальному відмінку (Dativ)."}, "text_after": " eine Suppe.", "text_before": "Meine Schwester ist krank. Ich bringe ", "correct_answer": "ihr"}'::jsonb WHERE id = '0983aae8-0483-560a-a942-f98388ab6b4c';
UPDATE public.exercises SET content = '{"options": ["gehört", "hören", "hörten"], "smart_hint": {"de": "Für viele Tätigkeiten braucht man haben und das Partizip am Satzende.", "ru": "Для описания многих действий используется глагол «haben» и причастие (Partizip) в конце предложения.", "tr": "Pek çok eylem için «haben» yardımcı fiiline ve cümlenin sonunda Partizip (geçmiş zaman ortacı) formuna ihtiyaç vardır.", "en": "For many activities, you need «haben» and the participle at the end of the sentence.", "uk": "Для опису багатьох дій використовується дієслово «haben» і дієприкметник (Partizip) у кінці речення."}, "text_after": ".", "text_before": "Wir haben Musik ", "correct_answer": "gehört"}'::jsonb WHERE id = '09c38585-e7a6-569e-a6f6-85d7c82a821e';
UPDATE public.exercises SET content = '{"options": ["zur", "zum", "zu den"], "smart_hint": {"de": "Wo? beschreibt einen Ort; wohin? beschreibt eine Richtung. Lerne feste Wendungen zusammen.", "ru": "«Wo?» (Где?) описывает место; «wohin?» (Куда?) описывает направление. Учите устойчивые выражения целиком.", "tr": "«Wo?» (Nerede?) bir yeri; «wohin?» (Nereye?) ise bir yönü belirtir. Kalıplaşmış ifadeleri bir bütün olarak öğrenin.", "en": "«Wo?» describes a place; «wohin?» describes a direction. Learn fixed expressions together.", "uk": "«Wo?» описує місце; «wohin?» описує напрямок. Вчіть сталі вирази разом."}, "text_after": " Arzt.", "text_before": "Ich gehe heute ", "correct_answer": "zum"}'::jsonb WHERE id = '0a268b11-f1da-5beb-a6f5-17163cca1c17';
UPDATE public.exercises SET content = '{"options": ["damit", "um", "weil"], "smart_hint": {"de": "Um zu verwendet man bei gleichem Subjekt; damit erlaubt unterschiedliche Subjekte.", "ru": "«Um zu» используется при одном и том же подлежащем; «damit» позволяет использовать разные подлежащие.", "tr": "«Um zu» aynı özneyle kullanılır; «damit» ise farklı öznelere izin verir.", "en": "Use «um zu» with the same subject; «damit» allows different subjects.", "uk": "«Um zu» використовується при одному й тому ж підметі; «damit» дозволяє використовувати різні підмети."}, "text_after": " in Deutschland zu arbeiten.", "text_before": "Ich lerne Deutsch, ", "correct_answer": "um"}'::jsonb WHERE id = '0a95f820-f205-5c57-a820-cb0337887c79';
UPDATE public.exercises SET content = '{"options": ["Woher", "Wann", "Wie"], "smart_hint": {"de": "Wer fragt nach Personen, wo nach Orten, woher nach Herkunft, wann nach Zeit.", "ru": "«Wer» (кто) используется для людей, «wo» (где) для мест, «woher» (откуда) для происхождения, «wann» (когда) для времени.", "tr": "«Wer» (kim) kişileri, «wo» (nerede) yerleri, «woher» (nereden) kökeni, «wann» (ne zaman) zamanı sorar.", "en": "«Wer» (who) asks about people, «wo» (where) about places, «woher» (where from) about origin, «wann» (when) about time.", "uk": "«Wer» (хто) питає про людей, «wo» (де) про місця, «woher» (звідки) про походження, «wann» (коли) про час."}, "text_after": " kommst du? – Aus Polen.", "text_before": "", "correct_answer": "Woher"}'::jsonb WHERE id = '0b3890af-edcf-5d47-a750-b541cc77c37c';
UPDATE public.exercises SET content = '{"options": ["der", "die", "das"], "question": "Die Leute, ___ hier warten, haben einen Termin.", "explanation": {"de": "Das Relativpronomen übernimmt Genus und Numerus des Bezugsworts.", "ru": "Относительное местоимение принимает род и число определяемого слова.", "tr": "İlgi zamiri, nitelediği kelimenin cinsiyetini (Genus) ve tekil/çoğul durumunu (Numerus) alır.", "en": "The relative pronoun takes the gender and number of the noun it refers to.", "uk": "Відносний займенник приймає рід і число слова, яке він визначає."}, "correct_answer": "die"}'::jsonb WHERE id = '0b54c62e-f14a-5bd6-afb5-9cef2c9ec88a';
UPDATE public.exercises SET content = '{"options": ["kochen", "kocht", "kochst"], "smart_hint": {"de": "Nach ob oder einem Fragewort steht das Verb am Ende der indirekten Frage.", "ru": "После «ob» или вопросительного слова глагол стоит в конце косвенного вопроса.", "tr": "«ob» veya bir soru kelimesinden sonra, fiil dolaylı sorunun (indirekte Frage) sonunda yer alır.", "en": "After «ob» or a question word, the verb goes at the end of the indirect question.", "uk": "Після «ob» або питального слова дієслово стоїть у кінці непрямого питання."}, "text_after": ".", "text_before": "Ich weiß nicht, wer heute ", "correct_answer": "kocht"}'::jsonb WHERE id = '0ba2ba0d-8d67-5306-aee4-d8a64b476c93';
UPDATE public.exercises SET content = '{"options": ["Gebt", "Gibt", "Gib"], "smart_hint": {"de": "Eine höfliche Aufforderung mit Sie beginnt mit dem Infinitiv; du- und ihr-Formen sind kürzer.", "ru": "Вежливая просьба с «Sie» начинается с инфинитива; формы для «du» и «ihr» короче.", "tr": "«Sie» ile yapılan kibar bir rica mastarla başlar; «du» ve «ihr» formları ise daha kısadır.", "en": "A polite request with «Sie» starts with the infinitive; «du» and «ihr» forms are shorter.", "uk": "Ввічливе прохання з «Sie» починається з інфінітива; форми для «du» та «ihr» коротші."}, "text_after": " mir bitte den Stift, Tom.", "text_before": "", "correct_answer": "Gib"}'::jsonb WHERE id = '0bddc222-d478-5b57-af7c-ef50d8f83606';
UPDATE public.exercises SET content = '{"options": ["die", "den", "der"], "smart_hint": {"de": "Mit, bei, nach, aus und von verlangen den Dativ.", "ru": "Предлоги «mit», «bei», «nach», «aus» и «von» требуют дательного падежа (Dativ).", "tr": "«Mit», «bei», «nach», «aus» ve «von» edatları Dativ (ismin -e hali) gerektirir.", "en": "The prepositions «mit», «bei», «nach», «aus», and «von» require the dative case.", "uk": "Прийменники «mit», «bei», «nach», «aus» і «von» вимагають давального відмінка (Dativ)."}, "text_after": " Lehrerin.", "text_before": "Sie spricht mit ", "correct_answer": "der"}'::jsonb WHERE id = '0d5b77df-2f50-579d-a602-1e42fb955e5f';
UPDATE public.exercises SET content = '{"options": ["ihm", "ihn", "er"], "smart_hint": {"de": "Bei helfen, danken, gefallen und gehören steht ein Dativobjekt.", "ru": "С глаголами «helfen», «danken», «gefallen» и «gehören» требуется дополнение в дательном падеже (Dativ).", "tr": "«helfen», «danken», «gefallen» ve «gehören» fiillerinden sonra Dativ nesnesi kullanılır.", "en": "The verbs «helfen», «danken», «gefallen», and «gehören» take a dative object.", "uk": "З дієсловами «helfen», «danken», «gefallen» і «gehören» потрібен додаток у давальному відмінку (Dativ)."}, "text_after": " ein Buch.", "text_before": "Paul hat Geburtstag. Ich schenke ", "correct_answer": "ihm"}'::jsonb WHERE id = '0dd66f44-aacd-5eb4-ab13-15c0b6f4fe46';
UPDATE public.exercises SET content = '{"options": ["eine", "ein", "einen"], "smart_hint": {"de": "Ein steht bei maskulinen und neutralen Nomen, eine bei femininen Nomen im Nominativ.", "ru": "В именительном падеже (Nominativ) «ein» используется с существительными мужского и среднего рода, а «eine» — женского.", "tr": "Yalın halde (Nominativ) eril ve nötr isimlerde «ein», dişil isimlerde «eine» kullanılır.", "en": "«Ein» is used for masculine and neuter nouns, «eine» for feminine nouns in the nominative case.", "uk": "У називному відмінку (Nominativ) «ein» використовується з іменниками чоловічого та середнього роду, а «eine» — жіночого."}, "text_after": " Bahnhof.", "text_before": "Das ist ", "correct_answer": "ein"}'::jsonb WHERE id = '0e321966-c5f5-5066-a7c4-210b81a4a3ee';
UPDATE public.exercises SET content = '{"options": ["an", "ein", "auf"], "smart_hint": {"de": "Die Vorsilbe steht im Hauptsatz am Ende: Ich stehe früh auf.", "ru": "Отделяемая приставка в главном предложении стоит в конце: Ich stehe früh auf.", "tr": "Ayrılabilen önek ana cümlenin sonunda yer alır: Ich stehe früh auf.", "en": "The separable prefix goes at the end of the main clause: Ich stehe früh auf.", "uk": "Відокремлюваний префікс у головному реченні стоїть у кінці: Ich stehe früh auf."}, "text_after": ".", "instruction": "Verb: „aufräumen“.", "text_before": "Nach dem Essen räumen wir die Küche ", "correct_answer": "auf"}'::jsonb WHERE id = '0e8b2ae9-6d1e-5dc8-a608-3aea898700e3';
UPDATE public.exercises SET content = '{"options": ["dem", "des", "den"], "question": "Die Öffnungszeiten ___ Museums stehen im Internet.", "explanation": {"de": "Wegen, trotz und während werden in der Standardsprache mit dem Genitiv verwendet.", "ru": "Предлоги «wegen», «trotz» и «während» в стандартном немецком языке используются с родительным падежом (Genitiv).", "tr": "«Wegen», «trotz» ve «während» edatları standart dilde Genitiv (ismin -in hali) ile kullanılır.", "en": "The prepositions «wegen», «trotz», and «während» are used with the genitive case in standard German.", "uk": "Прийменники «wegen», «trotz» і «während» у стандартній німецькій мові використовуються з родовим відмінком (Genitiv)."}, "correct_answer": "des"}'::jsonb WHERE id = '0f060960-8fed-5f2d-a0a1-cc924179843e';
UPDATE public.exercises SET content = '{"options": ["Nimmt", "Nehmen", "Nehmt"], "smart_hint": {"de": "Eine höfliche Aufforderung mit Sie beginnt mit dem Infinitiv; du- und ihr-Formen sind kürzer.", "ru": "Вежливая просьба с «Sie» начинается с инфинитива; формы для «du» и «ihr» короче.", "tr": "«Sie» ile yapılan kibar bir rica mastarla başlar; «du» ve «ihr» formları ise daha kısadır.", "en": "A polite request with «Sie» starts with the infinitive; «du» and «ihr» forms are shorter.", "uk": "Ввічливе прохання з «Sie» починається з інфінітива; форми для «du» та «ihr» коротші."}, "text_after": " Sie bitte Platz.", "text_before": "", "correct_answer": "Nehmen"}'::jsonb WHERE id = '0ff69b27-2b92-5747-ac3a-1b7aa5775857';
UPDATE public.exercises SET content = '{"options": ["warst", "war", "wart"], "smart_hint": {"de": "In Berichten über die Vergangenheit sind war und hatte üblich.", "ru": "В рассказах о прошлом обычно используются «war» (был) и «hatte» (имел).", "tr": "Geçmişle ilgili anlatımlarda «war» ve «hatte» yaygındır.", "en": "In reports about the past, «war» and «hatte» are common.", "uk": "У розповідях про минуле зазвичай використовуються «war» (був) і «hatte» (мав)."}, "text_after": " du am Wochenende?", "text_before": "Wo ", "correct_answer": "warst"}'::jsonb WHERE id = '10064559-e409-5ffb-a99a-b4a6d5c0c725';
UPDATE public.exercises SET content = '{"options": ["freundliche", "freundlichen", "freundlicher"], "question": "Er spricht mit einer ___ Verkäuferin.", "explanation": {"de": "Der unbestimmte Artikel zeigt nicht jede Endung; das Adjektiv ergänzt fehlende Signale.", "ru": "Неопределенный артикль показывает не все окончания; прилагательное восполняет недостающие грамматические признаки.", "tr": "Belirsiz artikel her takıyı göstermez; sıfat eksik sinyalleri tamamlar.", "en": "The indefinite article does not show every ending; the adjective provides the missing grammatical signals.", "uk": "Неозначений артикль показує не всі закінчення; прикметник доповнює відсутні граматичні ознаки."}, "correct_answer": "freundlichen"}'::jsonb WHERE id = '107b823a-f56e-503a-a6b1-cc39123a425b';
UPDATE public.exercises SET content = '{"options": ["als auch", "sondern auch", "entweder"], "question": "Das Angebot ist nicht nur günstig, ___ praktisch.", "explanation": {"de": "Zweiteilige Konnektoren haben feste Partner: sowohl … als auch, entweder … oder, weder … noch.", "ru": "Двойные союзы имеют устойчивые пары: sowohl … als auch, entweder … oder, weder … noch.", "tr": "İkili bağlaçların sabit partnerleri vardır: sowohl … als auch, entweder … oder, weder … noch.", "en": "Two-part connectors have fixed partners: sowohl … als auch, entweder … oder, weder … noch.", "uk": "Подвійні сполучники мають сталі пари: sowohl … als auch, entweder … oder, weder … noch."}, "correct_answer": "sondern auch"}'::jsonb WHERE id = '10984df9-4772-53c0-a227-756eb7fca08d';
UPDATE public.exercises SET content = '{"options": ["ist", "bin", "bist"], "question": "Ich ___ dreißig Jahre alt.", "explanation": {"de": "Das Verb passt zur Person: ich bin, du bist, er/sie ist, wir sind, ihr seid.", "ru": "Глагол согласуется с лицом: ich bin, du bist, er/sie ist, wir sind, ihr seid.", "tr": "Fiil kişiye uyar: ich bin, du bist, er/sie ist, wir sind, ihr seid.", "en": "The verb matches the person: ich bin, du bist, er/sie ist, wir sind, ihr seid.", "uk": "Дієслово узгоджується з особою: ich bin, du bist, er/sie ist, wir sind, ihr seid."}, "correct_answer": "bin"}'::jsonb WHERE id = '1215d245-1c40-5a33-ac9d-e1418697ae5b';
UPDATE public.exercises SET content = '{"options": ["kein", "nicht", "keine"], "question": "Die Antwort ist ___ richtig.", "explanation": {"de": "Kein verneint ein Nomen mit unbestimmtem Artikel; nicht verneint unter anderem Adjektive und Verben.", "ru": "«Kein» отрицает существительное с неопределенным артиклем; «nicht» отрицает, среди прочего, прилагательные и глаголы.", "tr": "«Kein» belirsiz artikelli bir ismi olumsuz yapar; «nicht» ise sıfatları ve fiilleri olumsuz yapar.", "en": "«Kein» negates a noun with an indefinite article; «nicht» negates adjectives and verbs, among other things.", "uk": "«Kein» заперечує іменник з неозначеним артиклем; «nicht» заперечує, серед іншого, прикметники та дієслова."}, "correct_answer": "nicht"}'::jsonb WHERE id = '1223f14c-6472-53f2-a3ee-5a5bd4a8c79a';
UPDATE public.exercises SET content = '{"options": ["das", "dem", "den"], "smart_hint": {"de": "Die Präposition bestimmt den Kasus; dessen/deren beziehen sich auf den Besitzer.", "ru": "Предлог определяет падеж; «dessen» и «deren» указывают на владельца.", "tr": "Edat hali (Kasus) belirler; «dessen» ve «deren» sahibe işaret eder.", "en": "The preposition determines the case; «dessen» and «deren» refer to the owner.", "uk": "Прийменник визначає відмінок; «dessen» і «deren» вказують на власника."}, "text_after": " ich aufgewachsen bin.", "text_before": "Das ist das Haus, in ", "correct_answer": "dem"}'::jsonb WHERE id = '1228fa09-8e46-5370-a855-88ce90b6d1f4';
UPDATE public.exercises SET content = '{"options": ["obwohl", "trotzdem", "denn"], "smart_hint": {"de": "Obwohl leitet einen Nebensatz ein; nach trotzdem steht ein Hauptsatz mit dem Verb an zweiter Stelle.", "ru": "«Obwohl» начинает придаточное предложение; после «trotzdem» следует главное предложение с глаголом на втором месте.", "tr": "«Obwohl» bir yan cümleyi başlatır; «trotzdem» kelimesinden sonra fiilin ikinci sırada olduğu bir ana cümle gelir.", "en": "«Obwohl» introduces a subordinate clause; after «trotzdem» comes a main clause with the verb in the second position.", "uk": "«Obwohl» починає підрядне речення; після «trotzdem» йде головне речення з дієсловом на другому місці."}, "text_after": " sie Kopfschmerzen hat.", "text_before": "Sie geht zur Arbeit, ", "correct_answer": "obwohl"}'::jsonb WHERE id = '1485d91d-12f6-53c6-aba0-8ba51ea47ae8';
UPDATE public.exercises SET content = '{"options": ["bist", "bin", "sein"], "question": "Ich schicke dir die Fotos, sobald ich zu Hause ___.", "explanation": {"de": "Seitdem beschreibt einen Beginn, bis einen Endpunkt und sobald den unmittelbar folgenden Zeitpunkt.", "ru": "«Seitdem» описывает начало, «bis» — конечную точку, а «sobald» — непосредственно следующий момент.", "tr": "«Seitdem» bir başlangıcı, «bis» bir bitiş noktasını, «sobald» ise hemen ardından gelen anı ifade eder.", "en": "«Seitdem» describes a beginning, «bis» an endpoint, and «sobald» the immediately following moment.", "uk": "«Seitdem» описує початок, «bis» — кінцеву точку, а «sobald» — безпосередньо наступний момент."}, "correct_answer": "bin"}'::jsonb WHERE id = '151569f7-7391-5aa3-a887-f3b162de8417';
UPDATE public.exercises SET content = '{"options": ["machen zu", "zu gemacht", "zu machen"], "question": "Er sah fern, anstatt seine Hausaufgaben ___.", "explanation": {"de": "Bei gleichem Subjekt stehen ohne zu und anstatt zu mit Infinitiv; bei anderem Subjekt verwendet man ohne dass.", "ru": "При одинаковом подлежащем используются «ohne zu» и «anstatt zu» с инфинитивом; при разных подлежащих используется «ohne dass».", "tr": "Aynı özne olduğunda «ohne zu» ve «anstatt zu» mastarla kullanılır; farklı özne olduğunda «ohne dass» kullanılır.", "en": "With the same subject, use «ohne zu» and «anstatt zu» with an infinitive; with a different subject, use «ohne dass».", "uk": "При однаковому підметі використовуються «ohne zu» і «anstatt zu» з інфінітивом; при різних підметах використовується «ohne dass»."}, "correct_answer": "zu machen"}'::jsonb WHERE id = '15fa5353-201a-5b29-ac19-ba7c85b80308';
UPDATE public.exercises SET content = '{"options": ["hatte", "war", "wurde"], "smart_hint": {"de": "Das Plusquamperfekt beschreibt die frühere von zwei vergangenen Handlungen: hatte/war + Partizip.", "ru": "Plusquamperfekt (предпрошедшее время) описывает более раннее из двух действий в прошлом: hatte/war + Partizip.", "tr": "Plusquamperfekt, geçmişte olan iki eylemden daha önce gerçekleşeni tanımlar: hatte/war + Partizip.", "en": "The Plusquamperfekt describes the earlier of two past actions: hatte/war + Partizip.", "uk": "Plusquamperfekt (давноминулий час) описує більш ранню з двох дій у минулому: hatte/war + Partizip."}, "text_after": ".", "text_before": "Ich konnte nicht bezahlen, weil ich mein Portemonnaie vergessen ", "correct_answer": "hatte"}'::jsonb WHERE id = '162a19bf-8b08-515f-a0da-5683435f03bc';
UPDATE public.exercises SET content = '{"options": ["Er", "Sie", "Es"], "smart_hint": {"de": "Das Pronomen ersetzt eine Person oder Sache und muss zur Verbform passen.", "ru": "Местоимение заменяет человека или вещь и должно согласовываться с формой глагола.", "tr": "Zamir bir kişiyi veya nesneyi yerini tutar ve fiil formuna uymalıdır.", "en": "The pronoun replaces a person or thing and must match the verb form.", "uk": "Займенник замінює людину або річ і має узгоджуватися з формою дієслова."}, "text_after": " fährt aber gut.", "text_before": "Das Auto ist alt. ", "correct_answer": "Es"}'::jsonb WHERE id = '168d5ba3-7022-5893-aac4-2db3c01e5bd0';
UPDATE public.exercises SET content = '{"options": ["damit", "um", "dass"], "smart_hint": {"de": "Um zu verwendet man bei gleichem Subjekt; damit erlaubt unterschiedliche Subjekte.", "ru": "«Um zu» используется при одном и том же подлежащем; «damit» позволяет использовать разные подлежащие.", "tr": "«Um zu» aynı özneyle kullanılır; «damit» ise farklı öznelere izin verir.", "en": "Use «um zu» with the same subject; «damit» allows different subjects.", "uk": "«Um zu» використовується при одному й тому ж підметі; «damit» дозволяє використовувати різні підмети."}, "text_after": " ihre Aussprache zu verbessern.", "text_before": "Sie besucht einen Kurs, ", "correct_answer": "um"}'::jsonb WHERE id = '172acb68-0191-513f-aeb7-50560beadb37';
UPDATE public.exercises SET content = '{"options": ["bezahlen", "bezahlt", "bezahle"], "smart_hint": {"de": "Achte auf Person, Kasus und die passende Verbform im Satz.", "ru": "Обратите внимание на лицо, падеж и подходящую форму глагола в предложении.", "tr": "Cümledeki kişiye, ismin haline (Kasus) ve uygun fiil formuna dikkat et.", "en": "Pay attention to the person, case, and the appropriate verb form in the sentence.", "uk": "Зверніть увагу на особу, відмінок і відповідну форму дієслова в реченні."}, "text_after": "?", "text_before": "Kann ich mit Karte ", "correct_answer": "bezahlen"}'::jsonb WHERE id = '17c24c0b-0eb6-5695-a7dc-82db284fa4d7';
UPDATE public.exercises SET content = '{"options": ["waren", "war", "warst"], "smart_hint": {"de": "In Berichten über die Vergangenheit sind war und hatte üblich.", "ru": "В рассказах о прошлом обычно используются «war» (был) и «hatte» (имел).", "tr": "Geçmişle ilgili anlatımlarda «war» ve «hatte» yaygındır.", "en": "In reports about the past, «war» and «hatte» are common.", "uk": "У розповідях про минуле зазвичай використовуються «war» (був) і «hatte» (мав)."}, "text_after": " ich den ganzen Tag zu Hause.", "text_before": "Gestern ", "correct_answer": "war"}'::jsonb WHERE id = '182f44a9-b65f-5c8d-a5c3-c412fdea487f';
UPDATE public.exercises SET content = '{"options": ["damit", "weil", "um"], "question": "Er geht früh ins Bett, ___ morgen fit zu sein.", "explanation": {"de": "Um zu verwendet man bei gleichem Subjekt; damit erlaubt unterschiedliche Subjekte.", "ru": "«Um zu» используется при одном и том же подлежащем; «damit» позволяет использовать разные подлежащие.", "tr": "«Um zu» aynı özneyle kullanılır; «damit» ise farklı öznelere izin verir.", "en": "Use «um zu» with the same subject; «damit» allows different subjects.", "uk": "«Um zu» використовується при одному й тому ж підметі; «damit» дозволяє використовувати різні підмети."}, "correct_answer": "um"}'::jsonb WHERE id = '198be337-2469-58b7-a463-b17ba2c90fb7';
UPDATE public.exercises SET content = '{"options": ["Das", "Der", "Die"], "smart_hint": {"de": "Lerne jedes Nomen mit seinem Artikel: der, die oder das.", "ru": "Учите каждое существительное вместе с его артиклем: der, die или das.", "tr": "Her ismi artikeliyle birlikte öğren: der, die veya das.", "en": "Learn every noun with its article: der, die, or das.", "uk": "Вчіть кожен іменник разом з його артиклем: der, die або das."}, "text_after": " Mädchen liest ein Buch.", "text_before": "", "correct_answer": "Das"}'::jsonb WHERE id = '1a0bb117-d451-5ba3-ace9-bc5441df9aaa';
UPDATE public.exercises SET content = '{"options": ["kein", "nicht", "keine"], "smart_hint": {"de": "Kein verneint ein Nomen mit unbestimmtem Artikel; nicht verneint unter anderem Adjektive und Verben.", "ru": "«Kein» отрицает существительное с неопределенным артиклем; «nicht» отрицает, среди прочего, прилагательные и глаголы.", "tr": "«Kein» belirsiz artikelli bir ismi olumsuz yapar; «nicht» ise sıfatları ve fiilleri olumsuz yapar.", "en": "«Kein» negates a noun with an indefinite article; «nicht» negates adjectives and verbs, among other things.", "uk": "«Kein» заперечує іменник з неозначеним артиклем; «nicht» заперечує, серед іншого, прикметники та дієслова."}, "text_after": " heiß.", "text_before": "Der Kaffee ist ", "correct_answer": "nicht"}'::jsonb WHERE id = '1a475931-cd12-5315-a487-3c5e56d3fa5f';
UPDATE public.exercises SET content = '{"options": ["Wer", "Woher", "Wie viel"], "smart_hint": {"de": "Wer fragt nach Personen, wo nach Orten, woher nach Herkunft, wann nach Zeit.", "ru": "«Wer» (кто) используется для людей, «wo» (где) для мест, «woher» (откуда) для происхождения, «wann» (когда) для времени.", "tr": "«Wer» (kim) kişileri, «wo» (nerede) yerleri, «woher» (nereden) kökeni, «wann» (ne zaman) zamanı sorar.", "en": "«Wer» (who) asks about people, «wo» (where) about places, «woher» (where from) about origin, «wann» (when) about time.", "uk": "«Wer» (хто) питає про людей, «wo» (де) про місця, «woher» (звідки) про походження, «wann» (коли) про час."}, "text_after": " kostet das Brot? – Drei Euro.", "text_before": "", "correct_answer": "Wie viel"}'::jsonb WHERE id = '1bdc851c-f047-5f4b-af65-dd817a4bf862';
UPDATE public.exercises SET content = '{"options": ["der", "dem", "die"], "smart_hint": {"de": "Wo? verlangt Dativ, wohin? verlangt Akkusativ bei in, an, auf, unter und weiteren Wechselpräpositionen.", "ru": "С предлогами in, an, auf, unter и другими вопросом «Wo?» требуется Dativ, а с вопросом «wohin?» — Akkusativ.", "tr": "in, an, auf, unter gibi yön bildiren edatlarda «Wo?» sorusu Dativ, «wohin?» sorusu Akkusativ gerektirir.", "en": "With two-way prepositions like in, an, auf, unter, «Wo?» requires the dative, and «wohin?» requires the accusative.", "uk": "З прийменниками in, an, auf, unter та іншими запитання «Wo?» вимагає Dativ, а «wohin?» — Akkusativ."}, "text_after": " Küche.", "text_before": "Er stellt die Blumen in ", "correct_answer": "die"}'::jsonb WHERE id = '1c0ce351-bc5f-5b73-a6ed-36a2515d7c91';
UPDATE public.exercises SET content = '{"options": ["Hat", "Hast", "Habe"], "smart_hint": {"de": "Haben: ich habe, du hast, er/sie hat, wir haben, ihr habt.", "ru": "Спряжение «haben»: ich habe, du hast, er/sie hat, wir haben, ihr habt.", "tr": "«Haben» (sahip olmak) fiilinin çekimi: ich habe, du hast, er/sie hat, wir haben, ihr habt.", "en": "Conjugation of «haben»: ich habe, du hast, er/sie hat, wir haben, ihr habt.", "uk": "Відмінювання «haben»: ich habe, du hast, er/sie hat, wir haben, ihr habt."}, "text_after": " du eine Frage?", "text_before": "", "correct_answer": "Hast"}'::jsonb WHERE id = '1c28f666-4d11-5ad1-aa72-801edf75ffef';
UPDATE public.exercises SET content = '{"options": ["denen", "deren", "die"], "smart_hint": {"de": "Der Kasus des Relativpronomens ergibt sich aus seiner Funktion im Relativsatz.", "ru": "Падеж относительного местоимения зависит от его функции в придаточном предложении.", "tr": "İlgi zamirinin hali (Kasus), ilgi cümlesindeki (Relativsatz) görevine göre belirlenir.", "en": "The case of the relative pronoun depends on its function in the relative clause.", "uk": "Відмінок відносного займенника залежить від його функції в підрядному реченні."}, "text_after": " du eingeladen hast, kommen morgen.", "text_before": "Die Leute, ", "correct_answer": "die"}'::jsonb WHERE id = '1c4f98f6-4e40-5c70-a6af-e94bb4c93130';
UPDATE public.exercises SET content = '{"options": ["andererseits", "entweder", "weder"], "smart_hint": {"de": "Begründe Aussagen mit klaren Verknüpfungen und achte auf den Satzbau.", "ru": "Обосновывайте утверждения четкими союзами и следите за структурой предложения.", "tr": "İfadelerini net bağlaçlarla gerekçelendir ve cümle yapısına dikkat et.", "en": "Justify statements with clear conjunctions and pay attention to sentence structure.", "uk": "Обґрунтовуйте твердження чіткими сполучниками та слідкуйте за структурою речення."}, "text_after": " liegt sie weit außerhalb.", "text_before": "Einerseits ist die Wohnung günstig, ", "correct_answer": "andererseits"}'::jsonb WHERE id = '1d49da8b-d65b-58ba-a751-f500306af4e9';
UPDATE public.exercises SET content = '{"options": ["Öffne", "Öffnet", "Öffnen"], "smart_hint": {"de": "Eine höfliche Aufforderung mit Sie beginnt mit dem Infinitiv; du- und ihr-Formen sind kürzer.", "ru": "Вежливая просьба с «Sie» начинается с инфинитива; формы для «du» и «ihr» короче.", "tr": "«Sie» ile yapılan kibar bir rica mastarla başlar; «du» ve «ihr» formları ise daha kısadır.", "en": "A polite request with «Sie» starts with the infinitive; «du» and «ihr» forms are shorter.", "uk": "Ввічливе прохання з «Sie» починається з інфінітива; форми для «du» та «ihr» коротші."}, "text_after": " bitte eure Bücher, Kinder.", "text_before": "", "correct_answer": "Öffnet"}'::jsonb WHERE id = '1db12cbc-b681-5995-ac8a-8cb104793b60';
UPDATE public.exercises SET content = '{"options": ["denn", "aber", "obwohl"], "smart_hint": {"de": "Und, aber, denn und oder verbinden Hauptsätze; nach weil steht das Verb am Ende.", "ru": "«Und», «aber», «denn» и «oder» соединяют главные предложения; после «weil» глагол стоит в конце.", "tr": "«Und», «aber», «denn» ve «oder» ana cümleleri bağlar; «weil» den sonra fiil en sonda yer alır.", "en": "«Und», «aber», «denn», and «oder» connect main clauses; after «weil» the verb goes at the end.", "uk": "«Und», «aber», «denn» і «oder» з''єднують головні речення; після «weil» дієслово стоїть у кінці."}, "text_after": " es heute kalt ist.", "text_before": "Wir fahren ans Meer, ", "correct_answer": "obwohl"}'::jsonb WHERE id = '1ea75b54-210e-5ea2-a406-0a5301a498ca';
UPDATE public.exercises SET content = '{"options": ["ist", "sind", "bist"], "smart_hint": {"de": "Das Verb passt zur Person: ich bin, du bist, er/sie ist, wir sind, ihr seid.", "ru": "Глагол согласуется с лицом: ich bin, du bist, er/sie ist, wir sind, ihr seid.", "tr": "Fiil kişiye uyar: ich bin, du bist, er/sie ist, wir sind, ihr seid.", "en": "The verb matches the person: ich bin, du bist, er/sie ist, wir sind, ihr seid.", "uk": "Дієслово узгоджується з особою: ich bin, du bist, er/sie ist, wir sind, ihr seid."}, "text_after": " meine Lehrerin.", "text_before": "Das ", "correct_answer": "ist"}'::jsonb WHERE id = '1eb00631-18f7-595b-a059-34038dec117d';
UPDATE public.exercises SET content = '{"options": ["gehen die Schüler", "die Schüler gehen", "geht die Schüler"], "smart_hint": {"de": "Im Hauptsatz steht das finite Verb an Position zwei; im Nebensatz am Ende. Pronomen stehen meist vor Nomenobjekten.", "ru": "В главном предложении спрягаемый глагол стоит на втором месте; в придаточном — в конце. Местоимения обычно стоят перед дополнениями-существительными.", "tr": "Ana cümlede çekimli fiil ikinci sıradadır; yan cümlede ise en sondadır. Zamirler genellikle isim nesnelerinden önce gelir.", "en": "In the main clause, the finite verb is in position two; in the subordinate clause, at the end. Pronouns usually come before noun objects.", "uk": "У головному реченні відмінюване дієслово стоїть на другій позиції; у підрядному — в кінці. Займенники зазвичай стоять перед іменниковими додатками."}, "text_after": " nach Hause.", "text_before": "Nach dem Kurs ", "correct_answer": "gehen die Schüler"}'::jsonb WHERE id = '1f1f67b9-7347-5511-a39c-ae2e105caa03';
UPDATE public.exercises SET content = '{"options": ["keines", "keinen", "keinem"], "smart_hint": {"de": "Indefinitpronomen übernehmen die Endungen passend zu Genus und Kasus.", "ru": "Неопределенные местоимения принимают окончания в соответствии с родом и падежом.", "tr": "Belgisiz zamirler (Indefinitpronomen) ismin cinsiyetine (Genus) ve haline (Kasus) uygun takıları alırlar.", "en": "Indefinite pronouns take the endings appropriate for gender and case.", "uk": "Неозначені займенники приймають закінчення відповідно до роду та відмінка."}, "text_after": " mehr da.", "text_before": "Ist noch Brot da? – Nein, es ist ", "correct_answer": "keines"}'::jsonb WHERE id = '1f2ccdfe-6f42-5310-a1ca-0aebfd0184e3';
UPDATE public.exercises SET content = '{"options": ["ein", "einem", "einen"], "smart_hint": {"de": "Im Akkusativ wird der/ein zu den/einen; die und das bleiben gleich.", "ru": "В винительном падеже (Akkusativ) der/ein меняются на den/einen; die и das остаются без изменений.", "tr": "İsmin -i halinde (Akkusativ) der/ein artikel takıları den/einen olur; die ve das ise değişmeden kalır.", "en": "In the accusative, der/ein change to den/einen; die and das remain the same.", "uk": "У знахідному відмінку (Akkusativ) der/ein змінюються на den/einen; die та das залишаються без змін."}, "text_after": " Mantel.", "text_before": "Sie kauft ", "correct_answer": "einen"}'::jsonb WHERE id = '1ff2a302-d642-5a81-a70d-679aa310ca2a';
UPDATE public.exercises SET content = '{"options": ["Um", "Am", "Im"], "smart_hint": {"de": "Bei Uhrzeiten steht um, bei Wochentagen am; das Verb richtet sich nach dem Subjekt.", "ru": "С указанием времени используется «um», с днями недели «am»; глагол согласуется с подлежащим.", "tr": "Saatlerde «um», haftanın günlerinde «am» kullanılır; fiil özneye göre çekimlenir.", "en": "For times, use «um», for days of the week use «am»; the verb agrees with the subject.", "uk": "Із зазначенням часу використовується «um», з днями тижня «am»; дієслово узгоджується з підметом."}, "text_after": " Freitag habe ich frei.", "text_before": "", "correct_answer": "Am"}'::jsonb WHERE id = '202fe97f-51f8-532f-a5f8-b8ad480b0862';
UPDATE public.exercises SET content = '{"options": ["der", "den", "dem"], "smart_hint": {"de": "Im Akkusativ wird der/ein zu den/einen; die und das bleiben gleich.", "ru": "В винительном падеже (Akkusativ) der/ein меняются на den/einen; die и das остаются без изменений.", "tr": "İsmin -i halinde (Akkusativ) der/ein artikel takıları den/einen olur; die ve das ise değişmeden kalır.", "en": "In the accusative, der/ein change to den/einen; die and das remain the same.", "uk": "У знахідному відмінку (Akkusativ) der/ein змінюються на den/einen; die та das залишаються без змін."}, "text_after": " Bahnhof.", "text_before": "Ich suche ", "correct_answer": "den"}'::jsonb WHERE id = '20841482-d4a2-52a5-a101-b46e67301e4c';
UPDATE public.exercises SET content = '{"options": ["keine", "keinen", "kein"], "question": "Das ist ___ Problem.", "explanation": {"de": "Kein verneint ein Nomen mit unbestimmtem Artikel; nicht verneint unter anderem Adjektive und Verben.", "ru": "«Kein» отрицает существительное с неопределенным артиклем; «nicht» отрицает, среди прочего, прилагательные и глаголы.", "tr": "«Kein» belirsiz artikelli bir ismi olumsuz yapar; «nicht» ise sıfatları ve fiilleri olumsuz yapar.", "en": "«Kein» negates a noun with an indefinite article; «nicht» negates adjectives and verbs, among other things.", "uk": "«Kein» заперечує іменник з неозначеним артиклем; «nicht» заперечує, серед іншого, прикметники та дієслова."}, "correct_answer": "kein"}'::jsonb WHERE id = '2233a1ee-a272-5cce-a1f8-74455c4c5747';
UPDATE public.exercises SET content = '{"options": ["als", "wenn", "ob"], "smart_hint": {"de": "Als beschreibt ein einmaliges Ereignis in der Vergangenheit, wenn Wiederholungen oder Bedingungen.", "ru": "«Als» описывает однократное событие в прошлом, «wenn» — повторяющиеся события или условия.", "tr": "«Als» geçmişteki tek seferlik bir olayı tanımlarken, «wenn» tekrarlanan olayları veya koşulları tanımlar.", "en": "«Als» describes a single event in the past, «wenn» describes repetitions or conditions.", "uk": "«Als» описує одноразову подію в минулому, «wenn» — повторювані події або умови."}, "text_after": " es regnet, nehme ich den Bus.", "text_before": "Immer ", "correct_answer": "wenn"}'::jsonb WHERE id = '2292593a-43d6-5b08-a4f4-a164cca9943e';
UPDATE public.exercises SET content = '{"options": ["sein", "bist", "bin"], "smart_hint": {"de": "Seitdem beschreibt einen Beginn, bis einen Endpunkt und sobald den unmittelbar folgenden Zeitpunkt.", "ru": "«Seitdem» описывает начало, «bis» — конечную точку, а «sobald» — непосредственно следующий момент.", "tr": "«Seitdem» bir başlangıcı, «bis» bir bitiş noktasını, «sobald» ise hemen ardından gelen anı ifade eder.", "en": "«Seitdem» describes a beginning, «bis» an endpoint, and «sobald» the immediately following moment.", "uk": "«Seitdem» описує початок, «bis» — кінцеву точку, а «sobald» — безпосередньо наступний момент."}, "text_after": ".", "text_before": "Warte bitte, bis ich fertig ", "correct_answer": "bin"}'::jsonb WHERE id = '22c4509e-f6a6-591d-a9e6-344c9275b00a';
UPDATE public.exercises SET content = '{"options": ["keiner", "keinen", "keinem"], "smart_hint": {"de": "Indefinitpronomen übernehmen die Endungen passend zu Genus und Kasus.", "ru": "Неопределенные местоимения принимают окончания в соответствии с родом и падежом.", "tr": "Belgisiz zamirler (Indefinitpronomen) ismin cinsiyetine (Genus) ve haline (Kasus) uygun takıları alırlar.", "en": "Indefinite pronouns take the endings appropriate for gender and case.", "uk": "Неозначені займенники приймають закінчення відповідно до роду та відмінка."}, "text_after": ".", "text_before": "Ich suche einen freien Platz, aber ich finde ", "correct_answer": "keinen"}'::jsonb WHERE id = '23656d8f-9527-5f43-a0de-4ee5bf09bd29';
UPDATE public.exercises SET content = '{"options": ["zu laufen", "laufen", "gelaufen"], "smart_hint": {"de": "Nach lassen steht ein Infinitiv ohne zu; verneintes brauchen wird standardsprachlich mit zu verwendet.", "ru": "После «lassen» следует инфинитив без «zu»; отрицательное «brauchen» в литературном языке используется с «zu».", "tr": "«lassen» fiilinden sonra «zu» olmadan mastar (infinitiv) kullanılır; olumsuz yapılan «brauchen» standart dilde «zu» ile kullanılır.", "en": "After «lassen», use an infinitive without «zu»; the negated form of «brauchen» is used with «zu» in standard German.", "uk": "Після «lassen» йде інфінітив без «zu»; заперечне «brauchen» в літературній мові використовується з «zu»."}, "text_after": ".", "text_before": "Er lässt den Motor kurz ", "correct_answer": "laufen"}'::jsonb WHERE id = '27bd2074-b995-5101-a2a0-4d3302900f5a';
UPDATE public.exercises SET content = '{"options": ["meinem", "meines", "meinen"], "smart_hint": {"de": "Wegen, trotz und während werden in der Standardsprache mit dem Genitiv verwendet.", "ru": "Предлоги «wegen», «trotz» и «während» в стандартном немецком языке используются с родительным падежом (Genitiv).", "tr": "«Wegen», «trotz» ve «während» edatları standart dilde Genitiv (ismin -in hali) ile kullanılır.", "en": "The prepositions «wegen», «trotz», and «während» are used with the genitive case in standard German.", "uk": "Прийменники «wegen», «trotz» і «während» у стандартній німецькій мові використовуються з родовим відмінком (Genitiv)."}, "text_after": " Chefs.", "text_before": "Das ist das Büro ", "correct_answer": "meines"}'::jsonb WHERE id = '283d3a52-a1ce-59bc-a9bb-8a35375611a2';
UPDATE public.exercises SET content = '{"options": ["an", "zu", "auf"], "smart_hint": {"de": "Begründe Aussagen mit klaren Verknüpfungen und achte auf den Satzbau.", "ru": "Обосновывайте утверждения четкими союзами и следите за структурой предложения.", "tr": "İfadelerini net bağlaçlarla gerekçelendir ve cümle yapısına dikkat et.", "en": "Justify statements with clear conjunctions and pay attention to sentence structure.", "uk": "Обґрунтовуйте твердження чіткими сполучниками та слідкуйте за структурою речення."}, "text_after": ", denn dein Vorschlag ist sinnvoll.", "text_before": "Ich stimme dir ", "correct_answer": "zu"}'::jsonb WHERE id = '28a6fc0b-2ffd-568a-a8c8-fbc7c5b378dc';
UPDATE public.exercises SET content = '{"options": ["die", "der", "den"], "smart_hint": {"de": "Mit, bei, nach, aus und von verlangen den Dativ.", "ru": "Предлоги «mit», «bei», «nach», «aus» и «von» требуют дательного падежа (Dativ).", "tr": "«Mit», «bei», «nach», «aus» ve «von» edatları Dativ (ismin -e hali) gerektirir.", "en": "The prepositions «mit», «bei», «nach», «aus», and «von» require the dative case.", "uk": "Прийменники «mit», «bei», «nach», «aus» і «von» вимагають давального відмінка (Dativ)."}, "text_after": " Eltern.", "text_before": "Wir wohnen bei ", "correct_answer": "den"}'::jsonb WHERE id = '28e90acb-9d43-5ecb-a05d-5d6dd779a1ab';
UPDATE public.exercises SET content = '{"options": ["worden", "geworden", "wurde"], "smart_hint": {"de": "Passiv im Präteritum: wurde + Partizip; Passiv im Perfekt: ist + Partizip + worden.", "ru": "Пассивный залог в Präteritum: wurde + Partizip; в Perfekt: ist + Partizip + worden.", "tr": "Präteritum''da edilgen çatı (Passiv): wurde + Partizip; Perfekt''te: ist + Partizip + worden.", "en": "Passive voice in Präteritum: wurde + Partizip; in Perfekt: ist + Partizip + worden.", "uk": "Пасивний стан у Präteritum: wurde + Partizip; у Perfekt: ist + Partizip + worden."}, "text_after": ".", "text_before": "Die Straße ist wegen eines Unfalls gesperrt ", "correct_answer": "worden"}'::jsonb WHERE id = '29ba0d63-1fec-5d4a-ab93-68c2e71a9330';
UPDATE public.exercises SET content = '{"options": ["hatten", "wurden", "waren"], "smart_hint": {"de": "Das Plusquamperfekt beschreibt die frühere von zwei vergangenen Handlungen: hatte/war + Partizip.", "ru": "Plusquamperfekt (предпрошедшее время) описывает более раннее из двух действий в прошлом: hatte/war + Partizip.", "tr": "Plusquamperfekt, geçmişte olan iki eylemden daha önce gerçekleşeni tanımlar: hatte/war + Partizip.", "en": "The Plusquamperfekt describes the earlier of two past actions: hatte/war + Partizip.", "uk": "Plusquamperfekt (давноминулий час) описує більш ранню з двох дій у минулому: hatte/war + Partizip."}, "text_after": ", räumten wir auf.", "text_before": "Nachdem die Gäste gegangen ", "correct_answer": "waren"}'::jsonb WHERE id = '29e83ce3-a7d5-595d-a413-fb5f62482334';
UPDATE public.exercises SET content = '{"options": ["eine", "ein", "einen"], "smart_hint": {"de": "Ein steht bei maskulinen und neutralen Nomen, eine bei femininen Nomen im Nominativ.", "ru": "В именительном падеже (Nominativ) «ein» используется с существительными мужского и среднего рода, а «eine» — женского.", "tr": "Yalın halde (Nominativ) eril ve nötr isimlerde «ein», dişil isimlerde «eine» kullanılır.", "en": "«Ein» is used for masculine and neuter nouns, «eine» for feminine nouns in the nominative case.", "uk": "У називному відмінку (Nominativ) «ein» використовується з іменниками чоловічого та середнього роду, а «eine» — жіночого."}, "text_after": " Bäckerei.", "text_before": "Hier ist ", "correct_answer": "eine"}'::jsonb WHERE id = '2a03721e-f36d-58c5-ae80-e4cd85ea3711';
UPDATE public.exercises SET content = '{"options": ["dessen", "denen", "deren"], "smart_hint": {"de": "Die Präposition bestimmt den Kasus; dessen/deren beziehen sich auf den Besitzer.", "ru": "Предлог определяет падеж; «dessen» и «deren» указывают на владельца.", "tr": "Edat hali (Kasus) belirler; «dessen» ve «deren» sahibe işaret eder.", "en": "The preposition determines the case; «dessen» and «deren» refer to the owner.", "uk": "Прийменник визначає відмінок; «dessen» і «deren» вказують на власника."}, "text_after": " Fahrrad gestohlen wurde.", "text_before": "Ich kenne die Frau, ", "correct_answer": "deren"}'::jsonb WHERE id = '2a16be1b-007f-576b-a0bb-bdf296d75061';
UPDATE public.exercises SET content = '{"options": ["die", "der", "das"], "smart_hint": {"de": "Das Relativpronomen übernimmt Genus und Numerus des Bezugsworts.", "ru": "Относительное местоимение принимает род и число определяемого слова.", "tr": "İlgi zamiri, nitelediği kelimenin cinsiyetini (Genus) ve tekil/çoğul durumunu (Numerus) alır.", "en": "The relative pronoun takes the gender and number of the noun it refers to.", "uk": "Відносний займенник приймає рід і число слова, яке він визначає."}, "text_after": " mir immer hilft.", "text_before": "Das ist der Nachbar, ", "correct_answer": "der"}'::jsonb WHERE id = '2a702a6d-060a-57a2-a74f-56ca38a428a4';
UPDATE public.exercises SET content = '{"options": ["an", "ein", "ab"], "smart_hint": {"de": "Die Vorsilbe steht im Hauptsatz am Ende: Ich stehe früh auf.", "ru": "Отделяемая приставка в главном предложении стоит в конце: Ich stehe früh auf.", "tr": "Ayrılabilen önek ana cümlenin sonunda yer alır: Ich stehe früh auf.", "en": "The separable prefix goes at the end of the main clause: Ich stehe früh auf.", "uk": "Відокремлюваний префікс у головному реченні стоїть у кінці: Ich stehe früh auf."}, "text_after": ".", "instruction": "Verb: „anfangen“.", "text_before": "Der Film fängt um zwanzig Uhr ", "correct_answer": "an"}'::jsonb WHERE id = '2a7e5d88-bc11-5f5e-a136-4949df375f9b';
UPDATE public.exercises SET content = '{"options": ["als auch", "sondern auch", "weder"], "smart_hint": {"de": "Zweiteilige Konnektoren haben feste Partner: sowohl … als auch, entweder … oder, weder … noch.", "ru": "Двойные союзы имеют устойчивые пары: sowohl … als auch, entweder … oder, weder … noch.", "tr": "İkili bağlaçların sabit partnerleri vardır: sowohl … als auch, entweder … oder, weder … noch.", "en": "Two-part connectors have fixed partners: sowohl … als auch, entweder … oder, weder … noch.", "uk": "Подвійні сполучники мають сталі пари: sowohl … als auch, entweder … oder, weder … noch."}, "text_after": " sehr hilfsbereit.", "text_before": "Er ist nicht nur freundlich, ", "correct_answer": "sondern auch"}'::jsonb WHERE id = '2b9d4de2-3e4f-5173-a77b-e49f7fb5f70b';
UPDATE public.exercises SET content = '{"options": ["wie", "am", "als"], "smart_hint": {"de": "Beim Vergleichen steht nach dem Komparativ als; einige Formen sind unregelmäßig.", "ru": "При сравнении после сравнительной степени (Komparativ) ставится «als»; некоторые формы являются исключениями.", "tr": "Karşılaştırma yaparken karşılaştırma derecesinden (Komparativ) sonra «als» kullanılır; bazı formlar düzensizdir.", "en": "When comparing, «als» is used after the comparative; some forms are irregular.", "uk": "При порівнянні після вищого ступеня (Komparativ) ставиться «als»; деякі форми є неправильними."}, "text_after": " ich.", "text_before": "Mein Bruder ist älter ", "correct_answer": "als"}'::jsonb WHERE id = '2bcd0793-6fbb-5cd1-a3c1-3712b21fea86';
UPDATE public.exercises SET content = '{"options": ["davon", "dafür", "damit"], "smart_hint": {"de": "Da(r)- und wo(r)- ersetzen Präpositionen mit Sachen; vor Vokalen steht r.", "ru": "Формы на da(r)- и wo(r)- заменяют предлоги с неодушевленными предметами; перед гласными добавляется -r-.", "tr": "da(r)- ve wo(r)- edatların cansız nesnelerle kullanımının yerini alır; sesli harflerden önce araya -r- girer.", "en": "Da(r)- and wo(r)- forms replace prepositions with things; before vowels, an ''r'' is added.", "uk": "Форми на da(r)- і wo(r)- замінюють прийменники з неживими предметами; перед голосними додається -r-."}, "text_after": ".", "text_before": "Erzählst du von deiner Reise? – Ja, ich erzähle ", "correct_answer": "davon"}'::jsonb WHERE id = '2bd8a8b7-d803-578d-a440-2630901b94d5';
UPDATE public.exercises SET content = '{"options": ["um", "damit", "denn"], "question": "Die Lehrerin wiederholt den Satz, ___ wir ihn besser hören.", "explanation": {"de": "Um zu verwendet man bei gleichem Subjekt; damit erlaubt unterschiedliche Subjekte.", "ru": "«Um zu» используется при одном и том же подлежащем; «damit» позволяет использовать разные подлежащие.", "tr": "«Um zu» aynı özneyle kullanılır; «damit» ise farklı öznelere izin verir.", "en": "Use «um zu» with the same subject; «damit» allows different subjects.", "uk": "«Um zu» використовується при одному й тому ж підметі; «damit» дозволяє використовувати різні підмети."}, "correct_answer": "damit"}'::jsonb WHERE id = '2c801c17-25e3-5076-a445-96ed39dbc503';
UPDATE public.exercises SET content = '{"options": ["hast", "habe", "hat"], "smart_hint": {"de": "Haben: ich habe, du hast, er/sie hat, wir haben, ihr habt.", "ru": "Спряжение «haben»: ich habe, du hast, er/sie hat, wir haben, ihr habt.", "tr": "«Haben» (sahip olmak) fiilinin çekimi: ich habe, du hast, er/sie hat, wir haben, ihr habt.", "en": "Conjugation of «haben»: ich habe, du hast, er/sie hat, wir haben, ihr habt.", "uk": "Відмінювання «haben»: ich habe, du hast, er/sie hat, wir haben, ihr habt."}, "text_after": " heute Zeit.", "text_before": "Ich ", "correct_answer": "habe"}'::jsonb WHERE id = '2d01e815-960a-550c-a592-d0561e504bf5';
UPDATE public.exercises SET content = '{"options": ["sich", "er", "seiner"], "smart_hint": {"de": "Das Reflexivpronomen passt zum Subjekt: mich, dich, sich, uns, euch, sich.", "ru": "Возвратное местоимение согласуется с подлежащим: mich, dich, sich, uns, euch, sich.", "tr": "Dönüşlü zamir (Reflexivpronomen) özneye uyar: mich, dich, sich, uns, euch, sich.", "en": "The reflexive pronoun matches the subject: mich, dich, sich, uns, euch, sich.", "uk": "Зворотний займенник узгоджується з підметом: mich, dich, sich, uns, euch, sich."}, "text_after": " morgens.", "text_before": "Mein Vater rasiert ", "correct_answer": "sich"}'::jsonb WHERE id = '2d56b756-d1ea-543b-afa0-669f353fd6fe';
UPDATE public.exercises SET content = '{"options": ["sein", "sind", "ist"], "smart_hint": {"de": "Nach ob oder einem Fragewort steht das Verb am Ende der indirekten Frage.", "ru": "После «ob» или вопросительного слова глагол стоит в конце косвенного вопроса.", "tr": "«ob» veya bir soru kelimesinden sonra, fiil dolaylı sorunun (indirekte Frage) sonunda yer alır.", "en": "After «ob» or a question word, the verb goes at the end of the indirect question.", "uk": "Після «ob» або питального слова дієслово стоїть у кінці непрямого питання."}, "text_after": "?", "text_before": "Können Sie mir sagen, wo die Post ", "correct_answer": "ist"}'::jsonb WHERE id = '2d84b342-149e-5fad-a315-889d4c83c116';
UPDATE public.exercises SET content = '{"options": ["Zimmern", "Zimmer", "Zimmers"], "smart_hint": {"de": "Nach Zahlen größer als eins steht das Nomen im Plural.", "ru": "После числительных больше одного существительное стоит во множественном числе.", "tr": "Birden büyük sayılardan sonra isim çoğul halde kullanılır.", "en": "After numbers greater than one, the noun is in the plural.", "uk": "Після чисел більше одного іменник стоїть у множині."}, "text_after": ".", "text_before": "Die Wohnung hat drei ", "correct_answer": "Zimmer"}'::jsonb WHERE id = '2e1545c2-764e-59a1-a12c-5a1ee2e52792';
UPDATE public.exercises SET content = '{"options": ["muss", "müssen", "musst"], "smart_hint": {"de": "Nach einem Modalverb steht der Infinitiv am Satzende; die Personalform steht an Position zwei.", "ru": "После модального глагола инфинитив стоит в конце предложения; спрягаемый глагол находится на второй позиции.", "tr": "Modal fiilden sonra mastar (infinitiv) cümlenin sonunda yer alır; çekimli fiil ise ikinci pozisyondadır.", "en": "After a modal verb, the infinitive goes at the end of the sentence; the conjugated verb is in position two.", "uk": "Після модального дієслова інфінітив стоїть у кінці речення; відмінюване дієслово знаходиться на другій позиції."}, "text_after": " das Formular unterschreiben.", "text_before": "Du ", "correct_answer": "musst"}'::jsonb WHERE id = '2e8d59cc-08d0-59a6-a83c-9b5dbdd159f0';
UPDATE public.exercises SET content = '{"options": ["dich", "dir", "du"], "question": "Anna, wie geht es ___ heute?", "explanation": {"de": "Bei helfen, danken, gefallen und gehören steht ein Dativobjekt.", "ru": "С глаголами «helfen», «danken», «gefallen» и «gehören» требуется дополнение в дательном падеже (Dativ).", "tr": "«helfen», «danken», «gefallen» ve «gehören» fiillerinden sonra Dativ nesnesi kullanılır.", "en": "The verbs «helfen», «danken», «gefallen», and «gehören» take a dative object.", "uk": "З дієсловами «helfen», «danken», «gefallen» і «gehören» потрібен додаток у давальному відмінку (Dativ)."}, "correct_answer": "dir"}'::jsonb WHERE id = '2ea2e167-eb17-5294-ae86-1c808c434244';
UPDATE public.exercises SET content = '{"options": ["wir", "unser", "uns"], "question": "Wir brauchen Hilfe. Die Lehrerin erklärt ___ die Regel.", "explanation": {"de": "Bei helfen, danken, gefallen und gehören steht ein Dativobjekt.", "ru": "С глаголами «helfen», «danken», «gefallen» и «gehören» требуется дополнение в дательном падеже (Dativ).", "tr": "«helfen», «danken», «gefallen» ve «gehören» fiillerinden sonra Dativ nesnesi kullanılır.", "en": "The verbs «helfen», «danken», «gefallen», and «gehören» take a dative object.", "uk": "З дієсловами «helfen», «danken», «gefallen» і «gehören» потрібен додаток у давальному відмінку (Dativ)."}, "correct_answer": "uns"}'::jsonb WHERE id = '2f0eaca2-84da-52a3-a7a7-7ede89aaf705';
UPDATE public.exercises SET content = '{"options": ["erste", "ersten", "erster"], "question": "Am ___ Mai ist Feiertag.", "explanation": {"de": "Seit beschreibt einen Beginn bis heute, vor einen Zeitpunkt in der Vergangenheit und für eine Dauer.", "ru": "«Seit» указывает на начало действия, длящегося до сих пор, «vor» на момент в прошлом, а «für» на продолжительность.", "tr": "«Seit» bugüne kadar devam eden bir başlangıcı, «vor» geçmişteki bir anı, «für» ise bir süreyi ifade eder.", "en": "«Seit» describes a beginning until today, «vor» a point in time in the past, and «für» a duration.", "uk": "«Seit» вказує на початок дії, що триває досі, «vor» на момент у минулому, а «für» на тривалість."}, "correct_answer": "ersten"}'::jsonb WHERE id = '2fee1455-8f8b-5eaf-a3e5-5ce93670ec93';
UPDATE public.exercises SET content = '{"options": ["Wenn", "Als", "Ob"], "smart_hint": {"de": "Als beschreibt ein einmaliges Ereignis in der Vergangenheit, wenn Wiederholungen oder Bedingungen.", "ru": "«Als» описывает однократное событие в прошлом, «wenn» — повторяющиеся события или условия.", "tr": "«Als» geçmişteki tek seferlik bir olayı tanımlarken, «wenn» tekrarlanan olayları veya koşulları tanımlar.", "en": "«Als» describes a single event in the past, «wenn» describes repetitions or conditions.", "uk": "«Als» описує одноразову подію в минулому, «wenn» — повторювані події або умови."}, "text_after": " du Hilfe brauchst, ruf mich an.", "text_before": "", "correct_answer": "Wenn"}'::jsonb WHERE id = '3096f3c6-b2b4-5aee-a22b-4da0def6a6fe';
UPDATE public.exercises SET content = '{"options": ["noch", "sondern", "oder"], "smart_hint": {"de": "Zweiteilige Konnektoren haben feste Partner: sowohl … als auch, entweder … oder, weder … noch.", "ru": "Двойные союзы имеют устойчивые пары: sowohl … als auch, entweder … oder, weder … noch.", "tr": "İkili bağlaçların sabit partnerleri vardır: sowohl … als auch, entweder … oder, weder … noch.", "en": "Two-part connectors have fixed partners: sowohl … als auch, entweder … oder, weder … noch.", "uk": "Подвійні сполучники мають сталі пари: sowohl … als auch, entweder … oder, weder … noch."}, "text_after": " wir fahren ohne dich.", "text_before": "Entweder du kommst pünktlich, ", "correct_answer": "oder"}'::jsonb WHERE id = '30fdbd50-223a-571a-a24f-1cdc51bb5dca';
UPDATE public.exercises SET content = '{"options": ["die", "denen", "deren"], "smart_hint": {"de": "Der Kasus des Relativpronomens ergibt sich aus seiner Funktion im Relativsatz.", "ru": "Падеж относительного местоимения зависит от его функции в придаточном предложении.", "tr": "İlgi zamirinin hali (Kasus), ilgi cümlesindeki (Relativsatz) görevine göre belirlenir.", "en": "The case of the relative pronoun depends on its function in the relative clause.", "uk": "Відмінок відносного займенника залежить від його функції в підрядному реченні."}, "text_after": " ich vertraue.", "text_before": "Das sind die Kollegen, ", "correct_answer": "denen"}'::jsonb WHERE id = '316840fe-ec31-5fca-a1bc-1b6b7a9d2cc8';
UPDATE public.exercises SET content = '{"options": ["meldest", "melde", "melden"], "smart_hint": {"de": "Seitdem beschreibt einen Beginn, bis einen Endpunkt und sobald den unmittelbar folgenden Zeitpunkt.", "ru": "«Seitdem» описывает начало, «bis» — конечную точку, а «sobald» — непосредственно следующий момент.", "tr": "«Seitdem» bir başlangıcı, «bis» bir bitiş noktasını, «sobald» ise hemen ardından gelen anı ifade eder.", "en": "«Seitdem» describes a beginning, «bis» an endpoint, and «sobald» the immediately following moment.", "uk": "«Seitdem» описує початок, «bis» — кінцеву точку, а «sobald» — безпосередньо наступний момент."}, "text_after": " dich bitte.", "text_before": "Sobald du die Antwort weißt, ", "correct_answer": "melde"}'::jsonb WHERE id = '3239484b-aabd-57be-a16d-4e9d2a821ba1';
UPDATE public.exercises SET content = '{"options": ["könnte", "konnte", "können"], "smart_hint": {"de": "In der Vergangenheit: musste, konnte, wollte, durfte und sollte.", "ru": "В прошедшем времени: musste, konnte, wollte, durfte и sollte.", "tr": "Geçmiş zamanda: musste, konnte, wollte, durfte ve sollte.", "en": "In the past tense: musste, konnte, wollte, durfte, and sollte.", "uk": "У минулому часі: musste, konnte, wollte, durfte і sollte."}, "text_after": " ich noch nicht schwimmen.", "text_before": "Als Kind ", "correct_answer": "konnte"}'::jsonb WHERE id = '32df971d-2e52-5dc0-ac05-cc915e4d08f6';
UPDATE public.exercises SET content = '{"options": ["hört", "hören", "höre"], "smart_hint": {"de": "Bei Uhrzeiten steht um, bei Wochentagen am; das Verb richtet sich nach dem Subjekt.", "ru": "С указанием времени используется «um», с днями недели «am»; глагол согласуется с подлежащим.", "tr": "Saatlerde «um», haftanın günlerinde «am» kullanılır; fiil özneye göre çekimlenir.", "en": "For times, use «um», for days of the week use «am»; the verb agrees with the subject.", "uk": "Із зазначенням часу використовується «um», з днями тижня «am»; дієслово узгоджується з підметом."}, "text_after": " einen kurzen Dialog.", "text_before": "Wir ", "correct_answer": "hören"}'::jsonb WHERE id = '332ba820-5446-5a9d-a59d-6ac4b050af05';
UPDATE public.exercises SET content = '{"options": ["darauf", "davon", "dafür"], "smart_hint": {"de": "Da(r)- und wo(r)- ersetzen Präpositionen mit Sachen; vor Vokalen steht r.", "ru": "Формы на da(r)- и wo(r)- заменяют предлоги с неодушевленными предметами; перед гласными добавляется -r-.", "tr": "da(r)- ve wo(r)- edatların cansız nesnelerle kullanımının yerini alır; sesli harflerden önce araya -r- girer.", "en": "Da(r)- and wo(r)- forms replace prepositions with things; before vowels, an ''r'' is added.", "uk": "Форми на da(r)- і wo(r)- замінюють прийменники з неживими предметами; перед голосними додається -r-."}, "text_after": ".", "text_before": "Interessierst du dich für Kunst? – Ja, ich interessiere mich ", "correct_answer": "dafür"}'::jsonb WHERE id = '33aa0348-129d-5dfa-ab74-506f4dba0fe0';
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Add support for alternative answers (synonyms) in translations
ALTER TABLE public.vocabulary_cards
  ADD COLUMN alternative_answers_de text[] NOT NULL DEFAULT '{}'::text[];

-- Update the submit_vocabulary_answer RPC to check alternative answers
CREATE OR REPLACE FUNCTION vocabulary_private.submit_answer(p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  actor uuid := auth.uid(); progress public.vocabulary_direction_progress; card public.vocabulary_cards;
  profile public.profiles; previous_card uuid; prompt text; correct boolean; sentence boolean;
  old_phase integer; new_phase integer; new_box integer; days integer; difficult boolean;
  is_alternative boolean := false;
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
    IF NOT correct AND card.alternative_answers_de IS NOT NULL AND array_length(card.alternative_answers_de, 1) > 0 THEN
      IF coalesce(convert_to(p_typed_answer,'UTF8') = ANY (
           SELECT convert_to(alt, 'UTF8') FROM unnest(card.alternative_answers_de) alt
         ), false) THEN
        correct := true;
        is_alternative := true;
      END IF;
    END IF;
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
    || CASE WHEN sentence THEN jsonb_build_object('correctAnswer',card.context_sentence_de,'isAlternative',is_alternative) ELSE '{}'::jsonb END;
END;
$fn$;
REVOKE ALL ON FUNCTION vocabulary_private.submit_answer(uuid,boolean,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION vocabulary_private.submit_answer(uuid,boolean,text,text) TO authenticated;

COMMIT;
-- Auto-generated update script for alternative answers
BEGIN;

-- "Ich habe zwei Kinder." -> Ziffer vs. Wort
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Ich habe 2 Kinder.', 'Ich habe zwei Kinder.']::text[] WHERE id = '054dcd28-6231-4530-84fa-5130a5fe2bc8';

-- "Die Temperatur steigt..." -> Ziffer vs. Wort, °C, Plural/Singular
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Die Temperatur steigt auf 20 Grad.', 'Die Temperatur steigt auf zwanzig Grad.', 'Die Temperatur steigt auf 20 Grad Celsius.', 'Die Temperatur steigt auf 20 °C.', 'Die Temperaturen steigen auf 20 Grad.']::text[] WHERE id = '062ba7b1-099b-4d53-a42e-531b5d8dce6e';

-- "Die Miete kostet..." -> Ziffer vs. Wort, Euro-Zeichen, "pro Monat", Synonym "beträgt"
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Die Miete kostet 600 Euro im Monat.', 'Die Miete kostet 600 € im Monat.', 'Die Miete kostet sechshundert Euro im Monat.', 'Die Miete kostet 600 Euro pro Monat.', 'Die Miete beträgt 600 Euro im Monat.']::text[] WHERE id = '0751c7c0-997c-4fc2-99b0-478c796a08d0';

-- "Heute sind es minus 2 Grad." -> Ziffer vs. Wort, Synonym "hat es"
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Heute sind es -2 Grad.', 'Heute sind es minus 2 Grad.', 'Heute sind es minus zwei Grad.', 'Heute hat es -2 Grad.', 'Heute hat es minus 2 Grad.']::text[] WHERE id = '09beac3b-bde7-4c12-9b2a-632c46136d02';

-- "Das hast du super gemacht!" -> Gängige Lob-Synonyme im A1-Niveau
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Das hast du super gemacht!', 'Das hast du toll gemacht!', 'Das hast du sehr gut gemacht!', 'Das hast du klasse gemacht!']::text[] WHERE id = '09c21566-126b-49fb-9f1a-b653245fd580';

-- "Wie geht es dir?" -> Mit/Ohne Bindestrich, umgangssprachliche Verkürzung (SQL-Escape: '')
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Wie geht es dir? - Es geht.', 'Wie geht es dir? – Es geht.', 'Wie geht es dir? Es geht.', 'Wie geht''s dir? - Es geht.', 'Wie geht''s? - Es geht.']::text[] WHERE id = '0f88b902-7e86-47f2-b977-9f50e15f601f';

-- "Der Unterricht beginnt..." -> Ziffer vs. Wort, Synonym "fängt an", Synonym "startet"
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Der Unterricht beginnt um 9 Uhr.', 'Der Unterricht beginnt um neun Uhr.', 'Der Unterricht fängt um 9 Uhr an.', 'Der Unterricht fängt um neun Uhr an.', 'Der Unterricht startet um 9 Uhr.']::text[] WHERE id = '1037a031-34eb-4699-b40a-254676c2c17b';

-- "Ich lese gern." -> gern vs. gerne (beides 100% gleichwertig)
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Ich lese gern.', 'Ich lese gerne.']::text[] WHERE id = '11a55dd5-4e89-49d5-bda0-bb976072d5c3';

-- "Wo lebt deine Familie?" -> Mit/Ohne Bindestrich, Synonym "wohnt"
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Wo lebt deine Familie? - Meine Familie lebt in Berlin.', 'Wo lebt deine Familie? – Meine Familie lebt in Berlin.', 'Wo lebt deine Familie? Meine Familie lebt in Berlin.', 'Wo wohnt deine Familie? - Meine Familie wohnt in Berlin.']::text[] WHERE id = '14b46a4e-cf6d-4c35-bd90-ec926482c11e';

-- "Meine Tochter ist 14 Jahre alt." -> Ziffer vs. Wort, weglassen von "Jahre alt"
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Meine Tochter ist 14 Jahre alt.', 'Meine Tochter ist vierzehn Jahre alt.', 'Meine Tochter ist 14.']::text[] WHERE id = '17b37259-9cc4-41fe-b9a5-71befcd9fdb3';

-- "Meine Tochter ist 18 Jahre alt." -> Ziffer vs. Wort, weglassen von "Jahre alt"
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Meine Tochter ist 18 Jahre alt.', 'Meine Tochter ist achtzehn Jahre alt.', 'Meine Tochter ist 18.']::text[] WHERE id = '182603e5-d4e9-4741-ba04-eaaf1685d686';

-- "Wer ist das?" -> Mit/Ohne Bindestrich
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Wer ist das? - Das ist meine Schwester.', 'Wer ist das? – Das ist meine Schwester.', 'Wer ist das? Das ist meine Schwester.']::text[] WHERE id = '2aa2d6e5-3c47-4e0c-b425-2b365f8cd1a9';

-- "Wir sind 4 Personen." -> Ziffer vs. Wort, Synonym "Leute"
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Wir sind 4 Personen.', 'Wir sind vier Personen.', 'Wir sind 4 Leute.', 'Wir sind vier Leute.']::text[] WHERE id = '2b5181e7-3471-4f3d-8696-cd994f99aff4';

-- "Der Supermarkt ist geöffnet." -> Ziffer vs. Wort, 20 Uhr (Standard für 8 PM), Synonym "hat auf"
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Der Supermarkt ist bis 8 Uhr geöffnet.', 'Der Supermarkt ist bis acht Uhr geöffnet.', 'Der Supermarkt ist bis 20 Uhr geöffnet.', 'Der Supermarkt hat bis 8 Uhr auf.', 'Der Supermarkt hat bis 20 Uhr auf.']::text[] WHERE id = '343df964-9479-4004-8124-f8bfdcbd627b';

-- "Der Kurs beginnt..." -> Ziffer vs. Wort, Synonym "fängt an", Synonym "startet"
UPDATE vocabulary_cards SET alternative_answers_de = ARRAY['Der Kurs beginnt um 8 Uhr.', 'Der Kurs beginnt um acht Uhr.', 'Der Kurs fängt um 8 Uhr an.', 'Der Kurs fängt um acht Uhr an.', 'Der Kurs startet um 8 Uhr.']::text[] WHERE id = '38841dcc-f2dd-4a39-8858-610a12fd14b3';

COMMIT;
-- Add allowed_lessons to student_trainer_access
ALTER TABLE public.student_trainer_access ADD COLUMN allowed_lessons text[];

-- Add lesson to pronunciation_prompts
ALTER TABLE public.pronunciation_prompts ADD COLUMN lesson text NOT NULL DEFAULT 'Lektion 1';
BEGIN;
ALTER TABLE public.pronunciation_prompts ADD COLUMN IF NOT EXISTS lesson text NOT NULL DEFAULT 'Lektion 1';

UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'In der Bibliothek',
    sentence_de = 'Ich möchte mehr auf Deutsch lesen. Deshalb gehe ich heute in die Bibliothek. Eine Mitarbeiterin erklärt mir die Anmeldung. Ich brauche meinen Ausweis und bekomme eine Karte. Im ersten Stock finde ich leichte Bücher. Ich nehme eine kurze Geschichte mit vielen Bildern. Das Buch darf ich vier Wochen behalten. Nächste Woche möchte ich wiederkommen.',
    focus = 'b und ch; Fragesätze',
    level = 'A1.2',
    is_active = true
WHERE id = '0022c931-279a-5050-ac2d-459c1e978cd1';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Ein Ausflug mit dem Zug',
    sentence_de = 'Morgen besuchen wir meine Schwester in Bremen. Unser Zug fährt um halb zehn. Wir müssen früh aufstehen und die Taschen packen. Am Bahnhof kaufen wir noch ein Brötchen. Auf der Anzeige steht Gleis sieben. Im Zug sitzen wir am Fenster. Meine Schwester wartet am Bahnhof auf uns. Zusammen fahren wir mit der Straßenbahn zu ihr.',
    focus = 'z und ü; Zahlen und Uhrzeiten',
    level = 'A1.2',
    is_active = true
WHERE id = '00cedd4e-cf66-50ae-a181-e687d85a8379';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Trotz des Regens sind wir spazieren gegangen.',
    focus = 'z, sp',
    level = NULL,
    is_active = true
WHERE id = '019a0ef2-442d-47a9-b86c-fc178b4fc4b3';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Im Sommer fahren wir an die Ostsee.',
    focus = 'mm, ee',
    level = NULL,
    is_active = true
WHERE id = '07aaf833-aab7-4d0f-b72c-2b297e171aa6';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Die Nachbarin hat uns freundlich begrüßt.',
    focus = 'ü, ch',
    level = NULL,
    is_active = true
WHERE id = '097028ac-b5d8-4593-a43a-0fd616d5e6c5';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Kannst du mir bitte helfen?',
    focus = 'st, pf',
    level = NULL,
    is_active = true
WHERE id = '0aaf91a8-42bf-450b-b102-df4b12041ba6';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Wir treffen uns um halb vier vor dem Kino.',
    focus = 'pf, v',
    level = NULL,
    is_active = true
WHERE id = '0cbd4341-00e1-4e88-9105-45d4cccf18ec';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Wenn ich Zeit hätte, würde ich öfter ins Theater gehen.',
    focus = 'ö, ü',
    level = NULL,
    is_active = true
WHERE id = '102a494c-742e-4542-a164-98dc03ea03d1';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Ich habe zwei Brüder.',
    focus = 'ü, zwei',
    level = NULL,
    is_active = true
WHERE id = '1034cfa4-069d-460c-ab95-40be39989166';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Warum ich mich ehrenamtlich engagiere',
    sentence_de = 'Einmal pro Woche helfe ich in einer kleinen Fahrradwerkstatt, die von Freiwilligen organisiert wird. Dort unterstützen wir Menschen dabei, ihre Räder selbst zu reparieren. Als ich damit angefangen habe, wollte ich vor allem meine handwerklichen Kenntnisse nutzen. Inzwischen schätze ich besonders die Gespräche mit Menschen, denen ich sonst kaum begegnen würde. Nicht jeder Termin verläuft einfach: Manchmal fehlen Teile, manchmal braucht eine Erklärung viel Geduld. Trotzdem gehe ich meistens zufrieden nach Hause. Ich sehe unmittelbar, dass meine Zeit jemandem geholfen hat. Gleichzeitig lerne ich selbst weiter. Ehrenamt bedeutet für mich deshalb nicht nur, etwas zu geben, sondern auch Erfahrungen und neue Perspektiven zu gewinnen.',
    focus = 'eh und ge; persönliche Haltung',
    level = 'B1.2',
    is_active = true
WHERE id = '13264420-65a8-54f1-984e-b001a5244341';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Im kleinen Laden',
    sentence_de = 'Ich bin im Laden. Ich brauche Milch, Brot und drei Äpfel. Die Verkäuferin ist freundlich. Sie zeigt mir das Brot. Es kostet zwei Euro. Ich nehme auch Wasser. Dann bezahle ich und sage danke. Meine Tasche ist jetzt voll.',
    focus = 'ä und ch; Zahlen',
    level = 'A1.1',
    is_active = true
WHERE id = '15c29bec-e14e-5f27-8f12-ea9e45145e97';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Eine Reklamation im Geschäft',
    sentence_de = 'Vor zwei Wochen habe ich neue Schuhe gekauft. Schon nach wenigen Tagen hat sich an einem Schuh die Sohle gelöst. Deshalb bin ich mit den Schuhen und dem Kassenbon ins Geschäft gegangen. Ich habe der Verkäuferin ruhig erklärt, was passiert ist. Sie hat die Schuhe geprüft und eine Kollegin dazugeholt. Leider war meine Größe nicht mehr da. Wir haben vereinbart, dass das Geschäft mich anruft, sobald ein neues Paar ankommt. Die freundliche Lösung hat mich erleichtert.',
    focus = 'k und r; sachlicher Ton',
    level = 'A2.2',
    is_active = true
WHERE id = '194df28b-7175-5ffa-9813-2c5967cc2cb9';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Ein neuer Beruf als Chance',
    sentence_de = 'Nachdem ich viele Jahre im Verkauf gearbeitet hatte, wollte ich beruflich etwas Neues ausprobieren. Besonders die Arbeit mit älteren Menschen interessierte mich. Deshalb habe ich mich über eine Ausbildung im Pflegebereich informiert. Die Beratung war hilfreich, trotzdem hatte ich Zweifel: Würde mein Deutsch für den Unterricht ausreichen? Eine Beraterin empfahl mir ein Praktikum. Dort merkte ich, dass ich vieles verstehen konnte und bei Unklarheiten nachfragen durfte. Jetzt bereite ich meine Bewerbung vor. Der Wechsel wird bestimmt anstrengend, aber ich möchte es versuchen. Für mich bedeutet Lernen auch, neue Möglichkeiten zu entdecken.',
    focus = 'b und ch; längere Satzbögen',
    level = 'B1.1',
    is_active = true
WHERE id = '19846618-a6c3-5001-84d5-06b21b99dff5';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Ein Termin beim Arzt',
    sentence_de = 'Seit gestern tut mein Hals weh. Ich rufe in der Praxis an und möchte einen Termin machen. Die Mitarbeiterin fragt nach meinem Namen. Ich buchstabiere ihn langsam. Am Nachmittag ist ein Termin frei. Ich kann um drei Uhr kommen. Meine Versichertenkarte nehme ich mit. Danach bleibe ich zu Hause und trinke warmen Tee.',
    focus = 'ch und ts; höfliche Fragen',
    level = 'A1.2',
    is_active = true
WHERE id = '1b5c02d4-7217-56e0-8abb-906c20784e30';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Ein freiwilliger Einsatz',
    sentence_de = 'In unserem Stadtteil wurde am Samstag Müll gesammelt. Ich habe durch einen Aushang davon erfahren und mich angemeldet. Am Treffpunkt bekamen wir Handschuhe und große Säcke. Eine Organisatorin erklärte, welche Wege wir sauber machen sollten. Ich war mit einer älteren Frau in einer Gruppe. Während wir arbeiteten, erzählte sie mir viel über den Stadtteil. Nach zwei Stunden waren die Wege deutlich sauberer. Zum Schluss gab es Suppe für alle. Beim nächsten Mal möchte ich wieder mithelfen.',
    focus = 'f und ei; flüssige Aufzählungen',
    level = 'A2.2',
    is_active = true
WHERE id = '1c914afb-1958-5045-bda2-d609de2bd365';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Weil ich krank war, habe ich den Kurs verpasst.',
    focus = 'ei, st',
    level = NULL,
    is_active = true
WHERE id = '1f556d80-56c6-400f-9338-e3cef079e58a';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Ich möchte einen Termin beim Arzt machen.',
    focus = 'ö, ch',
    level = NULL,
    is_active = true
WHERE id = '222ec2dd-9312-4716-bdd5-b5d0f96997e3';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Unser Kursraum',
    sentence_de = 'Das ist unser Kursraum. Er ist hell und groß. Hier stehen zwölf Stühle und sechs Tische. An der Wand ist eine Tafel. Mein Heft liegt auf dem Tisch. Die Lehrerin kommt und sagt guten Morgen. Jetzt beginnt unser Deutschkurs.',
    focus = 'sch und lange Vokale',
    level = 'A1.1',
    is_active = true
WHERE id = '25bdcac1-9272-5294-893f-c2063b4838b9';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Eine kleine Reise allein',
    sentence_de = 'Zum ersten Mal seit vielen Jahren bin ich allein für ein Wochenende verreist. Ich hatte mir eine kleine Stadt ausgesucht, die gut mit dem Zug erreichbar war. Zuerst fand ich es ungewohnt, alle Entscheidungen selbst zu treffen. Niemand fragte, wann wir essen oder welches Museum wir besuchen wollten. Nach einigen Stunden begann ich, diese Freiheit zu genießen. In einem Café kam ich mit einer anderen Reisenden ins Gespräch. Wir tauschten Tipps aus und gingen dann wieder eigene Wege. Zu Hause freute ich mich auf meine Familie. Trotzdem möchte ich eine solche Reise gern wiederholen.',
    focus = 'ei und r; Erzähltempo variieren',
    level = 'B1.1',
    is_active = true
WHERE id = '2824e504-aef5-5a89-9290-aa72f1d42342';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Wer Widersprüche aushält, gewinnt an sprachlicher Souveränität.',
    focus = 'ch, ä',
    level = NULL,
    is_active = true
WHERE id = '2bd081e1-bae3-4c4f-870c-6c4c3548bf72';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Ein Paket für die Nachbarin',
    sentence_de = 'Als ich gestern nach Hause kam, klingelte der Paketbote. Meine Nachbarin war nicht da, und ich habe ihr Paket angenommen. Am Abend habe ich einen Zettel an ihre Tür gehängt. Darauf stand, dass sie bei mir klingeln kann. Eine Stunde später kam sie vorbei. In dem Paket waren Bücher für ihre Tochter. Wir haben kurz über die Schule gesprochen. Zum Dank hat sie mich am Wochenende zum Kaffee eingeladen.',
    focus = 'p und k; Satzglieder verbinden',
    level = 'A2.1',
    is_active = true
WHERE id = '2c6b8ac4-28e2-556d-950e-9937d7da0da9';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Die Diskussion hat gezeigt, dass beide Seiten berechtigte Einwände haben.',
    focus = 'sch, ä',
    level = NULL,
    is_active = true
WHERE id = '2ce832d8-6380-4de4-a890-854fa8ea4ede';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Sie spricht schnell, aber sehr deutlich.',
    focus = 'ch, eu',
    level = NULL,
    is_active = true
WHERE id = '2eb5d5ed-ec4f-41f9-89f0-6c1d4481630d';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Die Anmeldung im Verein',
    sentence_de = 'Ich möchte in einem Verein Fußball spielen und habe mich im Internet informiert. Ein Verein in meiner Nähe bietet ein kostenloses Probetraining an. Ich habe eine E-Mail geschrieben und nach der Uhrzeit gefragt. Der Trainer hat schnell geantwortet. Ich soll Sportschuhe und etwas zu trinken mitbringen. Am Donnerstag gehe ich zum ersten Mal hin. Ein Freund begleitet mich, weil er auch gern Fußball spielt. Wir freuen uns auf das Training.',
    focus = 'ng und ei; höfliche Bitten',
    level = 'A2.1',
    is_active = true
WHERE id = '2f3b292b-8bdb-5007-90cb-278f9c00fc02';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Ein Konflikt mit einem Nachbarn',
    sentence_de = 'Über mehrere Wochen hörte ich spät am Abend laute Musik aus der Nachbarwohnung. Zunächst ärgerte ich mich nur und erzählte anderen davon. Als ich schließlich an der Tür klingelte, versuchte ich bewusst, ruhig zu bleiben. Ich erklärte, wann ich schlafen muss und wie die Musik mich dabei stört. Mein Nachbar war überrascht, weil er nicht wusste, wie deutlich man die Bässe durch die Wand hört. Wir vereinbarten, dass er ab einer bestimmten Uhrzeit Kopfhörer benutzt. Seitdem hat sich die Situation verbessert. Das Gespräch war mir vorher unangenehm, doch es hat mehr bewirkt als meine stillen Vorwürfe. Manchmal fehlt der anderen Person einfach eine wichtige Information.',
    focus = 'ch und kn; respektvoller Ton',
    level = 'B1.2',
    is_active = true
WHERE id = '2fa06ffd-6b82-5386-9c84-a4320c87bbc7';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Letztes Jahr habe ich zum ersten Mal allein verreist.',
    focus = 'z, ei',
    level = NULL,
    is_active = true
WHERE id = '3120ad4c-474f-4e8e-81f8-53d0f3ece4f0';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Wo ist die Toilette?',
    focus = 'ie, tt',
    level = NULL,
    is_active = true
WHERE id = '323ff85f-a44b-45c0-91ef-e29db86d70e3';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Ein Gespräch über Arbeitszeiten',
    sentence_de = 'Seit meine Tochter in die Schule geht, passen meine Arbeitszeiten nicht mehr gut zu unserem Alltag. Deshalb habe ich meine Chefin um ein Gespräch gebeten. Ich habe erklärt, dass ich am Nachmittag früher zu Hause sein muss. Dafür könnte ich morgens eine Stunde früher anfangen. Meine Chefin wollte zuerst mit dem Team sprechen. Einige Tage später hat sie meinem Vorschlag zugestimmt. Wir probieren die neue Regelung zunächst für einen Monat aus. Ich bin froh, dass ich offen über mein Problem gesprochen habe.',
    focus = 'ts und ei; Wünsche betonen',
    level = 'A2.2',
    is_active = true
WHERE id = '3243b764-4bfc-5fc6-8c24-1a49962988ff';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Ich habe gestern einen interessanten Film gesehen.',
    focus = 'g, ie',
    level = NULL,
    is_active = true
WHERE id = '35f0cd78-5976-4d2f-9989-b7e13e6d3d42';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Die Aussprache klappt besser, wenn man langsam und klar spricht.',
    focus = 'ch, a',
    level = NULL,
    is_active = true
WHERE id = '3bb26602-5c78-42e9-ae9b-69d84d83db6c';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Guten Tag, ich heiße Anna.',
    focus = 'ie, ch',
    level = NULL,
    is_active = true
WHERE id = '3bd21f93-bb07-48d0-8242-fc9c4d1fc1b4';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Sport nach der Arbeit',
    sentence_de = 'Seit einem Monat besuche ich einen Sportkurs im Stadtteilzentrum. Der Kurs findet immer mittwochs nach meiner Arbeit statt. Am Anfang waren die Übungen ziemlich anstrengend. Jetzt kann ich schon länger mitmachen. Die Trainerin zeigt jede Bewegung langsam und erklärt sie noch einmal. In der Gruppe sind Menschen aus verschiedenen Ländern. Nach dem Training trinken wir manchmal zusammen Wasser und unterhalten uns. Ich bewege mich mehr und lerne dabei neue Leute kennen.',
    focus = 'sp und st; längere Wortgruppen',
    level = 'A2.1',
    is_active = true
WHERE id = '3dfcf736-84e5-599d-a492-b780ffc491c4';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Ich stehe um sieben Uhr auf.',
    focus = 'st, ie',
    level = NULL,
    is_active = true
WHERE id = '4197d999-031e-48a9-8a23-e2cfcbea2b48';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Ich möchte einen Tee, bitte.',
    focus = 'ö, ch',
    level = NULL,
    is_active = true
WHERE id = '4204340a-094d-4936-ac91-813b2b8ba38f';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Es bedarf einer differenzierten Betrachtung, um vorschnelle Schlüsse zu vermeiden.',
    focus = 'z, sch',
    level = NULL,
    is_active = true
WHERE id = '424d0372-11ad-4e97-ac5f-58cb96193db4';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Ein Haustier auf Zeit',
    sentence_de = 'Unsere Freunde sind für eine Woche verreist und haben uns gebeten, auf ihre Katze aufzupassen. Jeden Morgen bin ich in ihre Wohnung gegangen. Ich habe frisches Wasser hingestellt, Futter gegeben und das Katzenklo sauber gemacht. Am ersten Tag hat sich die Katze unter dem Sofa versteckt. Nach einigen Tagen kam sie schon zur Tür, wenn sie mich hörte. Ich habe unseren Freunden ein Foto geschickt, damit sie sich keine Sorgen machen. Als sie zurückkamen, war die Katze trotzdem am glücklichsten.',
    focus = 'au und sch; Erzählrhythmus',
    level = 'A2.2',
    is_active = true
WHERE id = '4533b44b-4ec1-5147-8a69-3345d5df7933';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Der Vortrag war zwar anspruchsvoll, aber äußerst lehrreich.',
    focus = 'äu, ch',
    level = NULL,
    is_active = true
WHERE id = '456ac6dd-0a9a-4549-a5ae-9472d49166d0';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Ein ruhiger Abend',
    sentence_de = 'Es ist Abend. Ich bin zu Hause. Mein Handy liegt auf dem Tisch. Heute lese ich ein kleines Buch. Meine Katze schläft auf dem Sofa. Ich trinke Wasser und höre leise Musik. Um zehn Uhr gehe ich ins Bett. Gute Nacht!',
    focus = 'au und ng; gleichmäßiges Tempo',
    level = 'A1.1',
    is_active = true
WHERE id = '4a6f7008-9439-5c6e-9d60-113e8945f800';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Die Nuancen der deutschen Satzmelodie entscheiden über Höflichkeit und Distanz.',
    focus = 'z, ch',
    level = NULL,
    is_active = true
WHERE id = '4c27f103-769a-4461-ada9-8e3382a7a842';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Die Entscheidung für einen Kurs',
    sentence_de = 'Ich möchte mich beruflich weiterentwickeln und suche einen Computerkurs. Im Internet habe ich zwei passende Angebote gefunden. Ein Kurs findet am Wochenende statt, der andere an zwei Abenden in der Woche. Obwohl der Abendkurs günstiger ist, habe ich mich für den Wochenendkurs entschieden. Nach der Arbeit bin ich oft zu müde, um konzentriert zu lernen. Vor der Anmeldung habe ich gefragt, ob man einen eigenen Laptop braucht. Das ist zum Glück nicht nötig. Die Schule stellt Geräte zur Verfügung.',
    focus = 'ü und ei; Gründe klar gliedern',
    level = 'A2.2',
    is_active = true
WHERE id = '4c550a8b-95b1-5a53-ac3c-b2ad48ea592d';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Ich habe mich über die Nachricht sehr gefreut.',
    focus = 'ü, eu',
    level = NULL,
    is_active = true
WHERE id = '4e268b91-594d-46d7-8efd-52a78993f2fb';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Wir treffen uns nach der Arbeit.',
    focus = 'ff, ei',
    level = NULL,
    is_active = true
WHERE id = '4e3b7ef5-33e5-4a77-a760-7311b0f4e994';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Wo ist der Bahnhof, bitte?',
    focus = 'ch, hof',
    level = NULL,
    is_active = true
WHERE id = '4e46055a-9c81-45d8-a9ac-576db7d1bb48';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Je genauer man zuhört, desto besser versteht man die Melodie.',
    focus = 'au, ie',
    level = NULL,
    is_active = true
WHERE id = '4ea55be0-669d-484a-8786-0d63937efa42';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Unser gemeinsamer Innenhof',
    sentence_de = 'Der Innenhof unseres Hauses war lange leer und ungemütlich. Bei einem Treffen haben wir Nachbarn überlegt, wie wir ihn verändern könnten. Einige wollten Blumen pflanzen, andere wünschten sich eine Bank. Gemeinsam haben wir einen Plan gemacht und beim Vermieter nachgefragt. Nachdem er zugestimmt hatte, haben wir an einem Samstag alles vorbereitet. Jeder hat eine kleine Aufgabe übernommen. Jetzt sitzen wir abends oft draußen. Der Hof ist schöner geworden, und wir kennen uns im Haus viel besser.',
    focus = 'h und ö; Gegensätze hörbar machen',
    level = 'A2.2',
    is_active = true
WHERE id = '51347d93-a3a8-50aa-811e-4ea2816386f9';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Ein sicherer Umgang mit Nachrichten',
    sentence_de = 'In einer Chatgruppe bekam ich eine Nachricht über eine angebliche Änderung bei unseren Kurszeiten. Viele Teilnehmende waren sofort beunruhigt. Bevor ich die Nachricht weiterleitete, schaute ich auf der Webseite der Schule nach. Dort stand nichts dazu. Ich rief im Büro an und erfuhr, dass es sich um eine alte Information handelte. Anschließend schrieb ich eine kurze Erklärung in die Gruppe. Die Situation hat mir gezeigt, wie schnell Missverständnisse entstehen können. Heute prüfe ich wichtige Nachrichten lieber einmal mehr. Dabei helfen mir das Datum, die Quelle und eine direkte Nachfrage bei der zuständigen Stelle.',
    focus = 'ng und ch; sachlich erklären',
    level = 'B1.1',
    is_active = true
WHERE id = '525d59e3-5cad-543c-820a-b9316809645f';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Wir wohnen in einer kleinen Wohnung.',
    focus = 'ö, w',
    level = NULL,
    is_active = true
WHERE id = '53ed7ada-e377-4895-b5ef-453e73a771a2';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Ich bin der Meinung, dass Sport den Alltag erleichtert.',
    focus = 'ng, ch',
    level = NULL,
    is_active = true
WHERE id = '5828cfc4-1aa0-4b47-9b5c-6103dc3253ab';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Eine Wohnung besichtigen',
    sentence_de = 'Wir suchen eine neue Wohnung. Unsere Wohnung ist zu klein. Heute sehen wir uns eine Wohnung in der Nordstraße an. Sie hat drei Zimmer und einen Balkon. Die Küche ist hell. Neben dem Haus ist ein Spielplatz. Die Miete ist für uns etwas hoch. Wir möchten noch eine Nacht darüber schlafen und morgen anrufen.',
    focus = 'w und ü; sinnvolle Pausen',
    level = 'A1.2',
    is_active = true
WHERE id = '5b3316e2-4a9f-5689-ba11-e5d0dc420f2b';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Eins, zwei, drei, vier.',
    focus = 'ei, z',
    level = NULL,
    is_active = true
WHERE id = '5d3949c3-ba44-4c93-b767-e9d23735c517';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Ein bewusster Umgang mit Bewertungen',
    sentence_de = 'Bevor ich einen Kurs buche oder ein Gerät kaufe, lese ich häufig Bewertungen im Internet. Früher habe ich mich vor allem an der Zahl der Sterne orientiert. Heute schaue ich genauer hin. Mich interessiert, ob jemand konkrete Erfahrungen beschreibt und ob die Bewertung zu meinen eigenen Erwartungen passt. Ein Kurs kann für Anfänger hilfreich und für Fortgeschrittene zu langsam sein. Auch das Datum spielt eine Rolle, denn Angebote können sich verändern. Einzelne sehr positive oder negative Kommentare entscheiden deshalb nicht allein über meine Wahl. Bewertungen sind für mich eine erste Orientierung. Wenn eine Entscheidung wichtig ist, suche ich zusätzliche Informationen oder frage direkt beim Anbieter nach.',
    focus = 'b und w; Einschränkungen betonen',
    level = 'B1.2',
    is_active = true
WHERE id = '5dc0cf34-6f7c-5e67-9728-22bbe90c5dc7';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Das ist mein Freund.',
    focus = 'eu, nd',
    level = NULL,
    is_active = true
WHERE id = '5df41b67-37f0-422b-ae27-d92e9816141c';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Ein Rezept von meiner Mutter',
    sentence_de = 'Meine Mutter hat mir am Telefon ein einfaches Rezept erklärt. Ich wollte einen Apfelkuchen backen, hatte aber wenig Erfahrung. Zuerst habe ich die Zutaten aufgeschrieben und alles eingekauft. Dann habe ich den Teig vorbereitet. Während der Kuchen im Ofen war, habe ich die Küche aufgeräumt. Nach vierzig Minuten roch die ganze Wohnung nach Äpfeln. Der Kuchen war etwas dunkel, hat aber gut geschmeckt. Meiner Mutter habe ich ein Foto geschickt.',
    focus = 'r und ch; Reihenfolge hörbar machen',
    level = 'A2.1',
    is_active = true
WHERE id = '5ec73679-e979-5ef6-bbac-8d14af8d2651';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Es kommt darauf an, wie gründlich man sich vorbereitet.',
    focus = 'ü, ch',
    level = NULL,
    is_active = true
WHERE id = '5ed1b469-33a6-40e6-ac9c-db6fa54eaf07';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Meine Familie',
    sentence_de = 'Das ist ein Foto von meiner Familie. Meine Mutter heißt Maria. Sie kocht gern. Mein Vater heißt Oleg. Er hört gern Musik. Meine Schwester ist zwanzig Jahre alt. Sie lernt Deutsch wie ich. Wir telefonieren oft und lachen viel.',
    focus = 'ie und ö; Namen deutlich sprechen',
    level = 'A1.1',
    is_active = true
WHERE id = '610e3f81-2a6f-5794-bb78-ef06cb7ece17';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Sie argumentierte schlüssig, ohne den Gegenüber bloßzustellen.',
    focus = 'sch, ü',
    level = NULL,
    is_active = true
WHERE id = '622150d7-250d-4dac-bdf3-a932636ae0f1';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Bitte sprechen Sie etwas langsamer.',
    focus = 'ch, er',
    level = NULL,
    is_active = true
WHERE id = '627e0ac7-7dac-4935-a5b2-cf42e073eeac';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Heute ist das Wetter schön.',
    focus = 'ö, eu',
    level = NULL,
    is_active = true
WHERE id = '635abd7e-b429-4226-ab80-3632c67222a8';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Wer Stil beherrscht, kann auch Schweigen beredt machen.',
    focus = 'sch, ch',
    level = NULL,
    is_active = true
WHERE id = '65f3ddae-71fe-47a2-867c-454c4a8e0411';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Wir haben uns lange über das Thema unterhalten.',
    focus = 'th, h',
    level = NULL,
    is_active = true
WHERE id = '66f45951-dc65-40c1-8162-20ded51355d0';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Der Zug hat zehn Minuten Verspätung.',
    focus = 'z, ä',
    level = NULL,
    is_active = true
WHERE id = '675e3ad2-81cd-464a-986c-90bf88210ea3';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Ich würde vorschlagen, die Übung noch einmal zu machen.',
    focus = 'ü, sch',
    level = NULL,
    is_active = true
WHERE id = '67dcd417-f530-4d0d-82ea-05974598d3a2';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Es fällt mir schwer, vor vielen Menschen zu sprechen.',
    focus = 'sch, ch',
    level = NULL,
    is_active = true
WHERE id = '680d972b-8506-4425-a571-1e9edb3bf690';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Man sollte nicht voreilig urteilen, bevor alle Fakten da sind.',
    focus = 'ei, g',
    level = NULL,
    is_active = true
WHERE id = '6839aa5b-c23e-4f62-a2fb-578c8eb6148e';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Wem gehört der öffentliche Raum?',
    sentence_de = 'Auf dem Platz vor unserer Bibliothek treffen sich abends häufig Jugendliche. Einige Anwohner fühlen sich durch die Gespräche und die Musik gestört. Andere finden, dass junge Menschen einen Ort brauchen, an dem sie kostenlos zusammenkommen können. Bei einem Treffen im Stadtteilzentrum wurden beide Seiten angehört. Die Jugendlichen erklärten, dass es in der Nähe kaum Angebote für sie gibt. Gemeinsam wurden feste Ruhezeiten und ein zusätzlicher Treffpunkt vorgeschlagen. Noch sind nicht alle zufrieden, aber das Gespräch war ein Anfang. Für mich zeigt die Situation, dass öffentlicher Raum unterschiedliche Bedürfnisse erfüllen muss. Dauerhafte Lösungen entstehen eher durch klare Regeln und Beteiligung als durch gegenseitige Vorwürfe.',
    focus = 'r und ö; verschiedene Sichtweisen',
    level = 'B1.2',
    is_active = true
WHERE id = '6b4676fc-7a16-51d6-8c1c-4b5da00ffaf2';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Guten Tag, das bin ich',
    sentence_de = 'Guten Tag, ich heiße Anna. Ich komme aus Polen und wohne jetzt in Hannover. Ich bin dreißig Jahre alt. Meine Familie ist klein. Mein Mann heißt Paul. Wir lernen zusammen Deutsch. Am Abend trinken wir Tee und lesen ein Buch.',
    focus = 'ie und ch; kurze Satzpausen',
    level = 'A1.1',
    is_active = true
WHERE id = '6d2f8e95-6f87-510b-b244-0631733f8ff9';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Die Einladung',
    sentence_de = 'Nächste Woche habe ich Geburtstag. Ich möchte mit meinen Nachbarn feiern. Die Feier beginnt am Samstag um vier Uhr. Ich schreibe eine kurze Einladung und lege sie in ihre Briefkästen. Jeder kann etwas zu essen mitbringen. Ich kaufe Getränke und backe einen Kuchen. Wir können im Garten sitzen. Bei Regen feiern wir in meiner Wohnung.',
    focus = 'ei und ü; Betonung von Zeitangaben',
    level = 'A1.2',
    is_active = true
WHERE id = '6e15b015-d482-58e4-9fa2-25ba0c8dea72';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Was Erfolg beim Sprachenlernen bedeutet',
    sentence_de = 'Vor einem Jahr hätte ich Erfolg beim Deutschlernen vor allem an einer guten Prüfungsnote gemessen. Heute denke ich auch an viele kleine Situationen: ein verständliches Telefonat, ein Gespräch mit der Lehrerin meines Kindes oder eine Frage bei der Arbeit. Solche Erlebnisse zeigen mir, dass ich die Sprache tatsächlich nutzen kann. Natürlich möchte ich meine Grammatik und Aussprache weiter verbessern. Trotzdem versuche ich, meinen Fortschritt nicht ständig mit dem anderer Menschen zu vergleichen. Jeder bringt andere Erfahrungen mit und hat unterschiedlich viel Zeit. Mein nächstes Ziel ist, in einer Besprechung meine Meinung klar zu erklären. Es ist ein kleines Ziel, aber für meinen Alltag ein bedeutender Schritt.',
    focus = 'ch und spr; abschließende Gedanken',
    level = 'B1.2',
    is_active = true
WHERE id = '6e667abd-3011-597c-9cf9-0c20c2c30e2d';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Nur wer die Satzmelodie beherrscht, klingt wirklich idiomatisch.',
    focus = 'ch, t',
    level = NULL,
    is_active = true
WHERE id = '6f6d08ed-0452-43e5-ba44-70c8cae98fb3';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Es ist bezeichnend, wie ein einziges Modalpartikel den ganzen Satz kippt.',
    focus = 'ch, z',
    level = NULL,
    is_active = true
WHERE id = '6fd5a400-4689-440f-82e8-a01331a78333';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Eigentlich wollte ich widersprechen, aber mir fehlten die Worte.',
    focus = 'ch, ei',
    level = NULL,
    is_active = true
WHERE id = '7021d6b9-68e5-497e-98f3-8dd9ac69125c';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Die These, dass Sprache unser Denken formt, ist keineswegs neu.',
    focus = 's, z',
    level = NULL,
    is_active = true
WHERE id = '73751689-c009-44fa-8cf6-bc8760aecf5d';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Entschuldigung, wie spät ist es?',
    focus = 'sch, ä',
    level = NULL,
    is_active = true
WHERE id = '7b9d9fa0-0e76-46cb-9edc-7bf2eed7883b';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Nach der Prüfung fühle ich mich erleichtert und müde.',
    focus = 'ü, ch',
    level = NULL,
    is_active = true
WHERE id = '7c9935ff-5f52-447a-8c8b-648982ba9d31';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Am Wochenende besuche ich meine Eltern.',
    focus = 'ch, wo',
    level = NULL,
    is_active = true
WHERE id = '7cc29196-7210-4e44-9795-4088bba53792';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Könntest du das Fenster zumachen?',
    focus = 'ö, ch',
    level = NULL,
    is_active = true
WHERE id = '80027865-2bbb-42fb-bd1a-299a46010977';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Der Apfel ist süß und rot.',
    focus = 'pf, ü',
    level = NULL,
    is_active = true
WHERE id = '85de1de0-96e6-4292-b442-0d0e7daa47bb';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Ich bin müde.',
    focus = 'ü',
    level = NULL,
    is_active = true
WHERE id = '86e3f4b3-74b9-4fcd-8e88-b21b6e6a160f';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Lernen neben Beruf und Familie',
    sentence_de = 'Seit drei Monaten besuche ich einen Abendkurs, obwohl mein Alltag mit Beruf und Familie bereits gut gefüllt ist. In den ersten Wochen wollte ich jeden freien Moment zum Lernen nutzen. Bald merkte ich jedoch, dass ich ständig müde war und mir wenig merken konnte. Gemeinsam mit meiner Familie habe ich deshalb feste Lernzeiten vereinbart. An zwei Abenden kümmert sich mein Partner um das Essen, damit ich konzentriert arbeiten kann. Dafür bleibt der Sonntag weitgehend frei. Mein Fortschritt ist vielleicht langsamer als geplant, aber die neue Routine lässt sich durchhalten. Ich habe verstanden, dass ein realistischer Plan langfristig hilfreicher ist als ein besonders ehrgeiziger Anfang.',
    focus = 'l und er; Pausen bei Nebensätzen',
    level = 'B1.2',
    is_active = true
WHERE id = '876f98ba-930f-59f0-8b53-e7e09e235b6e';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Ein geübtes Ohr unterscheidet Ironie von bloßer Höflichkeit im Bruchteil einer Sekunde.',
    focus = 'ü, ch',
    level = NULL,
    is_active = true
WHERE id = '88901db9-3fce-4f73-a8aa-0df591e33f41';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Mit Fehlern umgehen',
    sentence_de = 'In meinem ersten Jahr in Deutschland wollte ich möglichst keine Fehler machen. Deshalb habe ich oft geschwiegen, obwohl ich etwas sagen konnte. Das änderte sich bei einem Gespräch mit einer Kollegin. Sie erzählte mir, wie unsicher sie selbst beim Lernen einer anderen Sprache war. Seitdem versuche ich, Fehler als Teil des Lernens zu betrachten. Wenn ich ein Wort falsch benutze, schreibe ich mir später ein Beispiel auf. Natürlich gibt es Situationen, in denen Genauigkeit wichtig ist. Im Alltag hilft es mir aber mehr, freundlich nachzufragen und weiterzusprechen. So werde ich langsam sicherer.',
    focus = 'f und ä; Betonung von Schlüsselsätzen',
    level = 'B1.1',
    is_active = true
WHERE id = '8c963a66-e60b-5f88-bee3-73aa3f3e3df7';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Der neue Stundenplan',
    sentence_de = 'Unser Deutschkurs hat ab Montag neue Zeiten. Wir lernen jetzt am Vormittag von neun bis zwölf Uhr. Am Dienstag üben wir besonders viel Sprechen. Am Donnerstag lesen wir kurze Texte. Die Lehrerin erklärt den Stundenplan langsam. Ich schreibe die Zeiten in meinen Kalender. Nach dem Kurs kann ich meine Tochter von der Schule abholen. Das passt gut für mich.',
    focus = 'st und sp; Satzverbindungen',
    level = 'A1.2',
    is_active = true
WHERE id = '8cd6b9c9-8eaf-5a08-863b-27e712dbc484';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Manchmal fällt es mir schwer, ruhig zu bleiben.',
    focus = 'ch, ei',
    level = NULL,
    is_active = true
WHERE id = '8cf5b45f-da02-4445-aa73-e05e7ec32d75';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Die Stadt aus einer anderen Perspektive',
    sentence_de = 'Vor Kurzem habe ich einen Spaziergang mit einer Bekannten gemacht, die einen Rollstuhl benutzt. Wir wollten gemeinsam ein Café besuchen und danach in die Bibliothek gehen. Schon auf dem Weg fiel mir auf, wie viele kleine Hindernisse ich sonst übersehe: eine hohe Bordsteinkante, Fahrräder auf dem Gehweg und eine schwere Eingangstür. Meine Bekannte erklärte, welche Wege gut funktionieren und wo sie Hilfe braucht. Gleichzeitig wollte sie nicht, dass ich alles ungefragt für sie übernehme. Der Nachmittag hat meinen Blick auf die Stadt verändert. Seitdem achte ich stärker darauf, ob Orte wirklich für alle zugänglich sind. Gute Absichten helfen, aber Zuhören und konkrete Verbesserungen sind ebenso wichtig.',
    focus = 'st und sp; flüssig erzählen',
    level = 'B1.2',
    is_active = true
WHERE id = '8cf76d58-8428-59ef-b449-4301051413ba';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Ein geübtes Ohr hört den Unterschied zwischen Distanz und Wärme.',
    focus = 'ü, ä',
    level = NULL,
    is_active = true
WHERE id = '8d0a7989-8545-45e8-8426-10cae0616f37';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Ein Besuch im Schwimmbad',
    sentence_de = 'Meine Tochter kann schon gut schwimmen. Am Sonntag gehen wir ins Schwimmbad. Ich packe zwei Handtücher und unsere Badesachen ein. An der Kasse kaufen wir zwei Karten. Das Wasser ist angenehm warm. Meine Tochter schwimmt, und ich übe mit ihr. Nach einer Stunde machen wir eine Pause. Wir haben Hunger und essen eine Banane.',
    focus = 'schw und au; Satzmelodie',
    level = 'A1.2',
    is_active = true
WHERE id = '924ee488-8b97-5070-ba23-eea0f03992e6';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Homeoffice im Alltag',
    sentence_de = 'An zwei Tagen in der Woche arbeite ich von zu Hause aus. Dadurch spare ich den Arbeitsweg und kann morgens ruhiger beginnen. Allerdings war es anfangs schwierig, nach Feierabend wirklich aufzuhören. Mein Laptop stand auf dem Küchentisch, und ich beantwortete noch spät Nachrichten. Inzwischen habe ich einen festen Arbeitsplatz und klare Arbeitszeiten. Nach der letzten Aufgabe schalte ich den Computer aus und gehe kurz spazieren. Diese kleine Gewohnheit hilft mir, Arbeit und Freizeit zu trennen. Den Kontakt zu meinen Kolleginnen und Kollegen möchte ich trotzdem nicht verlieren. Deshalb bin ich auch gern regelmäßig im Büro.',
    focus = 'h und o; Vor- und Nachteile',
    level = 'B1.1',
    is_active = true
WHERE id = '92818a0b-1e3d-5f69-b023-f61637d49279';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Ich versuche, jeden Tag ein bisschen Deutsch zu sprechen.',
    focus = 'ch, ü',
    level = NULL,
    is_active = true
WHERE id = '933fdedf-8855-48c8-8d51-5177f96dbbab';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Auf dem Wochenmarkt',
    sentence_de = 'Am Mittwoch ist Markt auf dem großen Platz. Ich gehe mit meinem Korb dorthin. An einem Stand gibt es frische Äpfel und Birnen. Ich möchte ein Kilo Äpfel kaufen. Die Verkäuferin lässt mich einen Apfel probieren. Er schmeckt süß. Am nächsten Stand kaufe ich Kartoffeln. Zum Schluss hole ich Blumen für meine Küche.',
    focus = 'ö und pf; Mengenangaben',
    level = 'A1.2',
    is_active = true
WHERE id = '93e4a1ed-cb70-5f0a-9dd2-cf6b2a9c9699';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Die feinen Registerwechsel zwischen Amtsdeutsch und Umgangssprache verlangen ein sicheres Gespür.',
    focus = 'sch, ü',
    level = NULL,
    is_active = true
WHERE id = '94501aa9-eb33-41b6-a84c-077af097919c';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Die Küche ist hell und freundlich.',
    focus = 'ü, ch',
    level = NULL,
    is_active = true
WHERE id = '94be2733-3f04-4b43-9479-46f60b4763ab';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Ein präziser Wortschatz ersetzt mitunter ganze Erklärungen.',
    focus = 'z, ch',
    level = NULL,
    is_active = true
WHERE id = '9679e3bb-a8cb-438f-8873-9ce61fadd39a';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Zwischen Understatement und Übertreibung liegt die Kunst der Nuance.',
    focus = 'ü, z',
    level = NULL,
    is_active = true
WHERE id = '97314796-6e24-4855-b7d9-fec2eebd7f54';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Es wäre wünschenswert, wenn wir uns auf einen Kompromiss einigen könnten.',
    focus = 'ü, ss',
    level = NULL,
    is_active = true
WHERE id = '9921f077-c7df-4a2d-a021-d16e2028da5d';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Ein Tag ohne Handy',
    sentence_de = 'Am Sonntag habe ich mein Handy zu Hause vergessen. Zuerst war ich unruhig, weil ich meine Nachrichten nicht lesen konnte. Im Park habe ich mich dann auf eine Bank gesetzt und die Menschen beobachtet. Später habe ich in einem Café eine Zeitung gelesen. Ohne Handy hatte ich viel mehr Zeit. Am Abend habe ich meine Nachrichten beantwortet. Es war nichts Dringendes dabei. Vielleicht lasse ich mein Handy am nächsten Sonntag wieder zu Hause.',
    focus = 'a und ei; deutliche Satzenden',
    level = 'A2.1',
    is_active = true
WHERE id = '99feaf25-8ae7-58f7-a492-e2aa4a501707';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Wie geht es Ihnen?',
    focus = 'ie, ch',
    level = NULL,
    is_active = true
WHERE id = '9fc60ff9-7ecd-4ac8-9c9a-a47cebf76623';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Ich heiße Jürgen.',
    focus = 'ü, ei',
    level = NULL,
    is_active = true
WHERE id = 'a0abb7f8-5856-4528-95bc-594963b7a3c6';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Mein Zimmer',
    sentence_de = 'Mein Zimmer ist nicht groß, aber schön. Links steht mein Bett. Am Fenster steht ein Tisch. Auf dem Tisch liegt mein Deutschbuch. Der Stuhl ist blau. Ich lese hier gern. Am Abend mache ich die Lampe an und lerne neue Wörter.',
    focus = 'z und sch; Wortbetonung',
    level = 'A1.1',
    is_active = true
WHERE id = 'a218b88e-9369-5472-b5fe-34c99d1ced76';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = NULL,
    sentence_de = 'Ich kaufe Brot, Milch und Äpfel.',
    focus = 'ä, pf',
    level = NULL,
    is_active = true
WHERE id = 'a21abf03-660b-4c3f-8df2-55ef32cd1b70';


UPDATE public.pronunciation_prompts
SET lesson = 'Lektion 1',
    title = 'Eine faire Aufgabenverteilung',
    sentence_de = 'In unserer Wohngemeinschaft gab es immer wieder Streit über die Hausarbeit. Einige putzten häufig, andere bemerkten den Schmutz angeblich gar nicht. Irgendwann setzten wir uns zusammen, statt nur kurze Nachrichten in die Gruppe zu schreiben. Jeder erklärte, welche Aufgaben er übernehmen konnte und was ihn störte. Wir erstellten einen einfachen Plan, der jede Woche wechselt. Außerdem vereinbarten wir, rechtzeitig Bescheid zu geben, wenn jemand keine Zeit hat. Seitdem ist nicht alles perfekt, aber die Stimmung ist besser. Besonders geholfen hat uns, einander zuzuhören und konkrete Absprachen zu treffen.',
    focus = 'f und t; Gegensätze und Lösungen',
    level = 'B1.1',
    is_active = true
WHERE id = 'a32ba623-4578-55b4-9b44-b717c857a46c';

COMMIT;BEGIN;
ALTER TABLE public.student_trainer_access ADD COLUMN IF NOT EXISTS allowed_lessons text[];
ALTER TABLE public.pronunciation_prompts ADD COLUMN IF NOT EXISTS lesson text NOT NULL DEFAULT 'Lektion 1';
COMMIT;

-- 2026-09-13: Repair Gemini lesson permissions and assessment isolation
-- Units are lesson names for vocabulary/grammar and stable prompt UUIDs for pronunciation.
-- Preserve existing progress, submissions, billing and student identities.
-- null means all current/future units; an empty array means none.
ALTER TABLE public.student_trainer_access ADD COLUMN IF NOT EXISTS allowed_lessons text[];

CREATE FUNCTION trainer_access_private.unit_allowed(p_level text,p_trainer text,p_unit text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT trainer_access_private.allowed(p_level,p_trainer) AND EXISTS(
   SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND (
    p.role IN ('teacher','admin') OR NOT EXISTS(SELECT 1 FROM public.student_trainer_access a
     WHERE a.user_id=p.id AND a.level=p_level AND a.trainer=p_trainer AND a.allowed_lessons IS NOT NULL
       AND NOT COALESCE(p_unit=ANY(a.allowed_lessons),false))));
$$;
REVOKE ALL ON FUNCTION trainer_access_private.unit_allowed(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION trainer_access_private.unit_allowed(text,text,text) TO authenticated;
ALTER POLICY vocabulary_trainer_guard ON public.vocabulary_cards USING(trainer_access_private.unit_allowed(level,'vocabulary',lesson));
ALTER POLICY exercises_trainer_guard ON public.exercises USING(trainer_access_private.unit_allowed(level,'exercises',lesson));
ALTER POLICY pronunciation_trainer_guard ON public.pronunciation_prompts USING(trainer_access_private.unit_allowed(level,'pronunciation',id::text));
ALTER POLICY submission_trainer_read ON public.submissions USING(type IS DISTINCT FROM 'audio' OR trainer_access_private.unit_allowed(level,'pronunciation',prompt_id::text));
ALTER POLICY submission_trainer_insert ON public.submissions WITH CHECK(type IS DISTINCT FROM 'audio' OR trainer_access_private.unit_allowed(level,'pronunciation',prompt_id::text));

-- Convert old lesson-wide pronunciation restrictions to the exact existing texts.
UPDATE public.student_trainer_access a SET allowed_lessons=ARRAY(
 SELECT DISTINCT p.id::text FROM public.pronunciation_prompts p
 WHERE p.level=a.level AND (p.lesson=ANY(a.allowed_lessons) OR p.id::text=ANY(a.allowed_lessons)) ORDER BY p.id::text
) WHERE trainer='pronunciation' AND allowed_lessons IS NOT NULL;

-- Resolve malformed legacy grammar groups by topic while preserving IDs/progress.
CREATE TEMP TABLE grammar_unit_repair ON COMMIT DROP AS
 SELECT id,level,lesson old_lesson,
 CASE WHEN level='A1.1' AND lesson='A1.1' AND topic='Artikel' THEN 'A1.1 · 03'
      WHEN level='A1.1' AND lesson='A1.1' THEN 'A1.1 · 01'
      WHEN level='A1.2' AND lesson='Lektion 2' AND topic='Perfekt' THEN 'A1.2 · 07'
      WHEN level='A2.1' AND lesson='Lektion 1' AND topic='Urlaub' THEN 'A2.1 · 02'
      ELSE lesson END new_lesson FROM public.exercises;
UPDATE public.student_trainer_access a SET allowed_lessons=ARRAY(
 SELECT DISTINCT mapped FROM unnest(a.allowed_lessons) old
 CROSS JOIN LATERAL (SELECT r.new_lesson mapped FROM grammar_unit_repair r WHERE r.level=a.level AND r.old_lesson=old
   UNION SELECT old WHERE NOT EXISTS(SELECT 1 FROM grammar_unit_repair r WHERE r.level=a.level AND r.old_lesson=old)) m ORDER BY mapped
) WHERE trainer='exercises' AND allowed_lessons IS NOT NULL;
UPDATE public.exercises e SET lesson=r.new_lesson FROM grammar_unit_repair r WHERE e.id=r.id AND e.lesson IS DISTINCT FROM r.new_lesson;
-- Repair two unfinished sample exercises only if their exact original content remains.
UPDATE public.exercises SET topic='Perfekt mit sein',content=jsonb_build_object('text_before','Gestern ','correct_answer','bin','text_after',' ich im Park spazieren gegangen.','options',jsonb_build_array('bin','habe','hat'))
 WHERE level='A1.2' AND topic='Perfekt' AND content->>'text_before'='Ich' AND content->>'text_after'='Anastasia Sitov.' AND content->>'correct_answer'='bin';
UPDATE public.exercises SET topic='Dass-Sätze',content=jsonb_build_object('text_before','Ich hoffe, dass ich im Urlaub am Meer ','correct_answer','bin','text_after','.','options',jsonb_build_array('bin','bist','ist'))
 WHERE level='A2.1' AND topic='Urlaub' AND content->>'text_before'='Ich' AND content->>'text_after'='ein Mädchen.' AND content->>'correct_answer'='bin';
UPDATE public.pronunciation_prompts SET is_active=false WHERE level IS NULL AND title IS NULL AND is_active;
CREATE OR REPLACE FUNCTION trainer_access_private.allowed(p_level text, p_trainer text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS (
   SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND
   (p.role IN ('teacher','admin') OR (
     p.ui_language IS DISTINCT FROM 'de' AND p_level = ANY(COALESCE(p.allowed_levels, ARRAY[]::text[])) AND
     p_trainer IN ('vocabulary','exercises','pronunciation','videos') AND
     COALESCE((SELECT a.enabled FROM public.student_trainer_access a
       WHERE a.user_id = p.id AND a.level = p_level AND a.trainer = p_trainer), true)
   ))
 );
$function$
;

CREATE OR REPLACE FUNCTION pronunciation_private.can_access_submission(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS (
   SELECT 1 FROM public.submissions s WHERE s.id=p_id AND
   ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher','admin') OR
    (s.user_id=(SELECT auth.uid()) AND trainer_access_private.unit_allowed(s.level,'pronunciation',s.prompt_id::text)))
 );
$function$
;

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
  IF NOT trainer_access_private.unit_allowed(prompt.level, 'pronunciation', prompt.id::text) THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 IF p_audio_path NOT LIKE 'storage://pronunciation_audio/' || actor::text || '/%' OR NOT EXISTS(
 SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'pronunciation_audio' AND 'storage://pronunciation_audio/' || o.name = p_audio_path)
 THEN RAISE EXCEPTION 'Invalid recording'; END IF;
 INSERT INTO public.submissions(user_id,type,content_url,text_content,status,level,prompt_id,prompt_title)
 VALUES(actor,'audio',p_audio_path,prompt.sentence_de,'pending',prompt.level,prompt.id,prompt.title) RETURNING id INTO result;
 RETURN result;
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
  selected_direction text;
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
    selected_direction := item->>'direction';
    IF selected_direction IS NOT NULL AND selected_direction NOT IN ('de_to_native','native_to_de') THEN
      RAISE EXCEPTION 'invalid_direction' USING ERRCODE='22023';
    END IF;
    target := (item->>'cardId')::uuid;
    known := (item->>'alreadyKnown')::boolean;
    IF NOT EXISTS (
      SELECT 1 FROM public.vocabulary_cards c JOIN public.profiles p ON p.id = actor
      WHERE c.id = target AND trainer_access_private.unit_allowed(c.level, 'vocabulary', c.lesson) AND (p.role IN ('teacher','admin') OR c.level = ANY(coalesce(p.allowed_levels, ARRAY[]::text[])))
    ) THEN RAISE EXCEPTION 'level_access_denied' USING ERRCODE = '42501'; END IF;
    INSERT INTO public.vocabulary_direction_progress(user_id, card_id, direction, box_number, next_review_date)
      SELECT actor, target, d, CASE WHEN known THEN 6 ELSE 1 END,
        CASE WHEN known THEN now() + interval '90 days' ELSE now() END
      FROM unnest(CASE WHEN selected_direction IS NULL THEN ARRAY['de_to_native','native_to_de'] ELSE ARRAY[selected_direction] END) d
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
  IF NOT trainer_access_private.unit_allowed(target.level, 'exercises', target.lesson) THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
  IF coalesce(target.content->>'correct_answer', '') = '' THEN
    RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE = '22023';
  END IF;
  answer_normalized := lower(regexp_replace(btrim(p_answer), '\s+', ' ', 'g'));
  correct := answer_normalized = lower(regexp_replace(btrim(target.content->>'correct_answer'), '\s+', ' ', 'g'));

  IF NOT correct AND target.type='fill_in_blank' AND jsonb_typeof(target.content->'alternative_answers')='array' THEN
    correct := EXISTS(SELECT 1 FROM jsonb_array_elements_text(target.content->'alternative_answers') alt
      WHERE answer_normalized=lower(regexp_replace(btrim(alt), '\s+', ' ', 'g')));
  END IF;

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
  SELECT c.lesson INTO first_lesson FROM public.vocabulary_cards c WHERE c.level = p_level AND trainer_access_private.unit_allowed(c.level,'vocabulary',c.lesson)
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
  is_alternative boolean := false;
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
  IF NOT trainer_access_private.unit_allowed(card.level,'vocabulary',card.lesson) OR p_ui_language='de' THEN
    RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501';
  END IF;
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
    IF NOT correct AND card.alternative_answers_de IS NOT NULL AND array_length(card.alternative_answers_de, 1) > 0 THEN
      IF coalesce(convert_to(p_typed_answer,'UTF8') = ANY (
           SELECT convert_to(alt, 'UTF8') FROM unnest(card.alternative_answers_de) alt
         ), false) THEN
        correct := true;
        is_alternative := true;
      END IF;
    END IF;
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
    || CASE WHEN sentence THEN jsonb_build_object('correctAnswer',card.context_sentence_de,'isAlternative',is_alternative) ELSE '{}'::jsonb END;
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
    WHERE v.id=p_progress_id AND v.user_id=actor AND trainer_access_private.unit_allowed(c.level,'vocabulary',c.lesson)) THEN
    RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501';
  END IF;
  IF p_ui_language='de' THEN
    RAISE EXCEPTION 'invalid_learning_language' USING ERRCODE='42501';
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

-- Avoid pre-assessing the reverse direction when synchronizing a directional assessment.
CREATE OR REPLACE FUNCTION vocabulary_private.mirror_legacy_progress()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE had_forward boolean;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> (CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END) THEN
    RAISE EXCEPTION 'progress_owner_required' USING ERRCODE='42501';
  END IF;
  IF TG_OP='DELETE' THEN
    DELETE FROM public.vocabulary_direction_progress WHERE user_id=OLD.user_id AND card_id=OLD.card_id;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.card_id IS DISTINCT FROM OLD.card_id) THEN
    RAISE EXCEPTION 'progress_identity_immutable' USING ERRCODE='23514';
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.vocabulary_direction_progress WHERE user_id=NEW.user_id AND card_id=NEW.card_id AND direction='de_to_native') INTO had_forward;
  INSERT INTO public.vocabulary_direction_progress(id,user_id,card_id,direction,box_number,next_review_date,created_at,updated_at,lapses,last_answered_at)
  VALUES(NEW.id,NEW.user_id,NEW.card_id,'de_to_native',NEW.box_number,NEW.next_review_date,NEW.created_at,NEW.updated_at,NEW.lapses,NEW.last_answered_at)
  ON CONFLICT(user_id,card_id,direction) DO UPDATE SET box_number=excluded.box_number,next_review_date=excluded.next_review_date,
    updated_at=excluded.updated_at,lapses=excluded.lapses,last_answered_at=excluded.last_answered_at;
  IF NOT had_forward THEN
    INSERT INTO public.vocabulary_direction_progress(user_id,card_id,direction)
      VALUES(NEW.user_id,NEW.card_id,'native_to_de') ON CONFLICT(user_id,card_id,direction) DO NOTHING;
  END IF;
  IF NEW.last_answered_at IS NOT NULL AND (TG_OP='INSERT' OR NEW.last_answered_at IS DISTINCT FROM OLD.last_answered_at) THEN
    INSERT INTO public.vocabulary_learning_state(user_id,last_card_id,last_reviewed_at)
      VALUES(NEW.user_id,NEW.card_id,NEW.last_answered_at)
      ON CONFLICT(user_id) DO UPDATE SET last_card_id=excluded.last_card_id,last_reviewed_at=excluded.last_reviewed_at
      WHERE public.vocabulary_learning_state.last_reviewed_at IS NULL
        OR excluded.last_reviewed_at >= public.vocabulary_learning_state.last_reviewed_at;
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION trainer_access_private.can_record()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND
   (p.role IN ('teacher','admin') OR EXISTS(SELECT 1 FROM public.pronunciation_prompts prompt WHERE prompt.is_active AND trainer_access_private.unit_allowed(prompt.level,'pronunciation',prompt.id::text))));
$function$
;


-- A partially assessed word may have only the reverse direction and no legacy row.
CREATE FUNCTION vocabulary_private.reset_lesson(p_level text,p_lesson text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := (SELECT auth.uid());
BEGIN
 IF actor IS NULL OR NOT trainer_access_private.unit_allowed(p_level,'vocabulary',p_lesson) THEN
  RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:' || actor::text,0));
 DELETE FROM public.user_vocabulary_progress v USING public.vocabulary_cards c
  WHERE v.user_id=actor AND v.card_id=c.id AND c.level=p_level AND c.lesson=p_lesson;
 DELETE FROM public.vocabulary_direction_progress v USING public.vocabulary_cards c
  WHERE v.user_id=actor AND v.card_id=c.id AND c.level=p_level AND c.lesson=p_lesson;
END;
$$;
REVOKE ALL ON FUNCTION vocabulary_private.reset_lesson(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION vocabulary_private.reset_lesson(text,text) TO authenticated;
CREATE FUNCTION public.reset_vocabulary_lesson_progress(p_level text,p_lesson text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT vocabulary_private.reset_lesson(p_level,p_lesson); $$;
REVOKE ALL ON FUNCTION public.reset_vocabulary_lesson_progress(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reset_vocabulary_lesson_progress(text,text) TO authenticated;

-- 2026-09-13: Complete Ukrainian vocabulary
-- Fill missing Ukrainian word translations without overwriting teacher edits.
-- Match existing content, not generated database IDs. Both review directions use this locale.
UPDATE public.vocabulary_cards c SET translation_uk=t.translation_uk
FROM (VALUES
 ('was?','что?','what?','що?'),
 ('Spanien','Испания','Spain','Іспанія'),
 ('Telefonnummer','номер телефона','phone number','номер телефону'),
 ('Auf Wiedersehen','до свидания','goodbye','до побачення'),
 ('Guten Abend','добрый вечер','good evening','добрий вечір'),
 ('Hallo','привет','hello','привіт'),
 ('Dame','дама','lady','пані'),
 ('aha','ага / понятно','I see','ага / зрозуміло'),
 ('Stadt','город','city','місто'),
 ('Gute Nacht','спокойной ночи','good night','на добраніч'),
 ('Wer ist das? – Das ist …','Кто это? – Это …','Who is that? – That is …','Хто це? – Це …'),
 ('Ich spreche ein bisschen Deutsch','Я немного говорю по-немецки','I speak a little German','Я трохи говорю німецькою'),
 ('Sie','Вы (вежливая форма)','you (formal)','Ви (ввічлива форма)'),
 ('Visitenkarte','визитная карточка','business card','візитна картка'),
 ('Deutschland','Германия','Germany','Німеччина'),
 ('E-Mail','электронная почта','email','електронна пошта'),
 ('Italienisch','итальянский','Italian','італійська мова'),
 ('Sprache','язык','language','мова'),
 ('leben','жить','to live','жити'),
 ('kommen','приходить / быть родом (ich komme, du kommst, Sie kommen)','to come','приходити / походити з'),
 ('sprechen','говорить (ich spreche, du sprichst, Sie sprechen)','to speak','говорити'),
 ('Englisch','английский','English','англійська мова'),
 ('Telefon','телефон','telephone','телефон'),
 ('Tut mir leid','мне жаль','I am sorry','мені шкода'),
 ('ein bisschen','немного','a little','трохи'),
 ('Türkei','Турция','Turkey','Туреччина'),
 ('Tschüss','пока','bye','бувай'),
 ('und','и','and','і / та'),
 ('Name','имя','name','ім''я'),
 ('Familienname','фамилия','family name','прізвище'),
 ('wer?','кто?','who?','хто?'),
 ('ich','я','I','я'),
 ('Guten Morgen','доброе утро','good morning','доброго ранку'),
 ('Französisch','французский','French','французька мова'),
 ('Frau','женщина / госпожа','woman / Mrs','жінка / пані'),
 ('Vorname','имя (личное)','first name','ім''я (особове)'),
 ('nein','нет','no','ні'),
 ('Polen','Польша','Poland','Польща'),
 ('heißen','звать(ся) (ich heiße, du heißt, Sie heißen)','to be called','зватися'),
 ('Türkisch','турецкий','Turkish','турецька мова'),
 ('Entschuldigung','извините','excuse me','вибачте'),
 ('Rumänien','Румыния','Romania','Румунія'),
 ('Anmeldeformular','бланк регистрации','registration form','реєстраційна форма'),
 ('Straße','улица','street','вулиця'),
 ('Guten Tag','добрый день','good day','добрий день'),
 ('Papa','папа','dad','тато'),
 ('Buchstabe','буква','letter (of the alphabet)','літера'),
 ('woher?','откуда?','where from?','звідки?'),
 ('Hausnummer','номер дома','house number','номер будинку'),
 ('wie?','как?','how?','як?'),
 ('du','ты','you (informal)','ти'),
 ('Wie heißt du? – Ich heiße …','Как тебя зовут? – Меня зовут …','What is your name? (informal) – My name is …','Як тебе звати? – Мене звати …'),
 ('Italien','Италия','Italy','Італія'),
 ('Mein Name ist …','Меня зовут … / Моё имя …','My name is …','Мене звати …'),
 ('Arabisch','арабский','Arabic','арабська мова'),
 ('Deutsch','немецкий','German','німецька мова'),
 ('Polnisch','польский','Polish','польська мова'),
 ('danke','спасибо','thank you','дякую'),
 ('Nachname','фамилия','last name','прізвище'),
 ('Woher kommen Sie? – Ich komme aus …','Откуда вы? – Я из …','Where are you from? – I come from …','Звідки Ви? – Я з …'),
 ('Österreich','Австрия','Austria','Австрія'),
 ('Syrien','Сирия','Syria','Сирія'),
 ('interessant','интересно','interesting','цікавий / цікаво'),
 ('sein','быть (ich bin, du bist, Sie sind)','to be','бути'),
 ('Land','страна','country','країна'),
 ('Ungarn','Венгрия','Hungary','Угорщина'),
 ('Wie heißen Sie? – Ich heiße …','Как вас зовут? – Меня зовут …','What is your name? – My name is …','Як Вас звати? – Мене звати …'),
 ('Herr','господин','Mr / gentleman','пан'),
 ('Schweiz','Швейцария','Switzerland','Швейцарія'),
 ('Kind','ребёнок','child','дитина'),
 ('Bulgarien','Болгария','Bulgaria','Болгарія'),
 ('auch','тоже','also','також / теж'),
 ('Willkommen','добро пожаловать','welcome','ласкаво просимо'),
 ('ja','да','yes','так'),
 ('buchstabieren','произносить по буквам','to spell','називати по літерах'),
 ('Adresse','адрес','address','адреса'),
 ('toll','здорово / класс','great','чудово'),
 ('Alphabet','алфавит','alphabet','абетка / алфавіт'),
 ('Was sprechen Sie? – Ich spreche …','На каком языке вы говорите? – Я говорю на …','What language do you speak? – I speak …','Якою мовою Ви говорите? – Я говорю …'),
 ('aus','из','from','з / із'),
 ('Griechisch','греческий','Greek','грецька мова'),
 ('Freut mich','очень приятно','nice to meet you','приємно познайомитися'),
 ('Griechenland','Греция','Greece','Греція'),
 ('Spanisch','испанский','Spanish','іспанська мова'),
 ('zwei','два','two','два'),
 ('Wie geht es dir?','Как у тебя дела?','How are you? (informal)','Як у тебе справи?'),
 ('Es geht.','Нормально. / Пойдёт.','So-so.','Так собі.'),
 ('Lehrer','учитель','teacher (male)','учитель'),
 ('Das ist meine Mutter.','Это моя мама.','This is my mother.','Це моя мама.'),
 ('Wo lebt deine Familie? – Meine Familie lebt in …','Где живёт твоя семья? – Моя семья живёт в …','Where does your family live? – My family lives in …','Де живе твоя сім''я? – Моя сім''я живе в …'),
 ('sie (Plural)','они','they','вони'),
 ('vierzehn','четырнадцать','fourteen','чотирнадцять'),
 ('achtzehn','восемнадцать','eighteen','вісімнадцять'),
 ('lernen','учить / учиться','to learn','учити / навчатися'),
 ('keine','никакие / нет (Ich habe keine Geschwister.)','no / none','жодні / немає'),
 ('getrennt','в раздельном проживании','separated','окремо (про проживання подружжя)'),
 ('vier','четыре','four','чотири'),
 ('Eltern','родители','parents','батьки'),
 ('Enkel','внук','grandson','онук'),
 ('Ich habe keine Geschwister.','У меня нет братьев и сестёр.','I have no siblings.','У мене немає братів і сестер.'),
 ('acht','восемь','eight','вісім'),
 ('sehr gut','очень хорошо','very good','дуже добре'),
 ('Na ja.','Ну так…','Well… / Not really.','Ну, так собі.'),
 ('verheiratet','женат / замужем','married','одружений / заміжня'),
 ('fünf','пять','five','п''ять'),
 ('Lehrerin','учительница','teacher (female)','учителька'),
 ('Geschwister','братья и сёстры','siblings','брати й сестри'),
 ('nicht so gut','не очень хорошо','not so good','не дуже добре'),
 ('mein / meine','мой / моя / моё','my','мій / моя / моє / мої'),
 ('dein / deine','твой / твоя / твоё','your (informal)','твій / твоя / твоє / твої'),
 ('Pause','перерыв','break','перерва'),
 ('Frau','женщина / жена','woman / wife','жінка / дружина'),
 ('meinen','иметь в виду (Was meinen Sie?)','to mean','мати на увазі'),
 ('Meine Eltern sind verheiratet / geschieden','Мои родители женаты / в разводе','My parents are married / divorced','Мої батьки одружені / розлучені'),
 ('Schwester','сестра','sister','сестра'),
 ('Opa','дедушка','grandpa','дідусь'),
 ('zwölf','двенадцать','twelve','дванадцять'),
 ('sehr','очень','very','дуже'),
 ('wohnen','проживать / жить (по адресу)','to live (reside)','проживати / мешкати'),
 ('zehn','десять','ten','десять'),
 ('Enkelin','внучка','granddaughter','онука'),
 ('Mutter','мать','mother','мати'),
 ('gut','хороший / хорошо','good','добрий / добре'),
 ('Hauptstadt','столица','capital city','столиця'),
 ('Jahr','год','year','рік'),
 ('Familie','семья','family','сім''я / родина'),
 ('neunzehn','девятнадцать','nineteen','дев''ятнадцять'),
 ('Vater','отец','father','батько'),
 ('geschieden','в разводе','divorced','розлучений / розлучена'),
 ('sechzehn','шестнадцать','sixteen','шістнадцять'),
 ('sieben','семь','seven','сім'),
 ('Wie geht''s?','Как дела?','How''s it going?','Як справи?'),
 ('Mann','мужчина / муж','man / husband','чоловік'),
 ('Sohn','сын','son','син'),
 ('neun','девять','nine','дев''ять'),
 ('Ihr / Ihre','ваш / ваша / ваше (вежл.)','your (formal)','Ваш / Ваша / Ваше / Ваші'),
 ('Oma','бабушка','grandma','бабуся'),
 ('Großeltern','бабушка и дедушка','grandparents','дідусь і бабуся'),
 ('zwanzig','двадцать','twenty','двадцять'),
 ('Hast du Geschwister?','У тебя есть братья или сёстры?','Do you have siblings?','У тебе є брати чи сестри?'),
 ('super','супер','great','супер / чудово'),
 ('verstehen','понимать','to understand','розуміти'),
 ('Ehefrau','супруга','wife','дружина'),
 ('dreizehn','тринадцать','thirteen','тринадцять'),
 ('alt','старый / … Jahre alt','old / … years old','старий / віком … років'),
 ('Wie alt bist du? – Ich bin 20 Jahre alt.','Сколько тебе лет? – Мне 20 лет.','How old are you? – I am 20 years old.','Скільки тобі років? – Мені 20 років.'),
 ('Danke, gut.','Спасибо, хорошо.','Thanks, I''m well.','Дякую, добре.'),
 ('Tochter','дочь','daughter','донька'),
 ('er','он','he','він'),
 ('drei','три','three','три'),
 ('elf','одиннадцать','eleven','одинадцять'),
 ('Mama','мама','mom','мама'),
 ('eins','один','one','один'),
 ('ihr','вы (мн. ч., неформ.)','you (plural, informal)','ви (звертання до кількох людей)'),
 ('siebzehn','семнадцать','seventeen','сімнадцять'),
 ('in','в','in','в / у'),
 ('Ort','место / населённый пункт','place / town','місце / населений пункт'),
 ('Wie geht es Ihnen?','Как у вас дела?','How are you? (formal)','Як у Вас справи?'),
 ('sechs','шесть','six','шість'),
 ('Bruder','брат','brother','брат'),
 ('null','ноль','zero','нуль'),
 ('sie','она','she','вона'),
 ('Das ist mein Bruder.','Это мой брат.','This is my brother.','Це мій брат.'),
 ('wir','мы','we','ми'),
 ('fünfzehn','пятнадцать','fifteen','п''ятнадцять'),
 ('Park','парк','park','парк'),
 ('Mineralwasser','минеральная вода','mineral water','мінеральна вода'),
 ('kaufen','покупать','to buy','купувати'),
 ('Pfannkuchen','блин / оладья','pancake','млинець'),
 ('Spinat','шпинат','spinach','шпинат'),
 ('Schokolade','шоколад','chocolate','шоколад'),
 ('Käse','сыр','cheese','сир'),
 ('Wein','вино','wine','вино'),
 ('Bäckerei','пекарня','bakery','пекарня'),
 ('Haben wir Zucker?','У нас есть сахар?','Do we have sugar?','У нас є цукор?'),
 ('Ich möchte …','Я хотел(а) бы …','I would like …','Я хотів би / хотіла б …'),
 ('finden','находить (Wo finde ich …?)','to find','знаходити'),
 ('Tee','чай','tea','чай'),
 ('Ich brauche …','Мне нужно …','I need …','Мені потрібно …'),
 ('Fisch','рыба','fish','риба'),
 ('Gemüse','овощи','vegetables','овочі'),
 ('Orange','апельсин','orange','апельсин'),
 ('sonst','ещё / иначе (Sonst noch etwas?)','otherwise / else','інакше / ще'),
 ('Supermarkt','супермаркет','supermarket','супермаркет'),
 ('Mehl','мука','flour','борошно'),
 ('Wie heißt das auf Deutsch?','Как это называется по-немецки?','What is that called in German?','Як це називається німецькою?'),
 ('Lauch','лук-порей','leek','цибуля-порей'),
 ('Milch','молоко','milk','молоко'),
 ('ein / eine','один / одна / одно (неопределённый артикль)','a / an','один / одна; неозначений артикль'),
 ('Euro','евро','euro','євро'),
 ('Banane','банан','banana','банан'),
 ('möchten','хотел(а) бы','would like','хотіти (ввічливе побажання)'),
 ('Metzgerei','мясная лавка','butcher''s shop','м''ясна крамниця'),
 ('Kilo','килограмм','kilo','кіло / кілограм'),
 ('Bier','пиво','beer','пиво'),
 ('Obst- und Gemüseladen','фруктово-овощной магазин','greengrocer''s','крамниця овочів і фруктів'),
 ('Wie viel brauchen Sie denn?','Сколько вам нужно?','How much do you need?','Скільки Вам потрібно?'),
 ('kosten','стоить (Was kostet …? / Was kosten …?)','to cost','коштувати'),
 ('Flasche','бутылка','bottle','пляшка'),
 ('Cent','цент','cent','цент'),
 ('Brötchen','булочка','bread roll','булочка'),
 ('Tomate','помидор','tomato','помідор'),
 ('der / die / das','определённый артикль','the','означені артиклі: чоловічий / жіночий / середній рід'),
 ('brauchen','нуждаться / быть нужным','to need','потребувати'),
 ('doch','же / всё-таки (Das ist doch kein Ei.)','though / actually','таки / усе ж'),
 ('Stück','штука','piece','шматок / штука'),
 ('Ei','яйцо','egg','яйце'),
 ('Fleisch','мясо','meat','м''ясо'),
 ('Hunger','голод','hunger','голод'),
 ('Salz','соль','salt','сіль'),
 ('kein / keine','никакой / нет','no / not a','жоден / жодна; заперечення перед іменником'),
 ('Reis','рис','rice','рис'),
 ('Das macht … Euro.','Итого … евро.','That comes to … euros.','З Вас … євро.'),
 ('Kiwi','киви','kiwi','ківі'),
 ('Birne','груша','pear','груша'),
 ('Pfund','фунт (500 г)','pound (500 g)','фунт (500 г)'),
 ('Wurst','колбаса','sausage','ковбаса'),
 ('Sonst noch etwas?','Что-нибудь ещё?','Anything else?','Ще щось?'),
 ('Hackfleisch','фарш','minced meat','м''ясний фарш'),
 ('Butter','масло (сливочное)','butter','вершкове масло'),
 ('Kann ich Ihnen helfen?','Могу я вам помочь?','Can I help you?','Чим я можу Вам допомогти?'),
 ('helfen','помогать (Kann ich Ihnen helfen?)','to help','допомагати'),
 ('Kartoffel','картофель','potato','картоплина'),
 ('Gramm','грамм','gram','грам'),
 ('Haben Sie Eier?','У вас есть яйца?','Do you have eggs?','У Вас є яйця?'),
 ('Saft','сок','juice','сік'),
 ('Ich hätte gern …','Я бы хотел(а) …','I would like … (polite)','Я хотів би / хотіла б …'),
 ('Kuchen','пирог / торт','cake','пиріг'),
 ('Apfel','яблоко','apple','яблуко'),
 ('Brot','хлеб','bread','хліб'),
 ('Apfelsaft','яблочный сок','apple juice','яблучний сік'),
 ('Obst','фрукты','fruit','фрукти'),
 ('haben','иметь','to have','мати'),
 ('Liter','литр','litre','літр'),
 ('Salat','салат','salad / lettuce','салат'),
 ('Zwiebel','лук','onion','цибулина'),
 ('Nein, danke. Das ist alles.','Нет, спасибо. Это всё.','No, thank you. That''s all.','Ні, дякую. Це все.'),
 ('Zucker','сахар','sugar','цукор'),
 ('einkaufen','делать покупки','to shop / go shopping','робити покупки'),
 ('Joghurt','йогурт','yogurt','йогурт'),
 ('Würstchen','сосиска','frankfurter / small sausage','сосиска'),
 ('Kaffee','кофе','coffee','кава'),
 ('Bett','кровать','bed','ліжко'),
 ('Monat','месяц','month','місяць'),
 ('Handy','мобильный телефон','mobile phone','мобільний телефон'),
 ('Schrank','шкаф','cupboard; wardrobe','шафа'),
 ('schwarz','чёрный','black','чорний'),
 ('gelb','жёлтый','yellow','жовтий'),
 ('Haus','дом','house','будинок'),
 ('Badezimmer','ванная комната','bathroom','ванна кімната'),
 ('Das gefällt mir. / Das gefällt mir nicht.','Мне это нравится. / Мне это не нравится.','I like that. / I don''t like that.','Мені це подобається. / Мені це не подобається.'),
 ('Ach so!','А, понятно!','Oh, I see!','А, зрозуміло!'),
 ('Stuhl','стул','chair','стілець'),
 ('billig','дешёвый','cheap','дешевий'),
 ('dort','там','there','там'),
 ('Balkon','балкон','balcony','балкон'),
 ('Wohnzimmer','гостиная','living room','вітальня'),
 ('schön','красивый','beautiful; nice','гарний / красивий'),
 ('Das Zimmer ist nicht teuer.','Комната недорогая.','The room is not expensive.','Кімната недорога.'),
 ('schmal','узкий','narrow','вузький'),
 ('Schreibtisch','письменный стол','desk','письмовий стіл'),
 ('Garten','сад','garden','сад'),
 ('blau','синий','blue','синій'),
 ('möbliert','меблированный','furnished','мебльований'),
 ('klein','маленький','small','маленький'),
 ('groß','большой','big','великий'),
 ('er / es / sie','он / оно / она','he / it / she','він / воно / вона'),
 ('nicht','не','not','не'),
 ('Teppich','ковёр','carpet','килим'),
 ('teuer','дорогой','expensive','дорогий'),
 ('Bad','ванная; санузел','bathroom','ванна кімната'),
 ('alt','старый','old','старий'),
 ('Wohnung','квартира','apartment','квартира'),
 ('grau','серый','grey','сірий'),
 ('der / das / die','определённый артикль','the definite article','означені артиклі: чоловічий / середній / жіночий рід'),
 ('Flur','коридор','hallway','коридор'),
 ('Das Bad ist dort.','Ванная там.','The bathroom is there.','Ванна кімната там.'),
 ('gefallen','нравиться','to like; please','подобатися'),
 ('Badewanne','ванна','bathtub','ванна'),
 ('dunkel','тёмный','dark','темний'),
 ('kennen','знать; быть знакомым','to know; be familiar with','знати / бути знайомим з'),
 ('braun','коричневый','brown','коричневий'),
 ('hier','здесь','here','тут'),
 ('neu','новый','new','новий'),
 ('Die Möbel sind sehr schön.','Мебель очень красивая.','The furniture is very nice.','Меблі дуже гарні.'),
 ('rot','красный','red','червоний'),
 ('Kühlschrank','холодильник','refrigerator','холодильник'),
 ('ruhig','тихий; спокойный','quiet','тихий / спокійний'),
 ('weiß','белый','white','білий'),
 ('dunkelbraun','тёмно-коричневый','dark brown','темно-коричневий'),
 ('Fernseher','телевизор','television','телевізор'),
 ('Quadratmeter','квадратный метр','square metre','квадратний метр'),
 ('hellgrün','светло-зелёный','light green','світло-зелений'),
 ('Herd','плита','stove','кухонна плита'),
 ('Zimmer','комната','room','кімната'),
 ('Dusche','душ','shower','душ'),
 ('zusammenwohnen','жить вместе','to live together','жити разом'),
 ('breit','широкий','wide','широкий'),
 ('hell','светлый','bright; light','світлий / яскравий'),
 ('hellbraun','светло-коричневый','light brown','світло-коричневий'),
 ('Gerät','прибор; устройство','device; appliance','прилад / пристрій'),
 ('aber','но','but','але'),
 ('grün','зелёный','green','зелений'),
 ('Küche','кухня','kitchen','кухня'),
 ('Das Zimmer kostet 350 Euro im Monat.','Комната стоит 350 евро в месяц.','The room costs 350 euros per month.','Кімната коштує 350 євро на місяць.'),
 ('Arbeitszimmer','рабочий кабинет','study; office','робочий кабінет'),
 ('Farbe','цвет','colour','колір'),
 ('Lampe','лампа','lamp','лампа'),
 ('Tisch','стол','table','стіл'),
 ('Toilette','туалет','toilet','туалет'),
 ('Sofa','диван','sofa','диван'),
 ('hässlich','некрасивый','ugly','некрасивий / потворний'),
 ('Sessel','кресло','armchair','крісло'),
 ('Das Zimmer ist sehr schön.','Комната очень красивая.','The room is very nice.','Кімната дуже гарна.'),
 ('Hausaufgabe','домашнее задание','homework','домашнє завдання'),
 ('besuchen','посещать; навещать','to visit','відвідувати'),
 ('anfangen','начинать','to start','починати'),
 ('spazieren gehen','идти гулять','to go for a walk','гуляти / йти на прогулянку'),
 ('lange','долго','for a long time','довго'),
 ('kochen','готовить','to cook','готувати їжу'),
 ('einkaufen (kauft … ein)','делать покупки','to shop','робити покупки'),
 ('zusammen','вместе','together','разом'),
 ('arbeiten','работать','to work','працювати'),
 ('Morgen','утро','morning','ранок'),
 ('machen','делать','to do; make','робити'),
 ('Präsentation','презентация','presentation','презентація'),
 ('mit','с','with','з / із'),
 ('Musik','музыка','music','музика'),
 ('Uhrzeit','время на часах','time','час (за годинником)'),
 ('Vormittag','первая половина дня','late morning','час до полудня'),
 ('oder','или','or','або'),
 ('Nachmittag','день; вторая половина дня','afternoon','час після полудня'),
 ('gern','охотно; с удовольствием','gladly; like to','охоче / із задоволенням'),
 ('Kino','кинотеатр','cinema','кінотеатр'),
 ('am Montag / am Dienstag / am Mittwoch / am Donnerstag / am Freitag / am Samstag / am Sonntag','в понедельник / во вторник / в среду / в четверг / в пятницу / в субботу / в воскресенье','on Monday / Tuesday / Wednesday / Thursday / Friday / Saturday / Sunday','у понеділок / у вівторок / у середу / у четвер / у п''ятницю / у суботу / у неділю'),
 ('fernsehen (sieht … fern)','смотреть телевизор','to watch television','дивитися телевізор'),
 ('Am Nachmittag geht sie spazieren oder kauft ein.','Днём она идёт гулять или делает покупки.','In the afternoon she goes for a walk or goes shopping.','Після полудня вона гуляє або робить покупки.'),
 ('Mittwoch','среда','Wednesday','середа'),
 ('täglich','ежедневно','daily','щодня'),
 ('wann?','когда?','when?','коли?'),
 ('Montag','понедельник','Monday','понеділок'),
 ('um (um 7 Uhr)','в (в 7 часов)','at (at 7 o’clock)','о (о 7-й годині)'),
 ('essen (isst)','есть','to eat','їсти'),
 ('Pia räumt die Küche auf.','Пиа убирает кухню.','Pia tidies the kitchen.','Піа прибирає кухню.'),
 ('Freitag','пятница','Friday','п''ятниця'),
 ('Öffnungszeit','часы работы','opening hours','години роботи'),
 ('in der Nacht','ночью','at night','уночі'),
 ('Mittag','полдень','noon','полудень'),
 ('Sie geht zum Deutschkurs.','Она идёт на курс немецкого языка.','She goes to German class.','Вона йде на курс німецької мови.'),
 ('spielen','играть','to play','грати'),
 ('Viertel vor …','без четверти …','quarter to …','за чверть …'),
 ('aufstehen (steht … auf)','вставать','to get up','вставати'),
 ('Deutschkurs','курс немецкого языка','German course','курс німецької мови'),
 ('Sie ruft ihre Familie an.','Она звонит своей семье.','She calls her family.','Вона телефонує своїй сім''ї.'),
 ('Dienstag','вторник','Tuesday','вівторок'),
 ('Nacht','ночь','night','ніч'),
 ('Uhr','часы; час','clock; o’clock','годинник / година (про час)'),
 ('Samstag','суббота','Saturday','субота'),
 ('jeden Tag','каждый день','every day','щодня / кожного дня'),
 ('schon','уже','already','уже'),
 ('hören (Musik hören)','слушать (слушать музыку)','to listen (to listen to music)','слухати (слухати музику)'),
 ('Sie kocht das Abendessen.','Она готовит ужин.','She cooks dinner.','Вона готує вечерю.'),
 ('Abendessen','ужин','dinner','вечеря'),
 ('Donnerstag','четверг','Thursday','четвер'),
 ('früh','рано','early','рано'),
 ('Café','кафе','café','кафе'),
 ('aufräumen (räumt … auf)','убирать; наводить порядок','to tidy up','прибирати'),
 ('chatten','переписываться в чате','to chat','спілкуватися в чаті'),
 ('spät','поздно','late','пізно'),
 ('Abend','вечер','evening','вечір'),
 ('Ich stehe um Viertel nach sieben auf.','Я встаю в четверть восьмого.','I get up at quarter past seven.','Я встаю о сьомій п''ятнадцять.'),
 ('müde','уставший','tired','втомлений / втомлена'),
 ('am Morgen / am Vormittag / am Mittag / am Nachmittag / am Abend','утром / до обеда / в полдень / днём / вечером','in the morning / late morning / at noon / in the afternoon / in the evening','уранці / до полудня / опівдні / після полудня / увечері'),
 ('anrufen (ruft … an)','звонить','to call','телефонувати'),
 ('gehen','идти; ходить','to go','іти / ходити'),
 ('Viertel nach …','четверть после …','quarter past …','чверть після … (15 хвилин)'),
 ('halb …','половина до …','half past …','пів на … (наступну годину)'),
 ('frühstücken','завтракать','to have breakfast','снідати'),
 ('erst','только; лишь','only; not until','лише / не раніше ніж'),
 ('Sonntag','воскресенье','Sunday','неділя'),
 ('kurz vor …','незадолго до …','shortly before …','незадовго до …'),
 ('Temperatur','температура','temperature','температура'),
 ('plus / minus','плюс / минус','plus / minus','плюс / мінус'),
 ('Freunde treffen','встречаться с друзьями','to meet friends','зустрічатися з друзями'),
 ('singen','петь','to sing','співати'),
 ('bringen','приносить; привозить','to bring','приносити / привозити'),
 ('Ich tanze gern. / Ich lese gern.','Я люблю танцевать. / Я люблю читать.','I like dancing. / I like reading.','Я люблю танцювати. / Я люблю читати.'),
 ('Herbst','осень','autumn','осінь'),
 ('Freizeit','свободное время','free time','вільний час'),
 ('Ich treffe am Wochenende Freunde.','Я встречаюсь с друзьями на выходных.','I meet friends at the weekend.','Я зустрічаюся з друзями на вихідних.'),
 ('bleiben','оставаться','to stay','залишатися'),
 ('Gitarre','гитара','guitar','гітара'),
 ('überall','везде','everywhere','скрізь / усюди'),
 ('heiß','жаркий; горячий','hot','гарячий / спекотний'),
 ('Regen','дождь','rain','дощ'),
 ('Idee','идея','idea','ідея'),
 ('einen Ausflug machen','совершить поездку; съездить на экскурсию','to go on a trip','вирушати на екскурсію / у поїздку'),
 ('Grad','градус','degree','градус'),
 ('Ausflug','экскурсия; поездка','excursion; trip','екскурсія / поїздка'),
 ('im Frühling / im Sommer / im Herbst / im Winter','весной / летом / осенью / зимой','in spring / in summer / in autumn / in winter','навесні / влітку / восени / взимку'),
 ('fotografieren','фотографировать','to take photographs','фотографувати'),
 ('Wir machen einen Ausflug.','Мы совершаем поездку.','We are going on a trip.','Ми вирушаємо на екскурсію.'),
 ('Auto','автомобиль','car','автомобіль'),
 ('losgehen','отправляться; начинать путь','to set off','вирушати'),
 ('fahren (fährt)','ехать; ездить','to drive; travel','їхати / їздити'),
 ('Die Sonne scheint.','Солнце светит.','The sun is shining.','Сонце світить.'),
 ('vergessen (vergisst)','забывать','to forget','забувати'),
 ('warm','тёплый','warm','теплий'),
 ('tanzen','танцевать','to dance','танцювати'),
 ('Mundharmonika','губная гармошка','harmonica','губна гармоніка'),
 ('Sonne','солнце','sun','сонце'),
 ('Sommer','лето','summer','літо'),
 ('Picknick','пикник','picnic','пікнік'),
 ('Fahrrad fahren','ездить на велосипеде','to ride a bicycle','їздити на велосипеді'),
 ('kalt','холодный','cold','холодний'),
 ('Winter','зима','winter','зима'),
 ('Hund','собака','dog','собака'),
 ('unter Null','ниже нуля','below zero','нижче нуля'),
 ('Durst','жажда','thirst','спрага'),
 ('schwimmen','плавать','to swim','плавати'),
 ('treffen (trifft)','встречать(ся)','to meet','зустрічати / зустрічатися'),
 ('Schnee','снег','snow','сніг'),
 ('viel / viele','много / многие','much / many','багато / численні'),
 ('Frühling','весна','spring','весна'),
 ('Es regnet. / Es schneit.','Идёт дождь. / Идёт снег.','It is raining. / It is snowing.','Іде дощ. / Іде сніг.'),
 ('Speisekarte','меню','menu','меню'),
 ('Was machst du in der Freizeit?','Что ты делаешь в свободное время?','What do you do in your free time?','Що ти робиш у вільний час?'),
 ('Es sind 25 Grad.','25 градусов.','It is 25 degrees.','Зараз 25 градусів.'),
 ('Auto fahren','водить машину','to drive','водити автомобіль'),
 ('doch','всё же; ведь','though; after all','усе ж / адже'),
 ('Gitarre spielen','играть на гитаре','to play the guitar','грати на гітарі'),
 ('vielleicht','возможно; может быть','perhaps; maybe','можливо / мабуть'),
 ('lesen (liest)','читать','to read','читати'),
 ('Fußball spielen','играть в футбол','to play football','грати у футбол'),
 ('möchten','хотеть; желать','would like','хотіти (ввічливе побажання)'),
 ('Wetterbericht','прогноз погоды','weather forecast','прогноз погоди'),
 ('scheinen (Die Sonne scheint.)','светить (Солнце светит.)','to shine (The sun is shining.)','світити (Сонце світить.)'),
 ('telefonieren','говорить по телефону','to talk on the phone','розмовляти телефоном'),
 ('wandern','ходить в походы; заниматься пешим туризмом','to hike','ходити в походи'),
 ('Wolke','облако','cloud','хмара'),
 ('grillen','жарить на гриле','to barbecue','смажити на грилі'),
 ('lieber (Ich tanze lieber.)','лучше; охотнее (Я лучше танцую.)','rather; preferably (I would rather dance.)','охочіше / радше (Я радше потанцюю.)'),
 ('Im Sommer ist es heiß.','Летом жарко.','It is hot in summer.','Улітку спекотно.'),
 ('schneien (Es schneit.)','идти (о снеге) (Идёт снег.)','to snow (It is snowing.)','сніжити (Іде сніг.)'),
 ('nehmen','брать','to take','брати'),
 ('Es ist warm / kalt / windig / bewölkt.','Тепло / холодно / ветрено / облачно.','It is warm / cold / windy / cloudy.','Тепло / холодно / вітряно / хмарно.'),
 ('Freund / Freundin','друг / подруга','male friend / female friend','друг / подруга'),
 ('Radio','радио','radio','радіо'),
 ('Wetter','погода','weather','погода'),
 ('Hobby','хобби','hobby','хобі / захоплення'),
 ('Fahrrad','велосипед','bicycle','велосипед'),
 ('sonnig','солнечный','sunny','сонячний'),
 ('Tennis spielen','играть в теннис','to play tennis','грати в теніс'),
 ('bewölkt','облачный','cloudy','хмарний'),
 ('wichtig','важный','important','важливий'),
 ('interessant','интересный','interesting','цікавий'),
 ('stricken','вязать','to knit','в''язати'),
 ('regnen (Es regnet.)','идти (о дожде) (Идёт дождь.)','to rain (It is raining.)','дощити (Іде дощ.)'),
 ('windig','ветреный','windy','вітряний'),
 ('Internet','интернет','internet','інтернет'),
 ('prima / super','отлично; супер','great / super','чудово / супер'),
 ('pünktlich','пунктуальный; вовремя','punctual; on time','пунктуальний / вчасно'),
 ('Unterricht','занятие; урок','lesson; class','урок / заняття'),
 ('reiten','ездить верхом','to ride a horse','їздити верхи'),
 ('gestern','вчера','yesterday','учора'),
 ('krank','больной; больна','ill; sick','хворий / хвора'),
 ('lernen','учить; учиться','to learn; study','учити / навчатися'),
 ('wollen (will, willst, wollen)','хотеть','to want','хотіти'),
 ('Ich kann nicht in die Schule gehen. Ich bin krank.','Я не могу идти в школу. Я болен / больна.','I can''t go to school. I am ill.','Я не можу йти до школи. Я хворий / хвора.'),
 ('auf jeden Fall','в любом случае; обязательно','in any case; definitely','у будь-якому разі / обов''язково'),
 ('Klavier spielen','играть на пианино','to play the piano','грати на піаніно'),
 ('Wir sind ein prima Team!','Мы отличная команда!','We are a great team!','Ми чудова команда!'),
 ('Am Nachmittag kommt Lea nach Hause.','Днём Леа приходит домой.','In the afternoon Lea comes home.','Після полудня Леа приходить додому.'),
 ('schreiben','писать','to write','писати'),
 ('kaufen → hat gekauft','покупать → купил','to buy → bought','купувати → купив'),
 ('Kannst du Timo aufwecken?','Ты можешь разбудить Тимо?','Can you wake Timo up?','Ти можеш розбудити Тімо?'),
 ('Arzt','врач','doctor','лікар'),
 ('nach Hause / heim','домой','home','додому'),
 ('Ärztin','женщина-врач','female doctor','лікарка'),
 ('machen → hat gemacht','делать → сделал','to do/make → did/made','робити → зробив'),
 ('Fehler','ошибка','mistake; error','помилка'),
 ('heute','сегодня','today','сьогодні'),
 ('Das Abendessen ist fertig.','Ужин готов.','Dinner is ready.','Вечеря готова.'),
 ('lernen → hat gelernt','учить → выучил','to learn → learned','учити → вивчив'),
 ('Note','оценка','grade; mark','оцінка'),
 ('Test','тест','test','тест'),
 ('Team','команда','team','команда'),
 ('aufwecken (weckt … auf)','будить','to wake someone up','будити'),
 ('Jonas hat Englisch gelernt.','Йонас учил английский.','Jonas learned English.','Йонас вивчав англійську мову.'),
 ('Bauchweh','боль в животе','stomach ache','біль у животі'),
 ('backen','печь','to bake','пекти'),
 ('schreiben → hat geschrieben','писать → написал','to write → wrote','писати → написав'),
 ('schmecken','быть вкусным; иметь вкус','to taste','смакувати / мати смак'),
 ('Schule','школа','school','школа'),
 ('Kurs','курс','course','курс'),
 ('können (kann, kannst, können)','мочь; уметь','can; be able to','могти / уміти'),
 ('Frühstück','завтрак','breakfast','сніданок'),
 ('Schüler / Schülerin','ученик / ученица','male student / female student','учень / учениця'),
 ('fertig','готовый; законченный','ready; finished','готовий / завершений'),
 ('Das hat richtig Spaß gemacht.','Это было действительно весело.','That was really fun.','Було справді дуже весело.'),
 ('Prüfung','экзамен','exam','іспит'),
 ('kommen','приходить; приезжать','to come','приходити / приїжджати'),
 ('Mathematik / Mathe','математика','mathematics / maths','математика')
) AS t(word_de,translation_ru,translation_en,translation_uk)
WHERE c.word_de=t.word_de AND c.translation_ru IS NOT DISTINCT FROM t.translation_ru
 AND c.translation_en IS NOT DISTINCT FROM t.translation_en AND nullif(btrim(c.translation_uk),'') IS NULL;

-- 2026-09-13: Stable central notes and normalized grammar topic labels
-- Add one stable central board per student without deleting the previous notes.
-- Apply before deploying the note-only save action. Existing staff RLS/CRUD stays intact.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE public.teacher_student_notes
  ADD COLUMN is_blackboard boolean NOT NULL DEFAULT false;

-- Keep exactly the note selected by the previous min-id reader visible today.
WITH canonical AS (
  SELECT DISTINCT ON (student_id) id
  FROM public.teacher_student_notes
  ORDER BY student_id, id
)
UPDATE public.teacher_student_notes note
SET is_blackboard = true
FROM canonical
WHERE note.id = canonical.id;

CREATE UNIQUE INDEX teacher_student_notes_one_blackboard_idx
  ON public.teacher_student_notes(student_id) WHERE is_blackboard;

COMMENT ON COLUMN public.teacher_student_notes.is_blackboard IS
  'Stable central student board. Other rows retain legacy notes and discounts.';

CREATE FUNCTION public.save_student_blackboard(
  p_student_id uuid,
  p_note_text text,
  p_expected_note_id uuid DEFAULT NULL
)
RETURNS SETOF public.teacher_student_notes
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  actor uuid := (SELECT auth.uid());
  board public.teacher_student_notes%ROWTYPE;
  prose text;
BEGIN
  IF actor IS NULL OR coalesce(monthly_booking_private.current_profile_role(), '')
    NOT IN ('teacher', 'admin') THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF p_note_text IS NULL OR char_length(p_note_text) > 5000
    OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_student_id) THEN
    RAISE EXCEPTION 'Invalid student or note' USING ERRCODE = '23514';
  END IF;
  prose := btrim(p_note_text);

  -- This lock also covers the first save, when there is no row to lock yet.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('student-blackboard:' || p_student_id::text, 0)
  );
  SELECT * INTO board FROM public.teacher_student_notes
  WHERE student_id = p_student_id
  ORDER BY is_blackboard DESC, id
  LIMIT 1 FOR UPDATE;

  -- A stale/foreign note ID must never update another student's note or silently
  -- switch the central board. Null IDs from simultaneous first saves are safe.
  IF p_expected_note_id IS NOT NULL AND p_expected_note_id IS DISTINCT FROM board.id THEN
    RAISE EXCEPTION 'The central note changed; reload and retry' USING ERRCODE = '40001';
  END IF;
  IF board.id IS NULL THEN
    IF prose = '' THEN RETURN; END IF;
    RETURN QUERY INSERT INTO public.teacher_student_notes
      (student_id, teacher_id, note_text, is_blackboard)
      VALUES (p_student_id, actor, prose, true)
      RETURNING *;
  ELSE
    -- Clearing retains the canonical identity, so an older note cannot reappear.
    -- Discount metadata and the original author are never changed by this RPC.
    RETURN QUERY UPDATE public.teacher_student_notes
      SET note_text = CASE WHEN prose = '' THEN U&'\2060' ELSE prose END,
          is_blackboard = true
      WHERE id = board.id AND student_id = p_student_id
      RETURNING *;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.save_student_blackboard(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_student_blackboard(uuid, text, uuid) TO authenticated;
COMMIT;

-- Align the two preserved legacy exercises with their canonical topic titles.
UPDATE public.exercises SET topic='Sein und sich vorstellen'
WHERE level='A1.1' AND lesson='A1.1 · 01' AND topic='Verbkonjugation (sein)';
UPDATE public.exercises SET topic='Artikel im Nominativ'
WHERE level='A1.1' AND lesson='A1.1 · 03' AND topic='Artikel';
