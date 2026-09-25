-- Rollback of supabase/vps/32_last_active_level.sql (Master 4, Phase 2.6).
-- R9: take a fresh R8 backup first. Only the read-only function is removed; no
-- learner data, table or grant of another object changes. The Phase 2 client
-- treats the missing function as an RPC failure and falls back to the first
-- unlocked level (Home) and the browser's last level (tab "Lernen").
DROP FUNCTION IF EXISTS public.get_last_active_level();
