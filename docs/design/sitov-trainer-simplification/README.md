# Sitov Academy Trainer-Vereinfachung

Stand: 8. Oktober 2026. Vokabel- und Verbtrainer zeigen weniger begleitenden Text, eine kompakte gemeinsame Lernbox und einen früh erreichbaren Start. Dauerhafte Vorlieben stehen unter Profil → Trainer. Deutsche Lerninhalte, gespeicherte Antworten, Fortschritte, Aufnahmen und Aufgabenkennungen bleiben unverändert.

## Geprüfte Schritte

1. **Vokabelübersicht – vereinfacht.** Die [Vorher-Ansicht](01-before.jpg) zeigt wiederholte Zähler und eine umfangreiche Rundenplanung vor dem Start. Die [neue Ansicht](09-learner-view.jpg) zeigt eine klare Startaktion, sieben kompakte Papierfächer und Hilfe auf Abruf. Rundengröße und Antwortweg stehen im Profil.
2. **Schmales Handy – bedienbar.** [320 px](03-mobile-320-light.jpg), [mobile Dunkelansicht](02-after-mobile-dark.jpg) und [Desktop](05-desktop-light.jpg) sind betrachtet. Kein horizontaler Seitenlauf bei 320 und 1440 px; schmale Fachnamen werden durch die Dreierreihen vollständig lesbar. Buttons bleiben mindestens 48 px hoch. [Hoher Kontrast](06-desktop-high-contrast.jpg) besitzt klare Umrisse und Beschriftungen.
3. **Profil → Trainer – funktional.** [Die Einstellungsansicht](04-profile-settings.jpg) übernimmt bestehende Werte. 50 Karten, Ausschreiben und 1,25× wurden gewählt und nach Neuladen bestätigt; anschließend wurden die Ausgangswerte 20, Aufdecken und Automatisch wiederhergestellt. Die Radios funktionieren per Tastatur. Der Hash öffnet den Bereich nach der Hydration.
4. **Fachansichten – zugänglich.** Vokabel- und Verbfach öffnen per Enter; Escape gibt den Fokus an das ursprüngliche Fach zurück. Die Vokabelvorschau enthält keine echten Lernenden und liefert deshalb eine leere Fachliste. Die [Verbansicht](08-verb-inspector.jpg) zeigt Beispieldaten mit getrennten Zeitformständen und deutschem Inhaltsbereich.
5. **Verbtrainer – kompakt.** [Die gemeinsame Lernbox](07-verb-box.jpg) behält die unabhängigen Verbfortschritte und Fachaktionen. Wiederholte Intro-, Start- und Übertragungsbeschreibungen entfallen. Die adaptive Runde, gezielte Zeitformauswahl und Verbauswahl bleiben bedienbar.
6. **Bewegung – zweckgebunden.** Vorhandene Papierstapel und Druckfeedback bleiben erhalten. Außerhalb des Viewports meldet die Motion-Stage `data-sitov-live="false"`; die CSS-Loops pausieren. Gemeinsame Reduced-Motion-Logik und Listener-Aufräumen sind durch die bestehenden Tests und Codeprüfung abgedeckt. Systemweite reduzierte Bewegung wurde in dieser Browserabnahme nicht umgestellt.

## Prüfung und Grenzen

138 Tests in 12 Suites bestanden: Sitzungen, Bewertung, Runden, Lernbox, Präferenzen, Audio, Verben und Motion-Stage. Auch wiederhergestelltes Antwortfeedback behält seinen Antwortweg bei einer Profiländerung. TypeScript ist fehlerfrei. Gezieltes ESLint meldet keine Fehler und sechs vorbestehende Warnungen in `VocabCardSession` und `PhaseInspector`. Der Produktionsbuild und die Aktivierung werden im Obsidian-Releasebericht dokumentiert.

Die Screenshots stammen aus den lokalen Entwicklungsvorschauen mit Beispieldaten. Keine realen Schülerkonten, Antworten oder Buchungen wurden für die Abnahme verändert. Die Tastatur- und Layoutprüfungen ersetzen keine umfassende Barrierefreiheitsprüfung. Alle neuen Profiltexte sind für de/en/ru/uk/tr getestet.

Die unabhängige [VPS-Bestandsprüfung](../../reports/sitov-learning-path-vps-audit-2026-10-08.md) bestätigt sämtliche zehn Lernpfad-Seeds. Sie hält außerdem die offene Lücke von 235 Satzbau-Aufnahmen fest. Diese UI-Änderung veröffentlicht keine neuen deutschen Lerninhalte und nimmt keine Datenbankmigration vor.
