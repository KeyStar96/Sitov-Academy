# Monetization Strategy (Stripe Integration)

## 2026-09-10 — Lesbarkeit als allgemeine Plattformfunktion

Hell/Dunkel und der zusätzliche Hochkontrastmodus stehen unabhängig von Tarif, Kursstufe und Lernstand bereit. Die persönliche Darstellung wird lokal auf dem Gerät gespeichert. Größere Lernbeschriftungen und die vereinfachte Grammatiknavigation ändern keine Buchungen, Preise, Rechnungsabläufe oder Zugangsrechte. [Umfang und Prüfnachweise](docs/readability-grammar-2026-09-10.md).

## Mailgestaltung produktiv — 2026-09-10

Kurs-, Probe- und Kündigungs-Mails verwenden jetzt live die Marke „Sitov Academy“ sowie klar getrennte Unterrichts- und Firmenadressen. Absendernamen, Logos und Rechtslinks sind aktualisiert; Preise, Zahlungszeiträume, Empfänger und Versandtrigger bleiben unverändert. Auth-Mailgestaltung und SMTP-Anzeigename sind ebenfalls in Supabase gespeichert. Alte Markenanzeigen aus vorhandener App-SMTP-Konfiguration werden ebenfalls korrigiert; die Mailbox bleibt erhalten. Es wurden keine Testbuchungen oder Kundenmails ausgelöst. [Ausführung und Prüfung](docs/mail-templates-live-2026-09-10.md).

## Einheitliche Marke und Kursdarstellung — 2026-09-10

„Sitov Academy“ ist die einheitliche aktive Markenbezeichnung. Die neue Reihenfolge der Startseiten-Kurse ändert keine Preise, Termine, Buchungskennungen oder Zahlungsabläufe; beide Privatunterrichtsvarianten bleiben erhalten. Rechtsseiten verwenden denselben Kontakt-/Adress-Footer wie die Startseite. Mail-Absender und Vorlagen sind im Quellcode aktualisiert; produktive Supabase-Mailkonfiguration wurde nicht verändert. [Prüfnachweise](docs/brand-footer-course-order-2026-09-10.md).

## Globaler Lernreset ausgeführt — 2026-09-10

Alle Schüler-Lerndaten und Sprachaufnahmen wurden auf ausdrücklichen Auftrag tatsächlich gelöscht. 84 Registrierungen, 112 Einschreibungen, Monatsbuchung und Rechnungsstatus sind mit identischen Vorher-/Nachher-Prüfsummen erhalten. Der Vorgang hat keine Kündigung oder Änderung der Abrechnung ausgelöst. [Operativer Nachweis](docs/global-learning-reset-2026-09-10.md).

## Lernreset und Vertragsdaten — 2026-09-10

Der neue Profil-Reset löscht ausschließlich persönliche Lernergebnisse, Sprachaufnahmen und die zugehörigen Audio-Dialoge. Der Nutzer hat ausdrücklich bestätigt, dass **verbindliche Kursbuchungen erhalten bleiben**. `registrations`, `enrollments`, `monthly_course_bookings`, `manual_invoice_status`, Profil-/Niveaurechte und Zahlungsintegration werden durch die Reset-Action nicht gelöscht oder zurückgesetzt. Ein Lernreset ist keine Kündigung und kein Account-Löschvorgang.

Die anatomisch klarere Gehirnvisualisierung und die reduzierte Dashboard-Navigation ändern keine Preise oder Vertragsabläufe. Der Reset wird erst nach Bestätigung im Profil ausgeführt; beim Implementieren/Testen wurde kein produktiver Reset ausgelöst. Ablauf und Nachweise: [Prüfbericht](docs/brain-navigation-reset-2026-09-10.md).

## Aktueller manueller Abrechnungsablauf — 2026-09-10

Die Kursabrechnung erfolgt weiterhin manuell über Papierkram. Im Lehrer-Dashboard werden neue Anmeldungen zuerst geprüft und von `pending` auf `confirmed` gesetzt. Der gesonderte Rechnungsbereich öffnet standardmäßig den nächsten Monat, passend zur Vorkasserechnung am Ende des laufenden Monats. Lehrkräfte sehen pro Person die relevanten Kurse und können nach tatsächlicher Erstellung der Rechnung das Kennzeichen „Rechnung erstellt“ mit optionaler Rechnungsnummer setzen oder korrigieren.

Offene und bereits erstellte Rechnungen sind getrennt filterbar. Die Rechnungsliste fasst aktive Kurse einer Person zusammen und berücksichtigt explizite Monatsbuchungen bzw. Pausen vor wiederkehrenden Altbuchungen. Ein vorbereiteter Eintrag bleibt auch nach einer späteren Buchungsänderung sichtbar; eine Datenbanksperre verhindert zwei Erledigt-Kennzeichen für dieselbe Person/Monat. Das Kennzeichen bestätigt ausschließlich den manuellen Arbeitsschritt, weder Zahlung noch Versand. Es existiert keine neue Papierkram-API-Integration und kein automatischer Rechnungsversand.

