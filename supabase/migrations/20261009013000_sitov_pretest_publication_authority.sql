-- Sitov Academy additive105: current authority before publication receipt conflict.
-- Reuse103's private profile/factor locks only for this early-return branch.
-- Exact receipts and fresh publication retain102's post-source-wait check.
DO $sitov$
DECLARE definition text;old_conflict constant text:=$old$IF FOUND AND saved IS DISTINCT FROM payload THEN RETURN sitov_pronunciation_private.pretest_error('request_conflict');END IF;$old$;
BEGIN
 PERFORM 'sitov_pronunciation_private.sitov_lock_draft_staff_authority()'::regprocedure;
 definition:=pg_get_functiondef('sitov_pronunciation_private.staff_publication(boolean,uuid,uuid,text,text,uuid,uuid)'::regprocedure);
 IF position('sitov_pronunciation_private.sitov_lock_draft_staff_authority()' IN definition)>0 THEN RETURN;END IF;
 IF position(old_conflict IN definition)=0 THEN RAISE EXCEPTION 'sitov_pretest_publication_authority_contract_changed';END IF;
 EXECUTE replace(definition,old_conflict,$new$IF FOUND AND saved IS DISTINCT FROM payload THEN
   IF NOT sitov_pronunciation_private.sitov_lock_draft_staff_authority() THEN RETURN sitov_pronunciation_private.pretest_error('not_found');END IF;
   RETURN sitov_pronunciation_private.pretest_error('request_conflict');
  END IF;$new$);
END $sitov$;
NOTIFY pgrst,'reload schema';
