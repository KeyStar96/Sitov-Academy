# Phase 0 — lokales Code-Inventar

Stand: 25.09.2026. Ergänzung zum [Prüfbericht](PRUEFBERICHT.md). Grundlage: Abschnitt 3 des [Zwischenberichts](ZWISCHENBERICHT.md), vollständig gelesene [Grundregeln](prompts-split/00_CODEX-4-RULES.md) und [Phase 0](prompts-split/00_PHASE-0-GPT.md). Die folgenden Zeilen beziehen sich auf den lokalen Quelltext vor Änderungen an Anwendung oder Datenbank. Zeilenangaben sind Nachweise dieses Stands. Produktionszahlen, produktive Spalten und Release-Nachweis stehen im Prüfbericht; der historische SQL-Dump wird ausdrücklich nicht mit dem aktuellen Live-Katalog gleichgesetzt.

## Abweichungen mit Auswirkung auf Folgephasen

1. **Lösungen verlassen den Server vor der Antwort:** Bei darstellbaren Lückentexten enthält der an `ExerciseClient` übergebene Inhalt `correct_answer` und `accepted_answers`; Multiple Choice enthält `correct_answer`. Die Bewertung selbst erfolgt bereits serverseitig. `incomplete`-Aufgaben werden vor der Übergabe ausgeschlossen. Das ist eine nachgewiesene Eigenschaft des Datenpfads, keine Behauptung, dass gegenwärtig ausgeblendete Produktionsaufgaben im Browser sichtbar seien. **Phase 3 / R5** muss den Lesevertrag ändern.
2. **Die im Zwischenbericht genannten letzten Funktionsdefinitionen sind teilweise veraltet:** `submit_self_rating` stammt zuletzt aus Migration **23**; der Name `check_retry` existiert so nicht, richtig ist `check_retry_answer` aus **22**. `record_attempt` hat den Vollkörper in **06**, erhält aber in **07** einen nachträglichen Bereitschafts-Guard. Die Lehrkraft-RPC mit zwei Parametern stammt zuletzt aus **23**, nicht **11**. **Phasen 1, 3, 5, 7** dürfen diese Änderungen nicht überschreiben.
3. **`schema.sql` ist nachweislich älter als die Migrationen und Typen:** Insbesondere fehlen `learning_units.owner_auth_user_id`, `learning_activity_days`, `vocabulary_lesson_pauses` und die jüngsten Mail-Arten im Dump. `database.types.ts` enthält diese öffentlichen Erweiterungen. **Alle späteren DB-Phasen / R7** müssen aktuelle Definitionen aus Migrationen und Live-Katalog verwenden.
4. **Der generische DB-Testhelfer endet bei 06.** Ein Test mit `createPhase3Database()` bildet ohne zusätzliche Migrationen weder den Inhaltsstatus-Guard aus 07 noch das aktuelle Vokabelverhalten ab. **Phasen 1, 3, 5–7** benötigen explizite aktuelle Testvoraussetzungen.
5. **Historische Rollbacks liegen nicht lückenlos als eigene Dateien vor.** Separate Rückweg-Dateien existieren für 14, 16, 18–25, 27 und 29; bei anderen Migrationen gibt es teilweise Rückweghinweise im SQL statt der heute verlangten Datei. **Künftige DB-Phasen / R9** müssen die neue Regel erfüllen; Phase 0 schreibt keine historischen Migrationen um.
6. **Quellen sind auffindbar:** Der verkürzte Grundregel-Prompt enthält D9–D11 und D13 nicht; die vollständigen Definitionen sowie Anhang B existieren in `MASTER-PROMPT-4.md`. „Constraint aus 2.6“ meint die ältere Normalisierungsphase in `CODEX.md`, nicht die neue Home-Phase 2.6. **Phase 0** verwendet diese ergänzenden Quellen.
7. **Der Zwischenbericht ist bei Produktentscheidungen teilweise überholt:** Die aktuelle Split-Phase 7.4 verbietet die dort vorgeschlagene Einspruchs-Warteschlange ausdrücklich. Split-Phase 6.3 verbietet eine Abschlussbenachrichtigung der Lehrkraft; 6.4 verlangt die Bündelung gleichzeitiger Niveau-Freischaltungen in einer Mail. Die Phasenzuordnungen dieses Inventars sind Übergabehinweise, keine Ausführungserlaubnis. Vor jeder Folgephase ist deren aktueller Prompt maßgeblich.

## Dokumente, Werkzeuge und Ausgangsverträge

