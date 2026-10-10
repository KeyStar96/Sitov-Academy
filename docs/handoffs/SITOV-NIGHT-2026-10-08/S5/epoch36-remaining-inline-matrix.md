# S5 epoch36 — restliche Inline-Matrix und offener Fokus-Ausreißer

Basis a9e6ab459b908f1212615e88bc17a706f2744b1f; geprüfter Produktionsbuild eed9cc8fb28634753ba1a45e4cdaf37429c2c31f / BUILD_ID y6jNTwXmEGFKxEVq8szt1, Port3143/PID24063 gemäß M-Metadaten. Selbst geprüft: App-Diff zur zugewiesenen Basis exit0. Keine Produktänderung.

Derselbe retained Schüler und derselbe tatsächliche PASS aus epoch33 wurden über normalen Login wiederverwendet. Kein neuer Actor, kein neuer Versuch/Retake. Gemäß ausdrücklicher M-Anweisung kein wiederholter Voll188-Baseline: epoch35 bleibt gebunden; initial/final wurden ausschließlich eigene Zeilen/Hashes und Runtime-Guards geprüft. Keine unsichere globale UNION-/Aggregate-Abfrage.

Die vorgesehenen EN320 und EN1440 Fälle zeigen keine Überschneidung des Aufnahmebuttons mit den40 deutschen Wortbuttons und keinen horizontalen Überlauf. Native Tab/PageUp sowie Aufnahme-Tab-Fokus wurden nach900ms geprüft. Die Karte folgt Text und Audio, der Aufnahmebutton ist enabled und per Tastatur erreichbar. Die maßgeblichen Fokus-/Lese-/Aufnahme-Screenshots wurden visuell geprüft. Mikrofon, tatsächliche Aufnahmeaktivierung und physisches Hören wurden nicht getestet.

UK und TR wurden jeweils durch die normale Profil-Sprachauswahl und sichtbare Speichern-Aktion gesetzt; die folgende Profilroute bestätigte die Sprache. Sprach-Speichern meldete im CUA-Aufruf einen Deadlinefehler, während das Formular bereits disabled war; keine blinde Wiederholung, stattdessen erfolgreiche Sprachroute abgewartet. Deutsche Texttitel, Lesetext und Aussprachefokus bleiben unverändert. Read-only DOM belegt15 gezielte lang=de/translate=no-Bereiche; äußerer Rahmen uk bzw.tr. UK390dark, UK390light/high, TR390light/high und TR390dark wurden mit lokalisiertem Audio-/Aufnahmefokus geprüft. Das ist eine begrenzte Fallmatrix, kein vollständiges Kreuzprodukt aller Größen/Sprachen/Themes.

## Offener Befund: einmalig verdeckter Rückwärts-Tab-Fokus

TR390/light/high: Der erste Aufnahme-Fokus nach locator-Tab→Help und nativem Shift+Tab lag nach900ms bei x37/y771.75/316×72, ScrollTop2532. Screenshot epoch36-tr390-light-contrast-record.png zeigt den Button hinter der unteren Navigation. Dieser Befund bleibt erhalten; er darf nicht als PASS gezählt werden.

Unabhängige Vorwärtsfolge ab Listen→Repeat→From start→Speed→Record zeigte den Aufnahmebutton frei bei y431.75, ScrollTop2870 (epoch36-tr390-forward-tab-record.png). Die direkte Wiederholung derselben Rückwärtsfolge zeigte ihn frei bei y433.75, ScrollTop2868 (epoch36-tr390-reverse-tab-repeat.png). Damit ist der erste Ausreißer noch nicht zuverlässig reproduziert oder erklärt. M sollte eine gezielte Nachprüfung zuweisen; keine Produktursache oder Reparatur behauptet.

## Tatsächliche Geometriefälle

Jede Zeile ist eine gemessene Beobachtung nach900ms, einschließlich des offenen Ausreißers. Aufnahme-Wortüberschneidungen beziehen sich auf alle40 Wortbuttons, nicht auf Navigationsüberlagerungen.

| Fall | Viewport/Scrollbreite | Aktives Element | Aufnahme-Wortüberschneidungen |
| --- | --- | --- | --- |
| EN320darkTab900ms | 320/320 | Repeat slowly | 0 |
| EN320darkPageUp900ms | 320/320 | Repeat slowly | 0 |
| EN320darkInlineEnd900ms | 320/320 | Help | 0 |
| EN320darkRecordFocus900ms | 320/320 | Start recording | 0 |
| EN1440darkTab900ms | 1440/1440 | Repeat slowly | 0 |
| EN1440darkPageUp900ms | 1440/1440 | Repeat slowly | 0 |
| EN1440darkRecordFocus900ms | 1440/1440 | Start recording | 0 |
| EN1440darkReadingMiddle900ms | 1440/1440 | Start recording | 0 |
| UK390darkTab900ms | 390/390 | Повторити повільно | 0 |
| UK390darkRecordFocus900ms | 390/390 | Почати запис | 0 |
| UK390lightHighContrastTab900ms | 390/390 | Повторити повільно | 0 |
| TR390lightHighContrastTab900ms | 390/390 | Yavaş tekrar et | 0 |
| TR390lightHighContrastRecordFocus900ms | 390/390 | Kayda başla | 0 |
| TR390lightHighContrastForwardNativeTabRecord900ms | 390/390 | Kayda başla | 0 |
| TR390lightHighContrastReverseTabRepeat900ms | 390/390 | Kayda başla | 0 |
| TR390darkTab900ms | 390/390 | Yavaş tekrar et | 0 |
| TR390darkForwardRecordFocus900ms | 390/390 | Kayda başla | 0 |

Reduced Motion bleibt UNVERIFIED: reales Mediaquery false, dokumentierte Browser-Fähigkeiten bieten keine authentische Umschaltung; keine Media/CSS/React/OS-Mocks. Browser-Warn-/Fehlerlog leer.

## Erhaltung und Übergabe

Normaler türkischer Logout sichtbar bestätigt auf /tr/login?status=logout_success; eigener Tab geschlossen, Viewport zurückgesetzt. Final nativer Check nach sichtbarer Bestätigung: genau1 passed Versuch und1 PASS; exakte Versuch/PASS-Hashes zur initialen eigenen Prüfung unverändert. Eigene Auth-Identität mit UUID+E-Mail-Guard geprüft; eigener Authuser1, sessions0, refresh_tokens0. Private Authrows verbleiben ausschließlich im privaten Ledger. Health initial/final3×200, genaue960MiB/2CPU, privat ohne veröffentlichte Ports, kein OOM. Final verfügbare RAM-Werte: [2269.3515625, 2265.2890625] MiB. Keine Runtimeänderung, kein Shared-Rate-Reset.

Neuester privater Resume: S5/epoch36-private.json und remote /tmp/sitov-night-20261008-qa-master/s5-epoch36-ledger.json,0600 in0700-Verzeichnis. Aktuell tr/dark/standard. Exakt diesen Actor/PASS erhalten; weder neue Testreihe noch neuer Schüler. Kein Cleanup und kein finaler globaler Vergleich: diese Abschlussoperationen muss M separat zuweisen. Kein Release-ready-Urteil. Offene Restpunkte: Reduced Motion, Rückwärts-Tab-Ausreißer und separat zugewiesener finaler Voll188-Vergleich/Cleanup.
