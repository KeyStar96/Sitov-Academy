# Codebase-Analyse — Sitov Academy (SmartGerman)

**Stand:** 16. September 2026  
**Gegenstand:** Next.js-16-App, Supabase-Projekt `wcaslabeiwtvygxtzcio`, Live-Datenbank, Storage, Edge Functions, Tests, Dokumentation  
**Methode:** vollständige Dateibaum- und Importanalyse, gezielte Code-Lektüre, Live-SQL-Zählungen und Supabase-Advisor (Security/Performance). Keine Schemaänderung, kein Deploy.

Bewertungsskala in diesem Dokument:

| Stufe | Bedeutung |
|-------|-----------|
| **Kritisch** | Angreifbar oder produktiv falsch, ohne weiteren Exploit-Schritt |
| **Hoch** | Produkt-, Sicherheits- oder Datenfehler mit realer Wirkung |
| **Mittel** | Substanzielle Schuld, die bei Wachstum oder Missbrauch teuer wird |
| **Niedrig** | Aufräumen, Drift, Komfort |

---

## 1. Gesamturteil

Die Lernplattform ist **kein Prototyp mehr**. Auth, Locale-Routing, bidirektionales Leitner-Lernen, Grammatik-RPCs, Aussprache-Dialoge, manuelle Kursverwaltung und eine dichte Testpyramide sind produktiv verdrahtet. Die Verteidigungstiefe (Middleware → Layout-Guards → Action-Checks → RLS/RPCs) ist für eine kleine Akademie **überdurchschnittlich**.

Gleichzeitig ist das Repository ein **geschichtetes System aus drei Generationen**:

1. Marketing-Website mit Buchung (`public.users` / `registrations` / Stripe-Reste / alter Sektionsbaum)
2. Freemium-Lernplattform (`subscription_status`, Checkout, `user_vocabulary_progress`)
3. Aktuelles Schulmodell (Admin-Freigaben `allowed_levels` + Trainer-Overrides, `vocabulary_direction_progress`, manuelle Papierkram-Rechnung)

Generation 3 ist live. Generation 1 und 2 liegen als toter UI-Baum, tote API-Routen, parallele Tabellen und widersprüchliche Dokumentation daneben. Das ist der Hauptbefund: **hohe Qualität im Kern, hoher Ballast am Rand, mehrere produktive Sicherheitslöcher in Altlasten.**

---

## 2. Was das System tatsächlich ist

| Schicht | Technologie | Rolle |
|---------|-------------|--------|
| App | Next.js 16, React 19, App Router, `app/[lang]/` | Marketing, Auth, Schüler-Dashboard, Lehrer-Admin |
| Daten | Supabase Postgres, RLS, SECURITY DEFINER RPCs | Identität, Inhalte, Fortschritt, Buchung |
| Storage | `audio_cache` (784 Objekte, ~13 MiB), `pronunciation_audio` (14 Objekte, ~32 MiB), `assets` (2) | TTS-Cache, private Aufnahmen |
| Mail | Nodemailer/SMTP (`lib/mail.ts`) **und** Resend in 6 Edge Functions | Zwei parallele Versandkanäle |
| Hosting | `netlify.toml` **und** Vercel-Annahmen in Docs/.env.example | Unklare Produktionsquelle |
| Tests | 76 Jest-Dateien, 11 PGlite-SQL-Suiten, 3 Playwright-Specs | Stark auf Unit/DB, schwach auf E2E |

Es gibt **kein** Root-`app/layout.tsx`. Die HTML-Shell sitzt in `app/[lang]/layout.tsx`; `middleware.ts` erzwingt Locale-Prefix, Session-Refresh und Login-Schutz.

**Live-Bestand (exakte Zählungen, 16.09.2026):**

| Entität | Zeilen | Einordnung |
|---------|--------|------------|
| `auth.users` / `profiles` | 18 / 18 | Lernkonten, konsistent |
| `public.users` | 81 | separates CRM für Kursanmeldungen |
| `registrations` / `enrollments` | 88 / 119 | produktive Buchung |
| `vocabulary_cards` | 512, **nur A1.1** | Wortschatz-Lücke ab A1.2 |
| `vocabulary_direction_progress` | 4.808 | aktuelles Lernmodell |
| `user_vocabulary_progress` | 2.424 | Legacy-Spiegel (~½ der Richtungsstände) |
| `vocabulary_private.answer_receipts` | 2.796 | Idempotenz-Belege, wachsend |
| `exercises` | 604 (≈100 je A1.1–B1.2) | Grammatik ist der reifste Inhalt |
| `pronunciation_prompts` | 149 (A1/A2 je 40, B1 39, B2–C2 je 10) | Katalog + DB parallel |
| `videos` | **3, nur A1.1** | Trainer existiert, Inhalt nicht |
| `student_trainer_access` | **0** | Feature gebaut, live ungenutzt |
| `manual_invoice_status` | **0** | Rechnungs-UI ohne Daten |
| `cancellations` | **0** | Formular existiert, keine Fälle |
| `monthly_course_bookings` | 2 | kaum genutzt |
| `teacher_feedback` | **0** bei 9 `submissions` | Dialoge ohne abgeschlossenes Feedback |

---

## 3. Stärken (belegt)

### 3.1 Zugriffsmodell in vier Schichten

