-- E-mail notifications the learner controls (Phase-8 prompt, item 4).
-- Requires 46 (committed enum value). Apply via deploy/vps/migrate-local.py with a verified backup.
--
-- Mandatory, never switchable: password reset and sign-up confirmation (GoTrue),
-- registration and course enrollment mails, booking/cancellation/course-exception
-- mails and all staff mails. Optional, one switch each in the profile (default on):
--   feedback_available   -> profiles.notify_pronunciation_feedback (teacher reply, 41)
--   level_access_granted -> profiles.notify_new_content (new learning content)
--   learning_reminder    -> profiles.notify_learning_reminders (new here)
--
-- The switch is enforced inside the database, so no path can bypass it:
--   * enqueue: a BEFORE INSERT trigger on private.mail_outbox drops optional
--     mails for recipients who switched them off (whatever inserted them);
--   * switch off: still pending mails of that kind are deleted at once;
--   * send: claim_mail_jobs (the mail worker's only entry) drops optional
--     mails whose recipient switched them off after they were queued.
-- Learning reminder: the mail worker calls queue_learning_reminders() at most
-- once an hour. A learner with an unlocked level, a confirmed login address and
-- no learning activity (answers, pronunciation recordings) and no newly unlocked
-- level for 7 days gets one friendly reminder; at most one per 14 days and at
-- most 3 per break, only between 10:00 and 18:00 Berlin time. No new service.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_new_content boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_learning_reminders boolean NOT NULL DEFAULT true;
GRANT UPDATE(notify_pronunciation_feedback,notify_new_content,notify_learning_reminders) ON TABLE public.profiles TO authenticated;
COMMENT ON COLUMN public.profiles.notify_new_content IS 'Learner opt-out for mails about new learning content (level unlocked). Enforced in the database at enqueue and send time (47).';
COMMENT ON COLUMN public.profiles.notify_learning_reminders IS 'Learner opt-out for learning reminder mails after a break. Enforced in the database at enqueue and send time (47).';

CREATE TABLE IF NOT EXISTS business_private.mail_preference_function_backups(signature text PRIMARY KEY,definition text NOT NULL);
ALTER TABLE business_private.mail_preference_function_backups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON business_private.mail_preference_function_backups FROM PUBLIC,anon,authenticated;
DO $$ DECLARE signature text; BEGIN
 FOREACH signature IN ARRAY ARRAY['public.claim_mail_jobs(uuid,integer)','business_private.notify_students_of_level_access()'] LOOP
  INSERT INTO business_private.mail_preference_function_backups VALUES(signature,pg_get_functiondef(signature::regprocedure)) ON CONFLICT DO NOTHING;
 END LOOP;
END $$;

-- The profile switch of an optional mail kind; NULL = mandatory mail.
CREATE OR REPLACE FUNCTION business_private.mail_preference(p_kind text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE p_kind WHEN 'feedback_available' THEN 'notify_pronunciation_feedback'
  WHEN 'level_access_granted' THEN 'notify_new_content'
  WHEN 'learning_reminder' THEN 'notify_learning_reminders' END;
$$;

-- May this mail go out? Mandatory kinds always. Optional kinds follow the
-- recipient's switch: person from payload.authUserId, else the login address.
CREATE OR REPLACE FUNCTION business_private.mail_allowed(p_kind text,p_recipient text,p_payload jsonb) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_pref text:=business_private.mail_preference(p_kind); v_user uuid; v_allowed boolean;
BEGIN
 IF v_pref IS NULL THEN RETURN true; END IF;
 IF coalesce(p_payload->>'authUserId','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
  v_user:=(p_payload->>'authUserId')::uuid;
 ELSE
  SELECT u.id INTO v_user FROM auth.users u WHERE lower(btrim(u.email))=lower(btrim(p_recipient)) ORDER BY u.created_at LIMIT 1;
 END IF;
 IF v_user IS NULL THEN RETURN true; END IF;
 SELECT CASE v_pref WHEN 'notify_pronunciation_feedback' THEN p.notify_pronunciation_feedback
  WHEN 'notify_new_content' THEN p.notify_new_content ELSE p.notify_learning_reminders END
  INTO v_allowed FROM public.profiles p WHERE p.id=v_user;
 RETURN coalesce(v_allowed,true);
END $$;

CREATE OR REPLACE FUNCTION business_private.skip_opted_out_mail() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF business_private.mail_preference(new.kind::text) IS NOT NULL
  AND NOT business_private.mail_allowed(new.kind::text,new.recipient,new.payload) THEN
  RETURN NULL; -- switched off: the mail is never queued
 END IF;
 RETURN new;
END $$;
DROP TRIGGER IF EXISTS mail_outbox_respect_preferences ON private.mail_outbox;
CREATE TRIGGER mail_outbox_respect_preferences BEFORE INSERT ON private.mail_outbox
 FOR EACH ROW EXECUTE FUNCTION business_private.skip_opted_out_mail();

-- Switching new content or reminders off drops their still pending mails at once
-- (the pronunciation switch keeps its own trigger from 41).
CREATE OR REPLACE FUNCTION business_private.cancel_optional_mail_on_opt_out() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_kinds text[]:='{}'; v_email text;
BEGIN
 BEGIN
  IF old.notify_new_content AND NOT new.notify_new_content THEN v_kinds:=array_append(v_kinds,'level_access_granted'); END IF;
  IF old.notify_learning_reminders AND NOT new.notify_learning_reminders THEN v_kinds:=array_append(v_kinds,'learning_reminder'); END IF;
  IF cardinality(v_kinds)=0 THEN RETURN new; END IF;
  SELECT lower(btrim(u.email)) INTO v_email FROM auth.users u WHERE u.id=new.id;
  DELETE FROM private.mail_outbox WHERE status::text='pending' AND kind::text=ANY(v_kinds)
   AND (payload->>'authUserId'=new.id::text OR (v_email IS NOT NULL AND recipient=v_email));
 EXCEPTION WHEN OTHERS THEN RAISE WARNING 'mail_opt_out_cleanup_failed';
 END;
 RETURN new;
END $$;
DROP TRIGGER IF EXISTS on_optional_mail_opt_out ON public.profiles;
CREATE TRIGGER on_optional_mail_opt_out AFTER UPDATE OF notify_new_content,notify_learning_reminders ON public.profiles
 FOR EACH ROW EXECUTE FUNCTION business_private.cancel_optional_mail_on_opt_out();

-- Send-time check, called by claim_mail_jobs. The worker's role may not delete
-- outbox rows itself, so this narrow definer function does exactly this one thing.
CREATE OR REPLACE FUNCTION business_private.drop_opted_out_mail() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_dropped integer;
BEGIN
 DELETE FROM private.mail_outbox
  WHERE status::text='pending' AND available_at<=now() AND business_private.mail_preference(kind::text) IS NOT NULL
    AND NOT business_private.mail_allowed(kind::text,recipient,payload);
 GET DIAGNOSTICS v_dropped=ROW_COUNT;
 RETURN v_dropped;
END $$;

-- Level-access mails now name the person, so the switch also follows an address change.
CREATE OR REPLACE FUNCTION business_private.notify_students_of_level_access() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r record; v_result jsonb; v_key text;
BEGIN
 BEGIN
  FOR r IN
   SELECT n.auth_user_id,array_agg(n.level ORDER BY l.sort_order NULLS LAST,n.level) levels,
          max(CASE WHEN u.email_confirmed_at IS NOT NULL
                   THEN coalesce(nullif(btrim(u.email),''),(SELECT nullif(btrim(p.email),'') FROM public.people p WHERE p.auth_user_id=u.id LIMIT 1)) END) email,
          max(left(coalesce((SELECT nullif(btrim(p.display_name),'') FROM public.people p WHERE p.auth_user_id=u.id LIMIT 1),''),150)) name,
          max(CASE WHEN pr.ui_language IN('de','en','ru','uk','tr') THEN pr.ui_language ELSE 'de' END) locale
     FROM (SELECT DISTINCT auth_user_id,level FROM new_rows) n
     JOIN auth.users u ON u.id=n.auth_user_id
     LEFT JOIN public.learning_levels l ON l.code=n.level
     LEFT JOIN public.profiles pr ON pr.id=n.auth_user_id
    WHERE NOT EXISTS(SELECT 1 FROM business_private.level_access_announcements a WHERE a.auth_user_id=n.auth_user_id AND a.level=n.level)
    GROUP BY n.auth_user_id
  LOOP
   BEGIN
    IF r.email IS NULL THEN CONTINUE; END IF;
    v_key:='level-access:'||r.auth_user_id||':'||array_to_string(r.levels,'+');
    v_result:=public.queue_transactional_email(v_key,'level_access_granted',r.email,r.locale,
     jsonb_build_object('name',r.name,'authUserId',r.auth_user_id,'levels',to_jsonb(r.levels),'path','/'||r.locale||'/dashboard/level/'||r.levels[1]));
    IF jsonb_typeof(v_result)='object' AND v_result ? 'error' THEN RAISE WARNING 'level_access_notification_failed'; CONTINUE; END IF;
    INSERT INTO business_private.level_access_announcements(auth_user_id,level) SELECT r.auth_user_id,x FROM unnest(r.levels) x ON CONFLICT DO NOTHING;
   EXCEPTION WHEN OTHERS THEN RAISE WARNING 'level_access_notification_failed';
   END;
  END LOOP;
 EXCEPTION WHEN OTHERS THEN RAISE WARNING 'level_access_notification_failed';
 END;
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.claim_mail_jobs(p_worker_id uuid, p_limit integer DEFAULT 5) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN

BEGIN
  -- Exhausted crashed deliveries are quarantined instead of being retried forever.
  UPDATE private.mail_outbox SET status='failed',lease_until=NULL,lease_token=NULL,worker_id=NULL,last_error='lease_expired_at_attempt_limit'
    WHERE status='processing' AND lease_until<now() AND attempts>=8;
  -- Optional mails whose recipient has switched them off in the meantime are
  -- dropped here, at send time, and never delivered (47).
  PERFORM business_private.drop_opted_out_mail();
  WITH picked AS (
    SELECT id FROM private.mail_outbox
    WHERE attempts<8 AND ((status='pending' AND available_at<=now()) OR (status='processing' AND lease_until<now()))
    ORDER BY available_at,created_at LIMIT greatest(1,least(coalesce(p_limit,5),20)) FOR UPDATE SKIP LOCKED
  ), claimed AS (UPDATE private.mail_outbox j SET status='processing',attempts=j.attempts+1,
      worker_id=p_worker_id,lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes'
    FROM picked WHERE j.id=picked.id RETURNING j.*) SELECT coalesce(jsonb_agg(to_jsonb(claimed)),'[]'::jsonb) INTO boundary_result FROM claimed; RETURN boundary_result;
END;
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
$$;

CREATE OR REPLACE FUNCTION public.queue_learning_reminders(p_now timestamptz DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_now timestamptz:=coalesce(p_now,clock_timestamp()); v_local timestamp; r record; v_result jsonb; v_queued integer:=0;
BEGIN
 -- Only the mail worker (service role) may run this; see import_learning_path_seed.
 IF NOT(coalesce(current_setting('role',true),'none')='service_role'
  OR (coalesce(current_setting('role',true),'none')='none' AND session_user='service_role')) THEN
  RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
 END IF;
 v_local:=v_now AT TIME ZONE 'Europe/Berlin';
 IF extract(hour FROM v_local)<10 OR extract(hour FROM v_local)>=18 THEN
  RETURN jsonb_build_object('queued',0,'skipped','quiet_hours');
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reminders',0));
 FOR r IN
  WITH learners AS (
   SELECT u.id,
    CASE WHEN u.email_confirmed_at IS NOT NULL
         THEN coalesce(nullif(btrim(u.email),''),(SELECT nullif(btrim(pe.email),'') FROM public.people pe WHERE pe.auth_user_id=u.id LIMIT 1)) END email,
    left(coalesce((SELECT nullif(btrim(pe.display_name),'') FROM public.people pe WHERE pe.auth_user_id=u.id LIMIT 1),''),150) name,
    CASE WHEN pr.ui_language IN('de','en','ru','uk','tr') THEN pr.ui_language ELSE 'de' END locale,
    greatest((SELECT max(coalesce(d.last_activity_at,d.day::timestamptz)) FROM public.learning_activity_days d WHERE d.auth_user_id=u.id),
             (SELECT max(s.created_at) FROM public.submissions s WHERE s.auth_user_id=u.id),
             (SELECT max(a.granted_at) FROM public.student_level_access a WHERE a.auth_user_id=u.id)) last_seen
   FROM auth.users u JOIN public.profiles pr ON pr.id=u.id
   WHERE pr.role::text='student' AND pr.notify_learning_reminders
     AND EXISTS(SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=u.id)
  )
  SELECT l.* FROM learners l
  WHERE l.email IS NOT NULL AND l.last_seen IS NOT NULL AND l.last_seen<v_now-interval '7 days'
    AND NOT EXISTS(SELECT 1 FROM private.mail_outbox o WHERE o.kind::text='learning_reminder'
     AND o.payload->>'authUserId'=l.id::text AND o.created_at>v_now-interval '14 days')
    AND (SELECT count(*) FROM private.mail_outbox o WHERE o.kind::text='learning_reminder'
     AND o.payload->>'authUserId'=l.id::text AND o.created_at>l.last_seen)<3
  ORDER BY l.last_seen,l.id LIMIT 100
 LOOP
  BEGIN
   v_result:=public.queue_transactional_email('learning-reminder:'||r.id||':'||to_char(v_local,'YYYY-MM-DD'),'learning_reminder',r.email,r.locale,
    jsonb_build_object('name',r.name,'authUserId',r.id,'days',floor(extract(epoch FROM v_now-r.last_seen)/86400)::integer,'path','/'||r.locale||'/dashboard'));
   IF jsonb_typeof(v_result)='object' AND v_result ? 'error' THEN RAISE WARNING 'learning_reminder_failed'; CONTINUE; END IF;
   -- Queue time = reminder time (also when a test passes p_now).
   UPDATE private.mail_outbox SET created_at=v_now,available_at=least(available_at,v_now)
    WHERE dedupe_key='learning-reminder:'||r.id||':'||to_char(v_local,'YYYY-MM-DD') AND status::text='pending';
   IF FOUND THEN v_queued:=v_queued+1; END IF;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'learning_reminder_failed';
  END;
 END LOOP;
 RETURN jsonb_build_object('queued',v_queued);
END $$;

REVOKE ALL ON FUNCTION business_private.mail_preference(text),business_private.mail_allowed(text,text,jsonb),
 business_private.drop_opted_out_mail(),business_private.skip_opted_out_mail(),business_private.cancel_optional_mail_on_opt_out(),
 business_private.notify_students_of_level_access() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION business_private.mail_preference(text),business_private.mail_allowed(text,text,jsonb),business_private.drop_opted_out_mail() TO service_role;
REVOKE ALL ON FUNCTION public.claim_mail_jobs(uuid,integer),public.queue_learning_reminders(timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_mail_jobs(uuid,integer),public.queue_learning_reminders(timestamptz) TO service_role;
