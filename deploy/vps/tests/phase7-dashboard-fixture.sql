-- Synthetic local dashboard workload: exactly 200 learners, no production data.
-- Deterministic RFC4122-shaped identifiers, matching the application's UUID validation.
CREATE OR REPLACE FUNCTION pg_temp.phase7_uuid(seed text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
 SELECT (substr(h,1,8)||'-'||substr(h,9,4)||'-4'||substr(h,14,3)||'-8'||substr(h,18,3)||'-'||substr(h,21,12))::uuid FROM (SELECT md5(seed) h) hash
$$;
INSERT INTO cefr_levels(code) VALUES('A2'),('B1') ON CONFLICT DO NOTHING;
INSERT INTO learning_levels(code,cefr_level,sort_order)
 VALUES('A2.1','A2',3),('A2.2','A2',4),('B1.1','B1',5),('B1.2','B1',6) ON CONFLICT DO NOTHING;
INSERT INTO auth.users(id,email,email_confirmed_at,created_at)
 SELECT pg_temp.phase7_uuid('phase7-student-'||n),'student-'||n||'@example.invalid',now(),now()-interval '45 days'
 FROM generate_series(1,198) n ON CONFLICT DO NOTHING;
INSERT INTO profiles(id,role,native_language,ui_language,created_at)
 SELECT id,'student','en','en',created_at FROM auth.users WHERE email LIKE 'student-%@example.invalid' ON CONFLICT DO NOTHING;
INSERT INTO people(auth_user_id,display_name,email,preferred_locale)
 SELECT p.id,CASE WHEN p.id='00000000-0000-4000-8000-000000000081' THEN 'Ada Lernende'
 WHEN p.role='teacher' THEN 'Toni Lehrkraft' ELSE 'Testperson '||left(p.id::text,8) END,u.email,'en'
 FROM profiles p JOIN auth.users u ON u.id=p.id ON CONFLICT(auth_user_id) DO UPDATE SET display_name=excluded.display_name;
INSERT INTO student_level_access(auth_user_id,level)
 SELECT id,'A1.1' FROM profiles WHERE role='student' ON CONFLICT DO NOTHING;
INSERT INTO learning_units(id,level,trainer,label,sort_order)
 VALUES('00000000-0000-4000-8000-000000000096','A1.1','vocabulary','Leistungsprüfung',9) ON CONFLICT DO NOTHING;
INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,sentence_practice)
 SELECT pg_temp.phase7_uuid('phase7-card-'||n),'00000000-0000-4000-8000-000000000096','Prüfwort '||n,false
 FROM generate_series(1,100) n ON CONFLICT DO NOTHING;
INSERT INTO vocabulary_direction_progress(auth_user_id,card_id,direction,box_number,next_review_date,last_answered_at)
 SELECT p.id,c.id,d.direction::vocabulary_direction,1+abs(hashtext(c.id::text)%6),now()-interval '1 day',now()-interval '2 days'
 FROM profiles p CROSS JOIN learning_vocabulary_cards c CROSS JOIN (VALUES('de_to_native'),('native_to_de')) d(direction)
 WHERE p.role='student' AND p.id<>'00000000-0000-4000-8000-000000000081'
 AND c.unit_id='00000000-0000-4000-8000-000000000096' ON CONFLICT DO NOTHING;
INSERT INTO vocabulary_private.answer_receipts(auth_user_id,request_id,progress_id,is_correct,typed_answer,ui_language,response,created_at,target_level)
 SELECT auth_user_id,pg_temp.phase7_uuid('phase7-receipt-'||id),id,true,'Prüfantwort','en',
 '{"success":true,"isCorrect":true,"grade":{"status":"EXACT"},"previousPhase":2,"newPhase":3}',now()-interval '2 days','A1.1'
 FROM vocabulary_direction_progress WHERE direction='native_to_de' ON CONFLICT DO NOTHING;
INSERT INTO learning_activity_days(auth_user_id,day,study_seconds,answer_count,mode_seconds,last_activity_at)
 SELECT p.id,(now() AT TIME ZONE 'Europe/Berlin')::date-n,300+n,20,
 jsonb_build_object('vocabulary',200,'path',100+n),(now()-make_interval(days=>n))
 FROM profiles p CROSS JOIN generate_series(0,29) n WHERE p.role='student'
 ON CONFLICT(auth_user_id,day) DO UPDATE SET study_seconds=excluded.study_seconds,answer_count=excluded.answer_count,
 mode_seconds=excluded.mode_seconds,last_activity_at=excluded.last_activity_at;
