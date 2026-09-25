> **Lies `00_CODEX-4-RULES.md` und diese Datei. Führe ausschließlich Phase 1 aus.**

## PHASE 1 — SCHNELLE KORREKTUREN UND BEWERTUNG

**Ziel:** Die kleinen, spürbaren Ärgernisse verschwinden, und die Bewertung wird fairer.

#### 1.1 Knöpfe tauschen
Befund: `components/vocabulary/VocabCardSession.tsx` (um Zeile 495) zeigt „Wusste ich“ links und „Wusste ich nicht“ rechts. `LessonAssessmentClient.tsx` (um Zeile 152) zeigt „Kenne ich schon“ (`decide(true)`) links und „In die Lernbox“ rechts; ein Kommentar dort begründet die bisherige Seite.
* [ ] In beiden Dateien die Reihenfolge tauschen: „Wusste ich nicht“ bzw. „In die Lernbox“ links, „Wusste ich“ bzw. „Kenne ich schon“ rechts. Der Kommentar in `LessonAssessmentClient.tsx` wird angepasst.
* [ ] Die positive Aktion bleibt die gefüllte (primäre). Falls es Tastaturkürzel oder Wischgesten gibt, folgen sie derselben Seite.
* [ ] App-weites Audit nach R15: alle Knopfpaare in Lernenden- und Admin-Oberfläche (Dialoge, Formulare, Blätter). Abweichungen korrigieren, Liste im Bericht.
* [ ] Test: Reihenfolge der Knöpfe im DOM in beiden Komponenten; ein Jest-Test prüft, dass in gemeinsamen Dialog-Komponenten die primäre Aktion zuletzt steht.

#### 1.2 Groß-/Kleinschreibung und Zeichensetzung sind kein Fehler
Befund: `learning_private.grade_answer` (Migration 06) liefert `EXACT` | `SOFT_ERROR` | `INCORRECT` mit dem Grund `punctuation`, `capitalization`, `umlaut` oder `typo`. `SOFT_ERROR` zählt als richtig, deckelt aber die Grammatik-Punktzahl auf 90 und das Vokabel-Intervall; die Oberfläche zeigt ein gelbes Warnzeichen (`SoftErrorBadge.tsx`).

Neuer Vertrag (verbindlich):
* Weicht die Antwort **nur** in Groß-/Kleinschreibung und/oder Zeichensetzung ab, ist das Ergebnis `status: "EXACT"`, `reason: null` und neu `hint: "capitalization" | "punctuation" | "capitalization_punctuation"`. Volle Punkte, voller Lernbox-Schritt, kein Warnzeichen, nur der neutrale Hinweis „So schreibt man es: …“ (D11).
* Umlaut und Tippfehler bleiben `SOFT_ERROR` wie bisher. Kommt Groß-/Kleinschreibung zu einem Umlaut- oder Tippfehler hinzu, bestimmt der Umlaut- bzw. Tippfehler das Ergebnis.
* Typografische Gleichwertigkeiten gelten immer als identisch: verschiedene Apostrophe (`'` `’`), Anführungszeichen, Bindestrich-Arten, mehrfache Leerzeichen, Leerzeichen am Anfang oder Ende.
* Alles andere bleibt, wie es ist. Insbesondere werden `der`/`den`, `ihm`/`ihn`, `am`/`an` weiter nicht als Tippfehler toleriert.
* Didaktische Folge: Aufgaben, deren **Lernziel** die Großschreibung ist (Höflichkeitsform „Sie“ gegen „sie“), werden nicht als Schreibaufgabe gebaut, sondern als Auswahl. Das gilt für Phase 4.

Aufgaben:
* [ ] Neue Migration (voraussichtlich 30): `grade_answer`, `vocabulary_private.submit_answer` und `grammar_private.record_attempt` nach dem neuen Vertrag. Körper aus der jeweils letzten Definition kopieren (siehe Kontext).
* [ ] Rückweg-Datei, Eintrag in `ORDER`.
* [ ] `supabase/tests/soft-errors.test.mjs` und `supabase/tests/vocabulary-learning.test.mjs` erweitern: „ich heiße anna“ gegen „Ich heiße Anna.“ ergibt `EXACT`, Punktzahl 100, voller Fach-Schritt; „Ich heisse Anna“ bleibt `SOFT_ERROR` (`umlaut`); „ich heise anna“ bleibt `SOFT_ERROR` (`typo`); `der` gegen `den` bleibt `INCORRECT`.
* [ ] `lib/grammar-validation.ts` (Sofort-Vorschau) und die Oberfläche (`VocabCardSession.tsx`, `ExerciseClient.tsx`, `SoftErrorBadge.tsx`) an den Vertrag anpassen. Neue Hinweistexte in fünf Sprachen.
* [ ] Bestehende Tests, die das alte Verhalten festschreiben, werden inhaltlich angepasst und im Bericht genannt, nicht gelöscht.

