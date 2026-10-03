-- Sitov Academy word/chunk cards. Apply after prepared publication migration 71.
-- Additive only: legacy IDs, answers, progress, recordings and activity remain.
ALTER TABLE public.learning_vocabulary_cards
 ADD COLUMN IF NOT EXISTS content_kind text NOT NULL DEFAULT 'vocabulary',
 ADD COLUMN IF NOT EXISTS chunk_de text,
 ADD COLUMN IF NOT EXISTS source_id text;
ALTER TABLE public.vocabulary_translations ADD COLUMN IF NOT EXISTS chunk_translation text;
DO $constraints$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.learning_vocabulary_cards'::regclass AND conname='sitov_vocabulary_kind_check') THEN
  ALTER TABLE public.learning_vocabulary_cards ADD CONSTRAINT sitov_vocabulary_kind_check CHECK(content_kind IN('vocabulary','chunk'));
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.learning_vocabulary_cards'::regclass AND conname='sitov_vocabulary_chunk_check') THEN
  ALTER TABLE public.learning_vocabulary_cards ADD CONSTRAINT sitov_vocabulary_chunk_check CHECK(chunk_de IS NULL OR length(btrim(chunk_de)) BETWEEN 1 AND 500);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.learning_vocabulary_cards'::regclass AND conname='sitov_vocabulary_chunk_article_check') THEN
  ALTER TABLE public.learning_vocabulary_cards ADD CONSTRAINT sitov_vocabulary_chunk_article_check CHECK(content_kind<>'chunk' OR article IS NULL OR article='none');
 END IF;
END $constraints$;
CREATE UNIQUE INDEX IF NOT EXISTS sitov_vocabulary_source_idx ON public.learning_vocabulary_cards(source_id) WHERE source_id IS NOT NULL;
COMMENT ON COLUMN public.learning_vocabulary_cards.content_kind IS 'A teacher vocabulary_card remains one word card with an embedded chunk; only an explicit chunk_card is a separate card.';
COMMENT ON COLUMN public.learning_vocabulary_cards.chunk_de IS 'Same-card German usage chunk; separate prepared audio required before publication.';
COMMENT ON COLUMN public.learning_vocabulary_cards.source_id IS 'Stable Sitov Academy authoring identity; independent of existing database/card progress IDs.';
CREATE TABLE IF NOT EXISTS vocabulary_private.sitov_seed_card_origins(
 card_id uuid PRIMARY KEY REFERENCES public.learning_vocabulary_cards(id) ON DELETE CASCADE,
 preserve_core boolean NOT NULL
);
ALTER TABLE vocabulary_private.sitov_seed_card_origins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE vocabulary_private.sitov_seed_card_origins FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON TABLE vocabulary_private.sitov_seed_card_origins TO service_role;

-- Explicit, baseline-checked male-character revisions retain historical German
-- answers separately from the current display/audio text. No old variant is
-- added to the spoken sources or exposed as learner content.
CREATE TABLE IF NOT EXISTS vocabulary_private.sitov_legacy_card_revisions(
 card_id uuid PRIMARY KEY REFERENCES public.learning_vocabulary_cards(id) ON DELETE CASCADE,
 baseline jsonb NOT NULL, replacement jsonb NOT NULL,
 word_answers text[] NOT NULL, sentence_answers text[] NOT NULL
);
ALTER TABLE vocabulary_private.sitov_legacy_card_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE vocabulary_private.sitov_legacy_card_revisions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE vocabulary_private.sitov_legacy_card_revisions TO service_role;

