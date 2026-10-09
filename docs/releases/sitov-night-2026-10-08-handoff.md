# Sitov Academy – vorläufige Nachtlauf-Übergabe 2026-10-08

Gesicherter Zwischenstand, weiterhin unvollständig. Stand 09.10.2026, 01:49 Uhr Europe/Berlin: OPEN, NOT_RELEASE_READY, COMMIT_AND_HANDOFF. Deployment ausstehend; kein Push oder Produktivrollout, kein garantierter morgendlicher Abschluss.

Basis: 966a380f7a6118654f19750a9d62200795feb8c2. Geprüfte Feature-Integration: f124520 (Special-Lernendenmodi); reale HTTP-Probe: d243ddb. Die Schema96-Fixture bleibt auf 67bc5dfb711df423423d252c1b119c368616c57a eingefroren. Der aktuelle Dokumentations-/Mirrorcommit folgt darauf; definitive Release-SHA und S5-Abnahme stehen aus.

## Änderungen und Verträge

93 enthält additive kommerzielle Quellen, genaue Item-Autorisierung und ausgeschaltetes Payment mit fehlendem Provider. Vorhandene all/none/selected-Rechte bleiben erhalten; VIP ist ein zusätzlicher Schüleranspruch, kein pauschales Bestandsbackfill. Testzugang erteilt nur seine ausgewählten Items, keine Geschwisterrechte.

94 enthält individuelle aktuelle textbezogene Vortests, serverseitige Bewertung, CAS/Receipts, zweck-/textgebundene Uploadtickets und historische Ergebnisse. Nur der bestandene aktuelle Texttest ist die fachliche Aussprachevoraussetzung; kommerzielle Rechte separat prüfen. Empfehlungen, Fortschritt und alte hard-/Readiness-Werte ersetzen ihn nicht. Private unabhängige Quellen-/Review-/Lesereferenznachweise schützen Aktivierung; jede öffentliche deutsche Frage, jedes Fragment und jede Antwortoption benötigen zusätzlich einen unveränderlichen versionsgebundenen Audio-/Wortzeitenproof.

95 enthält den privaten optionalen Special-Kern: gespeicherte Lernwarteschlange, zehn Testfragen, 8/10 zum Bestehen, getrennte Wiederholungsformen, Versions-/Quellen-/Review-/Audioproof. 96 stellt gemeinsame vorbereitete Audios privat bereit; bestehende gültige Objektproofs bleiben bei exakter Referenzidentität verwendbar. Kein realer neuer Content aktiviert.

S4 bietet die fünfsprachige Vorteststrecke/Hilfe, ein lesendes Lehrkraftfenster in bestehenden Schüler-/Inhaltsansichten und exakte Vokabelkarten-/Verbziele ohne Fortschrittsmutation beim Öffnen. Alte Readiness-/hard-Steuerung dort entfernt, Gespräche/Historie erhalten. S2-Empfehlungen verwenden die geprüften exakten Vokabel-/Verb-/Pfad-/Textziele, mit realer Rechte-/Fortschrittsauflösung und expliziter Auswahl. Special-Lernen/Test/Wiederaufnahme/Auswertung sind an private95-Aktionen gebunden; unveröffentlichte Quellen bleiben authoring_not_ready. Sieben Mappingbeispiele sind keine Vollabdeckung. Sechs private Textpools mit 144 Fragen vorhanden, 54 fehlen. Reim/Zungenbrecher zurückgestellt.

Aktuelle Integrationscommits:

- Vokabelzugang: 74138b86eaee51e7298c59232f1e8802d30c4fe7.
- Staff: fb1dca6bc1c3402cf11f591d3f931029866f21b1; Ziele: 9bb8e9a20e319a9e4660b3bc38ca7b6b5a3de67c.
- Vortestproof: bf61bb3d801a73ff6f2ea339eea7e141d6711087; Referenzbegrenzung: 67dab4db9a530a572e7004d6218e62608741214f; 96-Kompatibilität: 09dc6b38bf8e632f8d88835174f55487009da9ad.
- Specialproof: 474690ef2e0fda4ebc6fbd5853970ffc60cdbead; Reparatur: f0a6c5005ab4d45611711f527fdb8b1bef7ce5b2.

## Migration und Rückweg – keine Ausführungsfreigabe

