-- Exact catalog removal approved by the owner. Referencing bookings prevent
-- deletion; never cascade into business records or touch unrelated courses.
DELETE FROM public.courses WHERE id IN (
 '6eccd753-2182-4b6a-9700-c6340d9302e3', -- private, in person
 '6dda9c76-37eb-4803-ba83-ccdf74005295', -- retired speaking A2
 '614bba65-9154-4acc-90c3-4a81dfcb26b4'  -- retired A2 course
);
UPDATE public.courses c SET slug=m.slug FROM (VALUES
 ('901248ac-2816-4e93-be2e-5de7a9faa343'::uuid,'deutsch-level-1'),
 ('05cdec9b-9da7-43fb-b3b0-109515207789'::uuid,'deutsch-level-2'),
 ('a2602f45-acdb-42b2-b587-8aebabfdd218'::uuid,'deutsch-level-3'),
 ('cfc5f41f-0bf9-4295-aeaf-614afd0dba07'::uuid,'sprechtraining-montag'),
 ('ec33a7aa-86d8-4072-bde2-aed5b40be25e'::uuid,'sprechtraining-dienstag'),
 ('4f5da1ab-80c5-49d6-877e-e0c851698bd1'::uuid,'sprechtraining-mittwoch'),
 ('a8aca737-634b-4abb-8c81-e779ae81a5db'::uuid,'deutsch-a1-1-online'),
 ('33061240-08d7-45b9-aa6a-c06c7b63ac9b'::uuid,'deutsch-b1-online'),
 ('2d4bf352-4840-4213-8cfc-6a6ed6aa1e1d'::uuid,'privatunterricht-online')
) m(id,slug) WHERE c.id=m.id;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.course_schedules WHERE alternate_start_time IS NOT NULL OR alternate_end_time IS NOT NULL) THEN
  RAISE EXCEPTION 'Unexpected alternate course times; abort instead of discarding schedule data';
 END IF;
END $$;
ALTER TABLE public.courses RENAME COLUMN price TO unit_price;
ALTER TABLE public.courses RENAME COLUMN unit_duration TO unit_minutes;
ALTER TABLE public.courses DROP COLUMN translation_key,DROP COLUMN instructor;
ALTER TABLE public.courses RENAME CONSTRAINT courses_price_check TO courses_unit_price_check;
ALTER TABLE public.courses RENAME CONSTRAINT courses_unit_duration_check TO courses_unit_minutes_check;
ALTER TABLE public.course_schedules DROP COLUMN alternate_start_time,DROP COLUMN alternate_end_time;
ALTER TABLE public.course_translations DROP CONSTRAINT course_translations_locale_check;
ALTER TABLE public.course_translations ADD CONSTRAINT course_translations_locale_fkey FOREIGN KEY(locale) REFERENCES public.locales(code),
 ADD CONSTRAINT course_translations_non_source_locale CHECK(locale<>'de');
CREATE INDEX course_translations_locale_idx ON public.course_translations(locale);
UPDATE public.courses SET title='Privatunterricht – Online',
 description='Individueller Online-Unterricht in deinem Tempo. Wähle die gewünschte Anzahl an Einheiten à 45 Minuten. Eine Einheit kostet 25 €. Die Termine vereinbarst du anschließend persönlich mit deiner Lehrkraft.',
 trial_lessons=false,updated_at=now() WHERE slug='privatunterricht-online';
UPDATE public.course_translations t SET title=m.title,description=m.description FROM (VALUES
 ('en','Private lessons – Online','Individual online lessons at your pace. Choose the number of 45-minute units. Each unit costs €25. Arrange your lesson times personally with your teacher after booking.'),
 ('ru','Индивидуальные занятия – Онлайн','Индивидуальные онлайн-занятия в вашем темпе. Выберите количество занятий по 45 минут. Стоимость одного занятия — 25 €. После записи согласуйте расписание с преподавателем.'),
 ('uk','Індивідуальні заняття – Онлайн','Індивідуальні онлайн-заняття у вашому темпі. Оберіть кількість занять по 45 хвилин. Вартість одного заняття — 25 €. Після запису узгодьте розклад із викладачем.'),
 ('tr','Özel ders – Çevrim içi','Kendi hızınızda bire bir çevrim içi dersler. 45 dakikalık ders birimi sayısını seçin. Her birim 25 € tutarındadır. Kaydın ardından ders saatlerini öğretmeninizle birlikte belirleyin.')
) m(locale,title,description) WHERE t.locale=m.locale AND t.course_id='2d4bf352-4840-4213-8cfc-6a6ed6aa1e1d';
ALTER TABLE public.booking_items ADD COLUMN requested_units integer CHECK(requested_units BETWEEN 1 AND 1000);
-- No existing bookings may lose their unrecorded private-unit intention.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.booking_items i JOIN public.courses c ON c.id=i.course_id WHERE c.category='private') THEN
  RAISE EXCEPTION 'Existing private bookings require an explicit quantity reconciliation';
 END IF;