-- Existing accepted sentence arrays keep their exact values. Historical word
-- answers need their own format, because sentence alternatives have never been
-- word answers. Keep function OIDs/security/ACLs and both RPC error boundaries.
DO $historic_answers$
DECLARE definition text; before_text text; after_text text; signature text;
BEGIN
 definition:=pg_get_functiondef('vocabulary_private.answer_key(uuid,text,text)'::regprocedure);
 IF strpos(definition,'-- sitov-legacy-vocabulary-answers-v1')=0 THEN
  before_text:=$before$ IF nullif(btrim(canonical),'') IS NULL THEN RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE='23514'; END IF;$before$;
  after_text:=$after$ -- sitov-legacy-vocabulary-answers-v1
 IF p_direction='native_to_de' THEN
  accepted:=accepted||coalesce((SELECT CASE WHEN card.sentence_practice THEN r.sentence_answers ELSE r.word_answers END
   FROM vocabulary_private.sitov_legacy_card_revisions r WHERE r.card_id=card.id),ARRAY[]::text[]);
 END IF;
 IF nullif(btrim(canonical),'') IS NULL THEN RAISE EXCEPTION 'exercise_unavailable' USING ERRCODE='23514'; END IF;$after$;
  IF strpos(definition,before_text)=0 THEN RAISE EXCEPTION 'sitov_legacy_answer_key_source_drift' USING ERRCODE='23514'; END IF;
  EXECUTE replace(definition,before_text,after_text);
 END IF;
 FOREACH signature IN ARRAY ARRAY['vocabulary_private.submit_answer(uuid,boolean,text,text)','vocabulary_private.check_retry_answer(uuid,text,text)'] LOOP
  definition:=pg_get_functiondef(signature::regprocedure);
  IF strpos(definition,'-- sitov-legacy-vocabulary-article-v1')>0 THEN CONTINUE; END IF;
  before_text:=$before$ IF progress.direction='native_to_de' AND NOT card.sentence_practice THEN$before$;
  after_text:=$after$ -- sitov-legacy-vocabulary-article-v1
 IF progress.direction='native_to_de' AND NOT card.sentence_practice
  AND NOT EXISTS(SELECT 1 FROM vocabulary_private.sitov_legacy_card_revisions r
   WHERE r.card_id=card.id AND grade->>'matched'=ANY(r.word_answers)) THEN$after$;
  IF strpos(definition,before_text)=0 THEN RAISE EXCEPTION 'sitov_legacy_article_source_drift' USING ERRCODE='23514'; END IF;
  EXECUTE replace(definition,before_text,after_text);
 END LOOP;
END $historic_answers$;

-- Extend the shared source extractor: CMS and seed imports use the same exact
-- German word, usage chunk and example. Keep the helper's original OID/ACL.
DO $audio$ DECLARE definition text; before_text text; after_text text; BEGIN
 definition:=pg_get_functiondef('learning_private.sitov_learning_audio_texts(text,jsonb,jsonb)'::regprocedure);
 IF strpos(definition,'-- sitov-vocabulary-chunk-audio-v1')>0 THEN RETURN; END IF;
 before_text:=$before$  IF jsonb_typeof(p_translations)='array' THEN$before$;
 after_text:=$after$  -- sitov-vocabulary-chunk-audio-v1
  IF jsonb_typeof(p_fields->'chunk_de')='string' THEN
   texts:=array_append(texts,p_fields->>'chunk_de');
  END IF;
  IF jsonb_typeof(p_translations)='array' THEN$after$;
 IF strpos(definition,before_text)=0 THEN RAISE EXCEPTION 'sitov_chunk_audio_source_drift' USING ERRCODE='23514'; END IF;
 EXECUTE replace(definition,before_text,after_text);
END $audio$;

