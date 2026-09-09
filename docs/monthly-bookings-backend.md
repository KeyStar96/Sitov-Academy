# Monatsbuchungen und Schwarzes Brett

Die Migration `supabase/migrations/20260909155919_monthly_bookings_teacher_notes.sql`
wurde am **09.09.2026 auf Produktion angewendet**: Projekt `SmartGerman v2`
(`wcaslabeiwtvygxtzcio`), Live-Version `20260909172738`, Name
`monthly_bookings_teacher_notes`. Danach wurde `profile_dashboard_workflow`
als Version `20260909172746` angewendet. Beide Einträge sind in der
Supabase-Migrationshistorie bestätigt. Die lokalen Dateiversionen unterscheiden
sich von den beim MCP-Deployment vergebenen Live-Versionen; diese Dateien nicht
erneut anwenden. Zuordnung und Live-Prüfungen: [Deployment-Protokoll](supabase-deployment-2026-09-09.md).

## Datenmodell und Entscheidungen

- `profiles.phone/street/zip_code/city`: nullable `text`; `users.zip` wird zu
  `profiles.zip_code`. Postleitzahlen bleiben Text, einschließlich führender Nullen.
- `courses.booking_id`: zusätzliche eindeutige, stabile UUID mit Default. Die
  bestehenden `courses.id`-Textwerte und alle bisherigen Beziehungen bleiben erhalten.
- `monthly_course_bookings.course_ids`: UUIDs aus **courses.booking_id**, nicht
  `courses.id`. Ein bis 100 verschiedene Kurse; keine NULLs oder mehrdimensionalen Arrays.
  Die private Tabelle `monthly_booking_private.booking_courses` wird durch einen
  Trigger synchron gehalten. Ihre echten Fremdschlüssel verhindern verwaiste
  Array-Einträge auch bei konkurrierenden Schreibzugriffen. Referenzierte Kurse
  können erst nach Entfernen der Buchungsreferenzen gelöscht werden.
- Genau eine Buchung pro Profil und Monat. `target_month` ist der erste Tag als
  ISO-Datum `YYYY-MM-01`. `status`: `pending` (Default), `confirmed`, `cancelled`.
  Nutzer bearbeiten/löschen eigene Buchungen; Admins alle. Lehrkräfte bekommen
  bei Buchungen keine zusätzlichen Rechte. Nur Admins bestätigen. Bestätigte
  Buchungen können Besitzer zunächst nur unverändert stornieren; danach wieder
  als `pending` einreichen. Löschen eigener Buchungen bleibt gemäß RLS möglich.
- Notizen sind für alle Lehrkräfte/Admins lesbar und bearbeitbar, für Schüler
  vollständig verborgen. Beim Erstellen wird `teacher_id` aus der Session gesetzt.
  Autor, Zielprofil und ID bleiben unveränderlich. Ziel muss beim Erstellen ein
  Schülerprofil sein, Autor Lehrkraft/Admin. Spätere Rollenänderungen löschen keine
  Notizen. `discount_percent`: 0–100, zwei Nachkommastellen, Default 0.
- Neue Profil-Fremdschlüssel verwenden `ON DELETE CASCADE`. Die Kursreferenzen
  verwenden `RESTRICT`, damit Buchungen nie stillschweigend Kurse verlieren.

## Verlustfreie Übernahme der Bestandskontakte

`public.users.id` und `profiles.id` haben unterschiedliche Identitäten. Die Migration
verknüpft sie **nicht** über vermeintlich gleiche UUIDs. Automatisch übernommen wird
nur bei eindeutiger normalisierter E-Mail-Zuordnung zu genau einem bestätigten
Auth-Konto mit übereinstimmender aktueller Profil-E-Mail. Mehrere identische Kopien
desselben Kontakts derselben Person sind erlaubt; verschiedene Personen oder
unterschiedliche Kontaktwerte unter derselben E-Mail sind mehrdeutig.

