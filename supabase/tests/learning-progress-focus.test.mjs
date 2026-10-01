import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCurrentDatabase, actor, id, student, teacher, outsider, vocabularyUnit, result } from './helpers/current-db.mjs'

// Migration 54 (Phase 11.3): Lernanalyse je Modus, angeschaute Medien und
// Problemwörter. Additiv: bestehende Lernstände, Quittungen, Lerntage und
// Sitzungen bleiben unverändert; die Rückschau liest nur vorhandene Zähler.

const LATEST = ['54_learning_progress_focus.sql']
const card = { haus: id(54001), tisch: id(54002), katze: id(54003), buch: id(54004), stuhl: id(54005), lampe: id(54006), fenster: id(54007), schnell: id(54008), own: id(54009), tuer: id(54010) }
const ownUnit = id(54100), videoUnit = id(54101), folder = id(54102), video = id(54103), presentation = id(54104), hiddenFolder = id(54105), hiddenAsset = id(54106)
const progressIds = new Map()
const progress = (cardId, direction, user = student) => {
  const key = `${user}:${cardId}:${direction}`
  if (!progressIds.has(key)) progressIds.set(key, id(56000 + progressIds.size))
  return progressIds.get(key)
}
let requestSequence = 55000
const nextRequest = () => id(requestSequence++)

const snapshot = db => result(db, `SELECT jsonb_build_object(
 'progress',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.vocabulary_direction_progress p),
 'receipts',(SELECT jsonb_agg(to_jsonb(r) ORDER BY auth_user_id,request_id) FROM vocabulary_private.answer_receipts r),
 'days',(SELECT jsonb_agg(to_jsonb(d) ORDER BY auth_user_id,day) FROM public.learning_activity_days d),
 'sessions',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM public.learning_sessions s),
 'cards',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM public.learning_vocabulary_cards c)) result`)

async function seed(db) {
  await db.exec('RESET ROLE')
  await db.query("UPDATE learning_units SET is_active=true WHERE id=$1", [vocabularyUnit])
  await db.query("INSERT INTO learning_units(id,level,trainer,label,owner_auth_user_id,is_active) VALUES($1,'A1.1','vocabulary','Eigene Wörter',$2,true)", [ownUnit, student])
  const cards = [[card.haus, 'Haus', 'das', vocabularyUnit, 'дом'], [card.tisch, 'Tisch', 'der', vocabularyUnit, 'стол'], [card.katze, 'Katze', 'die', vocabularyUnit, 'кошка'],
    [card.buch, 'Buch', 'das', vocabularyUnit, 'книга'], [card.stuhl, 'Stuhl', 'der', vocabularyUnit, 'стул'], [card.lampe, 'Lampe', 'die', vocabularyUnit, 'лампа'],
    [card.fenster, 'Fenster', 'das', vocabularyUnit, 'окно'], [card.schnell, 'schnell', null, vocabularyUnit, 'быстро'], [card.own, 'GEHEIMWORT', 'das', ownUnit, 'секрет'],
    [card.tuer, 'Tür', 'die', vocabularyUnit, 'дверь']]
  for (const [cardId, word, article, unit, translation] of cards) {
    await db.query('INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,article,sentence_practice) VALUES($1,$2,$3,$4,false)', [cardId, unit, word, article])
    for (const [locale, value] of [['de', word], ['ru', translation], ['en', translation], ['uk', translation], ['tr', translation]])
      await db.query('INSERT INTO vocabulary_translations(card_id,locale,translation) VALUES($1,$2,$3)', [cardId, locale, value])
  }
  // Lernstände wie im Live-Bestand: Fehlerzähler in beiden Richtungen.
  for (const [cardId, boxes, lapses, user] of [
    [card.haus, [2, 3], [2, 1], student], [card.tisch, [2, 2], [1, 1], student], [card.katze, [7, 7], [2, 2], student],
    [card.buch, [3, 3], [0, 0], student], [card.own, [1, 1], [2, 1], student], [card.haus, [1, 1], [3, 2], outsider],
  ]) for (const [index, direction] of ['native_to_de', 'de_to_native'].entries())
    await db.query("INSERT INTO vocabulary_direction_progress(id,auth_user_id,card_id,direction,box_number,lapses,next_review_date,last_answered_at) VALUES($1,$2,$3,$4,$5,$6,now()+interval '2 days',now()-interval '3 days')",
      [progress(cardId, direction, user), user, cardId, direction, boxes[index], lapses[index]])
  // Zwei Artikel-Fehler bei „Tisch" (Quittungen seit Migration 30).
  for (const offset of [0, 1])
    await db.query("INSERT INTO vocabulary_private.answer_receipts(auth_user_id,request_id,progress_id,is_correct,typed_answer,ui_language,response,created_at) VALUES($1,$2,$3,false,'die Tisch','ru',$4,now()-interval '2 days'-($5||' hours')::interval)",
      [student, id(54200 + offset), progress(card.tisch, 'native_to_de'), { success: true, isCorrect: false, feedback: 'article_wrong' }, offset])
}