`lib/access/levels.ts` ist reine, testbare Logik (`ACCESS_LEVELS`, `hasLevelAccess`, `hasTrainerAccess`). IO liegt in `lib/access/server.ts`. UI-Guards: `app/[lang]/dashboard/level/[level]/layout.tsx` (`LevelLocked`) und `TrainerAccessGuard`. Lern-Actions prüfen Trainer/Level erneut. In der Datenbank erzwingen restriktive Policies und private RPCs denselben Umfang (`trainer_access_private`). Deutsch als Schüler-UI-Sprache sperrt Lerntrainer bewusst.

Das ist die sauberste Architektur im Repo.

### 3.2 Session-Middleware ohne Token-Verlust

`middleware.ts` aktualisiert die Supabase-Session **vor** Redirects und kopiert Cookies explizit. `/auth` ist vom Locale-Matcher ausgenommen, damit Bestätigungslinks ihre Token behalten. Playwright prüft das (`e2e/auth.spec.ts`).

### 3.3 Lernkern mit serverseitiger Wahrheit

- Satzbewertung und Grammatikversuche liegen in PostgreSQL, nicht im Client.
- `lib/vocabulary-write-queue.ts` serialisiert optimistische Klicks; `answer_receipts` machen Writes idempotent.
- `lib/vocabulary-scheduler.ts` verhindert benachbarte Gegenrichtungen desselben Wortes.
- `readVocabularyProgress` paginiert über das PostgREST-Limit von 1.000 Zeilen.
- Neural-Audio: Auth → Level → Cache (`audio_cache`, SHA-256) → begrenzter `edge-tts`-Adapter. Service Role bleibt serverseitig (`lib/audio/neural-cache.ts` mit `server-only`).

### 3.4 Backend-Action-Kontrakt

`lib/actions/backend.ts` (`withBackendSession`) nutzt den Cookie-Client (RLS bleibt an), mappt Postgres-Codes auf stabile Fehler, loggt **keine** DB-Inhalte. Das ist das Muster, das ältere Actions (`admin.ts`, `submit-trial.ts`) noch nicht teilen.

### 3.5 i18n-Disziplin im Kern

Fünf Dictionaries (`de/en/uk/ru/tr`), `lib/dictionary.ts` (React `cache`), `createTranslator`, `__tests__/translation-integrity.test.ts`. Lern- und Admin-Texte laufen über Domain-Übersetzer. Geragogik: 48px-Controls, Hochkontrast, Reduced Motion, Native Dialoge, Empty States in den Trainern.

### 3.6 Testpyramide (wo sie existiert)

76 Jest-Dateien treffen Access, Vocabulary-RPCs, Grammar-CMS, Audio, Auth-Callback, i18n. PGlite-Tests prüfen RLS und RPCs isoliert. Das ist für die Teamgröße außergewöhnlich. Die Schwäche liegt in E2E und CI, nicht in den Unit-Tests.

### 3.7 Operative Vorsicht an der Live-DB

Reset ist wiederaufnehmbar, löscht Storage vor SQL, schützt fremde Lehrerdateien. Schema-Änderungen laufen über Migrationen. `schema.sql` und `database.types.ts` werden mitgezogen (auch wenn `schema.sql` selbst zum Problem wird, siehe 6.4).

---

## 4. Kritische und hohe Sicherheitsbefunde

### 4.1 Kritisch — `course_exceptions` öffentlich beschreibbar

Live-Policy (bestätigt per `pg_policy`):

```
"Admin write access"  INSERT  TO public  WITH CHECK (true)
"Public read access"  SELECT  TO public  USING (true)
```

Jeder mit dem Anon-Key (steht in jedem Client-Bundle) kann Feiertage/Ausnahmen einfügen. Die Policy heißt „Admin write access“, prüft aber keine Rolle. Ursprung: `supabase/migrations/exceptions.sql`, gespiegelt in `supabase/schema.sql`.

`getExceptions()` liest die Tabelle für die öffentliche Kursbuchung. Ein Angreifer kann den Stundenplan belasten oder Kurse als ausgefallen markieren.

**Maßnahme:** INSERT/UPDATE/DELETE auf Staff beschränken; bestehende Zeilen auditieren.

### 4.2 Hoch — PII in Logs

| Stelle | Was landet im Log |
|--------|-------------------|
| `app/actions/submit-cancellation.ts` | `console.log("Cancellation Submitted & Saved:", result.data)` — Name, E-Mail, Kurs, Datum |
| Edge Functions `send-confirmation-email`, `send-trial-*`, `send-cancellation-*` | Klartext-E-Mails, teils `JSON.stringify(user)` |
| `scripts/seed-courses.ts` | erste 5 Zeichen des Service-Role-Keys |

In Produktion entfernt `next.config.ts` `console.log`, **nicht** `console.error`/`console.warn`. Die Kündigungs-Action nutzt `console.log` (wird gestrippt) — die Edge Functions laufen **außerhalb** von Next und loggen weiter Klartext in Supabase.

`lib/feedback-email.ts` escaped HTML korrekt. Die Edge-Function-Mails tun das nicht: Kursnamen und Personennamen landen roh im HTML.

### 4.3 Hoch — öffentliche Actions ohne ausreichendes Rate-Limit

| Action | Auth | Limit | Extra-Risiko |
|--------|------|-------|--------------|
| `validateEmail` | nein | **keins** | MX-Lookup als DNS-Amplification / Enumeration |
| `checkTrialEligibility` | nein | **keins** | Service-Role-Lookup, **fail-open** (`eligible: true` bei Fehler **und** bei unvollständiger Eingabe) |
| `submitTrialLesson` | nein | 3/60 min, IP | Service Role, schwache Validierung, Rohfehler an den Client |
| `submitEnrollment` / `submitCancellation` | nein | ja | bewusst öffentlich, ok wenn Upstash steht |
| `finishExerciseSession` | **nein** | nein | nur `revalidatePath` — Cache-DoS |

