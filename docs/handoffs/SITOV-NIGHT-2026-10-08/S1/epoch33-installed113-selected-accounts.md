# Sitov Academy — S1 epoch33: Migration 113 im eigenen PG15-Klon

Basis: `20dfe60b6cae95c8791f484d336201952f9eb1a3`. Ausschließlich der eigene Klon `sitov_night_migration_rehearsal_20261009` wurde verändert; keine Produktions- oder gemeinsame QA-Datenbankänderung. Migration 113 wurde als tatsächlicher Migrator `supabase_admin` zweimal erfolgreich angewendet. Beide Anwendungen ändern ausschließlich die Definitionen von `sitov_access_private.legacy_unit_allowed(uuid,uuid)` und `sitov_access_private.item_allowed(uuid,text,text)`; zweite Anwendung idempotent. Funktionsbesitzer, ACLs, Konfiguration, Schema-ACLs und Policies sind exakt erhalten.

Migration-SHA256: `b6ad3ebc3a520be0ff6408dcd146dfc01e894c4f99b9486d4fb80d3e883d8b85`.
Fingerprint der vier optimierten Guard-Metadatensätze nach 113: `1d8aa453264470db3cb3b61edc56276a13a64fc1f7d13fa8e48a0ecd48afb5db`.

## Tatsächliche Konten: vier vollständige ausgewählte Prüfungen

Die tatsächlichen Lehrkräfte an Index 7 und 73 sowie Schüler an Index 0 und 1 wurden mit ihren gespeicherten Identitäten und App-Metadaten im nativen `authenticated`-Kontext geprüft. Je Konto: alle 1280 Units, alle 960 Verben in vier 240er-Blöcken, Owner-Referenz50 einschließlich Null/Leer-Kontrollen, sortierte erlaubte IDs mit Multiplizität, vollständige Unit-RLS-Sicht, zehn Verb-Level und Null-Unit-Kontrollen. Alle Vergleichsfelder entsprechen exakt den SHA-geprüften Vorher-Belegen. Server-Statement-Timeout je Rechtephase: acht Sekunden.

| Kontoindex | Rolle | erlaubte Units | erlaubte Verben | Vorhervergleich |
| --- | --- | ---: | ---: | --- |
| 7 | teacher | 905 | 586 | alle Felder exakt |
| 73 | teacher | 904 | 586 | alle Felder exakt |
| 0 | student | 164 | 140 | alle Felder exakt |
| 1 | student | 164 | 140 | alle Felder exakt |

Vier tatsächliche Storage-Objekte lieferten pro Konto Ergebnisse. Der historische Storage-Vergleich war ein SQL-Fehler und ist ausdrücklich keine boolesche Vorher-Baseline. Owner-Referenzen wurden mit dem notwendigen Besitzerkontext ausgeführt. Diese SQL-Claims sind keine signierten Login-, Session- oder AAL-Belege. M übernimmt den vollständigen Nachherlauf aller 75 Konten.

## Erhaltungsnachweise und offen gebliebene Gates

Vor Anwendung bestanden die vollständige Original185-Projektion (`cfeb746a211c54255d8c4d519f92efe05637482f3f2ca34194f894ce32ef8814`) und gemeinsame QA188 (`f78808720aa242bfb6a17dde4b398497d1f0478465ba4eb9c9d376d25e1236b1`). Frische Anfangsprüfung: 2451 MiB verfügbar, fünf korrekte isolierte Container ohne OOM und drei HTTP200-Healthchecks.

Der abschließende parallele Stream wurde zu spät gestartet und an der verbindlichen Grenze 21:12:42.054113 UTC abgebrochen. Weder Original185 noch QA188 gelten als final vollständig. Die vorhandene Datei `production-after-original185-projection.json` stammt aus dem Vorabcheck und darf nicht als abschließender Nachher-Beleg verwendet werden. Finaler Runtime-/Speicher-/HTTP-/OOM- und Null-Aktivquery-Nachweis fehlt ebenfalls. Beide lokalen SSH-Wrapper sind beendet; keine abgelösten Jobs wurden gestartet. Der Datenbank-Aktivquery-Stand ist nach dem Abbruch nicht erneut verifiziert.

Die korrigierte kommerzielle Rollback-Fixture und die Storage-Fixture wurden in dieser Epoche nicht erneut ausgeführt. Die optionale Anpassung der nativen 113-Gegenbeispiele an PG15 wurde nicht vorgenommen; die zuvor akzeptierten 24 PG17-Prüfungen bleiben separate Evidenz. Diese Prüfungen und die finalen Erhaltungsgates sind an M übergeben. Keine Release-Freigabe.

Private Belege stehen unter `S1/epoch33-*` im Koordinationsverzeichnis (0700/0600), einschließlich SHA256-Manifest, Einzelphasen, Metadaten und Resume-Ledger. Es wurden keine sensiblen Kontobelege eingecheckt. Änderungen dieses Commits betreffen ausschließlich diesen Übergabebericht. S1 geht anschließend in WAIT.
