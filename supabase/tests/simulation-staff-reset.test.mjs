import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createCurrentDatabase,currentFeatureMigrations,actor,student,teacher,outsider,id,result,apply} from './helpers/current-db.mjs'

const admin=id(801),newTeacher=id(802),run=id(810),otherRun=id(811)
const request=id(812),resumeRequest=id(813),freshRun=id(814)
const paths={
 simulation:`${student}/speaking/${id(821)}.webm`,
 unused:`${student}/speaking/${id(822)}.webm`,
 unsigned:`${student}/speaking/${id(823)}.webm`,
 reused:`${student}/speaking/${id(824)}.webm`,
 shared:`${student}/speaking/${id(825)}.webm`,
 preparation:`${student}/speaking/${id(826)}.webm`,
 other:`${outsider}/speaking/${id(827)}.webm`,
}
const bucket='sitov-exam-submissions'
const migrations=[...currentFeatureMigrations,'59_daily_quests.sql','60_daily_quest_resume.sql','61_account_learning_checkpoints.sql','73_sitov_exam_preparation.sql','75_sitov_exam_simulation.sql','76_sitov_simulation_feature_access.sql','77_sitov_simulation_staff_reset.sql']
const snapshot=(uid=run,overrides={})=>({id:uid,version:1,level:'B1',provider:'sitov',mode:'exam',status:'active',startedAt:'2026-10-04T08:00:00Z',expiresAt:'2099-10-04T11:00:00Z',coverage:{fullExam:true,missing:[]},rubric:{minimumSkillPercentage:70},tasks:[{id:'sitov-task',type:'speaking',correctAnswer:'private'}],answers:{},...overrides})
async function insertRun(db,data,generation){
 const values=[data.id,data.studentId??student,data.level,data.provider,data.mode,data.status,data.startedAt,data.expiresAt,data.completedAt??null,data]
 if(generation!==undefined)values.push(generation)
 await db.query(`INSERT INTO sitov_simulation_runs(id,student_id,level,provider,mode,status,started_at,expires_at,completed_at,start_request_id,start_request_hash,server_snapshot${generation===undefined?'':',generation'}) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$1,'hash',$10${generation===undefined?'':',$11'})`,values)
}
const begin=(db,staff=teacher,req=request,learner=student)=>result(db,'SELECT sitov_begin_simulation_reset($1,$2,$3) result',[learner,staff,req])
const finish=(db,job,staff=teacher)=>result(db,'SELECT sitov_finish_simulation_reset($1,$2) result',[job,staff])
const as=async(db,uid)=>{await db.exec('RESET ROLE');await actor(db,uid)}
const privileged=async db=>{await db.exec('RESET ROLE');await db.exec('SET ROLE service_role')}
async function fixture({beforeResetMigration=false}={}){
 const db=await createCurrentDatabase({latest:beforeResetMigration?migrations.slice(0,-1):migrations})
 try{
  for(const [uid,role]of[[admin,'admin'],[newTeacher,'teacher']]){
   await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[uid,`${uid}@reset.test`])
   await db.query('INSERT INTO profiles(id,role) VALUES($1,$2)',[uid,role])
  }
  await db.query('INSERT INTO sitov_exam_teacher_assignments(student_id,teacher_id,assigned_by) VALUES($1,$2,$3)',[student,teacher,admin])
  for(const uid of [student,outsider])await db.query('INSERT INTO sitov_simulation_feature_grants(student_id,granted_by) VALUES($1,$2)',[uid,admin])
  await db.query("INSERT INTO sitov_simulation_level_grants(student_id,level,granted_by) VALUES($1,'C2',$2)",[student,teacher])
  await insertRun(db,snapshot(run,{answers:{oral:{text:'Eigene Notizen',audioPath:paths.simulation},reused:{text:'Dialog',audioPath:paths.reused},shared:{text:'Dialog',audioPath:paths.shared}}}))
  await insertRun(db,snapshot(otherRun,{studentId:outsider}))
  for(const [key,path]of Object.entries(paths)){
   const owner=key==='other'?outsider:student,linked=['simulation','unused','unsigned','shared'].includes(key)?run:key==='other'?otherRun:null
   await db.query("INSERT INTO sitov_exam_upload_tickets(path,student_id,kind,simulation_run_id) VALUES($1,$2,'speaking',$3)",[path,owner,linked])
   if(key!=='unsigned')await db.query('INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)',[bucket,path])
  }
  for(const [key,uid]of [['shared',student],['preparation',student],['other',outsider]])await db.query("INSERT INTO sitov_exam_submissions(student_id,task_id,task_version,unit_id,kind,media_path) VALUES($1,'speaking',1,'u','speaking',$2)",[uid,paths[key]])
  await db.query("INSERT INTO sitov_exam_attempts(student_id,task_id,task_version,unit_id,answer,mode,request_id) VALUES($1,'reading',1,'u','\"a\"','practice',$2)",[student,id(828)])
  await db.query("INSERT INTO sitov_exam_profiles(student_id,profile_id) VALUES($1,'general_b1')",[student])
  await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('sitov-exam-productions','shared-qwen-fixture.wav')")
  return db
 }catch(error){await db.close();delete error.query;throw error}
}
async function removeQueue(db,job){for(const media of job.media)await db.query('DELETE FROM storage.objects WHERE bucket_id=$1 AND name=$2',[media.bucket,media.path])}
const count=async(db,table,where='student_id=$1',params=[student])=>(await db.query(`SELECT count(*)::int n FROM ${table} WHERE ${where}`,params)).rows[0].n

