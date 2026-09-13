-- Canonical VPS application schema. Apply reviewed migrations; Supabase Auth/Storage bootstrap is managed separately.
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
-- Name: claim_person(); Type: FUNCTION; Schema: business_private; Owner: -
--

CREATE FUNCTION business_private.claim_person() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_user auth.users;v_person public.people;v_candidate uuid;v_count integer;
begin
 select * into v_user from auth.users where id=(select auth.uid());
 if v_user.id is null or v_user.email_confirmed_at is null then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtextextended('claim-person:'||lower(v_user.email),0));
 select * into v_person from public.people where auth_user_id=v_user.id for update;
 if v_person.id is null then raise exception 'Missing profile identity';end if;
 -- Only one unclaimed record and exact verified email may be associated.
 -- Shared emails require staff resolution; never choose the first relative.
 select count(*),(array_agg(id))[1] into v_count,v_candidate from public.people where auth_user_id is null and lower(email)=lower(v_user.email);
 if v_count=1 and not exists(select 1 from public.bookings where person_id=v_person.id) then
  update public.people set auth_user_id=null where id=v_person.id;
  update public.people set auth_user_id=v_user.id,email=v_user.email where id=v_candidate;
  delete from public.people where id=v_person.id;
  v_person.id:=v_candidate;
 end if;
 update public.people set email=v_user.email,updated_at=now() where id=v_person.id;
 return jsonb_build_object('id',v_person.id,'unresolved',v_count>1);
end $$;


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
 perform public.queue_transactional_email('confirmed:'||b.id,case when b.kind='trial' then 'trial_confirmed' else 'registration_confirmed' end,b.contact_email,p.preferred_locale,
 jsonb_build_object('name',b.contact_name,'startDate',b.start_date,'courses',(select jsonb_agg(jsonb_build_object('title',title_snapshot,'units',units,'unitPrice',unit_price,'unitMinutes',unit_minutes,'price',amount)) from public.booking_items where booking_id=b.id)));
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
 PERFORM public.queue_transactional_email('declined:'||b.id||':'||(b.revision+1),
   CASE WHEN b.kind='trial' THEN 'trial_cancelled' ELSE 'booking_cancelled' END,
   b.contact_email,v_locale,jsonb_build_object('name',b.contact_name,'startDate',b.start_date,
     'courses',(SELECT jsonb_agg(jsonb_build_object('title',title_snapshot)) FROM public.booking_items WHERE booking_id=b.id)));
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
 update public.invoice_cases set status=case when p_created then 'created' else 'outstanding' end,invoice_reference=nullif(btrim(p_reference),''),
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
 insert into public.courses(id,slug,title,description,type,category,level,unit_price,unit_minutes,start_date,end_date,trial_lessons,sort_order,archived_at)
 values(v_id,p_data->>'slug',p_data->>'title',coalesce(p_data->>'description',''),p_data->>'type',p_data->>'category',coalesce(p_data->>'level',''),(p_data->>'unit_price')::numeric,
 (p_data->>'unit_minutes')::integer,nullif(p_data->>'start_date','')::date,nullif(p_data->>'end_date','')::date,(p_data->>'trial_lessons')::boolean,(p_data->>'sort_order')::integer,
 case when (p_data->>'archived')::boolean then now() else null end)
 on conflict(id) do update set slug=excluded.slug,title=excluded.title,description=excluded.description,type=excluded.type,category=excluded.category,level=excluded.level,
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
-- Name: save_month(date, jsonb, boolean, uuid, integer); Type: FUNCTION; Schema: business_private; Owner: -
--

CREATE FUNCTION business_private.save_month(p_month date, p_course_selections jsonb, p_paused boolean, p_expected uuid, p_revision integer) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare p public.people;b public.bookings;v_next date;
begin
 perform business_private.claim_person();
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
  values(p.id,p_month,p_month,'monthly',case when p_paused then 'cancelled' else 'pending' end,p.display_name,p.email,p.birth_date,p.phone,p.street,p.postal_code,p.city,true,true) returning * into b;
 else
  update public.bookings set status=case when p_paused then 'cancelled' else 'pending' end,updated_at=now(),revision=revision+1 where id=b.id;
 end if;
 if p_paused then delete from public.booking_items where booking_id=b.id;
 else perform business_private.replace_items(b.id,p_course_selections);end if;
 return b.id;
end $$;


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
-- Name: record_attempt(uuid, text, boolean); Type: FUNCTION; Schema: grammar_private; Owner: -
--

