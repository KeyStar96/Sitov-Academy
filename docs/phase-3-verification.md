# Phase 3.1–3.3 — Didaktik und Soft-Errors

Stand: 20.09.2026. Freigegebener Umfang: ausschließlich 3.1–3.3 einschließlich R5-Korrektur. 3.4 und 3.5 bleiben offen. Implementierung und Klon-Abnahme abgeschlossen; Produktionsnachweise folgen vor Abschluss.

## Verhalten und Checkliste

- [x] **3.1:** `accepted_answers` ist kanonisch. Migration 06 vereinigt vorhandene Legacy-Listen verlustfrei, entfernt `alternative_answers` und verhindert neue Legacy-Keys. Der explizite Übergangs-Fallback bleibt bis zum geforderten Folge-Release erhalten. Ein kanonischer Alternativwert ergibt in der Datenbank `completed=true`.
- [x] **3.2:** Der private PostgreSQL-Grader liefert ausschließlich `EXACT`, `SOFT_ERROR`, `INCORRECT` mit `matched`/`reason`; ungültige Eingaben liefern strukturierte `error`/`message`-JSONB. ENUMs definieren Status und Gründe. Priorität: Satzzeichen → Großschreibung → Umlaut → Tippfehler, nach einem Exact-Durchlauf über alle Alternativen. Keine Kombination unterschiedlicher Fehlerklassen. Leerraum wird vor dem Vergleich getrimmt/vereinheitlicht. Wortweise Levenshtein-Summe höchstens eins; beide abweichenden Wortlängen mindestens vier. Wortfolge, Wortzahl und kurze grammatische Wörter bleiben geschützt. Keine Extension oder externen Dienste erforderlich.
- [x] **3.2 Fortschritt/UI:** Soft-Error zählt als abgeschlossen; gespeicherter Score maximal 90, ausdrücklich auch nach einem früheren Score 100. Sonst bleibt die bisherige Versuchswertung erhalten. Multiple-Choice verlangt die richtige diskrete Option. Client-Vorschau bestimmt weder Fortschritt noch Weiter-Navigation. Deutsche Validator-Warnstrings entfernt, vier Dictionary-Gründe in fünf Sprachen, gelber Badge mit `--warning`/`--warning-foreground`.
- [x] **3.3:** Vokabel-Sätze und Wörter werden in beiden Richtungen serverseitig bewertet. Deutsche Nomen verlangen Artikel+Wort; Zielübersetzungen stammen aus der ausgewählten Interface-Locale. `p_is_correct` bleibt API-kompatibel, beeinflusst die Bewertung aber nie. Fehlende getippte Antworten werden explizit abgewiesen. Soft-Error erhöht die Box ohne Lapse und begrenzt das Intervall auf die vorherige Phase, einschließlich Schwierigkeitshalbierung. JSON liefert `softError` sowie die kanonische Lösung.
- [x] **Idempotente Antworten:** Retry behält Antwort und Request-ID. Alte serverseitig bewertete Satz-Receipts erhalten fehlende Ergebnisfelder ohne Neubewertung; alte Bool-only-Reviews werden nicht erneut akzeptiert. Fehler rollen Bewertung, Cursor und Receipt gemeinsam zurück.

## Automatisierte Abnahme