`lib/ratelimit.ts`: ohne `UPSTASH_REDIS_*` (und `.env.example` dokumentiert sie nicht) fällt jede Instanz auf **In-Memory** zurück. Auf Vercel/Netlify ist das pro Isolate getrennt und umgehbar.

### 4.4 Hoch — Edge Functions ohne Code-Auth

Alle sechs Funktionen unter `supabase/functions/*/index.ts`:

- kein Shared Secret, kein Cron-Header, kein `verify_jwt` im Repo (`config.toml` fehlt)
- `Access-Control-Allow-Origin: *`
- Service-Role-Client intern
- Batch-Mailer verarbeitet bis zu 50 Registrierungen pro Aufruf

Die Sicherheit hängt ausschließlich an der Dashboard-Konfiguration von Supabase. Das ist nicht im Git nachvollziehbar.

### 4.5 Hoch — Stripe-Webhook mit Platzhalter-Fallback

`app/api/webhooks/stripe/route.ts` erzeugt bei fehlender Env einen Admin-Client mit URL `https://placeholder.supabase.co` und Key `'placeholder'`. Signaturprüfung ist korrekt (`constructEvent` + Raw Body). Der Endpoint schreibt nur noch Legacy-`subscription_status` und gated **nichts** — aber er ist erreichbar, nutzt Service Role und gibt Signaturfehlertexte an den Caller zurück.

Checkout (`/api/stripe/checkout`) und Portal (`/api/stripe/portal`) haben **keinen UI-Caller**. Sie sind tote, aber authentifizierte Endpoints mit `STRIPE_PRICE_ID || 'price_placeholder'`.

### 4.6 Mittel/Hoch — Storage

- `pronunciation_audio`: privat, Pfad `userId/…`, MIME/Größe in `lib/audio/upload.ts`. Gut.
- `audio_submissions`: **öffentlicher** Bucket, Legacy-Policies erlauben authentifiziertes INSERT ohne strenge Pfadbindung; später kam eine restriktive `can_record()`-Policy dazu. Live: **0 Objekte** (Reset), Code lädt weiter dorthin hoch. Öffentliche URLs bleiben das Modell (`submitAudioUrl` prüft nur URL-Präfix).
- `audio_cache`: 784 immutable MP3s, **kein TTL**. Wachstum ist linear zu neuen Texten/Stimmen.
- Client-Uploads prüfen MIME-Basisstrings, keine Magic Bytes.

### 4.7 Mittel — Service-Role-Fläche

`utils/supabase/admin.ts` hat **kein** `server-only`. Aktuell nur aus Server-Code importiert; ein versehentlicher Client-Import bündelt den Factory-Pfad (der Key kommt aus Env, nicht aus dem Modul — trotzdem fehlt der Guard, den `neural-cache.ts` hat).

Öffentliche Formulare (`submit-enrollment`, `submit-trial`, `submit-cancellation`, `check-trial-eligibility`) bypassen RLS bewusst. Das ist für anonyme Buchung nötig, macht aber jede Validierungslücke zu einem Schreibrecht auf CRM-Tabellen.

`requireAdmin()` in `admin.ts` wirft rohe `'Not authenticated'` / `'Not authorized'` statt des `BackendError`-Kontrakts. `getStudents()` / `getAdminStats()` geben bei Fehler **leere Daten** zurück — UI kann „keine Schüler“ von „keine Berechtigung“ nicht unterscheiden.

### 4.8 Advisor-Befunde (Live)

Security-Linter:

- 5 Tabellen mit RLS an, **ohne Policies** (`learning_reset_private.*`, `monthly_booking_private.*`, `vocabulary_private.answer_receipts`). Für private Schemas oft gewollt (Zugriff nur über SECURITY DEFINER). Trotzdem INFO, weil Grants stimmen müssen.
- `mark_feedback_seen` ist SECURITY DEFINER und für `authenticated` ausführbar — **absichtlich**, der Function-Body bindet `auth.uid()`.
- **Leaked-Password-Protection in Supabase Auth ist deaktiviert** (HaveIBeenPwned). Für eine Schule mit 50+-Zielgruppe relevant.

Performance-Linter: 21 RLS-Policies werten `auth.uid()` pro Zeile aus statt `(select auth.uid())`; 6 fehlende FK-Indizes (`enrollments.course_id`, `user_vocabulary_progress.card_id`, …); 11 unbenutzte Indizes (darunter beide Stripe-Indizes auf `profiles` — Indiz für tote Stripe-Spalten).

---

## 5. Produktive Logikfehler (nicht nur Schuld)

### 5.1 Hoch — Lehrer-Fortschritt und Lehrer-Reset lesen die falsche Tabelle

Aktueller Schülerpfad: `vocabulary_direction_progress` (`lib/vocabulary-queries.ts`, `app/actions/progress.ts`).

Lehrerpfad in `app/actions/admin.ts`:

- `getAllStudentsProgressData()` zählt `user_vocabulary_progress` mit `box_number = 7`
- `resetStudentProgress()` löscht nur `user_exercise_progress` und `user_vocabulary_progress`

Folgen:

1. Die Prozentanzeige in `StudentList` ist **systematisch falsch**, sobald Schüler bidirektional lernen (ein Wort zählt erst nach **beiden** Richtungen).
2. „Fortschritt zurücksetzen“ im Admin **lässt den echten Lernstand stehen** (`vocabulary_direction_progress`, `vocabulary_learning_state`, `vocabulary_onboarding`, Receipts, Grammatik je nach Mapping). Der Schüler sieht denselben Kasten weiter.
3. `getAllLevelsProgress()` (Schüler-Dashboard) ist korrekt auf Richtungsstände umgestellt — die Admin-UI nicht. Drift innerhalb desselben Features.