Die Registrierungswerbung sagt nun „Monatlich flexibel – Kündigung per Formular oder E-Mail“ und erklärt Zahlung per Überweisung nach Rechnung sowie Abrechnung im Voraus. Die bestehende Vertragslogik wird durch Marketingtexte nicht stillschweigend geändert. AGB ergänzen manuelle Monatsrechnungen und digitale Lernleistungen in allen fünf Sprachen; die abschließende rechtliche Prüfung bleibt erforderlich. Neue Trainerinhalte werden über die vorhandenen Niveaurechte freigegeben, ohne einen neuen Paywall-/Stripe-Ablauf einzuführen.

Technische Umsetzung und Prüfnachweise: [Trainer- und Verwaltungsumbau](docs/trainer-admin-refresh-2026-09-10.md).

> **Kontakt/Impulstakt (2026-09-10):** Anastasias Kontaktbutton führt zu `https://t.me/Sprachschule_Anastasia`; NeuralBrain-Impulse erscheinen leicht häufiger (Gruppen alle 6–8 Sekunden). Beide Anpassungen betreffen die Startseite und ändern keine Buchungs-, Abrechnungs- oder Zugriffslogik.

> **Layout/Audio (2026-09-10):** CSS-Sticky stabilisiert die Kurs-Zahlungsübersicht; die Preis-, Einwilligungs- und Submit-Funktionen bleiben nach AST-Abgleich unverändert. Header-Buchungslink, getrennte Footer-Adressen und das Audio-Vorladen ändern keine Stripe-, Rechnungs- oder Zugriffslogik.

> **NeuralBrain (2026-09-10):** Die Marketing-Visualisierung wurde mit organischem Gewebe und seltenen Shader-Lichtschweifen neu aufgebaut. Ausschließlich clientseitige Darstellung; keine Änderungen an Kursbuchung, Abrechnung, Stripe oder Zugriffsrechten.

> **Hinweis (2026-09-09):** Der Sprachumschalter im Lehrer-Header speichert nur `profiles.ui_language` und ändert Stripe nicht.

> **Hinweis (2026-09-09):** Die Admin-Ansicht „Folgemonat-Buchungen“ und das Schwarze Brett (Rabatt in `teacher_student_notes`) dienen der manuellen Monatsabrechnung und Kundenbetreuung. Sie ändern Stripe-Checkout, Webhooks und öffentliche Kursbuchung nicht.

> **Hinweis (2026-09-09):** Preloader-Leinwand, Einstufung wie Lernbox und Profil-Layout berühren Stripe/Abo nicht.

> **Hinweis (2026-09-06):** Die iOS-Wiedergabe (HTML-Audio/WAV) und die Waveform-Vereinfachung berühren Stripe/Abo nicht.

> **STATUS-UPDATE (2026-09-06): In-App-Freemium abgelöst.**
> Das nachstehend beschriebene In-App-Free/Premium-Modell steuert **nicht mehr** den Zugriff auf Lerninhalte. Der Inhaltszugriff wird jetzt ausschließlich über die **Admin-Freigabe je Sprachniveau** (`profiles.allowed_levels`) gesteuert – siehe `ARCHITECTURE.md` und `CURRENT_STATE.md` (Abschnitt 1a). Neu registrierte Nutzer haben zunächst keinen Zugriff; ein Admin schaltet einzelne Niveaus (A1.1 … B1.2) pro Nutzer frei.
>
> **Entfernt:** öffentliche In-App-Paywall (`/dashboard/premium`), Free/Premium-Badges, Abo-/Kauf-CTA im Profil.
> **Erhalten (unverändert):** die **öffentliche Kurs-Buchung** echter Präsenz-/Online-Kurse über Stripe (`registrations`, `enrollments`, `courses`) sowie der Stripe-Webhook. Die Spalte `subscription_status` und die Stripe-Spalten bleiben aus Kompatibilitätsgründen bestehen, haben aber keine gating-Funktion mehr.
>
> Der folgende Abschnitt beschreibt das historische Freemium-Konzept und dient als Referenz/Audit-Trail.

## 1. Übersicht: Free vs. Premium (historisch — nicht mehr aktiv für Inhaltszugriff)

Die Lernplattform der Sitov Language Academy operierte nach einem Freemium-Modell:
- **Free-Account (`subscription_status = 'kostenlos'`):** 
  - Zugriff auf Lektion 1 jedes Kurs-Levels (A1.1 bis C2).
  - Begrenzter Vokabeltrainer (z.B. max. 50 Vokabeln).
  - Keine Audio-Einsendungen für Lehrer-Feedback.
