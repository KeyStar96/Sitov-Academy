# Trainer-Freigaben pro Schüler und Niveau

Stand: 10.09.2026. Projektbindung: `wcaslabeiwtvygxtzcio`.

## Bedienung

Im Lehrer-Dashboard **Schüler → Trainer-Freigaben** das gewünschte Niveau öffnen. Der Zähler zeigt die Anzahl der aktiven Trainer. Die vier Checkboxen steuern Vokabeltrainer, Grammatikübungen, Aussprache-Training und Lernvideos getrennt. Ein Niveau muss zuerst freigegeben sein; bei einem vollständig gesperrten Niveau sind dessen Trainer-Schalter deaktiviert. Änderungen speichern sofort, sperren wiederholte Klicks während des Speicherns und werden bei einem Fehler zurückgenommen.

Vorhandene Niveau-Freigaben gelten weiterhin für alle Trainer, solange kein Override existiert. Das Entziehen und erneute Freigeben eines Niveaus erhält seine individuellen Trainer-Einstellungen. Lehrer und Administratoren behalten Vollzugriff. Sperren löschen keine Fortschritte, Aufnahmen oder Dialoge.

## Umsetzung und Sicherheit

- Tabelle `student_trainer_access`: Primärschlüssel `(user_id, level, trainer)`, typisierte IDs, Fremdschlüssel zum Profil, RLS. Schüler können ausschließlich ihre eigenen Overrides lesen; nur authentifizierte Lehrer/Admins können sie setzen, ändern oder löschen. Pro SQL-Kommando existiert genau eine permissive Policy.
- `loadLevelAccessProfile` lädt die Rechte per eingebettetem Join; `hasTrainerAccess` kombiniert Niveau-Freigabe und optionalen Override. Die Server Action validiert das gesamte Eingabeobjekt, prüft die echte Profilrolle und schreibt über den Session-Client mit RLS.
- `LevelTrainerCards` trennt die Darstellung von der Server-Datenbeschaffung. Gesperrte Karten sind nicht verlinkt, haben `aria-disabled`, Schloss, Erklärung und einen gestrichelten Rahmen. Alle Texte sind in DE/EN/RU/UK/TR vorhanden. Design-Tokens erhalten Hell-, Dunkel- und Hochkontrastdarstellung.
- Vier Trainer-Layouts sichern auch Unterseiten (Vokabeleinstufung/Training und einzelne Video-Links). Server Actions verwenden Trainer-Prüfungen; zusätzlich sichern restriktive RLS-Policies die Inhalte ab. Die privaten Vokabel-/Grammatik-/Aussprache-RPCs prüfen den Trainer vor Lesen/Bewerten/Schreiben. Auch idempotente Antwort-Replays verweigern gesperrte Inhalte.
- Aussprache-Dialoge und das Ausstellen neuer signierter URLs für zugeordnete private Aufnahmen beachten die Freigabe. Ohne irgendeine Aussprache-Freigabe sind neue Audio-Uploads gesperrt. Der Lernreset kann weiterhin seine freigegebenen Storage-Manifeste lesen/löschen. Bereits vorher ausgegebene signierte URLs behalten technisch ihre bestehende Gültigkeit (bisher 3600 Sekunden); bereits heruntergeladene Dateien und öffentliche YouTube-Links lassen sich nicht zurückrufen.
- Vorhandene Daten und Berechtigungen wurden nicht geändert. Live-Vergleich vor/nach Migration: 7 Profile, 84 Registrierungen, 112 Kurszuordnungen, 69 Grammatik-Fortschritte, 230 Vokabel-Richtungsfortschritte, 2 Einsendungen, 2 Aufnahmen; identische Prüfsumme der Profilrollen/Niveau-Freigaben. Die neue Override-Tabelle blieb bei der Einführung leer.

## Migrationen und Prüfung

- CLI-generierte Migrationen `20260910213453_student_trainer_access.sql` und `20260910214425_trainer_access_policy_commands.sql` über Supabase MCP erfolgreich angewendet. `schema.sql` synchronisiert und TypeScript-Typen frisch vom Projekt generiert.
- 969 Jest-Tests in 68 Suites bestanden, einschließlich 19 neuer Tests für einzelne Freigaben, die Lehrer-Action, Fehler-Rollback und lokalisierte Schloss-Karten.
- 130 isolierte PostgreSQL/PGlite-Tests bestanden. Der neue Test umfasst insbesondere Selbstfreischaltung, fremde Daten, Rollen, Niveau-/Trainer-Trennung, direkte Lern-RPCs, Vokabel-Replays sowie Audio-/Dialog-Sperren und Wiederfreigabe. Nach der Policy-Aufteilung alle 11 Tests dieser Suite erneut bestanden.
- Browserprüfung mit fiktiven Vorschau-Daten: Desktop, mobile Schüler-/Lehreransicht bei 390px, Hell/Dunkel und Hochkontrast. Keine horizontalen Überläufe auf dem Smartphone. Ein veralteter lokaler CSS-Cache wurde mit einem temporären No-Cache-Proxy umgangen; Vorschau-Routen und Proxy wurden danach entfernt. Keine produktiven Schüler-Freigaben für Tests verändert.
- Produktionsbuild mit Webpack einschließlich TypeScript-Prüfung erfolgreich. Die vorhandenen Security-Advisor-Hinweise sind unverändert; keine neuen Security-Hinweise und keine Performance-Hinweise für die neue Rechte-Tabelle/private Schema.
