import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createPhase3Database, actor, teacher, student, id } from './helpers/phase3-db.mjs'

const migration = await readFile(new URL('../migrations/20260930140415_course_cancellation_billing.sql', import.meta.url), 'utf8')
await test('course cancellations update open bills without deleting data or rewriting issued invoices', async t => {
 const db = await createPhase3Database()
 const course=id(800), otherCourse=id(801), privateCourse=id(802)
 const pending=id(810), issued=id(811), privateBooking=id(812)
 const rows=async(sql,args=[]) => (await db.query(sql,args)).rows
 const item=async(booking,cid=course)=>(await rows('SELECT * FROM booking_items WHERE booking_id=$1 AND course_id=$2',[booking,cid]))[0]
 try {
  await db.exec(await readFile(new URL('../vps/13_mail_exception_kind.sql',import.meta.url),'utf8'))
  await db.exec(await readFile(new URL('../vps/14_mail_exceptions.sql',import.meta.url),'utf8'))
  const month=(await rows("SELECT (date_trunc('month',now() AT TIME ZONE 'Europe/Berlin')+interval '1 month')::date::text AS day"))[0].day
  const days=(await rows("SELECT d::date::text AS day FROM generate_series($1::date,($1::date+interval '1 month - 1 day')::date,interval '1 day') d WHERE extract(isodow FROM d)=4",[month])).map(r=>r.day)
  const amount=days.length*20,units=days.length*2
  await rows(`INSERT INTO courses(id,slug,title,type,category,unit_price,unit_minutes)
   VALUES($1,'billing-thursday','Thursday','online','german',10,45),($2,'billing-other','Other Thursday','online','german',10,45),($3,'billing-private','Private','online','private',25,45)`,[course,otherCourse,privateCourse])
  for (const cid of [course,otherCourse]) await rows("INSERT INTO course_schedules(course_id,weekday,start_time,end_time) VALUES($1,4,'19:00','20:30')",[cid])
  const person=(await rows('SELECT id FROM people WHERE auth_user_id=$1',[student]))[0].id
  const makeBooking=async(bid,status='pending',kind='monthly')=>rows(`INSERT INTO bookings(id,person_id,target_month,start_date,kind,status,contact_name,contact_email,privacy_accepted,agb_accepted)
   VALUES($1,$2,$3,$3,$4,$5,'Billing Test','billing@example.test',true,true)`,[bid,person,month,kind,status])
  // Separate people allow the same calendar month; all original records survive.
  await makeBooking(pending)
  const newPerson=async(bid)=>{const p=(await rows("INSERT INTO people(display_name,email) VALUES('Billing Test','billing@example.test') RETURNING id"))[0].id;await rows(`INSERT INTO bookings(id,person_id,target_month,start_date,kind,status,contact_name,contact_email,privacy_accepted,agb_accepted)
   VALUES($1,$2,$3,$3,'monthly','confirmed','Billing Test','billing@example.test',true,true)`,[bid,p,month]);return p}
  const issuedPerson=await newPerson(issued);await newPerson(privateBooking)
  for (const bid of [pending,issued]) for (const cid of [course,otherCourse])
   await rows('INSERT INTO booking_items(booking_id,course_id,title_snapshot,unit_price,unit_minutes,units,amount) VALUES($1,$2,$3,10,45,$4,$5)',[bid,cid,'Frozen Thursday',units,amount])
  await rows("INSERT INTO booking_items(booking_id,course_id,title_snapshot,unit_price,unit_minutes,requested_units,units,amount) VALUES($1,$2,'Private',25,45,7,7,175)",[privateBooking,privateCourse])
  await rows("INSERT INTO invoice_cases(person_id,target_month,booking_id,status,invoice_created_at,invoice_reference) VALUES($1,$2,$3,'created',now(),'KEEP-RE1')",[issuedPerson,month,issued])
  const savedItemIds=(await rows('SELECT id FROM booking_items ORDER BY id')).map(r=>r.id)
  const issuedBefore=await item(issued)
  const peopleBefore=await rows('SELECT id,display_name,email FROM people ORDER BY id')
  const accessBefore=await rows('SELECT * FROM student_level_access ORDER BY auth_user_id,level')
  await rows('INSERT INTO course_exceptions(course_id,date,reason) VALUES($1,$2,$3)',[course,days[0],'Existing cancellation'])

  await t.test('deployment repairs preexisting open amounts and preserves every source ID',async()=>{
   await db.exec(migration);await db.exec(migration)
   assert.deepEqual((await rows('SELECT id FROM booking_items ORDER BY id')).map(r=>r.id),savedItemIds)
   assert.deepEqual(await rows('SELECT id,display_name,email FROM people ORDER BY id'),peopleBefore)
   assert.deepEqual(await rows('SELECT * FROM student_level_access ORDER BY auth_user_id,level'),accessBefore)
   assert.equal(Number((await item(pending)).amount),amount-20)
   assert.equal(Number((await item(pending)).units),units-2)
   assert.equal((await item(pending)).title_snapshot,'Frozen Thursday')
   assert.equal(Number((await item(issued)).amount),Number(issuedBefore.amount))
   assert.equal(Number((await rows('SELECT calendar_adjustment_amount FROM invoice_cases WHERE booking_id=$1',[issued]))[0].calendar_adjustment_amount),-20)
   const definition=(await rows("SELECT pg_get_functiondef('business_private.prepare_month(date)'::regprocedure) definition"))[0].definition
   const personLock=definition.indexOf('for p in select * from public.people order by id for update loop')
   const refresh=definition.indexOf('perform business_private.refresh_booking_calendar(id) from public.bookings where person_id=p.id and target_month=p_month')
   assert.ok(personLock>=0&&refresh>personLock,'Month preparation must retain person → booking lock order')
  })
  await t.test('later Thursday cancellation reduces only selected course and changes its revision',async()=>{
   const before=(await rows('SELECT revision FROM bookings WHERE id=$1',[pending]))[0].revision
   await actor(db,teacher)
   const result=(await rows('SELECT save_course_exception($1,$2,$3) result',[course,days[1],'Teacher absent']))[0].result
   assert.ok(!result?.error,result?.error)
   await db.exec('RESET ROLE')
   assert.equal(Number((await item(pending)).amount),amount-40)
   assert.equal(Number((await item(pending,otherCourse)).amount),amount)
   assert.equal((await rows('SELECT revision FROM bookings WHERE id=$1',[pending]))[0].revision,before+1)
  })
  await t.test('global and overlapping course exceptions deduct each session once',async()=>{
   await rows("INSERT INTO course_exceptions(course_id,date,reason) VALUES(NULL,$1,'Global')",[days[1]])
   assert.equal(Number((await item(pending)).amount),amount-40)
   assert.equal(Number((await item(pending,otherCourse)).amount),amount-20)
   assert.equal(Number((await item(privateBooking,privateCourse)).amount),175)
   assert.equal(Number((await item(privateBooking,privateCourse)).requested_units),7)
  })
  await t.test('changing/removing exceptions restores affected dates and is idempotent',async()=>{
   const first=(await rows('SELECT id FROM course_exceptions WHERE course_id=$1 AND date=$2',[course,days[0]]))[0].id
   await rows('UPDATE course_exceptions SET date=$2 WHERE id=$1',[first,days[2]])
   assert.equal(Number((await item(pending)).amount),amount-40)
   const before=(await rows('SELECT revision FROM bookings WHERE id=$1',[pending]))[0].revision
   await rows("UPDATE course_exceptions SET reason='New reason' WHERE id=$1",[first])
   assert.equal((await rows('SELECT revision FROM bookings WHERE id=$1',[pending]))[0].revision,before)
   await rows('DELETE FROM course_exceptions WHERE id=$1',[first])
   assert.equal(Number((await item(pending)).amount),amount-20)
  })
  await t.test('new signup quote excludes cancellations and snapshot follows original timetable/rates',async()=>{
   await actor(db,null,'service_role')
   const bid=(await rows('SELECT submit_business_registration($1,$2,$3,$4) result',[
    JSON.stringify({name:'New Billing',email:'new-billing@example.test',birth_date:'1980-01-01'}),JSON.stringify([{course_id:course}]),month,JSON.stringify({privacy:true,agb:true}),
   ]))[0].result
   assert.match(bid,/^[a-f0-9-]{36}$/)
   assert.equal(Number((await item(bid)).amount),amount-20)
   await db.exec('RESET ROLE')
   await rows('UPDATE courses SET unit_price=99,unit_minutes=60 WHERE id=$1',[course])
   await rows("UPDATE course_schedules SET start_time='19:30' WHERE course_id=$1",[course])
   await rows("INSERT INTO course_exceptions(course_id,date,reason) VALUES($1,$2,'Later cancellation')",[course,days[2]])
   assert.equal(Number((await item(bid)).amount),amount-40)
   assert.equal(Number((await item(bid)).unit_price),10)
   assert.equal(Number((await item(bid)).unit_minutes),45)
   assert.equal(Number((await item(pending)).amount),amount-40)
  })
  await t.test('created invoices retain amounts and reference; correction appears until explicitly reopened',async()=>{
   const bill=(await rows('SELECT * FROM invoice_cases WHERE booking_id=$1',[issued]))[0]
   assert.equal(bill.invoice_reference,'KEEP-RE1')
   assert.equal(bill.status,'created')
   assert.equal(Number(bill.calendar_adjustment_amount),-60)
   assert.equal(Number((await item(issued)).amount),amount)
   await actor(db,teacher)
   const result=(await rows("SELECT mark_business_invoice($1,$2,false,'') result",[issued,month]))[0].result
   assert.ok(!result?.error,result?.error)
   await db.exec('RESET ROLE')
   assert.equal(Number((await item(issued)).amount),amount-40)
   const reopened=(await rows('SELECT status,calendar_adjustment_amount FROM invoice_cases WHERE booking_id=$1',[issued]))[0]
   assert.deepEqual(reopened,{status:'outstanding',calendar_adjustment_amount:'0.00'})
  })
  await t.test('existing month preparation repairs an open snapshot in place',async()=>{
   await rows('UPDATE booking_items SET units=999,amount=999 WHERE booking_id=$1 AND course_id=$2',[pending,course])
   await actor(db,teacher)
   const result=(await rows('SELECT prepare_business_month($1) result',[month]))[0].result
   assert.ok(!result?.error,result?.error)
   await db.exec('RESET ROLE')
   assert.equal(Number((await item(pending)).amount),amount-40)
   assert.equal((await rows('SELECT id FROM booking_items WHERE booking_id=$1 AND course_id=$2',[pending,course]))[0].id,(await item(pending)).id)
  })
  await t.test('mid-month registrations respect the start date and course bounds',async()=>{
   const bounded=id(820)
   await rows("INSERT INTO courses(id,slug,title,type,category,unit_price,unit_minutes,start_date,end_date) VALUES($1,'bounded-calendar','Bounded','online','german',10,45,$2,$3)",[bounded,days[0],days[3]])
   await rows("INSERT INTO course_schedules(course_id,weekday,start_time,end_time) VALUES($1,4,'19:00','20:30')",[bounded])
   await actor(db,null,'service_role')
   const bid=(await rows('SELECT submit_business_registration($1,$2,$3,$4) result',[
    JSON.stringify({name:'Mid-month Billing',email:'midmonth-billing@example.test',birth_date:'1980-01-01'}),JSON.stringify([{course_id:bounded}]),days[2],JSON.stringify({privacy:true,agb:true}),
   ]))[0].result
   assert.equal(Number((await item(bid,bounded)).amount),40)
   await db.exec('RESET ROLE')
   await rows("INSERT INTO course_exceptions(course_id,date,reason) VALUES($1,$2,'Before signup')",[bounded,days[0]])
   assert.equal(Number((await item(bid,bounded)).amount),40)
   await rows("INSERT INTO course_exceptions(course_id,date,reason) VALUES($1,$2,'Last lesson cancelled')",[bounded,days[3]])
   assert.equal(Number((await item(bid,bounded)).amount),20)
   assert.equal(Number((await item(bid,bounded)).units),2)
  })
  await t.test('confirmation and first invoice marking refresh amounts before freezing them',async()=>{
   await rows('UPDATE booking_items SET units=999,amount=999 WHERE booking_id=$1 AND course_id=$2',[pending,course])
   await actor(db,teacher)
   const confirmed=(await rows('SELECT confirm_business_booking($1) result',[pending]))[0].result
   assert.ok(!confirmed?.error,confirmed?.error)
   await db.exec('RESET ROLE')
   assert.equal(Number((await item(pending)).amount),amount-40)
   await rows('UPDATE booking_items SET units=999,amount=999 WHERE booking_id=$1 AND course_id=$2',[pending,course])
   await actor(db,teacher)
   const marked=(await rows("SELECT mark_business_invoice($1,$2,true,'RE-NEW') result",[pending,month]))[0].result
   assert.ok(!marked?.error,marked?.error)
   await db.exec('RESET ROLE')
   assert.equal(Number((await item(pending)).amount),amount-40)
   assert.equal((await rows('SELECT status FROM invoice_cases WHERE booking_id=$1',[pending]))[0].status,'created')
  })
  await t.test('direct learners cannot invoke privileged repricing or edit correction flags',async()=>{
   await actor(db,student)
   await assert.rejects(rows('SELECT business_private.refresh_booking_calendar($1)',[pending]),e=>e.code==='42501')
   await assert.rejects(rows('UPDATE invoice_cases SET calendar_adjustment_amount=0'),e=>e.code==='42501')
   await db.exec('RESET ROLE')
  })
 } finally { await db.close() }
})
