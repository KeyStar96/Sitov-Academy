# MASTER-PROMPT 4.0 — Sitov Academy: Lernpfad, Lernraum und Lehrer-Einblick

Übergabefertig für ChatGPT 6 Astra. **Jede Phase läuft in einem eigenen Chat.** Der gesamte Prompt wird in jedem Chat vollständig gelesen, ausgeführt wird nur die genannte Phase.
Grundlage ist eine Recherche der realen Codebase am 25.09.2026 (Zweig `codex/vps-self-hosted`, Stand `19e9a37`). Die Befunde stehen ausführlich in `docs/master-4/ZWISCHENBERICHT.md`.
Alle Entscheidungen sind getroffen. Es gibt keine offenen Fragen. Wo dieser Prompt dir Freiheit lässt, steht das ausdrücklich dabei.

Dieser Prompt setzt `CODEX.md` (Master-Prompt 3.0) fort. Dessen Regeln R1–R11 und der Ablauf S1–S7 gelten weiter und stehen unten in aktualisierter Form. Was in 3.0 abgehakt ist, fasst du nicht erneut an, außer eine Aufgabe hier verlangt es.

---

## SO STARTEST DU EINEN CHAT

Der erste Satz in jedem neuen Chat lautet:

> **Lies `MASTER-PROMPT-4.md` vollständig und führe ausschließlich Phase N aus.**

| Phase | Chat | Voraussetzung |
|---|---|---|
| 0 | Bestandsaufnahme und Design-Richtlinie | – |
| 1 | Schnelle Korrekturen und Bewertung | 0 |
| 2 | Navigation und Design-System | 0 |
| 3 | Lernpfad: Technik | 2 |
| 4 | Lernpfad: Inhalte A1.1 | 3 |
| 5 | Wörter mitnehmen | 2 |
| 6 | Benachrichtigungen und „Neu“ | 2 (für die Pfad-Einträge zusätzlich 3) |
| 7 | Lehrer-Dashboard | 3 |
| 8 | Abnahme und Auslieferung | 1–7 |

Empfohlene Reihenfolge: 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Phase 1 und Phase 2 berühren sich nicht und dürfen getauscht werden.

**Übergabe zwischen den Chats:** Ein Chat weiß nichts vom vorherigen. Deshalb gilt:
1. Zu Beginn liest du `docs/master-4/STATUS.md` (legt Phase 0 an). Steht dort, dass eine Voraussetzung fehlt, brichst du ab und meldest das.
2. Am Ende schreibst du deinen Abschnitt in `STATUS.md`: erledigt, offen mit Begründung, Abweichungen vom Prompt, belegte Migrationsnummern, Testzahlen, Release-Revision, Hinweise für die nächste Phase.
3. Du hakst in diesem Prompt nur ab, was ein automatisierter Test belegt (S4). Der Prompt ist zugleich die Checkliste.

---

## ROLLE & MISSION

Du arbeitest als autonomer Lead Fullstack Engineer, Datenbank-Architekt, Didaktiker für Deutsch als Zweitsprache und Mobile-UX-Designer für die Sprachlernplattform „Sitov Academy“.

Die Lernenden sind überwiegend **Erwachsene und ältere Menschen**, die Deutsch neu lernen. Ihre Oberflächensprache ist Russisch, Ukrainisch, Türkisch oder Englisch. Viele lernen am Smartphone. Jede Entscheidung misst sich daran, ob eine 65-jährige Person mit Lesebrille sie ohne Hilfe versteht.

Ziele dieses Auftrags:
1. Die Kritikpunkte der Lehrerin aus dem Unterricht beheben.
2. Die Grammatikübungen vollständig durch einen **Lernpfad** ersetzen: sieben aufeinander aufbauende Pfade für A1.1, jeder mit Abschlusstest. Die Aufgaben schreibst du selbst.
3. Den Lernraum so ordnen, dass man jederzeit weiß, wo man ist, und dass er Freude macht.
4. Der Lehrkraft einen genauen Einblick geben, was ihre Lernenden tun.

---

## KONTEXT & UMGEBUNG

**Stack (verifiziert):** Next.js 16.3.5 · React 19.2.8 · Tailwind 3.4 · TypeScript · Zod 4 · Framer Motion 12 · lucide-react · selbst gehostetes Supabase (Postgres 15.8) auf einem STRATO-VPS.

⚠️ **Next.js 16 ist nicht das Next.js aus deinen Trainingsdaten.** Lies vor jeder Codeänderung die passende Anleitung in `node_modules/next/dist/docs/` (siehe `AGENTS.md`). Die Middleware heißt `proxy.ts`.

**Git:**
* Produktionszweig ist `codex/vps-self-hosted`. Du arbeitest und pushst nur dort.
* Andere Agenten (zum Beispiel Gemini) committen auf demselben Zweig. Vor Beginn `git pull`, fremde neue Commits lesen, am Ende nichts gestaged oder ungesichert liegen lassen.
* Commit-Stil wie bisher: `feat(bereich): Beschreibung auf Deutsch`, `fix(...)`, `docs(...)`.

**Deployment:**
* Code wird lokal bearbeitet und gepusht. Auf dem VPS (`ssh sitov-academy`, Repo `/var/www/sitov-academy`) wird gebaut und aktiviert.
* Ohne Schemaänderung: `deploy/vps/deploy-release.sh`.
* Mit Schemaänderung, genau in dieser Reihenfolge:
  1. `deploy/vps/deploy-release.sh --prepare-only`
  2. `python3 deploy/vps/migrate-local.py --apply NN_x.sql --keep-stopped` (legt dabei auch das Backup nach R8 an)
  3. `deploy/vps/deploy-release.sh --activate <rev12> --schema-changed`
* Danach `/api/health` muss `ready` melden; App, Mail-Worker und nginx aktiv.

**Migrationen:**
* Neue Dateien heißen `supabase/vps/NN_modul.sql`. Stand 25.09.2026 ist die letzte `29_student_level_access_notification.sql`, **die nächste freie Nummer ist 30**. Nummern werden nicht vorab reserviert: Jede Phase nimmt die nächste freie Nummer laut `ORDER` in `deploy/vps/migrate-local.py` und trägt sie in `STATUS.md` ein.
* Jede neue Datei kommt in die `ORDER`-Liste von `deploy/vps/migrate-local.py`. Der Test dafür ist `deploy/vps/tests/test_migrate_local.py`.
* Zu jeder Migration gehört eine Rückweg-Datei `supabase/vps/rollback/NN_*.sql`.
* Kein `BEGIN`/`COMMIT` in der Datei (der Runner klammert selbst), jede Anweisung idempotent.
* ⚠️ Ein neuer Enum-Wert (`ALTER TYPE … ADD VALUE IF NOT EXISTS`) kann in derselben Transaktion nicht benutzt werden. Deshalb steht jede Enum-Erweiterung in einer **eigenen, vorgeschalteten Migration**. Vorbild: `26_mail_signup_kind.sql` vor `27_…`.
* Wer eine bestehende RPC ändert, legt eine neue Migration an und kopiert den Funktionskörper aus der Migration, die sie **zuletzt** definiert hat:
  * `learning_private.grade_answer` → `06_soft_errors.sql`
  * `grammar_private.record_attempt` → `06_soft_errors.sql`
  * `vocabulary_private.submit_answer`, `submit_self_rating`, `check_retry` → `22_vocabulary_phase6_rules.sql`
  * Vor dem Kopieren mit `grep -n "FUNCTION <name>" supabase/vps/*.sql` prüfen, ob eine spätere Migration sie erneut definiert.
* `supabase/schema.sql` ist Dokumentation und hinkt hinterher. Maßgeblich sind die Migrationen.

**Tests:**
* App: `npm test` (Jest), `node_modules/.bin/tsc --noEmit`.
* Datenbank: `node --test supabase/tests/*.test.mjs`. ⚠️ `createPhase3Database()` spielt Migrationen nur bis `06` ein. Tests für spätere Migrationen spielen ihre Migrationen selbst nach; Vorbild ist `supabase/tests/level-access-notification.test.mjs`.
* Browser: `npx playwright test` (Konfigurationen in `e2e/*.config.ts`), Barrierefreiheit mit `e2e/accessibility.spec.ts`.
* Build: `npm ci`, dann `NODE_OPTIONS=--max-old-space-size=3072 npm run build` mit Platzhalter-Umgebungsvariablen (`NEXT_PUBLIC_SITE_URL`, `SITE_URL`, Supabase-Keys, `TRUSTED_PROXY_HOPS=1`).
* Migrationsrunner: `python3 -m pytest deploy/vps/tests`.

**Styling:**
* `--accent` (orange-500) nur für Flächen, Ränder und Punkte, **nie für Text**. Text in Akzentfarbe nutzt `--accent-text`. Knöpfe nutzen `--accent-strong` mit weißer Schrift.
* ⚠️ Tailwind 3 erzeugt für `bg-[var(--x)]/10` und `bg-accent/10` **nichts**. Stattdessen `bg-[color-mix(in_srgb,var(--x)_10%,transparent)]`.
* Geteilte Klassen in `app/globals.css` (`.sl-glass`, `.sl-card`, `.sl-chip`, `.sl-icon-tile`, `.sl-bar`, `.sl-hero`). Lernenden-Oberfläche: `st-*` in `components/dashboard/student.css`. Lernbildschirme: `learning-*` in `components/vocabulary/learning.css`.

**Sprachen:** Die Oberfläche gibt es in `de`, `en`, `ru`, `uk`, `tr`. Texte stehen in `dictionaries/*.json` sowie in `lib/*-i18n.ts`. Die Lernenden-Oberfläche **duzt**. Bei deutscher Oberfläche sind die Trainer gesperrt (`TrainerLanguageRequired`, `lib/access/levels.ts`), weil Erklärungen in der Muttersprache gebraucht werden.

**Dateikarte (die wichtigsten Orte):**

| Bereich | Orte |
|---|---|
| Vokabel-Lernen | `components/vocabulary/VocabCardSession.tsx`, `app/[lang]/dashboard/level/[level]/vocabulary/assess/LessonAssessmentClient.tsx`, `app/actions/vocabulary.ts`, `lib/vocabulary-box.ts`, `lib/vocabulary-ui.ts` |
| Vokabel-Lektionen („Lernweg“) | `components/dashboard/LevelPath.tsx`, `getVocabularyOverview` in `app/actions/vocabulary.ts`, `lib/learning-status-server.ts` |
| Grammatik heute | Route `app/[lang]/dashboard/level/[level]/exercises/`, `components/exercises/ExerciseClient.tsx`, `components/exercises/SoftErrorBadge.tsx`, `lib/grammar-validation.ts`, `components/admin/ExerciseCMS.tsx`, Seed `supabase/seeds/grammar-curriculum-2026.json` |
| Niveau-Seite | `app/[lang]/dashboard/level/[level]/page.tsx` und `layout.tsx`, `TrainerStatusTiles` |
| Home | `app/[lang]/dashboard/page.tsx`, `components/dashboard/home/*` (u. a. `TodayPlan.tsx`, `LevelCard.tsx`) |
| Navigation | `components/dashboard/StudentNavigation.tsx`, `components/layout/DashboardHeader.tsx`, `lib/dashboard-i18n.ts` (`DASHBOARD_ROUTE_KEYS`) |
| Aussprache | Route `…/pronunciation`, `app/actions/pronunciation-conversations.ts` |
| Mediathek | Route `…/videos` (`…/media` leitet dorthin) |
| Profil | `app/[lang]/dashboard/profile/page.tsx`, `components/dashboard/ProfileSettings.tsx` |
| Registrierung | `lib/auth-i18n.ts`, `lib/student-ui-i18n.ts` |
| Lehrkraft | `app/[lang]/admin/students/page.tsx`, `components/admin/StudentList.tsx`, `StudentDetailModal.tsx`, `TeacherAnalytics.tsx`, `lib/admin-navigation.ts` |
| Mail | `lib/mail/templates.mjs`, `lib/mail/worker.mjs`, `public.queue_transactional_email`, `private.mail_outbox` |
| Zurücksetzen | `reset_student_level_progress`, `lib/learning-reset-events.ts` |
| Vorlese-Stimme | lokales Piper-TTS in `lib/audio/neural-*` |

