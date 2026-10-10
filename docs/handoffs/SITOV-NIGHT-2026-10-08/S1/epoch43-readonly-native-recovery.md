# Sitov Academy — Epoch 43: tatsächlicher Read-only-Recovery-Nachweis

Basis `a36aaf33888fb0d85ebe09b3e38751c4312af2bf`. Der bestehende Combined-CAS-Collector und Verifier wurden ohne Produktcodeänderung erstmals erfolgreich in echten getrennten PostgreSQL-READ-ONLY-Transaktionen geprüft. `python3 -m unittest discover -s deploy/vps/tests -p 'test_sitov_path_*_cas.py' -v`: weiterhin 19 PASS.

Vor dem ersten Fixture-Schreibzugriff wurden der geschützte Originalspaltenbestand aller 185 Klontabellen und sämtliche 188 Shared-QA-Tabellen vollständig einzeln gestreamt. Erst nach Abschluss beider Scans wurde der Fertigzeitpunkt festgehalten und unmittelbar danach Health, verfügbarer Speicher und null aktive Klon-Abfragen erneut geprüft. Es wurde keine alte Startzeit als frischer Nachweis verwendet und keine Schutzbedingung gelockert.

Die einzige persistente technische Fixture lag in der neu aus dem zugewiesenen Klon erzeugten eigenen Scratch-Datenbank `sitov_s1_epoch43_recovery_20261010`, Eigentümer `supabase_admin`, festgehaltene OID `51459`. Originalklon und Shared-QA erhielten keine Fixture-DML/DDL. In Scratch wurden SQL114/115 sowie ein eindeutig synthetischer Parent, ein Objective und eine Exercise vorbereitet und committet.

Der tatsächliche psql-CLI-Transport führte anschließend den unveränderten emittierten Collector mit `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY` aus. Rollen-/Deadline-/Read-only-Prüfung, native PostgreSQL-Hashes, tatsächliche vollständige Bilder und Metadaten lieferten `OLD_REVIEW_REQUIRED` ohne Archiv/Receipt.

Genau ein tatsächlicher Combined-CAS-Writer-COMMIT folgte. Danach wurde seine erfolgreiche Rückgabe absichtlich durch einen `ConnectionError` unterdrückt. Das ist ein simulierter Rückgabeverlust nach echter Transaktion; ein physischer Netzwerkabbruch wird nicht behauptet. Sämtliche folgenden Verbindungen waren echte READ ONLY-Transaktionen. Recovery ergab `NEW_VERIFIED` mit genau einem vollständigen Archiv und einem passenden Receipt, exakten aktuellen/archivierten Projektionen und nativen Hashes, Review-Evidenz, actor_role sowie Payload/Result/Request-Zuordnung. Der tatsächlich gespeicherte URL-Wechsel NULL→Prepared-URL für „übt“ entsprach exakt dem realen SQL71-/115-Adapter. Es erfolgte kein zweiter Writer-Aufruf.

Vier zusätzliche tatsächliche READ ONLY-SQL-Ausgaben über denselben begrenzten CLI-Transport enthielten gezielt ein veraltetes vollständiges Feld, einen falschen neu berechneten Hash, eine falsche Cache-URL beziehungsweise kein Archiv. Alle vier wurden mit `MIXED_OR_CHANGED_ABORT` abgelehnt. Dabei wurden ausschließlich SQL-Ergebnisbilder verändert; gespeicherte unveränderliche Archive und Receipts wurden niemals manipuliert oder deren Trigger umgangen. Eine abschließende unveränderte Collector-Abfrage bestätigte erneut `NEW_VERIFIED`, weiterhin ein Archiv/Receipt und null Wiederholungsupdates.

Nach Schließen aller Scratch-Verbindungen wurden Name, Eigentümer und OID erneut exakt mit der gespeicherten Identität verglichen und null aktive Scratch-Sessions bestätigt. Nur diese eigene Datenbank wurde entfernt. Danach waren die vollständigen Ausgangsbestände wieder exakt:

- Original185: `cfeb746a211c54255d8c4d519f92efe05637482f3f2ca34194f894ce32ef8814` (historisch akzeptierte SQL96-Ausnahme audio_cache public true→false).
- Shared-QA188: `f78808720aa242bfb6a17dde4b398497d1f0478465ba4eb9c9d376d25e1236b1`.

Drei Health-Prüfungen bestanden, kein aktueller OOM, zuletzt 2425 MiB verfügbar, null aktive Origin-/QA-Abfragen und null Jobs. Normale Verarbeitung endete 02:31:58 UTC vor SAVE. Keine Produktionsabfrage/-änderung, Container-Neustarts, Modelle, Audioerzeugung, Imports, Publikation, Push oder Deployment.

Die technischen Audiometadaten und Freigaben gelten ausschließlich für die erfundene Scratch-Fixture. Sie sind kein Hörqualitätsnachweis und kein redaktionelles Approval für reale 421 Aufgaben. Die zwei Epoch42-Abbrüche bleiben unverändert dokumentiert. Dieser erfolgreiche Einzelfall schließt das enge native Recovery-Gate; vollständige 421er-Freigaben, Batch-/Race-/Rechte-/Release-Gates bleiben bei M, `release_ready=false`.

Private Nachweise: `S1/epoch43-proof-private.json`, `S1/epoch43-remote-evidence-private` mit vollständigem Plan, tatsächlichem Collector/Writer-SQL, allen psql-Ausgaben, Archiv-/Receipt-Bildern und Baseline-Nachweisen, dazu `S1/epoch43-resume-ledger.json` und `S1/epoch43-evidence-manifest-private.json`. Exakte Schema-/114-/115-/Preparer-SHAs sind privat festgehalten. Keine tatsächlichen vollständigen Quellzeilen in Git.
