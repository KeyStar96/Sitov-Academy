# Sitov Academy – Epoch 57: tatsächliche Scratch-Voraussetzungen

Ergebnis: `ACTUAL_ISOLATED_WRITER_CONNECTION_LOSS_OOM_HOLD`.

Tatsächlicher vollständiger Rehearsal-Abzug: `sitov_night_migration_rehearsal_20261009`, OID 29771, Eigentümer `supabase_admin`. Die geschützte Original-185-Prüfung verwendet ausschließlich die eingefrorenen ursprünglichen Spalten; die kleine QA-Datenbank `postgres` wird separat über alle 188 Tabellen geprüft. Die Gesamtzahl 211 des migrierten Rehearsals wird nicht mit 185 gleichgesetzt.

Tatsächlich abgeschlossene Schritte:

- Originaler eingefrorener 538/59/10-Collector vollständig gelesen: ja
- Native unveränderliche Definitionen vollständig gelesen: ja
- Exakte Migrationen 114/115 ausschließlich eigener Scratchkopie angewandt: ja
- Eigene isolierte Scratchkopie erstellt: ja
- Eigene Scratchkopie mit Name-/Owner-/OID-/Null-Sessions-Guard entfernt: nein / offen
- Vollständige Original-185-Nachprüfung identisch: nein / offen
- Vollständige kleine QA-188-Nachprüfung identisch: nein / offen

Tatsächliche Collector-Klassifikation: `OLD_REVIEW_REQUIRED`. Abdeckung: `{"tasks": 538, "parents": 59, "objectives": 10}`. Native Definitionszeilen: `0`.
Vollständiger BeforeFull-Driftvergleich: tasks=0, parents=0, objectives=0.
Tatsächlicher Fehler (error): `TableHashError read-only child failed`.
Tatsächlicher Fehler (cleanupError): `TableHashError RuntimeError: 10-cleanup-identity native psql exit 2`.
Tatsächlicher Fehler (afterGuardError): `TableHashError TableHashError: read-only child failed`.

Die native Definitionsrelation dieser Rehearsal-Scratch enthielt tatsächlich null Zeilen. Das ist der durch M bestätigte vollständige Abzug; die fünf Definitionen der kleinen QA sind Testfixtures und keine Übernahmevoraussetzung.
Die Original-185-Baseline ist die qualifizierte eingefrorene POST-CHANGE-Spaltenprojektion derselben geschützten Rehearsal-Datenbank einschließlich dokumentierter storage.buckets-Sicherheitsausnahme; kein roher Pre-Migration-Produktionshash.

Original-SQL, native JSONL-/psql-Ausgaben, Fehler, Vorher-/Nachherwerte und Identitäten sind privat unter S1/epoch58-* mit SHA-256-Manifest gesichert. Der Runtime-Guard bleibt unverändert bei mindestens 1984 MiB und exakten QA-Caps.

Eigene begrenzte Prozesse beendet und geerntet: jobs=0, active_jobs=0. Fernkern beendet am `2026-10-10T09:04:59.700509+00:00`.

Der originale Combined-CAS-Emitter wurde tatsächlich einmal mit COMMIT-Ziel ausschließlich in eigener Scratchkopie ausgeführt. Er verlor die Serververbindung (psql Exit 2, kein SQLSTATE, keine COMMIT-Bestätigung). Die unmittelbare vollständige Recovery, Cleanup-Identitätsabfrage und Nachprüfung scheiterten ebenfalls an der Verbindung. Es gibt keinen belegten NEW-Zustand und keinen vollständigen Rollback-Nachweis. Keine Wiederholung des Writers, kein Audioimport, kein Produktionszugriff und keine Änderungen an geschützten Original-/Rehearsal-/kleinen QA-Daten durch S1. Veröffentlichung und produktive Datenübernahme bleiben offen.

Nach dem Verbindungsverlust war der DB-Container wieder running/healthy; der tatsächliche State enthält OOMKilled=true und der unveränderte pinned Runtime-Guard schlägt fehl. Deshalb kein neuer Writer, kein Guard-Bypass, kein FORCE und kein weiterer DROP. Eine begrenzte lesende Identitätsabfrage bestätigt die eigene zurückbehaltene Scratchkopie mit exakt gleichem Name, Owner und OID sowie null Sessions.

Eigene zurückbehaltene Scratchidentität: `{"oid": "54639", "name": "sitov_s1_epoch58_prereq_20261010090403", "owner": "supabase_admin"}`.

Buchhaltungskorrektur: Das originale rohe Ledger behält irrtümlich den initialen CASBatchEmit=false-Wert. Tatsächlich wurde emitted und ein Writer gestartet; Original-SQL, adoptionCalls=1 und writerActualExit belegen dies. Die Originaldatei bleibt unverändert, der abgeleitete Nachweis korrigiert das Feld explizit.
