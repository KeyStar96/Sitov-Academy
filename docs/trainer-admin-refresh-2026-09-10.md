# Trainer- und Verwaltungsumbau — 10. September 2026

## Ergebnis und wichtigste Einstiegspunkte

| Bereich | Umsetzung | Code |
| --- | --- | --- |
| Vokabeltrainer | Bestehende Sechs-Phasen-Logik geprüft; Erklärung in fünf Sprachen ergänzt | `components/vocabulary/VocabTrainerPageClient.tsx`, `lib/leitner.ts`, `lib/vocabulary-i18n.ts` |
| Grammatik | Themen, Zehner-Sitzungen, hilfreiche Wiederholungen, 600 neue Übungen, Lehrer-CMS | `components/exercises/ExerciseClient.tsx`, `components/admin/ExerciseCMS.tsx`, `app/actions/grammar-cms.ts`, `app/actions/exercises.ts` |
| Aussprache | 60 Lesetexte, Hörvorbild, Waveform-Aufnahme, private Dialoge mit Text-/Sprachnachrichten, Lehrer-CMS | `components/audio/PronunciationPractice.tsx`, `PronunciationConversation.tsx`, `PronunciationInbox.tsx`, `components/admin/PronunciationCMS.tsx`, `app/actions/pronunciation-conversations.ts` |
| Lernvideos | Ruhiger Leerzustand, später ausschließlich geprüfte YouTube-Links | `components/dashboard/VideoLibrary.tsx`, `components/admin/VideoCMS.tsx`, `lib/video-links.ts` |
| Login | Academy-Design, Homepage-Link, generische Registrierungsrückmeldung | `components/auth/AuthShell.tsx`, `app/[lang]/login/page.tsx`, `app/[lang]/register/page.tsx`, `app/actions/auth.ts` |
| Bestandsprofile | Serverseitig bestätigte E-Mail-Inhaberschaft, eindeutige Verknüpfung, verfügbare Stammdaten und gebuchte Kurse | `lib/profile-legacy.ts`, `lib/profile-course-history.ts`, `components/dashboard/ProfileCourseHistory.tsx` |
| Annahmen/Rechnungen | Neue Registrierungen mit Kontaktdaten/Kursen; Pending → Confirmed; manuelle Monatsrechnung offen/erstellt | `components/admin/RegistrationDesk.tsx`, `app/actions/admin-registrations.ts`, `lib/admin-invoice-queue.ts` |
| Datenschutz/AGB | Neue Funktionen und korrigierte Anbieterangaben in allen fünf Sprachen | `dictionaries/{de,en,ru,uk,tr}.json`, `app/[lang]/{privacy,agb}/page.tsx` |

Die sechs bereits unterstützten Kursstufen sind **A1.1, A1.2, A2.1, A2.2, B1.1, B1.2**. Jede erhält 100 neue Grammatikaufgaben und zehn neue zusammenhängende Lesetexte. Vorhandene Inhalte werden nicht ersetzt. Vokabeln bleiben über das bestehende Vokabel-CMS erweiterbar; Grammatik und Aussprache besitzen nun entsprechend ausgebaute Verwaltungsansichten. Die Videolinks können ebenfalls im Lehrerbereich gepflegt werden.

## Was beim Karteikasten wirklich passiert

Lokaler Helfer `lib/leitner.ts` und die produktive PostgreSQL-Funktion `vocabulary_private.submit_answer` stimmen überein:

