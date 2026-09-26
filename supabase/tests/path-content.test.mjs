import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { createPhase1Database, actor, student, exerciseUnit, id, result } from './helpers/phase1-db.mjs'
import { apply } from './helpers/phase3-db.mjs'

const require = createRequire(import.meta.url)
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const { learningPathContentSchemas } = require('../../lib/learning-path-schema.ts')

const base = { target_form: ['Beispiel'], instruction: 'Ergänze die Aufgabe.' }
const choice = { ...base, question: 'Was passt?', options: ['Haus', 'Baum'], correct_answer: 'Haus', accepted_answers: ['Haus'] }
const blank = { ...base, text_before: 'Das ist ', text_after: '.', correct_answer: 'das Haus', accepted_answers: ['das Haus'], needs_article: true }
const digest = value => createHash('md5').update(value).digest('hex')
const fixtures = {
 multiple_choice: { content: choice, answer: { index: 0 }, wrong: { index: 1 } },
 fill_in_blank: { content: blank, answer: { text: 'das Haus' }, wrong: { text: 'Haus' } },
 sentence_building: { content: { ...base, parts: ['ist', 'Das', 'ein Haus.'], correct_answer: 'Das ist ein Haus.', accepted_answers: ['Das ist ein Haus.', 'Ein Haus ist das.'] }, answer: { indices: [1, 0, 2] }, wrong: { indices: [0, 1, 2] } },
 multi_blank: { content: { ...base, text: 'Ich ___ in ___.', blanks: [{ id: 'verb', accepted_answers: ['wohne'] }, { id: 'city', label: 'Stadt', accepted_answers: ['München'] }] }, answer: { values: { verb: 'wohne', city: 'München' } }, wrong: { values: { verb: 'bin', city: 'München' } } },
 matching: { content: { ...base, pairs: [{ id: 'a', left: 'Guten', right: 'Tag' }, { id: 'b', left: 'Auf', right: 'Wiedersehen' }] }, answer: { pairs: { a: digest('Tag'), b: digest('Wiedersehen') } }, wrong: { pairs: { a: digest('Wiedersehen'), b: digest('Tag') } } },
 categorize: { content: { ...base, categories: [{ id: 'n', label: 'das' }, { id: 'm', label: 'der' }], items: [{ id: 'a', text: 'Haus', category_id: 'n' }, { id: 'b', text: 'Baum', category_id: 'm' }] }, answer: { assignments: { a: 'n', b: 'm' } }, wrong: { assignments: { a: 'm', b: 'n' } } },
 dialogue: { content: { ...base, turns: [{ id: 'a', speaker: 'Anna', prompt: 'Hallo!', type: 'multiple_choice', options: ['Guten Tag!', 'Gute Nacht!'], correct_answer: 'Guten Tag!' }, { id: 'b', speaker: 'Tom', prompt: 'Wo wohnst du?', type: 'fill_in_blank', accepted_answers: ['In München.'] }] }, answer: { replies: { a: 0, b: 'In München.' } }, wrong: { replies: { a: 1, b: 'In München.' } } },
 listening: { content: { ...base, transcript: 'Das Haus ist groß.', audio: { normal: '/audio/normal.wav', slow: '/audio/slow.wav' }, exercise: { type: 'multiple_choice', content: choice } }, answer: { index: 0 }, wrong: { index: 1 } },
 transform: { content: { ...base, source: 'Du wohnst in Berlin.', accepted_answers: ['Wohnst du in Berlin?'] }, answer: { text: 'Wohnst du in Berlin?' }, wrong: { text: 'Du wohnst in Berlin.' } },
}
const grade = (db,type,content,answer) => result(db,'SELECT path_private.grade($1::exercise_type,$2::jsonb,$3::jsonb) result',[type,JSON.stringify(content),JSON.stringify(answer)])
const valid = (db,type,content) => result(db,'SELECT path_private.valid_content($1::exercise_type,$2::jsonb) result',[type,JSON.stringify(content)])
const presented = (db,type,content) => result(db,'SELECT path_private.present_content($1::exercise_type,$2::jsonb) result',[type,JSON.stringify(content)])
const definitions = async db => (await db.query(`SELECT oid::regprocedure::text signature,pg_get_functiondef(oid) definition,proacl::text acl FROM pg_proc
 WHERE oid=ANY(ARRAY['grammar_private.valid_accepted_answers(jsonb,public.exercise_type)'::regprocedure,'grammar_private.german_content_allowed(jsonb,text)'::regprocedure]) ORDER BY 1`)).rows

