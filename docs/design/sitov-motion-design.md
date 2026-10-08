# Sitov Academy: Motion-Design

Stand: 8. Oktober 2026. Verbindliche Regel für neue und überarbeitete Oberflächen der gesamten Webseite: Die UI fühlt sich lebendig an und reagiert dynamisch auf die Menschen, die sie bedienen. Die Regel steht auch in `AGENTS.md` und ergänzt die [gemeinsamen Trainerregeln](sitov-trainer-design.md).

## Bewegung mit Bedeutung

- **Interaktion:** Karten, Buttons und andere Aktionen antworten unmittelbar auf Hover, Fokus und Druck. Pointer-Bewegung darf dezente räumliche Tiefe erzeugen; Berührung und Tastatur erhalten ein passendes, gleichwertiges Feedback.
- **Orientierung:** Aktive Auswahl, Seitenwechsel und neu erschienene Inhalte werden durch kurze, zusammenhängende Übergänge verständlich. Der Fokus bleibt nachvollziehbar, und eine Animation hält die nächste Handlung nicht auf.
- **Zustand:** Laden, Freigabe, Erfolg und Fehler haben unterscheidbare Rückmeldungen. Text oder Symbole erklären den Zustand zusätzlich; eine dekorative Animation darf niemals einen fachlichen Fortschritt oder eine Freigabe behaupten.
- **Einstieg:** Prominente Karten dürfen aufwendigere Motion-Graphics erhalten. Die Grafik erzählt die Funktion der Karte und besitzt eine bewusst abgestimmte Abfolge, Tiefe und Reaktion auf Interaktion. Die gesamte Karte ist als Link oder Button erreichbar, wenn sie zum Start einlädt.

## Gemeinsame Sprache

`lib/motion.ts` definiert die gemeinsamen Zeitwerte und Bewegungsmuster; `components/motion/` liefert unter anderem `PressableCard`, `SlidingPill` und Reveal-Muster. CSS verwendet die dazugehörigen `--motion-*`- und Easing-Tokens aus `app/globals.css`. Bestehende Muster zuerst verwenden, neue wiederverwendbare Muster dort ergänzen.

| Anlass | Standard |
| --- | --- |
| Druckfeedback und kleine Reaktion | `MOTION.fast` / 120 ms; `PRESS_SCALE` / 0,97 |
| Wechsel kleiner Zustände | `MOTION.base` / 200 ms |
| Auftritt oder gezieltes Erfolgsfeedback | `MOTION.slow` / 320 ms |
| Größerer, zusammenhängender Übergang | `MOTION.slower` / 500 ms |
| Gleitende Auswahl | `SPRING`, ohne lange Restbewegung |
| Gestaffelter Auftritt | `staggerDelay`, 40 ms je Element, begrenzt auf acht Elemente |

Eigenständige Motion-Graphics dürfen diese kurzen UI-Zeiten durch eine ruhigere, längere Choreografie ergänzen. Interaktionsfeedback bleibt sofort, und die Grafik bleibt vom Inhalt und von der Aktion unabhängig.

## Lesbarkeit und Bedienbarkeit

Text und Handlungsziele bleiben zu jedem Zeitpunkt lesbar. Dekoration liegt hinter oder neben ihnen, fängt keine Pointer-Ereignisse ab und wird für assistive Technik verborgen. Kein Statuspunkt überdeckt Navigationsbeschriftungen. Die Hauptnavigation zeigt am Reiter „Lernen“ keinen Neuheitenpunkt; konkrete Lerninhalte behalten ihre passenden Neuheitenhinweise.

Animationen reservieren ihre Fläche und verschieben keine Aufgaben, Buttons oder scrollenden Inhalte. Sie ersetzen keine Fokusmarkierung. Gedrückte Aktionen und Antworten werden sofort verarbeitet; es gibt keine Wartezeit auf das Ende einer Animation. Vom Server gelieferte Inhalte sind schon vor der Hydration sichtbar und benutzbar.

## Weniger Bewegung und Leistung

`useReducedMotionSafe()` berücksichtigt `prefers-reduced-motion` und behandelt Serverdarstellung sowie Hydration zunächst ruhig. CSS ergänzt diese Behandlung mit einer passenden Media Query. Weniger Bewegung zeigt eine vollständig verständliche statische Grafik und die gleichen Inhalte, Zustände, Fokusmarkierungen und Aktionen; dauerhafte Bewegung, Parallax, Drehungen und pulsierende Dekoration entfallen.

