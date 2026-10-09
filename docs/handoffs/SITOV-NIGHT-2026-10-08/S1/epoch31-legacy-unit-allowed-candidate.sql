-- Sitov Academy: review-only proposed113 SELECT body; existing function parameters.
SELECT EXISTS(SELECT 1 FROM public.learning_units u JOIN public.profiles p ON p.id=p_student
 LEFT JOIN public.learning_trainer_grants g ON g.auth_user_id=p.id AND g.level=u.level AND g.trainer=u.trainer
 WHERE u.id=p_unit AND (u.owner_auth_user_id IS NULL OR u.owner_auth_user_id=p.id)
 AND ((p.role IN('teacher','admin') AND (u.trainer<>'verbs' OR u.level IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2'))) OR (u.level IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2')
 AND NOT(u.trainer='verbs' AND u.level IN('C1.1','C1.2')) AND (u.is_active OR u.owner_auth_user_id=p.id)
 AND EXISTS(SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=p.id AND a.level=u.level)
 AND coalesce(g.enabled,true) AND (u.owner_auth_user_id=p.id OR g.unit_mode IS DISTINCT FROM 'selected'
 OR EXISTS(SELECT 1 FROM public.learning_unit_grants x WHERE x.auth_user_id=p.id AND x.unit_id=u.id AND x.level=u.level AND x.trainer=u.trainer)))));
