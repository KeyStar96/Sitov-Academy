# Sitov Academy · S7 · Epoche 7 · S4-Kandidatenprüfung

Exakter Stand: `cc89aa431d3d7800a03ed86d66040ecbb191ad14`. Abschluss: 2026-10-09T21:05:08.715614+00:00.

235 Kandidatenaufgaben mit 705 Optionen vollständig gelesen; alle 38 Ersatzformen einzeln akzeptiert. 24 Quelltexte und 96 Kernkontexte mit je sechs Teilfertigkeiten gelesen. 272 originale Aliasdeltas entsprechen exakt den vorgeschlagenen Textänderungen; zwei davon haben bereits veraltete before-Werte.

231 Aufgaben redaktionell unverändert akzeptabel. Zwei bereits von M reparierte Aufgaben ausschließen; zwei weitere Aufgaben benötigen die konkret vorgeschlagenen Präzisierungen. Keine Publikationsfreigabe.

## sitov.audit.S7.e7.001 · stale_patch_and_alias_before

Die zwei im Auftrag als ausgeschlossen bezeichneten Aufgaben stehen tatsächlich in patches[124] und patches[162]. Beide before-Prompts/Begründungen sind gegenüber dem eingefrorenen aktuellen Stand veraltet. Ihre beiden Alias-before-Werte sind ebenfalls veraltet.

Beide vollständigen Patches und ihre zwei Prompt-Aliasdeltas ausschließen. Aktuelle M-Prompts und M-Begründungen exakt erhalten. Keine alte Begründung zurückkopieren.

Betroffen: sitov.pretest.b11-01.nominal.q2, sitov.pretest.b11-04.verbs.q3

## sitov.audit.S7.e7.002 · full_definition_snapshots_would_regress_13_repairs

S4 basiert auf fd14abbe. Die oldDefinition/candidateDefinition-Vollobjekte enthalten 13 ältere B1.1-Aufgabenstände. Elf davon sind gar nicht Teil der 235 Patches. Das Übernehmen ganzer Kandidatendefinitionen würde bereits integrierte Terminologie-, Wortlaut- und Optionsreparaturen zurücksetzen.

Nur einzeln geprüfte Feld-/Aufgabenpatches gegen den jeweils aktuellen Stand anwenden. Alle 13 aktuellen Aufgaben erhalten; anschließend neue Gesamtdefinition/-hashes aus dem tatsächlichen Ergebnis bilden. Audio-Seed-Hash ist ebenfalls gegenüber dem Artefakt fortgeschritten.

Betroffen: sitov.pretest.b11-01.verbs.q6, sitov.pretest.b11-01.nominal.q2, sitov.pretest.b11-02.verbs.q3, sitov.pretest.b11-03.verbs.q3, sitov.pretest.b11-04.verbs.q3, sitov.pretest.b11-05.verbs.q2, sitov.pretest.b11-06.words.q4, sitov.pretest.b11-06.verbs.q5, sitov.pretest.b11-07.verbs.q5, sitov.pretest.b11-08.words.q4, sitov.pretest.b11-08.verbs.q2, sitov.pretest.b11-09.verbs.q5, sitov.pretest.b11-10.verbs.q3

## sitov.audit.S7.e7.003 · public_flexion_constraint_needed

Wenig ist keine erfundene Form und kann unflektiert vor Mengen- und Pluralbezeichnungen auftreten. Die sichtbare Bedingung kleine Anzahl grenzt die verlangte flektierte Form nicht ausdrücklich ab. Die beabsichtigte Lösung wenige ist korrekt; eine robuste Aufgabe nennt die verlangte Pluralendung statt eine unflektierte Variante pauschal als Sprachfehler zu behandeln.

Prompt auf die Form mit Pluralendung eingrenzen; Schlüssel, Optionen, Quelle und Teilfertigkeit behalten. Private Begründung entsprechend präzisieren.

Betroffen: sitov.pretest.a22-05.nominal.q3

## sitov.audit.S7.e7.004 · pending_lexical_distractor_choice

Übergelegen ist im Denk-Kontext keine passende Partizipform des schwachen, untrennbaren Verbs überlegen. Überlegt ist eindeutig richtig. Daraus folgt keine globale Nichtexistenz des Wortes übergelegen. Für das Ziel echter, in diesem Kontext klar unpassender Formen ist überlegte als reguläre finite Präteritumform des Zielverbs geeignet.

Zusätzlich Option a übergelegen → überlegte, rationaleDe auf den Unterschied Partizip/finite Präteritumform beziehen; einen zusätzlichen Options-Aliasdelta aufnehmen. Keine Kern-/Equivalence-Änderung behaupten oder erfinden.

Betroffen: sitov.pretest.a22-10.verbs.q4

## Konkrete Zusatzreparaturen

a22-05.nominal.q3: „Welche Form von »wenig« mit einer Pluralendung passt zwischen »Ich lerne nur« und »Wörter«, wenn die Anzahl klein ist?“ Die Begründung muss dieselbe sichtbare Flexionsvorgabe erklären.

a22-10.verbs.q4: Option a „übergelegen“ → „überlegte“. Überlegt ist das Partizip des Denk-Verbs; überlegte ist eine reale finite Präteritumform. Die passende Begründung und der zusätzliche Optionsalias stehen im JSON.

Nach Ausschluss der zwei M-Aufgaben und mit diesen zwei Reparaturen enthält der konkrete private Vorschlag 233 Aufgaben, 232 Promptdeltas, 39 Optionsdeltas und 271 Aliasse. Schlüssel, IDs, Quellkörper, Units und Equivalence-Keys bleiben erhalten; empirische Gleichwertigkeit und Schwierigkeit sind nicht bestätigt.

Die 235 Patches betreffen tatsächlich nur Pools 31–48; Pools 49–54 bleiben ohne Änderungen. Die 13 veralteten Vollobjekte dürfen nicht übernommen werden. Vollständige Original-/Aktuell-/Kandidatenbelege, alle 38 Ersatzformen, alle Aliasse und der konkrete rebased Vorschlag stehen in epoch7-review.json.

Keine Produkt-, DB-, Audio-, QA- oder Git-Änderungen. Keine Humanprüfung, Audioanhörung oder Kalibrierung. M prüft vor Anwendung den dann aktuellen Stand und erhält parallele B1.2-Reparaturen.
