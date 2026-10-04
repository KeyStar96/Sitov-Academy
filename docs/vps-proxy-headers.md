# Sitov Academy: sporadische nginx-502 am 4. Oktober 2026

Die nginx-Fehlerprotokolle belegen eine konkrete Ursache der sporadischen 502:
`upstream sent too big header while reading response header from upstream`
für die Next-Anwendung auf `127.0.0.1:3000`. Vor der Korrektur enthielt die
App-Proxy-Konfiguration keinen eigenen Antwortheader-Puffer; auf diesem VPS galt
die Standardgröße von 4 KiB. Solche Antworten können unter anderem mehrere
Session-Cookies und Next-`Link`-Header enthalten. Die genaue Zusammensetzung
privater Authentifizierungsheader wurde für die Diagnose nicht gelesen.

Die Auswertung von `/var/log/nginx/error.log` und `sitov-access.log` am
4. Oktober gegen 18:22 Uhr CEST ergab folgende Aggregate, ohne Nutzerpfade,
Queryparameter, Cookies oder personenbezogene Angaben zu übernehmen:

| Fehlerursache | Anzahl am 4. Oktober, UTC | Einordnung |
| --- | ---: | --- |
| Antwortheader überschreiten den nginx-Puffer | 22 | 20 GET-Anfragen im Dashboard, zwei in der Verwaltung; zuletzt 15:34:06/12 UTC beziehungsweise 17:34:06/12 Uhr CEST |
| Verbindung zur App abgelehnt | 8 | Innerhalb der protokollierten Deployment-Unterbrechungen 12:54:29–12:59:52 UTC und 14:58:54–15:02:17 UTC |

Die tatsächliche Anwendungseinheit heißt **`sitov-app.service`**.
`sitov-academy.service` existiert nicht und liefert deshalb keinen brauchbaren
Verfügbarkeitsnachweis. Bei der Diagnose lief die App seit 15:02:17 UTC mit
PID `2920418` und `NRestarts=0`; nginx lief ebenfalls.

## Korrektur und Aktivierungsnachweis

[Die nginx-Vorlage](../deploy/vps/nginx.conf) erweitert ausschließlich den
App-Proxy unter `location /`:

```nginx
proxy_buffer_size 32k;
proxy_buffers 8 16k;
proxy_busy_buffers_size 64k;
proxy_buffering off;
```

Der Header-Puffer bietet begrenzten Spielraum gegenüber den beobachteten
4-KiB-Überläufen. Die übrigen Größen erfüllen die nginx-Konfigurationsbedingungen.
Antwortkörper bleiben gestreamt; Storage-/API-Proxy, Uploadgrößen, vertrauenswürdige
Proxy-Regel und Host-Weitergabe wurden nicht verändert. Auch bei deaktivierter
Antwortpufferung begrenzt `proxy_buffer_size` die zuerst gelesenen Header, wie
die [nginx-Dokumentation](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_buffer_size)
beschreibt.

Die Änderung wurde am **4. Oktober 2026 um 16:28:39 UTC / 18:28:39 Uhr CEST**
nach Sicherung und erfolgreichem `nginx -t` durch einen nginx-Reload aktiviert.
Die App wurde dabei nicht neu gestartet; PID `2920418` blieb unverändert.

- Sicherung: `/root/backups/sitov-nginx-response-headers-20261004T162839Z`
- SHA-256 der aktivierten Konfiguration: `cd084078b47adf543618d1bb136ca2b4ebfc9a140cb9b15372c58d7a4f9611d5`
- Syntaxprüfung und Reload: erfolgreich
- Öffentliche Health über Domain und IP: HTTP 200; Hauptdienste aktiv
- Drei gezielte Konfigurationsprüfungen: erfolgreich

## Domain und weitere Diagnose

`https://www.sitov-academy.com` ist der konfigurierte kanonische Ursprung.
Der frühere Einstieg über die Server-IP erreicht weiterhin dieselbe Anwendung
über eine gesonderte Traefik-Regel; sein Fortbestehen belegt keinen Domainfehler.
Dieser Einstieg bleibt für bestehende API-/Storage-Verbindungen kompatibel.

Die Korrektur behebt die nachgewiesene Pufferursache und ist keine Zusage, dass
jeder zukünftige 502 dieselbe Ursache hat. Bei erneutem Auftreten den genauen
Zeitpunkt und die betroffene URL zur Korrelation prüfen; private URLs,
Queryparameter und Sitzungswerte gehören nicht in öffentliche Diagnosen.
Anschließend nginx-Ursache, tatsächlichen App-Dienst und Health zusammen prüfen.