#### 1.3 Hinweis auf den Artikel beim Ausschreiben
Befund: Die Beschriftung `type_german_with_article` existiert, ein sichtbarer Hinweis fehlt (`VocabCardSession.tsx` um Zeile 300 und 500). Artikel stehen in `public.grammatical_article` (`der`/`die`/`das`/`none`), Farben in `articleColorClass` (`lib/vocabulary-ui.ts`).
* [ ] Im Schreibmodus erscheint bei Nomen (Artikel ungleich `none`) über dem Eingabefeld ein kleiner Info-Chip: „Schreib den Artikel mit: der, die oder das“, mit den drei Artikeln in ihren Farben. Er steht **vor** der Antwort, nicht erst nach einem Fehler. Bei anderen Wortarten erscheint er nicht.
* [ ] Der Chip ist eine eigene Komponente, damit der Lernpfad ihn in Phase 3 wiederverwendet.
* [ ] `submit_answer` liefert bei falscher Antwort zusätzlich `feedback: "article_missing" | "article_wrong" | null`, berechnet in PostgreSQL: Stimmt die Antwort ohne Artikel mit dem Nomen überein, ist es `article_missing`; mit einem anderen Artikel ist es `article_wrong`. Das Ergebnis bleibt `INCORRECT`, weil der Artikel Lernziel ist.
* [ ] Die Oberfläche erklärt beide Fälle in einem Satz (fünf Sprachen) und zeigt die Lösung mit farbigem Artikel.
* [ ] DB-Tests für beide Rückmeldungen und für Pluralwörter („die Eltern“); Komponententest, dass der Chip nur bei Nomen erscheint.

#### 1.4 Mehrdeutige Aufgaben: Zielform zeigen oder Varianten annehmen
Befund: Grammatikaufgaben haben seit 3.4 das Pflichtfeld `target_form`, angezeigt als `Как вас зовут? [heißen]`. Die 604 alten Aufgaben sind `incomplete` und werden nicht ausgeliefert; sie werden in Phase 3 archiviert. Vokabel-Sätze haben `learning_vocabulary_cards.alternative_answers_de`, aber keine Zielform.
* [ ] Neue optionale Spalte `learning_vocabulary_cards.target_form text[]`, im Vokabel-CMS pflegbar und im Schreibmodus genauso angezeigt wie bei Grammatik (`[heißen]`).
* [ ] Audit aller Vokabel-Sätze (Satzkarten) auf Mehrdeutigkeit mit einem Skript unter `scripts/`. Es meldet Sätze, bei denen typische Varianten naheliegen: du/Sie, Satzstellung mit vorangestellter Zeit- oder Ortsangabe, `Tschüs`/`Tschüss`, `geht’s`/`geht es`, `Ich heiße`/`Mein Name ist`, Zahl als Ziffer oder Wort, Preise (`2,50 €`/`zwei Euro fünfzig`).
* [ ] Für jede gemeldete Karte eine Entscheidung: Zielform ergänzen **oder** Varianten in `alternative_answers_de` aufnehmen. Beides nur, wenn die Variante wirklich gleichwertig ist. Die Entscheidungen stehen als prüfbare Liste in `docs/master-4/varianten-audit.md` und werden per idempotenter Migration oder Import übernommen.
* [ ] Keine globale Regel in `grade_answer`, die Inhalte gleichsetzt. Zahlen, du/Sie und Satzstellung können Lernziel sein und werden pro Aufgabe entschieden.
* [ ] Test: Jede Satzkarte mit gemeldeter Mehrdeutigkeit hat danach Zielform oder Alternativen.

#### 1.5 Botschaft nach der Registrierung
Befund: `lib/auth-i18n.ts` hat `status_signup_email_sent` und `status_confirm_success`. Ohne freigeschaltetes Niveau zeigt Home nur die kleine Zeile `today_no_level` (`lib/student-ui-i18n.ts`, `TodayPlan.tsx`). Die Mail bei Freischaltung existiert (`level_access_granted`, Migration 29).
* [ ] Nach dem Absenden der Registrierung und nach der Bestätigung der E-Mail-Adresse steht deutlich (Deutsch, sinngemäß in den anderen Sprachen):
  > **Vielen Dank für deine Anmeldung!** Der Admin prüft kurz deine Daten und schaltet dir danach die Funktionen frei.
* [ ] Auf Home ersetzt eine große Karte „Freischaltung ausstehend“ die kleine Zeile, solange kein Niveau freigeschaltet ist: Uhr-Symbol, derselbe Satz, darunter „Du bekommst eine E-Mail, sobald es losgeht.“ und ein Link zur Hilfe. Kalender und Hilfe bleiben erreichbar.
* [ ] Tests für beide Statusseiten und die Karte (mit und ohne freigeschaltetes Niveau).

**Abnahme Phase 1:** Alle DB-, Jest- und axe-Tests grün; Migration im Klon doppelt ausgeführt (Idempotenz); produktiv aktiviert nach dem Ablauf mit Schemaänderung; Vorher/Nachher-Bildschirmfotos der Knöpfe, des Artikel-Chips und der Karte „Freischaltung ausstehend“ im Bericht.

**Übergabe:** Belegte Migrationsnummern, der neue `grade_answer`-Vertrag und die Varianten-Liste stehen in `STATUS.md`. Phase 4 nutzt den Vertrag für alle Schreibaufgaben.

---