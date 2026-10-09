# Sitov Academy – S1 Epoch 23: native Rechte-Baseline, Teilstand

Status: **SAVED_INCOMPLETE / NOT_RELEASE_READY**. 34 von 75 tatsächlichen Konten wurden vollständig im detaillierten nativen Messumfang erfasst; 41 Konten bleiben offen. Die konfigurierte SAVE-Grenze beendete die Verarbeitung, keine Fortsetzung über die Lease hinaus.

Die Quelle enthält 73 Schüler- und zwei Lehrkraftkonten, zehn aktive Niveaus, fünf tatsächliche Trainerklassen, 1280 reale Units und 960 reale Verben. Profilrolle und auth.uid/auth.role wurden pro gemessenem Konto mit dem tatsächlichen Snapshot abgeglichen. JWT-Kontext stammt aus auth.users.id/role/raw_app_meta_data; user_metadata, erfundene Konten, AAL- oder Sitzungsnachweise werden nicht verwendet.

## Tatsächlich erfasster Umfang

- 1700 Entscheidungen über Niveau/Trainer aus dem bestehenden Helper, davon 424 erlaubt. Diese **Owner-Referenzmessung ist separat**: authenticated hat kein USAGE auf trainer_access_private; direkte Aufrufbarkeit wird nicht behauptet und es wurden keine Grants ergänzt.
- 43520 tatsächliche authenticated-Aufrufe von learning_private.unit_allowed für sämtliche 1280 realen Unit-IDs je abgeschlossenem Konto, davon 10443 erlaubt. Zusätzlich wurden learning_private.allowed_unit_ids und direkt per RLS sichtbare Unit-IDs gespeichert, ohne Unterschiede zu vereinheitlichen.
- 32640 authenticated-Entscheidungen zu sämtlichen 960 realen Verben je abgeschlossenem Konto, davon 8457 erlaubt; außerdem bestehender Verb-Level-Helper über alle zehn aktiven Niveaus sowie NULL-/Leerstring-Kontrollen ohne erfundene Objekt-IDs.
- Storage wurde getrennt für jeweils ein tatsächlich vorhandenes Objekt aus vier Buckets abgefragt. 34 Konten ergaben einen echten Query-Fehler, 0 eine Antwort. Der erste Fehler lautet technisch permission denied for function preserve_media; privater Fehler-SHA-256 `8b51dc9fc8acded579c37ef67be8a2c0edc4162336736ae9ef0bd853951ee01e`. Keine Storage-Freigabe oder vollständige Objektabdeckung wird daraus abgeleitet. Kein Grant oder Datenbankcode wurde geändert.

Privater, pro Konto atomarer Receipt-/Cursor-Nachweis: `06c65adf6eb24b7a72006df0deee5389c79fbc33f2db0695f7919752e9688ca6`. Fortsetzung ab Index 34 in derselben deterministischen 75er-Quellreihenfolge; fertige Receipts vor Wiederverwendung einzeln per SHA prüfen. Rollen-/Schema-Privilegien für anon, authenticated und service_role sind separat dokumentiert; eine vollständige anonyme/service-role Funktions- und HTTP-Matrix wurde nicht ausgeführt.

## Datenstand und Grenzen

Frischer Laufzeit-/Speicherguard vor Beginn bestanden, Hostspeicher mindestens 1984 MiB. Die 188 QA-Tabellen wurden vor der Messung vollständig gestreamt und entsprachen exakt `f78808720aa242bfb6a17dde4b398497d1f0478465ba4eb9c9d376d25e1236b1`. Die vollständige 185-Tabellen-Baseline aus Epoch 22 bleibt der Vergleichsanker (`1e5a89759dfd01976af140916a4f53244378971512dac5de6b3f0ff3fb0dca67`). **Die abschließenden 185-/188-Tabellenhashes und Health-/OOM-Prüfungen nach dieser Messung wurden innerhalb der Zeiteinheit nicht mehr durchgeführt und bleiben offen.** Alle ausgeführten Messungen verwendeten READ ONLY; keine SQL-Migrationen oder Datenmutationen.

Das erste gebündelte Konto-Statement wurde durch den Storage-Berechtigungsfehler abgebrochen. Danach wurden ausschließlich die lesenden Core-/Storage-Abfragen getrennt; ursprünglicher Fehler und individuelle Storage-Fehler bleiben privat erhalten. Eine technische Katalog-Introspektion erforderte außerdem die Begrenzung von pg_get_functiondef auf Funktionen statt Aggregate; der erste lokale Fehlernachweis bleibt privat erhalten.

VIP-, Kauf- und Trial-Tabellen existieren im tatsächlichen Schema vor 93 nicht; entsprechende Pfade wurden nicht erfunden. Eine native SQL-Rollen-/Claims-Messung ersetzt weder echte Anmeldung, signierte JWT-/Sitzungs-/AAL-Prüfung noch Browser-, HTTP-, S3- oder vollständige Audio-/Inhaltsauslieferung. Inhalte außerhalb der Unit-/Verb-Zielmenge und der vier Storage-Ziele bleiben offen. Kein vollumfänglicher Rechte-PASS aller 75 Konten.

Private Artefakte und Cursor: `S1/epoch23-resume-ledger.json`, Remote `/tmp/sitov-night-20261008-qa-master/S1-epoch23-rehearsal/` mit accounts/; Dateien 0600, Verzeichnisse 0700. Keine Kontokennungen oder individuellen Antworten im Git. Nächste Freigabe: verbleibende 41 Konten, unveränderte 185-/188-Tabellenhashes und abschließende Health-Prüfung; erst danach gesonderte Migrationserlaubnis für 93–109. Keine App-Änderung, kein Push, kein Deployment und keine Produktionsschreibzugriffe.