---

## BEGRIFFE (verbindlich)

Dieselben Wörter bedeuten im Code, in der Oberfläche und in diesem Prompt dasselbe.

* **Phase N** meint immer einen Arbeitsabschnitt dieses Prompts.
* **Lernbox** ist der Vokabel-Karteikasten. Er hat sechs **Fächer** (1–6) und das Archiv „gelernt“ (`box_number` 7). Die „Phasenverteilung“ der Lehrerin ist die Verteilung auf diese Fächer.
* **Niveau** ist eine Stufe wie A1.1 oder A1.2 (`learning_levels`, Reihenfolge über `sort_order`).
* **Lektionen** (bisher „Lernweg“) ist die Liste der Vokabel-Lektionen eines Niveaus mit ihren Stationen im Modus Vokabeln.
* **Lernpfad** ist ausschließlich der neue Grammatik- und Kommunikations-Pfad. Er ersetzt die Grammatikübungen.
* Ein **Pfad** ist ein Abschnitt des Lernpfads, einer pro Buchlektion. A1.1 hat Pfad 1 bis 7.
* Ein **Knoten** ist ein Halt auf dem Pfad: Übung, Wiederholung, Test oder Spezial.
* Ein **Spezial-Zweig** ist ein grüner, optionaler Nebenweg, den später die Lehrerin anlegt.
* Die vier **Modi** eines Niveaus sind Vokabeln, Lernpfad, Aussprache und Mediathek. Das **Modus-Dock** ist die Tab-Leiste, die sie verbindet.
* **Mitnehmen** heißt: offene Wörter früherer Niveaus im aktuellen Niveau weiterlernen.
* **Offen** ist eine Vokabel, die begonnen, aber noch nicht gelernt ist, also mindestens eine Richtung in Fach 1–6.

---

## GRUNDREGELN — gelten in ALLEN Phasen, ohne Ausnahme

* **R1 — ERST PRÜFEN, DANN HANDELN.** Bevor du eine Datei löschst, umbenennst oder eine Konfiguration änderst, prüfst du, dass sie existiert und dass du ihren Inhalt verstanden hast. Findest du eine genannte Datei nicht, hakst du die Aufgabe als `[N/A — nicht vorhanden]` ab und meldest das. Erfinde nichts. Zeilennummern in diesem Prompt sind Stand 25.09.2026 und können sich verschoben haben.
* **R2 — KEIN SPEICHERÜBERLAUF.** Der VPS hat 8 GB RAM und ist knapp budgetiert (Aufstellung in `docs/phase-4-verification.md`). Kein Speicherlimit wird erhöht, ohne ein anderes zu senken, und nur mit vollständiger Summenrechnung im Bericht. Neue Hintergrunddienste sind in diesem Auftrag nicht nötig und nicht erlaubt.
* **R3 — KEINE EXTERNEN DIENSTE.** Die App darf keine ausgehenden Verbindungen aufbauen (`IPAddressDeny=any` in `deploy/vps/sitov-app.service`). Keine CDNs, keine externen Schriften, Animations- oder Audio-Dienste, keine Push-Anbieter. Mails laufen nur über den vorhandenen Mail-Worker, Sprachausgabe nur über das lokale Piper-TTS.
* **R4 — TOTER CODE NUR MIT NACHWEIS.** Eine Datei gilt erst als tot, wenn sie weder statisch noch über `dynamic(() => import(...))` oder `React.lazy` von einer Route erreichbar ist. Abgelöste Funktionen werden erst gelöscht, wenn der Ersatz produktiv läuft.
* **R5 — KEINE BEWERTUNG IM CLIENT.** Richtig, falsch, Punkte, Sterne, Fach, Termin, Testergebnis und Freischaltung entscheidet ausschließlich PostgreSQL (`SECURITY DEFINER`, `SET search_path TO ''`). Der Client zeigt Ergebnisse an. **Lösungen erreichen den Client erst nach der Bewertung**, im Test erst nach Abschluss.
* **R6 — TESTS DÜRFEN NICHTS AUSBLENDEN.** Ein Test, der eine Anforderung per Filter, Whitelist oder `skip` umgeht, ist ein Fehler im Test. Entferne den Filter, statt ihn zu erweitern.
* **R7 — JEDE DDL IST IDEMPOTENT.** Neue DDL steht in `supabase/vps/NN_modul.sql` und lässt sich beliebig oft ausführen. Danach werden `supabase/schema.sql` (Dump vom VPS) und `supabase/database.types.ts` aktualisiert.
* **R8 — BACKUP VOR JEDER DB-ÄNDERUNG.** Über `deploy/vps/migrate-local.py` (bei `--apply` automatisch, sonst `--backup-only`). SHA256 von Datenbank-Dump und Storage-Manifest stehen im Bericht.
* **R9 — ROLLBACK-PLAN.** Jede Migration hat eine Rückweg-Datei unter `supabase/vps/rollback/`. Kein Bruch ohne Rückweg. Bestandsdaten werden archiviert (`is_active = false`), nicht gelöscht.
* **R10 — FEHLER SIND EXPLIZIT.** Jede RPC gibt bei Fehlern strukturiertes JSONB zurück, mindestens `{"error": "<code>", "message": "<text>"}`. Die Oberfläche übersetzt `error`-Codes in allen fünf Sprachen. Nichts wird still verschluckt.
* **R11 — ENUM STATT CHECK.** Wiederkehrende Wertemengen (Knotenart, Status, Ereignisart …) werden `CREATE TYPE … AS ENUM`, nie `CHECK`.
* **R12 — FÜNF SPRACHEN, IMMER GLEICHZEITIG.** Jeder neue Text entsteht in `de`, `en`, `ru`, `uk` und `tr` im selben Commit. `__tests__/translation-integrity.test.ts` muss grün bleiben (exakt gleiche Schlüsselstruktur). Übersetzungen sind natürlich formuliert, nicht wörtlich. Russisch und Ukrainisch werden nie vermischt.
* **R13 — BARRIEREFREI FÜR ÄLTERE MENSCHEN.**
  * Touch-Ziele mindestens 48 × 48 px, Hauptaktionen 56 px hoch.
  * Lernschrift mindestens 18 px, Fließtext mindestens 16 px, Zeilenhöhe mindestens 1,5.
  * Kontrast WCAG AA: Text 4,5 : 1, Bedienelemente und Ränder 3 : 1, in hellem und dunklem Design.
  * Jede Animation respektiert `prefers-reduced-motion`. Nichts blinkt, nichts läuft von selbst länger als 5 Sekunden.
  * Keine Zeitlimits, keine Wisch-Pflicht, kein Ziehen als einzige Bedienung: Alles geht auch mit Tippen und Tastatur.
  * Farbe ist nie der einzige Träger einer Information (immer auch Symbol oder Text).
  * axe-core läuft ohne Filter und ohne Ausnahmen.
* **R14 — KEINE LEHRBUCHINHALTE.** Die Lernziele stammen aus einem Lehrwerk. Übernommen werden nur die **Lernziele**, nie Sätze, Dialoge, Figurennamen, Firmennamen, Bilder, Seitenzahlen, Grammatik-Verweise oder der Buchtitel. Jeder Beispielsatz, jede Person und jede Situation ist neu erfunden (siehe auch `CODEX.md` 7.3).
* **R15 — POSITIVE AKTION RECHTS.** In jeder Knopfgruppe der App steht die primäre bzw. positive Aktion rechts, die sekundäre bzw. negative links: „Wusste ich nicht | Wusste ich“, „Abbrechen | Speichern“, „Nein, danke | Mitnehmen“. Auf schmalen Bildschirmen, wo Knöpfe untereinander stehen, steht die primäre Aktion unten, näher am Daumen. Tastaturkürzel und Wischgesten folgen derselben Seite.
* **R16 — DATENSPARSAMKEIT.** Es wird nur erfasst, was die Lehrkraft für die Betreuung braucht. Jede neue Erfassung hat eine festgelegte Aufbewahrungsfrist mit automatischer Löschung, steht in der Datenschutzerklärung (fünf Sprachen) und wird den Lernenden im Profil in einem Satz erklärt. Keine Protokollierung von Tastenanschlägen, Mausbewegungen oder Standort. Personenbezogene Daten gehören nicht in Logs, Berichte oder Commit-Nachrichten.

---

## DESIGN-RICHTLINIE „Subtle Luxury, verspielt“

Phase 0 legt diese Richtlinie als `docs/design/lernraum-designrichtlinie.md` ab, mit Beispielen aus dem echten Code. Alle folgenden Phasen halten sich daran. Wo eine Phase etwas Neues gestaltet, gilt: **erst die Richtlinie, dann eigene Ideen.**

### D1 — Haltung
* Der bestehende Stil „Subtle Luxury“ bleibt: ruhige Flächen, viel Weißraum, Glas-Karten, warmes Orange als Marke, Slate als Grundton. Neu kommt **Verspieltheit** hinzu: Dinge reagieren auf Berührung, Fortschritt fühlt sich wie ein Weg an, Erfolge werden kurz gefeiert.
* Verspielt heißt nicht kindlich. Keine Comicfiguren, keine grellen Farben, keine Geräusche ohne Zustimmung, keine Punkte-Jagd mit Druck. Die Zielgruppe sind Erwachsene.
* Jeder Bildschirm beantwortet drei Fragen sofort: **Wo bin ich? Was kann ich hier tun? Was ist der nächste Schritt?**

### D2 — Farben
* Bestehende Tokens bleiben. Keine neuen Hex-Werte im Komponenten-Code, nur Tokens.
* Jeder Modus bekommt eine eigene, zurückhaltende Kennfarbe als Token-Paar (Fläche und Text), in beiden Designs kontrastgeprüft:
  * Vokabeln: Marken-Orange (`--accent` / `--accent-text`)
  * Lernpfad: ruhiges Blau (Pfadknoten sind laut Skizze blau)
  * Aussprache: gedämpftes Violett
  * Mediathek: gedämpftes Petrol
  * Spezial-Zweige: Grün, ausschließlich für diese
* Die Kennfarbe erscheint im aktiven Tab, im Kopf der Modus-Seite und als feiner Akzent auf Karten, nie als großflächiger Hintergrund.
* `__tests__/appearance-contrast.test.ts` wird um alle neuen Tokens erweitert.

