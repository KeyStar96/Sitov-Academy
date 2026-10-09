# Sitov Academy – S1 Epoch 22: GraphQL-Kompatibilität und Restore-Rest

Status: **Restore-Rest und vollständige Tabellen-Baseline PASS; Rechteprüfung und Release-Gates offen / NOT_RELEASE_READY**. Ausschließlich die eigene isolierte Datenbank wurde verändert; Dokumentationscommit ohne App- oder Migrationsänderungen.

## Exakte Restmenge und Kompatibilität

Die physische TOC ab dem fehlgeschlagenen ACL-Eintrag enthält 2512 Einträge und darf nicht direkt wiederholt werden: Bereits restaurierte Funktionen, Tabellen und Daten sind dort ebenfalls enthalten. Aus der tatsächlich von pg_restore erzeugten SQL-Reihenfolge wurde stattdessen die verbleibende Auswahl von **485 ACL-, 29 DEFAULT-ACL- und sechs Event-Trigger-Einträgen** bestimmt. Die Auswahl aus den originalen TOC-IDs erzeugt das bytegleiche tatsächliche SQL-Suffix; ausschließlich der zufällig erzeugte psql-unrestrict-Nonce wurde für den Vergleich normalisiert. TOC-SHA-256: `5336884a0df50822b2883a8f793074ca03c1487a22518b9278d70edba7e14c0d`; normalisiertes SQL-Suffix: `478f3f81f2938ac6e2f3ac85528904e7b4c6ad2c5738e9109e03eb63a6649d22`. M hat diese genaue Auswahl einschließlich der sechs ursprünglichen Event-Trigger ausdrücklich geprüft und freigegeben.

Das auf der Prüfkopie verfügbare pg_graphql 1.6.2 hat dieselbe benötigte graphql.resolve-Signatur; Produktion verwendet 1.5.11. Der fehlende graphql_public.graphql-Wrapper wird ausschließlich aus M’s tatsächlichem Produktions-Lesenachweis übernommen, mit unverändertem Funktionskörper, Owner supabase_admin, ursprünglichen ACL und pg_graphql-Mitgliedschaft. Der private Quellnachweis hat SHA-256 `74fc0bcd69dd95b0855a8f9f6bb0a0e32f214030ba6de93eaa69b76af806eb34`. Dies ist ein dokumentierter ABI-Kompatibilitätsadapter in der eigenen Prüfkopie. Eine vollständige semantische Gleichheit der Extension-Versionen oder ein Produktionsupgrade wird nicht behauptet.

Ein Fehler beim Zusammenstellen des ersten Wrapper-Befehls ließ das trennende Semikolon nach pg_get_functiondef aus. Die Transaktion wurde zurückgerollt; die anschließende Prüfung bestätigte den weiterhin fehlenden Wrapper und null Restore-Restversuche. Ursprünglicher privater Fehlernachweis: `313dc44689be4904bec90e5555334e06e9793eaaf9c7def3c7fd75610ba8354e`. Der Fehler bleibt erhalten. M genehmigte danach ausdrücklich die Korrektur ausschließlich dieses Trennzeichens und einen einzigen Rest-Restore. Keine Tabellen-, Funktions-, Index-, Constraint- oder COPY-Wiederholung; kein clean/drop, keine neuen operativen Extensions oder Jobs.

## Ergebnisse

- Einmaliger korrigierter Wrapper-Befehl und ein Rest-Restore mit Exitcode 0. Exakte Wrapper-Definition, Owner, ACL und Extension-Mitgliedschaft stimmen mit dem Produktions-Lesenachweis überein; GraphQL-ABI-Smoke bestanden.
- Alle **185 Nicht-Systemtabellen** wurden vollständig zeilenweise gehasht; **75 auth.users und 75 public.profiles**. Baseline-SHA-256: `1e5a89759dfd01976af140916a4f53244378971512dac5de6b3f0ff3fb0dca67`.
- Owner-/ACL-/RLS-Metadaten für 644 Relationen und 474 Funktionen sowie Schemas, Standardberechtigungen und Policies privat gespeichert. Metadaten-SHA-256: `ca1e620728ae24572ad30adcb84cc18dd55cea012207e083cf83d11a1fd4ecd8`. Dies ist keine abgeschlossene effektive Rechteprüfung der Konten und keine unabhängig vollständige Archiv-Metadatenvergleichsmatrix.
- Alle **188 QA-Tabellen** vor und nach dem Rest-Restore mit identischen Namen, Zeilenzahlen und vollständigen Zeilenhashes: `f78808720aa242bfb6a17dde4b398497d1f0478465ba4eb9c9d376d25e1236b1`. Keine Änderung der QA-Datenbank postgres durch S1.
- Abschließender Laufzeitguard mit identischen Images, Limits und isoliertem Netzwerk bestanden; drei HTTP-Status 200, alle Container laufend, aktuelle OOM-Markierung false. Der historische OOM-Vorfall bleibt dokumentiert. Vor dieser Einheit verfügbarer Hostspeicher: 2408 MiB.
- Keine Migrationen 93–109, keine tatsächliche Rechteauswertung, keine Browser-/Audioarbeit und keine Produktionsschreibzugriffe. Private Rechte-Matrix ist ausschließlich vorbereitet.


## Grenzen und Fortsetzung

Die historischen OOM-Nachweise aus Epoch 21 bleiben erhalten. Die neue Hash-Erfassung streamt je Tabelle geordnete JSON-Zeilen und hasht inkrementell im Client, ohne Volltabellen-jsonb_agg, erhöhte Limits oder work_mem-Änderung. Die Serialisierung entspricht dem bisherigen PostgreSQL-JSONB-Arrayformat; leere Tabellen verwenden den Hash der leeren Zeichenfolge. Kleine Katalog-Metadatenabfragen sind getrennt von Produktionszeilen.

Die effektive Rechteprüfung aller 75 Konten ist **nicht durchgeführt**; ihr privater Quellen- und Vergleichsplan liegt in `S1/epoch22-rights-matrix-plan.json`. Er verwendet tatsächliche Konten, aktuelle Rollen/Freigaben/Katalogeinträge, bestehende RPCs und getrennte Auth-/RLS-Grenzen. Keine erfundenen Konten oder Freigaben. Migrationen 93–109 bleiben unangetastet und benötigen eine eigene Freigabe. Payment bleibt aus; keine Produktionsschreibzugriffe, kein Push und kein Deployment durch S1.

Private Fortsetzung: `S1/epoch22-resume-ledger.json`; Remote-Artefakte unter `/tmp/sitov-night-20261008-qa-master/S1-epoch22-rehearsal/`. Rohfehler, Funktionsdefinitionen, Kontodaten und vollständige Tabellen-/ACL-Nachweise liegen ausschließlich in privaten Dateien (0600, Verzeichnisse 0700). Die ursprüngliche neunminütige Lease endet um 20:53:42 Uhr Europe/Berlin; letzte Minute ausschließlich SAVE.
