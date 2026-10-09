import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { sitovLoadIntegrated96, createSitovIntegrated96NativeDatabase } from './helpers/sitov-night-integrated96-native-db.mjs'
import { sitovLoadInstallTarget, sitovVerifyPinnedContent, sitovHistorySnapshot, sitovRightsSnapshot, sitovUsers } from './helpers/sitov-night-current-db.mjs'
import { SitovNativeDatabase } from './helpers/sitov-night-current-native-db.mjs'

test('frozen integrated96 has exact reviewed overlays and independently pinned baseline92',async()=>{
 const {plan,overlays}=await sitovLoadIntegrated96()
 const {schema}=await sitovLoadInstallTarget({target:'baseline92'})
 const combined=schema+overlays.map((sql,index)=>`\n-- SITOV-NIGHT integrated overlay ${plan.overlays[index].name}\n${sql}`).join('')
 sitovVerifyPinnedContent(combined,plan.canonicalSha256,'combined target')
 // The 96 installer stays pinned even after later canonical overlays are added.
 const canonicalSourceSha='67bc5dfb711df423423d252c1b119c368616c57a'
 const pinnedSource=execFileSync('git',['show',`${canonicalSourceSha}:supabase/schema.sql`],{encoding:'utf8',maxBuffer:4*1024*1024})
 assert.equal(pinnedSource,combined)
 for(const [index,item] of plan.overlays.entries()){
  assert.equal(await readFile(new URL(`../migrations/${item.name}`,import.meta.url),'utf8'),overlays[index])
  assert.throws(()=>sitovVerifyPinnedContent(overlays[index]+'SELECT 97;',item.sha256,item.name),/checksum mismatch/)
 }
})

test('native combined93–96 preserves baseline rights/history and replays without opening authored audio',async()=>{
 const database=`sitov_night_combined_${process.pid}`;const admin=new SitovNativeDatabase()
 admin.raw(`CREATE DATABASE ${database}`)
 let db
 try {
  db=await createSitovIntegrated96NativeDatabase({database,captureBefore:async connection=>({history:await sitovHistorySnapshot(connection),rights:await sitovRightsSnapshot(connection)})})
  assert.deepEqual(await sitovHistorySnapshot(db),db.beforeOverlayHistory.history)
  const after=await sitovRightsSnapshot(db)
  const changes=Object.keys(after).flatMap(user=>after[user].flatMap((row,index)=>JSON.stringify(row)===JSON.stringify(db.beforeOverlayHistory.rights[user][index])?[]:[{user,before:db.beforeOverlayHistory.rights[user][index],after:row}]))
  // The approved change removes the old German-language commercial ban.
  // Stored-native vocabulary input still has its separate source requirement.
  assert.equal(changes.length,8)
  for(const change of changes){
   assert.equal(change.user,'german')
   assert.equal(change.before.trainer_allowed,false);assert.equal(change.before.unit_allowed,false)
   assert.deepEqual(change.after,{...change.before,trainer_allowed:true,unit_allowed:true})
  }
  assert.deepEqual(after,{...db.beforeOverlayHistory.rights,german:db.beforeOverlayHistory.rights.german.map(row=>({...row,trainer_allowed:true,unit_allowed:true}))})
  const {overlays}=await sitovLoadIntegrated96()
  for(const sql of overlays)await db.exec(`BEGIN; ${sql} COMMIT;`)
  assert.deepEqual(await sitovHistorySnapshot(db),db.beforeOverlayHistory.history)
  assert.deepEqual(await sitovRightsSnapshot(db),after)
  await db.actor(null,'postgres')
  assert.equal((await db.query("SELECT public FROM storage.buckets WHERE id='audio_cache'")).rows[0].public,false)
  await db.actor(sitovUsers.selected)
  await assert.rejects(db.query('SELECT * FROM sitov_pronunciation_private.pretest_question_audio_proofs'),/permission denied/)
  const access=(await db.query('SELECT get_sitov_access_context() AS access')).rows[0].access
  assert.equal(access.vip_enabled,false);assert.deepEqual(access.trial,{version:1,rules:[]})
  assert.deepEqual(access.purchased_levels,[])
 } finally {await db?.close();admin.raw(`DROP DATABASE ${database} WITH(FORCE)`)}
})
