import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createPhase1Database, applyCurrent, actor, id, student, vocabularyUnit, exerciseUnit, result } from './helpers/phase1-db.mjs'

const signatures = [
 'learning_private.normalize_answer(text)', 'learning_private.grade_answer(text,text[])',
 'grammar_private.record_attempt(uuid,text,boolean)', 'vocabulary_private.submit_answer(uuid,boolean,text,text)',
 'vocabulary_private.check_retry_answer(uuid,text,text)',
]
const definitions = async db => (await db.query(`SELECT oid::regprocedure::text name,proowner,proacl::text acl,
 prosecdef,proconfig,pg_get_functiondef(oid) definition FROM pg_proc
 WHERE oid=ANY($1::regprocedure[]) ORDER BY 1`, [signatures])).rows
const data = async db => (await db.query(`SELECT
 (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM vocabulary_direction_progress p) progress,
 (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.request_id) FROM vocabulary_private.answer_receipts r) receipts,
 (SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM learning_vocabulary_cards c) cards`)).rows

await test('Phase 1 migration 30 is reversible, idempotent and preserves the deployed guards/owners', async t => {
 let previous, originalData
 const card=id(8100), progress=id(8101), incomplete=id(8102)
 const db=await createPhase1Database({
  beforeSoftErrors:async db=>{
   await db.query('INSERT INTO learning_exercises(id,unit_id,topic,type,content) VALUES($1,$2,$3,$4,$5)',
    [incomplete,exerciseUnit,'Altbestand','fill_in_blank',JSON.stringify({correct_answer:'Haus',accepted_answers:['Haus']})])
  },
  beforeFairGrading:async db=>{
   await db.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,article,sentence_practice) VALUES($1,$2,'Haus','das',false)",[card,vocabularyUnit])
   await db.query("INSERT INTO vocabulary_translations(card_id,locale,translation) VALUES($1,'en','house')",[card])
   await db.query("INSERT INTO vocabulary_direction_progress(id,auth_user_id,card_id,direction,box_number,next_review_date) VALUES($1,$2,$3,'native_to_de',3,'2020-01-01')",[progress,student,card])
   previous=await definitions(db); originalData=await data(db)
  },
 })
 try {
  await t.test('a second application retains function definitions, ACLs, content and learner state',async()=>{
   const current=await definitions(db)
   assert.deepEqual(await data(db),originalData)
   await applyCurrent(db)
   assert.deepEqual(await definitions(db),current);assert.deepEqual(await data(db),originalData)
   assert.deepEqual(current.map(({name,proowner,acl,prosecdef,proconfig})=>({name,proowner,acl,prosecdef,proconfig})),
    previous.map(({name,proowner,acl,prosecdef,proconfig})=>({name,proowner,acl,prosecdef,proconfig})))
  })
  await t.test('the 07 content readiness guard still rejects legacy incomplete exercises',async()=>{
   await actor(db,student)
   assert.equal((await result(db,'SELECT record_grammar_attempt($1,$2,false) result',[incomplete,'Haus'])).error,'exercise_unavailable')
   await db.exec('RESET ROLE')
   assert.equal((await db.query('SELECT count(*)::int n FROM user_exercise_progress WHERE exercise_id=$1',[incomplete])).rows[0].n,0)
  })
  await t.test('rollback restores exact predecessor bodies and ACLs without removing data; reapply works',async()=>{
   const rollback=await readFile(new URL('../vps/rollback/30_fair_answer_grading.sql',import.meta.url),'utf8')
   await db.exec('BEGIN;'+rollback+'COMMIT;')
   assert.deepEqual(await definitions(db),previous);assert.deepEqual(await data(db),originalData)
   assert.equal((await result(db,"SELECT learning_private.grade_answer('haus',ARRAY['Haus']) result")).status,'SOFT_ERROR')
   assert.equal((await db.query("SELECT to_regtype('learning_private.answer_hint') hint,to_regtype('vocabulary_private.article_feedback') feedback")).rows[0].hint,null)
   await applyCurrent(db);await applyCurrent(db)
   assert.equal((await result(db,"SELECT learning_private.grade_answer('haus',ARRAY['Haus']) result")).status,'EXACT')
   assert.deepEqual(await data(db),originalData)
  })
  await t.test('the legacy NOSUPERUSER owner can reach new private helpers, clients cannot',async()=>{
   await db.exec(`CREATE ROLE phase1_migration_admin SUPERUSER;
    CREATE ROLE phase1_legacy_owner NOLOGIN NOSUPERUSER BYPASSRLS;
    GRANT postgres TO phase1_legacy_owner;
    ALTER FUNCTION learning_private.answer_without_punctuation(text) OWNER TO phase1_migration_admin;
    ALTER FUNCTION vocabulary_private.answer_article_feedback(text,text,text,text) OWNER TO phase1_migration_admin;
    ALTER FUNCTION vocabulary_private.submit_answer(uuid,boolean,text,text) OWNER TO phase1_legacy_owner;
    ALTER FUNCTION vocabulary_private.check_retry_answer(uuid,text,text) OWNER TO phase1_legacy_owner;`)
   // Ownership transfer rewrites owner ACL entries; apply as the real migration
   // owner to establish the distinct postgres EXECUTE grants from migration 30.
   await db.exec('SET ROLE phase1_migration_admin')
   await applyCurrent(db)
   await db.exec('RESET ROLE')
   await actor(db,student)
   const response=await result(db,"SELECT submit_vocabulary_answer($1,false,'Haus','en') result",[progress])
   assert.equal(response.success,true,JSON.stringify(response));assert.equal(response.feedback,'article_missing')
   const retry=await result(db,"SELECT check_vocabulary_retry($1,'das haus','en') result",[progress])
   assert.equal(retry.isCorrect,true,JSON.stringify(retry));assert.equal(retry.hint,'capitalization')
   for(const role of ['anon','authenticated']) {
    await actor(db,student,role)
    await assert.rejects(db.query("SELECT learning_private.answer_without_punctuation('Haus.')"),e=>e.code==='42501')
    await assert.rejects(db.query("SELECT vocabulary_private.answer_article_feedback('Haus','Haus','das',NULL)"),e=>e.code==='42501')
   }
   await db.exec('RESET ROLE')
  })
 } finally { await db.close() }
})
