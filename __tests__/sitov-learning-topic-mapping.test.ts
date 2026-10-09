/** @jest-environment node */
import { readFileSync } from 'node:fs'
import { learningPathSeedSchema } from '@/lib/learning-path-schema'
import { SITOV_TOPIC_MAPPING } from '@/lib/learning/sitov-topic-mapping'
const load=(level:string)=>learningPathSeedSchema.parse(JSON.parse(readFileSync(`supabase/seeds/path-${level}.json`,'utf8')))
const node=(level:string,id:string)=>load(level).flatMap(path=>path.nodes).find(n=>n.id===id)!
const exercise=(level:string,nid:string,id:string)=>{
 const value=node(level,nid).exercises.find(e=>e.id===id)!
 return {...value,content:value.content as Record<string,unknown>}
}

it.each(['a1.1','a1.2','a2.1','a2.2'])('keeps the complete %s seed valid after character edits',level=>expect(load(level).length).toBeGreaterThan(0))
it('anchors nominative practice only to the actual article lesson, preserving its Special binding',()=>{
 const topic=SITOV_TOPIC_MAPPING.find(t=>t.topicId==='sitov.topic.nominativ')!
 expect(topic.anchors.map(a=>a.nodeSourceId)).toEqual(['P4-N1'])
 expect(node('a1.1','P4-N1').title).toBe('Der, das, die')
 expect(topic.specialTargets?.[0]).toMatchObject({anchorSourceId:'P4-N1',goalId:'P4-G1'})
})
it('uses male characters and agreement in the audited cards while preserving grammatical gender examples',()=>{
 expect(node('a1.1','P2-N3').merkkarte?.examples?.[3]).toBe('Das ist Selim. Er kommt aus der Türkei.')
 expect(node('a1.1','P2-N3').merkkarte?.rule).toContain('die Mutter')
 expect(node('a1.1','P5-N3').merkkarte?.examples?.[1]).toBe('Oleh ruft am Abend seinen Vater an.')
 expect(node('a1.1','P5-N6').merkkarte?.rule).toContain('Um sieben Uhr steht Oleh auf.')
 expect(node('a1.1','P6-N7').merkkarte?.examples?.[1]).toBe('Kamil liest jeden Abend.')
 expect(node('a1.1','P6-N8').merkkarte?.examples?.[2]).toBe('Oleh fährt am Wochenende nach Dresden.')
 expect(node('a1.2','P3-N2').merkkarte?.examples?.[2]).toBe('Leon hat Fieber und Halsschmerzen.')
 expect(node('a2.1','P1-N4').merkkarte?.examples?.[0]).toBe('Leon lernt Deutsch, weil er in Berlin arbeitet.')
})
it.each([
 ['a1.1','P2-N3','37a6e297-df03-52c7-a7eb-51335b24d9f6','kommt'],
 ['a1.1','P5-N3','7c42c6a7-ff31-553c-a374-872dbb72049c','ruft'],
 ['a1.1','P6-N7','b831156c-98e9-59c1-a580-235315123e01','liest'],
 ['a1.1','P6-N7','1d8236b2-76ec-5933-a03f-7dbc733e856b','Triffst'],
 ['a1.1','P6-N8','cb8f65c6-df87-5cb8-a5aa-7d715d54e4af','fährt'],
 ['a2.2','P1-N6','95531a50-2eec-52c8-ab16-8e229333270e','Wir könnten zusammen einen Film sehen.'],
 ['a2.2','P1-N7','2ca07843-9514-548c-a9ab-5039e54f2b2c','Wir könnten am Samstag ins Museum gehen. Hast du Lust?'],
])('preserves the existing solution and all interface locales for %s/%s/%s',(level,nid,id,answer)=>{
 const e=exercise(level,nid,id)
 expect(e.content.correct_answer).toBe(answer)
 expect(e.accepted_answers).toContain(answer)
 expect(e.content.accepted_answers).toContain(answer)
 expect(Object.keys(e.translations??{}).sort()).toEqual(['en','ru','tr','uk'])
})
it('updates the Selim and male friend translations without changing the answer choices',()=>{
 const selim=exercise('a1.1','P2-N3','37a6e297-df03-52c7-a7eb-51335b24d9f6')
 expect(selim.translations?.en?.task).toBe('This is Selim. He comes from Turkey.')
 expect(selim.translations?.ru?.task).toContain('Он')
 expect(selim.translations?.uk?.task).toContain('Він')
 const friend=exercise('a2.2','P1-N7','2ca07843-9514-548c-a9ab-5039e54f2b2c')
 expect(friend.content.question).toContain('mit einem Freund')
 expect(friend.translations?.ru?.task).toContain('с другом')
 expect(friend.translations?.uk?.task).toContain('з другом')
})