| Ort | Erwartet | Gefunden | Delta |
|---|---|---|---|
| `docs/master-4/prompts-split/00_CODEX-4-RULES.md` | Regeln R1–R16, Design, Workflow | Vollständig gelesen; ausdrücklich nur Dokumente in Phase 0 | Keine Anwendungsänderung zulässig |
| `docs/master-4/prompts-split/00_PHASE-0-GPT.md` | Status, Prüfbericht, vollständige Baseline, Richtlinie, Bilder | Vollständig gelesen; 0.1–0.4 plus Commit/Push-Abnahme | Abarbeitung und Grenzen siehe `STATUS.md` |
| `docs/master-4/ZWISCHENBERICHT.md:36` | Abschnitt 3 als Ausgangsbefund | Alle zwölf Befundgruppen geprüft | Korrekturen in diesem Inventar, alte Quelle unverändert |
| `MASTER-PROMPT-4.md:170` | Vollständige D1–D13 | D1–D13 vorhanden, einschließlich Lernpfadkarte, Neu-Zeichen, Antwortfeedback und Verbote | Ergänzende Quelle für Richtlinie, kein Auftrag zu Folgephasen |
| `MASTER-PROMPT-4.md:825` / Anhang B | Status-Vorlage | Vorlage vorhanden | Keine erfundene Ersatzvorlage erforderlich |
| `CODEX.md:206` / ältere Phase 2.6 | Ursprung des JSONB-Constraints | Normalisierung verlangt `accepted_answers`; Umsetzung in 04 | Verweis auf ältere Phase auflösen |
| `AGENTS.md` | Next-Version-Doku beachten | Hinweis auf `node_modules/next/dist/docs/` vorhanden | Keine Framework-Codeänderung in dieser Phase |
| `package.json:33` / Stack | Next 16.3.5, React 19.2.8, Tailwind 3.4, Zod 4, Framer Motion 12 | Next/React exakt gepinnt; übrige Paketbereiche entsprechen den genannten Hauptversionen | Laufende Produktionsversion separat lesen |
| `proxy.ts` | Proxy statt Middleware | Datei vorhanden | Kein Umbau in Phase 0 |
| `deploy/vps/deploy-release.sh:4` | Prepare → Migration → Activate bei Schemaänderung | Flags `--prepare-only`, `--activate`, `--schema-changed`; Schutz gegen unpassenden Rollback | In Phase 0 nicht ausführen |
| `deploy/vps/migrate-local.py:13` / `ORDER` | Registrierte Migrationen bis 29 | 29 Dateinamen; Reihenfolge beginnt 02 → 03 → 01 → 04 und endet 29 | Nächste lokal freie Nummer 30; vor Folgephase erneut prüfen |
| `deploy/vps/migrate-local.py:32` / `backup()` | R8 vor Migration | PostgreSQL-/Storage-Backup, Prüfsummen, Inventarabgleich vorhanden | Keine DB-Mutation, deshalb kein migrationsbedingtes Backup ausgelöst |
| `deploy/vps/migrate-local.py:72` / `--apply` | Nur registrierte Dateien und korrekte Reihenfolge | `choices=ORDER`, Ordnungsprüfung, Produktion verlangt `--keep-stopped` | Keine Änderung |
| `deploy/vps/tests/test_migrate_local.py:106` | Test schützt Registry | Vergleicht nummerierte SQL-Dateien mit `ORDER`; prüft Transaktionsgrenzen | Baseline im Hauptbericht |
| `supabase/vps/29_student_level_access_notification.sql` | Letzte nummerierte Migration | Vorhanden, Trigger für Freischaltungs-Mail | 30 nicht belegt |
| `supabase/vps/[0-9][0-9]*.sql` | Kein eigenes `BEGIN;` / `COMMIT;` | Textsuche findet keine eigenen Transaktionsgrenzen | Keine pauschale Aussage zur Idempotenz jedes Statements; DB-Testbaseline separat |
| `supabase/vps/rollback/` | Zu jeder neuen Migration eigener Rückweg | Dateien für 14, 16, 18, 19, 20, 21, 22, 23, 24, 25, 27, 29 | Historische Dateilücken dokumentiert; R9 künftig vollständig einhalten |
| `supabase/schema.sql:4729` | Dokumentation aktuellen Schemas | `learning_units` ohne Eigentümerspalte; Tabellen 24/25 fehlen | Historischer Dump, keine maßgebliche Quelle späterer Funktionskörper |
| `supabase/database.types.ts:739` | Aktuelle öffentliche Tabellen-/RPC-Typen | Eigentümer, Lerntage, Pausen und jüngste Mail-Arten vorhanden | Deutlich neuer als Dump; kein Typ für vorgeschlagenen Mail-Schalter |
| `supabase/tests/helpers/phase3-db.mjs:7` / `createPhase3Database()` | Testbasis entspricht aktuellem Anwendungsstand | Zeile 21 spielt 02/03/01/04/05 ein, Zeile 23 standardmäßig nur 06 | Weitere Migrationen vom einzelnen Test nötig |
| `supabase/tests/*.test.mjs` | Vollständiger DB-Testlauf | Node-Testdateien vorhanden, `node --test supabase/tests/*.test.mjs` | Zahlen und Ursachen in `STATUS.md` |
| `supabase/tests/soft-errors.test.mjs` | Bewertungsvertrag abgedeckt | Datei vorhanden, nutzt Phase-3-Helfer | Änderungen später mit korrekter Migrationserweiterung prüfen |
| `supabase/tests/vocabulary-learning.test.mjs` | Vokabel-Lernverhalten abgedeckt | Datei vorhanden | Baseline nicht als Beleg bereits umgesetzter Phase-1-Regeln missverstehen |
| `e2e/accessibility.spec.ts:4` | Axe ohne Regel-/Knotenfilter | Home `/de`, Registration, Cancellation × hell/dunkel; vollständiges `violations`-Array | Sechs öffentliche Seitenzustände, keine Prüfung aller Lernenden-Seiten |
| `playwright.config.ts:36` | Lokaler Browser-Testserver | `npm run dev`, `http://localhost:3000`, Chromium | Keine produktiven Testdaten nötig für diese A11y-Baseline |
| `e2e/helpers/authenticated-session.ts:8` / `authenticateBrowser()` | Reale Session für bestehende Integrationstests | Login mit `@supabase/ssr`, SSR-Cookie-Codec, echte Auth/RLS | Keine Anweisung, produktive Benutzer anzulegen; Screenshots separat dokumentieren |
| `docs/master-4/STATUS.md` | Phase-0-Übergabe nach Anhang B | Bestandteil dieser Dokumentationsphase | Verbindlicher Abschlussstand dort |
| `docs/design/lernraum-designrichtlinie.md` | D1–D13 plus Token-Nachweise und Beispiele | Bestandteil dieser Dokumentationsphase | Vorschläge sind noch keine implementierten Modus-Tokens |
| `docs/master-4/ist/` | Sechs Ansichten × Handy/Desktop, ohne Personendaten | Aufnahmeumfang und Herkunft im Bildverzeichnis dokumentieren | Fehlende Zustände ausdrücklich benennen |
| `/api/health` / aktive VPS-Revision | Laufendes Release nachweisen | Separater lesender Betriebscheck im Prüfbericht | Lokaler Code ist kein Nachweis aktiver Revision |

