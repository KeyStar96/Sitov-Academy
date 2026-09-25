# Phase 1 — R15-Audit und Registrierung

Stand: 2026-09-25. Grundlage vor Änderungen: [initialer Prüfbericht](PHASE-1-PRUEFBERICHT.md), CODEX-Regeln und ausschließlich Phase 1. Die lokalen Next.js-16.3.5-Dokumente zu Client-Komponenten und Links wurden vor den Änderungen gelesen. Für den Bestätigungs-Redirect wurden zusätzlich Supabase-Skill, offizieller Changelog und SSR-Dokumentation geprüft; Verifizierung, Session und Berechtigungen bleiben im bestehenden Serverpfad.

## 1.1 — Aktionsreihenfolge

Audit: JSX-Aktionen unter `components/` und `app/` mit `rg` erfasst, zusammengehörige Aktionsgruppen manuell auf Primär-/Sekundärrolle und DOM-Reihenfolge geprüft. CSS-Umkehrungen der Reihenfolge sind für die korrigierten Gruppen nicht vorhanden. Gleichwertige Auswahlmöglichkeiten, Sprach-/Modus-Tabs und alleinstehende Aktionen werden nicht künstlich als positives/negatives Knopfpaar behandelt.

| Stelle | Gefunden | Ergebnis |
|---|---|---|
| `VocabCardSession` | Wusste ich vor Wusste ich nicht | Negativ links, positiv gefüllt rechts; durch Hauptarbeit geändert und getestet |
| `LessonAssessmentClient` | Kenne ich bereits vor Kenne ich nicht, gegenteiliger Kommentar | Lernbox links/sekundär, bekannt rechts/gefüllt; Kommentar korrigiert |
| `RoundBreak` | Weiter oberhalb Pause | Pause oben, Weiter gefüllt unten |
| `LessonCardsModal` | Zurücksetzen vor Abbrechen | Abbrechen links, explizite rote Bestätigung rechts |
| `LevelPath`, Startauswahl | Hervorgehobene Einstufung zuerst | Alternative oben, primäre Einstufung unten |
| `LevelPath`, Stationsblatt | Starten/Üben vor Wörter ansehen | Nachrangige Aktionen oben, Starten/Üben unten |
| `ProfileMonthlyCourses`, Monatsentscheidung | Weiterlernen oberhalb Pause | Pause oben, Weiterlernen unten |
| `PronunciationCMS`, Editor | Speichern vor Abbrechen | Abbrechen links, Speichern rechts |
| `ExerciseCMS`, Löschen | Bestätigen vor Abbrechen | Abbrechen links, Bestätigen rechts |
| `ExerciseCMS`, Zeilenaktionen | Bearbeiten vor Entfernen | Entfernen links, Bearbeiten rechts |
| `VocabCMS`, Zeilenaktionen und Löschbestätigung | Bearbeiten/Löschen und Bestätigen/Abbrechen | Entfernen links, Bearbeiten rechts; Abbrechen vor Bestätigen (mit Varianten-CMS umgesetzt) |
| `RegistrationDesk`, offene Anmeldung | Annehmen vor Ablehnen | Ablehnen links, Annehmen gefüllt rechts |
| `MediaLinkForm` | Speichern vor Abbrechen | Abbrechen links, Speichern rechts |
| `MediaLinkCard` | Bearbeiten vor Entfernen | Entfernen vor Bearbeiten; rechtsdrückendes `ml-auto` am Entfernen entfernt |
| `MediaFolderCMS` | Speichern vor Neu | Neu links, Speichern rechts |
| `MediaUpload` | Starten vor Pausieren | Pausieren links, Starten/Fortsetzen rechts |
| `EnrollmentSignup` | Konto anlegen vor Später und Anmelden | Alternative Anmeldung und Später oberhalb der abschließenden Registrierung |
| `ConsentManager` | Anpassen nach Alle akzeptieren | Anpassen vor abschließendem Akzeptieren; Ablehnen behält gleichwertige Sichtbarkeit |
| `Hero` | Primärer Kurs-Link links vom Lernraum-Link | Sekundärer Lernraum-Link zuerst, gefüllter Kurs-Link rechts/unten |