| Prüfung | Ergebnis / Nachweis |
|---|---|
| Alle Jest-Suites, Live-Integration eingeschaltet | **95 Suites, 1.220 Tests bestanden**, keine übersprungen. `/tmp/sitov-phase3-jest-final.log`. |
| Alle `supabase/tests/*.test.mjs`, seriell auf dem VPS | **285/285 bestanden**, keine übersprungen. `/root/backups/phase3-db-all.log`. |
| Neue DB-Regressionen | **27/27 bestanden**; `soft-errors.test.mjs`, `vocabulary-learning.test.mjs`. Historische Suite bytegleich verschoben, keine Anforderungen entfernt. |
| Echt-PostgreSQL-Katalog | `deploy/vps/tests/phase3-catalog.sql`: Status/Gründe, Unicode, Kurzwortschutz, Enum-Contract, ACLs, `SECURITY DEFINER`, leerer `search_path`, kanonische Inhalte und öffentliche JSONB-Fehler. |
| Vollständiger Migrations-Replay im Klon | `02 → 03 → 01 → 04 → 05 → 06` in einer Transaktion erfolgreich; separate Migration 06 zuvor ebenfalls erfolgreich. |
| Browsergesamtsuite auf gebauter Anwendung | **9/9 bestanden** via `e2e/phase3.config.ts`: echte Auth/RPC/DB, kanonische Alternative, Eingabe-Reset, russischer Warnbadge, Score 90, Wort-Tippfehler, Boxaufstieg, altes Intervall und unveränderte Lapses. `/tmp/sitov-phase3-browser-final.log`. |
| Typen / Build | `npx tsc --noEmit --incremental false` und `npm run build` bestanden. |
| Migrations-/Deploy-/Storage-Runner | **20 Python-Tests bestanden**, einschließlich Phase-3-Freigabe im Runner und Ablehnung eigener SQL-Transaktionsklammern. |
| Dictionaries / Warnkontrast | Exakte Strukturparität; alle vier Warntexte in jeder Sprache gerendert, beide Warnpaletten ≥4,5:1 Textkontrast. |
| R6 | Bestehenden Kontrast-Ausnahmefilter entfernt. Aufgedeckte Grautextfehler auf der Kündigungsseite durch vorhandenes `--muted` ersetzt. Die drei Browser-Kontrasttests bestehen ohne Ausnahmen. |

Die aus Phase 1 bekannten zwölf Grammatikfehler sind im vollständigen Lauf enthalten und behoben. Die zuvor leeren Lernflow-Browsertests wurden durch echte UI/RPC/DB-Prüfungen ersetzt. Die private Testumgebung verwendet einen isolierten VPS-Klon und einen SMTP-Verwerfer; keine Test-E-Mails werden versendet. RAM-/CPU-Limits unverändert.

## R7 — Schema und Typen

Migration: `supabase/vps/06_soft_errors.sql`; Transaktion und PostgREST-Reload durch `deploy/vps/migrate-local.py`. `supabase/schema.sql` wird als vollständiger Schema-Dump exportiert. `supabase/database.types.ts` wird mit dem laufenden postgres-meta-Generator neu erzeugt; der öffentliche Typenvertrag bleibt unverändert, da neue Enums/Helper privat und RPC-Ergebnisse bereits JSONB sind.

Exakter Produktions-Dump-Befehl:

```sh
docker exec supabase-db-eknmzxvqilojjicinatnllbt pg_dump -U supabase_admin -d postgres --schema-only --no-owner --schema public --schema business_private --schema grammar_private --schema identity_private --schema learning_private --schema learning_reset_private --schema platform_private --schema private --schema pronunciation_private --schema trainer_access_private --schema vocabulary_private --schema media_private
```

Exporter: `deploy/vps/export-phase2-schema.py`. Nicht im App-Dump: Supabase-verwaltete `auth`, `storage`, `realtime`, `extensions`, `graphql`, `vault`, `cron`, `net` und Migrationshistorie. Diese Daten bleiben im vollständigen R8-Backup enthalten. Keine lokalen DB-Migrationen.

## R8 / R9 — Backup und Rückweg

Vor der ersten DB-Teständerung: `python3 deploy/vps/migrate-local.py --backup-only` auf dem VPS. Backup `/root/backups/sitov-phase2-20260920T122117655516Z`; PostgreSQL SHA256 `63e3ac3c1396d01d120af4d6d1e3cf07c1ed0be010fd4c81bec0b0e0474437f1`; 392 Storage-Objekte gesichert. Weitere Runner-Backups vor jedem Migrationslauf.

Unmittelbares Produktionsbackup und aktivierte Revision werden nach dem Rollout ergänzt.

Geschützter funktionaler Rollback: aus den vier ursprünglichen Produktionsdefinitionen erzeugtes `pre-06-rollback.sql`, SHA256 `ceffe7c71c137bd56faf4bbd56a05797e4bafc7d927b834887e4ae09e93bf110`. Es restauriert die drei Bewertungs-/Receipt-Funktionen und den Content-Validator, revalidiert den CHECK und entfernt vier neue Helper und zwei Enums mit `RESTRICT`. App und Mailworker vorher stoppen; danach passenden vorherigen Release aktivieren. Neue Receipt-Felder können beim funktionalen Rückweg verbleiben; bestehender Lernfortschritt bleibt erhalten. Für einen bytegleichen Datenrückweg vollständiges R8-Backup samt passender App wiederherstellen. Kein automatischer Rückwechsel auf eine alte App nach unklarem Migrations-Commit.
