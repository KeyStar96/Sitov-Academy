# S2 · Epoch 42 · Letzte Rollenentwürfe und gebundene Audio-Fragen

Basis `e1d571b092d14ea1f43552a87d5b604f713ebfc3`. Alle vier unveränderlichen M-Eingaben sind unter `S2/epoch42-bound-input-1.json` bis `-4.json` bytegleich archiviert; Originale unverändert. Ihre SHA256 stehen im Beleg. Jede vollständige Ausgangsaufgabe, Elternkarte, Lernzielbeschreibung und vorgeschlagene Endaufgabe wurde streng an die vereinbarte sortierte kompakte JSON-Hashkonvention gebunden.

Reihenfolge und Umfang: A) genau 30 S7-Aufgabenentwürfe, drei Elternkontexte und eine Lernzielbeschreibung; B) zusätzlich der von M vollständig gelesene Index 57; C) danach genau 75 Frageplatzhalter über `/content/question`, deren vollständige Before-Hashes nach A gebunden sind, ohne Schlüssel-/Übersetzungsänderung; D) eine metasprachliche Paarfrage über genau fünf Felder (deutsche Frage + vier übersetzte Aufgabentexte). Die Paarlösung „mich / mich“ und Rang 1 bleiben erhalten. Alle 75 Einzel-Fragen und die Paarfrage liefern die exakt von M erwarteten vollständigen kanonischen Utterances.

Explizit freigegebene abgeleitete Erklärungsspiegel: 23 weitere Aufgaben, genau 115 Felder. Für jede Aufgabe sind alle fünf alten Erklärungen exakt gleich der alten freigegebenen Elternregel, alle fünf neuen exakt gleich der neuen Elternregel; sämtliche anderen Aufgabenfelder sind identisch. Vollständiger alter/neuer Task, Hashes, Elternbindung und Prädikat stehen in `S2/epoch42-derived-mirror-predicate-proof.json`. Finale redaktionelle Freigabe bleibt ausstehend; keine allgemeine Geschwister-/Inhaltsfreigabe.

**Final: 125 verschiedene geänderte Aufgaben = 102 aus A–D + 23 Spiegel; 396 geänderte Seed-Skalare = 281 + 115; drei Elternkontexte, ein Lernzielskalar, 65 betroffene Knoten.** Die Stufen können dieselbe Aufgabe bzw. Frage nacheinander berühren; der vollständige Skalarbeleg unterscheidet Stufenänderungen vom eindeutigen Basis-/Endzustandsvergleich.

Vollständiger Vergleich aller 9.569 Aufgaben, 856 Knoten und 66 Pfade. IDs, Typen, Lernziele, Reihenfolgen, Satzteile, Kartenbezüge, Optionszahlen und korrekte Ränge erhalten. Alle nicht zugewiesenen Aufgaben/Eltern und fünf andere Seed-Dateien bytegleich. Alle übrigen akzeptierten Antworten unverändert. Native Autorenbeleg: 8.800 Aufgaben in 128 Dateien verglichen; 101 explizite native Aufgabenquellen, drei Elternkontexte und ein Lernziel geändert, alle übrigen Geschäftswerte exakt. Drei nach der gebundenen Übernahme unbenutzte lokale Hilfskonstanten entfernt. Tatsächliche Quelldateien im JSON-Beleg; A1.1 besitzt keinen separaten Autoren-Builder.

Prüfungen: **alle neun nativen Niveaus bytegleich; 16/16 bestehende gezielte Autorenchecks; Schema aller 9.569 Aufgaben; ESLint 0 Fehler/0 Warnungen; Diff-Prüfung PASS.** Drei Vogel-HOLDs (65–67) und der retained Index 58 sind als vollständige Aufgaben unverändert. Index 57 wurde ausschließlich durch die zusätzliche ausdrückliche M-Autorisierung geändert.

Sechs ausdrücklich freigegebene 1→1-Antwortrevisionen, jeweils eine alte/neue akzeptierte Antwort und unveränderter korrekter Optionsrang (nullbasiert):

- A2.1 P4-N6-E01: „Vielleicht ist sie krank.“ → „Vielleicht ist er krank.“; Rang 0.
- A2.1 P4-N12-E15: „Tut mir leid, Frau Rojas ist heute nicht im Haus.“ → „Tut mir leid, Herr Rojas ist heute nicht im Haus.“; Rang 1.
- A2.2 P3-N12-E03: „Sie soll die Praxis anrufen.“ → „Er soll die Praxis anrufen.“; Rang 0.
- B1.1 P1-N7-E04: „Lena hat den Schlüssel vergessen.“ → „Leon hat den Schlüssel vergessen.“; Rang 2.
- B1.1 P5-N13-E18: „Sie möchte Frau Petrova persönlich kennenlernen.“ → „Sie möchte Herrn Petrov persönlich kennenlernen.“; Rang 2.
- B1.1 P4-N12-E04: „Wenn Anna mehr Geld hätte, würde sie einen teuren Sprachkurs machen.“ → „Wenn Anton mehr Geld hätte, würde er einen teuren Sprachkurs machen.“; Rang 1.

Alle alten/neuen Antworten bleiben vollständig im privaten Gesamtbeleg. Tatsächliche historische Schülerantworten/Fortschritte wurden nicht archiviert oder geändert; Migration 114 und gebundener Revisionsnachweis bleiben vor Adoption bei M. Keine Aussage unveränderter Schlüssel für diese sechs Aufgaben.

Beide tatsächlichen Audio-Adapter wurden für alle 9.569 alten/neuen Aufgaben verglichen: 144 finale Aliase aus 125 geänderten Aufgaben, genau 102 geänderte Payloads in 102 Aufgaben. Erklärungsspiegel ändern keine Audio-Payloads. Vollständige alte/neue Texte, originale adoption33-Aliasidentitäten, Katalogursprünge und SHA256 stehen in `S2/epoch42-final-canonical-audio.json`. Lokale Qwen-Vorbereitung, Wortzeitprüfung und Import vor Veröffentlichung bleiben bei M; menschliche Hörprüfung false.

Vollständige alte/neue Aufgaben, Eltern, Lernziele, alle betroffenen Knoten und Skalarpfade: `S2/epoch42-old-new-full.json`. Native Autorenprüfung: `S2/epoch42-native-source-proof.json`. Größen, Prüfsummen, genaue Dateiliste und alle Prüfergebnisse stehen in `epoch42-role-gap-proof.json` bzw. `S2/epoch42-validation.json`.

Keine globale Adapter-/SQL-/Laufzeit-/Test-/M-Dokumentänderung. Keine DB-, SSH-, Modell-, Audio-Synthese-, Import-, Veröffentlichungs-, Push- oder Deploy-Aktion. Keine zweite Hypothesenprüfung oder pauschale menschliche Inhalts-/Hörfreigabe. Source Candidate zur abschließenden M-Nachprüfung; S2 wartet nach Sicherung auf frischen START.
