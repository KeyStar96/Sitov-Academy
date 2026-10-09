-- Sitov Academy: the existing can_remove_audio SECURITY DEFINER runs as postgres.
-- Permit only that internal caller; the sealed helper stays unavailable to API roles.
GRANT EXECUTE ON FUNCTION sitov_simulation_private.preserve_media(uuid,text) TO postgres;

-- GRANT can otherwise warn without making the privilege effective for the caller.
DO $sitov$
BEGIN
 IF NOT has_function_privilege('postgres','sitov_simulation_private.preserve_media(uuid,text)','EXECUTE') THEN
  RAISE EXCEPTION 'sitov_storage_definer_execution_not_granted' USING ERRCODE='42501';
 END IF;
END
$sitov$;