Es werden keine Personen oder Auth-Konten erzeugt. Alle `users`-Zeilen bleiben
unverändert. Nicht-NULL-Werte im Profil werden niemals überschrieben. Bei
widersprüchlichen vorhandenen Werten wird der gesamte Kontakt zur Prüfung
zurückgestellt, damit keine aus mehreren Adressen zusammengesetzte Adresse entsteht.
Quellwerte werden unverändert kopiert, einschließlich Leerzeichen und Sonderzeichen.

`monthly_booking_private.profile_contact_migration_audit` hält für jede Quellzeile
Kontakt-Snapshot, eindeutiges Ziel (falls vorhanden), vorherige Profilwerte und
Ergebnis fest. Zugriff: SQL-Administrator bzw. lesend `service_role`; niemals Browser.

```sql
SELECT result, count(*)
FROM monthly_booking_private.profile_contact_migration_audit
GROUP BY result ORDER BY result;
```

Ergebnisse: `copied`, `no_verified_profile`, `ambiguous_profile`,
`ambiguous_legacy`, `conflicting_profile`. Beim lesenden Live-Abgleich am 09.09.2026
gab es 78 Legacy-Kontakte und 6 Profile; drei Kontakte hatten passende Profil-E-Mails,
aber keine dieser E-Mails war im Legacy-Bestand eindeutig. Es wird deshalb keine
vollständige automatische Zuordnung aller Kontakte versprochen. Für Prüffälle muss
die Identität anhand der bisherigen Registrierung und des Auth-Kontos geklärt werden.
Die verbleibenden Daten sind vollständig erhalten; es gibt keinen automatischen
Fallback auf „neueste Adresse“ oder „erste passende Zeile“.

Das tatsächlich ausgeführte Live-Audit ergab:
**75 `no_verified_profile`, 3 `ambiguous_legacy`, 0 `copied`**.
Somit wurde keine Adresse automatisch einem Profil zugewiesen. Alle 78 Quellkontakte
blieben unverändert; ihre Kontakt-Snapshots stimmen vollständig mit den Quellen überein.

Die Übernahme ist ein einmaliger Backfill, keine laufende Synchronisierung. Neue
Profil-Kontaktänderungen schreiben nur `profiles`; vorhandene Legacy-Prozesse können
weiter `users` verwenden. Das Audit wird bei Löschung des Quellkontakts mitgelöscht;
bei Profil-Löschung bleibt der Quell-Snapshot erhalten und `profile_id` wird NULL.

## Rollen und bestehende Abläufe

`admin` wird vom Profil-CHECK sowie den zuvor ausschließlich für Lehrkräfte gültigen
Submission-/Feedback-Policies akzeptiert. Bereits vorhandene Content-Policies
akzeptieren beide Rollen. Historische Migrationsdateien bleiben unverändert.

RLS allein verhindert keine Selbstbeförderung innerhalb der eigenen Profilzeile.
Die Migration beschränkt daher Profil-UPDATE-Spalten auf `name`, `native_language`,
`ui_language` und die vier Kontaktfelder. Rollen-/Level-/Stripe-Felder werden nur von
vertrauenswürdigen Serverpfaden geschrieben. Die bestehende `updateStudentRole`-Action
verlangt jetzt tatsächlich `admin` (die UI tat dies bereits). Der Stripe-Checkout
speichert die von Stripe erzeugte Customer-ID mit dem Server-Admin-Client, nachdem
er den Nutzer über Auth geprüft hat. So bleibt der Ablauf mit den neuen Spaltenrechten
funktionsfähig. Andere Staff-Actions bleiben bestehen.

Der private Rollen-Lookup liest ausschließlich die aktuelle DB-Rolle des Aufrufers,
verwendet einen leeren `search_path` und vermeidet rekursive Profil-Policies. Die
privaten Triggerfunktionen sind nicht direkt für API-Rollen ausführbar. Das private
Schema darf nicht als zusätzliches PostgREST-API-Schema freigegeben werden.

## TypeScript und Actions

`supabase/database.types.ts` enthält die strukturellen Row/Insert/Update/Relationship-
Types des migrierten Schemas. Sie wurden lokal fortgeschrieben;
die Types wurden nicht als aus Produktion neu generiert ausgegeben.
`lib/types/{backend,profile,monthly-bookings,teacher-notes}.ts` ergänzt DTOs, Rollen,
Status-Union und Zod-Schemas. SQL-text-CHECKs bleiben in den strukturellen DB-Types
`string`, die fachlichen Types verwenden strengere Unions.

