-- VPS-only replacement. Apply only after the approved business-data backup/reset.
-- mail.sql must be installed first. Auth accounts and staff preferences survive.
begin;
create schema if not exists business_private;
revoke all on schema business_private from public, anon, authenticated;
grant usage on schema business_private to authenticated, service_role;

-- Keep the public catalog, converting its old text identifiers exactly once.
create temporary table previous_courses on commit drop as select * from public.courses;
create temporary table previous_exceptions on commit drop as select * from public.course_exceptions;
do $$ begin
  if exists(select 1 from public.registrations) or exists(select 1 from public.monthly_course_bookings)
    or exists(select 1 from public.users) then
    raise exception 'Business reset/backup prerequisite not satisfied';
  end if;
end $$;

create table public.people (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references public.profiles(id) on delete set null,
  display_name text not null check(length(display_name) between 1 and 160),
  email text not null check(length(email) between 3 and 254),
  birth_date date,
  phone text, street text, postal_code text, city text,
  preferred_locale text not null default 'de' check(preferred_locale in ('de','en','ru','uk','tr')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index people_email_lookup on public.people(lower(email));
insert into public.people(auth_user_id,display_name,email,phone,street,postal_code,city,preferred_locale)
select p.id,coalesce(nullif(p.name,''),split_part(a.email,'@',1)),a.email,p.phone,p.street,p.zip_code,p.city,
case when p.ui_language in ('de','en','ru','uk','tr') then p.ui_language else 'de' end
from public.profiles p join auth.users a on a.id=p.id;

drop table if exists public.manual_invoice_status cascade;
drop table if exists public.enrollments cascade;
drop table if exists public.registrations cascade;
drop table if exists public.monthly_course_bookings cascade;
drop table if exists public.trial_lessons cascade;
drop table if exists public.cancellations cascade;
drop table if exists public.course_exceptions cascade;
drop table if exists public.users cascade;
drop table if exists public.courses cascade;
alter table public.profiles drop column if exists legacy_user_id cascade,
 drop column if exists name cascade, drop column if exists email cascade,
 drop column if exists phone cascade, drop column if exists street cascade,
 drop column if exists zip_code cascade, drop column if exists city cascade;

create or replace function business_private.is_staff() returns boolean
language sql stable security definer set search_path='' as $$
select exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('teacher','admin'));
$$;
revoke all on function business_private.is_staff() from public,anon;
grant execute on function business_private.is_staff() to authenticated,service_role;
alter table public.people enable row level security;
grant select on public.people to authenticated;
grant update(display_name,phone,street,postal_code,city,preferred_locale) on public.people to authenticated;
grant all on public.people to service_role;
create policy people_read on public.people for select to authenticated using(auth_user_id=(select auth.uid()) or (select business_private.is_staff()));
create policy people_update on public.people for update to authenticated using(auth_user_id=(select auth.uid()) or (select business_private.is_staff())) with check(auth_user_id=(select auth.uid()) or (select business_private.is_staff()));
create view public.profile_details with (security_invoker=true) as
select p.*, person.id as legacy_user_id,person.display_name as name,person.email,person.phone,person.street,person.postal_code as zip_code,person.city
from public.profiles p left join public.people person on person.auth_user_id=p.id;
grant select on public.profile_details to authenticated,service_role;

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check(slug ~ '^[a-z0-9][a-z0-9_-]{1,99}$'),
  translation_key text not null default '',
  title text not null check(length(title) between 1 and 180),
  description text not null default '',
  type text not null check(type in ('presence','online')),
  category text not null check(category in ('german','speaking','online','private')),
  level text not null default '',
  price numeric(10,2) not null check(price>=0),
  unit_duration integer not null default 45 check(unit_duration between 15 and 180),
  instructor text not null default 'standard' check(instructor in ('standard','special')),
  start_date date,end_date date,trial_lessons boolean not null default true,
  sort_order integer not null default 100,
  archived_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  check(end_date is null or start_date is null or end_date>=start_date)
);
create index courses_active_order on public.courses(sort_order,id) where archived_at is null;
create table public.course_translations (
 course_id uuid not null references public.courses(id) on delete cascade,
 locale text not null check(locale in ('de','en','ru','uk','tr')),
 title text not null check(length(title) between 1 and 180),description text not null default '',
 primary key(course_id,locale)
);
create table public.course_schedules (
 id uuid primary key default gen_random_uuid(),course_id uuid not null references public.courses(id) on delete cascade,
 weekday smallint not null check(weekday between 1 and 7),start_time time not null,end_time time not null,
 alternate_start_time time,alternate_end_time time,
 check(end_time>start_time),check((alternate_start_time is null)=(alternate_end_time is null)),
 check(alternate_end_time is null or alternate_end_time>alternate_start_time),
 unique(course_id,weekday,start_time)
);
create table public.course_exceptions (
 id uuid primary key default gen_random_uuid(),date date not null,reason text not null check(length(reason) between 1 and 250),
 course_id uuid references public.courses(id) on delete cascade
);
create unique index course_exceptions_one on public.course_exceptions(date,coalesce(course_id,'00000000-0000-0000-0000-000000000000'::uuid));
create index course_exceptions_course on public.course_exceptions(course_id,date);

