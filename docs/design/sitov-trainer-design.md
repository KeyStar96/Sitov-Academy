# Sitov Academy: gemeinsame Trainerregeln

Stand: 3. Oktober 2026. Diese Regeln gelten für neue und überarbeitete Lernoberflächen.

1. **Mobile zuerst.** Inhalte beginnen bei 320 Pixeln ohne horizontalen Seitenlauf. Touchziele sind mindestens 48 Pixel hoch, Aufgaben bleiben gut lesbar. Tablet und Desktop erweitern die Anordnung.
2. **Ein Rahmen.** Sitov-Kopfzeile, Brotkrumen, fünfteiliger Modus-Dock und mobile Navigation bleiben auch beim Üben erhalten. `LearningScreen` verwendet standardmäßig Dokumentfluss; Vollbild muss ausdrücklich gewählt werden. Keine festen Aufgabenflächen innerhalb transformierter Trainerübergänge und keine globale Scrollsperre beim normalen Üben.
3. **Bewusster Einstieg.** Ein Moduswechsel öffnet die Übersicht. Ein vorhandener Lernpfad-/Grammatikstand wird über eine sichtbare Fortsetzen-Aktion geöffnet. Gespeicherte IDs, Antworten und Warteschlangen bleiben erhalten.
4. **Kartenhierarchie.** Ein eigener Rahmen umfasst Titel, Status und Inhalt. Die primäre Kartenaktion steht unter dem Inhalt; ein Navigationsbutton konkurriert nicht mit der Überschrift. Trainerkarten haben gemeinsame Maße und Modusfarben.
5. **Direkte Handlung.** Wenn eine prominent animierte Fläche zum Start einlädt, ist die ganze Fläche per Berührung und Tastatur bedienbar. Der Verbtrainer-Hero startet dieselbe adaptive Runde wie der Startbutton. Keine verschachtelten Buttons.
6. **Funktionale Bewegung.** Druckfeedback, wandernde Auswahl, sanfter Auftritt und Wortblase verdeutlichen Zustandswechsel. Dekoration verwendet eigene Motive; keine fremden Marken, Assets oder kopierten Oberflächen. `prefers-reduced-motion` und hoher Kontrast bleiben vollständig bedienbar.
7. **Darstellung.** Hell/Dunkel besitzen animierte Miniaturvorschauen; Kontrast bleibt unabhängig. Mobil liegt das Fenster innerhalb des sichtbaren Viewports. Portal, Escape, Außenklick, Fokus und Systempräferenz funktionieren auch in scrollenden Menüs.
8. **Vorlesen.** Deutsch verwendet ausschließlich den gemeinsamen Adapter mit `de_DE-thorsten-high`. Wiedereinstieg ist ausdrücklich sichtbar; Pause, Fortsetzen und Neustart sind getrennte Handlungen. Wortbedeutungen werden aus lokalen Quellen in der Interface-Sprache geladen; fehlende Bedeutungen werden klar benannt.
9. **Lernbereitschaft.** Die logische Aussprachefreischaltung verlangt nachgewiesene Vokabel-, Grammatik- und Verbkompetenz sowie Textabdeckung. Lehrkräfte können je Schüler und Niveau hart freischalten. Zugriff wird serverseitig geprüft; UI-Zustand ist keine Berechtigung.

Entwicklungsvorschau für Rahmen und Darstellung: `/{lang}/sitov-preview/trainer-frame`; ausschließlich in Entwicklung erreichbar.
