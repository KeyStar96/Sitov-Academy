# Zwischenbericht: Master-Prompt 4.0 für ChatGPT 6 Astra

Stand: 25.09.2026. Die Recherche ist abgeschlossen, der Master-Prompt ist noch **nicht geschrieben**.
Dieser Bericht enthält alles, was die nächste Sitzung braucht, um die Datei `MASTER-PROMPT-4.md` zu schreiben.

## 1. Auftrag des Nutzers (Kurzfassung)

Gesucht ist ein Master-Prompt für ChatGPT 6 Astra als `.md`-Datei. Er soll in Phasen gegliedert sein, damit jede Phase in einem eigenen Chat läuft. ChatGPT soll die folgenden Kritikpunkte beheben und die Lernplattform erweitern:

1. Die Knöpfe „Wusste ich“ und „Wusste ich nicht“ tauschen die Seiten.
2. Groß-/Kleinschreibung und Zeichensetzung zählen beim Selberschreiben (Vokabeln und Grammatik) nicht als Fehler.
3. Beim Ausschreiben von Nomen erscheint ein kleiner Hinweis, dass der Artikel mitgeschrieben werden muss.
4. Offene Wörter können aus früheren Niveaus mitgenommen werden, zum Beispiel von A1.1 nach A1.2. Sie behalten dabei ihre Lernbox-Phase. Dafür gibt es eine Station, die man ein- und ausschalten kann, ähnlich wie „Eigene Wörter“. Sie umfasst alle vorherigen Niveaus.
5. Das Lehrer-Dashboard wird stark ausgebaut. Die Lehrkraft soll genau sehen, was die Lernenden tun, einschließlich der Phasenverteilung.
6. Antwortet die Lehrkraft in der Aussprache, bekommt die lernende Person eine Mail. Im Profil lässt sich das per Schalter an- und abstellen.
7. Nach der Registrierung erscheint: „Vielen Dank für die Anmeldung, der Admin prüft kurz Ihre Daten und schaltet Ihnen die Funktionen frei.“
8. Neue Inhalte bekommen ein „Neu“-Symbol.
9. Die Brotkrumen-Navigation zeigt den ganzen Pfad statt nur 2 Ebenen. Sie soll animiert und visuell deutlich besser sein.
10. Bei Aufgaben mit mehreren möglichen Lösungen wird entweder die Zielform vorgegeben (zum Beispiel das Verb) oder die Varianten werden akzeptiert.
11. **Lernpfad:** Er ersetzt die Grammatikübungen vollständig. In A1.1 gibt es 7 Pfade, einen pro Lektion. Pfad n+1 wird erst frei, wenn der Test von Pfad n bestanden ist. Die Optik folgt der Skizze: ein gewundener Pfad aus blauen Aufgabenknoten, gepunktet verbunden, der zu „Test Ln“ führt. Danach folgt das Banner „Lektion n+1“. Grüne „Special“-Zweige zweigen seitlich ab. Diese Spezial-Pfade legt die Lehrerin **später** selbst an, jetzt wird nur das Datenmodell vorbereitet. ChatGPT erstellt alle Aufgaben und alle 7 Tests **selbst**. Anzahl und Aufgabentypen wählt es frei, **optimiert für ältere Lernende**.
12. **Navigation:** Die untere Leiste wird auf dem Handy beim Runterscrollen ausgeblendet und beim Hochscrollen wieder eingeblendet. Home, Kalender und Hilfe bleiben, wie sie sind. Der Bereich „Lernen“ ist zu kompliziert: Oben steht nur der Vokabeltrainer, die anderen Module stehen weit unten. Home soll sich an das zuletzt gelernte Niveau anpassen. Gewünscht sind mehr Mikroanimationen und ein spielerisches Layout. Idee: Die Lernmodi (Vokabeln, Lernpfad, Aussprache, Mediathek) sind oben als animierte Tabs angeheftet. **Der Prompt soll eine Design-Richtlinie vorgeben.**

Der Lernzielkatalog für Pfad 1 bis 7 steht im ursprünglichen Chat; die Lehrbuchseiten liegen als Screenshots bei. Er wird unten in eigenen Worten zusammengefasst. ⚠️ Lehrbuchtexte, Figurennamen, Seiten- und „ÜG“-Verweise sowie der Buchtitel dürfen **nicht** übernommen werden. Das verlangt `CODEX.md` 7.3 (Urheberrecht). Alle Beispielsätze müssen neu geschrieben werden.

## 2. Form und Konventionen des Prompts