### D3 — Typografie und Größen
* Lernschrift ≥ 18 px, Aufgabenstellung ≥ 20 px, deutsche Zielsätze in Aufgaben ≥ 22 px.
* Höchstens zwei Schriftgewichte pro Karte. Keine Versalien-Absätze.
* Karten-Innenabstand ≥ 16 px auf dem Handy, Eckenradius 20–24 px für Karten, 999 px für Pillen.

### D4 — Bewegung (Tokens)
In `app/globals.css` als CSS-Variablen und in `lib/motion.ts` für Framer Motion:

| Token | Wert | Einsatz |
|---|---|---|
| `--motion-fast` | 120 ms | Druck, Hover, Fokus |
| `--motion-base` | 200 ms | Tabs, Chips, kleine Wechsel |
| `--motion-slow` | 320 ms | Karten, Blätter, Seitenteile |
| `--motion-slower` | 500 ms | Pfadlinie, Feier |
| `--ease-out-soft` | `cubic-bezier(.22,1,.36,1)` | Standardkurve |
| Feder (Framer) | `stiffness 420, damping 34` | Pillen, Knoten-Pop |
| Staffelung | 40 ms pro Element, höchstens 8 Elemente | Listen, Brotkrumen |

* Animiert werden nur `transform` und `opacity`. Keine Layout-Animation über Höhe oder Breite außer über Framer `layout`.
* Bei `prefers-reduced-motion: reduce` entfällt Bewegung. Zustände wechseln sofort oder mit reinem Überblenden (≤ 120 ms).

### D5 — Katalog der Mikroanimationen
Nur diese Muster, damit alles wie aus einem Guss wirkt:
1. **Druck:** Knöpfe und Kacheln skalieren beim Antippen auf 0,97.
2. **Wandernde Pille:** Aktiver Tab und aktiver Umschalter per `layoutId`.
3. **Linie zeichnet sich:** Pfadlinien und Fortschrittsringe per SVG `stroke-dashoffset`.
4. **Knoten-Pop:** Geschaffter Knoten federt einmal auf 1,08 und zurück, Haken zeichnet sich.
5. **Sanftes Wackeln bei Fehler:** Eingabefeld 320 ms seitlich (±4 px), dazu Text und Symbol. Nie rot blinken.
6. **Zähler zählt hoch:** Zahlen auf Karten zählen beim ersten Erscheinen in 500 ms hoch.
7. **Gestaffeltes Einblenden:** Listen und Brotkrumen erscheinen nacheinander von 8 px unten.
8. **Feier:** Kleines Konfetti aus Markenfarben, höchstens 1,2 s, **nur** bei bestandenem Test und abgeschlossenem Niveau.
9. **Neu-Puls:** Der Punkt am „Neu“-Badge pulsiert beim ersten Anzeigen zweimal, dann ruht er.

### D6 — Modus-Dock
* Die vier Modi eines Niveaus sind oben angeheftet, direkt unter dem Seitenkopf, in fester Reihenfolge: **Vokabeln · Lernpfad · Aussprache · Mediathek**.
* Jeder Tab hat Symbol **und** Beschriftung (keine reinen Symbole), mindestens 48 px hoch. Auf dem Handy teilen sich die vier Tabs die volle Breite.
* Der aktive Tab trägt eine Pille in seiner Kennfarbe, die beim Wechsel per `layoutId` zum neuen Tab wandert. Der Inhalt blendet mit `AnimatePresence mode="wait"` über und gleitet 8 px in Wechselrichtung.
* Kleine Zähler am Tab: fällige Karten (Vokabeln), „Neu“ (alle Modi), ungelesene Antworten der Lehrkraft (Aussprache).
* Gesperrte Modi bleiben sichtbar, mit Schloss und einem Satz, warum („Deine Lehrkraft schaltet diesen Bereich frei.“ bzw. der Hinweis zur Oberflächensprache).
* Das Dock bleibt beim Scrollen oben kleben. Es ist ein `nav` mit `aria-label`, der aktive Tab hat `aria-current="page"`.

### D7 — Brotkrumen
* Immer der **volle Pfad**, auch auf dem Handy, zum Beispiel: `Start › A1.1 › Vokabeln › Lernbox` oder `Start › A1.1 › Lernpfad › Pfad 3 › Test`.
* Darstellung als Chip-Spur: jedes Glied ein Chip mit kleinem Symbol, Trenner als dezenter Pfeil. Das letzte Glied ist hervorgehoben und nicht verlinkt (`aria-current="page"`).
* Auf dem Handy scrollt die Spur waagerecht und springt beim Laden ans Ende. An den Rändern zeigt ein Verlauf, dass es weitergeht.
* Beim Seitenwechsel erscheinen neue Glieder gestaffelt (D5 Nr. 7), gleich bleibende Glieder bewegen sich nicht.
* Semantik: `nav aria-label` + `ol`.

### D8 — Untere Leiste (Handy)
* Beim Runterscrollen fährt sie nach unten weg, beim Hochscrollen kommt sie sofort zurück.
* Schwellen: Ausblenden erst ab 56 px Scrolltiefe und nach mindestens 8 px Bewegung in eine Richtung, damit nichts zittert.
* Immer sichtbar: ganz oben auf der Seite, wenn ein Element in der Leiste den Fokus hat, wenn ein Blatt oder Dialog offen ist, und am Seitenende.
* Bei offener Bildschirmtastatur ist sie ausgeblendet.
* Alles, was sich an ihr ausrichtet (vor allem das Aufnahme-Dock der Aussprache mit `bottom: var(--st-tabbar-h)`), wandert mit, ohne Sprung und ohne verdeckt zu werden.
* Der Punkt „Neu“ am Tab „Lernen“ ist auch bei ausgeblendeter Leiste nicht verloren: Er erscheint wieder, sobald die Leiste zurückkommt.

### D9 — Lernpfad-Karte
Die Skizze der Lehrerin zeigt einen gewundenen Weg aus blauen Aufgabenknoten, gepunktet verbunden, der zu „Test L1“ führt. Danach folgt das Banner „Lektion 2“ und der Weg geht weiter. Grüne „Special“-Zweige gehen seitlich ab. Daraus:
* Der Weg ist eine sanfte S-Kurve von oben nach unten. Die Linie zwischen den Knoten ist gepunktet; geschaffte Strecken sind durchgezogen und zeichnen sich beim Abschluss nach (D5 Nr. 3).
* Knoten sind Kreise von 64–72 px mit Symbol und kurzer Beschriftung darunter. Zustände:
  * **gesperrt:** grau, Schloss, nicht antippbar, aber mit Erklärung beim Antippen
  * **verfügbar:** Kennfarbe Blau, pulsiert beim Erscheinen dreimal sanft und trägt danach einen ruhenden Ring (R13: nichts bewegt sich länger als 5 Sekunden; bei reduzierter Bewegung nur der Ring)
  * **in Arbeit:** Fortschrittsring um den Knoten
  * **geschafft:** Haken und 1–3 Sterne
* Der **Test** ist ein größerer Knoten (88 px) in Wappen- oder Flaggenform. Bestanden: Flagge und Prozentwert.
* Jede Lektion beginnt mit einem **Banner als „Insel“**: Nummer, Titel, Kann-Ziele in einem Satz. Gesperrte Inseln sind blass und nennen die Bedingung („Nach bestandenem Test von Pfad 2“).
* **Spezial-Zweige** gehen grün gestrichelt seitlich vom Ankerknoten ab. Sie blockieren nichts.
* Beim Öffnen scrollt die Karte weich zum aktuellen Knoten. Ein schwebender Knopf „Weiter“ springt zum nächsten offenen Knoten und startet ihn.
* Die Karte ist auch ohne Maus und Bildschirm verständlich: Jeder Knoten ist ein Link mit vollständiger Beschreibung („Pfad 2, Knoten 3: Possessivartikel, geschafft, 2 von 3 Sternen“).

### D10 — Das „Neu“-Zeichen
* Eine kleine Pille „Neu“ in Akzentfläche mit weißer Schrift plus Punkt, oben rechts an Kachel, Tab oder Niveaukarte. Am Tab „Lernen“ der unteren Leiste nur der Punkt.
* Verschwindet, sobald die Person den Inhalt geöffnet hat, und nicht früher.

### D11 — Rückmeldung beim Antworten
* **Richtig:** grüner Haken, kurzer Pop, positives Wort, weiter mit einem großen Knopf rechts bzw. unten.
* **Richtig mit Schreibhinweis** (Umlaut, Tippfehler): wie richtig, dazu die korrekte Schreibweise mit markierter Stelle. Gelb (`--warning`) nur für diesen Fall.
* **Neutraler Hinweis** (Groß-/Kleinschreibung, Zeichensetzung): wie richtig, ohne Warnfarbe, nur „So schreibt man es: …“.
* **Falsch:** kein Rot als Fläche. Sanftes Wackeln, die richtige Lösung groß, eine Erklärung in der Oberflächensprache, wenn es eine gibt (zum Beispiel „Der Artikel fehlt“).

### D12 — Knöpfe
* R15 gilt überall. Die primäre Aktion ist gefüllt (`--accent-strong`), die sekundäre umrandet.
* Nie zwei gefüllte Knöpfe nebeneinander.
* Ladezustände zeigen einen Drehkreis im Knopf, der Knopf behält seine Breite.

### D13 — Verboten
Rote Vollflächen für Fehler · Countdown-Uhren · Ranglisten mit Namen anderer Lernender · Zufallsbelohnungen · automatisch abspielender Ton · Animationen über 500 ms außer der Feier · reine Symbolknöpfe ohne Beschriftung in der Lernenden-Oberfläche · externe Schriften und Bilder.

---

## PHASE 0 — BESTANDSAUFNAHME UND DESIGN-RICHTLINIE

**Ziel:** Eine gesicherte Ausgangslage, damit jede spätere Phase auf geprüften Fakten aufsetzt. **Keine Codeänderung in dieser Phase**, nur Dokumente.

#### 0.1 Status-Datei
* [ ] `docs/master-4/STATUS.md` nach der Vorlage in Anhang B anlegen.
* [ ] Aktuelle Revision, letzte Migration, nächste freie Nummer und laufendes Release (`/api/health`, aktive Revision auf dem VPS) eintragen.

#### 0.2 Prüfbericht (S2) über alle Befunde
* [ ] Für jede Datei, Funktion, Tabelle und Spalte, die dieser Prompt nennt, eine Zeile `Ort | Erwartet | Gefunden | Delta`. Grundlage sind die Befunde in `docs/master-4/ZWISCHENBERICHT.md` Abschnitt 3.
* [ ] Auf dem VPS nur lesend prüfen:
  * Wie viele Vokabel-Lektionen hat A1.1, und passen sie der Reihe nach zu den sieben Lehrbuch-Lektionen? (Wichtig für die Wortschatz-Zuordnung in Phase 4.)
  * Wie viele Grammatik-Units und Aufgaben gibt es je Niveau, wie viele sind `incomplete`?
  * Welche Werte hat `public.exercise_type`?
  * Wie ist `learning_exercises.content` heute eingeschränkt (Constraint aus 2.6)?
  * Welche Spalten haben `private.mail_outbox`, `profiles`, `learning_units`, `learning_vocabulary_cards`?
  * Liefert der heutige Grammatik-Trainer die Lösungen (`accepted_answers`) vor der Antwort an den Browser aus? (Maßgeblich für R5 im Lernpfad.)
* [ ] Abweichungen oben im Bericht zusammenfassen und den betroffenen Phasen zuordnen.

