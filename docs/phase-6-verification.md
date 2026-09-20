# Phase 6 — Ausfalltermine in E-Mails

Stand: 20.09.2026. Umfang: Phase 6.1. **6.2 Monitoring wurde auf ausdrücklichen Nutzerwunsch gestrichen.** Kein Status-Container oder Timer wurde installiert; Nginx und sämtliche produktiven RAM-/CPU-Limits bleiben unverändert. Vorbereiteter Monitor-Code wurde entfernt, das ausschließlich dafür geladene Docker-Image gelöscht.

## Bestandsprüfung (R1–R11)

| Datei / Objekt | Erwartet | Gefunden | Änderung |
|---|---|---|---|
| `supabase/schema.sql` | Zwei Mail-Payloads | `public.submit_business_registration` und `business_private.confirm_booking`; CODEX-Zeilenangaben veraltet | Beide um `exceptions` erweitern |
| `public.course_exceptions` | Datum und Kursbezug | `date`, `reason`, nullable `course_id` für globale Ausfälle | Vorhandene Quelle verwenden |
| `lib/mail/templates.mjs` | Fünf Locales | de/en/ru/uk/tr vorhanden, Ausfallabschnitt fehlte | HTML/Text und neuer Ereignistyp |
| Staff-Mail / Outbox | Bestehender Versand | `staff-registration:<booking_id>`, privates Outbox-/Worker-System vorhanden | Prüfen und erhalten |
| Monitoring | Separater Container | Kein vorhandener Dienst | Auf Nutzerwunsch gestrichen |

## Umsetzung

- Migration 13 erweitert `public.mail_kind` idempotent um `course_exception_added`. Eigene Transaktion: PostgreSQL darf den neuen Enum-Wert erst nach Commit verwenden. Der Migrationsrunner führt 13 vor 14 aus.
- Migration 14 ergänzt beide Mail-Payloads. SQL liefert nach Datum/Kurs/Grund sortierte Ausfälle für gebuchte Kurse einschließlich globaler Ausfälle; berücksichtigt Buchungsbeginn, gebuchten Monat, Kurslaufzeit und tatsächliche Wochentermine. Bei Probeunterricht zählt nur der gebuchte Tag. Keine Client-Bewertung, keine externen APIs.
- Bestätigung und spätere Benachrichtigung behalten die Sprache der Anmeldung; ohne Registrierungsmail gilt die bevorzugte Personensprache.
- Alle fünf Templates zeigen „Feststehende Ausfalltermine“ mit lokalisiertem Datum, Kurs und Grund in HTML und Text. Datumsformatierung ausdrücklich `Europe/Berlin`; ISO-Kalendertage werden ohne Monats-/Sommerzeitverschiebung verarbeitet. HTML-Inhalte werden escaped. Leere Liste: kein Abschnitt. Ungültige Daten führen zu einem expliziten Templatefehler.
- `registration:<booking_id>`, `confirmed:<booking_id>` und Staff-Dedupe bleiben erhalten. Später hinzugefügte Ausfälle erzeugen eigene Outbox-Ereignisse, atomar mit dem Speichern. Bestehende Bestätigungspayloads werden nicht verändert.
- Private Versandhistorie mit RLS und eingeschränkten Rechten verhindert Doppelbenachrichtigungen, auch wenn das bestehende Kursformular Ausfälle löscht und erneut einfügt. Identität: Buchung/Kurs/Datum. Bekannte Ausfälle bestehender Buchungen werden bei Migration lediglich als bekannt vermerkt, ohne rückwirkende E-Mails zu erzeugen. Eine reine Änderung des Grundes oder erneutes Eintragen desselben Ausfalltags erzeugt keine zweite Nachricht.
- RPC-Fehler bleiben strukturierte JSONB-Antworten. Neue Helfer liegen ausschließlich im privaten Geschäftsschema, privilegierte Funktionen besitzen einen leeren `search_path`; anonyme Nutzer und Schüler dürfen weder Versandhistorie lesen noch Helfer aufrufen.
- Die ältere Normalisierungsmigration 04 akzeptiert beim erneuten Ausführen zusätzlich exakt die bekannte Phase-6-Erweiterung des Mail-Enums; unbekannte oder umsortierte Enum-Werte bleiben Fehler.

Staff-Mail wurde funktional mitgetestet und nicht neu gebaut. Ein bereits seit 13.09.2026 fehlgeschlagener Staff-Job mit `EENVELOPE_550` bleibt unverändert erhalten. Es wurde keine echte Testmail an Kunden oder Staff versendet. SMTP-Integrationstests verwenden einen lokalen Testempfänger.

## Automatisierte Abnahme

