# Phase 2 — Prüfbericht

## Prüfung vor Änderungen

25.09.2026. `00_CODEX-4-RULES.md` (R1–R16, D1–D8, D12, S1–S7) und ausschließlich `02_PHASE-2-GPT.md` gelesen; Phase-0-Richtlinie [lernraum-designrichtlinie.md](../design/lernraum-designrichtlinie.md) (D1–D13 inklusive Vorschlagstabellen) und aktueller [STATUS](STATUS.md) berücksichtigt. Ausgangsrevision `3271a12` (`origin/codex/vps-self-hosted`, Arbeitsbaum sauber; der lokale Stand `08bcaf3` war veraltet und wurde vor Beginn per `git pull` auf `3271a12` gebracht). Lokale Next-16.3.5-Doku zu Layouts/`usePathname`/Client-Grenzen gelesen.

| Bereich | Ist (geprüft) | Soll / geplante Änderung |
|---|---|---|
| 2.1 Bewegung | Keine `--motion-*`-Tokens, kein `lib/motion.ts`. `student.css` nutzt 70/80 ms Staffelung, 1,1-s-Ring, endlose Pulse (`st-breathe`, `st-ping`), 1,4-s-Glanz, mehrsekündigen Pfeil. Globaler Reduced-Motion-Fallback kürzt nur auf 0,01 ms. `useReducedMotion` liefert auf dem Server `null`. Keine Bausteine `PressableCard`/`CountUp`/`NewBadge`/`SlidingPill`. | Tokens aus D4 in `globals.css`, Federn/Varianten in `lib/motion.ts`, hydrationssicherer `useReducedMotionSafe()`, `MotionConfig reducedMotion="user"` im Lernenden-Layout. Vier Bausteine mit Reduced-Motion-Tests. Bestehende Lernraum-Animationen auf D4/D13 kürzen und unter `prefers-reduced-motion` ganz abschalten. |
| 2.1 Modusfarben | Keine `--mode-*`-Tokens; Kontrasttest kennt nur Grundpalette. | `--mode-{vocabulary,path,pronunciation,media,special}-{surface,text}` in allen vier Paletten mit den gemessenen Phase-0-Werten; Kontrasttest erweitert. |
| 2.2 Modus-Dock | Nicht vorhanden. Niveau-Layout prüft nur die Niveau-Freigabe. Moduswechsel nur über Kacheln unten auf der Niveau-Seite. | `components/dashboard/ModeDock.tsx` im Niveau-Layout, Ziele zentral in `lib/mode-targets.ts` (Lernpfad → `exercises` bis Phase 3). Sperren inkl. deutscher Oberfläche, Zähler für fällige Karten/ungelesene Antworten, „Neu“-Platz. |
| 2.3 Niveau-Seite | Oben `LevelPath` („Dein Lernweg“ mit Vokabel-Stationen), unten `TrainerStatusTiles`. „Lernweg“ in UI-Texten (`student-ui-i18n.ts`, `dictionaries/*.json`: `lernkasten_all_done_hint`), Kommentaren und Tests. | Übersicht: Karte „Weiter, wo du aufgehört hast“ + vier gleich große Modus-Karten mit Kennzahl. `LevelPath` wandert nach `/vocabulary/lessons` und heißt „Lektionen“; alle fünf Sprachen umbenannt; Grep-Test. |
| 2.4 Brotkrumen | `DashboardHeader` überspringt `level`, zeigt am Handy nur Zurück-Pille + Titel; volle Spur nur ab `md`. `DASHBOARD_ROUTE_KEYS` ohne Lernpfad/Pfad/Knoten/Test. | Voller Pfad `Start › A1.1 › …` auf allen Breiten (`nav` + `ol`, letztes Glied `aria-current`), mobile Spur waagerecht scrollbar mit Auto-Scroll zum Ende. Schlüssel erweitert; sechs Routen getestet. |
| 2.5 Untere Leiste | `.st-tabbar` fest, kein Scrollverhalten; Aufnahme-Dock mit `bottom: var(--st-tabbar-h)` gekoppelt. | Zustand `data-tabbar="hidden"` am Shell-Element, sichtbare Höhe `--st-tabbar-visible` steuert Leiste, Inhaltsabstand und Aufnahme-Dock. Schwellen aus D8 (56 px Tiefe, 8 px Bewegung), sichtbar oben/unten, bei Fokus, offenem Blatt. |
| 2.6 Letztes Niveau | Home nimmt erstes Niveau mit 0 < Fortschritt < 100; „Lernen“ nutzt `localStorage` `sitov:last-level`. Keine RPC. Nächste freie Migrationsnummer laut STATUS **32** — geprüft: `supabase/vps/32_*` existiert nicht, `ORDER` endet mit 31. | Migration `32_last_active_level.sql` + Rückweg: `public.get_last_active_level()` (SECURITY DEFINER, JSONB-Fehler). Quellen: `answer_receipts`, `vocabulary_direction_progress.last_answered_at`, Grammatikversuche, Aussprache-Aufnahmen; nur gültig freigeschaltete Niveaus; Rückfall angefangen → erstes freigeschaltetes. Home-Überschrift „Deine Lernbereiche · A1.2“ + Knopf zum letzten Modus. `localStorage` nur noch Rückfall. |
| 2.7 Mikroanimationen | Teilweise CSS-Animationen (70 ms), Antwort-Rückmeldung ohne Pop/Wackeln. | D5 auf Home, Niveau-Seite, Dock, Brotkrumen, Lernbox-Übersicht, Antwort-Rückmeldung; Playwright mit `reducedMotion: 'reduce'` prüft `document.getAnimations()`. |

