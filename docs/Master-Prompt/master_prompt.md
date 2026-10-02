# 🚀 Master-Plan & Prompts für SmartGerman Überarbeitung

Dieser Plan teilt die gesamte Überarbeitung in logische Phasen auf. Da du verschiedene KIs mit unterschiedlichen Stärken und Limits nutzt, weisen wir jeder Phase das optimale Modell sowie die empfohlene Aufwands-Stufe (Thinking/Reasoning-Level) zu. 

**Wichtige Regel für den gesamten Prozess:**
Nach *jeder* abgeschlossenen Phase muss die KI aufgefordert werden, die getätigten Änderungen und den aktuellen Stand in dein Obsidian Vault (/Users/denniskostjuk/Library/Mobile\ Documents/com\~apple\~CloudDocs/Obsidian/Life-OS/01\ Projects/Sitov-Academy) zu dokumentieren, bevor mit der nächsten Phase begonnen wird.

---

## 🛠 Phase 1: Bugfixes & Verifizierung (Core Funktionalität)
**Modell:** ChatGPT 6 Astra (Aufgrund der hohen Limits ideal für Code-Analyse und Bugfixing)
**Aufwands-Stufe:** Hoch (High Reasoning)

**Master-Prompt für Phase 1:**
> **Kontext & Ziel:**
> Du fungierst als Senior Full-Stack Entwickler. Unser Ziel ist es, in unserer Lernplattform "SmartGerman" bestehende Bugs zu beheben und einige Logiken zu verifizieren. Du sollst den Weg zur Lösung selbstständig finden und keine vorgefertigten Implementierungsmuster verlangen. Bitte analysiere das Problem, finde die Ursache im Code und setze die Lösung um.
> 
> **Probleme & Anforderungen:**
> 1. **Tablet-Bug im Vokabeltrainer:** Wenn Nutzer auf einem Tablet auf den Aussprache-Button klicken (um sich ein Wort akustisch anzuhören), wird fälschlicherweise die Karteikarte umgedreht. Auf dem Smartphone funktioniert die Audio-Wiedergabe problemlos. Finde die Ursache für dieses Tablet-spezifische Verhalten (z.B. Event-Bubbling, Touch-Events vs. Click-Events) und behebe es so, dass nur die Audio abgespielt wird.
> 2. **Toleranz bei der Texteingabe:** Beim Selberschreiben von Vokabeln und im Learning Path sollen Groß- und Kleinschreibung sowie Zeichensetzung nicht als Fehler gewertet werden. Bitte verifiziere im Code, ob dies bereits fehlerfrei implementiert ist. Falls nicht oder falls es Lücken gibt, implementiere diese Toleranz.
> 3. **Artikel-Hinweis:** Beim Ausschreiben von Vokabeln im Vokabeltrainer soll eine kleine, subtile Info (UI-technisch ansprechend) angezeigt werden, dass bei Nomen auf den Artikel zu achten ist. Bitte verifiziere, ob das bereits existiert, und optimiere oder implementiere es andernfalls.
> 
> **Abschluss:**
> Sobald du diese Punkte gelöst hast, erstelle eine strukturierte Zusammenfassung der Änderungen und trage den neuen Stand als Notiz in mein Obsidian Vault ein.

---

## 🎨 Phase 2: Teacher Dashboard Enhancements
**Modell:** Claude Opus 5.5 (Ideal für UI/UX-Entscheidungen und flüssige Frontend-Integration)
**Aufwands-Stufe:** Hoch (High)

**Master-Prompt für Phase 2:**
> **Kontext & Ziel:**
> Du bist ein UI/UX-Experte und Senior Entwickler. Wir müssen das Lehrer-Dashboard ("Teacher Dashboard") für den Aussprache-Trainer verbessern. Die neuen Funktionen müssen nahtlos, modern und intuitiv in das bestehende UI integriert werden. Finde selbst das optimale Layout und den besten Weg der Implementierung.
> 
> **Anforderungen:**
> 1. **Nachrichtenverwaltung:** Lehrer müssen in der Lage sein, eingereichte Sprachnachrichten von Schülern im Aussprache-Trainer zu löschen. Implementiere eine intuitive Lösch-Funktion (inkl. Sicherheitsabfrage/Feedback).
> 2. **Audio-Geschwindigkeit:** Lehrer müssen die Möglichkeit haben, die Audio-Aufnahmen der Schüler schneller abzuspielen (konkret: ein Toggle oder Button für 2x Geschwindigkeit). Dies soll den Workflow der Lehrer beschleunigen.
> 3. **Schüler-Profile löschen (Lehrer):** Lehrer müssen in der Lage sein, Profile von Schülern zu löschen.
> 4. **Eigenes Profil löschen (Schüler):** Schüler müssen die Möglichkeit haben, ihr eigenes Profil in der Lernplattform endgültig zu löschen. WICHTIG: Es darf hierbei nur das reine Lernplattform-Profil gelöscht werden, nicht jedoch die zugrundeliegenden People-Daten (wie Adressen, Abrechnungsdaten), da diese für z.B. noch offene Rechnungen benötigt werden.
> 
> **Abschluss:**
> Bitte dokumentiere nach erfolgreicher Implementierung und UI-Anpassung den Fortschritt und die neuen UI-Komponenten in meinem Obsidian Vault.

