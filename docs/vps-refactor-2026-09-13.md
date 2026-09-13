# VPS-Refactor — Sitov Academy, 13. September 2026

## Status und Geltungsbereich

**Die normalisierte Migration ist live angewendet. Der eigene VPS ist über [https://217.154.228.254](https://217.154.228.254) erreichbar; zentrale Auth-, Verwaltungs- und Trainerabläufe sind dort geprüft.** Die Chat-Nachlade-/Wiedergabekorrektur ist live bestätigt, Testkonten samt Aufnahmen wurden gesichert und entfernt, der regelmäßige Mailworker ist aktiviert.

Der Auftrag ersetzt die bisherige Cloud-Supabase-/Vercel-Architektur durch den eigenen VPS. Die zuletzt erlaubte lesende Cloud-Orientierung wurde nicht genutzt; es wurden für diesen Umbau keine Cloud-Zugriffe durchgeführt. Die produktiven Änderungen betreffen ausschließlich den eigenen VPS. Frühere Projektdokumente und Migrationen bleiben als Historie erhalten; ihre Cloud-Bindings, Webhooks und Deployment-Anleitungen sind keine Betriebsanweisung für den VPS.

Der freigegebene Neustart der Schülerdaten wurde nach vollständiger Sicherung ausgeführt. Zwei Staff-Konten blieben erhalten; temporäre Konten und Aufnahmen aus der anschließenden Live-Prüfung werden noch bereinigt. Der Unterrichtskatalog und das vorhandene Design werden übernommen. Die einmalige Bereinigung von Schülerkonten und Geschäfts-/Lerndaten ist vom regulären individuellen Lernreset zu unterscheiden.

## Betrieb auf dem VPS

| Bereich | Neuer Betriebsweg |
| --- | --- |
| Host und Einstieg | VPS `217.154.228.254`, HTTPS über `https://217.154.228.254`; DNS unverändert |
| Zertifikat | Vertrauenswürdiges Let's-Encrypt-IP-Zertifikat, ungefähr sieben Tage; `sitov-cert-renew.timer` prüft etwa alle zwölf Stunden. `certbot renew --dry-run` erfolgreich |
| Proxy | Bestehender Traefik-Proxy mit IP-Router, lokaler Nginx-Verteilung und HTTPS-Weiterleitung |
| Anwendung | `sitov-app.service`, Benutzer `sitov`, Next.js auf `127.0.0.1:3000`; unveränderliche Releases und aktiver Symlink, kein PM2 |
| Backend | Eigener Supabase-Docker-Stack mit PostgreSQL, Auth, PostgREST und privatem Storage; interne Ports an Loopback gebunden |
| Anwendungsmail | Nativer Outbox-Worker übergibt an Postfix auf `127.0.0.1:25`; `--once` bis `sent` geprüft, `sitov-mail.service` aktiviert und laufend |
| Auth-Mail | GoTrue verwendet den lokalen Host-SMTP-Zugang auf Port `2525` aus dem Docker-Netz; kein öffentlicher Relay-Zugang |
| Sprachsynthese | `sitov-tts.service`, lokaler Dienst auf Loopback-Port `9070`; Piper für DE/EN/RU/UK, eSpeak-NG für TR |
| Rate-Limits | Lokale PostgreSQL-Zähler mit Ablaufzeit; kein Upstash-Aufruf |
| Hintergrundaufgaben | Lokaler Mailworker, Zertifikats-Timer und reine SQL-Bereinigung abgelaufener Rate-Limits; alte Cloud-HTTP-Jobs entfernt |

Konfiguration und Dienstdateien liegen in [deploy/vps](../deploy/vps). Geheimnisse gehören ausschließlich in geschützte VPS-Konfiguration, beispielsweise `/etc/sitov-academy/app.env`, nicht in diese Dokumentation. Der App- und Mail-Dienst dürfen nur lokale Netzziele erreichen. Eine Auth-Mail wurde über den lokalen SMTP-Pfad an einen lokalen Testempfänger zugestellt und ihr Token bestätigt. Ein nativer Outbox-Worker-Lauf mit `--once` erreichte `sent`. Es wurden keine externen Testmails versendet; daraus folgt kein Zustellnachweis für externe Postfächer. Eine reine Outbox-Annahme ist weiterhin vom SMTP-Versand zu unterscheiden.

Piper-Modellversionen und Prüfsummen sind in [tts-models.json](../deploy/vps/tts-models.json) festgehalten; Lizenzhinweise stehen in [TTS_LICENSES.md](../deploy/vps/TTS_LICENSES.md). Die türkische eSpeak-Stimme kann hörbar von Piper abweichen. Alte Referenz-Audio-Links wurden bereinigt; Hörvorbilder werden bei Bedarf lokal neu erzeugt. Persönliche Schüleraufnahmen werden nicht als Sprachsynthese behandelt.

## Erhaltener Katalog

Die folgenden Inhaltszahlen wurden nach der Migration live geprüft. Sie beschreiben den erhaltenen Unterrichtskatalog, nicht temporäre QA-Daten.

| Bestand | Anzahl | Bedeutung |
| --- | ---: | --- |
| Vokabelkarten | 512 | Bestehende IDs, deutsche Wörter, Übersetzungen und Beispielsätze erhalten |
| Grammatikübungen | 604 | Bestehende Aufgaben und Lösungs-/Alternativdaten erhalten |
| Aussprachetexte insgesamt | 149 | Einschließlich historischer, nicht aktiver Texte |
| Aktive Aussprachetexte | 60 | Zehn Texte je bestehender Kursstufe |
| Aktive Kurse | 10 | Öffentlicher buchbarer Katalog |
| Archivierte Kurse | 2 | Für Verwaltung und Historie erhalten |
| Lernstufen | 6 | A1.1, A1.2, A2.1, A2.2, B1.1, B1.2 |
| Staff-Konten | 2 | Vom freigegebenen Schüler-Neustart ausgenommen |

Die allgemeine Marketingaussage A1–C2 erweitert nicht automatisch den technischen Trainerkatalog. Historische Texte ohne eindeutige aktive Kursstufe werden erhalten, aber nicht durch eine geratene Zuordnung freigeschaltet.

## Personen, Kurse und Buchungen

```mermaid
erDiagram
    AUTH_USERS ||--o| PROFILES : "verifizierte Identität"
    PROFILES ||--o| PEOPLE : "auth_user_id, optional"
    PEOPLE ||--o{ BOOKINGS : "person_id"
    BOOKINGS ||--o{ BOOKING_ITEMS : "booking_id"
    COURSES ||--o{ BOOKING_ITEMS : "course_id"
    COURSES ||--o{ COURSE_TRANSLATIONS : "course_id"
    COURSES ||--o{ COURSE_SCHEDULES : "course_id"
    COURSES o|--o{ COURSE_EXCEPTIONS : "kursbezogen oder allgemein"
    PEOPLE ||--o{ INVOICE_CASES : "person_id"
    BOOKINGS ||--o| INVOICE_CASES : "booking_id"
```

- `profiles.id` bleibt die Auth-UUID und das Ziel vorhandener Lern-Fremdschlüssel. Die Tabelle enthält Rolle und Sprachpräferenzen, keine zweite Kopie der persönlichen Kontaktdaten.
- `people` ist die maßgebliche Person mit Name, Kontakt und Anschrift. `auth_user_id` ist optional und eindeutig. Eine Person aus einer öffentlichen Kursanmeldung kann zunächst ohne Lernkonto bestehen. E-Mail-Adressen sind für den Abgleich indexiert, aber nicht künstlich eindeutig; gemeinsam genutzte Adressen werden nicht geraten.
- `profile_details` verbindet Person und Profil als `security_invoker`-Lesesicht. Die Sicht liefert den bestehenden UI-Vertrag, ohne Kontaktdaten doppelt zu speichern.
- `courses.id` ist eine UUID. Der bisherige lesbare Kursbezeichner bleibt als eindeutiger `slug` erhalten. `course_translations`, `course_schedules` und `course_exceptions` ersetzen mehrfach interpretierte Sprach-/Terminfelder. Vergangene Kurse werden archiviert.
- `bookings` bildet den Vorgang mit Person, Zielmonat, Beginn, Art und Status ab. Die bei der Anmeldung angegebenen Kontaktdaten und Zustimmungen sind ein bewusster Vorgangs-Snapshot, keine zweite editierbare Stammdatenquelle. Für reguläre Vorgänge gilt ein Eintrag pro Person und Monat; Probebuchungen haben eine eigene Art.
- `booking_items` ordnet einer Buchung ihre Kurse zu. Titel, Einheit und Preis werden als Snapshot gespeichert, damit spätere Katalogänderungen den damaligen Vorgang nicht verändern. `(booking_id, course_id)` ist eindeutig.
- `invoice_cases` ist die manuelle Arbeitsliste pro Person und Monat mit eindeutigem Buchungsbezug. `outstanding` und `created` dokumentieren die Rechnungserstellung. Annahme, Rechnung, Versand und Zahlung werden nicht gleichgesetzt.
- `teacher_student_notes` bleibt das Staff-Schwarze-Brett am Profil. Eine kanonische Notiz pro Schüler wird mit Marker und partiellem Unique-Index geführt; konkurrierende erste Speicherungen laufen über einen gesperrten RPC.

Eine vorhandene Person und deren Buchungen werden erst nach bestätigter Auth-E-Mail und eindeutigem, noch nicht beanspruchtem Treffer verknüpft. Öffentliche Formulardaten oder frei editierbare Auth-Metadaten verleihen keine Staff-Rolle und keinen Zugriff auf fremde Daten.

## Lernkatalog und Übersetzungen

```mermaid
erDiagram
    LEARNING_LEVELS ||--o{ LEARNING_UNITS : "level"
    LEARNING_UNITS ||--o{ LEARNING_VOCABULARY_CARDS : "Vokabellektion"
    LEARNING_UNITS ||--o{ LEARNING_EXERCISES : "Grammatiklektion"
    LEARNING_UNITS o|--o| LEARNING_READING_TEXTS : "ein Text pro Einheit"
    LEARNING_UNITS ||--o| LEARNING_VIDEOS : "ein Video pro Einheit"
    LEARNING_VOCABULARY_CARDS ||--o{ VOCABULARY_TRANSLATIONS : "card_id und locale"
    LEARNING_EXERCISES ||--o{ GRAMMAR_TRANSLATIONS : "exercise_id und locale"
```

`learning_units.id` ist die stabile Berechtigungs-ID. Jede Einheit hat genau ein Niveau, einen Trainer, einen lesbaren Namen, Sortierung und Aktivstatus. Vokabeln und Grammatik werden in Lektionen gruppiert; jeder Aussprachetext ist einzeln freigebbar. Historische, nicht publizierte Aussprachetexte dürfen ohne aktuelle Einheit verbleiben.

`vocabulary_translations` speichert Wortübersetzung, Beispielsatz und sprachabhängige Schwierigkeit je Karte und Locale. `grammar_translations` speichert lokalisierte Hinweise und Erklärungen je Aufgabe und Locale. Das versionierte Grammatik-JSON enthält weiterhin die fachliche Aufgabenstruktur, Optionen, richtige Lösung und akzeptierte Alternativen; sprachabhängige Erklärungen werden darin nicht nochmals gespeichert.

Die bisherigen Namen `vocabulary_cards`, `exercises`, `pronunciation_prompts` und `videos` sind RLS-beachtende Lesesichten. Dadurch kann die vorhandene UI mit ihren etablierten DTOs weiterarbeiten. CMS-Schreiben verwendet `save_learning_content` bzw. `delete_learning_content`; eine Änderung an einer Karte benennt nicht versehentlich die gemeinsame Lektion ihrer Geschwister um. Eine Einheit darf niemals Inhalt eines anderen Trainers aufnehmen.

Die Migration prüft vor Commit Gesamtzahlen, erhaltene Inhalts-IDs, deutsche Wörter/Lesetexte, alle Vokabelübersetzungen und Beispielsätze sowie das unveränderte fachliche Grammatik-JSON. Ein Fehler bricht die Transaktion ab.

## Freigaben, Lernstände und Audio-Dialoge

```mermaid
erDiagram
    PROFILES ||--o{ STUDENT_LEVEL_ACCESS : "Niveauzugang"
    LEARNING_LEVELS ||--o{ STUDENT_LEVEL_ACCESS : "level"
    PROFILES ||--o{ LEARNING_TRAINER_GRANTS : "Trainerentscheidung"
    LEARNING_LEVELS ||--o{ LEARNING_TRAINER_GRANTS : "level"
    LEARNING_TRAINER_GRANTS ||--o{ LEARNING_UNIT_GRANTS : "ausgewählte UUIDs"
    LEARNING_UNITS ||--o{ LEARNING_UNIT_GRANTS : "gleicher Trainer und Level"
    PROFILES ||--o{ VOCABULARY_DIRECTION_PROGRESS : "eigener Lernstand"
    LEARNING_VOCABULARY_CARDS ||--o{ VOCABULARY_DIRECTION_PROGRESS : "beide Richtungen"
    PROFILES ||--o{ USER_EXERCISE_PROGRESS : "eigene Versuche"
    LEARNING_EXERCISES ||--o{ USER_EXERCISE_PROGRESS : "exercise_id"
    PROFILES ||--o{ SUBMISSIONS : "Schülergespräch"
    LEARNING_READING_TEXTS o|--o{ SUBMISSIONS : "Textvorlage"
    SUBMISSIONS ||--o{ PRONUNCIATION_MESSAGES : "Dialogantworten"
```

**Freigaben:** `student_level_access` ist die einzige gespeicherte Niveauzuordnung. `learning_trainer_grants` enthält `enabled` und `unit_mode` (`all` oder `selected`). Eine fehlende Trainerentscheidung erbt den bestehenden Niveauzugang. `selected` ohne Zeilen in `learning_unit_grants` bedeutet keine freigegebenen Einheiten. Zusammengesetzte Fremdschlüssel verhindern, dass eine Auswahl Einheiten eines anderen Niveaus oder Trainers enthält. `profiles.allowed_levels` wurde entfernt; `profile_details.allowed_levels` und die Sicht `student_trainer_access` sind daraus abgeleitete Kompatibilitätsdaten.

**Vokabeln:** `vocabulary_direction_progress` speichert genau einen Zustand pro `(user_id, card_id, direction)`. Beide Richtungen werden unabhängig eingestuft, terminiert und bewertet. „Bekannt“ setzt die betroffene Richtung in Phase 6; der Abschluss muss noch nachgewiesen werden. Der interne Wert 7 bezeichnet den erfolgreich abgeschlossenen Sechs-Phasen-Durchlauf. Ein Wort ist erst gelernt, wenn beide Richtungen diesen Zustand erreicht haben. Die alte `user_vocabulary_progress` ist nur eine Lesesicht auf die deutsche Ausgangsrichtung. Antwortbelege und die letzte Karte verhindern doppelte Bewertungen bzw. unmittelbares Wiederholen desselben Wortes.

**Grammatik:** `record_grammar_attempt` bewertet die übermittelte Antwort serverseitig, prüft Nutzer und Einheit und schreibt Versuche/Ergebnis atomar. Studierende dürfen keine beliebigen Punktzahlen direkt in die Tabelle schreiben.

**Aussprache:** `submissions` hält die ursprüngliche Aufnahme, den Text-Snapshot und den Gesprächsstatus. `pronunciation_messages` speichert jede spätere Text-/Sprachnachricht genau einmal. `teacher_feedback` ist ausschließlich eine Sicht auf Lehrerantworten. Snapshots sind gewollt: eine spätere Textkorrektur im CMS darf den bereits eingereichten Lesetext nicht verändern.

**Storage:** Dateien werden unter `storage://pronunciation_audio/<auth-uuid>/<datei-uuid>.<format>` referenziert. Eine signierte Wiedergabe verlangt den aktuellen Zugriff auf das zugehörige Gespräch und seine Einheit; fremde Schüler können weder Nachrichten lesen noch deren Dateien signieren. Staff darf die betreuten Gespräche prüfen. Neue Dateien sind unveränderlich; studentische Uploads müssen im eigenen Verzeichnis liegen. Der alte Bucket `audio_submissions` ist privat und für normale App-Zugriffe gesperrt.

## RLS und privilegierte Funktionen

- Katalogzugriff, Lernstände, direkte RPC-Aufrufe und Audio-Wiedergabe prüfen denselben Berechtigungsumfang. Neue Schüler haben zunächst keine Niveauzuordnung. Die deutsche Schüler-Interfacesprache blockiert die Trainer; Staff kann Inhalte weiterhin in deutscher Verwaltungsoberfläche pflegen.
- Authentifizierte Nutzer dürfen an `profiles` nur Sprachpräferenzen ändern. Rollen und Abrechnungskennungen lassen sich darüber nicht selbst setzen. Die Staff-Rolle wird aus der Datenbank gelesen, nicht aus frei editierbaren Metadaten.
- Kompatibilitätssichten verwenden `security_invoker=true`. Private Hilfsschemata sind nicht als ungeschützte Tabellen-APIs geöffnet. Definer-Funktionen setzen einen leeren `search_path` und prüfen den Actor; öffentliche RPC-Fassaden erhalten gezielte Ausführungsrechte.
- Fortschrittsbewertung, Freigaben und Reset sind getrennte, validierte Schreibpfade. Ein Trainer-Override kann niemals ein gesperrtes Niveau öffnen. Staff-CMS-Rechte sind keine vom Schüler übermittelbare Rolle.
- Fremdschlüssel- und Abfrageindizes decken Person/Monat, Kurspositionen, Einheit/Trainer, Übersetzungsschlüssel und fällige Worker-/Lernzustände ab.

Der Restore-Audit fand fehlende private Storage-SELECT-Policies und alte permissive Aufnahme-/Fortschrittspolicies. `learning.sql` bindet diese Policies deshalb ausdrücklich neu, statt die Sicherheit von zufällig verbliebenen Altdefinitionen abhängig zu machen.

## Lokale Mail-Outbox

`private.mail_outbox` speichert Empfänger, Sprache, Ereignis, Payload und Zustellstatus. Ein eindeutiger Ereignisschlüssel verhindert doppeltes Enqueue. Worker reservieren fällige Einträge mit `FOR UPDATE SKIP LOCKED`, erhalten eine zeitlich begrenzte Lease und quittieren nur mit passendem Lease-Token. Fehlversuche werden mit exponentiell wachsender Wartezeit begrenzt wiederholt; nach spätestens acht Versuchen oder einem dauerhaften Fehler bleibt der Eintrag zur Prüfung auf `failed`.

Geschäftsereignisse und Lehrerfeedback verwenden benannte Vorlagen für DE/EN/RU/UK/TR. Feedback nutzt die gespeicherte Nachrichten-UUID als Deduplizierungsschlüssel. Scheitert die Benachrichtigung nach gespeichertem Chatbeitrag, wird dieser Beitrag nicht als fehlgeschlagen gemeldet und durch erneutes Senden dupliziert. SMTP-Zustellung und fachliches Speichern sind unterschiedliche Zustände.

## Ersatz der früheren Mail-Cronjobs

Der Abgleich erfolgte mit der lokalen Git-Historie und den lokalen Sicherungsdaten, ohne Cloud-Abfrage. Die fünf früheren HTTP-Poller werden durch fachliche Ereignisse ersetzt:

| Früherer Jobzweck | Lokaler Auslöser |
| --- | --- |
| Kursplatz bestätigen | `confirm_business_booking` → `registration_confirmed` |
| Probestunde bestätigen | `confirm_business_booking` → `trial_confirmed` |
| Kursanfrage ablehnen | `decline_business_booking` → `booking_cancelled` |
| Probestundenanfrage ablehnen | `decline_business_booking` → `trial_cancelled` |
| Kündigungseingang bestätigen | `submit_business_cancellation` → `cancellation_requested` |

Eine Ablehnung ist nur für ausstehende Anfragen zulässig. Die Staff-Funktion sperrt die Buchung, prüft den Status und erzeugt die passende Mail gemeinsam mit der Statusänderung in einer Transaktion. Wiederholung ist ohne zusätzliche Nachricht möglich; bestätigte Buchungen und bereits erstellte Rechnungen werden nicht durch diesen Weg beendet. Die UI zeigt vor dem Absenden Person, Kurse und Datum in einem Bestätigungsdialog. Absagevorlagen bieten in allen fünf Sprachen passende Alternativen an; sie behaupten keine Beendigung eines bereits geschlossenen Vertrags.

## Backup, Migration und Restore

Vollständiger Sicherungsort auf dem VPS: `/root/backups/sitov-before-refactor-20260913T130956Z`.

Der Sicherungssatz umfasst Datenbankdump, Rollen, geschützte Konfiguration und Proxy-Konfiguration. Die Wiederherstellung wurde vor der produktiven Änderung in einer isolierten Datenbank getestet. Vor weiteren DDL-Änderungen wurden zusätzliche Sicherungen erstellt; die normalisierte Migration ist anschließend auf dem VPS angewendet worden. Ein verwaistes Altprofil wurde nur in dieser Restore-Testkopie quarantänisiert; daraus folgt keine allgemeine Löschregel für produktive Profile.

Die versionierten Skripte unter [supabase/vps](../supabase/vps) sind ein einmaliger, bewusst freigegebener Umbau. Sie sind keine beliebig wiederholbaren Startskripte und dürfen nicht gegen die frühere Cloud-Instanz laufen.

1. Anwendungsschreiben stoppen und vollständige Sicherung samt lesbarem Restore prüfen. Bei einem neuen Versuch zuerst den tatsächlichen Datenbankstand bestimmen.
2. Alte externe Jobs/Benachrichtigungstrigger stilllegen. `prepare.sql` führt ausschließlich den freigegebenen Schüler-/Geschäftsdaten-Neustart aus; zwei Staff-Konten und der Katalog bleiben erhalten. Seine Storage-Metadatenbereinigung setzt den separat geprüften leeren Objektbestand voraus und darf nicht auf einen Bucket mit tatsächlichen Dateien übertragen werden.
3. `mail.sql` vor `business.sql` einspielen, anschließend `learning.sql` und `platform.sql`. Die Abhängigkeit ist verbindlich: Geschäfts-RPCs benötigen die Outbox, der Lernumbau die neue Person-/Profilsicht.
4. Typen aus der tatsächlich migrierten, isoliert geprüften Datenbank erzeugen. Inhaltssummen, Freigaben, Policies und Grants prüfen; keine Schemaannahmen ausschließlich aus alten Markdown- oder SQL-Dateien ableiten.
5. Anwendung und lokale Dienste bereitstellen. HTTPS, Auth-Weiterleitungen, Mailannahme/-zustellung, Trainer und private Aufnahme-/Feedback-Wiedergabe gesondert prüfen. Erst danach ist ein Live-Abschlussnachweis zulässig.
6. Bei einem Rollback Anwendungsschreiben stoppen und den zusammengehörigen Sicherungssatz aus Datenbank/Rollen, Konfiguration und passendem Anwendungscode wiederherstellen. Ein Restore ist kein partielles Zurückkopieren einzelner Tabellen in das neue Modell. Daten, die nach der Umschaltung entstanden sind, müssen vor einem Rollback separat gesichert werden.

Beim späteren **individuellen Lernreset** bleibt die Person samt Kurs- und Rechnungsdaten bestehen. Eine owner-geprüfte Reset-Transaktion erstellt zunächst ein beständiges Dateiverzeichnis. Die Anwendung entfernt echte Dateien über die Storage-API; erst nach bestätigter Entfernung werden Richtungsfortschritte, Übungen und Dialoge atomar gelöscht. Aktive Reset-Jobs blockieren neue Lern-/Audio-Schreibvorgänge. Der Vorgang ist nach Fehlern fortsetzbar und erhält Lehrerdateien, die noch in einem anderen Schülergespräch verwendet werden.

## Belegte Prüfnachweise vom 13. September 2026

| Prüfung | Nachgewiesenes Ergebnis |
| --- | --- |
| Vollständige Sicherung und isolierter Restore | Durchgeführt; produktive Sicherung am oben genannten VPS-Pfad, weitere Sicherungen vor DDL |
| Migration und Inhaltserhalt | Kombinierte Migration auf Restore-Kopie geprüft und live angewendet; Inhalts-IDs, Zahlen, Übersetzungen, Beispielsätze und fachliche Grammatikdaten erhalten |
| Gesamte Jest-Prüfung | 82 Suites, 1.079 Tests bestanden; ein Opt-in-Netzwerktest übersprungen |
| Isolierte PostgreSQL-/Worker-Prüfung | 60 Tests bestanden, einschließlich Berechtigungs-, Fortschritts-, Reset- und Worker-Verträgen |
| TypeScript | Gesamtprüfung ohne Fehler |
| Live-REST | 22 bestandene Prüfgruppen: 14 Basisprüfungen, fünf NULL-Eingabeprüfungen, drei Konfliktfälle |
| Fachliche Konflikte | HTTP 409 in 51/53/114 ms; in allen drei geprüften Konfliktfällen blieben die Daten unverändert |
| Live-Kursverwaltung | Kurs anlegen, bearbeiten und archivieren im Browser geprüft |
| Auth-Seiten | Acht axe-Scans ohne gemeldete Verstöße; begrenzter automatisierter Prüfumfang |
| Grammatik-Navigation | Zwei Kartenübergänge ohne manuelles Scrollen |
| Privater Audio-Dialog | Schüleraufnahme → Lehrer-Sprachantwort → Schülerantwort mit Waveform-Wiedergabe erfolgreich |
| Lokales TTS | Referenzwiedergabe mit einem Klick nach 891 ms im geprüften Ablauf; Einzelmessung |
| Auth-Mail | Lokale SMTP-Zustellung an Testempfänger und anschließende Tokenbestätigung erfolgreich |
| Nativer Mailworker | Einmaliger Aufruf mit `--once` verarbeitete einen Auftrag bis `sent`; keine externen Testmails |
| HTTPS und Erneuerung | Vertrauenswürdiges Let's-Encrypt-IP-TLS; `certbot renew --dry-run` erfolgreich |
| Zusätzliche Chat-Korrektur | Regressionstests bestanden; Release `af37ee8b050e` live, Nachricht erscheint nach 10,9 s ohne Neuladen, laufende Wiedergabe bleibt stabil |

Diese Zahlen dokumentieren den genannten Prüflauf. Sie ersetzen weder eine vollständige Barrierefreiheitsprüfung noch allgemeine Latenz- oder externe Mailzustellgarantien.

**Bereinigter Betriebsstand:** Zwei temporäre Testkonten, zwei Testkurse, die Testbuchung und zwei Audio-Dateien wurden nach Backup entfernt. Es verbleiben zwei Staff-Konten, keine Schüler, Buchungen, Lernstände, Dialoge oder privaten Aufnahmen. Zehn aktive und zwei archivierte Kurse sowie sämtliche Trainerinhalte sind erhalten. `sitov-mail.service` ist aktiviert und läuft; die alte gestoppte PM2-Anwendung wurde nach Sicherung aus dem Startbestand entfernt.

## Anwendungs-Releases und Rollback

[deploy/vps/deploy-release.sh](../deploy/vps/deploy-release.sh) legt unveränderliche Releases unter `/var/www/sitov-releases/<12hash>` ab. Der aktive Symlink `/var/www/sitov-current` wird auf das neue Release umgestellt, der systemd-Dienst neu gestartet und seine Gesundheit geprüft. Bei fehlgeschlagener Prüfung stellt das Skript den bisherigen Anwendungsstand wieder her. PM2 wird nicht verwendet.

Das Zurückschalten des Anwendungscodes macht keine DDL rückgängig. Ein Datenbank-Rollback erfordert den oben beschriebenen zusammengehörigen Sicherungssatz und eine separate Sicherung aller seit der Umschaltung entstandenen Daten. Die Chat-Korrektur wurde als Release `af37ee8b050e` erfolgreich bereitgestellt und live geprüft.

## Nachtrag: öffentliche Storage-URLs bei interner Serververbindung

`lib/storage-public-url.ts` trennt die interne API-Verbindung von der im Browser verwendeten Datei-Adresse. Aus `http://127.0.0.1:9080/storage/v1/object/...` wird anhand der Konfiguration `https://217.154.228.254/supabase/storage/v1/object/...`. Es erfolgt keine freie URL-Weiterleitung: Origin und Storage-Pfadgrenze müssen exakt zum konfigurierten Backend gehören. Kodierte Dateinamen und sämtliche Signatur-/Query-Bytes bleiben unverändert. Cache-Treffer, neue Referenzaufnahmen und beide serverseitigen Signierstellen verwenden diesen Adapter. 39 gezielte Tests prüfen Mapping, Signaturerhalt und Ablehnung fremder/manipulierter URLs. Die tatsächliche private Waveform-Wiedergabe im Schüler-/Lehrerdialog sowie ein lokal erzeugtes Hörvorbild wurden nach dem VPS-Build im Browser erfolgreich geprüft. Die zusätzliche Chat-Nachlade-/Wiedergabekorrektur ist ebenfalls live geprüft.

## Abschlussbereinigung und Ressourcen

Vor der Entfernung der QA-Daten entstand `/root/backups/sitov-before-qa-cleanup-20260913T145917Z` mit Datenbankdump und Storage-/Mail-Sicherung. Dump-SHA256: `587d3a7e1aa21c28d45dc9dd28b3e08aed2fae5581a78edf2e2e2a21f868f880`. Echte Testdateien wurden über die Storage-API entfernt, nicht durch Löschen ihrer Metadaten. Der anschließende Datenbankcheck bestätigte 512 Vokabelkarten, 604 Grammatikaufgaben, 149 Lesetexte, zwei Staff-Konten und jeweils null Schüler, Buchungen, Rechnungsvorgänge, Vokabel-/Grammatikfortschritte, Dialoge und private Audio-Dateien.

Der Server hat 4 CPU-Kerne und knapp 8 GB RAM. Next.js baut mit zwei Workern; App, TTS, Postgres und die Docker-Dienste haben begrenzte Speicher-/CPU-Budgets. TTS rechnet mit einem ONNX-Thread und begrenztem Modellcache. Nach Bereitstellung waren etwa 3,2 GB RAM verfügbar und 207 GB Datenträger frei; diese Werte sind eine Momentaufnahme, kein Lasttest. PostgreSQL ist nur über Loopback veröffentlicht; Nginx lauscht intern, Traefik übernimmt den öffentlichen HTTPS-Zugang. Access-Logs enthalten keine Query-Parameter mit Auth- oder Storage-Signaturen.

## Abschließender Mail-Abgleich

Migration `20260913150205_decline_pending_business_bookings.sql` ist nach zusätzlicher Sicherung unter `/root/backups/sitov-before-decline-20260913T151036Z` angewendet. Die lokale Live-Prüfung unter der authentifizierten Staff-Rolle bestätigte Kursabsage, Probestundenabsage und wiederholungsfeste Outbox gemeinsam mit der Statusänderung. Alle dafür erzeugten Daten wurden vor Commit zurückgerollt; es wurde keine Absage-Testmail versendet. Vier UI-Tests prüfen den Bestätigungsdialog und Abbrechen/Bestätigen für beide Anfragearten. Der abschließende Gesamtstand umfasst 82 bestandene Jest-Suites mit 1.079 Tests, einen bewusst übersprungenen Opt-in-Netzwerktest und 60 bestandene PostgreSQL-/Mailworker-Tests. TypeScript ist fehlerfrei.
