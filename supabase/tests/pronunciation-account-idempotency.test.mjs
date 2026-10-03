import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCurrentDatabase, currentFeatureMigrations, actor, id, student, teacher, outsider, result } from './helpers/current-db.mjs'

const unit = id(610210), prompt = id(610211), recording = `${student}/${id(610212)}.wav`
const reference = `storage://pronunciation_audio/${recording}`
const as = async (db, user) => { await db.exec('RESET ROLE'); await actor(db, user) }
const submit = db => result(db, 'SELECT public.create_pronunciation_submission($1,$2) result', [prompt, reference])

test('Sitov pronunciation recordings are account-owned and retry one committed submission', async t => {
  const db = await createCurrentDatabase({ latest: [...currentFeatureMigrations, '59_daily_quests.sql', '60_daily_quest_resume.sql', '61_account_learning_checkpoints.sql'] })
  try {
    await db.query("INSERT INTO learning_units(id,level,trainer,label) VALUES($1,'A1.1','pronunciation','Sitov Lesetext')", [unit])
    await db.query("INSERT INTO learning_reading_texts(id,unit_id,sentence_de) VALUES($1,$2,'Ich lerne jeden Tag Deutsch.')", [prompt, unit])
    await db.query("INSERT INTO student_level_access(auth_user_id,level) VALUES($1,'A1.1')", [outsider])
    // The private Storage upload API is tested separately. Seed its immutable
    // object as infrastructure, then exercise submission writes as the learner.
    await db.query("INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('pronunciation_audio',$1,$2)", [recording, student])
    await as(db, student)
    let submission
    await t.test('a lost response and a fresh authenticated device return the same recording ID', async () => {
      submission = await submit(db)
      assert.equal(typeof submission, 'string')
      await as(db, student)
      assert.equal(await submit(db), submission)
      const saved = (await db.query('SELECT id,auth_user_id,prompt_id,text_content FROM submissions')).rows
      assert.deepEqual(saved, [{ id: submission, auth_user_id: student, prompt_id: prompt, text_content: 'Ich lerne jeden Tag Deutsch.' }])
    })
    await t.test('another course-authorized learner cannot replay the recording or read its submission', async () => {
      await as(db, outsider)
      assert.ok((await submit(db)).error)
      assert.equal((await db.query('SELECT id FROM submissions')).rows.length, 0)
      assert.equal((await db.query("SELECT name FROM storage.objects WHERE bucket_id='pronunciation_audio'")).rows.length, 0)
    })
    await t.test('a retry preserves teacher feedback and reviewed status on the same account record', async () => {
      await as(db, teacher)
      await db.query("INSERT INTO pronunciation_messages(submission_id,sender_id,text_content) VALUES($1,$2,'Gut gelesen!')", [submission, teacher])
      await as(db, student)
      assert.equal(await submit(db), submission)
      const saved = (await db.query('SELECT id,status FROM submissions')).rows
      assert.deepEqual(saved, [{ id: submission, status: 'reviewed' }])
      assert.deepEqual((await db.query('SELECT text_content FROM pronunciation_messages')).rows, [{ text_content: 'Gut gelesen!' }])
    })
  } finally { await db.close() }
})
