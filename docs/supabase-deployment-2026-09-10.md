# Live-Deployment: bidirektionales Vokabellernen

Am 10. September 2026 direkt über das autorisierte Supabase-Plugin auf Projekt `wcaslabeiwtvygxtzcio` angewendet. Die Profil-/Buchungsmigrationen vom 9. September waren bereits vorhanden und wurden nicht erneut ausgeführt.

| Lokale Migration | Supabase-Version | Ergebnis |
| --- | --- | --- |
| `20260910133125_vocabulary_bidirectional_learning.sql` | `20260910140547` | Erfolgreich |
| `20260910135831_vocabulary_context_content.sql` | `20260910140553` | Erfolgreich |

Beide SQL-Dateien wurden unverändert aus dem Repository an `apply_migration` übergeben. Die Transaktionen setzen Lock- und Statement-Timeouts. Vorher wurden Live-Spalten, Tabellen, Fortschrittsbestand und NULL-Werte geprüft; das isolierte PostgreSQL-Szenario bestand 19 Tests einschließlich RLS, Legacy-Kompatibilität und manipulierter Satzantworten.

## Nachweis der Datenbewahrung

Prüfung unmittelbar nach Anwendung:

| Prüfung | Ergebnis |
| --- | --- |
| Alte `user_vocabulary_progress` | 195 Zeilen, unverändert |
| Prüfsumme der vollständigen alten Fortschrittszeilen | `24c76dbbb5311bf98499e844e815e318` vor und nach Migration |
| Vorwärtsrichtung | 195 Zeilen; 0 Abweichungen zur vollständigen Originalzeile einschließlich ID |
| Neue Rückwärtsrichtung | 195 eigene Zeilen, Phase 1 |
| Vokabelbestand | 512 Zeilen erhalten |
| Prüfsumme ursprünglicher Vokabelspalten | `465d97cefaaee92242df5b6ff9b7a499` vor und nach Migration |
| Deutscher Kontext vorhanden | 512 Zeilen |
| Satzübungen mit fünf vollständigen Sprachvarianten | 26 Zeilen (24 unterschiedliche Wörter) |

Prüfsummen: `md5(string_agg(to_jsonb(row)::text, '' order by id))`; für den Vokabel-Nachvergleich wurden ausschließlich die sieben neu angelegten Spalten aus dem JSON entfernt. Keine Benutzer-, Registrierungs-, Buchungs- oder Lernfortschrittsdaten wurden gelöscht oder zurückgesetzt.

## Rechte und Nachprüfung

Alle drei neuen Tabellen haben RLS. `authenticated` hat eigenen SELECT-Zugriff, aber keine direkten UPDATE-Rechte auf Richtungsstände. `anon` kann weder neue Fortschritte lesen noch die Review-RPC aufrufen. Die öffentlichen RPCs sind `SECURITY INVOKER`; die privaten Implementierungen prüfen Nutzer und Niveau bzw. explizite Lehrer-/Adminrolle. Die TypeScript-Datenbanktypen wurden nach Anwendung erneut aus der Live-Datenbank generiert.

Security- und Performance-Advisors wurden nach der Migration ausgeführt. Keine neue Security-Warnung für die hinzugefügten Objekte. Die neuen Indizes wurden unmittelbar nach Erstellung erwartungsgemäß als noch ungenutzt gemeldet und beibehalten.

Vorher bestehende Hinweise bleiben dokumentiert: [veränderlicher Suchpfad](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable) bei `handle_registration_confirmation`, [öffentlich ausführbare Definer-Funktionen](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) bei alten Auth-/Registrierungstriggern, [authentifizierte Definer-Aufrufe](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), sowie [deaktivierter Schutz vor geleakten Passwörtern](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Private Buchungshilfstabellen ohne Client-Policies bleiben absichtlich gesperrt. Bestehende Performance-Hinweise betreffen ältere Tabellen/Policies; es wurden keine Indizes oder Bestandsdaten gelöscht.

Dies dokumentiert das Datenbank-Deployment. Das neue Next.js-Frontend wird separat mit dem normalen Website-Deployment veröffentlicht.
