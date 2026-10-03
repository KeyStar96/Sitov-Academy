import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, access } from 'node:fs/promises'
import { createCurrentDatabase, currentFeatureMigrations, actor, student, teacher, result, apply } from './helpers/current-db.mjs'
import { loadSitovQuestCatalog, buildSitovQuestSql, buildSitovQuest } from '../../scripts/build-sitov-daily-quests.mjs'

const require = createRequire(import.meta.url)
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const { dailyQuestSchema, dailyQuestPreviewSchema, sitovQuestCatalogSchema } = require('../../lib/daily-quest-contract.ts')
const legacy = [...currentFeatureMigrations, '59_daily_quests.sql', '60_daily_quest_resume.sql', '64_daily_quest_male_characters.sql']
const latest = [...legacy, '67_sitov_daily_quest_catalog.sql']
const rpc = (db, sql, params=[]) => result(db, `SELECT ${sql} result`, params)
const newCatalog = async db => {
  const rows = (await db.query("SELECT id,template_key,level::text level,content FROM public.daily_quests WHERE content ? 'sitovCatalogDay' ORDER BY level,content->>'sitovCatalogDay'")).rows
  assert.equal(rows.length, 400)
  return rows
}

test('Sitov catalogue: 400 authored journeys, reproducible migration and complete scene assets', async () => {
  const entries = await loadSitovQuestCatalog()
  const source=JSON.parse(await readFile(new URL('../../content/daily-quests/sitov-a1.json',import.meta.url),'utf8'))[0]
  const original=buildSitovQuest('A1',source,1)
  const reordered=buildSitovQuest('A1',{...source,pieces:[...source.pieces].reverse(),options:[...source.options].reverse()},1)
  for(const field of ['pieces','options']) {
    const step=field==='pieces'?1:2
    const byText=entry=>Object.fromEntries(entry.content.steps[step][field].map(item=>[item.text,item.id]))
    assert.deepEqual(byText(original),byText(reordered),'public IDs must not reveal correct order or option position')
  }
  const runtime = await readFile(new URL('../../scripts/lib/sitov-daily-quest-runtime.sql', import.meta.url), 'utf8')
  assert.equal(await readFile(new URL('../vps/67_sitov_daily_quest_catalog.sql', import.meta.url), 'utf8'), buildSitovQuestSql(entries,runtime))
  for (const entry of entries) {
    await access(new URL(`../../public${entry.content.scene.backgroundImage}`, import.meta.url))
    assert(entry.content.scene.characters.every(character => character.voice === 'male'))
    assert(!JSON.stringify(entry.content).includes('accepted'))
    assert(!JSON.stringify(entry.content).includes('optionId'))
    assert.equal(entry.content.steps.length,3)
    const build = entry.content.steps[1]
    assert.notDeepEqual(build.pieces.map(piece => piece.id), entry.answerKey.steps.build.accepted[0])
  }
})

test('Sitov catalogue: additive reapplication preserves live snapshots, keys, claims, preferences and streaks', async () => {
  let db
  try {
    db = await createCurrentDatabase({ latest: legacy })
    await actor(db,student)
    const claim = await rpc(db,'claim_daily_quest_login()')
    const quest = (await rpc(db,'get_daily_quest()')).quest
    await rpc(db,'submit_daily_quest_step($1,$2,$3)',[quest.id,'discover',{wordIds:quest.steps[0].words.map(word=>word.id)}])
    await db.exec('RESET ROLE')
    await db.query('UPDATE profiles SET daily_quest_streak=7,daily_quest_longest_streak=9,daily_quest_last_completed_date=daily_quest_private.today()-1 WHERE id=$1',[student])
    const state = async () => ({
      assignment:(await db.query('SELECT * FROM public.daily_quest_assignments')).rows,
      answers:(await db.query('SELECT * FROM daily_quest_private.assignment_keys')).rows,
      claims:(await db.query('SELECT * FROM daily_quest_private.login_claims')).rows,
      preference:(await db.query('SELECT daily_quests_enabled,daily_quest_streak,daily_quest_longest_streak,daily_quest_last_completed_date FROM profiles WHERE id=$1',[student])).rows,
      starters:(await db.query("SELECT q.*,k.answer_key FROM public.daily_quests q JOIN daily_quest_private.template_keys k ON k.template_id=q.id WHERE NOT (q.content ? 'sitovCatalogDay') ORDER BY q.id")).rows,
    })
    const before = await state()
    assert.equal(claim.assignmentId,quest.id)
    await apply(db,['67_sitov_daily_quest_catalog.sql'])
    const catalogBefore=(await newCatalog(db)).map(row=>row.id)
    await apply(db,['67_sitov_daily_quest_catalog.sql'])
    assert.deepEqual(await state(),before)
    assert.deepEqual((await newCatalog(db)).map(row=>row.id),catalogBefore)
    assert.equal((await db.query('SELECT count(*)::int n FROM daily_quest_private.template_keys')).rows[0].n,406)
    await actor(db,student)
    const resumed=(await rpc(db,'get_daily_quest()')).quest
    assert.equal(resumed.id,quest.id); assert.deepEqual(resumed.completedStepIds,['discover'])
  } finally { await db?.close() }
})

