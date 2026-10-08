import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile, mkdtemp, mkdir, copyFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { sitovCurrentSchema, sitovPinnedLookups, sitovBaseline92, sitovVerifyPinnedContent, sitovCurrentPlan, sitovRightsSnapshot, sitovHistorySnapshot, sitovUsers, sitovId } from './helpers/sitov-night-current-db.mjs'
import { SitovNativeDatabase, createSitovCurrentNativeDatabase } from './helpers/sitov-night-current-native-db.mjs'

test('reviewed runner inventory covers every migration through 92, excludes 93',async()=>{
 const plan=await sitovCurrentPlan()
 assert.equal(plan.migrations.length,92)
 assert.equal(plan.migrations.at(-1).name,'92_sitov_verb_vocabulary_parity.sql')
 assert.deepEqual(plan.migrations.filter(m=>m.transaction==='autocommit').map(m=>m.name),['08_performance_indexes.sql'])
 assert.equal(plan.migrations.find(m=>m.name.startsWith('62_')).transaction,'separate')
})

test('an expanded canonical schema/seed beside the helper cannot contaminate baseline92',async()=>{
 const root=await mkdtemp(join(tmpdir(),'sitov-baseline92-'))
 try {
  const helpers=join(root,'supabase/tests/helpers'),fixtures=join(root,'supabase/tests/fixtures')
  await mkdir(helpers,{recursive:true});await mkdir(fixtures,{recursive:true})
  await mkdir(join(root,'supabase/seeds'),{recursive:true})
  await copyFile(new URL('./helpers/sitov-night-current-db.mjs',import.meta.url),join(helpers,'plan.mjs'))
  await copyFile(sitovCurrentSchema,join(fixtures,'sitov-night-current92-schema.sql'))
  await copyFile(sitovPinnedLookups,join(fixtures,'sitov-night-current92-lookups.sql'))
  await writeFile(join(root,'supabase/schema.sql'),'DO $$ BEGIN RAISE EXCEPTION \'unassigned-future-schema\'; END $$;')
  await writeFile(join(root,'supabase/seeds/vps-content.sql'),'SELECT unassigned_future_seed;')
  const copied=await import(pathToFileURL(join(helpers,'plan.mjs')).href)
  assert.equal((await copied.sitovCurrentPlan()).schemaSha256,sitovBaseline92.schemaSha256)
  await writeFile(join(fixtures,'sitov-night-current92-schema.sql'),'SELECT corrupt_baseline;')
  await assert.rejects(copied.sitovCurrentPlan(),/checksum mismatch/)
 } finally {await rm(root,{recursive:true,force:true})}
})

test('baseline92 pins exact e22 bytes and fails closed on altered checksum or future target',async()=>{
 const schema=await readFile(sitovCurrentSchema,'utf8')
 const assigned=execFileSync('git',['show',`${sitovBaseline92.sourceSha}:${sitovBaseline92.sourcePath}`],{encoding:'utf8',maxBuffer:8*1024*1024})
 assert.equal(schema,assigned)
 assert.equal(sitovCurrentSchema.pathname.endsWith('/fixtures/sitov-night-current92-schema.sql'),true)
 assert.throws(()=>sitovVerifyPinnedContent(schema+'\nSELECT 93;',sitovBaseline92.schemaSha256,'schema'),/checksum mismatch/)
 await assert.rejects(sitovCurrentPlan({target:'canonical'}),/Unsupported/)
 await assert.rejects(createSitovCurrentNativeDatabase({target:'integrated96',database:'not_a_database'}),/Unsupported/)
 assert.throws(()=>execFileSync(process.execPath,['scripts/sitov-night-current-db.mjs','plan','--target','canonical'],{stdio:'pipe'}),/Command failed/)
})

test('native PostgreSQL17: reproducible full current install, effective rights and private history',
 {skip:process.env.SITOV_NIGHT_NATIVE!=='1'},async t=>{
 const admin=new SitovNativeDatabase()
 const database=`sitov_night_schema_${process.pid}`
 admin.raw(`CREATE DATABASE ${database}`)
 let db
 try {
  const output=execFileSync(process.execPath,['scripts/sitov-night-current-db.mjs','install',
   '--target','baseline92','--database',database],{encoding:'utf8',maxBuffer:1024*1024})
  db=new SitovNativeDatabase(database)
  db.installPlan=JSON.parse(output).plan
  assert.equal(db.installPlan.target,'baseline92')
  assert.deepEqual((await db.query('SELECT target,source_sha,schema_sha256,reviewed_through FROM sitov_qa_fixture.installation')).rows,
   [{target:'baseline92',source_sha:sitovBaseline92.sourceSha,schema_sha256:sitovBaseline92.schemaSha256,reviewed_through:92}])
  const cliSnapshot=JSON.parse(execFileSync(process.execPath,['scripts/sitov-night-current-db.mjs','snapshot',
   '--target','baseline92','--database',database],{encoding:'utf8',maxBuffer:1024*1024}))
  assert.equal(cliSnapshot.installation[0].target,'baseline92')
  assert.equal(cliSnapshot.history.storage.length,1)
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
