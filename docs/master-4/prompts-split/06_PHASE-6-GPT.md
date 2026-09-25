> **Lies `00_CODEX-4-RULES.md` und diese Datei. Führe ausschließlich Phase 6 aus.**

## PHASE 6 — BENACHRICHTIGUNGEN UND „NEU“

**Ziel:** Lernende sehen sofort, was neu ist, und bekommen Mails nur, wenn sie es wollen.

#### 6.1 Das „Neu“-System
Befund: Nur Medien kennen `fresh` (erstellt in den letzten N Tagen, `lib/learning-status-server.ts`). Pro Person wird nicht gespeichert, was sie schon gesehen hat.

Regeln:
* Eine Tabelle für **Gesehen-Quittungen**: Person, Art (Enum), Objekt, Zeitpunkt.
* Arten: Niveau, Vokabel-Lektion, Pfad, Spezial-Zweig, Aussprache-Text, Medienordner, Video, Präsentation, Trainer (Modus).
* **Neu** ist ein Objekt für eine Person, wenn es für sie sichtbar ist, sie es noch nicht geöffnet hat und es **nach ihrem ersten Besuch dieses Niveaus** veröffentlicht oder freigeschaltet wurde. Ein Niveau oder Modus ist neu, wenn er **nach dem ersten Besuch der Person im Lernraum** freigeschaltet wurde und noch nicht geöffnet ist. Was schon beim ersten Besuch freigeschaltet war (zum Beispiel alle im Voraus gebuchten Niveaus), ist nicht neu. So zeigt ein frisches Konto nicht alles als neu.
* Bei der Migration gelten alle Bestandsobjekte für alle bestehenden Personen als gesehen.
* **Gesehen** wird gesetzt, wenn die Person das Objekt öffnet (Seite, Knoten, Video, Ordner), nicht beim bloßen Anzeigen der Liste.
* Anzeige nach D10: Badge an Kachel, Karte und Modus-Tab; Punkt am Tab „Lernen“ der unteren Leiste, wenn in irgendeinem freigeschalteten Niveau etwas neu ist; Badge an der Niveaukarte auf Home.

Aufgaben:
* [ ] Migration mit Tabelle, RLS, RPCs (Quittung setzen; Neu-Zähler je Niveau und Modus in **einem** Aufruf, damit Home nicht langsamer wird).
* [ ] Oberfläche an allen genannten Stellen. Das vorhandene `fresh` der Medien geht in diesem System auf.
* [ ] DB-Tests: neues Objekt nach dem ersten Besuch ist neu; nach dem Öffnen nicht mehr; Bestand nach der Migration nicht neu; frisches Konto sieht keinen Altbestand als neu; gesperrte Inhalte sind nie neu.
* [ ] Leistung: Home-Antwortzeit im Bericht, vorher und nachher.

#### 6.2 Mail bei Antwort der Lehrkraft in der Aussprache: Schalter im Profil
Befund: Die Mail **existiert bereits**. `app/actions/pronunciation-conversations.ts` (um Zeile 39) ruft `notifyPronunciationFeedback` → `queueTransactionalEmail` mit Typ `feedback_available` auf, eine Mail pro Nachricht, Dedupe-Schlüssel `pronunciation-message:<id>`. Vorlagen in `lib/mail/templates.mjs` (fünf Sprachen). Es fehlt der Schalter, und die Zustellung ist nicht Ende-zu-Ende nachgewiesen.
* [ ] Spalte `profiles.notify_pronunciation_feedback boolean NOT NULL DEFAULT true`.
* [ ] Die Einstellung wird dort geprüft, wo die Mail in die Warteschlange geht, **in der Datenbank**, damit kein Weg sie umgeht.
* [ ] Neuer Abschnitt „Benachrichtigungen“ in `components/dashboard/ProfileSettings.tsx`: Schalter „E-Mail, wenn meine Lehrkraft in der Aussprache antwortet“, sofort gespeichert, mit Bestätigung. Größe und Kontrast nach R13.
* [ ] **Bündeln:** Antwortet die Lehrkraft innerhalb von 10 Minuten mehrfach im selben Gespräch, geht eine Mail, die alle neuen Antworten nennt. Umsetzung ohne neuen Dienst (R2), im vorhandenen Mail-Worker oder über die Warteschlange.
* [ ] Die Mail führt mit einem Link direkt in das Gespräch.
* [ ] Tests: Schalter aus → keine Zeile in `private.mail_outbox`; an → genau eine Zeile; drei Antworten in 10 Minuten → eine Mail; Vorlage in fünf Sprachen.
* [ ] **Nachweis in Produktion:** Testkonto, Antwort der Lehrkraft, Zeile in `private.mail_outbox` mit Status `sent`, Eingang im Postfach des Testkontos. Im Bericht nur Zeitstempel und Status, keine Adressen. Danach Testdaten entfernen.

