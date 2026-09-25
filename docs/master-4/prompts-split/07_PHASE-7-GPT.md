> **Lies `00_CODEX-4-RULES.md` und diese Datei. Führe ausschließlich Phase 7 aus.**

## PHASE 7 — LEHRER-DASHBOARD

**Ziel:** Die Lehrkraft sieht genau, was jede Person lernt, wo sie hängt und was als Nächstes zu tun ist.

Befund: `components/admin/StudentDetailModal.tsx` ist 31 Zeilen lang (nur Kontakt und Tafel-Notiz). `StudentList.tsx` zeigt Rollen, Niveaus, Zugriffe und Fortschritt in %. `TeacherAnalytics.tsx` nutzt `public.get_all_students_progress_data(p_student_id, p_course_id)` (Migration 11: Fächer-Verteilung 1–6 plus gelernt, 30-Tage-Verlauf, Abschluss je Niveau). Datenquellen: `vocabulary_private.answer_receipts` (jede Antwort mit getippter Antwort, Ergebnis, Zeit), `user_exercise_progress`, `learning_activity_days` (Migration 24), `submissions`, `pronunciation_messages`, `teacher_student_notes`, ab Phase 3 die Lernpfad-Tabellen, ab Phase 5 die Mitnahme.

#### 7.1 Schülerseite `/admin/students/[id]`
Eigene Seite statt Modal, mit Tabs. Das Modal wird durch einen Link auf die Seite ersetzt.
* [ ] **Überblick:** zuletzt aktiv, Lernzeit 7 und 30 Tage, aktive Tage in Folge, aktuelles Niveau, Position auf dem Lernpfad, letzte Testnote, fällige Karten, Mini-Verteilung auf die Fächer, Markierung „braucht Aufmerksamkeit“ mit Grund, abgeschlossene Pfade je Niveau.
* [ ] **Niveaus freischalten** wie bisher, auch mehrere oder alle auf einmal im Voraus. Die neue Seite übernimmt diese Funktion aus der Liste, ohne sie einzuschränken.
* [ ] **Vokabeln:** Fächer-Verteilung je Niveau **und je Lektion** (`PhaseDistributionChart.tsx` wiederverwenden), halb gewusste Wörter, die schwierigsten Wörter (meiste Rückfälle), die letzten 50 Antworten mit getippter Antwort und Ergebnis, pausierte Lektionen, Mitnahme an/aus mit Anzahl. Eigene Wörter bleiben privat: nur ihre Anzahl.
* [ ] **Lernpfad:** Karte wie bei der Person, mit Sternen und Status je Knoten; alle Testversuche mit Prozentwert und aufklappbar jede Antwort; Knöpfe „Pfad freischalten“ und „Pfad/Test zurücksetzen“ mit Bestätigung und Protokoll.
* [ ] **Aussprache:** Gespräche, offene und unbeantwortete Aufnahmen, Link in das Gespräch.
* [ ] **Aktivität:** Kalender-Heatmap der Lerntage, Verteilung der Lernzeit auf die Modi, Verlauf über 30 Tage.
* [ ] **Notizen:** `teacher_student_notes` mit Datum.

#### 7.2 Erweiterte Liste
* [ ] Spalten: zuletzt aktiv, Lernzeit der Woche, Pfad-Position, letzte Testnote, fällige Karten, Mini-Balken der Fächer, Markierung „braucht Aufmerksamkeit“.
* [ ] „Braucht Aufmerksamkeit“ (in PostgreSQL berechnet): 7 Tage inaktiv, derselbe Test zweimal nicht bestanden, mehr als 150 fällige Karten, oder Trefferquote der letzten 7 Tage unter 50 %. Die Liste zeigt den Grund.
* [ ] Sortieren und Filtern nach jeder Spalte, Suche nach Namen; auf dem Handy als Kartenliste.

#### 7.3 Aktivitätsprotokoll mit Aufbewahrungsfrist (R16)
* [ ] Erfasst werden nur **Lernsitzungen**: Beginn, Ende, Modus, Niveau, Anzahl der Antworten. Keine Klickpfade.
* [ ] Rohdaten werden nach **180 Tagen** automatisch gelöscht; dauerhaft bleiben nur Tageswerte (`learning_activity_days`). Die Löschung läuft ohne neuen Dienst (zum Beispiel beim Schreiben neuer Sitzungen oder über den vorhandenen Wartungsweg) und ist getestet.
* [ ] Datenschutzerklärung in fünf Sprachen ergänzen: was die Lehrkraft sieht, wozu, wie lange.
* [ ] Im Profil der Lernenden ein Satz: „Deine Lehrkraft sieht deinen Lernfortschritt, damit sie dich gezielt unterstützen kann.“ mit Link zur Datenschutzerklärung.

#### 7.4 Bewusst nicht gebaut: Einsprüche von Lernenden
Nutzerentscheidung vom 25.09.2026: Lernende beurteilen nie selbst, ob eine Schreibantwort richtig ist. Es gibt **keinen** Knopf „Meine Antwort ist auch richtig“ und keine Einspruchs-Warteschlange. Richtige Lösungen und Varianten legt ausschließlich die Lehrkraft fest, im CMS und über das Varianten-Audit aus Phase 1.4. Die Selbsteinschätzung „Wusste ich / Wusste ich nicht“ im Karteikarten-Modus bleibt unverändert.

**Abnahme Phase 7:** DB-Tests für alle neuen Abfragen inklusive Rechten (Lernende sehen keine fremden Daten, Lehrkraft sieht alle); Playwright für Schülerseite und Liste; axe ohne Filter; Antwortzeit der Liste bei 200 Test-Personen unter 800 ms (p95, Messung im Bericht).

**Übergabe:** Neue Routen, RPCs und die Löschregel in `STATUS.md`.

---