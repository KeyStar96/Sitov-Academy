-- Phase 4: EXPLAIN showed repeated per-card and per-translation permission work.
-- Compute the same unit_allowed permissions with set joins once per statement.
-- Regression tests compare this set against the original predicate for every unit.
-- This is an internal RLS helper, not a public RPC or a process/session cache.
CREATE OR REPLACE FUNCTION learning_private.allowed_unit_ids() RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
 SELECT COALESCE(array_agg(u.id), ARRAY[]::uuid[])
 FROM public.profiles p
 CROSS JOIN public.learning_units u
 LEFT JOIN public.student_level_access l ON l.auth_user_id=p.id AND l.level=u.level
 LEFT JOIN public.learning_trainer_grants a
   ON a.auth_user_id=p.id AND a.level=u.level AND a.trainer=u.trainer
 WHERE p.id=(SELECT auth.uid()) AND (p.role IN ('teacher','admin') OR (
   p.ui_language<>'de' AND u.is_active AND l.auth_user_id IS NOT NULL
   AND u.trainer::text IN ('vocabulary','exercises','pronunciation','videos')
   AND COALESCE(a.enabled,true) AND (a.unit_mode IS DISTINCT FROM 'selected' OR EXISTS (
     SELECT 1 FROM public.learning_unit_grants g WHERE g.auth_user_id=p.id
       AND g.level=u.level AND g.trainer=u.trainer AND g.unit_id=u.id))));
$$;
REVOKE ALL ON FUNCTION learning_private.allowed_unit_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION learning_private.allowed_unit_ids() TO authenticated, service_role;

ALTER POLICY released_content_read ON public.learning_vocabulary_cards
 USING (unit_id = ANY ((SELECT learning_private.allowed_unit_ids())::uuid[]));
ALTER POLICY released_units ON public.learning_units
 USING (id = ANY ((SELECT learning_private.allowed_unit_ids())::uuid[]));
ALTER POLICY vocabulary_progress_read ON public.vocabulary_direction_progress
 USING ((SELECT identity_private.current_profile_role()) IN ('teacher','admin') OR
   (auth_user_id=(SELECT auth.uid()) AND card_id IN
     (SELECT c.id FROM public.learning_vocabulary_cards c
      WHERE c.unit_id = ANY ((SELECT learning_private.allowed_unit_ids())::uuid[]))));

-- Rollback (transactional, through the runner, with a fresh R8 backup):
-- ALTER POLICY released_content_read ON public.learning_vocabulary_cards USING (learning_private.unit_allowed(unit_id));
-- ALTER POLICY released_units ON public.learning_units USING (learning_private.unit_allowed(id));
-- ALTER POLICY vocabulary_progress_read ON public.vocabulary_direction_progress USING (
--   (SELECT identity_private.current_profile_role()) IN ('teacher','admin') OR
--   (auth_user_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.learning_vocabulary_cards c
--    WHERE c.id=vocabulary_direction_progress.card_id AND learning_private.unit_allowed(c.unit_id))));
-- DROP FUNCTION IF EXISTS learning_private.allowed_unit_ids();
