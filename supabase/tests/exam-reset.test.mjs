import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createCurrentDatabase,currentFeatureMigrations,actor,student,teacher,outsider,id,result} from './helpers/current-db.mjs'
const admin=id(4),source=id(301),revision=id(302),request=id(303)
const ownAudio=`${student}/speaking/${id(311)}.webm`,ownPhoto=`${student}/photo/${id(312)}.jpg`,orphan=`${student}/speaking/${id(313)}.webm`,otherAudio=`${outsider}/speaking/${id(314)}.webm`
const late=`${student}/speaking/${id(315)}.webm`

test('exam VPS, CLI migration and additive schema snapshot contain the same reviewed SQL',()=>{
 const vps=readFileSync(new URL('../vps/73_sitov_exam_preparation.sql',import.meta.url),'utf8')
 const migration=readFileSync(new URL('../migrations/20261003205830_sitov_exam_preparation.sql',import.meta.url),'utf8')
 const schema=readFileSync(new URL('../schema.sql',import.meta.url),'utf8')
 const begin='-- BEGIN SITOV EXAM PREPARATION\n',end='-- END SITOV EXAM PREPARATION\n'
 assert.equal(schema.split(begin).length,2);assert.equal(schema.split(end).length,2)
 assert.equal(migration,vps)
 assert.equal(schema.split(begin)[1].split(end)[0],vps)
})

async function fixture(){
 const db=await createCurrentDatabase({latest:[...currentFeatureMigrations,'59_daily_quests.sql','60_daily_quest_resume.sql','61_account_learning_checkpoints.sql','73_sitov_exam_preparation.sql']})
 try{
  await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[admin,'admin@test.local']);await db.query("INSERT INTO profiles(id,role) VALUES($1,'admin')",[admin])
  await db.exec("INSERT INTO cefr_levels VALUES('B1') ON CONFLICT DO NOTHING;INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('B1.1','B1',5),('B1.2','B1',6) ON CONFLICT DO NOTHING")
  await db.query("INSERT INTO student_level_access VALUES($1,'B1.1')",[student])
  await db.query("INSERT INTO sitov_exam_profiles(student_id,profile_id) VALUES($1,'goethe_b1'),($2,'dtz_a2_b1')",[student,outsider])
  await db.query('INSERT INTO sitov_exam_teacher_assignments(student_id,teacher_id,assigned_by) VALUES($1,$2,$3)',[student,teacher,admin])
  for(const [path,owner,kind]of[[ownAudio,student,'speaking'],[ownPhoto,student,'photo'],[orphan,student,'speaking'],[otherAudio,outsider,'speaking'],[late,student,'speaking']]){
   await db.query('INSERT INTO sitov_exam_upload_tickets(path,student_id,kind) VALUES($1,$2,$3)',[path,owner,kind])
   if(path!==late)await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('sitov-exam-submissions',$1)",[path])
  }
  await db.query("INSERT INTO sitov_exam_submissions(id,student_id,task_id,task_version,unit_id,kind,text_content,photo_path,teacher_id,status) VALUES($1,$2,'writing',1,'u','writing','Original',$3,$4,'submitted')",[source,student,ownPhoto,teacher])
  await db.query("INSERT INTO sitov_exam_feedback(submission_id,teacher_id,text_content,strengths,revision,rating) VALUES($1,$2,'Ergänze den Termin.','Anlass ist klar.','Termin ergänzen','assisted')",[source,teacher])
  await db.query("INSERT INTO sitov_exam_submissions(id,student_id,task_id,task_version,unit_id,kind,text_content,photo_path,teacher_id,status,previous_id,reflection) VALUES($1,$2,'writing',1,'u','writing','Meine Revision',$3,$4,'submitted',$5,'Termin ergänzt')",[revision,student,ownPhoto,teacher,source])
  await db.query("INSERT INTO sitov_exam_submissions(student_id,task_id,task_version,unit_id,kind,media_path) VALUES($1,'speaking',1,'u','speaking',$2)",[student,ownAudio])
  await db.query("INSERT INTO sitov_exam_submissions(student_id,task_id,task_version,unit_id,kind,media_path) VALUES($1,'speaking',1,'u','speaking',$2)",[outsider,otherAudio])
  await db.query("INSERT INTO sitov_exam_attempts(student_id,task_id,task_version,unit_id,answer,mode,request_id) VALUES($1,'reading',1,'u','\"a\"','practice',$2),($3,'reading',1,'u','\"b\"','practice',$4)",[student,request,outsider,id(304)])
  await db.query("INSERT INTO sitov_exam_hints(student_id,task_id,task_version) VALUES($1,'reading',1)",[student])
  await db.query("INSERT INTO sitov_exam_unlocks(student_id,module_id,kind,reason,created_by) VALUES($1,'m2','teacher','Termin steht fest.',$2),($1,'m1','fallback','Ich möchte weiterlernen.',$1)",[student,teacher])
  await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('sitov-exam-productions',$1)",[`${student}/studio/shared.wav`])
  return db
 }catch(error){await db.close();delete error.query;throw error}
}
const as=async(db,uid)=>{await db.exec('RESET ROLE');await actor(db,uid)}
const rpc=(db,name,args=[],params=[])=>result(db,`SELECT public.${name}(${args.join(',')}) result`,params)
const begin=db=>rpc(db,'begin_learning_reset',["'RESET_LEARNING_DATA'"])
const batch=(db,token)=>rpc(db,'learning_reset_audio_batch',['$1'],[token])
const finish=(db,token)=>rpc(db,'finish_learning_reset',['$1'],[token])

