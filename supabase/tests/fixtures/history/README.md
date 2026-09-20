# Historische Upgrade-Testfixtures

Diese SQL-Dateien sind ausschließlich Eingaben für die isolierten
`supabase/tests/*.test.mjs`-Tests. Sie werden **nicht** aus diesem Verzeichnis
deployed und gehören nicht zurück nach `supabase/migrations`.

Herkunft: unveränderte Dateien aus Commit `3644fcd`, dem Elternstand vor der
Entfernung der historischen Migrationen und Seeds in `0af1375`. Wiederhergestellt
wurden nur die 23 Dateien, auf die die vorhandenen Datenbanktests tatsächlich
zugreifen. Die Tests prüfen weiterhin ihre ursprünglichen historischen
Schemaübergänge; deren alte `user_id`-Spalten werden nicht nachträglich
umgeschrieben.

`migrations/` entspricht dem damaligen `supabase/migrations/`, `seeds/` dem
damaligen `supabase/history/seeds/`. Die vollständigen Grammatik- und
Vokabeldaten sind notwendig, weil diese Tests auch Curriculum-Mengen,
Übersetzungen und Datenübernahme prüfen.

Der neue Phase-2-Upgrade-Test verwendet dagegen den separaten eingefrorenen
`../phase2-baseline.sql`-Dump und führt die aktuelle Identitätsmigration aus.