Zusätzlich mischt die Prozentformel Grammatikaufgaben und Vokabelkarten in **einen** Nenner. 604 Übungen + 512 Karten nur in A1.1 verzerren jedes höhere Niveau Richtung 0 %, selbst wenn Grammatik dort vollständig ist.

### 5.2 Hoch — Inhaltslücken hinter fertiger UX

| Trainer | UI | Live-Inhalt |
|---------|----|-------------|
| Vokabeln | A1.1–B1.2, Einstufung, Satzmatrix, CMS | **512 Karten, ausschließlich A1.1**. 0 Bilder (`image_url` bei 512 leer). 117 ohne `audio_url`. Übersetzungen de/en/ru/uk/tr vollständig. |
| Grammatik | Themen, 10er-Einheiten, CMS | 604 Übungen, gleichmäßig A1.1–B1.2. Reif. |
| Aussprache | Lesetexte + Dialog | 149 DB-Prompts + zweiter Katalog in `lib/pronunciation-catalog.ts` + `pronunciation-reading-2026.json`. B2–C2 existieren in der DB, **nicht** in `ACCESS_LEVELS`. |
| Videos | YouTube-Library, Empty State | **3 Links, nur A1.1.** |

Die Plattform **sieht** nach sechs Niveaus aus. Wortschatz und Video sind A1.1-Inseln. Das ist die größte pädagogische Lücke, kein reines Technikthema.

### 5.3 Mittel — Feature gebaut, live leer

`student_trainer_access`: 0 Zeilen. Die Override-UI, RLS und Tests sind vollständig — niemand nutzt sie produktiv. `manual_invoice_status`: 0. `cancellations`: 0.

Das ist kein Bug, aber es erhöht die Angriffsfläche (Policies, RPCs, Admin-UI) ohne betrieblichen Nutzen, bis Lehrkräfte es einsetzen.

### 5.4 Mittel — Identity-Split CRM vs. LMS

Drei Personenmodelle:

| Tabelle | Bedeutung | Live |
|---------|-----------|------|
| `auth.users` + `profiles` | Lern-/Lehrer-Login | 18 |
| `public.users` | Stammdaten der Kursanmeldung (Name, Geburt, Adresse, E-Mail) | 81 |
| `claim_verified_legacy_profile` | Verknüpfung nur nach bestätigter E-Mail | bewusst eng |

81 CRM-Personen vs. 18 Lernkonten ist fachlich erklärbar (Präsenzkurse ohne Lernraum). Die Tabelle heißt trotzdem `users`, enthält Adressen als Klartext, und Edge Functions joinen `registrations → users`. Verwechslung mit `auth.users` ist in jedem neuen Agent-Task eine Falle. `birth_date` ist `text`, nicht `date`.

---

## 6. Tote Dateien, tote Klassen, toter Config

Konfidenz **hoch**, sofern nicht anders markiert: keine Importe außerhalb der eigenen Datei / nur über andere tote Dateien.

### 6.1 Unerreichbarer Marketing-Baum (Homepage rendert nur Hero, AcademyStory, AcademyCourses, AcademyFooter)

| Datei / Ordner | Warum tot |
|----------------|-----------|
| `components/sections/CourseDataWrapper.tsx` | Einstieg des alten Kurs-/Stundenplan-Blocks |
| `components/sections/Courses.tsx` | nur von CourseDataWrapper |
| `components/sections/Timetable/*` (4 Dateien) | nur von CourseDataWrapper |
| `components/sections/About/*` (4 Dateien) | kein App-Import |
| `components/sections/Location/*` (2 Dateien) | kein App-Import |
| `components/sections/WhyUsHorizontal.tsx` | kein Import |
| `components/sections/WhyUsBento.tsx` | kein Import |
| `components/sections/ScienceSection.tsx` | kein Import (NeuralBrain intern, aber unerreichbar) |
| `components/sections/GoogleReviews.tsx` | kein Import |
| `components/footer/TimeStatus.tsx` | kein Import |
| `components/ui/CustomSelect.tsx` | kein Import, dazu `any`-Props |
| `components/ui/SiriProgressOrb.tsx` | kein Import |
| `lib/useScrollReveal3D.ts` | kein Import |
| `components/ui/MouseGlow.tsx` | nur von totem Courses/Timetable |

**Orphan-i18n:** `WhyUs` in allen fünf `dictionaries/*.json` (~je 80+ Zeilen). `Science`, Location, Reviews analog.

Das sind grob **20+ TSX-Dateien plus Dictionary-Blöcke**, die Bundle- und Review-Last erzeugen, ohne eine Route zu speisen.

### 6.2 Tote Konfiguration und Scripts

| Pfad | Befund |
|------|--------|
| `lib/config/app-config.ts` | `IS_PRODUCTION` / `SHOW_LEARNING_PLATFORM` — **kein** TS-Import. `Header.tsx` zeigt den Dashboard-Link immer. Docs behaupten das Gegenteil (`ARCHITECTURE.md`, `CURRENT_STATE.md`). |
| `dictionaries/translation-blacklist.json` | 43 Zeilen, kein Import |
| `scripts/generate_sql_direct.js` + `.py` | ~140 KB eingebetteter Exercise-Snapshot, kein Aufrufer |
| `scripts/seed-courses.ts` | bewusst deaktiviert, loggt Key-Prefix |
| `scripts/translate_hints.js` | Einmal-Gemini-Skript, `GEMINI_API_KEY`, nicht in `package.json` |
| `supabase/seeds/grammar-curriculum-proofread.sql` | keine Test-/Runtime-Referenz |
| `supabase/seeds/grammar-progress-security.sql` | keine Referenz |