test('exam global reset drains only owned private files, fences stale uploads and resets proof atomically',async t=>{
 const db=await fixture()
 try{
  await as(db,student)
  await db.query("DELETE FROM storage.objects WHERE bucket_id='sitov-exam-submissions' AND name=$1",[ownPhoto])
  await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*)::int n FROM storage.objects WHERE name=$1',[ownPhoto])).rows[0].n,1)
  // Reset remains available after course access is revoked.
  await db.query("DELETE FROM student_level_access WHERE auth_user_id=$1 AND level='B1.1'",[student])
  await as(db,student);const token=await begin(db),files=await batch(db,token)
  assert.deepEqual(files.map(f=>f.object_name).sort(),[ownAudio,ownPhoto,orphan].sort());assert.ok(files.every(f=>f.bucket_id==='sitov-exam-submissions'))
  assert.equal(await begin(db),token)
  assert.equal((await finish(db,token)).error,'audio_removal_incomplete')
  await as(db,outsider);assert.equal((await batch(db,token)).error,'reset_owner_required');assert.equal((await finish(db,token)).error,'reset_owner_required')
  await db.query("DELETE FROM storage.objects WHERE bucket_id='sitov-exam-submissions' AND name=$1",[ownAudio])
  await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*)::int n FROM storage.objects WHERE name=$1',[ownAudio])).rows[0].n,1)
  // Service writes and old signed upload tokens are also blocked during the saga.
  await assert.rejects(db.query("INSERT INTO sitov_exam_attempts(student_id,task_id,task_version,unit_id,answer,mode,request_id) VALUES($1,'stale',1,'u','\"a\"','practice',$2)",[student,id(316)]),/learning_reset_in_progress/)
  await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('sitov-exam-submissions',$1)",[late]),/learning_reset_in_progress/)
  await as(db,student)
  await db.query("DELETE FROM storage.objects WHERE bucket_id='sitov-exam-submissions' AND name=$1",[ownPhoto])
  assert.deepEqual((await batch(db,token)).map(f=>f.object_name).sort(),[ownAudio,orphan].sort())
  // A failed/partial Storage request is recoverable via the same persisted manifest.
  assert.equal((await finish(db,token)).error,'audio_removal_incomplete')
  for(const file of await batch(db,token))await db.query('DELETE FROM storage.objects WHERE bucket_id=$1 AND name=$2',[file.bucket_id,file.object_name])
  assert.deepEqual(await batch(db,token),[]);assert.equal(await finish(db,token),true)
  await db.exec('RESET ROLE')
  for(const table of ['sitov_exam_attempts','sitov_exam_hints','sitov_exam_submissions','sitov_exam_unlocks','sitov_exam_upload_tickets'])assert.equal((await db.query(`SELECT count(*)::int n FROM ${table} WHERE student_id=$1`,[student])).rows[0].n,0,table)
  assert.equal((await db.query('SELECT count(*)::int n FROM sitov_exam_feedback')).rows[0].n,0)
  assert.equal((await db.query('SELECT profile_id FROM sitov_exam_profiles WHERE student_id=$1',[student])).rows[0].profile_id,'goethe_b1')
  assert.equal((await db.query('SELECT teacher_id FROM sitov_exam_teacher_assignments WHERE student_id=$1',[student])).rows[0].teacher_id,teacher)
  assert.equal((await db.query('SELECT count(*)::int n FROM sitov_exam_attempts WHERE student_id=$1',[outsider])).rows[0].n,1)
  assert.equal((await db.query('SELECT count(*)::int n FROM storage.objects WHERE name=$1',[otherAudio])).rows[0].n,1)
  assert.equal((await db.query("SELECT count(*)::int n FROM storage.objects WHERE bucket_id='sitov-exam-productions'")).rows[0].n,1)
  await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('sitov-exam-submissions',$1)",[late]),/exam_upload_ticket_expired/)
  // Replayed finish cannot clear new learning after a successful reset.
  await db.query("INSERT INTO sitov_exam_attempts(student_id,task_id,task_version,unit_id,answer,mode,request_id) VALUES($1,'new',1,'u','\"a\"','practice',$2)",[student,id(317)])
  await as(db,student);assert.equal(await finish(db,token),true)
  await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*)::int n FROM sitov_exam_attempts WHERE student_id=$1',[student])).rows[0].n,1)
 }finally{await db.close()}
})