Bereits korrekt: `CourseCMS` und `LessonAccessModal` (Abbrechen/Speichern), `RegistrationDesk`-Ablehnungsdialog (Behalten/Bestätigen), `ProfileProgressReset` (Abbrechen/Zurücksetzen), `LogoutButton` (Bleiben/Abmelden), `ProfileMonthlyCourses` Schritt 2/3 (Zurück/Weiter bzw. Bestätigen), `EnrollmentTerminal` (Zurück/Weiter), `CourseQuantityInput` (Minus/Plus), `PronunciationMessageInput` (Aufnahme vor Senden), `AudioRecorder` (Aufnahme löschen vor abschließendem Einsenden), `MediaAssetViewer` (Schließen vor Download), `PronunciationCMS`-Liste (Archivieren vor Bearbeiten), `VocabCMS`-Paginierung (Zurück/Weiter). Übungsformulare, eigene Wörter, Profil-/Sprachformulare sowie weitere Admin-Einzelaktionen haben genau eine abschließende Aktion. Header-Schließen liegt oberhalb des Dialoginhalts. Hilfs-/Audio- und Mediennavigation bildet keine Bestätigungsgruppe.

Gemeinsame Dialoge besitzen bislang nur einen Schließen-Knopf und überlassen Aktionspaare ihren Aufrufern. Die neue gemeinsame `DialogActions`-Komponente rendert `secondary` stets vor `primary`; sie wird im Admin-Freigabeformular und im Abmeldeblatt benutzt. Ein Jest-Test prüft ihre tatsächlich gerenderte DOM-Reihenfolge in `AdminDialog`, `PersistentDialog` und `BottomSheet`, zusätzlich die echte Abmeldebestätigung. Die Einstufung besitzt keine seitenabhängigen Tastaturkürzel oder Wischentscheidungen.

Bestehender Test in `vocabulary-assessment.test.tsx`, der ausdrücklich die alte Seite verlangte, wurde inhaltlich auf R15 umgestellt (Testname und DOM-Assertion). Die mehrsprachigen Tests in `vocabulary-assessment-ui.test.tsx` prüfen zusätzlich Reihenfolge und gefüllte positive Aktion. Kein Test wurde entfernt oder übersprungen.

## 1.5 — Registrierung und Freischaltung

Die Anmeldung zeigte bisher auf Login einen älteren Text aus `registrationLabels`, wodurch die Auth-Übersetzung übergangen wurde. Login und die Registrierungs-Statusseite verwenden jetzt denselben Auth-Vertrag mit hervorgehobenem Dank und Erklärung der Admin-Prüfung. Die notwendige E-Mail-Bestätigung und der neutrale Hinweis für schon bestehende Konten bleiben erklärt. Alle neuen Texte stehen gleichzeitig in Deutsch, Englisch, Russisch, Ukrainisch und Türkisch.

Der erfolgreiche Auth-Callback leitete bislang ohne sichtbaren Erfolgsstatus auf Home. Er übergibt jetzt bei Nicht-Recovery-Flows `status=confirm_success`; Home rendert die Bestätigungsbotschaft. Passwort-Wiederherstellung bleibt auf ihrem bestehenden Ziel ohne Registrierungsstatus. Der Status erteilt keine Rechte und verändert keine Verifizierungsentscheidung.

Ohne freigeschaltetes Niveau ersetzt eine große, benannte Karte in `TodayPlan` den bisherigen Einzeiler: Uhr-Symbol, Dank, Admin-Prüfung, Benachrichtigung per E-Mail sowie Hilfe- und Kalenderlink. Die Hilfe führt zur bestehenden Supportsektion auf Home. Navigation und Kalender sind weiter erreichbar. Bei vorhandenem Niveau verschwindet die Karte und der übliche Lernstart bleibt sichtbar. Das alte `today_no_level`-Übersetzungsfeld wird nicht voreilig entfernt.

## Prüfungen

| Prüfung | Ergebnis |
|---|---|
| 13 betroffene Jest-Suites, 126 Fälle, gemeinsamer Abschlusslauf | **126/126 grün**, 0 übersprungen; `/tmp/smartgerman-phase1/actions-signup-jest.log` |
| `vocabulary-assessment.test.tsx` | Nach inhaltlicher Anpassung der alten Reihenfolge 8/8 grün |
| `tsc --noEmit` nach UI-Änderungen | Exit 0 |
| Neue Registrierungsprüfungen | Beide Auth-Statusmeldungen in 5 Sprachen, Register-Statusseite, Karte jeweils mit/ohne Niveau in 5 Sprachen, Hilfe und Kalender ohne Niveau |
| Neue Callback-Prüfungen | OTP und PKCE tragen sichtbaren Erfolgsstatus; Recovery unverändert |
| Gemeinsame Dialogprüfung | Primäre Aktion in allen 3 Dialograhmen zuletzt; echte Logout-Bestätigung zuletzt |

