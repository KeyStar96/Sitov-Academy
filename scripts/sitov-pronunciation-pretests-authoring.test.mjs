import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { sitovReadAuthoringSources,sitovValidatePretestDrafts,sitovHash,sitovPublicPretestAudioAliases,sitovValidatePretestAudioAliases } from './sitov-pronunciation-pretests-authoring.mjs'
const sources=await sitovReadAuthoringSources(),manifest=JSON.parse(await readFile('supabase/seeds/sitov-pronunciation-pretests-2026-10-08.json','utf8'))
const validate=mutate=>{const copy=structuredClone(manifest);mutate(copy);return sitovValidatePretestDrafts(copy,sources)}
test('exact current repository inventory: 60 active plus 89 retained inactive; nine actual source bodies/hashes',()=>{
 assert.equal(sources.rows.length,149);assert.equal(manifest.inventory.length,60);assert.equal(manifest.inactiveLegacy.length,89)
 for(const level of ['A1.1','A1.2','A2.1','A2.2','B1.1','B1.2'])assert.equal(manifest.inventory.filter(r=>r.level===level).length,10)
 assert.deepEqual(manifest.drafts.map(d=>d.textId),['6d2f8e95-6f87-510b-b244-0631733f8ff9','d7280df2-9f87-5729-bd8f-19c9b47c9488','25bdcac1-9272-5294-893f-c2063b4838b9','b73f6228-c6c7-591b-ac83-2bae82a3b163','fd1297a1-999f-5759-b0d9-1f77c381d114','a218b88e-9369-5472-b5fe-34c99d1ced76','15c29bec-e14e-5f27-8f12-ea9e45145e97','610e3f81-2a6f-5794-bb78-ef06cb7ece17','c8055fa7-7bb0-5027-9f3e-13d001eb728b'])
 for(const draft of manifest.drafts){const source=sources.rows.find(r=>r.id===draft.textId);assert.equal(draft.textVersion,sitovHash(source.text));assert.equal(draft.active,false);assert.equal(draft.definition.tasks.length,24);assert.equal(draft.definition.reviewForms[0].questionIds.length,12);assert.equal(draft.definition.reviewForms[1].questionIds.length,12)}
 assert.deepEqual(sitovValidatePretestDrafts(manifest,sources),[])
})
const negatives=[
 ['published/global/private mismatch',m=>{m.active=true;m.private=false}],
 ['foreign draft source',m=>{m.drafts[0].textId=m.inactiveLegacy[0].textId}],
 ['changed raw text fingerprint',m=>{m.drafts[0].textVersion='0'.repeat(64)}],
 ['cross-text source span',m=>{m.drafts[0].definition.tasks[0].sourceSpans=m.drafts[1].definition.tasks[0].sourceSpans}],
 ['offset mutation',m=>{m.drafts[0].definition.tasks[0].sourceSpans[0].start++}],
 ['missing essential matrix',m=>{m.drafts[0].definition.competencies.pop()}],
 ['unassessed invented matrix unit',m=>{m.drafts[3].definition.competencies[0].languageUnits.push('invented generic skill')}],
 ['foreign assessment unit',m=>{m.drafts[4].definition.tasks[0].assessmentUnit='foreign lexical skill'}],
 ['missing form IDs',m=>{delete m.drafts[5].definition.reviewForms[1].questionIds}],
 ['false human review of author-only new draft',m=>{m.drafts[3].review.humanReview=true}],
 ['short one-form-only pool',m=>{m.drafts[0].definition.tasks=m.drafts[0].definition.tasks.filter(q=>!q.id.endsWith('words.q6'))}],
 ['invented optional mapping',m=>{m.drafts[0].definition.competencies[0].mapping.topicIds=['sitov.topic.invented']}],
 ['no mapping and no explicit gap',m=>{m.drafts[0].definition.competencies[0].mapping={topicIds:[]}}],
 ['no item rationale',m=>{m.drafts[0].definition.tasks[0].rationaleDe=''}],
 ['missing correct option',m=>{m.drafts[0].definition.tasks[0].correctOptionId='sitov.foreign'}],
 ['duplicate option meaning/text',m=>{m.drafts[0].definition.tasks[0].options[1].textDe=m.drafts[0].definition.tasks[0].options[0].textDe}],
 ['generic repeated item with new IDs',m=>{const a=m.drafts[0].definition.tasks[0],b=m.drafts[0].definition.tasks[1];b.promptDe=a.promptDe;b.equivalenceKey='changed-id';b.assessmentUnit='changed-unit'}],
 ['equivalent paraphrase keeps assessed unit',m=>{const a=m.drafts[0].definition.tasks[0],b=m.drafts[0].definition.tasks[1];b.assessmentUnit=a.assessmentUnit;b.equivalenceKey=a.equivalenceKey;b.promptDe='Wähle dieselbe Bedeutung.'}],
 ['retake shares question',m=>{m.drafts[0].definition.reviewForms[1].questionIds[0]=m.drafts[0].definition.reviewForms[0].questionIds[0]}],
 ['unbalanced form with foreign task',m=>{m.drafts[0].definition.reviewForms[0].questionIds[0]=m.drafts[1].definition.tasks[0].id}],
 ['missing omitted-category justification',m=>{m.drafts[0].definition.omittedCategories[0].reasonDe=''}],
 ['inventory duplicates/missing source',m=>{m.inventory[1]=m.inventory[0]}],
 ['false coverage or completed review',m=>{m.coverage.authored=60;m.drafts[0].review.status='teacher_approved'}],
]
for(const [name,mutate] of negatives)test('reject '+name,()=>assert.ok(validate(mutate).length>0))
test('no public task field contains private keys, rationale, evidence, or complete stored source',()=>{
 for(const draft of manifest.drafts)for(const task of draft.definition.tasks){const publicTask={id:task.id,competencyId:task.competencyId,kind:task.kind,promptDe:task.promptDe,fragmentDe:task.fragmentDe,options:task.options};assert.equal(Object.hasOwn(publicTask,'correctOptionId'),false);assert.equal(Object.hasOwn(publicTask,'sourceSpans'),false);assert.equal(Object.hasOwn(publicTask,'rationaleDe'),false);assert.ok(!JSON.stringify(publicTask).includes(sources.rows.find(r=>r.id===draft.textId).text))}
})

