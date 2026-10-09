# Sitov Academy · S3 · additive Storage-Kompatibilität 97

Die tatsächliche Storage1.44.2-Zeilenform besitzt `id`, `bucket_id`, `name`, `owner`, `created_at`, `updated_at`, `last_accessed_at`, `metadata`, `path_tokens`, `version`, `owner_id` und `user_metadata`. Sie besitzt weder `archived_at` noch `is_delete_marker`. Die direkte Spaltenreferenz im vorbereiteten Audio-Helper löste einen echten SQL-Fehler aus; die drei darüberliegenden privaten Proof-Guards konnten dadurch ebenfalls keine Freigabe erteilen. Der neue native Test reproduziert diesen Fehler vor Migration97.

Die additive Migration liegt bytegleich in `supabase/migrations/20261009001000_sitov_storage_proof_compatibility.sql` und dem ausdrücklich zugewiesenen VPS-Pfad `supabase/vps/97_sitov_storage_proof_compatibility.sql`. Bestehende Migrationen92–96 und die eingefrorenen Baseline92-/Integrated96-Dateien werden nicht geändert.

Der private Prädikat-Helper `sitov_storage_private.sitov_object_is_current(jsonb)` erhält die konkrete vorhandene Storage-Zeile über `to_jsonb(o)`. Fehlende oder nullwertige optionale Flags sind zulässig. Jeder nichtnullwertige Archivierungswert und jeder Löschmarker außer dem JSON-Booleschen Wert false beziehungsweise null wird abgelehnt. Insbesondere akzeptiert er keine Zeichenfolge "false", Zahl0 oder malformed Nicht-Objekt-Eingabe. Dadurch funktionieren Vendor-Zeilen ohne Zusatzspalten; vorhandene echte Erweiterungen bleiben strikt wirksam.

Migration97 ersetzt ausschließlich die bisherigen Archivierungs-/Löschprädikate und ergänzt bei drei Queries den Tabellenalias. Betroffene Funktionen:

- `vocabulary_private.sitov_prepared_german_audio_url(text)`
- `sitov_pronunciation_private.reference_valid(text,text,pretest_approvals)`
- `sitov_pronunciation_private.public_audio_ready(uuid,text,jsonb)`
- `sitov_special_private.definition_ready(definitions)`

Die vorhandenen Funktionsdefinitionen werden über `pg_get_functiondef` übernommen. Erwartete alte Klauseln müssen vorhanden sein; bei einem unbekannten Vertrag bricht die Migration ab. Eine zweite Anwendung erkennt das bereits installierte neue Prädikat. Funktions-OIDs, Eigentümer, ACLs, SECURITY-DEFINER-Flags, Volatilität und search_path bleiben erhalten. Die neue private Funktion hat keine EXECUTE-Berechtigung für PUBLIC, anon, authenticated oder service_role. Es entsteht kein öffentlicher RPC und kein neuer DTO-Vertrag.

Alle übrigen Prüfungen bleiben erhalten: konkrete Bucket-/Objektidentität, private96-Referenz, normalisierter Text- und Audiohash, Profilfingerprint, Modellrevision/Stimme, MIME-/Größenprüfung, Wortzeitanzahl und Zeitgrenzen, unveränderlicher Fragen-Timinghash und Definition/Testversion sowie Special-Quellen-/Reviewer-/Snapshot-Proof. Bestehende FOR-SHARE-Sperren bleiben erhalten. Keine Berechtigung, Inhalts-ID, Antwort, Historie, Aufnahme oder Fortschritt wird umgeschrieben.

`node --test supabase/tests/sitov-storage-proof-compatibility.test.mjs`: **6 Tests PASS, keine übersprungenen Tests**. Das entspricht fünf Untertests plus dem übergeordneten nativen Test. Grundlage ist die bytegeprüfte eingefrorene Integrated96-Installation in einer eigenen wegwerfbaren Datenbank auf M's lokalem socket-only PostgreSQL17.11. Der Test ergänzt nur dort `path_tokens` für die exakte Vendor-Spaltenliste und prüft:

1. Reproduzierter fehlender Spaltenfehler, bytegleiche Migration, Replay und unveränderte OIDs/ACLs/Flags; weiterhin `storage://audio_cache/…`.
2. Positive echte SQL-Ausführung der vier Guards mit synthetischen gültigen Objektmetadaten, privatem Referenz-/Fragenproof und tatsächlich gespeichertem Special-Snapshot/Quelle/Reviewer-Beleg.
3. Ablehnung falscher Stimme, Text-/Audiohash, leerer Wortzeiten, fehlender Objekte, falscher Testversion und fremder Special-Objektidentität. Die bestehende Unveränderlichkeit eines Storage-Pfads wird ebenfalls geprüft.
4. Optional im isolierten Test ergänzte Archiv-/Löschspalten: beide Flags verweigern getrennt Referenz, öffentlichen Prompt, Fragment, Option und Special; Aufheben stellt den ursprünglichen positiven Zustand wieder her. Entfernen dieser Testspalten und erneutes97-Replay funktionieren ebenfalls.
5. Fehlende private Aufrufrechte für alle Anwendungsrollen, Ablehnung falsch typisierter Flags sowie unveränderte vorhandene Verlauf-/Checkpoint-Snapshots.

Diese native Prüfung enthält synthetische Audio-Metadaten, keine realen MP3-Bytes oder HTTP-Storage-Objektlieferung. QA-Container, produktive Datenbanken und gemeinsame Fixture-Datenbanken wurden nicht verändert. M installiert97 erst nach eigener Prüfung im isolierten QA-System und übernimmt später eine zentrale kanonische Schema-Abbildung; diese S3-Einheit editiert keine shared schema/types. Menschliche Freigabe wird nicht als neue Auftragshürde eingeführt.

## Separater dokumentierter Befund: vorhersehbare Antwortpositionen

In allen zwölf Kernen der neu geschriebenen Texte4–6 folgt `correctOptionId` für q1…q6 dem wiederholten Muster `sitov.option.1`, `.2`, `.3`, `.1`, `.2`, `.3`. Öffentliche Frage-IDs enthalten q1…q6; mit Kenntnis dieser Autorenkonvention kann der Schüler die Schlüssel ohne fachliche Leistung vorhersagen. Auch bisherige Pools benötigen eine eigene Prüfung auf solche Konventionen. Das ist ein echter Qualitäts-/Testintegritätsbefund und bleibt offen. In dieser ausdrücklich auf Storage begrenzten Einheit werden keine Fragen-, Options- oder Alias-IDs, Definitionen oder Review-/Audio-Proofs geändert. M muss eine neue Einheit zur unabhängigen Korrektur mit sauberer Versionierung, erneutem Review und entsprechendem Audio-/Proof-Abgleich freigeben. Kein RELEASE_READY-Anspruch.

S3 übergibt einen geprüften eigenen Commit vor dem Ende von Epoche12 und wechselt auf WAIT. Inhaltliche Abdeckung bleibt6/60 private Entwürfe,54 offen,0 veröffentlicht. Neue Arbeit erfordert einen frischen START.
