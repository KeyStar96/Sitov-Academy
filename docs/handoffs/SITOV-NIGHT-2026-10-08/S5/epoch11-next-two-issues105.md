# S5 epoch11: lesende Diagnose der Next-Issues-Anzeige

Ziel und sauberer Ausgangsstand: `c55ae93d60770db9fa639f62d02a10dee3b47db6`, Branch `codex/sitov-night-s5-issues105`. Vierminutenlease 2026-10-09 02:19:12–02:23:12 UTC. Nur eigene QA-Nachweise und Handoff.

## Ergebnis und sichtbarer Browsernachweis

Die beiden konkreten Next-UI-Issues sind **UNGETESTET**. Der dokumentierte Zugriff auf den bisherigen eigenen QA-Tab4 meldete, dass dieser nicht mehr Teil der Sitzung ist. Anschließend lieferte die dokumentierte Tabinventur für Browser1 eine leere Liste. Die Lease erlaubte ausschließlich den bestehenden Tab; deshalb wurde kein neuer Tab geöffnet. Kein neuer Login und kein neues Konto. Es wurde kein Screenshot erzeugt; ein älterer Screenshot wird nicht als aktueller Dialognachweis verwendet.

Genaue beiden UI-Meldungen, Schwere und sichtbare Komponentenstacks sowie die Einordnung aktueller fataler/Console-/Hydrationfehler bleiben unbekannt. Historische Logzeilen dürfen diese fehlende Beobachtung nicht ersetzen.

## Bereinigter Logvergleich

Ausschließlich Warnungs-/Komponentenzeilen aus `master/qa-next-private.log` ausgewertet; der vollständige private Log wird nicht ausgeliefert. Ein eindeutiger Warnungstext ist neunmal in historischen Zeilen 140–221 enthalten:

> Should not import the named export 'exercises'.'soft_error' (imported as 'exercises') from default-exporting module (only default export is available soon)

Warnungskomponente: `components/exercises/SoftErrorBadge.tsx`. Beobachteter Importtrace: `components/learning-path/LearningPathClient.tsx`. Die Warnung ist mit `⚠` markiert und betrifft künftige Importkompatibilität eines benannten Exports aus einem Modul mit Default-Export. Dieser Auszug belegt keinen fatalen Absturz. Die genaue JSON-Modulidentität ist durch den bereinigten Meldungsauszug nicht eigenständig bestätigt. Weder die Wiederholungszahl noch Server-/Browserpräfixe belegen zwei unterschiedliche aktuelle UI-Issues.

## Unverändert und Handoff

Keine Produktquelle, Runtime, QA-Konten, Daten, Assets oder Container geändert; keine neuen Tests oder Buildläufe. Keine Cookies, versteckten Browserzustände oder Netzwerktoken gelesen. Der M-gemeldete Baselinebestand 2 Konten/8 Definitionen/5 aktiv/746 Proofs/819 Assets/1 Special/keine Durchgänge wurde in dieser rein lesenden Einheit nicht erneut gegen die Datenbank geprüft.

Sanitierte Diagnose: `e2e/sitov-night-real-transport/epoch11-next-issues-evidence.json`. JSON-Invarianten, JWT-/Credential-Abwesenheit und Git-Diffcheck geprüft. Status **PARTIAL / WAIT**. Für die exakte Dialogdiagnose ist ein vorhandener erreichbarer eigener QA-Tab oder eine neue ausdrücklich zugewiesene Browseröffnung nötig. Keine Release-Freigabe.
