# S4 · Epoch 19 · Fehlersemantik und präzise Logprüfung

Basis: `4ce6ec9b1c458232129f0a1f8542e9e020cc9c03`, Branch `codex/sitov-night-s4-diagnostic-regression`.

## Korrigierte Regression

Der Kalender übersetzt einen Datenbankfehler bereits innerhalb des `readAllRows`-Callbacks in einen `BackendError` mit `not_authorized`. Die neue generelle Catch-Verpackung hatte diesen vorhandenen Domainfehler verändert. Im Defaultpfad (`source` nicht angegeben oder `read`) werden geworfene Exceptions jetzt unverändert einschließlich ihrer Identität weitergereicht. Die ausdrücklich benannten Verblesungen behalten ihre bereinigte typisierte Verpackung. Von PostgREST zurückgegebene Fehler bleiben weiterhin bereinigte `SitovServerReadError`; ein unvollständiges Ergebnis wird nie als Erfolg zurückgegeben.

Die Kalenderassertion prüft nun zusätzlich die tatsächliche `BackendError`-Klasse und deren Domaincode. Die Statistiktests prüfen bei fehlgeschlagener erster oder zweiter Seite weiterhin die Ablehnung statt null/Teilzahlen; sie prüfen jetzt den typisierten sicheren Fehler mit `failure: sqlstate:57P01`, statt einen rohen Fehlercode im Nachrichtentext vorauszusetzen. Drei gemeinsame Lesetests sichern die ursprüngliche Exception-Identität für Default/`read` und Transportfehler.

## Eng begrenzte Privacy-Ausnahme

Die breite statische Prüfung aller `console.error`-/`console.warn`-Stellen in app/lib/components/utils/scripts bleibt erhalten. Zusätzliche Argumente sind nur für acht exakt hinterlegte AST-Formen an den drei bereits geprüften Ports erlaubt: learning-new-server, last-active-level und verbs/server. Diese acht Formen decken die zehn tatsächlichen Diagnosestellen ab. Dateiname, statischer Marker, Console-Methode, Objektfelder und vollständige Ausdrücke müssen übereinstimmen. Verglichen werden semantische AST-Knoten; Formatierung und abschließende Kommata ändern die Form nicht.

Die Diagnoseimporte müssen direkt, ohne Alias und aus dem geprüften server-only Modul stammen. Lokale Schattenbindungen und Neuzuweisungen werden verworfen. Der Verb-Stage benötigt genau die vorhandene begrenzte Union und feste Zuweisungen. Es gibt keine generelle Datei-, Objekt- oder Sanitizer-Freigabe.

30 Privacy-Tests prüfen die breite Anwendungssuche, alle acht positiven Formen, Rohfehler/-felder, zusätzliche/nestende Felder, Casts, Spread, Templates, falsche Methoden, Hilfsfunktionsmissbrauch, Alias-/Schattenimporte, andere Dateien und ungebundene Stage-Werte. Die vorhandenen dynamischen Redaktionsprüfungen bleiben unverändert aktiv.

## Verifikation

Sechs gezielte Suites ausgeführt. Zuerst fünf Suites mit **49 Tests bestanden**; die Privacy-Suite hatte ausschließlich eine Formatierungsabweichung beim mehrzeiligen Verbobjekt. Nach Reparatur des AST-Vergleichs nur die betroffene Privacy-Suite erneut ausgeführt: **30/30 bestanden**. Damit alle **79 gezielten Tests** bestanden, ohne weiteren Sammellauf. Logs: `/tmp/sitov-s4-epoch19-jest.log`, `/tmp/sitov-s4-epoch19-privacy-repair.log`.

ESLint auf den fünf geänderten TS-Dateien: **0 Fehler, 0 Warnungen** (`/tmp/sitov-s4-epoch19-eslint.log`). `git diff --check` und abschließender Arbeitsbaum sauber.

## Grenzen

M meldet tatsächliche Produktionsfehler mit SQLSTATE `57014`; die konkrete Ursache bleibt offen. Dieser Commit korrigiert gemeinsame Fehlersemantik und Privacy-Tests, keine Timeouts, SQL-Abfragen, Rechte, RLS oder Locale-Behandlung. Kein Runtime-, QA-, DB-, Browser-, TypeScript-, Build- oder Gesamt-Jest-Lauf. Keine Freigabe oder Behauptung einer behobenen Produktionsursache.

Eigener Commit und atomarer Status an M; danach WAITING_FOR_NEXT_START ohne Folgearbeit.
