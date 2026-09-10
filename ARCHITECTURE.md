# Architecture Masterplan

## Ergänzung 2026-09-10: natives Sticky-Layout und vorbereitete Audio-Wiedergabe

- `EnrollmentTerminal.tsx` legt die linke Formularspalte und rechte Belegspalte in ein start-ausgerichtetes CSS-Grid. Sticky-Position und oberer Abstand gehören ausschließlich CSS; `SmoothScroll.tsx` nimmt Registrierungsrouten von Lenis aus. Der mobile Sprung zur Zusammenfassung verwendet einen separaten, nur mobil aktiven Observer.
- `Header.tsx` teilt Hilfsfunktionen und Handlungsbuttons in eigene Flexgruppen. `AcademyFooter.tsx` verwendet `Footer.Addresses.classroom` und `Footer.Addresses.school` aus allen fünf Dictionaries; Kontakt und beide Adressen sind eigene Grid-Bereiche.
- `lib/audio/neural-client.ts` kapselt geteilte URL-Auflösung, In-flight-Deduplizierung, einen auf 256 Einträge begrenzten URL-Cache, zwei gleichzeitige Prefetch-Jobs und vier vorgeladene HTMLAudio-Quellen. `VocabCardSession` plant nur die aktuelle/nächste Wortkarte, entfernt veraltete Warteschlangeneinträge und spielt beim Vorladen nichts ab.
- `SolutionAudioButton` verwaltet ein natives Audioelement pro Quellenidentität sowie globale Wiedergabezuordnung und Request-IDs. Bei fehlender URL startet im Klick synchron ein kurzer stiller PCM-Clip auf demselben Element; nach Auflösung und Freigabe wird zur Neural-MP3 gewechselt. Native Events steuern Wiedergabe-/Ladezustand. Der ausdrücklich blockierte Autoplay-Fall behält native Controls als Fallback. Provider, MP3-Qualität, serverseitige Berechtigungsprüfung und persistenter Audio-Cache bleiben erhalten.

## Ergänzung 2026-09-10: organisches NeuralBrain-Gewebe

- `components/effects/neural-brain-geometry.ts` erzeugt einmalig 6.400 deterministisch verteilte Neuronen mit domain-verzerrtem Perlin-Rauschen, dicker Kortikalschicht, inneren Clustern, asymmetrischen Hirnlappen und zentraler Furche. Spatial Hashing begrenzt den Nachbarschaftsgraphen auf 20.193 Verbindungen; gekrümmte Fasern und 16 Graph-Routen werden als Buffer-Geometrien vorbereitet.
- `neural-brain-shaders.ts` enthält separate Knoten-, Faser- und Comet-Materialien. Impulse sind durchgehende, zur Kamera ausgerichtete Dreiecksbänder mit integriertem Glühkopf, schmalem Lichtkern und weich transparentem Schweif. Die statischen Pfade und Bänder teilen dieselbe minimale Verformung.
- `NeuralBrain.tsx` steuert drei wiederverwendete Impuls-Meshes zentral: 1–3 Impulse alle 6,5–9 Sekunden, maximal 3,05 Sekunden Gruppenlaufzeit und mindestens 3,45 Sekunden Ruhe. Keine unabhängigen Kantenblitze oder wandernden Signal-Sprites. Zwei Drawcalls im Ruhezustand, höchstens fünf während einer Gruppe; keine laufenden Buffer-Neuallokationen.
- Farbpaletten und Blending wechseln mit `html.dark`; DPR ist auf 1,5 begrenzt. Unsichtbare Szenen pausieren. Reduzierte Bewegung nutzt das detaillierte 3D-Modell im Demand-Loop ohne Impulse/Rotation; Theme- und Größenänderungen zeichnen es neu. WebGL-Ausfälle zeigen das SVG-Fallback mit instanzeigenem Gradient-Identifier. Alle eigenen GPU-Ressourcen werden freigegeben.

## Ergänzung 2026-09-10: stille Writes und Neural-MP3

`lib/vocabulary-write-queue.ts` serialisiert optimistische Entscheidungen. Ein stabiler Request-Beleg in `vocabulary_private.answer_receipts` verhindert erneute Bewertung nach verlorener HTTP-Antwort. `expectedLearnerId` bindet gepufferte Aufrufe an den beim Mount authentifizierten Schüler. PostgreSQL bewertet Sätze weiterhin exakt; `lib/vocabulary-languages.ts` wählt eine ausschließlich fremdsprachige Quelle.

`SolutionAudioButton` besitzt ein natives HTMLAudioElement pro Text/Karte. Es lädt sichtbare Kopfwortaudios vor, dedupliziert laufende Anfragen und pausiert vorherige Player. `generateAudio` → Auth/Level/Input/Rateprüfung → `neural-cache` → begrenzter `edge-tts`-WebSocket-Adapter → immutable `audio_cache`. Service Role bleibt serverseitig. Stimmen/Format/Tempo fließen in den SHA-256-Dateinamen ein; Übersetzungen überschreiben nie die kanonische deutsche `vocabulary_cards.audio_url`. Keine Browser-Sprachausgabe und kein Python-Subprozess.

`THEME_BOOTSTRAP_SCRIPT` setzt die Academy-Themevariablen vor Paint. `RouteFeedbackProvider` liefert lokalisierte Boundary- und Audio-Texte; Skeletons, Karten und Overlays beziehen dieselben Surface-/Border-/Text-Tokens.


> **Aktueller Stand (2026-09-10):** Die folgenden Änderungen ersetzen ältere Einstufungs-, Layout- und Buchungstabellen-Beschreibungen. Gemeinsame Marken-Komponenten (`BrandLogo`, Header, `Academy*`) und Farbvariablen verbinden Marketing und Lernbereich; Admin bleibt eine kompakte Arbeitsoberfläche. Next.js 16 läuft mit kompatiblem React 19 / React Three Fiber 9.