1. Richtig beantwortet: eine Phase weiter. Falsch beantwortet: eine Phase zurück, mindestens Phase 1.
2. Nach Eintritt in die Phasen 2–6 beträgt der reguläre Abstand 1, 3, 9, 29 bzw. 90 Tage. Bei sechs aufeinanderfolgenden richtigen Wiederholungen ab Phase 1 sind das nominal insgesamt 132 Tage. Als schwierig markierte Karten bei RU/TR verwenden die vorhandene verkürzte Variante (halber Abstand, abgerundet, mindestens ein Tag).
3. Phase 6 ist die letzte aktive Wiederholungsphase. Erst ihre richtige Antwort setzt die Richtung auf den internen Abschlusswert `box=7`.
4. Beide Richtungen werden unabhängig gespeichert. Das ganze Wort zählt erst als gelernt, wenn beide abgeschlossen sind.
5. Bei der Ersteinstufung bedeutet „Kenne ich“: beide Richtungen starten in Phase 6 und sind regulär nach 90 Tagen fällig. Das Wort ist dadurch noch nicht gelernt. „Noch nicht“ startet bei Phase 1, sofort fällig.
6. Fälligkeit, Eigentümer und Zugriffsrechte werden in der Datenbank geprüft. Ein wiederholter Request-Beleg bewertet eine Antwort nicht doppelt. Dieser Umbau setzt keinen Lernfortschritt zurück.

