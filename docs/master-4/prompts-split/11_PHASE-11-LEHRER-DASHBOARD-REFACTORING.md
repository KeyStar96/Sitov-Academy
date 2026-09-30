# Master-Prompt: Refactoring Lehrer-Dashboard & Lernplattform

**Projektziel:** Umfassendes UI/UX-Refactoring des Lehrer-Dashboards (fokus auf eine professionelle, mobile-first Bedienung für junge Erwachsene) sowie Behebung von Logik-Fehlern und Erweiterung der Lernanalyse.
**Wichtige Grundregel:** Es handelt sich um Live-Kundendaten. **Keine Datenbank-Einträge dürfen gelöscht werden.** Neue Strukturen müssen abwärtskompatibel sein.
**Workflow-Regel:** Nach *jeder* abgeschlossenen Phase muss der aktuelle Stand im Obsidian Vault dokumentiert werden. Nach Abschluss aller Phasen wird der Code in das Repository gepusht und auf dem VPS deployed.

---

## Phase 1: Backend-Logik, Fehlerbehebung & Datenintegrität
**Empfohlenes KI-Modell:** ChatGPT (Modell: 6 Astra / 6.1 Sol - Aufwandsstufe: **Ultra**)
*Grund: ChatGPT hat in deinem Abo höhere Limits und ist exzellent im Debugging von Backend-Logik und Datenbank-Architektur.*

**Prompt für Phase 1:**
> "Du agierst als Senior Backend Developer. Deine Aufgabe ist es, Fehler in der Geschäftslogik unserer Lernplattform zu beheben und bestehende Funktionen robuster zu machen. ACHTUNG: Wir arbeiten auf einer Live-Datenbank, es dürfen keine Nutzer- oder Lerndaten gelöscht werden!
> 
> Bitte löse die folgenden Probleme:
> 1. **Dienstleistungs-Import:** Es muss möglich sein, die Kurszuordnungen von bereits importierten Dienstleistungen nachträglich zu bearbeiten (z.B. wenn fälschlicherweise nur ein Kurs statt mehrerer, wie Sprechtraining A1-B1, ausgewählt wurde).
> 2. **Falsche Kurs-Verknüpfungen:** In der Lernanalyse wird eine Schülerin fälschlicherweise beim Kurs 'Deutsch A1.1 (Online)' angezeigt. Das Trainer-Niveau A1.1 darf nicht programmatisch mit dem Kurs 'A1.1 Online' verknüpft sein. Trainer-Niveaus sind komplett eigenständige Entitäten und müssen unabhängig freischaltbar sein.
> 3. **Kursausfälle & Abrechnung:** Wenn ein Kursausfall im System eingetragen wird (z.B. für einen Donnerstag), wird dieser aktuell bei der Kursanmeldung für den Monat nicht berücksichtigt und trotzdem in Rechnung gestellt. Dies muss korrigiert werden, sodass Kursausfälle den Preis/die Anmeldung korrekt reduzieren.
> 4. **Aussprachetrainer:** Entferne die Auswahlmöglichkeit zwischen männlicher und weiblicher Stimme komplett aus dem Code. Es darf ausschließlich die männliche Stimme verwendet werden. Die weibliche Stimme war nie vorgesehen.
> 5. **User Experience (State Management):** Wenn Nutzer im Vokabeltrainer oder Aussprachetrainer die Geschwindigkeit oder die Stimme anpassen (z.B. langsameres Sprechen), werden diese Einstellungen bei der nächsten Karte zurückgesetzt. Speichere diese Einstellungen sitzungsübergreifend (z.B. im LocalStorage oder in den User Preferences der DB), sodass sie für alle nachfolgenden Karten erhalten bleiben, bis der Nutzer sie aktiv ändert.
> 
> Bitte analysiere die Probleme, zeige auf, welche Datenbank-Modelle/Controller angepasst werden müssen und implementiere die Korrekturen. Gib mir keine Implementierungsdetails vorab, sondern finde selbst den besten Weg."

*Nach Abschluss: Dokumentation in Obsidian Vault eintragen.*

---

## Phase 2: UI/UX Redesign Lehrer-Dashboard (Struktur & Layout)
**Empfohlenes KI-Modell:** Claude (Modell: Claude 3.5 Sonnet - Aufwandsstufe: **Ultra**)
*Grund: Claude ist deutlich überlegen, wenn es um modernes, durchdachtes UI/UX-Design, Tailwind-Styling und Frontend-Komponenten geht.*

