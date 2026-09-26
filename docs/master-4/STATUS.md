# Status Master-Prompt 4.0

| Feld | Wert |
|---|---|
| Letzte Aktualisierung | 2026-09-26, Phase 4 lokal abgeschlossen und geprüft; kein Deployment |
| Git-Revision | Phase-4-Ausgangsstand `c0eb6cfa7b2d9c2b2d168fdae3af2b8dae090577`; Implementierung und Nachweise im gemeinsamen Abschlusscommit |
| Branch | `codex/vps-self-hosted` |
| Aktives Release | `e6a8d32f4ce74ab20a0ff5a4750927c37c108575` (`/var/www/sitov-current` → `/var/www/sitov-releases/e6a8d32f4ce7`) |
| Health | Letzter dokumentierter Produktionsstand: `ready`; Phase 4 ausschließlich lokal geprüft |
| Letzte Migration | Lokal `36_migrate_old_grammar_progress.sql`; produktiv weiterhin 31, Migrationen 32–36 nicht aktiviert |
| Nächste freie Nummer | **37**, vor Verwendung erneut prüfen |
| Datenbank | Produktiv unverändert PostgreSQL 15.8; Phase 4 mit Backups in isoliertem lokalem PostgreSQL 17.11 und echtem PostgREST 16.4 geprüft |

## Test-Baseline (Phase 0)

| Prüfung | Bestanden | Fehlgeschlagen | Übersprungen |
|---|---:|---:|---:|
| Jest | **1.613** (134 Suites) | 0 | 0 |
| DB | **397** (alle 41 Dateien) | 0 | 0 |
| Python | **64** (61 VPS + 3 TTS) | 0 | 0 |
| Playwright Accessibility | **6** | 0 | 0 |
| `tsc --noEmit` | 1 vollständiger Lauf, Exit 0 | 0 | 0 |
| Build | 1 vollständiger Lauf, Exit 0, 157 statische Seiten | 0 | 0 |

Bereits rote Tests: **Keine fehlgeschlagenen Anwendungs-/DB-Assertions im abschließenden Lauf.** Erstlaufprobleme sind nicht ausgeblendet: Jest übersprang zunächst seinen optionalen echten DB-Smoke; Python einen Test ohne PyYAML; Playwright scheiterte zunächst bei sechs Browserstarts wegen fehlendem Chromium. Alle vorgesehenen Fälle wurden anschließend vollständig ausgeführt: Jest einschließlich rein lesendem Produktions-Smoke über SSH-Tunnel, Python mit temporärem PyYAML, Accessibility über den lokalen Chrome-Channel. Kein Test und kein Filter wurde geändert. Details, Befehle und Grenzen: [TEST-BASELINE.md](TEST-BASELINE.md).

Die sechs Axe-Fälle prüfen öffentliche Home-/Registrierungs-/Abmeldeseiten jeweils hell/dunkel. Sie sind keine vollständige Accessibility-Abnahme der geschützten Lernräume. Die gesonderten schreibenden Docker-/REST-Integrationstools wurden in Phase 0 nicht ausgeführt; alle vorhandenen lokalen DB-/Python-Tests liefen. Der normale Jest-Aufruf enthält weiterhin den vorhandenen bedingten Skip; vollständige Folgeläufe müssen den Smoke explizit aktivieren.

## Phase 0 — Bestandsaufnahme und Design-Richtlinie

- Stand: **abgeschlossen** als Dokumentations- und Baseline-Phase; keine Folgephase ausgeführt.
- Erledigt: Status nach Anhang B; initialer Prüfbericht vor weiteren Dokumenten; vollständiges lokales Inventar; lesender VPS-Bestand; Test-Baseline; D1–D13 mit Token-Orten, Kontrastmessungen und Bewegungsbeispielen; zwölf Vorher-PNGs.
- Offen (mit Begründung): Keine undokumentierte Phase-0-Aufgabe. Bestehende Produkt-/Betriebsabweichungen bleiben für die unten zugeordneten Folgephasen offen. Screenshot- und Testgrenzen sind ausdrücklich dokumentiert.
- Abweichungen vom Prompt: Ergänzende Vollquelle `MASTER-PROMPT-4.md` für Anhang B und D9–D11/D13; Chrome-Channel statt fehlendem Standard-Chromium; künstliche lokale Screenshot-Daten statt einer echten Personensitzung. Kein produktiver Login und keine Personendaten in Bildern. Keine Anwendung geändert, um Prüfungen bestehen zu lassen.
- Migrationen: **keine**; Rückweg/Backup-SHA256: nicht anwendbar, da keine produktive DB-Änderung. Keine Aktivierung oder Ressourcenänderung auf dem VPS.
- Nachweise: [Prüfbericht](PRUEFBERICHT.md), [Code-Inventar](CODE-INVENTAR.md), [VPS-Bestand](VPS-BESTAND.md), [Tests](TEST-BASELINE.md), [Designrichtlinie](../design/lernraum-designrichtlinie.md), [Bilder](ist/README.md).
- Git-Abgabe: ausschließlich diese Dokumentation und PNGs im Abschlusscommit auf `codex/vps-self-hosted`; Veröffentlichung auf `origin/codex/vps-self-hosted`, kein App-Deployment.

