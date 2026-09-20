# MASTER-PROMPT 3.0 — Sitov Academy

Übergabefertig für ChatGPT 6 Astra. Phasenweise Abarbeitung — der gesamte Prompt bleibt im Kontext.
Er basiert auf einem durchgeführten Tiefen-Audit der realen Codebase.
Alle Entscheidungen sind getroffen. Es gibt keine offenen Fragen.

---

### ROLLE & MISSION

Du agierst als autonomer Lead Fullstack Engineer, Datenbank-Architekt und Mobile-UX-Spezialist für die Sprachlernplattform "Sitov Academy".

**Stack (verifiziert):** Next.js 16.3.5 · React 19.2.8 · Tailwind 3.4.15 · TypeScript 5.6 · Zod 4 · selbstgehostetes Supabase (Postgres 15.8) auf eigenem VPS.

**Deployment-Umgebung:**
* Code wird **lokal** bearbeitet und per `git push` ins Repository übertragen.
* Auf dem VPS (`ssh sitov-academy`) wird per `git pull` aktualisiert, gebaut und deployed. Repo-Pfad: `/var/www/sitov-academy`.
* Alle serverseitigen Befehle (Migrationen, `pg_dump`, `systemctl`, `nginx -t`, Docker-Operationen) werden live auf dem VPS ausgeführt — nicht lokal.

Ziel ist ein visuell beeindruckendes, barrierefreies Web- und App-Erlebnis mit eindeutiger Didaktik ohne Ratespiele, einem toleranten Soft-Error-Bewertungssystem, WCAG-AA-Kontrasten, maximaler Auffindbarkeit in der Google Search Console, einer hardware-realistisch optimierten Codebase, sprachlich einwandfreier Lokalisierung, sauberer Datenbankarchitektur, entkoppeltem VPS-Monitoring, funktionierenden Medien-Uploads und einem voll nutzbaren Lehrer-Dashboard.

---

### GRUNDREGELN — gelten in ALLEN Phasen, ohne Ausnahme

* **R1 — VERIFY-BEFORE-ACT.** Bevor du eine Datei löschst, umbenennst oder eine Konfiguration änderst: prüfe, dass sie existiert und dass dein Verständnis ihres Inhalts stimmt. Findest du eine genannte Datei nicht, hake die Aufgabe als `[N/A — nicht vorhanden]` ab. Erfinde nichts.
* **R2 — KEIN OOM.** Die Maschine hat 8 GB RAM und ist bereits überbucht: Container-Limits 6.660 MB + App 1.536 MB = 8.196 MB. Jede Erhöhung eines Speicherlimits erfordert die gleichzeitige Senkung eines anderen und eine explizite Summenrechnung im Report. Ohne Rechnung keine Änderung.
* **R3 — KEINE EXTERNEN DIENSTE.** `deploy/vps/sitov-app.service` setzt `IPAddressDeny=any` / `IPAddressAllow=localhost`. Ausgehende Verbindungen sind kernelseitig gesperrt. Upstash, Redis Cloud, Vercel KV, externe APIs sind verboten.
* **R4 — DEAD-CODE NUR MIT DYNAMIC-IMPORT-AUFLÖSUNG.** Eine Datei gilt erst als tot, wenn sie weder über statische `import`-Statements noch über `dynamic(() => import(...))` noch über `React.lazy` von einem `app/**/{page,layout,route,loading,error,template,sitemap,robots}.{ts,tsx}` aus erreichbar ist. Gegenbeispiel: `components/effects/NeuralBrain.tsx` wirkt statisch tot, ist aber über `dynamic()` in `Hero.tsx:12` und `ScienceSection.tsx:9` lebendig.
* **R5 — KEINE CLIENT-BEWERTUNG.** Lernfortschritt wird ausschließlich in PostgreSQL entschieden (`SECURITY DEFINER`, `SET search_path TO ''`). Der Client darf Ergebnisse darstellen, niemals bestimmen. Das gilt auch für Soft-Errors.
* **R6 — TESTS DÜRFEN VERLETZUNGEN NICHT AUSBLENDEN.** Ein Test, der eine Anforderung per Whitelist oder Filter umgeht, ist ein Bug im Test. Entferne den Filter, statt ihn zu erweitern.
* **R7 — JEDE DDL-ÄNDERUNG IST IDEMPOTENT.** Neue DDL landet in `supabase/vps/<nn>_<modul>.sql`, ohne `BEGIN;`/`COMMIT;` (`deploy/vps/migrate-local.py` klammert alle Dateien selbst in eine Transaktion). Anschließend zwingend `supabase/schema.sql` (`pg_dump`) und `supabase/database.types.ts` aktualisieren.
* **R8 — BACKUP VOR JEDER DB-ÄNDERUNG.** `python3 deploy/vps/migrate-local.py --backup-only`, SHA256 im Report protokollieren. ⚠️ Einmalige Warnung: Dieses Skript bricht bei nicht-leerem MinIO-Bucket bewusst ab. Nach dem ersten Medien-Upload (Phase 2.2/5.3) ist es nicht mehr ausführbar. Setze deshalb vor Phase 5 einen Kommentar an den Skriptkopf und etabliere ein alternatives Backup-Verfahren (`pg_dump` + Storage-API-Dump).
* **R9 — ROLLBACK-PLAN.** Jede Migration muss einen dokumentierten Rollback-Pfad haben. Bei `RENAME COLUMN`: das inverse `RENAME` als kommentiertes SQL am Ende der Migrationsdatei. Kein Breaking-Change ohne Rückweg.
* **R10 — ERRORS SIND EXPLIZIT.** Jede RPC gibt bei Fehler ein strukturiertes JSONB zurück mit mindestens `{"error": "<code>", "message": "<text>"}`. Kein `RAISE EXCEPTION` ohne maschinenlesbaren Code. Kein stilles Verschlucken.
* **R11 — ENUM STATT CHECK.** Wiederkehrende Wertemengen (Status, Rollen, Typen, Trainer-Codes) werden als `CREATE TYPE … AS ENUM` definiert — nicht als `CHECK`-Constraint. Bestehende `CHECK`-Constraints auf Wertemengen werden im Zuge der jeweiligen Phase durch Enum-Types ersetzt.

---

### PHASE 1 — REPOSITORY-CLEANUP

Stand 20.09.2026: Phase 1 (1.1–1.6) abgeschlossen; phasenspezifische Abnahme bestanden. Der vollständige Jest-Lauf enthält bereits im Ausgangsstand vorhandene Grammatikfehler (Nachweis unten). Der Nutzer hat ausdrücklich entschieden, diese bis Phase 3 zurückzustellen; sie blockieren den Abschluss von Phase 1 nicht. Keine Datenbank- oder Deployment-Änderungen.

