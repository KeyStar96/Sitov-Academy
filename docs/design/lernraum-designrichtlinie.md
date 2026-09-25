# Lernraum: „Subtle Luxury, verspielt“

Stand: 25.09.2026 · Phase 0 · geprüfte Ausgangsrevision `e123fab0ba49177c3c15f06db10249d92eb688d9`.

Dieses Dokument beschreibt das Soll für spätere Phasen und den dazu geprüften Bestand. Phase 0 ändert keine Komponenten, CSS-Dateien, Übersetzungen oder Datenbankobjekte. Neue Token-Namen, Farbwerte und Code-Beispiele unten sind **Vorschläge, noch nicht implementiert**. Bestehende Abweichungen bleiben als Ausgangslage sichtbar.

## Quellen und Geltung

- [CODEX-4-Grundregeln](../master-4/prompts-split/00_CODEX-4-RULES.md): vollständig gelesen; R1–R16, D1–D8 und D12, Ablauf S1–S7.
- [Phase 0](../master-4/prompts-split/00_PHASE-0-GPT.md): vollständig gelesen; Bestandsaufnahme, Richtlinie, Kontrastmessung und Beispiele.
- [MASTER-PROMPT-4.md](../../MASTER-PROMPT-4.md), Abschnitt „DESIGN-RICHTLINIE“, Zeilen 172–272: vollständige Quelle D1–D13. **D9, D10, D11 und D13 fehlen nur in der Kurzfassung, nicht im Repository.** Sie sind unten aus dem Master übernommen, keine erfundenen Ergänzungen. Auch die Status-Vorlage ist dort im Anhang B ab Zeile 825 vorhanden.
- [ZWISCHENBERICHT](../master-4/ZWISCHENBERICHT.md), Abschnitte 3 und 5: technische Bestandsannahmen und Designentscheidungen. Bei Abweichungen zum aktuellen Quelltext wird der gemessene Bestand ausgewiesen; spätere Phasen werden hier weder ausgeführt noch neu festgelegt.
- [Prüfbericht](../master-4/PRUEFBERICHT.md), [Status](../master-4/STATUS.md) und [Ist-Bilder](../master-4/ist/): Inventar, Testnachweise und visueller Vorher-Vergleich.

Die Zeilenangaben beziehen sich auf die Ausgangsrevision. R13 (Zugänglichkeit), R15 (positive Aktion rechts/unten), R12 (fünf Sprachen) und R3 (lokal ausgelieferte Ressourcen) gelten für jedes Muster. Die Beispielschnipsel führen keine neuen Produkttexte ein; Beschriftungen kommen als bereits übersetzte Werte herein.

## D1 — Haltung und Orientierung

Ruhige Flächen, Weißraum, zurückhaltende Glas-Karten, Slate als Basis und warmes Orange als Marke bleiben erhalten. Kleine Reaktionen auf Berührung und kurze Erfolgsrückmeldungen geben Orientierung. Keine Comicfiguren, grellen Vollflächen, überraschenden Geräusche oder belohnungsgetriebener Leistungsdruck. Jeder Bildschirm macht Ort, verfügbare Handlung und nächsten Schritt erkennbar.

Glas ist eine Oberflächenbehandlung, keine Erlaubnis für unlesbaren Text. Der Kontrast muss über dem tatsächlichen Untergrund stimmen; im hohen Kontrastmodus werden Flächen deckend. Ein ruhiger Vollton ist der Fallback bei fehlendem Blur. Bestehende `.sl-glass`-Regeln setzen zwar zuerst einen Vollton, danach jedoch unabhängig von Blur-Unterstützung die transparente Mischung; der Kommentar verspricht damit mehr als die CSS-Kaskade garantiert. Das ist ein Prüfpunkt für Phase 2.

## D2 — Farben und vorhandene Bausteine

Komponenten verwenden semantische Tokens statt neuer Hex-Literale. Literalwerte in den folgenden Tabellen dokumentieren Messdaten und einen späteren zentralen Token-Vorschlag. Sie sind keine Freigabe für verstreute Komponentenfarben.

### Geprüftes Token-Inventar

Die maßgeblichen, später in der Kaskade stehenden Definitionen befinden sich in [app/globals.css](../../app/globals.css), Zeilen 1057–1169. Die älteren `:root`-/`html.dark`-Blöcke ab Zeile 14 werden für viele Werte überschrieben. Insbesondere sind Sand und Schwarz dort nicht die endgültigen Standardflächen.

