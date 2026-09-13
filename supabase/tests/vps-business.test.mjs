import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
import {test} from 'node:test'
import assert from 'node:assert/strict'
const read=path=>readFile(new URL(path,import.meta.url),'utf8')
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const teacher=uid(1),student=uid(2),other=uid(3)
await test('VPS business model uses local PostgreSQL only',async t=>{
 const db=new PGlite()
 try {
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth;GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb DEFAULT '{}');
 CREATE TABLE profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),name text,email text,role text,phone text,street text,zip_code text,city text,legacy_user_id uuid,ui_language text DEFAULT 'de',native_language text CHECK(native_language IN('Deutsch','Russisch','Türkisch','Englisch','Ukrainisch','Andere')),allowed_levels text[] DEFAULT '{}');
 GRANT SELECT ON profiles TO authenticated;GRANT ALL ON profiles TO service_role;
 CREATE TABLE courses(id text PRIMARY KEY,booking_id uuid,title text,translation_key text,type text,price numeric,unit_duration integer,instructor text,start_date date,end_date date,trial_lessons boolean,sessions jsonb);
 CREATE TABLE course_exceptions(date date,reason text,course_ids text[]);
 CREATE TABLE users(id uuid);CREATE TABLE registrations(id uuid);CREATE TABLE monthly_course_bookings(id uuid);
 `)
 await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[teacher,'teacher@example.test'])
 await db.query("INSERT INTO profiles(id,name,email,role,native_language) VALUES($1,'Teacher','teacher@example.test','teacher','Deutsch')",[teacher])
 for(const c of JSON.parse(await read('./fixtures/vps-courses.json'))){await db.query('INSERT INTO courses VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[c.id,c.booking_id,c.title,c.translation_key,c.type,c.price,c.unit_duration,c.instructor,c.start_date,c.end_date,c.trial_lessons,JSON.stringify(c.sessions)])}
 await db.exec(await read('../vps/mail.sql'))
 await db.exec(await read('../vps/business.sql'))
 const actor=async(user,role='authenticated')=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[user??'']);await db.exec(`SET ROLE ${role}`)}
 const start=(await db.query("SELECT (date_trunc('month',now())+interval '1 month')::date::text date")).rows[0].date
 const course='901248ac-2816-4e93-be2e-5de7a9faa343'
 let booking,person
 await t.test('ten active courses retain schedules and all four translations',async()=>{
  await actor(null,'anon')
  assert.equal((await db.query('SELECT count(*)::int n FROM courses')).rows[0].n,10)
  assert.equal((await db.query('SELECT count(*)::int n FROM course_schedules')).rows[0].n,13)
  assert.equal((await db.query('SELECT count(*)::int n FROM course_translations')).rows[0].n,40)
  await assert.rejects(db.query('SELECT * FROM people'),e=>e.code==='42501')
 })
 await t.test('public submission is atomic and server computes amounts',async()=>{
  await actor(null,'service_role')
  booking=(await db.query('SELECT submit_business_registration($1,$2,$3,$4) id',[JSON.stringify({name:'Student',email:'student@example.test',birth_date:'1980-01-01'}),[course],start,JSON.stringify({privacy:true,agb:true})])).rows[0].id
  const row=(await db.query('SELECT * FROM bookings WHERE id=$1',[booking])).rows[0];person=row.person_id
  assert.equal(row.status,'pending')
  const item=(await db.query('SELECT * FROM booking_items WHERE booking_id=$1',[booking])).rows[0]
  assert.equal(Number(item.unit_price),2.5);assert.ok(Number(item.amount)>0)
  assert.equal((await db.query('SELECT count(*)::int n FROM private.mail_outbox')).rows[0].n,2)
  const before=(await db.query('SELECT count(*)::int n FROM people')).rows[0].n
  await assert.rejects(db.query('SELECT submit_business_registration($1,$2,$3,$4)',[JSON.stringify({name:'Bad Course',email:'bad@example.test'}),[uid(99)],start,JSON.stringify({privacy:true,agb:true})]))
  assert.equal((await db.query('SELECT count(*)::int n FROM people')).rows[0].n,before)
 })
 await t.test('verified signup claims own records, other learner cannot see them',async()=>{
  await db.exec('RESET ROLE')
  for(const [id,email] of [[student,'student@example.test'],[other,'other@example.test']])await db.query("INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES($1,$2,now(),'{\"native_language\":\"Russisch\"}')",[id,email])
  await actor(student)
  assert.equal((await db.query('SELECT claim_verified_legacy_profile() value')).rows[0].value.id,person)
  assert.equal((await db.query('SELECT count(*)::int n FROM bookings')).rows[0].n,1)
  await actor(other);assert.equal((await db.query('SELECT count(*)::int n FROM bookings')).rows[0].n,0)
  await assert.rejects(db.query('SELECT confirm_business_booking($1)',[booking]),e=>e.code==='42501')
 })
 await t.test('stale revisions return a business conflict without changing the booking',async()=>{
  await actor(student)
  const before=(await db.query('SELECT revision FROM bookings WHERE id=$1',[booking])).rows[0].revision
  await assert.rejects(db.query('SELECT save_business_month($1,$2,false,$3,$4)',[start,[course],booking,before-1]),e=>e.code==='PT409')
  assert.equal((await db.query('SELECT revision FROM bookings WHERE id=$1',[booking])).rows[0].revision,before)
 })
 await t.test('confirmation and invoice status are idempotent and block later learner edits',async()=>{
  await actor(teacher);await db.query('SELECT confirm_business_booking($1)',[booking]);await db.query('SELECT confirm_business_booking($1)',[booking])
  assert.equal((await db.query('SELECT count(*)::int n FROM invoice_cases')).rows[0].n,1)
  await db.query("SELECT mark_business_invoice($1,$2,true,'PK-1')",[booking,start])
  await actor(student)
  await assert.rejects(db.query('SELECT save_business_month($1,$2,true,$3,2)',[start,[],booking]),e=>e.code==='23514')
  await assert.rejects(db.query("UPDATE people SET auth_user_id=$1 WHERE id=$2",[other,person]),e=>e.code==='42501')
 })
 await t.test('staff can add a new course, schedules and translations without a whitelist',async()=>{
  await actor(teacher)
  const payload={slug:'conversation-c2',title:'Neue Gesprächsrunde',description:'Beschreibung',type:'online',category:'speaking',level:'C2',price:12,unit_duration:60,instructor:'standard',start_date:'',end_date:'',trial_lessons:false,sort_order:120,archived:false,schedules:[{weekday:6,start_time:'10:00',end_time:'11:00',alternate_start_time:'',alternate_end_time:''}],translations:[{locale:'ru',title:'Новый курс',description:'Описание'}],exceptions:[]}
  const id=(await db.query('SELECT save_business_course($1) id',[JSON.stringify(payload)])).rows[0].id
  await actor(null,'anon');assert.equal((await db.query('SELECT title FROM courses WHERE id=$1',[id])).rows[0].title,payload.title)
  await actor(teacher);await db.query('SELECT save_business_course($1)',[JSON.stringify({...payload,id,archived:true})]);await actor(null,'anon')
  assert.equal((await db.query('SELECT * FROM courses WHERE id=$1',[id])).rows.length,0)
 })
 await t.test('unverified email cannot claim an application and duplicate identities remain unresolved',async()=>{
  await actor(null,'service_role')
  for(const name of ['Relative One','Relative Two'])await db.query('SELECT submit_business_registration($1,$2,$3,$4)',[JSON.stringify({name,email:'family@example.test',birth_date:'1980-01-01'}),[course],start,JSON.stringify({privacy:true,agb:true})])
  await db.exec('RESET ROLE');await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[uid(4),'family@example.test'])
  await actor(uid(4));await assert.rejects(db.query('SELECT claim_verified_legacy_profile()'),e=>e.code==='42501')
  await db.exec('RESET ROLE');await db.query('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1',[uid(4)]);await actor(uid(4))
  assert.equal((await db.query('SELECT claim_verified_legacy_profile() value')).rows[0].value.unresolved,true)
  assert.equal((await db.query('SELECT count(*)::int n FROM bookings')).rows[0].n,0)
 })
 await t.test('an existing price snapshot remains unchanged when the course price changes',async()=>{
  await db.exec('RESET ROLE');const before=(await db.query('SELECT amount,unit_price,title_snapshot FROM booking_items WHERE booking_id=$1',[booking])).rows[0]
  await db.query("UPDATE courses SET price=99,title='Changed for future bookings' WHERE id=$1",[course])
  assert.deepEqual((await db.query('SELECT amount,unit_price,title_snapshot FROM booking_items WHERE booking_id=$1',[booking])).rows[0],before)
 })
 }finally{await db.close()}
})
