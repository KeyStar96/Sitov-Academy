# Phase 1 — Vorher/Nachher

Lokale, synthetische Daten, englische Oberfläche, reduzierter Bewegungsmodus, heller Modus. Desktop: 1440×1000; Handy: 390×844. Vollseitenbilder dürfen höher sein. Kein produktiver Login und keine Personendaten. Alle Seiten antworteten mit HTTP 200.

| Ansicht | Desktop vorher | Desktop nachher | Handy vorher | Handy nachher |
|---|---|---|---|---|
| Lernknöpfe | [Bild](before-buttons-desktop.png) | [Bild](after-buttons-desktop.png) | [Bild](before-buttons-handy.png) | [Bild](after-buttons-handy.png) |
| Artikel-Hinweis | [Bild](before-article-desktop.png) | [Bild](after-article-desktop.png) | [Bild](before-article-handy.png) | [Bild](after-article-handy.png) |
| Einstufung | [Bild](before-assessment-desktop.png) | [Bild](after-assessment-desktop.png) | [Bild](before-assessment-handy.png) | [Bild](after-assessment-handy.png) |
| Freischaltung ausstehend | [Bild](before-pending-desktop.png) | [Bild](after-pending-desktop.png) | [Bild](before-pending-handy.png) | [Bild](after-pending-handy.png) |

Alle acht Nachher-Bilder wurden visuell geprüft: positive Aktion rechts und gefüllt; Einstufung entspricht dem Trainer; Artikelhinweis vor dem Eingabefeld, ohne die gesuchte Lösung zu verraten; Freischaltungskarte mit Uhr, vollständiger Erklärung und erreichbaren Hilfe-/Kalenderlinks. Keine abgeschnittenen Aktionsbeschriftungen. Gemessene Dokumentbreite entspricht in allen acht Fällen exakt der Viewportbreite. Bildabmessungen und SHA256: [Manifest](image-manifest.json). URLs, HTTP-Status und Viewports: [Nachher-Metadaten](after-screenshots.json).

Reproduktion (drei lokale Terminalprozesse, nach Abschluss beenden):

```sh
node scripts/phase1-visual-fixture.cjs
```

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=phase1-local-placeholder \
SUPABASE_INTERNAL_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=phase1-local-placeholder \
NEXT_PUBLIC_SITE_URL=http://localhost:3000 SITE_URL=http://localhost:3000 \
npm run build

NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=phase1-local-placeholder \
SUPABASE_INTERNAL_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=phase1-local-placeholder \
NEXT_PUBLIC_SITE_URL=http://localhost:3000 SITE_URL=http://localhost:3000 \
npm run start
```

```sh
node scripts/phase1-visual-qa.cjs after
```

Der Browser nutzt den vorhandenen Chrome-Channel (`PLAYWRIGHT_CHANNEL` überschreibbar). Die Fixture lauscht nur auf Loopback und ist ein temporäres Prüfwerkzeug. Das Skript simuliert ausschließlich eine lokale Demo-Session und blockiert Browser-Anfragen an andere Hosts. Nicht gegen einen Produktiv-Build ausführen. Die Vorher-Bilder wurden mit dem unveränderten Ausgangs-Build erzeugt; ein Nachher-Build reproduziert keinen Vorher-Zustand.

Die Axe-Prüfung umfasst die vier geschützten Ansichten auf beiden Geräten und in beiden Themen, die sechs bestehenden öffentlichen Fälle sowie Registrierungs-/Bestätigungsstatus inklusive des echten Home-Ziels. Es gibt keine Axe-Ausnahmen. Der Erstlauf fand auf den neu geprüften Auth-Statusseiten verschachtelte `main`-Landmarks; diese wurden im Auth-Rahmen korrigiert. [Erstlauf mit Befunden](after-axe-initial.json), [abschließender Lauf](after-axe.json). Axe ersetzt keine vollständige manuelle Tastatur-/Screenreader-Prüfung sämtlicher App-Ansichten.

Abschließendes Ergebnis: **28/28 erweiterte Axe-Fälle grün**, zusätzlich die unveränderte Playwright-Suite **6/6 grün**, keine übersprungenen Fälle. [Playwright-Originalergebnis](playwright-accessibility.json). Die Nachher-Dateien und das Manifest stammen aus dem finalen Build-Lauf.
