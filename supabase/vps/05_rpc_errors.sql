-- Phase 2 / R10: every application RPC has a JSONB error boundary. Run inside
-- migrate-local.py's transaction after 02,03,01,04 and a verified R8 backup.
-- Successful JSON wire values are preserved: scalar, null, object, or row array.
-- Parameter names, defaults, authorization, ownership and EXECUTE grants survive.
-- PostgreSQL/PostgREST errors before function entry (invalid parameter encoding,
-- absent EXECUTE permission, unavailable database) remain transport errors.

-- Internal SQL callers must propagate a nested RPC failure; ignoring its JSONB
-- value would otherwise commit a booking without its transactional email.
CREATE OR REPLACE FUNCTION platform_private.require_rpc_success(p_result jsonb) RETURNS void
LANGUAGE plpgsql SET search_path TO '' AS $function$
BEGIN
 IF jsonb_typeof(p_result)='object' AND p_result ? 'error' THEN
  RAISE EXCEPTION USING ERRCODE=CASE WHEN p_result->>'sqlstate' ~ '^[A-Z0-9]{5}$'
    AND p_result->>'sqlstate'<>'00000' THEN p_result->>'sqlstate' ELSE 'P0001' END,
   MESSAGE=coalesce(p_result->>'error','request_failed'),DETAIL=p_result::text;
 END IF;
