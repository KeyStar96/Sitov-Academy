-- Stage enrollment first. Existing staff keep access until they enable TOTP or
-- the operator sets sitov_mfa_required=true after verifying enrollment/recovery.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sitov_mfa_required boolean NOT NULL DEFAULT false;
CREATE SCHEMA IF NOT EXISTS sitov_security_private;
REVOKE ALL ON SCHEMA sitov_security_private FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA sitov_security_private TO authenticated,service_role;

CREATE OR REPLACE FUNCTION sitov_security_private.sitov_staff_mfa_required() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=(SELECT auth.uid())
  AND role IN('teacher','admin') AND sitov_mfa_required)
$$;
CREATE OR REPLACE FUNCTION sitov_security_private.sitov_staff_mfa_satisfied() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT NOT sitov_security_private.sitov_staff_mfa_required() OR
  (COALESCE((SELECT auth.jwt())->>'aal','')='aal2' AND EXISTS(
   SELECT 1 FROM auth.mfa_factors WHERE user_id=(SELECT auth.uid()) AND status='verified' AND factor_type='totp'))
$$;
REVOKE ALL ON FUNCTION sitov_security_private.sitov_staff_mfa_required(),sitov_security_private.sitov_staff_mfa_satisfied() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION sitov_security_private.sitov_staff_mfa_required(),sitov_security_private.sitov_staff_mfa_satisfied() TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.sitov_staff_mfa_status() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('required',sitov_security_private.sitov_staff_mfa_required(),
  'satisfied',sitov_security_private.sitov_staff_mfa_satisfied()) WHERE auth.uid() IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.sitov_staff_mfa_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sitov_staff_mfa_status() TO authenticated,service_role;

-- Learners/staff cannot disable their own mandatory flag through profile PATCH.
CREATE OR REPLACE FUNCTION sitov_security_private.sitov_protect_mfa_flag() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.role IN('teacher','admin') THEN NEW.sitov_mfa_required:=true; END IF;
  RETURN NEW;
 END IF;
 -- New staff and promotions inherit mandatory MFA after the enrollment path
 -- exists, without changing the staged flags of existing staff on deployment.
 IF NEW.role IN('teacher','admin') AND COALESCE(OLD.role::text,'') NOT IN('teacher','admin') THEN
  NEW.sitov_mfa_required:=true;
  RETURN NEW;
 END IF;
 IF NEW.sitov_mfa_required IS DISTINCT FROM OLD.sitov_mfa_required
  AND auth.uid() IS NOT NULL AND COALESCE((SELECT auth.jwt())->>'role','')<>'service_role'
  AND COALESCE(current_setting('sitov.staff_mfa_enable',true),'')<>'verified' THEN
  RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sitov_security_private.sitov_protect_mfa_flag() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS sitov_protect_mfa_flag ON public.profiles;
CREATE TRIGGER sitov_protect_mfa_flag BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION sitov_security_private.sitov_protect_mfa_flag();

CREATE OR REPLACE FUNCTION public.sitov_enable_staff_mfa() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous text:=current_setting('sitov.staff_mfa_enable',true);
BEGIN
 IF auth.uid() IS NULL OR COALESCE((SELECT auth.jwt())->>'aal','')<>'aal2'
  OR NOT EXISTS(SELECT 1 FROM auth.mfa_factors WHERE user_id=(SELECT auth.uid()) AND status='verified' AND factor_type='totp')
  OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=(SELECT auth.uid()) AND role IN('teacher','admin')) THEN
  RAISE EXCEPTION 'staff_mfa_required' USING ERRCODE='42501';
 END IF;
 PERFORM set_config('sitov.staff_mfa_enable','verified',true);
 UPDATE public.profiles SET sitov_mfa_required=true WHERE id=(SELECT auth.uid());
 PERFORM set_config('sitov.staff_mfa_enable',COALESCE(previous,''),true);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.sitov_enable_staff_mfa() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sitov_enable_staff_mfa() TO authenticated;

-- This hook also covers SECURITY DEFINER RPCs which would bypass table RLS.
-- Only the current profile's read and the two MFA RPCs remain usable at aal1.
CREATE OR REPLACE FUNCTION sitov_security_private.sitov_pre_request() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE route text:=COALESCE(current_setting('request.path',true),'');
 method text:=COALESCE(current_setting('request.method',true),'');
