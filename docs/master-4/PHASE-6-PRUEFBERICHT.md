# Phase 6 — Prüfbericht: Benachrichtigungen und „Neu"

Stand: 29.09.2026. Ausgangsrevision `e8ada40` auf `codex/vps-self-hosted`, produktives Release `0bcdcd57e38d`, Migration 40. Ausführung nach `06_PHASE-6-GPT.md` und `00_CODEX-4-RULES.md`. Phase 6 war im ersten Durchlauf übersprungen worden (STATUS-Abschnitt „Phase 6"); sie wurde jetzt ausdrücklich beauftragt.

## Ist / Soll vor den Änderungen

| Ort | Erwartet (Prompt) | Gefunden | Delta |
|---|---|---|---|
| Neu-Kennzeichen | Quittungen pro Person | Nur Medien kannten `fresh` (14 Tage seit Erstellung, für alle gleich, `lib/learning-status-server.ts`, `VideoLibrary.tsx`) | Neu bauen; `fresh` geht im neuen System auf |
| `NewBadge`, `ModeDock.fresh`, `media_new` | Anzeige nach D10 | Bausteine vorhanden, nie befüllt („entscheidet Phase 6") | Befüllen |
| Zeitstempel | „nach dem ersten Besuch veröffentlicht/freigeschaltet" | `student_level_access`, `learning_trainer_grants`, `learning_units` ohne Zeitstempel | Spalten ergänzen (Migration 42) |
| Aussprache-Mail | Schalter, in der DB geprüft, Bündelung, Link ins Gespräch | Mail entstand in der App (`notifyPronunciationFeedback` → `queueTransactionalEmail`), eine Mail je Nachricht, kein Schalter, Link nur auf die Seite | Trigger in der DB (Migration 41), App-Weg entfernt |
| `profiles.notify_pronunciation_feedback` | vorhanden | fehlte | Migration 41 |
| Niveau-Abschluss | keine Benachrichtigung | Kein Staff-Mail-, Dashboard- oder Zählerweg im Code; geprüft an allen Triggern auf `path_test_attempts`/`path_node_progress` | Nur Test ergänzen |
| Freischalt-Mail | eine Mail je Speichervorgang | Zeilen-Trigger (Migration 29/40): sechs Niveaus = sechs Mails | Anweisungs-Trigger (Migration 41) |
| Vorlage `levelAccess` | Bereiche Vokabeln, Lernpfad, Aussprache, Mediathek; Liste `levels` | Text nannte „Übungen, Vokabeln und Medien"; nur ein `level` | Vorlage für ein/mehrere Niveaus, fünf Sprachen |
| Mail-Worker | alte Queue-Mails weiter darstellbar | Worker ruft nur `renderTransactionalEmail` auf | Vorlage akzeptiert `level` und `levels` |
| `sitov-mail.service` | läuft | In Phase 0 inaktiv gemeldet; am 29.09.2026 `active`, Outbox: 76 Mails `sent` | erledigt, siehe „Betrieb Phase 6" in `STATUS.md` |

## Entscheidungen

* **Neu** = sichtbar (dieselben Zugriffsregeln wie beim Lesen: `allowed_unit_ids()`, `folder_allowed()`, `published_video_unit_ids()`, `path_private.unit_available/node_available`), nicht geöffnet, angelegt **nach der Grundlinie** der Person. Grundlinie „Raum" beim ersten Aufruf, Grundlinie je Niveau beim ersten Besuch des Niveaus. Bei der Migration erhalten alle bestehenden Personen und ihre Niveaus die Grundlinie „jetzt".
* Niveau: neu, wenn `granted_at` nach der Raum-Grundlinie liegt und es nicht geöffnet ist. Modus: neu, wenn ein ausgeschalteter Trainer nach der Raum-Grundlinie wieder eingeschaltet wurde (`enabled_at`); nie zusammen mit einem neuen, ungeöffneten Niveau.
* Ein neuer Ordner (Medien) bzw. neuer Pfad deckt seine Dateien/Zweige ab: sie zählen erst, wenn er geöffnet ist. Ein Ordner gilt als geöffnet, sobald etwas darin geöffnet wurde (die Oberfläche kennt kein eigenes Öffnen eines Ordners).
* Quittungen entstehen nur für Objekte, die gerade neu sind: die Tabelle wächst nicht mit jedem Klick.
* Aussprache-Mail: Die erste Antwort legt die Mail mit `available_at = now() + 10 min` an; weitere Antworten im selben Gespräch werden an die noch nicht abgeholte Mail angehängt (max. 10, sonst neue Mail). Kein neuer Dienst: Der vorhandene Worker holt nur fällige Zeilen. Wird der Schalter ausgeschaltet, verfallen noch wartende Aussprache-Mails.
* Empfänger wie in Migration 40: nur die bestätigte Login-Adresse.

## Bewusste Grenzen

* Die spätere Einblendung einer Lektion über die Lektionsauswahl der Lehrkraft und das Aktivieren einer zuvor inaktiven Lektion haben keinen Zeitstempel; „neu" folgt dem Anlegen.
* Wird ein Niveau entzogen und erneut freigeschaltet, ist es nur neu, wenn es zuvor nicht geöffnet wurde.
* `lib/mail.ts` (`queueTransactionalEmail`) wird von der App nicht mehr aufgerufen; nicht entfernt, weil es kein Nachweis für „unerreichbar" gibt, den R4 verlangt (Bestandsaufnahme der Aufrufer: nur Tests).
