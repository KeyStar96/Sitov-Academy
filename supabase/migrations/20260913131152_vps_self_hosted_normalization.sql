-- APPROVED VPS-ONLY MIGRATION. Run deploy/vps/migrate-local.py after reviewing its backup and empty-storage preflight.
BEGIN;
-- Run only on the VPS after a verified backup and with application writes stopped.
-- The owner approved a fresh student start. Preserve staff accounts and all content.
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='60s';

SELECT cron.alter_job(jobid,active:=false) FROM cron.job WHERE command ~* 'supabase[.]co';
ALTER TABLE public.registrations DISABLE TRIGGER "notify-registration-insert";
ALTER TABLE public.trial_lessons DISABLE TRIGGER "notify-trial-insert";

TRUNCATE public.pronunciation_messages,public.teacher_feedback,public.submissions,
 public.user_exercise_progress,public.user_vocabulary_progress,public.vocabulary_direction_progress,
 public.vocabulary_learning_state,public.vocabulary_onboarding,vocabulary_private.answer_receipts,
 learning_reset_private.audio_objects,learning_reset_private.jobs,
 public.student_trainer_access,public.teacher_student_notes,
 public.manual_invoice_status,monthly_booking_private.booking_courses,
 public.monthly_course_bookings,public.enrollments,public.registrations,
 public.trial_lessons,public.cancellations,monthly_booking_private.profile_contact_migration_audit;

DELETE FROM auth.users a WHERE NOT EXISTS(
 SELECT 1 FROM public.profiles p WHERE p.id=a.id AND p.role IN('teacher','admin')
);
DELETE FROM public.profiles p WHERE NOT EXISTS(SELECT 1 FROM auth.users a WHERE a.id=p.id);
DELETE FROM public.users;

-- Dead reference audio is regenerated locally on demand. Authored text is untouched.
UPDATE public.vocabulary_cards SET audio_url=NULL WHERE audio_url IS NOT NULL;
UPDATE public.exercises SET solution_audio_url=NULL WHERE solution_audio_url IS NOT NULL;
UPDATE public.pronunciation_prompts SET audio_url=NULL WHERE audio_url IS NOT NULL;

-- Metadata-only repair: preflight proved the configured MinIO bucket is empty.
-- Never use this step against a bucket containing actual object files.
SET LOCAL storage.allow_delete_query='true';
DELETE FROM storage.objects;
UPDATE storage.buckets SET public=false WHERE id='audio_submissions';

-- Native VPS delivery. Apply before business.sql. No pg_net, Resend or external HTTP triggers.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE IF NOT EXISTS private.mail_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL UNIQUE CHECK (length(dedupe_key) BETWEEN 1 AND 240),
  kind text NOT NULL CHECK (kind IN ('registration_received','registration_confirmed','booking_cancelled','cancellation_requested','trial_confirmed','trial_cancelled','new_enrollment','feedback_available','raw')),
  recipient text NOT NULL CHECK (length(recipient) <= 254 AND recipient ~ '^[^[:space:]<>@,;]+@[^[:space:]<>@,;]+\.[^[:space:]<>@,;]+$'),
  locale text NOT NULL DEFAULT 'de' CHECK (locale IN ('de','en','ru','uk','tr')),
  payload jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(payload)='object' AND octet_length(payload::text) <= 262144),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 8),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  lease_token uuid,
  worker_id uuid,
  last_error text,
  message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CHECK ((status='processing') = (lease_token IS NOT NULL AND lease_until IS NOT NULL))
);
ALTER TABLE private.mail_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.mail_outbox FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON private.mail_outbox TO service_role;
CREATE INDEX IF NOT EXISTS mail_outbox_due_idx ON private.mail_outbox(available_at,created_at) WHERE status='pending';
CREATE INDEX IF NOT EXISTS mail_outbox_lease_idx ON private.mail_outbox(lease_until) WHERE status='processing';