- `CODEX.md` im Repo-Stamm ist **Master-Prompt 3.0**. Er ist ebenfalls für ChatGPT 6 Astra geschrieben, auf Deutsch, mit den Phasen 1–8, den Regeln R1–R11 und dem Ablauf S1–S7. Der neue Prompt (**4.0**) übernimmt diesen Stil, die Regeln R1–R11 und S1–S7 und ergänzt neue Regeln.
- **Separate Chats:** Die Datei kommt als `MASTER-PROMPT-4.md` in den Repo-Stamm. Sie beginnt mit einem Startsatz pro Chat: „Lies MASTER-PROMPT-4.md vollständig und führe ausschließlich Phase N aus.“ Jede Phase liest am Anfang `docs/master-4/STATUS.md` und schreibt am Ende eine Übergabe hinein. Checkboxen werden nur mit Testnachweis abgehakt (S4).
- Vorgeschlagene Neuregeln:
  - R12: Fünf Sprachen synchron (de/en/ru/uk/tr), Dictionary-Parität, siehe `__tests__/translation-integrity.test.ts`.
  - R13: Barrierefreiheit für ältere Menschen: Touch-Ziele ≥ 48 px, Hauptaktionen 56 px, Lernschrift ≥ 18 px, `prefers-reduced-motion` für jede Animation, axe ohne Filter.
  - R14: Keine Lehrbuchinhalte.
  - R15: Primäre bzw. positive Aktion rechts, sekundäre links, überall in der App. Das folgt aus dem Knopftausch.
  - R16: Datensparsamkeit beim Tracking. Aufbewahrungsfrist festlegen und die Datenschutzerklärung ergänzen.

## 3. Verifizierte Fakten aus der Codebase

**Stack:** Next.js 16.3.5 (`AGENTS.md`: Doku in `node_modules/next/dist/docs/` lesen, `proxy.ts` statt Middleware), React 19.2.8, Tailwind 3.4, Zod 4, Framer Motion 12, lucide, selbst gehostetes Supabase/Postgres 15.8 auf einem STRATO-VPS.

**Git und Deploy:**
- Produktionszweig ist `codex/vps-self-hosted`.
- Gemini committet im selben Worktree. Nichts gestaged liegen lassen und fremde Commits prüfen.
- Ablauf bei Schemaänderungen:
  1. `deploy/vps/deploy-release.sh --prepare-only`
  2. `python3 deploy/vps/migrate-local.py --apply NN_x.sql --keep-stopped` (erstellt auch das Backup nach R8)
  3. `deploy-release.sh --activate <rev12> --schema-changed`
- Eine neue Migration muss in die `ORDER`-Liste von `deploy/vps/migrate-local.py` eingetragen werden. Der Test dafür ist `deploy/vps/tests/test_migrate_local.py`.
- Zu jeder Migration gehört ein Rollback unter `supabase/vps/rollback/NN_*.sql`.

**Migrationen:**
- Die letzte ist `29_student_level_access_notification.sql`, die **nächste freie Nummer ist 30**.
- Kein `BEGIN`/`COMMIT` in der Datei, jede Anweisung idempotent.
- Wer eine RPC ändert, legt eine neue Migration an und kopiert den Funktionskörper aus der Migration, die sie zuletzt definiert:
  - `learning_private.grade_answer` → `06_soft_errors.sql`
  - `vocabulary_private.submit_answer`, `submit_self_rating` und `check_retry` → `22_vocabulary_phase6_rules.sql`
  - `grammar_private.record_attempt` → `06`
- `supabase/schema.sql` ist nur Dokumentation und hinkt hinterher.
- Test-Stolperstein: `createPhase3Database()` spielt Migrationen nur bis `06` ein.
- DB-Tests laufen mit `node --test supabase/tests/*.test.mjs`.

**Build-Prüfung:** `npm ci`, `node_modules/.bin/tsc --noEmit`, `NODE_OPTIONS=--max-old-space-size=3072 npm run build` mit Platzhalter-Umgebungsvariablen (`NEXT_PUBLIC_SITE_URL`, `SITE_URL`, Supabase-Keys, `TRUSTED_PROXY_HOPS=1`), vollständiges Jest, `npx playwright test e2e/accessibility.spec.ts`.

