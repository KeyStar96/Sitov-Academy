# Phase 0 – Prüfbericht: Ist und Soll

Stand: 25.09.2026. Ausgangsrevision: `e123fab0ba49177c3c15f06db10249d92eb688d9`, Zweig `codex/vps-self-hosted`. Der Arbeitsbaum war zu Beginn sauber. Ausschließlich Phase 0; keine Anwendungs-, Konfigurations- oder Datenbankänderungen.

## Wesentliche Abweichungen und betroffene Phasen

| Befund | Nachweis / Konsequenz | Folgephase |
|---|---|---|
| **Lösungen werden bei freigegebenen Grammatikaufgaben vor der Antwort zum Browser serialisiert.** | `correct_answer` und bei Lückentexten `accepted_answers` bleiben im `content` bis zur Client-Grenze. Bewertung selbst erfolgt serverseitig. Aktuell sind alle 604 Live-Aufgaben `incomplete`, daher werden sie Lernenden nicht ausgeliefert. Der Datenvertrag verletzt dennoch R5, sobald Aufgaben freigegeben werden. | 3 (R5), 1 beim Inhalts-/Bewertungsabgleich |
| **Mail-Worker inaktiv, obwohl aktiviert.** | `sitov-mail.service`: `inactive/dead`, Exit 0 seit 25.09.2026 12:36:29 UTC; App/NGINX/TTS aktiv, Health `ready`. Ursache ungeklärt; keinerlei Neustart oder Zustelltest in Phase 0. | 6 / 8, Betrieb |
| Funktionsquellen im Zwischenbericht teilweise überholt | `submit_self_rating` zuletzt 23; `check_retry` heißt `check_retry_answer` (22); `record_attempt` aus 06 wird in 07 um einen Bereitschafts-Guard ergänzt; Analytik-RPC mit zwei Parametern zuletzt 23. | 1 / 3 / 5 / 7 |
| Schema-Dump älter als Migrationen und Typen | Unter anderem Eigentümer eigener Wörter, Lerntage, Lektionspausen und neueste Mail-Arten fehlen in `schema.sql`. | Alle späteren DB-Phasen, R7 |
| Historische Rollbacks nicht durchgängig eigene Dateien | Vorhandene Rückweg-Dateien: 14, 16, 18–25, 27, 29. Keine Nachrüstung in dieser Dokumentationsphase. | Künftige DB-Phasen, R9 |
| Testhelfer bildet nur Stand bis 06 ab | Spätere Guards/Verträge müssen vom jeweiligen Test zusätzlich eingespielt werden. | 1 / 3 / 5–7 |
| Grammatikseed und Produktion unterscheiden sich | Seed: 600 Aufgaben, ohne `target_form`; live: 604 Aufgaben, alle `incomplete`, 60 aktive Units. Kein Blindimport des alten Seeds. | 3 / 4 |
| Mobiler Vokabel-Bildschirm breiter als Viewport | Vollseiten-PNG 415 px bei 390-px-Viewport; Überstand im Ist-Zustand erhalten, Ursache nicht verändert. | 2 / 8 |
| Neue Designvorgaben noch nicht erfüllt | Unter anderem 42/44-px-Modusknöpfe, 52-px-Hauptaktionen, 16-px-Schreibfeld, endlose Pulse; Modus-Dock, volle Handy-Brotkrumen und zentrale Bewegungstokens fehlen. | 2 / 8 |
| Quellenverweise brauchen Auflösung | Vollständige D1–D13 und Anhang B stehen im Stamm-Dokument; „Constraint aus 2.6“ meint `CODEX.md` (Master 3.0). Widersprüche innerhalb der D-Regeln sind in der Richtlinie offengelegt. | 0 geklärt; Auslegung in 2 / 3 |
| Screenshots verwenden synthetischen Datenbestand | Unverändertes lokales Frontend, künstliches Profil und Inhalte, keine echten Lernenden. Zahlen in Bildern sind **keine** Live-Katalogzahlen. Grammatik/Mediathek zeigen Leerzustände; Live-Zahlen stehen im VPS-Bericht. | Visueller Vergleich ab 2; volle Abnahme 8 |

**Bestätigte Voraussetzung für Phase 4:** A1.1 besitzt **7 aktive gemeinsame Vokabel-Lektionen mit 512 Karten**; die Wortfelder passen in Reihenfolge zu den sieben Zielpfaden. Es besteht kein Bedarf, aus einer falschen Lektionsanzahl eine künstliche Zuordnung abzuleiten. Vollständigkeit jedes Lernziels und Herkunft der Alttexte sind damit nicht bewiesen.

