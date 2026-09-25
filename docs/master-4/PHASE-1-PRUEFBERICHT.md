# Phase 1 — Prüfbericht

## Prüfung vor Änderungen

25.09.2026. Regeln und ausschließlich Phase 1 gelesen. Ausgangsrevision: `81c7a40710b9963a95aa3f633f17ea5b75d59f25`, Branch `codex/vps-self-hosted`, Arbeitsbaum sauber. Die lokale Next-16.3.5-Dokumentation zu Server-/Client-Komponenten und Server Actions wurde gelesen. Die vorhandene Phase-0-Baseline bleibt erhalten.

| Bereich | Ist | Soll / geplante Änderung |
|---|---|---|
| 1.1 Selbsteinschätzung | `VocabCardSession` und `LessonAssessmentClient` zeigen die gefüllte positive Aktion zuerst. Keine seitenspezifischen Gesten gefunden. Gemeinsame Dialoge erhalten Aktionen als Kinder/Footer. | Negative/sekundäre Aktion zuerst, positive gefüllte Aktion zuletzt; weitere Lernenden-/Admin-Paare auditieren und DOM-Reihenfolge testen. |
| 1.2 Bewertung | `grade_answer` aus 06 toleriert Großschreibung/Satzzeichen als SOFT_ERROR; kombinierte Abweichungen fallen durch. `record_attempt` wurde in 07 um Content-Guard ergänzt. Letzter vollständiger `submit_answer` aus 22, nutzt `answer_key` aus 23 für eigene Wörter. Vorschau und Zod-Verträge bilden den alten Vertrag ab. | Migration 30 mit aktuellen Funktionskörpern, neutralem `hint`, voller Wertung bei reiner Großschreibung/Interpunktion, Typografiegleichheit, weiter SOFT_ERROR bei Umlaut/Tippfehler und zwingend INCORRECT bei Distraktoren; Vorschau und Anzeige angleichen. |
| 1.3 Artikel | Beschriftung vorhanden, aber kein vorgelagerter sichtbarer Chip. Keine spezifische PostgreSQL-Rückmeldung für fehlenden/falschen Artikel. | Wiederverwendbarer Chip; serverseitiges `feedback`, unverändert INCORRECT bei Artikelabweichung; farbiger Lösungsartikel und fünf Sprachen. |
| 1.4 Varianten | Satzkarten besitzen `alternative_answers_de`, aber kein `target_form`; Grammatik besitzt bereits Zielformen. | Optionale Spalte, CMS-/Lesevertrag, explizite kartenbezogene Entscheidungen aus vollständigem Audit gemeinsamer Satzkarten, Migration 31; keine globale semantische Gleichsetzung. |
| 1.5 Registrierung | Login überschreibt `status_signup_email_sent` mit `registrationLabels.auth_email_sent`; Bestätigung führt zur Login-Statusseite. Home zeigt nur kleinen No-Level-Text; Kalender ist außerhalb des Zugangs-Guards. | Beide Statusmeldungen und große Freischaltungs-Karte in fünf Sprachen, Hilfe/Kalender erreichbar, Tests beider Zugangsstände. |
| Migration/Betrieb | Nummern bis 29 belegt; `ORDER` steht in `deploy/vps/migrate-local.py`, keine separate ORDER-Datei. `schema.sql` enthält veraltete Funktionsstände. | 30/31 reserviert, Vorgängerstände für Rollback erhalten, Snapshot/Typen nachziehen; Backup über vorhandenen Runner, echter Klon mit doppelter Anwendung, Build vorbereiten → Migration mit `--keep-stopped` → passendes Release aktivieren. |

Die Aufgaben 1.1–1.5 werden parallel mit getrennten Dateizuständigkeiten umgesetzt. Phasen 2–8, insbesondere der neue Lernpfad und der strukturelle Grammatik-Lesevertrag, sind nicht Teil dieser Änderung. Keine Ressourcenlimits oder Hintergrunddienste werden ergänzt.

## Abnahmenachweise

### Implementierter Vertrag

