-- Disable the feature before rolling back the matching application. Preserve
-- all earned streaks, opted-out preferences and historical daily assignments.
-- Reapplying 59 restores the functions and ACLs without losing learner data.
REVOKE ALL ON FUNCTION public.claim_daily_quest_login(),public.get_daily_quest(),public.get_daily_quest_status(),public.set_daily_quest_enabled(boolean),public.submit_daily_quest_step(uuid,text,jsonb),public.skip_daily_quest(uuid),public.complete_daily_quest(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION daily_quest_private.handle(text,uuid,text,jsonb,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_daily_quest_preview(text),daily_quest_private.preview(text) FROM PUBLIC,anon,authenticated;
REVOKE SELECT ON public.daily_quests,public.daily_quest_assignments FROM authenticated;
REVOKE ALL ON SCHEMA daily_quest_private FROM authenticated;
NOTIFY pgrst,'reload schema';
