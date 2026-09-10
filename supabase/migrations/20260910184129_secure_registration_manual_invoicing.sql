BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Keep submitted contact details separate from the established student record.
-- Public registration must never change an existing person's identity.
ALTER TABLE public.registrations ADD COLUMN contact_snapshot jsonb;
ALTER TABLE public.registrations ADD CONSTRAINT registrations_contact_snapshot_object
  CHECK (contact_snapshot IS NULL OR jsonb_typeof(contact_snapshot) = 'object');

-- All public enrollment writes already go through a rate-limited server action.
-- Direct anonymous writes could bypass pending status and consent validation.
DROP POLICY IF EXISTS "Anyone can insert registration" ON public.registrations;
DROP POLICY IF EXISTS "Anyone can insert enrollments" ON public.enrollments;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.registrations, public.enrollments, public.users FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS users_normalized_email_idx ON public.users (lower(btrim(email)));
CREATE INDEX IF NOT EXISTS registrations_status_start_idx ON public.registrations(status, start_date);

-- No email/name argument is accepted. Auth confirms email ownership, and the
-- association is saved atomically so later email changes cannot claim a second
-- person. Shared addresses and an already claimed legacy record stay unlinked.
CREATE FUNCTION monthly_booking_private.claim_verified_legacy_profile()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid();
  verified_email text;
  existing_link uuid;
  candidate uuid;
  matches integer;
  person public.users;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT lower(btrim(email)) INTO verified_email FROM auth.users
    WHERE id = actor AND email_confirmed_at IS NOT NULL;
  IF verified_email IS NULL THEN RETURN jsonb_build_object('id', NULL, 'unresolved', false); END IF;
  SELECT legacy_user_id INTO existing_link FROM public.profiles WHERE id = actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile missing' USING ERRCODE = '42501'; END IF;
  IF existing_link IS NOT NULL THEN RETURN jsonb_build_object('id', existing_link, 'unresolved', false); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('legacy-email:' || verified_email, 0));
  SELECT count(*), (array_agg(id))[1] INTO matches, candidate FROM public.users WHERE lower(btrim(email)) = verified_email;
  IF matches <> 1 THEN RETURN jsonb_build_object('id', NULL, 'unresolved', matches > 1); END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE legacy_user_id = candidate AND id <> actor) THEN
    RETURN jsonb_build_object('id', NULL, 'unresolved', true);
  END IF;
  SELECT * INTO person FROM public.users WHERE id = candidate;
  UPDATE public.profiles SET legacy_user_id = candidate,
    name = btrim(person.first_name || ' ' || person.last_name),
    phone = coalesce(phone, person.phone), street = coalesce(street, person.street),
    zip_code = coalesce(zip_code, person.zip), city = coalesce(city, person.city), updated_at = now()
    WHERE id = actor AND legacy_user_id IS NULL;
  RETURN jsonb_build_object('id', candidate, 'unresolved', false);
END $$;
REVOKE ALL ON FUNCTION monthly_booking_private.claim_verified_legacy_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION monthly_booking_private.claim_verified_legacy_profile() TO authenticated;
CREATE FUNCTION public.claim_verified_legacy_profile() RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT monthly_booking_private.claim_verified_legacy_profile();
$$;
REVOKE ALL ON FUNCTION public.claim_verified_legacy_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_verified_legacy_profile() TO authenticated;

CREATE TABLE public.manual_invoice_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid REFERENCES public.registrations(id) ON DELETE RESTRICT,
  monthly_booking_id uuid REFERENCES public.monthly_course_bookings(id) ON DELETE RESTRICT,
  target_month date NOT NULL CHECK (extract(day FROM target_month) = 1),
  status text NOT NULL DEFAULT 'outstanding' CHECK (status IN ('outstanding', 'created')),
  invoice_reference text CHECK (char_length(invoice_reference) <= 120),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  invoice_created_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(registration_id, monthly_booking_id) = 1),
  CHECK ((status = 'created') = (invoice_created_at IS NOT NULL))
);
CREATE UNIQUE INDEX manual_invoice_registration_month_idx ON public.manual_invoice_status(registration_id, target_month) WHERE registration_id IS NOT NULL;
CREATE UNIQUE INDEX manual_invoice_booking_month_idx ON public.manual_invoice_status(monthly_booking_id, target_month) WHERE monthly_booking_id IS NOT NULL;
CREATE INDEX manual_invoice_month_status_idx ON public.manual_invoice_status(target_month, status);
CREATE INDEX manual_invoice_created_by_idx ON public.manual_invoice_status(created_by);
ALTER TABLE public.manual_invoice_status ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.manual_invoice_status FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.manual_invoice_status TO authenticated;
GRANT ALL ON public.manual_invoice_status TO service_role;
CREATE POLICY "Staff read manual invoice status" ON public.manual_invoice_status FOR SELECT TO authenticated
  USING ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin'));

