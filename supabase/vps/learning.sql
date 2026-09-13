-- VPS-only learning normalization. Run after business.sql, with the application stopped.
-- Root deployment owns backups and the explicitly authorized reset of learner data/files.
-- Catalog identities and every authored text are retained. Never run on Cloud Supabase.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='180s';

DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.vocabulary_direction_progress)
 OR EXISTS(SELECT 1 FROM public.user_vocabulary_progress)
 OR EXISTS(SELECT 1 FROM public.user_exercise_progress)
 OR EXISTS(SELECT 1 FROM public.submissions)
 OR EXISTS(SELECT 1 FROM public.teacher_feedback)
 OR EXISTS(SELECT 1 FROM public.pronunciation_messages) THEN
  RAISE EXCEPTION 'Stop: learner progress/conversations must be reset by the approved deployment first';
 END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS learning_private;
REVOKE ALL ON SCHEMA learning_private FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA learning_private TO authenticated,service_role;

CREATE TABLE public.learning_levels (
 code text PRIMARY KEY,
 cefr_level text NOT NULL CHECK(cefr_level IN('A1','A2','B1','B2','C1','C2')),
 sort_order smallint NOT NULL UNIQUE CHECK(sort_order>0)
);
INSERT INTO public.learning_levels VALUES
 ('A1.1','A1',1),('A1.2','A1',2),('A2.1','A2',3),('A2.2','A2',4),('B1.1','B1',5),('B1.2','B1',6);
CREATE TABLE public.learning_units (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 level text NOT NULL REFERENCES public.learning_levels(code),
 trainer text NOT NULL CHECK(trainer IN('vocabulary','exercises','pronunciation','videos')),
 label text NOT NULL CHECK(length(btrim(label)) BETWEEN 1 AND 160),
 sort_order integer NOT NULL DEFAULT 0,
 is_active boolean NOT NULL DEFAULT true,
 UNIQUE(id,level,trainer)
);
CREATE UNIQUE INDEX learning_units_named_lesson_idx ON public.learning_units(level,trainer,label)
 WHERE trainer IN('vocabulary','exercises');
CREATE INDEX learning_units_catalog_idx ON public.learning_units(level,trainer,sort_order,id);
CREATE TABLE public.student_level_access (
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 level text NOT NULL REFERENCES public.learning_levels(code),
 PRIMARY KEY(user_id,level)
);
INSERT INTO public.student_level_access SELECT p.id,l.code FROM public.profiles p
 JOIN public.learning_levels l ON l.code=ANY(p.allowed_levels);
CREATE TABLE public.learning_trainer_grants (
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 level text NOT NULL REFERENCES public.learning_levels(code),
 trainer text NOT NULL CHECK(trainer IN('vocabulary','exercises','pronunciation','videos')),
 enabled boolean NOT NULL,
 unit_mode text NOT NULL DEFAULT 'all' CHECK(unit_mode IN('all','selected')),
 PRIMARY KEY(user_id,level,trainer)
);
CREATE TABLE public.learning_unit_grants (
 user_id uuid NOT NULL, level text NOT NULL, trainer text NOT NULL, unit_id uuid NOT NULL,
 PRIMARY KEY(user_id,level,trainer,unit_id),
 FOREIGN KEY(user_id,level,trainer) REFERENCES public.learning_trainer_grants(user_id,level,trainer) ON DELETE CASCADE,
 FOREIGN KEY(unit_id,level,trainer) REFERENCES public.learning_units(id,level,trainer) ON DELETE CASCADE
);
CREATE INDEX learning_unit_grants_unit_idx ON public.learning_unit_grants(unit_id);
INSERT INTO public.learning_units(level,trainer,label,sort_order)
 SELECT level,'vocabulary',lesson,row_number() OVER(PARTITION BY level ORDER BY lesson)
 FROM public.vocabulary_cards GROUP BY level,lesson;
INSERT INTO public.learning_units(level,trainer,label,sort_order)
 SELECT level,'exercises',lesson,row_number() OVER(PARTITION BY level ORDER BY lesson)
 FROM public.exercises GROUP BY level,lesson;
-- Preserve old inactive family-only texts, but never publish them by guessing a level.
INSERT INTO public.learning_units(id,level,trainer,label,sort_order,is_active)
 SELECT id,coalesce(level,cefr_level||'.1'),'pronunciation',coalesce(nullif(title,''),left(sentence_de,120)),sort_order,is_active AND level IS NOT NULL
 FROM public.pronunciation_prompts WHERE coalesce(level,cefr_level||'.1') IN(SELECT code FROM public.learning_levels);
INSERT INTO public.learning_units(id,level,trainer,label,sort_order)
 SELECT id,level,'videos',title,row_number() OVER(PARTITION BY level ORDER BY created_at,id) FROM public.videos;
INSERT INTO public.learning_trainer_grants SELECT user_id,level,trainer,enabled,
 CASE WHEN allowed_lessons IS NULL THEN 'all' ELSE 'selected' END FROM public.student_trainer_access;
INSERT INTO public.learning_unit_grants
 SELECT DISTINCT a.user_id,a.level,a.trainer,u.id FROM public.student_trainer_access a
 JOIN public.learning_units u ON u.level=a.level AND u.trainer=a.trainer
 AND (u.id::text=ANY(a.allowed_lessons) OR u.label=ANY(a.allowed_lessons));

-- Capture all original rows inside this transaction for exact-content assertions.
CREATE TEMP TABLE learning_catalog_before ON COMMIT DROP AS
 SELECT 'vocabulary' trainer,id,to_jsonb(c) payload FROM public.vocabulary_cards c
 UNION ALL SELECT 'exercises',id,to_jsonb(e) FROM public.exercises e
 UNION ALL SELECT 'pronunciation',id,to_jsonb(p) FROM public.pronunciation_prompts p
 UNION ALL SELECT 'videos',id,to_jsonb(v) FROM public.videos v;

-- Drop only policies on the objects being replaced; each backing table gets new RLS below.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT schemaname,tablename,policyname FROM pg_policies WHERE schemaname='public'
 AND tablename IN('vocabulary_cards','exercises','pronunciation_prompts','videos','student_trainer_access') LOOP
  EXECUTE format('DROP POLICY %I ON %I.%I',p.policyname,p.schemaname,p.tablename);
 END LOOP;
