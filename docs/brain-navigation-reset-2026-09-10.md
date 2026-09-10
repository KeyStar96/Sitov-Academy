# Gehirn, Navigation und vollständiger Lernreset

## Gehirn und Dashboard

`components/effects/neural-brain-geometry.ts` erzeugt zwei sagittale Hälften einer länglichen Großhirnform mit rundem Frontal-/Hinterhauptpol, abgeflachter Unterseite und kontinuierlicher Längsfurche. Die Grundform bleibt deterministisch, Rauschen erzeugt ausschließlich die Windungen. Eine gefaltete, weich schattierte Oberfläche unterstützt 6.400 Neuronen und rund 20.000 Verbindungen. Die obere Dreiviertelperspektive macht beide Hälften erkennbar. Der vorhandene Rhythmus (1–3 Lichtschweife alle 6–8 Sekunden), Reduced Motion, unsichtbare Pause und SVG-Fallback bleiben erhalten. Der gewählte mathematische Ansatz benötigt keine `brain.glb` oder zusätzliche Bibliothek.

`components/layout/DashboardHeader.tsx` liefert den dezenten Seitentitel als Teil der Breadcrumb. Große doppelte Einleitungsblöcke wurden auf allen regulären Dashboardseiten und in passenden Ladeskeletten entfernt. Inhaltsüberschriften bleiben erhalten. Die Grammatik verschiebt beim Aufgabenwechsel den Fokus auf die Aufgabenüberschrift. Eigenständige Fullscreen-Vokabelansichten behalten ihre notwendige eigene Navigation, während der gemeinsame Header dort ausgeblendet bleibt.

## Reset: Umfang und Oberfläche

Der Nutzer bestätigte ausdrücklich: **nur Lerndaten und Audio-Dialoge zurücksetzen; verbindliche Kursbuchungen erhalten**.

Im Profil steht direkt unter der Spracheinstellung `components/dashboard/ProfileProgressReset.tsx`. Der Button öffnet einen nativen Bestätigungsdialog mit „Bist du sicher? Alle Fortschritte und Sprachaufnahmen gehen unwiderruflich verloren.“ Erst die ausdrückliche Bestätigung ruft `app/actions/resetUserProgress.ts` auf. Alle Texte sind in DE/EN/RU/UK/TR vorhanden. Der Dialog besitzt Fokussteuerung, Escape/Abbrechen vor Ausführung, gesperrte Bedienelemente während Ausführung und ehrliche Fehler-/Erfolgsmeldungen.

| Entfernt | Erhalten |
| --- | --- |
| `user_vocabulary_progress`, `vocabulary_direction_progress` | Profil, Auth-Konto, E-Mail-Verknüpfung, Niveaurechte |
| `vocabulary_learning_state`, `vocabulary_onboarding` | Kursregistrierungen, Einschreibungen und Monatsbuchungen |
| `vocabulary_private.answer_receipts` | Rechnungskennzeichen und Zahlungs-/Kündigungsabläufe |
| `user_exercise_progress` | Gemeinsame Vokabelkarten, Grammatikaufgaben, Lesetexte und Videos |
| Eigene Einreichungen mit zugehörigem Lehrerfeedback und Chat | Dateien anderer Schüler und für andere Gespräche benötigte Lehrerclips |
| Eigene alte/neue Sprachdateien einschließlich nicht eingereichter Uploads; exklusive Audioantworten im eigenen Dialog | Gemeinsamer Referenz-TTS-Cache, Website-Assets, selbst verfasste lokale Vokabelkarten |

Browserseitig werden Lernkastenauswahl und Vokabel-Autostart entfernt. `lib/learning-reset-events.ts` und `components/layout/LearningResetSync.tsx` benachrichtigen nur andere Tabs desselben Kontos; diese laden neu und verwerfen damit alte aktive Trainingseinheiten. Der auslösende Tab behält die Erfolgsmeldung. Gespeicherte Designs, Auth-Sitzung und Spracheinstellungen werden nicht gelöscht.

## Backend und Fehlerfälle

Die Server Action nimmt ausschließlich `{ confirmation: 'RESET_LEARNING_DATA' }` an. Die Nutzeridentität kommt aus `auth.getUser()` und in PostgreSQL aus `auth.uid()`; es gibt keinen vom Browser auswählbaren Zielnutzer. Öffentliche RPCs laufen als `SECURITY INVOKER`, ihre privaten Implementierungen prüfen Identität/Token und verwenden einen leeren `search_path`. Anonyme Aufrufe und direkte Zugriffe auf Reset-Tabellen sind ausgeschlossen.

