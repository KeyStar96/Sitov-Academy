# Phase 2 — Verifikation und Betrieb

Stand: 20.09.2026. Phase 2.0 bis 2.6 ist gemäß Freigabe produktiv umgesetzt und
abgenommen. Aktive App-Version: `2e2157cf881f` auf `codex/vps-self-hosted`.

## Umsetzung

| Bereich | Ergebnis |
|---|---|
| 2.0 Identität | Elf Spalten per `RENAME COLUMN` auf `auth_user_id`; Geschäfts-IDs, Daten, FKs, API-Parameter und Berechtigungen bleiben erhalten. ADR: `docs/adr/001-identity-model.md`. |
| 2.1 Registrierung | Optionaler Signup nach Buchung, Konfliktbereich in der bestehenden Registrierungsverwaltung, explizite Staff-Zuordnung und dauerhafter Zuordnungsnachweis. Verifizierte E-Mail und leere Geschäftsidentität des neuen Kontos bleiben Pflicht; keine Zusammenführung bestehender Buchungs-/Rechnungshistorien. |
| 2.2 Medien | Ordner und Präsentationen, mehrere Videos je Lektion, private Storage-Pfade mit IDs, MIME-/Größenvalidierung, FKs, Indizes und Zeitstempeltrigger. MIME-Katalog mit Format-Enum: Der vollständige PPTX-MIME-Name überschreitet PostgreSQLs 63-Byte-Grenze für Enum-Werte. |
| 2.3 Upload/Betrieb | nginx-Uploadpfad 512 MiB ohne Request-Pufferung; App bleibt bei 32 MiB. Beide Storage-Limits ebenfalls 512 MiB. Anzeige tatsächlicher VPS-Belegung, Warnung ab 80 %, atomare 20-GiB-Grenze pro Level. |
| 2.4 Zugriff | Staff schreibt; Schüler lesen nur freigegebene Level bzw. Lektionen. Storage und Metadaten sind abgesichert. Kursausfall-RPCs prüfen Staff; keine direkten Schreib-Grants. Signierte Medienlinks gelten 60 Sekunden und verwenden die öffentliche API-Adresse. |
| 2.5 N/A | Bereits vorhandener `server-only`-Import, aktuelle Fortschrittstabelle und Reset-RPC bleiben erhalten. Historische Tabellen bleiben ausschließlich in isolierten Test-Fixtures. |
| 2.6 Normalisierung | Transitive Titel entfernt; Kündigungen referenzieren Kurs-IDs. Marketingbereiche bleiben verlustfrei in `course_audiences`/`audience_code`; `courses.level` referenziert echte Lernlevel. Direkte Level-FKs, bereinigte Locale-Checks, 18 zusätzliche Enum-Typen und automatische `updated_at`-Trigger. |
| R10 | Alle 36 öffentlichen RPCs haben strukturierte JSONB-Fehler. Erfolgswerte behalten ihre JSON-Form. App und Mailworker prüfen Transport- und JSON-Fehler. Interne Fehler rollen Buchung, Outbox und Lernfortschritt gemeinsam zurück. |

`accepted_answers` wurde als notwendige Voraussetzung des neuen JSONB-Constraints
in Daten, Seeds und CMS vereinheitlicht. Dadurch sind auch die zwölf aus Phase 1
bekannten Grammatik-Testfehler behoben. Neue Soft-Error-Bewertung und die übrigen
Aufgaben aus Phase 3 gehören nicht zu dieser Freigabe.

## Automatisierte Abnahme

