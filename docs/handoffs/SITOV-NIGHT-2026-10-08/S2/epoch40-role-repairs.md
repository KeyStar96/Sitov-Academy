# S2 · Epoch 40 · Exakte Rollen-Vorschläge und A2.2-Elternbeispiel

Basis: `e40cca1a9ca2f144d8fb50c3bb86ff4643de89f9`. S7 Epoch 19 ist bytegebunden an SHA256 `e0ca609fa5743ac4f219496e7aee8d2575a4dcc53dcbea6f6f4e6af2b522fe1c`; S4 Epoch 39 an `402966b9459360ae8c539d20a9b2b27158ed04661f576bde4d58161bfb19b746`.

Alle 30 vollständigen Aufgabenvorschläge wurden vor der Änderung gegen tatsächliche Ausgangsobjekte, Elternkontexte, Quellbytes und die explizite sortierte kompakte JSON-Hashkonvention geprüft. Übernahme ausschließlich über die gebundenen Skalarpfade; ursprüngliche Objektschlüsselreihenfolge und Optionspositionen bleiben erhalten. Dazu vier S7-Elternbeispiel-Skalare sowie S4s einziges A2.2/P1-N10-Elternbeispiel „Eva hat keine Zeit. Sie kommt trotzdem mit.“ → „Emil hat keine Zeit. Er kommt trotzdem mit.“.

Tatsächliche geänderte Quellen: `supabase/seeds/path-a1.1.json`, `supabase/seeds/path-a2.2.json`, `supabase/seeds/path-src/a2.2/p1.mjs`. Der native Beispielpfad wurde von M vor der Änderung atomar freigegeben. `index.mjs` unverändert. A1.1 besitzt keinen separaten Autoren-Builder; sein Seed ist die native Quelle.

Umfang: exakt 226 Seed-Skalare, 30 Aufgaben, vier Elternkarten, 15 betroffene Knoten. Vollständiger Vergleich aller 9.569 Aufgaben und 856 Knoten; alle IDs, Typen, Lernziele, Reihenfolgen, Satzteile und Kartenbezüge erhalten. Alle nicht zugewiesenen Aufgaben, Elternmetadaten und akzeptierten Antworten exakt; acht andere Seed-Dateien bytegleich. Von 128 nativen Autorendateien verändert sich ausschließlich das eine Beispiel im A2.2/p1.mjs; alle übrigen Bytes exakt. Die 16 bestehenden gezielten Builder-Tests bestehen einschließlich bytegleicher Parität aller neun nativen Autoren-Niveaus. Alle zehn Seeds mit 9.569 Aufgaben erfüllen das Schema. ESLint 0 Fehler/0 Warnungen; Diff-Prüfung PASS.

Neun ausdrücklich freigegebene Antwortwortrevisionen, jeweils genau eine alte und eine neue akzeptierte Antwort, unveränderter korrekter Optionsrang (nullbasiert):

- P1-N1-E01: „Guten Morgen, Frau Kaya!“ → „Guten Morgen, Herr Kaya!“; Rang 1.
- P1-N3-E03: „Frau Kaya, das ist Jonas.“ → „Herr Kaya, das ist Jonas.“; Rang 2.
- P1-N8-E05: „Guten Tag, ist Frau Lindner da?“ → „Guten Tag, ist Herr Lindner da?“; Rang 1.
- P1-N11-E07: „Guten Tag, Frau Lindner!“ → „Guten Tag, Herr Lindner!“; Rang 0.
- P1-N11-E08: „Auf Wiedersehen, Frau Roth!“ → „Auf Wiedersehen, Herr Roth!“; Rang 0.
- P1-N11-E17: „Woher kommen Sie, Frau Kaya?“ → „Woher kommen Sie, Herr Kaya?“; Rang 2.
- P6-N12-E04: „Sie trifft ihre Freundinnen.“ → „Er trifft seine Freunde.“; Rang 0.
- P6-N12-E05: „Nein, sie sieht nicht gern fern.“ → „Nein, er sieht nicht gern fern.“; Rang 0.
- P6-N12-E06: „Frau Nowak fährt oft Fahrrad.“ → „Herr Nowak fährt oft Fahrrad.“; Rang 2.

Die alten Schlüssel werden vollständig in `S2/epoch40-old-new-full.json` erhalten. Sie sind geändert und dürfen nicht als unverändert ausgewiesen werden. M muss tatsächliche historische Antworten und Fortschritte über Migration 114 archivieren und den Revisionsnachweis binden, bevor diese neuen kanonischen Wörter übernommen werden. Keine Datenbankoperation durch S2.

P7-N10-E06 `865b2066-c43c-5e3f-a837-e7f5559335d9` bleibt als vollständiges Objekt exakt: SHA256 `f355ffca2da120f12185e7315afde30b4cdfcf11f0a116e5048ffd60252f7846`. M behält diese fachlich notwendige feminine Anredeform „Liebe“ ausdrücklich bei; die präzise HOLD-Auflösung und Hashbindung liegen bei M. Kein Liebe→Lieber- oder Lernzielwechsel. Alle weiteren grammatisch notwendigen femininen Formen bleiben gemäß S7 erhalten.

Beide tatsächlichen Audio-Extraktoren wurden auf sämtlichen 9.569 alten/neuen Aufgaben verglichen. Die 30 geänderten Aufgaben liefern 41 finale kanonische Aliase; genau 27 Alias-Payloads in 27 Aufgaben ändern sich. Vollständige alte/neue Texte, SHA256, originale adoption33-Aliasidentitäten und path-seed-Ursprünge stehen privat in `S2/epoch40-final-canonical-audio.json`; alle nicht zugewiesenen Payloads exakt. Lokale Vorbereitung und Wortzeitprüfung sämtlicher 27 geänderter Aufnahmen sowie Import vor Veröffentlichung bleiben bei M. Menschliche Hörprüfung: false.

Vollständige alte/neue Aufgaben, Eltern, alle 15 betroffenen Knoten und 226 Skalarbindungen: `S2/epoch40-old-new-full.json`. Unabhängiger Gesamtobjektvergleich und 128 Autoren-Dateihashes: `S2/epoch40-independent-proof.json`. Größen und Prüfsummen stehen in `epoch40-role-repairs-proof.json` und `S2/epoch40-validation.json`.

Keine weiteren Rollen-/Grammatikkorrekturen, neuen Fragen, UI-/Laufzeit-/Test-/M-Dokumentänderungen. Keine DB-, SSH-, API-, Modell-, Audio-Synthese-, Import-, Veröffentlichungs-, Push- oder Deploy-Aktion. Unabhängige Nachprüfung und Integration bleiben bei M. S2 wartet nach dem Commit auf einen frischen START.