### Grenzen dieser Umgebung (vorab festgehalten)

- Kein Zugriff auf den VPS: R8 (Backup über `migrate-local.py`) und die produktive Aktivierung von Migration 32 können in dieser Sitzung **nicht** ausgeführt werden. Die Migration wird idempotent mit Rückweg angelegt, in PGlite doppelt angewendet und zurückgerollt; die produktive Anwendung folgt dem Phase-1-Ablauf (`--prepare-only` → Backup/`--apply 32_last_active_level.sql --keep-stopped` → `--activate … --schema-changed`).
- `schema.sql`/`database.types.ts` werden in Phase 1 aus einem echten Klon exportiert. Ohne Klon werden die Einträge für die neue Funktion von Hand im Exportformat ergänzt und im Bericht als solche ausgewiesen.
- Playwright: nur Chromium 1194 vorinstalliert (Playwright 1.58.2 erwartet 1208, WebKit fehlt). Tests laufen über `executablePath` mit diesem Chromium; „iPhone 14“ wird mit der Geräteemulation (Viewport, DPR, Touch, UA) in Chromium ausgeführt. `e2e/pronunciation-mobile.spec.ts` braucht das isolierte VPS-Test-Gateway (`E2E_SUPABASE_URL`) und ist hier nicht ausführbar.
- Geschützte Lernraum-Seiten werden, wie in Phase 0/1, gegen ein kurzlebiges Loopback-Fixture mit künstlichen Daten geprüft — diesmal als versioniertes Testwerkzeug (`e2e/helpers/phase2-fixture.mjs`), nicht als temporäre Datei.

Keine Ressourcenlimits, keine neuen Hintergrunddienste (R2), keine externen Ressourcen (R3). Phasen 3–8 werden nicht ausgeführt.

## Test-Nachprüfung ab `6bdb3c9` (26.09.2026)

Prüfung vor Änderungen: sauberer Arbeitsbaum auf `codex/vps-self-hosted`, HEAD
`6bdb3c92366811620c4487699542ace382901dff`. Auftrag: ausschließlich Phase-2-Tests
reparieren und den nachträglichen i18n-Fix absichern; keine Produktänderungen,
Migrationen oder Aktivierung. Lokale Next-Dokumentation zur Proxy-Konvention gelesen.

| Ist | Soll |
|---|---|
| Phase-2-Browserlauf nach letzten Korrekturen nicht wiederholt | Vollständiger lokaler Lauf Desktop/Pixel 7/iPhone 14, Fehler ohne Skip oder Axe-Filter aufklären |
| iPhone zuvor nur in Chromium emuliert | Installiertes WebKit verwenden; CDP-basierte Safe-Area-Prüfung benötigt browsergerechte Testinfrastruktur |
| `6bdb3c9` ohne Tests für Accept-Language, Registrierung und Übersetzungsschutz | Regressionstests für diese tatsächlich geänderten Verträge |
| Vollständiger DB-Lauf offen | Alle lokalen DB-Testdateien ausführen; keine Produktivdaten ändern |

### Korrekturen im Testauftrag

- Veraltete LevelCard-Assertion auf das dekorative `data-number`-Relief und
  `aria-hidden` umgestellt; die zweistellige Nummer bleibt geprüft.
- Regressionen für `6bdb3c9`: gewichtete Browsersprachen einschließlich regionaler
  Sprachkürzel und Fallbacks, Profilvorrang, explizite Seitensprache, Cookie-Erhalt,
  Registrierungs-Metadaten für alle vier Übersetzungssprachen, sichtbare Sprachwahl,
  HTML-Übersetzungsschutz und temporärer Redirect samt Query/Vary im Browser.
