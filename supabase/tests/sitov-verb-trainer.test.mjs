import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'
const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const student = uid(1), other = uid(2), teacher = uid(3)
await test('Sitov verb trainer permissions, grading and cumulative progress', async t => {
 const db = new PGlite()
 try {
  await db.exec(`
   CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
   CREATE SCHEMA auth; CREATE SCHEMA identity_private; CREATE SCHEMA learning_private; CREATE SCHEMA trainer_access_private; CREATE SCHEMA learning_reset_private;
   CREATE FUNCTION learning_reset_private.assert_writable(uuid) RETURNS void LANGUAGE sql AS $$ SELECT $$;
   GRANT USAGE ON SCHEMA public,auth,identity_private,learning_private,trainer_access_private TO authenticated,service_role,anon;
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   CREATE TYPE trainer_code AS ENUM('vocabulary','exercises','pronunciation','videos');
   CREATE TYPE learning_session_mode AS ENUM('vocabulary','path','pronunciation');
   CREATE TABLE profiles(id uuid PRIMARY KEY,role text,ui_language text);
   CREATE FUNCTION identity_private.current_profile_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT role FROM public.profiles WHERE id=auth.uid() $$;
   CREATE TABLE cefr_levels(code text PRIMARY KEY);
   CREATE TABLE learning_levels(code text PRIMARY KEY,cefr_level text,sort_order int UNIQUE,is_active boolean DEFAULT true);
   INSERT INTO learning_levels VALUES('A1.1','A1',1,true),('A1.2','A1',2,true),('A2.1','A2',3,true),('A2.2','A2',4,true),('B1.1','B1',5,true),('B1.2','B1',6,true);
   CREATE TABLE learning_trainers(code trainer_code PRIMARY KEY);
   CREATE TABLE learning_units(id uuid PRIMARY KEY,level text REFERENCES learning_levels,trainer trainer_code,label text,sort_order int DEFAULT 0,is_active boolean DEFAULT true);
   CREATE TABLE student_level_access(auth_user_id uuid REFERENCES profiles,level text REFERENCES learning_levels,PRIMARY KEY(auth_user_id,level));
   CREATE TABLE learning_trainer_grants(auth_user_id uuid REFERENCES profiles,level text REFERENCES learning_levels,trainer trainer_code,enabled boolean,unit_mode text DEFAULT 'all',PRIMARY KEY(auth_user_id,level,trainer));
   CREATE TABLE learning_unit_grants(auth_user_id uuid,level text,trainer trainer_code,unit_id uuid REFERENCES learning_units,PRIMARY KEY(auth_user_id,unit_id));
   CREATE TABLE test_events(auth_user_id uuid,mode learning_session_mode,level text);
   CREATE FUNCTION learning_private.record_learning_event(p_user uuid,p_mode learning_session_mode,p_level text,p_at timestamptz) RETURNS void LANGUAGE sql AS $$ INSERT INTO public.test_events VALUES(p_user,p_mode,p_level) $$;
   ALTER TABLE learning_trainer_grants ENABLE ROW LEVEL SECURITY;
   CREATE POLICY staff_grants ON learning_trainer_grants TO authenticated USING(identity_private.current_profile_role() IN('teacher','admin')) WITH CHECK(identity_private.current_profile_role() IN('teacher','admin'));
   GRANT SELECT,INSERT,UPDATE,DELETE ON learning_trainer_grants,learning_unit_grants TO authenticated;
   GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
  `)
  await db.query("INSERT INTO profiles VALUES($1,'student','ru'),($2,'student','en'),($3,'teacher','de')",[student,other,teacher])
  await db.query("INSERT INTO student_level_access VALUES($1,'A1.1'),($1,'A1.2'),($1,'A2.1'),($2,'A1.1')",[student,other])
  await db.exec(await read('../vps/62_verb_trainer_enums.sql'))
  // Only the schema body is needed; catalog seed is covered separately below.
  const migration = await read('../vps/63_verb_trainer.sql')
  await db.exec(migration.split('-- BEGIN SITOV VERB CATALOG SEED')[0])
  for(const [n,id,level] of [[10,'sitov-verb-fahren','A1.1'],[11,'sitov-verb-arbeiten','A1.1'],[12,'sitov-verb-abwagen','B2']]) {
   await db.query("INSERT INTO learning_units(id,level,trainer,label) VALUES($1,$2,'verbs',$3)",[uid(n),level,id])
   await db.query('INSERT INTO sitov_verb_catalog VALUES($1,$2,$3)',[id,uid(n),level])
  }
  const actor = async (id,role='authenticated') => { await db.exec('RESET ROLE'); await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id??'']);await db.exec(`SET ROLE ${role}`) }
  const allowed = async (level,trainer='verbs') => (await db.query('SELECT trainer_access_private.allowed($1,$2) ok',[level,trainer])).rows[0].ok
  const box = async (level,ids,selected=true) => (await db.query('SELECT sitov_set_verb_box($1,$2,$3) result',[level,ids,selected])).rows[0].result
  const grade = async (id,answer) => (await db.query('SELECT sitov_submit_verb_answer($1,$2) result',[id,JSON.stringify(answer)])).rows[0].result
  const challenge = async (id,verb='sitov-verb-fahren',level='A1.2',tense='perfect',expected=[['ist'],['gefahren']]) => {
   await actor(null,'service_role')
   await db.query('INSERT INTO sitov_verb_challenges(id,auth_user_id,verb_id,context_level,tense,expected,solution) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,student,verb,level,tense,JSON.stringify(expected),'ist gefahren'])
   await actor(student)
  }
  const grant = async(level,enabled,units=null)=>{
   await actor(teacher)
   await db.query("INSERT INTO learning_trainer_grants VALUES($1,$2,'verbs',$3,$4) ON CONFLICT(auth_user_id,level,trainer) DO UPDATE SET enabled=excluded.enabled,unit_mode=excluded.unit_mode",[student,level,enabled,units===null?'all':'selected'])
   await db.query("DELETE FROM learning_unit_grants WHERE auth_user_id=$1 AND level=$2 AND trainer='verbs'",[student,level])
   for(const id of units??[])await db.query("INSERT INTO learning_unit_grants VALUES($1,$2,'verbs',$3)",[student,level,id])
   await actor(student)
  }
  await actor(student)
  await t.test('existing base level access inherits verbs; advanced and arbitrary levels never inherit',async()=>{
   assert.equal(await allowed('A1.1'),true);assert.equal(await allowed('B2'),false);assert.equal(await allowed('unknown'),false)
   assert.equal((await db.query('SELECT * FROM sitov_verb_catalog')).rows.length,2)
   assert.deepEqual((await box('A1.2',['sitov-verb-fahren'])).selectedIds,['sitov-verb-fahren'])
   assert.equal((await box('A1.2',['sitov-verb-abwagen'])).error,'not_authorized')
  })
  await t.test('no anonymous or student client can forge grades/challenges or grant rights',async()=>{
   for(const sql of ["INSERT INTO sitov_verb_progress(auth_user_id,verb_id,tense,box) VALUES($1,'sitov-verb-fahren','present',7)","UPDATE sitov_verb_box SET selected=true", "SELECT * FROM sitov_verb_challenges"])await assert.rejects(db.query(sql,sql.includes('$1')?[student]:[]),e=>e.code==='42501')
   await assert.rejects(db.query("INSERT INTO learning_trainer_grants VALUES($1,'B2','verbs',true,'all')",[student]),e=>e.code==='42501')
   await actor(null,'anon');await assert.rejects(db.query("SELECT sitov_set_verb_box('A1.1',ARRAY['sitov-verb-fahren'],true)"),e=>e.code==='42501');await actor(student)
  })
  await t.test('trainer helper delegates to current verb entitlements', async () => {
   const body = (await db.query("SELECT pg_get_functiondef('trainer_access_private.allowed(text,text)'::regprocedure) body")).rows[0].body
   assert.match(body,/sitov_verb_private.level_allowed/)
  })
  const first=uid(20)
  await t.test('server-created challenge compares actual answer, records own form only and replay is idempotent',async()=>{
   await challenge(first)
   const result=await grade(first,['  IST  ','gefahren'])
   assert.equal(result.correct,true);assert.equal(result.progress.box,2);assert.equal(result.progress.attempts,1)
   assert.deepEqual(await grade(first,['  IST  ','gefahren']),result)
   assert.equal((await grade(first,['hat','gefahren'])).error,'conflict')
   assert.equal((await db.query('SELECT * FROM sitov_verb_progress')).rows.length,1)
   await challenge(uid(24));const practice=await grade(uid(24),['ist','gefahren']);assert.equal(practice.progress.box,2);assert.equal(practice.progress.attempts,2)
   await actor(other);assert.equal((await grade(first,['ist','gefahren'])).error,'not_found');assert.equal((await db.query('SELECT * FROM sitov_verb_progress')).rows.length,0);await actor(student)
  })
  await t.test('removing and re-adding a verb preserves all form progress and blocks an old challenge',async()=>{
   await box('A1.2',['sitov-verb-fahren'],false)
   assert.equal((await grade(first,['  IST  ','gefahren'])).error,'not_authorized')
   assert.equal((await db.query('SELECT box FROM sitov_verb_progress')).rows[0].box,2)
   await box('A1.2',['sitov-verb-fahren'],true)
   assert.equal((await grade(first,['  IST  ','gefahren'])).progress.attempts,1)
  })
  await t.test('tense gates and wrong answers are enforced by SQL, never client claims',async()=>{
   await challenge(uid(21),'sitov-verb-fahren','A1.1','perfect')
   assert.equal((await grade(uid(21),['ist','gefahren'])).error,'not_authorized')
   await challenge(uid(22),'sitov-verb-fahren','A2.1','past',[['fuhr']])
   assert.equal((await grade(uid(22),['fuhr'])).error,'not_authorized')
   await challenge(uid(23))
   const wrong=await grade(uid(23),['hat','gefahrt'])
   assert.equal(wrong.correct,false);assert.equal(wrong.progress.box,1);assert.equal(wrong.progress.attempts,3);assert.equal(wrong.progress.lapses,1)
  })
  await t.test('trainer/unit/whole-level revocation blocks content, box and receipt replay without deleting progress',async()=>{
   await grant('A1.1',false)
   assert.equal((await db.query('SELECT * FROM sitov_verb_catalog')).rows.length,0)
   assert.equal((await grade(first,['  IST  ','gefahren'])).error,'not_authorized')
   assert.equal((await box('A1.2',['sitov-verb-fahren'])).error,'not_authorized')
   await grant('A1.1',true,[uid(11)])
   assert.deepEqual((await db.query('SELECT id FROM sitov_verb_catalog')).rows.map(row=>row.id),['sitov-verb-arbeiten'])
   assert.equal((await grade(first,['  IST  ','gefahren'])).error,'not_authorized')
   await grant('A1.1',true)
   await db.exec('RESET ROLE');await db.query("DELETE FROM student_level_access WHERE auth_user_id=$1 AND level='A1.2'",[student]);await actor(student)
   assert.equal((await grade(first,['  IST  ','gefahren'])).error,'not_authorized')
   assert.equal((await db.query('SELECT attempts FROM sitov_verb_progress')).rows[0].attempts,3)
  })
  await t.test('explicit advanced verb grant never enables other trainers, even with accidental global B2 access',async()=>{
   await grant('B2',true)
   assert.equal(await allowed('B2'),true)
   assert.equal(await allowed('B2','vocabulary'),false);assert.equal(await allowed('B2','videos'),false)
   await db.exec('RESET ROLE');await db.query("INSERT INTO student_level_access VALUES($1,'B2')",[student]);await actor(student)
   assert.equal(await allowed('B2','exercises'),false)
   await grant('B2',false);assert.equal(await allowed('B2'),false)
  })
 } finally { await db.close() }
})