CREATE FUNCTION grammar_private.record_attempt(p_exercise_id uuid, p_answer text, p_hint_shown boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  actor uuid := auth.uid();
  target public.learning_exercises;
  correct boolean;
  answer_normalized text;
  attempt_count integer;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF p_answer IS NULL OR length(btrim(p_answer)) = 0 OR length(p_answer) > 1000 THEN
    RAISE EXCEPTION 'invalid_answer' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO target FROM public.learning_exercises WHERE id = p_exercise_id;
  IF NOT FOUND OR target.type NOT IN ('fill_in_blank', 'multiple_choice') THEN
    RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE = '22023';
  END IF;
  IF NOT learning_private.unit_allowed(target.unit_id) THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
  IF coalesce(target.content->>'correct_answer', '') = '' THEN
    RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE = '22023';
  END IF;
  answer_normalized := lower(regexp_replace(btrim(p_answer), '\s+', ' ', 'g'));
  correct := answer_normalized = lower(regexp_replace(btrim(target.content->>'correct_answer'), '\s+', ' ', 'g'));

  IF NOT correct AND target.type='fill_in_blank' AND jsonb_typeof(target.content->'alternative_answers')='array' THEN
    correct := EXISTS(SELECT 1 FROM jsonb_array_elements_text(target.content->'alternative_answers') alt
      WHERE answer_normalized=lower(regexp_replace(btrim(alt), '\s+', ' ', 'g')));
  END IF;

  INSERT INTO public.user_exercise_progress AS progress
    (user_id, exercise_id, attempts, completed, score, hint_shown, updated_at)
  VALUES (actor, p_exercise_id, 1, correct, CASE WHEN correct THEN 100 ELSE 0 END, coalesce(p_hint_shown,false), now())
  ON CONFLICT (user_id, exercise_id) DO UPDATE SET
    attempts = progress.attempts + 1,
    completed = coalesce(progress.completed, false) OR correct,
    hint_shown = progress.hint_shown OR coalesce(p_hint_shown, false),
    score = greatest(coalesce(progress.score, 0), CASE WHEN correct THEN
      CASE WHEN progress.attempts + 1 <= 1 THEN 100 WHEN progress.attempts + 1 = 2 THEN 80
        WHEN progress.attempts + 1 = 3 THEN 60 ELSE 40 END ELSE 0 END),
    updated_at = now()
  RETURNING attempts INTO attempt_count;
  RETURN jsonb_build_object('success', true, 'attempts', attempt_count, 'isCorrect', correct);
END;
$$;


--
-- Name: current_profile_role(); Type: FUNCTION; Schema: identity_private; Owner: -
--

CREATE FUNCTION identity_private.current_profile_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT role FROM public.profiles WHERE id=(SELECT auth.uid()) AND (SELECT auth.uid()) IS NOT NULL
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
  WHERE id=p_id AND trainer=p_trainer RETURNING id INTO result;
  IF result IS NULL THEN INSERT INTO public.learning_units(id,level,trainer,label,is_active,sort_order)
   VALUES(p_id,p_level,p_trainer,p_label,p_active,p_sort) RETURNING id INTO result; END IF;
 ELSE
  PERFORM pg_advisory_xact_lock(hashtextextended('learning-unit:'||p_level||':'||p_trainer||':'||p_label,0));
  IF p_trainer IN('vocabulary','exercises') THEN
   SELECT id INTO result FROM public.learning_units WHERE level=p_level AND trainer=p_trainer AND label=p_label;
  END IF;
  IF result IS NULL THEN INSERT INTO public.learning_units(level,trainer,label,is_active,sort_order)
   VALUES(p_level,p_trainer,p_label,p_active,p_sort) RETURNING id INTO result; END IF;
 END IF;
 IF result IS NULL THEN RAISE EXCEPTION 'Unit unavailable' USING ERRCODE='23514'; END IF;
 RETURN result;
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
 DELETE FROM public.vocabulary_direction_progress p USING public.learning_vocabulary_cards c,public.learning_units u WHERE u.id=c.unit_id AND p.card_id=c.id AND p.user_id=p_student_id AND u.level=p_level;
 DELETE FROM public.user_exercise_progress p USING public.learning_exercises e,public.learning_units u WHERE u.id=e.unit_id AND p.exercise_id=e.id AND p.user_id=p_student_id AND u.level=p_level;
 DELETE FROM public.vocabulary_onboarding WHERE user_id=p_student_id AND level=p_level;
 UPDATE public.vocabulary_learning_state SET last_card_id=NULL WHERE user_id=p_student_id AND last_card_id IN(SELECT c.id FROM public.learning_vocabulary_cards c JOIN public.learning_units u ON u.id=c.unit_id WHERE u.level=p_level);
END $$;


--
-- Name: unit_allowed(uuid); Type: FUNCTION; Schema: learning_private; Owner: -
--

CREATE FUNCTION learning_private.unit_allowed(p_unit_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT EXISTS(SELECT 1 FROM public.learning_units u WHERE u.id=p_unit_id
 AND trainer_access_private.unit_allowed(u.level,u.trainer,u.id::text));
$$;


--
-- Name: validate_content_unit(); Type: FUNCTION; Schema: learning_private; Owner: -
--

CREATE FUNCTION learning_private.validate_content_unit() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
 IF NEW.unit_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.learning_units WHERE id=NEW.unit_id AND trainer=TG_ARGV[0]) THEN
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
  WHERE v.source_url IS NULL AND u.is_active
  AND ((TG_TABLE_NAME='learning_videos' AND v.id=NEW.id) OR (TG_TABLE_NAME='learning_units' AND u.id=NEW.id)))
 THEN RAISE EXCEPTION 'Published learning resources require a source URL' USING ERRCODE='23514'; END IF;
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
 SELECT active INTO was_active FROM learning_reset_private.jobs WHERE user_id=p_user;
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-reset:' || p_user::text,0));
 IF coalesce(was_active,false) OR EXISTS(SELECT 1 FROM learning_reset_private.jobs WHERE user_id=p_user AND
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
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM learning_reset_private.jobs WHERE user_id=actor AND token=p_token) THEN
  RAISE EXCEPTION 'reset_owner_required' USING ERRCODE='42501';
 END IF;
 RETURN QUERY SELECT a.bucket_id,a.object_name FROM learning_reset_private.audio_objects a
 JOIN storage.objects o ON o.id=a.object_id AND o.bucket_id=a.bucket_id AND o.name=a.object_name
 JOIN learning_reset_private.jobs j ON j.user_id=a.user_id
 WHERE a.user_id=actor AND j.active ORDER BY a.bucket_id,a.object_name LIMIT 500;
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
 SELECT * INTO job FROM learning_reset_private.jobs WHERE user_id=actor FOR UPDATE;
 IF FOUND AND job.active THEN RETURN job.token; END IF;
 INSERT INTO learning_reset_private.jobs(user_id) VALUES(actor)
 ON CONFLICT(user_id) DO UPDATE SET token=gen_random_uuid(),active=true,requested_at=clock_timestamp(),completed_at=NULL RETURNING * INTO job;
 DELETE FROM learning_reset_private.audio_objects WHERE user_id=actor;
 INSERT INTO learning_reset_private.audio_objects(user_id,object_id,bucket_id,object_name)
 SELECT actor,o.id,o.bucket_id,o.name FROM storage.objects o WHERE o.bucket_id='pronunciation_audio' AND (
   o.owner_id=actor::text OR(o.owner_id IS NULL AND split_part(o.name,'/',1)=actor::text)
   OR EXISTS(SELECT 1 FROM public.pronunciation_messages m JOIN public.submissions s ON s.id=m.submission_id WHERE s.user_id=actor
    AND (o.owner_id=m.sender_id::text OR(o.owner_id IS NULL AND split_part(o.name,'/',1)=m.sender_id::text))
    AND learning_reset_private.matches_audio(m.audio_path,o.bucket_id,o.name)))
 AND NOT EXISTS(SELECT 1 FROM public.submissions s WHERE s.user_id<>actor AND learning_reset_private.matches_audio(s.content_url,o.bucket_id,o.name))
 AND NOT EXISTS(SELECT 1 FROM public.pronunciation_messages m JOIN public.submissions s ON s.id=m.submission_id WHERE s.user_id<>actor AND learning_reset_private.matches_audio(m.audio_path,o.bucket_id,o.name));
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
 SELECT 1 FROM learning_reset_private.audio_objects a JOIN learning_reset_private.jobs j USING(user_id)
 WHERE a.user_id=(SELECT auth.uid()) AND a.object_id=p_id AND j.active);
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
 SELECT * INTO job FROM learning_reset_private.jobs WHERE user_id=actor AND token=p_token FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'reset_owner_required' USING ERRCODE='42501'; END IF;
 IF NOT job.active THEN RETURN true; END IF;
 IF EXISTS(SELECT 1 FROM learning_reset_private.audio_objects a JOIN storage.objects o ON o.id=a.object_id WHERE a.user_id=actor) THEN
  RAISE EXCEPTION 'audio_removal_incomplete' USING ERRCODE='55000'; END IF;
 DELETE FROM public.pronunciation_messages WHERE submission_id IN(SELECT id FROM public.submissions WHERE user_id=actor);
 DELETE FROM public.submissions WHERE user_id=actor;
 DELETE FROM vocabulary_private.answer_receipts WHERE user_id=actor;
 DELETE FROM public.vocabulary_direction_progress WHERE user_id=actor;
 DELETE FROM public.vocabulary_learning_state WHERE user_id=actor;
 DELETE FROM public.vocabulary_onboarding WHERE user_id=actor;
 DELETE FROM public.user_exercise_progress WHERE user_id=actor;
 DELETE FROM learning_reset_private.audio_objects WHERE user_id=actor;
 UPDATE learning_reset_private.jobs SET active=false,completed_at=clock_timestamp() WHERE user_id=actor;
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
  IF EXISTS(SELECT 1 FROM learning_reset_private.audio_objects a JOIN learning_reset_private.jobs j USING(user_id)
   WHERE j.active AND learning_reset_private.matches_audio(reference,a.bucket_id,a.object_name)) THEN
   RAISE EXCEPTION 'learning_reset_in_progress' USING ERRCODE='55000'; END IF;
 END IF;
 IF TG_TABLE_NAME='pronunciation_messages' THEN SELECT user_id INTO learner FROM public.submissions WHERE id=NEW.submission_id;
 ELSE learner:=NEW.user_id; END IF;
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
 IF EXISTS(SELECT 1 FROM learning_reset_private.audio_objects a JOIN learning_reset_private.jobs j USING(user_id)
  WHERE a.object_id=p_id AND j.active) THEN RAISE EXCEPTION 'learning_reset_in_progress' USING ERRCODE='55000'; END IF;
 PERFORM learning_reset_private.assert_writable((SELECT auth.uid()));
 RETURN true;
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
    (s.user_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.learning_reading_texts r WHERE r.id=s.prompt_id AND learning_private.unit_allowed(r.unit_id))))
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
 INSERT INTO public.submissions(user_id,type,content_url,text_content,status,level,prompt_id,prompt_title)
 VALUES(actor,'audio',p_audio_path,prompt.sentence_de,'pending',unit.level,prompt.id,unit.label) RETURNING id INTO result;
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
 UPDATE public.submissions SET status = CASE WHEN NEW.sender_role IN ('teacher','admin') THEN 'reviewed' ELSE 'pending' END WHERE id = NEW.submission_id;
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

CREATE FUNCTION public.begin_learning_reset(p_confirmation text) RETURNS uuid
    LANGUAGE sql
    SET search_path TO ''
    AS $$ SELECT learning_reset_private.begin_reset(p_confirmation); $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: mail_outbox; Type: TABLE; Schema: private; Owner: -
--

CREATE TABLE private.mail_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dedupe_key text NOT NULL,
    kind text NOT NULL,
    recipient text NOT NULL,
    locale text DEFAULT 'de'::text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
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
    CONSTRAINT mail_outbox_check CHECK (((status = 'processing'::text) = ((lease_token IS NOT NULL) AND (lease_until IS NOT NULL)))),
    CONSTRAINT mail_outbox_dedupe_key_check CHECK (((length(dedupe_key) >= 1) AND (length(dedupe_key) <= 240))),
    CONSTRAINT mail_outbox_kind_check CHECK ((kind = ANY (ARRAY['registration_received'::text, 'registration_confirmed'::text, 'booking_cancelled'::text, 'cancellation_requested'::text, 'trial_confirmed'::text, 'trial_cancelled'::text, 'new_enrollment'::text, 'feedback_available'::text, 'raw'::text]))),
    CONSTRAINT mail_outbox_locale_check CHECK ((locale = ANY (ARRAY['de'::text, 'en'::text, 'ru'::text, 'uk'::text, 'tr'::text]))),
    CONSTRAINT mail_outbox_payload_check CHECK (((jsonb_typeof(payload) = 'object'::text) AND (octet_length((payload)::text) <= 262144))),
    CONSTRAINT mail_outbox_recipient_check CHECK (((length(recipient) <= 254) AND (recipient ~ '^[^[:space:]<>@,;]+@[^[:space:]<>@,;]+\.[^[:space:]<>@,;]+$'::text))),
    CONSTRAINT mail_outbox_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'failed'::text])))
);