| Prüfung | Ergebnis / Beleg |
|---|---|
| Gesamte PostgreSQL-Testreihe auf VPS | 258/258 bestanden, keine übersprungen; `/root/backups/phase2-db-tests-final.log`. Historische Migrationen sind unveränderte Git-Test-Fixtures; neue Endzustandstests prüfen die gesamte Phase. |
| Gesamte Jest-Testreihe | 90 Suites, 1.137 Tests bestanden. Die optionale Live-Suite wurde getrennt aktiviert und bestanden: 1/1. |
| TypeScript | `npx tsc --noEmit` bestanden mit real generierten Typen. |
| Browser-E2E | 1/1 bestanden: echte anonyme Anmeldung per RPC → Signup im Browser → Verifikation im isolierten Auth-System → Login → ursprüngliche Buchung im Dashboard. Personen-ID, Buchungs-ID und Snapshots unverändert. Keine externe E-Mail versendet. |
| Browserbeleg | `test-results/registration-identity.live-8953f-after-later-verified-signup-chromium/verified-registration-dashboard.png` (lokales, ignoriertes Testartefakt). |
| Idempotenz | Gesamte Reihenfolge `02 → 03 → 01 → 04 → 05` im PostgreSQL-15.8-Klon zweimal erfolgreich ausgeführt. Zusätzlicher automatisierter Replay in den R10-Tests. |
| Katalog | `deploy/vps/tests/phase2-catalog.sql`: Identitätsreferenzen, JSONB-RPCs, FKs, Enums, Trigger, Medien-Policies und Normalisierung geprüft. |
| Atomizität | Injizierte Fehler nach Grading bzw. Buchungs-/Kündigungswrites rollen Fortschritt, Cursor, Personen, Buchungen und Outbox zurück; kein erfolgreicher Answer-Receipt bei fehlgeschlagener Bewertung. |
| Quota-Race auf echtem PostgreSQL | Zwei konkurrierende Upload-Transaktionen; Advisory-Lock-Wartezustand beobachtet. Exakt einer erfolgreich, zweiter `PT413`; Endstand exakt 21.474.836.480 Bytes. Eigene Testdaten entfernt. |
| Mailworker | 7/7 Tests bestanden, darunter fehlgeschlagene JSONB-Bestätigungen. |
| Rollout-/Backupsteuerung | 7 Release- und 5 Migrationsrunner-Tests bestanden; unklarer Commitstatus aktiviert niemals automatisch die alte App. |
| Storage-Konfiguration | 6 Tests bestanden; zwei Dateigrößenwerte angepasst und vorhandenes Live-Swap-Limit in Compose persistiert. RAM-/CPU-Konfiguration bleibt bytegleich. |
| Signierte URLs | 18 gezielte Tests für HTTP-Zugriff und öffentliche Storage-URL-Abbildung bestanden. |
| Produktiver Build und Betrieb | VPS-Build bestanden; App, Mailworker und nginx aktiv. `/api/health`: `ready`; produktiver Katalogcheck bestanden. |
| Produktiver Standardupload | 35.651.584 Bytes durch nginx und Storage erfolgreich; damit über der bisherigen 32-MiB-Grenze. |
| Produktiver TUS-Upload | 35.651.584 Bytes in 6-MiB-Chunks; HEAD-Offset und Fortsetzung geprüft. |
| Produktives RLS und Download | Gesperrter Schüler: HTTP 403, keine Ordnernamen sichtbar. Nach Freigabe signierter Link mit öffentlicher HTTPS-Adresse; Range-Download liefert exakt die erwarteten 1.024 Bytes. |
| Fixture-Cleanup | 0 Testkonten, 0 Medien-Testordner, 0 `course-assets`-Objekte nach Cleanup; alle ursprünglichen 392 Storage-Objekte bleiben vorhanden. |
| Produktionsartefakte | `supabase/schema.sql` per `pg_dump` aus Produktion; `supabase/database.types.ts` über den lokalen postgres-meta-Generator. Typen sind identisch zum vor Deployment geprüften Export. |

Alle temporären Auth-/REST-/Gateway-/SMTP-/Next-Prozesse und deren Testzugangsdaten
sind nach den Tests entfernt. Der Datenbankklon bleibt ausschließlich auf dem VPS.

## Backup, Aktivierung und Rückweg

Die vollständige produktive Migrationsfolge lautet:

1. `02_identity_alignment.sql`
2. `03_registration_identity.sql`
3. `01_critical_fixes.sql`
4. `04_normalization.sql`
5. `05_rpc_errors.sql`

