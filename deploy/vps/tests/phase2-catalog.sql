-- Read-only acceptance assertions for the application schemas after Phase 2.
DO $$
DECLARE bad text;
BEGIN
 SELECT string_agg(table_schema||'.'||table_name,', ') INTO bad FROM information_schema.columns
 WHERE column_name='user_id' AND table_schema IN('public','vocabulary_private','learning_reset_private','business_private');
 IF bad IS NOT NULL THEN RAISE EXCEPTION 'Legacy identity columns remain: %',bad; END IF;
 SELECT string_agg(schemaname||'.'||tablename||':'||policyname,', ') INTO bad FROM pg_policies
 WHERE schemaname IN('public','vocabulary_private','learning_reset_private') AND (coalesce(qual,'')||coalesce(with_check,'')) ~ '\muser_id\M';
 IF bad IS NOT NULL THEN RAISE EXCEPTION 'Legacy identity policies remain: %',bad; END IF;
 SELECT string_agg(n.nspname||'.'||p.proname,', ') INTO bad FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN('public','vocabulary_private','learning_reset_private','learning_private','trainer_access_private','pronunciation_private','grammar_private','business_private')
 AND p.prokind='f' AND p.prosrc ~ '\muser_id\M';
 IF bad IS NOT NULL THEN RAISE EXCEPTION 'Legacy identity function bodies remain: %',bad; END IF;
 SELECT string_agg(p.proname,', ') INTO bad FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind='f' AND p.prorettype<>'trigger'::regtype
 AND (p.prorettype<>'jsonb'::regtype OR p.proretset OR strpos(p.prosrc,'-- phase2-rpc-error-boundary-v1')=0);
 IF bad IS NOT NULL THEN RAISE EXCEPTION 'RPC JSONB error boundaries missing: %',bad; END IF;
 SELECT string_agg(c.relname||'.'||a.attname,', ') INTO bad FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r' AND a.attname='level' AND NOT EXISTS(
 SELECT 1 FROM pg_constraint k WHERE k.conrelid=c.oid AND k.contype='f' AND a.attnum=ANY(k.conkey) AND k.confrelid='public.learning_levels'::regclass);
 IF bad IS NOT NULL THEN RAISE EXCEPTION 'Missing direct level FK: %',bad; END IF;
 SELECT string_agg(c.relname,', ') INTO bad FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r' AND a.attname='updated_at' AND NOT EXISTS(
 SELECT 1 FROM pg_trigger t WHERE t.tgrelid=c.oid AND t.tgenabled<>'D' AND t.tgfoid='platform_private.touch_updated_at()'::regprocedure);
 IF bad IS NOT NULL THEN RAISE EXCEPTION 'Missing updated_at trigger: %',bad; END IF;
 SELECT string_agg(c.conname,', ') INTO bad FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace
 JOIN pg_attribute a ON a.attrelid=r.oid AND a.attnum=ANY(c.conkey)
 WHERE n.nspname IN('public','private','vocabulary_private','learning_reset_private') AND c.contype='c'
 AND pg_get_constraintdef(c.oid) ~ 'ANY \(ARRAY' AND a.atttypid='text'::regtype
 AND NOT EXISTS(SELECT 1 FROM pg_constraint f WHERE f.conrelid=r.oid AND f.contype='f' AND a.attnum=ANY(f.conkey));
 IF bad IS NOT NULL THEN RAISE EXCEPTION 'Text value sets without FK/enum remain: %',bad; END IF;
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.learning_videos'::regclass AND conname='learning_videos_unit_id_key') THEN RAISE EXCEPTION 'Video unit still unique'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='course-assets' AND NOT public AND file_size_limit=536870912) THEN RAISE EXCEPTION 'Private media bucket missing'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND policyname LIKE 'course_assets_%')<>4 THEN RAISE EXCEPTION 'Media storage policies missing'; END IF;
 IF has_table_privilege('authenticated','public.course_exceptions','INSERT') THEN RAISE EXCEPTION 'Direct course exception inserts exposed'; END IF;
 IF EXISTS(SELECT 1 FROM public.learning_exercises WHERE NOT(content ? 'accepted_answers')) THEN RAISE EXCEPTION 'accepted_answers missing'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND (table_name='submissions' AND column_name='prompt_title' OR table_name='cancellation_requests' AND column_name='course_name')) THEN RAISE EXCEPTION 'Transitive columns remain'; END IF;
END $$;
SELECT 'Phase 2 catalog assertions passed' AS result;
