-- Deploy the preceding client first, then apply with migrate-local.py backup.
-- Restores the pre-43 availability rules: tests lock again until every lesson
-- of their path is completed, and only a path's own passed test opens the next
-- path. No learner data was changed by 43, so nothing needs to be restored.
DO $$ DECLARE saved record; BEGIN
 FOR saved IN SELECT definition FROM path_private.open_test_function_backups LOOP
  EXECUTE saved.definition;
 END LOOP;
END $$;
DROP FUNCTION IF EXISTS path_private.unit_cleared(uuid);
DROP FUNCTION IF EXISTS teacher_dashboard_private.path_cleared(uuid,uuid);
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA teacher_dashboard_private FROM PUBLIC,anon,authenticated;
