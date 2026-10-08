# Sitov Academy: einheitliche Trainerwidgets

Abnahme am 8. Oktober 2026. Vokabeltrainer, Verbtrainer, Lernpfad und Mediathek teilen `SitovTrainerHero`: kurze Überschrift, Niveau, reservierte Motion-Grafik und native Hauptaktion. Die Mediathek hat im Widget keine Aktion. Die Trainer behalten ihre bisherigen Lernregeln, gespeicherten Einstellungen und serverseitigen Rechte.

## Verhalten

- Vokabeln: „Jetzt üben“ startet den vorhandenen sicheren Session-Ablauf mit der im Profil gespeicherten Rundengröße. Leerzustand und vollständig erledigte Wiederholungen führen zu den Lektionen.
- Verben: „Start practising“ bzw. die lokalisierte Beschriftung startet direkt die nächste Runde. Während der Übung bleibt der Kopf kompakt; eine leere Lernbox führt zur Verbauswahl.
- Lernpfad: „Weiterlernen“ priorisiert den verfügbaren gespeicherten Checkpoint, auch für aktive Tests oder Extras. Ohne Checkpoint ist die erste verfügbare offene Station das Ziel. Gesperrte oder unbekannte Checkpoints fallen darauf zurück; ein abgeschlossenes Niveau ohne Fortsetzung zeigt keinen Startbutton.
- Mediathek: ruhige Video-/Dokumentszene ohne Hero-Button. Medienauswahl, Weitersehen, geschützte Links und Spieler bleiben unverändert.

## Nachweise

Alle Bilder stammen aus lokalen Entwicklungsvorschauen mit synthetischen Daten. Die Vorschauen sind in Produktion gesperrt. Die vier vom Nutzer gelieferten echten Screenshots wurden nicht als Repository-Assets übernommen.

| Ansicht | Bild |
| --- | --- |
| Vokabeln, Desktop hell | [Vollansicht](vocabulary-desktop-light.jpg) · [Widget und Lernbox](vocabulary-desktop-widget.jpg) |
| Vokabeln, Handy | [Hell](vocabulary-mobile.jpg) · [Dunkel](vocabulary-mobile-dark.jpg) |
| Vokabeln, leer | [Handy hell](vocabulary-empty-mobile.jpg) |
| Vokabeln, 320 px ukrainisch | [Schmale Ansicht](vocabulary-narrow-uk.jpg) |
| Verbtrainer | [Handy dunkel](verbs-mobile-dark.jpg) |
| Lernpfad | [Handy dunkel](path-mobile-dark.jpg) |
| Mediathek | [Desktop hell](media-desktop-light.jpg) · [Handy dunkel](media-mobile-dark.jpg) |
| Mediathek, 320 px russisch | [Hoher Kontrast](media-narrow-high-contrast.jpg) |

106 Tests in neun Jest-Suites bestanden: gemeinsame Heroes, Checkpoint-Fortsetzung, Lernpfad-UI, Vokabelauswahl und Übernahme, Verbtrainer, Medienlinks, Video-Checkpoint und Motion-Stage. `tsc --noEmit --incremental false` und ESLint auf allen bearbeiteten TypeScript-Dateien ohne Fehler oder Warnungen. `git diff --check` ohne Fehler.

Browserabnahme über die Codex-Browsersteuerung: 320/390/1440 px, Hell/Dunkel, hoher Kontrast, deutsche/englische/russische/ukrainische Ansichten, keine horizontale Überbreite bei 320 px, native Mediathek ohne Button, richtiger Leerzustandslink, Verbstart per Enter mit Fokus im Antwortfeld und tatsächliche Motion-Pause außerhalb des Viewports. Alle fünf Interface-Sprachen sind zusätzlich in den Komponententests geprüft. Reduzierte Bewegung und verborgenes Dokument sind im gemeinsamen Motion-Vertrag und CSS abgesichert; die Betriebssystempräferenz wurde in dieser Browserabnahme nicht umgestellt.

Keine authentifizierte Live-Schülersitzung; die Browserabnahme verwendet lokale Beispieldaten und die Integrationstests gemockte Serveraktionen. Der zugehörige Produktions- und Healthnachweis wird in Obsidian-Notiz 39 dokumentiert. Diese reine UI-Änderung importiert keine Inhalte oder Audios; die 235 fehlenden Satzbau-Aufnahmen aus dem Seed-Audit bleiben separat in Notiz 38 nachverfolgt.
