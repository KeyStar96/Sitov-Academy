-- Required booking inputs must not bypass comparisons through SQL NULL.
-- Existing bookings still require their exact revision; initial creation accepts NULL expected/revision.
BEGIN;
create or replace function business_private.replace_items(p_booking uuid,p_courses uuid[]) returns void
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
create or replace function business_private.save_month(p_month date,p_courses uuid[],p_paused boolean,p_expected uuid,p_revision integer) returns uuid
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
COMMIT;