#### 0.3 Test-Baseline
* [ ] Vollständige Läufe von Jest, DB-Tests, Python-Tests, `tsc`, Build und `e2e/accessibility.spec.ts`. Zahlen (bestanden, fehlgeschlagen, übersprungen) in `STATUS.md`.
* [ ] Bereits rote Tests mit Ursache dokumentieren. Sie werden nicht versteckt (R6), aber auch nicht dieser Phase angelastet.

#### 0.4 Design-Richtlinie
* [ ] `docs/design/lernraum-designrichtlinie.md` aus D1–D13 anlegen, ergänzt um: vorhandene Tokens und Klassen mit Dateiort, die neuen Modus-Tokens als Vorschlag mit gemessenem Kontrast, je ein kurzes Code-Beispiel für Druck, wandernde Pille und reduzierte Bewegung.
* [ ] Bildschirmfotos des Ist-Zustands (Home, Niveau-Seite, Vokabeln, Grammatik, Aussprache, Mediathek; Handy und Desktop) unter `docs/master-4/ist/` ablegen. Sie dienen später als Vorher-Vergleich. Keine echten Personendaten auf den Bildern.

**Abnahme Phase 0:** `STATUS.md`, Prüfbericht und Richtlinie liegen im Repo und sind gepusht; `git diff --stat` enthält außer diesen Dokumenten und Bildern nichts.

**Übergabe:** Abweichungen, Baseline-Zahlen, Anzahl der Vokabel-Lektionen in A1.1 und die Antwort zur Lösungsauslieferung stehen in `STATUS.md`.

---

## PHASE 1 — SCHNELLE KORREKTUREN UND BEWERTUNG

**Ziel:** Die kleinen, spürbaren Ärgernisse verschwinden, und die Bewertung wird fairer.

#### 1.1 Knöpfe tauschen
Befund: `components/vocabulary/VocabCardSession.tsx` (um Zeile 495) zeigt „Wusste ich“ links und „Wusste ich nicht“ rechts. `LessonAssessmentClient.tsx` (um Zeile 152) zeigt „Kenne ich schon“ (`decide(true)`) links und „In die Lernbox“ rechts; ein Kommentar dort begründet die bisherige Seite.
* [ ] In beiden Dateien die Reihenfolge tauschen: „Wusste ich nicht“ bzw. „In die Lernbox“ links, „Wusste ich“ bzw. „Kenne ich schon“ rechts. Der Kommentar in `LessonAssessmentClient.tsx` wird angepasst.
* [ ] Die positive Aktion bleibt die gefüllte (primäre). Falls es Tastaturkürzel oder Wischgesten gibt, folgen sie derselben Seite.
* [ ] App-weites Audit nach R15: alle Knopfpaare in Lernenden- und Admin-Oberfläche (Dialoge, Formulare, Blätter). Abweichungen korrigieren, Liste im Bericht.
* [ ] Test: Reihenfolge der Knöpfe im DOM in beiden Komponenten; ein Jest-Test prüft, dass in gemeinsamen Dialog-Komponenten die primäre Aktion zuletzt steht.

#### 1.2 Groß-/Kleinschreibung und Zeichensetzung sind kein Fehler
Befund: `learning_private.grade_answer` (Migration 06) liefert `EXACT` | `SOFT_ERROR` | `INCORRECT` mit dem Grund `punctuation`, `capitalization`, `umlaut` oder `typo`. `SOFT_ERROR` zählt als richtig, deckelt aber die Grammatik-Punktzahl auf 90 und das Vokabel-Intervall; die Oberfläche zeigt ein gelbes Warnzeichen (`SoftErrorBadge.tsx`).

Neuer Vertrag (verbindlich):
* Weicht die Antwort **nur** in Groß-/Kleinschreibung und/oder Zeichensetzung ab, ist das Ergebnis `status: "EXACT"`, `reason: null` und neu `hint: "capitalization" | "punctuation" | "capitalization_punctuation"`. Volle Punkte, voller Lernbox-Schritt, kein Warnzeichen, nur der neutrale Hinweis „So schreibt man es: …“ (D11).
* Umlaut und Tippfehler bleiben `SOFT_ERROR` wie bisher. Kommt Groß-/Kleinschreibung zu einem Umlaut- oder Tippfehler hinzu, bestimmt der Umlaut- bzw. Tippfehler das Ergebnis.
* Typografische Gleichwertigkeiten gelten immer als identisch: verschiedene Apostrophe (`'` `’`), Anführungszeichen, Bindestrich-Arten, mehrfache Leerzeichen, Leerzeichen am Anfang oder Ende.
* Alles andere bleibt, wie es ist. Insbesondere werden `der`/`den`, `ihm`/`ihn`, `am`/`an` weiter nicht als Tippfehler toleriert.
* Didaktische Folge: Aufgaben, deren **Lernziel** die Großschreibung ist (Höflichkeitsform „Sie“ gegen „sie“), werden nicht als Schreibaufgabe gebaut, sondern als Auswahl. Das gilt für Phase 4.

Aufgaben:
* [ ] Neue Migration (voraussichtlich 30): `grade_answer`, `vocabulary_private.submit_answer` und `grammar_private.record_attempt` nach dem neuen Vertrag. Körper aus der jeweils letzten Definition kopieren (siehe Kontext).
* [ ] Rückweg-Datei, Eintrag in `ORDER`.
* [ ] `supabase/tests/soft-errors.test.mjs` und `supabase/tests/vocabulary-learning.test.mjs` erweitern: „ich heiße anna“ gegen „Ich heiße Anna.“ ergibt `EXACT`, Punktzahl 100, voller Fach-Schritt; „Ich heisse Anna“ bleibt `SOFT_ERROR` (`umlaut`); „ich heise anna“ bleibt `SOFT_ERROR` (`typo`); `der` gegen `den` bleibt `INCORRECT`.
* [ ] `lib/grammar-validation.ts` (Sofort-Vorschau) und die Oberfläche (`VocabCardSession.tsx`, `ExerciseClient.tsx`, `SoftErrorBadge.tsx`) an den Vertrag anpassen. Neue Hinweistexte in fünf Sprachen.
* [ ] Bestehende Tests, die das alte Verhalten festschreiben, werden inhaltlich angepasst und im Bericht genannt, nicht gelöscht.

#### 1.3 Hinweis auf den Artikel beim Ausschreiben
Befund: Die Beschriftung `type_german_with_article` existiert, ein sichtbarer Hinweis fehlt (`VocabCardSession.tsx` um Zeile 300 und 500). Artikel stehen in `public.grammatical_article` (`der`/`die`/`das`/`none`), Farben in `articleColorClass` (`lib/vocabulary-ui.ts`).
* [ ] Im Schreibmodus erscheint bei Nomen (Artikel ungleich `none`) über dem Eingabefeld ein kleiner Info-Chip: „Schreib den Artikel mit: der, die oder das“, mit den drei Artikeln in ihren Farben. Er steht **vor** der Antwort, nicht erst nach einem Fehler. Bei anderen Wortarten erscheint er nicht.
* [ ] Der Chip ist eine eigene Komponente, damit der Lernpfad ihn in Phase 3 wiederverwendet.
* [ ] `submit_answer` liefert bei falscher Antwort zusätzlich `feedback: "article_missing" | "article_wrong" | null`, berechnet in PostgreSQL: Stimmt die Antwort ohne Artikel mit dem Nomen überein, ist es `article_missing`; mit einem anderen Artikel ist es `article_wrong`. Das Ergebnis bleibt `INCORRECT`, weil der Artikel Lernziel ist.
* [ ] Die Oberfläche erklärt beide Fälle in einem Satz (fünf Sprachen) und zeigt die Lösung mit farbigem Artikel.
* [ ] DB-Tests für beide Rückmeldungen und für Pluralwörter („die Eltern“); Komponententest, dass der Chip nur bei Nomen erscheint.

#### 1.4 Mehrdeutige Aufgaben: Zielform zeigen oder Varianten annehmen
Befund: Grammatikaufgaben haben seit 3.4 das Pflichtfeld `target_form`, angezeigt als `Как вас зовут? [heißen]`. Die 604 alten Aufgaben sind `incomplete` und werden nicht ausgeliefert; sie werden in Phase 3 archiviert. Vokabel-Sätze haben `learning_vocabulary_cards.alternative_answers_de`, aber keine Zielform.
* [ ] Neue optionale Spalte `learning_vocabulary_cards.target_form text[]`, im Vokabel-CMS pflegbar und im Schreibmodus genauso angezeigt wie bei Grammatik (`[heißen]`).
* [ ] Audit aller Vokabel-Sätze (Satzkarten) auf Mehrdeutigkeit mit einem Skript unter `scripts/`. Es meldet Sätze, bei denen typische Varianten naheliegen: du/Sie, Satzstellung mit vorangestellter Zeit- oder Ortsangabe, `Tschüs`/`Tschüss`, `geht’s`/`geht es`, `Ich heiße`/`Mein Name ist`, Zahl als Ziffer oder Wort, Preise (`2,50 €`/`zwei Euro fünfzig`).
* [ ] Für jede gemeldete Karte eine Entscheidung: Zielform ergänzen **oder** Varianten in `alternative_answers_de` aufnehmen. Beides nur, wenn die Variante wirklich gleichwertig ist. Die Entscheidungen stehen als prüfbare Liste in `docs/master-4/varianten-audit.md` und werden per idempotenter Migration oder Import übernommen.
* [ ] Keine globale Regel in `grade_answer`, die Inhalte gleichsetzt. Zahlen, du/Sie und Satzstellung können Lernziel sein und werden pro Aufgabe entschieden.
* [ ] Test: Jede Satzkarte mit gemeldeter Mehrdeutigkeit hat danach Zielform oder Alternativen.

#### 1.5 Botschaft nach der Registrierung
Befund: `lib/auth-i18n.ts` hat `status_signup_email_sent` und `status_confirm_success`. Ohne freigeschaltetes Niveau zeigt Home nur die kleine Zeile `today_no_level` (`lib/student-ui-i18n.ts`, `TodayPlan.tsx`). Die Mail bei Freischaltung existiert (`level_access_granted`, Migration 29).
* [ ] Nach dem Absenden der Registrierung und nach der Bestätigung der E-Mail-Adresse steht deutlich (Deutsch, sinngemäß in den anderen Sprachen):
  > **Vielen Dank für deine Anmeldung!** Der Admin prüft kurz deine Daten und schaltet dir danach die Funktionen frei.
* [ ] Auf Home ersetzt eine große Karte „Freischaltung ausstehend“ die kleine Zeile, solange kein Niveau freigeschaltet ist: Uhr-Symbol, derselbe Satz, darunter „Du bekommst eine E-Mail, sobald es losgeht.“ und ein Link zur Hilfe. Kalender und Hilfe bleiben erreichbar.
* [ ] Tests für beide Statusseiten und die Karte (mit und ohne freigeschaltetes Niveau).

**Abnahme Phase 1:** Alle DB-, Jest- und axe-Tests grün; Migration im Klon doppelt ausgeführt (Idempotenz); produktiv aktiviert nach dem Ablauf mit Schemaänderung; Vorher/Nachher-Bildschirmfotos der Knöpfe, des Artikel-Chips und der Karte „Freischaltung ausstehend“ im Bericht.