## Vokabeln, Bewertung und Mitnahme

| Ort | Erwartet | Gefunden | Delta |
|---|---|---|---|
| `components/vocabulary/VocabCardSession.tsx:496` | Positive Aktion rechts/unten | `submitSelfRating(true)` vor `false`, primäre Aktion zuerst | Phase 1: Reihenfolge ändern |
| `app/[lang]/dashboard/level/[level]/vocabulary/assess/LessonAssessmentClient.tsx:153` | Gleiches positives Aktionsmuster | `decide(true)` vor `decide(false)` | Zweite Stelle in Phase 1 berücksichtigen |
| `dictionaries/de.json:1264` / `vocabulary.knew_it`, `didnt_know` | Beschriftungen vorhanden | „Wusste ich“ / „Wusste ich nicht“ | Reihenfolge ist UI-, kein Übersetzungsproblem |
| `dictionaries/en.json:1265` | Gleiche Schlüssel in Englisch | Beide Schlüssel vorhanden | Neue Texte später gleichzeitig pflegen |
| `dictionaries/ru.json:1264` | Gleiche Schlüssel in Russisch | Beide Schlüssel vorhanden | Wie R12 |
| `dictionaries/uk.json:1264` | Gleiche Schlüssel in Ukrainisch | Beide Schlüssel vorhanden | Wie R12 |
| `dictionaries/tr.json:1261` | Gleiche Schlüssel in Türkisch | Beide Schlüssel vorhanden | Wie R12 |
| `learning_private.grade_answer` / `06_soft_errors.sql:45` | EXACT, SOFT_ERROR, INCORRECT | Normalisierung plus Gründe punctuation/capitalization/umlaut/typo; Rechte-Ergänzung in 15 | Phase 1: Interpunktion und Großschreibung künftig EXACT; aktuelle Rechte erhalten |
| `grammar_private.record_attempt` / `06_soft_errors.sql:148` | Bewertung in PostgreSQL | SECURITY DEFINER; nur fill_in_blank/multiple_choice; SOFT_ERROR richtig, Score max. 90 | Phase 1 ändern, Guard aus 07 erhalten |
| `grammar_private.record_attempt` / `07_content_quality.sql:113` | Letzte installierte Definition korrekt ermitteln | `pg_get_functiondef` + Patch fügt `content_status <> 'ready'`-Abweisung ein | Vollkörper allein aus 06 ist nicht ausreichend |
| `vocabulary_private.submit_answer` / `22_vocabulary_phase6_rules.sql:87` | Letzte Vokabel-Schreibbewertung | DB berechnet Richtigkeit; `p_is_correct` nur Altpayload; Soft Error deckelt Intervall auf vorherige Phase | Phase 1 muss volle Intervalle für reine Schreibkonvention ermöglichen |
| `vocabulary_private.submit_self_rating` / `23_vocabulary_own_words.sql:481` | Laut Zwischenbericht zuletzt 22 | Neuester Vollkörper 23 nutzt `card_translation` für eigene Wörter | Quelle für Phase 5 berichtigen |
| `vocabulary_private.check_retry` | Wiederholungsprüfung wie im Prompt | Keine Funktion dieses exakten Namens | Nicht erfinden; real `check_retry_answer` |
| `vocabulary_private.check_retry_answer` / `22_vocabulary_phase6_rules.sql:203` | Reale Wiederholungsfunktion | Vorhanden; zentraler Antwortschlüssel und DB-Bewertung | Später diese Funktion anpassen |
| `components/exercises/SoftErrorBadge.tsx:5` | Warnhinweis für Soft Error | `--warning`, Statusrolle, übersetzter Grund | Phase 1: reine Interpunktion/Großschreibung soll kein Warn-Badge mehr auslösen |
| `components/vocabulary/VocabCardSession.tsx:306` / `type_german_with_article` | Artikelhinweis | Eingabebeschriftung für Artikelkarte, kein eigener erklärender Info-Hinweis | Phase 1: sichtbarer ergänzender Hinweis |
| `dictionaries/{de,en,ru,uk,tr}.json` / `vocabulary.type_german_with_article` | Fünf Sprachen | Schlüssel vorhanden (de 1234, en 1235, ru 1234, uk 1234, tr 1231) | Bestehende Texte nutzbar |
| Vorgeschlagenes `feedback: article_missing / article_wrong` | Eigene Fehlerrückmeldung | Im geprüften Vokabel-/Bewertungsvertrag nicht vorhanden | Vorschlag für Phase 1, nicht bestehendes Feld |
| `public.grammatical_article` / `04_normalization.sql:87` | der/die/das/none | Vier Enum-Werte; Dump `schema.sql:217` entspricht dem | Kein neuer Typ nötig |
| `lib/vocabulary-ui.ts:96` / `articleColorClass()` | Einheitliche Artikelfarben | Zuordnung der/die/das zentral vorhanden | Für späteren Artikelhinweis wiederverwenden |
| `public.vocabulary_direction_progress` / `schema.sql:4964` | Lernstand pro Person, Karte, Richtung | `auth_user_id`, `card_id`, `direction`, Phase, Fälligkeit, Lapses, Zeitstempel | Mitnahme soll bestehende Zeilen weiterverwenden |
| `vocabulary_direction_progress.box_number` / `schema.sql:4970` | 1–7, 7 gelernt | Integer-Constraint 1–7; RPC erreicht Box 7 nach Phase 6 | Bestehendes Modell erhalten |
| `vocabulary_direction_progress.next_review_date` | Termin erhalten | timestamptz, Standard now(); RPC legt Review-Termin fest | Mitnahme darf Termin nicht neu initialisieren |
| `lib/vocabulary-box.ts:97` / `computeWordBoxState()` | Schwächere Richtung; gelernt erst beide auf 7 | `Math.min` Zeile 108, `every(isLearned)` Zeile 109 | Befund bestätigt |
| `public.vocabulary_lesson_pauses` / `25_vocabulary_lesson_switch.sql:21` | Pausenschalter pro Person/Lektion | Schlüssel `auth_user_id,unit_id`, `paused_at`; nur eigene Zeilen lesbar | Noch keine niveauübergreifende Mitnahme |
| `learning_units.owner_auth_user_id` / `23_vocabulary_own_words.sql:28` | Private Unit für eigene Wörter | UUID-FK zu profiles; null für Kursinhalt | Im Dump fehlend, in Typen vorhanden |
| `learning_private.unit_allowed` / `23_vocabulary_own_words.sql:94` | Eigene Wörter privat, Kursinhalt über Grants | Eigene Unit nur Eigentümer plus Trainerzugriff | Phase 5 muss Mitnahme ergänzen, Privatsphäre erhalten |
| `learning_private.allowed_unit_ids` / `23_vocabulary_own_words.sql:69` | Lesepfad konsistent zu RPC-Zugriff | Eigener Zweig nach Eigentümer, Grants und Sprache | Mitnahme benötigt auch konsistenten Lesepfad |
| `components/dashboard/LevelPath.tsx:57` | Vokabel-Stationen und eigene Wörter | Stationen, Lektionsschalter, „Eigene Wörter“ vorhanden | Phase 2: als Lektionen benennen; Phase 5: Mitnahmestation |
| `app/actions/vocabulary.ts:505` / `getVocabularyOverview()` | Übersicht aus Vokabel-Lernstand | Stats, Box, dueCards; Pausenabfrage Zeile 66 | Keine vorhandene Mitnahmetabelle |
| `public.learning_levels` / `schema.sql:4668` | Verbindliche Niveaureihenfolge | code, cefr_level, sort_order, is_active | Live-Zeilen separat prüfen |
| `learning_levels.sort_order` / `schema.sql:4671` | Fachliche Reihenfolge | smallint NOT NULL, positiv | Später statt lexikalischer Reihenfolge verwenden |
| Neue Mitnahme-Tabelle und einmalige Frage | Schalter Person/Zielniveau, alle früheren Niveaus | Noch nicht implementiert | Geplante Phase 5; keine DDL in Phase 0 |
| `public.reset_student_level_progress` / `learning.sql:755`, `05_rpc_errors.sql:76` | Reset-Funktion vorhanden | Öffentliche Grenze in 05 JSONB-verpackt; interne Resets löschen vorhandenen Lernstand | Künftige Mitnahme-/Pfadtabellen in Phase 3/5 berücksichtigen |
| `lib/learning-reset-events.ts:40` | Browserzustand nach Reset synchronisieren | Lernkasten-Storage löschen, Session-Autostart löschen, BroadcastChannel/Storage-Ereignisse | Neue Browserzustände später einbeziehen |