Alle neuen Actions nehmen `unknown` an, prüfen Eingaben serverseitig, nutzen
`auth.getUser()` und den Cookie-Supabase-Client mit RLS. Sie liefern
`{ success: true, data }` oder `{ success: false, error }` mit einer stabilen Kennung.
Rohdatenbankfehler werden nicht an Clients weitergegeben. Listen sind paginiert
(`offset`, `limit`, maximal 100). In diesem Projekt mit `strict: false` zum Narrowing
explizit `result.success === true` bzw. `=== false` verwenden.

- `monthly-bookings.ts`: `getMonthlyBookings`, `createMonthlyBooking`,
  `updateMonthlyBooking`, `deleteMonthlyBooking`.
- `teacher-notes.ts`: `getTeacherNotes`, `createTeacherNote`,
  `updateTeacherNote`, `deleteTeacherNote`.
- `profile.ts`: `updateProfileContact`; alle vier Kontaktfelder angeben,
  `null` zum expliziten Löschen. Keine implizite Löschung durch fehlende Felder.

Notizen und neue Kontakte sind Klartext: Trim/Zeilenenden-Normalisierung,
Längenlimits, keine spitzen Klammern oder verborgenen Steuerzeichen. Immer als
escaped React-Text ausgeben, nie als HTML interpretieren. Legacy-Werte werden zur
Vermeidung von Datenverlust nicht nachträglich umgeschrieben.

## Validierung und Ausführung

```sh
npm ci
npm run test:db:monthly
npx jest --runInBand __tests__/monthly-backend-validation.test.ts __tests__/monthly-backend-actions.test.ts __tests__/monthly-stripe-compatibility.test.ts
npx tsc --noEmit --incremental false
```

Die DB-Tests führen die echte Migration auf isoliertem PostgreSQL (PGlite) mit
synthetischen Daten und Supabase-ähnlichen Auth-Rollen aus. Sie prüfen Backfill,
Konflikte, Constraints, RLS für alle Rollen, Spaltenrechte, Rollenwechsel,
Kurs-FKs und Löschkaskaden. PGlite bildet PostgREST, GoTrue und konkurrierende
Mehrverbindungs-Last nicht ab; echte FK-Constraints sichern die Kursbeziehungen.
Validiert: 31 DB-Prüfungen (einschließlich Rollback bei Schemaabweichung), 50
Jest-Tests und der TypeScript-Projektcheck. Die neuen Actions/Types wurden
zusätzlich mit `strict: true` geprüft, obwohl das Projekt `strict: false` nutzt.

Die Migration wurde nach isolierten SQL-Tests und lesender Live-Vorprüfung auf
ausdrücklichen Nutzerauftrag über Supabase MCP ausgeführt. Das Skript enthält
eine Transaktion, einen 5-Sekunden-
Lock-Timeout und einen 120-Sekunden-Statement-Timeout. Fehler führen zum Rollback;
bei einem Lock-Timeout nach Ende der blockierenden Transaktion erneut versuchen.
Die Datei ist bewusst einmalig: wiederholte Anwendung scheitert atomar an bereits
vorhandenen Objekten. Keine bestehenden Tabellen/Spalten werden gelöscht.

Das Repository enthält ältere Migrationen ohne Zeitstempel. Sie nicht umbenennen
oder pauschal erneut ausführen. Nur die neue Migration in die vorhandene
Deployment-/Migrationshistorie aufnehmen. `schema.sql` ist eine unvollständige
Referenz, kein Setup-Skript. Bei einem App-Rollback die additiven Datenstrukturen
behalten; insbesondere Spaltenrechte, UUIDs und Kontaktdaten nicht zurücklöschen.

Die RLS- und Spaltenrechte folgen der offiziellen
[Supabase-RLS-Dokumentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
und der [Dokumentation zu Spaltenrechten](https://supabase.com/docs/guides/database/postgres/column-level-security).