- iPhone-Projekt verwendet auch mit `E2E_BROWSER_CHANNEL=chrome` weiterhin WebKit.
  Nur ein expliziter `E2E_CHROMIUM_PATH` aktiviert weiterhin Chromium-Emulation.
- Safe-Area-Test nutzt in Chromium CDP; in WebKit werden ausschließlich
  `env(safe-area-inset-*)`-Werte in den gelieferten CSS-Dateien durch die gleichen
  59/34-px-Testwerte ersetzt. Layoutregeln und sämtliche Assertions bleiben erhalten.
- Gemeinsame künstliche Sitzung nach `e2e/helpers/phase2-session.ts` ausgelagert.
  Die vorhandenen Aussprache-UI-Assertions laufen nun zusätzlich in der lokalen
  Phase-2-Konfiguration, in beiden Themes und allen drei Projekten. Der originale
  Gateway-Pfad mit echten Auth-/RLS-Abfragen und Aufräumen bleibt erhalten.

### Infrastruktur und Grenzen

Der erste Jest-Lauf hatte einen veralteten LevelCard-Test und den bekannten
bedingten Smoke-Skip. Der abschließende vollständige Lauf aktiviert den Smoke
über einen temporären SSH-Forward zu `127.0.0.1:9080`; dieser liest ausschließlich
`courses` und prüft den verweigerten Zugriff auf `people`. Keine Produktivdaten
wurden geschrieben, der Forward wurde anschließend beendet.

Playwrights Chromium-Headless-Paket fehlte. Der Download blieb unter lokalem
Node 26 hängen; für den Testlauf wurde der vorhandene Chrome genutzt. Auch der
Node-26-Testserver blieb später mit hoher CPU-Last hängen. Diese eigenen Prozesse
wurden beendet und der Browserlauf einschließlich Testserver mit Node 24.19.0
neu gestartet. iPhone läuft mit installiertem WebKit, ohne Chromium-Ersatz.
Die ersten neu ergänzten Browserassertions wurden korrigiert: tatsächlicher
Sprachwahl-Name aus dem Dictionary, relative Location-Header gegen die Antwort-URL
auflösen. Diese Testfehler sind keine Fehler des Übersetzungsfixes.

Das isolierte schreibende VPS-Gateway ist nicht aktiv und wurde nicht neu
angelegt. Der lokale Aussprachelauf ist ein UI-Nachweis mit künstlichen Daten,
kein Ersatznachweis für dessen Auth-/RLS-Integration. Die vollständigen lokalen
DB-Tests prüfen die Datenbankverträge separat. Migration 32, Schema-Export,
Produktivaktivierung sowie die noch offenen Screenshot-/Lighthouse-Nachweise
gehören nicht zu diesem reinen Testauftrag und bleiben unverändert offen.

### Zwischenstand vor der freigegebenen CSS-Korrektur

| Prüfung | Ergebnis |
|---|---|
| Vollständiger Jest-Lauf inkl. rein lesendem VPS-Smoke | **1.792 bestanden**, 142 Suites, 0 Fehler, 0 Skips |
| Vollständiger lokaler DB-Lauf | **423 bestanden**, 0 Fehler, 0 Skips |
| `npm run build` gegen Loopback-Fixture | Exit 0 |
| `npx tsc --noEmit` | Exit 0 |
| Playwright Phase 2, Desktop/Pixel 7/iPhone 14 | **173 Fälle bestanden, 4 weiterhin rot**, 0 Skips; siehe Laufaufteilung unten |

Der vollständige Browserlauf umfasste 177 Fälle: 162 bestanden, vier
Kontrastbefunde und elf WebKit-Testinfrastrukturfehler (`mouse.wheel` wird in
mobilem WebKit nicht unterstützt). Nach Umstellung auf echtes programmatisches
Scrollen wurden alle 15 fehlgeschlagenen Fälle erneut ausgeführt: **11 bestanden,
4 unverändert rot**. Damit ist kein vollständig grüner Browserlauf belegt.
Desktop: alle 59 Fälle grün. Die Aussprache-UI-Tests bestehen in allen drei
Projekten und beiden Themes, einschließlich tatsächlichem Klick und
Mikrofonberechtigungs-Rückmeldung. Kein Axe-Filter, `skip` oder abgeschwächter
Erwartungswert wurde hinzugefügt.

