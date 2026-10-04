import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createCurrentDatabase,currentFeatureMigrations,actor,student,teacher,outsider,id,result,apply} from './helpers/current-db.mjs'

const admin=id(901),secondTeacher=id(902),run=id(910)
const migrations=[...currentFeatureMigrations,'59_daily_quests.sql','60_daily_quest_resume.sql','61_account_learning_checkpoints.sql','73_sitov_exam_preparation.sql','75_sitov_exam_simulation.sql','76_sitov_simulation_feature_access.sql','77_sitov_simulation_staff_reset.sql','78_sitov_simulation_teacher_management.sql']
async function fixture(){
 const db=await createCurrentDatabase({latest:migrations})
 try{
  for(const [uid,role] of [[admin,'admin'],[secondTeacher,'teacher']]){
   await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[uid,`${uid}@management.test`])
   await db.query('INSERT INTO profiles(id,role) VALUES($1,$2)',[uid,role])
  }
  return db
 }catch(error){await db.close();throw error}
}
const claim=(db,learner=student,staff=teacher)=>result(db,'SELECT sitov_assign_simulation_student($1,$2) result',[learner,staff])
const privileged=async db=>{await db.exec('RESET ROLE');await db.exec('SET ROLE service_role')}

test('teacher management SQL copies and VPS runner are registered consistently',()=>{
 const sql=readFileSync(new URL('../vps/78_sitov_simulation_teacher_management.sql',import.meta.url),'utf8')
 assert.equal(sql,readFileSync(new URL('../migrations/20261004143857_sitov_simulation_teacher_management.sql',import.meta.url),'utf8'))
 assert.equal(readFileSync(new URL('../schema.sql',import.meta.url),'utf8').split('-- BEGIN SITOV SIMULATION TEACHER MANAGEMENT\n')[1].split('-- END SITOV SIMULATION TEACHER MANAGEMENT\n')[0],sql)
 assert.match(readFileSync(new URL('../../deploy/vps/migrate-local.py',import.meta.url),'utf8'),/'77_sitov_simulation_staff_reset.sql','78_sitov_simulation_teacher_management.sql'/)
 assert.match(sql,/SECURITY INVOKER SET search_path=''/)
 const assignmentTrigger=sql.split('CREATE OR REPLACE FUNCTION public.sitov_assign_simulation_student')[0]
 assert.doesNotMatch(assignmentTrigger,/PERFORM pg_advisory_xact_lock/, 'an UPDATE trigger may already hold the assignment row lock')
 const claimBody=sql.split('CREATE OR REPLACE FUNCTION public.sitov_assign_simulation_student')[1]
 const advisoryPosition=claimBody.indexOf('PERFORM pg_advisory_xact_lock')
 assert.ok(advisoryPosition>=0&&advisoryPosition<claimBody.indexOf('INSERT INTO public.sitov_exam_teacher_assignments'), 'claim locking must precede assignment row access')
})

test('browser roles cannot claim and the trusted RPC rejects non-staff and non-student identities',async()=>{
 const db=await fixture();try{
  for(const uid of [student,teacher,admin,null]){
   await db.exec('RESET ROLE');await actor(db,uid)
   await assert.rejects(claim(db),/permission denied/)
   await assert.rejects(db.query('INSERT INTO sitov_exam_teacher_assignments(student_id,teacher_id,assigned_by) VALUES($1,$2,$2)',[student,teacher]),/permission denied/)
  }
  await privileged(db)
  await assert.rejects(claim(db,student,outsider),/unauthorized_simulation_assignment/)
  await assert.rejects(claim(db,teacher),/invalid_simulation_student/)
  assert.equal((await db.query('SELECT count(*)::int n FROM sitov_exam_teacher_assignments')).rows[0].n,0)
 }finally{await db.close()}
})

