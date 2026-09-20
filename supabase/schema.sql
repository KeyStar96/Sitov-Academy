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
-- Name: trainer_access_private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA trainer_access_private;


--
-- Name: vocabulary_private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA vocabulary_private;


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
    'sentence_building'
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
    'raw'
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
 perform platform_private.require_rpc_success(public.queue_transactional_email('confirmed:'||b.id,case when b.kind='trial' then 'trial_confirmed' else 'registration_confirmed' end,b.contact_email,p.preferred_locale,
 jsonb_build_object('name',b.contact_name,'startDate',b.start_date,'courses',(select jsonb_agg(jsonb_build_object('title',title_snapshot,'units',units,'unitPrice',unit_price,'unitMinutes',unit_minutes,'price',amount)) from public.booking_items where booking_id=b.id))));
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
 -- Localized hint/smart_hint/explanation objects and grammar_translations are
 -- intentionally excluded. Native-language prompts belong in translations.prompt.
 SELECT learning_private.german_text_allowed(jsonb_build_array(p_topic,
  p_content->'instruction',p_content->'text_before',p_content->'text_after',p_content->'question',
  p_content->'correct_answer',p_content->'gap_hint',p_content->'options',p_content->'accepted_answers',
  p_content->'parts',p_content->'target_form')::text)
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
 IF NOT FOUND OR target.type NOT IN('fill_in_blank','multiple_choice') THEN
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
   'matched',CASE WHEN correct THEN target.content->>'correct_answer' ELSE NULL END,'reason',NULL);
 ELSE
  -- Compatibility fallback for legacy reads; remove only in a follow-up release.
  accepted:=coalesce(target.content->'accepted_answers',target.content->'alternative_answers','[]'::jsonb);
  IF jsonb_typeof(accepted) IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE='22023'; END IF;
  grade:=learning_private.grade_answer(p_answer,ARRAY[target.content->>'correct_answer']||ARRAY(SELECT jsonb_array_elements_text(accepted)));
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
 WHERE p.id=(SELECT auth.uid()) AND (p.role IN ('teacher','admin') OR (
   p.ui_language<>'de' AND u.is_active AND l.auth_user_id IS NOT NULL
   AND u.trainer::text IN ('vocabulary','exercises','pronunciation','videos')
   AND COALESCE(a.enabled,true) AND (a.unit_mode IS DISTINCT FROM 'selected' OR EXISTS (
     SELECT 1 FROM public.learning_unit_grants g WHERE g.auth_user_id=p.id
       AND g.level=u.level AND g.trainer=u.trainer AND g.unit_id=u.id))));
$$;


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
-- Name: ensure_unit(uuid, text, text, text, boolean, integer); Type: FUNCTION; Schema: learning_private; Owner: -
--

CREATE FUNCTION learning_private.ensure_unit(p_id uuid, p_level text, p_trainer text, p_label text, p_active boolean DEFAULT true, p_sort integer DEFAULT 100) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$ DECLARE result uuid; BEGIN
 IF p_id IS NOT NULL THEN
  DELETE FROM public.learning_unit_grants WHERE unit_id=p_id AND level<>p_level;
  UPDATE public.learning_units SET level=p_level,label=p_label,is_active=p_active,sort_order=p_sort
  WHERE id=p_id AND trainer::text=p_trainer RETURNING id INTO result;
  IF result IS NULL THEN INSERT INTO public.learning_units(id,level,trainer,label,is_active,sort_order)
   VALUES(p_id,p_level,p_trainer::public.trainer_code,p_label,p_active,p_sort) RETURNING id INTO result; END IF;
 ELSE
  PERFORM pg_advisory_xact_lock(hashtextextended('learning-unit:'||p_level||':'||p_trainer||':'||p_label,0));
  IF p_trainer IN('vocabulary','exercises') THEN
   SELECT id INTO result FROM public.learning_units WHERE level=p_level AND trainer::text=p_trainer AND label=p_label;
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
    AS $$
