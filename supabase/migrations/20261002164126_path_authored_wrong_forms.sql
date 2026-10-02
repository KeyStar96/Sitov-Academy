-- Master-Prompt Phase 4: an authored wrong form of a gap is never a typing error.
-- Function-only and repeatable; keeps owners, ACLs, content and learner data.
-- Apply after 57 through migrate-local.py with its backup and transaction.
-- Rollback: rollback/58_path_authored_wrong_forms.sql.
--
-- Typed gaps of the learning path are graded by learning_private.grade_answer,
-- which forgives one wrong letter in a word of four letters and more. The wrong
-- forms an author stores next to the solution (content.options: "einer" beside
-- "einem", "fahrt" beside "fährt") are exactly such neighbours, so a grammar
-- error passed as SOFT_ERROR in lessons, reviews and tests of every level.
--
--  * learning_private.grade_form_answer(): grades like grade_answer(), then
--    withdraws the tolerance where the form itself is the learning objective:
--    1. a tolerated answer (typo or spelled-out umlaut) that equals one of the
--       given wrong forms is INCORRECT;
--    2. if one of those wrong forms lies within the typing tolerance of the
--       solution, the task contrasts near-identical forms (einem/einer): there
--       no typo is forgiven at all, also not an unlisted one ("einen").
--    Exact answers, capitalisation, punctuation and the ae/oe/ue/ss spelling
--    of the solution keep their result, as do typos in every other task.
--  * path_private.grade(): passes content.options of a fill_in_blank task (also
--    inside a listening task) as those wrong forms. No other type has typed
--    text next to authored choices.
CREATE OR REPLACE FUNCTION learning_private.grade_form_answer(p_input text,p_accepted text[],p_wrong_forms text[]) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE grade jsonb:=learning_private.grade_answer(p_input,p_accepted); input_key text; form text; form_plain text;
 incorrect CONSTANT jsonb:=jsonb_build_object('status','INCORRECT','matched',NULL,'reason',NULL,'hint',NULL);
BEGIN
 -- Only tolerance results can be a wrong form: EXACT (including a neutral
 -- capitalisation/punctuation hint) and errors pass through unchanged.
 IF grade->>'status' IS DISTINCT FROM 'SOFT_ERROR' OR p_wrong_forms IS NULL THEN RETURN grade; END IF;
 -- Same key as the tolerance itself: case, punctuation and ae/oe/ue/ss spelling
 -- of the wrong form ("Einer.", "faehrt") do not turn it into a typing error.
 input_key:=learning_private.expand_german_letters(lower(learning_private.answer_without_punctuation(p_input)));
 FOREACH form IN ARRAY p_wrong_forms LOOP
  IF form IS NULL OR length(form)>4000 OR learning_private.normalize_answer(form)='' THEN CONTINUE; END IF;
  form_plain:=lower(learning_private.answer_without_punctuation(form));
  -- The option list of a gap also holds its solution: an accepted answer is
  -- no wrong form, so its own ae/oe/ue/ss spelling stays a forgiven umlaut.
  IF EXISTS(SELECT 1 FROM unnest(p_accepted) answer
   WHERE lower(learning_private.answer_without_punctuation(answer))=form_plain) THEN CONTINUE; END IF;
  IF learning_private.expand_german_letters(form_plain)=input_key THEN RETURN incorrect; END IF;
  IF grade->>'reason'='typo' AND learning_private.grade_answer(form,p_accepted)->>'status'='SOFT_ERROR' THEN RETURN incorrect; END IF;
 END LOOP;
 RETURN grade;
END $function$;
REVOKE ALL ON FUNCTION learning_private.grade_form_answer(text,text[],text[]) FROM PUBLIC,anon,authenticated,service_role;
-- Same cross-owner boundary as 15: legacy definer functions run as postgres.
GRANT EXECUTE ON FUNCTION learning_private.grade_form_answer(text,text[],text[]) TO postgres;

DO $patch$
DECLARE definition text; previous text; replacement text;
BEGIN
 SELECT pg_get_functiondef('path_private.grade(public.exercise_type,jsonb,jsonb)'::regprocedure) INTO definition;
 IF position('authored-wrong-forms-v1' IN definition)=0 THEN
  previous:=$old$  field_grade:=learning_private.grade_answer(p_answer->>'text',ARRAY(SELECT jsonb_array_elements_text(p_content->'accepted_answers')));$old$;
  replacement:=$new$  -- authored-wrong-forms-v1: stored wrong forms of a gap withdraw the typing tolerance.
  field_grade:=learning_private.grade_form_answer(p_answer->>'text',ARRAY(SELECT jsonb_array_elements_text(p_content->'accepted_answers')),
   CASE WHEN jsonb_typeof(p_content->'options')='array' THEN ARRAY(SELECT jsonb_array_elements_text(p_content->'options')) END);$new$;
  IF position(previous IN definition)=0 THEN RAISE EXCEPTION 'Unexpected path_private.grade typed answer definition'; END IF;
  EXECUTE replace(definition,previous,replacement);
 END IF;
END $patch$;

NOTIFY pgrst,'reload schema';
