-- Roll back 35 and 34 first. PostgreSQL cannot remove enum labels safely in
-- place. The unused additive labels deliberately remain compatible with the
-- old release; no authored content or historical progress is deleted.
-- Exact pre-33 type restoration requires the verified R8 backup and its app.
DO $rollback$
BEGIN
 IF EXISTS(SELECT 1 FROM public.learning_exercises WHERE type::text IN
  ('multi_blank','matching','categorize','dialogue','listening','transform')) THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='path_content_requires_backup_restore';
 END IF;
END $rollback$;
