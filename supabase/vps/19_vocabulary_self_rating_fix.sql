-- Phase 5.x hotfix. Backup with migrate-local.py before applying. migrate-local
-- wraps regular files in one transaction; every statement here is idempotent.
-- Rollback: supabase/vps/rollback/19_vocabulary_self_rating_fix.sql.
--
-- BUG: the flashcard trainer answered every "Kenn ich / Kenn ich nicht" click
-- with "Your progress could not be saved just now."
--
-- ROOT CAUSE: public.submit_vocabulary_self_rating_once is SECURITY INVOKER
-- (18_vocabulary_self_rating.sql:109 declares no SECURITY DEFINER, which is
-- correct -- the boundary wrapper must not hold privileges). Its body therefore
-- runs as the calling role. 18_vocabulary_self_rating.sql:105 revoked
-- vocabulary_private.submit_self_rating_once from PUBLIC but never granted it
-- back to authenticated, so the call raised
--   42501 permission denied for function submit_self_rating_once
-- The wrapper's own EXCEPTION handler mapped 42501 to 'not_authorized', and
-- app/actions/vocabulary.ts collapsed that to 'save_failed'. The defect was
-- pure ACL: no function body, grade, box or interval was ever wrong.
--
-- The typed path was unaffected because 06_soft_errors.sql grants
-- vocabulary_private.submit_answer_once to authenticated (see schema.sql:8225),
-- which is exactly the line missing for the self-rating twin. This migration
-- restores that symmetry and nothing else.

-- Idempotent: GRANT on an existing privilege is a no-op, and the guard keeps a
-- re-run safe if migration 18 was rolled back before this file is replayed.
DO $migration$
BEGIN
 IF to_regprocedure('vocabulary_private.submit_self_rating_once(uuid,uuid,boolean,text)') IS NOT NULL THEN
  EXECUTE 'GRANT EXECUTE ON FUNCTION vocabulary_private.submit_self_rating_once(uuid,uuid,boolean,text) TO authenticated';
 END IF;
END $migration$;

-- Defence in depth for the boundary wrapper itself: re-assert the intended
-- grants so a partially applied migration 18 cannot leave the trainer dead.
DO $migration$
BEGIN
 IF to_regprocedure('public.submit_vocabulary_self_rating_once(uuid,uuid,boolean,text)') IS NOT NULL THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.submit_vocabulary_self_rating_once(uuid,uuid,boolean,text) FROM PUBLIC, anon';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.submit_vocabulary_self_rating_once(uuid,uuid,boolean,text) TO authenticated, service_role';
 END IF;
END $migration$;

-- Regression guard: fail the migration loudly rather than shipping a trainer
-- that silently cannot save. R10 -- the failure carries a machine-readable code.
DO $migration$
BEGIN
 IF to_regprocedure('vocabulary_private.submit_self_rating_once(uuid,uuid,boolean,text)') IS NOT NULL
  AND NOT has_function_privilege('authenticated',
   'vocabulary_private.submit_self_rating_once(uuid,uuid,boolean,text)','EXECUTE') THEN
  RAISE EXCEPTION 'self_rating_execute_grant_missing'
   USING ERRCODE='42501', DETAIL='authenticated cannot execute the flashcard self-rating receipt function';
 END IF;
END $migration$;

-- ROLLBACK (R9): the inverse of the grant above. Deploy a client that no longer
-- calls the flashcard path first, otherwise every self-rating fails again with
-- the same 42501 -> not_authorized -> save_failed chain this migration fixes.
-- REVOKE EXECUTE ON FUNCTION vocabulary_private.submit_self_rating_once(uuid,uuid,boolean,text) FROM authenticated;
