-- Apply after learning.sql: a resource has one source URL; a missing source is a draft.
-- Existing DW links remain byte-for-byte unchanged. Never infer a provider from old flags.
CREATE TEMP TABLE canonical_videos_before ON COMMIT DROP AS
 SELECT id,to_jsonb(v)-'video_url'-'external_url'-'is_external' AS payload,
 coalesce(nullif(btrim(external_url),''),nullif(btrim(video_url),'')) AS source_url FROM public.learning_videos v;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.learning_videos WHERE nullif(btrim(video_url),'') IS NOT NULL
  AND nullif(btrim(external_url),'') IS NOT NULL AND video_url IS DISTINCT FROM external_url)
 THEN RAISE EXCEPTION 'Conflicting video sources require explicit review'; END IF;
END $$;
ALTER TABLE public.learning_videos ADD COLUMN source_url text;
UPDATE public.learning_videos v SET source_url=b.source_url FROM canonical_videos_before b WHERE b.id=v.id;
UPDATE public.learning_units u SET is_active=false FROM public.learning_videos v WHERE v.unit_id=u.id AND v.source_url IS NULL;
ALTER TABLE public.learning_videos DROP COLUMN video_url,DROP COLUMN external_url,DROP COLUMN is_external;
ALTER TABLE public.learning_videos ADD CONSTRAINT learning_videos_source_url_check
 CHECK(source_url IS NULL OR source_url ~* '^https?://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$');
CREATE FUNCTION learning_private.validate_video_publication() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.learning_videos v JOIN public.learning_units u ON u.id=v.unit_id
  WHERE v.source_url IS NULL AND u.is_active
  AND ((TG_TABLE_NAME='learning_videos' AND v.id=NEW.id) OR (TG_TABLE_NAME='learning_units' AND u.id=NEW.id)))
 THEN RAISE EXCEPTION 'Published learning resources require a source URL' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION learning_private.validate_video_publication() FROM PUBLIC,anon;