#### 1.1 Netlify-Eliminierung — die echten Fundorte
* [x] `netlify.toml` gelöscht.
* [x] `lib/site-url.ts`: `CONTEXT`, `URL`, `DEPLOY_PRIME_URL`, `VERCEL_ENV`, `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL` aus `SiteUrlEnv` entfernt. Auflösung einschließlich `CANONICAL_SITE_URL`: normalisierte `NEXT_PUBLIC_SITE_URL` → normalisierte `SITE_URL` → Dev-Fallback `http://localhost:3000`. Produktion bleibt ohne gültige explizite URL fail-closed. Request-Header liefern keine allgemeine Site-Origin; lokale Auth-Redirects behalten ausschließlich außerhalb Produktion ihren Loopback-Port.
* [x] `__tests__/site-url.test.ts` angepasst; Priorität, Normalisierung, Fallbacks, Produktionsfehler und Redirect-Sicherheit automatisiert geprüft.
* [N/A — laut Vorgabe nicht vorhanden] `@netlify/plugin-nextjs` ist keine Dependency in `package.json`; nicht erneut gesucht.

#### 1.2 Verifizierte tote Dateien gelöscht (21 Stück, Reachability-geprüft)
* [x] `components/dashboard/VideoPlayer.tsx`
* [x] `components/footer/TimeStatus.tsx`
* [x] `components/sections/About/AboutContainer.tsx`
* [x] `components/sections/About/BioReveal.tsx`
* [x] `components/sections/About/LanguageMatrix.tsx`
* [x] `components/sections/About/TimelineCV.tsx`
* [x] `components/sections/GoogleReviews.tsx`
* [x] `components/sections/Location/LocationSection.tsx`
* [x] `components/sections/Location/MapComponent.tsx`
* [x] `components/sections/ScienceSection.tsx`
* [x] `components/sections/WhyUsBento.tsx`
* [x] `components/sections/WhyUsHorizontal.tsx`
* [x] `components/ui/CustomSelect.tsx`
* [x] `components/ui/Marquee.tsx`
* [x] `components/ui/MouseGlow.tsx`
* [x] `components/ui/SiriProgressOrb.tsx`
* [x] `lib/config/app-config.ts`
* [x] `lib/feedback-email.ts`
* [x] `lib/lenis.ts`
* [x] `lib/time-utils.ts`
* [x] `lib/useScrollReveal3D.ts`

* [x] ⛔ Geschützt und unverändert: `components/effects/NeuralBrain.tsx`, `neural-brain-geometry.ts`, `neural-brain-shaders.ts` — über `Hero.tsx:11` via `dynamic()` erreichbar. `three` und `@react-three/fiber` bleiben in den unveränderten Dependencies.
* [x] `npm run build` nach den Löschungen erfolgreich; zusätzliche AST-/Modulauflösungsprüfung meldet keine verwaisten lokalen Code-Imports.

#### 1.3 Tote Supabase Edge Functions gelöscht
Die sechs stillgelegten HTTP-410-Stubs hatten keine Aufrufreferenzen im Repository. Der aktive Mailweg bleibt unverändert: `public.queue_transactional_email()` → `private.mail_outbox` → `lib/mail/worker.mjs` (über `scripts/mail-worker.mjs`) → `sitov-mail.service`.
* [x] `supabase/functions/notify-new-enrollment/`
* [x] `supabase/functions/send-confirmation-email/`
* [x] `supabase/functions/send-cancellation-email/`
* [x] `supabase/functions/send-cancellation-confirmation/`
* [x] `supabase/functions/send-trial-confirmation-email/`
* [x] `supabase/functions/send-trial-cancellation-email/`

#### 1.4 Konfig- und Skript-Altlasten (inkl. Befunde N1–N4)
* [x] `skills-lock.json` gelöscht — keine Referenzen außerhalb dieser Checkliste.
* [x] `dictionaries/translation-blacklist.json` gelöscht — keine Referenzen außerhalb dieser Checkliste.
* [x] `[N1]` `lib/lenis.ts` gelöscht — vor der Löschung leer, tatsächlich 0 Bytes. ⛔ Das npm-Paket `lenis` bleibt: `components/effects/SmoothScroll.tsx:4` importiert `ReactLenis` aus `lenis/react`; `AdminDialog.tsx`, `LessonAccessModal.tsx`, `StudentDetailModal.tsx` behalten `data-lenis-prevent`.
* [x] `[N2]` `validate_json.js` gelöscht. Der Tippfehler `'tu'` statt `'tr'` war vorhanden. `__tests__/translation-integrity.test.ts` lädt und validiert alle fünf JSON-Dateien.
* [x] `[N3]` `resize-images.mjs` gelöscht. `sharp` war nicht direkt deklariert, aber transitiv über Next.js lokal ladbar; die frühere Begründung „nicht lauffähig“ war nicht belegt. Löschung als Altlast gemäß Freigabe durchgeführt.
* [x] `[N4]` `.gitignore` um `playwright-report/` und `test-results/` ergänzt; `git rm -r --cached playwright-report test-results` ausgeführt. Beide lokalen Artefakte bleiben vorhanden, sind ignoriert und nicht mehr im Git-Index.

#### 1.5 Verwaiste Dictionary-Keys entfernt (alle 5 Sprachen synchron) — [N5]
* [x] In `de/en/ru/uk/tr` die elf verwaisten Top-Level-Keys entfernt: `features`, `WhyUs`, `about_v2`, `science`, `location`, `footer`, `schedule`, `reviews_title`, `reviews_excellent`, `reviews_subtitle`, `reviews_data`.
* [x] Nur `timetable.locations` innerhalb von `timetable` gelöscht.
* [x] ⛔ `timetable.days.{mo,di,mi,do,fr,sa,so}` einschließlich aller Werte unverändert erhalten. Nutzung in `EnrollmentTerminal.tsx` einschließlich deutscher Fallbacks sowie in `AcademyCourses.tsx` bestätigt.
* [x] Geschützt und unverändert: `hero`, `sections` und das aktive `Footer` (großes F). Die frühere Aussage, die Top-Level-Keys `hero` und `sections` seien aktuell live, war in S2 nicht bestätigt; ihre Schutzvorgabe bleibt verbindlich.
* [x] `ru`: `cancellation.form.success_message` und `cancellation.form.success_title` entfernt.
* [x] `uk`: `footer.links.cancellation` mit dem verwaisten `footer` entfernt.
* [x] `tr`: `footer.links.cancellation` mit dem verwaisten `footer` entfernt.
* [x] `__tests__/translation-integrity.test.ts` prüft exakte rekursive Objektstruktur einschließlich zusätzlicher/fehlender Keys, leerer Objekte und Werttypen ohne Whitelist. Arrays zählen als Listenwerte; unterschiedliche Inhaltslängen sind keine Dictionary-Keys. Die frühere Werteidentitätsheuristik ohne Assertion wurde entfernt: identische Eigennamen/Adressen belegen keinen Übersetzungsfehler und die Heuristik war kein wirksamer Test.

