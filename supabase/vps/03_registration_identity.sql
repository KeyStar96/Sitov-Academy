-- Phase 2.1: resolve verified registration identities after 02_identity_alignment.sql.
-- Run inside the migration runner transaction after a verified database/storage backup.
CREATE TABLE IF NOT EXISTS business_private.registration_identity_resolutions (
  auth_user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE business_private.registration_identity_resolutions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON business_private.registration_identity_resolutions FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION business_private.claim_person() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v_user auth.users; v_person public.people; v_candidate uuid; v_count integer;
BEGIN
  SELECT * INTO v_user FROM auth.users WHERE id=(SELECT auth.uid()) FOR SHARE;
  IF v_user.id IS NULL OR v_user.email_confirmed_at IS NULL OR nullif(v_user.email,'') IS NULL THEN
    RETURN jsonb_build_object('error','not_authenticated','message','A verified account is required.');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('claim-person:'||lower(v_user.email),0));
  -- Lock all matching business identities in stable order. FK inserts cannot
  -- race the booking-free check while the current person is locked FOR UPDATE.
  PERFORM 1 FROM public.people WHERE auth_user_id=v_user.id
    OR (auth_user_id IS NULL AND lower(email)=lower(v_user.email)) ORDER BY id FOR UPDATE;
  SELECT * INTO v_person FROM public.people WHERE auth_user_id=v_user.id;
  IF v_person.id IS NULL THEN
    RETURN jsonb_build_object('error','identity_missing','message','The account identity is missing.');
  END IF;
  -- A deliberate association must survive a later sibling registration using
  -- the same family email. It never authorizes another unclaimed person.
  IF EXISTS(SELECT 1 FROM business_private.registration_identity_resolutions
    WHERE auth_user_id=v_user.id AND person_id=v_person.id) THEN
    UPDATE public.people SET email=v_user.email,updated_at=now() WHERE id=v_person.id;
    RETURN jsonb_build_object('id',v_person.id,'unresolved',false);
  END IF;
  SELECT count(*),(array_agg(id ORDER BY id))[1] INTO v_count,v_candidate
    FROM public.people WHERE auth_user_id IS NULL AND lower(email)=lower(v_user.email);
  -- The anonymous candidate MAY have bookings: those are precisely what the
  -- verified learner is claiming. Only their fresh account person must be empty.
  IF v_count=1 AND NOT EXISTS(SELECT 1 FROM public.bookings WHERE person_id=v_person.id)
    AND NOT EXISTS(SELECT 1 FROM public.invoice_cases WHERE person_id=v_person.id) THEN
    UPDATE public.people SET auth_user_id=NULL WHERE id=v_person.id;
    UPDATE public.people SET auth_user_id=v_user.id,email=v_user.email,updated_at=now() WHERE id=v_candidate;
    DELETE FROM public.people WHERE id=v_person.id;
    v_person.id:=v_candidate;
    INSERT INTO business_private.registration_identity_resolutions(auth_user_id,person_id)
      VALUES(v_user.id,v_person.id) ON CONFLICT(auth_user_id) DO UPDATE
      SET person_id=excluded.person_id,resolved_by=NULL,resolved_at=now();
    v_count:=0;
  END IF;
  UPDATE public.people SET email=v_user.email,updated_at=now() WHERE id=v_person.id;
  RETURN jsonb_build_object('id',v_person.id,'unresolved',v_count>0);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error',SQLSTATE,'message','The account association could not be verified.');
END $$;

-- An internal UUID-returning caller used to rely on claim_person raising.
-- Preserve that guard now that the public claim contract uses structured JSON.
DO $migration$
DECLARE definition text;
  before_text text := 'perform business_private.claim_person();';
  after_text text := 'IF business_private.claim_person() ? ''error'' THEN RAISE EXCEPTION USING ERRCODE=''42501'',MESSAGE=''identity_verification_failed''; END IF;';
BEGIN
  definition:=pg_get_functiondef('business_private.save_month(date,jsonb,boolean,uuid,integer)'::regprocedure);
  IF strpos(definition,after_text)=0 THEN
    IF strpos(definition,before_text)=0 THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='registration_identity_caller_drift';
    END IF;
    EXECUTE replace(definition,before_text,after_text);
  END IF;
END $migration$;

CREATE OR REPLACE FUNCTION business_private.list_registration_identity_conflicts() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE result jsonb;
BEGIN
  IF NOT business_private.is_staff() THEN
    RETURN jsonb_build_object('error','not_authorized','message','Staff access is required.');
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'person_id',p.id,'display_name',p.display_name,'email',p.email,
    'booking_count',(SELECT count(*) FROM public.bookings b WHERE b.person_id=p.id),
    'candidates',(SELECT coalesce(jsonb_agg(jsonb_build_object('auth_user_id',u.id,
      'display_name',account.display_name,'email',u.email,
      'can_assign',NOT EXISTS(SELECT 1 FROM public.bookings b WHERE b.person_id=account.id)
        AND NOT EXISTS(SELECT 1 FROM public.invoice_cases i WHERE i.person_id=account.id)
        AND NOT EXISTS(SELECT 1 FROM business_private.registration_identity_resolutions r WHERE r.auth_user_id=u.id)) ORDER BY u.id),'[]'::jsonb)
      FROM auth.users u JOIN public.people account ON account.auth_user_id=u.id
      WHERE u.email_confirmed_at IS NOT NULL AND lower(u.email)=lower(p.email)))
    ORDER BY lower(p.email),p.created_at,p.id),'[]'::jsonb) INTO result
  FROM public.people p WHERE p.auth_user_id IS NULL AND EXISTS(
    SELECT 1 FROM auth.users u WHERE u.email_confirmed_at IS NOT NULL AND lower(u.email)=lower(p.email));
  RETURN jsonb_build_object('conflicts',result);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error',SQLSTATE,'message','The unresolved registrations could not be loaded.');