test('exam own account deletion requests private Storage cleanup before auth/profile cascade, with no orphan resurrection',async()=>{
 const db=await fixture()
 try{
  await as(db,outsider)
  assert.equal((await rpc(db,'delete_student_learning_profile',['$1',"'DELETE_STUDENT_PROFILE'"],[student])).error,'not_authorized')
  await as(db,student)
  assert.equal((await rpc(db,'delete_own_learning_profile',["'no'"])).error,'invalid_input')
  const pending=await rpc(db,'delete_own_learning_profile',["'DELETE_LEARNING_PROFILE'"])
  assert.equal(pending.deleted,false);assert.deepEqual(pending.pendingFiles.map(f=>f.object_name).sort(),[ownAudio,ownPhoto,orphan].sort())
  await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*)::int n FROM auth.users WHERE id=$1',[student])).rows[0].n,1)
  await db.query('DELETE FROM storage.objects WHERE name=$1',[ownPhoto])
  await as(db,student);const resume=await rpc(db,'delete_own_learning_profile',["'DELETE_LEARNING_PROFILE'"]);assert.deepEqual(resume.pendingFiles.map(f=>f.object_name).sort(),[ownAudio,orphan].sort())
  for(const file of resume.pendingFiles){await db.exec('RESET ROLE');await db.query('DELETE FROM storage.objects WHERE bucket_id=$1 AND name=$2',[file.bucket_id,file.object_name])}
  await as(db,student);assert.deepEqual(await rpc(db,'delete_own_learning_profile',["'DELETE_LEARNING_PROFILE'"]),{success:true,deleted:true})
  await db.exec('RESET ROLE')
  assert.equal((await db.query('SELECT count(*)::int n FROM auth.users WHERE id=$1',[student])).rows[0].n,0)
  assert.equal((await db.query('SELECT count(*)::int n FROM profiles WHERE id=$1',[student])).rows[0].n,0)
  for(const table of ['sitov_exam_profiles','sitov_exam_teacher_assignments','sitov_exam_attempts','sitov_exam_hints','sitov_exam_submissions','sitov_exam_unlocks','sitov_exam_upload_tickets'])assert.equal((await db.query(`SELECT count(*)::int n FROM ${table} WHERE student_id=$1`,[student])).rows[0].n,0,table)
  assert.equal((await db.query('SELECT count(*)::int n FROM sitov_exam_feedback')).rows[0].n,0)
  assert.equal((await db.query('SELECT auth_user_id FROM people WHERE email=$1',[`${student}@example.test`])).rows[0].auth_user_id,null)
  assert.equal((await db.query('SELECT count(*)::int n FROM storage.objects WHERE name=$1',[otherAudio])).rows[0].n,1)
  await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('sitov-exam-submissions',$1)",[late]),/exam_upload_ticket_expired/)
 }finally{await db.close()}
})

