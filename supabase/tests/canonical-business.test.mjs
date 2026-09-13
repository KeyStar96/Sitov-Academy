import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
import {test} from 'node:test'
import assert from 'node:assert/strict'
const read=path=>readFile(new URL(path,import.meta.url),'utf8')
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const teacher=uid(1),student=uid(2),other=uid(3)
await test('canonical business model and explicit private lesson quantities',async t=>{
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
 await db.exec(await read('../standardization/foundation.sql'))
 await db.exec(await read('../standardization/business.sql'))
 const actor=async(user,role='authenticated')=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[user??'']);await db.exec(`SET ROLE ${role}`)}
 const start=(await db.query("SELECT (date_trunc('month',now())+interval '1 month')::date::text date")).rows[0].date
 const course='901248ac-2816-4e93-be2e-5de7a9faa343'
 const privateCourse='2d4bf352-4840-4213-8cfc-6a6ed6aa1e1d'
 const selections=(units=3)=>[{course_id:privateCourse,requested_units:units}]
 const register=async(name,selection=selections(),trial=false,date=start)=>{
   await actor(null,'service_role')
   return (await db.query('SELECT submit_business_registration($1,$2,$3,$4,$5,$6) id',[JSON.stringify({name,email:`${name.toLowerCase().replaceAll(' ','-')}@example.test`}),JSON.stringify(selection),date,JSON.stringify({privacy:true,agb:true}),'uk',trial])).rows[0].id
 }
 await t.test('exactly nine physical courses use canonical slugs and columns',async()=>{
  for(const role of ['anon','service_role']){
   await actor(null,role)
   const catalog=(await db.query('SELECT slug,unit_price,unit_minutes FROM courses ORDER BY sort_order')).rows
   assert.equal(catalog.length,9)
   assert.deepEqual(catalog.map(c=>c.slug),['deutsch-level-1','deutsch-level-2','deutsch-level-3','sprechtraining-montag','sprechtraining-dienstag','sprechtraining-mittwoch','deutsch-a1-1-online','deutsch-b1-online','privatunterricht-online'])
   assert.equal(Number(catalog[8].unit_price),25);assert.equal(catalog[8].unit_minutes,45)
  }
  await db.exec('RESET ROLE')
  const old=(await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name IN('courses','course_schedules') AND column_name IN('price','unit_duration','translation_key','instructor','alternate_start_time','alternate_end_time')")).rows
  assert.deepEqual(old,[])
  assert.equal((await db.query("SELECT count(*)::int n FROM course_translations WHERE locale='de'")).rows[0].n,0)
  assert.equal((await db.query("SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('submit_business_registration','save_business_month')")).rows[0].n,2)
 })
 let booking
 await t.test('three requested private units create an immutable 75 euro snapshot and detailed mail',async()=>{
  booking=await register('Student')
  const item=(await db.query('SELECT * FROM booking_items WHERE booking_id=$1',[booking])).rows[0]
  assert.equal(item.requested_units,3);assert.equal(Number(item.units),3);assert.equal(Number(item.unit_price),25);assert.equal(item.unit_minutes,45);assert.equal(Number(item.amount),75)
  const job=(await db.query('SELECT payload FROM private.mail_outbox WHERE dedupe_key=$1',[`registration:${booking}`])).rows[0].payload
  assert.deepEqual(job.courses,[{title:'Privatunterricht – Online',units:3,unitPrice:25,unitMinutes:45,price:75}])
  const before=item
  await db.query('UPDATE courses SET unit_price=30 WHERE id=$1',[privateCourse])
  assert.deepEqual((await db.query('SELECT * FROM booking_items WHERE booking_id=$1',[booking])).rows[0],before)
  await db.query('UPDATE courses SET unit_price=25 WHERE id=$1',[privateCourse])
 })
 await t.test('NULL, fractional, string, oversized, duplicate and injected quantities roll back all registration effects',async()=>{
  const bad=[null,[],{},selections(null),selections(0),selections(-1),selections(1.5),selections('3'),selections(1001),[{course_id:privateCourse}], [...selections(),...selections()], [{course_id:privateCourse,requested_units:3,unit_price:0}], [{course_id:course,requested_units:3}],Array(101).fill({course_id:course})]
  await actor(null,'service_role')
  const before=(await db.query('SELECT (SELECT count(*) FROM people)::int people,(SELECT count(*) FROM bookings)::int bookings,(SELECT count(*) FROM private.mail_outbox)::int jobs')).rows[0]
  for(const value of bad){
   await assert.rejects(register('Invalid',value),e=>e.code==='23514')
   assert.deepEqual((await db.query('SELECT (SELECT count(*) FROM people)::int people,(SELECT count(*) FROM bookings)::int bookings,(SELECT count(*) FROM private.mail_outbox)::int jobs')).rows[0],before)
  }
 })
 await t.test('private trial requests cannot bypass the price or requested quantity',async()=>{
  await assert.rejects(register('Private Trial',selections(),true),e=>e.code==='23514')
  await assert.rejects(register('Private Trial Empty',[{course_id:privateCourse}],true),e=>e.code==='23514')
 })
 await t.test('scheduled courses compute calendar units and reject requested quantities',async()=>{
  const id=await register('Scheduled',[{course_id:course}])
  const item=(await db.query('SELECT * FROM booking_items WHERE booking_id=$1',[id])).rows[0]
  assert.equal(item.requested_units,null);assert.ok(Number(item.units)>0);assert.equal(Number(item.amount),Number(item.units)*Number(item.unit_price))
 })
 await t.test('verified student may change quantities with exact revisions, pause explicitly, but cannot change an issued invoice',async()=>{
  await db.exec('RESET ROLE')
  await db.query("INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES($1,'student@example.test',now(),$2)",[student,JSON.stringify({native_language:'Russisch'})])
  await actor(student)
  await db.query('SELECT save_business_month($1,$2,false,$3,1)',[start,JSON.stringify(selections(7)),booking])
  assert.equal(Number((await db.query('SELECT amount FROM booking_items WHERE booking_id=$1',[booking])).rows[0].amount),175)
  await assert.rejects(db.query('SELECT save_business_month($1,$2,false,$3,1)',[start,JSON.stringify(selections(8)),booking]),e=>e.code==='PT409')
  await assert.rejects(db.query('SELECT save_business_month($1,$2,true,$3,2)',[start,JSON.stringify(selections(7)),booking]),e=>e.code==='23514')
  for(const [month,data,paused,revision,code] of [[null,selections(),false,2,'22008'],[start,null,false,2,'23514'],[start,selections(),null,2,'23514'],[start,selections(),false,null,'PT409']]){
   await assert.rejects(db.query('SELECT save_business_month($1,$2,$3,$4,$5)',[month,JSON.stringify(data),paused,booking,revision]),e=>e.code===code)
  }
  assert.equal((await db.query('SELECT revision FROM bookings WHERE id=$1',[booking])).rows[0].revision,2)
  await db.query("SELECT save_business_month($1,'[]',true,$2,2)",[start,booking])
  assert.equal((await db.query('SELECT status FROM bookings WHERE id=$1',[booking])).rows[0].status,'cancelled')
  assert.equal((await db.query('SELECT count(*)::int n FROM booking_items WHERE booking_id=$1',[booking])).rows[0].n,0)
  await db.query('SELECT save_business_month($1,$2,false,$3,3)',[start,JSON.stringify(selections(4)),booking])
  await actor(teacher)
  await db.query('SELECT confirm_business_booking($1)',[booking]);await db.query("SELECT mark_business_invoice($1,$2,true,'TEST-INVOICE')",[booking,start])
  await actor(student)
  await assert.rejects(db.query('SELECT save_business_month($1,$2,false,$3,5)',[start,JSON.stringify(selections(9)),booking]),e=>e.code==='23514')
  assert.equal(Number((await db.query('SELECT amount FROM booking_items WHERE booking_id=$1',[booking])).rows[0].amount),100)
 })
 await t.test('the next-month preparer inherits the exact quantity once and recalculates at the current unit price',async()=>{
  const id=await register('Recurring')
  await db.query("UPDATE bookings SET target_month=($2::date-interval '1 month')::date,start_date=($2::date-interval '1 month')::date,status='confirmed' WHERE id=$1",[id,start])
  await db.query('UPDATE courses SET unit_price=30 WHERE id=$1',[privateCourse])
  await actor(teacher)
  assert.equal((await db.query('SELECT prepare_business_month($1) n',[start])).rows[0].n,1)
  assert.equal((await db.query('SELECT prepare_business_month($1) n',[start])).rows[0].n,0)
  const item=(await db.query('SELECT i.requested_units,i.units,i.amount FROM booking_items i JOIN bookings b ON b.id=i.booking_id WHERE b.person_id=(SELECT person_id FROM bookings WHERE id=$1) AND b.target_month=$2',[id,start])).rows[0]
  assert.equal(item.requested_units,3);assert.equal(Number(item.units),3);assert.equal(Number(item.amount),90)
 })
 await t.test('the staff CMS manages new UUID courses and rejects source translations and impossible private schedules',async()=>{
  const input={slug:'test-private-presence',title:'Private vor Ort',description:'Neu',type:'presence',category:'private',level:'C1',unit_price:40,unit_minutes:60,start_date:'',end_date:'',trial_lessons:false,sort_order:120,archived:false,schedules:[],translations:[{locale:'uk',title:'Індивідуально',description:''}],exceptions:[]}
  await actor(student);await assert.rejects(db.query('SELECT save_business_course($1)',[JSON.stringify(input)]),e=>e.code==='42501')
  await actor(teacher)
  const id=(await db.query('SELECT save_business_course($1) id',[JSON.stringify(input)])).rows[0].id
  assert.match(id,/^[0-9a-f-]{36}$/)
  await db.query('SELECT save_business_course($1)',[JSON.stringify({...input,id,title:'Updated',unit_price:45,archived:true})])
  assert.equal((await db.query('SELECT archived_at IS NOT NULL archived FROM courses WHERE id=$1',[id])).rows[0].archived,true)
  for(const bad of [{...input,trial_lessons:true},{...input,schedules:[{weekday:1,start_time:'09:00',end_time:'10:00'}]},{...input,translations:[{locale:'de',title:'Duplicate German',description:''}]}])await assert.rejects(db.query('SELECT save_business_course($1)',[JSON.stringify({...bad,slug:bad.slug+'-bad'})]),e=>e.code==='23514')
  await assert.rejects(db.query('SELECT save_business_course($1)',[JSON.stringify({...input,id:course,slug:'deutsch-level-1'})]),e=>e.code==='23514')
  assert.equal((await db.query('SELECT category FROM courses WHERE id=$1',[course])).rows[0].category,'german')
 })
 }finally{await db.close()}
})
