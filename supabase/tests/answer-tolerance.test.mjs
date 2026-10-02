import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createCurrentDatabase, apply, actor, id, student, vocabularyUnit, result } from './helpers/current-db.mjs'

const migration = '56_answer_typographic_punctuation.sql'
const sentence = id(56001), noun = id(56002), sentenceProgress = id(56003), nounProgress = id(56004)
const unit = id(56100), node = id(56101)
const base = { target_form: ['Antwort'], instruction: 'Ergänze die Aufgabe.' }
const blank = { ...base, text_before: 'Das ist ', text_after: '.', correct_answer: 'das Haus.', accepted_answers: ['das Haus.'], needs_article: true }
const tasks = [
  ['fill_in_blank', blank, { text: 'DAS HAUS！' }],
  ['transform', { ...base, source: 'Du wohnst in Berlin.', accepted_answers: ['Wohnst du in Berlin?'] }, { text: 'wohnst du in berlin？' }],
  ['multi_blank', { ...base, text: 'Ich ___ in ___.', blanks: [{ id: 'verb', accepted_answers: ['wohne'] }, { id: 'city', accepted_answers: ['München.'] }] }, { values: { verb: 'WOHNE！', city: 'münchen。' } }],
  ['dialogue', { ...base, turns: [{ id: 'greeting', speaker: 'Anna', prompt: 'Hallo!', type: 'multiple_choice', options: ['Guten Tag!', 'Gute Nacht!'], correct_answer: 'Guten Tag!' }, { id: 'reply', speaker: 'Tom', prompt: 'Wo wohnst du?', type: 'fill_in_blank', accepted_answers: ['In München.'] }] }, { replies: { greeting: 0, reply: 'in münchen！' } }],
  ['listening', { ...base, transcript: 'Das Haus ist groß.', audio: { normal: '/audio/normal.wav', slow: '/audio/slow.wav' }, exercise: { type: 'fill_in_blank', content: blank } }, { text: 'DAS HAUS！' }],
  ['sentence_building', { ...base, parts: ['ICH', 'HEISSE', 'ANNA！'], correct_answer: 'Ich heiße Anna.', accepted_answers: ['Ich heiße Anna.'] }, { indices: [0, 1, 2] }],
]
const signatures = ['learning_private.normalize_answer(text)', 'learning_private.answer_without_punctuation(text)', 'learning_private.grade_answer(text,text[])']
const catalog = async db => (await db.query(`SELECT oid::regprocedure::text name,proowner,proacl::text acl,prosecdef,proconfig,
 pg_get_functiondef(oid) definition FROM pg_proc WHERE oid=ANY($1::regprocedure[]) ORDER BY 1`, [signatures])).rows
const snapshot = db => result(db, `SELECT jsonb_build_object(
 'cards',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM learning_vocabulary_cards c),
 'progress',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM vocabulary_direction_progress p),
 'receipts',(SELECT jsonb_agg(to_jsonb(r) ORDER BY request_id) FROM vocabulary_private.answer_receipts r)) result`)
const asStudent = async db => { await db.exec('RESET ROLE'); await actor(db, student) }

