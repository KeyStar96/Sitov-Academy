# Sitov Academy – S1 Epoch26: enge Definer-ACL-Korrektur110

**110 eng begrenzt umgesetzt und zweimal auf der isolierten Kopie geprüft; ACL-/Idempotenz-/Erhaltungs-Gates bestanden. Native Storage-RLS-Prüfung weiterhin fehlgeschlagen bei staff; NOT_RELEASE_READY.**

Basis142525065cde55a4cd2e89672ba4833fde5949bb. Neue kanonische Migration20261009200000_sitov_storage_definer_execution.sql und tatsächlicher VPS-Alias110_sitov_storage_definer_execution.sql bytegleich, SHA `632539f155e3118a70f485dac3b515c98967af124fd9b273f6bdfa790a5e5296`. Der zunächst falsch genannte deploy/vps/sql-Pfad wurde von M im atomaren Allowlist-Eintrag auf supabase/vps korrigiert. Runner ORDER registriert110 nach109; keine93–109-Datei geändert oder erneut angewendet.

Die einzige dauerhafte Datenbankänderung dieser Einheit ist EXECUTE auf sitov_simulation_private.preserve_media(uuid,text) für postgres, den vorhandenen SECURITY-DEFINER-Owner von can_remove_audio. Kein PUBLIC-/anon-/authenticated-/service_role-GRANT, kein Grant-Option-Recht, keine Änderung an Definition, Owner, Suchpfad, Schema-USAGE, Caller-Definition oder RLS-Policy. Ein nachgeschalteter DO-Check lässt die Migration fehlschlagen, wenn EXECUTE für postgres nicht effektiv vorhanden ist.

## Tatsächliche Prüfungen

- Reale Ausführung als supabase_admin, ausschließlich sitov_night_migration_rehearsal_20261009. Vorher postgres EXECUTE=false, die drei API-Rollen ebenfalls false und PUBLIC ohne EXECUTE; Schema-USAGE für den Definer vorhanden.
- Nach erstem Apply postgres EXECUTE=true, API-Rollen/PUBLIC weiterhin false. Vollständige Funktions-/Caller-Definition, Owner, Konfiguration, Schema-USAGE und sämtliche Policies exakt unverändert. Zweites Apply mit identischen Metadaten: idempotent. Kein zusätzlicher Fix oder Grant.
- Python-Prozessvertrag:15 Tests PASS. Neuer Test prüft echten supabase_admin-Migrator, genau eine Transaktion, explizite110-Auswahl, keine SET-ROLE-Umschaltung, Spiegelparität, Runner-Reihenfolge und gestoppte Produktionsdienste nach simuliertem Commit. Diese Prozessprüfung führt keine Produktion aus.
- Neuer nativer SQL-Smoke verwendet ausschließlich ein tatsächliches Schülerkonto und tatsächliche Storage-Ziele, READ ONLY/ROLLBACK, ohne synthetische Konten oder Objekte. Er prüft ACL-Grenzen und Storage-RLS; vorgesehene direkte API-Deny- und Privacy-Assertions bleiben im Test erhalten.

## Sichtbar fehlgeschlagener nativer Test

Nach erfolgreicher110-ACL-Korrektur erreicht die echte Storage-Abfrage einen weiteren Fehler: permission denied for function staff, mit SQL-Kontext can_access_submission und audio_readable. Privater Originalfehler-SHA `9a4412a8bc138b5f16896dddd34d733412379049b1df900e819ed4754b055f2c`. Die vorherige preserve_media-Berechtigungslücke ist in dieser Kopie geschlossen; ein vollständiger Storage-Erfolg folgt daraus nicht.

Der Test wurde nicht abgeschwächt oder übersprungen. Er brach vor Abschluss aller nachfolgenden direkten API- und Protected-Media-Semantikprüfungen ab; diese werden nicht als bestanden ausgewiesen. ACL-Metadaten der API-Rollen sind separat verifiziert. Kein synthetischer Protected-Media-Fall eingeführt und kein mutierender Reset/Upload-Aufruf ausgeführt. Die weitere staff-Abhängigkeit benötigt gesonderte genaue Owner-/ACL-Prüfung und Freigabe; kein entsprechender Grant in110.

## Datenerhaltung und Übergabe

M akzeptierte aus Epoch25 ausdrücklich nur die in96 vorgeschriebene Änderung audio_cache.public true→false, Nachweis9b893dd6c7e2b0923e92018d9ca55b3f14af454bc0f23931d5fc1a40c560a8be. Der ursprüngliche strikte185er-Hashfehler bleibt erhalten. Nach beiden110-Anwendungen und dem fehlgeschlagenen nativen Test sind alle185 ursprünglichen Tabellen mit ursprünglichem Spaltensatz exakt zum qualifizierten Nach93–109-Zustand: `cfeb746a211c54255d8c4d519f92efe05637482f3f2ca34194f894ce32ef8814`. Keine neue Zeilenänderung oder zusätzliche Ausnahme.

QA188 vor/nach mit sämtlichen Namen, Zeilenzahlen und vollständigen Zeilenhashes identisch: `f78808720aa242bfb6a17dde4b398497d1f0478465ba4eb9c9d376d25e1236b1`. Abschließend drei HTTP200, alle Laufzeitguards bestanden, aktuelle OOM-Markierung false. Images/Limits/Netzwerk unverändert, frischer Hostspeicher2475MiB. Historische OOM- und Fehlernachweise unverändert.

Nachher-Rechtematrix weiter0/75; ursprüngliche75 Receipts/Claims/Targets unverändert und wiederverwendbar. Keine echten signierten JWT-/Sitzungs-/AAL-/HTTP-/Browsernachweise behauptet. Keine Veröffentlichung, TTS, Produktion, QApostgres-Schreibzugriffe, Push oder Deployment; Payment bleibt unverändert aus. Private Fortsetzung S1/epoch26-resume-ledger.json und /tmp/sitov-night-20261008-qa-master/S1-epoch26-rehearsal/; Dateien0600, Verzeichnisse0700. Keine laufenden Jobs; letzte zwei Minuten ausschließlich SAVE. Nächste Schritte: genaue neue Definer-Abhängigkeit prüfen, vollständigen nativen Smoke bestehen lassen, danach75er-Nachhermatrix und verbleibende Release-Gates.