## Lehrkraft, Benachrichtigungen, Registrierung und „Neu“

| Ort | Erwartet | Gefunden | Delta |
|---|---|---|---|
| `components/admin/StudentDetailModal.tsx:9` | 31 Zeilen, Kontakt und Tafel | Kontaktblock und `BlackboardEditor`, optional children | Befund bestätigt; keine eigene Analyseseite |
| `components/admin/StudentList.tsx:155` | Rollen, Zugriff und Prozentfortschritt | Liste, ProgressBadges, Rollen-/Niveauverwaltung, Reset | Phase 7 ergänzt Aktivität, Pfadposition, Noten und fällige Karten |
| `components/admin/TeacherAnalytics.tsx` | Analytik vorhanden | Analytics-Komponente, Daten über Server Action | Vorhandenen Datenpfad erhalten |
| `app/actions/teacher-analytics.ts:24` | RPC mit Lernendem und Kurs | `get_all_students_progress_data` mit beiden Parametern | Keine direkte RPC in der Darstellung nötig |
| `public.get_all_students_progress_data(p_student_id,p_course_id)` / `23_vocabulary_own_words.sql:350` | Phasen 1–6, gelernt, 30 Tage, Niveauabschluss | Aktueller Körper filtert private Units in Verteilung und Historie; 30 Tage in Berliner Zeit | Letzte Quelle ist 23 statt 11 |
| `supabase/vps/11_teacher_analytics.sql:4` | Ursprung der Analytik-Erweiterung | Früherer Vollkörper vorhanden | Historisch, nicht letzte Implementierung |
| `vocabulary_private.answer_receipts` / `schema.sql:5020` | Jede angenommene Antwort als Receipt | Request-/Progress-/Nutzer-ID, typed_answer, is_correct, response, created_at | Für Richtigkeit `response.isCorrect` maßgeblich; Legacy-Input `is_correct` ist kein sicherer Bewertungsnachweis |
| `answer_receipts.typed_answer` / `schema.sql:5026` | Getippte Antwort | Nullable text, max. 4000 Zeichen | Datensparsamkeit/Aufbewahrung in Phase 7 festlegen |
| `answer_receipts.is_correct` / `schema.sql:5025` | Laut Zwischenbericht Richtigkeit | Nullable Payload-Feld; aktuelle `submit_answer` ignoriert Client-Richtigkeit | Lehrkraft-Auswertung nutzt bereits `response->>'isCorrect'` (23:399) |
| `answer_receipts.created_at` / `schema.sql:5029` | Antwortzeit | timestamptz NOT NULL DEFAULT now() | Keine Anschlagsprotokolle |
| `public.user_exercise_progress` / `schema.sql:4932` | Grammatikfortschritt | completed, score, attempts, hint_shown, created_at, updated_at | Aggregatstand, kein vollständiges Versuchsjournal |
| `public.learning_activity_days` / `24_learning_activity_days.sql:21` | Lerntage | auth_user_id und day, eigene SELECT-Policy | Im historischen Dump fehlend |
| `public.submissions` / `schema.sql:4900` | Aussprache-Einsendungen | Person, Typ, URL/Text, Status, Niveau, Prompt | Quelle für Phase 7 vorhanden |
| `public.pronunciation_messages` / `schema.sql:4872` | Aussprache-Nachrichten | Einsendung, Sender/Rolle, Text/Audio, created_at, seen_at | `seen_at` ist Feedback-Lesestand, kein allgemeines Neu-System |
| `public.teacher_student_notes` / `schema.sql:4917` | Lehrkraftnotizen | student_id, teacher_id, note_text, Zeitstempel | Vorhandene Datenquelle |
| `/[lang]/admin/students/[id]` | Geplante eigene Schülerseite | Nur `app/[lang]/admin/students/page.tsx`, loading/error vorhanden; keine `[id]`-Route | Neue Route in Phase 7 |
| `lib/admin-navigation.ts:57` | Admin-Navigation | Students-Link vorhanden | Detailseite später einordnen |
| Antwort-Einspruchs-Warteschlange | Historischer Vorschlag im Zwischenbericht | In genannten UI-/RPC-Verträgen nicht vorhanden; aktueller Split-Prompt `07_PHASE-7-GPT.md`, §7.4, verbietet die Funktion ausdrücklich | Nicht bauen. Varianten bleiben Aufgabe der Lehrkraft im CMS und des Audits aus Phase 1.4 |
| Hinweis „bereit für das nächste Niveau“ | Historischer Vorschlag im Zwischenbericht | Aktueller Split-Prompt `06_PHASE-6-GPT.md`, §6.3, verlangt weder Staff-Mail noch Dashboard-Hinweis/Zähler zum Abschluss | Überholten Vorschlag nicht als Phase-6/7-Aufgabe übernehmen |
| `app/actions/pronunciation-conversations.ts:39` / `notifyPronunciationFeedback()` | Mail bei Lehrkraftantwort | Staff-Check, Empfänger aus people, Sprache aus profiles, Link zur Aussprache | Kein Profilopt-out / kein 10-Minuten-Bündeln |
| `lib/mail.ts:42` / `queueTransactionalEmail()` | Lokale Outbox ansprechen | Delegate an enqueue vorhanden | Vorhandenen Versandpfad nutzen |
| `feedback_available` / Dedupe-Schlüssel | Eine Mail je Nachricht | `pronunciation-message:${messageId}` in Action Zeile 48 | Phasen-6-Bündelung ist noch Zukunft |
| `lib/mail/templates.mjs:3` | Fünfsprachige Vorlagen | feedback_available und level_access_granted vorhanden | UI-Schalter später in fünf Sprachen |
| `lib/mail/worker.mjs` | Lokaler Mailworker | Datei vorhanden, arbeitet mit bestehender Queue | Keine neuen Dienste in Phase 0 |
| `public.profiles` / `schema.sql:4858`, `database.types.ts:1059` | Profile und gewünschter Benachrichtigungsschalter | id, native_language, role, ui_language, created_at, updated_at | Kein notify_pronunciation_feedback |
| `profiles.notify_pronunciation_feedback` | Vorschlag boolean default true | Weder Migrationen, Dump noch Typen definieren die Spalte | Phase 6 benötigt neue Migration + UI + Opt-out-Prüfung |
| `app/[lang]/dashboard/profile/page.tsx:41` | Profil-Einstellungen | Details, Sprache, Erscheinungsbild und Kurse | Kein Benachrichtigungsabschnitt |
| `components/dashboard/ProfileSettings.tsx:8` | Navigierbare Einstellungsbereiche | Union `details / language / appearance / courses` | Phase 6 um Benachrichtigungen erweitern |
| `private.mail_outbox` / `schema.sql:4395` | Zustellung prüfbar | status, sent_at, message_id, lease-Felder vorhanden; vollständige Spalten unten | Live-Zustellung nicht aus Quelldatei ableitbar |
| `private.mail_outbox.status` | `sent` als Zustellnachweis | Enum `public.mail_status`, Standard pending | Lesende Live-Prüfung im Hauptbericht |
| `lib/auth-i18n.ts:69` / `status_signup_email_sent` | Freigabebotschaft nach Anmeldung | „Fast fertig! … Bestätigungs-Knopf“ | Phase 1: zusätzliche Admin-Prüfung erklären |
| `lib/auth-i18n.ts:81` / `status_confirm_success` | Freigabebotschaft nach Bestätigung | „E-Mail-Adresse ist bestätigt und du bist angemeldet“ | Phase 1: Freischaltung ausstehend ergänzen |
| `lib/student-ui-i18n.ts:38` / `today_no_level` | Deutliche Freigabekarte | Nur „Deine Lehrkraft schaltet dein Niveau in Kürze frei.“; alle fünf Sprachen vorhanden | Phase 1: visuelle Karte |
| `components/dashboard/home/TodayPlan.tsx:67` | Home ohne Freischaltung | Kleiner Absatz bei noLevel | Befund bestätigt |
| `level_access_granted` / `29_student_level_access_notification.sql:31` | Freischaltungs-Mail bereits vorhanden | AFTER INSERT-Zeilentrigger; Dedupe pro Person und Niveau, kein Nachholen | Aktuelle Phase 6.4 verlangt eine Mail pro Person/Speichervorgang für mehrere neue Niveaus; Dedupe- und Bestandsgarantien erhalten |
| `lib/learning-status-server.ts:74` / `fresh` | Medien als neu markieren | Alter nach created_at; `FRESH_MEDIA_DAYS = 14` (Zeile 17) | Keine personenspezifische Gesehen-Quittung |
| Vorgeschlagene Gesehen-Tabelle / Neu-Badges | Neu für Lektionen, Pfade, Aussprache, Medien, Niveaus, Trainer | Im geprüften Neu-Pfad nicht vorhanden; Feedback hat separat seen_at | Phase 6: einheitliches System und Bestandsmarkierung |

