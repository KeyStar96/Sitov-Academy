-- Final refactoring consistency fixes. Function-only and repeatable: no live
-- customer, calendar, booking, learning or receipt rows are changed/deleted.
-- Apply after 54 through migrate-local.py with its backup and transaction.
-- The previous application can run with these fixes during rollback.

-- Course cancellations have their own commands and administration tab. Never
-- replace their rows during an unrelated course edit: that changes their IDs,
-- reprices bookings twice and loses cancellations entered after the app read.
-- Accept unchanged legacy calendar payloads during rolling upgrades; reject a
-- legacy inline edit explicitly. The current course action omits this field.
DO $patch$
DECLARE definition text; previous text; replacement text;
BEGIN
 SELECT pg_get_functiondef('business_private.save_course(jsonb)'::regprocedure) INTO definition;
 IF position('course-calendar-preservation-v1' IN definition)=0 THEN
  previous:=E' delete from public.course_exceptions where course_id=v_id;\n for v_exception in select value from jsonb_array_elements(p_data->''exceptions'') loop\n  insert into public.course_exceptions(course_id,date,reason) values(v_id,(v_exception->>''date'')::date,v_exception->>''reason'');\n end loop;';
  IF position(previous IN definition)=0 OR position('or jsonb_typeof(p_data->''exceptions'') is distinct from ''array''' IN definition)=0 THEN
   RAISE EXCEPTION 'Unexpected save_course calendar definition';
  END IF;
  replacement:=$code$
 -- course-calendar-preservation-v1
 IF p_data ? 'exceptions' AND
  coalesce((SELECT jsonb_agg(jsonb_build_object('date',(entry->>'date')::date,'reason',entry->>'reason')
    ORDER BY (entry->>'date')::date,entry->>'reason') FROM jsonb_array_elements(p_data->'exceptions') entry),'[]'::jsonb)
  IS DISTINCT FROM
  coalesce((SELECT jsonb_agg(jsonb_build_object('date',e.date,'reason',e.reason) ORDER BY e.date,e.reason)
    FROM public.course_exceptions e WHERE e.course_id=v_id),'[]'::jsonb) THEN
  RAISE EXCEPTION 'Course cancellations must be edited in the separate calendar' USING ERRCODE='23514';
 END IF;
$code$;
  definition:=replace(definition,previous,replacement);
  definition:=replace(definition,'or jsonb_typeof(p_data->''exceptions'') is distinct from ''array''',
   'or (p_data ? ''exceptions'' and jsonb_typeof(p_data->''exceptions'') is distinct from ''array'')');
  EXECUTE definition;
 END IF;
END $patch$;

-- A stored request receipt makes retries idempotent, but never supersedes the
-- learner's current trainer/lesson entitlement. Recheck access before returning
-- the cached solution, matching the ordinary vocabulary answer RPC.
DO $patch$
DECLARE definition text; access_check text; replay text;
BEGIN
 SELECT pg_get_functiondef('public.submit_vocabulary_focus_answer(uuid,uuid,text,text,text)'::regprocedure) INTO definition;
 IF position('focus-replay-access-v1' IN definition)=0 THEN
  access_check:=E' SELECT * INTO card FROM public.learning_vocabulary_cards WHERE id=p_card_id;\n SELECT * INTO unit FROM public.learning_units WHERE id=card.unit_id;\n IF NOT unit.is_active OR NOT learning_private.unit_allowed(unit.id) THEN\n  RETURN jsonb_build_object(''error'',''trainer_access_denied'',''message'',''The request is not authorized.''); END IF;';
  replay:=' SELECT * INTO receipt FROM vocabulary_private.focus_receipts WHERE auth_user_id=actor AND request_id=p_request_id;';
  IF position(access_check IN definition)=0 OR position(replay IN definition)=0 THEN
   RAISE EXCEPTION 'Unexpected focus answer access definition';
  END IF;
  definition:=replace(definition,access_check,'');
  definition:=replace(definition,replay,E' -- focus-replay-access-v1\n'
   ||replace(access_check,'IF NOT unit.is_active','IF unit.id IS NULL OR NOT unit.is_active')||E'\n'||replay);
  EXECUTE definition;
 END IF;
END $patch$;

NOTIFY pgrst,'reload schema';