END $$;
ALTER TABLE public.vocabulary_cards RENAME TO learning_vocabulary_cards;
ALTER TABLE public.exercises RENAME TO learning_exercises;
ALTER TABLE public.pronunciation_prompts RENAME TO learning_reading_texts;
ALTER TABLE public.videos RENAME TO learning_videos;
ALTER TABLE public.learning_vocabulary_cards ADD COLUMN unit_id uuid REFERENCES public.learning_units(id);
ALTER TABLE public.learning_exercises ADD COLUMN unit_id uuid REFERENCES public.learning_units(id);
ALTER TABLE public.learning_reading_texts ADD COLUMN unit_id uuid UNIQUE REFERENCES public.learning_units(id);
ALTER TABLE public.learning_videos ADD COLUMN unit_id uuid UNIQUE REFERENCES public.learning_units(id);
UPDATE public.learning_vocabulary_cards c SET unit_id=u.id FROM public.learning_units u WHERE u.level=c.level AND u.trainer='vocabulary' AND u.label=c.lesson;
UPDATE public.learning_exercises e SET unit_id=u.id FROM public.learning_units u WHERE u.level=e.level AND u.trainer='exercises' AND u.label=e.lesson;
UPDATE public.learning_reading_texts SET unit_id=id WHERE id IN(SELECT id FROM public.learning_units WHERE trainer='pronunciation');
UPDATE public.learning_videos SET unit_id=id;
ALTER TABLE public.learning_vocabulary_cards ALTER COLUMN unit_id SET NOT NULL;
ALTER TABLE public.learning_exercises ALTER COLUMN unit_id SET NOT NULL;
ALTER TABLE public.learning_videos ALTER COLUMN unit_id SET NOT NULL;
CREATE INDEX learning_vocabulary_unit_idx ON public.learning_vocabulary_cards(unit_id);
CREATE INDEX learning_exercises_unit_idx ON public.learning_exercises(unit_id);

-- A content row can never point at another trainer's unit, including direct staff SQL.
CREATE FUNCTION learning_private.validate_content_unit() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.unit_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.learning_units WHERE id=NEW.unit_id AND trainer=TG_ARGV[0]) THEN
  RAISE EXCEPTION 'Content unit has the wrong trainer' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION learning_private.validate_content_unit() FROM PUBLIC,anon;
CREATE TRIGGER validate_unit BEFORE INSERT OR UPDATE OF unit_id ON public.learning_vocabulary_cards FOR EACH ROW EXECUTE FUNCTION learning_private.validate_content_unit('vocabulary');
CREATE TRIGGER validate_unit BEFORE INSERT OR UPDATE OF unit_id ON public.learning_exercises FOR EACH ROW EXECUTE FUNCTION learning_private.validate_content_unit('exercises');
CREATE TRIGGER validate_unit BEFORE INSERT OR UPDATE OF unit_id ON public.learning_reading_texts FOR EACH ROW EXECUTE FUNCTION learning_private.validate_content_unit('pronunciation');
CREATE TRIGGER validate_unit BEFORE INSERT OR UPDATE OF unit_id ON public.learning_videos FOR EACH ROW EXECUTE FUNCTION learning_private.validate_content_unit('videos');

CREATE TABLE public.vocabulary_translations (
 card_id uuid NOT NULL REFERENCES public.learning_vocabulary_cards(id) ON DELETE CASCADE,
 locale text NOT NULL CHECK(locale IN('de','en','ru','uk','tr')),
 translation text,
 context_sentence text,
 is_difficult boolean NOT NULL DEFAULT false,
 PRIMARY KEY(card_id,locale)
);
INSERT INTO public.vocabulary_translations
 SELECT c.id,l.locale,to_jsonb(c)->>('translation_'||l.locale),to_jsonb(c)->>('context_sentence_'||l.locale),
 coalesce((to_jsonb(c)->>('is_hard_for_'||l.locale))::boolean,false)
 FROM public.learning_vocabulary_cards c CROSS JOIN (VALUES('de'),('en'),('ru'),('uk'),('tr')) l(locale);
CREATE TABLE public.grammar_translations (
 exercise_id uuid NOT NULL REFERENCES public.learning_exercises(id) ON DELETE CASCADE,
 locale text NOT NULL CHECK(length(locale) BETWEEN 2 AND 20),
 hint text, smart_hint text, explanation text,
 PRIMARY KEY(exercise_id,locale)
);
INSERT INTO public.grammar_translations
 SELECT e.id,l.locale,
 CASE WHEN jsonb_typeof(e.hint)='object' THEN e.hint->>l.locale END,
 CASE WHEN jsonb_typeof(e.content->'smart_hint')='object' THEN e.content->'smart_hint'->>l.locale WHEN l.locale='de' THEN e.content->>'smart_hint' END,
 CASE WHEN jsonb_typeof(e.content->'explanation')='object' THEN e.content->'explanation'->>l.locale WHEN l.locale='de' THEN e.content->>'explanation' END
 FROM public.learning_exercises e CROSS JOIN LATERAL (
 SELECT jsonb_object_keys(CASE WHEN jsonb_typeof(e.hint)='object' THEN e.hint ELSE '{}'::jsonb END) locale
 UNION SELECT jsonb_object_keys(CASE WHEN jsonb_typeof(e.content->'smart_hint')='object' THEN e.content->'smart_hint' ELSE '{}'::jsonb END)
 UNION SELECT jsonb_object_keys(CASE WHEN jsonb_typeof(e.content->'explanation')='object' THEN e.content->'explanation' ELSE '{}'::jsonb END)
 UNION SELECT 'de' WHERE jsonb_typeof(e.content->'smart_hint')='string' OR jsonb_typeof(e.content->'explanation')='string'
 ) l;
UPDATE public.learning_exercises SET content=content-'smart_hint'-'explanation';
ALTER TABLE public.learning_exercises ADD COLUMN content_version smallint NOT NULL DEFAULT 1 CHECK(content_version=1);
ALTER TABLE public.learning_exercises ADD CONSTRAINT grammar_content_object CHECK(jsonb_typeof(content)='object');
ALTER TABLE public.learning_exercises DROP COLUMN lesson,DROP COLUMN level,DROP COLUMN hint;
ALTER TABLE public.learning_vocabulary_cards DROP CONSTRAINT IF EXISTS vocabulary_sentence_target_check;
ALTER TABLE public.learning_vocabulary_cards DROP COLUMN lesson,DROP COLUMN level,
 DROP COLUMN translation_en,DROP COLUMN translation_ru,DROP COLUMN translation_tr,DROP COLUMN translation_uk,
 DROP COLUMN context_sentence_de,DROP COLUMN context_sentence_en,DROP COLUMN context_sentence_ru,DROP COLUMN context_sentence_uk,DROP COLUMN context_sentence_tr,
 DROP COLUMN is_hard_for_ru,DROP COLUMN is_hard_for_tr;
-- Keep legacy family-only texts verbatim in the same table, unpublished (unit_id NULL).
ALTER TABLE public.learning_reading_texts RENAME COLUMN cefr_level TO legacy_cefr_level;
ALTER TABLE public.learning_reading_texts ALTER COLUMN legacy_cefr_level DROP NOT NULL;
UPDATE public.learning_reading_texts SET legacy_cefr_level=NULL WHERE unit_id IS NOT NULL;
ALTER TABLE public.learning_reading_texts ADD CONSTRAINT reading_text_level CHECK(unit_id IS NOT NULL OR legacy_cefr_level IS NOT NULL);
ALTER TABLE public.learning_reading_texts DROP COLUMN level,DROP COLUMN title,DROP COLUMN lesson,DROP COLUMN sort_order,DROP COLUMN is_active;
ALTER TABLE public.learning_videos DROP COLUMN level,DROP COLUMN lesson,DROP COLUMN title;

