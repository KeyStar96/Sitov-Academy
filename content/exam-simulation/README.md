# Sitov Academy: universelle simulierte Prüfungen

Pro Niveau A1 bis C2 gibt es genau eine neue universelle Prüfung von Sitov
Academy. Sie verbindet wichtige Aufgabenformen mehrerer Institute. Eine
Anbieterwahl gehört nicht zum neuen Ablauf. Alte Anbieterkennungen bleiben
für bereits gespeicherte, unveränderliche Durchgänge lesbar.

Der Start prüft zur Laufzeit alle Pflichtfamilien und Hörquellen. Ein Niveau
wird erst freigegeben, wenn sechs vollständige Varianten je Hörgenre als
lokal vorberechnete Qwen-Aufnahmen mit geprüften Wortzeitmarken im
Datenbank-Storage nachgewiesen sind. Dateiexistenz und ein lokaler Export
allein bestätigen keinen Import. Es gibt keinen stillen Teilcheck anstelle
einer vollständigen Prüfung.

## Inhalt und Umfang

`lib/exam-simulation/content.ts` kompiliert insgesamt **1.519 versionierte
Aufgabenvarianten**: 936 aus den zwölf Situationen und 13 Familien, 144
unterschiedliche Sprachgebrauchs-/Textlückenaufgaben, 288 neue Hörentscheidungen,
108 zusätzliche Formular-, Bericht-, Reformulierungs-, Reihenfolge- und Gesprächsaufgaben,
12 Aufgaben zur schriftlichen Hörvermittlung sowie 31 historische B1-
Hörentscheidungen. Die historischen Hörentscheidungen dienen allein der
Kompatibilität; neue universelle Prüfungen verwenden die neuen Hörquellen.
Die Variantenzahl bezeichnet nicht 1.519 unabhängige Quelltexte.

| Niveau | Varianten im Katalog | Aufgaben pro Prüfung | Automatische Einzelentscheidungen | Leistungen mit Lehrkraftbewertung | Zeit |
| --- | ---: | ---: | ---: | ---: | ---: |
| A1 | 252 | 20 | 21 | 4 | 80 Minuten |
| A2 | 228 | 23 | 21 | 4 | 100 Minuten |
| B1 | 259 | 29 | 23 | 8 | 150 Minuten |
| B2 | 252 | 31 | 27 | 9 | 180 Minuten |
| C1 | 258 | 32 | 28 | 10 | 210 Minuten |
| C2 | 270 | 33 | 30 | 11 | 240 Minuten |

Eine Zuordnungsaufgabe zählt drei Einzelentscheidungen; das A1-Formular
zählt vier Felder. Die Zeiten sind eigene Vorgaben von Sitov Academy,
keine Originalzeiten eines Prüfungsinstituts.

Lesen enthält auf jedem Niveau mindestens eine Richtig/Falsch-Entscheidung;
Hören zusätzlich auf A1 bis B2. Ab B2 gehört eine Reihenfolgeaufgabe zur
Pflichtmatrix: vier Schritte auf B2, fünf Argumentationsschritte auf C1 und
sieben auf C2. Die Schritte erscheinen gemischt. Eine Antwort entsteht
erst durch eine eigene Auswahl; unvollständige Reihenfolgen erhalten
positionsbezogene Teilpunkte und keine voreingestellte richtige Lösung.

`content/exam-simulation/sitov-scenarios.json` enthält 72 nach Niveau
formulierte Haupttexte. A1/A2 verwenden zusätzlich einfache Aufgabenstämme,
Angebote, Hinweise und Handlungsaufträge aus `sitov-lower-language.json`.
`sitov-universal-long-reading.json` enthält 24 längere argumentierende
Lesefassungen: C1 etwa 350–400 Wörter und C2 etwa 500–550 Wörter, jeweils
mit konkurrierenden Perspektiven und eigenen inferentiellen Fragen.
`sitov-language-cloze.json` enthält 72 eigene kurze Lückentexte; sie
wiederholen nicht die parallel ausgewählten Sprachgebrauchssätze.
`sitov-b2-coherence.json` ergänzt zwölf zusammenhängende vierteilige Abläufe;
`sitov-upper-coherence.json` enthält 24 eigene Argumentationsketten mit fünf
beziehungsweise sieben klar aufeinander bezogenen Schritten. Ihre Rückverweise
begründen die Reihenfolge; bloße Absatzpositionen sind kein Lösungskriterium.
Zwölf originale SVG-Bildimpulse zeigen ausschließlich männliche Figuren.

## Hörvertrag und Varianten