insert into public.courses(id,slug,translation_key,title,type,category,level,price,unit_duration,instructor,start_date,end_date,trial_lessons,sort_order,archived_at)
select booking_id,id,translation_key,coalesce(title,translation_key),type,
case when translation_key like 'private%' then 'private' when translation_key like 'speech%' then 'speaking' when type='online' then 'online' else 'german' end,
'',price,unit_duration,instructor,start_date,end_date,coalesce(trial_lessons,true),100,
case when end_date<current_date then now() else null end
from previous_courses;
insert into public.course_schedules(course_id,weekday,start_time,end_time,alternate_start_time,alternate_end_time)
select c.booking_id,case s->>'day' when 'Mo' then 1 when 'Di' then 2 when 'Mi' then 3 when 'Do' then 4 when 'Fr' then 5 when 'Sa' then 6 when 'So' then 7 end,
(s->>'startTime')::time,(s->>'endTime')::time,nullif(s->>'altStartTime','')::time,nullif(s->>'altEndTime','')::time
from previous_courses c cross join lateral jsonb_array_elements(case when jsonb_typeof(c.sessions::jsonb)='string' then (c.sessions#>>'{}')::jsonb else c.sessions::jsonb end) s;
insert into public.course_exceptions(date,reason,course_id)
select e.date,e.reason,c.booking_id from previous_exceptions e
cross join lateral unnest(coalesce(nullif(e.course_ids,'{}'::text[]),array[null::text])) old(id)
left join previous_courses c on c.id=old.id on conflict do nothing;

create table public.bookings (
 id uuid primary key default gen_random_uuid(),person_id uuid not null references public.people(id),
 target_month date not null check(extract(day from target_month)=1),
 start_date date not null,kind text not null default 'registration' check(kind in ('registration','monthly','trial')),
 status text not null default 'pending' check(status in ('pending','confirmed','cancelled','rejected')),
 contact_name text not null,contact_email text not null,contact_phone text,contact_street text,contact_postal_code text,contact_city text,contact_birth_date date,
 privacy_accepted boolean not null,agb_accepted boolean not null,revocation_accepted boolean not null default false,recording_accepted boolean,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),confirmed_at timestamptz,
 confirmed_by uuid references public.profiles(id),revision integer not null default 1
);
create unique index bookings_person_month on public.bookings(person_id,target_month) where kind<>'trial';
create index bookings_status_month on public.bookings(status,target_month,id);
create index bookings_confirmed_by on public.bookings(confirmed_by);
create table public.booking_items (
 id uuid primary key default gen_random_uuid(),booking_id uuid not null references public.bookings(id) on delete cascade,
 course_id uuid not null references public.courses(id),title_snapshot text not null,
 unit_price numeric(10,2) not null check(unit_price>=0),unit_minutes integer not null check(unit_minutes>0),
 units numeric(10,3) not null check(units>=0),amount numeric(10,2) not null check(amount>=0),
 unique(booking_id,course_id)
);
create index booking_items_course on public.booking_items(course_id);
create table public.invoice_cases (
 id uuid primary key default gen_random_uuid(),person_id uuid not null references public.people(id),
 target_month date not null check(extract(day from target_month)=1),
 booking_id uuid not null references public.bookings(id),
 status text not null default 'outstanding' check(status in ('outstanding','created')),
 invoice_reference text,invoice_created_at timestamptz,created_by uuid references public.profiles(id),
 updated_at timestamptz not null default now(),unique(person_id,target_month),unique(booking_id),
 check((status='created')=(invoice_created_at is not null))
);
create index invoice_cases_queue on public.invoice_cases(target_month,status);
create index invoice_cases_created_by on public.invoice_cases(created_by);
create table public.cancellation_requests (
 id uuid primary key default gen_random_uuid(),full_name text not null,email text not null,course_name text,
 termination_type text not null check(termination_type in ('asap','specific_date')),
 termination_date date,created_at timestamptz not null default now(),processed_at timestamptz
);

do $$ declare t text; begin
 foreach t in array array['courses','course_translations','course_schedules','course_exceptions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('grant select on public.%I to anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
 foreach t in array array['bookings','booking_items','invoice_cases','cancellation_requests'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
create policy catalog_read on public.courses for select to anon,authenticated using(archived_at is null);
create policy catalog_staff on public.courses for select to authenticated using((select business_private.is_staff()));
-- Public catalog children have no PII. Their visibility follows their parent course.
create policy translation_read on public.course_translations for select to anon,authenticated using(exists(select 1 from public.courses c where c.id=course_id));
create policy schedule_read on public.course_schedules for select to anon,authenticated using(exists(select 1 from public.courses c where c.id=course_id));
create policy exception_read on public.course_exceptions for select to anon,authenticated using(course_id is null or exists(select 1 from public.courses c where c.id=course_id));
create policy booking_read on public.bookings for select to authenticated using((select business_private.is_staff()) or exists(select 1 from public.people p where p.id=person_id and p.auth_user_id=(select auth.uid())));
create policy item_read on public.booking_items for select to authenticated using(exists(select 1 from public.bookings b where b.id=booking_id));
create policy invoice_read on public.invoice_cases for select to authenticated using((select business_private.is_staff()));
create policy cancellation_read on public.cancellation_requests for select to authenticated using((select business_private.is_staff()));

-- Provision an account without claiming an unverified person's bookings.
create or replace function business_private.provision_profile() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_locale text;v_name text;v_native text;
begin
 v_native:=case when new.raw_user_meta_data->>'native_language' in ('Deutsch','Russisch','Türkisch','Englisch','Ukrainisch','Andere') then new.raw_user_meta_data->>'native_language' else 'Andere' end;
 v_locale:=case v_native when 'Russisch' then 'ru' when 'Türkisch' then 'tr' when 'Englisch' then 'en' when 'Ukrainisch' then 'uk' else 'de' end;
 v_name:=left(coalesce(nullif(btrim(new.raw_user_meta_data->>'name'),''),split_part(new.email,'@',1),'Student'),160);
 insert into public.profiles(id,role,native_language,ui_language) values(new.id,'student',v_native,v_locale) on conflict(id) do nothing;
 -- Unverified signups receive an empty identity; no submitted-address matching here.
 insert into public.people(auth_user_id,display_name,email,preferred_locale) values(new.id,v_name,coalesce(new.email,''),v_locale) on conflict(auth_user_id) do nothing;
 return new;
end $$;
revoke all on function business_private.provision_profile() from public,anon,authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function business_private.provision_profile();
create function business_private.sync_verified_email() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.email is distinct from old.email and new.email_confirmed_at is not null then
  update public.people set email=new.email,updated_at=now() where auth_user_id=new.id;
 end if;
 return new;
end $$;
revoke all on function business_private.sync_verified_email() from public,anon,authenticated;
drop trigger if exists sync_confirmed_profile_email on auth.users;
create trigger sync_confirmed_profile_email after update of email on auth.users for each row execute function business_private.sync_verified_email();

create or replace function business_private.claim_person() returns jsonb
language plpgsql security definer set search_path='' as $$
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
revoke all on function business_private.claim_person() from public,anon;
grant execute on function business_private.claim_person() to authenticated;
create or replace function public.claim_verified_legacy_profile() returns jsonb language sql security invoker set search_path='' as $$select business_private.claim_person();$$;
revoke all on function public.claim_verified_legacy_profile() from public,anon;
grant execute on function public.claim_verified_legacy_profile() to authenticated;

-- Calculate prices exclusively from the current catalog/calendar, never a browser total.
create function business_private.course_quote(p_course uuid,p_start date,p_trial boolean default false)
returns table(units numeric,amount numeric) language sql stable set search_path='' as $$
select case when p_trial then 0 else coalesce(sum(extract(epoch from (s.end_time-s.start_time))/60/c.unit_duration),0) end,
case when p_trial then 0 else round(coalesce(sum(extract(epoch from (s.end_time-s.start_time))/60/c.unit_duration*c.price),0),2) end
from public.courses c join public.course_schedules s on s.course_id=c.id
cross join lateral generate_series(p_start::timestamp,(date_trunc('month',p_start)+interval '1 month - 1 day')::timestamp,interval '1 day') day
where c.id=p_course and extract(isodow from day)=s.weekday
 and (c.start_date is null or day::date>=c.start_date) and (c.end_date is null or day::date<=c.end_date)
 and not exists(select 1 from public.course_exceptions e where e.date=day::date and (e.course_id is null or e.course_id=c.id));
$$;
revoke all on function business_private.course_quote(uuid,date,boolean) from public,anon,authenticated;

create function business_private.replace_items(p_booking uuid,p_courses uuid[]) returns void
language plpgsql set search_path='' as $$
declare b public.bookings;
begin
 select * into strict b from public.bookings where id=p_booking;
 if p_courses is null or cardinality(p_courses) not between 1 and 100 or cardinality(p_courses)<>(select count(distinct id) from unnest(p_courses) id)
 or (select count(*) from public.courses where id=any(p_courses) and archived_at is null and (end_date is null or end_date>=b.start_date))<>cardinality(p_courses) then
  raise check_violation using message='Invalid course selection';
 end if;
 delete from public.booking_items where booking_id=b.id;
 insert into public.booking_items(booking_id,course_id,title_snapshot,unit_price,unit_minutes,units,amount)
 select b.id,c.id,c.title,c.price,c.unit_duration,q.units,q.amount from public.courses c
 cross join lateral business_private.course_quote(c.id,b.start_date,b.kind='trial') q where c.id=any(p_courses);
end $$;
revoke all on function business_private.replace_items(uuid,uuid[]) from public,anon,authenticated;

create function public.submit_business_registration(p_contact jsonb,p_course_ids uuid[],p_start date,p_consents jsonb,p_locale text default 'de',p_trial boolean default false)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_person uuid;v_booking uuid;v_email text;v_name text;v_matches integer;
begin
 if p_start<current_date or cardinality(p_course_ids) not between 1 and 100 or coalesce((p_consents->>'privacy')::boolean,false)=false or coalesce((p_consents->>'agb')::boolean,false)=false then raise check_violation;end if;
 v_email:=lower(btrim(p_contact->>'email'));v_name:=btrim(p_contact->>'name');
 if v_email is null or length(v_name) not between 1 and 160 then raise check_violation;end if;
 if p_trial then
  perform pg_advisory_xact_lock(hashtextextended(v_email||':'||lower(v_name),0));
  if exists(select 1 from public.bookings where kind='trial' and lower(contact_email)=v_email and lower(contact_name)=lower(v_name)) then raise unique_violation;end if;
  if cardinality(p_course_ids)<>1 or not exists(select 1 from public.courses c join public.course_schedules s on s.course_id=c.id
   where c.id=p_course_ids[1] and c.trial_lessons and c.archived_at is null and s.weekday=extract(isodow from p_start)
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
 perform business_private.replace_items(v_booking,p_course_ids);
 perform public.queue_transactional_email('registration:'||v_booking,'registration_received',v_email,p_locale,jsonb_build_object('name',v_name,'startDate',p_start));
 perform public.queue_transactional_email('staff-registration:'||v_booking,'new_enrollment','info@sitov-academy.com','de',jsonb_build_object('name',v_name,'path','/de/admin/registrations'));
 return v_booking;
end $$;
revoke all on function public.submit_business_registration(jsonb,uuid[],date,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.submit_business_registration(jsonb,uuid[],date,jsonb,text,boolean) to service_role;

create function business_private.confirm_booking(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
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
 jsonb_build_object('name',b.contact_name,'startDate',b.start_date,'courses',(select jsonb_agg(jsonb_build_object('title',title_snapshot,'price',amount)) from public.booking_items where booking_id=b.id)));
end $$;
revoke all on function business_private.confirm_booking(uuid) from public,anon;
grant execute on function business_private.confirm_booking(uuid) to authenticated;
create function public.confirm_business_booking(p_id uuid) returns void language sql security invoker set search_path='' as $$select business_private.confirm_booking(p_id);$$;
revoke all on function public.confirm_business_booking(uuid) from public,anon;
grant execute on function public.confirm_business_booking(uuid) to authenticated;

CREATE FUNCTION business_private.decline_booking(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
REVOKE ALL ON FUNCTION business_private.decline_booking(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION business_private.decline_booking(uuid) TO authenticated;
CREATE FUNCTION public.decline_business_booking(p_id uuid) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT business_private.decline_booking(p_id); $$;
REVOKE ALL ON FUNCTION public.decline_business_booking(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.decline_business_booking(uuid) TO authenticated;

create function business_private.mark_invoice(p_booking uuid,p_month date,p_created boolean,p_reference text) returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings;
begin
 if not business_private.is_staff() then raise insufficient_privilege;end if;
 select * into strict b from public.bookings where id=p_booking for update;
 if b.target_month<>p_month or b.kind='trial' or (p_created and b.status<>'confirmed') or length(coalesce(p_reference,''))>120 then raise check_violation;end if;
 insert into public.invoice_cases(person_id,target_month,booking_id) values(b.person_id,b.target_month,b.id) on conflict(person_id,target_month) do nothing;
 update public.invoice_cases set status=case when p_created then 'created' else 'outstanding' end,invoice_reference=nullif(btrim(p_reference),''),
 invoice_created_at=case when p_created then coalesce(invoice_created_at,now()) else null end,created_by=auth.uid(),updated_at=now() where person_id=b.person_id and target_month=p_month;
end $$;
revoke all on function business_private.mark_invoice(uuid,date,boolean,text) from public,anon;
grant execute on function business_private.mark_invoice(uuid,date,boolean,text) to authenticated;
create function public.mark_business_invoice(p_booking uuid,p_month date,p_created boolean,p_reference text default '') returns void language sql security invoker set search_path='' as $$select business_private.mark_invoice(p_booking,p_month,p_created,p_reference);$$;
revoke all on function public.mark_business_invoice(uuid,date,boolean,text) from public,anon;
grant execute on function public.mark_business_invoice(uuid,date,boolean,text) to authenticated;

create function business_private.save_month(p_month date,p_courses uuid[],p_paused boolean,p_expected uuid,p_revision integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.people;b public.bookings;v_next date;
begin
 perform business_private.claim_person();
 select * into strict p from public.people where auth_user_id=auth.uid() for update;
 v_next:=(date_trunc('month',now() at time zone 'Europe/Berlin')+interval '1 month')::date;
 if p_month is null or p_month<>v_next then raise sqlstate '22008';end if;
 if p_courses is null or p_paused is null then raise check_violation using message='Courses and pause choice are required';end if;
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
 else perform business_private.replace_items(b.id,p_courses);end if;
 return b.id;
end $$;
revoke all on function business_private.save_month(date,uuid[],boolean,uuid,integer) from public,anon;
grant execute on function business_private.save_month(date,uuid[],boolean,uuid,integer) to authenticated;
create function public.save_business_month(p_month date,p_courses uuid[],p_paused boolean,p_expected uuid default null,p_revision integer default null) returns uuid
language sql security invoker set search_path='' as $$select business_private.save_month(p_month,p_courses,p_paused,p_expected,p_revision);$$;
revoke all on function public.save_business_month(date,uuid[],boolean,uuid,integer) from public,anon;
grant execute on function public.save_business_month(date,uuid[],boolean,uuid,integer) to authenticated;

create function business_private.save_course(p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_schedule jsonb;v_translation jsonb;v_exception jsonb;
begin
 if not business_private.is_staff() then raise insufficient_privilege;end if;
 v_id:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());
 if nullif(p_data->>'id','') is not null and not exists(select 1 from public.courses where id=v_id) then raise no_data_found;end if;
 insert into public.courses(id,slug,title,description,type,category,level,price,unit_duration,instructor,start_date,end_date,trial_lessons,sort_order,archived_at)
 values(v_id,p_data->>'slug',p_data->>'title',coalesce(p_data->>'description',''),p_data->>'type',p_data->>'category',coalesce(p_data->>'level',''),(p_data->>'price')::numeric,
 (p_data->>'unit_duration')::integer,p_data->>'instructor',nullif(p_data->>'start_date','')::date,nullif(p_data->>'end_date','')::date,(p_data->>'trial_lessons')::boolean,(p_data->>'sort_order')::integer,
 case when (p_data->>'archived')::boolean then now() else null end)
 on conflict(id) do update set slug=excluded.slug,title=excluded.title,description=excluded.description,type=excluded.type,category=excluded.category,level=excluded.level,
 price=excluded.price,unit_duration=excluded.unit_duration,instructor=excluded.instructor,start_date=excluded.start_date,end_date=excluded.end_date,trial_lessons=excluded.trial_lessons,
 sort_order=excluded.sort_order,archived_at=excluded.archived_at,updated_at=now();
 delete from public.course_schedules where course_id=v_id;
 for v_schedule in select value from jsonb_array_elements(p_data->'schedules') loop
  insert into public.course_schedules(course_id,weekday,start_time,end_time,alternate_start_time,alternate_end_time)
  values(v_id,(v_schedule->>'weekday')::smallint,(v_schedule->>'start_time')::time,(v_schedule->>'end_time')::time,
  nullif(v_schedule->>'alternate_start_time','')::time,nullif(v_schedule->>'alternate_end_time','')::time);
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
create function public.save_business_course(p_data jsonb) returns uuid language sql security invoker set search_path='' as $$select business_private.save_course(p_data);$$;
revoke all on function public.save_business_course(jsonb) from public,anon;
grant execute on function public.save_business_course(jsonb) to authenticated;

create function public.submit_business_cancellation(p_name text,p_email text,p_course text,p_type text,p_date date default null,p_locale text default 'de') returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_id uuid;
begin
 if length(p_name) not between 2 and 160 or length(p_email) not between 3 and 254 or (p_type='specific_date' and p_date is null) then raise check_violation;end if;
 insert into public.cancellation_requests(full_name,email,course_name,termination_type,termination_date) values(p_name,lower(p_email),p_course,p_type,p_date) returning id into v_id;
 perform public.queue_transactional_email('cancellation:'||v_id,'cancellation_requested',lower(p_email),p_locale,jsonb_build_object('name',p_name,'endDate',p_date,'message',p_course));
 return v_id;
end $$;
revoke all on function public.submit_business_cancellation(text,text,text,text,date,text) from public,anon,authenticated;
grant execute on function public.submit_business_cancellation(text,text,text,text,date,text) to service_role;

-- Build one monthly case for each continuing confirmed enrollment. Explicit
-- changes/pause take precedence. Lock the person just like the student editor.
create function business_private.prepare_month(p_month date) returns integer language plpgsql security definer set search_path='' as $$
declare p public.people;previous public.bookings;v_id uuid;ids uuid[];v_count integer:=0;
begin
 if not business_private.is_staff() then raise insufficient_privilege;end if;
 if extract(day from p_month)<>1 or p_month>(date_trunc('month',now() at time zone 'Europe/Berlin')+interval '1 month')::date then raise check_violation;end if;
 for p in select * from public.people order by id for update loop
  if exists(select 1 from public.bookings where person_id=p.id and target_month=p_month and kind<>'trial') then continue;end if;
  select * into previous from public.bookings where person_id=p.id and target_month<p_month and kind<>'trial' order by target_month desc limit 1;
  if previous.id is null or previous.status<>'confirmed' then continue;end if;
  select array_agg(i.course_id) into ids from public.booking_items i join public.courses c on c.id=i.course_id where i.booking_id=previous.id and c.archived_at is null
   and (c.start_date is null or c.start_date<(p_month+interval '1 month')::date) and (c.end_date is null or c.end_date>=p_month);
  if ids is null then continue;end if;
  insert into public.bookings(person_id,target_month,start_date,kind,status,contact_name,contact_email,contact_birth_date,contact_phone,contact_street,contact_postal_code,contact_city,privacy_accepted,agb_accepted,revocation_accepted,recording_accepted,confirmed_at,confirmed_by)
  values(p.id,p_month,p_month,'monthly','confirmed',p.display_name,p.email,p.birth_date,p.phone,p.street,p.postal_code,p.city,previous.privacy_accepted,previous.agb_accepted,previous.revocation_accepted,previous.recording_accepted,now(),auth.uid()) returning id into v_id;
  perform business_private.replace_items(v_id,ids);
  insert into public.invoice_cases(person_id,target_month,booking_id) values(p.id,p_month,v_id) on conflict(person_id,target_month) do nothing;
  v_count:=v_count+1;
 end loop;
 return v_count;
end $$;
revoke all on function business_private.prepare_month(date) from public,anon;
grant execute on function business_private.prepare_month(date) to authenticated;
create function public.prepare_business_month(p_month date) returns integer language sql security invoker set search_path='' as $$select business_private.prepare_month(p_month);$$;
revoke all on function public.prepare_business_month(date) from public,anon;
grant execute on function public.prepare_business_month(date) to authenticated;

-- Preserve the ten current offerings; the two retired courses remain archived.
update public.courses set sort_order=case slug
 when 'c_de50_a1_1_2026h2' then 10 when 'c_a1_1_50plus' then 20 when 'c_a1_2_50plus' then 30
 when 'c_speech_a1_1_2026h2' then 40 when 'c_speech_a1_1' then 50 when 'c_speech_a1_2' then 60
 when 'c_online_a1_1_2026_09' then 70 when 'c_online_b1' then 80
 when 'c_private_presence' then 90 when 'c_private_online' then 100 else 110 end,
 archived_at=case when slug in ('c_a2_50plus','c_speech_a2') then now() else archived_at end;
grant execute on all functions in schema business_private to service_role;
-- Existing course copy is seeded once; the CMS owns all subsequent edits.
update public.courses set title='Privatunterricht',description='Buchen Sie flexiblen Privatunterricht – online oder vor Ort in Hannover. Das Lernprogramm wird individuell auf Ihr Tempo und Ihre Ziele abgestimmt (25 € / 45 Min.). Im Anschluss an Ihre Buchung wird sich Ihre Lehrkraft umgehend mit Ihnen in Verbindung setzen, um die Unterrichtstermine gemeinsam zu koordinieren.',level='A1-C2' where id='6eccd753-2182-4b6a-9700-c6340d9302e3';
insert into public.course_translations(course_id,locale,title,description) values('6eccd753-2182-4b6a-9700-c6340d9302e3','en','Private Lessons','Book flexible private lessons—available online or in-person in Hannover. The curriculum is tailored individually to your pace and goals (25 € / 45 Min.). Following your booking, your instructor will promptly contact you to coordinate your lesson schedule.');
insert into public.course_translations(course_id,locale,title,description) values('6eccd753-2182-4b6a-9700-c6340d9302e3','ru','Индивидуальные занятия','Забронируйте гибкие индивидуальные занятия — онлайн или очно в Ганновере. Программа обучения адаптируется под ваш темп и цели (25 € / 45 мин.). После оформления бронирования преподаватель свяжется с вами в кратчайшие сроки для согласования расписания занятий.');
insert into public.course_translations(course_id,locale,title,description) values('6eccd753-2182-4b6a-9700-c6340d9302e3','uk','Індивідуальні заняття','Забронюйте гнучкі індивідуальні заняття — онлайн або очно в Ганновері. Програма навчання адаптується під ваш темп та цілі (25 € / 45 хв.). Після оформлення бронювання викладач оперативно зв''яжеться з вами для узгодження розкладу занять.');
insert into public.course_translations(course_id,locale,title,description) values('6eccd753-2182-4b6a-9700-c6340d9302e3','tr','Özel Dersler','Esnek özel derslerinizi ayırtın — çevrimiçi veya Hannover''de yüz yüze. Eğitim programı, hızınıza ve hedeflerinize uygun olarak bireysel şekilde tasarlanır (25 € / 45 Dk.). Rezervasyonunuzun ardından eğitmeniniz ders programını birlikte planlamak üzere sizinle iletişime geçecektir.');
update public.courses set title='Privatunterricht',description='Buchen Sie flexiblen Privatunterricht – online oder vor Ort in Hannover. Das Lernprogramm wird individuell auf Ihr Tempo und Ihre Ziele abgestimmt (25 € / 45 Min.). Im Anschluss an Ihre Buchung wird sich Ihre Lehrkraft umgehend mit Ihnen in Verbindung setzen, um die Unterrichtstermine gemeinsam zu koordinieren.',level='A1-C2' where id='2d4bf352-4840-4213-8cfc-6a6ed6aa1e1d';
insert into public.course_translations(course_id,locale,title,description) values('2d4bf352-4840-4213-8cfc-6a6ed6aa1e1d','en','Private Lessons','Book flexible private lessons—available online or in-person in Hannover. The curriculum is tailored individually to your pace and goals (25 € / 45 Min.). Following your booking, your instructor will promptly contact you to coordinate your lesson schedule.');
insert into public.course_translations(course_id,locale,title,description) values('2d4bf352-4840-4213-8cfc-6a6ed6aa1e1d','ru','Индивидуальные занятия','Забронируйте гибкие индивидуальные занятия — онлайн или очно в Ганновере. Программа обучения адаптируется под ваш темп и цели (25 € / 45 мин.). После оформления бронирования преподаватель свяжется с вами в кратчайшие сроки для согласования расписания занятий.');
insert into public.course_translations(course_id,locale,title,description) values('2d4bf352-4840-4213-8cfc-6a6ed6aa1e1d','uk','Індивідуальні заняття','Забронюйте гнучкі індивідуальні заняття — онлайн або очно в Ганновері. Програма навчання адаптується під ваш темп та цілі (25 € / 45 хв.). Після оформлення бронювання викладач оперативно зв''яжеться з вами для узгодження розкладу занять.');
insert into public.course_translations(course_id,locale,title,description) values('2d4bf352-4840-4213-8cfc-6a6ed6aa1e1d','tr','Özel Dersler','Esnek özel derslerinizi ayırtın — çevrimiçi veya Hannover''de yüz yüze. Eğitim programı, hızınıza ve hedeflerinize uygun olarak bireysel şekilde tasarlanır (25 € / 45 Dk.). Rezervasyonunuzun ardından eğitmeniniz ders programını birlikte planlamak üzere sizinle iletişime geçecektir.');
update public.courses set title='Deutsch Level 1',description='Speziell für Lernende im besten Alter. Langsames Tempo, viel Wiederholung. Wir fangen komplett von vorne an!',level='A0-A1' where id='901248ac-2816-4e93-be2e-5de7a9faa343';
insert into public.course_translations(course_id,locale,title,description) values('901248ac-2816-4e93-be2e-5de7a9faa343','en','German Level 1','Especially for learners in their prime. Slow pace, lots of repetition. We start completely from scratch!');
insert into public.course_translations(course_id,locale,title,description) values('901248ac-2816-4e93-be2e-5de7a9faa343','ru','Немецкий Уровень 1','Специально для учащихся старшего возраста. Медленный темп, много повторений. Начинаем с самого нуля!');
insert into public.course_translations(course_id,locale,title,description) values('901248ac-2816-4e93-be2e-5de7a9faa343','uk','Німецька Рівень 1','Спеціально для учнів старшого віку. Повільний темп, багато повторень. Починаємо з самого нуля!');
insert into public.course_translations(course_id,locale,title,description) values('901248ac-2816-4e93-be2e-5de7a9faa343','tr','Almanca Seviye 1','Özellikle ileri yaşta öğrenenler için. Yavaş tempo, bol tekrar. Tamamen baştan başlıyoruz!');
update public.courses set title='Deutsch A2.2',description='Für selbstständige Kommunikation im Alltag.',level='A2.2' where id='614bba65-9154-4acc-90c3-4a81dfcb26b4';
insert into public.course_translations(course_id,locale,title,description) values('614bba65-9154-4acc-90c3-4a81dfcb26b4','en','German A2.2','Independent communication (doctors, authorities).');
insert into public.course_translations(course_id,locale,title,description) values('614bba65-9154-4acc-90c3-4a81dfcb26b4','ru','Немецкий A2.2','Самостоятельное общение (врач, ведомства).');
insert into public.course_translations(course_id,locale,title,description) values('614bba65-9154-4acc-90c3-4a81dfcb26b4','uk','Німецька A2.2','Самостійне спілкування (лікар, органи влади).');
insert into public.course_translations(course_id,locale,title,description) values('614bba65-9154-4acc-90c3-4a81dfcb26b4','tr','Almanca A2.2','Bağımsız iletişim (doktor, resmi daireler).');
update public.courses set title='Deutsch Level 2',description='Speziell für Lernende im besten Alter. Langsames Tempo, viel Wiederholung.',level='A1-A2' where id='05cdec9b-9da7-43fb-b3b0-109515207789';
insert into public.course_translations(course_id,locale,title,description) values('05cdec9b-9da7-43fb-b3b0-109515207789','en','German Level 2','Specially designed for mature learners. Slow pace, relaxed atmosphere.');
insert into public.course_translations(course_id,locale,title,description) values('05cdec9b-9da7-43fb-b3b0-109515207789','ru','Немецкий Уровень 2','Специально для учащихся старшего возраста. Медленный темп, непринужденная атмосфера.');
insert into public.course_translations(course_id,locale,title,description) values('05cdec9b-9da7-43fb-b3b0-109515207789','uk','Німецька Рівень 2','Спеціально для учнів старшого віку. Повільний темп, невимушена атмосфера.');
insert into public.course_translations(course_id,locale,title,description) values('05cdec9b-9da7-43fb-b3b0-109515207789','tr','Almanca Seviye 2','yetişkin öğrenciler için özel. Yavaş tempo, rahat atmosfer.');
update public.courses set title='Deutsch B1 (Online)',description='Vertiefung der Kenntnisse für Beruf und Alltag. In kleinen Gruppen (max. 10 Personen), inklusive Unterrichtsaufzeichnung für die eigene Wiederholung im Anschluss und intensivem 24/7 Telegram-Support durch die Lehrerin bei Fragen zur Grammatik und Sprache.',level='B1' where id='33061240-08d7-45b9-aa6a-c06c7b63ac9b';
insert into public.course_translations(course_id,locale,title,description) values('33061240-08d7-45b9-aa6a-c06c7b63ac9b','en','German B1 (Online)','Intermediate level for advanced learners. In small groups (max. 10 people), including lesson recordings for your own review afterwards and intensive 24/7 Telegram support from the teacher for questions about grammar and language.');
insert into public.course_translations(course_id,locale,title,description) values('33061240-08d7-45b9-aa6a-c06c7b63ac9b','ru','Немецкий B1 (Онлайн)','Средний уровень для продвинутых. В небольших группах (макс. 10 человек), включая записи уроков для самостоятельного повторения и интенсивную круглосуточную (24/7) поддержку в Telegram от преподавателя по вопросам грамматики и языка.');
insert into public.course_translations(course_id,locale,title,description) values('33061240-08d7-45b9-aa6a-c06c7b63ac9b','uk','Німецька B1 (Онлайн)','Середній рівень для просунутих. У невеликих групах (макс. 10 осіб), включаючи записи уроків для самостійного повторення та інтенсивну цілодобову (24/7) підтримку в Telegram від викладача з питань граматики та мови.');
insert into public.course_translations(course_id,locale,title,description) values('33061240-08d7-45b9-aa6a-c06c7b63ac9b','tr','Almanca B1 (Çevrimiçi)','Mesleki ve günlük yaşamda bilgilerin pekiştirilmesi. Küçük gruplar halinde (en fazla 10 kişi), derslerin kaydını içeren (dersi daha sonra tekrarlamak için) ve gramer ve dil ile ilgili sorularınız için öğretmenin 7/24 Telegram üzerinden sunduğu yoğun destek.');
update public.courses set title='Deutsch A1.1 (Online)',description='Bequem von zu Hause. Wir fangen komplett von vorne an! In kleinen Gruppen (max. 10 Personen), inklusive Unterrichtsaufzeichnung für die eigene Wiederholung im Anschluss und intensivem 24/7 Telegram-Support durch die Lehrerin bei Fragen zur Grammatik und Sprache.',level='A1.1' where id='a8aca737-634b-4abb-8c81-e779ae81a5db';
insert into public.course_translations(course_id,locale,title,description) values('a8aca737-634b-4abb-8c81-e779ae81a5db','en','German A1.1 (Online)','Comfortably from home. We start completely from scratch! In small groups (max. 10 people), including lesson recordings for your own review afterwards and intensive 24/7 Telegram support from the teacher for questions about grammar and language.');
insert into public.course_translations(course_id,locale,title,description) values('a8aca737-634b-4abb-8c81-e779ae81a5db','ru','Немецкий A1.1 (Онлайн)','Удобно из дома. Начинаем с самого нуля! В небольших группах (макс. 10 человек), включая записи уроков для самостоятельного повторения и интенсивную круглосуточную (24/7) поддержку в Telegram от преподавателя по вопросам грамматики и языка.');
insert into public.course_translations(course_id,locale,title,description) values('a8aca737-634b-4abb-8c81-e779ae81a5db','uk','Німецька A1.1 (Онлайн)','Зручно з дому. Починаємо з самого нуля! У невеликих групах (макс. 10 осіб), включаючи записи уроків для самостійного повторення та інтенсивну цілодобову (24/7) підтримку в Telegram від викладача з питань граматики та мови.');
insert into public.course_translations(course_id,locale,title,description) values('a8aca737-634b-4abb-8c81-e779ae81a5db','tr','Almanca A1.1 (Çevrimiçi)','Evinizin rahatlığında. Tamamen sıfırdan başlıyoruz! Küçük gruplar halinde (en fazla 10 kişi), derslerin kaydını daha sonra kendi başınıza tekrar edebilmeniz için sunuyoruz ve gramer ve dil ile ilgili sorularınız için öğretmenimizden 7/24 yoğun Telegram desteği alabilirsiniz.');
update public.courses set title='Sprechtraining A1-B2',description='Verlieren Sie die Scheu vorm Sprechen.',level='A1-B2' where id='ec33a7aa-86d8-4072-bde2-aed5b40be25e';
insert into public.course_translations(course_id,locale,title,description) values('ec33a7aa-86d8-4072-bde2-aed5b40be25e','en','Speech Training A1-B2','Lose shyness, gain confidence.');
insert into public.course_translations(course_id,locale,title,description) values('ec33a7aa-86d8-4072-bde2-aed5b40be25e','ru','Разговорная практика A1-B2','Преодолеть стеснение, обрести уверенность.');
insert into public.course_translations(course_id,locale,title,description) values('ec33a7aa-86d8-4072-bde2-aed5b40be25e','uk','Розмовна практика A1-B2','Подолати сором''язливість, здобути впевненість.');
insert into public.course_translations(course_id,locale,title,description) values('ec33a7aa-86d8-4072-bde2-aed5b40be25e','tr','Konuşma Pratiği A1-B2','Çekingenliği yenmek, özgüven kazanmak.');
update public.courses set title='Sprechtraining A1-B2',description='Sicherheit im freien Sprechen gewinnen.',level='A1-B2' where id='6dda9c76-37eb-4803-ba83-ccdf74005295';
insert into public.course_translations(course_id,locale,title,description) values('6dda9c76-37eb-4803-ba83-ccdf74005295','en','Speech Training A1-B2','Confident speaking in everyday situations.');
insert into public.course_translations(course_id,locale,title,description) values('6dda9c76-37eb-4803-ba83-ccdf74005295','ru','Разговорная практика A1-B2','Уверенное общение в повседневных ситуациях.');
insert into public.course_translations(course_id,locale,title,description) values('6dda9c76-37eb-4803-ba83-ccdf74005295','uk','Розмовна практика A1-B2','Впевнене спілкування в повсякденних ситуаціях.');
insert into public.course_translations(course_id,locale,title,description) values('6dda9c76-37eb-4803-ba83-ccdf74005295','tr','Konuşma Pratiği A1-B2','Günlük durumlarda özgüvenli konuşma.');
update public.courses set title='Sprechtraining A1-B2',description='Verlieren Sie die Scheu vorm Sprechen. Ideale Ergänzung zum A1.1 Kurs.',level='A1-B2' where id='cfc5f41f-0bf9-4295-aeaf-614afd0dba07';
insert into public.course_translations(course_id,locale,title,description) values('cfc5f41f-0bf9-4295-aeaf-614afd0dba07','en','Speech Training A1-B2','Lose your fear of speaking. Ideal addition to the A1.1 course.');
insert into public.course_translations(course_id,locale,title,description) values('cfc5f41f-0bf9-4295-aeaf-614afd0dba07','ru','Разговорная практика A1-B2','Избавьтесь от страха говорить. Идеальное дополнение к курсу A1.1.');
insert into public.course_translations(course_id,locale,title,description) values('cfc5f41f-0bf9-4295-aeaf-614afd0dba07','uk','Розмовна практика A1-B2','Позбудьтеся страху говорити. Ідеальне доповнення до курсу A1.1.');
insert into public.course_translations(course_id,locale,title,description) values('cfc5f41f-0bf9-4295-aeaf-614afd0dba07','tr','Konuşma Pratiği A1-B2','Konuşma korkunuzu yenin. A1.1 kursu için ideal bir eklenti.');
update public.courses set title='Sprechtraining A1-B2',description='Fokus auf Aussprache und Wortfluss.',level='A1-B2' where id='4f5da1ab-80c5-49d6-877e-e0c851698bd1';
insert into public.course_translations(course_id,locale,title,description) values('4f5da1ab-80c5-49d6-877e-e0c851698bd1','en','Speech Training A1-B2','Deepening speaking skills.');
insert into public.course_translations(course_id,locale,title,description) values('4f5da1ab-80c5-49d6-877e-e0c851698bd1','ru','Разговорная практика A1-B2','Углубление разговорных навыков.');
insert into public.course_translations(course_id,locale,title,description) values('4f5da1ab-80c5-49d6-877e-e0c851698bd1','uk','Розмовна практика A1-B2','Поглиблення розмовних навичок.');
insert into public.course_translations(course_id,locale,title,description) values('4f5da1ab-80c5-49d6-877e-e0c851698bd1','tr','Konuşma Pratiği A1-B2','Konuşma becerilerini derinleştirme.');
update public.courses set title='Deutsch Level 3',description='Aufbaukurs. Vertiefen Sie Grundlagen und Wortschatz.',level='A2-B1' where id='a2602f45-acdb-42b2-b587-8aebabfdd218';
insert into public.course_translations(course_id,locale,title,description) values('a2602f45-acdb-42b2-b587-8aebabfdd218','en','German Level 3','Advanced beginners. Deepening the basics.');
insert into public.course_translations(course_id,locale,title,description) values('a2602f45-acdb-42b2-b587-8aebabfdd218','ru','Немецкий Уровень 3','Курс углубления. Закрепление основ.');
insert into public.course_translations(course_id,locale,title,description) values('a2602f45-acdb-42b2-b587-8aebabfdd218','uk','Німецька Рівень 3','Курс поглиблення. Закріплення основ.');
insert into public.course_translations(course_id,locale,title,description) values('a2602f45-acdb-42b2-b587-8aebabfdd218','tr','Almanca Seviye 3','Geliştirme kursu. Temellerin derinleştirilmesi.');
commit;
