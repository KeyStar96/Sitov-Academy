-- No destructive rollback: PostgreSQL enum labels cannot be removed safely.
-- Apply rollback/63_verb_trainer.sql and roll back the application release.
-- Existing enum values and all previous trainer behaviour remain available.
SELECT 1;
