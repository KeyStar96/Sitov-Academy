# Phase 0 – lesender VPS-Bestand

Erhoben: `2026-09-25T20:09:48.974782+00:00` (22:09 Uhr Europe/Berlin). PostgreSQL `15.8`; `transaction_read_only = on`. Die Abfrage lief mit `REPEATABLE READ READ ONLY`, 30 Sekunden Statement-Limit und anschließendem `ROLLBACK`. Keine Produktivdaten oder Konfigurationen wurden verändert.

## Release und Betrieb

| Ort | Erwartet | Gefunden | Delta |
|---|---|---|---|
| Lokaler Branch / origin nach Fetch | Produktionszweig, synchron | `codex/vps-self-hosted`, HEAD `e123fab0ba49177c3c15f06db10249d92eb688d9`, kein Ahead/Behind | Kein Pull-Merge nötig |
| `/var/www/sitov-current` | Aktives Release ermitteln | `/var/www/sitov-releases/5f12313ac51e` | Unterschied zur lokalen Revision besteht aus Dokumenten, Seeds und Tests; keine App-Laufzeitdatei unterschiedlich |
| `.sitov-prepared` und VPS-Quellcheckout HEAD | Vollständige Release-Revision | Beide `5f12313ac51e1f4fbe5fd04eb01d6ccefebaa90c` | Release in Phase 0 nicht gewechselt |
| `/api/health` (Loopback und HTTPS-Domain) | `ready` | Beide `{"status":"ready"}` | Health enthält keine Revision, daher zusätzlich Symlink/Marker geprüft |
| `sitov-app`, `nginx`, `sitov-tts` | Aktive Dienste | Alle `active` | Kein Eingriff |
| `sitov-mail.service` | Mail-Worker aktiv | `loaded`, `enabled`, `inactive/dead`; `Result=success`, Exit-Status 0, seit 25.09.2026 12:36:29 UTC | **Betriebsabweichung für Phase 6/8**; Ursache/Absicht ungeklärt, nicht neu gestartet; keine Aussage zur aktuellen Mailzustellung möglich |
| App-Ressourcen | Grenzen unverändert | `MemoryMax=2147483648`, `IPAddressDeny=0.0.0.0/0 ::/0`; Host 7884 MiB RAM, 3049 MiB verfügbar beim Abruf, kein Swap | Keine Limits geändert, keine Dienste installiert |
| `deploy/vps/migrate-local.py:15`, `supabase/vps/` | Letzte Migration und nächste freie Nummer | `29_student_level_access_notification.sql`; **30** frei | Kein Nummernverbrauch in Phase 0 |
| Live-Effekte Migration 28/29 | Mail-Enum und Trigger vorhanden | `level_access_granted`; `business_private.notify_student_of_level_access()`; AFTER INSERT Trigger `on_student_level_access_granted_notify` auf `public.student_level_access` | Schemaeffekte bestätigt; kein Nachweis einer Ausführungszeit der Migration |
| `supabase_migrations.schema_migrations` | Nummerierte VPS-Migrationen nachvollziehbar | Enthält historische Zeitstempel bis `20260913154030`, keine nummerierte 01–29-Historie | Für VPS-Reihe Registry + Live-Katalog verwenden; keine fiktiven Ledger-Einträge behaupten |

## A1.1: Vokabel-Lektionen und Reihenfolge

**7 aktive gemeinsame Kurslektionen, 512 Karten**, aufsteigend `sort_order = 1…7`. Private Einheiten (`owner_auth_user_id IS NOT NULL`) sind ausdrücklich nicht Teil der Kurszählung. Inhaltlicher Abgleich anhand der gemeinsamen deutschen Wortfelder mit dem Lernzielkatalog in `ZWISCHENBERICHT.md`, Abschnitt 6; keine Buchtexte oder Buchseiten als Referenz kopiert.

