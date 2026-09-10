# NeuralBrain — organisches Gewebe und ruhige Lichtschweife

Stand: 10. September 2026. Lokal implementiert.

## Umsetzung

- `components/effects/NeuralBrain.tsx`: R3F-Szene, zentrale Impulssteuerung, Theme-Wechsel, Sichtbarkeit, reduzierte Bewegung und WebGL-Fallback.
- `components/effects/neural-brain-geometry.ts`: 6.400 deterministisch gesampelte Neuronen; domain-verzerrtes Perlin-Rauschen formt Dichte-Cluster, Falten und asymmetrische Hirnlappen. 20.193 lokale Graph-Verbindungen, 16 vorbereitete Routen und je 192 Stützpunkte pro Lichtband. Kurvenmittelpunkte sind zugleich Teil der sichtbaren statischen Fasern.
- `components/effects/neural-brain-shaders.ts`: Tiefenabstufung für Gewebe sowie kontinuierliche Kamerabänder mit hellem Kopf, schmalem Kern, weicher Aura und transparent auslaufendem Schweif. Keine bewegten Point-Sprites. Keine individuelle Kanten- oder Knoten-Blinksteuerung.
- Erste Gruppe nach 2,4 Sekunden sichtbarer Animationszeit; danach alle 6–8 Sekunden 1–3 Impulse. Die drei wiederverwendeten Meshes begrenzen die gleichzeitige Anzahl unabhängig von der Graphgröße. Eine gesamte Gruppe dauert höchstens 3,05 Sekunden, die folgende vollständige Ruhe mindestens 2,95 Sekunden. Der Takt wurde am 10. September leicht erhöht; die unten dokumentierten Browsermessungen stammen vom ursprünglichen Takt von 6,5–9 Sekunden.
- Lightmode nutzt dunklere violette Fasern und Amber mit normalem Alpha-Blending, Darkmode hellere Fasern und additive Lichtschweife. Zwei Drawcalls im Ruhezustand, höchstens fünf bei Impulsen. DPR maximal 1,5. Geometrien werden beim Aufbau berechnet und beim Unmount entsorgt.
- Bei reduzierter Bewegung bleibt dieselbe Geometrie ohne Animation im Demand-Loop sichtbar. Theme-, DPR- und Größenänderungen lösen einen neuen Render aus. Offscreen/verborgenes Dokument pausieren den Animationsclock; Context-Verlust oder fehlendes WebGL nutzen das bestehende SVG-Fallback mit eindeutigem Gradient-Identifier.
- Der gestrichelte Kreis hinter der Hero-Geometrie wurde entfernt.

## Verifikation

- Projektweiter TypeScript-Check (`tsc --noEmit`) erfolgreich; Produktionsbuild (`next build`, identischer Inhalt des npm-Build-Scripts) nach den finalen Geometrieänderungen erfolgreich.
- Node/npm sind nicht im normalen Shell-PATH verfügbar. Verwendet wurde der gebündelte Node-Runtime; Next wurde direkt über seine lokale CLI gestartet.
- Unabhängiger Geometriecheck: alle Attribute endlich, alle 16 Routen durchgängig mit nichtleeren Segmenten; Aufbau auf dieser Maschine etwa 168 ms. Lokale Bounds: x −1,116 bis 1,083, y −0,841 bis 0,798, z −0,684 bis 0,742.
- Tatsächliche WebGL-Drawcalls im lokalen Chrome beobachtet (1.647 Frames, etwa 27 Sekunden Animationszeit): Gruppen mit 1, 2, 1, 3 Schweifen; beobachtete Ruheintervalle 5,28 / 4,47 / 5,18 Sekunden. Nie mehr als drei Impulse gleichzeitig.
- Desktop-Screenshots in Light-/Darkmode, ruhenden und aktiven Phasen visuell geprüft; mobile Ansichten bei 320 und 390 CSS-Pixeln in beiden Themes ohne horizontalen Overflow.
- Offscreen-Renderstop bestätigt. Bei aktivierter reduzierter Bewegung keine weiteren Dauer-Drawcalls und pixelidentische Canvas-Aufnahmen; Theme-Wechsel zeichnet die statische Szene neu, Zurückschalten aktiviert die Bewegung wieder.
- Echter Context-Verlust über `WEBGL_lose_context` entfernt den Canvas und zeigt das SVG; keine Browser- oder Shaderfehler im Test.
- Shader-Review hat negative Basen in GLSL `pow` vermieden; die Glühkopf-Gaußfunktion verwendet explizite Multiplikation. DPR-only-Änderungen werden auch im statischen Modus berücksichtigt.

## Grenzen

Für lokale Startseite und Build wurden absichtlich unbrauchbare lokale Backend-Testwerte verwendet, da keine Backend-Konfiguration in der Shell vorhanden war. Kurs-Fetches liefern dabei erwartete Fehler/Fallbacks; zusätzlich protokolliert die bestehende Registrierungsroute den Wechsel zu dynamischer Ausführung wegen `cookies`. Der Build endet trotzdem erfolgreich (114 generierte Seiten). Diese Prüfung betrifft die visuelle Komponente, nicht produktive Kursdaten oder Buchungsabläufe.

Browserprüfung mit lokalem Chrome und WebGL; keine separate Safari-/Firefox- oder physische Smartphone-GPU-Prüfung. Die bestehende schwebende Kontakt-Schaltfläche und der Next-Entwicklungsindikator können in mobilen Panel-Screenshots die Bildunterschrift überlagern; sie gehören nicht zur 3D-Komponente.
