import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createCurrentDatabase,currentFeatureMigrations,student,outsider,id,actor,result} from './helpers/current-db.mjs'
const migration=await readFile(new URL('../vps/79_sitov_storage_security_limits.sql',import.meta.url),'utf8')
const latest=[...currentFeatureMigrations,'59_daily_quests.sql','60_daily_quest_resume.sql','61_account_learning_checkpoints.sql','73_sitov_exam_preparation.sql','75_sitov_exam_simulation.sql','76_sitov_simulation_feature_access.sql','77_sitov_simulation_staff_reset.sql','78_sitov_simulation_teacher_management.sql']
const admin=id(990),run=id(991),issued=`${student}/speaking/${id(992)}.webm`,stored=`${student}/speaking/${id(993)}.webm`
test('quotas preserve real simulation reset/media guards and trusted Storage completion after global reset',async()=>{
 const db=await createCurrentDatabase({latest})
 try {
  await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[admin,'admin@quota.test'])
  await db.query("INSERT INTO profiles(id,role) VALUES($1,'admin')",[admin])
  for(const learner of [student,outsider])await db.query('INSERT INTO sitov_simulation_feature_grants(student_id,granted_by) VALUES($1,$2)',[learner,admin])
  const snapshot={id:run,version:1,level:'B1',provider:'telc',mode:'practice',status:'active',startedAt:'2026-10-04T08:00:00Z',expiresAt:'2099-10-04T08:50:00Z',tasks:[{id:'oral',type:'speaking'}],answers:{oral:{text:'Eigene Aufnahme',audioPath:stored}},coverage:{fullExam:false}}
  await db.query("INSERT INTO sitov_simulation_runs(id,student_id,level,provider,mode,status,started_at,expires_at,start_request_id,start_request_hash,server_snapshot) VALUES($1,$2,'B1','telc','practice','active',$3,$4,$5,'start',$6)",[run,student,snapshot.startedAt,snapshot.expiresAt,id(994),snapshot])
  for(const path of [issued,stored])await db.query("INSERT INTO sitov_exam_upload_tickets(path,student_id,kind,simulation_run_id) VALUES($1,$2,'speaking',$3)",[path,student,run])
  await db.query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('sitov-exam-submissions',$1,'{\"size\":10}')",[stored])
  // Production contains historical tickets from completed runs. Their expiry
  // backfill must preserve rows without replaying active-upload validation.
  const finishedId=id(995),finishedPath=`${outsider}/speaking/${id(996)}.webm`
  const activeOther={...snapshot,id:finishedId,answers:{}}
  await db.query("INSERT INTO sitov_simulation_runs(id,student_id,level,provider,mode,status,started_at,expires_at,start_request_id,start_request_hash,server_snapshot) VALUES($1,$2,'B1','telc','practice','active',$3,$4,$5,'finished-start',$6)",[finishedId,outsider,snapshot.startedAt,snapshot.expiresAt,id(997),activeOther])
  await db.query("INSERT INTO sitov_exam_upload_tickets(path,student_id,kind,simulation_run_id) VALUES($1,$2,'speaking',$3)",[finishedPath,outsider,finishedId])
  const finished={...activeOther,status:'completed',completedAt:'2026-10-04T08:45:00Z'}
  await db.query("UPDATE sitov_simulation_runs SET status='completed',completed_at=$2,revision=revision+1,server_snapshot=$3 WHERE id=$1",[finishedId,finished.completedAt,finished])
  await db.exec('ALTER TABLE public.sitov_exam_upload_tickets ENABLE ALWAYS TRIGGER sitov_simulation_feature_ticket_guard; ALTER TABLE public.sitov_exam_upload_tickets DISABLE TRIGGER sitov_simulation_retired_ticket_guard')
  const triggerModes=(await db.query("SELECT tgname,tgenabled FROM pg_trigger WHERE tgrelid='public.sitov_exam_upload_tickets'::regclass AND NOT tgisinternal ORDER BY tgname")).rows
  const before=(await db.query('SELECT * FROM sitov_simulation_runs')).rows
  await db.exec('BEGIN;'+migration+'COMMIT;')
  assert.deepEqual((await db.query('SELECT * FROM sitov_simulation_runs')).rows,before)
  assert.deepEqual((await db.query("SELECT tgname,tgenabled FROM pg_trigger WHERE tgrelid='public.sitov_exam_upload_tickets'::regclass AND NOT tgisinternal AND tgname<>'sitov_upload_ticket_limit' ORDER BY tgname")).rows,triggerModes)
  assert.equal((await db.query('SELECT count(*)::int n FROM sitov_exam_upload_tickets WHERE path=$1 AND expires_at IS NOT NULL',[finishedPath])).rows[0].n,1)
  await actor(db,student)
  const reset=await result(db,"SELECT begin_learning_reset('RESET_LEARNING_DATA') result")
  assert.ok(typeof reset==='string')
  assert.equal(await result(db,'SELECT finish_learning_reset($1) result',[reset]),true)
  await db.exec('RESET ROLE; SET ROLE service_role')
  // The legacy preservation exception remains necessary for an already issued
  // simulation URL and an existing recording after the student's general reset.
  await db.query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('sitov-exam-submissions',$1,'{\"size\":10}')",[issued])
  await db.query("UPDATE storage.objects SET metadata='{\"size\":10,\"mimetype\":\"audio/webm\"}' WHERE bucket_id='sitov-exam-submissions' AND name=$1",[stored])
  await db.exec('RESET ROLE')
  assert.deepEqual((await db.query('SELECT * FROM sitov_simulation_runs')).rows,before)
  assert.deepEqual((await db.query("SELECT bytes,objects FROM sitov_storage_private.usage WHERE scope='all'")).rows,[{bytes:20,objects:2}])
  await db.query('DELETE FROM sitov_simulation_feature_grants WHERE student_id=$1',[student])
  await assert.rejects(db.query("UPDATE storage.objects SET metadata='{\"size\":11}' WHERE name=$1",[stored]),error=>error.code==='42501')
  assert.deepEqual((await db.query("SELECT bytes,objects FROM sitov_storage_private.usage WHERE scope='all'")).rows,[{bytes:20,objects:2}])
 } finally {await db.close()}
})
