import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createCurrentDatabase, currentFeatureMigrations, student, teacher, outsider, id, apply, actor, result } from './helpers/current-db.mjs'

const migration='88_sitov_independent_simulation_levels.sql'
const admin=id(980),run=id(981),request=id(982)
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8')
const latest=[...currentFeatureMigrations,'59_daily_quests.sql','60_daily_quest_resume.sql','61_account_learning_checkpoints.sql','62_verb_trainer_enums.sql','63_verb_trainer.sql','64_daily_quest_male_characters.sql','65_sitov_verb_learning_progress.sql','66_sitov_pronunciation_readiness.sql','67_sitov_daily_quest_catalog.sql','68_sitov_confirmed_registration_monthly_access.sql','69_sitov_audio_preparation_requests.sql','70_sitov_prepared_own_vocabulary.sql','71_sitov_prepared_learning_publication.sql','72_sitov_prepared_path_publication.sql','73_sitov_exam_preparation.sql','74_sitov_vocabulary_chunks_import.sql','75_sitov_exam_simulation.sql','76_sitov_simulation_feature_access.sql','77_sitov_simulation_staff_reset.sql','78_sitov_simulation_teacher_management.sql','85_sitov_upper_levels.sql','86_sitov_release_upper_levels.sql']
const allowed=(db,learner,level)=>result(db,'SELECT sitov_simulation_private.level_allowed($1,$2) result',[learner,level])
const snapshot=()=>({id:run,version:1,level:'B1',provider:'telc',mode:'practice',status:'active',startedAt:'2026-10-07T08:00:00Z',expiresAt:'2099-10-07T11:00:00Z',tasks:[{id:'sitov-independent-existing',correctAnswer:'secret'}],answers:{},coverage:{fullExam:false}})

