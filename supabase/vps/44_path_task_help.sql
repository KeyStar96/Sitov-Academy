-- Learning path: help with the German task (Phase-8 prompt, items 1 and 2).
-- Requires 43. Apply via deploy/vps/migrate-local.py with a verified backup.
--
--  * Translation help: grammar_translations.task holds the task (question,
--    sentence or target sentence) in the learner's interface language.
--    present() now returns "translation": {task, gap_hint} next to the German
--    task. The German task and the German answer options stay unchanged.
--  * Unambiguous gaps: fill_in_blank content may carry "gap_hint", the German
--    base form (infinitive for verbs) of the searched word. Where the base form
--    equals the answer, grammar_translations.gap_hint names its meaning in the
--    interface language instead. Both are shown in the gap, never graded.
--  * Seed shape, catalog import and export know both fields.
-- No learner data is written. Rollback restores the saved definitions and
-- drops the two columns.

ALTER TABLE public.grammar_translations ADD COLUMN IF NOT EXISTS task text;
ALTER TABLE public.grammar_translations ADD COLUMN IF NOT EXISTS gap_hint text;
COMMENT ON COLUMN public.grammar_translations.task IS 'Learning path (44): the German task (question, sentence or target sentence) translated into this interface locale. Shown only on request next to the unchanged German task.';
COMMENT ON COLUMN public.grammar_translations.gap_hint IS 'Learning path (44): meaning of the searched word of a fill_in_blank task in this interface locale, used when its German base form would equal the answer.';

