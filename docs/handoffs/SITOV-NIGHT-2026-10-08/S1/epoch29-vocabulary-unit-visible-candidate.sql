-- Sitov Academy: review-only proposed function body; p_unit is its existing parameter.
-- Preserve SECURITY DEFINER/STABLE/search_path/owner/ACL. Not executed or installed.
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
);