await test('simulation grants are independent from trainer levels, preserve evidence and enforce per-level access (88)',async t=>{
 const db=await createCurrentDatabase({latest,beforeLatest:db=>db.exec("INSERT INTO cefr_levels VALUES('A2'),('B1'),('B2'),('C1') ON CONFLICT DO NOTHING; INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('A1.2','A1',2),('A2.1','A2',3),('A2.2','A2',4),('B1.1','B1',5),('B1.2','B1',6) ON CONFLICT DO NOTHING")})
 try{
  await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[admin,`${admin}@independent.test`])
  await db.query("INSERT INTO profiles(id,role) VALUES($1,'admin')",[admin])
  await db.query('DELETE FROM student_level_access WHERE auth_user_id=$1',[student])
  await db.query("INSERT INTO student_level_access(auth_user_id,level) VALUES($1,'B1.2'),($1,'B2.1'),($2,'A1.1') ON CONFLICT DO NOTHING",[student,outsider])
  await db.query('SELECT sitov_assign_simulation_student($1,$2)',[student,teacher])
  await db.query("INSERT INTO sitov_simulation_level_grants(student_id,level,granted_by) VALUES($1,'C2',$2)",[student,admin])
  const data=snapshot()
  await db.query("INSERT INTO sitov_simulation_runs(id,student_id,level,provider,mode,status,started_at,expires_at,start_request_id,start_request_hash,server_snapshot) VALUES($1,$2,'B1','telc','practice','active',$3,$4,$5,'hash',$6)",[run,student,data.startedAt,data.expiresAt,request,data])
  const before=(await db.query('SELECT server_snapshot FROM sitov_simulation_runs WHERE id=$1',[run])).rows[0].server_snapshot
  await apply(db,[migration])

  await t.test('one-time backfill preserves current derived exam access only for personally entitled pupils',async()=>{
   assert.deepEqual((await db.query('SELECT level FROM sitov_simulation_level_grants WHERE student_id=$1 ORDER BY level',[student])).rows.map(r=>r.level),['B1','B2','C2'])
   assert.equal((await db.query('SELECT count(*)::int n FROM sitov_simulation_level_grants WHERE student_id=$1',[outsider])).rows[0].n,0)
   assert.equal(await allowed(db,student,'B1'),true)
   assert.equal(await allowed(db,student,'B2'),true)
   assert.equal(await allowed(db,student,'C2'),false)
   assert.deepEqual((await db.query('SELECT server_snapshot FROM sitov_simulation_runs WHERE id=$1',[run])).rows[0].server_snapshot,before)
  })
  await t.test('all offered exams are separately grantable without opening trainer levels',async()=>{
   await db.exec('SET ROLE service_role')
   for(const level of ['A1','A2','B1','B2','C1']){
    await db.query('INSERT INTO sitov_simulation_level_grants(student_id,level,granted_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[student,level,teacher])
    assert.equal(await allowed(db,student,level),true,level)
   }
   await db.exec('RESET ROLE')
   assert.equal((await db.query("SELECT count(*)::int n FROM student_level_access WHERE auth_user_id=$1 AND level IN('A1.1','A1.2','A2.1','A2.2','C1.1','C1.2')",[student])).rows[0].n,0)
   await db.query("DELETE FROM student_level_access WHERE auth_user_id=$1 AND level IN('B1.2','B2.1')",[student])
   assert.equal(await allowed(db,student,'B1'),true)
   assert.equal(await allowed(db,student,'B2'),true)
  })
  await t.test('revocation rejects stale answer receipt replays and tickets while evidence may be closed',async()=>{
   await db.exec('SET ROLE service_role')
   const updated={...data,answers:{'sitov-independent-existing':'a'}}
   assert.equal((await result(db,'SELECT sitov_store_simulation_change($1,$2,0,$3,$4,\'answer\',\'hash\') result',[run,student,updated,id(983)])).revision,1)
   const issued=`${student}/speaking/${id(985)}.webm`,preparation=`${student}/speaking/${id(986)}.webm`
   await db.query("INSERT INTO sitov_exam_upload_tickets(path,student_id,kind,simulation_run_id) VALUES($1,$2,'speaking',$3)",[issued,student,run])
   await db.query("INSERT INTO sitov_exam_upload_tickets(path,student_id,kind) VALUES($1,$2,'speaking')",[preparation,student])
   await db.query("DELETE FROM sitov_simulation_level_grants WHERE student_id=$1 AND level='B1'",[student])
   await assert.rejects(db.query("SELECT sitov_store_simulation_change($1,$2,0,$3,$4,'answer','hash')",[run,student,updated,id(983)]),/simulation_level_not_granted/)
   await assert.rejects(db.query("INSERT INTO sitov_exam_upload_tickets(path,student_id,kind,simulation_run_id) VALUES($1,$2,'speaking',$3)",[`${student}/speaking/independent.webm`,student,run]),/simulation_level_not_granted/)
   await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('sitov-exam-submissions',$1)",[issued]),/simulation_level_not_granted/)
   await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('sitov-exam-submissions',$1)",[preparation])
   const closed={...updated,status:'completed',completedAt:'2026-10-07T09:00:00Z'}
   assert.equal((await result(db,"SELECT sitov_store_simulation_change($1,$2,1,$3,$4,'finish','finish') result",[run,student,closed,id(984)])).revision,2)
   await db.exec('RESET ROLE')
   assert.equal((await db.query('SELECT server_snapshot FROM sitov_simulation_runs WHERE id=$1',[run])).rows[0].server_snapshot.answers['sitov-independent-existing'],'a')
   await db.query("INSERT INTO student_level_access(auth_user_id,level) VALUES($1,'B1.2')",[student])
   assert.equal(await allowed(db,student,'B1'),false)
   await apply(db,[migration])
   assert.equal(await allowed(db,student,'B1'),false,'repeat migration must not recreate revoked grants')
  })
  await t.test('browser roles cannot change exam grants and staff cannot reopen retired trainer contexts',async()=>{
   for(const uid of [student,teacher,null]){
    await actor(db,uid)
    await assert.rejects(db.query('SELECT * FROM sitov_simulation_level_grants'),/permission denied/)
    await assert.rejects(db.query("INSERT INTO sitov_simulation_level_grants(student_id,level,granted_by) VALUES($1,'B1',$2)",[student,teacher]),/permission denied/)
    await db.exec('RESET ROLE')
   }
   await db.exec('SET ROLE service_role')
   await assert.rejects(db.query("INSERT INTO sitov_simulation_level_grants(student_id,level,granted_by) VALUES($1,'B1',$2)",[student,outsider]),/unauthorized_simulation_level_grant/)
   await db.exec('RESET ROLE')
   await actor(db,teacher)
   for(const level of ['B2','C1','C1.1']){
    assert.equal((await result(db,"SELECT set_student_trainer_access($1,$2,'verbs',true) result",[student,level])).error,'invalid_input')
    assert.equal(await result(db,'SELECT sitov_verb_private.level_allowed($1,$2) result',[student,level]),false)
    assert.equal(await result(db,'SELECT sitov_verb_private.level_allowed($1,$2) result',[teacher,level]),false)
   }
   await db.exec('RESET ROLE')
   assert.equal((await db.query("SELECT count(*)::int n FROM learning_units WHERE level IN('B2','C1') AND trainer='verbs' AND is_active")).rows[0].n,0)
   assert.ok((await db.query("SELECT count(*)::int n FROM sitov_verb_catalog WHERE level IN('B2','C1')")).rows[0].n>0,'authored records retained')
  })
  await t.test('migration copies remain identical and the native smoke rolls back',async()=>{
   const sql=read(`../vps/${migration}`)
   assert.equal(sql,read('../migrations/20261007110044_sitov_independent_simulation_levels.sql'))
   assert.ok(read('../schema.sql').includes(`-- Consolidated correction: ${migration}\n${sql}`))
   const smoke=read('../../deploy/vps/tests/sitov-independent-simulation-levels.sql')
   assert.equal(smoke.split('-- BEGIN MIGRATION 88\n')[1].split('-- END MIGRATION 88\n')[0],sql)
   await db.exec('ALTER TABLE auth.users ADD COLUMN aud text,ADD COLUMN role text,ADD COLUMN updated_at timestamptz;')
   const count=(await db.query('SELECT count(*)::int n FROM profiles')).rows[0].n
   const output=await db.exec(smoke.replace(/^\\set.*$/mg,''))
   assert.equal(output.at(-1).rows[0].result,'sitov_independent_simulation_levels_ok')
   assert.equal((await db.query('SELECT count(*)::int n FROM profiles')).rows[0].n,count)
  })
 }catch(error){delete error.query;throw error}finally{await db.close()}
})