test('staff reset SQL is mirrored exactly and registered after feature access',()=>{
 const sql=readFileSync(new URL('../vps/77_sitov_simulation_staff_reset.sql',import.meta.url),'utf8')
 assert.equal(sql,readFileSync(new URL('../migrations/20261004122137_sitov_simulation_staff_reset.sql',import.meta.url),'utf8'))
 const schema=readFileSync(new URL('../schema.sql',import.meta.url),'utf8')
 assert.equal(schema.split('-- BEGIN SITOV SIMULATION STAFF RESET\n')[1].split('-- END SITOV SIMULATION STAFF RESET\n')[0],sql)
 assert.match(readFileSync(new URL('../../deploy/vps/migrate-local.py',import.meta.url),'utf8'),/'76_sitov_simulation_feature_access.sql','77_sitov_simulation_staff_reset.sql'/)
})

test('staff reset is browser-private and validates current assigned staff within the database',async()=>{
 const db=await fixture();try{
  for(const uid of [student,outsider,teacher,admin,null]){
   await as(db,uid)
   await assert.rejects(begin(db),/permission denied/)
   await assert.rejects(finish(db,id(999)),/permission denied/)
   for(const table of ['public.sitov_simulation_learning_state','sitov_simulation_private.reset_jobs','sitov_simulation_private.reset_media','sitov_simulation_private.reset_requests'])await assert.rejects(db.query(`SELECT * FROM ${table}`),/permission denied/)
  }
  await privileged(db)
  await assert.rejects(begin(db,student),/unauthorized_simulation_reset/)
  await assert.rejects(begin(db,newTeacher),/unauthorized_simulation_reset/)
  await assert.rejects(begin(db,teacher,request,outsider),/unauthorized_simulation_reset/)
  await assert.rejects(begin(db,admin,request,teacher),/unauthorized_simulation_reset/)
  assert.equal(await count(db,'sitov_simulation_runs'),1)
  const job=await begin(db,admin)
  assert.equal(job.status,'pending');assert.equal(job.generation,1)
 }finally{await db.close()}
})

