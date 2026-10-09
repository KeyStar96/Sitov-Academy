# S5 epoch10: Special UI und vollständiger Lernstapel (Overlay105)

QA-Ziel: `f4b0629ed68da1ba08f8023dad3915d02a555985`. Eigener Ausgangsstand `9ad29c5012f4a682ddcb6796f6b476cca69e123e`; `git diff --quiet` bestätigte identische Bäume. Branch `codex/sitov-night-s5-special105`. Kein Produktcode geändert.

## Tatsächlicher Browsernachweis

Mit expliziter M-Freigabe wurde das bestehende disposable QA-Lehrerkonto über die normale Oberfläche abgemeldet. Anschließend meldete sich genau ein neues eigenes QA-Schülerkonto über das echte Loginformular an. Keine Browsercookies gelesen oder injiziert.

Im russischen Interface wurden Special-Karte und Lernen gestartet, Hilfe geöffnet und mit Enter geschlossen, Lösung angezeigt, „später wiederholen“ ausgelöst (Karte rotiert, 20 verbleiben) und „richtig“ mit Enter ausgelöst (19 verbleiben). Nach tatsächlichem Reload, erneutem Öffnen und Lernen blieb derselbe offene Durchgang mit 19 Karten erhalten. Äußerer Rahmen `lang="ru"`; beobachtete deutsche Prüfungsinhalte gezielt `lang="de" translate="no"`.

Tatsächliche Viewports und Screenshotnachweise: 390×844 mit Hilfe, 320×760 mit Lösung, 1440×1000 im Lernen. Gemessene Dokumentbreite entsprach jeweils der Viewportbreite, ohne horizontalen Überlauf. Viewportoverride vor Abschluss zurückgesetzt. Eigene normale Abmeldung ist durch `/ru/login?status=logout_success` und sichtbare russische Erfolgsmeldung bestätigt.

Ein vorübergehender CUA-Navigationsfehler wurde mit einem frischen Tab behoben. Zeitgleiche direkte HTTP-Proben lieferten Next3143=200 und QA19483=200. Keine bestätigte dauerhafte Serverstörung und kein Neustart durch S5.

## Tatsächliche HTTP/RPC-Abschlüsse

Erster Lernstapel: alle 20 Karten per echter HTTP/RPC entfernt. Zweiter Lernstapel: eine richtige Karte im Browser, anschließend verbleibende 19 per echter HTTP/RPC entfernt. Je Durchgang 3/3 Checks PASS: vollständig abgeschlossen mit 20 ausgewählten Karten; exakter gespeicherter Run per `get` identisch; Hauptpfadfortschritt einschließlich Sterne, Aktivität, Übungs-/Testzählung und Streakfingerprint unverändert.

Vollständiger Stapelabschluss ist RPC-Nachweis; vollständiger Abschluss oder bewertete Testabgabe im Browser wird nicht behauptet. Level-Freigabe und Ankerabschluss mit zwei Sternen/75 Prozent sind ausdrücklich synthetische QA-Voraussetzungen und kein Nachweis einer echten Hauptpfadlektion.

## Bereinigung und Grenzen

Nach bestätigter eigener UI-Abmeldung wurden ausschließlich eigene Receipts, Runs und Fortschritt per exakt neu erzeugter Actor-ID entfernt und genau dieses eigene QA-Konto über GoTrue gelöscht. Keine Uploads. Vorher/nachher identisch: 2 M-Authkonten, 6 Vortestdefinitionen (5 aktiv), 558 Audio-Proofs, 1 aktiver Special, 567 Storageassets, 0 Vortestversuche und 0 Vortestbestehen. M-Konten und gemeinsame Definitionen/Assets erhalten.

Lease endete 02:02:38Z; Abschluss der bereits gestarteten RPC-Arbeit, Abmeldebestätigung, Bereinigung und Sicherung erfolgten anschließend unter M-SAVE_ONLY. Keine neue Prüfeinheit nach Leaseende.

Offen: übrige vier Interfacesprachen, Themes/hoher Kontrast/200 Prozent Zoom, Reduced Motion und verborgenes Fenster, Axe/Screenreader, vollständiger bewerteter Browsertest, vollständiger Plattformbuild und allgemeine Regression. Kein umfassendes RELEASE_READY. Der spätere Live-Vorher/Nachher-Vergleich bestehender kommerzieller Rechte bleibt verpflichtendes Deploymentgate.

## Artefakte

- `e2e/sitov-night-real-transport/special-browser-fixture.py`: ausschließlich eigene QA-Fixture, Modi prepare/finish/cleanup; private Credentials nur in externem privaten Driver.
- `epoch10-prepare-evidence.json`, `epoch10-first-finish-evidence.json`, `epoch10-finish-evidence.json`, `epoch10-cleanup-evidence.json`: sanitierte echte Transportnachweise.
- `epoch10-browser-evidence.json`, `epoch10-next-runtime-gap-evidence.json`: sanitierte UI-/Verbindungsnachweise.
- `epoch10-special-help-390.jpg`, `epoch10-special-solution-320.jpg`, `epoch10-special-learning-1440.jpg`: tatsächliche Screenshots.

Sicherung geprüft mit Python-AST, JSON-Abschluss-/Cleanupinvarianten, Credential/JWT-Abwesenheitsprüfung und Git-Diffcheck. Status: WAIT auf M.