async function fixture() {
  let before
  const db = await createCurrentDatabase({ latest: LATEST, beforeLatest: async current => { await seed(current); before = await snapshot(current) } })
  return { db, before }
}
const scenario = (name, fn) => test(`learning progress & focus: ${name}`, async () => {
  const { db, before } = await fixture()
  try { await fn(db, before) } finally { await db.close() }
})
const as = async (db, user) => { await db.exec('RESET ROLE'); await actor(db, user ?? null) }
// Upload-Prüfungen (Storage) und Absender-Trigger gehören nicht zu diesem Test.
const raw = async (db, work) => { await db.exec('RESET ROLE'); await db.exec('SET session_replication_role=replica'); try { await work() } finally { await db.exec('SET session_replication_role=origin') } }
const focusRow = async (db, cardId, user = student) => { await db.exec('RESET ROLE'); return (await db.query('SELECT * FROM vocabulary_focus_words WHERE auth_user_id=$1 AND card_id=$2', [user, cardId])).rows[0] }
const focus = async (db, level = 'A1.1', lang = 'ru', user = student) => { await as(db, user); return result(db, 'SELECT get_vocabulary_focus($1,$2) result', [level, lang]) }
const answer = async (db, cardId, format, value, request = nextRequest(), user = student) => {
  await as(db, user)
  return result(db, 'SELECT submit_vocabulary_focus_answer($1,$2,$3,$4,$5) result', [request, cardId, format, value, 'ru'])
}
const makeDue = async (db, cardId) => { await db.exec('RESET ROLE'); await db.query("UPDATE vocabulary_focus_words SET due_at=now()-interval '1 minute' WHERE auth_user_id=$1 AND card_id=$2", [student, cardId]) }
const receipt = async (db, cardId, response, direction = 'native_to_de', user = student, at = 'now()') => {
  await db.exec('RESET ROLE')
  await db.query(`INSERT INTO vocabulary_private.answer_receipts(auth_user_id,request_id,progress_id,is_correct,typed_answer,ui_language,response,created_at) VALUES($1,$2,$3,null,'x','ru',$4,${at})`,
    [user, nextRequest(), progress(cardId, direction, user), response])
}
const read = async (db, caller, target, level = null, days = 30) => { await as(db, caller); return result(db, 'SELECT get_learning_progress($1,$2,$3) result', [target, level, days]) }

scenario('backfill reads existing error counters and article receipts without touching live rows', async (db, before) => {
  assert.deepEqual(await snapshot(db), before)
  const haus = await focusRow(db, card.haus), tisch = await focusRow(db, card.tisch), katze = await focusRow(db, card.katze)
  assert.equal(haus.status, 'active'); assert.equal(haus.wrong_count, 3); assert.equal(haus.stage, 0)
  assert.equal(tisch.status, 'active'); assert.equal(tisch.article_errors, 2); assert.equal(tisch.wrong_count, 2)
  assert.equal(katze.status, 'watching', 'learned in both directions: noted, not trained')
  assert.equal(await focusRow(db, card.buch), undefined)
  assert.equal((await focusRow(db, card.own)).status, 'active')
  assert.equal((await focusRow(db, card.haus, outsider)).wrong_count, 5)
})