`sitov-universal-audio-manifest.json` ist der einzige finale Synthesevertrag:
144 Audio-IDs mit den tatsächlichen gesprochenen Texten ohne Sprecherlabels.
Vier Hörgenres erhalten je sechs unterschiedliche Quellen auf jedem Niveau.
Die 48 C1/C2-Quellen umfassen je mindestens 300 Wörter. Alle Quellen bleiben
unter der unveränderten Qwen-Grenze von 3.000 Zeichen. Metadaten und
Aufgabenanker stehen in `sitov-universal-listening.json`; Zwischenfassungen
wie `sitov-upper-audio-expansion.json` dienen nur der Autorenhistorie.
Vor Veröffentlichung gilt vollständig `docs/audio-authoring.md` mit
`sitov-qwen-male-de-v1`. Im Schülerbetrieb gibt es keine Synthese und keine
Ersatzstimme.

Pro Niveau gibt es zunächst **sechs vollständige, inhaltlich abgestimmte
Prüfungssätze**. Der Server wählt einen noch nicht bearbeiteten Satz zufällig
und mischt Antwortpositionen mit einem privaten Zufallswert. Jeder Hörsatz
wird als Ganzes mit beiden Fragen ausgewählt. Eine C1/C2-Hörvermittlung
verwendet dieselbe ausgewählte Vortragsquelle.

Gedruckte Aufgaben einschließlich Zuordnung, Grammatik, Bericht und
Reformulierung dürfen keinen Sachverhaltsanker der vier Hörgeschichten
vorwegnehmen. Die sechs Satzzuordnungen prüfen diese Trennung ausdrücklich.
Innerhalb eines Lesetextes sind unterschiedliche Teilfragen möglich.
Die vollständige Historie sperrt frühere Aufgaben-IDs und Hörquellen. Nach
sechs vollständigen Durchgängen verlangt das System eine Erweiterung des
Pools; es verwendet keine still recycelten Antworten. Neue Prüfungssätze
benötigen neue semantische Situationen, passende Audioquellen und eine
geprüfte Zuordnungsmatrix.

## Bewertung und eingefrorene Durchgänge

Die eigene Sitov-Rubrik verlangt mindestens **70 % in jeder Fertigkeit**,
einschließlich Sprachgebrauch, sowie mindestens **50 % je Schreib- und
Sprechaufgabe**. Alle produktiven Aufgaben müssen tatsächlich eingereicht
und bewertet sein. Eine getippte Vorbereitung ersetzt keine Sprechaufnahme.
Bei Gesprächsaufgaben muss die Lehrkraft hörbare Partnerantworten und
Rückfragen bestätigen, bevor positive Punkte vergeben werden. Ein
ungeeigneter Monolog kann mit null Punkten abschließend bewertet werden.

Geschlossene Aufgaben und Formularfelder werden serverseitig ausgewertet.
Formularfelder tolerieren Großschreibung, Randabstände und gleichwertige
Uhrzeitnotation. Fehlende produktive Leistungen erhalten null Punkte und
verbleiben nicht dauerhaft in einer irreführenden Bewertungswarteschlange.
Eine noch ausstehende echte Bewertung lässt die Gesamteinschätzung nur offen,
solange ein Bestehen weiterhin möglich ist. Eine vollständig bewertete
Fertigkeit unter 70 %, eine fehlende produktive Leistung oder eine bereits
bewertete Schreib-/Sprechaufgabe unter 50 % führt sofort zu „noch üben“.
Andere tatsächlich eingereichte Leistungen bleiben dabei zur Bewertung offen.
Keine Gesamtpunktzahl darf eine schwache Fertigkeit oder eine fehlende
produktive Aufgabe ausgleichen. Die Einschätzung garantiert nicht das
Bestehen einer späteren Zertifikatsprüfung.
Grenzwerte werden mit den tatsächlichen Punkten verglichen. Angezeigte
Prozente werden auf eine Dezimalstelle abgerundet, damit beispielsweise
69,5 % weder als 70 % erscheinen noch die 70-%-Grenze erfüllen.

Beim Start werden Aufgaben, Schlüssel, Medienquellen, Frist, Satznummer
und Rubrik als privater unveränderlicher Snapshot gespeichert. Spätere
Katalogänderungen ersetzen diesen Vertrag nicht. Lösungs- und Belegfelder
werden erst nach Abschluss zurückgegeben; Hörskripte und die private
Rubrik bleiben serverseitig. Neue Inhalte verändern keine bestehenden
Aufgaben-IDs, Antworten, Fortschritte oder Streaks anderer Trainer.
