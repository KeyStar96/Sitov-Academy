import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const migration = await read('./fixtures/history/migrations/20260910133125_vocabulary_bidirectional_learning.sql')
const contexts = await read('./fixtures/history/migrations/20260910135831_vocabulary_context_content.sql')
const receipts = await read('./fixtures/history/migrations/20260910151533_vocabulary_answer_receipts.sql')
const user = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
const teacher = '00000000-0000-4000-8000-000000000003'
const admin = '00000000-0000-4000-8000-000000000004'
const card = n => `10000000-0000-4000-8000-${String(n).padStart(12,'0')}`

await test('Bidirectional learning migration on isolated PostgreSQL', async t => {
 const db = new PGlite()
 try {
  await db.exec(`
   CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
   CREATE SCHEMA auth;
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
   GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
   CREATE TABLE public.profiles(id uuid PRIMARY KEY,role text,allowed_levels text[],native_language text,ui_language text);
   CREATE TABLE public.vocabulary_cards(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),word_de text NOT NULL,lesson text NOT NULL,level text NOT NULL,
    is_hard_for_ru boolean DEFAULT false,is_hard_for_tr boolean DEFAULT false);
   CREATE TABLE public.user_vocabulary_progress(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    card_id uuid NOT NULL REFERENCES vocabulary_cards(id) ON DELETE CASCADE,box_number integer DEFAULT 1 CHECK(box_number BETWEEN 1 AND 7),
    next_review_date timestamptz DEFAULT now(),created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),lapses integer NOT NULL DEFAULT 0,
    last_answered_at timestamptz,UNIQUE(user_id,card_id));
   GRANT SELECT ON profiles,vocabulary_cards TO authenticated;
   GRANT SELECT,INSERT,UPDATE,DELETE ON user_vocabulary_progress TO authenticated;
   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
   CREATE POLICY profile_read ON profiles FOR SELECT TO authenticated USING (auth.uid()=id);
   ALTER TABLE vocabulary_cards ENABLE ROW LEVEL SECURITY;
   CREATE POLICY cards_read ON vocabulary_cards FOR SELECT TO authenticated USING (true);
   ALTER TABLE user_vocabulary_progress ENABLE ROW LEVEL SECURITY;
   CREATE POLICY legacy_owned ON user_vocabulary_progress TO authenticated USING(auth.uid()=user_id) WITH CHECK(auth.uid()=user_id);
  `)
  for (const [id,role,levels] of [[user,'student',['A1.1']],[other,'student',[]],[teacher,'teacher',[]],[admin,'admin',[]]]) {
   await db.query('insert into profiles values($1,$2,$3,$4,$5)',[id,role,levels,'Russisch','ru'])
  }
  for (const [n,word,lesson] of [[1,'Name','Lektion 1'],[2,'Deutsch','Lektion 1'],[3,'Adresse','Lektion 2'],[4,'Kaffee','Lektion 10'],[5,'editorial','Lektion 1'],[6,'unused','Lektion 1']]) {
   await db.query("insert into vocabulary_cards(id,word_de,lesson,level) values($1,$2,$3,'A1.1')",[card(n),word,lesson])
  }
  await db.query("insert into user_vocabulary_progress(user_id,card_id,box_number,next_review_date,lapses,last_answered_at) values($1,$2,4,'2026-01-02',2,'2026-01-01')",[user,card(1)])
  const legacyBefore = (await db.query('select row_to_json(p) row from user_vocabulary_progress p')).rows
  await db.exec(migration)
  const previousRpc = (await db.query("select pg_get_functiondef('public.submit_vocabulary_answer(uuid,boolean,text,text)'::regprocedure) body")).rows[0].body
  const previousGrading = (await db.query("select pg_get_functiondef('vocabulary_private.submit_answer(uuid,boolean,text,text)'::regprocedure) body")).rows[0].body
  await db.exec(receipts)
  async function actor(uid,role='authenticated') {
   await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid??'']); await db.exec(`set role ${role}`)
  }
  async function init(decisions) { return (await db.query('select initialize_vocabulary_cards($1::jsonb) result',[JSON.stringify(decisions)])).rows[0].result }
  async function states(n,uid=user) { return (await db.query('select * from vocabulary_direction_progress where user_id=$1 and card_id=$2 order by direction',[uid,card(n)])).rows }
  async function review(id,correct=null,text=null,lang='ru') { return (await db.query('select submit_vocabulary_answer($1,$2,$3,$4) result',[id,correct,text,lang])).rows[0].result }
  async function clearSpacing() { await actor(null,'service_role'); await db.query('delete from vocabulary_learning_state where user_id=$1',[user]); await actor(user) }
  async function makeDue(id) { await actor(null,'service_role'); await db.query("update vocabulary_direction_progress set next_review_date='2020-01-01' where id=$1",[id]); await actor(user) }

  await t.test('preserves every legacy value and copies forward state verbatim',async()=>{
   assert.deepEqual((await db.query('select row_to_json(p) row from user_vocabulary_progress p')).rows,legacyBefore)
   const pair=await states(1)
   assert.equal(pair.length,2); assert.equal(pair[0].id,legacyBefore[0].row.id); assert.equal(pair[0].box_number,4)
   assert.equal((await db.query('select last_card_id from vocabulary_learning_state where user_id=$1',[user])).rows[0].last_card_id,card(1));
   assert.equal(pair[0].lapses,2);assert.equal(pair[1].box_number,1);assert.equal(pair[1].lapses,0)
  })
  await t.test('receipt migration preserves deployed grading and RPC contracts',async()=>{
   assert.equal((await db.query("select pg_get_functiondef('public.submit_vocabulary_answer(uuid,boolean,text,text)'::regprocedure) body")).rows[0].body,previousRpc)
   assert.equal((await db.query("select pg_get_functiondef('vocabulary_private.submit_answer(uuid,boolean,text,text)'::regprocedure) body")).rows[0].body,previousGrading)
  })
  await t.test('seed fills contexts and enables complete five-language sentences',async()=>{
   await db.query("update vocabulary_cards set context_sentence_de='Existing editor text' where id=$1",[card(5)])
   await db.exec(contexts)
   const seeded=(await db.query('select * from vocabulary_cards where id=$1',[card(1)])).rows[0]
   assert.equal(seeded.context_sentence_de,'Wie ist Ihr Name?');assert.equal(seeded.sentence_practice,true)
   for(const lang of ['en','ru','uk','tr']) assert.ok(seeded[`context_sentence_${lang}`])
   assert.equal((await db.query('select context_sentence_de from vocabulary_cards where id=$1',[card(5)])).rows[0].context_sentence_de,'Existing editor text')
  })
  await t.test('enabled sentence requires all locales',async()=>{
   await assert.rejects(db.query('update vocabulary_cards set context_sentence_ru=null where id=$1',[card(1)]),e=>e.code==='23514')
  })
  await actor(user)
  await t.test('known initializes two phase6 directions; unknown immediately phase1',async()=>{
   assert.deepEqual(await init([{cardId:card(2),alreadyKnown:true},{cardId:card(3),alreadyKnown:false}]),{addedKnown:1,addedNew:1})
   assert.deepEqual((await states(2)).map(s=>s.box_number),[6,6])
   const unknown=await states(3);assert.deepEqual(unknown.map(s=>s.box_number),[1,1])
   unknown.forEach(s=>assert.ok(s.next_review_date.getTime()<=Date.now()))
  })
  await t.test('retry never overwrites existing direction grades',async()=>{
   assert.deepEqual(await init([{cardId:card(1),alreadyKnown:true},{cardId:card(2),alreadyKnown:false}]),{addedKnown:0,addedNew:0})
   assert.deepEqual((await states(1)).map(s=>s.box_number),[4,1])
   assert.deepEqual((await states(2)).map(s=>s.box_number),[6,6])
  })
  await t.test('skip picks actual numerically first lesson atomically without resetting progress',async()=>{
   const result=(await db.query("select skip_vocabulary_assessment('A1.1') result")).rows[0].result
   assert.equal(result.lesson,'Lektion 1');assert.equal(result.addedNew,2)
   assert.equal((await db.query('select status from vocabulary_onboarding')).rows[0].status,'skipped')
   assert.deepEqual((await states(1)).map(s=>s.box_number),[4,1])
   assert.equal((await states(4)).length,0)
  })
  await t.test('direct API progress and cursor writes are denied',async()=>{
   await assert.rejects(db.query('update vocabulary_direction_progress set box_number=7 where card_id=$1',[card(1)]),e=>e.code==='42501')
   await assert.rejects(db.query('insert into vocabulary_direction_progress(user_id,card_id,direction,box_number) values($1,$2,$3,7)',[user,card(4),'native_to_de']),e=>e.code==='42501')
   await assert.rejects(db.query('insert into vocabulary_learning_state(user_id,last_card_id) values($1,$2)',[user,card(4)]),e=>e.code==='42501')
   await assert.rejects(db.exec("update vocabulary_onboarding set status='completed'"),e=>e.code==='42501')
  })
  await t.test('legacy app writes remain accepted and only update forward direction',async()=>{
   await db.query('update user_vocabulary_progress set box_number=5 where card_id=$1',[card(1)])
   assert.deepEqual((await states(1)).map(s=>s.box_number),[5,1])
   await db.query('insert into user_vocabulary_progress(user_id,card_id) values($1,$2)',[user,card(4)])
   assert.deepEqual((await states(4)).map(s=>s.box_number),[1,1])
  })
  await t.test('other users cannot read rows, initialize locked level or submit another progress',async()=>{
   const id=(await states(1))[0].id;await actor(other)
   assert.equal((await db.query('select * from vocabulary_direction_progress')).rows.length,0)
   assert.equal((await db.query('select * from vocabulary_onboarding')).rows.length,0)
   await assert.rejects(init([{cardId:card(1),alreadyKnown:false}]),e=>e.code==='42501')
   await assert.rejects(review(id,true),e=>e.code==='42501');await actor(user)
  })
  await t.test('explicit teacher/admin roles may initialize content without student level grant',async()=>{
   for(const uid of [teacher,admin]) {await actor(uid);assert.equal((await init([{cardId:card(1),alreadyKnown:false}])).addedNew,1)}
   await actor(user)
  })
  await t.test('anonymous users cannot call private/public APIs or read protected tables',async()=>{
   await actor(null,'anon')
   await assert.rejects(init([{cardId:card(1),alreadyKnown:false}]),e=>e.code==='42501')
   await assert.rejects(db.exec('select * from vocabulary_direction_progress'),e=>e.code==='42501')
   await assert.rejects(db.exec("select vocabulary_private.skip_assessment('A1.1')"),e=>e.code==='42501')
   await actor(user)
  })
  await t.test('sentence ignores forged true boolean and grades exact German spelling',async()=>{
   await clearSpacing();const reverse=(await states(1))[1]
   const wrong=await review(reverse.id,true,'wie ist Ihr Name?')
   assert.equal(wrong.isCorrect,false);assert.equal(wrong.correctAnswer,'Wie ist Ihr Name?');assert.equal(wrong.newPhase,1)
   await clearSpacing();await makeDue(reverse.id)
   const correct=await review(reverse.id,false,'Wie ist Ihr Name?')
   assert.equal(correct.isCorrect,true);assert.equal(correct.newPhase,2)
   assert.equal((await states(1))[0].box_number,5)
  })
  await t.test('whitespace and punctuation differences fail without normalization',async()=>{
   const id=(await states(1))[1].id
   for(const value of ['Wie ist Ihr Name','Wie ist Ihr Name? ',' Wie ist Ihr Name?','Wie ist ihr Name?']) {
    await clearSpacing();await makeDue(id);assert.equal((await review(id,true,value)).isCorrect,false)
   }
  })
  await t.test('language switching and omitted text cannot bypass exact sentence grading',async()=>{
   const id=(await states(1))[1].id
   for(const lang of ['de','en','ru','uk','tr']) {
    await clearSpacing();await makeDue(id);assert.equal((await review(id,true,null,lang)).isCorrect,false)
   }
   await clearSpacing();await makeDue(id);await assert.rejects(review(id,true,null,'fr'),e=>e.code==='22023')
  })
  await t.test('opposite direction cannot follow same word even across subsequent RPCs',async()=>{
   await clearSpacing();const pair=await states(3)
   assert.equal((await review(pair[0].id,true)).success,true)
   const before=(await states(3))[1]
   await assert.rejects(review(pair[1].id,null,'Wie ist Ihre Adresse?'),e=>e.code==='40001' && e.message.includes('spacing'))
   const after=(await states(3))[1];assert.equal(after.next_review_date.getTime(),before.next_review_date.getTime())
   // Another word creates the required separation; the deferred direction then works.
   const spacer=(await states(4))[0];await review(spacer.id,true)
   assert.equal((await review(pair[1].id,null,'Wie ist Ihre Adresse?')).isCorrect,true)
  })
  await t.test('stale/repeated answer cannot advance a future review twice',async()=>{
   const pair=await states(3);await assert.rejects(review(pair[1].id,null,'Wie ist Ihre Adresse?'),e=>e.code==='40001')
  })
  await t.test('legacy lesson reset deletes both directions without affecting other words',async()=>{
   await db.query('delete from user_vocabulary_progress where card_id=$1',[card(4)])
   assert.equal((await states(4)).length,0);assert.equal((await states(1)).length,2)
  })
  await t.test('failed initialization is atomic across denied/unknown cards',async()=>{
   await db.query('delete from user_vocabulary_progress where card_id=$1',[card(6)])
   await assert.rejects(init([{cardId:card(6),alreadyKnown:false},{cardId:card(99),alreadyKnown:false}]),e=>e.code==='42501')
   assert.equal((await states(6)).length,0)
  })

  const request = n => `20000000-0000-4000-8000-${String(n).padStart(12,'0')}`
  async function once(key,id,correct=null,text=null,lang='de') {
   return (await db.query('select submit_vocabulary_answer_once($1,$2,$3,$4,$5) result',[key,id,correct,text,lang])).rows[0].result
  }
  async function addWord(n,uid=user) {
   await actor(null,'postgres')
   await db.query("insert into vocabulary_cards(id,word_de,lesson,level) values($1,'Testwort','Lektion 1','A1.1')",[card(n)])
   await actor(uid);await init([{cardId:card(n),alreadyKnown:false}])
   return (await states(n,uid))[0].id
  }
  async function privateReceipts(uid=user) {
   await actor(null,'postgres')
   const rows=(await db.query('select * from vocabulary_private.answer_receipts where user_id=$1 order by request_id',[uid])).rows
   await actor(user);return rows
  }
  await t.test('committed answer replay returns the same response without regrading or moving the cursor',async()=>{
   const id=await addWord(101)
   const original=await once(request(1),id,true)
   const after=(await states(101))[0]
   assert.deepEqual(await once(request(1),id,true),original)
   assert.deepEqual((await states(101))[0],after)
   // Simulate another successfully committed queued answer before a delayed retry.
   const spacer=await addWord(102);await once(request(2),spacer,false)
   const cursorBefore=(await db.query('select * from vocabulary_learning_state')).rows
   assert.deepEqual(await once(request(1),id,true),original)
   assert.deepEqual((await db.query('select * from vocabulary_learning_state')).rows,cursorBefore)
   assert.deepEqual((await states(101))[0],after)
   assert.equal((await privateReceipts()).length,2)
   await assert.rejects(once(request(3),id,true),e=>e.code==='40001')
   assert.equal((await privateReceipts()).length,2)
  })
  await t.test('each request ID binds progress, nullable rating, exact text and UI language',async()=>{
   const id=(await states(101))[0].id
   for (const payload of [
    [(await states(102))[0].id,true,null,'de'],[id,false,null,'de'],[id,null,null,'de'],
    [id,true,'','de'],[id,true,' ','de'],[id,true,null,'ru'],
   ]) await assert.rejects(once(request(1),...payload),e=>e.code==='22023' && e.message.includes('request_conflict'))
   await assert.rejects(once(null,id,true),e=>e.code==='22023')
   await assert.rejects(once(request(99),id,true,null,'fr'),e=>e.code==='22023')
   assert.equal((await privateReceipts()).length,2)
  })
  await t.test('receipt ownership prevents cross-user replay and keys are scoped per user',async()=>{
   const id=(await states(101))[0].id
   await actor(teacher)
   await assert.rejects(once(request(1),id,true),e=>e.code==='42501')
   const own=await addWord(103,teacher)
   assert.equal((await once(request(1),own,true)).success,true)
   await actor(user)
   assert.equal((await once(request(1),id,true)).success,true)
   assert.equal((await privateReceipts(teacher)).length,1)
  })
  await t.test('private receipts cannot be read or forged, and anonymous replay is denied',async()=>{
   const id=(await states(101))[0].id
   await assert.rejects(db.exec('select * from vocabulary_private.answer_receipts'),e=>e.code==='42501')
   await assert.rejects(db.exec('delete from vocabulary_private.answer_receipts'),e=>e.code==='42501')
   await assert.rejects(db.query("insert into vocabulary_private.answer_receipts(user_id,request_id,progress_id,ui_language,response) values($1,$2,$3,'de','{}')",[user,request(90),id]),e=>e.code==='42501')
   await actor(null,'anon');await assert.rejects(once(request(1),id,true),e=>e.code==='42501')
   await actor(null);await assert.rejects(once(request(1),id,true),e=>e.code==='42501')
   await actor(null,'postgres')
   const table=(await db.query("select relrowsecurity from pg_class where oid='vocabulary_private.answer_receipts'::regclass")).rows[0]
   assert.equal(table.relrowsecurity,true)
   assert.equal((await db.query("select * from pg_policy where polrelid='vocabulary_private.answer_receipts'::regclass")).rows.length,0)
   await actor(user)
  })
  await t.test('rollback removes both grade and receipt so the same request can retry normally',async()=>{
   const id=await addWord(104);const before=(await states(104))[0]
   await db.exec('begin');const result=await once(request(4),id,false);await db.exec('rollback')
   assert.deepEqual((await states(104))[0],before)
   assert.equal((await privateReceipts()).some(row=>row.request_id===request(4)),false)
   assert.deepEqual(await once(request(4),id,false),result)
   assert.equal((await states(104))[0].lapses,1)
  })
  await t.test('receipt insertion failure also rolls back the inner grading function',async()=>{
   const id=await addWord(105);const before=(await states(105))[0]
   await actor(null,'postgres')
   await db.exec(`alter table vocabulary_private.answer_receipts add constraint test_reject_receipt check(request_id <> '${request(5)}'::uuid)`)
   await actor(user)
   await assert.rejects(once(request(5),id,false),e=>e.code==='23514')
   assert.deepEqual((await states(105))[0],before)
   await actor(null,'postgres');await db.exec('alter table vocabulary_private.answer_receipts drop constraint test_reject_receipt');await actor(user)
   assert.equal((await once(request(5),id,false)).success,true)
   assert.equal((await states(105))[0].lapses,1)
  })
  await t.test('sentence retries preserve byte-exact grading, payload binding and answer disclosure',async()=>{
   await addWord(106)
   await actor(null,'postgres')
   const target='Ich öffne die Tür.'
   await db.query("update vocabulary_cards set sentence_practice=true,context_sentence_de=$1,context_sentence_en='I open the door.',context_sentence_ru='Я открываю дверь.',context_sentence_uk='Я відчиняю двері.',context_sentence_tr='Kapıyı açıyorum.' where id=$2",[target,card(106)])
   await actor(user);const id=(await states(106))[1].id
   const wrong=target.normalize('NFD')
   const result=await once(request(6),id,true,wrong,'de')
   assert.equal(result.isCorrect,false);assert.equal(result.correctAnswer,target)
   assert.deepEqual(await once(request(6),id,true,wrong,'de'),result)
   await assert.rejects(once(request(6),id,true,target,'de'),e=>e.code==='22023')
   await clearSpacing();await makeDue(id)
   assert.equal((await once(request(7),id,false,target,'tr')).isCorrect,true)
  })
  await t.test('duplicate in-flight calls apply one grade and return one result',async()=>{
   const id=await addWord(107)
   // PGlite serializes its single connection; this exercises repeated queued
   // statements. Multi-connection lock contention requires a real PG server.
   const [first,second]=await Promise.all([once(request(8),id,false),once(request(8),id,false)])
   assert.deepEqual(first,second);assert.equal((await states(107))[0].lapses,1)
  })
  await t.test('lesson reset retains receipts and cannot resurrect or regrade removed progress',async()=>{
   const id=(await states(107))[0].id;const original=await once(request(8),id,false)
   await db.query('delete from user_vocabulary_progress where card_id=$1',[card(107)])
   assert.deepEqual(await once(request(8),id,false),original)
   assert.equal((await states(107)).length,0)
  })
 } finally { await db.close() }
})
