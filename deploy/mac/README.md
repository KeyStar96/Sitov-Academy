# Sitov Academy: unabhängige Sicherungen auf dem Mac

Der VPS erzeugt täglich eine vollständige verschlüsselte logische Sicherung. Der Mac-Abruf lädt ausschließlich die neueste vollständige `sitov-daily-*.age` herunter, prüft ihre äußere SHA256, entschlüsselt sie als Stream und prüft jede Datei anhand des inneren Manifests. Erst danach wird die Datei als geprüft und dauerhaft geschrieben übernommen. Der Mac bestätigt anschließend genau dieses Archiv auf dem VPS; die bestätigte VPS-Kopie wird unter der gemeinsamen Backup-Sperre gelöscht. Ein zwischenzeitlich neueres Archiv bleibt erhalten. Bei WLAN-Abbruch oder fehlgeschlagener Bestätigung bleiben die geprüfte Mac-Datei und die VPS-Kopie erhalten; der nächste Lauf wiederholt nur die Bestätigung. Kein Klartextarchiv wird gespeichert. Private SSH-/age-Schlüssel und Netzwerknamen gehören nicht in Git.

Der Installer legt `com.sitov.backup-pull` als Benutzer-LaunchAgent an. Er versucht den Abruf nach Anmeldung und um 04:30, 10:30, 16:30 und 22:30 in der Zeitzone des Mac. Eine bereits geprüfte aktuelle Datei wird nicht erneut heruntergeladen; eine ausstehende VPS-Bestätigung wird erneut versucht. Ohne anstehendes Archiv endet der Lauf erfolgreich mit `no_pending_backup`. macOS holt verpasste Kalenderstarts nach dem Aufwachen zusammengefasst nach; der Mac muss angemeldet und mit dem zulässigen Netzwerk verbunden sein. [Apple: zeitgesteuerte Jobs](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/ScheduledJobs.html)

Installation mit bereits vorhandenem privatem Schlüssel und geprüftem age-Binary:

```sh
python3 deploy/mac/install-backup-pull.py --destination PRIVATE_BACKUP_FOLDER --identity PRIVATE_AGE_IDENTITY --age AGE_EXECUTABLE
```

Die Programme werden nach `~/Library/Application Support/Sitov Academy/Tools` kopiert; die Hintergrundausführung benötigt keinen Zugriff auf den geschützten Documents-Workspace. Die private Freigabeliste liegt unter `~/Library/Application Support/Sitov Academy/Backups/allowed-wifi.json` und enthält ein JSON-Array ausdrücklich erlaubter normaler WLAN-Namen. Der Installer erzeugt zunächst `[]`. Nur ausdrücklich vom Inhaber freigegebene WLANs werden lokal eingetragen. Netzwerknamen bleiben außerhalb des Repositorys.

## WLAN und Handy-Hotspots

