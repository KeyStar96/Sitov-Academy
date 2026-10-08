# Sitov Academy: passive Konfigurationsprüfung

`deploy/vps/sitov-config-drift.py` erkennt, wenn ein Coolify-Neudeployment,
eine Container-Neuerstellung oder eine manuelle Konfigurationsänderung von den
festgelegten Betriebsregeln abweicht. Es prüft die Compose-Datei und die
tatsächlich laufenden Container unabhängig gegen dieselben Regeln.

| Bereich | Geprüfte Regeln |
| --- | --- |
| Auth | Feste Domain-/Weiterleitungsziele, Bestätigungspflicht, lokaler SMTP-Versand und fünf Mailvorlagen, kein aktivierter eigener E-Mail-Hook, HIBP aktiv mit Fail-open, mindestens acht Zeichen, gepinntes Image, 256 MiB RAM/Swap und 0,5 CPU, Host-Gateway für Mail, keine veröffentlichten Ports |
| Storage | Beide Uploadgrenzen exakt 512 MiB, S3-Backend, gepinntes Image, 384 MiB RAM/Swap und eine CPU, keine veröffentlichten Ports |
| Kong | Gepinntes Image, ein nginx-Worker, 512 MiB RAM/Swap und eine CPU, ausschließlich `127.0.0.1:9080` |
| PostgreSQL | Ausschließlich `127.0.0.1:5432`; laufendes Image stimmt mit Compose überein |
| Anwendung | Produktionsdomain, Supabase-URL und ein vertrauenswürdiger Proxy-Hop; aktiver systemd-Dienst als `sitov`, 2 GiB RAM, private Schreibumgebung, strenger Systemschutz, Loopback-Netz und Loopback-Listener |
| nginx | Private Listener, beide Wege mit Proxy-Freigabe, konkrete aktuelle Traefik-Adressen und `deny all`, lokale Upstreams, keine URL-Token im Zugriffslog, 512-MiB-Uploadgrenze, Streaming, Uploadpause, Anfrage-/Parallelgrenzen und größerer App-Headerpuffer |

Auth nutzt hier SMTP mit lokalen Vorlagen. Ein Supabase-E-Mail-Hook ist nicht
eingerichtet. Die Prüfung verlangt keinen neuen Hook; seine spätere Aktivierung
wäre eine bewusste Änderung des Betriebsvertrags. Nicht überwachte private
Schlüssel und Zugangsdaten werden weder ausgegeben noch in eine Vergleichsdatei
kopiert. Auch Fehlerausgaben und Parserfehler werden nicht veröffentlicht.

Die Ausgabe enthält ausschließlich feste Prüfnamen:

```text
OK sitov.supabase-auth.compose.GOTRUE_PASSWORD_HIBP_ENABLED
DRIFT sitov.supabase-kong.compose.KONG_NGINX_WORKER_PROCESSES
```

Exit-Code `0` bedeutet, dass alle Prüfungen bestanden haben. Exit-Code `1`
bedeutet eine Abweichung oder eine nicht lesbare Quelle. Die Prüfung verändert
keine Datei, startet keinen Dienst und aktualisiert keinen Container. Bei einer
Abweichung gezielt die betreffende Regel prüfen und reparieren. Ein pauschaler
erneuter Aufruf von `configure-local-services.py` ist keine Reparatur für Drift:
spätere Domain-, Upload- und Swap-Anpassungen müssen erhalten bleiben.

## Betrieb

Auf dem VPS ist Python mit PyYAML erforderlich; die bestehende Coolify-
Konfiguration nutzt diese Bibliothek bereits. Die neuen Dateien installieren:

```sh
install -d -m 0700 /opt/sitov-ops
install -m 0700 deploy/vps/sitov-config-drift.py /opt/sitov-ops/
install -m 0644 deploy/vps/sitov-config-drift.service /etc/systemd/system/
install -m 0644 deploy/vps/sitov-config-drift.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now sitov-config-drift.timer
systemctl start sitov-config-drift.service
```

Der Timer startet fünf Minuten nach dem Boot und anschließend alle 30 Minuten,
mit bis zu einer Minute zufälliger Verzögerung. Der Dienst begrenzt RAM und CPU
und schreibt seine sicheren Ergebnisse in das lokale Journal:

```sh
journalctl -u sitov-config-drift.service --since today
python3 /opt/sitov-ops/sitov-config-drift.py
```

Die produktive Installation und ihr Timer sind seit 8. Oktober 2026 aktiv;
der gehärtete systemd-Dienst bestand alle **149 aktuellen Prüfungen**.
`ReadWritePaths=/var/log/nginx` erlaubt dem von `nginx -T` verwendeten
Konfigurationstest das Öffnen seiner vorhandenen Logdateien. Die
Konfigurationsdateien bleiben durch `ProtectSystem=strict` geschützt.

Ein fehlgeschlagener Lauf bleibt als fehlgeschlagener systemd-Dienst sichtbar.
Die eigene Installation unter `/opt/sitov-ops` bleibt unabhängig vom
Anwendungsrelease und von dessen Git-Arbeitsverzeichnis.
Ein unabhängiger Alarmkanal ist eine separate Betriebsaufgabe. Die Prüfung liest
die aktive nginx-Konfigurationsstruktur mit `nginx -T` und den aktiven
systemd-Dienst; sie beweist keine tatsächliche E-Mail-Zustellung und ersetzt
keine Ende-zu-Ende-Probe. `nginx -T` prüft die aktuell installierten Dateien,
nicht den im Speicher verbliebenen Stand vor einem noch ausstehenden Reload.

Gepinnte Auth-, Storage- und Kong-Versionen gehören zu den überprüften
Betriebsregeln. Bei einem geplanten Upgrade zuerst die passende Änderung
bewerten und testen, dann den Betriebsvertrag im Skript und die Fixtures
aktualisieren. Ein Wechsel des API-Gateways darf die lokalen Ports und
Proxy-Regeln nicht unbeabsichtigt verändern. Aktuelle upstream-Änderungen
stehen im [Supabase-Changelog](https://supabase.com/changelog).

## Verifikation

```sh
python3 -m unittest discover -s deploy/vps/tests -p 'test_sitov_config_drift.py' -v
```

Die isolierten Tests prüfen korrekte Compose-/Runtime-Zustände, fehlende und
veränderte Regeln, unterschiedliche Ressourcen und Images, öffentliche Ports,
fehlende Mail-/Proxy-Einstellungen, veraltete Proxy-Adressen, doppelte Schlüssel,
Ausfälle von Quellen sowie den vollständigen passiven Leseweg. Geheimnis-
Fixtures dürfen in keinem Ergebnis oder Fehlertext erscheinen. Es werden
keine produktiven Daten oder Dienste für diese Tests verwendet.
