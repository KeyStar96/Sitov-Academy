import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createCurrentDatabase,apply,actor,id,student,teacher,outsider,result} from './helpers/current-db.mjs'

const migration='57_pronunciation_moderation_profile_deletion.sql'
const rollback=await readFile(new URL('../vps/rollback/57_pronunciation_moderation_profile_deletion.sql',import.meta.url),'utf8')
const admin=id(4)
const unit=id(57000),text=id(57001),thread=id(57010),otherThread=id(57011)
const followUp=id(57020),textOnly=id(57021),reply=id(57022),sharedReply=id(57023),otherReply=id(57024)
const booking=id(57030),invoice=id(57031)
const ref=name=>`storage://pronunciation_audio/${name}`
const files={
 recording:`${student}/${id(57100)}.webm`,followUp:`${student}/${id(57101)}.webm`,orphan:`${student}/${id(57102)}.webm`,
 reply:`${teacher}/${id(57103)}.webm`,shared:`${teacher}/${id(57104)}.webm`,other:`${outsider}/${id(57105)}.webm`,
}
const as=async(db,user,role='authenticated')=>{await db.exec('RESET ROLE');await actor(db,user,role)}
const call=(db,fn,params=[])=>result(db,`SELECT ${fn} result`,params)
const count=async(db,table,where='true',params=[])=>(await db.query(`SELECT count(*)::int n FROM ${table} WHERE ${where}`,params)).rows[0].n
const stored=async db=>(await db.query("SELECT name FROM storage.objects WHERE bucket_id='pronunciation_audio' ORDER BY name")).rows.map(row=>row.name)
/** The Storage API removes files; the database only ever reports which ones are still there. */
const removeFromStorage=async(db,names)=>{await db.exec('RESET ROLE');await db.query('DELETE FROM storage.objects WHERE bucket_id=$1 AND name=ANY($2::text[])',['pronunciation_audio',names])}

async function fixture(){
 const db=await createCurrentDatabase()
 try{
  await db.exec('RESET ROLE')
  await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[admin,'admin@example.test'])
  await db.query("INSERT INTO profiles(id,role,native_language,ui_language) VALUES($1,'admin','de','de') ON CONFLICT(id) DO UPDATE SET role='admin'",[admin])
  await db.query("UPDATE people SET display_name='Anna Beispiel',street='Musterweg 1',postal_code='12345',city='Berlin',phone='030 123' WHERE auth_user_id=$1",[student])
  await db.query("INSERT INTO learning_units(id,level,trainer,label) VALUES($1,'A1.1','pronunciation','Lesetext 1')",[unit])
  await db.query("INSERT INTO learning_reading_texts(id,unit_id,sentence_de) VALUES($1,$2,'Guten Tag, ich heiße Anna.')",[text,unit])
  for(const [name,owner] of [[files.recording,student],[files.followUp,student],[files.orphan,student],[files.reply,teacher],[files.shared,teacher],[files.other,outsider]])
   await db.query("INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('pronunciation_audio',$1,$2)",[name,owner])
  // Fixture rows only: the write triggers are covered by the pronunciation and reset suites.
  await db.exec('SET session_replication_role=replica')
  await db.query("INSERT INTO submissions(id,auth_user_id,type,content_url,text_content,status,level,prompt_id,created_at) VALUES($1,$2,'audio',$3,'Guten Tag.','pending','A1.1',$4,'2026-09-01'),($5,$6,'audio',$7,'Guten Tag.','reviewed','A1.1',$4,'2026-09-01')",
   [thread,student,ref(files.recording),text,otherThread,outsider,ref(files.other)])
  await db.query(`INSERT INTO pronunciation_messages(id,submission_id,sender_id,sender_role,text_content,audio_path,created_at) VALUES
   ($1,$2,$3,'teacher','Sehr gut!',$4,'2026-09-02'),
   ($5,$2,$3,'teacher','Hör dir das an.',$6,'2026-09-03'),
   ($7,$2,$8,'student','',$9,'2026-09-04'),
   ($10,$2,$8,'student','Danke!',NULL,'2026-09-05'),
   ($11,$12,$3,'teacher','Auch für dich.',$6,'2026-09-03')`,
   [reply,thread,teacher,ref(files.reply),sharedReply,ref(files.shared),followUp,student,ref(files.followUp),textOnly,otherReply,otherThread])
  await db.query("INSERT INTO vocabulary_private.answer_receipts(auth_user_id,request_id,progress_id,typed_answer,ui_language,response) VALUES($1,$2,$3,'Haus','ru','{\"isCorrect\":true}'),($4,$5,$3,'Haus','ru','{\"isCorrect\":true}')",[student,id(57200),id(57201),outsider,id(57202)])
  await db.query('INSERT INTO teacher_student_notes(student_id,teacher_id,note_text) VALUES($1,$2,$3)',[student,teacher,'Fleißig.'])
  await db.query("INSERT INTO bookings(id,person_id,target_month,start_date,contact_name,contact_email,contact_street,privacy_accepted,agb_accepted) SELECT $1,p.id,'2026-10-01','2026-10-05','Anna Beispiel',p.email,'Musterweg 1',true,true FROM people p WHERE p.auth_user_id=$2",[booking,student])
  await db.query("INSERT INTO invoice_cases(id,person_id,target_month,booking_id) SELECT $1,p.id,'2026-10-01',$2 FROM people p WHERE p.auth_user_id=$3",[invoice,booking,student])
  await db.exec('SET session_replication_role=origin')
  await db.query("INSERT INTO student_level_access VALUES($1,'A1.1') ON CONFLICT DO NOTHING",[outsider])
  await db.query(`INSERT INTO private.mail_outbox(dedupe_key,kind,recipient,payload) VALUES
   ($1,'feedback_available','anna@example.test',$2),
   ($3,'learning_reminder','anna@example.test','{}'),
   ($4,'level_access_granted','anna@example.test','{}'),
   ('booking:1','registration_received','anna@example.test','{}'),
   ($5,'feedback_available','other@example.test',$6)`,
   [`pronunciation-thread:${thread}:${reply}`,JSON.stringify({authUserId:student,submissionId:thread}),`learning-reminder:${student}:2026-10-02`,`level-access:${student}:A1.1`,
    `pronunciation-thread:${otherThread}:${otherReply}`,JSON.stringify({authUserId:outsider,submissionId:otherThread})])
  return db
 }catch(error){await db.close();delete error.query;throw error}
}
const scenario=(name,run)=>test(`phase 2 deletions: ${name}`,async()=>{const db=await fixture();try{await run(db)}finally{await db.close()}})