**Tokens:**
- `--accent` (orange-500) nur für Flächen, Ränder und Punkte, nie für Text.
- `--accent-text` für Text.
- `--accent-strong` mit weißer Schrift für Knöpfe.
- Tailwind 3 erzeugt für `bg-[var(--x)]/10` und `bg-accent/10` **nichts**. Stattdessen `color-mix(in_srgb,var(--x)_10%,transparent)` verwenden.
- Geteilte Klassen stehen in `app/globals.css` (`.sl-glass`, `.sl-card`, `.sl-chip` …). Die Lernenden-UI nutzt `st-*` in `components/dashboard/student.css`, die Lernbildschirme `learning-*` in `components/vocabulary/learning.css`.

### Befunde zu den einzelnen Punkten

1. **Knöpfe:** `components/vocabulary/VocabCardSession.tsx:495-498` hat „Wusste ich“ links (primär) und „Wusste ich nicht“ rechts. Dasselbe Muster steht in `app/[lang]/dashboard/level/[level]/vocabulary/assess/LessonAssessmentClient.tsx:152-158` (`decide(true)` zuerst). **Beide Stellen tauschen.** Die Texte kommen aus `dictionaries/*.json` (`vocabulary.knew_it` / `didnt_know`).
2. **Bewertung:** `learning_private.grade_answer` (06) liefert `EXACT` | `SOFT_ERROR` | `INCORRECT` mit dem Grund `punctuation`, `capitalization`, `umlaut` oder `typo`.
   - Ein `SOFT_ERROR` zählt heute als richtig, hat aber zwei Nachteile: Die Grammatik-Punktzahl ist auf 90 gedeckelt, und bei Vokabeln wird das Intervall gedeckelt. Die UI zeigt dazu ein gelbes Warn-Badge (`components/exercises/SoftErrorBadge.tsx`).
   - **Neu:** `punctuation` und `capitalization` werden wie `EXACT` behandelt: volle Punkte, voller Leitner-Schritt, kein Warn-Badge, höchstens ein neutraler Hinweis „So schreibt man es“.
   - `umlaut` und `typo` bleiben `SOFT_ERROR`.
   - Das braucht eine neue Migration 30, die `grade_answer`, `submit_answer` und `record_attempt` anpasst, sowie Tests in `supabase/tests/soft-errors.test.mjs` und `vocabulary-learning.test.mjs`.
3. **Artikel-Hinweis:** Die Beschriftung `type_german_with_article` existiert bereits („Deine deutsche Übersetzung mit Artikel“). Es fehlt ein sichtbarer Info-Hinweis im Schreibmodus (`VocabCardSession.tsx:300-306, 500-504`).
   - Empfohlen ist zusätzlich ein Rückmeldefeld `feedback: 'article_missing' | 'article_wrong'`, damit falsche Antworten erklärt werden.
   - Die Artikel sind `public.grammatical_article` (der/die/das/none).
   - Farben kommen aus `articleColorClass` (`lib/vocabulary-ui.ts`).
4. **Wörter mitnehmen:**
   - Die Lernbox gilt pro Niveau. Der Lernstand liegt in `vocabulary_direction_progress` (`box_number` 1–7; 7 heißt gelernt, für „gelernt“ müssen beide Richtungen auf 7 stehen). Die Phase eines Wortes ist die schwächere seiner beiden Richtungen (`lib/vocabulary-box.ts`).
   - Pausen stehen in `vocabulary_lesson_pauses` (Migration 25).
   - „Eigene Wörter“ sind eine private Unit (`learning_units.owner_auth_user_id`, Migration 23). Lehrkräfte sehen sie **nicht**.
   - Die Stationen stehen in `components/dashboard/LevelPath.tsx`, die Übersicht kommt aus `getVocabularyOverview` (`app/actions/vocabulary.ts`).
   - Neu nötig: eine Tabelle für den Schalter „Mitnehmen“ pro Person und Zielniveau. Die Karten behalten Phase und Termin; nichts wird kopiert.
   - Die Zugriffsprüfung in `submit_answer` bzw. `unit_allowed` muss mitgenommene Karten erlauben.
   - Beim ersten Öffnen eines neuen Niveaus mit offenen Wörtern fragt die App einmal: „23 offene Wörter aus A1.1 mitnehmen?“
   - Die Niveaureihenfolge steht in `learning_levels.sort_order`.
   - Zurücksetzen des Lernstands (`reset_student_level_progress`, `lib/learning-reset-events.ts`) muss die neuen Tabellen einbeziehen.
