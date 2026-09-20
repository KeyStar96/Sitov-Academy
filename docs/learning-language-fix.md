# Gespeicherte Interface-Sprache beim Lernraum-Einstieg

Stand: 20.09.2026. Release `a69823451b24` produktiv aktiviert.

## Ursache und Verhalten

Der normale Login las `profiles.ui_language` bereits. Bei bestehender Sitzung verwendete die Middleware dagegen das Sprachpräfix des aufgerufenen Links. Ein Einstieg von der deutschen Homepage unter `/de/dashboard` zeigte daher deutsche Trainerseiten trotz gespeichertem Englisch; deren deutsche Sprachsperre griff.

Die Session-Middleware liest für authentifizierte GET-/HEAD-Aufrufe die Sprache des eigenen Profils mit dem bestehenden Cookie-Client. Lernraum- und Admin-URLs werden temporär auf diese Sprache umgeleitet; Unterpfad und Query bleiben erhalten. Auch ein bereits angemeldeter Besuch von Login/Registrierung führt zum Dashboard in der Profilsprache. Session-Cookies und Cache-Header werden bei Weiterleitungen übernommen; personalisierte Antworten sind `private, no-store`.

POST-Actions werden durch diese neue Sprachkorrektur nicht umgeleitet: Der vorhandene Sprachumschalter kann zunächst die neue Einstellung speichern und anschließend die richtige Seite öffnen. Öffentliche Webseiten behalten ihre URL-Sprache. Ohne bestehende Sitzung bleibt die Webseitensprache die Vorgabe der Erstregistrierung. Fehlende/ungültige Profilwerte erzeugen keine erfundene Präferenz; ein Datenbankfehler beim Lesen führt ausdrücklich zum Fehler statt zu einer stillen falschen Sprache.

Keine Schemaänderung oder Datenmigration, keine Änderung an Profilen, Lernständen, Trainerberechtigungen, Ressourcenlimits oder externen Laufzeitdiensten. R1–R11 berücksichtigt; Backup/Dump/Rollback-SQL entfallen für diese reine Anwendungskorrektur. Ein Rückwechsel der Anwendung benötigt keine Datenwiederherstellung.

## Prüfung

- **84/84 Tests** in sieben Suites: neue Middleware-Regression, Session-Cookies, Locale-Routing, Auth-Callbacks, Auth-Rate-Limit, Auth-Lokalisierung und Header-Sprachumschalter. Alle fünf Profilsprachen, Homepage-Rückkehr, Deep Links, Query-Erhalt, Staff-Routen, Erstregistrierung, bewusster Sprachwechsel und Lookup-Fehler abgedeckt. Die Middleware-Regressionsfälle verwenden kontrollierte Auth-/Profilantworten.
- `tsc --noEmit --incremental false` und Produktionsbuild auf dem VPS bestanden.
- Aktives Release `a69823451b24`; App, Mail und Nginx aktiv; `/api/health` liefert `ready`. Öffentliche deutsche Homepage: HTTP 200; anonymer Lernraum-Aufruf: HTTP 307 zur deutschen Anmeldung.
- Kein Login im persönlichen Browser des Nutzers und keine produktiven Testkonten angelegt.

Referenz für SSR-Cookies und Weiterleitungen: [Supabase-Dokumentation](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs).
