# Sitov Academy — S1 Epoch 38: tatsächlicher QA-COMMIT und Recovery

Stand: 2026-10-09, 23:51:37 UTC. Basis: `e5911c1d37b8065e3053f1b20cf52ba8b59ee92a`.

Der bislang fehlende Recovery-Nachweis ist auf dem bestehenden isolierten Shared-QA-System bestanden. Ein tatsächlicher erfolgreicher PostgreSQL-COMMIT wurde mit einer anschließend absichtlich unterdrückten Client-Rückgabe kombiniert. Das ist ein simuliertes Rückgabeverlust-Szenario nach echter Transaktion, kein behaupteter physischer Netzwerkabbruch.

## Umfang und Identität

- Ausschließlich `sitov-night-20261008-qa-db`, Datenbank `postgres`, und `sitov-night-20261008-qa-storage`; kein Klon und keine Produktion.
- Exakt ein Originalobjekt aus der unveränderten 1299er-Allowlist; Allowlist-SHA256 `eec931b9af449049c54da65bd036bd6283d680ad50ca31fab59adbc0458c4aa9`.
- Pfad `audio_cache/sitov-qwen-v1/de/008fd4fcd299bbd647df3dd429bdffeb1c9d7d247a746fb824d7a759656b87b1.mp3`.
- Unveränderte Originalaufnahme: 31052 Bytes, SHA256 `5381d62eb972bda609c326fe63894e2a90a26885b67785d18430f8d8de7cb68b`.
- Tatsächlich ausgeführtes CAS-Modul: SHA256 `2e7c900e84c599efbe8308933fefb10e050e45f14247ca9bd0956516a6d0dda4`; enthält Ms Korrektur für die temporäre Tabelle vor der Read-only-Transaktion.

## Tatsächlicher Nachweis

Vor dem Upload waren der exakte Pfad in `storage.objects`, der Storage-API und allen 188 tatsächlichen Tabellen ohne Objekt beziehungsweise Verbraucher. Identität, Quellhash und gezielte Bereinigung wurden vor Erstellung privat festgehalten. Der normale Storage-Upload verwendete ausschließlich Originalbytes und `x-upsert:false`. Die anschließend vollständige Objektaufnahme hatte exakt die ursprünglichen Metadaten und keine Verbraucher.

Das lokale echte `prepare` erzeugte das private Archiv mit vier gehashten Quelldateien, `operation.json` und dem Journalzustand `PREPARED`. Das aktuelle CAS-Modul führte danach genau einen echten COMMIT aus. Direkt nach erfolgreicher Rückgabe der Datenbankmethode wurde absichtlich ein `ConnectionError` ausgelöst; das Journal stand weiterhin auf `PREPARED`.

Die Wiederaufnahme erkannte den vollständigen neuen Objektzustand und lief mit `apply=False` erfolgreich bis `VERIFIED`. Dabei erfolgte kein zweiter Aufruf der Commit-Methode und kein erneutes UPDATE. Authentifizierte tatsächliche Storage-Abfragen bestätigten Originalbytes und neue Wortzeitmetadaten; vollständige Datenbankobjekte vor und nach der Wiederaufnahme waren gleich. Die Journalfolge lautet exakt `PREPARED → COMMITTED_READBACK_PENDING → VERIFIED`.

## Bereinigung und Zustand

Das eigene Testobjekt `8504c073-fd48-459a-b603-6b96db85f6c5` wurde nach erneuter Identitäts- und Audiohashprüfung ausschließlich über die normale Storage-DELETE-API gelöscht. Der Pfad ist anschließend in der Datenbank abwesend. Der vollständige zeilenweise Vergleich aller 188 QA-Tabellen ist wieder exakt gleich:

`f78808720aa242bfb6a17dde4b398497d1f0478465ba4eb9c9d376d25e1236b1`

Auth-, REST- und Storage-Health antworteten jeweils HTTP 200. Container liefen mit den erwarteten Images, Grenzen und isolierten Netzwerkeinstellungen, ohne OOM oder Neustart. Verfügbarer Speicher zuletzt 2777 MiB; andere aktive Abfragen in `postgres`: 0. Keine offenen Jobs. Die normale Verarbeitung endete um 23:51:37 UTC, vor dem SAVE-Fenster.

## Private Nachweise und Übergabe

Im Koordinationsverzeichnis `SITOV-NIGHT-2026-10-08` liegen `S1/epoch38-evidence-manifest-private.json`, `S1/epoch38-resume-ledger.json`, das lokale `S1/epoch38-operation-archive` und `S1/epoch38-remote-evidence-private`. Das Remote-Archiv enthält vollständiges Journal, tatsächliches neues Objekt, frische Bestandsaufnahme, vorherige/nachherige Tabellenhashes, Laufzeitnachweise sowie die exakt ausgeführten Quellen. Dateien sind privat (0600), Verzeichnisse 0700; keine Schlüssel oder vollständigen Datenbankobjekte werden eingecheckt.

Dieser Commit dokumentiert ausschließlich den ergänzenden Nachweis. Die bereits von M nachgewiesenen Rollback-, Ablehnungs- und Lock-Timeout-Fälle wurden nicht wiederholt. Keine Produktcodeänderung, Migration, Synthese, Veröffentlichung, Produktionsübernahme, Push oder Deployment. Die integrierte Freigabe und alle übrigen Release-Gates bleiben bei M; `release_ready=false`.
