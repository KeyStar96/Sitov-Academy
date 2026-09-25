> **Lies `00_CODEX-4-RULES.md` und diese Datei. Führe ausschließlich Phase 3 aus.**

## PHASE 3 — LERNPFAD: TECHNIK

**Ziel:** Das Gerüst für den Lernpfad steht, getestet, mit Karte, Bewertung in PostgreSQL und Pflege im CMS. Die Inhalte schreibt Phase 4.

Befund: Grammatik läuft über `learning_units` (`trainer` = `exercises`), `learning_exercises`, `user_exercise_progress`, `grammar_private.record_attempt` und `public.grammar_translations(exercise_id, locale, hint, smart_hint, explanation, prompt)`. Bewertbar sind nur `fill_in_blank` und `multiple_choice`; das Enum `public.exercise_type` kennt zusätzlich `sentence_building`. Freigaben laufen über `learning_trainer_grants`, `learning_unit_grants` und `learning_private.unit_allowed`. Deutsche Aufgabenfelder sind durch einen Sprachschutz (Migration 07) gegen kyrillische und türkische Zeichen geschützt. `learning_exercises.content` muss laut 2.6 `accepted_answers` enthalten. Der Seed `grammar-curriculum-2026.json` hat 600 Aufgaben in 10 Lektionen je Niveau, die nicht zu den Buchlektionen passen.

#### 3.1 Verbindliche Regeln des Lernpfads
* **Aufbau:** Ein Niveau hat einen Lernpfad aus Pfaden, einen pro Buchlektion. Ein Pfad besteht aus Übungsknoten, einem Wiederholungsknoten und einem Testknoten. Spezial-Zweige hängen optional an einem Knoten.
* **Freischaltung:**
  * Pfad 1 ist verfügbar, sobald die Lehrkraft den Trainer bzw. das Niveau freigeschaltet hat (bestehende Freigaben, `unit_allowed` bleibt wirksam).
  * Ein Pfad (eine Lektion) gilt als **abgeschlossen**, sobald sein Abschlusstest mit mindestens **80 %** bestanden ist. Dann wird der nächste Pfad frei: Pfad 1 → Pfad 2 → … → Pfad 7, bis der ganze Lernpfad des Niveaus abgeschlossen ist. Die Lehrkraft kann einen Pfad zusätzlich von Hand freischalten.
  * Innerhalb eines Pfads werden die Knoten der Reihe nach frei. Der Test wird frei, wenn alle Übungs- und Wiederholungsknoten geschafft sind.
  * Spezial-Zweige blockieren nie etwas.
* **Übungsknoten:** Jeder beginnt mit einer **Merkkarte**: die Regel in der Oberflächensprache, deutsche Beispiele, Farbcode (zum Beispiel Artikel oder Verbposition). Falsch beantwortete Aufgaben kommen am Ende des Knotens noch einmal. Ein Knoten ist geschafft, wenn jede Aufgabe einmal richtig beantwortet wurde. Sterne: 3 bei mindestens 90 % richtig im ersten Versuch, 2 ab 70 %, sonst 1. Wiederholen darf man jederzeit; es zählt der beste Stern-Wert.
* **Test:**
  * Bestanden ab **80 %**.
  * Kein Zeitlimit, keine Merkkarten, keine Hinweise, keine Lösungen während des Tests.
  * Wiederholung sofort möglich, jedes Mal mit einer anderen Auswahl aus dem Aufgabenpool. Der Pool ist mindestens doppelt so groß wie der Test, und jedes Lernziel des Pfads kommt in jeder Auswahl vor.
  * Nach dem Test: Ergebnis, jede Aufgabe mit eigener Antwort und Lösung, Empfehlung, welche Knoten man wiederholen sollte.
  * Bestanden: Feier (D5 Nr. 8), die nächste Insel öffnet sich mit Animation.
* **Bewertung:** Für alle Schreibanteile gilt der `grade_answer`-Vertrag aus Phase 1. `SOFT_ERROR` zählt als richtig.
* **Niveau geschafft:** Sind alle Pfade eines Niveaus abgeschlossen, feiert die App das.
  * Niveaus schaltet ausschließlich die Lehrkraft frei, weil sie künftig einzeln bezahlt werden. Sie kann mehrere oder alle gebuchten Niveaus **im Voraus** freischalten (`set_student_level_access` nimmt schon heute eine Liste). Daran ändert der Lernpfad nichts: Er schaltet nie ein Niveau frei.
  * Ist das nächste Niveau freigeschaltet, zeigt die Feier den Knopf „Weiter mit A1.2“. Ist es nicht freigeschaltet, steht dort nur neutral: „A1.2 ist für dich noch nicht freigeschaltet.“
  * **Die Lehrkraft bekommt keine Benachrichtigung**, wenn jemand ein Niveau abschließt: keine Mail, kein Hinweis, kein Zähler. Sie sieht den Stand nur, wenn sie die Schülerseite öffnet (Phase 7).

