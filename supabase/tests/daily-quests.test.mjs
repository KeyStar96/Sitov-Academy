import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createCurrentDatabase, currentFeatureMigrations, actor, id, student, teacher, outsider, vocabularyUnit, result } from './helpers/current-db.mjs'

const migrations = [...currentFeatureMigrations, '59_daily_quests.sql', '60_daily_quest_resume.sql']
const as = (db, user) => actor(db, user)
const rpc = (db, sql, params = []) => result(db, `SELECT ${sql} result`, params)
const quest = async db => { await as(db, student); return (await rpc(db, 'get_daily_quest()')).quest }
const submit = (db, assignment, step, answer) => rpc(db, 'submit_daily_quest_step($1,$2,$3)', [assignment, step, answer])
const finishSteps = async (db, assignment) => {
  await as(db, student)
  await db.exec('RESET ROLE')
  const keys = (await db.query('SELECT answer_key FROM daily_quest_private.assignment_keys WHERE assignment_id=$1', [assignment])).rows[0].answer_key
  await as(db, student)
  assert.equal((await submit(db, assignment, 'discover', { wordIds: ['food', 'coffee', 'bag'] })).correct, true)
  assert.equal((await submit(db, assignment, 'build', { pieceIds: keys.steps.build.accepted[0] })).correct, true)
  assert.equal((await submit(db, assignment, 'dialogue', { optionId: keys.steps.dialogue.optionId })).correct, true)
}
const scenario = (name, fn) => test(`daily quests: ${name}`, async () => {
  let db
  try { db = await createCurrentDatabase({ latest: migrations }); await fn(db) }
  catch (error) { delete error.query; throw error }
  finally { await db?.close() }
})
const today = async db => { await db.exec('RESET ROLE'); return (await db.query('SELECT daily_quest_private.today()::text AS quest_day')).rows[0].quest_day }
const moveDay = async (db, date) => {
  await db.exec('RESET ROLE')
  // Test-owned clock only; no production RPC accepts a client date or streak.
  await db.exec(`CREATE OR REPLACE FUNCTION daily_quest_private.today() RETURNS date LANGUAGE sql STABLE SET search_path TO '' AS $$ SELECT '${date}'::date $$`)
}
const plusDays = (date, n) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
const addLevelTest = async (db, level, offset, score = null, user = student) => {
  await db.exec('RESET ROLE')
  await db.query('INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [level, level.split('.')[0], 100 + offset])
  await db.query('INSERT INTO student_level_access(auth_user_id,level) VALUES($1,$2) ON CONFLICT DO NOTHING', [student, level])
  const unit = id(59000 + offset), node = id(59100 + offset)
  await db.query("INSERT INTO learning_units(id,level,trainer,label,sort_order,is_path,path_source_id,path_slug,path_title) VALUES($1,$2,'exercises',$5, $3,true,$4,$4,$5)", [unit, level, offset + 1, `sitov-quest-test-${offset}`, `Questtest ${offset}`])
  await db.query("INSERT INTO path_objectives(unit_id,id,area,description) VALUES($1,'sitov-quest','grammar','Ein Satz im Test')", [unit])
  await db.query("INSERT INTO path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,test_size,goals) VALUES($1,$2,$3,'test',1,'Test','Test',1,ARRAY['sitov-quest'])", [node, unit, `test-${offset}`])
  if (score !== null) await db.query("INSERT INTO path_test_attempts(auth_user_id,node_id,status,selected_exercise_ids,percentage,passed,completed_at) VALUES($1,$2,'completed','{}',$3,$4,now())", [user, node, score, score >= 80])
  return node
}

scenario('six authored starter levels, frozen safe payload and isolated answers', async db => {
  const levels = (await db.query('SELECT level::text level FROM daily_quests ORDER BY level')).rows.map(row => row.level)
  assert.deepEqual(levels, ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
  const first = await quest(db)
  assert.equal(first.level, 'A1'); assert.equal(first.personalization.source, 'fallback')
  assert.equal(first.scene.audioText, 'Guten Morgen! Was möchten Sie?')
  assert.equal(first.scene.backgroundImage, '/Bilder/deutschreise/bakery-scene.png')
  assert.equal(first.steps[2].options.find(option=>option.id==='a').text,'Ja, bitte. Eine Tüte.','A1 response needs no Konjunktiv II')
  assert.ok(!first.steps[2].options.find(option=>option.id==='a').text.includes('wäre'))
  assert.ok(!JSON.stringify(first).includes('accepted'))
  assert.ok(!JSON.stringify(first).includes('answer_key'))
  await db.exec('RESET ROLE')
  await db.exec("UPDATE daily_quests SET content=jsonb_set(content,'{title}','\"Später bearbeitet\"') WHERE level='A1'")
  assert.deepEqual(await quest(db), first, 'existing user assignment never changes with its template')
  await as(db, student)
  await assert.rejects(db.query('SELECT * FROM daily_quest_private.template_keys'), { code: '42501' })
  await assert.rejects(db.query('SELECT * FROM daily_quest_private.assignment_keys'), { code: '42501' })
  await assert.rejects(db.query('SELECT daily_quest_private.ensure_assignment($1)', [student]), { code: '42501' })
})

scenario('first daily login exactly once; manual get preserves the claim', async db => {
  const first = await quest(db)
  const claims = await Promise.all(Array.from({ length: 8 }, () => rpc(db, 'claim_daily_quest_login()')))
  assert.equal(claims.filter(claim => claim.shouldRedirect).length, 1)
  assert.ok(claims.every(claim => claim.assignmentId === first.id))
  await db.exec('RESET ROLE')
  assert.equal((await db.query('SELECT count(*)::int n FROM daily_quest_assignments WHERE auth_user_id=$1', [student])).rows[0].n, 1)
  assert.equal((await db.query('SELECT count(*)::int n FROM daily_quest_private.login_claims WHERE auth_user_id=$1', [student])).rows[0].n, 1)
})

scenario('optout creates no assignment or login claim and toggles only the actor', async db => {
  await as(db, student)
  assert.equal((await rpc(db, 'set_daily_quest_enabled(false)')).enabled, false)
  assert.equal((await rpc(db, 'get_daily_quest()')).quest, null)
  assert.equal((await rpc(db, 'claim_daily_quest_login()')).shouldRedirect, false)
  await db.exec('RESET ROLE')
  assert.equal((await db.query('SELECT count(*)::int n FROM daily_quest_private.login_claims')).rows[0].n, 0)
  assert.equal((await db.query('SELECT daily_quests_enabled FROM profiles WHERE id=$1', [outsider])).rows[0].daily_quests_enabled, true)
  await as(db, student)
  await rpc(db, 'set_daily_quest_enabled(true)')
  assert.equal((await rpc(db, 'claim_daily_quest_login()')).shouldRedirect, true)
  const assigned = (await rpc(db, 'get_daily_quest()')).quest
  await rpc(db, 'set_daily_quest_enabled(false)')
  assert.equal((await rpc(db, 'complete_daily_quest($1)', [assigned.id])).error, 'disabled')
})

scenario('no published template does not consume login claim', async db => {
  await db.exec('UPDATE daily_quests SET is_active=false')
  await as(db, student)
  assert.equal((await rpc(db, 'claim_daily_quest_login()')).shouldRedirect, false)
  await db.exec('RESET ROLE')
  assert.equal((await db.query('SELECT count(*)::int n FROM daily_quest_private.login_claims')).rows[0].n, 0)
  await db.exec("UPDATE daily_quests SET is_active=true WHERE level='A1'")
  await as(db, student)
  assert.equal((await rpc(db, 'claim_daily_quest_login()')).shouldRedirect, true)
})

scenario('own-user RLS, cross-user RPC denial, and anonymous/staff restriction', async db => {
  const assigned = await quest(db)
  assert.equal((await db.query('SELECT id FROM daily_quest_assignments')).rows.length, 1)
  await as(db, outsider)
  assert.equal((await db.query('SELECT id FROM daily_quest_assignments')).rows.length, 0)
  for (const action of ['skip_daily_quest', 'complete_daily_quest']) assert.equal((await rpc(db, `${action}($1)`, [assigned.id])).error, 'not_found')
  assert.equal((await submit(db, assigned.id, 'discover', { wordIds: ['food','coffee','bag'] })).error, 'not_found')
  await as(db, teacher)
  assert.equal((await rpc(db, 'get_daily_quest()')).error, 'not_authorized')
  assert.equal((await rpc(db, 'set_daily_quest_enabled(false)')).error, 'not_authorized')
  await actor(db, null, 'anon')
  await assert.rejects(rpc(db, 'get_daily_quest()'), { code: '42501' })
  await assert.rejects(db.query('SELECT * FROM daily_quest_assignments'), { code: '42501' })
  await actor(db, null, 'authenticated')
  assert.equal((await rpc(db, 'get_daily_quest()')).error, 'not_authenticated')
})

scenario('direct REST-style mutation cannot forge steps, streak, preference or role', async db => {
  const assigned = await quest(db)
  await assert.rejects(db.query("UPDATE daily_quest_assignments SET completed_step_ids=ARRAY['discover','build','dialogue'] WHERE id=$1", [assigned.id]), { code: '42501' })
  await assert.rejects(db.query('INSERT INTO daily_quest_assignments(auth_user_id,quest_date,snapshot) VALUES($1,current_date,$2)', [student, {}]), { code: '42501' })
  await assert.rejects(db.query('DELETE FROM daily_quest_assignments WHERE id=$1', [assigned.id]), { code: '42501' })
  for (const mutation of ['daily_quest_streak=999','daily_quest_longest_streak=999','daily_quest_last_completed_date=current_date','daily_quests_enabled=false',"role='admin'"])
    await assert.rejects(db.query(`UPDATE profiles SET ${mutation} WHERE id=$1`, [student]), { code: '42501' })
  await db.query("UPDATE profiles SET native_language='en' WHERE id=$1", [student])
  await db.query("UPDATE profiles SET ui_language='en',notify_pronunciation_feedback=false,notify_new_content=false,notify_learning_reminders=false WHERE id=$1", [student])
  assert.equal((await rpc(db, 'get_daily_quest_status()')).streak.current, 0)
})

scenario('ordered steps, wrong answers and forged client booleans never complete', async db => {
  const assigned = await quest(db)
  assert.equal((await rpc(db, 'complete_daily_quest($1)', [assigned.id])).error, 'steps_incomplete')
  assert.equal((await submit(db, assigned.id, 'dialogue', { optionId: 'a' })).error, 'step_out_of_order')
  assert.equal((await submit(db, assigned.id, 'discover', { wordIds: ['food','food','bag'] })).correct, false)
  assert.equal((await submit(db, assigned.id, 'discover', { wordIds: ['food','coffee','bag'], correct: true })).error, 'invalid_input')
  assert.equal((await submit(db, assigned.id, 'discover', { wordIds: 'food' })).error, 'invalid_input')
  await submit(db, assigned.id, 'discover', { wordIds: ['bag','food','coffee'] })
  assert.equal((await submit(db, assigned.id, 'build', { pieceIds: ['moechte','ich','food','bitte'] })).correct, false)
  assert.equal((await submit(db, assigned.id, 'build', { pieceIds: [], passed: true })).error, 'invalid_input')
  assert.equal((await rpc(db, 'complete_daily_quest($1)', [assigned.id])).error, 'steps_incomplete')
  await finishSteps(db, assigned.id)
  const ready = await rpc(db, 'get_daily_quest()')
  assert.equal(ready.quest.status, 'active'); assert.equal(ready.streak.current, 0)
  assert.deepEqual(ready.quest.completedStepIds, ['discover','build','dialogue'])
  assert.equal((await rpc(db, 'complete_daily_quest($1)', [assigned.id])).streak.current, 1)
})

scenario('completion is idempotent per day, contiguous days grow, gaps reset', async db => {
  const day = await today(db), first = await quest(db)
  await finishSteps(db, first.id)
  assert.equal((await rpc(db, 'complete_daily_quest($1)', [first.id])).streak.current, 1)
  assert.equal((await rpc(db, 'complete_daily_quest($1)', [first.id])).streak.current, 1)
  await moveDay(db, plusDays(day, 1)); const second = await quest(db); await finishSteps(db, second.id)
  assert.equal((await rpc(db, 'complete_daily_quest($1)', [second.id])).streak.current, 2)
  await moveDay(db, plusDays(day, 3)); const third = await quest(db)
  assert.equal((await rpc(db, 'get_daily_quest_status()')).streak.current, 0)
  await finishSteps(db, third.id)
  const done = await rpc(db, 'complete_daily_quest($1)', [third.id])
  assert.equal(done.streak.current, 1); assert.equal(done.streak.longest, 2)
  assert.equal(done.streak.lastCompletedDate, plusDays(day, 3))
  assert.equal((await rpc(db, 'complete_daily_quest($1)', [first.id])).error, 'expired')
})

scenario('leaving preserves active status, verified steps and later completion without a streak award', async db => {
  const assigned = await quest(db)
  await submit(db, assigned.id, 'discover', { wordIds: ['food', 'coffee', 'bag'] })
  const skipped = await rpc(db, 'skip_daily_quest($1)', [assigned.id])
  assert.equal(skipped.quest.status, 'active'); assert.equal(skipped.streak.current, 0)
  assert.deepEqual(skipped.quest.completedStepIds, ['discover'])
  assert.equal((await rpc(db, 'skip_daily_quest($1)', [assigned.id])).quest.status, 'active')
  assert.equal((await rpc(db, 'complete_daily_quest($1)', [assigned.id])).error, 'steps_incomplete')
  assert.equal((await rpc(db, 'get_daily_quest()')).quest.status, 'active')
  assert.equal((await rpc(db, 'get_daily_quest_status()')).today.status, 'active')
  await rpc(db, 'claim_daily_quest_login()')
  assert.equal((await rpc(db, 'claim_daily_quest_login()')).shouldRedirect, false)
  await finishSteps(db, assigned.id)
  assert.equal((await rpc(db, 'complete_daily_quest($1)', [assigned.id])).streak.current, 1)
  assert.equal((await rpc(db, 'skip_daily_quest($1)', [assigned.id])).quest.status, 'completed')
})

scenario('resume migration restores today’s old skips while preserving historical rows and progress', async db => {
  const assigned = await quest(db)
  await submit(db, assigned.id, 'discover', { wordIds: ['food', 'coffee', 'bag'] })
  await db.exec('RESET ROLE')
  await db.query("UPDATE daily_quest_assignments SET status='skipped',skipped_at=now() WHERE id=$1", [assigned.id])
  await db.query("INSERT INTO daily_quest_assignments(auth_user_id,quest_date,template_id,snapshot,status,skipped_at) SELECT auth_user_id,quest_date-1,template_id,snapshot,'skipped',now() FROM daily_quest_assignments WHERE id=$1", [assigned.id])
  const source = await readFile(new URL('../vps/60_daily_quest_resume.sql', import.meta.url), 'utf8')
  await db.exec(source); await db.exec(source)
  const rows = (await db.query('SELECT status,skipped_at,completed_step_ids FROM daily_quest_assignments ORDER BY quest_date')).rows
  assert.equal(rows[0].status, 'skipped'); assert.ok(rows[0].skipped_at)
  assert.equal(rows[1].status, 'active'); assert.equal(rows[1].skipped_at, null)
  assert.deepEqual(rows[1].completed_step_ids, ['discover'])
  await as(db, student)
  assert.equal((await rpc(db, 'get_daily_quest()')).quest.id, assigned.id)
  await finishSteps(db, assigned.id)
  assert.equal((await rpc(db, 'complete_daily_quest($1)', [assigned.id])).quest.status, 'completed')
})

scenario('partial or empty sublevels cannot advance; all active tests must reach 80', async db => {
  await addLevelTest(db, 'A1.1', 1, 100)
  await as(db, student); assert.equal((await rpc(db, 'get_daily_quest()')).quest.level, 'A1')
  await db.exec('RESET ROLE'); await db.query('DELETE FROM daily_quest_assignments WHERE auth_user_id=$1', [student])
  const lower = await addLevelTest(db, 'A1.2', 2, 79)
  const remaining = await addLevelTest(db, 'A1.2', 3, null)
  await as(db, student); assert.equal((await rpc(db, 'get_daily_quest()')).quest.level, 'A1')
  await db.exec('RESET ROLE'); await db.query('DELETE FROM daily_quest_assignments WHERE auth_user_id=$1', [student])
  await db.query('UPDATE path_test_attempts SET percentage=80,passed=true WHERE node_id=$1', [lower])
  await as(db, student); assert.equal((await rpc(db, 'get_daily_quest()')).quest.level, 'A1', 'a passed test cannot cover the missing test')
  await db.exec('RESET ROLE'); await db.query('DELETE FROM daily_quest_assignments WHERE auth_user_id=$1', [student])
  await db.query("INSERT INTO path_test_attempts(auth_user_id,node_id,status,selected_exercise_ids,percentage,passed,completed_at) VALUES($1,$2,'completed','{}',80,true,now())", [student, remaining])
  await as(db, student); assert.equal((await rpc(db, 'get_daily_quest()')).quest.level, 'A2')
})

scenario('highest mastered family targets next level; C2 caps and inactive passes do not count', async db => {
  await addLevelTest(db, 'B1.1', 11, 80); await addLevelTest(db, 'B1.2', 12, 80)
  assert.equal((await quest(db)).level, 'B2')
  await db.exec('RESET ROLE'); await db.query('DELETE FROM daily_quest_assignments WHERE auth_user_id=$1', [student])
  await addLevelTest(db, 'C2.1', 21, 100); await addLevelTest(db, 'C2.2', 22, 100)
  const capped = await quest(db); assert.equal(capped.level, 'C2')
  await finishSteps(db, capped.id); assert.equal((await rpc(db, 'complete_daily_quest($1)', [capped.id])).quest.status, 'completed')
  await db.exec('RESET ROLE'); await db.query('DELETE FROM daily_quest_assignments WHERE auth_user_id=$1', [student])
  await db.exec("UPDATE path_test_attempts SET is_active=false WHERE node_id IN(SELECT n.id FROM path_nodes n JOIN learning_units u ON u.id=n.unit_id WHERE u.level LIKE 'C2.%')")
  assert.equal((await quest(db)).level, 'B2', 'inactive C2 attempts are not evidence of mastery')
})

scenario('B1/B2/C1 accept grammatically valid alternatives and reject swapped verb order', async db => {
  await addLevelTest(db, 'A2.1', 15, 80); await addLevelTest(db, 'A2.2', 16, 80)
  const variants = [
    ['B1',[
      ['koennten','sie','mir','food','bitte','statt','geben'],
      ['koennten','sie','mir','food','statt','bitte','geben'],
    ]],
    ['B2',[
      ['ich','wuerde','food','bestellen','sofern','budget','dafuer','ausreicht'],
      ['ich','wuerde','food','bestellen','sofern','dafuer','budget','ausreicht'],
    ]],
    ['C1',[
      ['ich','wuerde','food','bevorzugen','wenngleich','dafuer','aufpreis','anfaellt'],
      ['ich','wuerde','food','bevorzugen','wenngleich','aufpreis','dafuer','anfaellt'],
    ]],
  ]
  for(const [level,answers] of variants) {
    if(level==='B2') {await addLevelTest(db,'B1.1',17,80); await addLevelTest(db,'B1.2',18,80)}
    if(level==='C1') {await addLevelTest(db,'B2.1',19,80); await addLevelTest(db,'B2.2',20,80)}
    await db.exec('RESET ROLE'); await db.query('DELETE FROM daily_quest_assignments WHERE auth_user_id=$1',[student])
    const assigned=await quest(db); assert.equal(assigned.level,level)
    await submit(db,assigned.id,'discover',{wordIds:['food','coffee','bag']})
    const wrong=[...answers[0]]; [wrong[0],wrong[1]]=[wrong[1],wrong[0]]
    assert.equal((await submit(db,assigned.id,'build',{pieceIds:wrong})).correct,false)
    for(const pieceIds of answers) assert.equal((await submit(db,assigned.id,'build',{pieceIds})).correct,true,`${level}: ${pieceIds}`)
  }
})

scenario('box1/recent wrong vocabulary uses curated case forms, current access and frozen fallback', async db => {
  await db.exec('RESET ROLE')
  const apple = id(59301), banana = id(59302), unknown = id(59303)
  for (const [cardId, word, article] of [[apple,'Apfel','der'],[banana,'Banane','die'],[unknown,'Sonderwort','das']]) {
    await db.query('INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,article,sentence_practice) VALUES($1,$2,$3,$4,false)', [cardId,vocabularyUnit,word,article])
    await db.query("INSERT INTO vocabulary_direction_progress(auth_user_id,card_id,direction,box_number,lapses,last_answered_at) VALUES($1,$2,'native_to_de',1,1,now())", [student,cardId])
  }
  // Recent timestamp makes the apple deterministic before the banana.
  await db.query("UPDATE vocabulary_direction_progress SET last_answered_at=now()-interval '1 hour' WHERE card_id=$1", [banana])
  const picked = await quest(db)
  assert.equal(picked.personalization.source, 'box1'); assert.equal(picked.personalization.cardId, apple)
  assert.equal(picked.steps[0].words[0].text, 'der Apfel')
  assert.equal(picked.steps[1].pieces.find(piece => piece.id==='food').text, 'einen Apfel')
  await db.exec('RESET ROLE'); await db.query("UPDATE vocabulary_direction_progress SET box_number=7,last_answered_at=now()-interval '31 days' WHERE auth_user_id=$1", [student])
  assert.deepEqual(await quest(db), picked)
  await db.exec('RESET ROLE'); await db.query('DELETE FROM daily_quest_assignments WHERE auth_user_id=$1', [student])
  await db.query("INSERT INTO vocabulary_focus_words(auth_user_id,card_id,status,last_error_at) VALUES($1,$2,'active',now()) ON CONFLICT(auth_user_id,card_id) DO UPDATE SET last_error_at=now()", [student,banana])
  const recent = await quest(db)
  assert.equal(recent.personalization.source, 'recent_wrong'); assert.equal(recent.personalization.cardId, banana)
  assert.equal(recent.steps[1].pieces.find(piece => piece.id==='food').text, 'eine Banane')
  await db.exec('RESET ROLE'); await db.query('DELETE FROM daily_quest_assignments WHERE auth_user_id=$1', [student])
  await db.query("UPDATE learning_units SET is_active=false WHERE id=$1", [vocabularyUnit])
  const fallback = await quest(db)
  assert.equal(fallback.personalization.source, 'fallback'); assert.equal(fallback.personalization.cardId, null)
})

scenario('unseen or stale box1 words never masquerade as current mistakes', async db => {
  const cardId = id(59310)
  await db.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,article,sentence_practice) VALUES($1,$2,'Apfel','der',false)", [cardId,vocabularyUnit])
  await db.query("INSERT INTO vocabulary_direction_progress(auth_user_id,card_id,direction,box_number) VALUES($1,$2,'native_to_de',1)", [student,cardId])
  assert.equal((await quest(db)).personalization.source, 'fallback')
  await db.exec('RESET ROLE'); await db.query('DELETE FROM daily_quest_assignments WHERE auth_user_id=$1', [student])
  await db.query("UPDATE vocabulary_direction_progress SET lapses=3,last_answered_at=now()-interval '31 days' WHERE card_id=$1", [cardId])
  assert.equal((await quest(db)).personalization.source, 'fallback')
})

scenario('new category, per-template fallback and arbitrary step ids need no schema or renderer edit', async db => {
  await db.query("INSERT INTO daily_quest_private.slot_forms VALUES('travel','Ticket','das','das Ticket','ein Ticket')")
  const original = (await db.query("SELECT content FROM daily_quests WHERE level='A1'")).rows[0].content
  original.steps[0].id='words'; original.steps[1].id='order'; original.steps[2].id='answer'
  const template = (await db.query("INSERT INTO daily_quests(template_key,level,category,fallback_word_de,fallback_article,content) VALUES('sitov-test-travel','A1','travel','Ticket','das',$1) RETURNING id", [original])).rows[0].id
  await db.query('INSERT INTO daily_quest_private.template_keys VALUES($1,$2)', [template,{ steps:{order:{accepted:[['ich','moechte','food','bitte']]},answer:{optionId:'a'}} }])
  await db.query('UPDATE daily_quests SET is_active=false WHERE id<>$1', [template])
  const assigned = await quest(db)
  assert.equal(assigned.steps[0].words[0].text, 'das Ticket')
  assert.equal(assigned.steps[1].audioText, 'Ich möchte ein Ticket, bitte.')
  await submit(db,assigned.id,'words',{wordIds:['bag','food','coffee']})
  await submit(db,assigned.id,'order',{pieceIds:['ich','moechte','food','bitte']})
  await submit(db,assigned.id,'answer',{optionId:'a'})
  assert.equal((await rpc(db,'complete_daily_quest($1)',[assigned.id])).quest.status,'completed')
})

scenario('forged another-user test or inactive test attempt cannot promote the learner', async db => {
  const first = await addLevelTest(db,'A1.1',31,80), second=await addLevelTest(db,'A1.2',32,100,outsider)
  assert.equal((await quest(db)).level,'A1')
  await db.exec('RESET ROLE'); await db.query('DELETE FROM daily_quest_assignments WHERE auth_user_id=$1',[student])
  await db.query("INSERT INTO path_test_attempts(auth_user_id,node_id,status,selected_exercise_ids,percentage,passed,completed_at,is_active) VALUES($1,$2,'completed','{}',100,true,now(),false)",[student,second])
  assert.equal((await quest(db)).level,'A1')
  await db.exec('RESET ROLE'); await db.query('DELETE FROM daily_quest_assignments WHERE auth_user_id=$1',[student])
  await db.query("UPDATE path_test_attempts SET is_active=true WHERE auth_user_id=$1 AND node_id=$2",[student,second])
  assert.equal((await quest(db)).level,'A2')
  assert.ok(first)
})

scenario('rollback removes every client entry point and reapply preserves streak and assignments', async db => {
  const assigned = await quest(db); await finishSteps(db, assigned.id)
  await rpc(db, 'complete_daily_quest($1)', [assigned.id]); await rpc(db, 'set_daily_quest_enabled(false)')
  await db.exec('RESET ROLE')
  await db.exec(await readFile(new URL('../vps/rollback/59_daily_quests.sql', import.meta.url), 'utf8'))
  await as(db, student)
  await assert.rejects(rpc(db, 'get_daily_quest()'), { code: '42501' })
  await assert.rejects(rpc(db, 'claim_daily_quest_login()'), { code: '42501' })
  await db.exec('RESET ROLE'); await db.exec(await readFile(new URL('../vps/59_daily_quests.sql', import.meta.url), 'utf8'))
  await as(db, student)
  const status = await rpc(db, 'get_daily_quest_status()')
  assert.equal(status.enabled, false); assert.equal(status.streak.current, 1); assert.equal(status.today.assignmentId, assigned.id)
  assert.equal(status.today.status, 'completed')
})

scenario('editorial preview is read-only staff-only; answer keys never reach students', async db => {
  const state = async () => {
    await db.exec('RESET ROLE')
    return result(db, `SELECT jsonb_build_object(
      'profiles',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM profiles p),
      'assignments',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM daily_quest_assignments a),
      'claims',(SELECT jsonb_agg(to_jsonb(c) ORDER BY auth_user_id,quest_date) FROM daily_quest_private.login_claims c)) result`)
  }
  const before = await state()
  await as(db,student)
  assert.equal((await rpc(db,"get_daily_quest_preview('A1')")).error,'not_authorized')
  await actor(db,null,'anon')
  await assert.rejects(rpc(db,"get_daily_quest_preview('A1')"),{code:'42501'})
  await actor(db,null,'authenticated')
  assert.equal((await rpc(db,"get_daily_quest_preview('A1')")).error,'not_authenticated')
  await as(db,teacher)
  for(const level of ['A1','A2','B1','B2','C1','C2']) {
    const preview = await rpc(db,'get_daily_quest_preview($1)',[level])
    assert.equal(preview.success,true); assert.equal(preview.quest.level,level)
    assert.equal(preview.quest.status,'active'); assert.deepEqual(preview.quest.completedStepIds,[])
    assert.equal(preview.quest.personalization.source,'fallback')
    assert.ok(preview.answerKey.steps.build.accepted.length>=1)
    assert.equal(preview.answerKey.steps.dialogue.optionId,'a')
    assert.ok(!JSON.stringify(preview.quest).includes('accepted'))
  }
  assert.equal((await rpc(db,"get_daily_quest_preview('A9')")).error,'invalid_input')
  assert.deepEqual(await state(),before,'preview does not create real learner progress, assignments, claims or streak')
  await db.query("UPDATE profiles SET role='admin' WHERE id=$1",[teacher])
  await as(db,teacher)
  assert.equal((await rpc(db,'get_daily_quest_preview()')).success,true)
  // A stale staff JWT is irrelevant: the role is read from the live profile.
  await db.exec('RESET ROLE'); await db.query("UPDATE profiles SET role='student' WHERE id=$1",[teacher])
  await as(db,teacher)
  assert.equal((await rpc(db,'get_daily_quest_preview()')).error,'not_authorized')
})
