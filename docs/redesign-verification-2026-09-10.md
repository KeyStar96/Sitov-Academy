# Redesign: Prüfung am 10. September 2026

## Automatisierte Prüfungen

- `npm run build`: erfolgreich; Next.js 16.1.6, TypeScript-Prüfung erfolgreich, 114 erzeugte Seiten.
- Jest: **638 Tests in 38 Suites erfolgreich**. Aufruf: `node node_modules/jest/bin/jest.js --runInBand --silent --testPathIgnorePatterns 'integration-real-db|/e2e/'`.
- Isoliertes PostgreSQL: **61 Tests erfolgreich**, Aufruf `node --test supabase/tests/*.test.mjs`. Darin 19 Prüfungen für die neuen Vokabelmigrationen; zusätzlich bestehende Profil-/Buchungs-/RLS-Regressionen. Einzelaufruf: `npm run test:db:vocabulary`.
- `git diff --check`: erfolgreich.

Der separate Alt-Test `integration-real-db.test.ts` setzt einen Service-Role-Key voraus und konnte in dieser lokalen Umgebung nicht laufen. Er wurde nicht mit Produktions-Zugangsdaten ausgeführt. Die Playwright-Specs unter `e2e/` gehören nicht zu Jest; Browserprüfungen erfolgten mit CUA. Ein vollständig authentifizierter End-to-End-Lerndurchlauf gegen die Live-Datenbank wurde nicht simuliert. Die wirklichen SQL-Mutationen/RLS wurden isoliert getestet; die Live-Migration wurde anhand von Bestandsprüfsummen, Tabellen, Grants und Advisors verifiziert.

Der lokale Build verwendet die vorhandene Supabase-Platzhalter-Konfiguration. Die Kurssektion zeigt deshalb lokal ihren Leerzustand. Die produktive Integration über `getCourses`, Preise pro Unterrichtseinheit sowie Anmelde-/Probestundenpfade bleiben erhalten. Bestehende Build-Hinweise betreffen die Middleware-Konvention, Browserslist-Alter und den dynamischen Cookie-Zugriff der Registrierung; sie verhindern den Build nicht.

## Browser und Gestaltung

- Produktionsvorschau der Startseite: alle fünf Locales bei 320px, DE/EN bei 430px, Desktop 1280px; Dokumentbreite entspricht jeweils exakt der Viewportbreite.
- Light-/Darkmode, Menü, Locale-Wechsel, Canvas und Theme-Wechsel geprüft; keine JavaScript-Fehler in der Produktionsvorschau. Kleine Footer-Link-Flächen wurden auf mindestens 44px Breite korrigiert.
- Lernkomponenten mit tatsächlichen Komponenten und Dictionaries, isolierten Server-Action-Grenzen: Assessment, Wortkarte und Satzkarte in de/en/ru/uk/tr bei 320×568 sowie 430×932 (**30 Kombinationen**), ohne Scrollbedarf oder zu kleine Touch-Flächen. Zusätzlich Satzkarte bei 375×667 und 390×844 geprüft.
- Aufdecken, falsche Satzantwort, Lösung, lange Bestandsvokabel mit allen sieben Wochentagen, fehlgeschlagenes optimistisches Speichern sowie persistierter vorheriger Begriff geprüft. Der längste Bestandsbegriff passt bei 320×568 einschließlich Kontext und Audiobutton. Bei extremem Textzoom oder ungewöhnlich langen neu verfassten Inhalten bleibt die Kartenfläche intern erreichbar; die Seiten- und Aktionsflächen laufen nicht über. Bei sehr geringer Höhe mit Bildschirmtastatur gibt es eine zugängliche Scrollreserve.
- Admin-Buchungstabelle bei 320px mit synthetischen Schülerdaten: keine horizontale Überbreite; alle sichtbaren Eingaben/Selects/Summaries mindestens 44px; Namenssuche reduziert die angezeigten Zeilen unmittelbar. Deduplizierung, Mehrfachfilter, Sortierung und optimistische Notizen sind zusätzlich durch Tests abgedeckt.
- Gemessene Kontrastverhältnisse der Haupttokens: Light-Text 13,76:1, Light-Sekundärtext 5,49:1, Light-CTA 5,71:1; Dark-Text 16,23:1, Dark-Sekundärtext/CTA 8,16:1. Fokusmarkierungen und reduzierte Bewegung sind berücksichtigt. Das ist keine pauschale WCAG-Zertifizierung jeder Altseite.

## Laufzeit und Veröffentlichung

Next.js 16 App Router verwendet React 19. Die zuvor deklarierte React-18/Fiber-8-Kombination löste im Browser `ReactCurrentOwner`-Importfehler aus. Installiert sind kompatible Versionen: React/React DOM 19.2.8, React-Typen 19.2.18/19.2.7 und Fiber 9.7.0, ohne Peer-Dependency-Bypass. Die statische Brain-Alternative greift bei reduzierter Bewegung oder fehlendem WebGL.

Live-SQL-Versionen und unveränderte Bestandsprüfsummen stehen in `supabase-deployment-2026-09-10.md`. Das Frontend ist lokal implementiert und gebaut; dieser Arbeitsstand wurde nicht auf Vercel veröffentlicht.
