-- Phase 5.13. Backup with migrate-local.py before applying. migrate-local wraps
-- regular files in one transaction; every statement here is idempotent.
-- Rollback: supabase/vps/rollback/25_vocabulary_lesson_switch.sql.
--
-- Lektionen im Lernweg ein- und ausschalten.
--
--   * Eingeschaltet ist eine Lektion, sobald sie Lernstand hat (Einstufung
--     oder „alle Wörter in Phase 1") — so wie bisher. Neu ist nur das
--     Ausschalten: vocabulary_lesson_pauses merkt sich je Person, welche
--     Lektionen gerade NICHT in der Lernbox liegen. Ihre Karten kommen dann
--     weder in die Übungsrunde noch in die Fächer und Fällig-Zahlen.
--   * Ausschalten löscht nichts. Lernstand und Fälligkeiten bleiben stehen;
--     wird die Lektion wieder eingeschaltet, ist alles wie vorher (inzwischen
--     Fälliges ist dann fällig).
--   * Das ist eine Auswahl, kein Lernfortschritt (R5 bleibt unberührt): Keine
--     Bewertungs-RPC liest die Tabelle. Geschrieben wird nur über
--     set_vocabulary_lesson_paused, gelesen per RLS nur die eigenen Zeilen.
--   * Zurücksetzen des Lernstands lässt eine Pause stehen — harmlos, denn
--     jedes erneute Einschalten hebt sie auf.

CREATE TABLE IF NOT EXISTS public.vocabulary_lesson_pauses(
 auth_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 unit_id uuid NOT NULL REFERENCES public.learning_units(id) ON DELETE CASCADE,
 paused_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(auth_user_id,unit_id));
-- Für das Kaskadenlöschen einer Unit (der Primärschlüssel beginnt mit der Person).
CREATE INDEX IF NOT EXISTS vocabulary_lesson_pauses_unit_idx ON public.vocabulary_lesson_pauses(unit_id);

ALTER TABLE public.vocabulary_lesson_pauses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vocabulary_lesson_pauses_read ON public.vocabulary_lesson_pauses;
CREATE POLICY vocabulary_lesson_pauses_read ON public.vocabulary_lesson_pauses
 FOR SELECT TO authenticated USING(auth_user_id=(SELECT auth.uid()));
REVOKE ALL ON public.vocabulary_lesson_pauses FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vocabulary_lesson_pauses TO authenticated;
GRANT ALL ON public.vocabulary_lesson_pauses TO service_role;

-- Schaltet eine Lektion für die aufrufende Person aus (p_paused=true) oder
-- wieder ein. Ausschalten verlangt Zugriff auf die Lektion; Einschalten
-- entfernt nur die eigene Pause und geht deshalb immer. Fehler kommen als
-- JSONB mit Code zurück (R10), nie als Ausnahme.
CREATE OR REPLACE FUNCTION public.set_vocabulary_lesson_paused(p_unit_id uuid, p_paused boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE actor uuid:=(SELECT auth.uid());
BEGIN
 IF actor IS NULL THEN
  RETURN jsonb_build_object('error','authentication_required','message','Sign in to change your learning box.');
 END IF;
 IF p_unit_id IS NULL OR p_paused IS NULL THEN
  RETURN jsonb_build_object('error','invalid_input','message','The request contains invalid data.');
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.learning_units u WHERE u.id=p_unit_id AND u.trainer='vocabulary') THEN
  RETURN jsonb_build_object('error','not_found','message','This lesson does not exist.');
 END IF;
 IF p_paused THEN
  IF NOT learning_private.unit_allowed(p_unit_id) THEN
   RETURN jsonb_build_object('error','trainer_access_denied','message','This lesson is not available to you.');
  END IF;
  INSERT INTO public.vocabulary_lesson_pauses(auth_user_id,unit_id) VALUES(actor,p_unit_id)
  ON CONFLICT DO NOTHING;
 ELSE
  DELETE FROM public.vocabulary_lesson_pauses WHERE auth_user_id=actor AND unit_id=p_unit_id;
 END IF;
 RETURN jsonb_build_object('unitId',p_unit_id,'paused',p_paused);
END $$;
REVOKE ALL ON FUNCTION public.set_vocabulary_lesson_paused(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_vocabulary_lesson_paused(uuid,boolean) TO authenticated, service_role;

-- Regression guards (R10, maschinenlesbar).
DO $migration$
BEGIN
 IF has_table_privilege('authenticated','public.vocabulary_lesson_pauses','INSERT')
  OR has_table_privilege('authenticated','public.vocabulary_lesson_pauses','UPDATE')
  OR has_table_privilege('authenticated','public.vocabulary_lesson_pauses','DELETE')
  OR has_table_privilege('anon','public.vocabulary_lesson_pauses','SELECT') THEN
  RAISE EXCEPTION 'lesson_pauses_writable' USING ERRCODE='42501';
 END IF;
 IF NOT has_function_privilege('authenticated','public.set_vocabulary_lesson_paused(uuid,boolean)','EXECUTE')
  OR has_function_privilege('anon','public.set_vocabulary_lesson_paused(uuid,boolean)','EXECUTE') THEN
  RAISE EXCEPTION 'lesson_pause_grant_wrong' USING ERRCODE='42501';
 END IF;
END $migration$;

-- ROLLBACK (R9): supabase/vps/rollback/25_vocabulary_lesson_switch.sql. Die
-- App liest die Tabelle fehlertolerant; ohne sie gilt jede begonnene Lektion
-- als eingeschaltet.
