import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createPhase3Database, actor, student, outsider, id } from './helpers/phase3-db.mjs'

const migration = await readFile(new URL('../migrations/20261003184422_sitov_confirmed_registration_monthly_access.sql', import.meta.url), 'utf8')
const sitovVpsMigration = await readFile(new URL('../vps/68_sitov_confirmed_registration_monthly_access.sql', import.meta.url), 'utf8')
await test('monthly writes require the verified owner’s confirmed original registration', async t => {
  const db = await createPhase3Database()
  const rows = async (sql, values = []) => (await db.query(sql, values)).rows
  try {
    const month = (await rows("SELECT (date_trunc('month',now() AT TIME ZONE 'Europe/Berlin')+interval '1 month')::date::text AS value"))[0].value
    const person = (await rows('SELECT id FROM people WHERE auth_user_id=$1', [student]))[0].id
    await rows("INSERT INTO courses(id,slug,title,type,category,unit_price,unit_minutes) VALUES($1,'access-private','Private','online','private',25,45)", [id(500)])
    const selection = JSON.stringify([{ course_id: id(500), requested_units: 2 }])
    const save = async user => {
      await actor(db, user)
      return (await rows('SELECT save_business_month($1,$2,false,NULL,NULL) result', [month, selection]))[0].result
    }
    const before = await rows('SELECT id,auth_user_id,email FROM people ORDER BY id')
    assert.equal(sitovVpsMigration, migration)
    await db.exec(`BEGIN;\n${sitovVpsMigration}\nCOMMIT;`); await db.exec(migration)
    await t.test('students cannot forge or rewrite school confirmation evidence through table writes', async () => {
      const privileges = (await rows("SELECT has_table_privilege('authenticated','public.bookings','UPDATE') AS table_update,has_column_privilege('authenticated','public.bookings','confirmed_at','UPDATE') AS confirmation_update"))[0]
      assert.deepEqual(privileges, { table_update: false, confirmation_update: false })
      await actor(db, student)
      await assert.rejects(rows('UPDATE bookings SET confirmed_at=now() WHERE person_id=$1', [person]), error => error.code === '42501')
      await db.exec('RESET ROLE')
    })
    await t.test('account only and trial/pending/monthly rows do not grant access', async () => {
      assert.equal((await save(student)).error, 'not_authorized')
      await db.exec('RESET ROLE')
      await rows(`INSERT INTO bookings(id,person_id,target_month,start_date,kind,status,contact_name,contact_email,privacy_accepted,agb_accepted)
        VALUES($1,$2,'2020-01-01','2020-01-01','trial','confirmed','Test','test@example.test',true,true)`, [id(501), person])
      assert.equal((await save(student)).error, 'not_authorized')
      await db.exec('RESET ROLE')
      await rows("UPDATE bookings SET kind='monthly' WHERE id=$1", [id(501)])
      assert.equal((await save(student)).error, 'not_authorized')
      await db.exec('RESET ROLE')
      await rows("UPDATE bookings SET kind='registration',status='pending' WHERE id=$1", [id(501)])
      assert.equal((await save(student)).error, 'not_authorized')
    })
    await t.test('confirmed original registration unlocks only its verified owner and retains source records', async () => {
      await db.exec('RESET ROLE')
      await rows("UPDATE bookings SET status='confirmed' WHERE id=$1", [id(501)])
      assert.equal((await save(outsider)).error, 'not_authorized')
      const result = await save(student)
      assert.match(result, /^[a-f0-9-]{36}$/)
      await db.exec('RESET ROLE')
      assert.deepEqual(await rows('SELECT id,auth_user_id,email FROM people ORDER BY id'), before)
      const booking = (await rows('SELECT kind,status FROM bookings WHERE id=$1', [result]))[0]
      assert.deepEqual(booking, { kind: 'monthly', status: 'pending' })
      assert.equal(Number((await rows('SELECT amount FROM booking_items WHERE booking_id=$1', [result]))[0].amount), 50)
      assert.equal((await rows('SELECT id FROM bookings WHERE id=$1', [id(501)]))[0].id, id(501))
    })
    await t.test('a free pause remains available to an eligible participant', async () => {
      await actor(db, student)
      const current = (await rows('SELECT id,revision FROM bookings WHERE person_id=$1 AND target_month=$2', [person, month]))[0]
      const paused = (await rows('SELECT save_business_month($1,$2,true,$3,$4) result', [month, '[]', current.id, current.revision]))[0].result
      assert.equal(paused, current.id)
      await db.exec('RESET ROLE')
      assert.equal((await rows('SELECT status FROM bookings WHERE id=$1', [paused]))[0].status, 'cancelled')
      assert.equal((await rows('SELECT * FROM booking_items WHERE booking_id=$1', [paused])).length, 0)
    })
    await t.test('school confirmation evidence survives changing and pausing the same initial next-month booking', async () => {
      await db.exec('RESET ROLE')
      const owner = (await rows('SELECT id FROM people WHERE auth_user_id=$1', [outsider]))[0].id
      const first = id(502)
      await rows(`INSERT INTO bookings(id,person_id,target_month,start_date,kind,status,confirmed_at,contact_name,contact_email,privacy_accepted,agb_accepted)
        VALUES($1,$2,$3,$3,'registration','confirmed',now(),'Test','test@example.test',true,true)`, [first, owner, month])
      await actor(db, outsider)
      assert.equal((await rows('SELECT save_business_month($1,$2,false,$3,1) result', [month, selection, first]))[0].result, first)
      const edited = (await rows('SELECT status,confirmed_at,revision FROM bookings WHERE id=$1', [first]))[0]
      assert.equal(edited.status, 'pending')
      assert.ok(edited.confirmed_at)
      assert.equal((await rows('SELECT save_business_month($1,$2,true,$3,$4) result', [month, '[]', first, edited.revision]))[0].result, first)
    })
    await t.test('an ambiguous unclaimed family identity is blocked even with an owned confirmed registration', async () => {
      await db.exec('RESET ROLE')
      await rows("INSERT INTO people(display_name,email) VALUES('Same family email',$1)", [`${student}@example.test`])
      assert.equal((await save(student)).error, 'not_authorized')
    })
  } finally { await db.close() }
})