- **Premium-Account (`subscription_status = 'aktiv'`):**
  - Unbegrenzter Zugriff auf alle Lektionen, Übungen und Videos.
  - Voller Vokabeltrainer (Phase-6-Leitner über alle sechs Lernphasen bis „gelernt").
  - Premium-Features: Audio-Einsendungen und direktes Lehrer-Feedback.

## 2. Stripe Checkout-Workflow

### Upgrade-Prozess (Client zu Stripe)
1. **Paywall-Trigger:** Der Nutzer öffnet das Profil (Header-Icon in der Lernplattform) oder einen gesperrten Premium-Inhalt und klickt auf „Jetzt Premium aktivieren“.
2. **Checkout Session:** Eine Next.js Server Action (`createCheckoutSession`) ruft die Stripe-API auf, erstellt eine Checkout-Session und gibt die URL zurück.
3. **Metadaten:** Die Session enthält in den `metadata` zwingend die `user_id` aus Supabase, um den Kauf später zuzuordnen.
4. **Redirect:** Der Nutzer wird zu Stripe gehosteten Checkout-Seite weitergeleitet.

### Customer Portal
Für Kündigungen, Pausierungen und Rechnungs-Downloads wird das Stripe Customer Portal genutzt (`createCustomerPortalSession`).

## 3. Webhook-Workflow (Single Source of Truth)

Das Herzstück der Monetarisierung ist der serverseitige Webhook-Handler (`app/api/webhooks/stripe/route.ts`). Stripe pusht Events an diesen Endpunkt. Dieser Endpunkt ist die *einzige* Instanz, die den `subscription_status` in der Datenbank ändert.

### Relevante Stripe-Events:
- `checkout.session.completed`:
  - Extrahiert `user_id` aus den Metadaten, `customer_id` und `subscription_id`.
  - Updatet das `profiles` Table in Supabase: `subscription_status = 'aktiv'`, setzt Stripe-IDs.
- `customer.subscription.updated`:
  - Reagiert auf Pausierungen oder Tarifwechsel.
  - Passt den Status in der DB an (z.B. wenn Abo ausläuft: `subscription_status = 'kostenlos'`).
- `customer.subscription.deleted`:
  - Abo wurde gekündigt und die Restlaufzeit ist abgelaufen.
  - Setzt `subscription_status = 'kostenlos'` in der Datenbank.

## 4. Synchronisation mit dem Teacher-Dashboard

Da der Webhook die Supabase-Datenbank (`profiles` Tabelle) in Echtzeit aktualisiert, ist der Status im Teacher-Dashboard sofort sichtbar.
- **Lehrer-Sicht:** Im `/admin/teacher/users` Dashboard fragt der Lehrer die `profiles` Tabelle ab.
- **Anzeige:** Der aktuelle `subscription_status` wird durch farbige Badges dargestellt (Grün: Aktiv, Grau: Kostenlos).
- **Manuelle Overrides:** In Ausnahmefällen (z.B. Kulanz, Stipendium) muss ein Lehrer (mit Admin-Rechten) den Status im Dashboard manuell auf `aktiv` setzen können (Server Action `updateUserStatus`), selbst wenn kein Stripe-Abo existiert. Diese Logik überschreibt den Free-Status lokal in der DB.

## 5. Protokoll (2026-09-03)
- Stripe-relevante DB-Spalten (`profiles.stripe_customer_id`, `profiles.stripe_subscription_id`) und Indizes sind in `supabase/schema.sql` dokumentiert.
- Supabase-Projekt-Binding: ausschließlich `wcaslabeiwtvygxtzcio` (Sitov Academy v2, Live-DB). Schema-Änderungen dürfen Webhook-Workflows nicht brechen.
- A1.1-Vokabelinhalt: Lektion 1 (84), Lektion 2 (85) und neu Lektion 3 (76) ändert den Stripe-Workflow nicht. Paywall bleibt am `subscription_status`, nicht an einzelnen Karten.
- Migration `move_einkauf_vocab_to_a11_lektion_3.sql` erfolgreich am Live-Projekt ausgeführt; bestehende User-Progress-Daten (245 Einträge) bleiben vollständig intakt.
- Layout-Rücknahme (No-Scroll → natürliches Scrollen), Textfix „Lektion Lektion 2" und Vokabeltrainer-Feinschliff (2026-09-03, siehe `CURRENT_STATE.md` 4f) sind rein visuelle/UI-Änderungen ohne Berührung von Stripe-Webhooks, `subscription_status` oder Paywall-Logik.
- Vokabel-Modal Tabs/eigene Vokabeln/Phasen-Diagramm (2026-09-03, siehe `CURRENT_STATE.md` 4g): clientseitiges `localStorage`, kein Stripe-Bezug, Paywall unverändert am `subscription_status`.
