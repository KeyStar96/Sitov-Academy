-- Phase 4 rollback, through migrate-local.py with a verified backup.
-- Preserve every exercise, old/new progress row, attempt and migration note.
-- Restore legacy activation flags; new Phase 4 units become inactive. Units
-- already present before Phase 4 regain their original activation state.
DO $$ DECLARE saved record; BEGIN
 IF to_regclass('path_private.phase4_imported_units') IS NULL THEN RETURN; END IF;
 UPDATE path_private.phase4_imported_units f SET rollback_active=u.is_active
  FROM public.learning_units u WHERE u.id=f.unit_id AND f.rollback_active IS NULL;
 UPDATE public.learning_units u SET is_active=coalesce(f.was_active,false)
  FROM path_private.phase4_imported_units f WHERE u.id=f.unit_id;
 UPDATE public.learning_units u SET is_active=a.is_active FROM path_private.archived_units a
  WHERE u.id=a.unit_id AND NOT u.is_path;
 FOR saved IN SELECT definition FROM path_private.phase4_function_backups LOOP EXECUTE saved.definition; END LOOP;
 REVOKE ALL ON FUNCTION public.import_learning_path_seed(jsonb) FROM PUBLIC,anon,authenticated,service_role;
 REVOKE ALL ON public.path_legacy_progress_notes FROM PUBLIC,anon,authenticated,service_role;
END $$;