- `EXACT`: `reason: null`, `hint: null | capitalization | punctuation | capitalization_punctuation`. Typografiegleichheit allein erzeugt keinen Hinweis. Reine Großschreibung/Satzzeichen erhalten die volle reguläre Wertung und den regulären Fachschritt. Die bisherigen Regeln für mehrere Fehlversuche bleiben erhalten.
- `SOFT_ERROR`: nur `umlaut | typo`, jeweils `hint: null`. Großschreibung/Satzzeichen werden vor dieser Prüfung neutralisiert. Kurze Wörter wie der/den, ihm/ihn und am/an bleiben strikt. Numerische Abweichungen werden nicht zu Tippfehlern erklärt; Zahlenvarianten müssen pro Karte verfasst werden. Die alte Ein-Zeichen-Toleranz für `2001` gegen `2000` sowie Zahlencodes (`A123`/`A124`) entfällt daher ausdrücklich nach 1.4; nur veränderte Wörter ausschließlich aus Buchstaben können Tippfehler sein. Dezimaltrennzeichen und Inhaltszeichen wie €/%/+ bleiben erhalten.
- Exakte falsche Vorgaben einer Lückenaufgabe sind zwingend `INCORRECT`, auch wenn sie einem gültigen Wort ähnlich sehen. Auswahlaufgaben behalten ihre diskrete Bewertung.
- Vokabel-Erstversuch und reine Wiederholung liefern `hint` und `feedback` (`article_missing | article_wrong | null`). Artikelabweichungen bleiben `INCORRECT`, einschließlich Pluralwörtern. Neue Hinweise werden ausschließlich aus PostgreSQL-Ergebnissen angezeigt.
- Historische idempotente Vokabel-Quittungen behalten ihren gespeicherten Lernstand und ihr Intervall. Nur der ausdrücklich abgegrenzte Legacy-Decoder übersetzt damalige Großschreib-/Satzzeichenwarnungen in neutrale Anzeigehinweise; aktuelle Antworten und Grammatik verwenden den strikten neuen Vertrag.

### Änderungen und Regressionen

Das vollständige R15-Inventar und die Registrierungswege stehen in [phase-1-actions-signup.md](phase-1-actions-signup.md). Die [Variantenliste](varianten-audit.md) enthält alle 26 geprüften Satzkarten, 15 Entscheidungen (7 Zielformen, 8 Alternativen) und 11 weitere geprüfte Karten. Migration 31 archiviert die vorigen Werte privat und erhält spätere CMS-Bearbeitungen bei Wiederholung und Rückweg.

Bestehende Tests wurden inhaltlich angepasst: `grammar-preview.test.ts` und `soft-errors.test.mjs` prüfen neutrale EXACT-Hinweise und kombinierte Abweichungen statt alter Warnungen/Fehler; `vocabulary-learning.test.mjs` prüft volle Fachschritte, Artikelpflicht und aktuellen Funktionsstand; `soft-error-feedback.test.tsx` prüft für fünf Sprachen neutrale Hinweise statt gelber Großschreib-/Satzzeichenwarnungen; `vocabulary-actions.test.ts` prüft den strikten Vertrag und alte Quittungen; die beiden Session-/Assessment-Tests verlangen nun negative Aktion zuerst. Keine Testfälle wurden gelöscht, ausgefiltert oder übersprungen. Neue Fälle sichern Distraktoren, Zahlen, Typografie, Artikel/Plural, Zielformen und unvollständige ältere CMS-Payloads.

Das Code-Review fand zusätzlich, dass voreingestellte leere CMS-Arrays vorhandene Varianten bei älteren Payloads löschen würden. Die Felder sind jetzt optional, explizites Leeren bleibt möglich, die komplette Zod→RPC-Payload-Kette ist getestet. Die neuen CMS-Felder erzwingen über `cn` tatsächlich 16 px und 48 px Mindesthöhe.

### Datenbankklon und Rückweg

Vorbereitung ausschließlich mit vorhandenem `migrate-local.py`, keine Speicher-/Serviceänderung. Erstes vollständiges Backup: `/root/backups/sitov-migration-20260925T203251805580Z`, PostgreSQL-SHA256 `a3b1359edd80aa81a2a69e3b9e501ca476463b4db7c4e9cf60e94b926e5de4d4`, Storage-Manifest `dd923e99ed6fc35b9c6714c5e8f43f59b0693a1bf19be915e0f6dcc54f39c269`, **549 Objekte**. Personendaten und Backup-Dateien bleiben ausschließlich geschützt auf dem VPS.

Der Klon `sitov_phase1_20260925` wurde aus diesem Dump im bestehenden PostgreSQL wiederhergestellt. Zwei anfängliche Restore-Versuche scheiterten an Supabase-Systemobjekten: `pg_cron` ist auf die Datenbank `postgres` beschränkt; die GraphQL-Erweiterung erzeugte ihre verwaltete öffentliche Wrapperfunktion nicht. Der abschließende Restore war Exit 0 mit genau 23 Cron-TOC-Einträgen sowie dem einen ACL-Eintrag für diesen GraphQL-Wrapper ausgespart. Keine Anwendungsfunktion, Anwendungsberechtigung oder Anwendungs-/Auth-Datentabelle wurde ausgespart. Kein Serverparameter und kein Produktivobjekt wurde dafür geändert. Ein vorzeitig auf dem partiellen Klon erfolgter Migrationslauf wurde verworfen; sämtliche endgültigen Nachweise stammen aus dem danach vollständig wiederhergestellten Klon.

