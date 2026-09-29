import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createLearningPathDatabase, actor, id, apply, student, teacher, outsider, result } from './helpers/learning-path-db.mjs'
import { renderTransactionalEmail, MAIL_LOCALES } from '../../lib/mail/templates.mjs'

const origin = 'https://217.154.228.254'
const rollback = readFileSync(new URL('../vps/rollback/41_mail_notifications.sql', import.meta.url), 'utf8')
const submission = id(96001), otherSubmission = id(96002)

async function fixture() {
 const db = await createLearningPathDatabase()
 try {
  await apply(db, ['40_level_access_verified_email.sql'])
  // Old per-level mail (migration 29) that must count as already announced after migration 41.
  await db.exec("INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('B1.1','A1',2),('A1.2','A1',3),('A2.1','A1',4),('A2.2','A1',5),('B1.2','A1',6)")
  await db.query("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,'legacy@example.test',now())", [id(97001)])
  await db.query("INSERT INTO profiles(id,role,ui_language) VALUES($1,'student','de')", [id(97001)])
  await actor(db, teacher)
  await db.query("SELECT set_student_level_access($1,ARRAY['A1.1'])", [id(97001)])
  await db.exec('RESET ROLE')
  await apply(db, ['41_mail_notifications.sql'])
  await db.exec('DELETE FROM private.mail_outbox')
  const unit = id(96010), text = id(96011)
  await db.query("INSERT INTO learning_units(id,level,trainer,label) VALUES($1,'A1.1','pronunciation','Aussprache 1')", [unit])
  await db.query("INSERT INTO learning_reading_texts(id,unit_id,sentence_de) VALUES($1,$2,'Ich lese einen kurzen Text.')", [text, unit])
  await db.query("INSERT INTO submissions(id,auth_user_id,type,level,text_content,prompt_id) VALUES($1,$2,'audio','A1.1','Text',$4),($3,$2,'audio','A1.1','Text 2',$4)", [submission, student, otherSubmission, text])
  await db.exec("INSERT INTO storage.objects(bucket_id,name) VALUES('pronunciation_audio','"+teacher+"/x.webm'),('pronunciation_audio','"+student+"/y.webm')")
  return db
 } catch (error) { await db.close(); delete error.query; throw error }
}
const scenario = (name, fn) => test(`notification mails: ${name}`, async () => {
 const db = await fixture()
 try { await fn(db) } finally { await db.close() }
})
const admin = db => db.exec('RESET ROLE')
const levelMails = async db => { await admin(db); return (await db.query("SELECT dedupe_key,recipient,locale,payload FROM private.mail_outbox WHERE kind::text='level_access_granted' ORDER BY created_at,id")).rows }
const replyMails = async db => { await admin(db); return (await db.query("SELECT dedupe_key,recipient,locale,payload,status::text status,available_at>now()+interval '9 minutes' delayed FROM private.mail_outbox WHERE kind::text='feedback_available' ORDER BY created_at,id")).rows }
const grant = async (db, user, levels) => { await actor(db, teacher); try { return (await db.query('SELECT set_student_level_access($1,$2::text[]) result', [user, levels])).rows[0].result } finally { await admin(db) } }
const reply = async (db, text = 'Gut gelesen!', { thread = submission, audio = null, role = 'teacher' } = {}) => {
 const sender = role === 'student' ? student : teacher
 await actor(db, sender)
 try { await db.query('INSERT INTO pronunciation_messages(submission_id,sender_id,text_content,audio_path) VALUES($1,$2,$3,$4)', [thread, sender, text, audio]) } finally { await admin(db) }
}

scenario('six levels granted at once send exactly one mail naming all of them in course order', async db => {
 assert.equal(await grant(db, outsider, ['A1.1', 'B1.1', 'A1.2', 'A2.1', 'A2.2', 'B1.2']), null)
 const jobs = (await levelMails(db)).filter(x => x.recipient === `${outsider}@example.test`)
 assert.equal(jobs.length, 1)
 assert.deepEqual(jobs[0].payload.levels, ['A1.1', 'B1.1', 'A1.2', 'A2.1', 'A2.2', 'B1.2'])
 assert.equal(jobs[0].payload.path, '/ru/dashboard/level/A1.1', 'the button leads to the first newly unlocked level')
 assert.equal('level' in jobs[0].payload, false)
 for (const lang of MAIL_LOCALES) {
  const mail = renderTransactionalEmail('level_access_granted', lang, jobs[0].payload, origin)
  assert.doesNotMatch(mail.text, /\{level\}|undefined/)
  for (const level of jobs[0].payload.levels) assert.ok(mail.text.includes(level), `${lang} names ${level}`)
 }
})

