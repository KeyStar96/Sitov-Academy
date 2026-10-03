-- Apply only after the complete Qwen corpus has been imported and audited.
-- Keep both original function signatures/OIDs: existing wrappers and callers
-- retain their dependencies. No learner state or authored IDs are rewritten.

-- Prepared metadata is a service-owned proof. Restrictive write guards also
-- hold if another module later introduces a broader permissive Storage policy.
DROP POLICY IF EXISTS sitov_qwen_cache_service_insert ON storage.objects;
CREATE POLICY sitov_qwen_cache_service_insert ON storage.objects AS RESTRICTIVE
 FOR INSERT TO anon, authenticated WITH CHECK (bucket_id <> 'audio_cache');
DROP POLICY IF EXISTS sitov_qwen_cache_service_update ON storage.objects;
CREATE POLICY sitov_qwen_cache_service_update ON storage.objects AS RESTRICTIVE
 FOR UPDATE TO anon, authenticated USING (bucket_id <> 'audio_cache') WITH CHECK (bucket_id <> 'audio_cache');
DROP POLICY IF EXISTS sitov_qwen_cache_service_delete ON storage.objects;
CREATE POLICY sitov_qwen_cache_service_delete ON storage.objects AS RESTRICTIVE
 FOR DELETE TO anon, authenticated USING (bucket_id <> 'audio_cache');

