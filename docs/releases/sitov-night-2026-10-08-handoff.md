# Sitov Academy – vorläufige Nachtlauf-Übergabe 2026-10-08

Gesicherter Zwischenstand, weiterhin unvollständig. Stand 09.10.2026, 01:23 Uhr Europe/Berlin: OPEN, NOT_RELEASE_READY, COMMIT_AND_HANDOFF. Deployment ausstehend; kein Push oder Produktivrollout, kein garantierter morgendlicher Abschluss.

Basis: 966a380f7a6118654f19750a9d62200795feb8c2. Geprüfte Feature-Integration: b5a154894a75f2682fd147de58ff6eb558760d6e. Der aktuelle Dokumentations-/Mirrorcommit folgt darauf; definitive Release-SHA und S5-Abnahme stehen aus.

## Änderungen und Verträge

93 enthält additive kommerzielle Quellen, genaue Item-Autorisierung und ausgeschaltetes Payment mit fehlendem Provider. Vorhandene all/none/selected-Rechte bleiben erhalten; VIP ist ein zusätzlicher Schüleranspruch, kein pauschales Bestandsbackfill. Testzugang erteilt nur seine ausgewählten Items, keine Geschwisterrechte.

94 enthält individuelle aktuelle textbezogene Vortests, serverseitige Bewertung, CAS/Receipts, zweck-/textgebundene Uploadtickets und historische Ergebnisse. Nur der bestandene aktuelle Texttest ist die fachliche Aussprachevoraussetzung; kommerzielle Rechte separat prüfen. Empfehlungen, Fortschritt und alte hard-/Readiness-Werte ersetzen ihn nicht. Private unabhängige Quellen-/Review-/Lesereferenznachweise schützen Aktivierung; jede öffentliche deutsche Frage, jedes Fragment und jede Antwortoption benötigen zusätzlich einen unveränderlichen versionsgebundenen Audio-/Wortzeitenproof.

95 enthält den privaten optionalen Special-Kern: gespeicherte Lernwarteschlange, zehn Testfragen, 8/10 zum Bestehen, getrennte Wiederholungsformen, Versions-/Quellen-/Review-/Audioproof. 96 stellt gemeinsame vorbereitete Audios privat bereit; bestehende gültige Objektproofs bleiben bei exakter Referenzidentität verwendbar. Kein realer neuer Content aktiviert.

S4 bietet die fünfsprachige Vorteststrecke/Hilfe, ein lesendes Lehrkraftfenster in bestehenden Schüler-/Inhaltsansichten und exakte Vokabelkarten-/Verbziele ohne Fortschrittsmutation beim Öffnen. Alte Readiness-/hard-Steuerung dort entfernt, Gespräche/Historie erhalten. S2-Empfehlungen noch nicht an neue Ziele gebunden. Sieben Mappingbeispiele sind keine Vollabdeckung. Drei private Textpools mit 72 Fragen vorhanden, 57 fehlen. Reim/Zungenbrecher zurückgestellt.

Aktuelle Integrationscommits:

- Vokabelzugang: 74138b86eaee51e7298c59232f1e8802d30c4fe7.
- Staff: fb1dca6bc1c3402cf11f591d3f931029866f21b1; Ziele: 9bb8e9a20e319a9e4660b3bc38ca7b6b5a3de67c.
- Vortestproof: bf61bb3d801a73ff6f2ea339eea7e141d6711087; Referenzbegrenzung: 67dab4db9a530a572e7004d6218e62608741214f; 96-Kompatibilität: 09dc6b38bf8e632f8d88835174f55487009da9ad.
- Specialproof: 474690ef2e0fda4ebc6fbd5853970ffc60cdbead; Reparatur: f0a6c5005ab4d45611711f527fdb8b1bef7ce5b2.

## Migration und Rückweg – keine Ausführungsfreigabe

schema.sql enthält die geprüften 93–96-Overlays. Die historische standardization/learning.sql dokumentiert die Reihenfolge, ist aber kein vollständiger aktueller Installer. Die separate Fixture supabase/tests/fixtures/sitov-night-integrated96/plan.json pinnt Baseline92 und alle vier Overlays bytegenau; Baseline92 bleibt unverändert. Der kombinierte native Install/Replayschutz besteht. Reale PostgreSQL15-Service- und Browserabnahme bleibt ausstehend. Reviewed Artefakte in Reihenfolge 93, 94, 95, 96 verwenden:

