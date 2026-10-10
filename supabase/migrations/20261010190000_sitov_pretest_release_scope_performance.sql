-- Sitov Academy: evaluate pretest releases once per statement.
-- Migration 94 calls current_pass() for every reading text and, through
-- unit_has_current_pass(), for every pronunciation unit row. Each call resolves
-- the commercial item rule and the current published test, so any unit listing
-- of a learner took seconds on the live data. The rule is unchanged: the set
-- below starts from the caller's own passes and applies the same three conditions.

-- { text : current_pass(text) }. current_pretest(text) only returns a definition
-- of that text, so a pass can release nothing but the text of its own definition.
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.sitov_current_pass_text_ids() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT d.text_id FROM sitov_pronunciation_private.pretest_passes p
 JOIN sitov_pronunciation_private.pretest_definitions d ON d.id=p.definition_id
 WHERE auth.uid() IS NOT NULL AND p.student_id=auth.uid()
 AND (sitov_pronunciation_private.current_pretest(d.text_id)).id=d.id
 AND sitov_access_private.item_allowed(auth.uid(),'reading_text',d.text_id::text)
$$;
-- { unit : unit_has_current_pass(unit) }.
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.sitov_current_pass_unit_ids() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT r.unit_id FROM public.learning_reading_texts r
 WHERE r.id IN(SELECT sitov_pronunciation_private.sitov_current_pass_text_ids())
$$;
REVOKE ALL ON FUNCTION sitov_pronunciation_private.sitov_current_pass_text_ids(),sitov_pronunciation_private.sitov_current_pass_unit_ids() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION sitov_pronunciation_private.sitov_current_pass_text_ids(),sitov_pronunciation_private.sitov_current_pass_unit_ids() TO authenticated;

ALTER POLICY sitov_pronunciation_readiness_bounds ON public.learning_reading_texts
 USING((SELECT sitov_pronunciation_private.staff_preview()) OR id IN(SELECT sitov_pronunciation_private.sitov_current_pass_text_ids()));
ALTER POLICY sitov_pretest_released_read ON public.learning_reading_texts
 USING(id IN(SELECT sitov_pronunciation_private.sitov_current_pass_text_ids()) AND learning_private.german_text_allowed(sentence_de) AND learning_private.german_text_allowed(focus));
ALTER POLICY sitov_pretest_released_unit ON public.learning_units
 USING(trainer='pronunciation' AND id IN(SELECT sitov_pronunciation_private.sitov_current_pass_unit_ids()));
NOTIFY pgrst,'reload schema';
