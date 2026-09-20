# Phase 4 — Performance und API-Sicherheit

Stand 20.09.2026. Korrekturen zu `72659fd`; produktiv aktiviertes App-Release `ce3d485b53f2`. Phase 4 auf ausdrücklichen Nutzerwunsch abgeschlossen und abgenommen; verkürzte Stabilitätsmessung transparent dokumentiert.

## Änderungen

- XFF-Vertrag: Internet → Traefik → Nginx → Next.js auf Loopback. Genau ein abschließender Proxy-Eintrag wird übersprungen. Strikte Env-Prüfung, IP-Validierung und IPv6-Normalisierung. Nginx akzeptiert App-Verkehr nur von den tatsächlich inspizierten Traefik-Adressen. `configure-proxy-trust.py` nach jeder Proxy-Neuerstellung und vor Nginx-Reload ausführen. Fehlende Konfiguration bleibt geschlossen.
- Auth bleibt bei Datenbankfehlern und geworfenen Limiter-Fehlern geschlossen. Ein gefälschter Präfix ändert den echten Client-Key nicht; unterschiedliche Clients erhalten getrennte Keys.
- Fortschritt wird in SQL aggregiert, mit `business_private.is_staff()`, leerem `search_path`, eingeschränkten EXECUTE-Rechten und R10-JSONB-Fehlern. Beide Vokabelrichtungen müssen Box 7 erreichen. Nullfortschritt auf anderen Niveaus bleibt im Ergebnis enthalten. App prüft Transportfehler, JSONB-Fehler und Datenform; Ausfälle erscheinen im bestehenden Admin-Fehlerdialog.
- Migration 08 läuft explizit im Autocommit-Modus mit Lock-/Statement-Timeouts. Ungültige Indizes werden nach Definitionsprüfung repariert; gültige bleiben bestehen, fremde Definitionen werden abgewiesen. Kein Kommentar kann Transaktionen abschalten.
- Query-Pläne vor Optimierung: `phase4/explain-before.txt`. RLS-Prüfungen waren der Hauptengpass (875 ms Fortschritt, 2608 ms Katalog). Migration 10 berechnet Freigaben einmal je SQL-Anweisung mit Joins. Kein prozessweiter Cache; Entzug wirkt auf die nächste Anfrage. Tests vergleichen die Ergebnismenge mit der ursprünglichen Berechtigungsfunktion.
- Alle 139 Warning-/Error-Aufrufe in App, Lib, Components, Utils und Scripts verwenden ausschließlich statische Ereignistexte. AST-Test ohne Ausnahmen schützt vor erneuten PII-Logs.

- Verifizierte Auth- und Profilabfragen werden mit `React.cache` nur innerhalb einer Server-Anfrage wiederverwendet. Die Vokabel-Session lädt Übersetzungen für Deutsch, UI-Sprache und Muttersprache; Muttersprache und Schwierigkeitsregeln bleiben erhalten. Beide Lernrichtungen teilen sich dieselbe Kartenrepräsentation für die Übertragung.

## Ressourcenrechnung (MiB)

| Tranche | Vor Phase 4 | Korrigiert |
|---|---:|---:|
| Supabase-Container | 6660 | 5632 |
| Next.js MemoryMax | 1536 | 2048 |
| Summe | 8196 | 7680 |
| Monitoring-Budget | 128 | 128 |
| Summe inklusive Monitoring | 8324 | 7808 |

| Container | Vor Phase 4 | Korrigiert |
|---|---:|---:|
| PostgreSQL | 1536 | 1728 |
| Analytics | 900 | 640 |
| Studio | 384 | 192 |
| Vector | 256 | 128 |
| Kong | 512 | 512 |
| Meta | 384 | 256 |
| Auth | 256 | 256 |
| PostgREST | 192 | 192 |
| Realtime | 512 | 256 |
| MinIO | 512 | 512 |
| Storage | 384 | 384 |
| Imgproxy | 192 | 192 |
| Supavisor | 384 | 256 |
| Edge Functions | 256 | 128 |
| **Supabase gesamt** | **6660** | **5632** |

Next.js Heap: 1536 MiB; Build-Heap bleibt 3072 MiB; CPUQuota 350 %, Build cpus 4.
Die gegenüber CODEX zusätzlich reduzierten Limits für Meta (−128), Realtime (−256) und Supavisor (−128) erklären 7680 statt 8192 MiB. Analytics benötigt nach dem Live-Anlauf 640 statt 512 MiB; dafür sinkt der ungenutzte Edge-Functions-Dienst von 256 auf 128 MiB. Diese zusätzliche Verschiebung ändert die Summe nicht. Studio/Meta erhalten explizite V8-Heaps; Erlang-Dienste zwei Scheduler und je einen Dirty-CPU-/IO-Scheduler, um Runtime-Overhead innerhalb ihrer Grenzen zu halten.