Der Guard startet keine Netzwerkübertragung bei fehlender Freigabeliste, unbekannter SSID, fehlendem Wi-Fi-Pfad, teurer oder eingeschränkter Verbindung, mehreren unklaren WLAN-Adaptern oder Fehlern der lokalen Prüfung. Apple beschreibt [`isExpensive`](https://developer.apple.com/documentation/network/nwpath/isexpensive) unter anderem für Personal Hotspots. Diese Kennzeichnung identifiziert nicht garantiert jeden Android-/anderen Mobilhotspot; deshalb ist zusätzlich die ausdrückliche SSID-Freigabe erforderlich. Das Programm gibt ausschließlich einen Status und einen Grund aus, keine Netzwerknamen.

Während SSH-/SCP-Anfragen wird die Verbindung alle fünf Sekunden erneut geprüft. Bei einem erkannten Wechsel werden sämtliche Prozesse der privaten Übertragungsgruppe beendet und unvollständige Dateien entfernt. Diese Prüfung ist keine atomare Netzwerksperre: Zwischen Wechsel und Erkennung kann ein kurzer Übertragungsrest liegen. Das Programm setzt einen unterbrochenen Download nicht auf einem anderen Netz fort.

SSID-Zugriff über CoreWLAN benötigt auf aktuellen macOS-Versionen eine Standortberechtigung. Ein reiner Hintergrundprozess kann diese nicht eigenständig erhalten. Apples unterstützter Weg erfordert eine native Benutzeranwendung mit entsprechendem Berechtigungsdialog und eingebettetem Agenten. Der Installer baut dafür die lokal signierte Anwendung **Sitov Academy Backup-WLAN.app** mit eingebettetem, durch `SMAppService` verwaltetem Benutzeragenten. Die App einmal öffnen und „WLAN-Freigabe einrichten“ wählen; die macOS-Standortberechtigung und gegebenenfalls Hintergrundausführung müssen vom Inhaber bestätigt werden. Der CLI-Guard fragt den Agenten über lokales XPC ab und erhält nur eine Freigabe mit sicherem Grund. Ohne diesen eingerichteten Weg bleibt der Abruf gesperrt. Die Skripte versuchen keinen alternativen Zugriff auf geschützte WLAN-Konfigurationen. [Apple DTS zum Hintergrundzugriff](https://developer.apple.com/forums/thread/759044)

## VPS-Aufbewahrung

Der tägliche VPS-Dienst hält höchstens eine vollständig geprüfte verschlüsselte Tagesversion samt SHA256 zur Übergabe bereit. Klartext existiert nur während der Erstellung; nach erfolgreichem Export wird er entfernt. Ohne geeignete Mac-Verbindung bleibt die letzte geprüfte Version erhalten. Nach der bestätigten Mac-Übergabe darf der VPS keine Tageskopie mehr halten, bis der nächste Lauf eine neue erzeugt. Fehlgeschlagene Exporte ersetzen keine gültige Vorgängerversion. Migration-, Cluster- und Konfigurationssicherungen erfordern eine separate Prüfung vor einer Entfernung; die Tagesbereinigung erfasst sie nicht. Siehe `docs/sitov-backup-retention.md`.

## Speicher und Prüfung

Der Mac behält höchstens 14 heruntergeladene Tagesstände und ein zusätzliches Budget von 20 GiB; mindestens die neueste vollständige Datei bleibt erhalten. Andere Sicherungen, insbesondere die erste physische Cluster-/Konfigurationssicherung, werden von dieser Aufbewahrung nicht erfasst. Ein neuer Abruf verlangt zusätzlich 10 GiB freie Betriebsreserve. Erst eine neu geprüfte Sicherung erlaubt das Entfernen älterer eigener Tagesarchive. Ein fehlgeschlagener Download oder eine fehlerhafte Entschlüsselung löscht keine zuvor geprüfte Sicherung.

Das lokale Protokoll liegt unter `~/Library/Application Support/Sitov Academy/Backups/sitov-backup-pull.log`. `launchctl print gui/$(id -u)/com.sitov.backup-pull` zeigt den Job. Eine leere Liste erzeugt `wifi_allowlist_missing`; fehlender Agent `wifi_agent_unavailable`, fehlende Standortfreigabe `location_permission_required` oder `location_permission_denied`, gesperrter SSID-Zugriff `ssid_unavailable`. Diese Zustände sind keine erfolgreichen externen Backups. `scripts/pull-vps-backup.sh` verwendet denselben installierten, WLAN-geschützten Abruf; der frühere Klartext-Rsync ist entfernt.

```sh
SITOV_TEST_AGE_BIN=AGE_EXECUTABLE python3 -m unittest discover -s deploy/mac -p 'test_sitov_*.py'
```

Die Tests prüfen echte Streamingentschlüsselung, Manipulations-/Manifestfehler, Aufbewahrung, die Sperre vor SSH sowie den Abbruch der gesamten Prozessgruppe bei einer unzulässigen Netzwerkänderung.
