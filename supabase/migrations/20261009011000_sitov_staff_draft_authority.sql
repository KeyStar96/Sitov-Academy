-- Sitov Academy additive103: current draft staff authority after blocking waits.
-- Keep100 source/CAS/inactive-version/receipt behavior and its original OID/ACL.
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.sitov_lock_draft_staff_authority()
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 IF NOT FOUND THEN RETURN false;END IF;
 PERFORM 1 FROM auth.mfa_factors WHERE user_id=auth.uid() FOR SHARE;
 RETURN sitov_access_private.staff();
END $$;
REVOKE ALL ON FUNCTION sitov_pronunciation_private.sitov_lock_draft_staff_authority() FROM PUBLIC,anon,authenticated,service_role;
DO $sitov$
DECLARE definition text;old_receipt constant text:=$old$IF FOUND THEN IF receipt.payload IS DISTINCT FROM payload THEN RETURN sitov_pronunciation_private.pretest_error('request_conflict');END IF;RETURN receipt.response;END IF;$old$;
 old_source constant text:=$old$IF NOT FOUND THEN RETURN sitov_pronunciation_private.pretest_error('not_found');END IF;
 IF p_text_version IS DISTINCT FROM sitov_pronunciation_private.pretest_hash(body)$old$;
BEGIN
 definition:=pg_get_functiondef('sitov_pronunciation_private.save_draft(uuid,text,uuid,jsonb,uuid)'::regprocedure);
 IF position('sitov_pronunciation_private.sitov_lock_draft_staff_authority()' IN definition)>0 THEN RETURN;END IF;
 IF position(old_receipt IN definition)=0 OR position(old_source IN definition)=0 THEN RAISE EXCEPTION 'sitov_staff_draft_authority_contract_changed';END IF;
 definition:=replace(definition,old_receipt,$new$IF FOUND THEN
  IF NOT sitov_pronunciation_private.sitov_lock_draft_staff_authority() THEN RETURN sitov_pronunciation_private.pretest_error('not_found');END IF;
  IF receipt.payload IS DISTINCT FROM payload THEN RETURN sitov_pronunciation_private.pretest_error('request_conflict');END IF;
  RETURN receipt.response;
 END IF;$new$);
 definition:=replace(definition,old_source,$new$IF NOT FOUND THEN RETURN sitov_pronunciation_private.pretest_error('not_found');END IF;
 IF NOT sitov_pronunciation_private.sitov_lock_draft_staff_authority() THEN RETURN sitov_pronunciation_private.pretest_error('not_found');END IF;
 IF p_text_version IS DISTINCT FROM sitov_pronunciation_private.pretest_hash(body)$new$);
 EXECUTE definition;
END $sitov$;
NOTIFY pgrst,'reload schema';
