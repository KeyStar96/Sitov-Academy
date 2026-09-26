# Phase 5: Migration und Betriebsgrenze

## Lokal geprüfter Vertrag

Migration **37_vocabulary_carryover.sql** ergänzt `vocabulary_carryover_preferences` und die zielniveauabhängigen Bewertungsaufrufe. Ausführen ausschließlich über `deploy/vps/migrate-local.py`, mit geprüftem PostgreSQL-/Storage-Backup. Die lokale Prüfung verwendet denselben Runner mit einem Adapter für eine kurzlebige synthetische PostgreSQL-Instanz; keine produktiven Daten werden kopiert.

`get_vocabulary_carryover(p_target_level)` liest Entscheidung und Kandidaten. `begin_vocabulary_level(p_target_level)` markiert den tatsächlichen ersten Lern-/Einstufungsbeginn und liefert `promptRequired`. `set_vocabulary_carryover(p_target_level,p_enabled)` speichert die Entscheidung. `get_vocabulary_carryover_cards(p_target_level,p_offset=0,p_limit=500)` liefert die eigenen begonnenen Kandidaten samt originalem Richtungsfortschritt für die Vorschau, auch bei ausgeschaltetem Schalter. Die Actions nehmen diese Kandidaten erst bei `enabled=true` in Box, Fälligkeiten und Sitzung auf.

`submit_vocabulary_answer`, `submit_vocabulary_answer_once`, `submit_vocabulary_self_rating_once` und `check_vocabulary_retry` haben zusätzliche Überladungen mit dem Pflichtparameter **`p_target_level text`**. Die bisherigen Signaturen bleiben für ihren bisherigen Herkunftsniveau-Zugriff erhalten. Neue Clients übergeben immer das aktuelle Niveau. PostgreSQL prüft das Ziel einschließlich Freigabe, Schalter, persönlichem Fortschritt, Herkunftsreihenfolge, Eigentum und Pause; gespeicherte Antwortbelege werden erst nach dieser Prüfung gelesen und sind ebenfalls an das Ziel gebunden.

Die neue Leseschnittstelle erweitert keine Tabellen-RLS und gibt keine fremden oder nie begonnenen privaten Karten frei. Eigene Karten bleiben in ihrer Ursprungs-Unit. Bewertungslogik und Termine werden aus den letzten vollständigen Funktionskörpern übernommen. Eine Schalteränderung verwirft veraltete Sitzungen in anderen Browser-Tabs über den bestehenden Invalidierungskanal.

## Reproduktion

```sh
git show b7dc0c7781e75afc3c7aa34d827276f3d583d996:supabase/schema.sql > /tmp/sitov-phase5-schema36.sql
python3 deploy/vps/tests/phase5-local-carryover.py \
  --output /tmp/sitov-phase5-check --schema /tmp/sitov-phase5-schema36.sql \
  --postgrest /absoluter/pfad/postgrest --serve
```

Die temporären Testzugänge stehen nur im geschützten Ausgabeordner. In einem zweiten Terminal:

```sh
python3 - <<'PY'
import json, os, subprocess
env = {**os.environ, **json.load(open('/tmp/sitov-phase5-check/environment.json'))}
subprocess.run(['npm', 'run', 'build'], env=env, check=True)
subprocess.run(['npx', 'next', 'start', '-p', '3105', '-H', '127.0.0.1'], env=env, check=True)
PY
```

```sh
PHASE5_SESSION_FILE=/tmp/sitov-phase5-check/session.json npx playwright test --config e2e/master4-phase5.config.ts
node --test --test-concurrency=2 supabase/tests/*.test.mjs scripts/path-listening-audio.test.mjs scripts/import_learning_path.test.mjs
python3 deploy/vps/export-path-types.py /tmp/sitov-phase5-check/public-catalog.json
npx tsc --noEmit
```

Jest vollständig mit `RUN_SELF_HOSTED_INTEGRATION=1`, `SELF_HOSTED_TEST_URL=http://127.0.0.1:54341` und dem lokalen Test-Anon-Key ausführen. Python-VPS-Tests benötigen das bereits vorhandene PyYAML; TTS-Tests aus `deploy/vps/` starten. Keine Tests überspringen. Nach Abnahme beide lokalen Prozesse mit Ctrl-C beenden. Die ausschließlich lokale Test-Gateway-Route `/__phase5/reset` setzt nur die synthetischen Fixtures nach einem Backup zurück und ist kein App-Endpunkt.