Abnahme: in allen fünf Dateien exakt **1.117 Blattpfade** (vorher 1.203 / 1.203 / 1.205 / 1.204 / 1.204). Automatisierter Vergleich gegen die Ausgangsdateien bestätigt ausschließlich die beauftragten Löschungen; alle verbleibenden Werte unverändert. Keine Neuformatierung der Dictionaries.

#### 1.6 [N/A]-Liste — erledigt oder gegenstandslos, nicht bearbeiten
* [N/A — nicht vorhanden] `agents/`-Ordner.
* [N/A — keine Dateien vorhanden] `CourseDataWrapper.tsx`, `Courses.tsx`, `Timetable/*`. `components/sections/Timetable/` existiert leer und bleibt unberührt.
* [N/A — nicht vorhanden] `generate_sql_direct.*`, `seed-courses.ts`.
* [N/A — keine Routendateien vorhanden] `app/api/stripe/checkout/`, `app/api/stripe/portal/`: beide Verzeichnisse existieren leer und bleiben unberührt; keine Stripe-Dependency.
* [N/A — bereits erledigt] `supabase/schema.sql` ist ein Schema-Dump ohne eigenständige Daten-INSERTs oder COPY-Blöcke. Die enthaltenen `INSERT INTO` gehören zu Funktionsdefinitionen. Sechs Seed-/Curriculum-Dateien liegen in `supabase/seeds/`; Schema und Seeds unverändert.

#### S4 — Abnahmenachweise Phase 1 (20.09.2026)

| Prüfung | Ergebnis |
|---|---|
| `npm run build` | Bestanden, einschließlich TypeScript und 131 statischer Seiten. Lokaler Verifikationsbuild; kein Deployment. |
| `npm test -- --runInBand --runTestsByPath __tests__/site-url.test.ts __tests__/translation-integrity.test.ts` | 2 Suites, 39 Tests bestanden. |
| Automatisierte Dateisystem-/Git-Assertions | 26 Altdateien und sechs Edge-Ordner entfernt; 14 geschützte Dateien bytegleich zum Ausgangsstand; Testartefakte nicht im Index und durch Git ignoriert. |
| TypeScript-AST und echte Modulauflösung | 86 App-Einstiegspunkte, 297 erreichbare Module, 0 unaufgelöste lokale Code-Imports; dynamische Imports berücksichtigt, geschützte Effekte erreichbar. |
| Automatisierter Dictionary-Vergleich | Exakt die beauftragten Löschungen, je 1.117 identische Blattpfade, alle geschützten und übrigen verbleibenden Werte unverändert. |
| Automatisierte N/A-Prüfung | Fehlende Dateien, leere Verzeichnisse, fehlende Stripe-Dependency, Schema-only-Dump und sechs Seed-Dateien bestätigt. |
| `npm test -- --runInBand` | **Nicht grün:** 82 Suites bestanden, 3 fehlgeschlagen, 1 bereits optional übersprungene Live-Integrationssuite; 1.082 Tests bestanden, 12 fehlgeschlagen, 1 übersprungen. |
| Baseline-Reproduktion auf unverändertem `c980f95` | Dieselben 3 Grammatik-Suites und 12 Fehler in einer temporären Kopie von `git archive HEAD` reproduziert; keine durch Phase 1 eingeführten Grammatikfehler. |

Gemäß Nutzerentscheidung bis Phase 3 zurückgestellt: `grammar-curriculum.test.ts`, `grammar-cms-actions.test.ts` und `grammar-cms-roundtrip.test.tsx` scheitern bereits vor Phase 1. Seeds/Testdaten und CMS-Tests passen nicht zum aktuellen `accepted_answers`-Vertrag; der CMS-Fallback nimmt zudem die Hauptantwort in die Liste auf, während die Validierung diese Kombination als Duplikat ablehnt. Keine Tests deaktiviert oder Anforderungen ausgefiltert. Die Grammatik-Korrektur bleibt für Phase 3 offen; der Gesamt-Testlauf wird ausdrücklich nicht als grün ausgewiesen.

---

### PHASE 2 — DATENBANK, MEDIEN & IDENTITÄT

#### 2.0 Identitätsmodell — ENTSCHEIDUNG GETROFFEN: OPTION A
Befund: Es existieren zwei getrennte Identitäten: `public.people` (`people.id` referenziert als `person_id` in `bookings`, `invoice_cases` für die Geschäftsidentität) und `public.profiles` (`profiles.id` = `auth.users.id` referenziert als `user_id` in allen Lerntabellen für die Lern-/Auth-Identität). Ein pauschales `user_id` → `person_id` würde Spalten, die auf `auth.uid()` zeigen, wie Fremdschlüssel auf `people.id` aussehen lassen. Das ist verboten.

Festlegung (verbindlich, nicht verhandelbar):
* `public.people.id` bleibt das Ziel für Geschäftsbeziehungen und heißt in verknüpften Tabellen weiterhin `person_id` (`bookings.person_id`, `invoice_cases.person_id`). Unverändert.
* In allen Lerntabellen wird die Referenz auf `auth.users.id` / `profiles.id` einheitlich `auth_user_id` genannt — statt des zweideutigen `user_id`.
* Die Migration ist strikt idempotent und erfolgt ausschließlich per `ALTER TABLE … RENAME COLUMN`. Kein Drop-and-Recreate von Tabellen. Keine Datenmigration. Kein ID-Merge.

Betroffene Spalten (13 Stück, vollständige Liste):
* `public.student_level_access.user_id`
* `public.learning_trainer_grants.user_id`
* `public.learning_unit_grants.user_id`
* `public.user_exercise_progress.user_id`
* `public.vocabulary_direction_progress.user_id`
* `public.vocabulary_learning_state.user_id`
* `public.vocabulary_onboarding.user_id`
* `public.submissions.user_id`
* `vocabulary_private.answer_receipts.user_id`
* `learning_reset_private.audio_objects.user_id`
* `learning_reset_private.jobs.user_id`
* `public.people.auth_user_id` heißt bereits korrekt — nicht anfassen.

