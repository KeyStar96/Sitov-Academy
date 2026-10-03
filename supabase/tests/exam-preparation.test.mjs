import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createCurrentDatabase,currentFeatureMigrations,actor,student,teacher,outsider,id,apply} from './helpers/current-db.mjs'
const admin=id(4),otherTeacher=id(5),attempt=id(80),submission=id(81)

test('B1 exam persistence, read ACLs, private media and trustworthy authors',async t=>{
 const db=await createCurrentDatabase({latest:[...currentFeatureMigrations,'73_sitov_exam_preparation.sql']})
 const as=async uid=>{await db.exec('RESET ROLE');await actor(db,uid)}
 try{
  await db.exec("INSERT INTO cefr_levels VALUES('B1'); INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('B1.1','B1',5),('B1.2','B1',6)")
  for(const [uid,role]of [[admin,'admin'],[otherTeacher,'teacher']]){
   await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[uid,`${uid}@test.local`]);await db.query('INSERT INTO profiles(id,role) VALUES($1,$2)',[uid,role])
  }
  await db.query("INSERT INTO student_level_access VALUES($1,'B1.2')",[student]);await db.query("UPDATE profiles SET ui_language='de' WHERE id=$1",[student])
  await t.test('B1.2 grants global B1 independently of interface language; A1 does not',async()=>{
   await as(student);assert.equal((await db.query('SELECT sitov_exam_private.has_access() allowed')).rows[0].allowed,true)
   await as(outsider);assert.equal((await db.query('SELECT sitov_exam_private.has_access() allowed')).rows[0].allowed,false)
   await as(teacher);assert.equal((await db.query('SELECT sitov_exam_private.has_access() allowed')).rows[0].allowed,true)
  })
  await t.test('only server writes can grade and persist; transport requests have a unique receipt',async()=>{
   await as(student);await assert.rejects(db.query("INSERT INTO sitov_exam_attempts(student_id,task_id,task_version,unit_id,answer,correct,mode,request_id) VALUES($1,'a',1,'u','\"forged\"',true,'practice',$2)",[student,attempt]),/permission denied/)
   await db.exec('RESET ROLE');await db.query("INSERT INTO sitov_exam_attempts(id,student_id,task_id,task_version,unit_id,answer,correct,mode,request_id) VALUES($1,$2,'a',1,'u','\"own\"',true,'practice',$1)",[attempt,student])
   await assert.rejects(db.query("INSERT INTO sitov_exam_attempts(student_id,task_id,task_version,unit_id,answer,mode,request_id) VALUES($1,'b',1,'u','\"own\"','practice',$2)",[student,attempt]),/unique/)
   await as(student);assert.equal((await db.query('SELECT id FROM sitov_exam_attempts')).rows.length,1);await assert.rejects(db.query('SELECT feedback,correct FROM sitov_exam_attempts'),/permission denied/)
   await as(outsider);assert.equal((await db.query('SELECT id FROM sitov_exam_attempts')).rows.length,0)
   await as(otherTeacher);assert.equal((await db.query('SELECT id FROM sitov_exam_attempts')).rows.length,0)
  })
  await t.test('no inferred recipient: submitted records require a genuine assignment',async()=>{
   await db.exec('RESET ROLE');await assert.rejects(db.query("INSERT INTO sitov_exam_submissions(student_id,task_id,task_version,unit_id,kind,text_content,teacher_id,status) VALUES($1,'writing',1,'u','writing','Original',$2,'submitted')",[student,teacher]),/missing_exam_recipient/)
   await assert.rejects(db.query('INSERT INTO sitov_exam_teacher_assignments(student_id,teacher_id,assigned_by) VALUES($1,$2,$3)',[student,outsider,admin]),/invalid_exam_teacher_assignment/)
   await db.query('INSERT INTO sitov_exam_teacher_assignments(student_id,teacher_id,assigned_by) VALUES($1,$2,$3)',[student,teacher,admin])
   await db.query("INSERT INTO sitov_exam_submissions(id,student_id,task_id,task_version,unit_id,kind,text_content) VALUES($1,$2,'writing',1,'u','writing','Private draft')",[submission,student])
   await as(teacher);assert.equal((await db.query('SELECT * FROM sitov_exam_submissions')).rows.length,0)
   await db.exec('RESET ROLE');await db.query("UPDATE sitov_exam_submissions SET teacher_id=$1,status='submitted' WHERE id=$2",[teacher,submission])
   await as(teacher);assert.equal((await db.query('SELECT * FROM sitov_exam_submissions')).rows.length,1)
   await as(otherTeacher);assert.equal((await db.query('SELECT * FROM sitov_exam_submissions')).rows.length,0)
  })
  await t.test('feedback cannot be authored by another teacher; saves status in the same transaction',async()=>{
   await db.exec('RESET ROLE');await assert.rejects(db.query("INSERT INTO sitov_exam_feedback(submission_id,teacher_id,text_content,strengths,revision,rating) VALUES($1,$2,'Clear','Good','Add detail','independent')",[submission,otherTeacher]),/unauthorized_exam_feedback/)
   await db.query("INSERT INTO sitov_exam_feedback(submission_id,teacher_id,text_content,strengths,priorities,revision,rating) VALUES($1,$2,'Clear','Good','[\"More detail\"]','Add detail','assisted')",[submission,teacher])
   assert.equal((await db.query('SELECT status FROM sitov_exam_submissions WHERE id=$1',[submission])).rows[0].status,'reviewed')
   await as(student);assert.equal((await db.query('SELECT * FROM sitov_exam_feedback')).rows.length,1)
   await as(outsider);assert.equal((await db.query('SELECT * FROM sitov_exam_feedback')).rows.length,0)
  })
  await t.test('revision links and private audio paths cannot point to somebody else',async()=>{
   await db.exec('RESET ROLE');await assert.rejects(db.query("INSERT INTO sitov_exam_submissions(student_id,task_id,task_version,unit_id,kind,text_content,previous_id) VALUES($1,'writing',1,'u','writing','Foreign revision',$2)",[outsider,submission]),/invalid_exam_revision/)
   await assert.rejects(db.query("INSERT INTO sitov_exam_submissions(student_id,task_id,task_version,unit_id,kind,media_path) VALUES($1,'speak',1,'u','speaking',$2)",[student,`${outsider}/speaking/file.webm`]),/check constraint/)
   const path=`${student}/speaking/recording.webm`
   await db.query("INSERT INTO sitov_exam_upload_tickets(path,student_id,kind) VALUES($1,$2,'speaking')",[path,student]);await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('sitov-exam-submissions',$1)",[path])
   await db.query("INSERT INTO sitov_exam_submissions(student_id,task_id,task_version,unit_id,kind,media_path,teacher_id,status) VALUES($1,'speak',1,'u','speaking',$2,$3,'submitted')",[student,path,teacher])
   await as(student);assert.equal((await db.query("SELECT name FROM storage.objects WHERE bucket_id='sitov-exam-submissions'")).rows.length,1)
   await as(teacher);assert.equal((await db.query("SELECT name FROM storage.objects WHERE bucket_id='sitov-exam-submissions'")).rows.length,1)
   await as(otherTeacher);assert.equal((await db.query("SELECT name FROM storage.objects WHERE bucket_id='sitov-exam-submissions'")).rows.length,0)
   await as(outsider);assert.equal((await db.query("SELECT name FROM storage.objects WHERE bucket_id='sitov-exam-submissions'")).rows.length,0)
  })
  await t.test('revocation closes reads; reapplying migrations preserves originals and receipts',async()=>{
   await db.exec('RESET ROLE');const before=(await db.query('SELECT id FROM sitov_exam_attempts')).rows
   await apply(db,['73_sitov_exam_preparation.sql']);assert.deepEqual((await db.query('SELECT id FROM sitov_exam_attempts')).rows,before)
   assert.equal((await db.query("SELECT public FROM storage.buckets WHERE id='sitov-exam-submissions'")).rows[0].public,false)
   await db.query("DELETE FROM student_level_access WHERE auth_user_id=$1 AND level='B1.2'",[student])
   await as(student);assert.equal((await db.query('SELECT id FROM sitov_exam_attempts')).rows.length,0)
   await as(null);assert.equal((await db.query('SELECT * FROM sitov_exam_submissions')).rows.length,0);await db.exec('RESET ROLE; SET ROLE anon');await assert.rejects(db.query('SELECT * FROM sitov_exam_submissions'),/permission denied/)
  })
 }finally{await db.close()}
})
