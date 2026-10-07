-- Sitov Academy: native PostgreSQL rollback smoke for independent exam grants.
-- The embedded migration is intentionally exercised before activation; all fixtures roll back.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='45s';
SET LOCAL lock_timeout='5s';
SELECT set_config('sitov.independent.student',gen_random_uuid()::text,true),
 set_config('sitov.independent.closed_student',gen_random_uuid()::text,true),
 set_config('sitov.independent.teacher',gen_random_uuid()::text,true),
 set_config('sitov.independent.other_teacher',gen_random_uuid()::text,true),
 set_config('sitov.independent.admin',gen_random_uuid()::text,true),
 set_config('sitov.independent.backfill',(SELECT (position('A1' IN pg_get_constraintdef(oid))=0)::text FROM pg_constraint
  WHERE conrelid='public.sitov_simulation_level_grants'::regclass AND conname='sitov_simulation_level_grants_level_check'),true);
INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data,aud,role,created_at,updated_at,email_confirmed_at)
 SELECT current_setting('sitov.independent.'||k)::uuid,current_setting('sitov.independent.'||k)||'@sitov-independent.invalid',
 '{}'::jsonb,'{}'::jsonb,'authenticated','authenticated',now(),now(),now()
 FROM unnest(ARRAY['student','closed_student','teacher','other_teacher','admin']) k;
INSERT INTO public.profiles(id,role,ui_language,notify_pronunciation_feedback,notify_new_content,notify_learning_reminders)
 SELECT current_setting('sitov.independent.'||k)::uuid,
 CASE WHEN k='admin' THEN 'admin' WHEN k IN('student','closed_student') THEN 'student' ELSE 'teacher' END::public.profile_role,
 'de',false,false,false FROM unnest(ARRAY['student','closed_student','teacher','other_teacher','admin']) k
 ON CONFLICT(id) DO UPDATE SET role=excluded.role,ui_language='de',notify_pronunciation_feedback=false,notify_new_content=false,notify_learning_reminders=false;
INSERT INTO public.student_level_access(auth_user_id,level)
 VALUES(current_setting('sitov.independent.student')::uuid,'B1.2'),(current_setting('sitov.independent.closed_student')::uuid,'A1.1');
SELECT public.sitov_assign_simulation_student(current_setting('sitov.independent.student')::uuid,current_setting('sitov.independent.teacher')::uuid);
INSERT INTO public.sitov_simulation_level_grants(student_id,level,granted_by)
 VALUES(current_setting('sitov.independent.student')::uuid,'C2',current_setting('sitov.independent.admin')::uuid);
-- BEGIN MIGRATION 88
-- Sitov Academy: trainer sublevels and simulated-exam levels have independent grants.
-- Stored coarse verb content and learner evidence stay intact, but B2/C1 are no longer trainers.
UPDATE public.learning_levels SET is_active=false WHERE code IN('B2','C1') AND is_active;
UPDATE public.learning_units SET is_active=false WHERE level IN('B2','C1') AND trainer='verbs' AND is_active;

CREATE OR REPLACE FUNCTION sitov_verb_private.level_allowed(p_user uuid,p_level text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_user
 AND p_level IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2')
 AND (p.role IN('teacher','admin') OR (
  EXISTS(SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=p_user AND a.level=p_level)
  AND coalesce((SELECT g.enabled FROM public.learning_trainer_grants g WHERE g.auth_user_id=p_user AND g.level=p_level AND g.trainer='verbs'),true)
  AND NOT EXISTS(SELECT 1 FROM public.learning_trainer_grants g WHERE g.auth_user_id=p_user AND g.level=p_level AND g.trainer='verbs' AND g.unit_mode='selected'
   AND NOT EXISTS(SELECT 1 FROM public.learning_unit_grants u WHERE u.auth_user_id=p_user AND u.level=p_level AND u.trainer='verbs')))));
$$;

