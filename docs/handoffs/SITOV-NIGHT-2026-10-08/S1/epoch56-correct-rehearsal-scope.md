# Sitov Academy – Epoch 56: vollständigen Rehearsal-Scope tatsächlich bestätigt

Die originale lesende Identity-/Schemaabfrage lief im QA-Container `sitov-night-20261008-qa-db` ausdrücklich gegen `sitov_night_migration_rehearsal_20261009`. Tatsächliche Identität: OID 29771, Eigentümer und angemeldete Rolle `supabase_admin`, PostgreSQL 15.19, 211 native Tabellen.

Die nachfolgende originale Scope-Abfrage bestätigt 9.569 Aufgaben mit `node_id` und ebenso 9.569 Aufgaben in `is_path`-Einheiten, 856 Parents und 66 Pfadeinheiten. Die vollständigen Tabellen enthalten dagegen 10.173 Aufgaben und 1.280 Lerneinheiten. Der erste strikte Vergleich hatte irrtümlich Gesamttabellenzählungen mit erwarteten Pfadteilmengen verglichen; die zweite lesende Abfrage klärt diesen Unterschied anhand tatsächlicher Daten. Es besteht kein daraus abgeleiteter Scope-Mismatch.

`sitov_special_private.definitions` existiert als Relation im vollständigen Abzug. `path_private.sitov_revision_projection(uuid)` ist dort tatsächlich nicht installiert (`to_regprocedure` = null). Definitionen wurden nicht ausgelesen; ihre Anzahl und konkreten Inhaltsbindungen sind weiterhin offen.

Der unveränderte Runtime-Guard bestand um 08:36:13 UTC am 10.10.2026: 2244,42 MiB verfügbar bei verbindlich mindestens 1984 MiB, exakt 960 MiB / 2 CPU, drei HTTP-200-Antworten, kein OOM.

Es wurde keine Scratchkopie erstellt, keine Migration angewandt und kein Collector-/CAS-DML ausgeführt. Für frische vollständige Protected-185-/QA-188-Baselines, Kopie, exakte 114/115-Voraussetzungen, Collector, Nachprüfungen und Cleanup bestand danach kein ausreichend reserviertes Restfenster. Die Guardkette wurde nicht verkürzt. Der Befund ist ein Scope- und Runtime-Nachweis, kein vollständiger 538/59/10-Collector-, Drift- oder Rehearsal-PASS.

Korrektur zu Epoch 55: Dort lief der Collector gegen die kleine QA-Datenbank `postgres`. Die ausgegebenen 59 Parent- und 10 Goal-Werte waren sämtlich null; sie belegen keinen Bestandsabzug. Der damalige originale SQLSTATE 42883 bleibt als Fehlerbeleg erhalten.

Originale SQL, unveränderte Ausgaben, Fehlerdateien, Identitäts-/Runtime-Belege und SHA-256-Manifest sind privat unter S1/epoch56-* gesichert. Null eigene laufende Jobs, keine Datenbank-/Snapshot-/Produktionsschreibvorgänge, kein Audioimport und keine Veröffentlichungs- oder Übernahmefreigabe.
