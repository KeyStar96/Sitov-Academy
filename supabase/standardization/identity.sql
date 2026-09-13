-- Apply after foundation.sql, within the standardization transaction.
-- Historical migrations are retained separately; this is the canonical identity contract.
CREATE SCHEMA IF NOT EXISTS identity_private;
REVOKE ALL ON SCHEMA identity_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA identity_private TO authenticated, service_role;
CREATE OR REPLACE FUNCTION identity_private.current_profile_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT role FROM public.profiles WHERE id=(SELECT auth.uid()) AND (SELECT auth.uid()) IS NOT NULL
$$;
REVOKE ALL ON FUNCTION identity_private.current_profile_role() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION identity_private.current_profile_role() TO authenticated,service_role;

-- Removing the old read view is deferred to cleanup.sql, after its consumers migrate.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_native_language_check;
UPDATE public.profiles SET native_language=CASE native_language
 WHEN 'Deutsch' THEN 'de' WHEN 'Englisch' THEN 'en' WHEN 'Russisch' THEN 'ru'
 WHEN 'Türkisch' THEN 'tr' WHEN 'Ukrainisch' THEN 'uk'
 WHEN 'de' THEN 'de' WHEN 'en' THEN 'en' WHEN 'ru' THEN 'ru' WHEN 'tr' THEN 'tr' WHEN 'uk' THEN 'uk'
 ELSE NULL END;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_native_language_fkey FOREIGN KEY(native_language) REFERENCES public.locales(code);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_ui_language_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_ui_language_fkey FOREIGN KEY(ui_language) REFERENCES public.locales(code);
ALTER TABLE public.people DROP CONSTRAINT IF EXISTS people_preferred_locale_check;
ALTER TABLE public.people ADD CONSTRAINT people_preferred_locale_fkey FOREIGN KEY(preferred_locale) REFERENCES public.locales(code);
-- Stripe columns are removed in cleanup.sql after the dependent old view is removed.
UPDATE auth.users u SET raw_user_meta_data=(coalesce(u.raw_user_meta_data,'{}')-'name') ||
 jsonb_build_object('native_language',p.native_language,'display_name',person.display_name)
 FROM public.profiles p JOIN public.people person ON person.auth_user_id=p.id WHERE u.id=p.id;

CREATE OR REPLACE FUNCTION business_private.provision_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE native text; locale text; display_name text;
BEGIN
 native:=CASE WHEN new.raw_user_meta_data->>'native_language' IN('de','en','ru','uk','tr') THEN new.raw_user_meta_data->>'native_language' END;
 locale:=CASE WHEN new.raw_user_meta_data->>'ui_language' IN('de','en','ru','uk','tr') THEN new.raw_user_meta_data->>'ui_language' ELSE coalesce(native,'de') END;
 display_name:=left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'),''),split_part(new.email,'@',1),'Student'),160);
 INSERT INTO public.profiles(id,role,native_language,ui_language) VALUES(new.id,'student',native,locale) ON CONFLICT(id) DO NOTHING;
 -- A signup always receives its own fresh person. No unverified address lookup.
 INSERT INTO public.people(auth_user_id,display_name,email,preferred_locale)
 VALUES(new.id,display_name,coalesce(new.email,''),locale) ON CONFLICT(auth_user_id) DO NOTHING;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION business_private.provision_profile() FROM PUBLIC,anon,authenticated;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.claim_verified_person() RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$SELECT business_private.claim_person()$$;
REVOKE ALL ON FUNCTION public.claim_verified_person() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_verified_person() TO authenticated;
DROP FUNCTION IF EXISTS public.claim_verified_legacy_profile();

-- Profiles remain protected against role/identity mass assignment, even for staff.
DO $$ DECLARE policy_name text; BEGIN
 FOR policy_name IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='profiles' LOOP
  EXECUTE format('DROP POLICY %I ON public.profiles',policy_name);
 END LOOP;
END $$;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles FROM anon,authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE(native_language,ui_language) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated USING(
 id=(SELECT auth.uid()) OR (SELECT identity_private.current_profile_role()) IN('teacher','admin'));
CREATE POLICY profiles_update_preferences ON public.profiles FOR UPDATE TO authenticated
 USING(id=(SELECT auth.uid())) WITH CHECK(id=(SELECT auth.uid()));

-- Contact data is readable only by its verified account or staff. Email and linkage
-- stay outside client UPDATE grants and are maintained by verified Auth operations.
DO $$ DECLARE policy_name text; BEGIN
 FOR policy_name IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='people' LOOP
  EXECUTE format('DROP POLICY %I ON public.people',policy_name);
 END LOOP;
END $$;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.people FROM anon,authenticated;
GRANT SELECT ON public.people TO authenticated;
GRANT UPDATE(display_name,phone,street,postal_code,city,preferred_locale) ON public.people TO authenticated;
GRANT ALL ON public.people TO service_role;
CREATE POLICY people_read ON public.people FOR SELECT TO authenticated USING(auth_user_id=(SELECT auth.uid()) OR (SELECT identity_private.current_profile_role()) IN('teacher','admin'));
CREATE POLICY people_update_contact ON public.people FOR UPDATE TO authenticated
 USING(auth_user_id=(SELECT auth.uid()) OR (SELECT identity_private.current_profile_role()) IN('teacher','admin'))
 WITH CHECK(auth_user_id=(SELECT auth.uid()) OR (SELECT identity_private.current_profile_role()) IN('teacher','admin'));