CREATE VIEW public.vocabulary_cards WITH(security_invoker=true) AS
 SELECT c.id,u.label lesson,c.word_de,c.article,c.plural,en.translation translation_en,ru.translation translation_ru,tr.translation translation_tr,uk.translation translation_uk,
 c.image_url,c.audio_url,ru.is_difficult is_hard_for_ru,tr.is_difficult is_hard_for_tr,c.created_at,u.level,
 de.context_sentence context_sentence_de,en.context_sentence context_sentence_en,ru.context_sentence context_sentence_ru,uk.context_sentence context_sentence_uk,tr.context_sentence context_sentence_tr,
 c.sentence_practice,c.alternative_answers_de,c.unit_id
 FROM public.learning_vocabulary_cards c JOIN public.learning_units u ON u.id=c.unit_id
 LEFT JOIN public.vocabulary_translations de ON de.card_id=c.id AND de.locale='de'
 LEFT JOIN public.vocabulary_translations en ON en.card_id=c.id AND en.locale='en'
 LEFT JOIN public.vocabulary_translations ru ON ru.card_id=c.id AND ru.locale='ru'
 LEFT JOIN public.vocabulary_translations uk ON uk.card_id=c.id AND uk.locale='uk'
 LEFT JOIN public.vocabulary_translations tr ON tr.card_id=c.id AND tr.locale='tr';
CREATE VIEW public.exercises WITH(security_invoker=true) AS
 SELECT e.id,u.label lesson,e.topic,e.type,e.content
 ||CASE WHEN t.smart_hint IS NOT NULL THEN jsonb_build_object('smart_hint',t.smart_hint) ELSE '{}'::jsonb END
 ||CASE WHEN t.explanation IS NOT NULL THEN jsonb_build_object('explanation',t.explanation) ELSE '{}'::jsonb END content,
 t.hint,e.created_at,u.level,e.solution_audio_url,e.unit_id
 FROM public.learning_exercises e JOIN public.learning_units u ON u.id=e.unit_id
 LEFT JOIN LATERAL(SELECT jsonb_object_agg(locale,hint) FILTER(WHERE hint IS NOT NULL) hint,
 jsonb_object_agg(locale,smart_hint) FILTER(WHERE smart_hint IS NOT NULL) smart_hint,
 jsonb_object_agg(locale,explanation) FILTER(WHERE explanation IS NOT NULL) explanation
 FROM public.grammar_translations WHERE exercise_id=e.id) t ON true;
CREATE VIEW public.pronunciation_prompts WITH(security_invoker=true) AS
 SELECT p.id,coalesce(l.cefr_level,p.legacy_cefr_level) cefr_level,p.sentence_de,p.focus,p.audio_url,
 coalesce(u.sort_order,0) sort_order,p.created_at,coalesce(u.label,'Archiv') lesson,u.level,u.label title,
 coalesce(u.is_active,false) is_active,p.unit_id
 FROM public.learning_reading_texts p LEFT JOIN public.learning_units u ON u.id=p.unit_id
 LEFT JOIN public.learning_levels l ON l.code=u.level;
CREATE VIEW public.videos WITH(security_invoker=true) AS
 SELECT v.id,u.label title,v.description,u.label lesson,v.video_url,v.external_url,v.is_external,v.created_at,u.level,v.unit_id
 FROM public.learning_videos v JOIN public.learning_units u ON u.id=v.unit_id;

-- Empty old progress is replaced with a projection, not a second physical store.
DROP TABLE public.user_vocabulary_progress;
DROP FUNCTION vocabulary_private.mirror_legacy_progress();
CREATE VIEW public.user_vocabulary_progress WITH(security_invoker=true) AS
 SELECT id,user_id,card_id,box_number,next_review_date,lapses,last_answered_at,created_at,updated_at
 FROM public.vocabulary_direction_progress WHERE direction='de_to_native';
DROP TABLE public.student_trainer_access;
CREATE VIEW public.student_trainer_access WITH(security_invoker=true) AS
 SELECT a.user_id,a.level,a.trainer,a.enabled,
 CASE WHEN a.unit_mode='all' THEN NULL::text[] ELSE ARRAY(SELECT g.unit_id::text FROM public.learning_unit_grants g
 WHERE g.user_id=a.user_id AND g.level=a.level AND g.trainer=a.trainer ORDER BY g.unit_id) END allowed_lessons
 FROM public.learning_trainer_grants a;

DROP VIEW public.profile_details;
ALTER TABLE public.profiles DROP COLUMN allowed_levels;
CREATE VIEW public.profile_details WITH(security_invoker=true) AS
 SELECT p.*,person.id legacy_user_id,person.display_name name,person.email,person.phone,person.street,person.postal_code zip_code,person.city,
 ARRAY(SELECT a.level FROM public.student_level_access a WHERE a.user_id=p.id ORDER BY a.level) allowed_levels
 FROM public.profiles p LEFT JOIN public.people person ON person.auth_user_id=p.id;
GRANT SELECT ON public.profile_details TO authenticated,service_role;
-- Identity, roles and billing identifiers cannot be forged via profile preferences.
REVOKE INSERT,UPDATE,DELETE ON public.profiles FROM PUBLIC,anon,authenticated;
GRANT UPDATE(native_language,ui_language) ON public.profiles TO authenticated;


CREATE OR REPLACE FUNCTION trainer_access_private.allowed(p_level text,p_trainer text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND(
 p.role IN('teacher','admin') OR(p.ui_language<>'de' AND p_trainer IN('vocabulary','exercises','pronunciation','videos')
 AND EXISTS(SELECT 1 FROM public.student_level_access l WHERE l.user_id=p.id AND l.level=p_level)
 AND coalesce((SELECT a.enabled FROM public.learning_trainer_grants a WHERE a.user_id=p.id AND a.level=p_level AND a.trainer=p_trainer),true))));
