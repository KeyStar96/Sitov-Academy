-- Apply after 20261003192958 and after the Qwen corpus import/audit.
-- The CMS server action is not the only caller: authenticated staff can invoke
-- this RPC directly. Keep its OID, invoker mode, ACLs, IDs and error contract.

CREATE OR REPLACE FUNCTION learning_private.sitov_learning_audio_texts(
 p_trainer text, p_fields jsonb, p_translations jsonb
) RETURNS text[] LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $$
DECLARE
 texts text[] := ARRAY[]::text[];
 answer text := CASE WHEN jsonb_typeof(p_fields->'content'->'correct_answer')='string'
   THEN p_fields->'content'->>'correct_answer' ELSE '' END;
 question text := CASE WHEN jsonb_typeof(p_fields->'content'->'question')='string'
   THEN p_fields->'content'->>'question' ELSE '' END;
 before_text text := CASE WHEN jsonb_typeof(p_fields->'content'->'text_before')='string'
   THEN p_fields->'content'->>'text_before' ELSE '' END;
 after_text text := CASE WHEN jsonb_typeof(p_fields->'content'->'text_after')='string'
   THEN p_fields->'content'->>'text_after' ELSE '' END;
BEGIN
 -- Mirror preparedLearningAudioTexts() after learningWritePayload() has moved
 -- the editor's German context sentence into its exact-locale translation.
 IF p_trainer='vocabulary' THEN
  IF jsonb_typeof(p_fields->'word_de')='string' THEN
   texts := array_append(texts, concat(CASE WHEN jsonb_typeof(p_fields->'article')='string'
     AND p_fields->>'article'<>'none' THEN p_fields->>'article' ELSE '' END,' ',p_fields->>'word_de'));
  END IF;
  IF jsonb_typeof(p_translations)='array' THEN
   SELECT texts || coalesce(array_agg(t->>'context_sentence'),'{}'::text[]) INTO texts
   FROM jsonb_array_elements(p_translations) t
   WHERE t->>'locale'='de' AND jsonb_typeof(t->'context_sentence')='string';
  END IF;
 ELSIF p_trainer='pronunciation' THEN
  IF jsonb_typeof(p_fields->'sentence_de')='string' THEN
   texts := array_append(texts,p_fields->>'sentence_de');
  END IF;
 ELSIF p_trainer='exercises' THEN
  IF p_fields->>'type'='fill_in_blank' THEN
   texts := ARRAY[answer,before_text || answer || after_text];
  ELSIF p_fields->>'type'='multiple_choice' THEN
   -- JS String.replace replaces the first literal marker, not all markers.
   texts := ARRAY[CASE WHEN strpos(question,'___')>0 THEN
     substr(question,1,strpos(question,'___')-1) || answer || substr(question,strpos(question,'___')+3)
     ELSE question || ' ' || answer END];
  ELSIF p_fields->>'type'='sentence_building' THEN
   texts := ARRAY[answer];
  END IF;
 END IF;
 RETURN ARRAY(SELECT DISTINCT vocabulary_private.sitov_normalize_audio_text(t)
  FROM unnest(texts) t WHERE vocabulary_private.sitov_normalize_audio_text(t)<>'');