1. `begin_learning_reset` legt einen internen Vorgang an oder setzt einen bereits offenen fort. Es erfasst geprüfte Objektidentitäten aus `audio_submissions` und `pronunciation_audio`. Ein beliebiger gespeicherter Schüler-URL ist kein Eigentumsnachweis. Geteilte Lehrerdateien werden anhand weiterer Dialogreferenzen erkannt und erhalten.
2. `learning_reset_audio_batch` liefert höchstens 500 noch vorhandene Objekte. `lib/reset-user-progress.ts` löscht diese über `storage.from(bucket).remove(paths)`. SQL löscht **keine** Storage-Metadaten; nur die API entfernt auch die tatsächlichen Dateien. Referenz: [Supabase Storage-Löschung](https://supabase.com/docs/guides/storage/management/delete-objects), [Storage-Schema](https://supabase.com/docs/guides/storage/schema/design).
3. `finish_learning_reset` prüft, dass die erfassten Dateien tatsächlich entfernt wurden. Erst danach löscht eine Datenbanktransaktion sämtliche betroffenen Lerndaten. Fehler rollen diese Transaktion vollständig zurück. Alte Referenzen anderer Nutzer werden gezielt entkoppelt, damit ein FK-Cascade deren Einreichungen nicht mitlöscht.

Laufende Vorgänge sperren Lernschreibvorgänge und neue Uploads des Nutzers. Audioverweise sowie Änderungen vorgemerkter Dateien werden währenddessen serialisiert/abgewiesen, damit eine neu geteilte oder umbenannte Datei nicht unbemerkt gelöscht wird. Gleichzeitige SQL-Deadlocks werden höchstens zweimal wiederholt. Die Action begrenzt sich außerdem auf 100 Durchläufe bzw. ein Zeitbudget von 20 Sekunden zwischen Aufrufen; verbleibende Dateien können mit erneutem Bestätigen weiter bearbeitet werden.

Storage und PostgreSQL besitzen keine gemeinsame Transaktion. Deshalb können bei einem Fehler bereits einige Dateien unwiderruflich entfernt sein. Der Vorgang bleibt erhalten, die Oberfläche behauptet keinen vollständigen Erfolg und fordert zur Wiederholung auf. Nach erfolgreich abgeschlossenem Reset kann wieder neu gelernt werden. Das erneute Finalisieren desselben abgeschlossenen Tokens löscht keine später hinzugekommenen Lerndaten.

## Live-Stand und Prüfung

Migration `supabase/migrations/20260910195205_complete_learning_reset.sql` wurde ausschließlich im gebundenen Projekt `wcaslabeiwtvygxtzcio` angewendet. `supabase/schema.sql` und die neu generierten `supabase/database.types.ts` sind synchron.

**Kein produktiver Account wurde zurückgesetzt.** Beide internen Reset-Tabellen sind leer. Vorher-/Nachher-Anzahlen und Prüfsummen stimmen überein: 6 Profile, 84 Registrierungen, 112 Einschreibungen, 7 Einreichungen, 924 Richtungs-Lernstände, 66 Storage-Dateien.

- 909 Jest-Tests in 64 Suiten bestanden, einschließlich neuer Server-Action-, Storage-Orchestrierungs-, Dialog- und Cross-Tab-Tests.
- 119 isolierte PostgreSQL-Tests bestanden, davon 14 zum neuen Reset. Enthalten sind fremde Tokens/Dateien, gemeinsame Lehrerclips, manipulierte URLs, Wiederaufnahme nach Teilfehler, atomarer Rollback, 1.001 Audiodateien, Schreibsperren und alte zyklische Elternverknüpfungen.
- Produktionsbuild inklusive TypeScript erfolgreich; Build-Verbindungen verwendeten Dummy-Backendwerte. `git diff --check` ohne Befund.
- Sieben deterministische Geometriechecks erfolgreich. Echter Chrome/WebGL-Test für beide Themes, mobile Breiten, Impulstakt, Reduced Motion, Offscreen-Pause und erzwungenen Context-Loss mit SVG-Fallback erfolgreich.
- 48 Layoutprüfungen bei 320/390/1280px in beiden Themes und 24 zusätzliche Sprachprüfungen bestanden; genau eine sichtbare dezente Seitenüberschrift in regulären Ansichten. Aktive Grammatik und Fullscreen zusätzlich geprüft.
- Bestätigungsdialog in Chromium und WebKit bei 320px in allen fünf Sprachen und beiden Themes geprüft (20 Ansichten). Abbrechen/Escape lösen keinen Reset aus; während der Anfrage bleibt der Dialog gesperrt. Erfolg bleibt im auslösenden Tab sichtbar, ein zweiter Tab desselben Kontos lädt automatisch neu.

Geschützte UI-Tests verwenden echte Komponenten mit synthetischen Daten und simulierten Server-Actions. Die getrennten PostgreSQL-Tests führen echte Migrationen und Funktionen in einer isolierten Datenbank aus. Kein Browser- oder Datenbanktest löschte echte Schülerdaten. Die Website wurde nicht veröffentlicht.

Die Supabase-Sicherheitsprüfung meldet keine zusätzlichen Warnungen gegenüber dem vorherigen Stand. Zwei neue interne Tabellen ohne API-Grants besitzen absichtlich keine Nutzerpolicies; sie werden als Informationshinweis geführt. Die bestehenden Hinweise zur älteren Feedback-Funktion und deaktivierter Prüfung kompromittierter Passwörter bleiben unverändert. Referenzen: [interne RLS-Tabellen](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [Funktionsrechte](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [Passwortschutz](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
