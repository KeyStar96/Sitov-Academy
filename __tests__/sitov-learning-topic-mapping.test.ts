/** @jest-environment node */
import { readFileSync } from 'node:fs'
import { learningPathSeedSchema } from '@/lib/learning-path-schema'
import { SITOV_TOPIC_MAPPING } from '@/lib/learning/sitov-topic-mapping'
const load=(level:string)=>learningPathSeedSchema.parse(JSON.parse(readFileSync(`supabase/seeds/path-${level}.json`,'utf8')))
const node=(level:string,id:string)=>load(level).flatMap(path=>path.nodes).find(n=>n.id===id)!
const frozenDrafts=JSON.parse(readFileSync('docs/handoffs/SITOV-NIGHT-2026-10-08/S2/epoch30-immutable-drafts.json','utf8')).drafts as Array<{id:string;currentExercise:{content:Record<string,unknown>}}>
const frozenExercise=(id:string)=>frozenDrafts.find(row=>row.id===id)!.currentExercise
const exercise=(level:string,nid:string,id:string)=>{
 const value=node(level,nid).exercises.find(e=>e.id===id)!
 return {...value,content:value.content as Record<string,unknown>}
}

it.each(['a1.1','a1.2','a2.1','a2.2','b1.1','b1.2','b2.1','b2.2','c1.1','c1.2'])('keeps the complete %s seed valid after character edits',level=>expect(load(level).length).toBeGreaterThan(0))
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
it('retains frozen historical answers separately from the reviewed new source revisions',()=>{
 expect(frozenExercise('d4fa715e-799f-58cf-a0e1-c1798e8b08ea').content.correct_answer).toBe('Um sieben Uhr frühstückt Olena.')
 expect(frozenExercise('a054896c-401c-551d-a610-78838cc07a1c').content.correct_answer).toBe('Guten Tag, Frau Sommer. Vielen Dank für die Einladung zum Gespräch.')
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
 const historical=frozenExercise('465e830d-bd8b-59b3-a979-965ca0399531')
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
 expect(frozenExercise('53e0e382-9f60-5574-a29d-01727939ac9a').content.correct_answer).toBe('Sie hat ihre Schwester getroffen.')
})

it('preserves singular feminine possessives and plural owners in the A1.2 character pass',()=>{
 const grammar=exercise('a1.2','P3-N4','0c91a906-804e-5c15-af92-dc19da646509')
 expect(grammar.content.text_before).toContain('sie (Singular)')
 expect(grammar.content.text_after).toBe(' Ohren tun weh.')
 expect(grammar.content.correct_answer).toBe('Ihre')
 expect(grammar.content.options).toEqual(['Ihre','Seine','Ihr'])
 const couple=exercise('a2.1','P1-N14','a0550519-2d69-5b97-acc6-5f6ece56d41f')
 expect(couple.content.question).toBe('Leon und Tom sind kein Paar mehr, aber sie sind noch nicht geschieden. Jeder hat eine eigene Wohnung und wohnt dort allein. Sie leben ___')
 expect(couple.translations?.uk?.task).toContain('Вони живуть')
})
it('agrees in the excuse note and masculine neighbour translations while retaining frozen historical options',()=>{
 const excuse=exercise('a1.1','P7-N10','23a78719-5c1a-5510-acee-ac9e9a366d3a')
 expect(excuse.content.text_before).toContain('Lieber Herr Roth')
 expect(excuse.translations?.ru?.task).toContain('я болен')
 expect(excuse.translations?.uk?.task).toContain('я хворий')
 const neighbour=exercise('a2.1','P2-N10','ae5a3641-ac44-5a38-a4dc-f2c696f5b173')
 expect(neighbour.content.text_after).toBe(' von deinem Nachbarn Milan')
 expect(neighbour.translations?.ru?.task).toContain('твоего соседа')
 expect(frozenExercise('b19c26ba-95e9-57d1-aeb6-56b014d795a4').content.options).toContain('Ich war zehn Jahre Chefin.')
 expect(frozenExercise('76ea54c1-c380-5b3a-a898-6a2039353f38').content.correct_answer).toBe('Dann habe ich meine Schwester angerufen.')
})

it('preserves parcel noun gender, plural wedding actors and the actual feminine dative target',()=>{
 const parcel=exercise('a2.1','P7-N14','de4c541d-0c15-55af-ad12-849c1df6fbcf')
 expect(parcel.content.question).toContain('Milan und Tim')
 expect(parcel.translations?.ru?.task).toContain('Она от них.')
 expect(parcel.translations?.uk?.task).toContain('Вона від них.')
 const wedding=exercise('a2.1','P7-N12','0b08124a-24e9-5f90-af63-3b93e609b05f')
 expect(wedding.content.question).toContain('Der Bräutigam')
 expect(wedding.content.question).toContain('11.40 Uhr: Sie haben Ja gesagt!')
 const grammar=exercise('a2.1','P7-N2','444554eb-8c8a-5259-a110-9b64a78587af')
 expect(grammar.content.question).toContain('sie (Singular)')
 expect(grammar.content.correct_answer).toBe('ihrem')
 expect(grammar.content.target_form).toEqual(['ihrem'])
})
it('preserves clothing grammar and history bound to a feminine conjugation target',()=>{
 const dress=exercise('a2.2','P2-N3','ed73de2b-b43c-5aa2-a585-37658f5f2702')
 expect(dress.content.question).toBe('Leon kauft ein ___ Kleid.')
 expect(dress.content.correct_answer).toBe('rotes')
 const historical=frozenExercise('33caadca-d684-50f1-a6ac-a21cffb316af')
 expect(historical.content.target_form).toEqual(['sie lässt'])
 expect(historical.content.question).toContain('Mia')
})

