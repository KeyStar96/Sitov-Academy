-- Master 4, Phase 2.6. R8: run only through migrate-local.py after its verified
-- backup; migrate-local wraps this regular file in one transaction. Every
-- statement is idempotent. Rollback: supabase/vps/rollback/32_last_active_level.sql.
-- No tables, columns, enum values or learner data change.
--
-- get_last_active_level(): Welches Niveau hat die aufrufende Person zuletzt
-- gelernt? Home („Deine Lernbereiche · A1.2") und der Reiter „Lernen" folgen
-- damit dem zuletzt gelernten Niveau statt dem ersten angefangenen.
--
-- Lernhandlungen (nur eigene, nur Niveaus mit gültiger Freischaltung):
--   * Vokabel-Antworten: vocabulary_private.answer_receipts (Tippen und
--     Selbsteinschätzung) und vocabulary_direction_progress.last_answered_at
--     (dieselbe Antwort, auch für Antworten vor den Quittungen).
--   * Grammatik-Versuche: user_exercise_progress mit Versuch oder Abschluss.
--   * Aussprache-Aufnahmen: submissions.
--   * Ab Phase 3 kommen Lernpfad-Versuche hinzu (eigene Migration).
-- Das Einschalten einer Lektion ohne Antwort ist keine Lernhandlung.
--
-- Rückfall ohne Lernhandlung: das erste angefangene Niveau (Lernstand ohne
-- Antwort, z. B. eingeschaltete Lektion), sonst das erste freigeschaltete
-- Niveau in der Reihenfolge von learning_levels.sort_order.
--
-- Antwort (R10): {"level","mode","source","levels":[…]} oder
-- {"error","message"}. mode ∈ vocabulary | exercises | pronunciation | null.
-- source ∈ activity | started | unlocked | none. "levels" nennt je
-- freigeschaltetem Niveau mit Lernhandlung den zuletzt genutzten Modus und die
-- letzte Stelle (Lektion bzw. Grammatik-Thema) — die Niveau-Seite zeigt daraus
-- „Weiter, wo du aufgehört hast". Keine Bewertung, keine Lösungen (R5).

CREATE OR REPLACE FUNCTION public.get_last_active_level() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
 actor uuid:=(SELECT auth.uid());
 staff boolean;
 recent jsonb;
 fallback_level text;
 fallback_source text;
 boundary_state text;
BEGIN
 IF actor IS NULL THEN
  RETURN jsonb_build_object('error','authentication_required','message','Sign in to continue.','sqlstate','42501');
 END IF;
 SELECT p.role::text IN('teacher','admin') INTO staff FROM public.profiles p WHERE p.id=actor;
 staff:=coalesce(staff,false);

 WITH allowed AS (
  SELECT l.code AS level,l.sort_order FROM public.learning_levels l
  WHERE l.is_active AND (staff OR EXISTS(SELECT 1 FROM public.student_level_access a
   WHERE a.auth_user_id=actor AND a.level=l.code))
 ), activity AS (
  SELECT u.level,'vocabulary'::text AS mode,r.created_at AS at,u.label AS unit_label,NULL::text AS topic
  FROM vocabulary_private.answer_receipts r
  JOIN public.vocabulary_direction_progress v ON v.id=r.progress_id AND v.auth_user_id=actor
  JOIN public.learning_vocabulary_cards c ON c.id=v.card_id
  JOIN public.learning_units u ON u.id=c.unit_id
  WHERE r.auth_user_id=actor
  UNION ALL
  SELECT u.level,'vocabulary',v.last_answered_at,u.label,NULL
  FROM public.vocabulary_direction_progress v
  JOIN public.learning_vocabulary_cards c ON c.id=v.card_id
  JOIN public.learning_units u ON u.id=c.unit_id
  WHERE v.auth_user_id=actor AND v.last_answered_at IS NOT NULL
  UNION ALL
  SELECT u.level,'exercises',coalesce(p.updated_at,p.created_at),u.label,e.topic
  FROM public.user_exercise_progress p
  JOIN public.learning_exercises e ON e.id=p.exercise_id
  JOIN public.learning_units u ON u.id=e.unit_id
  WHERE p.auth_user_id=actor AND (coalesce(p.attempts,0)>0 OR coalesce(p.completed,false))
  UNION ALL
  SELECT s.level,'pronunciation',s.created_at,u.label,NULL
  FROM public.submissions s
  LEFT JOIN public.learning_reading_texts t ON t.id=s.prompt_id
  LEFT JOIN public.learning_units u ON u.id=t.unit_id
  WHERE s.auth_user_id=actor AND s.created_at IS NOT NULL
 ), latest AS (
  -- Je Niveau die jüngste Handlung; bei Gleichstand entscheidet der Modus stabil.
  SELECT DISTINCT ON (a.level) a.level,a.mode,a.at,a.unit_label,a.topic,al.sort_order
  FROM activity a JOIN allowed al ON al.level=a.level
  WHERE a.at IS NOT NULL
  ORDER BY a.level,a.at DESC,a.mode
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('level',l.level,'mode',l.mode,'at',l.at,
   'unit_label',l.unit_label,'topic',l.topic) ORDER BY l.at DESC,l.sort_order),'[]'::jsonb)
 INTO recent FROM latest l;

 IF jsonb_array_length(recent)>0 THEN
  RETURN jsonb_build_object('level',recent->0->>'level','mode',recent->0->>'mode',
   'source','activity','levels',recent);
 END IF;

 SELECT l.code INTO fallback_level FROM public.learning_levels l
 WHERE l.is_active AND (staff OR EXISTS(SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=actor AND a.level=l.code))
  AND (EXISTS(SELECT 1 FROM public.vocabulary_direction_progress v
    JOIN public.learning_vocabulary_cards c ON c.id=v.card_id
    JOIN public.learning_units u ON u.id=c.unit_id
    WHERE v.auth_user_id=actor AND u.level=l.code)
   OR EXISTS(SELECT 1 FROM public.user_exercise_progress p
    JOIN public.learning_exercises e ON e.id=p.exercise_id
    JOIN public.learning_units u ON u.id=e.unit_id
    WHERE p.auth_user_id=actor AND u.level=l.code))
 ORDER BY l.sort_order,l.code LIMIT 1;
 IF fallback_level IS NOT NULL THEN
  fallback_source:='started';
 ELSE
  SELECT l.code INTO fallback_level FROM public.learning_levels l
  WHERE l.is_active AND (staff OR EXISTS(SELECT 1 FROM public.student_level_access a WHERE a.auth_user_id=actor AND a.level=l.code))
  ORDER BY l.sort_order,l.code LIMIT 1;
  fallback_source:=CASE WHEN fallback_level IS NULL THEN 'none' ELSE 'unlocked' END;
 END IF;
 RETURN jsonb_build_object('level',fallback_level,'mode',NULL,'source',fallback_source,'levels','[]'::jsonb);
EXCEPTION WHEN OTHERS THEN
 GET STACKED DIAGNOSTICS boundary_state=RETURNED_SQLSTATE;
 RETURN jsonb_build_object('error','request_failed','message','The request could not be completed.','sqlstate',boundary_state);
END
$function$;

REVOKE ALL ON FUNCTION public.get_last_active_level() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_last_active_level() TO authenticated, service_role;

-- Regression guards (R10, maschinenlesbar).
DO $migration$
BEGIN
 IF NOT has_function_privilege('authenticated','public.get_last_active_level()','EXECUTE')
  OR has_function_privilege('anon','public.get_last_active_level()','EXECUTE') THEN
  RAISE EXCEPTION 'last_active_level_grant_wrong' USING ERRCODE='42501';
 END IF;
 IF NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.get_last_active_level()'::regprocedure) THEN
  RAISE EXCEPTION 'last_active_level_not_definer' USING ERRCODE='42501';
 END IF;
END $migration$;

-- ROLLBACK (R9): supabase/vps/rollback/32_last_active_level.sql. Der Client
-- fällt ohne diese Funktion auf das erste freigeschaltete Niveau und den
-- Browser-Speicher zurück; vorher muss keine andere App-Version laufen.
