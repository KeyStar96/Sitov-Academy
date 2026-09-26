import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createLearningPathDatabase,apply,actor,id,student,teacher,outsider,vocabularyUnit,result} from './helpers/learning-path-db.mjs'
const unit=id(21000),unit2=id(21001),practice=id(21100),review=id(21101),exam=id(21102),practice2=id(21103)
const own=id(22000),card=id(22001),ownCard=id(22002),vprogress=id(22003)
const as=async(db,user)=>{await db.exec('RESET ROLE');await actor(db,user)}
const call=(db,fn,params=[])=>result(db,`SELECT ${fn} result`,params)
const detail=(db,tab,user=student)=>call(db,'get_teacher_student_detail($1,$2)',[user,tab])
const list=db=>call(db,'get_teacher_dashboard_students()')
const manage=(db,action,node=null,request=id(25000),path=unit)=>call(db,'manage_learning_path($1,$2,$3,$4,$5)',[student,path,action,node,request])
async function fixture(){
 const db=await createLearningPathDatabase()
 try{
  await apply(db,['36_migrate_old_grammar_progress.sql','37_vocabulary_carryover.sql','38_learning_sessions.sql','39_teacher_dashboard.sql'])
  for(const [u,order] of [[unit,1],[unit2,2]]){
   await db.query("INSERT INTO learning_units(id,level,trainer,label,sort_order,is_path,path_source_id,path_slug,path_title) VALUES($1,'A1.1','exercises','Prüfpfad '||$2::text,$2::integer,true,$3,$3,'Prüfpfad')",[u,order,`teacher-fixture-${order}`])
   await db.query("INSERT INTO path_objectives(unit_id,id,area,description) VALUES($1,'goal','grammar','Prüfziel')",[u])
  }
  for(const [n,u,kind,order] of [[practice,unit,'practice',1],[review,unit,'review',2],[exam,unit,'test',3],[practice2,unit2,'practice',1]]){
   await db.query("INSERT INTO path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,merkkarte,goals,test_size) VALUES($1,$2,$3,$4,$5,'Prüfknoten','Prüfung',$6,ARRAY['goal'],$7)",[n,u,n,kind,order,kind==='test'?null:JSON.stringify({rule:'Wähle Ja.',examples:['Ja.']}),kind==='test'?1:null])
   for(let i=0;i<(kind==='test'?2:1);i++)await db.query("INSERT INTO learning_exercises(id,unit_id,node_id,goal_id,source_ref,sort_order,topic,type,content) VALUES($1,$2,$3,'goal',$4,$5,'Prüfung','multiple_choice',$6)",[id(Number(n.slice(-5))*10+1000+i),u,n,`${n}-${i}`,i+1,JSON.stringify({target_form:['Ja'],question:'Wähle Ja.',options:['Ja','Nein'],correct_answer:'Ja',accepted_answers:['Ja']})])
  }
  await db.query("INSERT INTO learning_units(id,level,trainer,label,owner_auth_user_id) VALUES($1,'A1.1','vocabulary','Eigene Wörter',$2)",[own,student])
  for(const [c,u,word] of [[card,vocabularyUnit,'Haus'],[ownCard,own,'GEHEIMWORT']]){
   await db.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,article) VALUES($1,$2,$3,'das')",[c,u,word])
   for(const [dir,box] of [['native_to_de',2],['de_to_native',7]])await db.query("INSERT INTO vocabulary_direction_progress(id,auth_user_id,card_id,direction,box_number,lapses,next_review_date) VALUES($1,$2,$3,$4,$5,3,now()-interval '1 day')",[c===card&&dir==='native_to_de'?vprogress:id(24000+(c===card?0:10)+(dir==='de_to_native'?1:0)),student,c,dir,box])
  }
  await as(db,teacher);return db
 }catch(e){await db.close();delete e.query;throw e}
}
async function complete(db,node){await as(db,student);const run=await call(db,'start_path_node($1)',[node]);assert.ok(run.run_id,JSON.stringify(run));const answer=await call(db,"submit_path_answer($1,$2,'{\"index\":0}'::jsonb,$3)",[run.run_id,run.queue[0],id(Number(node.slice(-5))+5000)]);assert.equal(answer.completed,true);return {run,answer}}
async function attempt(db,index=0){await as(db,student);const start=await call(db,'start_path_test($1)',[exam]);assert.ok(start.attempt_id,JSON.stringify(start));await call(db,'submit_path_test_answer($1,$2,$3)',[start.attempt_id,start.exercises[0].id,JSON.stringify({index})]);const finish=await call(db,'finish_path_test($1)',[start.attempt_id]);assert.equal(finish.passed,index===0);return {start,finish}}
const scenario=(name,fn)=>test(`teacher dashboard: ${name}`,async()=>{const db=await fixture();try{await fn(db)}finally{await db.close()}})

