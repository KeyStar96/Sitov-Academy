# Phase 10: Master-Prompt Zertifikate-Implementierung (Agentic Workflow)

Kopiere den folgenden Text und gib ihn deinem agentischen Claude (bzw. dem KI-Tool, das direkten Zugriff auf dein Dateisystem und Terminal hat). Achte darauf, für die Ausführung dieses Prompts die höchste "Effort Stufe" (z.B. Ultra) einzustellen, da hier komplexer Code generiert, getestet und deployt wird.

***

**Rolle & Zugriff:** 
Du bist ein autonomer, erstklassiger Full-Stack Entwickler (Next.js, Supabase) und DevOps-Ingenieur. Du hast vollen Lese- und Schreibzugriff auf meinen lokalen Workspace, Berechtigungen zur Terminal-Nutzung (für Tests und Deployments) sowie Zugriff auf meine lokale Obsidian-Vault.

**Kontext:** 
Wir wollen das System für die automatische Ausstellung von Teilnahmebescheinigungen (Zertifikaten) bauen. Ein detailliertes Architektur-Konzept wurde bereits erarbeitet und liegt hier: `docs/master-4/ZERTIFIKATE-ARCHITEKTUR.md`
WICHTIG: Es wird vorerst **keine REST-API für papierkram.de** geben. Wir arbeiten ausschließlich mit den im Architektur-Dokument beschriebenen CSV-Uploads!

**Deine Aufgabe:**
Führe die folgenden Schritte strikt sequenziell aus, um das Architektur-Konzept vollständig zu implementieren, zu testen, zu deployen und zu dokumentieren.

### Schritt 1: Analyse & Supabase Datenmodell
- Lies dir das Konzept unter `docs/master-4/ZERTIFIKATE-ARCHITEKTUR.md` durch.
- Überprüfe das bestehende Supabase-Schema (siehe `supabase/schema.sql` oder vorhandene Migrations) und erstelle die notwendigen SQL-Scripts/Migrationen für die neuen Tabellen (`external_customers`, `import_batches`, `invoices`, `participation_periods`, `certificate_issues` etc.).
- Führe die Datenbank-Migrationen lokal aus.

### Schritt 2: Backend-Logik & CSV-Parsing
- Implementiere die CSV-Parsing-Logik für `eintraege.csv`, `rechnungen-3.csv` und `produkte.csv`.
- Implementiere die komplexen Zuordnungsregeln (E-Mail-Abgleich, Rechnungsfreigabe, Erkennung von Stornos/Überzahlungen).

### Schritt 3: UI-Implementierung (Dashboard & Profil)
- Baue das Admin/Lehrer-Dashboard aus: Upload-Masken, Klärfälle-Ansicht, Teilnahmebestätigungs-Maske.
- Baue die Schüler-Profil-Ansicht aus: Anzeige der berechtigten/gesperrten Zeiträume inklusive logischer Fehlermeldungen (z.B. "Rechnung unbezahlt").

### Schritt 4: PDF-Generierung
- Implementiere die serverseitige PDF-Generierung mit `@react-pdf/renderer` als Route Handler.
- Nutze die Textbausteine aus dem Architektur-Dokument für das Layout.
- Stelle sicher, dass generierte PDFs im Supabase Storage (privat) gespeichert werden und nicht öffentlich einsehbar sind (RLS/Access Control).

### Schritt 5: Tests & lokaler Build
- Führe sinnvolle Tests aus (Type-Checks, Linter, evtl. vorhandene Jest/Playwright-Suites).
- Stelle sicher, dass die App lokal gebaut werden kann (`npm run build`). Behebe alle dabei auftretenden Fehler selbstständig!

### Schritt 6: Commit, Push & Deployment
- Wenn lokal alles sauber läuft, committe deine Änderungen mit atomaren, beschreibenden Commit-Messages.
- Push die Änderungen auf den Server/VPS.
- Führe das Deployment-Skript für den VPS aus (prüfe die Struktur in `package.json` oder im Repository, wie das Deployment gesteuert wird, z.B. per SSH-Deploy-Script, GitHub Action oder Docker-Build).

### Schritt 7: Dokumentation im Obsidian-Vault (Zwingend!)
- Mein Obsidian-Vault liegt unter: `/Users/denniskostjuk/Library/Mobile Documents/com~apple~CloudDocs/Obsidian/Life-OS/01 Projects/Sitov-Academy`
- Sichte dort die relevanten Markdown-Dateien (z.B. `02_Database_&_Schema.md`, `03_API_&_Server_Actions.md`, `11_Changelog.md`).
- **Schreibe mir keine Markdown-Zusammenfassung in diesen Chat.** Trage stattdessen die abgeschlossenen Aufgaben, das neue Supabase-Datenmodell und die API-Logiken selbstständig an den logisch richtigen Stellen in den existierenden Obsidian-Dateien ein und speichere sie ab.

Starte jetzt mit Schritt 1!