test('new sources require their actual distinct pronoun, direction/local case and separable-verb evidence',()=>{
 const [neighbor,park,room]=manifest.drafts.slice(3,6)
 assert.equal(manifest.coverage.authored,9);assert.equal(manifest.coverage.pending,51)
 for(const draft of [neighbor,park,room]){assert.equal(draft.review.status,'author_checked_independent_review_pending');assert.equal(draft.review.humanReview,false);assert.equal(draft.review.calibrationStatus,'pending');assert.equal(draft.definition.competencies.length,4);assert.equal(new Set(draft.definition.tasks.map(q=>q.assessmentUnit)).size,24)}
 const key=(draft,suffix)=>{const q=draft.definition.tasks.find(q=>q.id.endsWith(suffix));return q.options.find(o=>o.id===q.correctOptionId).textDe}
 assert.equal(key(neighbor,'nominal.q5'),'Die höflich angesprochene Person.')
 assert.equal(key(neighbor,'nominal.q6'),'Den zuvor genannten Leon.')
 assert.ok(!neighbor.definition.omittedCategories.some(c=>c.category==='indirect_objects'))
 assert.equal(key(park,'nominal.q1'),'den');assert.equal(key(park,'nominal.q2'),'einer')
 assert.equal(key(room,'verbs.q5'),'anmachen');assert.equal(key(room,'syntax.q5'),'die Lampe an')
 assert.ok(!room.definition.omittedCategories.some(c=>c.category==='separable_verbs'))
 assert.ok(room.definition.competencies.find(c=>c.category==='verb_forms').mapping.topicIds.includes('sitov.topic.trennbare-verben'))
 for(const draft of [neighbor,park,room])for(const q of draft.definition.tasks)assert.ok(!q.options.some(o=>/\b(Frau|Nachbarin|Freundin|Lehrerin|Schülerin)\b/u.test(o.textDe)))
})

