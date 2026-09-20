-- Fix mixed owners after Phase 3: legacy grading runs as postgres (NOSUPERUSER),
-- while helpers installed by migrate-local.py belong to supabase_admin.
-- Verified live: postgres lacks EXECUTE on both; public RPC returns SQLSTATE 42501.
-- Grant only the two cross-owner dependencies, never client roles or ownership.
GRANT EXECUTE ON FUNCTION learning_private.normalize_answer(text),
 learning_private.grade_answer(text,text[]) TO postgres;

-- Rollback after a fresh R8 backup (restores the verified pre-fix ACLs):
-- REVOKE EXECUTE ON FUNCTION learning_private.normalize_answer(text),
--  learning_private.grade_answer(text,text[]) FROM postgres;
-- This reintroduces the save failure but does not alter any learner data.