Fortlaufende dekorative Choreografien pausieren außerhalb des Viewports und bei verborgenem Dokument. Für CSS-Loops eignen sich Sichtbarkeitssignale zusammen mit `animation-play-state`; JavaScript-Loops stoppen ihre Frames. Bevorzugt werden `transform` und `opacity`; SVG-Pfadanimationen bleiben auf die kleine Grafikfläche begrenzt. Listener, Observer, Timer und Frames werden aufgeräumt. Touch-Geräte benötigen keinen Hover und keine Pointer-Parallax.

## Abnahme

Neue Motion-Flächen werden in Hell, Dunkel und hohem Kontrast, auf schmalem Handy und Desktop sowie mit Pointer, Berührung und Tastatur betrachtet. Reduzierte Bewegung zeigt unmittelbar das vollständige Ergebnis. Prüfung und Freigabezustände bleiben fachlich korrekt. Wiederholte Eintritte, Scrollen aus dem Sichtbereich und Zurückkehren verursachen weder Sprünge noch weiterlaufende Hintergrundanimationen.

## Prüfungskarte auf der Startseite

`ExamEntry` verwendet die gemeinsame `SitovMotionStage` und eine eigene Vektorgrafik in `SitovExamEntryGraphics`. Eine Prüfungsmappe schwebt zwischen den vier Bereichen Lesen, Hören, Schreiben und Sprechen. Die Kurve zeichnet sich über sieben Sekunden, danach erscheint das Häkchen mit einem auslaufenden Ring. Zwei langsame Umlaufbahnen und die Hörwellen ergänzen die Abfolge. Die Grafik ist dekorativ und stellt weder ein persönliches Prüfungsergebnis noch eine Freigabe dar.

Die Pointer-Position steuert Licht sowie die begrenzte Perspektive der Grafik über `--sitov-pointer-x` und `--sitov-pointer-y`; der Text bleibt fest. Fokus verschiebt den Aktionspfeil, `PressableCard` gibt beim Drücken nach. Der vorberechnete Serverinhalt und beide Prüfungslinks stehen schon vor der Hydration bereit. Bei hohem Kontrast entfallen Glanz, Schatten und atmosphärische Dekoration. Bei reduzierter Bewegung ist die vollständige Mappe mit Kurve und Häkchen statisch sichtbar. Unsichtbare oder verborgene Szenen pausieren sämtliche CSS-Animationen.

Lokale Abnahme: `npx playwright test -c e2e/sitov-exam-home-motion.config.ts` prüft in sieben Browserfällen Pointer-Rückmeldung, Pausieren, reduzierte Bewegung, Tastatur, Touch sowie Hell/Dunkel und beide Kontrastvarianten bei 320, 390 und 1440 px. Die Karten bestehen die Axe-Prüfung in allen vier Darstellungskombinationen. `__tests__/sitov-exam-entry.test.tsx` prüft beide normalen und B1-bezogenen Ziele im Server-HTML, `__tests__/sitov-motion-stage.test.tsx` begrenzte Pointer-Achsen und deren Zurücksetzen.

Die Karte ist mit Release `09452efafb1a` seit dem 4. Oktober 2026 um 17:02 Uhr CEST produktiv. Die [Desktop-Ansicht](sitov-exam-home-motion/desktop-light.png) und [mobile Dunkelansicht](sitov-exam-home-motion/mobile-dark.png) dokumentieren die lokale Abnahme. Die vollständige Motion-Aufzeichnung liegt mit dem Deploymentnachweis im Obsidian-Nachtrag 31.

## Lernboxen und Aussprachefortschritt

Seit dem 7. Oktober 2026 teilen Vokabel- und Verbtrainer die Darstellung in `components/learning/SitovLearningBox.tsx`: Fortschrittsbalken, beschriftete Zähler, sechs Fächer und ein Langzeitfach. Papierstapel bilden die tatsächliche Kartenanzahl ab; leere Fächer bleiben leer. Fällige Karten bewegen sich ruhig, Pointer und Fokus heben den Stapel an, native Buttons geben beim Drücken nach. `SitovMotionStage` pausiert die dekorative Bewegung außerhalb des Sichtbereichs und bei verborgenem Dokument. Reduzierte Bewegung und Serverdarstellung zeigen sofort alle Zahlen und Aktionen. Container Queries passen die Fächer an den verfügbaren Platz an. Die Lernaktion steht im gemeinsamen Einstiegswidget vor der Lernbox, damit sie auf dem Handy früh erreichbar ist.