-- Preserve all existing note prose in a single canonical row. Refuse truncation.
DROP TRIGGER IF EXISTS validate_teacher_student_note ON public.teacher_student_notes;
DROP FUNCTION IF EXISTS monthly_booking_private.validate_teacher_note();
DROP FUNCTION IF EXISTS public.save_student_blackboard(uuid,text,uuid);
ALTER TABLE public.teacher_student_notes DROP CONSTRAINT IF EXISTS teacher_student_notes_note_text_check;
DO $$ DECLARE student uuid; canonical uuid; combined text; BEGIN
 FOR student IN SELECT DISTINCT student_id FROM public.teacher_student_notes LOOP
  SELECT id INTO canonical FROM public.teacher_student_notes WHERE student_id=student ORDER BY is_blackboard DESC,id LIMIT 1;
  SELECT string_agg(prose,E'\n\n' ORDER BY is_blackboard DESC,id) INTO combined FROM
   (SELECT id,is_blackboard,btrim(replace(note_text,U&'\2060','')) prose FROM public.teacher_student_notes WHERE student_id=student) notes WHERE prose<>'';
  IF length(coalesce(combined,''))>5000 THEN RAISE EXCEPTION 'Combined note exceeds limit; review backed-up student notes before migration'; END IF;
  UPDATE public.teacher_student_notes SET note_text=coalesce(combined,'') WHERE id=canonical;
  DELETE FROM public.teacher_student_notes WHERE student_id=student AND id<>canonical;
 END LOOP;
END $$;
ALTER TABLE public.teacher_student_notes DROP COLUMN discount_percent,DROP COLUMN is_blackboard;
ALTER TABLE public.teacher_student_notes ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
 ADD CONSTRAINT teacher_student_notes_student_unique UNIQUE(student_id),
 ADD CONSTRAINT teacher_student_notes_text_length CHECK(length(note_text)<=5000);
DROP INDEX IF EXISTS public.teacher_student_notes_student_idx;

CREATE FUNCTION identity_private.validate_teacher_note() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF new.id IS DISTINCT FROM old.id OR new.student_id IS DISTINCT FROM old.student_id OR new.teacher_id IS DISTINCT FROM old.teacher_id OR new.created_at IS DISTINCT FROM old.created_at THEN
   RAISE check_violation USING message='Note identity and authorship are immutable';
  END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=new.student_id AND role='student') OR
     NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=new.teacher_id AND role IN('teacher','admin')) THEN
   RAISE check_violation USING message='Invalid student or teacher';
  END IF;
 END IF;
 new.updated_at:=now();
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION identity_private.validate_teacher_note() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER validate_teacher_student_note BEFORE INSERT OR UPDATE ON public.teacher_student_notes FOR EACH ROW EXECUTE FUNCTION identity_private.validate_teacher_note();
DO $$ DECLARE policy_name text; BEGIN
 FOR policy_name IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='teacher_student_notes' LOOP
  EXECUTE format('DROP POLICY %I ON public.teacher_student_notes',policy_name);
 END LOOP;
END $$;
ALTER TABLE public.teacher_student_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.teacher_student_notes FROM anon,authenticated;
GRANT SELECT,DELETE ON public.teacher_student_notes TO authenticated;
GRANT INSERT(student_id,teacher_id,note_text),UPDATE(note_text) ON public.teacher_student_notes TO authenticated;
GRANT ALL ON public.teacher_student_notes TO service_role;
CREATE POLICY teacher_notes_read ON public.teacher_student_notes FOR SELECT TO authenticated USING((SELECT identity_private.current_profile_role()) IN('teacher','admin'));
CREATE POLICY teacher_notes_insert ON public.teacher_student_notes FOR INSERT TO authenticated WITH CHECK((SELECT identity_private.current_profile_role()) IN('teacher','admin') AND teacher_id=(SELECT auth.uid()));
CREATE POLICY teacher_notes_update ON public.teacher_student_notes FOR UPDATE TO authenticated USING((SELECT identity_private.current_profile_role()) IN('teacher','admin')) WITH CHECK((SELECT identity_private.current_profile_role()) IN('teacher','admin'));
CREATE POLICY teacher_notes_delete ON public.teacher_student_notes FOR DELETE TO authenticated USING((SELECT identity_private.current_profile_role()) IN('teacher','admin'));

CREATE FUNCTION public.save_student_blackboard(p_student_id uuid,p_note_text text,p_expected_note_id uuid DEFAULT NULL)
RETURNS SETOF public.teacher_student_notes LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); board public.teacher_student_notes; prose text;
BEGIN
 IF actor IS NULL OR coalesce(identity_private.current_profile_role(),'') NOT IN('teacher','admin') THEN RAISE insufficient_privilege; END IF;
 IF p_note_text IS NULL OR length(p_note_text)>5000 OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_student_id AND role='student') THEN
  RAISE check_violation USING message='Invalid student or note';
 END IF;
 prose:=btrim(p_note_text);
 PERFORM pg_advisory_xact_lock(hashtextextended('student-note:'||p_student_id::text,0));
 SELECT * INTO board FROM public.teacher_student_notes WHERE student_id=p_student_id FOR UPDATE;
 IF p_expected_note_id IS NOT NULL AND p_expected_note_id IS DISTINCT FROM board.id THEN
  RAISE EXCEPTION 'The note changed; reload and retry' USING ERRCODE='PT409';
 END IF;
 IF board.id IS NULL THEN
  IF prose='' THEN RETURN; END IF;
  RETURN QUERY INSERT INTO public.teacher_student_notes(student_id,teacher_id,note_text) VALUES(p_student_id,actor,prose) RETURNING *;
 ELSE
  RETURN QUERY UPDATE public.teacher_student_notes SET note_text=prose WHERE id=board.id AND student_id=p_student_id RETURNING *;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.save_student_blackboard(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_student_blackboard(uuid,text,uuid) TO authenticated,service_role;
