# Architektur-Konzept: Automatisierung Teilnahmebescheinigungen & Rechnungsabgleich

Dieses Konzept basiert auf der Analyse der Papierkram-Exporte (`eintraege.csv`, `rechnungen-3.csv`, `produkte.csv`).

## 1. Fachliche Trennung & Logik der Bescheinigung
Zahlungen werden monatlich zugeordnet, Teilnahmezeiträume taggenau gespeichert und daraus eine zusammengefasste Bescheinigung mit ausdrücklich getrennten Zeitblöcken erzeugt. Der Schüler kann alternativ einen einzelnen Monat auswählen.
Die wichtigste fachliche Trennung lautet: **Eine bezahlte Rechnung ermöglicht die Freigabe; sie belegt allein noch keine tatsächliche Teilnahme.** Dafür brauchen wir zusätzlich eine verlässliche Kurshistorie.

Für die Bescheinigung werden zusammenhängende, bestätigte und bezahlte Teilnahmeabschnitte gebildet.
Intern ist die kleinste fachliche Einheit: `Schüler + Kurs + Teilnahmeabschnitt + zugehörige Abrechnung`.

**Regeln für die Ausgabe:**
- **Monatsgrenzen:** Dürfen zusammengeführt werden (z.B. durchgehend April bis Juni).
- **Lücken:** Pausen und nicht freigegebene Zeiträume bleiben Lücken.
- **Einstieg:** Ein Einstieg am 15. April beginnt am 15. April (nicht am Monatsersten).
- **Kurswechsel:** Erzeugen eigene Abschnitte. Parallel besuchte Kurse werden getrennt berechnet.
- **Zukunft:** Zukünftige Teilnahme wird nicht rückwirkend vorweggenommen.
- **Teilnahmebestätigung:** Die Lehrkraft bestätigt die tatsächlichen Teilnahmezeiträume monatlich gesammelt im Dashboard.

## 2. Textbausteine des Zertifikats
- **Name und Anschrift:** Aktuelle Profildaten, bei Ausstellung als unveränderlicher Stand gespeichert.
- **Kurs und Zeitraum:** Bestätigte Teilnahmeabschnitte.
- **Kursinhalt und Zielsetzung:** Fachlich gepflegte Kursbeschreibung mit Version.
- **Unterrichtszeiten:** Für den bescheinigten Zeitraum gültiger Stundenplan.
- **Beglichene Gebühren:** "Die Kursgebühren für die in dieser Bescheinigung aufgeführten Teilnahmezeiträume sind beglichen." (Keine automatische Aussage über "private Mittel", da aus CSV nicht belegbar).

## 3. CSV-Import-Workflow (Lehrer Dashboard)

### A. Kunden-Import (`eintraege.csv`)
- Nur Zeilen mit `Kontaktart = Kunde` übernehmen.
- Prüfung: Ist die Papierkram-Kundennummer bereits einer Plattformperson zugeordnet?
- Falls nein: E-Mail trimmen und abgleichen. Bei eindeutigem Treffer -> Kundennummer verbinden (Profildaten NICHT überschreiben).
- Bei neuem eindeutigen Kunden -> Personendatensatz anlegen (Login noch nicht erforderlich).
- Kunden ohne E-Mail / Mehrdeutigkeiten -> Klärungsliste im Dashboard.

### B. Rechnungs-Import (`rechnungen-3.csv`)
- Leistungsmonat, Dokumentgültigkeit und Zahlungsstand werden unabhängig geführt.
- Leistungsmonat Bestimmung: 1. Vorhandene Zuordnung, 2. Vorschlag aus Betreff (z.B. "September 2026"), 3. Manuelle Auswahl.
- **Freigabe-Logik:**
  - Gültige Rechnung, Bezahlt oder Überbezahlt -> Freigabe erfüllt.
  - Unbezahlt, Gemahnt, Teilbezahlt -> Gesperrt.
  - Rechnung storniert -> Keine Freigabe mehr.
  - Skonto wird berücksichtigt.
- Stornos & Ersatzrechnungen: Original, Storno und Ersatz bleiben separate Datensätze. Fehlt eine bekannte Rechnung im neuen Export, wird sie zur Klärung markiert.
- Kein automatischer Papierkram-REST-API Abgleich (nur CSV-Upload).

## 4. Datenmodell Erweiterung (Supabase)
Aufbauend auf bestehendem Schema:
- `external_customers`: Papierkram-Konto, Kundennummer, importierte Kontaktdaten, Klärstatus.
- `external_products`: Artikelnummer, Quelldaten, Verbindung zu Plattformkursen.
- `import_batches` / `import_rows`: Upload-Protokolle, Prüfsummen.
- `invoices`: Rechnungsnummer, Kunde, Dokumenttyp, Originalstatus, normalisierter Zahlungsstatus, Beträge.
- `invoice_allocations`: Zuordnung Rechnungen zu Person, Kurs, Zeitraum.
- `participation_periods`: Tatsächlicher Beginn/Ende, Bestätigung durch Lehrkraft.
- `certificate_issues`: Generierte Dokumente (Snapshot, PDF-Pfad).

## 5. UI-Flow Lehrer-Dashboard
Vier Ansichten im Finanzbereich:
1. **Importieren:** CSV auswählen, Vorschau prüfen, Transaktional übernehmen.
2. **Klärfälle:** Konflikte (fehlende E-Mail, unklarer Storno) bearbeiten.
3. **Teilnahme bestätigen:** Nach Kurs/Monat filtern, Zeiten gesammelt bestätigen.
4. **Bescheinigungen:** Berechtigungen einsehen, Fehlerhafte PDFs zurückziehen.

## 6. UI-Flow Schüler-Profil & PDF-Generierung
- Schüler sieht verfügbare freigegebene Zeiträume (Standard: Alle, Alternativ: Einzelne Monate).
- Gesperrte Abschnitte zeigen genauen Grund (z.B. "Zahlung noch nicht erfasst", "Teilnahme wird noch bestätigt").
- **PDF-Generierung:** Serverseitig mit `@react-pdf/renderer` in Next.js (Route Handler). Authentifizierter Abruf, PDF wird gespeichert (Supabase Storage). Bereits generierte PDFs bleiben als Snapshot erhalten.
