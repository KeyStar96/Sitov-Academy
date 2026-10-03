# Sitov Academy – Verbtrainer

Stand: 3. Oktober 2026. Der eigenständige Trainer ist unter `/{lang}/dashboard/level/{level}/verbs` erreichbar. Er nutzt eine eigene Lernbox und eigenen Fortschritt; bestätigte Verbantworten fließen zusätzlich in die gemeinsame Lernaktivität und die Wiederaufnahme auf Home ein.

## Lernkonzept und Wortpool

Der Pool übernimmt die beiden bereitgestellten Listen `Verben_A1-B1_nach_Niveaus.txt` und `Verben_B2_C1_nur_Infinitive.txt`. Niveauübergreifende Dubletten behalten ihr erstes Einführungsniveau. Reflexive Verben und feste Mehrwortverbindungen bleiben eigene Einträge.

| Niveau | Neu eingeführte Verben | Kumulativer Pool bei vollständiger Freigabe | Übungszeiten |
| --- | ---: | ---: | --- |
| A1.1 | 140 | 140 | Präsens |
| A1.2 | 129 | 269 | Präsens, Perfekt |
| A2.1 | 93 | 362 | Präsens, Perfekt; begrenztes Präteritum |
| A2.2 | 62 | 424 | Präsens, Perfekt; begrenztes Präteritum |
| B1.1 | 92 | 516 | Präsens, Perfekt, Präteritum |
| B1.2 | 70 | 586 | Präsens, Perfekt, Präteritum |
| B2 | 187 | 773 | Präsens, Perfekt, Präteritum |
| C1 | 187 | 960 | Präsens, Perfekt, Präteritum |

Im A2-Präteritum sind nur `sein`, `haben`, `werden`, `können`, `müssen`, `dürfen`, `sollen`, `wollen`, `mögen` und `wissen` zulässig. Die Zeitfreigabe richtet sich nach dem aktuell geöffneten Trainingsniveau. So erhält beispielsweise ein bereits ausgewähltes A1.1-Verb auf A1.2 eine neue, zunächst ungeübte Perfektspur. Der eigene Präsensfortschritt bleibt bestehen.

Jeder Katalogeintrag enthält sechs Präsens- und Präteritumformen, finite Form und gegebenenfalls abgetrennte Partikel, zulässige Formenvarianten, Perfektbausteine, Hilfsverben und kurze Bedeutungen in Deutsch, Englisch, Russisch, Ukrainisch und Türkisch. Die Bedeutung erscheint in der Box und direkt unter dem Infinitiv der Aufgabe. Ein deutscher Interfacewechsel sperrt den Verbtrainer nicht. 296 Einträge besitzen zusätzlich einen geprüften Satzkontext; ohne Kontext werden keine beliebigen Beispielsätze erzeugt.

Trennbare, untrennbare und reflexive Verben, Dativreflexiva, starke und schwache Formen sowie regionale Hilfsverbvarianten sind berücksichtigt. Impersonale Aufgaben beschränken die Person, gegenseitige Verben verwenden Pluralpersonen. Bedeutungsabhängige Formen werden bewusst eingegrenzt: `hängen` trainiert den Zustand `hing / gehangen`; `übersetzen` bedeutet übersetzen, `umfahren` bedeutet ein Hindernis umfahren. Modalverben enthalten einen Hinweis zum Ersatzinfinitiv; `sich blicken lassen` und `geboren werden` besitzen die passenden Perfektbausteine.

## Drei Ansichten und sechs Aufgabentypen

| Ansicht | Verhalten |
| --- | --- |
| Automatisches Training | Trainiert die ausgewählten Verben mit allen auf diesem Niveau zulässigen Zeiten. Fällige und neue Formen kommen zuerst. |
| Gezieltes Training | Gleiche Box, mit frei wählbarer Teilmenge der freigegebenen Zeiten. Ohne ausgewählte Zeit startet keine Runde. |
| Meine Verbbox | Suche nach Infinitiv und Interfacebedeutung, Filter nach Einführungsniveau und ausgewählten Verben, einzelne Auswahl sowie „sichtbare Verben hinzufügen“. Gesperrte Niveaufilter bleiben erkennbar. |