schema.sql enthält die geprüften 93–98-Overlays; die bisherige immutable96-Fixture bleibt unangetastet und wird durch ein separates späteres98-Ziel ergänzt. Die historische standardization/learning.sql dokumentiert die Reihenfolge, ist aber kein vollständiger aktueller Installer. Die separate Fixture supabase/tests/fixtures/sitov-night-integrated96/plan.json pinnt Baseline92 und alle vier Overlays bytegenau; Baseline92 bleibt unverändert. Der kombinierte native Install/Replayschutz besteht. Reale PostgreSQL15-Serviceinstallation mit echtem Auth/Storage wurde ausgeführt; das nächste Inhaltsfixture wurde wegen einer realen Storage-Spaltenabweichung zurückgerollt. Additive97-Kompatibilitätskorrektur und gesamte Browserabnahme bleiben ausstehend. Reviewed Artefakte in Reihenfolge 93, 94, 95, 96 verwenden:

- 20261008213000_sitov_commercial_access.sql ↔ VPS 93_sitov_commercial_access.sql.
- 20261008213100_sitov_pronunciation_pretests.sql ↔ VPS 94_sitov_pronunciation_pretests.sql.
- 20261008213200_sitov_learning_specials.sql ↔ VPS 95_sitov_learning_specials.sql.
- 20261008213300_sitov_private_audio_delivery.sql ↔ VPS 96_sitov_private_audio_delivery.sql.

Dateien liegen in supabase/migrations/ und supabase/vps/. Der tatsächliche migrate-local.py-Installer verwendet supabase/vps; M hat die zunächst falsch zugewiesenen Alias97/98-Pfade bei Integration dorthin korrigiert. Produktive Anwendung ausschließlich durch M nach Releasepolitik/Freigabegates. Backup und finaler isolierter Rechte-/Historiendiff erforderlich. Unmittelbar vor/nach späterer Produktionsmigration sämtliche Bestandskonten vergleichen; persönliche Daten außerhalb Git/Logs/Vault. Die Privatstellung des Audiobuckets verlangt bestätigte Wiedergabe aller betroffenen Trainer.

Rückwege erhalten Daten: 93 bewahrt alte Funktionsdefinitionen; 94/95 deaktivieren neue APIs unter Erhalt von Versuchen/Quellen/Reviews/Historie. 94-Rollback friert neue Aussprachewrites ein, statt alte unbeabsichtigte Rechte zurückzubringen. Den sicheren App-/DB-/Storage-Rückweg für 96 muss M/S5 final prüfen; keine pauschale öffentliche Bucketfreigabe. UI-/Metadatencommits gewöhnlich revertierbar. Keine Löschung realer Aufnahmen.

## Tatsächliche QA und Grenzen

S6 führte keinen Produkttest aus. M-/Worker-Protokolle:

- node --test supabase/tests/sitov-pronunciation-pretests.test.mjs supabase/tests/sitov-private-audio-delivery.test.mjs scripts/sitov-pronunciation-pretests-authoring.test.mjs: M 37 bestanden (12 Pretest, ein private96, 24 Autorenprüfungen), ohne Skips; native SQL/RLS/Metadaten, keine HTTP-/Content-Abnahme.
- node --test supabase/tests/sitov-learning-specials.test.mjs: S2 ein vollständiges natives Szenario auf gepinntem 92+93+95+96 bestanden; Rechte/Historie/MFA/Proof-Identität/Queue/7-fail/8-pass, synthetische Audiodaten.
- node --test scripts/sitov-pronunciation-pretests-authoring.test.mjs: 24 Offline-Tests bestanden nach e74ab16/b5a1548.
- node scripts/sitov-pronunciation-pretests-authoring.mjs: sechs von 60 private Entwürfe, 54 fehlen, null produktiv veröffentlicht. Die jüngsten 72 Fragen wurden unabhängig am tatsächlichen deutschen Quelltext geprüft; vorhersehbare zyklische öffentliche Antwort-IDs sind ein noch zu behebender Qualitätsfehler.
- M-Welle 5: Jest 91 Tests/acht Suites sowie native 21 und separate Baseline acht bestanden ohne Skips. Frühere Stages; Logs /tmp/sitov-night-m-wave5-jest.json, /tmp/sitov-night-m-native-wave5.log, /tmp/sitov-night-m-pinned92-wave5.log.
- M-Ziel-/Staffbatch: Jest 27 Tests/vier Suites und npx tsc --noEmit --incremental false bestanden nach 9bb. Log /tmp/sitov-night-m-target-wave6.json; Befehl: npx jest __tests__/sitov-learning-target-server.test.ts __tests__/sitov-learning-target-ui.test.tsx __tests__/sitov-learning-specials-staff.test.ts __tests__/sitov-learning-specials-contract.test.ts --runInBand --silent. Transportmocks/Unitbeweise.
- node --test supabase/tests/sitov-night-integrated96.test.mjs: zwei bestanden; alle Overlays/Hashes und Replay geprüft. Rechtegleichheit sämtlicher synthetischer Bestandsprofile, mit genau der genehmigten Entfernung der alten Deutsch-Sprachsperre; Historie gleich. Audio privat, kein VIP/Trial/Kauf-Backfill.
- npm run build fehlgeschlagen: Turbopack/node_modules-Symlink außerhalb der Worktreewurzel.
- npm run build -- --webpack bestanden: 303 Seiten und TypeScript, bestehende SoftErrorBadge-JSON-Importwarnung. Vor jüngsten Guard-/Zieländerungen; kein aktueller finaler Build. Log /tmp/sitov-night-m-webpack-wave5.log.

