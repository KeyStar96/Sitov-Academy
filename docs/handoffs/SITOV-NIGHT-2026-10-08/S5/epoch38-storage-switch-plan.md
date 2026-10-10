# S5 epoch38 — reversibler eigener Storage-Wechsel

READONLY assessment, Basis cbf9595ac1a2661497a76c9daa996868a26520fb. Input-SHA f2cb55bd8ea1165dc661fd54b30c852ee4f11904ad8ad986d625d0790e1fca04 geprüft. Keine Docker-, Datenbank-, Storage-, Browser- oder Produktmutation. Nur fünf eigene QA-Container, deren internes Netzwerk und eigene Katalogmetadaten gelesen. S1-Port54639 und bestehende Scratch-Datenbanken nicht verbunden/verändert. Private vollständige Inspect-/Env-/Kong-/Quellcodebelege ausschließlich S5/epoch38-inspection-private.json,0600 in0700-Verzeichnis; keine Geheimniswerte im Handoff.

Audit5338 vollständig:1450exact,3762missing,120differentbytes,6samebytes/differenttimings. Dies sind Befunde des SHA-geprüften M-Audits, keine von S5 wiederholten5338GETs.

## Tatsächliche Topologie und Grenzen

Storage1.11.2, gepinntes Image sha256:4f0eb90b935c676914ed0609c2c7d47cddb3f336155726bb2d5542617d4afdfa. Filebackend/var/lib/storage auf eigenem Volume sitov-night-20261008-qa-files; dieses Volume teilt kein anderer der fünf QA-Container. StorageIP10.0.3.5, Aliasstorage. Kong verwendet DNS-Upstreams http://storage:5000/, http://rest:3000/, http://auth:9999/, keine hartcodierten Service-IPs. Gleiche IP+Aliases bewahren dennoch Routing und DNS-Cache-Kontinuität. Gateway-Konfiguration bleibt unverändert.

StorageDATABASE_URL, AuthGOTRUE_DB_DATABASE_URL und RESTPGRST_DB_URI zeigen derzeit auf dieselbe Datenbank. StoragePOSTGREST_URL zeigt auf Aliasrest. Im kompilierten Storagecode wurden keine Referenzen auf POSTGREST_URL/postgrestURL/postgrestUrl gefunden; daraus wird keine allgemeine Ende-zu-Ende-Freigabe abgeleitet. Die vier relevanten JWT-Geheimnisse sind derzeit gleich, Werte wurden nicht ausgegeben. ANON_KEY/SERVICE_KEY/AUTH_JWT_SECRET und alle übrigen Envwerte bleiben privat/unverändert.

Eigenes QA-Cluster: supabase_admin hat tatsächlich SUPERUSER/CREATEDB. Bestehende Datenbanken und clusterweite Rollen bleiben unberührt; neue eigene Datenbank mit eindeutigem sitov_s5_complete_<nonce>-Namen. Andere vorhandene Scratch-Datenbanken werden nicht übernommen oder gelöscht. Storage startet laut tatsächlich installiertem server.js Tenantmigrationen und asynchrone Migrationen. Deshalb niemals mit der neuen Instanz versehentlich die alte Datenbank verbinden. Schema-/Migrationskompatibilität auf dem neuen Clone prüfen und erwartete Änderungen dokumentieren.

Caps der aktiven fünf Dienste unverändert: DB320MiB/.75CPU, Auth128/.25, Storage256/.5, REST64/.25, Gateway192/.25 =960MiB/2CPU, pids-limit256, keine veröffentlichten Ports, privat internes Netz, restart=no. Health vor/nach3×200, kein OOM; MemAvailable2101.62→2224.77MiB. Kein Appserver gestartet. Vollständige Config/HostConfig/Netzwerkbindungen sind privat gesichert.

## M-Umsetzungsfolge — innerhalb der bereits autorisierten eigenen QA-Wartung

