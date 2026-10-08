# Sitov Academy: Abhängigkeiten am 8. Oktober 2026

Der offene Punkt T8 wurde erneut gegen den tatsächlich installierten npm-Baum, die npm-Registry und die Upstream-Meldungen geprüft. Zwei inzwischen korrigierbare transitive Pakete sind im Lockfile aktualisiert. Die ursprüngliche `braces`-Kette bleibt offen, weil weiterhin keine korrigierte Version veröffentlicht ist. Es wurde keine inkompatible Toolchain-Migration erzwungen und nichts produktiv bereitgestellt.

## Kompatible Korrekturen

| Paket | Vorher | Geprüfter Stand | Grund |
| --- | --- | --- | --- |
| `sharp` | 0.35.4 | **0.35.5** | Korrigiert die gemeldete librsvg-Schwachstelle; die bereitgestellten Binärpakete enthalten librsvg **2.63.2**. |
| `source-map-js` | 1.2.1 | **1.2.2** | Begrenzt und validiert Abschnitts-Offsets in indizierten Source Maps. |

Die korrigierten Versionen sind durch das [sharp-Upstream-Advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w) und die [Source-Map-Meldung](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) belegt. `npm update sharp source-map-js` hat ausschließlich diese Pakete und die dazugehörigen optionalen `@img/sharp-*`-/libvips-Pakete geändert. Die Linux-, macOS-, Windows- und WASM-Pins im Lockfile wurden gemeinsam aktualisiert. `package.json`, Next.js 16.3.8, Tailwind 3.4.19 und Jest 29.7.0 behalten ihren bisherigen Vertrag.

## Audit-Ergebnis

| Prüfung | Vorher | Danach |
| --- | --- | --- |
| `npm audit --omit=dev` | 2 hohe betroffene Pakete | **0 bekannte Meldungen** |
| `npm audit` | 36 hohe / 7 moderate betroffene Pakete | **34 hohe / 7 moderate betroffene Pakete** |

Die Zahlen zählen gemeldete Pakete einschließlich ihrer abhängigen Werkzeugketten, nicht voneinander unabhängige Schwachstellen. Das vollständige Audit enthält nach der Korrektur drei ursächliche Meldungen. Der historische Bericht vom 4. Oktober bleibt als damaliger Prüfstand erhalten; die heutige Aussage über den Produktionsbaum setzt das aktualisierte Lockfile voraus.

## Verbleibende Entwicklungsabhängigkeiten

| Ursache | Eingebundener Stand / Pfad | Verbleibende Grenze |
| --- | --- | --- |
| `braces` | 3.0.3 über `micromatch` sowie Tailwind → `chokidar` | npm veröffentlicht weiterhin 3.0.3 als neueste Version. Das [Advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) nennt keine korrigierte Version. Betroffen sind Tailwind, Next-ESLint und Jest samt Unterpaketen. |
| `postcss-selector-parser` | 6.1.4 über Tailwind 3 und `postcss-nested` 6 | Der [Upstream-Patch](https://github.com/postcss/postcss-selector-parser/security/advisories/GHSA-rj75-hqrm-r3gf) liegt in 7.1.6. Beide Verbraucher verlangen Major 6; dessen neueste Version ist weiterhin 6.1.4. Ein Override auf Major 7 würde diese veröffentlichten Kompatibilitätsverträge umgehen. |
| `sprintf-js` | 1.0.3 über `ts-jest` → `@jest/transform` → `babel-plugin-istanbul` → `@istanbuljs/load-nyc-config` → `js-yaml` → `argparse` | Auch die neueste veröffentlichte Version 1.1.3 ist laut [Advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) betroffen; eine korrigierte Version fehlt. |

Das von npm angebotene `audit fix --force` würde unter anderem Tailwind auf Major 4 und Jest auf Major 30 umstellen beziehungsweise `eslint-config-next` zurücksetzen. Das ist keine kompatible Patchkorrektur der vorhandenen Toolchain. Diese Migrationen und ein Parser-Override sind daher nicht Bestandteil dieser Änderung. Build-, Test- und Lint-Konfigurationen bleiben aus vertrauenswürdigen Repository-Quellen; fremde Glob-Muster, CSS-Selektoren und Formatstrings dürfen nicht ungeprüft in diese Werkzeuge eingespeist werden.

T8 kann erst vollständig geschlossen werden, wenn ein passender `braces`-Patch verfügbar und geprüft ist oder die betroffenen Werkzeugketten gezielt migriert und abgenommen wurden. Die zusätzlichen Parser-/Formatstring-Befunde sind bei dieser Folgeprüfung ebenfalls zu berücksichtigen. Die Registry-Prüfung ist mit `npm view braces version`, `npm view postcss-selector-parser@6 version` und `npm view sprintf-js version` wiederholbar.

## Verifikation

- `npm run build`: erfolgreich; Next.js-Kompilierung, TypeScript-Prüfung und Erzeugung aller 293 statischen Seiten bestanden.
- Echter Bildverarbeitungstest: SVG decodiert, auf 60 × 40 Pixel skaliert, als WebP und AVIF codiert und erneut decodiert; `sharp` 0.35.5 und librsvg 2.63.2 zur Laufzeit bestätigt.
- CSS-/Source-Map-Test: PostCSS-Transformation mit externer Source Map und Rückzuordnung zur Quelldatei bestanden. Ungültige beziehungsweise übergroße indizierte Abschnitts-Offsets werden synchron abgewiesen; ein gültiger Abschnitt liefert seine erwartete Zuordnung.
- `npx eslint next.config.ts tailwind.config.ts lib/sitov-security-headers.ts`: erfolgreich.
- `npm test -- --runInBand --silent`: 264 Suites bestanden, eine übersprungen, eine fehlgeschlagen; 3.417 Tests bestanden, einer übersprungen, einer fehlgeschlagen. Der unveränderte Test `__tests__/vocabulary-soft-error-pages.test.tsx:40` erwartet den russischen Buttontext „Учить 1 слово сейчас“, während die Oberfläche „Начать тренировку“ liefert. Die zugehörigen UI-/Übersetzungsdateien sind ebenfalls unverändert; der Lauf ist wegen dieser separaten Erwartungsabweichung insgesamt nicht grün.
- Struktureller Lockfile-Vergleich: nur `sharp`, `source-map-js` und zugehörige `@img/sharp-*`-Pakete geändert.
- Beide npm-Audits nach der Installation erneut ausgeführt; Ergebnisse oben.
- `git diff --check` für Lockfile und Bericht: erfolgreich.

Der lokale Build meldet den bereits bestehenden Hinweis auf eigene Cache-Control-Header für `/_next/static/:path*`. Diese Änderung betrifft diesen Headervertrag nicht. Die Bildverarbeitung wurde auf dem Mac geprüft; eine separate Laufzeitprobe auf dem produktiven Linux-Host und die Bereitstellung sind noch nicht erfolgt.
