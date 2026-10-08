# Sitov Academy: Kong-Worker auf dem VPS

Der am 8. Oktober 2026 untersuchte Kong-Container verwendet Kong 3.9.1 mit
einem CPU-Kontingent und 512 MiB RAM. Vier Nginx-Worker belegten jeweils etwa
113–133 MiB; der Container lag bei ungefähr 500 MiB und zeigte einen früheren
OOM-Abbruch. Die Workerzahl wird deshalb auf einen Worker festgelegt.

Kong dokumentiert `nginx_worker_processes` mit dem Standardwert `auto`.
Die entsprechende Umgebungsvariable lautet `KONG_NGINX_WORKER_PROCESSES`.
Die konfigurierte Workerzahl wird ausdrücklich gesetzt, damit sie zum
CPU-Kontingent dieses VPS passt. Quelle: [Kong-Konfigurationsreferenz](https://developer.konghq.com/gateway/configuration/#nginx_worker_processes).

| Einstellung | Gewünschter Wert |
| --- | --- |
| `KONG_NGINX_WORKER_PROCESSES` | Zeichenkette `1` |
| `mem_limit` | bestehende 512 MiB |
| `memswap_limit` | 512 MiB, einschließlich Swap |
| `cpus` | bestehendes Kontingent von einer CPU |

## Kontrollierter Compose-Patch

`deploy/vps/sitov-patch-kong-workers.py` prüft den bekannten Kong-3.9.1-Service und
fragt ausschließlich die drei nicht geheimen Docker-Ressourcenwerte ab.
Laufende RAM-, RAM-plus-Swap- und CPU-Grenzen müssen bereits den genannten
Werten entsprechen. Abweichungen, doppelte Zielschlüssel, geerbte oder
unklare Umgebungsdefinitionen werden abgelehnt.

Der Patch verändert ausschließlich die Worker-Einstellung und ergänzt eine
fehlende Swap-Grenze. Bestehende gleichwertige Ressourcenangaben bleiben in
ihrer ursprünglichen Schreibweise erhalten. Andere Bytes der Compose-Datei,
einschließlich Geheimnissen, Kommentaren, YAML-Typen, Ports und anderen
Services, bleiben erhalten. Listen und Mappings für `environment` werden
unterstützt. Es werden keine Container gestartet oder angehalten.

Auf dem VPS als root mit dem unabhängig installierten Helfer:

```bash
python3 /opt/sitov-ops/sitov-patch-kong-workers.py --dry-run
python3 /opt/sitov-ops/sitov-patch-kong-workers.py --apply
```

Der Standard ohne Argumente ist ebenfalls ein Dry-run. Die Ausgabe enthält
nur Zielwerte, Ressourcenangaben und Prüfsummen. Die Compose-Datei muss eine
private, reguläre root-eigene Datei ohne Symlink-Pfad sein.

Vor jeder tatsächlichen Änderung wird genau eine vorherige Konfiguration
atomar unter `/root/backups/sitov-kong-workers/previous-docker-compose.yml`
gesichert. Das Verzeichnis verwendet Modus `700`, die Sicherung Modus `600`.
Eine wiederholte Ausführung bei bereits passenden Werten erzeugt keine
zusätzliche Sicherung. Die Compose-Datei wird erst nach überprüfter Sicherung
und erneuter Prüfung auf parallele Änderungen atomar ersetzt.

## Aktivierung und Prüfung

Nach geprüftem Patch wird ausschließlich Kong neu erstellt:

```bash
cd /data/coolify/services/eknmzxvqilojjicinatnllbt
docker compose config --quiet
docker compose up -d --no-deps supabase-kong
```

Anschließend Kong-Healthcheck, tatsächliche Workerzahl, RAM-/Swap-/CPU-Grenzen
sowie App-Health, Auth, REST und Storage prüfen. Der laufende Container muss
die neue Konfiguration geladen haben. Unter vergleichbarer Last und während
einer Datenbanksicherung erneut Speicherverbrauch, OOM-Zähler und
Antwortzeiten kontrollieren; niedrigere Startwerte allein bestätigen noch
keine dauerhafte Stabilität.

Solange die temporäre Vorversion vorhanden ist, stellt ein Rollback die
gemeldete private Sicherung atomar als Compose-Datei wieder her und erstellt
danach ausschließlich `supabase-kong` neu. Die Sicherung enthält Geheimnisse
und verwendet auf dem VPS private Rechte. Sie ist kein dauerhaftes zweites
Backup: Nach bestätigter Übernahme der aktuellen Konfiguration in ein geprüftes
Mac-Backup kann sie gezielt entfernt werden.

`configure-local-services.py` setzt dieselben Worker- und Swap-Werte für
künftige Grundeinrichtungen. Dieser Patch führt kein Gateway-Upgrade durch:
Der bestehende Kong-Service bleibt gezielt auf der beobachteten Version.
Supabase nennt im [Changelog](https://supabase.com/changelog) einen Wechsel
des Standards neuer selbst gehosteter Installationen auf Envoy; ein solcher
Wechsel gehört zu einer gesondert geprüften Gateway-Migration.

## Produktive Abnahme am 8. Oktober 2026

Der gezielte Compose-Patch wurde auf dem VPS angewendet und ausschließlich Kong neu erstellt. Der laufende Container verwendet einen Worker bei unveränderten 512 MiB und einer CPU-Freigabe. Auth-/REST-Zugriff sowie interne und öffentliche App-Readiness bestanden. Zwei vollständige neue PostgreSQL-/Storage-Backups mit je 21.836 Objekten wurden erfolgreich erzeugt und verschlüsselt; die Abschlussprüfung zeigte für die neue Kong-cgroup einen bisherigen Spitzenwert von **195.051.520 Bytes (186,0 MiB)** und aktuell 155,9 MiB. `memory.events` meldete null `max`, `oom` und `oom_kill`, der gesunde Container null Neustarts. Der Konfigurationscheck bestand alle 149 aktuellen Invarianten. Dies ist die geprüfte Lastprobe; der laufende Driftcheck kontrolliert die persistierte Einstellung weiter.

Die temporäre Compose-Vorversion unter
`/root/backups/sitov-kong-workers/` wurde nach vollständig geprüfter
Mac-Sicherung der aktuellen Konfiguration bei der historischen Bereinigung
entfernt. Für eine spätere Wiederherstellung ist die auf dem Mac gesicherte
Konfiguration maßgeblich.
