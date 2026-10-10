-- Sitov Academy: evaluate the commercial item scope once per statement.
-- Migration 93 calls item_allowed() for every candidate row. Learners read the
-- vocabulary catalogue, its translations and their own progress directly through
-- these policies, so a trainer start took several seconds per request and ran
-- into the API statement limit. The rule is unchanged: the unit set below is
-- item_allowed() without its item-specific trial references, and callers who
-- have trial rules keep the exact per-item check.

-- Compare typed keys so the primary keys are used; the text form of a uuid is
-- exactly its canonical lower-case spelling, any other text matched nothing before.
CREATE OR REPLACE FUNCTION sitov_access_private.resolve_item(p_kind text,p_item_id text)
RETURNS TABLE(unit_id uuid,level text,trainer text,owner_id uuid,published boolean,legacy_media boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH item AS MATERIALIZED (
 SELECT CASE WHEN p_item_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN p_item_id::uuid END AS id
 ), refs AS (
 SELECT c.unit_id,false media FROM public.learning_vocabulary_cards c WHERE p_kind='vocabulary_card' AND c.id=(SELECT id FROM item)
 UNION ALL SELECT e.unit_id,false FROM public.learning_exercises e WHERE p_kind='exercise' AND e.id=(SELECT id FROM item) AND e.node_id IS NULL
 UNION ALL SELECT e.unit_id,false FROM public.learning_exercises e WHERE p_kind='path_task' AND e.id=(SELECT id FROM item) AND e.node_id IS NOT NULL AND e.path_is_active
 UNION ALL SELECT r.unit_id,false FROM public.learning_reading_texts r WHERE p_kind='reading_text' AND r.id=(SELECT id FROM item)
 UNION ALL SELECT v.unit_id,v.storage_path IS NOT NULL AND v.folder_id IS NOT NULL FROM public.learning_videos v
 WHERE p_kind='video' AND v.id=(SELECT id FROM item) AND (v.folder_id IS NULL OR EXISTS(
 SELECT 1 FROM public.lms_media_folder f JOIN public.learning_units u ON u.id=v.unit_id WHERE f.folder_id=v.folder_id AND f.level=u.level))
 UNION ALL SELECT v.unit_id,false FROM public.sitov_verb_catalog v WHERE p_kind='verb' AND v.id=p_item_id
 UNION ALL SELECT n.unit_id,false FROM public.path_nodes n WHERE p_kind='path_node' AND n.id=(SELECT id FROM item) AND n.is_active
 UNION ALL SELECT n.unit_id,false FROM public.path_nodes n JOIN public.path_nodes anchor ON anchor.id=n.anchor_node_id AND anchor.unit_id=n.unit_id
 WHERE p_kind='path_special' AND n.id=(SELECT id FROM item) AND n.kind='special' AND n.is_active
 UNION ALL SELECT e.unit_id,false FROM public.learning_exercises e JOIN public.path_nodes n ON n.id=e.node_id AND n.unit_id=e.unit_id
 JOIN public.path_nodes anchor ON anchor.id=n.anchor_node_id AND anchor.unit_id=n.unit_id
 WHERE p_kind='path_special_item' AND e.id=(SELECT id FROM item) AND n.kind='special' AND n.is_active AND e.path_is_active AND e.content_status='ready'
 ) SELECT u.id,u.level,u.trainer::text,u.owner_auth_user_id,u.is_active,r.media FROM refs r JOIN public.learning_units u ON u.id=r.unit_id
 UNION ALL SELECT NULL::uuid,f.level,'videos',NULL::uuid,true,true FROM public.lms_presentation_asset a
 JOIN public.lms_media_folder f ON f.folder_id=a.folder_id WHERE p_kind='presentation' AND a.asset_id=(SELECT id FROM item)
$$;

-- Units whose vocabulary cards, exercises, path tasks and reading texts the
-- caller may read: item_allowed() with i.* taken from the unit, no legacy media
-- (videos only) and no trial references.
CREATE OR REPLACE FUNCTION sitov_access_private.sitov_item_scope_unit_ids() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH me AS (
 SELECT p.id,p.role FROM public.profiles p WHERE p.id=auth.uid() AND sitov_access_private.actor_allowed(p.id)
 ), vip AS (
 SELECT EXISTS(SELECT 1 FROM sitov_access_private.students s JOIN me ON s.student_id=me.id WHERE s.vip_enabled) AS enabled
 ), bought AS (
 SELECT l.code AS level FROM public.learning_levels l JOIN me ON true WHERE sitov_access_private.purchased(me.id,l.code)
 )
 SELECT u.id FROM me JOIN public.learning_units u ON (u.owner_auth_user_id IS NULL OR u.owner_auth_user_id=me.id)
 LEFT JOIN public.learning_trainer_grants g ON g.auth_user_id=me.id AND g.level=u.level AND g.trainer::text=u.trainer::text
 WHERE me.role IN('teacher','admin') OR (me.role='student'
 AND (u.is_active OR u.owner_auth_user_id=me.id) AND u.level IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2')
 AND NOT(u.trainer::text='verbs' AND u.level IN('C1.1','C1.2')) AND (
 (SELECT enabled FROM vip)
 OR u.level IN(SELECT level FROM bought)
 OR (EXISTS(SELECT 1 FROM public.student_level_access l WHERE l.auth_user_id=me.id AND l.level=u.level)
 AND coalesce(g.enabled,true) AND (u.owner_auth_user_id=me.id OR g.unit_mode IS DISTINCT FROM 'selected'
 OR EXISTS(SELECT 1 FROM public.learning_unit_grants x WHERE x.auth_user_id=me.id AND x.level=u.level AND x.trainer::text=u.trainer::text AND x.unit_id=u.id)))))
$$;
CREATE OR REPLACE FUNCTION sitov_access_private.sitov_item_scope_card_ids() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT c.id FROM public.learning_vocabulary_cards c WHERE c.unit_id IN(SELECT sitov_access_private.sitov_item_scope_unit_ids())
$$;
-- Trial rules name individual items; only those callers need the per-item rule.
CREATE OR REPLACE FUNCTION sitov_access_private.sitov_item_scope_exact() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM sitov_access_private.students s WHERE s.student_id=auth.uid() AND s.trial->'rules' IS DISTINCT FROM '[]'::jsonb)
$$;
-- vocabulary_unit_visible() for every unit in one statement: the same predicate
-- without its single-unit filter, so the unit list is not checked row by row.
CREATE OR REPLACE FUNCTION sitov_access_private.sitov_vocabulary_visible_unit_ids() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT u.id FROM public.learning_units u
 JOIN public.profiles p ON p.id=auth.uid()
 LEFT JOIN public.learning_trainer_grants g
  ON g.auth_user_id=p.id AND g.level=u.level AND g.trainer::text=u.trainer::text
 WHERE sitov_access_private.actor_allowed(auth.uid())
 AND EXISTS(SELECT 1 FROM public.learning_vocabulary_cards c WHERE c.unit_id=u.id)
 AND (u.owner_auth_user_id IS NULL OR u.owner_auth_user_id=p.id)
 AND (p.role IN('teacher','admin') OR (p.role='student'
  AND (u.is_active OR u.owner_auth_user_id=p.id)
  AND u.level IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2')
  AND NOT(u.trainer='verbs' AND u.level IN('C1.1','C1.2'))
  AND (
   EXISTS(SELECT 1 FROM sitov_access_private.students s WHERE s.student_id=p.id AND s.vip_enabled)
   OR sitov_access_private.purchased(p.id,u.level)
   OR (EXISTS(SELECT 1 FROM public.student_level_access l WHERE l.auth_user_id=p.id AND l.level=u.level)
    AND coalesce(g.enabled,true)
    AND (u.owner_auth_user_id=p.id OR g.unit_mode IS DISTINCT FROM 'selected'
     OR EXISTS(SELECT 1 FROM public.learning_unit_grants x WHERE x.auth_user_id=p.id
      AND x.level=u.level AND x.trainer::text=u.trainer::text AND x.unit_id=u.id)))
   OR (u.owner_auth_user_id IS NULL AND EXISTS(
    SELECT 1 FROM public.learning_vocabulary_cards c WHERE c.unit_id=u.id
    AND sitov_access_private.trial_item_allowed(p.id,'vocabulary_card',c.id::text,u.id,u.level,u.trainer::text)))
  )))