| Rolle / Tokens | Hell | Dunkel | Fundort |
|---|---|---|---|
| Leinwand `--canvas`, Alias `--background` | `#f8fafc` | `#0f172a` | `app/globals.css:1059`, `:1093` |
| Karte `--surface` | `#ffffff` | `#1e293b` | `app/globals.css:1061`, `:1095` |
| Abgesetzte Fläche `--surface-muted` | `#f1f5f9` | `#334155` | `app/globals.css:1062`, `:1096` |
| Text `--foreground`, Nebentext `--muted` | `#0f172a` / `#475569` | `#f8fafc` / `#a8b4c6` | `app/globals.css:1063`, `:1097` |
| Kontur `--border`, verstärkt `--border-strong` | `#7c8ba1` / `#5d6b81` | `#8b99ae` / `#cbd5e1` | `app/globals.css:1065`, `:1099` |
| Marke für dekorative Akzente `--accent` | `#f97316` | `#f97316` | `app/globals.css:1067`, `:1101` |
| Lesbarer Markentext `--accent-text` | `#c2410c` | `#fb923c` | `app/globals.css:1071`, `:1105` |
| Texttragende Füllung `--accent-strong`, Hover `--accent-strong-hover` | `#c2410c` / `#9a3412` | identisch | `app/globals.css:1069`, `:1103` |
| Text auf Füllung `--accent-foreground` | `#ffffff` | `#ffffff` | `app/globals.css:1072`, `:1106` |
| Sanfte Markenfläche `--accent-soft`, Fokus-/Glanzfarbe `--accent-ring` | `#fff7ed` / `#f9731666` | `#431407` / `#f9731659` | `app/globals.css:1073`, `:1107` |
| Kühle Sekundärfarbe `--violet` (bestehendes Indigo) | `#4f46e5` | `#a5b4fc` | `app/globals.css:1079`, `:1112` |
| Erfolg `--success`, Fehlertext `--danger` | `#166534` / `#b91c1c` | `#4ade80` / `#fca5a5` | `app/globals.css:1080`, `:1113` |
| Schreibhinweis `--warning`, `--warning-foreground` | `#fef3c7` / `#713f12` | `#fde68a` / `#422006` | `app/globals.css:28`, `:42` (weiterhin wirksam) |
| Tiefe `--shadow-sm`, `--shadow-md`, `--shadow-lg`; Gold `--gold-*`, `--gold` | themeabhängig | themeabhängig | `app/globals.css:1075`, `:1082`, `:1109`, `:1115` |
| Schrift `--font-sans`, `--font-mono` | Inter / JetBrains Mono | identisch | `app/[lang]/layout.tsx:42–53`; Einsatz `app/globals.css:64` |
| Lernoberflächen `--learn-*` | Aliasse auf globale Tokens | folgen dem Theme | `components/vocabulary/learning.css:1–7` |
| Untere Leiste `--st-tabbar-h` | `calc(4.6rem + env(safe-area-inset-bottom, 0px))` | identisch | `components/dashboard/student.css:175` |

`html.high-contrast` überschreibt die Palette ab `app/globals.css:1125`, `html.dark.high-contrast` ab Zeile 1148. Dort ist `--accent-foreground` **schwarz** auf einer hellorangen Füllung; deshalb niemals Weiß hart kodieren. Erscheinungswahl und Systempräferenzen werden in [lib/theme.ts](../../lib/theme.ts) verwaltet. Bestehende Kontrasttests prüfen vier Paletten und bereits strengere 7:1 für Text im hohen Kontrastmodus: [__tests__/appearance-contrast.test.ts](../../__tests__/appearance-contrast.test.ts).

Tailwind ordnet diese Variablen ab [tailwind.config.ts](../../tailwind.config.ts), Zeile 34, Farben zu. Variablenfarben haben dort kein `<alpha-value>`-Schema: nicht auf `bg-accent/10` oder `bg-[var(--x)]/10` verlassen. Der Bestand nutzt `color-mix(in srgb, var(--accent) 12%, var(--surface))`; in einer beliebigen Tailwind-Klasse entspricht das etwa `bg-[color-mix(in_srgb,var(--accent)_12%,var(--surface))]`. Kontrast gegen die resultierende Mischfarbe messen.

`--accent` ist kein Texttoken und orange-500 mit weißem Text erreicht keine 4,5:1. Füllungen mit Text verwenden `--accent-strong` und `--accent-foreground`. Messung des bestehenden Knopfpaars: **5,18:1** normal und **7,31:1** bei Hover in beiden Standard-Themes; hoher Kontrast hell **7,31/9,37:1**, hoher Kontrast dunkel **12,45/15,51:1**.

### Wiederverwendbare Klassen und Einstiegspunkte