Vorgehen:
* [ ] ADR anlegen: `docs/adr/001-identity-model.md` mit dieser Festlegung und der Begründung.
* [ ] Backup nach R8.
* [ ] Migration `supabase/vps/02_identity_alignment.sql` selbstständig erstellen und ausführen (strikt idempotent mittels `ALTER TABLE ... RENAME COLUMN` für alle betroffenen Spalten).
* [ ] ⚠️ ACHTUNG: `ALTER TABLE … RENAME COLUMN` aktualisiert RLS-Policies, Views und PL/pgSQL-Funktionsbodies NICHT automatisch — diese sind gespeicherter SQL-Text. Nach der Migration müssen ALLE Objekte, die `user_id` in den betroffenen Schemata referenzieren, identifiziert und auf `auth_user_id` korrigiert werden. Messbares Ziel: Kein RLS-Policy-Body, kein View und keine Funktion auf den betroffenen Tabellen referenziert nach Abschluss noch `user_id`. Dynamisches SQL in PL/pgSQL ist ebenfalls betroffen.
* [ ] App-Code: 44 Treffer in `app/`, `lib/`, `components/` anpassen. Schwerpunkte: `app/actions/admin.ts`, `lib/vocabulary-queries.ts`, `lib/profile-dashboard-server.ts`, `lib/reset-user-progress.ts`.
* [ ] RPC-Parameter (`p_user_id`, `p_student_id`) bleiben unverändert — sie sind Teil der öffentlichen API und nicht mehrdeutig.
* [ ] `supabase/database.types.ts` neu generieren, `supabase/schema.sql` neu dumpen.
* [ ] Alle `supabase/tests/*.test.mjs` und `__tests__/*` anpassen und grün bekommen.

#### 2.1 Kombinierte Registrierung — gezielte Lückenschließung, kein Neubau
Befund: Zu ~90 % vorhanden: `business_private.provision_profile()` legt `profiles` und `people` gemeinsam an. `business_private.claim_person()` verschmilzt eine anonyme Kursanmeldung mit dem verifizierten Account.
⛔ Sicherheitsbremse nicht entfernen: `claim_person()` merged nur bei genau einem unbeanspruchten `people`-Datensatz ohne bestehende Buchungen und bei exakt übereinstimmender, verifizierter E-Mail. Sonst `unresolved: true`.

* [ ] Admin-UI für den unresolved-Fall (z. B. Familien mit geteilter E-Mail): Liste aller `people` mit `auth_user_id IS NULL` und kollidierender E-Mail, manuelle Zuordnung durch Staff in einer neuen Route unter `app/[lang]/admin/registrations/`.
* [ ] In `components/registration/EnrollmentTerminal.tsx` einen optionalen Schritt „Konto anlegen" ergänzen, der denselben Supabase-Signup auslöst — damit greifen `provision_profile` + `claim_person` automatisch.
* [ ] E2E-Beleg: Kursanmeldung ohne Konto → späterer Signup mit gleicher Mail → Buchung erscheint im Dashboard.

#### 2.2 Medien- & Lektionsstruktur — Breaking Change erforderlich
Befund: `public.learning_videos` trägt `CONSTRAINT learning_videos_unit_id_key UNIQUE (unit_id)` ⇒ strukturell ein Video pro Lektion. Keine `title`-Spalte. `source_url` per CHECK auf `^https?://` ⇒ das Modell zielt auf externe YouTube-Links (`lib/video-links.ts`), nicht auf Uploads.

* [ ] Migration `supabase/vps/01_critical_fixes.sql` selbstständig erstellen und ausführen, um den UNIQUE-Constraint aufzuheben und die erforderlichen Tabellen/Strukturen anzulegen.
* [ ] Namenskonvention für die neuen Tabellen strikt: `folder_id`, `asset_id`, `course_id` — niemals nur `id`.
* [ ] Storage-Bucket `course-assets`, privat. Pfadschema: `/{level}/{folder_id}/videos/{video_id}.{ext}` · `/{level}/{folder_id}/presentations/{asset_id}.{ext}`
* [ ] `supabase/database.types.ts` um `lms_media_folder`, `lms_presentation_asset` und die neuen `learning_videos`-Spalten erweitern.
* [ ] Messbare Akzeptanzkriterien für die neuen Tabellen:
  - `lms_media_folder` muss mindestens enthalten: Primärschlüssel, FK auf Level, FK auf Kurs (nullable), Titel mit Längen-Constraint, Sortierung, Timestamps. UNIQUE über (level, title).
  - `lms_presentation_asset` muss mindestens enthalten: Primärschlüssel, FK auf Ordner mit `ON DELETE CASCADE`, Dateiname, Storage-Pfad, MIME-Type, Dateigröße, Sortierung, Timestamp.
  - `learning_videos` erweitert um: FK auf Ordner (nullable für Altdaten), Titel, Storage-Pfad (für Uploads), Dateigröße. `UNIQUE(unit_id)` entfernt.
  - Alle neuen Tabellen verwenden Enum-Types statt CHECK-Constraints (R11).
  - Alle `updated_at`-Spalten haben einen automatischen Trigger.

#### 2.3 Upload-Pfad tatsächlich befahrbar machen
* [ ] `deploy/vps/nginx.conf`: `client_max_body_size 32m` → `512m` nur in der Location `/supabase/`. Die App-Location `/` bleibt bei `32m`.
* [ ] In derselben Location `proxy_request_buffering off;` setzen.
* [ ] `nginx -t` vor `systemctl reload nginx`.
* [ ] Speicher-Governance auf 240 GB: belegter Platz im Lehrer-Dashboard anzeigen, harte Obergrenze pro Level (20 GB), Alarm ab 80 % Gesamtbelegung.

#### 2.4 RLS & Schreibrechte für Medien und Kursausfälle
Befund-Korrektur: `public.course_exceptions` hat kein Schreibloch. Es existiert nur `exception_read` (`SELECT`, anon + authenticated); die GRANTs umfassen ausschließlich `SELECT`. Geschrieben wird heute nur über `business_private.save_course`. Es fehlt also eine Schreibfähigkeit, kein Fix.

* [ ] Neue SECURITY-DEFINER-RPCs `public.save_course_exception(p_course_id uuid, p_date date, p_reason text)` und `public.delete_course_exception(p_id uuid)` anlegen, Implementierung in `business_private`, Guard über `business_private.is_staff()`. Kein direkter `INSERT`-GRANT auf die Tabelle.
* [ ] RLS für `lms_media_folder`, `learning_videos`, `lms_presentation_asset` umsetzen: `SELECT` über Level-Freigabe (`student_level_access` bzw. `learning_private.unit_allowed(...)`) und `INSERT`/`UPDATE`/`DELETE` ausschließlich für `identity_private.current_profile_role() IN ('teacher','admin')`.
* [ ] Storage-Policies auf `storage.objects` für Bucket `course-assets` analog aufbauen.

#### 2.5 [N/A]-Liste — bereits erledigt, nicht anfassen
* `import 'server-only'` in `utils/supabase/admin.ts` ergänzen: steht bereits in Zeile 2.
* `getAllStudentsProgressData()` liest veraltete Tabelle: liest bereits `vocabulary_direction_progress` (`app/actions/admin.ts:130`).
* `resetStudentProgress()` löscht veraltete Tabelle: ruft bereits RPC `reset_student_level_progress` auf.
* `user_vocabulary_progress` migrieren: existiert nur noch in Test-Fixtures.

