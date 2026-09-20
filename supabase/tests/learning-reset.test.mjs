import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
import {test} from 'node:test'
import assert from 'node:assert/strict'
const sql=await readFile(new URL('./fixtures/history/migrations/20260910195205_complete_learning_reset.sql',import.meta.url),'utf8')
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const learner=uid(1),other=uid(2),teacher=uid(3),thread=uid(10),otherThread=uid(11)
const progressTables=['user_vocabulary_progress','vocabulary_direction_progress','vocabulary_learning_state','vocabulary_onboarding','user_exercise_progress','vocabulary_private.answer_receipts']
test('Complete learning reset on isolated PostgreSQL',async t=>{
 const db=new PGlite()
 try{
 await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA vocabulary_private;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA auth,storage,public,vocabulary_private TO anon,authenticated;
 CREATE TABLE profiles(id uuid PRIMARY KEY,role text,name text,allowed_levels text[]);
 CREATE TABLE registrations(id uuid PRIMARY KEY,user_id uuid,status text);
 CREATE TABLE enrollments(registration_id uuid,course_id uuid);
 CREATE TABLE monthly_course_bookings(id uuid PRIMARY KEY,user_id uuid,status text);
 CREATE TABLE manual_invoice_status(id uuid PRIMARY KEY,registration_id uuid,status text);
 CREATE TABLE vocabulary_cards(id uuid PRIMARY KEY);
 CREATE TABLE exercises(id uuid PRIMARY KEY);
 CREATE TABLE pronunciation_prompts(id uuid PRIMARY KEY);
 CREATE TABLE submissions(id uuid PRIMARY KEY,user_id uuid REFERENCES profiles,type text,content_url text,parent_id uuid REFERENCES submissions ON DELETE CASCADE);
 CREATE TABLE teacher_feedback(id uuid PRIMARY KEY,submission_id uuid REFERENCES submissions ON DELETE CASCADE,teacher_id uuid,feedback_audio_url text);
 CREATE TABLE pronunciation_messages(id uuid PRIMARY KEY,submission_id uuid REFERENCES submissions ON DELETE CASCADE,sender_id uuid,audio_path text);
 CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,owner_id text,UNIQUE(bucket_id,name));
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 CREATE POLICY read_audio ON storage.objects FOR SELECT TO authenticated USING(owner_id=auth.uid()::text OR bucket_id='audio_submissions');
 CREATE POLICY insert_audio ON storage.objects FOR INSERT TO authenticated WITH CHECK(owner_id=auth.uid()::text);
 CREATE POLICY update_audio ON storage.objects FOR UPDATE TO authenticated USING(true) WITH CHECK(true);
 GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated; GRANT SELECT,INSERT,UPDATE ON submissions,teacher_feedback,pronunciation_messages TO authenticated;
 `)
 for(const table of progressTables){await db.exec(`CREATE TABLE ${table}(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES profiles,score int DEFAULT 1);GRANT SELECT,INSERT,UPDATE,DELETE ON ${table} TO authenticated;`)}
 await db.query("INSERT INTO profiles VALUES($1,'student','Learner',ARRAY['A1.1']),($2,'student','Other',ARRAY['B1.2']),($3,'teacher','Teacher',ARRAY[]::text[])",[learner,other,teacher])
 await db.query("INSERT INTO submissions VALUES($1,$2,'audio',$3,NULL),($4,$5,'audio',$6,NULL)",[thread,learner,`storage://pronunciation_audio/${learner}/own.wav`,otherThread,other,`storage://pronunciation_audio/${other}/other.wav`])
 await db.query("INSERT INTO registrations VALUES($1,$2,'confirmed');",[uid(15),learner])
 await db.query('INSERT INTO enrollments VALUES($1,$2)',[uid(15),uid(16)])
 await db.query("INSERT INTO monthly_course_bookings VALUES($1,$2,'confirmed')",[uid(17),learner])
 await db.query("INSERT INTO manual_invoice_status VALUES($1,$2,'created')",[uid(18),uid(15)])
 for(const table of progressTables)await db.query(`INSERT INTO ${table}(user_id) VALUES($1),($2)`,[learner,other])
 for(const table of ['vocabulary_cards','exercises','pronunciation_prompts'])await db.query(`INSERT INTO ${table} VALUES($1)`,[uid(20)])
 const ref=(bucket,name)=>bucket==='pronunciation_audio'?`storage://${bucket}/${name}`:`https://wcaslabeiwtvygxtzcio.supabase.co/storage/v1/object/public/${bucket}/${name}`
 const objects=[
 ['pronunciation_audio',`${learner}/own.wav`,learner],
 ['pronunciation_audio',`${learner}/orphan.wav`,learner],
 ['audio_submissions',`${learner}-123456.wav`,learner],
 ['audio_submissions',`${learner}-older.wav`,null],
 ['pronunciation_audio',`${other}/other.wav`,other],
 ['audio_submissions',`${other}-private.wav`,other],
 ['audio_submissions',`feedback/${thread}_123.wav`,teacher],
 ['pronunciation_audio',`${teacher}/reply.wav`,teacher],
 ['pronunciation_audio',`${teacher}/shared.wav`,teacher],
 ['audio_cache',`${learner}/reference.mp3`,learner],
 ['assets',`${learner}/avatar.png`,learner],
 ]
 for(const [bucket,name,owner]of objects)await db.query('INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES($1,$2,$3)',[bucket,name,owner])
 await db.query('INSERT INTO teacher_feedback VALUES($1,$2,$3,$4)',[uid(30),thread,teacher,ref('audio_submissions',`feedback/${thread}_123.wav`)])
 await db.query('INSERT INTO pronunciation_messages VALUES($1,$2,$3,$4),($5,$2,$3,$6),($7,$8,$3,$6)',[uid(31),thread,teacher,ref('pronunciation_audio',`${teacher}/reply.wav`),uid(32),ref('pronunciation_audio',`${teacher}/shared.wav`),uid(33),otherThread])
 // A student can historically store an arbitrary URL; it is not deletion authority.
 await db.query('INSERT INTO submissions VALUES($1,$2,\'audio\',$3,NULL)',[uid(12),learner,ref('audio_submissions',`${other}-private.wav`)])
 const baseline=(await db.query('SELECT count(*)::int n FROM storage.objects')).rows[0].n
 await db.exec(sql)
 async function actor(id,role='authenticated'){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id??'']);await db.exec(`SET ROLE ${role}`)}
 const begin=async (confirmation='RESET_LEARNING_DATA')=>(await db.query('SELECT begin_learning_reset($1) token',[confirmation])).rows[0].token
 const batch=async token=>(await db.query('SELECT * FROM learning_reset_audio_batch($1)',[token])).rows
 const finish=async token=>(await db.query('SELECT finish_learning_reset($1) done',[token])).rows[0].done
 let token
 await t.test('migration itself preserves accounts, learning and Storage',async()=>{
 assert.equal((await db.query('SELECT count(*)::int n FROM storage.objects')).rows[0].n,baseline)
 assert.equal((await db.query('SELECT count(*)::int n FROM submissions')).rows[0].n,3)
 for(const table of progressTables)assert.equal((await db.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n,2)
 })
 await t.test('unauthenticated callers cannot invoke any reset function',async()=>{
 await actor(null,'anon');await assert.rejects(begin(),e=>e.code==='42501');await assert.rejects(batch(uid(500)),e=>e.code==='42501');await assert.rejects(finish(uid(500)),e=>e.code==='42501')
 })
 await t.test('confirmation is mandatory and no caller-supplied user identifier exists',async()=>{
 await actor(learner);await assert.rejects(begin('yes'),e=>e.code==='22023');await assert.rejects(begin(null),e=>e.code==='22023')
 const signatures=(await db.query("SELECT proname,pronargs FROM pg_proc WHERE proname IN ('begin_learning_reset','learning_reset_audio_batch','finish_learning_reset')")).rows
 assert.ok(signatures.every(f=>f.pronargs===1));token=await begin();assert.equal(token,await begin())
 })
 await t.test('manifest covers old/new/orphan files and exclusive teacher replies; excludes shared clips, other people, cache and assets',async()=>{
 const paths=(await batch(token)).map(o=>o.object_name).sort()
 assert.deepEqual(paths,[`${learner}/own.wav`,`${learner}/orphan.wav`,`${learner}-123456.wav`,`${learner}-older.wav`,`feedback/${thread}_123.wav`,`${teacher}/reply.wav`].sort())
 await assert.rejects(db.exec('SELECT * FROM learning_reset_private.jobs'),e=>e.code==='42501')
 })
 await t.test('other users cannot inspect, complete or delete the owner’s reset',async()=>{
 await actor(other);await assert.rejects(batch(token),e=>e.code==='42501');await assert.rejects(finish(token),e=>e.code==='42501')
 assert.equal((await db.query('DELETE FROM storage.objects WHERE name=$1 RETURNING id',[`${learner}/own.wav`])).rows.length,0)
 await actor(learner)
 })
 await t.test('pending reset blocks every progress writer and own uploads but not other learners or cache',async()=>{
 for(const table of progressTables)await assert.rejects(db.query(`INSERT INTO ${table}(user_id) VALUES($1)`,[learner]),/learning_reset_in_progress/)
 await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('pronunciation_audio',$1,$2)",[`${learner}/late.wav`,learner]),/learning_reset_in_progress/)
 await actor(other);await db.query('INSERT INTO user_exercise_progress(user_id) VALUES($1)',[other]);await actor(learner)
 })
 await t.test('a snapshotted file cannot be shared to another conversation or renamed by another user mid-reset',async()=>{
 await actor(teacher)
 await assert.rejects(db.query('INSERT INTO pronunciation_messages VALUES($1,$2,$3,$4)',[uid(34),otherThread,teacher,ref('pronunciation_audio',`${teacher}/reply.wav`)]),/learning_reset_in_progress/)
 await assert.rejects(db.query('UPDATE storage.objects SET name=$1 WHERE name=$2',[`${teacher}/renamed.wav`,`${teacher}/reply.wav`]),/learning_reset_in_progress/)
 await actor(other)
 await assert.rejects(db.query('UPDATE storage.objects SET name=$1 WHERE name=$2',[`${other}/stolen.wav`,`${learner}-123456.wav`]),/learning_reset_in_progress/)
 await actor(learner)
 })
 await t.test('data finalization refuses success until Storage API deletion has actually removed objects',async()=>{
 await assert.rejects(finish(token),/audio_removal_incomplete/)
 const rows=await batch(token)
 // Isolated mock of Storage API object removal; production never deletes metadata via SQL.
 await db.query('DELETE FROM storage.objects WHERE bucket_id=$1 AND name=$2',[rows[0].bucket_id,rows[0].object_name])
 assert.equal((await batch(token)).length,rows.length-1);assert.equal(await begin(),token)
 })
 await t.test('resumed API removal is owner-limited and final learning deletion is atomic',async()=>{
 for(const row of await batch(token))assert.equal((await db.query('DELETE FROM storage.objects WHERE bucket_id=$1 AND name=$2 RETURNING id',[row.bucket_id,row.object_name])).rows.length,1)
 assert.equal((await batch(token)).length,0)
 await db.exec('RESET ROLE')
 await db.exec(`CREATE FUNCTION block_reset_test() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'simulated_db_failure';END$$;CREATE TRIGGER fail_reset BEFORE DELETE ON user_exercise_progress FOR EACH ROW EXECUTE FUNCTION block_reset_test();`)
 await actor(learner);await assert.rejects(finish(token),/simulated_db_failure/)
 await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*)::int n FROM submissions WHERE user_id=$1',[learner])).rows[0].n,2)
 assert.equal((await db.query('SELECT count(*)::int n FROM teacher_feedback')).rows[0].n,1)
 await db.exec('DROP TRIGGER fail_reset ON user_exercise_progress');await actor(learner)
 assert.equal(await finish(token),true);assert.equal(await finish(token),true)
 await db.exec('RESET ROLE')
 for(const table of progressTables){assert.equal((await db.query(`SELECT count(*)::int n FROM ${table} WHERE user_id=$1`,[learner])).rows[0].n,0);assert.ok((await db.query(`SELECT count(*)::int n FROM ${table} WHERE user_id=$1`,[other])).rows[0].n>0)}
 assert.equal((await db.query('SELECT count(*)::int n FROM submissions WHERE user_id=$1',[learner])).rows[0].n,0)
 assert.equal((await db.query('SELECT count(*)::int n FROM pronunciation_messages WHERE submission_id=$1',[thread])).rows[0].n,0)
 assert.equal((await db.query('SELECT count(*)::int n FROM teacher_feedback')).rows[0].n,0)
 assert.equal((await db.query('SELECT count(*)::int n FROM pronunciation_messages WHERE submission_id=$1',[otherThread])).rows[0].n,1)
 })
 await t.test('profiles, level access, course enrollments, monthly bookings, invoices and teaching content remain intact',async()=>{
 for(const table of ['registrations','enrollments','monthly_course_bookings','manual_invoice_status','vocabulary_cards','exercises','pronunciation_prompts'])assert.equal((await db.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n,1)
 assert.deepEqual((await db.query('SELECT allowed_levels FROM profiles WHERE id=$1',[learner])).rows[0].allowed_levels,['A1.1'])
 assert.equal((await db.query('SELECT count(*)::int n FROM storage.objects')).rows[0].n,5)
 })
 await t.test('learning can restart, old finalize requests cannot erase it, next reset receives a fresh token',async()=>{
 await actor(learner);await db.query('INSERT INTO user_exercise_progress(user_id) VALUES($1)',[learner]);assert.equal(await finish(token),true)
 assert.equal((await db.query('SELECT count(*)::int n FROM user_exercise_progress WHERE user_id=$1',[learner])).rows[0].n,1)
 const next=await begin();assert.notEqual(next,token);await assert.rejects(finish(token),e=>e.code==='42501');assert.equal(await finish(next),true)
 })
 await t.test('more than one thousand objects are drained in bounded batches without offset skips',async()=>{
 await db.query("INSERT INTO storage.objects(bucket_id,name,owner_id) SELECT 'pronunciation_audio',$1 || '/bulk-' || n || '.wav',$1 FROM generate_series(1,1001) n",[learner])
 const many=await begin();let removed=0;const sizes=[]
 while(true){const rows=await batch(many);if(!rows.length)break;sizes.push(rows.length);for(const row of rows){await db.query('DELETE FROM storage.objects WHERE bucket_id=$1 AND name=$2',[row.bucket_id,row.object_name]);removed++}}
 assert.equal(removed,1001);assert.deepEqual(sizes,[500,500,1]);assert.equal(await finish(many),true)
 })
 await t.test('legacy cross-user parent cycles do not delete or deadlock another resetting learner',async()=>{
 await db.exec('RESET ROLE')
 const a=uid(101),b=uid(102),ta=uid(111),tb=uid(112)
 await db.query("INSERT INTO profiles(id,role) VALUES($1,'student'),($2,'student')",[a,b])
 await db.exec('ALTER TABLE submissions DISABLE TRIGGER learning_reset_guard')
 await db.query("INSERT INTO submissions(id,user_id,type) VALUES($1,$2,'audio'),($3,$4,'audio')",[ta,a,tb,b])
 await db.query('UPDATE submissions SET parent_id=CASE WHEN id=$1 THEN $2::uuid ELSE $1::uuid END WHERE id IN($1,$2)',[ta,tb])
 await db.exec('ALTER TABLE submissions ENABLE TRIGGER learning_reset_guard')
 await actor(a);const ja=await begin();await actor(b);const jb=await begin();await actor(a);assert.equal(await finish(ja),true)
 await db.exec('RESET ROLE');assert.equal((await db.query('SELECT parent_id FROM submissions WHERE id=$1',[tb])).rows[0].parent_id,null)
 await actor(b);assert.equal(await finish(jb),true)
 })
 }finally{await db.close()}
})
