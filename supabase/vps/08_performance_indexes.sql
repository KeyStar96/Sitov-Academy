-- Phase 4: explicitly autocommit in migrate-local.py. psql executes each command
-- separately; never send this file as one transaction or one driver query.
-- Verify definitions before repairing interrupted builds (IF NOT EXISTS alone
-- does not recover an INVALID index). Never replace a differently defined index.
DO $verify$
DECLARE item record; existing regclass;
BEGIN
 FOR item IN SELECT * FROM (VALUES
  ('vocabulary_direction_user_box_idx', 'auth_user_id, box_number'),
  ('vocabulary_direction_user_order_idx', 'auth_user_id, id')
 ) AS definitions(name, columns) LOOP
  existing:=to_regclass('public.'||item.name);
  IF existing IS NOT NULL AND pg_get_indexdef(existing) IS DISTINCT FROM
    format('CREATE INDEX %I ON public.vocabulary_direction_progress USING btree (%s)',item.name,item.columns) THEN
   RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='phase4_index_definition_mismatch';
  END IF;
 END LOOP;
END $verify$;

SELECT format('DROP INDEX CONCURRENTLY %s;', i.indexrelid::regclass)
FROM pg_index i WHERE NOT i.indisvalid AND i.indexrelid IN (
 to_regclass('public.vocabulary_direction_user_box_idx'),
 to_regclass('public.vocabulary_direction_user_order_idx'))
\gexec

-- (auth_user_id, next_review_date) WHERE box_number<7 already exists as
-- vocabulary_direction_due_idx. Keep it; it supports the due-session query.
CREATE INDEX CONCURRENTLY IF NOT EXISTS vocabulary_direction_user_box_idx
 ON public.vocabulary_direction_progress (auth_user_id, box_number);
CREATE INDEX CONCURRENTLY IF NOT EXISTS vocabulary_direction_user_order_idx
 ON public.vocabulary_direction_progress (auth_user_id, id);

-- Remove only the redundant indexes introduced by the audited Phase-4 commit.
DROP INDEX CONCURRENTLY IF EXISTS public.idx_user_exercise_progress_auth_user_id;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_vocabulary_direction_progress_auth_user_id;

-- Rollback outside a transaction, after a fresh R8 backup:
-- DROP INDEX CONCURRENTLY IF EXISTS public.vocabulary_direction_user_box_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS public.vocabulary_direction_user_order_idx;
-- No table data is changed; the original unique/composite indexes remain.
