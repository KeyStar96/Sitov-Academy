# S5 epoch12: echte lesende Browserabnahme der Special-Lehrkraftroute

Verifizierter sauberer Ausgangsstand: `71972fc3ad62baac4956506cfe31138a21b665f3`, Branch `codex/sitov-night-s5-staff-route-browser`. QA-Next `http://127.0.0.1:3143`; siebenminütige Lease, Ende 2026-10-09 06:28:58 Europe/Berlin. M meldete frischen Runtime-/Buildstand; S5 führt keinen Build aus.

## Befund

**PASS**: echtes Formularlogin der ausdrücklich freigegebenen bestehenden synthetischen QA-Lehrkraft; Menülink zur Special-Route; Index und tatsächliche Zielauswahl. Russisches Staff-Fenster zeigt „Artikel im Nominativ · Meine Wohnung“, Version1 veröffentlicht, 20 Aufgaben, keine Durchgänge, deaktivierte Veröffentlichungsschaltfläche. Auswahlhilfe geöffnet und per Enter geschlossen; Publikationshilfe geöffnet. Sichtbarer deutscher Titel gezielt `lang="de" translate="no"`, russischer äußerer Rahmen; türkischer Titel ebenfalls geschützt bei äußerem `lang="tr"`.

**PASS mit begrenztem Umfang**: Menülabel, Index und echte UI-Sprachwechsel RU→DE→EN→UK→TR erhalten `/teacher/content/learning-path/specials`. Labels stimmen mit dem eingefrorenen Vertrag überein. Die ausgewählte Zielkarte wird beim Sprachwechsel zurückgesetzt; Pfad bleibt erhalten. Auswahlhilfe zusätzlich auf Englisch beobachtet. Vollständige Staff-/Publikations-/Hilfematrix in allen fünf Sprachen ist UNGETESTET.

**FAIL: Console-Fehler beim echten RU→DE-Sprachwechsel.** Der sichtbare Next-Dialog zeigt genau einen `Console Error`:

> Encountered a script tag while rendering React component. Scripts inside React components are never executed when rendering on the client. Consider using template tag instead.

Komponentenstack: `RootLayout`, `app/[lang]/layout.tsx:131:9`. Markierte Zeile: Script mit `THEME_BOOTSTRAP_SCRIPT`; folgende Quellzeile enthält `CONSENT_BOOTSTRAP_SCRIPT`. Dies ist der aktuelle echte Dialognachweis, keine historische SoftErrorBadge-Importhypothese. Die Route blieb benutzbar; weitere Sprachwechsel und Abmeldung funktionieren. Auswirkungen auf Theme-/Consent-Bootstrap wurden nicht geprüft. Keine Behebung unter dieser lesenden Lease.

**PASS**: echte Viewports 1440×1000 (RU-Staff/Publikationshilfe), 390×844 (EN-Auswahlhilfe), 320×760 (EN-Mobilmenü). Dokumentbreite entspricht jeweils der Viewportbreite; kein horizontaler Überlauf in diesen Ansichten. Mobile Menü-/Sprachaktion funktioniert. Temporäre Viewportsteuerung zurückgesetzt. Dies ist kein vollständiger Stafftest bei jeder Größe.

**PASS**: normale türkische UI-Abmeldung führt zu `/tr/login?status=logout_success`. Anschließender tatsächlicher Aufruf des vorher beobachteten geschützten Staffwegs führt zu `/tr/login`; kein Staffinhalt sichtbar.

## Grenzen und Daten

UNGETESTET: Reduced Motion/verborgenes Fenster, umfassende Tastatur-/Screenreaderabnahme, 48-Pixel-Ziele, vollständige Sprach-/Staff-/Viewportkombinationen, Schreib-/Review-/Create-/Save-/Publishaktionen, Datenbank-/Storagezählung. Keine dieser Mutationsschaltflächen ausgelöst, keine neuen Konten, Rollen-/MFAänderung, Cookie-/JWT-Injektion, versteckte Browserdaten, Produktcode/SQL/Audio/Runtimeänderung oder Transportersatzprobe. Private Loginwerte ausschließlich für das echte Formular verwendet und in keinem Artefakt gespeichert.

M-Baseline 2Konten/9Definitionen/5aktiv/840Proofs/819Assets/1Special/0States ist M-gemeldet und wurde in dieser Browserlease nicht erneut gegen die Datenbank geprüft. Anmeldung/Abmeldung verändert naturgemäß die Authsitzung; fachliche Schreibaktionen wurden nicht ausgeführt.

## Nachweise und Handoff

Sanitierte Evidenz: `e2e/sitov-night-real-transport/epoch12-staff-route-browser-evidence.json`. Screenshots in `epoch12-staff-route-screenshots/`: `ru-publication-1440.png`, `en-selection-help-390.png`, `en-mobile-menu-320.png`, `language-switch-console-error.png`, `logged-out-protected-redirect.png`.

JSON-/Viewport-/Logoutinvarianten, private Credential-/Actor-ID-Abwesenheit und Git-Diffcheck geprüft. Status **WAIT mit einem konkreten Console-Befund**. Keine umfassende RELEASE_READY-Aussage; spätere Live-Prüfung bestehender kommerzieller Rechte bleibt Deploymentgate.