Der Runner klammert alle Dateien in **eine** Transaktion. Die App wird vorher
gebaut (`deploy-release.sh --prepare-only`). Danach stoppt der Runner App und
Mailworker, erstellt und prüft das Backup und migriert mit `--keep-stopped`.
Erst `--activate <revision> --schema-changed` aktiviert den passenden Build.
Ein unklarer SQL-/Commitstatus oder eine gescheiterte Aktivierung lässt die
Dienste gestoppt, statt eine inkompatible ältere App zu starten.

MinIO enthielt bereits vor Phase 2 **392 Objekte**. Der neue Backupweg sichert
den vollständigen PostgreSQL-Dump, Rollen, Buckets und alle Dateien über die
Storage-API. Dateigrößen, stabile Inventare und SHA256-Dateimanifeste werden
geprüft; sämtliche Inhalte verbleiben rootgeschützt auf dem VPS.

Produktives Backup unmittelbar vor Migration:

- Verzeichnis: `/root/backups/sitov-phase2-20260920T120029922708Z`
- PostgreSQL-SHA256: `3a9041aadc5eae5630129115ff24d4d8873c047089d72a9d9e320fe8f97f6248`
- Storage-Manifest-SHA256: `0c1745b09505bab01a1b28fb184488ba44d52af9331a1f61f1976bbb1a6331c2`
- Alle 396 gesicherten Dateien nach dem Rollout erneut gegen `sha256.json` geprüft.
- Erfolgreiche Migration in `migration.log`; Dateireihenfolge und SQL-Hashes in `applied.json`.
- Vorherige nginx-Konfiguration und vollständiger Vorher-/Nachher-Vergleich der
  laufenden Containerlimits liegen im selben rootgeschützten Verzeichnis.
- Storage-Compose-Backup: `/root/backups/sitov-storage-upload-limit/20260920T120116639191Z-docker-compose.yml`,
  SHA256 `5f8018c643ca06b70243213a445a46bb80fe958f04dd76bf635b257aae8d4075`.

Jede SQL-Datei dokumentiert ihren Rollback. Bei einem Rückwechsel müssen
Datenbank und App gemeinsam wiederhergestellt werden. Neue Medien vor einem
Rollback zusätzlich sichern; Storage-Dateien über die Storage-API wiederherstellen.
Die inversen elf `RENAME COLUMN`-Befehle stehen am Ende von Migration 02.
Kein `DROP ... CASCADE` als Abkürzung.

Ressourcen: Keine Änderung von RAM-/CPU-Limits und keine neuen externen
Laufzeitdienste. Die Dateigrößenlimits sind keine Speicherreservierungen.
Beim Neuerstellen von Storage verwendete Docker zunächst seinen Standardwert
für MemorySwap; der automatische Limitvergleich erkannte die Abweichung.
Vor Aktivierung der App wurde der vorherige Wert 402.653.184 Bytes wiederhergestellt
(RAM ebenfalls 384 MiB, damit weiterhin kein zusätzlicher Swap). Der Host hat
keinen Swap. Alle laufenden Ressourcenlimits stimmen abschließend mit dem
gesicherten Ausgangszustand überein.
Das vorhandene Swap-Limit ist inzwischen zusätzlich in Compose festgeschrieben;
erneuter Patch-Dryrun meldet `changed: false`, `docker compose config --quiet`
ist erfolgreich. Dadurch bleibt dieser Wert auch bei künftigen Storage-Neustarts
erhalten. Konfigurationsbackup davor:
`/root/backups/sitov-storage-upload-limit/20260920T120713436327Z-docker-compose.yml`,
SHA256 `0f1793879fa58f78f8d4c6ff6650e1173a8f10709cb39e1f6416ff4623cec247`.

RPC-Grenze: Fehler vor Funktionseintritt (z. B. ungültig kodierte UUID,
fehlendes EXECUTE-Recht oder Datenbankausfall) bleiben PostgREST-/Transportfehler.
Die Anwendung behandelt diese zusätzlich zu den strukturierten RPC-Antworten.
