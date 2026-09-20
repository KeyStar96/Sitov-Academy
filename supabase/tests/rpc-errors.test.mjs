import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPhase2Database, phase2Actor, phase2Id as id, readPhase2Sql } from './helpers/phase2-db.mjs'

const migrations=['02_identity_alignment.sql','03_registration_identity.sql','01_critical_fixes.sql','04_normalization.sql','05_rpc_errors.sql']
const apply=async(db,names=migrations)=>db.exec('BEGIN;'+(await Promise.all(names.map(readPhase2Sql))).join('\n')+'COMMIT;')
const scalar=async(db,sql,params=[]) => (await db.query(sql,params)).rows[0].result
const student=id(1),teacher=id(2),card=id(10),exercise=id(11),reading=id(12),course=id(20)

await test('R10 public JSONB errors preserve success, authorization, and atomicity',async t=>{
 const db=await createPhase2Database()
 try {
  await db.exec(`INSERT INTO locales VALUES('de'),('en'),('ru'),('uk'),('tr'); INSERT INTO cefr_levels VALUES('A1');
   INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('A1.1','A1',1);
   INSERT INTO learning_trainers VALUES('vocabulary'),('exercises'),('pronunciation'),('videos');`)
  for(const [actor,role] of [[student,'student'],[teacher,'teacher']]) {
   await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[actor,`${actor}@example.test`])
   await db.query("INSERT INTO profiles(id,role,native_language,ui_language) VALUES($1,$2,'ru','ru')",[actor,role])
   await db.query('INSERT INTO people(auth_user_id,display_name,email) VALUES($1,$2,$3)',[actor,role,`${actor}@example.test`])
  }
  for(const [unit,trainer] of [[card,'vocabulary'],[exercise,'exercises'],[reading,'pronunciation']])
   await db.query("INSERT INTO learning_units(id,level,trainer,label) VALUES($1,'A1.1',$2,'Lesson')",[unit,trainer])
  await db.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de) VALUES($1,$1,'Haus')",[card])
  await db.query("INSERT INTO vocabulary_translations(card_id,locale,translation) VALUES($1,'ru','дом')",[card])
  await db.query("INSERT INTO learning_exercises(id,unit_id,topic,type,content) VALUES($1,$1,'Article','fill_in_blank','{\"correct_answer\":\"ein\"}')",[exercise])
  await db.query("INSERT INTO learning_reading_texts(id,unit_id,sentence_de) VALUES($1,$1,'Guten Tag.')",[reading])
  await db.query("INSERT INTO student_level_access VALUES($1,'A1.1')",[student])
  await db.query("INSERT INTO courses(id,slug,title,type,category,level,unit_price,trial_lessons) VALUES($1,'course','Course','online','private','A1.1',25,false)",[course])
  await apply(db,migrations.slice(0,4))
  const catalog=async()=> (await db.query(`SELECT p.proname,pg_get_function_identity_arguments(p.oid) args,p.prosecdef,p.proconfig,p.provolatile,pg_get_userbyid(p.proowner) owner,
   coalesce(p.proacl,acldefault('f',p.proowner))::text acl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' ORDER BY p.proname`)).rows
  const before=await catalog()
  // RETURNS TABLE's output names deliberately disappear from pg_proc after JSON conversion.
  const beforeAcl=before.map(({args,...row})=>row)
  await apply(db,['05_rpc_errors.sql'])
  await t.test('all 36 public RPCs return JSONB, retain owners/ACLs/security and preserve named input arguments',async()=>{
   const functions=(await db.query("SELECT p.proname,p.prorettype::regtype::text type,p.proretset,p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'")).rows
   assert.equal(functions.length,36)
   for(const fn of functions) { assert.equal(fn.type,'jsonb',fn.proname);assert.equal(fn.proretset,false);assert.match(fn.prosrc,/phase2-rpc-error-boundary-v1/,fn.proname) }
   assert.deepEqual((await catalog()).map(({args,...row})=>row),beforeAcl)
   assert.equal((await db.query("SELECT proargnames FROM pg_proc WHERE oid='public.set_student_level_access(uuid,text[])'::regprocedure")).rows[0].proargnames[0],'p_user_id')
   await phase2Actor(db,null,'anon')
   await assert.rejects(db.query("SELECT queue_transactional_email('x','raw','a@example.test','de','{}')"),e=>e.code==='42501')
   await db.exec('RESET ROLE')
  })
  await t.test('complete 02→03→01→04→05 replay preserves function definitions and application rows',async()=>{
   const rows=(await db.query('SELECT id,auth_user_id,email FROM people ORDER BY id')).rows
   await apply(db)
   await apply(db,['05_rpc_errors.sql'])
   assert.deepEqual((await catalog()).map(({args,...row})=>row),beforeAcl)
   assert.deepEqual((await db.query('SELECT id,auth_user_id,email FROM people ORDER BY id')).rows,rows)
   assert.equal((await db.query("SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND p.prorettype<>'jsonb'::regtype")).rows[0].n,0)
   const bucketCheck=(await db.query("SELECT pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid='learning_reset_private.audio_objects'::regclass AND conname='audio_objects_bucket_id_check' AND contype='c' AND convalidated")).rows
   assert.deepEqual(bucketCheck,[{definition:"CHECK ((bucket_id = 'pronunciation_audio'::text))"}])
  })
  await t.test('void/UUID/boolean/table calls retain their wire shapes and explicit authorization errors',async()=>{
   await phase2Actor(db,student)
   const denied=await scalar(db,"SELECT set_student_level_access(p_user_id=>$1,p_levels=>ARRAY['A1.1']) result",[student])
   assert.equal(denied.error,'not_authorized');assert.equal(denied.sqlstate,'42501');assert.ok(denied.message)
   await phase2Actor(db,teacher)
   assert.equal(await scalar(db,"SELECT set_student_level_access($1,ARRAY['A1.1']) result",[student]),null)
   await phase2Actor(db,student)
   assert.equal((await scalar(db,"SELECT begin_learning_reset('wrong') result")).error,'confirmation_required')
   const token=await scalar(db,"SELECT begin_learning_reset('RESET_LEARNING_DATA') result")
   assert.match(token,/^[a-f0-9-]{36}$/)
   assert.deepEqual(await scalar(db,'SELECT learning_reset_audio_batch($1) result',[token]),[])
   assert.equal(await scalar(db,'SELECT finish_learning_reset($1) result',[token]),true)
   assert.deepEqual(await scalar(db,'SELECT learning_reset_audio_batch($1) result',[token]),[])
   await phase2Actor(db,teacher)
   assert.equal((await scalar(db,'SELECT learning_reset_audio_batch($1) result',[token])).error,'reset_owner_required')
  })
  await t.test('failed vocabulary review leaves neither progress changes nor idempotency receipt',async()=>{
   await phase2Actor(db,student)
   assert.deepEqual(await scalar(db,'SELECT initialize_vocabulary_cards($1) result',[JSON.stringify([{cardId:card,alreadyKnown:false,direction:'de_to_native'}])]),{addedKnown:0,addedNew:1})
   const progress=(await db.query('SELECT id,box_number,next_review_date FROM vocabulary_direction_progress WHERE card_id=$1',[card])).rows[0]
   const bad=await scalar(db,"SELECT submit_vocabulary_answer_once($1,$2,NULL,NULL,'ru') result",[id(40),progress.id])
   assert.equal(bad.error,'answer_required');assert.equal(bad.sqlstate,'22023')
   await db.exec('RESET ROLE')
   assert.equal((await db.query('SELECT count(*)::int n FROM vocabulary_private.answer_receipts')).rows[0].n,0)
   assert.deepEqual((await db.query('SELECT id,box_number,next_review_date FROM vocabulary_direction_progress WHERE id=$1',[progress.id])).rows[0],progress)
   await phase2Actor(db,student)
   const result=await scalar(db,"SELECT submit_vocabulary_answer_once($1,$2,true,NULL,'ru') result",[id(40),progress.id])
   assert.equal(result.success,true)
   assert.deepEqual(await scalar(db,"SELECT submit_vocabulary_answer_once($1,$2,true,NULL,'ru') result",[id(40),progress.id]),result)
   await db.exec('RESET ROLE')
   await db.query("UPDATE vocabulary_direction_progress SET next_review_date=now()-interval '1 minute' WHERE id=$1",[progress.id])
   await phase2Actor(db,student)
   assert.equal((await scalar(db,"SELECT submit_vocabulary_answer_once($1,$2,true,NULL,'ru') result",[id(41),progress.id])).error,'vocabulary_spacing_required')
   await db.exec('RESET ROLE')
   assert.equal((await db.query('SELECT count(*)::int n FROM vocabulary_private.answer_receipts')).rows[0].n,1)
   // A receipt failure occurs after grading has written the box and cursor.
   // The public boundary must roll both writes back, not persist an error receipt.
   await db.exec(`CREATE FUNCTION vocabulary_private.test_reject_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION USING ERRCODE='P9998',MESSAGE='test_receipt_failure'; END $$;
    CREATE TRIGGER test_reject_receipt BEFORE INSERT ON vocabulary_private.answer_receipts FOR EACH ROW EXECUTE FUNCTION vocabulary_private.test_reject_receipt();`)
   await db.query('DELETE FROM vocabulary_learning_state WHERE auth_user_id=$1',[student])
   const beforeFailure=(await db.query('SELECT * FROM vocabulary_direction_progress WHERE id=$1',[progress.id])).rows[0]
   await phase2Actor(db,student)
   const receiptFailure=await scalar(db,"SELECT submit_vocabulary_answer_once($1,$2,true,NULL,'ru') result",[id(42),progress.id])
   assert.equal(receiptFailure.sqlstate,'P9998');assert.equal(receiptFailure.error,'request_failed')
   await db.exec('RESET ROLE')
   assert.deepEqual((await db.query('SELECT * FROM vocabulary_direction_progress WHERE id=$1',[progress.id])).rows[0],beforeFailure)
   assert.equal((await db.query('SELECT count(*)::int n FROM vocabulary_learning_state')).rows[0].n,0)
   assert.equal((await db.query('SELECT count(*)::int n FROM vocabulary_private.answer_receipts')).rows[0].n,1)
  })
  await t.test('rate limits remain fail closed and Blackboard arrays preserve conflict semantics',async()=>{
   await phase2Actor(db,null,'service_role')
   const key='a'.repeat(64)
   assert.equal((await scalar(db,'SELECT consume_rate_limit($1,1,60) result',[key]))[0].success,true)
   assert.equal((await scalar(db,'SELECT consume_rate_limit($1,1,60) result',[key]))[0].success,false)
   const invalid=await scalar(db,"SELECT consume_rate_limit('bad',1,60) result")
   assert.equal(invalid.error,'request_failed');assert.ok(invalid.message)
   await phase2Actor(db,teacher)
   assert.deepEqual(await scalar(db,"SELECT save_student_blackboard($1,'') result",[student]),[])
   const board=await scalar(db,"SELECT save_student_blackboard($1,'Hello') result",[student])
   assert.equal(board[0].note_text,'Hello')
   const conflict=await scalar(db,"SELECT save_student_blackboard($1,'Changed',$2) result",[student,id(999)])
   assert.equal(conflict.error,'conflict')
   assert.equal((await scalar(db,"SELECT save_student_blackboard($1,'Updated',$2) result",[student,board[0].id]))[0].note_text,'Updated')
  })
  await t.test('mail leases and scalar acknowledgments survive conversion; invalid queue data is JSONB',async()=>{
   await phase2Actor(db,null,'service_role')
   const mail=await scalar(db,"SELECT queue_transactional_email('test','raw','test@example.test','de','{}') result")
   assert.match(mail,/^[a-f0-9-]{36}$/)
   const jobs=await scalar(db,'SELECT claim_mail_jobs($1,1) result',[id(90)])
   assert.equal(jobs.length,1);assert.equal(jobs[0].id,mail)
   assert.equal(await scalar(db,'SELECT complete_mail_job($1,$2,\'<test@example.test>\') result',[mail,jobs[0].lease_token]),true)
   assert.equal(await scalar(db,'SELECT fail_mail_job($1,$2,\'timeout\') result',[mail,jobs[0].lease_token]),false)
   assert.equal((await scalar(db,"SELECT queue_transactional_email('invalid','raw','bad-address','de','{}') result")).error,'invalid_input')
  })
  await t.test('mail failure rolls back cancellation and registration instead of ignoring nested JSONB errors',async()=>{
   await db.exec('RESET ROLE')
   await db.exec(`CREATE FUNCTION private.test_reject_mail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION USING ERRCODE='P9999',MESSAGE='test_mail_failure'; END $$;
    CREATE TRIGGER test_reject_mail BEFORE INSERT ON private.mail_outbox FOR EACH ROW EXECUTE FUNCTION private.test_reject_mail();`)
   const counts=async()=> (await db.query('SELECT (SELECT count(*)::int FROM people) people,(SELECT count(*)::int FROM bookings) bookings,(SELECT count(*)::int FROM cancellation_requests) cancellations')).rows[0]
   const before=await counts()
   await phase2Actor(db,null,'service_role')
   const failed=await scalar(db,"SELECT submit_business_cancellation('Test Learner','test@example.test',$1,'asap',NULL,'de') result",[course])
   assert.equal(failed.error,'P9999');assert.ok(failed.message)
   const start=(await db.query("SELECT ((now() AT TIME ZONE 'Europe/Berlin')::date+1)::text date")).rows[0].date
   const booking=await scalar(db,'SELECT submit_business_registration($1,$2,$3,$4) result',[JSON.stringify({name:'New Person',email:'new@example.test'}),JSON.stringify([{course_id:course,requested_units:1}]),start,JSON.stringify({privacy:true,agb:true})])
   assert.equal(booking.error,'request_failed');assert.equal(booking.sqlstate,'P9999')
   await db.exec('RESET ROLE')
   assert.deepEqual(await counts(),before)
  })
 } finally { await db.close() }
})
