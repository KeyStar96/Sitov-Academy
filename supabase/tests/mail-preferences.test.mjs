import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLearningPathDatabase, actor, id, apply, student, teacher, outsider } from './helpers/learning-path-db.mjs'
import { renderTransactionalEmail, MAIL_LOCALES, OPTIONAL_MAIL_KINDS } from '../../lib/mail/templates.mjs'

// Phase-8 prompt, item 4: optional mails follow the learner's switches (migration 47),
// mandatory mails never do. Enforced when queuing, when switching off and when sending.
const origin = 'https://www.sitov-academy.com'
const worker = id(47900)
// 12:00 Berlin (summer time) on a fixed day; quiet hours are checked in Europe/Berlin.
const noon = '2026-09-29T10:00:00Z'

async function fixture() {
  const db = await createLearningPathDatabase()
  try {
    await apply(db, ['36_migrate_old_grammar_progress.sql', '37_vocabulary_carryover.sql', '38_learning_sessions.sql', '40_level_access_verified_email.sql', '41_mail_notifications.sql', '42_learning_new.sql', '46_mail_reminder_kind.sql', '47_mail_preferences.sql'])
    await db.exec("INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('A1.2','A1',2) ON CONFLICT DO NOTHING")
    await db.exec('DELETE FROM private.mail_outbox')
    return db
  } catch (error) { await db.close(); delete error.query; throw error }
}
const scenario = (name, fn) => test(`mail preferences: ${name}`, async () => {
  const db = await fixture()
  try { await fn(db) } finally { await db.close() }
})
const admin = db => db.exec('RESET ROLE')
const mails = async (db, kind) => { await admin(db); return (await db.query('SELECT dedupe_key,recipient,payload,status::text status FROM private.mail_outbox WHERE kind::text=$1 ORDER BY created_at,id', [kind])).rows }
const setSwitch = async (db, user, column, value) => {
  await actor(db, user)
  try { await db.query(`UPDATE profiles SET ${column}=$2 WHERE id=$1`, [user, value]) } finally { await admin(db) }
}
const grant = async (db, user, levels) => { await actor(db, teacher); try { return (await db.query('SELECT set_student_level_access($1,$2::text[]) result', [user, levels])).rows[0].result } finally { await admin(db) } }
const asService = async (db, sql, params = []) => {
  await admin(db); await db.exec('SET ROLE service_role')
  try { return (await db.query(`SELECT ${sql} result`, params)).rows[0].result } finally { await admin(db) }
}
const remind = (db, at = noon) => asService(db, 'queue_learning_reminders($1)', [at])
const claim = db => asService(db, 'claim_mail_jobs($1,20)', [worker])

scenario('learners may change exactly their own three switches, all on by default', async db => {
  const row = (await db.query('SELECT notify_pronunciation_feedback,notify_new_content,notify_learning_reminders FROM profiles WHERE id=$1', [student])).rows[0]
  assert.deepEqual(row, { notify_pronunciation_feedback: true, notify_new_content: true, notify_learning_reminders: true })
  await setSwitch(db, student, 'notify_new_content', false)
  await setSwitch(db, student, 'notify_learning_reminders', false)
  await actor(db, outsider)
  await db.query('UPDATE profiles SET notify_new_content=false WHERE id=$1', [student])
  await admin(db)
  const after = (await db.query('SELECT id,notify_new_content,notify_learning_reminders FROM profiles WHERE id=ANY($1) ORDER BY id', [[student, outsider]])).rows
  assert.deepEqual(after.find(r => r.id === student), { id: student, notify_new_content: false, notify_learning_reminders: false })
  assert.equal(after.find(r => r.id === outsider).notify_new_content, true, 'nobody switches off mails for someone else')
})

scenario('new content: switched off means no level mail is ever queued', async db => {
  await setSwitch(db, outsider, 'notify_new_content', false)
  assert.equal(await grant(db, outsider, ['A1.1']), null)
  assert.deepEqual(await mails(db, 'level_access_granted'), [])
  await setSwitch(db, outsider, 'notify_new_content', true)
  assert.equal(await grant(db, outsider, ['A1.1', 'A1.2']), null)
  const queued = await mails(db, 'level_access_granted')
  assert.equal(queued.length, 1)
  assert.deepEqual(queued[0].payload.levels, ['A1.2'], 'the level unlocked while switched off stays unannounced')
  assert.equal(queued[0].payload.authUserId, outsider)
})

scenario('switching off drops pending optional mails at once, mandatory ones stay', async db => {
  assert.equal(await grant(db, outsider, ['A1.1']), null)
  await db.query("SELECT public.queue_transactional_email('registration:x','registration_received',$1,'de','{}'::jsonb)", [`${outsider}@example.test`])
  await db.query("SELECT public.queue_transactional_email('reminder:x','learning_reminder',$1,'de',$2)", [`${outsider}@example.test`, JSON.stringify({ authUserId: outsider })])
  assert.equal((await mails(db, 'level_access_granted')).length, 1)
  await setSwitch(db, outsider, 'notify_new_content', false)
  await setSwitch(db, outsider, 'notify_learning_reminders', false)
  assert.deepEqual(await mails(db, 'level_access_granted'), [])
  assert.deepEqual(await mails(db, 'learning_reminder'), [])
  assert.equal((await mails(db, 'registration_received')).length, 1, 'registration mails have no switch')
})