5. **Lehrer-Dashboard:**
   - Heute gibt es `components/admin/StudentDetailModal.tsx` (31 Zeilen, nur Kontakt und Tafel-Notiz), `StudentList.tsx` (Rollen, Niveaus, Zugriffe, Fortschritt in %), `TeacherAnalytics.tsx` mit `public.get_all_students_progress_data(p_student_id, p_course_id)` (Migration 11: Phasenverteilung 1–6 plus gelernt, 30-Tage-Verlauf, Abschluss je Niveau).
   - Vorhandene Datenquellen:
     - `vocabulary_private.answer_receipts`: jede Antwort mit `typed_answer`, `is_correct` und Zeit.
     - `user_exercise_progress`
     - `learning_activity_days` (Migration 24)
     - `submissions`
     - `pronunciation_messages`
     - `teacher_student_notes`
   - Ziel:
     - eigene Seite `/admin/students/[id]` mit Tabs (Überblick, Vokabeln mit Phasen je Niveau und Lektion, Lernpfad, Aussprache, Aktivität, Notizen)
     - erweiterte Liste (zuletzt aktiv, Wochenpunkte, Pfad-Position, letzte Testnote, fällige Karten, Mini-Phasenbalken, Markierung „braucht Aufmerksamkeit“)
     - Warteschlange „Antwort-Einsprüche“: Lernende melden „meine Antwort ist auch richtig“, die Lehrkraft übernimmt die Antwort mit einem Klick in die akzeptierten Antworten
     - Lernpfad manuell freischalten oder zurücksetzen
     - Hinweis „bereit für das nächste Niveau“
   - Die Admin-Navigation steht in `lib/admin-navigation.ts`.
6. **Aussprache-Mail:**
   - Die Mail **existiert bereits**: `app/actions/pronunciation-conversations.ts:39-52` `notifyPronunciationFeedback` → `queueTransactionalEmail` vom Typ `feedback_available`, eine Mail pro Nachricht, Dedupe-Schlüssel `pronunciation-message:<id>`. Die Vorlagen stehen in `lib/mail/templates.mjs` (5 Sprachen), der Worker in `lib/mail/worker.mjs`.
   - Es fehlt **der Schalter im Profil**, zum Beispiel `profiles.notify_pronunciation_feedback boolean default true`. Die Profilseite `app/[lang]/dashboard/profile/page.tsx` bekommt einen neuen Abschnitt „Benachrichtigungen“ in `components/dashboard/ProfileSettings.tsx`.
   - Die Zustellung muss Ende-zu-Ende nachgewiesen werden (`private.mail_outbox` mit Status `sent`).
   - Empfohlen: mehrere Nachrichten innerhalb von 10 Minuten zu einer Mail bündeln.
7. **Registrierung:**
   - Texte in `lib/auth-i18n.ts`: `status_signup_email_sent` („Fast fertig! … E-Mail …“) und `status_confirm_success` („Vielen Dank! … bestätigt“).
   - Auf dem Dashboard ohne freigeschaltetes Niveau steht nur die kleine Zeile `today_no_level` (`lib/student-ui-i18n.ts:38`, `components/dashboard/home/TodayPlan.tsx:67`).
   - Ziel: Die Freigabe-Botschaft des Nutzers erscheint nach der Registrierung, nach der Bestätigung und als deutliche Karte „Freischaltung ausstehend“ auf Home.
   - Die UI duzt; die Formulierung wird angepasst.
   - Die Mail bei Freischaltung existiert bereits (`level_access_granted`, Migration 29).
8. **„Neu“:**
   - Nur die Medien haben `fresh` (erstellt in den letzten N Tagen, `lib/learning-status-server.ts:74-88`). Pro Person wird nicht gespeichert, was sie schon gesehen hat.
   - Neu nötig: eine Tabelle für Gesehen-Quittungen pro Person. Sie gilt für Lektionen, Pfade und Spezial-Pfade, Aussprachetexte, Medien, neu freigeschaltete Niveaus und Trainer.
   - Anzeige: Badge auf der Kachel und dem Modus-Tab, Punkt auf „Lernen“ in der unteren Leiste, Niveaukarte.
   - Bestandsdaten bei der Migration als gesehen markieren, damit nicht alles auf einmal „Neu“ zeigt.
9. **Brotkrumen:**
   - `components/layout/DashboardHeader.tsx`: Auf dem Handy stehen nur Zurück-Pille und aktuelle Seite, auf dem Desktop die volle Liste. Das Segment `level` wird übersprungen.
   - Die Routen-Schlüssel stehen in `lib/dashboard-i18n.ts:66` `DASHBOARD_ROUTE_KEYS`.
   - Ziel: überall der volle Pfad, zum Beispiel „Start › A1.1 › Vokabeln › Lernbox“, als Chip-Spur, die auf dem Handy horizontal scrollt und automatisch ans Ende springt, mit Icons und animiertem Einblenden.