$$;
REVOKE ALL ON FUNCTION sitov_access_private.sitov_item_scope_unit_ids(),sitov_access_private.sitov_item_scope_card_ids(),sitov_access_private.sitov_item_scope_exact(),sitov_access_private.sitov_vocabulary_visible_unit_ids() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION sitov_access_private.sitov_item_scope_unit_ids(),sitov_access_private.sitov_item_scope_card_ids(),sitov_access_private.sitov_item_scope_exact(),sitov_access_private.sitov_vocabulary_visible_unit_ids() TO authenticated;

ALTER POLICY sitov_vocabulary_unit_metadata ON public.learning_units
 USING(trainer='vocabulary' AND id IN(SELECT sitov_access_private.sitov_vocabulary_visible_unit_ids()));

ALTER POLICY sitov_commercial_item_scope ON public.learning_vocabulary_cards
 USING(unit_id IN(SELECT sitov_access_private.sitov_item_scope_unit_ids())
 OR ((SELECT sitov_access_private.sitov_item_scope_exact()) AND sitov_access_private.item_allowed(auth.uid(),'vocabulary_card',id::text)));
ALTER POLICY sitov_vocabulary_exact_read ON public.learning_vocabulary_cards
 USING(unit_id IN(SELECT sitov_access_private.sitov_item_scope_unit_ids())
 OR ((SELECT sitov_access_private.sitov_item_scope_exact()) AND sitov_access_private.item_allowed(auth.uid(),'vocabulary_card',id::text)));