scenario('the mail worker never receives a mail whose recipient switched it off after queuing', async db => {
  assert.equal(await grant(db, outsider, ['A1.1']), null)
  await db.query("SELECT public.queue_transactional_email('trial:x','trial_confirmed',$1,'de','{}'::jsonb)", [`${outsider}@example.test`])
  // Bypass the switch-off cleanup to prove the send-time check on its own.
  await db.exec('ALTER TABLE profiles DISABLE TRIGGER on_optional_mail_opt_out')
  await setSwitch(db, outsider, 'notify_new_content', false)
  await db.exec('ALTER TABLE profiles ENABLE TRIGGER on_optional_mail_opt_out')
  const jobs = await claim(db)
  assert.deepEqual(jobs.map(job => job.kind), ['trial_confirmed'], 'only the mandatory mail goes out')
  assert.deepEqual(await mails(db, 'level_access_granted'), [], 'the switched-off mail is dropped, not retried')
})

scenario('no switch can silence mandatory mails, even with every switch off', async db => {
  for (const column of ['notify_pronunciation_feedback', 'notify_new_content', 'notify_learning_reminders']) await setSwitch(db, outsider, column, false)
  for (const kind of ['registration_received', 'registration_confirmed', 'trial_confirmed', 'booking_cancelled', 'cancellation_requested', 'course_exception_added']) {
    await db.query("SELECT public.queue_transactional_email($1,$2,$3,'ru',$4)", [`${kind}:${outsider}`, kind, `${outsider}@example.test`, JSON.stringify({ authUserId: outsider })])
    assert.equal((await mails(db, kind)).length, 1, kind)
  }
})

scenario('learning reminder: after 7 quiet days, once per 14 days, only in the daytime', async db => {
  assert.equal(await grant(db, outsider, ['A1.1']), null)
  await db.query("UPDATE student_level_access SET granted_at=$2::timestamptz-interval '10 days' WHERE auth_user_id=$1", [outsider, noon])
  await db.query("UPDATE student_level_access SET granted_at=$2::timestamptz-interval '2 days' WHERE auth_user_id<>$1", [outsider, noon])
  assert.deepEqual(await remind(db, '2026-09-29T19:30:00Z'), { queued: 0, skipped: 'quiet_hours' })
  const first = await remind(db)
  assert.equal(first.queued, 1, JSON.stringify(first))
  const [mail] = await mails(db, 'learning_reminder')
  assert.equal(mail.recipient, `${outsider}@example.test`)
  assert.equal(mail.payload.authUserId, outsider)
  assert.equal(mail.payload.path, '/ru/dashboard')
  const mine = async () => (await mails(db, 'learning_reminder')).filter(row => row.payload.authUserId === outsider).length
  assert.equal((await remind(db)).queued, 0, 'same day: nothing new')
  await remind(db, '2026-10-06T10:00:00Z')
  assert.equal(await mine(), 1, 'within 14 days: nothing new')
  await remind(db, '2026-10-14T10:00:00Z')
  assert.equal(await mine(), 2, 'after 14 days: the next reminder')
})

scenario('learning reminder: recent learning, a switched-off switch or three reminders per break stop it', async db => {
  assert.equal(await grant(db, outsider, ['A1.1']), null)
  await db.exec("UPDATE student_level_access SET granted_at='2026-08-01T10:00:00Z'")
  const mine = async () => (await mails(db, 'learning_reminder')).filter(mail => mail.payload.authUserId === outsider)
  await db.query("INSERT INTO learning_activity_days(auth_user_id,day,last_activity_at) VALUES($1,'2026-09-27','2026-09-27T09:00:00Z')", [outsider])
  await remind(db)
  assert.deepEqual(await mine(), [], 'learned two days ago')
  await db.exec("DELETE FROM learning_activity_days; DELETE FROM private.mail_outbox")
  await setSwitch(db, outsider, 'notify_learning_reminders', false)
  await remind(db)
  assert.deepEqual(await mine(), [], 'switched off')
  await setSwitch(db, outsider, 'notify_learning_reminders', true)
  for (const at of ['2026-09-01T10:00:00Z', '2026-09-15T10:00:00Z', '2026-09-29T10:00:00Z', '2026-10-13T10:00:00Z']) await remind(db, at)
  assert.equal((await mine()).length, 3, 'at most three reminders per break')
  await db.query("INSERT INTO submissions(auth_user_id,type,level,text_content,created_at) VALUES($1,'audio','A1.1','Text','2026-10-20T10:00:00Z')", [outsider])
  await remind(db, '2026-10-29T10:00:00Z')
  assert.equal((await mine()).length, 4, 'a pronunciation recording starts a new break')
})

test('mail preferences: only the mail worker may queue learning reminders', async () => {
  const db = await fixture()
  try {
    await actor(db, teacher)
    assert.equal((await db.query('SELECT queue_learning_reminders() result').catch(error => ({ rows: [{ result: { error: error.code } }] }))).rows[0].result.error !== undefined, true)
  } finally { await db.close() }
})

test('mail preferences: the reminder renders in five languages and every optional mail says where to switch it off', () => {
  for (const lang of MAIL_LOCALES) {
    const mail = renderTransactionalEmail('learning_reminder', lang, { name: 'Olena', authUserId: id(1), path: `/${lang}/dashboard` }, origin)
    assert.doesNotMatch(mail.text, /undefined|\{/)
    for (const kind of OPTIONAL_MAIL_KINDS) {
      const optional = renderTransactionalEmail(kind, lang, { name: 'Olena', levels: ['A1.1'], replies: [{ text: 'Gut!' }] }, origin)
      assert.ok(optional.text.includes(`${origin}/${lang}/dashboard/profile#notifications`), `${kind}/${lang}`)
      assert.ok(optional.html.includes(`${origin}/${lang}/dashboard/profile#notifications`), `${kind}/${lang} html`)
    }
    const mandatory = renderTransactionalEmail('registration_confirmed', lang, { name: 'Olena' }, origin)
    assert.equal(mandatory.text.includes('#notifications'), false, `${lang}: mandatory mails have no opt-out`)
  }
})
