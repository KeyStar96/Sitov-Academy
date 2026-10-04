-- The operator chooses password-only teacher access. Admin protection remains.
CREATE OR REPLACE FUNCTION sitov_security_private.sitov_staff_mfa_required() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=(SELECT auth.uid())
  AND role='admin' AND sitov_mfa_required)
$$;
REVOKE ALL ON FUNCTION sitov_security_private.sitov_staff_mfa_required() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION sitov_security_private.sitov_staff_mfa_required() TO authenticated,service_role;

CREATE OR REPLACE FUNCTION sitov_security_private.sitov_protect_mfa_flag() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 -- Teacher profiles never regain mandatory MFA through enrollment, an old
 -- role promotion rule or an explicit true value in a profile write.
 IF NEW.role='teacher' THEN
  NEW.sitov_mfa_required:=false;
  RETURN NEW;
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.role='admin' THEN NEW.sitov_mfa_required:=true; END IF;
  RETURN NEW;
 END IF;
 -- In particular, teacher -> admin must enable MFA despite the old staff role.
 IF NEW.role='admin' AND COALESCE(OLD.role::text,'')<>'admin' THEN
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

CREATE OR REPLACE FUNCTION public.sitov_enable_staff_mfa() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous text:=current_setting('sitov.staff_mfa_enable',true);
BEGIN
 IF auth.uid() IS NULL OR COALESCE((SELECT auth.jwt())->>'aal','')<>'aal2'
  OR NOT EXISTS(SELECT 1 FROM auth.mfa_factors WHERE user_id=(SELECT auth.uid()) AND status='verified' AND factor_type='totp')
  OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=(SELECT auth.uid()) AND role='admin') THEN
  RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
 END IF;
 PERFORM set_config('sitov.staff_mfa_enable','verified',true);
 UPDATE public.profiles SET sitov_mfa_required=true WHERE id=(SELECT auth.uid());
 PERFORM set_config('sitov.staff_mfa_enable',COALESCE(previous,''),true);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.sitov_enable_staff_mfa() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sitov_enable_staff_mfa() TO authenticated;

UPDATE public.profiles SET sitov_mfa_required=false WHERE role='teacher';
NOTIFY pgrst,'reload schema';