`scripts/build-grammar-curriculum.mjs` ist **kein** toter Code: erzeugt JSON/SQL aus `.txt`. Fehlt nur im npm-Script.

### 6.3 Stripe-Freemium ohne UI

| Pfad | Status |
|------|--------|
| `app/api/stripe/checkout/route.ts` | kein `fetch` aus der App; nur Kompatibilitätstest |
| `app/api/stripe/portal/route.ts` | kein Caller |
| `app/api/webhooks/stripe/route.ts` | Endpoint lebt, schreibt irrelevante Spalten |
| `utils/stripe/server.ts` | nur von den drei Routen |
| `profiles.subscription_status`, `stripe_customer_id`, `stripe_subscription_id` | alle 18 Profile `kostenlos`, Stripe-Felder ungenutzt; Indizes vom Advisor als unused markiert |

Kursbuchung über `registrations` ist **kein** Stripe-Checkout. MONETIZATION.md beschreibt noch das historische Freemium und behauptet zugleich, öffentliche Kursbuchung laufe über Stripe — das widerspricht dem aktuellen Enrollment-Terminal (Überweisung/Papierkram).

### 6.4 `schema.sql` ist kein Schema mehr

313 KB, 4.073 Zeilen. Enthält CREATE TABLE **plus** hunderte `UPDATE public.exercises SET content = '{...}'` mit vollständigen Aufgaben. Das ist ein Daten-Dump im „Schema-Referenz“-File, das jeder Agent lädt. Es driftet gegenüber datierten Migrationen, enthält `DROP COLUMN hint_ru` **und** die alten Spalten in der CREATE-Sektion, und ist als Replay unbrauchbar (Kopfkommentar sagt das selbst).

**32 von 55 Migrationen** haben keine Timestamp-Prefix (`add_*.sql`, `fix_*.sql`, `exceptions.sql`). Replay-Reihenfolge ist nur historisch definiert.

### 6.5 Nicht tot, aber doppelte Wahrheit

Diese Dateien dürfen **nicht** gelöscht werden, ohne Migrationsplan:

- `user_vocabulary_progress` — Mirror aus `20260910133125_vocabulary_bidirectional_learning.sql`
- `lib/pronunciation-catalog.ts` + DB-`pronunciation_prompts` + `pronunciation-reading-2026.json`
- `grammar-curriculum-2026.txt` / `.json` / `.sql` (Generator-Pipeline)
- `app/actions/cms.ts` vs. `grammar-cms.ts` (zwei CMS-APIs, beide genutzt)
- `lib/*-i18n.ts` plus Dictionaries (Fallback-Maps duplizieren Keys)
- `register/` (Auth-Signup) vs. `registration/` (Kursanmeldung) — **keine** Duplikate, aber Namenskollision

`lib/vocabulary-custom.ts` ist genutzt (`LessonCardsModal`), speichert aber nur in `localStorage`. Kommentar verweist noch auf `user_vocabulary_progress`. Gerätewechsel verliert die Merkliste. Kein Datenmüll, aber ein zweites, unsicheres Vokabelmodell neben Leitner.

---

## 7. Redundanz im laufenden System

### 7.1 Dual-Write Lernfortschritt

RPCs schreiben weiterhin in **beide** Progress-Tabellen (Legacy-Mirror). Live 2.424 vs. 4.808 ist fast exakt 1∶2 und bestätigt den Spiegel. Kosten:

- doppelte Trigger (`learning_reset_guard` auf beiden)
- doppelte RLS (alte permissive + neue restrictive)
- Admin liest die falsche Hälfte (5.1)
- 21 Advisor-Warnungen betreffen überwiegend die Legacy-Policies

Der Mirror war als Rollout-Brücke gedacht. Der Rollout ist vorbei; der Mirror ist Dauerzustand.

### 7.2 Dual-Mail

| Kanal | Nutzung |
|-------|---------|
| Nodemailer SMTP | `lib/mail.ts` → Feedback-Mails der Lernplattform |
| Resend in Edge Functions | Buchungs-, Probe-, Kündigungsmails |
| Supabase Auth Templates | Confirm/Recovery im Dashboard |

Drei Zustellwege, drei HTML-Welten, zwei Escaping-Qualitäten. `lib/feedback-email.ts` ist der einzige gehärtete Pfad.

### 7.3 Dual-Hosting und Dual-Docs

`netlify.toml` (`@netlify/plugin-nextjs`) sitzt im Root. Docs und `.env.example` sprechen Vercel und Netlify parallel. Es gibt **kein** `.github/workflows`. CI ist „lokal Jest + Hoffen auf den Host-Build“. Playwright startet `npm run dev`, nicht den Production-Build.

`PEDAGOGY_AND_RESEARCH.md` ist fachlich tot: Phase 6 = „gelernt“, Intervalle 1/3/10/30/90, Stripe-auf-Edge-Research. Der Code hat Phase 7 als gelernt, Intervalle 1/1/3/9/29/90, Node-Runtime. Die Master Guideline und CURRENT_STATE widersprechen dieser Datei, ersetzen sie aber nicht.

