# MASTER-PROMPT 4.0 — CODEX (Grundregeln & Design)

**Lies dieses Dokument aufmerksam, bevor du mit einer Phase beginnst.** Es enthält die unumstößlichen Regeln für Architektur, Code-Stil und Design der Sitov Academy.

---

## GRUNDREGELN — gelten IMMER, ohne Ausnahme

* **R1 — ERST PRÜFEN, DANN HANDELN.** Bevor du eine Datei löschst, umbenennst oder eine Konfiguration änderst, prüfst du, dass sie existiert und dass du ihren Inhalt verstanden hast. Findest du eine genannte Datei nicht, meldest du das. Erfinde nichts.
* **R2 — KEIN SPEICHERÜBERLAUF.** Der VPS hat 8 GB RAM und ist knapp budgetiert. Kein Speicherlimit wird erhöht, ohne ein anderes zu senken. Neue Hintergrunddienste sind nicht erlaubt.
* **R3 — KEINE EXTERNEN DIENSTE.** Die App darf keine ausgehenden Verbindungen aufbauen (`IPAddressDeny=any`). Keine CDNs, externen Schriften oder Audio-Dienste. Mails über lokalen Worker, Sprachausgabe über lokales Piper-TTS.
* **R4 — TOTER CODE NUR MIT NACHWEIS.** Eine Datei gilt erst als tot, wenn sie weder statisch noch dynamisch erreichbar ist. Abgelöste Funktionen werden erst gelöscht, wenn der Ersatz produktiv läuft.
* **R5 — KEINE BEWERTUNG IM CLIENT.** Richtig, falsch, Punkte und Freischaltungen entscheidet ausschließlich PostgreSQL (`SECURITY DEFINER`). Der Client zeigt Ergebnisse nur an. Lösungen erreichen den Client erst nach der Bewertung.
* **R6 — TESTS DÜRFEN NICHTS AUSBLENDEN.** Ein Test, der eine Anforderung per Filter oder `skip` umgeht, ist ein Fehler.
* **R7 — JEDE DDL IST IDEMPOTENT.** Neue DDL steht in `supabase/vps/NN_modul.sql` und lässt sich beliebig oft ausführen. Danach `schema.sql` und `database.types.ts` aktualisieren.
* **R8 — BACKUP VOR JEDER DB-ÄNDERUNG.** Über `deploy/vps/migrate-local.py`. 
* **R9 — ROLLBACK-PLAN.** Jede Migration hat eine Rückweg-Datei unter `supabase/vps/rollback/`. Bestandsdaten werden archiviert (`is_active = false`), nicht gelöscht.
* **R10 — FEHLER SIND EXPLIZIT.** Jede RPC gibt bei Fehlern strukturiertes JSONB zurück. Die Oberfläche übersetzt `error`-Codes.
* **R11 — ENUM STATT CHECK.** Wiederkehrende Wertemengen werden `CREATE TYPE … AS ENUM`, nie `CHECK`. Neue Enum-Werte benötigen eine eigene, vorgeschaltete Migration.
* **R12 — FÜNF SPRACHEN, IMMER GLEICHZEITIG.** Jeder neue Text entsteht in `de`, `en`, `ru`, `uk` und `tr` im selben Commit. Übersetzungen sind natürlich formuliert.
* **R13 — BARRIEREFREI FÜR ÄLTERE MENSCHEN.**
  * Touch-Ziele mind. 48×48 px.
  * Lernschrift mind. 18 px, Fließtext mind. 16 px.
  * Kontrast WCAG AA.
  * Jede Animation respektiert `prefers-reduced-motion`. Nichts blinkt.
  * Tastatur- und Screenreader-Bedienung muss gegeben sein (kein Drag&Drop Zwang).
* **R14 — KEINE LEHRBUCHINHALTE.** Nur Lernziele übernehmen, keine Sätze oder Situationen aus Büchern 1:1 kopieren.
* **R15 — POSITIVE AKTION RECHTS.** Primäre (positive) Aktion rechts oder unten, sekundäre links oder oben.
* **R16 — DATENSPARSAMKEIT.** Nur erfassen, was die Lehrkraft braucht. Fristen für Löschungen beachten. Keine Protokollierung von Anschlägen.

---

## DESIGN-RICHTLINIE „Subtle Luxury, verspielt“

* **D1 — Haltung:** Ruhige Flächen, Weißraum, Glas-Karten, warmes Orange (Marke). Verspielt: Dinge reagieren auf Berührung (Mikroanimationen), kein "kindliches" Design.
* **D2 — Farben:** Keine Hex-Werte im Code, nur bestehende Tokens verwenden. Modus-Farben: Vokabeln (Orange), Lernpfad (Blau), Aussprache (Violett), Mediathek (Petrol).
* **D3 — Typografie:** Lernschrift ≥ 18 px, Aufgabenstellung ≥ 20 px. Keine Versalien-Absätze.
* **D4 & D5 — Bewegung:** Framer Motion nutzen. Mikroanimationen: Druck (Skalierung 0.97), Wandernde Pille (layoutId), Gestaffeltes Einblenden (40ms pro Element). Nichts wackelt rot bei Fehlern, stattdessen sanftes horizontales Wackeln.
* **D6 — Modus-Dock:** 4 Tabs oben (Vokabeln, Lernpfad, Aussprache, Mediathek). 
* **D7 — Brotkrumen:** Immer der volle Pfad (`Start › A1.1 › Lernpfad › Test`).
* **D8 — Untere Leiste (Handy):** Blendet beim Scrollen aus/ein.
* **D12 — Knöpfe:** R15 beachten. Primäre Aktion ist gefüllt (`--accent-strong`), sekundäre umrandet.

---

## ARBEITSABLAUF (Workflow)

* **S1** — Bestätige zu Beginn kurz das Lesen von CODEX-4-RULES.md.
* **S2** — Erstelle vor Änderungen einen Prüfbericht (Ist- vs. Soll-Zustand).
* **S3** — Führe strikt nur die geforderte Phase aus.
* **S4** — Hake Punkte in deiner `STATUS.md` ab (nicht im Prompt).
* **S5** — Für DB-Änderungen immer Backup, Idempotenz und Rollback prüfen.
* **S6** — Achte auf Speicher/Ressourcen.
* **S7** — Am Ende der Phase die `STATUS.md` aktualisieren und alles committen.
