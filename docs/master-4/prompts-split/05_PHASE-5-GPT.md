> **Lies `00_CODEX-4-RULES.md` und diese Datei. Führe ausschließlich Phase 5 aus.**

## PHASE 5 — WÖRTER MITNEHMEN

**Ziel:** Wer in ein neues Niveau wechselt, lernt offene Wörter früherer Niveaus dort weiter, im selben Fach, ohne zurückzuspringen.

Befund: Die Lernbox gilt pro Niveau. Der Lernstand liegt in `vocabulary_direction_progress` (`box_number` 1–7, gelernt heißt beide Richtungen auf 7). Das Fach eines Wortes ist die schwächere Richtung (`lib/vocabulary-box.ts`). Pausen stehen in `vocabulary_lesson_pauses` (Migration 25). „Eigene Wörter“ sind eine private Unit (Migration 23), die Lehrkräfte nicht sehen. Die Stationen zeigt `LevelPath.tsx` (ab Phase 2 „Lektionen“), die Zahlen kommen aus `getVocabularyOverview`.

#### 5.1 Verbindliche Regeln
* **Es wird nichts kopiert.** Eine mitgenommene Karte behält ihre Zeilen in `vocabulary_direction_progress`, ihr Fach und ihren Termin. Lernt man sie in A1.2, ändert sich derselbe Lernstand, und A1.1 zeigt ihn ebenfalls.
* **Mitgenommen werden offene Wörter** aller früheren Niveaus (niedrigere `sort_order`), einschließlich offener eigener Wörter. Nie begonnene Wörter bleiben im alten Niveau. Wörter aus pausierten Lektionen bleiben pausiert.
* **Ein Schalter pro Person und Zielniveau.** Ist er an, erscheinen die offenen Wörter in Lernbox, Fälligkeiten und Lernsitzung des Zielniveaus, jeweils im richtigen Fach. Ist er aus, verschwinden sie dort wieder, ohne Verlust.
* **Die Station** „Aus früheren Niveaus“ steht in den Lektionen neben „Eigene Wörter“, mit Schalter, Anzahl und Mini-Verteilung auf die Fächer, aufgeschlüsselt nach Herkunftsniveau.
* **Einmalige Frage:** Beginnt jemand zum ersten Mal, in einem Niveau Vokabeln zu lernen (erste Lernrunde oder erstes Einstufen dort), und hat offene Wörter in früheren Niveaus, fragt die App einmal: „23 offene Wörter aus A1.1 mitnehmen?“ mit „Nein, danke“ links und „Mitnehmen“ rechts (R15). Die Antwort wird gespeichert, der Schalter bleibt jederzeit änderbar.
* **Zugriff:** Eine mitgenommene Karte darf beantwortet werden, wenn die Person das Zielniveau freigeschaltet hat, der Schalter an ist und für diese Karte bereits eigener Lernstand existiert. Das prüft PostgreSQL.
* **Zurücksetzen:** Setzt die Lehrkraft das Zielniveau zurück, wird dessen Schalter gelöscht, der Lernstand der Herkunftsniveaus bleibt. Setzt sie ein Herkunftsniveau zurück, verschwinden dessen Karten auch aus der Mitnahme.
* **Kein Doppelzählen:** Der Fortschritt eines Niveaus („x % gelernt“) zählt nur seine eigenen Wörter. Mitgenommene Wörter erscheinen getrennt ausgewiesen.

#### 5.2 Aufgaben
* [ ] Migration: Tabelle für den Schalter (Person, Zielniveau, an/aus, Zeitpunkt der Entscheidung), RLS, RPC zum Setzen und Lesen.
* [ ] `submit_answer`, `submit_self_rating`, `check_retry` und die Zugriffsprüfung (`unit_allowed` bzw. die dort genutzte Logik) erlauben mitgenommene Karten nach 5.1. Körper aus der letzten Definition kopieren.
* [ ] `getVocabularyOverview`, Fälligkeitsabfrage und Sitzungs-Warteschlange berücksichtigen mitgenommene Karten. Die Lernbox-Übersicht zeigt sie mit kleinem Herkunfts-Etikett („A1.1“).
* [ ] Station, Schalter und einmalige Frage in der Oberfläche, fünf Sprachen.
* [ ] `reset_student_level_progress` und `lib/learning-reset-events.ts` nach 5.1.
* [ ] DB-Tests: Fach bleibt erhalten; Antwort in A1.2 ändert denselben Lernstand; Schalter aus → Karte in A1.2 nicht mehr fällig und nicht beantwortbar; nie begonnene und pausierte Wörter werden nicht mitgenommen; fremde Karten nicht beantwortbar; Zurücksetzen beider Richtungen; Fortschritt von A1.2 zählt mitgenommene Wörter nicht.
* [ ] Playwright: A1.1 teilweise gelernt, A1.2 öffnen, Frage beantworten, mitgenommene Karte im richtigen Fach lernen.

**Abnahme Phase 5:** Alle Tests grün, Migration im Klon doppelt ausgeführt, produktiv aktiviert.

**Übergabe:** Tabellen- und RPC-Namen in `STATUS.md` (Phase 7 zeigt die Mitnahme im Dashboard).

---