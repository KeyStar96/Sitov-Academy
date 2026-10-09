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
