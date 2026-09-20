# Phase 3.4–3.5 — Zielwerte und Inhaltslektorat

Abgeschlossen und produktiv am 20.09.2026; aktiver Release **`5d2f6f330348`**. S2 wurde vor Umsetzung anhand Repository und produktivem, ausschließlich lesendem Datenbankzugriff durchgeführt. Keine gravierenden technischen Blocker; die ausdrücklich geforderte Freigabesperre betrifft alle 604 vorhandenen Grammatikaufgaben.

## S2 — Verifikation

| Datei / Tabelle / Spalte | Erwartet | Gefunden | Delta |
|---|---|---|---|
| `lib/grammar-validation.ts`, `grammarWriteSchema` | Pflicht-Zielwerte | Vorhandener Write-Validator, kein `target_form` | Pflichtarray nichtleerer Strings ergänzen |
| `components/admin/ExerciseCMS.tsx` | Eingabe, Sperre, Bestandsstatus | Editor vorhanden, keine Zielwerte oder Unvollständig-Markierung | Eingabe und Validierung in fünf Sprachen |
| Schülerkarten / `app/actions/exercises.ts` | Prompt mit `[Zielwert]` | Deutsche Satz-/Fragefelder, keine Zielwertanzeige | Zielwertanzeige und Auslieferungsfilter |
| `learning_exercises.content` | Bestehende Zielwerte / sichere Sperre | 604 Aufgaben; 0 mit Zielwerten | Bestand erhalten, Status berechnen, Schüler-RLS und Bewertungs-RPC sperren |
| `grammar_translations` | Lokalisierte Übersetzungsaufforderung | Nur `hint`, `smart_hint`, `explanation` | Eigenes `prompt`-Feld; normalisierter CMS-Schreibweg |
| `vocabulary_translations`, `grammar_translations`, `course_translations` | Audit de/en/ru/uk/tr | Alle Tabellen vorhanden; deutsche Vokabeln/Kurstexte teilweise kanonisch in Basistabellen | Zeilen-/Feldlücken und Sprachheuristiken getrennt erfassen |
| `learning_exercises`, `learning_reading_texts` | Deutsche Inhalte geschützt | 604 Aufgaben und 149 Lesetexte ohne Sperrzeichen; Schutz fehlt | INSERT-/UPDATE-Trigger, NFC-/Unicode-Prüfung |
| `docs/audit/content-lektorat.md` | Lektoratsbericht | Noch nicht vorhanden | Reproduzierbaren Bericht mit allen 15 Tabelle/Locale-Kombinationen anlegen |

## Verhalten

`target_form` liegt im kanonischen Aufgabeninhalt. PostgreSQL berechnet `content_status` als ENUM; Staff sieht unvollständige Aufgaben, Schüler können diese weder lesen noch per direkter Bewertungs-RPC abschließen. Die Migration erfindet keine Zielwerte und verändert keine vorhandenen Aufgabentexte. Der CMS-Editor und der aktive Manuskriptimport verlangen ausdrücklich gepflegte Zielwerte.

Übersetzungsaufforderungen werden in `grammar_translations.prompt` gespeichert und in der gewählten UI-Sprache mit deutschen Zielwerten angezeigt, etwa `Как вас зовут? [heißen]`. Fehlt diese Sprachfassung, liefert die App die Übersetzungsaufgabe nicht aus. Übersetzte Hinweise bleiben von deutschen Satzfeldern getrennt.

Die Trigger schützen deutsche Satz-, Antwort-, Auswahl-, Zielwert- und Themenfelder sowie Lesetext/Fokus. NFC-Normalisierung verhindert Umgehungen mit zerlegten Buchstaben; kyrillische Erweiterungsblöcke und die sechs geforderten türkischen Zeichen werden geprüft. Unveränderte Altdaten erlauben Metadatenpflege; inhaltliche Änderungen müssen die gesamten geprüften Felder bereinigen. Öffentliche Speicher-RPCs liefern explizite JSONB-Fehler und rollen fehlgeschlagene Schreibvorgänge atomar zurück.

Audit und redaktioneller Befund: [content-lektorat.md](audit/content-lektorat.md), vollständige IDs/Feldpfade im zugehörigen JSON. Der Audit ist keine automatische Übersetzung. Die 604 Zielwerte sowie die dokumentierten Übersetzungslücken und zwei deutschen Hinweise in russischen Zeilen müssen redaktionell bearbeitet werden.

## Abnahme und Betrieb

| Prüfung | Ergebnis |
|---|---|
| Vollständiger Jest-Lauf einschließlich aktivierter Live-Integration | **97 Suites / 1.241 Tests bestanden**, keine übersprungen. `/tmp/sitov-phase3-content-jest.log` |
| Alle Datenbanksuiten, seriell auf dem VPS | **297/297 bestanden**, keine übersprungen. `/root/backups/phase3-content-db-all.log` |
| Neue SQL-Regressionen | **12/12 bestanden**: Legacy-Erhalt, berechneter Status, RLS samt Übersetzungen, Bewertungs-RPC, Staff-/Service-Rollen, Unicode, atomare Fehler, Prompt-Persistenz und Replay. |
| Gesamte Browsersuite gegen Produktionsbuild und echten isolierten PostgreSQL-Klon | **10/10 bestanden**. CMS verweigert fehlenden Zielwert; nach Ergänzung persistiert der russische Prompt und erscheint mit `[heißen]`; richtige Antwort ergibt Score 100. Bestehende Soft-Error-, Auth- und Kontrasttests ebenfalls bestanden. `/tmp/sitov-phase3-content-browser.log` |
| Audit-/Migrations-/Deployment-/Storage-Tests | **32/32 Python-Tests bestanden**, darunter 11 Audit-Tests und 8 Migrationsrunner-Tests. `/tmp/sitov-phase3-content-python.log` |
| Typen / lokaler Build | `tsc --noEmit --incremental false` und Produktionsbuild bestanden. `/tmp/sitov-phase3-content-build.log` |
| VPS-Build / Produktion | Release `5d2f6f330348` vorbereitet, Migration 07 angewendet und beide Phase-3-Katalogprüfungen bestanden; Release aktiviert. App, Mailworker und nginx aktiv, Health `ready`. `/root/backups/phase3-content-production-build.log` |
| Echt-PostgreSQL / R7 | Einzelmigration 07 und vollständiger Replay **02 → 03 → 01 → 04 → 05 → 06 → 07** erfolgreich. Read-only-Katalogtest `deploy/vps/tests/phase3-content-catalog.sql` bestätigt 604 unvollständige Aufgaben, Trigger, ENUM, Veröffentlichungsschutz und RPC-Konfiguration. |
| R9 | Exakte ursprüngliche Funktions-/Policydefinitionen gesichert; vollständiger funktionaler Rückweg einschließlich Schema-ACL im echten Klon innerhalb einer zurückgerollten Transaktion erfolgreich ausgeführt. |

