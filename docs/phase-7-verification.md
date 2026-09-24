# Phase 7 — SEO, Recht & DSGVO

Stand: 24.09.2026. Umfang: 7.1 (SEO-Löcher) und 7.2 (Meta-Pixel/Consent) vollständig. 7.3 war nicht Teil dieses Auftrags und bleibt offen. Keine DB-, Speicher- oder CPU-Änderungen (R2, R7 und R8 nicht berührt). Keine neuen externen Dienste (R3); das Meta-Pixel lädt ausschließlich im Browser nach Opt-in.

## Bestandsprüfung (R1)

| Datei / Objekt | Erwartet (CODEX) | Gefunden | Änderung |
|---|---|---|---|
| `/Bilder/og-sitov-academy.jpg` | fehlt | fehlte (Live-Domain 404) | 1200×630-JPEG erzeugt (≈100 KB) |
| hreflang auf Unterseiten | fehlt | AGB/Datenschutz/Impressum/Kündigung hatten `x-default`, aber hartcodiert; **Kursanmeldung hatte gar keine Metadaten** (Titel der Startseite, kein canonical) | Zentraler Helfer `lib/seo.ts`; alle 6 indexierbaren Seiten × 5 Sprachen |
| `app/sitemap.ts` | ohne `x-default` | ohne `x-default`, Domain hartcodiert, `/registration` fehlte | `x-default` + Kursanmeldung (30 URLs) |
| Hartcodierte Basis-URLs | vorhanden | `layout.tsx` (metadataBase), `page.tsx`, 4 Unterseiten, `sitemap.ts`, `robots.ts` | Alle auf `CANONICAL_SITE_URL` |
| FAQPage-JSON-LD | fehlt | keine FAQ auf der Seite | Sichtbare FAQ-Sektion + identisches JSON-LD |
| `dynamicParams` in `app/[lang]/layout.tsx` | fehlt | fehlte; `/authx`, `/apifoo/…` lieferten 200 | `dynamicParams = false` + 404-Guard |
| `robots.ts` `/registration` | disallow | disallow; zusätzlich `/admin/`, `/private/`: trafen nie eine echte URL (alle Routen haben Sprachpräfix) | siehe Entscheidung |
| Meta-Pixel | im `<head>` | Inline-Skript + `<noscript>`-Pixel im `<head>`, vor jeder Einwilligung | entfernt, Opt-in |
| Datenschutzerklärung | ohne Meta-Pixel | sagte „keine Cookies für … Marketing“ (falsch, Pixel lief); deutsches Wort „не“ im Telegram-Abschnitt | 8.2 korrigiert, 8.7 Meta-Pixel ergänzt (5 Sprachen) |

## Entscheidungen

**Canonical-Origin.** Der VPS läuft bis zum DNS-Umzug unter `https://217.154.228.254` (`NEXT_PUBLIC_SITE_URL`); die Domain zeigt noch auf die Netlify-Legacy-Seite. Eine direkte Kopplung an `NEXT_PUBLIC_SITE_URL` hätte canonical, hreflang und Sitemap auf die IP gesetzt. Deshalb gilt `CANONICAL_SITE_URL` (Env) vor der Deployment-Origin; nur SEO-Metadaten lesen sie, Mail- und Auth-Links bleiben unverändert. Auf dem VPS: `CANONICAL_SITE_URL=https://www.sitov-academy.com` in `/etc/sitov-academy/app.env`. Nach dem Umzug stimmt alles ohne Codeänderung; die IP-Kopie verweist bis dahin als Duplikat auf die Domain.

**`/registration` in robots.txt → freigegeben und indexierbar.** (1) `Disallow: /registration` griff nie – echte URLs sind `/de/registration` usw. (Präfix-Match ab Root). (2) Die Kursanmeldung ist die wichtigste Conversion-Seite (Kurse, Termine, Preise, kostenlose Probestunde) und wird von jeder CTA verlinkt; ein wirksames Disallow führt bei intern verlinkten Seiten zu „Indexiert, obwohl durch robots.txt blockiert“ in der GSC. (3) robots.txt steuert nur das Crawling: Seiten, die nicht in den Index sollen (Login, Konto-Registrierung, Passwort), tragen `noindex` und müssen crawlbar bleiben. Die Seite hat jetzt eigene Titel/Beschreibung, canonical, hreflang und steht in der Sitemap. Gesperrt bleiben nur `/api/` und `/auth/` (Einmal-Links). Lernraum/Admin leiten Anonyme (Googlebot) auf den `noindex`-Login um.