#### 2.6 Datenbank-Normalisierung auf 3NF — Breaking Change

Abwärtskompatibilität zur bestehenden Datenbankstruktur ist NICHT erforderlich. Zielnormalform: **3. Normalform (3NF)**. Intentionale Snapshots (`bookings.contact_*`, `booking_items.title_snapshot`) werden NICHT normalisiert — das sind historische Audit-Daten und bleiben bewusst denormalisiert.

* [ ] **Transitive Abhängigkeiten eliminieren:** `submissions.prompt_title` entfernen (Titel über `prompt_id` per JOIN erreichbar). `cancellation_requests.course_name` durch FK-Referenz auf `courses` ersetzen. Bestehende Zeilen migrieren. App-Code anpassen.
* [ ] **Fehlende Fremdschlüssel nachrüsten:** Alle `level`-Spalten in `student_level_access`, `learning_trainer_grants`, `learning_unit_grants`, `vocabulary_onboarding`, `learning_units` und `courses` müssen FK-Constraints auf `learning_levels.code` erhalten. Ebenso `learning_levels.cefr_level` → FK auf `cefr_levels.code`.
* [ ] **Locale-Referenzen absichern:** `vocabulary_translations.locale`, `course_translations.locale` und `grammar_translations.locale` erhalten FK-Constraints auf `locales.code` statt der aktuellen CHECK-Constraints.
* [ ] **Enum-Types einführen (R11):** Wiederkehrende Wertemengen aus CHECK-Constraints in Enum-Types überführen. Betrifft mindestens: Booking-Status, Booking-Kind, Trainer-Codes, Profil-Rollen, Submission-Typen, Kurs-Kategorien, Kurs-Typen, Submission-Status.
* [ ] **`updated_at`-Trigger:** Alle Tabellen mit `updated_at`-Spalte erhalten einen generischen Trigger, der `updated_at = now()` bei jedem `UPDATE` setzt. Betrifft mindestens: `bookings`, `people`, `profiles`, `user_exercise_progress`, `vocabulary_direction_progress`, `invoice_cases` und alle neuen Tabellen aus 2.2.
* [ ] **JSONB-Schema-Constraint:** `learning_exercises.content` erhält einen Constraint, der das Feld `accepted_answers` erzwingt. Kein `alternative_answers` nach Abschluss von Phase 3.1.
* [ ] Messbares Gesamtziel: Nach Abschluss darf keine `text`-Spalte mit Wertemenge ohne FK oder Enum-Constraint existieren. Prüfung über `information_schema`.

---

### PHASE 3 — DIDAKTIK & SOFT-ERROR-SYSTEM

#### 3.1 KRITISCHER BUG ZUERST: Feldnamen-Drift
Befund: Client und Server lesen verschiedene JSONB-Felder (Client: `content.accepted_answers`, Server: `content->'alternative_answers'`). Serverseitige Alternativantworten feuern nie.

* [ ] Kanonisch ist `accepted_answers`.
* [ ] `grammar_private.record_attempt` umstellen, mit Übergangs-Fallback auf `alternative_answers` für Altdaten.
* [ ] Datenmigration: alle `learning_exercises` mit `content->'alternative_answers'` auf `accepted_answers` vereinheitlichen, danach den Fallback in einer Folge-Release entfernen.
* [ ] Regressionstest: Aufgabe mit `accepted_answers` anlegen, eine Alternative einreichen, `completed = true` in `user_exercise_progress` verifizieren.

#### 3.2 Soft-Error — serverseitig, mehrsprachig, mit Levenshtein
Befund: `validateUserAnswer()` mit `EXACT` | `SOFT_ERROR` | `INCORRECT` existiert bereits, hat aber keine Levenshtein-Distanz und liefert hartcodierte deutsche Warntexte.

* [ ] `learning_private.grade_answer(p_input text, p_accepted text[]) RETURNS jsonb` anlegen. Verbindlicher Rückgabe-Contract:
  - `status`: `"EXACT"` | `"SOFT_ERROR"` | `"INCORRECT"` — genau diese drei Werte, keine anderen.
  - `matched`: `text | null` — die Akzeptanzantwort, die gematcht hat. `null` bei `INCORRECT`.
  - `reason`: `text | null` — Grund des Soft-Errors. `null` bei `EXACT` und `INCORRECT`. Erlaubte Werte: `"punctuation"` | `"capitalization"` | `"umlaut"` | `"typo"`.
* [ ] Prüfreihenfolge und reason-Priorität:
  1. `punctuation` (nur Satzzeichen differieren)
  2. `capitalization` (nur Groß-/Kleinschreibung)
  3. `umlaut` (ae/oe/ue/ss statt ä/ö/ü/ß)
  4. `typo` (wortweise Levenshtein-Summe ≤ 1)
* [ ] Levenshtein wortweise, nicht satzweise. Zusätzliche Schranke: Tippfehlertoleranz gilt erst ab Wortlänge ≥ 4, damit `der`/`den`, `ihm`/`ihn`, `am`/`an` nicht verschluckt werden.
* [ ] `SOFT_ERROR` zählt als richtig für den Fortschritt (`completed = true`, Leitner-Box steigt), aber: `user_exercise_progress.score` wird auf max. 90 gedeckelt, und das Rückgabe-JSON trägt `reason`, damit die UI badgen kann.
* [ ] `lib/grammar-validation.ts`: `validateUserAnswer()` auf die Rolle „optimistische Sofort-Vorschau" reduzieren. Verbindlich ist der Server (R5).
* [ ] Die deutschen Warnstrings aus `lib/grammar-validation.ts` entfernen. Neue Keys in allen fünf Dictionaries: `exercises.soft_error.punctuation` · `.capitalization` · `.umlaut` · `.typo`. Die UI mappt `reason` → Dictionary-Key. Gelber Badge über das Token `--warning`, niemals rot.

#### 3.3 Vokabeltrainer — Byte-Exaktheit kontrolliert aufweichen
Befund: `vocabulary_private.submit_answer` prüft Byte-exakt. Ein Leerzeichen am Satzende ⇒ falsch ⇒ Leitner-Box fällt zurück.

* [ ] Innerhalb dieser Funktion den Vergleich durch `learning_private.grade_answer(...)` ersetzen.
* [ ] Leitner-Logik bei `SOFT_ERROR`: Box steigt wie bei `EXACT`, aber `lapses` wird nicht erhöht und das Intervall wird auf den Wert der vorherigen Phase gedeckelt (sanfte Wiederholung).
* [ ] Rückgabe-JSON um `"softError": <reason|null>` erweitern. `app/actions/vocabulary.ts:27` und `components/vocabulary/VocabCardSession.tsx` entsprechend erweitern.
* [ ] Den irreführenden Kommentar in der Funktion aktualisieren.
* [ ] `supabase/tests/vocabulary-learning.test.mjs` erweitern: Tippfehler · fehlender Punkt · Kleinschreibung · echter Fehler.

