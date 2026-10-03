# Sitov Academy: Lernfortschritt und Gerätewechsel

Der Account ist die Quelle für bestätigten Lernfortschritt. Browser-Speicher enthält nur Einstellungen (Design, Tempo, Eingabeart, gewünschte Rundengröße) und kurzlebige Signale zwischen Tabs. Er ist kein Speicher für Bewertungen oder Wiedereinstieg.

| Lernbereich | Bestätigter Fortschritt | Wiedereinstieg |
| --- | --- | --- |
| Vokabeln | Richtungsbezogene Lernbox, Fälligkeiten, Bewertungen und Antwortquittungen in PostgreSQL | Account-Checkpoint mit Kartenreihenfolge, Runde, Position, Feedback und Wiederholungen; offene Antwortabsicht wird mit derselben Quittung erneut gesendet |
| Problemwörter | Eigene Problemwörter, Trainingsstufe und Antwortquittungen | Eigene Account-Runde mit Position und Wiederholungen |
| Lernpfad und Tests | Eigene Übungsdurchläufe, Warteschlangen, Antworten, Abschlüsse und Testergebnisse | Neuster noch zugänglicher aktiver Durchlauf öffnet sich; gespeicherte Testantworten sind unveränderlich und identisch wiederholbar |
| Ältere Grammatikübungen | Bewertung und Account-Checkpoint werden gemeinsam in einer Transaktion gespeichert | Themen-/Wiederholungsrunde mit ausgewählten Übungen und Position; private Quittung verhindert doppelte Bewertung nach Verbindungsabbruch |
| Aussprache | Private Aufnahmen, Nachrichten, Rückmeldungen und Gelesen-Quittungen | Ausgewählter Lesetext, Anhören-Status und Position der Referenzaufnahme im Account |
| Eigene Videos | Medienaufrufe und private Account-Checkpoints | Wiedergabeposition, Dauer und „Weiterschauen“; Speichern regelmäßig und bei Pause, Springen, Ende oder Schließen |
| Daily Journey | Tageszuordnung, bestätigte Stationen, Abschluss und Serie im Account | Erste unbestätigte Station des aktuellen Tages; später machen verändert die Zuordnung nicht |
| Home und Navigation | Letzter Lernbereich aus eigenen Lernhandlungen und Checkpoints | Gleicher Lernbereich auf einem anderen Gerät; bei Abfragefehlern kein fremder Browser-Fallback |

`61_account_learning_checkpoints.sql` speichert UI-Zustand unter `(auth_user_id, kind, level)`. Jede Mutation ermittelt die Identität aus Auth, prüft Freigaben und erwartet die zuletzt geladene Revision. Veraltete Geräte erhalten einen Konflikt statt den neueren Stand zu überschreiben. UI-Zustand kann keine Bewertung, Freigabe oder Lösung erzeugen. Inhalt wird beim Wiederherstellen aus dem weiterhin zugänglichen Katalog geladen.

Zurücksetzen erzeugt auch für noch nie gespeicherte Bereiche leere Checkpoints mit höherer Revision. Alte Tabs können dadurch keine Runde wiederherstellen. Private Grammatikquittungen werden ebenfalls entfernt. Fehlgeschlagene Speichervorgänge werden angezeigt und sind wiederholbar; die Oberfläche meldet sie nicht als gespeicherten Fortschritt.

Noch nicht abgeschickte Texte und Mikrofonaufnahmen sind ungespeicherte Entwürfe. Externe Links öffnen den jeweiligen Anbieter; dessen eigener Wiedergabestand gehört nicht zum Player der Sitov Academy. Die früheren lokalen Videopositionen waren keinem Benutzer zugeordnet und werden nicht einem möglicherweise anderen Account zugeschrieben.

Prüfungen: getrennte Geräte-/Sitzungsinstanzen, verlorene Antworten nach erfolgreichem Commit, fehlgeschlagene Speicherung, aktuelle Inhaltsfreigaben, fremde Accounts, parallele Geräte und Zurücksetzen. Datenbankmigrationen werden wiederholt auf PostgreSQL ausgeführt und bestehende Lernstände vor und nach der Migration verglichen.