const view=db=>call(db,'get_staff_pronunciation_view()')
const everything=async db=>result(db,`SELECT jsonb_build_object('submissions',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM submissions s),
 'messages',(SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM pronunciation_messages m),'objects',(SELECT jsonb_agg(name ORDER BY name) FROM storage.objects)) result`)

scenario('functions are definer-only, closed to anonymous callers; helper and staff markers are unreachable',async db=>{
 await db.exec('RESET ROLE')
 for(const fn of ['public.set_pronunciation_submission_hidden(uuid,boolean)','public.set_pronunciation_message_hidden(uuid,boolean)','public.get_staff_pronunciation_view()','public.delete_own_learning_profile(text)','public.delete_student_learning_profile(uuid,text)','identity_private.remove_learning_profile(uuid)','pronunciation_private.reveal_conversation()']){
  const row=(await db.query("SELECT prosecdef,proconfig,has_function_privilege('anon',oid,'EXECUTE') anon FROM pg_proc WHERE oid=$1::regprocedure",[fn])).rows[0]
  assert.equal(row.prosecdef,true,fn);assert.deepEqual(row.proconfig,['search_path=""'],fn);assert.equal(row.anon,false,fn)
 }
 // No caller-supplied identity on the learner's own delete.
 assert.equal((await db.query("SELECT pronargs FROM pg_proc WHERE oid='public.delete_own_learning_profile(text)'::regprocedure")).rows[0].pronargs,1)
 for(const user of [teacher,student]){
  await as(db,user)
  await assert.rejects(db.query('SELECT identity_private.remove_learning_profile($1)',[student]),error=>error.code==='42501')
  // Neither learners nor staff read or write the markers directly.
  for(const table of ['staff_hidden_submissions','staff_hidden_messages']){
   await assert.rejects(db.query(`SELECT * FROM pronunciation_private.${table}`),error=>error.code==='42501')
   await assert.rejects(db.query(`DELETE FROM pronunciation_private.${table}`),error=>error.code==='42501')
  }
 }
 await as(db,null,'anon')
 for(const sql of ['set_pronunciation_submission_hidden($1,true)','set_pronunciation_message_hidden($1,true)','delete_student_learning_profile($1,\'DELETE_STUDENT_PROFILE\')'])
  await assert.rejects(db.query(`SELECT ${sql}`,[thread]),error=>error.code==='42501')
 await assert.rejects(db.query('SELECT get_staff_pronunciation_view()'),error=>error.code==='42501')
 await as(db,null)
 assert.equal((await call(db,'set_pronunciation_submission_hidden($1,true)',[thread])).error,'not_authenticated')
 assert.equal((await call(db,'set_pronunciation_message_hidden($1,true)',[followUp])).error,'not_authenticated')
 assert.equal((await view(db)).error,'not_authenticated')
 assert.equal((await call(db,"delete_own_learning_profile('DELETE_LEARNING_PROFILE')")).error,'not_authenticated')
 assert.equal((await call(db,"delete_student_learning_profile($1,'DELETE_STUDENT_PROFILE')",[student])).error,'not_authenticated')
 await db.exec('RESET ROLE');assert.equal(await count(db,'auth.users'),4);assert.equal(await count(db,'pronunciation_private.staff_hidden_submissions'),0)
})

