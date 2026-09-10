# Footer, Kursreihenfolge und Markenname — 10. September 2026

## Änderungen

- AGB, Impressum und Datenschutz verwenden jetzt dieselbe `AcademyFooter`-Komponente wie die Startseite. Die drei ungenutzten alten Footer-Komponenten wurden vollständig entfernt. Der Footer trennt Unterrichtsort, Firmensitz und Kontakt weiterhin sauber.
- `sortMarketingCourses` sortiert eine Kopie der Kursliste anhand stabiler Übersetzungsschlüssel, Niveauzuordnung und tatsächlicher Wochentage. Reihenfolge: Deutsch Level 1 / 2 / 3, Sprechtraining Montag / Dienstag / Mittwoch, Online A1 / B1, Privatunterricht vor Ort / online. Die beiden vorhandenen Privatunterrichtsangebote bleiben getrennt buchbar. Kursdaten, Preise, Termine, Buchungslinks und die gemeinsame Cache-Liste werden nicht verändert.
- Der Hero liest `academy.hero_level_range` aus dem Dictionary und zeigt in allen fünf Sprachen `A1—C2 · Sitov Academy Hannover`.
- Aktive Markenbezeichnungen in Dictionaries, Metadaten, JSON-LD, SMTP-Absendern, Stripe-App-Information und Mail-Quellen vereinheitlicht: `Sitov Academy`. Die Texte der Rechtsseiten sind ausschließlich hinsichtlich des Markennamens geändert.
- Mail-Vorlagen verwenden das aktuelle neuronale Markensymbol mit HTML-Schriftzug, weil die früheren PNG-Logos den alten Namen eingebettet enthielten. Auth-Link-Platzhalter und Versandlogik bleiben erhalten. Interne Paketkennungen und historische Migrationen wurden nicht umbenannt.

## Prüfung

- 59 bestehende Tests bestanden: 11 Marketing-/Footer-Tests sowie 48 Übersetzungs-/Auth-Tests.
- Browserprüfung aller fünf Startseiten: exakte gewünschte Reihenfolge der zehn vorhandenen Kurskarten, korrekte Hero-Zeile, keine alte sichtbare Markenbezeichnung.
- Alle 15 Rechtsrouten (3 Seiten × 5 Sprachen) liefern HTTP 200 und exakt einen `footer.academy-footer`; dessen Text entspricht jeweils dem Startseiten-Footer derselben Sprache.
- Alle Rechtsseiten bei 1440px im Lightmode und 320px im Darkmode geprüft: kein horizontales Überlaufen und keine JavaScript-Seitenfehler. Desktop-Footer, mobiler Footer und Kursraster auch visuell geprüft.
- `git diff --check` ohne Befund. Bestehende ESLint-Konfiguration unterstützt den installierten ESLint-9-Aufruf nicht; deshalb kein erfolgreicher separater ESLint-Lauf.
- Produktionsbuild mit `NODE_OPTIONS=--dns-result-order=ipv4first next build --webpack` erfolgreich, einschließlich TypeScript und 129 generierten Seiten. Die vorangegangenen Turbopack-Aufrufe warteten auf externe Google-Fonts-Verbindungen über IPv6 und wurden beendet; keine Build-Konfiguration geändert. Bestehende Hinweise zu Middleware, Browserslist und dynamischen Registrierungs-Cookies bleiben unverändert.

## Geltungsbereich

Die Website-Änderungen sind im lokalen Projekt und auf localhost verfügbar. Kein Website-Deployment und keine Änderung an Kursbuchungen, Auth-Konten oder Lernständen. Die im Repository angepassten Supabase-Mailfunktionen und Auth-Templates müssen über ihren üblichen Deployment-/Konfigurationsweg veröffentlicht werden, bevor produktive E-Mails die neue Gestaltung verwenden.

Bereits vorher fehlte `public/Bilder/og-sitov-academy.jpg`, obwohl die Metadaten darauf verweisen; diese unabhängige Bilddatei wurde hier nicht ergänzt. Das verwendete `favicon.png` enthält keinen alten Schriftzug.
