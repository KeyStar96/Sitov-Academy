# Sitov Academy — begrenzte Verbkataloglesung

Die tatsächlichen UK/TR-Aufrufe brechen im Verbkatalog mit SQLSTATE 57014 ab; beide Rollen haben unverändert acht Sekunden statement_timeout. Der Server las bisher alle 960 Datenbankverben, obwohl A1.1 nur den kumulativen A1.1-Katalog verwendet. Die Cookie-/RLS-geschützte Abfrage wird jetzt vor der Pagination auf die Niveaus genau dieses bereits verwendeten statischen Katalogs eingeschränkt. Frühere Verben bleiben bei höheren Niveaus enthalten; Lernkasten, Fortschritt, Berechtigungen und die endgültige Schnittmenge mit dem real lesbaren Katalog bleiben erhalten.

17 gezielte Server-/Actiontests, vollständiger TypeScript-Check und scoped ESLint bestanden. Der neue Test prüft die tatsächliche Filterabfrage und erhaltene eigene Historienlesungen; Browserabnahme steht aus.

Schreibgeschützte Messung mit einem ursprünglichen M-Staff-Konto unter authenticated: get_last_active_level ca. 0,10s und get_learning_new_items ca. 0,09s; unbeschränkter Katalog 960 Zeilen ca. 3,7s. JIT an/aus ergibt gleiche Antwort-SHA256 und keine Verbesserung. Das widerlegt die JIT-Hypothese für diesen Staff-Fall; ein Schüler-/HTTP-Nachweis wird damit nicht behauptet. Keine globale Einstellung, Timeout oder Datenbankfunktion geändert.