END $$;

-- Replace signatures instead of retaining old overloads or fallback adapters.
DROP FUNCTION public.submit_business_registration(jsonb,uuid[],date,jsonb,text,boolean);
DROP FUNCTION public.save_business_month(date,uuid[],boolean,uuid,integer);
DROP FUNCTION business_private.save_month(date,uuid[],boolean,uuid,integer);
DROP FUNCTION business_private.replace_items(uuid,uuid[]);
DROP FUNCTION business_private.course_quote(uuid,date,boolean);

CREATE FUNCTION business_private.validate_course_selections(p_selections jsonb,p_start date)
RETURNS TABLE(course_id uuid,requested_units integer) LANGUAGE plpgsql STABLE SET search_path='' AS $$
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
REVOKE ALL ON FUNCTION business_private.validate_course_selections(jsonb,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION business_private.validate_course_selections(jsonb,date) TO service_role;

CREATE FUNCTION business_private.course_quote(p_course uuid,p_start date,p_requested_units integer,p_trial boolean DEFAULT false)
RETURNS TABLE(units numeric,amount numeric) LANGUAGE sql STABLE SET search_path='' AS $$
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
REVOKE ALL ON FUNCTION business_private.course_quote(uuid,date,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION business_private.course_quote(uuid,date,integer,boolean) TO service_role;

CREATE FUNCTION business_private.replace_items(p_booking uuid,p_course_selections jsonb) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
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
REVOKE ALL ON FUNCTION business_private.replace_items(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION business_private.replace_items(uuid,jsonb) TO service_role;

create function public.submit_business_registration(p_contact jsonb,p_course_selections jsonb,p_start date,p_consents jsonb,p_locale text default 'de',p_trial boolean default false)
returns uuid language plpgsql security invoker set search_path='' as $$
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
revoke all on function public.submit_business_registration(jsonb,jsonb,date,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.submit_business_registration(jsonb,jsonb,date,jsonb,text,boolean) to service_role;

create function business_private.save_month(p_month date,p_course_selections jsonb,p_paused boolean,p_expected uuid,p_revision integer) returns uuid
language plpgsql security definer set search_path='' as $$
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
revoke all on function business_private.save_month(date,jsonb,boolean,uuid,integer) from public,anon;
grant execute on function business_private.save_month(date,jsonb,boolean,uuid,integer) to authenticated;
create function public.save_business_month(p_month date,p_course_selections jsonb,p_paused boolean,p_expected uuid default null,p_revision integer default null) returns uuid
language sql security invoker set search_path='' as $$select business_private.save_month(p_month,p_course_selections,p_paused,p_expected,p_revision);$$;
revoke all on function public.save_business_month(date,jsonb,boolean,uuid,integer) from public,anon;
grant execute on function public.save_business_month(date,jsonb,boolean,uuid,integer) to authenticated;

create or replace function business_private.save_course(p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
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
revoke all on function business_private.save_course(jsonb) from public,anon;
grant execute on function business_private.save_course(jsonb) to authenticated;
create or replace function public.save_business_course(p_data jsonb) returns uuid language sql security invoker set search_path='' as $$select business_private.save_course(p_data);$$;
revoke all on function public.save_business_course(jsonb) from public,anon;
grant execute on function public.save_business_course(jsonb) to authenticated;

create or replace function business_private.prepare_month(p_month date) returns integer language plpgsql security definer set search_path='' as $$
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
revoke all on function business_private.prepare_month(date) from public,anon;
grant execute on function business_private.prepare_month(date) to authenticated;
create or replace function public.prepare_business_month(p_month date) returns integer language sql security invoker set search_path='' as $$select business_private.prepare_month(p_month);$$;
revoke all on function public.prepare_business_month(date) from public,anon;
grant execute on function public.prepare_business_month(date) to authenticated;

create or replace function business_private.confirm_booking(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
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
revoke all on function business_private.confirm_booking(uuid) from public,anon;
grant execute on function business_private.confirm_booking(uuid) to authenticated;
create or replace function public.confirm_business_booking(p_id uuid) returns void language sql security invoker set search_path='' as $$select business_private.confirm_booking(p_id);$$;
revoke all on function public.confirm_business_booking(uuid) from public,anon;
grant execute on function public.confirm_business_booking(uuid) to authenticated;