-- Highlight learner: shared receipts and a private word; private content must never reach teacher RPCs.
UPDATE vocabulary_direction_progress SET box_number=5 WHERE card_id='00000000-0000-4000-8000-000000000100' AND direction='de_to_native';
INSERT INTO vocabulary_private.answer_receipts(auth_user_id,request_id,progress_id,is_correct,typed_answer,ui_language,response,target_level)
 SELECT auth_user_id,pg_temp.phase7_uuid('ada-receipt-'||id),id,false,
 CASE WHEN card_id='00000000-0000-4000-8000-000000000104' THEN 'PRIVATE-ANSWER-DO-NOT-EXPOSE' ELSE 'Brott' END,
 'en','{"success":true,"isCorrect":false,"grade":{"status":"INCORRECT"},"previousPhase":3,"newPhase":1}','A1.1'
 FROM vocabulary_direction_progress WHERE auth_user_id='00000000-0000-4000-8000-000000000081' AND direction='de_to_native' ON CONFLICT DO NOTHING;
INSERT INTO vocabulary_carryover_preferences(auth_user_id,target_level,enabled,started_at,decided_at)
 VALUES('00000000-0000-4000-8000-000000000081','A1.2',true,now(),now()) ON CONFLICT DO NOTHING;
-- Completed exercises unlock the first test, while the second path starts locked.
INSERT INTO path_node_progress(auth_user_id,node_id,status,best_stars,first_attempt_accuracy,completed_at)
 SELECT '00000000-0000-4000-8000-000000000081',n.id,'completed',3,100,now()-interval '1 day'
 FROM path_nodes n JOIN learning_units u ON u.id=n.unit_id WHERE u.is_path AND u.sort_order=1 AND n.kind IN('practice','review') ON CONFLICT DO NOTHING;
INSERT INTO path_test_attempts(id,auth_user_id,node_id,status,selected_exercise_ids,percentage,passed,created_at,completed_at)
 SELECT pg_temp.phase7_uuid('phase7-test-'||p.id||'-'||attempt),p.id,n.id,'completed',
 ARRAY(SELECT e.id FROM learning_exercises e WHERE e.node_id=n.id ORDER BY e.sort_order LIMIT 15),
 CASE WHEN p.id='00000000-0000-4000-8000-000000000081' THEN 40 ELSE 80 END,
 p.id<>'00000000-0000-4000-8000-000000000081',now()-make_interval(days=>attempt),now()-make_interval(days=>attempt)
 FROM profiles p CROSS JOIN generate_series(1,2) attempt JOIN path_nodes n ON n.kind='test'
 JOIN learning_units u ON u.id=n.unit_id AND u.is_path AND u.sort_order=1 WHERE p.role='student' ON CONFLICT DO NOTHING;
INSERT INTO path_private.test_items(attempt_id,exercise_id,snapshot,position)
 SELECT a.id,e.id,path_private.snapshot(e.id),row_number() OVER(PARTITION BY a.id ORDER BY e.sort_order)
 FROM path_test_attempts a JOIN learning_exercises e ON e.id=ANY(a.selected_exercise_ids) ON CONFLICT DO NOTHING;
INSERT INTO path_test_answers(attempt_id,exercise_id,answer,result,answered_at)
 SELECT i.attempt_id,i.exercise_id,'{"text":"Prüfantwort"}','{"status":"INCORRECT","correct":false}',a.completed_at
 FROM path_private.test_items i JOIN path_test_attempts a ON a.id=i.attempt_id ON CONFLICT DO NOTHING;
INSERT INTO submissions(id,auth_user_id,type,text_content,status,level,content_url)
 VALUES('00000000-0000-4000-8000-000000000701','00000000-0000-4000-8000-000000000081','audio','Lokale Probeaufnahme','pending','A1.1',
 'storage://pronunciation_audio/00000000-0000-4000-8000-000000000081/local-fixture.webm') ON CONFLICT DO NOTHING;
INSERT INTO teacher_student_notes(id,student_id,teacher_id,note_text)
 VALUES('00000000-0000-4000-8000-000000000703','00000000-0000-4000-8000-000000000081','00000000-0000-4000-8000-000000000082','Gemeinsam Artikel üben.') ON CONFLICT DO NOTHING;
