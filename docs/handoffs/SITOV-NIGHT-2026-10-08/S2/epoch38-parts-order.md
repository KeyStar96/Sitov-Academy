# S2 · Epoch 38 · Telefon E10 Satzteilreihenfolge

Basis: `71a46311fd1e9d157d3195a4c3185dceafcaccba`.

Der Builder unterstützt optional `sitovPartsOrder` für Satzbauaufgaben. Die Liste muss eine exakte Permutation der verfassten Satzteile sein; wiederholte Teile werden nach ihrer Häufigkeit geprüft. Ungültige Typen, Lücken, zusätzliche oder andere Teile lösen einen lokalisierten `SeedBuildError` aus. Ohne Angabe bleibt der bisherige Hash-Shuffle einschließlich Rotation unverändert. Eine gültige Angabe wird kopiert und wörtlich verwendet.

Einzige Inhaltsquellenänderung: A2.1/P4-N8-E10, ID `7b824e7d-b6ca-558e-ae23-5fd263931892`, erhält `[mich, durchstellen, zu Herrn Weber, Sie, Können]`. Der Schlüssel `Können Sie mich zu Herrn Weber durchstellen?` und seine einzige akzeptierte Antwort bleiben unverändert.

Validierung: 31/31 gezielte Node-Tests; alle neun nativen Niveaus bytegleich zu ihren gespeicherten Seeds. Alle zehn Seed-Dateien mit 9.569 Aufgaben bleiben bytegleich zur Basis und erfüllen das Schema. Der vollständige Vergleich aller 8.800 nativen Quellaufgaben und sämtlicher Elternmetadaten findet ausschließlich die eine freigegebene Eigenschaft. Alter und neuer Builder liefern auf sämtlichen unveränderten Ausgangsquellen identische Ergebnisse. ESLint: 0 Fehler/0 Warnungen; `git diff --check`: PASS.

Die 161 autorisierten Änderungen aus Epoch 37 sind vollständig erhalten. Keine Seed-, ID-, Schlüssel-, Optionen-, weiteren Satzteil-, Audio- oder Laufzeitänderungen. Kein DB-/SSH-/API-/Modell-/Import-/Push-/Deploy-Schritt. Der zuvor isolierte A2.1-E10-Paritäts-HOLD ist behoben. Integration bleibt bei M.

Die bestehende Testsuite liegt tatsächlich in `scripts/build-path-seed.test.mjs`; sie wurde unverändert mit ausgeführt. Neue Vertragsprüfungen liegen im ausdrücklich freigegebenen `scripts/lib/path-seed-builder.test.mjs`.

Private Belege: `S2/epoch38-validation.json`, `S2/epoch38-proof.mjs`, `S2/epoch38-tests.log`, `S2/epoch38-eslint.log`; öffentliche Zusammenfassung in `epoch38-parts-order-proof.json`.