scenario('all new reads deny learners and unauthenticated, staff can read all students and all tabs',async db=>{
 for(const user of [student,outsider,null]){await as(db,user);assert.equal((await list(db)).error,'not_authorized');for(const tab of ['overview','vocabulary','path','pronunciation','activity','notes'])assert.equal((await detail(db,tab)).error,'not_authorized')}
 await as(db,teacher);assert.equal((await list(db)).students.length,3)
 for(const user of [student,outsider])for(const tab of ['overview','vocabulary','path','pronunciation','activity','notes'])assert.equal((await detail(db,tab,user)).success,true,tab)
 assert.equal((await detail(db,'unknown')).error,'invalid_input');assert.equal((await detail(db,'overview',id(99999))).error,'not_found')
 await db.exec('RESET ROLE');for(const fn of ['get_teacher_dashboard_students()','get_teacher_student_detail(uuid,text,text)','manage_learning_path(uuid,uuid,text,uuid,uuid)']){
 const row=(await db.query("SELECT prosecdef,proconfig,has_function_privilege('anon',oid,'EXECUTE') anon FROM pg_proc WHERE oid=$1::regprocedure",[fn])).rows[0]
 assert.equal(row.prosecdef,true);assert.deepEqual(row.proconfig,['search_path=""']);assert.equal(row.anon,false)
 }
 await as(db,teacher);await assert.rejects(db.query('SELECT teacher_dashboard_private.students()'),e=>e.code==='42501')
})
scenario('private own words expose only count and never content, receipts, boxes or lapse ranking',async db=>{
 await db.exec('RESET ROLE');const privateProgress=(await db.query("SELECT id FROM vocabulary_direction_progress WHERE card_id=$1 AND direction='native_to_de'",[ownCard])).rows[0].id
 for(const [progress,typed] of [[vprogress,'falsch'],[privateProgress,'GEHEIME ANTWORT']])await db.query("INSERT INTO vocabulary_private.answer_receipts(auth_user_id,request_id,progress_id,typed_answer,ui_language,response) VALUES($1,$2,$3,$4,'ru','{\"isCorrect\":false}')",[student,id(progress===vprogress?28000:28001),progress,typed])
 await as(db,teacher);const data=(await detail(db,'vocabulary')).data
 assert.equal(data.ownWordCount,1);assert.equal(data.halfKnown.length,1);assert.equal(data.hardest.length,1);assert.equal(data.recentAnswers.length,1);assert.equal(data.recentAnswers[0].typedAnswer,'falsch');assert.equal(data.byLevel[0].phases['2'],1)
 assert.ok(!JSON.stringify(data).includes('GEHEIM'));assert.ok(!JSON.stringify(data).includes(ownCard));assert.equal((await list(db)).students.find(s=>s.id===student).dueCards,1)
})
scenario('vocabulary pauses, carried candidates and level/lesson totals use card pairs once',async db=>{
 await db.exec('RESET ROLE');await db.query('INSERT INTO vocabulary_lesson_pauses(auth_user_id,unit_id) VALUES($1,$2)',[student,vocabularyUnit]);await as(db,teacher)
 const data=(await detail(db,'vocabulary')).data;assert.equal(data.byLevel[0].totalCards,1);assert.equal(data.byLesson[0].totalInBox,1);assert.equal(data.pausedLessons[0].id,vocabularyUnit)
 assert.equal((await list(db)).students.find(s=>s.id===student).dueCards,0)
})
scenario('attention thresholds are calculated in SQL; never-active old registrations count inactive',async db=>{
 await db.exec('RESET ROLE');await db.query("UPDATE profiles SET created_at=now()-interval '8 days' WHERE id=$1",[outsider]);
 await db.query("INSERT INTO vocabulary_private.answer_receipts(auth_user_id,request_id,progress_id,typed_answer,ui_language,response) VALUES($1,$2,$3,'wrong','ru','{\"isCorrect\":false}')",[student,id(28000),vprogress]);await as(db,teacher)
 const rows=(await list(db)).students;assert.ok(rows.find(s=>s.id===outsider).attentionReasons.includes('inactive_7_days'));assert.ok(rows.find(s=>s.id===student).attentionReasons.includes('accuracy_below_50'))
 await db.exec('RESET ROLE');await db.query("INSERT INTO vocabulary_private.answer_receipts(auth_user_id,request_id,progress_id,typed_answer,ui_language,response) VALUES($1,$2,$3,'right','ru','{\"isCorrect\":true}')",[student,id(28001),vprogress]);await as(db,teacher)
 assert.ok(!(await list(db)).students.find(s=>s.id===student).attentionReasons.includes('accuracy_below_50'),'50% is not under 50%')
})
scenario('activity totals, modes and current streak survive gaps and count 7/30 calendar days',async db=>{
 await db.exec('RESET ROLE');await db.query("INSERT INTO learning_activity_days(auth_user_id,day,study_seconds,answer_count,mode_seconds,last_activity_at) SELECT $1,(now() AT TIME ZONE 'Europe/Berlin')::date-n,100,2,'{\"path\":100}',now()-n*interval '1 day' FROM unnest(ARRAY[0,1,3,8]) n ON CONFLICT(auth_user_id,day) DO UPDATE SET study_seconds=excluded.study_seconds,answer_count=excluded.answer_count,mode_seconds=excluded.mode_seconds,last_activity_at=excluded.last_activity_at",[student]);await as(db,teacher)
 const row=(await list(db)).students.find(s=>s.id===student);assert.equal(row.learningSeconds7d,300);assert.equal(row.learningSeconds30d,400);assert.equal(row.streakDays,2)
 const data=(await detail(db,'activity')).data;assert.equal(data.days.length,30);assert.equal(data.totalSeconds,400);assert.deepEqual(data.byMode,[{mode:'path',seconds:400}])
})
scenario('reset test preserves graded answers and practice stars, revokes pass and stale finish, deduplicates retries',async db=>{
 await complete(db,practice);await complete(db,review);const passed=await attempt(db);await as(db,teacher)
 const first=await manage(db,'reset_test',exam);assert.equal(first.success,true);assert.deepEqual(await manage(db,'reset_test',exam),first)
 const data=(await detail(db,'path')).data;assert.equal(data.attempts.length,1);assert.equal(data.attempts[0].isActive,false);assert.equal(data.attempts[0].answers[0].result.status,'EXACT');assert.equal(data.paths[0].completed,false);assert.equal(data.paths[0].nodes[0].stars,3);assert.equal(data.paths[1].available,false);assert.equal(data.interventions.length,1)
 await as(db,student);assert.equal((await call(db,'finish_path_test($1)',[passed.start.attempt_id])).error,'attempt_unavailable');const next=await call(db,'start_path_test($1)',[exam]);assert.notEqual(next.attempt_id,passed.start.attempt_id);assert.equal(next.exercises[0].answer,null)
 await as(db,teacher);assert.equal((await manage(db,'reset_path',null)).error,'request_conflict')
})
scenario('reset path archives practice state and invalidates cached receipts without deleting audit',async db=>{
 const old=await complete(db,practice);await as(db,teacher);assert.equal((await manage(db,'unlock',null,id(25001),unit2)).success,true);assert.equal((await manage(db,'reset_path',null,id(25002))).success,true)
 let data=(await detail(db,'path')).data;assert.equal(data.paths[0].nodes[0].stars,0);assert.equal(data.paths[0].nodes[0].status,null)
 await as(db,student);const stale=await call(db,"submit_path_answer($1,$2,'{\"index\":0}'::jsonb,$3)",[old.run.run_id,old.run.queue[0],id(Number(practice.slice(-5))+5000)]);assert.equal(stale.error,'attempt_unavailable')
 const fresh=await call(db,'start_path_node($1)',[practice]);assert.notEqual(fresh.run_id,old.run.run_id);await as(db,teacher);data=(await detail(db,'path')).data;assert.equal(data.paths[0].nodes[0].status,'in_progress');assert.equal(data.paths[0].nodes[0].stars,0)
 assert.equal(data.interventions.length,2);await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*)::int n FROM teacher_dashboard_private.progress_archive')).rows[0].n,1)
 assert.equal((await db.query('SELECT count(*)::int n FROM path_private.answer_receipts')).rows[0].n,1)
})
scenario('reset an unlocked path deactivates unlock but preserves both log entries and idempotency',async db=>{
 assert.equal((await manage(db,'unlock',null,id(25001),unit2)).success,true);assert.equal((await detail(db,'path')).data.paths[1].available,true)
 assert.equal((await manage(db,'reset_path',null,id(25002),unit2)).success,true);assert.equal((await detail(db,'path')).data.paths[1].available,false)
 assert.equal((await manage(db,'unlock',null,id(25001),unit2)).success,true);const data=(await detail(db,'path')).data;assert.equal(data.paths[1].available,false,'retry does not undo newer reset');assert.equal(data.interventions.length,2)
})
scenario('emergency controls reject learners, foreign/mismatched test nodes and invalid input atomically',async db=>{
 await as(db,student);assert.equal((await manage(db,'reset_path')).error,'not_authorized');await as(db,teacher)
 for(const args of [['reset_test',practice],['reset_test',exam,id(25000),unit2],['unlock',exam],['other',null]])assert.equal((await manage(db,...args)).error,'invalid_input')
 assert.equal((await detail(db,'path')).data.interventions.length,0)
})
scenario('two recent failed exams trigger attention; passing later clears it and attempts show every answer',async db=>{
 await complete(db,practice);await complete(db,review);await attempt(db,1);await attempt(db,1);await as(db,teacher)
 let row=(await list(db)).students.find(s=>s.id===student);assert.ok(row.attentionReasons.includes('failed_test_twice'));assert.ok(row.pathPosition);assert.ok(row.lastActiveAt)
 assert.equal((await detail(db,'path')).data.attempts.length,2);await attempt(db);await as(db,teacher);row=(await list(db)).students.find(s=>s.id===student);assert.ok(!row.attentionReasons.includes('failed_test_twice'));assert.equal(row.lastTest.percentage,100);assert.equal(row.completedPathsByLevel[0].completed,1)
})
scenario('pronunciation shows only learner conversations and unanswered recordings until staff replies',async db=>{
 await db.exec('RESET ROLE');await db.query("INSERT INTO submissions(id,auth_user_id,type,content_url) VALUES($1,$2,'audio','storage://pronunciation_audio/test.webm')",[id(27000),student]);await as(db,teacher)
 let conversations=(await detail(db,'pronunciation')).data.conversations;assert.equal(conversations.length,1);assert.equal(conversations[0].unansweredCount,1)
 await db.exec('RESET ROLE');await db.query("INSERT INTO pronunciation_messages(submission_id,sender_id,sender_role,text_content) VALUES($1,$2,'teacher','Weiter so!')",[id(27000),teacher]);await as(db,teacher)
 conversations=(await detail(db,'pronunciation')).data.conversations;assert.equal(conversations[0].unansweredCount,0);assert.equal((await detail(db,'pronunciation',outsider)).data.conversations.length,0)
})
scenario('migration is idempotent and rollback/reapply keeps archived answer history',async db=>{
 await complete(db,practice);await complete(db,review);await attempt(db);await as(db,teacher);await manage(db,'reset_test',exam)
 await db.exec('RESET ROLE');await apply(db,['39_teacher_dashboard.sql']);await db.exec(await readFile(new URL('../vps/rollback/39_teacher_dashboard.sql',import.meta.url),'utf8'))
 assert.equal((await db.query("SELECT to_regprocedure('get_teacher_dashboard_students()') exists")).rows[0].exists,null)
 assert.equal((await db.query('SELECT count(*)::int n FROM path_test_answers')).rows[0].n,1)
 await apply(db,['39_teacher_dashboard.sql']);await as(db,teacher);const data=(await detail(db,'path')).data;assert.equal(data.attempts.length,1);assert.equal(data.attempts[0].isActive,false);assert.equal(data.paths[0].completed,false)
})

