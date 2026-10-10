# Sitov Academy – S4 Epoch47

**Aufnahmeaktion im normalen Seitenfluss implementiert; echte Browserabnahme durch S5 steht aus.** Die vorhandene Aufnahme-Karte steht direkt nach Lesetext und Referenz-Audio. Der feste mobile Startbutton wird im Studio nicht mehr aktiviert. Start, Stopp, Rückmeldung, Anhören und Einreichen verwenden dieselbe bestehende Recorder-Logik.

Basis `354b4c8dbd4839e84a523100c69c28fc3156c7c0`. Ausgangsbeleg: S5-Commit `ab9756de6cb04c43d9dd41b4a92360d3dd2d1cd6`, `epoch34-en390-stationary-middle.png/.json`: EN390dark,900ms stationär, scrollTop1649.5, Button x82.29/y676/225.42×68 über zwei Textzeilen. Screenshot selbst angesehen. Kein Fokusfehler behauptet.

Änderungen: Studio entfernt ausschließlich mobileFloating bei der Recorder-Verwendung. AudioRecorder erhält einen Testselektor für die vorhandene Karte; eine nachweislich falsche historische Überdeckungsbehauptung im Kommentar entfällt. Komponenten-CSS, deutsche Inhalte, Audios, Versionen, Server-/Uploadlogik und alle fünf Sprachfassungen bleiben unverändert. Bestehende Motion-/Reduced-Motion-Regeln gelten für die vorhandene Karte.

Die beiden vorhandenen Browserprüfungen prüfen tatsächliche Rechtecke mitten im stationären Lesetext. Der mobile Test umfasst320/390/1440px, mindestens56px Ziele, horizontale Begrenzung und Mikrofonfehler; im Navigationstest wurde ausschließlich der obsolete Aufnahme-Dock-Block angepasst. Keine Fixtures geändert.

Nachweise: sechs bestehende Recorder-Tests in zwei Suites bestanden. ESLint der vier geänderten TS/TSX-Dateien ohne Fehler. TypeScript --noEmit bestand auch nach der letzten Navigationsteständerung. Git-Diffprüfung vor Sicherung ohne Fehler. Browserprüfungen wurden geschrieben, nicht ausgeführt.

M integriert; S5 prüft anschließend reale Layout-/Klickzustände, Tastatur/Touch,200% Text, Hell/Dunkel/Kontrast, reduzierte Bewegung und alle fünf Interface-Sprachen. Keine neue Nachher-Aufnahme und keine Browserfreigabe behauptet. Kein Build, Serverneustart, DB-/SSH-/Audiojob oder Deployment.

Keine Migration erforderlich. Rückweg: die zwei UI-Dateien und zwei bestehenden Teständerungen dieses Commits gemeinsam zurücknehmen. Keine Lernstände oder Aufnahmen verändert.