10. **Varianten:**
    - Grammatik hat seit 3.4 ein Pflichtfeld `target_form`. Die Anzeige sieht so aus: `Как вас зовут? [heißen]`.
    - Alle 604 alten Aufgaben stehen auf `incomplete` und werden Lernenden nicht angezeigt.
    - Vokabel-Sätze haben `learning_vocabulary_cards.alternative_answers_de`.
    - Ziel: Mehrdeutige Aufgaben prüfen, Zielform oder Vorgabe anzeigen und typische Varianten systematisch akzeptieren (Satzstellung mit Inversion, `geht's`/`geht es`, `Tschüs`/`Tschüss`, Zahlen und Preise, du/Sie). Dazu kommen die Antwort-Einsprüche aus Punkt 5.
11. **Grammatik heute:**
    - Route `/dashboard/level/[level]/exercises`, `components/exercises/ExerciseClient.tsx` (Themenregal).
    - Seed `supabase/seeds/grammar-curriculum-2026.json`: 600 Aufgaben, je Niveau 100 in 10 Lektionen „A1.1 · 01“ bis „· 10“. Die Themen passen nicht zu den 7 Buchlektionen.
    - Nur `fill_in_blank` und `multiple_choice` sind bewertbar (`record_attempt`). Das Enum `public.exercise_type` kennt zusätzlich `sentence_building`.
    - Übersetzungen stehen in `public.grammar_translations(exercise_id, locale, hint, smart_hint, explanation, prompt)`.
    - Der Sprachschutz aus Migration 07 verbietet kyrillische und türkische Zeichen in deutschen Feldern.
    - Freigaben laufen über `learning_units` (`trainer` = `exercises`), `learning_trainer_grants` und `learning_unit_grants`, geprüft von `learning_private.unit_allowed`.
    - Bei deutscher Oberfläche sind die Trainer gesperrt (`TrainerLanguageRequired`, `lib/access/levels.ts:97`).
    - Lokales TTS (Piper) ist vorhanden (`lib/audio/neural-*`). Damit sind Höraufgaben möglich.
12. **Navigation und Home:**
    - Die untere Leiste ist `components/dashboard/StudentNavigation.tsx` (Start · Lernen · Kalender · Hilfe; CSS `.st-tabbar` in `student.css:175-196`).
    - ⚠️ Das Aufnahme-Dock der Aussprache nutzt `bottom: var(--st-tabbar-h)` und muss beim Ausblenden der Leiste mitwandern.
    - „Lernen“ springt zum zuletzt besuchten Niveau aus `localStorage` (`sitov:last-level`).
    - **Home ist heute nicht dynamisch:** `app/[lang]/dashboard/page.tsx` nimmt das *erste* Niveau mit 0 < Fortschritt < 100, nicht das zuletzt aktive. Ziel: eine RPC „zuletzt aktives Niveau“ auf Basis der letzten Antworten, Versuche und Aufnahmen; „Lernen“ nutzt sie ebenfalls.
    - Die Niveau-Seite `app/[lang]/dashboard/level/[level]/page.tsx` zeigt oben `LevelPath` (Vokabel-Stationen, im UI „Lernweg“ genannt) und unten `TrainerStatusTiles` (4 Bereiche). Genau das ist der Kritikpunkt.
    - ⚠️ **Namenskonflikt:** Der „Lernweg“ ist heute die Vokabel-Lektionsliste. Er wird zu „Lektionen“ im Tab Vokabeln umbenannt, „Lernpfad“ bezeichnet dann ausschließlich den Grammatik-Pfad.
    - Weitere Routen: `/vocabulary`, `/vocabulary/assess`, `/vocabulary/train`, `/pronunciation`, `/videos` (die Mediathek; `/media` leitet dorthin weiter).

## 4. Geplante Phasenstruktur des Prompts