test('staff reset clears all six levels, receipts and unused simulation recordings while preserving other learning, shared files and grants',async()=>{
 const db=await fixture();try{
  for(const [index,level]of ['A1','A2','B1','B2','C1','C2'].entries())await insertRun(db,snapshot(id(840+index),{level,status:'completed',completedAt:'2026-10-04T09:00:00Z'}))
  await db.query("INSERT INTO sitov_simulation_receipts(student_id,request_id,run_id,kind,payload_hash) VALUES($1,$2,$3,'answer','hash')",[student,id(850),run])
  const beforePrep=await count(db,'sitov_exam_submissions')
  await privileged(db);const job=await begin(db)
  assert.deepEqual(job.media.map(item=>item.path).sort(),[paths.simulation,paths.unused,paths.reused].sort())
  assert.ok(job.media.every(item=>item.bucket===bucket))
  assert.equal(await count(db,'sitov_simulation_runs'),0);assert.equal(await count(db,'sitov_simulation_receipts'),0)
  assert.equal(await count(db,'sitov_simulation_runs','student_id=$1',[outsider]),1)
  assert.equal(await count(db,'sitov_exam_submissions'),beforePrep)
  assert.equal(await count(db,'sitov_exam_attempts'),1);assert.equal(await count(db,'sitov_exam_profiles'),1)
  assert.equal(await count(db,'sitov_simulation_feature_grants'),1);assert.equal(await count(db,'sitov_simulation_level_grants'),1)
  assert.equal((await db.query('SELECT simulation_run_id FROM sitov_exam_upload_tickets WHERE path=$1',[paths.shared])).rows[0].simulation_run_id,null)
  assert.equal(await count(db,'sitov_exam_upload_tickets'),2)
  await assert.rejects(finish(db,job.jobId),/simulation_audio_removal_incomplete/)
  // A partially failed file operation keeps the job and its remaining manifest.
  await db.query('DELETE FROM storage.objects WHERE bucket_id=$1 AND name=$2',[bucket,paths.simulation])
  const resumed=await begin(db)
  assert.equal(resumed.jobId,job.jobId);assert.equal(resumed.generation,1)
  assert.deepEqual(resumed.media.map(item=>item.path).sort(),[paths.unused,paths.reused].sort())
  await removeQueue(db,resumed);assert.equal(await finish(db,job.jobId),true)
  assert.equal((await db.query('SELECT reset_pending FROM sitov_simulation_learning_state WHERE student_id=$1',[student])).rows[0].reset_pending,null)
  assert.deepEqual((await db.query('SELECT name FROM storage.objects WHERE bucket_id=$1 ORDER BY name',[bucket])).rows.map(row=>row.name).sort(),[paths.shared,paths.preparation,paths.other].sort())
  assert.equal(await count(db,'storage.objects',"bucket_id='sitov-exam-productions'",[]),1)
  await db.exec('RESET ROLE');await apply(db,['77_sitov_simulation_staff_reset.sql']);await privileged(db)
  assert.equal((await begin(db)).status,'completed')
 }finally{await db.close()}
})

test('reset epochs fence delayed starts, old receipts and signed upload paths through completion without affecting new attempts',async()=>{
 const db=await fixture();try{
  await privileged(db);const job=await begin(db)
  await assert.rejects(insertRun(db,snapshot(freshRun)),/simulation_reset_in_progress/)
  await assert.rejects(result(db,"SELECT sitov_store_simulation_change($1,$2,0,$3,$4,'answer','hash') result",[run,student,snapshot(),id(861)]),/simulation_not_found/)
  await assert.rejects(db.query('INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)',[bucket,paths.unsigned]),/exam_upload_ticket_expired|simulation_recording_retired/)
  await removeQueue(db,job);await finish(db,job.jobId)
  await assert.rejects(insertRun(db,snapshot(freshRun)),/simulation_generation_changed/)
  await insertRun(db,snapshot(freshRun),1)
  await assert.rejects(db.query("INSERT INTO sitov_exam_upload_tickets(path,student_id,kind,simulation_run_id) VALUES($1,$2,'speaking',$3)",[paths.unsigned,student,freshRun]),/simulation_recording_retired/)
  await assert.rejects(db.query("INSERT INTO sitov_exam_submissions(student_id,task_id,task_version,unit_id,kind,media_path) VALUES($1,'late',1,'u','speaking',$2)",[student,paths.simulation]),/simulation_recording_retired/)
  const fresh=`${student}/speaking/${id(862)}.webm`
  await db.query("INSERT INTO sitov_exam_upload_tickets(path,student_id,kind,simulation_run_id) VALUES($1,$2,'speaking',$3)",[fresh,student,freshRun])
  await db.query('INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)',[bucket,fresh])
  assert.equal(await finish(db,job.jobId),true)
  assert.equal((await begin(db)).status,'completed')
  assert.equal(await count(db,'sitov_simulation_runs'),1)
 }finally{await db.close()}
})