scenario('focus queue follows trainer access and picks a format per stage and reason', async db => {
  assert.equal((await focus(db, 'A1.1', 'de')).error, 'invalid_learning_language')
  await as(db, null)
  assert.equal((await result(db, "SELECT get_vocabulary_focus('A1.1','ru') result")).error, 'not_authenticated')
  const data = await focus(db)
  assert.equal(data.success, true, JSON.stringify(data))
  assert.deepEqual({ active: data.summary.active, due: data.summary.due, mastered: data.summary.mastered, articleWords: data.summary.articleWords }, { active: 3, due: 3, mastered: 0, articleWords: 1 })
  const items = Object.fromEntries(data.items.map(item => [item.cardId, item]))
  assert.equal(items[card.tisch].format, 'article'); assert.deepEqual(items[card.tisch].options, ['der', 'die', 'das'])
  assert.ok(data.words.filter(word => word.status === 'active').every(word => word.due === true), 'fällig: in PostgreSQL entschieden')
  assert.equal(items[card.tisch].word, 'Tisch'); assert.deepEqual(items[card.tisch].reasons, ['article'])
  assert.equal(items[card.haus].format, 'choice'); assert.equal(items[card.haus].prompt, 'дом')
  assert.equal(items[card.haus].options.length, 4); assert.ok(items[card.haus].options.includes('das Haus'))
  assert.equal(new Set(items[card.haus].options.map(value => value.toLowerCase())).size, 4)
  assert.ok(items[card.haus].options.every(value => /^(der|die|das) /.test(value)), 'distractors are nouns like the target')
  assert.equal(JSON.stringify(data.items).includes('"solution"'), false)
  // Die fremde Person hat keinen Zugang zu A1.1: nichts zu trainieren.
  assert.equal((await focus(db, 'A1.1', 'ru', outsider)).summary.active, 0)
})

scenario('spaced repetition ladder: wrong resets, correct climbs 1 → 3 → 7 days, then mastered', async db => {
  const wrong = await answer(db, card.tisch, 'article', 'die')
  assert.equal(wrong.correct, false); assert.equal(wrong.stage, 0); assert.equal(wrong.solution.article, 'der')
  const request = nextRequest()
  const right = await answer(db, card.tisch, 'article', 'der', request)
  assert.equal(right.correct, true); assert.equal(right.stage, 1)
  assert.deepEqual(await answer(db, card.tisch, 'article', 'der', request), right, 'idempotent replay')
  assert.equal((await answer(db, card.tisch, 'type', 'der Tisch', request)).error, 'conflict')
  assert.equal((await answer(db, card.tisch, 'article', 'der')).error, 'review_not_due')
  await db.exec('RESET ROLE')
  const tomorrow = (await db.query("SELECT due_at=vocabulary_private.review_day(1) ok FROM vocabulary_focus_words WHERE auth_user_id=$1 AND card_id=$2", [student, card.tisch])).rows[0].ok
  assert.equal(tomorrow, true)
  await makeDue(db, card.tisch)
  const missing = await answer(db, card.tisch, 'type', 'Tisch')
  assert.equal(missing.correct, false); assert.equal(missing.feedback, 'article_missing'); assert.equal(missing.stage, 0)
  for (const [format, value, stage] of [['article', 'der', 1], ['type', 'der Tisch', 2], ['article', 'der', 3]]) {
    await makeDue(db, card.tisch)
    const response = await answer(db, card.tisch, format, value)
    assert.equal(response.correct, true, format); assert.equal(response.stage, stage)
  }
  await makeDue(db, card.tisch)
  const mastered = await answer(db, card.tisch, 'type', 'der Tisch')
  assert.equal(mastered.status, 'mastered'); assert.equal(mastered.dueAt, null)
  const row = await focusRow(db, card.tisch)
  assert.equal(row.status, 'mastered'); assert.equal(row.practice_count, 7); assert.equal(row.practice_correct, 5)
  assert.equal((await db.query('SELECT count(*)::int n FROM vocabulary_private.focus_receipts WHERE auth_user_id=$1', [student])).rows[0].n, 7)
  assert.equal((await focus(db)).summary.mastered, 1)
  // Rückfall im Vokabeltrainer: wieder aktiv, Stufe 0.
  await receipt(db, card.tisch, { success: true, isCorrect: false, feedback: 'article_wrong' })
  const relapse = await focusRow(db, card.tisch)
  assert.equal(relapse.status, 'active'); assert.equal(relapse.stage, 0); assert.equal(relapse.article_errors, 3)
})