| Baustein | Tatsächlicher Fundort | Verwendung / Grenze |
|---|---|---|
| `.sl-glass` | `app/globals.css:1349` | Glasfläche; Textkontrast über dem tatsächlichen Hintergrund prüfen |
| `.sl-card`, `data-selected`, `data-disabled` | `app/globals.css:1358` | Karte mit Auswahlkontur und gestricheltem Sperrzustand |
| `.sl-chip` | `app/globals.css:1367` | Pille; derzeit 2,75 rem Mindesthöhe, für interaktive Nutzung auf ≥48 px prüfen |
| `.sl-icon-tile`, `.sl-bar`, `.sl-hero` | `app/globals.css:1372`, `:1377`, `:1387` | Akzent, Fortschritt, Seitenauftakt; Breitenanimation des Balkens entspricht noch nicht D4 |
| `.academy-button-primary`, `.academy-button-outline` | `app/globals.css:1213–1214` | Semantische Füllung bzw. Kontur; Lernraum-Mindestmaße zusätzlich beachten |
| `.st-press`, `.st-rise`, `.st-pop` | `components/dashboard/student.css:19–23` | CSS-Druck bereits 0,97; bestehende Staffelung 70 ms, Soll 40 ms |
| `.st-button`, `--primary`, `--soft` | `components/dashboard/student.css:32–34` | Knöpfe im Lernraum, derzeit 52 px Mindesthöhe |
| `.st-sheet-*` | `components/dashboard/student.css:54–78` | Blatt/Dialog; eigentliche Fokuslogik in `components/ui/BottomSheet.tsx` separat prüfen |
| `.st-today-*`, `.st-tile-*` | `components/dashboard/student.css:80–139` | Home und Lernbereichskacheln |
| `.st-tabbar-*` | `components/dashboard/student.css:175–196` | Mobile Navigation; derzeit CSS-Pille und dauerhafte Position unten |
| `.st-path-*` | `components/dashboard/student.css:205–245` | **Bestehende Vokabel-Lektionsliste**, noch keine Grammatik-Lernpfadkarte D9 |
| `.learning-screen`, `.learning-workspace`, `.learning-card` | `components/vocabulary/learning.css:1`, `:22`, `:34` | Lernansicht, Scrollfläche und Karte |
| `.learning-word`, `.learning-sentence`, `.learning-solution` | `components/vocabulary/learning.css:40` | Gemeinsame große Lernschrift, Sonderregeln bei geringer Höhe |
| `.learning-button`, `-primary`, `-secondary` | `components/vocabulary/learning.css:54`, `:56`, `:126` | Bestehende Aktionsknöpfe |
| `.learning-mode-track`, `-option`, `-pill`, `-face` | `components/vocabulary/learning.css:65–73` | Bewegte Pille hinter Beschriftung |
| `StudyModeToggle` | `components/vocabulary/StudyModeToggle.tsx:34–79` | Reales `layoutId`-Muster mit `useReducedMotion`; lokale Radio-Auswahl, kein Routen-Dock |
| `DashboardHeader` | `components/layout/DashboardHeader.tsx:57` | Desktop-Brotkrumen und derzeit verkürzte Handy-Navigation |
| `StudentNavigation` | `components/dashboard/StudentNavigation.tsx:27` | Start, Lernen, Kalender, Hilfe; letzter Level aus Browser-Speicher |

Vorhandene Regeln sind kein pauschaler Nachweis der neuen Anforderungen. Insbesondere werden die Vokabel-Lektionen später „Lektionen“ heißen, während „Lernpfad“ ausschließlich den Grammatik-Pfad bezeichnet.

### Neue Modus-Tokens — messbarer Vorschlag für Phase 2

Jeder Modus erhält `--mode-<name>-surface` für eine kleine, deckende Kennfläche und `--mode-<name>-text` für Text, Symbol und eine erforderliche Kontur. Kennfarben erscheinen im aktiven Modus, Seitenkopf und feinen Kartenakzent, nicht als großflächiger Seitenhintergrund. Orange bleibt Vokabeln, Blau Lernpfad, Violett Aussprache, Petrol Mediathek. Grün als **Moduskennung** bleibt Spezial-Zweigen vorbehalten; vorhandene grüne Erfolgssemantik bleibt bestehen.

`--mode-vocabulary-surface: var(--accent-soft)` und `--mode-vocabulary-text: var(--accent-text)` können Aliasse sein; die Markenfarbe `--accent` bleibt für dekorative Akzente. Die weiteren Werte sind neue Vorschläge. Globale `--violet`-/Erfolgstokens werden dadurch nicht ersetzt.

In den Tabellen bedeutet **Paar**: Text auf vorgeschlagener Kennfläche. **Minimum**: derselbe Text auf der jeweils ungünstigsten bestehenden Fläche `--canvas`, `--surface`, `--surface-muted`. Alle Werte sind berechnete Kontrastverhältnisse, auf zwei Nachkommastellen gerundet; der Vergleich mit Grenzwerten erfolgt ungerundet.

