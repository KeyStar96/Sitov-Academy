# Sitov Academy: Upload- und Audio-Sicherheitsgrenzen

Migration `79_sitov_storage_security_limits.sql` schützt direkte Storage-Uploads und signierte Uploads auf Datenbankebene. Auch finale Schreibvorgänge mit `service_role` unterliegen den Quoten. Sie ergänzt die bestehenden Rechte- und Reset-Prüfungen; Dateien, Aufnahmen, Aufgabenkennungen, Antwortschlüssel, Lernfortschritt und Streaks werden nicht gelöscht oder umgeschrieben.

## Festgelegte Grenzen

| Speicher | Gesamtbytes | Objekte | Pro Nutzer | Neue Uploads pro UTC-Tag |
| --- | --- | --- | --- | --- |
| Ausspracheaufnahmen | 5 GiB | 20.000 | 250 MiB / 200 Objekte | 25 Uploads / 512 MiB |
| Prüfungsabgaben einschließlich Simulation | 10 GiB | 40.000 | 500 MiB / 400 Objekte | 40 Uploads / 600 MiB |
| Vorbereiteter und fremdsprachiger Audio-Cache | 8 GiB | 100.000 | Gemeinsamer Bestand | Autorenimporte haben kein Tageslimit |
| Kursmaterialien | 30 GiB | 20.000 | Bestehende Freigaben | Kein neues Tageslimit |

Aussprache, Prüfungen und Audio-Cache zusammen dürfen höchstens 20 GiB / 160.000 Objekte belegen. Die vier aufgeführten Buckets zusammen dürfen höchstens 50 GiB / 180.000 Objekte belegen. Andere Buckets sind nicht Teil dieser gemeinsamen Quote. Aussprache- und Prüfungsaufnahmen desselben Nutzers dürfen zusammen höchstens 750 MiB / 600 Objekte belegen. Die bereits vorhandene Kursmaterialquote von 20 GiB je Niveau bleibt zusätzlich bestehen.

Die bisherigen Dateigrenzen gelten weiter: Aussprache 25 MiB, Prüfungsdateien 20 MiB und Kursmaterial 512 MiB. Der Cache-Trigger akzeptiert höchstens 2 MiB; eine strengere vorhandene Bucketgrenze bleibt wirksam. Objekte mit unbekannter Größe reservieren ihre maximale Dateigröße, bis der Storage-Dienst die gemessene Größe schreibt. Dadurch kann ein kleiner Upload nahe an der Gesamtquote bereits bei der konservativen Vorprüfung abgelehnt werden.

Die konfigurierbaren Bucket-, Nutzer- und Tagesgrenzen stehen in der privaten Tabelle `sitov_storage_private.limits`. Änderungen gehören in eine geprüfte Migration. Gemeinsame Quoten und die Grenzen für Uploadtickets bzw. Synthese stehen in den jeweiligen Guard-Funktionen. Bereits vorhandene Objekte werden beim ersten Anwenden unter einer Storage-Schreibsperre in die Zähler übernommen. Erneutes Anwenden setzt Zähler oder verbrauchte Tageskontingente nicht zurück.

Die erstmalige Ticket-Ablaufmarkierung umfasst auch historische Tickets abgeschlossener Prüfungen. Dazu sperrt die Migration die Tickettabelle innerhalb der Migrationstransaktion, pausiert die vorhandenen fachlichen Nutzertrigger nur für diese Metadaten-Ergänzung und stellt ihre bisherigen Aktivierungsmodi exakt wieder her. Interne Integritätsprüfungen bleiben aktiv. Ein Fehler rollt auch die Triggeränderungen zurück. Dieser Altbestandsfall und die Erhaltung der Triggerzustände werden im vollständigen Schema-Integrationstest geprüft.

## Uploadtickets und Audio-Synthese

Prüfungsvorbereitung und Simulation hinterlegen vor der URL-Signierung die erwartete Dateigröße. Ein Ticket gilt 30 Minuten, kann nicht verlängert oder einem anderen Nutzer zugeordnet werden und erlaubt keine größere tatsächliche Datei. Beide Prüfungsbereiche teilen 40 Tickets / 600 MiB pro UTC-Tag und höchstens zehn noch ungenutzte, gültige Tickets. Auch nie verwendete und später gelöschte Tickets verbrauchen das Tageskontingent. Fehlgeschlagene URL-Signierungen geben den ungenutzten Slot wieder frei. Die nächste Ticketanforderung entfernt abgelaufene, unbenutzte Tickets; vorhandene Storage-Dateien bleiben erhalten. Ein abgelaufenes Ticket sperrt neue Uploads und verspätete Finalisierung, nicht den Zugriff auf bereits abgegebene Aufnahmen.