scenario('build and choice are graded on the server; access and ownership are enforced', async db => {
  await db.exec('RESET ROLE')
  await db.query('UPDATE vocabulary_focus_words SET stage=1 WHERE auth_user_id=$1 AND card_id=$2', [student, card.haus])
  const item = (await focus(db)).items.find(entry => entry.cardId === card.haus)
  assert.equal(item.format, 'build'); assert.equal(item.article, 'das')
  assert.deepEqual([...item.letters].sort(), ['H', 'a', 's', 'u'].sort()); assert.notEqual(item.letters.join(''), 'Haus')
  assert.equal((await answer(db, card.haus, 'build', 'Hasu')).correct, false)
  await makeDue(db, card.haus)
  assert.equal((await answer(db, card.haus, 'choice', 'das haus')).correct, true)
  assert.equal((await answer(db, card.schnell, 'choice', 'schnell')).error, 'not_found', 'no focus row')
  // Die fremde Person hat ein eigenes aktives „Haus", aber keinen Zugang zum Niveau.
  assert.equal((await answer(db, card.haus, 'choice', 'das Haus', nextRequest(), outsider)).error, 'trainer_access_denied')
  assert.equal((await answer(db, card.haus, 'type', '   ')).error, 'answer_required')
  assert.equal((await answer(db, card.haus, 'other', 'x')).error, 'invalid_input')
})

scenario('trainer receipts promote words; resets archive and restart counting', async db => {
  for (let index = 0; index < 2; index++) await receipt(db, card.buch, { success: true, isCorrect: false })
  assert.equal((await focusRow(db, card.buch)).status, 'watching')
  await receipt(db, card.buch, { success: true, isCorrect: true, becameLearned: false })
  assert.equal((await focusRow(db, card.buch)).wrong_count, 2, 'correct answers do not count')
  await receipt(db, card.buch, { success: true, isCorrect: false })
  assert.equal((await focusRow(db, card.buch)).status, 'active')
  // Die echte Antwort-Funktion läuft mit dem Trigger weiter.
  await as(db, student)
  await result(db, 'SELECT initialize_vocabulary_cards($1) result', [JSON.stringify([{ cardId: card.lampe, alreadyKnown: false }])])
  await db.exec('RESET ROLE')
  const lampe = (await db.query("SELECT id FROM vocabulary_direction_progress WHERE auth_user_id=$1 AND card_id=$2 AND direction='native_to_de'", [student, card.lampe])).rows[0].id
  await db.query("UPDATE vocabulary_direction_progress SET next_review_date=now()-interval '1 day' WHERE id=$1", [lampe])
  await db.query('DELETE FROM vocabulary_learning_state WHERE auth_user_id=$1', [student])
  await as(db, student)
  const submitted = await result(db, "SELECT submit_vocabulary_answer_once($1,$2,NULL,'der Lampe','ru') result", [nextRequest(), lampe])
  assert.equal(submitted.success, true, JSON.stringify(submitted)); assert.equal(submitted.isCorrect, false)
  const lampeRow = await focusRow(db, card.lampe)
  assert.equal(lampeRow.wrong_count, 1); assert.equal(lampeRow.article_errors, 1)
  // Lernstand der Karte zurückgesetzt: archivieren statt löschen.
  await db.exec('RESET ROLE')
  await db.query('DELETE FROM vocabulary_direction_progress WHERE auth_user_id=$1 AND card_id=$2', [student, card.haus])
  assert.equal((await focusRow(db, card.haus)).status, 'archived')
  assert.equal((await focus(db)).words.some(word => word.cardId === card.haus), false)
  assert.equal((await focusRow(db, card.haus, outsider)).status, 'active', 'other learners are untouched')
})

