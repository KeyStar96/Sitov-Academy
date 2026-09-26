# Phase 7 — ausschließlich lokale Abnahme

Phase 6 wird übersprungen. Es gibt keinen Produktionsschritt in dieser Anleitung. Produktion wird weder migriert noch aktiviert.

## Lokale Umgebung

Die Abnahme verwendet echte, isolierte PostgreSQL- und PostgREST-Prozesse auf Loopback. Nur die Auth-Antwort ist synthetisch. Alle RPCs, Rechte, Freigaben und Bewertungen laufen in PostgreSQL. Die Testpersonen und ihre Lerndaten sind künstlich; der Lernpfad-Import verwendet den bereits lokal abgenommenen A1.1-Seed unverändert.

```sh
git show 09e66e9:supabase/schema.sql > /tmp/sitov-phase7-schema37.sql
python3 deploy/vps/tests/phase7-local-dashboard.py \
  --output /tmp/sitov-phase7-check --schema /tmp/sitov-phase7-schema37.sql \
  --postgrest /absoluter/pfad/postgrest --serve
```

Der Harness verwendet den Backup-Adapter von `deploy/vps/migrate-local.py`. Er prüft Migrationen 38/39 zweimal, führt die Rückwege in umgekehrter Reihenfolge aus und wendet beide erneut an. Vor jedem Migrationslauf, Import und Fixture-Aufbau entsteht ein geprüftes PostgreSQL-Backup. Schemaexport, öffentlicher Katalog, Performance-Samples und lokale Testzugänge liegen ausschließlich im geschützten Ausgabeordner.

In einem zweiten Terminal die App ausschließlich mit dieser lokalen Umgebung starten:

```sh
python3 - <<'PY'
import json, os, subprocess
env = {**os.environ, **json.load(open('/tmp/sitov-phase7-check/environment.json'))}
subprocess.run(['npm', 'run', 'build'], env=env, check=True)
subprocess.run(['npx', 'next', 'start', '-p', '3107', '-H', '127.0.0.1'], env=env, check=True)
PY
```

```sh
PHASE7_SESSION_FILE=/tmp/sitov-phase7-check/session.json npx playwright test --config e2e/master4-phase7.config.ts
node --test --test-concurrency=2 supabase/tests/*.test.mjs scripts/path-listening-audio.test.mjs scripts/import_learning_path.test.mjs
python3 deploy/vps/export-path-types.py /tmp/sitov-phase7-check/public-catalog.json
npx tsc --noEmit
```

Für den vollständigen Jest-Lauf `RUN_SELF_HOSTED_INTEGRATION=1`, `SELF_HOSTED_TEST_URL=http://127.0.0.1:54345` und `SELF_HOSTED_TEST_ANON_KEY` mit dem lokalen Anon-Key aus `environment.json` setzen. Python-Tests benötigen PyYAML. Keine Tests oder Axe-Regeln ausschließen. Nach Abnahme App und Harness mit Ctrl-C beenden; der Harness beendet beide Datenprozesse und entfernt den temporären Cluster. Backups und Nachweise bleiben im geschützten Ausgabeordner.

## Rückweg

Für einen lokalen Rückweg zuerst `39_teacher_dashboard.sql`, danach `38_learning_sessions.sql` aus `supabase/vps/rollback/` jeweils separat über den Backup-Runner anwenden. Das passende frühere UI muss dazu verwendet werden. Neue Lern- und Auditdaten werden archiviert; Tageswerte bleiben erhalten. Rückweg 39 behält bewusst die archivbewussten Lernpfad-Leser und -Schreiber, damit alte Versuche auch mit dem früheren UI nicht wieder aktiv werden. Rückweg 38 erhält die Löschung abgelaufener Sitzungen bei neuen Tagesaktivitäten. Eine exakte Wiederherstellung verwendet das vollständige Backup.

Die regelmäßige Löschung abgelaufener Sitzungsrohdaten ist die ausdrücklich angeforderte Ausnahme von der Archivierungsregel: auf neue Lernaktivität folgt die globale Löschung der mehr als 180 Tage alten Sitzungen. Dauerhafte Tagesaggregate bleiben bestehen. Es wird kein neuer Hintergrunddienst eingerichtet.


## Echte Parallelität prüfen

Nach dem Browserlauf (oder davor, vollständig beendet) auf derselben isolierten Datenbank ausführen; währenddessen keinen Test mit exakt 200 Personen starten:

```sh
python3 deploy/vps/tests/phase7-concurrency.py \
  --connection /tmp/sitov-phase7-check/connection.json \
  --output /tmp/sitov-phase7-concurrency-check
```

Das Skript akzeptiert nur den temporären Unix-Socket des Phase-7-Harness, prüft vor Fixture-Schreibvorgängen ein vollständiges `pg_dump`-Backup und beobachtet vier Rennen über unabhängige Verbindungen. Es räumt ausschließlich seine eigenen synthetischen Datensätze auf. Der Ausgabeordner muss neu sein, damit kein Backup überschrieben wird. Für einen wiederholten vollständigen Browserlauf den Harness mit einem neuen Ausgabeordner neu starten: Die Notfalltests setzen absichtlich den Lernstand der Testperson zurück.
