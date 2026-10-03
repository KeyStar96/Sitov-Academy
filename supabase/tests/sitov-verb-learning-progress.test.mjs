import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createCurrentDatabase, apply, actor, id, student, teacher, outsider, result } from './helpers/current-db.mjs'

test('Sitov verb analytics: actual receipts, cumulative stages, teacher authorization and preserved records', async t => {
  const db = await createCurrentDatabase()
  try {
    await db.exec("INSERT INTO cefr_levels VALUES('A2'),('B1'),('B2'),('C1') ON CONFLICT DO NOTHING; INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('A1.2','A1',2),('A2.1','A2',3),('A2.2','A2',4),('B1.1','B1',5),('B1.2','B1',6) ON CONFLICT DO NOTHING")
    for (const file of ['59_daily_quests.sql', '60_daily_quest_resume.sql', '61_account_learning_checkpoints.sql', '62_verb_trainer_enums.sql', '63_verb_trainer.sql']) await apply(db, [file])
    await actor(db, teacher)
    await result(db, "SELECT set_student_trainer_access($1,'B2','verbs',true,NULL,false) result", [student])
    await actor(db, student)
    await result(db, "SELECT sitov_set_verb_box('B2',ARRAY['sitov-verb-fahren','sitov-verb-sein','sitov-verb-haben'],true) result")
    await db.exec('RESET ROLE')
    for (const [n, tense, expected, answer] of [[65001, 'present', [['fährt']], ['fährt']], [65002, 'perfect', [['ist'], ['gefahren']], ['', '']]]) {
      await db.query("INSERT INTO sitov_verb_challenges(id,auth_user_id,verb_id,context_level,tense,expected,solution,created_at) VALUES($1,$2,'sitov-verb-fahren','B2',$3,$4,'fährt',now()-interval '1 day')", [id(n), student, tense, JSON.stringify(expected)])
      await actor(db, student)
      const receipt = await result(db, 'SELECT sitov_submit_verb_answer($1,$2) result', [id(n), JSON.stringify(answer)])
      assert.equal(receipt.correct, n === 65001)
      assert.deepEqual(await result(db, 'SELECT sitov_submit_verb_answer($1,$2) result', [id(n), JSON.stringify(answer)]), receipt)
      await db.exec('RESET ROLE')
    }
    await db.query("UPDATE sitov_verb_progress SET box=6 WHERE auth_user_id=$1 AND tense='present'", [student])
    await db.query("INSERT INTO learning_sessions(auth_user_id,mode,level,started_at,ended_at,answer_count,study_seconds) VALUES($1,'verbs','B2',now()-interval '2 minutes',now(),3,120)", [student])
    const snapshot = async () => {
      await db.exec('RESET ROLE')
      return result(db, `SELECT jsonb_build_object(
        'box',(SELECT jsonb_agg(to_jsonb(b) ORDER BY auth_user_id,verb_id) FROM sitov_verb_box b),
        'progress',(SELECT jsonb_agg(to_jsonb(p) ORDER BY auth_user_id,verb_id,tense) FROM sitov_verb_progress p),
        'receipts',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM sitov_verb_challenges c),
        'days',(SELECT jsonb_agg(to_jsonb(d) ORDER BY auth_user_id,day) FROM learning_activity_days d),
        'sessions',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM learning_sessions s)) result`)
    }
    const before = await snapshot()
    await apply(db, ['65_sitov_verb_learning_progress.sql'])
    assert.deepEqual(await snapshot(), before, 'migration reads progress without changing existing rows')
    const read = async (caller, target = null, level = 'B2', days = 7) => {
      await db.exec('RESET ROLE'); await actor(db, caller)
      return result(db, 'SELECT get_learning_progress($1,$2,$3) result', [target, level, days])
    }
    await t.test('a replay and a previous-day challenge are counted once on the actual answer day', async () => {
      const data = await read(student)
      assert.equal(data.success, true, JSON.stringify(data))
      assert.deepEqual(data.daily.at(-1).verbs, { answers: 2, correct: 1, seconds: 120,
        present: { answers: 1, correct: 1 }, perfect: { answers: 1, correct: 0 }, past: { answers: 0, correct: 0 } })
      assert.equal(data.daily.at(-2).verbs.answers, 0, 'creating a task is not answering it')
      assert.equal(data.daily.reduce((sum, day) => sum + day.verbs.answers, 0), 2)
      assert.equal((await read(student, null, 'A1.1')).daily.at(-1).verbs.answers, 0, 'history uses the practice context level')
    })
    await t.test('advanced grants include earlier allowed verbs with all current tenses, fresh and due forms', async () => {
      const data = await read(student)
      assert.equal(data.verbs.totalVerbs, 327, 'A1.1 + explicit B2; inaccessible levels stay outside the pool')
      assert.equal(data.verbs.inBox, 3); assert.equal(data.verbs.totalForms, 9)
      assert.equal(data.verbs.practicedForms, 2); assert.equal(data.verbs.confidentForms, 1); assert.equal(data.verbs.dueForms, 7)
      assert.deepEqual(data.verbs.buckets.map(bucket => bucket.count), [7, 1, 0, 0, 0, 0, 1, 0])
      assert.deepEqual(data.verbs.tenses.map(tense => tense.tense), ['present', 'perfect', 'past'])
      assert.deepEqual(data.verbs.tenses[0], { tense: 'present', totalForms: 3, practicedForms: 1, confidentForms: 1, dueForms: 2 })
      const all = await read(student, null, null)
      assert.deepEqual(all.verbs, data.verbs, 'all levels selects the highest authorized verb context')
      const base = await read(student, null, 'A1.1')
      assert.equal(base.verbs.totalForms, 3); assert.equal(base.verbs.tenses.length, 1)
    })
    await t.test('staff use the same analytics while peers and anonymous callers cannot read them', async () => {
      const own = await read(student)
      assert.deepEqual((await read(teacher, student)).verbs, own.verbs)
      assert.equal((await read(outsider, student)).error, 'not_authorized')
      assert.equal((await read(null)).error, 'not_authenticated')
      await actor(db, student)
      await assert.rejects(db.query('SELECT * FROM sitov_verb_challenges'), error => error.code === '42501')
      await db.exec('RESET ROLE')
      assert.equal((await db.query("SELECT has_function_privilege('anon','public.get_learning_progress(uuid,text,integer)','EXECUTE') allowed")).rows[0].allowed, false)
    })
    await t.test('changing the box and reapplying the migration preserve historical answers and learning state', async () => {
      await db.exec('RESET ROLE'); await actor(db, student)
      await result(db, "SELECT sitov_set_verb_box('B2',ARRAY['sitov-verb-fahren'],false) result")
      const removed = await read(student)
      assert.equal(removed.verbs.inBox, 2); assert.equal(removed.verbs.totalForms, 6)
      assert.equal(removed.daily.at(-1).verbs.answers, 2)
      await result(db, "SELECT sitov_set_verb_box('B2',ARRAY['sitov-verb-fahren'],true) result")
      const state = await snapshot()
      await apply(db, ['65_sitov_verb_learning_progress.sql'])
      assert.deepEqual(await snapshot(), state)
      assert.equal((await read(student)).verbs.confidentForms, 1)
    })
    await t.test('the native smoke script runs transactionally and leaves no fixture learning records', async () => {
      await db.exec('RESET ROLE')
      // Auth includes these columns natively; the small application fixture
      // omits them because ordinary learning tests never insert auth users.
      await db.exec("ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_app_meta_data jsonb DEFAULT '{}'; ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS aud text; ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS role text; ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS updated_at timestamptz")
      const state = await snapshot()
      const sql = await readFile(new URL('../../deploy/vps/tests/sitov-verb-learning-progress.sql', import.meta.url), 'utf8')
      await db.exec(sql.replace(/^\\set[^\n]*\n/gm, ''))
      assert.deepEqual(await snapshot(), state, 'native smoke rolled back every synthetic learning row')
    })
  } finally { await db.close() }
})
