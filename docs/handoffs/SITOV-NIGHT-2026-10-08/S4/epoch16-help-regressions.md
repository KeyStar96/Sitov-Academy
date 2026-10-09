# S4 · Epoch 16 · Hilfe und Verb-Landmarks

Basis: `072173261e6a1e37b54d1dabb7ee2842719fb650`, Branch `codex/sitov-night-s4-help-regressions`.

## Befund und Änderung

Der von M gemeldete doppelte Regionsname ist ein echter DOM-Befund, kein Help-Mock: `SitovLearningBox` und die darin verschachtelte Help-Section waren beide mit „Your verb learning box“ benannt. Die Help-Section verwendet jetzt den bereits in allen fünf UI-Sprachen vorhandenen Anleitungsnamen `copy.guide` („How your verbs move“). Der Lernkasten, die Anleitung und das geöffnete Help-Panel behalten ihre sinnvollen, unterscheidbaren zugänglichen Namen. Keine Landmark wurde entfernt.

Die vier Testdateien verwenden den kurzen lokalisierten Hilfeschalter. Ihre Aussagen prüfen weiterhin den Kontext als Panelüberschrift, echte Regeln, Lernfortschritt und Herkunftsverteilung. Hinzu kommen eindeutige Verb-Landmarks vor und nach dem Öffnen, zugehörige `aria-controls`/`aria-labelledby`, sofortige Unerreichbarkeit nach dem Schließen (`aria-hidden`/`inert`), Enter/Leertaste mit erhaltenem Fokus und alle fünf Regeln bei reduzierter Bewegung. Aktionen, IDs, Fortschritte und Inhalte wurden nicht geändert.

## Verifikation

- Vier zugewiesene Jest-Suites: **50/50 Tests bestanden**, 4/4 Suites; Log `/tmp/sitov-s4-epoch16-jest.log`.
- ESLint nur auf den fünf geänderten TSX-Dateien: **0 Fehler, 0 Warnungen**; Log `/tmp/sitov-s4-epoch16-eslint.log`.
- `git diff --check`: bestanden; abschließender Arbeitsbaum sauber.
- Bestehende Konsolenausgaben des globalen Motion-Mocks und des absichtlich geprüften Inspector-Lesefehlers bleiben sichtbar; keine Unterdrückung oder neuen Mocks.

## Übergabe und Grenzen

Nur eigene freigegebene Dateien geändert. Kein Browser-, Runtime-, nativer DB-, Gesamt-Jest-, TypeScript-, Build-, SQL- oder Audio-Lauf. Der Produktfix umfasst eine einzige aria-label-Quelle. M integriert erst nach Ende der laufenden S5-Abnahme des eingefrorenen 072-Standes. Dies ist gezielter Komponenten-Regressionsnachweis, keine allgemeine Freigabe der Plattform. S4 wartet nach Commit und atomarem Status auf ein neues START.
