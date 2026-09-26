-- Deploy the preceding client first, then apply with migrate-local.py backup.
-- Remove dashboard APIs; preserve archive-aware path compatibility functions.
-- Restoring the old unguarded path readers/writers would resurrect archived
-- passes or hide learning completed during the rollback period on reapply.
-- All attempts, answers, progress snapshots and audit rows therefore remain.
DO $$ DECLARE definition text; BEGIN
 SELECT b.definition INTO definition FROM teacher_dashboard_private.function_backups b
 WHERE b.signature='public.manage_learning_path(uuid,uuid,text,uuid)';
 IF definition IS NOT NULL THEN EXECUTE definition; END IF;
END $$;
DROP FUNCTION IF EXISTS public.get_teacher_dashboard_students();
DROP FUNCTION IF EXISTS public.get_teacher_student_detail(uuid,text,text);
DROP FUNCTION IF EXISTS public.manage_learning_path(uuid,uuid,text,uuid,uuid);
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA teacher_dashboard_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA teacher_dashboard_private FROM PUBLIC,anon,authenticated;