scenario('media views follow library read rights and count once per object and day', async db => {
  await raw(db, async () => {
    await db.exec("INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('A1.2','A1',2) ON CONFLICT DO NOTHING")
    await db.query("INSERT INTO learning_units(id,level,trainer,label,is_active) VALUES($1,'A1.1','videos','Videos',true)", [videoUnit])
    await db.query("INSERT INTO lms_media_folder(folder_id,level,title) VALUES($1,'A1.1','Woche 1'),($2,'A1.2','Woche 9')", [folder, hiddenFolder])
    await db.query("INSERT INTO learning_videos(id,unit_id,folder_id,title,storage_path,file_size) VALUES($1,$2,$3,'Begrüßung',$4,1000)", [video, videoUnit, folder, `A1.1/${folder}/videos/${video}.mp4`])
    await db.query("INSERT INTO lms_presentation_asset(asset_id,folder_id,file_name,storage_path,mime_type,file_size) VALUES($1,$2,'Folien.pdf',$3,'application/pdf',100),($4,$5,'Geheim.pdf',$6,'application/pdf',100)",
      [presentation, folder, `A1.1/${folder}/presentations/${presentation}.pdf`, hiddenAsset, hiddenFolder, `A1.2/${hiddenFolder}/presentations/${hiddenAsset}.pdf`])
  })
  const record = async (user, kind, objectId) => { await as(db, user); return result(db, 'SELECT record_media_view($1,$2) result', [kind, objectId]) }
  assert.equal((await record(student, 'video', video)).recorded, true)
  assert.equal((await record(student, 'video', video)).recorded, true)
  assert.equal((await record(student, 'presentation', presentation)).recorded, true)
  assert.equal((await record(student, 'presentation', hiddenAsset)).error, 'not_found', 'folder of a locked level')
  assert.equal((await record(outsider, 'video', video)).error, 'not_found')
  assert.equal((await record(teacher, 'video', video)).recorded, false)
  assert.equal((await record(student, 'audio', video)).error, 'invalid_input')
  await db.exec('RESET ROLE')
  const rows = (await db.query('SELECT kind,view_count,level FROM learning_media_views WHERE auth_user_id=$1 ORDER BY kind', [student])).rows
  assert.deepEqual(rows, [{ kind: 'presentation', view_count: 1, level: 'A1.1' }, { kind: 'video', view_count: 2, level: 'A1.1' }])
  const data = await read(db, student, null)
  assert.equal(data.daily.at(-1).media.views, 2)
  assert.equal(data.media.totalMedia, 2); assert.equal(data.media.viewedMedia, 2)
  assert.deepEqual(data.media.recent.map(item => item.title).sort(), ['Begrüßung', 'Folien.pdf'])
  await as(db, student)
  await assert.rejects(db.query("INSERT INTO learning_media_views(auth_user_id,day,kind,object_id,level) VALUES($1,current_date,'video',$2,'A1.1')", [student, video]))
})

