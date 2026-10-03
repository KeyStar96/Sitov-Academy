# Sitov Academy Verbtrainer – Datenquellen und Pflege

Der Katalog enthält alle 960 unterschiedlichen Einträge aus den bereitgestellten Dateien `Verben_A1-B1_nach_Niveaus.txt` und `Verben_B2_C1_nur_Infinitive.txt`. Einträge behalten ihr erstes Einführungsniveau. Reflexive Verben und feste Mehrwortverbindungen bleiben eigenständige Einträge. B2 und C1 enthalten nach der niveauübergreifenden Dublettenbereinigung jeweils 187 erstmals eingeführte Verben.

Die Dateien in `source/` bilden die offline verfügbare Autorengrundlage:

- `pool.json`: Reihenfolge, Infinitive und erste Einführungsniveaus aus den beiden Listen.
- `lexicon.json`: benötigte Auszüge aus `german-verbs-dict` 3.4.0, dem Morphy-/LanguageTool-Lexikon. Keine Laufzeitabhängigkeit und keine Netzwerkanfragen beim Trainieren oder beim Bauen.
- `translations.json`: kurze Bedeutungsangaben für Deutsch, Englisch, Russisch, Ukrainisch und Türkisch. Englische Bedeutungen wurden für den gesamten Pool redaktionell formuliert. Die drei weiteren Übersetzungen wurden mit Übersetzungshilfe vorbefüllt, vollständig gesichtet und bei Bedeutungsverwechslungen, nicht passenden Wortarten und Formulierungsfehlern korrigiert. Vorhandene geprüfte Vokabelübersetzungen wurden übernommen, ohne Lernstände der Trainer zu verbinden.

`scripts/build-sitov-verb-catalog.cjs` erstellt `catalog-data.json` reproduzierbar aus diesen Dateien. Der Aufbau enthält bewusst eigene Korrekturen für moderne Rechtschreibung, die tatsächliche Trennbarkeit, verschachtelte Partikeln, Hilfsverben, regionale Varianten, Reflexivpronomen und unterschiedliche Bedeutungen. Historische Schreibungen und falsche Trennungen der Ausgangsdaten werden nicht als gültige Antworten übernommen. Neue Korrekturen gehören in die Quelldateien bzw. in die kommentierten Regeln des Builders.

```sh
node scripts/build-sitov-verb-catalog.cjs
node scripts/build-sitov-verb-catalog.cjs --check
npx jest __tests__/sitov-verb-engine.test.ts --runInBand
```

296 Verben besitzen zusätzlich redaktionelle Satzkontexte. Andere Verben nutzen die direkten Formenaufgaben, damit keine bedeutungsarmen oder grammatisch unvollständigen Sätze aus beliebigen Infinitiven entstehen. `sich blicken lassen` verwendet im Perfekt den Ersatzinfinitiv; `geboren werden` das Passiv mit `worden`. Bei `hängen` trainiert der Katalog den Zustand `hing / gehangen`, um Formen der Handlung `hängte / gehängt` nicht mit deren Hilfsverben zu vermischen. `übersetzen`, `umfahren`, `überspringen`, `übertreten` und `übergehen` sind auf die in der Übersetzung angegebene Bedeutung begrenzt.

## Herkunft und Lizenz der morphologischen Daten

Die morphologischen Auszüge und daraus abgeleiteten Katalogdaten stehen unter [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Der vollständige Lizenztext ist in `DATA-LICENSE.txt` enthalten. Die Anwendungslogik des Trainers ist davon getrennt.

Urheber und Quellen: Wolfgang Lezius, [Morphy](http://morphy.wolfganglezius.de/); Erweiterungen durch [korrekturen.de/flexion](https://www.korrekturen.de/flexion/); [LanguageTool german-pos-dict](https://github.com/languagetool-org/german-pos-dict); Konvertierung und Veröffentlichung als `german-verbs-dict` durch Ludan Stoecklé / [RosaeNLG](https://github.com/RosaeNLG/rosaenlg). Änderungen durch Sitov Academy: Auswahl des Pools, Niveauzuordnung, Rechtschreibkorrekturen, Trennbarkeit, Bedeutungsauswahl, Formenvarianten, Satzkontexte und Übersetzungen. Die Quellen liefern ihre Daten ohne Gewährleistung.

## Primärquellen für Zweifelsfälle

- [IDS: Perfekt der Modalverben und Ersatzinfinitiv](https://grammis.ids-mannheim.de/fragen/99)
- [IDS: haben oder sein?](https://grammis.ids-mannheim.de/fragen/86)
- [Duden: hängen als Zustand](https://www.duden.de/rechtschreibung/haengen_gehangen)
- [Duden: heilen, unterschiedliche Hilfsverben](https://www.duden.de/rechtschreibung/heilen)
- [Duden: angehen, Bedeutungen und Hilfsverben](https://www.duden.de/rechtschreibung/angehen)
- [Duden: trocknen mit haben oder sein](https://www.duden.de/sprachwissen/sprachratgeber/Trocken-getrennt-oder-zusammen-gro%C3%9F-oder-klein-haben-oder-sein)
- [Duden: wandern](https://www.duden.de/konjugation/wandern), [vorkommen](https://www.duden.de/rechtschreibung/vorkommen), [abbiegen](https://www.duden.de/rechtschreibung/abbiegen), [flitzen](https://www.duden.de/rechtschreibung/flitzen), [hasten](https://www.duden.de/rechtschreibung/hasten), [jetten](https://www.duden.de/rechtschreibung/jetten), [flanieren](https://www.duden.de/rechtschreibung/flanieren), [missgönnen](https://www.duden.de/rechtschreibung/missgoennen), [platzen](https://www.duden.de/rechtschreibung/platzen_zerspringen), [verzweifeln](https://www.duden.de/rechtschreibung/verzweifeln).
