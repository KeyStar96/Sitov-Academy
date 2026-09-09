-- Additive migration; apply once as postgres, before deploying the new actions.
-- Existing users/registrations/enrollments and text course IDs are retained.
-- All changes roll back together on failure. Do not replay older migrations.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE SCHEMA monthly_booking_private;
REVOKE ALL ON SCHEMA monthly_booking_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA monthly_booking_private TO authenticated, service_role;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS city text;

-- users.id is NOT an auth ID. Match only a unique person/contact and a unique
-- verified, current auth email. Shared family emails must be reviewed manually.
-- Snapshot every source contact, even if no auth account exists. Nothing is
-- deleted or trimmed in the source values, and existing profile values win.
LOCK TABLE public.users IN SHARE MODE;
CREATE TABLE monthly_booking_private.profile_contact_migration_audit (
  source_user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  source_contact jsonb NOT NULL,
  profile_contact_before jsonb,
  result text NOT NULL CHECK (result IN (
    'no_verified_profile', 'ambiguous_profile', 'ambiguous_legacy',
    'conflicting_profile', 'copied'
  )),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX profile_contact_migration_audit_profile_idx
  ON monthly_booking_private.profile_contact_migration_audit(profile_id);
ALTER TABLE monthly_booking_private.profile_contact_migration_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON monthly_booking_private.profile_contact_migration_audit FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON monthly_booking_private.profile_contact_migration_audit TO service_role;

INSERT INTO monthly_booking_private.profile_contact_migration_audit
  (source_user_id, profile_id, source_contact, profile_contact_before, result)
SELECT u.id, p.id,
  jsonb_build_object('phone', u.phone, 'street', u.street, 'zip_code', u.zip, 'city', u.city),
  CASE WHEN p.id IS NOT NULL THEN
    jsonb_build_object('phone', p.phone, 'street', p.street, 'zip_code', p.zip_code, 'city', p.city)
  END,
  CASE
    WHEN candidates.n = 0 THEN 'no_verified_profile'
    WHEN candidates.n > 1 THEN 'ambiguous_profile'
    WHEN legacy.n > 1 THEN 'ambiguous_legacy'
    WHEN (p.phone IS NOT NULL AND u.phone IS NOT NULL AND p.phone <> u.phone)
      OR (p.street IS NOT NULL AND u.street IS NOT NULL AND p.street <> u.street)
      OR (p.zip_code IS NOT NULL AND u.zip IS NOT NULL AND p.zip_code <> u.zip)
      OR (p.city IS NOT NULL AND u.city IS NOT NULL AND p.city <> u.city)
      THEN 'conflicting_profile'
    ELSE 'copied'
  END
FROM public.users u
CROSS JOIN LATERAL (
  SELECT count(*) AS n, (array_agg(pr.id ORDER BY pr.id))[1] AS profile_id
  FROM public.profiles pr JOIN auth.users au ON au.id = pr.id
  WHERE lower(btrim(au.email)) = lower(btrim(u.email))
    AND lower(btrim(pr.email)) = lower(btrim(au.email))
    AND btrim(u.email) <> '' AND au.email_confirmed_at IS NOT NULL
) candidates
CROSS JOIN LATERAL (
  -- Identical duplicate records for the SAME person can be copied safely.
  SELECT count(DISTINCT (u2.first_name, u2.last_name, u2.birth_date,
    u2.phone, u2.street, u2.zip, u2.city)) AS n
  FROM public.users u2 WHERE lower(btrim(u2.email)) = lower(btrim(u.email))
) legacy
LEFT JOIN public.profiles p ON p.id = candidates.profile_id AND candidates.n = 1;

UPDATE public.profiles p
SET phone = coalesce(p.phone, a.source_contact->>'phone'),
    street = coalesce(p.street, a.source_contact->>'street'),
    zip_code = coalesce(p.zip_code, a.source_contact->>'zip_code'),
    city = coalesce(p.city, a.source_contact->>'city')
FROM monthly_booking_private.profile_contact_migration_audit a
WHERE a.profile_id = p.id AND a.result = 'copied';

DO $$
DECLARE pending_count bigint;
BEGIN
  SELECT count(*) INTO pending_count
  FROM monthly_booking_private.profile_contact_migration_audit WHERE result <> 'copied';
  RAISE NOTICE '% legacy contacts retained for review in monthly_booking_private.profile_contact_migration_audit', pending_count;
END $$;

-- Preserve nullable legacy roles. Widen the known constraint without changing
-- existing values. Unexpected role constraints fail validation; never drop
-- unrelated checks dynamically.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'teacher', 'admin')) NOT VALID;
ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_role_check;

