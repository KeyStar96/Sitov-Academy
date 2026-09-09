# Current State Analysis (Ist-Zustand)

## 1a. Änderungsprotokoll — 2026-09-09: Cinematic Preloader

**Kernänderungen:**
- **Ladebildschirm:** `components/effects/Preloader.tsx` ist ein vollflächiger Vorhang (`#050505`) mit typografischem 000–100-Zähler, Marken-Reveal (Sitov / Academy), orangener Fortschrittslinie, Radial-Glow und Noise. Exit als zweigeteilter Wipe. Mobil: `100dvh`, Safe-Area, kein Horizontal-Overflow. `prefers-reduced-motion` überspringt die Choreografie.

## 1a. Änderungsprotokoll — 2026-09-09: Vokabeltrainer Einstufung, Gewichtung & Layout-Shift

**Kernänderungen:**
- **Ersteinstufung ohne Übersetzung:** `/vocabulary/assess` zeigt nur noch das Fremdwort (Artikel + Wort). Die native Übersetzung und der Plural sind entfernt, damit die Selbsteinschätzung nicht vorweggenommen wird. Buttons: „Kenne ich bereits" (Phase 6) und „Kenne ich nicht" (Phase 1, sofort fällig).
- **Bekannte Karten nicht mehr archiviert:** `submitLessonAssessment` legt bekannte Vokabeln in Phase 6 (`ASSESSMENT_KNOWN_PHASE`) statt Box 7/„gelernt". Unbekannte wandern ohne Umweg ins aktive Lernen; nach der letzten unbekannten Karte startet die Session automatisch (sessionStorage-Marke `sitov_vocab_autostart`).
- **Gewichtete Zufallsauswahl:** `lib/leitner.ts` (`PHASE_SELECTION_WEIGHTS`, `pickWeightedRandomOrder`) und `getDueCards` reihen fällige Karten nicht mehr nach Datum, sondern gewichtet: Phase 1 = 1.0, 2 = 0.7, 3 = 0.4, 4 = 0.2, 5 = 0.1, 6 = 0.05.
- **Kein Layout-Shift beim Kartenwechsel:** `VocabCardSession` nutzt eine feste Kartenhöhe (`h-[36rem]`/`sm:h-[42rem]`), einheitliche Bildslots und eine reservierte Rückseite. Die Folgekarte liegt ohne Skalierung im selben Grid-Slot. Die Einstufungskarte hat ebenfalls feste Höhe.
- **Unterlängen nicht mehr abgeschnitten:** `line-clamp` auf den Vokabelwörtern entfernt; `leading-snug` plus Innenabstand geben Buchstaben wie g/j/q Platz. Gleiches in der Ersteinstufung und auf der Kartenrückseite.
- **Desktop-Lektionskarten:** Aktionen stehen untereinander in einer festen rechten Spalte (`flex-col`, `lg:w-72`), damit Titel und Button-Texte nicht mehr überlappen oder abgeschnitten werden.
- **Profil „Kurse auswählen":** Kompaktere Kurskarten (`min-h-12`) und ab `sm` ein zweispaltiges Raster, damit die Liste für den Folgemonat nicht mehr die ganze Seite nach unten zieht.
- **Profil-Sprache:** „Sprache der Oberfläche" sitzt kompakt in der linken Spalte unter den persönlichen Daten, neben „Meine Kurse für nächsten Monat" – nicht mehr als volle Breite darunter.

## 1a. Änderungsprotokoll — 2026-09-06: Audio-Recorder UI & Safari Sample-Rate Bugfix

**Kernänderungen:**
- **Audio-WaveForm UI (Studenten):** In `AudioRecorder.tsx` wurde die Darstellung der Waveform (Aufnahme & Wiedergabe) exakt an das Design des Lehrerdashboards angeglichen. Der Löschen-Button (Papierkorb) steht nun als kompaktes Element direkt neben dem `WaveformPlayer`.
- **Safari Sample-Rate Bugfix (Lehrer-Dashboard):** `web-audio.ts` stellt nun einen dedizierten `ensureMicContext()` bereit. Dies behebt einen WebKit/iOS-Bug: Wenn der globale `AudioContext` auf Seite der Wiedergabe (z. B. durch initiale `WaveformPlayer` auf der Lehrerseite) mit 44.1kHz instanziiert wurde, und danach `getUserMedia` das Mikrofon (oft 48kHz auf iOS) aktivierte, blieb der `MediaStreamAudioSourceNode` stumm. Der Analyser für die Mikrofon-Visualisierung nutzt nun konsequent diesen dedizierten, erst *nach* `getUserMedia` initialisierten Context, sodass die Waveform wieder flüssig auf Input reagiert.
- **Text-Überlappung behoben:** Im `PendingSubmissionCard.tsx` (Lehrerdashboard) überlagerten sich bei aktiver Übersetzung (z.B. Chrome Translate) der Text "Feedback freigeben" und "Feedback wird gesendet...", weil React durch die extern eingefügten `<font>`-Tags den DOM-Tree nicht mehr sauber austauschen konnte. Dies wurde behoben, indem beide Texte permanent als `<span>` gerendert und nur über Tailwind `hidden` bzw. `flex` umgeschaltet werden.

## 1a. Änderungsprotokoll — 2026-09-06: Vokabeltrainer & Grammatikübungen (Bugfixes & Dark Mode)

**Kernänderungen:**
- **Vokabeltrainer Überspringen-Bug:** In `LessonAssessmentClient.tsx` wird das `cards`-Array nun per `useState` eingefroren. Dadurch verschiebt sich der Index nicht mehr unerwartet, falls ein Hintergrund-Fetch durch `revalidatePath` die Liste der unbearbeiteten Karten aktualisiert.
- **Vokabeltrainer Layout-Flackern:** In `VocabCardSession.tsx` wurde die Grid-Zentrierung von `self-start` auf `self-center` korrigiert. Damit tauchen ungelöste und verdeckte Vokabelkarten exakt an der gleichen Stelle wie die umgedrehten Karten auf, ohne am oberen Bildschirmrand zu flackern.
- **Vokabeltrainer Sprachwechsel-Button:** Das schwer verständliche Pfeil-Icon wurde durch textliche Buttons (`🌍 ➔ 🇩🇪` bzw. `🇩🇪 ➔ 🌍`) ersetzt, die den Nutzern auf den ersten Blick ihre gewählte Abfragerichtung deutlich machen.
- **Vokabeltrainer Navigations-Korrektur:** In `VocabTrainerPageClient.tsx` und der `page.tsx` des Assess-Modus wurden die redundanten "Zurück zur Übersicht"-Pfeile entfernt, da die Hauptnavigation (`DashboardHeader`) diese Aufgabe einheitlich für alle Sprachniveaus übernimmt.
- **Grammatikübungen Dark Mode:** Für `ExerciseClient.tsx`, `MultipleChoiceExercise.tsx`, `FillInBlankExercise.tsx` und `SmartHintPanel.tsx` wurden umfassend Dark Mode Tailwind-Klassen (`dark:bg-slate-900`, `dark:text-slate-100`, `dark:border-slate-800` etc.) ergänzt. Die Übungen blenden damit nachts nicht mehr mit extrem harten, weißen Kontrasten und binden sich visuell nahtlos ins restliche Design ein.


## 1a. Änderungsprotokoll — 2026-09-06: iOS-Ton über HTML-Audio/WAV, eine Sinus-Welle

**Kernänderungen:**

- **Mikrofon-Falschmeldung:** `audioSession = playback` vor `getUserMedia` hat auf iPhone „Zugriff nicht erlaubt“ ausgelöst, obwohl Safari das Mikrofon erlaubt. Aufnahme setzt jetzt `play-and-record`; nur die Wiedergabe nutzt `playback`. `getUserMedia` versucht zuerst verarbeitete Constraints, dann `{ audio: true }`. Nur echte `NotAllowedError` zeigen den Verweigert-Text.
- **Zweite Welle entfernt:** `FluidWaveform` zeichnet wieder nur die Siri-Sinus-Schichten. Keine Oszilloskop-Kurve mehr.
- **Übungssätze A1–C2:** Katalog + Live-DB unverändert zum vorherigen Stand (A1.1–B1.2 eigene Sätze, Familien A1–C2).

## 1a. Änderungsprotokoll — 2026-09-06: Vokabeltrainer Konsolidierung & Bugfixes

**Kernänderungen:**
- **Zentrale Ansicht:** Die Ansichten für Lektionen-Auswahl (Lernkasten) und das aktive Training wurden in `components/vocabulary/VocabTrainerPageClient.tsx` konsolidiert. Die separate Route `/train` wurde restlos entfernt. Die gesamte Steuerung (Auswählen, Einstufen, Abfragen) findet auf einer einzigen Seite statt.
- **Onboarding für neue Lektionen:** Klickt ein Nutzer auf eine völlig neue Lektion, erscheint ein Onboarding-Modal. Er kann zwischen "Einstufen" (vorab bekannte Wörter aussortieren) und "Von Null starten" (alles in Phase 1 legen) wählen.
- **Automatischer Import nach Einstufung:** `LessonAssessmentClient.tsx` wurde so angepasst, dass die Lektion nach Abschluss der Einstufung automatisch im Hintergrund (im `localStorage`) in die aktive Lernbox aufgenommen wird.
- **Fortschritt zurücksetzen:** Ein Button "Lernfortschritt zurücksetzen" wurde am Ende der Vokabelliste in `LessonCardsModal.tsx` wieder integriert. Nach einer Sicherheitsabfrage löscht die neue Server-Action `resetLessonProgress` den kompletten Lernfortschritt für die ausgewählte Lektion.
- **Abfragerichtung Umschalten:** In der Vokabelabfrage (`VocabCardSession`) gibt es nun oben im Header ein neues Icon zum Wechseln der Abfragerichtung (Muttersprache -> Zielsprache vs. Zielsprache -> Muttersprache).


## 1. Übersicht
Das Repository "Sitov Academy" ist eine Next.js (App Router) basierte Webanwendung, die als Lernplattform für die "Sitov Language Academy" dient. Der aktuelle Stand bildet die Basis für eine Transition in eine produktionsreife und monetarisierbare Umgebung, optimiert für eine Zielgruppe im besten Alter (Fokus: Geragogik, Barrierefreiheit, klare Strukturen).