## Grammatik, Sprache und Navigation

| Ort | Erwartet | Gefunden | Delta |
|---|---|---|---|
| `components/layout/DashboardHeader.tsx:40` | Ganzer Pfad auf allen Geräten | Segment `level` ausgelassen; mobile Zurück-Pille + aktueller Name; volle Liste erst md | Phase 2: scrollbare vollständige Spur |
| `lib/dashboard-i18n.ts:66` / `DASHBOARD_ROUTE_KEYS` | Zentrale Routenbezeichnungen | Mapping vorhanden | Neue Pfadroute später ergänzen |
| `learning_exercises.content.target_form` / `07_content_quality.sql:24` | Verbindliche Zielform | Array nichtleerer Strings; Insert/Inhaltsänderung durch Trigger geschützt | Altbestand kann incomplete bleiben |
| `learning_exercises.content_status` / `07_content_quality.sql:55` | Legacy-Aufgaben ausgeblendet | Gespeichert generiert aus Ziel-/Sprachvalidierung; ready/incomplete | Produktionsanzahl nur durch Live-Abfrage belegbar |
| `learning_vocabulary_cards.alternative_answers_de` / `schema.sql:4772` | Alternative deutsche Sätze | text[] NOT NULL, Standard leeres Array | Variantenprüfung Phase 1/4; kein Inhalt erfunden |
| `app/[lang]/dashboard/level/[level]/exercises/page.tsx:8` | Aktueller Grammatiktrainer | Lädt `getExercises` und reicht Objektliste an Client weiter | Kein Redirect zu `/path` vorhanden |
| `components/exercises/ExerciseClient.tsx:43` | Themenregal | Themen/Sitzung, zwei Kartentypen, `recordExerciseAttempt` | Phase 3 ersetzt später durch Lernpfad |
| `supabase/seeds/grammar-curriculum-2026.json` | 600 Aufgaben, zehn Lektionen je Niveau | Maschinell gezählt: sechs Niveaus × 100; je 80 fill_in_blank, 20 multiple_choice; zehn Lektionen | Nicht passend zu sieben A1.1-Lernpfaden |
| Seed `content.target_form` | Auslieferbarer aktueller Inhalt | 0 von 600 Seed-Aufgaben enthalten target_form | Rohseed nicht ohne Qualitätsbearbeitung erneut importieren |
| `public.exercise_type` / `04_normalization.sql:85` | Drei bekannte Typen | fill_in_blank, multiple_choice, sentence_building | Neue Typen in Phase 3 erfordern vorgeschaltete Enum-Migration |
| `public.grammar_translations` / `schema.sql:4590` | Getrennte Übersetzungen | exercise_id, locale, hint, smart_hint, explanation, prompt | Befund bestätigt |
| `grammar_translations.exercise_id` | Übungsreferenz | UUID NOT NULL | Kein Delta |
| `grammar_translations.locale` | Sprache der Übersetzung | text NOT NULL, Locale-FK | Fünfsprachigen Vertrag erhalten |
| `grammar_translations.hint` | Hinweis | nullable text | Kein Delta |
| `grammar_translations.smart_hint` | Konkreter Hinweis | nullable text | Kein Delta |
| `grammar_translations.explanation` | Erklärung | nullable text | Kein Delta |
| `grammar_translations.prompt` / `07_content_quality.sql:59` | Übersetzungsaufgabe in UI-Sprache | nullable text; nicht in deutschem content | Vorhanden, Typen Zeile 401 |
| `learning_private.german_text_allowed` / `07_content_quality.sql:17` | Deutscher Sprachschutz | NFC-normalisiert; kyrillische Blöcke und türkische Spezialzeichen werden abgewiesen | In Phase 3/4 beibehalten |
| `grammar_private.german_content_allowed` / `07_content_quality.sql:33` | Schutz nur deutscher Felder | topic, instruction, text_before/after, question, correct_answer, gap_hint, options, accepted_answers, parts, target_form | Lokalisierte Texte bewusst außerhalb dieser Prüfung |
| `public.learning_units` / `schema.sql:4729` + Migration 23 | Übungs-/Trainerzuordnung | level, trainer, label, sort_order, is_active, Eigentümer | Grammatik bleibt intern trainer=exercises |
| `learning_units.trainer` | Interner Trainer exercises | Enum trainer_code | UI-Umbenennung braucht keinen Trainer-Code-Wechsel |
| `learning_units.is_active` | Archivierung statt Löschen | boolean NOT NULL default true | Phase 3 archiviert Alt-Units später |
| `public.learning_trainer_grants` / `schema.sql:4695` | Trainerfreigaben | Person, level, trainer, enabled, unit_mode | Zugriffsschicht erhalten |
| `public.learning_unit_grants` / `schema.sql:4717` | Einzelunitfreigaben | Person, level, trainer, unit_id | Zugriffsschicht erhalten |
| `components/dashboard/TrainerLanguageRequired.tsx` | Deutsche UI sperrt Trainer | Komponente vorhanden; exercises/page Zeile 10 gibt sie früh zurück | Screenshots in zugelassener Lernsprache nötig |
| `lib/access/levels.ts:95` / `hasTrainerAccess()` | Sprach-/Freigabeprüfung | Zeile 97 verweigert bei ui_language=de | Auch Mediathek-Trainer betroffen |
| `lib/audio/neural-config.ts:12` | Lokales Piper-TTS | Cache-Version piper-local-v1, lokale Voice-Konfiguration | Für spätere Hörübungen nutzbar |
| `lib/audio/neural-cache.ts:31` | Lokales Audio erzeugen/cachen | generateCachedAudio vorhanden | Betriebsnachweis separat, keine neue Audio-Erzeugung in Phase 0 |
| `lib/audio/neural-client.ts:34` | Client-Audio abrufen | resolveNeuralAudio + Cache/Prefetch vorhanden | Wiederverwendung statt externem Dienst |
| `components/dashboard/StudentNavigation.tsx:12` | Lernen zuletzt besuchtes Niveau | localStorage `sitov:last-level`; liest/schreibt bei Navigation, Fallback firstLevel | Keine serverseitige Aktivitäts-RPC |
| `components/dashboard/StudentNavigation.tsx:53` | Start/Lernen/Kalender/Hilfe | Drei Links plus Hilfe-Button/BottomSheet | Keine Scroll-Hide-Logik |
| `components/dashboard/student.css:175` / `.st-tabbar` | Untere mobile Leiste | Höhe über --st-tabbar-h, Layout bis Tablet | Phase 2 ergänzt Ein-/Ausblenden |
| `components/dashboard/student.css:192` / Aussprache-Dock | Dock über Tabbar | `bottom: var(--st-tabbar-h)` | Bei Hide mitbewegen, sonst freie Lücke |
| `app/[lang]/dashboard/page.tsx:49` | Home folgt zuletzt aktivem Niveau | Erstes freigeschaltetes Niveau mit Fortschritt zwischen 0 und 100; weitere Fallbacks | Phase 2: Aktivität als Quelle |
| `app/[lang]/dashboard/level/[level]/page.tsx:58` | Modusnavigation oben | LevelPath zuerst, TrainerStatusTiles Zeile 62 darunter | Phase 2: Modus-Dock und neue Übersicht |
| `components/dashboard/TrainerStatusTiles.tsx` | Vier Lernbereiche | Vorhandene Kacheln, auf Niveau-Seite nach Lernweg | Bestehenden Status wiederverwenden |
| `lib/student-ui-i18n.ts` / `path_title` | Klare Trennung Vokabellektionen / Lernpfad | Bestehender Lernweg bezeichnet Vokabelstationen | Phase 2 benennt in allen Sprachen um |
| `/vocabulary` / `app/[lang]/dashboard/level/[level]/vocabulary/page.tsx` | Lernboxroute | Vorhanden | Kein Delta für Bestandsaufnahme |
| `/vocabulary/assess` / gleichnamige `page.tsx` | Einstufung | Vorhanden | Zweiter Knopftausch in Client beachten |
| `/vocabulary/train` / gleichnamige `page.tsx` | Training | Vorhanden | Bestand |
| `/pronunciation` / gleichnamige `page.tsx` | Aussprache | Vorhanden | Screenshot mit Dock prüfen |
| `/videos` / gleichnamige `page.tsx` | Mediathek | Vorhanden, einzelne Video-Unterroute ebenfalls | Bestand |
| `/media` / `app/[lang]/dashboard/level/[level]/media/page.tsx:6` | Alias zur Mediathek | `redirect(.../videos)` | Befund bestätigt |
| `app/globals.css:1067` / --accent, --accent-text, --accent-strong | Getrennte dekorative/Text-/Buttonfarben | Tokens für Standard und Kontrastmodi vorhanden | Richtlinie dokumentiert gemessene Kontraste |
| `app/globals.css:1349` / `.sl-glass` | Geteilte Glasfläche | Vorhanden, color-mix 86 % surface | Kein neuer Glasbaustein notwendig |
| `app/globals.css:1358` / `.sl-card` | Geteilte Karten | Vorhanden, ausgewählt/deaktiviert | Bestehende Klasse verwenden |
| `app/globals.css:1367` / `.sl-chip` | Geteilte Chips | Vorhanden; Mindesthöhe 2.75rem = 44 px bei 16 px Basis | Unter neuer R13-Anforderung 48 px; Phase 2 prüfen |
| `components/dashboard/student.css` / `st-*` | Lernenden-Designklassen | Vorhanden | Richtlinie führt Orte/Verwendung aus |
| `components/vocabulary/learning.css` / `learning-*` | Lernbildschirmklassen | Vorhanden | Richtlinie führt Orte/Verwendung aus |
| Tailwind `bg-[var(--x)]/10` / `bg-accent/10` | Transparente Tokenfarbe | Zwischenbericht warnt vor fehlender Tailwind-3-Ausgabe; bestehendes CSS verwendet color-mix | Keine pauschale neue Utility-Nutzung; in Richtlinie sichere Schreibweise |

