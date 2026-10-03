-- Repeat-free assignment selection retains the existing locks, level and vocabulary logic.
CREATE INDEX IF NOT EXISTS sitov_daily_quest_assignment_history_idx
 ON public.daily_quest_assignments(auth_user_id,template_id,quest_date DESC);
CREATE OR REPLACE FUNCTION daily_quest_private.ensure_assignment(p_user uuid) RETURNS uuid
LANGUAGE plpgsql VOLATILE SET search_path TO '' AS $$
DECLARE assigned uuid; template public.daily_quests%ROWTYPE; lexeme daily_quest_private.slot_forms%ROWTYPE;
 card uuid; source text:='fallback'; payload jsonb; keys jsonb; target public.cefr_code;
BEGIN
 SELECT a.id INTO assigned FROM public.daily_quest_assignments a WHERE a.auth_user_id=p_user AND a.quest_date=daily_quest_private.today();
 IF assigned IS NOT NULL THEN RETURN assigned; END IF;
 target:=daily_quest_private.target_level(p_user);
 -- Never-seen templates first; then the least recently assigned template.
 -- History belongs to this learner and level. Skips still count as seen.
 -- The starter is day zero; the catalogue interleaves twenty settings per round.
 -- Keep today's snapshot even if mastery or the active course changes today.
 SELECT q.* INTO template FROM public.daily_quests q
 JOIN daily_quest_private.template_keys k ON k.template_id=q.id
 LEFT JOIN LATERAL(SELECT max(a.quest_date) AS last_seen FROM public.daily_quest_assignments a
  WHERE a.auth_user_id=p_user AND a.template_id=q.id) history ON true
 WHERE q.is_active AND q.level=target
 ORDER BY history.last_seen ASC NULLS FIRST,
  coalesce((q.content->>'sitovCatalogDay')::integer,0),q.template_key,q.id LIMIT 1;
 IF template.id IS NULL THEN RETURN NULL; END IF;
 SELECT sf.*,c.id,CASE WHEN bool_or(p.box_number=1) THEN 'box1' ELSE 'recent_wrong' END
 INTO lexeme.category,lexeme.word_de,lexeme.article,lexeme.nominative,lexeme.accusative,card,source
 FROM public.learning_vocabulary_cards c JOIN public.learning_units u ON u.id=c.unit_id AND u.is_active
 JOIN daily_quest_private.slot_forms sf ON sf.category=template.category AND sf.word_de=c.word_de AND sf.article=c.article::text
 JOIN public.vocabulary_direction_progress p ON p.card_id=c.id AND p.auth_user_id=p_user
 LEFT JOIN public.vocabulary_focus_words f ON f.card_id=c.id AND f.auth_user_id=p_user
 WHERE learning_private.unit_allowed(u.id) AND (f.last_error_at>=now()-interval '30 days'
  OR (p.lapses>0 AND p.last_answered_at>=now()-interval '30 days')
  OR EXISTS(SELECT 1 FROM vocabulary_private.answer_receipts r WHERE r.auth_user_id=p_user AND r.progress_id=p.id
   AND r.is_correct=false AND r.created_at>=now()-interval '30 days'))
 GROUP BY sf.category,sf.word_de,sf.article,sf.nominative,sf.accusative,c.id
 ORDER BY bool_or(p.box_number=1) DESC,max(greatest(p.last_answered_at,f.last_error_at)) DESC NULLS LAST,c.id LIMIT 1;
 IF card IS NULL THEN SELECT sf.* INTO lexeme FROM daily_quest_private.slot_forms sf WHERE sf.category=template.category AND sf.word_de=template.fallback_word_de AND sf.article=template.fallback_article; source:='fallback'; END IF;
 IF lexeme.word_de IS NULL THEN RETURN NULL; END IF;
 payload:=daily_quest_private.render(template.content,lexeme.nominative,lexeme.accusative)
  || jsonb_build_object('level',template.level,'templateKey',template.template_key,'personalization',jsonb_build_object('source',source,'cardId',card));
 SELECT k.answer_key INTO keys FROM daily_quest_private.template_keys k WHERE k.template_id=template.id;
 INSERT INTO public.daily_quest_assignments(auth_user_id,quest_date,template_id,snapshot)
 VALUES(p_user,daily_quest_private.today(),template.id,payload) RETURNING id INTO assigned;
 INSERT INTO daily_quest_private.assignment_keys(assignment_id,answer_key) VALUES(assigned,keys);
 RETURN assigned;