-- The self-referential profile UPDATE policy must not recurse. This narrowly
-- scoped lookup reads only the caller's DB role, never user-editable JWT metadata.
CREATE FUNCTION monthly_booking_private.current_profile_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT p.role FROM public.profiles p
  WHERE p.id = (SELECT auth.uid()) AND (SELECT auth.uid()) IS NOT NULL
$$;
REVOKE ALL ON FUNCTION monthly_booking_private.current_profile_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION monthly_booking_private.current_profile_role() TO authenticated;

-- RLS limits rows, not columns: prevent self-promotion and billing/level edits
-- through REST. The existing trusted service-role actions retain their grants.
REVOKE ALL ON public.profiles FROM PUBLIC, anon, authenticated;
DO $$
DECLARE col record;
BEGIN
  FOR col IN SELECT attname FROM pg_attribute
    WHERE attrelid = 'public.profiles'::regclass AND attnum > 0 AND NOT attisdropped
  LOOP
    EXECUTE format('REVOKE INSERT (%I), UPDATE (%I), REFERENCES (%I) ON public.profiles FROM PUBLIC, anon, authenticated', col.attname, col.attname, col.attname);
  END LOOP;
END $$;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (name, native_language, ui_language, phone, street, zip_code, city)
  ON public.profiles TO authenticated;
DROP POLICY IF EXISTS "Admins und Lehrer können Profile updaten" ON public.profiles;
CREATE POLICY "Admins und Lehrer können Profile updaten" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin'))
  WITH CHECK ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin'));
ALTER POLICY "Benutzer können eigenes Profil aktualisieren" ON public.profiles
  TO authenticated USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id);
ALTER POLICY "Benutzer können eigenes Profil sehen" ON public.profiles
  TO authenticated USING ((SELECT auth.uid()) = id);
CREATE POLICY "Staff can read profiles" ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin'));

-- Previously teacher-only policies also accept admin, keeping author ownership.
ALTER POLICY "Lehrer sehen alle Submissions" ON public.submissions TO authenticated
  USING ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin'));
ALTER POLICY "Lehrer können Submissions updaten" ON public.submissions TO authenticated
  USING ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin'))
  WITH CHECK ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin'));
ALTER POLICY "Lehrer sehen alle Feedbacks" ON public.teacher_feedback TO authenticated
  USING ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin'));
ALTER POLICY "Lehrer können Feedback erstellen" ON public.teacher_feedback TO authenticated
  WITH CHECK ((SELECT auth.uid()) = teacher_id
    AND (SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin'));

-- Stable additional key: existing courses.id text and all its FKs stay intact.
ALTER TABLE public.courses ADD COLUMN booking_id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.courses ADD CONSTRAINT courses_booking_id_key UNIQUE (booking_id);
COMMENT ON COLUMN public.courses.booking_id IS 'Stable UUID used by monthly_course_bookings.course_ids; legacy id remains unchanged.';

CREATE TABLE public.monthly_course_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_month date NOT NULL,
  course_ids uuid[] NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  CONSTRAINT monthly_course_bookings_user_month_key UNIQUE (user_id, target_month),
  CONSTRAINT monthly_course_bookings_month_check CHECK (
    isfinite(target_month) AND target_month >= DATE '0001-01-01'
    AND target_month <= DATE '9999-12-01' AND extract(day FROM target_month) = 1
  ),
  CONSTRAINT monthly_course_bookings_courses_check CHECK (
    cardinality(course_ids) BETWEEN 1 AND 100 AND array_ndims(course_ids) = 1
    AND array_lower(course_ids, 1) = 1 AND array_position(course_ids, NULL) IS NULL
  )
);
CREATE INDEX monthly_course_bookings_month_idx ON public.monthly_course_bookings(target_month);
ALTER TABLE public.monthly_course_bookings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.monthly_course_bookings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_course_bookings TO authenticated;
GRANT ALL ON public.monthly_course_bookings TO service_role;
CREATE POLICY "Own bookings or admin" ON public.monthly_course_bookings
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT monthly_booking_private.current_profile_role()) = 'admin')
  WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT monthly_booking_private.current_profile_role()) = 'admin');

