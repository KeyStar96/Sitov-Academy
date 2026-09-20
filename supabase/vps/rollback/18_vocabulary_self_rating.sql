-- Rollback for supabase/vps/18_vocabulary_self_rating.sql.
-- Run atomically on the VPS with psql -1 after a fresh backup. This only adds a
-- new flashcard self-rating path; dropping it leaves the typed trainer intact.
-- Deploy the client that no longer calls submit_vocabulary_self_rating_once
-- first, so no in-flight request hits a missing function.
DROP FUNCTION IF EXISTS public.submit_vocabulary_self_rating_once(uuid,uuid,boolean,text);
DROP FUNCTION IF EXISTS vocabulary_private.submit_self_rating_once(uuid,uuid,boolean,text);
DROP FUNCTION IF EXISTS vocabulary_private.submit_self_rating(uuid,boolean,text);
DROP FUNCTION IF EXISTS vocabulary_private.self_rating_allowed(integer,boolean);
-- answer_receipts rows written by the flashcard path (typed_answer IS NULL)
-- stay valid receipts; they are harmless once the functions are gone.