$$;
CREATE OR REPLACE FUNCTION trainer_access_private.unit_allowed(p_level text,p_trainer text,p_unit text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT trainer_access_private.allowed(p_level,p_trainer) AND EXISTS(SELECT 1 FROM public.learning_units u
 WHERE u.level=p_level AND u.trainer=p_trainer AND (u.id::text=p_unit OR u.label=p_unit) AND(
 (SELECT monthly_booking_private.current_profile_role()) IN('teacher','admin') OR(u.is_active AND NOT EXISTS(
 SELECT 1 FROM public.learning_trainer_grants a WHERE a.user_id=(SELECT auth.uid()) AND a.level=p_level AND a.trainer=p_trainer
 AND a.unit_mode='selected' AND NOT EXISTS(SELECT 1 FROM public.learning_unit_grants g
 WHERE g.user_id=a.user_id AND g.level=a.level AND g.trainer=a.trainer AND g.unit_id=u.id)))));
$$;
CREATE FUNCTION learning_private.unit_allowed(p_unit_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.learning_units u WHERE u.id=p_unit_id
 AND trainer_access_private.unit_allowed(u.level,u.trainer,u.id::text));
$$;
REVOKE ALL ON FUNCTION learning_private.unit_allowed(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION learning_private.unit_allowed(uuid) TO authenticated,service_role;

DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['learning_levels','learning_units','student_level_access','learning_trainer_grants','learning_unit_grants',
 'learning_vocabulary_cards','learning_exercises','learning_reading_texts','learning_videos','vocabulary_translations','grammar_translations'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',tab);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',tab);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',tab);
  EXECUTE format('CREATE POLICY staff_manage ON public.%I FOR ALL TO authenticated USING((SELECT monthly_booking_private.current_profile_role()) IN(''teacher'',''admin'')) WITH CHECK((SELECT monthly_booking_private.current_profile_role()) IN(''teacher'',''admin''))',tab);
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['student_level_access','learning_trainer_grants','learning_unit_grants'] LOOP
  EXECUTE format('CREATE POLICY own_access_read ON public.%I FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()))',tab);
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['learning_vocabulary_cards','learning_exercises','learning_reading_texts','learning_videos'] LOOP
  EXECUTE format('CREATE POLICY released_content_read ON public.%I FOR SELECT TO authenticated USING(learning_private.unit_allowed(unit_id))',tab);
 END LOOP;
END $$;
CREATE POLICY authenticated_levels ON public.learning_levels FOR SELECT TO authenticated USING(true);
CREATE POLICY released_units ON public.learning_units FOR SELECT TO authenticated USING(learning_private.unit_allowed(id));
CREATE POLICY released_translations ON public.vocabulary_translations FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.learning_vocabulary_cards c WHERE c.id=card_id));
CREATE POLICY released_grammar_translations ON public.grammar_translations FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.learning_exercises e WHERE e.id=exercise_id));
GRANT SELECT ON public.vocabulary_cards,public.exercises,public.pronunciation_prompts,public.videos,
 public.student_trainer_access,public.user_vocabulary_progress TO authenticated,service_role;