### Checkliste 0.1–0.4

- [x] `STATUS.md` gemäß vorhandener Anhang-B-Vorlage angelegt; Git, Release, Health, Migration und freie Nummer ermittelt.
- [x] Matrix `Ort | Erwartet | Gefunden | Delta` für die genannten Dateien, Funktionen, Tabellen und Spalten erstellt; Abweichungen oben im Prüfbericht den Phasen zugeordnet.
- [x] A1.1-Lektionen und thematische Reihenfolge, Grammatikzahlen je Niveau, `exercise_type`, Content-Constraint und vier vollständige Spalteninventare auf dem VPS lesend erhoben.
- [x] Lösungs-Auslieferung durch Quellpfad bis zur Client-Grenze und synthetischen Parser-Kontrollaufruf nachgewiesen; Live-Sichtbarkeitsgrenze dokumentiert.
- [x] Vollständige Jest-, DB-, Python-, TypeScript-, Build- und Accessibility-Läufe; Pass/Fail/Skip und anfängliche Infrastrukturprobleme erfasst.
- [x] D1–D13, bestehende Tokens/Klassen mit Dateiorten, neue Modus-Paare als Vorschlag, 20 WCAG-Kontrastberechnungen und drei Framer-Beispiele dokumentiert.
- [x] Home, Niveau, Vokabeln, Grammatik, Aussprache und Mediathek je Desktop und Handy aufgenommen: **12 PNGs**, HTTP 200, visuell geprüft, Abmessungen/SHA256 und reproduzierbarer Fixture-Aufbau dokumentiert.
- [x] Dokumentationsumfang geprüft: keine Änderung an Anwendung, Schema, Typen, Tests, Konfiguration oder Prompt-Dateien; generierte `next-env.d.ts`-Abweichung zurückgenommen.

### Verbindliche Übergabe für die nächste Phase

**A1.1-Wortschatz:** **7 aktive gemeinsame Lektionen, 512 Karten**. Lektion 1–7 hat 84 / 85 / 76 / 73 / 68 / 80 / 46 Karten. Wortfelder in Reihenfolge: Kennenlernen; Familie/Person; Einkaufen; Wohnen; Tagesablauf; Freizeit/Wetter; Können/Wollen/Vergangenheit. Die thematische Zuordnung passt zu den sieben Zielpfaden. Private eigene Wörter wurden nicht als Kurslektionen gezählt. Lernzielvollständigkeit und Herkunft von Alttexten sind separat zu prüfen (R14).

**Lösungen vor der Antwort:** **Ja, der Grammatik-Datenpfad liefert bei darstellbaren Aufgaben Lösungsfelder an den Browser.** `grammarSelection='*'` → Parser behält `correct_answer` / bei Lückentext `accepted_answers` → `getExercises()` gibt `content` weiter → Server-Route übergibt an `ExerciseClient`. Die Bewertung läuft bereits in PostgreSQL. Aktuell sind live **604/604 Aufgaben `incomplete`**, deshalb werden sie Lernenden nicht gezeigt; das löst den strukturellen R5-Verstoß nicht. Phase 3 braucht einen lösungsfreien Lesevertrag und muss direkte Tabellenzugriffe mitprüfen.

| Abweichung / Entscheidung | Folgephase |
|---|---|
| `submit_self_rating` zuletzt Migration 23; `check_retry_answer` (nicht `check_retry`) aus 22; `record_attempt` aus 06 mit zusätzlichem Guard aus 07. Kopieren allein aus Zwischenbericht würde Änderungen verlieren. | 1 / 3 / 5 |
| 60 aktive Grammatik-Units, 604 Aufgaben; sechs Niveaus je zehn Units. Aufgaben: 102/101/101/100/100/100, sämtlich `incomplete`; B2/C1/C2 ohne Grammatikbestand. Alter 600er-Seed hat keine `target_form`. | 3 / 4 |
| `exercise_type`: `fill_in_blank`, `multiple_choice`, `sentence_building`. `content_version=1`, JSON-Objekt und `valid_accepted_answers` beschränken heutigen Inhalt. | 3, Enum-Erweiterung separat vorgeschaltet |
| `schema.sql` veraltet; generischer DB-Testhelfer nur bis 06; historische Rollback-Dateilücken. | Alle späteren DB-Phasen |
| `sitov-mail.service` inaktiv seit 12:36:29 UTC, Exit 0; App/NGINX/TTS aktiv. Nicht neu gestartet. `profiles.notify_pronunciation_feedback` fehlt. | 6 / 8; Betrieb und Zustellung vor Mail-Abnahme klären |
| Touch-/Schriftgrößen, Dauerpulse, Breadcrumbs, Dock und Scrollleiste weichen vom neuen Soll ab; konkrete Fundorte in Richtlinie. Mobile Vokabelaufnahme 415 px bei 390-px-Viewport: horizontaler Überstand dokumentiert. | 2 / 8 |
| Antwort-Einsprüche und zusätzlicher Staff-Hinweis bei Niveauabschluss sind veraltete Zwischenbericht-Vorschläge; aktuelle Split-Prompts schließen sie ausdrücklich aus. | 6 / 7: aktuellen Phasenprompt befolgen |
| Reines Docs/Seed/Test-Delta zwischen lokalem Stand und aktivem Release. Phase 0 veröffentlicht Dokumente, aktiviert kein neues Release. | Vor späterem Deployment erneut Revisionen vergleichen |