## Der genaue Lösungs-Datenpfad

| Ort | Erwartet | Gefunden | Delta |
|---|---|---|---|
| `lib/learning-catalog.ts:10` / `grammarSelection` | Für R5 nur öffentliche Aufgabenfelder | `*` plus Unit-/Übersetzungs-Embed | Gesamtes content wird serverseitig geladen |
| `lib/learning-catalog.ts:15` / `grammarQuery()` | Kontrollierter Lesevertrag | `.from('learning_exercises').select(grammarSelection)` | Noch keine gesonderte lösungsfreie API |
| `lib/learning-catalog.ts:38` / `mapGrammarExercise()` | Keine Lösungsdaten im DTO | Zeile 53 kopiert `{ ...content, ...translated }` | correct_answer/accepted_answers bleiben erhalten |
| `app/actions/exercises.ts:139` / `getExercises()` | Nur freigegebene vollständige Inhalte | Filtert incomplete und fehlende target_form; RLS filtert zusätzlich | Erklärt die aktuelle leere Traineransicht bei ausschließlich incomplete |
| `lib/types/exercise.ts:154` / `parseFillInBlankContent()` | Lösung erst nach Bewertungsaufruf | Zeile 169 übernimmt correct_answer, 171 accepted_answers | Leck bei jedem ausgelieferten gültigen Lückentext |
| `lib/types/exercise.ts:198` / `parseMultipleChoiceContent()` | Keine markierte richtige Option vor Bewertung | Zeile 208 übernimmt correct_answer | Auch Auswahlaufgaben enthalten die markierte Lösung |
| `app/actions/exercises.ts:201` | Lösungsfreies StudentExercise | `content` ungefiltert im Objekt, zusätzlich chips und Lösungs-Audio/Artikel | Strukturelles R5-Delta |
| `app/[lang]/dashboard/level/[level]/exercises/page.tsx:16` | Keine Lösungen in serialisierten Client-Props | `<ExerciseClient exercises={exercises} ... />` | Server→Client-Grenze überträgt die Objekte vor einem Versuch |
| `components/exercises/ExerciseClient.tsx:1` / `:44` | Client zeigt nur Aufgaben/Resultate | `'use client'`, `useState(exercises)` | Browser hält diese Inhalte bereits im Themenregal |
| `components/exercises/ExerciseClient.tsx:96` | PostgreSQL entscheidet richtig/falsch | `recordExerciseAttempt` wird für Bewertung aufgerufen | DB-Bewertung vorhanden; Problem ist vorzeitige Lösungsauslieferung |

