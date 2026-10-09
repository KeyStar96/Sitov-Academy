# Sitov Academy – S1 Epoch24: native Rechte-Baseline vor93

**75/75 native Core-Messung vollständig; 185-/188-Tabellenhashes und Laufzeit-Gates PASS. Storage-Fehler und weitere Release-Gates offen; NOT_RELEASE_READY.**

Alle34 vorhandenen Receipts wurden per SHA und gegen dieselbe tatsächliche, deterministisch sortierte75er Kontoquelle geprüft; ausschließlich die übrigen41 Konten ab Index34 neu gemessen. Quelle:73 Schüler und2 Lehrkräfte. Keine erneute Messung der ersten34.

- 3750 Niveau-/Trainer-Referenzentscheidungen über10 aktive Niveaus und5 echte Trainerklassen, davon763 erlaubt. Dies sind getrennte Owner-Referenzen: authenticated hat kein USAGE auf trainer_access_private; kein direkter Schüler-RPC-PASS behauptet.
- 96000 tatsächliche authenticated-Unit-Entscheidungen über alle1280 realen Units je Konto, davon19134 erlaubt; zusätzlich allowed_unit_ids und direkt RLS-sichtbare Unit-IDs separat gespeichert.
- 72000 authenticated-Verb-Entscheidungen über alle960 realen Verben je Konto, davon15557 erlaubt; vorhandener Verb-Level-Helper über10 aktive Niveaus. NULL-Unit bei allen75 false; NULL-/Leerstring-Kontrollen als Eingaben, keine erfundenen Objekte.
- Tatsächliche Quelle:148 Niveau-Freigabezeilen,16 Trainerfreigaben, davon2 Auswahlfreigaben mit4 Unit-Zuordnungen und5 deaktivierte Freigaben. Null reale leere Auswahllisten und NULL-Modi; diese fehlenden Fälle nicht erfunden.
- Private75er Receipt-Manifest-SHA `ae3e7ea4eb907bd6d76c1bcf7a8b47f15825007828db8b90246695b6ada9ab01`; zusammengeführte JSONL-Matrix `46d9308d5b537921d5c9036df5fb374755e57558e0320872b612fe840734be08`. Alte34 Receipts bleiben unverändert im Epoch23-Verzeichnis, neue41 im Epoch24-Verzeichnis. Vollständige Matrix privat gespeichert.
- Alle185 Nicht-Systemtabellen nach der Messung exakt zur Epoch22-Baseline `1e5a89759dfd01976af140916a4f53244378971512dac5de6b3f0ff3fb0dca67`. Alle188 QA-Tabellen vor/nach exakt `f78808720aa242bfb6a17dde4b398497d1f0478465ba4eb9c9d376d25e1236b1`; Namen, Zeilenzahlen und sämtliche Zeilenhashes identisch.
- Abschluss um21:13:38 Europe/Berlin: drei HTTP200, alle Laufzeitguards bestanden, aktuelle OOM-Markierung false, Images/Limits/Isolation unverändert. Zu Beginn2207MiB verfügbar. Historischer OOM-Nachweis bleibt erhalten. Nach der anschließenden reinen Katalogdiagnose wurde keine neue Health-Prüfung mehr durchgeführt.

## Storage-Befund ohne Korrektur

Alle75 separaten Storage-Abfragen auf jeweils ein reales Objekt aus vier Buckets endeten mit Query-Fehler; keine erfolgreiche Objektentscheidung und kein Storage-PASS. Source-SELECT-Policies rufen learning_reset_private.can_remove_audio auf, SQL-SECURITY-DEFINER mit Owner postgres. Dieser ruft sitov_simulation_private.preserve_media(uuid,text) auf, SECURITY-DEFINER mit Owner supabase_admin. In der isolierten Kopie hat postgres Schema-USAGE, aber kein EXECUTE auf preserve_media; die beobachtete Fehlermeldung und ihr Funktionskontext passen zu dieser Kette. Direkte authenticated-/anon-/service-role-Ausführung auf den versiegelten Helper ebenfalls nicht gewährt und nicht ergänzt.

Das tatsächliche Produktionsarchiv enthält preserve_media-Funktion und ACL, Owner supabase_admin, PUBLIC-REVOKE und keinen authenticated-GRANT. Archivblock-SHA `ea0789cdcd74974dd874b64b806d69260b0e2524e08239370bdef78e340bba77`; Katalogdiagnose `4f00117fed03c56543c8604b1ba5093507ec1184e649b33f596f16297b94dec3`. Der Helper schützt Simulation-/Prüfungsaufnahmen mit Ticket-, Run- oder Reset-Zuordnung. Kein Reset-/Upload-Aufruf ausgeführt; keine Zuordnung geändert.

Isoliertes postgres: NOSUPERUSER, INHERIT, BYPASSRLS; tatsächliche Mitgliedschaften und effektive Privilegien privat gespeichert. M wurde um gezielten Vergleich der globalen Produktionsrollen gebeten. Live-Produktionsrollen, Mitgliedschaften und HTTP-Bedingungen sind durch S1 nicht geprüft; daher weder Produktionsdefekt noch vollständige Rollenmodellgleichheit behauptet. Keine Grants, Rollen-, Policy- oder Funktionsänderung.

## Grenzen und Übergabe

READ ONLY, SET LOCAL ROLE authenticated; Claims nur aus tatsächlichem auth.users.id/role/raw_app_meta_data, auth.uid/auth.role/Profilrolle je Konto abgeglichen. Kein user_metadata, keine erfundene AAL-/Sitzungsbestätigung. Native Messung ersetzt keine echte Anmeldung, signierten JWT-/Session-/AAL-/HTTP-/Browsernachweis oder vollständige Storage-/Inhaltsauslieferung. Anon-/service-role-Metadaten sind keine vollständige Funktionsmatrix. VIP-/Kauf-/Trial-Tabellen existieren vor93 nicht und wurden nicht erfunden. ABI-Adapter pg_graphql1.5.11/1.6.2 bleibt dokumentiert, keine vollständige Vendor-Semantikgleichheit.

Keine Migrationen93–109, App-/Produktionsänderung, Timeout-/Limit-/work_mem-Erhöhung, TTS, Push oder Deployment. Payment aus. Private Fortsetzung S1/epoch24-resume-ledger.json und /tmp/sitov-night-20261008-qa-master/S1-epoch24-rehearsal/; Dateien0600, Verzeichnisse0700. Letzte zwei Minuten ausschließlich Sicherung vorhandener Artefakte, Dokumentationscommit und atomarer WAIT; keine laufenden Jobs.
