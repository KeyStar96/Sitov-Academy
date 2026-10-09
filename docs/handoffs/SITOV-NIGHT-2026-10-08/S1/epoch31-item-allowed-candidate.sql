-- Sitov Academy: review-only proposed113 SELECT body; existing function parameters.
SELECT sitov_access_private.actor_allowed(p_student) AND EXISTS(
 SELECT 1 FROM sitov_access_private.resolve_item(p_kind,p_item_id) i JOIN public.profiles p ON p.id=p_student
 LEFT JOIN public.learning_trainer_grants g ON g.auth_user_id=p.id AND g.level=i.level AND g.trainer::text=i.trainer
 WHERE (i.owner_id IS NULL OR i.owner_id=p.id) AND ((p.role IN('teacher','admin') AND (p_kind<>'verb' OR (i.published AND i.trainer='verbs' AND i.level IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2') AND EXISTS(SELECT 1 FROM public.sitov_verb_catalog c WHERE c.id=p_item_id AND c.unit_id=i.unit_id AND c.level=i.level)))) OR (p.role='student'
 AND (i.published OR i.owner_id=p.id) AND i.level IN('A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2')
 AND NOT(i.trainer='verbs' AND i.level IN('C1.1','C1.2')) AND (
 EXISTS(SELECT 1 FROM sitov_access_private.students s WHERE s.student_id=p.id AND s.vip_enabled)
 OR sitov_access_private.purchased(p.id,i.level)
 OR (EXISTS(SELECT 1 FROM public.student_level_access l WHERE l.auth_user_id=p.id AND l.level=i.level)
 AND coalesce(g.enabled,true) AND (i.legacy_media OR i.owner_id=p.id OR g.unit_mode IS DISTINCT FROM 'selected'
 OR EXISTS(SELECT 1 FROM public.learning_unit_grants x WHERE x.auth_user_id=p.id AND x.level=i.level AND x.trainer::text=i.trainer AND x.unit_id=i.unit_id)))
 OR (i.owner_id IS NULL AND sitov_access_private.trial_item_allowed(p.id,p_kind,p_item_id,i.unit_id,i.level,i.trainer))
 ))));