### Darstellungsarchitektur: Feinschliff am 10. September 2026

`HeroBrain.module.css` trennt Canvas und Beschriftungen in echte Layoutzeilen. `NeuralBrain` erzeugt Knoten-, Kanten- und Signal-Geometrie einmalig; die drei Shader teilen Animationszeit und Signalbahn. Pro Frame werden Uniforms aktualisiert. WebGL-/Reduced-Motion-Fallback und Sichtbarkeit bleiben vom eigentlichen Lernzustand unabhängig.

`FluidWaveform` verwendet dieselben abgetasteten Punkte für Konturen und geschlossene Füllfläche. Der vorhandene RAF-Loop steuert die langsame Deckkraftvariation; `isActive` und die Bewegungspräferenz stoppen sie. `WaveformPlayer` und die Web-Audio-Integration ändern sich nicht.

`EnrollmentTerminal` behält seine Formular-/Kurszustände und Server-Action-Grenzen. Die Gestaltung liegt in `components/registration/registration.css` mit Academy-Tokens; `PricingRoadmap` enthält weiterhin dieselbe Kostenberechnung. `PremiumDatePicker.locale` betrifft ausschließlich Kalenderbeschriftungen. Neue Texte stehen unter `registration` und `academy` in allen fünf Dictionaries. `Header` verlinkt direkt auf `/{lang}/registration`; `AcademyStory` verwendet das vorhandene Porträt ohne Zoom und einen austauschbaren Telegram-Link.

### Lernarchitektur ab 10. September 2026

`LessonAssessmentClient` sendet Einzelentscheidungen an `submitLessonAssessment`; die DB-RPC initialisiert zwei unabhängige Richtungen in Phase 6 bzw. Phase 1. `skipVocabularyAssessment` initialisiert die numerisch erste vorhandene Lektion und persistiert `vocabulary_onboarding`. Die Assessment-Seite übergibt ausschließlich ID, Lernwort und Artikel an den Client.

`getVocabularySession` lädt paginierte fällige `vocabulary_direction_progress` samt `vocabulary_learning_state.last_card_id`. `lib/vocabulary-scheduler.ts` erzwingt Wortabstand. Nach Lektionsauswahl plant der Client erneut mit demselben Cursor. `LearningScreen` stellt eine fokussierte 100dvh-Ansicht für Assessment und `VocabCardSession` bereit. Wort-Selbsteinschätzungen sind optimistisch; Schreibübungen vergleichen in PostgreSQL exakt den eingegebenen deutschen Satz. Der Client erhält die Satzlösung erst mit dem Ergebnis. Ein Wort zählt erst nach Abschluss beider Richtungen als gelernt.

`vocabulary_direction_progress`, `vocabulary_learning_state` und `vocabulary_onboarding` erlauben unter RLS ausschließlich eigenen Lesezugriff. Schreiboperationen laufen über öffentliche Invoker-RPCs und private Funktionen mit `auth.uid()`-/Niveau-/Rollenprüfung. Einseitiges Legacy-Mirroring erhält den bisher ausgelieferten Trainer während des Rollouts. Das ursprüngliche `user_vocabulary_progress` bleibt bestehen. Inhaltsfelder und Ablaufdetails: `docs/vocabulary-learning-backend.md`; verifizierter Live-Stand: `docs/supabase-deployment-2026-09-10.md`.

`NextMonthBookings` erhält den vorhandenen rollenvalidierten Server-Überblick und verwendet `lib/admin-booking-grid.ts` für Deduplizierung, Mehrfachfilter und stabile mehrstufige Sortierung. Das Schwarze Brett behält optimistische Auto-Saves. `VocabCMS` trennt Eingabe-UI, validierte CMS-Actions und `lib/admin-vocabulary.ts`; eine Satzfreigabe erfordert vollständige Kontexte in allen fünf Sprachen.

> **Admin-Header (2026-09-09):** Lehrer-Header zweizeilig (Werkzeuge oben, Navigation darunter). Sprachumschalter `HeaderLanguageSwitcher` schreibt `ui_language` und bleibt auf der Admin-Route. Texte: `admin.ui_language_aria`.

> **Admin-Abrechnung (2026-09-09):** `/{lang}/admin/bookings` gruppiert Folgemonat-Buchungen nach `courses.booking_id`. Staff liest Buchungen nach Rollenprüfung über den Service-Role-Client (RLS bleibt für den Cookie-Client: nur Eigentümer/Admin). Schwarzes Brett: `saveBlackboardNote` → `teacher_student_notes`, Auto-Save in `BlackboardProvider`. Texte: `dictionaries/*.json` → `admin` / `lib/admin-i18n.ts`.

> **Preloader (2026-09-09):** Cinematic first-load curtain in `components/effects/Preloader.tsx`. html/body/`AppBackground`/Dashboard teilen `--canvas` (`#FCF4E6` / `#050505`), der Hero startet während des Wipes, der Vorhang blendet danach aus. Light/Dark folgt `html.dark`; Unterlängen bleiben sichtbar.

> **Vokabeltrainer (2026-09-09):** Ersteinstufung zeigt wie die Lernbox zuerst die Übersetzung, dann „Lösung aufdecken“, danach Lernkasten (Phase 1) oder direkt Phase 6. Fällige Karten werden in `getDueCards` gewichtet zufällig gereiht (`PHASE_SELECTION_WEIGHTS` in `lib/leitner.ts`). `VocabCardSession` hält eine feste Kartenhöhe, damit der Wechsel keinen Layout-Shift erzeugt. Vokabelwörter ohne `line-clamp` (Unterlängen sichtbar). Lektionskarten: Aktionen untereinander in einer rechten Spalte. Profil-Folgemonat: kompakte Kurskarten im zweispaltigen Raster. Details siehe `CURRENT_STATE.md`.

