# Phase 9: Konzept-Entwicklung Automatisierung Teilnahmebescheinigungen

Kopiere den folgenden Text und füge ihn in einen neuen Chat mit ChatGPT ein, um ein sauberes Architektur- und Workflow-Konzept zu erarbeiten.

***

**Rolle:** 
Du bist ein erfahrener Software-Architekt und Produktmanager für eine Next.js-basierte Lernplattform ("Sitov-Academy").

**Kontext & Problemstellung:**
Aktuell erhalte ich viele E-Mails von Schülern, die eine Teilnahmebescheinigung für ihre besuchten Sprachkurse anfordern. Bisher erstelle ich diese manuell, signiere sie über DocuSign und verschicke sie per E-Mail. Dieser Prozess ist sehr nervig und zeitaufwendig.
Parallel dazu verwalte ich Kunden und Rechnungen im externen Tool "papierkram.de". Die Rechnungen werden monatlich ausgestellt, jedoch zahlen viele Schüler unzuverlässig erst Mitte des Monats, obwohl eigentlich Vorkasse gilt.

**Gewünschtes Endergebnis (Vision):**
Jeder Schüler soll sich seine Teilnahmebescheinigung in seinem Profil selbst als PDF herunterladen können. Dies darf jedoch nur möglich sein, wenn der Schüler für den entsprechenden Zeitraum auch bezahlt hat.

**Die Herausforderungen, für die ich eine Lösung/ein Konzept suche:**

1. **Zeitraum der Bescheinigung:**
   - Sollte eine Bescheinigung immer nur für genau einen einzelnen Monat ausgestellt werden oder über einen längeren Zeitraum (z.B. alle bisherigen Monate kombiniert)?
   - *Das Problem:* Die Teilnahme ist oft nicht kontinuierlich. Manche Schüler pausieren einen Monat und machen dann weiter, andere steigen mitten im Monat ein. 
   - Wie bilden wir das auf dem Zertifikat logisch ab, ohne dass es unübersichtlich wird?

2. **Kunden-Synchronisation (Papierkram -> Plattform):**
   - Ich kann aus papierkram.de eine Kundenliste exportieren (siehe `docs/Papierkram/Adressbuch/eintraege.csv`). 
   - Ich brauche im Lehrer-Dashboard eine Upload-Funktion für diese CSV.
   - *Dynamik:* Diese Liste wächst kontinuierlich durch Neuanmeldungen.
   - *Logik:* Nur Zeilen mit `Kontaktart = 'Kunde'` sollen beachtet werden. Neue Kunden sollen in unserer Datenbank ergänzt werden. Bestehende Kunden (Abgleich per E-Mail-Adresse) dürfen NICHT überschrieben werden, da Schüler ihre Daten im Profil selbst ändern können.

3. **Rechnungs-Synchronisation (Papierkram -> Plattform):**
   - Ich exportiere aus papierkram.de monatlich eine Rechnungsliste (siehe `docs/Papierkram/Rechnungen/rechnungen-3.csv`).
   - Auch diese CSV möchte ich im Lehrer-Dashboard hochladen.
   - *Dynamik:* Rechnungen sind extrem dynamisch. Bestehende Rechnungen können storniert werden und Korrektur-Rechnungen können neu ausgestellt werden. Das System muss damit sicher umgehen können.
   - *Logik:* Der Rechnungsstatus in der Plattform soll aktualisiert werden. Erst wenn eine gültige Rechnung für den entsprechenden Monat den Status "Bezahlt" hat, darf die Teilnahmebescheinigung heruntergeladen werden. Da Schüler oft zu spät zahlen, muss das System flexibel und fehlertolerant sein. Wir erstellen die Rechnungen immer am Ende des Monats für den Folgemonat.

4. **Produkte / Dienstleistungen:**
   - Wir haben verschiedene Dienstleistungen/Kurse, die auf den Rechnungen abgerechnet und auf den Zertifikaten ausgewiesen werden (siehe `docs/Papierkram/Dienstleistungen/produkte.csv`).
   - *Dynamik:* Für den Moment sind diese fest, können sich aber in der Zukunft erweitern.

**Deine Aufgabe:**
Bitte sichte zunächst die bereitgestellten Dateien (`docs/Papierkram/Adressbuch/eintraege.csv`, `docs/Papierkram/Rechnungen/rechnungen-3.csv`, `docs/Papierkram/Dienstleistungen/produkte.csv`), um ihre Struktur kennenzulernen. 
Analysiere anschließend die Problemstellungen und erarbeite ein ganzheitliches technisches und fachliches Konzept (noch keinen Code). 
1. Wie sollte die Logik für die Teilnahmebescheinigungen (Zeitraum, Lücken in der Historie) aufgebaut sein? Was empfiehlst du für die PDF-Generierung in Next.js?
2. Wie strukturieren wir den Datenbank- und CSV-Import-Workflow am smartesten, um den manuellen Aufwand zu minimieren, aber robust bei Stornierungen und flexibel bei verspäteten Zahlungen zu bleiben?
3. Skizziere einen Lösungsansatz (Architektur, Datenmodell, UI-Flow) für das Lehrer-Dashboard (CSV-Uploads) und das Schüler-Profil (PDF-Download).

*Beispiel für den bisherigen Text der manuellen Teilnahmebescheinigung:*
> **Teilnahmebescheinigung**
> Hiermit bestätigen wir, dass Frau Anastasia Serebrova, wohnhaft in Zweidorfer Masch 1, 38176 Wendeburg, laufend, regelmäßig und mit besonderem Engagement an den privaten Deutsch-Sprachkursen unserer Sprachschule teilnimmt.
> 
> Besuchte Kurse vom 15.04.2026 - 30.06.2026:
> • Deutsch Level 2 (A1-A2)
> • Sprechtraining A1-B2
> 
> Besuchte Kurse vom 01.09.2026 - heute:
> • Deutsch B1 (Online)
> Montag & Dienstag von 14:30 Uhr bis 15:30 Uhr
> 
> **Kursinhalt und Zielsetzung**
> Der B1 (Online) Kurs richtet sich an Lernende mit gefestigten Grundkenntnissen und dient der systematischen Weiterentwicklung der Sprachkompetenz auf dem Niveau B1. Im Fokus stehen der Ausbau des Wortschatzes, die Vertiefung grundlegender Grammatikstrukturen sowie die Erweiterung des Ausdrücke-Spektrums für den Alltag und das Berufsleben. Ziel ist es, die Teilnehmenden zu einer selbstständigen und flüssigen Sprachverwendung in komplexeren Gesprächssituationen zu führen.
> 
> **Prognose**
> Nach aktueller Planung wird die Teilnahme am Sprachkurs auch in den kommenden Monaten fortgesetzt. Eine nähere Einschätzung zum zeitlichen Ablauf bis zum Erreichen des Zielniveaus kann im weiteren Verlauf des Kurses getroffen werden.
> 
> **Hinweis zur Finanzierung**
> Wir bestätigen, dass alle vertraglich vereinbarten Kursgebühren von Frau Anastasia Serebrova vollständig privat und persönlich entrichtet wurden. Für diese Sprachausbildung wurden und werden keine staatlichen Fördermittel, Zuschüsse oder Kostenübernahmen durch öffentliche Stellen oder Behörden (wie z. B. das Bundesamt für Migration und Flüchtlinge (BAMF), die Agentur für Arbeit oder das Jobcenter) in Anspruch genommen. Das Unterrichtsverhältnis basiert auf einem reinen Privatvertrag.
> 
> Hannover, den 10.09.2026