scenario('half-known vocabulary follows differing directions in every box, not only box 7',async db=>{
 await db.exec('RESET ROLE');await db.query("UPDATE vocabulary_direction_progress SET box_number=3 WHERE card_id=$1 AND direction='de_to_native'",[card]);await as(db,teacher)
 assert.equal((await detail(db,'vocabulary')).data.halfKnown.length,1)
 await db.exec('RESET ROLE');await db.query('UPDATE vocabulary_direction_progress SET box_number=2 WHERE card_id=$1',[card]);await as(db,teacher)
 assert.equal((await detail(db,'vocabulary')).data.halfKnown.length,0)
})
scenario('150 due cards is allowed and 151 triggers attention, pauses remove them',async db=>{
 await db.exec('RESET ROLE');await db.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de) SELECT md5('due-'||n)::uuid,$1,'Prüfwort '||n FROM generate_series(1,150) n",[vocabularyUnit])
 await db.query("INSERT INTO vocabulary_direction_progress(auth_user_id,card_id,direction,next_review_date) SELECT $1,c.id,d.direction::vocabulary_direction,now()-interval '1 day' FROM learning_vocabulary_cards c CROSS JOIN (VALUES('de_to_native'),('native_to_de')) d(direction) WHERE c.word_de LIKE 'Prüfwort%'",[student]);await as(db,teacher)
 let row=(await list(db)).students.find(s=>s.id===student);assert.equal(row.dueCards,151);assert.ok(row.attentionReasons.includes('over_150_due_cards'))
 await db.exec('RESET ROLE');await db.query("UPDATE vocabulary_direction_progress SET next_review_date=now()+interval '1 day' WHERE auth_user_id=$1 AND card_id=md5('due-150')::uuid",[student]);await as(db,teacher)
 row=(await list(db)).students.find(s=>s.id===student);assert.equal(row.dueCards,150);assert.ok(!row.attentionReasons.includes('over_150_due_cards'))
})
scenario('unlock rejects missing level/trainer/unit permission, and emergency reset respects global reset lock',async db=>{
 await db.exec('RESET ROLE');await db.query("INSERT INTO learning_trainer_grants(auth_user_id,level,trainer,enabled) VALUES($1,'A1.1','exercises',false)",[student]);await as(db,teacher)
 assert.equal((await manage(db,'unlock')).error,'path_locked')
 await db.exec('RESET ROLE');await db.query("UPDATE learning_trainer_grants SET enabled=true,unit_mode='selected' WHERE auth_user_id=$1",[student]);await as(db,teacher)
 assert.equal((await manage(db,'unlock')).error,'path_locked')
 await db.exec('RESET ROLE');await db.query("UPDATE learning_trainer_grants SET unit_mode='all' WHERE auth_user_id=$1",[student]);await db.query('INSERT INTO learning_reset_private.jobs(auth_user_id) VALUES($1)',[student]);await as(db,teacher)
 assert.equal((await manage(db,'reset_path')).error,'learning_reset_in_progress');assert.equal((await detail(db,'path')).data.interventions.length,0)
})
scenario('rollback-period learning remains current on reapply and archived passes never resurrect',async db=>{
 await complete(db,practice);await complete(db,review);await attempt(db);await as(db,teacher);await manage(db,'reset_path');await db.exec('RESET ROLE')
 await db.exec(await readFile(new URL('../vps/rollback/39_teacher_dashboard.sql',import.meta.url),'utf8'))
 await as(db,student);const map=await call(db,"get_learning_path('A1.1')");assert.equal(map.paths[0].completed,false);assert.equal(map.paths[1].available,false)
 const start=await call(db,'start_path_node($1)',[practice]);assert.ok(start.run_id);assert.equal((await call(db,"submit_path_answer($1,$2,'{\"index\":0}'::jsonb,$3)",[start.run_id,start.queue[0],id(25999)])).completed,true)
 await db.exec('RESET ROLE');await apply(db,['39_teacher_dashboard.sql']);await as(db,teacher)
 const data=(await detail(db,'path')).data;assert.equal(data.paths[0].nodes[0].stars,3);assert.equal(data.paths[0].nodes[0].status,'completed');assert.equal(data.paths[0].completed,false)
})
