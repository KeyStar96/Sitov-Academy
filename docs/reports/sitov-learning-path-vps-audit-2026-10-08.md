# Sitov Academy: Lernpfad-Bestandsprüfung auf dem VPS

Prüfung: **08.10.2026, 12:17 Uhr CEST**, aktives Release und Seed-Stand **`a1e22479a3cf`**. Alle Datenbankabfragen liefen in ausdrücklich schreibgeschützten Transaktionen (`BEGIN READ ONLY`). Keine Imports, Veröffentlichungen oder Änderungen an Datenbank, Aufgaben, Antworten, Fortschritt und Streaks.

## Ergebnis

Der veröffentlichte Inhaltsbestand entspricht vollständig den zehn versionierten Seeds `supabase/seeds/path-a1.1.json` bis `path-c1.2.json`: **66 Pfade, 856 Knoten, 9.569 Aufgaben und 746 Lernziele**. Alle zehn Teilniveaus sind aktiv. Die ungeteilten Platzhalterniveaus B2, C1 und C2 bleiben wie vorgesehen inaktiv.

**Offen sind 235 vorberechnete Satzbau-Aufnahmen.** Die von der aktuellen Lernpfad-Veröffentlichungsprüfung verlangten Lücken- und Multiple-Choice-Aufnahmen sind vollständig. Der erweiterte Audio-Katalog umfasst jedoch auch Satzbau-Lösungen und ist deshalb noch nicht vollständig vorbereitet. Der VPS-Bestand darf insgesamt nicht als lückenloser Audio-Katalog bewertet werden.

## Bestandsabgleich

| Niveau | Pfade | Knoten | Aufgaben | Lernziele |
| --- | ---: | ---: | ---: | ---: |
| A1.1 | 7 | 85 | 769 | 87 |
| A1.2 | 7 | 90 | 922 | 81 |
| A2.1 | 7 | 92 | 1.061 | 74 |
| A2.2 | 7 | 95 | 1.087 | 83 |
| B1.1 | 7 | 91 | 1.056 | 79 |
| B1.2 | 7 | 91 | 1.050 | 78 |
| B2.1 | 6 | 78 | 906 | 66 |
| B2.2 | 6 | 78 | 906 | 66 |
| C1.1 | 6 | 78 | 906 | 66 |
| C1.2 | 6 | 78 | 906 | 66 |
| **Gesamt** | **66** | **856** | **9.569** | **746** |

Alle zehn JSON-Seeds bestehen die vorhandene Zod-Validierung (`learningPathSeedSchema`). Der vollständige Abgleich mit dem Live-Katalog ergab **0 Abweichungen in 411.009 Feldvergleichen**. Erfasst wurden stabile Pfad-/Knoten-/Aufgabenkennungen, Reihenfolge, Aktivität, Titel, Themen, Merkkarten, Lernziele, Aufgabenarten, unveränderte deutsche Inhalte und Antworten sowie Hinweise und Erklärungen. Sämtliche **52.455 Übersetzungszeilen** in `de`, `en`, `ru`, `uk` und `tr` stimmen mit dem Importvertrag überein. Es fehlen keine Seed-Zeilen; es gibt keine zusätzlichen Pfad-, Knoten-, Aufgaben- oder Lernzielzeilen.

Die Katalog-Zeitstempel bestätigen den Import von B1.2, B2.1, B2.2, C1.1 und C1.2 am **7. Oktober 2026, 23:16–23:17 Uhr CEST**. Die bereits vorhandenen Niveaus A1.1 bis B1.1 behalten ihre früheren Import-Zeitstempel und stimmen ebenfalls vollständig mit ihren Seeds überein.

## Struktur und Veröffentlichung

Die Live-Abfragen fanden jeweils **0 Fehler** bei doppelten Pfadquellen, Knotenquellen und Aufgabenreferenzen; verwaisten Knoten und Aufgaben; fehlenden oder falsch zugeordneten Lernzielen; ungültigem Aufgabeninhalt; leeren Knoten; falscher Knotenreihenfolge und ungültigen Spezialknoten-Ankern. Jeder Pfad besitzt genau einen aktiven Review- und Testknoten. Alle 66 Testpools haben genügend Aufgaben für zwei Stichproben und decken jedes Lernziel ab. Alle Constraints sind validiert; sämtliche Aufgaben sind `ready`, alle Seed-Knoten und -Aufgaben aktiv.

