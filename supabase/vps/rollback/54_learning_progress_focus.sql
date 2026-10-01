-- Stop app; take a fresh backup; run atomically on VPS with psql -1.
-- Removes the four public functions, the helpers and both triggers. Nothing is
-- deleted: learning_media_views, vocabulary_focus_words and
-- vocabulary_private.focus_receipts stay as an archive (R9). The matching app
-- release reads them only through these functions; roll it back together.
DROP TRIGGER IF EXISTS vocabulary_focus_track ON vocabulary_private.answer_receipts;
DROP TRIGGER IF EXISTS vocabulary_focus_archive ON public.vocabulary_direction_progress;
DROP FUNCTION IF EXISTS public.get_learning_progress(uuid,text,integer);
DROP FUNCTION IF EXISTS public.submit_vocabulary_focus_answer(uuid,uuid,text,text,text);
DROP FUNCTION IF EXISTS public.get_vocabulary_focus(text,text);
DROP FUNCTION IF EXISTS public.record_media_view(text,uuid);
DROP FUNCTION IF EXISTS vocabulary_private.focus_scope(uuid,text,uuid[]);
DROP FUNCTION IF EXISTS vocabulary_private.focus_format(integer,boolean,boolean);
DROP FUNCTION IF EXISTS vocabulary_private.focus_answer_key(uuid);
DROP FUNCTION IF EXISTS vocabulary_private.archive_focus_words();
DROP FUNCTION IF EXISTS vocabulary_private.track_focus_word();
DROP FUNCTION IF EXISTS vocabulary_private.focus_threshold_reached(integer,integer);
NOTIFY pgrst, 'reload schema';
