# Phase 8 — Prüfbericht vor Änderungen

Stand: 26.09.2026. Auftrag: Abnahme und Auslieferung; Phase 6 bleibt ausdrücklich übersprungen.

## Ist und Soll

| Gegenstand | Ist, frisch geprüft | Soll / nächster Schritt |
| --- | --- | --- |
| Releasequelle | Lokaler sauberer Branch und origin `codex/vps-self-hosted` auf `8a65c77e15da91816c47b4acdbab553523568929` | Geprüfte Revision mit vorbereitetem Artefakt aktivieren |
| Live-Release | `/var/www/sitov-releases/e6a8d32f4ce7`, Health `ready` | Erst nach kompatibler DB und geprüftem Import umschalten |
| VPS-Quellcheckout | Sauber, gleicher Branch, `3271a12b4d1c02b347e68f3c903463a679cb5e1f` | Vorbereitungsablauf aktualisiert per Fast-forward |
| Migrationen | Dokumentiert produktiv bis 31; lokal bis 39 | 32–39 geordnet prüfen und anwenden; 38/39 sind Voraussetzung für Phase 7 |
| PostgreSQL | Live 15.8, DB etwa 156 MiB; frühere lokale Abnahme 17.11 | Vollständigen kumulativen Weg auf 15.8 vor Produktion prüfen |
| Ressourcen | 7884 MiB RAM, etwa 2849 MiB verfügbar, kein Swap; 148 GiB Platte frei | Keine Limits erhöhen, keine zusätzlichen dauerhaften Dienste |
| Dienste | App, nginx, TTS aktiv; Mail inaktiv, Exit 0 seit 25.09.2026 | Mail-Betriebsursache klären; Abschluss verlangt aktiven Worker |
| Seed | Bestehender atomarer CLI mit Backup-Prüfung | 7 Pfade / 85 Knoten / 769 Aufgaben / 87 Lernziele, IDs und Inhalt verifizieren |
| Browsermatrix | Phasenspezifische Tests; Standardkonfiguration startet Entwicklungsserver und nur Chromium | Abnahme am Produktionsbuild; Desktop, Pixel 7, iPhone 14, nichtdeutsche Testperson |
| Leistung | Phase-7-p95 lokal 293,625 ms; kein Lighthouse-Wert aus Phase 0 dokumentiert | Neue Messwerte samt Messbedingungen; keinen Vorher-Vergleich erfinden |
| Phase 6 | Auf Nutzerwunsch übersprungen | Zugehörige neue Benachrichtigungen, „Neu“ und Hilfe dafür N/A; bestehender Mailbetrieb bleibt Auslieferungsthema |

## Geprüfter Auslieferungsablauf

1. Kumulativer PostgreSQL-15.8-Klon: Backup, 32–39, Wiederholung, Seed und Rückweg prüfen.
2. Regressionen und Browser-Abnahme; Hilfe in fünf Sprachen und Leistungsnachweise vervollständigen.
3. `deploy-release.sh --prepare-only`: Build und Prüfsummen, noch kein Releasewechsel.
4. `migrate-local.py --apply … --keep-stopped`: Backup und Migrationen bei gestoppter App/Mail.
5. Separates frisches `--backup-only`, dann Seed-CLI mit explizitem Loopback-Endpunkt und privatem Service-Key.
6. Zahlen, IDs und Inhalte prüfen; `--activate <revision> --schema-changed`; Health und Dienste kontrollieren.
7. Produktionsrauchtest mit Testkonto und anschließender Bereinigung; Schema und Typen aus Produktion exportieren.

Bei unklarem Commit-Status bleiben App und Mail gestoppt. Kein automatischer Wechsel auf das alte UI nach Schemaänderungen. Rückwege einzeln in umgekehrter Reihenfolge; neue Lern-/Auditdaten archivieren. Exakte Wiederherstellung nur mit geprüftem Vollbackup und passendem Release. Private Backups, Tokens und personenbezogene Exporte bleiben außerhalb Git.

Dies ist der initiale Prüfbericht, keine abgeschlossene Abnahme und kein Deployment-Nachweis.

## Befunde während der Abnahme

- Erstes Vollbackup ungültig: ein Video-Download brach bei 46.501.262 statt 86.904.021 Bytes ab. Keine DB-Änderung, kein COMPLETE-Marker. Kontrollabruf vollständig; zweites Vollbackup mit 563 Objekten gültig. Keine Größenprüfung abgeschaltet und keine Storage-Metadaten verändert.
- PostgreSQL-15.8-Klon: pauschales Postgres-Funktionsgrant in 34 erfasste beim zweiten kumulativen Lauf auch später erstellte Hilfsfunktionen. Grant auf die neun Funktionen von 34 begrenzt. Danach kompletter Lauf 32–39 zweimal, Rückwege 39–32, erneuter Lauf und drei Seed-Importe erfolgreich. ACL-Anweisungen werden für den Vergleich innerhalb ihres Blocks sortiert; keine Berechtigung wird ausgelassen. Alle sieben Exporte stimmen vollständig mit dem JSON-Seed überein.
- Phase-8-Abnahmelücke: `/exercises` leitete noch nicht nach `/path`. Kanonische Route, zentrale Navigation, alter Alias und Cache-Invalidierung ergänzt; bisheriger Alttrainer bleibt als Kompatibilitätsfallback erreichbar.
- Hilfe für Lernpfad und Wortmitnahme auf Home und im mobilen Hilfeblatt in fünf Sprachen ergänzt. Bestehende Kontaktwege unverändert.
- Ungefiltertes Axe fand eine fehlende H1 in der Staff-Ausspracheansicht und unpassende Aside-Landmarks in Medien-/Aussprache-CMS. Semantische Überschrift bzw. normale Inhaltscontainer korrigiert.
- Testharness unterstützte HEAD nicht; dadurch scheiterte die Admin-Statistikzählung. HEAD wird jetzt an echtes PostgREST weitergeleitet. Die Matrix verwirft zusätzlich sichtbare Fehleransichten mit Wiederholen-Schaltfläche.
- Erster breiter Browserlauf wegen dieser Befunde abgebrochen; nicht als grüner Nachweis gewertet. Trace-Aufzeichnung verursachte lange Abschlusswartezeiten; finale Matrix nutzt Fehler-Screenshots und vollständige JSON-/Axe-Ergebnisse ohne Trace-Aufzeichnung, weiterhin alle Assertions und Regeln.
