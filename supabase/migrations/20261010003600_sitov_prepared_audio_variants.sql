-- Sitov Academy immutable repair variants; no object/URL/proof/archive writes.
CREATE OR REPLACE FUNCTION vocabulary_private.sitov_canonical_german_audio_path(p_text text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $sitov$
DECLARE spoken text:=vocabulary_private.sitov_normalize_audio_text(p_text);
 fingerprint constant text:='96db5949cf9ba060eb5fbeeec3b472d232d55e0b22dc2512cf65dc53c8c47df5';
 variant text;preimage text;
BEGIN
 SELECT v.tag INTO variant FROM (VALUES
  ('sind','bf586d886bcf16651b9330ef8bf219adc52390842387d00e51f915eb3a440a85','sitov-audio-repair-20261010-v1'),
  ('stehe','f4c88b9a59231ac1a4e378aba2c7216c71e04ac07c2f74c81f78dba0473b2653','sitov-audio-repair-20261010-v1'),
  ('wollte','2300ececf6b5042bfe9f89d43eef770772bb76f131065d4914f25f281f9e0b22','sitov-audio-repair-20261010-v1'),
  ('des','7b24c1ad239d4a6b2c73716e122644f4d45329a71d01c9437f033381e8832fe4','sitov-audio-repair-20261010-v1'),
  ('ihrer','a9c97da4fcf665f6362ecf5b2407bf04dcebd7635a94ccfecaf6ccd3071892ed','sitov-audio-repair-20261010-v1'),
  ('meiste','a5939d4dfb1493fd126545c712994df973351ef2364586f43c02e695eef6b9a5','sitov-audio-repair-20261010-v1'),
  ('esst','c5c587a8022a5689f4fe8d33586b3a8f69282e4a1b09b42ca2f461ecdaf7ac78','sitov-audio-repair-20261010-v1')
 ) AS v(source_text,text_sha256,tag)
 WHERE v.source_text=spoken AND v.text_sha256=encode(sha256(convert_to(spoken,'UTF8')),'hex');
 preimage := '{"text":' || to_json(spoken)::text ||
   ',"voice":"sitov-qwen-male-de-v1","rate":"qwen-native-1-lufs-18-aligned-v1","format":"audio-24khz-48kbitrate-mono-mp3","leadIn":0.35,"profile":"' || fingerprint || '"' ||
   CASE WHEN variant IS NULL THEN '' ELSE ',"variant":'||to_json(variant)::text END || '}';
 RETURN 'sitov-qwen-v1/de/' || encode(sha256(convert_to(preimage,'UTF8')),'hex') || '.mp3';
END $sitov$;
REVOKE ALL ON FUNCTION vocabulary_private.sitov_canonical_german_audio_path(text) FROM PUBLIC,anon,authenticated,service_role;
-- Match the existing INVOKER proof's trusted execution roles.
DO $sitov$
DECLARE target oid:='vocabulary_private.sitov_prepared_german_audio_url(text)'::regprocedure;role_name name;
BEGIN
 FOR role_name IN
  SELECT r.rolname FROM pg_roles r WHERE r.oid IN(
   SELECT p.proowner FROM pg_proc p WHERE p.oid=target
   UNION SELECT a.grantee FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    WHERE p.oid=target AND a.privilege_type='EXECUTE' AND a.grantee<>0)
  AND r.rolname NOT IN('anon','authenticated','service_role')
 LOOP EXECUTE format('GRANT EXECUTE ON FUNCTION vocabulary_private.sitov_canonical_german_audio_path(text) TO %I',role_name);END LOOP;
END $sitov$;

-- Replace only address construction; keep the actual70/96/97/99 proof intact.
DO $sitov$
DECLARE definition text;
 previous constant text:=$old$ -- Exact JSON.stringify key order and whitespace of neuralAudioPath().
 preimage := '{"text":' || to_json(spoken)::text ||
   ',"voice":"sitov-qwen-male-de-v1","rate":"qwen-native-1-lufs-18-aligned-v1","format":"audio-24khz-48kbitrate-mono-mp3","leadIn":0.35,"profile":"' || fingerprint || '"}';
 cache_path := 'sitov-qwen-v1/de/' || encode(sha256(convert_to(preimage,'UTF8')),'hex') || '.mp3';$old$;
 current_identity constant text:=$new$ cache_path := vocabulary_private.sitov_canonical_german_audio_path(spoken);$new$;
BEGIN
 definition:=pg_get_functiondef('vocabulary_private.sitov_prepared_german_audio_url(text)'::regprocedure);
 IF position(current_identity IN definition)>0 THEN RETURN;END IF;
 IF (length(definition)-length(replace(definition,previous,'')))/length(previous)<>1 THEN
  RAISE EXCEPTION 'sitov_audio_variant_identity_contract_changed';
 END IF;
 IF position('sitov_storage_private.sitov_audio_metadata(' IN definition)=0
  OR position($ref$RETURN 'storage://audio_cache/'$ref$ IN definition)=0 THEN
  RAISE EXCEPTION 'sitov_audio_variant_requires_114_baseline';
 END IF;
 EXECUTE replace(definition,previous,current_identity);
END $sitov$;
NOTIFY pgrst,'reload schema';