#### 6.3 Niveau abgeschlossen: keine Benachrichtigung der Lehrkraft
Nutzerentscheidung vom 25.09.2026: Die Lehrkraft schaltet gebuchte Niveaus im Voraus frei und will beim Abschluss eines Niveaus **nicht** benachrichtigt werden.
* [ ] Es gibt weder Staff-Mail noch Dashboard-Hinweis noch Zähler zum Niveau-Abschluss.
* [ ] DB-Test: Nach dem Bestehen des letzten Tests eines Niveaus entsteht keine neue Zeile in `private.mail_outbox`.

#### 6.4 Freischalt-Mail: mehrere Niveaus in einer Mail
Befund: Migration 29 legt mit einem Zeilen-Trigger (`on_student_level_access_granted_notify`, `FOR EACH ROW`) für **jedes** neu freigeschaltete Niveau eine eigene Mail vom Typ `level_access_granted` an (Dedupe-Schlüssel `level-access:<user id>:<level>`). `set_student_level_access` schreibt alle gewählten Niveaus in **einer** `INSERT`-Anweisung. Schaltet die Lehrkraft sechs Niveaus auf einmal frei, bekommt die Person heute sechs Mails. Nutzerentscheidung vom 25.09.2026: Das wird eine Mail.
* [ ] Neue Migration: Der Trigger arbeitet pro Anweisung (`FOR EACH STATEMENT` mit `REFERENCING NEW TABLE`) und legt je Person **eine** Mail an, die alle in diesem Speichervorgang neu freigeschalteten Niveaus in Kursreihenfolge (`learning_levels.sort_order`) nennt.
* [ ] Die bisherigen Zusagen aus Migration 29 bleiben: Ein Niveau, das schon einmal angekündigt wurde, wird nie wieder angekündigt, auch nicht nach Entziehen und erneutem Freischalten. Bestehende Freigaben lösen keine Mail aus. Scheitert das Einreihen, bleibt die Freischaltung bestehen (nur `WARNING`).
* [ ] Vorlage `levelAccess` in `lib/mail/templates.mjs` für ein und für mehrere Niveaus, in fünf Sprachen. Der Text nennt statt „Übungen“ die heutigen Bereiche: Vokabeln, Lernpfad, Aussprache und Mediathek. Der Knopf führt zum ersten neu freigeschalteten Niveau.
* [ ] Payload mit einer Liste `levels` statt eines einzelnen `level`. Der Mail-Worker kann Mails, die noch im alten Format in der Warteschlange liegen, weiter darstellen.
* [ ] Tests (Muster: `supabase/tests/level-access-notification.test.mjs`): sechs Niveaus auf einmal → genau eine Zeile in `private.mail_outbox` mit allen sechs; ein Niveau → eine Mail mit einem Niveau; Entziehen und erneutes Freischalten → keine Mail; später ein weiteres Niveau → eine Mail nur mit diesem; zwei Personen in einem Vorgang → je eine eigene Mail.

**Abnahme Phase 6:** Alle Tests grün, Produktionsnachweis der Aussprache-Mail im Bericht, Home-Antwortzeit nicht schlechter als 10 % gegenüber Phase 0.

**Übergabe:** Arten der Gesehen-Quittungen und die RPC-Namen in `STATUS.md`.

---