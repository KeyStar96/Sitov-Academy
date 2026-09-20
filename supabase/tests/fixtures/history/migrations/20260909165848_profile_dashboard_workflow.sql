-- Requires 20260909155919_monthly_bookings_teacher_notes.sql.
-- Adds atomic next-month selection, including a pause without courses.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Persist an established legacy identity independently of future email changes.
-- Ambiguous audit entries remain deliberately unlinked; only trusted server
-- code/SQL administrators may write this column (no browser UPDATE grant).
ALTER TABLE public.profiles ADD COLUMN legacy_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX profiles_legacy_user_idx ON public.profiles(legacy_user_id);
UPDATE public.profiles p SET legacy_user_id = a.source_user_id
FROM (
  SELECT DISTINCT ON (profile_id) profile_id, source_user_id
  FROM monthly_booking_private.profile_contact_migration_audit
  WHERE result = 'copied' AND profile_id IS NOT NULL ORDER BY profile_id, source_user_id
) a WHERE p.id = a.profile_id;

ALTER TABLE public.monthly_course_bookings DROP CONSTRAINT monthly_course_bookings_courses_check;
ALTER TABLE public.monthly_course_bookings ADD CONSTRAINT monthly_course_bookings_courses_check CHECK (
  (cardinality(course_ids) = 0 AND status = 'cancelled') OR
  (cardinality(course_ids) BETWEEN 1 AND 100 AND array_ndims(course_ids) = 1
    AND array_lower(course_ids, 1) = 1 AND array_position(course_ids, NULL) IS NULL)
);

-- SECURITY INVOKER: ownership still enforced by RLS. Clients cannot supply a
-- different owner or confirm bookings. Serialize first writes and compare the
-- last observed record to reject stale tabs instead of overwriting their data.
CREATE FUNCTION public.save_next_month_booking(
  p_target_month date,
  p_course_ids uuid[],
  p_paused boolean,
  p_expected_id uuid DEFAULT NULL,
  p_expected_course_ids uuid[] DEFAULT NULL,
  p_expected_status text DEFAULT NULL
) RETURNS public.monthly_course_bookings
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid();
  next_month date := (date_trunc('month', now() AT TIME ZONE 'Europe/Berlin') + interval '1 month')::date;
  existing public.monthly_course_bookings;
  saved public.monthly_course_bookings;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  IF p_target_month IS DISTINCT FROM next_month THEN
    RAISE EXCEPTION 'Month changed' USING ERRCODE = '22008';
  END IF;
  IF p_paused IS NULL OR p_course_ids IS NULL THEN
    RAISE EXCEPTION 'Invalid selection' USING ERRCODE = '23514';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text || ':' || next_month::text, 0));
  SELECT * INTO existing FROM public.monthly_course_bookings
    WHERE user_id = actor AND target_month = next_month FOR UPDATE;
  IF existing.id IS DISTINCT FROM p_expected_id OR
    (existing.id IS NOT NULL AND (existing.course_ids IS DISTINCT FROM p_expected_course_ids
      OR existing.status IS DISTINCT FROM p_expected_status)) THEN
    RAISE EXCEPTION 'Booking changed in another session' USING ERRCODE = '40001';
  END IF;

  -- Courses must run during the requested month. Existing unavailable choices
  -- may remain while pausing, but cannot be booked again as active selections.
  IF NOT p_paused AND EXISTS (
    SELECT 1 FROM unnest(p_course_ids) requested(id)
    LEFT JOIN public.courses c ON c.booking_id = requested.id
    WHERE c.id IS NULL OR c.start_date >= (next_month + interval '1 month')::date
      OR c.end_date < next_month
  ) THEN RAISE EXCEPTION 'Course unavailable' USING ERRCODE = '23514'; END IF;

  IF existing.id IS NOT NULL AND existing.course_ids = p_course_ids
    AND ((existing.status = 'cancelled') = p_paused) THEN RETURN existing; END IF;

  -- Existing confirmed bookings can be cancelled by their owner. Apply that
  -- transition and the replacement selection atomically under the row lock.
  IF existing.status = 'confirmed' THEN
    UPDATE public.monthly_course_bookings SET status = 'cancelled' WHERE id = existing.id;
  END IF;
  INSERT INTO public.monthly_course_bookings(user_id, target_month, course_ids, status)
  VALUES(actor, next_month, p_course_ids, CASE WHEN p_paused THEN 'cancelled' ELSE 'pending' END)
  ON CONFLICT (user_id, target_month) DO UPDATE
    SET course_ids = EXCLUDED.course_ids, status = EXCLUDED.status
  RETURNING * INTO saved;
  RETURN saved;
END $$;
REVOKE ALL ON FUNCTION public.save_next_month_booking(date, uuid[], boolean, uuid, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_next_month_booking(date, uuid[], boolean, uuid, uuid[], text) TO authenticated;

-- Profile email is an auth identity. Only copy it after GoTrue has actually
-- changed auth.users.email (secure email-change confirmations remain enabled).
-- This trigger never trusts client metadata and cannot be invoked as an RPC.
CREATE FUNCTION monthly_booking_private.sync_confirmed_profile_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> NEW.id THEN
    RAISE EXCEPTION 'Cannot change another user identity' USING ERRCODE = '42501';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email AND NEW.email IS NOT NULL THEN
    UPDATE public.profiles SET email = NEW.email, updated_at = now() WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION monthly_booking_private.sync_confirmed_profile_email() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER sync_confirmed_profile_email AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION monthly_booking_private.sync_confirmed_profile_email();

COMMIT;