-- The standard staff editor preserves omitted card fields through its existing
-- merge. Include localized chunks before the publication proof reads the row.
DO $cms$ DECLARE definition text; before_text text; after_text text; BEGIN
 definition:=pg_get_functiondef('public.save_learning_content(text,jsonb,uuid)'::regprocedure);
 IF strpos(definition,'-- sitov-vocabulary-chunk-cms-v1')>0 THEN RETURN; END IF;
 before_text:=$before$  DELETE FROM public.vocabulary_translations WHERE card_id=item;$before$;
 after_text:=$after$  -- sitov-vocabulary-chunk-cms-v1
  UPDATE public.learning_vocabulary_cards SET content_kind=coalesce(fields->>'content_kind','vocabulary'),
   chunk_de=nullif(btrim(fields->>'chunk_de'),'') WHERE id=item;
  -- Older CMS callers may omit this additive field. Preserve it per locale;
  -- an explicit null still clears it. Merge before existing translation cleanup.
  SELECT coalesce(jsonb_agg(CASE WHEN t ? 'chunk_translation' THEN t ELSE
   t || jsonb_build_object('chunk_translation',stored.chunk_translation) END),'[]'::jsonb) INTO translations
   FROM jsonb_array_elements(translations) t LEFT JOIN public.vocabulary_translations stored
    ON stored.card_id=item AND stored.locale=t->>'locale';
  DELETE FROM public.vocabulary_translations WHERE card_id=item;$after$;
 IF strpos(definition,before_text)=0 THEN RAISE EXCEPTION 'sitov_chunk_cms_source_drift' USING ERRCODE='23514'; END IF;
 definition:=replace(definition,before_text,after_text);
 before_text:=$before$INSERT INTO public.vocabulary_translations(card_id,locale,translation,context_sentence,is_difficult)
   VALUES(item,translation_row->>'locale',translation_row->>'translation',translation_row->>'context_sentence',coalesce((translation_row->>'is_difficult')::boolean,false));$before$;
 after_text:=$after$INSERT INTO public.vocabulary_translations(card_id,locale,translation,context_sentence,is_difficult,chunk_translation)
   VALUES(item,translation_row->>'locale',translation_row->>'translation',translation_row->>'context_sentence',coalesce((translation_row->>'is_difficult')::boolean,false),translation_row->>'chunk_translation');$after$;
 IF strpos(definition,before_text)=0 THEN RAISE EXCEPTION 'sitov_chunk_translation_cms_source_drift' USING ERRCODE='23514'; END IF;
 EXECUTE replace(definition,before_text,after_text);
END $cms$;