Die Trainer behalten ihre eigenen Daten und Aufnahmeaktionen; beide verwenden dieselben Lernboxregeln. Vokabeln liegen im Fach ihrer schwächeren Abfragerichtung; Verben im Fach ihrer schwächsten freigeschalteten Zeitform. Das Öffnen zeigt die einzelnen Lernstände. Neu aufgenommene Verben und neu freigeschaltete Zeitformen verändern keine früher gespeicherten Antworten. Fach 7 beendet in beiden Trainern reguläre Wiederholungen. Richtig führt ein Fach weiter, falsch zurück in Fach 1 und zur nächsten Fälligkeit am folgenden Kalendertag. Fehler werden am Rundenende ohne erneute Fortschrittsbewertung wiederholt. Der gewichtete Fortschritt und vollständig gelernte Wörter sind deshalb gesondert beschriftet.

Die aufklappbare Erklärung im Verbtrainer enthält eine eigene Mini-Lernbox in `components/verbs/SitovVerbLearningGuide.tsx`. Eine Beispielkarte wandert von Fach 1 über 2 nach 3, kehrt bei einem Fehler zurück in Fach 1 und durchläuft anschließend jedes Fach bis 7. Häkchen und Fehlersymbol begleiten die Bewegung; die Intervalle stammen aus `SITOV_VERB_REVIEW_DAYS`, mit 1, 1, 3, 9, 29 und 90 Tagen; das Archiv erhält keinen Wiederholungstermin. Die Beispiele zeigen nur die im aktuellen Niveau freigeschalteten Zeitformen und behalten ihre deutsche Sprache, während Beschriftungen und Regeln allen fünf Interface-Sprachen folgen. Die Grafik veranschaulicht eine einzelne Form und ist ausdrücklich als Beispiel gekennzeichnet. `SitovMotionStage` pausiert den 14-Sekunden-Zyklus außerhalb des sichtbaren Bereichs und bei verborgenem Dokument. Reduzierte Bewegung und Serverdarstellung zeigen die Karte statisch im letzten Fach. Die Browserprüfung in `e2e/sitov-verb-learning-guide.spec.ts` kontrolliert die tatsächlichen Kartenpositionen, den Fehlerweg, die Sichtbarkeitspausen, Tastaturbedienung, Sprach- und Zeitformwechsel sowie 320/390/1440 px in Hell, Dunkel und beiden Kontrastvarianten; sie läuft mit `npx playwright test -c e2e/sitov-trainer-progress.config.ts`.

Die Verb-Erklärung beschränkt sich auf die Animation und drei kurze Regeln: Aufstieg einer fälligen Form, Rückkehr in Fach 1 mit Fehlerwiederholung und Archiv ohne weitere Wiederholungen. Zusammenfassungszähler, der globale Wiederholungszeitstempel, doppelte Pfeilbeschriftungen, lange Regelabsätze und der Zusatzkasten zum frühen Üben entfallen. Die genauen Wiederholungstermine einzelner Zeitformen bleiben im jeweiligen Fach erreichbar.

Die Aussprachekarte zeigt den nächsten Lernschritt, alle drei auswählbaren Meilensteine, erreichte Ziele und den genauen Restbedarf. Die erste Stufe verlangt 30 sichere Wörter, zwei Lernpfadabschnitte mit mindestens zwei Sternen und drei sichere Verbformen. Historische Grammatiknachweise gelten weiterhin nach dem vorhandenen Serververtrag; erforderliche Verbformen werden auf die tatsächlich verfügbaren Formen begrenzt. Ein sicheres Wort verlangt Phase 3 in beiden Richtungen und mindestens eine korrekte ausgeschriebene Antwort Richtung Deutsch. Sichere Verbformen verlangen Fach 3, mindestens drei Antworten und mindestens 80 Prozent richtige Antworten. Die Fortschritte zählen über die Kursniveaus hinweg.

Die Datenbank entscheidet weiterhin über die Freigabe. Zusätzlich zum Lernschritt braucht jeder Text mindestens 60 Prozent bekannte Inhaltswörter; gesperrte Texte zeigen ihre eigene Abdeckung und fehlende Prozentpunkte. Das Fortschrittsring-Ergebnis ist ausschließlich die Zusammenfassung der Lernziele. Deutsche Texttitel bleiben mit `lang="de"` und `translate="no"` markiert, die Oberfläche folgt allen fünf Interface-Sprachen.

