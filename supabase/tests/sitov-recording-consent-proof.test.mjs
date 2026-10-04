import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createPhase3Database, actor, student, outsider, id } from './helpers/phase3-db.mjs'

const migration = await readFile(new URL('../vps/84_sitov_online_recording_requirement.sql', import.meta.url), 'utf8')
const fixture = JSON.parse(await readFile(new URL('../fixtures/sitov-recording-notice-2026-10-04-v1.json', import.meta.url), 'utf8'))
const version = 'sitov-recording-2026-10-04-v1'

test('the frozen notice exactly matches the displayed registration, monthly and Teams privacy texts in all five languages', async () => {
 assert.equal(fixture.version, version)
 assert.deepEqual(Object.keys(fixture.translations).sort(), ['de', 'en', 'ru', 'tr', 'uk'])
 for (const locale of Object.keys(fixture.translations)) {
  const dictionary = JSON.parse(await readFile(new URL(`../../dictionaries/${locale}.json`, import.meta.url), 'utf8'))
  const registration = dictionary.registration
  assert.deepEqual(fixture.translations[locale].registration, {
   summary: registration.flow.consents.video_recording,
   notice: registration.flow.consents.recording_notice,
   full: registration.legal.video_recording,
  })
  assert.deepEqual(fixture.translations[locale].monthly, {
   summary: dictionary.profile.recording_consent,
   notice: dictionary.profile.recording_notice,
   withdrawal: dictionary.profile.recording_withdrawal,
  })
  assert.deepEqual(fixture.translations[locale].privacy,
   dictionary.privacy.sections.find(section => section.title === fixture.translations[locale].privacy.title))
 }
})