test('audio alias validation rejects missing, changed, extra and private spoken fields',()=>{
 const expected=sitovPublicPretestAudioAliases(manifest),first=Object.keys(expected)[0]
 assert.deepEqual(sitovValidatePretestAudioAliases(manifest,expected),[])
 const missing={...expected};delete missing[first];assert.ok(sitovValidatePretestAudioAliases(manifest,missing).length)
 assert.ok(sitovValidatePretestAudioAliases(manifest,{...expected,[first]:'changed'}).length)
 assert.ok(sitovValidatePretestAudioAliases(manifest,{...expected,'sitov.private.rationale':manifest.drafts[3].definition.tasks[0].rationaleDe}).length)
 const publicCopy=structuredClone(manifest);publicCopy.drafts[3].definition.tasks[0].rationaleDe='Private changed rationale';publicCopy.drafts[3].definition.tasks[0].correctOptionId='sitov.private.key';assert.deepEqual(sitovPublicPretestAudioAliases(publicCopy),expected)
})

test('actually absent nominal category accepted only with explicit reason and matching balanced forms',()=>{
 const errors=validate(m=>{m.drafts[0].review={status:'author_checked_teacher_review_pending',reviewer:'sitov.fixture.author',notesDe:'Synthetic category absence shape, pending independent review.'};const d=m.drafts[0].definition,core=d.competencies.find(c=>c.category==='nominal_forms'),ids=new Set(d.tasks.filter(q=>q.competencyId===core.id).map(q=>q.id));d.competencies=d.competencies.filter(c=>c.id!==core.id);d.tasks=d.tasks.filter(q=>!ids.has(q.id));for(const f of d.reviewForms)f.questionIds=f.questionIds.filter(id=>!ids.has(id));d.omittedCategories.push({category:'nominal_forms',reasonDe:'Synthetic validator case: source category absence must be checked by an independent editor.'})})
 assert.deepEqual(errors,[])
})
test('version-qualified independent review shape allowed; self-review or stale definition evidence rejected',()=>{
 const setReview=m=>{const draft=m.drafts[0];draft.review={status:'independent_approved',reviewer:'sitov.fixture.independent.editor',authorIdentity:'sitov.fixture.author',notesDe:'Synthetic provenance shape only, not an actual teaching approval.',textVersion:draft.textVersion,definitionContentHash:sitovHash(JSON.stringify(draft.definition)),documentRef:'sitov.editorial.review.fixture',documentSha256:'a'.repeat(64),reviewedAt:'2026-10-08T00:00:00Z'}}
 assert.deepEqual(validate(setReview),[])
 assert.ok(validate(m=>{setReview(m);m.drafts[0].review.authorIdentity=m.drafts[0].review.reviewer}).length)
 assert.ok(validate(m=>{setReview(m);m.drafts[0].review.definitionContentHash='0'.repeat(64)}).length)
})

test('all 864 German audio aliases match public fields; original first288 and review remain frozen',async()=>{
 const frozen=JSON.parse(await readFile('supabase/seeds/sitov-pronunciation-pretest-audio-2026-10-08.json','utf8')),extracted={}
 for(const draft of manifest.drafts)for(const q of draft.definition.tasks){const prefix=`sitov-pretest:${draft.textId}:${q.id}`;extracted[prefix+':prompt']=q.promptDe;if(q.fragmentDe?.trim())extracted[prefix+':fragment']=q.fragmentDe;for(const option of q.options)extracted[prefix+':'+option.id]=option.textDe}
 assert.equal(Object.keys(extracted).length,864);assert.deepEqual(extracted,frozen);assert.equal(new Set(Object.values(Object.fromEntries(Object.entries(frozen).slice(0,576)))).size,486)
 const first=Object.fromEntries(Object.entries(frozen).slice(0,288));assert.equal(Object.keys(first).length,288);assert.equal(new Set(Object.values(first)).size,253)
 assert.equal(sitovHash(JSON.stringify(first)),'9dbf9e8b9c3ec4b6858cfe41d7626ad145d8f57c5fef5f405fe95c6a3fa3caff')
 assert.equal(sitovHash(JSON.stringify(manifest.drafts.slice(0,3))),'64ef9ff63db660b92316c30d41b47eced8d84855e9ae3b68d071759169f75f45')
 for(const draft of manifest.drafts)for(const q of draft.definition.tasks){assert.ok(!Object.values(frozen).includes(q.rationaleDe));assert.ok(!Object.values(frozen).includes(q.id));assert.ok(!Object.values(frozen).includes(q.correctOptionId))}
 const record=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/first3-editorial-review-epoch10.json','utf8'));assert.equal(record.humanReview,false)
 for(const draft of manifest.drafts.slice(0,3)){assert.equal(draft.review.reviewerKind,'independent_agent_editorial_review');assert.equal(draft.review.humanReview,false);assert.equal(draft.review.status,'independent_editorial_checked_draft_only');assert.equal(draft.review.calibrationStatus,'pending');assert.equal(draft.review.definitionContentHash,record.approvedEditorialDrafts.find(r=>r.textId===draft.textId).definitionContentHash)}
 assert.ok(validate(m=>{m.drafts[0].review.humanReview=true}).length)
 assert.ok(validate(m=>{m.drafts[0].review.definitionContentHash='0'.repeat(64)}).length)
})