---

## 🧠 Phase 3 & 4: Learning Path Expansion (A1.2 & A2.1)
**Modell:** Claude Opus 5.5 (Exzellent in komplexer Logik und kreativer Texterstellung/Didaktik)
**Aufwands-Stufe:** Ultra (Maximales Thinking / Deep Reasoning)

*Tipp: Da dies sehr rechenintensiv ist, machen wir A1.2 und A2.1 in zwei separaten Durchläufen (Phase 3 & Phase 4), um das Kontextfenster optimal zu nutzen.*

**Master-Prompt für Phase 3 (Niveau A1.2):**
> **Kontext & Ziel:**
> Du bist ein Experte für E-Learning, Sprachdidaktik (Deutsch als Fremdsprache) und Software-Architektur. Unser Ziel ist die Erstellung und Implementierung der Seeds für das Niveau A1.2 in unserem Learning-Path. Die Logik für A1.1 existiert bereits.
> 
> **Anforderungen & Regeln:**
> 1. **Struktur:** Das Niveau A1.2 ist in 7 Lektionen (Teil-Paths) unterteilt. Nach jedem Teil-Path muss ein Test absolviert werden, der zu mindestens 80% bestanden werden muss (die Logik hierfür ist von A1.1 bereits vorhanden und soll dynamisch adaptiert werden).
> 2. **Didaktik & Copyright:** Es dürfen keine bloßen Kopien der Wörter und Sätze aus bestehenden Lehrbüchern verwendet werden. Du musst komplett eigene Formulierungen, Sätze und Aufgaben erstellen.
> 3. **Ziele (WICHTIG):** Unter dem folgenden absoluten Pfad liegen Ordner ("A1.2 Lektion 1" bis "A1.2 Lektion 7"), welche Bilder mit den exakten Lernzielen der Lektionen enthalten: 
>    `/Users/denniskostjuk/Documents/SitovAcademy/SmartGerman/docs/Master-Prompt/LearningPath/`
>    Bitte analysiere diese Bilder (nutze Vision), extrahiere die Lernziele und sorge dafür, dass die von dir generierten Aufgaben und Seeds exakt diese Ziele abprüfen und trainieren.
> 4. **Umsetzung:** Implementiere die neuen Seeds und verknüpfe sie korrekt mit der bestehenden Learning-Path-Logik. Finde selbst die optimale Datenstruktur.
> 
> **Abschluss:**
> Dokumentiere die erstellten Lerninhalte und die Struktur der Datenbank/Seeds für A1.2 in meinem Obsidian Vault.

**Master-Prompt für Phase 4 (Niveau A2.1):**
> *(Führe exakt den gleichen Prompt wie in Phase 3 durch, tausche dabei lediglich "A1.2" durch "A2.1" aus. Die Ziele für A2.1 befinden sich ebenfalls im Verzeichnis `/Users/denniskostjuk/Documents/SitovAcademy/SmartGerman/docs/Master-Prompt/LearningPath/`)*

---

## 🚀 Phase 5: Deployment & Release
**Modell:** ChatGPT 6 Astra
**Aufwands-Stufe:** Mittel

**Master-Prompt für Phase 5:**
> **Kontext & Ziel:**
> Die Phasen 1, 2 und 3 (Bugfixes, Teacher Dashboard und Learning Path A1.2) sind erfolgreich abgeschlossen. Phase 4 (A2.1) wird auf später verschoben. Dieser aktuelle Zwischenstand (ohne A2.1) soll nun live gehen.
> 
> **Aufgabe:**
> 1. Überprüfe, ob alle Tests (falls vorhanden) grün sind und das Projekt fehlerfrei gebaut (gebuildet) werden kann.
> 2. Führe einen Git Commit und Push auf den Main-Branch durch, falls noch ungespeicherte Änderungen vorliegen. Bitte formuliere eine umfassende Commit-Message, die die Phasen 1 bis 3 zusammenfasst.
> 3. Führe das Deployment auf unserem VPS durch. (Finde den besten Weg für unser Setup, z.B. per SSH verbinden, pullen, Container neu starten oder Build-Prozess triggern).
> 
> **Abschluss:**
> Aktualisiere das Obsidian Vault ein letztes Mal mit dem Deployment-Log und dem Datum für dieses Zwischen-Release.