END $$;

-- Staff browse the whole catalogue without creating assignments or login claims.
CREATE OR REPLACE FUNCTION daily_quest_private.sitov_catalog(p_level text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); staff_role text; templates jsonb;
BEGIN
 IF actor IS NULL THEN RETURN daily_quest_private.error('not_authenticated'); END IF;
 SELECT p.role::text INTO staff_role FROM public.profiles p WHERE p.id=actor;
 IF staff_role IS NULL OR staff_role NOT IN('teacher','admin') THEN RETURN daily_quest_private.error('not_authorized'); END IF;
 IF p_level IS NULL OR p_level NOT IN('A1','A2','B1','B2','C1','C2') THEN RETURN daily_quest_private.error('invalid_input'); END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('templateKey',q.template_key,'level',q.level,
  'title',q.content->>'title','subtitle',q.content->>'subtitle','day',coalesce((q.content->>'sitovCatalogDay')::integer,0))
  ORDER BY coalesce((q.content->>'sitovCatalogDay')::integer,0),q.template_key),'[]'::jsonb)
 INTO templates FROM public.daily_quests q JOIN daily_quest_private.template_keys k ON k.template_id=q.id
 WHERE q.is_active AND q.level::text=p_level;
 RETURN jsonb_build_object('success',true,'templates',templates);
END $$;

CREATE OR REPLACE FUNCTION daily_quest_private.sitov_preview(p_level text,p_template_key text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); staff_role text; template public.daily_quests%ROWTYPE;
 lexeme daily_quest_private.slot_forms%ROWTYPE; payload jsonb; keys jsonb;
BEGIN
 IF actor IS NULL THEN RETURN daily_quest_private.error('not_authenticated'); END IF;
 SELECT p.role::text INTO staff_role FROM public.profiles p WHERE p.id=actor;
 IF staff_role IS NULL OR staff_role NOT IN('teacher','admin') THEN RETURN daily_quest_private.error('not_authorized'); END IF;
 IF p_level IS NULL OR p_level NOT IN('A1','A2','B1','B2','C1','C2') OR p_template_key IS NULL
  OR length(p_template_key)>120 OR p_template_key !~ '^sitov-[a-z0-9-]+$' THEN RETURN daily_quest_private.error('invalid_input'); END IF;
 SELECT q.* INTO template FROM public.daily_quests q JOIN daily_quest_private.template_keys k ON k.template_id=q.id
 WHERE q.is_active AND q.level::text=p_level AND q.template_key=p_template_key;
 IF template.id IS NULL THEN RETURN daily_quest_private.error('no_template'); END IF;
 SELECT k.answer_key INTO keys FROM daily_quest_private.template_keys k WHERE k.template_id=template.id;
 SELECT sf.* INTO lexeme FROM daily_quest_private.slot_forms sf WHERE sf.category=template.category
  AND sf.word_de=template.fallback_word_de AND sf.article=template.fallback_article;
 IF lexeme.word_de IS NULL THEN RETURN daily_quest_private.error('no_template'); END IF;
 payload:=daily_quest_private.render(template.content,lexeme.nominative,lexeme.accusative) || jsonb_build_object(
  'id',template.id,'date',daily_quest_private.today(),'level',template.level,'templateKey',template.template_key,
  'status','active','completedStepIds','[]'::jsonb,'personalization',jsonb_build_object('source','fallback','cardId',NULL));
 RETURN jsonb_build_object('success',true,'quest',payload,'answerKey',jsonb_build_object('steps',keys->'steps'));
END $$;

CREATE OR REPLACE FUNCTION public.get_sitov_daily_quest_catalog(p_level text DEFAULT 'A1')
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $$ SELECT daily_quest_private.sitov_catalog(p_level) $$;
CREATE OR REPLACE FUNCTION public.get_sitov_daily_quest_preview(p_level text,p_template_key text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $$ SELECT daily_quest_private.sitov_preview(p_level,p_template_key) $$;
REVOKE ALL ON FUNCTION daily_quest_private.sitov_catalog(text),daily_quest_private.sitov_preview(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION daily_quest_private.sitov_catalog(text),daily_quest_private.sitov_preview(text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.get_sitov_daily_quest_catalog(text),public.get_sitov_daily_quest_preview(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_sitov_daily_quest_catalog(text),public.get_sitov_daily_quest_preview(text,text) TO authenticated;
