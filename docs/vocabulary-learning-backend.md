# Vokabellernen: Datenmodell und Prüfungen

Vorbereitung am 10. September 2026 für Projekt `wcaslabeiwtvygxtzcio`. Die Live-Prüfung ergab 512 Karten und 195 bestehende Fortschrittszeilen; `lapses` enthält keine NULL-Werte. Ausführung und Live-Ergebnis werden im Deployment-Protokoll dokumentiert.

Migrationen in dieser Reihenfolge:

1. `supabase/migrations/20260910133125_vocabulary_bidirectional_learning.sql`
2. `supabase/migrations/20260910135831_vocabulary_context_content.sql`

`user_vocabulary_progress` und seine API-Berechtigungen bleiben unverändert nutzbar. `vocabulary_direction_progress` kopiert sämtliche bisherigen Zeilen einschließlich IDs, Zeitstempeln, Phasen und Fehlversuchen als `de_to_native`. Die zusätzliche Richtung `native_to_de` startet unabhängig in Phase 1 und ist sofort fällig. Der Kompatibilitätstrigger übernimmt spätere Änderungen alter Clients nur in die Vorwärtsrichtung. Neue Vorwärtsantworten aktualisieren den alten Fortschritt atomar; der Trigger löst keine Rekursion aus. Ein bewusstes Zurücksetzen durch den Nutzer entfernt beide Richtungen derselben Wörter.

Die Einstufungsprozedur erzeugt beide Richtungen in einer Transaktion: bekannt → Phase 6 mit 90 Tagen Intervall, unbekannt → Phase 1, sofort fällig. Wiederholungen überschreiben keine vorhandenen Richtungen. Das Überspringen wählt die erste tatsächlich vorhandene Lektion numerisch im angeforderten Niveau, startet fehlende Wörter und persistiert den Status `skipped`. Ein fehlendes oder nicht freigegebenes Niveau führt zu keiner Änderung.

Der Scheduler gruppiert nach Wort-ID und lässt zwischen zwei Richtungen immer mindestens ein anderes Wort. Nicht platzierbare Karten bleiben unverändert fällig; auch bei einem einzelnen Wort wird keine Ausnahme gemacht. Der persistierte zuletzt beantwortete Begriff wird aus vorhandenen Antwortdaten übernommen und nach jeder Antwort aktualisiert. Die Datenbank serialisiert Antworten pro Nutzer und verweigert unmittelbar folgende Antworten desselben Worts sowie nicht fällige Wiederholungen. Die UI muss nach jedem Lektionsfilter mit `previousCardId` erneut planen.

Satzübungen verwenden die Rückwärtsrichtung einer ausdrücklich freigegebenen Karte. `sentence_practice=true` setzt nichtleere Beispiele in allen fünf Sprachen voraus. Der Server sendet das passende Beispiel in der UI-Sprache, ohne die deutsche Satzlösung im Kontextfeld. PostgreSQL vergleicht die Eingabe bytegenau mit dem gespeicherten deutschen Satz: Großschreibung, Leerzeichen, Umlaute und Satzzeichen bleiben relevant. Ein vom Client übermitteltes `isCorrect` hat bei Satzübungen keine Wirkung. Die Lösung wird erst nach dem Absenden zurückgegeben. Wörter ohne Satzfreigabe behalten die bisherige Selbsteinschätzung.

Die neuen Tabellen haben RLS und ausschließlich eigenen Lesezugriff für authentifizierte Nutzer. Direkte API-Schreibrechte sind entzogen. Öffentliche RPCs laufen als `SECURITY INVOKER`; die privaten Schreibprozeduren prüfen `auth.uid()` und die explizite Niveau- oder Lehrer/Admin-Freigabe. Neue Fortschritte anderer Nutzer sind nicht lesbar. API-Abfragen paginieren Richtungsfortschritte, damit mehr als 1.000 Zeilen nicht stillschweigend abgeschnitten werden. Ein Wort zählt erst als gelernt, wenn beide Richtungen gelernt sind.

Die Inhaltsmigration ergänzt 496 redaktionell formulierte Alltagsbeispiele für die 512 vorhandenen Datensätze. 24 Wörter besitzen geprüfte Satzvarianten in allen fünf Sprachen. Bestehende redaktionelle Texte werden nie ersetzt; bei abweichendem deutschem Satz oder anderer vorhandener Übersetzung wird keine Satzübung freigeschaltet. Eine statistisch häufigste Verwendung wird nicht behauptet.

Prüfung: `node --test supabase/tests/vocabulary-learning.test.mjs` startet isoliertes PostgreSQL über PGlite. Die Suite prüft Datenbewahrung, Legacy-Kompatibilität, Erststart/Skip, RLS einschließlich Rollen/anon, exakte Satzbewertung, Manipulationsversuche, Abstand über mehrere RPC-Aufrufe, Doppelantworten und atomaren Rollback. Die Tests schreiben keine Testdaten in die Produktionsdatenbank.