END $$;
REVOKE ALL ON FUNCTION learning_private.sitov_learning_audio_texts(text,jsonb,jsonb)
 FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION learning_private.sitov_require_prepared_learning_audio(
 p_trainer text, p_fields jsonb, p_translations jsonb, p_unit uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
 invoking_role text := coalesce(nullif(current_setting('role',true),'none'),session_user);
 active boolean;
 item uuid;
 stored_fields jsonb;
 stored_translations jsonb := '[]'::jsonb;
 spoken text;
 existing_audio text;
 prepared_audio text;
BEGIN
 -- Definer rights are only a bridge to the closed, service-owned Storage
 -- metadata proof. Check the actual caller before any Storage lookup; never
 -- trust an editable JWT role claim or return metadata to non-staff callers.
 IF invoking_role NOT IN('service_role','postgres','supabase_admin')
  AND (auth.uid() IS NULL OR coalesce(identity_private.current_profile_role(),'') NOT IN('teacher','admin')) THEN
  RAISE EXCEPTION 'Staff required' USING ERRCODE='42501';
 END IF;
 SELECT u.is_active INTO active FROM public.learning_units u WHERE u.id=p_unit FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Content unavailable' USING ERRCODE='23514'; END IF;
 IF NOT active OR p_trainer='videos' THEN RETURN; END IF;

 -- The CMS supplies only its saved ID; path imports supply the actual row.
 -- Read the authoritative, locked row and translations after their write.
 -- Caller-provided text, translations and URLs never constitute the proof.
 item := (p_fields->>'id')::uuid;
 IF p_trainer='vocabulary' THEN
  SELECT to_jsonb(c) INTO stored_fields FROM public.learning_vocabulary_cards c
   WHERE c.id=item AND c.unit_id=p_unit FOR UPDATE;
 ELSIF p_trainer='pronunciation' THEN
  SELECT to_jsonb(r) INTO stored_fields FROM public.learning_reading_texts r
   WHERE r.id=item AND r.unit_id=p_unit FOR UPDATE;
 ELSIF p_trainer='exercises' THEN
  SELECT to_jsonb(e) INTO stored_fields FROM public.learning_exercises e
   WHERE e.id=item AND e.unit_id=p_unit FOR UPDATE;
 ELSE RAISE EXCEPTION 'Content unavailable' USING ERRCODE='23514';
 END IF;
 IF stored_fields IS NULL THEN RAISE EXCEPTION 'Content unavailable' USING ERRCODE='23514'; END IF;
 IF p_trainer='vocabulary' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('locale',t.locale,'context_sentence',t.context_sentence)),'[]'::jsonb)
   INTO stored_translations FROM public.vocabulary_translations t WHERE t.card_id=item AND t.locale='de';
 END IF;
 FOR spoken IN SELECT unnest(learning_private.sitov_learning_audio_texts(p_trainer,stored_fields,stored_translations)) LOOP
  PERFORM vocabulary_private.sitov_prepared_german_audio_url(spoken);
 END LOOP;

 -- Persist the reference within the same publication transaction. Fill's
 -- stored URL plays its answer word; its full sentence uses a separate button.
 -- Multiple choice has exactly one joined/replaced UI utterance.
 IF p_trainer='vocabulary' THEN
  spoken := concat(CASE WHEN stored_fields->>'article'<>'none' THEN stored_fields->>'article' ELSE '' END,' ',stored_fields->>'word_de');
 ELSIF p_trainer='pronunciation' THEN spoken := stored_fields->>'sentence_de';
 ELSIF stored_fields->>'type'='fill_in_blank' THEN spoken := stored_fields->'content'->>'correct_answer';
 ELSIF stored_fields->>'type'='multiple_choice' THEN
  spoken := (learning_private.sitov_learning_audio_texts(p_trainer,stored_fields,stored_translations))[1];
 ELSE RETURN;
 END IF;
 existing_audio := CASE WHEN p_trainer='exercises' THEN stored_fields->>'solution_audio_url' ELSE stored_fields->>'audio_url' END;
 IF nullif(btrim(existing_audio),'') IS NULL OR strpos(existing_audio,'/audio_cache/')>0 THEN
  prepared_audio := vocabulary_private.sitov_prepared_german_audio_url(spoken);
  IF p_trainer='vocabulary' THEN
   UPDATE public.learning_vocabulary_cards SET audio_url=prepared_audio WHERE id=item AND unit_id=p_unit AND audio_url IS DISTINCT FROM prepared_audio;
  ELSIF p_trainer='pronunciation' THEN
   UPDATE public.learning_reading_texts SET audio_url=prepared_audio WHERE id=item AND unit_id=p_unit AND audio_url IS DISTINCT FROM prepared_audio;
  ELSE
   UPDATE public.learning_exercises SET solution_audio_url=prepared_audio WHERE id=item AND unit_id=p_unit AND solution_audio_url IS DISTINCT FROM prepared_audio;
  END IF;
 END IF;
