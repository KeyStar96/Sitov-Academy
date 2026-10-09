-- Sitov Academy: preserve the existing postgres-owned pronunciation definer chain.
-- can_access_submission(uuid) calls this sealed helper after migration 93.
-- item_allowed and vocabulary_unit_visible already inherit EXECUTE; no grant needed.
GRANT EXECUTE ON FUNCTION sitov_access_private.staff() TO postgres;
DO $sitov$
BEGIN
 IF NOT has_function_privilege('postgres','sitov_access_private.staff()','EXECUTE') THEN
  RAISE EXCEPTION 'sitov_commercial_definer_execution_not_granted' USING ERRCODE='42501';
 END IF;
END
$sitov$;