**`dynamicParams = false` allein reicht nicht.** Es wirkt nur auf statisch generierte Seiten; dynamische Seiten (Login, Lernraum) prüfen es nicht, und Pfade wie `/authx/login` umgehen den Middleware-Matcher. Zusätzlich ruft das Layout für unbekannte Sprachen `notFound()` auf. Verschachtelte Lernraum-Routen (`[level]`, `[id]`) sind `force-dynamic` und stehen nicht im Prerender-Manifest – kein 404-Risiko (am Build geprüft). Außerdem leitet `/` jetzt direkt auf `/de` statt über `/de/` (Redirect-Kette).

**FAQ.** Inhalte ausschließlich aus belegten Fakten (AGB §§ 2–4, 10; Anmeldeformular; Standort; Lehrerin). Google verlangt, dass FAQ-Markup sichtbar ist – die Sektion und das JSON-LD kommen aus denselben Wörterbuch-Einträgen. Hinweis: Seit August 2023 zeigt Google FAQ-Rich-Results nur noch für ausgewählte Behörden- und Gesundheitsseiten. Das Markup ist valide und erzeugt keine GSC-Fehler, ein Akkordeon im Google-Snippet ist für diese Seite aber nicht zu erwarten.

**Consent & LCP.** Banner mit „Nur notwendige“ und „Alle akzeptieren“ in identischer Gestaltung, Einstellungen (Notwendig / Marketing) und Widerruf über „Cookie-Einstellungen“ im Footer. Entscheidung 12 Monate im localStorage (`sitov-consent`, versioniert). Das Pixel lädt nur nach Opt-in über `next/script` `afterInteractive`; `trackMetaEvent` prüft die Einwilligung zusätzlich. Messung: Ein erst nach der Hydration erscheinendes Banner wurde auf dem Handy zum LCP-Element (Absatz 69–77k px² > Hero-Text 27–38k px²). Deshalb steht das Banner im statischen HTML und wird mit dem Hero gezeichnet. Ein Inline-Skript im `<head>` (Muster wie Theme-Bootstrap) blendet es vor dem ersten Paint aus, wenn eine gültige Entscheidung vorliegt; ohne JavaScript bleibt es unsichtbar. Messung mit 4× CPU-Drosselung: LCP ≈ FCP. Lernraum und Admin zeigen das Banner nicht automatisch.

## Automatisierte Abnahme

| Prüfung | Nachweis | Ergebnis |
|---|---|---|
| hreflang inkl. `x-default`, canonical auf Domain, OG/Twitter | `__tests__/seo-phase7.test.ts`, `e2e/phase7-seo.spec.ts` (6 Seiten) | grün |
| sitemap.xml valide, 30 URLs, jede mit 5 Sprachen + `x-default` | Unit + E2E gegen Produktions-Build | grün |
| robots.txt erreichbar, keine öffentliche Seite blockiert | Unit + E2E | grün |
| JSON-LD schema.org-valide, FAQPage = sichtbare FAQ (5 Sprachen) | E2E | grün |
| OG-Bild 1200×630, HTTP 200 `image/jpeg` | Unit (JPEG-SOF) + E2E | grün |
| Ohne Consent kein Request an Meta; nach Opt-in `connect.facebook.net`; Widerruf | Unit + E2E (Desktop + Pixel 7) | grün |
| Ungültige Sprachsegmente 404, `/` → `/de` ohne Kette | E2E + Middleware-Unit | grün |
| axe-core ohne Filter, Home/Registration/Cancellation × hell/dunkel mit Banner | `e2e/accessibility.spec.ts` | 0 Verstöße |
| Wörterbuch-Parität | `__tests__/translation-integrity.test.ts` | grün |
| Gesamt | `tsc --noEmit`; Jest 1554/1555 (1 skipped); Playwright `e2e/phase7.config.ts` 48/48 | grün |

Aufruf E2E: Build mit Platzhalter-Env (`CANONICAL_SITE_URL=https://www.sitov-academy.com`, `NEXT_PUBLIC_SITE_URL=https://217.154.228.254`), `next start -p 3100`, dann `CANONICAL_SITE_URL=… NEXT_PUBLIC_SITE_URL=… npx playwright test --config e2e/phase7.config.ts`.

## Offen / Hinweise

- 7.3 (HIBP-Passwortschutz, rechtliche Gesamtprüfung von Impressum/AGB/Datenschutz, Markennamen) nicht Teil dieses Auftrags.
- Die neuen Datenschutz-Absätze (8.2, 8.7, Abschnitt 3) sind ein fachlicher Entwurf und sollten rechtlich geprüft werden, bevor Werbung mit Pixel geschaltet wird.
- Nach dem DNS-Umzug in der Search Console die Sitemap `https://www.sitov-academy.com/sitemap.xml` einreichen.
