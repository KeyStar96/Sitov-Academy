import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'
const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const staff = id(1), student = id(2), second = id(3), person = id(10)
await test('canonical identity, verified association, and one staff note per learner', async t => {
 const db = new PGlite()
 try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
   CREATE SCHEMA auth; CREATE SCHEMA business_private; CREATE SCHEMA monthly_booking_private;
   GRANT USAGE ON SCHEMA auth,business_private TO authenticated,service_role;
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb DEFAULT '{}');
   CREATE TABLE profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),role text DEFAULT 'student',native_language text CHECK(native_language IN('Deutsch','Russisch','Türkisch','Ukrainisch','Englisch','Andere')),ui_language text DEFAULT 'de',created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),subscription_status text,stripe_customer_id text,stripe_subscription_id text);
   CREATE TABLE people(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),auth_user_id uuid UNIQUE REFERENCES profiles(id),display_name text NOT NULL,email text NOT NULL,phone text,street text,postal_code text,city text,birth_date date,preferred_locale text DEFAULT 'de',created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
   CREATE TABLE bookings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),person_id uuid REFERENCES people(id));
   CREATE TABLE locales(code text PRIMARY KEY); INSERT INTO locales VALUES('de'),('en'),('ru'),('uk'),('tr'); GRANT SELECT ON locales TO authenticated;
   CREATE TABLE teacher_student_notes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_id uuid NOT NULL REFERENCES profiles(id),teacher_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id),note_text text NOT NULL,discount_percent numeric NOT NULL DEFAULT 0,is_blackboard boolean NOT NULL DEFAULT false);
   CREATE VIEW profile_details AS SELECT p.*,person.id legacy_user_id,person.display_name name FROM profiles p LEFT JOIN people person ON person.auth_user_id=p.id;
   CREATE FUNCTION public.claim_verified_legacy_profile() RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;
   INSERT INTO auth.users(id,email,email_confirmed_at) VALUES('${staff}','staff@test.invalid',now()),('${student}','owner@test.invalid',NULL),('${second}','other@test.invalid',now());
   INSERT INTO profiles(id,role,native_language) VALUES('${staff}','teacher','Deutsch'),('${student}','student','Russisch'),('${second}','student','Andere');
   INSERT INTO people(auth_user_id,display_name,email) VALUES('${staff}','Staff','staff@test.invalid'),('${student}','Fresh signup','owner@test.invalid'),('${second}','Other','other@test.invalid');
   INSERT INTO people(id,display_name,email,street) VALUES('${person}','Existing learner','OWNER@test.invalid','Private street');
   INSERT INTO bookings(person_id) VALUES('${person}');
   INSERT INTO teacher_student_notes(id,student_id,teacher_id,note_text,is_blackboard) VALUES('${id(20)}','${student}','${staff}','First note',true),('${id(21)}','${student}','${staff}','Second note',false);
  `)
  const baseline = await read('../vps/business.sql')
  const claim = baseline.slice(baseline.indexOf('create or replace function business_private.claim_person()'), baseline.indexOf('create or replace function public.claim_verified_legacy_profile()'))
  await db.exec('GRANT ALL ON auth.users,people,bookings TO service_role')
  await db.exec(claim)
  await db.exec(await read('../standardization/identity.sql'))
  await db.exec(`CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION business_private.provision_profile();
   DROP VIEW profile_details; ALTER TABLE profiles DROP COLUMN subscription_status,DROP COLUMN stripe_customer_id,DROP COLUMN stripe_subscription_id;`)
  const actor = async (who, role='authenticated') => {
   await db.exec('RESET ROLE'); await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[who ?? '']); await db.exec(`SET ROLE ${role}`)
  }
  await t.test('stores ISO codes and canonical identity fields without compatibility view or billing columns', async () => {
   assert.deepEqual((await db.query('SELECT native_language FROM profiles ORDER BY id')).rows.map(row=>row.native_language),['de','ru',null])
   assert.equal((await db.query("SELECT to_regclass('public.profile_details') value")).rows[0].value,null)
   assert.equal((await db.query("SELECT to_regprocedure('public.claim_verified_legacy_profile()') value")).rows[0].value,null)
   assert.equal((await db.query("SELECT count(*)::int count FROM information_schema.columns WHERE table_name='profiles' AND column_name LIKE '%stripe%'")).rows[0].count,0)
   await assert.rejects(db.query("UPDATE profiles SET native_language='Russisch' WHERE id=$1",[student]),e=>e.code==='23503')
  })
  await t.test('never associates an unverified signup, then binds exactly the verified email without caller identifiers', async () => {
   await actor(student)
   await assert.rejects(db.query('SELECT claim_verified_person()'),e=>e.code==='42501')
   assert.equal((await db.query('SELECT * FROM people WHERE id=$1',[person])).rows.length,0)
   await assert.rejects(db.query('UPDATE people SET auth_user_id=$1 WHERE id=$2',[student,person]),e=>e.code==='42501')
   await actor(null,'service_role');await db.query('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1',[student])
   await actor(student)
   assert.deepEqual((await db.query('SELECT claim_verified_person() value')).rows[0].value,{id:person,unresolved:false})
   assert.deepEqual((await db.query('SELECT claim_verified_person() value')).rows[0].value,{id:person,unresolved:false})
   await actor(null,'service_role')
   assert.equal((await db.query('SELECT street FROM people WHERE auth_user_id=$1',[student])).rows[0].street,'Private street')
  })
  await t.test('leaves shared email candidates unresolved and rejects role/identity mass assignment', async () => {
   await actor(null,'service_role');await db.exec("INSERT INTO people(display_name,email) VALUES('A','other@test.invalid'),('B','other@test.invalid')")
   await actor(second)
   assert.equal((await db.query('SELECT claim_verified_person() value')).rows[0].value.unresolved,true)
   for(const statement of ["UPDATE profiles SET role='teacher'",`UPDATE profiles SET id='${id(50)}'`]) await assert.rejects(db.exec(statement),e=>e.code==='42501')
   assert.equal((await db.query('SELECT count(*)::int count FROM profiles')).rows[0].count,1)
   await db.query("UPDATE profiles SET ui_language='uk' WHERE id=$1",[second])
  })
  await t.test('provisions canonical display_name and ISO metadata while ignoring forged privileges', async () => {
   await actor(null,'service_role')
   await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,'new@test.invalid',$2)",[id(4),JSON.stringify({display_name:'New Learner',native_language:'tr',ui_language:'en',role:'admin'})])
   assert.deepEqual((await db.query('SELECT role,native_language,ui_language FROM profiles WHERE id=$1',[id(4)])).rows[0],{role:'student',native_language:'tr',ui_language:'en'})
   assert.equal((await db.query('SELECT display_name FROM people WHERE auth_user_id=$1',[id(4)])).rows[0].display_name,'New Learner')
  })
  await t.test('preserves note prose while enforcing one row and real empty text after clearing', async () => {
   await actor(staff)
   const existing=(await db.query('SELECT * FROM teacher_student_notes')).rows
   assert.equal(existing.length,1);assert.equal(existing[0].note_text,'First note\n\nSecond note')
   assert.equal('discount_percent' in existing[0],false);assert.equal('is_blackboard' in existing[0],false)
   const cleared=(await db.query('SELECT * FROM save_student_blackboard($1,$2,$3)',[student,'',existing[0].id])).rows[0]
   assert.equal(cleared.id,existing[0].id);assert.equal(cleared.note_text,'')
   const first=(await db.query('SELECT * FROM save_student_blackboard($1,$2)',[second,'New note'])).rows[0]
   const repeated=(await db.query('SELECT * FROM save_student_blackboard($1,$2)',[second,'Updated'])).rows[0]
   assert.equal(first.id,repeated.id)
   await assert.rejects(db.query('SELECT * FROM save_student_blackboard($1,$2,$3)',[second,'Forbidden',existing[0].id]),e=>e.code==='PT409')
   await assert.rejects(db.query('INSERT INTO teacher_student_notes(student_id,teacher_id,note_text) VALUES($1,$2,$3)',[second,staff,'Duplicate']),e=>e.code==='23505')
   await actor(student)
   assert.equal((await db.query('SELECT * FROM teacher_student_notes')).rows.length,0)
   await assert.rejects(db.query('SELECT * FROM save_student_blackboard($1,$2)',[student,'Forged']),e=>e.code==='42501')
  })
 } finally { await db.close() }
})