CREATE CONSTRAINT TRIGGER validate_video_publication AFTER INSERT OR UPDATE ON public.learning_videos
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION learning_private.validate_video_publication();
CREATE CONSTRAINT TRIGGER validate_video_unit_publication AFTER INSERT OR UPDATE ON public.learning_units
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION learning_private.validate_video_publication();
CREATE OR REPLACE FUNCTION public.save_learning_content(p_trainer text,p_payload jsonb,p_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE old_fields jsonb; fields jsonb; unit_data jsonb:=p_payload->'unit'; translations jsonb:=p_payload->'translations';
 item uuid:=coalesce(p_id,gen_random_uuid()); old_unit uuid; target_unit uuid; old_meta public.learning_units; translation_row jsonb;
BEGIN
 IF current_user NOT IN('service_role','postgres') AND coalesce(identity_private.current_profile_role(),'') NOT IN('teacher','admin') THEN RAISE EXCEPTION 'Staff required' USING ERRCODE='42501'; END IF;
 IF p_trainer IS NULL OR NOT EXISTS(SELECT 1 FROM public.learning_trainers WHERE code=p_trainer)
 OR jsonb_typeof(unit_data) IS DISTINCT FROM 'object' OR jsonb_typeof(p_payload->'fields') IS DISTINCT FROM 'object'
 OR nullif(btrim(unit_data->>'label'),'') IS NULL OR NOT EXISTS(SELECT 1 FROM public.learning_levels WHERE code=unit_data->>'level') THEN
 RAISE EXCEPTION 'Invalid content' USING ERRCODE='23514'; END IF;
 IF p_id IS NOT NULL THEN
  IF p_trainer='vocabulary' THEN SELECT to_jsonb(c),c.unit_id INTO old_fields,old_unit FROM public.learning_vocabulary_cards c WHERE c.id=p_id;
  ELSIF p_trainer='exercises' THEN SELECT to_jsonb(c),c.unit_id INTO old_fields,old_unit FROM public.learning_exercises c WHERE c.id=p_id;
  ELSIF p_trainer='pronunciation' THEN SELECT to_jsonb(c),c.unit_id INTO old_fields,old_unit FROM public.learning_reading_texts c WHERE c.id=p_id;
  ELSE SELECT to_jsonb(c),c.unit_id INTO old_fields,old_unit FROM public.learning_videos c WHERE c.id=p_id; END IF;
  IF old_fields IS NULL THEN RAISE EXCEPTION 'Content unavailable' USING ERRCODE='23514'; END IF;
  SELECT * INTO old_meta FROM public.learning_units WHERE id=old_unit;
 END IF;
 fields:=coalesce(old_fields,'{}'::jsonb)||(p_payload->'fields');
 IF p_trainer IN('vocabulary','exercises') THEN
  IF old_unit IS NOT NULL AND old_meta.level=unit_data->>'level' AND old_meta.label=unit_data->>'label' THEN target_unit:=old_unit;
  ELSE target_unit:=learning_private.ensure_unit(NULL,unit_data->>'level',p_trainer,unit_data->>'label'); END IF;
 ELSE
  target_unit:=learning_private.ensure_unit(old_unit,unit_data->>'level',p_trainer,unit_data->>'label',
    coalesce((unit_data->>'is_active')::boolean,old_meta.is_active,true),coalesce((unit_data->>'sort_order')::integer,old_meta.sort_order,100));
 END IF;
 IF p_trainer IN('vocabulary','exercises') THEN
  IF jsonb_typeof(translations) IS DISTINCT FROM 'array'
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(translations) t WHERE NOT EXISTS(SELECT 1 FROM public.locales WHERE code=t->>'locale'))
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(translations) t GROUP BY t->>'locale' HAVING count(*)>1) THEN
  RAISE EXCEPTION 'Invalid translations' USING ERRCODE='23514'; END IF;
 END IF;
 IF p_trainer='vocabulary' THEN
  IF coalesce((fields->>'sentence_practice')::boolean,false) AND EXISTS(SELECT 1 FROM public.locales l WHERE NOT EXISTS(
   SELECT 1 FROM jsonb_array_elements(translations) t WHERE t->>'locale'=l.code AND nullif(btrim(t->>'context_sentence'),'') IS NOT NULL)) THEN
  RAISE EXCEPTION 'Sentence translations required' USING ERRCODE='23514'; END IF;
  INSERT INTO public.learning_vocabulary_cards(id,unit_id,word_de,article,plural,image_url,audio_url,sentence_practice,alternative_answers_de)
  VALUES(item,target_unit,fields->>'word_de',fields->>'article',fields->>'plural',fields->>'image_url',fields->>'audio_url',coalesce((fields->>'sentence_practice')::boolean,false),
  ARRAY(SELECT jsonb_array_elements_text(coalesce(fields->'alternative_answers_de','[]'::jsonb))))
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,word_de=excluded.word_de,article=excluded.article,plural=excluded.plural,
  image_url=excluded.image_url,audio_url=excluded.audio_url,sentence_practice=excluded.sentence_practice,alternative_answers_de=excluded.alternative_answers_de;
  DELETE FROM public.vocabulary_translations WHERE card_id=item;
  FOR translation_row IN SELECT value FROM jsonb_array_elements(translations) LOOP
   INSERT INTO public.vocabulary_translations(card_id,locale,translation,context_sentence,is_difficult)
   VALUES(item,translation_row->>'locale',translation_row->>'translation',translation_row->>'context_sentence',coalesce((translation_row->>'is_difficult')::boolean,false));
  END LOOP;
 ELSIF p_trainer='exercises' THEN
  IF fields->>'type' NOT IN('fill_in_blank','multiple_choice') OR jsonb_typeof(fields->'content') IS DISTINCT FROM 'object'
  OR nullif(btrim(fields->'content'->>'correct_answer'),'') IS NULL OR (fields->'content') ?| ARRAY['smart_hint','explanation'] THEN
  RAISE EXCEPTION 'Invalid exercise' USING ERRCODE='23514'; END IF;
  INSERT INTO public.learning_exercises(id,unit_id,topic,type,content,solution_audio_url)
  VALUES(item,target_unit,fields->>'topic',fields->>'type',fields->'content',fields->>'solution_audio_url')
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,topic=excluded.topic,type=excluded.type,content=excluded.content,solution_audio_url=excluded.solution_audio_url;
  DELETE FROM public.grammar_translations WHERE exercise_id=item;
  FOR translation_row IN SELECT value FROM jsonb_array_elements(translations) LOOP
   INSERT INTO public.grammar_translations(exercise_id,locale,hint,smart_hint,explanation)
   VALUES(item,translation_row->>'locale',translation_row->>'hint',translation_row->>'smart_hint',translation_row->>'explanation');
  END LOOP;
 ELSIF p_trainer='pronunciation' THEN
  INSERT INTO public.learning_reading_texts(id,unit_id,sentence_de,focus,audio_url)
  VALUES(item,target_unit,fields->>'sentence_de',fields->>'focus',fields->>'audio_url')
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,sentence_de=excluded.sentence_de,focus=excluded.focus,audio_url=excluded.audio_url;
 ELSE
  INSERT INTO public.learning_videos(id,unit_id,description,source_url)
  VALUES(item,target_unit,fields->>'description',nullif(btrim(fields->>'source_url'),''))
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,description=excluded.description,source_url=excluded.source_url;
 END IF;
 IF old_unit IS NOT NULL AND old_unit<>target_unit THEN
  DELETE FROM public.learning_units u WHERE u.id=old_unit
  AND NOT EXISTS(SELECT 1 FROM public.learning_vocabulary_cards c WHERE c.unit_id=u.id)
  AND NOT EXISTS(SELECT 1 FROM public.learning_exercises c WHERE c.unit_id=u.id)
  AND NOT EXISTS(SELECT 1 FROM public.learning_reading_texts c WHERE c.unit_id=u.id)
  AND NOT EXISTS(SELECT 1 FROM public.learning_videos c WHERE c.unit_id=u.id);
 END IF;
 RETURN jsonb_build_object('id',item);
END $$;

DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM canonical_videos_before b LEFT JOIN public.learning_videos v ON v.id=b.id
 WHERE v.id IS NULL OR b.payload IS DISTINCT FROM (to_jsonb(v)-'source_url') OR b.source_url IS DISTINCT FROM v.source_url)
 OR (SELECT count(*) FROM canonical_videos_before)<>(SELECT count(*) FROM public.learning_videos)
 THEN RAISE EXCEPTION 'Video resource preservation failed'; END IF;
END $$;