it('makes the separation and reflexive restrictions visible without changing historical answer sets',()=>{
 const couple=exercise('a2.1','P1-N14','a0550519-2d69-5b97-acc6-5f6ece56d41f')
 expect(couple.content.question).toContain('Jeder hat eine eigene Wohnung und wohnt dort allein.')
 expect(couple.content.options).toEqual(['getrennt','in einer Großfamilie','zusammen'])
 expect(couple.translations?.en?.task).toContain('Each has his own flat')
 const wish=exercise('a2.2','P7-N6','0cf27ee0-2a47-5d17-aea7-ba65b50f1cfc')
 expect(wish.content.instruction).toBe('Wähle das passende Reflexivpronomen.')
 expect(wish.content.options).toEqual(['sie','ihr','sich'])
 expect(wish.translations?.tr?.instruction).toContain('dönüşlülük')
})
it('scopes possessive rules correctly and keeps factual feminine vocabulary while repairing male examples',()=>{
 const owner=exercise('a1.2','P3-N4','0c91a906-804e-5c15-af92-dc19da646509')
 expect(owner.translations?.ru?.explanation).toContain('В третьем лице единственного числа')
 expect(owner.content.correct_answer).toBe('Ihre')
 const kinship=exercise('a2.1','P1-N1','f30c3772-6c1e-5b19-aead-0d76a0fb3941')
 expect(kinship.hint).toContain('Großeltern')
 expect(kinship.content.correct_answer).toBe('Enkelin')
 const school=exercise('a2.1','P6-N12','dda7a7a2-ab0f-5403-ab7b-b61934093f6f')
 expect(school.translations?.uk?.explanation).toContain('Моїм улюбленим учителем був')
 expect(school.explanation).toContain('Mein Lieblingslehrer war Herr Lindner.')
})

it('adopts reviewed future keys while retaining old full-object evidence and alternate sentence orders',()=>{
 expect(exercise('a1.1','P5-N6','d4fa715e-799f-58cf-a0e1-c1798e8b08ea').content.accepted_answers).toEqual(['Um sieben Uhr frühstückt Oleh.','Oleh frühstückt um sieben Uhr.'])
 expect(exercise('b1.1','P5-N9','a054896c-401c-551d-a610-78838cc07a1c').content.correct_answer).toBe('Guten Tag, Herr Sommer. Vielen Dank für die Einladung zum Gespräch.')
 const routine=exercise('a1.1','P5-N10','465e830d-bd8b-59b3-a979-965ca0399531')
 expect(routine.content.question).toContain('am Nachmittag nach der Arbeit?')
 expect(routine.content.correct_answer).toBe('Er kauft ein und kocht.')
 expect(exercise('a1.1','P7-N12','53e0e382-9f60-5574-a29d-01727939ac9a').content.correct_answer).toBe('Er hat seinen Bruder getroffen.')
 expect(exercise('a1.2','P1-N5','b19c26ba-95e9-57d1-aeb6-56b014d795a4').content.options).toContain('Ich war zehn Jahre Chef.')
 expect(exercise('a2.1','P1-N10','76ea54c1-c380-5b3a-a898-6a2039353f38').content.correct_answer).toBe('Dann habe ich meinen Bruder angerufen.')
 expect(exercise('a2.2','P6-N7','33caadca-d684-50f1-a6ac-a21cffb316af').content.target_form).toEqual(['er lässt'])
})
it('resolves actual practice companions, preserves factual daughter grammar and keeps tests card-free',()=>{
 const phone=exercise('a1.1','P1-N11','f2d51b6a-0afb-5bcb-a321-06b37b225082')
 expect(phone.explanation_card).toBe(node('a1.1','P1-N8').merkkarte?.card)
 expect(node('a1.1','P1-N8').merkkarte?.rule).toContain('Ist Herr Lindner da?')
 expect(node('a1.1','P1-N11').merkkarte).toBeUndefined()
 expect(exercise('a1.1','P2-N3','5df3a866-867b-5221-a586-6aa88b8c9cda').content.correct_answer).toBe('Das sind Samir und Leon.')
 const daughter=exercise('a1.1','P2-N3','2c55dd12-c807-51ee-a9cb-63dd534f46be')
 expect(daughter.content.text_before).toBe('Das weibliche Kind eines Vaters ist seine ')
 expect(daughter.content.correct_answer).toBe('Tochter')
 expect(daughter.content.options).toEqual(['Sohn','Tochter','Mutter'])
 expect(node('a2.1','P1-N6').merkkarte?.examples?.[0]).toBe('Ich habe gestern meinen Onkel angerufen.')
 const reflexive=exercise('a2.1','P5-N3','46a8c3ac-1525-50c6-ad75-8f4d184e4bfc')
 expect(reflexive.content.options).toEqual(['Er schminkt ihm.','Er schminkt ihn sich.','Er schminkt sich.'])
 expect(reflexive.content.correct_answer).toBe('Er schminkt sich.')
})
