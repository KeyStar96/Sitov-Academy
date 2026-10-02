-- Restore migration 30 grading helpers; no learner rows are changed.
CREATE OR REPLACE FUNCTION learning_private.normalize_answer(p_value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path TO '' AS $function$
 SELECT btrim(regexp_replace(translate(translate(translate(normalize(p_value,NFC),
  '’‘ʼ＇',repeat(chr(39),4)), '„“”«»＂','""""""'), '‐‑‒–—−﹘－','--------'), '[[:space:]  ]+',' ','g'))
$function$;

CREATE OR REPLACE FUNCTION learning_private.answer_without_punctuation(p_value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path TO '' AS $function$
 SELECT learning_private.normalize_answer(regexp_replace(learning_private.normalize_answer(p_value),
  $punct$(?<![[:digit:]])[.,]|[.,](?![[:digit:]])|[!?;:'"()\[\]{}…]|(?<![[:digit:]])-(?![[:digit:]])$punct$,'','g'))
$function$;

CREATE OR REPLACE FUNCTION learning_private.grade_answer(p_input text,p_accepted text[]) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE input_value text; input_plain text; candidate text; candidate_plain text; original text;
 hint learning_private.answer_hint; reason learning_private.soft_error_reason;
 input_words text[]; accepted_words text[]; distance integer; word_index integer;
BEGIN
 IF p_input IS NULL OR length(p_input)>4000 OR learning_private.normalize_answer(p_input)='' THEN
  RETURN jsonb_build_object('error','invalid_answer','message','Enter an answer of at most 4000 characters.','sqlstate','22023');
 END IF;
 IF p_accepted IS NULL OR coalesce(array_ndims(p_accepted),0)<>1 OR cardinality(p_accepted) NOT BETWEEN 1 AND 128
  OR EXISTS(SELECT 1 FROM unnest(p_accepted) a WHERE a IS NULL OR length(a)>4000 OR learning_private.normalize_answer(a)='') THEN
  RETURN jsonb_build_object('error','invalid_accepted_answers','message','The accepted answers are missing or invalid.','sqlstate','22023');
 END IF;
 input_value:=learning_private.normalize_answer(p_input);
 input_plain:=learning_private.answer_without_punctuation(input_value);
 -- Literal/typographic equality across all answers outranks every other match.
 FOREACH original IN ARRAY p_accepted LOOP
  IF input_value=learning_private.normalize_answer(original) THEN
   RETURN jsonb_build_object('status','EXACT','matched',original,'reason',NULL,'hint',NULL);
  END IF;
 END LOOP;
 -- Case and punctuation carry a neutral writing hint, never a penalty.
 FOREACH original IN ARRAY p_accepted LOOP
  candidate:=learning_private.normalize_answer(original);
  candidate_plain:=learning_private.answer_without_punctuation(candidate);
  IF lower(input_plain)=lower(candidate_plain) THEN
   hint:=CASE WHEN lower(input_value)=lower(candidate) THEN 'capitalization'
    WHEN input_plain=candidate_plain THEN 'punctuation' ELSE 'capitalization_punctuation' END;
   RETURN jsonb_build_object('status','EXACT','matched',original,'reason',NULL,'hint',hint);
  END IF;
 END LOOP;
 -- Ignore case/punctuation before checking remaining errors. Umlaut outranks
 -- typo across the entire answer list; we never equate word order or content.
 FOREACH reason IN ARRAY ARRAY['umlaut','typo']::learning_private.soft_error_reason[] LOOP
  FOREACH original IN ARRAY p_accepted LOOP
   candidate_plain:=lower(learning_private.answer_without_punctuation(original));
   IF reason='umlaut' THEN
    IF learning_private.expand_german_letters(lower(input_plain))=learning_private.expand_german_letters(candidate_plain) THEN
     RETURN jsonb_build_object('status','SOFT_ERROR','matched',original,'reason',reason,'hint',NULL);
    END IF;
   ELSE
    -- Content symbols (currency, %, +) and numeral separators must agree too.
    IF regexp_split_to_array(lower(input_plain),'[[:alnum:]ÄÖÜäöüßẞ]+') IS DISTINCT FROM
       regexp_split_to_array(candidate_plain,'[[:alnum:]ÄÖÜäöüßẞ]+') THEN CONTINUE; END IF;
    input_words:=regexp_split_to_array(lower(input_plain),'[^[:alnum:]ÄÖÜäöüßẞ]+');
    accepted_words:=regexp_split_to_array(candidate_plain,'[^[:alnum:]ÄÖÜäöüßẞ]+');
    IF cardinality(input_words)<>cardinality(accepted_words) THEN CONTINUE; END IF;
    distance:=0;
    FOR word_index IN 1..cardinality(input_words) LOOP
     IF input_words[word_index]=accepted_words[word_index] THEN CONTINUE; END IF;
     -- Numbers/codes may be the learning objective: changed numeric-bearing
     -- tokens require an authored accepted answer, never global typo tolerance.
     IF input_words[word_index] !~ '^[[:alpha:]ÄÖÜäöüßẞ]+$'
      OR accepted_words[word_index] !~ '^[[:alpha:]ÄÖÜäöüßẞ]+$' THEN distance:=2; EXIT; END IF;
     -- Articles/pronouns/prepositions remain exact: der/den, ihm/ihn, am/an.
     IF least(char_length(input_words[word_index]),char_length(accepted_words[word_index]))<4 THEN distance:=2; EXIT; END IF;
     distance:=distance+learning_private.levenshtein_at_most_one(input_words[word_index],accepted_words[word_index]);
     IF distance>1 THEN EXIT; END IF;
    END LOOP;
    IF distance=1 THEN
     RETURN jsonb_build_object('status','SOFT_ERROR','matched',original,'reason',reason,'hint',NULL);
    END IF;
   END IF;
  END LOOP;
 END LOOP;
 RETURN jsonb_build_object('status','INCORRECT','matched',NULL,'reason',NULL,'hint',NULL);
END $function$;

