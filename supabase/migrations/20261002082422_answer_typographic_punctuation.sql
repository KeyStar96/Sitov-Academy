-- Phase 1: accept sentence punctuation emitted by localized tablet keyboards.
-- Function-only and repeatable; keep existing owners, ACLs and learner data.
-- Apply after 55 through migrate-local.py with its backup and transaction.
-- Rollback: rollback/56_answer_typographic_punctuation.sql.
CREATE OR REPLACE FUNCTION learning_private.normalize_answer(p_value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path TO '' AS $function$
 SELECT btrim(regexp_replace(translate(translate(translate(translate(normalize(p_value,NFC),
  '’‘ʼ＇',repeat(chr(39),4)), '„“”«»＂','""""""'), '‐‑‒–—−﹘－','--------'),
  '，﹐､、．﹒｡。：﹕；﹔？﹖！﹗（）［］｛｝',',,,,....::;;??!!()[]{}'), '[[:space:]  ]+',' ','g'))
$function$;

CREATE OR REPLACE FUNCTION learning_private.answer_without_punctuation(p_value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path TO '' AS $function$
 -- Normalize first: full-width decimal commas/periods must keep their meaning.
 SELECT learning_private.normalize_answer(regexp_replace(learning_private.normalize_answer(p_value),
  $punct$(?<![[:digit:]])[.,:]|[.,:](?![[:digit:]])|[!?¡¿;'"()\[\]{}…]|(?<![[:digit:]])-(?![[:digit:]])$punct$,'','g'))
$function$;

-- Fully uppercase German spelling may use SS for ß. This is a case change,
-- while lower-case "strasse" keeps the existing umlaut feedback.
DO $patch$
DECLARE definition text; previous text; replacement text;
BEGIN
 SELECT pg_get_functiondef('learning_private.grade_answer(text,text[])'::regprocedure) INTO definition;
 IF position('uppercase-sharp-s-v1' IN definition)=0 THEN
  previous:=$old$IF lower(input_plain)=lower(candidate_plain) THEN
   hint:=CASE WHEN lower(input_value)=lower(candidate) THEN 'capitalization'$old$;
  replacement:=$new$-- uppercase-sharp-s-v1
  IF lower(input_plain)=lower(candidate_plain)
   OR input_plain=replace(replace(upper(candidate_plain),'ß','SS'),'ẞ','SS') THEN
   hint:=CASE WHEN lower(input_value)=lower(candidate)
    OR input_value=replace(replace(upper(candidate),'ß','SS'),'ẞ','SS') THEN 'capitalization'$new$;
  IF position(previous IN definition)=0 THEN RAISE EXCEPTION 'Unexpected grade_answer capitalization definition'; END IF;
  EXECUTE replace(definition,previous,replacement);
 END IF;
END $patch$;
