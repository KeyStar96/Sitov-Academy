import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCurrentDatabase, currentFeatureMigrations, actor, student, teacher, outsider, result, apply } from './helpers/current-db.mjs'

test('Sitov account checkpoints: reload, isolation, stale devices and resets', async t => {
 const db = await createCurrentDatabase({ latest: [...currentFeatureMigrations, '59_daily_quests.sql', '60_daily_quest_resume.sql', '61_account_learning_checkpoints.sql'] })
 const as = async user => { await db.exec('RESET ROLE'); await actor(db,user) }
 const rpc = async (action,kind,state=null,revision=null) => result(db,'SELECT public.sitov_learning_checkpoint($1,$2,$3,$4,$5) result',[action,kind,'A1.1',state,revision])
 try {
  await t.test('fresh device restores exact account state; transport replay is idempotent', async () => {
   await as(student)
   assert.equal((await rpc('get','vocabulary')).checkpoint,null)
   const state={queue:['first','retry'],index:1,round:2}
   const saved=await rpc('save','vocabulary',state,0)
   assert.equal(saved.checkpoint.revision,1)
   await as(student) // fresh authenticated session, no browser storage
   assert.deepEqual((await rpc('get','vocabulary')).checkpoint.state,state)
   assert.equal((await rpc('save','vocabulary',state,0)).checkpoint.revision,1)
   const newer=await rpc('save','vocabulary',{queue:['retry'],index:0},1)
   assert.equal(newer.checkpoint.revision,2)
   const stale=await rpc('save','vocabulary',state,1)
   assert.equal(stale.error,'conflict')
   assert.deepEqual(stale.checkpoint.state,newer.checkpoint.state)
  })
  await t.test('cross account, unauthenticated and forged direct writes are blocked', async () => {
   await as(outsider)
   assert.equal((await rpc('get','vocabulary')).error,'not_authorized')
   assert.equal((await db.query('SELECT * FROM public.sitov_learning_checkpoints')).rows.length,0)
   await assert.rejects(db.query("UPDATE public.sitov_learning_checkpoints SET state='{}'"),/permission denied/)
   await as(null)
   assert.equal((await rpc('get','vocabulary')).error,'not_authenticated')
   await db.exec('RESET ROLE')
   await db.query("INSERT INTO student_level_access(auth_user_id,level) VALUES($1,'A1.1')",[outsider])
   await as(outsider)
   assert.equal((await rpc('get','vocabulary')).checkpoint,null)
  })
  await t.test('trainer revocation and invalid payloads cannot create checkpoints', async () => {
   await as(student)
   assert.equal((await rpc('save','videos',[],0)).error,'invalid_input')
   assert.equal((await rpc('save','videos',{large:'x'.repeat(262145)},0)).error,'invalid_input')
   await db.exec('RESET ROLE')
   await db.query("INSERT INTO learning_trainer_grants(auth_user_id,level,trainer,enabled) VALUES($1,'A1.1','videos',false)",[student])
   await as(student)
   assert.equal((await rpc('save','videos',{progress:{}},0)).error,'not_authorized')
  })
  await t.test('level reset creates tombstones and stale devices cannot resurrect sessions', async () => {
   await as(teacher)
   await db.query("SELECT public.reset_student_level_progress($1,'A1.1')",[student])
   await as(student)
   const cleared=await rpc('get','vocabulary')
   assert.deepEqual(cleared.checkpoint.state,{})
   assert.equal(cleared.checkpoint.revision,3)
   assert.equal((await rpc('save','vocabulary',{index:999},2)).error,'conflict')
   assert.equal((await rpc('save','exercises',{exerciseIds:['old']},0)).error,'conflict')
  })
  await t.test('latest checkpoint chooses the same Home learning area on another device', async () => {
   await as(student)
   await rpc('save','pronunciation',{promptId:'saved-selection'},1)
   const activity=await result(db,'SELECT public.get_last_active_level() result')
   assert.equal(activity.level,'A1.1'); assert.equal(activity.mode,'pronunciation')
  })
  await t.test('full account reset blocks pending writes and creates missing-scope tombstones', async () => {
   await as(outsider)
   const token=await result(db,"SELECT public.begin_learning_reset('RESET_LEARNING_DATA') result")
   assert.equal(typeof token,'string')
   assert.equal((await rpc('save','exercises',{currentIndex:8},0)).error,'request_failed')
   assert.equal(await result(db,'SELECT public.finish_learning_reset($1) result',[token]),true)
   assert.deepEqual((await rpc('get','exercises')).checkpoint.state,{})
   assert.equal((await rpc('save','exercises',{currentIndex:8},0)).error,'conflict')
   await as(student)
   assert.equal((await rpc('get','pronunciation')).checkpoint.state.promptId,'saved-selection')
  })
  await t.test('reapplying migration preserves existing state and ACLs', async () => {
   await db.exec('RESET ROLE')
   const before=(await db.query('SELECT * FROM sitov_learning_checkpoints ORDER BY kind')).rows
   await apply(db,['61_account_learning_checkpoints.sql'])
   assert.deepEqual((await db.query('SELECT * FROM sitov_learning_checkpoints ORDER BY kind')).rows,before)
   assert.equal((await db.query("SELECT has_function_privilege('anon','public.sitov_learning_checkpoint(text,text,text,jsonb,bigint)','execute') allowed")).rows[0].allowed,false)
  })
 } finally { await db.close() }
})
