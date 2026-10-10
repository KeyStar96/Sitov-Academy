# S2 · Epoch 39 · Zwei Karten-HOLDs und zwei Audio-Platzhalter

Basis: `c73be5b6c304739e76b5df7427a97c79bf4ca5d9`. Unabhängige Vorgabe: S7 Epoch 18, SHA256 `276dfffcf5a07799c1fd798064b559a3216d7de94486ba34cd2844e95d69a72e`.

Einzige geänderte Inhaltsquelle: `supabase/seeds/path-a1.1.json`. In diesem Bestand gibt es weder `scripts/path-native/`, `scripts/content/` noch einen A1.1-Autoren-Builder; der A1.1-Seed ist die native Quelle. Kein neuer Generator wurde erfunden. Die neun vorhandenen nativen Autoren-Niveaus wurden separat geprüft.

Genau 27 Skalare:

- P1-N3-E01/E03/E08: je fünf identische gemeinsame Erklärungen enthalten nun das konkrete Beispiel „Das ist Herr Kaya.“ und stimmen mit der vorhandenen Karte überein. Die allgemeine Lehre Frau/Herr bleibt erhalten. Andere weibliche Aufgabenkontexte bleiben gemäß enger Zuweisung für spätere Einheiten bestehen.
- P7-N5: fünf Elternregeltexte auf die reguläre Partizipbildung mit haben zurückgeführt; sie stimmen wieder mit der ersten Aufgabenerklärung überein.
- P7-N7: fünf Elternregeltexte exakt um den S7-Zusatz für G4/G5 ergänzt. Position 2 gilt ausdrücklich für Aussagesatz und W-Frage; die Ja-/Nein-Frage beginnt mit dem Hilfsverb. Aufgaben-Erklärungen und alle Beispiele unverändert.
- P5-N2-E06 `e42167d3-36c4-5270-a696-406897292843` und P6-N5-E01 `c0ae363d-6c1f-58a7-a381-b7e206815e1f`: ausschließlich `content.question`-Platzhalter … → ___. Beide vorhandenen Audio-Extraktoren bilden nun den vollständigen Lösungssatz; Laufzeitcode unverändert.

Vollständiger Vergleich aller 9.569 Aufgaben und 856 Knoten: genau fünf Aufgaben und zwei Elternkarten in fünf Knoten geändert; alle übrigen Aufgaben und Elternmetadaten exakt. IDs, Lernziele, Kartenbezüge, Schlüssel, akzeptierte Antworten, Optionen/Ränge, Satzteile, Beispiele und Fortschrittsidentitäten unverändert. Alle neun anderen Seed-Dateien bytegleich. Alle 9.569 Aufgaben erfüllen das Schema. 16/16 bestehende gezielte Builder-Tests bestehen, einschließlich bytegleicher Parität aller neun vorhandenen nativen Niveaus. `git diff --check` besteht. Keine Änderung ausführbaren Codes, daher kein neuer ESLint-Codeprüfumfang.

Beide tatsächlichen Audio-Extraktoren wurden für alle 9.569 alten und neuen Aufgaben verglichen. Exakt zwei Alias-Payloads ändern sich; ihre Identitäten bleiben:

- `sitov-path-adoption-33:e42167d3-36c4-5270-a696-406897292843:0`: Es ist 8:59. Oleh sagt: „Es ist gleich neun.“
- `sitov-path-adoption-33:c0ae363d-6c1f-58a7-a381-b7e206815e1f:0`: Oleh fährt immer Bus. Er hat kein Fahrrad.

M muss die überflüssigen P1-N3-/P7-N5-Ausnahmen in seinen Regressionsbindungen entfernen und die eng gebundene P7-N7-Eltern-/Erklärungs-Ausnahme ergänzen. Diese M-Dateien und uncommittierte Root-Änderungen wurden nicht übernommen. Unabhängige Nachprüfung sowie lokale Vorbereitung, Wortzeitprüfung und Import der zwei deutschen Audio-Payloads bleiben bei M; menschliche Hörprüfung: false. Keine DB-, SSH-, API-, Modell-, Audio-Synthese-, Import-, Push-, Veröffentlichungs- oder Deploy-Aktion.

Vollständige alte/neue Aufgaben, Eltern und betroffene Knoten sowie gebundener Skalarvergleich liegen privat in `S2/epoch39-old-new-full.json`. Audio-Gesamtvergleich: `S2/epoch39-final-canonical-audio.json`. Bindungsnachweis: `S2/epoch39-independent-proof.json`. Hashes, Größen und Prüfergebnisse stehen in `epoch39-card-audio-proof.json` und `S2/epoch39-validation.json`.
