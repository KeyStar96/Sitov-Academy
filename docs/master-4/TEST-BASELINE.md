# Phase 0 — Test-Baseline

Stand: 25.09.2026, Ausgangsrevision `e123fab0ba49177c3c15f06db10249d92eb688d9`.
Die Baseline wurde ohne Änderung von Anwendungscode, Tests, Testfiltern oder Repository-Konfiguration ausgeführt. Regeln und Phase-0-Auftrag wurden vollständig gelesen. Die lokale Next-Dokumentation zu Build, Umgebungsvariablen und CLI/Typgenerierung wurde vor dem Lauf geprüft.

## Abschließende Ergebnisse

| Prüfung | Umfang | Bestanden | Fehlgeschlagen | Übersprungen | Ergebnis / Grenze |
| --- | --- | ---: | ---: | ---: | --- |
| Jest, vollständiger Lauf mit explizitem lesendem Integrations-Smoke | 134 Suites, 1.613 Tests | 1.613 | 0 | 0 | 134 Suites bestanden, Exit 0; Einzelheiten zum SSH-Tunnel unten |
| DB-Tests | Alle 41 Dateien `supabase/tests/*.test.mjs`, 397 Tests inklusive Untertests | 397 | 0 | 0 | Exit 0; isolierte PGlite-Datenbanken, keine produktiven DB-Schreibzugriffe; Node meldet 0 `describe`-Suites |
| Python VPS-Unittests | Alle 9 `test*.py`-Module in `deploy/vps/tests`, 61 Tests | 61 | 0 | 0 | Exit 0 mit PyYAML 6.0.3 in temporärer Umgebung |
| Python TTS-Unittests | `deploy/vps/test_tts_server.py`, 3 Tests | 3 | 0 | 0 | Exit 0; gemockte Synthese und kurzlebiger Loopback-HTTP-Testserver |
| TypeScript | `npx tsc --noEmit`, vollständiges Projekt nach Build-Typgenerierung | 1 Lauf | 0 | 0 | Exit 0, keine Diagnosen |
| Produktions-Build | `npm run build`, alle Routen | 1 Lauf | 0 | 0 | Exit 0, 157/157 statische Seiten; Heap-Limit 3.072 MiB |
| Accessibility | Ganze Datei `e2e/accessibility.spec.ts`, 1 Suite / 6 Tests | 6 | 0 | 0 | Exit 0, keine Flaky-Tests; lokales Google Chrome statt zunächst fehlendem Playwright-Chromium |

Es gab in diesen abgeschlossenen Läufen keine fehlgeschlagenen Assertions. Die zunächst vorhandenen Ausführungs- und Umgebungsprobleme sind unten separat erhalten; ein normaler Jest-Aufruf allein deckt weiterhin nicht alle Tests ab.

## Umgebung und Reproduzierbarkeit

Lokal: macOS ARM64, Node.js `26.8.2`, Python `3.14.3`, Next.js `16.3.5`, TypeScript `5.9.3`, Jest `29.7.0`, Playwright `1.58.2`, Google Chrome `153.0.8010.54`. Rohprotokolle und maschinenlesbare Ergebnisse liegen lokal unter `/tmp/smartgerman-phase0-baseline/`; temporäre Werkzeuge, Browsercache und generierte Build-Dateien gehören nicht zum Commit.

Jest und DB-Tests liefen mit jeweils einem Worker/Prozess zur Begrenzung des Speicherbedarfs. Dies schränkt den Testumfang nicht ein. Build und anschließendes `tsc` liefen sequenziell, sodass die von Next erzeugten Routentypen vorhanden waren. Die VPS-Ressourcenlimits wurden nicht verändert.

### Jest und der vorhandene Integrationstest

Der Standardlauf war vollständig für die bestehende Jest-Konfiguration:

```sh
NODE_OPTIONS=--max-old-space-size=3072 npm test -- \
  --runInBand --json \
  --outputFile=/tmp/smartgerman-phase0-baseline/jest.json
```

Ergebnis: **133 Suites / 1.612 Tests bestanden; 1 Suite / 1 Test übersprungen; 0 Fehler**. Ursache ist die schon vorhandene Umschaltung in `__tests__/integration-real-db.test.ts:3`: Ohne `RUN_SELF_HOSTED_INTEGRATION=1` wird `it.skip` verwendet. Das wurde nicht als vollständige Abnahme gewertet.

Nach vollständiger Prüfung dieses Tests wurde der gesamte Jest-Lauf mit aktiviertem Integrations-Smoke wiederholt. Der Test führt ausschließlich zwei lesende Supabase-Abfragen aus: öffentlich sichtbare `courses` und den erwarteten verweigerten Zugriff auf `people`. Ein temporärer SSH-Forward verband lokal `127.0.0.1:54322` mit dem bestehenden VPS-Endpunkt `127.0.0.1:9080`. Der Anon-Key wurde ausschließlich im Speicher aus der bestehenden VPS-Konfiguration gelesen und nicht protokolliert.