await test('answer tolerance on the complete current PostgreSQL schema', async t => {
  let previous, original
  const db = await createCurrentDatabase({ beforeLatest: async current => {
    for (const [card, isSentence] of [[sentence, true], [noun, false]]) {
      await current.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,article,sentence_practice) VALUES($1,$2,'Haus','das',$3)", [card, vocabularyUnit, isSentence])
      await current.query("INSERT INTO vocabulary_translations(card_id,locale,translation,context_sentence) VALUES($1,'de','Haus','Ich heiße Anna.'),($1,'ru','дом','Меня зовут Анна.')", [card])
    }
    for (const [progress, card] of [[sentenceProgress, sentence], [nounProgress, noun]])
      await current.query("INSERT INTO vocabulary_direction_progress(id,auth_user_id,card_id,direction,box_number,lapses,next_review_date) VALUES($1,$2,$3,'native_to_de',3,2,'2020-01-01')", [progress, student, card])
    await current.query("INSERT INTO learning_units(id,level,trainer,label,sort_order,is_path,path_source_id,path_slug,path_title) VALUES($1,'A1.1','exercises','Toleranz',1,true,'tolerance','tolerance','Toleranz')", [unit])
    await current.query("INSERT INTO path_objectives(unit_id,id,area,description) VALUES($1,'goal','grammar','Freie Texteingabe')", [unit])
    await current.query("INSERT INTO path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,merkkarte,goals) VALUES($1,$2,'tolerance-node','practice',1,'Toleranz','Sätze',$3,ARRAY['goal'])", [node, unit, { rule: 'Schreibe die Antwort.', examples: ['Das Haus.'] }])
    for (const [index, [type, content]] of tasks.entries())
      await current.query("INSERT INTO learning_exercises(id,unit_id,node_id,goal_id,source_ref,sort_order,topic,type,content) VALUES($1,$2,$3,'goal',$4,$5,'Toleranz',$6,$7)", [id(56200 + index), unit, node, `tolerance-${index}`, index + 1, type, content])
    previous = await catalog(current)
    original = await snapshot(current)
    assert.equal((await result(current, "SELECT learning_private.grade_answer('ich heiße anna！',ARRAY['Ich heiße Anna.']) result")).status, 'INCORRECT', 'reproduces the mobile punctuation gap before 56')
  } })
  const grade = (input, accepted) => result(db, 'SELECT learning_private.grade_answer($1,$2::text[]) result', [input, accepted])
  const makeDue = async progress => {
    await db.exec('RESET ROLE')
    await db.query("UPDATE vocabulary_direction_progress SET box_number=3,next_review_date='2020-01-01' WHERE id=$1", [progress])
    await db.query('DELETE FROM vocabulary_learning_state WHERE auth_user_id=$1', [student])
    await asStudent(db)
  }
  try {
    await t.test('migration preserves helper ownership, privileges and existing learner data', async () => {
      assert.deepEqual(await snapshot(db), original)
      const metadata = rows => rows.map(entry => Object.fromEntries(Object.entries(entry).filter(([key]) => key !== 'definition')))
      assert.deepEqual(metadata(await catalog(db)), metadata(previous))
      const current = await catalog(db)
      await apply(db, [migration])
      assert.deepEqual(await catalog(db), current)
      assert.deepEqual(await snapshot(db), original)
      const timestamped = await readFile(new URL('../migrations/20261002082422_answer_typographic_punctuation.sql', import.meta.url), 'utf8')
      assert.equal(timestamped, await readFile(new URL(`../vps/${migration}`, import.meta.url), 'utf8'))
    })
    await t.test('ordinary case/punctuation and localized typography are exact while numeric content stays meaningful', async () => {
      for (const [input, target, hint] of [
        ['ich heiße anna', 'Ich heiße Anna.', 'capitalization_punctuation'],
        ['ich heiße anna！', 'Ich heiße Anna.', 'capitalization_punctuation'],
        ['¿Wie geht es dir?', 'Wie geht es dir?', 'punctuation'],
        ['¡Hallo!', 'Hallo!', 'punctuation'],
        ['Ich lerne Deutsch。', 'Ich lerne Deutsch.', null],
        ['（Hallo）', 'Hallo', 'punctuation'],
        ['2，50 €', '2,50 €', null],
        ['12：30', '12:30', null],
        ['STRASSE', 'Straße', 'capitalization'],
        ['STRAẞE', 'Straße', 'capitalization'],
        ['STRASSE', 'STRAẞE', 'capitalization'],
        ['ICH HEISSE ANNA', 'Ich heiße Anna.', 'capitalization_punctuation'],
      ]) assert.deepEqual(await grade(input, [target]), { status: 'EXACT', matched: target, reason: null, hint }, input)
      for (const [input, target] of [['2，50 €', '250 €'], ['2．50 €', '250 €'], ['1230', '12:30'], ['50 %', '50'], ['50 + 2', '50 2'], ['1/2', '12'], ['A_123', 'A123'], ['der Haus', 'das Haus'], ['Haus', 'das Haus']])
        assert.equal((await grade(input, [target])).status, 'INCORRECT', `${input} / ${target}`)
      for (const input of ['strasse', 'StraSSe']) assert.equal((await grade(input, ['Straße'])).reason, 'umlaut', input)
    })
    await t.test('vocabulary scoring/retry accepts keyboard punctuation at the full review interval', async () => {
      for (const [index, typed] of ['ich heiße anna', 'ich heiße anna！', '¡ich heiße anna!', 'ICH HEISSE ANNA！'].entries()) {
        await makeDue(sentenceProgress)
        const answer = await result(db, "SELECT submit_vocabulary_answer_once($1,$2,false,$3,'ru') result", [id(56300 + index), sentenceProgress, typed])
        assert.equal(answer.isCorrect, true, JSON.stringify(answer))
        assert.equal(answer.softError, null)
        assert.equal(answer.hint, 'capitalization_punctuation')
        assert.equal(answer.newPhase, 4)
        assert.equal(answer.intervalInDays, 9)
        assert.deepEqual(await result(db, "SELECT submit_vocabulary_answer_once($1,$2,false,$3,'ru') result", [id(56300 + index), sentenceProgress, typed]), answer)
        const before = (await db.query('SELECT * FROM vocabulary_direction_progress WHERE id=$1', [sentenceProgress])).rows
        const retry = await result(db, "SELECT check_vocabulary_retry($1,'ICH HEISSE ANNA。','ru') result", [sentenceProgress])
        assert.equal(retry.isCorrect, true)
        assert.equal(retry.softError, null, 'fully uppercase SS is conventional German capitalization')
        const umlautRetry = await result(db, "SELECT check_vocabulary_retry($1,'Ich heisse Anna。','ru') result", [sentenceProgress])
        assert.equal(umlautRetry.softError, 'umlaut', 'mixed/lower-case ss retains the existing soft feedback')
        assert.deepEqual((await db.query('SELECT * FROM vocabulary_direction_progress WHERE id=$1', [sentenceProgress])).rows, before)
      }
    })
    await t.test('noun articles remain required despite case and localized punctuation tolerance', async () => {
      for (const [typed, correct, feedback] of [['DAS HAUS！', true, null], ['HAUS！', false, 'article_missing'], ['DER HAUS！', false, 'article_wrong']]) {
        await makeDue(nounProgress)
        const answer = await result(db, "SELECT submit_vocabulary_answer($1,false,$2,'ru') result", [nounProgress, typed])
        assert.equal(answer.isCorrect, correct, JSON.stringify(answer))
        assert.equal(answer.feedback, feedback)
      }
    })
    await t.test('the focus trainer also accepts typed case/punctuation without lowering its stage', async () => {
      await db.exec('RESET ROLE')
      await db.query("UPDATE vocabulary_focus_words SET status='active',stage=1,due_at=now()-interval '1 minute' WHERE auth_user_id=$1 AND card_id=$2", [student, noun])
      await asStudent(db)
      const response = await result(db, "SELECT submit_vocabulary_focus_answer($1,$2,'type','DAS HAUS！','ru') result", [id(56320), noun])
      assert.equal(response.correct, true, JSON.stringify(response))
      assert.equal(response.softError, null)
      assert.equal(response.stage, 2)
      assert.equal(response.feedback, null)
    })
    await t.test('every writing component completes a real learning path with full accuracy and stars', async () => {
      await asStudent(db)
      const run = await result(db, "SELECT start_path_node($1,'ru') result", [node])
      assert.ok(run.run_id, JSON.stringify(run))
      assert.equal(run.exercises.length, tasks.length)
      for (const [index, [type, , answer]] of tasks.entries()) {
        const response = await result(db, "SELECT submit_path_answer($1,$2,$3,$4,'ru') result", [run.run_id, id(56200 + index), answer, id(56400 + index)])
        assert.equal(response.grade?.status, 'EXACT', `${type}: ${JSON.stringify(response)}`)
        assert.ok(response.grade.fields.every(field => field.correct && field.reason !== 'typo' && field.reason !== 'umlaut'), type)
        assert.equal(Number(response.first_attempt_accuracy), 100 * (index + 1) / tasks.length)
        if (index === tasks.length - 1) {
          assert.equal(response.completed, true)
          assert.equal(response.stars, 3)
          assert.equal(Number(response.first_attempt_accuracy), 100)
        }
      }
    })
    await t.test('rollback/reapply restores the predecessor definitions and never rewrites learned state', async () => {
      await db.exec('RESET ROLE')
      const learned = await snapshot(db)
      const rollback = await readFile(new URL('../vps/rollback/56_answer_typographic_punctuation.sql', import.meta.url), 'utf8')
      await db.exec(`BEGIN;${rollback}COMMIT;`)
      assert.deepEqual(await catalog(db), previous)
      assert.deepEqual(await snapshot(db), learned)
      assert.equal((await grade('ich heiße anna！', ['Ich heiße Anna.'])).status, 'INCORRECT')
      await apply(db, [migration])
      assert.equal((await grade('ich heiße anna！', ['Ich heiße Anna.'])).status, 'EXACT')
      assert.deepEqual(await snapshot(db), learned)
      for (const role of ['anon', 'authenticated']) {
        await actor(db, student, role)
        await assert.rejects(db.query("SELECT learning_private.answer_without_punctuation('Hallo！')"), error => error.code === '42501')
        await db.exec('RESET ROLE')
      }
    })
  } finally { await db.close() }
})
