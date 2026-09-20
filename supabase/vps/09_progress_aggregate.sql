-- Phase 4.2: Aggregation for admin dashboard
-- SECURITY DEFINER and search_path='' to safely access all user data.
-- Staff-only authorization enforced internally.

CREATE OR REPLACE FUNCTION public.get_all_students_progress_data()
RETURNS jsonb
SECURITY DEFINER SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
    result jsonb := '{}'::jsonb;
BEGIN
    -- Authorization Check
    IF NOT business_private.is_staff() THEN
        RETURN jsonb_build_object('error', 'not_authorized', 'message', 'Staff access required.');
    END IF;

    -- The aggregation matches the TS logic:
    -- 1. Total exercises and vocab per level
    -- 2. Completed exercises per user per level
    -- 3. Completed vocab per user per level (both directions box=7)
    -- 4. Math.round((completed / total) * 100)

    WITH totals AS (
        SELECT u.level, COUNT(e.id) as total_items
        FROM public.learning_units u
        JOIN public.learning_exercises e ON e.unit_id = u.id
        GROUP BY u.level
        UNION ALL
        SELECT u.level, COUNT(v.id) as total_items
        FROM public.learning_units u
        JOIN public.learning_vocabulary_cards v ON v.unit_id = u.id
        GROUP BY u.level
    ),
    level_totals AS (
        SELECT level, SUM(total_items) as total_items
        FROM totals
        GROUP BY level
    ),
    completed_exercises AS (
        SELECT p.auth_user_id, u.level, COUNT(p.exercise_id) as completed_items
        FROM public.user_exercise_progress p
        JOIN public.learning_exercises e ON e.id = p.exercise_id
        JOIN public.learning_units u ON u.id = e.unit_id
        WHERE p.completed = true
        GROUP BY p.auth_user_id, u.level
    ),
    learned_vocab AS (
        SELECT p1.auth_user_id, p1.card_id
        FROM public.vocabulary_direction_progress p1
        JOIN public.vocabulary_direction_progress p2
          ON p1.auth_user_id = p2.auth_user_id AND p1.card_id = p2.card_id
        WHERE p1.direction = 'de_to_native' AND p1.box_number = 7
          AND p2.direction = 'native_to_de' AND p2.box_number = 7
    ),
    completed_vocab AS (
        SELECT lv.auth_user_id, u.level, COUNT(lv.card_id) as completed_items
        FROM learned_vocab lv
        JOIN public.learning_vocabulary_cards v ON v.id = lv.card_id
        JOIN public.learning_units u ON u.id = v.unit_id
        GROUP BY lv.auth_user_id, u.level
    ),
    user_level_completed AS (
        SELECT auth_user_id, level, SUM(completed_items) as total_completed
        FROM (
            SELECT * FROM completed_exercises
            UNION ALL
            SELECT * FROM completed_vocab
        ) sub
        GROUP BY auth_user_id, level
    ),
    user_percentages AS (
        SELECT
            users.auth_user_id,
            t.level,
            ROUND((COALESCE(c.total_completed, 0)::numeric / t.total_items) * 100) as percentage
        FROM (SELECT DISTINCT auth_user_id FROM user_level_completed) users
        CROSS JOIN level_totals t
        LEFT JOIN user_level_completed c ON c.auth_user_id = users.auth_user_id AND c.level = t.level
        WHERE t.total_items > 0
    )
    SELECT COALESCE(
        jsonb_object_agg(
            agg.auth_user_id::text,
            agg.levels_obj
        ),
        '{}'::jsonb
    ) INTO result
    FROM (
        SELECT
            auth_user_id,
            jsonb_object_agg(level, percentage) as levels_obj
        FROM user_percentages
        GROUP BY auth_user_id
    ) agg;

    RETURN result;
EXCEPTION WHEN OTHERS THEN
    -- R10: expose stable codes, never SQLERRM, queries or customer data.
    RETURN jsonb_build_object('error', 'request_failed',
        'message', 'Progress could not be loaded.', 'sqlstate', SQLSTATE);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_all_students_progress_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_all_students_progress_data() TO authenticated;

-- Rollback: activate the pre-Phase-4 application (59f18b3) before removing this
-- additive RPC, then DROP FUNCTION IF EXISTS public.get_all_students_progress_data();
-- The previous app computes progress from the original, unchanged tables.
