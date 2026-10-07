import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createCurrentDatabase, currentFeatureMigrations, apply, actor, id, student, teacher, outsider, vocabularyUnit, result } from './helpers/current-db.mjs'

const migration = '90_sitov_pronunciation_recall_evidence.sql'
const canonical = '20261007193204_sitov_pronunciation_recall_evidence.sql'
const sql = name => readFile(new URL(`../vps/${name}`, import.meta.url), 'utf8')
const owner = async db => { await db.exec('RESET ROLE'); await db.query("SELECT set_config('request.jwt.claim.sub','',false)") }
const as = async (db, learner, role = 'authenticated') => { await db.exec('RESET ROLE'); await actor(db, learner, role) }
const readiness = (db, learner = null) => result(db, 'SELECT sitov_get_pronunciation_readiness($1,$2) result', ['A1.1', learner])
const pathUnit = id(90500), promptUnit = id(90501), prompt = id(90502)
const words = ['Mann', ...Array.from({ length: 29 }, (_, i) => `Wort${String.fromCharCode(65 + i)}`)]

await test('pronunciation readiness accepts actual typed-German and reverse-flashcard evidence without changing history', async t => {
  const db = await createCurrentDatabase({ latest: [...currentFeatureMigrations, '59_daily_quests.sql', '60_daily_quest_resume.sql', '61_account_learning_checkpoints.sql'] })
  try {
    await apply(db, ['62_verb_trainer_enums.sql'])
    await db.exec((await sql('63_verb_trainer.sql')).split('-- BEGIN SITOV VERB CATALOG SEED')[0])
    await apply(db, ['66_sitov_pronunciation_readiness.sql'])
    await db.query("INSERT INTO learning_units(id,level,trainer,label,sort_order,is_path,path_source_id,path_slug,path_title) VALUES($1,'A1.1','exercises','Lernpfad',1,true,'sitov-recall-path','sitov-recall-path','Lernpfad')", [pathUnit])
    await db.query("INSERT INTO path_objectives(unit_id,id,area,description) VALUES($1,'goal','grammar','Grammatik')", [pathUnit])
    for (let i = 0; i < 2; i++) {
      await db.query("INSERT INTO path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,goals,merkkarte) VALUES($1,$2,$3,'practice',$4,'Grammatik','Grammatik',ARRAY['goal'],'{\"rule\":\"Eine Regel\",\"examples\":[\"Ein Beispiel\"]}')", [id(90600 + i), pathUnit, `sitov-recall-node-${i}`, i + 1])
      await db.query("INSERT INTO path_node_progress(auth_user_id,node_id,status,best_stars,completed_at) VALUES($1,$2,'completed',2,now())", [student, id(90600 + i)])
    }
    await db.query("INSERT INTO learning_units(id,level,trainer,label) VALUES($1,'A1.1','pronunciation','Der Mann')", [promptUnit])
    await db.query("INSERT INTO learning_reading_texts(id,unit_id,sentence_de) VALUES($1,$2,'Der Mann.')", [prompt, promptUnit])
    for (let i = 0; i < 3; i++) {
      await db.query("INSERT INTO learning_units(id,level,trainer,label) VALUES($1,'A1.1','verbs',$2)", [id(90700 + i), `Verb ${i}`])
      await db.query("INSERT INTO sitov_verb_catalog VALUES($1,$2,'A1.1')", [`sitov-verb-recall-${i}`, id(90700 + i)])
      await db.query("INSERT INTO sitov_verb_progress(auth_user_id,verb_id,tense,box,attempts,correct) VALUES($1,$2,'present',3,3,3)", [student, `sitov-verb-recall-${i}`])
    }
    const progressIds = []
    for (let i = 0; i < words.length; i++) {
      const card = id(90800 + i)
      await db.query('INSERT INTO learning_vocabulary_cards(id,unit_id,word_de) VALUES($1,$2,$3)', [card, vocabularyUnit, words[i]])
      await db.query("INSERT INTO vocabulary_translations(card_id,locale,translation) VALUES($1,'ru','слово')", [card])
      for (const direction of ['native_to_de', 'de_to_native']) {
        const row = (await db.query("INSERT INTO vocabulary_direction_progress(auth_user_id,card_id,direction,box_number,next_review_date) VALUES($1,$2,$3,2,'2020-01-01') RETURNING id", [student, card, direction])).rows[0]
        progressIds.push({ card, direction, id: row.id, word: words[i], index: i })
      }
    }
    // These are real grading RPCs. German -> native creates a self-rating
    // receipt with no typed answer, exactly as the current trainer UI does.
    await as(db, student)
    for (const item of progressIds.filter(row => row.direction === 'native_to_de')) {
      const graded = await result(db, 'SELECT submit_vocabulary_answer_once($1,$2,NULL,$3,$4) result', [id(90900 + item.index), item.id, item.word, 'ru'])
      assert.equal(graded.isCorrect, true, JSON.stringify(graded))
      assert.equal(graded.newPhase, 3)
    }
    for (const item of progressIds.filter(row => row.direction === 'de_to_native')) {
      const rated = await result(db, 'SELECT submit_vocabulary_self_rating_once($1,$2,true,$3) result', [id(91000 + item.index), item.id, 'ru'])
      assert.equal(rated.isCorrect, true, JSON.stringify(rated))
      assert.equal(rated.newPhase, 3)
    }
    assert.equal((await readiness(db)).stats.knownWords, 0, 'the old estimate incorrectly demands typing in the flashcard direction')
    const snapshot = async () => {
      await owner(db)
      return result(db, `SELECT jsonb_build_object(
        'progress',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM vocabulary_direction_progress p),
        'receipts',(SELECT jsonb_agg(to_jsonb(r) ORDER BY request_id) FROM vocabulary_private.answer_receipts r),
        'verbs',(SELECT jsonb_agg(to_jsonb(v) ORDER BY verb_id,tense) FROM sitov_verb_progress v),
        'path',(SELECT jsonb_agg(to_jsonb(p) ORDER BY node_id) FROM path_node_progress p),
        'activity',(SELECT jsonb_agg(to_jsonb(a) ORDER BY auth_user_id,day) FROM learning_activity_days a),
        'access',(SELECT jsonb_agg(to_jsonb(a) ORDER BY auth_user_id,level) FROM sitov_pronunciation_access a)) result`)
    }
    const before = await snapshot()

    await t.test('normal graded practice unlocks the first text and preserves all learner and audit rows', async () => {
      assert.equal(await sql(migration), await readFile(new URL(`../migrations/${canonical}`, import.meta.url), 'utf8'))
      await apply(db, [migration])
      assert.deepEqual(await snapshot(), before)
      await as(db, student)
      const state = await readiness(db)
      assert.equal(state.stats.knownWords, 30)
      assert.equal(state.stats.grammarNodes, 2)
      assert.equal(state.stats.confidentVerbForms, 3)
      assert.equal(state.tier, 1)
      assert.equal(state.texts.find(row => row.id === prompt).ready, true)
      assert.equal(state.texts.find(row => row.id === prompt).coveragePercent, 100)
      assert.deepEqual((await db.query('SELECT id FROM learning_reading_texts')).rows.map(row => row.id), [prompt])
      await owner(db)
      const reverse = (await db.query('SELECT typed_answer,response FROM vocabulary_private.answer_receipts WHERE request_id=$1', [id(91000)])).rows[0]
      assert.equal(reverse.typed_answer, null)
      assert.equal(reverse.response.isCorrect, true)
    })

    await t.test('both directions must remain at phase 3 and missing/failed typed recall gives no credit', async () => {
      const first = progressIds.find(row => row.index === 0 && row.direction === 'de_to_native')
      const check = async expected => { await as(db, student); assert.equal((await readiness(db)).stats.knownWords, expected); await owner(db) }
      await owner(db)
      await db.query('UPDATE vocabulary_direction_progress SET box_number=2 WHERE id=$1', [first.id])
      await check(29)
      await db.query('UPDATE vocabulary_direction_progress SET box_number=3 WHERE id=$1', [first.id])
      await db.query("UPDATE vocabulary_private.answer_receipts SET typed_answer='' WHERE request_id=$1", [id(90900)])
      await check(29)
      await db.query("UPDATE vocabulary_private.answer_receipts SET typed_answer='Mann',response=jsonb_set(response,'{isCorrect}','false') WHERE request_id=$1", [id(90900)])
      await check(29)
      await db.query("UPDATE vocabulary_private.answer_receipts SET response=jsonb_set(response,'{isCorrect}','true')-'correctAnswer' WHERE request_id=$1", [id(90900)])
      await check(29)
      const receipt = before.receipts.find(row => row.request_id === id(90900))
      await db.query('UPDATE vocabulary_private.answer_receipts SET typed_answer=$2,response=$3 WHERE request_id=$1', [id(90900), receipt.typed_answer, JSON.stringify(receipt.response)])
      await check(30)
    })

    await t.test('self-rated mastery alone is insufficient and receipts stay private', async () => {
      const card = id(91100)
      await owner(db)
      await db.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de) VALUES($1,$2,'Park')", [card, vocabularyUnit])
      await db.query("INSERT INTO vocabulary_direction_progress(auth_user_id,card_id,direction,box_number) SELECT $1,$2,direction::public.vocabulary_direction,6 FROM unnest(ARRAY['native_to_de','de_to_native']) direction", [student, card])
      await as(db, student)
      assert.equal((await readiness(db)).stats.knownWords, 30, 'assessment/self-ratings have no successful typed receipt')
      await assert.rejects(db.query('SELECT * FROM vocabulary_private.answer_receipts'), error => error.code === '42501')
      await assert.rejects(db.query('SELECT sitov_pronunciation_private.evidence($1)', [student]), error => error.code === '42501')
      await as(db, outsider)
      await assert.rejects(readiness(db, student), error => error.code === '42501')
      await as(db, teacher)
      assert.equal((await readiness(db, student)).stats.knownWords, 30)
      await as(db, null, 'anon')
      await assert.rejects(readiness(db), error => error.code === '42501')
    })

    await t.test('replay and rollback only change the estimate; native smoke leaves no synthetic learners', async () => {
      const latest = await snapshot()
      await apply(db, [migration])
      assert.deepEqual(await snapshot(), latest)
      await db.exec(await sql(`rollback/${migration}`))
      assert.deepEqual(await snapshot(), latest)
      await as(db, student)
      assert.equal((await readiness(db)).stats.knownWords, 0)
      await owner(db)
      await apply(db, [migration])
      assert.deepEqual(await snapshot(), latest)
      const acl = (await db.query("SELECT prosecdef,proconfig,has_function_privilege('anon',oid,'EXECUTE') anon,has_function_privilege('authenticated',oid,'EXECUTE') learner FROM pg_proc WHERE oid='sitov_pronunciation_private.evidence(uuid)'::regprocedure")).rows[0]
      assert.equal(acl.prosecdef, true)
      assert.equal(acl.anon, false)
      assert.equal(acl.learner, false)
      assert.ok(acl.proconfig.some(value => value.startsWith('search_path=')))
      await db.exec("ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_app_meta_data jsonb DEFAULT '{}'; ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS aud text; ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS role text; ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS updated_at timestamptz")
      const users = (await db.query('SELECT count(*)::int n FROM auth.users')).rows[0].n
      const smoke = await readFile(new URL('../../deploy/vps/tests/sitov-pronunciation-recall-evidence.sql', import.meta.url), 'utf8')
      await db.exec(smoke.replace(/^\\set[^\n]*\n/gm, ''))
      assert.equal((await db.query('SELECT count(*)::int n FROM auth.users')).rows[0].n, users)
      assert.deepEqual(await snapshot(), latest)
    })
  } finally { await db.close() }
})
