# Sitov Academy – S1 Epoch25: tatsächliche Migrationsprobe93–109

**Alle17 exakten Migrationen committet. Erhaltung mit ausdrücklich belegter Privacy-Änderung; QA-/Laufzeit-Gates bestanden. Rechtevergleich nach Migration noch0/75, NOT_RELEASE_READY.**

Basis `9d0737da268820a3f8136dfa386d1c09fa2c6213`. Alle17 kanonischen SQL-Dateien sind bytegleich zu ihren VPS-Aliasdateien; kanonische Zeit- und VPS-Nummernfolge93–109 identisch. Eingangsmanifest-SHA `17dfb8f81b5426b93050dad6332c2e95b1e7a5954340d8318a1329020913e429`; vollständige Einzel-SHA/Dateipfade privat und im unveränderten Quellbaum nachvollziehbar. Keine historischen SQL-Dateien geändert.

Ausführung ausschließlich in sitov_night_migration_rehearsal_20261009, jeweils BEGIN/COMMIT mit lokalem45s Statement- und5s Lock-Timeout, ON_ERROR_STOP und begrenztem Prozess. Tatsächlich für alle17 verwendeter Clientparameter -U supabase_admin; current_user/session_user separat als supabase_admin/superuser bestätigt. Keine SET-ROLE-Umschaltung, globalen Einstellungen oder Limits geändert. Dies entspricht dem von M benannten deploy/vps/migrate-local.py-Migrator. Jeder Commit und jedes private stdout/stderr besitzt einen Receipt. Kein Wiederholungsversuch.

## Datenvergleich und genaue Ausnahme

Die ursprünglichen75 Receipts wurden per SHA verifiziert. Vorher alle185 Tabellen vollständig gestreamt exakt zur Baseline `1e5a89759dfd01976af140916a4f53244378971512dac5de6b3f0ff3fb0dca67`; QA188 exakt `f78808720aa242bfb6a17dde4b398497d1f0478465ba4eb9c9d376d25e1236b1`. Frischer Guard bestanden,2454MiB Hostspeicher verfügbar.

Nachher wurden **alle185 ursprünglichen Tabellen mit genau ihren ursprünglichen Spalten** vollständig gestreamt. Neue Spalten werden damit separat von Veränderungen vorhandener Daten behandelt.184 Tabellen einschließlich Konten, Profile, Inhalte, Antworten, IDs, Fortschritt, Streaks, realen Aufnahmen und Bewertungen sind exakt unverändert. Die einzige abweichende Tabelle storage.buckets enthält weiterhin dieselben8 Zeilen.

Der erste strikte185er-Hashvergleich endete korrekt mit AssertionError und wurde nicht in einen unveränderten Rohbestand umgedeutet: Rohhash nachher `cfeb746a211c54255d8c4d519f92efe05637482f3f2ca34194f894ce32ef8814`. Der vollständige, typgerecht rekonstruierte Produktionsarchivvergleich der8 Bucket-Zeilen beweist **ausschließlich audio_cache.public true→false**, keine weitere Feld- oder Zeitstempeländerung. Genau diese Sicherheitsänderung schreibt kanonische Migration96 in Zeile9 ausdrücklich vor. Alter Bucket-Zeilenhash `3a03fe5b9bbecacbeebd644a283e115f`; nachher `53621c3d4684f0fa994707a85df6721f`. Feld-Deltanachweis `9b893dd6c7e2b0923e92018d9ca55b3f14af454bc0f23931d5fc1a40c560a8be`. Keine unerwartete Änderung bestehender Zeilen beobachtet; keine Rücknahme oder zusätzliche Korrektur ausgeführt.

Aktueller Bestand211 Nicht-Systemtabellen,75 Konten,75 Profile; Payment enabled=false. Die26 neuen Tabellen und zusätzliche Schema-/Historienfelder stammen aus den freigegebenen Migrationen. Eine vollständige211er-Zeilenbaseline wurde hier nicht erstellt. Die184+eine präzise Ausnahme ist keine Behauptung, alle185 Rohhashes seien identisch.

QA188 vor/nach mit identischen Namen, Zeilenzahlen und vollständigen Hashes `f78808720aa242bfb6a17dde4b398497d1f0478465ba4eb9c9d376d25e1236b1`. Nach den17 Migrationen und Erhaltungschecks drei HTTP200, alle Laufzeitguards bestanden, aktuelle OOM-Markierung false. Images/Limits/Netzwerk unverändert; historischer OOM bleibt dokumentiert.

## Rechte und Storage bleiben offen

Keine Nachher-Rechteentscheidung gestartet:0/75. Der vorab gespeicherte75er-Claims-/Rollen-/Target-Snapshot und sämtliche Originalreceipts bleiben unverändert. Native Claims sind keine echte Anmeldung, signierter JWT-/Sitzungs-/AAL-/HTTP-Beweis. Ein vorbereitetes privates Nachher-Skript benötigt eine neue Freigabe und muss die belegte96-Privacy-Ausnahme berücksichtigen; keine Migration erneut anwenden.

M hat die bestehende Storage-Definerlücke unabhängig lesend auf Produktion bestätigt: Rollenbeweis SHA `09cfc2a53746935e13e0d4ab13418b528801cb2b50876117e82291493f884a3f`. postgres ist dort ebenfalls NOSUPERUSER/INHERIT/BYPASSRLS, mit Schema-USAGE und ohne EXECUTE auf preserve_media. Tatsächliche Nachher-Owner: can_remove_audio=postgres; preserve_media, get_learning_new_items und trainer_access_private.allowed=supabase_admin. Die Lücke wurde weder durch Grants noch durch Bypass oder Funktionsänderung repariert. Storage-Fehler sind kein PASS.110 wurde nicht ausgeführt oder erstellt.

Private Fortsetzung S1/epoch25-resume-ledger.json, Input-/Execution-Receipts und vollständige Erhaltungsnachweise unter /tmp/sitov-night-20261008-qa-master/S1-epoch25-rehearsal/. Dateien0600, Verzeichnisse0700. Öffentlich nur Aggregate/Hashes, keine Konto-/Antwortdaten. Ausschließlich eigene Prüfkopie mutiert; QApostgres und Produktion unberührt. Keine App-Arbeit, Veröffentlichung, TTS, Push oder Deployment. Dokumentationscommit, atomarer WAIT, keine laufenden Jobs; letzte zwei Minuten ausschließlich SAVE.