scenario('learners cannot change the staff view or delete another profile',async db=>{
 for(const user of [student,outsider]){
  await as(db,user)
  assert.equal((await call(db,'set_pronunciation_submission_hidden($1,true)',[thread])).error,'not_authorized')
  assert.equal((await call(db,'set_pronunciation_message_hidden($1,true)',[followUp])).error,'not_authorized')
  assert.equal((await view(db)).error,'not_authorized')
  assert.equal((await call(db,"delete_student_learning_profile($1,'DELETE_STUDENT_PROFILE')",[student])).error,'not_authorized')
 }
 await db.exec('RESET ROLE');assert.equal(await count(db,'pronunciation_private.staff_hidden_messages'),0);assert.equal(await count(db,'profiles'),4)
})

scenario('removing a learner message from the staff view deletes nothing and can be undone',async db=>{
 await db.exec('RESET ROLE');const before=await everything(db)
 await as(db,teacher)
 for(const [message,hidden,error] of [[null,true,'invalid_input'],[followUp,null,'invalid_input'],[id(99999),true,'not_found'],[reply,true,'not_authorized']])
  assert.equal((await call(db,'set_pronunciation_message_hidden($1,$2)',[message,hidden])).error,error,`${message} ${hidden}`)
 // Learner text was the latest message: the conversation waits; the other one is answered.
 assert.deepEqual(await view(db),{success:true,hiddenSubmissions:[],hiddenMessages:[],pendingCount:1})
 assert.deepEqual(await call(db,'set_pronunciation_message_hidden($1,true)',[textOnly]),{success:true,hidden:true})
 assert.deepEqual(await call(db,'set_pronunciation_message_hidden($1,true)',[textOnly]),{success:true,hidden:true})
 assert.deepEqual(await view(db),{success:true,hiddenSubmissions:[],hiddenMessages:[textOnly],pendingCount:1})
 assert.deepEqual(await call(db,'set_pronunciation_message_hidden($1,true)',[followUp]),{success:true,hidden:true})
 // With both learner follow-ups out of view the teacher's reply is the latest visible message: answered.
 assert.deepEqual(await view(db),{success:true,hiddenSubmissions:[],hiddenMessages:[followUp,textOnly].sort(),pendingCount:0})
 // Rows, stored status and recordings are untouched; the learner reads and plays everything as before.
 await db.exec('RESET ROLE');assert.deepEqual(await everything(db),before)
 assert.equal((await db.query('SELECT hidden_by FROM pronunciation_private.staff_hidden_messages WHERE message_id=$1',[followUp])).rows[0].hidden_by,teacher)
 await as(db,student)
 assert.equal((await db.query('SELECT status FROM submissions WHERE id=$1',[thread])).rows[0].status,'pending')
 assert.deepEqual((await db.query('SELECT id FROM pronunciation_messages WHERE submission_id=$1 ORDER BY created_at',[thread])).rows.map(row=>row.id),[reply,sharedReply,followUp,textOnly])
 // Undo – also by another member of staff.
 await as(db,admin)
 assert.deepEqual(await call(db,'set_pronunciation_message_hidden($1,false)',[followUp]),{success:true,hidden:false})
 assert.deepEqual(await call(db,'set_pronunciation_message_hidden($1,false)',[followUp]),{success:true,hidden:false})
 assert.deepEqual(await view(db),{success:true,hiddenSubmissions:[],hiddenMessages:[textOnly],pendingCount:1})
})