## Produktivaktivierung: Umfang muss geklärt werden

Produktion steht nach lesender Kontrolle weiterhin auf Migration 31 und Release `e6a8d32f4ce74ab20a0ff5a4750927c37c108575`, Health `ready`. Die aktuelle Aufgabenbegrenzung lautet **„ausschließlich die Aufgaben aus Phase 5“**. Die bisherigen Statusabschnitte haben die produktive Aktivierung von 32–36 ausdrücklich offengelassen.

37 hat keine unmittelbare SQL-Abhängigkeit von 32–36. Ein isolierter Vorzug von 37 ist trotzdem nicht der geprüfte Migrationsweg: 37 sichert die jeweils vorgefundenen Reset-Funktionen einmalig; eine spätere 35 und Wiederanwendung von 37 könnte dann die alte Sicherung ohne Lernpfadreset wieder einsetzen. Deshalb darf 37 hier nicht einfach vorgezogen werden. Das App-Artefakt enthält außerdem die bereits lokal umgesetzten früheren Oberflächenphasen.

Der geprüfte geordnete Weg ist **32 → 33 → 34 → 35 → 36 → 37**. 35 archiviert alte Grammatik-Units; der anschließende Phase-4-Import aktiviert 7 Pfade mit 769 Aufgaben und erzeugt gegebenenfalls Lehrkraft-Notizen. Diese früheren Phasen betreffenden Produktionsänderungen werden nicht stillschweigend unter Phase 5 durchgeführt.

Nach ausdrücklicher Freigabe dieses zusätzlichen Aktivierungsumfangs:

1. Endgültige Revision und Migrations-/Importprüfsummen festhalten; PostgreSQL-15.8-Kompatibilität mit dem geordneten Ablauf im isolierten VPS-Klon prüfen. Lokale PostgreSQL-17.11-Nachweise ersetzen diese Prüfung nicht.
2. Endgültigen Commit veröffentlichen und `deploy-release.sh --prepare-only` ausführen. Bestehende Ressourcenlimits beibehalten.
3. `migrate-local.py --apply 32_last_active_level.sql 33_path_exercise_types.sql 34_path_content_contract.sql 35_path_learning.sql 36_migrate_old_grammar_progress.sql 37_vocabulary_carryover.sql --sql-dir <vorbereitetes-release>/supabase/vps --keep-stopped`; vollständiges Backup kontrollieren, App bleibt gestoppt.
4. Separates frisches Importbackup über `migrate-local.py --backup-only`; bestehenden Seed-CLI mit explizitem lokalen VPS-Endpunkt, Service Role und `--backup-dir` ausführen. 7/85/769/87-Zahlen, IDs und Inhalte prüfen.
5. `deploy-release.sh --activate <12-stellige-revision> --schema-changed`; lokale und öffentliche Healthprüfung, Schemaabgleich und Lernvertrag prüfen. Mail nur gemäß vorherigem Betriebszustand.

## Rückweg

Für Phase 5 den passenden alten Appstand zusammen mit `supabase/vps/rollback/37_vocabulary_carryover.sql` über den Backup-Runner verwenden. Entscheidungen werden mit `is_active=false` archiviert, der ursprüngliche Schalterwert, Karten, Fortschritte und Antwortbelege bleiben erhalten. Neue öffentliche RPCs werden entzogen, die zuvor gesicherten Reset-Funktionen wiederhergestellt. Rückweg funktioniert auch während eines laufenden Gesamtresets; Wiederanwendung stellt dessen Schreibschutz wieder her.

Nach einem kumulativen Release sind nötige Rückwege in umgekehrter Reihenfolge **37, 36, 35** jeweils separat auszuführen; der Runner akzeptiert kein gemeinsam umgekehrt sortiertes Array. Bei Fehlern nach Schemaänderung App/Mail gestoppt lassen, bis Datenbank und Release wieder zusammenpassen. Eine exakte Wiederherstellung verwendet das vollständige Backup. Rückwege 34/33 können bei vorhandenen neuen Aufgabentypen blockieren; keine Daten per `CASCADE` löschen.
