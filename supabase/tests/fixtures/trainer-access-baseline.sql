-- Isolated baseline composed from existing vocabulary, grammar and pronunciation test fixtures.

   CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
   CREATE SCHEMA auth;
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
   GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
   CREATE TABLE public.profiles(id uuid PRIMARY KEY,role text,allowed_levels text[],native_language text,ui_language text);
   CREATE TABLE public.vocabulary_cards(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),word_de text NOT NULL,lesson text NOT NULL,level text NOT NULL,
    is_hard_for_ru boolean DEFAULT false,is_hard_for_tr boolean DEFAULT false);
   CREATE TABLE public.user_vocabulary_progress(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    card_id uuid NOT NULL REFERENCES vocabulary_cards(id) ON DELETE CASCADE,box_number integer DEFAULT 1 CHECK(box_number BETWEEN 1 AND 7),
    next_review_date timestamptz DEFAULT now(),created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),lapses integer NOT NULL DEFAULT 0,
    last_answered_at timestamptz,UNIQUE(user_id,card_id));
   GRANT SELECT ON profiles,vocabulary_cards TO authenticated;
   GRANT SELECT,INSERT,UPDATE,DELETE ON user_vocabulary_progress TO authenticated;
   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
   CREATE POLICY profile_read ON profiles FOR SELECT TO authenticated USING (auth.uid()=id);
   ALTER TABLE vocabulary_cards ENABLE ROW LEVEL SECURITY;
   CREATE POLICY cards_read ON vocabulary_cards FOR SELECT TO authenticated USING (true);
   ALTER TABLE user_vocabulary_progress ENABLE ROW LEVEL SECURITY;
   CREATE POLICY legacy_owned ON user_vocabulary_progress TO authenticated USING(auth.uid()=user_id) WITH CHECK(auth.uid()=user_id);
     CREATE SCHEMA storage; CREATE SCHEMA monthly_booking_private;
  GRANT USAGE ON SCHEMA public,auth,storage,monthly_booking_private TO authenticated;
  CREATE FUNCTION monthly_booking_private.current_profile_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT role FROM public.profiles WHERE id=(SELECT auth.uid()) AND (SELECT auth.uid()) IS NOT NULL$$;
  REVOKE ALL ON FUNCTION monthly_booking_private.current_profile_role() FROM PUBLIC,anon;
  GRANT EXECUTE ON FUNCTION monthly_booking_private.current_profile_role() TO authenticated;
  CREATE TABLE pronunciation_prompts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),cefr_level text NOT NULL,sentence_de text NOT NULL,focus text,audio_url text,sort_order integer NOT NULL DEFAULT 0,created_at timestamptz DEFAULT now());
  CREATE TABLE submissions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES profiles(id),type text NOT NULL,content_url text,text_content text,status text DEFAULT 'pending',created_at timestamptz DEFAULT now(),level text NOT NULL,attempt_number int DEFAULT 1,parent_id uuid REFERENCES submissions(id));
  CREATE TABLE teacher_feedback(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),submission_id uuid REFERENCES submissions(id),teacher_id uuid REFERENCES profiles(id),feedback_text text,feedback_audio_url text,created_at timestamptz DEFAULT now(),seen_at timestamptz);
  CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text REFERENCES storage.buckets(id),name text,owner_id text);
  CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array(regexp_replace(name,'/[^/]+$',''),'/') $$;
  ALTER TABLE submissions ENABLE ROW LEVEL SECURITY; ALTER TABLE teacher_feedback ENABLE ROW LEVEL SECURITY; ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  CREATE POLICY own_submission ON submissions FOR SELECT TO authenticated USING(user_id=auth.uid() OR monthly_booking_private.current_profile_role() IN('teacher','admin'));
  CREATE POLICY own_feedback ON teacher_feedback FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM submissions WHERE id=submission_id));
  CREATE POLICY "Nutzer können Übungssätze sehen" ON pronunciation_prompts FOR SELECT TO authenticated USING(auth.uid() IS NOT NULL);
  CREATE POLICY "Admins und Lehrer dürfen Übungssätze einfügen" ON pronunciation_prompts FOR INSERT TO authenticated WITH CHECK(monthly_booking_private.current_profile_role() IN('teacher','admin'));
  CREATE POLICY "Admins und Lehrer dürfen Übungssätze bearbeiten" ON pronunciation_prompts FOR UPDATE TO authenticated USING(monthly_booking_private.current_profile_role() IN('teacher','admin'));
  CREATE POLICY "Admins und Lehrer dürfen Übungssätze löschen" ON pronunciation_prompts FOR DELETE TO authenticated USING(monthly_booking_private.current_profile_role() IN('teacher','admin'));
  GRANT SELECT ON profiles,submissions,teacher_feedback TO authenticated;
  GRANT SELECT,INSERT,UPDATE,DELETE ON pronunciation_prompts TO authenticated;
  GRANT SELECT,INSERT ON storage.objects TO authenticated;
  
ALTER TABLE pronunciation_prompts ENABLE ROW LEVEL SECURITY;      CREATE TABLE exercises(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), level text NOT NULL, lesson text NOT NULL,
        topic text NOT NULL, type text NOT NULL, content jsonb NOT NULL, hint_ru text, hint_tr text, solution_audio_url text);
      CREATE TABLE user_exercise_progress(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES profiles,
        exercise_id uuid REFERENCES exercises ON DELETE CASCADE, attempts int NOT NULL DEFAULT 0, completed boolean DEFAULT false,
        score int, hint_shown boolean NOT NULL DEFAULT false, updated_at timestamptz, UNIQUE(user_id,exercise_id));

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_exercise_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY read_exercises ON exercises FOR SELECT TO authenticated USING(true);
GRANT SELECT ON exercises,user_exercise_progress TO authenticated;
CREATE TABLE videos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),level text);
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY read_videos ON videos FOR SELECT TO authenticated USING(true);
GRANT SELECT ON videos TO authenticated;
-- Reset subsystem is independently covered by learning-reset.test.mjs.
CREATE SCHEMA learning_reset_private;
GRANT USAGE ON SCHEMA learning_reset_private TO authenticated;
CREATE FUNCTION learning_reset_private.can_remove_audio(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