test('authorized staff account deletion uses the same private-file manifest; helpers remain inaccessible',async()=>{
 const db=await fixture()
 try{
  await as(db,teacher);const pending=await rpc(db,'delete_student_learning_profile',['$1',"'DELETE_STUDENT_PROFILE'"],[student])
  assert.equal(pending.deleted,false);assert.equal(pending.pendingFiles.length,3)
  await assert.rejects(db.query('SELECT sitov_exam_private.capture_reset_media($1)',[student]),/permission denied/)
  await assert.rejects(db.query('SELECT * FROM sitov_exam_upload_tickets'),/permission denied/)
  for(const file of pending.pendingFiles){await db.exec('RESET ROLE');await db.query('DELETE FROM storage.objects WHERE bucket_id=$1 AND name=$2',[file.bucket_id,file.object_name])}
  await as(db,teacher);assert.deepEqual(await rpc(db,'delete_student_learning_profile',['$1',"'DELETE_STUDENT_PROFILE'"],[student]),{success:true,deleted:true})
 }finally{await db.close()}
})

test('reset and account deletion each drain a union of exam files and legacy pronunciation files',async()=>{
 const db=await fixture(),ownPronunciation=`${student}/exam-reset-legacy.wav`,foreignPronunciation=`${outsider}/exam-reset-legacy.wav`
 try{
  await db.query("INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('pronunciation_audio',$1,$2),('pronunciation_audio',$3,$4)",[ownPronunciation,student,foreignPronunciation,outsider])
  await as(db,student);const token=await begin(db),files=await batch(db,token)
  assert.equal(files.length,4);assert.deepEqual([...new Set(files.map(f=>f.bucket_id))].sort(),['pronunciation_audio','sitov-exam-submissions'])
  for(const file of files)await db.query('DELETE FROM storage.objects WHERE bucket_id=$1 AND name=$2',[file.bucket_id,file.object_name])
  assert.deepEqual(await batch(db,token),[]);assert.equal(await finish(db,token),true)
  await db.exec('RESET ROLE')
  assert.equal((await db.query('SELECT count(*)::int n FROM storage.objects WHERE name=$1',[foreignPronunciation])).rows[0].n,1)
  // Fresh learning/recording after reset is protected from replayed reset calls.
  const fresh=`${student}/photo/${id(333)}.jpg`
  // PGlite's clock may reuse one millisecond for both statements. This fixture
  // deliberately represents a new ticket issued after the completed reset.
  await db.query("INSERT INTO sitov_exam_upload_tickets(path,student_id,kind,created_at) SELECT $1,$2,'photo',completed_at+interval '1 millisecond' FROM learning_reset_private.jobs WHERE auth_user_id=$2",[fresh,student])
  await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('sitov-exam-submissions',$1)",[fresh])
  await db.query("INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('pronunciation_audio',$1,$2)",[ownPronunciation,student])
  await as(db,student);const examPending=await rpc(db,'delete_own_learning_profile',["'DELETE_LEARNING_PROFILE'"])
  assert.deepEqual(examPending.pendingFiles,[{bucket_id:'sitov-exam-submissions',object_name:fresh}])
  await db.exec('RESET ROLE');await db.query('DELETE FROM storage.objects WHERE name=$1',[fresh])
  await as(db,student);const legacyPending=await rpc(db,'delete_own_learning_profile',["'DELETE_LEARNING_PROFILE'"])
  assert.deepEqual(legacyPending.pendingAudio,[ownPronunciation])
  await db.exec('RESET ROLE');await db.query('DELETE FROM storage.objects WHERE name=$1',[ownPronunciation])
  await as(db,student);assert.deepEqual(await rpc(db,'delete_own_learning_profile',["'DELETE_LEARNING_PROFILE'"]),{success:true,deleted:true})
  await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*)::int n FROM storage.objects WHERE name=$1',[foreignPronunciation])).rows[0].n,1)
 }finally{await db.close()}
})