MFA-Fixture korrigiert: bestehende Passwort-Lehrkräfte AAL1 erlaubt, geschützter Admin AAL1 abgewiesen und verifiziertes TOTP/AAL2 erlaubt. Keine Änderung der Produktregel.

## Audio und Veröffentlichung

M prüfte 60 bestehende Qwen-Lesereferenzen mit Metadaten/Alignment und echten Storagebytes per SHA/Größe: 60 bestanden, ausschließlich lesend. Fingerprint 96db5949cf9ba060eb5fbeeec3b472d232d55e0b22dc2512cf65dc53c8c47df5. Keine neue Aufnahme/Import/Publikation und kein Lernenden-HTTP-Nachweis. Bekannte 235 Grammatik-/Satzbau-Audiolücken bleiben.

Manifest: 288 Frage-/Options-IDs, 253 Rohtexte. 212 neue Assets wurden serialisiert lokal mit Qwen3-TTS-12Hz-1.7B-Base/sitov-qwen-male-de-v1 fertig erzeugt, null Fehler. Bundle mit 212 MP3s, 2.679.472 Bytes und vollständigen lexikalischen Wortzeitmarken geprüft. Alle 41 wiederverwendeten Objekte wurden per realen Storagebytes auf SHA/Größe geprüft: 41 PASS. Audio liegt außerhalb Git im privaten Autorenverzeichnis; kein Produktionsimport oder Veröffentlichung. 94 erzwingt jetzt für alle öffentlichen Testtexte exakte vorbereitete Objekt-/Wortzeitenproofs. Trusted Proof-/Reviewimport bleibt ausstehend. Unabhängige fachliche Quellenprüfung ist belegt; menschliche Kalibrierung wurde nicht durchgeführt und wird nicht behauptet. Der Nutzerauftrag verlangt fachliche Qualität, keine zusätzliche obligatorische menschliche Freigabe. Produktive Definitionen bleiben inaktiv.

## Ausstehende finale Gates

Sichere vollständige Text-/Audio-/Record-/Submit-/Review-/Historienstrecken und direkte Objekt-/Upload-Storagepolicy-HTTP-Prüfung; bestehende Trainerregression; Browser 320/390/1440, Themes/Kontrast/200 Prozent Schrift, fünf Sprachen, Tastatur/Screenreader/Reduced Motion; 54 Textpools und qualifizierte Prüfung; Trusted Taskaudio-/Review-Proofimport; Special-Quellen/Pools/Autoren-/Lernenden-UI; Zugangs-/Billingverwaltung; gebundene Empfehlungen; reale PostgreSQL15-Abnahme der eingefrorenen Gesamtfixture; neuer Build und S5-Abnahme. Keine gesamte Produktionsreife aus Unit-/SQL-/Buildbefunden ableiten.

Final ergänzen: definitive Integrations-SHA, genaue Batchbefehle/Ergebnisse, reale Browserartefakte, geprüfter Audioimport/Publikationsstand, Bestandslücken und Releaseentscheidung. Bei COMMIT_AND_HANDOFF Deployment ausdrücklich ausstehend. Vault 43 aktualisiert; Dashboard, Features, Notiz 19 und Readinessnotizen bis Folgefreigabe unverändert.

## Fortsetzung und spätere Deployment-Übergabe