| Theme | Name (`--mode-…`) | `-surface` | `-text` | Paar | Minimum |
|---|---|---|---|---:|---:|
| Hell | `vocabulary` (Aliasse) | `#fff7ed` | `#c2410c` | 4,88:1 | 4,73:1 |
| Hell | `path` | `#eff6ff` | `#1e40af` | 8,01:1 | 7,96:1 |
| Hell | `pronunciation` | `#f5f3ff` | `#5b21b6` | 8,19:1 | 8,20:1 |
| Hell | `media` | `#f0fdfa` | `#115e59` | 7,27:1 | 6,92:1 |
| Hell | `special` | `#f0fdf4` | `#166534` | 6,81:1 | 6,51:1 |
| Dunkel | `vocabulary` (Aliasse) | `#431407` | `#fb923c` | 6,92:1 | 4,58:1 |
| Dunkel | `path` | `#172554` | `#93c5fd` | 8,15:1 | 5,74:1 |
| Dunkel | `pronunciation` | `#2e1065` | `#c4b5fd` | 8,25:1 | 5,61:1 |
| Dunkel | `media` | `#042f2e` | `#5eead4` | 9,78:1 | 7,00:1 |
| Dunkel | `special` | `#052e16` | `#86efac` | 10,62:1 | 7,37:1 |
| Hoher Kontrast hell | `vocabulary` (Aliasse) | `#fff1e6` | `#7c2d12` | 8,47:1 | 8,30:1 |
| Hoher Kontrast hell | `path` | `#eff6ff` | `#1e3a8a` | 9,52:1 | 9,17:1 |
| Hoher Kontrast hell | `pronunciation` | `#f5f3ff` | `#4c1d95` | 9,99:1 | 9,70:1 |
| Hoher Kontrast hell | `media` | `#f0fdfa` | `#134e4a` | 9,09:1 | 8,39:1 |
| Hoher Kontrast hell | `special` | `#f0fdf4` | `#14532d` | 8,70:1 | 8,07:1 |
| Hoher Kontrast dunkel | `vocabulary` (Aliasse) | `#1a0f06` | `#fdba74` | 11,17:1 | 10,32:1 |
| Hoher Kontrast dunkel | `path` | `#172554` | `#bfdbfe` | 10,34:1 | 12,25:1 |
| Hoher Kontrast dunkel | `pronunciation` | `#2e1065` | `#ddd6fe` | 10,97:1 | 12,53:1 |
| Hoher Kontrast dunkel | `media` | `#042f2e` | `#99f6e4` | 11,48:1 | 13,80:1 |
| Hoher Kontrast dunkel | `special` | `#052e16` | `#bbf7d0` | 12,30:1 | 14,36:1 |

Alle vorgeschlagenen Paare erreichen ≥4,5:1 in Standard-Themes und ≥7:1 in hohen Kontrastmodi, auch als Text auf den drei bestehenden Grundflächen. Die Kennfläche selbst hebt sich mit nur etwa **1,00–1,51:1** von Grundflächen ab und ist deshalb **keine ausreichende Bedienelement-Kontur**. Wo eine Kontur zur Erkennbarkeit nötig ist, `--border` oder den gemessenen Modus-Texttoken einsetzen; Fokus und Auswahl zusätzlich durch Form, Text und Semantik kennzeichnen. Die Tabellen bestätigen weder Weiß auf diesen Kennflächen noch halbtransparente Mischungen oder Text über Fotos.

**Messmethode und Reproduktion:** Am 25.09.2026 lokal mit Node berechnet, ohne CSS-/Teständerung. Dieselbe sRGB-Methode verwendet `__tests__/appearance-contrast.test.ts:8–38`: Kanal `c = byte / 255`; Linearisierung `c / 12,92` für `c ≤ 0,04045`, sonst `((c + 0,055) / 1,055)^2,4`; relative Luminanz `L = 0,2126 R + 0,7152 G + 0,0722 B`; Kontrast `(Lhell + 0,05) / (Ldunkel + 0,05)`. Die Grundflächen wurden aus allen passenden exakten Selektoren der CSS-Kaskade gelesen: `:root`, dann ggf. `html.dark`, `html.high-contrast`, `html.dark.high-contrast`.

Kurze reproduzierbare Beispielrechnung (Node; weitere Tabellenwerte analog):

```js
const rgb = hex => [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
const luminance = hex => rgb(hex)
  .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0)
const contrast = (a, b) => {
  const [lo, hi] = [luminance(a), luminance(b)].sort((x, y) => x - y)
  return (hi + 0.05) / (lo + 0.05)
}
console.log(contrast('1e40af', 'eff6ff').toFixed(2)) // 8.01
console.log(Math.min(...['f8fafc', 'ffffff', 'f1f5f9']
  .map(surface => contrast('1e40af', surface))).toFixed(2)) // 7.96
```

Vor tatsächlicher Einführung in Phase 2 müssen alle neuen Paare einschließlich Zuständen in `appearance-contrast.test.ts` aufgenommen und am gerenderten UI geprüft werden. Die bisherige Test-Baseline enthält diese nur dokumentierten Tokens noch nicht.

## D3 — Typografie und Größen

Lernschrift mindestens 18 px, Aufgabenstellung mindestens 20 px, deutsche Zielsätze mindestens 22 px; Fließtext mindestens 16 px, Zeilenhöhe mindestens 1,5. Höchstens zwei Schriftgewichte pro Karte, keine Versalien-Absätze. Karten haben auf dem Handy mindestens 16 px Innenabstand und 20–24 px Eckenradius; Pillen 999 px Radius. Inhalt darf bei Zoom und geringer Bildschirmhöhe scrollen, statt unlesbar zu schrumpfen.