Eine Runde umfasst bis zu zehn bewertete Aufgaben und lässt sich früher beenden. Feedback und Lösung erscheinen nach der bestätigten Serverantwort. „Lösung anzeigen“ sendet einen leeren Versuch und zählt als falsch. Danach führt ein eigener Knopf zur nächsten Aufgabe; Eingabe, Feedback und Abschluss erhalten passenden Tastaturfokus. Doppelte Aktionen während eines laufenden Requests sind blockiert, Fehler lassen sich wiederholen.

Die Engine variiert Person und Aufgabentyp serverseitig. Die sechs technischen Typen sind:

| Typ | Zeiten | Eingabe |
| --- | --- | --- |
| `conjugation` | Präsens, Präteritum | Form zur vorgegebenen Person, einschließlich Reflexivpronomen und Partikel |
| `direct` | Präsens, Präteritum | Direkte Formenabfrage; nutzt dieselbe korrekte Personenform wie `conjugation` |
| `participle` | Perfekt | Partizip beziehungsweise der hinterlegte Perfektbaustein |
| `auxiliary` | Perfekt | `haben` oder `sein` |
| `perfect` | Perfekt | Flektiertes Hilfsverb und Perfektbaustein in getrennten Eingaben |
| `sentence` | Alle freigegebenen Zeiten | Finite Form und gegebenenfalls Partikel beziehungsweise Hilfsverb und Perfektbaustein im geprüften Satzkontext |

Satzaufgaben entstehen ausschließlich für Einträge mit Kontext. Bei ausdrücklich gerichteten Bewegungs-Kontexten wird `sein` ausgewählt. Die Bewertung ignoriert Groß-/Kleinschreibung, äußere und mehrfache Leerzeichen und normalisiert Unicode auf NFC. `ä`, `ö`, `ü` und `ß` bleiben orthografisch relevant; die Eingabehilfe unterstützt diese Zeichen.

## Eigene Lernspuren und Wiederholung

Fortschritt ist über `(auth_user_id, verb_id, tense)` eindeutig. Präsens, Perfekt und Präteritum steigen unabhängig auf; Vokabeltrainer und Lernpfad verändern diese Werte nicht.

| Ergebnis | Box und nächste Wiederholung |
| --- | --- |
| Erster richtiger Versuch | Box 2, nach einem Tag |
| Richtige fällige Antwort | Eine Box höher, maximal Box 7; Abstände für Box 2–7: 1, 3, 7, 14, 30, 60 Tage |
| Richtige zusätzliche Übung vor Fälligkeit | Versuch und Treffer werden gezählt; Box und Termin bleiben bestehen |
| Falsche Antwort oder Lösung anzeigen | Box 1, nach fünf Minuten; Fehlerzähler steigt |

Ab Box 6 gilt eine Zeitform in der Oberfläche als sicher. Die Warteschlange bevorzugt fällige/neue Formen, dann den frühesten Termin, schwächere Boxen und höhere Fehlerzahlen. Gibt es weitere Verben, wird das zuletzt geübte Verb beim nächsten Abruf vermieden. Wenn alle Formen noch warten, bleibt zusätzliche Übung möglich; sie beschleunigt den Boxaufstieg nicht.

Auswahl und Fortschritt werden im Account gespeichert. Entfernen, erneutes Hinzufügen und Niveauwechsel löschen keine Lernspur. Neue Zeiten beginnen ohne bestehenden Fortschritt. Gesperrte Inhalte werden ausgeblendet, bleiben aber gespeichert und können nach erneuter Freigabe weitergeführt werden. Die aktuelle Zehner-Runde und noch nicht abgeschickte Antworten sind lokale UI-Zustände; ein Gerätewechsel übernimmt die bestätigte Box und Bewertung, nicht den ungespeicherten Entwurf.

Die bestehenden Reset-Workflows sind integriert: Ein Lehrerreset eines Niveaus löscht dessen eingeführte Verb-Lernspuren und betroffene Challenges, erhält die Auswahl; der vollständige Account-Lernreset entfernt auch die Verbbox. Ein bloßer Rechtewechsel löst keinen Reset aus.

## Lehrerkontrolle und kumulative Rechte