Wochenkontingent um 01:19 Uhr: 54 % verbraucht, 46 % verbleibend; gemeinsam, keine Kostenzuordnung pro Session. Mastergruppe OPEN, eigene bestätigte Wiedervorlage aktiv. Vor jeder neuen Lease/Prüfwelle frisch prüfen; ab 30 % Contentfreeze, 25 % Featurefreeze, 18 % SAVE_ONLY, 15 % STOP.

Die isolierte tatsächliche Auth/JWT/PostgREST/Storage-Probe ist angelegt und hat die erste reale HTTP-Prüfung bestanden. Next-/Browser-/Trainerregression, unabhängige fachliche Qualitätsprüfung, vollständige 60-Text-/Special-Zuordnung sowie gezielte Upload-/Submit-Probe abschließen. Keine produktiven Netzwerke, Container, Konten oder Daten ändern. Zuerst additive Storage-Kompatibilitätskorrektur97 prüfen: der tatsächliche Storage1.44-Service besitzt weder archived_at noch is_delete_marker, während die synthetische Fixture beide hatte. Das erste QA-only Definitions-/Proof-Importfixture wurde vollständig zurückgerollt; reale Audiodateien sind in QA geprüft importiert. QA-Definitionen erst nach der Korrektur für Protokolltests aktivieren; dies ist keine produktive Veröffentlichung.

Bei später ausdrücklich erteilter AUTO_DEPLOY-Freigabe ausschließlich deploy/vps/deploy-release.sh beziehungsweise den verifizierten installierten /opt/sitov-ops/sitov-deploy-release.sh verwenden: Backup und isolierte Migrationsprobe, --prepare-only, geprüfte93–96 und kompatiblen authentifizierten Adapter zusammen planen, lokale Audio-/Wortzeitenbundle importieren, trusted definitions-/Audio-/Reviewproofs versionsgenau importieren, erst danach geprüfte Inhalte aktivieren. Exakt die vorbereitete Revision mit --activate REVISION und nötigenfalls --schema-changed aktivieren. Health/Readiness/authentifizierte Smokes und Payment-off bestätigen. Keine Ausführung unter dieser COMMIT_AND_HANDOFF-Übergabe, kein App-only-Rollback bei inkompatibler DB, keine pauschale öffentliche Freigabe von audio_cache.

## Nachweisergänzung 09.10., 01:49 Europe/Berlin

Fünf echte isolierte Supabase-Dienste mit gecachten Images laufen ausschließlich im privaten internen QA-Netz: PostgreSQL15.19, GoTrue, PostgREST, Storage1.44.2, Kong. Aggregate Limits 960 MiB/2 CPU, keine veröffentlichten Hostports, keine Produktionsdaten oder -schlüssel. Zugriff vom Mac später ausschließlich per SSH-Loopback auf die geprüfte private Gateway-IP. Terminalcleanup entfernt nur exakte Namen mit geprüften QA-Labels, kein prune.

S5 b36a45a → d243ddb: 14 echte HTTP-Assertions bestanden: zwei neue .invalid-Konten, Passwort-Login und signierte Schüler-JWTs, eigenes/fremdes REST-RLS-Profil, eigene/fremde kommerzielle RPCs, verweigerte VIP-Selbstvergabe ohne Rechteänderung, verweigerter Anon-RPC und unsichtbare private Bucketliste. Beide Testkonten anschließend gezielt gelöscht. Noch keine vollständige Textpass-/Objekt-/Upload-/Submission-Abnahme. Guardtests: node --test e2e/sitov-night-real-transport/plan.test.mjs vier PASS; python3 e2e/sitov-night-real-transport/runtime.test.py vier PASS.

Erste drei Texte: 256 benötigte MP3-Objekte (253 Fragen/Optionen + drei Lesereferenzen), 3.170.240 Bytes, im QA-Storage importiert und sämtlich per tatsächlichem HTTP zurückgelesen sowie auf SHA und Metadaten geprüft. Kein Produktionsimport. Nächste drei Texte: 204 neue deutsche Aufnahmen werden lokal mit dem unveränderten männlichen Qwen-Profil und Generationlock serialisiert vorbereitet; neun wiederverwendete Dateien aus Batch1 sind auf echte Bytes/Profil/Wortzeiten geprüft. Synthese noch laufend; kein vollständiger Audio-/Importproof für Batch2.

