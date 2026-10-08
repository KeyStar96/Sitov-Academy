# Sitov Academy: alte Releases und veränderlicher Next.js-Cache

Die Bereinigung erhält das aktive Release, alle tatsächlich laufenden oder
konfigurierten Dienstverzeichnisse und mindestens eine geprüfte ältere Version
für einen Rollback. Sie verwendet denselben Lock wie die Veröffentlichung und
prüft Laufzeit, Verzeichnisidentitäten und die verbleibende Rollbackversion
erneut vor dem ersten Löschen. Datenbank, Container, Sicherungen, Medien und
das Quellrepository sind keine Löschziele.

## Produktiver Betrieb seit 8. Oktober 2026

Nach konkreter Prüfung wurden **105 alte vollständige Releases** entfernt.
Erhalten sind `/var/www/sitov-releases/93473d50db8c` als aktiver Stand und
`/var/www/sitov-releases/99f973b206c3` als geprüfte Rückrollversion. Die
Rückrollversion bestand zusätzlich eine isolierte HTTP-Readiness-Probe gegen
die aktuelle Datenbank; der aktive Dienst blieb dabei verfügbar.

Die installierte Veröffentlichung verwendet
`/opt/sitov-ops/sitov-deploy-release.sh`; das VPS-Quellrepository blieb sauber.
Nach erfolgreicher Aktivierung und Readiness führt sie die gemeinsame
Bereinigung aus. Zusätzlich startet `sitov-release-cleanup.timer` täglich
um 05:00 Uhr Europe/Berlin mit bis zu fünf Minuten zufälliger Verzögerung
den geschützten Dienst. Er erhält den aktiven und einen geprüften früheren
Stand sowie alle durch tatsächlich laufende Dienste geschützten Verzeichnisse.
Der produktive Bereinigungsdienst wurde erfolgreich ausgeführt.

## Integritätsprüfung nach einem produktiven Lauf

Next.js speichert seinen Servercache bei `next start` standardmäßig auf der
lokalen Festplatte. ISR schreibt erzeugte Seitenantworten erneut. Das ist in
der [offiziellen Self-Hosting-Dokumentation](https://nextjs.org/docs/app/guides/self-hosting#caching-and-isr)
beschrieben. Der installierte Quellcode
`node_modules/next/dist/server/lib/incremental-cache/file-system-cache.js`
bestätigt die konkreten Pfade in `FileSystemCache.set` und `getFilePath`.

Die gemeinsame Prüfung in `sitov-release-cleanup.py` akzeptiert deshalb
veränderte Antwortdateien ausschließlich unter `.next/server/app/` mit den
Endungen `.html`, `.meta`, `.rsc` und `.body`. Darunter fallen auch die
erzeugten `*.segments/*.segment.rsc`. Auch diese Dateien müssen reguläre
Dateien innerhalb des Release bleiben; symbolische Links sind nicht erlaubt.

Quelltext, kompiliertes JavaScript, JSON-Buildmanifeste, Lockfile, Build-ID und
Runtime-/Vorbereitungsmarker werden weiterhin anhand ihrer ursprünglichen
Prüfsummen kontrolliert. Die gespeicherten Manifeste werden nicht verändert
oder neu gestempelt. Ein Prüfsummenfehler außerhalb dieser konkreten
Antwortdateien bleibt ein Ablehnungsgrund.

`deploy-release.sh` verwendet vor einer Aktivierung dieselbe Prüfung:

```sh
python3 /opt/sitov-ops/sitov-release-cleanup.py \
  --releases-dir /var/www/sitov-releases \
  --verify-release /var/www/sitov-releases/REVISION
```

Dieser Modus liest nur, beansprucht keinen zweiten Deployment-Lock und
akzeptiert ausschließlich ein direktes echtes Revisionsverzeichnis im
verwalteten Releaseordner. Ein zusätzliches `cmp` der Build-IDs bleibt im
Aktivierungsweg erhalten. Falls die gemeinsame Prüfung in einer älteren
Installation fehlt, bleibt dort die strengere vollständige SHA256-Prüfung
aktiv. Die bekannte Readiness-/Mail-Prüfung und der Rollbackablauf bleiben Teil
der Aktivierung.

## Historische Releases vor dem vollständigen Vorbereitungsvertrag

Ein altes Verzeichnis mit fehlendem Vorbereitungsmanifest oder verändertem
unveränderlichem Artefakt wird automatisch erhalten. Nach konkreter Sichtung
kann eine exakte Revision ausdrücklich als überflüssig bezeichnet werden:

```sh
python3 /opt/sitov-ops/sitov-release-cleanup.py --dry-run --json \
  --retire-reviewed 0123456789ab
```

`--retire-reviewed` ist wiederholbar. Eine solche Ausnahme ist ausschließlich
ein Löschauftrag und macht die Version niemals zu einem Rollbackkandidaten.
Die Revision muss ein bekannter vollständiger Git-Commit des Quellrepositories
sein; ein vorhandener Vorbereitungsmarker muss dazu passen. Build-ID,
Serverdateimanifest, Paketdefinition, Lockfile und lokale Next-Runtime müssen als echte,
nicht leere Dateien vorliegen. Ihr ursprünglicher Vorbereitungszeitpunkt
beziehungsweise der Build-ID-Zeitpunkt muss sowohl vor der aktiven Version
als auch vor der verbleibenden geprüften Rollbackversion liegen.
Die obersten Einträge müssen zum archivierten Git-Commit oder zu den konkret
bekannten Build-/Runtime-Dateien gehören; unklassifizierte Upload-, Backup-
oder sonstige Datenordner verhindern eine historische Ausnahme. Der
archivierte `app`-Quellordner muss vorhanden sein.

Aktive oder von Diensten verwendete Versionen, fremde Namen, Links,
eingehängte Dateisysteme und neuere Vorbereitungen bleiben geschützt. Die
konkrete Inventarliste zuerst prüfen; danach dieselben Revisionsargumente mit
`--apply` verwenden. Manifeste und Marker werden auch hierbei nicht geändert.
Bei ausdrücklich geprüften historischen Löschzielen werden die alten
Assetbestände nicht erneut vollständig gehasht. Aktive und verbleibende
Rollbackversion erhalten weiterhin die vollständige Prüfung der
unveränderlichen Artefakte.

## Speicherermittlung und Tests

Auf Linux nutzt die Inventarisierung natives `du --summarize
--one-file-system --block-size=1`, statt jede Datei über Python einzeln zu
prüfen. Symbolische Links werden nicht verfolgt. Mountinformationen werden
vorher auf fremde und auf demselben Gerät liegende Bind-Mounts kontrolliert.
Für eine bereits vorhandene konkrete Inventarliste kann
`--size-inventory /root/sitov-release-cleanup-plan.json` deren Bytewerte
übernehmen. Der aktive Stand und jede Verzeichnisidentität müssen weiterhin
übereinstimmen. Diese Werte sind Speicher-Schätzungen; sie bestimmen keinen
Löschauftrag. Tatsächliche Pfade, Mounts, Laufzeit und verbleibende
Rollbackversion werden unabhängig erneut geprüft.

```sh
python3 -m unittest discover -s deploy/vps/tests -p 'test_*release*.py' -v
```

Die isolierten Prüfungen decken Aktivierung und Bereinigung, ISR und
unveränderliche Artefakte, unveränderte Manifeste, alte Git-Identitäten,
verbleibenden Rollback, Laufzeitwechsel, Links, Mounts, Verzeichnisersetzung,
Lockkonflikte sowie native Speicherermittlung ab. Sie verändern keine
produktiven Dienste oder Releases.
