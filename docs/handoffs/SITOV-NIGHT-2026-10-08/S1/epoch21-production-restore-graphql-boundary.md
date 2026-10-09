# Sitov Academy – S1 Epoch 21: unvollständige Produktionskopie

Status: **SAVED_INCOMPLETE / NOT_RELEASE_READY**. Ein ausdrücklich freigegebener Restore in ausschließlich `sitov_night_migration_rehearsal_20261009`; kein weiterer Versuch, keine Migrationen 93–109, keine Produktionsschreibzugriffe.

## Nachweise und Grenze

- Frischer Vorabcheck: 2466 MiB verfügbar, PostgreSQL 15.19, unveränderte isolierte Laufzeitgrenzen und drei erfolgreiche HTTP-Prüfungen. Archiv-SHA-256 `cffcbc9cc9918ceb9e71e5669ead7b8b93922639fb92990ffa299d6513e9b73e`; korrigierte TOC mit ausschließlich 22 operativen pg_cron/pg_net-Ausnahmen unverändert.
- Alle statisch erfassten Archiv-Owner und expliziten ACL-Zielrollen waren vorhanden. Beide von M ergänzten Rollen entsprachen den freigegebenen Flags; keine Passwortübernahme, keine Mitgliedschaften, keine Rollenänderung durch S1.
- Der einzige Restore brach bei der exakten ACL-Wiederherstellung ab: Die erwartete Signatur von `graphql_public.graphql` fehlt. Installiertes pg_graphql: 1.6.2. Fehlernachweis SHA-256 `6a4eb50a27afb1284fa1e1e3914b5321935f4881174b70b34f349f8bd8d61436`. Die erste automatische Einordnung als Rollenfehler war falsch und wurde ausdrücklich korrigiert.
- Zu diesem Zeitpunkt lagen 185 Nicht-Systemtabellen sowie 75 auth.users- und 75 public.profiles-Zeilen vor. Dies beweist keine vollständige Kopie, keine abgeschlossene ACL-Wiederherstellung und keine Rechteprüfung aller 75 Konten.
- Die separate QA-Datenbank `postgres` hatte unmittelbar vor und nach dem fehlgeschlagenen Restore jeweils dieselben 188 Tabellen mit identischen vollständigen Zeilenhashes: `f78808720aa242bfb6a17dde4b398497d1f0478465ba4eb9c9d376d25e1236b1`. Drei HTTP-Prüfungen waren danach erfolgreich.

## Zusätzlicher Fehler bei der Teil-Baseline

Die anschließende ausschließlich lesende Vollzeilen-Hash-Abfrage der teilweise kopierten Tabellen schlug fehl. Es gibt **keine erfolgreiche Teil-Baseline**. Privater SQL-Fehlernachweis SHA-256 `2d11cfcbb5ba556df2789ddadb0049a715554e238f50ff3e61e7fc624d3390cb`. Der folgende Laufzeitguard endete mit AssertionError. Aktuelle Laufzeitgesundheit und die QA-Erhaltung **nach dieser letzten Abfrage sind unbestätigt**. Die vorangegangenen erfolgreichen Prüfungen dürfen nicht als nachträglicher Gesundheitsnachweis verwendet werden.

Die genaue Ursache wurde nicht festgestellt. Die große JSON-Aggregation unter den unveränderten Speichergrenzen ist lediglich eine mögliche Erklärung; OOM, Neustart oder Datenverlust werden nicht behauptet. M wurde über den zusätzlichen Fehler und die offene Gesundheitsprüfung informiert. Keine weiteren Probes oder Wiederherstellungen nach SAVE_ONLY, keine Änderung von Limits, Rollen, Extensions, Wrappern oder Servereinstellungen und kein Neustart durch S1.

## Übergabe

M meldete anschließend einen eigenen Produktions-Lesenachweis: pg_graphql 1.5.11 und die extensionseigene graphql_public.graphql-Signatur. S1 hat diese Meldung nicht unabhängig geprüft. Extension-Verfügbarkeit, Upgrade-/Downgradepfade und verbleibende TOC wurden unter dieser Lease nicht mehr geprüft. M entscheidet nach eigener Laufzeitprüfung und neuer Freigabe über den kompatiblen nächsten Schritt. Die Kopie bleibt erhalten; Rohfehler, Schema-/Funktionsdaten und Kontodaten bleiben ausschließlich in privaten Dateien (0600, Verzeichnisse 0700).

Private Fortsetzung: Koordinationsdatei `S1/epoch21-resume-ledger.json`; Remote-Artefakte unter `/tmp/sitov-night-20261008-qa-master/S1-epoch21-rehearsal/`. Vollständiger Restore, sämtliche Zeilenhashes, effektive Rechte aller 75 Konten und Migrationsprobe sind offen. Kein Deployment, keine Freigabe und kein Push durch S1.

Die SAVE-Phase wurde durch Kontextkompaktierung über die ursprüngliche Deadline 18:36:41 UTC hinaus verzögert. Danach wurden ausschließlich vorhandene Nachweise gesichert, diese Dokumentation committet und der Status auf WAIT gesetzt; keine neue Prüfeinheit.
