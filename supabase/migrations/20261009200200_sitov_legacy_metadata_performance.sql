-- Sitov Academy: restore exact legacy metadata and factor vocabulary authorization.
-- Reviewed epoch29 bodies; preserve existing owners, ACLs and function properties.
CREATE OR REPLACE FUNCTION learning_private.allowed_unit_ids() RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $sitov$
WITH legacy AS MATERIALIZED (
SELECT COALESCE(array_agg(u.id), ARRAY[]::uuid[]) AS ids
 FROM public.profiles p
 CROSS JOIN public.learning_units u
 LEFT JOIN public.student_level_access l ON l.auth_user_id=p.id AND l.level=u.level
 LEFT JOIN public.learning_trainer_grants a
   ON a.auth_user_id=p.id AND a.level=u.level AND a.trainer=u.trainer
 WHERE p.id=(SELECT auth.uid()) AND CASE WHEN u.owner_auth_user_id IS NULL THEN (p.role IN ('teacher','admin') OR (
   p.ui_language<>'de' AND u.is_active AND l.auth_user_id IS NOT NULL
   AND u.trainer::text IN ('vocabulary','exercises','pronunciation','videos')
   AND COALESCE(a.enabled,true) AND (a.unit_mode IS DISTINCT FROM 'selected' OR EXISTS (
     SELECT 1 FROM public.learning_unit_grants g WHERE g.auth_user_id=p.id
       AND g.level=u.level AND g.trainer=u.trainer AND g.unit_id=u.id))))
  -- Eigene Unit: dieselbe Bedingung wie trainer_access_private.allowed(),
  -- ohne Lektionsauswahl.
  ELSE u.owner_auth_user_id=p.id AND (p.role IN ('teacher','admin') OR (
   p.ui_language<>'de' AND l.auth_user_id IS NOT NULL AND COALESCE(a.enabled,true))) END
), commercial AS MATERIALIZED (
 SELECT p.id,coalesce(s.vip_enabled,false) AS vip,s.trial,
  ARRAY(SELECT DISTINCT o.level FROM sitov_access_private.purchases g
   JOIN sitov_access_private.orders o ON o.id=g.order_id
   WHERE o.student_id=p.id AND g.active AND o.status='paid'
    AND o.provider_confirmation_verified) AS paid_levels
 FROM public.profiles p LEFT JOIN sitov_access_private.students s ON s.student_id=p.id
 WHERE p.id=auth.uid() AND p.role='student' AND sitov_access_private.actor_allowed(p.id)
), expanded AS (
 SELECT u.id FROM public.learning_units u CROSS JOIN commercial c
 WHERE (u.owner_auth_user_id IS NULL OR u.owner_auth_user_id=c.id)
  AND (u.is_active OR u.owner_auth_user_id=c.id)
  AND u.level IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2')
  AND NOT(u.trainer='verbs' AND u.level IN('C1.1','C1.2'))
  AND (c.vip OR u.level=ANY(c.paid_levels)
   OR (u.owner_auth_user_id IS NULL AND EXISTS(
    SELECT 1 FROM jsonb_array_elements(c.trial->'rules') r
    WHERE r->>'level'=u.level AND r->>'trainer'=u.trainer::text
     AND (r->'unit_ids'='null'::jsonb OR r->'unit_ids' @> to_jsonb(ARRAY[u.id::text]))
     AND (r->'items'='null'::jsonb OR EXISTS(
      SELECT 1 FROM jsonb_array_elements(r->'items') b
      WHERE b->>'unit_id'=u.id::text AND b->'refs'='null'::jsonb)))))
)
SELECT legacy.ids || ARRAY(SELECT DISTINCT e.id FROM expanded e
 WHERE NOT(e.id=ANY(legacy.ids)) ORDER BY e.id) AS ids FROM legacy
$sitov$;

CREATE OR REPLACE FUNCTION sitov_access_private.vocabulary_unit_visible(p_unit uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $sitov$
SELECT sitov_access_private.actor_allowed(auth.uid()) AND EXISTS (
 SELECT 1 FROM public.learning_units u
 JOIN public.profiles p ON p.id=auth.uid()
 LEFT JOIN public.learning_trainer_grants g
  ON g.auth_user_id=p.id AND g.level=u.level AND g.trainer::text=u.trainer::text
 WHERE u.id=p_unit
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
)
$sitov$;