**Übergabe:** Belegte Migrationsnummern, der neue `grade_answer`-Vertrag und die Varianten-Liste stehen in `STATUS.md`. Phase 4 nutzt den Vertrag für alle Schreibaufgaben.

---

## PHASE 2 — NAVIGATION UND DESIGN-SYSTEM

**Ziel:** Man weiß jederzeit, wo man ist. Die vier Modi stehen gleichberechtigt oben. Der Lernraum fühlt sich lebendig an.

Befund: Die Niveau-Seite `app/[lang]/dashboard/level/[level]/page.tsx` zeigt oben `LevelPath` (Vokabel-Stationen, in der Oberfläche „Lernweg“) und unten `TrainerStatusTiles` mit den vier Bereichen. Dadurch wirkt alles wie Vokabeltrainer, und Grammatik, Aussprache und Mediathek stehen weit unten. `DashboardHeader.tsx` zeigt auf dem Handy nur eine Zurück-Pille und die aktuelle Seite und überspringt das Segment `level`. Home nimmt das **erste** Niveau mit 0 < Fortschritt < 100, nicht das zuletzt gelernte. „Lernen“ springt über `localStorage` (`sitov:last-level`).

#### 2.1 Bewegungs-Tokens und Grundbausteine
* [ ] Tokens aus D4 in `app/globals.css`, Federn und Varianten in `lib/motion.ts`. Ein Hook `useReducedMotionSafe()` oder die Framer-Einstellung `MotionConfig reducedMotion="user"` global im Lernenden-Layout.
* [ ] Wiederverwendbare Bausteine: `PressableCard`, `CountUp`, `NewBadge` (D10), `SlidingPill`. Alle mit Tests für reduzierte Bewegung.
* [ ] Modus-Kennfarben aus D2 als Tokens, Kontrasttests erweitert.

#### 2.2 Modus-Dock
* [ ] Neue Komponente `components/dashboard/ModeDock.tsx` im Niveau-Layout `app/[lang]/dashboard/level/[level]/layout.tsx` nach D6.
* [ ] Ziele: Vokabeln → `/vocabulary`, Lernpfad → bis Phase 3 die bestehende Route `/exercises`, danach `/path`, Aussprache → `/pronunciation`, Mediathek → `/videos`. Die Ziele stehen an **einer** Stelle, damit Phase 3 nur dort umstellt.
* [ ] Gesperrte Modi mit Schloss und Erklärung, auch der Fall „deutsche Oberfläche“ (`TrainerLanguageRequired`).
* [ ] Zähler: fällige Karten, ungelesene Antworten in der Aussprache, Platz für „Neu“ (gefüllt in Phase 6).
* [ ] Tests: aktiver Tab je Route, `aria-current`, gesperrter Zustand, Tastaturbedienung, Handy-Breite ohne waagerechtes Scrollen.

#### 2.3 Niveau-Seite als Übersicht, „Lernweg“ wird „Lektionen“
* [ ] Die Niveau-Seite zeigt oben eine Karte „Weiter, wo du aufgehört hast“ (letzter Modus und letzte Stelle) und darunter **vier gleich große Modus-Karten** mit je einer Kennzahl: fällige Karten, Position auf dem Lernpfad, neue Antworten der Lehrkraft, neue Medien.
* [ ] `LevelPath` wandert in den Modus Vokabeln und heißt dort **„Lektionen“**. Alle Oberflächentexte, Hilfetexte und Kommentare, die „Lernweg“ für die Vokabel-Lektionen sagen, werden umbenannt (fünf Sprachen). „Lernpfad“ ist danach frei für den Grammatik-Pfad.
* [ ] Grep-Test: Kein Oberflächentext in `dictionaries/` und `lib/*-i18n.ts` verwendet „Lernweg“ mehr für die Vokabel-Lektionen (entsprechend in den anderen Sprachen).

#### 2.4 Brotkrumen mit vollem Pfad
* [ ] `DashboardHeader.tsx` nach D7 umbauen: voller Pfad inklusive Niveau, auf allen Breiten. Beschriftungen aus `DASHBOARD_ROUTE_KEYS` (erweitern um Lernpfad, Pfad n, Knoten, Test, Lektionen).
* [ ] Tests für mindestens sechs Routen (Home, Niveau, Vokabeln/Lernbox, Vokabeln/Lektionen, Aussprache, Mediathek); Phase 3 ergänzt die Pfad-Routen.

#### 2.5 Untere Leiste blendet beim Scrollen aus
* [ ] `StudentNavigation.tsx` und `.st-tabbar` in `student.css` nach D8. Der Zustand wird als Attribut am Wurzelelement gesetzt (zum Beispiel `data-tabbar="hidden"`), und eine CSS-Variable für die sichtbare Leistenhöhe steuert alle Elemente, die sich an der Leiste ausrichten.
* [ ] Das Aufnahme-Dock der Aussprache wandert mit.
* [ ] Playwright auf Pixel 7 und iPhone 14: Leiste weg nach Runterscrollen, zurück nach Hochscrollen, sichtbar oben und am Ende; Aufnahmeknopf bleibt `toBeInViewport()` und klickbar. Die vorhandenen Tests `e2e/navigation-scroll.spec.ts`, `e2e/pronunciation-mobile.spec.ts` und `e2e/mobile-safe-area.spec.ts` bleiben grün.

#### 2.6 Home folgt dem zuletzt gelernten Niveau
* [ ] Neue RPC `public.get_last_active_level()` (R5, R10): das Niveau mit der jüngsten Lernhandlung der aufrufenden Person über Vokabel-Antworten (`vocabulary_private.answer_receipts`), Aufgabenversuche, Aussprache-Aufnahmen und ab Phase 3 Lernpfad-Versuche. Nur Niveaus mit gültiger Freischaltung. Rückfall: erstes angefangenes, dann erstes freigeschaltetes Niveau.
* [ ] Home zeigt „Deine Lernbereiche · A1.2“ und einen Knopf „Zum Lernpfad“ bzw. zum zuletzt genutzten Modus dieses Niveaus.
* [ ] Der Tab „Lernen“ nutzt dieselbe RPC. `localStorage` bleibt nur als Rückfall, wenn die RPC fehlschlägt.
* [ ] DB-Test: Wer in A1.1 halb fertig ist und in A1.2 eine Vokabel beantwortet, bekommt A1.2. Jest-Test für die Überschrift.

#### 2.7 Mikroanimationen einsetzen
* [ ] D5 auf Home, Niveau-Seite, Dock, Brotkrumen, Lernbox-Übersicht und Antwort-Rückmeldung anwenden. Nichts darüber hinaus erfinden.
* [ ] Test mit `prefers-reduced-motion: reduce` in Playwright: keine laufenden Animationen (per `document.getAnimations()`), alle Inhalte sichtbar.

**Abnahme Phase 2:** axe ohne Filter auf allen geänderten Routen in hell und dunkel; Playwright Desktop, Pixel 7, iPhone 14 grün; Vorher/Nachher-Bildschirmfotos neben die aus Phase 0; Lighthouse-Leistung der Niveau-Seite auf dem Handy nicht schlechter als in Phase 0 (Wert im Bericht).

**Übergabe:** Ort der Modus-Ziele (für Phase 3), Namen der neuen Bausteine und Tokens in `STATUS.md`.

---

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

## PHASE 4 — LERNPFAD: INHALTE A1.1

**Ziel:** Sieben vollständige Pfade und sieben Tests für A1.1, von dir selbst geschrieben, so dass ältere Lernende jedes Lernziel sicher erreichen.

#### 4.1 Dein Auftrag als Autor
Du erstellst **alle Aufgaben und alle sieben Tests selbst**. Grundlage sind ausschließlich die Lernziele in Anhang A. Anzahl der Knoten, Anzahl der Aufgaben und die Wahl der Aufgabentypen bestimmst du frei. Maßstab ist, dass **ältere Lernende die einzelnen Anforderungen optimal lernen**. Die folgenden Richtwerte sind ein Rahmen, keine Pflicht:
* 5–8 Übungsknoten pro Pfad, je 6–10 Aufgaben, eine Sitzung dauert 5–8 Minuten.
* Ein Wiederholungsknoten vor dem Test, der alle Lernziele des Pfads mischt.
* Test mit 12–16 Aufgaben aus einem Pool von mindestens doppelter Größe. Jedes Lernziel wird mindestens einmal geprüft.
* Wo du von den Richtwerten abweichst, begründest du es in einem Satz im Bericht.

#### 4.2 Didaktische Leitlinien für ältere Lernende
* **Ein Lernziel pro Aufgabe.** Keine Aufgabe prüft zwei neue Dinge gleichzeitig.
* **Vom Erkennen zum Schreiben:** Jeder Knoten beginnt mit Auswahl- und Zuordnungsaufgaben und endet mit Lücken, Satzbau und Umformen.
* **Eindeutig (No-Guessing):** Jede Schreibaufgabe hat genau eine Lösung oder alle gleichwertigen Lösungen in `accepted_answers`. Wo es mehrere Wege gibt, steht die Zielform dabei (`[heißen]`). Wenn Großschreibung Lernziel ist (Sie/sie), ist die Aufgabe eine Auswahl (Phase 1.2).
* **Erwachsene Situationen:** Arztpraxis, Amt, Supermarkt, Nachbarn, Enkel, Wohnungssuche, Deutschkurs, Telefonate. Keine Schul- oder Kinderszenen als Hauptkontext.
* **Wiederkehrende Figuren:** Erfinde eine kleine Besetzung (vier bis sechs Personen verschiedenen Alters und verschiedener Herkunft), die durch alle sieben Pfade führt. Keine Namen aus Lehrwerken (R14).
* **Kein Vorgriff:** Keine Grammatik aus späteren Pfaden. Pfad 3 kennt noch keinen Akkusativ, Pfad 5 noch kein Perfekt.
* **Wortschatz:** vorrangig die Wörter der passenden Vokabel-Lektion von A1.1 (Zuordnung laut `STATUS.md` aus Phase 0) und der Wörter früherer Pfade. Neue Wörter nur, wenn das Lernziel sie verlangt.
* **Artikel-Hinweis:** Verlangt eine Schreibaufgabe ein Nomen, trägt sie im Seed das Kennzeichen `needs_article` und zeigt den Artikel-Chip aus Phase 1.3 vor der Antwort.
* **Merkkarten:** höchstens drei Sätze Regel in der Oberflächensprache, zwei bis vier deutsche Beispiele, Farbcode (Artikel: die bestehenden Artikelfarben; Verbposition: eine einheitliche Hervorhebung für das Verb).
* **Erklärungen bei Fehlern:** Zu jeder Aufgabe eine kurze Erklärung in allen vier Oberflächensprachen (en, ru, uk, tr) und auf Deutsch für das CMS.
* **Hören:** In jedem Pfad mindestens ein Knoten mit `listening`, weil Hören für Telefonate und Termine zentral ist.
* **Kann-Ziele praktisch:** Formulare, Visitenkarten, Einkaufszettel, Anzeigen, Öffnungszeiten und Wetterberichte baust du als eigene, erfundene Mini-Dokumente nach (`multi_blank`), nie als Kopie.

