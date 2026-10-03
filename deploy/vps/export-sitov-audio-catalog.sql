-- Read-only authoring export. Pipe psql -X -qAt output into a private local file.
-- Contains learning text only: no accounts, learner answers, progress or keys.
BEGIN READ ONLY;
-- psql executes the selected statement only: exports remain valid before the
-- queue migration has been deployed. Both statements are authored read-only SQL.
SELECT CASE WHEN to_regclass('public.sitov_audio_preparation_requests') IS NULL
  THEN 'SELECT ''[]''::jsonb AS sitov_pending_audio_rows'
  ELSE 'SELECT coalesce(jsonb_agg(jsonb_build_object(''cache_path'', cache_path, ''text'', text, ''profile_fingerprint'', profile_fingerprint) ORDER BY created_at, cache_path), ''[]''::jsonb) AS sitov_pending_audio_rows FROM public.sitov_audio_preparation_requests WHERE status = ''pending'''
END AS sitov_pending_audio_query \gset
:sitov_pending_audio_query \gset
SELECT jsonb_build_object(
  'schemaVersion', 1,
  'brand', 'Sitov Academy',
  'exported_at', now(),
  'pending_audio_preparations', :'sitov_pending_audio_rows'::jsonb,
  -- Service-owned author metadata and system metadata are separate contracts.
  -- Archived versions and delete markers never establish prepared coverage.
  'storage_audio_inventory', coalesce((SELECT jsonb_agg(jsonb_build_object(
    'bucket_id', o.bucket_id, 'name', o.name, 'user_metadata', o.user_metadata,
    'metadata', o.metadata, 'archived_at', o.archived_at, 'is_delete_marker', o.is_delete_marker
  ) ORDER BY o.name) FROM storage.objects o
    WHERE o.bucket_id = 'audio_cache' AND o.name LIKE 'sitov-qwen-v1/de/%'
      AND o.archived_at IS NULL AND coalesce(o.is_delete_marker, false) = false), '[]'::jsonb),
  'counts', jsonb_build_object(
    'vocabularyCards', (SELECT count(*) FROM public.learning_vocabulary_cards),
    'readingTexts', (SELECT count(*) FROM public.learning_reading_texts),
    'exercises', (SELECT count(*) FROM public.learning_exercises),
    'dailyQuestTemplates', (SELECT count(*) FROM public.daily_quests),
    'renderedDailyQuestVariants', (SELECT count(*) FROM public.daily_quests q
      JOIN daily_quest_private.slot_forms f ON f.category = q.category),
    'verbReferences', (SELECT count(*) FROM public.sitov_verb_catalog)
  ),
  'learning_vocabulary_cards', coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id)
    FROM (SELECT id, word_de, article, plural, audio_url, sentence_practice,
      alternative_answers_de, target_form FROM public.learning_vocabulary_cards) v), '[]'::jsonb),
  'vocabulary_translations', coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.card_id)
    FROM (SELECT card_id, locale, translation, context_sentence
      FROM public.vocabulary_translations WHERE locale = 'de') v), '[]'::jsonb),
  'learning_reading_texts', coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id)
    FROM (SELECT id, sentence_de, audio_url FROM public.learning_reading_texts) r), '[]'::jsonb),
  'learning_exercises', coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id)
    FROM (SELECT id, type, content, solution_audio_url, content_status, path_is_active
      FROM public.learning_exercises) e), '[]'::jsonb),
  'daily_quests', coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id', q.id, 'template_key', q.template_key, 'level', q.level, 'category', q.category,
    'nominative', f.nominative, 'accusative', f.accusative,
    'content', daily_quest_private.render(q.content, f.nominative, f.accusative)
  ) ORDER BY q.id, f.nominative, f.accusative)
    FROM public.daily_quests q JOIN daily_quest_private.slot_forms f ON f.category = q.category), '[]'::jsonb),
  'daily_quest_assignment_audio_texts', coalesce((SELECT jsonb_agg(a.audio_text ORDER BY a.audio_text)
    FROM (SELECT DISTINCT value #>> '{}' AS audio_text
      FROM public.daily_quest_assignments d
      CROSS JOIN LATERAL jsonb_path_query(d.snapshot, '$.**.audioText') AS value
      WHERE jsonb_typeof(value) = 'string') a), '[]'::jsonb),
  'sitov_verb_catalog', coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id)
    FROM (SELECT id, level FROM public.sitov_verb_catalog) v), '[]'::jsonb)
);
ROLLBACK;