Diese Limit-Tranche ist **keine vollständige Host-RAM-Reservierung**: der VPS meldet 7884 MiB physischen RAM; Coolify, Nginx, Kernel, TTS und Mail laufen zusätzlich. TTS hat unverändert 2048 MiB, Mail 256 MiB als Obergrenze; mehrere Coolify-Container besitzen keine eigene Grenze. Deshalb wäre die Behauptung „7808 MiB garantiert hostweit kein OOM“ falsch. Die Änderung senkt die bisherige Überbuchung; Host-MemAvailable, alle Container und App-OOM-Zähler müssen unter Last separat nachgewiesen werden. Der Monitoring-Platz ist ein Budget für Phase 6.2, kein hier neu gestarteter Dienst.

Unveränderte zusätzliche Grenzen: TTS 2048 MiB, Mail 256 MiB. Damit lautet die Summe aller bekannten Dienstlimits inklusive Monitoring-Budget **10628 → 10112 MiB**, zuzüglich der sechs unlimitierten Coolify-Container und Host-Prozesse. Dies bleibt eine Überbuchung von Obergrenzen, keine Zusage gleichzeitiger Vollauslastung. Gemessener Coolify-Verbrauch während des Tests: App 322,3 MiB, DB 32,5 MiB, Redis 9,5 MiB, Realtime 60,7 MiB, Sentinel 7,9 MiB, Proxy 54,6 MiB. Die unveränderten Fremddienste wurden nicht allein aufgrund dieser Phase neu dimensioniert.

## R8 / R9

Vor allen DB-Teständerungen: `python3 deploy/vps/migrate-local.py --backup-only` auf dem VPS.
Backup `/root/backups/sitov-migration-20260920T151118355329Z`, PostgreSQL-SHA256 `fed39b6fff945cb2c188b25a6c22cab402acf2db1f33304fca10a3c279a69b3b`.
Storage-Manifest-SHA256 `0c1745b09505bab01a1b28fb184488ba44d52af9331a1f61f1976bbb1a6331c2`; 392 Storage-Objekte. Backups ausschließlich root-lesbar.

Jede Migration enthält ihren Rückweg. Reihenfolge: frisches Backup; passende Vor-Phase-4-App aktivieren; RLS-Policies aus den Kommentaren von 10 restaurieren; RPC aus 09 entfernen; neue Indizes aus 08 außerhalb einer Transaktion entfernen. Tabellen und Lernergebnisse werden nicht geändert. Bei unklarem Commit bleiben App/Mail gestoppt. Vor Ressourcen-/Nginx-Änderungen werden die tatsächlichen Konfigurationen root-lesbar gesichert und können gemeinsam mit dem passenden App-Release restauriert werden.

## Verifikation

- Lokaler vollständiger Jest-Lauf: 1273 Tests bestanden; ein ausschließlich auf dem VPS aktivierter Loopback-Test übersprungen.
- 302/302 DB-Tests seriell auf dem VPS bestanden, einschließlich neuer Aggregations-, Fehler-, Rollen-, RLS-Paritäts- und Wiederholungstests.
- Echter PostgreSQL-Test: Concurrent-Erstellung, Wiederholung ohne Austausch gültiger Indizes, INVALID-Reparatur, Schutz gültiger Nachbarindizes und Ablehnung kollidierender Definitionen bestanden. Isolierte Testdatenbank anschließend gelöscht.
- TypeScript ohne Fehler; produktiver Next.js-Build inklusive 131 Seiten bestanden.
- Vollständiger abschließender Jest-Lauf auf dem VPS mit aktivierter Loopback-Integration: **102 Suites, 1274 Tests bestanden**, keine übersprungen.
- Produktions-RLS nach Migration: Fortschritt 6,696 ms, Einstufungsfortschritt 8,455 ms, Katalog 14,757 ms; siehe `phase4/explain-after.txt`.
- Öffentlicher HTTPS-Login: Zwei echte Server Actions verwenden trotz gefälschtem XFF/Real-IP/Netlify-Header denselben echten Client-Bucket; kein Unknown-/Proxy-Bucket. Direkter Nginx-Zugriff liefert 403.
- Erster 15-Sekunden-SSR-Probelauf (vier gleichzeitige Leser, 1024 Richtungen): keine Fehler, TTFB p95 696 ms. Danach Anfrage-Memoisierung und Reduktion des Vokabel-Payloads; der abschließende Lastlauf verwendet beide Korrekturen.
- 34 Python-Tests für Deploy-/Migrationswerkzeuge bestanden. Alle vier öffentlichen Actions haben Regressionstests gegen Header-Spoofing; der Login wurde zusätzlich über den produktiven HTTPS-Proxy getestet.