END $function$;
REVOKE ALL ON FUNCTION platform_private.require_rpc_success(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION platform_private.require_rpc_success(jsonb) TO service_role;

DO $rpc_boundaries$
DECLARE signature text; routine record; definition text; source text; body text;
 original_query text; return_type text; saved_comment text; saved_acl aclitem[];
 privilege record; grantee text; boundary text;
BEGIN
 boundary:=$boundary$
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS boundary_state=RETURNED_SQLSTATE,boundary_message=MESSAGE_TEXT;
  -- Preserve stable domain codes, never include arbitrary SQL text or row data.
  boundary_code:=CASE WHEN boundary_message=ANY(ARRAY[
   'authentication_required','invalid_answer','exercise_unavailable','trainer_access_denied',
   'learning_reset_in_progress','reset_owner_required','confirmation_required','audio_removal_incomplete',
   'inactive_content','invalid_decisions','invalid_decision','invalid_direction','level_access_denied',
   'lesson_not_found','invalid_language','answer_too_long','progress_not_found','review_not_due',
   'vocabulary_spacing_required','sentence_content_missing','answer_required','invalid_answer_request',
   'invalid_learning_language','vocabulary_request_conflict','unknown_course_audience',
   'not_authorized','not_authenticated','invalid_input','request_failed','conflict','not_found',
   'email_unverified','identity_conflict','identity_already_linked','person_not_found','auth_user_not_found'
  ]) THEN boundary_message
  WHEN boundary_state='42501' THEN 'not_authorized'
  WHEN boundary_state IN('23502','23503','23514','22P02','22023','22007') THEN 'invalid_input'
  WHEN boundary_state IN('23505','PT409','40001') THEN 'conflict'
  WHEN boundary_state='40P01' THEN 'retry_required'
  WHEN boundary_state IN('P0002','02000') THEN 'not_found'
  WHEN boundary_state='22008' THEN 'month_changed'
  ELSE 'request_failed' END;
  RETURN jsonb_build_object('error',boundary_code,'message',CASE
   WHEN boundary_code='vocabulary_spacing_required' THEN 'Review another card before this card.'
   WHEN boundary_code='review_not_due' THEN 'This review is not due yet.'
   WHEN boundary_state='42501' THEN 'The request is not authorized.'
   WHEN boundary_code IN('conflict','retry_required') THEN 'Reload and retry the request.'
   WHEN boundary_code='invalid_input' THEN 'The request contains invalid data.'
   ELSE 'The request could not be completed.' END,'sqlstate',boundary_state);
END;
$boundary$;
 FOR signature IN SELECT unnest(ARRAY[
  'public.begin_learning_reset(text)',
  'public.claim_mail_jobs(uuid,integer)',
  'public.claim_verified_person()',
  'public.complete_mail_job(uuid,uuid,text)',
  'public.confirm_business_booking(uuid)',
  'public.consume_rate_limit(text,integer,integer)',
  'public.create_pronunciation_submission(uuid,text)',
  'public.decline_business_booking(uuid)',
  'public.delete_learning_content(text,uuid)',
  'public.fail_mail_job(uuid,uuid,text,boolean)',
  'public.finish_learning_reset(uuid)',
  'public.initialize_vocabulary_cards(jsonb)',
  'public.learning_reset_audio_batch(uuid)',
  'public.mark_business_invoice(uuid,date,boolean,text)',
  'public.mark_pronunciation_seen(uuid)',
  'public.prepare_business_month(date)',
  'public.queue_transactional_email(text,text,text,text,jsonb)',
  'public.record_grammar_attempt(uuid,text,boolean)',
  'public.reset_student_level_progress(uuid,text)',
  'public.reset_vocabulary_lesson_progress(uuid)',
  'public.save_business_course(jsonb)',
  'public.save_business_month(date,jsonb,boolean,uuid,integer)',
  'public.save_learning_content(text,jsonb,uuid)',
  'public.save_student_blackboard(uuid,text,uuid)',
  'public.set_student_level_access(uuid,text[])',
  'public.set_student_trainer_access(uuid,text,text,boolean,uuid[],boolean)',
  'public.skip_vocabulary_assessment(text)',
  'public.submit_business_registration(jsonb,jsonb,date,jsonb,text,boolean)',
  'public.submit_vocabulary_answer(uuid,boolean,text,text)',
  'public.submit_vocabulary_answer_once(uuid,uuid,boolean,text,text)',
  'public.list_registration_identity_conflicts()',
  'public.resolve_registration_identity(uuid,uuid)',
  'public.media_storage_usage()',
  'public.save_course_exception(uuid,date,text)',
  'public.delete_course_exception(uuid)',
  'public.submit_business_cancellation(text,text,uuid,text,date,text)'
 ]) LOOP
  IF to_regprocedure(signature) IS NULL THEN
   RAISE EXCEPTION USING ERRCODE='42883',MESSAGE='rpc_boundary_missing_function',DETAIL=signature;
  END IF;
  SELECT p.*,l.lanname,pg_get_userbyid(p.proowner) owner_name INTO routine
   FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=to_regprocedure(signature);
  IF strpos(routine.prosrc,'-- phase2-rpc-error-boundary-v1')>0 THEN
   IF routine.prorettype<>'jsonb'::regtype OR routine.proretset THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='rpc_boundary_return_drift',DETAIL=signature;
   END IF;
   CONTINUE;
  END IF;
  definition:=pg_get_functiondef(routine.oid);
  saved_comment:=obj_description(routine.oid,'pg_proc');
  saved_acl:=coalesce(routine.proacl,acldefault('f',routine.proowner));
  source:=btrim(routine.prosrc);
  return_type:=routine.prorettype::regtype::text;
  IF routine.lanname='sql' THEN
   original_query:=regexp_replace(source,';\s*$','');
   IF routine.proretset THEN
    body:=format('RETURN (SELECT coalesce(jsonb_agg(to_jsonb(rpc_row)),''[]''::jsonb) FROM (%s) rpc_row);',original_query);
   ELSIF return_type='void' THEN
    IF original_query !~* '^select\s' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='rpc_boundary_source_drift',DETAIL=signature; END IF;
    body:=regexp_replace(original_query,'^select\s+','PERFORM ','i')||E';\n RETURN ''null''::jsonb;';
   ELSE
    body:=format('RETURN to_jsonb((%s));',original_query);
   END IF;
  ELSIF routine.lanname='plpgsql' THEN
   IF signature='public.claim_mail_jobs(uuid,integer)' THEN
    -- Data-modifying CTE retains FOR UPDATE SKIP LOCKED and lease semantics.
    IF strpos(source,'RETURN QUERY WITH picked AS (')=0 OR strpos(source,'RETURNING j.*;')=0 THEN
     RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='rpc_boundary_source_drift',DETAIL=signature;
    END IF;
    source:=replace(source,'RETURN QUERY WITH picked AS (','WITH picked AS (');
    source:=replace(source,') UPDATE private.mail_outbox j', '), claimed AS (UPDATE private.mail_outbox j');
    source:=replace(source,'RETURNING j.*;','RETURNING j.*) SELECT coalesce(jsonb_agg(to_jsonb(claimed)),''[]''::jsonb) INTO boundary_result FROM claimed; RETURN boundary_result;');
   ELSIF signature='public.consume_rate_limit(text,integer,integer)' THEN
    IF strpos(source,'RETURN QUERY SELECT v_count<=p_limit,GREATEST(0,p_limit-v_count),v_reset;')=0 THEN
     RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='rpc_boundary_source_drift',DETAIL=signature;
    END IF;
    source:=replace(source,'RETURN QUERY SELECT v_count<=p_limit,GREATEST(0,p_limit-v_count),v_reset;',
     'RETURN jsonb_build_array(jsonb_build_object(''success'',v_count<=p_limit,''remaining'',GREATEST(0,p_limit-v_count),''reset_at'',v_reset));');
   ELSIF signature='public.save_student_blackboard(uuid,text,uuid)' THEN
    IF strpos(source,'RETURN QUERY INSERT INTO public.teacher_student_notes')=0 OR strpos(source,'RETURN QUERY UPDATE public.teacher_student_notes')=0 THEN
     RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='rpc_boundary_source_drift',DETAIL=signature;
    END IF;
    source:=regexp_replace(source,'RETURN QUERY ([^;]+);','WITH written AS (\1) SELECT coalesce(jsonb_agg(to_jsonb(written)),''[]''::jsonb) INTO boundary_result FROM written; RETURN boundary_result;','g');
    source:=replace(source,'RETURN;','RETURN ''[]''::jsonb;');
   ELSIF routine.proretset THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='rpc_boundary_unsupported_set_function',DETAIL=signature;
   ELSIF return_type NOT IN('void','jsonb') THEN
    IF source !~* '\mreturn\s+[^;]+;' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='rpc_boundary_source_drift',DETAIL=signature; END IF;
    source:=regexp_replace(source,'\mreturn\s+([^;]+);','RETURN to_jsonb(\1);','gi');
   END IF;
   body:=regexp_replace(source,';?\s*$',';');
   IF return_type='void' THEN body:=body||E'\n RETURN ''null''::jsonb;'; END IF;
  ELSE
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='rpc_boundary_unsupported_language',DETAIL=signature;
  END IF;
  body:=E'\n-- phase2-rpc-error-boundary-v1\nDECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;\nBEGIN\n'||body||boundary;
  -- pg_get_functiondef emits a stable $function$ delimiter; abort on drift.
  IF strpos(definition,'AS $function$')=0 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='rpc_boundary_definition_drift',DETAIL=signature; END IF;
  definition:=split_part(definition,'AS $function$',1)||'AS $function$'||body||'$function$';
  definition:=regexp_replace(definition,'\n RETURNS [^\n]+',E'\n RETURNS jsonb');
  definition:=regexp_replace(definition,'LANGUAGE sql','LANGUAGE plpgsql');
  IF routine.prorettype<>'jsonb'::regtype OR routine.proretset THEN
   -- RESTRICT is intentional: a new catalog dependency must be reviewed, never
   -- silently removed. Captured ACLs include grant options and default PUBLIC.
   EXECUTE format('DROP FUNCTION %s RESTRICT',signature);
   EXECUTE definition;
   EXECUTE format('ALTER FUNCTION %s OWNER TO %I',signature,routine.owner_name);
   FOR privilege IN SELECT x.* FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x WHERE p.oid=to_regprocedure(signature) LOOP
    grantee:=CASE WHEN privilege.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(privilege.grantee)) END;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %s',signature,grantee);
   END LOOP;
   FOR privilege IN SELECT * FROM aclexplode(saved_acl) LOOP
    grantee:=CASE WHEN privilege.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(privilege.grantee)) END;
    EXECUTE format('GRANT %s ON FUNCTION %s TO %s%s',privilege.privilege_type,signature,grantee,CASE WHEN privilege.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
   END LOOP;
   IF saved_comment IS NOT NULL THEN EXECUTE format('COMMENT ON FUNCTION %s IS %L',signature,saved_comment); END IF;
  ELSE
   EXECUTE definition;
  END IF;
 END LOOP;
END $rpc_boundaries$;

DO $nested_rpc_errors$
DECLARE routine record; definition text;
BEGIN
 FOR routine IN SELECT p.oid,p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN('public','business_private') AND p.prokind='f'
   AND p.prosrc ~* 'perform\s+public\.queue_transactional_email\(' LOOP
  definition:=pg_get_functiondef(routine.oid);
  definition:=regexp_replace(definition,'(perform\s+)(public\.queue_transactional_email\([^;]+\));','\1platform_private.require_rpc_success(\2);','gi');
  IF definition=pg_get_functiondef(routine.oid) THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='rpc_boundary_queue_caller_drift',DETAIL=routine.oid::regprocedure::text;
  END IF;
  EXECUTE definition;
 END LOOP;
END $nested_rpc_errors$;

-- ROLLBACK: stop app/mail workers and restore the verified pre-deploy database
-- dump together with the matching application release (R8/R9). This migration
-- changes RPC return types, so CREATE OR REPLACE alone cannot undo it. For a
-- scoped rollback, DROP each converted public signature above with RESTRICT,
-- recreate its pre-05 pg_get_functiondef + owner/ACL/comment from the backup,
-- restore queue callers before dropping require_rpc_success(jsonb), then reload
-- PostgREST's schema cache. Never CASCADE or restore an older app against these
-- signatures without the matching database restoration. No table data is changed.