scenario('one level sends one mail with one level; the old single-level payload still renders', async db => {
 await grant(db, outsider, ['A1.1'])
 const [job] = (await levelMails(db)).filter(x => x.recipient === `${outsider}@example.test`)
 assert.deepEqual(job.payload.levels, ['A1.1'])
 assert.match(renderTransactionalEmail('level_access_granted', 'de', job.payload, origin).text, /das Niveau A1\.1 auf der Lernplattform freigeschaltet[\s\S]*Vokabeln, dem Lernpfad, der Aussprache und der Mediathek/)
 assert.doesNotMatch(renderTransactionalEmail('level_access_granted', 'de', job.payload, origin).text, /Übungen/)
 const legacy = { name: 'Anna', level: 'A1.2', path: '/de/dashboard/level/A1.2' }
 for (const lang of MAIL_LOCALES) assert.ok(renderTransactionalEmail('level_access_granted', lang, legacy, origin).text.includes('A1.2'))
})

scenario('revoking and granting again sends nothing; a later extra level sends only that level', async db => {
 await grant(db, outsider, ['A1.1', 'A1.2'])
 await grant(db, outsider, ['A1.1'])
 await grant(db, outsider, ['A1.1', 'A1.2'])
 assert.equal((await levelMails(db)).filter(x => x.recipient === `${outsider}@example.test`).length, 1)
 await grant(db, outsider, ['A1.1', 'A1.2', 'A2.1'])
 const jobs = (await levelMails(db)).filter(x => x.recipient === `${outsider}@example.test`)
 assert.equal(jobs.length, 2)
 assert.deepEqual(jobs[1].payload.levels, ['A2.1'])
})

scenario('two people in one statement each get their own mail; existing grants and unconfirmed accounts get none', async db => {
 await admin(db)
 await db.query("INSERT INTO auth.users(id,email) VALUES($1,'typo@example.test')", [id(97002)])
 await db.query("INSERT INTO profiles(id,role) VALUES($1,'student')", [id(97002)])
 await db.query("INSERT INTO student_level_access(auth_user_id,level) VALUES($1,'A1.2'),($1,'A2.1'),($2,'A1.2'),($3,'A1.2')", [outsider, teacher, id(97002)])
 const jobs = await levelMails(db)
 assert.deepEqual(jobs.map(x => x.recipient).sort(), [`${outsider}@example.test`, `${teacher}@example.test`].sort())
 assert.deepEqual(jobs.find(x => x.recipient.startsWith(outsider)).payload.levels, ['A1.2', 'A2.1'])
 assert.deepEqual(jobs.find(x => x.recipient.startsWith(teacher)).payload.levels, ['A1.2'])
 assert.equal((await db.query('SELECT count(*)::int n FROM student_level_access WHERE auth_user_id=$1', [id(97002)])).rows[0].n, 1, 'the grant itself stays')
 await grant(db, student, ['A1.1'])
 assert.equal((await levelMails(db)).filter(x => x.recipient === `${student}@example.test`).length, 0, 'no catch-up mail for a grant that already existed')
})

scenario('levels announced by the old per-level mail are never announced again', async db => {
 await admin(db)
 await db.query("INSERT INTO private.mail_outbox(dedupe_key,kind,recipient,locale,payload) VALUES($1,'level_access_granted','old@example.test','de','{}')", [`level-access:${outsider}:A1.2`])
 await db.exec('DELETE FROM business_private.level_access_announcements')
 await db.exec(readSeed())
 await grant(db, outsider, ['A1.1', 'A1.2'])
 const jobs = (await levelMails(db)).filter(x => x.recipient === `${outsider}@example.test`)
 assert.deepEqual(jobs.map(x => x.payload.levels), [['A1.1']])
})
function readSeed() {
 const sql = readFileSync(new URL('../vps/41_mail_notifications.sql', import.meta.url), 'utf8')
 const start = sql.indexOf('-- Bisher angekündigte Niveaus')
 return sql.slice(start, sql.indexOf('CREATE OR REPLACE FUNCTION business_private.notify_students_of_level_access'))
}