Touch-Ziele sind mindestens 48 × 48 px, Hauptaktionen mindestens 56 px hoch. `rem` beziehen sich auf die Wurzelschriftgröße, nicht auf die `body`-Schriftgröße von 18 px. Deshalb die tatsächlich berechneten Maße messen. Die vorhandenen Inter-/JetBrains-Dateien werden über `next/font/google` beim Build beschafft und danach selbst ausgeliefert (`app/[lang]/layout.tsx:3,40–53`; lokale Next-Doku `node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md`). Das ist kein Browser-CDN-Aufruf; zusätzliche externe Schrift-/Bilddienste bleiben untersagt.

## D4 — Bewegungstokens

Diese Soll-Tokens sind im Bestand **noch nicht vorhanden**; auch `lib/motion.ts` fehlt. Einführung gehört in Phase 2.

| Vorgesehenes Token | Wert | Einsatz |
|---|---|---|
| `--motion-fast` | 120 ms | Druck, Hover, Fokus |
| `--motion-base` | 200 ms | Tabs, Chips, kleine Wechsel |
| `--motion-slow` | 320 ms | Karten, Blätter, Seitenteile |
| `--motion-slower` | 500 ms | Pfadlinie, Feier-Grundbewegung |
| `--ease-out-soft` | `cubic-bezier(.22,1,.36,1)` | Standardkurve |
| Framer-Feder | `stiffness: 420`, `damping: 34` | Pille, Knoten-Pop |
| Staffelung | 40 ms, höchstens acht Elemente | Listen, Brotkrumen |

CSS verwendet Millisekunden, Framer-Dauern Sekunden. Bewegungen erfolgen über `transform`/`opacity`; keine Animation von Layout-Höhe/-Breite außer dem ausdrücklich vorgesehenen Framer-`layout`. Die SVG-Dash-Ausnahme aus D5 ist unten gesondert benannt. Bei reduzierter Bewegung sind Zustände sofort sichtbar; D4 erlaubt auch Überblenden bis 120 ms, der strengere spätere Phase-2-Nachweis „keine laufenden Animationen“ wird mit einem unmittelbaren Zustandswechsel am einfachsten erfüllt.

## D5 — Katalog und kurze Code-Beispiele

Erlaubte Muster aus der Vollquelle: Druck auf 0,97; wandernde Pille; zeichnende Pfadlinie/Fortschrittsring; einmaliger Knoten-Pop auf 1,08 mit Haken; sanftes horizontales Fehler-Wackeln ±4 px in 320 ms; Hochzählen in 500 ms; Einblenden aus 8 px mit 40-ms-Staffelung; Konfetti höchstens 1,2 s ausschließlich nach bestandenem Test/abgeschlossenem Niveau; „Neu“-Punkt zweimal pulsieren, dann ruhen. Keine Bewegung ersetzt Text oder Symbol, kein rotes Blinken.

Die Beispiele verwenden das lokal installierte **Framer Motion 12.23.26**. `useReducedMotion(): boolean | null` ist in `node_modules/framer-motion/dist/types/index.d.ts:876`, `layoutId` in `node_modules/motion-dom/dist/index.d.ts:2409` dokumentiert. Solange die Präferenz unbekannt ist (`null`), bewegen sich die Beispiele vorsichtshalber nicht. Next.js-Client-Grenzen wurden anhand `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md` geprüft. Funktionen als Props sind nur innerhalb einer Client-Grenze zu übergeben.

### Druck

Der vorhandene `.st-press:active` skaliert schon auf 0,97, während `.learning-button:active` noch 0,985 nutzt. Das Beispiel zeigt das Soll mit Framer; bei Integration darf kein zweiter CSS-Transform dieselbe Bewegung steuern.

```tsx
'use client'
import { motion, useReducedMotion } from 'framer-motion'

export function PressExample({ label }: { label: string }) {
  const reduced = useReducedMotion() !== false
  return (
    <motion.button type="button"
      className="min-h-14 min-w-12 rounded-2xl px-6 text-lg font-semibold bg-[var(--accent-strong)] text-[var(--accent-foreground)]"
      whileTap={reduced ? undefined : { scale: 0.97 }}
      transition={{ duration: reduced ? 0 : 0.12 }}>
      {label}
    </motion.button>
  )
}
```

### Wandernde Pille mit `layoutId`

Kompaktes Auswahlbeispiel, angelehnt an `StudyModeToggle`, mit eigenem Namensraum je Instanz. Es nutzt normale beschriftete Knöpfe mit `aria-pressed`; alle sind per Tab/Enter/Leertaste erreichbar. Das **Routen-Dock D6** braucht stattdessen Links und `aria-current="page"`. Die bestehenden CSS-Klassen positionieren die Pille hinter dem Text; die Mindestmaße werden explizit auf 48 px gesetzt.