- 20261008213000_sitov_commercial_access.sql ↔ VPS 93_sitov_commercial_access.sql.
- 20261008213100_sitov_pronunciation_pretests.sql ↔ VPS 94_sitov_pronunciation_pretests.sql.
- 20261008213200_sitov_learning_specials.sql ↔ VPS 95_sitov_learning_specials.sql.
- 20261008213300_sitov_private_audio_delivery.sql ↔ VPS 96_sitov_private_audio_delivery.sql.

Dateien liegen in supabase/migrations/ und supabase/vps/. Produktive Anwendung ausschließlich durch M nach Releasepolitik/Freigabegates. Backup und finaler isolierter Rechte-/Historiendiff erforderlich. Unmittelbar vor/nach späterer Produktionsmigration sämtliche Bestandskonten vergleichen; persönliche Daten außerhalb Git/Logs/Vault. Die Privatstellung des Audiobuckets verlangt bestätigte Wiedergabe aller betroffenen Trainer.

Rückwege erhalten Daten: 93 bewahrt alte Funktionsdefinitionen; 94/95 deaktivieren neue APIs unter Erhalt von Versuchen/Quellen/Reviews/Historie. 94-Rollback friert neue Aussprachewrites ein, statt alte unbeabsichtigte Rechte zurückzubringen. Den sicheren App-/DB-/Storage-Rückweg für 96 muss M/S5 final prüfen; keine pauschale öffentliche Bucketfreigabe. UI-/Metadatencommits gewöhnlich revertierbar. Keine Löschung realer Aufnahmen.

## Tatsächliche QA und Grenzen

S6 führte keinen Produkttest aus. M-/Worker-Protokolle:

- node --test supabase/tests/sitov-pronunciation-pretests.test.mjs supabase/tests/sitov-private-audio-delivery.test.mjs scripts/sitov-pronunciation-pretests-authoring.test.mjs: M 37 bestanden (12 Pretest, ein private96, 24 Autorenprüfungen), ohne Skips; native SQL/RLS/Metadaten, keine HTTP-/Content-Abnahme.
- node --test supabase/tests/sitov-learning-specials.test.mjs: S2 ein vollständiges natives Szenario auf gepinntem 92+93+95+96 bestanden; Rechte/Historie/MFA/Proof-Identität/Queue/7-fail/8-pass, synthetische Audiodaten.
- node --test scripts/sitov-pronunciation-pretests-authoring.test.mjs: 24 Offline-Tests bestanden nach e74ab16/b5a1548.
- node scripts/sitov-pronunciation-pretests-authoring.mjs: drei von 60 private Entwürfe, 57 fehlen, null veröffentlicht.
- M-Welle 5: Jest 91 Tests/acht Suites sowie native 21 und separate Baseline acht bestanden ohne Skips. Frühere Stages; Logs /tmp/sitov-night-m-wave5-jest.json, /tmp/sitov-night-m-native-wave5.log, /tmp/sitov-night-m-pinned92-wave5.log.
- M-Ziel-/Staffbatch: Jest 27 Tests/vier Suites und npx tsc --noEmit --incremental false bestanden nach 9bb. Log /tmp/sitov-night-m-target-wave6.json; Befehl: npx jest __tests__/sitov-learning-target-server.test.ts __tests__/sitov-learning-target-ui.test.tsx __tests__/sitov-learning-specials-staff.test.ts __tests__/sitov-learning-specials-contract.test.ts --runInBand --silent. Transportmocks/Unitbeweise.
- node --test supabase/tests/sitov-night-integrated96.test.mjs: zwei bestanden; alle Overlays/Hashes und Replay geprüft. Rechtegleichheit sämtlicher synthetischer Bestandsprofile, mit genau der genehmigten Entfernung der alten Deutsch-Sprachsperre; Historie gleich. Audio privat, kein VIP/Trial/Kauf-Backfill.
- npm run build fehlgeschlagen: Turbopack/node_modules-Symlink außerhalb der Worktreewurzel.
- npm run build -- --webpack bestanden: 303 Seiten und TypeScript, bestehende SoftErrorBadge-JSON-Importwarnung. Vor jüngsten Guard-/Zieländerungen; kein aktueller finaler Build. Log /tmp/sitov-night-m-webpack-wave5.log.

MFA-Fixture korrigiert: bestehende Passwort-Lehrkräfte AAL1 erlaubt, geschützter Admin AAL1 abgewiesen und verifiziertes TOTP/AAL2 erlaubt. Keine Änderung der Produktregel.

## Audio und Veröffentlichung