Die obigen Angaben dokumentieren die abgeschlossene Phase-0-Ausgangslage. Der anschließende Phase-1-Stand folgt hier; Phasen 2–8 wurden nicht ausgeführt.


## Phase 1 — Schnelle Korrekturen und Bewertung

Stand: **abgeschlossen und produktiv aktiviert**. Ausschließlich Phase 1 ausgeführt. Ausgangsrevision `81c7a40710b9963a95aa3f633f17ea5b75d59f25`, unverändert auf `codex/vps-self-hosted`. [Prüfbericht](PHASE-1-PRUEFBERICHT.md), [R15-/Registrierungs-Audit](phase-1-actions-signup.md), [Varianten-Audit](varianten-audit.md), [Vorher/Nachher-Bilder](phase-1-bilder/README.md).

- [x] 1.1 Beide Lern-Knopfpaare getauscht; app-weites R15-Audit umgesetzt; DOM-Tests inklusive gemeinsamer Dialoge.
- [x] 1.2 Neue serverseitige Bewertung, neutrale Hinweise in fünf Sprachen, vollständige Intervalle/Punkte bei Großschreibung/Satzzeichen; Umlaut/Tippfehler und Distraktoren geprüft; Vorschau und Oberfläche aktualisiert.
- [x] 1.3 Wiederverwendbarer Artikel-Chip vor der deutschen Eingabe; serverseitiges Artikel-Feedback und farbige Lösung; Plural-/Komponententests.
- [x] 1.4 `target_form text[]` in DB/CMS/Trainer; alle 26 aktiven gemeinsamen Satzkarten geprüft; 15 Entscheidungen (7 Zielformen, 8 Alternativen) samt idempotenter Übernahme und Datenarchiv.
- [x] 1.5 Registrierung und E-Mail-Bestätigung mit hervorgehobener Erklärung; große Freischaltungs-Karte in fünf Sprachen; Hilfe/Kalender zugänglich; Tests mit/ohne Niveau.
- [x] Migrationen und Rückwege angelegt, `ORDER`, vollständiger aktueller Schema-Snapshot und generierte öffentliche Typen aktualisiert.
- [x] Finale Abnahme: 1.680 Jest-Tests (138 Suites), 413 DB-Tests (43 Dateien), 64 Python-Tests, 6 bestehende Playwright-Axe-Fälle und 28 erweiterte Axe-Ansichten; Build und TypeScript grün, kein Skip.
- [x] Finale doppelte Anwendung im echten PostgreSQL-Klon mit identischen Schema-/Typenprüfsummen; Rückweg und Wiederanwendung geprüft, Varianten-Audit ohne offene Fälle.
- [x] Produktionsbackup und Aktivierung mit Schemaänderungsablauf; lokaler/öffentlicher Health-Endpunkt `ready`, Live-Schema und Typen identisch zum geprüften Klon.
- [x] Abschlussnachweise und Git-Abgabe: Implementierung `e6a8d32` auf `origin/codex/vps-self-hosted`; endgültige Betriebsnachweise im separaten Dokumentationscommit.

### Verbindliche Übergabe

Belegt: **30_fair_answer_grading.sql** und **31_vocabulary_target_forms.sql**, jeweils mit Datei unter `supabase/vps/rollback/`. Nächste freie Nummer **32**, vor Verwendung erneut prüfen. Die historischen Enum-Werte bleiben aus Kompatibilitätsgründen in PostgreSQL erhalten; neu erzeugte Soft-Ergebnisse verwenden nur `umlaut` und `typo`.

`grade_answer` liefert `status`, `matched`, `reason` und `hint`. `EXACT` hat `reason:null` und optional einen neutralen `hint` (`capitalization`, `punctuation`, `capitalization_punctuation`); Typografiegleichheit allein hat `hint:null`. `SOFT_ERROR` hat `reason:umlaut|typo` und `hint:null`. `INCORRECT` hat `matched:null`, `reason:null`, `hint:null`. Großschreibung/Satzzeichen dürfen keine Punkt-/Intervallkürzung verursachen. Exakte falsche Distraktoren sind immer `INCORRECT`. Artikel bleiben Lernziel; die Vokabel-RPC ergänzt `feedback:article_missing|article_wrong|null`, auch bei Wiederholungen. Zahlenvarianten und Wortstellung werden ausschließlich pro Aufgabe festgelegt.