## 1a. Änderungsprotokoll — 2026-09-06: Aussprache-Trainer (dynamische Analyser-Waveform + Übungssätze A1–C2)

**Kernänderungen:**

- **Dynamische Waveform (Web Audio API):**
  - `WaveformPlayer` hängt jetzt einen echten `AnalyserNode` an das `<audio>`-Element (`lib/audio/playback-analyser.ts`: `createMediaElementSource` → Analyser → Destination, WeakMap gegen Doppel-Connect, `resume()` nach Klick). Keine simulierte Sinuswelle mehr.
  - `LiveWaveform` liest pro Frame `getByteTimeDomainData` **und** `getByteFrequencyData` (`analyseFrame` in `lib/audio/waveform.ts`).
  - `FluidWaveform` nutzt Lautstärke für die Amplitude (Pausen flachen ab) und den spektralen Schwerpunkt für die Wellendichte (Stimmlage).
- **Übungssätze:** Neue Tabelle `pronunciation_prompts` (8 Sätze je CEFR-Familie A1, A2, B1, B2, C1, C2). Server Action `getPronunciationPrompts` mappt das Routen-Niveau (`A1.1` → `A1`) und prüft die Freigabe. UI: `PronunciationPractice` (Satzliste, Referenzhören per Audio-URL oder Web-Speech, anschließend Aufnahme).
- **i18n:** Neue `pronunciation`-Keys (`prompts_*`, `reference_*`) in Fallbacks und allen fünf Dictionaries.

## 1a. Änderungsprotokoll — 2026-09-06: i18n-Überarbeitung (Erstsprachen-Onboarding, Auto-UI-Sprache, Sprachumschalter, Breadcrumb-Fix, Vollständigkeits-Audit)

**Kernänderungen:**

- **DB (Live-Migration `add_ui_language_and_expand_native_language`, additiv & rückwärtskompatibel):**
  - `profiles.native_language`-CHECK erweitert auf die fünf Erstsprachen `Deutsch, Englisch, Russisch, Türkisch, Ukrainisch` (+ Legacy `Andere`). Bestehende Werte (`Russisch`, `Türkisch`) bleiben gültig.
  - Neue Spalte `profiles.ui_language text NOT NULL DEFAULT 'de'` (CHECK `de|en|uk|ru|tr`): persistente Oberflächensprache, im Profil manuell änderbar.
  - Backfill: bestehende Nutzer erhielten `ui_language` abgeleitet aus `native_language` (Russisch→ru, Türkisch→tr).
  - Trigger `handle_new_user()` setzt `ui_language` bei Neuregistrierungen passend zur Erstsprache. `supabase/schema.sql` + `supabase/database.types.ts` synchronisiert; Migrationsdatei im Repo abgelegt.

- **Erstsprachen-Onboarding & automatische UI-Sprache:**
  - Registrierung (`app/[lang]/register/page.tsx`, `lib/types/auth.ts` → `NATIVE_LANGUAGES`) bietet jetzt fünf Erstsprachen zur Auswahl.
  - Login (`app/actions/auth.ts`): Nach erfolgreicher Anmeldung wird die im Profil gespeicherte `ui_language` gelesen und der Nutzer auf `/{ui_language}/dashboard` geleitet – die gesamte Oberfläche erscheint automatisch in seiner Sprache (getrennter try/catch, Fallback = Formularsprache).

- **Manueller Sprachumschalter im Profil:**
  - Neue Server Action `app/actions/profile.ts` → `updateUiLanguage` (validiert via `uiLanguageSchema`, schreibt `profiles.ui_language`, `revalidatePath('/', 'layout')`, redirect auf `/{lang}/dashboard/profile`).
  - Neue Client-Komponente `components/dashboard/UiLanguageForm.tsx` (barrierefrei, min. 56px, Auto-Submit bei Auswahl + Fallback-Button). Eingebunden in `app/[lang]/dashboard/profile/page.tsx`. Sprachen als Endonyme (`lib/locale-routing.ts` → `UI_LOCALE_ENDONYMS`).

