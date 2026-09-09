# Supabase-Deployment am 09.09.2026

Projekt: **SmartGerman v2**, `wcaslabeiwtvygxtzcio`, Region `eu-west-1`.
Beide Migrationen wurden auf ausdrücklichen Nutzerauftrag in dieser Reihenfolge
über Supabase MCP `apply_migration` erfolgreich auf Produktion angewendet.

| Lokale Datei unter `supabase/migrations/` | Live-Version | Live-Name |
| --- | --- | --- |
| `20260909155919_monthly_bookings_teacher_notes.sql` | `20260909172738` | `monthly_bookings_teacher_notes` |
| `20260909165848_profile_dashboard_workflow.sql` | `20260909172746` | `profile_dashboard_workflow` |

MCP vergibt beim Anwenden die Live-Version. Die oben aufgeführten Dateien sind
bereits ausgeführt und dürfen nicht anhand ihrer abweichenden lokalen Zeitstempel
nochmals als ausstehend behandelt werden. Historische Migrationen wurden nicht
erneut ausgeführt. Dieses Deployment umfasst die Datenbank; kein App-Deployment.

## Live-Prüfungen nach dem Anwenden

- Beide Migrationen stehen in `supabase_migrations.schema_migrations`.
- Kontaktfelder und `legacy_user_id` sind vorhanden. Der validierte Rollen-CHECK
  akzeptiert `student`, `teacher` und `admin`.
- Alle Kurse haben eine eindeutige, nicht leere `booking_id`-UUID. Der Hash über
  sämtliche bisherigen Kursfelder stimmt mit dem Stand unmittelbar vor dem
  Deployment überein; bestehende Text-IDs wurden nicht verändert.
- Alle 78 `users`-Zeilen sind anhand eines vollständigen Vorher-/Nachher-Hashes
  unverändert. Es bestehen weiterhin sechs Profile.
- Alle 78 Kontakt-Snapshots stimmen feldgenau mit ihren Quellen überein.
  Audit: 75 `no_verified_profile`, drei `ambiguous_legacy`, null `copied`.
  Eine personenbezogene Klärung bleibt für die automatische Profilzuordnung nötig.
- RLS ist auf beiden neuen öffentlichen und beiden privaten Tabellen aktiviert.
  Die öffentlichen Policies enthalten die vorgesehenen Eigentümer-/Staff-Regeln.
- Browser dürfen Kontakt-/Namensfelder ändern; Rolle, Level, Auth-E-Mail,
  Stripe-Customer-ID und Legacy-Zuordnung sind nicht direkt beschreibbar.
- Die Buchungsfunktion ist für `authenticated`, nicht für `anon` ausführbar.
  Alle sechs neuen Funktionen haben einen fest gesetzten leeren `search_path`;
  sämtliche vier neuen Trigger sind aktiviert.
- Ein zusätzlicher Live-Test in einer ausschließlich lesenden Transaktion mit
  Schülerrechten bestand: eigenes Profil sichtbar, keine fremden Buchungen oder
  Lehrernotizen sichtbar, Zugriff auf Audit und private Kursprojektion verweigert.
  Schreib-/Konfliktfälle wurden zuvor isoliert mit PGlite getestet; es wurden keine
  Testbuchungen oder Testkonten in Produktion angelegt.

## Supabase Advisors

Die Sicherheitsprüfung vor und nach dem Deployment zeigt keine neuen WARN-/ERROR-
Befunde. Bestehende Warnungen betreffen alte öffentliche Funktionen und deaktivierten
Schutz gegen kompromittierte Passwörter. Zwei neue INFO-Befunde zu privaten Tabellen
mit RLS ohne Policies sind beabsichtigt: Browser sollen keinen direkten Zugriff haben.

Die Performance-Prüfung enthält Hinweise zu bestehenden fehlenden FK-Indizes und
RLS-Auswertungen, zu noch unbenutzten Indizes sowie parallelen permissiven Policies.
Die getrennten Eigen-/Staff-SELECT-Policies auf `profiles` erzeugen ebenfalls einen
solchen Performance-Hinweis; ihre kombinierte Sichtbarkeit ist beabsichtigt. Diese
Prüfung ist kein Nachweis einer vollständigen Sicherheits- oder Performance-Freigabe
der bestehenden Anwendung.