#### 4.3 Umsetzung
* [ ] Seed `supabase/seeds/lernpfad-a1-1.json` im Format aus Phase 3, ein Eintrag je Pfad, Knoten und Aufgabe, inklusive Übersetzungen.
* [ ] Import über den Befehl aus Phase 3, idempotent (erneuter Import ändert nichts).
* [ ] Audio für alle `listening`-Aufgaben erzeugt und abgelegt.
* [ ] Der Lernpfad A1.1 ist für alle Lernenden sichtbar, die den Trainer freigeschaltet haben; die alten Units sind seit Phase 3 archiviert.

#### 4.4 Qualitätstests (automatisiert, Pflicht)
* [ ] Jede Aufgabe besteht das Zod-Schema ihres Typs.
* [ ] Jede Schreibaufgabe: Die Musterlösung ergibt über `grade_answer` `EXACT`; eine typische Falschantwort ergibt `INCORRECT`.
* [ ] Jedes Lernziel aus Anhang A ist mindestens einer Aufgabe zugeordnet (Feld `goal` im Seed) und kommt in jedem Testpool mindestens zweimal vor.
* [ ] Jede Aufgabe hat Übersetzungen in en, ru, uk, tr; ru-Texte enthalten kyrillische Zeichen, tr-Texte keine kyrillischen; deutsche Felder bestehen den Sprachschutz aus Migration 07.
* [ ] Kein deutscher Satz kommt doppelt vor. Kein Satz enthält den Namen eines Lehrwerks oder Grammatik-Verweise (Muster wie „ÜG“ plus Nummer).
* [ ] Ein Vorgriffs-Test mit Wortlisten statt Suchmustern: keine Partizipien vor Pfad 7, kein `einen`/`keinen` vor Pfad 6. Feste Wendungen wie „Einen Moment, bitte“ stehen als ausdrückliche Ausnahme in der Liste.

#### 4.5 Sprachliche Abnahme
* [ ] Alle deutschen Sätze zweimal gegenlesen: Grammatik, Rechtschreibung nach aktueller Regelung, natürliche Alltagssprache auf A1-Niveau.
* [ ] Übersetzungen auf natürlichen Ausdruck prüfen, nicht wörtlich. Russisch und Ukrainisch getrennt.
* [ ] Bericht `docs/master-4/lernpfad-a1-1.md`: je Pfad Knoten, Aufgabenzahl, Typen, Lernziel-Abdeckung als Tabelle, Abweichungen von den Richtwerten mit Begründung.

**Abnahme Phase 4:** Alle Qualitätstests grün; Import in den Klon und produktiv; Playwright spielt Pfad 1 vollständig durch (alle Knoten, Test bestanden, Pfad 2 frei) auf Pixel 7 mit russischer Oberfläche.

**Übergabe:** Zahlen je Pfad und der Name des Seeds in `STATUS.md`.

---

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

## PHASE 6 — BENACHRICHTIGUNGEN UND „NEU“

**Ziel:** Lernende sehen sofort, was neu ist, und bekommen Mails nur, wenn sie es wollen.

#### 6.1 Das „Neu“-System
Befund: Nur Medien kennen `fresh` (erstellt in den letzten N Tagen, `lib/learning-status-server.ts`). Pro Person wird nicht gespeichert, was sie schon gesehen hat.

Regeln:
* Eine Tabelle für **Gesehen-Quittungen**: Person, Art (Enum), Objekt, Zeitpunkt.
* Arten: Niveau, Vokabel-Lektion, Pfad, Spezial-Zweig, Aussprache-Text, Medienordner, Video, Präsentation, Trainer (Modus).
* **Neu** ist ein Objekt für eine Person, wenn es für sie sichtbar ist, sie es noch nicht geöffnet hat und es **nach ihrem ersten Besuch dieses Niveaus** veröffentlicht oder freigeschaltet wurde. Ein Niveau oder Modus ist neu, wenn er **nach dem ersten Besuch der Person im Lernraum** freigeschaltet wurde und noch nicht geöffnet ist. Was schon beim ersten Besuch freigeschaltet war (zum Beispiel alle im Voraus gebuchten Niveaus), ist nicht neu. So zeigt ein frisches Konto nicht alles als neu.
* Bei der Migration gelten alle Bestandsobjekte für alle bestehenden Personen als gesehen.
* **Gesehen** wird gesetzt, wenn die Person das Objekt öffnet (Seite, Knoten, Video, Ordner), nicht beim bloßen Anzeigen der Liste.
* Anzeige nach D10: Badge an Kachel, Karte und Modus-Tab; Punkt am Tab „Lernen“ der unteren Leiste, wenn in irgendeinem freigeschalteten Niveau etwas neu ist; Badge an der Niveaukarte auf Home.

Aufgaben:
* [ ] Migration mit Tabelle, RLS, RPCs (Quittung setzen; Neu-Zähler je Niveau und Modus in **einem** Aufruf, damit Home nicht langsamer wird).
* [ ] Oberfläche an allen genannten Stellen. Das vorhandene `fresh` der Medien geht in diesem System auf.
* [ ] DB-Tests: neues Objekt nach dem ersten Besuch ist neu; nach dem Öffnen nicht mehr; Bestand nach der Migration nicht neu; frisches Konto sieht keinen Altbestand als neu; gesperrte Inhalte sind nie neu.
* [ ] Leistung: Home-Antwortzeit im Bericht, vorher und nachher.

#### 6.2 Mail bei Antwort der Lehrkraft in der Aussprache: Schalter im Profil
Befund: Die Mail **existiert bereits**. `app/actions/pronunciation-conversations.ts` (um Zeile 39) ruft `notifyPronunciationFeedback` → `queueTransactionalEmail` mit Typ `feedback_available` auf, eine Mail pro Nachricht, Dedupe-Schlüssel `pronunciation-message:<id>`. Vorlagen in `lib/mail/templates.mjs` (fünf Sprachen). Es fehlt der Schalter, und die Zustellung ist nicht Ende-zu-Ende nachgewiesen.
* [ ] Spalte `profiles.notify_pronunciation_feedback boolean NOT NULL DEFAULT true`.
* [ ] Die Einstellung wird dort geprüft, wo die Mail in die Warteschlange geht, **in der Datenbank**, damit kein Weg sie umgeht.
* [ ] Neuer Abschnitt „Benachrichtigungen“ in `components/dashboard/ProfileSettings.tsx`: Schalter „E-Mail, wenn meine Lehrkraft in der Aussprache antwortet“, sofort gespeichert, mit Bestätigung. Größe und Kontrast nach R13.
* [ ] **Bündeln:** Antwortet die Lehrkraft innerhalb von 10 Minuten mehrfach im selben Gespräch, geht eine Mail, die alle neuen Antworten nennt. Umsetzung ohne neuen Dienst (R2), im vorhandenen Mail-Worker oder über die Warteschlange.
* [ ] Die Mail führt mit einem Link direkt in das Gespräch.
* [ ] Tests: Schalter aus → keine Zeile in `private.mail_outbox`; an → genau eine Zeile; drei Antworten in 10 Minuten → eine Mail; Vorlage in fünf Sprachen.
* [ ] **Nachweis in Produktion:** Testkonto, Antwort der Lehrkraft, Zeile in `private.mail_outbox` mit Status `sent`, Eingang im Postfach des Testkontos. Im Bericht nur Zeitstempel und Status, keine Adressen. Danach Testdaten entfernen.

#### 6.3 Niveau abgeschlossen: keine Benachrichtigung der Lehrkraft
Nutzerentscheidung vom 25.09.2026: Die Lehrkraft schaltet gebuchte Niveaus im Voraus frei und will beim Abschluss eines Niveaus **nicht** benachrichtigt werden.
* [ ] Es gibt weder Staff-Mail noch Dashboard-Hinweis noch Zähler zum Niveau-Abschluss.
* [ ] DB-Test: Nach dem Bestehen des letzten Tests eines Niveaus entsteht keine neue Zeile in `private.mail_outbox`.

#### 6.4 Freischalt-Mail: mehrere Niveaus in einer Mail
Befund: Migration 29 legt mit einem Zeilen-Trigger (`on_student_level_access_granted_notify`, `FOR EACH ROW`) für **jedes** neu freigeschaltete Niveau eine eigene Mail vom Typ `level_access_granted` an (Dedupe-Schlüssel `level-access:<user id>:<level>`). `set_student_level_access` schreibt alle gewählten Niveaus in **einer** `INSERT`-Anweisung. Schaltet die Lehrkraft sechs Niveaus auf einmal frei, bekommt die Person heute sechs Mails. Nutzerentscheidung vom 25.09.2026: Das wird eine Mail.
* [ ] Neue Migration: Der Trigger arbeitet pro Anweisung (`FOR EACH STATEMENT` mit `REFERENCING NEW TABLE`) und legt je Person **eine** Mail an, die alle in diesem Speichervorgang neu freigeschalteten Niveaus in Kursreihenfolge (`learning_levels.sort_order`) nennt.
* [ ] Die bisherigen Zusagen aus Migration 29 bleiben: Ein Niveau, das schon einmal angekündigt wurde, wird nie wieder angekündigt, auch nicht nach Entziehen und erneutem Freischalten. Bestehende Freigaben lösen keine Mail aus. Scheitert das Einreihen, bleibt die Freischaltung bestehen (nur `WARNING`).
* [ ] Vorlage `levelAccess` in `lib/mail/templates.mjs` für ein und für mehrere Niveaus, in fünf Sprachen. Der Text nennt statt „Übungen“ die heutigen Bereiche: Vokabeln, Lernpfad, Aussprache und Mediathek. Der Knopf führt zum ersten neu freigeschalteten Niveau.
* [ ] Payload mit einer Liste `levels` statt eines einzelnen `level`. Der Mail-Worker kann Mails, die noch im alten Format in der Warteschlange liegen, weiter darstellen.
* [ ] Tests (Muster: `supabase/tests/level-access-notification.test.mjs`): sechs Niveaus auf einmal → genau eine Zeile in `private.mail_outbox` mit allen sechs; ein Niveau → eine Mail mit einem Niveau; Entziehen und erneutes Freischalten → keine Mail; später ein weiteres Niveau → eine Mail nur mit diesem; zwei Personen in einem Vorgang → je eine eigene Mail.

**Abnahme Phase 6:** Alle Tests grün, Produktionsnachweis der Aussprache-Mail im Bericht, Home-Antwortzeit nicht schlechter als 10 % gegenüber Phase 0.

**Übergabe:** Arten der Gesehen-Quittungen und die RPC-Namen in `STATUS.md`.

---

## PHASE 7 — LEHRER-DASHBOARD

**Ziel:** Die Lehrkraft sieht genau, was jede Person lernt, wo sie hängt und was als Nächstes zu tun ist.

Befund: `components/admin/StudentDetailModal.tsx` ist 31 Zeilen lang (nur Kontakt und Tafel-Notiz). `StudentList.tsx` zeigt Rollen, Niveaus, Zugriffe und Fortschritt in %. `TeacherAnalytics.tsx` nutzt `public.get_all_students_progress_data(p_student_id, p_course_id)` (Migration 11: Fächer-Verteilung 1–6 plus gelernt, 30-Tage-Verlauf, Abschluss je Niveau). Datenquellen: `vocabulary_private.answer_receipts` (jede Antwort mit getippter Antwort, Ergebnis, Zeit), `user_exercise_progress`, `learning_activity_days` (Migration 24), `submissions`, `pronunciation_messages`, `teacher_student_notes`, ab Phase 3 die Lernpfad-Tabellen, ab Phase 5 die Mitnahme.

