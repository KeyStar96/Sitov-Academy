import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPhase3Database, id, apply } from './helpers/phase3-db.mjs'
import { renderTransactionalEmail, MAIL_LOCALES } from '../../lib/mail/templates.mjs'

await test('new platform accounts notify info@ exactly once without blocking signup', async t => {
 const db = await createPhase3Database()
 const mails=async()=> (await db.query("SELECT dedupe_key,kind::text,recipient,locale,payload FROM private.mail_outbox WHERE kind::text='new_signup' ORDER BY created_at,id")).rows
 const signup=(uid,email,meta={})=>db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[uid,email,JSON.stringify(meta)])
 try {
  // Production auth.users has created_at; the frozen fixture does not. Existing test accounts are old.
  await db.exec("ALTER TABLE auth.users ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(); UPDATE auth.users SET created_at=now()-interval '30 days'")
  const missed=id(901), old=id(902)
  await signup(missed,'Missed@Example.test',{display_name:'Olena Missed',native_language:'Ukrainisch'})
  await signup(old,'old@example.test',{display_name:'Old Account'})
  await db.query("UPDATE auth.users SET created_at=now()-interval '10 days' WHERE id=$1",[old])
  // Separate commits are required by PostgreSQL when adding an enum label.
  await apply(db,['26_mail_signup_kind.sql'])
  await apply(db,['27_staff_signup_notification.sql'])

  await t.test('backfill queues only accounts from the last three days',async()=>{
   const jobs=await mails()
   assert.deepEqual(jobs.map(x=>x.dedupe_key),[`staff-signup:${missed}`])
   assert.equal(jobs[0].recipient,'info@sitov-academy.com')
  })
  await t.test('a new signup queues one German staff notice with name, address and language',async()=>{
   const fresh=id(903)
   await signup(fresh,'anna@example.test',{display_name:'  Anna <Müller> ',native_language:'Russisch'})
   const job=(await mails()).find(x=>x.dedupe_key===`staff-signup:${fresh}`)
   assert.ok(job)
   assert.deepEqual([job.kind,job.recipient,job.locale],['new_signup','info@sitov-academy.com','de'])
   assert.equal(job.payload.path,'/de/admin/students')
   assert.equal(job.payload.message,'Name: Anna <Müller>\nE-Mail: anna@example.test\nMuttersprache: Russisch')
   const mail=renderTransactionalEmail(job.kind,job.locale,job.payload,'https://217.154.228.254')
   assert.match(mail.subject,/Eine neue Person hat sich registriert/)
   assert.match(mail.text,/Lernende ansehen: https:\/\/217\.154\.228\.254\/de\/admin\/students/)
   assert.match(mail.html,/Anna &lt;Müller&gt;/)
   assert.doesNotMatch(mail.html,/<Müller>/)
   for(const lang of MAIL_LOCALES) assert.match(renderTransactionalEmail(job.kind,lang,job.payload,'https://217.154.228.254').text,/admin\/students/)
  })
  await t.test('missing metadata falls back to the address local part',async()=>{
   const bare=id(904)
   await signup(bare,'bare.user@example.test')
   assert.equal((await mails()).find(x=>x.dedupe_key===`staff-signup:${bare}`).payload.message,'Name: bare.user\nE-Mail: bare.user@example.test')
  })
  await t.test('an unavailable outbox never blocks the new account',async()=>{
   const before=(await mails()).length, blocked=id(905)
   await db.exec('ALTER TABLE private.mail_outbox RENAME TO mail_outbox_off')
   try { await signup(blocked,'blocked@example.test') }
   finally { await db.exec('ALTER TABLE private.mail_outbox_off RENAME TO mail_outbox') }
   assert.equal((await db.query('SELECT count(*)::int n FROM auth.users WHERE id=$1',[blocked])).rows[0].n,1)
   assert.equal((await mails()).length,before)
  })
  await t.test('reapplying the migration recovers failed notices without duplicates',async()=>{
   const before=await mails()
   await apply(db,['27_staff_signup_notification.sql'])
   const after=(await mails()).map(x=>x.dedupe_key)
   assert.deepEqual(after,[...before.map(x=>x.dedupe_key),`staff-signup:${id(905)}`])
   assert.equal(new Set(after).size,after.length)
  })
 } finally { await db.close() }
})
