# Layout- und Audio-Korrekturen vom 10. September 2026

## Registrierung

`EnrollmentTerminal.tsx` nutzt `grid grid-cols-1 items-start` mit einer flexiblen Formularspalte und einer 340/380px-Belegspalte ab Desktop. Der Beleg verwendet `lg:sticky lg:top-8`. Kein JavaScript berechnet seine Position. Vorhandene doppelte Dokument-/Container-Resets und der verzögerte Step-Scroll wurden durch einen einmaligen nativen Dokument-Scroll beim Schrittwechsel ersetzt. Der Summary-Observer läuft nur mobil; `SmoothScroll.tsx` schließt Registrierungsrouten von Lenis aus.

`registration.css` lässt die äußere Grid-Fläche offen. Sehr lange Desktop-Belege begrenzen ihre Höhe auf Viewport minus 64px und scrollen nur die Kurspositionen nativ; Summe und Aktionsbutton bleiben sichtbar. Mobil bleiben Formular und Beleg im normalen Dokumentfluss.

## Header und Footer

`Header.tsx` verwendet dieselbe Reihenfolge Methode → Über mich → Kurse für Desktop und Menü. Theme/Sprache sowie Kursbuchung/Lernraum bilden separate Gruppen mit 16/24px Abstand. Buttons, Dropdown und Theme-Placeholder sind 48px hoch. Unter 640px bleibt der Buchungsbutton in einer eigenen sichtbaren Zeile; unter 1280px liegen Sprach-/Theme-Auswahl und Lernraum im Menü.

`AcademyFooter.tsx` trennt folgende Bereiche in einem responsiven 1/2/4-Spalten-Grid:

- Präsenzunterricht: Freizeitheim Vahrenwald, Vahrenwalder Str. 92, 30165 Hannover.
- Sitz der Sprachschule: Hüttenstraße 24a, 30165 Hannover.
- Kontakt: info@sitov-academy.com und die vorhandene Nummer +49 171 4758620.

Die Bezeichnungen sind in allen fünf Dictionaries vorhanden. Rechtslinks erhalten unten Platz oberhalb der schwebenden Kontakt-Schaltfläche. Die bestehenden Impressums- und Rechtstexte wurden nicht verändert.

## Aussprache nach einem Klick

Die vorherige Lösung bereitete Audio erst vor, wenn nach dem Aufdecken der Hörbutton gemountet war. Auf einen frühen Klick folgte deshalb eine asynchrone Erzeugung und erst danach `play()`; insbesondere Safari konnte die ursprüngliche Freigabe der Nutzergeste verlieren.

`VocabCardSession.tsx` lädt jetzt die aktuelle und nächste Wortkarte bereits vor dem Aufdecken. `lib/audio/neural-client.ts` teilt normalisierte Cache-Schlüssel, fertige URLs und laufende Anfragen. Der Cache ist auf 256 URLs, das Vorladen auf vier Audioquellen und zwei gleichzeitige Hintergrundjobs begrenzt. Veraltete noch wartende Jobs werden entfernt; beim Vorladen wird nichts abgespielt.

`SolutionAudioButton.tsx` startet bei fehlender Quelle im ersten Klick synchron einen kurzen stillen PCM-Clip auf demselben nativen Audioelement. Sobald Quelle und Freigabe bereit sind, wechselt dieses Element zur Aussprache und spielt sie automatisch. Vorhandene Quellen werden direkt im Klick gestartet. Request-Zuordnung und Schlüsselwechsel verhindern verspätete Wiedergaben nach Abbruch, Kartenwechsel oder Unmount. Ein zweiter Klick während des Wartens bricht die Anforderung ab. Explizite Browser-Autoplay-Sperren behalten native Controls als Fallback.

Der Neural-Provider, die Stimmen, die persistente Speicherung und die serverseitige Prüfung von Nutzer, Kursniveau und Wort bleiben erhalten. Eine bislang unbekannte Aufnahme benötigt weiterhin ihre einmalige Synthesezeit; das frühere Vorladen verschiebt sie vor die Höraktion.

## Verifikation

- **795 Jest-Tests in 50 Suites bestanden** (`--runInBand --silent --testPathIgnorePatterns 'integration-real-db|/e2e/'`). Regressionen prüfen Navigation/Adressen in allen fünf Sprachen, verzögerte Wiedergabe nach einer einzigen Geste, Same-Element-Quellenwechsel, Requests/Prefetch-Grenzen, Retry, Abbruch und Kartenwechsel.
- **TypeScript und Produktionsbuild erfolgreich.** Die lokale Next-CLI wurde über den gebündelten Node-Runtime gestartet; npm ist nicht im Shell-PATH vorhanden.
- **26 Homepage-Konfigurationen in Chrome:** alle fünf Sprachen bei 320/640/1280/1440px sowie ergänzend DE/RU/UK bei 1024/1280px. Kein horizontaler Overflow; alle sichtbaren Header-Controls genau 48px, obere Kanten auf Desktop identisch. Desktop- und mobile Menü-Reihenfolge sowie beide Adressen und Kontaktlinks geprüft. Light-/Dark-Screenshots visuell kontrolliert.
- **Registrierung in Chrome und WebKit 26:** nach Scrollen Beleg exakt bei 32px, keine CSS-Transformation; bei 550px Viewport-Höhe bleiben Gesamtbereich und Aktion sichtbar. 320/390px ohne horizontalen Overflow und mit normalem Belegfluss. Die echten Komponenten liefen mit synthetischen Kursen und isolierten Server Actions; keine Buchung oder E-Mail ausgelöst.
- **13 Preis-/Formular-/Submit-Funktionen per TypeScript-AST verglichen:** unverändert, darunter Kursauswahl, Monats-/Folgepreise, Formschema, Einwilligung und Submit.
- **Native Medienwiedergabe in Chrome und WebKit 26:** bei künstlich auf fünf Sekunden verzögerter Erzeugung startet nach einem einzigen Klick automatisch dieselbe freigegebene Audioinstanz. Kein zweiter Klick und keine eingeblendeten Ersatzcontrols. Nach Kartenwechsel kein verspätetes Audio. Zwei Hintergrundanfragen starten bereits vor dem Reveal.
- **Lokale Audio-Fixture-Messung, finaler Code:** vorgeladener Erststart ca. 37–49ms, Wiederholung ca. 37–68ms; keine Browserfehler. Die Fixture verwendet eine lokale einsekündige WAV-Datei und eine verzögerte Erzeugungsattrappe. Die Werte sind keine Messung der Produktions-TTS-Latenz oder eines physischen iPhones.
- `git diff --check` erfolgreich. ESLint lässt sich mit der bestehenden ESLint-9-Installation ohne `eslint.config.*` nicht ausführen; keine Konfigurationsänderung zur Umgehung vorgenommen.

## Prüfgrenzen

Homepage und Produktionsbuild verwenden lokale Backend-Testwerte. Fehlende Kursdaten erzeugen erwartete Fetch-Fallbacks, die bestehende Registrierungsroute protokolliert ihren dynamischen Cookie-Zugriff. Der Build endet erfolgreich. Produktive Verträge, E-Mails, Datenbankänderungen und ein Test auf physischer iPhone-Hardware sind nicht Teil dieser lokalen UI-Prüfung. Keine Veröffentlichung vorgenommen.