Das entspricht dem veröffentlichten Grundprinzip von [phase6](https://www.phase-6.de/help/knowledge-base/phase6-systematik/) und dessen [Intervallbeschreibung](https://www.phase-6.de/presse/classic-lernen/?PageSpeed=noscript); es ist keine Zusicherung dauerhaft fehlerfreien Erinnerns und keine Aussage über eine Markenpartnerschaft.

## Schutz bestehender Schülerdaten

Die öffentliche Kursanmeldung darf keine Bestandsdaten durch ungeprüfte E-Mail-, Namens- oder Geburtsdatumsangaben überschreiben. Neue Angaben werden deshalb als Anmeldungssnapshot gespeichert. Die Plattform-Registrierung gibt nach außen einen generischen Bestätigungshinweis aus.

Erst nach erfolgreicher Anmeldung mit bestätigter E-Mail versucht `claim_verified_legacy_profile` die Zuordnung. Die Funktion übernimmt weder eine E-Mail noch eine Personen-ID aus dem Browser, sondern liest die Identität aus Supabase Auth. Sie benötigt genau einen passenden Altbestand, der noch nicht einem anderen Profil gehört. Mehrdeutige gemeinsam genutzte E-Mail-Adressen bleiben ohne automatische Zuordnung. Vorhandene dauerhafte Verknüpfungen bleiben erhalten. Ausfüllbare Profilfelder sind von Rollen, Niveaurechten und Verknüpfungs-IDs getrennt; eigene direkte Rollen-/Rechteänderungen sind ausgeschlossen.

Die Live-Einstellung `mailer_autoconfirm=false` wurde gelesen: Neue Konten müssen ihre E-Mail bestätigen. Es wurden keine echten Auth-Konten für Tests angelegt und keine Bestätigungsnachrichten ausgelöst.

## Lehrerablauf und private Sprachdialoge

- Unter `/{lang}/admin/registrations` die Anmeldung und verfügbaren Angaben/Kurse prüfen und annehmen. Erst die erfolgreiche Serverantwort setzt die Oberfläche auf bestätigt.
- Unter `/{lang}/admin/invoices` den Rechnungsmonat auswählen (standardmäßig Folgemonat), offene Personen abarbeiten, Rechnung manuell in Papierkram schreiben und anschließend „Rechnung erstellt“ mit optionaler Referenz setzen. Der Status lässt sich korrigieren. Es wird keine Rechnung automatisch erstellt/versendet und kein Zahlungseingang behauptet.
- Die Warteschlange vereinigt aktive Kurse einer Person. Explizite Monatswahl bzw. Pause verdrängt automatische Übernahme aus Altanmeldungen. Bereits erstellte Kennzeichen bleiben bei späteren Änderungen auffindbar; Doppelkennzeichen pro Person/Monat werden serverseitig blockiert.
- Im Aussprachetrainer einen Text wählen, Hörvorbild anhören, selbst aufnehmen und absenden. In `/{lang}/admin/submissions` erhält die Lehrkraft die Aufnahme mit unveränderlichem Text-Snapshot. Beide Seiten können danach beliebig weitere Text- oder Sprachnachrichten im Gespräch senden. Neue Nachrichten erscheinen bei Fensterfokus und spätestens beim nächsten sichtbaren 30-Sekunden-Abgleich.
- Neue Audiodateien werden unveränderlich in Eigentümerordnern des privaten Buckets `pronunciation_audio` gespeichert, maximal 25 MiB. Leserechte gelten nur für beteiligte Lernende und Lehrkräfte. Signierte Wiedergabelinks gelten eine Stunde. Vorhandene historische Aufnahmen/Feedback bleiben erhalten; alte öffentliche Audiodateien wurden in diesem Auftrag nicht nachträglich umgezogen.

## Datenbank-Rollout und Bestandserhalt

Ausschließlich im gebundenen Projekt `wcaslabeiwtvygxtzcio` angewendet:

1. `20260910184129_secure_registration_manual_invoicing.sql`
2. `20260910184438_pronunciation_reading_conversations.sql`
3. `20260910184937_grammar_curriculum_and_progress.sql`
4. `20260910185640_guard_duplicate_manual_invoices.sql`
5. `20260910190121_learning_audio_and_trigger_hardening.sql`
6. `20260910190329_grammar_curriculum_proofread.sql`

Die letzten Inhaltskorrekturen vergleichen vor dem Update den ursprünglichen Seed-Inhalt; unabhängig bearbeitete Lehrerinhalte werden nicht überschrieben. `supabase/schema.sql` und die aus dem Live-Projekt generierten `database.types.ts` sind synchron. Audio-Cache: maximal 3.000 Zeichen pro Referenztext und 2 MiB pro Datei.

Vorher/Nachher-Prüfsummen über die bestehenden Spalten sowie Zeilenzahlen stimmen überein: **78 Benutzer, 6 Profile, 84 Registrierungen, 112 Einschreibungen, 924 richtungsbezogene Vokabelfortschritte, 6 Einreichungen und 2 Lehrerfeedbacks**. Auch die 462 älteren Vokabelfortschritte und die vorhandene Monatsbuchung bleiben bestehen. Es wurden keine echten Anmeldungen angenommen, Nachrichten versendet oder Rechnungskennzeichen testweise gesetzt.

## Rechtstexte und Grenzen

Datenschutz erläutert Lernkonto/-fortschritt, E-Mail-Nachweis, private neue Aufnahmen, Nachrichten, Referenz-TTS, externe Videolinks und zweckgebundene Aufbewahrung. Schüleraufnahmen werden durch diese Implementierung nicht an den TTS-Anbieter geschickt. Die AGB ergänzen digitale Lernangebote und die manuelle Vorkasserechnung. Die Marketingformulierung „einfach nicht zahlen“ wurde in allen fünf Sprachen ersetzt; bestehende Kündigungs-/Vertragsregeln werden nicht stillschweigend geändert.

Hosting wurde von der veralteten IONOS-Angabe auf Netlify korrigiert; Papierkram nennt nun die aktuelle Betreiberfirma. Der reguläre Aufbewahrungswert für Buchungsbelege wurde von pauschal zehn auf acht Jahre korrigiert, mit Vorbehalt abweichender gesetzlicher Fristen. Quellen: [Netlify Datenschutz](https://www.netlify.com/privacy/), [Netlify DPA](https://www.netlify.com/pdf/netlify-dpa.pdf), [Papierkram Impressum](https://www.papierkram.de/impressum/), [§257 HGB](https://www.gesetze-im-internet.de/hgb/__257.html), [DSGVO](https://eur-lex.europa.eu/legal-content/DE/ALL/?uri=celex%3A32016R0679).

Die Texte benötigen eine abschließende juristische Freigabe und Abgleich mit den tatsächlich abgeschlossenen Anbietervereinbarungen, den bestehenden Teams-/Kündigungsregeln und der praktischen Löschorganisation. Dieser Auftrag ergänzt keine automatische Löschroutine und zertifiziert keine Rechtskonformität.

Supabase-Advisors wurden gelesen. Bestehende Hinweise auf deaktivierte Prüfung kompromittierter Passwörter sowie Legacy-RLS-/Indexoptimierungen sind kein behobener Bestandteil dieses Auftrags; Hinweise zu ausschließlich intern beschreibbaren privaten Tabellen ohne Nutzerpolicies sind beabsichtigt. Referenzen: [Passwortschutz](https://supabase.com/docs/guides/auth/password-security), [RLS-Optimierung](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select), [Indexhinweise](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys). Keine destruktive Bereinigung oder globale Wartung wurde ausgeführt.

## Validierung

- **Produktionsbuild:** `next build` inklusive TypeScript-Prüfung erfolgreich. Für den Build wurden ausschließlich lokale Dummy-Backendwerte verwendet, damit die Prerender-Prüfung keine privaten Produktivdaten benötigt.
- **Jest:** 60 Testsuiten, **871 Tests bestanden**. Enthalten sind Auth-/Profilzuordnung, Rechnungslisten, Inhaltsvalidierung, UI-Speicherung, private Audionachrichten, bestehende Vokabelregeln sowie Recorder-Lebenszyklus.
- **Isoliertes PostgreSQL:** **105 Tests bestanden**, darunter Eigentümer-/Niveauprüfung, Rollenrechte, bestätigte Identität, gesicherte Fortschrittsänderungen, Gesprächsteilnahme, Audiozugriff und Schutz gegen doppelte Rechnungskennzeichen. Aufruf: `node --test supabase/tests/*.test.mjs`.
- **Browser:** Reale neue Komponenten mit synthetischen Daten in Chromium bei 390px und 1280px in Light-/Darkmode geprüft; sieben Ansichten zusätzlich mobil in WebKit. Kein horizontaler Überlauf oder Seitenfehler. Fünfsprachige Login-Routen ebenfalls mit Homepage-Link und ohne Überlauf geprüft.
- **Interaktionen:** Text auswählen, aufnehmen und einreichen; Lehrer- und Schüler-Sprachnachrichten aufnehmen/senden; Textantwort; Grammatik lösen; Anmeldung annehmen; Rechnung mit Referenz markieren; gültiger externer YouTube-Link ohne Player. Die Server-Actions waren in diesen UI-Prüfungen simuliert, während die getrennten PostgreSQL-Tests echte Funktionen/RLS mit isolierten Datensätzen prüfen.
- **Wiedergabe:** Vorhandene Chat-Aufnahmen starten in Chromium und WebKit nach einem Klick; die native Audiozeit läuft und das Audioelement ist nicht pausiert.
- **Recorder:** Browserprüfung mit erzeugtem Web-Audio-MediaStream, echtem `MediaRecorder`, echter Waveform und WAV-Konvertierung. Die resultierenden Dateien sind nicht leer, dem richtigen Text zugeordnet und alle Capture-Tracks werden beendet. Regressionen decken nie aufgelöste `AudioContext.resume()`-Promises, ausfallende Visualisierung, schnelles Doppelklicken und Freigabe nach Unmount ab. Die native Fake-Geräte-Erfassung des Test-Chromiums blieb bereits in `getUserMedia` hängen; ein physisches Mikrofon/iPhone wurde nicht geprüft. Diese Einschränkung wird nicht als bestandener Gerätetest ausgegeben.
- **Bestand/Synchronität:** Live-Anzahl-/Prüfsummenvergleich ohne Veränderungen am Altbestand; generierte Typen bytegleich zum Live-Export; `git diff --check` ohne Befund.

Die lokale Vorschau läuft auf Port 3000. Eine ignorierte `.env.local` enthält ausschließlich lokale Site-URL und öffentlichen Supabase-Projektzugang; der für bestimmte Lehrer-/Audio-Serveraktionen vorhandene Service-Role-Umgebungswert muss im ausführenden Deployment weiterhin gesetzt sein. Es wurde kein privilegierter Schlüssel ins Repository aufgenommen. Der Frontend-Stand wurde nicht veröffentlicht.
