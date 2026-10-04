# Sitov Academy Monatsauswahl und Kursbedingungen

Stand: 3. Oktober 2026. Die Monatsauswahl bleibt ein verbindlicher Buchungsablauf für bereits bestätigte Kursteilnehmer. Sie liefert dem Lehrer die Grundlage für Prüfung und Rechnungsstellung. Ein bloß unverbindlicher Planungswunsch würde einen gesonderten Ablauf für Angebot, Annahme und Rechnungsstellung benötigen.

## Preis und Bestätigung

Die bestehende Anwendung speichert die Auswahl als bepreiste Monatsbuchung. Die Bestätigung durch Sitov Academy kann einen Vertrag begründen. Die Umsetzung behandelt die Auswahl deshalb vorsorglich als zahlungspflichtige Bestellung: Direkt vor „Zahlungspflichtig buchen“ stehen die ausgewählten Kurse, der Unterrichtsmonat, Einheitspreise und Dauer, der voraussichtliche Gesamtpreis sowie die Fortsetzungs- und Kündigungsbedingungen. Pausen bleiben ohne neue Kursgebühr.

Diese Einordnung folgt aus dem vorhandenen Buchungs- und Bestätigungsablauf. Eine bestätigte Erstregistrierung allein nimmt eine spätere zahlungspflichtige Kursauswahl nicht von den Anforderungen des [§ 312j BGB](https://www.gesetze-im-internet.de/bgb/__312j.html) aus. Die Preis-, Laufzeit- und Kündigungsinformationen beruhen auf [Art. 246a § 1 EGBGB](https://www.gesetze-im-internet.de/bgbeg/art_246a__1.html).

Der voraussichtliche Preis wird anhand der aktuell geplanten Termine, ihrer Dauer und der Kursraten berechnet. Bekannte kursbezogene und allgemeine Ausfälle werden jeweils einmal abgezogen. Weitere Absagen durch Sitov Academy reduzieren die Rechnung; bestehende Rechnungen werden weiterhin durch den vorhandenen Korrekturablauf berichtigt. Die Umbenennung ersetzt weder die Angabe des berechenbaren Preises noch die Zustimmung zur Zahlungspflicht.

## Unterrichtsmonat und Vertragsfortsetzung

Eine Monatsbuchung gewährt Teilnahme an den vereinbarten Terminen des betreffenden Kalendermonats. Die angezeigte Zahl der Unterrichtseinheiten erklärt dessen Preisberechnung. Sie ist kein frei abrufbares oder übertragbares Stundenkonto. Individuelle Unterrichtstermine werden innerhalb des gebuchten Monats vereinbart; gesonderte Absprachen bleiben möglich.

Bei selbst versäumten Terminen gibt es keinen automatischen Übertragungs- oder Nachholanspruch. Etwaige Zahlungsansprüche beachten die Anrechnung ersparter Aufwendungen und anderweitigen Erwerbs nach [§ 615 BGB](https://www.gesetze-im-internet.de/bgb/__615.html). Gesetzliche Rechte bei ausgefallenem Unterricht bleiben erhalten; insbesondere ist [§ 326 BGB](https://www.gesetze-im-internet.de/bgb/__326.html) zu beachten.

Die neuen AGB beschreiben die Vertragsfortsetzung nach dem ersten Unterrichtsmonat auf unbestimmte Zeit mit monatlicher Abrechnung und Kündigung zum Ende des laufenden Abrechnungsmonats. Das ersetzt die frühere Formulierung wiederholter fester Monatsverlängerungen und berücksichtigt [§ 309 Nr. 9 BGB](https://www.gesetze-im-internet.de/bgb/__309.html). Die bisherige günstigere Regel zur Kündigung durch Nichtzahlung einer Folgerechnung bleibt erhalten. Die Teilnahme an einzelnen Monatsterminen und die Laufzeit des übergeordneten Kursvertrags sind getrennt beschrieben.

AGB-Änderungen gelten nicht automatisch für bestehende Verträge. Bereits gespeicherte Anmeldungen, Zustimmungen, Fortschritte und Identitäten werden durch diese Änderung nicht umgeschrieben.

## Zugang und technische Prüfung

Die Monatsauswahl verlangt eine eindeutig zugeordnete, verifizierte Person mit einer durch die Schule bestätigten Buchung der Art `registration`. Nach einer Änderung oder Pause des ersten Buchungsmonats belegt das erhaltene `confirmed_at` die vorherige Bestätigung; dadurch bleibt die erneute Bearbeitung möglich. Abgelehnte Registrierungen bleiben gesperrt. Ein Lernkonto, eine Probestunde, eine nie bestätigte Erstregistrierung oder eine frühere Buchung nur der Art `monthly` genügt nicht. Mehrdeutige Familienzuordnungen bleiben gesperrt, bis die Schule sie klärt. Der bestehende Kalender zeigt weiterhin die dem Nutzer gehörenden gebuchten Termine.

Der Zugang wird in der Oberfläche, der Server Action und der bestehenden atomaren Datenbankfunktion geprüft. Die Migration `20261003184422_sitov_confirmed_registration_monthly_access.sql` verändert die Funktion ohne bestehende Buchungsdaten zu löschen. Sie wurde ausschließlich auf einer isolierten lokalen PostgreSQL-Instanz getestet; sie ist noch nicht auf dem produktiven Server ausgeführt.

Für den bestehenden VPS-Migrationsablauf liegt dieselbe SQL-Datei als `supabase/vps/68_sitov_confirmed_registration_monthly_access.sql` vor und ist in `deploy/vps/migrate-local.py` registriert. Der lokale Datenbanktest prüft die identischen Inhalte, führt die VPS-Datei innerhalb der äußeren Runner-Transaktion aus und prüft anschließend die wiederholte Anwendung.

Geprüft wurden die bestätigte Eigentümerzuordnung, Sperren für Konten ohne Anmeldung und für Probestunden, offene Anmeldungen und reine Monatsbuchungen, mehrdeutige Identitäten, kostenlose Pausen, unveränderte Quelldatensätze, Preisberechnung samt Ausfällen, fünf Sprachfassungen sowie Preisübersicht und abschließende Bestätigung.

## Kursanmeldung aus einem offenen Lernkonto

Der Link „Kursanmeldung“ im gesperrten Monatsplan öffnet `/{lang}/registration` als vollständigen Dokumentwechsel. Damit startet das Anmeldeformular mit einem frischen Browser-Dokument, auch wenn der offene Kalender ein vorheriges Deployment überlebt hat. Die Anmeldung schreibt erst bei der ausdrücklichen Bestätigung; dieser Seitenwechsel legt keine Buchung an und verändert die vorhandene Monatsplanung nicht.

Jedes VPS-Release setzt `SITOV_DEPLOYMENT_ID` beim Build auf seine vollständige Git-Revision. `next.config.ts` gibt diesen Wert als `deploymentId` an Next weiter. Die gesonderte, nicht geheime `.sitov-runtime.env` im Release liefert systemd dieselbe ID für `next start`; sie gehört zur geprüften Artefaktliste. Das optionale `EnvironmentFile` lässt ältere Releases ohne diese Datei beim Rollback startbar. Lokale Entwicklung und Builds ohne Release-ID behalten die normale Next-Konfiguration.

Next erkennt damit bei späteren Deployments Versionsunterschiede zwischen Browser und Server und lädt das Dokument vollständig neu, statt inkompatible Seitendaten oder Assets zu kombinieren. Die manuelle Safari-Reproduktion am 4. Oktober 2026 zeigte den Kalender-Link in der Fehlergrenze und eine funktionierende Anmeldung nach vollständigem Neuladen. Ein Versionskonflikt ist aus diesem Vergleich abgeleitet; ein ursprünglicher JavaScript-Stack lag nicht vor. Der Dokumentwechsel am konkreten Link beseitigt die fehleranfällige Wiederverwendung unabhängig von dieser Diagnose.

Der Nachtrag ist mit Release `09452efafb1a` seit dem 4. Oktober 2026 um 17:02 Uhr CEST produktiv. Build und Runtime tragen die identische volle Git-Revision; der öffentliche Anmeldekatalog zeigt neun Kurse ohne Browserfehler. Der Linkvertrag ist in allen fünf Sprachen geprüft. Die erneute Navigation aus der angemeldeten Safari-Sitzung blieb während paralleler Browserbenutzung ungeprüft; es wurden keine Registrierungen oder Buchungen zum Testen abgeschickt.