-- Validate the RPC too: a stale tab or direct authenticated call cannot recreate coarse grants.
-- Patching the existing error boundary preserves owner, privileges and return conventions.
DO $patch$
DECLARE definition text;
 anchor constant text:=$old$ IF p_replace_units AND p_unit_ids IS NOT NULL AND EXISTS($old$;
 validation constant text:=$new$ IF p_level NOT IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2')
 OR (p_level IN('C1.1','C1.2') AND p_trainer='verbs')
 THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='23514'; END IF;
$new$;
BEGIN
 definition:=pg_get_functiondef('public.set_student_trainer_access(uuid,text,text,boolean,uuid[],boolean)'::regprocedure);
 IF position(validation IN definition)=0 THEN
  IF position(anchor IN definition)=0 THEN RAISE EXCEPTION 'sitov_trainer_grant_contract_changed'; END IF;
  EXECUTE replace(definition,anchor,validation||anchor);
 END IF;
END $patch$;

-- The constraint doubles as a durable one-time backfill marker. A repeated migration must not
-- recreate a separately revoked exam grant. Expand it and preserve the previously derived
-- rights only during its original transition, only for personally exam-entitled learners.
DO $backfill$
DECLARE previous text;
BEGIN
 SELECT pg_get_constraintdef(oid) INTO previous FROM pg_constraint
 WHERE conrelid='public.sitov_simulation_level_grants'::regclass AND conname='sitov_simulation_level_grants_level_check';
 IF previous IS NULL THEN RAISE EXCEPTION 'sitov_simulation_level_constraint_missing'; END IF;
 IF position('A1' IN previous)=0 THEN
  ALTER TABLE public.sitov_simulation_level_grants DROP CONSTRAINT sitov_simulation_level_grants_level_check;
  ALTER TABLE public.sitov_simulation_level_grants ADD CONSTRAINT sitov_simulation_level_grants_level_check
   CHECK(level IN('A1','A2','B1','B2','C1','C2'));
  INSERT INTO public.sitov_simulation_level_grants(student_id,level,granted_by,granted_at)
   SELECT DISTINCT f.student_id,left(a.level,2),coalesce(
    (SELECT p.id FROM public.sitov_exam_teacher_assignments x JOIN public.profiles p ON p.id=x.teacher_id
     WHERE x.student_id=f.student_id AND p.role IN('teacher','admin')),
    (SELECT p.id FROM public.profiles p WHERE p.role='admin' ORDER BY (p.id=f.granted_by) DESC,p.id LIMIT 1)),f.granted_at
   FROM public.sitov_simulation_feature_grants f JOIN public.profiles student ON student.id=f.student_id AND student.role='student'
   JOIN public.student_level_access a ON a.auth_user_id=f.student_id
   WHERE a.level IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2')
   ON CONFLICT(student_id,level) DO NOTHING;
 END IF;
END $backfill$;

-- No trainer level is consulted from here on. C2 grants remain stored but cannot open C2.
CREATE OR REPLACE FUNCTION sitov_simulation_private.level_allowed(p_student uuid,p_level text) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$
 SELECT p_level IN('A1','A2','B1','B2','C1') AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_student
  AND (p.role IN('teacher','admin') OR (p.role='student' AND EXISTS(
   SELECT 1 FROM public.sitov_simulation_level_grants g WHERE g.student_id=p.id AND g.level=p_level))))
$$;
REVOKE ALL ON FUNCTION sitov_simulation_private.level_allowed(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION sitov_simulation_private.level_allowed(uuid,text) TO service_role;

-- Serialize grant revocation with answers and already-issued uploads.
CREATE OR REPLACE FUNCTION sitov_simulation_private.validate_grant() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE learner uuid; BEGIN
 learner:=CASE WHEN TG_OP='DELETE' THEN OLD.student_id ELSE NEW.student_id END;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||learner::text,0));
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=NEW.student_id AND role='student')
 OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=NEW.granted_by AND (p.role='admin' OR (p.role='teacher' AND EXISTS(
  SELECT 1 FROM public.sitov_exam_teacher_assignments a WHERE a.student_id=NEW.student_id AND a.teacher_id=NEW.granted_by))))
 THEN RAISE EXCEPTION 'unauthorized_simulation_level_grant' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sitov_simulation_private.validate_grant() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS sitov_simulation_grant_valid ON public.sitov_simulation_level_grants;
