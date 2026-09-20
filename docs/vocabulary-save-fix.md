# Vokabeltrainer: Speichern nach dem Umbau

Stand: 20.09.2026. Produktiv behoben durch `15_grading_helper_permissions.sql`; R1–R11 berücksichtigt. Kein Profilreset, keine Änderung an Lerninhalten, Ressourcenlimits oder Monitoring.

## Ursache und Änderung

Die öffentliche RPC `submit_vocabulary_answer_once` lieferte für einen bestehenden Lernstand `not_authorized`, SQLSTATE `42501`. Ein zurückgerollter Diagnoseaufruf der privaten Bewertungsfunktion zeigte den konkreten Fehler: `permission denied for function normalize_answer`. Die gemeldeten CSS-Preload-Warnungen erklären diesen Datenbankfehler nicht.

Die bestehenden privaten Vokabel- und Grammatikfunktionen gehören produktiv `postgres` (NOSUPERUSER, BYPASSRLS). Die neuen Phase-3-Helfer gehören dem Migrationsbenutzer `supabase_admin`. Nach Entzug der PUBLIC-Rechte fehlte dem älteren Funktions-Owner EXECUTE auf `learning_private.normalize_answer(text)` und `learning_private.grade_answer(text,text[])`. Profilzuordnung und bestehende Fortschrittsreferenzen waren intakt; das Alter des Kontos ist nicht die Ursache.

Migration 15 gewährt ausschließlich diese beiden Ausführungsrechte an `postgres`. Funktionskörper, Owner, Signaturen, SECURITY DEFINER, leerer search_path und Clientrechte bleiben unverändert. Der Migrationsrunner registriert die idempotente Migration nach 14. Auch Grammatik verwendet diese Helfer.

Die bisherige isolierte Testdatenbank verwendete einen gemeinsamen privilegierten Owner und konnte diesen Fehler deshalb nicht erkennen. Der neue Regressionstest bildet die getrennten Owner mit einem NOSUPERUSER nach. PGlite erlaubt keine Herabstufung seines Bootstrap-Superusers; deshalb erbt der simulierte Legacy-Owner dessen Objektberechtigungen, jedoch nicht das SUPERUSER-Attribut. Die Helfer gehören einem getrennten Migrations-Owner.

## Abnahme

| Prüfung | Ergebnis |
|---|---|
| Neue Regression | 6/6 bestanden: ursprünglicher 42501 ohne Teiländerungen, Migration zweimal, korrekte Bewertung, genau ein Receipt bei Retry, Grammatik, Client-/Fremdzugriff gesperrt, inverser REVOKE und erneute Reparatur |
| Vollständige DB-Testreihe auf VPS | `node --test --test-concurrency=1 supabase/tests/*.test.mjs`: **328/328 bestanden**, keine übersprungen |
| Migrationsrunner | `python3 -m unittest discover -s deploy/vps/tests -p 'test_migrate_local.py'`: **10/10 bestanden** |
| Produktive RPC-Prüfung | Bestehende Profile mit Sprache en und ru, jeweils native_to_de und de_to_native: gespeicherter Zielwert korrekt bewertet, Box erhöht, wiederholte Request-ID liefert identische Antwort und genau ein Receipt |
| Datenbestand | Sämtliche Diagnose-/Speicherprüfungen in Transaktionen mit anschließendem ROLLBACK; keine Test-Lernfortschritte dauerhaft gespeichert |
| Produktive ACLs | `postgres`: beide Helfer ausführbar; `anon` und `authenticated`: beide weiterhin gesperrt |
| Betrieb | App, Mail und Nginx aktiv; `/api/health`: `ready`; vorhandenes Release `b7597c37b742` bleibt aktiv |
| Schema | Frisch aus Produktion exportiert: ausschließlich zwei GRANT-Zeilen hinzugefügt; öffentliche TypeScript-Typen neu generiert und bytegleich |

Die erneute Aktivierung des bereits laufenden Releases über das Deploy-Skript wurde von dessen Prüfsummenprüfung abgewiesen. Exakt zehn generierte HTML-/RSC-/Metadateien unter `/de` und `/de/registration` waren verändert; das unveränderte Prerender-Manifest weist für beide Seiten eine automatische Erneuerung alle 300 Sekunden aus. Alle übrigen archivierten Quellen/Buildartefakte und die Build-ID bestanden die Prüfung. Nach Prüfung der unveränderten Anwendung und der ausschließlich additiven Helferrechte wurden die bestehenden Dienste direkt gestartet. Keine Prüfsumme wurde überschrieben oder die Aktivierungsprüfung gelockert. Die Wiederaktivierung eines benutzten Releases mit erneuerten Seiten bleibt eine separate Einschränkung des Deploy-Skripts.

Kein neuer Frontend-Build erforderlich: Die Änderung betrifft nur Datenbankrechte. Die produktive Abnahme erfolgte über die öffentliche Datenbank-RPC unter der Rolle `authenticated`, nicht durch Anmeldung im Browser des Nutzers.

## Backups und Rollback

Vor DB-Arbeiten jeweils `python3 deploy/vps/migrate-local.py --backup-only`; der Produktivrunner sicherte zusätzlich bei gestoppten App-/Mail-Diensten. Alle drei Backups ausschließlich root-lesbar, jeweils 396 Dateiprüfsummen erfolgreich geprüft, einschließlich 392 Storage-Objekten.

| Anlass | Backup unter `/root/backups/` | PostgreSQL-SHA256 |
|---|---|---|
| Vor Diagnose | `sitov-migration-20260920T174020654764Z` | `96937fb72abb77ad09baf31758dce8fdd7a90902b3ae394cd06b0dfe0de2f3d7` |
| Vor Produktivmigration | `sitov-migration-20260920T174857726285Z` | `a503a4fdf6b88901a5b894cc13a24ddf9f77dd9b52a1bf23798e83295760c933` |
| Produktivmigration 15 | `sitov-migration-20260920T174959515969Z` | `f9f313f8ef3b7923486eaee5cf37e62d2ecadae75a6f502a6f32ea499a1887dc` |

Storage-Manifest-SHA256 jeweils `0c1745b09505bab01a1b28fb184488ba44d52af9331a1f61f1976bbb1a6331c2`.

Rollback nach frischem R8-Backup, in einer Transaktion:

```sql
REVOKE EXECUTE ON FUNCTION learning_private.normalize_answer(text),
 learning_private.grade_answer(text,text[]) FROM postgres;
```

Dieser Rückweg stellt die nachgewiesenen bisherigen ACLs wieder her und wurde im Regressionstest geprüft. Er löscht keine Lerndaten, führt jedoch wieder zum Speicherfehler. Eine Datenwiederherstellung ist für diesen reinen Rechte-Rollback nicht erforderlich.

## Export

`python3 deploy/vps/export-phase2-schema.py --database postgres --output /root/backups/vocabulary-save-schema`

```sh
docker exec supabase-db-eknmzxvqilojjicinatnllbt pg_dump -U supabase_admin -d postgres --schema-only --no-owner --schema public --schema business_private --schema grammar_private --schema identity_private --schema learning_private --schema learning_reset_private --schema platform_private --schema private --schema pronunciation_private --schema trainer_access_private --schema vocabulary_private --schema media_private
```

Supabase-verwaltete Schemas Auth, Storage, Realtime, Extensions, GraphQL, Vault, Cron, Net und Migrationshistorie bleiben außerhalb des App-Dumps. `supabase/database.types.ts` stammt aus dem vorhandenen Postgres-Meta-Generator für `public`. Der Dump wurde nicht manuell bearbeitet.
