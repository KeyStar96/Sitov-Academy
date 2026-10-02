-- Restore the path grading of migration 34: typed gaps use the plain tolerance
-- again. Function-only; no content and no learner rows are changed.
DO $patch$
DECLARE definition text; current text; original text;
BEGIN
 SELECT pg_get_functiondef('path_private.grade(public.exercise_type,jsonb,jsonb)'::regprocedure) INTO definition;
 IF position('authored-wrong-forms-v1' IN definition)>0 THEN
  current:=$new$  -- authored-wrong-forms-v1: stored wrong forms of a gap withdraw the typing tolerance.
  field_grade:=learning_private.grade_form_answer(p_answer->>'text',ARRAY(SELECT jsonb_array_elements_text(p_content->'accepted_answers')),
   CASE WHEN jsonb_typeof(p_content->'options')='array' THEN ARRAY(SELECT jsonb_array_elements_text(p_content->'options')) END);$new$;
  original:=$old$  field_grade:=learning_private.grade_answer(p_answer->>'text',ARRAY(SELECT jsonb_array_elements_text(p_content->'accepted_answers')));$old$;
  IF position(current IN definition)=0 THEN RAISE EXCEPTION 'Unexpected path_private.grade typed answer definition'; END IF;
  EXECUTE replace(definition,current,original);
 END IF;
END $patch$;

DROP FUNCTION IF EXISTS learning_private.grade_form_answer(text,text[],text[]);

NOTIFY pgrst,'reload schema';