CREATE TRIGGER sitov_simulation_grant_valid BEFORE INSERT OR UPDATE OR DELETE ON public.sitov_simulation_level_grants
 FOR EACH ROW EXECUTE FUNCTION sitov_simulation_private.validate_grant();

CREATE OR REPLACE FUNCTION sitov_simulation_private.guard_level_run() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 -- A revoked active attempt may only be closed with its original answers. Completed evidence
 -- remains available to assigned teachers. Existing frozen assignment validation still applies.
 IF TG_OP='INSERT' OR NEW.status='active' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||NEW.student_id::text,0));
  IF NOT sitov_simulation_private.level_allowed(NEW.student_id,NEW.level)
  THEN RAISE EXCEPTION 'simulation_level_not_granted' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sitov_simulation_private.guard_level_run() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS sitov_simulation_level_guard ON public.sitov_simulation_runs;
CREATE TRIGGER sitov_simulation_level_guard BEFORE INSERT OR UPDATE ON public.sitov_simulation_runs
 FOR EACH ROW EXECUTE FUNCTION sitov_simulation_private.guard_level_run();

-- Existing feature guards continue to validate personal access and upload lifetime. Add the
-- independent level check, including signed uploads issued before the level was revoked.
DO $patch$
DECLARE target record; definition text;
BEGIN
 FOR target IN SELECT * FROM (VALUES
  ('sitov_simulation_private.guard_feature_ticket()',
   'IF NOT EXISTS(SELECT 1 FROM public.sitov_simulation_runs r WHERE r.id=NEW.simulation_run_id AND r.student_id=NEW.student_id AND r.status=''active'' AND r.expires_at>clock_timestamp())',
   'IF NOT EXISTS(SELECT 1 FROM public.sitov_simulation_runs r WHERE r.id=NEW.simulation_run_id AND r.student_id=NEW.student_id AND sitov_simulation_private.level_allowed(r.student_id,r.level)) THEN RAISE EXCEPTION ''simulation_level_not_granted'' USING ERRCODE=''42501''; END IF;'),
  ('sitov_simulation_private.guard_feature_storage()',
   'IF NOT EXISTS(SELECT 1 FROM public.sitov_simulation_runs r WHERE r.id=simulation AND r.student_id=learner AND r.status=''active'' AND r.expires_at>clock_timestamp())',
   'IF NOT EXISTS(SELECT 1 FROM public.sitov_simulation_runs r WHERE r.id=simulation AND r.student_id=learner AND sitov_simulation_private.level_allowed(r.student_id,r.level)) THEN RAISE EXCEPTION ''simulation_level_not_granted'' USING ERRCODE=''42501''; END IF;'),
  ('public.sitov_store_simulation_change(uuid,uuid,integer,jsonb,uuid,text,text)',
   'SELECT * INTO receipt FROM public.sitov_simulation_receipts WHERE student_id=p_student_id AND request_id=p_request_id;',
   'IF p_kind=''answer'' AND NOT sitov_simulation_private.level_allowed(p_student_id,target.level) THEN RAISE EXCEPTION ''simulation_level_not_granted'' USING ERRCODE=''42501''; END IF;')
 ) AS patch(signature,anchor,validation) LOOP
  definition:=pg_get_functiondef(target.signature::regprocedure);
  IF position(target.validation IN definition)=0 THEN
   IF position(target.anchor IN definition)=0 THEN RAISE EXCEPTION 'sitov_simulation_level_guard_contract_changed: %',target.signature; END IF;
   EXECUTE replace(definition,target.anchor,target.validation||E'\n '||target.anchor);
  END IF;
 END LOOP;
END $patch$;
NOTIFY pgrst,'reload schema';
-- END MIGRATION 88
DO $$ BEGIN
 IF current_setting('sitov.independent.backfill')::boolean AND NOT EXISTS(SELECT 1 FROM public.sitov_simulation_level_grants
  WHERE student_id=current_setting('sitov.independent.student')::uuid AND level='B1')
 THEN RAISE EXCEPTION 'sitov_independent_previous_access_lost'; END IF;
 IF EXISTS(SELECT 1 FROM public.sitov_simulation_level_grants WHERE student_id=current_setting('sitov.independent.closed_student')::uuid)
 THEN RAISE EXCEPTION 'sitov_independent_closed_student_backfilled'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sitov_simulation_level_grants WHERE student_id=current_setting('sitov.independent.student')::uuid AND level='C2')
 OR sitov_simulation_private.level_allowed(current_setting('sitov.independent.student')::uuid,'C2')
 THEN RAISE EXCEPTION 'sitov_independent_c2_contract_changed'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('sitov.independent.teacher'),true);
