import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createCurrentDatabase,currentFeatureMigrations,student,teacher,outsider,id,result} from './helpers/current-db.mjs'

const latest=[...currentFeatureMigrations,'59_daily_quests.sql','60_daily_quest_resume.sql','61_account_learning_checkpoints.sql','73_sitov_exam_preparation.sql','75_sitov_exam_simulation.sql','76_sitov_simulation_feature_access.sql','77_sitov_simulation_staff_reset.sql','78_sitov_simulation_teacher_management.sql','79_sitov_storage_security_limits.sql']
const admin=id(98001),run=id(98002),otherRun=id(98003),request=id(98004)
const shared=`${student}/speaking/${id(98005)}.webm`,unshared=`${student}/speaking/${id(98006)}.webm`
const bucket='sitov-exam-submissions'

test('quota ticket immutability permits only the trusted shared-recording reset and preserves its upload bounds',async()=>{
 const db=await createCurrentDatabase({latest})
 try {
  await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[admin,'admin@reset-quota.test'])
  await db.query("INSERT INTO profiles(id,role) VALUES($1,'admin')",[admin])
  await db.query('INSERT INTO sitov_exam_teacher_assignments(student_id,teacher_id,assigned_by) VALUES($1,$2,$3)',[student,teacher,admin])
  for(const owner of [student,outsider])await db.query('INSERT INTO sitov_simulation_feature_grants(student_id,granted_by) VALUES($1,$2)',[owner,admin])
  for(const [uid,owner] of [[run,student],[otherRun,outsider]]){
   const snapshot={id:uid,version:1,level:'B1',provider:'sitov',mode:'exam',status:'active',startedAt:'2026-10-04T08:00:00Z',expiresAt:'2099-10-04T11:00:00Z',tasks:[{id:'oral',type:'speaking'}],answers:uid===run?{oral:{text:'Eigene Aufnahme',audioPath:shared}}:{},coverage:{fullExam:true,missing:[]}}
   await db.query("INSERT INTO sitov_simulation_runs(id,student_id,level,provider,mode,status,started_at,expires_at,start_request_id,start_request_hash,server_snapshot) VALUES($1,$2,'B1','sitov','exam','active',$3,$4,$1,'start',$5)",[uid,owner,snapshot.startedAt,snapshot.expiresAt,snapshot])
  }
  for(const path of [shared,unshared]){
   await db.query("INSERT INTO sitov_exam_upload_tickets(path,student_id,kind,simulation_run_id,expected_bytes) VALUES($1,$2,'speaking',$3,100)",[path,student,run])
   await db.query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES($1,$2,'{\"size\":40,\"mimetype\":\"audio/webm\"}')",[bucket,path])
  }
  await db.query("INSERT INTO sitov_exam_submissions(student_id,task_id,task_version,unit_id,kind,media_path) VALUES($1,'speaking',1,'u','speaking',$2)",[student,shared])
  const before=(await db.query('SELECT * FROM sitov_exam_upload_tickets WHERE path=$1',[shared])).rows[0]
  await db.exec('SET ROLE service_role')
  // Possession of the service role alone never permits detaching a ticket.
  await assert.rejects(db.query('UPDATE sitov_exam_upload_tickets SET simulation_run_id=NULL WHERE path=$1',[shared]),error=>error.code==='23514'&&error.message==='sitov_upload_ticket_is_immutable')
  await assert.rejects(db.query('UPDATE sitov_exam_upload_tickets SET simulation_run_id=$2 WHERE path=$1',[shared,otherRun]))
  for(const change of ["expected_bytes=200","expires_at=expires_at+interval '1 minute'","created_at=created_at-interval '1 minute'"]){
   await assert.rejects(db.query(`UPDATE sitov_exam_upload_tickets SET ${change} WHERE path=$1`,[shared]),error=>error.code==='23514')
  }
  await assert.rejects(db.query('UPDATE sitov_exam_upload_tickets SET student_id=$2 WHERE path=$1',[shared,outsider]))
  await assert.rejects(db.query('UPDATE sitov_exam_upload_tickets SET path=$2 WHERE path=$1',[shared,`${student}/speaking/${id(98007)}.webm`]),error=>error.code==='23514')

  const reset=await result(db,'SELECT sitov_begin_simulation_reset($1,$2,$3) result',[student,teacher,request])
  assert.equal(reset.status,'pending')
  assert.deepEqual(reset.media,[{bucket,path:unshared}])
  assert.deepEqual((await db.query('SELECT * FROM sitov_exam_upload_tickets WHERE path=$1',[shared])).rows,[{...before,simulation_run_id:null}])
  assert.equal((await db.query('SELECT count(*)::int n FROM sitov_simulation_runs WHERE student_id=$1',[student])).rows[0].n,0)
  assert.equal((await db.query('SELECT count(*)::int n FROM sitov_simulation_runs WHERE student_id=$1',[outsider])).rows[0].n,1)
  await db.query('DELETE FROM storage.objects WHERE bucket_id=$1 AND name=$2',[bucket,unshared])
  assert.equal(await result(db,'SELECT sitov_finish_simulation_reset($1,$2) result',[reset.jobId,teacher]),true)
  assert.deepEqual((await db.query('SELECT name FROM storage.objects WHERE bucket_id=$1',[bucket])).rows,[{name:shared}])
  assert.deepEqual((await db.query("SELECT bytes,objects FROM sitov_storage_private.usage WHERE scope='all'")).rows,[{bytes:40,objects:1}])
  await assert.rejects(db.query('UPDATE sitov_exam_upload_tickets SET expected_bytes=200 WHERE path=$1',[shared]),error=>error.code==='23514')
 } finally {await db.close()}
})