1. Alle QA-Schreiber stoppen/Leasefreeze und S1-Arbeit abwarten. M bindet konsistenten vollständigen Quell-Dump samt185-Schutztabellen und tatsächlichen5338Blob-/Timing-Manifesten an SHAs. Quelle nur lesen. Alte188-QA- und geschützte185-Quellhashes mit dem sicheren Streamhelper sichern; keine globale UNION/jsonb_agg-Hashabfrage. Genauen Owner des neuen Clone bestimmen. Keine Produktion, kein S1-Socket, keine vorhandene ScratchDB als Ziel.
2. Mit vorhandenem supabase_admin neue leere eigene DB im eigenen QA-DB-Container anlegen und vollständigen Dump dort seriell restaurieren. Keine globalen Rollenänderungen; fehlende Owner/Extensions/Grants zuerst konkret auflösen. Datenbank-Owner/CONNECT und Storage-Rollenrechte prüfen, keine fehlende Autorität durch Superuser-API kaschieren. Neue DB vor API-Start hashen; Quellen/alte DB unangetastet lassen. MemAvailable≥1984MiB, exactcaps/noOOM/health vor jeder Phase. Restore/Uploads nur seriell und bounded, keine Parallelitäts-/RAM-Erhöhung.
3. M erstellt remote privaten0700Backupordner, vollständige Inspect-/Netz-/Kong-Konfiguration und0600Envdateien. Keine Envwerte in Shellausgabe, Git, Prozessargumenten oder Logs. Alle StorageEnvwerte aus privatem Snapshot übernehmen; ausschließlich DATABASE_URL-Datenbankpfad sicher URL-kodiert auf neuen DBnamen ändern. Host/Port/User/Passwort/Query unverändert, neue Envdatei vor Start privat gegen Ziel prüfen. Envwerte mit NUL/Newline dürfen nicht ungeprüft in env-file geschrieben werden.
4. Frisches eigenes Dateivolume anlegen. Altes Volume NICHT wieder RW einhängen oder überschreiben: sonst zerstören die120Kollisionen den Rückweg. Alte Instanz stoppen, vom Netzwerk trennen (nicht darauf vertrauen, dass stop die IP freigibt), umbenennen und gestoppt behalten. Neue Instanz erhält Originalname, IP, beide Aliase, exakt gepinntes vorhandenes Image, Caps/Entrypoint/Cmd/Workdir/Labels/Hardening; nur DBpfad und Volumequelle ändern. Vor Start vollständigen Configvergleich mit erlaubten Differenzen durchführen. Während Wartung ist Storage nicht bereit; keine Bereitschaft simulieren. Altes gestopptes/disconnected Rollback-Objekt ist zusätzlich vorhanden: Guards müssen fünf aktive kanonische Dienste prüfen und dieses konkrete gestoppte Objekt ausdrücklich kennen, keine breite Guardlockerung.
5. Storage starten, Migrationen ausschließlich im neuen Clone beobachten. Gatewaystatus200 reicht nicht: direkte eigene DBidentität/-metadaten plus5338 tatsächliche API-GETs prüfen. Reale Quellbytes über StorageAPI mit eigener QA-Serviceberechtigung und unveränderten kanonischen Bucket/Keys in das frische Volume importieren. Keine120zusätzlichen Varianten und kein Überschreiben des alten Volumes. Bei bereits restaurierten storage.objects-Zeilen gezieltes Upsert nur im neuen Clone; vorab an einem Objekt prüfen, welche id/version/metadata/owner-Felder die API verändert. Keine Annahme, dass ein Upload byte- und zeilenidentisch ist. FILE_SIZE_LIMIT aktuell5242880: alle Quellobjektgrößen vorher prüfen, bei Überschreitung stoppen und expliziten Plan anpassen. Keine kostenlose Bereitschaft durch Metadaten oder lokale Dateikopie behaupten.
6. Vollständige5338API-GETs gegen tatsächlich importierte Bytes/SHA und gebundene Wortzeitmarken prüfen; insbesondere120Byte- und6Timingabweichungen ausräumen. Danach tatsächlichen nativen CAS gemäß M-Vertrag gegen GENAU dieselbe neue Datenbank ausführen. DB-DSN nur aus privatem identischen Ziel ableiten; realen Transaktionsausgang und erwartete Tabellen-/Zeilendiffs belegen. Kein SQL-Erfolg als Browser-/HTTP-Erfolg ausgeben. Alte188 und geschützte185-Quelle unverändert nachweisen; neue Clone-Diffs für Storage-Migration/Import/CAS einzeln klassifizieren. Keine globale Unverändertheitsbehauptung für den absichtlich bearbeiteten Clone.
7. Dieser erste Schritt schaltet ausschließlich Storage und nativen CAS um; Auth/REST bleiben zunächst alt. Daher KEINE authentifizierte Browser-E2E-Behauptung. Erst für spätere Browserabnahme AuthGOTRUE_DB_DATABASE_URL und RESTPGRST_DB_URI in gleicher sicherer Stop/Backup/Replace-Weise auf dieselbe aktuelle neue DB richten, JWT/Keys/IP/Aliase unverändert. Auch deren Startmigrationen nur im neuen Clone erlauben. Drei DSN-Ziele erneut privat auf Gleichheit prüfen; neue normale QA-Sitzung und tatsächliche Berechtigungen testen. Keine alten Browsercookies/Sessions injizieren. M-3143App erst nach konsistentem Stack gezielt starten.