#### 3.2 Aufgabentypen
Alle Typen werden in PostgreSQL bewertet (R5). Für jeden Typ legst du ein JSON-Schema für `content` fest, als Zod-Schema in `lib/` und als SQL-Prüfung, und passt den Constraint aus 2.6 so an, dass er je Typ die richtigen Pflichtfelder verlangt.

| Typ | Was die Person tut | Bewertung |
|---|---|---|
| `multiple_choice` | eine Antwort antippen | Index |
| `fill_in_blank` | eine Lücke schreiben | `grade_answer` gegen `accepted_answers` |
| `multi_blank` | mehrere Lücken, auch Formular oder Visitenkarte | jede Lücke einzeln, alle richtig = richtig |
| `sentence_building` | Wortkacheln **antippen** in die richtige Reihenfolge | zusammengesetzter Satz gegen `accepted_answers` (mehrere Reihenfolgen erlaubt) |
| `matching` | Paare verbinden durch zweimaliges Antippen | alle Paare richtig |
| `categorize` | Karten Gruppen zuordnen (zum Beispiel der/das/die) | alle Zuordnungen richtig |
| `dialogue` | in einem kurzen Gespräch die passende Replik wählen oder schreiben | je Replik |
| `listening` | Satz anhören (Piper-TTS, auch langsam), dann Auswahl oder Lücke | wie der innere Typ |
| `transform` | einen Satz umformen (Aussage → Frage, Präsens → Perfekt …) | `grade_answer` |

* [ ] Enum-Erweiterung von `public.exercise_type` in einer **eigenen, vorgeschalteten Migration**.
* [ ] Für `listening` erzeugt ein Skript die Audiodateien vorab mit dem lokalen Piper-TTS (normal und langsam) und legt sie im Storage ab. Keine Erzeugung zur Laufzeit beim Lernen.
* [ ] Die Oberfläche jedes Typs ist mit Tastatur und Screenreader bedienbar; Ziehen ist nirgends nötig (R13).
* [ ] Schreibaufgaben tragen das optionale Kennzeichen `needs_article`; ist es gesetzt, zeigt die Aufgabe den Artikel-Chip aus Phase 1.3.

#### 3.3 Datenmodell
Vorgaben (Namen und Details darfst du verbessern, die Struktur nicht):
* Ein Pfad ist eine `learning_units`-Zeile mit `trainer` = `exercises`, ein Pfad je Lektion, sortiert über `sort_order`. So bleiben Freigaben und `unit_allowed` wirksam. Ein Kennzeichen unterscheidet Pfad-Units von den alten Grammatik-Units.
* Neue Tabelle für **Knoten**: Unit, Art (Enum `practice` | `review` | `test` | `special`), Reihenfolge, Titel, Merkkarte (deutsche Beispiele), Ankerknoten für Spezial-Zweige, Testgröße (nur bei `test`), aktiv, Zeitstempel, `created_by`.
* Übersetzte Texte der Merkkarten und Knotentitel in einer eigenen Übersetzungstabelle je `locale`, weil der Sprachschutz aus Migration 07 deutsche Felder schützt.
* `learning_exercises` bekommt einen Fremdschlüssel auf den Knoten. Testaufgaben gehören zum Testknoten und bilden den Pool.
* Neue Tabelle für **Knotenfortschritt** je Person: Status, beste Sterne, Trefferquote im ersten Versuch, Zeitstempel.
* Neue Tabellen für **Testversuche** und deren **einzelne Antworten** (gezogene Aufgaben, Antwort, Ergebnis, Zeit, Prozentwert, bestanden). Die Lehrkraft sieht sie in Phase 7.
* Neue Tabelle für **manuelle Eingriffe** der Lehrkraft (freischalten, zurücksetzen) mit `created_by` und Zeit.
* RLS auf allen neuen Tabellen: Lernende lesen nur Eigenes, Lehrkraft und Admin lesen alles. Geschrieben wird nur über RPCs.
* Die alten 10 Grammatik-Units **aller** Niveaus werden archiviert (`is_active = false`), nicht gelöscht (R9). Ihre Aufgaben sind ohnehin `incomplete` und für Lernende unsichtbar; Fortschrittsdaten bleiben.
* `reset_student_level_progress` und `lib/learning-reset-events.ts` beziehen alle neuen Tabellen ein.