await test('Phase 3 typed exercise contracts, grading, publication and rollback', async t => {
 const legacy = id(3390)
 const db = await createPhase1Database({ beforeSoftErrors: async db => {
  await db.query('INSERT INTO learning_exercises(id,unit_id,topic,type,content) VALUES($1,$2,$3,$4,$5)',
   [legacy,exerciseUnit,'Altbestand','fill_in_blank',JSON.stringify({ correct_answer: 'Haus', accepted_answers: ['Haus'] })])
 } })
 try {
  const previous = await definitions(db)
  const original = await result(db,'SELECT to_jsonb(e) result FROM learning_exercises e WHERE id=$1',[legacy])
  await apply(db,['33_path_exercise_types.sql'])
  await apply(db,['34_path_content_contract.sql'])
  await t.test('all nine content contracts grade a correct and incorrect response in PostgreSQL', async () => {
   for (const [type,fixture] of Object.entries(fixtures)) {
    assert.equal(await valid(db,type,fixture.content),true,type)
    const correct=await grade(db,type,fixture.content,fixture.answer)
    assert.equal(correct.status,'EXACT',JSON.stringify({type,correct})); assert.equal(correct.correct,true,type)
    assert.ok(correct.fields.length>0,type)
    const wrong=await grade(db,type,fixture.content,fixture.wrong)
    assert.equal(wrong.status,'INCORRECT',JSON.stringify({type,wrong})); assert.equal(wrong.correct,false,type)
   }
  })
  await t.test('every writing component uses the phase-1 tolerance while articles remain required', async () => {
   assert.equal((await grade(db,'fill_in_blank',blank,{text:'das haus.'})).status,'EXACT')
   assert.equal((await grade(db,'fill_in_blank',blank,{text:'der Haus'})).correct,false)
   const multi=await grade(db,'multi_blank',fixtures.multi_blank.content,{values:{verb:'wohne',city:'Muenchen'}})
   assert.equal(multi.status,'SOFT_ERROR'); assert.equal(multi.correct,true); assert.equal(multi.fields[1].reason,'umlaut')
   assert.equal((await grade(db,'dialogue',fixtures.dialogue.content,{replies:{a:0,b:'In Muenchen.'}})).status,'SOFT_ERROR')
   const listening={...fixtures.listening.content,exercise:{type:'fill_in_blank',content:blank}}
   assert.equal((await grade(db,'listening',listening,{text:'das Haus'})).correct,true)
  })
  await t.test('malformed answers produce explicit errors, never a client-controlled score', async () => {
   for (const [type,fixture] of Object.entries(fixtures)) {
    assert.equal((await grade(db,type,fixture.content,{})).error,'invalid_answer',type)
    assert.equal((await grade(db,type,fixture.content,{...fixture.answer,correct:true})).error,'invalid_answer',type)
   }
   for(const index of [-1,1.5,999,'0',null,1e30]) assert.equal((await grade(db,'multiple_choice',choice,{index})).error,'invalid_answer')
   for(const indices of [[1,1,2],[0,1],[-1,0,1],['1',0,2]]) assert.equal((await grade(db,'sentence_building',fixtures.sentence_building.content,{indices})).error,'invalid_answer')
   assert.equal((await grade(db,'multi_blank',fixtures.multi_blank.content,{values:{verb:'wohne',other:'München'}})).error,'invalid_answer')
   assert.equal((await grade(db,'transform',fixtures.transform.content,{text:' '.repeat(20)})).error,'invalid_answer')
  })
  await t.test('the public projection cannot reveal solution fields or matching associations', async () => {
   const forbidden=new Set(['target_form','accepted_answers','correct_answer','category_id','transcript','hint','smart_hint','explanation'])
   const inspect=value=>{ if(!value || typeof value!=='object')return; for(const [key,child] of Object.entries(value)){assert.ok(!forbidden.has(key),key);inspect(child)} }
   for(const [type,fixture] of Object.entries(fixtures)) {
    const output=await presented(db,type,{...fixture.content,hint:'SECRET',smart_hint:{de:'SECRET'},explanation:'SECRET',future_answer:'SECRET'})
    inspect(output);assert.ok(!JSON.stringify(output).includes('SECRET'),type)
   }
   const output=await presented(db,'matching',fixtures.matching.content)
   assert.deepEqual(output.left.map(row=>row.id),['a','b'])
   assert.ok(output.right.every(row=>row.id!=='a'&&row.id!=='b'))
   assert.deepEqual(new Set(output.right.map(row=>row.text)),new Set(['Tag','Wiedersehen']))
   assert.equal((await presented(db,'fill_in_blank',{...blank,options:['das Haus','der Baum']})).options,undefined)
  })
  await t.test('content validators reject invalid keys, mappings, options, audio and shape', async () => {
   for(const [type,fixture] of Object.entries(fixtures)) {
    assert.equal(await valid(db,type,{...fixture.content,unexpected:'x'}),false,type)
    assert.equal(await valid(db,type,{...fixture.content,target_form:[]}),false,type)
    assert.equal(await valid(db,type,null),false,type)
   }
   assert.equal(await valid(db,'multiple_choice',{...choice,correct_answer:'wrong'}),false)
   assert.equal(await valid(db,'multiple_choice',{...choice,options:['Haus',' haus ']}),false)
   assert.equal(await valid(db,'multi_blank',{...fixtures.multi_blank.content,blanks:[{id:'a',accepted_answers:[]}]}),false)
   assert.equal(await valid(db,'categorize',{...fixtures.categorize.content,items:[{id:'a',text:'Haus',category_id:'unknown'}]}),false)
   assert.equal(await valid(db,'dialogue',{...fixtures.dialogue.content,turns:[{...fixtures.dialogue.content.turns[0],correct_answer:'Fehlt'}]}),false)
   for(const normal of ['https://example.com/a.wav','//example.com/a.wav','/../a.wav','/audio/%2e%2e/a.wav','/audio\\a.wav','/audio/a b.wav'])
    assert.equal(await valid(db,'listening',{...fixtures.listening.content,audio:{normal,slow:'/slow.wav'}}),false,normal)
  })
  await t.test('all existing seed exercise payloads satisfy SQL without importing a single row', async () => {
   const seed=JSON.parse(await readFile(new URL('../seeds/path-a1.1.json',import.meta.url),'utf8'))
   const exercises=seed.flatMap(path=>path.nodes.flatMap(node=>node.exercises))
   const failures=(await db.query(`SELECT e->>'ref' ref FROM jsonb_array_elements($1::jsonb) e
    WHERE NOT path_private.valid_content((e->>'exercise_type')::exercise_type,e->'content')`,[JSON.stringify(exercises)])).rows
   assert.deepEqual(failures,[]);assert.equal(exercises.length,769)
   assert.deepEqual(await result(db,'SELECT to_jsonb(e) result FROM learning_exercises e WHERE id=$1',[legacy]),original)
  })
  await t.test('SQL and Zod agree on Unicode lengths, whitespace, nested payloads and Piper limits', async () => {
   const vectors = Object.entries(fixtures).map(([type,fixture]) => [type,fixture.content])
   vectors.push(
    ['multiple_choice',{...choice,instruction:'😀'.repeat(2001)}],
    ['multiple_choice',{...choice,instruction:'😀'.repeat(4001)}],
    ['multiple_choice',{...choice,correct_answer:'\tHaus '}],
    ['multiple_choice',{...choice,correct_answer:'\uFEFFHaus'}],
    ['multiple_choice',{...choice,accepted_answers:['Haus\uFEFF']}],
    ['fill_in_blank',{...blank,accepted_answers:['das Haus','das\u00A0Haus']}],
    ['fill_in_blank',{...blank,text_before:'\uFEFFText'}],
    ['multi_blank',{...fixtures.multi_blank.content,blanks:[{id:'😀'.repeat(60),accepted_answers:['Haus']}]}],
    ['listening',{...fixtures.listening.content,transcript:'a'.repeat(3000)}],
    ['listening',{...fixtures.listening.content,transcript:'a'.repeat(3001)}],
    ['listening',{...fixtures.listening.content,audio:{normal:'/audio/\uFEFFx.mp3',slow:'/audio/y.mp3'}}],
    ['listening',{...fixtures.listening.content,audio:{normal:'/audio/\u00A0x.mp3',slow:'/audio/y.mp3'}}],
   )
   for(const [type,content] of vectors) {
    const expected=learningPathContentSchemas[type].safeParse(content).success
    assert.equal(await valid(db,type,content),expected,`${type}: ${JSON.stringify(content).slice(0,200)}`)
    if(expected) assert.equal(await result(db,'SELECT grammar_private.valid_accepted_answers($1,$2) result',[JSON.stringify(content),type]),true,'a valid typed payload must pass the retained table constraint')
   }
  })
  await t.test('German protection includes nested tasks and keeps localized hints outside its scope', async () => {
   assert.equal(await result(db,"SELECT grammar_private.german_content_allowed($1,'') result",[JSON.stringify({...fixtures.dialogue.content,turns:[{...fixtures.dialogue.content.turns[0],prompt:'Привет'}]})]),false)
   assert.equal(await result(db,"SELECT grammar_private.german_content_allowed($1,'') result",[JSON.stringify({...choice,hint:{ru:'Привет'}})]),true)
   await assert.rejects(db.query("INSERT INTO learning_exercises(unit_id,topic,type,content) VALUES($1,'Dialog','dialogue',$2)",[exerciseUnit,JSON.stringify({...fixtures.dialogue.content,turns:[{...fixtures.dialogue.content.turns[0],prompt:'Привет'}]})]),error=>error.message==='german_text_required')
  })
  await t.test('private grading and presentation are inaccessible to both public client roles', async () => {
   for(const role of ['anon','authenticated']) {
    await actor(db,student,role)
    await assert.rejects(grade(db,'multiple_choice',choice,{index:0}),error=>error.code==='42501')
    await assert.rejects(presented(db,'multiple_choice',choice),error=>error.code==='42501')
   }
   await db.exec('RESET ROLE')
  })
  await t.test('both migrations replay and rollback restores the predecessor without rewriting legacy data', async () => {
   const current=await definitions(db)
   await apply(db,['33_path_exercise_types.sql']);await apply(db,['34_path_content_contract.sql'])
   assert.deepEqual(await definitions(db),current)
   await apply(db,['rollback/34_path_content_contract.sql']);await apply(db,['rollback/33_path_exercise_types.sql'])
   assert.deepEqual(await definitions(db),previous)
   assert.deepEqual(await result(db,'SELECT to_jsonb(e) result FROM learning_exercises e WHERE id=$1',[legacy]),original)
   await apply(db,['33_path_exercise_types.sql']);await apply(db,['34_path_content_contract.sql'])
   assert.equal((await grade(db,'multiple_choice',choice,{index:0})).correct,true)
  })
 } finally { await db.close() }
})