> **UI-Struktur-Notiz (2026-09-06):** Der globale App-Hintergrund (`components/effects/AppBackground.tsx`) ist dieselbe Leinwand wie der Preloader (`--canvas`: Sand `#FCF4E6` / `#050505`) plus Orange-Glow und Papier-Rauschen. Der Vokabeltrainer-Lernmodus rendert Navigation & Layout ausschließlich clientseitig (`VocabTrainerPageClient` → `VocabCardSession`): kompakte 100dvh-Ansicht mit zusammengeführtem Zurück-Pfeil und einzeiliger Meta-Info. Details siehe `CURRENT_STATE.md`.

## 1. Datenmodellierung (Datenbankschema)

**Supabase-Projekt:** `wcaslabeiwtvygxtzcio` (Sitov Academy v2) — Live-Datenbank, produktiv im Einsatz.

**Schema-Referenz:** `supabase/schema.sql` (Tabellen, Funktionen, Trigger, RLS-Policies, Indizes)  
**TypeScript-Types:** `supabase/database.types.ts` (automatisch generiert via Supabase MCP/CLI)

Das Supabase-Schema muss für eine klare Trennung von Identität (`auth.users`), Profil-Daten und Geschäftslogik sorgen.

### Kern-Entitäten
- **Profiles (`profiles`)**: Erweiterung von `auth.users`.
  - `role`: `student` | `teacher` | `admin` (für RBAC)
  - `allowed_levels` (`text[]`, `NOT NULL DEFAULT '{}'`): **Zugriffssteuerung pro Sprachniveau** (feingranular, z. B. `A1.1`, `A1.2`). Leeres Array = kein Zugriff. Admin/Teacher haben rollenbasiert Vollzugriff (siehe `lib/access/levels.ts`). Migration: `add_allowed_levels_to_profiles` (2026-09-06). Dies ist das aktive Rechtemodell und hat das Free/Premium-Gating abgelöst.
  - `subscription_status`: `kostenlos` | `aktiv` — **legacy**, bleibt für Stripe-Webhook-Kompatibilität erhalten, steuert aber **keinen** Inhaltszugriff mehr.
  - `stripe_customer_id`, `stripe_subscription_id` (legacy/Stripe)
  - `native_language` (text, CHECK): Erstsprache/Muttersprache, ausgewählt bei der Registrierung. Erlaubte Werte: `Deutsch, Englisch, Russisch, Türkisch, Ukrainisch` (+ Legacy `Andere`). Dient als Grundlage für die Start-Oberflächensprache und für sprachspezifische Lern-Hinweise.
  - `ui_language` (text, `NOT NULL DEFAULT 'de'`, CHECK `de|en|uk|ru|tr`): **persistente Oberflächensprache** (Locale-Code). Wird bei der Registrierung vom Trigger `handle_new_user` aus `native_language` abgeleitet und ist im Profil jederzeit manuell änderbar (`app/actions/profile.ts` → `updateUiLanguage`). Nach dem Login leitet `app/actions/auth.ts` auf `/{ui_language}/dashboard`, sodass die gesamte UI automatisch in der Nutzersprache erscheint. Migration: `add_ui_language_and_expand_native_language` (2026-09-06). Mapping Erstsprache→Locale zentral in `lib/locale-routing.ts` (`localeFromNativeLanguage`), konsistent mit dem DB-Trigger.

  **Zugriffskontrolle (Access Control):**
  - Kernlogik in `lib/access/levels.ts` (`ACCESS_LEVELS`, `hasLevelAccess`, `sanitizeAllowedLevels`), server-seitige Helfer in `lib/access/server.ts` (`loadLevelAccessProfile`, `currentUserHasLevelAccess`).
  - **Route-Guard:** `app/[lang]/dashboard/level/[level]/layout.tsx` prüft den Zugriff und rendert bei fehlender Freigabe `components/dashboard/LevelLocked.tsx` statt der Kindrouten (Videos, Vokabeln, Übungen, Aussprache).
  - **Defense-in-Depth:** Level-bezogene Server Actions (`app/actions/vocabulary.ts`, `app/actions/exercises.ts`) prüfen den Zugriff zusätzlich, falls sie ohne Layout-Guard aufgerufen werden.
  - **Admin-Freigabe:** `updateStudentAllowedLevels` (`app/actions/admin.ts`) + Checkbox-UI in `components/admin/StudentList.tsx`.
- **Courses (`courses`) & Lektionen (`lessons`)**: 
  - Kurse (A1.1 bis C2) mit Typ (`presence` | `online`), Preis, Instructor.
  - *Zusätzlich benötigt*: Eine hierarchische `lessons`-Tabelle (gehört zu Kurs), um Videos, Vokabeln und Übungen sauber zu bündeln.
- **Content-Entitäten**:
  - `videos`: URL, Lektions-Zugehörigkeit, Titel.
  - `vocabulary_cards`: Wort, Artikel, Plural, Übersetzungen (`translation_ru` / `_tr` / `_en`), Audio, Bild. Lernsets sind der Text in `lesson` plus `level`. A1.1 live: **Lektion 1** (84 Karten), **Lektion 2** (85 Karten), **Lektion 3** (76 Karten). Seed: `supabase/seeds/a11_*.sql`. Migration: `supabase/migrations/move_einkauf_vocab_to_a11_lektion_3.sql`.
  - `pronunciation_prompts`: Übungssätze des Aussprache-Trainers, nach CEFR-Familie (`A1`–`C2`). Felder: `sentence_de`, `focus`, optionale `audio_url`. Live-Bestand plus Seed `supabase/seeds/pronunciation_prompts.sql` (A1/A2 je 20, B1 19, B2/C1/C2 je 10). Zusätzlich garantiert der Code-Katalog `lib/pronunciation-catalog.ts` eigene Sätze für jedes Dashboard-Niveau (`A1.1`–`B1.2`) und jede Familie A1–C2. `getPronunciationPrompts` mappt das Routen-Niveau, prüft die Freigabe und mergt Katalog + DB (DB liefert IDs/`audio_url`). Migration: `add_pronunciation_prompts` (2026-09-06).
  - `exercises`: Typ (`fill_in_blank`, `multiple_choice`, `sentence_building`), Content als JSONB, `solution_audio_url` für Tap-to-Listen.
    - `content` bei `fill_in_blank`: `{ text_before, text_after, correct_answer, options?, smart_hint? }`.
      `options` sind die Auswahl-Chips; fehlen sie, werden sie serverseitig aus der Wortfamilie generiert.
