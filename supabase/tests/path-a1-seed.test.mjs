import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createPhase3Database,actor,student,result,apply} from './helpers/phase3-db.mjs'

// Canonical mapping of supabase/seeds/path-a1.1.json: unit → learning_units, node.topic + exercise → learning_exercises,
// hint/explanation (de) and translations.<locale>.hint/explanation → grammar_translations.
const paths=JSON.parse(await readFile(new URL('../seeds/path-a1.1.json',import.meta.url),'utf8'))
const exercises=paths.flatMap(path=>path.nodes.flatMap(node=>node.exercises.map(exercise=>({path,node,exercise}))))

await test('A1.1 learning path seed fits the canonical learning tables',async t=>{
 const db=await createPhase3Database()
 try{
  await apply(db,['07_content_quality.sql'])
  const units=new Map()
  for(const path of paths) units.set(path.id,(await db.query('INSERT INTO learning_units(level,trainer,label,sort_order) VALUES($1,$2::trainer_code,$3,$4) RETURNING id',
   [path.unit.level,path.unit.trainer,path.unit.label,path.unit.sort_order])).rows[0].id)
  for(const {path,node,exercise} of exercises) {
   await db.query('INSERT INTO learning_exercises(id,unit_id,topic,type,content) VALUES($1,$2,$3,$4::exercise_type,$5)',
    [exercise.id,units.get(path.id),node.topic,exercise.exercise_type,JSON.stringify(exercise.content)])
   for(const [locale,texts] of [['de',exercise],...Object.entries(exercise.translations)])
    await db.query('INSERT INTO grammar_translations(exercise_id,locale,hint,explanation) VALUES($1,$2,$3,$4)',[exercise.id,locale,texts.hint,texts.explanation])
  }

  await t.test('every exercise passes the quality triggers and is released as ready',async()=>{
   assert.deepEqual((await db.query("SELECT content_status::text status,count(*)::int n FROM learning_exercises GROUP BY 1")).rows,[{status:'ready',n:exercises.length}])
   assert.equal((await db.query('SELECT count(*)::int n FROM grammar_translations')).rows[0].n,exercises.length*5)
  })
  await t.test('the student grading RPC accepts every solution exactly and rejects wrong choices',async()=>{
   await actor(db,student)
   for(const {exercise} of exercises) {
    if(exercise.exercise_type==='sentence_building') continue
    assert.equal((await result(db,'SELECT record_grammar_attempt($1,$2,false) result',[exercise.id,exercise.content.correct_answer])).status,'EXACT',exercise.ref)
    if(exercise.exercise_type==='multiple_choice') for(const option of exercise.content.options.filter(option=>option!==exercise.content.correct_answer))
     assert.equal((await result(db,'SELECT record_grammar_attempt($1,$2,false) result',[exercise.id,option])).status,'INCORRECT',exercise.ref)
   }
   await db.exec('RESET ROLE')
  })
 } finally { await db.close() }
})