--
-- Name: TABLE mail_outbox; Type: COMMENT; Schema: private; Owner: -
--

COMMENT ON TABLE private.mail_outbox IS 'Transactional native SMTP outbox. Stable dedupe key and Message-ID; at-least-once delivery after SMTP/DB crash. Failed jobs require operator inspection. Contains private mail payloads.';


--
-- Name: claim_mail_jobs(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_mail_jobs(p_worker_id uuid, p_limit integer DEFAULT 5) RETURNS SETOF private.mail_outbox
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  -- Exhausted crashed deliveries are quarantined instead of being retried forever.
  UPDATE private.mail_outbox SET status='failed',lease_until=NULL,lease_token=NULL,worker_id=NULL,last_error='lease_expired_at_attempt_limit'
    WHERE status='processing' AND lease_until<now() AND attempts>=8;
  RETURN QUERY WITH picked AS (
    SELECT id FROM private.mail_outbox
    WHERE attempts<8 AND ((status='pending' AND available_at<=now()) OR (status='processing' AND lease_until<now()))
    ORDER BY available_at,created_at LIMIT greatest(1,least(coalesce(p_limit,5),20)) FOR UPDATE SKIP LOCKED
  ) UPDATE private.mail_outbox j SET status='processing',attempts=j.attempts+1,
      worker_id=p_worker_id,lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes'
    FROM picked WHERE j.id=picked.id RETURNING j.*;
END $$;


--
-- Name: claim_verified_person(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_verified_person() RETURNS jsonb
    LANGUAGE sql
    SET search_path TO ''
    AS $$SELECT business_private.claim_person()$$;


--
-- Name: complete_mail_job(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_mail_job(p_id uuid, p_lease_token uuid, p_message_id text) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE n integer;
BEGIN
  UPDATE private.mail_outbox SET status='sent',sent_at=now(),message_id=left(p_message_id,300),
    lease_token=NULL,lease_until=NULL,worker_id=NULL,last_error=NULL
    WHERE id=p_id AND status='processing' AND lease_token=p_lease_token AND lease_until>now();
  GET DIAGNOSTICS n=ROW_COUNT; RETURN n=1;
END $$;


--
-- Name: confirm_business_booking(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_business_booking(p_id uuid) RETURNS void
    LANGUAGE sql
    SET search_path TO ''
    AS $$select business_private.confirm_booking(p_id);$$;


--
-- Name: consume_rate_limit(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer) RETURNS TABLE(success boolean, remaining integer, reset_at timestamp with time zone)
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
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
  RETURN QUERY SELECT v_count<=p_limit,GREATEST(0,p_limit-v_count),v_reset;
END;
$_$;


--
-- Name: create_pronunciation_submission(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_pronunciation_submission(p_prompt_id uuid, p_audio_path text) RETURNS uuid
    LANGUAGE sql
    SET search_path TO ''
    AS $$ SELECT pronunciation_private.create_submission(p_prompt_id,p_audio_path); $$;


--
-- Name: decline_business_booking(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decline_business_booking(p_id uuid) RETURNS void
    LANGUAGE sql
    SET search_path TO ''
    AS $$ SELECT business_private.decline_booking(p_id); $$;


--
-- Name: delete_learning_content(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_learning_content(p_trainer text, p_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$ BEGIN
 IF coalesce((SELECT identity_private.current_profile_role()),'') NOT IN('teacher','admin') THEN RAISE EXCEPTION 'Staff required' USING ERRCODE='42501'; END IF;
 IF p_trainer='vocabulary' THEN DELETE FROM public.learning_vocabulary_cards WHERE id=p_id;
 ELSIF p_trainer='exercises' THEN DELETE FROM public.learning_exercises WHERE id=p_id;
 ELSIF p_trainer='pronunciation' THEN UPDATE public.learning_units SET is_active=false WHERE id=(SELECT unit_id FROM public.learning_reading_texts WHERE id=p_id);
 ELSIF p_trainer='videos' THEN DELETE FROM public.learning_videos WHERE id=p_id;
 ELSE RAISE EXCEPTION 'Invalid trainer' USING ERRCODE='23514'; END IF;
END $$;


--
-- Name: fail_mail_job(uuid, uuid, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fail_mail_job(p_id uuid, p_lease_token uuid, p_error text, p_permanent boolean DEFAULT false) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE n integer;
BEGIN
  UPDATE private.mail_outbox SET status=CASE WHEN p_permanent OR attempts>=8 THEN 'failed' ELSE 'pending' END,
    available_at=now()+make_interval(secs=>least(21600,(30*power(2,greatest(attempts-1,0)))::integer)),
    last_error=left(p_error,200),lease_token=NULL,lease_until=NULL,worker_id=NULL
    WHERE id=p_id AND status='processing' AND lease_token=p_lease_token AND lease_until>now();
  GET DIAGNOSTICS n=ROW_COUNT; RETURN n=1;
END $$;


--
-- Name: finish_learning_reset(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finish_learning_reset(p_token uuid) RETURNS boolean
    LANGUAGE sql
    SET search_path TO ''
    AS $$ SELECT learning_reset_private.finish_reset(p_token); $$;


--
-- Name: initialize_vocabulary_cards(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_vocabulary_cards(p_decisions jsonb) RETURNS jsonb
    LANGUAGE sql
    SET search_path TO ''
    AS $$
  SELECT vocabulary_private.initialize_cards(p_decisions);
$$;


--
-- Name: learning_reset_audio_batch(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.learning_reset_audio_batch(p_token uuid) RETURNS TABLE(bucket_id text, object_name text)
    LANGUAGE sql
    SET search_path TO ''
    AS $$
 SELECT * FROM learning_reset_private.audio_batch(p_token);
$$;


--
-- Name: mark_business_invoice(uuid, date, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_business_invoice(p_booking uuid, p_month date, p_created boolean, p_reference text DEFAULT ''::text) RETURNS void
    LANGUAGE sql
    SET search_path TO ''
    AS $$select business_private.mark_invoice(p_booking,p_month,p_created,p_reference);$$;


--
-- Name: mark_pronunciation_seen(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_pronunciation_seen(p_submission_id uuid) RETURNS void
    LANGUAGE sql
    SET search_path TO ''
    AS $$ SELECT pronunciation_private.mark_seen(p_submission_id); $$;


--
-- Name: prepare_business_month(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prepare_business_month(p_month date) RETURNS integer
    LANGUAGE sql
    SET search_path TO ''
    AS $$select business_private.prepare_month(p_month);$$;


--
-- Name: queue_transactional_email(text, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.queue_transactional_email(p_dedupe_key text, p_kind text, p_recipient text, p_locale text, p_payload jsonb) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO private.mail_outbox(dedupe_key,kind,recipient,locale,payload)
  VALUES(p_dedupe_key,p_kind,lower(trim(p_recipient)),CASE WHEN p_locale IN ('de','en','ru','uk','tr') THEN p_locale ELSE 'de' END,p_payload)
  ON CONFLICT(dedupe_key) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN SELECT id INTO v_id FROM private.mail_outbox WHERE dedupe_key=p_dedupe_key; END IF;
  RETURN v_id;
END $$;


--
-- Name: record_grammar_attempt(uuid, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_grammar_attempt(p_exercise_id uuid, p_answer text, p_hint_shown boolean DEFAULT false) RETURNS jsonb
    LANGUAGE sql
    SET search_path TO ''
    AS $$
  SELECT grammar_private.record_attempt(p_exercise_id, p_answer, p_hint_shown);
$$;


--
-- Name: reset_student_level_progress(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_student_level_progress(p_student_id uuid, p_level text) RETURNS void
    LANGUAGE sql
    SET search_path TO ''
    AS $$ SELECT learning_private.reset_student_level(p_student_id,p_level); $$;


--
-- Name: reset_vocabulary_lesson_progress(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_vocabulary_lesson_progress(p_unit_id uuid) RETURNS void
    LANGUAGE sql
    SET search_path TO ''
    AS $$ SELECT vocabulary_private.reset_lesson(p_unit_id); $$;


--
-- Name: save_business_course(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_business_course(p_data jsonb) RETURNS uuid
    LANGUAGE sql
    SET search_path TO ''
    AS $$select business_private.save_course(p_data);$$;


--
-- Name: save_business_month(date, jsonb, boolean, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_business_month(p_month date, p_course_selections jsonb, p_paused boolean, p_expected uuid DEFAULT NULL::uuid, p_revision integer DEFAULT NULL::integer) RETURNS uuid
    LANGUAGE sql
    SET search_path TO ''
    AS $$select business_private.save_month(p_month,p_course_selections,p_paused,p_expected,p_revision);$$;


--
-- Name: save_learning_content(text, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_learning_content(p_trainer text, p_payload jsonb, p_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE old_fields jsonb; fields jsonb; unit_data jsonb:=p_payload->'unit'; translations jsonb:=p_payload->'translations';
 item uuid:=coalesce(p_id,gen_random_uuid()); old_unit uuid; target_unit uuid; old_meta public.learning_units; translation_row jsonb;
BEGIN
 IF current_user NOT IN('service_role','postgres') AND coalesce(identity_private.current_profile_role(),'') NOT IN('teacher','admin') THEN RAISE EXCEPTION 'Staff required' USING ERRCODE='42501'; END IF;
 IF p_trainer IS NULL OR NOT EXISTS(SELECT 1 FROM public.learning_trainers WHERE code=p_trainer)
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
  VALUES(item,target_unit,fields->>'word_de',fields->>'article',fields->>'plural',fields->>'image_url',fields->>'audio_url',coalesce((fields->>'sentence_practice')::boolean,false),
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
  VALUES(item,target_unit,fields->>'topic',fields->>'type',fields->'content',fields->>'solution_audio_url')
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,topic=excluded.topic,type=excluded.type,content=excluded.content,solution_audio_url=excluded.solution_audio_url;
  DELETE FROM public.grammar_translations WHERE exercise_id=item;
  FOR translation_row IN SELECT value FROM jsonb_array_elements(translations) LOOP
   INSERT INTO public.grammar_translations(exercise_id,locale,hint,smart_hint,explanation)
   VALUES(item,translation_row->>'locale',translation_row->>'hint',translation_row->>'smart_hint',translation_row->>'explanation');
  END LOOP;
 ELSIF p_trainer='pronunciation' THEN
  INSERT INTO public.learning_reading_texts(id,unit_id,sentence_de,focus,audio_url)
  VALUES(item,target_unit,fields->>'sentence_de',fields->>'focus',fields->>'audio_url')
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,sentence_de=excluded.sentence_de,focus=excluded.focus,audio_url=excluded.audio_url;
 ELSE
  INSERT INTO public.learning_videos(id,unit_id,description,source_url)
  VALUES(item,target_unit,fields->>'description',nullif(btrim(fields->>'source_url'),''))
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,description=excluded.description,source_url=excluded.source_url;
 END IF;
 IF old_unit IS NOT NULL AND old_unit<>target_unit THEN
  DELETE FROM public.learning_units u WHERE u.id=old_unit
  AND NOT EXISTS(SELECT 1 FROM public.learning_vocabulary_cards c WHERE c.unit_id=u.id)
  AND NOT EXISTS(SELECT 1 FROM public.learning_exercises c WHERE c.unit_id=u.id)
  AND NOT EXISTS(SELECT 1 FROM public.learning_reading_texts c WHERE c.unit_id=u.id)
  AND NOT EXISTS(SELECT 1 FROM public.learning_videos c WHERE c.unit_id=u.id);
 END IF;
 RETURN jsonb_build_object('id',item);
END $$;


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
-- Name: save_student_blackboard(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_student_blackboard(p_student_id uuid, p_note_text text, p_expected_note_id uuid DEFAULT NULL::uuid) RETURNS SETOF public.teacher_student_notes
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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
  IF prose='' THEN RETURN; END IF;
  RETURN QUERY INSERT INTO public.teacher_student_notes(student_id,teacher_id,note_text) VALUES(p_student_id,actor,prose) RETURNING *;
 ELSE
  RETURN QUERY UPDATE public.teacher_student_notes SET note_text=prose WHERE id=board.id AND student_id=p_student_id RETURNING *;
 END IF;
END $$;


--
-- Name: set_student_level_access(uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_student_level_access(p_user_id uuid, p_levels text[]) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$ BEGIN
 IF (SELECT identity_private.current_profile_role()) NOT IN('teacher','admin') OR auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Staff required' USING ERRCODE='42501'; END IF;
 IF p_levels IS NULL OR EXISTS(SELECT 1 FROM unnest(p_levels) l WHERE l IS NULL OR NOT EXISTS(SELECT 1 FROM public.learning_levels WHERE code=l)) THEN
  RAISE EXCEPTION 'Invalid levels' USING ERRCODE='23514'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-access:'||p_user_id::text,0));
 DELETE FROM public.student_level_access WHERE user_id=p_user_id AND NOT(level=ANY(p_levels));
 INSERT INTO public.student_level_access SELECT p_user_id,l FROM unnest(p_levels) l ON CONFLICT DO NOTHING;
END $$;


--
-- Name: set_student_trainer_access(uuid, text, text, boolean, uuid[], boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_student_trainer_access(p_user_id uuid, p_level text, p_trainer text, p_enabled boolean, p_unit_ids uuid[] DEFAULT NULL::uuid[], p_replace_units boolean DEFAULT false) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$ BEGIN
 IF (SELECT identity_private.current_profile_role()) NOT IN('teacher','admin') OR auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Staff required' USING ERRCODE='42501'; END IF;
 IF p_replace_units AND p_unit_ids IS NOT NULL AND EXISTS(SELECT 1 FROM unnest(p_unit_ids) item WHERE NOT EXISTS(
 SELECT 1 FROM public.learning_units u WHERE u.id=item AND u.level=p_level AND u.trainer=p_trainer)) THEN
  RAISE EXCEPTION 'Unit outside trainer' USING ERRCODE='23514'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-access:'||p_user_id::text,0));
 INSERT INTO public.learning_trainer_grants(user_id,level,trainer,enabled,unit_mode)
 VALUES(p_user_id,p_level,p_trainer,p_enabled,CASE WHEN p_replace_units AND p_unit_ids IS NOT NULL THEN 'selected' ELSE 'all' END)
 ON CONFLICT(user_id,level,trainer) DO UPDATE SET enabled=excluded.enabled,
 unit_mode=CASE WHEN p_replace_units THEN excluded.unit_mode ELSE public.learning_trainer_grants.unit_mode END;
 IF p_replace_units THEN
  DELETE FROM public.learning_unit_grants WHERE user_id=p_user_id AND level=p_level AND trainer=p_trainer;
  INSERT INTO public.learning_unit_grants SELECT DISTINCT p_user_id,p_level,p_trainer,item FROM unnest(p_unit_ids) item;
 END IF;
END $$;


--
-- Name: skip_vocabulary_assessment(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.skip_vocabulary_assessment(p_level text) RETURNS jsonb
    LANGUAGE sql
    SET search_path TO ''
    AS $$
  SELECT vocabulary_private.skip_assessment(p_level);
$$;


--
-- Name: submit_business_cancellation(text, text, text, text, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_business_cancellation(p_name text, p_email text, p_course text, p_type text, p_date date DEFAULT NULL::date, p_locale text DEFAULT 'de'::text) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare v_id uuid;
begin
 if length(p_name) not between 2 and 160 or length(p_email) not between 3 and 254 or (p_type='specific_date' and p_date is null) then raise check_violation;end if;
 insert into public.cancellation_requests(full_name,email,course_name,termination_type,termination_date) values(p_name,lower(p_email),p_course,p_type,p_date) returning id into v_id;
 perform public.queue_transactional_email('cancellation:'||v_id,'cancellation_requested',lower(p_email),p_locale,jsonb_build_object('name',p_name,'endDate',p_date,'message',p_course));
 return v_id;
end $$;


--
-- Name: submit_business_registration(jsonb, jsonb, date, jsonb, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_business_registration(p_contact jsonb, p_course_selections jsonb, p_start date, p_consents jsonb, p_locale text DEFAULT 'de'::text, p_trial boolean DEFAULT false) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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
 values(v_person,date_trunc('month',p_start)::date,p_start,case when p_trial then 'trial' else 'registration' end,v_name,v_email,(p_contact->>'birth_date')::date,p_contact->>'phone',p_contact->>'street',p_contact->>'postal_code',p_contact->>'city',true,true,coalesce((p_consents->>'revocation')::boolean,false),(p_consents->>'recording')::boolean) returning id into v_booking;
 perform business_private.replace_items(v_booking,p_course_selections);
 perform public.queue_transactional_email('registration:'||v_booking,'registration_received',v_email,p_locale,jsonb_build_object('name',v_name,'startDate',p_start,'courses',(select jsonb_agg(jsonb_build_object('title',title_snapshot,'units',units,'unitPrice',unit_price,'unitMinutes',unit_minutes,'price',amount)) from public.booking_items where booking_id=v_booking)));
 perform public.queue_transactional_email('staff-registration:'||v_booking,'new_enrollment','info@sitov-academy.com','de',jsonb_build_object('name',v_name,'path','/de/admin/registrations'));
 return v_booking;
end $$;


--
-- Name: submit_vocabulary_answer(uuid, boolean, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_vocabulary_answer(p_progress_id uuid, p_is_correct boolean DEFAULT NULL::boolean, p_typed_answer text DEFAULT NULL::text, p_ui_language text DEFAULT 'de'::text) RETURNS jsonb
    LANGUAGE sql
    SET search_path TO ''
    AS $$
  SELECT vocabulary_private.submit_answer(p_progress_id,p_is_correct,p_typed_answer,p_ui_language);
$$;


--
-- Name: submit_vocabulary_answer_once(uuid, uuid, boolean, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_vocabulary_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean DEFAULT NULL::boolean, p_typed_answer text DEFAULT NULL::text, p_ui_language text DEFAULT 'de'::text) RETURNS jsonb
    LANGUAGE sql
    SET search_path TO ''
    AS $$
  SELECT vocabulary_private.submit_answer_once(p_request_id, p_progress_id, p_is_correct, p_typed_answer, p_ui_language);
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
 AND EXISTS(SELECT 1 FROM public.student_level_access l WHERE l.user_id=p.id AND l.level=p_level)
 AND coalesce((SELECT a.enabled FROM public.learning_trainer_grants a WHERE a.user_id=p.id AND a.level=p_level AND a.trainer=p_trainer),true))));
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
 AND trainer_access_private.unit_allowed(u.level,u.trainer,u.id::text))));
$$;


--
-- Name: unit_allowed(text, text, text); Type: FUNCTION; Schema: trainer_access_private; Owner: -
--

CREATE FUNCTION trainer_access_private.unit_allowed(p_level text, p_trainer text, p_unit text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 SELECT trainer_access_private.allowed(p_level,p_trainer) AND EXISTS(SELECT 1 FROM public.learning_units u
 WHERE u.level=p_level AND u.trainer=p_trainer AND u.id::text=p_unit AND(
 (SELECT identity_private.current_profile_role()) IN('teacher','admin') OR(u.is_active AND NOT EXISTS(
 SELECT 1 FROM public.learning_trainer_grants a WHERE a.user_id=(SELECT auth.uid()) AND a.level=p_level AND a.trainer=p_trainer
 AND a.unit_mode='selected' AND NOT EXISTS(SELECT 1 FROM public.learning_unit_grants g
 WHERE g.user_id=a.user_id AND g.level=a.level AND g.trainer=a.trainer AND g.unit_id=u.id)))));
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
    INSERT INTO public.vocabulary_direction_progress(user_id, card_id, direction, box_number, next_review_date)
      SELECT actor, target, d, CASE WHEN known THEN 6 ELSE 1 END,
        CASE WHEN known THEN now() + interval '90 days' ELSE now() END
      FROM unnest(CASE WHEN selected_direction IS NULL THEN ARRAY['de_to_native','native_to_de'] ELSE ARRAY[selected_direction] END) d
      ON CONFLICT (user_id, card_id, direction) DO NOTHING;
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
 DELETE FROM public.vocabulary_direction_progress v USING public.learning_vocabulary_cards c WHERE v.user_id=actor AND v.card_id=c.id AND c.unit_id=p_unit_id;
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
 INSERT INTO public.vocabulary_onboarding(user_id,level,status,started_unit_id) VALUES(actor,p_level,'skipped',first_unit.id)
 ON CONFLICT(user_id,level) DO UPDATE SET status='skipped',started_unit_id=excluded.started_unit_id,updated_at=now();
 RETURN result||jsonb_build_object('lesson',first_unit.label);
END $$;


--
-- Name: submit_answer(uuid, boolean, text, text); Type: FUNCTION; Schema: vocabulary_private; Owner: -
--

CREATE FUNCTION vocabulary_private.submit_answer(p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  actor uuid := auth.uid(); progress public.vocabulary_direction_progress; card public.learning_vocabulary_cards;
  profile public.profiles; german_sentence text; previous_card uuid; prompt text; correct boolean; sentence boolean;
  old_phase integer; new_phase integer; new_box integer; days integer; difficult boolean;
  is_alternative boolean := false;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF p_ui_language NOT IN ('de','en','ru','uk','tr') OR p_ui_language IS NULL THEN
    RAISE EXCEPTION 'invalid_language' USING ERRCODE = '22023';
  END IF;
  IF length(p_typed_answer) > 4000 THEN RAISE EXCEPTION 'answer_too_long' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:' || actor::text, 0));
  SELECT * INTO progress FROM public.vocabulary_direction_progress WHERE id = p_progress_id AND user_id = actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'progress_not_found' USING ERRCODE = '42501'; END IF;
  SELECT * INTO card FROM public.learning_vocabulary_cards WHERE id = progress.card_id;
  SELECT * INTO profile FROM public.profiles WHERE id = actor;
  IF NOT learning_private.unit_allowed(card.unit_id) OR p_ui_language='de' THEN
    RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501';
  END IF;
  IF progress.box_number = 7 OR progress.next_review_date > now() THEN
    RAISE EXCEPTION 'review_not_due' USING ERRCODE = 'PT409';
  END IF;
  SELECT last_card_id INTO previous_card FROM public.vocabulary_learning_state WHERE user_id = actor;
  IF previous_card = progress.card_id THEN
    RAISE EXCEPTION 'vocabulary_spacing_required' USING ERRCODE = 'PT409';
  END IF;
  SELECT context_sentence INTO prompt FROM public.vocabulary_translations WHERE card_id=card.id AND locale=p_ui_language;
  SELECT context_sentence INTO german_sentence FROM public.vocabulary_translations WHERE card_id=card.id AND locale='de';
  sentence := card.sentence_practice AND progress.direction = 'native_to_de';
  IF sentence AND (nullif(btrim(prompt),'') IS NULL OR nullif(btrim(german_sentence),'') IS NULL) THEN
    RAISE EXCEPTION 'sentence_content_missing' USING ERRCODE='23514';
  END IF;
  IF sentence THEN
    -- Byte-exact comparison: no trimming, case folding, punctuation removal or client grading.
    correct := coalesce(convert_to(p_typed_answer,'UTF8') = convert_to(german_sentence,'UTF8'),false);
    IF NOT correct AND card.alternative_answers_de IS NOT NULL AND array_length(card.alternative_answers_de, 1) > 0 THEN
      IF coalesce(convert_to(p_typed_answer,'UTF8') = ANY (
           SELECT convert_to(alt, 'UTF8') FROM unnest(card.alternative_answers_de) alt
         ), false) THEN
        correct := true;
        is_alternative := true;
      END IF;
    END IF;
  ELSE
    IF p_is_correct IS NULL THEN RAISE EXCEPTION 'answer_required' USING ERRCODE = '22023'; END IF;
    correct := p_is_correct;
  END IF;
  old_phase := least(6,greatest(1,coalesce(progress.box_number,1)));
  new_phase := CASE WHEN correct THEN least(6,old_phase+1) ELSE greatest(1,old_phase-1) END;
  new_box := CASE WHEN correct AND old_phase=6 THEN 7 ELSE new_phase END;
  days := CASE new_phase WHEN 1 THEN 1 WHEN 2 THEN 1 WHEN 3 THEN 3 WHEN 4 THEN 9 WHEN 5 THEN 29 ELSE 90 END;
  SELECT coalesce(t.is_difficult,false) INTO difficult FROM public.vocabulary_translations t WHERE t.card_id=card.id AND t.locale=profile.native_language;
  IF difficult THEN days := greatest(1,days/2); END IF;
  UPDATE public.vocabulary_direction_progress SET box_number=new_box,next_review_date=now()+make_interval(days=>days),
    lapses=lapses+CASE WHEN NOT correct THEN 1 ELSE 0 END,last_answered_at=now(),updated_at=now()
    WHERE id = progress.id;
  INSERT INTO public.vocabulary_learning_state(user_id,last_card_id,last_reviewed_at)
    VALUES(actor,progress.card_id,now()) ON CONFLICT(user_id) DO UPDATE
    SET last_card_id=excluded.last_card_id,last_reviewed_at=excluded.last_reviewed_at;
  RETURN jsonb_build_object('success',true,'isCorrect',correct,'previousPhase',old_phase,'newPhase',new_phase,
    'becameLearned',new_box=7,'movedBack',new_phase<old_phase,'intervalInDays',days)
    || CASE WHEN sentence THEN jsonb_build_object('correctAnswer',german_sentence,'isAlternative',is_alternative) ELSE '{}'::jsonb END;
END;
$$;


--
-- Name: submit_answer_once(uuid, uuid, boolean, text, text); Type: FUNCTION; Schema: vocabulary_private; Owner: -
--

CREATE FUNCTION vocabulary_private.submit_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  actor uuid := auth.uid();
  receipt vocabulary_private.answer_receipts;
  result jsonb;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR p_progress_id IS NULL
    OR p_ui_language IS NULL OR p_ui_language NOT IN ('de','en','ru','uk','tr')
    OR length(p_typed_answer) > 4000 THEN
    RAISE EXCEPTION 'invalid_answer_request' USING ERRCODE = '22023';
  END IF;

  -- Use the SAME first lock as submit_answer. PostgreSQL transaction advisory
  -- locks are reentrant, so its nested acquisition cannot deadlock with us.
  -- Serialize lookup + grade + receipt together, including concurrent retries.
  PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:' || actor::text, 0));
  IF NOT EXISTS (SELECT 1 FROM public.vocabulary_direction_progress v JOIN public.learning_vocabulary_cards c ON c.id=v.card_id
    WHERE v.id=p_progress_id AND v.user_id=actor AND learning_private.unit_allowed(c.unit_id)) THEN
    RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501';
  END IF;
  IF p_ui_language='de' THEN
    RAISE EXCEPTION 'invalid_learning_language' USING ERRCODE='42501';
  END IF;
  SELECT * INTO receipt FROM vocabulary_private.answer_receipts
    WHERE user_id = actor AND request_id = p_request_id;
  IF FOUND THEN
    IF receipt.progress_id IS DISTINCT FROM p_progress_id
      OR receipt.is_correct IS DISTINCT FROM p_is_correct
      OR convert_to(receipt.typed_answer, 'UTF8') IS DISTINCT FROM convert_to(p_typed_answer, 'UTF8')
      OR receipt.ui_language IS DISTINCT FROM p_ui_language THEN
      RAISE EXCEPTION 'vocabulary_request_conflict' USING ERRCODE = '22023';
    END IF;
    -- Return before due/spacing checks: the first call already committed this
    -- exact answer, and a later review may have moved the persistent cursor.
    RETURN receipt.response;
  END IF;

  result := vocabulary_private.submit_answer(p_progress_id, p_is_correct, p_typed_answer, p_ui_language);
  INSERT INTO vocabulary_private.answer_receipts(
    user_id, request_id, progress_id, is_correct, typed_answer, ui_language, response
  ) VALUES (actor, p_request_id, p_progress_id, p_is_correct, p_typed_answer, p_ui_language, result);
  -- Both grading and receipt commit with this RPC; any exception rolls back both.
  RETURN result;
END;
$$;


--
-- Name: audio_objects; Type: TABLE; Schema: learning_reset_private; Owner: -
--

CREATE TABLE learning_reset_private.audio_objects (
    user_id uuid NOT NULL,
    object_id uuid NOT NULL,
    bucket_id text NOT NULL,
    object_name text NOT NULL,
    CONSTRAINT audio_objects_bucket_id_check CHECK ((bucket_id = 'pronunciation_audio'::text))
);


--
-- Name: jobs; Type: TABLE; Schema: learning_reset_private; Owner: -
--

CREATE TABLE learning_reset_private.jobs (
    user_id uuid NOT NULL,
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
    kind text DEFAULT 'registration'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
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
    CONSTRAINT bookings_kind_check CHECK ((kind = ANY (ARRAY['registration'::text, 'monthly'::text, 'trial'::text]))),
    CONSTRAINT bookings_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text, 'rejected'::text]))),
    CONSTRAINT bookings_target_month_check CHECK ((EXTRACT(day FROM target_month) = (1)::numeric))
);


--
-- Name: cancellation_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cancellation_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    course_name text,
    termination_type text NOT NULL,
    termination_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    CONSTRAINT cancellation_requests_termination_type_check CHECK ((termination_type = ANY (ARRAY['asap'::text, 'specific_date'::text])))
);


--
-- Name: cefr_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cefr_levels (
    code text NOT NULL,
    CONSTRAINT cefr_levels_code_check CHECK ((code = ANY (ARRAY['A1'::text, 'A2'::text, 'B1'::text, 'B2'::text, 'C1'::text, 'C2'::text])))
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
    CONSTRAINT course_translations_non_source_locale CHECK ((locale <> 'de'::text)),
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
    type text NOT NULL,
    category text NOT NULL,
    level text DEFAULT ''::text NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    unit_minutes integer DEFAULT 45 NOT NULL,
    start_date date,
    end_date date,
    trial_lessons boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT courses_category_check CHECK ((category = ANY (ARRAY['german'::text, 'speaking'::text, 'online'::text, 'private'::text]))),
    CONSTRAINT courses_check CHECK (((end_date IS NULL) OR (start_date IS NULL) OR (end_date >= start_date))),
    CONSTRAINT courses_slug_check CHECK ((slug ~ '^[a-z0-9][a-z0-9_-]{1,99}$'::text)),
    CONSTRAINT courses_title_check CHECK (((length(title) >= 1) AND (length(title) <= 180))),
    CONSTRAINT courses_type_check CHECK ((type = ANY (ARRAY['presence'::text, 'online'::text]))),
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
    CONSTRAINT grammar_translations_locale_check CHECK (((length(locale) >= 2) AND (length(locale) <= 20)))
);


--
-- Name: invoice_cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_cases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    person_id uuid NOT NULL,
    target_month date NOT NULL,
    booking_id uuid NOT NULL,
    status text DEFAULT 'outstanding'::text NOT NULL,
    invoice_reference text,
    invoice_created_at timestamp with time zone,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT invoice_cases_check CHECK (((status = 'created'::text) = (invoice_created_at IS NOT NULL))),
    CONSTRAINT invoice_cases_status_check CHECK ((status = ANY (ARRAY['outstanding'::text, 'created'::text]))),
    CONSTRAINT invoice_cases_target_month_check CHECK ((EXTRACT(day FROM target_month) = (1)::numeric))
);


--
-- Name: learning_exercises; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_exercises (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    topic text NOT NULL,
    type text NOT NULL,
    content jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    solution_audio_url text,
    unit_id uuid NOT NULL,
    content_version smallint DEFAULT 1 NOT NULL,
    CONSTRAINT exercises_type_check CHECK ((type = ANY (ARRAY['fill_in_blank'::text, 'multiple_choice'::text, 'sentence_building'::text]))),
    CONSTRAINT grammar_content_object CHECK ((jsonb_typeof(content) = 'object'::text)),
    CONSTRAINT learning_exercises_content_version_check CHECK ((content_version = 1))
);


--
-- Name: COLUMN learning_exercises.solution_audio_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.learning_exercises.solution_audio_url IS 'Optionale MP3-URL für die native Aussprache der Lösung (Tap-to-Listen).';


--
-- Name: learning_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_levels (
    code text NOT NULL,
    cefr_level text NOT NULL,
    sort_order smallint NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT learning_levels_cefr_level_check CHECK ((cefr_level = ANY (ARRAY['A1'::text, 'A2'::text, 'B1'::text, 'B2'::text, 'C1'::text, 'C2'::text]))),
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
    user_id uuid NOT NULL,
    level text NOT NULL,
    trainer text NOT NULL,
    enabled boolean NOT NULL,
    unit_mode text DEFAULT 'all'::text NOT NULL,
    CONSTRAINT learning_trainer_grants_trainer_check CHECK ((trainer = ANY (ARRAY['vocabulary'::text, 'exercises'::text, 'pronunciation'::text, 'videos'::text]))),
    CONSTRAINT learning_trainer_grants_unit_mode_check CHECK ((unit_mode = ANY (ARRAY['all'::text, 'selected'::text])))
);


--
-- Name: learning_trainers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_trainers (
    code text NOT NULL,
    CONSTRAINT learning_trainers_code_check CHECK ((code = ANY (ARRAY['vocabulary'::text, 'exercises'::text, 'pronunciation'::text, 'videos'::text])))
);


--
-- Name: learning_unit_grants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_unit_grants (
    user_id uuid NOT NULL,
    level text NOT NULL,
    trainer text NOT NULL,
    unit_id uuid NOT NULL
);


--
-- Name: learning_units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    level text NOT NULL,
    trainer text NOT NULL,
    label text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT learning_units_label_check CHECK (((length(btrim(label)) >= 1) AND (length(btrim(label)) <= 160))),
    CONSTRAINT learning_units_trainer_check CHECK ((trainer = ANY (ARRAY['vocabulary'::text, 'exercises'::text, 'pronunciation'::text, 'videos'::text])))
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
    CONSTRAINT learning_videos_source_url_check CHECK (((source_url IS NULL) OR (source_url ~* '^https?://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$'::text)))
);


--
-- Name: learning_vocabulary_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_vocabulary_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    word_de text NOT NULL,
    article text,
    plural text,
    image_url text,
    audio_url text,
    created_at timestamp with time zone DEFAULT now(),
    sentence_practice boolean DEFAULT false NOT NULL,
    alternative_answers_de text[] DEFAULT '{}'::text[] NOT NULL,
    unit_id uuid NOT NULL,
    CONSTRAINT vocabulary_cards_article_check CHECK ((article = ANY (ARRAY['der'::text, 'die'::text, 'das'::text, 'none'::text])))
);


--
-- Name: locales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locales (
    code text NOT NULL,
    CONSTRAINT locales_code_check CHECK ((code ~ '^[a-z]{2}$'::text))
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
    role text DEFAULT 'student'::text,
    ui_language text DEFAULT 'de'::text NOT NULL,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['student'::text, 'teacher'::text, 'admin'::text])))
);


--
-- Name: pronunciation_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pronunciation_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    submission_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    sender_role text DEFAULT 'student'::text NOT NULL,
    text_content text DEFAULT ''::text NOT NULL,
    audio_path text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    seen_at timestamp with time zone,
    CONSTRAINT pronunciation_message_not_empty CHECK (((length(btrim(text_content)) > 0) OR (audio_path IS NOT NULL))),
    CONSTRAINT pronunciation_messages_sender_role_check CHECK ((sender_role = ANY (ARRAY['student'::text, 'teacher'::text, 'admin'::text]))),
    CONSTRAINT pronunciation_messages_text_content_check CHECK ((char_length(text_content) <= 5000))
);


--
-- Name: student_level_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_level_access (
    user_id uuid NOT NULL,
    level text NOT NULL
);


--
-- Name: submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    content_url text,
    text_content text,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    level text DEFAULT 'A1.1'::text NOT NULL,
    prompt_id uuid,
    prompt_title text,
    CONSTRAINT submissions_level_check CHECK ((level = ANY (ARRAY['A1.1'::text, 'A1.2'::text, 'A2.1'::text, 'A2.2'::text, 'B1.1'::text, 'B1.2'::text]))),
    CONSTRAINT submissions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'reviewed'::text]))),
    CONSTRAINT submissions_type_check CHECK ((type = ANY (ARRAY['audio'::text, 'text'::text])))
);


--
-- Name: user_exercise_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_exercise_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
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
    user_id uuid NOT NULL,
    card_id uuid NOT NULL,
    direction text NOT NULL,
    box_number integer DEFAULT 1 NOT NULL,
    next_review_date timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    lapses integer DEFAULT 0 NOT NULL,
    last_answered_at timestamp with time zone,
    CONSTRAINT vocabulary_direction_progress_box_number_check CHECK (((box_number >= 1) AND (box_number <= 7))),
    CONSTRAINT vocabulary_direction_progress_direction_check CHECK ((direction = ANY (ARRAY['de_to_native'::text, 'native_to_de'::text])))
);


--
-- Name: vocabulary_learning_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vocabulary_learning_state (
    user_id uuid NOT NULL,
    last_card_id uuid,
    last_reviewed_at timestamp with time zone
);


--
-- Name: vocabulary_onboarding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vocabulary_onboarding (
    user_id uuid NOT NULL,
    level text NOT NULL,
    status text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    started_unit_id uuid NOT NULL,
    CONSTRAINT vocabulary_onboarding_level_check CHECK ((level = ANY (ARRAY['A1.1'::text, 'A1.2'::text, 'A2.1'::text, 'A2.2'::text, 'B1.1'::text, 'B1.2'::text]))),
    CONSTRAINT vocabulary_onboarding_status_check CHECK ((status = ANY (ARRAY['skipped'::text, 'completed'::text])))
);


--
-- Name: vocabulary_translations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vocabulary_translations (
    card_id uuid NOT NULL,
    locale text NOT NULL,
    translation text,
    context_sentence text,
    is_difficult boolean DEFAULT false NOT NULL,
    CONSTRAINT vocabulary_translations_locale_check CHECK ((locale = ANY (ARRAY['de'::text, 'en'::text, 'ru'::text, 'uk'::text, 'tr'::text])))
);


--
-- Name: answer_receipts; Type: TABLE; Schema: vocabulary_private; Owner: -
--

CREATE TABLE vocabulary_private.answer_receipts (
    user_id uuid NOT NULL,
    request_id uuid NOT NULL,
    progress_id uuid NOT NULL,
    is_correct boolean,
    typed_answer text,
    ui_language text NOT NULL,
    response jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT answer_receipts_response_check CHECK ((jsonb_typeof(response) = 'object'::text)),
    CONSTRAINT answer_receipts_typed_answer_check CHECK ((length(typed_answer) <= 4000)),
    CONSTRAINT answer_receipts_ui_language_check CHECK ((ui_language = ANY (ARRAY['de'::text, 'en'::text, 'ru'::text, 'uk'::text, 'tr'::text])))
);


--
-- Name: audio_objects audio_objects_pkey; Type: CONSTRAINT; Schema: learning_reset_private; Owner: -
--

ALTER TABLE ONLY learning_reset_private.audio_objects
    ADD CONSTRAINT audio_objects_pkey PRIMARY KEY (user_id, object_id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: learning_reset_private; Owner: -
--

ALTER TABLE ONLY learning_reset_private.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (user_id);


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
    ADD CONSTRAINT learning_trainer_grants_pkey PRIMARY KEY (user_id, level, trainer);


--
-- Name: learning_trainers learning_trainers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_trainers
    ADD CONSTRAINT learning_trainers_pkey PRIMARY KEY (code);


--
-- Name: learning_unit_grants learning_unit_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_unit_grants
    ADD CONSTRAINT learning_unit_grants_pkey PRIMARY KEY (user_id, level, trainer, unit_id);


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
-- Name: learning_videos learning_videos_unit_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_videos
    ADD CONSTRAINT learning_videos_unit_id_key UNIQUE (unit_id);


--
-- Name: locales locales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locales
    ADD CONSTRAINT locales_pkey PRIMARY KEY (code);


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
    ADD CONSTRAINT student_level_access_pkey PRIMARY KEY (user_id, level);


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
    ADD CONSTRAINT user_exercise_progress_user_id_exercise_id_key UNIQUE (user_id, exercise_id);


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
    ADD CONSTRAINT vocabulary_direction_progress_user_id_card_id_direction_key UNIQUE (user_id, card_id, direction);


--
-- Name: vocabulary_learning_state vocabulary_learning_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_learning_state
    ADD CONSTRAINT vocabulary_learning_state_pkey PRIMARY KEY (user_id);


--
-- Name: vocabulary_onboarding vocabulary_onboarding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_onboarding
    ADD CONSTRAINT vocabulary_onboarding_pkey PRIMARY KEY (user_id, level);


--
-- Name: vocabulary_translations vocabulary_translations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_translations
    ADD CONSTRAINT vocabulary_translations_pkey PRIMARY KEY (card_id, locale);


--
-- Name: answer_receipts answer_receipts_pkey; Type: CONSTRAINT; Schema: vocabulary_private; Owner: -
--

ALTER TABLE ONLY vocabulary_private.answer_receipts
    ADD CONSTRAINT answer_receipts_pkey PRIMARY KEY (user_id, request_id);


--
-- Name: rate_limits_expiration_idx; Type: INDEX; Schema: platform_private; Owner: -
--

CREATE INDEX rate_limits_expiration_idx ON platform_private.rate_limits USING btree (expires_at);


--
-- Name: mail_outbox_due_idx; Type: INDEX; Schema: private; Owner: -
--

CREATE INDEX mail_outbox_due_idx ON private.mail_outbox USING btree (available_at, created_at) WHERE (status = 'pending'::text);


--
-- Name: mail_outbox_lease_idx; Type: INDEX; Schema: private; Owner: -
--

CREATE INDEX mail_outbox_lease_idx ON private.mail_outbox USING btree (lease_until) WHERE (status = 'processing'::text);


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

CREATE UNIQUE INDEX bookings_person_month ON public.bookings USING btree (person_id, target_month) WHERE (kind <> 'trial'::text);


--
-- Name: bookings_status_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_status_month ON public.bookings USING btree (status, target_month, id);


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
-- Name: grammar_translations_locale_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX grammar_translations_locale_idx ON public.grammar_translations USING btree (locale);


--
-- Name: idx_submissions_user_level_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_user_level_created ON public.submissions USING btree (user_id, level, created_at DESC);


--
-- Name: idx_user_exercise_progress_user_completed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_exercise_progress_user_completed ON public.user_exercise_progress USING btree (user_id, completed);


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

CREATE UNIQUE INDEX learning_units_named_lesson_idx ON public.learning_units USING btree (level, trainer, label) WHERE (trainer = ANY (ARRAY['vocabulary'::text, 'exercises'::text]));


--
-- Name: learning_vocabulary_unit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX learning_vocabulary_unit_idx ON public.learning_vocabulary_cards USING btree (unit_id);


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

CREATE INDEX vocabulary_direction_due_idx ON public.vocabulary_direction_progress USING btree (user_id, next_review_date) WHERE (box_number < 7);


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
-- Name: audio_objects audio_objects_user_id_fkey; Type: FK CONSTRAINT; Schema: learning_reset_private; Owner: -
--

ALTER TABLE ONLY learning_reset_private.audio_objects
    ADD CONSTRAINT audio_objects_user_id_fkey FOREIGN KEY (user_id) REFERENCES learning_reset_private.jobs(user_id) ON DELETE CASCADE;


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
    ADD CONSTRAINT learning_trainer_grants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: learning_unit_grants learning_unit_grants_unit_id_level_trainer_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_unit_grants
    ADD CONSTRAINT learning_unit_grants_unit_id_level_trainer_fkey FOREIGN KEY (unit_id, level, trainer) REFERENCES public.learning_units(id, level, trainer) ON DELETE CASCADE;


--
-- Name: learning_unit_grants learning_unit_grants_user_id_level_trainer_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_unit_grants
    ADD CONSTRAINT learning_unit_grants_user_id_level_trainer_fkey FOREIGN KEY (user_id, level, trainer) REFERENCES public.learning_trainer_grants(user_id, level, trainer) ON DELETE CASCADE;


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
    ADD CONSTRAINT student_level_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


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
    ADD CONSTRAINT submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


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
    ADD CONSTRAINT user_exercise_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: vocabulary_direction_progress vocabulary_direction_progress_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_direction_progress
    ADD CONSTRAINT vocabulary_direction_progress_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.learning_vocabulary_cards(id) ON DELETE CASCADE;


--
-- Name: vocabulary_direction_progress vocabulary_direction_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_direction_progress
    ADD CONSTRAINT vocabulary_direction_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: vocabulary_learning_state vocabulary_learning_state_last_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_learning_state
    ADD CONSTRAINT vocabulary_learning_state_last_card_id_fkey FOREIGN KEY (last_card_id) REFERENCES public.learning_vocabulary_cards(id) ON DELETE SET NULL;


--
-- Name: vocabulary_learning_state vocabulary_learning_state_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_learning_state
    ADD CONSTRAINT vocabulary_learning_state_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


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
    ADD CONSTRAINT vocabulary_onboarding_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: vocabulary_translations vocabulary_translations_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vocabulary_translations
    ADD CONSTRAINT vocabulary_translations_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.learning_vocabulary_cards(id) ON DELETE CASCADE;


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
-- Name: courses catalog_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY catalog_read ON public.courses FOR SELECT TO anon, authenticated USING ((archived_at IS NULL));


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

CREATE POLICY exception_read ON public.course_exceptions FOR SELECT TO anon, authenticated USING (((course_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.courses c
  WHERE (c.id = course_exceptions.course_id)))));


--
-- Name: user_exercise_progress grammar_progress_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grammar_progress_read ON public.user_exercise_progress FOR SELECT TO authenticated USING (((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text])) OR ((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
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
-- Name: locales; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.locales ENABLE ROW LEVEL SECURITY;

--
-- Name: locales locales_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY locales_read ON public.locales FOR SELECT TO anon, authenticated USING (true);


--
-- Name: learning_trainer_grants own_access_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY own_access_read ON public.learning_trainer_grants FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: learning_unit_grants own_access_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY own_access_read ON public.learning_unit_grants FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: student_level_access own_access_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY own_access_read ON public.student_level_access FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


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

CREATE POLICY released_content_read ON public.learning_exercises FOR SELECT TO authenticated USING (learning_private.unit_allowed(unit_id));


--
-- Name: learning_reading_texts released_content_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY released_content_read ON public.learning_reading_texts FOR SELECT TO authenticated USING (learning_private.unit_allowed(unit_id));


--
-- Name: learning_videos released_content_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY released_content_read ON public.learning_videos FOR SELECT TO authenticated USING (learning_private.unit_allowed(unit_id));


--
-- Name: learning_vocabulary_cards released_content_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY released_content_read ON public.learning_vocabulary_cards FOR SELECT TO authenticated USING (learning_private.unit_allowed(unit_id));


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

CREATE POLICY released_units ON public.learning_units FOR SELECT TO authenticated USING (learning_private.unit_allowed(id));


--
-- Name: course_schedules schedule_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedule_read ON public.course_schedules FOR SELECT TO anon, authenticated USING ((EXISTS ( SELECT 1
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

CREATE POLICY translation_read ON public.course_translations FOR SELECT TO anon, authenticated USING ((EXISTS ( SELECT 1
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

CREATE POLICY vocabulary_onboarding_read ON public.vocabulary_onboarding FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: vocabulary_direction_progress vocabulary_progress_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vocabulary_progress_read ON public.vocabulary_direction_progress FOR SELECT TO authenticated USING (((( SELECT identity_private.current_profile_role() AS current_profile_role) = ANY (ARRAY['teacher'::text, 'admin'::text])) OR ((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.learning_vocabulary_cards c
  WHERE ((c.id = vocabulary_direction_progress.card_id) AND learning_private.unit_allowed(c.unit_id)))))));


--
-- Name: vocabulary_learning_state vocabulary_state_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vocabulary_state_read ON public.vocabulary_learning_state FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


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
-- Name: FUNCTION is_staff(); Type: ACL; Schema: business_private; Owner: -
--

REVOKE ALL ON FUNCTION business_private.is_staff() FROM PUBLIC;
GRANT ALL ON FUNCTION business_private.is_staff() TO authenticated;
GRANT ALL ON FUNCTION business_private.is_staff() TO service_role;


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
-- Name: FUNCTION save_course(p_data jsonb); Type: ACL; Schema: business_private; Owner: -
--

REVOKE ALL ON FUNCTION business_private.save_course(p_data jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION business_private.save_course(p_data jsonb) TO authenticated;
GRANT ALL ON FUNCTION business_private.save_course(p_data jsonb) TO service_role;


--
-- Name: FUNCTION save_month(p_month date, p_course_selections jsonb, p_paused boolean, p_expected uuid, p_revision integer); Type: ACL; Schema: business_private; Owner: -
--

REVOKE ALL ON FUNCTION business_private.save_month(p_month date, p_course_selections jsonb, p_paused boolean, p_expected uuid, p_revision integer) FROM PUBLIC;
GRANT ALL ON FUNCTION business_private.save_month(p_month date, p_course_selections jsonb, p_paused boolean, p_expected uuid, p_revision integer) TO authenticated;


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
-- Name: FUNCTION record_attempt(p_exercise_id uuid, p_answer text, p_hint_shown boolean); Type: ACL; Schema: grammar_private; Owner: -
--

REVOKE ALL ON FUNCTION grammar_private.record_attempt(p_exercise_id uuid, p_answer text, p_hint_shown boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION grammar_private.record_attempt(p_exercise_id uuid, p_answer text, p_hint_shown boolean) TO authenticated;


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
-- Name: TABLE mail_outbox; Type: ACL; Schema: private; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE private.mail_outbox TO service_role;


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
-- Name: FUNCTION save_learning_content(p_trainer text, p_payload jsonb, p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_learning_content(p_trainer text, p_payload jsonb, p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_learning_content(p_trainer text, p_payload jsonb, p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.save_learning_content(p_trainer text, p_payload jsonb, p_id uuid) TO service_role;


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
-- Name: FUNCTION submit_business_cancellation(p_name text, p_email text, p_course text, p_type text, p_date date, p_locale text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_business_cancellation(p_name text, p_email text, p_course text, p_type text, p_date date, p_locale text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_business_cancellation(p_name text, p_email text, p_course text, p_type text, p_date date, p_locale text) TO service_role;


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
-- Name: TABLE locales; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.locales TO anon;
GRANT SELECT ON TABLE public.locales TO authenticated;
GRANT ALL ON TABLE public.locales TO service_role;


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
