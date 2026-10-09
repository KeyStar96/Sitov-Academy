# Sitov Academy: geprüfter Zwischenstand am 10. Oktober 2026, 00:56 MESZ

Die Inhaltsmigration 114 und die neuesten Lernpfadkorrekturen sind integriert. Eine Veröffentlichung oder ein Deployment ist noch nicht erfolgt. Die Releasepolitik bleibt AUTO_DEPLOY mit vollständigen Abnahmeprüfungen.

## Datenbank und Bestandsschutz

- PostgreSQL 15.19, tatsächlicher Migrator `supabase_admin`, vorhandener isolierter Produktionsklon: 26 native Prüfungen, 15 erwartete Fehler und acht direkte beziehungsweise verzögerte Negativproben bestanden. Sämtliche Teständerungen wurden zurückgerollt.
- Vollständiger identischer Katalogimport sowie Ablehnung veränderter, verschobener, ausgelassener, umsortierter und anders übersetzter geschützter Aufgaben geprüft.
- Echte Lern- und Test-RPCs bewerten alte gespeicherte Aufgaben nach einer Inhaltskorrektur weiterhin anhand ihrer ursprünglichen Antworten. Der alte Test schließt mit 100 Prozent und unverändertem Review ab.
- Eine gefundene Schutzlücke bei direkten Änderungen an übergeordneten Knoten und Units wurde geschlossen. Die ergänzten verzögerten Prüfungen schützen deren archivierte Eigenschaften.
- M hat anschließend alle ursprünglichen 185 Tabellen anhand ihrer ursprünglichen Spalten erneut abgeglichen: SHA256 `cfeb746a211c54255d8c4d519f92efe05637482f3f2ca34194f894ce32ef8814`, unverändert einschließlich der bereits genehmigten privaten Audio-Bucket-Einstellung aus Migration 96.
- Die 188 gemeinsamen QA-Tabellen sind ebenfalls unverändert: SHA256 `f78808720aa242bfb6a17dde4b398497d1f0478465ba4eb9c9d376d25e1236b1`. Drei HTTP-Gesundheitsprüfungen bestanden; kein OOM und keine offenen Abfragen im Klon, zuletzt 2112 MiB verfügbar.
- Noch offen: vollständige Special-Abhängigkeiten und Fortsetzung, ID-Neuzuordnungen, übrige Elternvarianten sowie paralleler Import und Writer mit Sperrkonflikten. Diese Punkte sind keine bestandenen Prüfungen.

## Inhalte

S2 Epoche 29 korrigiert Begleittexte und drei öffentliche Aufgabenbeschränkungen. M bestätigt exakt 272 geänderte Textfelder, unveränderte Kennungen, Listenreihenfolgen und Antwortfelder für alle 4895 Aufgaben der fünf betroffenen Seeds. 84 gezielte Jest-Tests und 186 kombinierte Autorenprüfungen bestehen. Die unabhängige sprachliche Prüfung der Änderungen und neun vollständiger Versionsentwürfe läuft in S7. Von den ursprünglich 35 Versionsfällen sind acht vollständig überarbeitet; 27 fehlen noch. Zusätzlich liegt ein B1-Entwurf vor. Geschützte Antworten wurden daraus noch nicht veröffentlicht.

## Lokale Audioarbeit

Die deutschen Aufnahmen bleiben beim festgelegten männlichen Qwen-Profil. 1290 ursprüngliche Aufnahmen besitzen geprüfte rohe Klassifikator-Zeitmarken. Neun zuvor zurückgestellte Fälle wurden mit geprüfter Modellversion, archivierten Mess-WAVs und bekannter linearer Zeitabbildung erneut gemessen und unabhängig nachgerechnet; alle neun erfüllen unverändert dieselben Schwellen. Für insgesamt 1299 Originaldateien liegt damit eine vorbereitete Liste zur ausschließlichen Korrektur der Zeitmarken vor. Audio-Bytes und alte Metadaten wurden nicht überschrieben; der kontrollierte Datenbankabgleich und authentifizierte Rücklesetest stehen aus.

Weitere 278 Bestandskandidaten und 170 neue Aufnahmen haben die rohe Zeitmarkenprüfung bestanden. Eine zusätzliche Synthese des Wortes „ist“ scheiterte an einer zu kurzen Aufnahme; sie bleibt ausgeschlossen. Ein bereits vorhandener, separat diagnostizierter Kandidat wird geprüft.

Zwei zusätzliche lokale Whisper-Durchläufe sind abgeschlossen: 149 und 122 Aufnahmen, ohne Zieltextvorgabe, Upload oder kostenpflichtige API. Sie sind automatische Diagnose, kein menschlicher Hörtest. Die aktuelle Vorprüfung findet bei 4571 von 4685 eindeutigen Vortest-Audiotexten mindestens eine normalisierte Zeichenübereinstimmung. Das ist keine Freigabe; insbesondere Wortgrenzen, Homophone und Zahlen brauchen eigene Bewertung. Für 114 unbestätigte Texte in 152 Aufgaben erstellt S4 begrenzte konkrete Korrekturvorschläge. Weitere Audioerzeugung und Import erfolgen erst mit endgültig geprüften Texten.

## Nächste Abnahme

Offene Inhaltstexte und Versionsfälle abschließen; Audioqualität und kontrollierte Zeitmarkenkorrektur bestätigen; aktuelle 60 Vortests samt vorbereiteten Audios in QA übernehmen; vollständigen sichtbaren Retake/PASS- und Browsernachweis erbringen; abschließende Build-, Rechte-, Backup- und Migrationsprüfungen durchführen. Erst danach das vorbereitete Release auf dem VPS aktivieren. Das Wochenkontingent wurde zuletzt mit 77 Prozent Rest geprüft; es stehen keine Reset-Guthaben mehr zur Verfügung.

## M follow-up, 10 October 2026, 01:11 CEST

The extended actual PG15 migration114 fixture now passes **31 assertions**, including public old-practice resume, public completed-test review, and rejection of a source revision referenced by an inactive Special definition. All fixture changes rolled back; zero fixture rows or archives remain. All5222 raw metadata rows match exactly before/after (SHA256 `84f6802ea61ea08d3d14f967aa7eb44d05a10a0aeab6667296790a02f5dd6d6a`). Fresh isolated-runtime checks report three HTTP200 endpoints, no OOM,2440MiB available, and zero scoped active queries. The earlier185/188 content-stream comparisons were not repeated after this additional fixture.

S1's source-only CAS implementation was independently inspected and integrated. M's first real PG15 inspection found that PostgreSQL prohibits creating temporary tables inside a READ ONLY transaction. Inspection now creates only session-local scratch tables before the read-only transaction; the guarded query contains no original-table writes. The initial failure and corrected native results remain in the private coordination evidence. Eleven CPU/file/mock tests pass, including a successful preparation/archive path and source/identity/no-op failures.

Using one actual original-audio row from the isolated production clone, M prepared the sealed1299 allowlist source, archived its four exact source files, ran the generated read-only inspection, and ran the actual full-row CAS inside a transaction ending in ROLLBACK. The generated SQL inventoried211 tables, found zero matching consumers and zero pretest definitions for this clone, and left the complete audio object identical after rollback. This is one real-row native rehearsal, not a production repair or a Storage-readback/race proof. Those remaining gates stay open. No production or shared-QA data was written.