#### 3.4 Eindeutige Zielwert-Führung (No-Guessing)
* [ ] `grammarWriteSchema` in `lib/grammar-validation.ts` um ein Pflichtfeld `target_form: z.array(z.string().trim().min(1)).min(1)` erweitern.
* [ ] Bei Übersetzungsaufgaben rendert die UI den Prompt als `Как вас зовут? [heißen]`.
* [ ] `components/admin/ExerciseCMS.tsx` erhält das Eingabefeld; Speichern ohne `target_form` wird per Zod abgelehnt.
* [ ] Migration: bestehende Aufgaben ohne `target_form` werden im CMS als „unvollständig" markiert und nicht mehr an Schüler ausgeliefert.

#### 3.5 Sprachkonsistenz & Lektorat — Fokus verschoben
Befund-Korrektur: Die Dictionaries sind in gutem Zustand (Tippfehler sind bereits korrigiert). Das Risiko liegt in den DB-Inhalten.

* [ ] Audit von `public.vocabulary_translations`, `public.grammar_translations`, `public.course_translations` je Locale (`de`, `en`, `ru`, `uk`, `tr`): Zeilen ohne Übersetzung, `ru`/`uk`-Zeilen ohne kyrillische Zeichen, `de`-Zeilen, die unverändert nach `ru`/`uk`/`tr` kopiert wurden.
* [ ] `learning_exercises` und `learning_reading_texts` müssen ausschließlich deutsche Sätze enthalten. CHECK/Trigger ergänzen, der kyrillische Zeichen sowie `ı ğ ş İ Ğ Ş` im deutschen Aufgabentext ablehnt.
* [ ] Report als `docs/audit/content-lektorat.md` mit Zeilenzahlen je Tabelle und Locale.

---

### PHASE 4 — VPS-HARDWARE, PERFORMANCE & API-SICHERHEIT

#### 4.0 IST-ZUSTAND
App: systemd (`NODE_OPTIONS=--max-old-space-size=1024`, `MemoryMax=1536M`, `CPUQuota=200%`). Supabase: Coolify-docker-compose. Summe aller Container-Limits: 6.660 MB + App 1.536 MB = 8.196 MB auf 8 GB RAM. BEREITS ÜBERBUCHT.
⛔ Verboten, weil sie das System zerstören: `--max-old-space-size=4096` · `shared_buffers=2GB` · `effective_cache_size=6GB` · `work_mem=64MB`.

#### 4.1 Tatsächlich mögliche, sichere Optimierungen
* [ ] `next.config.ts`: `experimental.cpus: 2` → `4`. Kein Speicherrisiko.
* [ ] `deploy/vps/sitov-app.service`: `CPUQuota=200%` → `350%`.
* [ ] Speicher nur verschieben, nicht erhöhen. Verbindliche Zielwerte: Reduktion bei `supabase-studio` (−192 MB), `supabase-analytics` (−388 MB), `supabase-vector` (−128 MB). Erhöhung bei App `MemoryMax` (+512 MB), App `NODE_OPTIONS` Heap (1.536 MB), `supabase-db` `mem_limit` (+192 MB). Neue Summe: 8.192 MB. Diese Rechnung gehört in den Report.
* [ ] Monitoring-Container (max. 128 MB) in eine erneuerte Rechnung aufnehmen.
* [ ] `deploy-release.sh`: Build-Heap 3072 beibehalten.
* [ ] Postgres-Parameter ausschließlich in `deploy/vps/configure-local-services.py` ändern.

#### 4.2 Vokabeltrainer-Latenz < 500 ms
* [ ] Vor jeder Optimierung `EXPLAIN (ANALYZE, BUFFERS)` für die Queries in `app/actions/vocabulary.ts` und `lib/vocabulary-queries.ts` protokollieren.
* [ ] Indizes prüfen/ergänzen für `vocabulary_direction_progress` (Spalten `auth_user_id`, `next_review_date` und `auth_user_id`, `box_number`).
* [ ] `getAllStudentsProgressData()` in eine SQL-Aggregatfunktion verlagern, um Speicher zu schonen.
* [ ] Kein prozessweiter In-Memory-Cache ohne Invalidierung — `lib/learning-reset-events.ts` muss ihn leeren können.

#### 4.3 API-Absicherung — Rate-Limit-Bypass schließen
Befund: `h.get('x-forwarded-for')?.split(',')[0]` ist client-kontrolliert und frei spoofbar ⇒ Limit wertlos.

* [ ] Modul `lib/client-ip.ts` anlegen, das die vertrauenswürdige Client-IP hinter Traefik und Nginx anhand der vorgegebenen `TRUSTED_PROXY_HOPS=1` sicher ermittelt (Proxy-Hops am Ende der Kette ignorieren).
* [ ] Alle vier Aufrufstellen umstellen (`submit-trial.ts`, `submit-cancellation.ts`, `submit-enrollment.ts`, `app/actions/auth.ts:67`).
* [ ] Env `TRUSTED_PROXY_HOPS=1` in `.env.example` und `/etc/sitov-academy/app.env` dokumentieren.
* [ ] Test: gefälschter Header `X-Forwarded-For: 1.2.3.4` ändert den Rate-Limit-Key nicht.
* [ ] ⛔ Kein Upstash (R3). `lib/ratelimit.ts` ist bereits Postgres-basiert und fail-closed. Nicht ändern.
* [ ] `app/actions/check-trial-eligibility.ts` gibt konstant `{eligible:true}` zurück. Funktion in `trialEligibilityHint()` umbenennen und den Kommentar schärfen.
* [ ] PII-Scan über alle `console.error`- und `console.warn`-Aufrufe durchführen.

---

### PHASE 5 — UI/UX, KONTRAST, MEDIEN-HUB & DASHBOARD

#### 5.1 Kontrast — zuerst den Test entschärfen, der die Verletzung versteckt
Befund: `e2e/accessibility.spec.ts` enthält einen expliziten Whitelist-Block, der Kontrastverletzungen ignoriert.

* [ ] Diesen Filterblock ersatzlos löschen (R6). Erst danach ist die Kontrastarbeit messbar.
* [ ] Konkrete Fails beheben: `bg-[var(--accent)] text-white hover:bg-[#FF7A33]` muss korrigiert werden, sodass die Hover-Farbe abdunkelt und mindestens 4,5:1 Kontrast erreicht. Ebenso `text-gray-500` auf hellem Chip zu `text-[var(--foreground)]` ändern.
* [ ] Alle hartcodierten `#FF5C00`, `#FF7A33`, `#FFF4EC` durch Tokens ersetzen.
* [ ] Regel: Auf orangem Grund ist Text entweder `#FFFFFF` oder `#0F172A` — niemals ein Grau-, Slate-, Zinc- oder Neutral-Ton. Ergänze ESLint-Regel oder Jest-Test dafür.
* [ ] `__tests__/appearance-contrast.test.ts` erweitern: `:root` (light) und `html.dark` mit Schwelle 4,5:1 für Text und 3:1 für Borders hinzufügen.
* [ ] Neues Token-Paar `--warning` / `--warning-foreground` für die Soft-Error-Badges anlegen.

