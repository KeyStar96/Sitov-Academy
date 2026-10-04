# Sitov Academy: unabhängige Sicherungen auf dem Mac

Der VPS erzeugt täglich eine vollständige verschlüsselte logische Sicherung. Der Mac-Abruf lädt ausschließlich die neueste vollständige `sitov-daily-*.age` herunter, prüft ihre äußere SHA256, entschlüsselt sie als Stream und prüft jede Datei anhand des inneren Manifests. Erst danach wird die Datei als geprüft übernommen. Kein Klartextarchiv wird gespeichert. Private SSH-/age-Schlüssel und Netzwerknamen gehören nicht in Git.

Der Installer legt `com.sitov.backup-pull` als Benutzer-LaunchAgent an. Er versucht den Abruf nach Anmeldung und um 04:30, 10:30, 16:30 und 22:30 in der Zeitzone des Mac. Eine bereits geprüfte aktuelle Datei wird nicht erneut heruntergeladen. macOS holt verpasste Kalenderstarts nach dem Aufwachen zusammengefasst nach; der Mac muss angemeldet und mit dem zulässigen Netzwerk verbunden sein. [Apple: zeitgesteuerte Jobs](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/ScheduledJobs.html)

Installation mit bereits vorhandenem privatem Schlüssel und geprüftem age-Binary:

```sh
python3 deploy/mac/install-backup-pull.py --destination PRIVATE_BACKUP_FOLDER --identity PRIVATE_AGE_IDENTITY --age AGE_EXECUTABLE
```

Die Programme werden nach `~/Library/Application Support/Sitov Academy/Tools` kopiert; die Hintergrundausführung benötigt keinen Zugriff auf den geschützten Documents-Workspace. Die private Freigabeliste liegt unter `~/Library/Application Support/Sitov Academy/Backups/allowed-wifi.json` und enthält ein JSON-Array ausdrücklich erlaubter normaler WLAN-Namen. Der Installer erzeugt zunächst `[]`. Der Stand vom 4. Oktober 2026 ist installiert, aber **für Downloads gesperrt**, weil die Liste noch leer ist und der lokale SSID-Zugriff derzeit nicht erlaubt ist.

## WLAN und Handy-Hotspots

Der Guard startet keine Netzwerkübertragung bei fehlender Freigabeliste, unbekannter SSID, fehlendem Wi-Fi-Pfad, teurer oder eingeschränkter Verbindung, mehreren unklaren WLAN-Adaptern oder Fehlern der lokalen Prüfung. Apple beschreibt [`isExpensive`](https://developer.apple.com/documentation/network/nwpath/isexpensive) unter anderem für Personal Hotspots. Diese Kennzeichnung identifiziert nicht garantiert jeden Android-/anderen Mobilhotspot; deshalb ist zusätzlich die ausdrückliche SSID-Freigabe erforderlich. Das Programm gibt ausschließlich einen Status und einen Grund aus, keine Netzwerknamen.

Während SSH-/SCP-Anfragen wird die Verbindung alle fünf Sekunden erneut geprüft. Bei einem erkannten Wechsel werden sämtliche Prozesse der privaten Übertragungsgruppe beendet und unvollständige Dateien entfernt. Diese Prüfung ist keine atomare Netzwerksperre: Zwischen Wechsel und Erkennung kann ein kurzer Übertragungsrest liegen. Das Programm setzt einen unterbrochenen Download nicht auf einem anderen Netz fort.

SSID-Zugriff über CoreWLAN benötigt auf aktuellen macOS-Versionen eine Standortberechtigung. Ein reiner Hintergrundprozess kann diese nicht eigenständig erhalten. Apples unterstützter Weg erfordert eine native Benutzeranwendung mit entsprechendem Berechtigungsdialog und eingebettetem Agenten. Ohne diesen eingerichteten Weg bleibt der Abruf bewusst gesperrt. Die Skripte versuchen keinen alternativen Zugriff auf geschützte WLAN-Konfigurationen. [Apple DTS zum Hintergrundzugriff](https://developer.apple.com/forums/thread/759044)

## Speicher und Prüfung

Der Mac behält höchstens 14 heruntergeladene Tagesstände und ein zusätzliches Budget von 20 GiB; mindestens die neueste vollständige Datei bleibt erhalten. Andere Sicherungen, insbesondere die erste physische Cluster-/Konfigurationssicherung, werden von dieser Aufbewahrung nicht erfasst. Ein neuer Abruf verlangt zusätzlich 10 GiB freie Betriebsreserve. Erst eine neu geprüfte Sicherung erlaubt das Entfernen älterer eigener Tagesarchive. Ein fehlgeschlagener Download oder eine fehlerhafte Entschlüsselung löscht keine zuvor geprüfte Sicherung.

Das lokale Protokoll liegt unter `~/Library/Application Support/Sitov Academy/Backups/sitov-backup-pull.log`. `launchctl print gui/$(id -u)/com.sitov.backup-pull` zeigt den Job. Eine leere Liste erzeugt `wifi_allowlist_missing`; gesperrter SSID-Zugriff erzeugt `ssid_unavailable`. Diese beiden Zustände sind keine erfolgreichen externen Backups.

```sh
SITOV_TEST_AGE_BIN=AGE_EXECUTABLE python3 -m unittest discover -s deploy/mac -p 'test_sitov_*.py'
```

Die Tests prüfen echte Streamingentschlüsselung, Manipulations-/Manifestfehler, Aufbewahrung, die Sperre vor SSH sowie den Abbruch der gesamten Prozessgruppe bei einer unzulässigen Netzwerkänderung.