Root-Protokolle (`ARCHITECTURE`, `CURRENT_STATE`, `MONETIZATION`, Master Guideline) sind **Append-only-Tagebücher** (~3.000 Zeilen zusammen) plus 18 datierte `docs/*-2026-09-*.md`. Das erfüllt die Agent-Regel und macht den Ist-Zustand für Menschen unlesbar. Diese Analyse ist bewusst ein Querschnitt, kein weiteres Changelog.

### 7.4 Dual-i18n-Runtime

`dictionaries/*.json` (~2.090 Zeilen, de 120 KB, ru/uk 160+ KB) **und** harte Fallback-Objekte in `lib/grammar-i18n.ts`, `lib/admin-registration-i18n.ts`, `EnrollmentTerminal` (importiert `de.json` zusätzlich). Integritätstests decken Dictionaries, nicht die Fallback-Maps. `lib/admin-registration-i18n.ts` enthält lange englische Strings als Default.

### 7.5 `getCourses` sortiert, Marketing sortiert nochmal

`get-courses.ts` sortiert nach internem `getLevelRank` / `getTypeRank`. `lib/marketing-course-order.ts` sortiert die Startseite unabhängig. Zwei Wahrheiten für dieselbe Kursliste. Plus `unstable_cache` (1 h) auf einem Modul-Client mit Placeholder-Fallback.

---

## 8. Datenmüll (Live und Repo)

### 8.1 Live-Datenbank

| Befund | Volumen | Bewertung |
|--------|---------|-----------|
| Legacy-Vokabelfortschritt parallel zum Richtungsstand | 2.424 Zeilen | Spiegel, kein Orphan, aber Müll sobald Mirror fällt |
| `answer_receipts` | 2.796 | wächst mit jeder Antwort; kein Recycle |
| `audio_cache` | 784 Dateien / 13 MiB | klein, aber ungebunden |
| `learning_reset_private.jobs` | 7 | abgeschlossene Reset-Jobs, nicht aufgeräumt |
| `teacher_feedback` | 0 bei 9 Submissions | halbfertige Dialoge oder Altbestand nach Reset |
| Stripe-Spalten + unused Indexes | 18 Profile, alle `kostenlos` | tote Geschäftsdaten |
| `course_exceptions` | 46 | fachlich ok, aber ungeschützt (4.1) |
| Vokabel-Bilder | 512/512 leer | Spalte ohne Inhalt |
| `student_trainer_access` | 0 | leere Produktschicht |

`public.users` (81) ist **kein** Müll, sondern CRM. Trotzdem PII ohne offensichtliche Retention/Anonymisierung im Code.

### 8.2 Repo-Müll

- Alter Sektionsbaum (6.1)
- Grammar-Seed-Dreifaltigkeit plus zwei verwaiste SQL-Dateien
- `schema.sql` mit eingebettetem Curriculum-Dump
- 32 undatierte Migrationen, die niemand neu anwenden sollte
- Agent-Vendoring (`.agents/`, `skills-lock.json`) — kein App-Runtime, aber Review-Rauschen
- `e2e/learning-flow.spec.ts`: zwei Tests, **nur Kommentare**, Assertion „bestanden, weil key-Fix existiert“

### 8.3 Env-Drift