CREATE OR REPLACE FUNCTION public.queue_transactional_email(p_dedupe_key text,p_kind text,p_recipient text,p_locale text,p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO private.mail_outbox(dedupe_key,kind,recipient,locale,payload)
  VALUES(p_dedupe_key,p_kind,lower(trim(p_recipient)),CASE WHEN p_locale IN ('de','en','ru','uk','tr') THEN p_locale ELSE 'de' END,p_payload)
  ON CONFLICT(dedupe_key) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN SELECT id INTO v_id FROM private.mail_outbox WHERE dedupe_key=p_dedupe_key; END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.claim_mail_jobs(p_worker_id uuid,p_limit integer DEFAULT 5)
RETURNS SETOF private.mail_outbox LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
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

CREATE OR REPLACE FUNCTION public.complete_mail_job(p_id uuid,p_lease_token uuid,p_message_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE n integer;
BEGIN
  UPDATE private.mail_outbox SET status='sent',sent_at=now(),message_id=left(p_message_id,300),
    lease_token=NULL,lease_until=NULL,worker_id=NULL,last_error=NULL
    WHERE id=p_id AND status='processing' AND lease_token=p_lease_token AND lease_until>now();
  GET DIAGNOSTICS n=ROW_COUNT; RETURN n=1;
END $$;

CREATE OR REPLACE FUNCTION public.fail_mail_job(p_id uuid,p_lease_token uuid,p_error text,p_permanent boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE n integer;
BEGIN
  UPDATE private.mail_outbox SET status=CASE WHEN p_permanent OR attempts>=8 THEN 'failed' ELSE 'pending' END,
    available_at=now()+make_interval(secs=>least(21600,(30*power(2,greatest(attempts-1,0)))::integer)),
    last_error=left(p_error,200),lease_token=NULL,lease_until=NULL,worker_id=NULL
    WHERE id=p_id AND status='processing' AND lease_token=p_lease_token AND lease_until>now();
  GET DIAGNOSTICS n=ROW_COUNT; RETURN n=1;
END $$;

REVOKE ALL ON FUNCTION public.queue_transactional_email(text,text,text,text,jsonb),public.claim_mail_jobs(uuid,integer),public.complete_mail_job(uuid,uuid,text),public.fail_mail_job(uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.queue_transactional_email(text,text,text,text,jsonb),public.claim_mail_jobs(uuid,integer),public.complete_mail_job(uuid,uuid,text),public.fail_mail_job(uuid,uuid,text,boolean) TO service_role;
COMMENT ON TABLE private.mail_outbox IS 'Transactional native SMTP outbox. Stable dedupe key and Message-ID; at-least-once delivery after SMTP/DB crash. Failed jobs require operator inspection. Contains private mail payloads.';

-- VPS-only replacement. Apply only after the approved business-data backup/reset.
-- mail.sql must be installed first. Auth accounts and staff preferences survive.
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
 if cardinality(p_courses) not between 1 and 100 or cardinality(p_courses)<>(select count(distinct id) from unnest(p_courses) id)
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
 if p_month<>v_next then raise sqlstate '22008';end if;
 select * into b from public.bookings where person_id=p.id and target_month=p_month and kind<>'trial' for update;
 if b.id is distinct from p_expected or (b.id is not null and b.revision is distinct from p_revision) then raise serialization_failure;end if;
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

-- VPS-only learning normalization. Run after business.sql, with the application stopped.
-- Root deployment owns backups and the explicitly authorized reset of learner data/files.
-- Catalog identities and every authored text are retained. Never run on Cloud Supabase.
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='180s';

DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.vocabulary_direction_progress)
 OR EXISTS(SELECT 1 FROM public.user_vocabulary_progress)
 OR EXISTS(SELECT 1 FROM public.user_exercise_progress)
 OR EXISTS(SELECT 1 FROM public.submissions)
 OR EXISTS(SELECT 1 FROM public.teacher_feedback)
 OR EXISTS(SELECT 1 FROM public.pronunciation_messages) THEN
  RAISE EXCEPTION 'Stop: learner progress/conversations must be reset by the approved deployment first';
 END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS learning_private;
REVOKE ALL ON SCHEMA learning_private FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA learning_private TO authenticated,service_role;

CREATE TABLE public.learning_levels (
 code text PRIMARY KEY,
 cefr_level text NOT NULL CHECK(cefr_level IN('A1','A2','B1','B2','C1','C2')),
 sort_order smallint NOT NULL UNIQUE CHECK(sort_order>0)
);
INSERT INTO public.learning_levels VALUES
 ('A1.1','A1',1),('A1.2','A1',2),('A2.1','A2',3),('A2.2','A2',4),('B1.1','B1',5),('B1.2','B1',6);
CREATE TABLE public.learning_units (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 level text NOT NULL REFERENCES public.learning_levels(code),
 trainer text NOT NULL CHECK(trainer IN('vocabulary','exercises','pronunciation','videos')),
 label text NOT NULL CHECK(length(btrim(label)) BETWEEN 1 AND 160),
 sort_order integer NOT NULL DEFAULT 0,
 is_active boolean NOT NULL DEFAULT true,
 UNIQUE(id,level,trainer)
);
CREATE UNIQUE INDEX learning_units_named_lesson_idx ON public.learning_units(level,trainer,label)
 WHERE trainer IN('vocabulary','exercises');
CREATE INDEX learning_units_catalog_idx ON public.learning_units(level,trainer,sort_order,id);
CREATE TABLE public.student_level_access (
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 level text NOT NULL REFERENCES public.learning_levels(code),
 PRIMARY KEY(user_id,level)
);
INSERT INTO public.student_level_access SELECT p.id,l.code FROM public.profiles p
 JOIN public.learning_levels l ON l.code=ANY(p.allowed_levels);
CREATE TABLE public.learning_trainer_grants (
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 level text NOT NULL REFERENCES public.learning_levels(code),
 trainer text NOT NULL CHECK(trainer IN('vocabulary','exercises','pronunciation','videos')),
 enabled boolean NOT NULL,
 unit_mode text NOT NULL DEFAULT 'all' CHECK(unit_mode IN('all','selected')),
 PRIMARY KEY(user_id,level,trainer)
);
CREATE TABLE public.learning_unit_grants (
 user_id uuid NOT NULL, level text NOT NULL, trainer text NOT NULL, unit_id uuid NOT NULL,
 PRIMARY KEY(user_id,level,trainer,unit_id),
 FOREIGN KEY(user_id,level,trainer) REFERENCES public.learning_trainer_grants(user_id,level,trainer) ON DELETE CASCADE,
 FOREIGN KEY(unit_id,level,trainer) REFERENCES public.learning_units(id,level,trainer) ON DELETE CASCADE
);
CREATE INDEX learning_unit_grants_unit_idx ON public.learning_unit_grants(unit_id);
INSERT INTO public.learning_units(level,trainer,label,sort_order)
 SELECT level,'vocabulary',lesson,row_number() OVER(PARTITION BY level ORDER BY lesson)
 FROM public.vocabulary_cards GROUP BY level,lesson;
INSERT INTO public.learning_units(level,trainer,label,sort_order)
 SELECT level,'exercises',lesson,row_number() OVER(PARTITION BY level ORDER BY lesson)
 FROM public.exercises GROUP BY level,lesson;
-- Preserve old inactive family-only texts, but never publish them by guessing a level.
INSERT INTO public.learning_units(id,level,trainer,label,sort_order,is_active)
 SELECT id,coalesce(level,cefr_level||'.1'),'pronunciation',coalesce(nullif(title,''),left(sentence_de,120)),sort_order,is_active AND level IS NOT NULL
 FROM public.pronunciation_prompts WHERE coalesce(level,cefr_level||'.1') IN(SELECT code FROM public.learning_levels);
INSERT INTO public.learning_units(id,level,trainer,label,sort_order)
 SELECT id,level,'videos',title,row_number() OVER(PARTITION BY level ORDER BY created_at,id) FROM public.videos;
INSERT INTO public.learning_trainer_grants SELECT user_id,level,trainer,enabled,
 CASE WHEN allowed_lessons IS NULL THEN 'all' ELSE 'selected' END FROM public.student_trainer_access;
INSERT INTO public.learning_unit_grants
 SELECT DISTINCT a.user_id,a.level,a.trainer,u.id FROM public.student_trainer_access a
 JOIN public.learning_units u ON u.level=a.level AND u.trainer=a.trainer
 AND (u.id::text=ANY(a.allowed_lessons) OR u.label=ANY(a.allowed_lessons));

-- Capture all original rows inside this transaction for exact-content assertions.
CREATE TEMP TABLE learning_catalog_before ON COMMIT DROP AS
 SELECT 'vocabulary' trainer,id,to_jsonb(c) payload FROM public.vocabulary_cards c
 UNION ALL SELECT 'exercises',id,to_jsonb(e) FROM public.exercises e
 UNION ALL SELECT 'pronunciation',id,to_jsonb(p) FROM public.pronunciation_prompts p
 UNION ALL SELECT 'videos',id,to_jsonb(v) FROM public.videos v;

-- Drop only policies on the objects being replaced; each backing table gets new RLS below.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT schemaname,tablename,policyname FROM pg_policies WHERE schemaname='public'
 AND tablename IN('vocabulary_cards','exercises','pronunciation_prompts','videos','student_trainer_access') LOOP
  EXECUTE format('DROP POLICY %I ON %I.%I',p.policyname,p.schemaname,p.tablename);
 END LOOP;
END $$;
ALTER TABLE public.vocabulary_cards RENAME TO learning_vocabulary_cards;
ALTER TABLE public.exercises RENAME TO learning_exercises;
ALTER TABLE public.pronunciation_prompts RENAME TO learning_reading_texts;
ALTER TABLE public.videos RENAME TO learning_videos;
ALTER TABLE public.learning_vocabulary_cards ADD COLUMN unit_id uuid REFERENCES public.learning_units(id);
ALTER TABLE public.learning_exercises ADD COLUMN unit_id uuid REFERENCES public.learning_units(id);
ALTER TABLE public.learning_reading_texts ADD COLUMN unit_id uuid UNIQUE REFERENCES public.learning_units(id);
ALTER TABLE public.learning_videos ADD COLUMN unit_id uuid UNIQUE REFERENCES public.learning_units(id);
UPDATE public.learning_vocabulary_cards c SET unit_id=u.id FROM public.learning_units u WHERE u.level=c.level AND u.trainer='vocabulary' AND u.label=c.lesson;
UPDATE public.learning_exercises e SET unit_id=u.id FROM public.learning_units u WHERE u.level=e.level AND u.trainer='exercises' AND u.label=e.lesson;
UPDATE public.learning_reading_texts SET unit_id=id WHERE id IN(SELECT id FROM public.learning_units WHERE trainer='pronunciation');
UPDATE public.learning_videos SET unit_id=id;
ALTER TABLE public.learning_vocabulary_cards ALTER COLUMN unit_id SET NOT NULL;
ALTER TABLE public.learning_exercises ALTER COLUMN unit_id SET NOT NULL;
ALTER TABLE public.learning_videos ALTER COLUMN unit_id SET NOT NULL;
CREATE INDEX learning_vocabulary_unit_idx ON public.learning_vocabulary_cards(unit_id);
CREATE INDEX learning_exercises_unit_idx ON public.learning_exercises(unit_id);

-- A content row can never point at another trainer's unit, including direct staff SQL.
CREATE FUNCTION learning_private.validate_content_unit() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.unit_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.learning_units WHERE id=NEW.unit_id AND trainer=TG_ARGV[0]) THEN
  RAISE EXCEPTION 'Content unit has the wrong trainer' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION learning_private.validate_content_unit() FROM PUBLIC,anon;
CREATE TRIGGER validate_unit BEFORE INSERT OR UPDATE OF unit_id ON public.learning_vocabulary_cards FOR EACH ROW EXECUTE FUNCTION learning_private.validate_content_unit('vocabulary');
CREATE TRIGGER validate_unit BEFORE INSERT OR UPDATE OF unit_id ON public.learning_exercises FOR EACH ROW EXECUTE FUNCTION learning_private.validate_content_unit('exercises');
CREATE TRIGGER validate_unit BEFORE INSERT OR UPDATE OF unit_id ON public.learning_reading_texts FOR EACH ROW EXECUTE FUNCTION learning_private.validate_content_unit('pronunciation');
CREATE TRIGGER validate_unit BEFORE INSERT OR UPDATE OF unit_id ON public.learning_videos FOR EACH ROW EXECUTE FUNCTION learning_private.validate_content_unit('videos');

CREATE TABLE public.vocabulary_translations (
 card_id uuid NOT NULL REFERENCES public.learning_vocabulary_cards(id) ON DELETE CASCADE,
 locale text NOT NULL CHECK(locale IN('de','en','ru','uk','tr')),
 translation text,
 context_sentence text,
 is_difficult boolean NOT NULL DEFAULT false,
 PRIMARY KEY(card_id,locale)
);
INSERT INTO public.vocabulary_translations
 SELECT c.id,l.locale,to_jsonb(c)->>('translation_'||l.locale),to_jsonb(c)->>('context_sentence_'||l.locale),
 coalesce((to_jsonb(c)->>('is_hard_for_'||l.locale))::boolean,false)
 FROM public.learning_vocabulary_cards c CROSS JOIN (VALUES('de'),('en'),('ru'),('uk'),('tr')) l(locale);
CREATE TABLE public.grammar_translations (
 exercise_id uuid NOT NULL REFERENCES public.learning_exercises(id) ON DELETE CASCADE,
 locale text NOT NULL CHECK(length(locale) BETWEEN 2 AND 20),
 hint text, smart_hint text, explanation text,
 PRIMARY KEY(exercise_id,locale)
);
INSERT INTO public.grammar_translations
 SELECT e.id,l.locale,
 CASE WHEN jsonb_typeof(e.hint)='object' THEN e.hint->>l.locale END,
 CASE WHEN jsonb_typeof(e.content->'smart_hint')='object' THEN e.content->'smart_hint'->>l.locale WHEN l.locale='de' THEN e.content->>'smart_hint' END,
 CASE WHEN jsonb_typeof(e.content->'explanation')='object' THEN e.content->'explanation'->>l.locale WHEN l.locale='de' THEN e.content->>'explanation' END
 FROM public.learning_exercises e CROSS JOIN LATERAL (
 SELECT jsonb_object_keys(CASE WHEN jsonb_typeof(e.hint)='object' THEN e.hint ELSE '{}'::jsonb END) locale
 UNION SELECT jsonb_object_keys(CASE WHEN jsonb_typeof(e.content->'smart_hint')='object' THEN e.content->'smart_hint' ELSE '{}'::jsonb END)
 UNION SELECT jsonb_object_keys(CASE WHEN jsonb_typeof(e.content->'explanation')='object' THEN e.content->'explanation' ELSE '{}'::jsonb END)
 UNION SELECT 'de' WHERE jsonb_typeof(e.content->'smart_hint')='string' OR jsonb_typeof(e.content->'explanation')='string'
 ) l;
UPDATE public.learning_exercises SET content=content-'smart_hint'-'explanation';
ALTER TABLE public.learning_exercises ADD COLUMN content_version smallint NOT NULL DEFAULT 1 CHECK(content_version=1);
ALTER TABLE public.learning_exercises ADD CONSTRAINT grammar_content_object CHECK(jsonb_typeof(content)='object');
ALTER TABLE public.learning_exercises DROP COLUMN lesson,DROP COLUMN level,DROP COLUMN hint;
ALTER TABLE public.learning_vocabulary_cards DROP CONSTRAINT IF EXISTS vocabulary_sentence_target_check;
ALTER TABLE public.learning_vocabulary_cards DROP COLUMN lesson,DROP COLUMN level,
 DROP COLUMN translation_en,DROP COLUMN translation_ru,DROP COLUMN translation_tr,DROP COLUMN translation_uk,
 DROP COLUMN context_sentence_de,DROP COLUMN context_sentence_en,DROP COLUMN context_sentence_ru,DROP COLUMN context_sentence_uk,DROP COLUMN context_sentence_tr,
 DROP COLUMN is_hard_for_ru,DROP COLUMN is_hard_for_tr;
-- Keep legacy family-only texts verbatim in the same table, unpublished (unit_id NULL).
ALTER TABLE public.learning_reading_texts RENAME COLUMN cefr_level TO legacy_cefr_level;
ALTER TABLE public.learning_reading_texts ALTER COLUMN legacy_cefr_level DROP NOT NULL;
UPDATE public.learning_reading_texts SET legacy_cefr_level=NULL WHERE unit_id IS NOT NULL;
ALTER TABLE public.learning_reading_texts ADD CONSTRAINT reading_text_level CHECK(unit_id IS NOT NULL OR legacy_cefr_level IS NOT NULL);
ALTER TABLE public.learning_reading_texts DROP COLUMN level,DROP COLUMN title,DROP COLUMN lesson,DROP COLUMN sort_order,DROP COLUMN is_active;
ALTER TABLE public.learning_videos DROP COLUMN level,DROP COLUMN lesson,DROP COLUMN title;

CREATE VIEW public.vocabulary_cards WITH(security_invoker=true) AS
 SELECT c.id,u.label lesson,c.word_de,c.article,c.plural,en.translation translation_en,ru.translation translation_ru,tr.translation translation_tr,uk.translation translation_uk,
 c.image_url,c.audio_url,ru.is_difficult is_hard_for_ru,tr.is_difficult is_hard_for_tr,c.created_at,u.level,
 de.context_sentence context_sentence_de,en.context_sentence context_sentence_en,ru.context_sentence context_sentence_ru,uk.context_sentence context_sentence_uk,tr.context_sentence context_sentence_tr,
 c.sentence_practice,c.alternative_answers_de,c.unit_id
 FROM public.learning_vocabulary_cards c JOIN public.learning_units u ON u.id=c.unit_id
 LEFT JOIN public.vocabulary_translations de ON de.card_id=c.id AND de.locale='de'
 LEFT JOIN public.vocabulary_translations en ON en.card_id=c.id AND en.locale='en'
 LEFT JOIN public.vocabulary_translations ru ON ru.card_id=c.id AND ru.locale='ru'
 LEFT JOIN public.vocabulary_translations uk ON uk.card_id=c.id AND uk.locale='uk'
 LEFT JOIN public.vocabulary_translations tr ON tr.card_id=c.id AND tr.locale='tr';
CREATE VIEW public.exercises WITH(security_invoker=true) AS
 SELECT e.id,u.label lesson,e.topic,e.type,e.content
 ||CASE WHEN t.smart_hint IS NOT NULL THEN jsonb_build_object('smart_hint',t.smart_hint) ELSE '{}'::jsonb END
 ||CASE WHEN t.explanation IS NOT NULL THEN jsonb_build_object('explanation',t.explanation) ELSE '{}'::jsonb END content,
 t.hint,e.created_at,u.level,e.solution_audio_url,e.unit_id
 FROM public.learning_exercises e JOIN public.learning_units u ON u.id=e.unit_id
 LEFT JOIN LATERAL(SELECT jsonb_object_agg(locale,hint) FILTER(WHERE hint IS NOT NULL) hint,
 jsonb_object_agg(locale,smart_hint) FILTER(WHERE smart_hint IS NOT NULL) smart_hint,
 jsonb_object_agg(locale,explanation) FILTER(WHERE explanation IS NOT NULL) explanation
 FROM public.grammar_translations WHERE exercise_id=e.id) t ON true;
CREATE VIEW public.pronunciation_prompts WITH(security_invoker=true) AS
 SELECT p.id,coalesce(l.cefr_level,p.legacy_cefr_level) cefr_level,p.sentence_de,p.focus,p.audio_url,
 coalesce(u.sort_order,0) sort_order,p.created_at,coalesce(u.label,'Archiv') lesson,u.level,u.label title,
 coalesce(u.is_active,false) is_active,p.unit_id
 FROM public.learning_reading_texts p LEFT JOIN public.learning_units u ON u.id=p.unit_id
 LEFT JOIN public.learning_levels l ON l.code=u.level;
CREATE VIEW public.videos WITH(security_invoker=true) AS
 SELECT v.id,u.label title,v.description,u.label lesson,v.video_url,v.external_url,v.is_external,v.created_at,u.level,v.unit_id
 FROM public.learning_videos v JOIN public.learning_units u ON u.id=v.unit_id;

-- Empty old progress is replaced with a projection, not a second physical store.
DROP TABLE public.user_vocabulary_progress;
DROP FUNCTION vocabulary_private.mirror_legacy_progress();
CREATE VIEW public.user_vocabulary_progress WITH(security_invoker=true) AS
 SELECT id,user_id,card_id,box_number,next_review_date,lapses,last_answered_at,created_at,updated_at
 FROM public.vocabulary_direction_progress WHERE direction='de_to_native';
DROP TABLE public.student_trainer_access;
CREATE VIEW public.student_trainer_access WITH(security_invoker=true) AS
 SELECT a.user_id,a.level,a.trainer,a.enabled,
 CASE WHEN a.unit_mode='all' THEN NULL::text[] ELSE ARRAY(SELECT g.unit_id::text FROM public.learning_unit_grants g
 WHERE g.user_id=a.user_id AND g.level=a.level AND g.trainer=a.trainer ORDER BY g.unit_id) END allowed_lessons
 FROM public.learning_trainer_grants a;

DROP VIEW public.profile_details;
ALTER TABLE public.profiles DROP COLUMN allowed_levels;
CREATE VIEW public.profile_details WITH(security_invoker=true) AS
 SELECT p.*,person.id legacy_user_id,person.display_name name,person.email,person.phone,person.street,person.postal_code zip_code,person.city,
 ARRAY(SELECT a.level FROM public.student_level_access a WHERE a.user_id=p.id ORDER BY a.level) allowed_levels
 FROM public.profiles p LEFT JOIN public.people person ON person.auth_user_id=p.id;
GRANT SELECT ON public.profile_details TO authenticated,service_role;
-- Identity, roles and billing identifiers cannot be forged via profile preferences.
REVOKE INSERT,UPDATE,DELETE ON public.profiles FROM PUBLIC,anon,authenticated;
GRANT UPDATE(native_language,ui_language) ON public.profiles TO authenticated;


CREATE OR REPLACE FUNCTION trainer_access_private.allowed(p_level text,p_trainer text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND(
 p.role IN('teacher','admin') OR(p.ui_language<>'de' AND p_trainer IN('vocabulary','exercises','pronunciation','videos')
 AND EXISTS(SELECT 1 FROM public.student_level_access l WHERE l.user_id=p.id AND l.level=p_level)
 AND coalesce((SELECT a.enabled FROM public.learning_trainer_grants a WHERE a.user_id=p.id AND a.level=p_level AND a.trainer=p_trainer),true))));
$$;
CREATE OR REPLACE FUNCTION trainer_access_private.unit_allowed(p_level text,p_trainer text,p_unit text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT trainer_access_private.allowed(p_level,p_trainer) AND EXISTS(SELECT 1 FROM public.learning_units u
 WHERE u.level=p_level AND u.trainer=p_trainer AND (u.id::text=p_unit OR u.label=p_unit) AND(
 (SELECT monthly_booking_private.current_profile_role()) IN('teacher','admin') OR(u.is_active AND NOT EXISTS(
 SELECT 1 FROM public.learning_trainer_grants a WHERE a.user_id=(SELECT auth.uid()) AND a.level=p_level AND a.trainer=p_trainer
 AND a.unit_mode='selected' AND NOT EXISTS(SELECT 1 FROM public.learning_unit_grants g
 WHERE g.user_id=a.user_id AND g.level=a.level AND g.trainer=a.trainer AND g.unit_id=u.id)))));
$$;
CREATE FUNCTION learning_private.unit_allowed(p_unit_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.learning_units u WHERE u.id=p_unit_id
 AND trainer_access_private.unit_allowed(u.level,u.trainer,u.id::text));
$$;
REVOKE ALL ON FUNCTION learning_private.unit_allowed(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION learning_private.unit_allowed(uuid) TO authenticated,service_role;

DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['learning_levels','learning_units','student_level_access','learning_trainer_grants','learning_unit_grants',
 'learning_vocabulary_cards','learning_exercises','learning_reading_texts','learning_videos','vocabulary_translations','grammar_translations'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',tab);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',tab);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',tab);
  EXECUTE format('CREATE POLICY staff_manage ON public.%I FOR ALL TO authenticated USING((SELECT monthly_booking_private.current_profile_role()) IN(''teacher'',''admin'')) WITH CHECK((SELECT monthly_booking_private.current_profile_role()) IN(''teacher'',''admin''))',tab);
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['student_level_access','learning_trainer_grants','learning_unit_grants'] LOOP
  EXECUTE format('CREATE POLICY own_access_read ON public.%I FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()))',tab);
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['learning_vocabulary_cards','learning_exercises','learning_reading_texts','learning_videos'] LOOP
  EXECUTE format('CREATE POLICY released_content_read ON public.%I FOR SELECT TO authenticated USING(learning_private.unit_allowed(unit_id))',tab);
 END LOOP;
END $$;
CREATE POLICY authenticated_levels ON public.learning_levels FOR SELECT TO authenticated USING(true);
CREATE POLICY released_units ON public.learning_units FOR SELECT TO authenticated USING(learning_private.unit_allowed(id));
CREATE POLICY released_translations ON public.vocabulary_translations FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.learning_vocabulary_cards c WHERE c.id=card_id));
CREATE POLICY released_grammar_translations ON public.grammar_translations FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.learning_exercises e WHERE e.id=exercise_id));
GRANT SELECT ON public.vocabulary_cards,public.exercises,public.pronunciation_prompts,public.videos,
 public.student_trainer_access,public.user_vocabulary_progress TO authenticated,service_role;