DECLARE input_value text; candidate text; original text; reason learning_private.soft_error_reason;
 status learning_private.answer_status:='INCORRECT'; input_words text[]; accepted_words text[];
 distance integer; word_index integer;
BEGIN
 IF p_input IS NULL OR length(p_input)>4000 OR learning_private.normalize_answer(p_input)='' THEN
  RETURN jsonb_build_object('error','invalid_answer','message','Enter an answer of at most 4000 characters.','sqlstate','22023');
 END IF;
 IF p_accepted IS NULL OR coalesce(array_ndims(p_accepted),0)<>1 OR cardinality(p_accepted) NOT BETWEEN 1 AND 128
  OR EXISTS(SELECT 1 FROM unnest(p_accepted) a WHERE a IS NULL OR length(a)>4000 OR learning_private.normalize_answer(a)='') THEN
  RETURN jsonb_build_object('error','invalid_accepted_answers','message','The accepted answers are missing or invalid.','sqlstate','22023');
 END IF;
 input_value:=learning_private.normalize_answer(p_input);
 -- Exact answers across the whole list always outrank a soft match to another answer.
 FOREACH original IN ARRAY p_accepted LOOP
  IF input_value=learning_private.normalize_answer(original) THEN
   status:='EXACT'; RETURN jsonb_build_object('status',status,'matched',original,'reason',NULL);
  END IF;
 END LOOP;
 -- Priority applies across all accepted answers, without combining normalizations.
 FOREACH reason IN ARRAY enum_range(NULL::learning_private.soft_error_reason) LOOP
  FOREACH original IN ARRAY p_accepted LOOP
   candidate:=learning_private.normalize_answer(original);
   IF reason='punctuation' THEN
    IF learning_private.normalize_answer(regexp_replace(input_value,'[[:punct:]„“”‘’«»…—–]','','g')) =
      learning_private.normalize_answer(regexp_replace(candidate,'[[:punct:]„“”‘’«»…—–]','','g')) THEN
     status:='SOFT_ERROR'; RETURN jsonb_build_object('status',status,'matched',original,'reason',reason);
    END IF;
   ELSIF reason='capitalization' THEN
    IF lower(input_value)=lower(candidate) THEN
     status:='SOFT_ERROR'; RETURN jsonb_build_object('status',status,'matched',original,'reason',reason);
    END IF;
   ELSIF reason='umlaut' THEN
    IF learning_private.expand_german_letters(input_value)=learning_private.expand_german_letters(candidate) THEN
     status:='SOFT_ERROR'; RETURN jsonb_build_object('status',status,'matched',original,'reason',reason);
    END IF;
   ELSE
    -- Preserve every separator (including punctuation) and word order/count.
    -- A typo may not quietly combine punctuation/capitalization/umlaut changes.
    IF regexp_split_to_array(input_value,'[[:alnum:]ÄÖÜäöüßẞ]+') IS DISTINCT FROM
       regexp_split_to_array(candidate,'[[:alnum:]ÄÖÜäöüßẞ]+') THEN CONTINUE; END IF;
    input_words:=regexp_split_to_array(input_value,'[^[:alnum:]ÄÖÜäöüßẞ]+');
    accepted_words:=regexp_split_to_array(candidate,'[^[:alnum:]ÄÖÜäöüßẞ]+');
    IF cardinality(input_words)<>cardinality(accepted_words) THEN CONTINUE; END IF;
    distance:=0;
    FOR word_index IN 1..cardinality(input_words) LOOP
     IF input_words[word_index]=accepted_words[word_index] THEN CONTINUE; END IF;
     IF least(char_length(input_words[word_index]),char_length(accepted_words[word_index]))<4 THEN distance:=2; EXIT; END IF;
     distance:=distance+learning_private.levenshtein_at_most_one(input_words[word_index],accepted_words[word_index]);
     IF distance>1 THEN EXIT; END IF;
    END LOOP;
    IF distance=1 THEN
     status:='SOFT_ERROR'; RETURN jsonb_build_object('status',status,'matched',original,'reason',reason);
    END IF;
   END IF;
  END LOOP;
 END LOOP;
 RETURN jsonb_build_object('status',status,'matched',NULL,'reason',NULL);