```tsx
'use client'
import { useId, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

export function PillExample({ labels }: { labels: [string, string] }) {
  const id = useId()
  const [active, setActive] = useState(0)
  const reduced = useReducedMotion() !== false
  return <div className="learning-mode-track">
    {labels.map((label, index) => <button type="button" key={index}
      aria-pressed={active === index} onClick={() => setActive(index)}
      className={`learning-mode-option ${active === index ? 'is-active' : ''}`}
      style={{ minHeight: 48, minWidth: 48 }}>
      {active === index && (reduced
        ? <span aria-hidden="true" className="learning-mode-pill" />
        : <motion.span aria-hidden="true" className="learning-mode-pill"
            layoutId={`${id}-pill`} initial={false}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }} />)}
      <span className="learning-mode-face">{label}</span>
    </button>)}
  </div>
}
```

### Reduzierte Bewegung: Inhalt bleibt sichtbar

Unter reduzierter Bewegung wird ein gewöhnliches Element ausgegeben: kein Transform, keine Staffelung, keine versteckte Anfangsdeckkraft. Das betrifft auch programmgesteuertes Scrollen (`behavior: 'auto'`) und Zähler (sofortiger Endwert). CSS-Animationen und Pseudoelemente müssen zusätzlich ohne Animation bleiben; ein Framer-Hook allein schaltet sie nicht aus.

```tsx
'use client'
import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

export function RevealExample({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion() !== false
  if (reduced) return <div>{children}</div>
  return <motion.div initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
    {children}
  </motion.div>
}
```

## D6 — Modus-Dock

Oben unter dem Seitenkopf kleben vier gleichwertige Einstiege in dieser Reihenfolge: **Vokabeln · Lernpfad · Aussprache · Mediathek**. Immer Symbol und Beschriftung, mindestens 48 px Höhe; auf dem Handy teilen sie die Breite. Lange Übersetzungen dürfen umbrechen, nicht so verkleinert werden, dass D3 unterschritten wird. Es handelt sich um ein `nav` mit übersetztem `aria-label` und Links; der aktive Link trägt `aria-current="page"`.

Die aktive Kennfläche wandert per `layoutId`. Inhaltswechsel nutzt im normalen Bewegungsmodus `AnimatePresence mode="wait"` mit 8 px Wechselrichtung; im reduzierten Modus sofortiger Wechsel. Zähler können fällige Karten, neue Inhalte und ungelesene Aussprache-Antworten anzeigen. Gesperrte Modi bleiben mit Schloss und verständlichem Grund sichtbar. Routen und bestehende Sperrprüfungen werden in Phase 0 nicht verändert.

## D7 — Vollständige Brotkrumen

Auf Handy und Desktop den vollständigen semantischen Pfad zeigen, z. B. `Start › A1.1 › Lernpfad › Pfad 3 › Test`. `nav` mit übersetztem Namen und `ol`; vorherige Glieder sind Links, das letzte unverklinkter Text mit `aria-current="page"`. Chips enthalten Symbol und Text, Trenner sind dekorativ.

Die mobile Spur scrollt waagerecht und zeigt nach dem Laden den aktuellen Ort; Randverläufe dürfen Beschriftungen und Fokus nicht unlesbar machen. Nur neue Glieder werden gestaffelt eingeblendet, bleibende Glieder bewegen sich nicht. Auto-Scroll verschiebt keinen Tastaturfokus und erfolgt bei reduzierter Bewegung ohne weiches Gleiten. Bestehender Befund: `DashboardHeader` versteckt die volle `nav` auf dem Handy und zeigt Zurück-Pille plus Seitentitel.

## D8 — Mobile Leiste

Beim Abwärtsscrollen ausblenden, aufwärts wieder einblenden. Erst ab mehr als 56 px Scrolltiefe und mindestens 8 px Bewegung in eine Richtung reagieren. Oben, am Seitenende, bei Fokus in der Leiste und bei offenem Blatt/Dialog bleibt sie sichtbar. Bei offener Bildschirmtastatur bleibt Platz für die Eingabe; die Leiste ist ausgeblendet. Diese konkurrierenden Zustände brauchen in Phase 2 eine klar getestete Priorität, ohne fokussierte Bedienelemente zu verstecken.

Das Aussprache-Aufnahmedock folgt demselben Versatz. Die aktuelle Kopplung ist `bottom: var(--st-tabbar-h)` in `components/dashboard/student.css:192`; eine isoliert verschobene Navigationsleiste würde eine Lücke oder Überdeckung erzeugen. Safe Areas, Inhalte am Seitenende und Fokus bleiben erreichbar. Ein „Neu“-Punkt ist beim Wiedererscheinen der Leiste weiterhin vorhanden.

## D9 — Lernpfad-Karte

Der zukünftige Grammatik-Lernpfad verläuft als sanfte S-Kurve von oben nach unten. Gepunktete Verbindung zwischen blauen Knoten; abgeschlossene Abschnitte durchgezogen. Knoten 64–72 px, Symbol plus kurze sichtbare Beschriftung. Zustände sind gesperrt (Schloss und Bedingung), verfügbar (begrenzter Puls, dann ruhender Ring), in Arbeit (Fortschrittsring), geschafft (Haken und 1–3 Sterne). Der Test ist ein größerer 88-px-Wappen-/Flaggenknoten; nach Abschluss Flagge und Prozentwert.