#### 7.1 Schülerseite `/admin/students/[id]`
Eigene Seite statt Modal, mit Tabs. Das Modal wird durch einen Link auf die Seite ersetzt.
* [ ] **Überblick:** zuletzt aktiv, Lernzeit 7 und 30 Tage, aktive Tage in Folge, aktuelles Niveau, Position auf dem Lernpfad, letzte Testnote, fällige Karten, Mini-Verteilung auf die Fächer, Markierung „braucht Aufmerksamkeit“ mit Grund, abgeschlossene Pfade je Niveau.
* [ ] **Niveaus freischalten** wie bisher, auch mehrere oder alle auf einmal im Voraus. Die neue Seite übernimmt diese Funktion aus der Liste, ohne sie einzuschränken.
* [ ] **Vokabeln:** Fächer-Verteilung je Niveau **und je Lektion** (`PhaseDistributionChart.tsx` wiederverwenden), halb gewusste Wörter, die schwierigsten Wörter (meiste Rückfälle), die letzten 50 Antworten mit getippter Antwort und Ergebnis, pausierte Lektionen, Mitnahme an/aus mit Anzahl. Eigene Wörter bleiben privat: nur ihre Anzahl.
* [ ] **Lernpfad:** Karte wie bei der Person, mit Sternen und Status je Knoten; alle Testversuche mit Prozentwert und aufklappbar jede Antwort; Knöpfe „Pfad freischalten“ und „Pfad/Test zurücksetzen“ mit Bestätigung und Protokoll.
* [ ] **Aussprache:** Gespräche, offene und unbeantwortete Aufnahmen, Link in das Gespräch.
* [ ] **Aktivität:** Kalender-Heatmap der Lerntage, Verteilung der Lernzeit auf die Modi, Verlauf über 30 Tage.
* [ ] **Notizen:** `teacher_student_notes` mit Datum.

#### 7.2 Erweiterte Liste
* [ ] Spalten: zuletzt aktiv, Lernzeit der Woche, Pfad-Position, letzte Testnote, fällige Karten, Mini-Balken der Fächer, Markierung „braucht Aufmerksamkeit“.
* [ ] „Braucht Aufmerksamkeit“ (in PostgreSQL berechnet): 7 Tage inaktiv, derselbe Test zweimal nicht bestanden, mehr als 150 fällige Karten, oder Trefferquote der letzten 7 Tage unter 50 %. Die Liste zeigt den Grund.
* [ ] Sortieren und Filtern nach jeder Spalte, Suche nach Namen; auf dem Handy als Kartenliste.

#### 7.3 Aktivitätsprotokoll mit Aufbewahrungsfrist (R16)
* [ ] Erfasst werden nur **Lernsitzungen**: Beginn, Ende, Modus, Niveau, Anzahl der Antworten. Keine Klickpfade.
* [ ] Rohdaten werden nach **180 Tagen** automatisch gelöscht; dauerhaft bleiben nur Tageswerte (`learning_activity_days`). Die Löschung läuft ohne neuen Dienst (zum Beispiel beim Schreiben neuer Sitzungen oder über den vorhandenen Wartungsweg) und ist getestet.
* [ ] Datenschutzerklärung in fünf Sprachen ergänzen: was die Lehrkraft sieht, wozu, wie lange.
* [ ] Im Profil der Lernenden ein Satz: „Deine Lehrkraft sieht deinen Lernfortschritt, damit sie dich gezielt unterstützen kann.“ mit Link zur Datenschutzerklärung.

#### 7.4 Bewusst nicht gebaut: Einsprüche von Lernenden
Nutzerentscheidung vom 25.09.2026: Lernende beurteilen nie selbst, ob eine Schreibantwort richtig ist. Es gibt **keinen** Knopf „Meine Antwort ist auch richtig“ und keine Einspruchs-Warteschlange. Richtige Lösungen und Varianten legt ausschließlich die Lehrkraft fest, im CMS und über das Varianten-Audit aus Phase 1.4. Die Selbsteinschätzung „Wusste ich / Wusste ich nicht“ im Karteikarten-Modus bleibt unverändert.

**Abnahme Phase 7:** DB-Tests für alle neuen Abfragen inklusive Rechten (Lernende sehen keine fremden Daten, Lehrkraft sieht alle); Playwright für Schülerseite und Liste; axe ohne Filter; Antwortzeit der Liste bei 200 Test-Personen unter 800 ms (p95, Messung im Bericht).

**Übergabe:** Neue Routen, RPCs und die Löschregel in `STATUS.md`.

---

## PHASE 8 — ABNAHME UND AUSLIEFERUNG

**Ziel:** Alles läuft zusammen, auf allen Geräten, nachgewiesen.

#### 8.1 Testinfrastruktur
* [ ] Falls noch offen aus `CODEX.md` 8.0: Playwright über Produktionsbuild, Projekte Desktop Chrome, `devices['Pixel 7']`, `devices['iPhone 14']`, authentifizierter Storage-State, Testpersonen mit nicht-deutscher Oberfläche.

#### 8.2 Verifikationsmatrix (jede Zeile ein grüner automatisierter Test)
* [ ] **Phase 1:** Knopfreihenfolge in beiden Komponenten · Groß-/Kleinschreibung und Zeichensetzung ergeben `EXACT` mit Punktzahl 100 · Artikel-Chip nur bei Nomen · `article_missing` und `article_wrong` · Karte „Freischaltung ausstehend“.
* [ ] **Phase 2:** Modus-Dock auf allen vier Modi · volle Brotkrumen auf Handy · untere Leiste blendet aus und ein, Aufnahmeknopf bleibt sichtbar · Home zeigt das zuletzt gelernte Niveau · reduzierte Bewegung ohne laufende Animationen.
* [ ] **Phase 3/4:** Pfad 1 komplett auf Pixel 7 · Test knapp unter 80 % nicht bestanden, genau 80 % bestanden · Pfad 2 erst danach frei · keine Lösungen vor der Antwort (Netzwerkmitschnitt) · `/exercises` leitet nach `/path` · Qualitätstests des Seeds.
* [ ] **Phase 5:** Mitnahme mit erhaltenem Fach, Schalter aus und an, Zurücksetzen.
* [ ] **Phase 6:** „Neu“ erscheint und verschwindet, im Voraus freigeschaltete Niveaus sind nicht neu · Mail-Schalter aus/an · Bündelung · mehrere freigeschaltete Niveaus ergeben eine Mail · keine Benachrichtigung der Lehrkraft bei Niveau-Abschluss.
* [ ] **Phase 7:** Schülerseite mit allen Tabs · Rechte · kein Einspruchs-Knopf in der Lernenden-Oberfläche.
* [ ] **Gesamt:** axe ohne Filter auf allen Lernenden- und Admin-Routen in hell und dunkel · `translation-integrity` grün · vollständiger Jest-, DB-, Python- und Playwright-Lauf grün.

#### 8.3 Leistung
* [ ] Lighthouse (Handy) für Home, Niveau-Seite, Lernpfad-Karte, Knoten: Werte gegen Phase 0 im Bericht. Die Lernpfad-Karte lädt ihre Knoten mit **einem** RPC-Aufruf.
* [ ] JavaScript der Lernpfad-Route im Bericht (Build-Ausgabe); Framer Motion wird nicht doppelt gebündelt.

#### 8.4 Hilfe und Dokumentation
* [ ] Hilfe-Einträge für Lernpfad, Wörter mitnehmen, Benachrichtigungen und „Neu“ in fünf Sprachen. Bestehende Hilfe-Einträge bleiben, wie sie sind.
* [ ] `docs/master-4/verifikation.md` mit allen Nachweisen (Muster wie `docs/phase-5-verification.md`).
* [ ] `STATUS.md` abschließen, `supabase/schema.sql` und `supabase/database.types.ts` aus Produktion aktualisiert.

#### 8.5 Auslieferung
* [ ] Letztes Release nach dem Ablauf aus „Kontext & Umgebung“, Backup-Nachweis nach R8, Health `ready`, App, Mail-Worker und nginx aktiv.
* [ ] Kurzer Rauchtest in Produktion mit einem Testkonto: Home, Niveau, alle vier Modi, ein Lernpfad-Knoten, eine Vokabelrunde. Testdaten danach entfernen.

**Abnahme Phase 8:** Alle Checkboxen dieses Prompts sind `[x]` oder begründet `[N/A]` (S7).

---

## ANHANG A — LERNZIELKATALOG A1.1 (in eigenen Worten)

Nur Lernziele, keine Buchtexte (R14). Jede Zeile ist ein prüfbares Lernziel und bekommt im Seed eine Kennung (zum Beispiel `P1-G2` für Pfad 1, Grammatik, Ziel 2).

### Pfad 1 — Kennenlernen
* **Grammatik**
  * G1 Aussagesatz: Das Verb steht auf Position 2.
  * G2 W-Fragen mit wer, wie, woher, was; das Verb steht auf Position 2.
  * G3 Präsens von kommen, heißen, sprechen und sein für ich, du und Sie: Endungen -e, -st, -en; Besonderheiten „du heißt“ und „du sprichst“; sein: bin, bist, sind.
  * G4 „Ich heiße …“ und „Mein Name ist …“ ohne Frau oder Herr vor dem eigenen Namen.
* **Kommunikation**
  * K1 Begrüßen passend zur Tageszeit (Morgen, Tag, Abend), auch förmlich am Telefon mit Firmenname; willkommen heißen; „Freut mich“.
  * K2 Verabschieden: Auf Wiedersehen, Tschüs, Gute Nacht, am Telefon „Auf Wiederhören“.
  * K3 Nach dem Namen fragen und ihn nennen, jemanden vorstellen („Das ist …“).
  * K4 Buchstabieren und um Buchstabieren bitten.
  * K5 Herkunft erfragen und nennen, auch Länder mit Artikel („aus der Türkei“).
  * K6 Sprachen erfragen und nennen, mit „ein bisschen“ und „nur ein bisschen“ als Antwort auf ein Lob.
  * K7 Sich entschuldigen, bitten und danken.
  * K8 Gesprächsstrategien: zustimmen, nachfragen („Wie bitte?“), um Zeit bitten, Nichtwissen sagen, Interesse zeigen.
  * K9 Sie oder du: wann was passt.
  * K10 Am Telefon nach einer Person fragen.
* **Kann-Ziele:** Visitenkarte lesen, Anmeldeformular ausfüllen (Name, Land, Stadt, Sprache).
* **Wortschatz:** fünf Länder, fünf Sprachen, das Alphabet.

### Pfad 2 — Familie und Angaben zur Person
* **Grammatik**
  * G1 Possessivartikel mein/meine, dein/deine, Ihr/Ihre im Nominativ (maskulin, neutral, feminin, Plural).
  * G2 Vollständiges Präsens aller Personen von regelmäßigen Verben (leben, wohnen, lernen, kommen) sowie heißen, sprechen, sein und haben.
* **Kommunikation**
  * K1 Nach dem Befinden fragen (förmlich und informell) und mit einer Abstufung antworten, Gegenfrage „Und Ihnen/dir?“.
  * K2 Andere vorstellen: „Das ist/sind …“, Herkunft und Wohnort in der 3. Person.
  * K3 Angaben zur Person: Geburtsort, Wohnort, Adresse (in + Stadt, in der + Straße), Telefonnummer.
  * K4 Familienstand, Kinder und deren Alter.
  * K5 Orte einordnen: „liegt in Nord-/Süddeutschland“, „Hauptstadt von“.
  * K6 Zahlen 0 bis 20.
  * K7 Strategien: „Na ja“, „Ach“, „Ja, genau“, „Nein, falsch“.
