-- Synthetic local-only Phase-5 fixture. No production records or credentials.
INSERT INTO locales(code) VALUES('de'),('en'),('ru'),('uk'),('tr') ON CONFLICT DO NOTHING;
INSERT INTO cefr_levels(code) VALUES('A1') ON CONFLICT DO NOTHING;
INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('A1.1','A1',1),('A1.2','A1',2) ON CONFLICT DO NOTHING;
INSERT INTO learning_trainers(code) VALUES('exercises'),('vocabulary'),('pronunciation'),('videos') ON CONFLICT DO NOTHING;
INSERT INTO courses(slug,title,type,category,unit_price) VALUES('phase5-local','Lokaler Testkurs','online','german',0) ON CONFLICT DO NOTHING;
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('00000000-0000-4000-8000-000000000081','phase5@example.invalid',now()),
 ('00000000-0000-4000-8000-000000000082','teacher@example.invalid',now()),
 ('00000000-0000-4000-8000-000000000083','other@example.invalid',now()) ON CONFLICT DO NOTHING;
INSERT INTO profiles(id,role,native_language,ui_language) VALUES
 ('00000000-0000-4000-8000-000000000081','student','en','en'),
 ('00000000-0000-4000-8000-000000000082','teacher','en','en'),
 ('00000000-0000-4000-8000-000000000083','student','en','en') ON CONFLICT DO NOTHING;
INSERT INTO student_level_access(auth_user_id,level) VALUES
 ('00000000-0000-4000-8000-000000000081','A1.1'),('00000000-0000-4000-8000-000000000081','A1.2'),
 ('00000000-0000-4000-8000-000000000083','A1.1') ON CONFLICT DO NOTHING;
INSERT INTO learning_units(id,level,trainer,label,sort_order,is_active,owner_auth_user_id) VALUES
 ('00000000-0000-4000-8000-000000000091','A1.1','vocabulary','Lektion 1',1,true,null),
 ('00000000-0000-4000-8000-000000000092','A1.2','vocabulary','Lektion 1',1,true,null),
 ('00000000-0000-4000-8000-000000000093','A1.1','vocabulary','Lektion 2',2,true,null),
 ('00000000-0000-4000-8000-000000000094','A1.1','vocabulary','Eigene Wörter',1000000,true,'00000000-0000-4000-8000-000000000081'),
 ('00000000-0000-4000-8000-000000000095','A1.1','vocabulary','Eigene Wörter',1000000,true,'00000000-0000-4000-8000-000000000083') ON CONFLICT DO NOTHING;
INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,sentence_practice) VALUES
 ('00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000091','Brot',false),
 ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000093','Pause',false),
 ('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000091','Unberührt',false),
 ('00000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-000000000091','Gelernt',false),
 ('00000000-0000-4000-8000-000000000104','00000000-0000-4000-8000-000000000094','Käse',false),
 ('00000000-0000-4000-8000-000000000105','00000000-0000-4000-8000-000000000092','Wasser',false),
 ('00000000-0000-4000-8000-000000000106','00000000-0000-4000-8000-000000000095','Geheim',false) ON CONFLICT DO NOTHING;
INSERT INTO vocabulary_translations(card_id,locale,translation)
 SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'en',word
 FROM (VALUES(100,'bread'),(101,'pause'),(102,'untouched'),(103,'learned'),(104,'cheese'),(105,'water'),(106,'secret')) v(n,word)
 ON CONFLICT DO NOTHING;
INSERT INTO vocabulary_direction_progress(id,auth_user_id,card_id,direction,box_number,next_review_date)
 SELECT ('00000000-0000-4000-8000-'||lpad((n*10+d)::text,12,'0'))::uuid,
  CASE WHEN n=106 THEN '00000000-0000-4000-8000-000000000083'::uuid ELSE '00000000-0000-4000-8000-000000000081'::uuid END,
  ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  CASE WHEN d=1 THEN 'de_to_native'::vocabulary_direction ELSE 'native_to_de'::vocabulary_direction END,
  phase,CASE WHEN n=104 THEN now()+interval '5 days' ELSE now()-interval '1 day' END
 FROM (VALUES(100,3),(101,2),(103,7),(104,4),(106,2)) cards(n,phase) CROSS JOIN generate_series(1,2) d
 ON CONFLICT DO NOTHING;
INSERT INTO vocabulary_lesson_pauses(auth_user_id,unit_id)
 VALUES('00000000-0000-4000-8000-000000000081','00000000-0000-4000-8000-000000000093') ON CONFLICT DO NOTHING;
