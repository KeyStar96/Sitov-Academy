-- Sitov Academy: restore the previous rotation without deleting any assignments or earned progress.
-- Use with the matching application rollback. Keep the new scene assets available.
CREATE OR REPLACE FUNCTION daily_quest_private.ensure_assignment(p_user uuid) RETURNS uuid
LANGUAGE plpgsql VOLATILE SET search_path TO '' AS $$
DECLARE assigned uuid; template public.daily_quests%ROWTYPE; lexeme daily_quest_private.slot_forms%ROWTYPE;
 card uuid; source text:='fallback'; payload jsonb; keys jsonb; target public.cefr_code;
BEGIN
 SELECT a.id INTO assigned FROM public.daily_quest_assignments a WHERE a.auth_user_id=p_user AND a.quest_date=daily_quest_private.today();
 IF assigned IS NOT NULL THEN RETURN assigned; END IF;
 target:=daily_quest_private.target_level(p_user);
 -- Stable day-based rotation over actual published templates; snapshots ensure
 -- later content edits and changed word boxes cannot change an assigned quest.
 SELECT q.* INTO template FROM public.daily_quests q JOIN daily_quest_private.template_keys k ON k.template_id=q.id
 WHERE q.is_active AND q.level=target ORDER BY md5(q.template_key||daily_quest_private.today()::text),q.id LIMIT 1;
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