Die lokale Kette beantwortet die Architekturfrage mit **ja, sofern eine Aufgabe die Freigabe- und Vollständigkeitsfilter passiert**. Die vollständige Ausblendung von Altaufgaben ist kein lösungsfreier Datenvertrag. Für Phase 3 muss neben der Komponentenschnittstelle auch der direkte Tabellen-Lesezugriff auf Lösungsfelder geprüft werden: RLS beschränkt hier Zeilen, nicht einzelne JSONB-Schlüssel. In Phase 0 wurden dafür keine RLS-Policies oder RPCs geändert.

Zusätzlicher ausführbarer Kontrollnachweis: Die unveränderten Funktionen `parseFillInBlankContent` und `parseMultipleChoiceContent` wurden am 25.09.2026 mit `ts-node/register/transpile-only` und rein synthetischen Aufgaben geladen. Der Lückentext-Parser gab `correct_answer: "bin"` und `accepted_answers: ["bin"]` zurück; der Auswahl-Parser gab ebenfalls `correct_answer: "bin"` zurück. Keine Produktionsdaten und keine zusätzlichen Testdateien wurden dafür angelegt. Dies ist ein lokaler Parsernachweis, kein Mitschnitt einer produktiven Lernenden-Sitzung.

## Inhaltsschema aus der älteren Phase 2.6

