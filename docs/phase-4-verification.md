# Phase 4 — Performance und API-Sicherheit

Stand 20.09.2026. Korrekturen zu `72659fd`; produktive Abnahme wird nach Aktivierung ergänzt.

## Änderungen

- XFF-Vertrag: Internet → Traefik → Nginx → Next.js auf Loopback. Genau ein abschließender Proxy-Eintrag wird übersprungen. Strikte Env-Prüfung, IP-Validierung und IPv6-Normalisierung. Nginx akzeptiert App-Verkehr nur von den tatsächlich inspizierten Traefik-Adressen. `configure-proxy-trust.py` nach jeder Proxy-Neuerstellung und vor Nginx-Reload ausführen. Fehlende Konfiguration bleibt geschlossen.
- Auth bleibt bei Datenbankfehlern und geworfenen Limiter-Fehlern geschlossen. Ein gefälschter Präfix ändert den echten Client-Key nicht; unterschiedliche Clients erhalten getrennte Keys.
- Fortschritt wird in SQL aggregiert, mit `business_private.is_staff()`, leerem `search_path`, eingeschränkten EXECUTE-Rechten und R10-JSONB-Fehlern. Beide Vokabelrichtungen müssen Box 7 erreichen. Nullfortschritt auf anderen Niveaus bleibt im Ergebnis enthalten. App prüft Transportfehler, JSONB-Fehler und Datenform; Ausfälle erscheinen im bestehenden Admin-Fehlerdialog.
- Migration 08 läuft explizit im Autocommit-Modus mit Lock-/Statement-Timeouts. Ungültige Indizes werden nach Definitionsprüfung repariert; gültige bleiben bestehen, fremde Definitionen werden abgewiesen. Kein Kommentar kann Transaktionen abschalten.
- Query-Pläne vor Optimierung: `phase4/explain-before.txt`. RLS-Prüfungen waren der Hauptengpass (875 ms Fortschritt, 2608 ms Katalog). Migration 10 berechnet Freigaben einmal je SQL-Anweisung mit Joins. Kein prozessweiter Cache; Entzug wirkt auf die nächste Anfrage. Tests vergleichen die Ergebnismenge mit der ursprünglichen Berechtigungsfunktion.
- Alle 139 Warning-/Error-Aufrufe in App, Lib, Components, Utils und Scripts verwenden ausschließlich statische Ereignistexte. AST-Test ohne Ausnahmen schützt vor erneuten PII-Logs.

## Ressourcenrechnung (MiB)

| Tranche | Vor Phase 4 | Korrigiert |
|---|---:|---:|
| Supabase-Container | 6660 | 5632 |
| Next.js MemoryMax | 1536 | 2048 |
| Summe | 8196 | 7680 |
| Monitoring-Budget | 128 | 128 |
| Summe inklusive Monitoring | 8324 | 7808 |

Next.js Heap: 1536 MiB; Build-Heap bleibt 3072 MiB; CPUQuota 350 %, Build cpus 4.
Die gegenüber CODEX zusätzlich reduzierten Limits für Meta (−128), Realtime (−256) und Supavisor (−128) erklären 7680 statt 8192 MiB. Analytics benötigt nach dem Live-Anlauf 640 statt 512 MiB; dafür sinkt der ungenutzte Edge-Functions-Dienst von 256 auf 128 MiB. Diese zusätzliche Verschiebung ändert die Summe nicht. Studio/Meta erhalten explizite V8-Heaps; Erlang-Dienste zwei Scheduler und je einen Dirty-CPU-/IO-Scheduler, um Runtime-Overhead innerhalb ihrer Grenzen zu halten.

