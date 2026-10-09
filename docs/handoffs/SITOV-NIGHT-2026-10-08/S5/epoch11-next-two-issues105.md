# S5 epoch11: lesende Diagnose der Next-Issues-Anzeige

Ziel und sauberer Ausgangsstand: `c55ae93d60770db9fa639f62d02a10dee3b47db6`, Branch `codex/sitov-night-s5-issues105`. Unveränderte Vierminutenlease 2026-10-09 02:19:12–02:23:12 UTC. Ausschließlich eigene QA-Nachweise und Handoff.

## Aktueller tatsächlicher Browsernachweis

Der bisherige eigene QA-Tab4 war nicht mehr Teil der Sitzung; dokumentierte Browser1-Inventur leer. Nach ausdrücklicher M-Freigabe innerhalb derselben Lease wurde ein frischer eigener Tab5 auf `http://127.0.0.1:3143/ru/login` geöffnet. Die russische Loginoberfläche war abgemeldet; kein Login und kein neues Konto.

Das sichtbare Next-Entwicklermenü wurde über die normale Oberfläche geöffnet. Beobachtete Einträge: Route Dynamic, Bundler Webpack, Route Info, Preferences. Keine sichtbare Issues-Badge und kein Issues-Menüeintrag. Screenshot: `e2e/sitov-night-real-transport/epoch11-login-next-menu.png`. Tab5 ist für einen späteren Handoff erhalten.

Die beiden früher auf der authentifizierten Route sichtbaren Issues bleiben **UNGETESTET**: genaue Meldungen, Schwere, Komponentenstacks sowie aktuelle Fatal-/Console-/Hydrationklassifikation sind nicht identifiziert. Fehlende Issues auf der frischen Loginroute belegen keine Behebung auf der früheren Route. Keine Auth-/Source-/Runtimeänderung zur Reproduktion.

## Bereinigter historischer Logvergleich

Nur Warnungs-/Komponentenzeilen aus `master/qa-next-private.log` ausgewertet; kein vollständiger privater Log ausgeliefert. Ein eindeutiger Warnungstext ist neunmal in historischen Zeilen 140–221 enthalten:

> Should not import the named export 'exercises'.'soft_error' (imported as 'exercises') from default-exporting module (only default export is available soon)

Warnungskomponente: `components/exercises/SoftErrorBadge.tsx`. Beobachteter Importtrace: `components/learning-path/LearningPathClient.tsx`. `⚠` markiert die Warnung zur künftigen Importkompatibilität eines benannten Exports aus einem Modul mit Default-Export. Dieser Auszug belegt keinen fatalen Absturz. Die genaue JSON-Modulidentität ist durch den bereinigten Meldungsauszug nicht eigenständig bestätigt. Wiederholungszahl und Server-/Browserpräfixe belegen keine zwei unterschiedlichen aktuellen UI-Issues.

## Unverändert und Handoff

Keine Produktquelle, Runtime, QA-Konten, Daten, Assets oder Container geändert; keine neuen Tests/Buildläufe. Keine Cookies, versteckten Browserzustände oder Netzwerktoken gelesen. M-Baseline 2 Konten/8 Definitionen/5 aktiv/746 Proofs/819 Assets/1 Special/keine Durchgänge ist M-gemeldet und wurde in dieser lesenden Einheit nicht erneut gegen die Datenbank geprüft.

Sanitierte Diagnose: `e2e/sitov-night-real-transport/epoch11-next-issues-evidence.json`. JSON-Invarianten und Git-Diffcheck geprüft. Status **PARTIAL / WAIT**. Für die beiden ursprünglichen Issues ist eine neue ausdrücklich begrenzte Reproduktions-/Browserlease nötig. Keine Release-Freigabe.
