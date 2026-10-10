-- Sitov Academy: return to the per-row pretest release checks of migration 94.
-- The rule and all data stay the same; only the evaluation strategy changes back.
ALTER POLICY sitov_pronunciation_readiness_bounds ON public.learning_reading_texts
 USING(sitov_pronunciation_private.staff_preview() OR sitov_pronunciation_private.current_pass(id));
ALTER POLICY sitov_pretest_released_read ON public.learning_reading_texts
 USING(sitov_pronunciation_private.current_pass(id) AND learning_private.german_text_allowed(sentence_de) AND learning_private.german_text_allowed(focus));
ALTER POLICY sitov_pretest_released_unit ON public.learning_units
 USING(trainer='pronunciation' AND sitov_pronunciation_private.unit_has_current_pass(id));
DROP FUNCTION IF EXISTS sitov_pronunciation_private.sitov_current_pass_unit_ids();
DROP FUNCTION IF EXISTS sitov_pronunciation_private.sitov_current_pass_text_ids();
NOTIFY pgrst,'reload schema';