scenario('an unavailable outbox never blocks the grant, and a failed queueing is retried by the next grant', async db => {
 await admin(db)
 await db.exec('ALTER TABLE private.mail_outbox RENAME TO mail_outbox_off')
 try { assert.equal(await grant(db, outsider, ['A1.1', 'A1.2']), null) } finally { await db.exec('ALTER TABLE private.mail_outbox_off RENAME TO mail_outbox') }
 assert.equal((await db.query('SELECT count(*)::int n FROM student_level_access WHERE auth_user_id=$1', [outsider])).rows[0].n, 2)
 assert.equal((await levelMails(db)).length, 0)
 assert.equal((await db.query('SELECT count(*)::int n FROM business_private.level_access_announcements WHERE auth_user_id=$1', [outsider])).rows[0].n, 0)
})

scenario('switch off: no outbox row; switch on: exactly one row, delayed for bundling', async db => {
 await admin(db)
 await db.query('UPDATE profiles SET notify_pronunciation_feedback=false WHERE id=$1', [student])
 await reply(db)
 assert.equal((await replyMails(db)).length, 0)
 await db.query('UPDATE profiles SET notify_pronunciation_feedback=true WHERE id=$1', [student])
 await reply(db)
 const jobs = await replyMails(db)
 assert.equal(jobs.length, 1)
 assert.deepEqual([jobs[0].recipient, jobs[0].locale, jobs[0].status, jobs[0].delayed], [`${student}@example.test`, 'ru', 'pending', true])
 assert.equal(jobs[0].payload.path, `/ru/dashboard/level/A1.1/pronunciation?tab=mailbox&conversation=${submission}`)
})

scenario('a message from the learner never sends a reply mail', async db => {
 await reply(db, 'Meine Aufnahme', { role: 'student' })
 assert.equal((await replyMails(db)).length, 0)
})

scenario('three replies within ten minutes bundle into one mail; threads stay separate; a sent mail starts a new bundle', async db => {
 await reply(db, 'Erste Antwort')
 await reply(db, '', { audio: `storage://pronunciation_audio/${teacher}/x.webm` })
 await reply(db, 'Dritte Antwort')
 await reply(db, 'Andere Aufnahme', { thread: otherSubmission })
 let jobs = await replyMails(db)
 assert.equal(jobs.length, 2)
 const bundle = jobs.find(x => x.payload.submissionId === submission)
 assert.deepEqual(bundle.payload.replies, [{ text: 'Erste Antwort', audio: false }, { text: '', audio: true }, { text: 'Dritte Antwort', audio: false }])
 for (const lang of MAIL_LOCALES) {
  const mail = renderTransactionalEmail('feedback_available', lang, bundle.payload, origin)
  assert.match(mail.text, /Erste Antwort/); assert.match(mail.text, /Dritte Antwort/)
  assert.ok(mail.text.includes(`conversation=${submission}`))
  assert.doesNotMatch(mail.text, /\{count\}|undefined/)
  assert.doesNotMatch(mail.html, /\{count\}|undefined/)
 }
 await db.query("UPDATE private.mail_outbox SET status='sent',sent_at=now() WHERE id IN(SELECT id FROM private.mail_outbox WHERE payload->>'submissionId'=$1)", [String(submission)])
 await reply(db, 'Nach dem Versand')
 jobs = (await replyMails(db)).filter(x => x.payload.submissionId === submission)
 assert.deepEqual(jobs.map(x => x.status), ['sent', 'pending'])
 assert.equal(jobs[1].payload.replies.length, 1)
})

