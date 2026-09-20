# Phase 5.1–5.6 — UI, Medien, Analytics und Kalender

Stand: 20.09.2026. Umsetzung und Abnahme laufen. Phase 5.7 gehört nicht zur aktuellen Freigabe.

## Bestandsprüfung vor Änderungen

| Datei / Tabelle / Spalte | Erwartet | Gefunden | Delta |
|---|---|---|---|
| `e2e/accessibility.spec.ts` | Ungefilterte Kontrastprüfung | Alte Whitelist entfernt, aber weiterhin Filter auf Regel-IDs | Sämtliche Axe-Ergebnisse ungefiltert prüfen |
| `app/globals.css`, `__tests__/appearance-contrast.test.ts` | Light/Dark, Text 4,5:1, Borders 3:1 | Tokens/Warning-Paar vorhanden; normale Border-Kontraste und Dark-Akzenttext unzureichend | Palette, Hover und Quellcode-Regel ergänzen |
| `PronunciationPractice`, `AudioRecorder` | Mobile Aufnahme immer erreichbar | Recorder vorhanden, keine Sticky-Leiste | Eine mobile Leiste, Safe-Area, gemessene Platzreserve |
| `app/[lang]/admin/content/media/page.tsx`, `MediaFolderCMS` | Neue Medienverwaltung | Noch nicht vorhanden | Beauftragte neue Dateien anlegen |
| `lms_media_folder` | `folder_id`, `level`, `course_id`, `title`, `sort_order` | Vorhanden mit RLS, FKs und Triggern | Bestehendes Modell wiederverwenden |
| `learning_videos`, `lms_presentation_asset` | Ordner, Storage-Pfad, MIME/Größe | Vorhanden mit serverseitiger Validierung | Atomaren Upload-Abschluss ergänzen |
| `course-assets`, `/api/course-assets` | Privater Bucket, kurzlebige Links | 512 MiB, 20 GiB je Level, Storage-RLS, 60-Sekunden-Links vorhanden | TUS-Client, Viewer und Attachment-Download |
| `get_all_students_progress_data()`, `PhaseDistributionChart` | SQL-Aggregat und Leitner-Chart | Vorhanden; bisher Prozentwerte bzw. einzelne Karten | Additive Detail-RPC und aggregierte Chart-Daten |
| `CourseCMS`, `/admin/courses`, Ausfall-RPCs | Kurs-/Ausfall-Formulare | Vollständig vorhanden | Im Analytics-Bereich wiederverwenden/verlinken |
| `ProfileMonthlyCourses`, `profile-month.ts` | Schülerkurse, Berlin-Monatsgrenzen | Buchungsformular und Monatslogik vorhanden | Interaktiven Tageskalender integrieren |
| `course_schedules`, `course_exceptions`, `booking_items` | Kalenderquellen | Vorhanden, Buchungen mit Eigentümer-RLS | Sessiongebundener, paginierter Loader |

## Umsetzung

- Kontrast: zentrale Orange-Tokens, dunklere Hoverfarben, Weiß bzw. `#0F172A` als Akzentvordergrund. Light/Dark und beide Hochkontrastvarianten werden geprüft. Axe entfernt weder Regeln noch Knoten/Verstöße; die Registrierung wird nach Abschluss ihrer Einblendung geprüft. Verschachtelte `main`-Elemente in Kündigung und Admin-Layout korrigiert.
- Aufnahme: unter 1024 px eine `sticky bottom-0 z-40`-Leiste mit iOS-Safe-Area; ResizeObserver reserviert den tatsächlichen Platz. Touchziele mindestens 56 × 56 px. Während Mikrofonanfrage/Aufnahme bleibt der Textwechsel gesperrt. Ein im echten Schülerzugriff erkannter mehrdeutiger PostgREST-Join auf Lernlevel verwendet jetzt ausdrücklich `learning_units_level_fkey`.
- Medien: Lehrer ordnen Ordner Kurs/Niveau zu, benennen sie um und sortieren sie. Videos und Präsentationen erscheinen getrennt. Browserprüfung für MP4/WebM/PDF/PPTX/KEY, maximal 512 MiB. Office-Dateien mit generischem Browser-MIME werden auf den vorhandenen MIME-Katalog normalisiert; Datenbank/Storage prüfen den gespeicherten Typ und die Größe.
- TUS: lokal gebündelter `tus-js-client` 4.3.1, 6-MiB-Chunks, eigener Supabase-Endpoint, persistente Identität je Benutzer/Ordner/Datei, Pause, Wiederaufnahme nach Reload, begrenzter Retry mit Backoff, Token-Erneuerung. Upload-Adressen werden auf die eigene konfigurierte API begrenzt. Der atomare RPC-Abschluss erzeugt keine doppelten Medien oder verwaisten Lernlektionen bei Fehlern.
- Schülerzugriff: RLS auf Ordnern, Assets und Storage; gesperrte Namen werden nicht ausgeliefert. Integrierter Videoplayer/PDF-Viewer, native Downloads für Präsentationen; 60-Sekunden-Links, erneute Berechtigungsprüfung bei offenem Viewer. Keine externen Viewer oder Konvertierungsdienste.
- Analytics: bestehende Phase-4-RPC bleibt erhalten; zusätzliche Überladung für Schüler/Kurs. Leitner-Phasen aus SQL, ein Wort ist erst bei Phase 7 in beiden Richtungen gelernt. Die Zeitreihe zeigt tatsächliche Vokabel-Antwortbelege der letzten 30 Berliner Kalendertage, einschließlich serverseitiger Bewertung. Sie ist ausdrücklich keine erfundene historische Phasenentwicklung. Kurse desselben Niveaus teilen den Lernstand; Kurse ohne Lernniveau erhalten einen erklärten Leerzustand.
- Kalender: aktueller und folgender Monat, Buchungen, echte Wochentermine, Probeunterricht und Ausfälle mit Gründen; Tagesfilter und Monatswahl. Alle fünf Sprachen, Eigentümerabfragen, paginierte Daten, explizite `Europe/Berlin`-Berechnung einschließlich Sommerzeit und Monatswechsel.

