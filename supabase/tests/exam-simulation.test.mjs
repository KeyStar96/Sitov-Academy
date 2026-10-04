import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createCurrentDatabase,currentFeatureMigrations,actor,student,teacher,outsider,id,result,apply} from './helpers/current-db.mjs'
const run=id(601),request=id(602),answerRequest=id(603),admin=id(650)
function snapshot(uid=run,overrides={}){
 return {id:uid,version:1,level:'B1',provider:'telc',mode:'practice',status:'active',startedAt:'2026-10-04T08:00:00.000Z',expiresAt:'2099-10-04T08:50:00.000Z',tasks:[{id:'sitov-task',correctAnswer:'secret-key'}],answers:{},coverage:{fullExam:false},...overrides}
}
async function grantFeature(db,learner=student,by=admin){await db.query('INSERT INTO sitov_simulation_feature_grants(student_id,granted_by) VALUES($1,$2)',[learner,by])}
async function fixture({grant=true,insert=true}={}){
 const db=await createCurrentDatabase({latest:[...currentFeatureMigrations,'59_daily_quests.sql','60_daily_quest_resume.sql','61_account_learning_checkpoints.sql','73_sitov_exam_preparation.sql','75_sitov_exam_simulation.sql','76_sitov_simulation_feature_access.sql','77_sitov_simulation_staff_reset.sql']})
 await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[admin,`${admin}@example.test`])
 await db.query("INSERT INTO profiles(id,role,native_language,ui_language) VALUES($1,'admin','de','de')",[admin])
 if(grant)await grantFeature(db)
 if(insert)await db.query("INSERT INTO sitov_simulation_runs(id,student_id,level,provider,mode,status,started_at,expires_at,start_request_id,start_request_hash,server_snapshot) VALUES($1,$2,'B1','telc','practice','active',$3,$4,$5,'start-hash',$6)",[run,student,snapshot().startedAt,snapshot().expiresAt,request,snapshot()]);return db
}
async function store(db,data,revision,uid=answerRequest,hash='answer-hash',kind='answer'){
 return result(db,'SELECT sitov_store_simulation_change($1,$2,$3,$4,$5,$6,$7) result',[run,student,revision,data,uid,kind,hash])
}
test('simulation CLI/VPS/schema copies stay identical',()=>{
 const sql=readFileSync(new URL('../vps/75_sitov_exam_simulation.sql',import.meta.url),'utf8')
 assert.equal(sql,readFileSync(new URL('../migrations/20261004090459_sitov_exam_simulation.sql',import.meta.url),'utf8'))
 assert.equal(readFileSync(new URL('../schema.sql',import.meta.url),'utf8').split('-- BEGIN SITOV EXAM SIMULATION\n')[1].split('-- END SITOV EXAM SIMULATION\n')[0],sql)
 const feature=readFileSync(new URL('../vps/76_sitov_simulation_feature_access.sql',import.meta.url),'utf8')
 assert.equal(feature,readFileSync(new URL('../migrations/20261004120453_sitov_simulation_feature_access.sql',import.meta.url),'utf8'))
 assert.equal(readFileSync(new URL('../schema.sql',import.meta.url),'utf8').split('-- BEGIN SITOV SIMULATION FEATURE ACCESS\n')[1].split('-- END SITOV SIMULATION FEATURE ACCESS\n')[0],feature)
})
test('solution snapshots and mutation RPC are inaccessible to all browser roles',async()=>{
 const db=await fixture();try{
  for(const uid of [student,outsider,null]){
   await actor(db,uid);await assert.rejects(db.query('SELECT server_snapshot FROM sitov_simulation_runs'),/permission denied/)
   await assert.rejects(db.query('SELECT * FROM sitov_simulation_receipts'),/permission denied/)
   await assert.rejects(store(db,snapshot(),0),/permission denied/);await db.exec('RESET ROLE')
  }
 }finally{await db.close()}
})
test('complete universal simulations coexist with immutable legacy histories and reject partial coverage',async()=>{
 const db=await fixture();try{
  const uid=id(640),data=snapshot(uid,{provider:'sitov',mode:'exam',coverage:{fullExam:true,missing:[]}})
  await grantFeature(db,outsider)
  const insert=payload=>db.query("INSERT INTO sitov_simulation_runs(id,student_id,level,provider,mode,status,started_at,expires_at,start_request_id,start_request_hash,server_snapshot) VALUES($1,$2,'B1','sitov','exam','active',$3,$4,$5,'universal-hash',$6)",[uid,outsider,data.startedAt,data.expiresAt,id(641),payload])
  await assert.rejects(insert({...data,coverage:{fullExam:false,missing:['listening']}}),/incomplete_universal_simulation/)
  await insert(data)
  await apply(db,['75_sitov_exam_simulation.sql'])
  assert.deepEqual((await db.query('SELECT provider FROM sitov_simulation_runs ORDER BY provider')).rows.map(row=>row.provider),['sitov','telc'])
  assert.equal((await db.query('SELECT server_snapshot FROM sitov_simulation_runs WHERE id=$1',[run])).rows[0].server_snapshot.tasks[0].correctAnswer,'secret-key')
 }finally{await db.close()}
})
test('advanced grants need trusted assigned staff, stay outside legacy grants and are browser-private',async()=>{
 const db=await fixture();try{
  await assert.rejects(db.query("INSERT INTO sitov_simulation_level_grants(student_id,level,granted_by) VALUES($1,'C1',$2)",[student,student]),/unauthorized_simulation_level_grant/)
  await assert.rejects(db.query("INSERT INTO sitov_simulation_level_grants(student_id,level,granted_by) VALUES($1,'C1',$2)",[student,teacher]),/unauthorized_simulation_level_grant/)
  await db.query("UPDATE profiles SET role='admin' WHERE id=$1",[teacher])
  await db.exec('SET ROLE service_role')
  await db.query("INSERT INTO sitov_simulation_level_grants(student_id,level,granted_by) VALUES($1,'C1',$2)",[student,teacher])
  await db.exec('RESET ROLE')
  assert.equal((await db.query("SELECT count(*)::int n FROM student_level_access WHERE auth_user_id=$1 AND level='C1'",[student])).rows[0].n,0)
  await actor(db,student);await assert.rejects(db.query('SELECT * FROM sitov_simulation_level_grants'),/permission denied/)
  const token=await result(db,"SELECT begin_learning_reset('RESET_LEARNING_DATA') result")
  assert.equal(await result(db,'SELECT finish_learning_reset($1) result',[token]),true)
  await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*)::int n FROM sitov_simulation_level_grants')).rows[0].n,1)
  await actor(db,student);await result(db,"SELECT delete_own_learning_profile('DELETE_LEARNING_PROFILE') result")
  await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*)::int n FROM sitov_simulation_level_grants')).rows[0].n,0)
 }finally{await db.close()}
})
test('the actual service role can commit through the invoker RPC without private reset helper privileges',async()=>{
 const db=await fixture();try{
  await db.exec('SET ROLE service_role')
  assert.equal((await store(db,snapshot(run,{answers:{'sitov-task':'a'}}),0)).revision,1)
 }finally{await db.close()}
})
test('assigned teachers may grant all advanced simulation levels but cannot change grants after reassignment',async()=>{
 const db=await fixture();try{
  await db.query("UPDATE profiles SET role='admin' WHERE id=$1",[outsider])
  await db.query('INSERT INTO sitov_exam_teacher_assignments(student_id,teacher_id,assigned_by) VALUES($1,$2,$3)',[student,teacher,outsider])
  await db.exec('SET ROLE service_role')
  for(const level of ['B2','C1','C2'])await db.query('INSERT INTO sitov_simulation_level_grants(student_id,level,granted_by) VALUES($1,$2,$3)',[student,level,teacher])
  await db.exec('RESET ROLE')
  assert.equal((await db.query('SELECT count(*)::int n FROM sitov_simulation_level_grants')).rows[0].n,3)
  await db.query('DELETE FROM sitov_exam_teacher_assignments WHERE student_id=$1',[student])
  await db.exec('SET ROLE service_role')
  await assert.rejects(db.query("UPDATE sitov_simulation_level_grants SET granted_at=clock_timestamp() WHERE student_id=$1 AND level='C1'",[student]),/unauthorized_simulation_level_grant/)
 }finally{await db.close()}
})
test('atomic updates are idempotent, detect concurrency and freeze assignments and completed answers',async()=>{
 const db=await fixture();try{
  const changed=snapshot(run,{answers:{'sitov-task':'a'}})
  const first=await store(db,changed,0);assert.equal(first.revision,1)
  assert.equal((await store(db,changed,0)).replayed,true)
  await assert.rejects(store(db,changed,1,answerRequest,'different'),/simulation_request_reused/)
  assert.deepEqual(await store(db,changed,0,id(604)),{conflict:true})
  await assert.rejects(store(db,{...changed,tasks:[{id:'different'}]},1,id(605)),/immutable_simulation_assignment/)
  await assert.rejects(store(db,{...changed,rubric:{version:1,skillMinimum:10}},1,id(642)),/immutable_simulation_assignment/)
  const completed={...changed,status:'completed',completedAt:'2026-10-04T08:25:00.000Z',result:{examPass:null}}
  assert.equal((await store(db,completed,1,id(606),'finish-hash','finish')).revision,2)
  await assert.rejects(store(db,{...completed,answers:{'sitov-task':'b'}},2,id(607),'review-hash','review'),/completed_simulation_is_frozen/)
  assert.equal((await db.query('SELECT count(*)::int n FROM sitov_simulation_receipts')).rows[0].n,2)
  await apply(db,['75_sitov_exam_simulation.sql']);assert.equal((await db.query('SELECT server_snapshot FROM sitov_simulation_runs')).rows[0].server_snapshot.tasks[0].correctAnswer,'secret-key')
 }finally{await db.close()}
})
test('server deadline rejects late answers but allows finalizing the stored attempt',async()=>{
 const db=await fixture();try{
  const expiredId=id(610),expired=snapshot(expiredId,{startedAt:'2020-01-01T00:00:00Z',expiresAt:'2020-01-01T00:01:00Z'})
  await db.query('DELETE FROM sitov_simulation_runs WHERE id=$1',[run])
  await db.query("INSERT INTO sitov_simulation_runs(id,student_id,level,provider,mode,status,started_at,expires_at,start_request_id,start_request_hash,server_snapshot) VALUES($1,$2,'B1','telc','practice','active',$3,$4,$5,'start-hash',$6)",[expiredId,student,expired.startedAt,expired.expiresAt,request,expired])
  const rpc=(data,kind)=>result(db,'SELECT sitov_store_simulation_change($1,$2,0,$3,$4,$5,$6) result',[expiredId,student,data,answerRequest,kind,'hash'])
  await assert.rejects(rpc({...expired,answers:{'sitov-task':'a'}},'answer'),/simulation_time_expired/)
  assert.equal((await rpc({...expired,status:'completed',completedAt:'2020-01-01T00:01:00Z'},'finish')).revision,1)
 }finally{await db.close()}
})
test('global reset fences new writes and preserves simulation history alongside other learners preparation IDs',async()=>{
 const db=await fixture();try{
  await db.query("INSERT INTO sitov_exam_attempts(id,student_id,task_id,task_version,unit_id,answer,mode,request_id) VALUES($1,$2,'existing',1,'u','\"a\"','practice',$1)",[id(612),outsider])
  await actor(db,student);const token=await result(db,"SELECT begin_learning_reset('RESET_LEARNING_DATA') result")
  await db.exec('RESET ROLE');await assert.rejects(store(db,snapshot(),0),/learning_reset_in_progress/)
  await actor(db,student);assert.equal(await result(db,'SELECT finish_learning_reset($1) result',[token]),true)
  await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*)::int n FROM sitov_simulation_runs')).rows[0].n,1)
  assert.deepEqual((await db.query('SELECT server_snapshot FROM sitov_simulation_runs')).rows[0].server_snapshot,snapshot())
  assert.equal((await db.query('SELECT id FROM sitov_exam_attempts')).rows[0].id,id(612))
 }finally{await db.close()}
})
test('own account deletion cascades simulations and receipts',async()=>{
 const db=await fixture();try{
  await store(db,snapshot(run,{answers:{'sitov-task':'a'}}),0)
  await actor(db,student);assert.deepEqual(await result(db,"SELECT delete_own_learning_profile('DELETE_LEARNING_PROFILE') result"),{success:true,deleted:true})
  await db.exec('RESET ROLE');for(const table of ['sitov_simulation_runs','sitov_simulation_receipts'])assert.equal((await db.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n,0)
 }finally{await db.close()}
})
test('feature access starts absent for every level, remains browser-private, and only trusted assigned staff can grant it',async()=>{
 const db=await fixture({grant:false,insert:false});try{
  assert.equal((await db.query('SELECT count(*)::int n FROM sitov_simulation_feature_grants')).rows[0].n,0)
  await db.query("INSERT INTO sitov_simulation_level_grants(student_id,level,granted_by) VALUES($1,'C1',$2)",[student,admin])
  for(const [index,level] of ['A1','A2','B1','B2','C1','C2'].entries()){
   const data=snapshot(id(660+index),{level})
   await assert.rejects(db.query("INSERT INTO sitov_simulation_runs(id,student_id,level,provider,mode,status,started_at,expires_at,start_request_id,start_request_hash,server_snapshot) VALUES($1,$2,$3,'telc','practice','active',$4,$5,$6,'hash',$7)",[data.id,student,level,data.startedAt,data.expiresAt,id(670+index),data]),/simulation_feature_not_granted/)
  }
  await assert.rejects(grantFeature(db,student,student),/unauthorized_simulation_feature_grant/)
  await assert.rejects(grantFeature(db,student,teacher),/unauthorized_simulation_feature_grant/)
  await db.query('INSERT INTO sitov_exam_teacher_assignments(student_id,teacher_id,assigned_by) VALUES($1,$2,$3)',[student,teacher,admin])
  await db.exec('SET ROLE service_role');await grantFeature(db,student,teacher);await db.exec('RESET ROLE')
  await db.query('DELETE FROM sitov_exam_teacher_assignments WHERE student_id=$1',[student])
  await db.exec('SET ROLE service_role')
  await assert.rejects(db.query('UPDATE sitov_simulation_feature_grants SET granted_at=clock_timestamp() WHERE student_id=$1',[student]),/unauthorized_simulation_feature_grant/)
  await db.exec('RESET ROLE')
  for(const uid of [student,teacher,outsider,null]){
   await actor(db,uid)
   await assert.rejects(db.query('SELECT * FROM sitov_simulation_feature_grants'),/permission denied/)
   await assert.rejects(grantFeature(db),/permission denied/)
   await assert.rejects(db.query('DELETE FROM sitov_simulation_feature_grants'),/permission denied/)
   await db.exec('RESET ROLE')
  }
 }finally{await db.close()}
})
test('feature revoke fences atomic answers, finishes and receipt replays while preserving attempts and staff reviews',async()=>{
 const db=await fixture();try{
  const answered=snapshot(run,{answers:{'sitov-task':'a'}})
  await store(db,answered,0)
  await db.query('DELETE FROM sitov_simulation_feature_grants WHERE student_id=$1',[student])
  await db.exec('SET ROLE service_role')
  await assert.rejects(store(db,answered,0),/simulation_feature_not_granted/)
  const completed={...answered,status:'completed',completedAt:'2026-10-04T08:25:00.000Z',result:{examPass:null}}
  await assert.rejects(store(db,completed,1,id(676),'finish','finish'),/simulation_feature_not_granted/)
  await db.exec('RESET ROLE')
  assert.deepEqual((await db.query('SELECT server_snapshot FROM sitov_simulation_runs WHERE id=$1',[run])).rows[0].server_snapshot,answered)
  await grantFeature(db)
  await store(db,completed,1,id(676),'finish','finish')
  await db.query('DELETE FROM sitov_simulation_feature_grants WHERE student_id=$1',[student])
  await db.exec('SET ROLE service_role')
  const reviewed={...completed,result:{examPass:false,teacherReviews:{'sitov-task':{score:3}}}}
  assert.equal((await store(db,reviewed,2,id(677),'review','review')).revision,3)
  await db.exec('RESET ROLE')
  assert.equal((await db.query('SELECT count(*)::int n FROM sitov_simulation_runs')).rows[0].n,1)
 }finally{await db.close()}
})
test('signed simulation uploads are fenced after revoke while existing preparation tickets continue working',async()=>{
 const db=await fixture();try{
  const path=`${student}/speaking/${id(678)}.webm`,legacy=`${student}/speaking/${id(679)}.webm`
  await db.exec('SET ROLE service_role')
  await db.query("INSERT INTO sitov_exam_upload_tickets(path,student_id,kind,simulation_run_id) VALUES($1,$2,'speaking',$3)",[path,student,run])
  await db.query("INSERT INTO sitov_exam_upload_tickets(path,student_id,kind) VALUES($1,$2,'speaking')",[legacy,student])
  await db.query('DELETE FROM sitov_simulation_feature_grants WHERE student_id=$1',[student])
  await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('sitov-exam-submissions',$1)",[path]),/simulation_feature_not_granted/)
  await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('sitov-exam-submissions',$1)",[legacy])
  await grantFeature(db)
  await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('sitov-exam-submissions',$1)",[path])
  await db.exec('RESET ROLE')
  assert.equal((await db.query("SELECT count(*)::int n FROM storage.objects WHERE bucket_id='sitov-exam-submissions'")).rows[0].n,2)
 }finally{await db.close()}
})
test('learning reset preserves staff feature preferences and account deletion removes them',async()=>{
 const db=await fixture();try{
  await actor(db,student)
  const token=await result(db,"SELECT begin_learning_reset('RESET_LEARNING_DATA') result")
  assert.equal(await result(db,'SELECT finish_learning_reset($1) result',[token]),true)
  await db.exec('RESET ROLE')
  assert.equal((await db.query('SELECT count(*)::int n FROM sitov_simulation_feature_grants')).rows[0].n,1)
  await apply(db,['76_sitov_simulation_feature_access.sql'])
  assert.equal((await db.query('SELECT count(*)::int n FROM sitov_simulation_feature_grants')).rows[0].n,1)
  await actor(db,student);await result(db,"SELECT delete_own_learning_profile('DELETE_LEARNING_PROFILE') result")
  await db.exec('RESET ROLE')
  assert.equal((await db.query('SELECT count(*)::int n FROM sitov_simulation_feature_grants')).rows[0].n,0)
 }finally{await db.close()}
})