Die additive VPS-Migration `90_sitov_pronunciation_recall_evidence.sql` korrigiert den bisher unerreichbaren Schreibnachweis in der Karteikartenrichtung, ohne Fortschritte, Antworten oder Aufnahmen umzuschreiben. Sie gehört zum passenden App-Release; der Smoke-Test steht in `deploy/vps/tests/sitov-pronunciation-recall-evidence.sql`. Lokale Browserabnahme: `npx playwright test -c e2e/sitov-trainer-progress.config.ts`. Datenbankregression: `node --test supabase/tests/sitov-pronunciation-recall-evidence.test.mjs supabase/tests/sitov-pronunciation-readiness.test.mjs`.

## Einheitliche Einstiegswidgets für Trainer und Mediathek

Seit dem 8. Oktober 2026 verwenden Vokabeltrainer, Verbtrainer, Lernpfad und Mediathek `components/motion/SitovTrainerHero.tsx`. Aufbau, Typografie, Rundung, reservierte Grafikfläche, Druckfeedback und Fokus folgen derselben Komponente; die bestehenden Modusfarben und eigenständigen Szenen bleiben erhalten. Auf dem Handy steht die Überschrift über einer kompakten Zeile mit Aktion und Grafik. Der sichtbare Text beschränkt sich auf Titel, Niveau und unmittelbar hilfreichen Zustand.

Vokabeln und Verben besitzen einen nativen Startbutton; bei leerer Lernbox führt die Aktion zur passenden Auswahl. Der Lernpfad setzt zuerst den verfügbaren Server-Checkpoint fort, einschließlich laufender Prüfungen und Extras; ohne Checkpoint öffnet er die nächste verfügbare Station. Ein vollständig abgeschlossenes Niveau ohne Checkpoint bietet keinen irreführenden Weiterlernen-Button. Die Mediathek zeigt Video und Dokumente als dekorative Szene und besitzt im Einstiegswidget keinen Button; die echten Medienaktionen liegen bei den jeweiligen Inhalten.

Alle fünf Interface-Sprachen bleiben unterstützt. Deutsche Artikel und Verbformen in den Szenen erhalten `lang="de"` und `translate="no"`. Die gemeinsame `SitovMotionStage` pausiert die Choreografie bei unsichtbaren Flächen und verborgenem Dokument. Reduzierte Bewegung zeigt dieselben Bedienelemente und eine statische Szene; hoher Kontrast entfernt Glanz und Schatten.

[Abnahme und Screenshots](sitov-trainer-heroes/README.md): 106 gezielte Tests in neun Suites, TypeScript und ESLint ohne Fehler; lokale Browserprüfung mit Beispieldaten bei 320, 390 und 1440 px, Hell/Dunkel, hohem Kontrast sowie Tastaturstart des Verbtrainers. Keine neue Datenbankmigration, keine neuen Lerninhalte oder Audios.

## Gemeinsame Navigation und Hilfe im Trainer

Vokabel- und Verbtrainer verwenden `SitovTrainerTabs` direkt vor dem Einstiegswidget. `SlidingPill` verbindet den Wechsel zwischen Üben, Auswahl und Fokus; `PressableCard` gibt der jeweils nativen Link- oder Buttonaktion unmittelbares Druckfeedback. Die Auswahl bleibt zusätzlich über `aria-current` beziehungsweise `aria-pressed` erkennbar. Mindesthöhe, Abstände und Fokus folgen derselben Komponente.

`SitovTrainerHelp` vereinheitlicht die zunächst geschlossene Hilfe unter der Fachverteilung. Der native 48-px-Button zeigt Glühbirne, Titel und Chevron; Öffnen und Schließen verwenden die gemeinsamen Zeitwerte aus `lib/motion.ts`. Ein schließendes Panel wird sofort für Fokus und assistive Technik verborgen, während der Übergang ausläuft. Bei reduzierter Bewegung wechseln die Zustände unmittelbar. Die umgebende `SitovMotionStage` pausiert vorhandene dekorative Anleitungsszenen außerhalb des Sichtbereichs und bei verborgenem Dokument; fachliche Regeln und die Vokabel-Mini-Box bleiben unverändert.

Aufbau und lokale Vergleichsbilder stehen im [Layout-Abgleich](sitov-trainer-layout/README.md); die verbindliche Reihenfolge ist in den [gemeinsamen Trainerregeln](sitov-trainer-design.md#gleicher-aufbau-für-vokabeln-und-verben) festgelegt.