Diese Limit-Tranche ist **keine vollständige Host-RAM-Reservierung**: der VPS meldet 7884 MiB physischen RAM; Coolify, Nginx, Kernel, TTS und Mail laufen zusätzlich. TTS hat unverändert 2048 MiB, Mail 256 MiB als Obergrenze; mehrere Coolify-Container besitzen keine eigene Grenze. Deshalb wäre die Behauptung „7808 MiB garantiert hostweit kein OOM“ falsch. Die Änderung senkt die bisherige Überbuchung; Host-MemAvailable, alle Container und App-OOM-Zähler müssen unter Last separat nachgewiesen werden. Der Monitoring-Platz ist ein Budget für Phase 8, kein hier neu gestarteter Dienst.

## R8 / R9

Vor allen DB-Teständerungen: `python3 deploy/vps/migrate-local.py --backup-only` auf dem VPS.
Backup `/root/backups/sitov-migration-20260920T151118355329Z`, PostgreSQL-SHA256 `fed39b6fff945cb2c188b25a6c22cab402acf2db1f33304fca10a3c279a69b3b`.
Storage-Manifest-SHA256 `0c1745b09505bab01a1b28fb184488ba44d52af9331a1f61f1976bbb1a6331c2`; 392 Storage-Objekte. Backups ausschließlich root-lesbar.

Jede Migration enthält ihren Rückweg. Reihenfolge: frisches Backup; passende Vor-Phase-4-App aktivieren; RLS-Policies aus den Kommentaren von 10 restaurieren; RPC aus 09 entfernen; neue Indizes aus 08 außerhalb einer Transaktion entfernen. Tabellen und Lernergebnisse werden nicht geändert. Bei unklarem Commit bleiben App/Mail gestoppt. Vor Ressourcen-/Nginx-Änderungen werden die tatsächlichen Konfigurationen root-lesbar gesichert und können gemeinsam mit dem passenden App-Release restauriert werden.

## Bisherige Verifikation

- 1269 Jest-Tests bestanden; die gesonderte Loopback-Integration wird auf dem VPS aktiviert.
- 302/302 DB-Tests seriell auf dem VPS bestanden, einschließlich neuer Aggregations-, Fehler-, Rollen-, RLS-Paritäts- und Wiederholungstests.
- Echter PostgreSQL-Test: Concurrent-Erstellung, Wiederholung ohne Austausch gültiger Indizes, INVALID-Reparatur, Schutz gültiger Nachbarindizes und Ablehnung kollidierender Definitionen bestanden. Isolierte Testdatenbank anschließend gelöscht.
- TypeScript ohne Fehler.
- Vollständiger Jest-Lauf auf dem VPS mit aktivierter Loopback-Integration: 101 Suites, 1270 Tests, keine übersprungen.
- Produktions-RLS nach Migration: Fortschritt 6,696 ms, Einstufungsfortschritt 8,455 ms, Katalog 14,757 ms; siehe `phase4/explain-after.txt`.
- Öffentlicher HTTPS-Login: Zwei echte Server Actions verwenden trotz gefälschtem XFF/Real-IP/Netlify-Header denselben echten Client-Bucket; kein Unknown-/Proxy-Bucket. Direkter Nginx-Zugriff liefert 403.
- Erster 15-Sekunden-SSR-Probelauf (vier gleichzeitige Leser, 1024 Richtungen): keine Fehler, aber TTFB p95 696 ms. Daher zusätzliche React-Anfrage-Memoisierung für verifizierte Auth- und Profilabfragen; kein prozessweiter Cache. Der abschließende Lastlauf erfolgt erst mit dieser Korrektur.

Produktionsmigration 08/09/10 und Schema-/Typenexport abgeschlossen. Vor Migration: Backup `/root/backups/sitov-migration-20260920T152953707620Z`, PostgreSQL-SHA256 `08ca3ac20c3b53c195b884aaab40ac32b2f330247d87e788b3d7886cf92af298`, 392 Storage-Objekte. Konfigurationsbackup: `/root/backups/phase4-config-20260920T152736Z`.

Abschließender 30-Minuten-Lasttest mit der Anfrage-Memoisierung: noch ausstehend.