`.env.example` listet Site-URL + öffentliche Supabase-Keys. Im Code zusätzlich nötig und undokumentiert: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_*`, `SMTP_*`, `UPSTASH_*`, `NEXT_PUBLIC_IS_PRODUCTION`, `RESEND_API_KEY` (nur Edge), `GEMINI_API_KEY` (Skript).

---

## 9. Codequalität

### 9.1 `any`-Verstöße (Zero-Error-Policy)

Produktiver Code, nicht Tests:

- `app/actions/get-courses.ts`, `get-exceptions.ts` — DB-Zeilen als `any`
- `app/actions/submit-trial.ts`, `submit-cancellation.ts` — `error?: any`
- `lib/registration-schema.ts`, `lib/cancellation-schema.ts` — Translator `any`
- `app/api/webhooks/stripe/route.ts` — `catch (error: any)`
- `lib/ratelimit.ts` — `windowString as any`
- `components/ui/DateDropdowns.tsx` — Props `any`
- `components/cancellation/CancellationForm.tsx` — `dictionary: any`
- gesamter toter Marketing-Baum (`dictionary: any`)
- Edge Functions: `(e: any)`

Neuere Actions (`vocabulary.ts`, `grammar-cms.ts`, `withBackendSession`) sind sauber typisiert gegen `Database`. Die Kluft ist generational.

### 9.2 Fehlende try/catch / Error Boundaries

Projektregel: `error.tsx` auf jeder Route-Ebene; asynchrone DB-Calls in try/catch.

| Lücke | Wirkung |
|-------|---------|
| kein `app/[lang]/error.tsx` | Marketing-Crash → Next-Default |
| kein `app/[lang]/dashboard/error.tsx` | Schüler-Übersicht fällt auf Locale-Default durch, den es nicht gibt |
| kein `not-found.tsx` | 404 ungestaltet |
| Admin-CMS `content/vocabulary|exercises|videos` ohne segment-error/loading | nur Parent-Admin-Boundary |
| `app/actions/progress.ts` | kein try/catch; DB-Fehler kann die Action verlassen |
| `checkTrialEligibility` | fail-open |

17 `error.tsx` und 19 `loading.tsx` existieren — die Regel ist in Auth/Trainer-Segmenten erfüllt, an den meistbesuchten Hüllen nicht.

### 9.3 Next/Performance

- `next/image` nur in `BrandLogo`, `AcademyStory` und totem About/Science. Vocab-Karten und Meta-Pixel nutzen `<img>`.
- `reactStrictMode` ist in Produktion **aus**. Das versteckt Side-Effect-Bugs in Effects (Audio, Queue).
- NeuralBrain: 6.400 Nodes, 20.193 Kanten, Three.js + R3F 9 auf der Startseite. Pause bei Unsichtbarkeit und Reduced-Motion-Fallback sind gebaut; das JS-Gewicht bleibt.
- `optimizePackageImports` für lucide/gsap/framer ist gesetzt. Three ist nicht in der Liste.
- `get-courses.ts` `select('*')` + `unstable_cache` 1 h — akzeptabel für 12 Kurse, nicht als Muster.
- Dashboard-Layouts: `force-dynamic` — richtig für personalisierte Seiten.

### 9.4 Tests: wo die Pyramide bricht

| Gut | Schlecht |
|-----|----------|
| Access, Vocabulary-RPCs, Grammar-CMS, i18n-Keys, Auth-Callback | `e2e/learning-flow.spec.ts` ist tot |
| PGlite für RLS | kein npm-Script für `trainer-access`, `ukrainian-vocabulary`, `canonical-blackboards`, `audio-cache` |
| Axe auf Home/Registration/Cancellation | Axe filtert den orangen CTA explizit heraus; keine Lernraum-Scans |
| 76 Jest-Dateien | kein GitHub-Action-CI |
| Stripe-Kompatibilitätstest | testet eine UI-lose Route und zementiert Legacy |

### 9.5 Geragogik vs. Code

Eingehalten: große Hit-Flächen, kein Drag-and-Drop in Grammatik, kein Timer, Hochkontrast, Reduced Motion, freundliches Feedback, fünf Sprachen.

Verletzt oder ungeprüft:

- Orange-CTA bewusst unter WCAG-Kontrast (Playwright-Ausnahme)
- Custom-Vokabeln nur localStorage (ältere Nutzer, Gerätewechsel)
- Admin-Prozente unverständlich/falsch (5.1)
- `PEDAGOGY_AND_RESEARCH.md` beschreibt ein anderes Leitner als der Code
- Video-Empty-State ist ehrlich; Vokabel-Niveaus A1.2–B1.2 sind **unehrlich voll** (Karten existieren in der Navigation, Inhalt nicht)

### 9.6 Inoffizielle Abhängigkeit

`node-edge-tts` spricht ein Microsoft-WebSocket-Protokoll. Das ist kein Vertrag. Ausfall oder Protokollwechsel macht den gesamten Audio-Trainer stumm (Cache hilft nur für bereits gehashte Texte). Es gibt keinen Provider-Fallback.

---

## 10. Was ausgebaut werden muss

Priorität nach Wirkung auf Schüler und Betrieb, nicht nach Lust am Refactor.

### P0 — Sicherheit und Datenintegrität

1. `course_exceptions`-INSERT schließen, Bestand prüfen.
2. PII aus Edge-Function-Logs und HTML-Mails entfernen; Escaping analog `feedback-email.ts`.
3. Edge Functions: JWT/Secret im Code und `config.toml` im Repo.
4. Upstash in Produktion erzwingen; `validateEmail` und `checkTrialEligibility` limitieren; fail-open streichen.
5. Admin-Progress und Admin-Reset auf `vocabulary_direction_progress` (+ Onboarding/State/Receipts) umstellen oder die UI entfernen, bis das stimmt.
6. Leaked-Password-Protection in Supabase Auth einschalten.
7. `createAdminClient` mit `server-only` schützen; Placeholder-Fallbacks in Stripe/get-courses fail-fast machen.

### P1 — Produktlücken, die die UX schon verspricht

1. Vokabeln A1.2–B1.2 (derselbe Qualitätsgrad wie A1.1: Artikel, Übersetzungen, Kontextsätze, Audio).
2. Bilderstrategie: Spalte füllen oder UI-Image-Slot entfernen (heute 512 leere Slots).
3. Audio-Lücke: 117 Karten ohne `audio_url` vorwärmen.
4. Videos wirklich A1.1–B1.2 oder den Trainer in der Navigation zurückstufen.
5. Trainer-Freigaben: entweder mit Lehrkräften in Betrieb nehmen oder die Komplexität hinter einem Default verstecken.
6. Rechnungsdesk: `manual_invoice_status` wird nicht geschrieben — Workflow mit Papierkram schließen oder UI nicht als „erledigt“-System präsentieren.

### P2 — Ballast entfernen (eigene PRs, kein Big-Bang)

1. Marketing-Totbaum + WhyUs-Dictionary-Keys + MouseGlow/CustomSelect/Siri/TimeStatus/useScrollReveal3D.
2. Stripe-Checkout/Portal stilllegen oder hinter Feature-Flag; Webhook nur behalten, wenn wirklich Events ankommen.
3. `app-config.ts` anbinden oder löschen; Docs zu Header-Gating korrigieren.
4. `generate_sql_direct.*`, `translation-blacklist.json`, deaktiviertes `seed-courses.ts`.
5. `schema.sql` auf echte DDL reduzieren; Curriculum-Dumps gehören nach `seeds/`.
6. Migrationen nicht umbenennen (Live-Historie), aber neue nur noch timestamped.

### P3 — Architektur festziehen

1. Legacy-Mirror `user_vocabulary_progress` abschalten, sobald Admin und Reset nur noch Richtungsstände nutzen. Dual-Write kostet Trigger, RLS und Verwirrung.
2. `answer_receipts` und `audio_cache` Retention (z. B. 90 Tage / LRU).
3. Mail auf **einen** Provider (Resend **oder** SMTP).
4. Hosting auf **eine** Plattform dokumentieren; CI (typecheck, jest, ausgewählte SQL-Tests) vor Merge.
5. E2E: Login → Niveau → eine Vokabelkarte → eine Grammatikaufgabe, gegen Staging, nicht als Kommentar.
6. `error.tsx`/`not-found.tsx` auf `[lang]` und `dashboard`.
7. i18n: Fallback-Maps in `*-i18n.ts` gegen Dictionaries erzeugen, nicht handpflegen.
8. `public.users` umbenennen ist zu riskant live; im Code und in Docs konsequent „CRM-Kontakt“ nennen, nie „User“.
9. TTS: vertraglichen Provider oder dokumentierten manuellen Aufnahme-Pfad als Fallback.
10. B2–C2: entweder `ACCESS_LEVELS` erweitern oder Aussprache-Prompts B2–C2 aus der Schüler-UI fernhalten.

### P4 — Qualität

1. Restliche `any` in Actions/Schemas.
2. `progress.ts` try/catch + benutzerfreundlicher Fallback.
3. `next/image` für sichtbare Fotos; Pixel-noscript-`<img>` kann bleiben.
4. `reactStrictMode` in Produktion wieder an, Audio-Effects gegen Double-Invoke härten.
5. Playwright-WebKit (Safari ist die reale Zielgruppe 50+ / iPhone).

---

## 11. Datei- und Klasseninventar (kompakt)

### 11.1 Behalten und pflegen

`middleware.ts`, `lib/locale-routing.ts`, `lib/access/*`, `lib/actions/backend.ts`, `lib/leitner.ts`, `lib/vocabulary-{scheduler,queries,write-queue,languages}.ts`, `lib/grammar-{session,validation}.ts`, `lib/audio/neural-*`, `app/actions/vocabulary.ts`, `grammar-cms.ts`, `pronunciation-conversations.ts`, `resetUserProgress.ts`, Dictionaries, PGlite-Tests.

### 11.2 Behalten, aber umbauen

`app/actions/admin.ts` (Progress/Reset), `app/actions/progress.ts`, `lib/ratelimit.ts`, `utils/supabase/admin.ts`, Stripe-Webhook (oder löschen), Edge Functions, `schema.sql`, `Header.tsx` vs. `app-config.ts`, `lib/pronunciation-catalog.ts` (eine Quelle).

### 11.3 Löschkandidaten (nach Import-Check in einem eigenen PR)

Siehe 6.1 und 6.2. Nicht löschen: Mirror-Tabelle, Seeds der Generator-Pipeline, `DateDropdowns` (Registration + Cancellation).

### 11.4 Keine „Klassen“ im OO-Sinn

Das Repo ist funktional/modulisch. Es gibt keine ungenutzten TS-`class`-Hierarchien. Der Ballast sind **Module und Routen**, nicht Vererbung. Einzige nennenswerte Klasse im Kern: `BackendError`.

---

## 12. Widersprüche Dokumentation ↔ Code (Auswahl)

| Behauptung | Realität |
|------------|----------|
| `SHOW_LEARNING_PLATFORM` blendet den Header-Button in Produktion aus | Flag unimportiert; Button immer sichtbar; Logik wäre zudem invertiert dokumentiert |
| Öffentliche Kursbuchung über Stripe | Enrollment ohne Checkout; Stripe-UI tot |
| Phase 6 = gelernt (`PEDAGOGY_AND_RESEARCH.md`) | Phase 6 aktiv, Box 7 = gelernt |
| Intervalle 1/3/10/30/90 | 1/1/3/9/29/90 |
| `error.tsx` auf jeder Route | Dashboard-Hülle und Marketing ohne |
| Kein `any` | ~20 Produktionsstellen |
| Lernplattform A1–C2 im Hero | Zugang und Inhalte A1.1–B1.2, Wortschatz nur A1.1 |
| In-App-Paywall entfernt | Checkout-Route und Webhook noch da |

---

## 13. Empfohlene Reihenfolge der nächsten Arbeit

Nicht „alles aufräumen“, sondern:

1. **Sicherheitshotfix** (4.1, 4.2, 4.3, 4.4) — kleine Diffs, hohe Wirkung.
2. **Admin-Progress/Reset an das bidirektionale Modell** — sonst arbeiten Lehrkräfte mit falschen Zahlen und unwirksamen Resets.
3. **Inhalt A1.2-Vokabeln** — sonst bleibt der Kerntrainer nach Lektion A1.1 leer.
4. **Totbaum Marketing + Stripe-UI-Routen** — senkt `any`-Lärm und Review-Last für alle Folge-PRs.
5. **CI + echtes E2E** — sonst regrediert 1–4 unbemerkt.

---

## 14. Was diese Analyse nicht geprüft hat

- Juristische Vollständigkeit von AGB/Datenschutz (im CURRENT_STATE als Betreiberaufgabe markiert)
- Ob Upstash/Resend/Stripe-Keys in Netlify/Vercel wirklich gesetzt sind
- Ob Edge Functions im Dashboard `verify_jwt` aktiv haben (kein `config.toml`)
- Inhaltliche Korrektheit der 604 Grammatikaufgaben und 512 Vokabeln
- Last (nur Advisor, keine EXPLAIN-Analysen unter Last)
- Barrierefreiheit im eingeloggten Lernraum (Axe nur öffentlich)

---

*Erstellt als Querschnitt 2026-09-16. Kein Ersatz für ARCHITECTURE.md (Soll) oder CURRENT_STATE.md (Tagebuch).*
