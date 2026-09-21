-- Rollback for supabase/vps/20_vocabulary_learner_mode.sql.
-- Run atomically on the VPS with psql -1 after a fresh backup.
--
-- Stellt das Fach-Band aus 18_vocabulary_self_rating.sql wieder her: Nur die
-- beiden untersten Faecher duerfen sich selbst einschaetzen, ab Phase 3 muss
-- wieder getippt werden.
--
-- REIHENFOLGE: Zuerst einen Client ausrollen, der den Umschalter oberhalb von
-- Phase 2 nicht mehr anbietet (lib/leitner.ts:vocabularyReviewMode), erst
-- danach diese Datei. Andernfalls laeuft jede Selbsteinschaetzung ab Phase 3
-- wieder in 'flashcard_not_allowed' -> 'save_failed', und der Trainer meldet
-- dem Lernenden bei jedem Klick, sein Lernstand sei nicht gespeichert worden.
--
-- Bereits gespeicherte Lernstaende bleiben unberuehrt: Diese Datei aendert nur
-- eine Regel, keine Daten. Wer eine Karte in Phase 4 per Karteikarte bewertet
-- hat, behaelt den daraus gefolgten Termin.
CREATE OR REPLACE FUNCTION vocabulary_private.self_rating_allowed(p_box integer, p_sentence boolean)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
 SELECT NOT p_sentence AND least(6,greatest(1,coalesce(p_box,1))) <= 2
$$;
REVOKE ALL ON FUNCTION vocabulary_private.self_rating_allowed(integer,boolean) FROM PUBLIC;