Freigaben verwenden das bestehende Modell `student_level_access`, `learning_trainer_grants` und `learning_unit_grants`. Jeder Infinitiv besitzt eine stabile `learning_units`-Einheit mit `trainer = 'verbs'`, sodass Lehrkräfte sowohl den gesamten Trainer als auch einzelne Verben steuern können. Lehrer und Administratoren haben Vollzugriff.

- A1.1–B1.2 benötigen die bestehende Niveau-Freigabe. Ohne Trainer-Override ist der Verbtrainer dieses Niveaus freigegeben; ein explizites `enabled = false` sperrt ihn. Im Modus „ausgewählte Einheiten“ erlaubt nur die konkrete Einheit den Inhalt; eine leere Auswahl sperrt den Trainerzugang.
- B2 und C1 benötigen eine explizite Verbtrainer-Freigabe. Sie erteilen keine Rechte für Vokabeln, Lernpfad, Aussprache oder Mediathek. Die allgemeine Kurs-/Niveaufreigabe bleibt auf den sechs bisherigen Niveaus; der Verbtrainer erweitert nur die Trainer-Navigation um B2/C1.
- Kumulativer Inhalt setzt die weiterhin gültige Freigabe des **Einführungsniveaus jedes Verbs** voraus. Beispiel: Ein offener B2-Trainer erlaubt weiterhin freigegebene A1-Verben; entzieht die Lehrkraft A1.1 oder dessen einzelne Einheit, verschwindet dieses Verb auch aus der B2-Box. Die spätere Freigabe umgeht die frühere Sperre nicht.
- Für Antworten müssen sowohl das Trainingsniveau der Challenge als auch Einführungsniveau, Trainer, Einheit und aktuelle Boxauswahl erlaubt sein. Ein Rechteentzug sperrt auch eine bereits ausgegebene Aufgabe und die Wiederholung einer Antwortquittung. Gespeicherter Fortschritt bleibt erhalten.

Routen-Guard, Dashboardstatus, Lehreroberfläche, Server Actions und SQL prüfen dasselbe Modell. B2/C1 erscheinen im Schüler-Dashboard nur bei gültiger Verbfreigabe. Die fünfte Trainerintegration behebt außerdem eine bestehende Mediathek-Lücke: entzogene Video-Trainerrechte sperren auch deren Inhalte; ihre bisherige Nutzbarkeit mit deutschem Interface bleibt erhalten.

## Speicherung und sichere Bewertung

`lib/verbs/server.ts` ist `server-only`. Die Identität stammt aus `auth.getUser()`; Eingaben werden mit strikten Zod-Schemas geprüft. Der Browser übermittelt keine eigene Nutzer-ID, Lösung, Boxstufe oder Wahrheitsbehauptung.

| Tabelle | Zweck und Zugriff |
| --- | --- |
| `sitov_verb_catalog` | Stabile Zuordnung von Verb, Einheit und Einführungsniveau; SELECT nur auf erlaubte aktive Einheiten |
| `sitov_verb_box` | Accountauswahl; eigener Account oder Lehrkraft kann lesen; Änderungen nur durch geprüfte RPC |
| `sitov_verb_progress` | Separate Zeitformspuren; eigener Account oder Lehrkraft kann lesen; Bewertung nur durch geprüfte RPC |
| `sitov_verb_challenges` | Private erwartete Antworten, Lösung und Antwortquittung; für Schüler weder lesbar noch direkt schreibbar |

Die Next-Server-Action erzeugt eine zufällig variierte Aufgabe und speichert den privaten Antwortschlüssel über den ausschließlich serverseitigen Admin-Client. Der Browser erhält nur Challenge-ID, Aufgabe, Bedeutung und Eingabeteile. `sitov_submit_verb_answer` vergleicht die tatsächlichen Eingaben in PostgreSQL und aktualisiert Bewertung und Quittung atomar. Neue Challenges laufen nach zwei Stunden ab. Gleiche bereits bestätigte Antworten liefern nach erneuter Rechteprüfung dieselbe Quittung; abweichende Wiederholungen ergeben `conflict`, fremde IDs `not_found`.