S2 27aa9ac → f124520: fünf passende Jest-Suites mit 80 Tests im Integrationsworktree bestanden; tatsächlicher DB-Transport in diesen UI-Tests gemockt. M hat den echten S5-Protokollnachweis getrennt geprüft. M: npx tsc --noEmit --incremental false und ESLint auf den acht geänderten TS-/TSX-Dateien bestanden (Logs /tmp/sitov-night-m-tsc-wave9.log und /tmp/sitov-night-m-lint-wave9.log). Reale veröffentlichte Special-Pools/Audios/Autorenfenster und abgeschlossene Verlaufsliste bleiben offen. Wochenkontingent um 01:46: 56 Prozent verbraucht, 44 Prozent verbleibend.

## Nachweisergänzung 09.10., 02:02 Europe/Berlin

M: Additive97 sechs native Tests bestanden; tatsächliche PostgreSQL15/Storage1.44-QA-Installation bestanden. Erstes QA-Protokollfixture enthält drei aktive Definitionen und 279 unveränderliche Audio-/Wortzeitenproofs, ausschließlich synthetische Protokollprüfungen. Die 256 MP3s sind real importiert/rückgelesen. S5 prüft darauf aktuell die vollständige Strecke; erster Lauf erreicht einen echten individuellen PASS ohne Vokabel-/Verb-/Pfadnachweise, die anschließende REST-Lesereferenzprüfung schlägt noch fehl. Diagnose offen; Upload/Submission wurden noch nicht erreicht. Keine Releasefreigabe.

S3 a655a90 → 9cef4f5: Additive98 versieht jede neue Versuchsauswahl einmalig mit kryptografisch zufälligen Options-Tokens und unabhängiger Reihenfolge. Dadurch verraten Autoren-IDs/Fragensuffixe keine Lösung mehr. Private kanonische Inhalte/Audio-Aliasse, Text-/Testversionen, alte Antworten und Versuche bleiben identisch. Fortsetzung/Receipts/Bewertung nutzen den gespeicherten Snapshot. 94 und98 müssen vor den ersten produktiven Versuchen zusammen angewandt werden. QA bleibt während der laufenden S5-Freigabe exakt97;98 dort noch nicht installiert.

M: Billing-Integration 7613ceb, vier Jest-Suites/46 Tests, vollständiger TypeScriptcheck und Scoped ESLint bestanden; tatsächlicher PG17 Billingtest ein PASS. Fünfsprachige Route /[lang]/admin/settings/billing und vorhandene Lehrkraftnavigation angebunden, Payment weiterhin deaktiviert/provider unkonfiguriert, keine erfundenen Preise. Browserabnahme bleibt offen.

Batch Text4–6: alle204 neuen lokalen Qwen-Aufnahmen mit Forced Alignment fertig, null Fehler; Neues-Bundle204 Objekte/2.669.520 Bytes geprüft. Vollständiges QA-Bundle umfasst266 Objekte inklusive drei Lesereferenzen, 3.272.392 Bytes;204 neue,30 bereits geprüfte lokale Batch1-Dateien,32 gezielt lesend aus bestehendem Storage zurückgelesene Dateien. Bestehender Importer offline:266 Assets valide. Noch kein QA- oder Produktionsimport dieses Bundles; kein Audioschreiben während S5s eingefrorener Protokollprüfung.


## Verifizierter Zwischenstand 9. Oktober 2026, 02:18 Uhr Berlin

Migration99 reproduziert und behebt den P1 mit der echten PostgreSQL-authenticated-Rolle: Lesende GET-Transaktionen konnten SELECT FOR SHARE in den Audio-Proofs nicht ausführen; abgefangene Fehler führten trotz individuellem PASS zu null sichtbaren Texten. Der neue private Metadaten-Helper verwendet in READ ONLY einen strikten MVCC-SELECT und erhält FOR SHARE für Schreib-, Publikations-, Ticket- und Submission-Transaktionen. Alle bisherigen Identitäts-, Version-, Stimmen-, Hash-, Wortzeiten- und Zugriffsprüfungen bleiben erhalten. M hat 6 native Tests ohne Skip bestanden, einschließlich tatsächlicher gleichzeitiger Ticket-/Metadaten-Sperre. Dies ersetzt noch keinen HTTP- oder Browsernachweis. Die canonical/VPS-Dateien liegen bytegleich unter supabase/migrations und supabase/vps/99_sitov_readonly_audio_proofs.sql; schema.sql enthält93–99. Der unveränderte immutable96-Fixture bleibt ein historisches Ziel; eine separate immutable99-Kombination ist noch offen.