Phase 4 verwendet diesen Vertrag für alle Schreibaufgaben. Aufgaben zur Unterscheidung der Großschreibung (Sie/sie) bleiben für Phase 4 Auswahlaufgaben; diese Phase ergänzt dafür keinen neuen Aufgabenbestand. Phase 3 muss weiterhin den in Phase 0 belegten Grammatik-Lesevertrag ohne vorab ausgelieferte Lösungen herstellen. Die neuen Variantenentscheidungen stehen vollständig in [varianten-audit.md](varianten-audit.md).


### Betrieb und Backup nach Phase 1

- Produktivbackup: `/root/backups/sitov-migration-20260925T204937355350Z`, vollständig mit 549 Storage-Objekten. PostgreSQL-SHA256 `8654a4cb2e2c8acc51987447b1f18eeac5dfc1b029550f3825c4d47dd621cd21`; Storage-Manifest-SHA256 `dd923e99ed6fc35b9c6714c5e8f43f59b0693a1bf19be915e0f6dcc54f39c269`.
- Aktivierung: vorbereitetes Release `e6a8d32f4ce7`, Migration mit `--keep-stopped`, Aktivierung mit `--schema-changed`; App aktiv und beide Health-Endpunkte `ready`. Migrationsdatei-Prüfsummen und Live-Schemaabgleich im [Prüfbericht](PHASE-1-PRUEFBERICHT.md).
- Live-Varianten-Audit: 512 aktive gemeinsame Karten / 26 Satzkarten / 15 Meldungen / **0 offen**. Nächste freie Migration **32**.
- Keine RAM-/Netzwerkgrenzen geändert; keine Hintergrunddienste ergänzt. Temporärer Klon nach erfolgreicher Abnahme entfernt, lokale QA-Prozesse und SSH-Forward beendet; Backups bleiben geschützt erhalten.
- Bestehender Befund: `sitov-mail.service` weiterhin inaktiv (wie vor Phase 1), gemäß vorhandenem Release-Verfahren nicht automatisch gestartet. Zustellbetrieb bleibt für Phase 6/8 zu prüfen; keine Testmails, Konten oder Nutzeranmeldungen angelegt. Phasen 2–8 und ihre offenen Bestandsbefunde bleiben unverändert zugeordnet.


## Phase 2 — Navigation und Design-System

Stand: **umgesetzt und lokal vollständig getestet**; produktive und ergänzende Abnahme bleibt offen (siehe unten). Ausgangsrevision `3271a12`, Testbasis `6bdb3c9`. [Prüfbericht](PHASE-2-PRUEFBERICHT.md).

- [x] 2.1 D4-Tokens in `app/globals.css` (`--motion-fast|base|slow|slower`, `--motion-stagger`, `--ease-out-soft`); `lib/motion.ts` (`MOTION`, `EASE_OUT_SOFT`, `SPRING` 420/34 mit Ruhe-Schwelle ≤500 ms, `STAGGER`, Varianten, `useReducedMotionSafe`, `useIsHydrating`); `MotionConfig reducedMotion="user"` über `components/motion/MotionProvider`. Bausteine `components/motion/{PressableCard,CountUp,NewBadge,SlidingPill,FeedbackMotion}`. Modus-Tokens `--mode-{vocabulary,path,pronunciation,media,special}-{surface,text}` in allen vier Paletten, Kontrasttest erweitert.
- [x] 2.2 `components/dashboard/ModeDock.tsx` im Niveau-Layout (Zähler per Suspense). **Modus-Ziele für Phase 3: `lib/mode-targets.ts` → `MODE_SEGMENTS.path` (heute `exercises`).**
- [x] 2.3 Niveau-Seite: `ResumeCard` + vier Modus-Karten; `LevelPath` → `components/vocabulary/VocabularyLessons.tsx` unter `/vocabulary/lessons` („Lektionen“), Unteransicht `VocabularyTabs`; „Lernweg“ in fünf Sprachen/Kommentaren ersetzt, Grep-Test `__tests__/lessons-rename.test.ts`.
- [x] 2.4 Brotkrumen mit vollem Pfad (`lib/breadcrumbs.ts`, `DASHBOARD_ROUTE_KEYS` um Lernpfad/Pfad n/Knoten/Test/Mediathek/Kalender erweitert).
- [x] 2.5 `data-tabbar` am Shell-Element, `--st-tabbar-visible`; Aufnahme-Dock wandert mit.
- [x] 2.6 Migration `32_last_active_level.sql` + Rückweg, `ORDER`, `schema.sql`/`database.types.ts` (Funktion von Hand im Exportformat ergänzt, kein Klon-Export). Home „Deine Lernbereiche · A1.2“, Reiter „Lernen“ über RPC, `localStorage` nur Rückfall.
- [x] 2.7 D5 auf Home, Niveau, Dock, Brotkrumen, Lernbox, Antwort-Rückmeldung; Reduced-Motion schaltet im Lernraum alle Animationen ab.

