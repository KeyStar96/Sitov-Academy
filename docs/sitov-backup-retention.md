# Sitov Academy: tägliche Sicherungen auf dem VPS

`deploy/vps/backup-daily.py` erzeugt wie bisher online einen PostgreSQL-Dump,
Rollen und sämtliche Storage-Objekte mit ihrem Manifest. Zusätzlich enthält
`sitov-configuration.tar` die aktuellen privaten Wiederherstellungseinstellungen
und den **aktiven pgsodium-Schlüssel** aus dem PostgreSQL-Konfigurationsvolume.
Die Prüfsumme dieser regulären Archivdatei steht im selben äußeren Manifest wie
Dump und Storage. Der Timer startet
täglich um 03:30 Uhr Europe/Berlin. Die bestehende App läuft dabei weiter.
Der produktive Dienst verwendet `/opt/sitov-ops/backup-daily.py` zusammen mit
dem dort installierten Exporter, Recovery-Konfigurationsmodul und
`migrate-local.py`. Das systemd-Drop-in ersetzt dafür nur den Backup-Startbefehl;
das Git-Arbeitsverzeichnis auf dem VPS bleibt unverändert.

Der VPS hält höchstens **eine vollständige verschlüsselte tägliche Sicherung**
unter `/root/backups/encrypted/daily/`, zusammen mit ihrer `.age.sha256`.
Erst wenn der neue Klartextbestand anhand aller inneren Prüfsummen geprüft,
der age-Export erfolgreich beendet und seine äußere Prüfsumme erneut geprüft
wurde, ersetzt die neue Version die vorherige. Bei fehlendem öffentlichem
Empfänger, zu wenig Platz, einem geänderten Storage-Bestand oder Exportfehlern
bleibt die vorherige geprüfte verschlüsselte Version erhalten.

Klartext unter `/root/backups/daily/` ist nur temporärer Arbeitsbestand und
wird nach erfolgreichem Export vollständig entfernt. Nach einem fehlgeschlagenen
Lauf werden ausschließlich dessen neue Arbeitsverzeichnisse und fehlgeschlagene
Exportdateien entfernt. Die 20-GiB-Betriebsreserve gilt weiterhin; für den
laufenden Export werden Klartext und verschlüsseltes Archiv gleichzeitig
einkalkuliert.

Die Prüfsummendatei wird vor dem Archiv veröffentlicht. Das Archiv erscheint
anschließend atomar unter seinem endgültigen Namen. Beide Dateien werden vor
der Veröffentlichung auf den Datenträger synchronisiert; vorhandene Dateien
werden nicht überschrieben. Die tägliche Sicherung und ihre Wartung verwenden
gemeinsam `/var/lock/sitov-backup.lock`. Der Mac-Abruf kann diesen Lock für die
Bestätigung eines erfolgreich entschlüsselt geprüften Abrufs verwenden. Nach
einer solchen Übergabe darf der VPS bis zur nächsten erfolgreichen täglichen
Sicherung ohne tägliches Archiv sein.

Der private age-Schlüssel liegt ausschließlich auf dem Mac. Die innere
Archivprüfung nach Entschlüsselung und die Wiederherstellungsprobe erfolgen
dort. Ein SHA256-Abgleich des verschlüsselten Archivs auf dem VPS ist kein
Ersatz für eine Wiederherstellungsprobe. WLAN-Prüfung, Abruf und lokale
Aufbewahrung werden in `deploy/mac/README.md` beschrieben.

## Aktuelle Wiederherstellungseinstellungen

`deploy/vps/sitov-recovery-configuration.py` erfasst `/etc/sitov-academy`, nginx,
TLS-/Proxy-Konfiguration, Docker-Konfiguration, UFW und die Sitov-Systemdienste
einschließlich ihrer Drop-ins. Aus dem aktiven Supabase-Coolify-Dienst werden
Compose, `.env`, Entrypoint und die Konfiguration für Datenbankinitialisierung,
API-Gateway, Pooler und Logs aufgenommen. Dazu kommen das durch `docker inspect`
ermittelte aktive PostgreSQL-Konfigurationsvolume, das aktuelle DB-Image und die
tatsächlich verwendete DB-Umgebung sowie die Laufzeitkonfiguration des aktiven
App-Releases. Quellcode, Buildordner, Docker-Datenvolumes und Storage-Dateien
gehören nicht zu diesem Konfigurationsarchiv; Storage ist separat vollständig
gesichert.

Der tatsächlich verwendete Postfix-SMTP-Dienst wird mit `main.cf`, `master.cf`,
seinem Docker-Drop-in, den darin referenzierten Maps einschließlich ihrer
kompilierten Dateien und TLS-Schlüsseln erfasst. Die vorhandene OpenDKIM-
Konfiguration und privaten Signaturschlüssel sind ebenfalls enthalten. Paket-
Binärdateien und nicht verwendete Mailserver werden nicht pauschal kopiert.
Die kleinen installierten Python-/Shell-Helfer unter `/opt/sitov-ops` gehören
als operative Bestandteile der gesicherten Systemdienste zum Archiv;
`__pycache__`, alte Dateiversionen und vollständige Quellcheckouts bleiben außen
vor.