CREATE TABLE IF NOT EXISTS path_private.task_help_function_backups(signature text PRIMARY KEY,definition text NOT NULL);
ALTER TABLE path_private.task_help_function_backups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON path_private.task_help_function_backups FROM PUBLIC,anon,authenticated;
DO $$ DECLARE signature text; BEGIN
 FOREACH signature IN ARRAY ARRAY['path_private.valid_content(public.exercise_type,jsonb)','path_private.present_content(public.exercise_type,jsonb)','path_private.snapshot(uuid)','path_private.present(jsonb,text)','path_private.valid_seed_shape(jsonb)','path_private.import_path_catalog(jsonb,uuid)','public.export_learning_path(uuid)'] LOOP
  INSERT INTO path_private.task_help_function_backups VALUES(signature,pg_get_functiondef(signature::regprocedure)) ON CONFLICT DO NOTHING;
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION path_private.valid_content(p_type public.exercise_type,p_content jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $function$
DECLARE common_keys text[]:=ARRAY['instruction','target_form']; allowed text[]; item jsonb;
 items jsonb; seen text[]:=ARRAY[]::text[]; left_values text[]:=ARRAY[]::text[]; right_values text[]:=ARRAY[]::text[];
BEGIN
 IF jsonb_typeof(p_content) IS DISTINCT FROM 'object' OR NOT path_private.valid_strings(p_content->'target_form')
  OR (p_content ? 'instruction' AND NOT path_private.valid_text(p_content->'instruction')) THEN RETURN false; END IF;
 allowed:=CASE p_type::text
  WHEN 'multiple_choice' THEN ARRAY['question','options','correct_answer','accepted_answers']
  WHEN 'fill_in_blank' THEN ARRAY['text_before','text_after','options','correct_answer','accepted_answers','needs_article','gap_hint']
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
  -- gap_hint (44): German base form of the searched word, shown in the gap.
  IF p_content ? 'gap_hint' AND NOT path_private.valid_text(p_content->'gap_hint',100) THEN RETURN false; END IF;
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

CREATE OR REPLACE FUNCTION path_private.present_content(p_type public.exercise_type,p_content jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $function$
DECLARE output jsonb:='{}'; item jsonb; entries jsonb:='[]'; keys text[]; k text;
BEGIN
 -- Allowlisting is intentional: new authoring fields never become public by
 -- accident. target_form can contain the solution, so it is also withheld.
 keys:=ARRAY['instruction']||CASE p_type::text
  WHEN 'multiple_choice' THEN ARRAY['question','options']
  WHEN 'fill_in_blank' THEN ARRAY['text_before','text_after','needs_article','gap_hint']
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

CREATE OR REPLACE FUNCTION path_private.snapshot(p_exercise uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('id',e.id,'type',e.type,'content',e.content,'goal_id',e.goal_id,
 'translations',coalesce((SELECT jsonb_object_agg(t.locale,jsonb_build_object('instruction',t.instruction,'hint',t.hint,'explanation',t.explanation,'prompt',t.prompt,'task',t.task,'gap_hint',t.gap_hint)) FROM public.grammar_translations t WHERE t.exercise_id=e.id),'{}'::jsonb))
 FROM public.learning_exercises e WHERE e.id=p_exercise;
$$;

CREATE OR REPLACE FUNCTION path_private.present(p_snapshot jsonb,p_locale text) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 -- The German task stays German. The learner's interface language only comes
 -- with it as optional help (44): "translation" = {task, gap_hint}. Help texts
 -- never grade anything, so tasks frozen before 44 fall back to the catalog.
 WITH live AS (
  SELECT (SELECT e.content->'gap_hint' FROM public.learning_exercises e
           WHERE e.id=(p_snapshot->>'id')::uuid AND p_snapshot->>'type'='fill_in_blank') gap_hint,
         (SELECT jsonb_build_object('task',t.task,'gap_hint',t.gap_hint) FROM public.grammar_translations t
           WHERE t.exercise_id=(p_snapshot->>'id')::uuid AND t.locale=p_locale AND p_locale<>'de') help
 ), merged AS (
  SELECT CASE WHEN p_snapshot->>'type'='fill_in_blank' THEN coalesce(p_snapshot->'content'->'gap_hint',live.gap_hint) END gap_hint,
   CASE WHEN p_locale<>'de' THEN jsonb_strip_nulls(jsonb_build_object(
    'task',coalesce(nullif(btrim(p_snapshot->'translations'->p_locale->>'task'),''),nullif(btrim(live.help->>'task'),'')),
    'gap_hint',coalesce(nullif(btrim(p_snapshot->'translations'->p_locale->>'gap_hint'),''),nullif(btrim(live.help->>'gap_hint'),''))))
   ELSE '{}'::jsonb END translation
  FROM live
 )
 SELECT jsonb_build_object('id',p_snapshot->'id','type',p_snapshot->'type','content',
  path_private.present_content((p_snapshot->>'type')::public.exercise_type,p_snapshot->'content') ||
  CASE WHEN nullif(p_snapshot->'translations'->p_locale->>'instruction','') IS NOT NULL THEN jsonb_build_object('instruction',p_snapshot->'translations'->p_locale->>'instruction') ELSE '{}'::jsonb END ||
  CASE WHEN nullif(p_snapshot->'translations'->p_locale->>'prompt','') IS NOT NULL THEN jsonb_build_object('prompt',p_snapshot->'translations'->p_locale->>'prompt') ELSE '{}'::jsonb END ||
  CASE WHEN jsonb_typeof(merged.gap_hint)='string' AND btrim(merged.gap_hint#>>'{}')<>'' THEN jsonb_build_object('gap_hint',merged.gap_hint) ELSE '{}'::jsonb END)
  || CASE WHEN merged.translation<>'{}'::jsonb THEN jsonb_build_object('translation',merged.translation) ELSE '{}'::jsonb END
 FROM merged;
$$;

CREATE OR REPLACE FUNCTION path_private.valid_seed_shape(p_path jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE n jsonb; e jsonb; o jsonb; card jsonb; lang text; translated jsonb;
 node_ids text[]:='{}'; objective_ids text[]:='{}'; exercise_ids text[]:='{}'; refs text[]:='{}'; node_orders integer[]:='{}';
BEGIN
 IF NOT path_private.only_keys(p_path,ARRAY['id','level','path','slug','title','translations','unit','objectives','nodes','is_active'])
  OR NOT path_private.valid_text(p_path->'id',100) OR NOT path_private.valid_text(p_path->'title')
  OR NOT path_private.valid_text(p_path->'slug',160) OR (p_path->>'slug') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  OR coalesce(p_path->>'level' NOT IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2'),true)
  OR jsonb_typeof(p_path->'path') IS DISTINCT FROM 'number' OR (p_path->>'path') !~ '^[1-9][0-9]*$'
  OR (p_path ? 'is_active' AND jsonb_typeof(p_path->'is_active')<>'boolean')
  OR NOT path_private.only_keys(p_path->'unit',ARRAY['level','trainer','label','sort_order'])
  OR NOT path_private.valid_text(p_path->'unit'->'label') OR p_path->'unit'->'sort_order' IS DISTINCT FROM p_path->'path'
  OR (p_path->'unit'->>'trainer') IS DISTINCT FROM 'exercises' OR p_path->'unit'->'level' IS DISTINCT FROM p_path->'level'
  OR NOT path_private.only_keys(p_path->'translations',ARRAY['en','ru','uk','tr'])
  OR jsonb_typeof(p_path->'objectives') IS DISTINCT FROM 'array' OR jsonb_typeof(p_path->'nodes') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 IF jsonb_array_length(p_path->'objectives') NOT BETWEEN 1 AND 128 OR jsonb_array_length(p_path->'nodes')<3 THEN RETURN false; END IF;
 FOR lang IN SELECT unnest(ARRAY['en','ru','uk','tr']) LOOP
  IF NOT path_private.only_keys(p_path->'translations'->lang,ARRAY['title'])
   OR NOT path_private.valid_text(p_path->'translations'->lang->'title') THEN RETURN false; END IF;
 END LOOP;
 FOR o IN SELECT value FROM jsonb_array_elements(p_path->'objectives') LOOP
  IF NOT path_private.only_keys(o,ARRAY['id','area','description']) OR NOT path_private.valid_text(o->'id',100)
   OR NOT path_private.valid_text(o->'description') OR coalesce(o->>'area' NOT IN('grammar','communication','can_do','vocabulary'),true)
   OR o->>'id'=ANY(objective_ids) THEN RETURN false; END IF;
  objective_ids:=array_append(objective_ids,o->>'id');
 END LOOP;
 FOR n IN SELECT value FROM jsonb_array_elements(p_path->'nodes') LOOP
  IF NOT path_private.only_keys(n,ARRAY['id','kind','sort_order','is_active','topic','title','translations','goals','merkkarte','test_size','anchor_node_id','exercises'])
   OR NOT path_private.valid_text(n->'id',100) OR NOT path_private.valid_text(n->'title') OR NOT path_private.valid_text(n->'topic')
   OR coalesce(n->>'kind' NOT IN('practice','review','test','special'),true)
   OR jsonb_typeof(n->'sort_order') IS DISTINCT FROM 'number' OR (n->>'sort_order') !~ '^[1-9][0-9]*$'
   OR n->>'id'=ANY(node_ids) OR (n->>'sort_order')::integer=ANY(node_orders)
   OR (n ? 'is_active' AND jsonb_typeof(n->'is_active')<>'boolean')
   OR NOT path_private.valid_strings(n->'goals') OR NOT path_private.only_keys(n->'translations',ARRAY['en','ru','uk','tr'])
   OR jsonb_typeof(n->'exercises') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(n->'exercises')<1 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(n->'goals') g WHERE length(g)>100 OR NOT g=ANY(objective_ids))
   OR (SELECT count(*)<>count(DISTINCT value) FROM jsonb_array_elements_text(n->'goals')) THEN RETURN false; END IF;
  IF (n->>'kind'='test') IS DISTINCT FROM (n ? 'test_size') OR (n->>'kind'='special') IS DISTINCT FROM (n ? 'anchor_node_id')
   OR (n ? 'anchor_node_id' AND NOT path_private.valid_text(n->'anchor_node_id',100))
   OR (n ? 'test_size' AND (jsonb_typeof(n->'test_size')<>'number' OR (n->>'test_size') !~ '^[1-9][0-9]*$' OR (n->>'test_size')::integer>128))
   OR (n->>'kind'='test' AND n ? 'merkkarte') OR (n->>'kind'='practice' AND NOT n ? 'merkkarte') THEN RETURN false; END IF;
  node_ids:=array_append(node_ids,n->>'id'); node_orders:=array_append(node_orders,(n->>'sort_order')::integer);
  card:=n->'merkkarte';
  IF n ? 'merkkarte' THEN
   IF NOT path_private.only_keys(card,ARRAY['card','rule','examples','highlight','translations'])
    OR NOT path_private.valid_text(card->'card',100) OR NOT path_private.valid_text(card->'rule')
    OR NOT path_private.valid_strings(card->'examples') OR NOT card ? 'highlight'
    OR (card->'highlight'<>'null'::jsonb AND coalesce(card->>'highlight' NOT IN('article','verb'),true))
    OR NOT path_private.only_keys(card->'translations',ARRAY['en','ru','uk','tr']) THEN RETURN false; END IF;
  END IF;
  FOR lang IN SELECT unnest(ARRAY['en','ru','uk','tr']) LOOP
   IF NOT path_private.only_keys(n->'translations'->lang,ARRAY['title']) OR NOT path_private.valid_text(n->'translations'->lang->'title') THEN RETURN false; END IF;
   IF card IS NOT NULL AND (NOT path_private.only_keys(card->'translations'->lang,ARRAY['rule']) OR NOT path_private.valid_text(card->'translations'->lang->'rule')) THEN RETURN false; END IF;
  END LOOP;
  FOR e IN SELECT value FROM jsonb_array_elements(n->'exercises') LOOP
   IF NOT path_private.only_keys(e,ARRAY['id','ref','goal','exercise_type','content','accepted_answers','hint','explanation','explanation_card','translations'])
    OR NOT path_private.valid_text(e->'id') OR (e->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    OR e->>'id'=ANY(exercise_ids) OR NOT path_private.valid_text(e->'ref',100) OR e->>'ref'=ANY(refs)
    OR NOT path_private.valid_text(e->'goal',100) OR NOT (n->'goals') ? (e->>'goal')
    OR NOT path_private.valid_text(e->'hint') OR NOT path_private.valid_text(e->'explanation') OR NOT path_private.valid_text(e->'explanation_card',100)
    OR NOT learning_private.german_text_allowed((e->>'hint')||(e->>'explanation'))
    OR NOT path_private.only_keys(e->'translations',ARRAY['en','ru','uk','tr'])
    OR NOT path_private.valid_content((e->>'exercise_type')::public.exercise_type,e->'content')
    OR (e ? 'accepted_answers' AND e->'accepted_answers' IS DISTINCT FROM e->'content'->'accepted_answers') THEN RETURN false; END IF;
   exercise_ids:=array_append(exercise_ids,e->>'id'); refs:=array_append(refs,e->>'ref');
   FOR lang IN SELECT unnest(ARRAY['en','ru','uk','tr']) LOOP
    translated:=e->'translations'->lang;
    IF NOT path_private.only_keys(translated,ARRAY['instruction','hint','explanation','prompt','task','gap_hint'])
     OR (translated ? 'task' AND NOT path_private.valid_text(translated->'task'))
     OR (translated ? 'gap_hint' AND (e->>'exercise_type' IS DISTINCT FROM 'fill_in_blank' OR NOT path_private.valid_text(translated->'gap_hint',100)))
     OR NOT path_private.valid_text(translated->'instruction') OR NOT path_private.valid_text(translated->'hint') OR NOT path_private.valid_text(translated->'explanation')
     OR (translated ? 'prompt' AND NOT path_private.valid_text(translated->'prompt')) THEN RETURN false; END IF;
   END LOOP;
  END LOOP;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(n->'goals') g WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(n->'exercises') ex WHERE ex->>'goal'=g)) THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END $$;

CREATE OR REPLACE FUNCTION path_private.import_path_catalog(p_path jsonb,p_actor uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE actor uuid; unit uuid; node uuid; anchor uuid; node_data jsonb; exercise jsonb; objective jsonb; lang text;
 task_id uuid; exercise_count integer:=0; node_count integer:=0; kind public.path_node_kind; tests integer; reviews integer; practices integer;
BEGIN
 actor:=p_actor;
 IF NOT path_private.valid_seed_shape(p_path) THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(p_path) IS DISTINCT FROM 'object' OR jsonb_typeof(p_path->'nodes') IS DISTINCT FROM 'array'
  OR jsonb_typeof(p_path->'objectives') IS DISTINCT FROM 'array' OR nullif(p_path->>'id','') IS NULL
  OR (p_path->'unit'->>'trainer') IS DISTINCT FROM 'exercises' OR (p_path->'unit'->>'level') IS DISTINCT FROM (p_path->>'level')
  OR (p_path->'unit'->>'sort_order')::integer IS DISTINCT FROM (p_path->>'path')::integer THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('path-catalog:'||(p_path->>'level'),0));
 SELECT id INTO unit FROM public.learning_units WHERE is_path AND level=p_path->>'level' AND path_source_id=p_path->>'id' FOR UPDATE;
 IF unit IS NULL THEN
  INSERT INTO public.learning_units(level,trainer,label,sort_order,is_path,path_source_id,path_slug,path_title,is_active)
   VALUES(p_path->>'level','exercises',p_path->'unit'->>'label',(p_path->>'path')::integer,true,p_path->>'id',p_path->>'slug',p_path->>'title',coalesce((p_path->>'is_active')::boolean,true)) RETURNING id INTO unit;
 ELSE
  UPDATE public.learning_units SET label=p_path->'unit'->>'label',sort_order=(p_path->>'path')::integer,path_slug=p_path->>'slug',path_title=p_path->>'title',is_active=coalesce((p_path->>'is_active')::boolean,true) WHERE id=unit;
 END IF;
 FOR lang IN SELECT unnest(ARRAY['de','en','ru','uk','tr']) LOOP
  INSERT INTO public.path_unit_translations(unit_id,locale,title) VALUES(unit,lang,CASE WHEN lang='de' THEN p_path->>'title' ELSE nullif(p_path->'translations'->lang->>'title','') END)
  ON CONFLICT(unit_id,locale) DO UPDATE SET title=excluded.title;
 END LOOP;
 FOR objective IN SELECT value FROM jsonb_array_elements(p_path->'objectives') LOOP
  INSERT INTO public.path_objectives(unit_id,id,area,description) VALUES(unit,objective->>'id',(objective->>'area')::public.path_objective_area,objective->>'description')
  ON CONFLICT(unit_id,id) DO UPDATE SET area=excluded.area,description=excluded.description;
 END LOOP;
 -- Preserve catalog records referenced by old attempts. Omitted records become inactive.
 UPDATE public.path_nodes SET is_active=false WHERE unit_id=unit;
 UPDATE public.learning_exercises SET path_is_active=false WHERE unit_id=unit AND node_id IS NOT NULL;
 -- Anchors are always regular nodes; import them before special branches.
 FOR node_data IN SELECT value FROM jsonb_array_elements(p_path->'nodes') ORDER BY (value->>'kind'='special'),(value->>'sort_order')::integer LOOP
  kind:=(node_data->>'kind')::public.path_node_kind;
  anchor:=NULL;
  IF kind='special' THEN
   SELECT id INTO anchor FROM public.path_nodes WHERE unit_id=unit AND source_id=node_data->>'anchor_node_id' AND is_active;
   IF anchor IS NULL THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
  END IF;
  INSERT INTO public.path_nodes(unit_id,source_id,kind,sort_order,title,topic,merkkarte,goals,anchor_node_id,test_size,is_active,created_by)
   VALUES(unit,node_data->>'id',kind,(node_data->>'sort_order')::integer,node_data->>'title',node_data->>'topic',nullif(node_data->'merkkarte','null'::jsonb)-'translations',
    ARRAY(SELECT jsonb_array_elements_text(node_data->'goals')),anchor,(node_data->>'test_size')::integer,coalesce((node_data->>'is_active')::boolean,true),actor)
  ON CONFLICT(unit_id,source_id) DO UPDATE SET kind=excluded.kind,sort_order=excluded.sort_order,title=excluded.title,topic=excluded.topic,
   merkkarte=excluded.merkkarte,goals=excluded.goals,anchor_node_id=excluded.anchor_node_id,test_size=excluded.test_size,is_active=excluded.is_active RETURNING id INTO node;
  node_count:=node_count+1;
  FOR lang IN SELECT unnest(ARRAY['de','en','ru','uk','tr']) LOOP
   INSERT INTO public.path_node_translations(node_id,locale,title,rule) VALUES(node,lang,
    CASE WHEN lang='de' THEN node_data->>'title' ELSE nullif(node_data->'translations'->lang->>'title','') END,
    CASE WHEN lang='de' THEN node_data->'merkkarte'->>'rule' ELSE node_data->'merkkarte'->'translations'->lang->>'rule' END)
   ON CONFLICT(node_id,locale) DO UPDATE SET title=excluded.title,rule=excluded.rule;
   IF kind='practice' AND NOT EXISTS(SELECT 1 FROM public.path_node_translations WHERE node_id=node AND locale=lang AND nullif(btrim(rule),'') IS NOT NULL) THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
  END LOOP;
  FOR exercise IN SELECT value||jsonb_build_object('_position',ordinality) FROM jsonb_array_elements(node_data->'exercises') WITH ORDINALITY LOOP
   task_id:=(exercise->>'id')::uuid;
   IF EXISTS(SELECT 1 FROM public.learning_exercises WHERE id=task_id AND (unit_id<>unit OR node_id IS NULL)) THEN RAISE EXCEPTION 'request_conflict' USING ERRCODE='22023'; END IF;
   IF exercise ? 'accepted_answers' AND exercise->'accepted_answers' IS DISTINCT FROM exercise->'content'->'accepted_answers' THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
   INSERT INTO public.learning_exercises(id,unit_id,node_id,goal_id,source_ref,sort_order,topic,type,content,path_is_active,explanation_card)
    VALUES(task_id,unit,node,exercise->>'goal',exercise->>'ref',(exercise->>'_position')::integer,node_data->>'topic',(exercise->>'exercise_type')::public.exercise_type,exercise->'content',true,exercise->>'explanation_card')
   ON CONFLICT(id) DO UPDATE SET node_id=excluded.node_id,goal_id=excluded.goal_id,source_ref=excluded.source_ref,sort_order=excluded.sort_order,topic=excluded.topic,type=excluded.type,content=excluded.content,path_is_active=true,explanation_card=excluded.explanation_card;
   FOR lang IN SELECT unnest(ARRAY['de','en','ru','uk','tr']) LOOP
    INSERT INTO public.grammar_translations(exercise_id,locale,hint,explanation,instruction,prompt,task,gap_hint) VALUES(task_id,lang,
     CASE WHEN lang='de' THEN exercise->>'hint' ELSE exercise->'translations'->lang->>'hint' END,
     CASE WHEN lang='de' THEN exercise->>'explanation' ELSE exercise->'translations'->lang->>'explanation' END,
     CASE WHEN lang='de' THEN exercise->'content'->>'instruction' ELSE exercise->'translations'->lang->>'instruction' END,
     exercise->'translations'->lang->>'prompt',
     CASE WHEN lang='de' THEN NULL ELSE nullif(btrim(exercise->'translations'->lang->>'task'),'') END,
     CASE WHEN lang='de' THEN NULL ELSE nullif(btrim(exercise->'translations'->lang->>'gap_hint'),'') END)
    ON CONFLICT(exercise_id,locale) DO UPDATE SET hint=excluded.hint,explanation=excluded.explanation,instruction=excluded.instruction,prompt=excluded.prompt,task=excluded.task,gap_hint=excluded.gap_hint;
   END LOOP;
   exercise_count:=exercise_count+1;
  END LOOP;
 END LOOP;
 SELECT count(*) FILTER(WHERE n.kind='test'),count(*) FILTER(WHERE n.kind='review'),count(*) FILTER(WHERE n.kind='practice') INTO tests,reviews,practices FROM public.path_nodes n WHERE n.unit_id=unit AND n.is_active;
 IF tests<>1 OR reviews<>1 OR practices<1 OR EXISTS(SELECT 1 FROM public.path_nodes n WHERE n.unit_id=unit AND n.is_active AND NOT EXISTS(SELECT 1 FROM public.learning_exercises e WHERE e.node_id=n.id AND e.path_is_active))
  OR EXISTS(SELECT 1 FROM public.path_nodes t JOIN public.path_nodes n ON n.unit_id=t.unit_id WHERE t.unit_id=unit AND t.is_active AND n.is_active AND ((t.kind='test' AND n.kind IN('practice','review')) OR (t.kind='review' AND n.kind='practice')) AND n.sort_order>t.sort_order)
  OR EXISTS(SELECT 1 FROM public.path_nodes t WHERE t.unit_id=unit AND t.kind='test' AND t.is_active AND (
    t.test_size>(SELECT count(*)/2 FROM public.learning_exercises e WHERE e.node_id=t.id AND e.path_is_active)
    OR t.test_size<(SELECT count(*) FROM public.path_objectives o WHERE o.unit_id=unit)
    OR EXISTS(SELECT 1 FROM public.path_objectives o WHERE o.unit_id=unit AND NOT EXISTS(SELECT 1 FROM public.learning_exercises e WHERE e.node_id=t.id AND e.path_is_active AND e.goal_id=o.id)))) THEN RAISE EXCEPTION 'test_pool_invalid' USING ERRCODE='23514'; END IF;
 RETURN jsonb_build_object('unit_id',unit,'node_count',node_count,'exercise_count',exercise_count);
END $$;

CREATE OR REPLACE FUNCTION public.export_learning_path(p_unit_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u public.learning_units; payload jsonb; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF NOT business_private.is_staff() THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
 SELECT * INTO u FROM public.learning_units WHERE id=p_unit_id AND is_path;
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 SELECT jsonb_build_object('id',u.path_source_id,'level',u.level,'path',u.sort_order,'slug',u.path_slug,'title',u.path_title,'is_active',u.is_active,
  'unit',jsonb_build_object('level',u.level,'trainer','exercises','label',u.label,'sort_order',u.sort_order),
  'translations',coalesce((SELECT jsonb_object_agg(locale,jsonb_build_object('title',title)) FROM public.path_unit_translations WHERE unit_id=u.id AND locale<>'de'),'{}'::jsonb),
  'objectives',(SELECT jsonb_agg(jsonb_build_object('id',id,'area',area,'description',description) ORDER BY id) FROM public.path_objectives WHERE unit_id=u.id),
  'nodes',(SELECT jsonb_agg(path_private.without_null_fields(jsonb_build_object('id',n.source_id,'kind',n.kind,'sort_order',n.sort_order,'topic',n.topic,'title',n.title,'goals',to_jsonb(n.goals),
   'test_size',n.test_size,'anchor_node_id',(SELECT source_id FROM public.path_nodes WHERE id=n.anchor_node_id),
   'translations',(SELECT jsonb_object_agg(locale,jsonb_build_object('title',title)) FROM public.path_node_translations WHERE node_id=n.id AND locale<>'de'),
   'merkkarte',CASE WHEN n.merkkarte IS NULL THEN NULL ELSE n.merkkarte||jsonb_build_object('translations',(SELECT jsonb_object_agg(locale,jsonb_build_object('rule',rule)) FROM public.path_node_translations WHERE node_id=n.id AND locale<>'de')) END,
   'exercises',(SELECT jsonb_agg(path_private.without_null_fields(jsonb_build_object('id',e.id,'ref',e.source_ref,'goal',e.goal_id,'exercise_type',e.type,'content',e.content,
    'accepted_answers',e.content->'accepted_answers','hint',de.hint,'explanation',de.explanation,'explanation_card',e.explanation_card,
    'translations',(SELECT jsonb_object_agg(t.locale,path_private.without_null_fields(jsonb_build_object('instruction',t.instruction,'hint',t.hint,'explanation',t.explanation,'prompt',t.prompt,'task',t.task,'gap_hint',t.gap_hint))) FROM public.grammar_translations t WHERE t.exercise_id=e.id AND t.locale<>'de'))) ORDER BY e.sort_order,e.id)
    FROM public.learning_exercises e LEFT JOIN public.grammar_translations de ON de.exercise_id=e.id AND de.locale='de' WHERE e.node_id=n.id AND e.path_is_active))) ORDER BY n.sort_order) FROM public.path_nodes n WHERE n.unit_id=u.id AND n.is_active)) INTO payload;
 RETURN payload;
EXCEPTION WHEN OTHERS THEN RETURN path_private.error(SQLERRM,SQLSTATE); END $$;

-- CREATE OR REPLACE keeps the existing privileges; restate them explicitly.
REVOKE ALL ON FUNCTION path_private.present(jsonb,text),path_private.snapshot(uuid),path_private.present_content(public.exercise_type,jsonb),
 path_private.import_path_catalog(jsonb,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.export_learning_path(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.export_learning_path(uuid) TO authenticated;