Vollständige Phasen-Tests, Build und produktive Abnahme werden im Hauptbericht erfasst. Der erste scoped Lauf mit 118 Fällen hatte fünf Fehler in neuen Icon-Assertions: `aria-hidden` sitzt am umgebenden Element. Die DOM-Assertion prüft jetzt diesen semantisch gültigen Ort. Danach wurde auch die vom vollständigen Lauf gefundene Alt-Reihenfolge in `vocabulary-assessment.test.tsx` inhaltlich korrigiert. Der gemeinsame Abschlusslauf aller 13 betroffenen Suites ist grün. Kein Test wurde ausgeblendet.

## Bilder und Accessibility

Die synthetischen Bilddaten enthalten keine Personensitzung. Sie laufen ausschließlich gegen `127.0.0.1:54321`; Browser-Anfragen an fremde Hosts werden blockiert. Reproduzierbare Hilfen: `scripts/phase1-visual-fixture.cjs` und `scripts/phase1-visual-qa.cjs`. Der App-Build muss mit lokaler Fixture-Konfiguration laufen, nicht mit Produktions-DB-Konfiguration.

Vorher: je Desktop 1440×1000 und Handy 390×844 für Lernknöpfe, Artikel-Schreibansicht, Einstufung und Home ohne Niveau. Die Einstufungsbilder wurden nach Aufdecken der Lösung aufgenommen, damit beide Entscheidungen sichtbar sind.

Nachher: derselbe Aufbau. Der QA-Lauf prüft zusätzlich vollständige Axe-Ergebnisse für die vier geschützten Ansichten jeweils hell/dunkel auf Desktop/Handy (16 Fälle), die drei bestehenden öffentlichen Ansichten hell/dunkel (6), beide Registrierungsstatus hell/dunkel (4) und das tatsächliche Home-Ziel nach E-Mail-Bestätigung hell/dunkel (2). Keine Regel-, Knoten-, Tag- oder Impact-Ausnahme. Ergebnisse und Bildmaße/SHA256 stehen in `phase-1-bilder/after-axe.json` und `after-screenshots.json`.

Alle acht Nachher-Bilder sind visuell geprüft. Die Desktop-Dokumentbreite beträgt jeweils 1440 px, mobil jeweils 390 px: kein horizontaler Überstand in diesen vier Szenarien. Die neuen Hinweise und vollständigen Knopfbeschriftungen sind sichtbar. [Bildvergleich und Reproduktion](phase-1-bilder/README.md).

Im ersten erweiterten Axe-Lauf waren 22/26 Fälle grün. Die vier neu aufgenommenen Auth-Statusseiten meldeten je drei Landmark-Verstöße: `AuthShell` enthielt ein zweites `main` innerhalb des `main` aus dem Sprachlayout. Der innere Layout-Container wurde bei unveränderten CSS-Klassen zu `div` korrigiert. Der vollständige Erstlauf bleibt in [after-axe-initial.json](phase-1-bilder/after-axe-initial.json) nachvollziehbar. Das ist eine echte semantische Korrektur an den in Phase 1 geänderten Statusseiten, keine Test-Ausnahme.

Die unveränderte Datei `e2e/accessibility.spec.ts` wurde zusätzlich als echte Playwright-Suite ausgeführt: **6/6 bestanden**, 0 fehlgeschlagen, 0 übersprungen, 0 flaky; 12,761 Sekunden. Bestehender Chrome-Channel-Wrapper aus Phase 0, ein Worker, laufender finaler Produktions-Build auf localhost. [Vollständiges Playwright-Ergebnis](phase-1-bilder/playwright-accessibility.json).

Abschließender erweiterter Lauf auf dem finalen Build: **28/28 Axe-Prüfungen bestanden, 0 Violations, 0 ausgeschlossene Prüfungen**, Script-Exit 0. Damit sind auch die vier ursprünglichen Auth-Landmark-Befunde behoben und beide Themen des realen Home-Bestätigungsziels geprüft. Die acht Nachher-PNGs und ihr SHA256-Manifest wurden mit diesem Lauf erneuert.
