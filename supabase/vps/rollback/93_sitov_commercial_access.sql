-- Sitov Academy: refuse rollback after any configuration/access/order change.
DO $$ DECLARE f record; BEGIN
 IF EXISTS(SELECT 1 FROM sitov_access_private.students)
 OR EXISTS(SELECT 1 FROM sitov_access_private.orders)
 OR EXISTS(SELECT 1 FROM sitov_access_private.purchases)
 OR EXISTS(SELECT 1 FROM sitov_access_private.products WHERE amount_minor IS NOT NULL OR revision<>0)
 OR EXISTS(SELECT 1 FROM sitov_access_private.billing_settings WHERE enabled OR revision<>0)
 THEN RAISE EXCEPTION 'sitov_commercial_rollback_requires_preserved_grants'; END IF;
 FOR f IN SELECT definition FROM sitov_access_private.guard_backups LOOP EXECUTE f.definition;END LOOP;
 DROP POLICY IF EXISTS sitov_commercial_item_scope ON public.learning_vocabulary_cards;
 DROP POLICY IF EXISTS sitov_commercial_item_scope ON public.learning_exercises;
 DROP POLICY IF EXISTS sitov_commercial_item_scope ON public.learning_reading_texts;
 DROP POLICY IF EXISTS sitov_commercial_item_scope ON public.learning_videos;
 DROP POLICY IF EXISTS sitov_commercial_item_scope ON public.lms_presentation_asset;
 DROP FUNCTION public.get_sitov_access_catalog(text,text);
 DROP FUNCTION public.set_sitov_student_vip(uuid,boolean,bigint),public.set_sitov_student_trial(uuid,jsonb,bigint),
 public.get_sitov_access_context(uuid),public.get_sitov_billing_settings(),public.set_sitov_billing_enabled(boolean,bigint),
 public.set_sitov_product_price(text,bigint,text,bigint),public.start_sitov_checkout(text,uuid);
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sitov_access_private' LOOP
  EXECUTE 'DROP FUNCTION '||f.signature; -- RESTRICT: later dependent features must be reviewed, never CASCADE.
 END LOOP;
 DROP TABLE sitov_access_private.guard_backups,sitov_access_private.purchases,sitov_access_private.orders,sitov_access_private.products,sitov_access_private.billing_settings,sitov_access_private.students;
 DROP SCHEMA sitov_access_private;
END $$;
