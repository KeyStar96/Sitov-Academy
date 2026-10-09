-- Sitov Academy additive98: new attempt presentation is private and frozen once.
-- Canonical authorship, exact definition/audio hashes and old attempts stay intact.
CREATE OR REPLACE FUNCTION sitov_pronunciation_private.present_task(q jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SET search_path='' AS $$
DECLARE option jsonb;token text;correct_token text;presented jsonb:='[]'::jsonb;
BEGIN
 -- PostgreSQL UUIDv4 uses pg_strong_random. Separate draws provide independent
 -- opaque tokens and ordering; tokens carry no canonical option-ID or q-number.
 FOR option IN SELECT value FROM jsonb_array_elements(q->'options') ORDER BY gen_random_uuid() LOOP
  token:='sitov.option.'||replace(gen_random_uuid()::text,'-','');
  IF option->>'id'=q->>'correctOptionId' THEN correct_token:=token;END IF;
  presented:=presented||jsonb_build_array(jsonb_build_object('id',token,'textDe',option->>'textDe'));
 END LOOP;
 IF correct_token IS NULL THEN RAISE EXCEPTION 'sitov_pretest_private_option_key_missing';END IF;
 RETURN q||jsonb_build_object('options',presented,'correctOptionId',correct_token);
END $$;
REVOKE ALL ON FUNCTION sitov_pronunciation_private.present_task(jsonb) FROM PUBLIC,anon,authenticated,service_role;

DO $sitov$
DECLARE definition text;
 insertion constant text:=$old$INSERT INTO sitov_pronunciation_private.pretest_attempts(student_id,text_id,definition_id,tasks) VALUES(auth.uid(),p_text,d.id,tasks) RETURNING * INTO a;$old$;
 presentation constant text:=$new$SELECT jsonb_agg(sitov_pronunciation_private.present_task(value) ORDER BY ordinal)
 INTO tasks FROM jsonb_array_elements(tasks) WITH ORDINALITY AS selected(value,ordinal);
 INSERT INTO sitov_pronunciation_private.pretest_attempts(student_id,text_id,definition_id,tasks) VALUES(auth.uid(),p_text,d.id,tasks) RETURNING * INTO a;$new$;
BEGIN
 definition:=pg_get_functiondef('sitov_pronunciation_private.pretest_command(text,uuid,uuid,integer,jsonb,uuid,text)'::regprocedure);
 IF position(presentation IN definition)>0 THEN RETURN;END IF;
 IF position(insertion IN definition)=0 THEN RAISE EXCEPTION 'sitov_pretest_attempt_insert_contract_changed';END IF;
 EXECUTE replace(definition,insertion,presentation);
END $sitov$;
NOTIFY pgrst,'reload schema';