Fremdsprachige Audioanfragen benötigen eine zugängliche Vokabelkarte und exakt deren gespeicherte Übersetzung, Wendungsübersetzung oder Beispielsatz in der angefragten Sprache. Diese Bindung gilt auch für Cachetreffer und Lehrkraft-/Adminprofile. Freier Text ohne Karte oder Texte aus einer anderen Sprache werden vor dem Storage-Abruf abgelehnt.

Eine neue Fremdsprachensynthese verbraucht vor der Verarbeitung eine Datenbankreservierung: höchstens 100 neue Anfragen / 100.000 Zeichen je Nutzer und UTC-Tag, insgesamt 500 / 1.000.000 Zeichen. Das bestehende Limit von 20 neuen Anfragen je Minute bleibt bestehen. Cachetreffer verbrauchen kein Synthesekontingent. Ein ausgefallener Quoten-RPC führt zur Ablehnung; Worker-Neustarts, Dateilöschung und Lernresets setzen das Tageskontingent nicht zurück. Fehlgeschlagene Syntheseversuche werden absichtlich mitgezählt.

Deutsche Beispiele werden weiterhin ausschließlich aus dem lokal vorbereiteten männlichen Qwen-Bestand geladen. Die Migration und Guards starten keine deutsche Synthese und ändern keine Stimmen, Audios oder Wortzeitmarken.

## Atomare Durchsetzung und Grenzen

Die Storage-Zähler werden in derselben Transaktion wie die Objektänderung aktualisiert. Ein gesperrtes Counter-`UPDATE` prüft die aktuelle Zeile nach konkurrierenden Schreibvorgängen. Jeder Vorgang nimmt zuerst die gemeinsame Quote, danach die Audioquote, den Bucket und gegebenenfalls den Nutzer. Ein abgelehnter Vorgang rollt alle Zähleränderungen zurück. Ein `AFTER`-Trigger vermeidet doppelte Objekt- und Tagesbuchungen bei `INSERT ... ON CONFLICT DO UPDATE`, wie sie der Storage-Dienst für finale Uploads verwendet. Löschen gibt die Speicherquote frei; verbrauchte Tageskontingente bleiben bestehen. Pfad-/Bucketänderungen geschützter Objekte sind gesperrt; vorhandener Anwendungscode verwendet dafür keine Storage-Move-Funktion.

Die Größen stammen aus Storage-Systemmetadaten, nicht aus frei veränderbaren `user_metadata`. Das auf dem VPS verwendete [Storage v1.44.2](https://github.com/supabase/storage/blob/v1.44.2/src/storage/uploader.ts) führt eine zurückgerollte Berechtigungsprüfung vor dem Dateiupload durch, schreibt finale Metadaten mit Serverrechten und plant bei Fehlern die physische Bereinigung. Daher gilt die atomare Quote für committed Storage-Objekte. Temporäre Übertragungen, unvollständige S3-/TUS-Multiparts und eine verzögerte physische Bereinigung können kurzfristig zusätzlichen Platz benötigen. Request-/Verbindungslimits, ausreichender freier Speicher, Bereinigungsjobs und Speicheralarme ergänzen diese Quoten. Die Quoten allein sind kein Dateisystemlimit und schützen keine beliebig vielen gleichzeitigen, noch laufenden Transfers.

## Verifikation

```sh
node --test supabase/tests/sitov-storage-security-limits.test.mjs
SITOV_QUOTA_POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin node --test supabase/tests/sitov-storage-quota-concurrency.test.mjs
npx jest --runInBand __tests__/generate-audio.test.ts __tests__/sitov-upload-ticket-guards.test.ts __tests__/exam-backend.test.ts __tests__/exam-simulation-backend.test.ts __tests__/neural-audio-cache.test.ts __tests__/exam-preparation-language.test.tsx __tests__/exam-simulation-localization.test.tsx
```

Die Datenbanktests prüfen direkte Uploads, serverseitige Cachewrites, fehlende/ungültige Größen, finale Größen, Upserts, Objekt-/Nutzer-/Bucket-/gemeinsame Quoten, Löschen ohne Tagesreset, abgelaufene Tickets, Größenbindung sowie fehlende Browserrechte. Die Paralleltests starten eine isolierte lokale PostgreSQL-Instanz ohne TCP-Listener und prüfen reale konkurrierende Uploads, die letzte Ticketposition und die letzte Synthesereservierung. Ohne lokale Servertools ist ausschließlich dieser Paralleltest ausdrücklich übersprungen. Auf dem Autoren-Mac wurde er mit PostgreSQL 17.11 ausgeführt. Diese Tests ersetzen keine spätere Prüfung der realen Storage-API in einer isolierten Wiederherstellungsumgebung.