scenario('a conversation without visible messages keeps waiting; an untouched legacy status is respected',async db=>{
 await db.exec('RESET ROLE');await db.query('DELETE FROM pronunciation_messages WHERE id=ANY($1::uuid[])',[[reply,sharedReply,textOnly]])
 await db.query("UPDATE submissions SET status='reviewed' WHERE id=$1",[thread]);await db.query('DELETE FROM pronunciation_messages WHERE submission_id=$1',[otherThread])
 await as(db,teacher)
 // otherThread: no message at all, stored status reviewed → answered. thread: learner follow-up is latest → waiting.
 assert.equal((await view(db)).pendingCount,1)
 await call(db,'set_pronunciation_message_hidden($1,true)',[followUp])
 assert.equal((await view(db)).pendingCount,1)
})

scenario('removing a conversation from the staff view keeps everything for the learner; a new learner message brings it back',async db=>{
 await db.exec('RESET ROLE');const before=await everything(db);const mails=await count(db,'private.mail_outbox')
 await as(db,teacher)
 for(const [submission,hidden,error] of [[null,true,'invalid_input'],[thread,null,'invalid_input'],[id(99999),true,'not_found']])
  assert.equal((await call(db,'set_pronunciation_submission_hidden($1,$2)',[submission,hidden])).error,error)
 const listed=async()=>(await call(db,"get_teacher_student_detail($1,'pronunciation')",[student])).data.conversations
 assert.deepEqual((await listed()).map(row=>[row.id,row.messageCount,row.unansweredCount]),[[thread,4,1]])
 assert.deepEqual(await call(db,'set_pronunciation_submission_hidden($1,true)',[thread]),{success:true,hidden:true})
 assert.deepEqual(await call(db,'set_pronunciation_submission_hidden($1,true)',[thread]),{success:true,hidden:true})
 assert.deepEqual(await view(db),{success:true,hiddenSubmissions:[thread],hiddenMessages:[],pendingCount:0})
 // The pronunciation tab of the learner's staff profile no longer lists it either.
 assert.deepEqual(await listed(),[])
 // Nothing was deleted: rows, recordings, the queued reply mail – and the learner's own access.
 await db.exec('RESET ROLE');assert.deepEqual(await everything(db),before);assert.equal(await count(db,'private.mail_outbox'),mails)
 await as(db,student)
 assert.equal(await count(db,'submissions','id=$1',[thread]),1);assert.equal(await count(db,'pronunciation_messages','submission_id=$1',[thread]),4)
 // Undo restores the staff view.
 await as(db,teacher)
 assert.deepEqual(await call(db,'set_pronunciation_submission_hidden($1,false)',[thread]),{success:true,hidden:false})
 assert.deepEqual((await listed()).map(row=>row.id),[thread]);assert.equal((await view(db)).pendingCount,1)
 // A single removed message only lowers the counters of the tab.
 await call(db,'set_pronunciation_message_hidden($1,true)',[followUp])
 assert.deepEqual((await listed()).map(row=>[row.id,row.messageCount,row.unansweredCount]),[[thread,3,0]])
 // Hidden again; then the learner writes: the conversation returns, the removed message stays out of view.
 await call(db,'set_pronunciation_submission_hidden($1,true)',[thread])
 await db.query("INSERT INTO pronunciation_messages(submission_id,sender_id,text_content) VALUES($1,$2,'Noch eine Antwort der Lehrkraft.')",[thread,teacher])
 assert.deepEqual((await view(db)).hiddenSubmissions,[thread])
 await as(db,student);await db.query("INSERT INTO pronunciation_messages(submission_id,sender_id,text_content) VALUES($1,$2,'Ich habe noch eine Frage.')",[thread,student])
 await as(db,teacher)
 assert.deepEqual(await view(db),{success:true,hiddenSubmissions:[],hiddenMessages:[followUp],pendingCount:1})
 assert.deepEqual((await listed()).map(row=>[row.id,row.messageCount]),[[thread,5]])
})

