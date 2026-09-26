# Phase 4: Lokaler Lernpfad-Import

Das Import-Skript liest den vollständigen Seed und prüft ihn mit `lib/learning-path-schema.ts`. Die JSON-Datei bleibt unverändert. Ohne `--import` benötigt der Aufruf weder Zugangsdaten noch eine Datenbank:

```sh
npm run seed:learning-path
npm run seed:learning-path -- /absoluter/pfad/seed.json
```

Vor jedem schreibenden Aufruf ein frisches Backup über den vorhandenen Ablauf `deploy/vps/migrate-local.py` erstellen. Beim isolierten lokalen PostgreSQL-Test übernimmt dessen Testadapter den Backup-Aufruf. `--backup-dir` muss auf das private Verzeichnis mit `COMPLETE`, `sha256.json` und `postgres.dump` zeigen. Sämtliche im Manifest aufgeführten Dateien werden per SHA256 überprüft. Der COMPLETE-Zeitpunkt darf höchstens eine Stunde zurückliegen; ein Backup wird jeweils für genau einen Importversuch verwendet. Backup-Verzeichnisse und Zugangsdaten gehören nicht ins Git-Repository.

Die Variablen `PATH_SEED_SUPABASE_URL` und `PATH_SEED_SERVICE_ROLE_KEY` müssen explizit im Prozess gesetzt sein. Das Skript lädt keine `.env` und übernimmt keine öffentlich verfügbaren App-Zugangsdaten. Erlaubt sind ausschließlich lokale Origins mit `localhost`, `127.0.0.1` oder `[::1]`; Weiterleitungen werden abgelehnt. Die lokale Instanz benötigt Migration 36 und die Service-Role-Berechtigung für `import_learning_path_seed`.

```sh
npm run seed:learning-path -- --import --backup-dir /absoluter/pfad/zum/frischen/backup
```

Der Service-Role-Key wird nur als HTTP-Header an die lokale Instanz übergeben. PostgreSQL importiert alle Pfade in einer gemeinsamen Transaktion über die bestehenden Quellkennungen und übernimmt anschließend die Archivierung sowie die Lehrkraft-Notizen. Ein erneuter Import aktualisiert dieselben Datensätze. Ein fachlicher RPC-Fehler verwirft die vollständige Transaktion.

Die Quellkennungen und Aufgaben-UUIDs bleiben bei Inhaltskorrekturen stabil. Nicht mehr enthaltene Knoten und Aufgaben werden archiviert. Der Phase-3-Vertrag bewahrt Lernziele und ihre historischen Referenzen: Ein entferntes Lernziel kann deshalb die vorgeschriebene Testabdeckung verletzen und den Import zurückweisen. Auch der direkte Tausch belegter Pfadnummern wird durch den Eindeutigkeitsindex abgelehnt. Solche Strukturänderungen benötigen eine gesondert geprüfte Migration; gewöhnliche Inhaltskorrekturen, Ergänzungen und unveränderte Wiederholungen erfolgen per Upsert. Bei Ablehnung bleibt der komplette bisherige Datenstand erhalten.

Nach erfolgreichem Import prüft das Skript die Pfadkennungen, eindeutigen Unit-IDs sowie Pfad-, Knoten-, Aufgaben- und Lernzielzahlen gegen den validierten Seed. Der geschützte Backup-Ordner enthält anschließend `learning-path-import.json` als Nachweis. Die lokale Abnahme prüft zusätzlich die gespeicherten Daten und ihre Darstellung; Zähler allein ersetzen diese Abnahme nicht.

Der HTTP-Aufruf hat standardmäßig 180 Sekunden Zeit. `--timeout-ms N` erlaubt 1 bis 600000 Millisekunden. Bei Verbindungsabbruch, Zeitüberschreitung oder einer unpassenden Antwort ist der Commit-Status unbekannt: lokale Datenbank prüfen, frisches Backup erstellen und denselben vollständigen Seed wiederholen. Das Skript führt keine automatische Wiederholung aus und gibt keine internen SQL-Fehler, Antworten oder Schlüssel aus.

```sh
node --test scripts/import_learning_path.test.mjs
```

Für den Rückweg gelten `supabase/vps/rollback/36_migrate_old_grammar_progress.sql` und die zugehörige Phase-4-Dokumentation. Das Backup enthält den exakten Datenstand vor dem jeweiligen Import.
