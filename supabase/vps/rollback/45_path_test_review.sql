-- Rollback of 45_path_test_review.sql. Apply with migrate-local.py after a backup.
-- Deploy a client without the evaluation first; it calls get_path_test_review.
DO $$ DECLARE saved record; BEGIN
 FOR saved IN SELECT definition FROM path_private.test_review_function_backups LOOP
  EXECUTE saved.definition;
 END LOOP;
END $$;
DROP FUNCTION IF EXISTS public.get_path_test_review(uuid,text);
REVOKE ALL ON FUNCTION public.get_learning_path(text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.get_learning_path(text,text) TO authenticated;
