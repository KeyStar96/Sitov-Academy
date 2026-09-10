import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'
const migration = await readFile(new URL('../migrations/20260910184438_pronunciation_reading_conversations.sql',import.meta.url),'utf8')
const student='00000000-0000-4000-8000-000000000001', other='00000000-0000-4000-8000-000000000002', teacher='00000000-0000-4000-8000-000000000003'
const legacy='00000000-0000-4000-8000-000000000004'
const studentObject=`${student}/00000000-0000-4000-8000-000000000011.webm`
const teacherObject=`${teacher}/00000000-0000-4000-8000-000000000012.webm`
const ref=name=>`storage://pronunciation_audio/${name}`
await test('Pronunciation curriculum, conversations and private audio in isolated PostgreSQL',async t=>{
 const db=new PGlite()
 try {
  await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
  CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA monthly_booking_private;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  GRANT USAGE ON SCHEMA public,auth,storage,monthly_booking_private TO authenticated;
  CREATE TABLE profiles(id uuid PRIMARY KEY,role text,allowed_levels text[]);
  CREATE FUNCTION monthly_booking_private.current_profile_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT role FROM public.profiles WHERE id=(SELECT auth.uid()) AND (SELECT auth.uid()) IS NOT NULL$$;
  REVOKE ALL ON FUNCTION monthly_booking_private.current_profile_role() FROM PUBLIC,anon;
  GRANT EXECUTE ON FUNCTION monthly_booking_private.current_profile_role() TO authenticated;
  CREATE TABLE pronunciation_prompts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),cefr_level text NOT NULL,sentence_de text NOT NULL,focus text,audio_url text,sort_order integer NOT NULL DEFAULT 0,created_at timestamptz DEFAULT now());
  CREATE TABLE submissions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES profiles(id),type text NOT NULL,content_url text,text_content text,status text DEFAULT 'pending',created_at timestamptz DEFAULT now(),level text NOT NULL,attempt_number int DEFAULT 1,parent_id uuid REFERENCES submissions(id));
  CREATE TABLE teacher_feedback(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),submission_id uuid REFERENCES submissions(id),teacher_id uuid REFERENCES profiles(id),feedback_text text,feedback_audio_url text,created_at timestamptz DEFAULT now(),seen_at timestamptz);
  CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text REFERENCES storage.buckets(id),name text,owner_id text);
  CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array(regexp_replace(name,'/[^/]+$',''),'/') $$;
  ALTER TABLE profiles ENABLE ROW LEVEL SECURITY; ALTER TABLE pronunciation_prompts ENABLE ROW LEVEL SECURITY;
  ALTER TABLE submissions ENABLE ROW LEVEL SECURITY; ALTER TABLE teacher_feedback ENABLE ROW LEVEL SECURITY; ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  CREATE POLICY own_profile ON profiles FOR SELECT TO authenticated USING(id=auth.uid());
  CREATE POLICY own_submission ON submissions FOR SELECT TO authenticated USING(user_id=auth.uid() OR monthly_booking_private.current_profile_role() IN('teacher','admin'));
  CREATE POLICY own_feedback ON teacher_feedback FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM submissions WHERE id=submission_id));
  CREATE POLICY "Nutzer können Übungssätze sehen" ON pronunciation_prompts FOR SELECT TO authenticated USING(auth.uid() IS NOT NULL);
  CREATE POLICY "Admins und Lehrer dürfen Übungssätze einfügen" ON pronunciation_prompts FOR INSERT TO authenticated WITH CHECK(monthly_booking_private.current_profile_role() IN('teacher','admin'));
  CREATE POLICY "Admins und Lehrer dürfen Übungssätze bearbeiten" ON pronunciation_prompts FOR UPDATE TO authenticated USING(monthly_booking_private.current_profile_role() IN('teacher','admin'));
  CREATE POLICY "Admins und Lehrer dürfen Übungssätze löschen" ON pronunciation_prompts FOR DELETE TO authenticated USING(monthly_booking_private.current_profile_role() IN('teacher','admin'));
  GRANT SELECT ON profiles,submissions,teacher_feedback TO authenticated;
  GRANT SELECT,INSERT,UPDATE,DELETE ON pronunciation_prompts TO authenticated;
  GRANT SELECT,INSERT ON storage.objects TO authenticated;
  `)
  await db.query("INSERT INTO profiles VALUES($1,'student',ARRAY['A1.1']),($2,'student',ARRAY['A1.1']),($3,'teacher',ARRAY[]::text[])",[student,other,teacher])
  await db.query("INSERT INTO submissions(id,user_id,type,content_url,text_content,level) VALUES($1,$2,'audio','https://legacy.invalid/audio.webm','Legacy reading snapshot','A1.1')",[legacy,student])
  await db.query("INSERT INTO teacher_feedback(submission_id,teacher_id,feedback_text) VALUES($1,$2,'Original feedback, retained.')",[legacy,teacher])
  await db.exec(migration)
  const prompts=(await db.query("SELECT id,level,title,sentence_de FROM pronunciation_prompts ORDER BY level,sort_order")).rows
  const prompt=prompts[0], locked=prompts.find(row=>row.level==='B1.2')
  async function actor(id,role='authenticated') { await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id??'']);await db.exec(`SET ROLE ${role}`) }
  async function message(thread,sender,text,audio=null,role='student') { return (await db.query("INSERT INTO pronunciation_messages(submission_id,sender_id,text_content,audio_path,sender_role,created_at,seen_at) VALUES($1,$2,$3,$4,$5,'2000-01-01','2000-01-01') RETURNING *",[thread,sender,text,audio,role])).rows[0] }
  let conversation
  await t.test('imports sixty texts without changing legacy records or feedback',async()=>{
   assert.equal(prompts.length,60)
   for(const level of ['A1.1','A1.2','A2.1','A2.2','B1.1','B1.2']) assert.equal(prompts.filter(row=>row.level===level).length,10)
   assert.equal((await db.query('SELECT text_content FROM submissions WHERE id=$1',[legacy])).rows[0].text_content,'Legacy reading snapshot')
   assert.equal((await db.query('SELECT feedback_text FROM teacher_feedback')).rows[0].feedback_text,'Original feedback, retained.')
   assert.equal((await db.query("SELECT public FROM storage.buckets WHERE id='pronunciation_audio'")).rows[0].public,false)
  })
  await actor(student)
  await t.test('exact unlocked course content is readable; locked course and missing audio cannot be submitted',async()=>{
   assert.equal((await db.query('SELECT count(*)::int n FROM pronunciation_prompts')).rows[0].n,10)
   await assert.rejects(db.query('SELECT create_pronunciation_submission($1,$2)',[locked.id,ref(studentObject)]),/Level not allowed/)
   await assert.rejects(db.query('SELECT create_pronunciation_submission($1,$2)',[prompt.id,ref(studentObject)]),/Invalid recording/)
   await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('pronunciation_audio',$1)",[teacherObject]),error=>error.code==='42501')
  })
  await t.test('initial upload snapshots the chosen text and level atomically',async()=>{
   await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('pronunciation_audio',$1)",[studentObject])
   conversation=(await db.query('SELECT create_pronunciation_submission($1,$2) id',[prompt.id,ref(studentObject)])).rows[0].id
   const saved=(await db.query('SELECT * FROM submissions WHERE id=$1',[conversation])).rows[0]
   assert.equal(saved.user_id,student);assert.equal(saved.prompt_id,prompt.id);assert.equal(saved.prompt_title,prompt.title);assert.equal(saved.text_content,prompt.sentence_de);assert.equal(saved.level,'A1.1')
  })
  await t.test('another student cannot read legacy records, new threads or their audio',async()=>{
   await actor(other)
   assert.equal((await db.query('SELECT * FROM submissions')).rows.length,0)
   assert.equal((await db.query('SELECT * FROM teacher_feedback')).rows.length,0)
   assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length,0)
   await assert.rejects(message(conversation,other,'Hello'),/Not authorized/)
   await assert.rejects(db.query('SELECT mark_pronunciation_seen($1)',[conversation]),/Not authorized/)
   await assert.rejects(db.query('SELECT create_pronunciation_submission($1,$2)',[prompt.id,ref(studentObject)]),/Invalid recording/)
  })
  await t.test('sender identity cannot be forged; role, timestamp and receipt fields are server-controlled',async()=>{
   await actor(student)
   await assert.rejects(message(conversation,teacher,'Forged teacher'),/Not authorized/)
   const sent=await message(conversation,student,'Meine Frage',null,'teacher')
   assert.equal(sent.sender_role,'student');assert.equal(sent.seen_at,null);assert.notEqual(String(sent.created_at).slice(0,4),'2000')
   assert.equal((await db.query('SELECT status FROM submissions WHERE id=$1',[conversation])).rows[0].status,'pending')
  })
  await t.test('teacher can hear the student and send text plus a private voice message',async()=>{
   await actor(teacher)
   assert.equal((await db.query('SELECT * FROM submissions')).rows.length,2)
   assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length,1)
   await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('pronunciation_audio',$1)",[teacherObject])
   const sent=await message(conversation,teacher,'Bitte sprich langsam.',ref(teacherObject))
   assert.equal(sent.sender_role,'teacher')
   assert.equal((await db.query('SELECT status FROM submissions WHERE id=$1',[conversation])).rows[0].status,'reviewed')
  })
  await t.test('student reads teacher audio only in their conversation and can reply repeatedly',async()=>{
   await actor(student)
   assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length,2)
   await db.query('SELECT mark_pronunciation_seen($1)',[conversation])
   assert.equal((await db.query("SELECT seen_at IS NOT NULL seen FROM pronunciation_messages WHERE sender_role='teacher'")).rows[0].seen,true)
   for(let i=0;i<3;i++) await message(conversation,student,`Weitere Antwort ${i}`)
   assert.equal((await db.query('SELECT status FROM submissions WHERE id=$1',[conversation])).rows[0].status,'pending')
   await assert.rejects(message(conversation,student,'',ref(teacherObject)),/Invalid recording/)
   await assert.rejects(db.exec("UPDATE pronunciation_messages SET text_content='edited'"),error=>error.code==='42501')
   await actor(other)
   assert.equal((await db.query('SELECT * FROM pronunciation_messages')).rows.length,0)
   assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length,0)
  })
  await t.test('a legacy recording supports the same ongoing conversation',async()=>{
   await actor(student); await message(legacy,student,'Rückfrage zur alten Rückmeldung')
   await actor(teacher); await message(legacy,teacher,'Ja, natürlich.')
   assert.equal((await db.query('SELECT count(*)::int n FROM pronunciation_messages WHERE submission_id=$1',[legacy])).rows[0].n,2)
   assert.equal((await db.query('SELECT feedback_text FROM teacher_feedback WHERE submission_id=$1',[legacy])).rows[0].feedback_text,'Original feedback, retained.')
  })
  await t.test('editing or archiving a text preserves submitted snapshots and blocks new attempts',async()=>{
   await actor(teacher)
   await db.query("UPDATE pronunciation_prompts SET sentence_de='Edited by teacher',is_active=false WHERE id=$1",[prompt.id])
   await actor(student)
   assert.equal((await db.query('SELECT text_content FROM submissions WHERE id=$1',[conversation])).rows[0].text_content,prompt.sentence_de)
   await assert.rejects(db.query('SELECT create_pronunciation_submission($1,$2)',[prompt.id,ref(studentObject)]),/Level not allowed/)
   assert.equal((await db.query("UPDATE pronunciation_prompts SET title='Forged' WHERE id=$1 RETURNING id",[locked.id])).rows.length,0)
  })
  await t.test('anonymous access to every new RPC and table is denied',async()=>{
   await actor(null,'anon')
   await assert.rejects(db.query('SELECT create_pronunciation_submission($1,$2)',[prompt.id,ref(studentObject)]),error=>error.code==='42501')
   await assert.rejects(db.query('SELECT mark_pronunciation_seen($1)',[conversation]),error=>error.code==='42501')
   await assert.rejects(db.exec('SELECT * FROM pronunciation_messages'),error=>error.code==='42501')
  })
 } finally { await db.close() }
})