END $$;
REVOKE ALL ON FUNCTION learning_private.sitov_require_prepared_learning_audio(text,jsonb,jsonb,uuid)
 FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION learning_private.sitov_require_prepared_learning_audio(text,jsonb,jsonb,uuid)
 TO authenticated, service_role;

-- The production runner uses supabase_admin, also owner of the private audio
-- proof. Refuse an incompatible owner instead of opening it to app roles.
DO $owner$
DECLARE bridge_owner text;
BEGIN
 SELECT pg_get_userbyid(proowner) INTO bridge_owner FROM pg_proc
 WHERE oid='learning_private.sitov_require_prepared_learning_audio(text,jsonb,jsonb,uuid)'::regprocedure;
 IF NOT has_schema_privilege(bridge_owner,'vocabulary_private','USAGE')
  OR NOT has_function_privilege(bridge_owner,'vocabulary_private.sitov_normalize_audio_text(text)','EXECUTE')
  OR NOT has_function_privilege(bridge_owner,'vocabulary_private.sitov_prepared_german_audio_url(text)','EXECUTE') THEN
  RAISE EXCEPTION 'sitov_audio_bridge_owner_unavailable' USING ERRCODE='42501';
 END IF;
END $owner$;

DO $publication$
DECLARE definition text; before_text text; after_text text;
BEGIN
 definition := pg_get_functiondef('public.save_learning_content(text,jsonb,uuid)'::regprocedure);
 IF strpos(definition,'-- sitov-prepared-learning-publication-v1')>0 THEN RETURN; END IF;

 -- Existing shared vocabulary/exercise units keep their current state. Only a
 -- newly created unit uses the requested draft flag. A false flag on a payload
 -- cannot bypass the guard when the actual target unit remains active.
 before_text := $before$ELSE target_unit:=learning_private.ensure_unit(NULL,unit_data->>'level',p_trainer,unit_data->>'label'); END IF;$before$;
 after_text := $after$ELSE target_unit:=learning_private.ensure_unit(NULL,unit_data->>'level',p_trainer,unit_data->>'label',
    coalesce((unit_data->>'is_active')::boolean,old_meta.is_active,true),coalesce((unit_data->>'sort_order')::integer,old_meta.sort_order,100)); END IF;$after$;
 IF strpos(definition,before_text)=0 THEN
  RAISE EXCEPTION 'sitov_audio_publication_unit_source_drift' USING ERRCODE='23514';
 END IF;
 definition := replace(definition,before_text,after_text);

 before_text := $before$ RETURN jsonb_build_object('id',item);$before$;
 after_text := $after$ -- sitov-prepared-learning-publication-v1
 -- Preserve existing content-quality errors, then verify every spoken source
 -- before this mutation can commit. A miss rolls the enclosing block back,
 -- including newly inserted units/cards and any previous-unit cleanup.
 PERFORM learning_private.sitov_require_prepared_learning_audio(p_trainer,jsonb_build_object('id',item),'[]'::jsonb,target_unit);
 RETURN jsonb_build_object('id',item);$after$;
 IF strpos(definition,before_text)=0 THEN
  RAISE EXCEPTION 'sitov_audio_publication_guard_source_drift' USING ERRCODE='23514';
 END IF;
 definition := replace(definition,before_text,after_text);

 before_text := $before$ WHEN OTHERS THEN RETURN jsonb_build_object('error','save_failed','message','Content could not be saved.');$before$;
 after_text := $after$ WHEN OTHERS THEN RETURN jsonb_build_object(
  'error',CASE WHEN SQLERRM='prepared_audio_required' THEN 'prepared_audio_required' ELSE 'save_failed' END,
  'message',CASE WHEN SQLERRM='prepared_audio_required' THEN 'Prepare and upload the German audio before publishing this content.' ELSE 'Content could not be saved.' END);$after$;
 IF strpos(definition,before_text)=0 THEN
  RAISE EXCEPTION 'sitov_audio_publication_error_source_drift' USING ERRCODE='23514';
 END IF;
 EXECUTE replace(definition,before_text,after_text);
END $publication$;