test('Sitov catalogue: every new journey previews and grades correctly, all levels run 100 new days without repeats', async () => {
  let db
  try {
    db = await createCurrentDatabase({ latest })
    await db.exec(`CREATE TABLE public.sitov_test_clock(day date,level public.cefr_code);
      INSERT INTO public.sitov_test_clock VALUES('2030-01-01','A1');
      CREATE OR REPLACE FUNCTION daily_quest_private.today() RETURNS date LANGUAGE sql STABLE SET search_path TO '' AS $$ SELECT day FROM public.sitov_test_clock $$;
      CREATE OR REPLACE FUNCTION daily_quest_private.target_level(p_user uuid) RETURNS public.cefr_code LANGUAGE sql STABLE SET search_path TO '' AS $$ SELECT level FROM public.sitov_test_clock $$;`)
    for (const level of ['A1','A2','B1','B2']) {
      await db.exec('RESET ROLE'); await db.query('UPDATE public.sitov_test_clock SET level=$1',[level])
      await actor(db,teacher)
      const catalog=sitovQuestCatalogSchema.parse(await rpc(db,'get_sitov_daily_quest_catalog($1)',[level]))
      assert.equal(catalog.templates.length,101)
      assert.deepEqual(catalog.templates.map(item=>item.day),Array.from({length:101},(_,index)=>index))
      const seen=new Set()
      for (let day=0;day<=100;day++) {
        await actor(db,student)
        const quest=dailyQuestSchema.parse((await rpc(db,'get_daily_quest()')).quest)
        assert.equal(quest.level,level); assert(!seen.has(quest.templateKey)); seen.add(quest.templateKey)
        assert.equal(quest.templateKey,catalog.templates[day].templateKey)
        await db.exec('RESET ROLE')
        const key=(await db.query('SELECT answer_key FROM daily_quest_private.assignment_keys WHERE assignment_id=$1',[quest.id])).rows[0].answer_key
        await actor(db,teacher)
        const preview=dailyQuestPreviewSchema.parse(await rpc(db,'get_sitov_daily_quest_preview($1,$2)',[level,quest.templateKey]))
        assert.equal(preview.quest.title,quest.title)
        assert(!JSON.stringify(quest).includes('answerKey'))
        await actor(db,student)
        const first=quest.steps[0],build=quest.steps[1],dialogue=quest.steps[2]
        assert.equal((await rpc(db,'submit_daily_quest_step($1,$2,$3)',[quest.id,first.id,{wordIds:first.words.map(word=>word.id)}])).correct,true)
        if(day===1) {
          const reversed=[...key.steps[build.id].accepted[0]].reverse()
          assert.equal((await rpc(db,'submit_daily_quest_step($1,$2,$3)',[quest.id,build.id,{pieceIds:reversed}])).correct,false)
          assert.equal((await rpc(db,'complete_daily_quest($1)',[quest.id])).error,'steps_incomplete')
        }
        assert.equal((await rpc(db,'submit_daily_quest_step($1,$2,$3)',[quest.id,build.id,{pieceIds:key.steps[build.id].accepted[0]}])).correct,true)
        const wrong=dialogue.options.find(option=>option.id!==key.steps[dialogue.id].optionId).id
        assert.equal((await rpc(db,'submit_daily_quest_step($1,$2,$3)',[quest.id,dialogue.id,{optionId:wrong}])).correct,false)
        assert.equal((await rpc(db,'submit_daily_quest_step($1,$2,$3)',[quest.id,dialogue.id,{optionId:key.steps[dialogue.id].optionId}])).correct,true)
        const done=await rpc(db,'complete_daily_quest($1)',[quest.id]); assert.equal(done.quest.status,'completed')
        assert.equal((await rpc(db,'complete_daily_quest($1)',[quest.id])).streak.current,done.streak.current)
        await db.exec('RESET ROLE'); await db.exec("UPDATE public.sitov_test_clock SET day=day+1")
      }
    }
    await db.exec('RESET ROLE'); await db.query("UPDATE public.sitov_test_clock SET level='A1'")
    await actor(db,student)
    // Only after all 101 published templates have been assigned may the starter repeat.
    const repeated=(await rpc(db,'get_daily_quest()')).quest
    assert.equal(repeated.templateKey,'sitov-bakery-breakfast')
    await db.exec('RESET ROLE'); await db.query("UPDATE public.sitov_test_clock SET level='B2'")
    await actor(db,student)
    assert.equal((await rpc(db,'get_daily_quest()')).quest.id,repeated.id)
  } finally { await db?.close() }
})