CREATE FUNCTION public.set_student_level_access(p_user_id uuid,p_levels text[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 IF (SELECT monthly_booking_private.current_profile_role()) NOT IN('teacher','admin') OR auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Staff required' USING ERRCODE='42501'; END IF;
 IF p_levels IS NULL OR EXISTS(SELECT 1 FROM unnest(p_levels) l WHERE l IS NULL OR NOT EXISTS(SELECT 1 FROM public.learning_levels WHERE code=l)) THEN
  RAISE EXCEPTION 'Invalid levels' USING ERRCODE='23514'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-access:'||p_user_id::text,0));
 DELETE FROM public.student_level_access WHERE user_id=p_user_id AND NOT(level=ANY(p_levels));
 INSERT INTO public.student_level_access SELECT p_user_id,l FROM unnest(p_levels) l ON CONFLICT DO NOTHING;
END $$;
CREATE FUNCTION public.set_student_trainer_access(p_user_id uuid,p_level text,p_trainer text,p_enabled boolean,p_unit_ids uuid[] DEFAULT NULL,p_replace_units boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 IF (SELECT monthly_booking_private.current_profile_role()) NOT IN('teacher','admin') OR auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Staff required' USING ERRCODE='42501'; END IF;
 IF p_replace_units AND p_unit_ids IS NOT NULL AND EXISTS(SELECT 1 FROM unnest(p_unit_ids) item WHERE NOT EXISTS(
 SELECT 1 FROM public.learning_units u WHERE u.id=item AND u.level=p_level AND u.trainer=p_trainer)) THEN
  RAISE EXCEPTION 'Unit outside trainer' USING ERRCODE='23514'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-access:'||p_user_id::text,0));
 INSERT INTO public.learning_trainer_grants(user_id,level,trainer,enabled,unit_mode)
 VALUES(p_user_id,p_level,p_trainer,p_enabled,CASE WHEN p_replace_units AND p_unit_ids IS NOT NULL THEN 'selected' ELSE 'all' END)
 ON CONFLICT(user_id,level,trainer) DO UPDATE SET enabled=excluded.enabled,
 unit_mode=CASE WHEN p_replace_units THEN excluded.unit_mode ELSE public.learning_trainer_grants.unit_mode END;
 IF p_replace_units THEN
  DELETE FROM public.learning_unit_grants WHERE user_id=p_user_id AND level=p_level AND trainer=p_trainer;
  INSERT INTO public.learning_unit_grants SELECT DISTINCT p_user_id,p_level,p_trainer,item FROM unnest(p_unit_ids) item;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_student_level_access(uuid,text[]),public.set_student_trainer_access(uuid,text,text,boolean,uuid[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_student_level_access(uuid,text[]),public.set_student_trainer_access(uuid,text,text,boolean,uuid[],boolean) TO authenticated;

-- One message store: the legacy feedback API is a projection of teacher replies.
DROP TABLE public.teacher_feedback;
CREATE VIEW public.teacher_feedback WITH(security_invoker=true) AS
 SELECT id,submission_id,sender_id teacher_id,text_content feedback_text,audio_path feedback_audio_url,created_at,seen_at
 FROM public.pronunciation_messages WHERE sender_role IN('teacher','admin');
GRANT SELECT ON public.teacher_feedback TO authenticated,service_role;

-- Content writers and revised learning RPCs are appended below.
CREATE FUNCTION learning_private.ensure_unit(p_id uuid,p_level text,p_trainer text,p_label text,p_active boolean DEFAULT true,p_sort integer DEFAULT 100)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ DECLARE result uuid; BEGIN
 IF p_id IS NOT NULL THEN
  DELETE FROM public.learning_unit_grants WHERE unit_id=p_id AND level<>p_level;
  UPDATE public.learning_units SET level=p_level,label=p_label,is_active=p_active,sort_order=p_sort
  WHERE id=p_id AND trainer=p_trainer RETURNING id INTO result;
  IF result IS NULL THEN INSERT INTO public.learning_units(id,level,trainer,label,is_active,sort_order)
   VALUES(p_id,p_level,p_trainer,p_label,p_active,p_sort) RETURNING id INTO result; END IF;
 ELSE
  PERFORM pg_advisory_xact_lock(hashtextextended('learning-unit:'||p_level||':'||p_trainer||':'||p_label,0));
  IF p_trainer IN('vocabulary','exercises') THEN
   SELECT id INTO result FROM public.learning_units WHERE level=p_level AND trainer=p_trainer AND label=p_label;
  END IF;
  IF result IS NULL THEN INSERT INTO public.learning_units(level,trainer,label,is_active,sort_order)
   VALUES(p_level,p_trainer,p_label,p_active,p_sort) RETURNING id INTO result; END IF;
 END IF;
 IF result IS NULL THEN RAISE EXCEPTION 'Unit unavailable' USING ERRCODE='23514'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION learning_private.ensure_unit(uuid,text,text,text,boolean,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION learning_private.ensure_unit(uuid,text,text,text,boolean,integer) TO authenticated,service_role;

CREATE FUNCTION public.save_learning_content(p_trainer text,p_payload jsonb,p_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE old_row jsonb; v jsonb; item uuid:=coalesce(p_id,gen_random_uuid()); unit uuid; lang text; labels jsonb; result jsonb; BEGIN
 IF current_user NOT IN('service_role','postgres') AND coalesce((SELECT monthly_booking_private.current_profile_role()),'') NOT IN('teacher','admin') THEN
  RAISE EXCEPTION 'Staff required' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_payload)<>'object' OR p_trainer NOT IN('vocabulary','exercises','pronunciation','videos') THEN
  RAISE EXCEPTION 'Invalid content' USING ERRCODE='23514'; END IF;
 IF p_id IS NOT NULL THEN
  IF p_trainer='vocabulary' THEN SELECT to_jsonb(c) INTO old_row FROM public.vocabulary_cards c WHERE id=p_id;
  ELSIF p_trainer='exercises' THEN SELECT to_jsonb(e) INTO old_row FROM public.exercises e WHERE id=p_id;
  ELSIF p_trainer='pronunciation' THEN SELECT to_jsonb(p) INTO old_row FROM public.pronunciation_prompts p WHERE id=p_id;
  ELSE SELECT to_jsonb(x) INTO old_row FROM public.videos x WHERE id=p_id; END IF;
  IF old_row IS NULL THEN RAISE EXCEPTION 'Content unavailable' USING ERRCODE='23514'; END IF;
 END IF;
 v:=coalesce(old_row,'{}'::jsonb)||p_payload;
 -- A changed lesson selects/creates its own unit rather than renaming every sibling.
 IF p_trainer IN('vocabulary','exercises') THEN
  IF old_row IS NOT NULL AND v->>'lesson'=old_row->>'lesson' AND v->>'level'=old_row->>'level' THEN unit:=(old_row->>'unit_id')::uuid;
  ELSE unit:=learning_private.ensure_unit(NULL,v->>'level',p_trainer,v->>'lesson'); END IF;
 ELSE
  unit:=learning_private.ensure_unit(coalesce((old_row->>'unit_id')::uuid,(old_row->>'id')::uuid),v->>'level',p_trainer,v->>'title',coalesce((v->>'is_active')::boolean,true),coalesce((v->>'sort_order')::integer,100));
  IF p_id IS NULL THEN item:=unit; END IF;
 END IF;
 IF p_trainer='vocabulary' THEN
  IF coalesce((v->>'sentence_practice')::boolean,false) AND EXISTS(SELECT 1 FROM unnest(ARRAY['de','en','ru','uk','tr']) l WHERE nullif(btrim(v->>('context_sentence_'||l)),'') IS NULL) THEN
   RAISE EXCEPTION 'Sentence translations required' USING ERRCODE='23514'; END IF;
  INSERT INTO public.learning_vocabulary_cards(id,unit_id,word_de,article,plural,image_url,audio_url,sentence_practice,alternative_answers_de)
  VALUES(item,unit,v->>'word_de',nullif(v->>'article','none'),v->>'plural',v->>'image_url',v->>'audio_url',coalesce((v->>'sentence_practice')::boolean,false),
   ARRAY(SELECT jsonb_array_elements_text(coalesce(v->'alternative_answers_de','[]'::jsonb))))
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,word_de=excluded.word_de,article=excluded.article,plural=excluded.plural,
   image_url=excluded.image_url,audio_url=excluded.audio_url,sentence_practice=excluded.sentence_practice,alternative_answers_de=excluded.alternative_answers_de;
  FOREACH lang IN ARRAY ARRAY['de','en','ru','uk','tr'] LOOP
   INSERT INTO public.vocabulary_translations(card_id,locale,translation,context_sentence,is_difficult)
   VALUES(item,lang,v->>('translation_'||lang),v->>('context_sentence_'||lang),coalesce((v->>('is_hard_for_'||lang))::boolean,false))
   ON CONFLICT(card_id,locale) DO UPDATE SET translation=excluded.translation,context_sentence=excluded.context_sentence,is_difficult=excluded.is_difficult;
  END LOOP;
  SELECT to_jsonb(c) INTO result FROM public.vocabulary_cards c WHERE id=item;
 ELSIF p_trainer='exercises' THEN
  IF v->>'type' NOT IN('fill_in_blank','multiple_choice') OR jsonb_typeof(v->'content')<>'object'
   OR nullif(btrim(v->'content'->>'correct_answer'),'') IS NULL THEN RAISE EXCEPTION 'Invalid exercise' USING ERRCODE='23514'; END IF;
  INSERT INTO public.learning_exercises(id,unit_id,topic,type,content,solution_audio_url)
  VALUES(item,unit,v->>'topic',v->>'type',(v->'content')-'smart_hint'-'explanation',v->>'solution_audio_url')
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,topic=excluded.topic,type=excluded.type,content=excluded.content,solution_audio_url=excluded.solution_audio_url;
  DELETE FROM public.grammar_translations WHERE exercise_id=item;
  FOR lang IN SELECT jsonb_object_keys(CASE WHEN jsonb_typeof(v->'hint')='object' THEN v->'hint' ELSE '{}'::jsonb END)
   UNION SELECT jsonb_object_keys(CASE WHEN jsonb_typeof(v->'content'->'smart_hint')='object' THEN v->'content'->'smart_hint' ELSE '{}'::jsonb END)
   UNION SELECT jsonb_object_keys(CASE WHEN jsonb_typeof(v->'content'->'explanation')='object' THEN v->'content'->'explanation' ELSE '{}'::jsonb END)
   UNION SELECT 'de' WHERE jsonb_typeof(v->'content'->'smart_hint')='string' OR jsonb_typeof(v->'content'->'explanation')='string'
  LOOP
   INSERT INTO public.grammar_translations(exercise_id,locale,hint,smart_hint,explanation) VALUES(item,lang,v->'hint'->>lang,
    CASE WHEN jsonb_typeof(v->'content'->'smart_hint')='object' THEN v->'content'->'smart_hint'->>lang WHEN lang='de' THEN v->'content'->>'smart_hint' END,
    CASE WHEN jsonb_typeof(v->'content'->'explanation')='object' THEN v->'content'->'explanation'->>lang WHEN lang='de' THEN v->'content'->>'explanation' END);
  END LOOP;
  SELECT to_jsonb(e) INTO result FROM public.exercises e WHERE id=item;
 ELSIF p_trainer='pronunciation' THEN
  INSERT INTO public.learning_reading_texts(id,unit_id,legacy_cefr_level,sentence_de,focus,audio_url)
  VALUES(item,unit,NULL,v->>'sentence_de',v->>'focus',v->>'audio_url')
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,legacy_cefr_level=excluded.legacy_cefr_level,sentence_de=excluded.sentence_de,focus=excluded.focus,audio_url=excluded.audio_url;
  SELECT to_jsonb(p) INTO result FROM public.pronunciation_prompts p WHERE id=item;
 ELSE
  INSERT INTO public.learning_videos(id,unit_id,description,video_url,external_url,is_external)
  VALUES(item,unit,v->>'description',v->>'video_url',v->>'external_url',coalesce((v->>'is_external')::boolean,true))
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,description=excluded.description,video_url=excluded.video_url,external_url=excluded.external_url,is_external=excluded.is_external;
  SELECT to_jsonb(x) INTO result FROM public.videos x WHERE id=item;
 END IF;
 IF old_row IS NOT NULL AND (old_row->>'unit_id')::uuid IS DISTINCT FROM unit THEN
  DELETE FROM public.learning_units u WHERE u.id=(old_row->>'unit_id')::uuid
   AND NOT EXISTS(SELECT 1 FROM public.learning_vocabulary_cards c WHERE c.unit_id=u.id)
   AND NOT EXISTS(SELECT 1 FROM public.learning_exercises e WHERE e.unit_id=u.id);
 END IF;
 RETURN result;
END $$;
CREATE FUNCTION public.delete_learning_content(p_trainer text,p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 IF coalesce((SELECT monthly_booking_private.current_profile_role()),'') NOT IN('teacher','admin') THEN RAISE EXCEPTION 'Staff required' USING ERRCODE='42501'; END IF;
 IF p_trainer='vocabulary' THEN DELETE FROM public.learning_vocabulary_cards WHERE id=p_id;
 ELSIF p_trainer='exercises' THEN DELETE FROM public.learning_exercises WHERE id=p_id;
 ELSIF p_trainer='pronunciation' THEN UPDATE public.learning_units SET is_active=false WHERE id=(SELECT unit_id FROM public.learning_reading_texts WHERE id=p_id);
 ELSIF p_trainer='videos' THEN DELETE FROM public.learning_videos WHERE id=p_id;
 ELSE RAISE EXCEPTION 'Invalid trainer' USING ERRCODE='23514'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.save_learning_content(text,jsonb,uuid),public.delete_learning_content(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_learning_content(text,jsonb,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.delete_learning_content(text,uuid) TO authenticated;


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
 IF NOT FOUND OR prompt.level IS NULL OR NOT EXISTS(SELECT 1 FROM public.profile_details p WHERE p.id = actor AND
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
      SELECT 1 FROM public.vocabulary_cards c JOIN public.profile_details p ON p.id = actor
      WHERE c.id = target AND trainer_access_private.unit_allowed(c.level, 'vocabulary', c.lesson) AND (p.role IN ('teacher','admin') OR c.level = ANY(coalesce(p.allowed_levels, ARRAY[]::text[])))
    ) THEN RAISE EXCEPTION 'level_access_denied' USING ERRCODE = '42501'; END IF;
    INSERT INTO public.vocabulary_direction_progress(user_id, card_id, direction, box_number, next_review_date)
      SELECT actor, target, d, CASE WHEN known THEN 6 ELSE 1 END,
        CASE WHEN known THEN now() + interval '90 days' ELSE now() END
      FROM unnest(CASE WHEN selected_direction IS NULL THEN ARRAY['de_to_native','native_to_de'] ELSE ARRAY[selected_direction] END) d
      ON CONFLICT (user_id, card_id, direction) DO NOTHING;
    GET DIAGNOSTICS touched = ROW_COUNT;
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
  IF NOT EXISTS (SELECT 1 FROM public.profile_details p WHERE p.id = actor
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
  IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profile_details p WHERE p.id = actor
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
  profile public.profile_details; previous_card uuid; prompt text; correct boolean; sentence boolean;
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
  SELECT * INTO profile FROM public.profile_details WHERE id = actor;
  IF NOT (coalesce(profile.role IN ('teacher','admin'),false) OR card.level = ANY(coalesce(profile.allowed_levels,ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'level_access_denied' USING ERRCODE = '42501';
  END IF;
  IF NOT trainer_access_private.unit_allowed(card.level,'vocabulary',card.lesson) OR p_ui_language='de' THEN
    RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501';
  END IF;
  IF progress.box_number = 7 OR progress.next_review_date > now() THEN
    RAISE EXCEPTION 'review_not_due' USING ERRCODE = 'PT409';
  END IF;
  SELECT last_card_id INTO previous_card FROM public.vocabulary_learning_state WHERE user_id = actor;
  IF previous_card = progress.card_id THEN
    RAISE EXCEPTION 'vocabulary_spacing_required' USING ERRCODE = 'PT409';
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

CREATE OR REPLACE FUNCTION trainer_access_private.can_record()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND
 (p.role IN('teacher','admin') OR EXISTS(SELECT 1 FROM public.learning_units u WHERE u.trainer='pronunciation'
 AND trainer_access_private.unit_allowed(u.level,u.trainer,u.id::text))));
$$;
CREATE OR REPLACE FUNCTION learning_reset_private.matches_audio(p_reference text,p_bucket text,p_name text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(p_reference='storage://' || p_bucket || '/' || p_name,false);
$$;
-- Empty legacy progress is replaced by one non-null directional state per word and learner.
ALTER TABLE public.vocabulary_direction_progress ALTER COLUMN box_number SET NOT NULL, ALTER COLUMN next_review_date SET NOT NULL;
CREATE OR REPLACE FUNCTION vocabulary_private.reset_lesson(p_level text,p_lesson text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); BEGIN
 IF actor IS NULL OR NOT trainer_access_private.unit_allowed(p_level,'vocabulary',p_lesson) THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 DELETE FROM public.vocabulary_direction_progress v USING public.vocabulary_cards c
 WHERE v.user_id=actor AND v.card_id=c.id AND c.level=p_level AND c.lesson=p_lesson;
END $$;
CREATE FUNCTION learning_private.reset_student_level(p_student_id uuid,p_level text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF auth.uid() IS NULL OR coalesce(monthly_booking_private.current_profile_role(),'') NOT IN('teacher','admin') THEN RAISE EXCEPTION 'Staff required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.learning_levels WHERE code=p_level) OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_student_id) THEN RAISE EXCEPTION 'Invalid learner/level' USING ERRCODE='23514'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||p_student_id::text,0));
 DELETE FROM public.vocabulary_direction_progress p USING public.vocabulary_cards c WHERE p.card_id=c.id AND p.user_id=p_student_id AND c.level=p_level;
 DELETE FROM public.user_exercise_progress p USING public.exercises e WHERE p.exercise_id=e.id AND p.user_id=p_student_id AND e.level=p_level;
 DELETE FROM public.vocabulary_onboarding WHERE user_id=p_student_id AND level=p_level;
 UPDATE public.vocabulary_learning_state SET last_card_id=NULL WHERE user_id=p_student_id AND last_card_id IN(SELECT id FROM public.vocabulary_cards WHERE level=p_level);
END $$;
CREATE FUNCTION public.reset_student_level_progress(p_student_id uuid,p_level text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT learning_private.reset_student_level(p_student_id,p_level); $$;
REVOKE ALL ON FUNCTION learning_private.reset_student_level(uuid,text),public.reset_student_level_progress(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION learning_private.reset_student_level(uuid,text),public.reset_student_level_progress(uuid,text) TO authenticated;

-- Rebind surviving learner policies explicitly: prior business-column CASCADEs
-- must not leave a half-working set of storage/progress permissions behind.
DO $$ DECLARE p record; tab text; BEGIN
 FOR p IN SELECT tablename,policyname FROM pg_policies WHERE schemaname='public' AND tablename IN
 ('vocabulary_direction_progress','user_exercise_progress','vocabulary_learning_state','vocabulary_onboarding','submissions','pronunciation_messages') LOOP
  EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename);
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['vocabulary_direction_progress','user_exercise_progress','vocabulary_learning_state','vocabulary_onboarding','submissions','pronunciation_messages'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',tab);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',tab);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',tab);
 END LOOP;
END $$;
CREATE POLICY vocabulary_progress_read ON public.vocabulary_direction_progress FOR SELECT TO authenticated USING(
 (SELECT monthly_booking_private.current_profile_role()) IN('teacher','admin') OR(user_id=(SELECT auth.uid()) AND
 EXISTS(SELECT 1 FROM public.learning_vocabulary_cards c WHERE c.id=card_id AND learning_private.unit_allowed(c.unit_id))));
CREATE POLICY grammar_progress_read ON public.user_exercise_progress FOR SELECT TO authenticated USING(
 (SELECT monthly_booking_private.current_profile_role()) IN('teacher','admin') OR(user_id=(SELECT auth.uid()) AND
 EXISTS(SELECT 1 FROM public.learning_exercises e WHERE e.id=exercise_id AND learning_private.unit_allowed(e.unit_id))));
CREATE POLICY vocabulary_state_read ON public.vocabulary_learning_state FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY vocabulary_onboarding_read ON public.vocabulary_onboarding FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY pronunciation_threads_read ON public.submissions FOR SELECT TO authenticated USING(pronunciation_private.can_access_submission(id));
CREATE POLICY pronunciation_messages_read ON public.pronunciation_messages FOR SELECT TO authenticated USING(pronunciation_private.can_access_submission(submission_id));
GRANT INSERT ON public.pronunciation_messages TO authenticated;
CREATE POLICY pronunciation_messages_send ON public.pronunciation_messages FOR INSERT TO authenticated
 WITH CHECK(sender_id=(SELECT auth.uid()) AND pronunciation_private.can_access_submission(submission_id));

UPDATE storage.buckets SET public=false WHERE id IN('pronunciation_audio','audio_submissions');
DROP POLICY IF EXISTS "Authentifizierte Nutzer können Audio aktualisieren" ON storage.objects;
DROP POLICY IF EXISTS "Authentifizierte Nutzer können Audio hochladen" ON storage.objects;
DROP POLICY IF EXISTS "Jeder darf Audio abrufen" ON storage.objects;
DROP POLICY IF EXISTS "Pronunciation owners upload" ON storage.objects;
DROP POLICY IF EXISTS "Pronunciation participants listen" ON storage.objects;
DROP POLICY IF EXISTS trainer_audio_read_guard ON storage.objects;
DROP POLICY IF EXISTS trainer_audio_upload_guard ON storage.objects;
CREATE FUNCTION learning_private.audio_readable(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND CASE
 WHEN (SELECT monthly_booking_private.current_profile_role()) IN('teacher','admin') THEN true
 WHEN EXISTS(SELECT 1 FROM public.submissions WHERE content_url='storage://pronunciation_audio/'||p_name)
   OR EXISTS(SELECT 1 FROM public.pronunciation_messages WHERE audio_path='storage://pronunciation_audio/'||p_name)
 THEN EXISTS(SELECT 1 FROM public.submissions s WHERE s.content_url='storage://pronunciation_audio/'||p_name AND pronunciation_private.can_access_submission(s.id))
   OR EXISTS(SELECT 1 FROM public.pronunciation_messages m WHERE m.audio_path='storage://pronunciation_audio/'||p_name AND pronunciation_private.can_access_submission(m.submission_id))
 ELSE split_part(p_name,'/',1)=(SELECT auth.uid())::text AND trainer_access_private.can_record() END;
$$;
REVOKE ALL ON FUNCTION learning_private.audio_readable(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION learning_private.audio_readable(text) TO authenticated;
CREATE POLICY normalized_audio_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='pronunciation_audio' AND learning_private.audio_readable(name));
CREATE POLICY normalized_audio_upload ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='pronunciation_audio' AND trainer_access_private.can_record()
 AND name ~ ('^'||(SELECT auth.uid())::text||'/[0-9a-f-]{36}\.(webm|mp4|ogg|wav|mp3)$'));
-- Restrictive bounds also neutralize any unrelated old permissive recording policy.
CREATE POLICY private_recording_read_bounds ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
 USING(bucket_id NOT IN('pronunciation_audio','audio_submissions') OR
 (bucket_id='pronunciation_audio' AND (learning_private.audio_readable(name) OR learning_reset_private.can_remove_audio(id))));
CREATE POLICY anonymous_recording_read_bounds ON storage.objects AS RESTRICTIVE FOR SELECT TO anon
 USING(bucket_id NOT IN('pronunciation_audio','audio_submissions'));
CREATE POLICY private_recording_insert_bounds ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(bucket_id NOT IN('pronunciation_audio','audio_submissions') OR
 (bucket_id='pronunciation_audio' AND trainer_access_private.can_record()
 AND name ~ ('^'||(SELECT auth.uid())::text||'/[0-9a-f-]{36}\.(webm|mp4|ogg|wav|mp3)$')));
CREATE POLICY private_recording_immutable ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(bucket_id NOT IN('pronunciation_audio','audio_submissions')) WITH CHECK(bucket_id NOT IN('pronunciation_audio','audio_submissions'));
CREATE POLICY private_recording_delete_bounds ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING(bucket_id NOT IN('pronunciation_audio','audio_submissions') OR(bucket_id='pronunciation_audio' AND learning_reset_private.can_remove_audio(id)));

-- Cache links from the retired backend cannot be played on this VPS. Authored
-- words/texts stay unchanged and the local speech engine recreates audio on demand.
UPDATE public.learning_vocabulary_cards SET audio_url=NULL WHERE audio_url ~* '^https?://[^/]*\.supabase\.co(/|$)';
UPDATE public.learning_vocabulary_cards SET image_url=NULL WHERE image_url ~* '^https?://[^/]*\.supabase\.co(/|$)';
UPDATE public.learning_exercises SET solution_audio_url=NULL WHERE solution_audio_url ~* '^https?://[^/]*\.supabase\.co(/|$)';
UPDATE public.learning_reading_texts SET audio_url=NULL WHERE audio_url ~* '^https?://[^/]*\.supabase\.co(/|$)';

CREATE OR REPLACE FUNCTION learning_reset_private.begin_reset(p_confirmation text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); job learning_reset_private.jobs;
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor) THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_confirmation IS DISTINCT FROM 'RESET_LEARNING_DATA' THEN RAISE EXCEPTION 'confirmation_required' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:'||actor::text,0));
 SELECT * INTO job FROM learning_reset_private.jobs WHERE user_id=actor FOR UPDATE;
 IF FOUND AND job.active THEN RETURN job.token; END IF;
 INSERT INTO learning_reset_private.jobs(user_id) VALUES(actor)
 ON CONFLICT(user_id) DO UPDATE SET token=gen_random_uuid(),active=true,requested_at=clock_timestamp(),completed_at=NULL RETURNING * INTO job;
 DELETE FROM learning_reset_private.audio_objects WHERE user_id=actor;
 INSERT INTO learning_reset_private.audio_objects(user_id,object_id,bucket_id,object_name)
 SELECT actor,o.id,o.bucket_id,o.name FROM storage.objects o WHERE o.bucket_id='pronunciation_audio' AND (
   o.owner_id=actor::text OR(o.owner_id IS NULL AND split_part(o.name,'/',1)=actor::text)
   OR EXISTS(SELECT 1 FROM public.pronunciation_messages m JOIN public.submissions s ON s.id=m.submission_id WHERE s.user_id=actor
    AND (o.owner_id=m.sender_id::text OR(o.owner_id IS NULL AND split_part(o.name,'/',1)=m.sender_id::text))
    AND learning_reset_private.matches_audio(m.audio_path,o.bucket_id,o.name)))
 AND NOT EXISTS(SELECT 1 FROM public.submissions s WHERE s.user_id<>actor AND learning_reset_private.matches_audio(s.content_url,o.bucket_id,o.name))
 AND NOT EXISTS(SELECT 1 FROM public.pronunciation_messages m JOIN public.submissions s ON s.id=m.submission_id WHERE s.user_id<>actor AND learning_reset_private.matches_audio(m.audio_path,o.bucket_id,o.name));
 RETURN job.token;
END $$;
CREATE OR REPLACE FUNCTION learning_reset_private.finish_reset(p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); job learning_reset_private.jobs;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:'||actor::text,0));
 SELECT * INTO job FROM learning_reset_private.jobs WHERE user_id=actor AND token=p_token FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'reset_owner_required' USING ERRCODE='42501'; END IF;
 IF NOT job.active THEN RETURN true; END IF;
 IF EXISTS(SELECT 1 FROM learning_reset_private.audio_objects a JOIN storage.objects o ON o.id=a.object_id WHERE a.user_id=actor) THEN
  RAISE EXCEPTION 'audio_removal_incomplete' USING ERRCODE='55000'; END IF;
 UPDATE public.submissions SET parent_id=NULL WHERE user_id<>actor AND parent_id IN(SELECT id FROM public.submissions WHERE user_id=actor);
 DELETE FROM public.pronunciation_messages WHERE submission_id IN(SELECT id FROM public.submissions WHERE user_id=actor);
 DELETE FROM public.submissions WHERE user_id=actor;
 DELETE FROM vocabulary_private.answer_receipts WHERE user_id=actor;
 DELETE FROM public.vocabulary_direction_progress WHERE user_id=actor;
 DELETE FROM public.vocabulary_learning_state WHERE user_id=actor;
 DELETE FROM public.vocabulary_onboarding WHERE user_id=actor;
 DELETE FROM public.user_exercise_progress WHERE user_id=actor;
 DELETE FROM learning_reset_private.audio_objects WHERE user_id=actor;
 UPDATE learning_reset_private.jobs SET active=false,completed_at=clock_timestamp() WHERE user_id=actor;
 RETURN true;
END $$;

-- The public progress façade is read-only. All grading writes the directional table.
REVOKE ALL ON public.user_vocabulary_progress FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.user_vocabulary_progress TO authenticated,service_role;
-- Catalog migration must retain identities and authored German text.
DO $$ DECLARE before_count integer; after_count integer; BEGIN
 SELECT count(*) INTO before_count FROM learning_catalog_before;
 SELECT (SELECT count(*) FROM public.vocabulary_cards)+(SELECT count(*) FROM public.exercises)
 +(SELECT count(*) FROM public.pronunciation_prompts)+(SELECT count(*) FROM public.videos) INTO after_count;
 IF before_count<>after_count THEN RAISE EXCEPTION 'Catalog count mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM learning_catalog_before b LEFT JOIN public.vocabulary_cards c ON c.id=b.id
 WHERE b.trainer='vocabulary' AND (c.id IS NULL OR c.word_de IS DISTINCT FROM b.payload->>'word_de'))
 OR EXISTS(SELECT 1 FROM learning_catalog_before b LEFT JOIN public.pronunciation_prompts p ON p.id=b.id
 WHERE b.trainer='pronunciation' AND (p.id IS NULL OR p.sentence_de IS DISTINCT FROM b.payload->>'sentence_de')) THEN
 RAISE EXCEPTION 'Catalog identity/content mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM learning_catalog_before b JOIN public.vocabulary_cards c ON c.id=b.id,
  unnest(ARRAY['translation_en','translation_ru','translation_uk','translation_tr','context_sentence_de','context_sentence_en','context_sentence_ru','context_sentence_uk','context_sentence_tr']) field
  WHERE b.trainer='vocabulary' AND (to_jsonb(c)->>field) IS DISTINCT FROM (b.payload->>field)) THEN
  RAISE EXCEPTION 'Vocabulary translation/context preservation failed'; END IF;
 IF EXISTS(SELECT 1 FROM learning_catalog_before b LEFT JOIN public.learning_exercises e ON e.id=b.id
  WHERE b.trainer='exercises' AND (e.id IS NULL OR e.content IS DISTINCT FROM ((b.payload->'content')-'smart_hint'-'explanation'))) THEN
  RAISE EXCEPTION 'Authored grammar content preservation failed'; END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
