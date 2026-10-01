-- Read-only acceptance for final refactoring migrations 54 and 55.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='30s';
DO $verify$
DECLARE course_definition text; focus_definition text; access_position integer; replay_position integer;
BEGIN
 SELECT pg_get_functiondef('business_private.save_course(jsonb)'::regprocedure) INTO course_definition;
 IF position('course-calendar-preservation-v1' IN course_definition)=0
  OR position('delete from public.course_exceptions' IN lower(course_definition))>0 THEN
  RAISE EXCEPTION 'course_edit_replaces_calendar';
 END IF;
 SELECT pg_get_functiondef('public.submit_vocabulary_focus_answer(uuid,uuid,text,text,text)'::regprocedure) INTO focus_definition;
 access_position:=position('IF unit.id IS NULL OR NOT unit.is_active OR NOT learning_private.unit_allowed(unit.id)' IN focus_definition);
 replay_position:=position('SELECT * INTO receipt FROM vocabulary_private.focus_receipts' IN focus_definition);
 IF access_position=0 OR replay_position=0 OR access_position>=replay_position THEN
  RAISE EXCEPTION 'focus_receipt_bypasses_current_access';
 END IF;
 IF has_function_privilege('anon','public.get_learning_progress(uuid,text,integer)','EXECUTE')
  OR has_function_privilege('anon','public.submit_vocabulary_focus_answer(uuid,uuid,text,text,text)','EXECUTE')
  OR has_table_privilege('authenticated','public.vocabulary_focus_words','UPDATE')
  OR has_table_privilege('authenticated','public.learning_media_views','INSERT') THEN
  RAISE EXCEPTION 'refactoring_private_grants_exposed';
 END IF;
END $verify$;
SELECT 'refactoring_consistency_ok' AS result;
ROLLBACK;