30/31 wurden über den Runner zweimal angewendet, vor jedem Lauf mit geprüftem Backup. Schema und generierte Typen waren bytegleich. Danach Rückweg 31→30, jeweils über den Runner mit frischem Backup: alle fünf ersetzten ursprünglichen Funktionskörper stimmten exakt mit dem noch unveränderten Live-Bestand überein, aktive Variantenarchiv-Einträge gingen auf null zurück. Wiederanwendung war erfolgreich. Auch die finale numerische Härtung wurde anschließend zweimal angewendet: Schema-SHA256 beider Exporte `45601d6fd79141be2a0d0f46fb336bb97ff131aef7e505db801058d8fc98e6ef`, Typen-SHA256 `7bd41a07503488bb5ce85cd2ef80ffd9d6cc666f9342afb3ae789e040d680605`. Die echte Klon-Abnahme `deploy/vps/tests/master4-phase1.sql` ist grün; das erneute Varianten-Audit ergibt 512 gemeinsame Karten, 26 Satzkarten, 15 Meldungen und **0 ungelöste Fälle**.

`schema.sql` und `database.types.ts` werden mit dem vorhandenen App-Schema-/Postgres-Meta-Exporter aus dem migrierten Klon erzeugt. Das größere Schema-Delta holt dabei den bereits produktiven, im Snapshot fehlenden Bestand 22–29 nach; es aktiviert keine spätere Master-4-Phase. Supabase-Systemschemata bleiben nach dem bisherigen Exportvertrag außerhalb des App-Snapshots.

### Bilder und Accessibility

[Vorher/Nachher-Galerie](phase-1-bilder/README.md): beide Knopfpaare, Schreiben mit Artikelhinweis und Home ohne Freigabe, jeweils Desktop und Handy. Künstliche lokale Daten, kein produktiver Login, keine Personendaten; Ausgangsbuild vor allen Codeänderungen. Die Bilddateien und vollständigen Axe-Ergebnisse sind versioniert. Die erste erweiterte Prüfung fand vier Auth-Ansichten mit doppeltem/nestendem `main`; `AuthShell` verwendete ein zweites `main` innerhalb des Layouts. Dies wurde ohne visuelle Änderung korrigiert; die vollständige Wiederholungsprüfung bestand. Keine Axe-Regeln oder Knoten werden ausgeschlossen.

### Abschließende Tests und Aktivierung

| Prüfung | Bestanden | Fehler | Skip |
|---|---:|---:|---:|
| Jest, 138 Suites, inklusive aktiviertem rein lesendem DB-Smoke | 1.680 | 0 | 0 |
| Alle 43 DB-Testdateien, sequenziell in PGlite | 413 | 0 | 0 |
| Python VPS + TTS | 61 + 3 | 0 | 0 |
| Produktions-Build, 157 statische Seiten | Exit 0 | 0 | 0 |
| `tsc --noEmit` | Exit 0 | 0 | 0 |
| Unveränderte `e2e/accessibility.spec.ts`, vollständige Datei | 6 | 0 | 0 |
| Erweiterte Phase-1-Axe-Ansichten (28, vollständige Regelsätze) | 28 | 0 | 0 |

Lokale Rohprotokolle: `/tmp/smartgerman-phase1/`. Ausführung wie Phase-0-Baseline, Jest-Smoke über temporären SSH-Forward (nur öffentliche Kursabfrage und erwartete Verweigerung bei Personen); Schlüssel ausschließlich in Prozessumgebung. Kein DB-Testfilter. PyYAML aus vorhandener temporärer Umgebung; Chrome-Channel für Axe. Build mit lokalen Platzhalter-DB-Werten; für Veröffentlichung wird separat direkt auf dem VPS mit bestehender Konfiguration gebaut. Vorhandene Next-Cache-Control-Warnung bleibt unverändert.