Produktionsmigration 08/09/10 und Schema-/Typenexport abgeschlossen. Vor Migration: Backup `/root/backups/sitov-migration-20260920T152953707620Z`, PostgreSQL-SHA256 `08ca3ac20c3b53c195b884aaab40ac32b2f330247d87e788b3d7886cf92af298`, 392 Storage-Objekte. Konfigurationsbackup: `/root/backups/phase4-config-20260920T152736Z`.

Die beiden letzten Backups wurden vollständig nachgeprüft: je 396 Datei-Prüfsummen korrekt, COMPLETE-Marker vorhanden, keine Gruppen-/Fremdzugriffsrechte.

Vor dem abschließenden Lasttest: Backup `/root/backups/sitov-migration-20260920T154341992860Z`, PostgreSQL-SHA256 `3c8403113e28d884d2e1231361c7b893ee53e466ceecbb3e793ccf49b35dee14`, erneut 392 Storage-Objekte.

## Schemaexport

Ausgeführt: `python3 deploy/vps/export-phase2-schema.py --database postgres --output /root/backups/phase4-production-schema`. Der vollständige Dump-Befehl:

```sh
docker exec supabase-db-eknmzxvqilojjicinatnllbt pg_dump -U supabase_admin -d postgres --schema-only --no-owner --schema public --schema business_private --schema grammar_private --schema identity_private --schema learning_private --schema learning_reset_private --schema platform_private --schema private --schema pronunciation_private --schema trainer_access_private --schema vocabulary_private --schema media_private
```

Supabase-verwaltete Schemas (`auth`, `storage`, `realtime`, `extensions`, `graphql`, `vault`, `cron`, `net`, Migrationshistorie) bleiben außerhalb des App-Schema-Artefakts. TypeScript wurde vom laufenden Postgres-Meta-Generator für `public` erzeugt; die Artefakte sind in `supabase/schema.sql` und `supabase/database.types.ts` übernommen.

## Abschlussmessung und Abnahme

Der für 30 Minuten geplante Test lief gegen die authentifizierte SSR-Route auf Loopback mit vier parallelen Lesern und 1024 Lernrichtungen. Er umfasst App und lokale Supabase-Dienste; Internetlaufzeit und HTTPS-Proxy sind nicht Teil dieser Latenzmessung. Die öffentliche Proxy-Sicherheit wurde separat geprüft.

Der Auftraggeber hat am 20.09.2026 eine geringfügige Überschreitung der 500-ms-Vorgabe ausdrücklich für die Abnahme freigegeben. Der ursprüngliche Benchmark-Grenzwert bleibt unverändert; der tatsächliche Abschlusswert wird hier dokumentiert.

Auf ausdrücklichen Nutzerwunsch wurde der geplante 30-Minuten-Test nach **824,124 Sekunden (13 Minuten 44 Sekunden)** sauber beendet und Phase 4 abgeschlossen. Die Testdaten wurden entfernt und die Testsession widerrufen. Der unveränderte Runner meldet wegen des vorzeitigen Stopps `failed`; das bedeutet hier **keinen Anwendungsfehler**, aber auch keinen vollständigen 30-Minuten-Nachweis. Diese Abweichung ist durch den ausdrücklichen Abschlussauftrag freigegeben.

| Messwert | Ergebnis |
|---|---:|
| Authentifizierte SSR-Anfragen | 3292 |
| Fehler | 0 |
| TTFB p50 / p95 / p99 | 326,5 / **495,7** / 718,4 ms |
| Vollständige Antwort p95 | 745,8 ms |
| App-Speicher maximal | 363,37 MiB |
| Host-MemAvailable minimal | 2959,70 MiB |
| App-OOM / OOM-Kills | 0 / 0 |
| App- / Container-Neustarts während des Laufs | 0 / 0 |
| Container-OOM / ungesunde Container-Samples | 0 / 0 |
| Synthetischer Testnutzer entfernt | ja |

TTFB p95 erfüllt damit im gemessenen Zeitraum sogar die ursprünglichen 500 ms. Einzelne langsamere Anfragen sind über p99 und Maximum im unveränderten Messartefakt sichtbar. Rohstatus und Abnahmeentscheidung stehen getrennt in [phase4/load-summary.json](phase4/load-summary.json). Keine Abnahme der noch offenen Phasen 5–8 mit diesem Bericht verbunden.