S2 hat den ersten privaten A1.1-Special-Pool mit20 quellenbelegten Artikel-Aufgaben und zwei ausgewogenen, disjunkten Zehnerformen geliefert. M hat22 Autorentests bestanden. Das echte Original-PDF und seine Lösungsseiten sind referenziert; der Entwurf bleibt UNBOUND_DRAFT, active=false und published=false. Die tatsächliche Datenbankbindung und unabhängige Inhaltsprüfung sowie80 vorberechnete deutsche Audioaliase sind noch offen. Es gibt keinen produktiven Import und keinen Publikationsnachweis.

Restkontingent zuletzt41 Prozent, accountweit. Arbeit bleibt OPEN/unvollständig, RELEASE_READY=false, COMMIT_AND_HANDOFF. Payment weiterhin deaktiviert; kein produktiver Deploy, Push oder Audio-Import.


Eine separate immutable99-Kombination pinnt die unveränderte92-Basis und alle sieben bytegleichen canonical/VPS-Overlays93–99 samt exakter historischer schema.sql-SHA. M hat2 native Kombinationsprüfungen bestanden: Erstinstallation aller sieben Overlays, Bestandsschutz für Rechte/History, keine VIP-/Trial-/Kauf-Rückbefüllung, private Tabellen-/Helper-Grenzen, READ-ONLY ohne individuellen PASS gesperrt und Wiederholung der letzten99-Migration. Das ursprüngliche96-Ziel bleibt unverändert. **Kein Nachweis für erneutes Ausführen sämtlicher historischer Overlays auf einer bereits durch99 installierten DB:** Eine anfängliche solche Fixture-Wiederholung brach am sicheren97-Vertragsguard ab, weil99 den früheren Metadaten-Query ersetzt. Der reale migrate-local.py-Aufruf erhält eine ausdrücklich gewählte inkrementelle --apply-Dateiliste; nach unklarem COMMIT-Status zuerst tatsächlich installierte Funktionen/Release prüfen und keine alten Guard-Migrationen blind wiederholen.99 selbst ist idempotent geprüft.


S5 hat den P1 auf tatsächlichem99-HTTP für einen der drei ersten Texte bestätigt behoben: zwei komplette Durchläufe mit jeweils38PASS; letzter Lauf44 echte HTTP-Operationen. Null alte Vokabel-/Verb-/Lernpfadnachweise, individueller PASS, genau ein freigegebener Text, tatsächlicher MP3-Hash, ticketgebundener Storage-Upload und gespeicherte Einreichung/Retry. Fremdzugriff, falscher Text/Ticketzweck und Byte-Überschreiben werden verweigert; kommerzieller Entzug sperrt neue Referenz-/Ticketzugriffe, historische Einreichung und exakter verbrauchter Receipt bleiben erhalten. S5 bereinigte alle12 eigenen neuen Testkonten und4 eigenen MP3-Objekte/Einreichungen der begrenzten Harness-Läufe. Aufnahmebytes waren ausdrücklich eine Kopie des echten vorbereiteten Referenz-MP3; kein Mikrofon-/Browser-/Schüler-Streamingnachweis. Details und frühere Harness-Fehler in S5/epoch7-real-first3-protocol99.md.

Migration100 ergänzt jetzt den authentifizierten staff-only Entwurfsspeicher. Quelldatei-/Textversion und neueste Definition werden geprüft, konkurrierende Anfragen durch Quellenzeilensperre/CAS serialisiert, identische Requests durch private Receipts beantwortet. Neue Versionen bleiben inaktiv und verändern keine aktiven Definitionen, Versuche, Passes oder historischen Daten. Der tatsächliche Serververtrag liegt in lib/sitov-pronunciation-pretest-author-contract.ts und wird für Input/Acknowledgement geprüft. Das bearbeitbare Lehrerfenster sowie veröffentlichende/editoriale Ports bleiben offen. S3 meldet6 native/9 Jest PASS, M prüft Integration gesondert. canonical und supabase/vps/100-Dateien sind bytegleich.

Die erste Special-Quelle wurde von M auf Aufgaben-/Lösungsseiten1/2/5/6 unabhängig visuell und semantisch überprüft.20 Artikel-Aufgaben PASS, keine erfundene Figur.58 neue lokale male-Qwen-Aufnahmen mit Forced Alignment fertig; vollständiges lokales80-Objekt-Bundle enthält zusätzlich2 bereits geprüfte lokale und20 nur lesend geprüfte vorhandene Storage-Aufnahmen. Offline-Importerprüfung80PASS;1125664Bytes. Keine Datenbankbindung, kein QA-/Produktionsimport oder aktive Publikation dieses Special.
