import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'
const schema = await readFile(new URL('../vps/mail.sql',import.meta.url),'utf8')
const worker1='00000000-0000-4000-8000-000000000001', worker2='00000000-0000-4000-8000-000000000002'

test('transactional mail queue ownership, idempotency and retries', async t => {
  const db=new PGlite()
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;')
    await db.exec(schema)
    const enqueue=async key => (await db.query("SELECT public.queue_transactional_email($1,'registration_received','student@example.test','de','{}') id",[key])).rows[0].id
    const claim=async worker => (await db.query('SELECT * FROM public.claim_mail_jobs($1,5)',[worker])).rows
    await t.test('booking rollback also rolls back mail',async()=>{
      await db.exec('BEGIN'); await enqueue('rolled-back'); await db.exec('ROLLBACK')
      assert.equal((await db.query('SELECT count(*)::int n FROM private.mail_outbox')).rows[0].n,0)
    })
    await t.test('anonymous and students cannot send or read private mail',async()=>{
      for(const role of ['anon','authenticated']) {
        await db.exec(`SET ROLE ${role}`)
        await assert.rejects(enqueue('forbidden'),e=>e.code==='42501')
        await assert.rejects(db.query('SELECT * FROM private.mail_outbox'),e=>e.code==='42501')
        await assert.rejects(claim(worker1),e=>e.code==='42501')
        await db.exec('RESET ROLE')
      }
    })
    await db.exec('SET ROLE service_role')
    const id=await enqueue('registration:1:received')
    await t.test('duplicate business event retains exactly one immutable job',async()=>{
      assert.equal(await enqueue('registration:1:received'),id)
      await db.query("SELECT public.queue_transactional_email($1,'registration_confirmed','other@example.test','en','{}')",['registration:1:received'])
      const jobs=(await db.query('SELECT * FROM private.mail_outbox')).rows
      assert.equal(jobs.length,1); assert.equal(jobs[0].recipient,'student@example.test'); assert.equal(jobs[0].kind,'registration_received')
    })
    const [first]=await claim(worker1)
    await t.test('leased job cannot be claimed or acknowledged by another worker',async()=>{
      assert.equal((await claim(worker2)).length,0)
      assert.equal((await db.query('SELECT public.complete_mail_job($1,$2,$3) ok',[id,worker2,'invalid'])).rows[0].ok,false)
      assert.equal(first.attempts,1)
    })
    await t.test('temporary delivery failure schedules retry and invalidates old lease',async()=>{
      assert.equal((await db.query("SELECT public.fail_mail_job($1,$2,'ETIMEDOUT',false) ok",[id,first.lease_token])).rows[0].ok,true)
      assert.equal((await claim(worker2)).length,0)
      const row=(await db.query('SELECT status,available_at>now() future,lease_token FROM private.mail_outbox')).rows[0]
      assert.deepEqual(row,{status:'pending',future:true,lease_token:null})
      await db.query("UPDATE private.mail_outbox SET available_at=now()-interval '1 second' WHERE id=$1",[id])
      const [retry]=await claim(worker2)
      assert.equal(retry.attempts,2); assert.notEqual(retry.lease_token,first.lease_token)
      assert.equal((await db.query("SELECT public.complete_mail_job($1,$2,'old') ok",[id,first.lease_token])).rows[0].ok,false)
      assert.equal((await db.query("SELECT public.complete_mail_job($1,$2,'delivered') ok",[id,retry.lease_token])).rows[0].ok,true)
      assert.equal((await claim(worker1)).length,0)
    })
    await t.test('crashed worker lease is reclaimed; attempt limit quarantines mail',async()=>{
      const secondId=await enqueue('registration:2:received')
      const [job]=await claim(worker1)
      await db.query("UPDATE private.mail_outbox SET lease_until=now()-interval '1 second' WHERE id=$1",[secondId])
      const [reclaimed]=await claim(worker2)
      assert.equal(reclaimed.id,job.id); assert.notEqual(reclaimed.lease_token,job.lease_token)
      await db.query("UPDATE private.mail_outbox SET attempts=8,lease_until=now()-interval '1 second' WHERE id=$1",[secondId])
      assert.equal((await claim(worker1)).length,0)
      assert.equal((await db.query('SELECT status FROM private.mail_outbox WHERE id=$1',[secondId])).rows[0].status,'failed')
    })
    await t.test('permanent SMTP failures are not retried',async()=>{
      await enqueue('registration:3:received'); const [job]=await claim(worker1)
      await db.query("SELECT public.fail_mail_job($1,$2,'ERECIPIENT_550',true)",[job.id,job.lease_token])
      assert.equal((await claim(worker2)).length,0)
      assert.equal((await db.query('SELECT status FROM private.mail_outbox WHERE id=$1',[job.id])).rows[0].status,'failed')
    })
  } finally { await db.close() }
})
