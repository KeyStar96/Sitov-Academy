# Schülerprofil und Monatsplanung

Die Seite `app/[lang]/dashboard/profile/page.tsx` lädt persönliche Daten und
Monatsplanung serverseitig. Formular und Kursauswahl sind getrennte Client-
Komponenten; alle sichtbaren Beschriftungen und Statusmeldungen stammen aus den
fünf `profile`-Dictionaries. Vorhandene Kursnamen werden über `CourseData` übersetzt;
individuelle Datenbank-Kurstitel dienen als Inhalts-Fallback.

## Datenfluss

- Name und Kontaktfelder werden über `updatePersonalDetails` im eigenen Profil
  gespeichert. Das Formular zeigt Änderungen unmittelbar, sperrt Mehrfach-Submits
  und setzt bei einem Fehler auf den bestätigten Stand zurück.
- Die E-Mail-Adresse ist Teil der Auth-Identität. Ein Wechsel wird mit
  `auth.updateUser` angefordert. Bestätigungslinks führen zum Profil zurück. Erst
  wenn Auth die Adresse geändert hat, synchronisiert ein DB-Trigger `profiles.email`.
  Ein ausstehender Wechsel wird aus `user.new_email` auch nach Reload angezeigt.
  Schlägt ausschließlich der E-Mail-Versand fehl, bleiben bereits gespeicherte
  Kontaktänderungen sichtbar; die Oberfläche benennt diesen Teilerfolg ausdrücklich.
- Damit der E-Mail-Wechsel bestehende Anmeldungen nicht entkoppelt, wird eine
  eindeutige Legacy-Zuordnung in `profiles.legacy_user_id` festgehalten. Dieses Feld
  ist für Browser nicht beschreibbar. Bestehende eindeutige Audit-Zuordnungen werden
  übernommen; mehrdeutige gemeinsame E-Mail-Adressen werden nicht automatisch verknüpft.
- Der Folgemonat wird in **Europe/Berlin** berechnet. Die DB prüft denselben Monat,
  einschließlich Jahreswechsel. Eine veraltete offene Seite fordert zum Neuladen auf.
- Zuerst gilt die gespeicherte Folgemonatsbuchung, einschließlich einer leeren Pause.
  Fehlt sie, wird die letzte Monatsbuchung als fortlaufender Standard übernommen.
  Fehlt auch diese, werden bestätigte aktuelle Anmeldungen der eindeutig zugeordneten
  Person aus `enrollments` übernommen. Abgelaufene Kurse werden nicht fortgeschrieben.
  Mehrdeutige Legacy-Zuordnungen zeigen einen Hinweis statt fremder Kursdaten.
  Der Standard wird beim Lesen berechnet; es werden keine Buchungen durch GET erzeugt.
- Jede Auswahländerung wird sofort angezeigt. Eine serielle Schreibschlange sendet
  jeweils den letzten bestätigten Stand als Vergleichswert. Die DB-Funktion
  `save_next_month_booking` bindet den Eigentümer an `auth.uid()`, sperrt konkurrierende
  Änderungen und führt die Auswahl atomar aus. Ein veralteter Tab erhält einen
  Konflikt statt fremde Änderungen zu überschreiben. Netzwerkfehler führen zu einer
  erneuten Abfrage des gespeicherten Stands.
- Die Pause speichert `status='cancelled'`; auch ein leeres Kursarray ist dafür erlaubt.
  Das Abwählen des letzten Kurses pausiert automatisch. Vorhandene Kurs-IDs bleiben
  beim Pausieren zum Fortsetzen erhalten. Eine leere Pause kann durch Auswahl eines
  Kurses beendet werden. Bestätigte Buchungen werden bei einer neuen Auswahl atomar
  storniert und als `pending` ersetzt. Das Profil kündigt keine historischen
  Anmeldungen oder Stripe-Abonnements; die Änderung betrifft den geplanten Monat.

## Deployment

Vor Auslieferung der UI müssen diese beiden Migrationen in dieser Reihenfolge
angewendet sein:

1. `20260909155919_monthly_bookings_teacher_notes.sql`
2. `20260909165848_profile_dashboard_workflow.sql`

Beide Dateien wurden am **09.09.2026 auf Produktion angewendet** und in der
Live-Migrationshistorie als `20260909172738` bzw. `20260909172746` bestätigt.
Details: [Deployment-Protokoll](supabase-deployment-2026-09-09.md).
Die zweite Migration erweitert die erste ohne deren historische Datei zu ändern.
Supabase Auth muss seine bestehenden E-Mail-Bestätigungen und die Callback-URL
weiter verwenden. Es werden keine Bestätigungen per Admin-API übersprungen.

## Prüfungen

```sh
npm run test:db:profile
npx jest --runInBand __tests__/profile-dashboard.test.tsx __tests__/profile-dashboard-server.test.ts __tests__/profile-course-loader.test.ts __tests__/dashboard-i18n.test.ts
npx tsc --noEmit --incremental false
npx next build --webpack
```

46 gezielte Jest-Tests und 11 SQL-Prüfungen bestehen.
Die neuen Tests prüfen Datumsgrenzen, Default-Übernahme, leere Pausen, Konflikte,
schnelle Klickfolgen, Rollback, Reload, Auth-E-Mail-Bestätigung und Teilerfolge.
SQL-Tests laufen auf isoliertem PostgreSQL (PGlite), nicht auf Produktionsdaten.

Zusätzlich wurden die tatsächlichen Client-Komponenten mit Testdaten in Chromium
bei 320, 375, 390, 430 und 1280 Pixeln in allen fünf Sprachen geprüft: kein
horizontaler Overflow, alle Eingabefelder/Buttons/Selects mindestens 44 × 44 px.
Axe meldete in den geprüften Hell-/Dunkelansichten keine WCAG-A/AA-Verstöße.
Ein zusätzlicher Layout-Shift-Test beim Speichern (Deutsch, 390 px) ergab nach
Reservierung der Hinweisfläche keine Verschiebung.
Die Browser-Vorschau mockt die Server-Grenzen; sie ist kein Live-Auth-End-to-End-Test.
Der Next.js-Produktionsbuild war erfolgreich. Mangels lokaler Supabase-Konfiguration
protokollierten bestehende öffentliche Kursabfragen dabei die Placeholder-URL;
das ersetzt keinen Staging-Test gegen ein migriertes Supabase-Projekt.

Die Bestätigung von E-Mail-Wechseln entspricht der
[Supabase-Dokumentation zu updateUser](https://supabase.com/docs/reference/javascript/auth-updateuser).
