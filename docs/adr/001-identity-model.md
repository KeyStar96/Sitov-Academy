# ADR 001: Geschäftsidentität und Auth-Identität getrennt halten

Status: angenommen (Option A aus CODEX, Phase 2.0).

## Entscheidung

`public.people.id` bezeichnet eine Geschäftsidentität. `bookings.person_id`
und `invoice_cases.person_id` bleiben Fremdschlüssel auf diese Identität.
Ein Mensch kann bereits eine Kursanmeldung besitzen, ohne ein Konto zu haben.

`public.profiles.id` bezeichnet dagegen das Konto und verweist auf
`auth.users.id`. Lernbezogene Spalten heißen deshalb `auth_user_id`.
`people.auth_user_id` ist bereits korrekt benannt und bleibt unverändert.
Die öffentlichen RPC-Parameter `p_user_id` und `p_student_id` bleiben stabil.

Die elf betroffenen Spalten sind `user_id` in:

- `public.student_level_access`
- `public.learning_trainer_grants`
- `public.learning_unit_grants`
- `public.user_exercise_progress`
- `public.vocabulary_direction_progress`
- `public.vocabulary_learning_state`
- `public.vocabulary_onboarding`
- `public.submissions`
- `vocabulary_private.answer_receipts`
- `learning_reset_private.audio_objects`
- `learning_reset_private.jobs`

Die Angabe „13 Stück“ im ursprünglichen Auftrag war eine Zähldifferenz:
Schema und konkrete Liste enthalten elf umzubenennende Spalten.

## Umsetzung und Integrität

`supabase/vps/02_identity_alignment.sql` benennt ausschließlich vorhandene
Spalten mit `ALTER TABLE ... RENAME COLUMN` um. Es werden weder Tabellen
ersetzt noch IDs zusammengeführt oder Datensätze umgeschrieben.
Spaltenpositionen, gespeicherte Werte, Fremdschlüssel, Indizes und Grants
bleiben erhalten. Bereits umbenannte Spalten sind ein idempotenter No-op;
fehlende Tabellen oder widersprüchliche Spalten führen zum Abbruch.

PostgreSQL führt gebundene RLS-Ausdrücke, Fremdschlüssel und View-Abhängigkeiten
bei der Umbenennung mit. Gespeicherte SQL-/PL/pgSQL-Funktionsbodies benötigen
eine Anpassung. Die Migration aktualisiert eine explizite Liste der zwanzig
betroffenen Funktionen aus deren tatsächlich installierten Definitionen.
Ersetzt wird nur das vollständige Token `user_id`; Parameternamen,
Funktionssignaturen, Eigentümer, Berechtigungen und andere Logik bleiben
erhalten. Das verhindert auch, dass eine Wiederholung neuere Funktionslogik
mit einem veralteten Funktionssnapshot überschreibt. Abschließende
Katalogprüfungen lehnen verbliebene Referenzen ab.

`learning_unit_grants` bindet das Konto über den zusammengesetzten FK auf
`learning_trainer_grants`; `audio_objects` verweist auf `jobs`. Bei `jobs`
und `answer_receipts` existierte vor der Migration kein direkter FK auf
`profiles`. Die Umbenennung erfindet keine zusätzlichen Beziehungen.

## Registrierung und Berechtigungen

`provision_profile()` erzeugt zunächst eine neue Geschäftsidentität zum Konto.
`claim_person()` darf einen einzelnen unbeanspruchten Kandidaten nur anhand
der verifizierten E-Mail zuordnen. Der bestehende Buchungsschutz betrifft die
frische Kontoidentität: Deren vorhandene Buchungen verhindern einen
automatischen Wechsel. Buchungen am anonymen Kandidaten bleiben erhalten.
Mehrdeutige Zuordnungen gehören in einen durch Staff autorisierten Ablauf.
Eine Spaltenumbenennung verändert diese Schutzregeln nicht.

## Deployment und Rückweg

Vor der Migration gilt R8: vollständiges Backup mit dokumentierter SHA256.
Die Migration läuft innerhalb der durch den Deployment-Runner geöffneten
Transaktion. Anwendung und Datenbank müssen gemeinsam auf den neuen
Spaltenvertrag wechseln. Schema-Dump und generierte Typen folgen dem
tatsächlich migrierten Schema.

Ein Rollback nimmt zuerst später ausgeführte, davon abhängige Migrationen
zurück. Die kommentierten inversen `RENAME COLUMN`-Befehle und der
Funktions-Rückweg stehen am Ende der Migration. Die inverse tokenexakte
Anpassung gilt nur für dieselben zwanzig Funktionen; sie darf nicht global
auf `people.auth_user_id` angewendet werden. Bei weitergehenden Änderungen
werden die ursprünglichen Funktionsdefinitionen aus dem R8-Backup
wiederhergestellt. Danach wird die passende vorherige Anwendung aktiviert.
Kein Rückweg löscht Lern- oder Geschäftsdaten.
