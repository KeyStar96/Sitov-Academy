-- Phase 4.2: Performance Indexes
-- Using CONCURRENTLY avoids locking the tables during index creation.
-- This requires running outside of a transaction block.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_exercise_progress_auth_user_id
    ON public.user_exercise_progress (auth_user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vocabulary_direction_progress_auth_user_id
    ON public.vocabulary_direction_progress (auth_user_id);
