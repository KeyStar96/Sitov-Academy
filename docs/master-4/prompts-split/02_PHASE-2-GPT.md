> **Lies `00_CODEX-4-RULES.md` und diese Datei. Führe ausschließlich Phase 2 aus.**

## PHASE 2 — NAVIGATION UND DESIGN-SYSTEM

**Ziel:** Man weiß jederzeit, wo man ist. Die vier Modi stehen gleichberechtigt oben. Der Lernraum fühlt sich lebendig an.

Befund: Die Niveau-Seite `app/[lang]/dashboard/level/[level]/page.tsx` zeigt oben `LevelPath` (Vokabel-Stationen, in der Oberfläche „Lernweg“) und unten `TrainerStatusTiles` mit den vier Bereichen. Dadurch wirkt alles wie Vokabeltrainer, und Grammatik, Aussprache und Mediathek stehen weit unten. `DashboardHeader.tsx` zeigt auf dem Handy nur eine Zurück-Pille und die aktuelle Seite und überspringt das Segment `level`. Home nimmt das **erste** Niveau mit 0 < Fortschritt < 100, nicht das zuletzt gelernte. „Lernen“ springt über `localStorage` (`sitov:last-level`).

#### 2.1 Bewegungs-Tokens und Grundbausteine
* [ ] Tokens aus D4 in `app/globals.css`, Federn und Varianten in `lib/motion.ts`. Ein Hook `useReducedMotionSafe()` oder die Framer-Einstellung `MotionConfig reducedMotion="user"` global im Lernenden-Layout.
* [ ] Wiederverwendbare Bausteine: `PressableCard`, `CountUp`, `NewBadge` (D10), `SlidingPill`. Alle mit Tests für reduzierte Bewegung.
* [ ] Modus-Kennfarben aus D2 als Tokens, Kontrasttests erweitert.

#### 2.2 Modus-Dock
* [ ] Neue Komponente `components/dashboard/ModeDock.tsx` im Niveau-Layout `app/[lang]/dashboard/level/[level]/layout.tsx` nach D6.
* [ ] Ziele: Vokabeln → `/vocabulary`, Lernpfad → bis Phase 3 die bestehende Route `/exercises`, danach `/path`, Aussprache → `/pronunciation`, Mediathek → `/videos`. Die Ziele stehen an **einer** Stelle, damit Phase 3 nur dort umstellt.
* [ ] Gesperrte Modi mit Schloss und Erklärung, auch der Fall „deutsche Oberfläche“ (`TrainerLanguageRequired`).
* [ ] Zähler: fällige Karten, ungelesene Antworten in der Aussprache, Platz für „Neu“ (gefüllt in Phase 6).
* [ ] Tests: aktiver Tab je Route, `aria-current`, gesperrter Zustand, Tastaturbedienung, Handy-Breite ohne waagerechtes Scrollen.

#### 2.3 Niveau-Seite als Übersicht, „Lernweg“ wird „Lektionen“
* [ ] Die Niveau-Seite zeigt oben eine Karte „Weiter, wo du aufgehört hast“ (letzter Modus und letzte Stelle) und darunter **vier gleich große Modus-Karten** mit je einer Kennzahl: fällige Karten, Position auf dem Lernpfad, neue Antworten der Lehrkraft, neue Medien.
* [ ] `LevelPath` wandert in den Modus Vokabeln und heißt dort **„Lektionen“**. Alle Oberflächentexte, Hilfetexte und Kommentare, die „Lernweg“ für die Vokabel-Lektionen sagen, werden umbenannt (fünf Sprachen). „Lernpfad“ ist danach frei für den Grammatik-Pfad.
* [ ] Grep-Test: Kein Oberflächentext in `dictionaries/` und `lib/*-i18n.ts` verwendet „Lernweg“ mehr für die Vokabel-Lektionen (entsprechend in den anderen Sprachen).

#### 2.4 Brotkrumen mit vollem Pfad
* [ ] `DashboardHeader.tsx` nach D7 umbauen: voller Pfad inklusive Niveau, auf allen Breiten. Beschriftungen aus `DASHBOARD_ROUTE_KEYS` (erweitern um Lernpfad, Pfad n, Knoten, Test, Lektionen).
* [ ] Tests für mindestens sechs Routen (Home, Niveau, Vokabeln/Lernbox, Vokabeln/Lektionen, Aussprache, Mediathek); Phase 3 ergänzt die Pfad-Routen.

#### 2.5 Untere Leiste blendet beim Scrollen aus
* [ ] `StudentNavigation.tsx` und `.st-tabbar` in `student.css` nach D8. Der Zustand wird als Attribut am Wurzelelement gesetzt (zum Beispiel `data-tabbar="hidden"`), und eine CSS-Variable für die sichtbare Leistenhöhe steuert alle Elemente, die sich an der Leiste ausrichten.
* [ ] Das Aufnahme-Dock der Aussprache wandert mit.
* [ ] Playwright auf Pixel 7 und iPhone 14: Leiste weg nach Runterscrollen, zurück nach Hochscrollen, sichtbar oben und am Ende; Aufnahmeknopf bleibt `toBeInViewport()` und klickbar. Die vorhandenen Tests `e2e/navigation-scroll.spec.ts`, `e2e/pronunciation-mobile.spec.ts` und `e2e/mobile-safe-area.spec.ts` bleiben grün.

#### 2.6 Home folgt dem zuletzt gelernten Niveau
* [ ] Neue RPC `public.get_last_active_level()` (R5, R10): das Niveau mit der jüngsten Lernhandlung der aufrufenden Person über Vokabel-Antworten (`vocabulary_private.answer_receipts`), Aufgabenversuche, Aussprache-Aufnahmen und ab Phase 3 Lernpfad-Versuche. Nur Niveaus mit gültiger Freischaltung. Rückfall: erstes angefangenes, dann erstes freigeschaltetes Niveau.
* [ ] Home zeigt „Deine Lernbereiche · A1.2“ und einen Knopf „Zum Lernpfad“ bzw. zum zuletzt genutzten Modus dieses Niveaus.
* [ ] Der Tab „Lernen“ nutzt dieselbe RPC. `localStorage` bleibt nur als Rückfall, wenn die RPC fehlschlägt.
* [ ] DB-Test: Wer in A1.1 halb fertig ist und in A1.2 eine Vokabel beantwortet, bekommt A1.2. Jest-Test für die Überschrift.

#### 2.7 Mikroanimationen einsetzen
* [ ] D5 auf Home, Niveau-Seite, Dock, Brotkrumen, Lernbox-Übersicht und Antwort-Rückmeldung anwenden. Nichts darüber hinaus erfinden.
* [ ] Test mit `prefers-reduced-motion: reduce` in Playwright: keine laufenden Animationen (per `document.getAnimations()`), alle Inhalte sichtbar.

**Abnahme Phase 2:** axe ohne Filter auf allen geänderten Routen in hell und dunkel; Playwright Desktop, Pixel 7, iPhone 14 grün; Vorher/Nachher-Bildschirmfotos neben die aus Phase 0; Lighthouse-Leistung der Niveau-Seite auf dem Handy nicht schlechter als in Phase 0 (Wert im Bericht).

**Übergabe:** Ort der Modus-Ziele (für Phase 3), Namen der neuen Bausteine und Tokens in `STATUS.md`.

---