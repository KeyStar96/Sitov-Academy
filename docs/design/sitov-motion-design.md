# Sitov Academy: Motion-Design

Stand: 4. Oktober 2026. Verbindliche Regel für neue und überarbeitete Oberflächen der gesamten Webseite: Die UI fühlt sich lebendig an und reagiert dynamisch auf die Menschen, die sie bedienen. Die Regel steht auch in `AGENTS.md` und ergänzt die [gemeinsamen Trainerregeln](sitov-trainer-design.md).

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
