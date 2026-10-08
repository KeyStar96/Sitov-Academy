import test from 'node:test'
import assert from 'node:assert/strict'
import { sitovCurrentPlan, sitovRightsSnapshot, sitovHistorySnapshot, sitovUsers, sitovId } from './helpers/sitov-night-current-db.mjs'
import { SitovNativeDatabase, createSitovCurrentNativeDatabase } from './helpers/sitov-night-current-native-db.mjs'

test('reviewed runner inventory covers every migration through 92, excludes 93',async()=>{
 const plan=await sitovCurrentPlan()
 assert.equal(plan.migrations.length,92)
 assert.equal(plan.migrations.at(-1).name,'92_sitov_verb_vocabulary_parity.sql')
 assert.deepEqual(plan.migrations.filter(m=>m.transaction==='autocommit').map(m=>m.name),['08_performance_indexes.sql'])
 assert.equal(plan.migrations.find(m=>m.name.startsWith('62_')).transaction,'separate')
})

test('native PostgreSQL17: reproducible full current install, effective rights and private history',
 {skip:process.env.SITOV_NIGHT_NATIVE!=='1'},async t=>{
 const admin=new SitovNativeDatabase()
 const database=`sitov_night_schema_${process.pid}`
 admin.raw(`CREATE DATABASE ${database}`)
 let db
 try {
  db=await createSitovCurrentNativeDatabase({database})
  await t.test('current security/media/pronunciation/verb definitions are effective',async()=>{
   const rows=(await db.query(`SELECT
    position('sitov-media-visibility-v1' in pg_get_functiondef('public.get_learning_progress(uuid,text,integer)'::regprocedure))>0 media_current,
    position('sitov-verb-vocabulary-parity-v1' in pg_get_functiondef('public.get_learning_progress(uuid,text,integer)'::regprocedure))>0 verbs_current,
    position('typed_answer' in pg_get_functiondef('sitov_pronunciation_private.evidence(uuid)'::regprocedure))>0 recall_current,
    (SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass) storage_rls,
    NOT has_table_privilege('authenticated','public.sitov_verb_challenges','SELECT') answer_keys_private,
    (SELECT count(*) FROM public.sitov_verb_catalog) verb_count`)).rows[0]
   assert.deepEqual({...rows,verb_count:0},{media_current:true,verbs_current:true,recall_current:true,storage_rls:true,answer_keys_private:true,verb_count:0})
   assert.equal(rows.verb_count,960)
  })
  const snapshot=await sitovRightsSnapshot(db)
  await t.test('absent/all, selected-empty, selected subset, disabled and German UI semantics',()=>{
   for(const name of ['all','explicitAll','teacher']) assert.equal(snapshot[name].filter(r=>r.unit_allowed).length,8,name)
   for(const name of ['none','disabled','german','outsider']) assert.equal(snapshot[name].filter(r=>r.unit_allowed).length,0,name)
   assert.equal(snapshot.selected.filter(r=>r.unit_allowed).length,4)
   assert.ok(snapshot.selected.filter(r=>r.unit_allowed).every(r=>r.id.endsWith('1')))
  })
  await t.test('legacy hard access, playback/recording checkpoint, progress and streak evidence exist',async()=>{
   await db.actor(null,'postgres')
   const row=(await db.query(`SELECT
    (SELECT mode FROM public.sitov_pronunciation_access WHERE auth_user_id='${sitovUsers.selected}') mode,
    (SELECT revision FROM public.sitov_learning_checkpoints WHERE auth_user_id='${sitovUsers.selected}') revision,
    (SELECT state->>'stage' FROM public.sitov_learning_checkpoints WHERE auth_user_id='${sitovUsers.selected}') stage,
    (SELECT count(*) FROM public.vocabulary_direction_progress WHERE auth_user_id='${sitovUsers.selected}') progress,
    (SELECT count(*) FROM public.learning_activity_days WHERE auth_user_id='${sitovUsers.selected}' AND day IN('2026-09-29','2026-09-30')) days`)).rows[0]
   assert.deepEqual(row,{mode:'hard',revision:7,stage:'recording',progress:1,days:2})
   const history=await sitovHistorySnapshot(db)
   assert.equal(history.messages.length,1)
   assert.equal(history.storage.length,1)
   assert.deepEqual(await sitovHistorySnapshot(db),history,'Snapshot must not mutate history')
  })
  await t.test('actual authenticated role/RLS separates own and foreign conversation/audio metadata',async()=>{
   for(const [user,count] of [[sitovUsers.selected,1],[sitovUsers.outsider,0]]) {
    await db.actor(user)
    assert.equal((await db.query(`SELECT id FROM public.submissions WHERE id='${sitovId(304)}'`)).rows.length,count)
    assert.equal((await db.query(`SELECT id FROM public.pronunciation_messages WHERE id='${sitovId(306)}'`)).rows.length,count)
    assert.equal((await db.query(`SELECT id FROM storage.objects WHERE id='${sitovId(305)}'`)).rows.length,count)
   }
  })
 } finally {
  await db?.close()
  admin.raw(`DROP DATABASE ${database}`)
 }
})