BEGIN
 IF NOT sitov_security_private.sitov_staff_mfa_satisfied() THEN
  IF route IN('/rpc/sitov_staff_mfa_status','/rpc/sitov_enable_staff_mfa')
   OR (route='/profiles' AND method IN('GET','HEAD')) THEN RETURN; END IF;
  RAISE EXCEPTION 'staff_mfa_required' USING ERRCODE='42501';
 END IF;
END $$;
REVOKE ALL ON FUNCTION sitov_security_private.sitov_pre_request() FROM PUBLIC;
GRANT USAGE ON SCHEMA sitov_security_private TO anon;
GRANT EXECUTE ON FUNCTION sitov_security_private.sitov_pre_request() TO anon,authenticated,service_role;

-- Restrictive policies are ANDed with existing ownership/access rules. Storage
-- uses its own database connection, so it needs the same guard separately.
DO $$ DECLARE tab record;
BEGIN
 FOR tab IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE c.relkind IN('r','p') AND c.relrowsecurity AND
   (n.nspname='public' OR (n.nspname='storage' AND c.relname IN('objects','buckets')))
 LOOP
  IF tab.nspname='public' AND tab.relname='profiles' THEN CONTINUE; END IF;
  EXECUTE format('DROP POLICY IF EXISTS sitov_staff_mfa ON %I.%I',tab.nspname,tab.relname);
  EXECUTE format('CREATE POLICY sitov_staff_mfa ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated USING((SELECT sitov_security_private.sitov_staff_mfa_satisfied())) WITH CHECK((SELECT sitov_security_private.sitov_staff_mfa_satisfied()))',tab.nspname,tab.relname);
 END LOOP;
END $$;
DROP POLICY IF EXISTS sitov_staff_mfa_read ON public.profiles;
CREATE POLICY sitov_staff_mfa_read ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated
 USING((SELECT sitov_security_private.sitov_staff_mfa_satisfied()) OR id=(SELECT auth.uid()));
DO $$ DECLARE op text;
BEGIN
 FOREACH op IN ARRAY ARRAY['insert','update','delete'] LOOP
  EXECUTE format('DROP POLICY IF EXISTS sitov_staff_mfa_%s ON public.profiles',op);
  EXECUTE format('CREATE POLICY sitov_staff_mfa_%s ON public.profiles AS RESTRICTIVE FOR %s TO authenticated %s',op,upper(op),
   CASE WHEN op='insert' THEN 'WITH CHECK((SELECT sitov_security_private.sitov_staff_mfa_satisfied()))'
    WHEN op='delete' THEN 'USING((SELECT sitov_security_private.sitov_staff_mfa_satisfied()))'
    ELSE 'USING((SELECT sitov_security_private.sitov_staff_mfa_satisfied())) WITH CHECK((SELECT sitov_security_private.sitov_staff_mfa_satisfied()))' END);
 END LOOP;
END $$;

DO $$ DECLARE previous text;
BEGIN
 FOR previous IN SELECT substring(setting FROM length('pgrst.db_pre_request=')+1)
  FROM pg_db_role_setting s CROSS JOIN LATERAL unnest(s.setconfig) setting
  WHERE s.setrole=(SELECT oid FROM pg_roles WHERE rolname='authenticator')
   AND s.setdatabase IN(0,(SELECT oid FROM pg_database WHERE datname=current_database()))
   AND setting LIKE 'pgrst.db_pre_request=%'
 LOOP
  IF previous IS NOT NULL AND previous<>'' AND previous<>'sitov_security_private.sitov_pre_request' THEN
   RAISE EXCEPTION 'Existing PostgREST pre-request hook must be composed before enabling Sitov Academy MFA';
  END IF;
 END LOOP;
 ALTER ROLE authenticator SET pgrst.db_pre_request='sitov_security_private.sitov_pre_request';
 -- Database-specific settings outrank global role settings, including an
 -- explicit empty value. Set both so neither can silently disable this guard.
 EXECUTE format('ALTER ROLE authenticator IN DATABASE %I SET pgrst.db_pre_request=%L',current_database(),'sitov_security_private.sitov_pre_request');
END $$;
NOTIFY pgrst,'reload config';
NOTIFY pgrst,'reload schema';