RLS ist für alle vier Tabellen aktiv. Schüler können weder Fortschritt, Challenges noch Freigaben direkt schreiben. Die privilegierten RPCs prüfen Auth, Inhalte und Rechte selbst, setzen einen leeren `search_path` und serialisieren Zugriff, Reset und Bewertung mit den vorhandenen Advisory Locks. Die private Schema-Hilfslogik besitzt ausdrücklich begrenzte Grants. Allgemeine Lernereignisse, „zuletzt aktiv“ und neue Trainerfreigaben kennen jetzt den Modus `verbs`.

## Fünf Trainer und Motion Design

Home verwendet vier kompakte Karten und einen breiten Verbtrainer darunter. Die Niveauübersicht wächst auf großen Displays zu einer 3+2-Anordnung; der Verbtrainer erhält zwei Spalten, auf kleinen Displays die ganze Breite. Der Mode-Dock zeigt fünf Ziele, auf Mobilgeräten mit kurzen lokalisierten Bezeichnungen und vollständigen zugänglichen Namen. Karten, Breadcrumbs, Wiederaufnahme und Status verwenden dieselben Modusfarben; der Verbtrainer erhält Magenta.

Die Gestaltung übernimmt die räumliche Beleuchtung und die ruhigen kräftigen Flächen des DailyQuest-Redesigns aus Claude-Commit `28ff33d` („Redesign daily quests“). Trainerkarten besitzen gestaffelte Auftritte, Zeigerlicht, einen Lichtrand, schwebende Personenformen und deutliche Fokuszustände. Gemeinsame Trainerwechsel erhalten weichere Übergänge und eine in der jeweiligen Modusfarbe gehaltene Atmosphäre. Der Verbtrainer ergänzt Formenorbit, Aurora, Antwortfeedback und Abschlussfunken.

DailyQuest behält die dreischichtige Flamme, rollende Serienzahl, Wachstum ab 1/3/7/30 Tagen, Geisterflamme bei null, Lichtreise alle sechs Sekunden und den grünen Abschlussstempel. Die längste Serie erscheint nur oberhalb der aktuellen Serie. Die Nacharbeit ergänzt eindeutige Überschriften-IDs, Tastaturlicht und einen ausdrücklich sichtbaren statischen Endzustand für pausierte Karten.

`prefers-reduced-motion` stellt Dekorationen statisch dar; IntersectionObserver und Dokument-Sichtbarkeit pausieren kontinuierliche Animationen außerhalb des Sichtfelds beziehungsweise im Hintergrundtab. Die Task-Eingabe und das Feedback bleiben bedienbar, wenn der dekorative Header nicht sichtbar ist. Light/Dark und Kontrastfarben stammen aus den bestehenden Appearance-Tokens. Die ausschließlich in Entwicklung erreichbaren Vorschauen `/{lang}/sitov-preview/trainers`, `/{lang}/sitov-preview/verbs` und `/{lang}/sitov-preview/daily-quest` erlauben Theme-/Kontrastwechsel ohne Änderung gespeicherter Präferenzen; Produktion liefert 404.

## Pflege, Quellen und Migrationen

Die Offline-Quellen liegen unter `lib/verbs/source/`: `pool.json` für erste Niveauzuordnung, `lexicon.json` für Morphologie und `translations.json` für Bedeutungen. Der reproduzierbare Builder `scripts/build-sitov-verb-catalog.cjs` erzeugt `lib/verbs/catalog-data.json`. Änderungen gehören in diese Quellen oder die kommentierten Ausnahmen des Builders, nicht ausschließlich in die generierte Datei. Bei Änderungen an Infinitiven und IDs müssen bestehende Auswahl, Fortschritt und stabile Einheiten ausdrücklich migriert werden.

Morphologie stammt aus den benötigten Auszügen von `german-verbs-dict` 3.4.0 mit Morphy-/LanguageTool-Herkunft. Quellen, Bearbeitungen und fachliche Primärreferenzen sind in [DATA-SOURCES.md](../lib/verbs/DATA-SOURCES.md) dokumentiert. Die morphologischen Daten und abgeleiteten Katalogdaten stehen unter CC BY-SA 4.0; der vollständige Text liegt in [DATA-LICENSE.txt](../lib/verbs/DATA-LICENSE.txt). Die Anwendung hat keine Laufzeitabhängigkeit vom Wörterbuch und lädt keine Formen oder Übersetzungen aus dem Netz.