test('first six whole draft records and576 aliases remain exact; new reference queue has actual raw bodies',async()=>{
 assert.equal(sitovHash(JSON.stringify(manifest.drafts.slice(0,6))),'52af41c01a3b588ddbcc38e7ff43d4f0b6c9b12d1debe12335e2f293f387054d')
 const audio=JSON.parse(await readFile('supabase/seeds/sitov-pronunciation-pretest-audio-2026-10-08.json','utf8'))
 assert.equal(sitovHash(JSON.stringify(Object.fromEntries(Object.entries(audio).slice(0,576)))),'69fa19b3b1851f749b16f80e85f1d32aa87399095b8b79155fe42b4480519d4e')
 const references=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/batch7-9-reference-audio-input.json','utf8'));assert.equal(Object.keys(references).length,3)
 for(const d of manifest.drafts.slice(6)){assert.equal(references['sitov-pretest-reference:'+d.textId],sources.rows.find(r=>r.id===d.textId).text);assert.equal(sitovHash(references['sitov-pretest-reference:'+d.textId]),d.textVersion)}
})
test('new source-specific seller/family/route keys and evidence reflect actual revised passages',()=>{
 const [shop,family,route]=manifest.drafts.slice(6),key=(d,suffix)=>{const q=d.definition.tasks.find(q=>q.id.endsWith(suffix));return q.options.find(o=>o.id===q.correctOptionId).textDe}
 for(const d of [shop,family,route]){assert.equal(d.definition.competencies.length,4);assert.equal(new Set(d.definition.tasks.map(q=>q.assessmentUnit)).size,24);assert.equal(d.review.status,'author_checked_independent_review_pending');assert.equal(d.review.authorIdentity,d.review.reviewer);assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.active,false);assert.ok(!Object.hasOwn(d,'approval'));assert.ok(!Object.hasOwn(d,'preparedAudioProof'))}
 assert.equal(key(shop,'nominal.q5'),'Den Sprecher, dem das Brot gezeigt wird.');assert.equal(key(shop,'syntax.q3'),'Der Preis des Brotes beträgt zwei Euro.');assert.equal(key(shop,'nominal.q6'),'Meine')
 assert.equal(key(family,'nominal.q2'),'meiner');assert.equal(key(family,'nominal.q4'),'Den Onkel Mark.');assert.equal(key(family,'syntax.q4'),'Der Vater Oleg.');assert.equal(key(family,'words.q4'),'20 Jahre.')
 assert.equal(key(route,'verbs.q5'),'aussteigen');assert.equal(key(route,'nominal.q2'),'dem');assert.equal(key(route,'nominal.q5'),'der');assert.equal(key(route,'syntax.q1'),'Der Sprecher geht um acht weg; der Kurs beginnt um neun.')
 assert.ok(route.definition.competencies.find(c=>c.category==='verb_forms').mapping.topicIds.includes('sitov.topic.trennbare-verben'))
 for(const d of [shop,family,route])for(const q of d.definition.tasks)assert.ok(!q.options.some(o=>/\b(Frau|Nachbarin|Freundin|Lehrerin|Schülerin|Mutter|Schwester)\b/u.test(o.textDe)))
})