Tests: **1.792 Jest**, **423 DB**, **177 Playwright** (Desktop/Pixel 7/iPhone 14 mit WebKit), jeweils vollständig grün ohne Skip; Build und TypeScript Exit 0. Übersetzungsfix `6bdb3c9` abgesichert, Vokabel-Fachnummern nach ausdrücklicher Freigabe kontrastreich und ohne Textüberlagerung dargestellt. **Separat offen:** echter Aussprache-Gateway-Auth-/RLS-Lauf, formale Vorher/Nachher-Bilder und Lighthouse (kein Phase-0-Vergleichswert vorhanden). **Migration 32 nicht produktiv angewendet**: Backup/`--apply 32_last_active_level.sql --keep-stopped`/`--activate --schema-changed` wie Phase 1; außerdem echter Klon-Export von Schema/Typen. Nächste freie Nummer **33**. Der lokale Testabschluss ist keine produktive Aktivierung.

### Phase-2-Testnachprüfung ab `6bdb3c9` — 26.09.2026

- [x] Tests/Testinfrastruktur und Nachweise repariert; zusätzlich ausdrücklich freigegebene CSS-Kontrastkorrektur der Vokabel-Fachnummern. Übersetzungsfix `6bdb3c9` durch neue Jest- und Browserregressionen geprüft.
- [x] Vollständiger Jest-Lauf: **1.792/1.792**, 142 Suites, kein Skip; vorhandenen rein lesenden VPS-Smoke explizit aktiviert.
- [x] Vollständiger lokaler DB-Lauf: **423/423**, kein Skip; Build und TypeScript Exit 0.
- [x] Veraltete LevelCard-Assertion, WebKit-Safe-Area-Emulation und mobiles Scrollen im Test repariert; iPhone verwendet WebKit. Aussprache-UI-Prüfungen gegen künstliche Daten in allen Projekten und beiden Themes grün; echter Gateway-Auth-/RLS-Lauf bleibt separat offen.
- [x] Vollständiger abschließender Playwright-Lauf: **177/177**, kein Skip, kein Retry, keine Axe-Filter; Desktop und Pixel 7 in Chrome, iPhone 14 in WebKit. Alle vier vorherigen Kontrastbefunde behoben; zusätzliche Überlappungsprüfung für Fachnummern auf allen drei Geräten. Details im [Prüfbericht](PHASE-2-PRUEFBERICHT.md).
- [x] Lokaler Testabschluss und Git-Abgabe: dieser Commit auf `codex/vps-self-hosted`; keine weiteren Phasen implementiert, kein Deployment.

Migration/Produktivaktivierung, echte Gateway-Integration sowie Screenshot-/Lighthouse-Abnahme bleiben wie oben offen. Keine Produktivdaten verändert.

## Phase 3 — Lernpfad-Infrastruktur

Stand: **im ausdrücklich beauftragten Infrastrukturumfang lokal abgeschlossen**. Keine Phase 4 ausgeführt. Der Zusatzauftrag beschränkt diesen Durchlauf auf Architektur, Tabellen, RPCs, Enums und Zod-Verträge. Neue Lernseiten, Routenwechsel und CMS-Oberfläche aus 3.5/3.6 wurden deshalb nicht implementiert. Der vollständige ursprüngliche UI-Abnahmeumfang von Phase 3 ist damit noch nicht erreicht.

Ausgangsrevision `a25f828`; [Prüfbericht](PHASE-3-PRUEFBERICHT.md), [Seed-/Aufgabenvertrag](PHASE-3-SEED-VERTRAG.md), [PostgreSQL-Nachweise](phase-3-db-nachweise.json). Gemeinsamer lokaler Abschlusscommit; kein Push und kein Deployment.