-- PostgreSQL cannot attach an FK to each array element. A private projection,
-- maintained in the SAME transaction, supplies real FKs (also under concurrency).
-- It prevents deletion/rekeying of a course still referenced by any booking.
CREATE TABLE monthly_booking_private.booking_courses (
  booking_id uuid NOT NULL REFERENCES public.monthly_course_bookings(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(booking_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  PRIMARY KEY (booking_id, course_id)
);
CREATE INDEX booking_courses_course_idx ON monthly_booking_private.booking_courses(course_id);
ALTER TABLE monthly_booking_private.booking_courses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON monthly_booking_private.booking_courses FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION monthly_booking_private.validate_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.id <> OLD.id OR NEW.user_id <> OLD.user_id) THEN
    RAISE EXCEPTION 'Booking identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF cardinality(NEW.course_ids) <> (SELECT count(DISTINCT c) FROM unnest(NEW.course_ids) c) THEN
    RAISE EXCEPTION 'Course IDs must be unique and non-null' USING ERRCODE = '23514';
  END IF;
  -- Only admins (or trusted DB/service writers) can confirm a booking or edit
  -- its confirmed contents. Owners may cancel it, then resubmit as pending.
  IF current_user IN ('authenticated', 'anon')
    AND (SELECT monthly_booking_private.current_profile_role()) IS DISTINCT FROM 'admin' THEN
    IF NEW.status = 'confirmed' THEN
      RAISE EXCEPTION 'Only admins can confirm bookings' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.status = 'confirmed'
      AND (NEW.status <> 'cancelled' OR NEW.target_month <> OLD.target_month OR NEW.course_ids <> OLD.course_ids) THEN
      RAISE EXCEPTION 'A confirmed booking may only be cancelled' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION monthly_booking_private.validate_booking() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_monthly_course_booking BEFORE INSERT OR UPDATE ON public.monthly_course_bookings
  FOR EACH ROW EXECUTE FUNCTION monthly_booking_private.validate_booking();

CREATE FUNCTION monthly_booking_private.sync_booking_courses()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Trigger-only function: the parent write has already passed RLS. Check the
  -- caller again when a JWT is present; trusted service/SQL writes have no UID.
  IF auth.uid() IS NOT NULL AND auth.uid() <> NEW.user_id
    AND monthly_booking_private.current_profile_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  DELETE FROM monthly_booking_private.booking_courses WHERE booking_id = NEW.id;
  INSERT INTO monthly_booking_private.booking_courses (booking_id, course_id)
    SELECT NEW.id, c FROM unnest(NEW.course_ids) c;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION monthly_booking_private.sync_booking_courses() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER sync_monthly_course_booking_courses AFTER INSERT OR UPDATE OF course_ids ON public.monthly_course_bookings
  FOR EACH ROW EXECUTE FUNCTION monthly_booking_private.sync_booking_courses();

CREATE TABLE public.teacher_student_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  note_text text NOT NULL CHECK (char_length(btrim(note_text)) BETWEEN 1 AND 5000),
  discount_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100)
);
CREATE INDEX teacher_student_notes_student_idx ON public.teacher_student_notes(student_id);
CREATE INDEX teacher_student_notes_teacher_idx ON public.teacher_student_notes(teacher_id);
ALTER TABLE public.teacher_student_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.teacher_student_notes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_student_notes TO authenticated;
GRANT ALL ON public.teacher_student_notes TO service_role;
CREATE POLICY "Staff read notes" ON public.teacher_student_notes FOR SELECT TO authenticated
  USING ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin'));
CREATE POLICY "Staff insert notes as themselves" ON public.teacher_student_notes FOR INSERT TO authenticated
  WITH CHECK ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin')
    AND teacher_id = (SELECT auth.uid()));
CREATE POLICY "Staff update notes" ON public.teacher_student_notes FOR UPDATE TO authenticated
  USING ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin'))
  WITH CHECK ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin'));
CREATE POLICY "Staff delete notes" ON public.teacher_student_notes FOR DELETE TO authenticated
  USING ((SELECT monthly_booking_private.current_profile_role()) IN ('teacher', 'admin'));

CREATE FUNCTION monthly_booking_private.validate_teacher_note()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id <> OLD.id OR NEW.student_id <> OLD.student_id OR NEW.teacher_id <> OLD.teacher_id THEN
      RAISE EXCEPTION 'Note identity and authorship are immutable' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.student_id AND role = 'student')
      OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.teacher_id AND role IN ('teacher', 'admin')) THEN
      RAISE EXCEPTION 'Invalid student or teacher' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION monthly_booking_private.validate_teacher_note() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_teacher_student_note BEFORE INSERT OR UPDATE ON public.teacher_student_notes
  FOR EACH ROW EXECUTE FUNCTION monthly_booking_private.validate_teacher_note();

COMMIT;
