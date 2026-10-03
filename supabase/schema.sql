-- Canonical VPS application schema. Auth/Storage bootstrap is managed separately.
--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 15.8

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: business_private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA business_private;


--
-- Name: grammar_private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA grammar_private;


--
-- Name: identity_private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA identity_private;


--
-- Name: learning_private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA learning_private;


--
-- Name: learning_reset_private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA learning_reset_private;


--
-- Name: media_private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA media_private;


--
-- Name: path_private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA path_private;


--
-- Name: platform_private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA platform_private;


--
-- Name: private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA private;


--
-- Name: pronunciation_private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pronunciation_private;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: teacher_dashboard_private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA teacher_dashboard_private;


--
-- Name: trainer_access_private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA trainer_access_private;


--
-- Name: vocabulary_private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA vocabulary_private;


--
-- Name: answer_hint; Type: TYPE; Schema: learning_private; Owner: -
--

CREATE TYPE learning_private.answer_hint AS ENUM (
    'capitalization',
    'punctuation',
    'capitalization_punctuation'
);


--
-- Name: answer_status; Type: TYPE; Schema: learning_private; Owner: -
--

CREATE TYPE learning_private.answer_status AS ENUM (
    'EXACT',
    'SOFT_ERROR',
    'INCORRECT'
);


--
-- Name: soft_error_reason; Type: TYPE; Schema: learning_private; Owner: -
--

CREATE TYPE learning_private.soft_error_reason AS ENUM (
    'punctuation',
    'capitalization',
    'umlaut',
    'typo'
);


--
-- Name: booking_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.booking_kind AS ENUM (
    'registration',
    'monthly',
    'trial'
);


--
-- Name: booking_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.booking_status AS ENUM (
    'pending',
    'confirmed',
    'cancelled',
    'rejected'
);


--
-- Name: cancellation_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cancellation_type AS ENUM (
    'asap',
    'specific_date'
);


--
-- Name: cefr_code; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cefr_code AS ENUM (
    'A1',
    'A2',
    'B1',
    'B2',
    'C1',
    'C2'
);


--
-- Name: course_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.course_category AS ENUM (
    'german',
    'speaking',
    'online',
    'private'
);


--
-- Name: course_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.course_type AS ENUM (
    'presence',
    'online'
);


--
-- Name: exercise_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.exercise_type AS ENUM (
    'fill_in_blank',
    'multiple_choice',
    'sentence_building',
    'multi_blank',
    'matching',
    'categorize',
    'dialogue',
    'listening',
    'transform'
);


--
-- Name: grammatical_article; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.grammatical_article AS ENUM (
    'der',
    'die',
    'das',
    'none'
);


--
-- Name: invoice_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoice_status AS ENUM (
    'outstanding',
    'created'
);


--
-- Name: learning_content_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.learning_content_status AS ENUM (
    'incomplete',
    'ready'
);


--
-- Name: learning_session_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.learning_session_mode AS ENUM (
    'vocabulary',
    'path',
    'pronunciation'
);


--
-- Name: mail_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.mail_kind AS ENUM (
    'registration_received',
    'registration_confirmed',
    'booking_cancelled',
    'cancellation_requested',
    'trial_confirmed',
    'trial_cancelled',
    'new_enrollment',
    'feedback_available',
    'raw',
    'course_exception_added',
    'new_signup',
    'level_access_granted',
    'learning_reminder'
);


--
-- Name: mail_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.mail_status AS ENUM (
    'pending',
    'processing',
    'sent',
    'failed'
);


--
-- Name: media_format; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.media_format AS ENUM (
    'mp4',
    'webm',
    'pdf',
    'pptx',
    'key'
);


--
-- Name: onboarding_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.onboarding_status AS ENUM (
    'skipped',
    'completed'
);


--
-- Name: path_intervention_action; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.path_intervention_action AS ENUM (
    'unlock',
    'reset_path',
    'reset_test'
);


--
-- Name: path_node_kind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.path_node_kind AS ENUM (
    'practice',
    'review',
    'test',
    'special'
);


--
-- Name: path_objective_area; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.path_objective_area AS ENUM (
    'grammar',
    'communication',
    'can_do',
    'vocabulary'
);


--
-- Name: path_progress_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.path_progress_status AS ENUM (
    'in_progress',
    'completed'
);


--
-- Name: path_run_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.path_run_status AS ENUM (
    'active',
    'completed',
    'abandoned'
);


--
-- Name: profile_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.profile_role AS ENUM (
    'student',
    'teacher',
    'admin'
);


--
-- Name: submission_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.submission_status AS ENUM (
    'pending',
    'reviewed'
);


--
-- Name: submission_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.submission_type AS ENUM (
    'audio',
    'text'
);


--
-- Name: trainer_code; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.trainer_code AS ENUM (
    'vocabulary',
    'exercises',
    'pronunciation',
    'videos'
);


--
-- Name: unit_access_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.unit_access_mode AS ENUM (
    'all',
    'selected'
);


--
-- Name: vocabulary_direction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vocabulary_direction AS ENUM (
    'de_to_native',
    'native_to_de'
);


--
-- Name: article_feedback; Type: TYPE; Schema: vocabulary_private; Owner: -
--

CREATE TYPE vocabulary_private.article_feedback AS ENUM (
    'article_missing',
    'article_wrong'
);


--
-- Name: booking_exception_rows(uuid); Type: FUNCTION; Schema: business_private; Owner: -
--

CREATE FUNCTION business_private.booking_exception_rows(p_booking uuid) RETURNS TABLE(course_id uuid, title text, date date, reason text)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
 SELECT DISTINCT i.course_id,i.title_snapshot,e.date,e.reason
 FROM public.bookings b JOIN public.booking_items i ON i.booking_id=b.id
 JOIN public.courses c ON c.id=i.course_id
 JOIN public.course_exceptions e ON e.course_id IS NULL OR e.course_id=c.id
 WHERE b.id=p_booking AND e.date>=b.start_date
 AND e.date<(b.target_month+interval '1 month')::date
 AND (b.kind<>'trial' OR e.date=b.start_date)
 AND (c.start_date IS NULL OR e.date>=c.start_date)
 AND (c.end_date IS NULL OR e.date<=c.end_date)
 AND EXISTS(SELECT 1 FROM public.course_schedules s WHERE s.course_id=c.id AND s.weekday=extract(isodow FROM e.date))
$$;


--
-- Name: booking_mail_exceptions(uuid); Type: FUNCTION; Schema: business_private; Owner: -
--

CREATE FUNCTION business_private.booking_mail_exceptions(p_booking uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE result jsonb;
BEGIN
 SELECT coalesce(jsonb_agg(jsonb_build_object('courseId',course_id,'title',title,'date',date,'reason',reason) ORDER BY date,course_id,reason),'[]'::jsonb)
 INTO result FROM business_private.booking_exception_rows(p_booking);
 INSERT INTO private.mail_exception_deliveries(booking_id,course_id,date)
 SELECT p_booking,course_id,date FROM business_private.booking_exception_rows(p_booking)
 ON CONFLICT DO NOTHING;
 RETURN result;
END $$;


--
-- Name: claim_person(); Type: FUNCTION; Schema: business_private; Owner: -
--

CREATE FUNCTION business_private.claim_person() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE v_user auth.users; v_person public.people; v_candidate uuid; v_count integer;
BEGIN
  SELECT * INTO v_user FROM auth.users WHERE id=(SELECT auth.uid()) FOR SHARE;
  IF v_user.id IS NULL OR v_user.email_confirmed_at IS NULL OR nullif(v_user.email,'') IS NULL THEN
    RETURN jsonb_build_object('error','not_authenticated','message','A verified account is required.');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('claim-person:'||lower(v_user.email),0));
  -- Lock all matching business identities in stable order. FK inserts cannot
  -- race the booking-free check while the current person is locked FOR UPDATE.
  PERFORM 1 FROM public.people WHERE auth_user_id=v_user.id
    OR (auth_user_id IS NULL AND lower(email)=lower(v_user.email)) ORDER BY id FOR UPDATE;
  SELECT * INTO v_person FROM public.people WHERE auth_user_id=v_user.id;
  IF v_person.id IS NULL THEN
    RETURN jsonb_build_object('error','identity_missing','message','The account identity is missing.');
  END IF;
  -- A deliberate association must survive a later sibling registration using
  -- the same family email. It never authorizes another unclaimed person.
  IF EXISTS(SELECT 1 FROM business_private.registration_identity_resolutions
    WHERE auth_user_id=v_user.id AND person_id=v_person.id) THEN
    UPDATE public.people SET email=v_user.email,updated_at=now() WHERE id=v_person.id;
    RETURN jsonb_build_object('id',v_person.id,'unresolved',false);
  END IF;
  SELECT count(*),(array_agg(id ORDER BY id))[1] INTO v_count,v_candidate
    FROM public.people WHERE auth_user_id IS NULL AND lower(email)=lower(v_user.email);
  -- The anonymous candidate MAY have bookings: those are precisely what the
  -- verified learner is claiming. Only their fresh account person must be empty.
  IF v_count=1 AND NOT EXISTS(SELECT 1 FROM public.bookings WHERE person_id=v_person.id)
    AND NOT EXISTS(SELECT 1 FROM public.invoice_cases WHERE person_id=v_person.id) THEN
    UPDATE public.people SET auth_user_id=NULL WHERE id=v_person.id;
    UPDATE public.people SET auth_user_id=v_user.id,email=v_user.email,updated_at=now() WHERE id=v_candidate;
    DELETE FROM public.people WHERE id=v_person.id;
    v_person.id:=v_candidate;
    INSERT INTO business_private.registration_identity_resolutions(auth_user_id,person_id)
      VALUES(v_user.id,v_person.id) ON CONFLICT(auth_user_id) DO UPDATE
      SET person_id=excluded.person_id,resolved_by=NULL,resolved_at=now();
    v_count:=0;
  END IF;
  UPDATE public.people SET email=v_user.email,updated_at=now() WHERE id=v_person.id;
  RETURN jsonb_build_object('id',v_person.id,'unresolved',v_count>0);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error',SQLSTATE,'message','The account association could not be verified.');
END $$;


--
-- Name: confirm_booking(uuid); Type: FUNCTION; Schema: business_private; Owner: -
--

CREATE FUNCTION business_private.confirm_booking(p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare b public.bookings;p public.people;
begin
 if not business_private.is_staff() then raise insufficient_privilege;end if;
 select * into strict b from public.bookings where id=p_id for update;
 if b.status='confirmed' then return;end if;
 if b.status<>'pending' then raise check_violation;end if;
 if not exists(select 1 from public.booking_items where booking_id=b.id) then raise check_violation;end if;
 update public.bookings set status='confirmed',confirmed_at=now(),confirmed_by=auth.uid(),updated_at=now(),revision=revision+1 where id=b.id;
 if b.kind<>'trial' then insert into public.invoice_cases(person_id,target_month,booking_id) values(b.person_id,b.target_month,b.id) on conflict(person_id,target_month) do nothing;end if;
 select * into strict p from public.people where id=b.person_id;
 perform platform_private.require_rpc_success(public.queue_transactional_email('confirmed:'||b.id,case when b.kind='trial' then 'trial_confirmed' else 'registration_confirmed' end,b.contact_email,coalesce((SELECT locale FROM private.mail_outbox WHERE dedupe_key='registration:'||b.id),p.preferred_locale),
 jsonb_build_object('name',b.contact_name,'startDate',b.start_date,'exceptions',business_private.booking_mail_exceptions(b.id),'courses',(select jsonb_agg(jsonb_build_object('title',title_snapshot,'units',units,'unitPrice',unit_price,'unitMinutes',unit_minutes,'price',amount)) from public.booking_items where booking_id=b.id))));
end $$;


--
-- Name: course_quote(uuid, date, integer, boolean); Type: FUNCTION; Schema: business_private; Owner: -
--

CREATE FUNCTION business_private.course_quote(p_course uuid, p_start date, p_requested_units integer, p_trial boolean DEFAULT false) RETURNS TABLE(units numeric, amount numeric)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
 SELECT CASE WHEN p_trial THEN 0 WHEN c.category='private' THEN p_requested_units::numeric ELSE calendar.units END,
 CASE WHEN p_trial THEN 0 WHEN c.category='private' THEN round(p_requested_units*c.unit_price,2) ELSE round(calendar.units*c.unit_price,2) END
 FROM public.courses c CROSS JOIN LATERAL (
  SELECT coalesce(sum(extract(epoch FROM(s.end_time-s.start_time))/60/c.unit_minutes),0) units
  FROM public.course_schedules s
  CROSS JOIN LATERAL generate_series(p_start::timestamp,(date_trunc('month',p_start)+interval '1 month - 1 day')::timestamp,interval '1 day') day
  WHERE s.course_id=c.id AND extract(isodow FROM day)=s.weekday
   AND(c.start_date IS NULL OR day::date>=c.start_date) AND(c.end_date IS NULL OR day::date<=c.end_date)
   AND NOT EXISTS(SELECT 1 FROM public.course_exceptions e WHERE e.date=day::date AND(e.course_id IS NULL OR e.course_id=c.id))
 ) calendar WHERE c.id=p_course;
$$;


--
-- Name: decline_booking(uuid); Type: FUNCTION; Schema: business_private; Owner: -
--

CREATE FUNCTION business_private.decline_booking(p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE b public.bookings; v_locale text;
BEGIN
 IF NOT business_private.is_staff() THEN RAISE insufficient_privilege; END IF;
 SELECT * INTO b FROM public.bookings WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE no_data_found; END IF;
 -- Retrying an acknowledged rejection or encountering a student's pause is a no-op.
 IF b.status='cancelled' THEN RETURN; END IF;
 IF b.status<>'pending' OR EXISTS(
   SELECT 1 FROM public.invoice_cases i WHERE i.booking_id=b.id AND i.status='created'
 ) THEN RAISE EXCEPTION 'Only pending requests without an issued invoice may be declined' USING ERRCODE='PT409'; END IF;
 SELECT preferred_locale INTO v_locale FROM public.people WHERE id=b.person_id;
 UPDATE public.bookings SET status='cancelled',revision=revision+1,updated_at=now() WHERE id=b.id;
 -- A later, deliberately resubmitted request is a new revision and can receive a new reply.
 PERFORM platform_private.require_rpc_success(public.queue_transactional_email('declined:'||b.id||':'||(b.revision+1),
   CASE WHEN b.kind='trial' THEN 'trial_cancelled' ELSE 'booking_cancelled' END,
   b.contact_email,v_locale,jsonb_build_object('name',b.contact_name,'startDate',b.start_date,
     'courses',(SELECT jsonb_agg(jsonb_build_object('title',title_snapshot)) FROM public.booking_items WHERE booking_id=b.id))));
END $$;


--
-- Name: delete_course_exception(uuid); Type: FUNCTION; Schema: business_private; Owner: -
--

CREATE FUNCTION business_private.delete_course_exception(p_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
 IF NOT business_private.is_staff() THEN RETURN jsonb_build_object('error','not_authorized','message','Staff access required.'); END IF;
 DELETE FROM public.course_exceptions WHERE id=p_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found','message','Course exception not found.'); END IF;
 RETURN jsonb_build_object('deleted',true);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error','delete_failed','message','Course exception could not be deleted.');
END $$;


--
-- Name: is_staff(); Type: FUNCTION; Schema: business_private; Owner: -
--

CREATE FUNCTION business_private.is_staff() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
select exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('teacher','admin'));
$$;


--
-- Name: list_registration_identity_conflicts(); Type: FUNCTION; Schema: business_private; Owner: -
--

CREATE FUNCTION business_private.list_registration_identity_conflicts() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE result jsonb;
BEGIN
  IF NOT business_private.is_staff() THEN
    RETURN jsonb_build_object('error','not_authorized','message','Staff access is required.');
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'person_id',p.id,'display_name',p.display_name,'email',p.email,
    'booking_count',(SELECT count(*) FROM public.bookings b WHERE b.person_id=p.id),
    'candidates',(SELECT coalesce(jsonb_agg(jsonb_build_object('auth_user_id',u.id,
      'display_name',account.display_name,'email',u.email,
      'can_assign',NOT EXISTS(SELECT 1 FROM public.bookings b WHERE b.person_id=account.id)
        AND NOT EXISTS(SELECT 1 FROM public.invoice_cases i WHERE i.person_id=account.id)
        AND NOT EXISTS(SELECT 1 FROM business_private.registration_identity_resolutions r WHERE r.auth_user_id=u.id)) ORDER BY u.id),'[]'::jsonb)
      FROM auth.users u JOIN public.people account ON account.auth_user_id=u.id
      WHERE u.email_confirmed_at IS NOT NULL AND lower(u.email)=lower(p.email)))
    ORDER BY lower(p.email),p.created_at,p.id),'[]'::jsonb) INTO result
  FROM public.people p WHERE p.auth_user_id IS NULL AND EXISTS(
    SELECT 1 FROM auth.users u WHERE u.email_confirmed_at IS NOT NULL AND lower(u.email)=lower(p.email));
  RETURN jsonb_build_object('conflicts',result);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error',SQLSTATE,'message','The unresolved registrations could not be loaded.');
END $$;


--
-- Name: mark_invoice(uuid, date, boolean, text); Type: FUNCTION; Schema: business_private; Owner: -
--

CREATE FUNCTION business_private.mark_invoice(p_booking uuid, p_month date, p_created boolean, p_reference text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare b public.bookings;
begin
 if not business_private.is_staff() then raise insufficient_privilege;end if;
 select * into strict b from public.bookings where id=p_booking for update;
 if b.target_month<>p_month or b.kind='trial' or (p_created and b.status<>'confirmed') or length(coalesce(p_reference,''))>120 then raise check_violation;end if;
 insert into public.invoice_cases(person_id,target_month,booking_id) values(b.person_id,b.target_month,b.id) on conflict(person_id,target_month) do nothing;
 update public.invoice_cases set status=(case when p_created then 'created' else 'outstanding' end)::public.invoice_status,invoice_reference=nullif(btrim(p_reference),''),
 invoice_created_at=case when p_created then coalesce(invoice_created_at,now()) else null end,created_by=auth.uid(),updated_at=now() where person_id=b.person_id and target_month=p_month;
end $$;


--
-- Name: notify_course_exception(); Type: FUNCTION; Schema: business_private; Owner: -
--

CREATE FUNCTION business_private.notify_course_exception() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE b record; e record; inserted integer;
BEGIN
 -- Ignore irrelevant or stale events; enqueue atomically inside the RPC boundary.
 IF NOT EXISTS(SELECT 1 FROM public.course_exceptions WHERE id=NEW.id AND date=NEW.date AND course_id IS NOT DISTINCT FROM NEW.course_id) THEN RETURN NULL; END IF;
 IF NEW.date<(now() AT TIME ZONE 'Europe/Berlin')::date THEN RETURN NULL; END IF;
 FOR b IN SELECT x.id,x.contact_name,x.contact_email,
  coalesce((SELECT m.locale FROM private.mail_outbox m WHERE m.dedupe_key='registration:'||x.id),p.preferred_locale) preferred_locale
  FROM public.bookings x JOIN public.people p ON p.id=x.person_id
  WHERE x.status IN ('pending','confirmed') AND x.start_date<=NEW.date
   AND NEW.date<(x.target_month+interval '1 month')::date
 LOOP
  FOR e IN SELECT r.course_id,r.title,r.date,string_agg(DISTINCT r.reason,'; ' ORDER BY r.reason) reason
   FROM business_private.booking_exception_rows(b.id) r
   WHERE r.date=NEW.date AND (NEW.course_id IS NULL OR r.course_id=NEW.course_id)
   GROUP BY r.course_id,r.title,r.date
  LOOP
   INSERT INTO private.mail_exception_deliveries VALUES(b.id,e.course_id,e.date) ON CONFLICT DO NOTHING;
   GET DIAGNOSTICS inserted=ROW_COUNT;
   IF inserted=1 THEN
    PERFORM platform_private.require_rpc_success(public.queue_transactional_email(
     'course-exception:'||b.id||':'||e.course_id||':'||e.date,
     'course_exception_added',b.contact_email,b.preferred_locale,
     jsonb_build_object('name',b.contact_name,'exceptions',jsonb_build_array(jsonb_build_object(
      'courseId',e.course_id,'title',e.title,'date',e.date,'reason',e.reason)))));
   END IF;
  END LOOP;
 END LOOP;
 RETURN NULL;
END $$;


--
-- Name: notify_staff_of_signup(); Type: FUNCTION; Schema: business_private; Owner: -
--

CREATE FUNCTION business_private.notify_staff_of_signup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE v_result jsonb;
BEGIN
 IF nullif(btrim(new.email),'') IS NULL THEN RETURN new; END IF;
 BEGIN
  v_result:=public.queue_transactional_email('staff-signup:'||new.id,'new_signup','info@sitov-academy.com','de',
   business_private.staff_signup_payload(new.email,coalesce(new.raw_user_meta_data,'{}'::jsonb)));
  IF jsonb_typeof(v_result)='object' AND v_result ? 'error' THEN RAISE WARNING 'staff_signup_notification_failed'; END IF;
 EXCEPTION WHEN OTHERS THEN RAISE WARNING 'staff_signup_notification_failed';
 END;
 RETURN new;
END $$;


--
-- Name: notify_student_of_level_access(); Type: FUNCTION; Schema: business_private; Owner: -
--

CREATE FUNCTION business_private.notify_student_of_level_access() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE v_email text; v_name text; v_locale text; v_result jsonb;
BEGIN
 BEGIN
  SELECT CASE WHEN u.email_confirmed_at IS NOT NULL
              THEN coalesce(nullif(btrim(u.email),''),nullif(btrim(pe.email),'')) END,
         left(coalesce(nullif(btrim(pe.display_name),''),''),150),
         CASE WHEN pr.ui_language IN('de','en','ru','uk','tr') THEN pr.ui_language ELSE 'de' END
    INTO v_email,v_name,v_locale
    FROM auth.users u
    LEFT JOIN public.profiles pr ON pr.id=u.id
    LEFT JOIN public.people pe ON pe.auth_user_id=u.id
   WHERE u.id=new.auth_user_id
   LIMIT 1;
  IF v_email IS NULL THEN RETURN new; END IF;
  v_result:=public.queue_transactional_email('level-access:'||new.auth_user_id||':'||new.level,'level_access_granted',v_email,v_locale,
   jsonb_build_object('name',v_name,'level',new.level,'path','/'||v_locale||'/dashboard/level/'||new.level));
  IF jsonb_typeof(v_result)='object' AND v_result ? 'error' THEN RAISE WARNING 'level_access_notification_failed'; END IF;
 EXCEPTION WHEN OTHERS THEN RAISE WARNING 'level_access_notification_failed';
 END;
 RETURN new;
END $$;


--
-- Name: prepare_month(date); Type: FUNCTION; Schema: business_private; Owner: -
--

CREATE FUNCTION business_private.prepare_month(p_month date) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare p public.people;previous public.bookings;v_id uuid;selections jsonb;v_count integer:=0;
begin
 if not business_private.is_staff() then raise insufficient_privilege;end if;
 if p_month is null or extract(day from p_month)<>1 or p_month>(date_trunc('month',now() at time zone 'Europe/Berlin')+interval '1 month')::date then raise check_violation;end if;
 for p in select * from public.people order by id for update loop
  if exists(select 1 from public.bookings where person_id=p.id and target_month=p_month and kind<>'trial') then continue;end if;
  select * into previous from public.bookings where person_id=p.id and target_month<p_month and kind<>'trial' order by target_month desc limit 1;
  if previous.id is null or previous.status<>'confirmed' then continue;end if;
  select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('course_id',i.course_id,'requested_units',case when c.category='private' then i.requested_units end))) into selections from public.booking_items i join public.courses c on c.id=i.course_id where i.booking_id=previous.id and c.archived_at is null
   and (c.start_date is null or c.start_date<(p_month+interval '1 month')::date) and (c.end_date is null or c.end_date>=p_month);
  if selections is null then continue;end if;
  insert into public.bookings(person_id,target_month,start_date,kind,status,contact_name,contact_email,contact_birth_date,contact_phone,contact_street,contact_postal_code,contact_city,privacy_accepted,agb_accepted,revocation_accepted,recording_accepted,confirmed_at,confirmed_by)
  values(p.id,p_month,p_month,'monthly','confirmed',p.display_name,p.email,p.birth_date,p.phone,p.street,p.postal_code,p.city,previous.privacy_accepted,previous.agb_accepted,previous.revocation_accepted,previous.recording_accepted,now(),auth.uid()) returning id into v_id;
  perform business_private.replace_items(v_id,selections);
  insert into public.invoice_cases(person_id,target_month,booking_id) values(p.id,p_month,v_id) on conflict(person_id,target_month) do nothing;
  v_count:=v_count+1;
 end loop;
 return v_count;
end $$;


--
-- Name: provision_profile(); Type: FUNCTION; Schema: business_private; Owner: -
--

CREATE FUNCTION business_private.provision_profile() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE native text; locale text; display_name text;
BEGIN
 native:=CASE WHEN new.raw_user_meta_data->>'native_language' IN('de','en','ru','uk','tr') THEN new.raw_user_meta_data->>'native_language' END;
 locale:=CASE WHEN new.raw_user_meta_data->>'ui_language' IN('de','en','ru','uk','tr') THEN new.raw_user_meta_data->>'ui_language' ELSE coalesce(native,'de') END;
 display_name:=left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'),''),split_part(new.email,'@',1),'Student'),160);
 INSERT INTO public.profiles(id,role,native_language,ui_language) VALUES(new.id,'student',native,locale) ON CONFLICT(id) DO NOTHING;
 -- A signup always receives its own fresh person. No unverified address lookup.
 INSERT INTO public.people(auth_user_id,display_name,email,preferred_locale)
 VALUES(new.id,display_name,coalesce(new.email,''),locale) ON CONFLICT(auth_user_id) DO NOTHING;
 RETURN new;
END $$;


--
-- Name: replace_items(uuid, jsonb); Type: FUNCTION; Schema: business_private; Owner: -
--

CREATE FUNCTION business_private.replace_items(p_booking uuid, p_course_selections jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE b public.bookings;
BEGIN
 SELECT * INTO STRICT b FROM public.bookings WHERE id=p_booking;
 -- Materialize and validate everything before changing any existing items.
 PERFORM * FROM business_private.validate_course_selections(p_course_selections,b.start_date);
 DELETE FROM public.booking_items WHERE booking_id=b.id;
 INSERT INTO public.booking_items(booking_id,course_id,title_snapshot,unit_price,unit_minutes,requested_units,units,amount)
 SELECT b.id,c.id,c.title,c.unit_price,c.unit_minutes,s.requested_units,q.units,q.amount
 FROM business_private.validate_course_selections(p_course_selections,b.start_date) s JOIN public.courses c ON c.id=s.course_id
 CROSS JOIN LATERAL business_private.course_quote(c.id,b.start_date,s.requested_units,b.kind='trial') q;
END $$;


--
-- Name: resolve_registration_identity(uuid, uuid); Type: FUNCTION; Schema: business_private; Owner: -
--

CREATE FUNCTION business_private.resolve_registration_identity(p_person_id uuid, p_auth_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE target_user auth.users; current_person public.people; candidate public.people;
BEGIN
  IF NOT business_private.is_staff() THEN
    RETURN jsonb_build_object('error','not_authorized','message','Staff access is required.');
  END IF;
  IF p_person_id IS NULL OR p_auth_user_id IS NULL THEN
    RETURN jsonb_build_object('error','invalid_input','message','Choose both a registration and a verified account.');
  END IF;
  SELECT * INTO target_user FROM auth.users WHERE id=p_auth_user_id FOR SHARE;
  IF target_user.id IS NULL OR target_user.email_confirmed_at IS NULL OR nullif(target_user.email,'') IS NULL THEN
    RETURN jsonb_build_object('error','invalid_input','message','The selected account has no verified email.');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('claim-person:'||lower(target_user.email),0));
  PERFORM 1 FROM public.people WHERE id=p_person_id OR auth_user_id=p_auth_user_id ORDER BY id FOR UPDATE;
  SELECT * INTO candidate FROM public.people WHERE id=p_person_id;
  SELECT * INTO current_person FROM public.people WHERE auth_user_id=p_auth_user_id;
  IF candidate.id IS NULL OR current_person.id IS NULL THEN
    RETURN jsonb_build_object('error','not_found','message','The selected identity is no longer available.');
  END IF;
  IF candidate.auth_user_id=p_auth_user_id AND EXISTS(
    SELECT 1 FROM business_private.registration_identity_resolutions WHERE auth_user_id=p_auth_user_id AND person_id=p_person_id) THEN
    RETURN jsonb_build_object('person_id',p_person_id,'auth_user_id',p_auth_user_id,'resolved',true);
  END IF;
  IF candidate.auth_user_id IS NOT NULL OR lower(candidate.email) IS DISTINCT FROM lower(target_user.email) THEN
    RETURN jsonb_build_object('error','conflict','message','The registration is already assigned or its email does not match.');
  END IF;
  IF EXISTS(SELECT 1 FROM public.bookings WHERE person_id=current_person.id)
    OR EXISTS(SELECT 1 FROM public.invoice_cases WHERE person_id=current_person.id)
    OR EXISTS(SELECT 1 FROM business_private.registration_identity_resolutions WHERE auth_user_id=p_auth_user_id) THEN
    RETURN jsonb_build_object('error','conflict','message','This account already has a business identity. Existing identities cannot be merged.');
  END IF;
  UPDATE public.people SET auth_user_id=NULL WHERE id=current_person.id;
  UPDATE public.people SET auth_user_id=p_auth_user_id,email=target_user.email,updated_at=now() WHERE id=p_person_id;
  DELETE FROM public.people WHERE id=current_person.id;
  INSERT INTO business_private.registration_identity_resolutions(auth_user_id,person_id,resolved_by)
    VALUES(p_auth_user_id,p_person_id,auth.uid());
  RETURN jsonb_build_object('person_id',p_person_id,'auth_user_id',p_auth_user_id,'resolved',true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error',SQLSTATE,'message','The registration could not be assigned. Please reload and try again.');
END $$;


--
-- Name: save_course(jsonb); Type: FUNCTION; Schema: business_private; Owner: -
--

CREATE FUNCTION business_private.save_course(p_data jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_id uuid;v_schedule jsonb;v_translation jsonb;v_exception jsonb;
begin
 if not business_private.is_staff() then raise insufficient_privilege;end if;
 if jsonb_typeof(p_data) is distinct from 'object' or jsonb_typeof(p_data->'schedules') is distinct from 'array' or jsonb_typeof(p_data->'translations') is distinct from 'array' or jsonb_typeof(p_data->'exceptions') is distinct from 'array' then raise check_violation;end if;
 if p_data->>'category'='private' and ((p_data->'schedules')<>'[]'::jsonb or coalesce((p_data->>'trial_lessons')::boolean,true)) then raise check_violation using message='Private lessons use requested units and have no fixed schedule or trial';end if;
 IF nullif(p_data->>'level','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.course_audiences WHERE code=p_data->>'level') THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='unknown_course_audience'; END IF;
 v_id:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());
 -- Hold the course row while checking its booking references. A scheduled
 -- booking has no requested quantity and cannot become a private renewal.
 perform 1 from public.courses where id=v_id for update;
 if nullif(p_data->>'id','') is not null and not exists(select 1 from public.courses where id=v_id) then raise no_data_found;end if;
 if exists(select 1 from public.courses c where c.id=v_id
   and (c.category='private') is distinct from (p_data->>'category'='private')
   and exists(select 1 from public.booking_items i where i.course_id=c.id)) then
  raise check_violation using message='The pricing model of a booked course cannot be changed';
 end if;
 insert into public.courses(id,slug,title,description,type,category,level,audience_code,unit_price,unit_minutes,start_date,end_date,trial_lessons,sort_order,archived_at)
 values(v_id,p_data->>'slug',p_data->>'title',coalesce(p_data->>'description',''),(p_data->>'type')::public.course_type,(p_data->>'category')::public.course_category,(SELECT code FROM public.learning_levels WHERE code=nullif(p_data->>'level','')),nullif(p_data->>'level',''),(p_data->>'unit_price')::numeric,
 (p_data->>'unit_minutes')::integer,nullif(p_data->>'start_date','')::date,nullif(p_data->>'end_date','')::date,(p_data->>'trial_lessons')::boolean,(p_data->>'sort_order')::integer,
 case when (p_data->>'archived')::boolean then now() else null end)
 on conflict(id) do update set slug=excluded.slug,title=excluded.title,description=excluded.description,type=excluded.type,category=excluded.category,level=excluded.level,audience_code=excluded.audience_code,
 unit_price=excluded.unit_price,unit_minutes=excluded.unit_minutes,start_date=excluded.start_date,end_date=excluded.end_date,trial_lessons=excluded.trial_lessons,
 sort_order=excluded.sort_order,archived_at=excluded.archived_at,updated_at=now();
 delete from public.course_schedules where course_id=v_id;
 for v_schedule in select value from jsonb_array_elements(p_data->'schedules') loop
  insert into public.course_schedules(course_id,weekday,start_time,end_time)
  values(v_id,(v_schedule->>'weekday')::smallint,(v_schedule->>'start_time')::time,(v_schedule->>'end_time')::time);
 end loop;
 delete from public.course_translations where course_id=v_id;
 for v_translation in select value from jsonb_array_elements(p_data->'translations') loop
  insert into public.course_translations(course_id,locale,title,description) values(v_id,v_translation->>'locale',v_translation->>'title',coalesce(v_translation->>'description',''));
 end loop;
 delete from public.course_exceptions where course_id=v_id;
 for v_exception in select value from jsonb_array_elements(p_data->'exceptions') loop
  insert into public.course_exceptions(course_id,date,reason) values(v_id,(v_exception->>'date')::date,v_exception->>'reason');
 end loop;
 return v_id;
end $$;


--
-- Name: save_course_exception(uuid, date, text); Type: FUNCTION; Schema: business_private; Owner: -
--

CREATE FUNCTION business_private.save_course_exception(p_course_id uuid, p_date date, p_reason text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE result_id uuid;
BEGIN
 IF NOT business_private.is_staff() THEN RETURN jsonb_build_object('error','not_authorized','message','Staff access required.'); END IF;
 IF p_course_id IS NULL OR p_date IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 250 THEN RETURN jsonb_build_object('error','invalid_input','message','Course, date and reason are required.'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.courses WHERE id=p_course_id) THEN RETURN jsonb_build_object('error','not_found','message','Course not found.'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('exception:'||p_course_id||':'||p_date,0));
 SELECT id INTO result_id FROM public.course_exceptions WHERE course_id=p_course_id AND date=p_date ORDER BY id LIMIT 1;
 IF result_id IS NULL THEN INSERT INTO public.course_exceptions(course_id,date,reason) VALUES(p_course_id,p_date,btrim(p_reason)) RETURNING id INTO result_id;
 ELSE UPDATE public.course_exceptions SET reason=btrim(p_reason) WHERE id=result_id; END IF;
 RETURN jsonb_build_object('id',result_id);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error','save_failed','message','Course exception could not be saved.');
END $$;


--
-- Name: save_month(date, jsonb, boolean, uuid, integer); Type: FUNCTION; Schema: business_private; Owner: -
--

CREATE FUNCTION business_private.save_month(p_month date, p_course_selections jsonb, p_paused boolean, p_expected uuid, p_revision integer) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare p public.people;b public.bookings;v_next date;
begin
 IF business_private.claim_person() ? 'error' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='identity_verification_failed'; END IF;
 select * into strict p from public.people where auth_user_id=auth.uid() for update;
 v_next:=(date_trunc('month',now() at time zone 'Europe/Berlin')+interval '1 month')::date;
 if p_month is null or p_month<>v_next then raise sqlstate '22008';end if;
 if jsonb_typeof(p_course_selections) is distinct from 'array' or p_paused is null then raise check_violation using message='Courses and pause choice are required';end if;
 if p_paused and p_course_selections<>'[]'::jsonb then raise check_violation using message='A pause must have no selected courses';end if;
 select * into b from public.bookings where person_id=p.id and target_month=p_month and kind<>'trial' for update;
 if b.id is distinct from p_expected or (b.id is not null and b.revision is distinct from p_revision) then raise exception 'Booking revision changed' using errcode='PT409';end if;
 if exists(select 1 from public.invoice_cases where person_id=p.id and target_month=p_month and status='created') then raise check_violation using message='Invoice already created';end if;
 if b.id is null then
  insert into public.bookings(person_id,target_month,start_date,kind,status,contact_name,contact_email,contact_birth_date,contact_phone,contact_street,contact_postal_code,contact_city,privacy_accepted,agb_accepted)
  values(p.id,p_month,p_month,'monthly',(case when p_paused then 'cancelled' else 'pending' end)::public.booking_status,p.display_name,p.email,p.birth_date,p.phone,p.street,p.postal_code,p.city,true,true) returning * into b;
 else
  update public.bookings set status=(case when p_paused then 'cancelled' else 'pending' end)::public.booking_status,updated_at=now(),revision=revision+1 where id=b.id;
 end if;
 if p_paused then delete from public.booking_items where booking_id=b.id;
 else perform business_private.replace_items(b.id,p_course_selections);end if;
 return b.id;
end $$;


--
-- Name: staff_signup_payload(text, jsonb); Type: FUNCTION; Schema: business_private; Owner: -
--

CREATE FUNCTION business_private.staff_signup_payload(p_email text, p_meta jsonb) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
 SELECT jsonb_build_object('path','/de/admin/students','message',concat_ws(E'\n',
  'Name: '||left(coalesce(nullif(btrim(p_meta->>'display_name'),''),nullif(btrim(p_meta->>'name'),''),split_part(p_email,'@',1)),160),
  'E-Mail: '||p_email,
  'Muttersprache: '||left(nullif(btrim(p_meta->>'native_language'),''),40)))
$$;


--
-- Name: submit_cancellation(text, text, uuid, text, date, text); Type: FUNCTION; Schema: business_private; Owner: -
--

CREATE FUNCTION business_private.submit_cancellation(p_name text, p_email text, p_course_id uuid DEFAULT NULL::uuid, p_type text DEFAULT 'asap'::text, p_date date DEFAULT NULL::date, p_locale text DEFAULT 'de'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
DECLARE request_id uuid; course_title text;
BEGIN
 IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 2 AND 160 OR p_email IS NULL
  OR length(btrim(p_email)) NOT BETWEEN 3 AND 254 OR p_email !~ '^[^[:space:]<>@,;]+@[^[:space:]<>@,;]+\.[^[:space:]<>@,;]+$'
  OR p_type IS NULL OR p_type NOT IN ('asap','specific_date') OR (p_type='specific_date' AND p_date IS NULL)
  OR NOT EXISTS(SELECT 1 FROM public.locales WHERE code=p_locale) THEN
  RETURN jsonb_build_object('error','invalid_input','message','Invalid cancellation request.');
 END IF;
 IF p_course_id IS NOT NULL THEN
  SELECT title INTO course_title FROM public.courses WHERE id=p_course_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','course_not_found','message','The selected course does not exist.'); END IF;
 END IF;
 INSERT INTO public.cancellation_requests(full_name,email,course_id,termination_type,termination_date)
 VALUES(btrim(p_name),lower(btrim(p_email)),p_course_id,p_type::public.cancellation_type,CASE WHEN p_type='specific_date' THEN p_date END) RETURNING id INTO request_id;
 PERFORM platform_private.require_rpc_success(public.queue_transactional_email('cancellation:'||request_id,'cancellation_requested',lower(btrim(p_email)),p_locale,
  jsonb_build_object('name',btrim(p_name),'endDate',p_date,'message',coalesce(course_title,''))));
 RETURN jsonb_build_object('id',request_id);
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('error',SQLSTATE,'message','The cancellation request could not be saved.');
END $_$;


--
-- Name: sync_verified_email(); Type: FUNCTION; Schema: business_private; Owner: -
--

CREATE FUNCTION business_private.sync_verified_email() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
 if new.email is distinct from old.email and new.email_confirmed_at is not null then
  update public.people set email=new.email,updated_at=now() where auth_user_id=new.id;
 end if;
 return new;
end $$;


--
-- Name: validate_course_selections(jsonb, date); Type: FUNCTION; Schema: business_private; Owner: -
--

CREATE FUNCTION business_private.validate_course_selections(p_selections jsonb, p_start date) RETURNS TABLE(course_id uuid, requested_units integer)
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
DECLARE item jsonb; seen uuid[]:='{}'; selected public.courses; quantity numeric;
BEGIN
 IF p_start IS NULL OR jsonb_typeof(p_selections) IS DISTINCT FROM 'array' THEN
  RAISE check_violation USING message='Course selections must be an array';
 END IF;
 IF jsonb_array_length(p_selections) NOT BETWEEN 1 AND 100 THEN RAISE check_violation USING message='Choose between 1 and 100 courses'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_selections) LOOP
  IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR jsonb_typeof(item->'course_id') IS DISTINCT FROM 'string'
   OR item-'course_id'-'requested_units'<>'{}'::jsonb THEN
   RAISE check_violation USING message='Invalid course selection fields';
  END IF;
  SELECT * INTO selected FROM public.courses WHERE id=(item->>'course_id')::uuid AND archived_at IS NULL
   AND (end_date IS NULL OR end_date>=p_start)
   AND (start_date IS NULL OR start_date<(date_trunc('month',p_start)+interval '1 month')::date);
  IF selected.id IS NULL OR selected.id=ANY(seen) THEN RAISE check_violation USING message='Unavailable or duplicate course'; END IF;
  seen:=array_append(seen,selected.id);
  requested_units:=NULL;
  IF selected.category='private' THEN
   IF jsonb_typeof(item->'requested_units') IS DISTINCT FROM 'number' THEN RAISE check_violation USING message='Private lessons require a unit quantity'; END IF;
   quantity:=(item->>'requested_units')::numeric;
   IF quantity NOT BETWEEN 1 AND 1000 OR quantity<>trunc(quantity) THEN RAISE check_violation USING message='Unit quantity must be a whole number from 1 to 1000'; END IF;
   requested_units:=quantity::integer;
  ELSIF item ? 'requested_units' THEN
   RAISE check_violation USING message='Scheduled course quantities come from the calendar';
  END IF;
  course_id:=selected.id;
  RETURN NEXT;
 END LOOP;
END $$;


--
-- Name: exercise_is_ready(jsonb, text); Type: FUNCTION; Schema: grammar_private; Owner: -
--

CREATE FUNCTION grammar_private.exercise_is_ready(p_content jsonb, p_topic text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
 SELECT grammar_private.valid_target_form(p_content) AND grammar_private.german_content_allowed(p_content,p_topic)
$$;


--
-- Name: german_content_allowed(jsonb, text); Type: FUNCTION; Schema: grammar_private; Owner: -
--

CREATE FUNCTION grammar_private.german_content_allowed(p_content jsonb, p_topic text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
 SELECT path_private.german_task_allowed(jsonb_build_array(p_topic,
  p_content->'instruction',p_content->'text_before',p_content->'text_after',p_content->'question',
  p_content->'correct_answer',p_content->'gap_hint',p_content->'options',p_content->'accepted_answers',
  p_content->'parts',p_content->'target_form',p_content->'text',p_content->'blanks',p_content->'pairs',
  p_content->'categories',p_content->'items',p_content->'turns',p_content->'transcript',
  p_content->'exercise',p_content->'source'))
$$;


--
-- Name: guard_exercise_quality(); Type: FUNCTION; Schema: grammar_private; Owner: -
--

CREATE FUNCTION grammar_private.guard_exercise_quality() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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
END $$;


--
-- Name: record_attempt(uuid, text, boolean); Type: FUNCTION; Schema: grammar_private; Owner: -
--

CREATE FUNCTION grammar_private.record_attempt(p_exercise_id uuid, p_answer text, p_hint_shown boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=auth.uid(); target public.learning_exercises; correct boolean; grade jsonb;
 accepted jsonb; attempt_count integer; final_score integer; soft boolean;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_answer IS NULL OR length(btrim(p_answer))=0 OR length(p_answer)>1000 THEN
  RAISE EXCEPTION 'invalid_answer' USING ERRCODE='22023'; END IF;
 SELECT * INTO target FROM public.learning_exercises WHERE id=p_exercise_id;
 IF target.node_id IS NOT NULL THEN RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE='22023'; END IF; IF NOT FOUND OR target.type NOT IN('fill_in_blank','multiple_choice') THEN
  RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE='22023'; END IF;
 IF NOT learning_private.unit_allowed(target.unit_id) THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 -- phase3-content-ready-guard-v1
 IF target.content_status<>'ready' THEN RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE='22023'; END IF;
 IF nullif(btrim(target.content->>'correct_answer'),'') IS NULL THEN
  RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE='22023'; END IF;
 IF target.type='multiple_choice' THEN
  -- Options are discrete choices: a wrong option must never become a typo match.
  correct:=p_answer=target.content->>'correct_answer';
  grade:=jsonb_build_object('status',CASE WHEN correct THEN 'EXACT' ELSE 'INCORRECT' END,
   'matched',CASE WHEN correct THEN target.content->>'correct_answer' ELSE NULL END,'reason',NULL,'hint',NULL);
 ELSE
  -- Compatibility fallback for legacy reads; remove only in a follow-up release.
  accepted:=coalesce(target.content->'accepted_answers',target.content->'alternative_answers','[]'::jsonb);
  IF jsonb_typeof(accepted) IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE='22023'; END IF;
  -- A supplied wrong option is deliberate grammar content, never a typo.
  IF jsonb_typeof(target.content->'options')='array' AND EXISTS(
   SELECT 1 FROM jsonb_array_elements_text(target.content->'options') option
   WHERE option=p_answer AND option<>target.content->>'correct_answer'
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(accepted) answer WHERE answer=option)) THEN
   grade:=jsonb_build_object('status','INCORRECT','matched',NULL,'reason',NULL,'hint',NULL);
  ELSE
   grade:=learning_private.grade_answer(p_answer,ARRAY[target.content->>'correct_answer']||ARRAY(SELECT jsonb_array_elements_text(accepted)));
  END IF;
  PERFORM platform_private.require_rpc_success(grade);
  correct:=grade->>'status' IN('EXACT','SOFT_ERROR');
 END IF;
 soft:=grade->>'status'='SOFT_ERROR';
 INSERT INTO public.user_exercise_progress AS progress
  (auth_user_id,exercise_id,attempts,completed,score,hint_shown,updated_at)
 VALUES(actor,p_exercise_id,1,correct,CASE WHEN soft THEN 90 WHEN correct THEN 100 ELSE 0 END,coalesce(p_hint_shown,false),now())
 ON CONFLICT(auth_user_id,exercise_id) DO UPDATE SET
  attempts=progress.attempts+1,completed=coalesce(progress.completed,false) OR correct,
  -- Preserve attempt scoring; each soft submission caps the stored score too,
  -- even following an earlier 100. Incorrect submissions retain the best score.
  score=least(CASE WHEN soft THEN 90 ELSE 100 END,greatest(coalesce(progress.score,0),CASE WHEN correct THEN
   CASE WHEN progress.attempts+1<=1 THEN 100 WHEN progress.attempts+1=2 THEN 80 WHEN progress.attempts+1=3 THEN 60 ELSE 40 END ELSE 0 END)),
  hint_shown=progress.hint_shown OR coalesce(p_hint_shown,false),updated_at=now()
 RETURNING attempts,score INTO attempt_count,final_score;
 RETURN jsonb_build_object('success',true,'attempts',attempt_count,'isCorrect',correct,'score',final_score)||grade;
END $$;


--
-- Name: valid_accepted_answers(jsonb, public.exercise_type); Type: FUNCTION; Schema: grammar_private; Owner: -
--

CREATE FUNCTION grammar_private.valid_accepted_answers(p_content jsonb, p_type public.exercise_type) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
DECLARE answers jsonb:=p_content->'accepted_answers';
BEGIN
 -- A complete typed payload follows the shared Unicode normalization contract.
 -- Unstructured legacy rows retain the predecessor checks below unchanged.
 IF path_private.valid_content(p_type,p_content) THEN RETURN true; END IF;
 IF p_type::text NOT IN ('multiple_choice','fill_in_blank','sentence_building') THEN RETURN path_private.valid_content(p_type,p_content); END IF;
 IF jsonb_typeof(p_content) IS DISTINCT FROM 'object' OR p_content ? 'alternative_answers'
  OR jsonb_typeof(answers) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 IF jsonb_array_length(answers)>21 OR EXISTS(SELECT 1 FROM jsonb_array_elements(answers) a
  WHERE jsonb_typeof(a) IS DISTINCT FROM 'string' OR length(btrim(a#>>'{}')) NOT BETWEEN 1 AND 1000) THEN RETURN false; END IF;
 IF p_type='multiple_choice' AND jsonb_array_length(answers)<>1 THEN RETURN false; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements_text(answers))<>(SELECT count(DISTINCT lower(regexp_replace(btrim(a),'\s+',' ','g')))
  FROM jsonb_array_elements_text(answers) a) THEN RETURN false; END IF;
 RETURN p_type='sentence_building' OR (nullif(btrim(p_content->>'correct_answer'),'') IS NOT NULL AND EXISTS(
  SELECT 1 FROM jsonb_array_elements_text(answers) a WHERE lower(regexp_replace(btrim(a),'\s+',' ','g'))=
   lower(regexp_replace(btrim(p_content->>'correct_answer'),'\s+',' ','g'))));
END $$;


--
-- Name: valid_target_form(jsonb); Type: FUNCTION; Schema: grammar_private; Owner: -
--

CREATE FUNCTION grammar_private.valid_target_form(p_content jsonb) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
DECLARE target jsonb:=p_content->'target_form';
BEGIN
 IF jsonb_typeof(target) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 RETURN jsonb_array_length(target)>0 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(target) item
  WHERE jsonb_typeof(item) IS DISTINCT FROM 'string' OR btrim(item#>>'{}',U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')='');
END $$;


--
-- Name: current_profile_role(); Type: FUNCTION; Schema: identity_private; Owner: -
--

CREATE FUNCTION identity_private.current_profile_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT role::text FROM public.profiles WHERE id=(SELECT auth.uid()) AND (SELECT auth.uid()) IS NOT NULL
$$;


--
-- Name: validate_teacher_note(); Type: FUNCTION; Schema: identity_private; Owner: -
--

CREATE FUNCTION identity_private.validate_teacher_note() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF new.id IS DISTINCT FROM old.id OR new.student_id IS DISTINCT FROM old.student_id OR new.teacher_id IS DISTINCT FROM old.teacher_id OR new.created_at IS DISTINCT FROM old.created_at THEN
   RAISE check_violation USING message='Note identity and authorship are immutable';
  END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=new.student_id AND role='student') OR
     NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=new.teacher_id AND role IN('teacher','admin')) THEN
   RAISE check_violation USING message='Invalid student or teacher';
  END IF;
 END IF;
 new.updated_at:=now();
 RETURN new;
END $$;


--
-- Name: allowed_unit_ids(); Type: FUNCTION; Schema: learning_private; Owner: -
--

CREATE FUNCTION learning_private.allowed_unit_ids() RETURNS uuid[]
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT COALESCE(array_agg(u.id), ARRAY[]::uuid[])
 FROM public.profiles p
 CROSS JOIN public.learning_units u
 LEFT JOIN public.student_level_access l ON l.auth_user_id=p.id AND l.level=u.level
 LEFT JOIN public.learning_trainer_grants a
   ON a.auth_user_id=p.id AND a.level=u.level AND a.trainer=u.trainer
 WHERE p.id=(SELECT auth.uid()) AND CASE WHEN u.owner_auth_user_id IS NULL THEN (p.role IN ('teacher','admin') OR (
   p.ui_language<>'de' AND u.is_active AND l.auth_user_id IS NOT NULL
   AND u.trainer::text IN ('vocabulary','exercises','pronunciation','videos')
   AND COALESCE(a.enabled,true) AND (a.unit_mode IS DISTINCT FROM 'selected' OR EXISTS (
     SELECT 1 FROM public.learning_unit_grants g WHERE g.auth_user_id=p.id
       AND g.level=u.level AND g.trainer=u.trainer AND g.unit_id=u.id))))
  -- Eigene Unit: dieselbe Bedingung wie trainer_access_private.allowed(),
  -- ohne Lektionsauswahl.
  ELSE u.owner_auth_user_id=p.id AND (p.role IN ('teacher','admin') OR (
   p.ui_language<>'de' AND l.auth_user_id IS NOT NULL AND COALESCE(a.enabled,true))) END;
$$;


--
-- Name: answer_without_punctuation(text); Type: FUNCTION; Schema: learning_private; Owner: -
--

CREATE FUNCTION learning_private.answer_without_punctuation(p_value text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    SET search_path TO ''
    AS $_$
 SELECT learning_private.normalize_answer(regexp_replace(learning_private.normalize_answer(p_value),
  $punct$(?<![[:digit:]])[.,]|[.,](?![[:digit:]])|[!?;:'"()\[\]{}…]|(?<![[:digit:]])-(?![[:digit:]])$punct$,'','g'))
$_$;


--
-- Name: audio_readable(text); Type: FUNCTION; Schema: learning_private; Owner: -
--

CREATE FUNCTION learning_private.audio_readable(p_name text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND CASE
 WHEN (SELECT identity_private.current_profile_role()) IN('teacher','admin') THEN true
 WHEN EXISTS(SELECT 1 FROM public.submissions WHERE content_url='storage://pronunciation_audio/'||p_name)
   OR EXISTS(SELECT 1 FROM public.pronunciation_messages WHERE audio_path='storage://pronunciation_audio/'||p_name)
 THEN EXISTS(SELECT 1 FROM public.submissions s WHERE s.content_url='storage://pronunciation_audio/'||p_name AND pronunciation_private.can_access_submission(s.id))
   OR EXISTS(SELECT 1 FROM public.pronunciation_messages m WHERE m.audio_path='storage://pronunciation_audio/'||p_name AND pronunciation_private.can_access_submission(m.submission_id))
 ELSE split_part(p_name,'/',1)=(SELECT auth.uid())::text AND trainer_access_private.can_record() END;
$$;


--
-- Name: capture_learning_session(); Type: FUNCTION; Schema: learning_private; Owner: -
--

CREATE FUNCTION learning_private.capture_learning_session() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE learner uuid; learning_level text; target_level text; learning_mode public.learning_session_mode; happened timestamptz:=clock_timestamp();
BEGIN
 IF TG_TABLE_NAME='vocabulary_direction_progress' THEN
  target_level:=nullif(current_setting('learning.session_target_level',true),'');
  PERFORM set_config('learning.session_target_level','',true);
  IF NEW.last_answered_at IS NULL OR (TG_OP='UPDATE' AND NEW.last_answered_at IS NOT DISTINCT FROM OLD.last_answered_at) THEN RETURN NULL; END IF;
  learner:=NEW.auth_user_id; learning_mode:='vocabulary'; happened:=NEW.last_answered_at;
  SELECT u.level INTO learning_level FROM public.learning_vocabulary_cards c JOIN public.learning_units u ON u.id=c.unit_id WHERE c.id=NEW.card_id;
  learning_level:=coalesce(target_level,learning_level);
 ELSIF TG_TABLE_NAME='user_exercise_progress' THEN
  IF coalesce(NEW.attempts,0)=0 OR (TG_OP='UPDATE' AND NEW.attempts<=OLD.attempts) THEN RETURN NULL; END IF;
  learner:=NEW.auth_user_id; learning_mode:='path';
  SELECT u.level INTO learning_level FROM public.learning_exercises e JOIN public.learning_units u ON u.id=e.unit_id WHERE e.id=NEW.exercise_id;
 ELSIF TG_TABLE_SCHEMA='path_private' AND TG_TABLE_NAME='answer_receipts' THEN
  SELECT r.auth_user_id,u.level INTO learner,learning_level FROM public.path_practice_runs r
   JOIN public.path_nodes n ON n.id=r.node_id JOIN public.learning_units u ON u.id=n.unit_id WHERE r.id=NEW.run_id;
  learning_mode:='path';
 ELSIF TG_TABLE_NAME='path_test_answers' THEN
  SELECT a.auth_user_id,u.level INTO learner,learning_level FROM public.path_test_attempts a
   JOIN public.path_nodes n ON n.id=a.node_id JOIN public.learning_units u ON u.id=n.unit_id WHERE a.id=NEW.attempt_id;
  learning_mode:='path'; happened:=NEW.answered_at;
 ELSIF TG_TABLE_NAME='submissions' THEN
  learner:=NEW.auth_user_id; learning_level:=NEW.level; learning_mode:='pronunciation'; happened:=NEW.created_at;
 ELSIF TG_TABLE_NAME='pronunciation_messages' THEN
  -- Follow-up learner recordings are learning; messages from teachers and
  -- conversational text are not. The first recording lives on submissions.
  IF NEW.sender_role<>'student' OR NEW.audio_path IS NULL THEN RETURN NULL; END IF;
  SELECT s.auth_user_id,s.level INTO learner,learning_level FROM public.submissions s WHERE s.id=NEW.submission_id AND s.auth_user_id=NEW.sender_id;
  learning_mode:='pronunciation'; happened:=NEW.created_at;
 ELSE RETURN NULL;
 END IF;
 PERFORM learning_private.record_learning_event(learner,learning_mode,learning_level,happened);
 RETURN NULL;
END $$;


--
-- Name: ensure_unit(uuid, text, text, text, boolean, integer); Type: FUNCTION; Schema: learning_private; Owner: -
--

CREATE FUNCTION learning_private.ensure_unit(p_id uuid, p_level text, p_trainer text, p_label text, p_active boolean DEFAULT true, p_sort integer DEFAULT 100) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$ DECLARE result uuid; BEGIN
 IF p_id IS NOT NULL THEN
  DELETE FROM public.learning_unit_grants WHERE unit_id=p_id AND level<>p_level;
  UPDATE public.learning_units SET level=p_level,label=p_label,is_active=p_active,sort_order=p_sort
  WHERE id=p_id AND trainer::text=p_trainer AND owner_auth_user_id IS NULL RETURNING id INTO result;
  IF result IS NULL THEN INSERT INTO public.learning_units(id,level,trainer,label,is_active,sort_order)
   VALUES(p_id,p_level,p_trainer::public.trainer_code,p_label,p_active,p_sort) RETURNING id INTO result; END IF;
 ELSE
  PERFORM pg_advisory_xact_lock(hashtextextended('learning-unit:'||p_level||':'||p_trainer||':'||p_label,0));
  IF p_trainer IN('vocabulary','exercises') THEN
   SELECT id INTO result FROM public.learning_units WHERE level=p_level AND trainer::text=p_trainer AND label=p_label AND owner_auth_user_id IS NULL;
  END IF;
  IF result IS NULL THEN INSERT INTO public.learning_units(level,trainer,label,is_active,sort_order)
   VALUES(p_level,p_trainer::public.trainer_code,p_label,p_active,p_sort) RETURNING id INTO result; END IF;
 END IF;
 IF result IS NULL THEN RAISE EXCEPTION 'Unit unavailable' USING ERRCODE='23514'; END IF;
 RETURN result;
END $$;


--
-- Name: expand_german_letters(text); Type: FUNCTION; Schema: learning_private; Owner: -
--

CREATE FUNCTION learning_private.expand_german_letters(p_value text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    SET search_path TO ''
    AS $$
 SELECT replace(replace(replace(replace(replace(replace(replace(replace(
  p_value,'ä','ae'),'ö','oe'),'ü','ue'),'ß','ss'),'Ä','Ae'),'Ö','Oe'),'Ü','Ue'),'ẞ','SS')
$$;


--
-- Name: german_text_allowed(text); Type: FUNCTION; Schema: learning_private; Owner: -
--

CREATE FUNCTION learning_private.german_text_allowed(p_text text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
 -- NFC closes decomposed forms such as s + combining cedilla. Cyrillic blocks
 -- include supplements, combining/extended forms and Extended-D above the BMP.
 SELECT normalize(coalesce(p_text,''),NFC) !~ U&'[\0400-\052F\1C80-\1C8F\1D2B\1D78\2DE0-\2DFF\A640-\A69F\+01E030-\+01E08F\0131\011F\015F\0130\011E\015E]'
$$;


--
-- Name: grade_answer(text, text[]); Type: FUNCTION; Schema: learning_private; Owner: -
--

CREATE FUNCTION learning_private.grade_answer(p_input text, p_accepted text[]) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER
    SET search_path TO ''
    AS $_$
DECLARE input_value text; input_plain text; candidate text; candidate_plain text; original text;
 hint learning_private.answer_hint; reason learning_private.soft_error_reason;
 input_words text[]; accepted_words text[]; distance integer; word_index integer;
BEGIN
 IF p_input IS NULL OR length(p_input)>4000 OR learning_private.normalize_answer(p_input)='' THEN
  RETURN jsonb_build_object('error','invalid_answer','message','Enter an answer of at most 4000 characters.','sqlstate','22023');
 END IF;
 IF p_accepted IS NULL OR coalesce(array_ndims(p_accepted),0)<>1 OR cardinality(p_accepted) NOT BETWEEN 1 AND 128
  OR EXISTS(SELECT 1 FROM unnest(p_accepted) a WHERE a IS NULL OR length(a)>4000 OR learning_private.normalize_answer(a)='') THEN
  RETURN jsonb_build_object('error','invalid_accepted_answers','message','The accepted answers are missing or invalid.','sqlstate','22023');
 END IF;
 input_value:=learning_private.normalize_answer(p_input);
 input_plain:=learning_private.answer_without_punctuation(input_value);
 -- Literal/typographic equality across all answers outranks every other match.
 FOREACH original IN ARRAY p_accepted LOOP
  IF input_value=learning_private.normalize_answer(original) THEN
   RETURN jsonb_build_object('status','EXACT','matched',original,'reason',NULL,'hint',NULL);
  END IF;
 END LOOP;
 -- Case and punctuation carry a neutral writing hint, never a penalty.
 FOREACH original IN ARRAY p_accepted LOOP
  candidate:=learning_private.normalize_answer(original);
  candidate_plain:=learning_private.answer_without_punctuation(candidate);
  IF lower(input_plain)=lower(candidate_plain) THEN
   hint:=CASE WHEN lower(input_value)=lower(candidate) THEN 'capitalization'
    WHEN input_plain=candidate_plain THEN 'punctuation' ELSE 'capitalization_punctuation' END;
   RETURN jsonb_build_object('status','EXACT','matched',original,'reason',NULL,'hint',hint);
  END IF;
 END LOOP;
 -- Ignore case/punctuation before checking remaining errors. Umlaut outranks
 -- typo across the entire answer list; we never equate word order or content.
 FOREACH reason IN ARRAY ARRAY['umlaut','typo']::learning_private.soft_error_reason[] LOOP
  FOREACH original IN ARRAY p_accepted LOOP
   candidate_plain:=lower(learning_private.answer_without_punctuation(original));
   IF reason='umlaut' THEN
    IF learning_private.expand_german_letters(lower(input_plain))=learning_private.expand_german_letters(candidate_plain) THEN
     RETURN jsonb_build_object('status','SOFT_ERROR','matched',original,'reason',reason,'hint',NULL);
    END IF;
   ELSE
    -- Content symbols (currency, %, +) and numeral separators must agree too.
    IF regexp_split_to_array(lower(input_plain),'[[:alnum:]ÄÖÜäöüßẞ]+') IS DISTINCT FROM
       regexp_split_to_array(candidate_plain,'[[:alnum:]ÄÖÜäöüßẞ]+') THEN CONTINUE; END IF;
    input_words:=regexp_split_to_array(lower(input_plain),'[^[:alnum:]ÄÖÜäöüßẞ]+');
    accepted_words:=regexp_split_to_array(candidate_plain,'[^[:alnum:]ÄÖÜäöüßẞ]+');
    IF cardinality(input_words)<>cardinality(accepted_words) THEN CONTINUE; END IF;
    distance:=0;
    FOR word_index IN 1..cardinality(input_words) LOOP
     IF input_words[word_index]=accepted_words[word_index] THEN CONTINUE; END IF;
     -- Numbers/codes may be the learning objective: changed numeric-bearing
     -- tokens require an authored accepted answer, never global typo tolerance.
     IF input_words[word_index] !~ '^[[:alpha:]ÄÖÜäöüßẞ]+$'
      OR accepted_words[word_index] !~ '^[[:alpha:]ÄÖÜäöüßẞ]+$' THEN distance:=2; EXIT; END IF;
     -- Articles/pronouns/prepositions remain exact: der/den, ihm/ihn, am/an.
     IF least(char_length(input_words[word_index]),char_length(accepted_words[word_index]))<4 THEN distance:=2; EXIT; END IF;
     distance:=distance+learning_private.levenshtein_at_most_one(input_words[word_index],accepted_words[word_index]);
     IF distance>1 THEN EXIT; END IF;
    END LOOP;
    IF distance=1 THEN
     RETURN jsonb_build_object('status','SOFT_ERROR','matched',original,'reason',reason,'hint',NULL);
    END IF;
   END IF;
  END LOOP;
 END LOOP;
 RETURN jsonb_build_object('status','INCORRECT','matched',NULL,'reason',NULL,'hint',NULL);
END $_$;


--
-- Name: guard_reading_quality(); Type: FUNCTION; Schema: learning_private; Owner: -
--

CREATE FUNCTION learning_private.guard_reading_quality() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.sentence_de IS DISTINCT FROM OLD.sentence_de OR NEW.focus IS DISTINCT FROM OLD.focus THEN
  IF NOT learning_private.german_text_allowed(NEW.sentence_de) OR NOT learning_private.german_text_allowed(NEW.focus) THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='german_text_required',
    DETAIL='{"error":"german_text_required","message":"German reading fields cannot contain Cyrillic or Turkish-specific letters."}';
  END IF;
 END IF;
 RETURN NEW;
END $$;


--
-- Name: levenshtein_at_most_one(text, text); Type: FUNCTION; Schema: learning_private; Owner: -
--

CREATE FUNCTION learning_private.levenshtein_at_most_one(p_left text, p_right text) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE STRICT
    SET search_path TO ''
    AS $$
DECLARE left_chars text[]; right_chars text[]; left_length integer:=char_length(p_left);
 right_length integer:=char_length(p_right); i integer:=1; j integer:=1; distance integer:=0;
BEGIN
 IF p_left=p_right THEN RETURN 0; END IF;
 IF abs(left_length-right_length)>1 THEN RETURN 2; END IF;
 left_chars:=regexp_split_to_array(p_left,''); right_chars:=regexp_split_to_array(p_right,'');
 WHILE i<=left_length AND j<=right_length LOOP
  IF left_chars[i]=right_chars[j] THEN i:=i+1; j:=j+1;
  ELSE
   distance:=distance+1; IF distance>1 THEN RETURN 2; END IF;
   IF left_length>=right_length THEN i:=i+1; END IF;
   IF right_length>=left_length THEN j:=j+1; END IF;
  END IF;
 END LOOP;
 RETURN least(2,distance+(left_length-i+1)+(right_length-j+1));
END $$;


--
-- Name: lock_activity_day(); Type: FUNCTION; Schema: learning_private; Owner: -
--

CREATE FUNCTION learning_private.lock_activity_day() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-session:'||NEW.auth_user_id::text,0));
 RETURN NEW;
END $$;


--
-- Name: normalize_answer(text); Type: FUNCTION; Schema: learning_private; Owner: -
--

CREATE FUNCTION learning_private.normalize_answer(p_value text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    SET search_path TO ''
    AS $$
 SELECT btrim(regexp_replace(translate(translate(translate(normalize(p_value,NFC),
  '’‘ʼ＇',repeat(chr(39),4)), '„“”«»＂','""""""'), '‐‑‒–—−﹘－','--------'), '[[:space:]  ]+',' ','g'))
$$;


--
-- Name: prune_learning_sessions(); Type: FUNCTION; Schema: learning_private; Owner: -
--

CREATE FUNCTION learning_private.prune_learning_sessions() RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
 DELETE FROM public.learning_sessions WHERE ended_at<statement_timestamp()-interval '180 days'
$$;


--
-- Name: record_activity_day(); Type: FUNCTION; Schema: learning_private; Owner: -
--

CREATE FUNCTION learning_private.record_activity_day() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
 learner uuid;
 happened timestamptz;
BEGIN
 IF TG_TABLE_NAME='vocabulary_direction_progress' THEN
  IF NEW.last_answered_at IS NULL
   OR (TG_OP='UPDATE' AND NEW.last_answered_at IS NOT DISTINCT FROM OLD.last_answered_at) THEN RETURN NULL; END IF;
  learner:=NEW.auth_user_id; happened:=NEW.last_answered_at;
 ELSIF TG_TABLE_NAME='user_exercise_progress' THEN
  IF coalesce(NEW.attempts,0)=0 AND NOT coalesce(NEW.completed,false) THEN RETURN NULL; END IF;
  IF TG_OP='UPDATE' AND NEW.attempts IS NOT DISTINCT FROM OLD.attempts
   AND NEW.completed IS NOT DISTINCT FROM OLD.completed THEN RETURN NULL; END IF;
  learner:=NEW.auth_user_id; happened:=now();
 ELSIF TG_TABLE_NAME='submissions' THEN
  learner:=NEW.auth_user_id; happened:=coalesce(NEW.created_at,now());
 ELSE
  RETURN NULL;
 END IF;
 INSERT INTO public.learning_activity_days(auth_user_id,day)
 VALUES(learner,(happened AT TIME ZONE 'Europe/Berlin')::date)
 ON CONFLICT DO NOTHING;
 RETURN NULL;
END $$;


--
-- Name: record_learning_event(uuid, public.learning_session_mode, text, timestamp with time zone); Type: FUNCTION; Schema: learning_private; Owner: -
--

CREATE FUNCTION learning_private.record_learning_event(p_user uuid, p_mode public.learning_session_mode, p_level text, p_at timestamp with time zone) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE previous public.learning_sessions; starts timestamptz; ends timestamptz;
 day_start timestamptz; day_end timestamptz; seconds integer; added_seconds integer:=0; current_day date;
BEGIN
 IF p_user IS NULL OR p_level IS NULL OR p_at IS NULL THEN RETURN; END IF;
 -- Serialize all modes of one person, including concurrent tabs. This prevents
 -- overlapping sessions and lost increments without locking other learners.
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-session:'||p_user::text,0));
 PERFORM learning_private.prune_learning_sessions();
 SELECT * INTO previous FROM public.learning_sessions WHERE auth_user_id=p_user AND is_active
  ORDER BY ended_at DESC,id DESC LIMIT 1 FOR UPDATE;
 ends:=p_at;
 IF FOUND AND previous.mode=p_mode AND previous.level=p_level AND p_at>=previous.ended_at
  AND p_at-previous.ended_at<=interval '5 minutes' THEN
  starts:=previous.ended_at;
 ELSE
  starts:=p_at;
 END IF;

 -- Split elapsed seconds at local midnight, including 23/25-hour DST days.
 -- Round endpoints, not each gap, so rapid answers cannot lose fractions on
 -- every event. Only one daily row gets the answer count, on its actual day.
 current_day:=(starts AT TIME ZONE 'Europe/Berlin')::date;
 LOOP
  day_start:=current_day::timestamp AT TIME ZONE 'Europe/Berlin';
  day_end:=(current_day+1)::timestamp AT TIME ZONE 'Europe/Berlin';
  seconds:=greatest(0,floor(extract(epoch FROM least(ends,day_end)))::bigint
   -floor(extract(epoch FROM greatest(starts,day_start)))::bigint)::integer;
  added_seconds:=added_seconds+seconds;
  INSERT INTO public.learning_activity_days(auth_user_id,day,study_seconds,answer_count,mode_seconds,last_activity_at)
  VALUES(p_user,current_day,seconds,CASE WHEN current_day=(p_at AT TIME ZONE 'Europe/Berlin')::date THEN 1 ELSE 0 END,
   jsonb_build_object(p_mode::text,seconds),least(p_at,day_end))
  ON CONFLICT(auth_user_id,day) DO UPDATE SET
   study_seconds=public.learning_activity_days.study_seconds+excluded.study_seconds,
   answer_count=public.learning_activity_days.answer_count+excluded.answer_count,
   mode_seconds=jsonb_set(public.learning_activity_days.mode_seconds,ARRAY[p_mode::text],
    to_jsonb(coalesce((public.learning_activity_days.mode_seconds->>p_mode::text)::integer,0)+seconds),true),
   last_activity_at=greatest(public.learning_activity_days.last_activity_at,excluded.last_activity_at);
  EXIT WHEN current_day=(p_at AT TIME ZONE 'Europe/Berlin')::date;
  current_day:=current_day+1;
 END LOOP;

 IF previous.id IS NOT NULL AND starts=previous.ended_at AND previous.mode=p_mode AND previous.level=p_level
  AND p_at>=previous.ended_at AND p_at-previous.ended_at<=interval '5 minutes' THEN
  UPDATE public.learning_sessions SET ended_at=p_at,answer_count=answer_count+1,study_seconds=study_seconds+added_seconds WHERE id=previous.id;
 ELSE
  INSERT INTO public.learning_sessions(auth_user_id,mode,level,started_at,ended_at) VALUES(p_user,p_mode,p_level,p_at,p_at);
 END IF;
END $$;


--
-- Name: reset_student_level(uuid, text); Type: FUNCTION; Schema: learning_private; Owner: -
--

CREATE FUNCTION learning_private.reset_student_level(p_student_id uuid, p_level text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$ BEGIN
 IF auth.uid() IS NULL OR coalesce(identity_private.current_profile_role(),'') NOT IN('teacher','admin') THEN RAISE EXCEPTION 'Staff required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.learning_levels WHERE code=p_level) OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_student_id) THEN RAISE EXCEPTION 'Invalid learner/level' USING ERRCODE='23514'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||p_student_id::text,0));
 DELETE FROM public.vocabulary_direction_progress p USING public.learning_vocabulary_cards c,public.learning_units u WHERE u.id=c.unit_id AND p.card_id=c.id AND p.auth_user_id=p_student_id AND u.level=p_level;
 PERFORM path_private.reset_progress(p_student_id,u.id) FROM public.learning_units u WHERE u.level=p_level AND u.is_path; DELETE FROM public.vocabulary_carryover_preferences WHERE auth_user_id=p_student_id AND target_level=p_level; DELETE FROM public.user_exercise_progress p USING public.learning_exercises e,public.learning_units u WHERE u.id=e.unit_id AND p.exercise_id=e.id AND p.auth_user_id=p_student_id AND u.level=p_level;
 DELETE FROM public.vocabulary_onboarding WHERE auth_user_id=p_student_id AND level=p_level;
 UPDATE public.vocabulary_learning_state SET last_card_id=NULL WHERE auth_user_id=p_student_id AND last_card_id IN(SELECT c.id FROM public.learning_vocabulary_cards c JOIN public.learning_units u ON u.id=c.unit_id WHERE u.level=p_level);
END $$;


--
-- Name: unit_allowed(uuid); Type: FUNCTION; Schema: learning_private; Owner: -
--

CREATE FUNCTION learning_private.unit_allowed(p_unit_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT EXISTS(SELECT 1 FROM public.learning_units u WHERE u.id=p_unit_id AND CASE
  WHEN u.owner_auth_user_id IS NULL THEN trainer_access_private.unit_allowed(u.level,u.trainer::text,u.id::text)
  ELSE u.owner_auth_user_id=(SELECT auth.uid()) AND trainer_access_private.allowed(u.level,u.trainer::text) END);
$$;


--
-- Name: validate_content_unit(); Type: FUNCTION; Schema: learning_private; Owner: -
--

CREATE FUNCTION learning_private.validate_content_unit() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
 IF NEW.unit_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.learning_units WHERE id=NEW.unit_id AND trainer::text=TG_ARGV[0]) THEN
  RAISE EXCEPTION 'Content unit has the wrong trainer' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;


--
-- Name: validate_onboarding_unit(); Type: FUNCTION; Schema: learning_private; Owner: -
--

CREATE FUNCTION learning_private.validate_onboarding_unit() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.learning_units WHERE id=NEW.started_unit_id AND level=NEW.level AND trainer='vocabulary') THEN
 RAISE EXCEPTION 'Invalid onboarding unit' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;


--
-- Name: validate_video_publication(); Type: FUNCTION; Schema: learning_private; Owner: -
--

CREATE FUNCTION learning_private.validate_video_publication() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.learning_videos v JOIN public.learning_units u ON u.id=v.unit_id
  WHERE v.source_url IS NULL AND v.storage_path IS NULL AND u.is_active
  AND ((TG_TABLE_NAME='learning_videos' AND v.id=NEW.id) OR (TG_TABLE_NAME='learning_units' AND u.id=NEW.id))) THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='missing_video_source',DETAIL='{"error":"missing_video_source","message":"Published videos need a URL or uploaded file."}';
 END IF;
 RETURN NULL;
END $$;


--
-- Name: assert_writable(uuid); Type: FUNCTION; Schema: learning_reset_private; Owner: -
--

CREATE FUNCTION learning_reset_private.assert_writable(p_user uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE was_active boolean;
BEGIN
 IF p_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 SELECT active INTO was_active FROM learning_reset_private.jobs WHERE auth_user_id=p_user;
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:' || p_user::text,0));
 IF coalesce(was_active,false) OR EXISTS(SELECT 1 FROM learning_reset_private.jobs WHERE auth_user_id=p_user AND
   (active OR completed_at > transaction_timestamp())) THEN
  RAISE EXCEPTION 'learning_reset_in_progress' USING ERRCODE='55000';
 END IF;
END;
$$;


--
-- Name: audio_batch(uuid); Type: FUNCTION; Schema: learning_reset_private; Owner: -
--

CREATE FUNCTION learning_reset_private.audio_batch(p_token uuid) RETURNS TABLE(bucket_id text, object_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=(SELECT auth.uid());
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM learning_reset_private.jobs WHERE auth_user_id=actor AND token=p_token) THEN
  RAISE EXCEPTION 'reset_owner_required' USING ERRCODE='42501';
 END IF;
 RETURN QUERY SELECT a.bucket_id,a.object_name FROM learning_reset_private.audio_objects a
 JOIN storage.objects o ON o.id=a.object_id AND o.bucket_id=a.bucket_id AND o.name=a.object_name
 JOIN learning_reset_private.jobs j ON j.auth_user_id=a.auth_user_id
 WHERE a.auth_user_id=actor AND j.active ORDER BY a.bucket_id,a.object_name LIMIT 500;
END;
$$;


--
-- Name: begin_reset(text); Type: FUNCTION; Schema: learning_reset_private; Owner: -
--

CREATE FUNCTION learning_reset_private.begin_reset(p_confirmation text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=(SELECT auth.uid()); job learning_reset_private.jobs;
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor) THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_confirmation IS DISTINCT FROM 'RESET_LEARNING_DATA' THEN RAISE EXCEPTION 'confirmation_required' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:'||actor::text,0));
 SELECT * INTO job FROM learning_reset_private.jobs WHERE auth_user_id=actor FOR UPDATE;
 IF FOUND AND job.active THEN RETURN job.token; END IF;
 INSERT INTO learning_reset_private.jobs(auth_user_id) VALUES(actor)
 ON CONFLICT(auth_user_id) DO UPDATE SET token=gen_random_uuid(),active=true,requested_at=clock_timestamp(),completed_at=NULL RETURNING * INTO job;
 DELETE FROM learning_reset_private.audio_objects WHERE auth_user_id=actor;
 INSERT INTO learning_reset_private.audio_objects(auth_user_id,object_id,bucket_id,object_name)
 SELECT actor,o.id,o.bucket_id,o.name FROM storage.objects o WHERE o.bucket_id='pronunciation_audio' AND (
   o.owner_id=actor::text OR(o.owner_id IS NULL AND split_part(o.name,'/',1)=actor::text)
   OR EXISTS(SELECT 1 FROM public.pronunciation_messages m JOIN public.submissions s ON s.id=m.submission_id WHERE s.auth_user_id=actor
    AND (o.owner_id=m.sender_id::text OR(o.owner_id IS NULL AND split_part(o.name,'/',1)=m.sender_id::text))
    AND learning_reset_private.matches_audio(m.audio_path,o.bucket_id,o.name)))
 AND NOT EXISTS(SELECT 1 FROM public.submissions s WHERE s.auth_user_id<>actor AND learning_reset_private.matches_audio(s.content_url,o.bucket_id,o.name))
 AND NOT EXISTS(SELECT 1 FROM public.pronunciation_messages m JOIN public.submissions s ON s.id=m.submission_id WHERE s.auth_user_id<>actor AND learning_reset_private.matches_audio(m.audio_path,o.bucket_id,o.name));
 RETURN job.token;
END $$;


--
-- Name: can_remove_audio(uuid); Type: FUNCTION; Schema: learning_reset_private; Owner: -
--

CREATE FUNCTION learning_reset_private.can_remove_audio(p_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS(
 SELECT 1 FROM learning_reset_private.audio_objects a JOIN learning_reset_private.jobs j USING(auth_user_id)
 WHERE a.auth_user_id=(SELECT auth.uid()) AND a.object_id=p_id AND j.active);
$$;


--
-- Name: finish_reset(uuid); Type: FUNCTION; Schema: learning_reset_private; Owner: -
--

CREATE FUNCTION learning_reset_private.finish_reset(p_token uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=(SELECT auth.uid()); job learning_reset_private.jobs;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:'||actor::text,0));
 SELECT * INTO job FROM learning_reset_private.jobs WHERE auth_user_id=actor AND token=p_token FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'reset_owner_required' USING ERRCODE='42501'; END IF;
 IF NOT job.active THEN RETURN true; END IF;
 IF EXISTS(SELECT 1 FROM learning_reset_private.audio_objects a JOIN storage.objects o ON o.id=a.object_id WHERE a.auth_user_id=actor) THEN
  RAISE EXCEPTION 'audio_removal_incomplete' USING ERRCODE='55000'; END IF;
 DELETE FROM public.pronunciation_messages WHERE submission_id IN(SELECT id FROM public.submissions WHERE auth_user_id=actor);
 DELETE FROM public.submissions WHERE auth_user_id=actor;
 DELETE FROM vocabulary_private.answer_receipts WHERE auth_user_id=actor;
 DELETE FROM public.vocabulary_direction_progress WHERE auth_user_id=actor;
 DELETE FROM public.vocabulary_learning_state WHERE auth_user_id=actor;
 DELETE FROM public.vocabulary_onboarding WHERE auth_user_id=actor;
 PERFORM path_private.reset_progress(actor); DELETE FROM public.vocabulary_carryover_preferences WHERE auth_user_id=actor; DELETE FROM public.user_exercise_progress WHERE auth_user_id=actor;
 DELETE FROM learning_reset_private.audio_objects WHERE auth_user_id=actor;
 UPDATE learning_reset_private.jobs SET active=false,completed_at=clock_timestamp() WHERE auth_user_id=actor;
 RETURN true;
END $$;


--
-- Name: guard_write(); Type: FUNCTION; Schema: learning_reset_private; Owner: -
--

CREATE FUNCTION learning_reset_private.guard_write() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE learner uuid; reference text;
BEGIN
 IF TG_TABLE_NAME IN('submissions','pronunciation_messages') THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
  reference:=CASE WHEN TG_TABLE_NAME='submissions' THEN to_jsonb(NEW)->>'content_url' ELSE to_jsonb(NEW)->>'audio_path' END;
  IF EXISTS(SELECT 1 FROM learning_reset_private.audio_objects a JOIN learning_reset_private.jobs j USING(auth_user_id)
   WHERE j.active AND learning_reset_private.matches_audio(reference,a.bucket_id,a.object_name)) THEN
   RAISE EXCEPTION 'learning_reset_in_progress' USING ERRCODE='55000'; END IF;
 END IF;
 IF TG_TABLE_NAME='pronunciation_messages' THEN SELECT auth_user_id INTO learner FROM public.submissions WHERE id=NEW.submission_id;
 ELSE learner:=NEW.auth_user_id; END IF;
 IF learner IS NOT NULL THEN PERFORM learning_reset_private.assert_writable(learner); END IF;
 RETURN NEW;
END $$;


--
-- Name: matches_audio(text, text, text); Type: FUNCTION; Schema: learning_reset_private; Owner: -
--

CREATE FUNCTION learning_reset_private.matches_audio(p_reference text, p_bucket text, p_name text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
 SELECT coalesce(p_reference='storage://' || p_bucket || '/' || p_name,false);
$$;


--
-- Name: storage_writable(text, uuid); Type: FUNCTION; Schema: learning_reset_private; Owner: -
--

CREATE FUNCTION learning_reset_private.storage_writable(p_bucket text, p_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
 IF p_bucket<>'pronunciation_audio' THEN RETURN true; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 IF EXISTS(SELECT 1 FROM learning_reset_private.audio_objects a JOIN learning_reset_private.jobs j USING(auth_user_id)
  WHERE a.object_id=p_id AND j.active) THEN RAISE EXCEPTION 'learning_reset_in_progress' USING ERRCODE='55000'; END IF;
 PERFORM learning_reset_private.assert_writable((SELECT auth.uid()));
 RETURN true;
END $$;


--
-- Name: enforce_storage_quota(); Type: FUNCTION; Schema: media_private; Owner: -
--

CREATE FUNCTION media_private.enforce_storage_quota() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE level_code text; total bigint; incoming bigint;
BEGIN
 IF NEW.bucket_id<>'course-assets' THEN RETURN NEW; END IF;
 level_code:=split_part(NEW.name,'/',1);
 IF NOT EXISTS(SELECT 1 FROM public.learning_levels WHERE code=level_code) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='invalid_media_level'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('media-quota:'||level_code,0));
 incoming:=coalesce((NEW.metadata->>'size')::bigint,0);
 IF incoming<0 OR incoming>536870912 THEN RAISE EXCEPTION USING ERRCODE='PT413',MESSAGE='{"error":"file_too_large","message":"Maximum file size is 512 MiB."}'; END IF;
 SELECT coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0) INTO total FROM storage.objects
 WHERE bucket_id='course-assets' AND split_part(name,'/',1)=level_code AND id<>NEW.id;
 IF total+incoming>21474836480 THEN RAISE EXCEPTION USING ERRCODE='PT413',MESSAGE='{"error":"level_quota_exceeded","message":"The level storage limit is 20 GiB."}'; END IF;
 RETURN NEW;
END $$;


--
-- Name: folder_allowed(uuid); Type: FUNCTION; Schema: media_private; Owner: -
--

CREATE FUNCTION media_private.folder_allowed(p_folder_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT EXISTS(SELECT 1 FROM public.lms_media_folder f WHERE f.folder_id=p_folder_id AND
  (identity_private.current_profile_role() IN('teacher','admin') OR EXISTS(
    SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=auth.uid() AND a.level=f.level)))
$$;


--
-- Name: guard_folder_change(); Type: FUNCTION; Schema: media_private; Owner: -
--

CREATE FUNCTION media_private.guard_folder_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
 IF TG_OP='DELETE' OR NEW.level IS DISTINCT FROM OLD.level OR NEW.folder_id IS DISTINCT FROM OLD.folder_id THEN
  IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='course-assets' AND split_part(name,'/',2)=OLD.folder_id::text) THEN
   RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='media_folder_has_files',DETAIL='{"error":"media_folder_has_files","message":"Delete folder files through Storage API before removing or moving this folder."}';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;


--
-- Name: path_allowed(text, boolean); Type: FUNCTION; Schema: media_private; Owner: -
--

CREATE FUNCTION media_private.path_allowed(p_name text, p_write boolean DEFAULT false) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $_$
DECLARE parts text[]:=string_to_array(p_name,'/'); folder uuid;
BEGIN
 IF cardinality(parts)<>4 OR parts[2]!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 OR parts[4]!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|webm|pdf|pptx|key)$'
 OR NOT ((parts[3]='videos' AND parts[4]~'\.(mp4|webm)$') OR (parts[3]='presentations' AND parts[4]~'\.(pdf|pptx|key)$')) THEN RETURN false; END IF;
 folder:=parts[2]::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.lms_media_folder f WHERE f.folder_id=folder AND f.level=parts[1]) THEN RETURN false; END IF;
 IF identity_private.current_profile_role() IN('teacher','admin') THEN RETURN true; END IF;
 IF p_write OR NOT media_private.folder_allowed(folder) THEN RETURN false; END IF;
 RETURN (parts[3]='presentations' AND EXISTS(SELECT 1 FROM public.lms_presentation_asset a WHERE a.folder_id=folder AND a.storage_path=p_name))
 OR (parts[3]='videos' AND EXISTS(SELECT 1 FROM public.learning_videos v WHERE v.folder_id=folder AND v.storage_path=p_name AND v.unit_id = ANY ((SELECT media_private.published_video_unit_ids())::uuid[])));
END $_$;


--
-- Name: published_video_unit_ids(); Type: FUNCTION; Schema: media_private; Owner: -
--

CREATE FUNCTION media_private.published_video_unit_ids() RETURNS uuid[]
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT coalesce(array_agg(DISTINCT u.id),ARRAY[]::uuid[])
 FROM public.learning_videos v JOIN public.learning_units u ON u.id=v.unit_id
 JOIN public.lms_media_folder f ON f.folder_id=v.folder_id AND f.level=u.level
 WHERE v.storage_path IS NOT NULL AND u.trainer='videos' AND u.is_active
 AND ((SELECT identity_private.current_profile_role()) IN('teacher','admin') OR EXISTS(
   SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=(SELECT auth.uid()) AND a.level=f.level));
$$;


--
-- Name: validate_asset(); Type: FUNCTION; Schema: media_private; Owner: -
--

CREATE FUNCTION media_private.validate_asset() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
DECLARE folder_level text; expected_category text; object_id uuid; expected_size bigint;
BEGIN
 IF NEW.storage_path IS NULL THEN RETURN NEW; END IF;
 SELECT level INTO folder_level FROM public.lms_media_folder WHERE folder_id=NEW.folder_id;
 IF TG_TABLE_NAME='learning_videos' THEN
  IF NOT EXISTS(SELECT 1 FROM public.learning_units u WHERE u.id=NEW.unit_id AND u.level=folder_level) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='media_level_mismatch'; END IF;
  expected_category:='videos';object_id:=NEW.id;
 ELSE expected_category:='presentations';object_id:=NEW.asset_id; END IF;
 IF NEW.storage_path !~ ('^'||replace(folder_level,'.','\.')||'/'||NEW.folder_id||'/'||expected_category||'/'||object_id||'\.(mp4|webm|pdf|pptx|key)$')
 OR NOT media_private.path_allowed(NEW.storage_path,true) THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='invalid_storage_path',DETAIL='{"error":"invalid_storage_path","message":"Asset path must match its level, folder and identifier."}';
 END IF;
 SELECT (metadata->>'size')::bigint INTO expected_size FROM storage.objects WHERE bucket_id='course-assets' AND name=NEW.storage_path;
 IF NEW.file_size IS NULL OR expected_size IS NULL OR expected_size<>NEW.file_size THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='invalid_storage_size',DETAIL='{"error":"invalid_storage_size","message":"Upload must exist with the declared file size."}';
 END IF;
 IF TG_TABLE_NAME='lms_presentation_asset' THEN
 IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='course-assets' AND o.name=NEW.storage_path
 AND o.metadata->>'mimetype'=NEW.mime_type::text AND
 ((NEW.storage_path~'\.pdf$' AND NEW.mime_type::text='application/pdf') OR
 (NEW.storage_path~'\.pptx$' AND NEW.mime_type::text='application/vnd.openxmlformats-officedocument.presentationml.presentation') OR
 (NEW.storage_path~'\.key$' AND NEW.mime_type::text='application/vnd.apple.keynote'))) THEN
 RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='media_mime_mismatch'; END IF;
 ELSE
 IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='course-assets' AND o.name=NEW.storage_path
 AND ((NEW.storage_path~'\.mp4$' AND o.metadata->>'mimetype'='video/mp4') OR
 (NEW.storage_path~'\.webm$' AND o.metadata->>'mimetype'='video/webm'))) THEN
 RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='media_mime_mismatch',
  DETAIL='{"error":"media_mime_mismatch","message":"Video extension and uploaded MIME type must match."}'; END IF;
 END IF;
 RETURN NEW;
END $_$;


--
-- Name: audio_allowed(text); Type: FUNCTION; Schema: path_private; Owner: -
--

CREATE FUNCTION path_private.audio_allowed(p_name text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT auth.uid() IS NOT NULL AND (business_private.is_staff()
 OR EXISTS(SELECT 1 FROM path_private.practice_items i JOIN public.path_practice_runs r ON r.id=i.run_id
   WHERE r.auth_user_id=auth.uid() AND path_private.node_available(r.node_id) AND i.snapshot->>'type'='listening'
    AND '/storage/v1/object/authenticated/path-audio/'||p_name IN(i.snapshot->'content'->'audio'->>'normal',i.snapshot->'content'->'audio'->>'slow'))
 OR EXISTS(SELECT 1 FROM path_private.test_items i JOIN public.path_test_attempts a ON a.id=i.attempt_id
   WHERE a.auth_user_id=auth.uid() AND path_private.node_available(a.node_id) AND i.snapshot->>'type'='listening'
    AND '/storage/v1/object/authenticated/path-audio/'||p_name IN(i.snapshot->'content'->'audio'->>'normal',i.snapshot->'content'->'audio'->>'slow')));

$$;


--
-- Name: check_actor(text); Type: FUNCTION; Schema: path_private; Owner: -
--

CREATE FUNCTION path_private.check_actor(p_locale text DEFAULT 'de'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=auth.uid(); BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_locale IS NULL OR p_locale NOT IN('de','en','ru','uk','tr') THEN RAISE EXCEPTION 'invalid_language' USING ERRCODE='22023'; END IF;
 PERFORM learning_reset_private.assert_writable(actor);
 PERFORM pg_advisory_xact_lock(hashtextextended('path:'||actor::text,0));
 RETURN actor;
END $$;


--
-- Name: error(text, text); Type: FUNCTION; Schema: path_private; Owner: -
--

CREATE FUNCTION path_private.error(p_message text, p_state text) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
 SELECT jsonb_build_object('error',CASE WHEN p_message=ANY(ARRAY['authentication_required','invalid_language','path_locked','node_locked','node_unavailable','invalid_input','test_pool_invalid','attempt_unavailable','answer_out_of_order','request_conflict','answers_incomplete','not_authorized','learning_reset_in_progress','invalid_answer']) THEN p_message
 WHEN p_state IN('23514','23502','23503','22P02','22023') THEN 'invalid_input' WHEN p_state='23505' THEN 'request_conflict' ELSE 'request_failed' END,'sqlstate',p_state);
$$;


--
-- Name: german_task_allowed(jsonb); Type: FUNCTION; Schema: path_private; Owner: -
--

CREATE FUNCTION path_private.german_task_allowed(p_value jsonb) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
DECLARE child jsonb;
BEGIN
 IF jsonb_typeof(p_value)='string' THEN RETURN learning_private.german_text_allowed(p_value#>>'{}'); END IF;
 IF jsonb_typeof(p_value)='array' THEN
  FOR child IN SELECT value FROM jsonb_array_elements(p_value) LOOP
   IF NOT path_private.german_task_allowed(child) THEN RETURN false; END IF;
  END LOOP;
 ELSIF jsonb_typeof(p_value)='object' THEN
  FOR child IN SELECT value FROM jsonb_each(p_value) WHERE key NOT IN ('id','category_id','type','audio') LOOP
   IF NOT path_private.german_task_allowed(child) THEN RETURN false; END IF;
  END LOOP;
 END IF;
 RETURN true;
END $$;


--
-- Name: grade(public.exercise_type, jsonb, jsonb); Type: FUNCTION; Schema: path_private; Owner: -
--

CREATE FUNCTION path_private.grade(p_type public.exercise_type, p_content jsonb, p_answer jsonb) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER
    SET search_path TO ''
    AS $_$
DECLARE item jsonb; submitted jsonb; field_grade jsonb; fields jsonb:='[]'; mapping jsonb; items jsonb;
 key_name text; field_id text; composed text; position integer; matched boolean;
 status learning_private.answer_status:='EXACT'; count_items integer;
 invalid jsonb:='{"error":"invalid_answer","message":"The answer does not match this exercise.","sqlstate":"22023"}';
BEGIN
 IF NOT path_private.valid_content(p_type,p_content) THEN
  RETURN jsonb_build_object('error','invalid_content','message','The exercise content is invalid.','sqlstate','22023');
 END IF;
 IF jsonb_typeof(p_answer) IS DISTINCT FROM 'object' THEN RETURN invalid; END IF;
 IF p_type='listening' THEN RETURN path_private.grade((p_content#>>'{exercise,type}')::public.exercise_type,p_content#>'{exercise,content}',p_answer); END IF;
 IF p_type IN ('fill_in_blank','transform') THEN
  IF NOT path_private.only_keys(p_answer,ARRAY['text']) OR NOT path_private.valid_text(p_answer->'text') THEN RETURN invalid; END IF;
  field_grade:=learning_private.grade_answer(p_answer->>'text',ARRAY(SELECT jsonb_array_elements_text(p_content->'accepted_answers')));
  IF field_grade ? 'error' THEN RETURN field_grade; END IF;
  fields:=jsonb_build_array(jsonb_build_object('id','answer')||field_grade);
 ELSIF p_type='multiple_choice' THEN
  IF NOT path_private.only_keys(p_answer,ARRAY['index']) OR jsonb_typeof(p_answer->'index') IS DISTINCT FROM 'number'
   OR (p_answer->>'index') !~ '^[0-9]+$' THEN RETURN invalid; END IF;
  position:=(p_answer->>'index')::integer;
  IF position>=jsonb_array_length(p_content->'options') THEN RETURN invalid; END IF;
  matched:=path_private.text_key(p_content->'options'->>position)=path_private.text_key(p_content->>'correct_answer');
  fields:=jsonb_build_array(jsonb_build_object('id','answer','status',CASE WHEN matched THEN 'EXACT' ELSE 'INCORRECT' END));
 ELSIF p_type='sentence_building' THEN
  IF NOT path_private.only_keys(p_answer,ARRAY['indices']) OR jsonb_typeof(p_answer->'indices') IS DISTINCT FROM 'array' THEN RETURN invalid; END IF;
  count_items:=jsonb_array_length(p_content->'parts');
  IF jsonb_array_length(p_answer->'indices')<>count_items OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_answer->'indices') i
   WHERE jsonb_typeof(i)<>'number' OR (i#>>'{}') !~ '^[0-9]+$') THEN RETURN invalid; END IF;
  IF (SELECT count(DISTINCT value) FROM jsonb_array_elements(p_answer->'indices'))<>count_items
   OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_answer->'indices') i WHERE i::numeric>=count_items) THEN RETURN invalid; END IF;
  SELECT string_agg(p_content->'parts'->>(value::integer),' ' ORDER BY ordinality) INTO composed
   FROM jsonb_array_elements_text(p_answer->'indices') WITH ORDINALITY;
  field_grade:=learning_private.grade_answer(composed,ARRAY(SELECT jsonb_array_elements_text(p_content->'accepted_answers')));
  IF field_grade ? 'error' THEN RETURN field_grade; END IF;
  fields:=jsonb_build_array(jsonb_build_object('id','answer')||field_grade);
 ELSE
  key_name:=CASE p_type::text WHEN 'multi_blank' THEN 'values' WHEN 'matching' THEN 'pairs'
   WHEN 'categorize' THEN 'assignments' WHEN 'dialogue' THEN 'replies' END;
  IF key_name IS NULL OR NOT path_private.only_keys(p_answer,ARRAY[key_name]) OR jsonb_typeof(p_answer->key_name) IS DISTINCT FROM 'object' THEN RETURN invalid; END IF;
  mapping:=p_answer->key_name;
  items:=p_content->CASE p_type::text WHEN 'multi_blank' THEN 'blanks' WHEN 'matching' THEN 'pairs'
   WHEN 'categorize' THEN 'items' WHEN 'dialogue' THEN 'turns' END;
  IF (SELECT count(*) FROM jsonb_object_keys(mapping))<>jsonb_array_length(items) THEN RETURN invalid; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
   field_id:=item->>'id'; submitted:=mapping->field_id;
   IF submitted IS NULL THEN RETURN invalid; END IF;
   IF p_type='multi_blank' OR (p_type='dialogue' AND item->>'type'='fill_in_blank') THEN
    IF NOT path_private.valid_text(submitted) THEN RETURN invalid; END IF;
    field_grade:=learning_private.grade_answer(submitted#>>'{}',ARRAY(SELECT jsonb_array_elements_text(item->'accepted_answers')));
    IF field_grade ? 'error' THEN RETURN field_grade; END IF;
   ELSE
    IF p_type='dialogue' THEN
     IF jsonb_typeof(submitted) IS DISTINCT FROM 'number' OR (submitted#>>'{}') !~ '^[0-9]+$' THEN RETURN invalid; END IF;
     position:=(submitted#>>'{}')::integer;
     IF position>=jsonb_array_length(item->'options') THEN RETURN invalid; END IF;
     matched:=path_private.text_key(item->'options'->>position)=path_private.text_key(item->>'correct_answer');
    ELSIF p_type='matching' THEN
     IF NOT path_private.valid_text(submitted,100) OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(items) i
      WHERE md5(i->>'right')=submitted#>>'{}') THEN RETURN invalid; END IF;
     matched:=submitted#>>'{}'=md5(item->>'right');
    ELSE
     IF NOT path_private.valid_text(submitted,100) OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_content->'categories') i
      WHERE i->>'id'=submitted#>>'{}') THEN RETURN invalid; END IF;
     matched:=submitted#>>'{}'=item->>'category_id';
    END IF;
    field_grade:=jsonb_build_object('status',CASE WHEN matched THEN 'EXACT' ELSE 'INCORRECT' END);
   END IF;
   fields:=fields||jsonb_build_array(jsonb_build_object('id',field_id)||field_grade);
  END LOOP;
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(fields) f WHERE f->>'status'='INCORRECT') THEN status:='INCORRECT';
 ELSIF EXISTS(SELECT 1 FROM jsonb_array_elements(fields) f WHERE f->>'status'='SOFT_ERROR') THEN status:='SOFT_ERROR'; END IF;
 SELECT jsonb_agg(f||jsonb_build_object('correct',f->>'status'<>'INCORRECT') ORDER BY ordinality)
  INTO fields FROM jsonb_array_elements(fields) WITH ORDINALITY AS rows(f,ordinality);
 RETURN jsonb_build_object('status',status,'correct',status<>'INCORRECT','fields',fields);
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN invalid;
END $_$;


--
-- Name: guard_catalog(); Type: FUNCTION; Schema: path_private; Owner: -
--

CREATE FUNCTION path_private.guard_catalog() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE u public.learning_units; anchor public.path_nodes;
BEGIN
 IF TG_TABLE_NAME='learning_units' THEN
  IF NEW.is_path AND (NEW.trainer<>'exercises' OR NEW.sort_order<1 OR nullif(btrim(NEW.path_source_id),'') IS NULL
    OR nullif(btrim(NEW.path_title),'') IS NULL OR nullif(btrim(NEW.path_slug),'') IS NULL
    OR NOT learning_private.german_text_allowed(NEW.path_title||NEW.label)) THEN RAISE EXCEPTION 'invalid_path' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO u FROM public.learning_units WHERE id=NEW.unit_id;
 IF TG_TABLE_NAME='learning_exercises' THEN
  IF NEW.node_id IS NULL THEN
   IF u.is_path THEN RAISE EXCEPTION 'path_node_required' USING ERRCODE='23514'; END IF;
   RETURN NEW;
  END IF;
 END IF;
 IF NOT u.is_path OR u.trainer<>'exercises' THEN RAISE EXCEPTION 'path_unit_required' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='learning_exercises' THEN
  IF NEW.goal_id IS NULL OR NOT path_private.valid_content(NEW.type,NEW.content)
   OR NOT EXISTS(SELECT 1 FROM public.path_nodes n WHERE n.id=NEW.node_id AND NEW.goal_id=ANY(n.goals)) THEN
   RAISE EXCEPTION 'invalid_path_exercise' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='path_nodes' THEN
  IF cardinality(NEW.goals)=0 OR EXISTS(SELECT 1 FROM unnest(NEW.goals) g WHERE NOT EXISTS(SELECT 1 FROM public.path_objectives o WHERE o.unit_id=NEW.unit_id AND o.id=g))
   OR NOT learning_private.german_text_allowed(NEW.title||NEW.topic||coalesce(NEW.merkkarte::text,''))
   OR (NEW.kind='practice' AND (jsonb_typeof(NEW.merkkarte) IS DISTINCT FROM 'object' OR nullif(btrim(NEW.merkkarte->>'rule'),'') IS NULL
     OR jsonb_typeof(NEW.merkkarte->'examples') IS DISTINCT FROM 'array')) THEN RAISE EXCEPTION 'invalid_path_node' USING ERRCODE='23514'; END IF;
  IF NEW.kind='test' AND NEW.merkkarte IS NOT NULL THEN RAISE EXCEPTION 'invalid_path_node' USING ERRCODE='23514'; END IF;
  IF NEW.merkkarte IS NOT NULL AND (NOT path_private.valid_strings(NEW.merkkarte->'examples',1,false) OR NOT path_private.only_keys(NEW.merkkarte,ARRAY['card','rule','examples','highlight'])) THEN RAISE EXCEPTION 'invalid_path_node' USING ERRCODE='23514'; END IF;
  IF NEW.kind='special' THEN
   SELECT * INTO anchor FROM public.path_nodes WHERE id=NEW.anchor_node_id;
   IF anchor.kind NOT IN('practice','review') OR anchor.unit_id<>NEW.unit_id THEN RAISE EXCEPTION 'invalid_anchor' USING ERRCODE='23514'; END IF;
  END IF;
  NEW.updated_at:=clock_timestamp();
 ELSIF TG_TABLE_NAME='path_objectives' AND NOT learning_private.german_text_allowed(NEW.description) THEN
  RAISE EXCEPTION 'invalid_path_objective' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;


--
-- Name: import_path_catalog(jsonb, uuid); Type: FUNCTION; Schema: path_private; Owner: -
--

CREATE FUNCTION path_private.import_path_catalog(p_path jsonb, p_actor uuid) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE actor uuid; unit uuid; node uuid; anchor uuid; node_data jsonb; exercise jsonb; objective jsonb; lang text;
 task_id uuid; exercise_count integer:=0; node_count integer:=0; kind public.path_node_kind; tests integer; reviews integer; practices integer;
BEGIN
 actor:=p_actor;
 IF NOT path_private.valid_seed_shape(p_path) THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(p_path) IS DISTINCT FROM 'object' OR jsonb_typeof(p_path->'nodes') IS DISTINCT FROM 'array'
  OR jsonb_typeof(p_path->'objectives') IS DISTINCT FROM 'array' OR nullif(p_path->>'id','') IS NULL
  OR (p_path->'unit'->>'trainer') IS DISTINCT FROM 'exercises' OR (p_path->'unit'->>'level') IS DISTINCT FROM (p_path->>'level')
  OR (p_path->'unit'->>'sort_order')::integer IS DISTINCT FROM (p_path->>'path')::integer THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('path-catalog:'||(p_path->>'level'),0));
 SELECT id INTO unit FROM public.learning_units WHERE is_path AND level=p_path->>'level' AND path_source_id=p_path->>'id' FOR UPDATE;
 IF unit IS NULL THEN
  INSERT INTO public.learning_units(level,trainer,label,sort_order,is_path,path_source_id,path_slug,path_title,is_active)
   VALUES(p_path->>'level','exercises',p_path->'unit'->>'label',(p_path->>'path')::integer,true,p_path->>'id',p_path->>'slug',p_path->>'title',coalesce((p_path->>'is_active')::boolean,true)) RETURNING id INTO unit;
 ELSE
  UPDATE public.learning_units SET label=p_path->'unit'->>'label',sort_order=(p_path->>'path')::integer,path_slug=p_path->>'slug',path_title=p_path->>'title',is_active=coalesce((p_path->>'is_active')::boolean,true) WHERE id=unit;
 END IF;
 FOR lang IN SELECT unnest(ARRAY['de','en','ru','uk','tr']) LOOP
  INSERT INTO public.path_unit_translations(unit_id,locale,title) VALUES(unit,lang,CASE WHEN lang='de' THEN p_path->>'title' ELSE nullif(p_path->'translations'->lang->>'title','') END)
  ON CONFLICT(unit_id,locale) DO UPDATE SET title=excluded.title;
 END LOOP;
 FOR objective IN SELECT value FROM jsonb_array_elements(p_path->'objectives') LOOP
  INSERT INTO public.path_objectives(unit_id,id,area,description) VALUES(unit,objective->>'id',(objective->>'area')::public.path_objective_area,objective->>'description')
  ON CONFLICT(unit_id,id) DO UPDATE SET area=excluded.area,description=excluded.description;
 END LOOP;
 -- Preserve catalog records referenced by old attempts. Omitted records become inactive.
 UPDATE public.path_nodes SET is_active=false WHERE unit_id=unit;
 UPDATE public.learning_exercises SET path_is_active=false WHERE unit_id=unit AND node_id IS NOT NULL;
 -- Anchors are always regular nodes; import them before special branches.
 FOR node_data IN SELECT value FROM jsonb_array_elements(p_path->'nodes') ORDER BY (value->>'kind'='special'),(value->>'sort_order')::integer LOOP
  kind:=(node_data->>'kind')::public.path_node_kind;
  anchor:=NULL;
  IF kind='special' THEN
   SELECT id INTO anchor FROM public.path_nodes WHERE unit_id=unit AND source_id=node_data->>'anchor_node_id' AND is_active;
   IF anchor IS NULL THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
  END IF;
  INSERT INTO public.path_nodes(unit_id,source_id,kind,sort_order,title,topic,merkkarte,goals,anchor_node_id,test_size,is_active,created_by)
   VALUES(unit,node_data->>'id',kind,(node_data->>'sort_order')::integer,node_data->>'title',node_data->>'topic',nullif(node_data->'merkkarte','null'::jsonb)-'translations',
    ARRAY(SELECT jsonb_array_elements_text(node_data->'goals')),anchor,(node_data->>'test_size')::integer,coalesce((node_data->>'is_active')::boolean,true),actor)
  ON CONFLICT(unit_id,source_id) DO UPDATE SET kind=excluded.kind,sort_order=excluded.sort_order,title=excluded.title,topic=excluded.topic,
   merkkarte=excluded.merkkarte,goals=excluded.goals,anchor_node_id=excluded.anchor_node_id,test_size=excluded.test_size,is_active=excluded.is_active RETURNING id INTO node;
  node_count:=node_count+1;
  FOR lang IN SELECT unnest(ARRAY['de','en','ru','uk','tr']) LOOP
   INSERT INTO public.path_node_translations(node_id,locale,title,rule) VALUES(node,lang,
    CASE WHEN lang='de' THEN node_data->>'title' ELSE nullif(node_data->'translations'->lang->>'title','') END,
    CASE WHEN lang='de' THEN node_data->'merkkarte'->>'rule' ELSE node_data->'merkkarte'->'translations'->lang->>'rule' END)
   ON CONFLICT(node_id,locale) DO UPDATE SET title=excluded.title,rule=excluded.rule;
   IF kind='practice' AND NOT EXISTS(SELECT 1 FROM public.path_node_translations WHERE node_id=node AND locale=lang AND nullif(btrim(rule),'') IS NOT NULL) THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
  END LOOP;
  FOR exercise IN SELECT value||jsonb_build_object('_position',ordinality) FROM jsonb_array_elements(node_data->'exercises') WITH ORDINALITY LOOP
   task_id:=(exercise->>'id')::uuid;
   IF EXISTS(SELECT 1 FROM public.learning_exercises WHERE id=task_id AND (unit_id<>unit OR node_id IS NULL)) THEN RAISE EXCEPTION 'request_conflict' USING ERRCODE='22023'; END IF;
   IF exercise ? 'accepted_answers' AND exercise->'accepted_answers' IS DISTINCT FROM exercise->'content'->'accepted_answers' THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
   INSERT INTO public.learning_exercises(id,unit_id,node_id,goal_id,source_ref,sort_order,topic,type,content,path_is_active,explanation_card)
    VALUES(task_id,unit,node,exercise->>'goal',exercise->>'ref',(exercise->>'_position')::integer,node_data->>'topic',(exercise->>'exercise_type')::public.exercise_type,exercise->'content',true,exercise->>'explanation_card')
   ON CONFLICT(id) DO UPDATE SET node_id=excluded.node_id,goal_id=excluded.goal_id,source_ref=excluded.source_ref,sort_order=excluded.sort_order,topic=excluded.topic,type=excluded.type,content=excluded.content,path_is_active=true,explanation_card=excluded.explanation_card;
   FOR lang IN SELECT unnest(ARRAY['de','en','ru','uk','tr']) LOOP
    INSERT INTO public.grammar_translations(exercise_id,locale,hint,explanation,instruction,prompt) VALUES(task_id,lang,
     CASE WHEN lang='de' THEN exercise->>'hint' ELSE exercise->'translations'->lang->>'hint' END,
     CASE WHEN lang='de' THEN exercise->>'explanation' ELSE exercise->'translations'->lang->>'explanation' END,
     CASE WHEN lang='de' THEN exercise->'content'->>'instruction' ELSE exercise->'translations'->lang->>'instruction' END,
     exercise->'translations'->lang->>'prompt')
    ON CONFLICT(exercise_id,locale) DO UPDATE SET hint=excluded.hint,explanation=excluded.explanation,instruction=excluded.instruction,prompt=excluded.prompt;
   END LOOP;
   exercise_count:=exercise_count+1;
  END LOOP;
 END LOOP;
 SELECT count(*) FILTER(WHERE n.kind='test'),count(*) FILTER(WHERE n.kind='review'),count(*) FILTER(WHERE n.kind='practice') INTO tests,reviews,practices FROM public.path_nodes n WHERE n.unit_id=unit AND n.is_active;
 IF tests<>1 OR reviews<>1 OR practices<1 OR EXISTS(SELECT 1 FROM public.path_nodes n WHERE n.unit_id=unit AND n.is_active AND NOT EXISTS(SELECT 1 FROM public.learning_exercises e WHERE e.node_id=n.id AND e.path_is_active))
  OR EXISTS(SELECT 1 FROM public.path_nodes t JOIN public.path_nodes n ON n.unit_id=t.unit_id WHERE t.unit_id=unit AND t.is_active AND n.is_active AND ((t.kind='test' AND n.kind IN('practice','review')) OR (t.kind='review' AND n.kind='practice')) AND n.sort_order>t.sort_order)
  OR EXISTS(SELECT 1 FROM public.path_nodes t WHERE t.unit_id=unit AND t.kind='test' AND t.is_active AND (
    t.test_size>(SELECT count(*)/2 FROM public.learning_exercises e WHERE e.node_id=t.id AND e.path_is_active)
    OR t.test_size<(SELECT count(*) FROM public.path_objectives o WHERE o.unit_id=unit)
    OR EXISTS(SELECT 1 FROM public.path_objectives o WHERE o.unit_id=unit AND NOT EXISTS(SELECT 1 FROM public.learning_exercises e WHERE e.node_id=t.id AND e.path_is_active AND e.goal_id=o.id)))) THEN RAISE EXCEPTION 'test_pool_invalid' USING ERRCODE='23514'; END IF;
 RETURN jsonb_build_object('unit_id',unit,'node_count',node_count,'exercise_count',exercise_count);
END $$;


--
-- Name: migrate_legacy_grammar(); Type: FUNCTION; Schema: path_private; Owner: -
--

CREATE FUNCTION path_private.migrate_legacy_grammar() RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE archived integer; notes integer;
BEGIN
 INSERT INTO path_private.archived_units(unit_id,is_active)
 SELECT id,is_active FROM public.learning_units WHERE trainer='exercises' AND NOT is_path
 ON CONFLICT DO NOTHING;
 UPDATE public.learning_units SET is_active=false WHERE trainer='exercises' AND NOT is_path AND is_active;
 GET DIAGNOSTICS archived=ROW_COUNT;
 INSERT INTO public.path_legacy_progress_notes(
  auth_user_id,level,legacy_exercise_count,legacy_completed_count,legacy_attempt_count,
  initial_path_progress,existing_path_progress_preserved,note)
 SELECT p.auth_user_id,u.level,count(*)::integer,count(*) FILTER(WHERE p.completed)::integer,
  coalesce(sum(p.attempts),0),0,
  EXISTS(SELECT 1 FROM public.path_node_progress np JOIN public.path_nodes n ON n.id=np.node_id
   JOIN public.learning_units nu ON nu.id=n.unit_id WHERE np.auth_user_id=p.auth_user_id AND nu.level=u.level),
  jsonb_build_object(
   'de','Alte Grammatikdaten bleiben erhalten. Eine verlässliche Zuordnung zum Lernpfad fehlt; aus dem Altbestand werden 0 Abschlüsse übernommen. Ohne bisherigen Lernpfadfortschritt beginnt der Pfad bei 0. Bereits vorhandener Lernpfadfortschritt bleibt unverändert.',
   'en','Earlier grammar records are preserved. No reliable mapping to the learning path exists, so 0 completions are transferred. Learners without prior path progress start at 0. Existing path progress is unchanged.',
   'ru','Прежние результаты по грамматике сохранены. Надёжного соответствия заданиям учебного маршрута нет, поэтому перенесено 0 завершений. Без прежнего прогресса в маршруте обучение начинается с 0. Уже имеющийся прогресс маршрута не изменён.',
   'uk','Попередні результати з граматики збережено. Надійної відповідності завданням навчального маршруту немає, тому перенесено 0 завершень. Без попереднього прогресу в маршруті навчання починається з 0. Наявний прогрес маршруту не змінено.',
   'tr','Önceki dil bilgisi kayıtları korunur. Öğrenme yoluyla güvenilir bir eşleştirme yapılamadığı için aktarılan tamamlanma sayısı 0 olur. Öğrenme yolunda önceki ilerlemesi olmayanlar 0’dan başlar. Mevcut öğrenme yolu ilerlemesi değişmez.')
 FROM public.user_exercise_progress p JOIN public.learning_exercises e ON e.id=p.exercise_id
 JOIN public.learning_units u ON u.id=e.unit_id WHERE u.trainer='exercises' AND NOT u.is_path
 GROUP BY p.auth_user_id,u.level
 ON CONFLICT(auth_user_id,level) DO NOTHING;
 GET DIAGNOSTICS notes=ROW_COUNT;
 RETURN jsonb_build_object('archived_units',archived,'notes_created',notes);
END $$;


--
-- Name: node_available(uuid); Type: FUNCTION; Schema: path_private; Owner: -
--

CREATE FUNCTION path_private.node_available(p_node uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT EXISTS(SELECT 1 FROM public.path_nodes n WHERE n.id=p_node AND n.is_active AND path_private.unit_available(n.unit_id)
 AND (business_private.is_staff() OR CASE WHEN n.kind='special' THEN EXISTS(SELECT 1 FROM public.path_node_progress p
   WHERE p.node_id=n.anchor_node_id AND p.auth_user_id=(SELECT auth.uid()) AND p.status='completed' AND p.is_active)
 ELSE NOT EXISTS(SELECT 1 FROM public.path_nodes prev WHERE prev.unit_id=n.unit_id AND prev.is_active AND prev.kind IN('practice','review')
   AND (n.kind='test' OR prev.sort_order<n.sort_order) AND NOT EXISTS(SELECT 1 FROM public.path_node_progress p
    WHERE p.node_id=prev.id AND p.auth_user_id=(SELECT auth.uid()) AND p.status='completed' AND p.is_active)) END));
$$;


--
-- Name: only_keys(jsonb, text[]); Type: FUNCTION; Schema: path_private; Owner: -
--

CREATE FUNCTION path_private.only_keys(p_value jsonb, p_keys text[]) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
BEGIN
 IF jsonb_typeof(p_value) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
 RETURN NOT EXISTS(SELECT 1 FROM jsonb_object_keys(p_value) k WHERE NOT k=ANY(p_keys));
END $$;


--
-- Name: present(jsonb, text); Type: FUNCTION; Schema: path_private; Owner: -
--

CREATE FUNCTION path_private.present(p_snapshot jsonb, p_locale text) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
 SELECT jsonb_build_object('id',p_snapshot->'id','type',p_snapshot->'type','content',
  path_private.present_content((p_snapshot->>'type')::public.exercise_type,p_snapshot->'content') ||
  CASE WHEN nullif(p_snapshot->'translations'->p_locale->>'instruction','') IS NOT NULL THEN jsonb_build_object('instruction',p_snapshot->'translations'->p_locale->>'instruction') ELSE '{}'::jsonb END ||
  CASE WHEN nullif(p_snapshot->'translations'->p_locale->>'prompt','') IS NOT NULL THEN jsonb_build_object('prompt',p_snapshot->'translations'->p_locale->>'prompt') ELSE '{}'::jsonb END);
$$;


--
-- Name: present_content(public.exercise_type, jsonb); Type: FUNCTION; Schema: path_private; Owner: -
--

CREATE FUNCTION path_private.present_content(p_type public.exercise_type, p_content jsonb) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
DECLARE output jsonb:='{}'; item jsonb; entries jsonb:='[]'; keys text[]; k text;
BEGIN
 -- Allowlisting is intentional: new authoring fields never become public by
 -- accident. target_form can contain the solution, so it is also withheld.
 keys:=ARRAY['instruction']||CASE p_type::text
  WHEN 'multiple_choice' THEN ARRAY['question','options']
  WHEN 'fill_in_blank' THEN ARRAY['text_before','text_after','needs_article']
  WHEN 'sentence_building' THEN ARRAY['parts']
  WHEN 'multi_blank' THEN ARRAY['text']
  WHEN 'transform' THEN ARRAY['source','needs_article']
  ELSE ARRAY[]::text[] END;
 FOREACH k IN ARRAY keys LOOP
  IF p_content ? k THEN output:=output||jsonb_build_object(k,p_content->k); END IF;
 END LOOP;
 IF p_type='multi_blank' THEN
  FOR item IN SELECT value FROM jsonb_array_elements(p_content->'blanks') LOOP
   entries:=entries||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
    'id',item->'id','label',item->'label','needs_article',item->'needs_article')));
  END LOOP;
  output:=output||jsonb_build_object('blanks',entries);
 ELSIF p_type='matching' THEN
  SELECT jsonb_agg(jsonb_build_object('id',value->'id','text',value->'left') ORDER BY ordinality)
   INTO entries FROM jsonb_array_elements(p_content->'pairs') WITH ORDINALITY;
  output:=output||jsonb_build_object('left',entries);
  SELECT jsonb_agg(jsonb_build_object('id',md5(value->>'right'),'text',value->'right') ORDER BY md5(value->>'right'))
   INTO entries FROM jsonb_array_elements(p_content->'pairs');
  output:=output||jsonb_build_object('right',entries);
 ELSIF p_type='categorize' THEN
  SELECT jsonb_agg(jsonb_build_object('id',value->'id','label',value->'label') ORDER BY ordinality)
   INTO entries FROM jsonb_array_elements(p_content->'categories') WITH ORDINALITY;
  output:=output||jsonb_build_object('categories',entries);
  SELECT jsonb_agg(jsonb_build_object('id',value->'id','text',value->'text') ORDER BY ordinality)
   INTO entries FROM jsonb_array_elements(p_content->'items') WITH ORDINALITY;
  output:=output||jsonb_build_object('items',entries);
 ELSIF p_type='dialogue' THEN
  FOR item IN SELECT value FROM jsonb_array_elements(p_content->'turns') LOOP
   entries:=entries||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('id',item->'id',
    'speaker',item->'speaker','prompt',item->'prompt','type',item->'type',
    'options',item->'options','needs_article',item->'needs_article')));
  END LOOP;
  output:=output||jsonb_build_object('turns',entries);
 ELSIF p_type='listening' THEN
  output:=output||jsonb_build_object('audio',jsonb_build_object('normal',p_content#>'{audio,normal}','slow',p_content#>'{audio,slow}'));
  output:=output||jsonb_build_object('exercise',jsonb_build_object('type',p_content#>'{exercise,type}',
   'content',path_private.present_content((p_content#>>'{exercise,type}')::public.exercise_type,p_content#>'{exercise,content}')));
 END IF;
 RETURN output;
END $$;


--
-- Name: reset_progress(uuid, uuid, uuid); Type: FUNCTION; Schema: path_private; Owner: -
--

CREATE FUNCTION path_private.reset_progress(p_student uuid, p_unit uuid DEFAULT NULL::uuid, p_node uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('path:'||p_student::text,0));
 INSERT INTO teacher_dashboard_private.progress_archive(auth_user_id,unit_id,node_id,node_progress,exercise_progress)
 SELECT p_student,p_unit,p_node,
  coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM public.path_node_progress p JOIN public.path_nodes n ON n.id=p.node_id WHERE p.auth_user_id=p_student AND p.is_active AND (p_unit IS NULL OR n.unit_id=p_unit) AND (p_node IS NULL OR n.id=p_node)),'[]'),
  coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM public.user_exercise_progress p JOIN public.learning_exercises e ON e.id=p.exercise_id WHERE p.auth_user_id=p_student AND e.node_id IS NOT NULL AND (p_unit IS NULL OR e.unit_id=p_unit) AND (p_node IS NULL OR e.node_id=p_node)),'[]');
 UPDATE public.path_practice_runs r SET is_active=false,status=CASE WHEN r.status='active' THEN 'abandoned'::public.path_run_status ELSE r.status END
 FROM public.path_nodes n WHERE r.auth_user_id=p_student AND r.node_id=n.id AND r.is_active AND (p_unit IS NULL OR n.unit_id=p_unit) AND (p_node IS NULL OR n.id=p_node);
 UPDATE public.path_test_attempts a SET is_active=false,status=CASE WHEN a.status='active' THEN 'abandoned'::public.path_run_status ELSE a.status END
 FROM public.path_nodes n WHERE a.auth_user_id=p_student AND a.node_id=n.id AND a.is_active AND (p_unit IS NULL OR n.unit_id=p_unit) AND (p_node IS NULL OR n.id=p_node);
 UPDATE public.path_node_progress p SET is_active=false FROM public.path_nodes n
 WHERE p.auth_user_id=p_student AND p.node_id=n.id AND p.is_active AND (p_unit IS NULL OR n.unit_id=p_unit) AND (p_node IS NULL OR n.id=p_node);
 UPDATE public.path_interventions SET is_active=false WHERE auth_user_id=p_student AND action='unlock' AND (p_unit IS NULL OR unit_id=p_unit) AND p_node IS NULL;
 UPDATE public.user_exercise_progress p SET attempts=0,completed=false,score=NULL,hint_shown=false FROM public.learning_exercises e
 WHERE p.auth_user_id=p_student AND p.exercise_id=e.id AND e.node_id IS NOT NULL AND (p_unit IS NULL OR e.unit_id=p_unit) AND (p_node IS NULL OR e.node_id=p_node);
END $$;


--
-- Name: snapshot(uuid); Type: FUNCTION; Schema: path_private; Owner: -
--

CREATE FUNCTION path_private.snapshot(p_exercise uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT jsonb_build_object('id',e.id,'type',e.type,'content',e.content,'goal_id',e.goal_id,
 'translations',coalesce((SELECT jsonb_object_agg(t.locale,jsonb_build_object('instruction',t.instruction,'hint',t.hint,'explanation',t.explanation,'prompt',t.prompt)) FROM public.grammar_translations t WHERE t.exercise_id=e.id),'{}'::jsonb))
 FROM public.learning_exercises e WHERE e.id=p_exercise;
$$;


--
-- Name: solution(jsonb, text); Type: FUNCTION; Schema: path_private; Owner: -
--

CREATE FUNCTION path_private.solution(p_snapshot jsonb, p_locale text) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
 SELECT jsonb_build_object('content',p_snapshot->'content','explanation',coalesce(p_snapshot->'translations'->p_locale->>'explanation',p_snapshot->'translations'->'de'->>'explanation'));
$$;


--
-- Name: text_key(text); Type: FUNCTION; Schema: path_private; Owner: -
--

CREATE FUNCTION path_private.text_key(p_value text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
 SELECT lower(regexp_replace(btrim(p_value,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'),
  U&'[\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF]+',' ','g'))
$$;


--
-- Name: unit_available(uuid); Type: FUNCTION; Schema: path_private; Owner: -
--

CREATE FUNCTION path_private.unit_available(p_unit uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT EXISTS(SELECT 1 FROM public.learning_units u WHERE u.id=p_unit AND u.is_path AND u.is_active AND learning_private.unit_allowed(u.id)
 AND (business_private.is_staff() OR EXISTS(SELECT 1 FROM public.path_interventions i WHERE i.auth_user_id=(SELECT auth.uid()) AND i.unit_id=u.id AND i.action='unlock' AND i.is_active)
 OR NOT EXISTS(SELECT 1 FROM public.learning_units prev WHERE prev.is_path AND prev.is_active AND prev.level=u.level AND prev.sort_order=(SELECT max(predecessor.sort_order) FROM public.learning_units predecessor WHERE predecessor.is_path AND predecessor.is_active AND predecessor.level=u.level AND predecessor.sort_order<u.sort_order)
   AND NOT EXISTS(SELECT 1 FROM public.path_test_attempts a JOIN public.path_nodes n ON n.id=a.node_id
    WHERE a.auth_user_id=(SELECT auth.uid()) AND n.unit_id=prev.id AND a.status='completed' AND a.is_active AND a.passed))));
$$;


--
-- Name: valid_content(public.exercise_type, jsonb); Type: FUNCTION; Schema: path_private; Owner: -
--

CREATE FUNCTION path_private.valid_content(p_type public.exercise_type, p_content jsonb) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
DECLARE common_keys text[]:=ARRAY['instruction','target_form']; allowed text[]; item jsonb;
 items jsonb; seen text[]:=ARRAY[]::text[]; left_values text[]:=ARRAY[]::text[]; right_values text[]:=ARRAY[]::text[];
BEGIN
 IF jsonb_typeof(p_content) IS DISTINCT FROM 'object' OR NOT path_private.valid_strings(p_content->'target_form')
  OR (p_content ? 'instruction' AND NOT path_private.valid_text(p_content->'instruction')) THEN RETURN false; END IF;
 allowed:=CASE p_type::text
  WHEN 'multiple_choice' THEN ARRAY['question','options','correct_answer','accepted_answers']
  WHEN 'fill_in_blank' THEN ARRAY['text_before','text_after','options','correct_answer','accepted_answers','needs_article']
  WHEN 'sentence_building' THEN ARRAY['parts','correct_answer','accepted_answers']
  WHEN 'multi_blank' THEN ARRAY['text','blanks']
  WHEN 'matching' THEN ARRAY['pairs']
  WHEN 'categorize' THEN ARRAY['categories','items']
  WHEN 'dialogue' THEN ARRAY['turns']
  WHEN 'listening' THEN ARRAY['transcript','audio','exercise']
  WHEN 'transform' THEN ARRAY['source','accepted_answers','needs_article'] ELSE NULL END;
 IF allowed IS NULL OR NOT path_private.only_keys(p_content,common_keys||allowed)
  OR (p_content ? 'needs_article' AND jsonb_typeof(p_content->'needs_article')<>'boolean') THEN RETURN false; END IF;
 IF NOT path_private.german_task_allowed(p_content) THEN RETURN false; END IF;
 IF p_type::text IN ('multiple_choice','fill_in_blank','sentence_building','transform') THEN
  IF NOT path_private.valid_strings(p_content->'accepted_answers',1,true) THEN RETURN false; END IF;
  IF p_type<>'transform' THEN
   IF jsonb_array_length(p_content->'accepted_answers')>21 OR EXISTS(SELECT 1
    FROM jsonb_array_elements_text(p_content->'accepted_answers') answer WHERE length(answer)>1000) THEN RETURN false; END IF;
   IF NOT path_private.valid_text(p_content->'correct_answer') OR NOT EXISTS(SELECT 1
    FROM jsonb_array_elements_text(p_content->'accepted_answers') answer
    WHERE path_private.text_key(answer)=path_private.text_key(p_content->>'correct_answer')) THEN RETURN false; END IF;
  END IF;
 END IF;
 CASE p_type::text
 WHEN 'multiple_choice' THEN
  IF NOT path_private.valid_text(p_content->'question') OR NOT path_private.valid_strings(p_content->'options',2,true)
   OR jsonb_array_length(p_content->'accepted_answers')<>1 THEN RETURN false; END IF;
  RETURN EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_content->'options') answer
   WHERE path_private.text_key(answer)=path_private.text_key(p_content->>'correct_answer'));
 WHEN 'fill_in_blank' THEN
  RETURN path_private.valid_text(p_content->'text_before',4000,true) AND path_private.valid_text(p_content->'text_after',4000,true)
   AND path_private.valid_text(to_jsonb((p_content->>'text_before')||(p_content->>'text_after')),8000)
   AND (NOT p_content ? 'options' OR (path_private.valid_strings(p_content->'options',2,true)
    AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_content->'options') answer
     WHERE path_private.text_key(answer)=path_private.text_key(p_content->>'correct_answer'))));
 WHEN 'sentence_building' THEN RETURN path_private.valid_strings(p_content->'parts');
 WHEN 'transform' THEN RETURN path_private.valid_text(p_content->'source');
 WHEN 'listening' THEN
  RETURN path_private.valid_text(p_content->'transcript',3000) AND path_private.only_keys(p_content->'audio',ARRAY['normal','slow'])
   AND path_private.valid_local_audio(p_content#>'{audio,normal}') AND path_private.valid_local_audio(p_content#>'{audio,slow}')
   AND path_private.only_keys(p_content->'exercise',ARRAY['type','content'])
   AND coalesce(p_content#>>'{exercise,type}' IN ('multiple_choice','fill_in_blank'),false)
   AND path_private.valid_content((p_content#>>'{exercise,type}')::public.exercise_type,p_content#>'{exercise,content}');
 WHEN 'multi_blank' THEN
  IF NOT path_private.valid_text(p_content->'text') THEN RETURN false; END IF;
  items:=p_content->'blanks';
 WHEN 'matching' THEN items:=p_content->'pairs';
 WHEN 'categorize' THEN
  items:=p_content->'categories';
  IF jsonb_typeof(items) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(items) NOT BETWEEN 2 AND 128 THEN RETURN false; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
   IF NOT path_private.only_keys(item,ARRAY['id','label']) OR NOT path_private.valid_text(item->'id',100)
    OR NOT path_private.valid_text(item->'label') OR (item->>'id')=ANY(seen) THEN RETURN false; END IF;
   seen:=array_append(seen,item->>'id');
  END LOOP;
  left_values:=seen; seen:=ARRAY[]::text[]; items:=p_content->'items';
 WHEN 'dialogue' THEN items:=p_content->'turns';
 ELSE RETURN false;
 END CASE;
 IF jsonb_typeof(items) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 IF jsonb_array_length(items) NOT BETWEEN 1 AND 128 THEN RETURN false; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
  IF NOT path_private.valid_text(item->'id',100) OR (item->>'id')=ANY(seen) THEN RETURN false; END IF;
  seen:=array_append(seen,item->>'id');
  CASE p_type::text
  WHEN 'multi_blank' THEN
   IF NOT path_private.only_keys(item,ARRAY['id','label','accepted_answers','needs_article'])
    OR NOT path_private.valid_strings(item->'accepted_answers',1,true)
    OR (item ? 'label' AND NOT path_private.valid_text(item->'label'))
    OR (item ? 'needs_article' AND jsonb_typeof(item->'needs_article')<>'boolean') THEN RETURN false; END IF;
  WHEN 'matching' THEN
   IF NOT path_private.only_keys(item,ARRAY['id','left','right']) OR NOT path_private.valid_text(item->'left')
    OR NOT path_private.valid_text(item->'right') OR path_private.text_key(item->>'left')=ANY(left_values)
    OR path_private.text_key(item->>'right')=ANY(right_values) THEN RETURN false; END IF;
   left_values:=array_append(left_values,path_private.text_key(item->>'left'));
   right_values:=array_append(right_values,path_private.text_key(item->>'right'));
  WHEN 'categorize' THEN
   IF NOT path_private.only_keys(item,ARRAY['id','text','category_id']) OR NOT path_private.valid_text(item->'text')
    OR NOT path_private.valid_text(item->'category_id',100) OR NOT (item->>'category_id')=ANY(left_values) THEN RETURN false; END IF;
  WHEN 'dialogue' THEN
   IF NOT path_private.valid_text(item->'speaker') OR NOT path_private.valid_text(item->'prompt') THEN RETURN false; END IF;
   IF item->>'type'='multiple_choice' THEN
    IF NOT path_private.only_keys(item,ARRAY['id','speaker','prompt','type','options','correct_answer'])
     OR NOT path_private.valid_strings(item->'options',2,true) OR NOT path_private.valid_text(item->'correct_answer')
     OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(item->'options') answer WHERE path_private.text_key(answer)=path_private.text_key(item->>'correct_answer')) THEN RETURN false; END IF;
   ELSIF item->>'type'='fill_in_blank' THEN
    IF NOT path_private.only_keys(item,ARRAY['id','speaker','prompt','type','accepted_answers','needs_article'])
     OR NOT path_private.valid_strings(item->'accepted_answers',1,true)
     OR (item ? 'needs_article' AND jsonb_typeof(item->'needs_article')<>'boolean') THEN RETURN false; END IF;
   ELSE RETURN false; END IF;
  END CASE;
 END LOOP;
 RETURN true;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END $$;


--
-- Name: valid_local_audio(jsonb); Type: FUNCTION; Schema: path_private; Owner: -
--

CREATE FUNCTION path_private.valid_local_audio(p_value jsonb) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $_$
 SELECT path_private.valid_text(p_value) AND (p_value#>>'{}') LIKE '/%'
  AND (p_value#>>'{}') NOT LIKE '//%' AND (p_value#>>'{}') NOT LIKE E'%\\\\%'
  AND (p_value#>>'{}') !~ '(^|[/?#])\.\.([/?#]|$)'
  AND (p_value#>>'{}') !~* '%(2e|2f|5c)'
  AND (p_value#>>'{}') !~ U&'[\0001-\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF]'
  AND (p_value#>>'{}') !~ '^[a-zA-Z][a-zA-Z0-9+.-]*:'
$_$;


--
-- Name: valid_seed_shape(jsonb); Type: FUNCTION; Schema: path_private; Owner: -
--

CREATE FUNCTION path_private.valid_seed_shape(p_path jsonb) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $_$
DECLARE n jsonb; e jsonb; o jsonb; card jsonb; lang text; translated jsonb;
 node_ids text[]:='{}'; objective_ids text[]:='{}'; exercise_ids text[]:='{}'; refs text[]:='{}'; node_orders integer[]:='{}';
BEGIN
 IF NOT path_private.only_keys(p_path,ARRAY['id','level','path','slug','title','translations','unit','objectives','nodes','is_active'])
  OR NOT path_private.valid_text(p_path->'id',100) OR NOT path_private.valid_text(p_path->'title')
  OR NOT path_private.valid_text(p_path->'slug',160) OR (p_path->>'slug') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  OR coalesce(p_path->>'level' NOT IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2'),true)
  OR jsonb_typeof(p_path->'path') IS DISTINCT FROM 'number' OR (p_path->>'path') !~ '^[1-9][0-9]*$'
  OR (p_path ? 'is_active' AND jsonb_typeof(p_path->'is_active')<>'boolean')
  OR NOT path_private.only_keys(p_path->'unit',ARRAY['level','trainer','label','sort_order'])
  OR NOT path_private.valid_text(p_path->'unit'->'label') OR p_path->'unit'->'sort_order' IS DISTINCT FROM p_path->'path'
  OR (p_path->'unit'->>'trainer') IS DISTINCT FROM 'exercises' OR p_path->'unit'->'level' IS DISTINCT FROM p_path->'level'
  OR NOT path_private.only_keys(p_path->'translations',ARRAY['en','ru','uk','tr'])
  OR jsonb_typeof(p_path->'objectives') IS DISTINCT FROM 'array' OR jsonb_typeof(p_path->'nodes') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 IF jsonb_array_length(p_path->'objectives') NOT BETWEEN 1 AND 128 OR jsonb_array_length(p_path->'nodes')<3 THEN RETURN false; END IF;
 FOR lang IN SELECT unnest(ARRAY['en','ru','uk','tr']) LOOP
  IF NOT path_private.only_keys(p_path->'translations'->lang,ARRAY['title'])
   OR NOT path_private.valid_text(p_path->'translations'->lang->'title') THEN RETURN false; END IF;
 END LOOP;
 FOR o IN SELECT value FROM jsonb_array_elements(p_path->'objectives') LOOP
  IF NOT path_private.only_keys(o,ARRAY['id','area','description']) OR NOT path_private.valid_text(o->'id',100)
   OR NOT path_private.valid_text(o->'description') OR coalesce(o->>'area' NOT IN('grammar','communication','can_do','vocabulary'),true)
   OR o->>'id'=ANY(objective_ids) THEN RETURN false; END IF;
  objective_ids:=array_append(objective_ids,o->>'id');
 END LOOP;
 FOR n IN SELECT value FROM jsonb_array_elements(p_path->'nodes') LOOP
  IF NOT path_private.only_keys(n,ARRAY['id','kind','sort_order','is_active','topic','title','translations','goals','merkkarte','test_size','anchor_node_id','exercises'])
   OR NOT path_private.valid_text(n->'id',100) OR NOT path_private.valid_text(n->'title') OR NOT path_private.valid_text(n->'topic')
   OR coalesce(n->>'kind' NOT IN('practice','review','test','special'),true)
   OR jsonb_typeof(n->'sort_order') IS DISTINCT FROM 'number' OR (n->>'sort_order') !~ '^[1-9][0-9]*$'
   OR n->>'id'=ANY(node_ids) OR (n->>'sort_order')::integer=ANY(node_orders)
   OR (n ? 'is_active' AND jsonb_typeof(n->'is_active')<>'boolean')
   OR NOT path_private.valid_strings(n->'goals') OR NOT path_private.only_keys(n->'translations',ARRAY['en','ru','uk','tr'])
   OR jsonb_typeof(n->'exercises') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(n->'exercises')<1 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(n->'goals') g WHERE length(g)>100 OR NOT g=ANY(objective_ids))
   OR (SELECT count(*)<>count(DISTINCT value) FROM jsonb_array_elements_text(n->'goals')) THEN RETURN false; END IF;
  IF (n->>'kind'='test') IS DISTINCT FROM (n ? 'test_size') OR (n->>'kind'='special') IS DISTINCT FROM (n ? 'anchor_node_id')
   OR (n ? 'anchor_node_id' AND NOT path_private.valid_text(n->'anchor_node_id',100))
   OR (n ? 'test_size' AND (jsonb_typeof(n->'test_size')<>'number' OR (n->>'test_size') !~ '^[1-9][0-9]*$' OR (n->>'test_size')::integer>128))
   OR (n->>'kind'='test' AND n ? 'merkkarte') OR (n->>'kind'='practice' AND NOT n ? 'merkkarte') THEN RETURN false; END IF;
  node_ids:=array_append(node_ids,n->>'id'); node_orders:=array_append(node_orders,(n->>'sort_order')::integer);
  card:=n->'merkkarte';
  IF n ? 'merkkarte' THEN
   IF NOT path_private.only_keys(card,ARRAY['card','rule','examples','highlight','translations'])
    OR NOT path_private.valid_text(card->'card',100) OR NOT path_private.valid_text(card->'rule')
    OR NOT path_private.valid_strings(card->'examples') OR NOT card ? 'highlight'
    OR (card->'highlight'<>'null'::jsonb AND coalesce(card->>'highlight' NOT IN('article','verb'),true))
    OR NOT path_private.only_keys(card->'translations',ARRAY['en','ru','uk','tr']) THEN RETURN false; END IF;
  END IF;
  FOR lang IN SELECT unnest(ARRAY['en','ru','uk','tr']) LOOP
   IF NOT path_private.only_keys(n->'translations'->lang,ARRAY['title']) OR NOT path_private.valid_text(n->'translations'->lang->'title') THEN RETURN false; END IF;
   IF card IS NOT NULL AND (NOT path_private.only_keys(card->'translations'->lang,ARRAY['rule']) OR NOT path_private.valid_text(card->'translations'->lang->'rule')) THEN RETURN false; END IF;
  END LOOP;
  FOR e IN SELECT value FROM jsonb_array_elements(n->'exercises') LOOP
   IF NOT path_private.only_keys(e,ARRAY['id','ref','goal','exercise_type','content','accepted_answers','hint','explanation','explanation_card','translations'])
    OR NOT path_private.valid_text(e->'id') OR (e->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR e->>'id'=ANY(exercise_ids) OR NOT path_private.valid_text(e->'ref',100) OR e->>'ref'=ANY(refs)
    OR NOT path_private.valid_text(e->'goal',100) OR NOT (n->'goals') ? (e->>'goal')
    OR NOT path_private.valid_text(e->'hint') OR NOT path_private.valid_text(e->'explanation') OR NOT path_private.valid_text(e->'explanation_card',100)
    OR NOT learning_private.german_text_allowed((e->>'hint')||(e->>'explanation'))
    OR NOT path_private.only_keys(e->'translations',ARRAY['en','ru','uk','tr'])
    OR NOT path_private.valid_content((e->>'exercise_type')::public.exercise_type,e->'content')
    OR (e ? 'accepted_answers' AND e->'accepted_answers' IS DISTINCT FROM e->'content'->'accepted_answers') THEN RETURN false; END IF;
   exercise_ids:=array_append(exercise_ids,e->>'id'); refs:=array_append(refs,e->>'ref');
   FOR lang IN SELECT unnest(ARRAY['en','ru','uk','tr']) LOOP
    translated:=e->'translations'->lang;
    IF NOT path_private.only_keys(translated,ARRAY['instruction','hint','explanation','prompt'])
     OR NOT path_private.valid_text(translated->'instruction') OR NOT path_private.valid_text(translated->'hint') OR NOT path_private.valid_text(translated->'explanation')
     OR (translated ? 'prompt' AND NOT path_private.valid_text(translated->'prompt')) THEN RETURN false; END IF;
   END LOOP;
  END LOOP;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(n->'goals') g WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(n->'exercises') ex WHERE ex->>'goal'=g)) THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END $_$;


--
-- Name: valid_strings(jsonb, integer, boolean); Type: FUNCTION; Schema: path_private; Owner: -
--

CREATE FUNCTION path_private.valid_strings(p_value jsonb, p_min integer DEFAULT 1, p_unique boolean DEFAULT false) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $$
BEGIN
 IF jsonb_typeof(p_value) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 IF jsonb_array_length(p_value) NOT BETWEEN p_min AND 128 OR EXISTS(
  SELECT 1 FROM jsonb_array_elements(p_value) item WHERE NOT path_private.valid_text(item)) THEN RETURN false; END IF;
 RETURN NOT p_unique OR (SELECT count(*)=count(DISTINCT path_private.text_key(item)) FROM jsonb_array_elements_text(p_value) item);
END $$;


--
-- Name: valid_text(jsonb, integer, boolean); Type: FUNCTION; Schema: path_private; Owner: -
--

CREATE FUNCTION path_private.valid_text(p_value jsonb, p_max integer DEFAULT 4000, p_empty boolean DEFAULT false) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
 SELECT coalesce(jsonb_typeof(p_value)='string' AND length(p_value#>>'{}')<=p_max AND strpos(p_value#>>'{}',U&'\FEFF')=0
  AND (p_empty OR length(btrim(p_value#>>'{}',U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'))>0),false)
$$;


--
-- Name: without_null_fields(jsonb); Type: FUNCTION; Schema: path_private; Owner: -
--

CREATE FUNCTION path_private.without_null_fields(p_value jsonb) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
 SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) FROM jsonb_each(p_value) WHERE value<>'null'::jsonb;
$$;


--
-- Name: require_rpc_success(jsonb); Type: FUNCTION; Schema: platform_private; Owner: -
--

CREATE FUNCTION platform_private.require_rpc_success(p_result jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
BEGIN
 IF jsonb_typeof(p_result)='object' AND p_result ? 'error' THEN
  RAISE EXCEPTION USING ERRCODE=CASE WHEN p_result->>'sqlstate' ~ '^[A-Z0-9]{5}$'
    AND p_result->>'sqlstate'<>'00000' THEN p_result->>'sqlstate' ELSE 'P0001' END,
   MESSAGE=coalesce(p_result->>'error','request_failed'),DETAIL=p_result::text;
 END IF;
END $_$;


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: platform_private; Owner: -
--

CREATE FUNCTION platform_private.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
 NEW.updated_at := now();
 RETURN NEW;
END $$;


--
-- Name: can_access_submission(uuid); Type: FUNCTION; Schema: pronunciation_private; Owner: -
--

CREATE FUNCTION pronunciation_private.can_access_submission(p_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS (
   SELECT 1 FROM public.submissions s WHERE s.id=p_id AND
   ((SELECT identity_private.current_profile_role()) IN ('teacher','admin') OR
    (s.auth_user_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.learning_reading_texts r WHERE r.id=s.prompt_id AND learning_private.unit_allowed(r.unit_id))))
 );
$$;


--
-- Name: create_submission(uuid, text); Type: FUNCTION; Schema: pronunciation_private; Owner: -
--

CREATE FUNCTION pronunciation_private.create_submission(p_prompt_id uuid, p_audio_path text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid := (SELECT auth.uid()); prompt public.learning_reading_texts%ROWTYPE; unit public.learning_units; result uuid;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 SELECT * INTO prompt FROM public.learning_reading_texts WHERE id=p_prompt_id;
 IF NOT FOUND OR NOT learning_private.unit_allowed(prompt.unit_id) THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO unit FROM public.learning_units WHERE id=prompt.unit_id AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'inactive_content' USING ERRCODE='42501'; END IF;
 IF p_audio_path NOT LIKE 'storage://pronunciation_audio/' || actor::text || '/%' OR NOT EXISTS(
 SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'pronunciation_audio' AND 'storage://pronunciation_audio/' || o.name = p_audio_path)
 THEN RAISE EXCEPTION 'Invalid recording'; END IF;
 INSERT INTO public.submissions(auth_user_id,type,content_url,text_content,status,level,prompt_id)
 VALUES(actor,'audio',p_audio_path,prompt.sentence_de,'pending',unit.level,prompt.id) RETURNING id INTO result;
 RETURN result;
END;
$$;


--
-- Name: mark_seen(uuid); Type: FUNCTION; Schema: pronunciation_private; Owner: -
--

CREATE FUNCTION pronunciation_private.mark_seen(p_submission_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
 IF NOT pronunciation_private.can_access_submission(p_submission_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 UPDATE public.pronunciation_messages SET seen_at = now()
 WHERE submission_id = p_submission_id AND sender_id <> (SELECT auth.uid()) AND seen_at IS NULL
 AND (CASE WHEN (SELECT identity_private.current_profile_role()) IN ('teacher','admin') THEN sender_role = 'student' ELSE sender_role IN ('teacher','admin') END);
END;
$$;


--
-- Name: update_conversation_status(); Type: FUNCTION; Schema: pronunciation_private; Owner: -
--

CREATE FUNCTION pronunciation_private.update_conversation_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NEW.sender_id <> (SELECT auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 UPDATE public.submissions SET status = (CASE WHEN NEW.sender_role IN ('teacher','admin') THEN 'reviewed' ELSE 'pending' END)::public.submission_status WHERE id = NEW.submission_id;
 RETURN NEW;
END;
$$;


--
-- Name: validate_message(); Type: FUNCTION; Schema: pronunciation_private; Owner: -
--

CREATE FUNCTION pronunciation_private.validate_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid := (SELECT auth.uid()); actual_role text;
BEGIN
 IF actor IS NULL OR NEW.sender_id <> actor OR NOT pronunciation_private.can_access_submission(NEW.submission_id) THEN
   RAISE EXCEPTION 'Not authorized';
 END IF;
 actual_role := (SELECT p.role FROM public.profiles p WHERE p.id = actor);
 NEW.sender_role := CASE WHEN actual_role IN ('teacher','admin') THEN actual_role ELSE 'student' END;
 NEW.created_at := now(); NEW.seen_at := NULL;
 IF NEW.audio_path IS NOT NULL AND (
   NEW.audio_path NOT LIKE 'storage://pronunciation_audio/' || actor::text || '/%'
   OR NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'pronunciation_audio' AND 'storage://pronunciation_audio/' || o.name = NEW.audio_path)
 ) THEN RAISE EXCEPTION 'Invalid recording'; END IF;
 RETURN NEW;
END;
$$;


--
-- Name: add_own_vocabulary(text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_own_vocabulary(p_level text, p_word_de text, p_article text, p_translation text, p_locale text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE boundary_state text; boundary_message text; boundary_code text;
BEGIN
 RETURN vocabulary_private.add_own_word(p_level,p_word_de,p_article,p_translation,p_locale);
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS boundary_state=RETURNED_SQLSTATE,boundary_message=MESSAGE_TEXT;
  boundary_code:=CASE WHEN boundary_message=ANY(ARRAY[
   'authentication_required','trainer_access_denied','invalid_language','own_word_exists','own_word_limit',
   'not_authorized','not_authenticated','invalid_input','request_failed','conflict','not_found'
  ]) THEN boundary_message
  WHEN boundary_state='42501' THEN 'not_authorized'
  WHEN boundary_state IN('23502','23503','23514','22P02','22023','22007') THEN 'invalid_input'
  WHEN boundary_state IN('23505','PT409','40001') THEN 'conflict'
  WHEN boundary_state='40P01' THEN 'retry_required'
  WHEN boundary_state IN('P0002','02000') THEN 'not_found'
  ELSE 'request_failed' END;
  RETURN jsonb_build_object('error',boundary_code,'message',CASE
   WHEN boundary_code='own_word_exists' THEN 'This word is already in your own words.'
   WHEN boundary_code='own_word_limit' THEN 'Your own words list is full.'
   WHEN boundary_state='42501' THEN 'The request is not authorized.'
   WHEN boundary_code IN('conflict','retry_required') THEN 'Reload and retry the request.'
   WHEN boundary_code='invalid_input' THEN 'The request contains invalid data.'
   ELSE 'The request could not be completed.' END,'sqlstate',boundary_state);
END $$;


--
-- Name: begin_learning_reset(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.begin_learning_reset(p_confirmation text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
RETURN to_jsonb((SELECT learning_reset_private.begin_reset(p_confirmation)));
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


--
-- Name: begin_vocabulary_level(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.begin_vocabulary_level(p_target_level text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=(SELECT auth.uid()); state jsonb; moment timestamptz:=clock_timestamp();
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 state:=public.get_vocabulary_carryover(p_target_level); PERFORM platform_private.require_rpc_success(state);
 INSERT INTO public.vocabulary_carryover_preferences(auth_user_id,target_level,started_at,decided_at)
 VALUES(actor,p_target_level,moment,CASE WHEN jsonb_array_length(state->'cards')=0 THEN moment END)
 ON CONFLICT(auth_user_id,target_level) DO UPDATE SET
  started_at=CASE WHEN vocabulary_carryover_preferences.is_active THEN coalesce(vocabulary_carryover_preferences.started_at,moment) ELSE moment END,
  decided_at=CASE WHEN vocabulary_carryover_preferences.is_active THEN coalesce(vocabulary_carryover_preferences.decided_at,
   CASE WHEN vocabulary_carryover_preferences.started_at IS NULL AND jsonb_array_length(state->'cards')=0 THEN moment END)
   ELSE CASE WHEN jsonb_array_length(state->'cards')=0 THEN moment END END,
  enabled=CASE WHEN vocabulary_carryover_preferences.is_active THEN vocabulary_carryover_preferences.enabled ELSE false END,is_active=true;
 RETURN public.get_vocabulary_carryover(p_target_level);
EXCEPTION WHEN OTHERS THEN RETURN vocabulary_private.carryover_error(SQLERRM,SQLSTATE); END $$;


--
-- Name: check_vocabulary_retry(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_vocabulary_retry(p_progress_id uuid, p_typed_answer text, p_ui_language text DEFAULT 'de'::text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE boundary_state text; boundary_message text; boundary_code text;
BEGIN
 RETURN to_jsonb((SELECT vocabulary_private.check_retry_answer(p_progress_id,p_typed_answer,p_ui_language)));
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS boundary_state=RETURNED_SQLSTATE,boundary_message=MESSAGE_TEXT;
  boundary_code:=CASE WHEN boundary_message=ANY(ARRAY[
   'authentication_required','trainer_access_denied','invalid_language','answer_required','answer_too_long',
   'progress_not_found','retry_not_available','exercise_unavailable','sentence_content_missing',
   'not_authorized','not_authenticated','invalid_input','request_failed','conflict','not_found'
  ]) THEN boundary_message
  WHEN boundary_state='42501' THEN 'not_authorized'
  WHEN boundary_state IN('23502','23503','23514','22P02','22023','22007') THEN 'invalid_input'
  WHEN boundary_state IN('23505','PT409','40001') THEN 'conflict'
  WHEN boundary_state='40P01' THEN 'retry_required'
  WHEN boundary_state IN('P0002','02000') THEN 'not_found'
  ELSE 'request_failed' END;
  RETURN jsonb_build_object('error',boundary_code,'message',CASE
   WHEN boundary_code='retry_not_available' THEN 'Answer the scheduled review of this card first.'
   WHEN boundary_state='42501' THEN 'The request is not authorized.'
   WHEN boundary_code IN('conflict','retry_required') THEN 'Reload and retry the request.'
   WHEN boundary_code='invalid_input' THEN 'The request contains invalid data.'
   ELSE 'The request could not be completed.' END,'sqlstate',boundary_state);
END $$;


--
-- Name: check_vocabulary_retry(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_vocabulary_retry(p_progress_id uuid, p_typed_answer text, p_ui_language text, p_target_level text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN RETURN vocabulary_private.check_retry_answer(p_progress_id,p_typed_answer,p_ui_language,p_target_level);
EXCEPTION WHEN OTHERS THEN RETURN vocabulary_private.carryover_error(SQLERRM,SQLSTATE); END $$;


--
-- Name: claim_mail_jobs(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_mail_jobs(p_worker_id uuid, p_limit integer DEFAULT 5) RETURNS jsonb
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


--
-- Name: claim_verified_person(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_verified_person() RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
RETURN to_jsonb((SELECT business_private.claim_person()));
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


--
-- Name: complete_mail_job(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_mail_job(p_id uuid, p_lease_token uuid, p_message_id text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN

DECLARE n integer;
BEGIN
  UPDATE private.mail_outbox SET status='sent',sent_at=now(),message_id=left(p_message_id,300),
    lease_token=NULL,lease_until=NULL,worker_id=NULL,last_error=NULL
    WHERE id=p_id AND status='processing' AND lease_token=p_lease_token AND lease_until>now();
  GET DIAGNOSTICS n=ROW_COUNT; RETURN to_jsonb(n=1);
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


--
-- Name: complete_media_upload(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_media_upload(p_payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE asset uuid; folder uuid; path text; mime text; size bigint; title text; filename text;
  target public.lms_media_folder; old_video public.learning_videos; old_presentation public.lms_presentation_asset;
BEGIN
 IF NOT business_private.is_staff() THEN
  RETURN jsonb_build_object('error','not_authorized','message','Staff access required.');
 END IF;
 asset:=(p_payload->>'asset_id')::uuid; folder:=(p_payload->>'folder_id')::uuid;
 path:=p_payload->>'storage_path'; mime:=p_payload->>'mime_type'; size:=(p_payload->>'file_size')::bigint;
 title:=btrim(p_payload->>'title'); filename:=btrim(p_payload->>'file_name');
 IF asset IS NULL OR folder IS NULL OR path IS NULL OR mime IS NULL OR size IS NULL OR size<=0 OR size>536870912
 OR title IS NULL OR length(title) NOT BETWEEN 1 AND 180 OR filename IS NULL OR length(filename) NOT BETWEEN 1 AND 255 THEN
  RETURN jsonb_build_object('error','invalid_input','message','Valid file metadata is required.');
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('media-asset:'||asset::text,0));
 SELECT * INTO target FROM public.lms_media_folder WHERE folder_id=folder FOR SHARE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found','message','Folder is unavailable.'); END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='course-assets' AND name=path
   AND (metadata->>'size')::bigint=size AND metadata->>'mimetype'=mime) THEN
  RETURN jsonb_build_object('error','invalid_input','message','The completed upload does not match its metadata.');
 END IF;
 -- Exact filename, MIME, path, object ID and size are also verified by the existing asset trigger.
 IF mime IN('video/mp4','video/webm') THEN
  SELECT * INTO old_video FROM public.learning_videos WHERE id=asset;
  IF FOUND THEN
   IF old_video.folder_id IS DISTINCT FROM folder OR old_video.storage_path IS DISTINCT FROM path OR old_video.file_size IS DISTINCT FROM size THEN
    RETURN jsonb_build_object('error','conflict','message','File identifier already exists.');
   END IF;
  ELSE
   INSERT INTO public.learning_units(id,level,trainer,label,is_active) VALUES(asset,target.level,'videos',title,true);
   INSERT INTO public.learning_videos(id,unit_id,folder_id,title,storage_path,file_size)
    VALUES(asset,asset,folder,title,path,size);
  END IF;
 ELSIF mime IN('application/pdf','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.apple.keynote') THEN
  SELECT * INTO old_presentation FROM public.lms_presentation_asset WHERE asset_id=asset;
  IF FOUND THEN
   IF old_presentation.folder_id IS DISTINCT FROM folder OR old_presentation.storage_path IS DISTINCT FROM path
     OR old_presentation.file_size IS DISTINCT FROM size OR old_presentation.mime_type IS DISTINCT FROM mime THEN
    RETURN jsonb_build_object('error','conflict','message','File identifier already exists.');
   END IF;
  ELSE
   INSERT INTO public.lms_presentation_asset(asset_id,folder_id,file_name,storage_path,mime_type,file_size)
    VALUES(asset,folder,filename,path,mime,size);
  END IF;
 ELSE RETURN jsonb_build_object('error','invalid_input','message','Unsupported media format.');
 END IF;
 RETURN jsonb_build_object('asset_id',asset);
EXCEPTION
 WHEN invalid_text_representation OR check_violation OR not_null_violation OR foreign_key_violation THEN
  RETURN jsonb_build_object('error','invalid_input','message','The completed upload does not match its metadata.');
 WHEN unique_violation THEN RETURN jsonb_build_object('error','conflict','message','File identifier already exists.');
 WHEN OTHERS THEN RETURN jsonb_build_object('error','request_failed','message','The upload could not be published.');
END $$;


--
-- Name: confirm_business_booking(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_business_booking(p_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
PERFORM business_private.confirm_booking(p_id);
 RETURN 'null'::jsonb;
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


--
-- Name: consume_rate_limit(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN

DECLARE v_count integer; v_reset timestamptz; v_now timestamptz:=clock_timestamp();
BEGIN
  IF p_key IS NULL OR p_key !~ '^[a-f0-9]{64}$'
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 10000
    OR p_window_seconds IS NULL OR p_window_seconds NOT BETWEEN 1 AND 86400 THEN
    RAISE EXCEPTION 'Invalid rate limit parameters';
  END IF;
  INSERT INTO platform_private.rate_limits AS r(key_hash,count,expires_at)
  VALUES(p_key,1,v_now+make_interval(secs=>p_window_seconds))
  ON CONFLICT(key_hash) DO UPDATE SET
    count=CASE WHEN r.expires_at<=v_now THEN 1 ELSE LEAST(r.count+1,p_limit+1) END,
    expires_at=CASE WHEN r.expires_at<=v_now THEN excluded.expires_at ELSE r.expires_at END
  RETURNING r.count,r.expires_at INTO v_count,v_reset;
  RETURN jsonb_build_array(jsonb_build_object('success',v_count<=p_limit,'remaining',GREATEST(0,p_limit-v_count),'reset_at',v_reset));
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
$_$;


--
-- Name: create_pronunciation_submission(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_pronunciation_submission(p_prompt_id uuid, p_audio_path text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
RETURN to_jsonb((SELECT pronunciation_private.create_submission(p_prompt_id,p_audio_path)));
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


--
-- Name: decline_business_booking(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decline_business_booking(p_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
PERFORM business_private.decline_booking(p_id);
 RETURN 'null'::jsonb;
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


--
-- Name: delete_course_exception(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_course_exception(p_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
RETURN to_jsonb((SELECT business_private.delete_course_exception(p_id)));
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


--
-- Name: delete_learning_content(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_learning_content(p_trainer text, p_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
BEGIN
 IF coalesce((SELECT identity_private.current_profile_role()),'') NOT IN('teacher','admin') THEN RAISE EXCEPTION 'Staff required' USING ERRCODE='42501'; END IF;
 IF p_trainer='vocabulary' THEN DELETE FROM public.learning_vocabulary_cards WHERE id=p_id;
 ELSIF p_trainer='exercises' THEN DELETE FROM public.learning_exercises WHERE id=p_id;
 ELSIF p_trainer='pronunciation' THEN UPDATE public.learning_units SET is_active=false WHERE id=(SELECT unit_id FROM public.learning_reading_texts WHERE id=p_id);
 ELSIF p_trainer='videos' THEN DELETE FROM public.learning_videos WHERE id=p_id;
 ELSE RAISE EXCEPTION 'Invalid trainer' USING ERRCODE='23514'; END IF;
END;
 RETURN 'null'::jsonb;
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


--
-- Name: delete_own_vocabulary(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_own_vocabulary(p_card_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE boundary_state text; boundary_message text; boundary_code text;
BEGIN
 RETURN vocabulary_private.delete_own_word(p_card_id);
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS boundary_state=RETURNED_SQLSTATE,boundary_message=MESSAGE_TEXT;
  boundary_code:=CASE WHEN boundary_message=ANY(ARRAY[
   'authentication_required','not_authorized','not_authenticated','invalid_input','request_failed','conflict','not_found'
  ]) THEN boundary_message
  WHEN boundary_state='42501' THEN 'not_authorized'
  WHEN boundary_state IN('23502','23503','23514','22P02','22023','22007') THEN 'invalid_input'
  WHEN boundary_state IN('23505','PT409','40001') THEN 'conflict'
  WHEN boundary_state='40P01' THEN 'retry_required'
  WHEN boundary_state IN('P0002','02000') THEN 'not_found'
  ELSE 'request_failed' END;
  RETURN jsonb_build_object('error',boundary_code,'message',CASE
   WHEN boundary_state='42501' THEN 'The request is not authorized.'
   WHEN boundary_code IN('conflict','retry_required') THEN 'Reload and retry the request.'
   WHEN boundary_code='invalid_input' THEN 'The request contains invalid data.'
   ELSE 'The request could not be completed.' END,'sqlstate',boundary_state);
END $$;


--
-- Name: export_learning_path(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.export_learning_path(p_unit_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE u public.learning_units; payload jsonb; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF NOT business_private.is_staff() THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
 SELECT * INTO u FROM public.learning_units WHERE id=p_unit_id AND is_path;
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 SELECT jsonb_build_object('id',u.path_source_id,'level',u.level,'path',u.sort_order,'slug',u.path_slug,'title',u.path_title,'is_active',u.is_active,
  'unit',jsonb_build_object('level',u.level,'trainer','exercises','label',u.label,'sort_order',u.sort_order),
  'translations',coalesce((SELECT jsonb_object_agg(locale,jsonb_build_object('title',title)) FROM public.path_unit_translations WHERE unit_id=u.id AND locale<>'de'),'{}'::jsonb),
  'objectives',(SELECT jsonb_agg(jsonb_build_object('id',id,'area',area,'description',description) ORDER BY id) FROM public.path_objectives WHERE unit_id=u.id),
  'nodes',(SELECT jsonb_agg(path_private.without_null_fields(jsonb_build_object('id',n.source_id,'kind',n.kind,'sort_order',n.sort_order,'topic',n.topic,'title',n.title,'goals',to_jsonb(n.goals),
   'test_size',n.test_size,'anchor_node_id',(SELECT source_id FROM public.path_nodes WHERE id=n.anchor_node_id),
   'translations',(SELECT jsonb_object_agg(locale,jsonb_build_object('title',title)) FROM public.path_node_translations WHERE node_id=n.id AND locale<>'de'),
   'merkkarte',CASE WHEN n.merkkarte IS NULL THEN NULL ELSE n.merkkarte||jsonb_build_object('translations',(SELECT jsonb_object_agg(locale,jsonb_build_object('rule',rule)) FROM public.path_node_translations WHERE node_id=n.id AND locale<>'de')) END,
   'exercises',(SELECT jsonb_agg(path_private.without_null_fields(jsonb_build_object('id',e.id,'ref',e.source_ref,'goal',e.goal_id,'exercise_type',e.type,'content',e.content,
    'accepted_answers',e.content->'accepted_answers','hint',de.hint,'explanation',de.explanation,'explanation_card',e.explanation_card,
    'translations',(SELECT jsonb_object_agg(t.locale,path_private.without_null_fields(jsonb_build_object('instruction',t.instruction,'hint',t.hint,'explanation',t.explanation,'prompt',t.prompt))) FROM public.grammar_translations t WHERE t.exercise_id=e.id AND t.locale<>'de'))) ORDER BY e.sort_order,e.id)
    FROM public.learning_exercises e LEFT JOIN public.grammar_translations de ON de.exercise_id=e.id AND de.locale='de' WHERE e.node_id=n.id AND e.path_is_active))) ORDER BY n.sort_order) FROM public.path_nodes n WHERE n.unit_id=u.id AND n.is_active)) INTO payload;
 RETURN payload;
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;


--
-- Name: fail_mail_job(uuid, uuid, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fail_mail_job(p_id uuid, p_lease_token uuid, p_error text, p_permanent boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN

DECLARE n integer;
BEGIN
  UPDATE private.mail_outbox SET status=(CASE WHEN p_permanent OR attempts>=8 THEN 'failed' ELSE 'pending' END)::public.mail_status,
    available_at=now()+make_interval(secs=>least(21600,(30*power(2,greatest(attempts-1,0)))::integer)),
    last_error=left(p_error,200),lease_token=NULL,lease_until=NULL,worker_id=NULL
    WHERE id=p_id AND status='processing' AND lease_token=p_lease_token AND lease_until>now();
  GET DIAGNOSTICS n=ROW_COUNT; RETURN to_jsonb(n=1);
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


--
-- Name: finish_learning_reset(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finish_learning_reset(p_token uuid) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
RETURN to_jsonb((SELECT learning_reset_private.finish_reset(p_token)));
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


--
-- Name: finish_path_test(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finish_path_test(p_attempt_id uuid, p_locale text DEFAULT 'de'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid; a public.path_test_attempts; score integer; item record; grade jsonb; unit uuid; BEGIN
 actor:=path_private.check_actor(p_locale);
 SELECT * INTO a FROM public.path_test_attempts WHERE id=p_attempt_id AND auth_user_id=actor FOR UPDATE;
 IF a.id IS NULL OR NOT a.is_active THEN RAISE EXCEPTION 'attempt_unavailable' USING ERRCODE='42501'; END IF;
 IF NOT path_private.node_available(a.node_id) THEN RAISE EXCEPTION 'node_locked' USING ERRCODE='42501'; END IF;
 IF a.status NOT IN('active','completed') THEN RAISE EXCEPTION 'attempt_unavailable' USING ERRCODE='22023'; END IF;
 SELECT unit_id INTO unit FROM public.path_nodes WHERE id=a.node_id;
 IF a.status='active' THEN
  IF (SELECT count(*) FROM public.path_test_answers WHERE attempt_id=a.id)<>cardinality(a.selected_exercise_ids) THEN RAISE EXCEPTION 'answers_incomplete' USING ERRCODE='22023'; END IF;
  FOR item IN SELECT i.*,ans.answer FROM path_private.test_items i JOIN public.path_test_answers ans USING(attempt_id,exercise_id) WHERE i.attempt_id=a.id LOOP
   grade:=path_private.grade((item.snapshot->>'type')::public.exercise_type,item.snapshot->'content',item.answer);
   IF grade ? 'error' THEN grade:=jsonb_build_object('status','INCORRECT','correct',false); END IF;
   UPDATE public.path_test_answers SET result=grade WHERE attempt_id=a.id AND exercise_id=item.exercise_id;
  END LOOP;
  SELECT count(*) INTO score FROM public.path_test_answers WHERE attempt_id=a.id AND result->>'status' IN('EXACT','SOFT_ERROR');
  a.percentage:=100.0*score/cardinality(a.selected_exercise_ids);
  a.passed:=score*100>=cardinality(a.selected_exercise_ids)*80;
  UPDATE public.path_test_attempts SET status='completed',completed_at=clock_timestamp(),percentage=a.percentage,passed=a.passed WHERE id=a.id;
  IF a.passed THEN
   INSERT INTO public.path_node_progress(auth_user_id,node_id,status,completed_at) VALUES(actor,a.node_id,'completed',clock_timestamp())
   ON CONFLICT(auth_user_id,node_id) DO UPDATE SET is_active=true,status='completed',completed_at=coalesce(path_node_progress.completed_at,excluded.completed_at),updated_at=clock_timestamp();
  END IF;
 END IF;
 RETURN jsonb_build_object('attempt_id',a.id,'percentage',a.percentage,'passed',a.passed,
  'answers',(SELECT jsonb_agg(path_private.present(i.snapshot,p_locale)||jsonb_build_object('answer',ans.answer,'result',ans.result,'solution',path_private.solution(i.snapshot,p_locale)) ORDER BY i.position)
   FROM path_private.test_items i JOIN public.path_test_answers ans USING(attempt_id,exercise_id) WHERE i.attempt_id=a.id),
  'recommended_nodes',coalesce((SELECT jsonb_agg(n.id ORDER BY n.sort_order) FROM public.path_nodes n WHERE n.unit_id=unit AND n.is_active AND n.kind IN('practice','review')
   AND EXISTS(SELECT 1 FROM path_private.test_items i JOIN public.path_test_answers ans USING(attempt_id,exercise_id)
    WHERE i.attempt_id=a.id AND ans.result->>'status'='INCORRECT' AND i.snapshot->>'goal_id'=ANY(n.goals))),'[]'::jsonb));
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;


--
-- Name: get_all_students_progress_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_students_progress_data() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    result jsonb := '{}'::jsonb;
BEGIN
    IF NOT business_private.is_staff() THEN
        RETURN jsonb_build_object('error', 'not_authorized', 'message', 'Staff access required.');
    END IF;

    WITH totals AS (
        SELECT u.level, COUNT(e.id) as total_items
        FROM public.learning_units u
        JOIN public.learning_exercises e ON e.unit_id = u.id
        GROUP BY u.level
        UNION ALL
        SELECT u.level, COUNT(v.id) as total_items
        FROM public.learning_units u
        JOIN public.learning_vocabulary_cards v ON v.unit_id = u.id
        WHERE u.owner_auth_user_id IS NULL
        GROUP BY u.level
    ),
    level_totals AS (
        SELECT level, SUM(total_items) as total_items
        FROM totals
        GROUP BY level
    ),
    completed_exercises AS (
        SELECT p.auth_user_id, u.level, COUNT(p.exercise_id) as completed_items
        FROM public.user_exercise_progress p
        JOIN public.learning_exercises e ON e.id = p.exercise_id
        JOIN public.learning_units u ON u.id = e.unit_id
        WHERE p.completed = true
        GROUP BY p.auth_user_id, u.level
    ),
    learned_vocab AS (
        SELECT p1.auth_user_id, p1.card_id
        FROM public.vocabulary_direction_progress p1
        JOIN public.vocabulary_direction_progress p2
          ON p1.auth_user_id = p2.auth_user_id AND p1.card_id = p2.card_id
        WHERE p1.direction = 'de_to_native' AND p1.box_number = 7
          AND p2.direction = 'native_to_de' AND p2.box_number = 7
    ),
    completed_vocab AS (
        SELECT lv.auth_user_id, u.level, COUNT(lv.card_id) as completed_items
        FROM learned_vocab lv
        JOIN public.learning_vocabulary_cards v ON v.id = lv.card_id
        JOIN public.learning_units u ON u.id = v.unit_id
        WHERE u.owner_auth_user_id IS NULL
        GROUP BY lv.auth_user_id, u.level
    ),
    user_level_completed AS (
        SELECT auth_user_id, level, SUM(completed_items) as total_completed
        FROM (
            SELECT * FROM completed_exercises
            UNION ALL
            SELECT * FROM completed_vocab
        ) sub
        GROUP BY auth_user_id, level
    ),
    user_percentages AS (
        SELECT
            users.auth_user_id,
            t.level,
            ROUND((COALESCE(c.total_completed, 0)::numeric / t.total_items) * 100) as percentage
        FROM (SELECT DISTINCT auth_user_id FROM user_level_completed) users
        CROSS JOIN level_totals t
        LEFT JOIN user_level_completed c ON c.auth_user_id = users.auth_user_id AND c.level = t.level
        WHERE t.total_items > 0
    )
    SELECT COALESCE(
        jsonb_object_agg(
            agg.auth_user_id::text,
            agg.levels_obj
        ),
        '{}'::jsonb
    ) INTO result
    FROM (
        SELECT
            auth_user_id,
            jsonb_object_agg(level, percentage) as levels_obj
        FROM user_percentages
        GROUP BY auth_user_id
    ) agg;

    RETURN result;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', 'request_failed',
        'message', 'Progress could not be loaded.', 'sqlstate', SQLSTATE);
END;
$$;


--
-- Name: get_all_students_progress_data(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_students_progress_data(p_student_id uuid, p_course_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
 selected_level text;
 percentages jsonb;
 distribution jsonb;
 history jsonb;
 today date := (now() AT TIME ZONE 'Europe/Berlin')::date;
BEGIN
 IF NOT business_private.is_staff() THEN
  RETURN jsonb_build_object('error','not_authorized','message','Staff access required.');
 END IF;
 IF p_student_id IS NULL THEN
  RETURN jsonb_build_object('error','invalid_input','message','A student is required.');
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_student_id AND role='student') THEN
  RETURN jsonb_build_object('error','not_found','message','Student not found.');
 END IF;
 IF p_course_id IS NOT NULL THEN
  SELECT level INTO selected_level FROM public.courses WHERE id=p_course_id;
  IF NOT FOUND THEN
   RETURN jsonb_build_object('error','not_found','message','Course not found.');
  END IF;
 END IF;
 percentages := public.get_all_students_progress_data();
 IF percentages ? 'error' THEN RETURN percentages; END IF;

 WITH cards AS (
  SELECT c.id, CASE WHEN count(p.id)=0 THEN NULL
   WHEN count(p.id)=2 AND bool_and(p.box_number=7) THEN 7
   ELSE least(6,min(p.box_number)) END AS phase
  FROM public.learning_vocabulary_cards c
  JOIN public.learning_units u ON u.id=c.unit_id
  LEFT JOIN public.vocabulary_direction_progress p ON p.card_id=c.id AND p.auth_user_id=p_student_id
  WHERE (p_course_id IS NULL OR u.level=selected_level) AND u.owner_auth_user_id IS NULL
  GROUP BY c.id
 ), buckets AS (
  SELECT phase_number, count(c.id) AS count
  FROM generate_series(1,7) phase_number LEFT JOIN cards c ON c.phase=phase_number
  GROUP BY phase_number
 ) SELECT jsonb_build_object(
  'buckets',(SELECT jsonb_agg(jsonb_build_object('key',CASE WHEN phase_number=7 THEN to_jsonb('learned'::text) ELSE to_jsonb(phase_number) END,'count',count) ORDER BY phase_number) FROM buckets),
  'totalCards',count(*),'totalInBox',count(phase),
  'overallPercent',CASE WHEN count(*)=0 THEN 0 ELSE round(coalesce(sum(phase),0)::numeric/(count(*)*7)*100) END
 ) INTO distribution FROM cards;

 WITH days AS (SELECT today-29+n AS day FROM generate_series(0,29) n),
 events AS (
  SELECT (r.created_at AT TIME ZONE 'Europe/Berlin')::date AS day,
   count(*) AS answers, count(*) FILTER(WHERE r.response->>'isCorrect'='true') AS correct
  FROM vocabulary_private.answer_receipts r
  JOIN public.vocabulary_direction_progress p ON p.id=r.progress_id AND p.auth_user_id=r.auth_user_id
  JOIN public.learning_vocabulary_cards c ON c.id=p.card_id
  JOIN public.learning_units u ON u.id=c.unit_id
  WHERE r.auth_user_id=p_student_id
   AND r.created_at>=((today-29)::timestamp AT TIME ZONE 'Europe/Berlin')
   AND r.created_at<((today+1)::timestamp AT TIME ZONE 'Europe/Berlin')
   AND (p_course_id IS NULL OR u.level=selected_level)
   AND u.owner_auth_user_id IS NULL
  GROUP BY (r.created_at AT TIME ZONE 'Europe/Berlin')::date
 ) SELECT jsonb_agg(jsonb_build_object('date',d.day,'answers',coalesce(e.answers,0),'correct',coalesce(e.correct,0)) ORDER BY d.day)
 INTO history FROM days d LEFT JOIN events e USING(day);

 RETURN jsonb_build_object('studentId',p_student_id,'courseId',p_course_id,'level',selected_level,
  'completionByLevel',coalesce(percentages->p_student_id::text,'{}'::jsonb),
  'distribution',distribution,'history',history,'timezone','Europe/Berlin');
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('error','request_failed','message','Learning analytics could not be loaded.','sqlstate',SQLSTATE);
END $$;


--
-- Name: get_last_active_level(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_last_active_level() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
 actor uuid:=(SELECT auth.uid());
 staff boolean;
 recent jsonb;
 fallback_level text;
 fallback_source text;
 boundary_state text;
BEGIN
 IF actor IS NULL THEN
  RETURN jsonb_build_object('error','authentication_required','message','Sign in to continue.','sqlstate','42501');
 END IF;
 SELECT p.role::text IN('teacher','admin') INTO staff FROM public.profiles p WHERE p.id=actor;
 staff:=coalesce(staff,false);

 WITH allowed AS (
  SELECT l.code AS level,l.sort_order FROM public.learning_levels l
  WHERE l.is_active AND (staff OR EXISTS(SELECT 1 FROM public.student_level_access a
   WHERE a.auth_user_id=actor AND a.level=l.code))
 ), activity AS (
  SELECT u.level,'vocabulary'::text AS mode,r.created_at AS at,u.label AS unit_label,NULL::text AS topic
  FROM vocabulary_private.answer_receipts r
  JOIN public.vocabulary_direction_progress v ON v.id=r.progress_id AND v.auth_user_id=actor
  JOIN public.learning_vocabulary_cards c ON c.id=v.card_id
  JOIN public.learning_units u ON u.id=c.unit_id
  WHERE r.auth_user_id=actor
  UNION ALL
  SELECT u.level,'vocabulary',v.last_answered_at,u.label,NULL
  FROM public.vocabulary_direction_progress v
  JOIN public.learning_vocabulary_cards c ON c.id=v.card_id
  JOIN public.learning_units u ON u.id=c.unit_id
  WHERE v.auth_user_id=actor AND v.last_answered_at IS NOT NULL
  UNION ALL
  SELECT u.level,'exercises',coalesce(p.updated_at,p.created_at),u.label,e.topic
  FROM public.user_exercise_progress p
  JOIN public.learning_exercises e ON e.id=p.exercise_id
  JOIN public.learning_units u ON u.id=e.unit_id
  WHERE p.auth_user_id=actor AND (coalesce(p.attempts,0)>0 OR coalesce(p.completed,false))
  UNION ALL
  SELECT s.level,'pronunciation',s.created_at,u.label,NULL
  FROM public.submissions s
  LEFT JOIN public.learning_reading_texts t ON t.id=s.prompt_id
  LEFT JOIN public.learning_units u ON u.id=t.unit_id
  WHERE s.auth_user_id=actor AND s.created_at IS NOT NULL

  UNION ALL
  SELECT u.level,'exercises',r.updated_at,u.label,n.title FROM public.path_practice_runs r
   JOIN public.path_nodes n ON n.id=r.node_id JOIN public.learning_units u ON u.id=n.unit_id
   WHERE r.auth_user_id=actor AND EXISTS(SELECT 1 FROM path_private.practice_items i WHERE i.run_id=r.id AND i.attempts>0)
  UNION ALL
  SELECT u.level,'exercises',coalesce(a.completed_at,ans.answered_at),u.label,n.title FROM public.path_test_attempts a
   JOIN public.path_nodes n ON n.id=a.node_id JOIN public.learning_units u ON u.id=n.unit_id
   JOIN public.path_test_answers ans ON ans.attempt_id=a.id WHERE a.auth_user_id=actor
 ), latest AS (
  -- Je Niveau die jüngste Handlung; bei Gleichstand entscheidet der Modus stabil.
  SELECT DISTINCT ON (a.level) a.level,a.mode,a.at,a.unit_label,a.topic,al.sort_order
  FROM activity a JOIN allowed al ON al.level=a.level
  WHERE a.at IS NOT NULL
  ORDER BY a.level,a.at DESC,a.mode
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('level',l.level,'mode',l.mode,'at',l.at,
   'unit_label',l.unit_label,'topic',l.topic) ORDER BY l.at DESC,l.sort_order),'[]'::jsonb)
 INTO recent FROM latest l;

 IF jsonb_array_length(recent)>0 THEN
  RETURN jsonb_build_object('level',recent->0->>'level','mode',recent->0->>'mode',
   'source','activity','levels',recent);
 END IF;

 SELECT l.code INTO fallback_level FROM public.learning_levels l
 WHERE l.is_active AND (staff OR EXISTS(SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=actor AND a.level=l.code))
  AND (EXISTS(SELECT 1 FROM public.vocabulary_direction_progress v
    JOIN public.learning_vocabulary_cards c ON c.id=v.card_id
    JOIN public.learning_units u ON u.id=c.unit_id
    WHERE v.auth_user_id=actor AND u.level=l.code)
   OR EXISTS(SELECT 1 FROM public.user_exercise_progress p
    JOIN public.learning_exercises e ON e.id=p.exercise_id
    JOIN public.learning_units u ON u.id=e.unit_id
    WHERE p.auth_user_id=actor AND u.level=l.code))
 ORDER BY l.sort_order,l.code LIMIT 1;
 IF fallback_level IS NOT NULL THEN
  fallback_source:='started';
 ELSE
  SELECT l.code INTO fallback_level FROM public.learning_levels l
  WHERE l.is_active AND (staff OR EXISTS(SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=actor AND a.level=l.code))
  ORDER BY l.sort_order,l.code LIMIT 1;
  fallback_source:=CASE WHEN fallback_level IS NULL THEN 'none' ELSE 'unlocked' END;
 END IF;
 RETURN jsonb_build_object('level',fallback_level,'mode',NULL,'source',fallback_source,'levels','[]'::jsonb);
EXCEPTION WHEN OTHERS THEN
 GET STACKED DIAGNOSTICS boundary_state=RETURNED_SQLSTATE;
 RETURN jsonb_build_object('error','request_failed','message','The request could not be completed.','sqlstate',boundary_state);
END
$$;


--
-- Name: get_learning_path(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_learning_path(p_level text, p_locale text DEFAULT 'de'::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=auth.uid(); paths jsonb; done boolean; next_level text; next_allowed boolean; BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_locale IS NULL OR p_locale NOT IN('de','en','ru','uk','tr') THEN RAISE EXCEPTION 'invalid_language' USING ERRCODE='22023'; END IF;
 IF NOT trainer_access_private.allowed(p_level,'exercises') THEN RAISE EXCEPTION 'path_locked' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',u.id,'source_id',u.path_source_id,'title',coalesce(t.title,u.path_title),'sort_order',u.sort_order,
  'available',path_private.unit_available(u.id),'completed',EXISTS(SELECT 1 FROM public.path_test_attempts a JOIN public.path_nodes n ON n.id=a.node_id WHERE n.unit_id=u.id AND a.auth_user_id=actor AND a.passed AND a.status='completed' AND a.is_active),
  'nodes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',n.id,'kind',n.kind,'title',coalesce(nt.title,n.title),'sort_order',n.sort_order,'anchor_node_id',n.anchor_node_id,
    'available',path_private.node_available(n.id),'status',p.status,'stars',coalesce(p.best_stars,0),'first_attempt_accuracy',p.first_attempt_accuracy,
    'tests',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'status',a.status,'percentage',a.percentage,'passed',a.passed,'completed_at',a.completed_at) ORDER BY a.created_at DESC) FROM public.path_test_attempts a WHERE a.node_id=n.id AND a.auth_user_id=actor),'[]'::jsonb)) ORDER BY n.sort_order)
   FROM public.path_nodes n LEFT JOIN public.path_node_translations nt ON nt.node_id=n.id AND nt.locale=p_locale LEFT JOIN public.path_node_progress p ON p.node_id=n.id AND p.auth_user_id=actor AND p.is_active WHERE n.unit_id=u.id AND n.is_active),'[]'::jsonb)) ORDER BY u.sort_order),'[]'::jsonb)
 INTO paths FROM public.learning_units u LEFT JOIN public.path_unit_translations t ON t.unit_id=u.id AND t.locale=p_locale
 WHERE u.level=p_level AND u.is_path AND u.is_active;
 done:=jsonb_array_length(paths)>0 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(paths) x WHERE NOT (x->>'completed')::boolean);
 SELECT n.code INTO next_level FROM public.learning_levels n JOIN public.learning_levels l ON l.code=p_level WHERE n.sort_order>l.sort_order AND n.is_active ORDER BY n.sort_order LIMIT 1;
 next_allowed:=EXISTS(SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=actor AND a.level=next_level);
 RETURN jsonb_build_object('level',p_level,'paths',paths,'completed',done,'next_level',next_level,'next_level_available',next_allowed);
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;


--
-- Name: get_teacher_dashboard_students(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_teacher_dashboard_students() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$ BEGIN
 IF auth.uid() IS NULL OR NOT business_private.is_staff() THEN RETURN jsonb_build_object('error','not_authorized'); END IF;
 RETURN jsonb_build_object('success',true,'students',teacher_dashboard_private.students());
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error','request_failed','sqlstate',SQLSTATE); END $$;


--
-- Name: get_teacher_student_detail(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_teacher_student_detail(p_student_id uuid, p_tab text DEFAULT 'overview'::text, p_locale text DEFAULT 'de'::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE data jsonb; today date:=(now() AT TIME ZONE 'Europe/Berlin')::date; BEGIN
 IF auth.uid() IS NULL OR NOT business_private.is_staff() THEN RETURN jsonb_build_object('error','not_authorized'); END IF;
 IF p_tab IS NULL OR p_tab NOT IN('overview','vocabulary','path','pronunciation','activity','notes') OR p_locale IS NULL OR p_locale NOT IN('de','en','ru','uk','tr') THEN RETURN jsonb_build_object('error','invalid_input'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_student_id) THEN RETURN jsonb_build_object('error','not_found'); END IF;
 IF p_tab='overview' THEN
  data:=teacher_dashboard_private.students(p_student_id)->0;
 ELSIF p_tab='vocabulary' THEN
  WITH cards AS MATERIALIZED (SELECT c.id,c.word_de,u.id unit_id,u.level,u.label title,
   CASE WHEN count(p.id)=0 THEN NULL WHEN count(p.id)=2 AND bool_and(p.box_number=7) THEN 7 ELSE least(6,min(p.box_number)) END phase,
   coalesce(jsonb_agg(p.box_number ORDER BY p.direction) FILTER(WHERE p.id IS NOT NULL),'[]') boxes,
   coalesce(sum(p.lapses),0) lapses,min(p.box_number)<>max(p.box_number) AND count(p.id)=2 half,
   EXISTS(SELECT 1 FROM public.vocabulary_lesson_pauses paused WHERE paused.auth_user_id=p_student_id AND paused.unit_id=u.id) paused
   FROM public.learning_vocabulary_cards c JOIN public.learning_units u ON u.id=c.unit_id AND u.is_active AND u.owner_auth_user_id IS NULL
   LEFT JOIN public.vocabulary_direction_progress p ON p.card_id=c.id AND p.auth_user_id=p_student_id
   WHERE EXISTS(SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=p_student_id AND a.level=u.level) OR p.id IS NOT NULL
   GROUP BY c.id,c.word_de,u.id,u.level,u.label),
  level_buckets AS (SELECT level,phase,count(*) n FROM cards WHERE phase IS NOT NULL GROUP BY level,phase),
  level_totals AS (SELECT level,count(*) total,count(phase) in_box FROM cards GROUP BY level),
  lesson_buckets AS (SELECT unit_id,phase,count(*) n FROM cards WHERE phase IS NOT NULL GROUP BY unit_id,phase),
  lesson_totals AS (SELECT unit_id,level,title,paused,count(*) total,count(phase) in_box FROM cards GROUP BY unit_id,level,title,paused),
  recent AS (SELECT r.request_id,c.word_de,u.level,r.typed_answer,r.response->>'isCorrect'='true' correct,r.created_at
   FROM vocabulary_private.answer_receipts r JOIN public.vocabulary_direction_progress p ON p.id=r.progress_id AND p.auth_user_id=p_student_id
   JOIN public.learning_vocabulary_cards c ON c.id=p.card_id JOIN public.learning_units u ON u.id=c.unit_id AND u.owner_auth_user_id IS NULL
   WHERE r.auth_user_id=p_student_id ORDER BY r.created_at DESC,r.request_id DESC LIMIT 50),
  carry AS (SELECT pref.target_level,pref.enabled,(SELECT count(*) FROM cards c JOIN public.learning_levels source ON source.code=c.level JOIN public.learning_levels target ON target.code=pref.target_level
   WHERE c.phase IS NOT NULL AND c.phase<7 AND NOT c.paused AND source.sort_order<target.sort_order)
   +(SELECT count(*) FROM (SELECT c.id FROM public.learning_vocabulary_cards c JOIN public.learning_units u ON u.id=c.unit_id AND u.owner_auth_user_id=p_student_id AND u.is_active
    JOIN public.learning_levels source ON source.code=u.level JOIN public.learning_levels target ON target.code=pref.target_level
    JOIN public.vocabulary_direction_progress p ON p.card_id=c.id AND p.auth_user_id=p_student_id
    WHERE source.sort_order<target.sort_order AND NOT EXISTS(SELECT 1 FROM public.vocabulary_lesson_pauses paused WHERE paused.auth_user_id=p_student_id AND paused.unit_id=u.id)
    GROUP BY c.id HAVING count(*) FILTER(WHERE p.box_number=7)<2) private_candidates) count
   FROM public.vocabulary_carryover_preferences pref WHERE pref.auth_user_id=p_student_id AND pref.is_active)
  SELECT jsonb_build_object(
   'byLevel',coalesce((SELECT jsonb_agg(jsonb_build_object('level',t.level,'phases',teacher_dashboard_private.phases((SELECT jsonb_object_agg(b.phase,b.n) FROM level_buckets b WHERE b.level=t.level)),'totalCards',t.total,'totalInBox',t.in_box) ORDER BY t.level) FROM level_totals t),'[]'),
   'byLesson',coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.unit_id,'level',t.level,'title',t.title,'paused',t.paused,'phases',teacher_dashboard_private.phases((SELECT jsonb_object_agg(b.phase,b.n) FROM lesson_buckets b WHERE b.unit_id=t.unit_id)),'totalCards',t.total,'totalInBox',t.in_box) ORDER BY t.level,t.title,t.unit_id) FROM lesson_totals t),'[]'),
   'halfKnown',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'word',word_de,'level',level,'boxes',boxes) ORDER BY level,word_de,id) FROM cards WHERE half),'[]'),
   'hardest',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'word',word_de,'level',level,'regressions',lapses) ORDER BY lapses DESC,id) FROM (SELECT * FROM cards WHERE lapses>0 ORDER BY lapses DESC,id LIMIT 20) hardest),'[]'),
   'recentAnswers',coalesce((SELECT jsonb_agg(jsonb_build_object('id',request_id,'word',word_de,'level',level,'typedAnswer',typed_answer,'correct',coalesce(correct,false),'createdAt',created_at) ORDER BY created_at DESC,request_id DESC) FROM recent),'[]'),
   'pausedLessons',coalesce((SELECT jsonb_agg(jsonb_build_object('id',unit_id,'level',level,'title',title) ORDER BY level,title,unit_id) FROM lesson_totals WHERE paused),'[]'),
   'carryover',coalesce((SELECT jsonb_agg(jsonb_build_object('level',target_level,'enabled',enabled,'count',count) ORDER BY target_level) FROM carry),'[]'),
   'ownWordCount',(SELECT count(*) FROM public.learning_vocabulary_cards c JOIN public.learning_units u ON u.id=c.unit_id WHERE u.owner_auth_user_id=p_student_id AND u.is_active)) INTO data;
 ELSIF p_tab='path' THEN
  SELECT jsonb_build_object('paths',coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'level',u.level,'title',coalesce(t.title,u.path_title),
   'available',teacher_dashboard_private.path_available(p_student_id,u.id),
   'completed',EXISTS(SELECT 1 FROM public.path_test_attempts a JOIN public.path_nodes n ON n.id=a.node_id WHERE a.auth_user_id=p_student_id AND n.unit_id=u.id AND a.is_active AND a.status='completed' AND a.passed),
   'nodes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',n.id,'kind',n.kind,'title',coalesce(nt.title,n.title),'sort_order',n.sort_order,
    'available',teacher_dashboard_private.node_available(p_student_id,n.id),'status',p.status,'stars',coalesce(p.best_stars,0)) ORDER BY n.sort_order)
   FROM public.path_nodes n LEFT JOIN public.path_node_translations nt ON nt.node_id=n.id AND nt.locale=p_locale
   LEFT JOIN public.path_node_progress p ON p.node_id=n.id AND p.auth_user_id=p_student_id AND p.is_active WHERE n.unit_id=u.id AND n.is_active),'[]')) ORDER BY l.sort_order,u.sort_order)
   FROM public.learning_units u JOIN public.learning_levels l ON l.code=u.level LEFT JOIN public.path_unit_translations t ON t.unit_id=u.id AND t.locale=p_locale WHERE u.is_path AND u.is_active),'[]'),
   'attempts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'nodeId',a.node_id,'unitId',n.unit_id,'title',coalesce(nt.title,n.title),'status',a.status,'isActive',a.is_active,
    'percentage',a.percentage,'passed',a.passed,'createdAt',a.created_at,'completedAt',a.completed_at,
    'answers',coalesce((SELECT jsonb_agg(jsonb_build_object('exerciseId',i.exercise_id,'position',i.position,'prompt',path_private.present(i.snapshot,p_locale),'answer',ans.answer,'result',ans.result,'solution',path_private.solution(i.snapshot,p_locale)) ORDER BY i.position)
    FROM path_private.test_items i LEFT JOIN public.path_test_answers ans USING(attempt_id,exercise_id) WHERE i.attempt_id=a.id),'[]')) ORDER BY a.created_at DESC,a.id DESC)
    FROM public.path_test_attempts a JOIN public.path_nodes n ON n.id=a.node_id LEFT JOIN public.path_node_translations nt ON nt.node_id=n.id AND nt.locale=p_locale WHERE a.auth_user_id=p_student_id),'[]'),
   'interventions',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'unitId',i.unit_id,'nodeId',i.node_id,'action',i.action,'createdAt',i.created_at,'createdBy',coalesce(p.display_name,i.created_by::text)) ORDER BY i.created_at DESC,i.id DESC)
   FROM public.path_interventions i LEFT JOIN public.people p ON p.auth_user_id=i.created_by WHERE i.auth_user_id=p_student_id),'[]')) INTO data;
 ELSIF p_tab='pronunciation' THEN
  WITH conversations AS (SELECT s.id,s.created_at,s.status,count(m.id) message_count,max(m.created_at) last_message,
    (SELECT count(*) FROM public.pronunciation_messages unanswered WHERE unanswered.submission_id=s.id AND unanswered.sender_role='student' AND unanswered.audio_path IS NOT NULL
     AND NOT EXISTS(SELECT 1 FROM public.pronunciation_messages reply WHERE reply.submission_id=s.id AND reply.sender_role IN('teacher','admin') AND reply.created_at>unanswered.created_at))
    +CASE WHEN s.content_url IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.pronunciation_messages reply WHERE reply.submission_id=s.id AND reply.sender_role IN('teacher','admin')) THEN 1 ELSE 0 END unanswered
   FROM public.submissions s LEFT JOIN public.pronunciation_messages m ON m.submission_id=s.id WHERE s.auth_user_id=p_student_id AND s.type='audio' GROUP BY s.id)
  SELECT jsonb_build_object('conversations',coalesce(jsonb_agg(jsonb_build_object('id',id,'createdAt',created_at,'status',status,'messageCount',message_count,'unansweredCount',unanswered,'lastMessageAt',coalesce(last_message,created_at)) ORDER BY coalesce(last_message,created_at) DESC,id),'[]')) INTO data FROM conversations;
 ELSIF p_tab='activity' THEN
  SELECT jsonb_build_object('days',(SELECT jsonb_agg(jsonb_build_object('date',dates.day,'seconds',coalesce(d.study_seconds,0),'answers',coalesce(d.answer_count,0),'active',d.day IS NOT NULL) ORDER BY dates.day)
   FROM (SELECT today-29+n AS day FROM generate_series(0,29) n) dates LEFT JOIN public.learning_activity_days d ON d.auth_user_id=p_student_id AND d.day=dates.day),
   'byMode',coalesce((SELECT jsonb_agg(jsonb_build_object('mode',mode,'seconds',seconds) ORDER BY mode) FROM
    (SELECT e.key mode,sum(e.value::integer) seconds FROM public.learning_activity_days d CROSS JOIN LATERAL jsonb_each_text(d.mode_seconds) e WHERE d.auth_user_id=p_student_id AND d.day>=today-29 GROUP BY e.key) modes),'[]'),
   'totalSeconds',coalesce((SELECT sum(study_seconds) FROM public.learning_activity_days WHERE auth_user_id=p_student_id AND day>=today-29),0)) INTO data;
 ELSE
  SELECT jsonb_build_object('notes',coalesce(jsonb_agg(jsonb_build_object('id',id,'note_text',note_text,'created_at',created_at,'updated_at',updated_at,'teacher_id',teacher_id) ORDER BY updated_at DESC),'[]')) INTO data FROM public.teacher_student_notes WHERE student_id=p_student_id;
 END IF;
 RETURN jsonb_build_object('success',true,'data',data);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error','request_failed','sqlstate',SQLSTATE); END $$;


--
-- Name: get_vocabulary_carryover(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_vocabulary_carryover(p_target_level text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=(SELECT auth.uid()); pref public.vocabulary_carryover_preferences; cards jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_target_level IS NULL OR NOT EXISTS(SELECT 1 FROM public.learning_levels WHERE code=p_target_level AND is_active)
 THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 IF NOT trainer_access_private.allowed(p_target_level,'vocabulary') THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO pref FROM public.vocabulary_carryover_preferences WHERE auth_user_id=actor AND target_level=p_target_level AND is_active;
 SELECT coalesce(jsonb_agg(jsonb_build_object('cardId',card_id,'originLevel',origin_level)),'[]') INTO cards
 FROM vocabulary_private.carryover_candidates(p_target_level);
 RETURN jsonb_build_object('success',true,'targetLevel',p_target_level,'enabled',coalesce(pref.enabled,false),
  'startedAt',pref.started_at,'decidedAt',pref.decided_at,
  'promptRequired',pref.started_at IS NOT NULL AND pref.decided_at IS NULL AND jsonb_array_length(cards)>0,'cards',cards);
EXCEPTION WHEN OTHERS THEN RETURN vocabulary_private.carryover_error(SQLERRM,SQLSTATE); END $$;


--
-- Name: get_vocabulary_carryover_cards(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_vocabulary_carryover_cards(p_target_level text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 500) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=(SELECT auth.uid()); state jsonb; cards jsonb; progress jsonb; selected_ids uuid[];
BEGIN
 state:=public.get_vocabulary_carryover(p_target_level); PERFORM platform_private.require_rpc_success(state);
 IF p_offset IS NULL OR p_offset<0 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500
 THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 SELECT coalesce(array_agg(card_id),'{}') INTO selected_ids FROM(
  SELECT card_id FROM vocabulary_private.carryover_candidates(p_target_level) LIMIT p_limit OFFSET p_offset) selected;
 SELECT coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('unit',jsonb_build_object(
  'id',u.id,'level',u.level,'label',u.label,'sort_order',u.sort_order,'is_active',u.is_active,'owner_auth_user_id',u.owner_auth_user_id),
  'translations',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.locale),'[]') FROM public.vocabulary_translations t WHERE t.card_id=c.id))
  ORDER BY c.id),'[]') INTO cards FROM public.learning_vocabulary_cards c JOIN public.learning_units u ON u.id=c.unit_id WHERE c.id=ANY(selected_ids);
 SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]') INTO progress FROM public.vocabulary_direction_progress p
 WHERE p.auth_user_id=actor AND p.card_id=ANY(selected_ids);
 RETURN jsonb_build_object('success',true,'cards',cards,'progress',progress);
EXCEPTION WHEN OTHERS THEN RETURN vocabulary_private.carryover_error(SQLERRM,SQLSTATE); END $$;


--
-- Name: import_learning_path(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.import_learning_path(p_path jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid;
BEGIN
 actor:=path_private.check_actor();
 IF NOT business_private.is_staff() THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
 RETURN path_private.import_path_catalog(p_path,actor);
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;


--
-- Name: import_learning_path_seed(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.import_learning_path_seed(p_paths jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE path jsonb; imported jsonb; paths jsonb:='[]'::jsonb; migration jsonb; level_code text;
 units integer:=0; nodes integer:=0; exercises integer:=0; objectives integer:=0;
BEGIN
 -- Check the actual invoking DB role, not an editable JWT claim or auth.uid().
 -- EXECUTE is separately granted only to service_role below.
 IF NOT(coalesce(current_setting('role',true),'none')='service_role'
  OR (coalesce(current_setting('role',true),'none')='none' AND session_user='service_role')) THEN
  RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
 END IF;
 IF jsonb_typeof(p_paths) IS DISTINCT FROM 'array' OR jsonb_array_length(p_paths)=0 THEN
  RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023';
 END IF;
 -- Validate the entire batch before any catalog mutation; reject identities
 -- duplicated across paths as well as the per-path Phase 3 shape violations.
 FOR path IN SELECT value FROM jsonb_array_elements(p_paths) LOOP
  IF NOT path_private.valid_seed_shape(path) THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_paths) p GROUP BY p->>'level',p->>'id' HAVING count(*)>1)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_paths) p GROUP BY p->>'level',p->>'path' HAVING count(*)>1)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_paths) p GROUP BY p->>'level',p->>'slug' HAVING count(*)>1)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_paths) p CROSS JOIN LATERAL jsonb_array_elements(p->'nodes') n
   CROSS JOIN LATERAL jsonb_array_elements(n->'exercises') e GROUP BY e->>'id' HAVING count(*)>1) THEN
  RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('path-seed-legacy-migration',0));
 -- Deterministic lock order prevents deadlocks between batches spanning levels.
 FOR level_code IN SELECT DISTINCT p->>'level' FROM jsonb_array_elements(p_paths) p ORDER BY 1 LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended('path-catalog:'||level_code,0));
 END LOOP;
 FOR path IN SELECT value FROM jsonb_array_elements(p_paths) LOOP
  INSERT INTO path_private.phase4_imported_units(unit_id,was_active)
   SELECT id,is_active FROM public.learning_units WHERE is_path AND level=path->>'level' AND path_source_id=path->>'id'
   ON CONFLICT DO NOTHING;
  imported:=path_private.import_path_catalog(path,NULL);
  INSERT INTO path_private.phase4_imported_units(unit_id,was_active) VALUES((imported->>'unit_id')::uuid,NULL)
   ON CONFLICT DO NOTHING;
  imported:=imported||jsonb_build_object('source_id',path->>'id','objective_count',jsonb_array_length(path->'objectives'));
  paths:=paths||jsonb_build_array(imported);
  units:=units+1; nodes:=nodes+(imported->>'node_count')::integer;
  exercises:=exercises+(imported->>'exercise_count')::integer;
  objectives:=objectives+(imported->>'objective_count')::integer;
 END LOOP;
 -- Any catalog/constraint failure above rolls back every path in this call.
 -- Archive and note creation only happen after every supplied path succeeds.
 migration:=path_private.migrate_legacy_grammar();
 RETURN jsonb_build_object('paths',paths,'path_count',units,'node_count',nodes,
  'exercise_count',exercises,'objective_count',objectives,'migration',migration);
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;


--
-- Name: initialize_vocabulary_cards(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_vocabulary_cards(p_decisions jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
RETURN to_jsonb((
  SELECT vocabulary_private.initialize_cards(p_decisions)));
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


--
-- Name: learning_reset_audio_batch(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.learning_reset_audio_batch(p_token uuid) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
RETURN (SELECT coalesce(jsonb_agg(to_jsonb(rpc_row)),'[]'::jsonb) FROM (
 SELECT * FROM learning_reset_private.audio_batch(p_token)) rpc_row);
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


--
-- Name: list_registration_identity_conflicts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_registration_identity_conflicts() RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
RETURN to_jsonb((SELECT business_private.list_registration_identity_conflicts()));
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


--
-- Name: manage_learning_path(uuid, uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.manage_learning_path(p_student_id uuid, p_unit_id uuid, p_action text, p_node_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT public.manage_learning_path(p_student_id,p_unit_id,p_action,p_node_id,gen_random_uuid());
$$;


--
-- Name: manage_learning_path(uuid, uuid, text, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.manage_learning_path(p_student_id uuid, p_unit_id uuid, p_action text, p_node_id uuid, p_request_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=auth.uid(); previous public.path_interventions; intervention uuid; BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF NOT business_private.is_staff() THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_student_id AND role='student')
 OR NOT EXISTS(SELECT 1 FROM public.learning_units WHERE id=p_unit_id AND is_path AND is_active)
 OR p_action IS NULL OR p_action NOT IN('unlock','reset_path','reset_test') THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 IF p_action='unlock' AND NOT teacher_dashboard_private.unit_allowed(p_student_id,p_unit_id) THEN RAISE EXCEPTION 'path_locked' USING ERRCODE='42501'; END IF;
 -- Same ordering as learner writes and global reset: reset guard, then path lock.
 PERFORM learning_reset_private.assert_writable(p_student_id);
 PERFORM pg_advisory_xact_lock(hashtextextended('path:'||p_student_id::text,0));
 SELECT * INTO previous FROM public.path_interventions WHERE created_by=actor AND request_id=p_request_id;
 IF FOUND THEN
  IF previous.auth_user_id<>p_student_id OR previous.unit_id<>p_unit_id OR previous.action::text<>p_action OR previous.node_id IS DISTINCT FROM p_node_id THEN
   RAISE EXCEPTION 'request_conflict' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('success',true,'interventionId',previous.id);
 END IF;
 IF p_action='reset_test' THEN
  IF NOT EXISTS(SELECT 1 FROM public.path_nodes WHERE id=p_node_id AND unit_id=p_unit_id AND kind='test' AND is_active) THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
  PERFORM path_private.reset_progress(p_student_id,p_unit_id,p_node_id);
 ELSE
  IF p_node_id IS NOT NULL THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
  IF p_action='reset_path' THEN PERFORM path_private.reset_progress(p_student_id,p_unit_id); END IF;
 END IF;
 INSERT INTO public.path_interventions(auth_user_id,unit_id,node_id,action,created_by,request_id)
 VALUES(p_student_id,p_unit_id,p_node_id,p_action::public.path_intervention_action,actor,p_request_id) RETURNING id INTO intervention;
 RETURN jsonb_build_object('success',true,'interventionId',intervention);
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;


--
-- Name: mark_business_invoice(uuid, date, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_business_invoice(p_booking uuid, p_month date, p_created boolean, p_reference text DEFAULT ''::text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
PERFORM business_private.mark_invoice(p_booking,p_month,p_created,p_reference);
 RETURN 'null'::jsonb;
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


--
-- Name: mark_pronunciation_seen(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_pronunciation_seen(p_submission_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
PERFORM pronunciation_private.mark_seen(p_submission_id);
 RETURN 'null'::jsonb;
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


--
-- Name: media_storage_usage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.media_storage_usage() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN

BEGIN
 IF NOT business_private.is_staff() THEN RETURN jsonb_build_object('error','not_authorized','message','Staff access required.'); END IF;
 RETURN jsonb_build_object('levels',(SELECT jsonb_agg(jsonb_build_object('level',l.code,'bytes',coalesce(u.bytes,0),'limit_bytes',21474836480) ORDER BY l.code)
  FROM public.learning_levels l LEFT JOIN (SELECT split_part(name,'/',1) level,sum(coalesce((metadata->>'size')::bigint,0)) bytes FROM storage.objects WHERE bucket_id='course-assets' GROUP BY 1) u ON u.level=l.code),
  'total_bytes',(SELECT coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0) FROM storage.objects WHERE bucket_id='course-assets'));
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error','storage_usage_failed','message','Storage usage could not be read.');
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


--
-- Name: prepare_business_month(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prepare_business_month(p_month date) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
RETURN to_jsonb((select business_private.prepare_month(p_month)));
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


--
-- Name: pronunciation_reply_senders(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pronunciation_reply_senders() RETURNS TABLE(sender_id uuid, display_name text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT DISTINCT m.sender_id, nullif(btrim(p.display_name),'')
 FROM public.pronunciation_messages m
 JOIN public.submissions s ON s.id=m.submission_id AND s.auth_user_id=(SELECT auth.uid())
 LEFT JOIN public.people p ON p.auth_user_id=m.sender_id
 WHERE m.sender_role::text IN('teacher','admin') AND (SELECT auth.uid()) IS NOT NULL
$$;


--
-- Name: queue_transactional_email(text, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.queue_transactional_email(p_dedupe_key text, p_kind text, p_recipient text, p_locale text, p_payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN

DECLARE v_id uuid;
BEGIN
  INSERT INTO private.mail_outbox(dedupe_key,kind,recipient,locale,payload)
  VALUES(p_dedupe_key,p_kind::public.mail_kind,lower(trim(p_recipient)),CASE WHEN p_locale IN ('de','en','ru','uk','tr') THEN p_locale ELSE 'de' END,p_payload)
  ON CONFLICT(dedupe_key) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN SELECT id INTO v_id FROM private.mail_outbox WHERE dedupe_key=p_dedupe_key; END IF;
  RETURN to_jsonb(v_id);
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


--
-- Name: record_grammar_attempt(uuid, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_grammar_attempt(p_exercise_id uuid, p_answer text, p_hint_shown boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
RETURN to_jsonb((
  SELECT grammar_private.record_attempt(p_exercise_id, p_answer, p_hint_shown)));
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


--
-- Name: reset_student_level_progress(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_student_level_progress(p_student_id uuid, p_level text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
PERFORM learning_private.reset_student_level(p_student_id,p_level);
 RETURN 'null'::jsonb;
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


--
-- Name: reset_vocabulary_lesson_progress(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_vocabulary_lesson_progress(p_unit_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
PERFORM vocabulary_private.reset_lesson(p_unit_id);
 RETURN 'null'::jsonb;
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


--
-- Name: resolve_registration_identity(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_registration_identity(p_person_id uuid, p_auth_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
RETURN to_jsonb((SELECT business_private.resolve_registration_identity(p_person_id,p_auth_user_id)));
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


--
-- Name: save_business_course(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_business_course(p_data jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
RETURN to_jsonb((select business_private.save_course(p_data)));
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


--
-- Name: save_business_month(date, jsonb, boolean, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_business_month(p_month date, p_course_selections jsonb, p_paused boolean, p_expected uuid DEFAULT NULL::uuid, p_revision integer DEFAULT NULL::integer) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
RETURN to_jsonb((select business_private.save_month(p_month,p_course_selections,p_paused,p_expected,p_revision)));
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


--
-- Name: save_course_exception(uuid, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_course_exception(p_course_id uuid, p_date date, p_reason text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
RETURN to_jsonb((SELECT business_private.save_course_exception(p_course_id,p_date,p_reason)));
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


--
-- Name: save_learning_content(text, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_learning_content(p_trainer text, p_payload jsonb, p_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN

DECLARE old_fields jsonb; fields jsonb; unit_data jsonb:=p_payload->'unit'; translations jsonb:=p_payload->'translations';
 item uuid:=coalesce(p_id,gen_random_uuid()); old_unit uuid; target_unit uuid; old_meta public.learning_units; translation_row jsonb;
BEGIN
 IF current_user NOT IN('service_role','postgres') AND coalesce(identity_private.current_profile_role(),'') NOT IN('teacher','admin') THEN RAISE EXCEPTION 'Staff required' USING ERRCODE='42501'; END IF;
 IF p_trainer IS NULL OR NOT EXISTS(SELECT 1 FROM public.learning_trainers WHERE code::text=p_trainer)
 OR jsonb_typeof(unit_data) IS DISTINCT FROM 'object' OR jsonb_typeof(p_payload->'fields') IS DISTINCT FROM 'object'
 OR nullif(btrim(unit_data->>'label'),'') IS NULL OR NOT EXISTS(SELECT 1 FROM public.learning_levels WHERE code=unit_data->>'level') THEN
 RAISE EXCEPTION 'Invalid content' USING ERRCODE='23514'; END IF;
 IF p_id IS NOT NULL THEN
  IF p_trainer='vocabulary' THEN SELECT to_jsonb(c),c.unit_id INTO old_fields,old_unit FROM public.learning_vocabulary_cards c WHERE c.id=p_id;
  ELSIF p_trainer='exercises' THEN SELECT to_jsonb(c),c.unit_id INTO old_fields,old_unit FROM public.learning_exercises c WHERE c.id=p_id;
  ELSIF p_trainer='pronunciation' THEN SELECT to_jsonb(c),c.unit_id INTO old_fields,old_unit FROM public.learning_reading_texts c WHERE c.id=p_id;
  ELSE SELECT to_jsonb(c),c.unit_id INTO old_fields,old_unit FROM public.learning_videos c WHERE c.id=p_id; END IF;
  IF old_fields IS NULL THEN RAISE EXCEPTION 'Content unavailable' USING ERRCODE='23514'; END IF;
  SELECT * INTO old_meta FROM public.learning_units WHERE id=old_unit;
 END IF;
 fields:=coalesce(old_fields,'{}'::jsonb)||(p_payload->'fields');
 IF p_trainer IN('vocabulary','exercises') THEN
  IF old_unit IS NOT NULL AND old_meta.level=unit_data->>'level' AND old_meta.label=unit_data->>'label' THEN target_unit:=old_unit;
  ELSE target_unit:=learning_private.ensure_unit(NULL,unit_data->>'level',p_trainer,unit_data->>'label'); END IF;
 ELSE
  target_unit:=learning_private.ensure_unit(old_unit,unit_data->>'level',p_trainer,unit_data->>'label',
    coalesce((unit_data->>'is_active')::boolean,old_meta.is_active,true),coalesce((unit_data->>'sort_order')::integer,old_meta.sort_order,100));
 END IF;
 IF p_trainer IN('vocabulary','exercises') THEN
  IF jsonb_typeof(translations) IS DISTINCT FROM 'array'
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(translations) t WHERE NOT EXISTS(SELECT 1 FROM public.locales WHERE code=t->>'locale'))
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(translations) t GROUP BY t->>'locale' HAVING count(*)>1) THEN
  RAISE EXCEPTION 'Invalid translations' USING ERRCODE='23514'; END IF;
 END IF;
 IF p_trainer='vocabulary' THEN
  IF coalesce((fields->>'sentence_practice')::boolean,false) AND EXISTS(SELECT 1 FROM public.locales l WHERE NOT EXISTS(
   SELECT 1 FROM jsonb_array_elements(translations) t WHERE t->>'locale'=l.code AND nullif(btrim(t->>'context_sentence'),'') IS NOT NULL)) THEN
  RAISE EXCEPTION 'Sentence translations required' USING ERRCODE='23514'; END IF;
  -- phase1-vocabulary-target-form-v1
  IF fields->'target_form' IS NOT NULL AND fields->'target_form'<>'null'::jsonb THEN
   IF jsonb_typeof(fields->'target_form') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid target form' USING ERRCODE='23514'; END IF;
   IF jsonb_array_length(fields->'target_form')>12 OR EXISTS(SELECT 1 FROM jsonb_array_elements(fields->'target_form') value
    WHERE jsonb_typeof(value) IS DISTINCT FROM 'string' OR length(btrim(value#>>'{}')) NOT BETWEEN 1 AND 120)
   THEN RAISE EXCEPTION 'Invalid target form' USING ERRCODE='23514'; END IF;
  END IF;
  INSERT INTO public.learning_vocabulary_cards(id,unit_id,word_de,article,plural,image_url,audio_url,sentence_practice,alternative_answers_de,target_form)
  VALUES(item,target_unit,fields->>'word_de',(fields->>'article')::public.grammatical_article,fields->>'plural',fields->>'image_url',fields->>'audio_url',coalesce((fields->>'sentence_practice')::boolean,false),
  ARRAY(SELECT jsonb_array_elements_text(coalesce(fields->'alternative_answers_de','[]'::jsonb))),
  CASE WHEN fields->'target_form' IS NULL OR fields->'target_form'='null'::jsonb THEN NULL ELSE ARRAY(SELECT btrim(value) FROM jsonb_array_elements_text(fields->'target_form')) END)
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,word_de=excluded.word_de,article=excluded.article,plural=excluded.plural,
  image_url=excluded.image_url,audio_url=excluded.audio_url,sentence_practice=excluded.sentence_practice,alternative_answers_de=excluded.alternative_answers_de,target_form=excluded.target_form;
  DELETE FROM public.vocabulary_translations WHERE card_id=item;
  FOR translation_row IN SELECT value FROM jsonb_array_elements(translations) LOOP
   INSERT INTO public.vocabulary_translations(card_id,locale,translation,context_sentence,is_difficult)
   VALUES(item,translation_row->>'locale',translation_row->>'translation',translation_row->>'context_sentence',coalesce((translation_row->>'is_difficult')::boolean,false));
  END LOOP;
 ELSIF p_trainer='exercises' THEN
  IF fields->>'type' NOT IN('fill_in_blank','multiple_choice') OR jsonb_typeof(fields->'content') IS DISTINCT FROM 'object'
  OR nullif(btrim(fields->'content'->>'correct_answer'),'') IS NULL OR (fields->'content') ?| ARRAY['smart_hint','explanation'] THEN
  RAISE EXCEPTION 'Invalid exercise' USING ERRCODE='23514'; END IF;
  INSERT INTO public.learning_exercises(id,unit_id,topic,type,content,solution_audio_url)
  VALUES(item,target_unit,fields->>'topic',(fields->>'type')::public.exercise_type,fields->'content',fields->>'solution_audio_url')
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,topic=excluded.topic,type=excluded.type,content=excluded.content,solution_audio_url=excluded.solution_audio_url;
  DELETE FROM public.grammar_translations WHERE exercise_id=item;
  FOR translation_row IN SELECT value FROM jsonb_array_elements(translations) LOOP
   -- phase3-translation-prompt-v1
   INSERT INTO public.grammar_translations(exercise_id,locale,hint,smart_hint,explanation,prompt)
   VALUES(item,translation_row->>'locale',translation_row->>'hint',translation_row->>'smart_hint',translation_row->>'explanation',translation_row->>'prompt');
  END LOOP;
 ELSIF p_trainer='pronunciation' THEN
  INSERT INTO public.learning_reading_texts(id,unit_id,sentence_de,focus,audio_url)
  VALUES(item,target_unit,fields->>'sentence_de',fields->>'focus',fields->>'audio_url')
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,sentence_de=excluded.sentence_de,focus=excluded.focus,audio_url=excluded.audio_url;
 ELSE
  INSERT INTO public.learning_videos(id,unit_id,description,source_url,title,folder_id,storage_path,file_size)
  VALUES(item,target_unit,fields->>'description',nullif(btrim(fields->>'source_url'),''),coalesce(nullif(fields->>'title',''),unit_data->>'label'),
   (fields->>'folder_id')::uuid,fields->>'storage_path',(fields->>'file_size')::bigint)
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,description=excluded.description,source_url=excluded.source_url,
   title=excluded.title,folder_id=excluded.folder_id,storage_path=excluded.storage_path,file_size=excluded.file_size;
 END IF;
 IF old_unit IS NOT NULL AND old_unit<>target_unit THEN
  DELETE FROM public.learning_units u WHERE u.id=old_unit
  AND NOT EXISTS(SELECT 1 FROM public.learning_vocabulary_cards c WHERE c.unit_id=u.id)
  AND NOT EXISTS(SELECT 1 FROM public.learning_exercises c WHERE c.unit_id=u.id)
  AND NOT EXISTS(SELECT 1 FROM public.learning_reading_texts c WHERE c.unit_id=u.id)
  AND NOT EXISTS(SELECT 1 FROM public.learning_videos c WHERE c.unit_id=u.id);
 END IF;
 RETURN jsonb_build_object('id',item);
EXCEPTION WHEN insufficient_privilege THEN RETURN jsonb_build_object('error','not_authorized','message','Staff access required.');
 -- phase3-content-quality-errors-v1
 WHEN check_violation OR foreign_key_violation OR invalid_text_representation OR not_null_violation THEN
  RETURN jsonb_build_object('error',CASE WHEN SQLERRM IN('target_form_required','german_text_required') THEN SQLERRM ELSE 'invalid_input' END,
   'message',CASE WHEN SQLERRM='target_form_required' THEN 'Add at least one nonempty target form before saving the exercise.'
    WHEN SQLERRM='german_text_required' THEN 'German learning fields cannot contain Cyrillic or Turkish-specific letters.'
    ELSE 'Content fields or uploaded file are invalid.' END);
 WHEN unique_violation THEN RETURN jsonb_build_object('error','conflict','message','Content already exists.');
 WHEN OTHERS THEN RETURN jsonb_build_object('error','save_failed','message','Content could not be saved.');
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


--
-- Name: save_student_blackboard(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_student_blackboard(p_student_id uuid, p_note_text text, p_expected_note_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN

DECLARE actor uuid:=(SELECT auth.uid()); board public.teacher_student_notes; prose text;
BEGIN
 IF actor IS NULL OR coalesce(identity_private.current_profile_role(),'') NOT IN('teacher','admin') THEN RAISE insufficient_privilege; END IF;
 IF p_note_text IS NULL OR length(p_note_text)>5000 OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_student_id AND role='student') THEN
  RAISE check_violation USING message='Invalid student or note';
 END IF;
 prose:=btrim(p_note_text);
 PERFORM pg_advisory_xact_lock(hashtextextended('student-note:'||p_student_id::text,0));
 SELECT * INTO board FROM public.teacher_student_notes WHERE student_id=p_student_id FOR UPDATE;
 IF p_expected_note_id IS NOT NULL AND p_expected_note_id IS DISTINCT FROM board.id THEN
  RAISE EXCEPTION 'The note changed; reload and retry' USING ERRCODE='PT409';
 END IF;
 IF board.id IS NULL THEN
  IF prose='' THEN RETURN '[]'::jsonb; END IF;
  WITH written AS (INSERT INTO public.teacher_student_notes(student_id,teacher_id,note_text) VALUES(p_student_id,actor,prose) RETURNING *) SELECT coalesce(jsonb_agg(to_jsonb(written)),'[]'::jsonb) INTO boundary_result FROM written; RETURN boundary_result;
 ELSE
  WITH written AS (UPDATE public.teacher_student_notes SET note_text=prose WHERE id=board.id AND student_id=p_student_id RETURNING *) SELECT coalesce(jsonb_agg(to_jsonb(written)),'[]'::jsonb) INTO boundary_result FROM written; RETURN boundary_result;
 END IF;
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


--
-- Name: set_student_level_access(uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_student_level_access(p_user_id uuid, p_levels text[]) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
BEGIN
 IF (SELECT identity_private.current_profile_role()) NOT IN('teacher','admin') OR auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Staff required' USING ERRCODE='42501'; END IF;
 IF p_levels IS NULL OR EXISTS(SELECT 1 FROM unnest(p_levels) l WHERE l IS NULL OR NOT EXISTS(SELECT 1 FROM public.learning_levels WHERE code=l)) THEN
  RAISE EXCEPTION 'Invalid levels' USING ERRCODE='23514'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-access:'||p_user_id::text,0));
 DELETE FROM public.student_level_access WHERE auth_user_id=p_user_id AND NOT(level=ANY(p_levels));
 INSERT INTO public.student_level_access SELECT p_user_id,l FROM unnest(p_levels) l ON CONFLICT DO NOTHING;
END;
 RETURN 'null'::jsonb;
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


--
-- Name: set_student_trainer_access(uuid, text, text, boolean, uuid[], boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_student_trainer_access(p_user_id uuid, p_level text, p_trainer text, p_enabled boolean, p_unit_ids uuid[] DEFAULT NULL::uuid[], p_replace_units boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
BEGIN
 IF (SELECT identity_private.current_profile_role()) NOT IN('teacher','admin') OR auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Staff required' USING ERRCODE='42501'; END IF;
 IF p_replace_units AND p_unit_ids IS NOT NULL AND EXISTS(SELECT 1 FROM unnest(p_unit_ids) item WHERE NOT EXISTS(
 SELECT 1 FROM public.learning_units u WHERE u.id=item AND u.level=p_level AND u.trainer::text=p_trainer)) THEN
  RAISE EXCEPTION 'Unit outside trainer' USING ERRCODE='23514'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-access:'||p_user_id::text,0));
 INSERT INTO public.learning_trainer_grants(auth_user_id,level,trainer,enabled,unit_mode)
 VALUES(p_user_id,p_level,p_trainer::public.trainer_code,p_enabled,(CASE WHEN p_replace_units AND p_unit_ids IS NOT NULL THEN 'selected' ELSE 'all' END)::public.unit_access_mode)
 ON CONFLICT(auth_user_id,level,trainer) DO UPDATE SET enabled=excluded.enabled,
 unit_mode=CASE WHEN p_replace_units THEN excluded.unit_mode ELSE public.learning_trainer_grants.unit_mode END;
 IF p_replace_units THEN
  DELETE FROM public.learning_unit_grants WHERE auth_user_id=p_user_id AND level=p_level AND trainer::text=p_trainer;
  INSERT INTO public.learning_unit_grants SELECT DISTINCT p_user_id,p_level,p_trainer::public.trainer_code,item FROM unnest(p_unit_ids) item;
 END IF;
END;
 RETURN 'null'::jsonb;
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


--
-- Name: set_vocabulary_carryover(text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_vocabulary_carryover(p_target_level text, p_enabled boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=(SELECT auth.uid()); state jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_enabled IS NULL THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 state:=public.get_vocabulary_carryover(p_target_level); PERFORM platform_private.require_rpc_success(state);
 INSERT INTO public.vocabulary_carryover_preferences(auth_user_id,target_level,enabled,decided_at)
 VALUES(actor,p_target_level,p_enabled,clock_timestamp())
 ON CONFLICT(auth_user_id,target_level) DO UPDATE SET enabled=excluded.enabled,decided_at=excluded.decided_at,is_active=true;
 RETURN public.get_vocabulary_carryover(p_target_level);
EXCEPTION WHEN OTHERS THEN RETURN vocabulary_private.carryover_error(SQLERRM,SQLSTATE); END $$;


--
-- Name: set_vocabulary_lesson_paused(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_vocabulary_lesson_paused(p_unit_id uuid, p_paused boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=(SELECT auth.uid());
BEGIN
 IF actor IS NULL THEN
  RETURN jsonb_build_object('error','authentication_required','message','Sign in to change your learning box.');
 END IF;
 IF p_unit_id IS NULL OR p_paused IS NULL THEN
  RETURN jsonb_build_object('error','invalid_input','message','The request contains invalid data.');
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.learning_units u WHERE u.id=p_unit_id AND u.trainer='vocabulary') THEN
  RETURN jsonb_build_object('error','not_found','message','This lesson does not exist.');
 END IF;
 IF p_paused THEN
  IF NOT learning_private.unit_allowed(p_unit_id) THEN
   RETURN jsonb_build_object('error','trainer_access_denied','message','This lesson is not available to you.');
  END IF;
  INSERT INTO public.vocabulary_lesson_pauses(auth_user_id,unit_id) VALUES(actor,p_unit_id)
  ON CONFLICT DO NOTHING;
 ELSE
  DELETE FROM public.vocabulary_lesson_pauses WHERE auth_user_id=actor AND unit_id=p_unit_id;
 END IF;
 RETURN jsonb_build_object('unitId',p_unit_id,'paused',p_paused);
END $$;


--
-- Name: skip_vocabulary_assessment(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.skip_vocabulary_assessment(p_level text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
RETURN to_jsonb((
  SELECT vocabulary_private.skip_assessment(p_level)));
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


--
-- Name: start_path_node(uuid, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_path_node(p_node_id uuid, p_locale text DEFAULT 'de'::text, p_restart boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid; n public.path_nodes; r public.path_practice_runs; ids uuid[]; items jsonb; card jsonb; BEGIN
 actor:=path_private.check_actor(p_locale);
 SELECT * INTO n FROM public.path_nodes WHERE id=p_node_id AND kind<>'test' AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'node_unavailable' USING ERRCODE='22023'; END IF;
 IF NOT path_private.node_available(n.id) THEN RAISE EXCEPTION 'node_locked' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.path_practice_runs WHERE node_id=n.id AND auth_user_id=actor AND status='active' FOR UPDATE;
 IF r.id IS NOT NULL AND p_restart THEN
  UPDATE public.path_practice_runs SET status='abandoned',updated_at=clock_timestamp() WHERE id=r.id;
  r.id:=NULL;
 END IF;
 IF r.id IS NULL THEN
  SELECT array_agg(e.id ORDER BY e.sort_order,e.id) INTO ids FROM public.learning_exercises e WHERE e.node_id=n.id AND e.content_status='ready' AND e.path_is_active;
  IF coalesce(cardinality(ids),0)=0 THEN RAISE EXCEPTION 'node_unavailable' USING ERRCODE='22023'; END IF;
  INSERT INTO public.path_practice_runs(auth_user_id,node_id,queue,total) VALUES(actor,n.id,ids,cardinality(ids)) RETURNING * INTO r;
  INSERT INTO path_private.practice_items(run_id,exercise_id,snapshot) SELECT r.id,x,path_private.snapshot(x) FROM unnest(ids) x;
  INSERT INTO public.path_node_progress(auth_user_id,node_id) VALUES(actor,n.id) ON CONFLICT(auth_user_id,node_id) DO UPDATE SET is_active=true,status='in_progress',best_stars=0,first_attempt_accuracy=0,completed_at=NULL,updated_at=clock_timestamp() WHERE NOT path_node_progress.is_active;
 END IF;
 SELECT jsonb_agg(path_private.present(i.snapshot,p_locale) ORDER BY q.position) INTO items
 FROM unnest(r.queue) WITH ORDINALITY q(id,position) JOIN path_private.practice_items i ON i.run_id=r.id AND i.exercise_id=q.id;
 card:=n.merkkarte;
 IF card IS NOT NULL THEN card:=card||jsonb_build_object('rule',coalesce((SELECT rule FROM public.path_node_translations WHERE node_id=n.id AND locale=p_locale),card->>'rule')); END IF;
 RETURN jsonb_build_object('run_id',r.id,'node_id',n.id,'queue',to_jsonb(r.queue),'total',r.total,'exercises',coalesce(items,'[]'::jsonb),'merkkarte',card);
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;


--
-- Name: start_path_test(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_path_test(p_node_id uuid, p_locale text DEFAULT 'de'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid; n public.path_nodes; a public.path_test_attempts; chosen uuid[]; previous uuid[]; replacement uuid; replaced uuid; goal text; pool integer; goals integer; BEGIN
 actor:=path_private.check_actor(p_locale);
 SELECT * INTO n FROM public.path_nodes WHERE id=p_node_id AND kind='test' AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'node_unavailable' USING ERRCODE='22023'; END IF;
 IF NOT path_private.node_available(n.id) THEN RAISE EXCEPTION 'node_locked' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.path_test_attempts WHERE auth_user_id=actor AND node_id=n.id AND status='active' FOR UPDATE;
 IF a.id IS NULL THEN
  SELECT count(*) INTO pool FROM public.learning_exercises WHERE node_id=n.id AND content_status='ready' AND path_is_active;
  SELECT count(*) INTO goals FROM public.path_objectives WHERE unit_id=n.unit_id;
  IF pool<2*n.test_size OR goals>n.test_size OR goals=0 OR EXISTS(SELECT 1 FROM public.path_objectives o WHERE o.unit_id=n.unit_id
   AND NOT EXISTS(SELECT 1 FROM public.learning_exercises e WHERE e.node_id=n.id AND e.goal_id=o.id AND e.content_status='ready' AND e.path_is_active)) THEN RAISE EXCEPTION 'test_pool_invalid' USING ERRCODE='23514'; END IF;
  -- One random task per objective, then fill remaining positions from the pool.
  SELECT array_agg(id) INTO chosen FROM (SELECT DISTINCT ON(e.goal_id) e.id,e.goal_id FROM public.learning_exercises e WHERE e.node_id=n.id AND e.content_status='ready' AND e.path_is_active ORDER BY e.goal_id,random()) required;
  SELECT chosen||coalesce(array_agg(id),'{}'::uuid[]) INTO chosen FROM (SELECT id FROM public.learning_exercises WHERE node_id=n.id AND content_status='ready' AND path_is_active AND NOT(id=ANY(chosen)) ORDER BY random() LIMIT n.test_size-cardinality(chosen)) extra;
  SELECT selected_exercise_ids INTO previous FROM public.path_test_attempts WHERE auth_user_id=actor AND node_id=n.id ORDER BY created_at DESC,id DESC LIMIT 1;
  IF previous IS NOT NULL AND chosen @> previous AND previous @> chosen THEN
   -- Deterministic fallback guarantees a different set, not just a shuffled order.
   SELECT e.id,e.goal_id INTO replacement,goal FROM public.learning_exercises e WHERE e.node_id=n.id AND e.content_status='ready' AND e.path_is_active AND NOT(e.id=ANY(chosen)) ORDER BY random() LIMIT 1;
   SELECT e.id INTO replaced FROM public.learning_exercises e WHERE e.id=ANY(chosen) AND e.goal_id=goal LIMIT 1;
   chosen:=array_replace(chosen,replaced,replacement);
  END IF;
  SELECT array_agg(x ORDER BY random()) INTO chosen FROM unnest(chosen) x;
  INSERT INTO public.path_test_attempts(auth_user_id,node_id,selected_exercise_ids) VALUES(actor,n.id,chosen) RETURNING * INTO a;
  INSERT INTO path_private.test_items(attempt_id,exercise_id,snapshot,position) SELECT a.id,q.id,path_private.snapshot(q.id),q.position FROM unnest(chosen) WITH ORDINALITY q(id,position);
 END IF;
 RETURN jsonb_build_object('attempt_id',a.id,'node_id',n.id,'total',cardinality(a.selected_exercise_ids),
  'exercises',(SELECT jsonb_agg(path_private.present(i.snapshot,p_locale)||jsonb_build_object('answer',ans.answer) ORDER BY i.position)
   FROM path_private.test_items i LEFT JOIN public.path_test_answers ans ON ans.attempt_id=i.attempt_id AND ans.exercise_id=i.exercise_id WHERE i.attempt_id=a.id));
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;


--
-- Name: submit_business_cancellation(text, text, uuid, text, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_business_cancellation(p_name text, p_email text, p_course_id uuid DEFAULT NULL::uuid, p_type text DEFAULT 'asap'::text, p_date date DEFAULT NULL::date, p_locale text DEFAULT 'de'::text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
RETURN to_jsonb((
 SELECT business_private.submit_cancellation(p_name,p_email,p_course_id,p_type,p_date,p_locale)));
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


--
-- Name: submit_business_registration(jsonb, jsonb, date, jsonb, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_business_registration(p_contact jsonb, p_course_selections jsonb, p_start date, p_consents jsonb, p_locale text DEFAULT 'de'::text, p_trial boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN

declare v_person uuid;v_booking uuid;v_email text;v_name text;v_matches integer;
begin
 if p_start is null or p_trial is null or p_start<(now() at time zone 'Europe/Berlin')::date or p_start>(now() at time zone 'Europe/Berlin')::date+366 or coalesce((p_consents->>'privacy')::boolean,false)=false or coalesce((p_consents->>'agb')::boolean,false)=false then raise check_violation;end if;
 perform * from business_private.validate_course_selections(p_course_selections,p_start);
 if not exists(select 1 from public.locales where code=p_locale) then raise check_violation;end if;
 v_email:=lower(btrim(p_contact->>'email'));v_name:=btrim(p_contact->>'name');
 if v_email is null or length(v_email) not between 3 and 254 or v_name is null or length(v_name) not between 1 and 160 then raise check_violation;end if;
 if p_trial then
  perform pg_advisory_xact_lock(hashtextextended(v_email||':'||lower(v_name),0));
  if exists(select 1 from public.bookings where kind='trial' and lower(contact_email)=v_email and lower(contact_name)=lower(v_name)) then raise unique_violation;end if;
  if jsonb_array_length(p_course_selections)<>1 or not exists(select 1 from public.courses c join public.course_schedules s on s.course_id=c.id
   where c.id=(p_course_selections->0->>'course_id')::uuid and c.category<>'private' and c.trial_lessons and c.archived_at is null and s.weekday=extract(isodow from p_start)
   and (c.start_date is null or p_start>=c.start_date) and (c.end_date is null or p_start<=c.end_date)
   and not exists(select 1 from public.course_exceptions e where e.date=p_start and (e.course_id is null or e.course_id=c.id))) then raise check_violation;end if;
 end if;
 -- Submitted details never update an existing identity. Exact identity reuse
 -- only attaches a pending application, exposing no personal data to the caller.
 perform pg_advisory_xact_lock(hashtextextended('application-person:'||v_email||':'||lower(v_name),0));
 select count(*),(array_agg(id))[1] into v_matches,v_person from public.people where lower(email)=v_email and lower(display_name)=lower(v_name)
 and birth_date is not distinct from (p_contact->>'birth_date')::date;
 if v_matches<>1 then
  insert into public.people(display_name,email,birth_date,phone,street,postal_code,city,preferred_locale)
  values(v_name,v_email,(p_contact->>'birth_date')::date,p_contact->>'phone',p_contact->>'street',p_contact->>'postal_code',p_contact->>'city',p_locale) returning id into v_person;
 end if;
 insert into public.bookings(person_id,target_month,start_date,kind,contact_name,contact_email,contact_birth_date,contact_phone,contact_street,contact_postal_code,contact_city,privacy_accepted,agb_accepted,revocation_accepted,recording_accepted)
 values(v_person,date_trunc('month',p_start)::date,p_start,(case when p_trial then 'trial' else 'registration' end)::public.booking_kind,v_name,v_email,(p_contact->>'birth_date')::date,p_contact->>'phone',p_contact->>'street',p_contact->>'postal_code',p_contact->>'city',true,true,coalesce((p_consents->>'revocation')::boolean,false),(p_consents->>'recording')::boolean) returning id into v_booking;
 perform business_private.replace_items(v_booking,p_course_selections);
 perform platform_private.require_rpc_success(public.queue_transactional_email('registration:'||v_booking,'registration_received',v_email,p_locale,jsonb_build_object('name',v_name,'startDate',p_start,'exceptions',business_private.booking_mail_exceptions(v_booking),'courses',(select jsonb_agg(jsonb_build_object('title',title_snapshot,'units',units,'unitPrice',unit_price,'unitMinutes',unit_minutes,'price',amount)) from public.booking_items where booking_id=v_booking))));
 perform platform_private.require_rpc_success(public.queue_transactional_email('staff-registration:'||v_booking,'new_enrollment','info@sitov-academy.com','de',jsonb_build_object('name',v_name,'path','/de/admin/registrations')));
 RETURN to_jsonb(v_booking);
end;
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


--
-- Name: submit_path_answer(uuid, uuid, jsonb, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_path_answer(p_run_id uuid, p_exercise_id uuid, p_answer jsonb, p_request_id uuid, p_locale text DEFAULT 'de'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid; r public.path_practice_runs; item path_private.practice_items; receipt path_private.answer_receipts; grade jsonb; response jsonb; correct boolean; stars integer; accuracy numeric; BEGIN
 actor:=path_private.check_actor(p_locale);
 IF p_request_id IS NULL OR p_answer IS NULL OR octet_length(p_answer::text)>4194304 THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM public.path_practice_runs WHERE id=p_run_id AND auth_user_id=actor FOR UPDATE;
 IF r.id IS NULL OR NOT r.is_active THEN RAISE EXCEPTION 'attempt_unavailable' USING ERRCODE='42501'; END IF;
 IF NOT path_private.node_available(r.node_id) THEN RAISE EXCEPTION 'node_locked' USING ERRCODE='42501'; END IF;
 SELECT * INTO receipt FROM path_private.answer_receipts WHERE run_id=r.id AND request_id=p_request_id;
 IF FOUND THEN
  IF receipt.exercise_id<>p_exercise_id OR receipt.answer<>p_answer THEN RAISE EXCEPTION 'request_conflict' USING ERRCODE='22023'; END IF;
  RETURN receipt.response;
 END IF;
 IF r.status<>'active' THEN RAISE EXCEPTION 'attempt_unavailable' USING ERRCODE='22023'; END IF;
 IF r.queue[1] IS DISTINCT FROM p_exercise_id THEN RAISE EXCEPTION 'answer_out_of_order' USING ERRCODE='22023'; END IF;
 SELECT * INTO item FROM path_private.practice_items WHERE run_id=r.id AND exercise_id=p_exercise_id FOR UPDATE;
 grade:=path_private.grade((item.snapshot->>'type')::public.exercise_type,item.snapshot->'content',p_answer);
 IF grade ? 'error' THEN RETURN grade; END IF;
 correct:=(grade->>'status') IN('EXACT','SOFT_ERROR');
 UPDATE path_private.practice_items SET attempts=attempts+1,solved=solved OR correct,first_correct=coalesce(first_correct,correct) WHERE run_id=r.id AND exercise_id=p_exercise_id;
 r.queue:=r.queue[2:cardinality(r.queue)];
 IF NOT correct THEN r.queue:=array_append(r.queue,p_exercise_id); END IF;
 IF item.attempts=0 AND correct THEN r.first_correct:=r.first_correct+1; END IF;
 accuracy:=100.0*r.first_correct/r.total;
 stars:=CASE WHEN accuracy>=90 THEN 3 WHEN accuracy>=70 THEN 2 ELSE 1 END;
 UPDATE public.path_practice_runs SET queue=r.queue,first_correct=r.first_correct,updated_at=clock_timestamp(),status=CASE WHEN cardinality(r.queue)=0 THEN 'completed'::public.path_run_status ELSE status END,
  completed_at=CASE WHEN cardinality(r.queue)=0 THEN clock_timestamp() ELSE NULL END WHERE id=r.id;
 UPDATE public.path_node_progress SET updated_at=clock_timestamp(),status=CASE WHEN cardinality(r.queue)=0 THEN 'completed'::public.path_progress_status ELSE status END,
  best_stars=CASE WHEN cardinality(r.queue)=0 THEN greatest(best_stars,stars) ELSE best_stars END,
  first_attempt_accuracy=CASE WHEN cardinality(r.queue)=0 THEN greatest(first_attempt_accuracy,accuracy) ELSE first_attempt_accuracy END,
  completed_at=CASE WHEN cardinality(r.queue)=0 THEN coalesce(completed_at,clock_timestamp()) ELSE completed_at END WHERE auth_user_id=actor AND node_id=r.node_id;
 response:=jsonb_build_object('grade',grade,'solution',path_private.solution(item.snapshot,p_locale),'completed',cardinality(r.queue)=0,'stars',CASE WHEN cardinality(r.queue)=0 THEN stars ELSE NULL END,'first_attempt_accuracy',accuracy,'queue',to_jsonb(r.queue));
 INSERT INTO path_private.answer_receipts(run_id,request_id,exercise_id,answer,response) VALUES(r.id,p_request_id,p_exercise_id,p_answer,response);
 RETURN response;
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;


--
-- Name: submit_path_test_answer(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_path_test_answer(p_attempt_id uuid, p_exercise_id uuid, p_answer jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid; a public.path_test_attempts; BEGIN
 actor:=path_private.check_actor();
 IF p_answer IS NULL OR p_answer='null'::jsonb OR octet_length(p_answer::text)>4194304 THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 SELECT * INTO a FROM public.path_test_attempts WHERE id=p_attempt_id AND auth_user_id=actor AND status='active' FOR UPDATE;
 IF a.id IS NULL THEN RAISE EXCEPTION 'attempt_unavailable' USING ERRCODE='42501'; END IF;
 IF NOT path_private.node_available(a.node_id) THEN RAISE EXCEPTION 'node_locked' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM path_private.test_items WHERE attempt_id=a.id AND exercise_id=p_exercise_id) THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 -- Intentionally no grading, including no result-dependent validation channel.
 INSERT INTO public.path_test_answers(attempt_id,exercise_id,answer) VALUES(a.id,p_exercise_id,p_answer)
 ON CONFLICT(attempt_id,exercise_id) DO UPDATE SET answer=excluded.answer,answered_at=clock_timestamp();
 RETURN jsonb_build_object('saved',true);
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;


--
-- Name: submit_vocabulary_answer(uuid, boolean, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_vocabulary_answer(p_progress_id uuid, p_is_correct boolean DEFAULT NULL::boolean, p_typed_answer text DEFAULT NULL::text, p_ui_language text DEFAULT 'de'::text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
RETURN to_jsonb((
  SELECT vocabulary_private.submit_answer(p_progress_id,p_is_correct,p_typed_answer,p_ui_language)));
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


--
-- Name: submit_vocabulary_answer(uuid, boolean, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_vocabulary_answer(p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text, p_target_level text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN RETURN vocabulary_private.submit_answer(p_progress_id,p_is_correct,p_typed_answer,p_ui_language,p_target_level);
EXCEPTION WHEN OTHERS THEN RETURN vocabulary_private.carryover_error(SQLERRM,SQLSTATE); END $$;


--
-- Name: submit_vocabulary_answer_once(uuid, uuid, boolean, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_vocabulary_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean DEFAULT NULL::boolean, p_typed_answer text DEFAULT NULL::text, p_ui_language text DEFAULT 'de'::text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
-- phase2-rpc-error-boundary-v1
DECLARE boundary_state text; boundary_message text; boundary_code text; boundary_result jsonb;
BEGIN
RETURN to_jsonb((
  SELECT vocabulary_private.submit_answer_once(p_request_id, p_progress_id, p_is_correct, p_typed_answer, p_ui_language)));
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


--
-- Name: submit_vocabulary_answer_once(uuid, uuid, boolean, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_vocabulary_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text, p_target_level text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN RETURN vocabulary_private.submit_answer_once(p_request_id,p_progress_id,p_is_correct,p_typed_answer,p_ui_language,p_target_level);
EXCEPTION WHEN OTHERS THEN RETURN vocabulary_private.carryover_error(SQLERRM,SQLSTATE); END $$;


--
-- Name: submit_vocabulary_self_rating_once(uuid, uuid, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_vocabulary_self_rating_once(p_request_id uuid, p_progress_id uuid, p_known boolean, p_ui_language text DEFAULT 'de'::text) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE boundary_state text; boundary_message text; boundary_code text;
BEGIN
 RETURN to_jsonb((SELECT vocabulary_private.submit_self_rating_once(p_request_id,p_progress_id,p_known,p_ui_language)));
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS boundary_state=RETURNED_SQLSTATE,boundary_message=MESSAGE_TEXT;
  boundary_code:=CASE WHEN boundary_message=ANY(ARRAY[
   'authentication_required','trainer_access_denied','flashcard_not_allowed','invalid_language',
   'answer_required','progress_not_found','review_not_due','vocabulary_spacing_required',
   'exercise_unavailable','invalid_answer_request','invalid_learning_language',
   'vocabulary_request_conflict','not_authorized','not_authenticated','invalid_input',
   'request_failed','conflict','not_found'
  ]) THEN boundary_message
  WHEN boundary_state='42501' THEN 'not_authorized'
  WHEN boundary_state IN('23502','23503','23514','22P02','22023','22007') THEN 'invalid_input'
  WHEN boundary_state IN('23505','PT409','40001') THEN 'conflict'
  WHEN boundary_state='40P01' THEN 'retry_required'
  WHEN boundary_state IN('P0002','02000') THEN 'not_found'
  ELSE 'request_failed' END;
  RETURN jsonb_build_object('error',boundary_code,'message',CASE
   WHEN boundary_code='vocabulary_spacing_required' THEN 'Review another card before this card.'
   WHEN boundary_code='review_not_due' THEN 'This review is not due yet.'
   WHEN boundary_code='flashcard_not_allowed' THEN 'This card must be typed, not self-rated.'
   WHEN boundary_state='42501' THEN 'The request is not authorized.'
   WHEN boundary_code IN('conflict','retry_required') THEN 'Reload and retry the request.'
   WHEN boundary_code='invalid_input' THEN 'The request contains invalid data.'
   ELSE 'The request could not be completed.' END,'sqlstate',boundary_state);
END $$;


--
-- Name: submit_vocabulary_self_rating_once(uuid, uuid, boolean, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_vocabulary_self_rating_once(p_request_id uuid, p_progress_id uuid, p_known boolean, p_ui_language text, p_target_level text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN RETURN vocabulary_private.submit_self_rating_once(p_request_id,p_progress_id,p_known,p_ui_language,p_target_level);
EXCEPTION WHEN OTHERS THEN RETURN vocabulary_private.carryover_error(SQLERRM,SQLSTATE); END $$;


--
-- Name: node_available(uuid, uuid); Type: FUNCTION; Schema: teacher_dashboard_private; Owner: -
--

CREATE FUNCTION teacher_dashboard_private.node_available(p_student uuid, p_node uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
 SELECT EXISTS(SELECT 1 FROM public.path_nodes n WHERE n.id=p_node AND n.is_active AND teacher_dashboard_private.path_available(p_student,n.unit_id)
 AND CASE WHEN n.kind='special' THEN EXISTS(SELECT 1 FROM public.path_node_progress p WHERE p.node_id=n.anchor_node_id AND p.auth_user_id=p_student AND p.is_active AND p.status='completed')
 ELSE NOT EXISTS(SELECT 1 FROM public.path_nodes prev WHERE prev.unit_id=n.unit_id AND prev.is_active AND prev.kind IN('practice','review')
 AND (n.kind='test' OR prev.sort_order<n.sort_order) AND NOT EXISTS(SELECT 1 FROM public.path_node_progress p WHERE p.node_id=prev.id AND p.auth_user_id=p_student AND p.is_active AND p.status='completed')) END);
$$;


--
-- Name: path_available(uuid, uuid); Type: FUNCTION; Schema: teacher_dashboard_private; Owner: -
--

CREATE FUNCTION teacher_dashboard_private.path_available(p_student uuid, p_unit uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
 SELECT teacher_dashboard_private.unit_allowed(p_student,p_unit) AND (
 EXISTS(SELECT 1 FROM public.path_interventions i WHERE i.auth_user_id=p_student AND i.unit_id=p_unit AND i.action='unlock' AND i.is_active)
 OR NOT EXISTS(SELECT 1 FROM public.learning_units prev JOIN public.learning_units u ON u.id=p_unit
 WHERE prev.is_path AND prev.is_active AND prev.level=u.level AND prev.sort_order=(SELECT max(x.sort_order) FROM public.learning_units x WHERE x.is_path AND x.is_active AND x.level=u.level AND x.sort_order<u.sort_order)
 AND NOT EXISTS(SELECT 1 FROM public.path_test_attempts a JOIN public.path_nodes n ON n.id=a.node_id WHERE a.auth_user_id=p_student AND n.unit_id=prev.id AND a.is_active AND a.status='completed' AND a.passed)));
$$;


--
-- Name: phases(jsonb); Type: FUNCTION; Schema: teacher_dashboard_private; Owner: -
--

CREATE FUNCTION teacher_dashboard_private.phases(p_counts jsonb) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
 SELECT jsonb_build_object('1',coalesce(p_counts->'1','0'),'2',coalesce(p_counts->'2','0'),'3',coalesce(p_counts->'3','0'),
 '4',coalesce(p_counts->'4','0'),'5',coalesce(p_counts->'5','0'),'6',coalesce(p_counts->'6','0'),'learned',coalesce(p_counts->'7','0'));
$$;


--
-- Name: students(uuid); Type: FUNCTION; Schema: teacher_dashboard_private; Owner: -
--

CREATE FUNCTION teacher_dashboard_private.students(p_student uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
 WITH students AS MATERIALIZED (SELECT p.* FROM public.profiles p WHERE p_student IS NULL OR p.id=p_student),
 activity_time AS (SELECT d.auth_user_id,max(coalesce(d.last_activity_at,d.day::timestamp AT TIME ZONE 'Europe/Berlin')) last_active,
 sum(d.study_seconds) FILTER(WHERE d.day>=(now() AT TIME ZONE 'Europe/Berlin')::date-6) seconds7,
 sum(d.study_seconds) FILTER(WHERE d.day>=(now() AT TIME ZONE 'Europe/Berlin')::date-29) seconds30
 FROM public.learning_activity_days d JOIN students s ON s.id=d.auth_user_id GROUP BY d.auth_user_id),
 historical_activity AS (SELECT events.auth_user_id,max(events.happened) last_active FROM (
 SELECT r.auth_user_id,r.updated_at happened FROM public.path_practice_runs r JOIN students s ON s.id=r.auth_user_id WHERE r.updated_at>r.created_at OR r.status='completed'
 UNION ALL SELECT a.auth_user_id,coalesce(a.completed_at,a.created_at) FROM public.path_test_attempts a JOIN students s ON s.id=a.auth_user_id
 UNION ALL SELECT sub.auth_user_id,sub.created_at FROM public.submissions sub JOIN students s ON s.id=sub.auth_user_id
 UNION ALL SELECT sub.auth_user_id,m.created_at FROM public.pronunciation_messages m JOIN public.submissions sub ON sub.id=m.submission_id JOIN students s ON s.id=sub.auth_user_id WHERE m.sender_id=sub.auth_user_id
 ) events GROUP BY events.auth_user_id),
 activity AS (SELECT s.id auth_user_id,greatest(a.last_active,h.last_active) last_active,a.seconds7,a.seconds30 FROM students s LEFT JOIN activity_time a ON a.auth_user_id=s.id LEFT JOIN historical_activity h ON h.auth_user_id=s.id),
 streak_rows AS (SELECT d.auth_user_id,d.day,row_number() OVER(PARTITION BY d.auth_user_id ORDER BY d.day DESC) rn,
 max(d.day) OVER(PARTITION BY d.auth_user_id) latest FROM public.learning_activity_days d JOIN students s ON s.id=d.auth_user_id),
 streaks AS (SELECT auth_user_id,count(*) days FROM streak_rows WHERE latest>=(now() AT TIME ZONE 'Europe/Berlin')::date-1 AND day=latest-(rn::int-1) GROUP BY auth_user_id),
 cards AS MATERIALIZED (SELECT p.auth_user_id,c.id,u.id unit_id,u.level,
 CASE WHEN count(*)=2 AND bool_and(p.box_number=7) THEN 7 ELSE least(6,min(p.box_number)) END phase,
 bool_or(p.box_number<7 AND p.next_review_date<=now()) due
 FROM public.vocabulary_direction_progress p JOIN students s ON s.id=p.auth_user_id JOIN public.learning_vocabulary_cards c ON c.id=p.card_id
 JOIN public.learning_units u ON u.id=c.unit_id AND u.is_active AND u.owner_auth_user_id IS NULL GROUP BY p.auth_user_id,c.id,u.id,u.level),
 buckets AS (SELECT auth_user_id,phase,count(*) n FROM cards GROUP BY auth_user_id,phase),
 distribution AS (SELECT auth_user_id,teacher_dashboard_private.phases(jsonb_object_agg(phase,n)) phases FROM buckets GROUP BY auth_user_id),
 eligible_units AS MATERIALIZED (SELECT cu.auth_user_id,cu.unit_id FROM (SELECT DISTINCT auth_user_id,unit_id,level FROM cards) cu
 WHERE NOT EXISTS(SELECT 1 FROM public.vocabulary_lesson_pauses p WHERE p.auth_user_id=cu.auth_user_id AND p.unit_id=cu.unit_id)
 AND (teacher_dashboard_private.unit_allowed(cu.auth_user_id,cu.unit_id) OR EXISTS(SELECT 1 FROM public.vocabulary_carryover_preferences pref
 JOIN public.learning_levels target ON target.code=pref.target_level JOIN public.learning_levels source ON source.code=cu.level
 JOIN public.student_level_access a ON a.auth_user_id=cu.auth_user_id AND a.level=target.code
 JOIN students student ON student.id=cu.auth_user_id AND student.ui_language<>'de'
 LEFT JOIN public.learning_trainer_grants grant_ ON grant_.auth_user_id=cu.auth_user_id AND grant_.level=target.code AND grant_.trainer='vocabulary'
 WHERE pref.auth_user_id=cu.auth_user_id AND pref.enabled AND pref.is_active AND target.is_active AND source.sort_order<target.sort_order AND coalesce(grant_.enabled,true)))),
 due AS (SELECT c.auth_user_id,count(*) n FROM cards c JOIN eligible_units eligible USING(auth_user_id,unit_id) WHERE c.due GROUP BY c.auth_user_id),
 answer_events AS (SELECT r.auth_user_id,r.response->>'isCorrect'='true' correct
 FROM vocabulary_private.answer_receipts r JOIN students s ON s.id=r.auth_user_id
 JOIN public.vocabulary_direction_progress p ON p.id=r.progress_id AND p.auth_user_id=r.auth_user_id
 JOIN public.learning_vocabulary_cards c ON c.id=p.card_id JOIN public.learning_units u ON u.id=c.unit_id AND u.owner_auth_user_id IS NULL
 WHERE r.created_at>=now()-interval '7 days'
 UNION ALL SELECT r.auth_user_id,receipt.response->'grade'->>'status' IN('EXACT','SOFT_ERROR')
 FROM path_private.answer_receipts receipt JOIN public.path_practice_runs r ON r.id=receipt.run_id JOIN students s ON s.id=r.auth_user_id
 WHERE receipt.created_at>=now()-interval '7 days' AND receipt.response->'grade'->>'status' IN('EXACT','SOFT_ERROR','INCORRECT')
 UNION ALL SELECT a.auth_user_id,answer.result->>'status' IN('EXACT','SOFT_ERROR') FROM public.path_test_answers answer
 JOIN public.path_test_attempts a ON a.id=answer.attempt_id JOIN students s ON s.id=a.auth_user_id
 WHERE a.completed_at>=now()-interval '7 days' AND answer.result->>'status' IN('EXACT','SOFT_ERROR','INCORRECT')),
 accuracy AS (SELECT auth_user_id,count(*) total,count(*) FILTER(WHERE correct) correct FROM answer_events GROUP BY auth_user_id),
 last_tests AS (SELECT DISTINCT ON(a.auth_user_id) a.auth_user_id,a.percentage,a.passed,a.completed_at FROM public.path_test_attempts a JOIN students s ON s.id=a.auth_user_id
 WHERE a.is_active AND a.status='completed' ORDER BY a.auth_user_id,a.completed_at DESC,a.id DESC),
 test_order AS (SELECT a.auth_user_id,a.node_id,a.passed,row_number() OVER(PARTITION BY a.auth_user_id,a.node_id ORDER BY a.completed_at DESC,a.id DESC) rn
 FROM public.path_test_attempts a JOIN students s ON s.id=a.auth_user_id WHERE a.is_active AND a.status='completed'),
 failed AS (SELECT DISTINCT auth_user_id FROM test_order WHERE rn<=2 GROUP BY auth_user_id,node_id HAVING count(*)=2 AND bool_and(NOT passed)),
 completed_units AS MATERIALIZED (SELECT DISTINCT a.auth_user_id,n.unit_id FROM public.path_test_attempts a JOIN students s ON s.id=a.auth_user_id JOIN public.path_nodes n ON n.id=a.node_id WHERE a.is_active AND a.status='completed' AND a.passed),
 progress_events AS (SELECT p.auth_user_id,n.unit_id,p.status='completed' completed,p.updated_at last_active
 FROM public.path_node_progress p JOIN students s ON s.id=p.auth_user_id JOIN public.path_nodes n ON n.id=p.node_id AND n.is_active WHERE p.is_active
 UNION ALL SELECT a.auth_user_id,n.unit_id,false,coalesce(a.completed_at,a.created_at) FROM public.path_test_attempts a JOIN students s ON s.id=a.auth_user_id JOIN public.path_nodes n ON n.id=a.node_id AND n.is_active WHERE a.is_active),
 progress AS (SELECT auth_user_id,unit_id,count(*) FILTER(WHERE completed) completed,max(last_active) last_active FROM progress_events GROUP BY auth_user_id,unit_id),
 position AS (SELECT DISTINCT ON(p.auth_user_id) p.auth_user_id,u.id,u.path_title,p.completed,(SELECT count(*) FROM public.path_nodes n WHERE n.unit_id=u.id AND n.is_active) total
 FROM progress p JOIN public.learning_units u ON u.id=p.unit_id AND u.is_active ORDER BY p.auth_user_id,p.last_active DESC,u.sort_order),
 completed_levels AS (SELECT s.id auth_user_id,u.level,count(*) FILTER(WHERE cu.unit_id IS NOT NULL) completed,count(*) total
 FROM students s CROSS JOIN public.learning_units u LEFT JOIN completed_units cu ON cu.auth_user_id=s.id AND cu.unit_id=u.id
 WHERE u.is_path AND u.is_active GROUP BY s.id,u.level),
 level_summaries AS (SELECT auth_user_id,jsonb_agg(jsonb_build_object('level',level,'completed',completed,'total',total) ORDER BY level) value FROM completed_levels GROUP BY auth_user_id),
 levels AS (SELECT a.auth_user_id,jsonb_agg(a.level ORDER BY l.sort_order) value FROM public.student_level_access a JOIN students s ON s.id=a.auth_user_id JOIN public.learning_levels l ON l.code=a.level GROUP BY a.auth_user_id),
 grants AS (SELECT g.auth_user_id,jsonb_agg(jsonb_build_object('level',g.level,'trainer',g.trainer,'enabled',g.enabled,'unit_ids',CASE WHEN g.unit_mode='all' THEN NULL ELSE coalesce((SELECT jsonb_agg(ug.unit_id) FROM public.learning_unit_grants ug WHERE ug.auth_user_id=g.auth_user_id AND ug.level=g.level AND ug.trainer=g.trainer),'[]') END)) value FROM public.learning_trainer_grants g JOIN students s ON s.id=g.auth_user_id GROUP BY g.auth_user_id),
 level_events AS (
 SELECT ls.auth_user_id,ls.level,ls.ended_at happened FROM public.learning_sessions ls JOIN students s ON s.id=ls.auth_user_id WHERE ls.is_active
 UNION ALL SELECT p.auth_user_id,u.level,p.last_answered_at FROM public.vocabulary_direction_progress p JOIN students s ON s.id=p.auth_user_id JOIN public.learning_vocabulary_cards c ON c.id=p.card_id JOIN public.learning_units u ON u.id=c.unit_id WHERE p.last_answered_at IS NOT NULL AND u.owner_auth_user_id IS NULL
 UNION ALL SELECT r.auth_user_id,coalesce(r.target_level,u.level),r.created_at FROM vocabulary_private.answer_receipts r JOIN students s ON s.id=r.auth_user_id JOIN public.vocabulary_direction_progress p ON p.id=r.progress_id JOIN public.learning_vocabulary_cards c ON c.id=p.card_id JOIN public.learning_units u ON u.id=c.unit_id WHERE u.owner_auth_user_id IS NULL
 UNION ALL SELECT pe.auth_user_id,u.level,pe.last_active FROM progress_events pe JOIN public.learning_units u ON u.id=pe.unit_id
 UNION ALL SELECT sub.auth_user_id,sub.level,sub.created_at FROM public.submissions sub JOIN students s ON s.id=sub.auth_user_id),
 last_level AS (SELECT DISTINCT ON(e.auth_user_id) e.auth_user_id,e.level FROM level_events e WHERE e.happened IS NOT NULL ORDER BY e.auth_user_id,e.happened DESC,e.level)
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'role',s.role,'created_at',s.created_at,
 'person',CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object('display_name',p.display_name,'email',p.email,'phone',p.phone,'street',p.street,'postal_code',p.postal_code,'city',p.city) END,
 'allowed_levels',coalesce(l.value,'[]'),'trainer_grants',coalesce(g.value,'[]'),
 'lastActiveAt',a.last_active,'learningSeconds7d',coalesce(a.seconds7,0),'learningSeconds30d',coalesce(a.seconds30,0),'streakDays',coalesce(st.days,0),
 'currentLevel',coalesce(ll.level,l.value->>0),'pathPosition',CASE WHEN pos.id IS NULL THEN NULL ELSE jsonb_build_object('unitId',pos.id,'title',pos.path_title,'completedNodes',pos.completed,'totalNodes',pos.total) END,
 'lastTest',CASE WHEN lt.auth_user_id IS NULL THEN NULL ELSE jsonb_build_object('percentage',lt.percentage,'passed',lt.passed,'completedAt',lt.completed_at) END,
 'dueCards',coalesce(d.n,0),'phases',coalesce(dist.phases,teacher_dashboard_private.phases('{}')),
 'attentionReasons',to_jsonb(array_remove(ARRAY[
 CASE WHEN coalesce(a.last_active,s.created_at)<=now()-interval '7 days' THEN 'inactive_7_days' END,
 CASE WHEN f.auth_user_id IS NOT NULL THEN 'failed_test_twice' END,
 CASE WHEN d.n>150 THEN 'over_150_due_cards' END,
 CASE WHEN ac.total>0 AND ac.correct*2<ac.total THEN 'accuracy_below_50' END],NULL)),
 'completedPathsByLevel',coalesce(ls.value,'[]')) ORDER BY lower(coalesce(p.display_name,'')),s.id),'[]')
 FROM students s LEFT JOIN public.people p ON p.auth_user_id=s.id LEFT JOIN activity a ON a.auth_user_id=s.id LEFT JOIN streaks st ON st.auth_user_id=s.id
 LEFT JOIN levels l ON l.auth_user_id=s.id LEFT JOIN grants g ON g.auth_user_id=s.id LEFT JOIN due d ON d.auth_user_id=s.id LEFT JOIN distribution dist ON dist.auth_user_id=s.id
 LEFT JOIN accuracy ac ON ac.auth_user_id=s.id LEFT JOIN failed f ON f.auth_user_id=s.id LEFT JOIN last_tests lt ON lt.auth_user_id=s.id
 LEFT JOIN position pos ON pos.auth_user_id=s.id LEFT JOIN level_summaries ls ON ls.auth_user_id=s.id LEFT JOIN last_level ll ON ll.auth_user_id=s.id;
$$;


--
-- Name: unit_allowed(uuid, uuid); Type: FUNCTION; Schema: teacher_dashboard_private; Owner: -
--

CREATE FUNCTION teacher_dashboard_private.unit_allowed(p_student uuid, p_unit uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
 SELECT EXISTS(SELECT 1 FROM public.learning_units u JOIN public.profiles p ON p.id=p_student
 JOIN public.student_level_access a ON a.auth_user_id=p_student AND a.level=u.level
 LEFT JOIN public.learning_trainer_grants g ON g.auth_user_id=p_student AND g.level=u.level AND g.trainer=u.trainer
 WHERE u.id=p_unit AND u.is_active AND p.ui_language<>'de' AND coalesce(g.enabled,true)
 AND (u.owner_auth_user_id=p_student OR (u.owner_auth_user_id IS NULL AND (g.unit_mode IS DISTINCT FROM 'selected' OR EXISTS(
 SELECT 1 FROM public.learning_unit_grants ug WHERE ug.auth_user_id=p_student AND ug.unit_id=u.id AND ug.level=u.level AND ug.trainer=u.trainer)))));
$$;


--
-- Name: allowed(text, text); Type: FUNCTION; Schema: trainer_access_private; Owner: -
--

CREATE FUNCTION trainer_access_private.allowed(p_level text, p_trainer text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND(
 p.role IN('teacher','admin') OR(p.ui_language<>'de' AND p_trainer IN('vocabulary','exercises','pronunciation','videos')
 AND EXISTS(SELECT 1 FROM public.student_level_access l WHERE l.auth_user_id=p.id AND l.level=p_level)
 AND coalesce((SELECT a.enabled FROM public.learning_trainer_grants a WHERE a.auth_user_id=p.id AND a.level=p_level AND a.trainer::text=p_trainer),true))));
$$;


--
-- Name: audio_readable(text, text); Type: FUNCTION; Schema: trainer_access_private; Owner: -
--

CREATE FUNCTION trainer_access_private.audio_readable(p_bucket text, p_name text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT CASE WHEN p_bucket <> 'pronunciation_audio' THEN true
 WHEN (SELECT identity_private.current_profile_role()) IN ('teacher','admin') THEN true
 WHEN EXISTS(SELECT 1 FROM public.submissions s WHERE s.content_url='storage://pronunciation_audio/'||p_name)
   OR EXISTS(SELECT 1 FROM public.pronunciation_messages m WHERE m.audio_path='storage://pronunciation_audio/'||p_name)
 THEN EXISTS(SELECT 1 FROM public.submissions s WHERE s.content_url='storage://pronunciation_audio/'||p_name AND pronunciation_private.can_access_submission(s.id))
   OR EXISTS(SELECT 1 FROM public.pronunciation_messages m WHERE m.audio_path='storage://pronunciation_audio/'||p_name AND pronunciation_private.can_access_submission(m.submission_id))
 ELSE trainer_access_private.can_record() END;
$$;


--
-- Name: can_record(); Type: FUNCTION; Schema: trainer_access_private; Owner: -
--

CREATE FUNCTION trainer_access_private.can_record() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND
 (p.role IN('teacher','admin') OR EXISTS(SELECT 1 FROM public.learning_units u WHERE u.trainer='pronunciation'
 AND trainer_access_private.unit_allowed(u.level,u.trainer::text,u.id::text))));
$$;


--
-- Name: unit_allowed(text, text, text); Type: FUNCTION; Schema: trainer_access_private; Owner: -
--

CREATE FUNCTION trainer_access_private.unit_allowed(p_level text, p_trainer text, p_unit text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT trainer_access_private.allowed(p_level,p_trainer) AND EXISTS(SELECT 1 FROM public.learning_units u
 WHERE u.level=p_level AND u.trainer::text=p_trainer AND u.id::text=p_unit AND(
 (SELECT identity_private.current_profile_role()) IN('teacher','admin') OR(u.is_active AND NOT EXISTS(
 SELECT 1 FROM public.learning_trainer_grants a WHERE a.auth_user_id=(SELECT auth.uid()) AND a.level=p_level AND a.trainer::text=p_trainer
 AND a.unit_mode='selected' AND NOT EXISTS(SELECT 1 FROM public.learning_unit_grants g
 WHERE g.auth_user_id=a.auth_user_id AND g.level=a.level AND g.trainer=a.trainer AND g.unit_id=u.id)))));
$$;


--
-- Name: add_own_word(text, text, text, text, text); Type: FUNCTION; Schema: vocabulary_private; Owner: -
--

CREATE FUNCTION vocabulary_private.add_own_word(p_level text, p_word_de text, p_article text, p_translation text, p_locale text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=auth.uid(); own_unit uuid; new_card uuid; activated boolean;
 word text:=btrim(regexp_replace(coalesce(p_word_de,''),'\s+',' ','g'));
 translated text:=btrim(regexp_replace(coalesce(p_translation,''),'\s+',' ','g'));
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF NOT trainer_access_private.allowed(p_level,'vocabulary') THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 -- Die Übersetzung steht in der Sprache der Oberfläche: Daraus fragt der
 -- Trainer die Richtung Deutsch → eigene Sprache ab (answer_key).
 IF p_locale IS NULL OR p_locale NOT IN('en','ru','uk','tr') THEN RAISE EXCEPTION 'invalid_language' USING ERRCODE='22023'; END IF;
 IF length(word) NOT BETWEEN 1 AND 120 OR length(translated) NOT BETWEEN 1 AND 200
  OR (p_article IS NOT NULL AND p_article NOT IN('der','die','das')) THEN
  RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 SELECT id INTO own_unit FROM public.learning_units WHERE owner_auth_user_id=actor AND level=p_level AND trainer='vocabulary';
 IF own_unit IS NULL THEN
  INSERT INTO public.learning_units(level,trainer,label,sort_order,is_active,owner_auth_user_id)
   VALUES(p_level,'vocabulary','Eigene Wörter',1000000,true,actor) RETURNING id INTO own_unit;
 END IF;
 -- 1000 = eine initialize_vocabulary_cards-Anfrage aktiviert die ganze Lektion.
 IF (SELECT count(*) FROM public.learning_vocabulary_cards c WHERE c.unit_id=own_unit)>=1000 THEN
  RAISE EXCEPTION 'own_word_limit' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.learning_vocabulary_cards c WHERE c.unit_id=own_unit
  AND lower(c.word_de)=lower(word) AND coalesce(c.article::text,'')=coalesce(p_article,'')) THEN
  RAISE EXCEPTION 'own_word_exists' USING ERRCODE='23505'; END IF;
 activated:=EXISTS(SELECT 1 FROM public.vocabulary_direction_progress v JOIN public.learning_vocabulary_cards c ON c.id=v.card_id
  WHERE v.auth_user_id=actor AND c.unit_id=own_unit);
 INSERT INTO public.learning_vocabulary_cards(unit_id,word_de,article,sentence_practice)
  VALUES(own_unit,word,p_article::public.grammatical_article,false) RETURNING id INTO new_card;
 INSERT INTO public.vocabulary_translations(card_id,locale,translation) VALUES(new_card,p_locale,translated);
 IF activated THEN
  INSERT INTO public.vocabulary_direction_progress(auth_user_id,card_id,direction,box_number,next_review_date)
   SELECT actor,new_card,d::public.vocabulary_direction,1,now() FROM unnest(ARRAY['de_to_native','native_to_de']) d;
 END IF;
 RETURN jsonb_build_object('cardId',new_card,'activated',activated);
END $$;


--
-- Name: answer_article_feedback(text, text, text, text); Type: FUNCTION; Schema: vocabulary_private; Owner: -
--

CREATE FUNCTION vocabulary_private.answer_article_feedback(p_input text, p_word text, p_article text, p_plural text) RETURNS vocabulary_private.article_feedback
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO ''
    AS $_$
DECLARE input_value text:=lower(learning_private.answer_without_punctuation(p_input));
 word text:=lower(learning_private.answer_without_punctuation(p_word));
 plural text:=CASE WHEN btrim(coalesce(p_plural,'')) NOT IN ('','-','–','—')
  THEN lower(learning_private.answer_without_punctuation(p_plural)) END;
 parts text[];
BEGIN
 IF p_article IS NULL OR p_article='none' THEN RETURN NULL; END IF;
 IF input_value=word OR input_value=plural THEN RETURN 'article_missing'; END IF;
 parts:=regexp_match(input_value,'^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines) (.+)$');
 IF parts IS NOT NULL AND (parts[2]=word OR parts[2]=plural)
  AND NOT (coalesce(parts[2]=word AND parts[1]=p_article,false)
    OR coalesce(parts[2]=plural AND parts[1]='die',false)) THEN RETURN 'article_wrong'; END IF;
 RETURN NULL;
END $_$;


--
-- Name: answer_key(uuid, text, text); Type: FUNCTION; Schema: vocabulary_private; Owner: -
--

CREATE FUNCTION vocabulary_private.answer_key(p_card_id uuid, p_direction text, p_ui_language text, OUT canonical text, OUT accepted text[]) RETURNS record
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
DECLARE card public.learning_vocabulary_cards; translated text; prompt text; plural text;
BEGIN
 SELECT * INTO card FROM public.learning_vocabulary_cards WHERE id=p_card_id;
 SELECT translation,context_sentence INTO translated,prompt FROM public.vocabulary_translations WHERE card_id=card.id AND locale=p_ui_language;
 translated:=vocabulary_private.card_translation(card.id,p_ui_language);
 IF card.sentence_practice AND p_direction='native_to_de' THEN
  SELECT context_sentence INTO canonical FROM public.vocabulary_translations WHERE card_id=card.id AND locale='de';
  IF nullif(btrim(prompt),'') IS NULL OR nullif(btrim(canonical),'') IS NULL THEN
   RAISE EXCEPTION 'sentence_content_missing' USING ERRCODE='23514'; END IF;
  accepted:=ARRAY[canonical]||coalesce(card.alternative_answers_de,ARRAY[]::text[]);
 ELSIF p_direction='native_to_de' THEN
  canonical:=concat_ws(' ',nullif(nullif(card.article::text,'none'),''),card.word_de);
  accepted:=ARRAY[canonical];
  -- Vokabeln werden oft als "der Papa / die Papas" gelernt. Für echte Nomen
  -- (mit Artikel) mit echtem Plural (nicht dem Platzhalter "-") gelten daher
  -- auch die Pluralform, der stehende Plural-Artikel "die" und die kombinierte
  -- Wörterbuchform als richtig. Der Singular bleibt die angezeigte Musterlösung.
  plural:=nullif(btrim(coalesce(card.plural,'')),'');
  IF card.article IS NOT NULL AND card.article::text<>'none'
     AND plural IS NOT NULL AND plural NOT IN ('-','–','—') THEN
   accepted:=accepted
     ||('die '||plural)
     ||plural
     ||(canonical||' / die '||plural)
     ||(canonical||', die '||plural);
  END IF;
 ELSE
  canonical:=translated; accepted:=ARRAY[canonical];
 END IF;
 IF nullif(btrim(canonical),'') IS NULL THEN RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE='23514'; END IF;
END $$;


--
-- Name: card_translation(uuid, text); Type: FUNCTION; Schema: vocabulary_private; Owner: -
--

CREATE FUNCTION vocabulary_private.card_translation(p_card_id uuid, p_ui_language text) RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
 SELECT coalesce(
  (SELECT t.translation FROM public.vocabulary_translations t
    WHERE t.card_id=p_card_id AND t.locale=p_ui_language AND nullif(btrim(t.translation),'') IS NOT NULL),
  (SELECT t.translation FROM public.vocabulary_translations t
    JOIN public.learning_vocabulary_cards c ON c.id=t.card_id
    JOIN public.learning_units u ON u.id=c.unit_id
    WHERE t.card_id=p_card_id AND u.owner_auth_user_id IS NOT NULL AND t.locale<>'de'
     AND nullif(btrim(t.translation),'') IS NOT NULL
    ORDER BY t.locale LIMIT 1));
$$;


--
-- Name: carryover_candidates(text); Type: FUNCTION; Schema: vocabulary_private; Owner: -
--

CREATE FUNCTION vocabulary_private.carryover_candidates(p_target_level text) RETURNS TABLE(card_id uuid, origin_level text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT c.id,u.level FROM public.learning_vocabulary_cards c
 JOIN public.learning_units u ON u.id=c.unit_id
 JOIN public.learning_levels source ON source.code=u.level
 JOIN public.learning_levels target ON target.code=p_target_level
 JOIN public.vocabulary_direction_progress p ON p.card_id=c.id AND p.auth_user_id=(SELECT auth.uid())
 WHERE target.is_active AND trainer_access_private.allowed(target.code,'vocabulary')
  AND source.sort_order<target.sort_order AND u.trainer='vocabulary' AND u.is_active
  AND (u.owner_auth_user_id IS NULL OR u.owner_auth_user_id=(SELECT auth.uid()))
  AND NOT EXISTS(SELECT 1 FROM public.vocabulary_lesson_pauses paused
   WHERE paused.auth_user_id=p.auth_user_id AND paused.unit_id=u.id)
 GROUP BY c.id,u.level,source.sort_order
 HAVING count(*) FILTER(WHERE p.box_number=7)<2
 ORDER BY source.sort_order,c.id
$$;


--
-- Name: carryover_error(text, text); Type: FUNCTION; Schema: vocabulary_private; Owner: -
--

CREATE FUNCTION vocabulary_private.carryover_error(p_message text, p_state text) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
 SELECT jsonb_build_object('error',CASE WHEN p_message=ANY(ARRAY[
  'authentication_required','trainer_access_denied','invalid_input','invalid_language','answer_required',
  'answer_too_long','progress_not_found','review_not_due','vocabulary_spacing_required',
  'exercise_unavailable','invalid_answer_request','invalid_learning_language','vocabulary_request_conflict',
  'retry_not_available','flashcard_not_allowed','sentence_content_missing','learning_reset_in_progress'])
 THEN p_message WHEN p_state='42501' THEN 'not_authorized' ELSE 'request_failed' END,
 'message','The vocabulary request could not be completed.','sqlstate',p_state)
$$;


--
-- Name: check_retry_answer(uuid, text, text); Type: FUNCTION; Schema: vocabulary_private; Owner: -
--

CREATE FUNCTION vocabulary_private.check_retry_answer(p_progress_id uuid, p_typed_answer text, p_ui_language text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=auth.uid(); progress public.vocabulary_direction_progress; card public.learning_vocabulary_cards;
 solution record; grade jsonb; correct boolean; feedback vocabulary_private.article_feedback;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_ui_language IS NULL OR p_ui_language NOT IN('de','en','ru','uk','tr') THEN
  RAISE EXCEPTION 'invalid_language' USING ERRCODE='22023'; END IF;
 IF length(p_typed_answer)>4000 THEN RAISE EXCEPTION 'answer_too_long' USING ERRCODE='22023'; END IF;
 IF p_typed_answer IS NULL OR learning_private.normalize_answer(p_typed_answer)='' THEN
  RAISE EXCEPTION 'answer_required' USING ERRCODE='22023'; END IF;
 SELECT * INTO progress FROM public.vocabulary_direction_progress WHERE id=p_progress_id AND auth_user_id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'progress_not_found' USING ERRCODE='42501'; END IF;
 SELECT * INTO card FROM public.learning_vocabulary_cards WHERE id=progress.card_id;
 IF NOT learning_private.unit_allowed(card.unit_id) OR p_ui_language='de' THEN
  RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 IF progress.last_answered_at IS NULL OR progress.last_answered_at<vocabulary_private.review_day(0)
  OR progress.next_review_date<=now() THEN
  RAISE EXCEPTION 'retry_not_available' USING ERRCODE='PT409'; END IF;
 SELECT * INTO solution FROM vocabulary_private.answer_key(card.id,progress.direction::text,p_ui_language);
 grade:=learning_private.grade_answer(p_typed_answer,solution.accepted);
 PERFORM platform_private.require_rpc_success(grade);
 IF progress.direction='native_to_de' AND NOT card.sentence_practice THEN
  feedback:=vocabulary_private.answer_article_feedback(p_typed_answer,card.word_de,card.article::text,card.plural);
  IF feedback IS NOT NULL THEN
   grade:=jsonb_build_object('status','INCORRECT','matched',NULL,'reason',NULL,'hint',NULL);
  END IF;
 END IF;
 correct:=grade->>'status' IN('EXACT','SOFT_ERROR');
 RETURN jsonb_build_object('success',true,'isCorrect',correct,'correctAnswer',solution.canonical,
  'isAlternative',correct AND grade->>'matched' IS DISTINCT FROM solution.canonical,'softError',grade->'reason','hint',grade->'hint','feedback',feedback);
END $$;


--
-- Name: check_retry_answer(uuid, text, text, text); Type: FUNCTION; Schema: vocabulary_private; Owner: -
--

CREATE FUNCTION vocabulary_private.check_retry_answer(p_progress_id uuid, p_typed_answer text, p_ui_language text, p_target_level text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=auth.uid(); progress public.vocabulary_direction_progress; card public.learning_vocabulary_cards;
 solution record; grade jsonb; correct boolean; feedback vocabulary_private.article_feedback;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_ui_language IS NULL OR p_ui_language NOT IN('de','en','ru','uk','tr') THEN
  RAISE EXCEPTION 'invalid_language' USING ERRCODE='22023'; END IF;
 IF length(p_typed_answer)>4000 THEN RAISE EXCEPTION 'answer_too_long' USING ERRCODE='22023'; END IF;
 IF p_typed_answer IS NULL OR learning_private.normalize_answer(p_typed_answer)='' THEN
  RAISE EXCEPTION 'answer_required' USING ERRCODE='22023'; END IF;
 SELECT * INTO progress FROM public.vocabulary_direction_progress WHERE id=p_progress_id AND auth_user_id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'progress_not_found' USING ERRCODE='42501'; END IF;
 SELECT * INTO card FROM public.learning_vocabulary_cards WHERE id=progress.card_id;
 IF NOT vocabulary_private.progress_allowed(progress.id,p_target_level) OR p_ui_language='de' THEN
  RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 IF progress.last_answered_at IS NULL OR progress.last_answered_at<vocabulary_private.review_day(0)
  OR progress.next_review_date<=now() THEN
  RAISE EXCEPTION 'retry_not_available' USING ERRCODE='PT409'; END IF;
 SELECT * INTO solution FROM vocabulary_private.answer_key(card.id,progress.direction::text,p_ui_language);
 grade:=learning_private.grade_answer(p_typed_answer,solution.accepted);
 PERFORM platform_private.require_rpc_success(grade);
 IF progress.direction='native_to_de' AND NOT card.sentence_practice THEN
  feedback:=vocabulary_private.answer_article_feedback(p_typed_answer,card.word_de,card.article::text,card.plural);
  IF feedback IS NOT NULL THEN
   grade:=jsonb_build_object('status','INCORRECT','matched',NULL,'reason',NULL,'hint',NULL);
  END IF;
 END IF;
 correct:=grade->>'status' IN('EXACT','SOFT_ERROR');
 RETURN jsonb_build_object('success',true,'isCorrect',correct,'correctAnswer',solution.canonical,
  'isAlternative',correct AND grade->>'matched' IS DISTINCT FROM solution.canonical,'softError',grade->'reason','hint',grade->'hint','feedback',feedback);
END $$;


--
-- Name: delete_own_unit_cards(); Type: FUNCTION; Schema: vocabulary_private; Owner: -
--

CREATE FUNCTION vocabulary_private.delete_own_unit_cards() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
 DELETE FROM public.learning_vocabulary_cards WHERE unit_id=OLD.id;
 RETURN OLD;
END $$;


--
-- Name: delete_own_word(uuid); Type: FUNCTION; Schema: vocabulary_private; Owner: -
--

CREATE FUNCTION vocabulary_private.delete_own_word(p_card_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 DELETE FROM public.learning_vocabulary_cards c USING public.learning_units u
  WHERE c.id=p_card_id AND u.id=c.unit_id AND u.owner_auth_user_id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE='P0002'; END IF;
 RETURN jsonb_build_object('success',true);
END $$;


--
-- Name: initialize_cards(jsonb); Type: FUNCTION; Schema: vocabulary_private; Owner: -
--

CREATE FUNCTION vocabulary_private.initialize_cards(p_decisions jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
      SELECT 1 FROM public.learning_vocabulary_cards c WHERE c.id=target AND learning_private.unit_allowed(c.unit_id)
    ) THEN RAISE EXCEPTION 'level_access_denied' USING ERRCODE = '42501'; END IF;
    INSERT INTO public.vocabulary_direction_progress(auth_user_id, card_id, direction, box_number, next_review_date)
      SELECT actor, target, d::public.vocabulary_direction, CASE WHEN known THEN 6 ELSE 1 END,
        CASE WHEN known THEN now() + interval '90 days' ELSE now() END
      FROM unnest(CASE WHEN selected_direction IS NULL THEN ARRAY['de_to_native','native_to_de'] ELSE ARRAY[selected_direction] END) d
      ON CONFLICT (auth_user_id, card_id, direction) DO NOTHING;
    GET DIAGNOSTICS touched = ROW_COUNT;
    -- The UI reports words, while each word has two independent records.
    IF touched > 0 THEN
      IF known THEN known_count := known_count + 1; ELSE new_count := new_count + 1; END IF;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('addedKnown', known_count, 'addedNew', new_count);
END;
$$;


--
-- Name: progress_allowed(uuid, text); Type: FUNCTION; Schema: vocabulary_private; Owner: -
--

CREATE FUNCTION vocabulary_private.progress_allowed(p_progress_id uuid, p_target_level text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT EXISTS(SELECT 1 FROM public.vocabulary_direction_progress p
  JOIN public.learning_vocabulary_cards c ON c.id=p.card_id
  JOIN public.learning_units u ON u.id=c.unit_id
  JOIN public.learning_levels source ON source.code=u.level
  JOIN public.learning_levels target ON target.code=p_target_level
  WHERE p.id=p_progress_id AND p.auth_user_id=(SELECT auth.uid())
   AND target.is_active AND trainer_access_private.allowed(target.code,'vocabulary')
   AND u.trainer='vocabulary' AND u.is_active
   AND (u.owner_auth_user_id IS NULL OR u.owner_auth_user_id=(SELECT auth.uid()))
   AND CASE WHEN u.level=p_target_level THEN learning_private.unit_allowed(u.id)
    ELSE source.sort_order<target.sort_order
     AND EXISTS(SELECT 1 FROM public.vocabulary_carryover_preferences pref
      WHERE pref.auth_user_id=p.auth_user_id AND pref.target_level=p_target_level AND pref.enabled AND pref.is_active)
     AND NOT EXISTS(SELECT 1 FROM public.vocabulary_lesson_pauses paused
      WHERE paused.auth_user_id=p.auth_user_id AND paused.unit_id=u.id) END)
$$;


--
-- Name: reset_lesson(uuid); Type: FUNCTION; Schema: vocabulary_private; Owner: -
--

CREATE FUNCTION vocabulary_private.reset_lesson(p_unit_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=auth.uid(); BEGIN
 IF actor IS NULL OR NOT learning_private.unit_allowed(p_unit_id)
 OR NOT EXISTS(SELECT 1 FROM public.learning_units WHERE id=p_unit_id AND trainer='vocabulary') THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 DELETE FROM public.vocabulary_direction_progress v USING public.learning_vocabulary_cards c WHERE v.auth_user_id=actor AND v.card_id=c.id AND c.unit_id=p_unit_id;
END $$;


--
-- Name: review_day(integer); Type: FUNCTION; Schema: vocabulary_private; Owner: -
--

CREATE FUNCTION vocabulary_private.review_day(p_days integer) RETURNS timestamp with time zone
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
 SELECT (date_trunc('day', now() AT TIME ZONE 'Europe/Berlin') + make_interval(days => p_days)) AT TIME ZONE 'Europe/Berlin'
$$;


--
-- Name: self_rating_allowed(integer, boolean); Type: FUNCTION; Schema: vocabulary_private; Owner: -
--

CREATE FUNCTION vocabulary_private.self_rating_allowed(p_box integer, p_sentence boolean) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
 SELECT true
$$;


--
-- Name: skip_assessment(text); Type: FUNCTION; Schema: vocabulary_private; Owner: -
--

CREATE FUNCTION vocabulary_private.skip_assessment(p_level text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid := auth.uid(); first_unit public.learning_units; decisions jsonb; result jsonb;
BEGIN
 IF actor IS NULL OR NOT trainer_access_private.allowed(p_level,'vocabulary') THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 SELECT u.* INTO first_unit FROM public.learning_units u WHERE u.level=p_level AND u.trainer='vocabulary'
 AND u.owner_auth_user_id IS NULL
 AND learning_private.unit_allowed(u.id) AND EXISTS(SELECT 1 FROM public.learning_vocabulary_cards c WHERE c.unit_id=u.id)
 ORDER BY u.sort_order,u.label,u.id LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'lesson_not_found' USING ERRCODE='22023'; END IF;
 SELECT jsonb_agg(jsonb_build_object('cardId',id,'alreadyKnown',false)) INTO decisions FROM public.learning_vocabulary_cards WHERE unit_id=first_unit.id;
 result:=vocabulary_private.initialize_cards(decisions);
 INSERT INTO public.vocabulary_onboarding(auth_user_id,level,status,started_unit_id) VALUES(actor,p_level,'skipped',first_unit.id)
 ON CONFLICT(auth_user_id,level) DO UPDATE SET status='skipped',started_unit_id=excluded.started_unit_id,updated_at=now();
 RETURN result||jsonb_build_object('lesson',first_unit.label);
END $$;


--
-- Name: submit_answer(uuid, boolean, text, text); Type: FUNCTION; Schema: vocabulary_private; Owner: -
--

CREATE FUNCTION vocabulary_private.submit_answer(p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=auth.uid(); progress public.vocabulary_direction_progress; card public.learning_vocabulary_cards;
 profile public.profiles; solution record; previous_card uuid; grade jsonb;
 feedback vocabulary_private.article_feedback; correct boolean; soft boolean; old_phase integer; new_phase integer;
 new_box integer; days integer; previous_days integer; difficult boolean; is_alternative boolean:=false;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_ui_language IS NULL OR p_ui_language NOT IN('de','en','ru','uk','tr') THEN
  RAISE EXCEPTION 'invalid_language' USING ERRCODE='22023'; END IF;
 IF length(p_typed_answer)>4000 THEN RAISE EXCEPTION 'answer_too_long' USING ERRCODE='22023'; END IF;
 IF p_typed_answer IS NULL OR learning_private.normalize_answer(p_typed_answer)='' THEN
  RAISE EXCEPTION 'answer_required' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 SELECT * INTO progress FROM public.vocabulary_direction_progress WHERE id=p_progress_id AND auth_user_id=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'progress_not_found' USING ERRCODE='42501'; END IF;
 SELECT * INTO card FROM public.learning_vocabulary_cards WHERE id=progress.card_id;
 SELECT * INTO profile FROM public.profiles WHERE id=actor;
 IF NOT learning_private.unit_allowed(card.unit_id) OR p_ui_language='de' THEN
  RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 IF progress.box_number=7 OR progress.next_review_date>now() THEN
  RAISE EXCEPTION 'review_not_due' USING ERRCODE='PT409'; END IF;
 SELECT last_card_id INTO previous_card FROM public.vocabulary_learning_state WHERE auth_user_id=actor;
 IF previous_card=progress.card_id THEN RAISE EXCEPTION 'vocabulary_spacing_required' USING ERRCODE='PT409'; END IF;
 SELECT * INTO solution FROM vocabulary_private.answer_key(card.id,progress.direction::text,p_ui_language);
 -- Every answer, in either direction, is graded from stored content. The legacy
 -- p_is_correct argument remains payload-bound for receipt compatibility only.
 grade:=learning_private.grade_answer(p_typed_answer,solution.accepted);
 PERFORM platform_private.require_rpc_success(grade);
 IF progress.direction='native_to_de' AND NOT card.sentence_practice THEN
  feedback:=vocabulary_private.answer_article_feedback(p_typed_answer,card.word_de,card.article::text,card.plural);
  IF feedback IS NOT NULL THEN
   grade:=jsonb_build_object('status','INCORRECT','matched',NULL,'reason',NULL,'hint',NULL);
  END IF;
 END IF;
 correct:=grade->>'status' IN('EXACT','SOFT_ERROR'); soft:=grade->>'status'='SOFT_ERROR';
 is_alternative:=correct AND grade->>'matched' IS DISTINCT FROM solution.canonical;
 old_phase:=least(6,greatest(1,coalesce(progress.box_number,1)));
 new_phase:=CASE WHEN correct THEN least(6,old_phase+1) ELSE greatest(1,old_phase-1) END;
 new_box:=CASE WHEN correct AND old_phase=6 THEN 7 ELSE new_phase END;
 IF correct THEN
  days:=CASE new_phase WHEN 1 THEN 1 WHEN 2 THEN 1 WHEN 3 THEN 3 WHEN 4 THEN 9 WHEN 5 THEN 29 ELSE 90 END;
  previous_days:=CASE old_phase WHEN 1 THEN 1 WHEN 2 THEN 1 WHEN 3 THEN 3 WHEN 4 THEN 9 WHEN 5 THEN 29 ELSE 90 END;
  IF soft THEN days:=least(days,previous_days); END IF;
  SELECT coalesce(t.is_difficult,false) INTO difficult FROM public.vocabulary_translations t WHERE t.card_id=card.id AND t.locale=profile.native_language;
  IF difficult THEN days:=greatest(1,days/2); END IF;
 ELSE
  -- Phase 6: Ein falscher erster Versuch kommt am nächsten Tag wieder.
  days:=1;
 END IF;
 UPDATE public.vocabulary_direction_progress SET box_number=new_box,next_review_date=vocabulary_private.review_day(days),
  lapses=lapses+CASE WHEN NOT correct THEN 1 ELSE 0 END,last_answered_at=now(),updated_at=now() WHERE id=progress.id;
 INSERT INTO public.vocabulary_learning_state(auth_user_id,last_card_id,last_reviewed_at) VALUES(actor,progress.card_id,now())
 ON CONFLICT(auth_user_id) DO UPDATE SET last_card_id=excluded.last_card_id,last_reviewed_at=excluded.last_reviewed_at;
 RETURN jsonb_build_object('success',true,'isCorrect',correct,'previousPhase',old_phase,'newPhase',new_phase,
  'becameLearned',new_box=7,'movedBack',new_phase<old_phase,'intervalInDays',days,
  'correctAnswer',solution.canonical,'isAlternative',is_alternative,'softError',grade->'reason','hint',grade->'hint','feedback',feedback);
END $$;


--
-- Name: submit_answer(uuid, boolean, text, text, text); Type: FUNCTION; Schema: vocabulary_private; Owner: -
--

CREATE FUNCTION vocabulary_private.submit_answer(p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text, p_target_level text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=auth.uid(); progress public.vocabulary_direction_progress; card public.learning_vocabulary_cards;
 profile public.profiles; solution record; previous_card uuid; grade jsonb;
 feedback vocabulary_private.article_feedback; correct boolean; soft boolean; old_phase integer; new_phase integer;
 new_box integer; days integer; previous_days integer; difficult boolean; is_alternative boolean:=false;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_ui_language IS NULL OR p_ui_language NOT IN('de','en','ru','uk','tr') THEN
  RAISE EXCEPTION 'invalid_language' USING ERRCODE='22023'; END IF;
 IF length(p_typed_answer)>4000 THEN RAISE EXCEPTION 'answer_too_long' USING ERRCODE='22023'; END IF;
 IF p_typed_answer IS NULL OR learning_private.normalize_answer(p_typed_answer)='' THEN
  RAISE EXCEPTION 'answer_required' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 SELECT * INTO progress FROM public.vocabulary_direction_progress WHERE id=p_progress_id AND auth_user_id=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'progress_not_found' USING ERRCODE='42501'; END IF;
 SELECT * INTO card FROM public.learning_vocabulary_cards WHERE id=progress.card_id;
 SELECT * INTO profile FROM public.profiles WHERE id=actor;
 IF NOT vocabulary_private.progress_allowed(progress.id,p_target_level) OR p_ui_language='de' THEN
  RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 IF progress.box_number=7 OR progress.next_review_date>now() THEN
  RAISE EXCEPTION 'review_not_due' USING ERRCODE='PT409'; END IF;
 SELECT last_card_id INTO previous_card FROM public.vocabulary_learning_state WHERE auth_user_id=actor;
 IF previous_card=progress.card_id THEN RAISE EXCEPTION 'vocabulary_spacing_required' USING ERRCODE='PT409'; END IF;
 SELECT * INTO solution FROM vocabulary_private.answer_key(card.id,progress.direction::text,p_ui_language);
 -- Every answer, in either direction, is graded from stored content. The legacy
 -- p_is_correct argument remains payload-bound for receipt compatibility only.
 grade:=learning_private.grade_answer(p_typed_answer,solution.accepted);
 PERFORM platform_private.require_rpc_success(grade);
 IF progress.direction='native_to_de' AND NOT card.sentence_practice THEN
  feedback:=vocabulary_private.answer_article_feedback(p_typed_answer,card.word_de,card.article::text,card.plural);
  IF feedback IS NOT NULL THEN
   grade:=jsonb_build_object('status','INCORRECT','matched',NULL,'reason',NULL,'hint',NULL);
  END IF;
 END IF;
 correct:=grade->>'status' IN('EXACT','SOFT_ERROR'); soft:=grade->>'status'='SOFT_ERROR';
 is_alternative:=correct AND grade->>'matched' IS DISTINCT FROM solution.canonical;
 old_phase:=least(6,greatest(1,coalesce(progress.box_number,1)));
 new_phase:=CASE WHEN correct THEN least(6,old_phase+1) ELSE greatest(1,old_phase-1) END;
 new_box:=CASE WHEN correct AND old_phase=6 THEN 7 ELSE new_phase END;
 IF correct THEN
  days:=CASE new_phase WHEN 1 THEN 1 WHEN 2 THEN 1 WHEN 3 THEN 3 WHEN 4 THEN 9 WHEN 5 THEN 29 ELSE 90 END;
  previous_days:=CASE old_phase WHEN 1 THEN 1 WHEN 2 THEN 1 WHEN 3 THEN 3 WHEN 4 THEN 9 WHEN 5 THEN 29 ELSE 90 END;
  IF soft THEN days:=least(days,previous_days); END IF;
  SELECT coalesce(t.is_difficult,false) INTO difficult FROM public.vocabulary_translations t WHERE t.card_id=card.id AND t.locale=profile.native_language;
  IF difficult THEN days:=greatest(1,days/2); END IF;
 ELSE
  -- Phase 6: Ein falscher erster Versuch kommt am nächsten Tag wieder.
  days:=1;
 END IF;
 PERFORM set_config('learning.session_target_level',coalesce(p_target_level,''),true); UPDATE public.vocabulary_direction_progress SET box_number=new_box,next_review_date=vocabulary_private.review_day(days),
  lapses=lapses+CASE WHEN NOT correct THEN 1 ELSE 0 END,last_answered_at=now(),updated_at=now() WHERE id=progress.id;
 INSERT INTO public.vocabulary_learning_state(auth_user_id,last_card_id,last_reviewed_at) VALUES(actor,progress.card_id,now())
 ON CONFLICT(auth_user_id) DO UPDATE SET last_card_id=excluded.last_card_id,last_reviewed_at=excluded.last_reviewed_at;
 RETURN jsonb_build_object('success',true,'isCorrect',correct,'previousPhase',old_phase,'newPhase',new_phase,
  'becameLearned',new_box=7,'movedBack',new_phase<old_phase,'intervalInDays',days,
  'correctAnswer',solution.canonical,'isAlternative',is_alternative,'softError',grade->'reason','hint',grade->'hint','feedback',feedback);
END $$;


--
-- Name: submit_answer_once(uuid, uuid, boolean, text, text); Type: FUNCTION; Schema: vocabulary_private; Owner: -
--

CREATE FUNCTION vocabulary_private.submit_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=auth.uid(); receipt vocabulary_private.answer_receipts; result jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_progress_id IS NULL OR p_ui_language IS NULL
  OR p_ui_language NOT IN('de','en','ru','uk','tr') OR length(p_typed_answer)>4000 THEN
  RAISE EXCEPTION 'invalid_answer_request' USING ERRCODE='22023'; END IF;
 -- Required before receipt lookup: an old bool-only request cannot bypass R5.
 IF p_typed_answer IS NULL OR learning_private.normalize_answer(p_typed_answer)='' THEN
  RAISE EXCEPTION 'answer_required' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 IF NOT EXISTS(SELECT 1 FROM public.vocabulary_direction_progress v JOIN public.learning_vocabulary_cards c ON c.id=v.card_id
  WHERE v.id=p_progress_id AND v.auth_user_id=actor AND learning_private.unit_allowed(c.unit_id)) THEN
  RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 IF p_ui_language='de' THEN RAISE EXCEPTION 'invalid_learning_language' USING ERRCODE='42501'; END IF;
 SELECT * INTO receipt FROM vocabulary_private.answer_receipts WHERE auth_user_id=actor AND request_id=p_request_id;
 IF FOUND THEN
  IF receipt.progress_id IS DISTINCT FROM p_progress_id OR receipt.is_correct IS DISTINCT FROM p_is_correct
   OR convert_to(receipt.typed_answer,'UTF8') IS DISTINCT FROM convert_to(p_typed_answer,'UTF8')
   OR receipt.ui_language IS DISTINCT FROM p_ui_language THEN
   RAISE EXCEPTION 'vocabulary_request_conflict' USING ERRCODE='22023'; END IF;
  IF NOT receipt.response ? 'correctAnswer' OR NOT receipt.response ? 'softError' THEN
   RAISE EXCEPTION 'invalid_answer_request' USING ERRCODE='22023'; END IF;
  -- Return before due/spacing checks; the already committed response is final.
  RETURN receipt.response;
 END IF;
 result:=vocabulary_private.submit_answer(p_progress_id,p_is_correct,p_typed_answer,p_ui_language);
 PERFORM platform_private.require_rpc_success(result);
 INSERT INTO vocabulary_private.answer_receipts(auth_user_id,request_id,progress_id,is_correct,typed_answer,ui_language,response)
 VALUES(actor,p_request_id,p_progress_id,p_is_correct,p_typed_answer,p_ui_language,result);
 RETURN result;
END $$;


--
-- Name: submit_answer_once(uuid, uuid, boolean, text, text, text); Type: FUNCTION; Schema: vocabulary_private; Owner: -
--

CREATE FUNCTION vocabulary_private.submit_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text, p_target_level text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=auth.uid(); receipt vocabulary_private.answer_receipts; result jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_progress_id IS NULL OR p_ui_language IS NULL
  OR p_ui_language NOT IN('de','en','ru','uk','tr') OR length(p_typed_answer)>4000 THEN
  RAISE EXCEPTION 'invalid_answer_request' USING ERRCODE='22023'; END IF;
 -- Required before receipt lookup: an old bool-only request cannot bypass R5.
 IF p_typed_answer IS NULL OR learning_private.normalize_answer(p_typed_answer)='' THEN
  RAISE EXCEPTION 'answer_required' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 IF NOT EXISTS(SELECT 1 FROM public.vocabulary_direction_progress v JOIN public.learning_vocabulary_cards c ON c.id=v.card_id
  WHERE v.id=p_progress_id AND v.auth_user_id=actor AND vocabulary_private.progress_allowed(v.id,p_target_level)) THEN
  RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 IF p_ui_language='de' THEN RAISE EXCEPTION 'invalid_learning_language' USING ERRCODE='42501'; END IF;
 SELECT * INTO receipt FROM vocabulary_private.answer_receipts WHERE auth_user_id=actor AND request_id=p_request_id;
 IF FOUND THEN
  IF receipt.progress_id IS DISTINCT FROM p_progress_id OR receipt.is_correct IS DISTINCT FROM p_is_correct
   OR convert_to(receipt.typed_answer,'UTF8') IS DISTINCT FROM convert_to(p_typed_answer,'UTF8')
   OR receipt.ui_language IS DISTINCT FROM p_ui_language OR receipt.target_level IS DISTINCT FROM p_target_level THEN
   RAISE EXCEPTION 'vocabulary_request_conflict' USING ERRCODE='22023'; END IF;
  IF NOT receipt.response ? 'correctAnswer' OR NOT receipt.response ? 'softError' THEN
   RAISE EXCEPTION 'invalid_answer_request' USING ERRCODE='22023'; END IF;
  -- Return before due/spacing checks; the already committed response is final.
  RETURN receipt.response;
 END IF;
 result:=vocabulary_private.submit_answer(p_progress_id,p_is_correct,p_typed_answer,p_ui_language,p_target_level);
 PERFORM platform_private.require_rpc_success(result);
 INSERT INTO vocabulary_private.answer_receipts(auth_user_id,request_id,progress_id,is_correct,typed_answer,ui_language,response,target_level)
 VALUES(actor,p_request_id,p_progress_id,p_is_correct,p_typed_answer,p_ui_language,result,p_target_level);
 RETURN result;
END $$;


--
-- Name: submit_self_rating(uuid, boolean, text); Type: FUNCTION; Schema: vocabulary_private; Owner: -
--

CREATE FUNCTION vocabulary_private.submit_self_rating(p_progress_id uuid, p_known boolean, p_ui_language text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=auth.uid(); progress public.vocabulary_direction_progress; card public.learning_vocabulary_cards;
 profile public.profiles; canonical text; translated text; previous_card uuid;
 sentence boolean; correct boolean; old_phase integer; new_phase integer; new_box integer; days integer; difficult boolean;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_ui_language IS NULL OR p_ui_language NOT IN('de','en','ru','uk','tr') THEN
  RAISE EXCEPTION 'invalid_language' USING ERRCODE='22023'; END IF;
 IF p_known IS NULL THEN RAISE EXCEPTION 'answer_required' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 SELECT * INTO progress FROM public.vocabulary_direction_progress WHERE id=p_progress_id AND auth_user_id=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'progress_not_found' USING ERRCODE='42501'; END IF;
 SELECT * INTO card FROM public.learning_vocabulary_cards WHERE id=progress.card_id;
 SELECT * INTO profile FROM public.profiles WHERE id=actor;
 IF NOT learning_private.unit_allowed(card.unit_id) OR p_ui_language='de' THEN
  RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 IF progress.box_number=7 OR progress.next_review_date>now() THEN
  RAISE EXCEPTION 'review_not_due' USING ERRCODE='PT409'; END IF;
 SELECT last_card_id INTO previous_card FROM public.vocabulary_learning_state WHERE auth_user_id=actor;
 IF previous_card=progress.card_id THEN RAISE EXCEPTION 'vocabulary_spacing_required' USING ERRCODE='PT409'; END IF;
 sentence:=card.sentence_practice AND progress.direction='native_to_de';
 -- R5 guard: a self-rating is only valid where the server itself allows the
 -- flashcard mode. Seit Phase 5.9 ist das jede Karte, Satz eingeschlossen.
 IF NOT vocabulary_private.self_rating_allowed(progress.box_number,sentence) THEN
  RAISE EXCEPTION 'flashcard_not_allowed' USING ERRCODE='PT409'; END IF;
 translated:=vocabulary_private.card_translation(card.id,p_ui_language);
 IF sentence THEN
  SELECT context_sentence INTO canonical FROM public.vocabulary_translations WHERE card_id=card.id AND locale='de';
 ELSIF progress.direction='native_to_de' THEN
  canonical:=concat_ws(' ',nullif(nullif(card.article::text,'none'),''),card.word_de);
 ELSE
  canonical:=translated;
 END IF;
 IF nullif(btrim(canonical),'') IS NULL THEN RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE='23514'; END IF;
 correct:=p_known;
 old_phase:=least(6,greatest(1,coalesce(progress.box_number,1)));
 new_phase:=CASE WHEN correct THEN least(6,old_phase+1) ELSE greatest(1,old_phase-1) END;
 new_box:=CASE WHEN correct AND old_phase=6 THEN 7 ELSE new_phase END;
 IF correct THEN
  days:=CASE new_phase WHEN 1 THEN 1 WHEN 2 THEN 1 WHEN 3 THEN 3 WHEN 4 THEN 9 WHEN 5 THEN 29 ELSE 90 END;
  SELECT coalesce(t.is_difficult,false) INTO difficult FROM public.vocabulary_translations t WHERE t.card_id=card.id AND t.locale=profile.native_language;
  IF difficult THEN days:=greatest(1,days/2); END IF;
 ELSE
  -- Phase 6: Ein falscher erster Versuch kommt am nächsten Tag wieder.
  days:=1;
 END IF;
 UPDATE public.vocabulary_direction_progress SET box_number=new_box,next_review_date=vocabulary_private.review_day(days),
  lapses=lapses+CASE WHEN NOT correct THEN 1 ELSE 0 END,last_answered_at=now(),updated_at=now() WHERE id=progress.id;
 INSERT INTO public.vocabulary_learning_state(auth_user_id,last_card_id,last_reviewed_at) VALUES(actor,progress.card_id,now())
 ON CONFLICT(auth_user_id) DO UPDATE SET last_card_id=excluded.last_card_id,last_reviewed_at=excluded.last_reviewed_at;
 RETURN jsonb_build_object('success',true,'isCorrect',correct,'previousPhase',old_phase,'newPhase',new_phase,
  'becameLearned',new_box=7,'movedBack',new_phase<old_phase,'intervalInDays',days,
  'correctAnswer',canonical,'isAlternative',false,'softError',null);
END $$;


--
-- Name: submit_self_rating(uuid, boolean, text, text); Type: FUNCTION; Schema: vocabulary_private; Owner: -
--

CREATE FUNCTION vocabulary_private.submit_self_rating(p_progress_id uuid, p_known boolean, p_ui_language text, p_target_level text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=auth.uid(); progress public.vocabulary_direction_progress; card public.learning_vocabulary_cards;
 profile public.profiles; canonical text; translated text; previous_card uuid;
 sentence boolean; correct boolean; old_phase integer; new_phase integer; new_box integer; days integer; difficult boolean;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_ui_language IS NULL OR p_ui_language NOT IN('de','en','ru','uk','tr') THEN
  RAISE EXCEPTION 'invalid_language' USING ERRCODE='22023'; END IF;
 IF p_known IS NULL THEN RAISE EXCEPTION 'answer_required' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 SELECT * INTO progress FROM public.vocabulary_direction_progress WHERE id=p_progress_id AND auth_user_id=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'progress_not_found' USING ERRCODE='42501'; END IF;
 SELECT * INTO card FROM public.learning_vocabulary_cards WHERE id=progress.card_id;
 SELECT * INTO profile FROM public.profiles WHERE id=actor;
 IF NOT vocabulary_private.progress_allowed(progress.id,p_target_level) OR p_ui_language='de' THEN
  RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 IF progress.box_number=7 OR progress.next_review_date>now() THEN
  RAISE EXCEPTION 'review_not_due' USING ERRCODE='PT409'; END IF;
 SELECT last_card_id INTO previous_card FROM public.vocabulary_learning_state WHERE auth_user_id=actor;
 IF previous_card=progress.card_id THEN RAISE EXCEPTION 'vocabulary_spacing_required' USING ERRCODE='PT409'; END IF;
 sentence:=card.sentence_practice AND progress.direction='native_to_de';
 -- R5 guard: a self-rating is only valid where the server itself allows the
 -- flashcard mode. Seit Phase 5.9 ist das jede Karte, Satz eingeschlossen.
 IF NOT vocabulary_private.self_rating_allowed(progress.box_number,sentence) THEN
  RAISE EXCEPTION 'flashcard_not_allowed' USING ERRCODE='PT409'; END IF;
 translated:=vocabulary_private.card_translation(card.id,p_ui_language);
 IF sentence THEN
  SELECT context_sentence INTO canonical FROM public.vocabulary_translations WHERE card_id=card.id AND locale='de';
 ELSIF progress.direction='native_to_de' THEN
  canonical:=concat_ws(' ',nullif(nullif(card.article::text,'none'),''),card.word_de);
 ELSE
  canonical:=translated;
 END IF;
 IF nullif(btrim(canonical),'') IS NULL THEN RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE='23514'; END IF;
 correct:=p_known;
 old_phase:=least(6,greatest(1,coalesce(progress.box_number,1)));
 new_phase:=CASE WHEN correct THEN least(6,old_phase+1) ELSE greatest(1,old_phase-1) END;
 new_box:=CASE WHEN correct AND old_phase=6 THEN 7 ELSE new_phase END;
 IF correct THEN
  days:=CASE new_phase WHEN 1 THEN 1 WHEN 2 THEN 1 WHEN 3 THEN 3 WHEN 4 THEN 9 WHEN 5 THEN 29 ELSE 90 END;
  SELECT coalesce(t.is_difficult,false) INTO difficult FROM public.vocabulary_translations t WHERE t.card_id=card.id AND t.locale=profile.native_language;
  IF difficult THEN days:=greatest(1,days/2); END IF;
 ELSE
  -- Phase 6: Ein falscher erster Versuch kommt am nächsten Tag wieder.
  days:=1;
 END IF;
 PERFORM set_config('learning.session_target_level',coalesce(p_target_level,''),true); UPDATE public.vocabulary_direction_progress SET box_number=new_box,next_review_date=vocabulary_private.review_day(days),
  lapses=lapses+CASE WHEN NOT correct THEN 1 ELSE 0 END,last_answered_at=now(),updated_at=now() WHERE id=progress.id;
 INSERT INTO public.vocabulary_learning_state(auth_user_id,last_card_id,last_reviewed_at) VALUES(actor,progress.card_id,now())
 ON CONFLICT(auth_user_id) DO UPDATE SET last_card_id=excluded.last_card_id,last_reviewed_at=excluded.last_reviewed_at;
 RETURN jsonb_build_object('success',true,'isCorrect',correct,'previousPhase',old_phase,'newPhase',new_phase,
  'becameLearned',new_box=7,'movedBack',new_phase<old_phase,'intervalInDays',days,
  'correctAnswer',canonical,'isAlternative',false,'softError',null);
END $$;


--
-- Name: submit_self_rating_once(uuid, uuid, boolean, text); Type: FUNCTION; Schema: vocabulary_private; Owner: -
--

CREATE FUNCTION vocabulary_private.submit_self_rating_once(p_request_id uuid, p_progress_id uuid, p_known boolean, p_ui_language text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=auth.uid(); receipt vocabulary_private.answer_receipts; result jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_progress_id IS NULL OR p_known IS NULL OR p_ui_language IS NULL
  OR p_ui_language NOT IN('de','en','ru','uk','tr') THEN
  RAISE EXCEPTION 'invalid_answer_request' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 IF NOT EXISTS(SELECT 1 FROM public.vocabulary_direction_progress v JOIN public.learning_vocabulary_cards c ON c.id=v.card_id
  WHERE v.id=p_progress_id AND v.auth_user_id=actor AND learning_private.unit_allowed(c.unit_id)) THEN
  RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 IF p_ui_language='de' THEN RAISE EXCEPTION 'invalid_learning_language' USING ERRCODE='42501'; END IF;
 -- Self-rating receipts share the table; they carry a null typed answer.
 SELECT * INTO receipt FROM vocabulary_private.answer_receipts WHERE auth_user_id=actor AND request_id=p_request_id;
 IF FOUND THEN
  IF receipt.progress_id IS DISTINCT FROM p_progress_id OR receipt.is_correct IS DISTINCT FROM p_known
   OR receipt.typed_answer IS NOT NULL OR receipt.ui_language IS DISTINCT FROM p_ui_language THEN
   RAISE EXCEPTION 'vocabulary_request_conflict' USING ERRCODE='22023'; END IF;
  IF NOT receipt.response ? 'correctAnswer' OR NOT receipt.response ? 'softError' THEN
   RAISE EXCEPTION 'invalid_answer_request' USING ERRCODE='22023'; END IF;
  RETURN receipt.response;
 END IF;
 result:=vocabulary_private.submit_self_rating(p_progress_id,p_known,p_ui_language);
 PERFORM platform_private.require_rpc_success(result);
 INSERT INTO vocabulary_private.answer_receipts(auth_user_id,request_id,progress_id,is_correct,typed_answer,ui_language,response)
 VALUES(actor,p_request_id,p_progress_id,p_known,NULL,p_ui_language,result);
 RETURN result;
END $$;


--
-- Name: submit_self_rating_once(uuid, uuid, boolean, text, text); Type: FUNCTION; Schema: vocabulary_private; Owner: -
--

CREATE FUNCTION vocabulary_private.submit_self_rating_once(p_request_id uuid, p_progress_id uuid, p_known boolean, p_ui_language text, p_target_level text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=auth.uid(); receipt vocabulary_private.answer_receipts; result jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_progress_id IS NULL OR p_known IS NULL OR p_ui_language IS NULL
  OR p_ui_language NOT IN('de','en','ru','uk','tr') THEN
  RAISE EXCEPTION 'invalid_answer_request' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 IF NOT EXISTS(SELECT 1 FROM public.vocabulary_direction_progress v JOIN public.learning_vocabulary_cards c ON c.id=v.card_id
  WHERE v.id=p_progress_id AND v.auth_user_id=actor AND vocabulary_private.progress_allowed(v.id,p_target_level)) THEN
  RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 IF p_ui_language='de' THEN RAISE EXCEPTION 'invalid_learning_language' USING ERRCODE='42501'; END IF;
 -- Self-rating receipts share the table; they carry a null typed answer.
 SELECT * INTO receipt FROM vocabulary_private.answer_receipts WHERE auth_user_id=actor AND request_id=p_request_id;
 IF FOUND THEN
  IF receipt.progress_id IS DISTINCT FROM p_progress_id OR receipt.is_correct IS DISTINCT FROM p_known
   OR receipt.typed_answer IS NOT NULL OR receipt.ui_language IS DISTINCT FROM p_ui_language OR receipt.target_level IS DISTINCT FROM p_target_level THEN
   RAISE EXCEPTION 'vocabulary_request_conflict' USING ERRCODE='22023'; END IF;
  IF NOT receipt.response ? 'correctAnswer' OR NOT receipt.response ? 'softError' THEN
   RAISE EXCEPTION 'invalid_answer_request' USING ERRCODE='22023'; END IF;
  RETURN receipt.response;
 END IF;
 result:=vocabulary_private.submit_self_rating(p_progress_id,p_known,p_ui_language,p_target_level);
 PERFORM platform_private.require_rpc_success(result);
 INSERT INTO vocabulary_private.answer_receipts(auth_user_id,request_id,progress_id,is_correct,typed_answer,ui_language,response,target_level)
 VALUES(actor,p_request_id,p_progress_id,p_known,NULL,p_ui_language,result,p_target_level);
 RETURN result;
END $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: registration_identity_resolutions; Type: TABLE; Schema: business_private; Owner: -
--

CREATE TABLE business_private.registration_identity_resolutions (
    auth_user_id uuid NOT NULL,
    person_id uuid NOT NULL,
    resolved_by uuid,
    resolved_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: session_function_backups; Type: TABLE; Schema: learning_private; Owner: -
--

CREATE TABLE learning_private.session_function_backups (
    signature text NOT NULL,
    definition text NOT NULL
);


--
-- Name: vocabulary_variant_backups; Type: TABLE; Schema: learning_private; Owner: -
--

CREATE TABLE learning_private.vocabulary_variant_backups (
    card_id uuid NOT NULL,
    previous_target_form text[],
    previous_alternatives text[] NOT NULL,
    applied_target_form text[],
    applied_alternatives text[] NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: audio_objects; Type: TABLE; Schema: learning_reset_private; Owner: -
--

CREATE TABLE learning_reset_private.audio_objects (
    auth_user_id uuid NOT NULL,
    object_id uuid NOT NULL,
    bucket_id text NOT NULL,
    object_name text NOT NULL,
    CONSTRAINT audio_objects_bucket_id_check CHECK ((bucket_id = 'pronunciation_audio'::text))
);


--
-- Name: jobs; Type: TABLE; Schema: learning_reset_private; Owner: -
--

CREATE TABLE learning_reset_private.jobs (
    auth_user_id uuid NOT NULL,
    token uuid DEFAULT gen_random_uuid() NOT NULL,
    active boolean DEFAULT true NOT NULL,
    requested_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    completed_at timestamp with time zone
);


--
-- Name: answer_receipts; Type: TABLE; Schema: path_private; Owner: -
--

CREATE TABLE path_private.answer_receipts (
    run_id uuid NOT NULL,
    request_id uuid NOT NULL,
    exercise_id uuid NOT NULL,
    answer jsonb NOT NULL,
    response jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: archived_units; Type: TABLE; Schema: path_private; Owner: -
--

CREATE TABLE path_private.archived_units (
    unit_id uuid NOT NULL,
    is_active boolean NOT NULL
);


--
-- Name: content_contract_backups; Type: TABLE; Schema: path_private; Owner: -
--

CREATE TABLE path_private.content_contract_backups (
    signature text NOT NULL,
    definition text NOT NULL
);


--
-- Name: function_backups; Type: TABLE; Schema: path_private; Owner: -
--

CREATE TABLE path_private.function_backups (
    signature text NOT NULL,
    definition text NOT NULL
);


--
-- Name: phase4_function_backups; Type: TABLE; Schema: path_private; Owner: -
--

CREATE TABLE path_private.phase4_function_backups (
    signature text NOT NULL,
    definition text NOT NULL
);


--
-- Name: phase4_imported_units; Type: TABLE; Schema: path_private; Owner: -
--

CREATE TABLE path_private.phase4_imported_units (
    unit_id uuid NOT NULL,
    was_active boolean,
    rollback_active boolean
);


--
-- Name: practice_items; Type: TABLE; Schema: path_private; Owner: -
--

CREATE TABLE path_private.practice_items (
    run_id uuid NOT NULL,
    exercise_id uuid NOT NULL,
    snapshot jsonb NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    solved boolean DEFAULT false NOT NULL,
    first_correct boolean
);


--
-- Name: rollback_unit_flags; Type: TABLE; Schema: path_private; Owner: -
--

CREATE TABLE path_private.rollback_unit_flags (
    unit_id uuid NOT NULL,
    is_active boolean NOT NULL
);


--
-- Name: test_items; Type: TABLE; Schema: path_private; Owner: -
--

CREATE TABLE path_private.test_items (
    attempt_id uuid NOT NULL,
    exercise_id uuid NOT NULL,
    snapshot jsonb NOT NULL,
    "position" integer NOT NULL
);


--
-- Name: rate_limits; Type: TABLE; Schema: platform_private; Owner: -
--

CREATE TABLE platform_private.rate_limits (
    key_hash text NOT NULL,
    count integer NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT rate_limits_count_check CHECK ((count > 0)),
    CONSTRAINT rate_limits_key_hash_check CHECK ((length(key_hash) = 64))
);


--
-- Name: mail_exception_deliveries; Type: TABLE; Schema: private; Owner: -
--

CREATE TABLE private.mail_exception_deliveries (
    booking_id uuid NOT NULL,
    course_id uuid NOT NULL,
    date date NOT NULL
);


--
-- Name: mail_outbox; Type: TABLE; Schema: private; Owner: -
--

CREATE TABLE private.mail_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dedupe_key text NOT NULL,
    kind public.mail_kind NOT NULL,
    recipient text NOT NULL,
    locale text DEFAULT 'de'::text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status public.mail_status DEFAULT 'pending'::public.mail_status NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    lease_until timestamp with time zone,
    lease_token uuid,
    worker_id uuid,
    last_error text,
    message_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    CONSTRAINT mail_outbox_attempts_check CHECK (((attempts >= 0) AND (attempts <= 8))),
    CONSTRAINT mail_outbox_check CHECK (((status = 'processing'::public.mail_status) = ((lease_token IS NOT NULL) AND (lease_until IS NOT NULL)))),
    CONSTRAINT mail_outbox_dedupe_key_check CHECK (((length(dedupe_key) >= 1) AND (length(dedupe_key) <= 240))),
    CONSTRAINT mail_outbox_payload_check CHECK (((jsonb_typeof(payload) = 'object'::text) AND (octet_length((payload)::text) <= 262144))),
    CONSTRAINT mail_outbox_recipient_check CHECK (((length(recipient) <= 254) AND (recipient ~ '^[^[:space:]<>@,;]+@[^[:space:]<>@,;]+\.[^[:space:]<>@,;]+$'::text)))
);


--
-- Name: TABLE mail_outbox; Type: COMMENT; Schema: private; Owner: -
--

COMMENT ON TABLE private.mail_outbox IS 'Transactional native SMTP outbox. Stable dedupe key and Message-ID; at-least-once delivery after SMTP/DB crash. Failed jobs require operator inspection. Contains private mail payloads.';


--
-- Name: booking_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    course_id uuid NOT NULL,
    title_snapshot text NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    unit_minutes integer NOT NULL,
    units numeric(10,3) NOT NULL,
    amount numeric(10,2) NOT NULL,
    requested_units integer,
    CONSTRAINT booking_items_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT booking_items_requested_units_check CHECK (((requested_units >= 1) AND (requested_units <= 1000))),
    CONSTRAINT booking_items_unit_minutes_check CHECK ((unit_minutes > 0)),
    CONSTRAINT booking_items_unit_price_check CHECK ((unit_price >= (0)::numeric)),
    CONSTRAINT booking_items_units_check CHECK ((units >= (0)::numeric))
);


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    target_month date NOT NULL,
    start_date date NOT NULL,
    kind public.booking_kind DEFAULT 'registration'::public.booking_kind NOT NULL,
    status public.booking_status DEFAULT 'pending'::public.booking_status NOT NULL,
    contact_name text NOT NULL,
    contact_email text NOT NULL,
    contact_phone text,
    contact_street text,
    contact_postal_code text,
    contact_city text,
    contact_birth_date date,
    privacy_accepted boolean NOT NULL,
    agb_accepted boolean NOT NULL,
    revocation_accepted boolean DEFAULT false NOT NULL,
    recording_accepted boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    confirmed_at timestamp with time zone,
    confirmed_by uuid,
    revision integer DEFAULT 1 NOT NULL,
    CONSTRAINT bookings_target_month_check CHECK ((EXTRACT(day FROM target_month) = (1)::numeric))
);


--
-- Name: cancellation_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cancellation_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    termination_type public.cancellation_type NOT NULL,
    termination_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    course_id uuid
);


--
-- Name: cefr_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cefr_levels (
    code public.cefr_code NOT NULL
);


--
-- Name: course_audiences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_audiences (
    code text NOT NULL,
    CONSTRAINT course_audiences_code_length CHECK (((length(btrim(code)) >= 1) AND (length(btrim(code)) <= 30)))
);


--
-- Name: course_exceptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_exceptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    date date NOT NULL,
    reason text NOT NULL,
    course_id uuid,
    CONSTRAINT course_exceptions_reason_check CHECK (((length(reason) >= 1) AND (length(reason) <= 250)))
);


--
-- Name: course_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid NOT NULL,
    weekday smallint NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    CONSTRAINT course_schedules_check CHECK ((end_time > start_time)),
    CONSTRAINT course_schedules_weekday_check CHECK (((weekday >= 1) AND (weekday <= 7)))
);


--
-- Name: course_translations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_translations (
    course_id uuid NOT NULL,
    locale text NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    CONSTRAINT course_translations_title_check CHECK (((length(title) >= 1) AND (length(title) <= 180)))
);


--
-- Name: courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    type public.course_type NOT NULL,
    category public.course_category NOT NULL,
    level text,
    unit_price numeric(10,2) NOT NULL,
    unit_minutes integer DEFAULT 45 NOT NULL,
    start_date date,
    end_date date,
    trial_lessons boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    audience_code text,
    CONSTRAINT courses_check CHECK (((end_date IS NULL) OR (start_date IS NULL) OR (end_date >= start_date))),
    CONSTRAINT courses_slug_check CHECK ((slug ~ '^[a-z0-9][a-z0-9_-]{1,99}$'::text)),
    CONSTRAINT courses_title_check CHECK (((length(title) >= 1) AND (length(title) <= 180))),
    CONSTRAINT courses_unit_minutes_check CHECK (((unit_minutes >= 15) AND (unit_minutes <= 180))),
    CONSTRAINT courses_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: grammar_translations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grammar_translations (
    exercise_id uuid NOT NULL,
    locale text NOT NULL,
    hint text,
    smart_hint text,
    explanation text,
    prompt text,
    instruction text,
    task text,
    gap_hint text
);


--
-- Name: COLUMN grammar_translations.prompt; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.grammar_translations.prompt IS 'Optional translation task prompt in this exact interface locale; never copied into German exercise content.';


--
-- Name: invoice_cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_cases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    target_month date NOT NULL,
    booking_id uuid NOT NULL,
    status public.invoice_status DEFAULT 'outstanding'::public.invoice_status NOT NULL,
    invoice_reference text,
    invoice_created_at timestamp with time zone,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT invoice_cases_check CHECK (((status = 'created'::public.invoice_status) = (invoice_created_at IS NOT NULL))),
    CONSTRAINT invoice_cases_target_month_check CHECK ((EXTRACT(day FROM target_month) = (1)::numeric))
);


--
-- Name: learning_activity_days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_activity_days (
    auth_user_id uuid NOT NULL,
    day date NOT NULL,
    study_seconds integer DEFAULT 0 NOT NULL,
    answer_count integer DEFAULT 0 NOT NULL,
    mode_seconds jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_activity_at timestamp with time zone
);


--
-- Name: COLUMN learning_activity_days.study_seconds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.learning_activity_days.study_seconds IS 'Estimated answer-to-answer seconds since migration38; gaps over five minutes and time before first/after last answer are excluded. Historical days have zero, not reconstructed time.';


--
-- Name: learning_exercises; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_exercises (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    topic text NOT NULL,
    type public.exercise_type NOT NULL,
    content jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    solution_audio_url text,
    unit_id uuid NOT NULL,
    content_version smallint DEFAULT 1 NOT NULL,
    content_status public.learning_content_status GENERATED ALWAYS AS (
CASE
    WHEN grammar_private.exercise_is_ready(content, topic) THEN 'ready'::public.learning_content_status
    ELSE 'incomplete'::public.learning_content_status
END) STORED,
    node_id uuid,
    goal_id text,
    source_ref text,
    path_is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    explanation_card text,
    CONSTRAINT grammar_content_object CHECK ((jsonb_typeof(content) = 'object'::text)),
    CONSTRAINT learning_exercises_accepted_answers_check CHECK (grammar_private.valid_accepted_answers(content, type)),
    CONSTRAINT learning_exercises_content_version_check CHECK ((content_version = 1))
);


--
-- Name: COLUMN learning_exercises.solution_audio_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.learning_exercises.solution_audio_url IS 'Optionale MP3-URL für die native Aussprache der Lösung (Tap-to-Listen).';


--
-- Name: COLUMN learning_exercises.content_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.learning_exercises.content_status IS 'Derived publication readiness: explicit target forms and German task text; legacy content is preserved for staff review.';


--
-- Name: learning_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_levels (
    code text NOT NULL,
    cefr_level public.cefr_code NOT NULL,
    sort_order smallint NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT learning_levels_sort_order_check CHECK ((sort_order > 0))
);


--
-- Name: learning_reading_texts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_reading_texts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sentence_de text NOT NULL,
    focus text,
    audio_url text,
    created_at timestamp with time zone DEFAULT now(),
    unit_id uuid NOT NULL
);


--
-- Name: learning_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid NOT NULL,
    mode public.learning_session_mode NOT NULL,
    level text NOT NULL,
    started_at timestamp with time zone NOT NULL,
    ended_at timestamp with time zone NOT NULL,
    answer_count integer DEFAULT 1 NOT NULL,
    study_seconds integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT learning_sessions_answer_count_check CHECK ((answer_count > 0)),
    CONSTRAINT learning_sessions_check CHECK ((ended_at >= started_at)),
    CONSTRAINT learning_sessions_study_seconds_check CHECK ((study_seconds >= 0))
);


--
-- Name: TABLE learning_sessions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.learning_sessions IS 'Learning event sessions only. Raw rows expire after 180 days on any new learning event; durable Berlin daily totals remain in learning_activity_days.';


--
-- Name: learning_trainer_grants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_trainer_grants (
    auth_user_id uuid NOT NULL,
    level text NOT NULL,
    trainer public.trainer_code NOT NULL,
    enabled boolean NOT NULL,
    unit_mode public.unit_access_mode DEFAULT 'all'::public.unit_access_mode NOT NULL,
    enabled_at timestamp with time zone
);


--
-- Name: learning_trainers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_trainers (
    code public.trainer_code NOT NULL
);


--
-- Name: learning_unit_grants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_unit_grants (
    auth_user_id uuid NOT NULL,
    level text NOT NULL,
    trainer public.trainer_code NOT NULL,
    unit_id uuid NOT NULL
);


--
-- Name: learning_units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    level text NOT NULL,
    trainer public.trainer_code NOT NULL,
    label text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    owner_auth_user_id uuid,
    is_path boolean DEFAULT false NOT NULL,
    path_source_id text,
    path_slug text,
    path_title text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT learning_units_label_check CHECK (((length(btrim(label)) >= 1) AND (length(btrim(label)) <= 160))),
    CONSTRAINT learning_units_own_words_check CHECK ((((owner_auth_user_id IS NULL) AND (label <> 'Eigene Wörter'::text)) OR ((owner_auth_user_id IS NOT NULL) AND (trainer = 'vocabulary'::public.trainer_code) AND (label = 'Eigene Wörter'::text))))
);


--
-- Name: learning_videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_videos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    unit_id uuid NOT NULL,
    source_url text,
    folder_id uuid,
    title text,
    storage_path text,
    file_size bigint,
    CONSTRAINT learning_videos_source_url_check CHECK (((source_url IS NULL) OR (source_url ~* '^https?://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$'::text))),
    CONSTRAINT learning_videos_upload_check CHECK ((((title IS NULL) OR ((length(btrim(title)) >= 1) AND (length(btrim(title)) <= 180))) AND (((storage_path IS NULL) AND (file_size IS NULL)) OR ((storage_path IS NOT NULL) AND (folder_id IS NOT NULL) AND (title IS NOT NULL) AND (file_size IS NOT NULL) AND (file_size > 0) AND (file_size <= 536870912)))))
);


--
-- Name: learning_vocabulary_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_vocabulary_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    word_de text NOT NULL,
    article public.grammatical_article,
    plural text,
    image_url text,
    audio_url text,
    created_at timestamp with time zone DEFAULT now(),
    sentence_practice boolean DEFAULT false NOT NULL,
    alternative_answers_de text[] DEFAULT '{}'::text[] NOT NULL,
    unit_id uuid NOT NULL,
    target_form text[]
);


--
-- Name: COLUMN learning_vocabulary_cards.target_form; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.learning_vocabulary_cards.target_form IS 'Optional German target forms displayed before a typed sentence answer.';


--
-- Name: lms_media_folder; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lms_media_folder (
    folder_id uuid DEFAULT gen_random_uuid() NOT NULL,
    level text NOT NULL,
    course_id uuid,
    title text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lms_media_folder_title_check CHECK (((length(btrim(title)) >= 1) AND (length(btrim(title)) <= 180)))
);


--
-- Name: lms_presentation_asset; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lms_presentation_asset (
    asset_id uuid DEFAULT gen_random_uuid() NOT NULL,
    folder_id uuid NOT NULL,
    file_name text NOT NULL,
    storage_path text NOT NULL,
    mime_type text NOT NULL,
    file_size bigint NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lms_presentation_asset_file_name_check CHECK (((length(btrim(file_name)) >= 1) AND (length(btrim(file_name)) <= 255))),
    CONSTRAINT lms_presentation_asset_file_size_check CHECK (((file_size > 0) AND (file_size <= 536870912)))
);


--
-- Name: locales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locales (
    code text NOT NULL,
    CONSTRAINT locales_code_check CHECK ((code ~ '^[a-z]{2}$'::text))
);


--
-- Name: media_mime_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_mime_types (
    mime_type text NOT NULL,
    format public.media_format NOT NULL
);


--
-- Name: path_interventions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.path_interventions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    node_id uuid,
    action public.path_intervention_action NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    request_id uuid
);


--
-- Name: path_legacy_progress_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.path_legacy_progress_notes (
    auth_user_id uuid NOT NULL,
    level text NOT NULL,
    legacy_exercise_count integer NOT NULL,
    legacy_completed_count integer NOT NULL,
    legacy_attempt_count bigint NOT NULL,
    initial_path_progress integer DEFAULT 0 NOT NULL,
    existing_path_progress_preserved boolean NOT NULL,
    note jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: COLUMN path_legacy_progress_notes.initial_path_progress; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.path_legacy_progress_notes.initial_path_progress IS 'Legacy progress contributes zero completions to the new path; any existing new path progress is retained, never reset by import.';


--
-- Name: path_node_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.path_node_progress (
    auth_user_id uuid NOT NULL,
    node_id uuid NOT NULL,
    status public.path_progress_status DEFAULT 'in_progress'::public.path_progress_status NOT NULL,
    best_stars smallint DEFAULT 0 NOT NULL,
    first_attempt_accuracy numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT path_node_progress_best_stars_check CHECK (((best_stars >= 0) AND (best_stars <= 3))),
    CONSTRAINT path_node_progress_first_attempt_accuracy_check CHECK (((first_attempt_accuracy >= (0)::numeric) AND (first_attempt_accuracy <= (100)::numeric)))
);


--
-- Name: path_node_translations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.path_node_translations (
    node_id uuid NOT NULL,
    locale text NOT NULL,
    title text NOT NULL,
    rule text
);


--
-- Name: path_nodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.path_nodes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    unit_id uuid NOT NULL,
    source_id text NOT NULL,
    kind public.path_node_kind NOT NULL,
    sort_order integer NOT NULL,
    title text NOT NULL,
    topic text NOT NULL,
    merkkarte jsonb,
    goals text[] DEFAULT '{}'::text[] NOT NULL,
    anchor_node_id uuid,
    test_size integer,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT path_nodes_check CHECK (((kind = 'special'::public.path_node_kind) = (anchor_node_id IS NOT NULL))),
    CONSTRAINT path_nodes_check1 CHECK ((anchor_node_id IS DISTINCT FROM id)),
    CONSTRAINT path_nodes_check2 CHECK ((((kind = 'test'::public.path_node_kind) AND (test_size IS NOT NULL) AND (test_size > 0)) OR ((kind <> 'test'::public.path_node_kind) AND (test_size IS NULL)))),
    CONSTRAINT path_nodes_sort_order_check CHECK ((sort_order > 0))
);


--
-- Name: path_objectives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.path_objectives (
    unit_id uuid NOT NULL,
    id text NOT NULL,
    area public.path_objective_area NOT NULL,
    description text NOT NULL
);


--
-- Name: path_practice_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.path_practice_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid NOT NULL,
    node_id uuid NOT NULL,
    status public.path_run_status DEFAULT 'active'::public.path_run_status NOT NULL,
    queue uuid[] NOT NULL,
    total integer NOT NULL,
    first_correct integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT path_practice_runs_total_check CHECK ((total > 0))
);


--
-- Name: path_test_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.path_test_answers (
    attempt_id uuid NOT NULL,
    exercise_id uuid NOT NULL,
    answer jsonb NOT NULL,
    result jsonb,
    answered_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: path_test_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.path_test_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid NOT NULL,
    node_id uuid NOT NULL,
    status public.path_run_status DEFAULT 'active'::public.path_run_status NOT NULL,
    selected_exercise_ids uuid[] NOT NULL,
    percentage numeric,
    passed boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT path_test_attempts_percentage_check CHECK (((percentage >= (0)::numeric) AND (percentage <= (100)::numeric)))
);


--
-- Name: path_unit_translations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.path_unit_translations (
    unit_id uuid NOT NULL,
    locale text NOT NULL,
    title text NOT NULL
);


--
-- Name: people; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.people (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid,
    display_name text NOT NULL,
    email text NOT NULL,
    birth_date date,
    phone text,
    street text,
    postal_code text,
    city text,
    preferred_locale text DEFAULT 'de'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT people_display_name_check CHECK (((length(display_name) >= 1) AND (length(display_name) <= 160))),
    CONSTRAINT people_email_check CHECK (((length(email) >= 3) AND (length(email) <= 254)))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    native_language text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    role public.profile_role DEFAULT 'student'::public.profile_role,
    ui_language text DEFAULT 'de'::text NOT NULL,
    notify_pronunciation_feedback boolean DEFAULT true NOT NULL,
    notify_new_content boolean DEFAULT true NOT NULL,
    notify_learning_reminders boolean DEFAULT true NOT NULL
);


--
-- Name: pronunciation_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pronunciation_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    submission_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    sender_role public.profile_role DEFAULT 'student'::public.profile_role NOT NULL,
    text_content text DEFAULT ''::text NOT NULL,
    audio_path text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    seen_at timestamp with time zone,
    CONSTRAINT pronunciation_message_not_empty CHECK (((length(btrim(text_content)) > 0) OR (audio_path IS NOT NULL))),
    CONSTRAINT pronunciation_messages_text_content_check CHECK ((char_length(text_content) <= 5000))
);


--
-- Name: student_level_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_level_access (
    auth_user_id uuid NOT NULL,
    level text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid NOT NULL,
    type public.submission_type NOT NULL,
    content_url text,
    text_content text,
    status public.submission_status DEFAULT 'pending'::public.submission_status,
    created_at timestamp with time zone DEFAULT now(),
    level text DEFAULT 'A1.1'::text NOT NULL,
    prompt_id uuid
);


--
-- Name: teacher_student_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teacher_student_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    teacher_id uuid DEFAULT auth.uid() NOT NULL,
    note_text text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT teacher_student_notes_text_length CHECK ((length(note_text) <= 5000))
);


--
-- Name: user_exercise_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_exercise_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid NOT NULL,
    exercise_id uuid NOT NULL,
    completed boolean DEFAULT false,
    score integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    attempts integer DEFAULT 0 NOT NULL,
    hint_shown boolean DEFAULT false NOT NULL,
    CONSTRAINT user_exercise_progress_score_range CHECK (((score IS NULL) OR ((score >= 0) AND (score <= 100))))
);


--
-- Name: COLUMN user_exercise_progress.attempts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_exercise_progress.attempts IS 'Anzahl der Antwortversuche. Ab 2 Fehlversuchen wird ein Smart Hint eingeblendet.';


--
-- Name: COLUMN user_exercise_progress.hint_shown; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_exercise_progress.hint_shown IS 'True, sobald dem Lernenden ein Smart Hint gezeigt wurde (Lehrer-Analytics).';


--
-- Name: vocabulary_carryover_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vocabulary_carryover_preferences (
    auth_user_id uuid NOT NULL,
    target_level text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    started_at timestamp with time zone,
    decided_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: vocabulary_direction_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vocabulary_direction_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid NOT NULL,
    card_id uuid NOT NULL,
    direction public.vocabulary_direction NOT NULL,
    box_number integer DEFAULT 1 NOT NULL,
    next_review_date timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    lapses integer DEFAULT 0 NOT NULL,
    last_answered_at timestamp with time zone,
    CONSTRAINT vocabulary_direction_progress_box_number_check CHECK (((box_number >= 1) AND (box_number <= 7)))
);


--
-- Name: vocabulary_learning_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vocabulary_learning_state (
    auth_user_id uuid NOT NULL,
    last_card_id uuid,
    last_reviewed_at timestamp with time zone
);


--
-- Name: vocabulary_lesson_pauses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vocabulary_lesson_pauses (
    auth_user_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    paused_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vocabulary_onboarding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vocabulary_onboarding (
    auth_user_id uuid NOT NULL,
    level text NOT NULL,
    status public.onboarding_status NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    started_unit_id uuid NOT NULL
);


--
-- Name: vocabulary_translations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vocabulary_translations (
    card_id uuid NOT NULL,
    locale text NOT NULL,
    translation text,
    context_sentence text,
    is_difficult boolean DEFAULT false NOT NULL
);


--
-- Name: function_backups; Type: TABLE; Schema: teacher_dashboard_private; Owner: -
--

CREATE TABLE teacher_dashboard_private.function_backups (
    signature text NOT NULL,
    definition text NOT NULL
);


--
-- Name: progress_archive; Type: TABLE; Schema: teacher_dashboard_private; Owner: -
--

CREATE TABLE teacher_dashboard_private.progress_archive (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid NOT NULL,
    unit_id uuid,
    node_id uuid,
    archived_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    node_progress jsonb NOT NULL,
    exercise_progress jsonb NOT NULL
);


--
-- Name: answer_receipts; Type: TABLE; Schema: vocabulary_private; Owner: -
--

CREATE TABLE vocabulary_private.answer_receipts (
    auth_user_id uuid NOT NULL,
    request_id uuid NOT NULL,
    progress_id uuid NOT NULL,
    is_correct boolean,
    typed_answer text,
    ui_language text NOT NULL,
    response jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    target_level text,
    CONSTRAINT answer_receipts_response_check CHECK ((jsonb_typeof(response) = 'object'::text)),
    CONSTRAINT answer_receipts_typed_answer_check CHECK ((length(typed_answer) <= 4000))
);


--
-- Name: carryover_function_backups; Type: TABLE; Schema: vocabulary_private; Owner: -
--

CREATE TABLE vocabulary_private.carryover_function_backups (
    signature text NOT NULL,
    definition text NOT NULL
);


--
-- Name: registration_identity_resolutions registration_identity_resolutions_pkey; Type: CONSTRAINT; Schema: business_private; Owner: -
--

ALTER TABLE ONLY business_private.registration_identity_resolutions
    ADD CONSTRAINT registration_identity_resolutions_pkey PRIMARY KEY (auth_user_id);


--
-- Name: session_function_backups session_function_backups_pkey; Type: CONSTRAINT; Schema: learning_private; Owner: -
--

ALTER TABLE ONLY learning_private.session_function_backups
    ADD CONSTRAINT session_function_backups_pkey PRIMARY KEY (signature);


--
-- Name: vocabulary_variant_backups vocabulary_variant_backups_pkey; Type: CONSTRAINT; Schema: learning_private; Owner: -
--

ALTER TABLE ONLY learning_private.vocabulary_variant_backups
    ADD CONSTRAINT vocabulary_variant_backups_pkey PRIMARY KEY (card_id);


--
-- Name: audio_objects audio_objects_pkey; Type: CONSTRAINT; Schema: learning_reset_private; Owner: -
--

ALTER TABLE ONLY learning_reset_private.audio_objects
    ADD CONSTRAINT audio_objects_pkey PRIMARY KEY (auth_user_id, object_id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: learning_reset_private; Owner: -
--

ALTER TABLE ONLY learning_reset_private.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (auth_user_id);


--
-- Name: jobs jobs_token_key; Type: CONSTRAINT; Schema: learning_reset_private; Owner: -
--

ALTER TABLE ONLY learning_reset_private.jobs
    ADD CONSTRAINT jobs_token_key UNIQUE (token);


--
-- Name: answer_receipts answer_receipts_pkey; Type: CONSTRAINT; Schema: path_private; Owner: -
--

ALTER TABLE ONLY path_private.answer_receipts
    ADD CONSTRAINT answer_receipts_pkey PRIMARY KEY (run_id, request_id);


--
-- Name: archived_units archived_units_pkey; Type: CONSTRAINT; Schema: path_private; Owner: -
--

ALTER TABLE ONLY path_private.archived_units
    ADD CONSTRAINT archived_units_pkey PRIMARY KEY (unit_id);


--
-- Name: content_contract_backups content_contract_backups_pkey; Type: CONSTRAINT; Schema: path_private; Owner: -
--

ALTER TABLE ONLY path_private.content_contract_backups
    ADD CONSTRAINT content_contract_backups_pkey PRIMARY KEY (signature);


--
-- Name: function_backups function_backups_pkey; Type: CONSTRAINT; Schema: path_private; Owner: -
--

ALTER TABLE ONLY path_private.function_backups
    ADD CONSTRAINT function_backups_pkey PRIMARY KEY (signature);


--
-- Name: phase4_function_backups phase4_function_backups_pkey; Type: CONSTRAINT; Schema: path_private; Owner: -
--

ALTER TABLE ONLY path_private.phase4_function_backups
    ADD CONSTRAINT phase4_function_backups_pkey PRIMARY KEY (signature);


--
-- Name: phase4_imported_units phase4_imported_units_pkey; Type: CONSTRAINT; Schema: path_private; Owner: -
--

ALTER TABLE ONLY path_private.phase4_imported_units
    ADD CONSTRAINT phase4_imported_units_pkey PRIMARY KEY (unit_id);


--
-- Name: practice_items practice_items_pkey; Type: CONSTRAINT; Schema: path_private; Owner: -
--

ALTER TABLE ONLY path_private.practice_items
    ADD CONSTRAINT practice_items_pkey PRIMARY KEY (run_id, exercise_id);


--
-- Name: rollback_unit_flags rollback_unit_flags_pkey; Type: CONSTRAINT; Schema: path_private; Owner: -
--

ALTER TABLE ONLY path_private.rollback_unit_flags
    ADD CONSTRAINT rollback_unit_flags_pkey PRIMARY KEY (unit_id);


--
-- Name: test_items test_items_attempt_id_position_key; Type: CONSTRAINT; Schema: path_private; Owner: -
--

ALTER TABLE ONLY path_private.test_items
    ADD CONSTRAINT test_items_attempt_id_position_key UNIQUE (attempt_id, "position");


--
-- Name: test_items test_items_pkey; Type: CONSTRAINT; Schema: path_private; Owner: -
--

ALTER TABLE ONLY path_private.test_items
    ADD CONSTRAINT test_items_pkey PRIMARY KEY (attempt_id, exercise_id);


--
-- Name: rate_limits rate_limits_pkey; Type: CONSTRAINT; Schema: platform_private; Owner: -
--

ALTER TABLE ONLY platform_private.rate_limits
    ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (key_hash);


--
-- Name: mail_exception_deliveries mail_exception_deliveries_pkey; Type: CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.mail_exception_deliveries
    ADD CONSTRAINT mail_exception_deliveries_pkey PRIMARY KEY (booking_id, course_id, date);


--
-- Name: mail_outbox mail_outbox_dedupe_key_key; Type: CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.mail_outbox
    ADD CONSTRAINT mail_outbox_dedupe_key_key UNIQUE (dedupe_key);


--
-- Name: mail_outbox mail_outbox_pkey; Type: CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.mail_outbox
    ADD CONSTRAINT mail_outbox_pkey PRIMARY KEY (id);


--
-- Name: booking_items booking_items_booking_id_course_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_items
    ADD CONSTRAINT booking_items_booking_id_course_id_key UNIQUE (booking_id, course_id);


--
-- Name: booking_items booking_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_items
    ADD CONSTRAINT booking_items_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: cancellation_requests cancellation_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cancellation_requests
    ADD CONSTRAINT cancellation_requests_pkey PRIMARY KEY (id);


--
-- Name: cefr_levels cefr_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cefr_levels
    ADD CONSTRAINT cefr_levels_pkey PRIMARY KEY (code);


--
-- Name: course_audiences course_audiences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_audiences
    ADD CONSTRAINT course_audiences_pkey PRIMARY KEY (code);


--
-- Name: course_exceptions course_exceptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_exceptions
    ADD CONSTRAINT course_exceptions_pkey PRIMARY KEY (id);


--
-- Name: course_schedules course_schedules_course_id_weekday_start_time_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_schedules
    ADD CONSTRAINT course_schedules_course_id_weekday_start_time_key UNIQUE (course_id, weekday, start_time);


--
-- Name: course_schedules course_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_schedules
    ADD CONSTRAINT course_schedules_pkey PRIMARY KEY (id);


--
-- Name: course_translations course_translations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_translations
    ADD CONSTRAINT course_translations_pkey PRIMARY KEY (course_id, locale);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: courses courses_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_slug_key UNIQUE (slug);


--
-- Name: learning_exercises exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_exercises
    ADD CONSTRAINT exercises_pkey PRIMARY KEY (id);


--
-- Name: grammar_translations grammar_translations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grammar_translations
    ADD CONSTRAINT grammar_translations_pkey PRIMARY KEY (exercise_id, locale);


--
-- Name: invoice_cases invoice_cases_booking_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_cases
    ADD CONSTRAINT invoice_cases_booking_id_key UNIQUE (booking_id);


--
-- Name: invoice_cases invoice_cases_person_id_target_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_cases
    ADD CONSTRAINT invoice_cases_person_id_target_month_key UNIQUE (person_id, target_month);


--
-- Name: invoice_cases invoice_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_cases
    ADD CONSTRAINT invoice_cases_pkey PRIMARY KEY (id);


--
-- Name: learning_activity_days learning_activity_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_activity_days
    ADD CONSTRAINT learning_activity_days_pkey PRIMARY KEY (auth_user_id, day);


--
-- Name: learning_levels learning_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_levels
    ADD CONSTRAINT learning_levels_pkey PRIMARY KEY (code);


--
-- Name: learning_levels learning_levels_sort_order_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_levels
    ADD CONSTRAINT learning_levels_sort_order_key UNIQUE (sort_order);


--
-- Name: learning_reading_texts learning_reading_texts_unit_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_reading_texts
    ADD CONSTRAINT learning_reading_texts_unit_id_key UNIQUE (unit_id);


--
-- Name: learning_sessions learning_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_sessions
    ADD CONSTRAINT learning_sessions_pkey PRIMARY KEY (id);


--
-- Name: learning_trainer_grants learning_trainer_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_trainer_grants
    ADD CONSTRAINT learning_trainer_grants_pkey PRIMARY KEY (auth_user_id, level, trainer);


--
-- Name: learning_trainers learning_trainers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_trainers
    ADD CONSTRAINT learning_trainers_pkey PRIMARY KEY (code);


--
-- Name: learning_unit_grants learning_unit_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_unit_grants
    ADD CONSTRAINT learning_unit_grants_pkey PRIMARY KEY (auth_user_id, level, trainer, unit_id);


--
-- Name: learning_units learning_units_id_level_trainer_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_units
    ADD CONSTRAINT learning_units_id_level_trainer_key UNIQUE (id, level, trainer);


--
-- Name: learning_units learning_units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_units
    ADD CONSTRAINT learning_units_pkey PRIMARY KEY (id);


--
-- Name: lms_media_folder lms_media_folder_level_title_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_media_folder
    ADD CONSTRAINT lms_media_folder_level_title_key UNIQUE (level, title);


--
-- Name: lms_media_folder lms_media_folder_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_media_folder
    ADD CONSTRAINT lms_media_folder_pkey PRIMARY KEY (folder_id);


--
-- Name: lms_presentation_asset lms_presentation_asset_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_presentation_asset
    ADD CONSTRAINT lms_presentation_asset_pkey PRIMARY KEY (asset_id);


--
-- Name: lms_presentation_asset lms_presentation_asset_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_presentation_asset
    ADD CONSTRAINT lms_presentation_asset_storage_path_key UNIQUE (storage_path);


--
-- Name: locales locales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locales
    ADD CONSTRAINT locales_pkey PRIMARY KEY (code);


--
-- Name: media_mime_types media_mime_types_format_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_mime_types
    ADD CONSTRAINT media_mime_types_format_key UNIQUE (format);


--
-- Name: media_mime_types media_mime_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_mime_types
    ADD CONSTRAINT media_mime_types_pkey PRIMARY KEY (mime_type);


--
-- Name: path_interventions path_interventions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_interventions
    ADD CONSTRAINT path_interventions_pkey PRIMARY KEY (id);


--
-- Name: path_legacy_progress_notes path_legacy_progress_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_legacy_progress_notes
    ADD CONSTRAINT path_legacy_progress_notes_pkey PRIMARY KEY (auth_user_id, level);


--
-- Name: path_node_progress path_node_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_node_progress
    ADD CONSTRAINT path_node_progress_pkey PRIMARY KEY (auth_user_id, node_id);


--
-- Name: path_node_translations path_node_translations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_node_translations
    ADD CONSTRAINT path_node_translations_pkey PRIMARY KEY (node_id, locale);


--
-- Name: path_nodes path_nodes_id_unit_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_nodes
    ADD CONSTRAINT path_nodes_id_unit_id_key UNIQUE (id, unit_id);


--
-- Name: path_nodes path_nodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_nodes
    ADD CONSTRAINT path_nodes_pkey PRIMARY KEY (id);


--
-- Name: path_nodes path_nodes_unit_id_source_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_nodes
    ADD CONSTRAINT path_nodes_unit_id_source_id_key UNIQUE (unit_id, source_id);


--
-- Name: path_objectives path_objectives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_objectives
    ADD CONSTRAINT path_objectives_pkey PRIMARY KEY (unit_id, id);


--
-- Name: path_practice_runs path_practice_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_practice_runs
    ADD CONSTRAINT path_practice_runs_pkey PRIMARY KEY (id);


--
-- Name: path_test_answers path_test_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_test_answers
    ADD CONSTRAINT path_test_answers_pkey PRIMARY KEY (attempt_id, exercise_id);


--
-- Name: path_test_attempts path_test_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_test_attempts
    ADD CONSTRAINT path_test_attempts_pkey PRIMARY KEY (id);


--
-- Name: path_unit_translations path_unit_translations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_unit_translations
    ADD CONSTRAINT path_unit_translations_pkey PRIMARY KEY (unit_id, locale);


--
-- Name: people people_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people
    ADD CONSTRAINT people_auth_user_id_key UNIQUE (auth_user_id);


--
-- Name: people people_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people
    ADD CONSTRAINT people_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: pronunciation_messages pronunciation_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pronunciation_messages
    ADD CONSTRAINT pronunciation_messages_pkey PRIMARY KEY (id);


--
-- Name: learning_reading_texts pronunciation_prompts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_reading_texts
    ADD CONSTRAINT pronunciation_prompts_pkey PRIMARY KEY (id);


--
-- Name: student_level_access student_level_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_level_access
    ADD CONSTRAINT student_level_access_pkey PRIMARY KEY (auth_user_id, level);


--
-- Name: submissions submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_pkey PRIMARY KEY (id);


--
-- Name: teacher_student_notes teacher_student_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_student_notes
    ADD CONSTRAINT teacher_student_notes_pkey PRIMARY KEY (id);


--
-- Name: teacher_student_notes teacher_student_notes_student_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_student_notes
    ADD CONSTRAINT teacher_student_notes_student_unique UNIQUE (student_id);


--
-- Name: user_exercise_progress user_exercise_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_exercise_progress
    ADD CONSTRAINT user_exercise_progress_pkey PRIMARY KEY (id);


--
-- Name: user_exercise_progress user_exercise_progress_user_id_exercise_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_exercise_progress
    ADD CONSTRAINT user_exercise_progress_user_id_exercise_id_key UNIQUE (auth_user_id, exercise_id);


--
-- Name: learning_videos videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_videos
    ADD CONSTRAINT videos_pkey PRIMARY KEY (id);


--
-- Name: learning_vocabulary_cards vocabulary_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_vocabulary_cards
    ADD CONSTRAINT vocabulary_cards_pkey PRIMARY KEY (id);


--
-- Name: vocabulary_carryover_preferences vocabulary_carryover_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_carryover_preferences
    ADD CONSTRAINT vocabulary_carryover_preferences_pkey PRIMARY KEY (auth_user_id, target_level);


--
-- Name: vocabulary_direction_progress vocabulary_direction_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_direction_progress
    ADD CONSTRAINT vocabulary_direction_progress_pkey PRIMARY KEY (id);


--
-- Name: vocabulary_direction_progress vocabulary_direction_progress_user_id_card_id_direction_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_direction_progress
    ADD CONSTRAINT vocabulary_direction_progress_user_id_card_id_direction_key UNIQUE (auth_user_id, card_id, direction);


--
-- Name: vocabulary_learning_state vocabulary_learning_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_learning_state
    ADD CONSTRAINT vocabulary_learning_state_pkey PRIMARY KEY (auth_user_id);


--
-- Name: vocabulary_lesson_pauses vocabulary_lesson_pauses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_lesson_pauses
    ADD CONSTRAINT vocabulary_lesson_pauses_pkey PRIMARY KEY (auth_user_id, unit_id);


--
-- Name: vocabulary_onboarding vocabulary_onboarding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_onboarding
    ADD CONSTRAINT vocabulary_onboarding_pkey PRIMARY KEY (auth_user_id, level);


--
-- Name: vocabulary_translations vocabulary_translations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_translations
    ADD CONSTRAINT vocabulary_translations_pkey PRIMARY KEY (card_id, locale);


--
-- Name: function_backups function_backups_pkey; Type: CONSTRAINT; Schema: teacher_dashboard_private; Owner: -
--

ALTER TABLE ONLY teacher_dashboard_private.function_backups
    ADD CONSTRAINT function_backups_pkey PRIMARY KEY (signature);


--
-- Name: progress_archive progress_archive_pkey; Type: CONSTRAINT; Schema: teacher_dashboard_private; Owner: -
--

ALTER TABLE ONLY teacher_dashboard_private.progress_archive
    ADD CONSTRAINT progress_archive_pkey PRIMARY KEY (id);


--
-- Name: answer_receipts answer_receipts_pkey; Type: CONSTRAINT; Schema: vocabulary_private; Owner: -
--

ALTER TABLE ONLY vocabulary_private.answer_receipts
    ADD CONSTRAINT answer_receipts_pkey PRIMARY KEY (auth_user_id, request_id);


--
-- Name: carryover_function_backups carryover_function_backups_pkey; Type: CONSTRAINT; Schema: vocabulary_private; Owner: -
--

ALTER TABLE ONLY vocabulary_private.carryover_function_backups
    ADD CONSTRAINT carryover_function_backups_pkey PRIMARY KEY (signature);


--
-- Name: audio_objects_bucket_id_idx; Type: INDEX; Schema: learning_reset_private; Owner: -
--

CREATE INDEX audio_objects_bucket_id_idx ON learning_reset_private.audio_objects USING btree (bucket_id);


--
-- Name: path_practice_exercise_idx; Type: INDEX; Schema: path_private; Owner: -
--

CREATE INDEX path_practice_exercise_idx ON path_private.practice_items USING btree (exercise_id);


--
-- Name: path_test_items_exercise_idx; Type: INDEX; Schema: path_private; Owner: -
--

CREATE INDEX path_test_items_exercise_idx ON path_private.test_items USING btree (exercise_id);


--
-- Name: rate_limits_expiration_idx; Type: INDEX; Schema: platform_private; Owner: -
--

CREATE INDEX rate_limits_expiration_idx ON platform_private.rate_limits USING btree (expires_at);


--
-- Name: mail_outbox_due_idx; Type: INDEX; Schema: private; Owner: -
--

CREATE INDEX mail_outbox_due_idx ON private.mail_outbox USING btree (available_at, created_at) WHERE (status = 'pending'::public.mail_status);


--
-- Name: mail_outbox_lease_idx; Type: INDEX; Schema: private; Owner: -
--

CREATE INDEX mail_outbox_lease_idx ON private.mail_outbox USING btree (lease_until) WHERE (status = 'processing'::public.mail_status);


--
-- Name: mail_outbox_locale_idx; Type: INDEX; Schema: private; Owner: -
--

CREATE INDEX mail_outbox_locale_idx ON private.mail_outbox USING btree (locale);


--
-- Name: booking_items_course; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_items_course ON public.booking_items USING btree (course_id);


--
-- Name: bookings_confirmed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_confirmed_by ON public.bookings USING btree (confirmed_by);


--
-- Name: bookings_person_month; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX bookings_person_month ON public.bookings USING btree (person_id, target_month) WHERE (kind <> 'trial'::public.booking_kind);


--
-- Name: bookings_status_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_status_month ON public.bookings USING btree (status, target_month, id);


--
-- Name: cancellation_requests_course_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cancellation_requests_course_id_idx ON public.cancellation_requests USING btree (course_id);


--
-- Name: course_exceptions_course; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX course_exceptions_course ON public.course_exceptions USING btree (course_id, date);


--
-- Name: course_exceptions_one; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX course_exceptions_one ON public.course_exceptions USING btree (date, COALESCE(course_id, '00000000-0000-0000-0000-000000000000'::uuid));


--
-- Name: course_translations_locale_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX course_translations_locale_idx ON public.course_translations USING btree (locale);


--
-- Name: courses_active_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX courses_active_order ON public.courses USING btree (sort_order, id) WHERE (archived_at IS NULL);


--
-- Name: courses_audience_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX courses_audience_code_idx ON public.courses USING btree (audience_code);


--
-- Name: courses_level_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX courses_level_idx ON public.courses USING btree (level);


--
-- Name: grammar_translations_locale_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grammar_translations_locale_idx ON public.grammar_translations USING btree (locale);


--
-- Name: idx_submissions_user_level_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_user_level_created ON public.submissions USING btree (auth_user_id, level, created_at DESC);


--
-- Name: idx_user_exercise_progress_user_completed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_exercise_progress_user_completed ON public.user_exercise_progress USING btree (auth_user_id, completed);


--
-- Name: invoice_cases_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_cases_created_by ON public.invoice_cases USING btree (created_by);


--
-- Name: invoice_cases_queue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_cases_queue ON public.invoice_cases USING btree (target_month, status);


--
-- Name: learning_activity_days_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX learning_activity_days_day_idx ON public.learning_activity_days USING btree (day, auth_user_id);


--
-- Name: learning_exercises_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX learning_exercises_unit_idx ON public.learning_exercises USING btree (unit_id);


--
-- Name: learning_sessions_level_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX learning_sessions_level_idx ON public.learning_sessions USING btree (level);


--
-- Name: learning_sessions_retention_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX learning_sessions_retention_idx ON public.learning_sessions USING btree (ended_at);


--
-- Name: learning_sessions_user_end_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX learning_sessions_user_end_idx ON public.learning_sessions USING btree (auth_user_id, ended_at DESC, id DESC) WHERE is_active;


--
-- Name: learning_unit_grants_level_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX learning_unit_grants_level_idx ON public.learning_unit_grants USING btree (level);


--
-- Name: learning_unit_grants_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX learning_unit_grants_unit_idx ON public.learning_unit_grants USING btree (unit_id);


--
-- Name: learning_units_catalog_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX learning_units_catalog_idx ON public.learning_units USING btree (level, trainer, sort_order, id);


--
-- Name: learning_units_named_lesson_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX learning_units_named_lesson_idx ON public.learning_units USING btree (level, trainer, label) WHERE ((trainer = ANY (ARRAY['vocabulary'::public.trainer_code, 'exercises'::public.trainer_code])) AND (owner_auth_user_id IS NULL));


--
-- Name: learning_units_own_words_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX learning_units_own_words_idx ON public.learning_units USING btree (owner_auth_user_id, level, trainer) WHERE (owner_auth_user_id IS NOT NULL);


--
-- Name: learning_videos_folder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX learning_videos_folder_idx ON public.learning_videos USING btree (folder_id);


--
-- Name: learning_videos_storage_path_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX learning_videos_storage_path_key ON public.learning_videos USING btree (storage_path) WHERE (storage_path IS NOT NULL);


--
-- Name: learning_videos_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX learning_videos_unit_idx ON public.learning_videos USING btree (unit_id);


--
-- Name: learning_vocabulary_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX learning_vocabulary_unit_idx ON public.learning_vocabulary_cards USING btree (unit_id);


--
-- Name: lms_media_folder_course_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lms_media_folder_course_idx ON public.lms_media_folder USING btree (course_id);


--
-- Name: lms_presentation_asset_folder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lms_presentation_asset_folder_idx ON public.lms_presentation_asset USING btree (folder_id, sort_order);


--
-- Name: path_active_node_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX path_active_node_order_idx ON public.path_nodes USING btree (unit_id, sort_order) WHERE is_active;


--
-- Name: path_active_practice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX path_active_practice_idx ON public.path_practice_runs USING btree (auth_user_id, node_id) WHERE (status = 'active'::public.path_run_status);


--
-- Name: path_active_test_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX path_active_test_idx ON public.path_test_attempts USING btree (auth_user_id, node_id) WHERE (status = 'active'::public.path_run_status);


--
-- Name: path_attempts_node_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX path_attempts_node_idx ON public.path_test_attempts USING btree (node_id);


--
-- Name: path_attempts_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX path_attempts_user_idx ON public.path_test_attempts USING btree (auth_user_id, node_id, created_at DESC);


--
-- Name: path_exercises_goal_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX path_exercises_goal_idx ON public.learning_exercises USING btree (unit_id, goal_id);


--
-- Name: path_exercises_node_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX path_exercises_node_idx ON public.learning_exercises USING btree (node_id, sort_order, id);


--
-- Name: path_exercises_ref_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX path_exercises_ref_idx ON public.learning_exercises USING btree (unit_id, source_ref) WHERE (node_id IS NOT NULL);


--
-- Name: path_interventions_creator_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX path_interventions_creator_idx ON public.path_interventions USING btree (created_by);


--
-- Name: path_interventions_node_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX path_interventions_node_idx ON public.path_interventions USING btree (node_id);


--
-- Name: path_interventions_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX path_interventions_unit_idx ON public.path_interventions USING btree (unit_id);


--
-- Name: path_interventions_user_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX path_interventions_user_unit_idx ON public.path_interventions USING btree (auth_user_id, unit_id, created_at);


--
-- Name: path_nodes_anchor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX path_nodes_anchor_idx ON public.path_nodes USING btree (anchor_node_id);


--
-- Name: path_nodes_creator_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX path_nodes_creator_idx ON public.path_nodes USING btree (created_by);


--
-- Name: path_one_review_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX path_one_review_idx ON public.path_nodes USING btree (unit_id) WHERE ((kind = 'review'::public.path_node_kind) AND is_active);


--
-- Name: path_one_test_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX path_one_test_idx ON public.path_nodes USING btree (unit_id) WHERE ((kind = 'test'::public.path_node_kind) AND is_active);


--
-- Name: path_progress_node_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX path_progress_node_idx ON public.path_node_progress USING btree (node_id);


--
-- Name: path_runs_node_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX path_runs_node_idx ON public.path_practice_runs USING btree (node_id);


--
-- Name: path_unit_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX path_unit_order_idx ON public.learning_units USING btree (level, sort_order) WHERE is_path;


--
-- Name: path_unit_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX path_unit_source_idx ON public.learning_units USING btree (level, path_source_id) WHERE is_path;


--
-- Name: people_email_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX people_email_lookup ON public.people USING btree (lower(email));


--
-- Name: pronunciation_messages_sender_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pronunciation_messages_sender_idx ON public.pronunciation_messages USING btree (sender_id);


--
-- Name: pronunciation_messages_thread_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pronunciation_messages_thread_created_idx ON public.pronunciation_messages USING btree (submission_id, created_at, id);


--
-- Name: pronunciation_messages_unseen_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pronunciation_messages_unseen_idx ON public.pronunciation_messages USING btree (submission_id) WHERE (seen_at IS NULL);


--
-- Name: submissions_prompt_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX submissions_prompt_id_idx ON public.submissions USING btree (prompt_id);


--
-- Name: teacher_attempts_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX teacher_attempts_recent_idx ON public.path_test_attempts USING btree (auth_user_id, completed_at DESC) WHERE (is_active AND (status = 'completed'::public.path_run_status));


--
-- Name: teacher_intervention_request_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX teacher_intervention_request_idx ON public.path_interventions USING btree (created_by, request_id) WHERE (request_id IS NOT NULL);


--
-- Name: teacher_progress_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX teacher_progress_active_idx ON public.path_node_progress USING btree (auth_user_id, node_id) WHERE is_active;


--
-- Name: teacher_student_notes_teacher_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX teacher_student_notes_teacher_idx ON public.teacher_student_notes USING btree (teacher_id);


--
-- Name: vocabulary_direction_card_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vocabulary_direction_card_idx ON public.vocabulary_direction_progress USING btree (card_id);


--
-- Name: vocabulary_direction_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vocabulary_direction_due_idx ON public.vocabulary_direction_progress USING btree (auth_user_id, next_review_date) WHERE (box_number < 7);


--
-- Name: vocabulary_direction_user_box_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vocabulary_direction_user_box_idx ON public.vocabulary_direction_progress USING btree (auth_user_id, box_number);


--
-- Name: vocabulary_direction_user_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vocabulary_direction_user_order_idx ON public.vocabulary_direction_progress USING btree (auth_user_id, id);


--
-- Name: vocabulary_learning_last_card_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vocabulary_learning_last_card_idx ON public.vocabulary_learning_state USING btree (last_card_id);


--
-- Name: vocabulary_lesson_pauses_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vocabulary_lesson_pauses_unit_idx ON public.vocabulary_lesson_pauses USING btree (unit_id);


--
-- Name: vocabulary_onboarding_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vocabulary_onboarding_unit_idx ON public.vocabulary_onboarding USING btree (started_unit_id);


--
-- Name: vocabulary_translations_locale_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vocabulary_translations_locale_idx ON public.vocabulary_translations USING btree (locale);


--
-- Name: answer_receipts_ui_language_idx; Type: INDEX; Schema: vocabulary_private; Owner: -
--

CREATE INDEX answer_receipts_ui_language_idx ON vocabulary_private.answer_receipts USING btree (ui_language);


--
-- Name: teacher_receipts_recent_idx; Type: INDEX; Schema: vocabulary_private; Owner: -
--

CREATE INDEX teacher_receipts_recent_idx ON vocabulary_private.answer_receipts USING btree (auth_user_id, created_at DESC);


--
-- Name: answer_receipts learning_session_path_practice; Type: TRIGGER; Schema: path_private; Owner: -
--

CREATE TRIGGER learning_session_path_practice AFTER INSERT ON path_private.answer_receipts FOR EACH ROW EXECUTE FUNCTION learning_private.capture_learning_session();


--
-- Name: course_exceptions course_exception_mail; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER course_exception_mail AFTER INSERT OR UPDATE ON public.course_exceptions FOR EACH ROW EXECUTE FUNCTION business_private.notify_course_exception();


--
-- Name: learning_exercises guard_exercise_quality; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_exercise_quality BEFORE INSERT OR UPDATE ON public.learning_exercises FOR EACH ROW EXECUTE FUNCTION grammar_private.guard_exercise_quality();


--
-- Name: lms_media_folder guard_media_folder_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_media_folder_change BEFORE DELETE OR UPDATE OF level, folder_id ON public.lms_media_folder FOR EACH ROW EXECUTE FUNCTION media_private.guard_folder_change();


--
-- Name: learning_reading_texts guard_reading_quality; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_reading_quality BEFORE INSERT OR UPDATE ON public.learning_reading_texts FOR EACH ROW EXECUTE FUNCTION learning_private.guard_reading_quality();


--
-- Name: user_exercise_progress learning_activity_grammar; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER learning_activity_grammar AFTER INSERT OR UPDATE OF attempts, completed ON public.user_exercise_progress FOR EACH ROW EXECUTE FUNCTION learning_private.record_activity_day();


--
-- Name: submissions learning_activity_pronunciation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER learning_activity_pronunciation AFTER INSERT ON public.submissions FOR EACH ROW EXECUTE FUNCTION learning_private.record_activity_day();


--
-- Name: vocabulary_direction_progress learning_activity_vocabulary; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER learning_activity_vocabulary AFTER INSERT OR UPDATE OF last_answered_at ON public.vocabulary_direction_progress FOR EACH ROW EXECUTE FUNCTION learning_private.record_activity_day();


--
-- Name: pronunciation_messages learning_reset_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER learning_reset_guard BEFORE INSERT OR UPDATE ON public.pronunciation_messages FOR EACH ROW EXECUTE FUNCTION learning_reset_private.guard_write();


--
-- Name: submissions learning_reset_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER learning_reset_guard BEFORE INSERT OR UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION learning_reset_private.guard_write();


--
-- Name: user_exercise_progress learning_reset_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER learning_reset_guard BEFORE INSERT OR UPDATE ON public.user_exercise_progress FOR EACH ROW EXECUTE FUNCTION learning_reset_private.guard_write();


--
-- Name: vocabulary_carryover_preferences learning_reset_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER learning_reset_guard BEFORE INSERT OR UPDATE ON public.vocabulary_carryover_preferences FOR EACH ROW EXECUTE FUNCTION learning_reset_private.guard_write();


--
-- Name: vocabulary_direction_progress learning_reset_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER learning_reset_guard BEFORE INSERT OR UPDATE ON public.vocabulary_direction_progress FOR EACH ROW EXECUTE FUNCTION learning_reset_private.guard_write();


--
-- Name: vocabulary_learning_state learning_reset_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER learning_reset_guard BEFORE INSERT OR UPDATE ON public.vocabulary_learning_state FOR EACH ROW EXECUTE FUNCTION learning_reset_private.guard_write();


--
-- Name: vocabulary_onboarding learning_reset_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER learning_reset_guard BEFORE INSERT OR UPDATE ON public.vocabulary_onboarding FOR EACH ROW EXECUTE FUNCTION learning_reset_private.guard_write();


--
-- Name: learning_activity_days learning_session_day_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER learning_session_day_lock BEFORE INSERT ON public.learning_activity_days FOR EACH ROW EXECUTE FUNCTION learning_private.lock_activity_day();


--
-- Name: user_exercise_progress learning_session_grammar; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER learning_session_grammar AFTER INSERT OR UPDATE OF attempts ON public.user_exercise_progress FOR EACH ROW EXECUTE FUNCTION learning_private.capture_learning_session();


--
-- Name: path_test_answers learning_session_path_test; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER learning_session_path_test AFTER INSERT ON public.path_test_answers FOR EACH ROW EXECUTE FUNCTION learning_private.capture_learning_session();


--
-- Name: submissions learning_session_pronunciation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER learning_session_pronunciation AFTER INSERT ON public.submissions FOR EACH ROW EXECUTE FUNCTION learning_private.capture_learning_session();


--
-- Name: pronunciation_messages learning_session_pronunciation_reply; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER learning_session_pronunciation_reply AFTER INSERT ON public.pronunciation_messages FOR EACH ROW EXECUTE FUNCTION learning_private.capture_learning_session();


--
-- Name: vocabulary_direction_progress learning_session_vocabulary; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER learning_session_vocabulary AFTER INSERT OR UPDATE OF last_answered_at ON public.vocabulary_direction_progress FOR EACH ROW EXECUTE FUNCTION learning_private.capture_learning_session();


--
-- Name: learning_units learning_units_own_words_cleanup; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER learning_units_own_words_cleanup BEFORE DELETE ON public.learning_units FOR EACH ROW WHEN ((old.owner_auth_user_id IS NOT NULL)) EXECUTE FUNCTION vocabulary_private.delete_own_unit_cards();


--
-- Name: student_level_access on_student_level_access_granted_notify; Type: TRIGGER; Schema: public; Owner: -
--

-- Installed after notify_students_of_level_access is defined below.


--
-- Name: learning_exercises path_catalog_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER path_catalog_guard BEFORE INSERT OR UPDATE ON public.learning_exercises FOR EACH ROW EXECUTE FUNCTION path_private.guard_catalog();


--
-- Name: learning_units path_catalog_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER path_catalog_guard BEFORE INSERT OR UPDATE ON public.learning_units FOR EACH ROW EXECUTE FUNCTION path_private.guard_catalog();


--
-- Name: path_nodes path_catalog_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER path_catalog_guard BEFORE INSERT OR UPDATE ON public.path_nodes FOR EACH ROW EXECUTE FUNCTION path_private.guard_catalog();


--
-- Name: path_objectives path_catalog_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER path_catalog_guard BEFORE INSERT OR UPDATE ON public.path_objectives FOR EACH ROW EXECUTE FUNCTION path_private.guard_catalog();


--
-- Name: pronunciation_messages pronunciation_message_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pronunciation_message_status AFTER INSERT ON public.pronunciation_messages FOR EACH ROW EXECUTE FUNCTION pronunciation_private.update_conversation_status();


--
-- Name: pronunciation_messages pronunciation_message_validate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pronunciation_message_validate BEFORE INSERT ON public.pronunciation_messages FOR EACH ROW EXECUTE FUNCTION pronunciation_private.validate_message();


--
-- Name: bookings set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION platform_private.touch_updated_at();


--
-- Name: courses set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION platform_private.touch_updated_at();


--
-- Name: invoice_cases set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.invoice_cases FOR EACH ROW EXECUTE FUNCTION platform_private.touch_updated_at();


--
-- Name: lms_media_folder set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.lms_media_folder FOR EACH ROW EXECUTE FUNCTION platform_private.touch_updated_at();


--
-- Name: lms_presentation_asset set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.lms_presentation_asset FOR EACH ROW EXECUTE FUNCTION platform_private.touch_updated_at();


--
-- Name: people set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION platform_private.touch_updated_at();


--
-- Name: profiles set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION platform_private.touch_updated_at();


--
-- Name: teacher_student_notes set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.teacher_student_notes FOR EACH ROW EXECUTE FUNCTION platform_private.touch_updated_at();


--
-- Name: user_exercise_progress set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.user_exercise_progress FOR EACH ROW EXECUTE FUNCTION platform_private.touch_updated_at();


--
-- Name: vocabulary_direction_progress set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.vocabulary_direction_progress FOR EACH ROW EXECUTE FUNCTION platform_private.touch_updated_at();


--
-- Name: vocabulary_onboarding set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.vocabulary_onboarding FOR EACH ROW EXECUTE FUNCTION platform_private.touch_updated_at();


--
-- Name: learning_videos validate_media_asset; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_media_asset BEFORE INSERT OR UPDATE ON public.learning_videos FOR EACH ROW EXECUTE FUNCTION media_private.validate_asset();


--
-- Name: lms_presentation_asset validate_media_asset; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_media_asset BEFORE INSERT OR UPDATE ON public.lms_presentation_asset FOR EACH ROW EXECUTE FUNCTION media_private.validate_asset();


--
-- Name: vocabulary_onboarding validate_onboarding_unit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_onboarding_unit BEFORE INSERT OR UPDATE OF started_unit_id, level ON public.vocabulary_onboarding FOR EACH ROW EXECUTE FUNCTION learning_private.validate_onboarding_unit();


--
-- Name: teacher_student_notes validate_teacher_student_note; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_teacher_student_note BEFORE INSERT OR UPDATE ON public.teacher_student_notes FOR EACH ROW EXECUTE FUNCTION identity_private.validate_teacher_note();


--
-- Name: learning_exercises validate_unit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_unit BEFORE INSERT OR UPDATE OF unit_id ON public.learning_exercises FOR EACH ROW EXECUTE FUNCTION learning_private.validate_content_unit('exercises');


--
-- Name: learning_reading_texts validate_unit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_unit BEFORE INSERT OR UPDATE OF unit_id ON public.learning_reading_texts FOR EACH ROW EXECUTE FUNCTION learning_private.validate_content_unit('pronunciation');


--
-- Name: learning_videos validate_unit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_unit BEFORE INSERT OR UPDATE OF unit_id ON public.learning_videos FOR EACH ROW EXECUTE FUNCTION learning_private.validate_content_unit('videos');


--
-- Name: learning_vocabulary_cards validate_unit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_unit BEFORE INSERT OR UPDATE OF unit_id ON public.learning_vocabulary_cards FOR EACH ROW EXECUTE FUNCTION learning_private.validate_content_unit('vocabulary');


--
-- Name: learning_videos validate_video_publication; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER validate_video_publication AFTER INSERT OR UPDATE ON public.learning_videos DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION learning_private.validate_video_publication();


--
-- Name: learning_units validate_video_unit_publication; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER validate_video_unit_publication AFTER INSERT OR UPDATE ON public.learning_units DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION learning_private.validate_video_publication();


--
-- Name: answer_receipts learning_reset_guard; Type: TRIGGER; Schema: vocabulary_private; Owner: -
--

CREATE TRIGGER learning_reset_guard BEFORE INSERT OR UPDATE ON vocabulary_private.answer_receipts FOR EACH ROW EXECUTE FUNCTION learning_reset_private.guard_write();


--
-- Name: registration_identity_resolutions registration_identity_resolutions_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: business_private; Owner: -
--

ALTER TABLE ONLY business_private.registration_identity_resolutions
    ADD CONSTRAINT registration_identity_resolutions_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: registration_identity_resolutions registration_identity_resolutions_person_id_fkey; Type: FK CONSTRAINT; Schema: business_private; Owner: -
--

ALTER TABLE ONLY business_private.registration_identity_resolutions
    ADD CONSTRAINT registration_identity_resolutions_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;


--
-- Name: registration_identity_resolutions registration_identity_resolutions_resolved_by_fkey; Type: FK CONSTRAINT; Schema: business_private; Owner: -
--

ALTER TABLE ONLY business_private.registration_identity_resolutions
    ADD CONSTRAINT registration_identity_resolutions_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: audio_objects audio_objects_bucket_id_fkey; Type: FK CONSTRAINT; Schema: learning_reset_private; Owner: -
--

ALTER TABLE ONLY learning_reset_private.audio_objects
    ADD CONSTRAINT audio_objects_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: audio_objects audio_objects_user_id_fkey; Type: FK CONSTRAINT; Schema: learning_reset_private; Owner: -
--

ALTER TABLE ONLY learning_reset_private.audio_objects
    ADD CONSTRAINT audio_objects_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES learning_reset_private.jobs(auth_user_id) ON DELETE CASCADE;


--
-- Name: answer_receipts answer_receipts_run_id_fkey; Type: FK CONSTRAINT; Schema: path_private; Owner: -
--

ALTER TABLE ONLY path_private.answer_receipts
    ADD CONSTRAINT answer_receipts_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.path_practice_runs(id) ON DELETE CASCADE;


--
-- Name: archived_units archived_units_unit_id_fkey; Type: FK CONSTRAINT; Schema: path_private; Owner: -
--

ALTER TABLE ONLY path_private.archived_units
    ADD CONSTRAINT archived_units_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.learning_units(id) ON DELETE CASCADE;


--
-- Name: phase4_imported_units phase4_imported_units_unit_id_fkey; Type: FK CONSTRAINT; Schema: path_private; Owner: -
--

ALTER TABLE ONLY path_private.phase4_imported_units
    ADD CONSTRAINT phase4_imported_units_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.learning_units(id) ON DELETE CASCADE;


--
-- Name: practice_items practice_items_exercise_id_fkey; Type: FK CONSTRAINT; Schema: path_private; Owner: -
--

ALTER TABLE ONLY path_private.practice_items
    ADD CONSTRAINT practice_items_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.learning_exercises(id);


--
-- Name: practice_items practice_items_run_id_fkey; Type: FK CONSTRAINT; Schema: path_private; Owner: -
--

ALTER TABLE ONLY path_private.practice_items
    ADD CONSTRAINT practice_items_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.path_practice_runs(id) ON DELETE CASCADE;


--
-- Name: rollback_unit_flags rollback_unit_flags_unit_id_fkey; Type: FK CONSTRAINT; Schema: path_private; Owner: -
--

ALTER TABLE ONLY path_private.rollback_unit_flags
    ADD CONSTRAINT rollback_unit_flags_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.learning_units(id) ON DELETE CASCADE;


--
-- Name: test_items test_items_attempt_id_fkey; Type: FK CONSTRAINT; Schema: path_private; Owner: -
--

ALTER TABLE ONLY path_private.test_items
    ADD CONSTRAINT test_items_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.path_test_attempts(id) ON DELETE CASCADE;


--
-- Name: test_items test_items_exercise_id_fkey; Type: FK CONSTRAINT; Schema: path_private; Owner: -
--

ALTER TABLE ONLY path_private.test_items
    ADD CONSTRAINT test_items_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.learning_exercises(id);


--
-- Name: mail_exception_deliveries mail_exception_deliveries_booking_id_fkey; Type: FK CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.mail_exception_deliveries
    ADD CONSTRAINT mail_exception_deliveries_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: mail_exception_deliveries mail_exception_deliveries_course_id_fkey; Type: FK CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.mail_exception_deliveries
    ADD CONSTRAINT mail_exception_deliveries_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: mail_outbox mail_outbox_locale_fkey; Type: FK CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.mail_outbox
    ADD CONSTRAINT mail_outbox_locale_fkey FOREIGN KEY (locale) REFERENCES public.locales(code);


--
-- Name: booking_items booking_items_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_items
    ADD CONSTRAINT booking_items_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_items booking_items_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_items
    ADD CONSTRAINT booking_items_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id);


--
-- Name: bookings bookings_confirmed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES public.profiles(id);


--
-- Name: bookings bookings_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id);


--
-- Name: cancellation_requests cancellation_requests_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cancellation_requests
    ADD CONSTRAINT cancellation_requests_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id);


--
-- Name: course_exceptions course_exceptions_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_exceptions
    ADD CONSTRAINT course_exceptions_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: course_schedules course_schedules_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_schedules
    ADD CONSTRAINT course_schedules_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: course_translations course_translations_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_translations
    ADD CONSTRAINT course_translations_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: course_translations course_translations_locale_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_translations
    ADD CONSTRAINT course_translations_locale_fkey FOREIGN KEY (locale) REFERENCES public.locales(code);


--
-- Name: courses courses_audience_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_audience_code_fkey FOREIGN KEY (audience_code) REFERENCES public.course_audiences(code);


--
-- Name: courses courses_level_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_level_fkey FOREIGN KEY (level) REFERENCES public.learning_levels(code);


--
-- Name: grammar_translations grammar_locale_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grammar_translations
    ADD CONSTRAINT grammar_locale_fk FOREIGN KEY (locale) REFERENCES public.locales(code);


--
-- Name: grammar_translations grammar_translations_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grammar_translations
    ADD CONSTRAINT grammar_translations_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.learning_exercises(id) ON DELETE CASCADE;


--
-- Name: invoice_cases invoice_cases_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_cases
    ADD CONSTRAINT invoice_cases_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id);


--
-- Name: invoice_cases invoice_cases_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_cases
    ADD CONSTRAINT invoice_cases_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: invoice_cases invoice_cases_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_cases
    ADD CONSTRAINT invoice_cases_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id);


--
-- Name: learning_activity_days learning_activity_days_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_activity_days
    ADD CONSTRAINT learning_activity_days_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: learning_exercises learning_exercises_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_exercises
    ADD CONSTRAINT learning_exercises_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.learning_units(id);


--
-- Name: learning_trainer_grants learning_grants_trainer_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_trainer_grants
    ADD CONSTRAINT learning_grants_trainer_fk FOREIGN KEY (trainer) REFERENCES public.learning_trainers(code);


--
-- Name: learning_levels learning_levels_cefr_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_levels
    ADD CONSTRAINT learning_levels_cefr_fk FOREIGN KEY (cefr_level) REFERENCES public.cefr_levels(code);


--
-- Name: learning_reading_texts learning_reading_texts_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_reading_texts
    ADD CONSTRAINT learning_reading_texts_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.learning_units(id);


--
-- Name: learning_sessions learning_sessions_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_sessions
    ADD CONSTRAINT learning_sessions_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: learning_sessions learning_sessions_level_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_sessions
    ADD CONSTRAINT learning_sessions_level_fkey FOREIGN KEY (level) REFERENCES public.learning_levels(code);


--
-- Name: learning_trainer_grants learning_trainer_grants_level_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_trainer_grants
    ADD CONSTRAINT learning_trainer_grants_level_fkey FOREIGN KEY (level) REFERENCES public.learning_levels(code);


--
-- Name: learning_trainer_grants learning_trainer_grants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_trainer_grants
    ADD CONSTRAINT learning_trainer_grants_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: learning_unit_grants learning_unit_grants_level_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_unit_grants
    ADD CONSTRAINT learning_unit_grants_level_fkey FOREIGN KEY (level) REFERENCES public.learning_levels(code);


--
-- Name: learning_unit_grants learning_unit_grants_unit_id_level_trainer_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_unit_grants
    ADD CONSTRAINT learning_unit_grants_unit_id_level_trainer_fkey FOREIGN KEY (unit_id, level, trainer) REFERENCES public.learning_units(id, level, trainer) ON DELETE CASCADE;


--
-- Name: learning_unit_grants learning_unit_grants_user_id_level_trainer_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_unit_grants
    ADD CONSTRAINT learning_unit_grants_user_id_level_trainer_fkey FOREIGN KEY (auth_user_id, level, trainer) REFERENCES public.learning_trainer_grants(auth_user_id, level, trainer) ON DELETE CASCADE;


--
-- Name: learning_units learning_units_level_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_units
    ADD CONSTRAINT learning_units_level_fkey FOREIGN KEY (level) REFERENCES public.learning_levels(code);


--
-- Name: learning_units learning_units_owner_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_units
    ADD CONSTRAINT learning_units_owner_auth_user_id_fkey FOREIGN KEY (owner_auth_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: learning_units learning_units_trainer_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_units
    ADD CONSTRAINT learning_units_trainer_fk FOREIGN KEY (trainer) REFERENCES public.learning_trainers(code);


--
-- Name: learning_videos learning_videos_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_videos
    ADD CONSTRAINT learning_videos_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.lms_media_folder(folder_id) ON DELETE RESTRICT;


--
-- Name: learning_videos learning_videos_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_videos
    ADD CONSTRAINT learning_videos_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.learning_units(id);


--
-- Name: learning_vocabulary_cards learning_vocabulary_cards_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_vocabulary_cards
    ADD CONSTRAINT learning_vocabulary_cards_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.learning_units(id);


--
-- Name: lms_media_folder lms_media_folder_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_media_folder
    ADD CONSTRAINT lms_media_folder_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE SET NULL;


--
-- Name: lms_media_folder lms_media_folder_level_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_media_folder
    ADD CONSTRAINT lms_media_folder_level_fkey FOREIGN KEY (level) REFERENCES public.learning_levels(code);


--
-- Name: lms_presentation_asset lms_presentation_asset_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_presentation_asset
    ADD CONSTRAINT lms_presentation_asset_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.lms_media_folder(folder_id) ON DELETE CASCADE;


--
-- Name: lms_presentation_asset lms_presentation_asset_mime_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lms_presentation_asset
    ADD CONSTRAINT lms_presentation_asset_mime_type_fkey FOREIGN KEY (mime_type) REFERENCES public.media_mime_types(mime_type);


--
-- Name: learning_exercises path_exercise_goal_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_exercises
    ADD CONSTRAINT path_exercise_goal_fk FOREIGN KEY (unit_id, goal_id) REFERENCES public.path_objectives(unit_id, id);


--
-- Name: learning_exercises path_exercise_node_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_exercises
    ADD CONSTRAINT path_exercise_node_fk FOREIGN KEY (node_id, unit_id) REFERENCES public.path_nodes(id, unit_id);


--
-- Name: path_interventions path_interventions_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_interventions
    ADD CONSTRAINT path_interventions_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: path_interventions path_interventions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_interventions
    ADD CONSTRAINT path_interventions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: path_interventions path_interventions_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_interventions
    ADD CONSTRAINT path_interventions_node_id_fkey FOREIGN KEY (node_id) REFERENCES public.path_nodes(id) ON DELETE CASCADE;


--
-- Name: path_interventions path_interventions_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_interventions
    ADD CONSTRAINT path_interventions_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.learning_units(id) ON DELETE CASCADE;


--
-- Name: path_legacy_progress_notes path_legacy_progress_notes_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_legacy_progress_notes
    ADD CONSTRAINT path_legacy_progress_notes_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: path_legacy_progress_notes path_legacy_progress_notes_level_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_legacy_progress_notes
    ADD CONSTRAINT path_legacy_progress_notes_level_fkey FOREIGN KEY (level) REFERENCES public.learning_levels(code);


--
-- Name: path_node_progress path_node_progress_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_node_progress
    ADD CONSTRAINT path_node_progress_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: path_node_progress path_node_progress_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_node_progress
    ADD CONSTRAINT path_node_progress_node_id_fkey FOREIGN KEY (node_id) REFERENCES public.path_nodes(id) ON DELETE CASCADE;


--
-- Name: path_node_translations path_node_translations_locale_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_node_translations
    ADD CONSTRAINT path_node_translations_locale_fkey FOREIGN KEY (locale) REFERENCES public.locales(code);


--
-- Name: path_node_translations path_node_translations_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_node_translations
    ADD CONSTRAINT path_node_translations_node_id_fkey FOREIGN KEY (node_id) REFERENCES public.path_nodes(id) ON DELETE CASCADE;


--
-- Name: path_nodes path_nodes_anchor_node_id_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_nodes
    ADD CONSTRAINT path_nodes_anchor_node_id_unit_id_fkey FOREIGN KEY (anchor_node_id, unit_id) REFERENCES public.path_nodes(id, unit_id);


--
-- Name: path_nodes path_nodes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_nodes
    ADD CONSTRAINT path_nodes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: path_nodes path_nodes_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_nodes
    ADD CONSTRAINT path_nodes_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.learning_units(id) ON DELETE CASCADE;


--
-- Name: path_objectives path_objectives_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_objectives
    ADD CONSTRAINT path_objectives_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.learning_units(id) ON DELETE CASCADE;


--
-- Name: path_practice_runs path_practice_runs_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_practice_runs
    ADD CONSTRAINT path_practice_runs_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: path_practice_runs path_practice_runs_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_practice_runs
    ADD CONSTRAINT path_practice_runs_node_id_fkey FOREIGN KEY (node_id) REFERENCES public.path_nodes(id) ON DELETE CASCADE;


--
-- Name: path_test_answers path_test_answers_attempt_id_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_test_answers
    ADD CONSTRAINT path_test_answers_attempt_id_exercise_id_fkey FOREIGN KEY (attempt_id, exercise_id) REFERENCES path_private.test_items(attempt_id, exercise_id) ON DELETE CASCADE;


--
-- Name: path_test_attempts path_test_attempts_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_test_attempts
    ADD CONSTRAINT path_test_attempts_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: path_test_attempts path_test_attempts_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_test_attempts
    ADD CONSTRAINT path_test_attempts_node_id_fkey FOREIGN KEY (node_id) REFERENCES public.path_nodes(id) ON DELETE CASCADE;


--
-- Name: path_unit_translations path_unit_translations_locale_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_unit_translations
    ADD CONSTRAINT path_unit_translations_locale_fkey FOREIGN KEY (locale) REFERENCES public.locales(code);


--
-- Name: path_unit_translations path_unit_translations_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.path_unit_translations
    ADD CONSTRAINT path_unit_translations_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.learning_units(id) ON DELETE CASCADE;


--
-- Name: people people_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people
    ADD CONSTRAINT people_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: people people_preferred_locale_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people
    ADD CONSTRAINT people_preferred_locale_fkey FOREIGN KEY (preferred_locale) REFERENCES public.locales(code);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_native_language_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_native_language_fkey FOREIGN KEY (native_language) REFERENCES public.locales(code);


--
-- Name: profiles profiles_ui_language_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_ui_language_fkey FOREIGN KEY (ui_language) REFERENCES public.locales(code);


--
-- Name: pronunciation_messages pronunciation_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pronunciation_messages
    ADD CONSTRAINT pronunciation_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id);


--
-- Name: pronunciation_messages pronunciation_messages_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pronunciation_messages
    ADD CONSTRAINT pronunciation_messages_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(id) ON DELETE CASCADE;


--
-- Name: student_level_access student_level_access_level_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_level_access
    ADD CONSTRAINT student_level_access_level_fkey FOREIGN KEY (level) REFERENCES public.learning_levels(code);


--
-- Name: student_level_access student_level_access_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_level_access
    ADD CONSTRAINT student_level_access_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: submissions submissions_level_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_level_fk FOREIGN KEY (level) REFERENCES public.learning_levels(code);


--
-- Name: submissions submissions_prompt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES public.learning_reading_texts(id) ON DELETE SET NULL;


--
-- Name: submissions submissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: teacher_student_notes teacher_student_notes_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_student_notes
    ADD CONSTRAINT teacher_student_notes_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: teacher_student_notes teacher_student_notes_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_student_notes
    ADD CONSTRAINT teacher_student_notes_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_exercise_progress user_exercise_progress_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_exercise_progress
    ADD CONSTRAINT user_exercise_progress_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.learning_exercises(id) ON DELETE CASCADE;


--
-- Name: user_exercise_progress user_exercise_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_exercise_progress
    ADD CONSTRAINT user_exercise_progress_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: vocabulary_carryover_preferences vocabulary_carryover_preferences_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_carryover_preferences
    ADD CONSTRAINT vocabulary_carryover_preferences_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: vocabulary_carryover_preferences vocabulary_carryover_preferences_target_level_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_carryover_preferences
    ADD CONSTRAINT vocabulary_carryover_preferences_target_level_fkey FOREIGN KEY (target_level) REFERENCES public.learning_levels(code);


--
-- Name: vocabulary_direction_progress vocabulary_direction_progress_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_direction_progress
    ADD CONSTRAINT vocabulary_direction_progress_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.learning_vocabulary_cards(id) ON DELETE CASCADE;


--
-- Name: vocabulary_direction_progress vocabulary_direction_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_direction_progress
    ADD CONSTRAINT vocabulary_direction_progress_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: vocabulary_learning_state vocabulary_learning_state_last_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_learning_state
    ADD CONSTRAINT vocabulary_learning_state_last_card_id_fkey FOREIGN KEY (last_card_id) REFERENCES public.learning_vocabulary_cards(id) ON DELETE SET NULL;


--
-- Name: vocabulary_learning_state vocabulary_learning_state_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_learning_state
    ADD CONSTRAINT vocabulary_learning_state_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: vocabulary_lesson_pauses vocabulary_lesson_pauses_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_lesson_pauses
    ADD CONSTRAINT vocabulary_lesson_pauses_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: vocabulary_lesson_pauses vocabulary_lesson_pauses_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_lesson_pauses
    ADD CONSTRAINT vocabulary_lesson_pauses_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.learning_units(id) ON DELETE CASCADE;


--
-- Name: vocabulary_translations vocabulary_locale_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_translations
    ADD CONSTRAINT vocabulary_locale_fk FOREIGN KEY (locale) REFERENCES public.locales(code);


--
-- Name: vocabulary_onboarding vocabulary_onboarding_level_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_onboarding
    ADD CONSTRAINT vocabulary_onboarding_level_fk FOREIGN KEY (level) REFERENCES public.learning_levels(code);


--
-- Name: vocabulary_onboarding vocabulary_onboarding_unit_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_onboarding
    ADD CONSTRAINT vocabulary_onboarding_unit_fk FOREIGN KEY (started_unit_id) REFERENCES public.learning_units(id) ON DELETE CASCADE;


--
-- Name: vocabulary_onboarding vocabulary_onboarding_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_onboarding
    ADD CONSTRAINT vocabulary_onboarding_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: vocabulary_translations vocabulary_translations_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_translations
    ADD CONSTRAINT vocabulary_translations_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.learning_vocabulary_cards(id) ON DELETE CASCADE;


--
-- Name: progress_archive progress_archive_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: teacher_dashboard_private; Owner: -
--

ALTER TABLE ONLY teacher_dashboard_private.progress_archive
    ADD CONSTRAINT progress_archive_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: answer_receipts answer_receipts_target_level_fkey; Type: FK CONSTRAINT; Schema: vocabulary_private; Owner: -
--

ALTER TABLE ONLY vocabulary_private.answer_receipts
    ADD CONSTRAINT answer_receipts_target_level_fkey FOREIGN KEY (target_level) REFERENCES public.learning_levels(code);


--
-- Name: answer_receipts answer_receipts_ui_language_fkey; Type: FK CONSTRAINT; Schema: vocabulary_private; Owner: -
--

ALTER TABLE ONLY vocabulary_private.answer_receipts
    ADD CONSTRAINT answer_receipts_ui_language_fkey FOREIGN KEY (ui_language) REFERENCES public.locales(code);


--
-- Name: registration_identity_resolutions; Type: ROW SECURITY; Schema: business_private; Owner: -
--

ALTER TABLE business_private.registration_identity_resolutions ENABLE ROW LEVEL SECURITY;

--
-- Name: session_function_backups; Type: ROW SECURITY; Schema: learning_private; Owner: -
--

ALTER TABLE learning_private.session_function_backups ENABLE ROW LEVEL SECURITY;

--
-- Name: audio_objects; Type: ROW SECURITY; Schema: learning_reset_private; Owner: -
--

ALTER TABLE learning_reset_private.audio_objects ENABLE ROW LEVEL SECURITY;

--
-- Name: jobs; Type: ROW SECURITY; Schema: learning_reset_private; Owner: -
--

ALTER TABLE learning_reset_private.jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: answer_receipts; Type: ROW SECURITY; Schema: path_private; Owner: -
--

ALTER TABLE path_private.answer_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: archived_units; Type: ROW SECURITY; Schema: path_private; Owner: -
--

ALTER TABLE path_private.archived_units ENABLE ROW LEVEL SECURITY;

--
-- Name: content_contract_backups; Type: ROW SECURITY; Schema: path_private; Owner: -
--

ALTER TABLE path_private.content_contract_backups ENABLE ROW LEVEL SECURITY;

--
-- Name: function_backups; Type: ROW SECURITY; Schema: path_private; Owner: -
--

ALTER TABLE path_private.function_backups ENABLE ROW LEVEL SECURITY;

--
-- Name: phase4_function_backups; Type: ROW SECURITY; Schema: path_private; Owner: -
--

ALTER TABLE path_private.phase4_function_backups ENABLE ROW LEVEL SECURITY;

--
-- Name: phase4_imported_units; Type: ROW SECURITY; Schema: path_private; Owner: -
--

ALTER TABLE path_private.phase4_imported_units ENABLE ROW LEVEL SECURITY;

--
-- Name: practice_items; Type: ROW SECURITY; Schema: path_private; Owner: -
--

ALTER TABLE path_private.practice_items ENABLE ROW LEVEL SECURITY;

--
-- Name: rollback_unit_flags; Type: ROW SECURITY; Schema: path_private; Owner: -
--

ALTER TABLE path_private.rollback_unit_flags ENABLE ROW LEVEL SECURITY;

--
-- Name: test_items; Type: ROW SECURITY; Schema: path_private; Owner: -
--

ALTER TABLE path_private.test_items ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limits; Type: ROW SECURITY; Schema: platform_private; Owner: -
--

ALTER TABLE platform_private.rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: mail_exception_deliveries; Type: ROW SECURITY; Schema: private; Owner: -
--

ALTER TABLE private.mail_exception_deliveries ENABLE ROW LEVEL SECURITY;

--
-- Name: mail_outbox; Type: ROW SECURITY; Schema: private; Owner: -
--

ALTER TABLE private.mail_outbox ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_levels authenticated_levels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_levels ON public.learning_levels FOR SELECT TO authenticated USING (true);


--
-- Name: booking_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_items ENABLE ROW LEVEL SECURITY;

--
-- Name: bookings booking_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_read ON public.bookings FOR SELECT TO authenticated USING ((( SELECT business_private.is_staff() AS is_staff) OR (EXISTS ( SELECT 1
   FROM public.people p
  WHERE ((p.id = bookings.person_id) AND (p.auth_user_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: cancellation_requests cancellation_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cancellation_read ON public.cancellation_requests FOR SELECT TO authenticated USING (( SELECT business_private.is_staff() AS is_staff));


--
-- Name: cancellation_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cancellation_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: cefr_levels catalog_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY catalog_read ON public.cefr_levels FOR SELECT TO authenticated USING (true);


--
-- Name: course_audiences catalog_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY catalog_read ON public.course_audiences FOR SELECT TO authenticated, anon USING (true);


--
-- Name: courses catalog_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY catalog_read ON public.courses FOR SELECT TO authenticated, anon USING ((archived_at IS NULL));


--
-- Name: learning_trainers catalog_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY catalog_read ON public.learning_trainers FOR SELECT TO authenticated USING (true);


--
-- Name: courses catalog_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY catalog_staff ON public.courses FOR SELECT TO authenticated USING (( SELECT business_private.is_staff() AS is_staff));


--
-- Name: cefr_levels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cefr_levels ENABLE ROW LEVEL SECURITY;

--
-- Name: course_audiences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.course_audiences ENABLE ROW LEVEL SECURITY;

--
-- Name: course_exceptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.course_exceptions ENABLE ROW LEVEL SECURITY;

--
-- Name: course_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.course_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: course_translations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.course_translations ENABLE ROW LEVEL SECURITY;

--
-- Name: courses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

--
-- Name: course_exceptions exception_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY exception_read ON public.course_exceptions FOR SELECT TO authenticated, anon USING (((course_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.courses c
  WHERE (c.id = course_exceptions.course_id)))));


--
-- Name: user_exercise_progress grammar_progress_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grammar_progress_read ON public.user_exercise_progress FOR SELECT TO authenticated USING (((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text])) OR ((auth_user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.learning_exercises e
  WHERE ((e.id = user_exercise_progress.exercise_id) AND learning_private.unit_allowed(e.unit_id)))))));


--
-- Name: grammar_translations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.grammar_translations ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_cases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoice_cases ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_cases invoice_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invoice_read ON public.invoice_cases FOR SELECT TO authenticated USING (( SELECT business_private.is_staff() AS is_staff));


--
-- Name: booking_items item_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY item_read ON public.booking_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.bookings b
  WHERE (b.id = booking_items.booking_id))));


--
-- Name: learning_activity_days; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_activity_days ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_activity_days learning_activity_days_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learning_activity_days_read ON public.learning_activity_days FOR SELECT TO authenticated USING ((auth_user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: learning_activity_days learning_activity_days_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learning_activity_days_staff_read ON public.learning_activity_days FOR SELECT TO authenticated USING (( SELECT business_private.is_staff() AS is_staff));


--
-- Name: learning_exercises; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_exercises ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_levels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_levels ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_reading_texts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_reading_texts ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_sessions learning_sessions_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY learning_sessions_read ON public.learning_sessions FOR SELECT TO authenticated USING ((is_active AND ((auth_user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT business_private.is_staff() AS is_staff))));


--
-- Name: learning_trainer_grants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_trainer_grants ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_trainers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_trainers ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_unit_grants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_unit_grants ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_units; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_units ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_videos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_videos ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_vocabulary_cards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_vocabulary_cards ENABLE ROW LEVEL SECURITY;

--
-- Name: lms_media_folder; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lms_media_folder ENABLE ROW LEVEL SECURITY;

--
-- Name: lms_presentation_asset; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lms_presentation_asset ENABLE ROW LEVEL SECURITY;

--
-- Name: locales; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.locales ENABLE ROW LEVEL SECURITY;

--
-- Name: locales locales_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY locales_read ON public.locales FOR SELECT TO authenticated, anon USING (true);


--
-- Name: lms_media_folder media_folder_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY media_folder_read ON public.lms_media_folder FOR SELECT TO authenticated USING (media_private.folder_allowed(folder_id));


--
-- Name: media_mime_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.media_mime_types ENABLE ROW LEVEL SECURITY;

--
-- Name: lms_presentation_asset media_presentation_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY media_presentation_read ON public.lms_presentation_asset FOR SELECT TO authenticated USING (media_private.folder_allowed(folder_id));


--
-- Name: media_mime_types mime_catalog_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mime_catalog_read ON public.media_mime_types FOR SELECT TO authenticated USING (true);


--
-- Name: learning_trainer_grants own_access_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY own_access_read ON public.learning_trainer_grants FOR SELECT TO authenticated USING ((auth_user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: learning_unit_grants own_access_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY own_access_read ON public.learning_unit_grants FOR SELECT TO authenticated USING ((auth_user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: student_level_access own_access_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY own_access_read ON public.student_level_access FOR SELECT TO authenticated USING ((auth_user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: path_test_answers path_finished_answers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY path_finished_answers ON public.path_test_answers FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.path_test_attempts a
  WHERE ((a.id = path_test_answers.attempt_id) AND (a.auth_user_id = ( SELECT auth.uid() AS uid)) AND (a.status = 'completed'::public.path_run_status)))));


--
-- Name: path_interventions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.path_interventions ENABLE ROW LEVEL SECURITY;

--
-- Name: path_legacy_progress_notes path_legacy_notes_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY path_legacy_notes_staff_read ON public.path_legacy_progress_notes FOR SELECT TO authenticated USING (( SELECT business_private.is_staff() AS is_staff));


--
-- Name: path_legacy_progress_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.path_legacy_progress_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: path_node_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.path_node_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: path_node_translations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.path_node_translations ENABLE ROW LEVEL SECURITY;

--
-- Name: path_nodes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.path_nodes ENABLE ROW LEVEL SECURITY;

--
-- Name: path_objectives; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.path_objectives ENABLE ROW LEVEL SECURITY;

--
-- Name: path_interventions path_own_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY path_own_read ON public.path_interventions FOR SELECT TO authenticated USING ((auth_user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: path_node_progress path_own_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY path_own_read ON public.path_node_progress FOR SELECT TO authenticated USING ((auth_user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: path_practice_runs path_own_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY path_own_read ON public.path_practice_runs FOR SELECT TO authenticated USING ((auth_user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: path_test_attempts path_own_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY path_own_read ON public.path_test_attempts FOR SELECT TO authenticated USING ((auth_user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: path_practice_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.path_practice_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: path_interventions path_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY path_staff_read ON public.path_interventions FOR SELECT TO authenticated USING (( SELECT business_private.is_staff() AS is_staff));


--
-- Name: path_node_progress path_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY path_staff_read ON public.path_node_progress FOR SELECT TO authenticated USING (( SELECT business_private.is_staff() AS is_staff));


--
-- Name: path_node_translations path_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY path_staff_read ON public.path_node_translations FOR SELECT TO authenticated USING (( SELECT business_private.is_staff() AS is_staff));


--
-- Name: path_nodes path_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY path_staff_read ON public.path_nodes FOR SELECT TO authenticated USING (( SELECT business_private.is_staff() AS is_staff));


--
-- Name: path_objectives path_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY path_staff_read ON public.path_objectives FOR SELECT TO authenticated USING (( SELECT business_private.is_staff() AS is_staff));


--
-- Name: path_practice_runs path_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY path_staff_read ON public.path_practice_runs FOR SELECT TO authenticated USING (( SELECT business_private.is_staff() AS is_staff));


--
-- Name: path_test_answers path_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY path_staff_read ON public.path_test_answers FOR SELECT TO authenticated USING (( SELECT business_private.is_staff() AS is_staff));


--
-- Name: path_test_attempts path_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY path_staff_read ON public.path_test_attempts FOR SELECT TO authenticated USING (( SELECT business_private.is_staff() AS is_staff));


--
-- Name: path_unit_translations path_staff_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY path_staff_read ON public.path_unit_translations FOR SELECT TO authenticated USING (( SELECT business_private.is_staff() AS is_staff));


--
-- Name: path_test_answers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.path_test_answers ENABLE ROW LEVEL SECURITY;

--
-- Name: path_test_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.path_test_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: path_unit_translations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.path_unit_translations ENABLE ROW LEVEL SECURITY;

--
-- Name: people; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

--
-- Name: people people_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY people_read ON public.people FOR SELECT TO authenticated USING (((auth_user_id = ( SELECT auth.uid() AS uid)) OR (( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text]))));


--
-- Name: people people_update_contact; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY people_update_contact ON public.people FOR UPDATE TO authenticated USING (((auth_user_id = ( SELECT auth.uid() AS uid)) OR (( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text])))) WITH CHECK (((auth_user_id = ( SELECT auth.uid() AS uid)) OR (( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text]))));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated USING (((id = ( SELECT auth.uid() AS uid)) OR (( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text]))));


--
-- Name: profiles profiles_update_preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_preferences ON public.profiles FOR UPDATE TO authenticated USING ((id = ( SELECT auth.uid() AS uid))) WITH CHECK ((id = ( SELECT auth.uid() AS uid)));


--
-- Name: pronunciation_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pronunciation_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: pronunciation_messages pronunciation_messages_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pronunciation_messages_read ON public.pronunciation_messages FOR SELECT TO authenticated USING (pronunciation_private.can_access_submission(submission_id));


--
-- Name: pronunciation_messages pronunciation_messages_send; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pronunciation_messages_send ON public.pronunciation_messages FOR INSERT TO authenticated WITH CHECK (((sender_id = ( SELECT auth.uid() AS uid)) AND pronunciation_private.can_access_submission(submission_id)));


--
-- Name: submissions pronunciation_threads_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pronunciation_threads_read ON public.submissions FOR SELECT TO authenticated USING (pronunciation_private.can_access_submission(id));


--
-- Name: learning_exercises released_content_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY released_content_read ON public.learning_exercises FOR SELECT TO authenticated USING (((node_id IS NULL) AND (content_status = 'ready'::public.learning_content_status) AND path_is_active AND learning_private.unit_allowed(unit_id)));


--
-- Name: learning_reading_texts released_content_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY released_content_read ON public.learning_reading_texts FOR SELECT TO authenticated USING ((learning_private.german_text_allowed(sentence_de) AND learning_private.german_text_allowed(focus) AND learning_private.unit_allowed(unit_id)));


--
-- Name: learning_videos released_content_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY released_content_read ON public.learning_videos FOR SELECT TO authenticated USING (((((storage_path IS NOT NULL) AND (unit_id = ANY (( SELECT media_private.published_video_unit_ids() AS published_video_unit_ids)::uuid[]))) OR ((storage_path IS NULL) AND learning_private.unit_allowed(unit_id))) AND ((folder_id IS NULL) OR media_private.folder_allowed(folder_id))));


--
-- Name: learning_vocabulary_cards released_content_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY released_content_read ON public.learning_vocabulary_cards FOR SELECT TO authenticated USING ((unit_id = ANY (( SELECT learning_private.allowed_unit_ids() AS allowed_unit_ids)::uuid[])));


--
-- Name: grammar_translations released_grammar_translations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY released_grammar_translations ON public.grammar_translations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.learning_exercises e
  WHERE (e.id = grammar_translations.exercise_id))));


--
-- Name: vocabulary_translations released_translations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY released_translations ON public.vocabulary_translations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.learning_vocabulary_cards c
  WHERE (c.id = vocabulary_translations.card_id))));


--
-- Name: learning_units released_units; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY released_units ON public.learning_units FOR SELECT TO authenticated USING (((id = ANY (( SELECT learning_private.allowed_unit_ids() AS allowed_unit_ids)::uuid[])) OR (id = ANY (( SELECT media_private.published_video_unit_ids() AS published_video_unit_ids)::uuid[]))));


--
-- Name: course_schedules schedule_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedule_read ON public.course_schedules FOR SELECT TO authenticated, anon USING ((EXISTS ( SELECT 1
   FROM public.courses c
  WHERE (c.id = course_schedules.course_id))));


--
-- Name: grammar_translations staff_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_manage ON public.grammar_translations TO authenticated USING ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text]))) WITH CHECK ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text])));


--
-- Name: learning_exercises staff_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_manage ON public.learning_exercises TO authenticated USING ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text]))) WITH CHECK ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text])));


--
-- Name: learning_levels staff_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_manage ON public.learning_levels TO authenticated USING ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text]))) WITH CHECK ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text])));


--
-- Name: learning_reading_texts staff_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_manage ON public.learning_reading_texts TO authenticated USING ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text]))) WITH CHECK ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text])));


--
-- Name: learning_trainer_grants staff_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_manage ON public.learning_trainer_grants TO authenticated USING ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text]))) WITH CHECK ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text])));


--
-- Name: learning_unit_grants staff_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_manage ON public.learning_unit_grants TO authenticated USING ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text]))) WITH CHECK ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text])));


--
-- Name: learning_units staff_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_manage ON public.learning_units TO authenticated USING ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text]))) WITH CHECK ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text])));


--
-- Name: learning_videos staff_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_manage ON public.learning_videos TO authenticated USING ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text]))) WITH CHECK ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text])));


--
-- Name: learning_vocabulary_cards staff_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_manage ON public.learning_vocabulary_cards TO authenticated USING ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text]))) WITH CHECK ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text])));


--
-- Name: lms_media_folder staff_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_manage ON public.lms_media_folder TO authenticated USING ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text]))) WITH CHECK ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text])));


--
-- Name: lms_presentation_asset staff_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_manage ON public.lms_presentation_asset TO authenticated USING ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text]))) WITH CHECK ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text])));


--
-- Name: student_level_access staff_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_manage ON public.student_level_access TO authenticated USING ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text]))) WITH CHECK ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text])));


--
-- Name: vocabulary_translations staff_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_manage ON public.vocabulary_translations TO authenticated USING ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text]))) WITH CHECK ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text])));


--
-- Name: student_level_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_level_access ENABLE ROW LEVEL SECURITY;

--
-- Name: submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: teacher_student_notes teacher_notes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teacher_notes_delete ON public.teacher_student_notes FOR DELETE TO authenticated USING ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text])));


--
-- Name: teacher_student_notes teacher_notes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teacher_notes_insert ON public.teacher_student_notes FOR INSERT TO authenticated WITH CHECK (((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text])) AND (teacher_id = ( SELECT auth.uid() AS uid))));


--
-- Name: teacher_student_notes teacher_notes_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teacher_notes_read ON public.teacher_student_notes FOR SELECT TO authenticated USING ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text])));


--
-- Name: teacher_student_notes teacher_notes_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teacher_notes_update ON public.teacher_student_notes FOR UPDATE TO authenticated USING ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text]))) WITH CHECK ((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text])));


--
-- Name: teacher_student_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teacher_student_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: course_translations translation_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY translation_read ON public.course_translations FOR SELECT TO authenticated, anon USING ((EXISTS ( SELECT 1
   FROM public.courses c
  WHERE (c.id = course_translations.course_id))));


--
-- Name: user_exercise_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_exercise_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: vocabulary_carryover_preferences vocabulary_carryover_own_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vocabulary_carryover_own_read ON public.vocabulary_carryover_preferences FOR SELECT TO authenticated USING (((auth_user_id = ( SELECT auth.uid() AS uid)) AND is_active));


--
-- Name: vocabulary_carryover_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vocabulary_carryover_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: vocabulary_direction_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vocabulary_direction_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: vocabulary_learning_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vocabulary_learning_state ENABLE ROW LEVEL SECURITY;

--
-- Name: vocabulary_lesson_pauses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vocabulary_lesson_pauses ENABLE ROW LEVEL SECURITY;

--
-- Name: vocabulary_lesson_pauses vocabulary_lesson_pauses_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vocabulary_lesson_pauses_read ON public.vocabulary_lesson_pauses FOR SELECT TO authenticated USING ((auth_user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: vocabulary_onboarding; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vocabulary_onboarding ENABLE ROW LEVEL SECURITY;

--
-- Name: vocabulary_onboarding vocabulary_onboarding_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vocabulary_onboarding_read ON public.vocabulary_onboarding FOR SELECT TO authenticated USING ((auth_user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: vocabulary_direction_progress vocabulary_progress_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vocabulary_progress_read ON public.vocabulary_direction_progress FOR SELECT TO authenticated USING (((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text])) OR ((auth_user_id = ( SELECT auth.uid() AS uid)) AND (card_id IN ( SELECT c.id
   FROM public.learning_vocabulary_cards c
  WHERE (c.unit_id = ANY (( SELECT learning_private.allowed_unit_ids() AS allowed_unit_ids)::uuid[])))))));


--
-- Name: vocabulary_learning_state vocabulary_state_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vocabulary_state_read ON public.vocabulary_learning_state FOR SELECT TO authenticated USING ((auth_user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: vocabulary_translations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vocabulary_translations ENABLE ROW LEVEL SECURITY;

--
-- Name: function_backups; Type: ROW SECURITY; Schema: teacher_dashboard_private; Owner: -
--

ALTER TABLE teacher_dashboard_private.function_backups ENABLE ROW LEVEL SECURITY;

--
-- Name: progress_archive; Type: ROW SECURITY; Schema: teacher_dashboard_private; Owner: -
--

ALTER TABLE teacher_dashboard_private.progress_archive ENABLE ROW LEVEL SECURITY;

--
-- Name: answer_receipts; Type: ROW SECURITY; Schema: vocabulary_private; Owner: -
--

ALTER TABLE vocabulary_private.answer_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: carryover_function_backups; Type: ROW SECURITY; Schema: vocabulary_private; Owner: -
--

ALTER TABLE vocabulary_private.carryover_function_backups ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA business_private; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA business_private TO authenticated;
GRANT USAGE ON SCHEMA business_private TO service_role;


--
-- Name: SCHEMA grammar_private; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA grammar_private TO authenticated;
GRANT USAGE ON SCHEMA grammar_private TO service_role;


--
-- Name: SCHEMA identity_private; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA identity_private TO authenticated;
GRANT USAGE ON SCHEMA identity_private TO service_role;


--
-- Name: SCHEMA learning_private; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA learning_private TO authenticated;
GRANT USAGE ON SCHEMA learning_private TO service_role;


--
-- Name: SCHEMA learning_reset_private; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA learning_reset_private TO authenticated;


--
-- Name: SCHEMA media_private; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA media_private TO authenticated;
GRANT USAGE ON SCHEMA media_private TO service_role;


--
-- Name: SCHEMA path_private; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA path_private TO service_role;
GRANT USAGE ON SCHEMA path_private TO postgres;
GRANT USAGE ON SCHEMA path_private TO authenticated;


--
-- Name: SCHEMA platform_private; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA platform_private TO service_role;


--
-- Name: SCHEMA private; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA private TO service_role;


--
-- Name: SCHEMA pronunciation_private; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA pronunciation_private TO authenticated;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: SCHEMA vocabulary_private; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA vocabulary_private TO authenticated;
GRANT USAGE ON SCHEMA vocabulary_private TO service_role;


--
-- Name: FUNCTION booking_exception_rows(p_booking uuid); Type: ACL; Schema: business_private; Owner: -
--

REVOKE ALL ON FUNCTION business_private.booking_exception_rows(p_booking uuid) FROM PUBLIC;


--
-- Name: FUNCTION booking_mail_exceptions(p_booking uuid); Type: ACL; Schema: business_private; Owner: -
--

REVOKE ALL ON FUNCTION business_private.booking_mail_exceptions(p_booking uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION business_private.booking_mail_exceptions(p_booking uuid) TO service_role;


--
-- Name: FUNCTION claim_person(); Type: ACL; Schema: business_private; Owner: -
--

REVOKE ALL ON FUNCTION business_private.claim_person() FROM PUBLIC;
GRANT ALL ON FUNCTION business_private.claim_person() TO authenticated;
GRANT ALL ON FUNCTION business_private.claim_person() TO service_role;


--
-- Name: FUNCTION confirm_booking(p_id uuid); Type: ACL; Schema: business_private; Owner: -
--

REVOKE ALL ON FUNCTION business_private.confirm_booking(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION business_private.confirm_booking(p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION business_private.confirm_booking(p_id uuid) TO service_role;


--
-- Name: FUNCTION course_quote(p_course uuid, p_start date, p_requested_units integer, p_trial boolean); Type: ACL; Schema: business_private; Owner: -
--

REVOKE ALL ON FUNCTION business_private.course_quote(p_course uuid, p_start date, p_requested_units integer, p_trial boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION business_private.course_quote(p_course uuid, p_start date, p_requested_units integer, p_trial boolean) TO service_role;


--
-- Name: FUNCTION decline_booking(p_id uuid); Type: ACL; Schema: business_private; Owner: -
--

REVOKE ALL ON FUNCTION business_private.decline_booking(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION business_private.decline_booking(p_id uuid) TO authenticated;


--
-- Name: FUNCTION delete_course_exception(p_id uuid); Type: ACL; Schema: business_private; Owner: -
--

REVOKE ALL ON FUNCTION business_private.delete_course_exception(p_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION is_staff(); Type: ACL; Schema: business_private; Owner: -
--

REVOKE ALL ON FUNCTION business_private.is_staff() FROM PUBLIC;
GRANT ALL ON FUNCTION business_private.is_staff() TO authenticated;
GRANT ALL ON FUNCTION business_private.is_staff() TO service_role;


--
-- Name: FUNCTION list_registration_identity_conflicts(); Type: ACL; Schema: business_private; Owner: -
--

REVOKE ALL ON FUNCTION business_private.list_registration_identity_conflicts() FROM PUBLIC;
GRANT ALL ON FUNCTION business_private.list_registration_identity_conflicts() TO authenticated;


--
-- Name: FUNCTION mark_invoice(p_booking uuid, p_month date, p_created boolean, p_reference text); Type: ACL; Schema: business_private; Owner: -
--

REVOKE ALL ON FUNCTION business_private.mark_invoice(p_booking uuid, p_month date, p_created boolean, p_reference text) FROM PUBLIC;
GRANT ALL ON FUNCTION business_private.mark_invoice(p_booking uuid, p_month date, p_created boolean, p_reference text) TO authenticated;
GRANT ALL ON FUNCTION business_private.mark_invoice(p_booking uuid, p_month date, p_created boolean, p_reference text) TO service_role;


--
-- Name: FUNCTION notify_course_exception(); Type: ACL; Schema: business_private; Owner: -
--

REVOKE ALL ON FUNCTION business_private.notify_course_exception() FROM PUBLIC;


--
-- Name: FUNCTION notify_staff_of_signup(); Type: ACL; Schema: business_private; Owner: -
--

REVOKE ALL ON FUNCTION business_private.notify_staff_of_signup() FROM PUBLIC;


--
-- Name: FUNCTION notify_student_of_level_access(); Type: ACL; Schema: business_private; Owner: -
--

REVOKE ALL ON FUNCTION business_private.notify_student_of_level_access() FROM PUBLIC;


--
-- Name: FUNCTION prepare_month(p_month date); Type: ACL; Schema: business_private; Owner: -
--

REVOKE ALL ON FUNCTION business_private.prepare_month(p_month date) FROM PUBLIC;
GRANT ALL ON FUNCTION business_private.prepare_month(p_month date) TO authenticated;
GRANT ALL ON FUNCTION business_private.prepare_month(p_month date) TO service_role;


--
-- Name: FUNCTION provision_profile(); Type: ACL; Schema: business_private; Owner: -
--

REVOKE ALL ON FUNCTION business_private.provision_profile() FROM PUBLIC;
GRANT ALL ON FUNCTION business_private.provision_profile() TO service_role;


--
-- Name: FUNCTION replace_items(p_booking uuid, p_course_selections jsonb); Type: ACL; Schema: business_private; Owner: -
--

REVOKE ALL ON FUNCTION business_private.replace_items(p_booking uuid, p_course_selections jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION business_private.replace_items(p_booking uuid, p_course_selections jsonb) TO service_role;


--
-- Name: FUNCTION resolve_registration_identity(p_person_id uuid, p_auth_user_id uuid); Type: ACL; Schema: business_private; Owner: -
--

REVOKE ALL ON FUNCTION business_private.resolve_registration_identity(p_person_id uuid, p_auth_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION business_private.resolve_registration_identity(p_person_id uuid, p_auth_user_id uuid) TO authenticated;


--
-- Name: FUNCTION save_course(p_data jsonb); Type: ACL; Schema: business_private; Owner: -
--

REVOKE ALL ON FUNCTION business_private.save_course(p_data jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION business_private.save_course(p_data jsonb) TO authenticated;
GRANT ALL ON FUNCTION business_private.save_course(p_data jsonb) TO service_role;


--
-- Name: FUNCTION save_course_exception(p_course_id uuid, p_date date, p_reason text); Type: ACL; Schema: business_private; Owner: -
--

REVOKE ALL ON FUNCTION business_private.save_course_exception(p_course_id uuid, p_date date, p_reason text) FROM PUBLIC;


--
-- Name: FUNCTION save_month(p_month date, p_course_selections jsonb, p_paused boolean, p_expected uuid, p_revision integer); Type: ACL; Schema: business_private; Owner: -
--

REVOKE ALL ON FUNCTION business_private.save_month(p_month date, p_course_selections jsonb, p_paused boolean, p_expected uuid, p_revision integer) FROM PUBLIC;
GRANT ALL ON FUNCTION business_private.save_month(p_month date, p_course_selections jsonb, p_paused boolean, p_expected uuid, p_revision integer) TO authenticated;


--
-- Name: FUNCTION staff_signup_payload(p_email text, p_meta jsonb); Type: ACL; Schema: business_private; Owner: -
--

REVOKE ALL ON FUNCTION business_private.staff_signup_payload(p_email text, p_meta jsonb) FROM PUBLIC;


--
-- Name: FUNCTION submit_cancellation(p_name text, p_email text, p_course_id uuid, p_type text, p_date date, p_locale text); Type: ACL; Schema: business_private; Owner: -
--

REVOKE ALL ON FUNCTION business_private.submit_cancellation(p_name text, p_email text, p_course_id uuid, p_type text, p_date date, p_locale text) FROM PUBLIC;
GRANT ALL ON FUNCTION business_private.submit_cancellation(p_name text, p_email text, p_course_id uuid, p_type text, p_date date, p_locale text) TO service_role;


--
-- Name: FUNCTION sync_verified_email(); Type: ACL; Schema: business_private; Owner: -
--

REVOKE ALL ON FUNCTION business_private.sync_verified_email() FROM PUBLIC;
GRANT ALL ON FUNCTION business_private.sync_verified_email() TO service_role;


--
-- Name: FUNCTION validate_course_selections(p_selections jsonb, p_start date); Type: ACL; Schema: business_private; Owner: -
--

REVOKE ALL ON FUNCTION business_private.validate_course_selections(p_selections jsonb, p_start date) FROM PUBLIC;
GRANT ALL ON FUNCTION business_private.validate_course_selections(p_selections jsonb, p_start date) TO service_role;


--
-- Name: FUNCTION exercise_is_ready(p_content jsonb, p_topic text); Type: ACL; Schema: grammar_private; Owner: -
--

REVOKE ALL ON FUNCTION grammar_private.exercise_is_ready(p_content jsonb, p_topic text) FROM PUBLIC;
GRANT ALL ON FUNCTION grammar_private.exercise_is_ready(p_content jsonb, p_topic text) TO authenticated;
GRANT ALL ON FUNCTION grammar_private.exercise_is_ready(p_content jsonb, p_topic text) TO service_role;


--
-- Name: FUNCTION german_content_allowed(p_content jsonb, p_topic text); Type: ACL; Schema: grammar_private; Owner: -
--

REVOKE ALL ON FUNCTION grammar_private.german_content_allowed(p_content jsonb, p_topic text) FROM PUBLIC;
GRANT ALL ON FUNCTION grammar_private.german_content_allowed(p_content jsonb, p_topic text) TO authenticated;
GRANT ALL ON FUNCTION grammar_private.german_content_allowed(p_content jsonb, p_topic text) TO service_role;


--
-- Name: FUNCTION guard_exercise_quality(); Type: ACL; Schema: grammar_private; Owner: -
--

REVOKE ALL ON FUNCTION grammar_private.guard_exercise_quality() FROM PUBLIC;


--
-- Name: FUNCTION record_attempt(p_exercise_id uuid, p_answer text, p_hint_shown boolean); Type: ACL; Schema: grammar_private; Owner: -
--

REVOKE ALL ON FUNCTION grammar_private.record_attempt(p_exercise_id uuid, p_answer text, p_hint_shown boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION grammar_private.record_attempt(p_exercise_id uuid, p_answer text, p_hint_shown boolean) TO authenticated;


--
-- Name: FUNCTION valid_accepted_answers(p_content jsonb, p_type public.exercise_type); Type: ACL; Schema: grammar_private; Owner: -
--

REVOKE ALL ON FUNCTION grammar_private.valid_accepted_answers(p_content jsonb, p_type public.exercise_type) FROM PUBLIC;
GRANT ALL ON FUNCTION grammar_private.valid_accepted_answers(p_content jsonb, p_type public.exercise_type) TO authenticated;
GRANT ALL ON FUNCTION grammar_private.valid_accepted_answers(p_content jsonb, p_type public.exercise_type) TO service_role;


--
-- Name: FUNCTION valid_target_form(p_content jsonb); Type: ACL; Schema: grammar_private; Owner: -
--

REVOKE ALL ON FUNCTION grammar_private.valid_target_form(p_content jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION grammar_private.valid_target_form(p_content jsonb) TO authenticated;
GRANT ALL ON FUNCTION grammar_private.valid_target_form(p_content jsonb) TO service_role;


--
-- Name: FUNCTION current_profile_role(); Type: ACL; Schema: identity_private; Owner: -
--

REVOKE ALL ON FUNCTION identity_private.current_profile_role() FROM PUBLIC;
GRANT ALL ON FUNCTION identity_private.current_profile_role() TO authenticated;
GRANT ALL ON FUNCTION identity_private.current_profile_role() TO service_role;


--
-- Name: FUNCTION validate_teacher_note(); Type: ACL; Schema: identity_private; Owner: -
--

REVOKE ALL ON FUNCTION identity_private.validate_teacher_note() FROM PUBLIC;


--
-- Name: FUNCTION allowed_unit_ids(); Type: ACL; Schema: learning_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_private.allowed_unit_ids() FROM PUBLIC;
GRANT ALL ON FUNCTION learning_private.allowed_unit_ids() TO authenticated;
GRANT ALL ON FUNCTION learning_private.allowed_unit_ids() TO service_role;


--
-- Name: FUNCTION answer_without_punctuation(p_value text); Type: ACL; Schema: learning_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_private.answer_without_punctuation(p_value text) FROM PUBLIC;
GRANT ALL ON FUNCTION learning_private.answer_without_punctuation(p_value text) TO postgres;


--
-- Name: FUNCTION audio_readable(p_name text); Type: ACL; Schema: learning_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_private.audio_readable(p_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION learning_private.audio_readable(p_name text) TO authenticated;


--
-- Name: FUNCTION capture_learning_session(); Type: ACL; Schema: learning_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_private.capture_learning_session() FROM PUBLIC;


--
-- Name: FUNCTION ensure_unit(p_id uuid, p_level text, p_trainer text, p_label text, p_active boolean, p_sort integer); Type: ACL; Schema: learning_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_private.ensure_unit(p_id uuid, p_level text, p_trainer text, p_label text, p_active boolean, p_sort integer) FROM PUBLIC;
GRANT ALL ON FUNCTION learning_private.ensure_unit(p_id uuid, p_level text, p_trainer text, p_label text, p_active boolean, p_sort integer) TO authenticated;
GRANT ALL ON FUNCTION learning_private.ensure_unit(p_id uuid, p_level text, p_trainer text, p_label text, p_active boolean, p_sort integer) TO service_role;


--
-- Name: FUNCTION expand_german_letters(p_value text); Type: ACL; Schema: learning_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_private.expand_german_letters(p_value text) FROM PUBLIC;


--
-- Name: FUNCTION german_text_allowed(p_text text); Type: ACL; Schema: learning_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_private.german_text_allowed(p_text text) FROM PUBLIC;
GRANT ALL ON FUNCTION learning_private.german_text_allowed(p_text text) TO authenticated;
GRANT ALL ON FUNCTION learning_private.german_text_allowed(p_text text) TO service_role;


--
-- Name: FUNCTION grade_answer(p_input text, p_accepted text[]); Type: ACL; Schema: learning_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_private.grade_answer(p_input text, p_accepted text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION learning_private.grade_answer(p_input text, p_accepted text[]) TO postgres;


--
-- Name: FUNCTION guard_reading_quality(); Type: ACL; Schema: learning_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_private.guard_reading_quality() FROM PUBLIC;


--
-- Name: FUNCTION levenshtein_at_most_one(p_left text, p_right text); Type: ACL; Schema: learning_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_private.levenshtein_at_most_one(p_left text, p_right text) FROM PUBLIC;


--
-- Name: FUNCTION lock_activity_day(); Type: ACL; Schema: learning_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_private.lock_activity_day() FROM PUBLIC;


--
-- Name: FUNCTION normalize_answer(p_value text); Type: ACL; Schema: learning_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_private.normalize_answer(p_value text) FROM PUBLIC;
GRANT ALL ON FUNCTION learning_private.normalize_answer(p_value text) TO postgres;


--
-- Name: FUNCTION prune_learning_sessions(); Type: ACL; Schema: learning_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_private.prune_learning_sessions() FROM PUBLIC;
GRANT ALL ON FUNCTION learning_private.prune_learning_sessions() TO service_role;


--
-- Name: FUNCTION record_activity_day(); Type: ACL; Schema: learning_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_private.record_activity_day() FROM PUBLIC;


--
-- Name: FUNCTION record_learning_event(p_user uuid, p_mode public.learning_session_mode, p_level text, p_at timestamp with time zone); Type: ACL; Schema: learning_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_private.record_learning_event(p_user uuid, p_mode public.learning_session_mode, p_level text, p_at timestamp with time zone) FROM PUBLIC;


--
-- Name: FUNCTION reset_student_level(p_student_id uuid, p_level text); Type: ACL; Schema: learning_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_private.reset_student_level(p_student_id uuid, p_level text) FROM PUBLIC;
GRANT ALL ON FUNCTION learning_private.reset_student_level(p_student_id uuid, p_level text) TO authenticated;


--
-- Name: FUNCTION unit_allowed(p_unit_id uuid); Type: ACL; Schema: learning_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_private.unit_allowed(p_unit_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION learning_private.unit_allowed(p_unit_id uuid) TO authenticated;
GRANT ALL ON FUNCTION learning_private.unit_allowed(p_unit_id uuid) TO service_role;


--
-- Name: FUNCTION validate_content_unit(); Type: ACL; Schema: learning_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_private.validate_content_unit() FROM PUBLIC;


--
-- Name: FUNCTION validate_onboarding_unit(); Type: ACL; Schema: learning_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_private.validate_onboarding_unit() FROM PUBLIC;


--
-- Name: FUNCTION validate_video_publication(); Type: ACL; Schema: learning_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_private.validate_video_publication() FROM PUBLIC;


--
-- Name: FUNCTION assert_writable(p_user uuid); Type: ACL; Schema: learning_reset_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_reset_private.assert_writable(p_user uuid) FROM PUBLIC;


--
-- Name: FUNCTION audio_batch(p_token uuid); Type: ACL; Schema: learning_reset_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_reset_private.audio_batch(p_token uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION learning_reset_private.audio_batch(p_token uuid) TO authenticated;


--
-- Name: FUNCTION begin_reset(p_confirmation text); Type: ACL; Schema: learning_reset_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_reset_private.begin_reset(p_confirmation text) FROM PUBLIC;
GRANT ALL ON FUNCTION learning_reset_private.begin_reset(p_confirmation text) TO authenticated;


--
-- Name: FUNCTION can_remove_audio(p_id uuid); Type: ACL; Schema: learning_reset_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_reset_private.can_remove_audio(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION learning_reset_private.can_remove_audio(p_id uuid) TO authenticated;


--
-- Name: FUNCTION finish_reset(p_token uuid); Type: ACL; Schema: learning_reset_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_reset_private.finish_reset(p_token uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION learning_reset_private.finish_reset(p_token uuid) TO authenticated;


--
-- Name: FUNCTION guard_write(); Type: ACL; Schema: learning_reset_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_reset_private.guard_write() FROM PUBLIC;


--
-- Name: FUNCTION matches_audio(p_reference text, p_bucket text, p_name text); Type: ACL; Schema: learning_reset_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_reset_private.matches_audio(p_reference text, p_bucket text, p_name text) FROM PUBLIC;


--
-- Name: FUNCTION storage_writable(p_bucket text, p_id uuid); Type: ACL; Schema: learning_reset_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_reset_private.storage_writable(p_bucket text, p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION learning_reset_private.storage_writable(p_bucket text, p_id uuid) TO authenticated;


--
-- Name: FUNCTION enforce_storage_quota(); Type: ACL; Schema: media_private; Owner: -
--

REVOKE ALL ON FUNCTION media_private.enforce_storage_quota() FROM PUBLIC;


--
-- Name: FUNCTION folder_allowed(p_folder_id uuid); Type: ACL; Schema: media_private; Owner: -
--

REVOKE ALL ON FUNCTION media_private.folder_allowed(p_folder_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION media_private.folder_allowed(p_folder_id uuid) TO authenticated;
GRANT ALL ON FUNCTION media_private.folder_allowed(p_folder_id uuid) TO service_role;


--
-- Name: FUNCTION guard_folder_change(); Type: ACL; Schema: media_private; Owner: -
--

REVOKE ALL ON FUNCTION media_private.guard_folder_change() FROM PUBLIC;


--
-- Name: FUNCTION path_allowed(p_name text, p_write boolean); Type: ACL; Schema: media_private; Owner: -
--

REVOKE ALL ON FUNCTION media_private.path_allowed(p_name text, p_write boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION media_private.path_allowed(p_name text, p_write boolean) TO authenticated;
GRANT ALL ON FUNCTION media_private.path_allowed(p_name text, p_write boolean) TO service_role;


--
-- Name: FUNCTION published_video_unit_ids(); Type: ACL; Schema: media_private; Owner: -
--

REVOKE ALL ON FUNCTION media_private.published_video_unit_ids() FROM PUBLIC;
GRANT ALL ON FUNCTION media_private.published_video_unit_ids() TO postgres;
GRANT ALL ON FUNCTION media_private.published_video_unit_ids() TO authenticated;
GRANT ALL ON FUNCTION media_private.published_video_unit_ids() TO service_role;


--
-- Name: FUNCTION validate_asset(); Type: ACL; Schema: media_private; Owner: -
--

REVOKE ALL ON FUNCTION media_private.validate_asset() FROM PUBLIC;


--
-- Name: FUNCTION audio_allowed(p_name text); Type: ACL; Schema: path_private; Owner: -
--

REVOKE ALL ON FUNCTION path_private.audio_allowed(p_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION path_private.audio_allowed(p_name text) TO authenticated;
GRANT ALL ON FUNCTION path_private.audio_allowed(p_name text) TO service_role;


--
-- Name: FUNCTION check_actor(p_locale text); Type: ACL; Schema: path_private; Owner: -
--

REVOKE ALL ON FUNCTION path_private.check_actor(p_locale text) FROM PUBLIC;
GRANT ALL ON FUNCTION path_private.check_actor(p_locale text) TO service_role;


--
-- Name: FUNCTION error(p_message text, p_state text); Type: ACL; Schema: path_private; Owner: -
--

REVOKE ALL ON FUNCTION path_private.error(p_message text, p_state text) FROM PUBLIC;
GRANT ALL ON FUNCTION path_private.error(p_message text, p_state text) TO service_role;


--
-- Name: FUNCTION german_task_allowed(p_value jsonb); Type: ACL; Schema: path_private; Owner: -
--

REVOKE ALL ON FUNCTION path_private.german_task_allowed(p_value jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION path_private.german_task_allowed(p_value jsonb) TO service_role;
GRANT ALL ON FUNCTION path_private.german_task_allowed(p_value jsonb) TO postgres;
GRANT ALL ON FUNCTION path_private.german_task_allowed(p_value jsonb) TO authenticated;


--
-- Name: FUNCTION grade(p_type public.exercise_type, p_content jsonb, p_answer jsonb); Type: ACL; Schema: path_private; Owner: -
--

REVOKE ALL ON FUNCTION path_private.grade(p_type public.exercise_type, p_content jsonb, p_answer jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION path_private.grade(p_type public.exercise_type, p_content jsonb, p_answer jsonb) TO postgres;
GRANT ALL ON FUNCTION path_private.grade(p_type public.exercise_type, p_content jsonb, p_answer jsonb) TO service_role;


--
-- Name: FUNCTION guard_catalog(); Type: ACL; Schema: path_private; Owner: -
--

REVOKE ALL ON FUNCTION path_private.guard_catalog() FROM PUBLIC;
GRANT ALL ON FUNCTION path_private.guard_catalog() TO service_role;
GRANT ALL ON FUNCTION path_private.guard_catalog() TO authenticated;


--
-- Name: FUNCTION import_path_catalog(p_path jsonb, p_actor uuid); Type: ACL; Schema: path_private; Owner: -
--

REVOKE ALL ON FUNCTION path_private.import_path_catalog(p_path jsonb, p_actor uuid) FROM PUBLIC;


--
-- Name: FUNCTION migrate_legacy_grammar(); Type: ACL; Schema: path_private; Owner: -
--

REVOKE ALL ON FUNCTION path_private.migrate_legacy_grammar() FROM PUBLIC;


--
-- Name: FUNCTION node_available(p_node uuid); Type: ACL; Schema: path_private; Owner: -
--

REVOKE ALL ON FUNCTION path_private.node_available(p_node uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION path_private.node_available(p_node uuid) TO service_role;
GRANT ALL ON FUNCTION path_private.node_available(p_node uuid) TO authenticated;


--
-- Name: FUNCTION only_keys(p_value jsonb, p_keys text[]); Type: ACL; Schema: path_private; Owner: -
--

REVOKE ALL ON FUNCTION path_private.only_keys(p_value jsonb, p_keys text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION path_private.only_keys(p_value jsonb, p_keys text[]) TO service_role;
GRANT ALL ON FUNCTION path_private.only_keys(p_value jsonb, p_keys text[]) TO postgres;
GRANT ALL ON FUNCTION path_private.only_keys(p_value jsonb, p_keys text[]) TO authenticated;


--
-- Name: FUNCTION present(p_snapshot jsonb, p_locale text); Type: ACL; Schema: path_private; Owner: -
--

REVOKE ALL ON FUNCTION path_private.present(p_snapshot jsonb, p_locale text) FROM PUBLIC;
GRANT ALL ON FUNCTION path_private.present(p_snapshot jsonb, p_locale text) TO service_role;


--
-- Name: FUNCTION present_content(p_type public.exercise_type, p_content jsonb); Type: ACL; Schema: path_private; Owner: -
--

REVOKE ALL ON FUNCTION path_private.present_content(p_type public.exercise_type, p_content jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION path_private.present_content(p_type public.exercise_type, p_content jsonb) TO postgres;
GRANT ALL ON FUNCTION path_private.present_content(p_type public.exercise_type, p_content jsonb) TO service_role;


--
-- Name: FUNCTION reset_progress(p_student uuid, p_unit uuid, p_node uuid); Type: ACL; Schema: path_private; Owner: -
--

REVOKE ALL ON FUNCTION path_private.reset_progress(p_student uuid, p_unit uuid, p_node uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION path_private.reset_progress(p_student uuid, p_unit uuid, p_node uuid) TO service_role;


--
-- Name: FUNCTION snapshot(p_exercise uuid); Type: ACL; Schema: path_private; Owner: -
--

REVOKE ALL ON FUNCTION path_private.snapshot(p_exercise uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION path_private.snapshot(p_exercise uuid) TO service_role;


--
-- Name: FUNCTION solution(p_snapshot jsonb, p_locale text); Type: ACL; Schema: path_private; Owner: -
--

REVOKE ALL ON FUNCTION path_private.solution(p_snapshot jsonb, p_locale text) FROM PUBLIC;
GRANT ALL ON FUNCTION path_private.solution(p_snapshot jsonb, p_locale text) TO service_role;


--
-- Name: FUNCTION text_key(p_value text); Type: ACL; Schema: path_private; Owner: -
--

REVOKE ALL ON FUNCTION path_private.text_key(p_value text) FROM PUBLIC;
GRANT ALL ON FUNCTION path_private.text_key(p_value text) TO service_role;
GRANT ALL ON FUNCTION path_private.text_key(p_value text) TO postgres;
GRANT ALL ON FUNCTION path_private.text_key(p_value text) TO authenticated;


--
-- Name: FUNCTION unit_available(p_unit uuid); Type: ACL; Schema: path_private; Owner: -
--

REVOKE ALL ON FUNCTION path_private.unit_available(p_unit uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION path_private.unit_available(p_unit uuid) TO service_role;
GRANT ALL ON FUNCTION path_private.unit_available(p_unit uuid) TO authenticated;


--
-- Name: FUNCTION valid_content(p_type public.exercise_type, p_content jsonb); Type: ACL; Schema: path_private; Owner: -
--

REVOKE ALL ON FUNCTION path_private.valid_content(p_type public.exercise_type, p_content jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION path_private.valid_content(p_type public.exercise_type, p_content jsonb) TO service_role;
GRANT ALL ON FUNCTION path_private.valid_content(p_type public.exercise_type, p_content jsonb) TO postgres;
GRANT ALL ON FUNCTION path_private.valid_content(p_type public.exercise_type, p_content jsonb) TO authenticated;


--
-- Name: FUNCTION valid_local_audio(p_value jsonb); Type: ACL; Schema: path_private; Owner: -
--

REVOKE ALL ON FUNCTION path_private.valid_local_audio(p_value jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION path_private.valid_local_audio(p_value jsonb) TO service_role;
GRANT ALL ON FUNCTION path_private.valid_local_audio(p_value jsonb) TO postgres;
GRANT ALL ON FUNCTION path_private.valid_local_audio(p_value jsonb) TO authenticated;


--
-- Name: FUNCTION valid_seed_shape(p_path jsonb); Type: ACL; Schema: path_private; Owner: -
--

REVOKE ALL ON FUNCTION path_private.valid_seed_shape(p_path jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION path_private.valid_seed_shape(p_path jsonb) TO service_role;
GRANT ALL ON FUNCTION path_private.valid_seed_shape(p_path jsonb) TO authenticated;


--
-- Name: FUNCTION valid_strings(p_value jsonb, p_min integer, p_unique boolean); Type: ACL; Schema: path_private; Owner: -
--

REVOKE ALL ON FUNCTION path_private.valid_strings(p_value jsonb, p_min integer, p_unique boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION path_private.valid_strings(p_value jsonb, p_min integer, p_unique boolean) TO service_role;
GRANT ALL ON FUNCTION path_private.valid_strings(p_value jsonb, p_min integer, p_unique boolean) TO postgres;
GRANT ALL ON FUNCTION path_private.valid_strings(p_value jsonb, p_min integer, p_unique boolean) TO authenticated;


--
-- Name: FUNCTION valid_text(p_value jsonb, p_max integer, p_empty boolean); Type: ACL; Schema: path_private; Owner: -
--

REVOKE ALL ON FUNCTION path_private.valid_text(p_value jsonb, p_max integer, p_empty boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION path_private.valid_text(p_value jsonb, p_max integer, p_empty boolean) TO service_role;
GRANT ALL ON FUNCTION path_private.valid_text(p_value jsonb, p_max integer, p_empty boolean) TO postgres;
GRANT ALL ON FUNCTION path_private.valid_text(p_value jsonb, p_max integer, p_empty boolean) TO authenticated;


--
-- Name: FUNCTION without_null_fields(p_value jsonb); Type: ACL; Schema: path_private; Owner: -
--

REVOKE ALL ON FUNCTION path_private.without_null_fields(p_value jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION path_private.without_null_fields(p_value jsonb) TO service_role;


--
-- Name: FUNCTION require_rpc_success(p_result jsonb); Type: ACL; Schema: platform_private; Owner: -
--

REVOKE ALL ON FUNCTION platform_private.require_rpc_success(p_result jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION platform_private.require_rpc_success(p_result jsonb) TO service_role;


--
-- Name: FUNCTION touch_updated_at(); Type: ACL; Schema: platform_private; Owner: -
--

REVOKE ALL ON FUNCTION platform_private.touch_updated_at() FROM PUBLIC;


--
-- Name: FUNCTION can_access_submission(p_id uuid); Type: ACL; Schema: pronunciation_private; Owner: -
--

REVOKE ALL ON FUNCTION pronunciation_private.can_access_submission(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION pronunciation_private.can_access_submission(p_id uuid) TO authenticated;


--
-- Name: FUNCTION create_submission(p_prompt_id uuid, p_audio_path text); Type: ACL; Schema: pronunciation_private; Owner: -
--

REVOKE ALL ON FUNCTION pronunciation_private.create_submission(p_prompt_id uuid, p_audio_path text) FROM PUBLIC;
GRANT ALL ON FUNCTION pronunciation_private.create_submission(p_prompt_id uuid, p_audio_path text) TO authenticated;


--
-- Name: FUNCTION mark_seen(p_submission_id uuid); Type: ACL; Schema: pronunciation_private; Owner: -
--

REVOKE ALL ON FUNCTION pronunciation_private.mark_seen(p_submission_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION pronunciation_private.mark_seen(p_submission_id uuid) TO authenticated;


--
-- Name: FUNCTION update_conversation_status(); Type: ACL; Schema: pronunciation_private; Owner: -
--

REVOKE ALL ON FUNCTION pronunciation_private.update_conversation_status() FROM PUBLIC;


--
-- Name: FUNCTION validate_message(); Type: ACL; Schema: pronunciation_private; Owner: -
--

REVOKE ALL ON FUNCTION pronunciation_private.validate_message() FROM PUBLIC;


--
-- Name: FUNCTION add_own_vocabulary(p_level text, p_word_de text, p_article text, p_translation text, p_locale text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.add_own_vocabulary(p_level text, p_word_de text, p_article text, p_translation text, p_locale text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.add_own_vocabulary(p_level text, p_word_de text, p_article text, p_translation text, p_locale text) TO authenticated;
GRANT ALL ON FUNCTION public.add_own_vocabulary(p_level text, p_word_de text, p_article text, p_translation text, p_locale text) TO service_role;


--
-- Name: FUNCTION begin_learning_reset(p_confirmation text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.begin_learning_reset(p_confirmation text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.begin_learning_reset(p_confirmation text) TO authenticated;
GRANT ALL ON FUNCTION public.begin_learning_reset(p_confirmation text) TO service_role;


--
-- Name: FUNCTION begin_vocabulary_level(p_target_level text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.begin_vocabulary_level(p_target_level text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.begin_vocabulary_level(p_target_level text) TO authenticated;
GRANT ALL ON FUNCTION public.begin_vocabulary_level(p_target_level text) TO service_role;


--
-- Name: FUNCTION check_vocabulary_retry(p_progress_id uuid, p_typed_answer text, p_ui_language text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.check_vocabulary_retry(p_progress_id uuid, p_typed_answer text, p_ui_language text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_vocabulary_retry(p_progress_id uuid, p_typed_answer text, p_ui_language text) TO authenticated;
GRANT ALL ON FUNCTION public.check_vocabulary_retry(p_progress_id uuid, p_typed_answer text, p_ui_language text) TO service_role;


--
-- Name: FUNCTION check_vocabulary_retry(p_progress_id uuid, p_typed_answer text, p_ui_language text, p_target_level text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.check_vocabulary_retry(p_progress_id uuid, p_typed_answer text, p_ui_language text, p_target_level text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_vocabulary_retry(p_progress_id uuid, p_typed_answer text, p_ui_language text, p_target_level text) TO authenticated;
GRANT ALL ON FUNCTION public.check_vocabulary_retry(p_progress_id uuid, p_typed_answer text, p_ui_language text, p_target_level text) TO service_role;


--
-- Name: FUNCTION claim_mail_jobs(p_worker_id uuid, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.claim_mail_jobs(p_worker_id uuid, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_mail_jobs(p_worker_id uuid, p_limit integer) TO service_role;


--
-- Name: FUNCTION claim_verified_person(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.claim_verified_person() FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_verified_person() TO authenticated;


--
-- Name: FUNCTION complete_mail_job(p_id uuid, p_lease_token uuid, p_message_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.complete_mail_job(p_id uuid, p_lease_token uuid, p_message_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.complete_mail_job(p_id uuid, p_lease_token uuid, p_message_id text) TO service_role;


--
-- Name: FUNCTION complete_media_upload(p_payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.complete_media_upload(p_payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.complete_media_upload(p_payload jsonb) TO authenticated;


--
-- Name: FUNCTION confirm_business_booking(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.confirm_business_booking(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.confirm_business_booking(p_id uuid) TO authenticated;


--
-- Name: FUNCTION consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer) TO service_role;


--
-- Name: FUNCTION create_pronunciation_submission(p_prompt_id uuid, p_audio_path text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_pronunciation_submission(p_prompt_id uuid, p_audio_path text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_pronunciation_submission(p_prompt_id uuid, p_audio_path text) TO authenticated;
GRANT ALL ON FUNCTION public.create_pronunciation_submission(p_prompt_id uuid, p_audio_path text) TO service_role;


--
-- Name: FUNCTION decline_business_booking(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.decline_business_booking(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.decline_business_booking(p_id uuid) TO authenticated;


--
-- Name: FUNCTION delete_course_exception(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_course_exception(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_course_exception(p_id uuid) TO authenticated;


--
-- Name: FUNCTION delete_learning_content(p_trainer text, p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_learning_content(p_trainer text, p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_learning_content(p_trainer text, p_id uuid) TO authenticated;


--
-- Name: FUNCTION delete_own_vocabulary(p_card_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_own_vocabulary(p_card_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_own_vocabulary(p_card_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_own_vocabulary(p_card_id uuid) TO service_role;


--
-- Name: FUNCTION export_learning_path(p_unit_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.export_learning_path(p_unit_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.export_learning_path(p_unit_id uuid) TO authenticated;


--
-- Name: FUNCTION fail_mail_job(p_id uuid, p_lease_token uuid, p_error text, p_permanent boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.fail_mail_job(p_id uuid, p_lease_token uuid, p_error text, p_permanent boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.fail_mail_job(p_id uuid, p_lease_token uuid, p_error text, p_permanent boolean) TO service_role;


--
-- Name: FUNCTION finish_learning_reset(p_token uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.finish_learning_reset(p_token uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.finish_learning_reset(p_token uuid) TO authenticated;
GRANT ALL ON FUNCTION public.finish_learning_reset(p_token uuid) TO service_role;


--
-- Name: FUNCTION finish_path_test(p_attempt_id uuid, p_locale text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.finish_path_test(p_attempt_id uuid, p_locale text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.finish_path_test(p_attempt_id uuid, p_locale text) TO authenticated;


--
-- Name: FUNCTION get_all_students_progress_data(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_all_students_progress_data() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_all_students_progress_data() TO authenticated;


--
-- Name: FUNCTION get_all_students_progress_data(p_student_id uuid, p_course_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_all_students_progress_data(p_student_id uuid, p_course_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_all_students_progress_data(p_student_id uuid, p_course_id uuid) TO authenticated;


--
-- Name: FUNCTION get_last_active_level(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_last_active_level() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_last_active_level() TO authenticated;
GRANT ALL ON FUNCTION public.get_last_active_level() TO service_role;


--
-- Name: FUNCTION get_learning_path(p_level text, p_locale text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_learning_path(p_level text, p_locale text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_learning_path(p_level text, p_locale text) TO authenticated;


--
-- Name: FUNCTION get_teacher_dashboard_students(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_teacher_dashboard_students() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_teacher_dashboard_students() TO authenticated;


--
-- Name: FUNCTION get_teacher_student_detail(p_student_id uuid, p_tab text, p_locale text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_teacher_student_detail(p_student_id uuid, p_tab text, p_locale text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_teacher_student_detail(p_student_id uuid, p_tab text, p_locale text) TO authenticated;


--
-- Name: FUNCTION get_vocabulary_carryover(p_target_level text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_vocabulary_carryover(p_target_level text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_vocabulary_carryover(p_target_level text) TO authenticated;
GRANT ALL ON FUNCTION public.get_vocabulary_carryover(p_target_level text) TO service_role;


--
-- Name: FUNCTION get_vocabulary_carryover_cards(p_target_level text, p_offset integer, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_vocabulary_carryover_cards(p_target_level text, p_offset integer, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_vocabulary_carryover_cards(p_target_level text, p_offset integer, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_vocabulary_carryover_cards(p_target_level text, p_offset integer, p_limit integer) TO service_role;


--
-- Name: FUNCTION import_learning_path(p_path jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.import_learning_path(p_path jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.import_learning_path(p_path jsonb) TO authenticated;


--
-- Name: FUNCTION import_learning_path_seed(p_paths jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.import_learning_path_seed(p_paths jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.import_learning_path_seed(p_paths jsonb) TO service_role;


--
-- Name: FUNCTION initialize_vocabulary_cards(p_decisions jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.initialize_vocabulary_cards(p_decisions jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.initialize_vocabulary_cards(p_decisions jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.initialize_vocabulary_cards(p_decisions jsonb) TO service_role;


--
-- Name: FUNCTION learning_reset_audio_batch(p_token uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.learning_reset_audio_batch(p_token uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.learning_reset_audio_batch(p_token uuid) TO authenticated;
GRANT ALL ON FUNCTION public.learning_reset_audio_batch(p_token uuid) TO service_role;


--
-- Name: FUNCTION list_registration_identity_conflicts(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.list_registration_identity_conflicts() FROM PUBLIC;
GRANT ALL ON FUNCTION public.list_registration_identity_conflicts() TO authenticated;


--
-- Name: FUNCTION manage_learning_path(p_student_id uuid, p_unit_id uuid, p_action text, p_node_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.manage_learning_path(p_student_id uuid, p_unit_id uuid, p_action text, p_node_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.manage_learning_path(p_student_id uuid, p_unit_id uuid, p_action text, p_node_id uuid) TO authenticated;


--
-- Name: FUNCTION manage_learning_path(p_student_id uuid, p_unit_id uuid, p_action text, p_node_id uuid, p_request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.manage_learning_path(p_student_id uuid, p_unit_id uuid, p_action text, p_node_id uuid, p_request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.manage_learning_path(p_student_id uuid, p_unit_id uuid, p_action text, p_node_id uuid, p_request_id uuid) TO authenticated;


--
-- Name: FUNCTION mark_business_invoice(p_booking uuid, p_month date, p_created boolean, p_reference text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mark_business_invoice(p_booking uuid, p_month date, p_created boolean, p_reference text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mark_business_invoice(p_booking uuid, p_month date, p_created boolean, p_reference text) TO authenticated;


--
-- Name: FUNCTION mark_pronunciation_seen(p_submission_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mark_pronunciation_seen(p_submission_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mark_pronunciation_seen(p_submission_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.mark_pronunciation_seen(p_submission_id uuid) TO service_role;


--
-- Name: FUNCTION media_storage_usage(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.media_storage_usage() FROM PUBLIC;
GRANT ALL ON FUNCTION public.media_storage_usage() TO authenticated;


--
-- Name: FUNCTION prepare_business_month(p_month date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.prepare_business_month(p_month date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.prepare_business_month(p_month date) TO authenticated;


--
-- Name: FUNCTION pronunciation_reply_senders(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pronunciation_reply_senders() FROM PUBLIC;
GRANT ALL ON FUNCTION public.pronunciation_reply_senders() TO authenticated;
GRANT ALL ON FUNCTION public.pronunciation_reply_senders() TO service_role;


--
-- Name: FUNCTION queue_transactional_email(p_dedupe_key text, p_kind text, p_recipient text, p_locale text, p_payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.queue_transactional_email(p_dedupe_key text, p_kind text, p_recipient text, p_locale text, p_payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.queue_transactional_email(p_dedupe_key text, p_kind text, p_recipient text, p_locale text, p_payload jsonb) TO service_role;


--
-- Name: FUNCTION record_grammar_attempt(p_exercise_id uuid, p_answer text, p_hint_shown boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_grammar_attempt(p_exercise_id uuid, p_answer text, p_hint_shown boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_grammar_attempt(p_exercise_id uuid, p_answer text, p_hint_shown boolean) TO authenticated;
GRANT ALL ON FUNCTION public.record_grammar_attempt(p_exercise_id uuid, p_answer text, p_hint_shown boolean) TO service_role;


--
-- Name: FUNCTION reset_student_level_progress(p_student_id uuid, p_level text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.reset_student_level_progress(p_student_id uuid, p_level text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reset_student_level_progress(p_student_id uuid, p_level text) TO authenticated;


--
-- Name: FUNCTION reset_vocabulary_lesson_progress(p_unit_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.reset_vocabulary_lesson_progress(p_unit_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reset_vocabulary_lesson_progress(p_unit_id uuid) TO authenticated;


--
-- Name: FUNCTION resolve_registration_identity(p_person_id uuid, p_auth_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.resolve_registration_identity(p_person_id uuid, p_auth_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.resolve_registration_identity(p_person_id uuid, p_auth_user_id uuid) TO authenticated;


--
-- Name: FUNCTION save_business_course(p_data jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_business_course(p_data jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_business_course(p_data jsonb) TO authenticated;


--
-- Name: FUNCTION save_business_month(p_month date, p_course_selections jsonb, p_paused boolean, p_expected uuid, p_revision integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_business_month(p_month date, p_course_selections jsonb, p_paused boolean, p_expected uuid, p_revision integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_business_month(p_month date, p_course_selections jsonb, p_paused boolean, p_expected uuid, p_revision integer) TO authenticated;


--
-- Name: FUNCTION save_course_exception(p_course_id uuid, p_date date, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_course_exception(p_course_id uuid, p_date date, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_course_exception(p_course_id uuid, p_date date, p_reason text) TO authenticated;


--
-- Name: FUNCTION save_learning_content(p_trainer text, p_payload jsonb, p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_learning_content(p_trainer text, p_payload jsonb, p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_learning_content(p_trainer text, p_payload jsonb, p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.save_learning_content(p_trainer text, p_payload jsonb, p_id uuid) TO service_role;


--
-- Name: FUNCTION save_student_blackboard(p_student_id uuid, p_note_text text, p_expected_note_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_student_blackboard(p_student_id uuid, p_note_text text, p_expected_note_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_student_blackboard(p_student_id uuid, p_note_text text, p_expected_note_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.save_student_blackboard(p_student_id uuid, p_note_text text, p_expected_note_id uuid) TO service_role;


--
-- Name: FUNCTION set_student_level_access(p_user_id uuid, p_levels text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_student_level_access(p_user_id uuid, p_levels text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_student_level_access(p_user_id uuid, p_levels text[]) TO authenticated;


--
-- Name: FUNCTION set_student_trainer_access(p_user_id uuid, p_level text, p_trainer text, p_enabled boolean, p_unit_ids uuid[], p_replace_units boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_student_trainer_access(p_user_id uuid, p_level text, p_trainer text, p_enabled boolean, p_unit_ids uuid[], p_replace_units boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_student_trainer_access(p_user_id uuid, p_level text, p_trainer text, p_enabled boolean, p_unit_ids uuid[], p_replace_units boolean) TO authenticated;


--
-- Name: FUNCTION set_vocabulary_carryover(p_target_level text, p_enabled boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_vocabulary_carryover(p_target_level text, p_enabled boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_vocabulary_carryover(p_target_level text, p_enabled boolean) TO authenticated;
GRANT ALL ON FUNCTION public.set_vocabulary_carryover(p_target_level text, p_enabled boolean) TO service_role;


--
-- Name: FUNCTION set_vocabulary_lesson_paused(p_unit_id uuid, p_paused boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_vocabulary_lesson_paused(p_unit_id uuid, p_paused boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_vocabulary_lesson_paused(p_unit_id uuid, p_paused boolean) TO authenticated;
GRANT ALL ON FUNCTION public.set_vocabulary_lesson_paused(p_unit_id uuid, p_paused boolean) TO service_role;


--
-- Name: FUNCTION skip_vocabulary_assessment(p_level text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.skip_vocabulary_assessment(p_level text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.skip_vocabulary_assessment(p_level text) TO authenticated;
GRANT ALL ON FUNCTION public.skip_vocabulary_assessment(p_level text) TO service_role;


--
-- Name: FUNCTION start_path_node(p_node_id uuid, p_locale text, p_restart boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.start_path_node(p_node_id uuid, p_locale text, p_restart boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.start_path_node(p_node_id uuid, p_locale text, p_restart boolean) TO authenticated;


--
-- Name: FUNCTION start_path_test(p_node_id uuid, p_locale text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.start_path_test(p_node_id uuid, p_locale text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.start_path_test(p_node_id uuid, p_locale text) TO authenticated;


--
-- Name: FUNCTION submit_business_cancellation(p_name text, p_email text, p_course_id uuid, p_type text, p_date date, p_locale text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_business_cancellation(p_name text, p_email text, p_course_id uuid, p_type text, p_date date, p_locale text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_business_cancellation(p_name text, p_email text, p_course_id uuid, p_type text, p_date date, p_locale text) TO service_role;


--
-- Name: FUNCTION submit_business_registration(p_contact jsonb, p_course_selections jsonb, p_start date, p_consents jsonb, p_locale text, p_trial boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_business_registration(p_contact jsonb, p_course_selections jsonb, p_start date, p_consents jsonb, p_locale text, p_trial boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_business_registration(p_contact jsonb, p_course_selections jsonb, p_start date, p_consents jsonb, p_locale text, p_trial boolean) TO service_role;


--
-- Name: FUNCTION submit_path_answer(p_run_id uuid, p_exercise_id uuid, p_answer jsonb, p_request_id uuid, p_locale text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_path_answer(p_run_id uuid, p_exercise_id uuid, p_answer jsonb, p_request_id uuid, p_locale text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_path_answer(p_run_id uuid, p_exercise_id uuid, p_answer jsonb, p_request_id uuid, p_locale text) TO authenticated;


--
-- Name: FUNCTION submit_path_test_answer(p_attempt_id uuid, p_exercise_id uuid, p_answer jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_path_test_answer(p_attempt_id uuid, p_exercise_id uuid, p_answer jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_path_test_answer(p_attempt_id uuid, p_exercise_id uuid, p_answer jsonb) TO authenticated;


--
-- Name: FUNCTION submit_vocabulary_answer(p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_vocabulary_answer(p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_vocabulary_answer(p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text) TO authenticated;
GRANT ALL ON FUNCTION public.submit_vocabulary_answer(p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text) TO service_role;


--
-- Name: FUNCTION submit_vocabulary_answer(p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text, p_target_level text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_vocabulary_answer(p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text, p_target_level text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_vocabulary_answer(p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text, p_target_level text) TO authenticated;
GRANT ALL ON FUNCTION public.submit_vocabulary_answer(p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text, p_target_level text) TO service_role;


--
-- Name: FUNCTION submit_vocabulary_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_vocabulary_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_vocabulary_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text) TO service_role;
GRANT ALL ON FUNCTION public.submit_vocabulary_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text) TO authenticated;


--
-- Name: FUNCTION submit_vocabulary_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text, p_target_level text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_vocabulary_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text, p_target_level text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_vocabulary_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text, p_target_level text) TO authenticated;
GRANT ALL ON FUNCTION public.submit_vocabulary_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text, p_target_level text) TO service_role;


--
-- Name: FUNCTION submit_vocabulary_self_rating_once(p_request_id uuid, p_progress_id uuid, p_known boolean, p_ui_language text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_vocabulary_self_rating_once(p_request_id uuid, p_progress_id uuid, p_known boolean, p_ui_language text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_vocabulary_self_rating_once(p_request_id uuid, p_progress_id uuid, p_known boolean, p_ui_language text) TO authenticated;
GRANT ALL ON FUNCTION public.submit_vocabulary_self_rating_once(p_request_id uuid, p_progress_id uuid, p_known boolean, p_ui_language text) TO service_role;


--
-- Name: FUNCTION submit_vocabulary_self_rating_once(p_request_id uuid, p_progress_id uuid, p_known boolean, p_ui_language text, p_target_level text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_vocabulary_self_rating_once(p_request_id uuid, p_progress_id uuid, p_known boolean, p_ui_language text, p_target_level text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_vocabulary_self_rating_once(p_request_id uuid, p_progress_id uuid, p_known boolean, p_ui_language text, p_target_level text) TO authenticated;
GRANT ALL ON FUNCTION public.submit_vocabulary_self_rating_once(p_request_id uuid, p_progress_id uuid, p_known boolean, p_ui_language text, p_target_level text) TO service_role;


--
-- Name: FUNCTION node_available(p_student uuid, p_node uuid); Type: ACL; Schema: teacher_dashboard_private; Owner: -
--

REVOKE ALL ON FUNCTION teacher_dashboard_private.node_available(p_student uuid, p_node uuid) FROM PUBLIC;


--
-- Name: FUNCTION path_available(p_student uuid, p_unit uuid); Type: ACL; Schema: teacher_dashboard_private; Owner: -
--

REVOKE ALL ON FUNCTION teacher_dashboard_private.path_available(p_student uuid, p_unit uuid) FROM PUBLIC;


--
-- Name: FUNCTION phases(p_counts jsonb); Type: ACL; Schema: teacher_dashboard_private; Owner: -
--

REVOKE ALL ON FUNCTION teacher_dashboard_private.phases(p_counts jsonb) FROM PUBLIC;


--
-- Name: FUNCTION students(p_student uuid); Type: ACL; Schema: teacher_dashboard_private; Owner: -
--

REVOKE ALL ON FUNCTION teacher_dashboard_private.students(p_student uuid) FROM PUBLIC;


--
-- Name: FUNCTION unit_allowed(p_student uuid, p_unit uuid); Type: ACL; Schema: teacher_dashboard_private; Owner: -
--

REVOKE ALL ON FUNCTION teacher_dashboard_private.unit_allowed(p_student uuid, p_unit uuid) FROM PUBLIC;


--
-- Name: FUNCTION add_own_word(p_level text, p_word_de text, p_article text, p_translation text, p_locale text); Type: ACL; Schema: vocabulary_private; Owner: -
--

REVOKE ALL ON FUNCTION vocabulary_private.add_own_word(p_level text, p_word_de text, p_article text, p_translation text, p_locale text) FROM PUBLIC;
GRANT ALL ON FUNCTION vocabulary_private.add_own_word(p_level text, p_word_de text, p_article text, p_translation text, p_locale text) TO authenticated;


--
-- Name: FUNCTION answer_article_feedback(p_input text, p_word text, p_article text, p_plural text); Type: ACL; Schema: vocabulary_private; Owner: -
--

REVOKE ALL ON FUNCTION vocabulary_private.answer_article_feedback(p_input text, p_word text, p_article text, p_plural text) FROM PUBLIC;
GRANT ALL ON FUNCTION vocabulary_private.answer_article_feedback(p_input text, p_word text, p_article text, p_plural text) TO postgres;


--
-- Name: FUNCTION answer_key(p_card_id uuid, p_direction text, p_ui_language text, OUT canonical text, OUT accepted text[]); Type: ACL; Schema: vocabulary_private; Owner: -
--

REVOKE ALL ON FUNCTION vocabulary_private.answer_key(p_card_id uuid, p_direction text, p_ui_language text, OUT canonical text, OUT accepted text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION vocabulary_private.answer_key(p_card_id uuid, p_direction text, p_ui_language text, OUT canonical text, OUT accepted text[]) TO postgres;


--
-- Name: FUNCTION card_translation(p_card_id uuid, p_ui_language text); Type: ACL; Schema: vocabulary_private; Owner: -
--

REVOKE ALL ON FUNCTION vocabulary_private.card_translation(p_card_id uuid, p_ui_language text) FROM PUBLIC;
GRANT ALL ON FUNCTION vocabulary_private.card_translation(p_card_id uuid, p_ui_language text) TO postgres;


--
-- Name: FUNCTION carryover_candidates(p_target_level text); Type: ACL; Schema: vocabulary_private; Owner: -
--

REVOKE ALL ON FUNCTION vocabulary_private.carryover_candidates(p_target_level text) FROM PUBLIC;


--
-- Name: FUNCTION carryover_error(p_message text, p_state text); Type: ACL; Schema: vocabulary_private; Owner: -
--

REVOKE ALL ON FUNCTION vocabulary_private.carryover_error(p_message text, p_state text) FROM PUBLIC;


--
-- Name: FUNCTION check_retry_answer(p_progress_id uuid, p_typed_answer text, p_ui_language text); Type: ACL; Schema: vocabulary_private; Owner: -
--

REVOKE ALL ON FUNCTION vocabulary_private.check_retry_answer(p_progress_id uuid, p_typed_answer text, p_ui_language text) FROM PUBLIC;
GRANT ALL ON FUNCTION vocabulary_private.check_retry_answer(p_progress_id uuid, p_typed_answer text, p_ui_language text) TO authenticated;


--
-- Name: FUNCTION check_retry_answer(p_progress_id uuid, p_typed_answer text, p_ui_language text, p_target_level text); Type: ACL; Schema: vocabulary_private; Owner: -
--

REVOKE ALL ON FUNCTION vocabulary_private.check_retry_answer(p_progress_id uuid, p_typed_answer text, p_ui_language text, p_target_level text) FROM PUBLIC;


--
-- Name: FUNCTION delete_own_unit_cards(); Type: ACL; Schema: vocabulary_private; Owner: -
--

REVOKE ALL ON FUNCTION vocabulary_private.delete_own_unit_cards() FROM PUBLIC;


--
-- Name: FUNCTION delete_own_word(p_card_id uuid); Type: ACL; Schema: vocabulary_private; Owner: -
--

REVOKE ALL ON FUNCTION vocabulary_private.delete_own_word(p_card_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION vocabulary_private.delete_own_word(p_card_id uuid) TO authenticated;


--
-- Name: FUNCTION initialize_cards(p_decisions jsonb); Type: ACL; Schema: vocabulary_private; Owner: -
--

REVOKE ALL ON FUNCTION vocabulary_private.initialize_cards(p_decisions jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION vocabulary_private.initialize_cards(p_decisions jsonb) TO authenticated;


--
-- Name: FUNCTION progress_allowed(p_progress_id uuid, p_target_level text); Type: ACL; Schema: vocabulary_private; Owner: -
--

REVOKE ALL ON FUNCTION vocabulary_private.progress_allowed(p_progress_id uuid, p_target_level text) FROM PUBLIC;


--
-- Name: FUNCTION reset_lesson(p_unit_id uuid); Type: ACL; Schema: vocabulary_private; Owner: -
--

REVOKE ALL ON FUNCTION vocabulary_private.reset_lesson(p_unit_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION vocabulary_private.reset_lesson(p_unit_id uuid) TO authenticated;


--
-- Name: FUNCTION review_day(p_days integer); Type: ACL; Schema: vocabulary_private; Owner: -
--

REVOKE ALL ON FUNCTION vocabulary_private.review_day(p_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION vocabulary_private.review_day(p_days integer) TO postgres;


--
-- Name: FUNCTION self_rating_allowed(p_box integer, p_sentence boolean); Type: ACL; Schema: vocabulary_private; Owner: -
--

REVOKE ALL ON FUNCTION vocabulary_private.self_rating_allowed(p_box integer, p_sentence boolean) FROM PUBLIC;


--
-- Name: FUNCTION skip_assessment(p_level text); Type: ACL; Schema: vocabulary_private; Owner: -
--

REVOKE ALL ON FUNCTION vocabulary_private.skip_assessment(p_level text) FROM PUBLIC;
GRANT ALL ON FUNCTION vocabulary_private.skip_assessment(p_level text) TO authenticated;


--
-- Name: FUNCTION submit_answer(p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text); Type: ACL; Schema: vocabulary_private; Owner: -
--

REVOKE ALL ON FUNCTION vocabulary_private.submit_answer(p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text) FROM PUBLIC;
GRANT ALL ON FUNCTION vocabulary_private.submit_answer(p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text) TO authenticated;


--
-- Name: FUNCTION submit_answer(p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text, p_target_level text); Type: ACL; Schema: vocabulary_private; Owner: -
--

REVOKE ALL ON FUNCTION vocabulary_private.submit_answer(p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text, p_target_level text) FROM PUBLIC;


--
-- Name: FUNCTION submit_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text); Type: ACL; Schema: vocabulary_private; Owner: -
--

REVOKE ALL ON FUNCTION vocabulary_private.submit_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text) FROM PUBLIC;
GRANT ALL ON FUNCTION vocabulary_private.submit_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text) TO authenticated;


--
-- Name: FUNCTION submit_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text, p_target_level text); Type: ACL; Schema: vocabulary_private; Owner: -
--

REVOKE ALL ON FUNCTION vocabulary_private.submit_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text, p_target_level text) FROM PUBLIC;


--
-- Name: FUNCTION submit_self_rating(p_progress_id uuid, p_known boolean, p_ui_language text); Type: ACL; Schema: vocabulary_private; Owner: -
--

REVOKE ALL ON FUNCTION vocabulary_private.submit_self_rating(p_progress_id uuid, p_known boolean, p_ui_language text) FROM PUBLIC;


--
-- Name: FUNCTION submit_self_rating(p_progress_id uuid, p_known boolean, p_ui_language text, p_target_level text); Type: ACL; Schema: vocabulary_private; Owner: -
--

REVOKE ALL ON FUNCTION vocabulary_private.submit_self_rating(p_progress_id uuid, p_known boolean, p_ui_language text, p_target_level text) FROM PUBLIC;


--
-- Name: FUNCTION submit_self_rating_once(p_request_id uuid, p_progress_id uuid, p_known boolean, p_ui_language text); Type: ACL; Schema: vocabulary_private; Owner: -
--

REVOKE ALL ON FUNCTION vocabulary_private.submit_self_rating_once(p_request_id uuid, p_progress_id uuid, p_known boolean, p_ui_language text) FROM PUBLIC;
GRANT ALL ON FUNCTION vocabulary_private.submit_self_rating_once(p_request_id uuid, p_progress_id uuid, p_known boolean, p_ui_language text) TO authenticated;


--
-- Name: FUNCTION submit_self_rating_once(p_request_id uuid, p_progress_id uuid, p_known boolean, p_ui_language text, p_target_level text); Type: ACL; Schema: vocabulary_private; Owner: -
--

REVOKE ALL ON FUNCTION vocabulary_private.submit_self_rating_once(p_request_id uuid, p_progress_id uuid, p_known boolean, p_ui_language text, p_target_level text) FROM PUBLIC;


--
-- Name: TABLE rate_limits; Type: ACL; Schema: platform_private; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE platform_private.rate_limits TO service_role;


--
-- Name: TABLE mail_outbox; Type: ACL; Schema: private; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE private.mail_outbox TO service_role;


--
-- Name: TABLE booking_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.booking_items TO authenticated;
GRANT ALL ON TABLE public.booking_items TO service_role;


--
-- Name: TABLE bookings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.bookings TO authenticated;
GRANT ALL ON TABLE public.bookings TO service_role;


--
-- Name: TABLE cancellation_requests; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.cancellation_requests TO authenticated;
GRANT ALL ON TABLE public.cancellation_requests TO service_role;


--
-- Name: TABLE cefr_levels; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.cefr_levels TO authenticated;
GRANT ALL ON TABLE public.cefr_levels TO service_role;


--
-- Name: TABLE course_audiences; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.course_audiences TO anon;
GRANT SELECT ON TABLE public.course_audiences TO authenticated;
GRANT ALL ON TABLE public.course_audiences TO service_role;


--
-- Name: TABLE course_exceptions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.course_exceptions TO anon;
GRANT SELECT ON TABLE public.course_exceptions TO authenticated;
GRANT ALL ON TABLE public.course_exceptions TO service_role;


--
-- Name: TABLE course_schedules; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.course_schedules TO anon;
GRANT SELECT ON TABLE public.course_schedules TO authenticated;
GRANT ALL ON TABLE public.course_schedules TO service_role;


--
-- Name: TABLE course_translations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.course_translations TO anon;
GRANT SELECT ON TABLE public.course_translations TO authenticated;
GRANT ALL ON TABLE public.course_translations TO service_role;


--
-- Name: TABLE courses; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.courses TO anon;
GRANT SELECT ON TABLE public.courses TO authenticated;
GRANT ALL ON TABLE public.courses TO service_role;


--
-- Name: TABLE grammar_translations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.grammar_translations TO authenticated;
GRANT ALL ON TABLE public.grammar_translations TO service_role;


--
-- Name: TABLE invoice_cases; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.invoice_cases TO authenticated;
GRANT ALL ON TABLE public.invoice_cases TO service_role;


--
-- Name: TABLE learning_activity_days; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.learning_activity_days TO authenticated;
GRANT ALL ON TABLE public.learning_activity_days TO service_role;


--
-- Name: TABLE learning_exercises; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.learning_exercises TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.learning_exercises TO authenticated;


--
-- Name: TABLE learning_levels; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.learning_levels TO authenticated;
GRANT ALL ON TABLE public.learning_levels TO service_role;


--
-- Name: TABLE learning_reading_texts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.learning_reading_texts TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.learning_reading_texts TO authenticated;


--
-- Name: TABLE learning_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.learning_sessions TO authenticated;
GRANT ALL ON TABLE public.learning_sessions TO service_role;


--
-- Name: TABLE learning_trainer_grants; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.learning_trainer_grants TO authenticated;
GRANT ALL ON TABLE public.learning_trainer_grants TO service_role;


--
-- Name: TABLE learning_trainers; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.learning_trainers TO authenticated;
GRANT ALL ON TABLE public.learning_trainers TO service_role;


--
-- Name: TABLE learning_unit_grants; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.learning_unit_grants TO authenticated;
GRANT ALL ON TABLE public.learning_unit_grants TO service_role;


--
-- Name: TABLE learning_units; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.learning_units TO authenticated;
GRANT ALL ON TABLE public.learning_units TO service_role;


--
-- Name: TABLE learning_videos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.learning_videos TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.learning_videos TO authenticated;


--
-- Name: TABLE learning_vocabulary_cards; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.learning_vocabulary_cards TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.learning_vocabulary_cards TO authenticated;


--
-- Name: TABLE lms_media_folder; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.lms_media_folder TO authenticated;
GRANT ALL ON TABLE public.lms_media_folder TO service_role;


--
-- Name: TABLE lms_presentation_asset; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.lms_presentation_asset TO authenticated;
GRANT ALL ON TABLE public.lms_presentation_asset TO service_role;


--
-- Name: TABLE locales; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.locales TO anon;
GRANT SELECT ON TABLE public.locales TO authenticated;
GRANT ALL ON TABLE public.locales TO service_role;


--
-- Name: TABLE media_mime_types; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.media_mime_types TO authenticated;
GRANT ALL ON TABLE public.media_mime_types TO service_role;


--
-- Name: TABLE path_interventions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.path_interventions TO authenticated;
GRANT ALL ON TABLE public.path_interventions TO service_role;


--
-- Name: TABLE path_legacy_progress_notes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.path_legacy_progress_notes TO authenticated;


--
-- Name: TABLE path_node_progress; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.path_node_progress TO authenticated;
GRANT ALL ON TABLE public.path_node_progress TO service_role;


--
-- Name: TABLE path_node_translations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.path_node_translations TO authenticated;
GRANT ALL ON TABLE public.path_node_translations TO service_role;


--
-- Name: TABLE path_nodes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.path_nodes TO authenticated;
GRANT ALL ON TABLE public.path_nodes TO service_role;


--
-- Name: TABLE path_objectives; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.path_objectives TO authenticated;
GRANT ALL ON TABLE public.path_objectives TO service_role;


--
-- Name: TABLE path_practice_runs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.path_practice_runs TO authenticated;
GRANT ALL ON TABLE public.path_practice_runs TO service_role;


--
-- Name: TABLE path_test_answers; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.path_test_answers TO authenticated;
GRANT ALL ON TABLE public.path_test_answers TO service_role;


--
-- Name: TABLE path_test_attempts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.path_test_attempts TO authenticated;
GRANT ALL ON TABLE public.path_test_attempts TO service_role;


--
-- Name: TABLE path_unit_translations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.path_unit_translations TO authenticated;
GRANT ALL ON TABLE public.path_unit_translations TO service_role;


--
-- Name: TABLE people; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.people TO service_role;
GRANT SELECT ON TABLE public.people TO authenticated;


--
-- Name: COLUMN people.display_name; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(display_name) ON TABLE public.people TO authenticated;


--
-- Name: COLUMN people.phone; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(phone) ON TABLE public.people TO authenticated;


--
-- Name: COLUMN people.street; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(street) ON TABLE public.people TO authenticated;


--
-- Name: COLUMN people.postal_code; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(postal_code) ON TABLE public.people TO authenticated;


--
-- Name: COLUMN people.city; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(city) ON TABLE public.people TO authenticated;


--
-- Name: COLUMN people.preferred_locale; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(preferred_locale) ON TABLE public.people TO authenticated;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO service_role;
GRANT SELECT ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.native_language; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(native_language) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.ui_language; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(ui_language) ON TABLE public.profiles TO authenticated;


--
-- Name: TABLE pronunciation_messages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.pronunciation_messages TO service_role;
GRANT SELECT,INSERT ON TABLE public.pronunciation_messages TO authenticated;


--
-- Name: TABLE student_level_access; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.student_level_access TO authenticated;
GRANT ALL ON TABLE public.student_level_access TO service_role;


--
-- Name: TABLE submissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.submissions TO service_role;
GRANT SELECT ON TABLE public.submissions TO authenticated;


--
-- Name: TABLE teacher_student_notes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.teacher_student_notes TO service_role;
GRANT SELECT,DELETE ON TABLE public.teacher_student_notes TO authenticated;


--
-- Name: COLUMN teacher_student_notes.student_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(student_id) ON TABLE public.teacher_student_notes TO authenticated;


--
-- Name: COLUMN teacher_student_notes.teacher_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(teacher_id) ON TABLE public.teacher_student_notes TO authenticated;


--
-- Name: COLUMN teacher_student_notes.note_text; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(note_text),UPDATE(note_text) ON TABLE public.teacher_student_notes TO authenticated;


--
-- Name: TABLE user_exercise_progress; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_exercise_progress TO service_role;
GRANT SELECT ON TABLE public.user_exercise_progress TO authenticated;


--
-- Name: TABLE vocabulary_carryover_preferences; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.vocabulary_carryover_preferences TO authenticated;
GRANT ALL ON TABLE public.vocabulary_carryover_preferences TO service_role;


--
-- Name: TABLE vocabulary_direction_progress; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.vocabulary_direction_progress TO service_role;
GRANT SELECT ON TABLE public.vocabulary_direction_progress TO authenticated;


--
-- Name: TABLE vocabulary_learning_state; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.vocabulary_learning_state TO service_role;
GRANT SELECT ON TABLE public.vocabulary_learning_state TO authenticated;


--
-- Name: TABLE vocabulary_lesson_pauses; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.vocabulary_lesson_pauses TO authenticated;
GRANT ALL ON TABLE public.vocabulary_lesson_pauses TO service_role;


--
-- Name: TABLE vocabulary_onboarding; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.vocabulary_onboarding TO service_role;
GRANT SELECT ON TABLE public.vocabulary_onboarding TO authenticated;


--
-- Name: TABLE vocabulary_translations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.vocabulary_translations TO authenticated;
GRANT ALL ON TABLE public.vocabulary_translations TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES  TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES  TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES  TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES  TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS  TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS  TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS  TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS  TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES  TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES  TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES  TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES  TO service_role;

--
-- Phase 6 (Migrationen 41 und 42): von Hand im Exportformat ergänzt, kein Klon-Export.
--
CREATE TYPE public.learning_seen_kind AS ENUM (
    'level',
    'vocabulary_lesson',
    'path',
    'special_branch',
    'pronunciation_text',
    'media_folder',
    'video',
    'presentation',
    'trainer'
);
CREATE TABLE business_private.level_access_announcements (
    auth_user_id uuid NOT NULL,
    level text NOT NULL,
    announced_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.learning_first_visits (
    auth_user_id uuid NOT NULL,
    scope text NOT NULL,
    first_visit_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT learning_first_visits_scope_check CHECK (((scope = 'room'::text) OR ((length(scope) >= 1) AND (length(scope) <= 20))))
);
CREATE TABLE public.learning_seen_receipts (
    auth_user_id uuid NOT NULL,
    kind public.learning_seen_kind NOT NULL,
    object_key text NOT NULL,
    seen_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT learning_seen_receipts_object_key_check CHECK (((length(object_key) >= 1) AND (length(object_key) <= 80)))
);
ALTER TABLE ONLY business_private.level_access_announcements
    ADD CONSTRAINT level_access_announcements_pkey PRIMARY KEY (auth_user_id, level);
ALTER TABLE ONLY public.learning_first_visits
    ADD CONSTRAINT learning_first_visits_pkey PRIMARY KEY (auth_user_id, scope);
ALTER TABLE ONLY public.learning_seen_receipts
    ADD CONSTRAINT learning_seen_receipts_pkey PRIMARY KEY (auth_user_id, kind, object_key);
ALTER TABLE ONLY business_private.level_access_announcements
    ADD CONSTRAINT level_access_announcements_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.learning_first_visits
    ADD CONSTRAINT learning_first_visits_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.learning_seen_receipts
    ADD CONSTRAINT learning_seen_receipts_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE FUNCTION business_private.notify_student_of_pronunciation_reply() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE v_learner uuid; v_level text; v_email text; v_name text; v_locale text; v_notify boolean;
 v_reply jsonb; v_updated integer; v_result jsonb;
BEGIN
 BEGIN
  IF new.sender_role NOT IN('teacher','admin') THEN RETURN new; END IF;
  SELECT s.auth_user_id,s.level INTO v_learner,v_level FROM public.submissions s WHERE s.id=new.submission_id;
  IF v_learner IS NULL THEN RETURN new; END IF;
  SELECT pr.notify_pronunciation_feedback,
         CASE WHEN u.email_confirmed_at IS NOT NULL
              THEN coalesce(nullif(btrim(u.email),''),nullif(btrim(pe.email),'')) END,
         left(coalesce(nullif(btrim(pe.display_name),''),''),150),
         CASE WHEN pr.ui_language IN('de','en','ru','uk','tr') THEN pr.ui_language ELSE 'de' END
    INTO v_notify,v_email,v_name,v_locale
    FROM auth.users u
    JOIN public.profiles pr ON pr.id=u.id
    LEFT JOIN public.people pe ON pe.auth_user_id=u.id
   WHERE u.id=v_learner
   LIMIT 1;
  IF v_notify IS NOT TRUE OR v_email IS NULL THEN RETURN new; END IF;
  -- Gleichzeitige Antworten im selben Gespräch werden nacheinander gebündelt.
  PERFORM pg_advisory_xact_lock(hashtextextended('pronunciation-mail:'||new.submission_id::text,0));
  v_reply:=jsonb_build_object('text',left(btrim(new.text_content),200),'audio',new.audio_path IS NOT NULL);
  UPDATE private.mail_outbox SET payload=jsonb_set(payload,'{replies}',(payload->'replies')||v_reply)
   WHERE kind::text='feedback_available' AND status::text='pending'
     AND payload->>'submissionId'=new.submission_id::text
     AND CASE WHEN jsonb_typeof(payload->'replies')='array' THEN jsonb_array_length(payload->'replies')<10 ELSE false END;
  GET DIAGNOSTICS v_updated=ROW_COUNT;
  IF v_updated=0 THEN
   v_result:=public.queue_transactional_email('pronunciation-thread:'||new.submission_id||':'||new.id,'feedback_available',v_email,v_locale,
    jsonb_build_object('name',v_name,'authUserId',v_learner,'submissionId',new.submission_id,'replies',jsonb_build_array(v_reply),
     'path','/'||v_locale||'/dashboard/level/'||v_level||'/pronunciation?tab=mailbox&conversation='||new.submission_id));
   IF jsonb_typeof(v_result)='object' AND v_result ? 'error' THEN RAISE WARNING 'pronunciation_notification_failed'; END IF;
   -- Erst nach dem Bündelungsfenster versenden.
   UPDATE private.mail_outbox SET available_at=now()+interval '10 minutes'
    WHERE dedupe_key='pronunciation-thread:'||new.submission_id||':'||new.id AND status::text='pending';
  END IF;
 EXCEPTION WHEN OTHERS THEN RAISE WARNING 'pronunciation_notification_failed';
 END;
 RETURN new;
END $$;
CREATE FUNCTION business_private.cancel_pronunciation_mail_on_opt_out() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
BEGIN
 BEGIN
  DELETE FROM private.mail_outbox WHERE kind::text='feedback_available' AND status::text='pending'
   AND payload->>'authUserId'=new.id::text AND dedupe_key LIKE 'pronunciation-thread:%';
 EXCEPTION WHEN OTHERS THEN RAISE WARNING 'pronunciation_opt_out_cleanup_failed';
 END;
 RETURN new;
END $$;
CREATE FUNCTION business_private.notify_students_of_level_access() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
     jsonb_build_object('name',r.name,'levels',to_jsonb(r.levels),'path','/'||r.locale||'/dashboard/level/'||r.levels[1]));
    IF jsonb_typeof(v_result)='object' AND v_result ? 'error' THEN RAISE WARNING 'level_access_notification_failed'; CONTINUE; END IF;
    INSERT INTO business_private.level_access_announcements(auth_user_id,level) SELECT r.auth_user_id,x FROM unnest(r.levels) x ON CONFLICT DO NOTHING;
   EXCEPTION WHEN OTHERS THEN RAISE WARNING 'level_access_notification_failed';
   END;
  END LOOP;
 EXCEPTION WHEN OTHERS THEN RAISE WARNING 'level_access_notification_failed';
 END;
 RETURN NULL;
END $$;
CREATE FUNCTION learning_private.stamp_trainer_enabled() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
 IF new.enabled AND NOT old.enabled THEN new.enabled_at:=now(); END IF;
 RETURN new;
END $$;
CREATE FUNCTION learning_private.new_objects()
RETURNS TABLE(level text,mode text,kind public.learning_seen_kind,object_key text,covered boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=auth.uid(); room timestamptz; allowed uuid[]; published uuid[];
BEGIN
 IF actor IS NULL OR coalesce(identity_private.current_profile_role(),'') IN('teacher','admin') THEN RETURN; END IF;
 SELECT v.first_visit_at INTO room FROM public.learning_first_visits v WHERE v.auth_user_id=actor AND v.scope='room';
 IF room IS NULL THEN RETURN; END IF;
 allowed:=learning_private.allowed_unit_ids();
 published:=media_private.published_video_unit_ids();
 RETURN QUERY
 WITH lv AS MATERIALIZED (
   SELECT a.level lvl,a.granted_at,b.first_visit_at base,
          EXISTS(SELECT 1 FROM public.learning_seen_receipts r WHERE r.auth_user_id=actor AND r.kind='level' AND r.object_key=a.level) opened
     FROM public.student_level_access a
     JOIN public.learning_levels l ON l.code=a.level AND l.is_active
     LEFT JOIN public.learning_first_visits b ON b.auth_user_id=actor AND b.scope=a.level
    WHERE a.auth_user_id=actor),
  seen AS MATERIALIZED (SELECT r.kind k,r.object_key key FROM public.learning_seen_receipts r WHERE r.auth_user_id=actor),
  levels_new AS (
   SELECT lv.lvl,NULL::text m,'level'::public.learning_seen_kind k,lv.lvl key,false cov
     FROM lv WHERE lv.granted_at>room AND NOT lv.opened),
  trainers_new AS (
   SELECT lv.lvl,CASE g.trainer::text WHEN 'vocabulary' THEN 'vocabulary' WHEN 'exercises' THEN 'path' WHEN 'pronunciation' THEN 'pronunciation' ELSE 'media' END,
          'trainer'::public.learning_seen_kind,lv.lvl||':'||g.trainer::text,false
     FROM lv JOIN public.learning_trainer_grants g ON g.auth_user_id=actor AND g.level=lv.lvl
    WHERE g.enabled AND g.enabled_at>room AND NOT (lv.granted_at>room AND NOT lv.opened)
      AND trainer_access_private.allowed(lv.lvl,g.trainer::text)
      AND NOT EXISTS(SELECT 1 FROM seen s WHERE s.k='trainer' AND s.key=lv.lvl||':'||g.trainer::text)),
  lessons_new AS (
   SELECT lv.lvl,'vocabulary'::text,'vocabulary_lesson'::public.learning_seen_kind,u.id::text,false
     FROM lv JOIN public.learning_units u ON u.level=lv.lvl AND u.trainer='vocabulary' AND u.owner_auth_user_id IS NULL AND u.is_active
    WHERE lv.base IS NOT NULL AND u.created_at>lv.base AND u.id=ANY(allowed)
      AND NOT EXISTS(SELECT 1 FROM seen s WHERE s.k='vocabulary_lesson' AND s.key=u.id::text)),
  paths_new AS MATERIALIZED (
   SELECT lv.lvl,u.id
     FROM lv JOIN public.learning_units u ON u.level=lv.lvl AND u.trainer='exercises' AND u.is_path AND u.is_active
    WHERE lv.base IS NOT NULL AND u.created_at>lv.base AND u.id=ANY(allowed) AND path_private.unit_available(u.id)
      AND NOT EXISTS(SELECT 1 FROM seen s WHERE s.k='path' AND s.key=u.id::text)),
  branches_new AS (
   SELECT lv.lvl,'path'::text,'special_branch'::public.learning_seen_kind,n.id::text,EXISTS(SELECT 1 FROM paths_new pn WHERE pn.id=n.unit_id)
     FROM lv JOIN public.learning_units u ON u.level=lv.lvl AND u.trainer='exercises' AND u.is_path AND u.is_active
     JOIN public.path_nodes n ON n.unit_id=u.id AND n.kind='special' AND n.is_active
    WHERE lv.base IS NOT NULL AND n.created_at>lv.base AND u.id=ANY(allowed) AND path_private.node_available(n.id)
      AND NOT EXISTS(SELECT 1 FROM seen s WHERE s.k='special_branch' AND s.key=n.id::text)),
  texts_new AS (
   SELECT lv.lvl,'pronunciation'::text,'pronunciation_text'::public.learning_seen_kind,r.id::text,false
     FROM lv JOIN public.learning_units u ON u.level=lv.lvl AND u.trainer='pronunciation' AND u.owner_auth_user_id IS NULL AND u.is_active
     JOIN public.learning_reading_texts r ON r.unit_id=u.id
    WHERE lv.base IS NOT NULL AND r.created_at>lv.base AND u.id=ANY(allowed)
      AND learning_private.german_text_allowed(r.sentence_de) AND learning_private.german_text_allowed(r.focus)
      AND NOT EXISTS(SELECT 1 FROM seen s WHERE s.k='pronunciation_text' AND s.key=r.id::text)),
  folders_new AS MATERIALIZED (
   SELECT lv.lvl,f.folder_id
     FROM lv JOIN public.lms_media_folder f ON f.level=lv.lvl
    WHERE lv.base IS NOT NULL AND f.created_at>lv.base AND media_private.folder_allowed(f.folder_id)
      AND NOT EXISTS(SELECT 1 FROM seen s WHERE s.k='media_folder' AND s.key=f.folder_id::text)),
  videos_new AS (
   SELECT lv.lvl,'media'::text,'video'::public.learning_seen_kind,v.id::text,v.folder_id IS NOT NULL AND EXISTS(SELECT 1 FROM folders_new fn WHERE fn.folder_id=v.folder_id)
     FROM lv JOIN public.learning_units u ON u.level=lv.lvl AND u.trainer='videos' AND u.is_active
     JOIN public.learning_videos v ON v.unit_id=u.id
    WHERE lv.base IS NOT NULL AND v.created_at>lv.base
      AND ((v.storage_path IS NOT NULL AND v.file_size IS NOT NULL AND u.id=ANY(published)) OR (v.storage_path IS NULL AND v.source_url IS NOT NULL AND u.id=ANY(allowed)))
      AND (v.folder_id IS NULL OR media_private.folder_allowed(v.folder_id))
      AND NOT EXISTS(SELECT 1 FROM seen s WHERE s.k='video' AND s.key=v.id::text)),
  assets_new AS (
   SELECT lv.lvl,'media'::text,'presentation'::public.learning_seen_kind,a.asset_id::text,EXISTS(SELECT 1 FROM folders_new fn WHERE fn.folder_id=a.folder_id)
     FROM lv JOIN public.lms_media_folder f ON f.level=lv.lvl
     JOIN public.lms_presentation_asset a ON a.folder_id=f.folder_id
    WHERE lv.base IS NOT NULL AND a.created_at>lv.base AND media_private.folder_allowed(f.folder_id)
      AND NOT EXISTS(SELECT 1 FROM seen s WHERE s.k='presentation' AND s.key=a.asset_id::text))
 SELECT * FROM levels_new
 UNION ALL SELECT * FROM trainers_new
 UNION ALL SELECT * FROM lessons_new
 UNION ALL SELECT pn.lvl,'path','path'::public.learning_seen_kind,pn.id::text,false FROM paths_new pn
 UNION ALL SELECT * FROM branches_new
 UNION ALL SELECT * FROM texts_new
 UNION ALL SELECT fn.lvl,'media','media_folder'::public.learning_seen_kind,fn.folder_id::text,false FROM folders_new fn
 UNION ALL SELECT * FROM videos_new
 UNION ALL SELECT * FROM assets_new;
END $$;
CREATE FUNCTION public.get_learning_new_counts() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=auth.uid(); levels jsonb; visited jsonb;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated','message','Authentication is required.'); END IF;
 -- Der erste Aufruf im Lernraum legt die Grundlinie fest: davor Freigeschaltetes ist nicht neu.
 INSERT INTO public.learning_first_visits(auth_user_id,scope) VALUES(actor,'room') ON CONFLICT DO NOTHING;
 SELECT coalesce(jsonb_object_agg(g.level,g.entry),'{}'::jsonb) INTO levels FROM (
  SELECT n.level,jsonb_build_object(
    'level',bool_or(n.kind='level'),
    'total',count(*),
    'modes',jsonb_build_object(
      'vocabulary',count(*) FILTER(WHERE n.mode='vocabulary' AND n.kind<>'trainer'),
      'path',count(*) FILTER(WHERE n.mode='path' AND n.kind<>'trainer'),
      'pronunciation',count(*) FILTER(WHERE n.mode='pronunciation' AND n.kind<>'trainer'),
      'media',count(*) FILTER(WHERE n.mode='media' AND n.kind<>'trainer')),
    'modeNew',jsonb_build_object(
      'vocabulary',coalesce(bool_or(n.mode='vocabulary' AND n.kind='trainer'),false),
      'path',coalesce(bool_or(n.mode='path' AND n.kind='trainer'),false),
      'pronunciation',coalesce(bool_or(n.mode='pronunciation' AND n.kind='trainer'),false),
      'media',coalesce(bool_or(n.mode='media' AND n.kind='trainer'),false))) entry
    FROM learning_private.new_objects() n WHERE NOT n.covered GROUP BY n.level) g;
 -- Niveaus mit Grundlinie: nur dort kann Inhalt „neu" sein; die Oberfläche meldet den ersten Besuch weiterer Niveaus.
 SELECT coalesce(jsonb_agg(v.scope ORDER BY v.scope),'[]'::jsonb) INTO visited FROM public.learning_first_visits v WHERE v.auth_user_id=actor AND v.scope<>'room';
 RETURN jsonb_build_object('success',true,'any',levels<>'{}'::jsonb,'levels',levels,'visited',visited);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error','request_failed','message','The request could not be completed.','sqlstate',SQLSTATE);
END $$;
CREATE FUNCTION public.get_learning_new_items(p_level text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=auth.uid(); items jsonb; lessons jsonb;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated','message','Authentication is required.'); END IF;
 IF p_level IS NULL OR length(p_level) NOT BETWEEN 1 AND 20 THEN RETURN jsonb_build_object('error','invalid_input','message','The request contains invalid data.'); END IF;
 SELECT coalesce(jsonb_object_agg(g.kind,g.keys),'{}'::jsonb) INTO items FROM (
  SELECT n.kind::text kind,jsonb_agg(n.object_key ORDER BY n.object_key) keys
    FROM learning_private.new_objects() n WHERE n.level=p_level GROUP BY n.kind) g;
 -- Vokabel-Lektionen erscheinen in der Oberfläche unter ihrem Namen: Name je neuer Lektion mitgeben.
 SELECT coalesce(jsonb_object_agg(u.id::text,u.label),'{}'::jsonb) INTO lessons FROM public.learning_units u
  WHERE u.id::text IN(SELECT n.object_key FROM learning_private.new_objects() n WHERE n.level=p_level AND n.kind='vocabulary_lesson');
 RETURN jsonb_build_object('success',true,'level',p_level,'items',items,'lessons',lessons);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error','request_failed','message','The request could not be completed.','sqlstate',SQLSTATE);
END $$;
CREATE FUNCTION public.mark_learning_seen(p_kind text,p_object_key text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE actor uuid:=auth.uid(); v_kind public.learning_seen_kind; v_marked integer:=0;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated','message','Authentication is required.'); END IF;
 IF p_object_key IS NULL OR length(p_object_key) NOT BETWEEN 1 AND 80 THEN RETURN jsonb_build_object('error','invalid_input','message','The request contains invalid data.'); END IF;
 BEGIN v_kind:=p_kind::public.learning_seen_kind;
 EXCEPTION WHEN invalid_text_representation THEN RETURN jsonb_build_object('error','invalid_input','message','The request contains invalid data.'); END;
 INSERT INTO public.learning_first_visits(auth_user_id,scope) VALUES(actor,'room') ON CONFLICT DO NOTHING;
 -- Quittung nur für Objekte, die gerade wirklich neu sind: die Tabelle wächst nicht mit jedem Klick.
 INSERT INTO public.learning_seen_receipts(auth_user_id,kind,object_key)
 SELECT actor,n.kind,n.object_key FROM learning_private.new_objects() n WHERE n.kind=v_kind AND n.object_key=p_object_key
 ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS v_marked=ROW_COUNT;
 -- Ein Niveau zu öffnen ist der erste Besuch dieses Niveaus: ab jetzt zählt später Veröffentlichtes als neu.
 IF v_kind='level' AND EXISTS(SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=actor AND a.level=p_object_key) THEN
  INSERT INTO public.learning_first_visits(auth_user_id,scope) VALUES(actor,p_object_key) ON CONFLICT DO NOTHING;
 END IF;
 RETURN jsonb_build_object('success',true,'marked',v_marked>0);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error','request_failed','message','The request could not be completed.','sqlstate',SQLSTATE);
END $$;
CREATE TRIGGER on_pronunciation_reply_notify AFTER INSERT ON public.pronunciation_messages FOR EACH ROW WHEN ((new.sender_role = ANY (ARRAY['teacher'::public.profile_role, 'admin'::public.profile_role]))) EXECUTE FUNCTION business_private.notify_student_of_pronunciation_reply();
CREATE TRIGGER on_pronunciation_opt_out AFTER UPDATE OF notify_pronunciation_feedback ON public.profiles FOR EACH ROW WHEN ((old.notify_pronunciation_feedback AND (NOT new.notify_pronunciation_feedback))) EXECUTE FUNCTION business_private.cancel_pronunciation_mail_on_opt_out();
CREATE TRIGGER stamp_trainer_enabled BEFORE UPDATE OF enabled ON public.learning_trainer_grants FOR EACH ROW EXECUTE FUNCTION learning_private.stamp_trainer_enabled();
ALTER TABLE business_private.level_access_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_first_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_seen_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_read ON public.learning_first_visits FOR SELECT TO authenticated USING ((auth_user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY own_read ON public.learning_seen_receipts FOR SELECT TO authenticated USING ((auth_user_id = ( SELECT auth.uid() AS uid)));
GRANT UPDATE(notify_pronunciation_feedback) ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.learning_first_visits, public.learning_seen_receipts TO authenticated;
GRANT ALL ON TABLE public.learning_first_visits, public.learning_seen_receipts TO service_role;
REVOKE ALL ON FUNCTION public.get_learning_new_counts(), public.get_learning_new_items(text), public.mark_learning_seen(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_learning_new_counts(), public.get_learning_new_items(text), public.mark_learning_seen(text, text) TO authenticated;


--
-- PostgreSQL database dump complete
--

CREATE TRIGGER on_student_level_access_granted_notify AFTER INSERT ON public.student_level_access REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION business_private.notify_students_of_level_access();

-- Certificate CSV reconciliation and private PDF issuance (2026-09-29)

-- Source: migrations/20260929165242_certificate_csv_schema.sql
-- CSV-only Papierkram reconciliation and privately issued attendance certificates.
-- Additive migration; apply within the migration runner's transaction.
-- Client writes are deliberately absent. Server operations validate the session
-- and staff role before using a service-role transaction/RPC.
CREATE SCHEMA IF NOT EXISTS certificates_private;
REVOKE ALL ON SCHEMA certificates_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA certificates_private TO service_role;

CREATE TABLE IF NOT EXISTS public.import_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 account_key text NOT NULL DEFAULT 'papierkram',
 kind text NOT NULL CHECK(kind IN ('customers','invoices','products')),
 status text NOT NULL DEFAULT 'preview' CHECK(status IN ('preview','applied','failed')),
 filename text NOT NULL CHECK(length(filename) BETWEEN 1 AND 255),
 file_sha256 text NOT NULL CHECK(file_sha256 ~ '^[a-f0-9]{64}$'),
 exported_at timestamptz NOT NULL,
 scope jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(scope)='object'),
 is_complete_snapshot boolean NOT NULL DEFAULT false,
 export_year integer CHECK(export_year BETWEEN 2000 AND 2200),
 baseline_hash text,
 summary jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(summary)='object'),
 created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 applied_at timestamptz,
 CHECK((status='applied')=(applied_at IS NOT NULL)),
 CHECK(NOT is_complete_snapshot OR (kind='invoices' AND export_year IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS import_batches_export_idx ON public.import_batches(account_key,kind,exported_at DESC);
CREATE INDEX IF NOT EXISTS import_batches_checksum_idx ON public.import_batches(account_key,kind,file_sha256);
CREATE INDEX IF NOT EXISTS import_batches_actor_idx ON public.import_batches(created_by);

CREATE TABLE IF NOT EXISTS public.import_rows (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 batch_id uuid NOT NULL REFERENCES public.import_batches(id) ON DELETE RESTRICT,
 row_number integer NOT NULL CHECK(row_number>0),
 external_key text,
 raw_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(raw_data)='object'),
 normalized_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(normalized_data)='object'),
 disposition text NOT NULL CHECK(disposition IN ('new','updated','unchanged','conflict','ignored','error')),
 issues jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(issues)='array'),
 resolution jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(resolution)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(batch_id,row_number)
);

CREATE TABLE IF NOT EXISTS public.external_customers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 account_key text NOT NULL DEFAULT 'papierkram',
 customer_number text NOT NULL CHECK(length(btrim(customer_number)) BETWEEN 1 AND 100),
 person_id uuid REFERENCES public.people(id) ON DELETE RESTRICT,
 display_name text NOT NULL DEFAULT '',
 email text,
 phone text,
 street text,
 postal_code text,
 city text,
 source_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(source_data)='object'),
 review_status text NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','resolved','ignored')),
 review_reason text,
 source_revision integer NOT NULL DEFAULT 1 CHECK(source_revision>0),
 source_exported_at timestamptz,
 last_import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(account_key,customer_number),
 CHECK(review_status<>'resolved' OR person_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS external_customers_person_idx ON public.external_customers(person_id);
CREATE INDEX IF NOT EXISTS external_customers_email_idx ON public.external_customers(lower(btrim(email)));
CREATE INDEX IF NOT EXISTS external_customers_import_idx ON public.external_customers(last_import_batch_id);

CREATE TABLE IF NOT EXISTS public.external_products (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 account_key text NOT NULL DEFAULT 'papierkram',
 article_number text NOT NULL CHECK(length(btrim(article_number)) BETWEEN 1 AND 100),
 name text NOT NULL CHECK(length(btrim(name))>0),
 description text NOT NULL DEFAULT '',
 unit text,
 unit_price numeric(12,2) CHECK(unit_price>=0),
 source_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(source_data)='object'),
 review_status text NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','resolved','ignored')),
 review_reason text,
 source_revision integer NOT NULL DEFAULT 1 CHECK(source_revision>0),
 source_exported_at timestamptz,
 last_import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(account_key,article_number)
);
CREATE INDEX IF NOT EXISTS external_products_import_idx ON public.external_products(last_import_batch_id);

-- A single Papierkram SKU can correspond to multiple timetable courses.
CREATE TABLE IF NOT EXISTS public.external_product_courses (
 product_id uuid NOT NULL REFERENCES public.external_products(id) ON DELETE RESTRICT,
 course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
 certificate_title text NOT NULL CHECK(length(btrim(certificate_title))>0),
 certificate_description text NOT NULL DEFAULT '',
 schedule_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(schedule_snapshot)='array'),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(product_id,course_id)
);
CREATE INDEX IF NOT EXISTS external_product_courses_course_idx ON public.external_product_courses(course_id);

CREATE TABLE IF NOT EXISTS public.invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 account_key text NOT NULL DEFAULT 'papierkram',
 invoice_number text NOT NULL CHECK(length(btrim(invoice_number)) BETWEEN 1 AND 100),
 external_customer_id uuid REFERENCES public.external_customers(id) ON DELETE RESTRICT,
 customer_number text,
 document_type text NOT NULL DEFAULT 'invoice' CHECK(document_type IN ('invoice','cancellation','credit_note','unknown')),
 source_status text NOT NULL,
 payment_status text NOT NULL DEFAULT 'unknown' CHECK(payment_status IN ('unpaid','partial','paid','overpaid','reminded','unknown')),
 validity text NOT NULL DEFAULT 'review' CHECK(validity IN ('valid','cancelled','replaced','review')),
 invoice_date date NOT NULL,
 due_date date,
 paid_at date,
 service_month date CHECK(extract(day FROM service_month)=1),
 service_month_source text CHECK(service_month_source IN ('subject','existing','manual','booking')),
 gross_amount numeric(12,2) NOT NULL,
 paid_amount numeric(12,2) NOT NULL DEFAULT 0,
 discount_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK(discount_amount>=0),
 currency text NOT NULL DEFAULT 'EUR' CHECK(currency='EUR'),
 article_numbers text[] NOT NULL DEFAULT '{}'::text[],
 subject text NOT NULL DEFAULT '',
 source_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(source_data)='object'),
 source_revision integer NOT NULL DEFAULT 1 CHECK(source_revision>0),
 source_exported_at timestamptz NOT NULL,
 last_import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE RESTRICT,
 last_seen_at timestamptz NOT NULL DEFAULT now(),
 review_reason text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(account_key,invoice_number)
);
CREATE INDEX IF NOT EXISTS invoices_customer_idx ON public.invoices(external_customer_id);
CREATE INDEX IF NOT EXISTS invoices_month_idx ON public.invoices(service_month,payment_status,validity);
CREATE INDEX IF NOT EXISTS invoices_import_idx ON public.invoices(last_import_batch_id);
CREATE INDEX IF NOT EXISTS invoices_account_date_idx ON public.invoices(account_key,invoice_date);

CREATE TABLE IF NOT EXISTS public.invoice_relations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 original_invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
 related_invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
 relation_type text NOT NULL CHECK(relation_type IN ('cancels','replaces')),
 confirmed boolean NOT NULL DEFAULT false,
 confirmed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 confirmed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(original_invoice_id,related_invoice_id,relation_type),
 CHECK(original_invoice_id<>related_invoice_id),
 CHECK(confirmed=(confirmed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS invoice_relations_related_idx ON public.invoice_relations(related_invoice_id);
CREATE INDEX IF NOT EXISTS invoice_relations_actor_idx ON public.invoice_relations(confirmed_by);

CREATE TABLE IF NOT EXISTS public.invoice_allocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
 person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE RESTRICT,
 course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
 booking_item_id uuid REFERENCES public.booking_items(id) ON DELETE RESTRICT,
 start_date date NOT NULL,
 end_date date NOT NULL CHECK(end_date>=start_date),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','excluded')),
 source text NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','import','booking')),
 source_revision integer NOT NULL DEFAULT 1 CHECK(source_revision>0),
 created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(invoice_id,person_id,course_id,start_date,end_date),
 CHECK(date_trunc('month',start_date)=date_trunc('month',end_date))
);
CREATE INDEX IF NOT EXISTS invoice_allocations_person_course_idx ON public.invoice_allocations(person_id,course_id,start_date,end_date);
CREATE INDEX IF NOT EXISTS invoice_allocations_course_idx ON public.invoice_allocations(course_id);
CREATE INDEX IF NOT EXISTS invoice_allocations_booking_idx ON public.invoice_allocations(booking_item_id);
CREATE INDEX IF NOT EXISTS invoice_allocations_actor_idx ON public.invoice_allocations(created_by);

CREATE TABLE IF NOT EXISTS public.participation_periods (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE RESTRICT,
 course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
 booking_item_id uuid REFERENCES public.booking_items(id) ON DELETE RESTRICT,
 start_date date NOT NULL,
 end_date date NOT NULL CHECK(end_date>=start_date),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','revoked')),
 confirmed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 confirmed_at timestamptz,
 title_snapshot text NOT NULL CHECK(length(btrim(title_snapshot))>0),
 description_snapshot text NOT NULL DEFAULT '',
 schedule_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(schedule_snapshot)='array'),
 source_revision integer NOT NULL DEFAULT 1 CHECK(source_revision>0),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 note text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(status<>'confirmed' OR confirmed_at IS NOT NULL),
 CHECK(date_trunc('month',start_date)=date_trunc('month',end_date)),
 UNIQUE(person_id,course_id,start_date,end_date)
);
CREATE INDEX IF NOT EXISTS participation_periods_course_idx ON public.participation_periods(course_id,start_date);
CREATE INDEX IF NOT EXISTS participation_periods_booking_idx ON public.participation_periods(booking_item_id);
CREATE INDEX IF NOT EXISTS participation_periods_actor_idx ON public.participation_periods(confirmed_by);

CREATE TABLE IF NOT EXISTS public.certificate_issues (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE RESTRICT,
 certificate_number text UNIQUE,
 status text NOT NULL DEFAULT 'generating' CHECK(status IN ('generating','issued','failed','revoked')),
 requested_month date CHECK(extract(day FROM requested_month)=1),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 template_version text NOT NULL DEFAULT '1',
 storage_bucket text NOT NULL DEFAULT 'certificates' CHECK(storage_bucket='certificates'),
 storage_path text UNIQUE,
 pdf_sha256 text CHECK(pdf_sha256 ~ '^[a-f0-9]{64}$'),
 requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 issued_at timestamptz,
 revoked_at timestamptz,
 revoked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 revoked_reason text,
 failure_reason text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(status<>'issued' OR (issued_at IS NOT NULL AND storage_path IS NOT NULL AND pdf_sha256 IS NOT NULL AND certificate_number IS NOT NULL)),
 CHECK(status<>'revoked' OR (revoked_at IS NOT NULL AND nullif(btrim(revoked_reason),'') IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS certificate_issues_person_idx ON public.certificate_issues(person_id,created_at DESC);
CREATE INDEX IF NOT EXISTS certificate_issues_requester_idx ON public.certificate_issues(requested_by);
CREATE INDEX IF NOT EXISTS certificate_issues_revoker_idx ON public.certificate_issues(revoked_by);

CREATE TABLE IF NOT EXISTS public.certificate_sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 issue_id uuid NOT NULL REFERENCES public.certificate_issues(id) ON DELETE RESTRICT,
 participation_period_id uuid NOT NULL REFERENCES public.participation_periods(id) ON DELETE RESTRICT,
 invoice_allocation_id uuid NOT NULL REFERENCES public.invoice_allocations(id) ON DELETE RESTRICT,
 source_revision integer NOT NULL CHECK(source_revision>0),
 participation_revision integer NOT NULL CHECK(participation_revision>0),
 invoice_revision integer NOT NULL CHECK(invoice_revision>0),
 allocation_revision integer NOT NULL CHECK(allocation_revision>0),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(issue_id,participation_period_id,invoice_allocation_id)
);
CREATE INDEX IF NOT EXISTS certificate_sources_participation_idx ON public.certificate_sources(participation_period_id);
CREATE INDEX IF NOT EXISTS certificate_sources_allocation_idx ON public.certificate_sources(invoice_allocation_id);

CREATE TABLE IF NOT EXISTS public.certificate_audit_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 entity_type text NOT NULL,
 entity_id uuid NOT NULL,
 action text NOT NULL,
 before_data jsonb,
 after_data jsonb,
 actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS certificate_audit_entity_idx ON public.certificate_audit_log(entity_type,entity_id,created_at DESC);
CREATE INDEX IF NOT EXISTS certificate_audit_actor_idx ON public.certificate_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS certificate_audit_import_idx ON public.certificate_audit_log(import_batch_id);

COMMENT ON TABLE public.invoice_cases IS 'Existing bookkeeping workflow: invoice requested/created. CSV payment and document validity are held separately in invoices.';
COMMENT ON COLUMN public.import_batches.scope IS 'Explicit export coverage (e.g. invoice year and archived documents). Absence from a partial export never proves cancellation.';
COMMENT ON COLUMN public.import_rows.raw_data IS 'Whitelisted source columns only. Do not retain unrelated bank account or contact export columns.';
COMMENT ON COLUMN public.invoices.service_month IS 'Confirmed service month; never inferred from invoice date plus one month. A later payment update preserves this assignment.';
COMMENT ON COLUMN public.invoice_relations.relation_type IS 'The related document cancels or replaces the original. Copy/template notes are not evidence of this relation.';
COMMENT ON TABLE public.certificate_sources IS 'Immutable source versions used at issuance. Current eligibility is rechecked before serving a stored PDF.';

CREATE OR REPLACE FUNCTION certificates_private.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN NEW.updated_at:=clock_timestamp(); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION certificates_private.touch_updated_at() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION certificates_private.validate_participation() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.status='confirmed' AND NEW.end_date>(clock_timestamp() AT TIME ZONE 'Europe/Berlin')::date THEN
  RAISE EXCEPTION 'Future participation cannot be confirmed' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION certificates_private.validate_participation() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS certificate_participation_valid ON public.participation_periods;
CREATE TRIGGER certificate_participation_valid BEFORE INSERT OR UPDATE ON public.participation_periods
 FOR EACH ROW EXECUTE FUNCTION certificates_private.validate_participation();

CREATE OR REPLACE FUNCTION certificates_private.preserve_issue_snapshot() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.status IN ('issued','revoked') THEN RAISE EXCEPTION 'Issued certificates are retained' USING ERRCODE='23514'; END IF;
  RETURN OLD;
 END IF;
 IF OLD.status IN ('issued','revoked') THEN
  IF ROW(NEW.person_id,NEW.certificate_number,NEW.requested_month,NEW.snapshot,NEW.template_version,NEW.storage_bucket,NEW.storage_path,NEW.pdf_sha256,NEW.issued_at)
   IS DISTINCT FROM ROW(OLD.person_id,OLD.certificate_number,OLD.requested_month,OLD.snapshot,OLD.template_version,OLD.storage_bucket,OLD.storage_path,OLD.pdf_sha256,OLD.issued_at)
   OR NEW.status NOT IN ('issued','revoked') OR (OLD.status='revoked' AND NEW.status<>'revoked') THEN
   RAISE EXCEPTION 'Issued certificate content is immutable' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION certificates_private.preserve_issue_snapshot() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS certificate_issue_immutable ON public.certificate_issues;
CREATE TRIGGER certificate_issue_immutable BEFORE UPDATE OR DELETE ON public.certificate_issues
 FOR EACH ROW EXECUTE FUNCTION certificates_private.preserve_issue_snapshot();

DO $policies$
DECLARE table_name text;
BEGIN
 FOREACH table_name IN ARRAY ARRAY['import_batches','import_rows','external_customers','external_products','external_product_courses','invoices','invoice_relations','invoice_allocations','participation_periods','certificate_issues','certificate_sources','certificate_audit_log'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',table_name);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',table_name);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',table_name);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',table_name);
  EXECUTE format('DROP POLICY IF EXISTS certificate_staff_read ON public.%I',table_name);
  EXECUTE format('CREATE POLICY certificate_staff_read ON public.%I FOR SELECT TO authenticated USING ((SELECT business_private.is_staff()))',table_name);
 END LOOP;
 FOREACH table_name IN ARRAY ARRAY['import_batches','import_rows','external_customers','external_products','external_product_courses','invoices','invoice_relations','invoice_allocations','participation_periods','certificate_issues'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS certificate_touch_updated_at ON public.%I',table_name);
  EXECUTE format('CREATE TRIGGER certificate_touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION certificates_private.touch_updated_at()',table_name);
 END LOOP;
END $policies$;
-- Audit entries and source snapshots are append-only to the runtime role.
REVOKE UPDATE,DELETE,TRUNCATE ON public.certificate_audit_log,public.certificate_sources FROM service_role;
DROP POLICY IF EXISTS certificate_person_read ON public.participation_periods;
CREATE POLICY certificate_person_read ON public.participation_periods FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.people p WHERE p.id=person_id AND p.auth_user_id=(SELECT auth.uid())));
DROP POLICY IF EXISTS certificate_person_read ON public.certificate_issues;
CREATE POLICY certificate_person_read ON public.certificate_issues FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.people p WHERE p.id=person_id AND p.auth_user_id=(SELECT auth.uid())));

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('certificates','certificates',false,10485760,ARRAY['application/pdf'])
 ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- Restrictive policy also defeats any unrelated permissive "staff may read all"
-- policy that could otherwise accidentally expose this private bucket.
DROP POLICY IF EXISTS certificates_server_only ON storage.objects;
CREATE POLICY certificates_server_only ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated
 USING(bucket_id<>'certificates') WITH CHECK(bucket_id<>'certificates');

-- The existing verified identity claim may discard only a completely empty
-- account person. New certificate/finance references must block that operation.
CREATE OR REPLACE FUNCTION business_private.has_certificate_history(p_person uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.external_customers WHERE person_id=p_person)
 OR EXISTS(SELECT 1 FROM public.invoice_allocations WHERE person_id=p_person)
 OR EXISTS(SELECT 1 FROM public.participation_periods WHERE person_id=p_person)
 OR EXISTS(SELECT 1 FROM public.certificate_issues WHERE person_id=p_person)
$$;
REVOKE ALL ON FUNCTION business_private.has_certificate_history(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION business_private.has_certificate_history(uuid) TO service_role;

-- Preserve the deployed functions and their ACLs while extending only the
-- three known emptiness predicates. Fail on definition drift instead of
-- silently replacing unrelated, newer identity logic.
DO $identity_guards$
DECLARE signature text; definition text; old_predicate text; new_predicate text;
BEGIN
 FOR signature,old_predicate,new_predicate IN SELECT * FROM (VALUES
  ('business_private.claim_person()',
   'AND NOT EXISTS(SELECT 1 FROM public.invoice_cases WHERE person_id=v_person.id) THEN',
   'AND NOT EXISTS(SELECT 1 FROM public.invoice_cases WHERE person_id=v_person.id) AND NOT business_private.has_certificate_history(v_person.id) THEN'),
  ('business_private.list_registration_identity_conflicts()',
   'AND NOT EXISTS(SELECT 1 FROM public.invoice_cases i WHERE i.person_id=account.id)',
   'AND NOT EXISTS(SELECT 1 FROM public.invoice_cases i WHERE i.person_id=account.id) AND NOT business_private.has_certificate_history(account.id)'),
  ('business_private.resolve_registration_identity(uuid,uuid)',
   'OR EXISTS(SELECT 1 FROM public.invoice_cases WHERE person_id=current_person.id)',
   'OR EXISTS(SELECT 1 FROM public.invoice_cases WHERE person_id=current_person.id) OR business_private.has_certificate_history(current_person.id)')
 ) AS changes(signature,old_predicate,new_predicate) LOOP
  definition:=pg_get_functiondef(signature::regprocedure);
  IF strpos(definition,new_predicate)=0 THEN
   IF strpos(definition,old_predicate)=0 THEN
    RAISE EXCEPTION 'certificate_identity_guard_drift: %',signature USING ERRCODE='23514';
   END IF;
   EXECUTE replace(definition,old_predicate,new_predicate);
  END IF;
 END LOOP;
END $identity_guards$;

NOTIFY pgrst,'reload schema';


-- Source: migrations/20260929165727_certificate_csv_workflow.sql
-- Transactional, service-only CSV reconciliation. No Papierkram network API.
CREATE OR REPLACE FUNCTION certificates_private.verified_staff(p_actor uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id
 WHERE p.id=p_actor AND p.role IN ('teacher','admin') AND u.email_confirmed_at IS NOT NULL)
$$;
REVOKE ALL ON FUNCTION certificates_private.verified_staff(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION certificates_private.verified_staff(uuid) TO service_role;

CREATE OR REPLACE FUNCTION certificates_private.account_baseline(p_account text) RETURNS text
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT md5(jsonb_build_array(
 (SELECT coalesce(jsonb_agg(jsonb_build_array(id,source_revision) ORDER BY id),'[]') FROM public.external_customers WHERE account_key=p_account),
 (SELECT coalesce(jsonb_agg(jsonb_build_array(id,source_revision) ORDER BY id),'[]') FROM public.external_products WHERE account_key=p_account),
 (SELECT coalesce(jsonb_agg(jsonb_build_array(id,source_revision) ORDER BY id),'[]') FROM public.invoices WHERE account_key=p_account),
 (SELECT coalesce(jsonb_agg(jsonb_build_array(m.product_id,m.course_id,m.version) ORDER BY m.product_id,m.course_id),'[]') FROM public.external_product_courses m JOIN public.external_products p ON p.id=m.product_id WHERE p.account_key=p_account),
 (SELECT coalesce(jsonb_agg(jsonb_build_array(id,email,auth_user_id) ORDER BY id),'[]') FROM public.people),
 (SELECT coalesce(jsonb_agg(jsonb_build_array(id,person_id,target_month,start_date,status,revision) ORDER BY id),'[]') FROM public.bookings),
 (SELECT coalesce(jsonb_agg(jsonb_build_array(id,booking_id,course_id) ORDER BY id),'[]') FROM public.booking_items)
 )::text)
$$;

CREATE OR REPLACE FUNCTION certificates_private.record_change() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE before_value jsonb; after_value jsonb; entity uuid; actor uuid;
BEGIN
 actor:=nullif(current_setting('certificates.actor_id',true),'')::uuid;
 IF TG_OP<>'INSERT' THEN before_value:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN after_value:=to_jsonb(NEW); END IF;
 IF before_value IS NOT DISTINCT FROM after_value THEN RETURN NULL; END IF;
 entity:=coalesce((after_value->>'id')::uuid,(before_value->>'id')::uuid,(after_value->>'product_id')::uuid,(before_value->>'product_id')::uuid);
 INSERT INTO public.certificate_audit_log(entity_type,entity_id,action,before_data,after_data,actor_id)
 VALUES(TG_TABLE_NAME,entity,lower(TG_OP),before_value,after_value,actor);
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION certificates_private.bump_source_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE ignored text[]:=ARRAY['source_revision','revision','updated_at','last_seen_at','last_import_batch_id','source_exported_at'];
BEGIN
 IF (to_jsonb(NEW)-ignored) IS DISTINCT FROM (to_jsonb(OLD)-ignored) THEN
  NEW.source_revision:=OLD.source_revision+1;
  IF TG_TABLE_NAME='participation_periods' THEN NEW.revision:=OLD.revision+1; END IF;
 ELSE
  NEW.source_revision:=OLD.source_revision;
  IF TG_TABLE_NAME='participation_periods' THEN NEW.revision:=OLD.revision; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION certificates_private.invalidate_sources() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE target_ids uuid[];
BEGIN
 IF TG_OP='UPDATE' AND NEW.source_revision=OLD.source_revision THEN RETURN NULL; END IF;
 IF TG_TABLE_NAME='invoices' THEN
  SELECT array_agg(DISTINCT s.issue_id) INTO target_ids FROM public.certificate_sources s
  JOIN public.invoice_allocations a ON a.id=s.invoice_allocation_id WHERE a.invoice_id=NEW.id;
 ELSIF TG_TABLE_NAME='invoice_allocations' THEN
  SELECT array_agg(DISTINCT s.issue_id) INTO target_ids FROM public.certificate_sources s WHERE s.invoice_allocation_id=NEW.id;
 ELSIF TG_TABLE_NAME='participation_periods' THEN
  SELECT array_agg(DISTINCT s.issue_id) INTO target_ids FROM public.certificate_sources s WHERE s.participation_period_id=NEW.id;
 END IF;
 UPDATE public.certificate_issues SET status=CASE WHEN status='generating' THEN 'failed' ELSE 'revoked' END,
 revoked_at=CASE WHEN status='issued' THEN clock_timestamp() ELSE revoked_at END,
 revoked_reason=CASE WHEN status='issued' THEN 'Die zugrunde liegenden Teilnahme- oder Rechnungsdaten wurden geändert.' ELSE revoked_reason END,
 failure_reason=CASE WHEN status='generating' THEN 'source_changed' ELSE failure_reason END
 WHERE id=ANY(target_ids) AND status IN ('generating','issued');
 -- A newly added obligation can invalidate existing certificates even though
 -- that obligation was not among their original source rows.
 IF TG_TABLE_NAME='invoice_allocations' THEN
  UPDATE public.certificate_issues i SET status=CASE WHEN i.status='generating' THEN 'failed' ELSE 'revoked' END,
   revoked_at=CASE WHEN i.status='issued' THEN clock_timestamp() ELSE i.revoked_at END,
   revoked_reason=CASE WHEN i.status='issued' THEN 'Die Rechnungszuordnung wurde geändert.' ELSE i.revoked_reason END,
   failure_reason=CASE WHEN i.status='generating' THEN 'source_changed' ELSE i.failure_reason END
  WHERE i.status IN ('generating','issued') AND EXISTS(SELECT 1 FROM public.certificate_sources s JOIN public.participation_periods p ON p.id=s.participation_period_id
   WHERE s.issue_id=i.id AND p.person_id=NEW.person_id AND p.course_id=NEW.course_id AND p.start_date<=NEW.end_date AND p.end_date>=NEW.start_date);
 END IF;
 RETURN NULL;
END $$;

DO $triggers$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['external_customers','external_products','invoices','invoice_allocations','participation_periods'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS certificate_revision ON public.%I',t);
  EXECUTE format('CREATE TRIGGER certificate_revision BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION certificates_private.bump_source_revision()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['external_customers','external_products','external_product_courses','invoices','invoice_relations','invoice_allocations','participation_periods','certificate_issues'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS certificate_audit ON public.%I',t);
  EXECUTE format('CREATE TRIGGER certificate_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION certificates_private.record_change()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['invoices','invoice_allocations','participation_periods'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS certificate_invalidate ON public.%I',t);
  EXECUTE format('CREATE TRIGGER certificate_invalidate AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION certificates_private.invalidate_sources()',t);
 END LOOP;
END $triggers$;

CREATE OR REPLACE FUNCTION certificates_private.refresh_allocations(p_invoice uuid) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE inv public.invoices; person uuid; item record; problem text; article text;
BEGIN
 SELECT * INTO inv FROM public.invoices WHERE id=p_invoice FOR UPDATE;
 SELECT person_id INTO person FROM public.external_customers WHERE id=inv.external_customer_id AND review_status='resolved';
 IF person IS NULL THEN problem:='customer_unresolved';
 ELSIF inv.service_month IS NULL THEN problem:='service_month_missing';
 ELSIF cardinality(inv.article_numbers)=0 THEN problem:='product_unmapped';
 ELSE
  FOREACH article IN ARRAY inv.article_numbers LOOP
   IF NOT EXISTS(SELECT 1 FROM public.external_products p JOIN public.external_product_courses m ON m.product_id=p.id
    WHERE p.account_key=inv.account_key AND p.article_number=article AND p.review_status='resolved') THEN problem:='product_unmapped'; EXIT; END IF;
  END LOOP;
 END IF;
 IF problem IS NULL AND inv.document_type='invoice' AND inv.validity NOT IN ('cancelled','replaced') THEN
  FOR item IN SELECT DISTINCT ON (bi.course_id,b.start_date) bi.id,bi.course_id,b.start_date,m.certificate_title,m.certificate_description,m.schedule_snapshot
   FROM public.bookings b JOIN public.booking_items bi ON bi.booking_id=b.id
   JOIN public.external_product_courses m ON m.course_id=bi.course_id JOIN public.external_products p ON p.id=m.product_id
   WHERE b.person_id=person AND b.target_month=inv.service_month AND b.status='confirmed' AND b.kind<>'trial'
    AND p.account_key=inv.account_key AND p.article_number=ANY(inv.article_numbers) AND p.review_status='resolved'
   ORDER BY bi.course_id,b.start_date,bi.id
  LOOP
   INSERT INTO public.invoice_allocations(invoice_id,person_id,course_id,booking_item_id,start_date,end_date,status,source,created_by)
   SELECT inv.id,person,item.course_id,item.id,greatest(item.start_date,inv.service_month),(inv.service_month+interval '1 month - 1 day')::date,'confirmed','booking',nullif(current_setting('certificates.actor_id',true),'')::uuid
   WHERE NOT EXISTS(SELECT 1 FROM public.invoice_allocations a WHERE a.invoice_id=inv.id AND a.person_id=person AND a.course_id=item.course_id AND a.source='manual')
   ON CONFLICT(invoice_id,person_id,course_id,start_date,end_date) DO NOTHING;
   INSERT INTO public.participation_periods(person_id,course_id,booking_item_id,start_date,end_date,title_snapshot,description_snapshot,schedule_snapshot)
   SELECT person,item.course_id,item.id,greatest(item.start_date,inv.service_month),(inv.service_month+interval '1 month - 1 day')::date,item.certificate_title,item.certificate_description,item.schedule_snapshot
   WHERE NOT EXISTS(SELECT 1 FROM public.participation_periods p WHERE p.person_id=person AND p.course_id=item.course_id
    AND p.start_date<=(inv.service_month+interval '1 month - 1 day')::date AND p.end_date>=greatest(item.start_date,inv.service_month) AND p.status<>'revoked')
   ON CONFLICT DO NOTHING;
  END LOOP;
  FOREACH article IN ARRAY inv.article_numbers LOOP
   IF NOT EXISTS(SELECT 1 FROM public.invoice_allocations a JOIN public.external_product_courses m ON m.course_id=a.course_id
    JOIN public.external_products p ON p.id=m.product_id WHERE a.invoice_id=inv.id AND a.status='confirmed'
    AND p.account_key=inv.account_key AND p.article_number=article) THEN problem:='allocation_missing'; END IF;
  END LOOP;
 END IF;
 -- Source-import problems and deliberate review decisions must never be cleared
 -- merely because a product/customer mapping has become available.
 IF inv.review_reason IS NULL OR inv.review_reason IN ('customer_unresolved','service_month_missing','product_unmapped','allocation_missing') THEN
  UPDATE public.invoices SET review_reason=problem WHERE id=inv.id AND review_reason IS DISTINCT FROM problem;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.certificate_eligibility(p_person uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE period record; reason text; allocations jsonb; output jsonb:='[]';
BEGIN
 FOR period IN SELECT * FROM public.participation_periods WHERE person_id=p_person ORDER BY start_date,course_id,id LOOP
  reason:=NULL;
  IF period.status<>'confirmed' THEN reason:='participation_unconfirmed';
  ELSIF period.end_date>(current_timestamp AT TIME ZONE 'Europe/Berlin')::date THEN reason:='future_period';
  ELSIF NOT EXISTS(SELECT 1 FROM public.invoice_allocations a WHERE a.person_id=p_person AND a.course_id=period.course_id
   AND a.status='confirmed' AND a.start_date<=period.end_date AND a.end_date>=period.start_date) THEN reason:='allocation_missing';
  ELSIF EXISTS(SELECT 1 FROM generate_series(period.start_date::timestamp,period.end_date::timestamp,interval '1 day') day
   WHERE NOT EXISTS(SELECT 1 FROM public.invoice_allocations a WHERE a.person_id=p_person AND a.course_id=period.course_id
    AND a.status='confirmed' AND a.start_date<=day::date AND a.end_date>=day::date)) THEN reason:='coverage_gap';
  ELSIF EXISTS(SELECT 1 FROM public.invoice_allocations a JOIN public.invoices i ON i.id=a.invoice_id
   LEFT JOIN public.external_customers c ON c.id=i.external_customer_id
   WHERE a.person_id=p_person AND a.course_id=period.course_id AND a.status<>'excluded'
   AND a.start_date<=period.end_date AND a.end_date>=period.start_date
   AND (a.status<>'confirmed' OR c.person_id IS DISTINCT FROM p_person OR c.review_status<>'resolved'
    OR i.service_month IS DISTINCT FROM date_trunc('month',period.start_date)::date OR i.review_reason IS NOT NULL
    OR i.validity<>'valid' OR i.document_type<>'invoice')) THEN reason:='invoice_review';
  ELSIF EXISTS(SELECT 1 FROM public.invoices i JOIN public.external_customers c ON c.id=i.external_customer_id
   WHERE c.person_id=p_person AND i.service_month=date_trunc('month',period.start_date)::date AND i.document_type='invoice'
    AND i.validity NOT IN ('cancelled','replaced') AND EXISTS(SELECT 1 FROM public.external_products p JOIN public.external_product_courses m ON m.product_id=p.id
      WHERE p.account_key=i.account_key AND p.article_number=ANY(i.article_numbers) AND m.course_id=period.course_id)
    AND (i.validity<>'valid' OR i.review_reason IS NOT NULL OR NOT EXISTS(SELECT 1 FROM public.invoice_allocations a WHERE a.invoice_id=i.id AND a.person_id=p_person AND a.course_id=period.course_id AND a.status='confirmed'))
   ) THEN reason:='invoice_review';
  ELSIF EXISTS(SELECT 1 FROM public.invoice_allocations a JOIN public.invoices i ON i.id=a.invoice_id
   WHERE a.person_id=p_person AND a.course_id=period.course_id AND a.status='confirmed'
    AND a.start_date<=period.end_date AND a.end_date>=period.start_date
    AND (i.payment_status NOT IN ('paid','overpaid') OR i.gross_amount<0 OR i.paid_amount+i.discount_amount<i.gross_amount)) THEN reason:='invoice_unpaid';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'invoice_id',i.id,'start_date',a.start_date,'end_date',a.end_date,
   'source_revision',a.source_revision,'invoice_revision',i.source_revision,'payment_status',i.payment_status,'validity',i.validity,'invoice_number',i.invoice_number) ORDER BY a.id),'[]')
  INTO allocations FROM public.invoice_allocations a JOIN public.invoices i ON i.id=a.invoice_id
  WHERE a.person_id=p_person AND a.course_id=period.course_id AND a.status='confirmed' AND a.start_date<=period.end_date AND a.end_date>=period.start_date;
  output:=output||jsonb_build_array(to_jsonb(period)||jsonb_build_object('eligible',reason IS NULL,'reason',reason,'allocations',allocations));
 END LOOP;
 RETURN output;
END $$;

CREATE OR REPLACE FUNCTION certificates_private.apply_rows(p_batch uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE batch public.import_batches; row_data record; d jsonb; person uuid; matches integer; duplicates integer;
 customer public.external_customers; product public.external_products; inv public.invoices; email_value text; key_value text;
 disposition_value text; changed integer:=0; conflicts integer:=0; missing integer:=0; inv_id uuid;
BEGIN
 SELECT * INTO batch FROM public.import_batches WHERE id=p_batch FOR UPDATE;
 IF batch.id IS NULL THEN RAISE EXCEPTION 'Import not found' USING ERRCODE='22023'; END IF;
 IF batch.status='applied' THEN RETURN jsonb_build_object('batch_id',batch.id,'status','applied','summary',batch.summary); END IF;
 IF EXISTS(SELECT 1 FROM public.import_rows WHERE batch_id=batch.id AND disposition='error') THEN
  RAISE EXCEPTION 'Import contains invalid rows; correct the CSV before applying it' USING ERRCODE='23514';
 END IF;
 IF batch.kind='invoices' AND batch.is_complete_snapshot AND EXISTS(SELECT 1 FROM public.import_rows r WHERE r.batch_id=batch.id
  AND r.disposition<>'ignored' AND extract(year FROM (r.normalized_data->>'invoice_date')::date) IS DISTINCT FROM batch.export_year) THEN
  RAISE EXCEPTION 'A complete year export contains invoices from a different year' USING ERRCODE='23514';
 END IF;
 IF EXISTS(SELECT 1 FROM public.import_batches b WHERE b.id<>batch.id AND b.account_key=batch.account_key AND b.kind=batch.kind AND b.status='applied' AND b.file_sha256=batch.file_sha256 AND b.exported_at=batch.exported_at AND b.scope=batch.scope) THEN
  UPDATE public.import_batches SET status='applied',applied_at=clock_timestamp(),summary=summary||'{"duplicate":true}'::jsonb WHERE id=batch.id;
  RETURN jsonb_build_object('batch_id',batch.id,'status','applied','summary',jsonb_build_object('duplicate',true));
 END IF;
 IF batch.baseline_hash IS DISTINCT FROM certificates_private.account_baseline(batch.account_key) THEN
  RAISE EXCEPTION 'Import preview is stale; upload again' USING ERRCODE='40001';
 END IF;
 IF EXISTS(SELECT 1 FROM public.import_batches b WHERE b.account_key=batch.account_key AND b.kind=batch.kind AND b.status='applied' AND b.exported_at>batch.exported_at) THEN
  RAISE EXCEPTION 'An older export cannot overwrite a newer import' USING ERRCODE='40001';
 END IF;
 FOR row_data IN SELECT * FROM public.import_rows WHERE batch_id=batch.id ORDER BY row_number LOOP
  IF row_data.disposition IN ('ignored','error') THEN CONTINUE; END IF;
  d:=row_data.normalized_data; disposition_value:='updated';
  IF batch.kind='customers' THEN
   key_value:=d->>'customer_number'; email_value:=nullif(lower(btrim(d->>'email')),'');
   SELECT * INTO customer FROM public.external_customers WHERE account_key=batch.account_key AND customer_number=key_value FOR UPDATE;
   IF customer.source_exported_at>batch.exported_at THEN RAISE EXCEPTION 'Stale customer export' USING ERRCODE='40001'; END IF;
   person:=customer.person_id;
   IF customer.id IS NULL THEN disposition_value:='new'; ELSIF customer.source_data=d THEN disposition_value:='unchanged'; END IF;
   IF person IS NULL AND email_value IS NOT NULL THEN
    SELECT count(*) INTO duplicates FROM public.import_rows r WHERE r.batch_id=batch.id AND r.disposition NOT IN ('ignored','error') AND lower(btrim(r.normalized_data->>'email'))=email_value;
    SELECT count(*),(array_agg(p.id ORDER BY p.id))[1] INTO matches,person FROM public.people p WHERE lower(btrim(p.email))=email_value;
    IF duplicates>1 OR matches>1 OR EXISTS(SELECT 1 FROM public.external_customers ec WHERE ec.account_key=batch.account_key AND ec.customer_number<>key_value AND lower(btrim(ec.email))=email_value) THEN person:=NULL;
    ELSIF matches=0 THEN
     INSERT INTO public.people(display_name,email,phone,street,postal_code,city)
     VALUES(d->>'display_name',email_value,d->>'phone',d->>'street',d->>'postal_code',d->>'city') RETURNING id INTO person;
    END IF;
   END IF;
   IF person IS NULL THEN disposition_value:='conflict'; conflicts:=conflicts+1; END IF;
   INSERT INTO public.external_customers(account_key,customer_number,person_id,display_name,email,phone,street,postal_code,city,source_data,review_status,review_reason,source_exported_at,last_import_batch_id)
   VALUES(batch.account_key,key_value,person,d->>'display_name',email_value,d->>'phone',d->>'street',d->>'postal_code',d->>'city',d,
    CASE WHEN person IS NULL THEN 'pending' ELSE 'resolved' END,CASE WHEN person IS NULL THEN 'email_missing_or_ambiguous' END,batch.exported_at,batch.id)
   ON CONFLICT(account_key,customer_number) DO UPDATE SET display_name=excluded.display_name,email=excluded.email,phone=excluded.phone,street=excluded.street,postal_code=excluded.postal_code,city=excluded.city,
    person_id=coalesce(external_customers.person_id,excluded.person_id),source_data=excluded.source_data,review_status=CASE WHEN coalesce(external_customers.person_id,excluded.person_id) IS NOT NULL THEN 'resolved' ELSE excluded.review_status END,
    review_reason=CASE WHEN coalesce(external_customers.person_id,excluded.person_id) IS NOT NULL THEN NULL ELSE excluded.review_reason END,source_exported_at=excluded.source_exported_at,last_import_batch_id=excluded.last_import_batch_id;
  ELSIF batch.kind='products' THEN
   SELECT * INTO product FROM public.external_products WHERE account_key=batch.account_key AND article_number=d->>'article_number' FOR UPDATE;
   IF product.source_exported_at>batch.exported_at THEN RAISE EXCEPTION 'Stale product export' USING ERRCODE='40001'; END IF;
   IF product.id IS NULL THEN disposition_value:='new'; ELSIF product.source_data=d THEN disposition_value:='unchanged'; END IF;
   INSERT INTO public.external_products(account_key,article_number,name,description,unit,unit_price,source_data,source_exported_at,last_import_batch_id)
   VALUES(batch.account_key,d->>'article_number',d->>'name',coalesce(d->>'description',''),d->>'unit',(d->>'unit_price')::numeric,d,batch.exported_at,batch.id)
   ON CONFLICT(account_key,article_number) DO UPDATE SET name=excluded.name,description=excluded.description,unit=excluded.unit,unit_price=excluded.unit_price,source_data=excluded.source_data,source_exported_at=excluded.source_exported_at,last_import_batch_id=excluded.last_import_batch_id;
  ELSE
   SELECT * INTO inv FROM public.invoices WHERE account_key=batch.account_key AND invoice_number=d->>'invoice_number' FOR UPDATE;
   IF inv.source_exported_at>batch.exported_at THEN RAISE EXCEPTION 'Stale invoice export' USING ERRCODE='40001'; END IF;
   IF inv.id IS NULL THEN disposition_value:='new'; ELSIF inv.source_data=d THEN disposition_value:='unchanged'; END IF;
   INSERT INTO public.invoices(account_key,invoice_number,external_customer_id,customer_number,document_type,source_status,payment_status,validity,invoice_date,due_date,paid_at,service_month,service_month_source,gross_amount,paid_amount,discount_amount,article_numbers,subject,source_data,source_exported_at,last_import_batch_id,review_reason)
   VALUES(batch.account_key,d->>'invoice_number',(SELECT id FROM public.external_customers WHERE account_key=batch.account_key AND customer_number=d->>'customer_number'),d->>'customer_number',d->>'document_type',d->>'source_status',d->>'payment_status',d->>'validity',(d->>'invoice_date')::date,nullif(d->>'due_date','')::date,nullif(d->>'paid_at','')::date,nullif(d->>'service_month','')::date,'subject',(d->>'gross_amount')::numeric,(d->>'paid_amount')::numeric,(d->>'discount_amount')::numeric,ARRAY(SELECT jsonb_array_elements_text(d->'article_numbers')),coalesce(d->>'subject',''),d,batch.exported_at,batch.id,nullif(d->>'review_reason',''))
   ON CONFLICT(account_key,invoice_number) DO UPDATE SET
    external_customer_id=excluded.external_customer_id,customer_number=excluded.customer_number,document_type=excluded.document_type,source_status=excluded.source_status,payment_status=excluded.payment_status,
    validity=CASE WHEN invoices.validity IN ('cancelled','replaced') AND EXISTS(SELECT 1 FROM public.invoice_relations r WHERE r.original_invoice_id=invoices.id AND r.confirmed) THEN invoices.validity ELSE excluded.validity END,
    invoice_date=excluded.invoice_date,due_date=excluded.due_date,paid_at=excluded.paid_at,
    service_month=coalesce(invoices.service_month,excluded.service_month),service_month_source=coalesce(invoices.service_month_source,excluded.service_month_source),
    gross_amount=excluded.gross_amount,paid_amount=excluded.paid_amount,discount_amount=excluded.discount_amount,article_numbers=excluded.article_numbers,subject=excluded.subject,source_data=excluded.source_data,source_exported_at=excluded.source_exported_at,last_import_batch_id=excluded.last_import_batch_id,last_seen_at=clock_timestamp(),
    review_reason=CASE WHEN invoices.service_month IS NOT NULL AND excluded.service_month IS NOT NULL AND invoices.service_month<>excluded.service_month THEN 'service_month_conflict'
     WHEN invoices.customer_number IS DISTINCT FROM excluded.customer_number THEN 'customer_changed'
     WHEN invoices.service_month IS NOT NULL AND excluded.review_reason IN ('missing_month','service_month_missing') THEN NULL
     ELSE excluded.review_reason END
   RETURNING id INTO inv_id;
   PERFORM certificates_private.refresh_allocations(inv_id);
  END IF;
  UPDATE public.import_rows SET disposition=disposition_value WHERE id=row_data.id;
  IF disposition_value IN ('new','updated') THEN changed:=changed+1; END IF;
 END LOOP;
 IF batch.kind='invoices' AND batch.is_complete_snapshot AND batch.export_year IS NOT NULL AND batch.scope->>'includes_archived'='true' THEN
  UPDATE public.invoices i SET validity='review',review_reason='missing_from_snapshot'
   WHERE i.account_key=batch.account_key AND extract(year FROM i.invoice_date)=batch.export_year
    AND i.source_exported_at<=batch.exported_at AND i.validity NOT IN ('cancelled','replaced')
    AND NOT EXISTS(SELECT 1 FROM public.import_rows r WHERE r.batch_id=batch.id AND r.external_key=i.invoice_number);
  GET DIAGNOSTICS missing=ROW_COUNT;
 END IF;
 IF batch.kind='customers' THEN
  UPDATE public.invoices i SET external_customer_id=c.id FROM public.external_customers c
   WHERE c.account_key=batch.account_key AND i.account_key=c.account_key AND c.customer_number=i.customer_number AND i.external_customer_id IS NULL;
 END IF;
 IF batch.kind IN ('customers','products') THEN
  FOR inv_id IN SELECT id FROM public.invoices WHERE account_key=batch.account_key LOOP PERFORM certificates_private.refresh_allocations(inv_id); END LOOP;
 END IF;
 UPDATE public.import_batches SET status='applied',applied_at=clock_timestamp(),summary=summary||jsonb_build_object('changed',changed,'conflicts',conflicts,'missing',missing) WHERE id=batch.id RETURNING summary INTO d;
 RETURN jsonb_build_object('batch_id',batch.id,'status','applied','summary',d);
END $$;

CREATE OR REPLACE FUNCTION public.certificate_staff_command(p_actor uuid,p_command text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE account text:=coalesce(p_payload->>'account_key','papierkram'); batch_id uuid; row_value jsonb; entry jsonb; identifier uuid;
 person uuid; customer public.external_customers; inv public.invoices; related public.invoices; course public.courses; period public.participation_periods;
 target_course_id uuid; start_day date; end_day date; changed integer:=0; reason text;
BEGIN
 IF NOT certificates_private.verified_staff(p_actor) THEN RAISE EXCEPTION 'Verified staff required' USING ERRCODE='42501'; END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>12582912 THEN RAISE EXCEPTION 'Invalid command payload' USING ERRCODE='22023'; END IF;
 -- One reconciliation lock avoids customer/invoice/order races across all
 -- commands, including commands whose account is obtained from the target row.
 PERFORM pg_advisory_xact_lock(hashtextextended('certificate-reconciliation',0));
 PERFORM set_config('certificates.actor_id',p_actor::text,true);
 IF p_command='stage_import' THEN
  IF jsonb_typeof(p_payload->'rows')<>'array' OR jsonb_array_length(p_payload->'rows')>10000 THEN RAISE EXCEPTION 'Invalid import rows' USING ERRCODE='22023'; END IF;
  IF p_payload->>'expected_baseline' IS DISTINCT FROM certificates_private.account_baseline(account) THEN
   RAISE EXCEPTION 'Preview source changed; refresh before uploading' USING ERRCODE='40001';
  END IF;
  INSERT INTO public.import_batches(account_key,kind,filename,file_sha256,exported_at,scope,is_complete_snapshot,export_year,baseline_hash,summary,created_by)
  VALUES(account,p_payload->>'kind',p_payload->>'filename',p_payload->>'file_sha256',(p_payload->>'exported_at')::timestamptz,coalesce(p_payload->'scope','{}'),coalesce((p_payload->>'is_complete_snapshot')::boolean,false),nullif(p_payload->>'export_year','')::integer,certificates_private.account_baseline(account),coalesce(p_payload->'summary','{}'),p_actor) RETURNING id INTO batch_id;
  FOR row_value IN SELECT value FROM jsonb_array_elements(p_payload->'rows') LOOP
   INSERT INTO public.import_rows(batch_id,row_number,external_key,raw_data,normalized_data,disposition,issues)
   VALUES(batch_id,(row_value->>'row_number')::integer,row_value->>'external_key',coalesce(row_value->'raw_data','{}'),coalesce(row_value->'normalized_data','{}'),coalesce(row_value->>'disposition','new'),coalesce(row_value->'issues','[]'));
  END LOOP;
  RETURN jsonb_build_object('batch_id',batch_id,'status','preview','summary',coalesce(p_payload->'summary','{}'));
 ELSIF p_command='apply_import' THEN
  RETURN certificates_private.apply_rows((p_payload->>'batch_id')::uuid);
 ELSIF p_command='resolve_customer' THEN
  SELECT * INTO customer FROM public.external_customers WHERE id=(p_payload->>'id')::uuid FOR UPDATE;
  IF customer.id IS NULL THEN RAISE EXCEPTION 'Customer not found' USING ERRCODE='22023'; END IF;
  person:=nullif(p_payload->>'person_id','')::uuid;
  IF person IS NULL THEN
   IF nullif(btrim(p_payload->>'email'),'') IS NULL OR nullif(btrim(p_payload->>'display_name'),'') IS NULL THEN RAISE EXCEPTION 'Name and email required' USING ERRCODE='22023'; END IF;
   INSERT INTO public.people(display_name,email,phone,street,postal_code,city) VALUES(p_payload->>'display_name',lower(btrim(p_payload->>'email')),p_payload->>'phone',p_payload->>'street',p_payload->>'postal_code',p_payload->>'city') RETURNING id INTO person;
  END IF;
  IF customer.person_id IS NOT NULL AND customer.person_id<>person THEN RAISE EXCEPTION 'Existing customer mapping cannot be reassigned' USING ERRCODE='23514'; END IF;
  UPDATE public.external_customers SET person_id=person,review_status='resolved',review_reason=NULL WHERE id=customer.id;
  FOR identifier IN SELECT id FROM public.invoices WHERE external_customer_id=customer.id LOOP PERFORM certificates_private.refresh_allocations(identifier); END LOOP;
  RETURN jsonb_build_object('id',customer.id,'person_id',person);
 ELSIF p_command='map_product' THEN
  identifier:=(p_payload->>'id')::uuid;
  IF NOT EXISTS(SELECT 1 FROM public.external_products WHERE id=identifier) OR jsonb_typeof(p_payload->'course_ids')<>'array' OR jsonb_array_length(p_payload->'course_ids')=0 THEN RAISE EXCEPTION 'Product and courses required' USING ERRCODE='22023'; END IF;
  -- Correct an unused mapping; mappings with accounting history are retained.
  IF EXISTS(SELECT 1 FROM public.external_product_courses m WHERE m.product_id=identifier AND NOT (to_jsonb(m.course_id::text)<@(p_payload->'course_ids'))
    AND EXISTS(SELECT 1 FROM public.invoice_allocations a JOIN public.invoices i ON i.id=a.invoice_id JOIN public.external_products p ON p.id=m.product_id
     WHERE a.course_id=m.course_id AND i.account_key=p.account_key AND p.article_number=ANY(i.article_numbers))) THEN
   RAISE EXCEPTION 'A mapping with invoice history cannot be removed' USING ERRCODE='23514';
  END IF;
  DELETE FROM public.external_product_courses m WHERE m.product_id=identifier AND NOT (to_jsonb(m.course_id::text)<@(p_payload->'course_ids'));
  FOR target_course_id IN SELECT value::uuid FROM jsonb_array_elements_text(p_payload->'course_ids') LOOP
   SELECT * INTO course FROM public.courses WHERE id=target_course_id;
   IF course.id IS NULL THEN RAISE EXCEPTION 'Course not found' USING ERRCODE='22023'; END IF;
   INSERT INTO public.external_product_courses(product_id,course_id,certificate_title,certificate_description,schedule_snapshot)
   VALUES(identifier,course.id,coalesce(nullif(p_payload->>'title',''),course.title),coalesce(p_payload->>'description',course.description),
    coalesce((SELECT jsonb_agg(jsonb_build_object('weekday',s.weekday,'start_time',s.start_time,'end_time',s.end_time) ORDER BY s.weekday,s.start_time) FROM public.course_schedules s WHERE s.course_id=course.id),'[]'))
   ON CONFLICT(product_id,course_id) DO UPDATE SET certificate_title=excluded.certificate_title,certificate_description=excluded.certificate_description,schedule_snapshot=excluded.schedule_snapshot,version=external_product_courses.version+1;
  END LOOP;
  UPDATE public.external_products SET review_status='resolved',review_reason=NULL WHERE id=identifier;
  FOR batch_id IN SELECT i.id FROM public.invoices i JOIN public.external_products p ON p.account_key=i.account_key AND p.article_number=ANY(i.article_numbers) WHERE p.id=identifier LOOP PERFORM certificates_private.refresh_allocations(batch_id); END LOOP;
  RETURN jsonb_build_object('id',identifier);
 ELSIF p_command='resolve_invoice' THEN
  identifier:=(p_payload->>'id')::uuid;
  UPDATE public.invoices SET service_month=(p_payload->>'service_month')::date,service_month_source='manual',validity=p_payload->>'validity',review_reason=NULL WHERE id=identifier;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found' USING ERRCODE='22023'; END IF;
  PERFORM certificates_private.refresh_allocations(identifier);
  RETURN jsonb_build_object('id',identifier);
 ELSIF p_command='relate_invoice' THEN
  SELECT * INTO inv FROM public.invoices WHERE id=(p_payload->>'original')::uuid FOR UPDATE;
  SELECT * INTO related FROM public.invoices WHERE id=(p_payload->>'related')::uuid FOR UPDATE;
  reason:=p_payload->>'type';
  IF inv.id IS NULL OR related.id IS NULL OR inv.id=related.id OR inv.document_type<>'invoice' OR inv.account_key<>related.account_key OR inv.external_customer_id IS NULL OR inv.external_customer_id IS DISTINCT FROM related.external_customer_id OR inv.service_month IS NULL OR reason NOT IN ('cancels','replaces') THEN RAISE EXCEPTION 'Invalid invoice relation' USING ERRCODE='23514'; END IF;
  IF reason='replaces' AND (related.document_type<>'invoice' OR related.service_month IS DISTINCT FROM inv.service_month) THEN RAISE EXCEPTION 'Replacement must cover the same customer and month' USING ERRCODE='23514'; END IF;
  IF reason='cancels' AND related.document_type NOT IN ('cancellation','credit_note') THEN RAISE EXCEPTION 'Cancellation document required' USING ERRCODE='23514'; END IF;
  IF reason='cancels' AND related.service_month IS NOT NULL AND related.service_month<>inv.service_month THEN RAISE EXCEPTION 'Cancellation must cover the original service month' USING ERRCODE='23514'; END IF;
  IF reason='cancels' AND related.service_month IS NULL THEN
   UPDATE public.invoices SET service_month=inv.service_month,service_month_source='manual' WHERE id=related.id;
  END IF;
  INSERT INTO public.invoice_relations(original_invoice_id,related_invoice_id,relation_type,confirmed,confirmed_by,confirmed_at)
  VALUES(inv.id,related.id,reason,true,p_actor,clock_timestamp()) ON CONFLICT(original_invoice_id,related_invoice_id,relation_type) DO UPDATE SET confirmed=true,confirmed_by=p_actor,confirmed_at=clock_timestamp();
  UPDATE public.invoices SET validity=CASE WHEN reason='replaces' THEN 'replaced' ELSE 'cancelled' END,review_reason=NULL WHERE id=inv.id;
  IF reason='replaces' THEN
   INSERT INTO public.invoice_allocations(invoice_id,person_id,course_id,start_date,end_date,status,source,created_by)
   SELECT related.id,a.person_id,a.course_id,a.start_date,a.end_date,'confirmed','manual',p_actor FROM public.invoice_allocations a
    WHERE a.invoice_id=inv.id AND a.status='confirmed' AND EXISTS(SELECT 1 FROM public.external_products p JOIN public.external_product_courses m ON m.product_id=p.id WHERE p.account_key=related.account_key AND p.article_number=ANY(related.article_numbers) AND m.course_id=a.course_id)
   ON CONFLICT DO NOTHING;
   UPDATE public.invoice_allocations SET status='excluded' WHERE invoice_id=inv.id;
   PERFORM certificates_private.refresh_allocations(related.id);
  END IF;
  RETURN jsonb_build_object('id',inv.id,'related_id',related.id);
 ELSIF p_command='allocate' THEN
  SELECT * INTO inv FROM public.invoices WHERE id=(p_payload->>'invoice_id')::uuid FOR UPDATE;
  SELECT person_id INTO person FROM public.external_customers WHERE id=inv.external_customer_id AND review_status='resolved';
  target_course_id:=(p_payload->>'course_id')::uuid; start_day:=(p_payload->>'start')::date; end_day:=(p_payload->>'end')::date;
  IF inv.id IS NULL OR person IS NULL OR inv.document_type<>'invoice' OR (inv.validity IN ('cancelled','replaced') AND coalesce(p_payload->>'status','confirmed')<>'excluded') OR date_trunc('month',start_day)::date IS DISTINCT FROM inv.service_month OR date_trunc('month',end_day)::date IS DISTINCT FROM inv.service_month OR start_day>end_day
   OR NOT EXISTS(SELECT 1 FROM public.external_products p JOIN public.external_product_courses m ON m.product_id=p.id WHERE p.account_key=inv.account_key AND p.article_number=ANY(inv.article_numbers) AND p.review_status='resolved' AND m.course_id=target_course_id) THEN RAISE EXCEPTION 'Allocation does not match invoice/customer/course/month' USING ERRCODE='23514'; END IF;
  identifier:=nullif(p_payload->>'id','')::uuid;
  IF identifier IS NOT NULL THEN
   UPDATE public.invoice_allocations SET course_id=target_course_id,start_date=start_day,end_date=end_day,status=coalesce(p_payload->>'status','confirmed'),source='manual'
    WHERE id=identifier AND invoice_id=inv.id AND person_id=person;
   IF NOT FOUND THEN RAISE EXCEPTION 'Allocation not found' USING ERRCODE='22023'; END IF;
  ELSE
   INSERT INTO public.invoice_allocations(invoice_id,person_id,course_id,start_date,end_date,status,source,created_by)
   VALUES(inv.id,person,target_course_id,start_day,end_day,coalesce(p_payload->>'status','confirmed'),'manual',p_actor)
   ON CONFLICT(invoice_id,person_id,course_id,start_date,end_date) DO UPDATE SET status=excluded.status RETURNING id INTO identifier;
  END IF;
  PERFORM certificates_private.refresh_allocations(inv.id);
  RETURN jsonb_build_object('id',identifier,'person_id',person);
 ELSIF p_command='confirm_participation' THEN
  IF jsonb_typeof(p_payload->'periods')<>'array' OR jsonb_array_length(p_payload->'periods')>500 THEN RAISE EXCEPTION 'Invalid participation batch' USING ERRCODE='22023'; END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(p_payload->'periods') LOOP
   identifier:=nullif(entry->>'id','')::uuid; person:=(entry->>'person_id')::uuid; target_course_id:=(entry->>'course_id')::uuid; start_day:=(entry->>'start')::date; end_day:=(entry->>'end')::date;
   IF EXISTS(SELECT 1 FROM public.participation_periods p WHERE p.person_id=person AND p.course_id=target_course_id AND p.status<>'revoked' AND p.start_date<=end_day AND p.end_date>=start_day AND (identifier IS NULL OR p.id<>identifier)) THEN RAISE EXCEPTION 'Overlapping participation period' USING ERRCODE='23514'; END IF;
   IF identifier IS NOT NULL THEN
    SELECT * INTO period FROM public.participation_periods WHERE id=identifier FOR UPDATE;
    IF period.id IS NULL OR period.person_id<>person OR period.course_id<>target_course_id OR (entry->>'revision')::integer IS DISTINCT FROM period.revision THEN RAISE EXCEPTION 'Participation changed; refresh first' USING ERRCODE='40001'; END IF;
    UPDATE public.participation_periods SET start_date=start_day,end_date=end_day,status='confirmed',confirmed_by=p_actor,confirmed_at=clock_timestamp(),title_snapshot=entry->>'title',description_snapshot=coalesce(entry->>'description',''),schedule_snapshot=coalesce(entry->'schedule','[]') WHERE id=identifier;
   ELSE
    INSERT INTO public.participation_periods(person_id,course_id,start_date,end_date,status,confirmed_by,confirmed_at,title_snapshot,description_snapshot,schedule_snapshot)
    VALUES(person,target_course_id,start_day,end_day,'confirmed',p_actor,clock_timestamp(),entry->>'title',coalesce(entry->>'description',''),coalesce(entry->'schedule','[]'));
   END IF;
   changed:=changed+1;
  END LOOP;
  RETURN jsonb_build_object('confirmed_count',changed);
 ELSIF p_command='revoke_participation' THEN
  identifier:=(p_payload->>'id')::uuid; reason:=nullif(btrim(p_payload->>'reason'),'');
  IF reason IS NULL THEN RAISE EXCEPTION 'Revocation reason required' USING ERRCODE='22023'; END IF;
  UPDATE public.participation_periods SET status='revoked',note=reason
   WHERE id=identifier AND revision=(p_payload->>'revision')::integer;
  IF NOT FOUND THEN RAISE EXCEPTION 'Participation changed; refresh first' USING ERRCODE='40001'; END IF;
  RETURN jsonb_build_object('id',identifier);
 ELSIF p_command='revoke_issue' THEN
  identifier:=(p_payload->>'id')::uuid; reason:=nullif(btrim(p_payload->>'reason'),'');
  IF reason IS NULL THEN RAISE EXCEPTION 'Revocation reason required' USING ERRCODE='22023'; END IF;
  UPDATE public.certificate_issues SET status='revoked',revoked_at=clock_timestamp(),revoked_by=p_actor,revoked_reason=reason WHERE id=identifier AND status IN ('issued','revoked');
  IF NOT FOUND THEN RAISE EXCEPTION 'Issued certificate not found' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('id',identifier);
 END IF;
 RAISE EXCEPTION 'Unknown certificate command' USING ERRCODE='22023';
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA certificates_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA certificates_private TO service_role;
REVOKE ALL ON FUNCTION public.certificate_staff_command(uuid,text,jsonb),public.certificate_eligibility(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.certificate_staff_command(uuid,text,jsonb),public.certificate_eligibility(uuid) TO service_role;
NOTIFY pgrst,'reload schema';


-- Source: migrations/20260929170539_certificate_eligibility_guards.sql
-- Eligibility is a current calculation; a historical paid flag never grants
-- blanket permission for all courses, later obligations, or changed SKUs.
CREATE OR REPLACE FUNCTION public.certificate_import_baseline(p_account text DEFAULT 'papierkram') RETURNS text
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT certificates_private.account_baseline(p_account)
$$;
REVOKE ALL ON FUNCTION public.certificate_import_baseline(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.certificate_import_baseline(text) TO service_role;

CREATE OR REPLACE FUNCTION certificates_private.invoice_has_course(p_invoice uuid,p_course uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.invoices i
 JOIN public.external_products p ON p.account_key=i.account_key AND p.article_number=ANY(i.article_numbers)
 JOIN public.external_product_courses m ON m.product_id=p.id
 WHERE i.id=p_invoice AND p.review_status='resolved' AND m.course_id=p_course)
$$;

CREATE OR REPLACE FUNCTION certificates_private.valid_invoice_relation(p_related uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.invoice_relations r
 JOIN public.invoices original ON original.id=r.original_invoice_id
 JOIN public.invoices related ON related.id=r.related_invoice_id
 WHERE r.related_invoice_id=p_related AND r.confirmed AND original.document_type='invoice'
  AND original.account_key=related.account_key AND original.external_customer_id IS NOT NULL
  AND original.external_customer_id=related.external_customer_id AND original.service_month IS NOT NULL
  AND original.service_month=related.service_month
  AND ((r.relation_type='cancels' AND related.document_type IN ('cancellation','credit_note'))
    OR (r.relation_type='replaces' AND related.document_type='invoice')))
$$;

-- An explicit correction relationship confirms the current document identity
-- and charge. Payment-only updates remain valid; a changed customer, month,
-- document type, SKU or charge requires the teacher to confirm it again.
CREATE OR REPLACE FUNCTION certificates_private.invalidate_invoice_relations() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE affected uuid[];
BEGIN
 IF ROW(NEW.account_key,NEW.external_customer_id,NEW.customer_number,NEW.document_type,NEW.service_month,NEW.gross_amount,NEW.article_numbers)
  IS NOT DISTINCT FROM ROW(OLD.account_key,OLD.external_customer_id,OLD.customer_number,OLD.document_type,OLD.service_month,OLD.gross_amount,OLD.article_numbers) THEN RETURN NULL; END IF;
 SELECT array_agg(DISTINCT original_invoice_id) INTO affected FROM public.invoice_relations
 WHERE confirmed AND (original_invoice_id=NEW.id OR related_invoice_id=NEW.id);
 UPDATE public.invoice_relations SET confirmed=false,confirmed_at=NULL,confirmed_by=NULL
 WHERE confirmed AND (original_invoice_id=NEW.id OR related_invoice_id=NEW.id);
 UPDATE public.invoices SET validity='review',review_reason='invoice_relation_changed'
 WHERE id=ANY(affected) AND (validity<>'review' OR review_reason IS DISTINCT FROM 'invoice_relation_changed');
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS certificate_00_relation_invalidate ON public.invoices;
CREATE TRIGGER certificate_00_relation_invalidate AFTER UPDATE ON public.invoices
 FOR EACH ROW EXECUTE FUNCTION certificates_private.invalidate_invoice_relations();

CREATE OR REPLACE FUNCTION public.certificate_eligibility(p_person uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE period record; reason text; allocations jsonb; output jsonb:='[]';
BEGIN
 FOR period IN SELECT * FROM public.participation_periods WHERE person_id=p_person ORDER BY start_date,course_id,id LOOP
  reason:=NULL;
  IF period.status<>'confirmed' THEN reason:='participation_unconfirmed';
  ELSIF period.end_date>(current_timestamp AT TIME ZONE 'Europe/Berlin')::date THEN reason:='future_period';
  -- A cancellation-only partial export must not leave an older paid document
  -- usable until a teacher confirms which original it cancels. An unknown
  -- cancellation month is conservatively unresolved for this customer.
  ELSIF EXISTS(SELECT 1 FROM public.invoices i JOIN public.external_customers c ON c.id=i.external_customer_id
   WHERE c.person_id=p_person AND i.document_type IN ('cancellation','credit_note','unknown')
    AND (i.service_month IS NULL OR i.service_month=date_trunc('month',period.start_date)::date)
    AND NOT certificates_private.valid_invoice_relation(i.id))
   THEN reason:='cancellation_unresolved';
  ELSIF EXISTS(SELECT 1 FROM public.invoice_allocations a JOIN public.invoices i ON i.id=a.invoice_id
   LEFT JOIN public.external_customers c ON c.id=i.external_customer_id
   WHERE a.person_id=p_person AND a.course_id=period.course_id AND a.status<>'excluded'
    AND a.start_date<=period.end_date AND a.end_date>=period.start_date
    AND i.validity NOT IN ('cancelled','replaced')
    AND (a.status<>'confirmed' OR c.person_id IS DISTINCT FROM p_person OR c.review_status<>'resolved'
     OR i.service_month IS DISTINCT FROM date_trunc('month',period.start_date)::date
     OR i.review_reason IS NOT NULL OR i.validity<>'valid' OR i.document_type<>'invoice'
     OR NOT certificates_private.invoice_has_course(i.id,period.course_id))) THEN reason:='invoice_review';
  -- Also consider required invoices which have not been allocated yet. Leaving
  -- a new unpaid invoice unallocated cannot bypass the payment requirement.
  ELSIF EXISTS(SELECT 1 FROM public.invoices i JOIN public.external_customers c ON c.id=i.external_customer_id
   WHERE c.person_id=p_person AND i.document_type='invoice' AND i.validity NOT IN ('cancelled','replaced')
    AND (i.service_month IS NULL OR i.service_month=date_trunc('month',period.start_date)::date)
    AND (certificates_private.invoice_has_course(i.id,period.course_id)
     OR cardinality(i.article_numbers)=0 OR EXISTS(SELECT 1 FROM unnest(i.article_numbers) sku
      WHERE NOT EXISTS(SELECT 1 FROM public.external_products p JOIN public.external_product_courses m ON m.product_id=p.id
       WHERE p.account_key=i.account_key AND p.article_number=sku AND p.review_status='resolved')))
    AND (i.service_month IS NULL OR i.validity<>'valid' OR i.review_reason IS NOT NULL
     OR NOT EXISTS(SELECT 1 FROM public.invoice_allocations a WHERE a.invoice_id=i.id AND a.person_id=p_person
      AND a.course_id=period.course_id AND a.status='confirmed')))
   THEN reason:='invoice_review';
  ELSIF NOT EXISTS(SELECT 1 FROM public.invoice_allocations a JOIN public.invoices i ON i.id=a.invoice_id
   WHERE a.person_id=p_person AND a.course_id=period.course_id AND a.status='confirmed'
    AND a.start_date<=period.end_date AND a.end_date>=period.start_date
    AND i.document_type='invoice' AND i.validity='valid') THEN reason:='allocation_missing';
  ELSIF EXISTS(SELECT 1 FROM generate_series(period.start_date::timestamp,period.end_date::timestamp,interval '1 day') day
   WHERE NOT EXISTS(SELECT 1 FROM public.invoice_allocations a JOIN public.invoices i ON i.id=a.invoice_id
    WHERE a.person_id=p_person AND a.course_id=period.course_id AND a.status='confirmed'
     AND a.start_date<=day::date AND a.end_date>=day::date AND i.document_type='invoice' AND i.validity='valid'))
   THEN reason:='coverage_gap';
  ELSIF EXISTS(SELECT 1 FROM public.invoice_allocations a JOIN public.invoices i ON i.id=a.invoice_id
   WHERE a.person_id=p_person AND a.course_id=period.course_id AND a.status='confirmed'
    AND a.start_date<=period.end_date AND a.end_date>=period.start_date
    AND i.validity NOT IN ('cancelled','replaced')
    AND (i.payment_status NOT IN ('paid','overpaid') OR i.gross_amount<=0 OR i.paid_amount<0
     OR i.discount_amount<0 OR i.discount_amount>i.gross_amount OR i.paid_amount+i.discount_amount<i.gross_amount))
   THEN reason:='invoice_unpaid';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'invoice_id',i.id,'start_date',a.start_date,'end_date',a.end_date,
   'source_revision',a.source_revision,'invoice_revision',i.source_revision,'payment_status',i.payment_status,
   'validity',i.validity,'invoice_number',i.invoice_number) ORDER BY a.id),'[]') INTO allocations
  FROM public.invoice_allocations a JOIN public.invoices i ON i.id=a.invoice_id
  WHERE a.person_id=p_person AND a.course_id=period.course_id AND a.status='confirmed'
   AND a.start_date<=period.end_date AND a.end_date>=period.start_date
   AND i.document_type='invoice' AND i.validity NOT IN ('cancelled','replaced');
  output:=output||jsonb_build_array(to_jsonb(period)||jsonb_build_object('eligible',reason IS NULL,'reason',reason,'allocations',allocations));
 END LOOP;
 RETURN output;
END $$;

-- A new, as-yet unallocated cancellation or invoice was not among the stored
-- certificate sources. Re-evaluate existing issues for the affected customer.
CREATE OR REPLACE FUNCTION certificates_private.invalidate_customer_issues() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE person uuid; people uuid[]; issue record; eligibility jsonb; valid_period_ids uuid[];
BEGIN
 IF TG_OP='UPDATE' AND NEW.source_revision=OLD.source_revision THEN RETURN NULL; END IF;
 IF TG_OP='UPDATE' THEN
  SELECT array_agg(DISTINCT person_id) INTO people FROM public.external_customers WHERE id IN (OLD.external_customer_id,NEW.external_customer_id) AND person_id IS NOT NULL;
 ELSE
  SELECT array_agg(person_id) INTO people FROM public.external_customers WHERE id=NEW.external_customer_id AND person_id IS NOT NULL;
 END IF;
 FOREACH person IN ARRAY coalesce(people,'{}'::uuid[]) LOOP
 eligibility:=public.certificate_eligibility(person);
 SELECT coalesce(array_agg((x->>'id')::uuid),'{}'::uuid[]) INTO valid_period_ids
 FROM jsonb_array_elements(eligibility) x WHERE (x->>'eligible')::boolean;
 FOR issue IN SELECT i.id,i.status FROM public.certificate_issues i WHERE i.person_id=person AND i.status IN ('issued','generating')
  AND EXISTS(SELECT 1 FROM public.certificate_sources s WHERE s.issue_id=i.id AND NOT (s.participation_period_id=ANY(valid_period_ids))) LOOP
  UPDATE public.certificate_issues SET status=CASE WHEN issue.status='issued' THEN 'revoked' ELSE 'failed' END,
   revoked_at=CASE WHEN issue.status='issued' THEN clock_timestamp() ELSE revoked_at END,
   revoked_reason=CASE WHEN issue.status='issued' THEN 'Die Zahlungsgrundlage hat sich geändert.' ELSE revoked_reason END,
   failure_reason=CASE WHEN issue.status='generating' THEN 'source_changed' ELSE failure_reason END WHERE id=issue.id;
 END LOOP;
 END LOOP;
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS certificate_customer_invalidate ON public.invoices;
CREATE TRIGGER certificate_customer_invalidate AFTER INSERT OR UPDATE ON public.invoices
 FOR EACH ROW EXECUTE FUNCTION certificates_private.invalidate_customer_issues();

REVOKE ALL ON FUNCTION certificates_private.invoice_has_course(uuid,uuid),certificates_private.valid_invoice_relation(uuid),certificates_private.invalidate_invoice_relations(),certificates_private.invalidate_customer_issues() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION certificates_private.invoice_has_course(uuid,uuid),certificates_private.valid_invoice_relation(uuid),certificates_private.invalidate_invoice_relations(),certificates_private.invalidate_customer_issues() TO service_role;
REVOKE ALL ON FUNCTION public.certificate_eligibility(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.certificate_eligibility(uuid) TO service_role;
NOTIFY pgrst,'reload schema';


-- Source: migrations/20260929172325_certificate_pdf_issuance.sql
-- PDF issuance reserves an immutable snapshot before rendering, then verifies
-- all payment/attendance sources again after the private Storage upload.
CREATE OR REPLACE FUNCTION certificates_private.verified_person(p_actor uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT person.id FROM auth.users u JOIN public.profiles profile ON profile.id=u.id
 JOIN public.people person ON person.auth_user_id=profile.id
 WHERE u.id=p_actor AND u.email_confirmed_at IS NOT NULL AND nullif(btrim(u.email),'') IS NOT NULL
  AND NOT coalesce((to_jsonb(u)->>'is_anonymous')::boolean,false)
$$;
REVOKE ALL ON FUNCTION certificates_private.verified_person(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION certificates_private.verified_person(uuid) TO service_role;

CREATE OR REPLACE FUNCTION certificates_private.issue_sources_current(p_issue uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE issue public.certificate_issues; current_periods jsonb; snapshot_period jsonb; current_period jsonb;
BEGIN
 SELECT * INTO issue FROM public.certificate_issues WHERE id=p_issue;
 IF issue.id IS NULL OR jsonb_typeof(issue.snapshot->'periods') IS DISTINCT FROM 'array'
  OR jsonb_array_length(issue.snapshot->'periods')=0 THEN RETURN false; END IF;
 current_periods:=public.certificate_eligibility(issue.person_id);
 FOR snapshot_period IN SELECT value FROM jsonb_array_elements(issue.snapshot->'periods') LOOP
  SELECT value INTO current_period FROM jsonb_array_elements(current_periods)
   WHERE value->>'id'=snapshot_period->>'id';
  IF current_period IS NULL OR NOT (current_period->>'eligible')::boolean
   OR (current_period->>'revision')::integer IS DISTINCT FROM (snapshot_period->>'revision')::integer
   OR (current_period->>'source_revision')::integer IS DISTINCT FROM (snapshot_period->>'source_revision')::integer
   OR current_period->'allocations' IS DISTINCT FROM snapshot_period->'allocations' THEN RETURN false; END IF;
 END LOOP;
 IF (SELECT count(DISTINCT participation_period_id) FROM public.certificate_sources WHERE issue_id=issue.id)
  <>jsonb_array_length(issue.snapshot->'periods') THEN RETURN false; END IF;
 RETURN NOT EXISTS(SELECT 1 FROM public.certificate_sources s
  JOIN public.participation_periods p ON p.id=s.participation_period_id
  JOIN public.invoice_allocations a ON a.id=s.invoice_allocation_id
  JOIN public.invoices i ON i.id=a.invoice_id
  WHERE s.issue_id=issue.id AND (p.person_id<>issue.person_id OR a.person_id<>issue.person_id OR a.course_id<>p.course_id
   OR s.source_revision<>p.source_revision OR s.participation_revision<>p.revision
   OR s.invoice_revision<>i.source_revision OR s.allocation_revision<>a.source_revision));
END $$;

CREATE OR REPLACE FUNCTION public.certificate_issue_command(p_actor uuid,p_command text,p_payload jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE person uuid; person_row public.people; selected_month date; periods jsonb; snapshot_data jsonb;
 issue public.certificate_issues; period jsonb; allocation jsonb; identifier uuid; today date; digest text;
BEGIN
 person:=certificates_private.verified_person(p_actor);
 IF person IS NULL THEN RAISE EXCEPTION 'Verified certificate owner required' USING ERRCODE='42501'; END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>8192 THEN RAISE EXCEPTION 'Invalid certificate request' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('certificate-reconciliation',0));
 PERFORM set_config('certificates.actor_id',p_actor::text,true);
 -- Lock the persisted business identity while taking its contact snapshot.
 SELECT * INTO person_row FROM public.people WHERE id=person AND auth_user_id=p_actor FOR SHARE;
 IF person_row.id IS NULL THEN RAISE EXCEPTION 'Certificate owner changed' USING ERRCODE='42501'; END IF;
 today:=(clock_timestamp() AT TIME ZONE 'Europe/Berlin')::date;
 IF p_command='reserve' THEN
  selected_month:=nullif(p_payload->>'month','')::date;
  IF selected_month IS NOT NULL AND extract(day FROM selected_month)<>1 THEN RAISE EXCEPTION 'Choose a calendar month' USING ERRCODE='22023'; END IF;
  SELECT coalesce(jsonb_agg(value ORDER BY value->>'start_date',value->>'course_id',value->>'id'),'[]') INTO periods
   FROM jsonb_array_elements(public.certificate_eligibility(person))
   WHERE (value->>'eligible')::boolean AND (selected_month IS NULL OR date_trunc('month',(value->>'start_date')::date)::date=selected_month);
  IF jsonb_array_length(periods)=0 THEN RETURN jsonb_build_object('error','conflict','message','Für diese Auswahl stehen keine bestätigten und bezahlten Teilnahmezeiträume zur Verfügung.'); END IF;
  IF jsonb_array_length(periods)>600 THEN RETURN jsonb_build_object('error','invalid_input','message','Bitte einen einzelnen Monat auswählen.'); END IF;
  snapshot_data:=jsonb_build_object('person',jsonb_build_object('display_name',person_row.display_name,'street',person_row.street,'postal_code',person_row.postal_code,'city',person_row.city),
   'periods',periods,'date',today);
  UPDATE public.certificate_issues SET status='failed',failure_reason='generation_expired'
   WHERE status='generating' AND created_at<clock_timestamp()-interval '10 minutes';
  SELECT * INTO issue FROM public.certificate_issues i WHERE i.person_id=person AND i.requested_month IS NOT DISTINCT FROM selected_month
   AND i.template_version='1' AND i.snapshot=snapshot_data AND i.status='issued' ORDER BY i.issued_at DESC LIMIT 1 FOR UPDATE;
  IF issue.id IS NOT NULL AND certificates_private.issue_sources_current(issue.id) THEN RETURN to_jsonb(issue); END IF;
  IF EXISTS(SELECT 1 FROM public.certificate_issues i WHERE i.person_id=person AND i.status='generating') THEN
   RETURN jsonb_build_object('error','conflict','message','Die Bescheinigung wird bereits erstellt. Bitte kurz warten und erneut versuchen.');
  END IF;
  IF (SELECT count(*) FROM public.certificate_issues WHERE status='generating')>=3 THEN
   RETURN jsonb_build_object('error','conflict','message','Aktuell werden mehrere Bescheinigungen erstellt. Bitte kurz warten und erneut versuchen.');
  END IF;
  identifier:=gen_random_uuid();
  INSERT INTO public.certificate_issues(id,person_id,certificate_number,requested_month,snapshot,template_version,storage_path,requested_by)
   VALUES(identifier,person,'SA-'||extract(year FROM today)::text||'-'||upper(replace(identifier::text,'-','')),selected_month,snapshot_data,'1',person::text||'/'||identifier::text||'.pdf',p_actor)
   RETURNING * INTO issue;
  FOR period IN SELECT value FROM jsonb_array_elements(periods) LOOP
   FOR allocation IN SELECT value FROM jsonb_array_elements(period->'allocations') LOOP
    INSERT INTO public.certificate_sources(issue_id,participation_period_id,invoice_allocation_id,source_revision,participation_revision,invoice_revision,allocation_revision,snapshot)
    VALUES(issue.id,(period->>'id')::uuid,(allocation->>'id')::uuid,(period->>'source_revision')::integer,(period->>'revision')::integer,
     (allocation->>'invoice_revision')::integer,(allocation->>'source_revision')::integer,jsonb_build_object('period',period,'allocation',allocation));
   END LOOP;
  END LOOP;
  RETURN to_jsonb(issue);
 END IF;
 identifier:=nullif(p_payload->>'id','')::uuid;
 SELECT * INTO issue FROM public.certificate_issues WHERE id=identifier AND person_id=person FOR UPDATE;
 IF issue.id IS NULL THEN RAISE EXCEPTION 'Certificate not available' USING ERRCODE='42501'; END IF;
 IF p_command='fail' THEN
  UPDATE public.certificate_issues SET status='failed',failure_reason='pdf_generation_failed' WHERE id=issue.id AND status='generating' RETURNING * INTO issue;
  IF issue.id IS NULL THEN SELECT * INTO issue FROM public.certificate_issues WHERE id=identifier AND person_id=person; END IF;
  RETURN to_jsonb(issue);
 ELSIF p_command IN ('finalize','download') THEN
  IF (p_command='finalize' AND issue.status NOT IN ('generating','issued')) OR (p_command='download' AND issue.status<>'issued') THEN
   RETURN jsonb_build_object('error','conflict','message','Diese Bescheinigung ist nicht mehr verfügbar. Bitte eine neue Bescheinigung erstellen.');
  END IF;
  IF NOT certificates_private.issue_sources_current(issue.id) THEN
   UPDATE public.certificate_issues SET status=CASE WHEN status='issued' THEN 'revoked' ELSE 'failed' END,
    revoked_at=CASE WHEN status='issued' THEN clock_timestamp() ELSE revoked_at END,
    revoked_reason=CASE WHEN status='issued' THEN 'Die zugrunde liegenden Teilnahme- oder Rechnungsdaten wurden geändert.' ELSE revoked_reason END,
    failure_reason=CASE WHEN status='generating' THEN 'source_changed' ELSE failure_reason END
    WHERE id=issue.id;
   RETURN jsonb_build_object('error','conflict','message','Die zugrunde liegenden Daten wurden geändert. Bitte eine neue Bescheinigung erstellen.');
  END IF;
  IF p_command='download' THEN RETURN to_jsonb(issue); END IF;
  digest:=p_payload->>'pdf_sha256';
  IF digest IS NULL OR digest !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid PDF digest' USING ERRCODE='22023'; END IF;
  IF issue.status='issued' THEN
   IF issue.pdf_sha256<>digest THEN RETURN jsonb_build_object('error','conflict','message','Die gespeicherte Datei stimmt nicht mit dieser Bescheinigung überein.'); END IF;
   RETURN to_jsonb(issue);
  END IF;
  IF issue.created_at<clock_timestamp()-interval '10 minutes' THEN
   UPDATE public.certificate_issues SET status='failed',failure_reason='generation_expired' WHERE id=issue.id;
   RETURN jsonb_build_object('error','conflict','message','Die Erstellung ist abgelaufen. Bitte erneut versuchen.');
  END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='certificates' AND o.name=issue.storage_path
   AND o.metadata->>'mimetype'='application/pdf' AND (o.metadata->>'size')::numeric BETWEEN 1 AND 10485760
   AND o.user_metadata->>'issue_id'=issue.id::text AND o.user_metadata->>'sha256'=digest) THEN
   UPDATE public.certificate_issues SET status='failed',failure_reason='storage_upload_missing' WHERE id=issue.id;
   RETURN jsonb_build_object('error','conflict','message','Die PDF-Datei wurde nicht vollständig gespeichert. Bitte erneut versuchen.');
  END IF;
  UPDATE public.certificate_issues SET status='issued',pdf_sha256=digest,issued_at=clock_timestamp() WHERE id=issue.id RETURNING * INTO issue;
  RETURN to_jsonb(issue);
 END IF;
 RAISE EXCEPTION 'Unknown certificate command' USING ERRCODE='22023';
END $$;

REVOKE ALL ON FUNCTION certificates_private.issue_sources_current(uuid),public.certificate_issue_command(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION certificates_private.issue_sources_current(uuid),public.certificate_issue_command(uuid,text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';


-- Consolidated correction: 52_independent_trainer_analytics.sql
-- Trainer levels are independent from commercial courses and registrations.
-- Additive/non-destructive: preserve every course, grant, receipt and progress row.
-- Apply through the normal backup-backed migration runner, before the new app.

ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_level_fkey;
COMMENT ON COLUMN public.courses.level IS 'Legacy course audience metadata. It does not assign a trainer level or grant learning access.';
COMMENT ON TABLE public.student_level_access IS 'Explicit trainer-level entitlements; independent from course bookings and course audience metadata.';

CREATE OR REPLACE FUNCTION public.get_student_learning_analytics(p_student_id uuid, p_level text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
 percentages jsonb;
 distribution jsonb;
 history jsonb;
 today date := (now() AT TIME ZONE 'Europe/Berlin')::date;
BEGIN
 IF NOT business_private.is_staff() THEN
  RETURN jsonb_build_object('error','not_authorized','message','Staff access required.');
 END IF;
 IF p_student_id IS NULL THEN
  RETURN jsonb_build_object('error','invalid_input','message','A student is required.');
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_student_id AND role='student') THEN
  RETURN jsonb_build_object('error','not_found','message','Student not found.');
 END IF;
 IF p_level IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.learning_levels WHERE code=p_level) THEN
  RETURN jsonb_build_object('error','not_found','message','Trainer level not found.');
 END IF;
 percentages := public.get_all_students_progress_data();
 IF percentages ? 'error' THEN RETURN percentages; END IF;

 -- A word is learned only when both directions reached box 7. Incomplete
 -- direction pairs retain their lowest active phase, as in the student UI.
 WITH cards AS (
  SELECT c.id, CASE WHEN count(p.id)=0 THEN NULL
   WHEN count(p.id)=2 AND bool_and(p.box_number=7) THEN 7
   ELSE least(6,min(p.box_number)) END AS phase
  FROM public.learning_vocabulary_cards c
  JOIN public.learning_units u ON u.id=c.unit_id
  LEFT JOIN public.vocabulary_direction_progress p ON p.card_id=c.id AND p.auth_user_id=p_student_id
  WHERE p_level IS NULL OR u.level=p_level
  GROUP BY c.id
 ), buckets AS (
  SELECT phase_number, count(c.id) AS count
  FROM generate_series(1,7) phase_number LEFT JOIN cards c ON c.phase=phase_number
  GROUP BY phase_number
 ) SELECT jsonb_build_object(
  'buckets',(SELECT jsonb_agg(jsonb_build_object('key',CASE WHEN phase_number=7 THEN to_jsonb('learned'::text) ELSE to_jsonb(phase_number) END,'count',count) ORDER BY phase_number) FROM buckets),
  'totalCards',count(*),'totalInBox',count(phase),
  'overallPercent',CASE WHEN count(*)=0 THEN 0 ELSE round(coalesce(sum(phase),0)::numeric/(count(*)*7)*100) END
 ) INTO distribution FROM cards;

 -- Receipts are actual persisted answer events; never infer old phases from
 -- updated_at or generate synthetic progress snapshots. Grade from response,
 -- not the obsolete, client-supplied is_correct receipt field (R5).
 WITH days AS (SELECT today-29+n AS day FROM generate_series(0,29) n),
 events AS (
  SELECT (r.created_at AT TIME ZONE 'Europe/Berlin')::date AS day,
   count(*) AS answers, count(*) FILTER(WHERE r.response->>'isCorrect'='true') AS correct
  FROM vocabulary_private.answer_receipts r
  JOIN public.vocabulary_direction_progress p ON p.id=r.progress_id AND p.auth_user_id=r.auth_user_id
  JOIN public.learning_vocabulary_cards c ON c.id=p.card_id
  JOIN public.learning_units u ON u.id=c.unit_id
  WHERE r.auth_user_id=p_student_id
   AND r.created_at>=((today-29)::timestamp AT TIME ZONE 'Europe/Berlin')
   AND r.created_at<((today+1)::timestamp AT TIME ZONE 'Europe/Berlin')
   AND (p_level IS NULL OR u.level=p_level)
  GROUP BY (r.created_at AT TIME ZONE 'Europe/Berlin')::date
 ) SELECT jsonb_agg(jsonb_build_object('date',d.day,'answers',coalesce(e.answers,0),'correct',coalesce(e.correct,0)) ORDER BY d.day)
 INTO history FROM days d LEFT JOIN events e USING(day);

 RETURN jsonb_build_object('studentId',p_student_id,'level',p_level,
  'completionByLevel',coalesce(percentages->p_student_id::text,'{}'::jsonb),
  'distribution',distribution,'history',history,'timezone','Europe/Berlin');
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('error','request_failed','message','Learning analytics could not be loaded.','sqlstate',SQLSTATE);
END $$;
REVOKE EXECUTE ON FUNCTION public.get_student_learning_analytics(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_student_learning_analytics(uuid,text) TO authenticated;


-- Keep the old signature callable during rolling upgrades, but reject a course
-- filter: a course UUID can never establish ownership of trainer progress.
-- No-argument get_all_students_progress_data() remains unchanged.
CREATE OR REPLACE FUNCTION public.get_all_students_progress_data(p_student_id uuid, p_course_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO '' AS $$
BEGIN
 IF NOT business_private.is_staff() THEN
  RETURN jsonb_build_object('error','not_authorized','message','Staff access required.');
 END IF;
 IF p_course_id IS NOT NULL THEN
  RETURN jsonb_build_object('error','invalid_input','message','Select an independent trainer level instead of a course.');
 END IF;
 RETURN public.get_student_learning_analytics(p_student_id,NULL) || jsonb_build_object('courseId',NULL);
END $$;
REVOKE EXECUTE ON FUNCTION public.get_all_students_progress_data(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_all_students_progress_data(uuid,uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';


-- Consolidated correction: 53_course_cancellation_billing.sql
-- Additive calendar correction. Preserve booking IDs, user/learning records and
-- issued invoice snapshots. Run in the migration runner's transaction.
ALTER TABLE public.booking_items ADD COLUMN IF NOT EXISTS calendar_snapshot jsonb;
ALTER TABLE public.invoice_cases ADD COLUMN IF NOT EXISTS calendar_adjustment_amount numeric(10,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION business_private.course_calendar_snapshot(p_course uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('category',c.category,'start_date',c.start_date,'end_date',c.end_date,
  'schedules',coalesce((SELECT jsonb_agg(jsonb_build_object('weekday',s.weekday,'start_time',s.start_time,'end_time',s.end_time)
   ORDER BY s.weekday,s.start_time,s.id) FROM public.course_schedules s WHERE s.course_id=c.id),'[]'::jsonb))
 FROM public.courses c WHERE c.id=p_course;
$$;
REVOKE ALL ON FUNCTION business_private.course_calendar_snapshot(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION business_private.course_calendar_snapshot(uuid) TO service_role;

-- Existing bookings retain their prices and quantities; only missing timetable
-- metadata is copied from their current course. No source rows are removed.
UPDATE public.booking_items i SET calendar_snapshot=business_private.course_calendar_snapshot(i.course_id)
 WHERE i.calendar_snapshot IS NULL;
ALTER TABLE public.booking_items ALTER COLUMN calendar_snapshot SET NOT NULL;
-- The INSERT trigger replaces this placeholder with the course timetable.
ALTER TABLE public.booking_items ALTER COLUMN calendar_snapshot SET DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.booking_items.calendar_snapshot IS 'Timetable and course date bounds at booking time. Cancellations use this snapshot plus the original unit price/minutes.';
COMMENT ON COLUMN public.invoice_cases.calendar_adjustment_amount IS 'Current calendar total minus issued booking total. A nonzero value requires an external invoice correction; the issued snapshot is preserved.';

CREATE OR REPLACE FUNCTION business_private.snapshot_booking_calendar() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 NEW.calendar_snapshot:=business_private.course_calendar_snapshot(NEW.course_id);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION business_private.snapshot_booking_calendar() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS booking_calendar_snapshot ON public.booking_items;
CREATE TRIGGER booking_calendar_snapshot BEFORE INSERT ON public.booking_items
 FOR EACH ROW EXECUTE FUNCTION business_private.snapshot_booking_calendar();

CREATE OR REPLACE FUNCTION business_private.booking_item_calendar_quote(p_item uuid) RETURNS TABLE(units numeric,amount numeric)
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT CASE WHEN b.kind='trial' THEN 0 WHEN i.calendar_snapshot->>'category'='private' THEN i.units ELSE calendar.units END,
  CASE WHEN b.kind='trial' THEN 0 WHEN i.calendar_snapshot->>'category'='private' THEN i.amount ELSE round(calendar.units*i.unit_price,2) END
 FROM public.booking_items i JOIN public.bookings b ON b.id=i.booking_id CROSS JOIN LATERAL (
  SELECT coalesce(sum(extract(epoch FROM (s.end_time-s.start_time))/60/i.unit_minutes),0) units
  FROM jsonb_to_recordset(i.calendar_snapshot->'schedules') AS s(weekday integer,start_time time,end_time time)
  CROSS JOIN LATERAL generate_series(b.start_date::timestamp,(b.target_month+interval '1 month - 1 day')::timestamp,interval '1 day') day
  WHERE extract(isodow FROM day)=s.weekday
   AND (nullif(i.calendar_snapshot->>'start_date','') IS NULL OR day::date>=(i.calendar_snapshot->>'start_date')::date)
   AND (nullif(i.calendar_snapshot->>'end_date','') IS NULL OR day::date<=(i.calendar_snapshot->>'end_date')::date)
   AND NOT EXISTS(SELECT 1 FROM public.course_exceptions e WHERE e.date=day::date AND (e.course_id IS NULL OR e.course_id=i.course_id))
 ) calendar WHERE i.id=p_item;
$$;
REVOKE ALL ON FUNCTION business_private.booking_item_calendar_quote(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION business_private.booking_item_calendar_quote(uuid) TO service_role;

CREATE OR REPLACE FUNCTION business_private.refresh_booking_calendar(p_booking uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings; issued boolean; adjustment numeric:=0; changed integer;
BEGIN
 SELECT * INTO b FROM public.bookings WHERE id=p_booking FOR UPDATE;
 IF b.id IS NULL OR b.kind='trial' OR b.status NOT IN ('pending','confirmed') THEN RETURN; END IF;
 SELECT EXISTS(SELECT 1 FROM public.invoice_cases x WHERE x.booking_id=b.id AND x.status='created') INTO issued;
 IF issued THEN
  SELECT coalesce(sum(q.amount-i.amount),0) INTO adjustment FROM public.booking_items i
   CROSS JOIN LATERAL business_private.booking_item_calendar_quote(i.id) q WHERE i.booking_id=b.id;
 ELSE
  WITH recalculated AS (
   SELECT i.id,q.units,q.amount FROM public.booking_items i
    CROSS JOIN LATERAL business_private.booking_item_calendar_quote(i.id) q WHERE i.booking_id=b.id
  ) UPDATE public.booking_items i SET units=q.units,amount=q.amount FROM recalculated q
   WHERE i.id=q.id AND (i.units IS DISTINCT FROM q.units::numeric(10,3) OR i.amount IS DISTINCT FROM q.amount);
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed>0 THEN UPDATE public.bookings SET revision=revision+1,updated_at=now() WHERE id=b.id; END IF;
 END IF;
 UPDATE public.invoice_cases SET calendar_adjustment_amount=adjustment,updated_at=now()
  WHERE booking_id=b.id AND calendar_adjustment_amount IS DISTINCT FROM adjustment;
END $$;
REVOKE ALL ON FUNCTION business_private.refresh_booking_calendar(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION business_private.refresh_booking_calendar(uuid) TO service_role;

CREATE OR REPLACE FUNCTION business_private.refresh_exception_bookings() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_day date;new_day date;old_course uuid;new_course uuid;booking uuid;
BEGIN
 IF TG_OP<>'INSERT' THEN old_day:=OLD.date;old_course:=OLD.course_id; END IF;
 IF TG_OP<>'DELETE' THEN new_day:=NEW.date;new_course:=NEW.course_id; END IF;
 -- A reason edit has no financial effect. Changing/removing an exception must
 -- refresh both the original and replacement date/course.
 IF TG_OP='UPDATE' AND old_day=new_day AND old_course IS NOT DISTINCT FROM new_course THEN RETURN NULL; END IF;
 FOR booking IN SELECT b.id FROM public.bookings b WHERE b.status IN ('pending','confirmed') AND b.kind<>'trial'
  AND EXISTS(SELECT 1 FROM public.booking_items i WHERE i.booking_id=b.id AND (
   (old_day>=b.start_date AND old_day<(b.target_month+interval '1 month')::date AND (old_course IS NULL OR i.course_id=old_course))
   OR (new_day>=b.start_date AND new_day<(b.target_month+interval '1 month')::date AND (new_course IS NULL OR i.course_id=new_course))))
  ORDER BY b.id FOR UPDATE
 LOOP PERFORM business_private.refresh_booking_calendar(booking); END LOOP;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION business_private.refresh_exception_bookings() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS course_exception_billing ON public.course_exceptions;
CREATE TRIGGER course_exception_billing AFTER INSERT OR UPDATE OR DELETE ON public.course_exceptions
 FOR EACH ROW EXECUTE FUNCTION business_private.refresh_exception_bookings();

-- Keep the current confirmation/mail and month-continuation behavior intact.
-- Refresh open snapshots before confirmation and when loading an existing month.
DO $patch$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('business_private.confirm_booking(uuid)'::regprocedure) INTO definition;
 IF position('business_private.refresh_booking_calendar' IN definition)=0 THEN
  IF position('if b.status=''confirmed'' then return;end if;' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected confirm_booking definition'; END IF;
  definition:=replace(definition,'if b.status=''confirmed'' then return;end if;',
   'perform business_private.refresh_booking_calendar(b.id);'||E'\n if b.status=''confirmed'' then return;end if;');
  EXECUTE definition;
 END IF;
 SELECT pg_get_functiondef('business_private.prepare_month(date)'::regprocedure) INTO definition;
 IF position('business_private.refresh_booking_calendar' IN definition)=0 THEN
  IF position('for p in select * from public.people order by id for update loop' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected prepare_month definition'; END IF;
  definition:=replace(definition,'for p in select * from public.people order by id for update loop',
   'for p in select * from public.people order by id for update loop'||E'\n  perform business_private.refresh_booking_calendar(id) from public.bookings where person_id=p.id and target_month=p_month order by id;');
  EXECUTE definition;
 END IF;
END $patch$;

CREATE OR REPLACE FUNCTION business_private.mark_invoice(p_booking uuid,p_month date,p_created boolean,p_reference text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bookings;
BEGIN
 IF NOT business_private.is_staff() THEN RAISE insufficient_privilege; END IF;
 SELECT * INTO STRICT b FROM public.bookings WHERE id=p_booking FOR UPDATE;
 IF p_created IS NULL OR p_month IS NULL OR b.target_month<>p_month OR b.kind='trial' OR (p_created AND b.status<>'confirmed') OR length(coalesce(p_reference,''))>120 THEN RAISE check_violation; END IF;
 PERFORM business_private.refresh_booking_calendar(b.id);
 INSERT INTO public.invoice_cases(person_id,target_month,booking_id) VALUES(b.person_id,b.target_month,b.id) ON CONFLICT(person_id,target_month) DO NOTHING;
 UPDATE public.invoice_cases SET status=(CASE WHEN p_created THEN 'created' ELSE 'outstanding' END)::public.invoice_status,
  invoice_reference=nullif(btrim(p_reference),''),invoice_created_at=CASE WHEN p_created THEN coalesce(invoice_created_at,now()) ELSE NULL END,
  created_by=auth.uid(),updated_at=now() WHERE person_id=b.person_id AND target_month=p_month;
 -- Reopening permits a corrected invoice; the original values were retained
 -- until the staff member explicitly reopened the accounting case.
 IF NOT p_created THEN PERFORM business_private.refresh_booking_calendar(b.id); END IF;
END $$;

-- Repair already stored open cases on deployment and surface required invoice
-- corrections. Amounts for created invoices stay byte-for-byte unchanged.
DO $repair$
DECLARE booking uuid;
BEGIN
 FOR booking IN SELECT id FROM public.bookings WHERE status IN ('pending','confirmed') AND kind<>'trial' ORDER BY id
 LOOP PERFORM business_private.refresh_booking_calendar(booking); END LOOP;
END $repair$;

NOTIFY pgrst,'reload schema';


-- Consolidated correction: 54_learning_progress_focus.sql
-- Master 4 / Phase 11.3: Lernanalyse je Lernmodus und Problemwörter-Training.
-- Backup with migrate-local.py before applying. Requires 38, 39, 42 and 52.
-- Rollback: supabase/vps/rollback/54_learning_progress_focus.sql.
--
-- Rein additiv (Live-Kundendaten): neue Tabellen, neue Funktionen und zwei neue
-- Trigger. Kein bestehender Datensatz wird geändert oder gelöscht; die
-- Rückschau der Problemwörter liest nur vorhandene Fehlerzähler und Quittungen.
--
--   * learning_media_views: welches Medium (Video, Link, Unterlage) jemand an
--     welchem Berliner Kalendertag geöffnet hat. Bisher wurde das nirgends
--     gespeichert; die Mediathek-Kurve beginnt deshalb mit dieser Migration.
--   * vocabulary_focus_words: Problemwörter je Person — Wörter, die im
--     Vokabeltrainer wiederholt falsch waren, und Nomen, deren Artikel
--     wiederholt fehlte oder falsch war. Sie werden getrennt von der Lernbox
--     gespeichert und mit eigener Wiederholungsleiter trainiert (0 → 1 Tag →
--     3 Tage → 7 Tage → gemeistert). Die Lernbox (Leitner) bleibt unberührt.
--   * vocabulary_private.focus_receipts: jede Antwort im Problemwörter-Training
--     (idempotent über request_id) — Grundlage der Kurve „Problemwörter".
--   * get_learning_progress(): eine Auswertung für Lehrkraft und Lernende
--     (nur die eigene Person) mit Tageswerten je Modus, Gesamtständen und
--     Problemwörtern. Keine erfundenen Rückblicke: jeder Tageswert stammt aus
--     einer gespeicherten Antwort, Aufnahme oder Medien-Öffnung.

-- ── 1. Angeschaute Medien ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.learning_media_views(
 auth_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 day date NOT NULL,
 kind text NOT NULL CHECK(kind IN('video','link','presentation')),
 object_id uuid NOT NULL,
 level text NOT NULL,
 first_viewed_at timestamptz NOT NULL DEFAULT now(),
 last_viewed_at timestamptz NOT NULL DEFAULT now(),
 view_count integer NOT NULL DEFAULT 1 CHECK(view_count>0),
 PRIMARY KEY(auth_user_id,day,kind,object_id));
CREATE INDEX IF NOT EXISTS learning_media_views_object_idx ON public.learning_media_views(auth_user_id,kind,object_id);
COMMENT ON TABLE public.learning_media_views IS 'One row per learner, Berlin day and opened media object (Phase 11.3). Written only by record_media_view(); media rows may be deleted later, the view history stays.';
ALTER TABLE public.learning_media_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS learning_media_views_read ON public.learning_media_views;
CREATE POLICY learning_media_views_read ON public.learning_media_views FOR SELECT TO authenticated
 USING(auth_user_id=(SELECT auth.uid()) OR (SELECT business_private.is_staff()));
REVOKE ALL ON public.learning_media_views FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.learning_media_views TO authenticated;
GRANT ALL ON public.learning_media_views TO service_role;

-- Dieselben Leserechte wie die Mediathek (RLS von learning_videos und
-- lms_presentation_asset). Lehrkräfte öffnen Medien zur Kontrolle: nicht zählen.
CREATE OR REPLACE FUNCTION public.record_media_view(p_kind text,p_object_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); v_kind text; v_level text;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated','message','Authentication is required.'); END IF;
 IF p_kind IS NULL OR p_kind NOT IN('video','presentation') OR p_object_id IS NULL THEN
  RETURN jsonb_build_object('error','invalid_input','message','The request contains invalid data.'); END IF;
 IF coalesce(identity_private.current_profile_role(),'') IN('teacher','admin') THEN
  RETURN jsonb_build_object('success',true,'recorded',false); END IF;
 IF p_kind='video' THEN
  SELECT CASE WHEN v.storage_path IS NULL THEN 'link' ELSE 'video' END,u.level INTO v_kind,v_level
  FROM public.learning_videos v JOIN public.learning_units u ON u.id=v.unit_id
  WHERE v.id=p_object_id
   AND ((v.storage_path IS NOT NULL AND v.unit_id=ANY(media_private.published_video_unit_ids()))
    OR (v.storage_path IS NULL AND learning_private.unit_allowed(v.unit_id)))
   AND (v.folder_id IS NULL OR media_private.folder_allowed(v.folder_id));
 ELSE
  SELECT 'presentation',f.level INTO v_kind,v_level
  FROM public.lms_presentation_asset a JOIN public.lms_media_folder f ON f.folder_id=a.folder_id
  WHERE a.asset_id=p_object_id AND media_private.folder_allowed(a.folder_id);
 END IF;
 IF v_kind IS NULL THEN RETURN jsonb_build_object('error','not_found','message','Media not found.'); END IF;
 INSERT INTO public.learning_media_views AS m(auth_user_id,day,kind,object_id,level)
 VALUES(actor,(now() AT TIME ZONE 'Europe/Berlin')::date,v_kind,p_object_id,v_level)
 ON CONFLICT(auth_user_id,day,kind,object_id) DO UPDATE SET view_count=m.view_count+1,last_viewed_at=now();
 RETURN jsonb_build_object('success',true,'recorded',true);
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('error','request_failed','message','The request could not be completed.','sqlstate',SQLSTATE);
END $$;
REVOKE ALL ON FUNCTION public.record_media_view(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_media_view(text,uuid) TO authenticated;

-- ── 2. Problemwörter ─────────────────────────────────────────────────────
-- status: watching = Fehler notiert, Schwelle noch nicht erreicht;
-- active = wird trainiert; mastered = viermal in Folge richtig über wachsende
-- Abstände; archived = Lernstand der Karte wurde zurückgesetzt (Archiv, R9).
CREATE TABLE IF NOT EXISTS public.vocabulary_focus_words(
 auth_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 card_id uuid NOT NULL REFERENCES public.learning_vocabulary_cards(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'watching' CHECK(status IN('watching','active','mastered','archived')),
 wrong_count integer NOT NULL DEFAULT 0 CHECK(wrong_count>=0),
 article_errors integer NOT NULL DEFAULT 0 CHECK(article_errors>=0),
 last_error_at timestamptz,
 flagged_at timestamptz,
 stage smallint NOT NULL DEFAULT 0 CHECK(stage BETWEEN 0 AND 4),
 due_at timestamptz,
 practice_count integer NOT NULL DEFAULT 0 CHECK(practice_count>=0),
 practice_correct integer NOT NULL DEFAULT 0 CHECK(practice_correct>=0),
 last_practiced_at timestamptz,
 mastered_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(auth_user_id,card_id));
CREATE INDEX IF NOT EXISTS vocabulary_focus_words_queue_idx ON public.vocabulary_focus_words(auth_user_id,status,due_at);
CREATE INDEX IF NOT EXISTS vocabulary_focus_words_card_idx ON public.vocabulary_focus_words(card_id);
COMMENT ON TABLE public.vocabulary_focus_words IS 'Problem words per learner (Phase 11.3): repeated wrong answers (>=3) or repeated article errors (>=2) in the vocabulary trainer. Separate spaced-repetition ladder; the Leitner box is not changed. Written only by database functions.';
ALTER TABLE public.vocabulary_focus_words ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vocabulary_focus_words_read ON public.vocabulary_focus_words;
CREATE POLICY vocabulary_focus_words_read ON public.vocabulary_focus_words FOR SELECT TO authenticated
 USING(auth_user_id=(SELECT auth.uid()) OR (SELECT business_private.is_staff()));
REVOKE ALL ON public.vocabulary_focus_words FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.vocabulary_focus_words TO authenticated;
GRANT ALL ON public.vocabulary_focus_words TO service_role;

CREATE TABLE IF NOT EXISTS vocabulary_private.focus_receipts(
 auth_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 card_id uuid NOT NULL REFERENCES public.learning_vocabulary_cards(id) ON DELETE CASCADE,
 format text NOT NULL CHECK(format IN('article','choice','build','type')),
 answer text NOT NULL CHECK(length(answer)<=400),
 is_correct boolean NOT NULL,
 response jsonb NOT NULL CHECK(jsonb_typeof(response)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(auth_user_id,request_id));
CREATE INDEX IF NOT EXISTS focus_receipts_recent_idx ON vocabulary_private.focus_receipts(auth_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS focus_receipts_card_idx ON vocabulary_private.focus_receipts(card_id);
ALTER TABLE vocabulary_private.focus_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vocabulary_private.focus_receipts FROM PUBLIC,anon,authenticated;

-- Schwellen an einer Stelle: dieselbe Regel für Rückschau, Trigger und Anzeige.
CREATE OR REPLACE FUNCTION vocabulary_private.focus_threshold_reached(p_wrong integer,p_article integer)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(p_wrong,0)>=3 OR coalesce(p_article,0)>=2
$$;
REVOKE ALL ON FUNCTION vocabulary_private.focus_threshold_reached(integer,integer) FROM PUBLIC,anon,authenticated;

-- Jede falsche Antwort im Vokabeltrainer (Tippen, Selbsteinschätzung, Übertrag)
-- landet als Quittung in answer_receipts. Der Trigger zählt nur mit. Er darf
-- eine Antwort nie verhindern: jeder Fehler hier wird geschluckt und gemeldet.
CREATE OR REPLACE FUNCTION vocabulary_private.track_focus_word() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_card uuid; v_article integer; v_at timestamptz:=coalesce(NEW.created_at,now());
BEGIN
 IF coalesce(NEW.response->>'isCorrect','')<>'false' THEN RETURN NULL; END IF;
 SELECT p.card_id INTO v_card FROM public.vocabulary_direction_progress p WHERE p.id=NEW.progress_id AND p.auth_user_id=NEW.auth_user_id;
 IF v_card IS NULL THEN RETURN NULL; END IF;
 v_article:=CASE WHEN NEW.response->>'feedback' IN('article_missing','article_wrong') THEN 1 ELSE 0 END;
 INSERT INTO public.vocabulary_focus_words AS f(auth_user_id,card_id,wrong_count,article_errors,last_error_at)
 VALUES(NEW.auth_user_id,v_card,1,v_article,v_at)
 ON CONFLICT(auth_user_id,card_id) DO UPDATE SET
  -- Ein archiviertes Wort (Lernstand zurückgesetzt) beginnt neu zu zählen.
  wrong_count=CASE WHEN f.status='archived' THEN 1 ELSE f.wrong_count+1 END,
  article_errors=CASE WHEN f.status='archived' THEN excluded.article_errors ELSE f.article_errors+excluded.article_errors END,
  status=CASE WHEN f.status='archived' THEN 'watching' ELSE f.status END,
  flagged_at=CASE WHEN f.status='archived' THEN NULL ELSE f.flagged_at END,
  mastered_at=CASE WHEN f.status='archived' THEN NULL ELSE f.mastered_at END,
  stage=CASE WHEN f.status='archived' THEN 0 ELSE f.stage END,
  due_at=CASE WHEN f.status='archived' THEN NULL ELSE f.due_at END,
  last_error_at=greatest(f.last_error_at,excluded.last_error_at),updated_at=now();
 -- Schwelle erreicht, Rückfall eines gemeisterten Worts oder erneuter Fehler
 -- während des Trainings: zurück auf Stufe 0, sofort wieder fällig.
 UPDATE public.vocabulary_focus_words SET status='active',stage=0,due_at=v_at,
  flagged_at=CASE WHEN status='active' THEN flagged_at ELSE v_at END,updated_at=now()
 WHERE auth_user_id=NEW.auth_user_id AND card_id=v_card
  AND (status IN('active','mastered') OR vocabulary_private.focus_threshold_reached(wrong_count,article_errors));
 RETURN NULL;
EXCEPTION WHEN OTHERS THEN
 RAISE WARNING 'vocabulary_focus_tracking_failed %',SQLSTATE;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION vocabulary_private.track_focus_word() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS vocabulary_focus_track ON vocabulary_private.answer_receipts;
CREATE TRIGGER vocabulary_focus_track AFTER INSERT ON vocabulary_private.answer_receipts
 FOR EACH ROW EXECUTE FUNCTION vocabulary_private.track_focus_word();

-- Zurücksetzen (Lehrkraft, eigener Neustart, Lektion entfernen) löscht den
-- Lernstand der Karte. Das Problemwort wird archiviert, nicht gelöscht.
CREATE OR REPLACE FUNCTION vocabulary_private.archive_focus_words() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.vocabulary_focus_words f SET status='archived',due_at=NULL,updated_at=now()
 FROM (SELECT DISTINCT r.auth_user_id,r.card_id FROM removed r) gone
 WHERE f.auth_user_id=gone.auth_user_id AND f.card_id=gone.card_id AND f.status<>'archived'
  AND NOT EXISTS(SELECT 1 FROM public.vocabulary_direction_progress p WHERE p.auth_user_id=gone.auth_user_id AND p.card_id=gone.card_id);
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION vocabulary_private.archive_focus_words() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS vocabulary_focus_archive ON public.vocabulary_direction_progress;
CREATE TRIGGER vocabulary_focus_archive AFTER DELETE ON public.vocabulary_direction_progress
 REFERENCING OLD TABLE AS removed FOR EACH STATEMENT EXECUTE FUNCTION vocabulary_private.archive_focus_words();

-- Rückschau: vorhandene Fehlerzähler (lapses, beide Richtungen) und
-- Artikel-Rückmeldungen der Quittungen (seit Migration 30). Bereits in beiden
-- Richtungen gelernte Wörter werden nur notiert, nicht trainiert.
INSERT INTO public.vocabulary_focus_words(auth_user_id,card_id,status,wrong_count,article_errors,last_error_at,flagged_at,stage,due_at)
SELECT source.auth_user_id,source.card_id,
 CASE WHEN source.active THEN 'active' ELSE 'watching' END,source.wrong,source.article,source.last_error,
 CASE WHEN source.active THEN now() END,0,CASE WHEN source.active THEN now() END
FROM (
 SELECT c.auth_user_id,c.card_id,greatest(c.wrong,coalesce(a.errors,0)) wrong,coalesce(a.errors,0) article,
  coalesce(greatest(a.last_at,c.last_answered),a.last_at,c.last_answered) last_error,
  NOT (c.directions=2 AND c.learned) AND vocabulary_private.focus_threshold_reached(greatest(c.wrong,coalesce(a.errors,0)),coalesce(a.errors,0)) active
 FROM (SELECT p.auth_user_id,p.card_id,sum(p.lapses)::integer wrong,count(*) directions,bool_and(p.box_number=7) learned,max(p.last_answered_at) last_answered
  FROM public.vocabulary_direction_progress p GROUP BY p.auth_user_id,p.card_id) c
 LEFT JOIN (SELECT r.auth_user_id,p.card_id,count(*)::integer errors,max(r.created_at) last_at
  FROM vocabulary_private.answer_receipts r
  JOIN public.vocabulary_direction_progress p ON p.id=r.progress_id AND p.auth_user_id=r.auth_user_id
  WHERE r.response->>'feedback' IN('article_missing','article_wrong') GROUP BY r.auth_user_id,p.card_id) a
  ON a.auth_user_id=c.auth_user_id AND a.card_id=c.card_id
 WHERE c.wrong>0 OR coalesce(a.errors,0)>0
) source
WHERE EXISTS(SELECT 1 FROM public.profiles pr WHERE pr.id=source.auth_user_id)
ON CONFLICT DO NOTHING;

-- Musterlösung für das Problemwörter-Training: immer das Wort selbst (mit
-- Artikel), auch bei Satzkarten. Pluralformen wie im Vokabeltrainer.
CREATE OR REPLACE FUNCTION vocabulary_private.focus_answer_key(p_card_id uuid,OUT canonical text,OUT accepted text[])
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE card public.learning_vocabulary_cards; plural text;
BEGIN
 SELECT * INTO card FROM public.learning_vocabulary_cards WHERE id=p_card_id;
 canonical:=concat_ws(' ',nullif(nullif(card.article::text,'none'),''),btrim(card.word_de));
 accepted:=ARRAY[canonical];
 plural:=nullif(btrim(coalesce(card.plural,'')),'');
 IF card.article IS NOT NULL AND card.article::text<>'none' AND plural IS NOT NULL AND plural NOT IN('-','–','—') THEN
  accepted:=accepted||('die '||plural)||(canonical||' / die '||plural)||(canonical||', die '||plural);
 END IF;
END $$;
REVOKE ALL ON FUNCTION vocabulary_private.focus_answer_key(uuid) FROM PUBLIC,anon,authenticated;

-- Aufgabenformat je Stufe: vom Wiedererkennen über das Zusammensetzen zum
-- freien Schreiben. Artikel-Wörter üben den Artikel abwechselnd mit Schreiben.
CREATE OR REPLACE FUNCTION vocabulary_private.focus_format(p_stage integer,p_article_reason boolean,p_hard_reason boolean)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT (CASE WHEN p_article_reason AND p_hard_reason THEN ARRAY['article','choice','build','type']
  WHEN p_article_reason THEN ARRAY['article','type','article','type']
  ELSE ARRAY['choice','build','type','type'] END)[least(3,greatest(0,coalesce(p_stage,0)))+1]
$$;
REVOKE ALL ON FUNCTION vocabulary_private.focus_format(integer,boolean,boolean) FROM PUBLIC,anon,authenticated;

-- Die trainierbaren Problemwörter der angemeldeten Person: dieselben
-- Zugriffsregeln wie im Vokabeltrainer (Niveau, Modus, Lektionsauswahl) und
-- nur Karten, die noch in der eigenen Lernbox liegen.
CREATE OR REPLACE FUNCTION vocabulary_private.focus_scope(p_actor uuid,p_level text,p_allowed uuid[])
RETURNS TABLE(card_id uuid,status text,stage integer,due_at timestamptz,wrong_count integer,article_errors integer,
 mastered_at timestamptz,word text,article text,level text)
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT f.card_id,f.status,f.stage::integer,f.due_at,f.wrong_count,f.article_errors,f.mastered_at,btrim(c.word_de),c.article::text,u.level
 FROM public.vocabulary_focus_words f
 JOIN public.learning_vocabulary_cards c ON c.id=f.card_id
 JOIN public.learning_units u ON u.id=c.unit_id AND u.is_active AND u.trainer='vocabulary'
 WHERE f.auth_user_id=p_actor AND f.status IN('active','mastered') AND u.id=ANY(p_allowed)
  AND (p_level IS NULL OR u.level=p_level)
  AND EXISTS(SELECT 1 FROM public.vocabulary_direction_progress p WHERE p.auth_user_id=p_actor AND p.card_id=f.card_id)
$$;
REVOKE ALL ON FUNCTION vocabulary_private.focus_scope(uuid,text,uuid[]) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_vocabulary_focus(p_level text DEFAULT NULL,p_ui_language text DEFAULT 'en')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); allowed uuid[]; w record; items jsonb:='[]'; item jsonb; fmt text; noun boolean;
 article_reason boolean; hard_reason boolean; translation text; canonical text; options jsonb; letters text[]; tries integer;
 summary jsonb; words jsonb;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated','message','Authentication is required.'); END IF;
 IF p_ui_language IS NULL OR p_ui_language NOT IN('en','ru','uk','tr') THEN
  RETURN jsonb_build_object('error','invalid_learning_language','message','Choose a learning language other than German.'); END IF;
 IF p_level IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.learning_levels WHERE code=p_level) THEN
  RETURN jsonb_build_object('error','not_found','message','Level not found.'); END IF;
 allowed:=learning_private.allowed_unit_ids();
 SELECT jsonb_build_object(
  'active',count(*) FILTER(WHERE s.status='active'),
  'due',count(*) FILTER(WHERE s.status='active' AND s.due_at<=now()),
  'mastered',count(*) FILTER(WHERE s.status='mastered'),
  'articleWords',count(*) FILTER(WHERE s.status='active' AND s.article_errors>=2 AND s.article IN('der','die','das')),
  'nextDueAt',min(s.due_at) FILTER(WHERE s.status='active' AND s.due_at>now()))
 INTO summary FROM vocabulary_private.focus_scope(actor,p_level,allowed) s;
 SELECT coalesce(jsonb_agg(jsonb_build_object('cardId',s.card_id,'word',s.word,'article',nullif(s.article,'none'),'level',s.level,
  'translation',vocabulary_private.card_translation(s.card_id,p_ui_language),'status',s.status,'stage',s.stage,'dueAt',s.due_at,
  'due',s.status='active' AND s.due_at<=now(),
  'wrongCount',s.wrong_count,'articleErrors',s.article_errors,'masteredAt',s.mastered_at,
  'reasons',to_jsonb(array_remove(ARRAY[
   CASE WHEN s.article_errors>=2 AND s.article IN('der','die','das') THEN 'article' END,
   CASE WHEN s.wrong_count>=3 OR NOT (s.article_errors>=2 AND s.article IN('der','die','das')) THEN 'hard' END],NULL)))
  ORDER BY s.status,s.due_at NULLS LAST,s.wrong_count DESC,s.word),'[]')
 INTO words FROM vocabulary_private.focus_scope(actor,p_level,allowed) s;

 FOR w IN SELECT * FROM vocabulary_private.focus_scope(actor,p_level,allowed) s
  WHERE s.status='active' AND s.due_at<=now() ORDER BY s.due_at,s.card_id LIMIT 12 LOOP
  translation:=nullif(btrim(coalesce(vocabulary_private.card_translation(w.card_id,p_ui_language),'')),'');
  CONTINUE WHEN translation IS NULL OR coalesce(w.word,'')='';
  noun:=coalesce(w.article IN('der','die','das'),false);
  article_reason:=noun AND w.article_errors>=2;
  hard_reason:=w.wrong_count>=3 OR NOT article_reason;
  fmt:=vocabulary_private.focus_format(w.stage,article_reason,hard_reason);
  IF fmt='article' AND NOT noun THEN fmt:='choice'; END IF;
  IF fmt='build' AND w.word!~'^[^[:space:]]{3,20}$' THEN fmt:='type'; END IF;
  options:=NULL; letters:=NULL;
  IF fmt='choice' THEN
   SELECT k.canonical INTO canonical FROM vocabulary_private.focus_answer_key(w.card_id) k;
   -- Drei Ablenker aus demselben Niveau, gleiche Wortart (Nomen mit Artikel oder nicht).
   SELECT jsonb_agg(value ORDER BY random()) INTO options FROM (
    SELECT canonical AS value
    UNION ALL
    (SELECT picked.value FROM (
     SELECT DISTINCT ON (lower(candidate.value)) candidate.value,candidate.r FROM (
      SELECT concat_ws(' ',nullif(c.article::text,'none'),btrim(c.word_de)) AS value,random() AS r
      FROM public.learning_vocabulary_cards c
      JOIN public.learning_units u ON u.id=c.unit_id AND u.is_active AND u.trainer='vocabulary'
      WHERE u.level=w.level AND u.id=ANY(allowed) AND c.id<>w.card_id
       AND lower(btrim(c.word_de))<>lower(w.word) AND coalesce(c.article::text IN('der','die','das'),false)=noun
       AND length(btrim(c.word_de)) BETWEEN 1 AND 60
      ORDER BY random() LIMIT 30) candidate
     WHERE lower(candidate.value)<>lower(canonical)
     ORDER BY lower(candidate.value),candidate.r) picked
    ORDER BY picked.r LIMIT 3)) choices;
   IF coalesce(jsonb_array_length(options),0)<4 THEN
    fmt:=CASE WHEN w.word~'^[^[:space:]]{3,20}$' THEN 'build' ELSE 'type' END; options:=NULL;
   END IF;
  END IF;
  IF fmt='build' THEN
   tries:=0;
   LOOP
    SELECT array_agg(ch ORDER BY random()) INTO letters FROM regexp_split_to_table(w.word,'') ch;
    tries:=tries+1;
    EXIT WHEN array_to_string(letters,'')<>w.word OR tries>=4;
   END LOOP;
  END IF;
  item:=jsonb_build_object('cardId',w.card_id,'format',fmt,'stage',w.stage,'level',w.level,'prompt',translation,'noun',noun,
   'reasons',to_jsonb(array_remove(ARRAY[CASE WHEN article_reason THEN 'article' END,CASE WHEN hard_reason THEN 'hard' END],NULL)));
  IF fmt='article' THEN item:=item||jsonb_build_object('word',w.word,'options',jsonb_build_array('der','die','das')); END IF;
  IF fmt='choice' THEN item:=item||jsonb_build_object('options',options); END IF;
  IF fmt='build' THEN item:=item||jsonb_build_object('letters',to_jsonb(letters),'article',CASE WHEN noun THEN w.article END); END IF;
  IF fmt='type' THEN item:=item||jsonb_build_object('firstLetter',left(w.word,1),'length',char_length(w.word)); END IF;
  items:=items||jsonb_build_array(item);
 END LOOP;
 RETURN jsonb_build_object('success',true,'level',p_level,'summary',summary,'words',words,'items',items);
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('error','request_failed','message','The request could not be completed.','sqlstate',SQLSTATE);
END $$;
REVOKE ALL ON FUNCTION public.get_vocabulary_focus(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_vocabulary_focus(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_vocabulary_focus_answer(p_request_id uuid,p_card_id uuid,p_format text,p_answer text,p_ui_language text DEFAULT 'en')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); receipt vocabulary_private.focus_receipts; focus public.vocabulary_focus_words;
 card public.learning_vocabulary_cards; unit public.learning_units; key record; grade jsonb; feedback text;
 correct boolean; noun boolean; next_stage integer; next_status text; next_due timestamptz; response jsonb; answer text;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated','message','Authentication is required.'); END IF;
 IF p_request_id IS NULL OR p_card_id IS NULL OR p_format IS NULL OR p_format NOT IN('article','choice','build','type') THEN
  RETURN jsonb_build_object('error','invalid_input','message','The request contains invalid data.'); END IF;
 IF p_ui_language IS NULL OR p_ui_language NOT IN('en','ru','uk','tr') THEN
  RETURN jsonb_build_object('error','invalid_learning_language','message','Choose a learning language other than German.'); END IF;
 answer:=btrim(coalesce(p_answer,''));
 IF answer='' OR length(answer)>400 THEN RETURN jsonb_build_object('error','answer_required','message','An answer is required.'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary-focus:'||actor::text,0));
 SELECT * INTO receipt FROM vocabulary_private.focus_receipts WHERE auth_user_id=actor AND request_id=p_request_id;
 IF FOUND THEN
  IF receipt.card_id<>p_card_id OR receipt.format<>p_format THEN
   RETURN jsonb_build_object('error','conflict','message','Reload and retry the request.'); END IF;
  RETURN receipt.response;
 END IF;
 SELECT * INTO focus FROM public.vocabulary_focus_words WHERE auth_user_id=actor AND card_id=p_card_id FOR UPDATE;
 IF NOT FOUND OR focus.status<>'active' THEN RETURN jsonb_build_object('error','not_found','message','This word is not in training.'); END IF;
 IF focus.due_at IS NULL OR focus.due_at>now() THEN RETURN jsonb_build_object('error','review_not_due','message','This review is not due yet.'); END IF;
 SELECT * INTO card FROM public.learning_vocabulary_cards WHERE id=p_card_id;
 SELECT * INTO unit FROM public.learning_units WHERE id=card.unit_id;
 IF NOT unit.is_active OR NOT learning_private.unit_allowed(unit.id) THEN
  RETURN jsonb_build_object('error','trainer_access_denied','message','The request is not authorized.'); END IF;
 SELECT k.canonical,k.accepted INTO key FROM vocabulary_private.focus_answer_key(card.id) k;
 noun:=card.article::text IN('der','die','das');
 IF p_format='article' THEN
  IF NOT noun THEN RETURN jsonb_build_object('error','invalid_input','message','The request contains invalid data.'); END IF;
  correct:=lower(answer)=card.article::text;
 ELSIF p_format='choice' THEN
  -- Auswahl: der angetippte Text; Groß-/Kleinschreibung entscheidet hier nicht.
  correct:=lower(learning_private.normalize_answer(answer))=lower(learning_private.normalize_answer(key.canonical));
 ELSIF p_format='build' THEN
  correct:=answer=btrim(card.word_de);
 ELSE
  grade:=learning_private.grade_answer(answer,key.accepted);
  PERFORM platform_private.require_rpc_success(grade);
  IF noun THEN feedback:=vocabulary_private.answer_article_feedback(answer,card.word_de,card.article::text,card.plural)::text; END IF;
  correct:=feedback IS NULL AND grade->>'status' IN('EXACT','SOFT_ERROR');
 END IF;
 IF correct THEN
  next_stage:=least(4,focus.stage+1);
  next_status:=CASE WHEN next_stage>=4 THEN 'mastered' ELSE 'active' END;
  next_due:=CASE WHEN next_stage>=4 THEN NULL ELSE vocabulary_private.review_day(CASE next_stage WHEN 1 THEN 1 WHEN 2 THEN 3 ELSE 7 END) END;
 ELSE
  -- Falsch: zurück auf Stufe 0 und in dieser Runde später noch einmal.
  next_stage:=0; next_status:='active'; next_due:=now();
 END IF;
 UPDATE public.vocabulary_focus_words SET stage=next_stage,status=next_status,due_at=next_due,
  mastered_at=CASE WHEN next_status='mastered' THEN now() ELSE mastered_at END,
  practice_count=practice_count+1,practice_correct=practice_correct+CASE WHEN correct THEN 1 ELSE 0 END,
  last_practiced_at=now(),updated_at=now()
 WHERE auth_user_id=actor AND card_id=card.id;
 response:=jsonb_build_object('success',true,'correct',correct,'format',p_format,'stage',next_stage,'status',next_status,'dueAt',next_due,
  'solution',jsonb_build_object('display',key.canonical,'word',btrim(card.word_de),'article',CASE WHEN noun THEN card.article::text END),
  'softError',CASE WHEN correct AND grade IS NOT NULL THEN grade->'reason' END,'feedback',feedback);
 INSERT INTO vocabulary_private.focus_receipts(auth_user_id,request_id,card_id,format,answer,is_correct,response)
 VALUES(actor,p_request_id,card.id,p_format,answer,correct,response);
 -- Training ist Lernzeit im Modus Vokabeln (Lerntage, Sitzungen, Lernanalyse).
 PERFORM learning_private.record_learning_event(actor,'vocabulary',unit.level,now());
 RETURN response;
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('error','request_failed','message','The request could not be completed.','sqlstate',SQLSTATE);
END $$;
REVOKE ALL ON FUNCTION public.submit_vocabulary_focus_answer(uuid,uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_vocabulary_focus_answer(uuid,uuid,text,text,text) TO authenticated;

-- ── 3. Lernanalyse je Modus ──────────────────────────────────────────────
-- Lehrkräfte lesen jede lernende Person, Lernende nur sich selbst
-- (p_student_id NULL). Tageswerte nach Berliner Kalendertag; der Zeitraum
-- umfasst 7 bis 90 Tage bis einschließlich heute.
CREATE OR REPLACE FUNCTION public.get_learning_progress(p_student_id uuid DEFAULT NULL,p_level text DEFAULT NULL,p_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); learner uuid; staff boolean; today date:=(now() AT TIME ZONE 'Europe/Berlin')::date;
 first_day date; range_start timestamptz; range_end timestamptz; scope text[];
 daily jsonb; vocabulary jsonb; focus jsonb; path jsonb; pronunciation jsonb; media jsonb;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated','message','Authentication is required.'); END IF;
 staff:=business_private.is_staff();
 learner:=coalesce(p_student_id,actor);
 IF learner<>actor AND NOT staff THEN RETURN jsonb_build_object('error','not_authorized','message','Staff access required.'); END IF;
 IF p_days IS NULL OR p_days NOT BETWEEN 7 AND 90 THEN RETURN jsonb_build_object('error','invalid_input','message','Choose 7 to 90 days.'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=learner AND role='student') THEN
  RETURN jsonb_build_object('error','not_found','message','Student not found.'); END IF;
 IF p_level IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.learning_levels WHERE code=p_level) THEN
  RETURN jsonb_build_object('error','not_found','message','Level not found.'); END IF;
 first_day:=today-(p_days-1);
 range_start:=first_day::timestamp AT TIME ZONE 'Europe/Berlin';
 range_end:=(today+1)::timestamp AT TIME ZONE 'Europe/Berlin';
 -- Gesamtstände: gewähltes Niveau, sonst alle freigeschalteten Niveaus.
 scope:=CASE WHEN p_level IS NOT NULL THEN ARRAY[p_level]
  ELSE coalesce((SELECT array_agg(a.level) FROM public.student_level_access a WHERE a.auth_user_id=learner),ARRAY[]::text[]) END;

 WITH days AS (SELECT first_day+n AS day FROM generate_series(0,p_days-1) n),
 vocab AS (
  SELECT (r.created_at AT TIME ZONE 'Europe/Berlin')::date AS day,count(*) answers,
   count(*) FILTER(WHERE r.response->>'isCorrect'='true') correct
  FROM vocabulary_private.answer_receipts r
  JOIN public.vocabulary_direction_progress p ON p.id=r.progress_id AND p.auth_user_id=r.auth_user_id
  JOIN public.learning_vocabulary_cards c ON c.id=p.card_id JOIN public.learning_units u ON u.id=c.unit_id
  WHERE r.auth_user_id=learner AND r.created_at>=range_start AND r.created_at<range_end AND (p_level IS NULL OR u.level=p_level)
  GROUP BY 1),
 -- Ein Wort gilt als gelernt, sobald die zweite Richtung Phase 7 erreicht.
 -- Phase 7 ist endgültig; ohne Quittung (Altbestand) bleibt der Tag unbekannt.
 learned_directions AS (
  SELECT r.progress_id,min(r.created_at) learned_at FROM vocabulary_private.answer_receipts r
  WHERE r.auth_user_id=learner AND r.response->>'becameLearned'='true' GROUP BY r.progress_id),
 learned AS (
  SELECT (max(ld.learned_at) AT TIME ZONE 'Europe/Berlin')::date AS day
  FROM public.vocabulary_direction_progress p JOIN public.learning_vocabulary_cards c ON c.id=p.card_id
  JOIN public.learning_units u ON u.id=c.unit_id LEFT JOIN learned_directions ld ON ld.progress_id=p.id
  WHERE p.auth_user_id=learner AND p.box_number=7 AND (p_level IS NULL OR u.level=p_level)
  GROUP BY p.card_id HAVING count(*)=2 AND bool_and(ld.learned_at IS NOT NULL)),
 learned_days AS (SELECT day,count(*) learned FROM learned WHERE day>=first_day GROUP BY day),
 focus_days AS (
  SELECT (f.created_at AT TIME ZONE 'Europe/Berlin')::date AS day,count(*) answers,count(*) FILTER(WHERE f.is_correct) correct
  FROM vocabulary_private.focus_receipts f JOIN public.learning_vocabulary_cards c ON c.id=f.card_id JOIN public.learning_units u ON u.id=c.unit_id
  WHERE f.auth_user_id=learner AND f.created_at>=range_start AND f.created_at<range_end AND (p_level IS NULL OR u.level=p_level)
  GROUP BY 1),
 path_events AS (
  SELECT (receipt.created_at AT TIME ZONE 'Europe/Berlin')::date AS day,receipt.response->'grade'->>'status' IN('EXACT','SOFT_ERROR') correct
  FROM path_private.answer_receipts receipt JOIN public.path_practice_runs r ON r.id=receipt.run_id
  JOIN public.path_nodes n ON n.id=r.node_id JOIN public.learning_units u ON u.id=n.unit_id
  WHERE r.auth_user_id=learner AND receipt.created_at>=range_start AND receipt.created_at<range_end
   AND receipt.response->'grade'->>'status' IN('EXACT','SOFT_ERROR','INCORRECT') AND (p_level IS NULL OR u.level=p_level)
  UNION ALL
  SELECT (ans.answered_at AT TIME ZONE 'Europe/Berlin')::date,ans.result->>'status' IN('EXACT','SOFT_ERROR')
  FROM public.path_test_answers ans JOIN public.path_test_attempts a ON a.id=ans.attempt_id
  JOIN public.path_nodes n ON n.id=a.node_id JOIN public.learning_units u ON u.id=n.unit_id
  WHERE a.auth_user_id=learner AND ans.answered_at>=range_start AND ans.answered_at<range_end
   AND ans.result->>'status' IN('EXACT','SOFT_ERROR','INCORRECT') AND (p_level IS NULL OR u.level=p_level)),
 path_days AS (SELECT day,count(*) answers,count(*) FILTER(WHERE correct) correct FROM path_events GROUP BY day),
 station_days AS (
  SELECT (pr.completed_at AT TIME ZONE 'Europe/Berlin')::date AS day,count(*) stations
  FROM public.path_node_progress pr JOIN public.path_nodes n ON n.id=pr.node_id JOIN public.learning_units u ON u.id=n.unit_id
  WHERE pr.auth_user_id=learner AND pr.is_active AND pr.status='completed' AND pr.completed_at>=range_start AND pr.completed_at<range_end
   AND (p_level IS NULL OR u.level=p_level)
  GROUP BY 1),
 pron_events AS (
  SELECT (s.created_at AT TIME ZONE 'Europe/Berlin')::date AS day,true own
  FROM public.submissions s WHERE s.auth_user_id=learner AND s.type='audio'
   AND s.created_at>=range_start AND s.created_at<range_end AND (p_level IS NULL OR s.level=p_level)
  UNION ALL
  SELECT (m.created_at AT TIME ZONE 'Europe/Berlin')::date,m.sender_role='student'
  FROM public.pronunciation_messages m JOIN public.submissions s ON s.id=m.submission_id
  WHERE s.auth_user_id=learner AND m.created_at>=range_start AND m.created_at<range_end AND (p_level IS NULL OR s.level=p_level)
   AND ((m.sender_role='student' AND m.sender_id=learner AND m.audio_path IS NOT NULL) OR m.sender_role IN('teacher','admin'))),
 pron_days AS (SELECT day,count(*) FILTER(WHERE own) recordings,count(*) FILTER(WHERE NOT own) replies FROM pron_events GROUP BY day),
 media_days AS (
  SELECT v.day,count(*) views FROM public.learning_media_views v
  WHERE v.auth_user_id=learner AND v.day>=first_day AND v.day<=today AND (p_level IS NULL OR v.level=p_level) GROUP BY v.day),
 time_days AS (
  SELECT (ls.ended_at AT TIME ZONE 'Europe/Berlin')::date AS day,
   sum(ls.study_seconds) FILTER(WHERE ls.mode='vocabulary') vocabulary,
   sum(ls.study_seconds) FILTER(WHERE ls.mode='path') path,
   sum(ls.study_seconds) FILTER(WHERE ls.mode='pronunciation') pronunciation
  FROM public.learning_sessions ls
  WHERE ls.auth_user_id=learner AND ls.is_active AND ls.ended_at>=range_start AND ls.ended_at<range_end AND (p_level IS NULL OR ls.level=p_level)
  GROUP BY 1)
 SELECT jsonb_agg(jsonb_build_object('date',d.day,
  'vocabulary',jsonb_build_object('answers',coalesce(v.answers,0),'correct',coalesce(v.correct,0),'learned',coalesce(l.learned,0),'seconds',coalesce(t.vocabulary,0)),
  'focus',jsonb_build_object('answers',coalesce(f.answers,0),'correct',coalesce(f.correct,0)),
  'path',jsonb_build_object('answers',coalesce(pa.answers,0),'correct',coalesce(pa.correct,0),'stations',coalesce(st.stations,0),'seconds',coalesce(t.path,0)),
  'pronunciation',jsonb_build_object('recordings',coalesce(pr.recordings,0),'replies',coalesce(pr.replies,0),'seconds',coalesce(t.pronunciation,0)),
  'media',jsonb_build_object('views',coalesce(m.views,0))) ORDER BY d.day)
 INTO daily
 FROM days d LEFT JOIN vocab v ON v.day=d.day LEFT JOIN learned_days l ON l.day=d.day LEFT JOIN focus_days f ON f.day=d.day
 LEFT JOIN path_days pa ON pa.day=d.day LEFT JOIN station_days st ON st.day=d.day LEFT JOIN pron_days pr ON pr.day=d.day
 LEFT JOIN media_days m ON m.day=d.day LEFT JOIN time_days t ON t.day=d.day;

 -- Wortschatz: pro Wort zählt die niedrigere Phase beider Richtungen (wie 52),
 -- aber nur aktive Lektionen und nie eigene Wörter anderer Personen.
 WITH cards AS (
  SELECT c.id,CASE WHEN count(p.id)=0 THEN NULL WHEN count(p.id)=2 AND bool_and(p.box_number=7) THEN 7 ELSE least(6,min(p.box_number)) END phase
  FROM public.learning_vocabulary_cards c
  JOIN public.learning_units u ON u.id=c.unit_id AND u.is_active AND u.trainer='vocabulary'
   AND (u.owner_auth_user_id IS NULL OR u.owner_auth_user_id=learner)
  LEFT JOIN public.vocabulary_direction_progress p ON p.card_id=c.id AND p.auth_user_id=learner
  WHERE u.level=ANY(scope) GROUP BY c.id),
 buckets AS (SELECT n phase,count(c.id) count FROM generate_series(1,7) n LEFT JOIN cards c ON c.phase=n GROUP BY n)
 SELECT jsonb_build_object('totalWords',(SELECT count(*) FROM cards),'inBox',(SELECT count(phase) FROM cards),
  'learnedWords',(SELECT count(*) FROM cards WHERE phase=7),
  -- Alle je gelernten Wörter (auch in Niveaus außerhalb des Bereichs) für die Summenkurve.
  'learnedTotal',(SELECT count(*) FROM (SELECT p.card_id FROM public.vocabulary_direction_progress p
    JOIN public.learning_vocabulary_cards c ON c.id=p.card_id JOIN public.learning_units u ON u.id=c.unit_id
    WHERE p.auth_user_id=learner AND (p_level IS NULL OR u.level=p_level) GROUP BY p.card_id HAVING count(*)=2 AND bool_and(p.box_number=7)) x),
  'overallPercent',(SELECT CASE WHEN count(*)=0 THEN 0 ELSE round(coalesce(sum(phase),0)::numeric/(count(*)*7)*100) END FROM cards),
  'buckets',(SELECT jsonb_agg(jsonb_build_object('key',CASE WHEN phase=7 THEN to_jsonb('learned'::text) ELSE to_jsonb(phase) END,'count',count) ORDER BY phase) FROM buckets))
 INTO vocabulary;

 -- Problemwörter: Lehrkräfte sehen keine eigenen Wörter der Lernenden (privat).
 WITH scoped AS (
  SELECT f.*,btrim(c.word_de) word,nullif(c.article::text,'none') article,u.level,u.owner_auth_user_id IS NOT NULL owned
  FROM public.vocabulary_focus_words f JOIN public.learning_vocabulary_cards c ON c.id=f.card_id
  JOIN public.learning_units u ON u.id=c.unit_id AND u.trainer='vocabulary'
  WHERE f.auth_user_id=learner AND f.status IN('active','mastered') AND (p_level IS NULL OR u.level=p_level)
   AND EXISTS(SELECT 1 FROM public.vocabulary_direction_progress p WHERE p.auth_user_id=learner AND p.card_id=f.card_id))
 SELECT jsonb_build_object(
  'active',(SELECT count(*) FROM scoped WHERE status='active'),
  'due',(SELECT count(*) FROM scoped WHERE status='active' AND due_at<=now()),
  'mastered',(SELECT count(*) FROM scoped WHERE status='mastered'),
  'articleWords',(SELECT count(*) FROM scoped WHERE status='active' AND article_errors>=2 AND article IN('der','die','das')),
  'words',coalesce((SELECT jsonb_agg(jsonb_build_object('cardId',s.card_id,'word',s.word,'article',s.article,'level',s.level,
    'status',s.status,'stage',s.stage,'dueAt',s.due_at,'due',s.status='active' AND s.due_at<=now(),'wrongCount',s.wrong_count,'articleErrors',s.article_errors,
    'practiceCount',s.practice_count,'practiceCorrect',s.practice_correct,'masteredAt',s.mastered_at)
    ORDER BY s.status,s.wrong_count+s.article_errors DESC,s.word)
   FROM (SELECT * FROM scoped WHERE NOT (staff AND learner<>actor AND owned) ORDER BY status,wrong_count+article_errors DESC,word LIMIT 40) s),'[]'))
 INTO focus;

 WITH nodes AS (
  SELECT n.id,n.kind,u.id unit_id FROM public.path_nodes n JOIN public.learning_units u ON u.id=n.unit_id AND u.is_path AND u.is_active
  WHERE n.is_active AND u.level=ANY(scope)),
 done AS (
  SELECT DISTINCT pr.node_id FROM public.path_node_progress pr JOIN nodes ON nodes.id=pr.node_id
  WHERE pr.auth_user_id=learner AND pr.is_active AND pr.status='completed'
  UNION
  SELECT DISTINCT a.node_id FROM public.path_test_attempts a JOIN nodes ON nodes.id=a.node_id
  WHERE a.auth_user_id=learner AND a.is_active AND a.status='completed' AND a.passed),
 tests AS (
  SELECT a.completed_at,a.percentage,a.passed,coalesce(n.title,n.topic) title
  FROM public.path_test_attempts a JOIN public.path_nodes n ON n.id=a.node_id JOIN public.learning_units u ON u.id=n.unit_id
  WHERE a.auth_user_id=learner AND a.status='completed' AND a.completed_at>=range_start AND a.completed_at<range_end
   AND (p_level IS NULL OR u.level=p_level)
  ORDER BY a.completed_at DESC LIMIT 20)
 SELECT jsonb_build_object('totalStations',(SELECT count(*) FROM nodes),'completedStations',(SELECT count(*) FROM done),
  'totalUnits',(SELECT count(DISTINCT unit_id) FROM nodes),
  'completedUnits',(SELECT count(DISTINCT n.unit_id) FROM done JOIN nodes n ON n.id=done.node_id WHERE n.kind='test'),
  'tests',coalesce((SELECT jsonb_agg(jsonb_build_object('completedAt',t.completed_at,'percentage',round(t.percentage),'passed',coalesce(t.passed,false),'title',t.title) ORDER BY t.completed_at) FROM tests t),'[]'))
 INTO path;

 WITH texts AS (
  SELECT r.id FROM public.learning_reading_texts r
  JOIN public.learning_units u ON u.id=r.unit_id AND u.trainer='pronunciation' AND u.is_active AND u.owner_auth_user_id IS NULL
  WHERE u.level=ANY(scope)),
 recordings AS (SELECT s.id,s.prompt_id,s.created_at FROM public.submissions s
  WHERE s.auth_user_id=learner AND s.type='audio' AND (p_level IS NULL OR s.level=p_level))
 SELECT jsonb_build_object('totalTexts',(SELECT count(*) FROM texts),
  'practicedTexts',(SELECT count(DISTINCT rec.prompt_id) FROM recordings rec JOIN texts ON texts.id=rec.prompt_id),
  'recordings',(SELECT count(*) FROM recordings)+(SELECT count(*) FROM public.pronunciation_messages m JOIN recordings rec ON rec.id=m.submission_id
    WHERE m.sender_role='student' AND m.sender_id=learner AND m.audio_path IS NOT NULL),
  'awaitingReply',(SELECT count(*) FROM recordings rec WHERE NOT EXISTS(SELECT 1 FROM public.pronunciation_messages reply
    WHERE reply.submission_id=rec.id AND reply.sender_role IN('teacher','admin')
     AND reply.created_at>=coalesce((SELECT max(m.created_at) FROM public.pronunciation_messages m WHERE m.submission_id=rec.id
      AND m.sender_role='student' AND m.audio_path IS NOT NULL),rec.created_at))))
 INTO pronunciation;

 -- Verfügbare Medien der Niveaus im Bereich (Ordner-Videos, Links, Unterlagen).
 WITH available AS (
  SELECT v.id,v.title,CASE WHEN v.storage_path IS NULL THEN 'link' ELSE 'video' END kind
  FROM public.learning_videos v JOIN public.learning_units u ON u.id=v.unit_id AND u.is_active
  WHERE u.level=ANY(scope) AND (v.folder_id IS NULL OR EXISTS(SELECT 1 FROM public.lms_media_folder f WHERE f.folder_id=v.folder_id AND f.level=u.level))
  UNION ALL
  SELECT a.asset_id,a.file_name,'presentation' FROM public.lms_presentation_asset a JOIN public.lms_media_folder f ON f.folder_id=a.folder_id
  WHERE f.level=ANY(scope)),
 seen AS (
  SELECT v.kind,v.object_id,max(v.last_viewed_at) last_viewed_at,sum(v.view_count) views
  FROM public.learning_media_views v WHERE v.auth_user_id=learner AND (p_level IS NULL OR v.level=p_level) GROUP BY v.kind,v.object_id)
 SELECT jsonb_build_object('totalMedia',(SELECT count(*) FROM available),
  'viewedMedia',(SELECT count(*) FROM available a WHERE EXISTS(SELECT 1 FROM seen s WHERE s.object_id=a.id AND s.kind=a.kind)),
  'recent',coalesce((SELECT jsonb_agg(jsonb_build_object('kind',r.kind,'title',r.title,'viewedAt',r.last_viewed_at,'views',r.views) ORDER BY r.last_viewed_at DESC)
   FROM (SELECT s.kind,coalesce(v.title,p.file_name) title,s.last_viewed_at,s.views FROM seen s
    LEFT JOIN public.learning_videos v ON v.id=s.object_id AND s.kind IN('video','link')
    LEFT JOIN public.lms_presentation_asset p ON p.asset_id=s.object_id AND s.kind='presentation'
    WHERE coalesce(v.title,p.file_name) IS NOT NULL ORDER BY s.last_viewed_at DESC LIMIT 8) r),'[]'))
 INTO media;

 RETURN jsonb_build_object('success',true,'studentId',learner,'level',p_level,'days',p_days,'today',today,'timezone','Europe/Berlin',
  'daily',daily,'vocabulary',vocabulary,'focus',focus,'path',path,'pronunciation',pronunciation,'media',media);
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('error','request_failed','message','Learning progress could not be loaded.','sqlstate',SQLSTATE);
END $$;
REVOKE ALL ON FUNCTION public.get_learning_progress(uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_learning_progress(uuid,text,integer) TO authenticated;

-- Regression guards (R10, maschinenlesbar).
DO $migration$
BEGIN
 IF has_table_privilege('authenticated','public.learning_media_views','INSERT')
  OR has_table_privilege('authenticated','public.vocabulary_focus_words','INSERT')
  OR has_table_privilege('authenticated','public.vocabulary_focus_words','UPDATE')
  OR has_table_privilege('authenticated','public.vocabulary_focus_words','DELETE')
  OR has_table_privilege('anon','public.vocabulary_focus_words','SELECT')
  OR has_table_privilege('anon','public.learning_media_views','SELECT') THEN
  RAISE EXCEPTION 'phase11_tables_writable' USING ERRCODE='42501';
 END IF;
 IF has_function_privilege('anon','public.get_learning_progress(uuid,text,integer)','EXECUTE')
  OR has_function_privilege('anon','public.get_vocabulary_focus(text,text)','EXECUTE')
  OR has_function_privilege('anon','public.submit_vocabulary_focus_answer(uuid,uuid,text,text,text)','EXECUTE')
  OR has_function_privilege('anon','public.record_media_view(text,uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'phase11_functions_public' USING ERRCODE='42501';
 END IF;
END $migration$;

NOTIFY pgrst, 'reload schema';

-- Consolidated correction: 55_preserve_course_outages_focus_access.sql
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

-- Consolidated correction: 56_answer_typographic_punctuation.sql
-- Phase 1: accept sentence punctuation emitted by localized tablet keyboards.
-- Function-only and repeatable; keep existing owners, ACLs and learner data.
-- Apply after 55 through migrate-local.py with its backup and transaction.
-- Rollback: rollback/56_answer_typographic_punctuation.sql.
CREATE OR REPLACE FUNCTION learning_private.normalize_answer(p_value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path TO '' AS $function$
 SELECT btrim(regexp_replace(translate(translate(translate(translate(normalize(p_value,NFC),
  '’‘ʼ＇',repeat(chr(39),4)), '„“”«»＂','""""""'), '‐‑‒–—−﹘－','--------'),
  '，﹐､、．﹒｡。：﹕；﹔？﹖！﹗（）［］｛｝',',,,,....::;;??!!()[]{}'), '[[:space:]  ]+',' ','g'))
$function$;

CREATE OR REPLACE FUNCTION learning_private.answer_without_punctuation(p_value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path TO '' AS $function$
 -- Normalize first: full-width decimal commas/periods must keep their meaning.
 SELECT learning_private.normalize_answer(regexp_replace(learning_private.normalize_answer(p_value),
  $punct$(?<![[:digit:]])[.,:]|[.,:](?![[:digit:]])|[!?¡¿;'"()\[\]{}…]|(?<![[:digit:]])-(?![[:digit:]])$punct$,'','g'))
$function$;

-- Fully uppercase German spelling may use SS for ß. This is a case change,
-- while lower-case "strasse" keeps the existing umlaut feedback.
DO $patch$
DECLARE definition text; previous text; replacement text;
BEGIN
 SELECT pg_get_functiondef('learning_private.grade_answer(text,text[])'::regprocedure) INTO definition;
 IF position('uppercase-sharp-s-v1' IN definition)=0 THEN
  previous:=$old$IF lower(input_plain)=lower(candidate_plain) THEN
   hint:=CASE WHEN lower(input_value)=lower(candidate) THEN 'capitalization'$old$;
  replacement:=$new$-- uppercase-sharp-s-v1
  IF lower(input_plain)=lower(candidate_plain)
   OR input_plain=replace(replace(upper(candidate_plain),'ß','SS'),'ẞ','SS') THEN
   hint:=CASE WHEN lower(input_value)=lower(candidate)
    OR input_value=replace(replace(upper(candidate),'ß','SS'),'ẞ','SS') THEN 'capitalization'$new$;
  IF position(previous IN definition)=0 THEN RAISE EXCEPTION 'Unexpected grade_answer capitalization definition'; END IF;
  EXECUTE replace(definition,previous,replacement);
 END IF;
END $patch$;

-- Consolidated correction: 57_pronunciation_moderation_profile_deletion.sql
-- Master-Prompt Phase 2: Lehrkräfte räumen ihre Aussprache-Ansicht auf und
-- löschen Lernplattform-Profile von Schülern; Lernende löschen ihr eigenes Profil.
-- Backup with migrate-local.py before applying. Requires 39, 41, 47 and 54.
-- Rollback: supabase/vps/rollback/57_pronunciation_moderation_profile_deletion.sql.
--
-- Rein additiv (Live-Kundendaten): zwei private Tabellen, ein Trigger und neue
-- Funktionen. Die Migration selbst ändert oder löscht keinen Datensatz.
--
-- A. Aussprache: aus der Lehreransicht entfernen (nichts wird gelöscht)
--   * set_pronunciation_submission_hidden(): Lehrkraft blendet eine Einreichung
--     samt Gespräch aus dem Lehrer-Dashboard aus oder holt sie zurück.
--   * set_pronunciation_message_hidden(): dasselbe für eine einzelne Nachricht
--     eines Lernenden.
--   * get_staff_pronunciation_view(): was ausgeblendet ist und wie viele
--     Gespräche aus Sicht der Lehrkräfte noch auf eine Antwort warten.
--   Für Lernende ändert sich nichts: Aufnahme, Nachrichten, Status und Dateien
--   bleiben unverändert. Die Markierung liegt in privaten Tabellen, die
--   Lernende nicht lesen können. Schreibt die Person erneut in ein
--   ausgeblendetes Gespräch, erscheint es wieder – keine Nachricht geht unter.
--
-- B. Lernplattform-Profil löschen (endgültig, mit Bestätigung)
--   * delete_own_learning_profile(): Lernende löschen ihr eigenes Profil. Kein
--     vom Aufrufer gelieferter Nutzer – die Identität kommt aus der Sitzung.
--   * delete_student_learning_profile(): Lehrkraft löscht ein Schülerprofil.
--   Gelöscht wird das Anmeldekonto (auth.users); profiles und alle Lerndaten
--   hängen per ON DELETE CASCADE daran. public.people (Name, Adresse) bleibt
--   erhalten: people.auth_user_id wird per ON DELETE SET NULL gelöst. Buchungen,
--   Rechnungen, Teilnahmezeiten und Zertifikate verweisen auf people.id und
--   bleiben damit unberührt.
--   Storage und PostgreSQL teilen keine Transaktion. Die Funktion meldet deshalb
--   zuerst die noch vorhandenen Aufnahmen (pendingAudio) und löscht erst, wenn
--   die Storage-API sie entfernt hat – derselbe Grundsatz wie beim
--   Lernstand-Reset. Ein abgebrochener Vorgang lässt sich jederzeit wiederholen.

-- ── 1. Aussprache: Markierungen der Lehreransicht ────────────────────────
-- Eigene Tabellen statt Spalten: submissions und pronunciation_messages sind
-- für Lernende lesbar, diese Markierungen nicht.
CREATE TABLE IF NOT EXISTS pronunciation_private.staff_hidden_submissions(
 submission_id uuid PRIMARY KEY REFERENCES public.submissions(id) ON DELETE CASCADE,
 hidden_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 hidden_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS pronunciation_private.staff_hidden_messages(
 message_id uuid PRIMARY KEY REFERENCES public.pronunciation_messages(id) ON DELETE CASCADE,
 hidden_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 hidden_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE pronunciation_private.staff_hidden_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pronunciation_private.staff_hidden_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON pronunciation_private.staff_hidden_submissions,pronunciation_private.staff_hidden_messages FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE pronunciation_private.staff_hidden_submissions IS 'Pronunciation conversations removed from the staff view (master prompt phase 2). The learner keeps recording, messages and status; nothing is deleted.';
COMMENT ON TABLE pronunciation_private.staff_hidden_messages IS 'Single learner messages removed from the staff view (master prompt phase 2). The learner still sees and plays them.';

CREATE OR REPLACE FUNCTION public.set_pronunciation_submission_hidden(p_submission_id uuid,p_hidden boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid());
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated','message','Authentication is required.'); END IF;
 IF coalesce(identity_private.current_profile_role(),'') NOT IN('teacher','admin') THEN
  RETURN jsonb_build_object('error','not_authorized','message','Staff access required.'); END IF;
 IF p_submission_id IS NULL OR p_hidden IS NULL THEN RETURN jsonb_build_object('error','invalid_input','message','The request contains invalid data.'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.submissions WHERE id=p_submission_id) THEN
  RETURN jsonb_build_object('error','not_found','message','Submission not found.'); END IF;
 IF p_hidden THEN
  INSERT INTO pronunciation_private.staff_hidden_submissions(submission_id,hidden_by) VALUES(p_submission_id,actor) ON CONFLICT(submission_id) DO NOTHING;
 ELSE
  DELETE FROM pronunciation_private.staff_hidden_submissions WHERE submission_id=p_submission_id;
 END IF;
 RETURN jsonb_build_object('success',true,'hidden',p_hidden);
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('error','request_failed','message','The request could not be completed.','sqlstate',SQLSTATE);
END $$;
REVOKE ALL ON FUNCTION public.set_pronunciation_submission_hidden(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_pronunciation_submission_hidden(uuid,boolean) TO authenticated;

-- Nur Nachrichten der Lernenden; die eigenen Antworten der Lehrkräfte gehören
-- zum Gespräch. Die erste Aufnahme ist die Einreichung selbst (Funktion oben).
CREATE OR REPLACE FUNCTION public.set_pronunciation_message_hidden(p_message_id uuid,p_hidden boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); sender text;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated','message','Authentication is required.'); END IF;
 IF coalesce(identity_private.current_profile_role(),'') NOT IN('teacher','admin') THEN
  RETURN jsonb_build_object('error','not_authorized','message','Staff access required.'); END IF;
 IF p_message_id IS NULL OR p_hidden IS NULL THEN RETURN jsonb_build_object('error','invalid_input','message','The request contains invalid data.'); END IF;
 SELECT sender_role::text INTO sender FROM public.pronunciation_messages WHERE id=p_message_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found','message','Message not found.'); END IF;
 IF p_hidden THEN
  IF sender<>'student' THEN RETURN jsonb_build_object('error','not_authorized','message','Only learner messages can be removed from the staff view.'); END IF;
  INSERT INTO pronunciation_private.staff_hidden_messages(message_id,hidden_by) VALUES(p_message_id,actor) ON CONFLICT(message_id) DO NOTHING;
 ELSE
  DELETE FROM pronunciation_private.staff_hidden_messages WHERE message_id=p_message_id;
 END IF;
 RETURN jsonb_build_object('success',true,'hidden',p_hidden);
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('error','request_failed','message','The request could not be completed.','sqlstate',SQLSTATE);
END $$;
REVOKE ALL ON FUNCTION public.set_pronunciation_message_hidden(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_pronunciation_message_hidden(uuid,boolean) TO authenticated;

-- Die Warteschlange der Lehrkräfte richtet sich nach der letzten sichtbaren
-- Nachricht: Antwortete zuletzt eine Lehrkraft, ist das Gespräch beantwortet.
-- Der gespeicherte Status (den auch Lernende sehen) bleibt unverändert.
CREATE OR REPLACE FUNCTION public.get_staff_pronunciation_view() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN RETURN jsonb_build_object('error','not_authenticated','message','Authentication is required.'); END IF;
 IF coalesce(identity_private.current_profile_role(),'') NOT IN('teacher','admin') THEN
  RETURN jsonb_build_object('error','not_authorized','message','Staff access required.'); END IF;
 SELECT jsonb_build_object('success',true,
  'hiddenSubmissions',coalesce((SELECT jsonb_agg(h.submission_id ORDER BY h.submission_id) FROM pronunciation_private.staff_hidden_submissions h),'[]'::jsonb),
  'hiddenMessages',coalesce((SELECT jsonb_agg(h.message_id ORDER BY h.message_id) FROM pronunciation_private.staff_hidden_messages h),'[]'::jsonb),
  'pendingCount',(SELECT count(*) FROM public.submissions s
   WHERE NOT EXISTS(SELECT 1 FROM pronunciation_private.staff_hidden_submissions h WHERE h.submission_id=s.id)
    AND coalesce(
     (SELECT CASE WHEN m.sender_role::text IN('teacher','admin') THEN 'reviewed' ELSE 'pending' END FROM public.pronunciation_messages m
       WHERE m.submission_id=s.id AND NOT EXISTS(SELECT 1 FROM pronunciation_private.staff_hidden_messages h WHERE h.message_id=m.id)
       ORDER BY m.created_at DESC,m.id DESC LIMIT 1),
     -- Only removed learner messages are left: the first recording still waits for an answer.
     CASE WHEN EXISTS(SELECT 1 FROM public.pronunciation_messages m WHERE m.submission_id=s.id) THEN 'pending' ELSE s.status::text END)='pending'))
 INTO result;
 RETURN result;
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('error','request_failed','message','The request could not be completed.','sqlstate',SQLSTATE);
END $$;
REVOKE ALL ON FUNCTION public.get_staff_pronunciation_view() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_staff_pronunciation_view() TO authenticated;

-- ── 2. Aussprache: neue Nachricht holt das Gespräch zurück ───────────────
CREATE OR REPLACE FUNCTION pronunciation_private.reveal_conversation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 DELETE FROM pronunciation_private.staff_hidden_submissions WHERE submission_id=NEW.submission_id;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION pronunciation_private.reveal_conversation() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS pronunciation_message_reveal ON public.pronunciation_messages;
CREATE TRIGGER pronunciation_message_reveal AFTER INSERT ON public.pronunciation_messages
 FOR EACH ROW WHEN (NEW.sender_role='student') EXECUTE FUNCTION pronunciation_private.reveal_conversation();

-- Aussprache-Reiter im Schülerprofil: Ausgeblendetes erscheint auch dort nicht.
DO $patch$
DECLARE definition text; previous text; replacement text;
BEGIN
 SELECT pg_get_functiondef('public.get_teacher_student_detail(uuid,text,text)'::regprocedure) INTO definition;
 IF position('staff-hidden-v1' IN definition)=0 THEN
  previous:=$old$unanswered.sender_role='student' AND unanswered.audio_path IS NOT NULL$old$;
  replacement:=$new$unanswered.sender_role='student' AND unanswered.audio_path IS NOT NULL /* staff-hidden-v1 */ AND NOT EXISTS(SELECT 1 FROM pronunciation_private.staff_hidden_messages hidden WHERE hidden.message_id=unanswered.id)$new$;
  IF position(previous IN definition)=0 THEN RAISE EXCEPTION 'Unexpected get_teacher_student_detail unanswered definition'; END IF;
  definition:=replace(definition,previous,replacement);
  previous:=$old$FROM public.submissions s LEFT JOIN public.pronunciation_messages m ON m.submission_id=s.id WHERE s.auth_user_id=p_student_id AND s.type='audio' GROUP BY s.id)$old$;
  replacement:=$new$FROM public.submissions s LEFT JOIN public.pronunciation_messages m ON m.submission_id=s.id AND NOT EXISTS(SELECT 1 FROM pronunciation_private.staff_hidden_messages hidden WHERE hidden.message_id=m.id) WHERE s.auth_user_id=p_student_id AND s.type='audio' AND NOT EXISTS(SELECT 1 FROM pronunciation_private.staff_hidden_submissions hidden WHERE hidden.submission_id=s.id) GROUP BY s.id)$new$;
  IF position(previous IN definition)=0 THEN RAISE EXCEPTION 'Unexpected get_teacher_student_detail conversations definition'; END IF;
  EXECUTE replace(definition,previous,replacement);
 END IF;
END $patch$;

-- ── 3. Lernplattform-Profil löschen ──────────────────────────────────────
-- Nur von den beiden öffentlichen Funktionen aus erreichbar; sie prüfen die
-- Berechtigung. Fehler steigen dorthin auf und machen den Vorgang rückgängig.
CREATE OR REPLACE FUNCTION identity_private.remove_learning_profile(p_target uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE pending jsonb;
BEGIN
 IF p_target IS NULL THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 -- Same order as the learning reset, so both can never deadlock each other.
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||p_target::text,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:audio-catalog',0));
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:'||p_target::text,0));
 SELECT jsonb_agg(x.name ORDER BY x.name) INTO pending FROM (
  SELECT o.name FROM storage.objects o
  WHERE o.bucket_id='pronunciation_audio'
   AND (o.name LIKE p_target::text||'/%' OR o.owner_id=p_target::text
    -- Teacher replies inside this learner's conversations leave with them.
    OR EXISTS(SELECT 1 FROM public.pronunciation_messages m JOIN public.submissions s ON s.id=m.submission_id
     WHERE s.auth_user_id=p_target AND m.audio_path='storage://pronunciation_audio/'||o.name))
   AND NOT EXISTS(SELECT 1 FROM public.submissions s WHERE s.auth_user_id<>p_target AND s.content_url='storage://pronunciation_audio/'||o.name)
   AND NOT EXISTS(SELECT 1 FROM public.pronunciation_messages m JOIN public.submissions s ON s.id=m.submission_id
    WHERE s.auth_user_id<>p_target AND m.audio_path='storage://pronunciation_audio/'||o.name)
  ORDER BY o.name LIMIT 200) x;
 IF pending IS NOT NULL THEN RETURN jsonb_build_object('success',true,'deleted',false,'pendingAudio',pending); END IF;
 -- Messages name their sender without a cascade, and that check runs before the
 -- cascade through submissions would reach them: remove the conversations first.
 DELETE FROM public.pronunciation_messages WHERE submission_id IN(SELECT id FROM public.submissions WHERE auth_user_id=p_target);
 DELETE FROM public.submissions WHERE auth_user_id=p_target;
 -- Learner data without a foreign key to the profile.
 DELETE FROM vocabulary_private.answer_receipts WHERE auth_user_id=p_target;
 DELETE FROM learning_reset_private.jobs WHERE auth_user_id=p_target;
 -- Optional learning mails still waiting; booking and invoice mails are untouched.
 DELETE FROM private.mail_outbox WHERE status::text='pending'
  AND kind::text IN('feedback_available','level_access_granted','learning_reminder')
  AND (payload->>'authUserId'=p_target::text OR dedupe_key LIKE 'level-access:'||p_target::text||':%'
   OR dedupe_key LIKE 'learning-reminder:'||p_target::text||':%');
 -- profiles and every learning table cascade from the account;
 -- people.auth_user_id is ON DELETE SET NULL, so contact and billing data stay.
 DELETE FROM auth.users WHERE id=p_target;
 RETURN jsonb_build_object('success',true,'deleted',true);
END $$;
REVOKE ALL ON FUNCTION identity_private.remove_learning_profile(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.delete_own_learning_profile(p_confirmation text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); actor_role text;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated','message','Authentication is required.'); END IF;
 SELECT coalesce(role::text,'student') INTO actor_role FROM public.profiles WHERE id=actor;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found','message','Profile not found.'); END IF;
 -- Staff accounts carry bookings and invoices they confirmed; an administrator changes the role first.
 IF actor_role<>'student' THEN RETURN jsonb_build_object('error','not_authorized','message','Only learner profiles can be deleted here.'); END IF;
 IF p_confirmation IS DISTINCT FROM 'DELETE_LEARNING_PROFILE' THEN
  RETURN jsonb_build_object('error','invalid_input','message','Confirmation is required.'); END IF;
 RETURN identity_private.remove_learning_profile(actor);
EXCEPTION
 WHEN foreign_key_violation THEN
  RETURN jsonb_build_object('error','conflict','message','The profile is still referenced by staff records.','sqlstate',SQLSTATE);
 WHEN OTHERS THEN
  RETURN jsonb_build_object('error','request_failed','message','The request could not be completed.','sqlstate',SQLSTATE);
END $$;
REVOKE ALL ON FUNCTION public.delete_own_learning_profile(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_own_learning_profile(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_student_learning_profile(p_student_id uuid,p_confirmation text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); target_role text;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated','message','Authentication is required.'); END IF;
 IF coalesce(identity_private.current_profile_role(),'') NOT IN('teacher','admin') THEN
  RETURN jsonb_build_object('error','not_authorized','message','Staff access required.'); END IF;
 IF p_student_id IS NULL OR p_confirmation IS DISTINCT FROM 'DELETE_STUDENT_PROFILE' THEN
  RETURN jsonb_build_object('error','invalid_input','message','Confirmation is required.'); END IF;
 SELECT coalesce(role::text,'student') INTO target_role FROM public.profiles WHERE id=p_student_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found','message','Profile not found.'); END IF;
 -- Never the own account and never another teacher or administrator.
 IF p_student_id=actor OR target_role<>'student' THEN
  RETURN jsonb_build_object('error','not_authorized','message','Only learner profiles can be deleted.'); END IF;
 RETURN identity_private.remove_learning_profile(p_student_id);
EXCEPTION
 WHEN foreign_key_violation THEN
  RETURN jsonb_build_object('error','conflict','message','The profile is still referenced by staff records.','sqlstate',SQLSTATE);
 WHEN OTHERS THEN
  RETURN jsonb_build_object('error','request_failed','message','The request could not be completed.','sqlstate',SQLSTATE);
END $$;
REVOKE ALL ON FUNCTION public.delete_student_learning_profile(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_student_learning_profile(uuid,text) TO authenticated;

-- Regression guards (R10, maschinenlesbar).
DO $migration$
BEGIN
 IF has_table_privilege('authenticated','pronunciation_private.staff_hidden_submissions','SELECT')
  OR has_table_privilege('authenticated','pronunciation_private.staff_hidden_messages','SELECT')
  OR has_table_privilege('anon','pronunciation_private.staff_hidden_submissions','SELECT')
  OR has_table_privilege('anon','pronunciation_private.staff_hidden_messages','SELECT') THEN
  RAISE EXCEPTION 'phase2_staff_view_readable' USING ERRCODE='42501';
 END IF;
 IF has_function_privilege('anon','public.set_pronunciation_submission_hidden(uuid,boolean)','EXECUTE')
  OR has_function_privilege('anon','public.set_pronunciation_message_hidden(uuid,boolean)','EXECUTE')
  OR has_function_privilege('anon','public.get_staff_pronunciation_view()','EXECUTE')
  OR has_function_privilege('anon','public.delete_own_learning_profile(text)','EXECUTE')
  OR has_function_privilege('anon','public.delete_student_learning_profile(uuid,text)','EXECUTE')
  OR has_function_privilege('anon','identity_private.remove_learning_profile(uuid)','EXECUTE')
  OR has_function_privilege('authenticated','identity_private.remove_learning_profile(uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'phase2_delete_functions_public' USING ERRCODE='42501';
 END IF;
 -- The contract of this migration: deleting a profile must never delete the person.
 IF NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.contype='f' AND c.conrelid='public.people'::regclass
   AND c.confrelid='public.profiles'::regclass AND c.confdeltype='n') THEN
  RAISE EXCEPTION 'people_profile_link_must_be_set_null' USING ERRCODE='55000';
 END IF;
 IF NOT has_table_privilege(current_user,'auth.users','DELETE') THEN
  RAISE EXCEPTION 'function_owner_cannot_delete_accounts' USING ERRCODE='42501';
 END IF;
END $migration$;

NOTIFY pgrst, 'reload schema';

-- Consolidated correction: 58_path_authored_wrong_forms.sql
-- Master-Prompt Phase 4: an authored wrong form of a gap is never a typing error.
-- Function-only and repeatable; keeps owners, ACLs, content and learner data.
-- Apply after 57 through migrate-local.py with its backup and transaction.
-- Rollback: rollback/58_path_authored_wrong_forms.sql.
--
-- Typed gaps of the learning path are graded by learning_private.grade_answer,
-- which forgives one wrong letter in a word of four letters and more. The wrong
-- forms an author stores next to the solution (content.options: "einer" beside
-- "einem", "fahrt" beside "fährt") are exactly such neighbours, so a grammar
-- error passed as SOFT_ERROR in lessons, reviews and tests of every level.
--
--  * learning_private.grade_form_answer(): grades like grade_answer(), then
--    withdraws the tolerance where the form itself is the learning objective:
--    1. a tolerated answer (typo or spelled-out umlaut) that equals one of the
--       given wrong forms is INCORRECT;
--    2. if one of those wrong forms lies within the typing tolerance of the
--       solution, the task contrasts near-identical forms (einem/einer): there
--       no typo is forgiven at all, also not an unlisted one ("einen").
--    Exact answers, capitalisation, punctuation and the ae/oe/ue/ss spelling
--    of the solution keep their result, as do typos in every other task.
--  * path_private.grade(): passes content.options of a fill_in_blank task (also
--    inside a listening task) as those wrong forms. No other type has typed
--    text next to authored choices.
CREATE OR REPLACE FUNCTION learning_private.grade_form_answer(p_input text,p_accepted text[],p_wrong_forms text[]) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE grade jsonb:=learning_private.grade_answer(p_input,p_accepted); input_key text; form text; form_plain text;
 incorrect CONSTANT jsonb:=jsonb_build_object('status','INCORRECT','matched',NULL,'reason',NULL,'hint',NULL);
BEGIN
 -- Only tolerance results can be a wrong form: EXACT (including a neutral
 -- capitalisation/punctuation hint) and errors pass through unchanged.
 IF grade->>'status' IS DISTINCT FROM 'SOFT_ERROR' OR p_wrong_forms IS NULL THEN RETURN grade; END IF;
 -- Same key as the tolerance itself: case, punctuation and ae/oe/ue/ss spelling
 -- of the wrong form ("Einer.", "faehrt") do not turn it into a typing error.
 input_key:=learning_private.expand_german_letters(lower(learning_private.answer_without_punctuation(p_input)));
 FOREACH form IN ARRAY p_wrong_forms LOOP
  IF form IS NULL OR length(form)>4000 OR learning_private.normalize_answer(form)='' THEN CONTINUE; END IF;
  form_plain:=lower(learning_private.answer_without_punctuation(form));
  -- The option list of a gap also holds its solution: an accepted answer is
  -- no wrong form, so its own ae/oe/ue/ss spelling stays a forgiven umlaut.
  IF EXISTS(SELECT 1 FROM unnest(p_accepted) answer
   WHERE lower(learning_private.answer_without_punctuation(answer))=form_plain) THEN CONTINUE; END IF;
  IF learning_private.expand_german_letters(form_plain)=input_key THEN RETURN incorrect; END IF;
  IF grade->>'reason'='typo' AND learning_private.grade_answer(form,p_accepted)->>'status'='SOFT_ERROR' THEN RETURN incorrect; END IF;
 END LOOP;
 RETURN grade;
END $function$;
REVOKE ALL ON FUNCTION learning_private.grade_form_answer(text,text[],text[]) FROM PUBLIC,anon,authenticated,service_role;
-- Same cross-owner boundary as 15: legacy definer functions run as postgres.
GRANT EXECUTE ON FUNCTION learning_private.grade_form_answer(text,text[],text[]) TO postgres;

DO $patch$
DECLARE definition text; previous text; replacement text;
BEGIN
 SELECT pg_get_functiondef('path_private.grade(public.exercise_type,jsonb,jsonb)'::regprocedure) INTO definition;
 IF position('authored-wrong-forms-v1' IN definition)=0 THEN
  previous:=$old$  field_grade:=learning_private.grade_answer(p_answer->>'text',ARRAY(SELECT jsonb_array_elements_text(p_content->'accepted_answers')));$old$;
  replacement:=$new$  -- authored-wrong-forms-v1: stored wrong forms of a gap withdraw the typing tolerance.
  field_grade:=learning_private.grade_form_answer(p_answer->>'text',ARRAY(SELECT jsonb_array_elements_text(p_content->'accepted_answers')),
   CASE WHEN jsonb_typeof(p_content->'options')='array' THEN ARRAY(SELECT jsonb_array_elements_text(p_content->'options')) END);$new$;
  IF position(previous IN definition)=0 THEN RAISE EXCEPTION 'Unexpected path_private.grade typed answer definition'; END IF;
  EXECUTE replace(definition,previous,replacement);
 END IF;
END $patch$;

NOTIFY pgrst,'reload schema';

-- Sitov Academy daily quests. Additive, repeatable migration; no course grants
-- or existing learning progress is changed. Apply after 58 with the VPS runner.
-- There are six authored starter scenes, not a generated curriculum catalogue.
-- Rollback disables RPCs while retaining assignments, preferences and streaks.
CREATE SCHEMA IF NOT EXISTS daily_quest_private;
REVOKE ALL ON SCHEMA daily_quest_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA daily_quest_private TO authenticated,service_role;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_quests_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_quest_streak integer NOT NULL DEFAULT 0 CHECK(daily_quest_streak>=0);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_quest_longest_streak integer NOT NULL DEFAULT 0 CHECK(daily_quest_longest_streak>=daily_quest_streak);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_quest_last_completed_date date;
-- A table-level UPDATE would override column ACLs. Restore the known preferences
-- explicitly; even a direct REST update cannot forge a quest streak or role.
REVOKE UPDATE ON public.profiles FROM anon,authenticated;
REVOKE UPDATE(daily_quests_enabled,daily_quest_streak,daily_quest_longest_streak,daily_quest_last_completed_date) ON public.profiles FROM anon,authenticated;
GRANT UPDATE(native_language,ui_language,notify_pronunciation_feedback,notify_new_content,notify_learning_reminders) ON public.profiles TO authenticated;

CREATE TABLE IF NOT EXISTS public.daily_quests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 template_key text NOT NULL UNIQUE CHECK(length(template_key) BETWEEN 1 AND 120),
 level public.cefr_code NOT NULL REFERENCES public.cefr_levels(code),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 category text NOT NULL CHECK(category ~ '^[a-z0-9_-]{1,80}$'),
 fallback_word_de text NOT NULL DEFAULT 'Brötchen' CHECK(length(fallback_word_de) BETWEEN 1 AND 160),
 fallback_article text NOT NULL DEFAULT 'das' CHECK(fallback_article IN('der','die','das')),
 content jsonb NOT NULL CHECK(jsonb_typeof(content)='object'),
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS daily_quests_active_level_idx ON public.daily_quests(level,template_key) WHERE is_active;
ALTER TABLE public.daily_quests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sitov_daily_quests_read ON public.daily_quests;
CREATE POLICY sitov_daily_quests_read ON public.daily_quests FOR SELECT TO authenticated USING(is_active);
REVOKE ALL ON public.daily_quests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.daily_quests TO authenticated;
GRANT ALL ON public.daily_quests TO service_role;

CREATE TABLE IF NOT EXISTS daily_quest_private.template_keys(
 template_id uuid PRIMARY KEY REFERENCES public.daily_quests(id) ON DELETE CASCADE,
 answer_key jsonb NOT NULL CHECK(jsonb_typeof(answer_key)='object'));
-- Editorially reviewed German forms. Words not in this lexicon use the scene's
-- fallback; raw card labels are never blindly inserted after an article/verb.
CREATE TABLE IF NOT EXISTS daily_quest_private.slot_forms(
 category text NOT NULL,word_de text NOT NULL,article text NOT NULL CHECK(article IN('der','die','das')),
 nominative text NOT NULL,accusative text NOT NULL,
 PRIMARY KEY(category,word_de,article));
CREATE TABLE IF NOT EXISTS public.daily_quest_assignments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 auth_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 quest_date date NOT NULL,
 template_id uuid REFERENCES public.daily_quests(id) ON DELETE SET NULL,
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 status text NOT NULL DEFAULT 'active' CHECK(status IN('active','completed','skipped')),
 completed_step_ids text[] NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,skipped_at timestamptz,
 UNIQUE(auth_user_id,quest_date),
 CHECK((status='completed')=(completed_at IS NOT NULL)),CHECK((status='skipped')=(skipped_at IS NOT NULL)));
ALTER TABLE public.daily_quest_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sitov_daily_quest_assignment_read ON public.daily_quest_assignments;
CREATE POLICY sitov_daily_quest_assignment_read ON public.daily_quest_assignments FOR SELECT TO authenticated USING(auth_user_id=(SELECT auth.uid()));
REVOKE ALL ON public.daily_quest_assignments FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.daily_quest_assignments TO authenticated;
GRANT ALL ON public.daily_quest_assignments TO service_role;
CREATE TABLE IF NOT EXISTS daily_quest_private.assignment_keys(
 assignment_id uuid PRIMARY KEY REFERENCES public.daily_quest_assignments(id) ON DELETE CASCADE,
 answer_key jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS daily_quest_private.login_claims(
 auth_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 quest_date date NOT NULL,claimed_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(auth_user_id,quest_date));
REVOKE ALL ON ALL TABLES IN SCHEMA daily_quest_private FROM PUBLIC,anon,authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA daily_quest_private TO service_role;

CREATE OR REPLACE FUNCTION daily_quest_private.today() RETURNS date LANGUAGE sql STABLE SET search_path TO '' AS $$
 SELECT (now() AT TIME ZONE 'Europe/Berlin')::date
$$;
CREATE OR REPLACE FUNCTION daily_quest_private.error(p_error text) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
 SELECT jsonb_build_object('success',false,'error',p_error,'message',CASE p_error
 WHEN 'not_authenticated' THEN 'Bitte melde dich an.' WHEN 'not_authorized' THEN 'Diese Funktion ist für Schüler verfügbar.'
 WHEN 'disabled' THEN 'Die tägliche Deutschreise ist deaktiviert.' WHEN 'not_found' THEN 'Die Deutschreise ist nicht verfügbar.'
 WHEN 'expired' THEN 'Diese Deutschreise gehört zu einem anderen Tag.' WHEN 'steps_incomplete' THEN 'Schließe zuerst die drei Schritte ab.'
 WHEN 'step_out_of_order' THEN 'Schließe zuerst den vorherigen Schritt ab.' WHEN 'not_active' THEN 'Diese Deutschreise wurde bereits beendet.'
 WHEN 'no_template' THEN 'Heute ist keine passende Deutschreise verfügbar.' ELSE 'Die Anfrage ist ungültig.' END)
$$;
CREATE OR REPLACE FUNCTION daily_quest_private.streak(p_user uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path TO '' AS $$
 SELECT jsonb_build_object('current',CASE WHEN p.daily_quest_last_completed_date>=daily_quest_private.today()-1 THEN p.daily_quest_streak ELSE 0 END,
  'longest',p.daily_quest_longest_streak,'lastCompletedDate',p.daily_quest_last_completed_date)
 FROM public.profiles p WHERE p.id=p_user
$$;
CREATE OR REPLACE FUNCTION daily_quest_private.quest(p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path TO '' AS $$
 SELECT a.snapshot || jsonb_build_object('id',a.id,'date',a.quest_date,'status',a.status,'completedStepIds',to_jsonb(a.completed_step_ids))
 FROM public.daily_quest_assignments a WHERE a.id=p_id
$$;
CREATE OR REPLACE FUNCTION daily_quest_private.target_level(p_user uuid) RETURNS public.cefr_code
LANGUAGE plpgsql STABLE SET search_path TO '' AS $$
DECLARE levels constant text[]:=ARRAY['A1','A2','B1','B2','C1','C2']; base integer:=1; mastered integer:=0; chosen text; activity jsonb;
BEGIN
 activity:=public.get_last_active_level();
 SELECT coalesce(array_position(levels,l.cefr_level::text),1) INTO base FROM public.learning_levels l WHERE l.code=activity->>'level';
 base:=coalesce(base,1);
 -- Both real sublevels must have a published test. Empty/incomplete catalogues
 -- never imply mastery, and one good test cannot stand in for every other test.
 SELECT coalesce(max(array_position(levels,c.code::text)),0) INTO mastered FROM public.cefr_levels c
 WHERE NOT EXISTS(SELECT 1 FROM unnest(ARRAY[c.code::text||'.1',c.code::text||'.2']) part(code)
  WHERE NOT EXISTS(SELECT 1 FROM public.learning_levels l JOIN public.learning_units u ON u.level=l.code AND u.is_path AND u.is_active
    JOIN public.path_nodes n ON n.unit_id=u.id AND n.kind='test' AND n.is_active
    WHERE l.code=part.code AND l.cefr_level=c.code AND l.is_active)
   OR NOT EXISTS(SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=p_user AND a.level=part.code))
 AND NOT EXISTS(SELECT 1 FROM public.learning_levels l JOIN public.learning_units u ON u.level=l.code AND u.is_path AND u.is_active
  JOIN public.path_nodes n ON n.unit_id=u.id AND n.kind='test' AND n.is_active
  WHERE l.cefr_level=c.code AND l.is_active AND NOT EXISTS(SELECT 1 FROM public.path_test_attempts a
   WHERE a.auth_user_id=p_user AND a.node_id=n.id AND a.status='completed' AND a.is_active AND a.percentage>=80));
 SELECT q.level::text INTO chosen FROM public.daily_quests q JOIN daily_quest_private.template_keys k ON k.template_id=q.id
 WHERE q.is_active AND array_position(levels,q.level::text)<=least(6,greatest(base,mastered+1))
 ORDER BY array_position(levels,q.level::text) DESC,q.template_key LIMIT 1;
 RETURN chosen::public.cefr_code;
END $$;

-- Recursive substitution preserves JSON types and safely escapes German text.
-- Only editorial placeholders are substituted; no SQL/HTML is constructed.
CREATE OR REPLACE FUNCTION daily_quest_private.render(p_value jsonb,p_nominative text,p_accusative text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $$
DECLARE rendered jsonb; entry record; raw text;
BEGIN
 CASE jsonb_typeof(p_value)
 WHEN 'object' THEN SELECT coalesce(jsonb_object_agg(e.key,daily_quest_private.render(e.value,p_nominative,p_accusative)),'{}') INTO rendered FROM jsonb_each(p_value) e;
 WHEN 'array' THEN SELECT coalesce(jsonb_agg(daily_quest_private.render(e.value,p_nominative,p_accusative) ORDER BY e.ordinality),'[]') INTO rendered FROM jsonb_array_elements(p_value) WITH ORDINALITY e(value,ordinality);
 WHEN 'string' THEN raw:=p_value#>>'{}'; rendered:=to_jsonb(replace(replace(raw,'{{nominative}}',p_nominative),'{{accusative}}',p_accusative));
 ELSE rendered:=p_value;
 END CASE;
 RETURN rendered;
END $$;

CREATE OR REPLACE FUNCTION daily_quest_private.ensure_assignment(p_user uuid) RETURNS uuid
LANGUAGE plpgsql VOLATILE SET search_path TO '' AS $$
DECLARE assigned uuid; template public.daily_quests%ROWTYPE; lexeme daily_quest_private.slot_forms%ROWTYPE;
 card uuid; source text:='fallback'; payload jsonb; keys jsonb; target public.cefr_code;
BEGIN
 SELECT a.id INTO assigned FROM public.daily_quest_assignments a WHERE a.auth_user_id=p_user AND a.quest_date=daily_quest_private.today();
 IF assigned IS NOT NULL THEN RETURN assigned; END IF;
 target:=daily_quest_private.target_level(p_user);
 -- Stable day-based rotation over actual published templates; snapshots ensure
 -- later content edits and changed word boxes cannot change an assigned quest.
 SELECT q.* INTO template FROM public.daily_quests q JOIN daily_quest_private.template_keys k ON k.template_id=q.id
 WHERE q.is_active AND q.level=target ORDER BY md5(q.template_key||daily_quest_private.today()::text),q.id LIMIT 1;
 IF template.id IS NULL THEN RETURN NULL; END IF;
 SELECT sf.*,c.id,CASE WHEN bool_or(p.box_number=1) THEN 'box1' ELSE 'recent_wrong' END
 INTO lexeme.category,lexeme.word_de,lexeme.article,lexeme.nominative,lexeme.accusative,card,source
 FROM public.learning_vocabulary_cards c JOIN public.learning_units u ON u.id=c.unit_id AND u.is_active
 JOIN daily_quest_private.slot_forms sf ON sf.category=template.category AND sf.word_de=c.word_de AND sf.article=c.article::text
 JOIN public.vocabulary_direction_progress p ON p.card_id=c.id AND p.auth_user_id=p_user
 LEFT JOIN public.vocabulary_focus_words f ON f.card_id=c.id AND f.auth_user_id=p_user
 WHERE learning_private.unit_allowed(u.id) AND (f.last_error_at>=now()-interval '30 days'
  OR (p.lapses>0 AND p.last_answered_at>=now()-interval '30 days')
  OR EXISTS(SELECT 1 FROM vocabulary_private.answer_receipts r WHERE r.auth_user_id=p_user AND r.progress_id=p.id
   AND r.is_correct=false AND r.created_at>=now()-interval '30 days'))
 GROUP BY sf.category,sf.word_de,sf.article,sf.nominative,sf.accusative,c.id
 ORDER BY bool_or(p.box_number=1) DESC,max(greatest(p.last_answered_at,f.last_error_at)) DESC NULLS LAST,c.id LIMIT 1;
 IF card IS NULL THEN SELECT sf.* INTO lexeme FROM daily_quest_private.slot_forms sf WHERE sf.category=template.category AND sf.word_de=template.fallback_word_de AND sf.article=template.fallback_article; source:='fallback'; END IF;
 IF lexeme.word_de IS NULL THEN RETURN NULL; END IF;
 payload:=daily_quest_private.render(template.content,lexeme.nominative,lexeme.accusative)
  || jsonb_build_object('level',template.level,'templateKey',template.template_key,'personalization',jsonb_build_object('source',source,'cardId',card));
 SELECT k.answer_key INTO keys FROM daily_quest_private.template_keys k WHERE k.template_id=template.id;
 INSERT INTO public.daily_quest_assignments(auth_user_id,quest_date,template_id,snapshot)
 VALUES(p_user,daily_quest_private.today(),template.id,payload) RETURNING id INTO assigned;
 INSERT INTO daily_quest_private.assignment_keys(assignment_id,answer_key) VALUES(assigned,keys);
 RETURN assigned;
END $$;

-- The only client-callable private definer. Profile first, assignment second is
-- the lock order for every mutation, including opt-out, claim and completion.
-- The unique (user, Berlin day) keys also protect against racing browser tabs.
CREATE OR REPLACE FUNCTION daily_quest_private.handle(p_action text,p_assignment_id uuid DEFAULT NULL,p_step_id text DEFAULT NULL,p_answer jsonb DEFAULT NULL,p_enabled boolean DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); profile public.profiles%ROWTYPE; assignment public.daily_quest_assignments%ROWTYPE;
 assigned uuid; today date:=daily_quest_private.today(); changed integer; keys jsonb; step jsonb; step_index integer; correct boolean:=false;
 ids jsonb; feedback text; claim boolean:=false;
BEGIN
 IF actor IS NULL THEN RETURN daily_quest_private.error('not_authenticated'); END IF;
 IF p_action IS NULL OR p_action NOT IN('claim','get','status','preference','submit','skip','complete') THEN RETURN daily_quest_private.error('invalid_input'); END IF;
 SELECT p.* INTO profile FROM public.profiles p WHERE p.id=actor FOR UPDATE;
 IF profile.id IS NULL OR profile.role::text IS DISTINCT FROM 'student' THEN RETURN daily_quest_private.error('not_authorized'); END IF;
 IF p_action='preference' THEN
  IF p_enabled IS NULL THEN RETURN daily_quest_private.error('invalid_input'); END IF;
  UPDATE public.profiles SET daily_quests_enabled=p_enabled WHERE id=actor; profile.daily_quests_enabled:=p_enabled;
 END IF;
 IF p_action IN('status','preference') THEN
  SELECT a.* INTO assignment FROM public.daily_quest_assignments a WHERE a.auth_user_id=actor AND a.quest_date=today;
  RETURN jsonb_build_object('success',true,'enabled',profile.daily_quests_enabled,'streak',daily_quest_private.streak(actor),
   'today',CASE WHEN assignment.id IS NULL THEN NULL ELSE jsonb_build_object('assignmentId',assignment.id,'status',assignment.status) END);
 END IF;
 IF p_action IN('get','claim') THEN
  IF profile.daily_quests_enabled THEN assigned:=daily_quest_private.ensure_assignment(actor); END IF;
  IF p_action='get' THEN RETURN jsonb_build_object('success',true,'enabled',profile.daily_quests_enabled,
   'quest',daily_quest_private.quest(assigned),'streak',daily_quest_private.streak(actor)); END IF;
  IF assigned IS NOT NULL THEN
   INSERT INTO daily_quest_private.login_claims(auth_user_id,quest_date) VALUES(actor,today) ON CONFLICT DO NOTHING;
   GET DIAGNOSTICS changed=ROW_COUNT;
   SELECT a.status='active' INTO claim FROM public.daily_quest_assignments a WHERE a.id=assigned;
   claim:=changed=1 AND claim;
  END IF;
  RETURN jsonb_build_object('success',true,'enabled',profile.daily_quests_enabled,'shouldRedirect',claim,'assignmentId',assigned,'date',today);
 END IF;
 IF NOT profile.daily_quests_enabled THEN RETURN daily_quest_private.error('disabled'); END IF;
 SELECT a.* INTO assignment FROM public.daily_quest_assignments a WHERE a.id=p_assignment_id AND a.auth_user_id=actor FOR UPDATE;
 IF assignment.id IS NULL THEN RETURN daily_quest_private.error('not_found'); END IF;
 IF assignment.quest_date<>today THEN RETURN daily_quest_private.error('expired'); END IF;
 IF p_action='complete' AND assignment.status='completed' THEN
  RETURN jsonb_build_object('success',true,'quest',daily_quest_private.quest(assignment.id),'streak',daily_quest_private.streak(actor));
 END IF;
 IF p_action='skip' AND assignment.status='skipped' THEN
  RETURN jsonb_build_object('success',true,'quest',daily_quest_private.quest(assignment.id),'streak',daily_quest_private.streak(actor));
 END IF;
 IF assignment.status<>'active' THEN RETURN daily_quest_private.error('not_active'); END IF;
 PERFORM learning_reset_private.assert_writable(actor);
 IF p_action='skip' THEN
  UPDATE public.daily_quest_assignments SET status='skipped',skipped_at=now() WHERE id=assignment.id;
 ELSIF p_action='complete' THEN
  IF assignment.completed_step_ids<>ARRAY(SELECT e.value->>'id' FROM jsonb_array_elements(assignment.snapshot->'steps') WITH ORDINALITY e(value,ordinality) ORDER BY e.ordinality) THEN RETURN daily_quest_private.error('steps_incomplete'); END IF;
  UPDATE public.daily_quest_assignments SET status='completed',completed_at=now() WHERE id=assignment.id;
  -- Only one increase per server day, even if an operational retry is replayed.
  IF profile.daily_quest_last_completed_date IS DISTINCT FROM today THEN
   changed:=CASE WHEN profile.daily_quest_last_completed_date=today-1 THEN profile.daily_quest_streak+1 ELSE 1 END;
   UPDATE public.profiles SET daily_quest_streak=changed,daily_quest_longest_streak=greatest(daily_quest_longest_streak,changed),daily_quest_last_completed_date=today WHERE id=actor;
  END IF;
 ELSIF p_action='submit' THEN
  IF p_step_id IS NULL OR jsonb_typeof(p_answer) IS DISTINCT FROM 'object' OR octet_length(p_answer::text)>8000 THEN RETURN daily_quest_private.error('invalid_input'); END IF;
  SELECT e.value,(e.ordinality-1)::integer INTO step,step_index FROM jsonb_array_elements(assignment.snapshot->'steps') WITH ORDINALITY e(value,ordinality) WHERE e.value->>'id'=p_step_id;
  IF step IS NULL THEN RETURN daily_quest_private.error('invalid_input'); END IF;
  IF NOT p_step_id=ANY(assignment.completed_step_ids) AND step_index<>cardinality(assignment.completed_step_ids) THEN RETURN daily_quest_private.error('step_out_of_order'); END IF;
  SELECT k.answer_key INTO keys FROM daily_quest_private.assignment_keys k WHERE k.assignment_id=assignment.id;
  CASE step->>'kind'
   WHEN 'discover' THEN
    ids:=p_answer->'wordIds';
    IF jsonb_typeof(ids) IS DISTINCT FROM 'array' THEN RETURN daily_quest_private.error('invalid_input'); END IF;
    IF jsonb_array_length(ids)<>jsonb_array_length(step->'words') OR (p_answer-'wordIds')<>'{}'::jsonb THEN RETURN daily_quest_private.error('invalid_input'); END IF;
    SELECT coalesce(jsonb_agg(e.value ORDER BY e.value),'[]')=(SELECT jsonb_agg(w.value->'id' ORDER BY w.value->'id') FROM jsonb_array_elements(step->'words') w(value)) INTO correct FROM jsonb_array_elements(ids) e(value);
   WHEN 'sentence_build' THEN
    ids:=p_answer->'pieceIds';
    IF jsonb_typeof(ids) IS DISTINCT FROM 'array' THEN RETURN daily_quest_private.error('invalid_input'); END IF;
    IF jsonb_array_length(ids)>30 OR (p_answer-'pieceIds')<>'{}'::jsonb THEN RETURN daily_quest_private.error('invalid_input'); END IF;
    SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(keys->'steps'->p_step_id->'accepted') accepted WHERE accepted=ids) INTO correct;
   WHEN 'dialogue_choice' THEN
    IF jsonb_typeof(p_answer->'optionId') IS DISTINCT FROM 'string' OR (p_answer-'optionId')<>'{}'::jsonb THEN RETURN daily_quest_private.error('invalid_input'); END IF;
    correct:=coalesce(p_answer->>'optionId'=keys->'steps'->p_step_id->>'optionId',false);
   ELSE RETURN daily_quest_private.error('invalid_input');
  END CASE;
  IF correct AND NOT p_step_id=ANY(assignment.completed_step_ids) THEN
   UPDATE public.daily_quest_assignments SET completed_step_ids=array_append(completed_step_ids,p_step_id) WHERE id=assignment.id;
  END IF;
  feedback:=CASE WHEN correct THEN coalesce(keys->'feedback'->p_step_id->>'correct','Gut gemacht!') ELSE coalesce(keys->'feedback'->p_step_id->>'wrong','Versuche es noch einmal.') END;
  RETURN jsonb_build_object('success',true,'correct',correct,'feedback',feedback,'quest',daily_quest_private.quest(assignment.id),'streak',daily_quest_private.streak(actor));
 END IF;
 RETURN jsonb_build_object('success',true,'quest',daily_quest_private.quest(assignment.id),'streak',daily_quest_private.streak(actor));
END $$;

CREATE OR REPLACE FUNCTION public.claim_daily_quest_login() RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO '' AS $$ SELECT daily_quest_private.handle('claim') $$;
CREATE OR REPLACE FUNCTION public.get_daily_quest() RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO '' AS $$ SELECT daily_quest_private.handle('get') $$;
CREATE OR REPLACE FUNCTION public.get_daily_quest_status() RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO '' AS $$ SELECT daily_quest_private.handle('status') $$;
CREATE OR REPLACE FUNCTION public.set_daily_quest_enabled(p_enabled boolean) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO '' AS $$ SELECT daily_quest_private.handle('preference',p_enabled=>p_enabled) $$;
CREATE OR REPLACE FUNCTION public.submit_daily_quest_step(p_assignment_id uuid,p_step_id text,p_answer jsonb) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO '' AS $$ SELECT daily_quest_private.handle('submit',p_assignment_id,p_step_id,p_answer) $$;
CREATE OR REPLACE FUNCTION public.skip_daily_quest(p_assignment_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO '' AS $$ SELECT daily_quest_private.handle('skip',p_assignment_id) $$;
CREATE OR REPLACE FUNCTION public.complete_daily_quest(p_assignment_id uuid) RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path TO '' AS $$ SELECT daily_quest_private.handle('complete',p_assignment_id) $$;
-- An editorial preview returns answer keys exclusively to a live staff role.
-- It never calls ensure_assignment/handle or writes profile, claim or progress.
CREATE OR REPLACE FUNCTION daily_quest_private.preview(p_level text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); staff_role text; template public.daily_quests%ROWTYPE;
 lexeme daily_quest_private.slot_forms%ROWTYPE; payload jsonb; keys jsonb;
BEGIN
 IF actor IS NULL THEN RETURN daily_quest_private.error('not_authenticated'); END IF;
 SELECT p.role::text INTO staff_role FROM public.profiles p WHERE p.id=actor;
 IF staff_role IS NULL OR staff_role NOT IN('teacher','admin') THEN
  RETURN jsonb_build_object('success',false,'error','not_authorized','message','Diese Vorschau ist für Lehrkräfte verfügbar.');
 END IF;
 IF p_level IS NULL OR p_level NOT IN('A1','A2','B1','B2','C1','C2') THEN RETURN daily_quest_private.error('invalid_input'); END IF;
 SELECT q.* INTO template
 FROM public.daily_quests q JOIN daily_quest_private.template_keys k ON k.template_id=q.id
 WHERE q.is_active AND q.level::text=p_level ORDER BY q.template_key,q.id LIMIT 1;
 IF template.id IS NULL THEN RETURN daily_quest_private.error('no_template'); END IF;
 SELECT k.answer_key INTO keys FROM daily_quest_private.template_keys k WHERE k.template_id=template.id;
 SELECT sf.* INTO lexeme FROM daily_quest_private.slot_forms sf WHERE sf.category=template.category
  AND sf.word_de=template.fallback_word_de AND sf.article=template.fallback_article;
 IF lexeme.word_de IS NULL THEN RETURN daily_quest_private.error('no_template'); END IF;
 payload:=daily_quest_private.render(template.content,lexeme.nominative,lexeme.accusative) || jsonb_build_object(
  'id',template.id,'date',daily_quest_private.today(),'level',template.level,'templateKey',template.template_key,
  'status','active','completedStepIds','[]'::jsonb,'personalization',jsonb_build_object('source','fallback','cardId',NULL));
 RETURN jsonb_build_object('success',true,'quest',payload,'answerKey',jsonb_build_object('steps',keys->'steps'));
END $$;
CREATE OR REPLACE FUNCTION public.get_daily_quest_preview(p_level text DEFAULT 'A1') RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $$ SELECT daily_quest_private.preview(p_level) $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA daily_quest_private FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION daily_quest_private.handle(text,uuid,text,jsonb,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION daily_quest_private.preview(text) TO authenticated;
REVOKE ALL ON FUNCTION public.claim_daily_quest_login(),public.get_daily_quest(),public.get_daily_quest_status(),public.set_daily_quest_enabled(boolean),public.submit_daily_quest_step(uuid,text,jsonb),public.skip_daily_quest(uuid),public.complete_daily_quest(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_quest_login(),public.get_daily_quest(),public.get_daily_quest_status(),public.set_daily_quest_enabled(boolean),public.submit_daily_quest_step(uuid,text,jsonb),public.skip_daily_quest(uuid),public.complete_daily_quest(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_daily_quest_preview(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_quest_preview(text) TO authenticated;

INSERT INTO public.cefr_levels(code) SELECT unnest(enum_range(NULL::public.cefr_code)) ON CONFLICT DO NOTHING;
INSERT INTO daily_quest_private.slot_forms(category,word_de,article,nominative,accusative) VALUES
 ('food','Brötchen','das','das Brötchen','ein Brötchen'),('food','Brot','das','das Brot','ein Brot'),
 ('food','Apfel','der','der Apfel','einen Apfel'),('food','Banane','die','die Banane','eine Banane'),
 ('food','Kuchen','der','der Kuchen','einen Kuchen'),('food','Brezel','die','die Brezel','eine Brezel'),
 ('food','Croissant','das','das Croissant','ein Croissant') ON CONFLICT DO NOTHING;

-- Authored starter scenes progressively introduce polite requests, subordinate
-- clauses, Konjunktiv II, negotiation, contrast and nuanced formal register.
DO $seed$
DECLARE item record; template uuid; words jsonb; pieces jsonb; choices jsonb; content jsonb; answer jsonb; seed_updated boolean; seed_version integer;
BEGIN
 FOR item IN SELECT * FROM (VALUES
  ('A1','sitov-bakery-breakfast','Beim Bäcker','Hol dir ein kleines Frühstück.','Bäckerei','bakery',
   'Guten Morgen! Was möchten Sie?','Ich möchte {{accusative}}, bitte.',
   '[{"id":"ich","text":"Ich"},{"id":"moechte","text":"möchte"},{"id":"food","text":"{{accusative}}"},{"id":"bitte","text":", bitte."}]',
   '[["ich","moechte","food","bitte"]]','Möchten Sie eine Tüte dazu?','Ja, bitte. Eine Tüte.','Ich heiße Anna.','Das ist mein Bahnhof.'),
  ('A2','sitov-picnic-plan','Ein Picknick planen','Erkläre, was du für unterwegs brauchst.','Bäckerei','bakery',
   'Was brauchen Sie für Ihr Picknick?','Ich nehme {{accusative}}, weil ich später Hunger habe.',
   '[{"id":"ich","text":"Ich"},{"id":"nehme","text":"nehme"},{"id":"food","text":"{{accusative}}"},{"id":"weil","text":", weil"},{"id":"ich2","text":"ich"},{"id":"spaeter","text":"später"},{"id":"hunger","text":"Hunger"},{"id":"habe","text":"habe."}]',
   '[["ich","nehme","food","weil","ich2","spaeter","hunger","habe"]]','Wir haben auch gekühlte Getränke. Möchten Sie eins?','Ja, gern. Ich nehme noch ein Wasser.','Gestern war Montag.','Ich fahre mit dem Fahrrad zur Schule.'),
  ('B1','sitov-order-change','Eine Bestellung ändern','Äußere höflich einen Änderungswunsch.','Bäckerei','bakery',
   'Ihre Bestellung ist noch nicht fertig. Kann ich etwas ändern?','Könnten Sie mir bitte {{accusative}} statt des Sandwichs geben?',
   '[{"id":"koennten","text":"Könnten"},{"id":"sie","text":"Sie"},{"id":"mir","text":"mir"},{"id":"bitte","text":"bitte"},{"id":"food","text":"{{accusative}}"},{"id":"statt","text":"statt des Sandwichs"},{"id":"geben","text":"geben?"}]',
   '[["koennten","sie","mir","bitte","food","statt","geben"],["koennten","sie","mir","food","bitte","statt","geben"],["koennten","sie","mir","food","statt","bitte","geben"]]',
   'Natürlich. Die Änderung kostet einen Euro mehr. Ist das in Ordnung?','Ja, das ist in Ordnung. Vielen Dank für Ihre Hilfe.','Nein, Sie müssen alles kostenlos machen.','Mein Zug fährt um acht Uhr ab.'),
  ('B2','sitov-catering-alternative','Eine Alternative aushandeln','Begründe einen Vorschlag für die Gruppe.','Besprechung in der Bäckerei','bakery',
   'Für das Teamfrühstück haben wir nur ein kleines Budget. Was schlagen Sie vor?',
   'Ich würde {{accusative}} bestellen, sofern das Budget dafür ausreicht.',
   '[{"id":"ich","text":"Ich"},{"id":"wuerde","text":"würde"},{"id":"food","text":"{{accusative}}"},{"id":"bestellen","text":"bestellen"},{"id":"sofern","text":", sofern"},{"id":"budget","text":"das Budget"},{"id":"dafuer","text":"dafür"},{"id":"ausreicht","text":"ausreicht."}]',
   '[["ich","wuerde","food","bestellen","sofern","budget","dafuer","ausreicht"],["ich","wuerde","food","bestellen","sofern","dafuer","budget","ausreicht"]]',
   'Eine kleinere Bestellung wäre günstiger, reicht aber vielleicht nicht für alle.','Dann sollten wir erst die Teilnehmerzahl klären und die Menge entsprechend anpassen.','Bestellen Sie trotzdem alles, unabhängig von den Kosten.','Ich finde das Wetter heute schön.'),
  ('C1','sitov-local-sourcing','Regional einkaufen','Wäge Kosten und Herkunft differenziert ab.','Gespräch in der Bäckerei','bakery',
   'Regionale Zutaten sind teurer. Wie wichtig ist Ihnen die Herkunft?',
   'Ich würde {{accusative}} bevorzugen, wenngleich dafür ein Aufpreis anfällt.',
   '[{"id":"ich","text":"Ich"},{"id":"wuerde","text":"würde"},{"id":"food","text":"{{accusative}}"},{"id":"bevorzugen","text":"bevorzugen"},{"id":"wenngleich","text":", wenngleich"},{"id":"dafuer","text":"dafür"},{"id":"aufpreis","text":"ein Aufpreis"},{"id":"anfaellt","text":"anfällt."}]',
   '[["ich","wuerde","food","bevorzugen","wenngleich","dafuer","aufpreis","anfaellt"],["ich","wuerde","food","bevorzugen","wenngleich","aufpreis","dafuer","anfaellt"]]',
   'Können Sie diesen Aufpreis gegenüber Ihrem Team vertreten?','Ja, sofern wir die Herkunft nachvollziehbar belegen und die Mehrkosten transparent kommunizieren.','Regionale Produkte sind ausnahmslos billiger.','Über Kosten sollte grundsätzlich niemand sprechen.'),
  ('C2','sitov-menu-deliberation','Ein Konzept präzisieren','Formuliere eine Einschränkung diplomatisch.','Frühstücksplanung in der Bäckerei','bakery',
   'Ihr Vorschlag klingt gut. Welche Einschränkung sollten wir noch berücksichtigen?',
   'Ich würde {{accusative}} vorsehen, wobei die endgültige Auswahl unter dem Vorbehalt saisonaler Verfügbarkeit steht.',
   '[{"id":"ich","text":"Ich"},{"id":"wuerde","text":"würde"},{"id":"food","text":"{{accusative}}"},{"id":"vorsehen","text":"vorsehen"},{"id":"wobei","text":", wobei"},{"id":"auswahl","text":"die endgültige Auswahl"},{"id":"vorbehalt","text":"unter dem Vorbehalt"},{"id":"verfuegbarkeit","text":"saisonaler Verfügbarkeit"},{"id":"steht","text":"steht."}]',
   '[["ich","wuerde","food","vorsehen","wobei","auswahl","vorbehalt","verfuegbarkeit","steht"]]',
   'Dann können wir die Auswahl heute also verbindlich zusagen?','Das Grundkonzept können wir zusagen; bei den einzelnen Produkten sollten wir uns jedoch eine gleichwertige Alternative vorbehalten.','Ja, ungeachtet der ausdrücklich genannten Einschränkung.','Eine verbindliche Zusage ist generell bedeutungslos.')
 ) AS v(level,key,title,subtitle,location,background,intro,sentence,pieces,accepted,dialogue,right_answer,wrong1,wrong2)
 LOOP
  words:=jsonb_build_array(jsonb_build_object('id','food','text','{{nominative}}','audioText','{{nominative}}'),
   jsonb_build_object('id','coffee','text','der Kaffee','audioText','der Kaffee'),jsonb_build_object('id','bag','text','die Tüte','audioText','die Tüte'));
  pieces:=item.pieces::jsonb;
  -- Correct position rotates by level; the public list never carries a flag.
  IF item.level IN('A1','B2') THEN choices:=jsonb_build_array(jsonb_build_object('id','b','text',item.wrong1),jsonb_build_object('id','a','text',item.right_answer),jsonb_build_object('id','c','text',item.wrong2));
  ELSIF item.level IN('A2','C1') THEN choices:=jsonb_build_array(jsonb_build_object('id','c','text',item.wrong2),jsonb_build_object('id','b','text',item.wrong1),jsonb_build_object('id','a','text',item.right_answer));
  ELSE choices:=jsonb_build_array(jsonb_build_object('id','a','text',item.right_answer),jsonb_build_object('id','c','text',item.wrong2),jsonb_build_object('id','b','text',item.wrong1)); END IF;
  -- Token bank is different from accepted sentence order, even on a reload.
  SELECT jsonb_agg(e.value ORDER BY md5(item.key||(e.value->>'id'))) INTO pieces FROM jsonb_array_elements(pieces) e(value);
  content:=jsonb_build_object('title',item.title,'subtitle',item.subtitle,'scene',jsonb_build_object('backgroundKey',item.background,'backgroundImage','/Bilder/deutschreise/bakery-scene.png','imageAlt','Eine Verkäuferin hinter der Theke einer Bäckerei.',
   'location',item.location,'audioText',item.intro,'speakerId','host','characters',jsonb_build_array(jsonb_build_object('id','host','name','Mara','voice','female'),jsonb_build_object('id','learner','name','Du','voice','male'))),
   'steps',jsonb_build_array(jsonb_build_object('id','discover','kind','discover','instruction','Entdecke die drei Wörter. Tippe sie an.','words',words),
    jsonb_build_object('id','build','kind','sentence_build','speakerId','learner','prompt',CASE WHEN item.level='A1' THEN 'Bestelle höflich. Setze den Satz zusammen.' ELSE 'Formuliere deine Antwort. Setze den Satz zusammen.' END,'pieces',pieces,'audioText',item.sentence),
    jsonb_build_object('id','dialogue','kind','dialogue_choice','speakerId','host','prompt',item.dialogue,'options',choices,'audioText',item.dialogue)),
   'completion',jsonb_build_object('title','Deutsch im Alltag geschafft!','text','Du hast Wörter entdeckt, einen Satz gebaut und passend geantwortet.'));
  -- Versioned editorial correction. Existing assignments retain their frozen
  -- content AND keys. Equal/newer authored template versions are preserved.
  seed_version:=CASE WHEN item.level IN('A1','B1','B2','C1') THEN 2 ELSE 1 END;
  INSERT INTO public.daily_quests(template_key,level,version,category,content) VALUES(item.key,item.level::public.cefr_code,seed_version,'food',content)
   ON CONFLICT(template_key) DO UPDATE SET version=excluded.version,content=excluded.content,updated_at=now()
    WHERE public.daily_quests.version<excluded.version RETURNING id INTO template;
  seed_updated:=template IS NOT NULL;
  IF template IS NULL THEN SELECT id INTO template FROM public.daily_quests WHERE template_key=item.key; END IF;
  answer:=jsonb_build_object('steps',jsonb_build_object('build',jsonb_build_object('accepted',item.accepted::jsonb),'dialogue',jsonb_build_object('optionId','a')),'feedback',jsonb_build_object(
   'discover',jsonb_build_object('correct','Gut! Die drei Wörter begleiten dich durch die Szene.','wrong','Entdecke zuerst alle drei Wörter.'),
   'build',jsonb_build_object('correct','Der Satz passt. Weiter geht es im Gespräch.','wrong','Prüfe die Reihenfolge. Achte auf die Position des Verbs.'),
   'dialogue',jsonb_build_object('correct','Das passt zur Frage. Deine Deutschreise ist geschafft!','wrong','Lies die Frage noch einmal und wähle eine passende Antwort.')));
  IF seed_updated THEN
   INSERT INTO daily_quest_private.template_keys(template_id,answer_key) VALUES(template,answer)
    ON CONFLICT(template_id) DO UPDATE SET answer_key=excluded.answer_key;
  ELSE
   INSERT INTO daily_quest_private.template_keys(template_id,answer_key) VALUES(template,answer) ON CONFLICT DO NOTHING;
  END IF;
 END LOOP;
END $seed$;

COMMENT ON TABLE public.daily_quests IS 'Six authored starter scenes, one per CEFR family. Public content has no answer keys; new scenes may be added without frontend changes.';
COMMENT ON TABLE public.daily_quest_assignments IS 'Frozen safe quest snapshot per learner and Berlin day; writable only through actor-checked RPCs. Not a course-level entitlement.';
NOTIFY pgrst,'reload schema';

-- Consolidated correction: 60_daily_quest_resume.sql
-- Sitov Academy: leaving today's journey is navigation, not abandonment.
-- Restore current-day assignments made unavailable by the previous skip action.
-- Historical assignments and earned streaks remain intact; verified steps survive.
UPDATE public.daily_quest_assignments
SET status='active', skipped_at=NULL
WHERE status='skipped' AND quest_date>=daily_quest_private.today();

CREATE OR REPLACE FUNCTION daily_quest_private.handle(p_action text,p_assignment_id uuid DEFAULT NULL,p_step_id text DEFAULT NULL,p_answer jsonb DEFAULT NULL,p_enabled boolean DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); profile public.profiles%ROWTYPE; assignment public.daily_quest_assignments%ROWTYPE;
 assigned uuid; today date:=daily_quest_private.today(); changed integer; keys jsonb; step jsonb; step_index integer; correct boolean:=false;
 ids jsonb; feedback text; claim boolean:=false;
BEGIN
 IF actor IS NULL THEN RETURN daily_quest_private.error('not_authenticated'); END IF;
 IF p_action IS NULL OR p_action NOT IN('claim','get','status','preference','submit','skip','complete') THEN RETURN daily_quest_private.error('invalid_input'); END IF;
 SELECT p.* INTO profile FROM public.profiles p WHERE p.id=actor FOR UPDATE;
 IF profile.id IS NULL OR profile.role::text IS DISTINCT FROM 'student' THEN RETURN daily_quest_private.error('not_authorized'); END IF;
 IF p_action='preference' THEN
  IF p_enabled IS NULL THEN RETURN daily_quest_private.error('invalid_input'); END IF;
  UPDATE public.profiles SET daily_quests_enabled=p_enabled WHERE id=actor; profile.daily_quests_enabled:=p_enabled;
 END IF;
 IF p_action IN('status','preference') THEN
  SELECT a.* INTO assignment FROM public.daily_quest_assignments a WHERE a.auth_user_id=actor AND a.quest_date=today;
  RETURN jsonb_build_object('success',true,'enabled',profile.daily_quests_enabled,'streak',daily_quest_private.streak(actor),
   'today',CASE WHEN assignment.id IS NULL THEN NULL ELSE jsonb_build_object('assignmentId',assignment.id,'status',assignment.status) END);
 END IF;
 IF p_action IN('get','claim') THEN
  IF profile.daily_quests_enabled THEN assigned:=daily_quest_private.ensure_assignment(actor); END IF;
  IF p_action='get' THEN RETURN jsonb_build_object('success',true,'enabled',profile.daily_quests_enabled,
   'quest',daily_quest_private.quest(assigned),'streak',daily_quest_private.streak(actor)); END IF;
  IF assigned IS NOT NULL THEN
   INSERT INTO daily_quest_private.login_claims(auth_user_id,quest_date) VALUES(actor,today) ON CONFLICT DO NOTHING;
   GET DIAGNOSTICS changed=ROW_COUNT;
   SELECT a.status='active' INTO claim FROM public.daily_quest_assignments a WHERE a.id=assigned;
   claim:=changed=1 AND claim;
  END IF;
  RETURN jsonb_build_object('success',true,'enabled',profile.daily_quests_enabled,'shouldRedirect',claim,'assignmentId',assigned,'date',today);
 END IF;
 IF NOT profile.daily_quests_enabled THEN RETURN daily_quest_private.error('disabled'); END IF;
 SELECT a.* INTO assignment FROM public.daily_quest_assignments a WHERE a.id=p_assignment_id AND a.auth_user_id=actor FOR UPDATE;
 IF assignment.id IS NULL THEN RETURN daily_quest_private.error('not_found'); END IF;
 IF assignment.quest_date<>today THEN RETURN daily_quest_private.error('expired'); END IF;
 IF p_action='complete' AND assignment.status='completed' THEN
  RETURN jsonb_build_object('success',true,'quest',daily_quest_private.quest(assignment.id),'streak',daily_quest_private.streak(actor));
 END IF;
 -- Compatibility for older clients: leaving does not change progress or status.
 IF p_action='skip' THEN
  RETURN jsonb_build_object('success',true,'quest',daily_quest_private.quest(assignment.id),'streak',daily_quest_private.streak(actor));
 END IF;
 IF assignment.status<>'active' THEN RETURN daily_quest_private.error('not_active'); END IF;
 PERFORM learning_reset_private.assert_writable(actor);
 IF p_action='complete' THEN
  IF assignment.completed_step_ids<>ARRAY(SELECT e.value->>'id' FROM jsonb_array_elements(assignment.snapshot->'steps') WITH ORDINALITY e(value,ordinality) ORDER BY e.ordinality) THEN RETURN daily_quest_private.error('steps_incomplete'); END IF;
  UPDATE public.daily_quest_assignments SET status='completed',completed_at=now() WHERE id=assignment.id;
  -- Only one increase per server day, even if an operational retry is replayed.
  IF profile.daily_quest_last_completed_date IS DISTINCT FROM today THEN
   changed:=CASE WHEN profile.daily_quest_last_completed_date=today-1 THEN profile.daily_quest_streak+1 ELSE 1 END;
   UPDATE public.profiles SET daily_quest_streak=changed,daily_quest_longest_streak=greatest(daily_quest_longest_streak,changed),daily_quest_last_completed_date=today WHERE id=actor;
  END IF;
 ELSIF p_action='submit' THEN
  IF p_step_id IS NULL OR jsonb_typeof(p_answer) IS DISTINCT FROM 'object' OR octet_length(p_answer::text)>8000 THEN RETURN daily_quest_private.error('invalid_input'); END IF;
  SELECT e.value,(e.ordinality-1)::integer INTO step,step_index FROM jsonb_array_elements(assignment.snapshot->'steps') WITH ORDINALITY e(value,ordinality) WHERE e.value->>'id'=p_step_id;
  IF step IS NULL THEN RETURN daily_quest_private.error('invalid_input'); END IF;
  IF NOT p_step_id=ANY(assignment.completed_step_ids) AND step_index<>cardinality(assignment.completed_step_ids) THEN RETURN daily_quest_private.error('step_out_of_order'); END IF;
  SELECT k.answer_key INTO keys FROM daily_quest_private.assignment_keys k WHERE k.assignment_id=assignment.id;
  CASE step->>'kind'
   WHEN 'discover' THEN
    ids:=p_answer->'wordIds';
    IF jsonb_typeof(ids) IS DISTINCT FROM 'array' THEN RETURN daily_quest_private.error('invalid_input'); END IF;
    IF jsonb_array_length(ids)<>jsonb_array_length(step->'words') OR (p_answer-'wordIds')<>'{}'::jsonb THEN RETURN daily_quest_private.error('invalid_input'); END IF;
    SELECT coalesce(jsonb_agg(e.value ORDER BY e.value),'[]')=(SELECT jsonb_agg(w.value->'id' ORDER BY w.value->'id') FROM jsonb_array_elements(step->'words') w(value)) INTO correct FROM jsonb_array_elements(ids) e(value);
   WHEN 'sentence_build' THEN
    ids:=p_answer->'pieceIds';
    IF jsonb_typeof(ids) IS DISTINCT FROM 'array' THEN RETURN daily_quest_private.error('invalid_input'); END IF;
    IF jsonb_array_length(ids)>30 OR (p_answer-'pieceIds')<>'{}'::jsonb THEN RETURN daily_quest_private.error('invalid_input'); END IF;
    SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(keys->'steps'->p_step_id->'accepted') accepted WHERE accepted=ids) INTO correct;
   WHEN 'dialogue_choice' THEN
    IF jsonb_typeof(p_answer->'optionId') IS DISTINCT FROM 'string' OR (p_answer-'optionId')<>'{}'::jsonb THEN RETURN daily_quest_private.error('invalid_input'); END IF;
    correct:=coalesce(p_answer->>'optionId'=keys->'steps'->p_step_id->>'optionId',false);
   ELSE RETURN daily_quest_private.error('invalid_input');
  END CASE;
  IF correct AND NOT p_step_id=ANY(assignment.completed_step_ids) THEN
   UPDATE public.daily_quest_assignments SET completed_step_ids=array_append(completed_step_ids,p_step_id) WHERE id=assignment.id;
  END IF;
  feedback:=CASE WHEN correct THEN coalesce(keys->'feedback'->p_step_id->>'correct','Gut gemacht!') ELSE coalesce(keys->'feedback'->p_step_id->>'wrong','Versuche es noch einmal.') END;
  RETURN jsonb_build_object('success',true,'correct',correct,'feedback',feedback,'quest',daily_quest_private.quest(assignment.id),'streak',daily_quest_private.streak(actor));
 END IF;
 RETURN jsonb_build_object('success',true,'quest',daily_quest_private.quest(assignment.id),'streak',daily_quest_private.streak(actor));
END $$;


NOTIFY pgrst,'reload schema';


-- Sitov Academy: account-owned resume state. Checkpoints never award grades.
-- Compare-and-set revisions retain tombstones after resets so stale devices
-- cannot resurrect an old session. Existing verified progress stays intact.
CREATE TABLE IF NOT EXISTS public.sitov_learning_checkpoints (
 auth_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN('vocabulary','vocabulary_focus','exercises','pronunciation','videos')),
 level text NOT NULL REFERENCES public.learning_levels(code),
 state jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(state)='object' AND octet_length(state::text)<=262144),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(auth_user_id,kind,level)
);
ALTER TABLE public.sitov_learning_checkpoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sitov_learning_checkpoint_read ON public.sitov_learning_checkpoints;
CREATE POLICY sitov_learning_checkpoint_read ON public.sitov_learning_checkpoints FOR SELECT TO authenticated
 USING(auth_user_id=(SELECT auth.uid()) AND trainer_access_private.allowed(level,CASE WHEN kind='vocabulary_focus' THEN 'vocabulary' ELSE kind END));
REVOKE ALL ON public.sitov_learning_checkpoints FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.sitov_learning_checkpoints TO authenticated;
GRANT ALL ON public.sitov_learning_checkpoints TO service_role;

CREATE OR REPLACE FUNCTION public.sitov_learning_checkpoint(p_action text,p_kind text,p_level text,p_state jsonb DEFAULT NULL,p_expected_revision bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); saved public.sitov_learning_checkpoints%ROWTYPE; payload jsonb;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated'); END IF;
 IF p_action IS NULL OR p_action NOT IN('get','save','clear') OR p_kind IS NULL OR p_kind NOT IN('vocabulary','vocabulary_focus','exercises','pronunciation','videos')
  OR NOT EXISTS(SELECT 1 FROM public.learning_levels WHERE code=p_level AND is_active) THEN RETURN jsonb_build_object('error','invalid_input'); END IF;
 IF NOT trainer_access_private.allowed(p_level,CASE WHEN p_kind='vocabulary_focus' THEN 'vocabulary' ELSE p_kind END) THEN RETURN jsonb_build_object('error','not_authorized'); END IF;
 IF p_action<>'get' THEN
  IF p_expected_revision IS NULL OR p_expected_revision<0 OR (p_action='save' AND (jsonb_typeof(p_state) IS DISTINCT FROM 'object' OR octet_length(p_state::text)>262144)) THEN RETURN jsonb_build_object('error','invalid_input'); END IF;
  -- Same first lock as grading and reset; no inverse lock order.
  PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
  PERFORM learning_reset_private.assert_writable(actor);
 END IF;
 SELECT * INTO saved FROM public.sitov_learning_checkpoints WHERE auth_user_id=actor AND kind=p_kind AND level=p_level;
 payload:=CASE WHEN saved.auth_user_id IS NULL THEN NULL ELSE jsonb_build_object('state',saved.state,'revision',saved.revision,'updatedAt',saved.updated_at) END;
 IF p_action='get' THEN RETURN jsonb_build_object('checkpoint',payload); END IF;
 IF coalesce(saved.revision,0)<>p_expected_revision THEN
  -- A transport retry after a committed write returns the same receipt.
  IF saved.revision=p_expected_revision+1 AND saved.state=(CASE WHEN p_action='clear' THEN '{}'::jsonb ELSE p_state END) THEN RETURN jsonb_build_object('checkpoint',payload); END IF;
  RETURN jsonb_build_object('error','conflict','checkpoint',payload);
 END IF;
 INSERT INTO public.sitov_learning_checkpoints AS c(auth_user_id,kind,level,state)
 VALUES(actor,p_kind,p_level,CASE WHEN p_action='clear' THEN '{}'::jsonb ELSE p_state END)
 ON CONFLICT(auth_user_id,kind,level) DO UPDATE SET state=excluded.state,revision=c.revision+1,updated_at=clock_timestamp()
 RETURNING * INTO saved;
 RETURN jsonb_build_object('checkpoint',jsonb_build_object('state',saved.state,'revision',saved.revision,'updatedAt',saved.updated_at));
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error','request_failed');
END $$;
REVOKE ALL ON FUNCTION public.sitov_learning_checkpoint(text,text,text,jsonb,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sitov_learning_checkpoint(text,text,text,jsonb,bigint) TO authenticated;

-- Every reset clears resume state in its existing protected transaction.
DO $sitov$
DECLARE signature text; body text; marker text:='DELETE FROM public.user_exercise_progress'; replacement text;
BEGIN
 FOREACH signature IN ARRAY ARRAY['learning_private.reset_student_level(uuid,text)','learning_reset_private.finish_reset(uuid)'] LOOP
  body:=pg_get_functiondef(signature::regprocedure);
  IF strpos(body,'public.sitov_learning_checkpoints')=0 THEN
   IF strpos(body,marker)=0 THEN RAISE EXCEPTION 'sitov_checkpoint_reset_contract_changed'; END IF;
   replacement:=CASE WHEN signature LIKE 'learning_private.%' THEN
    'INSERT INTO public.sitov_learning_checkpoints AS c(auth_user_id,kind,level,state) SELECT p_student_id,k.kind,p_level,''{}''::jsonb FROM unnest(ARRAY[''vocabulary'',''vocabulary_focus'',''exercises'',''pronunciation'',''videos'']) k(kind) ON CONFLICT(auth_user_id,kind,level) DO UPDATE SET state=''{}''::jsonb,revision=c.revision+1,updated_at=clock_timestamp(); DELETE FROM grammar_private.sitov_checkpoint_receipts WHERE auth_user_id=p_student_id AND level=p_level; '
    ELSE 'INSERT INTO public.sitov_learning_checkpoints AS c(auth_user_id,kind,level,state) SELECT actor,k.kind,l.code,''{}''::jsonb FROM public.learning_levels l CROSS JOIN unnest(ARRAY[''vocabulary'',''vocabulary_focus'',''exercises'',''pronunciation'',''videos'']) k(kind) ON CONFLICT(auth_user_id,kind,level) DO UPDATE SET state=''{}''::jsonb,revision=c.revision+1,updated_at=clock_timestamp(); DELETE FROM grammar_private.sitov_checkpoint_receipts WHERE auth_user_id=actor; ' END;
   EXECUTE replace(body,marker,replacement||marker);
  END IF;
 END LOOP;
 -- Home/learn navigation uses the same account checkpoint on another device.
 body:=pg_get_functiondef('public.get_last_active_level()'::regprocedure);
 IF strpos(body,'FROM public.sitov_learning_checkpoints')=0 THEN
  marker:='), latest AS (';
  IF strpos(body,marker)=0 THEN RAISE EXCEPTION 'sitov_checkpoint_activity_contract_changed'; END IF;
  EXECUTE replace(body,marker,$fragment$
  UNION ALL SELECT c.level,CASE WHEN c.kind='vocabulary_focus' THEN 'vocabulary' ELSE c.kind END,c.updated_at,NULL::text,NULL::text
   FROM public.sitov_learning_checkpoints c WHERE c.auth_user_id=actor AND c.state<>'{}'::jsonb AND trainer_access_private.allowed(c.level,CASE WHEN c.kind='vocabulary_focus' THEN 'vocabulary' ELSE c.kind END)
 ), latest AS ($fragment$);
 END IF;
END $sitov$;

-- A lost response followed by retry must not duplicate a stored recording.
DO $sitov$
DECLARE body text; marker text:='INSERT INTO public.submissions';
BEGIN
 body:=pg_get_functiondef('pronunciation_private.create_submission(uuid,text)'::regprocedure);
 IF strpos(body,'sitov recording retry')=0 THEN
  IF strpos(body,marker)=0 THEN RAISE EXCEPTION 'sitov_recording_contract_changed'; END IF;
  EXECUTE replace(body,marker,$fragment$
  -- sitov recording retry: same immutable owned audio means same submission.
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||':'||p_audio_path,0));
  SELECT s.id INTO result FROM public.submissions s WHERE s.auth_user_id=actor AND s.prompt_id=p_prompt_id AND s.content_url=p_audio_path ORDER BY s.created_at,s.id LIMIT 1;
  IF result IS NOT NULL THEN RETURN result; END IF;
  INSERT INTO public.submissions$fragment$);
 END IF;
END $sitov$;

-- Sitov Academy: stale tabs may replay a saved test answer, never replace it.
CREATE OR REPLACE FUNCTION public.submit_path_test_answer(p_attempt_id uuid,p_exercise_id uuid,p_answer jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; a public.path_test_attempts; saved jsonb;
BEGIN
 actor:=path_private.check_actor();
 IF p_answer IS NULL OR p_answer='null'::jsonb OR octet_length(p_answer::text)>4194304 THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 SELECT * INTO a FROM public.path_test_attempts WHERE id=p_attempt_id AND auth_user_id=actor AND status='active' AND is_active FOR UPDATE;
 IF a.id IS NULL THEN RAISE EXCEPTION 'attempt_unavailable' USING ERRCODE='42501'; END IF;
 IF NOT path_private.node_available(a.node_id) THEN RAISE EXCEPTION 'node_locked' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM path_private.test_items WHERE attempt_id=a.id AND exercise_id=p_exercise_id) THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 SELECT answer INTO saved FROM public.path_test_answers WHERE attempt_id=a.id AND exercise_id=p_exercise_id;
 IF FOUND THEN
  IF saved IS DISTINCT FROM p_answer THEN RAISE EXCEPTION 'request_conflict' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('saved',true);
 END IF;
 -- Saving intentionally does not grade or expose solutions.
 INSERT INTO public.path_test_answers(attempt_id,exercise_id,answer) VALUES(a.id,p_exercise_id,p_answer);
 RETURN jsonb_build_object('saved',true);
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;

REVOKE ALL ON FUNCTION public.submit_path_test_answer(uuid,uuid,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.submit_path_test_answer(uuid,uuid,jsonb) TO authenticated;

-- Reuse the reviewed map query and add the newest live checkpoint. No catalog,
-- grading, completion or intervention behavior changes.
DO $sitov_resume$
DECLARE definition text; marker text;
BEGIN
 definition:=pg_get_functiondef('public.get_learning_path(text,text)'::regprocedure);
 marker:=$marker$RETURN jsonb_build_object('level',p_level,'paths',paths,'completed',done,'next_level',next_level,'next_level_available',next_allowed);$marker$;
 IF position('''resume_node_id''' IN definition)=0 THEN
  IF position(marker IN definition)=0 THEN RAISE EXCEPTION 'sitov_path_resume_patch_unavailable'; END IF;
  definition:=replace(definition,marker,$replacement$
 RETURN jsonb_build_object('level',p_level,'paths',paths,'completed',done,'next_level',next_level,'next_level_available',next_allowed,
  'resume_node_id',(SELECT checkpoint.node_id FROM (
    SELECT r.node_id,r.updated_at AS at FROM public.path_practice_runs r
    JOIN public.path_nodes n ON n.id=r.node_id JOIN public.learning_units u ON u.id=n.unit_id
    WHERE r.auth_user_id=actor AND r.is_active AND r.status='active' AND u.level=p_level AND path_private.node_available(n.id)
    UNION ALL
    SELECT a.node_id,greatest(a.created_at,coalesce((SELECT max(answered_at) FROM public.path_test_answers ans WHERE ans.attempt_id=a.id),a.created_at))
    FROM public.path_test_attempts a JOIN public.path_nodes n ON n.id=a.node_id JOIN public.learning_units u ON u.id=n.unit_id
    WHERE a.auth_user_id=actor AND a.is_active AND a.status='active' AND u.level=p_level AND path_private.node_available(n.id)
  ) checkpoint ORDER BY checkpoint.at DESC,checkpoint.node_id LIMIT 1));
 $replacement$);
  EXECUTE definition;
 END IF;
END $sitov_resume$;

-- Sitov Academy: grading, resume position and retry receipt commit together.
-- Retry grades are private: learner-writable checkpoint JSON is never grading evidence.
CREATE TABLE IF NOT EXISTS grammar_private.sitov_checkpoint_receipts (
 auth_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 level text NOT NULL REFERENCES public.learning_levels(code),request_id uuid NOT NULL,
 exercise_id uuid NOT NULL,answer text NOT NULL,hint_shown boolean NOT NULL,
 expected_revision bigint NOT NULL,checkpoint_revision bigint NOT NULL,response jsonb NOT NULL,
 PRIMARY KEY(auth_user_id,level)
);
ALTER TABLE grammar_private.sitov_checkpoint_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON grammar_private.sitov_checkpoint_receipts FROM PUBLIC,anon,authenticated;
GRANT ALL ON grammar_private.sitov_checkpoint_receipts TO service_role;

CREATE OR REPLACE FUNCTION public.sitov_record_grammar_checkpoint_attempt(
 p_exercise_id uuid,p_answer text,p_hint_shown boolean,p_level text,p_expected_revision bigint,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); saved public.sitov_learning_checkpoints%ROWTYPE;
 payload jsonb; receipt grammar_private.sitov_checkpoint_receipts%ROWTYPE; grade jsonb; response jsonb; position integer; count integer;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated'); END IF;
 IF p_request_id IS NULL OR p_exercise_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<1
  OR p_answer IS NULL OR length(btrim(p_answer))=0 OR length(p_answer)>1000 OR p_hint_shown IS NULL
  OR NOT EXISTS(SELECT 1 FROM public.learning_levels WHERE code=p_level AND is_active) THEN RETURN jsonb_build_object('error','invalid_input'); END IF;
 IF NOT trainer_access_private.allowed(p_level,'exercises') THEN RETURN jsonb_build_object('error','not_authorized'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 PERFORM learning_reset_private.assert_writable(actor);
 SELECT * INTO saved FROM public.sitov_learning_checkpoints WHERE auth_user_id=actor AND kind='exercises' AND level=p_level FOR UPDATE;
 payload:=CASE WHEN saved.auth_user_id IS NULL THEN NULL ELSE jsonb_build_object('state',saved.state,'revision',saved.revision,'updatedAt',saved.updated_at) END;
 SELECT * INTO receipt FROM grammar_private.sitov_checkpoint_receipts WHERE auth_user_id=actor AND level=p_level;
 IF receipt.request_id=p_request_id THEN
  IF receipt.exercise_id IS DISTINCT FROM p_exercise_id OR receipt.answer IS DISTINCT FROM p_answer
   OR receipt.hint_shown IS DISTINCT FROM p_hint_shown OR receipt.expected_revision<>p_expected_revision
   OR receipt.checkpoint_revision IS DISTINCT FROM saved.revision THEN RETURN jsonb_build_object('error','conflict','checkpoint',payload); END IF;
  RETURN receipt.response;
 END IF;
 IF coalesce(saved.revision,0)<>p_expected_revision THEN RETURN jsonb_build_object('error','conflict','checkpoint',payload); END IF;
 IF jsonb_typeof(saved.state->'exerciseIds') IS DISTINCT FROM 'array' OR jsonb_typeof(saved.state->'currentIndex') IS DISTINCT FROM 'number'
  OR (saved.state->>'currentIndex') !~ '^[0-9]+$' THEN RETURN jsonb_build_object('error','invalid_input'); END IF;
 count:=jsonb_array_length(saved.state->'exerciseIds'); position:=(saved.state->>'currentIndex')::integer;
 IF count NOT BETWEEN 1 AND 10 OR position<0 OR position>=count
  OR saved.state->'exerciseIds'->>position IS DISTINCT FROM p_exercise_id::text THEN RETURN jsonb_build_object('error','conflict','checkpoint',payload); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.learning_exercises e JOIN public.learning_units u ON u.id=e.unit_id
  WHERE e.id=p_exercise_id AND u.level=p_level AND e.node_id IS NULL AND learning_private.unit_allowed(u.id)) THEN RETURN jsonb_build_object('error','not_authorized'); END IF;
 grade:=grammar_private.record_attempt(p_exercise_id,p_answer,p_hint_shown);
 PERFORM platform_private.require_rpc_success(grade);
 IF grade->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'sitov_grammar_grade_failed'; END IF;
 saved.state:=jsonb_set(saved.state,'{currentIndex}',to_jsonb(position+CASE WHEN grade->>'isCorrect'='true' THEN 1 ELSE 0 END));
 UPDATE public.sitov_learning_checkpoints SET state=saved.state,revision=revision+1,updated_at=clock_timestamp()
  WHERE auth_user_id=actor AND kind='exercises' AND level=p_level RETURNING * INTO saved;
 response:=jsonb_build_object('grade',grade,'checkpoint',jsonb_build_object('state',saved.state,'revision',saved.revision,'updatedAt',saved.updated_at));
 INSERT INTO grammar_private.sitov_checkpoint_receipts(auth_user_id,level,request_id,exercise_id,answer,hint_shown,expected_revision,checkpoint_revision,response)
 VALUES(actor,p_level,p_request_id,p_exercise_id,p_answer,p_hint_shown,p_expected_revision,saved.revision,response)
 ON CONFLICT(auth_user_id,level) DO UPDATE SET request_id=excluded.request_id,exercise_id=excluded.exercise_id,answer=excluded.answer,
  hint_shown=excluded.hint_shown,expected_revision=excluded.expected_revision,checkpoint_revision=excluded.checkpoint_revision,response=excluded.response;
 RETURN response;
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('error',CASE WHEN SQLSTATE='42501' THEN 'not_authorized' WHEN SQLSTATE IN('22023','22P02','23514') THEN 'invalid_input' ELSE 'request_failed' END);
END $$;
REVOKE ALL ON FUNCTION public.sitov_record_grammar_checkpoint_attempt(uuid,text,boolean,text,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sitov_record_grammar_checkpoint_attempt(uuid,text,boolean,text,bigint,uuid) TO authenticated;

NOTIFY pgrst,'reload schema';
