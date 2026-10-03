import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createCurrentDatabase, currentFeatureMigrations, apply, actor, id, student, teacher, outsider, vocabularyUnit, exerciseUnit, result } from './helpers/current-db.mjs'

const sql = name => readFile(new URL(`../vps/${name}`, import.meta.url), 'utf8')
const as = async (db, user, role = 'authenticated') => { await db.exec('RESET ROLE'); await actor(db, user, role) }
const owner = async db => { await db.exec('RESET ROLE'); await db.query("SELECT set_config('request.jwt.claim.sub','',false)") }
const readiness = (db, user) => result(db, 'SELECT sitov_get_pronunciation_readiness($1,$2) result', ['A1.1', user ?? null])
const mode = (db, value, user = student) => result(db, 'SELECT sitov_set_pronunciation_access($1,$2,$3) result', [user, 'A1.1', value])
const short = id(76000), medium = id(76001), long = id(76002), unknown = id(76003)
const pathUnit = id(75500)

await test('Sitov pronunciation evidence, gradual unlocks and database boundaries', async t => {
 const db = await createCurrentDatabase({latest:[...currentFeatureMigrations,'59_daily_quests.sql','60_daily_quest_resume.sql','61_account_learning_checkpoints.sql']})
 try {
  await apply(db, ['62_verb_trainer_enums.sql'])
  await db.exec((await sql('63_verb_trainer.sql')).split('-- BEGIN SITOV VERB CATALOG SEED')[0])
  await db.query("INSERT INTO student_level_access(auth_user_id,level) VALUES($1,'A1.1')", [outsider])
  for (const [index,prompt,text] of [[0,short,'Der Mann geht in den Park. Der Hund spielt.'],[1,medium,Array(52).fill('Park').join(' ') + '.'],[2,long,Array(92).fill('Park').join(' ') + '.'],[3,unknown,'Unbekanntes Geheimnis überrascht fremde Besucher.']]) {
   await db.query("INSERT INTO learning_units(id,level,trainer,label,sort_order) VALUES($1,'A1.1','pronunciation',$2,$3)", [id(75000+index),`Lesetext ${index}`,index])
   await db.query('INSERT INTO learning_reading_texts(id,unit_id,sentence_de) VALUES($1,$2,$3)', [prompt,id(75000+index),text])
  }
  for (let i=0;i<15;i++) {
   await db.query("INSERT INTO learning_units(id,level,trainer,label,sort_order) VALUES($1,'A1.1','verbs',$2,$3)", [id(77000+i),`Verb ${i}`,i])
   await db.query("INSERT INTO sitov_verb_catalog VALUES($1,$2,'A1.1')", [`sitov-verb-fixture-${i}`,id(77000+i)])
  }
  await db.query("INSERT INTO learning_units(id,level,trainer,label,sort_order,is_path,path_source_id,path_slug,path_title) VALUES($1,'A1.1','exercises','Lernpfad',1,true,'sitov-ready-path','sitov-ready-path','Lernpfad')",[pathUnit])
  await db.query("INSERT INTO path_objectives(unit_id,id,area,description) VALUES($1,'goal','grammar','Grammatik')",[pathUnit])
  for (let i=0;i<10;i++) await db.query("INSERT INTO path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,goals,merkkarte) VALUES($1,$2,$3,'practice',$4,'Grammatik','Grammatik',ARRAY['goal'],'{\"rule\":\"Eine Regel\",\"examples\":[\"Ein Beispiel\"]}')", [id(78000+i),pathUnit,`node-${i}`,i+1])
  await apply(db, ['66_sitov_pronunciation_readiness.sql'])
  const words = ['Mann','gehen','Park','Hund','spielen',...Array.from({length:155},(_,i)=>`Wort${String.fromCharCode(65+Math.floor(i/26))}${String.fromCharCode(65+i%26)}`)]
  async function vocabulary(n, paired=true, graded=true) {
   await owner(db)
   for (let i=0;i<n;i++) {
    await db.query('INSERT INTO learning_vocabulary_cards(id,unit_id,word_de) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [id(80000+i),vocabularyUnit,words[i]])
    for (const direction of paired ? ['de_to_native','native_to_de'] : ['de_to_native']) {
     await db.query("INSERT INTO vocabulary_direction_progress(auth_user_id,card_id,direction,box_number) VALUES($1,$2,$3,3) ON CONFLICT(auth_user_id,card_id,direction) DO UPDATE SET box_number=3", [student,id(80000+i),direction])
     if (graded) await db.query("INSERT INTO vocabulary_private.answer_receipts(auth_user_id,request_id,progress_id,typed_answer,ui_language,response) SELECT $1,$2,p.id,$3,'ru',$4 FROM vocabulary_direction_progress p WHERE p.auth_user_id=$1 AND p.card_id=$5 AND p.direction=$6 ON CONFLICT DO NOTHING",[student,id(82000+i*2+(direction==='de_to_native'?0:1)),words[i],JSON.stringify({isCorrect:true,correctAnswer:words[i]}),id(80000+i),direction])
    }
   }
  }
  async function grammar(n) {
   await owner(db)
   for (let i=0;i<n;i++) await db.query("INSERT INTO path_node_progress(auth_user_id,node_id,status,best_stars,completed_at) VALUES($1,$2,'completed',2,now()) ON CONFLICT(auth_user_id,node_id) DO UPDATE SET status='completed',best_stars=2,is_active=true", [student,id(78000+i)])
  }
  async function verbs(n) {
   await owner(db)
   for (let i=0;i<n;i++) await db.query("INSERT INTO sitov_verb_progress(auth_user_id,verb_id,tense,box,attempts,correct) VALUES($1,$2,'present',3,5,4) ON CONFLICT(auth_user_id,verb_id,tense) DO UPDATE SET box=3,attempts=5,correct=4", [student,`sitov-verb-fixture-${i}`])
  }
  const readable = async () => (await db.query('SELECT id FROM learning_reading_texts ORDER BY id')).rows.map(row=>row.id)

  await t.test('new learner sees transparent locked titles without bodies and cannot upload or submit', async () => {
   await as(db,student)
   const state = await readiness(db)
   assert.equal(state.mode,'logical'); assert.equal(state.tier,0); assert.equal(state.texts.length,4)
   assert.ok(state.texts.every(text=>!text.ready)); assert.ok(!JSON.stringify(state).includes('sentence_de'))
   assert.deepEqual(await readable(),[])
   await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('pronunciation_audio',$1)", [`${student}/${id(79000)}.webm`]),error=>error.code==='42501')
   await owner(db)
   await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('pronunciation_audio',$1)", [`${student}/${id(79000)}.webm`])
   await as(db,student)
   const submission = await result(db,'SELECT create_pronunciation_submission($1,$2) result',[short,`storage://pronunciation_audio/${student}/${id(79000)}.webm`])
   assert.ok(['pronunciation_not_ready','not_authorized'].includes(submission.error))
   assert.equal((await db.query('SELECT * FROM submissions')).rows.length,0)
  })
  await t.test('student cannot forge hard access or inspect other learners; anonymous cannot call API', async () => {
   assert.equal((await mode(db,'hard')).error,'not_authorized')
   await assert.rejects(db.query("INSERT INTO sitov_pronunciation_access(auth_user_id,level,mode) VALUES($1,'A1.1','hard')",[student]),error=>error.code==='42501')
   await assert.rejects(readiness(db,outsider),error=>error.code==='42501')
   await assert.rejects(db.query('SELECT sitov_pronunciation_private.evidence($1)',[student]),error=>error.code==='42501')
   await as(db,null,'anon'); await assert.rejects(readiness(db),error=>error.code==='42501')
   await as(db,teacher); assert.equal((await readiness(db,student)).tier,0)
  })
  await t.test('one-way familiarity and verb-only practice never substitute for vocabulary + grammar', async () => {
   await vocabulary(30,false); await verbs(15); await as(db,student)
   assert.equal((await readiness(db)).tier,0)
   await vocabulary(30); await as(db,student)
   assert.equal((await readiness(db)).stats.knownWords,30); assert.equal((await readiness(db)).tier,0)
   await grammar(2); await as(db,student)
   const state=await readiness(db);assert.equal(state.tier,1)
   assert.ok(state.texts.find(text=>text.id===short).coveragePercent>=60)
   assert.deepEqual(await readable(),[short]);assert.equal(state.texts.find(text=>text.id===unknown).ready,false)
  })
  await t.test('self-declared known cards have no readiness credit until both directions have server-graded recall',async()=>{
   await owner(db)
   await db.query('UPDATE vocabulary_direction_progress SET box_number=6 WHERE auth_user_id=$1',[student])
   await db.query('DELETE FROM vocabulary_private.answer_receipts WHERE auth_user_id=$1',[student])
   await as(db,student);assert.equal((await readiness(db)).stats.knownWords,0);assert.equal((await readiness(db)).tier,0)
   await vocabulary(30,true,true);await as(db,student);assert.equal((await readiness(db)).tier,1)
   await owner(db);await db.query('UPDATE vocabulary_private.answer_receipts SET response=$3 WHERE auth_user_id=$1 AND request_id=$2',[student,id(82000),JSON.stringify({isCorrect:false,correctAnswer:'Mann'})])
   await as(db,student);assert.equal((await readiness(db)).stats.knownWords,29);assert.equal((await readiness(db)).tier,0)
   await owner(db);await db.query('UPDATE vocabulary_private.answer_receipts SET response=$3 WHERE auth_user_id=$1 AND request_id=$2',[student,id(82000),JSON.stringify({isCorrect:true,correctAnswer:'Mann'})])
   await as(db,student)
  })
  await t.test('upload + submit bind to exact ready text; long text cannot reuse a valid upload', async () => {
   await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('pronunciation_audio',$1)", [`${student}/${id(79001)}.webm`])
   assert.ok(['pronunciation_not_ready','not_authorized'].includes((await result(db,'SELECT create_pronunciation_submission($1,$2) result',[long,`storage://pronunciation_audio/${student}/${id(79001)}.webm`])).error))
   const submission = await result(db,'SELECT create_pronunciation_submission($1,$2) result',[short,`storage://pronunciation_audio/${student}/${id(79001)}.webm`])
   assert.equal(typeof submission,'string')
   assert.equal((await db.query('SELECT text_content FROM submissions WHERE id=$1',[submission])).rows[0].text_content,'Der Mann geht in den Park. Der Hund spielt.')
  })
  await t.test('next tiers require their own vocabulary count and active passed grammar tests', async () => {
   await vocabulary(80);await grammar(5)
   await as(db,student);assert.equal((await readiness(db)).tier,1)
   await owner(db)
   await db.query("INSERT INTO path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,test_size,goals) VALUES($1,$2,'test-1','test',11,'Test','Grammatik',1,ARRAY['goal'])",[id(78500),pathUnit])
   await db.query("INSERT INTO path_test_attempts(auth_user_id,node_id,status,selected_exercise_ids,percentage,passed,completed_at) VALUES($1,$2,'completed','{}',90,true,now())",[student,id(78500)])
   await as(db,student);assert.equal((await readiness(db)).tier,2);assert.deepEqual(await readable(),[short,medium])
   await vocabulary(160);await grammar(10)
   await db.query("INSERT INTO learning_units(id,level,trainer,label,sort_order,is_path,path_source_id,path_slug,path_title) VALUES($1,'A1.1','exercises','Weitere Grammatik',2,true,'sitov-ready-second','sitov-ready-second','Weitere Grammatik')",[id(78501)])
   await db.query("INSERT INTO path_objectives(unit_id,id,area,description) VALUES($1,'goal','grammar','Grammatik')",[id(78501)])
   await db.query("INSERT INTO path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,test_size,goals) VALUES($1,$2,'test-2','test',1,'Test','Grammatik',1,ARRAY['goal'])",[id(78502),id(78501)])
   await db.query("INSERT INTO path_test_attempts(auth_user_id,node_id,status,selected_exercise_ids,percentage,passed,completed_at) VALUES($1,$2,'completed','{}',90,true,now())",[student,id(78502)])
   await as(db,student);assert.equal((await readiness(db)).tier,3);assert.deepEqual(await readable(),[short,medium,long])
  })
  await t.test('staff hard unlock ignores milestones/coverage but never text selections or revoked trainer', async () => {
   await as(db,teacher);assert.deepEqual(await mode(db,'hard',outsider),{success:true})
   await as(db,outsider);assert.deepEqual(await readable(),[short,medium,long,unknown])
   await as(db,teacher)
   await db.query("INSERT INTO learning_trainer_grants(auth_user_id,level,trainer,enabled,unit_mode) VALUES($1,'A1.1','pronunciation',true,'selected')",[outsider])
   await db.query("INSERT INTO learning_unit_grants(auth_user_id,level,trainer,unit_id) VALUES($1,'A1.1','pronunciation',$2)",[outsider,id(75000)])
   await as(db,outsider);assert.deepEqual(await readable(),[short])
   await as(db,teacher);await db.query("UPDATE learning_trainer_grants SET enabled=false WHERE auth_user_id=$1",[outsider])
   assert.equal((await mode(db,'hard',outsider)).error,'trainer_access_denied')
   assert.deepEqual(await mode(db,'logical',outsider),{success:true})
   await as(db,outsider);assert.deepEqual(await readable(),[])
  })
  await t.test('logical mode after reset preserves existing conversations but blocks new text submissions', async () => {
   await owner(db);await db.query('UPDATE path_node_progress SET is_active=false WHERE auth_user_id=$1',[student]);await db.query('UPDATE path_test_attempts SET is_active=false WHERE auth_user_id=$1',[student])
   await as(db,student);assert.equal((await readiness(db)).tier,0);assert.deepEqual(await readable(),[])
   assert.equal((await db.query('SELECT * FROM submissions')).rows.length,1)
   assert.equal((await db.query('SELECT * FROM sitov_pronunciation_conversation_titles()')).rows[0].title,'Lesetext 0')
   assert.equal(typeof await result(db,'SELECT create_pronunciation_submission($1,$2) result',[short,`storage://pronunciation_audio/${student}/${id(79001)}.webm`]),'string')
   await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('pronunciation_audio',$1)", [`${student}/${id(79002)}.webm`])
   assert.equal((await result(db,'SELECT create_pronunciation_submission($1,$2) result',[short,`storage://pronunciation_audio/${student}/${id(79002)}.webm`])).error,'not_authorized')
  })
  await t.test('legacy completed grammar across topics is honored and missing active verb content has explicit fallback', async () => {
   await owner(db)
   for(let i=0;i<8;i++) {
    await db.query("INSERT INTO learning_exercises(id,unit_id,topic,type,content) VALUES($1,$2,$3,'multiple_choice',$4)",[id(81000+i),exerciseUnit,`Thema ${i%2}`,JSON.stringify({target_form:['Ja'],question:'Wähle Ja.',options:['Ja','Nein'],correct_answer:'Ja',accepted_answers:['Ja']})])
    await db.query('INSERT INTO user_exercise_progress(auth_user_id,exercise_id,completed,attempts,score) VALUES($1,$2,true,1,1)',[student,id(81000+i)])
   }
   await db.query('UPDATE sitov_verb_progress SET box=1 WHERE auth_user_id=$1',[student]);await as(db,student);assert.equal((await readiness(db)).tier,0)
   await owner(db);await db.query("INSERT INTO learning_trainer_grants(auth_user_id,level,trainer,enabled) VALUES($1,'A1.1','verbs',false)",[student])
   await as(db,student);assert.equal((await readiness(db)).stats.verbEvidenceRequired,false);assert.equal((await readiness(db)).tier,1)
   await owner(db);await db.query("UPDATE learning_trainer_grants SET enabled=true,unit_mode='selected' WHERE auth_user_id=$1 AND trainer='verbs'",[student])
   await as(db,student);assert.equal((await readiness(db)).stats.verbEvidenceRequired,false);assert.equal((await readiness(db)).tier,1)
   await owner(db);await db.query("INSERT INTO learning_unit_grants(auth_user_id,level,trainer,unit_id) VALUES($1,'A1.1','verbs',$2)",[student,id(77000)])
   await db.query("UPDATE sitov_verb_progress SET box=3 WHERE auth_user_id=$1 AND verb_id='sitov-verb-fixture-0'",[student])
   await as(db,student);assert.equal((await readiness(db)).stats.availableVerbForms,1)
   assert.ok((await readiness(db)).requirements.every(requirement=>requirement.confidentVerbForms===1));assert.equal((await readiness(db)).tier,1)
   await owner(db);await db.query("DELETE FROM learning_unit_grants WHERE auth_user_id=$1 AND trainer='verbs'",[student])
   await owner(db);await db.query("DELETE FROM learning_trainer_grants WHERE auth_user_id=$1 AND trainer='verbs'",[student])
   await owner(db);await db.query("UPDATE learning_units SET is_active=false WHERE trainer='verbs'")
   await as(db,student);const state=await readiness(db);assert.equal(state.stats.verbEvidenceRequired,false);assert.equal(state.tier,1)
  })
  await t.test('migration replay preserves settings/history and functions expose no anon or internal evidence privileges', async () => {
   await owner(db);await apply(db,['66_sitov_pronunciation_readiness.sql'])
   assert.equal((await db.query('SELECT count(*)::int n FROM submissions')).rows[0].n,1)
   assert.equal((await db.query('SELECT count(*)::int n FROM sitov_pronunciation_private.access_log')).rows[0].n,2)
   for(const signature of ['sitov_get_pronunciation_readiness(text,uuid)','sitov_set_pronunciation_access(uuid,text,text)']) {
    const row=(await db.query("SELECT prosecdef,has_function_privilege('anon',oid,'EXECUTE') anon FROM pg_proc WHERE oid=$1::regprocedure",[signature])).rows[0]
    assert.equal(row.prosecdef,false);assert.equal(row.anon,false)
   }
   await db.exec(await readFile(new URL('../vps/rollback/66_sitov_pronunciation_readiness.sql',import.meta.url),'utf8'))
   assert.equal((await db.query('SELECT count(*)::int n FROM submissions')).rows[0].n,1)
   await apply(db,['66_sitov_pronunciation_readiness.sql'])
   assert.equal((await db.query('SELECT count(*)::int n FROM sitov_pronunciation_private.access_log')).rows[0].n,2)
  })
  await t.test('the native VPS smoke exercises real authenticated roles and rolls back all synthetic data', async () => {
   const before=(await db.query('SELECT count(*)::int n FROM auth.users')).rows[0].n
   // Match native Auth fields omitted by the frozen application-only fixture.
   await db.exec('ALTER TABLE auth.users ADD COLUMN aud text,ADD COLUMN role text,ADD COLUMN updated_at timestamptz')
   const native=(await readFile(new URL('../../deploy/vps/tests/sitov-pronunciation-readiness.sql',import.meta.url),'utf8')).replace(/^\\set.*$/gm,'')
   await db.exec(native)
   assert.equal((await db.query('SELECT count(*)::int n FROM auth.users')).rows[0].n,before)
   assert.equal((await db.query('SELECT count(*)::int n FROM submissions')).rows[0].n,1)
  })
 } finally { await db.close() }
})
