# Sitov Academy · S7 · B1.2-Inhaltsaudit · Epoche 6

Geprüfter Git-Stand: `fd14abbe8568aff5f9e7c9d3aa5aa19b42d755da`. Abschluss: 2026-10-09T20:54:40.023886+00:00.

Vollständig gelesen: 10 Quelltexte, 40 Kerne, 240 Fragen und 720 Optionen samt privaten Schlüsseln und Begründungen.

Ergebnis: fünf Befunde, davon vier Fragen betroffen. Zwei redaktionelle Korrekturen vor Veröffentlichung erforderlich; zwei Terminologieempfehlungen und eine partielle Mappingempfehlung. Kein nachgewiesener falscher Lösungsschlüssel, keine nachgewiesene Mehrdeutigkeit des Schlüssels. Quellen-Spannenabweichungen: 0.

## sitov.audit.S7.e6.001 · public_answer_leak

sitov.pretest.b12-02.nominal.q1

Der öffentliche Auftaktsatz nennt auf dem Platz bereits vollständig und verrät damit den gesuchten Artikel dem. Der Schlüssel ist grammatisch richtig, aber die Dativentscheidung lässt sich durch Abschreiben umgehen.

promptDe bisher: Das Treffen findet auf dem Platz statt. Welcher Artikel steht nach »auf« vor »Platz« in dieser Ortsangabe?

promptDe Vorschlag: Der Platz ist der Ort des Treffens. Welcher Artikel steht nach »auf« vor »Platz« in dieser Ortsangabe?

## sitov.audit.S7.e6.002 · terminology_precision_recommendation

sitov.pretest.b12-04.verbs.q5

Vorstellen ist die beabsichtigte Grundform. Vorzustellen ist ebenfalls ein gültiger Infinitiv mit zu. Im schulischen Gebrauch ist die Intention erschließbar; kein nachgewiesener falscher Schlüssel. Ohne zu ausdrücklich nennen.

promptDe bisher: Wie lautet der Infinitiv zu »Der Vorstand stellte die Ausgaben vor«?

promptDe Vorschlag: Welche Grundform (Infinitiv ohne zu) gehört zu »Der Vorstand stellte die Ausgaben vor«?

## sitov.audit.S7.e6.003 · terminology_precision_recommendation

sitov.pretest.b12-05.verbs.q2

Vorlesen ist die beabsichtigte Grundform. Vorzulesen ist ebenfalls ein gültiger Infinitiv mit zu. Kein nachgewiesener falscher Schlüssel; die gewünschte Form sollte ausdrücklich eingegrenzt werden.

promptDe bisher: Wie lautet der Infinitiv zu »Programme lesen Texte vor«?

promptDe Vorschlag: Welche Grundform (Infinitiv ohne zu) gehört zu »Programme lesen Texte vor«?

## sitov.audit.S7.e6.004 · ungrammatical_private_rationale

sitov.pretest.b12-06.nominal.q4

Die Begründung beginnt Der Person, der etwas fehlt, steht im Dativ. Die als Subjekt verwendete metasprachliche Wortgruppe ist falsch flektiert. Die öffentliche Frage und der Schlüssel der anderen Person sind korrekt und eindeutig.

rationaleDe bisher: Der Person, der etwas fehlt, steht im Dativ; Singular lautet der anderen Person.

rationaleDe Vorschlag: Bei fehlen steht die betroffene Person im Dativ. Im femininen Singular lautet die Wortgruppe der anderen Person.

## sitov.audit.S7.e6.005 · partial_same_level_mapping_opportunity

sitov.pretest.b12-01.words, sitov.pretest.b12-10.words

Beide Wortschatzkerne nennen Besprechung, aber ihre leeren topicIds und pauschale Begründung übersehen den gleichstufigen Teilbeleg im registrierten Anker P1/P1-N1. Dort erklärt die Merkkarte Besprechung = Meeting und P1-N1-E07 übt genau Besprechung. Dies belegt jeweils nur eine von sechs Teilfertigkeiten; keine vollständige Kernabdeckung.

M kann für diese beiden Kerne eine ausdrücklich partielle Zuordnung zu sitov.topic.zusammenarbeit-b12 prüfen; pendingReasonDe muss die fünf weiterhin unbelegten Teilfertigkeiten und den begrenzten Besprechung-Beleg benennen. Keine neuen Topic-IDs und keine komplette Kompetenzabdeckung behaupten.

## Nachweise und Grenzen

Die aktuelle jemandem-Aufgabe b12-07.nominal.q5 ist bereits eindeutig korrigiert. Anbieten (b12-05) und nachfragen (b12-08) sind im vollständigen Ausgangssatz tatsächlich belegt. Alle 40 Kerne haben leere topicIds; die zwei gelesenen Curriculumanker sind damit keine bestätigte sichtbare Prüfungs-UI. Besprechung ist in P1-N1-E07 genau, aber nur teilweise belegt.

Aufgaben, Schlüssel, Textkörper und Produktdateien wurden nicht verändert. Keine Humanprüfung, Kalibrierung, Audioprüfung, Laufzeit-/DB-Prüfung oder Publikationsfreigabe. Die vollständigen Originalbelege, 240 Einzelnachweise, 40 Kernnachweise, zehn Volltexte, SHA-256 und Git-Blob-IDs stehen in epoch6-audit.json.

Öffentliche deutsche Promptänderungen benötigen vor Veröffentlichung eine neue unveränderliche Definition und die vorgeschriebene vorberechnete Audio-/Wortzeitenbindung.