await test('recording proof is immutable, versioned, private, transactional and bounded for monthly writes', async t => {
 const db = await createPhase3Database()
 const online = id(860), otherOnline = id(861), presence = id(862), privateOnline = id(863), original = id(864)
 const rows = async (sql, args = []) => (await db.query(sql, args)).rows
 let start, person, serial = 0, monthlyId
 const selections = cids => cids.map(cid => ({ course_id: cid, ...(cid === privateOnline ? { requested_units: 2 } : {}) }))
 const operator = async () => {
  await db.exec('RESET ROLE')
  await rows("SELECT set_config('request.jwt.claim.sub','',false)")
 }
 const proofs = async () => { await operator(); return rows('SELECT * FROM business_private.sitov_recording_consents ORDER BY granted_at,id') }
 const state = async () => {
  await operator()
  return (await rows(`SELECT jsonb_build_object(
   'people',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM people p),
   'bookings',(SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM bookings b),
   'items',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM booking_items i),
   'mail',(SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM private.mail_outbox m),
   'proofs',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM business_private.sitov_recording_consents c),
   'usage',(SELECT jsonb_agg(to_jsonb(u) ORDER BY actor_id) FROM business_private.sitov_recording_monthly_usage u),
   'notices',(SELECT jsonb_agg(to_jsonb(n) ORDER BY version) FROM business_private.sitov_recording_notices n)) state`))[0].state
 }
 const submit = async (cids, recording, trial = false, locale = 'de') => {
  await actor(db, null, 'service_role')
  const result = (await rows('SELECT submit_business_registration($1,$2,$3,$4,$5,$6) result', [
   JSON.stringify({ name: 'Proof Registration', email: `proof-${++serial}@example.test` }),
   JSON.stringify(selections(cids)), start, JSON.stringify({ privacy: true, agb: true, recording }), locale, trial,
  ]))[0].result
  await operator()
  return result
 }
 const monthly = async ({ recording = true, revision, paused = false, cids = [online], locale = null } = {}) => {
  await operator()
  const current = (await rows('SELECT id,revision FROM bookings WHERE person_id=$1 AND target_month=$2', [person, start]))[0]
  await actor(db, student)
  const result = (await rows('SELECT sitov_save_business_month($1,$2,$3,$4,$5,$6,$7) result', [
   start, JSON.stringify(paused ? [] : selections(cids)), paused, current?.id ?? null, revision ?? current?.revision ?? null, recording, locale,
  ]))[0].result
  await operator()
  return result
 }
 try {
  for (const name of ['13_mail_exception_kind.sql', '14_mail_exceptions.sql', '53_course_cancellation_billing.sql', '68_sitov_confirmed_registration_monthly_access.sql'])
   await db.exec(await readFile(new URL(`../vps/${name}`, import.meta.url), 'utf8'))
  const dates = (await rows("SELECT date_trunc('month',now() AT TIME ZONE 'Europe/Berlin')::date::text current_month,(date_trunc('month',now() AT TIME ZONE 'Europe/Berlin')+interval '1 month')::date::text next_month"))[0]
  start = dates.next_month
  person = (await rows('SELECT id FROM people WHERE auth_user_id=$1', [student]))[0].id
  const weekday = (await rows('SELECT extract(isodow FROM $1::date)::int weekday', [start]))[0].weekday
  for (const [cid, type, category] of [[online, 'online', 'online'], [otherOnline, 'online', 'speaking'], [presence, 'presence', 'german'], [privateOnline, 'online', 'private']]) {
   await rows('INSERT INTO courses(id,slug,title,type,category,unit_price,unit_minutes,trial_lessons) VALUES($1,$2,$2,$3,$4,10,45,true)', [cid, `proof-course-${cid.slice(-3)}`, type, category])
   if (category !== 'private') await rows("INSERT INTO course_schedules(course_id,weekday,start_time,end_time) VALUES($1,$2,'18:00','19:30')", [cid, weekday])
  }
  await rows(`INSERT INTO bookings(id,person_id,target_month,start_date,kind,status,confirmed_at,contact_name,contact_email,privacy_accepted,agb_accepted,recording_accepted)
   VALUES($1,$2,$3,$3,'registration','confirmed',now(),'Historical','historical-proof@example.test',true,true,true)`, [original, person, dates.current_month])
  await rows('SELECT business_private.replace_items($1,$2)', [original, JSON.stringify(selections([online]))])
  await db.exec('BEGIN;' + migration + 'COMMIT;')

  await t.test('deployment creates one exact frozen notice and no historical proof', async () => {
   assert.deepEqual((await rows('SELECT business_private.sitov_recording_notice_v1() notice'))[0].notice, fixture)
   assert.deepEqual(await rows('SELECT version,payload FROM business_private.sitov_recording_notices'), [{ version, payload: fixture }])
   assert.deepEqual(await proofs(), [])
   assert.deepEqual(await rows('SELECT * FROM business_private.sitov_recording_monthly_usage'), [])
  })

  await t.test('paid and trial proof bind timestamp, source, locale and only selected required course snapshots', async () => {
   const before = Date.now()
   const paid = await submit([online, otherOnline, presence, privateOnline], true, false, 'ru')
   const trial = await submit([online], true, true, 'uk')
   assert.equal(typeof paid, 'string'); assert.equal(typeof trial, 'string')
   const all = await proofs()
   assert.equal(all.length, 2)
   for (const [bid, source, locale] of [[paid, 'registration', 'ru'], [trial, 'trial', 'uk']]) {
    const proof = all.find(row => row.booking_id === bid)
    assert.equal(proof.source, source); assert.equal(proof.locale, locale)
    assert.equal(proof.actor_id, null); assert.equal(proof.notice_version, version)
    assert.ok(proof.granted_at.getTime() >= before && proof.granted_at.getTime() <= Date.now())
    const selected = await rows(`SELECT i.id,i.course_id,i.title_snapshot,c.type,c.category FROM booking_items i JOIN courses c ON c.id=i.course_id
     WHERE i.booking_id=$1 AND c.type='online' AND c.category<>'private' ORDER BY i.course_id,i.id`, [bid])
    assert.deepEqual(proof.course_snapshot, selected.map(row => ({ courseId: row.course_id, bookingItemId: row.id, title: row.title_snapshot, type: row.type, category: row.category })))
   }
   const originalProofs = await proofs()
   await rows("UPDATE courses SET title='Later edited course title' WHERE id=$1", [online])
   assert.deepEqual(await proofs(), originalProofs)
  })

  await t.test('optional courses, rejected groups and rolled-back registration mail create no proof', async () => {
   const before = await proofs()
   for (const [cid, recording] of [[presence, false], [presence, null], [privateOnline, false], [privateOnline, true]])
    assert.equal(typeof await submit([cid], recording), 'string')
   for (const recording of [false, null]) assert.equal((await submit([online], recording))?.error, 'invalid_input')
   assert.deepEqual(await proofs(), before)
   const beforeFailedMail = await state()
   await db.exec(`CREATE FUNCTION private.sitov_test_reject_proof_mail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE check_violation; END $$;
    CREATE TRIGGER sitov_test_reject_proof_mail BEFORE INSERT ON private.mail_outbox FOR EACH ROW EXECUTE FUNCTION private.sitov_test_reject_proof_mail()`)
   assert.equal((await submit([online], true))?.error, 'invalid_input')
   assert.deepEqual(await state(), beforeFailedMail, 'A mail failure rolls back the new person, booking, items and proof')
   await db.exec('DROP TRIGGER sitov_test_reject_proof_mail ON private.mail_outbox;DROP FUNCTION private.sitov_test_reject_proof_mail()')
  })

  await t.test('fresh monthly approvals append proof; pause and private changes preserve previous attestations', async () => {
   await rows("UPDATE profiles SET ui_language='tr' WHERE id=$1", [student])
   monthlyId = await monthly()
   assert.equal(typeof monthlyId, 'string')
   const first = (await proofs()).filter(row => row.booking_id === monthlyId)
   assert.equal(first.length, 1); assert.equal(first[0].actor_id, student)
   assert.equal(first[0].source, 'monthly'); assert.equal(first[0].locale, 'tr')
   await rows("UPDATE profiles SET ui_language='ru' WHERE id=$1", [student])
   assert.equal(await monthly({ locale: 'en' }), monthlyId)
   const second = (await proofs()).filter(row => row.booking_id === monthlyId)
   assert.equal(second.length, 2); assert.deepEqual(second[0], first[0])
   assert.equal(second[1].locale, 'en', 'The actual displayed English route wins over the Russian profile preference')
   assert.notEqual(second[0].id, second[1].id)
   assert.ok(second[1].granted_at >= second[0].granted_at)
   await monthly({ paused: true, recording: null })
   await monthly({ cids: [privateOnline], recording: false })
   assert.deepEqual((await proofs()).filter(row => row.booking_id === monthlyId), second)
   assert.equal((await rows('SELECT day_writes FROM business_private.sitov_recording_monthly_usage WHERE actor_id=$1', [student]))[0].day_writes, 2)
   const beforeInvalidLocale = await state()
   assert.equal((await monthly({ locale: 'fr' }))?.error, 'invalid_input')
   assert.deepEqual(await state(), beforeInvalidLocale, 'Unsupported locale cannot create proof or consume counters')
  })

  await t.test('anonymous, authenticated and service clients cannot read/write proofs, notices or counters', async () => {
   for (const role of ['anon', 'authenticated', 'service_role']) {
    for (const name of ['sitov_recording_consents', 'sitov_recording_notices', 'sitov_recording_monthly_usage']) {
     for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
      assert.equal((await rows('SELECT has_table_privilege($1,$2,$3) allowed', [role, `business_private.${name}`, privilege]))[0].allowed, false)
    }
   }
   for (const [uid, role] of [[null, 'anon'], [student, 'authenticated'], [outsider, 'authenticated'], [null, 'service_role']]) {
    await actor(db, uid, role)
    for (const name of ['sitov_recording_consents', 'sitov_recording_notices', 'sitov_recording_monthly_usage'])
     await assert.rejects(rows(`SELECT * FROM business_private.${name}`), e => e.code === '42501')
    if (role !== 'service_role') {
     for (const bid of [original, monthlyId, id(999)])
      await assert.rejects(rows('SELECT business_private.sitov_record_recording_consent($1,\'de\',\'monthly\')', [bid]), e => e.code === '42501')
    }
    await assert.rejects(rows('SELECT business_private.sitov_recording_notice_v1()'), e => e.code === '42501')
   }
   await operator()
   assert.ok((await rows("SELECT relrowsecurity FROM pg_class WHERE oid IN('business_private.sitov_recording_consents'::regclass,'business_private.sitov_recording_notices'::regclass,'business_private.sitov_recording_monthly_usage'::regclass)")).every(row => row.relrowsecurity))
  })

  await t.test('the trusted helper still checks actor ownership and does not disclose another identity', async () => {
   const before = await state()
   await rows("SELECT set_config('request.jwt.claim.sub',$1,false)", [outsider])
   await assert.rejects(rows('SELECT business_private.sitov_record_recording_consent($1,\'de\',\'monthly\')', [monthlyId]), e => e.code === '42501' && e.message === 'not_authorized')
   await operator()
   await assert.rejects(rows('SELECT business_private.sitov_record_recording_consent($1,\'de\',\'monthly\')', [monthlyId]), e => e.code === '42501' && e.message === 'not_authorized')
   await assert.rejects(rows('SELECT business_private.sitov_record_recording_consent($1,\'de\',\'registration\')', [id(999)]), e => e.code === '23514' && e.message === 'invalid_input')
   assert.deepEqual(await state(), before)
  })

  await t.test('ten committed group writes per rolling ten minutes; eleventh and invalid revisions consume nothing', async () => {
   await rows("UPDATE business_private.sitov_recording_monthly_usage SET day_writes=0,recent_writes='{}' WHERE actor_id=$1", [student])
   for (let n = 0; n < 10; n++) assert.equal(await monthly(), monthlyId)
   const before = await state()
   const limited = await monthly()
   assert.equal(limited?.sqlstate, 'PT429')
   assert.deepEqual(await state(), before)
   assert.equal((await monthly({ revision: 0 }))?.error, 'conflict')
   assert.equal((await monthly({ recording: false }))?.error, 'invalid_input')
   assert.deepEqual(await state(), before)
   const usage = (await rows('SELECT day_writes,cardinality(recent_writes) recent FROM business_private.sitov_recording_monthly_usage WHERE actor_id=$1', [student]))[0]
   assert.deepEqual(usage, { day_writes: 10, recent: 10 })
  })

  await t.test('forty committed group writes per UTC day; day rollover resets only the bounded daily counter', async () => {
   await rows("UPDATE business_private.sitov_recording_monthly_usage SET day=(clock_timestamp() AT TIME ZONE 'UTC')::date,day_writes=39,recent_writes='{}' WHERE actor_id=$1", [student])
   assert.equal(await monthly(), monthlyId)
   const before = await state()
   assert.equal((await monthly())?.sqlstate, 'PT429')
   assert.deepEqual(await state(), before)
   await rows("UPDATE business_private.sitov_recording_monthly_usage SET day=(clock_timestamp() AT TIME ZONE 'UTC')::date-1,recent_writes='{}' WHERE actor_id=$1", [student])
   assert.equal(await monthly(), monthlyId)
   assert.deepEqual((await rows('SELECT day_writes,cardinality(recent_writes) recent FROM business_private.sitov_recording_monthly_usage WHERE actor_id=$1', [student]))[0], { day_writes: 1, recent: 1 })
   assert.equal((await rows('SELECT count(*)::int n FROM business_private.sitov_recording_monthly_usage WHERE actor_id=$1', [student]))[0].n, 1)
  })

  await t.test('transaction rollback and migration replay neither consume approval slots nor rewrite proof', async () => {
   const before = await state()
   const b = (await rows('SELECT revision FROM bookings WHERE id=$1', [monthlyId]))[0]
   await actor(db, student)
   await db.exec('BEGIN')
   assert.equal((await rows('SELECT sitov_save_business_month($1,$2,false,$3,$4,true) result', [start, JSON.stringify(selections([online])), monthlyId, b.revision]))[0].result, monthlyId)
   await db.exec('ROLLBACK')
   assert.deepEqual(await state(), before)
   await db.exec('BEGIN;' + migration + 'COMMIT;')
   assert.deepEqual(await state(), before)
  })

  await t.test('a mismatched frozen notice under the same version aborts instead of silently overwriting it', async () => {
   await rows("UPDATE business_private.sitov_recording_notices SET payload=jsonb_set(payload,'{translations,de,registration,summary}','\"Unexpected changed text\"') WHERE version=$1", [version])
   const changed = await state()
   await assert.rejects(db.exec('BEGIN;' + migration + 'COMMIT;'), e => /different immutable text/.test(e.message))
   await db.exec('ROLLBACK')
   assert.deepEqual(await state(), changed)
   await rows('UPDATE business_private.sitov_recording_notices SET payload=$2 WHERE version=$1', [version, JSON.stringify(fixture)])
  })

  await t.test('account deletion clears the actor reference without losing proof; booking deletion cascades its proofs', async () => {
   const before = (await proofs()).filter(row => row.booking_id === monthlyId)
   await rows('DELETE FROM auth.users WHERE id=$1', [student])
   const after = (await proofs()).filter(row => row.booking_id === monthlyId)
   assert.deepEqual(after, before.map(row => ({ ...row, actor_id: null })))
   assert.deepEqual(await rows('SELECT * FROM business_private.sitov_recording_monthly_usage WHERE actor_id=$1', [student]), [])
   await rows('DELETE FROM bookings WHERE id=$1', [monthlyId])
   assert.deepEqual((await proofs()).filter(row => row.booking_id === monthlyId), [])
   assert.equal((await rows('SELECT count(*)::int n FROM business_private.sitov_recording_notices'))[0].n, 1)
  })
 } finally { await db.close() }
})