DO $$ BEGIN
 BEGIN
  INSERT INTO public.sitov_simulation_level_grants(student_id,level,granted_by)
   VALUES(current_setting('sitov.independent.student')::uuid,'A1',current_setting('sitov.independent.teacher')::uuid);
  RAISE EXCEPTION 'sitov_independent_browser_write_allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF (public.set_student_trainer_access(current_setting('sitov.independent.student')::uuid,'B2','verbs',true)->>'error') IS DISTINCT FROM 'invalid_input'
 OR (public.set_student_trainer_access(current_setting('sitov.independent.student')::uuid,'C1','verbs',true)->>'error') IS DISTINCT FROM 'invalid_input'
 THEN RAISE EXCEPTION 'sitov_independent_retired_trainer_grant_allowed'; END IF;
END $$;
SET LOCAL ROLE service_role;
DO $$ BEGIN
 BEGIN
  INSERT INTO public.sitov_simulation_level_grants(student_id,level,granted_by)
   VALUES(current_setting('sitov.independent.student')::uuid,'A1',current_setting('sitov.independent.other_teacher')::uuid);
  RAISE EXCEPTION 'sitov_independent_unassigned_teacher_grant_allowed';
 EXCEPTION WHEN insufficient_privilege THEN
  IF SQLERRM<>'unauthorized_simulation_level_grant' THEN RAISE; END IF;
 END;
END $$;
INSERT INTO public.sitov_simulation_level_grants(student_id,level,granted_by)
 SELECT current_setting('sitov.independent.student')::uuid,level,current_setting('sitov.independent.teacher')::uuid
 FROM unnest(ARRAY['A1','A2','B1','B2','C1']) level ON CONFLICT(student_id,level) DO NOTHING;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['A1','A2','B1','B2','C1']) level
  WHERE NOT sitov_simulation_private.level_allowed(current_setting('sitov.independent.student')::uuid,level))
 THEN RAISE EXCEPTION 'sitov_independent_exam_grant_missing'; END IF;
 IF EXISTS(SELECT 1 FROM public.student_level_access WHERE auth_user_id=current_setting('sitov.independent.student')::uuid AND level<>'B1.2')
 THEN RAISE EXCEPTION 'sitov_independent_exam_opened_trainer'; END IF;
END $$;
DELETE FROM public.student_level_access WHERE auth_user_id=current_setting('sitov.independent.student')::uuid AND level='B1.2';
DO $$ BEGIN
 IF NOT sitov_simulation_private.level_allowed(current_setting('sitov.independent.student')::uuid,'B1')
 THEN RAISE EXCEPTION 'sitov_independent_trainer_revoke_closed_exam'; END IF;
END $$;
INSERT INTO public.student_level_access(auth_user_id,level) VALUES(current_setting('sitov.independent.student')::uuid,'B1.2');
DELETE FROM public.sitov_simulation_level_grants WHERE student_id=current_setting('sitov.independent.student')::uuid AND level='B1';
RESET ROLE;
DO $$ BEGIN
 IF sitov_simulation_private.level_allowed(current_setting('sitov.independent.student')::uuid,'B1')
 OR NOT EXISTS(SELECT 1 FROM public.student_level_access WHERE auth_user_id=current_setting('sitov.independent.student')::uuid AND level='B1.2')
 THEN RAISE EXCEPTION 'sitov_independent_exam_revoke_changed_trainer'; END IF;
 IF sitov_verb_private.level_allowed(current_setting('sitov.independent.student')::uuid,'B2')
 OR sitov_verb_private.level_allowed(current_setting('sitov.independent.teacher')::uuid,'C1')
 THEN RAISE EXCEPTION 'sitov_independent_retired_trainer_access'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'sitov_independent_simulation_levels_ok' AS result;