Die Prüfung nutzte nur Katalog- und Storage-Daten. Es wurden keine realen Nutzerprofile, Schülerantworten, Testversuche oder Lernstände exportiert oder durch künstliche Durchgänge verändert.

## Audio

Für Lücken und Multiple Choice sind alle **10.582 unterschiedlichen erforderlichen Hörtexte** im aktiven Storage-Katalog vorhanden. Profil, Stimme, Modellrevision, Text- und Audio-Prüfsummen, MP3-MIME-Typ, Dateigröße und **148.961 Wortzeitmarken** erfüllen den aktuellen Qwen-Vertrag. Alle 4.435 bereits gespeicherten `solution_audio_url`-Werte der neu importierten fünf Niveaus passen zu ihren inhaltlich adressierten Aufnahmen. Die älteren Niveaus besitzen dort leere Werte; der gemeinsame Audio-Adapter ruft ihre ebenfalls vorhandenen Aufnahmen anhand des deutschen Textes ab.

Der zusätzliche Abgleich inklusive Satzbau ergibt **11.185 erwartete Aufnahmen**, davon **10.950 vorhanden und 235 fehlend**. Alle vorhandenen Objekte besitzen gültige Qwen-Metadaten und insgesamt **151.121 Wortzeitmarken**. Die tatsächlichen Dateien wurden vollständig über den lokalen Storage-GET-Endpunkt auf dem VPS gelesen: **10.950 von 10.950 Objekten** liefern HTTP 200, `audio/mpeg`, die gespeicherte Dateigröße, einen gültigen MP3-Header und exakt die gespeicherte SHA-256-Prüfsumme (**357.034.584 Bytes**, zwei parallele Lesezugriffe). Damit ist die physische Existenz aller vorhandenen Objekte geprüft, nicht lediglich ihre Datenbank-Metadaten.

| Niveau | Fehlende Satzbau-Aufnahmen / betroffene Aufgaben |
| --- | ---: |
| B1.2 | 65 / 65 |
| B2.1 | 56 / 56 |
| B2.2 | 47 / 47 |
| C1.1 | 38 / 38 |
| C1.2 | 29 / 29 |
| **Gesamt** | **235 / 235** |

Die Lücke entsteht an der Grenze zwischen zwei bestehenden Verträgen: `scripts/sitov-audio-catalog.ts` berücksichtigt Satzbau-Lösungen im exportierten Katalog, während sein prospektiver `--path-seed`-Plan und `path_private.import_path_catalog` nur Lücke/Multiple Choice prüfen. Die aktuelle `/exercises`-Route leitet zum Lernpfad weiter; dessen Komponenten enthalten derzeit keine Audio-Steuerung, auch keine Satzbau-Wiedergabe. Deshalb bleibt das bestehende Lernpfadtraining bedienbar. Vor Audio-Erweiterungen bzw. vollständiger Audio-Katalog-Freigabe müssen die 235 Texte nach `docs/audio-authoring.md` lokal auf dem Mac erzeugt, ausgerichtet und geprüft importiert werden. Diese Bestandsprüfung hat keine Synthese oder Imports gestartet.

## Ausgeführte Prüfungen

- SSH-Lesezugriff auf `sitov-academy`, Prüfung von aktivem Release und Seed-Revision.
- Lokale Zod-Validierung sämtlicher zehn Seeds.
- Schreibgeschützter Live-Export der ausschließlich fachlichen Katalogfelder; vollständiger Soll-/Ist-Vergleich nach stabilen Quellenkennungen.
- Schreibgeschützte SQL-Prüfungen von Integrität, Aktivität, Inhaltsvertrag, Reihenfolge, Review/Test-Struktur, Testpool-Abdeckung und validierten Constraints.
- Schreibgeschützter Audio-Soll-/Ist-Abgleich mit dem tatsächlichen Audio-Extraktionsvertrag; vollständige Metadata- und Wortzeitmarkenprüfung.
- Physischer GET-/Dateigrößen-/MP3-/SHA-256-Audit aller 10.950 vorhandenen Audioobjekte.