| Phase | Chat | Inhalt |
|---|---|---|
| 0 | Bestandsaufnahme | `STATUS.md` anlegen, Prüfbericht S2 zu allen genannten Dateien, Test-Baseline, Design-Richtlinie als `docs/design/lernraum-designrichtlinie.md` ablegen. Keine Codeänderung. |
| 1 | Schnelle Korrekturen und Bewertung | Knopftausch an beiden Stellen, Groß-/Kleinschreibung und Zeichensetzung straffrei (Migration 30), Artikel-Hinweis und Artikel-Rückmeldung, Varianten-Audit mit Zielform und Alternativen, Registrierungsbotschaft und Karte „Freischaltung ausstehend“ |
| 2 | Navigation und Design-System | Modus-Dock (Vokabeln · Lernpfad · Aussprache · Mediathek) im Niveau-Layout, Niveau-Seite als Übersicht, Umbenennung „Lernweg“ → „Lektionen“, Brotkrumen mit vollem Pfad, untere Leiste mit Ausblenden beim Scrollen (Aufnahme-Dock wandert mit), Home nach zuletzt aktivem Niveau, Bewegungs-Tokens und Mikroanimationen |
| 3 | Lernpfad: Technik | Datenmodell, RPCs (R5), Aufgabentypen, Freischaltlogik, Tests, Pfadkarte, Ablösung der Route `/exercises` → `/path`, CMS zum Bearbeiten, Spezial-Zweige nur im Modell und in der Darstellung, Zurücksetzen |
| 4 | Lernpfad: Inhalt A1.1 | ChatGPT schreibt 7 Pfade und 7 Tests selbst nach dem Lernzielkatalog. JSON-Seed plus Importer plus Qualitätstests, Übersetzungen in 5 Sprachen, Sprachkorrektur. |
| 5 | Wörter mitnehmen | Tabelle, RPC-Anpassung, Station und einmalige Frage, Zurücksetzen, Tests |
| 6 | Benachrichtigungen | „Neu“-System, Schalter für Aussprache-Mails plus Nachweis plus Bündelung, Hinweis an die Lehrkraft „Niveau geschafft“ |
| 7 | Lehrer-Dashboard | Schülerseite mit Tabs, erweiterte Liste, Aktivitätsprotokoll mit Aufbewahrungsfrist, Einspruchs-Warteschlange, Pfad freischalten oder zurücksetzen, Datenschutzerklärung ergänzen |
| 8 | Abnahme | E2E auf Desktop, Pixel 7 und iPhone 14, axe ohne Filter, Leistung, Deployment, Dokumentation |

Abhängigkeiten: 0 → alle. 1 und 2 können unabhängig laufen. 3 → 4. 3 → 7 (Pfad-Einblicke). 2 → 3 (Dock-Slot). 5 und 6 kommen nach 2.

## 5. Getroffene Entscheidungen (im Prompt als verbindlich festschreiben, dem Nutzer nennen)

- **Niveau-Freischaltung bleibt bei der Lehrkraft** (bezahlte Kurse). Hat jemand ein Niveau abgeschlossen (alle 7 Tests bestanden), zeigt die App eine Feier. Die Lehrkraft erhält einen Hinweis „bereit für A1.2“ und schaltet mit einem Klick frei.
- **Lernpfad-Regeln:**
  - Knoten sind leistungsbasiert: Falsch beantwortete Aufgaben kommen am Knotenende wieder. Ein Knoten ist geschafft, wenn jede Aufgabe einmal richtig war. Sterne 1–3 nach der Trefferquote beim ersten Versuch.
  - Der Test wird frei, wenn alle Knoten geschafft sind. **Bestanden ab 80 %.**
  - Kein Zeitlimit und keine Hilfen im Test. Wiederholung sofort möglich.
  - Der Aufgabenpool ist mindestens doppelt so groß wie der Test, damit eine Wiederholung nicht identisch ist.
  - `SOFT_ERROR` zählt als richtig.
  - Jeder Knoten beginnt mit einer Merkkarte: Regel in der Oberflächensprache, deutsche Beispiele, Farbcode.
- **Richtwerte für ChatGPT:** 5–8 Übungsknoten pro Pfad mit je 6–10 Aufgaben (Sitzungen von 5–8 Minuten), ein Wiederholungsknoten vor dem Test, Test mit 12–16 Aufgaben, jedes Lernziel mindestens einmal geprüft. Kein Vorgriff auf Grammatik späterer Pfade.
- **Aufgabentypen:** `multiple_choice`, `fill_in_blank`, `multi_blank` (inklusive Formular und Visitenkarte), `sentence_building`, `matching`, `categorize`, `dialogue`, `listening` (lokales TTS), `transform`. Alle werden in PostgreSQL bewertet.
- **Datenmodell-Vorschlag:**
  - Pfad = `learning_units` (`trainer` = `exercises`, ein Pfad pro Lektion). So bleiben Freigaben und `unit_allowed` wirksam.
  - Neue Tabellen für Knoten (`kind`: practice | review | test | special, mit Verankerung für Zweige), Fortschritt pro Knoten und Testversuche mit einzelnen Antworten.
  - `learning_exercises` bekommt ein Knoten-Feld.
  - Die alten 10 Grammatik-Units je Niveau werden archiviert (`is_active=false`), nicht gelöscht.
  - Der interne Trainer-Code `exercises` bleibt, das UI heißt „Lernpfad“. `/exercises` leitet nach `/path` weiter.
