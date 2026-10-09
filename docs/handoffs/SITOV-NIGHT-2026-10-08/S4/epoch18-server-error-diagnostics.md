# S4 · Epoch 18 · Begrenzte Serverdiagnostik

Basis: `5d665d1cd9598523f2e9df89acc6bcedef732af1`, Branch `codex/sitov-night-s4-server-error-diagnostics`.

## Erreicht

Die tatsächliche Ursache des UK/TR-Verbseitenfehlers bleibt offen. Dieser Commit ermöglicht eine sichere Unterscheidung beim nächsten Serverfehler; er behauptet weder einen Locale-Fehler noch dessen Behebung.

Ein kleiner server-only Helfer gibt ausschließlich begrenzte Discriminatoren aus: SQLSTATE im streng längen- und formatgeprüften Fünfzeichenformat mit begrenzten Klassenpräfixen, `PGRST` plus drei Ziffern, exakt freigegebene Netzwerkcodes oder Fehlerklassen. Alle anderen Werte werden `unknown`. Nachricht, Details, Stack, URL, Nutzer-ID, Eingaben, Cookies und Tokens werden nicht serialisiert oder geloggt. Eine einzige direkte `cause.code`-Ebene wird nur für die Netzwerk-Whitelist berücksichtigt. Nichtstringwerte werden nicht konvertiert; werfende Accessoren werden abgefangen.

`readAllRows` trägt jetzt ausschließlich einen bereinigten Code und eine feste Herkunft (`read`, `verb_catalog`, `verb_box`, `verb_progress`) durch einen typisierten Error. Rohe Fehler/Causes bleiben darin nicht erhalten. Pagination, Sortierung, 500-Zeilen-Grenze und Verwerfen eines unvollständigen Katalogs bleiben erhalten.

Der bestehende Verbmarker `[sitov-verbs] Request unavailable` erhält `stage` und `failure`: etwa `verb_catalog` / `sqlstate:42501`, `client` / `network:ECONNRESET` oder `work` / `class:ZodError`. Die drei Tabellenlesungen sind unterscheidbar. Erwartete Geschäftsfehler und Zugriffssperren bleiben unverändert; unerwartete Fehler liefern weiterhin ausschließlich `request_failed` an den Client.

Die bestehenden Learning-new- und Last-active-Marker erhalten denselben begrenzten `failure`-Wert. Ungültige Learning-new-Items werden anhand des bestehenden Parser-Fallbacks zusätzlich mit dem festen Marker `items_invalid` kenntlich gemacht. JSONB-RPC-Fehler bei HTTP-Erfolg lassen sich über den geprüften SQLSTATE unterscheiden. Leere erfolgreiche Antworten erzeugen keinen Fehlerlog. Die ursprünglichen `null`-/`NO_NEW_ITEMS`-Fallbacks bleiben bestehen.

## Verifikation

Nur drei freigegebene, gezielte Suites ausgeführt: **29/29 Tests bestanden**, 3/3 Suites (`/tmp/sitov-s4-epoch18-jest.log`). ESLint auf acht geänderten TS-Dateien: **0 Fehler, 0 Warnungen** (`/tmp/sitov-s4-epoch18-eslint.log`). `git diff --check` und abschließender Arbeitsbaum sauber.

Tests prüfen SQLSTATE/PostgREST, Netzwerk-Cause, Zod-/Runtime-Klassen, manipulierte/lange/mehrzeilige Codes, Rohfeld-Accessoren und fehlende Konvertierung; keine privaten Werte in tatsächlichen Logargumenten. Die echten Verb-Serverpfade behalten bei UK/TR-Datenbankfehlern `request_failed`, bei widerrufenen Rechten stoppen sie vor dem Katalog. Kataloglesefehler, ungültiges Fortschrittsschema und Client-Transportfehler sind unterscheidbar. Die RPC-Fallbacks und erfolgreiche leere Antworten werden über die tatsächlichen Loader geprüft.

## Grenzen und nächste Auswertung

Keine Rechte-, RLS-, Schema-, Locale-, Retry- oder Inhaltsänderung. Kein Runtime-, QA-, Browser-, DB-, Build-, globaler TypeScript- oder Gesamt-Jest-Lauf. Diese Tests verwenden begrenzte Client-/RPC-Testdoubles; sie reproduzieren nicht die Produktionsursache. M kann nach eigener Integration am nächsten tatsächlich auftretenden Fehler den festen Marker samt begrenzter Herkunft/Code auswerten. Keine Autorisierungsumgehung oder Ursachenvermutung daraus ableiten.

Commit und atomarer S4-Status gehen an M; anschließend WAITING_FOR_NEXT_START ohne Folgearbeit.
