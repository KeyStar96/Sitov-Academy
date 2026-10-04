import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createPhase3Database, actor, student, teacher, outsider, id } from './helpers/phase3-db.mjs'

const migration = await readFile(new URL('../vps/84_sitov_online_recording_requirement.sql', import.meta.url), 'utf8')
const canonical = await readFile(new URL('../migrations/20261004194822_sitov_online_recording_requirement.sql', import.meta.url), 'utf8')
const optionalDescription = 'Unterrichtsaufzeichnungen zur Wiederholung sind nur mit freiwilliger Einwilligung aller erfassten Personen möglich. Die Anmeldung ist auch ohne Aufnahmeeinwilligung möglich.'
const requiredDescription = 'Reguläre Online-Gruppenkurse und Online-Probestunden werden in Microsoft Teams immer aufgezeichnet, damit die Schüler sie später ansehen können. Die Einwilligung ist Voraussetzung für diese Buchung. Online-Privatunterricht ist davon ausgenommen.'

await test('new online group registrations and trials require explicit boolean recording consent', async t => {
 const db = await createPhase3Database()
 const online = id(840), onlineSpeaking = id(841), onlineCategory = id(842)
 const privateOnline = id(843), presence = id(844), presenceOnlineCategory = id(845), otherDescription = id(846)
 const historical = id(847), secondDescription = id(848)
 const rows = async (sql, params = []) => (await db.query(sql, params)).rows
 const snapshot = async () => {
  await db.exec('RESET ROLE')
  const state = (await rows(`SELECT jsonb_build_object(
   'people',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY id),'[]') FROM people p),
   'bookings',(SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY id),'[]') FROM bookings b),
   'items',(SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY id),'[]') FROM booking_items i),
   'mail',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY id),'[]') FROM private.mail_outbox m),
   'exceptions',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY booking_id,course_id,date),'[]') FROM private.mail_exception_deliveries e)
   ) state`))[0].state
  const hasProof = (await rows("SELECT to_regclass('business_private.sitov_recording_consents') present"))[0].present
  state.proofs = hasProof ? await rows('SELECT * FROM business_private.sitov_recording_consents ORDER BY id') : []
  state.usage = hasProof ? await rows('SELECT * FROM business_private.sitov_recording_monthly_usage ORDER BY actor_id') : []
  return state
 }
 let serial = 0
 let start
 const submit = async (cid, consents, trial = false, selections) => {
  await actor(db, null, 'service_role')
  const request = selections ?? [{ course_id: cid, ...(cid === privateOnline ? { requested_units: 2 } : {}) }]
  return (await rows('SELECT submit_business_registration($1,$2,$3,$4,$5,$6) result', [
   JSON.stringify({ name: 'Consent Test', email: `consent-${++serial}@example.test` }),
   JSON.stringify(request), start, JSON.stringify(consents), 'de', trial,
  ]))[0].result
 }
 const rejected = async (cid, consents, trial = false, selections) => {
  const before = await snapshot()
  const result = await submit(cid, consents, trial, selections)
  assert.equal(result?.error, 'invalid_input')
  assert.equal(result?.sqlstate, '23514')
  assert.deepEqual(await snapshot(), before, 'Rejected input cannot create/update a person, booking, items or mail')
 }
 const accepted = async (cid, recording, trial = false) => {
  const result = await submit(cid, { privacy: true, agb: true, ...(recording === undefined ? {} : { recording }) }, trial)
  assert.equal(typeof result, 'string', JSON.stringify(result))
  assert.match(result, /^[a-f0-9-]{36}$/)
  await db.exec('RESET ROLE')
  const booking = (await rows('SELECT kind,recording_accepted FROM bookings WHERE id=$1', [result]))[0]
  assert.deepEqual(booking, { kind: trial ? 'trial' : 'registration', recording_accepted: recording ?? null })
  assert.equal((await rows('SELECT count(*)::int n FROM booking_items WHERE booking_id=$1', [result]))[0].n, 1)
  assert.equal((await rows("SELECT count(*)::int n FROM private.mail_outbox WHERE dedupe_key IN('registration:'||$1,'staff-registration:'||$1)", [result]))[0].n, 2)
 }
 try {
  await db.exec(await readFile(new URL('../vps/13_mail_exception_kind.sql', import.meta.url), 'utf8'))
  await db.exec(await readFile(new URL('../vps/14_mail_exceptions.sql', import.meta.url), 'utf8'))
  await db.exec(await readFile(new URL('../vps/68_sitov_confirmed_registration_monthly_access.sql', import.meta.url), 'utf8'))
  start = (await rows("SELECT (date_trunc('month',now() AT TIME ZONE 'Europe/Berlin')+interval '1 month')::date::text AS day"))[0].day
  const weekday = (await rows('SELECT extract(isodow FROM $1::date)::int weekday', [start]))[0].weekday
  for (const [cid, slug, type, category, description] of [
   [online, 'deutsch-b1-online', 'online', 'german', `B1 original prefix. ${optionalDescription} Original suffix.`],
   [onlineSpeaking, 'consent-speaking', 'online', 'speaking', 'Speaking original.'],
   [onlineCategory, 'consent-online', 'online', 'online', 'Online original.'],
   [privateOnline, 'consent-private', 'online', 'private', 'Private original.'],
   [presence, 'consent-presence', 'presence', 'german', 'Presence original.'],
   [presenceOnlineCategory, 'consent-presence-online-category', 'presence', 'online', 'Presence category original.'],
   [otherDescription, 'unrelated-description', 'online', 'german', optionalDescription],
   [secondDescription, 'deutsch-a1-1-online', 'online', 'online', `A1 original prefix. ${optionalDescription}`],
  ]) {
   await rows('INSERT INTO courses(id,slug,title,type,category,description,unit_price,unit_minutes,trial_lessons) VALUES($1,$2,$2,$3,$4,$5,10,45,true)', [cid, slug, type, category, description])
   if (category !== 'private') await rows("INSERT INTO course_schedules(course_id,weekday,start_time,end_time) VALUES($1,$2,'18:00','19:30')", [cid, weekday])
  }
  const person = (await rows('SELECT id FROM people WHERE auth_user_id=$1', [student]))[0].id
  await rows(`INSERT INTO bookings(id,person_id,target_month,start_date,contact_name,contact_email,privacy_accepted,agb_accepted,recording_accepted)
   VALUES($1,$2,$3,$3,'Historical choice','historical@example.test',true,true,false)`, [historical, person, start])
  await rows("INSERT INTO booking_items(booking_id,course_id,title_snapshot,unit_price,unit_minutes,units,amount) VALUES($1,$2,'Historical snapshot',10,45,2,20)", [historical, online])
  const historyBefore = await snapshot()
  const grantsBefore = (await rows("SELECT proacl::text acl,prosecdef,proargnames,proargdefaults::text defaults FROM pg_proc WHERE oid='public.submit_business_registration(jsonb,jsonb,date,jsonb,text,boolean)'::regprocedure"))[0]
  const coursesBefore = await rows('SELECT * FROM courses ORDER BY id')
  await db.exec('BEGIN;' + migration + 'COMMIT;')

  await t.test('deployment/replay preserve all historical data, RPC ACL/defaults and unrelated course content', async () => {
   assert.equal(migration, canonical)
   const afterFirstApply = await rows('SELECT * FROM courses ORDER BY id')
   await db.exec('BEGIN;' + migration + 'COMMIT;')
   assert.deepEqual(await snapshot(), historyBefore)
   assert.deepEqual((await rows("SELECT proacl::text acl,prosecdef,proargnames,proargdefaults::text defaults FROM pg_proc WHERE oid='public.submit_business_registration(jsonb,jsonb,date,jsonb,text,boolean)'::regprocedure"))[0], grantsBefore)
   const coursesAfter = await rows('SELECT * FROM courses ORDER BY id')
   assert.deepEqual(coursesAfter, afterFirstApply, 'Replay cannot reapply descriptions or bump course timestamps')
   assert.deepEqual(coursesAfter, coursesBefore.map(c => [online, secondDescription].includes(c.id)
    ? { ...c, description: c.description.replace(optionalDescription, requiredDescription), updated_at: coursesAfter.find(row => row.id === c.id).updated_at } : c))
  })

  await t.test('paid and trial online groups reject false, null and absent consent with no effects', async () => {
   for (const trial of [false, true]) for (const recording of [false, null, undefined])
    await rejected(online, { privacy: true, agb: true, ...(recording === undefined ? {} : { recording }) }, trial)
   for (const cid of [onlineSpeaking, onlineCategory]) await rejected(cid, { privacy: true, agb: true, recording: false })
  })

  await t.test('paid and trial online groups accept true and persist it', async () => {
   for (const trial of [false, true]) await accepted(online, true, trial)
   for (const cid of [onlineSpeaking, onlineCategory]) await accepted(cid, true)
  })

  await t.test('presence courses and online private registrations keep false/null/absent valid', async () => {
   for (const cid of [presence, presenceOnlineCategory, privateOnline]) for (const recording of [false, null, undefined])
    await accepted(cid, recording)
   for (const recording of [false, null, undefined]) await accepted(presence, recording, true)
   // This change does not add private trials to the existing group-trial product.
   await rejected(privateOnline, { privacy: true, agb: true, recording: true }, true)
  })

  await t.test('malformed consent fails closed, including coercible values and spoofed classifications', async () => {
   for (const recording of ['true', 'yes', 1, [], {}, 'false']) {
    await rejected(online, { privacy: true, agb: true, recording })
    await rejected(privateOnline, { privacy: true, agb: true, recording })
   }
   for (const consents of [null, [], true, 'true', { privacy: 'true', agb: true, recording: true }, { privacy: true, agb: 'yes', recording: true }, { privacy: true, agb: true, recording: true, revocation: 'yes' }])
    await rejected(online, consents)
   await rejected(online, { privacy: true, agb: true, recording: false }, false, [{ course_id: online, type: 'presence', category: 'private' }])
   await rejected(online, { privacy: true, agb: true, recording: false }, false, [{ course_id: privateOnline, requested_units: 2 }, { course_id: online }])
  })

  await t.test('direct anonymous/authenticated REST cannot call privileged registration or write booking tables', async () => {
   const before = await snapshot()
   for (const [user, role] of [[null, 'anon'], [student, 'authenticated']]) {
    await actor(db, user, role)
    await assert.rejects(rows('SELECT submit_business_registration($1,$2,$3,$4)', [JSON.stringify({ name: 'Direct', email: 'direct@example.test' }), JSON.stringify([{ course_id: online }]), start, JSON.stringify({ privacy: true, agb: true, recording: false })]), e => e.code === '42501')
    await assert.rejects(rows("INSERT INTO bookings(person_id,target_month,start_date,contact_name,contact_email,privacy_accepted,agb_accepted) VALUES($1,$2,$2,'Direct','direct@example.test',true,true)", [person, start]), e => e.code === '42501')
    await assert.rejects(rows('UPDATE bookings SET recording_accepted=false WHERE id=$1', [historical]), e => e.code === '42501')
    await assert.rejects(rows("INSERT INTO booking_items(booking_id,course_id,title_snapshot,unit_price,unit_minutes,units,amount) VALUES($1,$2,'Direct',10,45,2,20)", [historical, online]), e => e.code === '42501')
   }
   assert.deepEqual(await snapshot(), before)
  })
 } finally { await db.close() }
})