test('newly assigned staff can resume a pending job, with durable request mapping preventing a second reset after reload',async()=>{
 const db=await fixture();try{
  await privileged(db);const job=await begin(db)
  await db.query('UPDATE sitov_exam_teacher_assignments SET teacher_id=$1 WHERE student_id=$2',[newTeacher,student])
  await assert.rejects(begin(db),/unauthorized_simulation_reset/)
  await assert.rejects(finish(db,job.jobId),/unauthorized_simulation_reset/)
  const resumed=await begin(db,newTeacher,resumeRequest)
  assert.equal(resumed.jobId,job.jobId);assert.equal(resumed.generation,1)
  await removeQueue(db,resumed);assert.equal(await finish(db,job.jobId,newTeacher),true)
  await insertRun(db,snapshot(freshRun),1)
  const replay=await begin(db,newTeacher,resumeRequest)
  assert.equal(replay.jobId,job.jobId);assert.equal(replay.status,'completed')
  assert.equal(await count(db,'sitov_simulation_runs'),1)
  await assert.rejects(begin(db,newTeacher,request),/simulation_reset_request_reused/)
  const second=await begin(db,newTeacher,id(863))
  assert.equal(second.generation,2);assert.notEqual(second.jobId,job.jobId)
  assert.equal(await count(db,'sitov_simulation_runs'),0)
 }finally{await db.close()}
})

test('student global reset preserves simulation snapshots, receipts, pool history, private files and issued tickets including NULL preparation origins',async()=>{
 const db=await fixture();try{
  const data=(await db.query('SELECT server_snapshot FROM sitov_simulation_runs WHERE id=$1',[run])).rows[0].server_snapshot
  await db.query("INSERT INTO sitov_simulation_receipts(student_id,request_id,run_id,kind,payload_hash) VALUES($1,$2,$3,'answer','hash')",[student,id(870),run])
  await as(db,student);const token=await result(db,"SELECT begin_learning_reset('RESET_LEARNING_DATA') result")
  const files=await result(db,'SELECT learning_reset_audio_batch($1) result',[token])
  assert.deepEqual(files.map(file=>file.object_name),[paths.preparation])
  await db.query('DELETE FROM storage.objects WHERE bucket_id=$1 AND name=$2',[bucket,paths.simulation])
  await db.query('DELETE FROM storage.objects WHERE bucket_id=$1 AND name=$2',[bucket,paths.reused])
  await db.exec('RESET ROLE')
  assert.equal(await count(db,'storage.objects','name=ANY($1)',[[paths.simulation,paths.reused]]),2)
  await as(db,student)
  await db.query('DELETE FROM storage.objects WHERE bucket_id=$1 AND name=$2',[bucket,paths.preparation])
  assert.equal(await result(db,'SELECT finish_learning_reset($1) result',[token]),true)
  await privileged(db)
  assert.deepEqual((await db.query('SELECT server_snapshot FROM sitov_simulation_runs WHERE id=$1',[run])).rows[0].server_snapshot,data)
  assert.equal(await count(db,'sitov_simulation_runs'),1);assert.equal(await count(db,'sitov_simulation_receipts'),1)
  assert.equal(await count(db,'sitov_exam_upload_tickets'),5)
  assert.equal(await count(db,'sitov_simulation_feature_grants'),1);assert.equal(await count(db,'sitov_simulation_level_grants'),1)
  // A signed simulation upload issued before the general reset keeps its ownership.
  await db.query('INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)',[bucket,paths.unsigned])
  const job=await begin(db)
  assert.ok(job.media.some(media=>media.path===paths.unsigned))
 }finally{await db.close()}
})

