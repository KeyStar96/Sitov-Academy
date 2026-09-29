# Phase 8: Prompt Strategie & Arbeitsaufteilung

Dieses Dokument enthält die strukturierten Prompts für die Lösung der 5 aktuellen Bugs/Probleme. Die Aufgaben werden ideal auf die Stärken von Claude Opus 5.5 (Design & Architektur) und ChatGPT 6 Astra (Implementierung via Subagents) aufgeteilt.

---

## 🛠 PHASE 1: Claude Opus 5.5 (Design & Architektur)

Kopiere den folgenden Block und füge ihn in **Claude Opus 5.5** ein:

***

**Rolle:** Du bist der Lead Architect & UI/UX-Designer für die Lernplattform "Sitov-Academy" (ein Next.js basiertes Projekt).

**Kontext:** Wir haben 5 konkrete Probleme/Bugs in unserer Plattform, die behoben werden müssen.

**Aufgabe:** Analysiere die unten geschilderten Probleme und die gewünschten Endergebnisse. Erarbeite für jedes Problem ein herausragendes UI/UX-Design (Fokus auf Premium-Look & flüssige Interaktionen) sowie ein sauberes Architektur-Konzept (welche Komponenten, States und Datenstrukturen werden benötigt?).
Gib KEINE kleinteilige Implementierungsanleitung. Definiere stattdessen die technische und visuelle Vision, das Verhalten der UI und die Architektur, welche im nächsten Schritt von unserem Entwickler-Team umgesetzt wird.

**1. Learning Path - Übersetzungshilfe**
*Problem:* Die Aufgabenstellungen in A1.1 sind teilweise zu kompliziert formuliert. Es werden Vokabeln genutzt, die noch nicht behandelt wurden.
*Gewünschtes Endergebnis:* Die Aufgabenstellungen sollen inhaltlich nicht geändert werden. Es muss bei der deutschen Frage/Aufgabe ein Element (z.B. Button) integriert werden, das die Aufgabe in die gewählte Interface-Sprache (z.B. Russisch) übersetzt. Alle Interface-Sprachen müssen unterstützt werden. Die klickbaren Antwortmöglichkeiten müssen zwingend auf Deutsch bleiben.

**2. Learning Path - Lückentexte Eindeutigkeit**
*Problem:* Bei Lückentext-Aufgaben (z.B. "Ich ____ Lara.") ist oft unklar, welches Wort eingesetzt werden muss, da mehrere Antworten grammatikalisch korrekt wären (z.B. "bin" oder "heiße").
*Gewünschtes Endergebnis:* Der Schüler darf in keine Situation kommen, in der er raten muss. Das exakt gesuchte Wort muss im Infinitiv vorgegeben werden (als visuelle Hilfestellung), sodass keine alternativen Antwortmöglichkeiten implementiert werden müssen und die Aufgabe eindeutig ist.

**3. Learning Path - Testauswertung**
*Problem:* Aktuell muss ein Test mit >80% bestanden werden. Bei Nichtbestehen muss der Pfad chronologisch wiederholt werden. Es wird jedoch nirgends angezeigt, welche Fehler man gemacht hat (auch nicht, wenn man z.B. mit 87% besteht).
*Gewünschtes Endergebnis:* Es muss eine detaillierte Testauswertung geben. Beim Klick auf den zuletzt absolvierten Test müssen dem Schüler 2 Optionen angeboten werden:
1) Testauswertung einsehen (Anzeige der eigenen Antworten vs. korrekte Lösungen).
2) Test erneut starten.

**4. Einstellbare E-Mail Benachrichtigungen**
*Problem:* Es gibt verschiedene Benachrichtigungsmails (Registrierung, Passwort-Reset, Kursanmeldung, Lehrer-Feedback zu Aussprache, Freischaltung neuer Inhalte, 3-Tage-Inaktivität), aber der Schüler kann diese nicht steuern.
*Gewünschtes Endergebnis:* Grundlegende System-Mails (Passwort-Reset, Registrierung, Kursanmeldung) sind "Must-haves" und können nicht deaktiviert werden. Alle optionale Benachrichtigungen (Lehrer-Antwort, neue Inhalte, Erinnerungsmails) müssen im Schüler-Profil individuell durch den User ein- und ausschaltbar sein.

**5. UI/UX - Modi-Header Scrollverhalten**
*Problem:* Der obere Modi-Header (Vokabeln, Learning Path, Aussprache, Mediathek) nimmt beim Scrollen durchgehend Platz ein.
*Gewünschtes Endergebnis:* Der Modi-Header soll sich exakt wie die untere Menüleiste verhalten: Beim Scrollen nach unten soll er sanft nach oben ausgeblendet werden. Beim Scrollen nach oben soll er sofort wieder eingeblendet werden.

***

## 💻 PHASE 2: ChatGPT 6 Astra (Implementierung)

Sobald Claude das Design und die Architektur entworfen hat, kopiere den folgenden Block und ersetze den Platzhalter am Ende mit der Antwort von Claude. Füge diesen Prompt in **ChatGPT 6 Astra** ein:

***

**Rolle:** Du bist der Lead Developer für die Lernplattform "Sitov-Academy" (Next.js).

**Kontext:** Claude (Lead Architect & Designer) hat die Design- und Architektur-Konzepte für 5 offene Features/Bugs erarbeitet.

**Aufgabe:** Nutze Subagents, um das System basierend auf den von Claude definierten Konzepten zu implementieren. Setze die Aufgabenstellungen vollständig um und integriere Frontend und Backend entsprechend der vorgegebenen Architektur-Vision.
Gib keine Erklärungen ab, sondern starte direkt mit der Umsetzung.

**Die 5 Anforderungen (Zusammenfassung):**
1. **Learning Path - Übersetzungshilfe:** Übersetzungs-Button für deutsche Aufgaben in die jeweilige Interface-Sprache (Antworten bleiben Deutsch).
2. **Learning Path - Lückentexte Eindeutigkeit:** Eindeutige Vorgabe des gesuchten Wortes im Infinitiv, um Raten zu verhindern.
3. **Learning Path - Testauswertung:** Neues UI mit 2 Entscheidungen beim Klick auf einen vergangenen Test (1. Auswertung einsehen, 2. Neustart) inkl. Fehleranalyse.
4. **Einstellbare Benachrichtigungen:** Profil-Settings zum individuellen Deaktivieren optionaler Mails (Lehrer-Antwort, neue Inhalte, Inaktivitäts-Erinnerung). Pflicht-Mails bleiben obligatorisch aktiv.
5. **UI/UX - Modi-Header Scrollverhalten:** Sanftes Ein- und Ausblenden des Headers beim Scrollen analog zur Bottom-Navigation.

**Design & Architektur-Vorgabe von Claude:**
[ HIER DEN KOMPLETTEN OUTPUT VON CLAUDE AUS PHASE 1 EINFÜGEN ]

***

## 📝 Obsidian Dokumentation

Nachdem die Implementierung durch ChatGPT abgeschlossen ist, kannst du den aktualisierten Stand des Projekts (z.B. neue Features, Architekturentscheidungen und Backend/Frontend Änderungen) in deine Obsidian Dokumentation übertragen:
`/Users/denniskostjuk/Library/Mobile Documents/com~apple~CloudDocs/Obsidian/Life-OS/01 Projects/Sitov-Academy`

Tipp: Wir können später ChatGPT oder Claude bitten, basierend auf den Code-Änderungen ein "Changelog" im Markdown-Format zu erstellen, welches du dann einfach per Copy & Paste in Obsidian einfügen kannst.