it('keeps factual feminine grammar targets without named fictional characters',()=>{
 for(const [level,nid,id,answer] of [
  ['a1.2','P1-N12','86cc2103-15f2-51c9-a983-1dbc76ed99ef','Köchin'],
  ['a1.2','P3-N5','adce244a-3d95-54e9-a659-ff5bbe6d3d4a','ihre'],
  ['a1.2','P6-N4','191e6dc3-cd3d-5175-a909-9f3a0e1710ce','ihr'],
  ['a2.1','P1-N1','f30c3772-6c1e-5b19-aead-0d76a0fb3941','Enkelin'],
  ['a2.1','P7-N3','455699ac-cce9-54da-a5e9-2514020e2362','ihrer'],
  ['a2.1','P7-N6','1772672e-c093-5b45-a53c-de9844120bd1','ihr'],
  ['a2.2','P1-N10','a4c644eb-7397-572d-a8b7-16f2b394d1d2','sie'],
 ]){
  const e=exercise(level,nid,id)
  expect(e.content.correct_answer).toBe(answer)
  expect(e.content.options).toContain(answer)
  expect(JSON.stringify(e.content)).not.toMatch(/Lena|Mia|Marta/)
  expect(Object.keys(e.translations??{}).sort()).toEqual(['en','ru','tr','uk'])
 }
})
it('retains historical answer-bound character and necessary feminine salutation exercises pending version review',()=>{
 expect(exercise('a1.1','P5-N6','d4fa715e-799f-58cf-a0e1-c1798e8b08ea').content.correct_answer).toBe('Um sieben Uhr frühstückt Olena.')
 expect(exercise('b1.1','P5-N9','a054896c-401c-551d-a610-78838cc07a1c').content.correct_answer).toBe('Guten Tag, Frau Sommer. Vielen Dank für die Einladung zum Gespräch.')
 expect(node('b1.1','P5-N8').exercises[6].content).toBeDefined()
})
it('preserves B1 job answers while correcting male roles and translated agreement',()=>{
 expect(load('b1.1')).toHaveLength(7)
 const cook=exercise('b1.1','P5-N1','15519794-cebf-5696-af58-f11f373db4cf')
 expect(cook.content.question).toContain('als Koch')
 expect(cook.content.correct_answer).toBe('Berufserfahrung')
 expect(cook.translations?.ru?.task).toContain('работал')
 expect(cook.translations?.uk?.task).toContain('кухарем')
 expect(exercise('b1.1','P5-N9','73852697-e0f9-56a9-a260-7cab2b9da630').content.question).toContain('Friseur')
 const surname=exercise('a1.1','P1-N11','d85bed67-a64c-54d8-a3b0-7bac16710b5b')
 expect(surname.translations?.en?.task).toContain('himself')
})

it('keeps plural reference and the feminine possessive target while using male protagonists',()=>{
 const plural=exercise('a1.1','P2-N12','edd8e808-5cad-5663-a7d0-aea8985792ea')
 expect(plural.content.text_before).toBe('Das sind Emre und Selim. Sie ')
 expect(plural.content.correct_answer).toBe('kommen')
 expect(plural.translations?.en?.task).toContain('They come')
 expect(plural.explanation).toContain('Das ist Selim. Er kommt')
 const possessive=exercise('a1.1','P2-N11','64c4b417-52c5-5e92-a92a-d56c29b821b1')
 expect(possessive.content.text_before).toContain('Oleh')
 expect(possessive.content.text_after).toBe(' Mutter.“')
 expect(possessive.content.correct_answer).toBe('meine')
})
it('agrees with Kamil in each gendered translation and preserves the old answer-bound routine',()=>{
 const hobby=exercise('a1.1','P6-N1','1e2af35c-784c-592f-a93d-d89a5ec55fc6')
 expect(hobby.content.text_before).toBe('Kamil liest gern. Er hat viele ')
 expect(hobby.translations?.en?.task).toContain('He has')
 expect(hobby.translations?.ru?.task).toContain('У него')
 expect(hobby.translations?.uk?.task).toContain('У нього')
 expect(exercise('a1.1','P6-N3','9f376699-d050-5f02-abaa-812640943f54').translations?.tr?.task).toBe('Oleh’in romanını okuyorum.')
 const historical=exercise('a1.1','P5-N10','465e830d-bd8b-59b3-a979-965ca0399531')
 expect(historical.content.correct_answer).toBe('Sie kauft ein und kocht.')
 expect(historical.content.question).toContain('Olena ist Pflegerin')
})

it('retains family-relation inference and factual feminine answer after removing named actors',()=>{
 const e=exercise('a2.1','P1-N1','f30c3772-6c1e-5b19-aead-0d76a0fb3941')
 expect(e.content.text_before).toBe('Die Tochter eines Sohnes oder einer Tochter ist für die Großeltern ihre ')
 expect(e.content.correct_answer).toBe('Enkelin')
 expect(e.content.options).toEqual(['Nichte','Enkelin','Schwägerin'])
 expect(e.translations?.en?.task).toContain('grandparents')
 expect(e.translations?.tr?.task).toBe('Bir oğlun ya da kızın kız çocuğu, büyükanne ve büyükbabanın … olur.')
})
it('preserves grammatical family gender and agrees with named men across reviewed stories',()=>{
 const family=exercise('a1.1','P7-N8','ca2c9014-f342-5c9d-a88c-b989fd4548dd')
 expect(family.translations?.ru?.task).toBe('Куда семья поехала в субботу после обеда?')
 expect(family.translations?.uk?.task).toBe('Куди родина поїхала в суботу після обіду?')
 expect(family.content.question).toContain('Deniz und Emir')
 expect(family.content.question).toContain('Selim gekocht')
 const wish=exercise('a1.1','P7-N12','f5fd9c71-7912-5277-a6cc-c0815ec92dc1')
 expect(wish.content.question).toContain('seinen Enkel')
 expect(wish.translations?.uk?.task).toBe('Kamil дуже-дуже хоче побачити онука в Кракові. Що він каже?')
 expect(wish.translations?.en?.task).toContain('his grandson')
 expect(exercise('a1.1','P2-N10','06854c0d-e295-57b8-a7f7-b70439b1c235').translations?.ru?.task).toContain('Он родился')
 expect(exercise('a1.1','P3-N11','b2cde403-9af7-5e65-a1df-01a8f5260329').translations?.tr?.task).toContain('Kamil’in')
 expect(exercise('a1.1','P7-N12','53e0e382-9f60-5574-a29d-01727939ac9a').content.correct_answer).toBe('Sie hat ihre Schwester getroffen.')
})