CREATE FUNCTION monthly_booking_private.confirm_staff_registration(p_source text, p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE current_status text;
BEGIN
  IF auth.uid() IS NULL OR coalesce(monthly_booking_private.current_profile_role(), '') NOT IN ('teacher', 'admin') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_source = 'registration' THEN
    SELECT status INTO current_status FROM public.registrations WHERE id = p_id FOR UPDATE;
    IF current_status = 'pending' THEN UPDATE public.registrations SET status = 'confirmed' WHERE id = p_id; END IF;
  ELSIF p_source = 'monthly_booking' THEN
    SELECT status INTO current_status FROM public.monthly_course_bookings WHERE id = p_id FOR UPDATE;
    IF current_status = 'pending' THEN UPDATE public.monthly_course_bookings SET status = 'confirmed' WHERE id = p_id; END IF;
  ELSE RAISE EXCEPTION 'Invalid source' USING ERRCODE = '23514';
  END IF;
  IF current_status IS NULL THEN RAISE EXCEPTION 'Not found' USING ERRCODE = 'P0002'; END IF;
  IF current_status NOT IN ('pending', 'confirmed') THEN RAISE EXCEPTION 'Registration changed' USING ERRCODE = '40001'; END IF;
  RETURN jsonb_build_object('status', 'confirmed');
END $$;
REVOKE ALL ON FUNCTION monthly_booking_private.confirm_staff_registration(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION monthly_booking_private.confirm_staff_registration(text, uuid) TO authenticated;
CREATE FUNCTION public.confirm_staff_registration(p_source text, p_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT monthly_booking_private.confirm_staff_registration(p_source, p_id); $$;
REVOKE ALL ON FUNCTION public.confirm_staff_registration(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_staff_registration(text, uuid) TO authenticated;

CREATE FUNCTION monthly_booking_private.set_manual_invoice_status(p_source text, p_id uuid, p_month date, p_created boolean, p_reference text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE saved public.manual_invoice_status; current_status text; source_month date;
BEGIN
  IF auth.uid() IS NULL OR coalesce(monthly_booking_private.current_profile_role(), '') NOT IN ('teacher', 'admin') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_month IS NULL OR extract(day FROM p_month) <> 1 OR p_created IS NULL OR char_length(p_reference) > 120 THEN
    RAISE EXCEPTION 'Invalid input' USING ERRCODE = '23514';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('invoice:' || p_source || ':' || p_id::text || ':' || p_month::text, 0));
  IF p_source = 'registration' THEN
    SELECT status, date_trunc('month', start_date)::date INTO current_status, source_month FROM public.registrations WHERE id = p_id FOR SHARE;
    IF p_month < source_month THEN RAISE EXCEPTION 'Invalid month' USING ERRCODE = '23514'; END IF;
  ELSIF p_source = 'monthly_booking' THEN
    SELECT status, target_month INTO current_status, source_month FROM public.monthly_course_bookings WHERE id = p_id FOR SHARE;
    IF p_month IS DISTINCT FROM source_month THEN RAISE EXCEPTION 'Invalid month' USING ERRCODE = '23514'; END IF;
  ELSE RAISE EXCEPTION 'Invalid source' USING ERRCODE = '23514';
  END IF;
  IF current_status IS DISTINCT FROM 'confirmed' AND p_created THEN
    RAISE EXCEPTION 'Booking not confirmed' USING ERRCODE = '40001';
  END IF;
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
REVOKE ALL ON FUNCTION monthly_booking_private.set_manual_invoice_status(text, uuid, date, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION monthly_booking_private.set_manual_invoice_status(text, uuid, date, boolean, text) TO authenticated;
CREATE FUNCTION public.set_manual_invoice_status(p_source text, p_id uuid, p_month date, p_created boolean, p_reference text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
 SELECT monthly_booking_private.set_manual_invoice_status(p_source, p_id, p_month, p_created, p_reference);
$$;
REVOKE ALL ON FUNCTION public.set_manual_invoice_status(text, uuid, date, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_manual_invoice_status(text, uuid, date, boolean, text) TO authenticated;
COMMIT;