- **Progress & User Data**:
  - `user_vocabulary_progress`: Phase-6-Leitner (`box_number` 1–6 = aktive Lernphasen, 7 = dauerhaft gelernt), `next_review_date`, `lapses` (Anzahl der Rückstufungen), `last_answered_at`.
    - Ruhezeiten je Phase: 1, 1, 3, 9, 29, 90 Tage; für kontrastiv schwere Vokabeln halbiert (min. 1 Tag).
    - Die Phasenlogik liegt ausschließlich in `lib/leitner.ts` als reine Funktionen – Server Actions und UI enthalten keine Intervall-Arithmetik.
    - Session-Reihenfolge: `getDueCards` zieht alle fälligen Karten (`box_number < 7` und `next_review_date <= now`) und sortiert sie per Weighted-Random (`PHASE_SELECTION_WEIGHTS`: 1.0 / 0.7 / 0.4 / 0.2 / 0.1 / 0.05).
    - Index `idx_user_vocabulary_progress_due` auf `(user_id, next_review_date, box_number)` für die Abfrage der fälligen Karten.
    - **Übernahme-Wege in den Karteikasten:** (1) automatisch beim Sofort-Start einer ganzen Lektion (`initializeLesson`, legacy), (2) manuell je Einzelvokabel über `addCardsToTrainer(cardIds)` (Start immer Phase 1), (3) über den „Vokabeln einstufen"-Durchlauf `submitLessonAssessment(decisions)` – die UI zeigt zuerst die Übersetzung und nach „Lösung aufdecken" das deutsche Wort; bekannt → Phase 6, unbekannt → Phase 1 und sofort fällig. Nach unbekannter Einstufung startet die Lernsession ohne Umweg. Alle drei Wege überspringen Karten mit bereits bestehendem Lernstand (kein Überschreiben von Fortschritt).
    - `getLessonCards(lesson, level)` liefert alle Vokabeln einer Lektion inklusive persönlichem Lernstand (`phase: null` = noch nicht übernommen) für die Lektions-Detailansicht. `components/vocabulary/LessonList.tsx` zeigt je Lektion nur noch Kennzahlen + Buttons; die eigentliche Vokabelliste öffnet als `components/vocabulary/LessonCardsModal.tsx` (Overlay, `max-h-[400px] overflow-y-auto`) statt als Inline-Akkordeon – ein aufklappender Bereich hätte die Übersichtsseite bei vielen Vokabeln endlos lang gezogen und das No-Scroll-Viewport-Layout (Punkt 4) verhindert.
  - `user_exercise_progress`: Score (0–100, gestaffelt nach Versuchen), Completed-Status, `attempts`, `hint_shown`.
  - `submissions` & `teacher_feedback`: Audio/Text-Einsendungen von Studenten, verknüpft mit Lehrer-Feedback (Audio/Text).
    - `submissions.parent_id` / `attempt_number` bilden die Kette aus erstem Versuch und Wiedervorlage.
    - `teacher_feedback.seen_at`: NULL = der Schüler hat die Rückmeldung noch nicht geöffnet. Speist die Dashboard-Karte „Du hast eine neue Sprachnachricht erhalten".
    - Gesetzt wird `seen_at` ausschließlich über die SECURITY-DEFINER-Funktion `mark_feedback_seen(uuid)`. Der Schüler erhält bewusst keine UPDATE-Policy auf `teacher_feedback`, damit der Feedback-Text für ihn unveränderlich bleibt.
    - Die Funktion läuft mit `search_path = ''` (alle Objekte vollqualifiziert) und `EXECUTE` liegt nur bei `authenticated`; `anon` ist explizit entzogen, damit der RPC-Endpunkt nicht ohne Anmeldung erreichbar ist.