- [x] 3.1 Serielle Pfad-/Knotenfreigabe, mindestens 80 % zum Bestehen, Spezial-Zweige ohne Sperrwirkung, Erstversuch-Sterne mit Bestwert, wiederholbare/fortsetzbare Knoten. Niveaus bleiben ausschließlich durch Lehrkraft freigeschaltet; keine Abschlussbenachrichtigung.
- [x] 3.2 Vorgeschaltete Enum-Migration **33**, alle neun Typen mit passenden SQL-/Zod-Verträgen und PostgreSQL-Bewertung, `SOFT_ERROR` richtig, optionales `needs_article`, lokale Offline-Audio-Infrastruktur.
- [x] 3.3 Datenmodell, Übersetzungen, RLS, RPC-Schreibgrenze, Archivierung der alten Grammatik-Units aller Niveaus; Niveau-/Gesamtreset und Browserinvalidierung erweitert.
- [x] 3.4 Karte-/Knoten-/Test-/Staff-RPCs, lösungsfreie Startantworten, blockierter Alt-RPC-Zugriff, idempotente Antwortbelege, eingefrorene Aufgaben, Testauswahl mit jedem Lernziel und garantierter anderer Folgeauswahl. Alle zugehörigen DB-Tests grün.
- [x] 3.6 Backend-Grundlage für spätere Pflege: validierender Pfadimport und Export im vorhandenen Seedformat; Archivierung statt Löschen. CLI-Importbefehl vorbereitet, nicht ausgeführt.
- [x] R7–R9: Runner-Reihenfolge 33 → 34 → 35, Rückwege, echter Schema-/Typenkatalog, doppelte Migration, Rückweg und Wiederanwendung im isolierten PostgreSQL-Klon; 13 geprüfte synthetische Backups, echte parallele Sitzungen.
- [x] Abschluss: **460/460 DB-/Offline-Audio-Tests**, **54/54 gezielte Jest-Tests**, **64/64 Python-Tests**, jeweils ohne Skip; TypeScript und Build Exit 0. Kein Testfilter hinzugefügt. Bestehende zeitabhängige Last-active-Fixture deterministisch gemacht.
- [ ] 3.5 Lernkarte, Knoten-/Testansichten, Weiterleitung, Dock-Ziel, Brotkrumen, Animationen und neue Playwright-/Axe-Fälle: außerhalb dieses Infrastrukturauftrags.
- [ ] 3.6 CMS-Oberfläche mit Vorschau und Bearbeitung: außerhalb dieses Infrastrukturauftrags; Backend-Verträge stehen bereit.

### Migrationen und Betrieb

Neu: `33_path_exercise_types.sql`, `34_path_content_contract.sql`, `35_path_learning.sql`, jeweils mit Datei unter `supabase/vps/rollback/`. Nächste freie Nummer **36**. Produktiv wurden weder 32 noch 33–35 angewendet. Die neuen Migrationen archivieren alte Grammatik-Units und dürfen erst zusammen mit dem passenden Lernpfad-UI-Release aktiviert werden. Kein RAM-Limit, Dienst, Hosting oder Produktionsinhalt wurde verändert.

Klon: lokales PostgreSQL **17.11**, ausschließlich synthetische Daten; kein VPS-/Produktionsklon. Migrationen zweimal und nach Rückweg erneut mit identischem Schema. Zwei parallele echte Sitzungen liefern denselben Knotenlauf und denselben Antwortbeleg, genau eine Wertung. Migrationen- und Backup-SHA256 im [Nachweis](phase-3-db-nachweise.json). Die konkrete PostgreSQL-15.8-Abnahme bleibt vor einer späteren produktiven Aktivierung erforderlich.

`supabase/schema.sql` stammt aus dem abschließend geprüften PostgreSQL-Klon; SHA256 **e2e956b43d2896563f094dbea45690feb60781b0084f97a79d52377ef93a46d8**. Der Snapshot enthält weiterhin sämtliche 741 bisherigen Objektmarker plus neue Objekte. Die betroffenen öffentlichen Typen in `database.types.ts` wurden über `deploy/vps/export-path-types.py` aus dem echten Klon-Katalog erzeugt. Der vollständige Snapshot wurde mit PostgreSQL 17 exportiert und ist ein Referenzartefakt; produktive Änderungen erfolgen ausschließlich über den Migrationsrunner.

Rückweg: 35 deaktiviert neue RPCs/Pfade und stellt alte Funktionen sowie alte Unit-Aktivierungen wieder her; sämtliche neuen Pfaddaten bleiben erhalten. 34 bricht den vollständigen Rückweg ausdrücklich ab, falls schon Aufgaben der sechs neuen Typen existieren; dann ist das gesicherte Backup der vollständige Rückweg. Zusätzliche Enumlabels bleiben nach 33 erhalten. Nichts wird per `CASCADE` gelöscht.

### Verbindliche Datenmodell-Übergabe

