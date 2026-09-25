-- Scoped, idempotent rollback of Phase 1.4, after a fresh migrate-local.py backup.
-- Deploy the matching old application first. Keep the optional column/archive:
-- new CMS content is retained, never dropped. Cards modified after 31 are left intact.
DO $migration$
DECLARE definition text; before_text text; after_text text;
BEGIN
 definition:=pg_get_functiondef('public.save_learning_content(text,jsonb,uuid)'::regprocedure);
 before_text:=$before$  INSERT INTO public.learning_vocabulary_cards(id,unit_id,word_de,article,plural,image_url,audio_url,sentence_practice,alternative_answers_de)
  VALUES(item,target_unit,fields->>'word_de',(fields->>'article')::public.grammatical_article,fields->>'plural',fields->>'image_url',fields->>'audio_url',coalesce((fields->>'sentence_practice')::boolean,false),
  ARRAY(SELECT jsonb_array_elements_text(coalesce(fields->'alternative_answers_de','[]'::jsonb))))
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,word_de=excluded.word_de,article=excluded.article,plural=excluded.plural,
  image_url=excluded.image_url,audio_url=excluded.audio_url,sentence_practice=excluded.sentence_practice,alternative_answers_de=excluded.alternative_answers_de;$before$;
 after_text:=$after$  -- phase1-vocabulary-target-form-v1
  IF fields->'target_form' IS NOT NULL AND fields->'target_form'<>'null'::jsonb THEN
   IF jsonb_typeof(fields->'target_form') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid target form' USING ERRCODE='23514'; END IF;
   IF jsonb_array_length(fields->'target_form')>12 OR EXISTS(SELECT 1 FROM jsonb_array_elements(fields->'target_form') value
    WHERE jsonb_typeof(value) IS DISTINCT FROM 'string' OR length(btrim(value#>>'{}')) NOT BETWEEN 1 AND 120)
   THEN RAISE EXCEPTION 'Invalid target form' USING ERRCODE='23514'; END IF;
  END IF;
  INSERT INTO public.learning_vocabulary_cards(id,unit_id,word_de,article,plural,image_url,audio_url,sentence_practice,alternative_answers_de,target_form)
  VALUES(item,target_unit,fields->>'word_de',(fields->>'article')::public.grammatical_article,fields->>'plural',fields->>'image_url',fields->>'audio_url',coalesce((fields->>'sentence_practice')::boolean,false),
  ARRAY(SELECT jsonb_array_elements_text(coalesce(fields->'alternative_answers_de','[]'::jsonb))),
  CASE WHEN fields->'target_form' IS NULL OR fields->'target_form'='null'::jsonb THEN NULL ELSE ARRAY(SELECT btrim(value) FROM jsonb_array_elements_text(fields->'target_form')) END)
  ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id,word_de=excluded.word_de,article=excluded.article,plural=excluded.plural,
  image_url=excluded.image_url,audio_url=excluded.audio_url,sentence_practice=excluded.sentence_practice,alternative_answers_de=excluded.alternative_answers_de,target_form=excluded.target_form;$after$;
 IF strpos(definition,after_text)>0 THEN EXECUTE replace(definition,after_text,before_text);
 ELSIF strpos(definition,before_text)=0 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='vocabulary_target_form_cms_rollback_source_drift'; END IF;
END $migration$;
DO $data$
BEGIN
 IF to_regclass('learning_private.vocabulary_variant_backups') IS NOT NULL THEN
  WITH restored AS (
   UPDATE public.learning_vocabulary_cards c SET target_form=b.previous_target_form,alternative_answers_de=b.previous_alternatives
   FROM learning_private.vocabulary_variant_backups b WHERE c.id=b.card_id AND b.is_active
    AND c.target_form IS NOT DISTINCT FROM b.applied_target_form AND c.alternative_answers_de=b.applied_alternatives
   RETURNING c.id
  ) UPDATE learning_private.vocabulary_variant_backups b SET is_active=false FROM restored r WHERE b.card_id=r.id;
 END IF;
END $data$;
