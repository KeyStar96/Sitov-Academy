import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createPhase2Database,phase2Actor,phase2Id as id,readPhase2Sql} from './helpers/phase2-db.mjs'

const student=id(1),teacher=id(2),outsider=id(3),exercise=id(10),card=id(11),reading=id(12),wideCourse=id(20),exactCourse=id(21)
const migrate=async(db,name)=>db.exec('BEGIN;'+await readPhase2Sql(name)+'COMMIT;')

await test('Phase 2 normalization preserves records and executes typed application workflows',async t=>{
 const db=await createPhase2Database()
 try {
  await db.exec(`INSERT INTO locales VALUES('de'),('en'),('ru'),('uk'),('tr');
   INSERT INTO cefr_levels VALUES('A1'),('A2');
   INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('A1.1','A1',1),('A2.1','A2',2);
   INSERT INTO learning_trainers VALUES('vocabulary'),('exercises'),('pronunciation'),('videos');`)
  for(const [user,role] of [[student,'student'],[teacher,'teacher'],[outsider,'student']]) {
   await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[user,`${user}@example.test`])
   await db.query("INSERT INTO profiles(id,role,native_language,ui_language,updated_at) VALUES($1,$2,'ru','ru','2000-01-01')",[user,role])
   await db.query('INSERT INTO people(auth_user_id,display_name,email) VALUES($1,$2,$3)',[user,role,`${user}@example.test`])
  }
  for(const [unit,trainer] of [[exercise,'exercises'],[card,'vocabulary'],[reading,'pronunciation']])
   await db.query("INSERT INTO learning_units(id,level,trainer,label) VALUES($1,'A1.1',$2,'Original lesson')",[unit,trainer])
  await db.query("INSERT INTO learning_exercises(id,unit_id,topic,type,content) VALUES($1,$1,'Article','fill_in_blank',$2)",[exercise,JSON.stringify({correct_answer:'Der',alternative_answers:['Dieser']})])
  await db.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,article) VALUES($1,$1,'Tisch','der')",[card])
  await db.query("INSERT INTO learning_reading_texts(id,unit_id,sentence_de) VALUES($1,$1,'Guten Tag.')",[reading])
  await db.query("INSERT INTO student_level_access VALUES($1,'A1.1')",[student])
  await db.query("INSERT INTO submissions(id,user_id,type,prompt_id,prompt_title) VALUES($1,$2,'audio',$3,'Old copied title')",[id(30),student,reading])
  await db.query("INSERT INTO courses(id,slug,title,type,category,level,unit_price,trial_lessons) VALUES($1,'wide','All levels','online','private','A0-A1',25,false),($2,'exact','A1 course','presence','german','A1.1',15,true)",[wideCourse,exactCourse])
  await db.query("INSERT INTO cancellation_requests(id,full_name,email,course_name,termination_type) VALUES($1,'Old learner','old@example.test','All levels','asap')",[id(40)])
  await migrate(db,'02_identity_alignment.sql')
  await migrate(db,'01_critical_fixes.sql')
  await migrate(db,'04_normalization.sql')

  await t.test('preserves marketing ranges and maps existing cancellations without inventing learning levels',async()=>{
   assert.deepEqual((await db.query('SELECT level,audience_code FROM courses WHERE id=$1',[wideCourse])).rows[0],{level:null,audience_code:'A0-A1'})
   assert.deepEqual((await db.query('SELECT level,audience_code FROM courses WHERE id=$1',[exactCourse])).rows[0],{level:'A1.1',audience_code:'A1.1'})
   assert.equal((await db.query('SELECT course_id FROM cancellation_requests WHERE id=$1',[id(40)])).rows[0].course_id,wideCourse)
   assert.deepEqual((await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND ((table_name='submissions' AND column_name='prompt_title') OR (table_name='cancellation_requests' AND column_name='course_name'))")).rows,[])
   await assert.rejects(db.query("UPDATE courses SET level='A0-A1' WHERE id=$1",[wideCourse]),e=>e.code==='23503')
   await assert.rejects(db.query("UPDATE courses SET category='invalid' WHERE id=$1",[wideCourse]),e=>e.code==='22P02')
  })
  await t.test('reapplying normalization is idempotent, including enum domains, indexes, FKs and source patches',async()=>{
   const snapshot=(await db.query('SELECT id,level,audience_code FROM courses ORDER BY id')).rows
   await migrate(db,'04_normalization.sql')
   assert.deepEqual((await db.query('SELECT id,level,audience_code FROM courses ORDER BY id')).rows,snapshot)
   assert.equal((await db.query("SELECT count(*)::int n FROM pg_enum e JOIN pg_type ty ON ty.oid=e.enumtypid JOIN pg_namespace n ON n.oid=ty.typnamespace WHERE n.nspname='public' AND ty.typname='trainer_code'")).rows[0].n,4)
  })
  await t.test('every application updated_at column has the generic trigger, including media',async()=>{
   const missing=(await db.query(`SELECT c.table_name FROM information_schema.columns c WHERE c.table_schema='public' AND c.column_name='updated_at'
    AND NOT EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid=(quote_ident(c.table_schema)||'.'||quote_ident(c.table_name))::regclass AND t.tgname='set_updated_at' AND NOT t.tgisinternal)`)).rows
   assert.deepEqual(missing,[])
   await db.query('UPDATE profiles SET updated_at=\'2000-01-01\' WHERE id=$1',[student])
   assert.ok(new Date((await db.query('SELECT updated_at FROM profiles WHERE id=$1',[student])).rows[0].updated_at).getUTCFullYear()>2000)
  })
  await t.test('typed trainer grants preserve RLS and learner grading accepts canonical alternatives',async()=>{
   await phase2Actor(db,teacher)
   await db.query("SELECT set_student_trainer_access($1,'A1.1','vocabulary',true,$2::uuid[],true)",[student,[card]])
   await phase2Actor(db,student)
   assert.equal((await db.query('SELECT count(*)::int n FROM learning_unit_grants')).rows[0].n,1)
   await db.query('SELECT initialize_vocabulary_cards($1)',[JSON.stringify([{cardId:card,alreadyKnown:false,direction:'de_to_native'}])])
   assert.equal((await db.query('SELECT direction FROM vocabulary_direction_progress')).rows[0].direction,'de_to_native')
   assert.equal((await db.query("SELECT record_grammar_attempt($1,'Dieser',false) result",[exercise])).rows[0].result.isCorrect,true)
   assert.equal((await db.query('SELECT completed FROM user_exercise_progress')).rows[0].completed,true)
   await phase2Actor(db,outsider)
   assert.equal((await db.query('SELECT * FROM learning_unit_grants')).rows.length,0)
   assert.equal((await db.query('SELECT * FROM learning_exercises')).rows.length,0)
  })
  await t.test('JSONB contract rejects missing, empty and ill-typed accepted answers',async()=>{
   await db.exec('RESET ROLE')
   for(const content of [{correct_answer:'Der'},{correct_answer:'Der',accepted_answers:[]},{correct_answer:'Der',accepted_answers:[3]},{correct_answer:'Der',accepted_answers:['Der',' DER ']},{correct_answer:'Der',accepted_answers:['Dieser']}])
    await assert.rejects(db.query('UPDATE learning_exercises SET content=$1 WHERE id=$2',[JSON.stringify(content),exercise]),e=>e.code==='23514')
   assert.deepEqual((await db.query('SELECT content FROM learning_exercises WHERE id=$1',[exercise])).rows[0].content.accepted_answers,['Der','Dieser'])
   await db.query('UPDATE learning_exercises SET content=$1 WHERE id=$2',[JSON.stringify({correct_answer:'Der',accepted_answers:['der','Dieser']}),exercise])
  })
  await t.test('course and learning CMS can write typed domains without implicit casts',async()=>{
   await phase2Actor(db,teacher)
   const payload={id:wideCourse,slug:'wide',title:'All levels',description:'',type:'online',category:'private',level:'A0-A1',unit_price:25,unit_minutes:45,start_date:'',end_date:'',trial_lessons:false,sort_order:1,archived:false,schedules:[],translations:[],exceptions:[]}
   assert.equal((await db.query('SELECT save_business_course($1) id',[JSON.stringify(payload)])).rows[0].id,wideCourse)
   const fields={word_de:'Haus',article:'das',plural:'Häuser'}
   const saved=(await db.query("SELECT save_learning_content('vocabulary',$1) result",[JSON.stringify({unit:{level:'A1.1',label:'New lesson'},fields,translations:[]})])).rows[0].result
   assert.ok(saved.id)
   assert.equal((await db.query('SELECT article FROM learning_vocabulary_cards WHERE id=$1',[saved.id])).rows[0].article,'das')
  })
  await t.test('new cancellation RPC rejects unknown courses atomically and queues a localized notice',async()=>{
   await phase2Actor(db,null,'service_role')
   const failed=(await db.query("SELECT submit_business_cancellation('Test Learner','test@example.test',$1,'asap',NULL,'uk') result",[id(999)])).rows[0].result
   assert.equal(failed.error,'course_not_found');assert.equal(typeof failed.message,'string')
   const result=(await db.query("SELECT submit_business_cancellation('Test Learner','test@example.test',$1,'asap',NULL,'uk') result",[wideCourse])).rows[0].result
   assert.ok(result.id)
   const job=(await db.query('SELECT kind,locale,payload FROM private.mail_outbox WHERE dedupe_key=$1',[`cancellation:${result.id}`])).rows[0]
   assert.equal(job.kind,'cancellation_requested');assert.equal(job.locale,'uk');assert.equal(job.payload.message,'All levels')
   await phase2Actor(db,student)
   await assert.rejects(db.query("SELECT submit_business_cancellation('Test Learner','test@example.test',$1)",[wideCourse]),e=>e.code==='42501')
  })
  await t.test('pronunciation writes derive titles from units and still update enum conversation status',async()=>{
   await phase2Actor(db,null,'service_role')
   const name=`${student}/${id(88)}.webm`
   await db.query("INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('pronunciation_audio',$1,$2)",[name,student])
   await phase2Actor(db,student)
   const submission=(await db.query('SELECT create_pronunciation_submission($1,$2) id',[reading,`storage://pronunciation_audio/${name}`])).rows[0].id
   assert.ok(submission)
   await phase2Actor(db,teacher)
   await db.query("INSERT INTO pronunciation_messages(submission_id,sender_id,text_content) VALUES($1,$2,'Gut gelesen')",[submission,teacher])
   assert.equal((await db.query('SELECT status FROM submissions WHERE id=$1',[submission])).rows[0].status,'reviewed')
  })
  await t.test('registration, invoice transitions, monthly pauses and mail retries use enum-safe expressions',async()=>{
   await phase2Actor(db,null,'service_role')
   const nextMonth=(await db.query("SELECT (date_trunc('month',now() AT TIME ZONE 'Europe/Berlin')+interval '1 month')::date::text value")).rows[0].value
   const booking=(await db.query('SELECT submit_business_registration($1,$2,$3,$4) id',[
    JSON.stringify({name:'New learner',email:'new@example.test'}),JSON.stringify([{course_id:wideCourse,requested_units:2}]),nextMonth,JSON.stringify({privacy:true,agb:true})])).rows[0].id
   await phase2Actor(db,teacher)
   await db.query('SELECT confirm_business_booking($1)',[booking])
   await db.query("SELECT mark_business_invoice($1,$2,true,'INV-1')",[booking,nextMonth])
   assert.equal((await db.query('SELECT status FROM invoice_cases WHERE booking_id=$1',[booking])).rows[0].status,'created')
   await db.query("SELECT mark_business_invoice($1,$2,false,'')",[booking,nextMonth])
   assert.equal((await db.query('SELECT status FROM invoice_cases WHERE booking_id=$1',[booking])).rows[0].status,'outstanding')
   await phase2Actor(db,student)
   const monthly=(await db.query("SELECT save_business_month($1,'[]',true) id",[nextMonth])).rows[0].id
   assert.equal((await db.query('SELECT status FROM bookings WHERE id=$1',[monthly])).rows[0].status,'cancelled')
   await db.query('SELECT save_business_month($1,$2,false,$3,1)',[nextMonth,JSON.stringify([{course_id:wideCourse,requested_units:1}]),monthly])
   assert.equal((await db.query('SELECT status FROM bookings WHERE id=$1',[monthly])).rows[0].status,'pending')
   await phase2Actor(db,null,'service_role')
   const jobs=(await db.query('SELECT * FROM claim_mail_jobs($1,20)',[id(89)])).rows
   assert.ok(jobs.length>0)
   assert.equal((await db.query("SELECT fail_mail_job($1,$2,'temporary',false) value",[jobs[0].id,jobs[0].lease_token])).rows[0].value,true)
   assert.equal((await db.query('SELECT status FROM private.mail_outbox WHERE id=$1',[jobs[0].id])).rows[0].status,'pending')
  })
 } finally {await db.close()}
})