async function assertProfileRemoved(db){
 await db.exec('RESET ROLE')
 assert.equal(await count(db,'auth.users','id=$1',[student]),0);assert.equal(await count(db,'profiles','id=$1',[student]),0)
 for(const table of ['submissions','student_level_access','vocabulary_private.answer_receipts','learning_reset_private.jobs'])
  assert.equal(await count(db,table,'auth_user_id=$1',[student]),0,table)
 assert.equal(await count(db,'teacher_student_notes','student_id=$1',[student]),0)
 assert.equal(await count(db,'pronunciation_messages','submission_id=$1',[thread]),0)
 // The person behind the profile, the booking and the open invoice are untouched.
 const person=(await db.query("SELECT auth_user_id,display_name,email,street,postal_code,city,phone FROM people WHERE display_name='Anna Beispiel'")).rows
 assert.deepEqual(person,[{auth_user_id:null,display_name:'Anna Beispiel',email:`${student}@example.test`,street:'Musterweg 1',postal_code:'12345',city:'Berlin',phone:'030 123'}])
 assert.equal(await count(db,'people'),3)
 assert.equal(await count(db,'bookings','id=$1 AND contact_street=$2',[booking,'Musterweg 1']),1);assert.equal(await count(db,'invoice_cases','id=$1',[invoice]),1)
 // Everybody else keeps account, learning data and recordings.
 assert.equal(await count(db,'auth.users'),3);assert.equal(await count(db,'profiles'),3)
 assert.equal(await count(db,'submissions','id=$1',[otherThread]),1);assert.equal(await count(db,'pronunciation_messages','id=$1',[otherReply]),1)
 assert.equal(await count(db,'vocabulary_private.answer_receipts','auth_user_id=$1',[outsider]),1);assert.equal(await count(db,'student_level_access','auth_user_id=$1',[outsider]),1)
 assert.deepEqual(await stored(db),[files.shared,files.other].sort())
 // Optional learning mails are withdrawn; the booking mail and other learners' mails stay queued.
 const queued=(await db.query('SELECT dedupe_key FROM private.mail_outbox')).rows.map(row=>row.dedupe_key)
 assert.ok(!queued.some(key=>key.includes(student)||key.includes(thread)),queued.join(' '))
 for(const key of ['booking:1',`pronunciation-thread:${otherThread}:${otherReply}`])assert.ok(queued.includes(key),key)
}

scenario('learners delete their own learning profile; person, booking and invoice stay',async db=>{
 await as(db,student)
 for(const confirmation of ['yes','DELETE_STUDENT_PROFILE',null])assert.equal((await call(db,'delete_own_learning_profile($1)',[confirmation])).error,'invalid_input')
 const first=await call(db,"delete_own_learning_profile('DELETE_LEARNING_PROFILE')")
 assert.equal(first.deleted,false);assert.deepEqual(first.pendingAudio,[files.recording,files.followUp,files.orphan,files.reply].sort())
 await db.exec('RESET ROLE');assert.equal(await count(db,'profiles','id=$1',[student]),1);assert.equal(await count(db,'submissions','auth_user_id=$1',[student]),1)
 await removeFromStorage(db,first.pendingAudio);await as(db,student)
 assert.deepEqual(await call(db,"delete_own_learning_profile('DELETE_LEARNING_PROFILE')"),{success:true,deleted:true})
 // The still-valid access token of a deleted account opens nothing.
 assert.equal((await call(db,"delete_own_learning_profile('DELETE_LEARNING_PROFILE')")).error,'not_found')
 await assertProfileRemoved(db)
})

scenario('teachers and administrators cannot delete their own account here',async db=>{
 for(const user of [teacher,admin]){
  await as(db,user);assert.equal((await call(db,"delete_own_learning_profile('DELETE_LEARNING_PROFILE')")).error,'not_authorized')
 }
 await db.exec('RESET ROLE');assert.equal(await count(db,'auth.users'),4)
})

scenario('staff delete a learner profile, never staff accounts or themselves',async db=>{
 await as(db,teacher)
 for(const [target,confirmation,error] of [[student,'DELETE_LEARNING_PROFILE','invalid_input'],[student,null,'invalid_input'],[null,'DELETE_STUDENT_PROFILE','invalid_input'],
  [id(99999),'DELETE_STUDENT_PROFILE','not_found'],[teacher,'DELETE_STUDENT_PROFILE','not_authorized'],[admin,'DELETE_STUDENT_PROFILE','not_authorized']])
  assert.equal((await call(db,'delete_student_learning_profile($1,$2)',[target,confirmation])).error,error,`${target} ${confirmation}`)
 await as(db,admin);assert.equal((await call(db,"delete_student_learning_profile($1,'DELETE_STUDENT_PROFILE')",[teacher])).error,'not_authorized')
 await db.exec('RESET ROLE');assert.equal(await count(db,'auth.users'),4)
 await as(db,teacher)
 const first=await call(db,"delete_student_learning_profile($1,'DELETE_STUDENT_PROFILE')",[student])
 assert.deepEqual(first.pendingAudio,[files.recording,files.followUp,files.orphan,files.reply].sort())
 await removeFromStorage(db,first.pendingAudio);await as(db,teacher)
 assert.deepEqual(await call(db,"delete_student_learning_profile($1,'DELETE_STUDENT_PROFILE')",[student]),{success:true,deleted:true})
 await assertProfileRemoved(db)
})