scenario('a single reply renders in five languages without list placeholders', async db => {
 await reply(db, 'Sehr gut!')
 const [job] = await replyMails(db)
 for (const lang of MAIL_LOCALES) {
  const mail = renderTransactionalEmail('feedback_available', lang, job.payload, origin)
  assert.ok(mail.text.includes('Sehr gut!')); assert.doesNotMatch(mail.text, /undefined|\{/)
 }
})

scenario('switching off cancels the mail that is still waiting for its bundling window', async db => {
 await reply(db, 'Antwort')
 assert.equal((await replyMails(db)).length, 1)
 await admin(db)
 await db.query('UPDATE profiles SET notify_pronunciation_feedback=false WHERE id=$1', [student])
 assert.equal((await replyMails(db)).length, 0)
})

scenario('a learner may change only the own switch; an unconfirmed address gets no reply mail', async db => {
 await actor(db, student)
 await db.query('UPDATE profiles SET notify_pronunciation_feedback=false WHERE id=$1', [student])
 assert.equal((await db.query('SELECT notify_pronunciation_feedback n FROM profiles WHERE id=$1', [student])).rows[0].n, false)
 await db.query('UPDATE profiles SET notify_pronunciation_feedback=false WHERE id=$1', [outsider])
 await admin(db)
 assert.equal((await db.query('SELECT notify_pronunciation_feedback n FROM profiles WHERE id=$1', [outsider])).rows[0].n, true, 'another learner is untouched (row security)')
 await assert.rejects(async () => { await actor(db, student); await db.query("UPDATE profiles SET role='teacher' WHERE id=$1", [student]) }, e => e.code === '42501')
 await admin(db)
 await db.query('UPDATE profiles SET notify_pronunciation_feedback=true WHERE id=$1', [student])
 await db.query('UPDATE auth.users SET email_confirmed_at=NULL WHERE id=$1', [student])
 await reply(db)
 assert.equal((await replyMails(db)).length, 0)
})

scenario('rollback restores the per-row level mail and is repeatable', async db => {
 await admin(db)
 await db.exec(rollback); await db.exec(rollback)
 await grant(db, outsider, ['A1.1', 'A1.2'])
 assert.deepEqual((await levelMails(db)).filter(x => x.recipient === `${outsider}@example.test`).map(x => x.payload.level).sort(), ['A1.1', 'A1.2'])
 await apply(db, ['41_mail_notifications.sql']); await apply(db, ['41_mail_notifications.sql'])
})

scenario('6.3 finishing the last test of a level notifies nobody', async db => {
 await admin(db)
 const unit = id(96100), node = id(96101)
 await db.query("INSERT INTO learning_units(id,level,trainer,label,sort_order,is_path,path_source_id,path_slug,path_title) VALUES($1,'A1.1','exercises','Abschlusspfad',1,true,'done','done','Abschlusspfad')", [unit])
 await db.query("INSERT INTO path_objectives(unit_id,id,area,description) VALUES($1,'goal','grammar','Ziel')", [unit])
 await db.query("INSERT INTO path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,goals,test_size) VALUES($1,$2,'t','test',1,'Abschlusstest','Test',ARRAY['goal'],1)", [node, unit])
 for (const n of [0, 1]) await db.query("INSERT INTO learning_exercises(id,unit_id,node_id,goal_id,source_ref,sort_order,topic,type,content) VALUES($1,$2,$3,'goal',$4,$5,'Test','multiple_choice',$6)", [id(96102 + n), unit, node, `t-${n}`, n + 1, JSON.stringify({ target_form: ['Ja'], question: 'Wähle Ja.', options: ['Ja', 'Nein'], correct_answer: 'Ja', accepted_answers: ['Ja'] })])
 const before = (await db.query('SELECT count(*)::int n FROM private.mail_outbox')).rows[0].n
 await actor(db, student)
 const start = await result(db, 'SELECT start_path_test($1) result', [node]); assert.ok(start.attempt_id, JSON.stringify(start))
 await result(db, 'SELECT submit_path_test_answer($1,$2,$3::jsonb) result', [start.attempt_id, start.exercises[0].id, JSON.stringify({ index: 0 })])
 const finish = await result(db, 'SELECT finish_path_test($1) result', [start.attempt_id])
 assert.equal(finish.passed, true, JSON.stringify(finish))
 await admin(db)
 assert.equal((await db.query('SELECT count(*)::int n FROM private.mail_outbox')).rows[0].n, before, 'no staff mail, no learner mail')
 assert.equal((await db.query("SELECT count(*)::int n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relname IN('path_test_attempts','path_node_progress') AND NOT t.tgisinternal AND pg_get_triggerdef(t.oid) ~* 'mail|notify'")).rows[0].n, 0)
})
