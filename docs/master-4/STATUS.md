# Status Master-Prompt 4.0

| Feld | Wert |
|---|---|
| Letzte Aktualisierung | 2026-09-25, Phase 1 — Implementierung und Abnahme |
| Git-Revision | Phase-1-Ausgang `81c7a40710b9963a95aa3f633f17ea5b75d59f25`; Implementierung vor Veröffentlichung vollständig lokal geprüft |
| Branch | `codex/vps-self-hosted` |
| Aktives Release | `5f12313ac51e1f4fbe5fd04eb01d6ccefebaa90c` (`/var/www/sitov-current` → `/var/www/sitov-releases/5f12313ac51e`) |
| Health | Loopback und `https://www.sitov-academy.com/api/health`: `ready` |
| Letzte Migration | `29_student_level_access_notification.sql`; Registry und Live-Trigger/Enum geprüft |
| Nächste freie Nummer | **32**, vor Verwendung erneut prüfen; Phase 1 belegt 30 und 31 |
| Datenbank | PostgreSQL 15.8; ausschließlich lesende Live-Abfragen |

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

Stand: **implementiert und vollständig geprüft; produktive Aktivierung ausstehend**. Ausgangsrevision `81c7a40710b9963a95aa3f633f17ea5b75d59f25`, unverändert auf `codex/vps-self-hosted`. [Prüfbericht](PHASE-1-PRUEFBERICHT.md), [R15-/Registrierungs-Audit](phase-1-actions-signup.md), [Varianten-Audit](varianten-audit.md), [Vorher/Nachher-Bilder](phase-1-bilder/README.md).

- [x] 1.1 Beide Lern-Knopfpaare getauscht; app-weites R15-Audit umgesetzt; DOM-Tests inklusive gemeinsamer Dialoge.
- [x] 1.2 Neue serverseitige Bewertung, neutrale Hinweise in fünf Sprachen, vollständige Intervalle/Punkte bei Großschreibung/Satzzeichen; Umlaut/Tippfehler und Distraktoren geprüft; Vorschau und Oberfläche aktualisiert.
- [x] 1.3 Wiederverwendbarer Artikel-Chip vor der deutschen Eingabe; serverseitiges Artikel-Feedback und farbige Lösung; Plural-/Komponententests.
- [x] 1.4 `target_form text[]` in DB/CMS/Trainer; alle 26 aktiven gemeinsamen Satzkarten geprüft; 15 Entscheidungen (7 Zielformen, 8 Alternativen) samt idempotenter Übernahme und Datenarchiv.
- [x] 1.5 Registrierung und E-Mail-Bestätigung mit hervorgehobener Erklärung; große Freischaltungs-Karte in fünf Sprachen; Hilfe/Kalender zugänglich; Tests mit/ohne Niveau.
- [x] Migrationen und Rückwege angelegt, `ORDER`, vollständiger aktueller Schema-Snapshot und generierte öffentliche Typen aktualisiert.
- [x] Finale Abnahme: 1.680 Jest-Tests (138 Suites), 413 DB-Tests (43 Dateien), 64 Python-Tests, 6 bestehende Playwright-Axe-Fälle und 28 erweiterte Axe-Ansichten; Build und TypeScript grün, kein Skip.
- [x] Finale doppelte Anwendung im echten PostgreSQL-Klon mit identischen Schema-/Typenprüfsummen; Rückweg und Wiederanwendung geprüft, Varianten-Audit ohne offene Fälle.
- [ ] Produktionsbackup und Aktivierung mit Schemaänderungsablauf.
- [ ] Abschlussnachweise und Git-Abgabe.

### Verbindliche Übergabe

Belegt: **30_fair_answer_grading.sql** und **31_vocabulary_target_forms.sql**, jeweils mit Datei unter `supabase/vps/rollback/`. Nächste freie Nummer **32**, vor Verwendung erneut prüfen. Die historischen Enum-Werte bleiben aus Kompatibilitätsgründen in PostgreSQL erhalten; neu erzeugte Soft-Ergebnisse verwenden nur `umlaut` und `typo`.

`grade_answer` liefert `status`, `matched`, `reason` und `hint`. `EXACT` hat `reason:null` und optional einen neutralen `hint` (`capitalization`, `punctuation`, `capitalization_punctuation`); Typografiegleichheit allein hat `hint:null`. `SOFT_ERROR` hat `reason:umlaut|typo` und `hint:null`. `INCORRECT` hat `matched:null`, `reason:null`, `hint:null`. Großschreibung/Satzzeichen dürfen keine Punkt-/Intervallkürzung verursachen. Exakte falsche Distraktoren sind immer `INCORRECT`. Artikel bleiben Lernziel; die Vokabel-RPC ergänzt `feedback:article_missing|article_wrong|null`, auch bei Wiederholungen. Zahlenvarianten und Wortstellung werden ausschließlich pro Aufgabe festgelegt.

Phase 4 verwendet diesen Vertrag für alle Schreibaufgaben. Aufgaben zur Unterscheidung der Großschreibung (Sie/sie) bleiben für Phase 4 Auswahlaufgaben; diese Phase ergänzt dafür keinen neuen Aufgabenbestand. Phase 3 muss weiterhin den in Phase 0 belegten Grammatik-Lesevertrag ohne vorab ausgelieferte Lösungen herstellen. Die neuen Variantenentscheidungen stehen vollständig in [varianten-audit.md](varianten-audit.md).