- **Audio-Pipeline**:
  - Gemeinsamer Context: `lib/audio/web-audio.ts` – genau ein `AudioContext` (nie `close()`), `resume()` noch in der Nutzer-Geste, Safari/iOS nimmt `audio/mp4` auf.
  - Aufnahme: `lib/audio/useAudioRecorder.ts` – vor `getUserMedia` steht die Session auf `play-and-record` (nicht `playback`, das blockiert das Mikrofon auf iOS). Constraints mit Fallback auf `{ audio: true }`.
  - Wiedergabe: `lib/audio/useAudioPlayback.ts` spielt **nur** über natives `<audio playsInline>`. Dekodierte Aufnahmen werden nach WAV gewandelt (`lib/audio/wav.ts`), weil MediaRecorder-MP4 auf iOS oft stumm bleibt. `navigator.audioSession.type = 'playback'` (iOS 16.4+) hält den Silent-Switch fern. **Kein** `createMediaElementSource` und **kein** `AudioBufferSourceNode` als Lautsprecher-Pfad.
  - Darstellung: `FluidWaveform` nur Siri-Sinus (Lautstärke = Amplitude, Stimmlage = Dichte). Live aus dem Mikrofon-Analyser, Wiedergabe aus PCM-Fenster der dekodierten Datei.
    - `LiveWaveform`: Mikrofon-Analyser via `useAnalyserFrame`.
    - `WaveformPlayer`: derselbe Analyser-Pfad während der Buffer-Wiedergabe; Seek (Klick, Pfeiltasten, `role="slider"`) bleibt erhalten.
    - `FluidWaveform` animiert nur, während `isActive` true ist.
  - Upload: `lib/audio/upload.ts`, Bucket `audio_submissions`. Pfade `{userId}-{timestamp}` (Schüler) und `feedback/{submissionId}_{timestamp}` (Lehrkraft) – von den Storage-Policies abhängig, daher nicht ändern. `contentType` wird über `baseMimeType()` auf den reinen Basistyp (`audio/webm` / `audio/mp4`, ohne `;codecs=...`) reduziert, bevor er an Storage gesendet wird; `upload()` läuft mit `upsert: true`. Storage-Fehler (Bucket/Pfad/MIME/Statuscode) und Netzwerkfehler werden vollständig über `console.error` geloggt (nie nur eine generische Meldung). RLS: `supabase/migrations/fix_audio_submissions_storage_policies.sql` (idempotent, INSERT/UPDATE für `authenticated`, SELECT für `public`).
  - Browser-Client: `utils/supabase/client.ts` liest `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` bewusst **direkt und literal** aus `process.env` (nicht über `lib/supabase-env.ts`), da Next.js diese Variablen nur bei wortwörtlichem `process.env.NEXT_PUBLIC_*`-Zugriff zur Build-Zeit ins Client-Bundle einbrennt. Fehlen die Variablen, wirft `createClient()` einen typisierten `SupabaseConfigError` (mit vorherigem `console.error`) statt mit leeren Strings in `@supabase/ssr` zu crashen; `lib/audio/upload.ts` fängt diesen Fehler gezielt ab (`reason: 'not_configured'`). `lib/supabase-env.ts` bleibt ausschließlich für serverseitigen Code (Server Components, Server Actions, Middleware, Admin-Client) reserviert.

## 2. API-Design & Routing (Next.js App Router)

### Ordner-Struktur (Routing)
```
app/[lang]/
  ├── (public)/          # Landing Pages, Preise, AGB, Impressum
  ├── (auth)/            # /login, /register, /reset-password
  ├── (student)/
  │   └── dashboard/     # Premium-Inhalte, Vokabeltrainer, Übungen, Video-Player
  └── (admin)/
      └── teacher/       # CMS, User-Verwaltung, Submission-Feedback
```

### Server Actions (API-Ersatz)
Statt traditioneller `/api`-Routen werden React Server Actions in `actions/` verwendet, um Type-Safety (Zero-Error-Policy) zu garantieren:
- `actions/auth.ts`: Login/Logout/Register.
- `actions/vocabulary.ts`: `getDueCards` (fällige Karten, gewichtete Zufallsreihenfolge), `submitVocabularyAnswer`, `getLessonStats`, `getLessonCards` (Detailansicht inkl. Bild/Audio), `addCardsToTrainer` (manuelle Einzelübernahme), `submitLessonAssessment` (Pre-Assessment: Übersetzung zuerst, nach Aufdecken bekannt → Phase 6, unbekannt → Phase 1). Route `/dashboard/level/[level]/vocabulary/assess?lesson=…` nutzt `getLessonCards` + `submitLessonAssessment`.
- `actions/student.ts`: Submit Exercise, Update Vocab Box, Upload Audio Submission.
- `actions/teacher.ts`: Provide Feedback, Update User Subscription (manuell).
- `actions/admin-operations.ts`: `getNextMonthStaffOverview`, `getStaffBlackboardNotes` (Staff-only, Service-Role nach Session-Prüfung).
- `actions/teacher-notes.ts`: `saveBlackboardNote` (Upsert/Löschen des Schwarzen Bretts, Debounce-Client in `BlackboardProvider`).
- `actions/stripe.ts`: Create Checkout Session, Customer Portal.

## 3. Sicherheitskonzept & RBAC (Role-Based Access Control)

### Edge Middleware (`middleware.ts`)
1. **Session Check**: Überprüft bei jeder Anfrage den JWT-Token und übernimmt gesetzte Cookies bei Weiterleitungen.
2. **Auth-Callbacks**: `/auth/*` ist von Locale- und `?lang=`-Redirects ausgenommen (`lib/locale-routing.ts`). Bestätigungslinks (`/auth/confirm?lang=de&token_hash=…`) dürfen niemals auf `/de` umgeschrieben werden – sonst geht das Einmal-Token verloren.
3. **Routenschutz**: `/dashboard`, `/premium` und `/admin` verlangen eine Sitzung. `/login` und `/register` leiten eingeloggte Nutzer ins Dashboard.
4. **Lehrer-UI**: Die eigentliche Rollenprüfung (`teacher` | `admin`) bleibt im `app/[lang]/admin/layout.tsx`. Die Middleware fängt nur unangemeldete Aufrufe ab.

