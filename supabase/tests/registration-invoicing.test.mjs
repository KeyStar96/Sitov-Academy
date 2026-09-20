import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'
const read = path => readFile(new URL(path,import.meta.url),'utf8')
const uid=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const learner=uid(1), outsider=uid(2), unverified=uid(3), shared=uid(4), teacher=uid(5), legacy=uid(10)
const baseline=await read('./fixtures/monthly-bookings-baseline.sql')
const monthly=await read('./fixtures/history/migrations/20260909155919_monthly_bookings_teacher_notes.sql')
const profile=await read('./fixtures/history/migrations/20260909165848_profile_dashboard_workflow.sql')
const migration=await read('./fixtures/history/migrations/20260910184129_secure_registration_manual_invoicing.sql')
await test('Verified student identity, staff acceptance and monthly invoice tracking in isolated PostgreSQL',async t=>{
 const db=new PGlite()
 try {
  await db.exec(baseline)
  await db.exec(monthly)
  await db.exec(profile)
  // Equivalent legacy registration tables and confirmation trigger, with no
  // network extension or email triggers. This test can never notify pupils.
  await db.exec(`create table registrations(id uuid primary key default gen_random_uuid(),user_id uuid not null references users(id),status text not null default 'pending',start_date date,course_ids text[],course_prices jsonb);
   create table enrollments(registration_id uuid references registrations(id),course_id text references courses(id),assigned_at timestamptz,price numeric,primary key(registration_id,course_id));
   alter table registrations enable row level security; alter table enrollments enable row level security;
   grant all on registrations,enrollments to anon,authenticated,service_role;
   create policy "Anyone can insert registration" on registrations for insert with check(true);
   create policy "Anyone can insert enrollments" on enrollments for insert with check(true);`)
  await db.exec(await read('./fixtures/history/migrations/add_dynamic_pricing.sql').then(text=>text.slice(text.indexOf('CREATE OR REPLACE FUNCTION'))))
  await db.exec('create trigger on_registration_confirmed after update of status on registrations for each row execute function handle_registration_confirmation()')
  await db.exec(migration)
  await db.exec(await read('./fixtures/history/migrations/20260910185640_guard_duplicate_manual_invoices.sql'))
  for(const [id,email,confirmed,role] of [[learner,'owner@test.invalid',true,'student'],[outsider,'other@test.invalid',true,'student'],[unverified,'unverified@test.invalid',false,'student'],[shared,'shared@test.invalid',true,'student'],[teacher,'teacher@test.invalid',true,'teacher']]){
   await db.query('insert into auth.users values($1,$2,$3)',[id,email,confirmed?new Date():null])
   await db.query('insert into profiles(id,email,role) values($1,$2,$3)',[id,email,role])
  }
  for(const [id,email] of [[legacy,' OWNER@test.invalid '],[uid(11),'unverified@test.invalid'],[uid(12),'shared@test.invalid'],[uid(13),'shared@test.invalid']])
   await db.query("insert into users(id,first_name,last_name,birth_date,email,phone,street,zip,city) values($1,'Existing','Learner','01.01.1980',$2,'0123456789','Teststraße 1','30165','Hannover')",[id,email])
  await db.exec("insert into courses(id,translation_key,type,price,instructor,unit_duration) values('test-course','test','online',99,'Test',60)")
  const bookingCourse=(await db.query('select booking_id from courses')).rows[0].booking_id
  const registration=(await db.query("insert into registrations(user_id,start_date,course_ids,course_prices) values($1,'2026-01-01',array['test-course'],'{\"test-course\":99}') returning id",[legacy])).rows[0].id
  async function actor(id,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id??'']);await db.exec(`set role ${role}`)}
  async function claim(){return (await db.query('select claim_verified_legacy_profile() as value')).rows[0].value}
  async function confirm(source,id){return (await db.query('select confirm_staff_registration($1,$2) as value',[source,id])).rows[0].value}
  async function invoice(source,id,month,created,reference=null){return (await db.query('select set_manual_invoice_status($1,$2,$3,$4,$5) as value',[source,id,month,created,reference])).rows[0].value}
  await t.test('unconfirmed email and unrelated verified account expose no legacy data',async()=>{
   await actor(unverified);assert.deepEqual(await claim(),{id:null,unresolved:false})
   assert.equal((await db.query('select street from profiles')).rows[0].street,null)
   await actor(outsider);assert.deepEqual(await claim(),{id:null,unresolved:false})
   assert.equal((await db.query('select * from users')).rows.length,0)
  })
  await t.test('confirmed email matches case-insensitively and copies full contact details once',async()=>{
   await actor(learner);assert.deepEqual(await claim(),{id:legacy,unresolved:false})
   const row=(await db.query('select name,street,zip_code,legacy_user_id from profiles')).rows[0]
   assert.deepEqual(row,{name:'Existing Learner',street:'Teststraße 1',zip_code:'30165',legacy_user_id:legacy})
   await db.query('update profiles set street=null where id=$1',[learner]);await claim()
   assert.equal((await db.query('select street from profiles')).rows[0].street,null)
  })
  await t.test('ambiguous email never picks the first family member',async()=>{
   await actor(shared);assert.deepEqual(await claim(),{id:null,unresolved:true})
  })
  await t.test('ordinary users cannot grant themselves a role, level, email or legacy identity',async()=>{
   await actor(outsider)
   for(const sql of ["update profiles set role='teacher'","update profiles set allowed_levels=array['B1.2']","update profiles set email='owner@test.invalid'",`update profiles set legacy_user_id='${legacy}'`])await assert.rejects(db.exec(sql),error=>error.code==='42501')
  })
  await t.test('the established association survives verified email changes without claiming another account',async()=>{
   await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)")
   await db.query("update auth.users set email='new@test.invalid' where id=$1",[learner])
   await actor(learner);assert.equal((await claim()).id,legacy)
   await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)")
   await db.query("update auth.users set email='owner@test.invalid' where id=$1",[outsider])
   await actor(outsider);assert.deepEqual(await claim(),{id:null,unresolved:true})
  })
  await t.test('students cannot accept registrations or create invoice labels',async()=>{
   await actor(learner)
   await assert.rejects(confirm('registration',registration),error=>error.code==='42501')
   await assert.rejects(invoice('registration',registration,'2026-10-01',true),error=>error.code==='42501')
  })
  await t.test('staff acceptance is idempotent and preserves the enrollment trigger',async()=>{
   await actor(teacher)
   assert.deepEqual(await confirm('registration',registration),{status:'confirmed'})
   assert.deepEqual(await confirm('registration',registration),{status:'confirmed'})
   await db.exec('reset role')
   const rows=(await db.query('select course_id,price from enrollments')).rows
   assert.equal(rows.length,1);assert.equal(Number(rows[0].price),99)
  })
  await t.test('invoice creation is independent per month, preserves first creation time and can reopen',async()=>{
   await actor(teacher)
   const first=await invoice('registration',registration,'2026-10-01',true,'RE-2026-001')
   const second=await invoice('registration',registration,'2026-10-01',true,'RE-2026-001')
   assert.equal(first.id,second.id);assert.equal(first.invoice_created_at,second.invoice_created_at)
   await invoice('registration',registration,'2026-11-01',true,'RE-2026-002')
   const open=await invoice('registration',registration,'2026-10-01',false)
   assert.equal(open.status,'outstanding');assert.equal(open.invoice_created_at,null)
   assert.equal((await db.query("select count(*)::int as n from manual_invoice_status where status='created'")).rows[0].n,1)
  })
  await t.test('different registration sources cannot create duplicate invoices for the same pupil and month',async()=>{
   await db.exec('reset role')
   const newer=(await db.query("insert into registrations(user_id,start_date,status,course_ids) values($1,'2026-10-01','confirmed',array['test-course']) returning id",[legacy])).rows[0].id
   await actor(teacher)
   await assert.rejects(invoice('registration',newer,'2026-11-01',true),error=>error.code==='40001')
  })
  await t.test('a teacher can confirm monthly bookings but wrong invoice month is rejected',async()=>{
   await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)")
   const booking=(await db.query("insert into monthly_course_bookings(user_id,target_month,course_ids) values($1,'2026-10-01',$2) returning id",[learner,[bookingCourse]])).rows[0].id
   await actor(teacher);await confirm('monthly_booking',booking)
   await assert.rejects(invoice('monthly_booking',booking,'2026-11-01',true),error=>error.code==='23514')
   assert.equal((await invoice('monthly_booking',booking,'2026-10-01',true)).status,'created')
  })
  await t.test('cancelled registration cannot be accepted or marked as invoiced',async()=>{
   await db.exec('reset role');await db.query("update registrations set status='cancelled' where id=$1",[registration])
   await actor(teacher)
   await assert.rejects(confirm('registration',registration),error=>error.code==='40001')
   await assert.rejects(invoice('registration',registration,'2026-12-01',true),error=>error.code==='40001')
  })
  await t.test('anonymous direct insertion and RPCs are denied; student cannot see invoices',async()=>{
   await actor(null,'anon')
   await assert.rejects(claim(),error=>error.code==='42501')
   await assert.rejects(confirm('registration',registration),error=>error.code==='42501')
   await assert.rejects(db.query('insert into registrations(user_id) values($1)',[legacy]),error=>error.code==='42501')
   await assert.rejects(db.query('insert into enrollments(registration_id,course_id) values($1,$2)',[registration,'test-course']),error=>error.code==='42501')
   await actor(learner);assert.equal((await db.query('select * from manual_invoice_status')).rows.length,0)
  })
 } finally {await db.close()}
})