| Tabelle | Spalten |
| --- | --- |
| `learning_units` — neue Spalten | `is_path`, `path_source_id`, `path_slug`, `path_title`; bestehende `id`, `level`, `trainer='exercises'`, `label`, `sort_order`, `is_active` bleiben maßgeblich |
| `learning_exercises` — neue Spalten | `node_id`, `goal_id`, `source_ref`, `sort_order`, `path_is_active`, `explanation_card`; bestehende `type`, `content`, `unit_id`, `content_version`, `content_status` bleiben |
| `grammar_translations` — neue Spalte | `instruction`; vorhandene `exercise_id`, `locale`, `hint`, `smart_hint`, `explanation`, `prompt` bleiben |
| `path_unit_translations` | `unit_id`, `locale`, `title` |
| `path_objectives` | `unit_id`, `id` (Quellkennung), `area`, `description` |
| `path_nodes` | `id`, `unit_id`, `source_id`, `kind`, `sort_order`, `title`, `topic`, `merkkarte`, `goals`, `anchor_node_id`, `test_size`, `is_active`, `created_by`, `created_at`, `updated_at` |
| `path_node_translations` | `node_id`, `locale`, `title`, `rule` |
| `path_node_progress` | `auth_user_id`, `node_id`, `status`, `best_stars`, `first_attempt_accuracy`, `created_at`, `updated_at`, `completed_at` |
| `path_practice_runs` | `id`, `auth_user_id`, `node_id`, `status`, `queue`, `total`, `first_correct`, `created_at`, `updated_at`, `completed_at` |
| `path_test_attempts` | `id`, `auth_user_id`, `node_id`, `status`, `selected_exercise_ids`, `percentage`, `passed`, `created_at`, `completed_at` |
| `path_test_answers` | `attempt_id`, `exercise_id`, `answer`, `result`, `answered_at` |
| `path_interventions` | `id`, `auth_user_id`, `unit_id`, `node_id`, `action`, `created_by`, `created_at` |
| `path_private.practice_items` | `run_id`, `exercise_id`, `snapshot`, `attempts`, `solved`, `first_correct` |
| `path_private.test_items` | `attempt_id`, `exercise_id`, `snapshot`, `position` |
| `path_private.answer_receipts` | `run_id`, `request_id`, `exercise_id`, `answer`, `response` |
| `path_private.function_backups`, `content_contract_backups` | `signature`, `definition`; ursprüngliche Funktionsdefinitionen für den Rückweg |
| `path_private.archived_units`, `rollback_unit_flags` | `unit_id`, `is_active`; gesicherte Aktivierungsstände |

Enums: `exercise_type` erweitert um `multi_blank`, `matching`, `categorize`, `dialogue`, `listening`, `transform`; neu `path_node_kind` (`practice`, `review`, `test`, `special`), `path_progress_status` (`in_progress`, `completed`), `path_run_status` (`active`, `completed`, `abandoned`), `path_intervention_action` (`unlock`, `reset_path`, `reset_test`), `path_objective_area` (`grammar`, `communication`, `can_do`, `vocabulary`).

Öffentliche JSONB-RPCs: `get_learning_path(p_level,p_locale)`, `start_path_node(p_node_id,p_locale,p_restart)`, `submit_path_answer(p_run_id,p_exercise_id,p_answer,p_request_id,p_locale)`, `start_path_test(p_node_id,p_locale)`, `submit_path_test_answer(p_attempt_id,p_exercise_id,p_answer)`, `finish_path_test(p_attempt_id,p_locale)`, `manage_learning_path(p_student_id,p_unit_id,p_action,p_node_id)`, `import_learning_path(p_path)`, `export_learning_path(p_unit_id)`. Locale-Standard `de`, Restart-Standard `false`. Alle prüfen die aufrufende Identität; fremde IDs verleihen keine Berechtigung.

### Verbindliche Seed-/Befehls-Übergabe

Der vorhandene Seed bleibt unverändert: **7 Pfade, 85 Knoten, 769 Aufgaben, 87 Lernziele**, SHA256 **d5d954b7579ababef29876eb5321757d722194bd096ae44bf1ab925864c99a0c**. Kein neuer JSON-Seed wurde erstellt. Der neue Import wurde nicht ausgeführt. Der unveränderte Alt-Regressions-Test verwendet seine bestehende kurzlebige Altschema-Testdatenbank; das ist kein Phase-4-Import.

`node scripts/path-seed.mjs` validiert ausschließlich. Der für Phase 4 vorbereitete Importbefehl ist **`node scripts/path-seed.mjs supabase/seeds/path-a1.1.json --import`**; er benötigt ausdrücklich einen lokalen Endpunkt und eine authentifizierte Staff-Sitzung. Alle neun JSON-Formate, Antwortformen, Merkkarten-/Übersetzungsfelder, Source-ID-Zuordnung und Umgebungsvariablen sind im [Seed-/Aufgabenvertrag](PHASE-3-SEED-VERTRAG.md) vollständig beschrieben.

`node scripts/path-listening-audio.mjs` ist ebenfalls nur eine Prüfung. Voraberzeugung/Upload benötigen ausdrücklich `--generate --output <Verzeichnis>` bzw. `--upload --output <Verzeichnis>`. Der private Bucket heißt `path-audio`. Der reale A1.1-Seed hat derzeit **0 Hörübungen**; es wurden keine Dateien erzeugt oder hochgeladen.

## Phase 4 — Lernpfad: Inhalte A1.1

Stand: **lokal abgeschlossen und geprüft**. Ausschließlich Phase 4; kein Deployment, keine Produktionsmigration. Ausgangsrevision `c0eb6cfa7b2d9c2b2d168fdae3af2b8dae090577`. [Prüfbericht](PHASE-4-PRUEFBERICHT.md), [Import-Anleitung](phase-4-import.md), [DB-/Backup-Nachweise](phase-4-db-nachweise.json), [Browserbilder](phase-4-bilder/README.md).

