-- Sitov Academy: six exact human-approved replacement keys; preserve all original Storage objects and historical references.
-- Requires115. CREATE OR REPLACE preserves its trusted execute ACL; no grant or metadata/content writes.
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
  ('esst','c5c587a8022a5689f4fe8d33586b3a8f69282e4a1b09b42ca2f461ecdaf7ac78','sitov-audio-repair-20261010-v1'),
  ('Bist','135fc9e07b20003ba9387bb1bbeb7d7d3cacfeee70eededb2348a0d4653238d4','sitov-audio-repair-20261010-v2'),
  ('einkauft','0b62b12a96ac10d2001e4bd0ec6faac6c8c6c627c2b125748a56793b253d2484','sitov-audio-repair-20261010-v2'),
  ('Marchenko','1013e2802cf67c617f400f68a4251ed8729bef1e18a1ed842030c9a991b0100d','sitov-audio-repair-20261010-v2'),
  ('Lwiw','4c74b98b36253b49f755ae5f455f4c319b1bb136e9ee170f72b401feb271a85a','sitov-audio-repair-20261010-v2'),
  ('sieh','508334136dab7cb6228ed1152c589548c78ea9655ac66af71a94dea0db951563','sitov-audio-repair-20261010-v2'),
  ('neuen','66a009a2deed198d0eab580cca4d9a91f6ed3d91002389add323803521219035','sitov-audio-repair-20261010-v2')
 ) AS v(source_text,text_sha256,tag)
 WHERE v.source_text=spoken AND v.text_sha256=encode(sha256(convert_to(spoken,'UTF8')),'hex');
 preimage := '{"text":' || to_json(spoken)::text ||
   ',"voice":"sitov-qwen-male-de-v1","rate":"qwen-native-1-lufs-18-aligned-v1","format":"audio-24khz-48kbitrate-mono-mp3","leadIn":0.35,"profile":"' || fingerprint || '"' ||
   CASE WHEN variant IS NULL THEN '' ELSE ',"variant":'||to_json(variant)::text END || '}';
 RETURN 'sitov-qwen-v1/de/' || encode(sha256(convert_to(preimage,'UTF8')),'hex') || '.mp3';
END $sitov$;
REVOKE ALL ON FUNCTION vocabulary_private.sitov_canonical_german_audio_path(text) FROM PUBLIC,anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
