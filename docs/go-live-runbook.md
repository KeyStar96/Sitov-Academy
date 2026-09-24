# Go-live: www.sitov-academy.com auf den VPS

Stand 24.09.2026. Der VPS (STRATO, `217.154.228.254`) läuft produktiv unter der IP; Domain und
Postfach liegen bei IONOS, die Domain zeigt noch auf die alte Netlify-Seite (`75.2.60.5`).

## Zuständigkeiten

| Wer | Was |
|---|---|
| Inhaber (STRATO-Kundencenter) | Firewall: nur 22, 80, 443 (TCP) und 443 (UDP) eingehend. Schließt Coolify (8000), Coolify-Realtime (6001/6002), Traefik (8080) und SMTP-Eingang (25). Ausgehende Mails (Port 25 raus) bleiben unberührt. |
| Inhaber (STRATO + IONOS) | Auftragsverarbeitungsverträge (Art. 28 DSGVO) im jeweiligen Kundencenter abschließen. |
| Inhaber (IONOS DNS) | TTL der A-Records `@` und `www` auf 5 Min. senken (≥ 1 h vor dem Umzug); zum Umzug beide auf `217.154.228.254`. MX, SPF, DKIM, DMARC und `mail` bleiben unverändert. Kein AAAA-Record. |
| VPS (`go-live-domain.py`) | Zertifikat, Auth-URLs, app.env, Domain-Build — siehe unten. |

Das STRATO-SSL-Zertifikat wird nicht gebraucht: Traefik holt und erneuert Let's-Encrypt-Zertifikate
selbst (HTTP-01). STRATO kann es nur Domains bei STRATO zuweisen.

## Ablauf

```bash
# Vorher (Live-Seite unberührt): Domain-Build mit Domain-URLs bereitlegen
sudo python3 /var/www/sitov-academy/deploy/vps/go-live-domain.py prepare
sudo python3 /var/www/sitov-academy/deploy/vps/go-live-domain.py check

# Inhaber stellt bei IONOS @ und www auf 217.154.228.254 um. Sobald check "DNS zeigt auf den VPS" meldet:
sudo python3 /var/www/sitov-academy/deploy/vps/go-live-domain.py activate
```

`activate` prüft zuerst DNS (1.1.1.1 und 8.8.8.8, A und AAAA), Domain-Build und unveränderte app.env und
ändert sonst nichts. Dann in dieser Reihenfolge: Traefik-Route `traefik-domain.yaml` → Zertifikat für
`www` + Apex (Wartezeit bis 5 Min.) → Supabase-Auth-URLs (Allow-List behält die IP für bereits
verschickte Links) → app.env → Domain-Release (App + Mail-Worker, Health-Check mit Rücksprung).
Zwischen DNS-Umstellung und Zertifikat sehen Besucher kurz eine Zertifikatswarnung – daher nachts.

Nach Commits zwischen `prepare` und `activate` erneut `prepare` ausführen (`check` zeigt es an).

### Danach

- Search Console: Property `https://www.sitov-academy.com`, Sitemap `/sitemap.xml` einreichen.
- Registrierung, Bestätigungs-Mail, Login, Passwort-Reset einmal real durchspielen.
- Netlify-Deploy erst nach ein paar Tagen abschalten (Rückweg über DNS).

### Rollback

```bash
sudo python3 /var/www/sitov-academy/deploy/vps/go-live-domain.py rollback --backup /root/backups/sitov-domain-cutover/<stamp> --release <vorheriges-release>
```

`activate` gibt den genauen Befehl aus. Parallel die A-Records bei IONOS zurück auf `75.2.60.5`.

## Backups

`sitov-backup.timer` sichert täglich 03:30 Datenbank (`pg_dump -Fc`), Rollen und alle Storage-Dateien
mit SHA256 nach `/root/backups/daily/` und behält 14 Stände (`backup-daily.py`, dieselbe Routine wie
der Migrations-Runner). Einrichtung:

```bash
sudo install -m 644 /var/www/sitov-academy/deploy/vps/sitov-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now sitov-backup.timer
sudo systemctl start sitov-backup.service && journalctl -u sitov-backup -n 5
```

Kopie außerhalb des Servers: `scripts/pull-vps-backup.sh` auf dem Mac (prüft alle Prüfsummen).

Wiederherstellung (Beispiel Datenbank): `docker exec -i supabase-db-eknmzxvqilojjicinatnllbt pg_restore
-U supabase_admin -d postgres --clean --if-exists < postgres.dump` – vorher App und Mail stoppen und
einen frischen Stand sichern. Storage-Dateien liegen unter `objects/<id>`, Zuordnung in
`storage-manifest.json`.

## Mail

Behoben am 24.09.2026 (`patch-mail-routing.py`): Postfix hielt sich für das Ziel von
`@sitov-academy.com` und wies Mails an info@ ab; Auth-Mails gingen ohne DKIM raus. Reverse-DNS
(`217.154.228.254` ↔ `mail.sitov-academy.com`) ist korrekt gesetzt und bleibt so.
