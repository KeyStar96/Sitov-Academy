# Sitov Academy: Layout-Abgleich der Trainer

Stand: 8. Oktober 2026. Vokabel- und Verbtrainer verwenden die gleiche Anordnung ihrer Übungsübersicht: obere Navigation, Einstiegswidget mit nativer Hauptaktion, Lernbox mit zunächst geschlossener Hilfe und dezenter Link zu den Trainer-Einstellungen im Profil.

## Verhalten

- Die drei Navigationspositionen bedeuten Üben, Inhaltsauswahl und Fokus. Vokabeln zeigen Lernbox, Lektionen und Problemwörter; Verben Mein Training, Mein Verbkasten und Gezielt trainieren. `SitovTrainerTabs` liefert für beide dieselben Maße, Druckreaktion und gleitende Auswahl.
- Der Startbutton liegt einmal im `SitovTrainerHero`. Automatisches Verbtraining zeigt die verfügbaren Zeitformen als Chips. Beim Fokus liegen die auswählbaren Zeitformen unmittelbar über dem Startbutton; dieser startet die aktuelle Auswahl und bleibt ohne Zeitform deaktiviert.
- Leere Boxen führen zur jeweiligen Inhaltsauswahl. Die Lernbox trägt keinen zusätzlichen Auswahlbutton. Die Verbliste ist eine eigene Ansicht ohne doppelte Hero-/Lernbox-Flächen.
- Beide Lernboxen verwenden `SitovTrainerHelp`. Die gleiche zunächst geschlossene Hilfe öffnet die jeweils eigenen fachlichen Regeln. Beim Schließen entfallen Fokus und Zugriff auf das Panel sofort; reduzierte Bewegung zeigt den Zustandswechsel unmittelbar.
- Die Fachverteilung folgt der Boxbreite: bis 380 px in 3+3 mit dem gelernten Fach darunter, bis 720 px in 4+3, darüber in einer Reihe. Bei 390 px Viewport ist die eingebettete Box bereits schmal genug für 3+3.
- Auswahl, Serverrechte, gespeicherter Fortschritt, Wiederholungsregeln, Einstufung und Checkpoints behalten ihren bestehenden Vertrag. Diese Änderung benötigt weder Inhalts- oder Audioimporte noch eine Datenbankmigration.

## Lokale Abnahme

Die Vergleichsbilder in diesem Verzeichnis stammen aus den Entwicklungsvorschauen `/{lang}/sitov-preview/motion` und `/{lang}/sitov-preview/verbs`. Sie enthalten synthetische Beispieldaten. Diese Routen sind ausschließlich in Entwicklung verfügbar; die Bilder belegen keine authentifizierte Live-Schülersitzung.

Die Browserabnahme prüft die Reihenfolge der Flächen, Position der Hauptaktion, leere und gefüllte Boxen, Fokusauswahl sowie die Inhaltsverwaltung. Hell, Dunkel und hoher Kontrast werden auf schmalem Handy und Desktop betrachtet. Tastatur, Auswahlzustände und das Schließen der Hilfe bleiben bedienbar. Die bestehenden Übungs- und Fortschrittsverträge werden zusätzlich durch gezielte Komponententests abgesichert.

| Vergleichsbild | Datei |
| --- | --- |
| Vokabeltrainer, Handy dunkel | [Ansicht](vocabulary-mobile-dark.jpg) |
| Vokabeltrainer, leere Box | [Handy dunkel](vocabulary-empty-mobile-dark.jpg) |
| Vokabeltrainer, geöffnete Hilfe | [Handy dunkel](vocabulary-help-mobile-dark.jpg) |
| Verbtrainer, Handy dunkel | [Ansicht](verbs-mobile-dark.jpg) |
| Verbtrainer, Fokusauswahl | [Handy dunkel](verbs-focus-mobile-dark.jpg) |
| Verbtrainer, Inhaltsauswahl | [Handy dunkel, Suchfilter](verbs-selection-mobile-dark.jpg) |
| Verbtrainer, leere Box | [Handy dunkel](verbs-empty-mobile-dark.jpg) |
| Gleicher Aufbau, Desktop hell | [Vokabeln](vocabulary-layout.jpg) · [Verben](verbs-layout.jpg) |
| Desktop mit Vorschaukontext | [Vokabeln](vocabulary-desktop-light.jpg) · [Verben](verbs-desktop-light.jpg) |
| 320 px, russische Oberfläche | [Vokabeln](vocabulary-mobile-320-ru.jpg) · [Verben](verbs-mobile-320-ru.jpg) |
| Hoher Kontrast, Desktop | [Vokabeln](vocabulary-desktop-high-contrast.jpg) · [Verben](verbs-desktop-high-contrast.jpg) |

**173 Tests in zwölf gezielten Jest-Suites bestanden**, vollständige TypeScript-Prüfung ohne Fehler, ESLint auf allen bearbeiteten und neuen TypeScript-Dateien ohne Fehler oder Warnungen. `git diff --check` ist sauber. Der Testumfang umfasst Tabs, gemeinsame Hilfe, Fokusauswahl einschließlich leerer Auswahl, Fachfilter und Reset, Serverzustände, Vokabel-Sessions, Lernpfad-Fortsetzung und Motion-Lifecycle.

Browserprüfung bei 320/390/1440 px, de/en/ru, Hell/Dunkel und hohem Kontrast; kein horizontaler Seitenlauf bei 320 px. Eine per Enter gestartete Fokusrunde mit ausschließlich Perfekt zeigt eine Perfektaufgabe und setzt den Fokus ins Antwortfeld. Die Betriebssystempräferenz für reduzierte Bewegung wurde nicht umgestellt; deren Vertrag ist durch die gemeinsamen Tests und CSS-Regeln abgesichert.

Commit, Aktivierungszeit, begrenzter VPS-Build und anschließende Health-/Releaseprüfung werden im Obsidian-Projekt unter `40_Trainer_Layout_Abgleich_2026-10-08` einschließlich strukturiertem Deployment-Nachweis dokumentiert.

Die Gestaltungsvorgaben stehen in den [gemeinsamen Trainerregeln](../sitov-trainer-design.md#gleicher-aufbau-für-vokabeln-und-verben) und im [Motion-Vertrag](../sitov-motion-design.md#gemeinsame-navigation-und-hilfe-im-trainer). Die [vorherige Widget-Abnahme](../sitov-trainer-heroes/README.md) dokumentiert den gemeinsamen Hero von Vokabeln, Verben, Lernpfad und Mediathek.