## Nachweise und Lesereihenfolge

- [STATUS.md](STATUS.md): Übergabe nach Anhang B, Checkliste und abschließende Baseline.
- [CODE-INVENTAR.md](CODE-INVENTAR.md): Matrix `Ort | Erwartet | Gefunden | Delta` über Dateien, Funktionen, Tabellen und Spalten aus Phase 0 und Zwischenbericht Abschnitt 3, einschließlich vollständiger Lösungs-Serialisierungskette.
- [VPS-BESTAND.md](VPS-BESTAND.md): lesend verifizierte Release-/Dienstzustände, Lektions-/Grammatikzahlen, Enum, Constraints und vollständige Spaltenlisten mit reproduzierbarer Katalogabfrage.
- [TEST-BASELINE.md](TEST-BASELINE.md): vollständige Testläufe, Befehle, Pass/Fail/Skip, Umgebungsprobleme und ihre Auflösung.
- [Designrichtlinie](../design/lernraum-designrichtlinie.md): D1–D13, Token-/Klassenorte, 20 gemessene Farbpaare, Bewegungsbeispiele und Quellenwidersprüche.
- [Ist-Bilder und Aufnahmekontext](ist/README.md): sechs Lernenden-Seiten je Desktop und Handy.

## Vorprüfung vor Erstellung der weiteren Dokumente (S2)

| Ort | Erwartet | Gefunden | Delta |
|---|---|---|---|
| `docs/master-4/prompts-split/00_CODEX-4-RULES.md` | Regeln und Designvorgaben | Vollständig gelesen, R1–R16 und S1–S7 | Keine Änderung am Prompt; Checkliste nur in STATUS |
| `docs/master-4/prompts-split/00_PHASE-0-GPT.md` | Dokumentation, Bestandsaufnahme und Baseline | Vollständig gelesen, vier Arbeitspakete | Keine Codeänderung oder Migration vorgesehen |
| `docs/master-4/STATUS.md` | Status nach Anhang B | Zu Beginn nicht vorhanden | Wird in Phase 0 angelegt |
| `MASTER-PROMPT-4.md`, Anhang B | Statusvorlage | Im Repo-Stamm vorhanden; im Split-Dokument nicht enthalten | Vorlage aus der vollständigen Quelle verwenden |
| `MASTER-PROMPT-4.md`, D1–D13 | Vollständige Designrichtlinie | Im Repo-Stamm vorhanden; Split-Regeln verkürzt | Vollständige Quelle ergänzend heranziehen |
| `docs/design/lernraum-designrichtlinie.md` | Richtlinie mit Tokens, Kontrasten und Beispielen | Datei und Verzeichnis zu Beginn nicht vorhanden | Nur Dokumentation erstellen |
| `docs/master-4/ist/` | Vorher-Bilder ohne echte Personendaten | Zu Beginn nicht vorhanden | Desktop und Handy dokumentieren; Quelle und Einschränkungen ausweisen |
| `docs/master-4/ZWISCHENBERICHT.md`, Abschnitt 3 | Ausgangsbefunde | Vorhanden; Abgleich mit Code und Live-Katalog läuft | Detailmatrix folgt in CODE-INVENTAR |
| VPS `/var/www/sitov-current` | Aktives Release bekannt | Symlink auf `/var/www/sitov-releases/5f12313ac51e` | Live-Release unterscheidet sich von lokaler Dokumentationsrevision |
| VPS `http://127.0.0.1:3000/api/health` | `ready` | `{"status":"ready"}` am 25.09.2026 | Health enthält keine Revision; Symlink separat geprüft |

## Prüfverfahren

Lokale Tests werden mit ihren vorhandenen Anforderungen vollständig ausgeführt. Produktive Datenbankabfragen erfolgen ausschließlich in einer expliziten READ-ONLY-Transaktion mit Zeitlimit. Es werden nur Katalogdaten und aggregierte Inhaltszahlen erhoben, keine Lernenden-, Profil- oder Mailinhalte. Deshalb ist kein Datenbankbackup oder Rollback erforderlich; R8/R9 werden bei späteren Änderungen wirksam.

Für diese Phase wurden keine Bewertung, Freischaltung, Übersetzung, CSS-Regel oder Testanforderung verändert. Vorhandene fachliche und gestalterische Abweichungen sind Ausgangsbefunde für spätere Phasen, keine in Phase 0 stillschweigend behobenen Fehler. Die vorhandenen Prompt-Dateien bleiben unverändert.
