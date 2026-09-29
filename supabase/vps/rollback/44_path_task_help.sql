-- Rollback of 44_path_task_help.sql. Apply with migrate-local.py after a backup.
-- Restores the pre-44 function definitions and removes the two help columns.
-- The seed fields task/gap_hint must be removed before a later re-import.
DO $$ DECLARE saved record; BEGIN
 FOR saved IN SELECT definition FROM path_private.task_help_function_backups LOOP
  EXECUTE saved.definition;
 END LOOP;
END $$;
ALTER TABLE public.grammar_translations DROP COLUMN IF EXISTS task;
ALTER TABLE public.grammar_translations DROP COLUMN IF EXISTS gap_hint;