Alle Daten bleiben im privaten Arbeitsspeicher bzw. im temporären rootgeschützten
täglichen Sicherungsverzeichnis und werden gemeinsam mit der täglichen Sicherung
mit age verschlüsselt. Dateiinhalte, Schlüssel und Umgebungswerte werden nicht
ausgegeben. Es gelten Grenzen von 64 MiB Quelldaten und 4.096 Dateien; der
zusätzliche Platzbedarf wird vor dem Dump berücksichtigt. Fehlende Pflichtdateien,
ein fehlender oder leerer pgsodium-Schlüssel und unerwartete Dateitypen brechen
den Lauf ab, bevor eine alte Sicherung ersetzt wird.

Die Konfigurationswerte werden vor Beginn des Datenbank-/Storage-Exports
eingelesen und nach diesem Export sowie nach der Verschlüsselung erneut
verglichen. Eine geänderte Konfiguration, Schlüsselrotation, ein DB-Imagewechsel
oder ein Wechsel des App-Releases verwirft den neuen Lauf und erhält den
vorherigen Wiederherstellungspunkt. Symbolische Links innerhalb der ausdrücklich
erfassten Konfiguration bleiben im inneren Tarball erhalten; Links außerhalb
dieses Bereichs werden abgelehnt. Die reguläre äußere Archivdatei wird auf dem
Mac automatisch beim vollständigen Streaming-Abgleich mitgeprüft.

Für eine Wiederherstellung zuerst in einer privaten Umgebung entschlüsseln und
alle äußeren Prüfsummen prüfen. Das innere Konfigurationsarchiv vor dem gezielten
Zurückspielen anhand `sitov-recovery-configuration.json` prüfen: Es enthält
private Schlüssel und produktive Pfade relativ zu `/`. Compose, DB-Image,
pgsodium-Schlüssel, Datenbankdump, Rollen, Buckets und Storage müssen zum selben
Sicherungsstand gehören. Nicht blind in ein laufendes System entpacken.

## Bestehende tägliche Versionen bereinigen

Zuerst die konkrete Löschliste anzeigen; dieser Modus verändert keine Sicherung:

```sh
python3 /opt/sitov-ops/backup-daily.py --retention-plan
```

Die Ausgabe benennt das zu behaltende geprüfte Archiv, die älteren täglichen
Archive samt Prüfsummen und die täglichen Klartextverzeichnisse. Nur exakt
datierte Namen `sitov-daily-YYYYMMDDTHHMMSSffffffZ` in den beiden täglichen
Backupordnern kommen infrage. Symbolische Links, andere Namen und separate
Migrations-, Konfigurations- oder physische Sicherungen werden nicht gelöscht.
Fehlt jedes intakte verschlüsselte Archiv, wird die Bereinigung abgebrochen.

Nach Prüfung der Liste dieselbe Regel ohne neuen Datenexport anwenden:

```sh
python3 /opt/sitov-ops/backup-daily.py --prune-only
```

Unmittelbar vor dem ersten Löschen wird die Prüfsumme des geschützten Archivs
erneut geprüft. Der tägliche Timer wendet die Regel nach jedem erfolgreichen
neuen Export selbst an. Historische Sonder- und Wiederherstellungssicherungen
werden gesondert inventarisiert und beurteilt.

## Produktive Abnahme am 8. Oktober 2026

Der installierte Mac-LaunchAgent hat
`sitov-daily-20261008T155554106412Z.age` mit **806.494.648 Bytes** im
freigegebenen WLAN vollständig übertragen, entschlüsselt und anhand aller
**21.841 Manifest-Dateien** geprüft. Der zusätzliche Streaming-Abgleich des
inneren Konfigurationsarchivs bestätigte alle **148 aktuellen
Konfigurationsdateien**, einschließlich aktivem pgsodium-Schlüssel und den
acht installierten Betriebshelfern. Die SHA256 des verschlüsselten Archivs
lautet `9759f45a901387e464a5e0da260fd0ef4270e56228a971f17fe7b77e1c015a9a`.

Erst nach dieser Prüfung, dauerhafter lokaler Ablage und bestätigter Übergabe
wurde genau dieses Archiv samt Prüfsummendatei auf dem VPS entfernt. Ohne
freigegebenes WLAN verbleibt weiterhin ausschließlich die letzte vollständige
tägliche Version auf dem VPS. Die private WLAN-Freigabeliste und der private
age-Schlüssel liegen ausschließlich auf dem Mac.

Anschließend wurden **187 konkret geprüfte historische Sicherungsziele** auf
dem VPS entfernt. Die unabhängig entschlüsselt geprüften physischen und
Konfigurationssicherungen vom 4. Oktober bleiben auf dem Mac erhalten.
Unter `/root/backups` verblieben nur die täglichen Arbeits- und
Verschlüsselungsordner. Datenbankvolumes, Storage und aktive Konfiguration
waren keine Löschziele.

## Tests

```sh
SITOV_TEST_AGE_BIN=/path/to/age python3 -m unittest discover -s deploy/vps/tests -p 'test_*backup*.py' -v
```

Die Tests verwenden ausschließlich temporäre lokale Verzeichnisse. Sie prüfen
die Ersetzung und Aufbewahrung, beschädigte oder fehlende Prüfsummen,
fehlgeschlagene Dump-/Exportversuche, fehlenden Empfänger, Platzmangel,
Wartungsplan und Ausführung, symbolische Links, atomare Veröffentlichung sowie
echte age-Ver-/Entschlüsselung einschließlich Manipulationserkennung.
