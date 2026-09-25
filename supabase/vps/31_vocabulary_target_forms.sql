-- Phase 1.4. R8: run only through migrate-local.py after its verified backup.
-- Rollback: rollback/31_vocabulary_target_forms.sql. No learner progress changes.
ALTER TABLE public.learning_vocabulary_cards ADD COLUMN IF NOT EXISTS target_form text[];
COMMENT ON COLUMN public.learning_vocabulary_cards.target_form IS 'Optional German target forms displayed before a typed sentence answer.';

-- Extend only the vocabulary branch; preserve current security, media and grammar guards.
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
 IF strpos(definition,after_text)>0 THEN NULL;
 ELSIF strpos(definition,before_text)>0 THEN EXECUTE replace(definition,before_text,after_text);
 ELSE RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='vocabulary_target_form_cms_source_drift'; END IF;
END $migration$;

-- Explicit per-card decisions from the read-only 26-sentence inventory.
-- The private archive retains original arrays. Replays do not overwrite staff edits.
CREATE TABLE IF NOT EXISTS learning_private.vocabulary_variant_backups (
 card_id uuid PRIMARY KEY,
 previous_target_form text[], previous_alternatives text[] NOT NULL,
 applied_target_form text[], applied_alternatives text[] NOT NULL,
 is_active boolean NOT NULL DEFAULT true
);
REVOKE ALL ON TABLE learning_private.vocabulary_variant_backups FROM PUBLIC,anon,authenticated,service_role;
WITH decisions(card_id,sentence,target_form,alternatives) AS (VALUES
 ('0e418b9e-c02d-4148-b262-a608d369cadb'::uuid,'Wie ist Ihre Telefonnummer?',ARRAY['Ihre']::text[],ARRAY[]::text[]),
 ('3d4ea48d-5efe-460b-bdfe-3e14f5f2bb21'::uuid,'Ich wohne in Deutschland.',NULL::text[],ARRAY['In Deutschland wohne ich.']::text[]),
 ('48c57bb9-a03c-4a4d-b386-28b95975d66b'::uuid,'Welche Sprache sprechen Sie?',ARRAY['Sie']::text[],ARRAY[]::text[]),
 ('59ffe0cf-f9c7-455a-b086-54153690cbce'::uuid,'Woher kommen Sie?',ARRAY['Sie']::text[],ARRAY[]::text[]),
 ('70d12be8-01c9-48a2-b2ca-cac05066412d'::uuid,'Wie ist Ihr Name?',ARRAY['Ihr','Name']::text[],ARRAY[]::text[]),
 ('b15bfa51-740c-4eac-813b-6fca868eabbd'::uuid,'Danke für Ihre Hilfe!',ARRAY['Ihre']::text[],ARRAY[]::text[]),
 ('e9871cab-6f5b-4a30-9cd1-f6bd2406bfda'::uuid,'Wie ist Ihre Adresse?',ARRAY['Ihre']::text[],ARRAY[]::text[]),
 ('69d845b3-4310-4919-986a-80bf913822b0'::uuid,'Ich wohne in Hannover.',NULL::text[],ARRAY['In Hannover wohne ich.']::text[]),
 ('770b2edb-43a1-4935-adbd-9570c39b46e5'::uuid,'Meine Familie lebt in Deutschland.',NULL::text[],ARRAY['In Deutschland lebt meine Familie.']::text[]),
 ('fc3f909e-d640-4664-a559-d971861e0613'::uuid,'Ich trinke morgens Kaffee.',NULL::text[],ARRAY['Morgens trinke ich Kaffee.']::text[]),
 ('d280c958-b4fe-4b4f-97ff-b75f8fb7a899'::uuid,'Ich koche in der Küche.',NULL::text[],ARRAY['In der Küche koche ich.']::text[]),
 ('2ad0f4dc-7dbc-423d-87b8-aa67f2c94114'::uuid,'Ich arbeite von Montag bis Freitag.',NULL::text[],ARRAY['Von Montag bis Freitag arbeite ich.']::text[]),
 ('b957a819-1077-4bdb-8de8-a7e770d2642f'::uuid,'Ich bin heute sehr müde.',NULL::text[],ARRAY['Heute bin ich sehr müde.']::text[]),
 ('e0fe2ac8-8518-48f8-862d-02fdf4cdf44c'::uuid,'Wie ist das Wetter heute?',NULL::text[],ARRAY['Wie ist heute das Wetter?']::text[]),
 ('f125e23c-f5c1-4604-b418-8937982aca06'::uuid,'Woher kommen Sie?',ARRAY['Sie']::text[],ARRAY[]::text[])
), archived AS (
 INSERT INTO learning_private.vocabulary_variant_backups AS backup
  (card_id,previous_target_form,previous_alternatives,applied_target_form,applied_alternatives,is_active)
 SELECT c.id,c.target_form,c.alternative_answers_de,
  CASE WHEN cardinality(coalesce(c.target_form,ARRAY[]::text[]))>0 THEN c.target_form ELSE d.target_form END,
  c.alternative_answers_de||ARRAY(SELECT a FROM unnest(d.alternatives) a WHERE NOT a=ANY(c.alternative_answers_de)),true
 FROM decisions d JOIN public.learning_vocabulary_cards c ON c.id=d.card_id
 JOIN public.learning_units u ON u.id=c.unit_id
 JOIN public.vocabulary_translations t ON t.card_id=c.id AND t.locale='de'
 WHERE c.sentence_practice AND u.is_active AND u.owner_auth_user_id IS NULL AND t.context_sentence=d.sentence
 ON CONFLICT(card_id) DO UPDATE SET previous_target_form=excluded.previous_target_form,previous_alternatives=excluded.previous_alternatives,
  applied_target_form=excluded.applied_target_form,applied_alternatives=excluded.applied_alternatives,is_active=true
 WHERE NOT backup.is_active
 RETURNING card_id,applied_target_form,applied_alternatives
)
UPDATE public.learning_vocabulary_cards c SET target_form=a.applied_target_form,alternative_answers_de=a.applied_alternatives
FROM archived a WHERE c.id=a.card_id;