**Verbleibender Anwendungsbefund:** `/en/dashboard/level/A1.1/vocabulary`, jeweils
hell/dunkel auf Pixel 7 und iPhone 14: Axe `color-contrast` für die drei sichtbaren
`.lb-plate__numeral`-Fachnummern. In `components/vocabulary/LeitnerBoxOverview.tsx`
steht die dekorative Nummer als Textknoten; `components/vocabulary/lernkasten.css`
setzt dessen Deckkraft auf `0.14`. Eine zusätzliche Messung nach 2,5 Sekunden
bestätigt im dunklen Pixel-Layout **1,27:1 statt mindestens 3:1**; kein flüchtiger
Animationsbefund. Der Test bleibt korrekt rot. Wegen des ausdrücklichen Test-only-Auftrags wurde der Commit zunächst
zurückgestellt. Anschließend hat der Nutzer die Korrektur im Anwendungscode
explizit freigegeben; der Abschlussnachweis folgt unten.

Reproduktion (Node 24 LTS; installierter Chrome und Playwright-WebKit):

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54329 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=phase2-local-placeholder \
SUPABASE_INTERNAL_URL=http://127.0.0.1:54329 \
SUPABASE_SERVICE_ROLE_KEY=phase2-local-placeholder \
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3100 SITE_URL=http://127.0.0.1:3100 \
NEXT_TELEMETRY_DISABLED=1 npm run build
E2E_BROWSER_CHANNEL=chrome npx playwright test --config=e2e/phase2.config.ts
E2E_BROWSER_CHANNEL=chrome npx playwright test --config=e2e/phase2.config.ts --last-failed
node --test supabase/tests/*.test.mjs
npx tsc --noEmit
```

Jest-Smoke analog zur [Phase-0-Baseline](TEST-BASELINE.md): temporärer
Loopback-SSH-Forward, `RUN_SELF_HOSTED_INTEGRATION=1`,
`SELF_HOSTED_TEST_URL=http://127.0.0.1:54322` und ausschließlich im Prozess
bereitgestellter Anon-Key, dann `npm test -- --runInBand`. Keine Schlüssel
in Testdateien oder Nachweisen gespeichert.


### Abschluss nach freigegebener Kontrastkorrektur — 26.09.2026

Der Nutzer hat die minimale Anwendungskorrektur ausdrücklich erlaubt. Die
Fachnummern verwenden jetzt ihre vorhandenen Farbtokens mit voller Deckkraft,
auch im hohen Kontrastmodus. Sie stehen mit 18 px in einer eigenen Zeile statt
als große, transparente Überlagerung hinter der Wortanzahl. Die Darstellung
wurde am Pixel-Layout visuell geprüft; ein zusätzlicher Browservergleich der
Bounding-Boxes sichert auf allen drei Geräten ab, dass Zahl und Wortanzahl sich
nicht überlagern. Zusätzliche Axe-Messungen der dunklen Ansicht in Standard-
und hohem Kontrast melden jeweils keine Verstöße.

| Abschließende Prüfung | Bestanden | Fehler | Skips |
|---|---:|---:|---:|
| Jest inkl. rein lesendem VPS-Smoke | **1.792**, 142 Suites | 0 | 0 |
| Alle lokalen DB-Testdateien | **423** | 0 | 0 |
| Playwright, vollständiger Lauf | **177**, 59 je Gerät | 0 | 0 |
| Build nach finaler CSS-Korrektur | Exit 0 | 0 | — |
| TypeScript nach finaler Änderung | Exit 0 | 0 | — |

Playwright lief unter Node 24.19.0 in 4,8 Minuten, ohne Wiederholungen und ohne
Axe-Filter. Desktop/Pixel 7: lokaler Chrome; iPhone 14: WebKit. Enthalten sind
66 vollständige Axe-Prüfungen (öffentliche Seiten, sieben Lernraumrouten und
Aussprache-UI jeweils hell/dunkel auf allen drei Geräten). Die ausstehende
Gateway-Integration wird dadurch nicht als durchgeführt ausgegeben.

**Lokaler Phase-2-Testauftrag abgeschlossen**, einschließlich Regressionen für
`6bdb3c9` und der freigegebenen CSS-Korrektur. Git-Abgabe zusammen mit den Tests
und diesem Nachweis auf `codex/vps-self-hosted`. Die produktive Aktivierung von
Migration 32, der echte Klon-Export, der separate Gateway-Auth-/RLS-Lauf sowie
formale Vorher/Nachher- und Lighthouse-Nachweise bleiben außerhalb dieses
Testauftrags offen. Daher wird hier keine vollständige produktive
Phase-2-Abnahme behauptet.