scenario('learning progress: daily values per mode, authorization and privacy of own words', async db => {
  await receipt(db, card.haus, { success: true, isCorrect: true })
  await receipt(db, card.haus, { success: true, isCorrect: true }, 'de_to_native')
  await receipt(db, card.buch, { success: true, isCorrect: false })
  // „Katze" war schon gelernt; ohne Quittung bleibt der Lerntag unbekannt.
  await raw(db, async () => {
    await db.query("INSERT INTO submissions(id,auth_user_id,type,content_url,level) VALUES($1,$2,'audio','a.webm','A1.1')", [id(54300), student])
    await db.query("INSERT INTO pronunciation_messages(submission_id,sender_id,sender_role,text_content) VALUES($1,$2,'teacher','Gut!')", [id(54300), teacher])
  })
  await answer(db, card.tisch, 'article', 'der')

  assert.equal((await read(db, null, null)).error, 'not_authenticated')
  assert.equal((await read(db, student, outsider)).error, 'not_authorized')
  assert.equal((await read(db, teacher, teacher)).error, 'not_found')
  assert.equal((await read(db, teacher, null)).error, 'not_found', 'staff have no own learning progress')
  assert.equal((await read(db, teacher, student, null, 5)).error, 'invalid_input')
  assert.equal((await read(db, teacher, student, 'B9.9')).error, 'not_found')

  const own = await read(db, student, null, null, 7)
  assert.equal(own.success, true); assert.equal(own.daily.length, 7); assert.equal(own.timezone, 'Europe/Berlin')
  const today = own.daily.at(-1)
  assert.equal(today.date, own.today)
  assert.deepEqual(today.vocabulary.answers, 3); assert.equal(today.vocabulary.correct, 2)
  assert.deepEqual(today.focus, { answers: 1, correct: 1 })
  assert.deepEqual({ recordings: today.pronunciation.recordings, replies: today.pronunciation.replies }, { recordings: 1, replies: 1 })
  assert.equal(own.pronunciation.awaitingReply, 0); assert.equal(own.pronunciation.recordings, 1)
  // Zwei Artikel-Fehler vor zwei Tagen gehören in den Zeitraum.
  assert.equal(own.daily.at(-3).vocabulary.answers, 2); assert.equal(own.daily.at(-3).vocabulary.correct, 0)
  assert.equal(own.vocabulary.learnedWords, 1); assert.equal(own.vocabulary.learnedTotal, 1)
  assert.equal(own.daily.reduce((sum, day) => sum + day.vocabulary.learned, 0), 0)
  assert.ok(own.focus.words.some(word => word.word === 'GEHEIMWORT'), 'learners see their own words')

  const staff = await read(db, teacher, student, 'A1.1', 90)
  assert.equal(staff.daily.length, 90); assert.equal(staff.level, 'A1.1')
  assert.equal(staff.focus.words.some(word => word.word === 'GEHEIMWORT'), false, 'own words stay private')
  assert.equal(staff.focus.active, 3, 'counts still include them')
  assert.equal(staff.focus.words.find(word => word.word === 'Tisch').due, false, 'heute richtig geübt: erst morgen wieder fällig')
  assert.equal(staff.focus.words.find(word => word.word === 'Haus').due, true)
  assert.equal(staff.vocabulary.totalWords, 10)
  assert.equal(staff.vocabulary.buckets.length, 7)

  // Lerntag der zweiten Richtung = Tag, an dem das Wort gelernt ist.
  await db.exec('RESET ROLE')
  await db.query("UPDATE vocabulary_direction_progress SET box_number=7 WHERE auth_user_id=$1 AND card_id=$2", [student, card.buch])
  await receipt(db, card.buch, { success: true, isCorrect: true, becameLearned: true }, 'native_to_de', student, "now()-interval '1 day'")
  await receipt(db, card.buch, { success: true, isCorrect: true, becameLearned: true }, 'de_to_native')
  const learned = await read(db, student, null, null, 7)
  assert.equal(learned.daily.at(-1).vocabulary.learned, 1); assert.equal(learned.vocabulary.learnedTotal, 2)
})

scenario('clients can only read; writes go through the functions', async db => {
  await as(db, student)
  for (const statement of [
    "UPDATE vocabulary_focus_words SET status='mastered'",
    'DELETE FROM vocabulary_focus_words',
    `INSERT INTO vocabulary_focus_words(auth_user_id,card_id) VALUES('${student}','${card.buch}')`,
    'SELECT * FROM vocabulary_private.focus_receipts',
  ]) await assert.rejects(db.query(statement), statement)
  const visible = (await db.query('SELECT DISTINCT auth_user_id FROM vocabulary_focus_words')).rows.map(row => row.auth_user_id)
  assert.deepEqual(visible, [student], 'RLS: only own rows')
  await as(db, teacher)
  assert.ok((await db.query('SELECT count(*)::int n FROM vocabulary_focus_words')).rows[0].n >= 4, 'staff read all learners')
})