await test('monthly course changes and continuation cannot bypass online recording consent', async t => {
 const db = await createPhase3Database()
 const online = id(850), presence = id(851), privateOnline = id(852), original = id(853)
 const rows = async (sql, args = []) => (await db.query(sql, args)).rows
 let month, currentMonth, person
 const selection = cid => JSON.stringify([{ course_id: cid, ...(cid === privateOnline ? { requested_units: 3 } : {}) }])
 const state = async () => {
  await db.exec('RESET ROLE')
  return (await rows(`SELECT jsonb_build_object(
   'people',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM people p),
   'bookings',(SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM bookings b),
   'items',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM booking_items i),
   'invoices',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM invoice_cases i),
   'proofs',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM business_private.sitov_recording_consents c),
   'usage',(SELECT jsonb_agg(to_jsonb(u) ORDER BY actor_id) FROM business_private.sitov_recording_monthly_usage u)) state`))[0].state
 }
 const current = async () => {
  await db.exec('RESET ROLE')
  return (await rows('SELECT id,revision,recording_accepted,status,confirmed_at FROM bookings WHERE person_id=$1 AND target_month=$2 AND kind<>\'trial\'', [person, month]))[0]
 }
 const save = async ({ cid = online, recording = null, legacy = false, paused = false, user = student, expected, revision } = {}) => {
  const b = await current()
  await actor(db, user)
  const args = [month, paused ? '[]' : selection(cid), paused, expected === undefined ? b?.id ?? null : expected, revision === undefined ? b?.revision ?? null : revision]
  if (legacy) return (await rows('SELECT save_business_month($1,$2,$3,$4,$5) result', args))[0].result
  return (await rows('SELECT sitov_save_business_month($1,$2,$3,$4,$5,$6) result', [...args, recording]))[0].result
 }
 const rejected = async (options, error = 'invalid_input') => {
  const before = await state()
  assert.equal((await save(options))?.error, error)
  assert.deepEqual(await state(), before)
 }
 try {
  for (const name of ['13_mail_exception_kind.sql', '14_mail_exceptions.sql', '53_course_cancellation_billing.sql', '68_sitov_confirmed_registration_monthly_access.sql'])
   await db.exec(await readFile(new URL(`../vps/${name}`, import.meta.url), 'utf8'))
  const dates = (await rows("SELECT date_trunc('month',now() AT TIME ZONE 'Europe/Berlin')::date::text current_month,(date_trunc('month',now() AT TIME ZONE 'Europe/Berlin')+interval '1 month')::date::text next_month"))[0]
  month = dates.next_month; currentMonth = dates.current_month
  person = (await rows('SELECT id FROM people WHERE auth_user_id=$1', [student]))[0].id
  for (const [cid, type, category] of [[online, 'online', 'online'], [presence, 'presence', 'german'], [privateOnline, 'online', 'private']]) {
   await rows('INSERT INTO courses(id,slug,title,type,category,unit_price,unit_minutes) VALUES($1,$2,$2,$3,$4,10,45)', [cid, `monthly-consent-${cid.slice(-3)}`, type, category])
   if (category !== 'private') await rows("INSERT INTO course_schedules(course_id,weekday,start_time,end_time) VALUES($1,4,'18:00','19:30')", [cid])
  }
  await db.exec('BEGIN;' + migration + 'COMMIT;')
  await db.exec('BEGIN;' + migration + 'COMMIT;')

  await t.test('new public RPC retains verified owner and confirmed registration guards', async () => {
   await rejected({ recording: true }, 'not_authorized')
   await rows(`INSERT INTO bookings(id,person_id,target_month,start_date,kind,status,confirmed_at,contact_name,contact_email,privacy_accepted,agb_accepted,recording_accepted)
    VALUES($1,$2,$3,$3,'registration','confirmed',now(),'Original','original@example.test',true,true,false)`, [original, person, currentMonth])
   await rows('SELECT business_private.replace_items($1,$2)', [original, selection(presence)])
   await rejected({ recording: true, user: outsider }, 'not_authorized')
  })

  await t.test('legacy five-argument and explicit false/null paths reject groups without side effects', async () => {
   for (const recording of [false, null]) await rejected({ recording })
   await rejected({ legacy: true })
   await actor(db, student)
   await assert.rejects(rows('SELECT business_private.save_month($1,$2,false,NULL,NULL)', [month, selection(online)]), e => e.code === '23514')
   await db.exec('RESET ROLE')
  })

  await t.test('private/presence changes work through legacy and new paths; group edits require persisted true', async () => {
   const bid = await save({ cid: privateOnline, legacy: true })
   assert.match(bid, /^[a-f0-9-]{36}$/)
   assert.equal((await current()).recording_accepted, null)
   await rejected({ legacy: true })
   assert.equal(await save({ recording: true }), bid)
   assert.equal((await current()).recording_accepted, true)
   await rejected({ recording: false })
   await rejected({ recording: true, revision: 1 }, 'conflict')
   assert.equal(await save({ cid: presence, recording: false }), bid)
   assert.equal((await current()).recording_accepted, false)
   assert.equal(await save({ cid: privateOnline, recording: null }), bid)
   assert.equal((await current()).recording_accepted, null)
   assert.equal(await save({ recording: true }), bid)
   assert.equal((await current()).recording_accepted, true)
   assert.equal(await save({ legacy: true, paused: true }), bid)
   const paused = await current()
   assert.equal(paused.status, 'cancelled')
   assert.equal(paused.recording_accepted, true, 'Pause does not silently revoke the existing recorded choice')
   assert.equal((await rows('SELECT count(*)::int n FROM booking_items WHERE booking_id=$1', [bid]))[0].n, 0)
   assert.equal((await rows('SELECT status,confirmed_at,recording_accepted FROM bookings WHERE id=$1', [original]))[0].recording_accepted, false)
  })

  await t.test('staff continuation skips refused/absent group consent and processes other people', async () => {
   const cases = [[online, false], [online, null], [online, true], [presence, false], [privateOnline, null]]
   const seeded = []
   for (const [index, [cid, recording]] of cases.entries()) {
    const pid = (await rows("INSERT INTO people(display_name,email) VALUES($1,$2) RETURNING id", [`Continue ${index}`, `continue-${index}@example.test`]))[0].id
    const bid = (await rows(`INSERT INTO bookings(person_id,target_month,start_date,kind,status,confirmed_at,contact_name,contact_email,privacy_accepted,agb_accepted,recording_accepted)
     VALUES($1,$2,$2,'registration','confirmed',now(),'Continue',$3,true,true,$4) RETURNING id`, [pid, currentMonth, `continue-${index}@example.test`, recording]))[0].id
    await rows('SELECT business_private.replace_items($1,$2)', [bid, selection(cid)])
    seeded.push({ pid, bid, cid, recording })
   }
   const originalRows = await rows('SELECT * FROM bookings WHERE id=ANY($1::uuid[]) ORDER BY id', [seeded.map(row => row.bid)])
   const proofBefore = await rows('SELECT * FROM business_private.sitov_recording_consents ORDER BY id')
   await actor(db, teacher)
   const result = (await rows('SELECT prepare_business_month($1) result', [month]))[0].result
   assert.equal(result, 3)
   await db.exec('RESET ROLE')
   assert.deepEqual(await rows('SELECT * FROM bookings WHERE id=ANY($1::uuid[]) ORDER BY id', [seeded.map(row => row.bid)]), originalRows)
   assert.deepEqual(await rows('SELECT * FROM business_private.sitov_recording_consents ORDER BY id'), proofBefore, 'Automatic continuation never invents a fresh approval timestamp')
   for (const [index, row] of seeded.entries()) {
    const generated = await rows('SELECT id,recording_accepted FROM bookings WHERE person_id=$1 AND target_month=$2', [row.pid, month])
    if (index < 2) assert.deepEqual(generated, [])
    else {
     assert.equal(generated.length, 1)
     assert.equal(generated[0].recording_accepted, row.recording)
     assert.equal((await rows('SELECT course_id FROM booking_items WHERE booking_id=$1', [generated[0].id]))[0].course_id, row.cid)
    }
   }
   await actor(db, teacher)
   assert.equal((await rows('SELECT prepare_business_month($1) result', [month]))[0].result, 0)
  })

  await t.test('new RPC and private helpers have explicit grants; existing calendar and confirmation guards survive', async () => {
   await db.exec('RESET ROLE')
   for (const signature of ['public.sitov_save_business_month(date,jsonb,boolean,uuid,integer,boolean,text)', 'business_private.save_month(date,jsonb,boolean,uuid,integer,boolean,text)', 'business_private.save_month(date,jsonb,boolean,uuid,integer,boolean)', 'business_private.save_month(date,jsonb,boolean,uuid,integer)']) {
    const privileges = (await rows("SELECT has_function_privilege('anon',$1,'EXECUTE') anon,has_function_privilege('authenticated',$1,'EXECUTE') learner", [signature]))[0]
    assert.deepEqual(privileges, { anon: false, learner: true })
   }
   const definitions = (await rows("SELECT pg_get_functiondef('business_private.save_month(date,jsonb,boolean,uuid,integer,boolean,text)'::regprocedure) monthly,pg_get_functiondef('business_private.prepare_month(date)'::regprocedure) preparation"))[0]
   assert.ok(definitions.monthly.includes('sitov_confirmed_registration_required'))
   assert.ok(definitions.monthly.includes('for update'))
   assert.ok(definitions.monthly.includes('Invoice already created'))
   assert.ok(definitions.preparation.includes('business_private.refresh_booking_calendar'))
   assert.ok(definitions.preparation.includes('for p in select * from public.people order by id for update loop'))
   await actor(db, null, 'anon')
   await assert.rejects(rows('SELECT sitov_save_business_month($1,$2,false,NULL,NULL,true)', [month, selection(online)]), e => e.code === '42501')
  })
 } finally { await db.close() }
})

