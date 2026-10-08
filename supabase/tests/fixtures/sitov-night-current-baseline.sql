-- Entirely synthetic QA accounts/content. No real audio bytes or publication proof.
INSERT INTO auth.users(id,email,email_confirmed_at,created_at,raw_user_meta_data)
SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'sitov-qa-'||n||'@example.test','2026-09-01','2026-09-01',
 jsonb_build_object('display_name','Sitov QA Paul '||n,'native_language',CASE WHEN n=105 THEN 'de' ELSE 'ru' END,
  'ui_language',CASE WHEN n=105 THEN 'de' ELSE 'ru' END)
FROM generate_series(101,108) n;
UPDATE public.profiles SET role='teacher' WHERE id='00000000-0000-4000-8000-000000000106';
INSERT INTO public.learning_units(id,level,trainer,label,sort_order)
SELECT ('00000000-0000-4000-8000-'||lpad((200+ordinality*10+variation)::text,12,'0'))::uuid,
 'A1.1',trainer::public.trainer_code,'Sitov QA '||trainer||' '||variation,variation
FROM unnest(ARRAY['vocabulary','exercises','pronunciation','videos']) WITH ORDINALITY t(trainer,ordinality)
CROSS JOIN generate_series(1,2) variation;
INSERT INTO public.student_level_access(auth_user_id,level)
SELECT id,l.code FROM public.profiles CROSS JOIN public.learning_levels l
WHERE id::text LIKE '00000000-0000-4000-8000-00000000010%' AND id<>'00000000-0000-4000-8000-000000000107'
 AND role='student' AND l.code IN('A1.1','A1.2');
-- Absent trainer grant = historical null/default all. Explicit all remains distinct.
INSERT INTO public.learning_trainer_grants(auth_user_id,level,trainer,enabled,unit_mode)
SELECT p.id,'A1.1',t.code,p.id<>'00000000-0000-4000-8000-000000000104',
 CASE WHEN p.id IN('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000103')
 THEN 'selected'::public.unit_access_mode ELSE 'all'::public.unit_access_mode END
FROM public.profiles p CROSS JOIN public.learning_trainers t
WHERE p.id IN('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000103',
 '00000000-0000-4000-8000-000000000104','00000000-0000-4000-8000-000000000108')
AND t.code::text IN('vocabulary','exercises','pronunciation','videos');
INSERT INTO public.learning_unit_grants(auth_user_id,level,trainer,unit_id)
SELECT '00000000-0000-4000-8000-000000000103','A1.1',trainer,id
FROM public.learning_units WHERE label LIKE 'Sitov QA % 1';
INSERT INTO public.learning_vocabulary_cards(id,word_de,unit_id)
VALUES('00000000-0000-4000-8000-000000000301','Haus','00000000-0000-4000-8000-000000000211');
INSERT INTO public.learning_reading_texts(id,sentence_de,unit_id)
VALUES('00000000-0000-4000-8000-000000000302','Paul geht nach Hause.','00000000-0000-4000-8000-000000000231');
INSERT INTO public.learning_videos(id,unit_id,title,source_url)
VALUES('00000000-0000-4000-8000-000000000303','00000000-0000-4000-8000-000000000241','Sitov QA Link','https://example.test/sitov-qa');
INSERT INTO public.vocabulary_direction_progress(auth_user_id,card_id,direction,box_number,lapses,last_answered_at)
VALUES('00000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-000000000301','de_to_native',4,2,'2026-10-01');
INSERT INTO public.sitov_pronunciation_access(auth_user_id,level,mode)
VALUES('00000000-0000-4000-8000-000000000103','A1.1','hard');
INSERT INTO public.submissions(id,auth_user_id,type,content_url,level,prompt_id,created_at)
VALUES('00000000-0000-4000-8000-000000000304','00000000-0000-4000-8000-000000000103','audio',
 'storage://pronunciation_audio/00000000-0000-4000-8000-000000000103/00000000-0000-4000-8000-000000000305.webm',
 'A1.1','00000000-0000-4000-8000-000000000302','2026-10-01');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000106',false);
INSERT INTO public.pronunciation_messages(id,submission_id,sender_id,sender_role,text_content,created_at)
VALUES('00000000-0000-4000-8000-000000000306','00000000-0000-4000-8000-000000000304',
 '00000000-0000-4000-8000-000000000106','teacher','Sitov QA: Paul, das ist gut verständlich.','2026-10-02');
SELECT set_config('request.jwt.claim.sub','',false);
INSERT INTO storage.objects(id,bucket_id,name,owner,metadata)
VALUES('00000000-0000-4000-8000-000000000305','pronunciation_audio',
 '00000000-0000-4000-8000-000000000103/00000000-0000-4000-8000-000000000305.webm',
 '00000000-0000-4000-8000-000000000103','{"size":1000,"mimetype":"audio/webm"}');
INSERT INTO public.sitov_learning_checkpoints(auth_user_id,kind,level,state,revision)
VALUES('00000000-0000-4000-8000-000000000103','pronunciation','A1.1',
 '{"promptId":"00000000-0000-4000-8000-000000000302","stage":"recording","playbackPosition":3}',7);
INSERT INTO public.learning_activity_days(auth_user_id,day,study_seconds,answer_count,mode_seconds)
VALUES('00000000-0000-4000-8000-000000000103','2026-09-29',120,3,'{"vocabulary":120}'),
 ('00000000-0000-4000-8000-000000000103','2026-09-30',180,5,'{"vocabulary":180}')
ON CONFLICT(auth_user_id,day) DO NOTHING;