- **Breadcrumb-Fix (unübersetztes „train"):**
  - `lib/dashboard-i18n.ts`: neue Keys `nav_train`, `nav_assess`, `nav_lessons` + Ergänzung in `DASHBOARD_ROUTE_KEYS` (`train`, `assess`, `lessons`). Damit zeigt die Navigation den übersetzten Bereichsnamen statt des rohen Routen-Segments.

- **Vollständigkeits-Audit der Übersetzungen:**
  - Alle sieben Übersetzer-Sektionen (`dashboard, auth, profile, vocabulary, pronunciation, videos, exercises`) in allen fünf Dictionaries auf fehlende Fallback-Keys geprüft. Ergebnis: nur die neu eingeführten Keys fehlten; diese wurden in `de/en/uk/ru/tr` ergänzt. Danach 0 fehlende Fallback-Keys → kein interner Fallback-String erreicht mehr ungeübersetzt die UI.

## 1a. Änderungsprotokoll — 2026-09-06: Mobile-UX-Optimierung (Touch-Hover, Hintergrund, Vokabeltrainer-Flashcards)

**Kernänderungen (rein clientseitig/UI, keine Schema- oder Monetarisierungsänderung):**

- **Sticky-Hover-Fix auf Touch-Geräten:**
  - `tailwind.config.ts`: `future.hoverOnlyWhenSupported = true` aktiviert. Dadurch werden ALLE `hover:`-Utilities global in `@media (hover: hover)` gekapselt – Hover-Farben greifen nur noch auf echten Zeigegeräten (Desktop-Maus/Trackpad). Auf Smartphones/Tablets bleibt nach dem Antippen kein Farbzustand mehr „hängen".
  - `app/globals.css`: Die benutzerdefinierten Button-Klassen `.btn-primary` / `.btn-secondary` erhielten `@media (hover: hover)`-Kapselung ihrer `:hover`-Regeln sowie neue `:active`-Regeln für kurzes Druck-Feedback (Feedback nur während des aktiven Drückens, sofortiger Rücksprung beim Loslassen).
  - Flashcard-Buttons (Lösung aufdecken, „Wusste ich"/„Wusste ich nicht", Zurück-Pfeil) haben zusätzlich `active:`-Tailwind-Varianten für Touch-Feedback.

- **Homepage-/App-Hintergrund (Schlieren-/Banding-Fix):**
  - `components/effects/AppBackground.tsx`: Die vier WebP-Hintergrundbilder (Light/Dark, Desktop/Mobile) wurden entfernt und durch einen reinen CSS-Farbverlauf ersetzt (Light: warmes Sand-Off-White `#FCF4E6→#EDE3CE`; Dark: `slate-900 → slate-800 → indigo-950`) inkl. subtilem Radial-Glow und feinem SVG-Rauschen (`bg-noise`) gegen Color-Banding auf mobilen 8-Bit-Panels. Kein Bild-Download/Decoding mehr.
  - `app/globals.css`: Die ungenutzten `.app-bg`-Bildregeln wurden ebenfalls auf Gradienten umgestellt.

- **Radikale Überarbeitung des Flashcard-Screens (aktiver Lernmodus, Mobile):**
  - `app/[lang]/dashboard/level/[level]/vocabulary/train/page.tsx`: Navigation & Layout wandern vollständig in den Client (nur dort ist `compose` vs. `train` bekannt); der doppelte „Zurück zur Übersicht"-Link und der `min-h-screen`-Wrapper wurden entfernt.
  - `VocabTrainerClient.tsx`: Compose-Modus (Lernkasten) erhält EINEN Zurück-Pfeil oben links; der redundante Bottom-Link „Weitere Vokabeln hinzufügen" wurde entfernt.
  - `VocabCardSession.tsx` (Lernmodus): Zusammengeführte Navigation (ein `<`-Pfeil) + EINE kompakte Meta-Zeile `Lektion X • Karte a/b • Phase c/6`. Die Karte wird vertikal im verbleibenden Viewport zentriert (`min-h-[calc(100dvh-12rem)]`, mobil kompaktere Bild-/Padding-Größen), sodass Lösung und Aktions-Buttons ohne Scrollen sichtbar sind. Redundante Erklärtexte (`phase_explanation`) und der Link „Weitere Vokabeln hinzufügen" wurden aus dem Lernmodus entfernt.
  - i18n: Neue Keys `card_progress_compact` und `phase_compact` in `lib/vocabulary-i18n.ts` (Fallbacks) sowie in allen fünf Dictionaries (`de/en/uk/ru/tr`).

## 1a. Änderungsprotokoll — 2026-09-06: SMTP Server-Only Isolation & Netlify Secret Leak Fix

**Kernänderungen:**
- **Ursache des Netlify Secret Scans:**
  - Netlifys Secret-Scanner vergleicht den String-Wert von Umgebungsvariablen (z. B. `SMTP_USER="info@sitov-academy.com"`) mit den generierten statischen HTML-Seiten.
  - Da `info@sitov-academy.com` gleichzeitig die offizielle, öffentliche Kontakt- und Impressums-E-Mail der Sprachschule ist (im Footer und JSON-LD Schema), schlug der Scanner fälschlicherweise Alarm (False Positive).
- **Server-Only Isolation für Mailer:**
  - `lib/mail.ts`: Zentrales Mailer-Modul mit `import 'server-only'` und `sendEmail(options)` Helper. Verhindert, dass `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` oder `SMTP_FROM` jemals in Client-Bundles oder Edge-Umgebungen gelangen.
  - `app/actions/feedback.ts`: Direkte `nodemailer`-Aufrufe und inline-`process.env.SMTP_*`-Zugriffe durch `sendEmail()` aus `lib/mail.ts` ersetzt.
- **Netlify Scanner Konfiguration (`netlify.toml`):**
  - Ergänzung von `SECRETS_SCAN_OMIT_KEYS = "SMTP_USER,SMTP_FROM"`, damit Netlify den legitimen öffentlichen Text der E-Mail-Adresse nicht als Secret-Leak blockiert.
- **Entkopplung öffentlicher E-Mail-Adressen:**
  - Öffentliche Kontakt- und Impressums-Adressen (`info@sitov-academy.com`) sind strikt als statische Textbausteine in den Dictionaries und Komponenten hinterlegt und greifen niemals auf `SMTP_USER` zu.

## 1b. Änderungsprotokoll — 2026-09-06: Meta Pixel Lead Tracking & Live-Produktionsschalter

**Kernänderungen:**
- **Meta Pixel Event Tracking:**
  - `lib/analytics/meta-pixel.ts`: Typensicherer Client-Helper `trackMetaEvent(eventName, params)` für Meta Pixel Events.
  - `components/registration/EnrollmentTerminal.tsx`:
    - Probestunden-Buchung (`onTrialSubmit`) triggert bei Erfolg das Standard-Event `Lead` (`content_name: 'Kostenlose Probestunde'`, `value: 0.00`, `currency: 'EUR'`).
    - Reguläre Kurseinschreibung (`onSubmit`) triggert bei Erfolg das Standard-Event `Purchase` mit dem monatlichen Kurspreis und den gebuchten Kurs-IDs.
- **Produktionsschalter (Lernplattform ausblenden):**
  - `lib/config/app-config.ts`: Zentraler Parameter `IS_PRODUCTION: 'Y' | 'N'` (Standard: `'Y'`, steuerbar auch via `NEXT_PUBLIC_IS_PRODUCTION`).
  - Helper `SHOW_LEARNING_PLATFORM`: Bei `IS_PRODUCTION = 'Y'` wird der Button "Lernplattform" / "Plattform" im Desktop- und Mobile-Menü (`components/layout/Header.tsx`) für Besucher vollständig ausgeblendet, da sich dieser Bereich noch in der Entwicklung befindet.

## 1b. Änderungsprotokoll — 2026-09-06: Neues Lizenz- & Rechtemodell (Admin-Freigabe je Sprachniveau)

**Kernänderung:** Das Free/Premium-Modell wurde als Zugriffssteuerung im Lernbereich abgelöst durch ein **Admin-Freigabe-System pro Sprachniveau**.

- **DB (Live-Migration `add_allowed_levels_to_profiles`):** Neue Spalte `profiles.allowed_levels text[] NOT NULL DEFAULT '{}'`. Additiv & rückwärtskompatibel; bestehende `subscription_status`/Stripe-Spalten bleiben unangetastet. Bestehende aktive Nutzer wurden mit allen aktuell verfügbaren Levels backfilled, damit kein Zugang bricht. `schema.sql` und `database.types.ts` synchronisiert.
- **Neu registrierte Nutzer** haben `allowed_levels = '{}'` → zunächst keinen Zugriff auf gebührenpflichtige Niveaus. Admin/Teacher besitzen rollenbasiert Vollzugriff.
- **Zugriffslogik:** `lib/access/levels.ts` (`ACCESS_LEVELS = A1.1, A1.2, A2.1, A2.2, B1.1, B1.2`, `hasLevelAccess`, `sanitizeAllowedLevels`) + `lib/access/server.ts`.
- **Route-Guard:** `app/[lang]/dashboard/level/[level]/layout.tsx` sperrt alle Level-Unterseiten und zeigt eine freundliche „gesperrt"-Ansicht (`components/dashboard/LevelLocked.tsx`, i18n `level_locked_*` in fünf Sprachen). Zusätzlich Defense-in-Depth in den level-bezogenen Server Actions.
- **Dashboard:** Gesperrte Niveaus werden auf der Startseite mit Schloss-Badge und Hinweis dargestellt und sind nicht klickbar.
- **Admin-Dashboard:** `components/admin/StudentList.tsx` zeigt statt Abo-Dropdown pro Nutzer Checkbox-Chips für jedes Sprachniveau; Speichern über `updateStudentAllowedLevels`. KPI „Premium Abos" → „Freigeschaltete Nutzer".
- **In-App-Premium entfernt:** Route `/dashboard/premium` gelöscht, Free/Premium-Badge im Dashboard-Header entfernt, Abo-/Kauf-Sektion aus dem Profil entfernt, `/premium` aus `isProtectedPath` entfernt. Öffentliche Kurs-Buchung (Stripe für echte Kurse: `registrations`/`enrollments`/`courses`) bleibt **unverändert** erhalten.

## 2. Tech-Stack & Abhängigkeiten
- **Framework:** Next.js 16.1.1 (App Router)
- **Sprache:** TypeScript (strict mode)
- **Styling:** Tailwind CSS, `clsx`, `tailwind-merge`
- **Animationen:** Framer Motion, GSAP, Lenis (Smooth Scrolling)
- **Datenbank & Auth:** Supabase (`@supabase/ssr`, `@supabase/supabase-js`)
- **Payment:** Stripe (`stripe` 22.4.0)
- **Formulare & Validierung:** React Hook Form, Zod
- **Testing:** Jest, Playwright (E2E), React Testing Library
- **Mailing:** Nodemailer
- **Caching/Rate-Limiting:** Upstash Redis & Ratelimit

## 3. Funktionierende Features
- **Internationalisierung (i18n):** Middleware für Routing über `app/[lang]`. Unterstützte Sprachen: `de`, `en`, `ru`, `uk`, `tr`.
- **Authentifizierung:** Supabase Auth mit Session-Update in der Middleware, Confirm-Route unter `/auth/confirm` (PKCE und Token-Hash), i18n-Auth-Seiten in fünf Sprachen. Bestätigungslinks zeigen auf `https://www.sitov-academy.com`, nicht auf localhost.
- **Vokabeltrainer A1.1:** Live-Inhalt sind die Lernsets **Lektion 1** (84 Karten), **Lektion 2** (85 Karten: Befinden, Familie, Zahlen) und **Lektion 3** (76 Karten: Lebensmittel, Geschäfte, Mengen, Verben & Redemittel beim Einkaufen). Seed-SQL: `supabase/seeds/a11_lektion_1.sql`, `a11_lektion_2_familie.sql`, `a11_lektion_3_einkauf.sql`. Migration: `supabase/migrations/move_einkauf_vocab_to_a11_lektion_3.sql`.
- **Rollen-Routing & Schutz:** Die Middleware unterscheidet zwischen öffentlichen Pfaden, geschützten Pfaden (`/dashboard`, `/admin`) und Auth-Pfaden (`/login`, `/register`). Der Zugriff auf einzelne Sprachniveaus wird zusätzlich pro Nutzer über `profiles.allowed_levels` gesteuert (Route-Guard im Level-Layout).
- **Teacher/Admin Dashboard (Ansatz):** Ordnerstrukturen für `/admin` existieren, grundlegende Routen sind angelegt.
- **Datenbank-Schema:** Komplexe Tabellenstrukturen existieren bereits (Kurse, Registrierungen, Profile mit Rollen `student/teacher`, Vokabel-Kartenbank, Übungen, Video-Lektionen, Lehrer-Feedback-System).
- **Supabase MCP-Integration:** Cursor-Supabase-Plugin authentifiziert; Schema-Sync via Live-Projekt `wcaslabeiwtvygxtzcio`. `supabase/schema.sql` und `supabase/database.types.ts` sind mit dem Live-Stand synchronisiert (2026-09-02).

## 3a. Übungs-Modul: Lückentexte (abgeschlossen, Schritt 1)
- **Tipp-Chips statt Tastatur:** Das freie `<input>` im Lückentext ist entfernt. Lernende tippen einen von mehreren Auswahl-Chips an (Tap-to-Select, kein Drag-and-Drop, 64px Touch-Targets).
- **Chip-Generierung:** Von der Lehrkraft gepflegte `content.options` haben Vorrang. Fehlen sie, erzeugt `lib/exercise-chips.ts` Distraktoren aus derselben Wortfamilie (sein/haben/Modalverben/Artikel/Pronomen), danach morphologisch, danach aus Lösungen benachbarter Übungen. Die Reihenfolge ist über einen Seed aus der Übungs-ID deterministisch (keine Hydration-Fehler, keine springende UI).
- **Smart Hints:** Ab 2 Fehlversuchen erscheint ein dezenter Hinweis (Genus aus der Vokabelbank bzw. Wortart), ab 3 Fehlversuchen Anfangsbuchstabe und Wortlänge. Stufe 1 verrät die Lösung nie.
- **Zero-Error-UX:** Falsch getippte Chips werden ausgegraut statt als Fehler markiert; die Aufgabe bleibt offen, bis sie gelöst ist. Kein Timer, keine Bestenliste, kein rotes Fehler-Feedback.
- **Native Audio-Wiedergabe:** Nach dem Lösen stehen Tap-Buttons für das Wort und den gesamten Satz bereit. Fallback-Kette: `exercises.solution_audio_url` → `vocabulary_cards.audio_url` → Web-Speech-API → Hinweistext.
- **Strict Typing:** `content: any` ist durch eine diskriminierte Union mit JSONB-Parsern ersetzt (`lib/types/exercise.ts`). Ungültig gepflegte Inhalte werden serverseitig ausgefiltert und geloggt, statt eine leere Karte zu rendern.
- **Route-Vollständigkeit:** `error.tsx` und `loading.tsx` (Skeleton) für `/dashboard/level/[level]/exercises` ergänzt.
- **i18n:** Alle neuen Texte liegen in `dictionaries/{de,en,ru,uk,tr}.json` unter `exercises`; Platzhalter wie `{letter}` werden über `lib/exercise-i18n.ts` interpoliert.
- **CMS:** Lehrkräfte pflegen jetzt Auswahl-Chips, einen eigenen Smart Hint und eine Audio-URL pro Übung.
- **DB-Migration:** `supabase/migrations/add_fill_in_blank_chips.sql` (additiv: `user_exercise_progress.attempts`, `.hint_shown`, `exercises.solution_audio_url`, Score-CHECK, zwei Indizes). **Noch nicht am Live-Projekt ausgeführt** – bis dahin schlagen Chip-Übungen zur Laufzeit fehl.

## 3b. Vokabel-Modul: Phase-6-Leitner (abgeschlossen, Schritt 2)
- **Phasenmodell:** `lib/leitner.ts` kapselt das Modell als reine, testbare Funktionen. Sechs aktive Phasen mit den Ruhezeiten Tag 1, 1, 3, 9, 29, 90; `box_number = 7` ist der terminale Zustand „gelernt" und wird nicht mehr abgefragt. Der bestehende CHECK (1..7) bleibt damit unverändert gültig.
- **Fehler-Regel:** Eine falsche Antwort setzt die Vokabel **exakt eine Phase** zurück (Minimum Phase 1). Es wird nichts zurückgesetzt oder gelöscht; eine bereits gelernte Karte landet zurück in Phase 5. Ein Zähler `lapses` protokolliert jede Rückstufung.
- **Kontrastive Anpassung:** Für Vokabeln, die für die Muttersprache des Lernenden als schwer markiert sind (`is_hard_for_ru` / `is_hard_for_tr`), wird die Ruhezeit halbiert (mindestens 1 Tag). Die Muttersprache wird serverseitig aus dem Profil gelesen, nie vom Client übernommen.
- **Server Actions:** `app/actions/vocabulary.ts` ist vollständig typisiert (`lib/types/vocabulary.ts`), `any` ist entfernt. `submitVocabularyAnswer` schreibt Phase, Termin, `lapses` und `last_answered_at` in einem Aufwasch; die Revalidierung passiert erst in `finishVocabularySession`, damit die laufende Session nicht neu lädt.
- **Bugfix `initializeLesson`:** Die Funktion filterte nur nach Lektionsnamen und legte dadurch Karten fremder Sprachniveaus an. Sie filtert jetzt zusätzlich nach `level`.
- **Geragogik-UI:** `VocabTrainerClient` zeigt Phase und Fortschritt ruhig an, arbeitet mit Tap-to-Select (kein Drag-and-Drop), Touch-Targets ab 64px und einer 24px-Kartenfrage. Nach jeder Antwort erklärt ein Hinweis in Klartext, was passiert ist („Zurück in Phase 3. Du siehst diese Vokabel morgen wieder."). Kein Timer, keine Bestenliste, kein rotes Fehler-Feedback.
- **Route-Vollständigkeit:** `error.tsx` und `loading.tsx` (Skeleton) für `/dashboard/level/[level]/vocabulary` und `.../vocabulary/train`.
- **i18n:** 45 neue Keys unter `vocabulary` in `dictionaries/{de,en,ru,uk,tr}.json`; Interpolation über `lib/vocabulary-i18n.ts`.
- **Tests:** `__tests__/leitner.test.ts` (17 Tests) sichert Intervalle, Aufstieg, die Ein-Phasen-Rückstufung, die Untergrenze Phase 1 und die Migrations-Neuberechnung ab.
- **DB-Migration:** `supabase/migrations/add_phase6_leitner.sql` (additiv: `user_vocabulary_progress.lapses`, `.last_answered_at`, Index `idx_user_vocabulary_progress_due`, Neuberechnung der Termine per `LEAST`). **Noch nicht am Live-Projekt ausgeführt.**

## 3c. Sprachübungen & Lehrer-Feedback (abgeschlossen, Schritt 3)
- **Waveform-Tonspur:** `lib/audio/waveform.ts` liefert die Verdichtung auf 48 Balken (Spitzenwert je Abschnitt, nicht Mittelwert), die Normalisierung auf den lautesten Balken und die Pegelberechnung aus dem `AnalyserNode`. Bewusst reine Funktionen ohne Browser-APIs, damit sie testbar bleiben.
- **Zwei Darstellungen:** `LiveWaveform` zeigt die Aufnahme im Verlauf (`AnalyserNode`, ein Balken je ~110 ms, füllt von links und scrollt erst wenn voll). `WaveformPlayer` zeigt die fertige Datei mit eingefärbtem Fortschritt, Zeitanzeige, Tempo-Umschalter (1×/0,75×/1,25×) und Sprung per Tap. Umsetzung als `div`-Balken statt Canvas: skaliert auf Retina ohne Zusatzlogik und trägt echte ARIA-Semantik (`role="slider"` mit `aria-valuetext`, Pfeiltasten springen 5 Sekunden).
- **Entdoppelte Aufnahme-Logik:** `getUserMedia`, `MediaRecorder` und Analyser lagen doppelt in `AudioRecorder` und `PendingSubmissionCard`. Beide nutzen jetzt den Hook `lib/audio/useAudioRecorder.ts`, der MIME-Type-Auswahl (webm/opus → webm → mp4 für Safari), Mikrofon-Freigabe, Fehlerzustände und das Freigeben von Stream, AudioContext und Object-URL kapselt.
- **Zentraler Upload:** `lib/audio/upload.ts` bündelt den Storage-Upload. Die Pfad-Schemata (`{userId}-{timestamp}` bzw. `feedback/{submissionId}_{timestamp}`) sind unverändert, damit die bestehenden Storage-Policies weiter greifen.
- **Ein Korrektur-Loop statt zwei:** `/admin/feedback` war ein zweites, veraltetes Lehrer-Dashboard (nur Text-Feedback, rohes `<audio>`, `any`). Die Route leitet jetzt dauerhaft auf `/admin/submissions` um; alte Lesezeichen funktionieren weiter.
- **Dashboard-Benachrichtigung:** `teacher_feedback.seen_at` trägt den Gelesen-Status. `getUnseenFeedbackSummary` zählt offene Rückmeldungen, `FeedbackNotificationCard` zeigt sie als erklärende Karte über dem Niveau-Raster („Du hast eine neue Sprachnachricht erhalten") mit direktem Link auf das betroffene Sprachniveau – kein roter Zähler am Menüpunkt.
- **Gelesen-Markierung ohne Schreibrechte:** Der Schüler erhält keine UPDATE-Policy auf `teacher_feedback`. Das Setzen von `seen_at` läuft über die SECURITY-DEFINER-Funktion `mark_feedback_seen(uuid)`, die nur eigene Einreichungen und nur diese eine Spalte anfasst. Die „Neu"-Markierung bleibt für den laufenden Seitenaufruf sichtbar, damit der Hinweis nicht vor den Augen des Lernenden verschwindet.
- **Strict Typing & Fehlerbehandlung:** `app/actions/feedback.ts` ist vollständig typisiert (`lib/types/feedback.ts`), `any` ist entfernt, jede Action liegt in try/catch und gibt statt roher DB-Meldungen eine Kennung (`not_authenticated` | `save_failed` | `invalid_input`) zurück. Die E-Mail-Benachrichtigung ist gekapselt und kann die Feedback-Freigabe nicht mehr blockieren; ihr Deep-Link zeigt jetzt auf die korrekte Level-Route statt auf den alten Pfad `/dashboard/pronunciation`.
- **Route-Vollständigkeit:** `error.tsx` und `loading.tsx` (Skeleton) für `/dashboard/level/[level]/pronunciation`.
- **i18n:** 49 neue Keys unter `pronunciation` in `dictionaries/{de,en,ru,uk,tr}.json`; Interpolation über `lib/pronunciation-i18n.ts`. Die Aussprache-Seite enthält keine hartcodierten Strings mehr.
- **Tests:** `__tests__/waveform.test.ts` sichert Pegelberechnung aus dem `AnalyserNode`, Zeitformatierung, Sprungposition und die Frame-Glättung (`smoothTowards`) ab. (Peak-Verdichtung/Normalisierung/Balkenhöhen-Tests entfernt am 2026-09-03, da die zugehörigen Balken-Funktionen mit dem Umstieg auf `FluidWaveform` toter Code wurden, siehe 4e.)
- **DB-Migration:** `supabase/migrations/add_feedback_notifications.sql` (additiv: `teacher_feedback.seen_at`, partieller Index auf ungelesene Zeilen, Index `idx_submissions_user_level_created`, Funktion `mark_feedback_seen`, Backfill für Feedback älter als 7 Tage).
- **Security-Advisor sauber:** `mark_feedback_seen` ist mit `search_path = ''` und einem expliziten `REVOKE ... FROM anon` gehärtet. Der Hinweis „Public Can Execute SECURITY DEFINER Function" ist für diese Funktion erledigt; der verbleibende Hinweis für `authenticated` ist beabsichtigt, denn genau der eingeloggte Schüler soll den Gelesen-Status setzen.

## 3d. Authentifizierung produktionsreif (2026-09-02)
- **Ursache der localhost-Mails:** Der live deployte `signup` setzte `emailRedirectTo` auf `http://localhost:3000/auth/confirm`, sobald `NEXT_PUBLIC_SITE_URL` fehlte. Zusätzlich behandelte die Middleware `?lang=de` als Legacy-Startseiten-URL und leitete `/auth/confirm?lang=de` per 301 auf `/de` um – das Einmal-Token war weg, noch bevor die Confirm-Route es lesen konnte. Die Confirm-Route verstand nur `token_hash`, die Mails liefern aber den PKCE-`code`.
- **Fix App:** `getOutboundSiteUrl()` in `lib/site-url.ts` erzeugt Auth-Links nie mit localhost; Fallback ist `https://www.sitov-academy.com`. `netlify.toml` setzt `NEXT_PUBLIC_SITE_URL` für Production-Builds.
- **Fix Routing:** `lib/locale-routing.ts` nimmt `/auth` von Locale- und `?lang=`-Redirects aus. Matcher und Laufzeitlogik greifen doppelt. `/admin` ist für Unangemeldete geschützt.
- **Fix Confirm:** `app/auth/confirm/route.ts` und `/auth/callback` tauschen PKCE-Codes und Token-Hashes, leiten über `NEXT_PUBLIC_SITE_URL` weiter und schicken nach Erfolg direkt auf `/{lang}/dashboard`.
- **Fix 404 der Lernrouten:** `/de/login`, `/de/register` und `/de/dashboard` antworten auf der Live-Site derzeit mit einer vorgerenderten 404. Auth- und Dashboard-Layouts sind `force-dynamic`, damit Netlify sie als Server-Funktion ausliefert statt als statische Leerstelle.
- **Supabase (kein SQL):** Site URL und Redirect-Allowlist müssen in Authentication → URL Configuration auf `https://www.sitov-academy.com` stehen. Die Vorlagen in `supabase/templates/` müssen ins Dashboard kopiert werden; sie nutzen `token_hash` und `RedirectTo`, damit der Link auch auf einem anderen Gerät (Tablet) funktioniert.
- **Tests:** `__tests__/site-url.test.ts`, `__tests__/locale-routing.test.ts`, `__tests__/auth-i18n.test.ts`, `__tests__/auth-callback.test.ts`, `__tests__/supabase-env.test.ts`.

## 4. Bekannte Bugs & Unvollständige Implementierungen (Tech Debt)
- **Smartphone-Lernplattform (2026-09-02):** Dashboard-Hülle, Niveau-Kacheln, Videos, Profil, Übungen, Vokabeltrainer und Aussprache sind Mobile-First (375px): gestapelte Header-Zeile, 48px-Targets, `min-h-dvh`, Safe-Area, volle Primärbuttons, `break-words`. Profil ist über das Header-Icon erreichbar. Die alte Route `/dashboard/lessons` leitet auf die Niveau-Übersicht um.
- **i18n Lernplattform:** Hartcodierte deutsche Strings in Layout, Level-Kacheln, Videos, Profil und Premium liegen in `dictionaries/{de,en,ru,uk,tr}.json` unter `dashboard`, `videos` und `profile`. Helfer: `lib/dashboard-i18n.ts`, `lib/videos-i18n.ts`, `lib/profile-i18n.ts`. Der Dashboard-Titel nutzt `title_before`/`title_highlight` statt HTML mit ungültigem `className`. Russisch: Tippfehler „алфавіт“ → „алфавит“.
- **Video-Routen:** Interne Videos zeigen auf `/dashboard/level/[level]/videos/[id]` (vorher `/dashboard/videos/[id]`, 404). Der Player ist ein Server Component plus Client ohne `any`.
- **Lehrer-Oberfläche ohne i18n:** `SubmissionsDashboard` und `PendingSubmissionCard` enthalten weiterhin deutsche Strings im Code. Bewusst zurückgestellt, da die Korrektur-Ansicht ausschließlich von deutschsprachigen Lehrkräften genutzt wird.
- **Übungstyp `sentence_building`:** Im Schema und CMS vorhanden, aber noch ohne Studenten-UI. Solche Übungen werden derzeit serverseitig übersprungen und protokolliert, damit keine leere Karte erscheint.
- **Marketing-Landing & Admin:** Die öffentliche Startseite und das Lehrer-Dashboard sind noch nicht vollständig auf 320px/375px nachgezogen; der Smartphone-Agent gilt weiter für neue UI-Änderungen.
- **Teacher-Dashboard Vollständigkeit:** Das Korrigieren von Audio-Einsendungen ist umgesetzt; es fehlt weiterhin das feingranulare UI zur Verwaltung von Schülern (z.B. Abo-Status anzeigen).
- **Stripe-Integration:** Die Basis-Bibliothek ist installiert, aber der vollständige Webhook-Workflow und das Paywall-Blocking auf Serverseite sind noch nicht vollständig implementiert.
- **Strict Typing:** Generierte Supabase-Types (`supabase/database.types.ts`) sind an alle Client-Factory-Funktionen (`utils/supabase/*`) angebunden. `app/actions/exercises.ts`, `app/actions/vocabulary.ts` und `addExercise` in `app/actions/cms.ts` sind vollständig typisiert; `addVocab` und `addVideo` nutzen weiterhin `any` und stehen zur Umstellung an (Zero-Error-Policy).

## 4a. Dashboard-Header-Layout (2026-09-03, behoben)
- **Fehler:** Logo, Breadcrumb-Navigation, Profil-Icon und „Abmelden“ klebten im `DashboardLayout`-Header linksbündig zusammen, da der Container kein `justify-between` nutzte und `DashboardHeader` doppelt (mit inkonsistenten `sm:`/`md:`-Breakpoints) gerendert wurde.
- **Fix:** `app/[lang]/dashboard/layout.tsx` nutzt jetzt einen einzigen `flex flex-wrap justify-between`-Container mit `order-*`-Klassen: Logo (`order-1`) ganz links, Profil/Theme/Abmelden (`order-2` mobil / `order-3` ab `md:`) ganz rechts, Breadcrumb (`order-3 basis-full` mobil / `order-2 md:basis-auto` ab `md:`) mittig zwischen den beiden Blöcken. `DashboardHeader.tsx` wird nur noch einmal instanziiert; sein interner Breakpoint ist auf `md:` vereinheitlicht (vorher `sm:`, Mismatch mit dem Layout).
- **Mobile:** Auf dem Smartphone bricht die Navigation automatisch in eine eigene volle Zeile unterhalb von Logo/Profil-Block um (`basis-full`) – kein Quetschen, kein horizontales Scrollen, kein zusätzliches Burger-Menü nötig.

## 4b. Audio-Upload-Fehler behoben (2026-09-03)
- **Ursache:** `lib/audio/upload.ts` sendete den vollen `MediaRecorder`-MIME-Type inkl. Codec-Parameter (z.B. `audio/webm;codecs=opus`) als `Content-Type` an Supabase Storage. Storage-Fehler wurden zudem nur mit einer einzeiligen `error.message` geloggt – Bucket, Pfad und Statuscode fehlten, was die Fehlersuche im Live-Betrieb erschwerte.
- **Fix Upload:** Neue Hilfsfunktion `baseMimeType()` reduziert den MIME-Type vor dem Senden auf den reinen Basistyp (`audio/webm` bzw. `audio/mp4`); `extensionForMimeType()` nutzt dieselbe Basis für die Dateiendung. `.upload()` läuft jetzt mit `upsert: true`, damit ein erneuter Versand unter demselben Pfad nicht an einem „Resource already exists“-Fehler scheitert.
- **Fix Logging:** Jeder Fehlerpfad (fehlende Sitzung, Storage-Fehler, Netzwerk-/Laufzeitfehler) loggt jetzt strukturiert über `console.error` mit Bucket, Pfad, `blob.type`, `contentType`, Blob-Größe und den verfügbaren Fehlerfeldern (`name`, `message`, `status`). `AudioRecorder.tsx` loggt zusätzlich den Ablaufkontext (Upload- vs. Speichern-Schritt) und fängt jetzt auch Netzwerkfehler beim Aufruf der Server Action `submitAudioUrl` ab (vorher unbehandelte Promise-Rejection möglich).
- **Bucket-Name verifiziert:** Code (`AUDIO_BUCKET = 'audio_submissions'`) und Live-Bucket stimmen überein (Unterstrich, kein Bindestrich). Kein Rename notwendig.
- **DB-Migration:** `supabase/migrations/fix_audio_submissions_storage_policies.sql` (idempotent) am Live-Projekt ausgeführt: Bucket-Existenz + `public = true` sichergestellt, INSERT- und neue UPDATE-Policy (für `upsert: true`) für `authenticated`, SELECT-Policy für `public` neu gesetzt.

## 4c. Vokabeltrainer: Detailansicht, manuelle Übernahme & Einstufungs-Modus (2026-09-03)
- **Lektions-Detailansicht:** Jede Lektion in `LessonList` (`components/vocabulary/LessonList.tsx`, ersetzt die frühere Inline-Liste in `page.tsx`) lässt sich per Button öffnen – als Modal (`LessonCardsModal`, siehe 4e, seit 2026-09-03; ursprünglich als Inline-Akkordeon umgesetzt). Beim Öffnen lädt die neue Server Action `getLessonCards(lesson, level)` alle Vokabeln der Lektion inklusive persönlichem Lernstand; jede Karte zeigt ein Phasen-Badge (Phase 1–6 farblich gestuft von Amber über Blau bis Grün, „Gelernt" in kräftigem Grün) oder – falls noch nicht übernommen – einen „Aufnehmen"-Button.
- **Manuelle Einzelvokabel-Übernahme:** Der „Aufnehmen"-Button je Vokabel ruft die neue Server Action `addCardsToTrainer(cardIds)` auf und legt genau diese eine Karte sofort in Phase 1 an (optimistisches UI-Update ohne Neuladen der Liste, `router.refresh()` synchronisiert danach die Lektions-Statistik).
- **„Vokabeln einstufen"-Modus (Pre-Assessment):** Neue Route `/dashboard/level/[level]/vocabulary/assess?lesson=…` (Server-Page + `LessonAssessmentClient`, jeweils mit `loading.tsx`/`error.tsx`). Der Lernende sieht unbearbeitete Vokabeln der Lektion nacheinander (Wort + Übersetzung gleichzeitig sichtbar) und entscheidet: „Kenne ich schon" (Server Action `submitLessonAssessment` setzt die Karte direkt auf Box 7/„gelernt" mit regulärer Phase-6-Ruhezeit) oder „In Karteikasten aufnehmen" (Start in Phase 1, sofort fällig). Jede Entscheidung wird einzeln und sofort gespeichert, ein Abbruch mittendrin verliert keinen Fortschritt. Der Lektions-Button in der Übersicht heißt „Vokabeln einstufen" (unberührte Lektion) bzw. „Weitere Vokabeln einstufen" (teilweise übernommen) und ersetzt den früheren Sofort-Start-Button.
- **Strict Typing:** Neue Typen `LessonCardView`, `AddCardsResult`, `AssessmentDecision`, `SubmitAssessmentResult` in `lib/types/vocabulary.ts`; alle drei neuen Server Actions in `app/actions/vocabulary.ts` sind vollständig typisiert, in try/catch gekapselt und loggen Fehler serverseitig mit Kontext.
- **DRY-Refactor:** `articleColorClass` (Artikelfarben) lag dupliziert in `VocabTrainerClient`; jetzt zentral in `lib/vocabulary-ui.ts` zusammen mit der neuen `phaseBadgeClasses`-Hilfsfunktion, von `VocabTrainerClient`, `LessonList` und `LessonAssessmentClient` gemeinsam genutzt.
- **i18n:** 27 neue Keys unter `vocabulary` in `dictionaries/{de,en,ru,uk,tr}.json` (Detailansicht, manuelle Übernahme, Einstufungs-Modus), Fallbacks in `lib/vocabulary-i18n.ts`. Keine hartcodierten Strings.
- **Geragogik-UX:** Alle neuen interaktiven Elemente (Aufnehmen-Button, Aufklapp-Button, Einstufen-Buttons) sind mindestens 48px hoch, Schriftgrößen ab 18px (`text-lg`/`text-xl`), klare Kontraste (Amber/Blau/Grün-Badges), Fokusringe in Markenfarbe `#FF5C00`.
- **Zero-Error-Bugfix nebenbei:** `components/audio/AudioRecorder.tsx` hatte einen echten TypeScript-Fehler (`upload.reason` auf dem Erfolgs-Zweig des discriminated union `AudioUploadResult`). Behoben durch explizite Prüfung `upload.success === false`.

## 4d. Supabase-Browser-Client-Fix & Siri-Style Live-Waveform (2026-09-03)
- **Ursache Fehler „URL and API key are required":** `utils/supabase/client.ts` las `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` über die gemeinsame Hilfsfunktion `readSupabasePublicConfig()` (`env = process.env as SupabasePublicEnv`, dann `env.NEXT_PUBLIC_SUPABASE_URL`). Next.js ersetzt `NEXT_PUBLIC_`-Variablen im Browser-Bundle aber **nur** bei wortwörtlichem `process.env.NEXT_PUBLIC_XXX`-Zugriff zur Build-Zeit (Turbopack-Textmuster-Ersetzung, keine Datenfluss-Analyse). Über die Zwischenfunktion blieben beide Werte im Browser zur Laufzeit `undefined`, `createBrowserClient('', '')` schlug fehl – serverseitig (Server Components, Middleware, Admin-Client) trat der Fehler nie auf, weil dort zur Laufzeit ein echtes `process.env` existiert.
- **Fix:** `utils/supabase/client.ts` liest die beiden Variablen jetzt **direkt und literal** (`process.env.NEXT_PUBLIC_SUPABASE_URL!`, `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!`-Muster, aber mit sauberer Prüfung statt Non-Null-Assertion). Fehlen sie, wird ein verständlicher `console.error` (inkl. `hasUrl`/`hasAnonKey`) geloggt und ein neuer, typisierter `SupabaseConfigError` geworfen – kein unkontrollierter Absturz. `lib/audio/upload.ts` fängt genau diesen Fehlertyp ab und liefert dem UI den eigenen Grund `reason: 'not_configured'` (statt eines generischen `upload_failed`), sodass sich Konfigurationsfehler in den Server-Logs sofort von echten Storage-Fehlern unterscheiden lassen; die Studenten sehen weiterhin nur die freundliche Standardmeldung. `lib/supabase-env.ts` trägt jetzt einen Warnhinweis, dass es ausschließlich serverseitig verwendet werden darf.
- **Plattformunabhängig:** Der Fix hängt an keiner Vercel- oder Netlify-Spezifik – beide führen denselben Next.js-Build aus und müssen `NEXT_PUBLIC_*` lediglich zur **Build-Zeit** bereitstellen (Vercel: „Shared" Environment Variables mit Build-Freigabe; Netlify: `@netlify/plugin-nextjs` liest dieselben Variablen). `.env.example` und der Kommentar in `client.ts` weisen jetzt explizit darauf hin.
- **Test:** Neuer `__tests__/supabase-client.test.ts` (mockt `@supabase/ssr`) prüft: fehlende Variable(n) → `SupabaseConfigError` + `console.error`; beide gesetzt → `createBrowserClient` wird mit den korrekten Werten aufgerufen.
- **Siri-Style Live-Waveform:** `components/audio/LiveWaveform.tsx` ist von DOM-Balken auf ein `<canvas>` umgestellt. Drei phasenverschobene, sanft schwingende Sinus-Wellen (Web Audio API: `AnalyserNode.getByteTimeDomainData`, ausgewertet über die bestehende `levelFromTimeDomain()`) werden jeden Frame per `requestAnimationFrame` neu gezeichnet; die Amplitude nähert sich per neuer Hilfsfunktion `smoothTowards()` (`lib/audio/waveform.ts`, mit Unit-Tests) weich an den aktuellen Mikrofon-Pegel an, statt zu springen. Farbschema: leuchtender Orange-Verlauf (`rgba(255,122,26,…)`) mit `shadowBlur`-Glow auf transparentem Grund. `useAudioRecorder.ts` gibt dafür neu `analyserRef` (Live-`AnalyserNode`) nach außen frei; `AudioRecorder.tsx` und `PendingSubmissionCard.tsx` reichen ihn an `LiveWaveform` durch. Ohne Analyser (Browser ohne AudioContext) fällt die Komponente auf den letzten Wert aus `levels` zurück – keine Regression für ältere Browser.
- **Cleanup:** Die Canvas-Animation räumt sich selbst auf (`cancelAnimationFrame` + `ResizeObserver.disconnect()` im Effect-Cleanup); Mikrofon-Stream und `AudioContext` werden weiterhin zentral von `useAudioRecorder`s `teardown()` freigegeben (`stream.getTracks().forEach(t => t.stop())`, `audioContext.close()`) – keine doppelte Verantwortung für dieselbe Ressource.
- **Geragogik:** Respektiert `prefers-reduced-motion` (langsamere Phase, stärkere Glättung statt kompletter Bewegungslosigkeit, damit die Rückmeldung „es nimmt gerade auf" erkennbar bleibt). *(Am 2026-09-03 wurde die Canvas-Wave aus `LiveWaveform` in die wiederverwendbare `FluidWaveform` extrahiert und auch für `WaveformPlayer` übernommen, siehe 4e – der letzte Satz zu „`WaveformPlayer` bleibt Balken-basiert" ist damit überholt.)*

## 4e. Unified Siri-Waveform, Vokabeltrainer-Bugfix, No-Scroll-Layout & Re-Branding (2026-09-03)

**1. Unified Siri-Waveform (`FluidWaveform`):**
- Die Canvas-Wellen-Logik aus `LiveWaveform` wurde in eine eigenständige, datenquellen-agnostische Komponente `components/audio/FluidWaveform.tsx` extrahiert. Sie nimmt nur noch eine `getVolume(): number`-Callback-Prop (0–1 je Frame) und `isActive` entgegen – woher der Pegel kommt, entscheidet der Aufrufer.
- `LiveWaveform` ist jetzt ein dünner Wrapper: liest den Pegel aus dem echten `AnalyserNode` (Fallback: `levels`-Array) und reicht ihn an `FluidWaveform` weiter.
- `WaveformPlayer` (Wiedergabe fertiger Aufnahmen) nutzt jetzt ebenfalls `FluidWaveform` statt der alten `div`-Balken. Die Wellenbewegung während der Wiedergabe ist eine **bewusste Sinus-Simulation** (zwei überlagerte, leicht verstimmte Sinusfrequenzen), **kein** echter `AnalyserNode` am `<audio>`-Element: Das hätte die Wiedergabe über `createMediaElementSource()` in den Web-Audio-Graphen umgeleitet – Stummschaltungsrisiko bei fehlendem `resume()`, nur eine Quelle pro Element über alle Re-Renders hinweg möglich, CORS-Abhängigkeit vom Storage-Bucket für echte Frequenzdaten. Für die Kernfunktion „Aufnahme anhören" zu riskant; die Aufgabenstellung erlaubte die Sinus-Simulation explizit als Alternative.
- Seek-Interaktion bleibt vollständig erhalten (`role="slider"`, Klick auf die Welle, Pfeiltasten ±5s, `Home`), nur die Balken-Darstellung wurde ersetzt; eine schmale Fortschritts-Leiste unter der Welle zeigt weiterhin, wie weit die Wiedergabe fortgeschritten ist.
- Performance: `FluidWaveform` animiert nur, während `isActive` true ist; im inaktiven Zustand (Pause, oder mehrere `WaveformPlayer` gleichzeitig in `SubmissionHistory`) wird ein einzelner ruhiger Frame gezeichnet statt einer Dauerschleife.
- Aufräumen: `extractPeaks`, `normalizePeaks`, `barHeightPercent`, `WAVEFORM_MIN_BAR_PERCENT` aus `lib/audio/waveform.ts` entfernt (toter Code nach dem Umstieg von Balken auf Canvas-Wellen); zugehörige Tests in `__tests__/waveform.test.ts` mitentfernt. `WAVEFORM_BAR_COUNT`/`appendLevel` bleiben (Fallback-Datenquelle `levels` in `useAudioRecorder`).

**2. Bugfix „grauer Balken" im Vokabeltrainer:**
- Ursache: In `LessonList.tsx` stand der Lern-Fortschrittsbalken in derselben Button-Reihe wie „Vokabeln anzeigen". Ohne grüne Füllung (0% gelernt, aber schon Karten „im Training") sah er wie ein eingefrorener Lade-Platzhalter direkt neben dem Button aus.
- Fix: Der Fortschrittsbalken (dünner, `h-2`, mit Prozent-Zahl daneben) steht jetzt unterhalb der Lektions-Kennzahlen im Textblock, komplett getrennt von der Button-Reihe.

**3. Vokabeltrainer-Redesign & No-Scroll-Viewport (Desktop `lg:`):** *(Layout-Ansatz am selben Tag durch 4f wieder aufgehoben, siehe unten – der `LessonCardsModal` bleibt bestehen.)*
- Die Lektions-Detailliste war ein Inline-Akkordeon, das die Übersichtsseite bei vielen Vokabeln beliebig lang zog. Ersetzt durch `components/vocabulary/LessonCardsModal.tsx`: ein zentriertes Overlay (`role="dialog"`, ESC schließt, Klick außerhalb schließt) mit fester Kopfzeile und einem intern scrollenden Listbereich. `LessonList.tsx` verwaltet nur noch, welche Lektion geöffnet ist (`openLesson`), keine verschachtelte Karten-Ladezustände mehr pro Zeile.
- Alle vier Trainer-Hauptansichten (`vocabulary`, `vocabulary/train`, `vocabulary/assess`, `pronunciation`, `exercises`, `videos`) hatten ab `lg:` das Muster `lg:h-[calc(100vh-5rem)] lg:overflow-hidden flex flex-col` erhalten. **Dieses Muster wurde am selben Tag (siehe 4f) wieder entfernt**, da es auf MacBook/Laptop-Displays Inhalte abschnitt und das Trackpad-Scrollen blockierte.
- Betroffene Dateien: `app/[lang]/dashboard/level/[level]/vocabulary/page.tsx`, `.../vocabulary/train/page.tsx`, `.../vocabulary/assess/page.tsx`, `.../pronunciation/page.tsx`, `.../exercises/page.tsx`, `.../videos/page.tsx`.

**4. Re-Branding „SmartGerman" → „Sitov Academy":**
- Alle 22 Fundstellen des Begriffs „SmartGerman" im Repository (Komponenten, i18n-Fallbacks/Dictionaries, Alt-Texte, `.cursor/rules/*.mdc`, `.cursorrules`, SQL-Migrationskommentare, `ARCHITECTURE.md`/`CURRENT_STATE.md`/`MONETIZATION.md`/`SITOV_LANGUAGE_ACADEMY_MASTER_GUIDELINE.md`, `.env.example`) wurden durch „Sitov Academy" ersetzt.
- Bewusst unverändert: `package.json`-Projektname (bereits `sitov-language-academy`), die Supabase-Projekt-ID `wcaslabeiwtvygxtzcio`, sowie der externe Telegram-Link `t.me/smartgerman_hannover` (realer Kanalname eines Drittanbieters, keine Textersetzung möglich ohne den Link zu brechen).

**Qualitätssicherung:** `npx tsc --noEmit` fehlerfrei, `npx jest` (446 Tests grün, ein vorbestehender, umgebungsabhängiger Integrationstest ohne `SUPABASE_SERVICE_ROLE_KEY` weiterhin rot), `next build` erfolgreich.

## 4f. Rücknahme des No-Scroll-Layouts, Trainer-Feinschliff & Textfix (2026-09-03)

**1. Rücknahme der starren Viewport-Sperre:**
- Nutzer-Feedback: Das `lg:h-[calc(100vh-5rem)] lg:overflow-hidden`-Muster aus 4e funktionierte auf MacBook/Laptop-Displays nicht zuverlässig – Inhalte wurden unten abgeschnitten, das Trackpad-/Mausrad-Scrollen reagierte inkonsistent.
- Fix: In allen sechs Trainer-Seiten (`vocabulary`, `vocabulary/train`, `vocabulary/assess`, `pronunciation`, `exercises`, `videos`) entfernt und durch flexible Container ersetzt (`min-h-screen w-full py-8`, kein `overflow-hidden` auf Container-Ebene). Die Seiten scrollen jetzt wieder ganz normal mit dem Browser/Trackpad, auf allen Bildschirmgrößen identisch.

**2. Karteikarten- & Aussprache-Trainer – Layout-Feinschliff:**
- `VocabTrainerClient.tsx`: Karte kompakter gestaltet (kleinere Innenabstände, kleineres Bild, engere Abstände zwischen Wort/Buttons), damit sie auf 13"/14"-Laptops möglichst komplett sichtbar ist. `vocabulary/train/page.tsx` zentriert die Karte jetzt über `flex flex-1 items-center justify-center` (mit `min-h-`, nicht `h-`) vertikal im sichtbaren Bereich – wächst der Inhalt doch über den Viewport hinaus, scrollt die Seite einfach natürlich statt abzuschneiden.
- `pronunciation/page.tsx`: Kopfbereich, Hero-Karte, Recorder und die Sektion „Deine bisherigen Einreichungen" sind jetzt ein einziger natürlich fließender Block (`space-y-10`); die Einreichungen stehen unter der Aufnahme-Box und scrollen mit der Seite.

**3. Textfix „Lektion Lektion 2":**
- Ursache: `vocabulary_cards.lesson`/`videos.lesson` werden von der Lehrkraft bereits als vollständiger String (`"Lektion 2"`) gepflegt. Die `lesson_label`-Übersetzung (`"Lektion {lesson}"` bzw. `"Lesson {lesson}"` etc.) fügte selbst noch ein Präfix hinzu → Dopplung.
- Fix: Neue Hilfsfunktion `stripLessonPrefix()` in `lib/utils.ts` entfernt ein führendes „Lektion" (case-insensitive) aus dem Rohwert, bevor er in die Übersetzung eingesetzt wird. Angewendet an allen 5 Stellen, die `t('lesson_label', …)` nutzen: `VocabTrainerClient.tsx`, `LessonAssessmentClient.tsx`, `videos/page.tsx` (×2), `videos/[id]/page.tsx`.

**4. Vokabeltrainer-Übersicht & Modal-Fix:**
- Leerer „0%"-Fortschrittsbalken entfernt: `LessonList.tsx` zeigt den Lernfortschrittsbalken jetzt erst, wenn `stat.learned > 0` ist (statt bei jedem `active > 0`) – kein leerer, unfertig wirkender Balken mehr direkt nach Übernahme einer Lektion.
- `LessonCardsModal.tsx`: Modal-Höhe auf `max-h-[80vh]` begrenzt (`flex flex-col` mit `shrink-0`-Kopfzeile), der Listenbereich hat jetzt explizit `flex-1 overflow-y-auto` statt einer festen `max-h-[400px]` – scrollt auf allen Bildschirmgrößen flüssig per Trackpad/Mausrad, ohne das Modal selbst zu sprengen.

**Qualitätssicherung:** `npx tsc --noEmit` fehlerfrei, `npx jest` (446 Tests grün, derselbe vorbestehende Integrationstest ohne `SUPABASE_SERVICE_ROLE_KEY` weiterhin rot), `next build` erfolgreich.

## 4g. Vokabel-Modal: Scroll-Fix, Tabs, eigene Vokabeln & Phasen-Diagramm (2026-09-03)

**Ursache des Scroll-Problems:** Der Dialog war bereits `flex flex-col` mit `max-h`, dem Body fehlte aber `min-h-0` (Flex-Kinder defaulten auf `min-height: auto` und lassen sich nicht unter die Inhaltsgröße stauchen). Zusätzlich fängt Lenis auf Desktop (`SmoothScroll.tsx`, `smoothWheel: true`) Wheel-Events ab – ohne `data-lenis-prevent` kommt die Geste nie im inneren Scrollbereich an.

**Layout:** Dialog `max-h-[calc(100vh-6rem)] flex flex-col overflow-hidden`. Header (Titel, Tabs, Schließen) `flex-shrink-0`. Body `flex-1 min-h-0 overflow-y-auto overscroll-contain` plus `.modal-scroll-region` (`-webkit-overflow-scrolling: touch`). Backdrop sperrt Body-Scroll (`overflow: hidden`) und schluckt Wheel-Events nur auf der Abdunklung selbst, nicht auf dem Dialog.

**Tabs:** „Wörterliste" und „Phasen-Verteilung" (`role="tablist"`), i18n in allen fünf Dictionaries.

**Eigene Vokabeln:** Button öffnet Inline-Formular (deutsches Wort + Übersetzung). Speicherung in `localStorage` über `lib/vocabulary-custom.ts` (Key `sitov_custom_vocab:{level}:{lesson}`), Start immer Phase 1. Führendes `der`/`die`/`das` wird für Artikelfarben geparst. Erscheinen sofort in Liste und Diagramm; bewusst **kein** Server-Write in `vocabulary_cards` / `user_vocabulary_progress` (kein Fälligkeits-Mechanismus, gerätegebunden).

**Phasen-Diagramm:** Tailwind-Balken für Phase 1–6 und „Gelernt", Anzahl über dem Balken, farbliche Phasenbezeichnung darunter (Amber → Grün), Gesamtfortschritt gewichtet (unberührt = 0, Phase n = n/7, gelernt = 7/7). `computePhaseDistribution` in `lib/vocabulary-ui.ts`, Tests in `__tests__/vocabulary-phases.test.ts` und `__tests__/vocabulary-custom.test.ts`.

**Qualitätssicherung:** `npx tsc --noEmit` fehlerfrei, neue Unit-Tests grün. Live-Klick im Browser nicht möglich (kein laufender Dev-Server, keine Browser-Tools in dieser Session).

## 4h. Globale UI-Fixes: Padding, keine Silbentrennung, Niveau-Farbcodierung (2026-09-06)

- **Keine automatische Silbentrennung mehr:** Die globale `p`-Regel in `app/globals.css` nutzte `text-justify hyphens-auto` und trennte Wörter an unnatürlichen Stellen (für die ältere Zielgruppe irritierend). Neu: `text-left` + `hyphens: none` (inkl. `-webkit-`/`-ms-`-Präfix) und `overflow-wrap: break-word`. Blocksatz entfernt, damit ohne Silbentrennung keine hässlichen Wortlücken (Rivers) entstehen. Keine weiteren `hyphens-auto`/`text-justify`-Vorkommen im Projekt.
- **Mehr Padding auf Hinweis-/Card-Containern:** Der Empty-State „Für dieses Sprachniveau gibt es noch keine Lernsets…" (`app/[lang]/dashboard/level/[level]/vocabulary/page.tsx`) hatte nur vertikales `py-12` ohne Seitenabstand – Text klebte am Rand. Jetzt `p-8 sm:p-12` (+ `break-words`). Äußerer Übersichts-Container von `p-5` auf `p-6 sm:p-10` erhöht. Trainer-Kartenflächen (`VocabTrainerClient.tsx`) von `p-5` auf `p-6` (Vorder-/Rückseite, Aufdeck-Bereich, Feedback-Box).
- **Niveau-Farbcodierung statt Abdunklung:** Bisher wurden die Icon-Verläufe der Niveaus (`app/[lang]/dashboard/page.tsx`) mit steigendem Level immer dunkler (`#FF5C00` → `#993500`), was wie ein deaktivierter/ausgegrauter Zustand wirkte. Neu: Helper `levelVisual(levelId)` in `lib/vocabulary-ui.ts` liefert pro CEFR-Stufe eine eigene Farbwelt (A1 Smaragd/Türkis, A2 Himmelblau, B1 Marken-Orange, B2 Rosé/Pink, C1 Violett, C2 Gold) mit `gradient`/`bar`/`soft`/`text`-Klassen inkl. Dark-Mode. Die Riesen-Hintergrundzahl wurde durch ein klar lesbares, farbcodiertes Niveau-Badge ersetzt.
- **Tailwind-Content erweitert:** `tailwind.config.ts` scannt nun auch `./lib/**`, damit die statischen Farbklassen aus `levelVisual`/`phaseBarClasses` zuverlässig generiert werden.
- **Qualitätssicherung:** `npx tsc --noEmit` fehlerfrei. Kein `any`, keine neuen Server Actions/DB-Änderungen.

## 4i. Vokabeltrainer: Sofortiger Kartenwechsel & Tinder-Pre-Rendering (2026-09-06)

- **Feedback-Meldungen entfernt:** Nach „Wusste ich" / „Wusste ich nicht" erscheint keine Bestätigungsmeldung mehr (früher „Weiter in Phase X. Wiederholung schon morgen." + separater „Nächste Karte"-Button). Der Wechsel erfolgt sofort. `AnswerFeedback`-State, `handleNext` und der Zwischen-Button wurden aus `VocabTrainerClient.tsx` entfernt.
- **Fire-and-forget-Speicherung:** `submitVocabularyAnswer` läuft im Hintergrund; der Kartenwechsel wartet bewusst nicht auf die Server-Antwort. Schlägt das Speichern fehl, erscheint weiterhin der dezente, nicht-blockierende `save_failed`-Hinweis (Graceful Degradation).
- **Tinder-Pre-Rendering:** Aktuelle Karte (Index `i`) und Folgekarte (`i+1`) liegen per CSS-Grid (`[grid-area:1/1]`) übereinander im DOM. Die Folgekarte ist inkl. Bild fertig gerendert; zusätzlich werden die Bilder von `i+1` und `i+2` per `new Image()` vorgeladen. Beim Antworten fliegt die aktive Karte weich zur Seite (rechts = gewusst, links = nicht gewusst; `translate`+`rotate`+`opacity`, 260 ms), die dahinterliegende Karte wird ohne Ladezeit sofort aktiv. `motion-reduce:transition-none` respektiert Bewegungsreduktion.
- **Qualitätssicherung:** `npx tsc --noEmit` fehlerfrei, keine Lint-Fehler, kein `any`, keine DB-/Server-Action-Änderungen.

## 4j. Vokabeltrainer: „Lernkasten"-System zur Lektionsauswahl (2026-09-06)

- **Problem:** „Vokabeln lernen" startete pauschal alle fälligen Vokabeln des Sprachniveaus.
- **Lernkasten (Selection-Box):** Der Trainer (`vocabulary/train`) zeigt jetzt zuerst eine Zusammenstellungsansicht. Oben eine interaktive Selection-Box („Dein Lernkasten"), darunter die Übersicht aller Lektionen des Niveaus. Lektionen werden per Klick **oder** Drag & Drop (HTML5-DnD, MIME `application/x-sitov-lesson` + `text/plain`-Fallback) in den Lernkasten gelegt/entfernt. Nur die fälligen Vokabeln der Lektionen im Lernkasten fließen in die aktive Lerneinheit.
- **Dynamische Anzeige:** „{lessons} Lektionen ausgewählt – {cards} Vokabeln"; die Zahl `cards` = Anzahl der heute fälligen Karten in der Auswahl (das, was tatsächlich in die Session fließt). Pro Lektion: „{due} fällig · {total} Vokabeln". Lektionen ohne fällige Karten sind sichtbar, aber nicht wählbar (Badge „nichts fällig").
- **Persistenz:** Auswahl je Niveau im `localStorage` (`sitov_lernkasten:{level}`) über neuen Helfer `lib/vocabulary-lernkasten.ts` (`load`/`save`, `null` = Erstbesuch). Erstbesuch-Standard: alle fälligen Lektionen ausgewählt (bisheriges „alles lernen"-Verhalten, jetzt bearbeitbar). Deterministische Initialisierung → keine Hydration-Mismatches; Persistenz erst nach dem Mount.
- **Refactor:** Die Kartensession (Tinder-Flow) wurde nach `VocabCardSession.tsx` ausgelagert; `VocabTrainerClient.tsx` ist jetzt Orchestrator (Phasen `compose`/`train`) + Lernkasten-Composer. `train/page.tsx` lädt zusätzlich `getLessonStats(level)` parallel zu `getDueCards(level)`.

## 4k. Vokabeltrainer: Tinder-Animation entschlackt – nur noch Fly-Out (2026-09-06)

- **Problem:** Beim Antworten flog die obere Karte raus, aber die nachrückende Karte führte zusätzlich eine eigene Einflieg-Bewegung aus (unruhig/redundant). Ursache: Der DOM-Knoten der oberen Karte wurde über den Index-Wechsel hinweg wiederverwendet und transitionierte via `transition-all` aus der Fly-Out-Position zurück.
- **Lösung:** Beide Kartenslots in `VocabCardSession.tsx` sind jetzt per `key={progressId}` gebunden → beim Kartenwechsel mountet React einen frischen Knoten (kein „Zurückfliegen"). Erhalten bleibt ausschließlich die Fly-Out-Animation der aktiven Karte (`translate`+`rotate`+`opacity`, 260 ms).
- **Dezenter Stapel-Effekt ohne Richtungsverschiebung:** Die Hintergrundkarte nutzt nur noch `scale-[0.95]`/`opacity-90` → beim Wegfliegen der oberen Karte weich auf `scale-100`/`opacity-100`; jegliches `translateX/translateY` beim Nachrücken wurde entfernt. `motion-reduce:transition-none` bleibt erhalten.
- **Qualitätssicherung:** keine Lint-Fehler, kein `any`, keine DB-/Server-Action-Änderungen.
- **i18n:** 18 neue `lernkasten_*`-Keys in Fallbacks (`lib/vocabulary-i18n.ts`) und allen fünf Dictionaries (`de/en/ru/uk/tr`). Übersetzungs-Integritätstest grün.
- **Qualitätssicherung:** `npx tsc --noEmit` fehlerfrei, keine Lint-Fehler, kein `any`, keine DB-/Server-Action-Änderungen.

## 4k. Audio-Wiedergabe: Player-Robustheit & deutsche TTS (2026-09-06)

- **Sprachnachrichten-Player (`WaveformPlayer.tsx`):**
  - **Sichtbares Error-Handling:** Statt stiller Fehlschläge jetzt eine `role="alert"`-Box mit klarer Meldung. Zwei Fehlerarten: `format` (Browser kann das Format grundsätzlich nicht) und `load` (Netzwerk/404/CORS) – letztere mit „Erneut versuchen"-Button (`audio.load()` + `play()`).
  - **Format-Vorprüfung:** Vor dem Abspielen prüft `audio.canPlayType(guessAudioMimeType(src))` das Format. Ursache für „man hört nichts": Aufnahmen werden vom Recorder bevorzugt als `audio/webm` erzeugt (Chrome/Firefox), das **Safari/iOS nicht abspielen kann** → bisher stumm, jetzt klarer Hinweis „Dieses Audioformat kann dein Browser nicht abspielen …".
  - **Ladezustand:** Neuer Buffering-Status (Spinner am Play-Button + „Audio wird geladen …") über `onWaiting`/`onPlaying`/`onCanPlay`, `aria-busy`.
  - **webm-Dauer-Fix:** `MediaRecorder`-webm liefert teils `duration = Infinity`; Workaround (einmaliges Seek ans Ende via `onLoadedMetadata`/`onDurationChange`) ermittelt die reale Dauer für Seek-Leiste und Fortschritt.
  - **State-Reset bei Quellenwechsel:** Beim `src`-Wechsel werden Fehler/Zeit/Status zurückgesetzt.
  - **CORS-Hinweis:** Reine `<audio src>`-Wiedergabe braucht kein CORS; der Bucket `audio_submissions` ist `public=true`. Es wird bewusst kein `AnalyserNode`/`createMediaElementSource` verwendet (Stummschaltungs-/CORS-Risiko), die Welle ist eine Sinus-Simulation.
- **Deutsche Sprachausgabe (TTS):** Neuer zentraler Helfer `lib/audio/speech.ts` – von `SolutionAudioButton` (Vokabeltrainer + Grammatik-/Lückentext-Übungen) genutzt.
  - **Explizite Voice:** `pickGermanVoice` wählt bevorzugt eine lokale `de-DE`-Stimme, sonst irgendeine `de-*`; `utterance.lang = 'de-DE'` als Fallback, damit der Browser selbst eine deutsche Standardstimme nimmt.
  - **Mobile-Fallback:** `getVoices()` ist mobil beim ersten Aufruf oft leer; `primeGermanSpeech()` cached die Stimmen und lauscht auf `voiceschanged`. Wird beim Mounten aufgerufen.
  - **Autoplay-/Gesten-sicher:** `speakGerman()` läuft synchron im Klick-Handler (kein `await`), ruft nach `cancel()` bei Bedarf `resume()` (iOS/Safari) – der erste Klick wird nicht blockiert.
- **i18n:** Neue Keys `audio_loading`, `audio_retry`, `audio_format_unsupported` in `pronunciation`-Fallbacks und allen fünf Dictionaries. Integritätstest grün.
- **Qualitätssicherung:** `npx tsc --noEmit` fehlerfrei, keine Lint-Fehler, Übersetzungs- und Waveform-Tests grün; kein `any`, keine DB-/Server-Action-Änderungen.
- **Offen (bewusst außerhalb dieses Scopes):** Cross-Browser gilt endgültig erst mit serverseitiger Transkodierung von webm nach mp4/mp3 (z.B. Edge Function) – dann können iOS-Nutzer auch am Desktop (Chrome) aufgenommene Lehrer-Sprachnachrichten hören. Aktuell wird stattdessen ein verständlicher Hinweis angezeigt.

## 5. Hosting
- Die Lernplattform läuft auf **Netlify** (`netlify.toml`, `@netlify/plugin-nextjs`). `NEXT_PUBLIC_SITE_URL` ist dort auf `https://www.sitov-academy.com` gesetzt. Derselbe Satz gilt für Vercel Production (Dashboard → Environment Variables).
- Caching muss für Server Components (z.B. Kurslisten) korrekt eingestellt werden, um Ladezeiten zu minimieren.

### Checkliste: Umgebungsvariablen für den Live-Betrieb (Vercel / Netlify)

Pflicht für Anmeldung, Registrierung und E-Mail-Bestätigung:

| Variable | Wert (Produktion) | Wo |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://www.sitov-academy.com` | Vercel Production **und** Preview; ohne diesen Wert entstehen localhost-Links in Auth-Mails |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wcaslabeiwtvygxtzcio.supabase.co` | öffentlich, Browser-Client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon/Publishable Key aus Supabase → Settings → API | öffentlich, Browser-Client |

Aliase, die der Code ebenfalls akzeptiert (falls im Dashboard so benannt): `SUPABASE_URL`, `SUPABASE_ANON_KEY`. Der `NEXT_PUBLIC_`-Name hat Vorrang.

Zusätzlich serverseitig (nicht `NEXT_PUBLIC_`, nie ins Git):

| Variable | Zweck |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Admin-Client, Stripe-Webhook |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` | Zahlungen |
| `SMTP_*` / `UPSTASH_*` | Lehrer-Mails, Ratenbegrenzung |

In Supabase Authentication → URL Configuration müssen Site URL und Redirect-Allowlist auf `https://www.sitov-academy.com` zeigen (`/auth/confirm` und `/auth/callback` einschließen).