#### 3.4 RPCs (alle R5, R10, `SECURITY DEFINER`, `search_path ''`)
* [ ] Karte lesen: alle Pfade, Knoten, Zustände, Sterne und Testergebnisse eines Niveaus für die aufrufende Person.
* [ ] Knoten starten: Aufgaben **ohne Lösungen**.
* [ ] Antwort im Knoten einreichen: Bewertung, Lösung und Erklärung erst jetzt, Fortschritt aktualisiert.
* [ ] Test starten: neuer Versuch, zufällige Auswahl nach den Regeln aus 3.1, ohne Lösungen.
* [ ] Testantwort einreichen: speichert, gibt **kein** Richtig/Falsch zurück.
* [ ] Test abschließen: Prozentwert, bestanden, Auswertung mit Lösungen, Freischaltung des nächsten Pfads.
* [ ] Lehrkraft: Pfad freischalten, Pfad oder Test zurücksetzen (Prüfung über `business_private.is_staff()`).
* [ ] DB-Tests für jede RPC, darunter: keine Lösung vor der Antwort, Test nicht vor Abschluss aller Knoten, Pfad 2 gesperrt bis Test 1 bestanden, knapp unter 80 % nicht bestanden und genau 80 % bestanden (zum Beispiel 11 und 12 von 15), zwei Testversuche mit unterschiedlicher Auswahl, jedes Lernziel in jeder Auswahl, fremde Person kann nichts lesen, Zurücksetzen löscht alles Pfad-bezogene.

#### 3.5 Oberfläche
* [ ] Neue Route `app/[lang]/dashboard/level/[level]/path/` mit der Karte nach D9, Unterseiten für Knoten und Test. Die alte Route `/exercises` leitet dauerhaft nach `/path` weiter. Der interne Trainer-Code bleibt `exercises`, die Oberfläche sagt „Lernpfad“.
* [ ] Das Modus-Dock zeigt ab jetzt auf `/path` (eine Stelle, siehe Phase 2).
* [ ] Knotenansicht: Merkkarte, dann Aufgaben einzeln, großer Knopf „Prüfen“ rechts bzw. unten, Rückmeldung nach D11, Fortschrittsbalken oben, jederzeit „Pause“ mit Rückkehr an dieselbe Stelle.
* [ ] Testansicht: ruhiger, ohne Hinweise, mit Fortschritt „Aufgabe 5 von 14“, am Ende die Auswertung.
* [ ] Niveaus ohne Pfad-Inhalte (bis auf Weiteres alle außer A1.1) zeigen einen freundlichen Leerzustand: „Deine Lehrerin bereitet diesen Lernpfad gerade vor.“
* [ ] Spezial-Zweige werden dargestellt, wenn es sie gibt. Getestet wird das mit einer Test-Fixture. Im echten Inhalt gibt es in diesem Auftrag noch keine.
* [ ] Brotkrumen für die neuen Routen ergänzen.

#### 3.6 Pflege im CMS
* [ ] `components/admin/ExerciseCMS.tsx` wird zum Pfad-Editor: Pfade und Knoten anlegen, sortieren, (de)aktivieren; Merkkarte und Übersetzungen pflegen; Aufgaben aller Typen mit Vorschau so, wie Lernende sie sehen; Zod-Prüfung je Typ.
* [ ] Import und Export eines Pfads als JSON im Format des Seeds aus Phase 4.
* [ ] Das Anlegen von Spezial-Zweigen durch die Lehrerin ist **nicht** Teil dieses Auftrags. Es reicht, dass Datenmodell, RPC und Darstellung sie tragen.

**Abnahme Phase 3:** DB-Tests für alle RPCs grün; Jest für alle Aufgabentypen und Zod-Schemas; Playwright: Knoten mit einer falschen Antwort durchspielen, Test knapp unter 80 % und dann mit genau 80 % (Fixture, zum Beispiel 11 und 12 von 15), Pfad 2 öffnet sich; axe ohne Filter auf Karte, Knoten und Test; Migrationen im Klon zweimal ausgeführt; Rückweg im Klon erprobt.

**Übergabe:** Datenmodell mit allen Tabellen- und Spaltennamen, JSON-Format des Seeds je Aufgabentyp und Name des Import-Befehls in `STATUS.md`.

---