| Lektion | Sortierung | Karten | Geprüfter Themenbereich | Zuordnung zum Zielpfad |
|---|---:|---:|---|---|
| Lektion 1 | 1 | 84 | Begrüßung, Namen, Länder, Sprachen, Alphabet und Anmeldung | Pfad 1: thematisch passend |
| Lektion 2 | 2 | 85 | Familie, Personenangaben, Befinden und Zahlen 0–20 | Pfad 2: thematisch passend |
| Lektion 3 | 3 | 76 | Lebensmittel, Einkaufen, Mengen und Preise | Pfad 3: thematisch passend |
| Lektion 4 | 4 | 73 | Wohnung, Möbel, Farben und Beschreibungen | Pfad 4: thematisch passend |
| Lektion 5 | 5 | 68 | Tagesablauf, Wochentage, Uhrzeit und trennbare Verben | Pfad 5: thematisch passend |
| Lektion 6 | 6 | 80 | Freizeit, Hobbys, Wetter und Jahreszeiten | Pfad 6: thematisch passend |
| Lektion 7 | 7 | 46 | Schule, Können/Wollen und Vergangenheit | Pfad 7: thematisch passend |

Die **Reihenfolge passt thematisch** zu allen sieben Zielpfaden. Dies ist kein Vollständigkeitsnachweis jedes Lernziels und keine urheberrechtliche Herkunftsprüfung des Altbestands. Der Altbestand enthält auch Satzkarten und Figurennamen; Phase 4 muss neue Aufgaben eigenständig formulieren (R14), statt Alttexte ungeprüft zu übernehmen.

## Grammatikbestand pro Niveau

| Niveau | Units gesamt | Aktiv | Aufgaben | `incomplete` | `content_status IS NULL` |
|---|---:|---:|---:|---:|---:|
| A1.1 | 10 | 10 | 102 | 102 | 0 |
| A1.2 | 10 | 10 | 101 | 101 | 0 |
| A2.1 | 10 | 10 | 101 | 101 | 0 |
| A2.2 | 10 | 10 | 100 | 100 | 0 |
| B1.1 | 10 | 10 | 100 | 100 | 0 |
| B1.2 | 10 | 10 | 100 | 100 | 0 |
| B2 | 0 | 0 | 0 | 0 | 0 |
| C1 | 0 | 0 | 0 | 0 | 0 |
| C2 | 0 | 0 | 0 | 0 | 0 |

**Summe: 60 aktive Grammatik-Units, 604 Aufgaben, alle 604 `incomplete`, 0 `ready`.** Der Seed mit 600 Aufgaben bildet nicht den vollständigen Live-Bestand ab. Die vier zusätzlichen Aufgaben verteilen sich auf A1.1 (+2), A1.2 (+1), A2.1 (+1). B2/C1/C2 existieren als Niveau-Katalogeinträge, haben aber keine Grammatik-Units. Keine Archivierung oder Freigabe in Phase 0.

## Enum und Content-Constraint

`public.exercise_type` in Enum-Reihenfolge: `fill_in_blank`, `multiple_choice`, `sentence_building`.

Der Verweis „Constraint aus 2.6“ bezieht sich auf `CODEX.md`, Abschnitt 2.6 (Master 3.0), nicht auf Phase 2.6 des neuen Prompts. Tatsächlich bestehende Constraints:

| Ort | Erwartet | Gefunden | Delta |
|---|---|---|---|
| `public.learning_exercises.exercises_pkey` | Gültiger Bestandsconstraint | `PRIMARY KEY (id)` | Unverändert; bei neuen Typen/Content-Versionen berücksichtigen |
| `public.learning_exercises.learning_exercises_unit_id_fkey` | Gültiger Bestandsconstraint | `FOREIGN KEY (unit_id) REFERENCES learning_units(id)` | Unverändert; bei neuen Typen/Content-Versionen berücksichtigen |
| `public.learning_exercises.learning_exercises_content_version_check` | Gültiger Bestandsconstraint | `CHECK ((content_version = 1))` | Unverändert; bei neuen Typen/Content-Versionen berücksichtigen |
| `public.learning_exercises.grammar_content_object` | Gültiger Bestandsconstraint | `CHECK ((jsonb_typeof(content) = 'object'::text))` | Unverändert; bei neuen Typen/Content-Versionen berücksichtigen |
| `public.learning_exercises.learning_exercises_accepted_answers_check` | Gültiger Bestandsconstraint | `CHECK (grammar_private.valid_accepted_answers(content, type))` | Unverändert; bei neuen Typen/Content-Versionen berücksichtigen |