- **Modus-Dock:** Reihenfolge Vokabeln · Lernpfad · Aussprache · Mediathek, jeder Modus mit eigener, zurückhaltender Farbe (kontrastgeprüft). Die Knopf-Regel R15 gilt für die ganze App.
- **Design-Richtlinie:** „Subtle Luxury, verspielt“. Tokens beibehalten.
  - Bewegungs-Tokens: 120/200/320/500 ms, Kurve `cubic-bezier(.22,1,.36,1)`, Framer-Feder, Staffelung 40 ms, nur `transform` und `opacity`.
  - Katalog der Mikroanimationen: Druck, Pille per `layoutId`, Linie zeichnet sich per SVG-Dash, Knoten-Pop, dezentes Wackeln bei Fehlern, Zähler zählt hoch, kleines Konfetti nur bei bestandenem Test.
  - Pfadkarte: S-Kurve, Knoten 64–72 px, Zustände gesperrt, verfügbar (sanftes Pulsieren), in Arbeit (Ring), geschafft (Haken und Sterne), Test als großer Wappen- oder Flaggen-Knoten, Lektions-Banner als „Insel“, Spezial-Zweige grün gestrichelt. Die Karte scrollt automatisch zum aktuellen Knoten, dazu ein schwebender Knopf „Weiter“.
  - Untere Leiste: Ausblenden nach mehr als 56 px Scroll plus 8 px Schwelle. Immer sichtbar oben auf der Seite, bei Fokus in der Leiste und bei offenem Blatt.

## 6. Lernzielkatalog A1.1 (eigene Zusammenfassung, ohne Buchtexte)

- **Pfad 1 – Kennenlernen**
  - Grammatik: Aussagesatz mit Verb auf Position 2; W-Fragen (wer, wie, woher, was); Präsens von kommen, heißen, sprechen und sein für ich, du und Sie (-e/-st/-en; du heißt, du sprichst); „Ich heiße / Mein Name ist“ ohne Frau oder Herr.
  - Kommunikation: Begrüßen und Verabschieden passend zur Tageszeit und am Telefon; Namen erfragen und nennen; buchstabieren; Herkunft (auch Länder mit Artikel, „aus der Türkei“); Sprachen („ein bisschen“); Entschuldigung; Bitten und Danken; Reaktionen (Wie bitte?, Einen Moment, Ich weiß es nicht); Sie oder du.
  - Kann-Ziele: Visitenkarte lesen, Anmeldeformular ausfüllen.
  - Wortschatz: 5 Länder, 5 Sprachen, Alphabet.
- **Pfad 2 – Familie und Angaben zur Person**
  - Grammatik: Possessivartikel mein/e, dein/e, Ihr/e im Nominativ; volles Präsens (leben, wohnen, lernen, kommen, heißen, sprechen, sein, haben).
  - Kommunikation: Befinden erfragen und beantworten mit Skala, auch „Und Ihnen/dir?“; andere vorstellen („Das ist/sind…“, „kommt aus“, „lebt in“); Geburtsort, Wohnort und Adresse (in + Stadt, in der + Straße); Telefonnummer; Familienstand; Kinder und Alter; „liegt in Nord-/Süddeutschland“, „Hauptstadt von“; Zahlen 0–20; Formular ausfüllen; Strategien (Na ja, Ja genau, Nein falsch).
  - Wortschatz: Familie, Familienstand.
- **Pfad 3 – Einkaufen**
  - Grammatik: Ja-/Nein-Frage mit Verb auf Position 1, im Vergleich zur W-Frage; ein/eine und kein/keine im Nominativ, Plural ohne Artikel bzw. mit „keine“; Pluralformen (Umlaut, -e, -er, -n, -s, keine Endung); möchte-Konjugation.
  - Kommunikation: Nachfragen („Wie heißt das auf Deutsch?“, „Das ist doch kein…“); Einkaufsdialog (helfen, „Ich hätte gern / Ich möchte“, „Haben Sie…?“, „Wie viel kostet/kosten…?“, „Sonst noch etwas? Das ist alles.“); Mengen (Gramm, Kilo, Pfund, Liter, Flasche, Packung, Becher, Dose); Preise sprechen („1,10 € = ein Euro zehn“); Einkaufszettel; einfaches Rezept lesen.
  - Wortschatz: 8 Sorten Obst und Gemüse, 5 Mengenangaben.
