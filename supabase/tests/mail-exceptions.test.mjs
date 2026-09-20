import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPhase3Database, actor, id, teacher, outsider, apply, result } from './helpers/phase3-db.mjs'
import { readFile } from 'node:fs/promises'
import { renderTransactionalEmail, MAIL_LOCALES } from '../../lib/mail/templates.mjs'

await test('Phase 6 exception snapshots and independent transactional notices', async t => {
 const db = await createPhase3Database(), course=id(660), unrelated=id(661)
 let booking
 const mails=async()=> (await db.query('SELECT dedupe_key,kind::text,payload FROM private.mail_outbox ORDER BY created_at,id')).rows
 try {
  // Separate commits are required by PostgreSQL when adding an enum label.
  await apply(db,['13_mail_exception_kind.sql'])
  await apply(db,['14_mail_exceptions.sql'])
  await db.query("INSERT INTO courses(id,slug,title,type,category,level,audience_code,unit_price) VALUES($1,'mail-a1','Deutsch <A1>','presence','german','A1.1','A1.1',5),($2,'mail-other','Other','presence','german','A1.1','A1.1',5)",[course,unrelated])
  for(const cid of [course,unrelated]) await db.query("INSERT INTO course_schedules(course_id,weekday,start_time,end_time) VALUES($1,1,'09:00','10:00')",[cid])
  const start=(await db.query("SELECT (d+((8-extract(isodow FROM d)::int)%7))::text AS value FROM (SELECT (date_trunc('month',now())+interval '1 month')::date d) x")).rows[0].value
  const date=async n=>(await db.query('SELECT ($1::date+$2::integer)::text AS value',[start,n])).rows[0].value
  const known=await date(7), global=await date(14), late=await date(21)
  for(const [cid,offset,reason] of [[course,7,'Ferien'],[null,14,'Feiertag'],[unrelated,21,'Fremder Kurs'],[course,1,'Kein Unterrichtstag'],[course,35,'Anderer Monat']])
   await db.query('INSERT INTO course_exceptions(course_id,date,reason) VALUES($1,$2,$3)',[cid,await date(offset),reason])
  await t.test('registration snapshot filters courses, weekdays and booked month; all locales render',async()=>{
   await actor(db,null,'service_role')
   booking=await result(db,'SELECT submit_business_registration($1,$2,$3,$4,$5) result',[JSON.stringify({name:'Mail Student',email:'mail@example.test'}),JSON.stringify([{course_id:course}]),start,JSON.stringify({privacy:true,agb:true}),'de'])
   assert.equal(typeof booking,'string',JSON.stringify(booking))
   await db.exec('RESET ROLE')
   const jobs=await mails(); assert.equal(jobs.length,2)
   const mail=jobs.find(x=>x.dedupe_key===`registration:${booking}`)
   assert.deepEqual(mail.payload.exceptions.map(x=>x.date),[known,global])
   assert.ok(mail.payload.exceptions.every(x=>x.courseId===course))
   assert.equal(jobs.find(x=>x.kind==='new_enrollment').dedupe_key,`staff-registration:${booking}`)
   for(const lang of MAIL_LOCALES) {
    const output=renderTransactionalEmail(mail.kind,lang,mail.payload,'https://217.154.228.254')
    assert.match(output.text,/Ferien/); assert.match(output.html,/Feiertag/)
   }
  })
  await t.test('confirmation retains a fresh snapshot and is idempotent',async()=>{
   await actor(db,teacher)
   assert.equal(await result(db,'SELECT confirm_business_booking($1) result',[booking]),null)
   await result(db,'SELECT confirm_business_booking($1) result',[booking])
   await db.exec('RESET ROLE')
   const jobs=await mails(); assert.equal(jobs.length,3)
   assert.equal(jobs.find(x=>x.kind==='registration_confirmed').payload.exceptions.length,2)
  })
  await t.test('later cancellation has its own event; registration payload stays immutable',async()=>{
   const before=(await mails()).find(x=>x.kind==='registration_received')
   await actor(db,teacher)
   const response=await result(db,'SELECT save_course_exception($1,$2,$3) result',[course,late,'Neu <Ferien>'])
   assert.equal(response?.error,undefined,JSON.stringify(response))
   await db.exec('RESET ROLE')
   const jobs=await mails(); assert.equal(jobs.length,4)
   assert.deepEqual(jobs.find(x=>x.kind==='registration_received'),before)
   const notice=jobs.find(x=>x.kind==='course_exception_added')
   assert.equal(notice.dedupe_key,`course-exception:${booking}:${course}:${late}`)
   assert.equal(notice.payload.exceptions[0].date,late)
  })
  await t.test('CMS delete/reinsert and migration replay cannot repeat notices',async()=>{
   await db.exec('BEGIN')
   await db.query('DELETE FROM course_exceptions WHERE course_id=$1 AND date=$2',[course,late])
   await db.query("INSERT INTO course_exceptions(course_id,date,reason) VALUES($1,$2,'Neu <Ferien>')",[course,late])
   await db.exec('COMMIT')
   await apply(db,['13_mail_exception_kind.sql']); await apply(db,['14_mail_exceptions.sql'])
   assert.equal((await mails()).length,4)
  })
  await t.test('transactions roll back notices; learners cannot access or fabricate history',async()=>{
   const before=await mails()
   await db.exec('BEGIN')
   await db.query('DELETE FROM private.mail_exception_deliveries WHERE booking_id=$1 AND date=$2',[booking,known])
   await db.query("UPDATE course_exceptions SET reason='Changed' WHERE course_id=$1 AND date=$2",[course,known])
   assert.equal((await mails()).length,5)
   await db.exec('ROLLBACK')
   assert.deepEqual(await mails(),before)
   for(const role of ['anon','authenticated']) {
    await actor(db,outsider,role)
    await assert.rejects(db.query('SELECT * FROM private.mail_exception_deliveries'),e=>e.code==='42501')
    await assert.rejects(db.query('SELECT business_private.booking_mail_exceptions($1)',[booking]),e=>e.code==='42501')
   }
   await actor(db,outsider)
   const failure=await result(db,'SELECT save_course_exception($1,$2,$3) result',[course,late,'Forbidden'])
   assert.equal(failure.error,'not_authorized'); assert.equal(typeof failure.message,'string')
   await db.exec('RESET ROLE')
  })
  await t.test('trial payload has no unrelated dates; new global outage notifies only the booked trial day',async()=>{
   await actor(db,null,'service_role')
   const trial=await result(db,'SELECT submit_business_registration($1,$2,$3,$4,$5,true) result',[JSON.stringify({name:'Trial Student',email:'trial@example.test'}),JSON.stringify([{course_id:unrelated}]),start,JSON.stringify({privacy:true,agb:true}),'tr'])
   assert.equal(typeof trial,'string',JSON.stringify(trial))
   await db.exec('RESET ROLE')
   assert.deepEqual((await mails()).find(x=>x.dedupe_key===`registration:${trial}`).payload.exceptions,[])
   let count=(await mails()).length
   await db.query("INSERT INTO course_exceptions(course_id,date,reason) VALUES(NULL,$1,'Global later')",[await date(2)])
   assert.equal((await mails()).length,count)
   await db.query("INSERT INTO course_exceptions(course_id,date,reason) VALUES(NULL,$1,'Global first day')",[start])
   const notices=(await mails()).filter(x=>x.kind==='course_exception_added'&&x.payload.exceptions[0].date===start)
   assert.equal(notices.length,2)
   assert.ok(notices.some(x=>x.dedupe_key===`course-exception:${trial}:${unrelated}:${start}`))
   await db.query("UPDATE bookings SET status='cancelled' WHERE id=$1",[booking])
   count=(await mails()).length
   await db.query("DELETE FROM private.mail_exception_deliveries WHERE booking_id=$1 AND date=$2",[booking,known])
   await db.query("UPDATE course_exceptions SET reason='Cancelled booking' WHERE course_id=$1 AND date=$2",[course,known])
   assert.equal((await mails()).length,count)
  })
  await t.test('rollback restores original functions and preserves outbox history',async()=>{
   const before=await mails()
   await db.exec('BEGIN;'+await readFile(new URL('../vps/rollback/14_mail_exceptions.sql',import.meta.url),'utf8')+'COMMIT;')
   assert.equal((await db.query("SELECT to_regclass('private.mail_exception_deliveries') value")).rows[0].value,null)
   assert.deepEqual(await mails(),before)
   await apply(db,['14_mail_exceptions.sql'])
  })
 } finally { await db.close() }
})