#### 5.2 Fixierter Aufnahme-Button im Aussprache-Trainer
* [ ] Auf Viewports < 1024 px wird der Aufnahmebereich als Sticky-Bottom-Bar gerendert (`sticky bottom-0 z-40`), mit Padding für den iOS-Home-Indicator.
* [ ] Dem Textcontainer entsprechendes `padding-bottom` geben.
* [ ] Mindest-Touchziel 56 × 56 px.
* [ ] Playwright auf Pixel-7- und iPhone-14-Viewport: nach `scrollIntoView` des Textendes ist der Button weiterhin `toBeInViewport()` und klickbar.

#### 5.3 Lehrer-Dashboard: Medienverwaltung
* [ ] Neue Route `app/[lang]/admin/content/media/page.tsx` + Komponente `components/admin/MediaFolderCMS.tsx`.
* [ ] Ordner anlegen, umbenennen, sortieren (`lms_media_folder`), gebunden an Kurs und Level.
* [ ] Video-Upload (MP4/WebM) und Präsentations-Upload (.pptx, .key, .pdf) im selben Ordner in getrennten Bereichen implementieren.
* [ ] ⚠️ Upload muss resumable erfolgen (Supabase Storage TUS-Endpoint). Fortschrittsbalken und Retry vorsehen.
* [ ] Client-seitige Vorprüfung von MIME-Type und Größe einbauen.

#### 5.4 Schüler-Ansicht für Medien (Gated Access)
* [ ] Im Kursbereich alle Ordner des freigeschalteten Levels darstellen; Videos im integrierten Player, Präsentationen als Viewer/Download.
* [ ] Zugriff ausschließlich über signierte URLs mit kurzer Gültigkeit verwalten.
* [ ] Gesperrte Level dürfen nicht einmal die Ordnernamen sehen.

#### 5.5 Lehrer-Dashboard: Analytics
* [ ] Leitner-Verteilung Phase 1–7 pro Schüler und Kurs via `components/vocabulary/PhaseDistributionChart.tsx` (wiederverwenden).
* [ ] Datenquelle: die SQL-Aggregatfunktion aus 4.2.
* [ ] Lernverlauf-Diagramm über die Zeit implementieren.
* [ ] Formular/Modal für Kurse und Kursausfälle bereitstellen.

#### 5.6 Interaktiver Schüler-Kalender
* [ ] Gebuchte Kurse und eingetragene Ausfälle für laufenden und folgenden Monat anzeigen.
* [ ] Datenquellen: `course_schedules`, `course_exceptions`, `booking_items`. `components/dashboard/ProfileMonthlyCourses.tsx` wiederverwenden.
* [ ] Zeitzone explizit `Europe/Berlin`; keine UTC-Verschiebung am Monatsrand.

#### 5.7 KI-Design-Autonomie & "Subtle Luxury" UI/UX
* [ ] Vollständige Design-Regie durch die KI als Senior UI/UX Designer unter Verwendung von Tailwind CSS, shadcn/ui, Lucide Icons und Framer Motion.
* [ ] Stilrichtung "Subtle Luxury": Modern, edel, aufgeräumt, keine knalligen Farben, viel White-Space, präzise Typografie.
* [ ] Design-System & Farbwelt: Basis aus Tiefem Slate/Dunkelblau (`#0F172A` / `slate-900`) und warmem Off-White/Hellgrau (`slate-50`).
* [ ] Marken- & Akzentfarbe: Warmes Orange (`#F97316` / `orange-500`) mit abgedunkeltem Hover-State (`#EA580C`), strikt mit WCAG-AA-Kontrast.
* [ ] Premium-Akzente: Sanfte Gold-/Warmton-Gradients, subtile Glassmorphism-Karten und sanfte Schlagschatten.

---

### PHASE 6 — E-MAIL MIT AUSFALLTAGEN & MONITORING

#### 6.1 Ausfalltermine in Bestätigungsmails
Befund: `lib/mail/templates.mjs` enthält kein Wort zu Ausfällen.

* [ ] In `schema.sql:1486` und `:152` das Payload-JSONB um `exceptions` aus `public.course_exceptions` erweitern.
* [ ] `lib/mail/templates.mjs`: Abschnitt „Feststehende Ausfalltermine" in allen fünf Locales integrieren. Leere Liste ⇒ Abschnitt wird ausgelassen.
* [ ] Staff-Mail prüfen, nicht neu bauen.
* [ ] Dedupe-Key `registration:<booking_id>` beibehalten. Bei nachträglich eingetragenem Ausfall keine erneute Bestätigungsmail, sondern eine eigene Benachrichtigung.

#### 6.2 Entkoppeltes Status-Monitoring
* [ ] Eigener Docker-Container (max. 128 MB) für Status-Monitoring (z.B. Uptime-Kuma), nicht im Next.js-Prozess.
* [ ] Überwacht Health-Check, Supabase-Container, CPU, RAM, Disk der 240 GB, Mail-Service und Outbox-Rückstau.
* [ ] Zugriff nur über nginx mit Basic-Auth; nicht öffentlich erreichbar.
* [ ] Alarm bei Disk > 80 %, RAM > 90 %, Health-Check-Fehler > 3 in Folge.

---

### PHASE 7 — SEO, RECHT & DSGVO

#### 7.0 IST-ZUSTAND
JSON-LD, OpenGraph, Twitter Cards, canonical und hreflang sind im Prinzip vorhanden. Baue das nicht neu — schließe die Löcher.

#### 7.1 Konkrete SEO-Löcher
* [ ] Kaputtes OG-Image. `/Bilder/og-sitov-academy.jpg` existiert nicht. 1200×630-Bild erzeugen und ablegen.
* [ ] `hreflang` fehlt auf allen Unterseiten. `alternates.languages` inklusive `x-default` ergänzen.
* [ ] `app/sitemap.ts`: `alternates.languages` um `x-default` erweitern.
* [ ] Hartcodierte Basis-URLs auf `CANONICAL_SITE_URL` umstellen.
* [ ] FAQPage-JSON-LD ergänzen.
* [ ] `app/[lang]/layout.tsx`: `export const dynamicParams = false` setzen, da `dynamicParams` derzeit fehlt.
* [ ] Prüfen, ob `disallow: '/registration'` in `robots.ts` gewollt ist und Entscheidung dokumentieren.