Lektionsinseln enthalten Nummer, Titel und Kann-Ziele in einem Satz. Spezial-Zweige sind grün gestrichelt, gehen vom Ankerknoten ab und blockieren den Hauptweg nicht. Beim Öffnen wird der aktuelle Knoten sichtbar; ein beschrifteter „Weiter“-Knopf führt zum nächsten offenen Knoten. Jede Information bleibt in einer logisch geordneten Liste und vollständigen zugänglichen Beschriftung lesbar, unabhängig von räumlicher Kurve, Farbe und SVG. Verfügbare Knoten sind Links; die Erläuterung gesperrter Knoten darf keine gesperrte Aufgabe starten.

Jeder Knoten beginnt laut Zwischenbericht Abschnitt 5 mit einer Merkkarte: Regel in der Oberflächensprache, deutsche Beispiele und Farbcode. Niveau-Freischaltung bleibt bei der Lehrkraft, Tests haben kein Zeitlimit. Fortschritt, Sterne und Testergebnis sind serverseitige Ergebnisse (R5), keine aus der Animation errechneten Werte. Diese Richtlinie erzeugt keine Aufgaben oder Datenmodelle.

## D10 — „Neu“

Kleine beschriftete Pille mit Punkt oben rechts an Karte, Kachel oder Modus; am unteren „Lernen“-Einstieg nur ein Punkt mit einer entsprechenden zugänglichen Beschreibung. Verwenden: `--accent-strong` und `--accent-foreground`, nicht Weiß auf orange-500. Der Zustand verschwindet erst nach dem Öffnen des Inhalts durch die betreffende Person. Zweimaliger Anfangspuls, danach Ruhe; bei reduzierter Bewegung direkt Ruhe. Speicherung der Gesehen-Quittung gehört in Phase 6, nicht in diese Dokumentationsphase.

## D11 — Rückmeldung nach einer Antwort

| Ergebnis aus der Bewertung | Darstellung |
|---|---|
| Richtig | Grüner Haken, kurzer Pop, positives Wort, großer Weiter-Knopf rechts/unten |
| Richtig mit Schreibhinweis (Umlaut/Tippfehler) | Erfolg plus korrekte Schreibweise mit markierter Stelle; Gelb ausschließlich hierfür |
| Richtig mit neutralem Hinweis (Groß-/Kleinschreibung, Zeichensetzung) | Erfolg ohne Warnfarbe; neutraler Schreibhinweis |
| Falsch | Keine rote Vollfläche; kurzes horizontales Wackeln, Lösung groß und vorhandene Erklärung in der Oberflächensprache |

Rückmeldungen müssen als Text zugänglich sein; ein behutsames `role="status"`/`aria-live="polite"` kann das Ergebnis einmal ankündigen. Keine Wort-für-Wort-Ankündigung animierter Zähler. Fehlerkennzeichnung darf nicht ausschließlich Farbe sein. Korrekte Antworten werden erst nach der serverseitigen Bewertung, im Test erst nach Abschluss ausgeliefert (R5). Die Tabelle beschreibt das spätere Soll; Phase 0 verschiebt keine Bewertungslogik.

## D12 — Aktionsknöpfe

Sekundär/negativ links oder oben, primär/positiv rechts oder unten; DOM-, Fokus- und sichtbare Reihenfolge stimmen überein. Beispiele: „Wusste ich nicht | Wusste ich“, „Abbrechen | Speichern“. Primär gefüllt mit `--accent-strong`, sekundär umrandet; nie zwei gefüllte Hauptaktionen nebeneinander. Ladezustand hält Breite und Beschriftung stabil und verhindert Doppelabsenden. Ein Drehkreis braucht eine textliche Statusalternative und steht bei reduzierter Bewegung still.

## D13 — Grenzen

Keine roten Fehler-Vollflächen, Countdown-Uhren, Ranglisten mit Namen anderer Lernender, Zufallsbelohnungen, automatisch abgespielter Ton oder reinen Symbolknöpfe ohne sichtbare Beschriftung in der Lernenden-Oberfläche. Keine extern ausgelieferten Schriften und Bilder. Animationen dauern laut D13 höchstens 500 ms, außer der begrenzten Feier. Bestehende länger laufende Effekte sind damit kein Vorbild für neue Komponenten.

## Offene Quellenwidersprüche und Auslegung für die Umsetzung

Diese Punkte werden nicht durch eine Änderung der Quellprompts „gelöst“. Sie machen die Designentscheidung für spätere Phasen nachvollziehbar:

