# Phase 4 — Prüfbericht

## Prüfung vor Änderungen

26.09.2026. `00_CODEX-4-RULES.md`, `04_PHASE-4-GPT.md`, `STATUS.md` und die Phase-3-Verträge gelesen. Ausgangsrevision `c0eb6cfa7b2d9c2b2d168fdae3af2b8dae090577`, sauberer Arbeitsbaum auf `codex/vps-self-hosted`. Ausschließlich Phase 4; lokale Abnahme, kein Deployment.

| Bereich | Ist | Soll Phase 4 |
| --- | --- | --- |
| Seed | Lokale Datei `supabase/seeds/path-a1.1.json`, 2.813.970 Bytes; Zod-Vertrag vorhanden | Datei unverändert, vollständig und generisch vor Schreibzugriff validieren |
| Import | `scripts/path-seed.mjs` validiert und bietet einzelne Staff-RPC-Importe; keine Service-Role-Unterstützung | `scripts/import_learning_path.ts`, lokale Service-Role-Anbindung, sichere Wiederholung, Backup und überprüfte Ergebnisse |
| Datenbank | Infrastruktur bis 35, stabile Quellkennungen und transaktionale Import-RPC | Bestehende Verträge verwenden; Migration/Rückweg und Schema-/Typenabgleich |
| Nummerierung | 31 ist `31_vocabulary_target_forms.sql`, nächste freie Nummer 36 | Abschnitt 4.4 als `36_migrate_old_grammar_progress.sql`; belegte Migration nicht überschreiben |
| Altfortschritt | Migration 35 archiviert alte Grammatik-Units bereits; bisher keine Lehrkraft-Notiz für die Überleitung | Ursprungsdaten erhalten, klar dokumentierter Neustart ohne unbegründete Abschlussübernahme; wiederholbar und rücknehmbar |
| Lernoberfläche | Phase 3 ausdrücklich nur Infrastruktur; bestehender Grammatiktrainer nutzt alten Vertrag | Lernpfadansicht und Merkkarten sowie Bedienung der im Seed vorkommenden Formen; Bewertung ausschließlich durch PostgreSQL |
| Abnahme | Lokale PostgreSQL-/Backup-Testadapter und Browserwerkzeuge vorhanden | Vollständigen Seed lokal importieren; Wiederholung, Rückweg, Berechtigungen, mindestens drei echte Seed-Aufgaben im Browser prüfen |

Die Supabase-Skill-Empfehlung zur CLI-Migrationsbenennung wird durch die ausdrücklich vorgeschriebene VPS-Dateistruktur und den bestehenden `migrate-local.py`-Ablauf ersetzt. Keine Cloud-Datenbank und keine produktiven Personendaten werden für diesen lokalen Auftrag benötigt. Die konkrete lokale Testumgebung und Ergebnisse folgen unten.

## Umsetzung

`scripts/import_learning_path.ts` liest die lokale UTF-8-Datei und validiert alle Pfade mit dem bestehenden Zod-Schema, bevor ein Datenbankzugriff möglich ist. Standardmäßig erfolgt nur diese Prüfung. `--import` benötigt ausdrücklich gesetzte Loopback-Adresse, Service-Role-Key und ein frisches, geprüftes Backup. Die neue Service-Role-RPC übernimmt das vollständige Array in einer Transaktion. Pfade/Knoten werden über bestehende Quellkennungen, Aufgaben über ihre UUID aktualisiert. Fehler verwerfen die gesamte Transaktion; bei unbekanntem Commit-Status ist eine Wiederholung mit neuem Backup möglich. Grenzen und Bedienung: [Import-Anleitung](phase-4-import.md).

Migration **36_migrate_old_grammar_progress.sql** ergänzt den gemeinsamen Importkern, die Service-Role-RPC und `path_legacy_progress_notes`. Die vorhandene Staff-RPC behält ihre Authentifizierung. Direkte Ausführung des gemeinsamen Kerns durch Lernende oder Service Role ist gesperrt; die öffentliche Batch-RPC ist ausschließlich Service Role zugänglich. Alte Grammatik-Units aller Niveaus werden archiviert; Vokabeln und andere Trainer bleiben unberührt. Da Lektionsnummern keine verlässliche Zuordnung von Lernzielen belegen, werden keine alten Abschlüsse übertragen. Originale `user_exercise_progress` bleiben vollständig erhalten. Die Lehrkraft-Notiz nennt je Person/Niveau Anzahl alter Aufgaben, Abschlüsse und Versuche sowie **0 übertragene Abschlüsse**, mit Erklärung in fünf Sprachen. Bereits vorhandene neue Pfadfortschritte und eingefrorene Versuche werden weder zurückgesetzt noch überschrieben.

