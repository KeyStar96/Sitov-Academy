# Standardisierte Tabellen und Privatunterricht

Diese Änderung ersetzt die Kompatibilitätsschicht des ersten VPS-Umbaus. Sie wird ausschließlich auf der lokalen Docker-Supabase-Instanz angewendet. Die vorherigen Migrationen bleiben als unveränderliche Historie erhalten; sie gehören nicht zum aktuellen Tabellenvertrag.

## Verbindlicher Datenvertrag

- Eigenständige Datensätze haben UUID-Primärschlüssel; Fremdschlüssel verweisen auf die tatsächliche Zieltabelle. Natürlich eindeutige Sprach-, Niveau- und Trainercodes sind eigene Lookup-Schlüssel.
- `profiles` enthält Auth-ID, Rolle und ISO-Sprachcodes. Die eindeutige Relation `people.auth_user_id → profiles.id` enthält persönliche Stammdaten. Keine zusätzliche Profil-View und keine doppelten Namens-/Adressfelder.
- `courses` enthält neun Datensätze. Die zwei ausgemusterten Altkurse und Privatunterricht in Präsenz werden physisch gelöscht; bestehende Buchungsreferenzen würden diese Löschung verhindern. Neue Kurse bleiben über das CMS frei anlegbar. Bei später bereits gebuchten Kursen erhält Archivieren die Buchungshistorie.
- Preise heißen `unit_price`, die Dauer einer Einheit `unit_minutes`. Slugs sind verständliche, eindeutige Kennungen; Verknüpfungen verwenden ausschließlich UUIDs. Übersetzungen, Termine und Ausnahmen sind eigene Relationen. Ein deutscher Quelltext wird nicht zusätzlich als Übersetzungszeile gespeichert.
- Buchungen verwenden `bookings`, `booking_items` und `invoice_cases`. `requested_units` ist ausschließlich die bewusst gewählte Anzahl privater Einheiten; `units` und `amount` speichern die serverseitig ermittelte, unveränderliche Preisgrundlage der jeweiligen Buchung.
- Die Lerninhalte liegen direkt in `learning_vocabulary_cards`, `learning_exercises`, `learning_reading_texts` und `learning_videos`, jeweils mit `unit_id → learning_units.id`. Alle 512 Vokabelkarten, 604 Grammatikübungen und 149 Aussprachetexte bleiben erhalten. Die 30 bisher nur einer CEFR-Familie zugeordneten Texte erhalten eindeutige Einheiten; B2/C1/C2 bleiben zunächst inaktiv und im Lehrer-CMS erreichbar.
- `vocabulary_direction_progress` ist die einzige Vokabelfortschrittstabelle. Onboarding und Lektionsreset verweisen auf eine UUID-Einheit. Niveau-, Trainer- und Einzelfreigaben bleiben relational und RLS-geschützt. Deutsch als Lernersprache gibt keine Trainer frei.
- Ein schwarzes Brett pro Schüler: `teacher_student_notes.student_id` ist eindeutig. Keine Rabattspalte, kein Zusatzflag, kein unsichtbares Ersatzzeichen für leere Notizen. Die aktuelle Unterhaltung verwendet ausschließlich `pronunciation_messages`; abgelöste Wiederholungsversuch-Spalten entfallen.
- Die acht Kompatibilitäts-Views, die Stripe-Felder und die nicht mehr verwendeten Stripe-Routen werden entfernt. Generierte TypeScript-Typen stammen aus der migrierten lokalen PostgreSQL-Kopie, einschließlich tatsächlicher 1:1-Beziehungen.

## Privatunterricht und Zahlungsübersicht

Privatunterricht Online kostet 25 € je 45 Minuten. Das Mengenfeld lässt ganze Zahlen von 1 bis 1.000 per Eingabe und Plus/Minus zu. Beispielsweise ergeben vier Einheiten **100 €**. Registrierung, Folgemonatsauswahl, Historie, Lehreransicht und E-Mail bestätigen dieselbe Anzahl und Preisgrundlage.

Der Browser übermittelt nur Kurs-UUIDs und gegebenenfalls `requested_units`. Die Datenbank berechnet den Preis. Fehlende, negative, gebrochene, doppelte oder überhöhte Mengen sowie Mengen an Kalenderkursen werden atomar abgelehnt. Der Monatsprozess übernimmt gewählte private Einheiten; eine ausdrücklich pausierte Buchung hat eine leere Auswahl. Revisionskonflikte und bereits erstellte Rechnungen schützen vor nachträglichem Überschreiben. Ein nach Buchung verwendetes Preismodell kann nicht von Kalenderberechnung auf freie Einheiten oder zurück gewechselt werden.

## Sicherung und Umstellung

Die vollständige Sicherung vor dem Umbau liegt auf dem VPS unter `/root/backups/sitov-before-canonical-cleanup-20260913T153735Z`: PostgreSQL-Dump, Rollen und geschützte Konfiguration samt Storage. SHA-256 des Dumps: `ff928958cef1f6de5558cc209b4cfec1b718076c9ad51e44d8249a3ee29a77a0`.

Der Dump wurde in einem isolierten Container mit PostgreSQL 15.8 vollständig wiederhergestellt. Die Migration `20260913154030_canonical_schema_and_private_units.sql` läuft in einer Transaktion. Eine zusätzliche aktuelle Sicherung wird unmittelbar vor der produktiven Umstellung erstellt. Das neue Release wird vorher gegen die isolierte Datenbank gebaut; erst dann werden Datenbank und Anwendung gemeinsam umgeschaltet. Ein altes Anwendungsrelease darf nach einer inkompatiblen Schemamigration nicht allein zurückgeschaltet werden.

`supabase/schema.sql` dokumentiert ausschließlich den aktuellen Anwendungsvertrag. `supabase/seeds/vps-content.sql` enthält nur Katalog-/Trainerinhalte und Lookup-Tabellen, keine Personen, Buchungen, Fortschritte oder privaten Aufnahmen. Wiederholtes Einspielen ergänzt fehlende IDs, ohne bearbeitete Inhalte zu überschreiben.

## Prüfstand

Die komplette Migration bestand auf einem frischen Restore; der Inhaltsseed wurde zweimal unverändert eingespielt. TypeScript ist fehlerfrei. 84 Jest-Suites mit 1.074 Tests bestanden (ein Opt-in-Netzwerktest bleibt übersprungen), ebenso 225 isolierte PostgreSQL-/Mailtests. Elf echte REST-Testgruppen am VPS-Clone prüften Mengenberechnung, atomare Ablehnung falscher Eingaben, Monatsübernahme, Revisionskonflikte, Rechnungsstatus, Kurs-CMS, fremde Daten/Rollenänderungen und UUID-Freigaben. Keine externen Testmails wurden verschickt. Produktionsbuild und abschließende Live-Prüfung folgen vor Abschluss der Umstellung.