`grammar_private.valid_accepted_answers(content,type)` verlangt ein JSON-Objekt ohne Schlüssel `alternative_answers`; `accepted_answers` muss ein Array mit höchstens 21 nichtleeren Strings (je 1–1000 Zeichen) sein. Normalisierte Duplikate sind verboten. Bei `multiple_choice` ist genau eine Antwort erforderlich. Außer für `sentence_building` muss `correct_answer` nichtleer und normalisiert im Antwortarray enthalten sein. Für `sentence_building` erlaubt die Funktion unter diesen Bedingungen ein leeres Antwortarray; eine allgemeine Behauptung „mindestens eine Antwort für jeden Typ“ wäre falsch. `target_form` ist nicht Bestandteil dieser Constraint-Funktion; zusätzliche Qualitäts-/Freigabeprüfung kommt aus Migration 07.

Der genaue, lesend ermittelte Funktionskörper:

```sql
CREATE OR REPLACE FUNCTION grammar_private.valid_accepted_answers(p_content jsonb, p_type exercise_type)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
DECLARE answers jsonb:=p_content->'accepted_answers';
BEGIN
 IF jsonb_typeof(p_content) IS DISTINCT FROM 'object' OR p_content ? 'alternative_answers'
  OR jsonb_typeof(answers) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 IF jsonb_array_length(answers)>21 OR EXISTS(SELECT 1 FROM jsonb_array_elements(answers) a
  WHERE jsonb_typeof(a) IS DISTINCT FROM 'string' OR length(btrim(a#>>'{}')) NOT BETWEEN 1 AND 1000) THEN RETURN false; END IF;
 IF p_type='multiple_choice' AND jsonb_array_length(answers)<>1 THEN RETURN false; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements_text(answers))<>(SELECT count(DISTINCT lower(regexp_replace(btrim(a),'\s+',' ','g')))
  FROM jsonb_array_elements_text(answers) a) THEN RETURN false; END IF;
 RETURN p_type='sentence_building' OR (nullif(btrim(p_content->>'correct_answer'),'') IS NOT NULL AND EXISTS(
  SELECT 1 FROM jsonb_array_elements_text(answers) a WHERE lower(regexp_replace(btrim(a),'\s+',' ','g'))=
   lower(regexp_replace(btrim(p_content->>'correct_answer'),'\s+',' ','g'))));
END $function$
```

## Angefragte Tabellen: vollständige Spaltenmatrix

Erwartung je Zeile: bestehende Spalte für die Folgeplanung erfassen. Es wurden ausschließlich `information_schema.columns` und Katalogdaten gelesen, **keine Profil- oder Outbox-Zeilen**. Die Default-Ausdrücke stammen aus dem Katalog.