Die Notizen sind ausschließlich für Lehrkräfte/Admins lesbar (RLS), nicht für Lernende; direkte Schreibrechte sind entzogen. Eine Lehrkraft kann sie über `path_legacy_progress_notes` abfragen. Die Phase verlangt eine Datenbanknotiz; eine zusätzliche Lehreroberfläche gehört nicht zu diesem Auftrag.

Der Rückweg unter `supabase/vps/rollback/36_migrate_old_grammar_progress.sql` stellt die gesicherten Aktivierungsstände und die bisherige Staff-Importfunktion wieder her und sperrt den Batch-Import. Neue Inhalte, Alt-/Neufortschritte, Versuche und Notizen bleiben erhalten. Wiederanwendung stellt die Pfadaktivierung wieder her. Der Runner kennt Nummer 36; `schema.sql` und `database.types.ts` wurden aus dem echten lokalen PostgreSQL-Katalog aktualisiert.

Die bestehende Übungen-Route zeigt bei vorhandenen Pfaden die neue Lernpfadansicht. Ohne Pfade bzw. bei noch nicht verfügbarer Pfad-RPC bleibt der bisherige Trainer erreichbar. Neue Server-Actions verwenden ausschließlich die angemeldete Cookie-Sitzung; eine zweite Feld-Allowlist entfernt Autorendaten vor der Client-Grenze. Die Oberfläche zeigt die Seed-Merkkarte vor einem Übungsknoten, unterstützt Auswahl, Lückentext und Satzbau per Tastatur und nutzt ausschließlich die serverseitige Bewertung, Warteschlange, Sterne und Freischaltung. Tests speichern zunächst ohne Feedback und zeigen Ergebnisse erst nach Abschluss. Alle neuen Texte liegen gleichzeitig in fünf Sprachen vor. Der bestehende Sprachwahl-Hinweis beim deutschen Trainer-Einstieg bleibt erhalten.

## Abnahme und Grenzen

Die lokale Abnahme verwendet **PostgreSQL 17.11 und PostgREST 16.4** mit echten Transaktionen, Rollen, RLS und RPCs. Nur die Anmeldung verwendet eine künstliche lokale Testidentität; weder REST-Antworten noch Bewertungen werden simuliert. PostgreSQL läuft über einen privaten Unix-Socket mit 32 MB Shared Buffers. Ein kurzlebiger Loopback-Gateway leitet REST unverändert an PostgREST weiter. Die Produktionsdatenbank/Deployment-Konfiguration wurden nicht verändert. Die Testprozesse werden nach Abschluss beendet; Backups bleiben geschützt außerhalb von Git.

- Unveränderter Seed: **7 Pfade, 85 Knoten, 769 Aufgaben, 87 Lernziele**. SHA256 `d5d954b7579ababef29876eb5321757d722194bd096ae44bf1ab925864c99a0c`.
- Übersetzungen: **35 Pfad-, 425 Knoten- und 3.845 Aufgabenzeilen**, jeweils einschließlich Deutsch.
- Drei echte CLI-Importe: Erstimport, Wiederholung, erneuter Import nach Rückweg/Wiederanwendung. Alle IDs stabil. Vollständiger geschützter Export aller sieben Pfade entspricht dem Seed einschließlich Inhalt und Übersetzungen; nur standardmäßige Aktivkennzeichen und Lernzielreihenfolge werden beim Vergleich berücksichtigt.
- Doppelte DDL-Anwendung und Rückweg/Wiederanwendung ergeben dasselbe Schema. Die synthetischen Altdaten bleiben bytegleich, einschließlich Abschluss, 100 Punkten und vier Versuchen. Die Lehrkraft-Notiz wird genau einmal erzeugt. Weitere SQL-Tests prüfen vorhandenen neuen Fortschritt, fehlende Rechte, gefälschte Claims und Fehler nach bereits begonnenen Batch-Änderungen.
- Echter Browserdurchlauf durch **alle 78 Übungs-/Wiederholungsaufgaben von Pfad 1**: 35 Auswahl-, 36 Lückentext- und sieben Satzbauaufgaben. Bei drei Lückentexten wurden bewusst Großschreibung und zusätzliche Satzzeichen verwendet; PostgreSQL akzeptierte diese neutral, alle zehn Übungs-/Wiederholungsknoten erhielten drei Sterne. Anschließend **16 Testaufgaben, 100 %**, Pfad 1 abgeschlossen und Pfad 2 freigeschaltet.
- **Sieben vollständige Axe-Scans** ohne Regel-/Knotenausschlüsse: Desktop-Merkkarte sowie mobiler Pfad, Merkkarte und Aufgabe jeweils hell/dunkel. Mobile Breite 390 px ohne horizontalen Überstand; primäre Touch-Ziele mindestens 48×48 px. [Visuell geprüfte Bilder](phase-4-bilder/README.md).

