> **Lies `00_CODEX-4-RULES.md` und diese Datei. Führe ausschließlich Phase 8 aus.**

## PHASE 8 — ABNAHME UND AUSLIEFERUNG

**Ziel:** Alles läuft zusammen, auf allen Geräten, nachgewiesen.

#### 8.1 Testinfrastruktur
* [ ] Falls noch offen aus `CODEX.md` 8.0: Playwright über Produktionsbuild, Projekte Desktop Chrome, `devices['Pixel 7']`, `devices['iPhone 14']`, authentifizierter Storage-State, Testpersonen mit nicht-deutscher Oberfläche.

#### 8.2 Verifikationsmatrix (jede Zeile ein grüner automatisierter Test)
* [ ] **Phase 1:** Knopfreihenfolge in beiden Komponenten · Groß-/Kleinschreibung und Zeichensetzung ergeben `EXACT` mit Punktzahl 100 · Artikel-Chip nur bei Nomen · `article_missing` und `article_wrong` · Karte „Freischaltung ausstehend“.
* [ ] **Phase 2:** Modus-Dock auf allen vier Modi · volle Brotkrumen auf Handy · untere Leiste blendet aus und ein, Aufnahmeknopf bleibt sichtbar · Home zeigt das zuletzt gelernte Niveau · reduzierte Bewegung ohne laufende Animationen.
* [ ] **Phase 3/4:** Pfad 1 komplett auf Pixel 7 · Test knapp unter 80 % nicht bestanden, genau 80 % bestanden · Pfad 2 erst danach frei · keine Lösungen vor der Antwort (Netzwerkmitschnitt) · `/exercises` leitet nach `/path` · Qualitätstests des Seeds.
* [ ] **Phase 5:** Mitnahme mit erhaltenem Fach, Schalter aus und an, Zurücksetzen.
* [ ] **Phase 6:** „Neu“ erscheint und verschwindet, im Voraus freigeschaltete Niveaus sind nicht neu · Mail-Schalter aus/an · Bündelung · mehrere freigeschaltete Niveaus ergeben eine Mail · keine Benachrichtigung der Lehrkraft bei Niveau-Abschluss.
* [ ] **Phase 7:** Schülerseite mit allen Tabs · Rechte · kein Einspruchs-Knopf in der Lernenden-Oberfläche.
* [ ] **Gesamt:** axe ohne Filter auf allen Lernenden- und Admin-Routen in hell und dunkel · `translation-integrity` grün · vollständiger Jest-, DB-, Python- und Playwright-Lauf grün.

#### 8.3 Leistung
* [ ] Lighthouse (Handy) für Home, Niveau-Seite, Lernpfad-Karte, Knoten: Werte gegen Phase 0 im Bericht. Die Lernpfad-Karte lädt ihre Knoten mit **einem** RPC-Aufruf.
* [ ] JavaScript der Lernpfad-Route im Bericht (Build-Ausgabe); Framer Motion wird nicht doppelt gebündelt.

#### 8.4 Hilfe und Dokumentation
* [ ] Hilfe-Einträge für Lernpfad, Wörter mitnehmen, Benachrichtigungen und „Neu“ in fünf Sprachen. Bestehende Hilfe-Einträge bleiben, wie sie sind.
* [ ] `docs/master-4/verifikation.md` mit allen Nachweisen (Muster wie `docs/phase-5-verification.md`).
* [ ] `STATUS.md` abschließen, `supabase/schema.sql` und `supabase/database.types.ts` aus Produktion aktualisiert.

#### 8.5 Auslieferung
* [ ] Letztes Release nach dem Ablauf aus „Kontext & Umgebung“, Backup-Nachweis nach R8, Health `ready`, App, Mail-Worker und nginx aktiv.
* [ ] Kurzer Rauchtest in Produktion mit einem Testkonto: Home, Niveau, alle vier Modi, ein Lernpfad-Knoten, eine Vokabelrunde. Testdaten danach entfernen.

**Abnahme Phase 8:** Alle Checkboxen dieses Prompts sind `[x]` oder begründet `[N/A]` (S7).

---