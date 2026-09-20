BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE OR REPLACE FUNCTION monthly_booking_private.set_manual_invoice_status(p_source text, p_id uuid, p_month date, p_created boolean, p_reference text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE saved public.manual_invoice_status; current_status text; source_month date; person_id uuid;
BEGIN
  IF auth.uid() IS NULL OR coalesce(monthly_booking_private.current_profile_role(), '') NOT IN ('teacher', 'admin') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_month IS NULL OR extract(day FROM p_month) <> 1 OR p_created IS NULL OR char_length(p_reference) > 120 THEN
    RAISE EXCEPTION 'Invalid input' USING ERRCODE = '23514';
  END IF;
  IF p_source = 'registration' THEN
    SELECT status, date_trunc('month', start_date)::date, user_id INTO current_status, source_month, person_id FROM public.registrations WHERE id = p_id FOR SHARE;
    IF p_month < source_month THEN RAISE EXCEPTION 'Invalid month' USING ERRCODE = '23514'; END IF;
  ELSIF p_source = 'monthly_booking' THEN
    SELECT b.status, b.target_month, coalesce(p.legacy_user_id, p.id) INTO current_status, source_month, person_id
      FROM public.monthly_course_bookings b JOIN public.profiles p ON p.id = b.user_id WHERE b.id = p_id FOR SHARE OF b;
    IF p_month IS DISTINCT FROM source_month THEN RAISE EXCEPTION 'Invalid month' USING ERRCODE = '23514'; END IF;
  ELSE RAISE EXCEPTION 'Invalid source' USING ERRCODE = '23514';
  END IF;
  IF current_status IS DISTINCT FROM 'confirmed' AND p_created THEN
    RAISE EXCEPTION 'Booking not confirmed' USING ERRCODE = '40001';
  END IF;
  IF person_id IS NULL THEN RAISE EXCEPTION 'Not found' USING ERRCODE = 'P0002'; END IF;
  -- Serialize by pupil and month, including when a new registration or monthly
  -- selection replaces a previously invoiced source. Staff can reopen the old
  -- label first; the same pupil must never accidentally appear twice as due.
  PERFORM pg_advisory_xact_lock(hashtextextended('invoice-person:' || person_id::text || ':' || p_month::text, 0));
  IF p_created AND EXISTS (
    SELECT 1 FROM public.manual_invoice_status i
    LEFT JOIN public.registrations r ON r.id = i.registration_id
    LEFT JOIN public.monthly_course_bookings b ON b.id = i.monthly_booking_id
    LEFT JOIN public.profiles p ON p.id = b.user_id
    WHERE i.target_month = p_month AND i.status = 'created'
      AND coalesce(r.user_id, p.legacy_user_id, p.id) = person_id
      AND ((p_source = 'registration' AND i.registration_id = p_id)
        OR (p_source = 'monthly_booking' AND i.monthly_booking_id = p_id)) IS NOT TRUE
  ) THEN RAISE EXCEPTION 'Invoice already recorded for this pupil and month' USING ERRCODE = '40001'; END IF;
  SELECT * INTO saved FROM public.manual_invoice_status WHERE target_month = p_month
    AND (CASE WHEN p_source = 'registration' THEN registration_id = p_id ELSE monthly_booking_id = p_id END) FOR UPDATE;
  IF saved.id IS NULL THEN
    INSERT INTO public.manual_invoice_status(registration_id, monthly_booking_id, target_month)
    VALUES(CASE WHEN p_source = 'registration' THEN p_id END, CASE WHEN p_source = 'monthly_booking' THEN p_id END, p_month)
    RETURNING * INTO saved;
  END IF;
  UPDATE public.manual_invoice_status SET status = CASE WHEN p_created THEN 'created' ELSE 'outstanding' END,
    invoice_reference = CASE WHEN p_created THEN nullif(btrim(p_reference), '') ELSE NULL END,
    created_by = CASE WHEN p_created THEN auth.uid() ELSE NULL END,
    invoice_created_at = CASE WHEN p_created THEN coalesce(saved.invoice_created_at, now()) ELSE NULL END, updated_at = now()
    WHERE id = saved.id RETURNING * INTO saved;
  RETURN to_jsonb(saved);
END $$;

COMMIT;