test('claim creates assignment and feature access atomically, is idempotent and preserves exam history',async()=>{
 const db=await fixture();try{
  await privileged(db)
  assert.equal(await claim(db),true)
  const assignment=(await db.query('SELECT * FROM sitov_exam_teacher_assignments WHERE student_id=$1',[student])).rows[0]
  const grant=(await db.query('SELECT * FROM sitov_simulation_feature_grants WHERE student_id=$1',[student])).rows[0]
  assert.equal(assignment.teacher_id,teacher);assert.equal(assignment.assigned_by,teacher);assert.equal(assignment.response_days,7)
  assert.equal(grant.granted_by,teacher)
  const snapshot={id:run,version:1,level:'B1',provider:'telc',mode:'practice',status:'completed',startedAt:'2026-10-04T08:00:00Z',expiresAt:'2026-10-04T11:00:00Z',completedAt:'2026-10-04T09:00:00Z',tasks:[{id:'sitov-existing-task',correctAnswer:'secret'}],answers:{'sitov-existing-task':'original-answer'},coverage:{fullExam:false}}
  await db.query("INSERT INTO sitov_simulation_runs(id,student_id,level,provider,mode,status,started_at,expires_at,completed_at,start_request_id,start_request_hash,server_snapshot) VALUES($1,$2,'B1','telc','practice','completed',$3,$4,$5,$1,'hash',$6)",[run,student,snapshot.startedAt,snapshot.expiresAt,snapshot.completedAt,snapshot])
  assert.equal(await claim(db),true)
  assert.deepEqual((await db.query('SELECT * FROM sitov_simulation_feature_grants WHERE student_id=$1',[student])).rows[0],grant)
  assert.deepEqual((await db.query('SELECT * FROM sitov_exam_teacher_assignments WHERE student_id=$1',[student])).rows[0],assignment)
  assert.deepEqual((await db.query('SELECT server_snapshot FROM sitov_simulation_runs WHERE id=$1',[run])).rows[0].server_snapshot,snapshot)
  await db.exec('RESET ROLE');await apply(db,['78_sitov_simulation_teacher_management.sql'])
  assert.deepEqual((await db.query('SELECT server_snapshot FROM sitov_simulation_runs WHERE id=$1',[run])).rows[0].server_snapshot,snapshot)
 }finally{await db.close()}
})

test('another teacher cannot overwrite an existing claim; administrators can reassign without changing grants',async()=>{
 const db=await fixture();try{
  await privileged(db);await claim(db)
  await assert.rejects(claim(db,student,secondTeacher),/simulation_student_already_assigned/)
  await assert.rejects(db.query('UPDATE sitov_exam_teacher_assignments SET teacher_id=$1,assigned_by=$1 WHERE student_id=$2',[secondTeacher,student]),/invalid_exam_teacher_assignment/)
  assert.equal((await db.query('SELECT teacher_id FROM sitov_exam_teacher_assignments WHERE student_id=$1',[student])).rows[0].teacher_id,teacher)
  await db.query('UPDATE sitov_exam_teacher_assignments SET teacher_id=$1,assigned_by=$2 WHERE student_id=$3',[secondTeacher,admin,student])
  assert.equal(await claim(db,student,secondTeacher),true)
  assert.equal((await db.query('SELECT granted_by FROM sitov_simulation_feature_grants WHERE student_id=$1',[student])).rows[0].granted_by,teacher)
  await assert.rejects(claim(db),/simulation_student_already_assigned/)
 }finally{await db.close()}
})

test('a failed feature grant rolls the new assignment back completely',async()=>{
 const db=await fixture();try{
  await db.exec("CREATE FUNCTION public.sitov_test_reject_grant() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'sitov_test_grant_rejected'; END $$; CREATE TRIGGER sitov_test_grant_failure BEFORE INSERT ON public.sitov_simulation_feature_grants FOR EACH ROW EXECUTE FUNCTION public.sitov_test_reject_grant();")
  await privileged(db)
  await assert.rejects(claim(db),/sitov_test_grant_rejected/)
  assert.equal((await db.query('SELECT count(*)::int n FROM sitov_exam_teacher_assignments')).rows[0].n,0)
  assert.equal((await db.query('SELECT count(*)::int n FROM sitov_simulation_feature_grants')).rows[0].n,0)
 }finally{await db.close()}
})

test('native rollback smoke exercises browser and service identities and leaves no fixtures',async()=>{
 const db=await fixture();try{
  // The isolated auth fixture intentionally models fewer GoTrue columns.
  await db.exec('ALTER TABLE auth.users ADD COLUMN aud text, ADD COLUMN role text, ADD COLUMN updated_at timestamptz;')
  const before=(await db.query('SELECT count(*)::int n FROM profiles')).rows[0].n
  const sql=readFileSync(new URL('../../deploy/vps/tests/sitov-exam-teacher-management.sql',import.meta.url),'utf8').replace(/^\\set.*$/mg,'')
  const results=await db.exec(sql)
  assert.equal(results.at(-1).rows[0].result,'sitov_exam_teacher_management_ok')
  assert.equal((await db.query('SELECT count(*)::int n FROM profiles')).rows[0].n,before)
  assert.equal((await db.query('SELECT count(*)::int n FROM sitov_exam_teacher_assignments')).rows[0].n,0)
  assert.equal((await db.query('SELECT count(*)::int n FROM sitov_simulation_runs')).rows[0].n,0)
 }catch(error){delete error.query;throw error}finally{await db.close()}
})
