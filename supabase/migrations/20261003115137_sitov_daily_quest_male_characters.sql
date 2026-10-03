-- Sitov Academy uses male fictional learning characters and the established
-- male TTS voice. Apply after 63. This also corrects frozen assignments, without
-- re-rendering personalized vocabulary, changing answer keys or learning state.
CREATE OR REPLACE FUNCTION daily_quest_private.sitov_male_quest_content(p_content jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $$
DECLARE payload jsonb:=p_content; scene jsonb:=p_content->'scene'; characters jsonb; steps jsonb; bakery boolean;
BEGIN
 bakery:=scene->>'backgroundKey'='bakery' OR scene->>'backgroundImage' IN(
  '/Bilder/deutschreise/bakery-scene.png','/Bilder/deutschreise/sitov-bakery-male.png');
 IF jsonb_typeof(scene->'characters')='array' THEN
  SELECT coalesce(jsonb_agg(e.value || jsonb_build_object('voice','male') ||
   CASE WHEN bakery AND e.value->>'id'='host' AND e.value->>'name'='Mara'
    THEN jsonb_build_object('name','Martin') ELSE '{}'::jsonb END ORDER BY e.ordinality),'[]'::jsonb)
  INTO characters FROM jsonb_array_elements(scene->'characters') WITH ORDINALITY e(value,ordinality);
  scene:=jsonb_set(scene,'{characters}',characters);
 END IF;
 IF bakery THEN
  scene:=scene || jsonb_build_object('backgroundImage','/Bilder/deutschreise/sitov-bakery-male.png',
   'imageAlt','Ein Verkäufer hinter der Theke einer Bäckerei.');
 END IF;
 IF scene IS NOT NULL THEN payload:=jsonb_set(payload,'{scene}',scene); END IF;
 IF jsonb_typeof(payload->'steps')='array' THEN
  SELECT coalesce(jsonb_agg(CASE WHEN jsonb_typeof(s.value->'options')='array' THEN jsonb_set(s.value,'{options}',
   (SELECT coalesce(jsonb_agg(CASE WHEN o.value->>'text'='Ich heiße Anna.'
     THEN jsonb_set(o.value,'{text}',to_jsonb('Ich heiße Lukas.'::text)) ELSE o.value END ORDER BY o.ordinality),'[]'::jsonb)
    FROM jsonb_array_elements(s.value->'options') WITH ORDINALITY o(value,ordinality)))
   ELSE s.value END ORDER BY s.ordinality),'[]'::jsonb)
  INTO steps FROM jsonb_array_elements(payload->'steps') WITH ORDINALITY s(value,ordinality);
  payload:=jsonb_set(payload,'{steps}',steps);
 END IF;
 RETURN payload;
END $$;
REVOKE ALL ON FUNCTION daily_quest_private.sitov_male_quest_content(jsonb) FROM PUBLIC,anon,authenticated;

UPDATE public.daily_quests
 SET content=daily_quest_private.sitov_male_quest_content(content),updated_at=now()
 WHERE content IS DISTINCT FROM daily_quest_private.sitov_male_quest_content(content);
UPDATE public.daily_quest_assignments
 SET snapshot=daily_quest_private.sitov_male_quest_content(snapshot)
 WHERE snapshot IS DISTINCT FROM daily_quest_private.sitov_male_quest_content(snapshot);
-- Backfill-only code must not become an authoring path that silently accepts
-- female characters. Future writes are checked explicitly below.
DROP FUNCTION daily_quest_private.sitov_male_quest_content(jsonb);

CREATE OR REPLACE FUNCTION daily_quest_private.sitov_has_male_characters(p_content jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
 SELECT CASE WHEN jsonb_typeof(p_content->'scene'->'characters')='array' THEN
  jsonb_array_length(p_content->'scene'->'characters')>0 AND NOT EXISTS(
   SELECT 1 FROM jsonb_array_elements(p_content->'scene'->'characters') c(value)
   WHERE jsonb_typeof(c.value) IS DISTINCT FROM 'object' OR c.value->>'voice' IS DISTINCT FROM 'male')
  ELSE false END
$$;
REVOKE ALL ON FUNCTION daily_quest_private.sitov_has_male_characters(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION daily_quest_private.sitov_has_male_characters(jsonb) TO service_role;

DO $constraints$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.daily_quests'::regclass AND conname='sitov_daily_quest_male_characters') THEN
  ALTER TABLE public.daily_quests ADD CONSTRAINT sitov_daily_quest_male_characters
   CHECK(daily_quest_private.sitov_has_male_characters(content));
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.daily_quest_assignments'::regclass AND conname='sitov_daily_quest_snapshot_male_characters') THEN
  ALTER TABLE public.daily_quest_assignments ADD CONSTRAINT sitov_daily_quest_snapshot_male_characters
   CHECK(daily_quest_private.sitov_has_male_characters(snapshot));
 END IF;
END $constraints$;
COMMENT ON CONSTRAINT sitov_daily_quest_male_characters ON public.daily_quests IS
 'Sitov Academy fictional learning characters use male voices; matching male names and artwork are required by the editorial contract.';
COMMENT ON CONSTRAINT sitov_daily_quest_snapshot_male_characters ON public.daily_quest_assignments IS
 'Assignments retain their personalized content and verified progress while using the same male character voices as the trainers.';
NOTIFY pgrst,'reload schema';