Die Migrationen sind `20261003093136_sitov_verb_trainer_enums.sql` und `20261003093137_sitov_verb_trainer.sql`; auf dem VPS entsprechen ihnen [62_verb_trainer_enums.sql](../supabase/vps/62_verb_trainer_enums.sql) und [63_verb_trainer.sql](../supabase/vps/63_verb_trainer.sql). **62 muss vor 63 in einer separaten Transaktion committed sein**, da PostgreSQL neue Enum-Werte erst danach verwenden darf. 63 enthält den idempotenten Seed aller 960 stabilen Einheiten und bewahrt vorhandene Lernspuren bei erneuter Anwendung. Spiegel in `supabase/schema.sql`, Migration und VPS-Datei müssen gemeinsam gepflegt werden. Bei einem kontrollierten Rollback wird zuerst die vorherige Anwendungsversion wiederhergestellt, dann [rollback/63_verb_trainer.sql](../supabase/vps/rollback/63_verb_trainer.sql) angewendet: Die Verb-RPC-Rechte werden entzogen und bisherige Zugriffsfunktionen wiederhergestellt, Auswahl und Lernspuren bleiben zur Wiederherstellung erhalten. [rollback/62_verb_trainer_enums.sql](../supabase/vps/rollback/62_verb_trainer_enums.sql) entfernt keine Enum-Werte; ihre Labels sowie die Reset-Hooks für erhaltene Verbtrainerdaten bleiben bestehen.

## Validierung und Releaseabschluss

Bereits gezielt geprüft wurden die Katalogreproduzierbarkeit, alle 960 Einträge mit vollständigen Übersetzungen, Übungszeiten, Varianten, Reflexiva, Partikeln und Antwortnormalisierung; Server-Action-Abwehr gefälschter Eingaben; SQL-Eigentum, fehlende direkte Schreibrechte, aktuelle Freigaben, Antwortquittungen, SRS, kumulative Sperren und wiederholbarer Seed; UI-Auswahl, Eingabe/Feedback, Fehlerwiederholung, fünfteilige Navigation, Deutschfreigabe und DailyQuest-Zustände. Bei der unabhängigen Sprachprüfung wurden alle 122 von ausschließlich `haben` abweichenden Hilfsverbgruppen, alle 374 B2/C1-Einträge sowie sämtliche reflexiven/mehrteiligen Einträge geprüft. Gefundene Hilfsverb-, Trennungs-, Bedeutungs- und historische Schreibungsfehler sind im Builder korrigiert. Übersetzungen und neue Satzkontexte sollten bei redaktioneller Erweiterung erneut fachlich geprüft werden.

Wiederholbare fokussierte Befehle:

```sh
node scripts/build-sitov-verb-catalog.cjs --check
npx jest __tests__/sitov-verb-engine.test.ts __tests__/sitov-verb-actions.test.ts components/verbs/__tests__/VerbTrainerClient.test.tsx --runInBand
node --test supabase/tests/sitov-verb-trainer.test.mjs
npx tsc --noEmit --pretty false
```

Der Gesamt-Jest-Lauf hat 2.554 bestandene Tests in 203 bestandenen Suiten und einen Skip gemeldet. Nach den letzten Korrekturen bestanden zusätzlich 66 gezielte Tests; die zuletzt angepasste Dock-Navigation bestand ihre 44 Tests. Die elf Datenbankprüfungen, vollständige TypeScript-Prüfung, ESLint der geänderten Komponenten und lokaler Produktionsbuild mit Webpack waren erfolgreich. Die Browserprüfung umfasst Desktop und 390-Pixel-Mobilansichten in Light/Dark sowie hohem Kontrast; die DailyQuest-Zustände null, laufend, geschafft, 128 und pausiert passen, einschließlich des sichtbaren statischen Endzustands der pausierten Karte. VPS-Deployment und anschließende Prüfung in Produktion stehen noch aus und werden im Releaseprotokoll ergänzt.