await test('all 960 first-introduction verbs seed stable teacher units without erasing progress',async()=>{
 const db=new PGlite()
 try {
  await db.exec("CREATE TABLE learning_units(id uuid PRIMARY KEY,level text,trainer text,label text,sort_order int,is_active boolean);CREATE TABLE sitov_verb_catalog(id text PRIMARY KEY,unit_id uuid UNIQUE REFERENCES learning_units,level text);CREATE TABLE sitov_seed_progress(verb_id text REFERENCES sitov_verb_catalog,box int)")
  const source=await read('../vps/63_verb_trainer.sql')
  const seed=source.slice(source.indexOf('-- BEGIN SITOV VERB CATALOG SEED'))
  await db.exec(seed)
  assert.equal((await db.query('SELECT count(*)::int n FROM sitov_verb_catalog')).rows[0].n,960)
  await db.exec("INSERT INTO sitov_seed_progress VALUES('sitov-verb-fahren',6)")
  await db.exec(seed)
  assert.equal((await db.query('SELECT count(*)::int n FROM learning_units')).rows[0].n,960)
  assert.equal((await db.query('SELECT box FROM sitov_seed_progress')).rows[0].box,6)
  assert.deepEqual((await db.query('SELECT level,count(*)::int n FROM sitov_verb_catalog GROUP BY level ORDER BY level')).rows,[{level:'A1.1',n:140},{level:'A1.2',n:129},{level:'A2.1',n:93},{level:'A2.2',n:62},{level:'B1.1',n:92},{level:'B1.2',n:70},{level:'B2',n:187},{level:'C1',n:187}])
 }finally{await db.close()}
})

