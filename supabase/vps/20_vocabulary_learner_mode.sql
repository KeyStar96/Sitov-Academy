-- Phase 5.8. Backup with migrate-local.py before applying. migrate-local wraps
-- regular files in one transaction; every statement here is idempotent.
-- Rollback: supabase/vps/rollback/20_vocabulary_learner_mode.sql.
--
-- Der Abfragemodus wird zur Wahl des Lernenden statt zur Folge seines
-- Lernstands.
--
-- 18_vocabulary_self_rating.sql band den Karteikarten-Modus an die beiden
-- untersten Fächer: ab Phase 3 erzwang die Datenbank das Ausschreiben. Die
-- Lern-UI bekommt jetzt einen Umschalter, und das Ausschreiben gilt
-- ausschließlich der Richtung „eigene Sprache -> Deutsch":
--
--   * Satz                        -> immer getippt (unveraendert)
--   * Deutsch -> eigene Sprache   -> immer Karteikarte
--   * eigene Sprache -> Deutsch   -> der Lernende waehlt
--
-- Damit muss die Selbsteinschaetzung in jedem Fach erlaubt sein, sonst
-- antwortet die RPC ab Phase 3 mit 'flashcard_not_allowed' und der Umschalter
-- ist eine Luege.
--
-- R5 bleibt unberuehrt. Der Client waehlt weiterhin nur den WEG, nie das
-- ERGEBNIS: Der getippte Pfad vergleicht in PostgreSQL gegen den gespeicherten
-- Inhalt, der Karteikarten-Pfad nimmt die Selbsteinschaetzung als EINGABE und
-- leitet Fach, Intervall und naechsten Termin weiterhin selbst ab. Die beiden
-- verbleibenden Wege sind fuer jede Wort-Karte fachlich gleichwertig; ein
-- manipulierter Client gewinnt dadurch nichts, was er nicht schon mit einem
-- "Kenn ich" in Phase 1 haette.
--
-- Was ein Satz ist, bleibt unverhandelbar: p_sentence wird unveraendert aus
-- card.sentence_practice AND progress.direction='native_to_de' abgeleitet und
-- schliesst die Selbsteinschaetzung weiterhin aus.

-- Signatur bleibt exakt gleich (integer, boolean), damit CREATE OR REPLACE
-- greift und weder DROP noch erneute GRANTs noetig sind. p_box wird bewusst
-- nicht mehr ausgewertet: Der Parameter bleibt erhalten, weil der Aufrufer in
-- vocabulary_private.submit_self_rating unveraendert bleiben soll und die
-- Regel spaeter wieder an das Fach gebunden werden koennte.
CREATE OR REPLACE FUNCTION vocabulary_private.self_rating_allowed(p_box integer, p_sentence boolean)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
 SELECT NOT coalesce(p_sentence,false)
$$;
REVOKE ALL ON FUNCTION vocabulary_private.self_rating_allowed(integer,boolean) FROM PUBLIC;

-- Regression guard: ein Wort muss in jedem Fach selbst einschaetzbar sein, ein
-- Satz in keinem. Faellt die Migration hier, ist der Umschalter in der UI nicht
-- gedeckt und der Trainer wuerde live mit 'flashcard_not_allowed' abbrechen.
-- R10 -- der Fehler traegt einen maschinenlesbaren Code.
DO $migration$
DECLARE box integer;
BEGIN
 FOR box IN 1..7 LOOP
  IF NOT vocabulary_private.self_rating_allowed(box,false) THEN
   RAISE EXCEPTION 'self_rating_band_too_narrow'
    USING ERRCODE='23514', DETAIL=format('box %s rejects the flashcard mode the UI offers',box);
  END IF;
 END LOOP;
 IF vocabulary_private.self_rating_allowed(1,true) THEN
  RAISE EXCEPTION 'self_rating_accepts_sentences'
   USING ERRCODE='23514', DETAIL='a sentence must always be typed, never self-rated';
 END IF;
END $migration$;

-- ROLLBACK (R9): supabase/vps/rollback/20_vocabulary_learner_mode.sql stellt das
-- Fach-Band aus Migration 18 wieder her. Vorher einen Client ausrollen, der den
-- Umschalter ab Phase 3 nicht mehr anbietet -- sonst laeuft jede
-- Selbsteinschaetzung oberhalb von Phase 2 wieder in 'flashcard_not_allowed'.