## Konkretes Storage-Kommandogerüst — von S5 NICHT ausgeführt

Die drei Platzhalterdateien/-namen erstellt M aus den privaten geprüften Konfigurationen. Keine Geheimnisse inline. Keine docker-rm/volume-rm/dropdb-Kommandos im Rückweg.

```sh
SITOV_QA_NET=sitov-night-20261008-qa-isolated
SITOV_STORAGE=sitov-night-20261008-qa-storage
SITOV_OLD_STORAGE=sitov-night-20261008-qa-storage-rollback-UNIQUE
SITOV_NEW_FILES=OWN_FRESH_VOLUME
SITOV_PRIVATE_ENV=PRIVATE_0600_COMPLETE_STORAGE_ENVFILE
SITOV_STORAGE_IMAGE=sha256:4f0eb90b935c676914ed0609c2c7d47cddb3f336155726bb2d5542617d4afdfa
# M has already created/verified new own DB, private backups and fresh volume.
docker stop "$SITOV_STORAGE"
docker network disconnect "$SITOV_QA_NET" "$SITOV_STORAGE"
docker rename "$SITOV_STORAGE" "$SITOV_OLD_STORAGE"
docker create --name "$SITOV_STORAGE" --network "$SITOV_QA_NET" --ip 10.0.3.5 --network-alias storage --network-alias sitov-night-20261008-qa-storage --memory 256m --cpus 0.5 --pids-limit 256 --shm-size 64m --restart no --label sitov.qa.namespace=sitov-night-20261008-qa --env-file "$SITOV_PRIVATE_ENV" --mount "type=volume,src=$SITOV_NEW_FILES,dst=/var/lib/storage" --workdir /app --entrypoint docker-entrypoint.sh "$SITOV_STORAGE_IMAGE" node dist/start/server.js
# Compare actual new Config/HostConfig/EndpointSettings to preserved original.
docker start "$SITOV_STORAGE"
```

Vorwärtsabbruch: keinen zweiten Prozess mit demselben Namen/IP starten, keine teilgeprüfte Phase veröffentlichen. Bei IP-/Alias-/Migration-/Health-/RAM-/Checksumfehler sofort in definierten Rückweg. Bei nativen CASfehlern keine globalen Reihen zurückschreiben; neuer Clone bleibt isoliert für Diagnose.

```sh
# Freeze writes; new clone and fresh files remain retained for diagnosis.
SITOV_FAILED_STORAGE=sitov-night-20261008-qa-storage-failed-UNIQUE
docker stop "$SITOV_STORAGE"
docker network disconnect "$SITOV_QA_NET" "$SITOV_STORAGE"
docker rename "$SITOV_STORAGE" "$SITOV_FAILED_STORAGE"
docker rename "$SITOV_OLD_STORAGE" "$SITOV_STORAGE"
docker network connect --ip 10.0.3.5 --alias storage --alias sitov-night-20261008-qa-storage "$SITOV_QA_NET" "$SITOV_STORAGE"
docker start "$SITOV_STORAGE"
```

Rollback verwendet die unveränderte originale Containerkonfiguration, originale DBverbindung und das unberührte alte Dateivolume. Anschließend exactIP/Aliase/Images/Caps/Health/noOOM und sichere alte188-/185-Quellhashes prüfen. Wurden später Auth/REST ebenfalls umgestellt, beide auf ihre erhaltenen Originalinstanzen zurückstellen, bevor alte Browserprüfung wieder freigegeben wird. Neue DB/Volumes/fehlgeschlagene Instanzen erst in separat freigegebener Cleanup-Einheit abbauen.

Empfehlung: neue DB innerhalb des bestehenden eigenen QA-Clusters plus frisches Volume und reversible Storage-Ersetzung. Eine zweite gleichzeitig laufende komplette Runtime würde Ressourcen-/Scopevertrag erweitern und ist für diesen Schritt unnötig. Vorhandene DBs/Volumen und geschützte Quellen bleiben erhalten. M setzt nach Review um; S5 bleibt WAIT/jobs0. Kein RELEASE_READY.