M prüfte 60 bestehende Qwen-Lesereferenzen mit Metadaten/Alignment und echten Storagebytes per SHA/Größe: 60 bestanden, ausschließlich lesend. Fingerprint 96db5949cf9ba060eb5fbeeec3b472d232d55e0b22dc2512cf65dc53c8c47df5. Keine neue Aufnahme/Import/Publikation und kein Lernenden-HTTP-Nachweis. Bekannte 235 Grammatik-/Satzbau-Audiolücken bleiben.

Manifest: 288 Frage-/Options-IDs, 253 Rohtexte. 212 neue Assets wurden serialisiert lokal mit Qwen3-TTS-12Hz-1.7B-Base/sitov-qwen-male-de-v1 fertig erzeugt, null Fehler. Bundle mit 212 MP3s, 2.679.472 Bytes und vollständigen lexikalischen Wortzeitmarken geprüft. Alle 41 wiederverwendeten Objekte wurden per realen Storagebytes auf SHA/Größe geprüft: 41 PASS. Audio liegt außerhalb Git im privaten Autorenverzeichnis; kein Produktionsimport oder Veröffentlichung. 94 erzwingt jetzt für alle öffentlichen Testtexte exakte vorbereitete Objekt-/Wortzeitenproofs. Trusted Proof-/Reviewimport bleibt ausstehend. Unabhängige Agentenprüfung ist keine menschliche Freigabe/Kalibrierung. Reale Definitionen inaktiv.

## Ausstehende finale Gates

Reale Auth/JWT/PostgREST/Storagepolicy-HTTP-Abläufe und sichere Text-/Audio-/Record-/Submit-/Review-/Historienstrecken; bestehende Trainerregression; Browser 320/390/1440, Themes/Kontrast/200 Prozent Schrift, fünf Sprachen, Tastatur/Screenreader/Reduced Motion; 57 Textpools und qualifizierte Prüfung; Trusted Taskaudio-/Review-Proofimport; Special-Quellen/Pools/Autoren-/Lernenden-UI; Zugangs-/Billingverwaltung; gebundene Empfehlungen; reale PostgreSQL15-Abnahme der eingefrorenen Gesamtfixture; neuer Build und S5-Abnahme. Keine gesamte Produktionsreife aus Unit-/SQL-/Buildbefunden ableiten.

Final ergänzen: definitive Integrations-SHA, genaue Batchbefehle/Ergebnisse, reale Browserartefakte, geprüfter Audioimport/Publikationsstand, Bestandslücken und Releaseentscheidung. Bei COMMIT_AND_HANDOFF Deployment ausdrücklich ausstehend. Vault 43 aktualisiert; Dashboard, Features, Notiz 19 und Readinessnotizen bis Folgefreigabe unverändert.

## Fortsetzung und spätere Deployment-Übergabe

Wochenkontingent um 01:19 Uhr: 54 % verbraucht, 46 % verbleibend; gemeinsam, keine Kostenzuordnung pro Session. Mastergruppe OPEN, eigene bestätigte Wiedervorlage aktiv. Vor jeder neuen Lease/Prüfwelle frisch prüfen; ab 30 % Contentfreeze, 25 % Featurefreeze, 18 % SAVE_ONLY, 15 % STOP.

Zunächst isolierte tatsächliche Auth/JWT/PostgREST/Storage-Probe mit ausschließlich synthetischen Konten und separaten Testschlüsseln durchführen. S5 untersucht vorhandene VPS-Images in dieser Phase nur lesend; M prüft den konkreten begrenzten Aufbau vor Anlage. Keine produktiven Netzwerke, Container, Konten oder Daten ändern. Danach Browser-/Trainerregression sowie menschliche Fachprüfung und vollständige 60-Text-/Special-Zuordnung abschließen. Die ersten drei Definitionen bleiben bis Audio-/Fachproofimport inaktiv.

Bei später ausdrücklich erteilter AUTO_DEPLOY-Freigabe ausschließlich deploy/vps/deploy-release.sh beziehungsweise den verifizierten installierten /opt/sitov-ops/sitov-deploy-release.sh verwenden: Backup und isolierte Migrationsprobe, --prepare-only, geprüfte93–96 und kompatiblen authentifizierten Adapter zusammen planen, lokale Audio-/Wortzeitenbundle importieren, trusted definitions-/Audio-/Reviewproofs versionsgenau importieren, erst danach geprüfte Inhalte aktivieren. Exakt die vorbereitete Revision mit --activate REVISION und nötigenfalls --schema-changed aktivieren. Health/Readiness/authentifizierte Smokes und Payment-off bestätigen. Keine Ausführung unter dieser COMMIT_AND_HANDOFF-Übergabe, kein App-only-Rollback bei inkompatibler DB, keine pauschale öffentliche Freigabe von audio_cache.
