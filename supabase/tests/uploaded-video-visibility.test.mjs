import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createPhase3Database,apply,actor,id,student,teacher,outsider,result} from './helpers/phase3-db.mjs'

await test('uploaded videos use level publication across metadata, unit joins and Storage',async t=>{
 const db=await createPhase3Database(), folder=id(810),video=id(811)
 const path=`A1.1/${folder}/videos/${video}.mp4`
 const read=async table=>(await db.query(`SELECT * FROM ${table} WHERE ${table==='learning_videos'?'id':'id'}=$1`,[video])).rows
 const allowed=()=>result(db,'SELECT media_private.path_allowed($1,false) result',[path])
 try {
  await apply(db,['10_rls_performance.sql','12_media_upload.sql'])
  await actor(db,teacher)
  await db.query("INSERT INTO lms_media_folder(folder_id,level,title) VALUES($1,'A1.1','Uploaded videos')",[folder])
  await db.query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('course-assets',$1,'{\"size\":100,\"mimetype\":\"video/mp4\"}')",[path])
  assert.deepEqual(await result(db,'SELECT complete_media_upload($1) result',[JSON.stringify({asset_id:video,folder_id:folder,title:'Alphabet',file_name:'alphabet.mp4',storage_path:path,mime_type:'video/mp4',file_size:100})]),{asset_id:video})
  await db.exec('RESET ROLE')
  await db.query("UPDATE profiles SET ui_language='de' WHERE id=$1",[student])
  await db.query("INSERT INTO learning_trainer_grants(auth_user_id,level,trainer,enabled,unit_mode) VALUES($1,'A1.1','videos',false,'selected')",[student])
  await t.test('reproduces the additional trainer gate before the fix',async()=>{
   await actor(db,student);assert.equal((await read('learning_videos')).length,0);assert.equal(await allowed(),false)
  })
  await t.test('level-only learner can read the uploaded video and its unit, including German UI',async()=>{
   await db.exec('RESET ROLE');await apply(db,['16_uploaded_video_visibility.sql']);await apply(db,['16_uploaded_video_visibility.sql'])
   await actor(db,student)
   assert.equal((await read('learning_videos')).length,1);assert.equal((await read('learning_units')).length,1)
   assert.equal(await allowed(),true)
   assert.equal((await db.query("SELECT name FROM storage.objects WHERE bucket_id='course-assets' AND name=$1",[path])).rows.length,1)
  })
  await t.test('hiding revokes metadata and new signed-file access, while staff can still preview',async()=>{
   await actor(db,teacher);await db.query('UPDATE learning_units SET is_active=false WHERE id=$1',[video])
   await actor(db,student);assert.equal((await read('learning_videos')).length,0);assert.equal((await read('learning_units')).length,0);assert.equal(await allowed(),false)
   assert.equal((await db.query("SELECT name FROM storage.objects WHERE bucket_id='course-assets' AND name=$1",[path])).rows.length,0)
   await actor(db,teacher);assert.equal((await read('learning_videos')).length,1);assert.equal(await allowed(),true)
   await db.query('UPDATE learning_units SET is_active=true WHERE id=$1',[video])
   await actor(db,student);assert.equal((await read('learning_videos')).length,1);assert.equal(await allowed(),true)
  })
  await t.test('students cannot publish and level revocation takes effect on the next statement',async()=>{
   await actor(db,student)
   assert.equal((await db.query('UPDATE learning_units SET is_active=false WHERE id=$1 RETURNING id',[video])).rows.length,0)
   await actor(db,outsider);assert.equal((await read('learning_videos')).length,0);assert.equal(await allowed(),false)
   await db.exec('RESET ROLE');await db.query("DELETE FROM student_level_access WHERE auth_user_id=$1 AND level='A1.1'",[student])
   await actor(db,student);assert.equal(await allowed(),false)
   await db.exec('RESET ROLE');await db.query("INSERT INTO student_level_access VALUES($1,'A1.1')",[student])
  })
  await t.test('rollback and replay preserve video bytes, metadata and publication state',async()=>{
   const before=(await read('learning_videos'))[0]
   await db.exec(await readFile(new URL('../vps/rollback/16_uploaded_video_visibility.sql',import.meta.url),'utf8'))
   await actor(db,student);assert.equal(await allowed(),false)
   await db.exec('RESET ROLE');await apply(db,['16_uploaded_video_visibility.sql'])
   assert.deepEqual((await read('learning_videos'))[0],before)
   assert.equal((await db.query("SELECT has_function_privilege('anon','media_private.published_video_unit_ids()','EXECUTE') allowed")).rows[0].allowed,false)
  })
  await t.test('placeholder cleanup is exact, replayable and preserves real uploads',async()=>{
   const seeds=[['133379c3-b347-4226-bd70-b6c530e2c849','Nicos Weg - Folge 1: Hallo!','https://learngerman.dw.com/de/hallo/l-37250531'],['b3034c99-e5c4-4214-845a-5a9fe0e0a518','Nicos Weg - Folge 2: Wie heißt du?','https://learngerman.dw.com/de/wie-heißt-du/l-37250532'],['22b3247e-f35d-4f26-ac8a-031c6177dce7','Aussprache: Umlaute (In Vorbereitung)',null]]
   for(const [uid,label,url] of seeds){
    await db.query("INSERT INTO learning_units(id,level,trainer,label,is_active) VALUES($1,'A1.1','videos',$2,$3)",[uid,label,url!==null])
    await db.query('INSERT INTO learning_videos(id,unit_id,source_url) VALUES($1,$1,$2)',[uid,url])
   }
   await apply(db,['17_remove_video_placeholders.sql']);await apply(db,['17_remove_video_placeholders.sql'])
   assert.equal((await db.query('SELECT id FROM learning_videos')).rows.length,1)
   assert.equal((await read('learning_videos')).length,1)
   assert.equal((await db.query('SELECT id FROM learning_units WHERE id=ANY($1::uuid[])',[seeds.map(x=>x[0])])).rows.length,0)
   const [uid,label,url]=seeds[0]
   await db.query("INSERT INTO learning_units(id,level,trainer,label,is_active) VALUES($1,'A1.1','videos',$2,$3)",[uid,label,url!==null])
   await db.query("INSERT INTO learning_videos(id,unit_id,title,source_url) VALUES($1,$1,'Replaced by teacher',$2)",[uid,url])
   await apply(db,['17_remove_video_placeholders.sql'])
   assert.equal((await db.query('SELECT id FROM learning_videos WHERE id=$1',[uid])).rows.length,1)
  })
 } finally {await db.close()}
})