### Authentifizierung (produktionsreif)
- **Kanonische Domain:** `https://www.sitov-academy.com` (`CANONICAL_SITE_URL` in `lib/site-url.ts`).
- **Outbound-URLs:** `getOutboundSiteUrl()` erzeugt Bestätigungs-, Reset- und Feedback-Links. Localhost wird übersprungen, selbst wenn die Registrierung lokal gegen die Live-DB läuft.
- **Callback:** `app/auth/confirm/route.ts` und `app/auth/callback/route.ts` akzeptieren PKCE (`?code=`) und OTP (`?token_hash=` / `?token=` + `type=`). Token-Hash hat Vorrang (geräteunabhängig). Nach Erfolg geht es über `NEXT_PUBLIC_SITE_URL` direkt auf `/{lang}/dashboard` (Recovery: `/{lang}/reset-password`).
- **Site-URL:** Auth- und Stripe-Weiterleitungen nutzen `getSiteUrl()` / `buildPublicUrl()` aus `lib/site-url.ts`. Es gibt keine hartcodierte `http://localhost:3000`-Redirects in Auth- oder API-Routern.
- **Supabase-Env:** `lib/supabase-env.ts` liest `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` und fällt auf die Aliase `SUPABASE_URL` / `SUPABASE_ANON_KEY` zurück.
- **Supabase Auth (kein SQL, GoTrue-Config):** Site URL = `https://www.sitov-academy.com`. Redirect-Allowlist: `https://www.sitov-academy.com/**`, `https://sitov-academy.com/**`, `https://www.sitov-academy.com/auth/confirm**`, `https://www.sitov-academy.com/auth/callback**`, `http://localhost:3000/**`.
- **E-Mail-Templates:** `supabase/templates/confirmation.html` und `recovery.html` nutzen `token_hash` plus `RedirectTo` (Fallback: `SiteURL`). So funktioniert der Link auch in einem anderen Browser, und die Sprache aus der Registrierung bleibt erhalten.

### Row Level Security (RLS) in Supabase
- **Profiles**: Jeder Nutzer kann nur sein eigenes Profil lesen/schreiben. Lehrer können alle lesen.
- **Submissions**: Studenten lesen/schreiben eigene. Lehrer lesen alle und schreiben Feedback.
- **Teacher Feedback**: Lehrer schreiben und lesen alles, Studenten lesen nur Feedback zu eigenen Einreichungen. Studenten haben keine UPDATE-Rechte; der Gelesen-Status läuft über `mark_feedback_seen(uuid)`.
- **Content (Videos, Exercises)**: Public (oder Authenticated) Read-Only. Schreibrechte nur für Lehrer.

### Serverseitige Automatisierung (Live)
- **`handle_new_user`**: Trigger auf `auth.users` → erstellt automatisch `profiles`-Eintrag.
- **`handle_registration_confirmation`**: Trigger auf `registrations.status` → erstellt `enrollments` bei Bestätigung.
- **`notify-registration-insert` / `notify-trial-insert`**: HTTP-Trigger → Edge Function `notify-new-enrollment`.

## 3a. Analytics & Feature-Flags

- **Meta Pixel Tracking (`lib/analytics/meta-pixel.ts`):**
  - Pixel-ID `1550332886706723` (global in `app/[lang]/layout.tsx`).
  - Standard-Events werden über die Hilfsfunktion `trackMetaEvent(eventName, params)` typensicher und SSR-sicher aufgerufen.
  - Probestunden-Anmeldung (`EnrollmentTerminal.tsx` -> `onTrialSubmit`) feuert das Standard-Event `Lead` (`content_name: 'Kostenlose Probestunde'`, `value: 0.00`, `currency: 'EUR'`).
  - Reguläre Kurs-Einschreibung (`EnrollmentTerminal.tsx` -> `onSubmit`) feuert das Standard-Event `Purchase` mit `totalMonthlyPrice` und `selectedCourseIds`.

- **Production Flag & Lernplattform-Gating (`lib/config/app-config.ts`):**
  - Flag `IS_PRODUCTION: 'Y' | 'N'` (Standard: `'Y'`, konfigurierbar über `NEXT_PUBLIC_IS_PRODUCTION`).
  - Helper `SHOW_LEARNING_PLATFORM`: Bei `IS_PRODUCTION = 'Y'` werden die Einstiegs-Buttons zur Lernplattform ("Lernplattform" / "Plattform" im Header und Mobil-Menü) ausgeblendet, solange sich die Lernplattform in Entwicklung befindet.