Erstlaufbefunde: Zwei Full-Jest-Fehler (alte Assessment-Reihenfolge und dynamischer Audit-Fehlerlog) wurden gezielt behoben; anschließend vollständiger Lauf erfolgreich. Es wurden keine Test- oder Logger-Ausnahmen ergänzt. Die letzten Reviews prüften zusätzlich serverseitige Zahlenregeln, einen typografisch gleichwertigen Distraktor und Erhalt älterer CMS-Payloads. Die Quellen für PostgreSQL-Sicherheit wurden anhand der [offiziellen Functions-Dokumentation](https://supabase.com/docs/guides/database/functions) geprüft; der aktuelle Changelog erfordert für diese bestehenden APIs keine Änderung oder neue Abhängigkeit.

Alle lokalen Abnahmen, der finale Klon-Abgleich sowie Veröffentlichung und Produktionsaktivierung sind abgeschlossen. Der bereits in Phase 0 inaktive Mail-Worker bleibt nach dem bestehenden Release-Verfahren unverändert; seine Zustellprüfung gehört weiterhin zur vorgesehenen Betriebs-/Mailphase. Phase 1 ändert Anmelde- und Freigabehinweise, löst aber keine Testmails oder echten Nutzeranmeldungen aus.


## Produktive Aktivierung und Abschluss

Implementierungscommit `e6a8d32f4ce74ab20a0ff5a4750927c37c108575`, veröffentlicht auf `origin/codex/vps-self-hosted`. Das vorbereitete VPS-Release wurde mit bestehender Produktionskonfiguration gebaut (Exit 0, 157 statische Seiten). Bestehende Service-Dateien wurden vorab geprüft; zum vorherigen Release ist ihr Inhalt unverändert.

```sh
bash /var/www/sitov-academy/deploy/vps/deploy-release.sh --prepare-only
python3 /var/www/sitov-academy/deploy/vps/migrate-local.py --apply 30_fair_answer_grading.sql 31_vocabulary_target_forms.sql --sql-dir /var/www/sitov-releases/e6a8d32f4ce7/supabase/vps --keep-stopped
bash /var/www/sitov-academy/deploy/vps/deploy-release.sh --activate e6a8d32f4ce7 --schema-changed
```

Produktivbackup unmittelbar vor SQL: `/root/backups/sitov-migration-20260925T204937355350Z`, `COMPLETE` vorhanden, **549 Storage-Objekte**. Nachträglich erneut berechneter PostgreSQL-SHA256 `8654a4cb2e2c8acc51987447b1f18eeac5dfc1b029550f3825c4d47dd621cd21`; Storage-Manifest-SHA256 `dd923e99ed6fc35b9c6714c5e8f43f59b0693a1bf19be915e0f6dcc54f39c269`. `applied.json` bestätigt Datenbank `postgres` und beide Migrationen:

| Datei | SHA256 |
|---|---|
| 30_fair_answer_grading.sql | `f489b0a5773f5d612fb32d754155f41b5f2fd2dbdbf9b8cbd5b2b3366f448d5d` |
| 31_vocabulary_target_forms.sql | `11bfe95cc78dd7db0bc42c11444700e9c57e8ba2f202e89f095fefa6e7a579c3` |

Ergebnis: `/var/www/sitov-current` zeigt auf `/var/www/sitov-releases/e6a8d32f4ce7`, App aktiv, Loopback und `https://www.sitov-academy.com/api/health` jeweils `{"status":"ready"}`. Die unveränderte SQL-Abnahme aus `deploy/vps/tests/master4-phase1.sql` besteht live. Das Live-Varianten-Audit meldet 512 aktive gemeinsame Karten, 26 Satzkarten, 15 Befunde und **0 ungelöste**. Die öffentliche Anmeldestatusseite liefert den neuen Dank und den vollständigen aktuellen Dictionarytext.

Live-Schema und generierte Typen wurden anschließend rein lesend exportiert: Schema-SHA256 `45601d6fd79141be2a0d0f46fb336bb97ff131aef7e505db801058d8fc98e6ef`, Typen-SHA256 `7bd41a07503488bb5ce85cd2ef80ffd9d6cc666f9342afb3ae789e040d680605`. Beide stimmen exakt mit Klon und Repository überein.

App-Limit weiterhin 2.048 MiB, Mail-Limit 256 MiB, `IPAddressDeny=any` mit Loopback-Freigabe erhalten. Keine neuen Dienste oder Ressourcenlimits. Der vorher inaktive Mail-Worker bleibt nach dem bestehenden Aktivierungsvertrag inaktiv; die bereits zu Phase 6/8 zugeordnete Zustellprüfung bleibt offen. Dies ist keine getestete Mailzustellung und keine echte Registrierungssitzung.

Der ausschließlich für diese Phase angelegte Datenbankklon wurde nach Abnahme entfernt. Lokaler Fixture-/Next-Prozess und SSH-Forward sind beendet; geschützte Backups bleiben erhalten. Abschlussstatus: **Phase 1 vollständig durchgeführt**, Dokumentation/Screenshots versioniert; keine Phase 2–8 ausgeführt.

Maschinenlesbare Zusammenfassung: [phase-1-nachweise.json](phase-1-nachweise.json).
