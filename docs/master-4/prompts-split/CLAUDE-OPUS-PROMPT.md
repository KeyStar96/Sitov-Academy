# Claude Opus 5.5 - Content Generation Prompt

**Kontext:**
Du handelst als didaktischer Experte für Deutsch als Zweitsprache (DaZ) und strukturierter Datenarchitekt.
Wir bauen für die "Sitov Academy" einen neuen Lernpfad. Die Zielgruppe sind Erwachsene, die Deutsch lernen. Die Oberflächensprachen sind Englisch, Russisch, Ukrainisch und Türkisch.

**Deine Aufgabe:**
Generiere den vollständigen JSON-Seed für den Lernpfad des Niveaus "A1.1".
Der JSON-Output muss exakt in das Datenbankschema passen, damit er als `supabase/seeds/path-a1.1.json` gespeichert und von unserem System importiert werden kann.

**Strukturvorgaben für das JSON:**
Das JSON soll ein Array von Pfaden (Lektionen 1 bis 7) sein. Jeder Pfad enthält Knoten (Übungen, Wiederholung, Test).
Jede Aufgabe (Exercise) braucht:
- `exercise_type`: (z.B. "multiple_choice", "fill_in_blank", "sentence_building")
- `content`: Ein JSON-Objekt mit der eigentlichen Aufgabe (Text, Lücken, Antwortmöglichkeiten).
- `accepted_answers`: Ein Array mit den korrekten Antworten.
- `translations`: Ein Objekt mit Übersetzungen der Aufgabenstellung und Erklärungen in `en`, `ru`, `uk`, `tr`.
- `hint` & `explanation`: Didaktische Hilfestellungen.

**Pädagogische Regeln:**
1. **Keine Lehrbuchinhalte:** Erfinde komplett eigene Sätze, Namen und Situationen. Kopiere nichts aus bestehenden Büchern!
2. **Klarheit:** Sätze müssen für Erwachsene im Alltag relevant sein (Arbeit, Einkaufen, Arzt, Nachbarschaft).
3. **Erklärungen:** Jede Aufgabe bekommt eine "Merkkarte" (eine kurze Grammatikregel) als Erklärung.

---

*(Füge hier die detaillierten Grammatik- und Kommunikationsziele für Pfad 1 bis 7 aus dem ursprünglichen MASTER-PROMPT-4.md ein, beginnend bei "Pfad 7 — Können, Wollen, Vergangenheit", damit Claude den Lehrplan kennt.)*

**Output:**
Liefere mir bitte ausschließlich das wohlgeformte JSON-Dokument zurück. Wenn das JSON zu groß für eine einzelne Nachricht wird, generiere zuerst Pfad 1 bis 3, und biete mir an, den Rest im nächsten Schritt zu generieren.
