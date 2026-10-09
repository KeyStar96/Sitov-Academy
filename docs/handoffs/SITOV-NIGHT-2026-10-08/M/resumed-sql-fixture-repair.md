# Sitov Academy: eingefrorene SQL-Fixtures wieder ausführbar

Der serielle Lauf aller 44 `supabase/tests/sitov-*.test.mjs` auf `072173261e6a1e37b54d1dabb7ee2842719fb650` ergab 228 bestandene, zwei fehlgeschlagene und vier übersprungene Tests (234 insgesamt). Die Dateien enthalten unterschiedliche statische, PGlite- und native PostgreSQL-Prüfungen; dies ist kein pauschaler nativer Nachweis.

Der eingefrorene 96-Test verglich seinen historischen Installer mit der inzwischen bis 108 erweiterten kanonischen Datei. Er prüft jetzt weiterhin bytegenau den unveränderten Plan, Baseline-Hash und die vier Original-Overlays sowie die tatsächlich passende historische kanonische Datei aus `67bc5dfb711df423423d252c1b119c368616c57a`. Ihr SHA-256 wurde unabhängig gegen `plan.canonicalSha256` bestätigt. Weder Plan noch Installer, Migrationen oder Schema wurden geändert.

Der 105-Publikationsautoritätstest konnte wegen einer fehlenden lokalen `submit`-Fixturefunktion seine Autoritäts- und Konkurrenzprüfungen nicht erreichen. Der ergänzte Adapter ruft den tatsächlichen Submit-RPC mit Versuch, Revision, Antworten und Request-ID auf. Alle ursprünglichen Prüfungen bleiben erhalten.

Beide betroffenen Dateien bestanden anschließend zusammen auf dem vorhandenen lokalen, ausschließlich per Unix-Socket erreichbaren PostgreSQL 17: **11 Tests bestanden, null Fehler und null Skips**. Der Test erzeugt und entfernt seine eigenen synthetischen Datenbanken. Log: `/tmp/sitov-night-m-sql-fixture-repair.log`. Kein HTTP-/Browser-/Mikrofon- oder Produktionsnachweis; kein produktiver Datenzugriff oder Deployment. Die vier Skips des breiten Laufs wurden dadurch nicht behoben und sind weiterhin getrennt auszuweisen.
