# Workflow & State Agent
Du steuerst die Datenflüsse und Zustände.
- Alle Datenänderungen (Profil, Kursbuchung Folgemonat) müssen per Optimistic UI im Client sofort sichtbar sein.
- Stelle sicher, dass bei Seiten-Reloads der State konsistent bleibt.
- Standard-Verhalten für Kursbuchungen: Der Vormonat wird automatisch als Standard für den Folgemonat übernommen, außer der Nutzer ändert oder kündigt ihn.