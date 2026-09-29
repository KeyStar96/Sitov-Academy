# Phase 8: Bugfixes & Features (Agent Workflow)

**Rolle & Zugriff:** 
Du bist ein autonomer, erstklassiger Full-Stack Entwickler (Next.js) und UI/UX-Designer. Du hast vollen Lese- und Schreibzugriff auf den Workspace sowie Berechtigungen zur Terminal-Nutzung.

**Kontext:** 
Wir haben 5 konkrete Probleme/Bugs in unserer Plattform, die behoben werden müssen. 

**Deine Aufgabe:**
Analysiere die bestehende Code-Basis, erstelle ein herausragendes UI/UX-Design (Fokus auf Premium-Look & flüssige Interaktionen) und implementiere die folgenden 5 Punkte vollständig.

### Die 5 Anforderungen

**1. Learning Path - Übersetzungshilfe**
*Problem:* Die Aufgabenstellungen in A1.1 sind teilweise zu kompliziert formuliert.
*Gewünschtes Endergebnis:* Die Aufgabenstellungen sollen inhaltlich nicht geändert werden. Es muss bei der deutschen Frage/Aufgabe ein Element (z.B. Button) integriert werden, das die Aufgabe in die gewählte Interface-Sprache (z.B. Russisch) übersetzt. Alle Interface-Sprachen müssen unterstützt werden. Die klickbaren Antwortmöglichkeiten müssen zwingend auf Deutsch bleiben.

**2. Learning Path - Lückentexte (Eindeutigkeit)**
*Problem:* Bei Lückentext-Aufgaben (z.B. "Ich ____ Lara.") ist oft unklar, welches Wort eingesetzt werden muss, da mehrere Antworten grammatikalisch korrekt wären (z.B. "bin" oder "heiße").
*Gewünschtes Endergebnis:* Der Schüler darf in keine Situation kommen, in der er raten muss. Das exakt gesuchte Wort muss im Infinitiv vorgegeben werden (als visuelle Hilfestellung), sodass die Aufgabe eindeutig ist und keine alternativen Antwortmöglichkeiten nötig sind.

**3. Learning Path - Testauswertung**
*Problem:* Aktuell muss ein Test mit >80% bestanden werden, aber es wird nirgends angezeigt, welche Fehler man gemacht hat.
*Gewünschtes Endergebnis:* Es muss eine detaillierte Testauswertung geben. Beim Klick auf den zuletzt absolvierten Test müssen dem Schüler 2 Optionen angeboten werden:
1) Testauswertung einsehen (Anzeige der eigenen Antworten vs. korrekte Lösungen).
2) Test erneut starten.

**4. Einstellbare E-Mail Benachrichtigungen**
*Problem:* Es gibt verschiedene Benachrichtigungsmails, aber der Schüler kann diese nicht steuern.
*Gewünschtes Endergebnis:* Grundlegende System-Mails (Passwort-Reset, Registrierung, Kursanmeldung) sind "Must-haves" und bleiben obligatorisch. Alle optionalen Benachrichtigungen (Lehrer-Antwort, neue Inhalte, Erinnerungsmails) müssen im Schüler-Profil individuell durch den User ein- und ausschaltbar sein. Die Logik muss im Backend/Mail-Service entsprechend geprüft werden.

**5. UI/UX - Modi-Header Scrollverhalten**
*Problem:* Der obere Modi-Header (Vokabeln, Learning Path, Aussprache, Mediathek) nimmt beim Scrollen durchgehend Platz ein.
*Gewünschtes Endergebnis:* Der Modi-Header soll sich exakt wie die untere Menüleiste verhalten: Beim Scrollen nach unten soll er sanft nach oben ausgeblendet werden. Beim Scrollen nach oben soll er sofort wieder flüssig eingeblendet werden.