scenario('a profile that business records still name as staff is kept completely',async db=>{
 await db.exec('RESET ROLE');await db.query('UPDATE bookings SET confirmed_by=$1,confirmed_at=now() WHERE id=$2',[student,booking])
 const mails=await count(db,'private.mail_outbox')
 await removeFromStorage(db,[files.recording,files.followUp,files.orphan,files.reply]);await as(db,teacher)
 const failed=await call(db,"delete_student_learning_profile($1,'DELETE_STUDENT_PROFILE')",[student])
 assert.equal(failed.error,'conflict');assert.equal(failed.sqlstate,'23503')
 await as(db,student);assert.equal((await call(db,"delete_own_learning_profile('DELETE_LEARNING_PROFILE')")).error,'conflict')
 // Nothing was removed on the way to the failure.
 await db.exec('RESET ROLE')
 assert.equal(await count(db,'profiles','id=$1',[student]),1);assert.equal(await count(db,'submissions','auth_user_id=$1',[student]),1)
 assert.equal(await count(db,'vocabulary_private.answer_receipts','auth_user_id=$1',[student]),1);assert.equal(await count(db,'private.mail_outbox'),mails)
 assert.equal(await count(db,'pronunciation_messages','submission_id=$1',[thread]),4)
})

scenario('migration changes no row, can be repeated and rolls back to the previous functions',async db=>{
 await db.exec('RESET ROLE')
 const snapshot=async()=>result(db,`SELECT jsonb_build_object('users',(SELECT count(*) FROM auth.users),'profiles',(SELECT count(*) FROM profiles),'people',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM people p),
  'submissions',(SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM submissions s),'messages',(SELECT jsonb_agg(to_jsonb(m) ORDER BY id) FROM pronunciation_messages m),
  'objects',(SELECT count(*) FROM storage.objects),'mail',(SELECT count(*) FROM private.mail_outbox)) result`)
 const detail=async()=>(await db.query("SELECT pg_get_functiondef('public.get_teacher_student_detail(uuid,text,text)'::regprocedure) definition")).rows[0].definition
 const before=await snapshot(),patched=await detail()
 assert.equal(patched.split('staff-hidden-v1').length,2)
 await apply(db,[migration]);await apply(db,[migration])
 assert.deepEqual(await snapshot(),before);assert.equal(await detail(),patched)
 // Markers survive a rollback as an archive; the staff view simply shows everything again.
 await as(db,teacher);await call(db,'set_pronunciation_submission_hidden($1,true)',[thread]);await db.exec('RESET ROLE')
 await db.exec(`BEGIN;${rollback}COMMIT;`)
 assert.equal(await count(db,'pg_proc',"proname IN('set_pronunciation_submission_hidden','set_pronunciation_message_hidden','get_staff_pronunciation_view','reveal_conversation','delete_own_learning_profile','delete_student_learning_profile','remove_learning_profile')"),0)
 assert.equal(await count(db,'pg_trigger',"tgname='pronunciation_message_reveal'"),0)
 assert.ok(!(await detail()).includes('staff_hidden'))
 assert.deepEqual(await snapshot(),before);assert.equal(await count(db,'pronunciation_private.staff_hidden_submissions'),1)
 await as(db,teacher);assert.equal((await call(db,"get_teacher_student_detail($1,'pronunciation')",[student])).data.conversations.length,1)
 await db.exec('RESET ROLE');await db.exec(`BEGIN;${rollback}COMMIT;`);await apply(db,[migration])
 assert.equal(await detail(),patched)
 await as(db,teacher);assert.equal((await call(db,'set_pronunciation_message_hidden($1,true)',[reply])).error,'not_authorized')
 assert.deepEqual((await call(db,"get_teacher_student_detail($1,'pronunciation')",[student])).data.conversations,[])
})
