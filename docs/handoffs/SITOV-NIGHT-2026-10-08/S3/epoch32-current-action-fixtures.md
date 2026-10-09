# Sitov Academy — S3 Epoch32: aktuelle Action-Fixtures

Auftrag: `REPAIR_OWNWORD_AND_INDIVIDUAL_PRETEST_LOADING_REGRESSION_FIXTURES`.
Ausgangs-HEAD: `072173261e6a1e37b54d1dabb7ee2842719fb650`.
Branch: `codex/sitov-night-s3-current-action-fixtures`.
Lease: 2026-10-09 10:10:47.934704 bis 10:19:47.934704 UTC; danach WAIT.

## Befund und Änderung

Der tatsächliche M-Gesamtlauf `/tmp/sitov-night-m-jest-all-acea8048.log` zeigt acht fehlgeschlagene Ownword-Fälle und den positiven Aussprache-Ladefall. Gegen die aktuellen Sources geprüft: Der generische Ownword-RPC-Mock lieferte die Kartenantwort auch an `get_sitov_access_context`; die reale Zugriffsprofilvalidierung verweigerte deshalb den Zugriff. Der Aussprachetest lieferte die frühere aggregierte Readiness statt des individuellen Vortestkatalogs.

`vocabulary-own-words-actions.test.ts`: expliziter RPC-Dispatcher mit aktuellem kommerziellem DTO (`vip_enabled`, Trial v1, `purchased_levels`, `revision`), getrennten Kontext- und Mutations-Spies und Fehlern für unbekannte RPCs/Tabellen. Die echte Zugriffsprofilvalidierung bleibt aktiv. Signed-out und ungültige Eingaben führen zu keinem RPC; ausgeschöpfte Quote und fehlendes vorbereitetes Audio erlauben die notwendige Kontextabfrage, aber keine Mutation. Artikel/Locale, Queue, transaktionaler Audio-Readiness-Race, DB-Fehler, Löschung und fehlende Einstufung bleiben geprüft.

`sitov-pronunciation-loading.test.ts`: gezielter Mock des aktuellen `loadSitovPronunciationPretests(level)`-Serverports statt des alten Readiness-RPC. Erfolgsdaten werden durch das reale strikte Katalogschema validiert: UUIDs, gleicher Text/Test-Fingerprint und verknüpfter bestandener Versuch/Proof. Die Action prüft weiterhin ihre echte verifizierte Session und das explizite Zugriffsprofil. Assertions prüfen Benutzerbindung, Level-Port, ausschließlich bestandene IDs, aktives Level, Sortierung, gesperrte/verfügbare Texte ohne Pass, Katalogfehler, Signed-out, verweigerten Trainerzugriff, Lehrkraft-Lektionseinschränkung und unerwartete Ergebniszeilen. Fremde Text-/Versions-/Versuch-Proofs werden vom realen Schema abgelehnt. Vorhandene Recording-Signing- und Storage-Ausfallprüfungen bleiben erhalten. Der bestehende Node-Testkontext bleibt unverändert.

## Tatsächlich ausgeführte Validierung

- `npx jest --runInBand __tests__/vocabulary-own-words-actions.test.ts __tests__/sitov-pronunciation-loading.test.ts`: **2 Suiten, 21 Tests bestanden**, 0 Snapshots, 0 übersprungene Tests (0,74 s).
- `npx eslint __tests__/vocabulary-own-words-actions.test.ts __tests__/sitov-pronunciation-loading.test.ts`: Exit 0.
- `git diff --check`: Exit 0; nur die zwei zugewiesenen Tests und dieser Handoff geändert.

## Aussagegrenzen / Übergabe

Dies ist eine begrenzte Test-Fixture-Reparatur am aktuellen Action-Port. Der gemockte Katalogport beweist weder dessen eigene zusätzliche Authentifizierung noch reale DB/RLS, persistierte aktuelle Freigaben, Storage oder Aufnahmefunktion. Die Proof-Checks validieren den Transportvertrag; sie erteilen selbst keine Berechtigung. Die Action-Test-Assertion einer Authentifizierung gilt innerhalb dieser isolierten Portgrenze. Der M-Gesamtlauf wurde hier nicht wiederholt; weitere dortige Fehler bleiben bei M/S5.

Keine Produkt-, SQL-, Inhalts-, Audio- oder Runtimeänderung. Kein fullTS/Build/QA/Browser/native DB/TTS/Import/Publishing/Deployment. Keine neuen Abhängigkeiten, Polyfills, globalen Freigaben oder Skips. Gesamtvorhaben weiterhin **NOT_RELEASE_READY**. M kann den einzelnen Commit integrieren und seine eigenen aktuellen Checks ausführen. S3 geht nach Commit und atomarer Statusmeldung in WAIT.