**Prompt für Phase 2:**
> "Du agierst als Lead UI/UX Designer & Frontend Developer. Deine Aufgabe ist es, das Lehrer-Dashboard unserer Lernplattform komplett neu zu strukturieren und zu designen. Die Zielgruppe sind Lehrer im Alter von Mitte 20 bis 30 Jahren. 
> 
> Bitte setze folgende Anforderungen an das UI/UX um:
> 1. **Design-Sprache:** Das aktuelle Design ist zu 'spielerisch'. Es muss durch ein professionelles, informatives und aufgeräumtes Design ersetzt werden. Alles muss auf einen Blick ersichtlich sein (Corporate / Admin-Panel Look, aber modern).
> 2. **Mobile First:** Das gesamte Dashboard muss primär für das Smartphone konzipiert und optimiert sein. Die Desktop-Ansicht (Laptop) ist zweitrangig.
> 3. **Strukturierung der Übersicht:** Die Startseite muss aufgeräumt werden. Gut sind: Registrierte Schüler, freigeschaltete Nutzer, offene Korrekturen, Medienspeicher. Schlecht: Teilnahmebescheinigungen und Rechnungen gehören hier nicht hin, sie verstopfen die Übersicht. Das 'Schwarze Brett' für jeden Schüler soll komplett entfernt werden.
> 4. **Neue Navigation & Bereiche:**
>    - **Neue Schüler:** Es braucht einen sehr prominenten, eigenen Bereich, in dem sofort alle neuen Registrierungen angezeigt werden, die noch keine Niveau-Zuordnung haben (damit die Freischaltung nicht mehr aufwändig gesucht werden muss).
>    - **Kurse & Ausfälle:** Erstelle eine zentrale Kursverwaltung. Löse sie aus der 'Lernanalyse' heraus (dort gehört sie nicht hin). Es muss einen eigenen Reiter für Kurse und einen separaten, intuitiven Reiter für Kursausfälle geben (z.B. 'Gesamter Tag fällt aus').
>    - **Lerninhalte:** Strukturiere die Lerninhalte in völlig eigenständige Verwaltungs-Bereiche: 'Vokabeltrainer', 'Learning Path', 'Mediathek' und 'Aussprache-Trainer'.
>    - **Verwaltung:** Zertifikate (Teilnahmebescheinigungen), Rechnungen und CSV-Importe sind aktuell zu versteckt. Sie brauchen einen eigenen, gut sichtbaren Bereich (z.B. 'Administration' oder 'Dokumente').
> 
> Bitte entwickle eine saubere, intuitive Navigationsstruktur und gestalte die UI-Komponenten komplett neu. Finde selbst den optimalen Weg, das Layout zu kreieren."

*Nach Abschluss: Dokumentation in Obsidian Vault eintragen.*

---

## Phase 3: Lernanalyse & Neue Lernformate (Visualisierung)
**Empfohlenes KI-Modell:** Claude (Modell: Claude 3.5 Sonnet - Aufwandsstufe: **Ultra**)
*Grund: Claude ist hervorragend darin, Daten-Visualisierungen (z.B. mit Recharts, Chart.js) in React/Frontend-Frameworks nahtlos und optisch ansprechend zu integrieren.*

**Prompt für Phase 3:**
> "Du agierst als Frontend Engineer mit Fokus auf Datenvisualisierung. 
> 
> Bitte setze folgende Features im neuen Lehrer-Dashboard und in der Schüleransicht um:
> 1. **Dynamische Lernanalyse:** Die aktuellen Tageswerte der Schüler (Anzahl beantwortete Fragen vs. korrekte Fragen) müssen zusätzlich in Prozent (%) dargestellt werden. 
> 2. **Diagramme:** Implementiere kontinuierliche, dynamische Diagramme (z.B. Line-Charts oder Bar-Charts), die den Lernfortschritt über die Zeit aufzeichnen.
> 3. **Modus-spezifischer Fortschritt:** Die Visualisierung muss den Lernfortschritt feingranular nach den einzelnen Lernmodi aufschlüsseln. Ich brauche separate Diagramme/Ansichten für:
>    - Lernfortschritt Vokabeltrainer
>    - Lernfortschritt Learning Path
>    - Lernfortschritt Aussprache-Trainer
>    - Lernfortschritt Mediathek (angeschaute Medien)
> 4. **Deep-Dive für Problem-Wörter (Schüler-Feature):** Setze einen neuen Algorithmus/Bereich für das Frontend um: Wörter, die schwer zu merken sind, oder Artikel, die oft vergessen werden, sollen separat gespeichert und in neuen Formaten/kleinen Aufgaben intensiv trainiert werden (Spaced Repetition für Schwachstellen).
> 
> Finde selbst das optimale UI-Design für diese Visualisierungen und integriere sie nahtlos in die in Phase 2 geschaffene Struktur."

*Nach Abschluss: Dokumentation in Obsidian Vault eintragen.*

---

## Phase 4: Finales Review & Deployment
**Empfohlenes KI-Modell:** ChatGPT (Modell: o1 / GPT-4o - Aufwandsstufe: **High**)

**Prompt für Phase 4:**
> "Du agierst als DevOps & Lead Developer. Wir haben die Phasen 1-3 unseres Refactorings abgeschlossen (Backend Logik, Frontend UI, und Datenvisualisierung).
> 1. Bitte überprüfe den gesamten Code-Stand auf Konsistenz.
> 2. Hilf mir dabei, die finale Systemarchitektur und die neuen Datenströme in mein Obsidian Vault einzutragen.
> 3. Führe mich durch den Git Push und das Deployment auf meinem VPS. Zeige mir die genauen Befehle, um die Applikation zu builden und neu zu starten, ohne dass es zu Downtime bei unseren aktiven Nutzern kommt."