## Bisherige automatisierte Nachweise

| Prüfung | Ergebnis |
|---|---|
| Vollständige Jest-Reihe mit aktivierter Live-Integration | 111 Suites / 1.356 Tests bestanden; einschließlich sechs Viewer-Regressionen |
| Vollständige Datenbank-Testreihe auf VPS | 314/314 bestanden, keine übersprungen; `/root/phase5-db-tests.log` |
| Deployment-/Migrationsrunner-Tests | 34/34 bestanden |
| TypeScript und lokaler Produktionsbuild | Bestanden |
| PostgreSQL-15.8-Klon | Migrationen 11/12 wiederholt ausgeführt; inverse Drops in einer zurückgerollten Transaktion geprüft, bestehende No-Arg-RPC erhalten |
| Browser | 34 eindeutige Fälle bestanden: 18 öffentliche Axe-Prüfungen, 6 Analytics, 6 Kalender, 4 mobile Aufnahmefälle; Desktop Chrome, Pixel 7 und iPhone 14, Light/Dark |
| Produktiver Browser-TUS-Test | Vorbereitet: 35 MiB, Pause/Reload/HEAD-Fortsetzung, Netzwerkabbruch/Retry, Download-Hash und Gated Access |

Der vorhandene Testklon hatte die Phase-4-Migrationen zunächst noch nicht. Vor der endgültigen Analytics-Browserprüfung wurden 08–10 nachgezogen und der isolierte PostgREST-Schemacache aktualisiert. Dies war ein Testinfrastruktur-Befund; Produktion besaß die ursprüngliche Aggregate-RPC bereits.

Der vollständige Browserlauf bestand zunächst mit 32/34 Fällen. In den zwei WebKit-Aufnahmefällen wurde der Mikrofon-Mock vom nativen MediaDevices-Wrapper verworfen. Nach Korrektur des Mocks am Prototyp bestanden alle vier mobilen Aufnahmefälle erneut; Anforderungen und Assertions blieben unverändert. Logs: `/tmp/sitov-phase5/browser-final.log` und `/tmp/sitov-phase5/browser-recording-final.log`.

## R7–R9 / Backups und Rückweg

Vor der ersten Teständerung auf dem VPS:

- Backup `/root/backups/sitov-migration-20260920T160858810874Z`.
- PostgreSQL-SHA256 `3cddcc9c3285da67fea92ff2428f5dc20877f4b18491feb01831effa2fe8e2cd`.
- Storage-Manifest-SHA256 `0c1745b09505bab01a1b28fb184488ba44d52af9331a1f61f1976bbb1a6331c2`; alle 392 Objekte gesichert.
- Weitere Runner-Backups unmittelbar vor den Klonmigrationen: `161604397159Z`, `162658425058Z`, `162800009428Z`.

Neue idempotente DDL: `11_teacher_analytics.sql`, `12_media_upload.sql`; der Runner übernimmt Transaktionen. Beide APIs besitzen Staff-Prüfung, leeren `search_path`, eingeschränkte EXECUTE-Rechte und strukturierte JSONB-Fehler. Keine neuen Wertemengen-Constraints, keine Änderung der Bewertungslogik.

Rollback: vorherige App aktivieren und ausschließlich die beiden additiven Funktionssignaturen wie am Ende der Migrationen dokumentiert entfernen. Bestehende RPCs, Medienmetadaten, Storage-Objekte und Lernstände bleiben erhalten. Die inverse DDL wurde im echten Klon geprüft.

Produktionsbackup, Release-ID sowie finaler Produktionsdump/Typenexport werden nach dem Rollout hier ergänzt. Schema-Ausschlüsse: Supabase-verwaltete `auth`, `storage`, `realtime`, `extensions`, `graphql`, `vault`, `cron`, `net` und Migrationshistorie. Exporter: `deploy/vps/export-phase2-schema.py`.

Ressourcen: keine Änderungen an RAM-/CPU-/Heap-Grenzen, keine neuen Laufzeitdienste. Temporäre Browser-/Auth-/REST-Prüfungen verwenden ausschließlich den eigenen VPS bzw. lokale Browser. Backups bleiben rootgeschützt; Testkonten und Testdateien werden entfernt.

Implementierungsreferenz: [Supabase TUS-Dokumentation](https://supabase.com/docs/guides/storage/uploads/resumable-uploads); eigene geprüfte Storage-Installation statt Cloud-Endpunkt.
