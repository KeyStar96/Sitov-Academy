import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createPhase3Database,actor,id,student,teacher,outsider,exerciseUnit,result,apply} from './helpers/phase3-db.mjs'

await test('Phase 3.4–3.5 explicit target forms and German learning content',async t=>{
 const db=await createPhase3Database()
 const legacy=id(300),ready=id(301),contaminated=id(302),reading=id(303),badReading=id(304),readingUnit=id(305),badReadingUnit=id(306)
 const base={text_before:'Wir ',text_after:' Deutsch.',correct_answer:'lernen',accepted_answers:['lernen'],target_form:['lernen']}
 const originalLegacy={...base};delete originalLegacy.target_form
 const insertExercise=async(exerciseId,content,topic='Verben')=>db.query("INSERT INTO learning_exercises(id,unit_id,topic,type,content) VALUES($1,$2,$3,'fill_in_blank',$4)",[exerciseId,exerciseUnit,topic,JSON.stringify(content)])
 const save=async(fields,translations=[],targetId=null)=>result(db,"SELECT save_learning_content('exercises',$1,$2) result",[JSON.stringify({unit:{id:exerciseUnit,level:'A1.1',label:'Lektion 1'},fields,translations}),targetId])
 const grade=async(exerciseId,answer='lernen')=>result(db,'SELECT record_grammar_attempt($1,$2,false) result',[exerciseId,answer])
 const catalog=async()=> (await db.query(`SELECT oid::regprocedure::text name,proacl::text acl,prosecdef,proconfig,pg_get_functiondef(oid) definition FROM pg_proc WHERE oid IN(
  'grammar_private.record_attempt(uuid,text,boolean)'::regprocedure,'public.save_learning_content(text,jsonb,uuid)'::regprocedure,
  'public.record_grammar_attempt(uuid,text,boolean)'::regprocedure) ORDER BY name`)).rows
 try{
  await insertExercise(legacy,originalLegacy)
  await insertExercise(ready,base)
  await insertExercise(contaminated,{...base,text_before:'Мы '})
  await db.query("INSERT INTO learning_units(id,level,trainer,label) VALUES($1,'A1.1','pronunciation','Lesen'),($2,'A1.1','pronunciation','Legacy lesen')",[readingUnit,badReadingUnit])
  await db.query('INSERT INTO learning_reading_texts(id,unit_id,sentence_de,focus) VALUES($1,$3,$4,$5),($2,$7,$6,$5)',[reading,badReading,readingUnit,'Guten Tag.','Aussprache','Привет.',badReadingUnit])
  await db.query("INSERT INTO grammar_translations(exercise_id,locale,hint) VALUES($1,'ru','Русская подсказка'),($2,'ru','Русская подсказка')",[legacy,ready])
  const originalRows=(await db.query('SELECT id,content,topic,created_at FROM learning_exercises ORDER BY id')).rows
  const beforeAcl=(await catalog()).map(({definition,...row})=>row)
  await apply(db,['07_content_quality.sql'])

  await t.test('migration preserves legacy payloads and derives incomplete state without guessed backfill',async()=>{
   assert.deepEqual((await db.query('SELECT id,content,topic,created_at FROM learning_exercises ORDER BY id')).rows,originalRows)
   assert.deepEqual((await db.query('SELECT id,content_status FROM learning_exercises ORDER BY id')).rows,[{id:legacy,content_status:'incomplete'},{id:ready,content_status:'ready'},{id:contaminated,content_status:'incomplete'}])
   assert.deepEqual((await catalog()).map(({definition,...row})=>row),beforeAcl)
   await assert.rejects(db.query("UPDATE learning_exercises SET content_status='ready' WHERE id=$1",[legacy]),e=>e.code==='428C9')
  })
  await t.test('student REST/RLS cannot read incomplete tasks or their translations; staff can review all legacy data',async()=>{
   await actor(db,student)
   assert.deepEqual((await db.query('SELECT id FROM learning_exercises ORDER BY id')).rows,[{id:ready}])
   assert.deepEqual((await db.query('SELECT exercise_id FROM grammar_translations ORDER BY exercise_id')).rows,[{exercise_id:ready}])
   assert.deepEqual((await db.query('SELECT id FROM learning_reading_texts ORDER BY id')).rows,[{id:reading}])
   await actor(db,teacher);assert.equal((await db.query('SELECT id FROM learning_exercises')).rows.length,3)
   assert.equal((await db.query('SELECT id FROM learning_reading_texts')).rows.length,2)
   await actor(db,outsider);assert.equal((await db.query('SELECT id FROM learning_exercises')).rows.length,0)
   await db.exec('RESET ROLE')
  })
  await t.test('SECURITY DEFINER grading independently rejects incomplete or contaminated exercise IDs',async()=>{
   await actor(db,student)
   for(const target of [legacy,contaminated]) {const denied=await grade(target);assert.equal(denied.error,'exercise_unavailable');assert.ok(denied.message)}
   assert.equal((await db.query('SELECT * FROM user_exercise_progress')).rows.length,0)
   assert.equal((await grade(ready)).status,'EXACT')
   await actor(db,teacher);assert.equal((await grade(legacy)).error,'exercise_unavailable')
   await db.exec('RESET ROLE')
  })
  await t.test('direct staff inserts and content updates require a nonempty string array target_form',async()=>{
   await actor(db,teacher)
   for(const target of [undefined,null,[],[''],[' \t\n '],['\u00a0'],['\ufeff'],['\u2003'],[null],[1],'lernen',{}]) {
    const content={...base,target_form:target}
    await assert.rejects(insertExercise(id(310),content),e=>e.code==='23514'&&e.message==='target_form_required')
   }
   await assert.rejects(db.query('UPDATE learning_exercises SET content=$1 WHERE id=$2',[JSON.stringify({...originalLegacy,instruction:'Ergänzen Sie.'}),legacy]),e=>e.code==='23514'&&e.message==='target_form_required')
   await db.query('UPDATE learning_exercises SET content=$1 WHERE id=$2',[JSON.stringify({...base,target_form:[' lernen ','sprechen']}),legacy])
   assert.equal((await db.query('SELECT content_status FROM learning_exercises WHERE id=$1',[legacy])).rows[0].content_status,'ready')
   await db.exec('RESET ROLE')
  })
  await t.test('service-role imports can evaluate invoker helpers without weakening content validation',async()=>{
   await actor(db,null,'service_role')
   assert.equal(await result(db,"SELECT has_schema_privilege(current_user,'grammar_private','USAGE') result"),true)
   assert.equal(await result(db,"SELECT has_schema_privilege(current_user,'learning_private','USAGE') result"),true)
   await insertExercise(id(315),base)
   assert.equal((await db.query('SELECT content_status FROM learning_exercises WHERE id=$1',[id(315)])).rows[0].content_status,'ready')
   await db.query('UPDATE learning_exercises SET content=$1 WHERE id=$2',[JSON.stringify({...base,target_form:['sprechen']}),id(315)])
   await assert.rejects(insertExercise(id(316),originalLegacy),e=>e.code==='23514'&&e.message==='target_form_required')
   await assert.rejects(insertExercise(id(316),{...base,text_before:'Русский'}),e=>e.code==='23514'&&e.message==='german_text_required')
   await db.exec('RESET ROLE')
   assert.equal(await result(db,"SELECT has_schema_privilege('anon','grammar_private','USAGE') result"),false)
  })
  await t.test('legacy metadata maintenance is allowed but partial content edits cannot publish contaminated text',async()=>{
   await actor(db,teacher)
   await db.query("UPDATE learning_exercises SET solution_audio_url='storage://audio/review.mp3' WHERE id=$1",[contaminated])
   assert.equal((await db.query('SELECT content_status FROM learning_exercises WHERE id=$1',[contaminated])).rows[0].content_status,'incomplete')
   await assert.rejects(db.query("UPDATE learning_exercises SET content=jsonb_set(content,'{target_form}','[\"sprechen\"]') WHERE id=$1",[contaminated]),e=>e.code==='23514'&&e.message==='german_text_required')
   await db.query("UPDATE learning_reading_texts SET audio_url='storage://audio/review.webm' WHERE id=$1",[badReading])
   await assert.rejects(db.query("UPDATE learning_reading_texts SET focus='Neuer Fokus' WHERE id=$1",[badReading]),e=>e.code==='23514'&&e.message==='german_text_required')
   await db.query('UPDATE learning_exercises SET content=$1 WHERE id=$2',[JSON.stringify(base),contaminated])
   assert.equal((await db.query('SELECT content_status FROM learning_exercises WHERE id=$1',[contaminated])).rows[0].content_status,'ready')
   await db.exec('RESET ROLE')
  })
  await t.test('German character guard covers Cyrillic extensions, all six Turkish letters and decomposed bypasses',async()=>{
   for(const value of ['Я','і','ї','є','ґ','ӿ','ԯ','ᲀ','Ꙁ','\u2de0','\u{1e030}','ı','ğ','ş','İ','Ğ','Ş','s\u0327','I\u0307','G\u0306']) {
    assert.equal(await result(db,'SELECT learning_private.german_text_allowed($1) result',[`Deutsch ${value}`]),false,JSON.stringify(value))
    await assert.rejects(insertExercise(id(311),{...base,text_before:`Deutsch ${value}`}),e=>e.code==='23514'&&e.message==='german_text_required')
   }
   for(const value of ['Straße, Äpfel, Öl und Grüße.','scho\u0308n','123 – „Hallo!“',null,''])
    assert.equal(await result(db,'SELECT learning_private.german_text_allowed($1) result',[value]),true)
  })
  await t.test('every German exercise field and reading sentence/focus is protected; localized hints remain valid',async()=>{
   for(const key of ['instruction','text_before','text_after','question','correct_answer','gap_hint'])
    await assert.rejects(insertExercise(id(312),{...base,[key]:'Русский'}),e=>e.code==='23514'&&e.message==='german_text_required',key)
   for(const key of ['options','accepted_answers','parts','target_form'])
    await assert.rejects(insertExercise(id(312),{...base,[key]:['Русский']}),e=>e.code==='23514'&&e.message==='german_text_required',key)
   await assert.rejects(insertExercise(id(312),base,'Тема'),e=>e.code==='23514'&&e.message==='german_text_required')
   for(const [sentence,focus] of [['Русский','Deutsch'],['Deutsch','ş']])
    await assert.rejects(db.query('INSERT INTO learning_reading_texts(id,unit_id,sentence_de,focus) VALUES($1,$2,$3,$4)',[id(313),readingUnit,sentence,focus]),e=>e.code==='23514'&&e.message==='german_text_required')
   await insertExercise(id(314),{...base,smart_hint:{ru:'Русская подсказка',tr:'İpucu'},explanation:{uk:'Пояснення'}})
   assert.equal((await db.query('SELECT content_status FROM learning_exercises WHERE id=$1',[id(314)])).rows[0].content_status,'ready')
  })
  await t.test('CMS returns explicit target/language errors and rolls back newly created unit/content atomically',async()=>{
   await actor(db,teacher)
   for(const [content,code] of [[originalLegacy,'target_form_required'],[{...base,text_after:' Русский'},'german_text_required']]) {
    const before=(await db.query('SELECT count(*)::int n FROM learning_units')).rows[0].n
    const error=await result(db,"SELECT save_learning_content('exercises',$1) result",[JSON.stringify({unit:{level:'A1.1',label:'Must roll back'},fields:{topic:'Verben',type:'fill_in_blank',content},translations:[]})])
    assert.equal(error.error,code);assert.ok(error.message)
    assert.equal((await db.query('SELECT count(*)::int n FROM learning_units')).rows[0].n,before)
    assert.equal((await db.query("SELECT count(*)::int n FROM learning_units WHERE label='Must roll back'")).rows[0].n,0)
   }
   const bad=await result(db,"SELECT save_learning_content('pronunciation',$1) result",[JSON.stringify({unit:{level:'A1.1',label:'Rejected reading'},fields:{sentence_de:'İstanbul',focus:'Lesen'},translations:[]})])
   assert.equal(bad.error,'german_text_required');assert.ok(bad.message)
   await db.exec('RESET ROLE')
  })
  await t.test('translation prompts persist in their exact locale without entering German task content',async()=>{
   await actor(db,teacher)
   const payload={topic:'Vorstellung',type:'fill_in_blank',content:{...base,text_before:'Wie ',correct_answer:'heißen',accepted_answers:['heißen'],target_form:['heißen'],text_after:' Sie?'}}
   const saved=await save(payload,[{locale:'ru',prompt:'Как вас зовут?',hint:'Подсказка',smart_hint:'Думайте',explanation:'Пояснение'},{locale:'tr',prompt:'Adınız ne?',hint:'İpucu'}])
   assert.ok(saved.id)
   assert.deepEqual((await db.query('SELECT locale,prompt FROM grammar_translations WHERE exercise_id=$1 ORDER BY locale',[saved.id])).rows,[{locale:'ru',prompt:'Как вас зовут?'},{locale:'tr',prompt:'Adınız ne?'}])
   const row=(await db.query('SELECT content,content_status FROM learning_exercises WHERE id=$1',[saved.id])).rows[0]
   assert.deepEqual(row.content,payload.content);assert.equal(row.content_status,'ready');assert.equal('translation_prompt' in row.content,false)
   await actor(db,student)
   assert.equal((await db.query("SELECT prompt FROM grammar_translations WHERE exercise_id=$1 AND locale='ru'",[saved.id])).rows[0].prompt,'Как вас зовут?')
   await db.exec('RESET ROLE')
  })
  await t.test('07 replay and complete migration replay preserve payloads, prompts, ACLs and final function definitions',async()=>{
   const content=(await db.query('SELECT * FROM learning_exercises ORDER BY id')).rows
   const translations=(await db.query('SELECT * FROM grammar_translations ORDER BY exercise_id,locale')).rows
   const functions=await catalog()
   const policies=(await db.query("SELECT tablename,policyname,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename IN('learning_exercises','learning_reading_texts') ORDER BY tablename,policyname")).rows
   await apply(db,['07_content_quality.sql'])
   await apply(db,['02_identity_alignment.sql','03_registration_identity.sql','01_critical_fixes.sql','04_normalization.sql','05_rpc_errors.sql','06_soft_errors.sql','07_content_quality.sql'])
   assert.deepEqual((await db.query('SELECT * FROM learning_exercises ORDER BY id')).rows,content)
   assert.deepEqual((await db.query('SELECT * FROM grammar_translations ORDER BY exercise_id,locale')).rows,translations)
   assert.deepEqual(await catalog(),functions)
   assert.deepEqual((await db.query("SELECT tablename,policyname,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename IN('learning_exercises','learning_reading_texts') ORDER BY tablename,policyname")).rows,policies)
   await actor(db,student);assert.equal((await grade(ready)).status,'EXACT')
   await db.exec('RESET ROLE')
  })
 } finally {await db.close()}
})