- [x] **4.1 Import:** `scripts/import_learning_path.ts` mit vollständiger Zod-Validierung, expliziter lokaler Service Role, geprüftem frischem Backup, Zeitlimit und Ergebnisprüfung. Atomare Batch-RPC verwendet bestehende Quellkennungen/UUIDs. Drei echte lokale CLI-Importe einschließlich Wiederholung und Rückweg/Wiederanwendung erfolgreich. Seed unverändert.
- [x] **4.1 Datenbestand:** **7 Pfade, 85 Knoten, 769 Aufgaben, 87 Lernziele**, dazu 35 Pfad-, 425 Knoten- und 3.845 Aufgabenübersetzungen. Vollständiger DB-Export entspricht dem Seed; wiederholte Importe behalten die IDs.
- [x] **4.2 Merkkarten:** Neue Lernpfadansicht in der bestehenden Übungen-Route; blaue Merkkarten aus dem Seed vor Übungsbeginn, vorhandene Tokens, fünf Sprachen, Tastaturbedienung und mindestens 48px große Aktionen.
- [x] **4.3 Aufgaben/Bewertung:** Auswahl, Lückentext und Satzbau aus dem Seed bedienbar; lösungsfreie Startdaten und Bewertung ausschließlich in PostgreSQL. Browserabnahme des gesamten ersten Pfads: **78 Übungs-/Wiederholungsaufgaben**, darunter 36 Lückentexte und drei ausdrücklich mit Großschreibungs-/Satzzeichenabweichung beantwortete Aufgaben. Zehn Übungs-/Wiederholungsknoten mit drei Sternen; **16 Testaufgaben, 100 %**, danach Pfad 2 freigeschaltet.
- [x] **4.4 Altdaten:** **36_migrate_old_grammar_progress.sql** statt der bereits belegten Nummer 31, mit Rückweg. Alle alten Grammatik-Units archiviert; ursprüngliche Fortschritte unverändert erhalten. Keine unzuverlässige Abschlusszuordnung anhand von Lektionsnummern. Neue Pfade beginnen ohne übernommene Abschlüsse; schon vorhandener neuer Lernpfadfortschritt bleibt erhalten. Einmalige, nur für Staff lesbare Lehrkraft-Notiz je Person/Niveau, Erklärung in fünf Sprachen.
- [x] **Backup/Idempotenz/Rückweg:** `migrate-local.py`-Adapter mit geprüften lokalen `pg_dump`-Backups, doppelte DDL-Anwendung, Rückweg und Wiederanwendung erfolgreich. Rückweg erhält Inhalte, Fortschritt, Versuche und Notizen. Schema-Snapshot und öffentliche Typen aus echtem PostgreSQL aktualisiert; nächste freie Nummer **37**.
- [x] **Abnahme:** **1.862 Jest-Tests / 145 Suites**, **482 DB-/Node-Tests**, **64 Python-Tests**, **3 Playwright-Fälle mit sieben vollständigen Axe-Scans**; jeweils 0 Fehler und 0 Skips. TypeScript und Produktionsbuild mit 157 statischen Seiten erfolgreich. Desktop und Mobil hell/dunkel visuell geprüft.
- [x] **Dokumentation/Git:** Prüfbericht vor Änderungen, Bedienung und Rückweg, Prüfsummen, Backup-Zähler und Bilder dokumentiert; Implementierung und Nachweise im gemeinsamen Phase-4-Abschlusscommit.

### Übergabe

Der aktuelle Importbefehl lautet **`npm run seed:learning-path -- --import --backup-dir /absoluter/pfad/zum/frischen/backup`** mit `PATH_SEED_SUPABASE_URL` und `PATH_SEED_SERVICE_ROLE_KEY`. Ohne `--import` erfolgt ausschließlich lokale Validierung. Die Phase-3-Staff-Importfunktion bleibt kompatibel; der neue CLI verwendet die Service-Role-RPC `import_learning_path_seed(p_paths jsonb)` für den vollständigen atomaren Seed. `path_legacy_progress_notes` enthält die geschützten Lehrkraft-Notizen.

Die lokale Umgebung verwendet PostgreSQL **17.11** und echtes PostgREST **16.4**, künstliche Benutzer und einen synthetischen Auth-Endpunkt; sämtliche Import-, RLS- und Bewertungsaufrufe gehen an die echte Datenbank. Sie ist eine isolierte Testumgebung und wird nach der Abnahme beendet. Produktion bleibt auf Migration 31 und dem bisherigen Release; Aktivierung von 32–36 und dem passenden UI-Release wurde nicht beauftragt. Die sechs zusätzlichen Phase-3-Aufgabenformen sind nicht im Seed enthalten; ihre Oberfläche wurde in Phase 4 nicht vorgezogen. Phasen 5–8 wurden nicht ausgeführt.

Anfängliche Typ-/Logging-Probleme, die korrigierte Antwortform bei ungültigen Testantworten und ein Browser-Testproblem beim Lesen gestreamter Response-Bodys sind im Prüfbericht offen dokumentiert. Alle finalen Prüfläufe sind grün; keine Assertions oder Sicherheitsprüfungen wurden ausgeblendet.