| Prüfung | Bestanden | Fehlgeschlagen | Übersprungen |
| --- | ---: | ---: | ---: |
| Jest, gesamter Bestand einschließlich lokalem DB-Smoke | 1.862 / 145 Suites | 0 | 0 |
| Datenbank und Node-Skriptprüfungen | 482 | 0 | 0 |
| Python (61 VPS + 3 TTS) | 64 | 0 | 0 |
| Phase-4-Playwright | 3, darin sieben Axe-Scans | 0 | 0 |
| TypeScript | Exit 0 | 0 | 0 |
| Produktionsbuild | Exit 0, 157 statische Seiten | 0 | 0 |

Die ersten Prüfungen zeigten drei behobene Probleme: unscharfe TypeScript-Rückgabetypen der neuen Actions, dynamische CLI-Fehlerausgaben (einschließlich zweier Phase-3-Skripte) sowie die DB-Abschlussantwort für ungültige gespeicherte Testantworten ohne `fields`. Letztere wird ausschließlich für `INCORRECT`/`correct:false` als leere Detailliste akzeptiert. Die Logging-Prüfung wurde nicht verändert; alle drei CLIs geben feste, sichere Fehlerkategorien aus. Der erste Browserlauf scheiterte beim Auslesen eines von Chromium bereits verworfenen gestreamten Response-Bodys. Die weiterhin vollständige Prüfung des lösungsfreien Startvertrags liest nun den echten fortgesetzten RPC-Versuch über eine gepufferte APIResponse; der finale Browserlauf ist grün. Kein Test wurde ausgeschlossen oder übersprungen.

Die Oberfläche unterstützt die drei tatsächlich im Seed enthaltenen Aufgabenformen. Die sechs zusätzlichen Phase-3-Formate bleiben durch Zod/SQL abgedeckt; unbekannte Darstellungsformen führen zu einem expliziten Fehler und werden nicht stillschweigend ausgelassen. Eine produktive Aktivierung der Migrationen 32–36 und des passenden UI-Releases bleibt ein separater Auftrag. Die lokale Abnahme ersetzt keine Laufzeitprüfung auf dem produktiven PostgreSQL-15.8-System.

Maschinenlesbare Zähler, Prüfsummen, Backup-Nachweise und Browser-DB-Ergebnis: [phase-4-db-nachweise.json](phase-4-db-nachweise.json).

## Reproduktion

```sh
npm run seed:learning-path
node --test --test-concurrency=2 supabase/tests/*.test.mjs scripts/path-listening-audio.test.mjs scripts/import_learning_path.test.mjs
git show c0eb6cfa7b2d9c2b2d168fdae3af2b8dae090577:supabase/schema.sql > /tmp/sitov-phase4-schema35.sql
python3 deploy/vps/tests/phase4-local-import.py --output /tmp/sitov-phase4-check \
  --postgrest /absoluter/pfad/postgrest --schema /tmp/sitov-phase4-schema35.sql --serve
```

Der letzte Befehl bleibt für Browserprüfungen im Vordergrund. `environment.json` im geschützten Ausgabeordner enthält ausschließlich die temporären Testzugänge. In einem zweiten Terminal werden diese Variablen für Build und Start übernommen:

```sh
python3 - <<'PY'
import json, os, subprocess
env = {**os.environ, **json.load(open('/tmp/sitov-phase4-check/environment.json'))}
subprocess.run(['npm', 'run', 'build'], env=env, check=True)
subprocess.run(['npx', 'next', 'start', '-p', '3104', '-H', '127.0.0.1'], env=env, check=True)
PY
```

Danach in einem dritten Terminal:

```sh
PHASE4_SESSION_FILE=/tmp/sitov-phase4-check/session.json npx playwright test --config e2e/master4-phase4.config.ts
npx tsc --noEmit
```

Für den vollständigen Jest-Lauf zusätzlich `RUN_SELF_HOSTED_INTEGRATION=1`, `SELF_HOSTED_TEST_URL=http://127.0.0.1:54339` und `SELF_HOSTED_TEST_ANON_KEY` aus der lokalen Testumgebung setzen. Der echte lesende Smoke läuft gegen deren synthetischen Kurskatalog. Anschließend App und Testumgebung mit Ctrl-C beenden. `--schema` ist absichtlich Pflicht: Ein Schemaauszug nach Phase 4 enthält keine Daten der privaten Rückweg-Sicherung und ersetzt nicht den Ausgangsstand für einen Rollback-Test.