await test('unexpected monthly definitions abort the entire migration instead of dropping existing protection', async t => {
 const db = await createPhase3Database()
 const rows = async (sql, args = []) => (await db.query(sql, args)).rows
 const original = (await rows("SELECT pg_get_functiondef('public.submit_business_registration(jsonb,jsonb,date,jsonb,text,boolean)'::regprocedure) definition"))[0].definition
 try {
  await t.test('missing migration 68 rolls back preceding registration changes', async () => {
   await assert.rejects(db.exec('BEGIN;' + migration + 'COMMIT;'), e => /confirmed-registration guard is missing/.test(e.message))
   await db.exec('ROLLBACK')
   assert.equal((await rows("SELECT pg_get_functiondef('public.submit_business_registration(jsonb,jsonb,date,jsonb,text,boolean)'::regprocedure) definition"))[0].definition, original)
   assert.equal((await rows("SELECT to_regprocedure('business_private.save_month(date,jsonb,boolean,uuid,integer,boolean)') function"))[0].function, null)
  })
  await t.test('an unexpected existing six-argument function is preserved and rejected for operator review', async () => {
   await db.exec(await readFile(new URL('../vps/68_sitov_confirmed_registration_monthly_access.sql', import.meta.url), 'utf8'))
   await db.exec(`CREATE FUNCTION business_private.save_month(p_month date,p_course_selections jsonb,p_paused boolean,p_expected uuid,p_revision integer,p_recording_accepted boolean)
    RETURNS uuid LANGUAGE sql SET search_path='' AS $$ SELECT gen_random_uuid() $$`)
   const six = (await rows("SELECT pg_get_functiondef('business_private.save_month(date,jsonb,boolean,uuid,integer,boolean)'::regprocedure) definition"))[0].definition
   await assert.rejects(db.exec('BEGIN;' + migration + 'COMMIT;'), e => /Unexpected existing six-argument save_month/.test(e.message))
   await db.exec('ROLLBACK')
   assert.equal((await rows("SELECT pg_get_functiondef('business_private.save_month(date,jsonb,boolean,uuid,integer,boolean)'::regprocedure) definition"))[0].definition, six)
   assert.equal((await rows("SELECT pg_get_functiondef('public.submit_business_registration(jsonb,jsonb,date,jsonb,text,boolean)'::regprocedure) definition"))[0].definition, original)
  })
 } finally { await db.close() }
})