* **Kann-Ziele:** Formular mit Geburtsort, Wohnort, Telefonnummer und Familienstand ausfüllen; einfache Informationen über Personen verstehen.
* **Wortschatz:** Familie, Familienstand.

### Pfad 3 — Einkaufen
* **Grammatik**
  * G1 Ja-/Nein-Frage mit dem Verb auf Position 1, im Vergleich zur W-Frage.
  * G2 Unbestimmter Artikel ein/eine und Negativartikel kein/keine im Nominativ; Plural ohne Artikel bzw. mit „keine“.
  * G3 Pluralformen: mit Umlaut, -e, -er, -n, -s, ohne Endung.
  * G4 Konjugation von „möchte“.
* **Kommunikation**
  * K1 Nach einem Wort fragen („Wie heißt das auf Deutsch?“) und korrigieren („Das ist doch kein …“).
  * K2 Einkaufsgespräch: Hilfe anbieten, Wunsch äußern („Ich hätte gern …“, „Ich möchte …“), nach Ware fragen, Preis erfragen, „Sonst noch etwas?“ – „Das ist alles.“
  * K3 Mengenangaben: Gramm, Kilo, Pfund, Liter, Flasche, Packung, Becher, Dose.
  * K4 Preise lesen und sprechen („1,10 €“ = „ein Euro zehn“), Singular und Plural bei „kostet/kosten“.
  * K5 Strategien: „Ja, natürlich“, „Nein, tut mir leid“, „Ja, bitte“, „Nein, danke“.
* **Kann-Ziele:** Einkaufszettel schreiben, einfaches Rezept lesen.
* **Wortschatz:** acht Obst- und Gemüsesorten, fünf Mengenangaben.

### Pfad 4 — Wohnen
* **Grammatik**
  * G1 Bestimmter Artikel der/das/die, Plural die; Wörter immer mit Artikel lernen (Farbcode).
  * G2 Personalpronomen er/es/sie und Plural sie als Ersatz für Nomen.
  * G3 Verneinung mit „nicht“ und „kein“.
* **Kommunikation**
  * K1 Gefallen und Missfallen: „Wie gefällt dir/Ihnen …?“, „Wie gefallen …?“ mit Abstufung.
  * K2 Nach dem Ort fragen und antworten (hier, dort).
  * K3 Zimmer und Möbel beschreiben: Preis, Größe, Maße („60 mal 120 Zentimeter“), Farbe, Alter.
  * K4 Telefonat zu einer Kleinanzeige: Ist … noch da? Größe, Alter, Preis, Adresse, Termin („Sind Sie heute zu Hause?“).
  * K5 Strategien: Rückfrage mit „…, nicht?“, „…, oder?“, „…, richtig?“; „Sag mal“, „Schau mal“.
  * K6 Zahlen bis eine Million.
* **Kann-Ziele:** Wohnungsanzeigen mit Abkürzungen verstehen, die eigene Wohnung beschreiben.
* **Wortschatz:** fünf Zimmer, fünf Möbelstücke, Farben, Gegensatzpaare von Adjektiven.

### Pfad 5 — Tagesablauf
* **Grammatik**
  * G1 Trennbare Verben (aufstehen, aufräumen, einkaufen, anrufen, fernsehen, anfangen, abholen) mit Satzklammer, auch in der Ja-/Nein-Frage.
  * G2 Zeitangaben: am (Tag, Tageszeit), um (Uhrzeit), von … bis; Ausnahme „in der Nacht“.
  * G3 Konjugation von anfangen, arbeiten (e-Einschub wie bei finden und kosten), essen, fernsehen, schlafen.
  * G4 Verb auf Position 2 auch bei vorangestellter Zeitangabe (Inversion).
* **Kommunikation**
  * K1 Uhrzeit offiziell und umgangssprachlich: halb, Viertel vor/nach, kurz vor/nach, gleich.
  * K2 Öffnungszeiten erfragen und verstehen.
  * K3 Verabredung: „Hast du Zeit?“, zusagen („Das passt gut“), absagen („Da habe ich keine Zeit“).
  * K4 Vorlieben mit „gern“ und „nicht gern“.
  * K5 Strategien: „Stimmt“, „Ich glaube …“.
  * K6 Wochentage und Tageszeiten.
* **Kann-Ziele:** Über den eigenen Tag sprechen, Öffnungszeiten auf Schildern und in Ansagen verstehen, einen kurzen Lesetext verstehen.
* **Wortschatz:** fünf Alltagsaktivitäten, die Wochentage.

### Pfad 6 — Freizeit und Wetter
* **Grammatik**
  * G1 Akkusativ mit bestimmtem Artikel (den, das, die).
  * G2 Akkusativ mit unbestimmtem Artikel (einen, ein, eine, Plural ohne Artikel).
  * G3 Akkusativ mit Negativartikel (keinen, kein, keine).
  * G4 Antworten auf Ja-/Nein-Fragen mit ja, nein und doch (auch auf verneinte Fragen).
  * G5 Vokalwechsel bei lesen, treffen, nehmen, fahren (Wiederholung: fernsehen, essen, sprechen, schlafen, anfangen).
* **Kommunikation**
  * K1 Hobbys nennen und bewerten („Das macht Spaß“, „Ich finde … toll“).
  * K2 Lieblings…: Buch, Film, Musik, Spiel.
  * K3 Wetter beschreiben: Sonne, Regen, Schnee, Wind, Wolken, Temperatur in Grad; Lieblingswetter; „mag ich gar nicht“.
  * K4 Am Imbiss bestellen.
  * K5 Zustimmen und verneinen.
  * K6 Strategien: „Guck mal“, „Na klar“, „Na gut“, „Kein Problem“, „Moment mal“.
* **Kann-Ziele:** Wetterbericht verstehen, kurze Personenporträts und Interviews über Hobbys verstehen.
* **Wortschatz:** fünf Hobbys, sieben Wetterwörter.

### Pfad 7 — Können, Wollen, Vergangenheit
* **Grammatik**
  * G1 Modalverben können und wollen, ich und er/sie/es ohne Endung.
  * G2 Satzklammer mit Modalverb: Modalverb auf Position 2, Infinitiv am Ende.
  * G3 Perfekt mit haben: ge…t (auch gearbeitet) und ge…en mit Vokalwechsel (getroffen, getrunken, gesprochen, geschrieben).
  * G4 Perfekt mit sein bei Bewegung (gegangen, gefahren, gekommen).
  * G5 Satzklammer im Perfekt, auch in der Frage.
* **Kommunikation**
  * K1 Starken Wunsch äußern („Ich will …“).
  * K2 Vorschlagen („Wollen wir …?“) und reagieren.
  * K3 Fähigkeit mit Abstufung (sehr gut, ein bisschen, nicht so gut, gar nicht).
  * K4 Sich oder das eigene Kind entschuldigen (krank, kann nicht kommen) und darauf reagieren („Gute Besserung“, „Ich sage es der Lehrerin“).
  * K5 Strategien: „Ja, super!“, „Nein, nicht so gern“, „Schade!“.
  * K6 Über gestern, früher und das Wochenende sprechen.
* **Kann-Ziele:** Eine Entschuldigung für den Deutschkurs formulieren, von vergangenen Tätigkeiten erzählen.
* **Wortschatz:** fünf Wörter zum Thema Schule, fünf Aktivitäten im Deutschkurs, fünf Freizeitaktivitäten.

---

## ANHANG B — VORLAGE FÜR `docs/master-4/STATUS.md`

```markdown
# Status Master-Prompt 4.0

| Feld | Wert |
|---|---|
| Letzte Aktualisierung | JJJJ-MM-TT, Phase N |
| Git-Revision | … |
| Aktives Release | … |
| Letzte Migration | NN_….sql |
| Nächste freie Nummer | NN |

## Test-Baseline (Phase 0)
Jest … · DB … · Python … · Playwright … · tsc … · Build …
Bereits rote Tests: …

## Phase N — Titel
- Stand: abgeschlossen | teilweise | blockiert
- Erledigt: …
- Offen (mit Begründung): …
- Abweichungen vom Prompt: …
- Migrationen: NN_…, Rückweg: …
- Nachweise: Testzahlen, Backup-SHA256, Release
- Hinweise für die nächste Phase: …
```

---

## ARBEITSABLAUF

* **S1** — Deine erste Ausgabe im Chat ist eine kurze Bestätigung: „Master-Prompt 4.0 gelesen. Ich führe Phase N aus: X Aufgaben, davon Y mit DB-Änderung. Voraussetzungen laut STATUS.md: erfüllt/fehlt.“ Nicht den Prompt wiederholen.
* **S2** — Zweite Ausgabe, vor jeder Codeänderung: ein Prüfbericht als Tabelle (`Ort | Erwartet | Gefunden | Delta`) für jede Datei, Funktion, Tabelle und Spalte, die die aktuelle Phase nennt. Abweichungen meldest du, bevor du handelst, und passt dein Vorgehen an die Wirklichkeit an, nicht umgekehrt.
* **S3** — Du führst nur die Phase aus, die im Startsatz steht. Innerhalb der Phase gilt die Nummerierung. Die Abhängigkeiten stehen in der Tabelle oben; fehlt eine Voraussetzung, brichst du ab und schreibst das in `STATUS.md`.
* **S3b** — Zu Beginn jeder Phase bestätigst du die Grundregeln R1–R16 und die für die Phase einschlägigen Teile der Design-Richtlinie in je einem Satz. Kein stillschweigendes Voraussetzen.
* **S4** — Nach jedem Meilenstein aktualisierst du die Checkliste in diesem Prompt. `[x]` nur, wenn ein automatisierter Test den Punkt belegt. „Sieht richtig aus“ ist kein Beleg. Oberflächenänderungen belegst du zusätzlich mit Bildschirmfotos auf Handy und Desktop.
* **S5** — Für jede DB-Änderung: Backup nach R8 mit SHA256, Rückweg nach R9, idempotente Migration nach R7, Eintrag in `ORDER`, Test im Klon (zweimal ausführen, Rückweg erproben), produktive Aktivierung nach dem Ablauf mit Schemaänderung, danach `supabase/schema.sql` und `supabase/database.types.ts`.
* **S6** — Für jede Änderung an Speicher oder CPU: vollständige Summenrechnung über alle Container und die App, vorher und nachher (R2). In diesem Auftrag ist keine solche Änderung vorgesehen.
* **S7** — Am Ende der Phase sind alle Punkte der Phase `[x]` oder begründet `[N/A]`, `STATUS.md` ist geschrieben, alles ist committet und gepusht. Ein offener Punkt ohne Begründung gilt als Fehlschlag der Phase.

**Verfügbare Schnittstellen:** Dateisystem und GitHub (Code, Commits, Push auf `codex/vps-self-hosted`) · Playwright (Desktop und Handy, axe-core, Bildschirmfotos) · SSH auf den VPS (`ssh sitov-academy`, Repo unter `/var/www/sitov-academy`) für Migrationen, Builds, Dienste und lesende Datenbankabfragen.