| Prüfung | Ergebnis |
|---|---|
| Vollständiger Jest-Lauf auf VPS mit echter Loopback-Integration | **112 Suites / 1.361 Tests bestanden**, keine übersprungen; `/root/phase6-jest-final.log` |
| Vollständige Datenbank-Testreihe auf VPS | **322/322 bestanden**, keine übersprungen; `/root/phase6-db-final.log` |
| Abschließende Sprach-/Ausfallregression | **8/8 bestanden** nach Sprachkorrektur; Registrierung, Bestätigung, Kurs/global, leere Probe-Payloads, Sprachbeibehaltung, Rechte, Rollback, Replay und Transaktionsrollback |
| Mailworker / Templates / lokaler SMTP-Test | **8/8 bestanden**, alle fünf Locales, Sommerzeitdatum, Escaping, leere Listen und ungültige Datumswerte |
| Deployment-/Migrationsrunner | **34/34 Python-Tests bestanden** |
| TypeScript / VPS-Produktionsbuild | Bestanden; vorbereitetes und aktiviertes Release `b7597c37b742` |
| Echter PostgreSQL-Klon | 13/14 und 04/05/13/14 wiederholt ausgeführt; inverse Migration getestet; finale SQL-Abnahme inklusive Sprache nach Korrektur bestanden |
| Produktion | App/Mail/Nginx aktiv; `/api/health` liefert `ready`; Enum, Payload-Funktionen, Trigger, RLS und gesperrte Helferrechte geprüft |
| R8 | Beide Produktiv-Migrationsbackups: je 396 Dateiprüfsummen korrekt, ausschließlich root-lesbar |
| Ressourcen | Produktive Limits unverändert; kein Monitor-Container/Timer, ungenutzte Vorbereitung und Monitor-Image entfernt |

Die letzten Änderungen nach dem Build betreffen ausschließlich Migrationen, deren Tests und Dokumentation. Die SQL-Sprachkorrektur wurde nach erneuter Klonprüfung mit frischem Backup produktiv nachgezogen; dieselbe passende App-/Worker-Version ist aktiv. Der Schema-Dump stammt anschließend aus Produktion.

Ein erster VPS-Gesamtlauf verwendete den veralteten Dependency-Ordner des Quellcheckouts; ein weiterer lud versehentlich `NODE_ENV=production` aus der App-Konfiguration. Der finale grüne Lauf verwendet die per `npm ci` vorbereitete Release-Umgebung mit `NODE_ENV=test` und ausschließlich den zwei expliziten Loopback-Testparametern. Keine Tests oder Anforderungen wurden ausgefiltert.

## Backups und Rollback

Alle Backups liegen ausschließlich root-lesbar auf dem VPS; jeweils 392 Storage-Objekte. Vor Datenbankarbeiten ausgeführt: `python3 deploy/vps/migrate-local.py --backup-only`.

| Anlass | Backup unter `/root/backups/` | PostgreSQL-SHA256 |
|---|---|---|
| Vor ersten DB-Tests | `sitov-migration-20260920T171243500632Z` | `aa8e4602fd8c2139c48a1b8a68ab6d1526901a5766ad4142770cec445da58f62` |
| Klonmigration 13/14 | `sitov-migration-20260920T171910160723Z` | `eabd0e356bbd0ad2d4261d71973be79cfe95b8df223119be996a372337e625f1` |
| Wiederholung 04/05/13/14 | `sitov-migration-20260920T172446920493Z` | `0220ae19db0db31e32cd4686357ccc5015dce0ba36ad36be07c6a078b91f1c2f` |
| Vor Produktivmigration | `sitov-migration-20260920T172724049250Z` | `116dbdffebc3346a6a175a32ebc01a96ae3af0f305abf05c4237b5717cd558e9` |
| Produktivmigration 13/14 | `sitov-migration-20260920T172730419205Z` | `cbf3e382bcd81f27c17ad94c51e901f22fb3e0451631b28b20295dffe12a28ab` |
| Klonprüfung Sprache | `sitov-migration-20260920T172912410625Z` | `019cc1bba9819ed0064d933898559ae2f60b98dc0154efb71c79aa2173475b64` |
| Vor Sprachkorrektur | `sitov-migration-20260920T172950477530Z` | `7e7f2907da05f1669bed158c8d17090676344635b17e4426c2af849cbc765f5d` |
| Produktivkorrektur Sprache | `sitov-migration-20260920T172956864090Z` | `92b83ff4537f0cc0c4303c86138b2aea65fa98798e97739010a150076b1518c3` |

Storage-Manifest-SHA256: `0c1745b09505bab01a1b28fb184488ba44d52af9331a1f61f1976bbb1a6331c2`.

Rollback: App/Mail stoppen, frisches Backup erstellen. `supabase/vps/rollback/14_mail_exceptions.sql` mit `psql -1 -v ON_ERROR_STOP=1` anwenden: ursprüngliche Payload-Funktionen wiederherstellen, Trigger/Helfer/Versandhistorie entfernen. Bestehende Outbox-Ereignisse und der Enum-Wert bleiben erhalten; die neue Worker-Version muss ausstehende `course_exception_added`-Jobs noch verarbeiten können, bevor ein alter Worker eingesetzt wird. Keine gesendete Mail löschen oder erneut versenden. Der Rückweg wurde im echten PostgreSQL-Klon innerhalb einer zurückgerollten Transaktion geprüft; anschließend bestand die Vorwärtsprüfung erneut.

## Schemaexport

Nach der Produktivmigration: `python3 deploy/vps/export-phase2-schema.py --database postgres --output /root/backups/phase6-production-schema`.

```sh
docker exec supabase-db-eknmzxvqilojjicinatnllbt pg_dump -U supabase_admin -d postgres --schema-only --no-owner --schema public --schema business_private --schema grammar_private --schema identity_private --schema learning_private --schema learning_reset_private --schema platform_private --schema private --schema pronunciation_private --schema trainer_access_private --schema vocabulary_private --schema media_private
```

Supabase-verwaltete Schemas wie Auth, Storage, Realtime, Extensions, GraphQL, Vault, Cron, Net und Migrationshistorie bleiben außerhalb des App-Dumps. `database.types.ts` wird vom vorhandenen Postgres-Meta-Generator für `public` erzeugt. Keine manuellen Änderungen am Dump.