Die Browserabnahme deckte ein fehlendes Schema-USAGE für den internen Service-Account und einen bereits vorhandenen verspäteten Autofokus im CMS auf. Beides wurde behoben; entsprechende Rollen-/Fokusregressionen bleiben aktiv. Keine Testanforderungen deaktiviert, keine Zielwerte in historische Inhalte eingefügt. RAM-/CPU-Limits unverändert.

Finaler Live-Audit nach Aktivierung: **2026-09-20 13:13:36 UTC**, 604 Aufgaben ohne Zielwerte, 0 Treffer der deutschen Zeichenprüfung in 604 Aufgaben und 149 Lesetexten. Alle 15 Tabelle/Locale-Kombinationen einschließlich des neuen Prompt-Felds dokumentiert. Test-Cleanup bestätigt: 0 Testkonten und 0 Testlektionen im Klon; isolierte Auth-/REST-/SMTP-/Next-Prozesse und SSH-Tunnel beendet, temporäre Testzugangsdaten entfernt.

## R8 / R9 — Backup und Rückweg

Vor der ersten Datenbank-Teständerung: `python3 deploy/vps/migrate-local.py --backup-only` auf dem VPS. Vollbackup `/root/backups/sitov-migration-20260920T125400829855Z`; PostgreSQL-SHA256 `6c74fe5fad32192bbe93a38401be20c32b5c9f07a44cc88ee29bc5eed27c303f`; Storage-Manifest `0c1745b09505bab01a1b28fb184488ba44d52af9331a1f61f1976bbb1a6331c2`, einschließlich aller 392 Objekte. Weitere vollständige Runner-Backups vor den Migrationsläufen.

Unmittelbar vor der Produktionsmigration, nach Stop von App/Mail: `/root/backups/sitov-migration-20260920T131302529306Z`; PostgreSQL-SHA256 **`b3392328a121bde2d14ab61f15275957f8401b6443a08931e45a4cfd876332dd`**. Storage-Manifest unverändert wie oben. Alle **396 Manifest-Dateien** erneut SHA256- und Berechtigungs-geprüft, einschließlich aller 392 Storage-Objekte. Befehl: `python3 deploy/vps/migrate-local.py --apply 07_content_quality.sql --keep-stopped`; danach Katalogprüfungen und `bash deploy/vps/deploy-release.sh --activate 5d2f6f330348 --schema-changed`. Vorheriger aktiver App-Release: `0d4eba213834`.

Geschütztes funktionales Rollback: `/root/backups/sitov-migration-20260920T125400829855Z/pre-07-rollback.sql`, SHA256 `646c1e2fc0e3cc1ea86cc7db065a54985c2410de7921c779ada9207ee2a439bf`. Das Skript restauriert die beiden ursprünglichen Funktionen und zwei Lesepolicies, entfernt die neuen Trigger, Spalten und Helper in Abhängigkeitsreihenfolge mit `RESTRICT` und restauriert das ursprüngliche Schema-USAGE. Vor einem Rückweg App/Mail anhalten, aktuelles Vollbackup erstellen und neu verfasste Prompt-Übersetzungen separat exportieren. Anschließend den passenden vorherigen App-Release aktivieren. Gepflegte `target_form`-Werte können erhalten bleiben; einen exakten Datenrückweg liefert das vollständige R8-Backup. Kein automatischer Rückwechsel nach unklarem Commit.

## R7 — Kanonischer Export

Exporter: `deploy/vps/export-phase2-schema.py`; TypeScript wird vom laufenden postgres-meta-Generator erzeugt. Exakter Produktions-Dump:

```sh
docker exec supabase-db-eknmzxvqilojjicinatnllbt pg_dump -U supabase_admin -d postgres --schema-only --no-owner --schema public --schema business_private --schema grammar_private --schema identity_private --schema learning_private --schema learning_reset_private --schema platform_private --schema private --schema pronunciation_private --schema trainer_access_private --schema vocabulary_private --schema media_private
```

Ausgeschlossen aus dem App-Schema: Supabase-verwaltete `auth`, `storage`, `realtime`, `extensions`, `graphql`, `vault`, `cron`, `net` und Migrationshistorie. Das vollständige Backup enthält auch diese Bereiche. Neue öffentliche Typen: `learning_content_status`, `learning_exercises.content_status`, `grammar_translations.prompt`.

`supabase/schema.sql` und `supabase/database.types.ts` wurden nach produktiver Migration aus **`postgres`** exportiert und ins Repository übernommen. Geschützter Originalexport: `production-schema/` im Produktionsbackup oben.
