-- Removes only the optional companion; grades, receipts, definitions/history remain.
DROP FUNCTION IF EXISTS public.sitov_get_pronunciation_pretest_learning_topics(uuid);
DROP FUNCTION IF EXISTS sitov_pronunciation_private.learning_topics(uuid);
NOTIFY pgrst,'reload schema';
