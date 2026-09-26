-- Phase 3 exercise infrastructure only. No seed is imported or generated.
-- Apply after 33 commits, through migrate-local.py with its verified R8 backup.
CREATE SCHEMA IF NOT EXISTS path_private;
REVOKE ALL ON SCHEMA path_private FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE IF NOT EXISTS path_private.content_contract_backups (
 signature text PRIMARY KEY, definition text NOT NULL
);
ALTER TABLE path_private.content_contract_backups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE path_private.content_contract_backups FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO path_private.content_contract_backups(signature,definition)
SELECT signature,pg_get_functiondef(signature::regprocedure)
FROM unnest(ARRAY['grammar_private.valid_accepted_answers(jsonb,public.exercise_type)',
 'grammar_private.german_content_allowed(jsonb,text)']) signature
ON CONFLICT(signature) DO NOTHING;

CREATE OR REPLACE FUNCTION path_private.valid_text(p_value jsonb,p_max integer DEFAULT 4000,p_empty boolean DEFAULT false)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO '' AS $function$
 SELECT coalesce(jsonb_typeof(p_value)='string' AND length(p_value#>>'{}')<=p_max AND strpos(p_value#>>'{}',U&'\FEFF')=0
  AND (p_empty OR length(btrim(p_value#>>'{}',U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'))>0),false)
$function$;

CREATE OR REPLACE FUNCTION path_private.text_key(p_value text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path TO '' AS $function$
 SELECT lower(regexp_replace(btrim(p_value,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'),
  U&'[\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF]+',' ','g'))
$function$;

CREATE OR REPLACE FUNCTION path_private.valid_strings(p_value jsonb,p_min integer DEFAULT 1,p_unique boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $function$
BEGIN
 IF jsonb_typeof(p_value) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 IF jsonb_array_length(p_value) NOT BETWEEN p_min AND 128 OR EXISTS(
  SELECT 1 FROM jsonb_array_elements(p_value) item WHERE NOT path_private.valid_text(item)) THEN RETURN false; END IF;
 RETURN NOT p_unique OR (SELECT count(*)=count(DISTINCT path_private.text_key(item)) FROM jsonb_array_elements_text(p_value) item);
END $function$;

CREATE OR REPLACE FUNCTION path_private.only_keys(p_value jsonb,p_keys text[]) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $function$
BEGIN
 IF jsonb_typeof(p_value) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
 RETURN NOT EXISTS(SELECT 1 FROM jsonb_object_keys(p_value) k WHERE NOT k=ANY(p_keys));
END $function$;

CREATE OR REPLACE FUNCTION path_private.valid_local_audio(p_value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path TO '' AS $function$
 SELECT path_private.valid_text(p_value) AND (p_value#>>'{}') LIKE '/%'
  AND (p_value#>>'{}') NOT LIKE '//%' AND (p_value#>>'{}') NOT LIKE E'%\\\\%'
  AND (p_value#>>'{}') !~ '(^|[/?#])\.\.([/?#]|$)'
  AND (p_value#>>'{}') !~* '%(2e|2f|5c)'
  AND (p_value#>>'{}') !~ U&'[\0001-\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF]'
  AND (p_value#>>'{}') !~ '^[a-zA-Z][a-zA-Z0-9+.-]*:'
$function$;

CREATE OR REPLACE FUNCTION path_private.german_task_allowed(p_value jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $function$
DECLARE child jsonb;
BEGIN
 IF jsonb_typeof(p_value)='string' THEN RETURN learning_private.german_text_allowed(p_value#>>'{}'); END IF;
 IF jsonb_typeof(p_value)='array' THEN
  FOR child IN SELECT value FROM jsonb_array_elements(p_value) LOOP
   IF NOT path_private.german_task_allowed(child) THEN RETURN false; END IF;
  END LOOP;
 ELSIF jsonb_typeof(p_value)='object' THEN
  FOR child IN SELECT value FROM jsonb_each(p_value) WHERE key NOT IN ('id','category_id','type','audio') LOOP
   IF NOT path_private.german_task_allowed(child) THEN RETURN false; END IF;
  END LOOP;
 END IF;
 RETURN true;
END $function$;

CREATE OR REPLACE FUNCTION path_private.valid_content(p_type public.exercise_type,p_content jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $function$
DECLARE common_keys text[]:=ARRAY['instruction','target_form']; allowed text[]; item jsonb;
 items jsonb; seen text[]:=ARRAY[]::text[]; left_values text[]:=ARRAY[]::text[]; right_values text[]:=ARRAY[]::text[];
BEGIN
 IF jsonb_typeof(p_content) IS DISTINCT FROM 'object' OR NOT path_private.valid_strings(p_content->'target_form')
  OR (p_content ? 'instruction' AND NOT path_private.valid_text(p_content->'instruction')) THEN RETURN false; END IF;
 allowed:=CASE p_type::text
  WHEN 'multiple_choice' THEN ARRAY['question','options','correct_answer','accepted_answers']
  WHEN 'fill_in_blank' THEN ARRAY['text_before','text_after','options','correct_answer','accepted_answers','needs_article']
  WHEN 'sentence_building' THEN ARRAY['parts','correct_answer','accepted_answers']
  WHEN 'multi_blank' THEN ARRAY['text','blanks']
  WHEN 'matching' THEN ARRAY['pairs']
  WHEN 'categorize' THEN ARRAY['categories','items']
  WHEN 'dialogue' THEN ARRAY['turns']
  WHEN 'listening' THEN ARRAY['transcript','audio','exercise']
  WHEN 'transform' THEN ARRAY['source','accepted_answers','needs_article'] ELSE NULL END;
 IF allowed IS NULL OR NOT path_private.only_keys(p_content,common_keys||allowed)
  OR (p_content ? 'needs_article' AND jsonb_typeof(p_content->'needs_article')<>'boolean') THEN RETURN false; END IF;
 IF NOT path_private.german_task_allowed(p_content) THEN RETURN false; END IF;
 IF p_type::text IN ('multiple_choice','fill_in_blank','sentence_building','transform') THEN
  IF NOT path_private.valid_strings(p_content->'accepted_answers',1,true) THEN RETURN false; END IF;
  IF p_type<>'transform' THEN
   IF jsonb_array_length(p_content->'accepted_answers')>21 OR EXISTS(SELECT 1
    FROM jsonb_array_elements_text(p_content->'accepted_answers') answer WHERE length(answer)>1000) THEN RETURN false; END IF;
   IF NOT path_private.valid_text(p_content->'correct_answer') OR NOT EXISTS(SELECT 1
    FROM jsonb_array_elements_text(p_content->'accepted_answers') answer
    WHERE path_private.text_key(answer)=path_private.text_key(p_content->>'correct_answer')) THEN RETURN false; END IF;
  END IF;
 END IF;
 CASE p_type::text
 WHEN 'multiple_choice' THEN
  IF NOT path_private.valid_text(p_content->'question') OR NOT path_private.valid_strings(p_content->'options',2,true)
   OR jsonb_array_length(p_content->'accepted_answers')<>1 THEN RETURN false; END IF;
  RETURN EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_content->'options') answer
   WHERE path_private.text_key(answer)=path_private.text_key(p_content->>'correct_answer'));
 WHEN 'fill_in_blank' THEN
  RETURN path_private.valid_text(p_content->'text_before',4000,true) AND path_private.valid_text(p_content->'text_after',4000,true)
   AND path_private.valid_text(to_jsonb((p_content->>'text_before')||(p_content->>'text_after')),8000)
   AND (NOT p_content ? 'options' OR (path_private.valid_strings(p_content->'options',2,true)
    AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_content->'options') answer
     WHERE path_private.text_key(answer)=path_private.text_key(p_content->>'correct_answer'))));
 WHEN 'sentence_building' THEN RETURN path_private.valid_strings(p_content->'parts');
 WHEN 'transform' THEN RETURN path_private.valid_text(p_content->'source');
 WHEN 'listening' THEN
  RETURN path_private.valid_text(p_content->'transcript',3000) AND path_private.only_keys(p_content->'audio',ARRAY['normal','slow'])
   AND path_private.valid_local_audio(p_content#>'{audio,normal}') AND path_private.valid_local_audio(p_content#>'{audio,slow}')
   AND path_private.only_keys(p_content->'exercise',ARRAY['type','content'])
   AND coalesce(p_content#>>'{exercise,type}' IN ('multiple_choice','fill_in_blank'),false)
   AND path_private.valid_content((p_content#>>'{exercise,type}')::public.exercise_type,p_content#>'{exercise,content}');
 WHEN 'multi_blank' THEN
  IF NOT path_private.valid_text(p_content->'text') THEN RETURN false; END IF;
  items:=p_content->'blanks';
 WHEN 'matching' THEN items:=p_content->'pairs';
 WHEN 'categorize' THEN
  items:=p_content->'categories';
  IF jsonb_typeof(items) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(items) NOT BETWEEN 2 AND 128 THEN RETURN false; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
   IF NOT path_private.only_keys(item,ARRAY['id','label']) OR NOT path_private.valid_text(item->'id',100)
    OR NOT path_private.valid_text(item->'label') OR (item->>'id')=ANY(seen) THEN RETURN false; END IF;
   seen:=array_append(seen,item->>'id');
  END LOOP;
  left_values:=seen; seen:=ARRAY[]::text[]; items:=p_content->'items';
 WHEN 'dialogue' THEN items:=p_content->'turns';
 ELSE RETURN false;
 END CASE;
 IF jsonb_typeof(items) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 IF jsonb_array_length(items) NOT BETWEEN 1 AND 128 THEN RETURN false; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
  IF NOT path_private.valid_text(item->'id',100) OR (item->>'id')=ANY(seen) THEN RETURN false; END IF;
  seen:=array_append(seen,item->>'id');
  CASE p_type::text
  WHEN 'multi_blank' THEN
   IF NOT path_private.only_keys(item,ARRAY['id','label','accepted_answers','needs_article'])
    OR NOT path_private.valid_strings(item->'accepted_answers',1,true)
    OR (item ? 'label' AND NOT path_private.valid_text(item->'label'))
    OR (item ? 'needs_article' AND jsonb_typeof(item->'needs_article')<>'boolean') THEN RETURN false; END IF;
  WHEN 'matching' THEN
   IF NOT path_private.only_keys(item,ARRAY['id','left','right']) OR NOT path_private.valid_text(item->'left')
    OR NOT path_private.valid_text(item->'right') OR path_private.text_key(item->>'left')=ANY(left_values)
    OR path_private.text_key(item->>'right')=ANY(right_values) THEN RETURN false; END IF;
   left_values:=array_append(left_values,path_private.text_key(item->>'left'));
   right_values:=array_append(right_values,path_private.text_key(item->>'right'));
  WHEN 'categorize' THEN
   IF NOT path_private.only_keys(item,ARRAY['id','text','category_id']) OR NOT path_private.valid_text(item->'text')
    OR NOT path_private.valid_text(item->'category_id',100) OR NOT (item->>'category_id')=ANY(left_values) THEN RETURN false; END IF;
  WHEN 'dialogue' THEN
   IF NOT path_private.valid_text(item->'speaker') OR NOT path_private.valid_text(item->'prompt') THEN RETURN false; END IF;
   IF item->>'type'='multiple_choice' THEN
    IF NOT path_private.only_keys(item,ARRAY['id','speaker','prompt','type','options','correct_answer'])
     OR NOT path_private.valid_strings(item->'options',2,true) OR NOT path_private.valid_text(item->'correct_answer')
     OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(item->'options') answer WHERE path_private.text_key(answer)=path_private.text_key(item->>'correct_answer')) THEN RETURN false; END IF;
   ELSIF item->>'type'='fill_in_blank' THEN
    IF NOT path_private.only_keys(item,ARRAY['id','speaker','prompt','type','accepted_answers','needs_article'])
     OR NOT path_private.valid_strings(item->'accepted_answers',1,true)
     OR (item ? 'needs_article' AND jsonb_typeof(item->'needs_article')<>'boolean') THEN RETURN false; END IF;
   ELSE RETURN false; END IF;
  END CASE;
 END LOOP;
 RETURN true;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END $function$;

-- Preserve the phase-2 payloads verbatim. The node-linked constraint in 35
-- applies the strict contract to all path types, including the old three.
CREATE OR REPLACE FUNCTION grammar_private.valid_accepted_answers(p_content jsonb,p_type public.exercise_type)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $function$
DECLARE answers jsonb:=p_content->'accepted_answers';
BEGIN
 -- A complete typed payload follows the shared Unicode normalization contract.
 -- Unstructured legacy rows retain the predecessor checks below unchanged.
 IF path_private.valid_content(p_type,p_content) THEN RETURN true; END IF;
 IF p_type::text NOT IN ('multiple_choice','fill_in_blank','sentence_building') THEN RETURN path_private.valid_content(p_type,p_content); END IF;
 IF jsonb_typeof(p_content) IS DISTINCT FROM 'object' OR p_content ? 'alternative_answers'
  OR jsonb_typeof(answers) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 IF jsonb_array_length(answers)>21 OR EXISTS(SELECT 1 FROM jsonb_array_elements(answers) a
  WHERE jsonb_typeof(a) IS DISTINCT FROM 'string' OR length(btrim(a#>>'{}')) NOT BETWEEN 1 AND 1000) THEN RETURN false; END IF;
 IF p_type='multiple_choice' AND jsonb_array_length(answers)<>1 THEN RETURN false; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements_text(answers))<>(SELECT count(DISTINCT lower(regexp_replace(btrim(a),'\s+',' ','g')))
  FROM jsonb_array_elements_text(answers) a) THEN RETURN false; END IF;
 RETURN p_type='sentence_building' OR (nullif(btrim(p_content->>'correct_answer'),'') IS NOT NULL AND EXISTS(
  SELECT 1 FROM jsonb_array_elements_text(answers) a WHERE lower(regexp_replace(btrim(a),'\s+',' ','g'))=
   lower(regexp_replace(btrim(p_content->>'correct_answer'),'\s+',' ','g'))));
END $function$;

CREATE OR REPLACE FUNCTION grammar_private.german_content_allowed(p_content jsonb,p_topic text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path TO '' AS $function$
 SELECT path_private.german_task_allowed(jsonb_build_array(p_topic,
  p_content->'instruction',p_content->'text_before',p_content->'text_after',p_content->'question',
  p_content->'correct_answer',p_content->'gap_hint',p_content->'options',p_content->'accepted_answers',
  p_content->'parts',p_content->'target_form',p_content->'text',p_content->'blanks',p_content->'pairs',
  p_content->'categories',p_content->'items',p_content->'turns',p_content->'transcript',
  p_content->'exercise',p_content->'source'))
$function$;

CREATE OR REPLACE FUNCTION path_private.present_content(p_type public.exercise_type,p_content jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $function$
DECLARE output jsonb:='{}'; item jsonb; entries jsonb:='[]'; keys text[]; k text;
BEGIN
 -- Allowlisting is intentional: new authoring fields never become public by
 -- accident. target_form can contain the solution, so it is also withheld.
 keys:=ARRAY['instruction']||CASE p_type::text
  WHEN 'multiple_choice' THEN ARRAY['question','options']
  WHEN 'fill_in_blank' THEN ARRAY['text_before','text_after','needs_article']
  WHEN 'sentence_building' THEN ARRAY['parts']
  WHEN 'multi_blank' THEN ARRAY['text']
  WHEN 'transform' THEN ARRAY['source','needs_article']
  ELSE ARRAY[]::text[] END;
 FOREACH k IN ARRAY keys LOOP
  IF p_content ? k THEN output:=output||jsonb_build_object(k,p_content->k); END IF;
 END LOOP;
 IF p_type='multi_blank' THEN
  FOR item IN SELECT value FROM jsonb_array_elements(p_content->'blanks') LOOP
   entries:=entries||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
    'id',item->'id','label',item->'label','needs_article',item->'needs_article')));
  END LOOP;
  output:=output||jsonb_build_object('blanks',entries);
 ELSIF p_type='matching' THEN
  SELECT jsonb_agg(jsonb_build_object('id',value->'id','text',value->'left') ORDER BY ordinality)
   INTO entries FROM jsonb_array_elements(p_content->'pairs') WITH ORDINALITY;
  output:=output||jsonb_build_object('left',entries);
  SELECT jsonb_agg(jsonb_build_object('id',md5(value->>'right'),'text',value->'right') ORDER BY md5(value->>'right'))
   INTO entries FROM jsonb_array_elements(p_content->'pairs');
  output:=output||jsonb_build_object('right',entries);
 ELSIF p_type='categorize' THEN
  SELECT jsonb_agg(jsonb_build_object('id',value->'id','label',value->'label') ORDER BY ordinality)
   INTO entries FROM jsonb_array_elements(p_content->'categories') WITH ORDINALITY;
  output:=output||jsonb_build_object('categories',entries);
  SELECT jsonb_agg(jsonb_build_object('id',value->'id','text',value->'text') ORDER BY ordinality)
   INTO entries FROM jsonb_array_elements(p_content->'items') WITH ORDINALITY;
  output:=output||jsonb_build_object('items',entries);
 ELSIF p_type='dialogue' THEN
  FOR item IN SELECT value FROM jsonb_array_elements(p_content->'turns') LOOP
   entries:=entries||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('id',item->'id',
    'speaker',item->'speaker','prompt',item->'prompt','type',item->'type',
    'options',item->'options','needs_article',item->'needs_article')));
  END LOOP;
  output:=output||jsonb_build_object('turns',entries);
 ELSIF p_type='listening' THEN
  output:=output||jsonb_build_object('audio',jsonb_build_object('normal',p_content#>'{audio,normal}','slow',p_content#>'{audio,slow}'));
  output:=output||jsonb_build_object('exercise',jsonb_build_object('type',p_content#>'{exercise,type}',
   'content',path_private.present_content((p_content#>>'{exercise,type}')::public.exercise_type,p_content#>'{exercise,content}')));
 END IF;
 RETURN output;
END $function$;

CREATE OR REPLACE FUNCTION path_private.grade(p_type public.exercise_type,p_content jsonb,p_answer jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE item jsonb; submitted jsonb; field_grade jsonb; fields jsonb:='[]'; mapping jsonb; items jsonb;
 key_name text; field_id text; composed text; position integer; matched boolean;
 status learning_private.answer_status:='EXACT'; count_items integer;
 invalid jsonb:='{"error":"invalid_answer","message":"The answer does not match this exercise.","sqlstate":"22023"}';
BEGIN
 IF NOT path_private.valid_content(p_type,p_content) THEN
  RETURN jsonb_build_object('error','invalid_content','message','The exercise content is invalid.','sqlstate','22023');
 END IF;
 IF jsonb_typeof(p_answer) IS DISTINCT FROM 'object' THEN RETURN invalid; END IF;
 IF p_type='listening' THEN RETURN path_private.grade((p_content#>>'{exercise,type}')::public.exercise_type,p_content#>'{exercise,content}',p_answer); END IF;
 IF p_type IN ('fill_in_blank','transform') THEN
  IF NOT path_private.only_keys(p_answer,ARRAY['text']) OR NOT path_private.valid_text(p_answer->'text') THEN RETURN invalid; END IF;
  field_grade:=learning_private.grade_answer(p_answer->>'text',ARRAY(SELECT jsonb_array_elements_text(p_content->'accepted_answers')));
  IF field_grade ? 'error' THEN RETURN field_grade; END IF;
  fields:=jsonb_build_array(jsonb_build_object('id','answer')||field_grade);
 ELSIF p_type='multiple_choice' THEN
  IF NOT path_private.only_keys(p_answer,ARRAY['index']) OR jsonb_typeof(p_answer->'index') IS DISTINCT FROM 'number'
   OR (p_answer->>'index') !~ '^[0-9]+$' THEN RETURN invalid; END IF;
  position:=(p_answer->>'index')::integer;
  IF position>=jsonb_array_length(p_content->'options') THEN RETURN invalid; END IF;
  matched:=path_private.text_key(p_content->'options'->>position)=path_private.text_key(p_content->>'correct_answer');
  fields:=jsonb_build_array(jsonb_build_object('id','answer','status',CASE WHEN matched THEN 'EXACT' ELSE 'INCORRECT' END));
 ELSIF p_type='sentence_building' THEN
  IF NOT path_private.only_keys(p_answer,ARRAY['indices']) OR jsonb_typeof(p_answer->'indices') IS DISTINCT FROM 'array' THEN RETURN invalid; END IF;
  count_items:=jsonb_array_length(p_content->'parts');
  IF jsonb_array_length(p_answer->'indices')<>count_items OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_answer->'indices') i
   WHERE jsonb_typeof(i)<>'number' OR (i#>>'{}') !~ '^[0-9]+$') THEN RETURN invalid; END IF;
  IF (SELECT count(DISTINCT value) FROM jsonb_array_elements(p_answer->'indices'))<>count_items
   OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_answer->'indices') i WHERE i::numeric>=count_items) THEN RETURN invalid; END IF;
  SELECT string_agg(p_content->'parts'->>(value::integer),' ' ORDER BY ordinality) INTO composed
   FROM jsonb_array_elements_text(p_answer->'indices') WITH ORDINALITY;
  field_grade:=learning_private.grade_answer(composed,ARRAY(SELECT jsonb_array_elements_text(p_content->'accepted_answers')));
  IF field_grade ? 'error' THEN RETURN field_grade; END IF;
  fields:=jsonb_build_array(jsonb_build_object('id','answer')||field_grade);
 ELSE
  key_name:=CASE p_type::text WHEN 'multi_blank' THEN 'values' WHEN 'matching' THEN 'pairs'
   WHEN 'categorize' THEN 'assignments' WHEN 'dialogue' THEN 'replies' END;
  IF key_name IS NULL OR NOT path_private.only_keys(p_answer,ARRAY[key_name]) OR jsonb_typeof(p_answer->key_name) IS DISTINCT FROM 'object' THEN RETURN invalid; END IF;
  mapping:=p_answer->key_name;
  items:=p_content->CASE p_type::text WHEN 'multi_blank' THEN 'blanks' WHEN 'matching' THEN 'pairs'
   WHEN 'categorize' THEN 'items' WHEN 'dialogue' THEN 'turns' END;
  IF (SELECT count(*) FROM jsonb_object_keys(mapping))<>jsonb_array_length(items) THEN RETURN invalid; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
   field_id:=item->>'id'; submitted:=mapping->field_id;
   IF submitted IS NULL THEN RETURN invalid; END IF;
   IF p_type='multi_blank' OR (p_type='dialogue' AND item->>'type'='fill_in_blank') THEN
    IF NOT path_private.valid_text(submitted) THEN RETURN invalid; END IF;
    field_grade:=learning_private.grade_answer(submitted#>>'{}',ARRAY(SELECT jsonb_array_elements_text(item->'accepted_answers')));
    IF field_grade ? 'error' THEN RETURN field_grade; END IF;
   ELSE
    IF p_type='dialogue' THEN
     IF jsonb_typeof(submitted) IS DISTINCT FROM 'number' OR (submitted#>>'{}') !~ '^[0-9]+$' THEN RETURN invalid; END IF;
     position:=(submitted#>>'{}')::integer;
     IF position>=jsonb_array_length(item->'options') THEN RETURN invalid; END IF;
     matched:=path_private.text_key(item->'options'->>position)=path_private.text_key(item->>'correct_answer');
    ELSIF p_type='matching' THEN
     IF NOT path_private.valid_text(submitted,100) OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(items) i
      WHERE md5(i->>'right')=submitted#>>'{}') THEN RETURN invalid; END IF;
     matched:=submitted#>>'{}'=md5(item->>'right');
    ELSE
     IF NOT path_private.valid_text(submitted,100) OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_content->'categories') i
      WHERE i->>'id'=submitted#>>'{}') THEN RETURN invalid; END IF;
     matched:=submitted#>>'{}'=item->>'category_id';
    END IF;
    field_grade:=jsonb_build_object('status',CASE WHEN matched THEN 'EXACT' ELSE 'INCORRECT' END);
   END IF;
   fields:=fields||jsonb_build_array(jsonb_build_object('id',field_id)||field_grade);
  END LOOP;
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(fields) f WHERE f->>'status'='INCORRECT') THEN status:='INCORRECT';
 ELSIF EXISTS(SELECT 1 FROM jsonb_array_elements(fields) f WHERE f->>'status'='SOFT_ERROR') THEN status:='SOFT_ERROR'; END IF;
 SELECT jsonb_agg(f||jsonb_build_object('correct',f->>'status'<>'INCORRECT') ORDER BY ordinality)
  INTO fields FROM jsonb_array_elements(fields) WITH ORDINALITY AS rows(f,ordinality);
 RETURN jsonb_build_object('status',status,'correct',status<>'INCORRECT','fields',fields);
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN invalid;
END $function$;

-- Only pure validation helpers are callable under CHECK constraints. Grading
-- and serialization stay private to authenticated public RPC boundaries.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA path_private FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA path_private TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION path_private.valid_text(jsonb,integer,boolean),path_private.text_key(text),
 path_private.valid_strings(jsonb,integer,boolean),path_private.only_keys(jsonb,text[]),
 path_private.valid_local_audio(jsonb),path_private.german_task_allowed(jsonb),
 path_private.valid_content(public.exercise_type,jsonb) TO authenticated,service_role;
GRANT USAGE ON SCHEMA path_private TO postgres;
-- Scope the grant to this migration. A replay after 35–39 must not grant
-- additional privileges on helpers introduced by those later migrations.
GRANT EXECUTE ON FUNCTION path_private.valid_text(jsonb,integer,boolean),path_private.text_key(text),
 path_private.valid_strings(jsonb,integer,boolean),path_private.only_keys(jsonb,text[]),
 path_private.valid_local_audio(jsonb),path_private.german_task_allowed(jsonb),
 path_private.valid_content(public.exercise_type,jsonb),path_private.present_content(public.exercise_type,jsonb),
 path_private.grade(public.exercise_type,jsonb,jsonb) TO postgres;
