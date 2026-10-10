# Sitov Academy: technisch vorbereitetes Audio-Paket

Stand: 10. Oktober 2026, 01:54 UTC. Dies ist ein lokaler, unveröffentlichter Zwischenstand.

Das Paket enthält 4.825 ausgewählte deutsche Aufnahmen: 4.680 für die aktuellen Aussprache-Vortests und 145 für geänderte Lernpfad-Aliasse. Alle MP3-Bytes, die endgültigen Metadaten und die Wortzeitmarken wurden erneut gelesen und gebunden. Das tatsächliche Importwerkzeug hat das fertige Paket zweimal lokal vollständig validiert. Es wurde nichts hochgeladen, importiert oder veröffentlicht.

Die Auswahl übernimmt die bereits nachgewiesenen vollständigen MP3-Decodierungen mit 24 kHz, einem Kanal und 48 kbit/s ausschließlich bei unveränderten Audio-, Quellmetadaten- und Wortzeitmarken-Hashes. Jeder Wortzeitpunkt liegt innerhalb der tatsächlich decodierten Dauer; lexikalische Wörter haben positive Dauer. Bei 143 Dateien wurden die unabhängig technisch geprüften abgeleiteten Wortzeitmarken in die endgültigen Metadaten übertragen. Bei 3.843 Quellmetadaten wurde die Cache-Adresse auf die vom aktuellen gemeinsamen Adapter berechnete Adresse berichtigt. Die MP3-Bytes und das festgelegte männliche Qwen-Profil blieben erhalten. Lokale Dateipfade werden nicht als zusätzliche Storage-Metadaten übernommen.

Es gibt 386 ausgewählte Dateien mit bereits vorhandenen identischen Produktions-MP3-Bytes. Vier davon benötigen weiterhin den gesonderten, kontrollierten Metadaten-CAS für `empfiehlt`, `gab`, `gut` und `dürft`; ein gewöhnlicher unveränderlicher Upload darf diesen Schritt nicht ersetzen. Es gibt keine ausgewählte Kollision mit abweichenden Produktions-MP3-Bytes.

Die Auswahl hält weiterhin 73 Texte zurück: elf Vortest-Texte und 62 Lernpfad-Texte. ASR-Übereinstimmung und technische Validierung sind kein Hörnachweis. Die sieben versionierten Reparaturvarianten und die zurückgehaltenen Aussprachefälle benötigen weiterhin die unabhängige Hörprüfung nach `docs/audio-authoring.md`. Das Paket setzt ausdrücklich `humanListening=false`, `publicationApproved=false` und `technicalDraft=true`.

Private Nachweise im gemeinsamen Koordinationsverzeichnis:

- `master/M-final-selected4825-bundle-draft-v1-private.json`: endgültige Metadaten- und Aliasbindungen, technische Auswahl und zurückgehaltene Texte.
- `master/M-selected-audio-actual-decode-technical-v3-private.json`: 4.825 technische PASS, null Fehler; Byte-SHA256 `125cfe8e85aca657a7968cabcc10bc1bf27f62525298c442b8c8722a8c34e240`.
- Fertiges `sitov-audio-bundle.json`: Byte-SHA256 `5f16347684e0ff240f47dd5491bab63b0fc45242d08c721955aaada7518ad6f9`.
- Auswahl Vortests v6: Byte-SHA256 `19292ecfc538cd84fe9ee1a5b77f2751855377745eef5433141e6ae09727bc6b`.
- Auswahl Lernpfad 207 v1: Byte-SHA256 `facb3b24949faa2490cec226b4b44eb9ea645565495edd054c01c8df56ac5efb`.

Neue Quellkorrekturen nach diesem Zeitpunkt benötigen einen separaten Delta-Lauf; dieses Paket wird nicht still überschrieben. Die vollständige Inhaltsfreigabe, Hörprüfung, vier Metadaten-CAS, aktuelles QA-End-to-End und die belegte Produktionsmigration samt Bestandsschutz bleiben Deployment-Voraussetzungen.