CREATE FUNCTION public.set_student_level_access(p_user_id uuid,p_levels text[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 IF (SELECT monthly_booking_private.current_profile_role()) NOT IN('teacher','admin') OR auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Staff required' USING ERRCODE='42501'; END IF;
 IF p_levels IS NULL OR EXISTS(SELECT 1 FROM unnest(p_levels) l WHERE l IS NULL OR NOT EXISTS(SELECT 1 FROM public.learning_levels WHERE code=l)) THEN
  RAISE EXCEPTION 'Invalid levels' USING ERRCODE='23514'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('learning-access:'||p_user_id::text,0));
 DELETE FROM public.student_level_access WHERE user_id=p_user_id AND NOT(level=ANY(p_levels));
 INSERT INTO public.student_level_access SELECT p_user_id,l FROM unnest(p_levels) l ON CONFLICT DO NOTHING;
END $$;
CREATE FUNCTION public.set_student_trainer_access(p_user_id uuid,p_level text,p_trainer text,p_enabled boolean,p_unit_ids uuid[] DEFAULT NULL,p_replace_units boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 IF (SELECT monthly_booking_private.current_profile_role()) NOT IN('teacher','admin') OR auth.uid() IS NULL THEN
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
REVOKE ALL ON FUNCTION public.set_student_level_access(uuid,text[]),public.set_student_trainer_access(uuid,text,text,boolean,uuid[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_student_level_access(uuid,text[]),public.set_student_trainer_access(uuid,text,text,boolean,uuid[],boolean) TO authenticated;

-- One message store: the legacy feedback API is a projection of teacher replies.
DROP TABLE public.teacher_feedback;
CREATE VIEW public.teacher_feedback WITH(security_invoker=true) AS
 SELECT id,submission_id,sender_id teacher_id,text_content feedback_text,audio_path feedback_audio_url,created_at,seen_at
 FROM public.pronunciation_messages WHERE sender_role IN('teacher','admin');
GRANT SELECT ON public.teacher_feedback TO authenticated,service_role;

-- Content writers and revised learning RPCs are appended below.
CREATE FUNCTION learning_private.ensure_unit(p_id uuid,p_level text,p_trainer text,p_label text,p_active boolean DEFAULT true,p_sort integer DEFAULT 100)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ DECLARE result uuid; BEGIN
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
REVOKE ALL ON FUNCTION learning_private.ensure_unit(uuid,text,text,text,boolean,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION learning_private.ensure_unit(uuid,text,text,text,boolean,integer) TO authenticated,service_role;

CREATE FUNCTION public.save_learning_content(p_trainer text,p_payload jsonb,p_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE old_row jsonb; v jsonb; item uuid:=coalesce(p_id,gen_random_uuid()); unit uuid; lang text; labels jsonb; result jsonb; BEGIN
 IF current_user NOT IN('service_role','postgres') AND coalesce((SELECT monthly_booking_private.current_profile_role()),'') NOT IN('teacher','admin') THEN
  RAISE EXCEPTION 'Staff required' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_payload)<>'object' OR p_trainer NOT IN('vocabulary','exercises','pronunciation','videos') THEN
  RAISE EXCEPTION 'Invalid content' USING ERRCODE='23514'; END IF;
 IF p_id IS NOT NULL THEN
  IF p_trainer='vocabulary' THEN SELECT to_jsonb(c) INTO old_row FROM public.vocabulary_cards c WHERE id=p_id;
  ELSIF p_trainer='exercises' THEN SELECT to_jsonb(e) INTO old_row FROM public.exercises e WHERE id=p_id;
  ELSIF p_trainer='pronunciation' THEN SELECT to_jsonb(p) INTO old_row FROM public.pronunciation_prompts p WHERE id=p_id;
  ELSE SELECT to_jsonb(x) INTO old_row FROM public.videos x WHERE id=p_id; END IF;
  IF old_row IS NULL THEN RAISE EXCEPTION 'Content unavailable' USING ERRCODE='23514'; END IF;
 END IF;
 v:=coalesce(old_row,'{}'::jsonb)||p_payload;
 -- A changed lesson selects/creates its own unit rather than renaming every sibling.
 IF p_trainer IN('vocabulary','exercises') THEN
  IF old_row IS NOT NULL AND v->>'lesson'=old_row->>'lesson' AND v->>'level'=old_row->>'level' THEN unit:=(old_row->>'unit_id')::uuid;
  ELSE unit:=learning_private.ensure_unit(NULL,v->>'level',p_trainer,v->>'lesson'); END IF;
 ELSE
  unit:=learning_private.ensure_unit(coalesce((old_row->>'unit_id')::uuid,(old_row->>'id')::uuid),v->>'level',p_trainer,v->>'title',coalesce((v->>'is_active')::boolean,true),coalesce((v->>'sort_order')::integer,100));
  IF p_id IS NULL THEN item:=unit; END IF;
 END IF;
 IF p_trainer='vocabulary' THEN
  IF coalesce((v->>'sentence_practice')::boolean,false) AND EXISTS(SELECT 1 FROM unnest(ARRAY['de','en','ru','uk','tr']) l WHERE nullif(btrim(v->>('context_sentence_'||l)),'') IS NULL) THEN
   RAISE EXCEPTION 'Sentence translations required' USING ERRCODE='23514'; END IF;
  INSERT INTO public.learning_vocabulary_cards(id,unit_id,word_de,article,plural,image_url,audio_url,sentence_practice,alternative_answers_de)
  VALUES(item,unit,v->>'word_de',nullif(v->>'article','none'),v->>'plural',v->>'image_url',v->>'audio_url',coalesce((v->>'sentence_practice')::boolean,false),
   ARRAY(SELECT jsonb_array_elements_text(coalesce(v->'alternative_answers_de','[]'::jsonb))))
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,word_de=excluded.word_de,article=excluded.article,plural=excluded.plural,
   image_url=excluded.image_url,audio_url=excluded.audio_url,sentence_practice=excluded.sentence_practice,alternative_answers_de=excluded.alternative_answers_de;
  FOREACH lang IN ARRAY ARRAY['de','en','ru','uk','tr'] LOOP
   INSERT INTO public.vocabulary_translations(card_id,locale,translation,context_sentence,is_difficult)
   VALUES(item,lang,v->>('translation_'||lang),v->>('context_sentence_'||lang),coalesce((v->>('is_hard_for_'||lang))::boolean,false))
   ON CONFLICT(card_id,locale) DO UPDATE SET translation=excluded.translation,context_sentence=excluded.context_sentence,is_difficult=excluded.is_difficult;
  END LOOP;
  SELECT to_jsonb(c) INTO result FROM public.vocabulary_cards c WHERE id=item;
 ELSIF p_trainer='exercises' THEN
  IF v->>'type' NOT IN('fill_in_blank','multiple_choice') OR jsonb_typeof(v->'content')<>'object'
   OR nullif(btrim(v->'content'->>'correct_answer'),'') IS NULL THEN RAISE EXCEPTION 'Invalid exercise' USING ERRCODE='23514'; END IF;
  INSERT INTO public.learning_exercises(id,unit_id,topic,type,content,solution_audio_url)
  VALUES(item,unit,v->>'topic',v->>'type',(v->'content')-'smart_hint'-'explanation',v->>'solution_audio_url')
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,topic=excluded.topic,type=excluded.type,content=excluded.content,solution_audio_url=excluded.solution_audio_url;
  DELETE FROM public.grammar_translations WHERE exercise_id=item;
  FOR lang IN SELECT jsonb_object_keys(CASE WHEN jsonb_typeof(v->'hint')='object' THEN v->'hint' ELSE '{}'::jsonb END)
   UNION SELECT jsonb_object_keys(CASE WHEN jsonb_typeof(v->'content'->'smart_hint')='object' THEN v->'content'->'smart_hint' ELSE '{}'::jsonb END)
   UNION SELECT jsonb_object_keys(CASE WHEN jsonb_typeof(v->'content'->'explanation')='object' THEN v->'content'->'explanation' ELSE '{}'::jsonb END)
   UNION SELECT 'de' WHERE jsonb_typeof(v->'content'->'smart_hint')='string' OR jsonb_typeof(v->'content'->'explanation')='string'
  LOOP
   INSERT INTO public.grammar_translations(exercise_id,locale,hint,smart_hint,explanation) VALUES(item,lang,v->'hint'->>lang,
    CASE WHEN jsonb_typeof(v->'content'->'smart_hint')='object' THEN v->'content'->'smart_hint'->>lang WHEN lang='de' THEN v->'content'->>'smart_hint' END,
    CASE WHEN jsonb_typeof(v->'content'->'explanation')='object' THEN v->'content'->'explanation'->>lang WHEN lang='de' THEN v->'content'->>'explanation' END);
  END LOOP;
  SELECT to_jsonb(e) INTO result FROM public.exercises e WHERE id=item;
 ELSIF p_trainer='pronunciation' THEN
  INSERT INTO public.learning_reading_texts(id,unit_id,legacy_cefr_level,sentence_de,focus,audio_url)
  VALUES(item,unit,NULL,v->>'sentence_de',v->>'focus',v->>'audio_url')
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,legacy_cefr_level=excluded.legacy_cefr_level,sentence_de=excluded.sentence_de,focus=excluded.focus,audio_url=excluded.audio_url;
  SELECT to_jsonb(p) INTO result FROM public.pronunciation_prompts p WHERE id=item;
 ELSE
  INSERT INTO public.learning_videos(id,unit_id,description,video_url,external_url,is_external)
  VALUES(item,unit,v->>'description',v->>'video_url',v->>'external_url',coalesce((v->>'is_external')::boolean,true))
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,description=excluded.description,video_url=excluded.video_url,external_url=excluded.external_url,is_external=excluded.is_external;
  SELECT to_jsonb(x) INTO result FROM public.videos x WHERE id=item;
 END IF;
 IF old_row IS NOT NULL AND (old_row->>'unit_id')::uuid IS DISTINCT FROM unit THEN
  DELETE FROM public.learning_units u WHERE u.id=(old_row->>'unit_id')::uuid
   AND NOT EXISTS(SELECT 1 FROM public.learning_vocabulary_cards c WHERE c.unit_id=u.id)
   AND NOT EXISTS(SELECT 1 FROM public.learning_exercises e WHERE e.unit_id=u.id);
 END IF;
 RETURN result;
END $$;
CREATE FUNCTION public.delete_learning_content(p_trainer text,p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 IF coalesce((SELECT monthly_booking_private.current_profile_role()),'') NOT IN('teacher','admin') THEN RAISE EXCEPTION 'Staff required' USING ERRCODE='42501'; END IF;
 IF p_trainer='vocabulary' THEN DELETE FROM public.learning_vocabulary_cards WHERE id=p_id;
 ELSIF p_trainer='exercises' THEN DELETE FROM public.learning_exercises WHERE id=p_id;
 ELSIF p_trainer='pronunciation' THEN UPDATE public.learning_units SET is_active=false WHERE id=(SELECT unit_id FROM public.learning_reading_texts WHERE id=p_id);
 ELSIF p_trainer='videos' THEN DELETE FROM public.learning_videos WHERE id=p_id;
 ELSE RAISE EXCEPTION 'Invalid trainer' USING ERRCODE='23514'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.save_learning_content(text,jsonb,uuid),public.delete_learning_content(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_learning_content(text,jsonb,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.delete_learning_content(text,uuid) TO authenticated;


CREATE OR REPLACE FUNCTION pronunciation_private.can_access_submission(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS (
   SELECT 1 FROM public.submissions s WHERE s.id=p_id AND
   ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher','admin') OR
    (s.user_id=(SELECT auth.uid()) AND trainer_access_private.unit_allowed(s.level,'pronunciation',s.prompt_id::text)))
 );
$function$
;

CREATE OR REPLACE FUNCTION pronunciation_private.create_submission(p_prompt_id uuid, p_audio_path text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor uuid := (SELECT auth.uid()); prompt public.pronunciation_prompts%ROWTYPE; result uuid;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
 SELECT * INTO prompt FROM public.pronunciation_prompts WHERE id = p_prompt_id AND is_active;
 IF NOT FOUND OR prompt.level IS NULL OR NOT EXISTS(SELECT 1 FROM public.profile_details p WHERE p.id = actor AND
   (p.role IN ('teacher','admin') OR prompt.level = ANY(COALESCE(p.allowed_levels,ARRAY[]::text[])))) THEN RAISE EXCEPTION 'Level not allowed'; END IF;
  IF NOT trainer_access_private.unit_allowed(prompt.level, 'pronunciation', prompt.id::text) THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 IF p_audio_path NOT LIKE 'storage://pronunciation_audio/' || actor::text || '/%' OR NOT EXISTS(
 SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'pronunciation_audio' AND 'storage://pronunciation_audio/' || o.name = p_audio_path)
 THEN RAISE EXCEPTION 'Invalid recording'; END IF;
 INSERT INTO public.submissions(user_id,type,content_url,text_content,status,level,prompt_id,prompt_title)
 VALUES(actor,'audio',p_audio_path,prompt.sentence_de,'pending',prompt.level,prompt.id,prompt.title) RETURNING id INTO result;
 RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION vocabulary_private.initialize_cards(p_decisions jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      SELECT 1 FROM public.vocabulary_cards c JOIN public.profile_details p ON p.id = actor
      WHERE c.id = target AND trainer_access_private.unit_allowed(c.level, 'vocabulary', c.lesson) AND (p.role IN ('teacher','admin') OR c.level = ANY(coalesce(p.allowed_levels, ARRAY[]::text[])))
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
$function$
;

CREATE OR REPLACE FUNCTION grammar_private.record_attempt(p_exercise_id uuid, p_answer text, p_hint_shown boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  actor uuid := auth.uid();
  target public.exercises;
  correct boolean;
  answer_normalized text;
  attempt_count integer;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  IF p_answer IS NULL OR length(btrim(p_answer)) = 0 OR length(p_answer) > 1000 THEN
    RAISE EXCEPTION 'invalid_answer' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO target FROM public.exercises WHERE id = p_exercise_id;
  IF NOT FOUND OR target.type NOT IN ('fill_in_blank', 'multiple_choice') THEN
    RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profile_details p WHERE p.id = actor
    AND (p.role IN ('teacher','admin') OR target.level = ANY(coalesce(p.allowed_levels, ARRAY[]::text[])))) THEN
    RAISE EXCEPTION 'level_access_denied' USING ERRCODE = '42501';
  END IF;
  IF NOT trainer_access_private.unit_allowed(target.level, 'exercises', target.lesson) THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
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
$function$
;

CREATE OR REPLACE FUNCTION vocabulary_private.skip_assessment(p_level text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor uuid := auth.uid(); first_lesson text; decisions jsonb; result jsonb;
BEGIN
  IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profile_details p WHERE p.id = actor
    AND (p.role IN ('teacher','admin') OR p_level = ANY(coalesce(p.allowed_levels, ARRAY[]::text[])))) THEN
    RAISE EXCEPTION 'level_access_denied' USING ERRCODE = '42501';
  END IF;
  IF NOT trainer_access_private.allowed(p_level, 'vocabulary') THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
  SELECT c.lesson INTO first_lesson FROM public.vocabulary_cards c WHERE c.level = p_level AND trainer_access_private.unit_allowed(c.level,'vocabulary',c.lesson)
    ORDER BY nullif(substring(c.lesson from '[0-9]+'),'')::integer NULLS LAST, c.lesson, c.id LIMIT 1;
  IF first_lesson IS NULL THEN RAISE EXCEPTION 'lesson_not_found' USING ERRCODE = '22023'; END IF;
  SELECT jsonb_agg(jsonb_build_object('cardId',id,'alreadyKnown',false)) INTO decisions
    FROM public.vocabulary_cards WHERE level = p_level AND lesson = first_lesson;
  result := vocabulary_private.initialize_cards(decisions);
  INSERT INTO public.vocabulary_onboarding(user_id,level,status,started_lesson)
    VALUES(actor,p_level,'skipped',first_lesson)
    ON CONFLICT(user_id,level) DO UPDATE SET status='skipped',started_lesson=excluded.started_lesson,updated_at=now();
  RETURN result || jsonb_build_object('lesson',first_lesson);
END;
$function$
;

CREATE OR REPLACE FUNCTION vocabulary_private.submit_answer(p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  actor uuid := auth.uid(); progress public.vocabulary_direction_progress; card public.vocabulary_cards;
  profile public.profile_details; previous_card uuid; prompt text; correct boolean; sentence boolean;
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
  SELECT * INTO card FROM public.vocabulary_cards WHERE id = progress.card_id;
  SELECT * INTO profile FROM public.profile_details WHERE id = actor;
  IF NOT (coalesce(profile.role IN ('teacher','admin'),false) OR card.level = ANY(coalesce(profile.allowed_levels,ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'level_access_denied' USING ERRCODE = '42501';
  END IF;
  IF NOT trainer_access_private.unit_allowed(card.level,'vocabulary',card.lesson) OR p_ui_language='de' THEN
    RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501';
  END IF;
  IF progress.box_number = 7 OR progress.next_review_date > now() THEN
    RAISE EXCEPTION 'review_not_due' USING ERRCODE = '40001';
  END IF;
  SELECT last_card_id INTO previous_card FROM public.vocabulary_learning_state WHERE user_id = actor;
  IF previous_card = progress.card_id THEN
    RAISE EXCEPTION 'vocabulary_spacing_required' USING ERRCODE = '40001';
  END IF;
  prompt := CASE p_ui_language WHEN 'de' THEN card.context_sentence_de WHEN 'en' THEN card.context_sentence_en
    WHEN 'ru' THEN card.context_sentence_ru WHEN 'uk' THEN card.context_sentence_uk WHEN 'tr' THEN card.context_sentence_tr END;
  sentence := card.sentence_practice AND progress.direction = 'native_to_de';
  IF sentence AND (nullif(btrim(prompt),'') IS NULL OR nullif(btrim(card.context_sentence_de),'') IS NULL) THEN
    RAISE EXCEPTION 'sentence_content_missing' USING ERRCODE='23514';
  END IF;
  IF sentence THEN
    -- Byte-exact comparison: no trimming, case folding, punctuation removal or client grading.
    correct := coalesce(convert_to(p_typed_answer,'UTF8') = convert_to(card.context_sentence_de,'UTF8'),false);
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
  difficult := CASE profile.native_language WHEN 'Russisch' THEN coalesce(card.is_hard_for_ru,false)
    WHEN 'Türkisch' THEN coalesce(card.is_hard_for_tr,false) ELSE false END;
  IF difficult THEN days := greatest(1,days/2); END IF;
  UPDATE public.vocabulary_direction_progress SET box_number=new_box,next_review_date=now()+make_interval(days=>days),
    lapses=lapses+CASE WHEN NOT correct THEN 1 ELSE 0 END,last_answered_at=now(),updated_at=now()
    WHERE id = progress.id;
  INSERT INTO public.vocabulary_learning_state(user_id,last_card_id,last_reviewed_at)
    VALUES(actor,progress.card_id,now()) ON CONFLICT(user_id) DO UPDATE
    SET last_card_id=excluded.last_card_id,last_reviewed_at=excluded.last_reviewed_at;
  RETURN jsonb_build_object('success',true,'isCorrect',correct,'previousPhase',old_phase,'newPhase',new_phase,
    'becameLearned',new_box=7,'movedBack',new_phase<old_phase,'intervalInDays',days)
    || CASE WHEN sentence THEN jsonb_build_object('correctAnswer',card.context_sentence_de,'isAlternative',is_alternative) ELSE '{}'::jsonb END;
END;
$function$
;

CREATE OR REPLACE FUNCTION vocabulary_private.submit_answer_once(p_request_id uuid, p_progress_id uuid, p_is_correct boolean, p_typed_answer text, p_ui_language text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  IF NOT EXISTS (SELECT 1 FROM public.vocabulary_direction_progress v JOIN public.vocabulary_cards c ON c.id=v.card_id
    WHERE v.id=p_progress_id AND v.user_id=actor AND trainer_access_private.unit_allowed(c.level,'vocabulary',c.lesson)) THEN
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
$function$
;

CREATE OR REPLACE FUNCTION trainer_access_private.can_record()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND
 (p.role IN('teacher','admin') OR EXISTS(SELECT 1 FROM public.learning_units u WHERE u.trainer='pronunciation'
 AND trainer_access_private.unit_allowed(u.level,u.trainer,u.id::text))));
$$;
CREATE OR REPLACE FUNCTION learning_reset_private.matches_audio(p_reference text,p_bucket text,p_name text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(p_reference='storage://' || p_bucket || '/' || p_name,false);
$$;
-- Empty legacy progress is replaced by one non-null directional state per word and learner.
ALTER TABLE public.vocabulary_direction_progress ALTER COLUMN box_number SET NOT NULL, ALTER COLUMN next_review_date SET NOT NULL;
CREATE OR REPLACE FUNCTION vocabulary_private.reset_lesson(p_level text,p_lesson text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); BEGIN
 IF actor IS NULL OR NOT trainer_access_private.unit_allowed(p_level,'vocabulary',p_lesson) THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 DELETE FROM public.vocabulary_direction_progress v USING public.vocabulary_cards c
 WHERE v.user_id=actor AND v.card_id=c.id AND c.level=p_level AND c.lesson=p_lesson;
END $$;
CREATE FUNCTION learning_private.reset_student_level(p_student_id uuid,p_level text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF auth.uid() IS NULL OR coalesce(monthly_booking_private.current_profile_role(),'') NOT IN('teacher','admin') THEN RAISE EXCEPTION 'Staff required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.learning_levels WHERE code=p_level) OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_student_id) THEN RAISE EXCEPTION 'Invalid learner/level' USING ERRCODE='23514'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||p_student_id::text,0));
 DELETE FROM public.vocabulary_direction_progress p USING public.vocabulary_cards c WHERE p.card_id=c.id AND p.user_id=p_student_id AND c.level=p_level;
 DELETE FROM public.user_exercise_progress p USING public.exercises e WHERE p.exercise_id=e.id AND p.user_id=p_student_id AND e.level=p_level;
 DELETE FROM public.vocabulary_onboarding WHERE user_id=p_student_id AND level=p_level;
 UPDATE public.vocabulary_learning_state SET last_card_id=NULL WHERE user_id=p_student_id AND last_card_id IN(SELECT id FROM public.vocabulary_cards WHERE level=p_level);
END $$;
CREATE FUNCTION public.reset_student_level_progress(p_student_id uuid,p_level text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT learning_private.reset_student_level(p_student_id,p_level); $$;
REVOKE ALL ON FUNCTION learning_private.reset_student_level(uuid,text),public.reset_student_level_progress(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION learning_private.reset_student_level(uuid,text),public.reset_student_level_progress(uuid,text) TO authenticated;

-- Rebind surviving learner policies explicitly: prior business-column CASCADEs
-- must not leave a half-working set of storage/progress permissions behind.
DO $$ DECLARE p record; tab text; BEGIN
 FOR p IN SELECT tablename,policyname FROM pg_policies WHERE schemaname='public' AND tablename IN
 ('vocabulary_direction_progress','user_exercise_progress','vocabulary_learning_state','vocabulary_onboarding','submissions','pronunciation_messages') LOOP
  EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename);
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['vocabulary_direction_progress','user_exercise_progress','vocabulary_learning_state','vocabulary_onboarding','submissions','pronunciation_messages'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',tab);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',tab);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',tab);
 END LOOP;
END $$;
CREATE POLICY vocabulary_progress_read ON public.vocabulary_direction_progress FOR SELECT TO authenticated USING(
 (SELECT monthly_booking_private.current_profile_role()) IN('teacher','admin') OR(user_id=(SELECT auth.uid()) AND
 EXISTS(SELECT 1 FROM public.learning_vocabulary_cards c WHERE c.id=card_id AND learning_private.unit_allowed(c.unit_id))));
CREATE POLICY grammar_progress_read ON public.user_exercise_progress FOR SELECT TO authenticated USING(
 (SELECT monthly_booking_private.current_profile_role()) IN('teacher','admin') OR(user_id=(SELECT auth.uid()) AND
 EXISTS(SELECT 1 FROM public.learning_exercises e WHERE e.id=exercise_id AND learning_private.unit_allowed(e.unit_id))));
CREATE POLICY vocabulary_state_read ON public.vocabulary_learning_state FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY vocabulary_onboarding_read ON public.vocabulary_onboarding FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY pronunciation_threads_read ON public.submissions FOR SELECT TO authenticated USING(pronunciation_private.can_access_submission(id));
CREATE POLICY pronunciation_messages_read ON public.pronunciation_messages FOR SELECT TO authenticated USING(pronunciation_private.can_access_submission(submission_id));
GRANT INSERT ON public.pronunciation_messages TO authenticated;
CREATE POLICY pronunciation_messages_send ON public.pronunciation_messages FOR INSERT TO authenticated
 WITH CHECK(sender_id=(SELECT auth.uid()) AND pronunciation_private.can_access_submission(submission_id));

UPDATE storage.buckets SET public=false WHERE id IN('pronunciation_audio','audio_submissions');
DROP POLICY IF EXISTS "Authentifizierte Nutzer können Audio aktualisieren" ON storage.objects;
DROP POLICY IF EXISTS "Authentifizierte Nutzer können Audio hochladen" ON storage.objects;
DROP POLICY IF EXISTS "Jeder darf Audio abrufen" ON storage.objects;
DROP POLICY IF EXISTS "Pronunciation owners upload" ON storage.objects;
DROP POLICY IF EXISTS "Pronunciation participants listen" ON storage.objects;
DROP POLICY IF EXISTS trainer_audio_read_guard ON storage.objects;
DROP POLICY IF EXISTS trainer_audio_upload_guard ON storage.objects;
CREATE FUNCTION learning_private.audio_readable(p_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND CASE
 WHEN (SELECT monthly_booking_private.current_profile_role()) IN('teacher','admin') THEN true
 WHEN EXISTS(SELECT 1 FROM public.submissions WHERE content_url='storage://pronunciation_audio/'||p_name)
   OR EXISTS(SELECT 1 FROM public.pronunciation_messages WHERE audio_path='storage://pronunciation_audio/'||p_name)
 THEN EXISTS(SELECT 1 FROM public.submissions s WHERE s.content_url='storage://pronunciation_audio/'||p_name AND pronunciation_private.can_access_submission(s.id))
   OR EXISTS(SELECT 1 FROM public.pronunciation_messages m WHERE m.audio_path='storage://pronunciation_audio/'||p_name AND pronunciation_private.can_access_submission(m.submission_id))
 ELSE split_part(p_name,'/',1)=(SELECT auth.uid())::text AND trainer_access_private.can_record() END;
$$;
REVOKE ALL ON FUNCTION learning_private.audio_readable(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION learning_private.audio_readable(text) TO authenticated;
CREATE POLICY normalized_audio_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='pronunciation_audio' AND learning_private.audio_readable(name));
CREATE POLICY normalized_audio_upload ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='pronunciation_audio' AND trainer_access_private.can_record()
 AND name ~ ('^'||(SELECT auth.uid())::text||'/[0-9a-f-]{36}\.(webm|mp4|ogg|wav|mp3)$'));
-- Restrictive bounds also neutralize any unrelated old permissive recording policy.
CREATE POLICY private_recording_read_bounds ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
 USING(bucket_id NOT IN('pronunciation_audio','audio_submissions') OR
 (bucket_id='pronunciation_audio' AND (learning_private.audio_readable(name) OR learning_reset_private.can_remove_audio(id))));
CREATE POLICY anonymous_recording_read_bounds ON storage.objects AS RESTRICTIVE FOR SELECT TO anon
 USING(bucket_id NOT IN('pronunciation_audio','audio_submissions'));
CREATE POLICY private_recording_insert_bounds ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(bucket_id NOT IN('pronunciation_audio','audio_submissions') OR
 (bucket_id='pronunciation_audio' AND trainer_access_private.can_record()
 AND name ~ ('^'||(SELECT auth.uid())::text||'/[0-9a-f-]{36}\.(webm|mp4|ogg|wav|mp3)$')));
CREATE POLICY private_recording_immutable ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(bucket_id NOT IN('pronunciation_audio','audio_submissions')) WITH CHECK(bucket_id NOT IN('pronunciation_audio','audio_submissions'));
CREATE POLICY private_recording_delete_bounds ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING(bucket_id NOT IN('pronunciation_audio','audio_submissions') OR(bucket_id='pronunciation_audio' AND learning_reset_private.can_remove_audio(id)));

-- Cache links from the retired backend cannot be played on this VPS. Authored
-- words/texts stay unchanged and the local speech engine recreates audio on demand.
UPDATE public.learning_vocabulary_cards SET audio_url=NULL WHERE audio_url ~* '^https?://[^/]*\.supabase\.co(/|$)';
UPDATE public.learning_vocabulary_cards SET image_url=NULL WHERE image_url ~* '^https?://[^/]*\.supabase\.co(/|$)';
UPDATE public.learning_exercises SET solution_audio_url=NULL WHERE solution_audio_url ~* '^https?://[^/]*\.supabase\.co(/|$)';
UPDATE public.learning_reading_texts SET audio_url=NULL WHERE audio_url ~* '^https?://[^/]*\.supabase\.co(/|$)';

CREATE OR REPLACE FUNCTION learning_reset_private.begin_reset(p_confirmation text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
CREATE OR REPLACE FUNCTION learning_reset_private.finish_reset(p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
 UPDATE public.submissions SET parent_id=NULL WHERE user_id<>actor AND parent_id IN(SELECT id FROM public.submissions WHERE user_id=actor);
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

-- The public progress façade is read-only. All grading writes the directional table.
REVOKE ALL ON public.user_vocabulary_progress FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.user_vocabulary_progress TO authenticated,service_role;
-- Catalog migration must retain identities and authored German text.
DO $$ DECLARE before_count integer; after_count integer; BEGIN
 SELECT count(*) INTO before_count FROM learning_catalog_before;
 SELECT (SELECT count(*) FROM public.vocabulary_cards)+(SELECT count(*) FROM public.exercises)
 +(SELECT count(*) FROM public.pronunciation_prompts)+(SELECT count(*) FROM public.videos) INTO after_count;
 IF before_count<>after_count THEN RAISE EXCEPTION 'Catalog count mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM learning_catalog_before b LEFT JOIN public.vocabulary_cards c ON c.id=b.id
 WHERE b.trainer='vocabulary' AND (c.id IS NULL OR c.word_de IS DISTINCT FROM b.payload->>'word_de'))
 OR EXISTS(SELECT 1 FROM learning_catalog_before b LEFT JOIN public.pronunciation_prompts p ON p.id=b.id
 WHERE b.trainer='pronunciation' AND (p.id IS NULL OR p.sentence_de IS DISTINCT FROM b.payload->>'sentence_de')) THEN
 RAISE EXCEPTION 'Catalog identity/content mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM learning_catalog_before b JOIN public.vocabulary_cards c ON c.id=b.id,
  unnest(ARRAY['translation_en','translation_ru','translation_uk','translation_tr','context_sentence_de','context_sentence_en','context_sentence_ru','context_sentence_uk','context_sentence_tr']) field
  WHERE b.trainer='vocabulary' AND (to_jsonb(c)->>field) IS DISTINCT FROM (b.payload->>field)) THEN
  RAISE EXCEPTION 'Vocabulary translation/context preservation failed'; END IF;
 IF EXISTS(SELECT 1 FROM learning_catalog_before b LEFT JOIN public.learning_exercises e ON e.id=b.id
  WHERE b.trainer='exercises' AND (e.id IS NULL OR e.content IS DISTINCT FROM ((b.payload->'content')-'smart_hint'-'explanation'))) THEN
  RAISE EXCEPTION 'Authored grammar content preservation failed'; END IF;
END $$;
NOTIFY pgrst,'reload schema';

-- Retire the former external mail HTTP schedules, including their embedded keys.
SELECT cron.unschedule(jobid) FROM cron.job WHERE command ~* 'supabase[.]co';

-- Local infrastructure helpers, independent of the public learning catalog.
CREATE SCHEMA IF NOT EXISTS platform_private;
REVOKE ALL ON SCHEMA platform_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA platform_private TO service_role;

CREATE TABLE platform_private.rate_limits (
  key_hash text PRIMARY KEY CHECK(length(key_hash)=64),
  count integer NOT NULL CHECK(count>0),
  expires_at timestamptz NOT NULL
);
ALTER TABLE platform_private.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON platform_private.rate_limits FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON platform_private.rate_limits TO service_role;
CREATE INDEX rate_limits_expiration_idx ON platform_private.rate_limits(expires_at);

CREATE FUNCTION public.consume_rate_limit(p_key text,p_limit integer,p_window_seconds integer)
RETURNS TABLE(success boolean,remaining integer,reset_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
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
$$;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text,integer,integer) TO service_role;

-- This job executes only local SQL. No HTTP callback or cloud key is involved.
SELECT cron.schedule('sitov-rate-limit-cleanup','17 * * * *',
  'DELETE FROM platform_private.rate_limits WHERE expires_at < now() - interval ''1 hour''');

-- The normalized business RPCs replaced these old-table wrappers. Keep the
-- current_profile_role and validate_teacher_note helpers used by learning RLS.
-- RESTRICT is intentional: an unexpected live dependency must stop deployment.
DROP FUNCTION IF EXISTS public.confirm_staff_registration(text,uuid);
DROP FUNCTION IF EXISTS public.set_manual_invoice_status(text,uuid,date,boolean,text);
DROP FUNCTION IF EXISTS monthly_booking_private.confirm_staff_registration(text,uuid);
DROP FUNCTION IF EXISTS monthly_booking_private.set_manual_invoice_status(text,uuid,date,boolean,text);
DROP FUNCTION IF EXISTS monthly_booking_private.claim_verified_legacy_profile();
DROP FUNCTION IF EXISTS monthly_booking_private.validate_booking();
DROP FUNCTION IF EXISTS monthly_booking_private.sync_booking_courses();
DROP FUNCTION IF EXISTS monthly_booking_private.sync_confirmed_profile_email();
DROP TABLE IF EXISTS monthly_booking_private.booking_courses;
DROP TABLE IF EXISTS monthly_booking_private.profile_contact_migration_audit;
ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_id_fkey;
COMMIT;