#### 7.2 Meta-Pixel — LCP-Bremse und DSGVO-Verstoß
Befund: Meta-Pixel blockiert im `<head>` vor der Einwilligung.

* [ ] Pixel aus dem `<head>` entfernen.
* [ ] Nur nach expliziter Opt-in-Einwilligung nachladen (`next/script`, `strategy="afterInteractive"`).
* [ ] Consent-Banner mit granularer Auswahl (notwendig / Marketing) implementieren.
* [ ] Das `<noscript>`-Tracking-Pixel entfällt.
* [ ] `lib/analytics/meta-pixel.ts` an den Consent-State koppeln.
* [ ] Datenschutzerklärung um Meta-Pixel und Drittlandtransfer ergänzen.

#### 7.3 Weitere Pflichten
* [ ] Supabase Auth: „Leaked Password Protection" (HaveIBeenPwned) aktivieren (`GOTRUE_PASSWORD_HIBP_ENABLED=true`). Prüfe ausgehende Rechte, andernfalls lokale Blocklist als Ersatz verwenden.
* [ ] Impressum, AGB und Datenschutzerklärung auf DSGVO-Konformität und korrekte Adressen (`.Footer.Addresses`) abgleichen.
* [ ] Keine geschützten Markennamen (z. B. Duolingo) und Lehrbuchinhalte („Schritte Plus Neu") in DB, Dictionaries oder Metadaten verwenden. Grep über `supabase/seeds/*` einbeziehen.

---

### PHASE 8 — END-TO-END-VERIFIKATION

#### 8.0 Testinfrastruktur reparieren — Vorbedingung für alles Weitere
Befund: `playwright.config.ts` läuft über Dev-Build, hat kein Mobile-Projekt und läuft nur auf Desktop Chrome.

* [ ] `webServer.command` → `npm run build && npm run start`.
* [ ] Projekte ergänzen: `devices['Pixel 7']`, `devices['iPhone 14']`.
* [ ] Authentifizierten Storage-State einrichten.
* [ ] ⚠️ Kritisch: Testnutzer für Trainer-Flows müssen eine Nicht-DE-Interface-Sprache haben (sonst blockiert `TrainerLanguageRequired`).

#### 8.1 Verifikationsmatrix — jede Zeile braucht einen grünen automatisierten Test
* [ ] **Phase 1:** Build grün nach Löschung · keine verwaisten Imports · Dictionary-Parität exakt gleich über alle fünf Sprachen · `playwright-report/` nicht mehr im Git-Index.
* [ ] **Phase 2:** Zwei Videos im selben Ordner anlegbar · Upload > 32 MB erfolgreich · Schüler ohne Level-Freigabe erhält 403 · keine Spalte namens `user_id` mehr · alle `level`-Spalten haben FK-Constraints · keine text-Wertemenge ohne Enum-Type oder FK · alle `updated_at`-Spalten haben Trigger · kein RLS-Policy-Body referenziert `user_id`.
* [ ] **Phase 3:** `accepted_answers`-Alternative ⇒ `completed = true` in DB · Tippfehler, fehlender Punkt und Kleinschreibung ⇒ `SOFT_ERROR` mit korrektem `reason` · Warntext auf Russisch bei ru-Interface · `der` → `den` wird nicht als Tippfehler toleriert.
* [ ] **Phase 4:** Gefälschter `X-Forwarded-For` ändert Rate-Limit-Key nicht · Vokabel-Session TTFB < 500 ms · `systemctl status sitov-app` zeigt keinen OOM nach 30 min Last.
* [ ] **Phase 5:** axe-core ohne jeden Filter, 0 color-contrast-Verstöße auf den relevanten Routen · Aufnahmebutton nach Scroll zum Textende `toBeInViewport()` auf Mobile.
* [ ] **Phase 6:** Registrierung für Kurs mit Ausfall ⇒ Payload enthält Datum und Template zeigt es in allen fünf Locales.
* [ ] **Phase 7:** `sitemap.xml` valide inkl. `x-default` · `robots.txt` erreichbar · JSON-LD Schema.org-valide · OG-Image liefert HTTP 200 · ohne Consent kein Request an Meta.
* [ ] **Phase 8:** `npm test`, `npm run test:e2e` und alle `supabase/tests/*.test.mjs` grün.

---

### ARBEITSABLAUF

* **S1** — Deine allererste Ausgabe ist eine kompakte Bestätigung: „Checkliste übernommen. X Punkte, davon Y [N/A]." NICHT die gesamte Checkliste kopieren — das verschwendet Output-Budget.
* **S2** — Zweite Ausgabe, vor jeder Codeänderung: ein Verifikationsbericht als kompakte Tabelle (`Datei/Tabelle/Spalte | Erwartet | Gefunden | Delta`), der für jede in der aktuellen Phase genannte Datei, Tabelle und Spalte bestätigt, ob sie existiert. Abweichungen meldest du, bevor du handelst.
* **S3** — Arbeite die Phasen strikt 1 → 8 ab. Innerhalb einer Phase gilt die Nummerierung: 2.0 blockiert 2.2–2.4 · 2.6 blockiert 3–8 · 3.1 blockiert 3.2 · 5.1 beginnt mit dem Entfernen des Test-Filters · 8.0 vor 8.1. Phasenübergreifende Abhängigkeiten: 2.2 → 5.3 · 4.2 → 5.5 · 2.0 muss vor 4.2 abgeschlossen sein.
* **S3b** — Zu Beginn jeder neuen Phase: die GRUNDREGELN R1–R11 bestätigen. Kein implizites Erinnern voraussetzen.
* **S4** — Nach jedem Meilenstein die Checkliste aktualisieren. `[x]` nur, wenn ein automatisierter Test den Punkt belegt. „Sieht richtig aus" ist kein Beleg.
* **S5** — Für jede DB-Änderung: Backup-Nachweis nach R8 mit SHA256, Rollback-SQL nach R9, dann idempotente SQL in `supabase/vps/`, dann `supabase/schema.sql` und `supabase/database.types.ts` aktualisieren. Den exakten Dump-Befehl und die Schema-Ausschlüsse selbstständig bestimmen und im Report protokollieren.
* **S6** — Für jede Speicher- oder CPU-Änderung: die vollständige Summenrechnung über alle Container plus App in den Report, mit Vorher/Nachher.
* **S7** — Am Ende müssen alle Punkte `[x]` oder mit begründetem `[N/A]` versehen sein. Ein offener Punkt ohne Begründung gilt als Fehlschlag des Gesamtauftrags.

**Verfügbare Schnittstellen:** Filesystem/GitHub MCP (Code-Analyse, DB-Refactoring, Datei-Operationen) · Playwright MCP (Desktop- und Mobile-Viewport-Tests, axe-core, Screenshots) · SSH VPS (`ssh sitov-academy`, Repo unter `/var/www/sitov-academy` — für Migrationen, Builds, Service-Steuerung).