- **Mailer-Sicherheit (`lib/mail.ts`):**
  - Server-Only Isolation (`import 'server-only'`) für SMTP-Konfigurationen (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`), um Netlify-Secret-Leaks und fehlerhafte Client-Bundles auszuschließen.

## 4. UX/UI-Architektur (Geragogik & Barrierefreiheit)

- **Smartphone zuerst:** Cursor-Agent `.cursor/rules/ux-smartphone-agent.mdc` (Mobile-First, 375px, kein Horizontal-Scroll, Safe-Area). Geragogik-Maße bleiben in `ux-geragogik-agent.mdc`.
- **Lehrer-Header:** `app/[lang]/admin/layout.tsx` trennt Werkzeuge und Navigation: oben Logo links, Rolle/Sprache/Theme/Logout rechts; darunter die umbrechende `AdminNav` ohne Horizontal-Scroll. Sprachwechsel über `HeaderLanguageSwitcher` + `safeUiLanguageNextPath`.
- **Lernplattform-Hülle:** `app/[lang]/dashboard/layout.tsx` nutzt einen `flex flex-wrap justify-between`-Header: Logo per `order-1` ganz links, Profil/Theme/Abmelden per `order-2`/`order-3` (`md:order-3`) ganz rechts, Breadcrumb-Navigation (`DashboardHeader`) per `order-3 basis-full` (`md:order-2 md:basis-auto`) – auf dem Handy eigene volle Zeile unterhalb, ab `md:` mittig zwischen Logo und Profil-Block. Nur noch eine `DashboardHeader`-Instanz (keine Duplizierung mehr); Breakpoint innerhalb der Komponente ist konsistent `md:`. Touch-Targets 48px, `min-h-dvh`, Safe-Area, Profil-Icon. Texte über `lib/dashboard-i18n.ts` / `lib/videos-i18n.ts` / `lib/profile-i18n.ts`.
- **Komponenten-Design (Mobile First)**: 
  - Extrem aufgeräumt, große Buttons (min. 48x48px Touch-Target).
  - Primäraktionen auf dem Handy volle Breite, Toolbars stapeln unter `md:`.
- **Feedback & Fehler-Toleranz (Zero-Error UI)**:
  - Bei Netzwerkfehlern (z.B. Offline) greift Next.js `error.tsx` mit einem freundlichen Fallback ("Hoppla, das Internet hakt. Versuchen Sie es noch einmal.").
  - Skeleton-Loader für *jeden* asynchronen Ladevorgang (`loading.tsx` und Suspense-Boundaries), um das Gefühl von fließender Geschwindigkeit zu erzeugen.
  - Keine "leeren" Seiten. Wenn keine Vokabeln fällig sind: Wunderschöne Illustration mit Lob ("Alles gelernt für heute!").
- **Styling**: Sitov Branding (`#FF5C00`), weiche Slate-Töne für Dark/Light-Mode. Keine grellen Kontraste, die die Augen älterer Nutzer anstrengen, aber klare Hervorhebungen für Call-to-Actions.
- **Keine automatische Silbentrennung (seit 2026-09-06):** Die globale `p`-Regel in `app/globals.css` nutzt `text-left` + `hyphens: none` (`-webkit-`/`-ms-`-Präfix) + `overflow-wrap: break-word`. Zuvor `text-justify hyphens-auto`, was Wörter unnatürlich trennte. Blocksatz bewusst entfernt (ohne Silbentrennung entstünden sonst Wortlücken/Rivers). Wörter brechen normal bzw. via `break-words`.
- **Niveau-Farbcodierung (seit 2026-09-06):** `levelVisual(levelId)` in `lib/vocabulary-ui.ts` ist die zentrale Quelle für die Farbwelt einer CEFR-Stufe (A1 Smaragd/Türkis, A2 Himmelblau, B1 Marken-Orange, B2 Rosé/Pink, C1 Violett, C2 Gold), ausgewertet über die ersten beiden ID-Zeichen. Liefert `gradient` (Icon), `bar` (Fortschrittsbalken), `soft` (Fläche, Dark-Mode) und `text` (Badge). Ersetzt die frühere, mit steigendem Level zunehmende Abdunklung, die wie ein deaktivierter Zustand wirkte. Genutzt im Niveau-Raster (`app/[lang]/dashboard/page.tsx`), inkl. lesbarem Niveau-Badge statt ausgegrauter Riesenzahl. **Wichtig:** `tailwind.config.ts` scannt daher auch `./lib/**`, damit diese statischen Klassen (und die aus `phaseBarClasses`) generiert werden.
- **Natürliches Scroll-Layout (kein 100vh-Lock, seit 2026-09-03)**: Das zuvor eingesetzte `lg:h-[calc(100vh-5rem)] lg:overflow-hidden`-Muster wurde auf Nutzerfeedback hin **vollständig entfernt** – auf MacBook/Laptop-Displays schnitt es Inhalte ab und blockierte das Trackpad-/Mausrad-Scrollen. Alle sechs Trainer-Hauptansichten (`vocabulary`, `vocabulary/train`, `vocabulary/assess`, `pronunciation`, `exercises`, `videos`) nutzen jetzt flexible Container (`min-h-screen w-full py-8`, kein `overflow-hidden` auf Container-Ebene) und scrollen ganz normal mit der Seite (`overflow-y-auto`, Browser-Standardverhalten) – auf allen Bildschirmgrößen gleich, kein separater Mobile-Pfad mehr nötig. Die Vokabel-Karteikarte (`VocabTrainerClient`) wird stattdessen über `flex flex-1 items-center justify-center` in `vocabulary/train/page.tsx` vertikal zentriert (mit `min-h-`, nicht `h-`, daher kein Clipping, falls die Karte doch mal höher als der Viewport ist – dann scrollt die Seite einfach).
- **Audio-Wiedergabe (seit 2026-09-06):** Sprachnachrichten laufen über `WaveformPlayer.tsx` als reine `<audio>`-Wiedergabe (kein Web-Audio-Graph → kein CORS-Zwang; Bucket `audio_submissions` ist `public=true`). Der Player prüft vorab `canPlayType(guessAudioMimeType(src))` (Format-Erkennung nach Endung in `lib/audio/waveform.ts`), zeigt sichtbare Fehlerzustände (`format` vs. `load` mit Retry), einen Buffering-/Ladezustand und behebt die `Infinity`-Dauer von `MediaRecorder`-webm per Seek-Workaround. Die deutsche Text-to-Speech-Logik liegt zentral in `lib/audio/speech.ts` (`primeGermanSpeech`, `pickGermanVoice`, `speakGerman`): explizite `de-DE`-Stimme mit Browser-Fallback, `voiceschanged`-Caching für mobile Geräte und synchroner, autoplay-/gestensicherer Start aus dem Klick-Handler. `SolutionAudioButton` (Vokabeltrainer + Grammatik/Lückentext) nutzt sie als Fallback hinter der nativen Audio-Datei.
- **Vokabeltrainer-Lernkasten (seit 2026-09-06):** Der Trainer (`vocabulary/train`) startet nicht mehr pauschal mit allen fälligen Vokabeln. `VocabTrainerClient.tsx` ist Orchestrator mit zwei Phasen: `compose` (Lernkasten-Zusammenstellung) und `train` (Kartensession, ausgelagert nach `VocabCardSession.tsx`). Im `compose`-Modus wählt der Lernende Lektionen per Klick oder Drag & Drop in eine Selection-Box; nur deren fällige Karten (`initialCards` gefiltert nach `card.lesson`) fließen in die Session. Die Auswahl je Niveau liegt im `localStorage` (`sitov_lernkasten:{level}`, Helfer `lib/vocabulary-lernkasten.ts`) – reine UI-Vorliebe, kein Server-State. `train/page.tsx` lädt dafür `getDueCards(level)` und `getLessonStats(level)` parallel. Erstbesuch-Standard: alle fälligen Lektionen ausgewählt (deterministisch aus den Props → SSR-/Client-identisch, keine Hydration-Mismatches).
- **Vokabeltrainer-Kartenwechsel (feste Höhe, seit 2026-09-09):** `VocabCardSession.tsx` hält aktuelle Karte (`i`) und Folgekarte (`i+1`) im selben CSS-Grid-Slot mit identischer fester Höhe. Keine Skalierung der Folgekarte, einheitlicher Bildslot, reservierte Rückseite – der Wechsel erzeugt keinen Layout-Shift. Die Selbsteinschätzung speichert fire-and-forget (`submitVocabularyAnswer`); die aktive Karte fliegt in ~260 ms zur Seite. `finishVocabularySession` läuft nach der letzten Karte.
- **Lektions-Modal (Vokabeltrainer):** `LessonCardsModal` ist ein Flex-Dialog mit `max-h-[calc(100vh-6rem)]`. Header (Titel, Tabs, Schließen) bleibt `flex-shrink-0`; der Inhalt nutzt `flex-1 min-h-0 overflow-y-auto overscroll-contain` plus CSS-Klasse `.modal-scroll-region` (`-webkit-overflow-scrolling: touch`). `data-lenis-prevent` am Dialog und am Scrollbereich verhindert, dass Lenis (Desktop-Smooth-Scroll in `SmoothScroll.tsx`) Trackpad-/Mausrad-Gesten schluckt – dasselbe Muster wie in `EnrollmentTerminal`. Tab 1: Wörterliste inkl. clientseitiger eigener Vokabeln (`lib/vocabulary-custom.ts`, `localStorage`). Tab 2: Phasen-Balkendiagramm (`PhaseDistributionChart`, `computePhaseDistribution` in `lib/vocabulary-ui.ts`). Eigene Vokabeln sind bewusst **kein** Server-Persistenz-Pfad: sie haben keine `vocabulary_cards`-Zeile und erscheinen nicht im Leitner-Trainer, nur in Modal-Liste und Phasen-Statistik.

## Re-Branding "Sitov Academy" (2026-09-03)
Alle Textvorkommen von "SmartGerman" (Komponenten, i18n-Fallbacks, Alt-Texte, Doku, Kommentare in `.mdc`/`.sql`) wurden durch "Sitov Academy" ersetzt. Unverändert: `package.json`-Name (bereits `sitov-language-academy`), Supabase-Projekt-ID `wcaslabeiwtvygxtzcio`, sowie externe URLs/Handles wie `t.me/smartgerman_hannover` (echter Telegram-Kanalname, keine Umbenennung möglich).

## 5. Übungs-Modul (Lückentexte & Multiple Choice)

### Eingabe-Paradigma
Es gibt **keine freie Tastatureingabe**. Jede Lücke wird über Tipp-Chips (Tap-to-Select)
gelöst — kein Drag-and-Drop, keine Tippfehler auf Mobilgeräten.

### Bausteine
| Datei | Aufgabe |
|---|---|
| `lib/types/exercise.ts` | Diskriminierte Union der Übungstypen, Parser von JSONB → Typ, CMS-Payload |
| `lib/exercise-chips.ts` | Chip-Generator (Wortfamilien, deterministische Reihenfolge), Smart-Hint-Logik, Punktestaffelung |
| `lib/exercise-i18n.ts` | Zentrale Textbausteine + Platzhalter-Interpolation (`{letter}`, `{length}`) |
| `app/actions/exercises.ts` | `getExercises`, `recordExerciseAttempt`, `finishExerciseSession` |
| `components/exercises/FillInBlankExercise.tsx` | Lückentext mit Chips, Smart Hints, Audio |
| `components/exercises/MultipleChoiceExercise.tsx` | Multiple Choice im gleichen Zero-Error-Muster |
| `components/exercises/SolutionAudioButton.tsx` | Tap-to-Listen mit Fallback-Kette |
| `components/exercises/SmartHintPanel.tsx` | Darstellung des strukturierten Hinweises |

### Zero-Error-Ablauf
1. Chip antippen → Lücke füllt sich (Auswahl bleibt änderbar).
2. „Antwort prüfen" → falsch getippte Chips werden ausgegraut, die Aufgabe bleibt offen.
3. Ab **2 Fehlversuchen**: Smart Hint (Genus bzw. Wortart). Ab **3 Fehlversuchen**: Anfangsbuchstabe und Wortlänge.
4. Gelöst → Tap-Buttons für die Aussprache des Wortes und des ganzen Satzes.

Es gibt keine Timer, keine Bestenlisten und keine Fehler-Metaphorik (kein Rot, kein X).

### Smart-Hint-Quellen (Priorität)
1. `content.smart_hint` aus dem CMS
2. Genus aus `vocabulary_cards.article` (nur wenn die Lücke selbst kein Artikel ist — sonst wäre die Lösung verraten)
3. Wortart-Heuristik aus den Wortfamilien
4. Anfangsbuchstabe + Wortlänge

### Audio-Fallback-Kette
`exercises.solution_audio_url` → `vocabulary_cards.audio_url` → Web-Speech-API (`de-DE`, Rate 0.9) → Hinweistext.

### Fortschritts-Persistenz
`recordExerciseAttempt` schreibt jeden Versuch fort und ruft **kein** `revalidatePath` auf — ein
Refresh mitten im Durchlauf würde die Übungsliste neu filtern und die Indizes verschieben.
Die Fortschrittsanzeigen werden erst über `finishExerciseSession` am Ende des Durchlaufs aktualisiert.

### Konsolidierter Vokabeltrainer (ab 06.09.2026)
- Die getrennte Route `/train` wurde in die Haupt-Lernseite (`VocabTrainerPageClient`) integriert.
- Der State für die selektierten Lektionen (Lernkasten) bleibt im `localStorage`, synchronisiert sich aber sofort in derselben Ansicht.
- Neue Server-Action: `resetLessonProgress` erlaubt das komplette Löschen des `user_vocabulary_progress` für eine spezifische Lektion.