```sh
ssh -N -L 127.0.0.1:54322:127.0.0.1:9080 sitov-academy
# Separater Prozess; Anon-Key nur als Prozessumgebung übergeben:
RUN_SELF_HOSTED_INTEGRATION=1 \
SELF_HOSTED_TEST_URL=http://127.0.0.1:54322 \
SELF_HOSTED_TEST_ANON_KEY="$test_anon_key" \
NODE_ENV=test node_modules/.bin/jest --runInBand --json \
  --outputFile=/tmp/smartgerman-phase0-baseline/jest-readonly.json
```

Tatsächlich erfolgte der zweite Aufruf über den geprüften temporären Wrapper `/tmp/smartgerman-phase0/jest-readonly.py`, der den Key ohne Shellausgabe lädt. Ergebnis: **134/134 Suites und 1.613/1.613 Tests bestanden, 0 Skip, 0 Fehler**, Dauer 19,058 Sekunden. Nachweis: `jest-readonly.log`, `jest-readonly.json`, `jest-readonly.exit`.

Der Testname nennt eine lokale Docker-Instanz. Tatsächlich wurde hier der **produktive, ausschließlich lesende Smoke über SSH-Forward** ausgeführt; das ist kein Nachweis einer neu aufgebauten lokalen Docker-Instanz. Es wurden keine VPS-Dateien, Datensätze, Mails, Konten oder Konfigurationen verändert. Die übrigen Jest-Tests verwenden ihre vorhandenen Mocks. Für zukünftige vollständige Läufe muss dieser Test weiterhin ausdrücklich aktiviert werden; sein vorhandener Standard-Skip bleibt als R6-Befund bestehen.

### DB-Tests

```sh
NODE_OPTIONS=--max-old-space-size=3072 \
  node --test --test-concurrency=1 supabase/tests/*.test.mjs
```

Alle 41 Dateien wurden ausgeführt, ohne Namensfilter und ohne hinzugefügte Skips. Ergebnis: **397 bestanden, 0 fehlgeschlagen, 0 übersprungen, 0 abgebrochen, 0 Todo**, Dauer 28,062 Sekunden. Nachweis: `db.log`, `db.exit`.

Die Tests erzeugen mit `PGlite` isolierte lokale Datenbanken und laden Repository-Fixtures/Migrationen. Sie testen nicht direkt die aktuell laufende VPS-Datenbank. Die acht vorhandenen `test:db:*`-Skripte in `package.json` decken nur acht der 41 Dateien ab; allein diese Skripte wären kein vollständiger DB-Lauf. Der verwendete Glob schließt alle 41 Dateien ein.

### Python

```sh
python3 -m unittest discover -s deploy/vps/tests -p 'test*.py' -v
PYTHONPATH=deploy/vps python3 -m unittest discover \
  -s deploy/vps -p 'test_tts_server.py' -v
```

Der erste VPS-Unittest-Lauf ergab 60 bestandene Tests und einen vorhandenen Skip: `test_traefik_routes_cover_both_names_with_one_redirect` in `test_go_live_domain.py` überspringt sich, wenn PyYAML fehlt. TTS bestand bereits mit 3/3 Tests.

Ohne Repository- oder System-Python-Änderung wurde eine temporäre Umgebung mit PyYAML angelegt; danach wurden beide vollständigen Unittest-Umfänge erneut ausgeführt:

```sh
python3 -m venv /tmp/smartgerman-phase0-baseline/python-venv
/tmp/smartgerman-phase0-baseline/python-venv/bin/python -m pip install PyYAML
/tmp/smartgerman-phase0-baseline/python-venv/bin/python -m unittest discover \
  -s deploy/vps/tests -p 'test*.py' -v
PYTHONPATH=deploy/vps \
  /tmp/smartgerman-phase0-baseline/python-venv/bin/python -m unittest discover \
  -s deploy/vps -p 'test_tts_server.py' -v
```

Abschließend **61/61 + 3/3 = 64/64 bestanden, 0 Fehler, 0 Skip**. Nachweise: `python-vps.log`, `python-tts.log` für den Erstlauf; `python-dependency.log`, `python-vps-complete.log`, `python-tts-complete.log` für den vollständigen Lauf. Die Repository-Suche nach Python-Unittest-Imports ergab keine weiteren Unittest-Module.

Sieben zusätzliche Python-Dateien sind eigenständige Integrations-/Fixture-Werkzeuge, keine Unittest-Module: `canonical-rest.py`, `phase2-concurrent-quota.py`, `phase2-registration-e2e.py`, `phase2-storage-http.py`, `phase4-indexes.py`, `phase4-proxy.py`, `phase5-media-fixture.py`. Sie benötigen spezielle Docker-/Validierungsumgebungen oder verändern Daten/Rate-Limits über reale Endpunkte. Sie wurden in der ausschließlich lesenden Phase 0 nicht gestartet und sind nicht als bestandene Tests mitgezählt. Insbesondere führt `phase4-proxy.py` echte Login-POSTs mit Änderungen an Rate-Limit-Buckets aus. Die SQL-Katalogskripte in demselben Ordner sind ebenfalls separate Integrationswerkzeuge. Deren Ende-zu-Ende-Abdeckung bleibt von dieser lokalen Unittest-/PGlite-Baseline getrennt.