CREATE OR REPLACE FUNCTION vocabulary_private.sitov_normalize_audio_text(p_text text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
 SELECT btrim(regexp_replace(pg_catalog.normalize(coalesce(p_text,''),'NFC'),
   U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+', ' ', 'g'));
$$;
REVOKE ALL ON FUNCTION vocabulary_private.sitov_normalize_audio_text(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION vocabulary_private.sitov_prepared_german_audio_url(p_text text)
RETURNS text LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE
 spoken text := vocabulary_private.sitov_normalize_audio_text(p_text);
 fingerprint constant text := '96db5949cf9ba060eb5fbeeec3b472d232d55e0b22dc2512cf65dc53c8c47df5';
 preimage text;
 cache_path text;
 authored jsonb;
 object_metadata jsonb;
 timings jsonb;
 timing jsonb;
 previous_end numeric := 0;
 start_seconds numeric;
 end_seconds numeric;
BEGIN
 -- Exact JSON.stringify key order and whitespace of neuralAudioPath().
 preimage := '{"text":' || to_json(spoken)::text ||
   ',"voice":"sitov-qwen-male-de-v1","rate":"qwen-native-1-lufs-18-aligned-v1","format":"audio-24khz-48kbitrate-mono-mp3","leadIn":0.35,"profile":"' || fingerprint || '"}';
 cache_path := 'sitov-qwen-v1/de/' || encode(sha256(convert_to(preimage,'UTF8')),'hex') || '.mp3';
 SELECT o.user_metadata, o.metadata INTO authored, object_metadata
 FROM storage.objects o WHERE o.bucket_id='audio_cache' AND o.name=cache_path
   AND o.archived_at IS NULL AND coalesce(o.is_delete_marker,false)=false
 FOR SHARE;
 IF NOT FOUND OR authored->>'engine' IS DISTINCT FROM 'qwen3-tts'
   OR authored->>'voice' IS DISTINCT FROM 'sitov-qwen-male-de-v1'
   OR authored->>'revision' IS DISTINCT FROM 'sitov-qwen-base-bf16-v1'
   OR authored->>'profileFingerprint' IS DISTINCT FROM fingerprint
   OR authored->>'textSha256' IS DISTINCT FROM encode(sha256(convert_to(spoken,'UTF8')),'hex')
   OR coalesce(authored->>'audioSha256','') !~ '^[0-9a-f]{64}$'
   OR object_metadata->>'mimetype' IS DISTINCT FROM 'audio/mpeg'
   OR jsonb_typeof(object_metadata->'size') IS DISTINCT FROM 'number' THEN
   RAISE EXCEPTION 'prepared_audio_required' USING ERRCODE='22023';
 END IF;
 IF (object_metadata->>'size')::numeric NOT BETWEEN 1 AND 2097152 THEN
   RAISE EXCEPTION 'prepared_audio_required' USING ERRCODE='22023';
 END IF;
 timings := authored->'wordTimings';
 IF jsonb_typeof(timings) IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'prepared_audio_required' USING ERRCODE='22023';
 END IF;
 IF spoken='' OR jsonb_array_length(timings) NOT BETWEEN 1 AND 1500
   OR jsonb_array_length(timings) <> cardinality(string_to_array(spoken,' ')) THEN
   RAISE EXCEPTION 'prepared_audio_required' USING ERRCODE='22023';
 END IF;
 FOR timing IN SELECT value FROM jsonb_array_elements(timings) LOOP
   IF jsonb_typeof(timing->'start') IS DISTINCT FROM 'number'
     OR jsonb_typeof(timing->'end') IS DISTINCT FROM 'number' THEN
     RAISE EXCEPTION 'prepared_audio_required' USING ERRCODE='22023';
   END IF;
   start_seconds := (timing->>'start')::numeric;
   end_seconds := (timing->>'end')::numeric;
   IF start_seconds < previous_end OR end_seconds < start_seconds OR end_seconds > 1200 THEN
     RAISE EXCEPTION 'prepared_audio_required' USING ERRCODE='22023';
   END IF;
   previous_end := end_seconds;
 END LOOP;
 RETURN '/supabase/storage/v1/object/public/audio_cache/' || cache_path;
END $$;
REVOKE ALL ON FUNCTION vocabulary_private.sitov_prepared_german_audio_url(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION vocabulary_private.add_own_word(p_level text, p_word_de text, p_article text, p_translation text, p_locale text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE actor uuid:=auth.uid(); own_unit uuid; new_card uuid; activated boolean; prepared_audio_url text;
 word text:=vocabulary_private.sitov_normalize_audio_text(p_word_de);
 translated text:=btrim(regexp_replace(coalesce(p_translation,''),'\s+',' ','g'));
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 IF NOT trainer_access_private.allowed(p_level,'vocabulary') THEN RAISE EXCEPTION 'trainer_access_denied' USING ERRCODE='42501'; END IF;
 -- Die Übersetzung steht in der Sprache der Oberfläche: Daraus fragt der
 -- Trainer die Richtung Deutsch → eigene Sprache ab (answer_key).
 IF p_locale IS NULL OR p_locale NOT IN('en','ru','uk','tr') THEN RAISE EXCEPTION 'invalid_language' USING ERRCODE='22023'; END IF;
 IF length(word) NOT BETWEEN 1 AND 120 OR length(translated) NOT BETWEEN 1 AND 200
  OR (p_article IS NOT NULL AND p_article NOT IN('der','die','das')) THEN
  RAISE EXCEPTION 'invalid_input' USING ERRCODE='22023'; END IF;
 -- The prepared Storage object is required before any unit/card insert.
 prepared_audio_url:=vocabulary_private.sitov_prepared_german_audio_url(concat(coalesce(p_article,''),' ',word));
 PERFORM pg_advisory_xact_lock(hashtextextended('vocabulary:'||actor::text,0));
 SELECT id INTO own_unit FROM public.learning_units WHERE owner_auth_user_id=actor AND level=p_level AND trainer='vocabulary';
 IF own_unit IS NULL THEN
  INSERT INTO public.learning_units(level,trainer,label,sort_order,is_active,owner_auth_user_id)
   VALUES(p_level,'vocabulary','Eigene Wörter',1000000,true,actor) RETURNING id INTO own_unit;
 END IF;
 -- 1000 = eine initialize_vocabulary_cards-Anfrage aktiviert die ganze Lektion.
 IF (SELECT count(*) FROM public.learning_vocabulary_cards c WHERE c.unit_id=own_unit)>=1000 THEN
  RAISE EXCEPTION 'own_word_limit' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.learning_vocabulary_cards c WHERE c.unit_id=own_unit
  AND lower(c.word_de)=lower(word) AND coalesce(c.article::text,'')=coalesce(p_article,'')) THEN
  RAISE EXCEPTION 'own_word_exists' USING ERRCODE='23505'; END IF;
 activated:=EXISTS(SELECT 1 FROM public.vocabulary_direction_progress v JOIN public.learning_vocabulary_cards c ON c.id=v.card_id
  WHERE v.auth_user_id=actor AND c.unit_id=own_unit);
 INSERT INTO public.learning_vocabulary_cards(unit_id,word_de,article,sentence_practice,audio_url)
  VALUES(own_unit,word,p_article::public.grammatical_article,false,prepared_audio_url) RETURNING id INTO new_card;
 INSERT INTO public.vocabulary_translations(card_id,locale,translation) VALUES(new_card,p_locale,translated);
 IF activated THEN
  INSERT INTO public.vocabulary_direction_progress(auth_user_id,card_id,direction,box_number,next_review_date)
   SELECT actor,new_card,d::public.vocabulary_direction,1,now() FROM unnest(ARRAY['de_to_native','native_to_de']) d;
 END IF;
 RETURN jsonb_build_object('cardId',new_card,'activated',activated);
END $$;
REVOKE ALL ON FUNCTION vocabulary_private.add_own_word(text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION vocabulary_private.add_own_word(text,text,text,text,text) TO authenticated;


CREATE OR REPLACE FUNCTION public.add_own_vocabulary(p_level text, p_word_de text, p_article text, p_translation text, p_locale text)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE boundary_state text; boundary_message text; boundary_code text;
BEGIN
 RETURN vocabulary_private.add_own_word(p_level,p_word_de,p_article,p_translation,p_locale);
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS boundary_state=RETURNED_SQLSTATE,boundary_message=MESSAGE_TEXT;
  boundary_code:=CASE WHEN boundary_message=ANY(ARRAY[
   'authentication_required','trainer_access_denied','invalid_language','own_word_exists','own_word_limit','prepared_audio_required',
   'not_authorized','not_authenticated','invalid_input','request_failed','conflict','not_found'
  ]) THEN boundary_message
  WHEN boundary_state='42501' THEN 'not_authorized'
  WHEN boundary_state IN('23502','23503','23514','22P02','22023','22007') THEN 'invalid_input'
  WHEN boundary_state IN('23505','PT409','40001') THEN 'conflict'
  WHEN boundary_state='40P01' THEN 'retry_required'
  WHEN boundary_state IN('P0002','02000') THEN 'not_found'
  ELSE 'request_failed' END;
  RETURN jsonb_build_object('error',boundary_code,'message',CASE
   WHEN boundary_code='prepared_audio_required' THEN 'Prepare and upload the German audio before adding this word.'
   WHEN boundary_code='own_word_exists' THEN 'This word is already in your own words.'
   WHEN boundary_code='own_word_limit' THEN 'Your own words list is full.'
   WHEN boundary_state='42501' THEN 'The request is not authorized.'
   WHEN boundary_code IN('conflict','retry_required') THEN 'Reload and retry the request.'
   WHEN boundary_code='invalid_input' THEN 'The request contains invalid data.'
   ELSE 'The request could not be completed.' END,'sqlstate',boundary_state);
END $$;
REVOKE ALL ON FUNCTION public.add_own_vocabulary(text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_own_vocabulary(text,text,text,text,text) TO authenticated, service_role;
