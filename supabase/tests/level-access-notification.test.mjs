import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPhase3Database, actor, id, apply, student, teacher, outsider } from './helpers/phase3-db.mjs'
import { renderTransactionalEmail, MAIL_LOCALES } from '../../lib/mail/templates.mjs'

await test('granting a level notifies the learner exactly once without blocking the grant', async t => {
 const db = await createPhase3Database()
 const mails=async()=> (await db.query("SELECT dedupe_key,kind::text,recipient,locale,payload FROM private.mail_outbox WHERE kind::text='level_access_granted' ORDER BY created_at,id")).rows
 const grant=async(uid,levels)=>{ await actor(db,teacher); try { return (await db.query('SELECT set_student_level_access($1,$2::text[]) result',[uid,levels])).rows[0].result } finally { await db.exec('RESET ROLE') } }
 try {
  await db.exec("INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('A1.2','A1',2)")
  // Separate commits are required by PostgreSQL when adding an enum label.
  await apply(db,['28_mail_level_access_kind.sql'])
  await apply(db,['29_student_level_access_notification.sql'])

  await t.test('existing grants are not backfilled',async()=>{
   assert.deepEqual(await mails(),[])
  })
  await t.test('a new level queues one mail in the learner language with a link to the level',async()=>{
   assert.equal(await grant(student,['A1.1','A1.2']),null)
   const jobs=await mails()
   assert.deepEqual(jobs.map(x=>x.dedupe_key),[`level-access:${student}:A1.2`])
   const [job]=jobs
   assert.deepEqual([job.recipient,job.locale],[`${student}@example.test`,'ru'])
   assert.deepEqual(job.payload,{name:'student',level:'A1.2',path:'/ru/dashboard/level/A1.2'})
   const mail=renderTransactionalEmail(job.kind,job.locale,job.payload,'https://217.154.228.254')
   assert.match(mail.subject,/Открыт новый уровень обучения/)
   assert.match(mail.text,/уровень A1\.2/)
   assert.match(mail.text,/https:\/\/217\.154\.228\.254\/ru\/dashboard\/level\/A1\.2/)
   const de=renderTransactionalEmail(job.kind,'de',job.payload,'https://217.154.228.254')
   assert.match(de.subject,/Neues Lernniveau freigeschaltet/)
   assert.match(de.text,/Hallo student,[\s\S]*das Niveau A1\.2 auf der Lernplattform freigeschaltet/)
   for(const lang of MAIL_LOCALES) assert.doesNotMatch(renderTransactionalEmail(job.kind,lang,job.payload,'https://217.154.228.254').text,/\{level\}/)
  })
  await t.test('revoking and granting the same level again sends no second mail',async()=>{
   await grant(student,['A1.1'])
   await grant(student,['A1.1','A1.2'])
   assert.equal((await mails()).length,1)
  })
  await t.test('several newly granted levels each produce one mail',async()=>{
   await grant(outsider,['A1.1','A1.2'])
   assert.deepEqual((await mails()).filter(x=>x.recipient===`${outsider}@example.test`).map(x=>x.payload.level).sort(),['A1.1','A1.2'])
  })
  await t.test('without a person record the auth address is used',async()=>{
   const bare=id(950)
   await db.query("INSERT INTO auth.users(id,email) VALUES($1,'bare@example.test')",[bare])
   await db.query("INSERT INTO profiles(id,role) VALUES($1,'student')",[bare])
   await grant(bare,['A1.1'])
   const job=(await mails()).find(x=>x.dedupe_key===`level-access:${bare}:A1.1`)
   assert.ok(job)
   assert.deepEqual([job.recipient,job.locale],['bare@example.test','de'])
   assert.equal(job.payload.name,'')
  })
  await t.test('an unavailable outbox never blocks the grant',async()=>{
   const before=(await mails()).length
   await db.exec('ALTER TABLE private.mail_outbox RENAME TO mail_outbox_off')
   try { assert.equal(await grant(teacher,['A1.1']),null) }
   finally { await db.exec('ALTER TABLE private.mail_outbox_off RENAME TO mail_outbox') }
   assert.equal((await db.query("SELECT count(*)::int n FROM student_level_access WHERE auth_user_id=$1",[teacher])).rows[0].n,1)
   assert.equal((await mails()).length,before)
  })
 } finally { await db.close() }
})
