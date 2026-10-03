-- Restore analytics without verb mode. All verb records remain intact.
CREATE OR REPLACE FUNCTION public.get_learning_progress(p_student_id uuid DEFAULT NULL,p_level text DEFAULT NULL,p_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); learner uuid; staff boolean; today date:=(now() AT TIME ZONE 'Europe/Berlin')::date;
 first_day date; range_start timestamptz; range_end timestamptz; scope text[];
 daily jsonb; vocabulary jsonb; focus jsonb; path jsonb; pronunciation jsonb; media jsonb;
BEGIN
 IF actor IS NULL THEN RETURN jsonb_build_object('error','not_authenticated','message','Authentication is required.'); END IF;
 staff:=business_private.is_staff();
 learner:=coalesce(p_student_id,actor);
 IF learner<>actor AND NOT staff THEN RETURN jsonb_build_object('error','not_authorized','message','Staff access required.'); END IF;
 IF p_days IS NULL OR p_days NOT BETWEEN 7 AND 90 THEN RETURN jsonb_build_object('error','invalid_input','message','Choose 7 to 90 days.'); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=learner AND role='student') THEN
  RETURN jsonb_build_object('error','not_found','message','Student not found.'); END IF;
 IF p_level IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.learning_levels WHERE code=p_level) THEN
  RETURN jsonb_build_object('error','not_found','message','Level not found.'); END IF;
 first_day:=today-(p_days-1);
 range_start:=first_day::timestamp AT TIME ZONE 'Europe/Berlin';
 range_end:=(today+1)::timestamp AT TIME ZONE 'Europe/Berlin';
 -- Gesamtstände: gewähltes Niveau, sonst alle freigeschalteten Niveaus.
 scope:=CASE WHEN p_level IS NOT NULL THEN ARRAY[p_level]
  ELSE coalesce((SELECT array_agg(a.level) FROM public.student_level_access a WHERE a.auth_user_id=learner),ARRAY[]::text[]) END;

 WITH days AS (SELECT first_day+n AS day FROM generate_series(0,p_days-1) n),
 vocab AS (
  SELECT (r.created_at AT TIME ZONE 'Europe/Berlin')::date AS day,count(*) answers,
   count(*) FILTER(WHERE r.response->>'isCorrect'='true') correct
  FROM vocabulary_private.answer_receipts r
  JOIN public.vocabulary_direction_progress p ON p.id=r.progress_id AND p.auth_user_id=r.auth_user_id
  JOIN public.learning_vocabulary_cards c ON c.id=p.card_id JOIN public.learning_units u ON u.id=c.unit_id
  WHERE r.auth_user_id=learner AND r.created_at>=range_start AND r.created_at<range_end AND (p_level IS NULL OR u.level=p_level)
  GROUP BY 1),
 -- Ein Wort gilt als gelernt, sobald die zweite Richtung Phase 7 erreicht.
 -- Phase 7 ist endgültig; ohne Quittung (Altbestand) bleibt der Tag unbekannt.
 learned_directions AS (
  SELECT r.progress_id,min(r.created_at) learned_at FROM vocabulary_private.answer_receipts r
  WHERE r.auth_user_id=learner AND r.response->>'becameLearned'='true' GROUP BY r.progress_id),
 learned AS (
  SELECT (max(ld.learned_at) AT TIME ZONE 'Europe/Berlin')::date AS day
  FROM public.vocabulary_direction_progress p JOIN public.learning_vocabulary_cards c ON c.id=p.card_id
  JOIN public.learning_units u ON u.id=c.unit_id LEFT JOIN learned_directions ld ON ld.progress_id=p.id
  WHERE p.auth_user_id=learner AND p.box_number=7 AND (p_level IS NULL OR u.level=p_level)
  GROUP BY p.card_id HAVING count(*)=2 AND bool_and(ld.learned_at IS NOT NULL)),
 learned_days AS (SELECT day,count(*) learned FROM learned WHERE day>=first_day GROUP BY day),
 focus_days AS (
  SELECT (f.created_at AT TIME ZONE 'Europe/Berlin')::date AS day,count(*) answers,count(*) FILTER(WHERE f.is_correct) correct
  FROM vocabulary_private.focus_receipts f JOIN public.learning_vocabulary_cards c ON c.id=f.card_id JOIN public.learning_units u ON u.id=c.unit_id
  WHERE f.auth_user_id=learner AND f.created_at>=range_start AND f.created_at<range_end AND (p_level IS NULL OR u.level=p_level)
  GROUP BY 1),
 path_events AS (
  SELECT (receipt.created_at AT TIME ZONE 'Europe/Berlin')::date AS day,receipt.response->'grade'->>'status' IN('EXACT','SOFT_ERROR') correct
  FROM path_private.answer_receipts receipt JOIN public.path_practice_runs r ON r.id=receipt.run_id
  JOIN public.path_nodes n ON n.id=r.node_id JOIN public.learning_units u ON u.id=n.unit_id
  WHERE r.auth_user_id=learner AND receipt.created_at>=range_start AND receipt.created_at<range_end
   AND receipt.response->'grade'->>'status' IN('EXACT','SOFT_ERROR','INCORRECT') AND (p_level IS NULL OR u.level=p_level)
  UNION ALL
  SELECT (ans.answered_at AT TIME ZONE 'Europe/Berlin')::date,ans.result->>'status' IN('EXACT','SOFT_ERROR')
  FROM public.path_test_answers ans JOIN public.path_test_attempts a ON a.id=ans.attempt_id
  JOIN public.path_nodes n ON n.id=a.node_id JOIN public.learning_units u ON u.id=n.unit_id
  WHERE a.auth_user_id=learner AND ans.answered_at>=range_start AND ans.answered_at<range_end
   AND ans.result->>'status' IN('EXACT','SOFT_ERROR','INCORRECT') AND (p_level IS NULL OR u.level=p_level)),
 path_days AS (SELECT day,count(*) answers,count(*) FILTER(WHERE correct) correct FROM path_events GROUP BY day),
 station_days AS (
  SELECT (pr.completed_at AT TIME ZONE 'Europe/Berlin')::date AS day,count(*) stations
  FROM public.path_node_progress pr JOIN public.path_nodes n ON n.id=pr.node_id JOIN public.learning_units u ON u.id=n.unit_id
  WHERE pr.auth_user_id=learner AND pr.is_active AND pr.status='completed' AND pr.completed_at>=range_start AND pr.completed_at<range_end
   AND (p_level IS NULL OR u.level=p_level)
  GROUP BY 1),
 pron_events AS (
  SELECT (s.created_at AT TIME ZONE 'Europe/Berlin')::date AS day,true own
  FROM public.submissions s WHERE s.auth_user_id=learner AND s.type='audio'
   AND s.created_at>=range_start AND s.created_at<range_end AND (p_level IS NULL OR s.level=p_level)
  UNION ALL
  SELECT (m.created_at AT TIME ZONE 'Europe/Berlin')::date,m.sender_role='student'
  FROM public.pronunciation_messages m JOIN public.submissions s ON s.id=m.submission_id
  WHERE s.auth_user_id=learner AND m.created_at>=range_start AND m.created_at<range_end AND (p_level IS NULL OR s.level=p_level)
   AND ((m.sender_role='student' AND m.sender_id=learner AND m.audio_path IS NOT NULL) OR m.sender_role IN('teacher','admin'))),
 pron_days AS (SELECT day,count(*) FILTER(WHERE own) recordings,count(*) FILTER(WHERE NOT own) replies FROM pron_events GROUP BY day),
 media_days AS (
  SELECT v.day,count(*) views FROM public.learning_media_views v
  WHERE v.auth_user_id=learner AND v.day>=first_day AND v.day<=today AND (p_level IS NULL OR v.level=p_level) GROUP BY v.day),
 time_days AS (
  SELECT (ls.ended_at AT TIME ZONE 'Europe/Berlin')::date AS day,
   sum(ls.study_seconds) FILTER(WHERE ls.mode='vocabulary') vocabulary,
   sum(ls.study_seconds) FILTER(WHERE ls.mode='path') path,
   sum(ls.study_seconds) FILTER(WHERE ls.mode='pronunciation') pronunciation
  FROM public.learning_sessions ls
  WHERE ls.auth_user_id=learner AND ls.is_active AND ls.ended_at>=range_start AND ls.ended_at<range_end AND (p_level IS NULL OR ls.level=p_level)
  GROUP BY 1)
 SELECT jsonb_agg(jsonb_build_object('date',d.day,
  'vocabulary',jsonb_build_object('answers',coalesce(v.answers,0),'correct',coalesce(v.correct,0),'learned',coalesce(l.learned,0),'seconds',coalesce(t.vocabulary,0)),
  'focus',jsonb_build_object('answers',coalesce(f.answers,0),'correct',coalesce(f.correct,0)),
  'path',jsonb_build_object('answers',coalesce(pa.answers,0),'correct',coalesce(pa.correct,0),'stations',coalesce(st.stations,0),'seconds',coalesce(t.path,0)),
  'pronunciation',jsonb_build_object('recordings',coalesce(pr.recordings,0),'replies',coalesce(pr.replies,0),'seconds',coalesce(t.pronunciation,0)),
  'media',jsonb_build_object('views',coalesce(m.views,0))) ORDER BY d.day)
 INTO daily
 FROM days d LEFT JOIN vocab v ON v.day=d.day LEFT JOIN learned_days l ON l.day=d.day LEFT JOIN focus_days f ON f.day=d.day
 LEFT JOIN path_days pa ON pa.day=d.day LEFT JOIN station_days st ON st.day=d.day LEFT JOIN pron_days pr ON pr.day=d.day
 LEFT JOIN media_days m ON m.day=d.day LEFT JOIN time_days t ON t.day=d.day;

 -- Wortschatz: pro Wort zählt die niedrigere Phase beider Richtungen (wie 52),
 -- aber nur aktive Lektionen und nie eigene Wörter anderer Personen.
 WITH cards AS (
  SELECT c.id,CASE WHEN count(p.id)=0 THEN NULL WHEN count(p.id)=2 AND bool_and(p.box_number=7) THEN 7 ELSE least(6,min(p.box_number)) END phase
  FROM public.learning_vocabulary_cards c
  JOIN public.learning_units u ON u.id=c.unit_id AND u.is_active AND u.trainer='vocabulary'
   AND (u.owner_auth_user_id IS NULL OR u.owner_auth_user_id=learner)
  LEFT JOIN public.vocabulary_direction_progress p ON p.card_id=c.id AND p.auth_user_id=learner
  WHERE u.level=ANY(scope) GROUP BY c.id),
 buckets AS (SELECT n phase,count(c.id) count FROM generate_series(1,7) n LEFT JOIN cards c ON c.phase=n GROUP BY n)
 SELECT jsonb_build_object('totalWords',(SELECT count(*) FROM cards),'inBox',(SELECT count(phase) FROM cards),
  'learnedWords',(SELECT count(*) FROM cards WHERE phase=7),
  -- Alle je gelernten Wörter (auch in Niveaus außerhalb des Bereichs) für die Summenkurve.
  'learnedTotal',(SELECT count(*) FROM (SELECT p.card_id FROM public.vocabulary_direction_progress p
    JOIN public.learning_vocabulary_cards c ON c.id=p.card_id JOIN public.learning_units u ON u.id=c.unit_id
    WHERE p.auth_user_id=learner AND (p_level IS NULL OR u.level=p_level) GROUP BY p.card_id HAVING count(*)=2 AND bool_and(p.box_number=7)) x),
  'overallPercent',(SELECT CASE WHEN count(*)=0 THEN 0 ELSE round(coalesce(sum(phase),0)::numeric/(count(*)*7)*100) END FROM cards),
  'buckets',(SELECT jsonb_agg(jsonb_build_object('key',CASE WHEN phase=7 THEN to_jsonb('learned'::text) ELSE to_jsonb(phase) END,'count',count) ORDER BY phase) FROM buckets))
 INTO vocabulary;

 -- Problemwörter: Lehrkräfte sehen keine eigenen Wörter der Lernenden (privat).
 WITH scoped AS (
  SELECT f.*,btrim(c.word_de) word,nullif(c.article::text,'none') article,u.level,u.owner_auth_user_id IS NOT NULL owned
  FROM public.vocabulary_focus_words f JOIN public.learning_vocabulary_cards c ON c.id=f.card_id
  JOIN public.learning_units u ON u.id=c.unit_id AND u.trainer='vocabulary'
  WHERE f.auth_user_id=learner AND f.status IN('active','mastered') AND (p_level IS NULL OR u.level=p_level)
   AND EXISTS(SELECT 1 FROM public.vocabulary_direction_progress p WHERE p.auth_user_id=learner AND p.card_id=f.card_id))
 SELECT jsonb_build_object(
  'active',(SELECT count(*) FROM scoped WHERE status='active'),
  'due',(SELECT count(*) FROM scoped WHERE status='active' AND due_at<=now()),
  'mastered',(SELECT count(*) FROM scoped WHERE status='mastered'),
  'articleWords',(SELECT count(*) FROM scoped WHERE status='active' AND article_errors>=2 AND article IN('der','die','das')),
  'words',coalesce((SELECT jsonb_agg(jsonb_build_object('cardId',s.card_id,'word',s.word,'article',s.article,'level',s.level,
    'status',s.status,'stage',s.stage,'dueAt',s.due_at,'due',s.status='active' AND s.due_at<=now(),'wrongCount',s.wrong_count,'articleErrors',s.article_errors,
    'practiceCount',s.practice_count,'practiceCorrect',s.practice_correct,'masteredAt',s.mastered_at)
    ORDER BY s.status,s.wrong_count+s.article_errors DESC,s.word)
   FROM (SELECT * FROM scoped WHERE NOT (staff AND learner<>actor AND owned) ORDER BY status,wrong_count+article_errors DESC,word LIMIT 40) s),'[]'))
 INTO focus;

 WITH nodes AS (
  SELECT n.id,n.kind,u.id unit_id FROM public.path_nodes n JOIN public.learning_units u ON u.id=n.unit_id AND u.is_path AND u.is_active
  WHERE n.is_active AND u.level=ANY(scope)),
 done AS (
  SELECT DISTINCT pr.node_id FROM public.path_node_progress pr JOIN nodes ON nodes.id=pr.node_id
  WHERE pr.auth_user_id=learner AND pr.is_active AND pr.status='completed'
  UNION
  SELECT DISTINCT a.node_id FROM public.path_test_attempts a JOIN nodes ON nodes.id=a.node_id
  WHERE a.auth_user_id=learner AND a.is_active AND a.status='completed' AND a.passed),
 tests AS (
  SELECT a.completed_at,a.percentage,a.passed,coalesce(n.title,n.topic) title
  FROM public.path_test_attempts a JOIN public.path_nodes n ON n.id=a.node_id JOIN public.learning_units u ON u.id=n.unit_id
  WHERE a.auth_user_id=learner AND a.status='completed' AND a.completed_at>=range_start AND a.completed_at<range_end
   AND (p_level IS NULL OR u.level=p_level)
  ORDER BY a.completed_at DESC LIMIT 20)
 SELECT jsonb_build_object('totalStations',(SELECT count(*) FROM nodes),'completedStations',(SELECT count(*) FROM done),
  'totalUnits',(SELECT count(DISTINCT unit_id) FROM nodes),
  'completedUnits',(SELECT count(DISTINCT n.unit_id) FROM done JOIN nodes n ON n.id=done.node_id WHERE n.kind='test'),
  'tests',coalesce((SELECT jsonb_agg(jsonb_build_object('completedAt',t.completed_at,'percentage',round(t.percentage),'passed',coalesce(t.passed,false),'title',t.title) ORDER BY t.completed_at) FROM tests t),'[]'))
 INTO path;

 WITH texts AS (
  SELECT r.id FROM public.learning_reading_texts r
  JOIN public.learning_units u ON u.id=r.unit_id AND u.trainer='pronunciation' AND u.is_active AND u.owner_auth_user_id IS NULL
  WHERE u.level=ANY(scope)),
 recordings AS (SELECT s.id,s.prompt_id,s.created_at FROM public.submissions s
  WHERE s.auth_user_id=learner AND s.type='audio' AND (p_level IS NULL OR s.level=p_level))
 SELECT jsonb_build_object('totalTexts',(SELECT count(*) FROM texts),
  'practicedTexts',(SELECT count(DISTINCT rec.prompt_id) FROM recordings rec JOIN texts ON texts.id=rec.prompt_id),
  'recordings',(SELECT count(*) FROM recordings)+(SELECT count(*) FROM public.pronunciation_messages m JOIN recordings rec ON rec.id=m.submission_id
    WHERE m.sender_role='student' AND m.sender_id=learner AND m.audio_path IS NOT NULL),
  'awaitingReply',(SELECT count(*) FROM recordings rec WHERE NOT EXISTS(SELECT 1 FROM public.pronunciation_messages reply
    WHERE reply.submission_id=rec.id AND reply.sender_role IN('teacher','admin')
     AND reply.created_at>=coalesce((SELECT max(m.created_at) FROM public.pronunciation_messages m WHERE m.submission_id=rec.id
      AND m.sender_role='student' AND m.audio_path IS NOT NULL),rec.created_at))))
 INTO pronunciation;

 -- Verfügbare Medien der Niveaus im Bereich (Ordner-Videos, Links, Unterlagen).
 WITH available AS (
  SELECT v.id,v.title,CASE WHEN v.storage_path IS NULL THEN 'link' ELSE 'video' END kind
  FROM public.learning_videos v JOIN public.learning_units u ON u.id=v.unit_id AND u.is_active
  WHERE u.level=ANY(scope) AND (v.folder_id IS NULL OR EXISTS(SELECT 1 FROM public.lms_media_folder f WHERE f.folder_id=v.folder_id AND f.level=u.level))
  UNION ALL
  SELECT a.asset_id,a.file_name,'presentation' FROM public.lms_presentation_asset a JOIN public.lms_media_folder f ON f.folder_id=a.folder_id
  WHERE f.level=ANY(scope)),
 seen AS (
  SELECT v.kind,v.object_id,max(v.last_viewed_at) last_viewed_at,sum(v.view_count) views
  FROM public.learning_media_views v WHERE v.auth_user_id=learner AND (p_level IS NULL OR v.level=p_level) GROUP BY v.kind,v.object_id)
 SELECT jsonb_build_object('totalMedia',(SELECT count(*) FROM available),
  'viewedMedia',(SELECT count(*) FROM available a WHERE EXISTS(SELECT 1 FROM seen s WHERE s.object_id=a.id AND s.kind=a.kind)),
  'recent',coalesce((SELECT jsonb_agg(jsonb_build_object('kind',r.kind,'title',r.title,'viewedAt',r.last_viewed_at,'views',r.views) ORDER BY r.last_viewed_at DESC)
   FROM (SELECT s.kind,coalesce(v.title,p.file_name) title,s.last_viewed_at,s.views FROM seen s
    LEFT JOIN public.learning_videos v ON v.id=s.object_id AND s.kind IN('video','link')
    LEFT JOIN public.lms_presentation_asset p ON p.asset_id=s.object_id AND s.kind='presentation'
    WHERE coalesce(v.title,p.file_name) IS NOT NULL ORDER BY s.last_viewed_at DESC LIMIT 8) r),'[]'))
 INTO media;

 RETURN jsonb_build_object('success',true,'studentId',learner,'level',p_level,'days',p_days,'today',today,'timezone','Europe/Berlin',
  'daily',daily,'vocabulary',vocabulary,'focus',focus,'path',path,'pronunciation',pronunciation,'media',media);
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('error','request_failed','message','Learning progress could not be loaded.','sqlstate',SQLSTATE);
END $$;
REVOKE ALL ON FUNCTION public.get_learning_progress(uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_learning_progress(uuid,text,integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