await test('migration integrates with the actual current navigation, reset and news functions',async()=>{
 const { createCurrentDatabase, apply, actor, student, teacher, result }=await import('./helpers/current-db.mjs')
 const db=await createCurrentDatabase()
 try {
  await db.exec("INSERT INTO cefr_levels VALUES('A2'),('B1'),('B2'),('C1') ON CONFLICT DO NOTHING;INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('A1.2','A1',2),('A2.1','A2',3),('A2.2','A2',4),('B1.1','B1',5),('B1.2','B1',6) ON CONFLICT DO NOTHING")
  for(const file of ['59_daily_quests.sql','60_daily_quest_resume.sql','61_account_learning_checkpoints.sql','62_verb_trainer_enums.sql','63_verb_trainer.sql'])await apply(db,[file])
  const mediaFolder=uid(600)
  await db.query("INSERT INTO lms_media_folder(folder_id,level,title) VALUES($1,'A1.1','Sitov smoke media')",[mediaFolder])
  await actor(db,teacher)
  assert.equal(await result(db,"SELECT set_student_trainer_access($1,'B2','verbs',true,NULL,false) result",[student]),null)
  await actor(db,student)
  assert.equal((await db.query('SELECT folder_id FROM lms_media_folder')).rows.length,1)
  await actor(db,teacher)
  assert.equal(await result(db,"SELECT set_student_trainer_access($1,'A1.1','videos',false,NULL,false) result",[student]),null)
  await actor(db,student)
  assert.equal((await db.query('SELECT folder_id FROM lms_media_folder')).rows.length,0)
  await actor(db,teacher)
  assert.equal(await result(db,"SELECT set_student_trainer_access($1,'A1.1','videos',true,NULL,false) result",[student]),null)
  await db.exec('RESET ROLE');await db.query("UPDATE profiles SET ui_language='de' WHERE id=$1",[student]);await actor(db,student)
  assert.equal((await db.query('SELECT folder_id FROM lms_media_folder')).rows.length,1) // Media remains available in German
  const selected=await result(db,"SELECT sitov_set_verb_box('B2',ARRAY['sitov-verb-fahren'],true) result")
  assert.ok(!selected.error,JSON.stringify(selected))
  await db.exec('RESET ROLE')
  await db.query("INSERT INTO sitov_verb_challenges(id,auth_user_id,verb_id,context_level,tense,expected,solution) VALUES($1,$2,'sitov-verb-fahren','B2','past','[[\"fuhr\"]]','fuhr')",[uid(500),student])
  await actor(db,student)
  const grade=await result(db,'SELECT sitov_submit_verb_answer($1,$2) result',[uid(500),'["fuhr"]'])
  assert.equal(grade.correct,true,JSON.stringify(grade))
  const last=await result(db,'SELECT get_last_active_level() result')
  assert.equal(last.level,'B2',JSON.stringify(last));assert.equal(last.mode,'verbs')
  await db.exec('RESET ROLE');await apply(db,['63_verb_trainer.sql']);await actor(db,student)
  assert.equal((await db.query('SELECT box FROM sitov_verb_progress')).rows[0].box,2)
  assert.equal((await db.query('SELECT count(*)::int n FROM sitov_verb_catalog')).rows[0].n,327) // A1.1 + explicit B2, without bypassing intervening levels
  const counts=await result(db,'SELECT get_learning_new_counts() result')
  assert.equal(counts.success,true,JSON.stringify(counts))
  await db.exec('RESET ROLE')
  const patched=(await db.query("SELECT pg_get_functiondef('learning_private.reset_student_level(uuid,text)'::regprocedure) body")).rows[0].body
  assert.match(patched,/DELETE FROM public.sitov_verb_progress/)
  assert.equal((await db.query("SELECT answer_count FROM learning_activity_days WHERE auth_user_id=$1",[student])).rows[0].answer_count,1)
  await actor(db,teacher)
  assert.equal(await result(db,"SELECT reset_student_level_progress($1,'A1.1') result",[student]),null)
  await db.exec('RESET ROLE')
  assert.equal((await db.query('SELECT count(*)::int n FROM sitov_verb_progress')).rows[0].n,0)
  assert.equal((await db.query('SELECT count(*)::int n FROM sitov_verb_box')).rows[0].n,1)
 }finally{await db.close()}
})