END $$;

CREATE OR REPLACE FUNCTION business_private.resolve_registration_identity(p_person_id uuid,p_auth_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE target_user auth.users; current_person public.people; candidate public.people;
BEGIN
  IF NOT business_private.is_staff() THEN
    RETURN jsonb_build_object('error','not_authorized','message','Staff access is required.');
  END IF;
  IF p_person_id IS NULL OR p_auth_user_id IS NULL THEN
    RETURN jsonb_build_object('error','invalid_input','message','Choose both a registration and a verified account.');
  END IF;
  SELECT * INTO target_user FROM auth.users WHERE id=p_auth_user_id FOR SHARE;
  IF target_user.id IS NULL OR target_user.email_confirmed_at IS NULL OR nullif(target_user.email,'') IS NULL THEN
    RETURN jsonb_build_object('error','invalid_input','message','The selected account has no verified email.');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('claim-person:'||lower(target_user.email),0));
  PERFORM 1 FROM public.people WHERE id=p_person_id OR auth_user_id=p_auth_user_id ORDER BY id FOR UPDATE;
  SELECT * INTO candidate FROM public.people WHERE id=p_person_id;
  SELECT * INTO current_person FROM public.people WHERE auth_user_id=p_auth_user_id;
  IF candidate.id IS NULL OR current_person.id IS NULL THEN
    RETURN jsonb_build_object('error','not_found','message','The selected identity is no longer available.');
  END IF;
  IF candidate.auth_user_id=p_auth_user_id AND EXISTS(
    SELECT 1 FROM business_private.registration_identity_resolutions WHERE auth_user_id=p_auth_user_id AND person_id=p_person_id) THEN
    RETURN jsonb_build_object('person_id',p_person_id,'auth_user_id',p_auth_user_id,'resolved',true);
  END IF;
  IF candidate.auth_user_id IS NOT NULL OR lower(candidate.email) IS DISTINCT FROM lower(target_user.email) THEN
    RETURN jsonb_build_object('error','conflict','message','The registration is already assigned or its email does not match.');
  END IF;
  IF EXISTS(SELECT 1 FROM public.bookings WHERE person_id=current_person.id)
    OR EXISTS(SELECT 1 FROM public.invoice_cases WHERE person_id=current_person.id)
    OR EXISTS(SELECT 1 FROM business_private.registration_identity_resolutions WHERE auth_user_id=p_auth_user_id) THEN
    RETURN jsonb_build_object('error','conflict','message','This account already has a business identity. Existing identities cannot be merged.');
  END IF;
  UPDATE public.people SET auth_user_id=NULL WHERE id=current_person.id;
  UPDATE public.people SET auth_user_id=p_auth_user_id,email=target_user.email,updated_at=now() WHERE id=p_person_id;
  DELETE FROM public.people WHERE id=current_person.id;
  INSERT INTO business_private.registration_identity_resolutions(auth_user_id,person_id,resolved_by)
    VALUES(p_auth_user_id,p_person_id,auth.uid());
  RETURN jsonb_build_object('person_id',p_person_id,'auth_user_id',p_auth_user_id,'resolved',true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error',SQLSTATE,'message','The registration could not be assigned. Please reload and try again.');
END $$;

CREATE OR REPLACE FUNCTION public.list_registration_identity_conflicts() RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path TO '' AS $$SELECT business_private.list_registration_identity_conflicts()$$;
CREATE OR REPLACE FUNCTION public.resolve_registration_identity(p_person_id uuid,p_auth_user_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path TO '' AS $$SELECT business_private.resolve_registration_identity(p_person_id,p_auth_user_id)$$;
REVOKE ALL ON FUNCTION business_private.list_registration_identity_conflicts() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION business_private.resolve_registration_identity(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.list_registration_identity_conflicts() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.resolve_registration_identity(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION business_private.list_registration_identity_conflicts(), business_private.resolve_registration_identity(uuid,uuid),
  public.list_registration_identity_conflicts(), public.resolve_registration_identity(uuid,uuid) TO authenticated;

-- Rollback: deploy the previous application and restore the pre-migration backup.
-- The association RPC preserves anonymous person IDs and their booking/invoice
-- references. After any association, restore from backup to recover discarded
-- empty account people; do not attempt an inverse reassignment by email.
-- Before any association, the additive objects can be removed using:
-- DROP FUNCTION public.resolve_registration_identity(uuid,uuid);
-- DROP FUNCTION public.list_registration_identity_conflicts();
-- DROP FUNCTION business_private.resolve_registration_identity(uuid,uuid);
-- DROP FUNCTION business_private.list_registration_identity_conflicts();
-- Restore business_private.claim_person() and business_private.save_month(...)
-- from the pre-migration schema backup,
-- then DROP TABLE business_private.registration_identity_resolutions;