| Ort | Erwartet | Gefunden (Typ; NULL; Default) | Delta |
|---|---|---|---|
| `private.mail_outbox.id` | Live-Spalte erfassen | `uuid`; NULL NO; `gen_random_uuid()` | Bestand bestätigt |
| `private.mail_outbox.dedupe_key` | Live-Spalte erfassen | `text`; NULL NO; `—` | Bestand bestätigt |
| `private.mail_outbox.kind` | Live-Spalte erfassen | `mail_kind`; NULL NO; `—` | Bestand bestätigt |
| `private.mail_outbox.recipient` | Live-Spalte erfassen | `text`; NULL NO; `—` | Bestand bestätigt |
| `private.mail_outbox.locale` | Live-Spalte erfassen | `text`; NULL NO; `'de'::text` | Bestand bestätigt |
| `private.mail_outbox.payload` | Live-Spalte erfassen | `jsonb`; NULL NO; `'{}'::jsonb` | Bestand bestätigt |
| `private.mail_outbox.status` | Live-Spalte erfassen | `mail_status`; NULL NO; `'pending'::mail_status` | Bestand bestätigt |
| `private.mail_outbox.attempts` | Live-Spalte erfassen | `int4`; NULL NO; `0` | Bestand bestätigt |
| `private.mail_outbox.available_at` | Live-Spalte erfassen | `timestamptz`; NULL NO; `now()` | Bestand bestätigt |
| `private.mail_outbox.lease_until` | Live-Spalte erfassen | `timestamptz`; NULL YES; `—` | Bestand bestätigt |
| `private.mail_outbox.lease_token` | Live-Spalte erfassen | `uuid`; NULL YES; `—` | Bestand bestätigt |
| `private.mail_outbox.worker_id` | Live-Spalte erfassen | `uuid`; NULL YES; `—` | Bestand bestätigt |
| `private.mail_outbox.last_error` | Live-Spalte erfassen | `text`; NULL YES; `—` | Bestand bestätigt |
| `private.mail_outbox.message_id` | Live-Spalte erfassen | `text`; NULL YES; `—` | Bestand bestätigt |
| `private.mail_outbox.created_at` | Live-Spalte erfassen | `timestamptz`; NULL NO; `now()` | Bestand bestätigt |
| `private.mail_outbox.sent_at` | Live-Spalte erfassen | `timestamptz`; NULL YES; `—` | Bestand bestätigt |
| `public.learning_units.id` | Live-Spalte erfassen | `uuid`; NULL NO; `gen_random_uuid()` | Bestand bestätigt |
| `public.learning_units.level` | Live-Spalte erfassen | `text`; NULL NO; `—` | Bestand bestätigt |
| `public.learning_units.trainer` | Live-Spalte erfassen | `trainer_code`; NULL NO; `—` | Bestand bestätigt |
| `public.learning_units.label` | Live-Spalte erfassen | `text`; NULL NO; `—` | Bestand bestätigt |
| `public.learning_units.sort_order` | Live-Spalte erfassen | `int4`; NULL NO; `0` | Bestand bestätigt |
| `public.learning_units.is_active` | Live-Spalte erfassen | `bool`; NULL NO; `true` | Bestand bestätigt |
| `public.learning_units.owner_auth_user_id` | Live-Spalte erfassen | `uuid`; NULL YES; `—` | Bestand bestätigt |
| `public.learning_vocabulary_cards.id` | Live-Spalte erfassen | `uuid`; NULL NO; `gen_random_uuid()` | Bestand bestätigt |
| `public.learning_vocabulary_cards.word_de` | Live-Spalte erfassen | `text`; NULL NO; `—` | Bestand bestätigt |
| `public.learning_vocabulary_cards.article` | Live-Spalte erfassen | `grammatical_article`; NULL YES; `—` | Bestand bestätigt |
| `public.learning_vocabulary_cards.plural` | Live-Spalte erfassen | `text`; NULL YES; `—` | Bestand bestätigt |
| `public.learning_vocabulary_cards.image_url` | Live-Spalte erfassen | `text`; NULL YES; `—` | Bestand bestätigt |
| `public.learning_vocabulary_cards.audio_url` | Live-Spalte erfassen | `text`; NULL YES; `—` | Bestand bestätigt |
| `public.learning_vocabulary_cards.created_at` | Live-Spalte erfassen | `timestamptz`; NULL YES; `now()` | Bestand bestätigt |
| `public.learning_vocabulary_cards.sentence_practice` | Live-Spalte erfassen | `bool`; NULL NO; `false` | Bestand bestätigt |
| `public.learning_vocabulary_cards.alternative_answers_de` | Live-Spalte erfassen | `_text`; NULL NO; `'{}'::text[]` | Bestand bestätigt |
| `public.learning_vocabulary_cards.unit_id` | Live-Spalte erfassen | `uuid`; NULL NO; `—` | Bestand bestätigt |
| `public.profiles.id` | Live-Spalte erfassen | `uuid`; NULL NO; `—` | Bestand bestätigt |
| `public.profiles.native_language` | Live-Spalte erfassen | `text`; NULL YES; `—` | Bestand bestätigt |
| `public.profiles.created_at` | Live-Spalte erfassen | `timestamptz`; NULL YES; `now()` | Bestand bestätigt |
| `public.profiles.updated_at` | Live-Spalte erfassen | `timestamptz`; NULL YES; `now()` | Bestand bestätigt |
| `public.profiles.role` | Live-Spalte erfassen | `profile_role`; NULL YES; `'student'::profile_role` | Bestand bestätigt |
| `public.profiles.ui_language` | Live-Spalte erfassen | `text`; NULL NO; `'de'::text` | Bestand bestätigt |