`learning_exercises_accepted_answers_check` ruft `grammar_private.valid_accepted_answers(content,type)` auf (ursprünglich `04_normalization.sql:192–228`, letzter Funktionskörper und erneute Constraint-Validierung in `06_soft_errors.sql:128–146`, Dump `schema.sql:4645`). Der Vertrag verlangt:

- `content` ist ein Objekt und `accepted_answers` ein Array.
- Der alte Schlüssel `alternative_answers` ist seit Migration 06 ausdrücklich verboten.
- Höchstens 21 Einträge, jeder ein String mit nach `btrim` 1–1000 Zeichen.
- Keine Duplikate nach Kleinschreibung und Zusammenfassung von Whitespace.
- Bei multiple_choice exakt ein akzeptierter Eintrag.
- Bei den bewertbaren Typen muss `correct_answer` nichtleer und normalisiert in accepted_answers enthalten sein. sentence_building darf ein leeres Array haben.

Migration 07 ergänzt davon getrennt Zielform, Sprachschutz, abgeleiteten Inhaltsstatus, Schreibtrigger und SELECT-Policy. Neue Aufgabentypen in Phase 3 müssen beide Vertragsschichten berücksichtigen.

## Spalteninventar der vier ausdrücklich verlangten Tabellen

Diese Liste ist der **lokale Definitionsnachweis**. Das aktuelle Produktionsinventar wird im Prüfbericht über `information_schema.columns` erhoben. Die gemeinsame Gegenprüfung verhindert, dass der alte Dump fälschlich als aktuelle Produktion gilt.

| Ort | Erwartet | Gefunden | Delta |
|---|---|---|---|
| `private.mail_outbox` / `schema.sql:4395` | Vollständige lokale Spaltenliste | id, dedupe_key, kind, recipient, locale, payload, status, attempts, available_at, lease_until, lease_token, worker_id, last_error, message_id, created_at, sent_at | 16 Spalten; keine neue Preference-Spalte hier vorgesehen |
| `public.profiles` / `schema.sql:4858`, Typen 1059 | Vollständige lokale Spaltenliste | id, native_language, created_at, updated_at, role, ui_language | 6 Spalten; notify_pronunciation_feedback fehlt |
| `public.learning_units` / `schema.sql:4729` + `23:28` | Vollständige lokale Spaltenliste | id, level, trainer, label, sort_order, is_active, owner_auth_user_id | 7 nach Migration 23; Dump allein enthält nur 6 |
| `public.learning_vocabulary_cards` / `schema.sql:4763` | Vollständige lokale Spaltenliste | id, word_de, article, plural, image_url, audio_url, created_at, sentence_practice, alternative_answers_de, unit_id | 10 Spalten; alternative_answers_de vorhanden |

Es wurden ausschließlich Dokumentationsdateien bearbeitet. Kein Produktionsinhalt, keine Freigabe, keine Profilpräferenz, kein Lernstand und keine Migration wurde durch dieses Inventar verändert.
