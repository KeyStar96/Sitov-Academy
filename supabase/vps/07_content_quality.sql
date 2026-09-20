-- Phase 3.4–3.5. Runner transaction + verified R8 backup required.
-- Preserve legacy rows verbatim; never invent target forms or translations.
DO $types$
DECLARE labels text[];
BEGIN
 IF to_regtype('public.learning_content_status') IS NULL THEN
  CREATE TYPE public.learning_content_status AS ENUM ('incomplete','ready');
 ELSE
  SELECT array_agg(enumlabel::text ORDER BY enumsortorder) INTO labels FROM pg_enum
   WHERE enumtypid='public.learning_content_status'::regtype;
  IF labels IS DISTINCT FROM ARRAY['incomplete','ready'] THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='content_status_enum_drift';
  END IF;
 END IF;
END $types$;

CREATE OR REPLACE FUNCTION learning_private.german_text_allowed(p_text text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path TO '' AS $function$
 -- NFC closes decomposed forms such as s + combining cedilla. Cyrillic blocks
 -- include supplements, combining/extended forms and Extended-D above the BMP.
 SELECT normalize(coalesce(p_text,''),NFC) !~ U&'[\0400-\052F\1C80-\1C8F\1D2B\1D78\2DE0-\2DFF\A640-\A69F\+01E030-\+01E08F\0131\011F\015F\0130\011E\015E]'
$function$;

CREATE OR REPLACE FUNCTION grammar_private.valid_target_form(p_content jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $function$
DECLARE target jsonb:=p_content->'target_form';
BEGIN
 IF jsonb_typeof(target) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 RETURN jsonb_array_length(target)>0 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(target) item
  WHERE jsonb_typeof(item) IS DISTINCT FROM 'string' OR btrim(item#>>'{}',U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')='');
END $function$;

CREATE OR REPLACE FUNCTION grammar_private.german_content_allowed(p_content jsonb,p_topic text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path TO '' AS $function$
 -- Localized hint/smart_hint/explanation objects and grammar_translations are
 -- intentionally excluded. Native-language prompts belong in translations.prompt.
 SELECT learning_private.german_text_allowed(jsonb_build_array(p_topic,
  p_content->'instruction',p_content->'text_before',p_content->'text_after',p_content->'question',
  p_content->'correct_answer',p_content->'gap_hint',p_content->'options',p_content->'accepted_answers',
  p_content->'parts',p_content->'target_form')::text)
$function$;

CREATE OR REPLACE FUNCTION grammar_private.exercise_is_ready(p_content jsonb,p_topic text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path TO '' AS $function$
 SELECT grammar_private.valid_target_form(p_content) AND grammar_private.german_content_allowed(p_content,p_topic)
$function$;
REVOKE ALL ON FUNCTION learning_private.german_text_allowed(text),grammar_private.valid_target_form(jsonb),
 grammar_private.german_content_allowed(jsonb,text),grammar_private.exercise_is_ready(jsonb,text) FROM PUBLIC,anon;
-- Invoker-security triggers/generated expressions also run under service_role
-- for trusted REST imports; function EXECUTE alone does not grant schema lookup.
GRANT USAGE ON SCHEMA grammar_private TO service_role;
GRANT EXECUTE ON FUNCTION learning_private.german_text_allowed(text),grammar_private.valid_target_form(jsonb),
 grammar_private.german_content_allowed(jsonb,text),grammar_private.exercise_is_ready(jsonb,text) TO authenticated,service_role;

ALTER TABLE public.learning_exercises ADD COLUMN IF NOT EXISTS content_status public.learning_content_status
 GENERATED ALWAYS AS (CASE WHEN grammar_private.exercise_is_ready(content,topic)
  THEN 'ready'::public.learning_content_status ELSE 'incomplete'::public.learning_content_status END) STORED;
COMMENT ON COLUMN public.learning_exercises.content_status IS 'Derived publication readiness: explicit target forms and German task text; legacy content is preserved for staff review.';
ALTER TABLE public.grammar_translations ADD COLUMN IF NOT EXISTS prompt text;
COMMENT ON COLUMN public.grammar_translations.prompt IS 'Optional translation task prompt in this exact interface locale; never copied into German exercise content.';

CREATE OR REPLACE FUNCTION grammar_private.guard_exercise_quality() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $function$
BEGIN
 -- An unchanged legacy payload may receive audio/metadata maintenance. Editing
 -- the exercise itself must repair the whole payload before it can be saved.
 IF TG_OP='INSERT' OR NEW.content IS DISTINCT FROM OLD.content OR NEW.topic IS DISTINCT FROM OLD.topic THEN
  IF NOT grammar_private.valid_target_form(NEW.content) THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='target_form_required',
    DETAIL='{"error":"target_form_required","message":"Add at least one nonempty target form before saving the exercise."}';
  END IF;
  IF NOT grammar_private.german_content_allowed(NEW.content,NEW.topic) THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='german_text_required',
    DETAIL='{"error":"german_text_required","message":"German exercise fields cannot contain Cyrillic or Turkish-specific letters."}';
  END IF;
 END IF;
 RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION learning_private.guard_reading_quality() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $function$
BEGIN
 IF TG_OP='INSERT' OR NEW.sentence_de IS DISTINCT FROM OLD.sentence_de OR NEW.focus IS DISTINCT FROM OLD.focus THEN
  IF NOT learning_private.german_text_allowed(NEW.sentence_de) OR NOT learning_private.german_text_allowed(NEW.focus) THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='german_text_required',
    DETAIL='{"error":"german_text_required","message":"German reading fields cannot contain Cyrillic or Turkish-specific letters."}';
  END IF;
 END IF;
 RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION grammar_private.guard_exercise_quality(),learning_private.guard_reading_quality() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS guard_exercise_quality ON public.learning_exercises;
CREATE TRIGGER guard_exercise_quality BEFORE INSERT OR UPDATE ON public.learning_exercises
 FOR EACH ROW EXECUTE FUNCTION grammar_private.guard_exercise_quality();
DROP TRIGGER IF EXISTS guard_reading_quality ON public.learning_reading_texts;
CREATE TRIGGER guard_reading_quality BEFORE INSERT OR UPDATE ON public.learning_reading_texts
 FOR EACH ROW EXECUTE FUNCTION learning_private.guard_reading_quality();

-- Staff's separate permissive policy retains access to incomplete legacy rows.
-- Student REST/table reads and embedded translations all obey this restriction.
DROP POLICY IF EXISTS released_content_read ON public.learning_exercises;
CREATE POLICY released_content_read ON public.learning_exercises FOR SELECT TO authenticated
 USING(content_status='ready' AND learning_private.unit_allowed(unit_id));
DROP POLICY IF EXISTS released_content_read ON public.learning_reading_texts;
CREATE POLICY released_content_read ON public.learning_reading_texts FOR SELECT TO authenticated
 USING(learning_private.german_text_allowed(sentence_de) AND learning_private.german_text_allowed(focus)
  AND learning_private.unit_allowed(unit_id));

-- Patch reviewed installed definitions, retaining public R10 boundaries and ACLs.
-- Exact fragments and marker checks make the full 02→…→07 replay deterministic.
DO $functions$
DECLARE definition text; before_text text; after_text text;
BEGIN
 definition:=pg_get_functiondef('grammar_private.record_attempt(uuid,text,boolean)'::regprocedure);
 IF strpos(definition,'-- phase3-content-ready-guard-v1')=0 THEN
  before_text:=$before$ IF NOT learning_private.unit_allowed(target.unit_id) THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;$before$;
  after_text:=before_text||$after$
 -- phase3-content-ready-guard-v1
 IF target.content_status<>'ready' THEN RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE='22023'; END IF;$after$;
  IF strpos(definition,before_text)=0 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='content_quality_grading_source_drift'; END IF;
  EXECUTE replace(definition,before_text,after_text);
 END IF;

 definition:=pg_get_functiondef('public.save_learning_content(text,jsonb,uuid)'::regprocedure);
 IF strpos(definition,'-- phase3-content-quality-errors-v1')=0 THEN
  before_text:=$before$ WHEN check_violation OR foreign_key_violation OR invalid_text_representation OR not_null_violation THEN RETURN jsonb_build_object('error','invalid_input','message','Content fields or uploaded file are invalid.');$before$;
  after_text:=$after$ -- phase3-content-quality-errors-v1
 WHEN check_violation OR foreign_key_violation OR invalid_text_representation OR not_null_violation THEN
  RETURN jsonb_build_object('error',CASE WHEN SQLERRM IN('target_form_required','german_text_required') THEN SQLERRM ELSE 'invalid_input' END,
   'message',CASE WHEN SQLERRM='target_form_required' THEN 'Add at least one nonempty target form before saving the exercise.'
    WHEN SQLERRM='german_text_required' THEN 'German learning fields cannot contain Cyrillic or Turkish-specific letters.'
    ELSE 'Content fields or uploaded file are invalid.' END);$after$;
  IF strpos(definition,before_text)=0 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='content_quality_cms_errors_source_drift'; END IF;
  definition:=replace(definition,before_text,after_text);
  EXECUTE definition;
 END IF;
 IF strpos(definition,'-- phase3-translation-prompt-v1')=0 THEN
  before_text:=$before$   INSERT INTO public.grammar_translations(exercise_id,locale,hint,smart_hint,explanation)
   VALUES(item,translation_row->>'locale',translation_row->>'hint',translation_row->>'smart_hint',translation_row->>'explanation');$before$;
  after_text:=$after$   -- phase3-translation-prompt-v1
   INSERT INTO public.grammar_translations(exercise_id,locale,hint,smart_hint,explanation,prompt)
   VALUES(item,translation_row->>'locale',translation_row->>'hint',translation_row->>'smart_hint',translation_row->>'explanation',translation_row->>'prompt');$after$;
  IF strpos(definition,before_text)=0 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='content_quality_cms_prompt_source_drift'; END IF;
  EXECUTE replace(definition,before_text,after_text);
 END IF;
END $functions$;

-- R9 ROLLBACK: stop writers and restore the verified pre-07 R8 backup plus the
-- matching app release; then reload PostgREST. For a scoped rollback, in ONE
-- transaction after separately exporting new grammar_translations.prompt values:
-- 1. Restore pre-07 pg_get_functiondef + owners/ACLs for
--    grammar_private.record_attempt(uuid,text,boolean) and
--    public.save_learning_content(text,jsonb,uuid).
-- 2. Restore pre-07 released_content_read policies on learning_exercises and
--    learning_reading_texts from the backup (staff policies were not changed).
-- 3. DROP TRIGGER guard_exercise_quality ON public.learning_exercises;
--    DROP TRIGGER guard_reading_quality ON public.learning_reading_texts;
--    ALTER TABLE public.learning_exercises DROP COLUMN content_status;
--    ALTER TABLE public.grammar_translations DROP COLUMN prompt;
-- 4. DROP FUNCTION grammar_private.guard_exercise_quality() RESTRICT;
--    DROP FUNCTION learning_private.guard_reading_quality() RESTRICT;
--    DROP FUNCTION grammar_private.exercise_is_ready(jsonb,text) RESTRICT;
--    DROP FUNCTION grammar_private.german_content_allowed(jsonb,text) RESTRICT;
--    DROP FUNCTION grammar_private.valid_target_form(jsonb) RESTRICT;
--    DROP FUNCTION learning_private.german_text_allowed(text) RESTRICT;
--    DROP TYPE public.learning_content_status RESTRICT;
-- 5. Restore the pre-07 grammar_private schema ACL from the R8 backup. If
--    service_role lacked USAGE there before 07 (the verified production baseline):
--    REVOKE USAGE ON SCHEMA grammar_private FROM service_role;
--    Preserve a pre-existing grant; never revoke it unconditionally.
-- No existing exercise/reading/translation payload was rewritten by this migration.
-- Keep any deliberately authored target_form values; restore full data from R8
-- only when an exact point-in-time rollback is required. Never DROP CASCADE.
