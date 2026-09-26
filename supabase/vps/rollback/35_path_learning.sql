-- R8: run via migrate-local.py with a verified backup and matching old release.
-- Data-preserving rollback: hide path units, restore old reset/activity/grammar
-- functions, disable the new API; keep every authored node/answer/attempt.
-- 34 may subsequently roll back only if no new exercise enum types are used.
DO $$ DECLARE saved record; f record; BEGIN
 IF to_regclass('path_private.function_backups') IS NULL THEN RETURN; END IF;
 INSERT INTO path_private.rollback_unit_flags SELECT id,is_active FROM public.learning_units WHERE is_path ON CONFLICT DO NOTHING;
 UPDATE public.learning_units SET is_active=false WHERE is_path;
 UPDATE public.learning_units u SET is_active=a.is_active FROM path_private.archived_units a WHERE u.id=a.unit_id;
 FOR saved IN SELECT definition FROM path_private.function_backups LOOP EXECUTE saved.definition; END LOOP;
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN('get_learning_path','start_path_node','submit_path_answer','start_path_test','submit_path_test_answer','finish_path_test','manage_learning_path','import_learning_path','export_learning_path') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature);
 END LOOP;
END $$;
-- Keep the solution-safe node_id IS NULL legacy read policy. Tables and foreign
-- keys remain additive, and the previous application never addresses them.
