BEGIN READ ONLY;
SET LOCAL statement_timeout='30s';
DO $verify$
DECLARE counts integer[];
BEGIN
 SELECT ARRAY[(SELECT count(*)::integer FROM public.learning_units WHERE is_path AND is_active AND level='A1.1'),
  (SELECT count(*)::integer FROM public.path_nodes n JOIN public.learning_units u ON u.id=n.unit_id WHERE u.is_path AND u.level='A1.1' AND n.is_active),
  (SELECT count(*)::integer FROM public.learning_exercises e JOIN public.learning_units u ON u.id=e.unit_id WHERE u.is_path AND u.level='A1.1' AND e.path_is_active),
  (SELECT count(*)::integer FROM public.path_objectives o JOIN public.learning_units u ON u.id=o.unit_id WHERE u.is_path AND u.level='A1.1')]
 INTO counts;
 IF counts<>ARRAY[7,85,769,87] THEN RAISE EXCEPTION 'path_seed_counts_mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM public.learning_units WHERE trainer='exercises' AND NOT is_path AND is_active) THEN RAISE EXCEPTION 'legacy_units_not_archived'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND (c.relname LIKE 'path_%' OR c.relname IN ('learning_sessions','vocabulary_carryover_preferences')) AND c.relkind='r' AND NOT c.relrowsecurity) THEN RAISE EXCEPTION 'RLS_missing'; END IF;
 IF has_function_privilege('anon','public.get_teacher_dashboard_students()','EXECUTE')
  OR has_function_privilege('authenticated','public.import_learning_path_seed(jsonb)','EXECUTE')
  OR has_table_privilege('authenticated','path_private.answer_receipts','SELECT') THEN RAISE EXCEPTION 'privileged_access_exposed'; END IF;
 IF public.get_teacher_dashboard_students()->>'error' IS NULL THEN RAISE EXCEPTION 'teacher_actor_guard_missing'; END IF;
END $verify$;
SELECT 'phase8_catalog_seed_and_grants_ok';
ROLLBACK;