for(const retired of [teacher,admin])test(`retired ${retired===teacher?'teacher':'admin'} deletion preserves exam audit evidence and shared human recordings`,async()=>{
 const db=await fixture(),raw=`${retired}/raw/real-human.wav`,prepared=`${retired}/prepared/real-human.wav`
 try{
  await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('sitov-exam-productions',$1),('sitov-exam-productions',$2)",[raw,prepared])
  await db.query("INSERT INTO sitov_exam_audio_productions(audio_id,script_hash,raw_path,prepared_path,status,created_by,reviewed_by,word_timings,review_note,reviewed_at,published_at) VALUES('human-published','matching-script-hash',$1,$2,'published',$3,$4,'[{\"word\":\"Hallo\",\"start\":0,\"end\":1}]','Menschliche Aufnahme geprüft.',now(),now())",[raw,prepared,teacher,admin])
  // Existing account deletion intentionally requires an administrator to retire
  // a staff role first. Preserve that authorization contract.
  await db.query("UPDATE profiles SET role='student' WHERE id=$1",[retired])
  await as(db,retired===teacher?admin:teacher)
  assert.deepEqual(await rpc(db,'delete_student_learning_profile',['$1',"'DELETE_STUDENT_PROFILE'"],[retired]),{success:true,deleted:true})
  await db.exec('RESET ROLE')
  assert.equal((await db.query('SELECT count(*)::int n FROM auth.users WHERE id=$1',[retired])).rows[0].n,0)
  const production=(await db.query("SELECT * FROM sitov_exam_audio_productions WHERE audio_id='human-published'")).rows[0]
  assert.equal(production.created_by,teacher);assert.equal(production.reviewed_by,admin);assert.equal(production.status,'published')
  assert.equal((await db.query("SELECT count(*)::int n FROM storage.objects WHERE bucket_id='sitov-exam-productions' AND name IN($1,$2)",[raw,prepared])).rows[0].n,2)
  assert.equal((await db.query('SELECT teacher_id FROM sitov_exam_feedback WHERE submission_id=$1',[source])).rows[0].teacher_id,teacher)
  assert.equal((await db.query('SELECT teacher_id,status FROM sitov_exam_submissions WHERE id=$1',[source])).rows[0].teacher_id,teacher)
  assert.equal((await db.query("SELECT created_by FROM sitov_exam_unlocks WHERE student_id=$1 AND kind='teacher'",[student])).rows[0].created_by,teacher)
  const assignment=(await db.query('SELECT * FROM sitov_exam_teacher_assignments WHERE student_id=$1',[student])).rows[0]
  if(retired===teacher)assert.equal(assignment,undefined)
  else assert.equal(assignment.assigned_by,admin)
  // The learner keeps feedback; an absent former staff identity has no access.
  await as(db,student);assert.equal((await db.query('SELECT count(*)::int n FROM sitov_exam_feedback')).rows[0].n,1)
  await as(db,retired);assert.equal((await db.query('SELECT count(*)::int n FROM sitov_exam_feedback')).rows[0].n,0)
 }finally{await db.close()}
})