### Build und TypeScript

Für Build und lokalen Browser-Testserver wurden ausschließlich explizite lokale Platzhalter-Adressen und Dummy-Schlüssel verwendet. Prozessvariablen haben nach der gelesenen Next-Dokumentation Vorrang vor `.env.local`:

```sh
NODE_OPTIONS=--max-old-space-size=3072 NEXT_TELEMETRY_DISABLED=1 \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=phase0-local-placeholder \
SUPABASE_INTERNAL_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=phase0-local-placeholder \
NEXT_PUBLIC_SITE_URL=http://localhost:3000 SITE_URL=http://localhost:3000 \
npm run build
NODE_OPTIONS=--max-old-space-size=3072 npx tsc --noEmit
```

Build: Exit 0, Kompilierung 4,0 Sekunden, integrierte TypeScript-Prüfung 4,8 Sekunden, 157/157 statische Seiten generiert. Eigenständiges `tsc`: Exit 0 ohne Diagnosen. Nachweise: `build.log`, `tsc.log`.

Bestehende Warnung: Eigene `Cache-Control`-Header für `/_next/static/:path*` können laut Next das Entwicklungsverhalten beeinträchtigen. Der Build meldet außerdem `Catalog unavailable` / `Calendar unavailable`, weil die Platzhalter-DB während des Builds nicht läuft; die vorgesehenen Fehlerpfade greifen und der Build schließt ab. Dieser Build ist ein technischer Baseline-Lauf mit Dummy-Umgebung und wird nicht als veröffentlichungsfertiges Artefakt verwendet.

### Accessibility

Der anfängliche Standardaufruf der gesamten Datei scheiterte bei allen sechs Fällen **vor** der eigentlichen Prüfung: Das erwartete Playwright-Binary `chromium_headless_shell-1208` war nicht installiert. Diese sechs Infrastrukturfehler sind in `accessibility.json` erhalten; sie belegen weder sechs UI-Verstöße noch eine erfolgreiche Accessibility-Prüfung.

Ein Browsercache-Installationsversuch (`npx playwright install chromium`) lud Chromium herunter, blieb danach ohne weiteren Fortschritt im Entpackprozess und wurde beendet. Als verfügbare lokale Alternative wurde Google Chrome `153.0.8010.54` verwendet. Die temporäre Datei `/tmp/smartgerman-phase0-baseline/playwright.chrome.config.ts` importiert die unveränderte Repository-Konfiguration, setzt `testDir` auf deren absoluten Pfad und ergänzt im vorhandenen Chromium-Projekt ausschließlich `channel: 'chrome'`. Keine Repository-Konfiguration wurde geändert.

```sh
NODE_OPTIONS=--max-old-space-size=3072 npx playwright test \
  e2e/accessibility.spec.ts \
  --config=/tmp/smartgerman-phase0-baseline/playwright.chrome.config.ts \
  --workers=1 --reporter=json \
  --output=/tmp/smartgerman-phase0-baseline/accessibility-chrome-artifacts
```

Ergebnis: **6/6 bestanden, 0 fehlgeschlagen, 0 übersprungen, 0 flaky**, Dauer 16,682 Sekunden. Der Lauf verwendete den lokalen `next dev`-Server auf Port 3000 mit den oben genannten Platzhaltervariablen. Geprüft wurden Home, Registration und Cancellation jeweils in Light und Dark. Die bestehende Datei wertet das vollständige Axe-Ergebnis ohne Regel-, Node-, Impact- oder Tag-Ausschlüsse aus und verwendet den vorhandenen Reduced-Motion-/Animationsabschluss vor der Messung. Netzwerkzugriffe des Browsers sind durch die bestehende Testdatei auf Loopback beschränkt. Nachweise: `accessibility-chrome.json`, `accessibility-chrome.exit`, `accessibility-chrome-stderr.log`.

Die Aussage gilt für diesen lokalen Chrome-Lauf und die sechs bestehenden öffentlichen Seiten. Sie ersetzt keinen Accessibility-Test sämtlicher geschützter Lernraum-Seiten, aller Sprachversionen oder mobiler Geräte. Der ursprüngliche Standardbefehl benötigt weiterhin das passende Playwright-Chromium im Cache. Der zusätzliche Node-Hinweis zur veralteten `module.register()`-API stammt aus dem Testwerkzeug und verursachte keine fehlgeschlagene Assertion.

## Übergabe

Es wurden keine roten Anwendungs-/DB-Assertions gefunden und keine Tests geändert, entfernt oder ausgeblendet. Erhaltene Folgepunkte: explizite Aktivierung des vorhandenen Jest-Smokes (R6), reproduzierbare PyYAML-Testabhängigkeit, fehlendes Standard-Playwright-Binary und bestehende Next-Cache-Header-Warnung. Die gesonderten Docker-/REST-/Storage-Integrationswerkzeuge brauchen eine dafür vorbereitete isolierte Testumgebung. Diese Befunde sind Ausgangszustand für spätere Phasen und keine Codeänderungen von Phase 0.
