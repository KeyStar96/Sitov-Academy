# PHASE 4 — LERNPFAD: INHALTE A1.1 (Optimiert für ChatGPT)

**Start-Anweisung für diesen Chat:**
> Lies `00_CODEX-4-RULES.md` und diese Datei. Führe ausschließlich Phase 4 aus.

**Ziel:** Der technische Rahmen aus Phase 3 wird mit echtem Leben (Inhalten) gefüllt. Die Inhalte (der Seed) wurden bereits von einem didaktischen Experten erstellt und liegen als JSON vor. Deine Aufgabe ist der saubere Datenbank-Import und die Darstellung.

#### 4.1 Import des Seeds
Befund: Die JSON-Datei mit dem Curriculum für A1.1 liegt bereit unter `supabase/seeds/path-a1.1.json`.
* [ ] Schreibe ein robustes Node.js-Skript `scripts/import_learning_path.ts`.
* [ ] Das Skript liest das JSON und schreibt die Daten idempotent über Supabase-Service-Role-Keys in die Tabellen `learning_units`, `learning_exercises` und die Übersetzungs-Tabellen.
* [ ] Achte darauf, dass bestehende Pfade bei erneutem Ausführen nicht dupliziert, sondern aktualisiert werden (Upsert anhand eindeutiger IDs oder Lektionsnummern).
* [ ] Führe das Skript lokal aus und verifiziere, dass die Datenbank (lokal) korrekt gefüllt ist.

#### 4.2 Verknüpfung der Merkkarten
* [ ] Implementiere in der UI (`ExerciseClient.tsx` oder einer neuen Komponente `RuleCard.tsx`), dass die im Seed mitgelieferten grammatikalischen Erklärungen (`explanations`) zu Beginn eines Übungsknotens als "Merkkarte" gerendert werden.
* [ ] Beachte die Design-Richtlinie D9: Die Merkkarte soll sauber gestaltet sein, mit der Kennfarbe Blau.

#### 4.3 Rendering der Aufgabentypen
* [ ] Prüfe die Routen für das Rendern der Aufgaben aus dem Seed. Werden `fill_in_blank` und `multiple_choice` fehlerfrei gerendert?
* [ ] Greift der `grade_answer`-Vertrag aus Phase 1 korrekt für die importierten Lückentexte? Teste dies mit mindestens 3 Aufgaben aus dem Seed in der Web-Oberfläche.

#### 4.4 Migration der alten Nutzerdaten
Befund: Nutzer, die bereits im alten System Grammatik geübt haben, sollen ihren Fortschritt nicht völlig verlieren, aber in den neuen Pfad eingegliedert werden.
* [ ] Lege eine Migration `supabase/vps/31_migrate_old_grammar_progress.sql` an.
* [ ] Setze alle alten `learning_units` (die nicht zum neuen Pfad gehören) auf `is_active = false` (Archivierung).
* [ ] Optional: Übertrage anhand von heuristischen Regeln (z.B. Lektionsnummer) den Abschluss-Status auf die neuen Pfade, falls logisch abbildbar. Wenn nicht, setze den Fortschritt für den Lernpfad auf 0 (mit einer sauberen Notiz in der Datenbank für die Lehrkraft).

**Abnahme Phase 4:**
Das Import-Skript läuft fehlerfrei. Die Datenbank enthält die Aufgaben für A1.1. Die Web-Oberfläche rendert Pfad 1 fehlerfrei und die Aufgaben können bearbeitet und von PostgreSQL bewertet werden. Trage alle Ergebnisse in `STATUS.md` ein.