| Ort | Erwartet | Gefunden | Delta |
|---|---|---|---|
| `public.profiles.notify_pronunciation_feedback` | Vorschlag für Phase 6 | Nicht vorhanden | Neue Präferenz erst in Phase 6 |
| `learning_units.owner_auth_user_id` | Eigene Wörter getrennt von Kursinhalt | Nullable UUID vorhanden | Kurszählungen immer auf NULL begrenzen; schema.sql nachziehen in späterer Migrationsphase |
| `learning_vocabulary_cards.alternative_answers_de` | Akzeptierte Satzvarianten | `text[] NOT NULL`, Default leeres Array | Vorhanden |

## Reproduzierbare Katalogabfrage

Ausführung: `ssh sitov-academy` → `docker exec -i supabase-db-eknmzxvqilojjicinatnllbt psql -X -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -Atq`. Nachstehende Projektionen enthalten weder Personen- noch Maildaten. Die Wortfeldprüfung verwendete zusätzlich ausschließlich `word_de` gemeinsamer Kurskarten, ohne private Einheiten und ohne Nutzerfortschritt.

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';
SELECT jsonb_build_object(
'captured_at',clock_timestamp(),'read_only',current_setting('transaction_read_only'),'server_version',current_setting('server_version'),
'columns',(SELECT jsonb_agg(jsonb_build_object('schema',table_schema,'table',table_name,'column',column_name,'type',data_type,'udt',udt_name,'nullable',is_nullable,'default',column_default) ORDER BY table_schema,table_name,ordinal_position) FROM information_schema.columns WHERE (table_schema='public' AND table_name IN ('profiles','learning_units','learning_vocabulary_cards','learning_exercises')) OR (table_schema='private' AND table_name='mail_outbox')),
'constraints',(SELECT jsonb_agg(jsonb_build_object('name',c.conname,'definition',pg_get_constraintdef(c.oid))) FROM pg_constraint c WHERE conrelid='public.learning_exercises'::regclass),
'exercise_type',(SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='exercise_type'),
'vocabulary_a11',(SELECT jsonb_agg(x ORDER BY sort_order,label) FROM (SELECT u.label,u.sort_order,u.is_active,count(c.id) AS cards FROM public.learning_units u LEFT JOIN public.learning_vocabulary_cards c ON c.unit_id=u.id WHERE u.level='A1.1' AND u.trainer='vocabulary' AND u.owner_auth_user_id IS NULL GROUP BY u.id,u.label,u.sort_order,u.is_active) x),
'grammar_levels',(SELECT jsonb_agg(x ORDER BY sort_order) FROM (SELECT l.code,l.sort_order,count(DISTINCT u.id) AS units,count(DISTINCT u.id) FILTER(WHERE u.is_active) AS active_units,count(e.id) AS exercises,count(e.id) FILTER(WHERE e.content_status='incomplete') AS incomplete,count(e.id) FILTER(WHERE e.content_status IS NULL) AS status_null FROM public.learning_levels l LEFT JOIN public.learning_units u ON u.level=l.code AND u.trainer='exercises' LEFT JOIN public.learning_exercises e ON e.unit_id=u.id GROUP BY l.code,l.sort_order) x),
'grammar_statuses',(SELECT jsonb_agg(x) FROM (SELECT coalesce(content_status::text,'NULL') AS status,count(*) FROM public.learning_exercises GROUP BY content_status) x),
'functions',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'signature',pg_get_function_identity_arguments(p.oid),'body',pg_get_functiondef(p.oid)) ORDER BY n.nspname,p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='grammar_private' AND p.proname IN ('valid_accepted_answers')) OR (n.nspname='private' AND p.proname LIKE '%level_access%')),
'migration_ledger',(SELECT coalesce(jsonb_agg(version ORDER BY version),'[]') FROM supabase_migrations.schema_migrations)
);
ROLLBACK;
```
