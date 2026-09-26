-- Apply after rollback/35, with a verified backup. No exercise is deleted.
DO $rollback$
DECLARE saved record;
BEGIN
 IF EXISTS(SELECT 1 FROM public.learning_exercises WHERE type::text IN
  ('multi_blank','matching','categorize','dialogue','listening','transform')) THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='path_content_requires_backup_restore';
 END IF;
 IF to_regclass('path_private.content_contract_backups') IS NOT NULL THEN
  FOR saved IN SELECT signature,definition FROM path_private.content_contract_backups LOOP
   EXECUTE saved.definition;
  END LOOP;
 END IF;
END $rollback$;
DROP FUNCTION IF EXISTS path_private.grade(public.exercise_type,jsonb,jsonb) RESTRICT;
DROP FUNCTION IF EXISTS path_private.present_content(public.exercise_type,jsonb) RESTRICT;
DROP FUNCTION IF EXISTS path_private.valid_content(public.exercise_type,jsonb) RESTRICT;
DROP FUNCTION IF EXISTS path_private.german_task_allowed(jsonb) RESTRICT;
DROP FUNCTION IF EXISTS path_private.valid_local_audio(jsonb) RESTRICT;
DROP FUNCTION IF EXISTS path_private.only_keys(jsonb,text[]) RESTRICT;
DROP FUNCTION IF EXISTS path_private.valid_strings(jsonb,integer,boolean) RESTRICT;
DROP FUNCTION IF EXISTS path_private.text_key(text) RESTRICT;
DROP FUNCTION IF EXISTS path_private.valid_text(jsonb,integer,boolean) RESTRICT;
DROP TABLE IF EXISTS path_private.content_contract_backups RESTRICT;
-- path_private may contain archived Phase 3 data after 35 rollback; retain it.