| Quellenlage | Auslegung / erforderlicher Nachweis |
|---|---|
| D4 nennt ausschließlich Transform/Deckkraft; D5 verlangt SVG-`stroke-dashoffset` | Die ausdrücklich genannte SVG-Linie ist eine eng begrenzte Ausnahme, kein Freibrief für Layoutanimationen; bei reduzierter Bewegung Endzustand. |
| D9: gesperrt „nicht antippbar“, zugleich Erklärung „beim Antippen“; ferner „jeder Knoten ein Link“ | „Nicht antippbar“ als **nicht startbar** auslegen. Bedingung immer sichtbar und zugänglich; eine separate erklärende Aktion kann per Tastatur bedient werden, ohne eine Aufgabe zu öffnen. Gesperrte Ziele nicht als aktive Startlinks tarnen. |
| D9 verlangt dreimaligen Puls, D10 zweimaligen Puls; D13 nennt 500 ms Höchstdauer, R13 höchstens 5 s selbstlaufende Bewegung | Konservativer Vorschlag: gesamte Pulssequenz innerhalb 500 ms, sehr geringe Amplitude ohne Blinken; anschließend Ruhe. Nicht automatisch die 5-s-Obergrenze als erlaubte Dauer jedes Effekts interpretieren. Verständlichkeit und fehlendes Flackern vor Einführung visuell prüfen. |
| Federparameter D4 versus harte 500-ms-Grenze D13 | Eine physikalische Feder hat keine durch `duration` garantierte Laufzeit. Lokale `motion-dom`-Typen weisen darauf hin, dass `stiffness`/`damping` die Dauer überschreiben. Beispiel zeigt die vorgegebene Feder; tatsächliches Ende in Phase 2 messen und bei Überschreitung eine dokumentierte Entscheidung treffen. Keine scheinbare Absicherung durch zusätzliches `duration: 0.5`. |
| D10 fordert weiße Schrift; bestehendes dunkles High Contrast verlangt schwarze Schrift | Semantisches `--accent-foreground` und gemessener Kontrast haben Vorrang vor hart kodiertem Weiß. |
| D8: bei Dialog/Fokus sichtbar, bei Bildschirmtastatur verborgen | Bei der Umsetzung Zustand und Fokus gemeinsam prüfen; keine fokussierte Navigationsaktion unsichtbar zurücklassen. Die Quelle definiert für den gleichzeitigen Fall keine vollständige Prioritätsregel. |

## Nachweisbare Bestandsabweichungen für spätere Phasen

| Fund | Ist gegenüber Soll | Zugeordnete Phase |
|---|---|---|
| `lib/motion.ts`, globale `--motion-*` | Nicht vorhanden; vereinheitlichte Tokens erst vorgeschlagen | 2 |
| `learning.css:66,146` | Modusknöpfe nur 44 bzw. 42 px Mindesthöhe statt 48 px | 2 / 8 |
| `learning.css:136` | Schreibfeld 16 px statt mindestens 18 px Lernschrift | 2 / 8 |
| `learning.css:54`, `student.css:32` | Aktionsknöpfe mindestens 52 px statt 56 px Hauptaktion | 2 / 8 |
| `learning.css:34,146,149` | Kartenpolster kann auf 12 px, Zielsatz in dichter Ansicht auf 18 px sinken | 2 / 8 |
| `learning.css:87` | 640-ms-Kartendrehung überschreitet D13 | 2 / 8 |
| `student.css:47,88,98,102,223` | 1,1-s-Ring, endloser Feedback-Puls, 1,4-s-Glanz, mehrsekündiger Pfeil und endloser Knoten-Puls | 2 / 8 |
| `globals.css:958–991` | Globaler Reduced-Motion-Fallback kürzt auf 0,01 ms, garantiert aber nicht grundsätzlich null laufende Animationen; spezifische Regeln teilweise `none` | 2 / 8 |
| `StudyModeToggle.tsx:58–60` | Gemeinsame feste `layoutId` und Feder `420/36`, statt je Instanz isoliert und Soll `420/34` | 2 |
| `DashboardHeader.tsx:57–80` | Handy hat keinen vollständigen Brotkrumenpfad | 2 |
| `StudentNavigation.tsx`, `student.css:175–196` | Kein scrollabhängiges Ausblenden; Aufnahme-Dock nur über feste Höhe gekoppelt | 2 |
| `student.css:205–245`, `components/dashboard/LevelPath.tsx` | Vorhandener „Lernweg“ beschreibt Vokabel-Lektionen; D9-Grammatikpfad noch nicht umgesetzt | 2 / 3 |

Die Liste ist eine statische, konkret belegte Ausgangslage, keine Behauptung einer vollständigen WCAG-Abnahme. Für die spätere Abnahme: alle fünf Sprachen und vier Erscheinungsvarianten, Tastaturreihenfolge, sichtbarer Fokus, Screenreader-Namen/Status, 48-px-Ziele, 56-px-Hauptaktionen, Zoom und geringe Bildschirmhöhe, kein verdeckter Inhalt durch Docks, ausschließlich lokale Laufzeitressourcen und reduzierte Bewegung prüfen. Ziehen/Wischen ist nie die einzige Bedienmöglichkeit; Aufgaben und Tests setzen niemanden unter Zeitdruck. Automatische axe-Prüfungen dürfen Anforderungen weder filtern noch überspringen.