CREATE OR REPLACE FUNCTION public.sitov_import_vocabulary_seed(p_seed jsonb,p_publish boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO '' AS $$
DECLARE unit_data jsonb; card_data jsonb; localized jsonb; lang text; target_unit uuid; target_card uuid;
 existing_card public.learning_vocabulary_cards; preserve_core boolean; unit_count integer:=0; card_count integer:=0;
 vocabulary_count integer:=0; chunk_count integer:=0; reused_count integer:=0; source_key text; word text; selected_article text;
 unit_results jsonb:='[]'::jsonb; card_results jsonb; kind text; chunk text;
 legacy_baseline jsonb; current_baseline jsonb; replacement_fields jsonb; historical vocabulary_private.sitov_legacy_card_revisions;
 revision_applied boolean; old_context text; old_word text; old_plural text; historical_words text[];
BEGIN
 -- Direct database role, never a user-editable JWT claim. No student/staff
 -- callable privileged bridge: this API is only for trusted local seed imports.
 IF current_user NOT IN('service_role','postgres','supabase_admin') THEN RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501'; END IF;
 IF p_publish IS NULL OR jsonb_typeof(p_seed) IS DISTINCT FROM 'object' OR p_seed->>'version' IS DISTINCT FROM '1'
  OR jsonb_typeof(p_seed->'units') IS DISTINCT FROM 'array' OR jsonb_array_length(p_seed->'units') NOT BETWEEN 1 AND 100 THEN
  RAISE EXCEPTION 'invalid_vocabulary_seed' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_seed->'units') u GROUP BY u->>'level',u->>'label' HAVING count(*)>1)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_seed->'units') u CROSS JOIN LATERAL jsonb_array_elements(u->'cards') c GROUP BY c->>'source_id' HAVING count(*)>1)
  OR (SELECT count(*) FROM jsonb_array_elements(p_seed->'units') u CROSS JOIN LATERAL jsonb_array_elements(u->'cards') c)>10000 THEN
  RAISE EXCEPTION 'invalid_vocabulary_seed' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('sitov-vocabulary-seed',0));
 FOR unit_data IN SELECT value FROM jsonb_array_elements(p_seed->'units') LOOP
  IF jsonb_typeof(unit_data) IS DISTINCT FROM 'object' OR unit_data->>'level' IS NULL OR unit_data->>'level' NOT IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2')
   OR nullif(btrim(unit_data->>'label'),'') IS NULL OR unit_data->>'label'='Eigene Wörter'
   OR length(unit_data->>'label')>200 OR jsonb_typeof(unit_data->'cards') IS DISTINCT FROM 'array'
   OR jsonb_array_length(unit_data->'cards') NOT BETWEEN 1 AND 1000 THEN
   RAISE EXCEPTION 'invalid_vocabulary_seed' USING ERRCODE='22023'; END IF;
  SELECT u.id INTO target_unit FROM public.learning_units u WHERE u.level=unit_data->>'level' AND u.trainer='vocabulary'
   AND u.label=unit_data->>'label' AND u.owner_auth_user_id IS NULL FOR UPDATE;
  IF target_unit IS NULL THEN
   target_unit:=(unit_data->>'id')::uuid;
   INSERT INTO public.learning_units(id,level,trainer,label,sort_order,is_active)
    VALUES(target_unit,unit_data->>'level','vocabulary',unit_data->>'label',(unit_data->>'sort_order')::integer,p_publish);
  ELSE
   -- A draft import never makes previously active content unavailable.
   UPDATE public.learning_units SET is_active=is_active OR p_publish WHERE id=target_unit;
  END IF;
  card_results:='[]'::jsonb;
  FOR card_data IN SELECT value FROM jsonb_array_elements(unit_data->'cards') LOOP
   source_key:=card_data->>'source_id'; word:=btrim(card_data->>'word_de'); kind:=card_data->>'content_kind';
   selected_article:=nullif(card_data->>'article','none'); chunk:=nullif(btrim(card_data->>'chunk_de'),'');
   IF jsonb_typeof(card_data) IS DISTINCT FROM 'object' OR jsonb_typeof(card_data->'source_id') IS DISTINCT FROM 'string' OR nullif(source_key,'') IS NULL OR length(source_key)>160
    OR word IS NULL OR length(word) NOT BETWEEN 1 AND 500 OR kind IS NULL OR kind NOT IN('vocabulary','chunk')
    OR (selected_article IS NOT NULL AND selected_article NOT IN('der','die','das')) OR (kind='chunk' AND selected_article IS NOT NULL)
    OR NOT learning_private.german_text_allowed(word) OR NOT learning_private.german_text_allowed(chunk)
    OR jsonb_typeof(card_data->'sentence_practice') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(card_data->'translations') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid_vocabulary_seed' USING ERRCODE='22023'; END IF;
   FOREACH lang IN ARRAY ARRAY['de','en','ru','uk','tr'] LOOP
    localized:=card_data->'translations'->lang;
    IF jsonb_typeof(localized) IS DISTINCT FROM 'object' OR nullif(btrim(localized->>'context_sentence'),'') IS NULL
     OR (lang<>'de' AND nullif(btrim(localized->>'translation'),'') IS NULL)
     OR (lang<>'de' AND chunk IS NOT NULL AND nullif(btrim(localized->>'chunk_translation'),'') IS NULL) THEN
     RAISE EXCEPTION 'invalid_vocabulary_seed' USING ERRCODE='22023'; END IF;
    IF lang='de' AND NOT learning_private.german_text_allowed(localized->>'context_sentence') THEN
     RAISE EXCEPTION 'invalid_vocabulary_seed' USING ERRCODE='22023'; END IF;
   END LOOP;
   SELECT c.* INTO existing_card FROM public.learning_vocabulary_cards c WHERE c.source_id=source_key FOR UPDATE;
   IF existing_card.id IS NULL THEN
    SELECT c.* INTO existing_card FROM public.learning_vocabulary_cards c WHERE c.id=(card_data->>'id')::uuid FOR UPDATE;
   END IF;
   IF existing_card.id IS NULL THEN
    IF (SELECT count(*) FROM public.learning_vocabulary_cards c WHERE c.unit_id=target_unit AND c.source_id IS NULL
     AND lower(btrim(c.word_de))=lower(word) AND coalesce(nullif(c.article::text,'none'),'')=coalesce(selected_article,''))>1 THEN
     RAISE EXCEPTION 'ambiguous_vocabulary_identity' USING ERRCODE='23514'; END IF;
    SELECT c.* INTO existing_card FROM public.learning_vocabulary_cards c WHERE c.unit_id=target_unit AND c.source_id IS NULL
     AND lower(btrim(c.word_de))=lower(word) AND coalesce(nullif(c.article::text,'none'),'')=coalesce(selected_article,'') FOR UPDATE;
   END IF;
   IF existing_card.id IS NULL THEN
    IF card_data ? 'legacy_revision' THEN RAISE EXCEPTION 'legacy_revision_requires_existing_card' USING ERRCODE='23514'; END IF;
    target_card:=(card_data->>'id')::uuid; preserve_core:=false; revision_applied:=false;
    INSERT INTO public.learning_vocabulary_cards(id,unit_id,word_de,article,plural,sentence_practice,alternative_answers_de,target_form,content_kind,chunk_de,source_id)
     VALUES(target_card,target_unit,word,selected_article::public.grammatical_article,card_data->>'plural',(card_data->>'sentence_practice')::boolean,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(card_data->'alternative_answers_de','[]'::jsonb))),
      CASE WHEN card_data->'target_form' IS NULL OR card_data->'target_form'='null'::jsonb THEN NULL ELSE ARRAY(SELECT jsonb_array_elements_text(card_data->'target_form')) END,
      kind,chunk,source_key);
    INSERT INTO vocabulary_private.sitov_seed_card_origins(card_id,preserve_core) VALUES(target_card,false);
   ELSE
    target_card:=existing_card.id;
    IF existing_card.unit_id<>target_unit OR (existing_card.source_id IS NOT NULL AND existing_card.source_id<>source_key) THEN
     RAISE EXCEPTION 'vocabulary_identity_conflict' USING ERRCODE='23514'; END IF;
    INSERT INTO vocabulary_private.sitov_seed_card_origins(card_id,preserve_core) VALUES(target_card,true) ON CONFLICT(card_id) DO NOTHING;
    SELECT o.preserve_core INTO preserve_core FROM vocabulary_private.sitov_seed_card_origins o WHERE o.card_id=target_card;
    revision_applied:=false;
    IF card_data ? 'legacy_revision' THEN
     legacy_baseline:=card_data->'legacy_revision';
     IF legacy_baseline->>'article'='none' THEN legacy_baseline:=jsonb_set(legacy_baseline,'{article}','null'::jsonb); END IF;
     IF NOT preserve_core OR jsonb_typeof(legacy_baseline) IS DISTINCT FROM 'object'
      OR NOT(legacy_baseline ?& ARRAY['word_de','article','context_sentence_de'])
      OR EXISTS(SELECT 1 FROM jsonb_object_keys(legacy_baseline) k WHERE k NOT IN('word_de','article','context_sentence_de')) THEN
      RAISE EXCEPTION 'invalid_legacy_revision' USING ERRCODE='23514'; END IF;
     SELECT t.context_sentence INTO old_context FROM public.vocabulary_translations t WHERE t.card_id=target_card AND t.locale='de' FOR UPDATE;
     current_baseline:=jsonb_build_object('word_de',existing_card.word_de,'article',nullif(existing_card.article::text,'none'),'context_sentence_de',old_context);
     replacement_fields:=jsonb_build_object('word_de',word,'article',selected_article,'context_sentence_de',card_data->'translations'->'de'->>'context_sentence');
     SELECT r.* INTO historical FROM vocabulary_private.sitov_legacy_card_revisions r WHERE r.card_id=target_card FOR UPDATE;
     IF current_baseline=legacy_baseline THEN
      old_word:=concat_ws(' ',nullif(existing_card.article::text,'none'),existing_card.word_de);
      historical_words:=ARRAY[old_word]; old_plural:=nullif(btrim(existing_card.plural),'');
      IF nullif(existing_card.article::text,'none') IS NOT NULL AND old_plural IS NOT NULL AND old_plural NOT IN('-','–','—') THEN
       historical_words:=historical_words||('die '||old_plural)||(old_word||' / die '||old_plural)||(old_word||', die '||old_plural);
      END IF;
      INSERT INTO vocabulary_private.sitov_legacy_card_revisions(card_id,baseline,replacement,word_answers,sentence_answers)
       VALUES(target_card,legacy_baseline,replacement_fields,historical_words,CASE WHEN nullif(btrim(old_context),'') IS NULL THEN ARRAY[]::text[] ELSE ARRAY[old_context] END)
       ON CONFLICT(card_id) DO UPDATE SET baseline=excluded.baseline,replacement=excluded.replacement,
        word_answers=sitov_legacy_card_revisions.word_answers||ARRAY(SELECT x FROM unnest(excluded.word_answers) x WHERE NOT x=ANY(sitov_legacy_card_revisions.word_answers)),
        sentence_answers=sitov_legacy_card_revisions.sentence_answers||ARRAY(SELECT x FROM unnest(excluded.sentence_answers) x WHERE NOT x=ANY(sitov_legacy_card_revisions.sentence_answers));
     ELSIF historical.card_id IS NULL OR legacy_baseline IS DISTINCT FROM historical.baseline
      OR replacement_fields IS DISTINCT FROM historical.replacement OR current_baseline IS DISTINCT FROM historical.replacement THEN
      RAISE EXCEPTION 'stale_legacy_revision' USING ERRCODE='23514';
     END IF;
     revision_applied:=true;
    END IF;
    UPDATE public.learning_vocabulary_cards SET content_kind=kind,chunk_de=chunk,source_id=source_key,
     word_de=CASE WHEN preserve_core AND NOT revision_applied THEN word_de ELSE word END,
     article=CASE WHEN preserve_core AND NOT revision_applied THEN learning_vocabulary_cards.article ELSE selected_article::public.grammatical_article END,
     plural=CASE WHEN preserve_core AND NOT revision_applied THEN plural ELSE card_data->>'plural' END,
     target_form=CASE WHEN revision_applied THEN CASE WHEN card_data->'target_form' IS NULL OR card_data->'target_form'='null'::jsonb THEN NULL
      ELSE ARRAY(SELECT jsonb_array_elements_text(card_data->'target_form')) END ELSE target_form END
     WHERE id=target_card;
    -- Accepted answers and sentence_practice never change for existing cards.
    -- Only an explicit baseline-checked revision updates displayed target
    -- forms; historical answers stay in their original/private arrays.
    reused_count:=reused_count+1;
   END IF;
   FOREACH lang IN ARRAY ARRAY['de','en','ru','uk','tr'] LOOP
    localized:=card_data->'translations'->lang;
    INSERT INTO public.vocabulary_translations(card_id,locale,translation,context_sentence,chunk_translation)
     VALUES(target_card,lang,localized->>'translation',localized->>'context_sentence',localized->>'chunk_translation')
     ON CONFLICT(card_id,locale) DO UPDATE SET chunk_translation=excluded.chunk_translation,
      translation=CASE WHEN preserve_core AND NOT revision_applied THEN vocabulary_translations.translation ELSE excluded.translation END,
      context_sentence=CASE WHEN preserve_core AND NOT revision_applied THEN vocabulary_translations.context_sentence ELSE excluded.context_sentence END;
   END LOOP;
   -- Reads stored authoritative fields + translations. Active targets require
   -- male Qwen profile, exact text, valid Storage object and full word timings.
   PERFORM learning_private.sitov_require_prepared_learning_audio('vocabulary',jsonb_build_object('id',target_card),'[]'::jsonb,target_unit);
   card_results:=card_results||jsonb_build_array(jsonb_build_object('source_id',source_key,'card_id',target_card));
   card_count:=card_count+1;
   IF kind='chunk' THEN chunk_count:=chunk_count+1; ELSE vocabulary_count:=vocabulary_count+1; END IF;
  END LOOP;
  unit_results:=unit_results||jsonb_build_array(jsonb_build_object('unit_id',target_unit,'level',unit_data->>'level','label',unit_data->>'label','cards',card_results));
  unit_count:=unit_count+1;
 END LOOP;
 RETURN jsonb_build_object('unit_count',unit_count,'card_count',card_count,'vocabulary_count',vocabulary_count,'chunk_count',chunk_count,'reused_count',reused_count,'published',p_publish,'units',unit_results);
 EXCEPTION WHEN OTHERS THEN
  -- The exception block rolls back the entire seed, including activation and
  -- inserted cards. Fixed errors only; no answers or protected metadata leak.
  RETURN jsonb_build_object('error',CASE WHEN SQLERRM='prepared_audio_required' THEN 'prepared_audio_required'
   WHEN SQLSTATE='42501' THEN 'not_authorized' ELSE 'invalid_vocabulary_seed' END);
END $$;
REVOKE ALL ON FUNCTION public.sitov_import_vocabulary_seed(jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sitov_import_vocabulary_seed(jsonb,boolean) TO service_role;