test('Sitov catalogue: staff-only answers, authenticated/anonymous ACLs and level matching', async () => {
  let db
  try {
    db=await createCurrentDatabase({latest})
    await actor(db,student)
    assert.equal((await rpc(db,'get_sitov_daily_quest_catalog($1)',['A1'])).error,'not_authorized')
    assert.equal((await rpc(db,'get_sitov_daily_quest_preview($1,$2)',['A1','sitov-bakery-breakfast'])).error,'not_authorized')
    await assert.rejects(db.query('SELECT * FROM daily_quest_private.template_keys'),/permission denied/)
    await actor(db,teacher)
    assert.equal((await rpc(db,'get_sitov_daily_quest_preview($1,$2)',['B2','sitov-bakery-breakfast'])).error,'no_template')
    assert.equal((await rpc(db,'get_sitov_daily_quest_catalog($1)',['A1.1'])).error,'invalid_input')
    assert.equal((await rpc(db,'get_sitov_daily_quest_catalog($1)',['C2'])).templates.length,1)
    await db.exec('RESET ROLE')
    await db.query("SELECT set_config('request.jwt.claim.sub','',false)")
    assert.equal((await rpc(db,'get_sitov_daily_quest_catalog($1)',['A1'])).error,'not_authenticated')
    const acl=(await db.query(`SELECT has_function_privilege('anon','public.get_sitov_daily_quest_catalog(text)','EXECUTE') anon,
      has_function_privilege('authenticated','public.get_sitov_daily_quest_preview(text,text)','EXECUTE') staff,
      has_function_privilege('authenticated','daily_quest_private.ensure_assignment(uuid)','EXECUTE') internal`)).rows[0]
    assert.deepEqual(acl,{anon:false,staff:true,internal:false})
  } finally {await db?.close()}
})

test('Sitov catalogue: migration 67 works after the parallel trainer migrations 65 and 66', async () => {
  let db
  try {
    db=await createCurrentDatabase({beforeLatest: async fixture => {
      // Match the established verb-trainer fixture: the lower three families
      // have sublevels; migration 63 adds the B2/C1 family rows at positions 7/8.
      await fixture.exec(`INSERT INTO public.cefr_levels(code) SELECT unnest(enum_range(NULL::public.cefr_code)) ON CONFLICT DO NOTHING;
        INSERT INTO public.learning_levels(code,cefr_level,sort_order)
        SELECT c.code::text||'.'||part.n,c.code,row_number() OVER(ORDER BY c.code,part.n)::integer
        FROM public.cefr_levels c CROSS JOIN (VALUES(1),(2)) part(n)
        WHERE c.code IN('A1','A2','B1') ON CONFLICT DO NOTHING;`)
    }, latest:[...currentFeatureMigrations,
      '59_daily_quests.sql','60_daily_quest_resume.sql','61_account_learning_checkpoints.sql',
      '62_verb_trainer_enums.sql','63_verb_trainer.sql','64_daily_quest_male_characters.sql',
      '65_sitov_verb_learning_progress.sql','66_sitov_pronunciation_readiness.sql','67_sitov_daily_quest_catalog.sql',
    ]})
    await actor(db,student)
    const quest=dailyQuestSchema.parse((await rpc(db,'get_daily_quest()')).quest)
    assert.equal(quest.level,'A1')
    assert.equal(quest.templateKey,'sitov-bakery-breakfast')
    await actor(db,teacher)
    for(const level of ['A1','A2','B1','B2']) assert.equal((await rpc(db,'get_sitov_daily_quest_catalog($1)',[level])).templates.length,101)
  } finally {await db?.close()}
})