test('upgrade protects already captured simulation files and global reset cannot acquire a pending staff cleanup manifest',async()=>{
 const db=await fixture({beforeResetMigration:true});try{
  await as(db,student);const token=await result(db,"SELECT begin_learning_reset('RESET_LEARNING_DATA') result")
  assert.ok((await result(db,'SELECT learning_reset_audio_batch($1) result',[token])).some(file=>file.object_name===paths.simulation))
  await db.exec('RESET ROLE');await apply(db,['77_sitov_simulation_staff_reset.sql'])
  // Model a stale pre-upgrade writer committing its manifest late. Both batch
  // and direct finish recheck protected references, without another begin call.
  await db.query("INSERT INTO learning_reset_private.audio_objects(auth_user_id,object_id,bucket_id,object_name) SELECT $1,id,bucket_id,name FROM storage.objects WHERE bucket_id=$2 AND name=$3",[student,bucket,paths.reused])
  await as(db,student)
  assert.deepEqual((await result(db,'SELECT learning_reset_audio_batch($1) result',[token])).map(file=>file.object_name),[paths.preparation])
  await db.query('DELETE FROM storage.objects WHERE bucket_id=$1 AND name=$2',[bucket,paths.preparation])
  assert.equal(await result(db,'SELECT finish_learning_reset($1) result',[token]),true)
  await privileged(db);const job=await begin(db)
  await as(db,student);const next=await result(db,"SELECT begin_learning_reset('RESET_LEARNING_DATA') result")
  assert.deepEqual(await result(db,'SELECT learning_reset_audio_batch($1) result',[next]),[])
  await db.query('DELETE FROM storage.objects WHERE bucket_id=$1 AND name=$2',[bucket,paths.simulation])
  await db.exec('RESET ROLE');assert.equal(await count(db,'storage.objects','name=$1',[paths.simulation]),1)
  await as(db,student);assert.equal(await result(db,'SELECT finish_learning_reset($1) result',[next]),true)
  await privileged(db);assert.equal((await begin(db)).jobId,job.jobId)
 }finally{await db.close()}
})

test('account deletion still removes all simulation files, grants, jobs, durable requests and history through the privacy cascade',async()=>{
 const db=await fixture();try{
  await privileged(db);const job=await begin(db)
  await as(db,student)
  let pending=await result(db,"SELECT delete_own_learning_profile('DELETE_LEARNING_PROFILE') result")
  assert.equal(pending.deleted,false)
  assert.deepEqual(pending.pendingFiles.map(file=>file.object_name).sort(),[paths.simulation,paths.unused,paths.reused,paths.shared,paths.preparation].sort())
  await privileged(db)
  for(const file of pending.pendingFiles)await db.query('DELETE FROM storage.objects WHERE bucket_id=$1 AND name=$2',[file.bucket_id,file.object_name])
  await as(db,student);assert.deepEqual(await result(db,"SELECT delete_own_learning_profile('DELETE_LEARNING_PROFILE') result"),{success:true,deleted:true})
  await db.exec('RESET ROLE')
  for(const table of ['sitov_simulation_runs','sitov_simulation_receipts','sitov_simulation_level_grants','sitov_simulation_feature_grants','sitov_simulation_learning_state','sitov_simulation_private.reset_jobs','sitov_simulation_private.reset_requests','sitov_simulation_private.reset_media'])assert.equal(await count(db,table),0,table)
  assert.equal(await count(db,'sitov_simulation_runs','student_id=$1',[outsider]),1)
  assert.equal(await count(db,'storage.objects','name=$1',[paths.other]),1)
  assert.equal(await count(db,'storage.objects',"bucket_id='sitov-exam-productions'",[]),1)
  await privileged(db);await assert.rejects(finish(db,job.jobId),/simulation_reset_not_found/)
 }finally{await db.close()}
})