- **Pfad 4 – Wohnen**
  - Grammatik: der/das/die und Plural die (mit Farbcode); Personalpronomen er/es/sie/sie; Negation mit nicht oder kein.
  - Kommunikation: Gefallen („Wie gefällt/gefallen dir/Ihnen…?“ mit Skala); nach dem Ort fragen (hier/dort); beschreiben (teuer, Maße „60 mal 120 Zentimeter“, Farben); Telefonat zu einer Kleinanzeige (noch da? Größe, Alter, Preis, Adresse, zu Hause?); Strategien („…, nicht/oder/richtig?“, „Sag mal“, „Schau mal“); Zahlen bis 1 Million; Wohnungsanzeigen mit Abkürzungen.
  - Wortschatz: 5 Zimmer, 5 Möbel, Farben, Gegensatz-Adjektive.
- **Pfad 5 – Tagesablauf**
  - Grammatik: trennbare Verben mit Satzklammer (aufstehen, aufräumen, einkaufen, anrufen, fernsehen, anfangen, abholen), auch in der Ja-/Nein-Frage; Zeitangaben am, um, von…bis, aber „in der Nacht“; Konjugation von anfangen, arbeiten (e-Einschub wie finden und kosten), essen, fernsehen, schlafen; Inversion mit dem Verb auf Position 2.
  - Kommunikation: Uhrzeit offiziell und umgangssprachlich (halb, Viertel vor/nach, kurz vor/nach, gleich); Öffnungszeiten; Verabredung („Hast du Zeit?“, „Das passt gut“, „Da habe ich keine Zeit“); gern und nicht gern; Strategien (Stimmt, Ich glaube…); Wochentage und Tageszeiten.
  - Wortschatz: 5 Aktivitäten.
- **Pfad 6 – Freizeit und Wetter**
  - Grammatik: Akkusativ bestimmt (den), unbestimmt (einen) und negativ (keinen); ja – nein – doch; Vokalwechsel bei lesen, treffen, nehmen, fahren (auch fernsehen, essen, sprechen, schlafen, anfangen).
  - Kommunikation: Hobbys („Das macht Spaß“, „Ich finde… toll“); Lieblings…; Wetter (Sonne, Regen, Schnee, windig, bewölkt, Grad, Lieblingswetter, „mag ich gar nicht“); Bestellen am Imbiss; zustimmen und verneinen; Strategien (Guck mal, Na klar, Kein Problem, Moment mal); Wetterbericht, Kurzporträts, Interviews.
  - Wortschatz: 5 Hobbys, 7 Wetterwörter.
- **Pfad 7 – Können, Wollen, Vergangenheit**
  - Grammatik: können und wollen (ich und er ohne Endung), Modalverb-Klammer; Perfekt mit haben (ge…t, auch gearbeitet; ge…en mit Vokalwechsel), Perfekt mit sein bei Bewegung (gehen, fahren, kommen), Satzklammer im Perfekt.
  - Kommunikation: Wunsch („Ich will…“); Vorschlag („Wollen wir…?“); Fähigkeit mit Abstufung; sich oder das Kind entschuldigen (krank, kann nicht kommen) und darauf reagieren („Gute Besserung“, „Ich sage es der Lehrerin“); Strategien (Ja super, Nein nicht so gern, Schade); über gestern, früher und das Wochenende sprechen.
  - Wortschatz: 5 Wörter zum Thema Schule, 5 Aktivitäten im Deutschkurs, 5 Freizeitaktivitäten.

Offen zu prüfen (DB auf dem VPS): Hat A1.1 genau 7 Vokabel-Lektionen, sodass Pfad n zu Lektion n passt?

## 7. Nächster Schritt

`MASTER-PROMPT-4.md` im Repo-Stamm nach den Abschnitten 2–6 schreiben:
- Kopf mit Startsätzen pro Chat
- Rolle, Kontext und Umgebung
- Regeln R1–R16
- Design-Richtlinie
- Phasen 0–8, jeweils mit Befund, Aufgaben (`[ ]`), messbaren Abnahmekriterien und Übergabe
- Ablauf S1–S7

Danach: Datei an den Nutzer senden und die Entscheidungen aus Abschnitt 5 nennen. Nicht committen, ohne zu fragen.
