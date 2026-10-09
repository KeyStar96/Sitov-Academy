-- Sitov Academy: remove only the optional metadata port.
DROP FUNCTION IF EXISTS public.sitov_get_learning_recommendation_sources(text,uuid[]);
DROP FUNCTION IF EXISTS learning_private.sitov_recommendation_sources(text,uuid[]);
NOTIFY pgrst,'reload schema';