END $$;


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
-- Name: normalize_answer(text); Type: FUNCTION; Schema: learning_private; Owner: -
--

CREATE FUNCTION learning_private.normalize_answer(p_value text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    SET search_path TO ''
    AS $$
 SELECT btrim(regexp_replace(p_value,'\s+',' ','g'))
$$;


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
 DELETE FROM public.user_exercise_progress p USING public.learning_exercises e,public.learning_units u WHERE u.id=e.unit_id AND p.exercise_id=e.id AND p.auth_user_id=p_student_id AND u.level=p_level;
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
 SELECT EXISTS(SELECT 1 FROM public.learning_units u WHERE u.id=p_unit_id
 AND trainer_access_private.unit_allowed(u.level,u.trainer::text,u.id::text));
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
 DELETE FROM public.user_exercise_progress WHERE auth_user_id=actor;
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
 OR (parts[3]='videos' AND EXISTS(SELECT 1 FROM public.learning_videos v WHERE v.folder_id=folder AND v.storage_path=p_name AND learning_private.unit_allowed(v.unit_id)));
END $_$;


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
-- Name: get_all_students_progress_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_students_progress_data() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
    result jsonb := '{}'::jsonb;
BEGIN
    -- Authorization Check
    IF NOT business_private.is_staff() THEN
        RETURN jsonb_build_object('error', 'not_authorized', 'message', 'Staff access required.');
    END IF;

    -- The aggregation matches the TS logic:
    -- 1. Total exercises and vocab per level
    -- 2. Completed exercises per user per level
    -- 3. Completed vocab per user per level (both directions box=7)
    -- 4. Math.round((completed / total) * 100)

    WITH totals AS (
        SELECT u.level, COUNT(e.id) as total_items
        FROM public.learning_units u
        JOIN public.learning_exercises e ON e.unit_id = u.id
        GROUP BY u.level
        UNION ALL
        SELECT u.level, COUNT(v.id) as total_items
        FROM public.learning_units u
        JOIN public.learning_vocabulary_cards v ON v.unit_id = u.id
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
    -- R10: expose stable codes, never SQLERRM, queries or customer data.
    RETURN jsonb_build_object('error', 'request_failed',
        'message', 'Progress could not be loaded.', 'sqlstate', SQLSTATE);
END;
$$;


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
    LANGUAGE plpgsql
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
  INSERT INTO public.learning_vocabulary_cards(id,unit_id,word_de,article,plural,image_url,audio_url,sentence_practice,alternative_answers_de)
  VALUES(item,target_unit,fields->>'word_de',(fields->>'article')::public.grammatical_article,fields->>'plural',fields->>'image_url',fields->>'audio_url',coalesce((fields->>'sentence_practice')::boolean,false),
  ARRAY(SELECT jsonb_array_elements_text(coalesce(fields->'alternative_answers_de','[]'::jsonb))))
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,word_de=excluded.word_de,article=excluded.article,plural=excluded.plural,
  image_url=excluded.image_url,audio_url=excluded.audio_url,sentence_practice=excluded.sentence_practice,alternative_answers_de=excluded.alternative_answers_de;
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
 perform platform_private.require_rpc_success(public.queue_transactional_email('registration:'||v_booking,'registration_received',v_email,p_locale,jsonb_build_object('name',v_name,'startDate',p_start,'courses',(select jsonb_agg(jsonb_build_object('title',title_snapshot,'units',units,'unitPrice',unit_price,'unitMinutes',unit_minutes,'price',amount)) from public.booking_items where booking_id=v_booking))));
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
 profile public.profiles; canonical text; translated text; prompt text; previous_card uuid; grade jsonb;
 accepted text[]; correct boolean; sentence boolean; soft boolean; old_phase integer; new_phase integer;
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
 SELECT translation,context_sentence INTO translated,prompt FROM public.vocabulary_translations WHERE card_id=card.id AND locale=p_ui_language;
 sentence:=card.sentence_practice AND progress.direction='native_to_de';
 IF sentence THEN
  SELECT context_sentence INTO canonical FROM public.vocabulary_translations WHERE card_id=card.id AND locale='de';
  IF nullif(btrim(prompt),'') IS NULL OR nullif(btrim(canonical),'') IS NULL THEN
   RAISE EXCEPTION 'sentence_content_missing' USING ERRCODE='23514'; END IF;
  accepted:=ARRAY[canonical]||coalesce(card.alternative_answers_de,ARRAY[]::text[]);
 ELSIF progress.direction='native_to_de' THEN
  canonical:=concat_ws(' ',nullif(nullif(card.article::text,'none'),''),card.word_de);
  accepted:=ARRAY[canonical];
 ELSE
  canonical:=translated; accepted:=ARRAY[canonical];
 END IF;
 IF nullif(btrim(canonical),'') IS NULL THEN RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE='23514'; END IF;
 -- Every answer, in either direction, is graded from stored content. The legacy
 -- p_is_correct argument remains payload-bound for receipt compatibility only.
 grade:=learning_private.grade_answer(p_typed_answer,accepted);
 PERFORM platform_private.require_rpc_success(grade);
 correct:=grade->>'status' IN('EXACT','SOFT_ERROR'); soft:=grade->>'status'='SOFT_ERROR';
 is_alternative:=correct AND grade->>'matched' IS DISTINCT FROM canonical;
 old_phase:=least(6,greatest(1,coalesce(progress.box_number,1)));
 new_phase:=CASE WHEN correct THEN least(6,old_phase+1) ELSE greatest(1,old_phase-1) END;
 new_box:=CASE WHEN correct AND old_phase=6 THEN 7 ELSE new_phase END;
 days:=CASE new_phase WHEN 1 THEN 1 WHEN 2 THEN 1 WHEN 3 THEN 3 WHEN 4 THEN 9 WHEN 5 THEN 29 ELSE 90 END;
 previous_days:=CASE old_phase WHEN 1 THEN 1 WHEN 2 THEN 1 WHEN 3 THEN 3 WHEN 4 THEN 9 WHEN 5 THEN 29 ELSE 90 END;
 IF soft THEN days:=least(days,previous_days); END IF;
 SELECT coalesce(t.is_difficult,false) INTO difficult FROM public.vocabulary_translations t WHERE t.card_id=card.id AND t.locale=profile.native_language;
 IF difficult THEN days:=greatest(1,days/2); END IF;
 UPDATE public.vocabulary_direction_progress SET box_number=new_box,next_review_date=now()+make_interval(days=>days),
  lapses=lapses+CASE WHEN NOT correct THEN 1 ELSE 0 END,last_answered_at=now(),updated_at=now() WHERE id=progress.id;
 INSERT INTO public.vocabulary_learning_state(auth_user_id,last_card_id,last_reviewed_at) VALUES(actor,progress.card_id,now())
 ON CONFLICT(auth_user_id) DO UPDATE SET last_card_id=excluded.last_card_id,last_reviewed_at=excluded.last_reviewed_at;
 RETURN jsonb_build_object('success',true,'isCorrect',correct,'previousPhase',old_phase,'newPhase',new_phase,
  'becameLearned',new_box=7,'movedBack',new_phase<old_phase,'intervalInDays',days,
  'correctAnswer',canonical,'isAlternative',is_alternative,'softError',grade->'reason');
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
    prompt text
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
-- Name: learning_trainer_grants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_trainer_grants (
    auth_user_id uuid NOT NULL,
    level text NOT NULL,
    trainer public.trainer_code NOT NULL,
    enabled boolean NOT NULL,
    unit_mode public.unit_access_mode DEFAULT 'all'::public.unit_access_mode NOT NULL
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
    CONSTRAINT learning_units_label_check CHECK (((length(btrim(label)) >= 1) AND (length(btrim(label)) <= 160)))
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
    unit_id uuid NOT NULL
);


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
    ui_language text DEFAULT 'de'::text NOT NULL
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
    level text NOT NULL
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
    CONSTRAINT answer_receipts_response_check CHECK ((jsonb_typeof(response) = 'object'::text)),
    CONSTRAINT answer_receipts_typed_answer_check CHECK ((length(typed_answer) <= 4000))
);


--
-- Name: registration_identity_resolutions registration_identity_resolutions_pkey; Type: CONSTRAINT; Schema: business_private; Owner: -
--

ALTER TABLE ONLY business_private.registration_identity_resolutions
    ADD CONSTRAINT registration_identity_resolutions_pkey PRIMARY KEY (auth_user_id);


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
-- Name: rate_limits rate_limits_pkey; Type: CONSTRAINT; Schema: platform_private; Owner: -
--

ALTER TABLE ONLY platform_private.rate_limits
    ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (key_hash);


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
-- Name: answer_receipts answer_receipts_pkey; Type: CONSTRAINT; Schema: vocabulary_private; Owner: -
--

ALTER TABLE ONLY vocabulary_private.answer_receipts
    ADD CONSTRAINT answer_receipts_pkey PRIMARY KEY (auth_user_id, request_id);


--
-- Name: audio_objects_bucket_id_idx; Type: INDEX; Schema: learning_reset_private; Owner: -
--

CREATE INDEX audio_objects_bucket_id_idx ON learning_reset_private.audio_objects USING btree (bucket_id);


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
-- Name: learning_exercises_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX learning_exercises_unit_idx ON public.learning_exercises USING btree (unit_id);


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

CREATE UNIQUE INDEX learning_units_named_lesson_idx ON public.learning_units USING btree (level, trainer, label) WHERE (trainer = ANY (ARRAY['vocabulary'::public.trainer_code, 'exercises'::public.trainer_code]));


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
-- Name: answer_receipts answer_receipts_ui_language_fkey; Type: FK CONSTRAINT; Schema: vocabulary_private; Owner: -
--

ALTER TABLE ONLY vocabulary_private.answer_receipts
    ADD CONSTRAINT answer_receipts_ui_language_fkey FOREIGN KEY (ui_language) REFERENCES public.locales(code);


--
-- Name: registration_identity_resolutions; Type: ROW SECURITY; Schema: business_private; Owner: -
--

ALTER TABLE business_private.registration_identity_resolutions ENABLE ROW LEVEL SECURITY;

--
-- Name: audio_objects; Type: ROW SECURITY; Schema: learning_reset_private; Owner: -
--

ALTER TABLE learning_reset_private.audio_objects ENABLE ROW LEVEL SECURITY;

--
-- Name: jobs; Type: ROW SECURITY; Schema: learning_reset_private; Owner: -
--

ALTER TABLE learning_reset_private.jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limits; Type: ROW SECURITY; Schema: platform_private; Owner: -
--

ALTER TABLE platform_private.rate_limits ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY released_content_read ON public.learning_exercises FOR SELECT TO authenticated USING (((content_status = 'ready'::public.learning_content_status) AND learning_private.unit_allowed(unit_id)));


--
-- Name: learning_reading_texts released_content_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY released_content_read ON public.learning_reading_texts FOR SELECT TO authenticated USING ((learning_private.german_text_allowed(sentence_de) AND learning_private.german_text_allowed(focus) AND learning_private.unit_allowed(unit_id)));


--
-- Name: learning_videos released_content_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY released_content_read ON public.learning_videos FOR SELECT TO authenticated USING ((learning_private.unit_allowed(unit_id) AND ((folder_id IS NULL) OR media_private.folder_allowed(folder_id))));


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

CREATE POLICY released_units ON public.learning_units FOR SELECT TO authenticated USING ((id = ANY (( SELECT learning_private.allowed_unit_ids() AS allowed_unit_ids)::uuid[])));


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
-- Name: vocabulary_direction_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vocabulary_direction_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: vocabulary_learning_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vocabulary_learning_state ENABLE ROW LEVEL SECURITY;

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
-- Name: answer_receipts; Type: ROW SECURITY; Schema: vocabulary_private; Owner: -
--

ALTER TABLE vocabulary_private.answer_receipts ENABLE ROW LEVEL SECURITY;

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
-- Name: FUNCTION audio_readable(p_name text); Type: ACL; Schema: learning_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_private.audio_readable(p_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION learning_private.audio_readable(p_name text) TO authenticated;


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


--
-- Name: FUNCTION guard_reading_quality(); Type: ACL; Schema: learning_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_private.guard_reading_quality() FROM PUBLIC;


--
-- Name: FUNCTION levenshtein_at_most_one(p_left text, p_right text); Type: ACL; Schema: learning_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_private.levenshtein_at_most_one(p_left text, p_right text) FROM PUBLIC;


--
-- Name: FUNCTION normalize_answer(p_value text); Type: ACL; Schema: learning_private; Owner: -
--

REVOKE ALL ON FUNCTION learning_private.normalize_answer(p_value text) FROM PUBLIC;


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
-- Name: FUNCTION validate_asset(); Type: ACL; Schema: media_private; Owner: -
--

REVOKE ALL ON FUNCTION media_private.validate_asset() FROM PUBLIC;


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
-- Name: FUNCTION begin_learning_reset(p_confirmation text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.begin_learning_reset(p_confirmation text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.begin_learning_reset(p_confirmation text) TO authenticated;
GRANT ALL ON FUNCTION public.begin_learning_reset(p_confirmation text) TO service_role;


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
-- Name: FUNCTION get_all_students_progress_data(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_all_students_progress_data() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_all_students_progress_data() TO authenticated;


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
-- Name: FUNCTION skip_vocabulary_assessment(p_level text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.skip_vocabulary_assessment(p_level text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.skip_vocabulary_assessment(p_level text) TO authenticated;
GRANT ALL ON FUNCTION public.skip_vocabulary_assessment(p_level text) TO service_role;


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
-- Name: FUNCTION submit_vocabulary_answer(p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_vocabulary_answer(p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_vocabulary_answer(p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text) TO authenticated;
GRANT ALL ON FUNCTION public.submit_vocabulary_answer(p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text) TO service_role;


--
-- Name: FUNCTION submit_vocabulary_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_vocabulary_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_vocabulary_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text) TO service_role;
GRANT ALL ON FUNCTION public.submit_vocabulary_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text) TO authenticated;


--
-- Name: FUNCTION initialize_cards(p_decisions jsonb); Type: ACL; Schema: vocabulary_private; Owner: -
--

REVOKE ALL ON FUNCTION vocabulary_private.initialize_cards(p_decisions jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION vocabulary_private.initialize_cards(p_decisions jsonb) TO authenticated;


--
-- Name: FUNCTION reset_lesson(p_unit_id uuid); Type: ACL; Schema: vocabulary_private; Owner: -
--

REVOKE ALL ON FUNCTION vocabulary_private.reset_lesson(p_unit_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION vocabulary_private.reset_lesson(p_unit_id uuid) TO authenticated;


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
-- Name: FUNCTION submit_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text); Type: ACL; Schema: vocabulary_private; Owner: -
--

REVOKE ALL ON FUNCTION vocabulary_private.submit_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text) FROM PUBLIC;
GRANT ALL ON FUNCTION vocabulary_private.submit_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text) TO authenticated;


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
-- PostgreSQL database dump complete
--