ALTER POLICY sitov_commercial_item_scope ON public.learning_exercises
 USING((unit_id IN(SELECT sitov_access_private.sitov_item_scope_unit_ids()) AND (node_id IS NULL OR path_is_active))
 OR ((SELECT sitov_access_private.sitov_item_scope_exact()) AND sitov_access_private.item_allowed(auth.uid(),CASE WHEN node_id IS NULL THEN 'exercise' ELSE 'path_task' END,id::text)));
ALTER POLICY sitov_commercial_item_scope ON public.learning_reading_texts
 USING(unit_id IN(SELECT sitov_access_private.sitov_item_scope_unit_ids())
 OR ((SELECT sitov_access_private.sitov_item_scope_exact()) AND sitov_access_private.item_allowed(auth.uid(),'reading_text',id::text)));
-- Migration 93 creates these two policies only where the vocabulary trainer exists.
DO $sitov_vocab$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vocabulary_direction_progress' AND policyname='sitov_vocabulary_progress_scope') THEN
  EXECUTE 'ALTER POLICY sitov_vocabulary_progress_scope ON public.vocabulary_direction_progress USING(auth_user_id=auth.uid() AND (card_id IN(SELECT sitov_access_private.sitov_item_scope_card_ids()) OR ((SELECT sitov_access_private.sitov_item_scope_exact()) AND sitov_access_private.item_allowed(auth.uid(),''vocabulary_card'',card_id::text))))';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vocabulary_translations' AND policyname='sitov_vocabulary_translation_scope') THEN
  EXECUTE 'ALTER POLICY sitov_vocabulary_translation_scope ON public.vocabulary_translations USING(card_id IN(SELECT sitov_access_private.sitov_item_scope_card_ids()) OR ((SELECT sitov_access_private.sitov_item_scope_exact()) AND sitov_access_private.item_allowed(auth.uid(),''vocabulary_card'',card_id::text)))';
 END IF;
END $sitov_vocab$;
NOTIFY pgrst,'reload schema';
