# Lokales Status-Monitoring

Eigenständiger Python-Standardbibliothek-Container, 128 MiB hart, 0,25 CPU,
kein Swap, kein Docker-Socket, keine Host-Prozess-/DB-Zugriffe. Ein systemd-
Oneshot sammelt alle 60 Sekunden per festen lokalen Lesebefehlen Statusdaten
(64 MiB / 0,25 CPU / 45 s). Nur aggregierte Zähler gelangen in den Container.
Der DB-Zugriff hat drei Sekunden Statement-Timeout. Historie: 1440 Messpunkte;
Docker-Logs: zweimal 1 MiB. Fehler ergeben explizite unknown-/stale-Alarme.

Zugriff: `https://217.154.228.254/status/`, TLS über bestehenden Traefik,
Nginx Basic-Auth für Seite, Status, Historie und Health. Containerport nur
127.0.0.1; internes Docker-Netz ohne Internet-Egress. Zugangsdaten ausschließlich
root-lesbar unter `/root/sitov-status-access.txt`, Passwort-Hash bei Nginx.

Grenzen: Disk >80 %, Host-RAM (MemAvailable) >90 %, CPU >90 %, vier
Health-Fehler in Folge; zusätzlich fehlende/ungesunde Supabase-Container,
inaktive App/Mail/TTS/Postfix/Nginx-Dienste, fehlgeschlagene/abgelaufene Mailjobs,
mehr als 100 fällige Jobs oder ältester fälliger Job >300 Sekunden.
Alarme und Entwarnungen gehen unabhängig von App/DB-Outbox über lokalen Postfix
an `MONITOR_RECIPIENT` (Default: info@sitov-academy.com). Änderungen werden
zusammengefasst, höchstens eine Meldung pro fünf Minuten; SMTP-Fehler bleiben
sichtbar und werden im nächsten Intervall erneut versucht. Keine Testmail an
Produktivempfänger senden. Ausfall des ganzen Hosts oder Postfix kann auf demselben
Host nicht zuverlässig per E-Mail gemeldet werden; ein externer Watchdog ist
wegen R3 nicht Bestandteil. Ein stehender Datensammler wird nach 150 s in der
Statusseite und im Container-Healthcheck als ausgefallen angezeigt.

Installation auf VPS: nach Backup und geprüftem Git-Pull
`python3 deploy/vps/monitoring/install.py`.
Das Skript prüft die Ausgangskonfiguration, sichert Konfigurationsdateien,
setzt TTS von 2048 auf 1792 MiB (-256), installiert Monitor (+128) und Sammler
(+64); bekannte Dienstobergrenzen damit netto -64 MiB. Bei Wiederholung wird
kein weiterer TTS-Abzug vorgenommen. Es meldet alle Container-/systemd-Limits,
einschließlich unlimitierter Fremdcontainer. Host-Überbuchung bleibt explizit.

Rollback: Timer stoppen/deaktivieren; Compose-Service herunterfahren; die
im Installationsbackup gespeicherten Nginx- und TTS-Dateien restaurieren,
`nginx -t`, Reload und `systemctl daemon-reload`; das ursprüngliche TTS-Limit
per `systemctl set-property --runtime sitov-tts MemoryMax=2G` zurücksetzen.
Monitor-Speicher und Datensammler zuerst freigeben, dann TTS anheben.
Statushistorie und Zugangsdaten können für eine erneute Installation bleiben.
