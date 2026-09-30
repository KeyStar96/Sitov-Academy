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
