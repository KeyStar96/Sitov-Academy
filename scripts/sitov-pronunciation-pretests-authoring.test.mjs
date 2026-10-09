import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { sitovReadAuthoringSources,sitovValidatePretestDrafts,sitovHash,sitovPublicPretestAudioAliases,sitovValidatePretestAudioAliases } from './sitov-pronunciation-pretests-authoring.mjs'
const sources=await sitovReadAuthoringSources(),currentManifest=JSON.parse(await readFile('supabase/seeds/sitov-pronunciation-pretests-2026-10-08.json','utf8'))
const sitovEpoch34=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch34-pools13-15-author-review.json','utf8'))
const sitovAllAudio=JSON.parse(await readFile('supabase/seeds/sitov-pronunciation-pretest-audio-2026-10-08.json','utf8'))
const sitovFrozenAudio12=Object.fromEntries(Object.entries(sitovAllAudio).slice(0,1152))
const sitovDelta35=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch35-option-diversity-delta.json','utf8'))
const sitovAuthor35=structuredClone(currentManifest)
for(const row of sitovDelta35.pools)sitovAuthor35.drafts.find(d=>d.textId===row.textId).review=row.currentReview
const sitovBefore35=structuredClone(sitovAuthor35)
for(const row of sitovDelta35.questions){
 const q=sitovBefore35.drafts.find(d=>d.textId===row.textId).definition.tasks.find(q=>q.id===row.questionId)
 q.options=row.previousOptions;q.correctOptionId=row.previousCorrectOptionId
}
for(const row of sitovDelta35.pools)sitovBefore35.drafts.find(d=>d.textId===row.textId).review=row.previousReview
const sitovBeforeAudio35={...sitovFrozenAudio12}
for(const row of sitovDelta35.questions)for(const alias of row.previousAliasEntries)sitovBeforeAudio35[alias.key]=alias.textDe

// Explicit frozen12 projection preserves every previous record/review/hash; only next3 inventory statuses/counts revert.
const originalManifest=structuredClone(currentManifest)
originalManifest.drafts=originalManifest.drafts.slice(0,12);originalManifest.coverage.authored=12;originalManifest.coverage.pending=48
for(const row of originalManifest.inventory)if(!originalManifest.drafts.some(d=>d.textId===row.textId))row.coverageStatus='pending'
const manifest=structuredClone(originalManifest)
// Reconstruct the exact frozen pre-mapping record before applying historical task repairs.
const sitovMapping33=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch33-same-level-mapping-delta.json','utf8'))
// Reconstruct S3's exact pending-review state; current M provenance is checked separately below.
for(const row of sitovMapping33.changedPools)manifest.drafts.find(d=>d.textId===row.textId).review=row.currentReview
const sitovBeforeMapping=structuredClone(manifest)
for(const row of sitovMapping33.changedPools){
 const draft=sitovBeforeMapping.drafts.find(d=>d.textId===row.textId)
 draft.review=row.previousReview
 for(const core of row.cores)draft.definition.competencies.find(c=>c.id===core.coreId).mapping=core.previousMapping
}
// Historical review/hash assertions below use this explicit reconstruction, never a new baseline.
const sitovRepair24=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/first9-visible-context-repair-delta-epoch24.json','utf8'))
const sitovFinal25=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/adjective-direction-final-delta-epoch25.json','utf8'))
const sitovBeforeRepair=structuredClone(sitovBeforeMapping)
for(const row of sitovRepair24.changedQuestions){const draft=sitovBeforeRepair.drafts.find(d=>d.textId===row.textId),i=draft.definition.tasks.findIndex(q=>q.id===row.questionId);draft.definition.tasks[i]=row.previousTask}
for(const pool of sitovRepair24.changedPools)sitovBeforeRepair.drafts.find(d=>d.textId===pool.textId).review=pool.previousReview
const sitovPreviousAliases=new Map(sitovRepair24.changedAliases.map(row=>[row.key,row.previousTextDe]))
const sitovBeforeRepairAliases=audio=>Object.fromEntries(Object.entries(audio).map(([key,value])=>[key,sitovPreviousAliases.get(key)??value]))
const validate=mutate=>{const copy=structuredClone(manifest);mutate(copy);return sitovValidatePretestDrafts(copy,sources)}
test('exact current repository inventory: 60 active plus 89 retained inactive; twelve actual source bodies/hashes',()=>{
 assert.equal(sources.rows.length,149);assert.equal(manifest.inventory.length,60);assert.equal(manifest.inactiveLegacy.length,89)
 for(const level of ['A1.1','A1.2','A2.1','A2.2','B1.1','B1.2'])assert.equal(manifest.inventory.filter(r=>r.level===level).length,10)
 assert.deepEqual(manifest.drafts.map(d=>d.textId),['6d2f8e95-6f87-510b-b244-0631733f8ff9','d7280df2-9f87-5729-bd8f-19c9b47c9488','25bdcac1-9272-5294-893f-c2063b4838b9','b73f6228-c6c7-591b-ac83-2bae82a3b163','fd1297a1-999f-5759-b0d9-1f77c381d114','a218b88e-9369-5472-b5fe-34c99d1ced76','15c29bec-e14e-5f27-8f12-ea9e45145e97','610e3f81-2a6f-5794-bb78-ef06cb7ece17','c8055fa7-7bb0-5027-9f3e-13d001eb728b','4a6f7008-9439-5c6e-9d60-113e8945f800','1b5c02d4-7217-56e0-8abb-906c20784e30','add5b212-15af-55b5-b224-6282b5c39c13'])
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
 ['false human review of independent agent-reviewed draft',m=>{m.drafts[3].review.humanReview=true}],
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
 const manifest=sitovBeforeMapping

 const [neighbor,park,room]=manifest.drafts.slice(3,6)
 assert.equal(manifest.coverage.authored,12);assert.equal(manifest.coverage.pending,48)
 for(const draft of [neighbor,park,room]){assert.equal(draft.review.status,'independent_editorial_checked_draft_only');assert.equal(draft.review.humanReview,false);assert.equal(draft.review.calibrationStatus,'pending');assert.equal(draft.definition.competencies.length,4);assert.equal(new Set(draft.definition.tasks.map(q=>q.assessmentUnit)).size,24)}
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

test('all 1152 German audio aliases match public fields; original first288 and review remain frozen',async()=>{
 const manifest=sitovBeforeMapping

 const frozen=sitovFrozenAudio12,extracted={}
 for(const draft of manifest.drafts)for(const q of draft.definition.tasks){const prefix=`sitov-pretest:${draft.textId}:${q.id}`;extracted[prefix+':prompt']=q.promptDe;if(q.fragmentDe?.trim())extracted[prefix+':fragment']=q.fragmentDe;for(const option of q.options)extracted[prefix+':'+option.id]=option.textDe}
 assert.equal(Object.keys(extracted).length,1152);assert.deepEqual(extracted,frozen);assert.equal(new Set(Object.values(Object.fromEntries(Object.entries(sitovBeforeRepairAliases(frozen)).slice(0,576)))).size,486)
 const first=Object.fromEntries(Object.entries(frozen).slice(0,288));assert.equal(Object.keys(first).length,288);assert.equal(new Set(Object.values(first)).size,253)
 assert.equal(sitovHash(JSON.stringify(first)),'9dbf9e8b9c3ec4b6858cfe41d7626ad145d8f57c5fef5f405fe95c6a3fa3caff')
 assert.equal(sitovHash(JSON.stringify(manifest.drafts.slice(0,3))),'64ef9ff63db660b92316c30d41b47eced8d84855e9ae3b68d071759169f75f45')
 for(const draft of manifest.drafts)for(const q of draft.definition.tasks){assert.ok(!Object.values(frozen).includes(q.rationaleDe));assert.ok(!Object.values(frozen).includes(q.id));assert.ok(!Object.values(frozen).includes(q.correctOptionId))}
 const record=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/first3-editorial-review-epoch10.json','utf8'));assert.equal(record.humanReview,false)
 for(const draft of manifest.drafts.slice(0,3)){assert.equal(draft.review.reviewerKind,'independent_agent_editorial_review');assert.equal(draft.review.humanReview,false);assert.equal(draft.review.status,'independent_editorial_checked_draft_only');assert.equal(draft.review.calibrationStatus,'pending');assert.equal(draft.review.definitionContentHash,record.approvedEditorialDrafts.find(r=>r.textId===draft.textId).definitionContentHash)}
 assert.ok(validate(m=>{m.drafts[0].review.humanReview=true}).length)
 assert.ok(validate(m=>{m.drafts[0].review=structuredClone(sitovBeforeMapping.drafts[0].review)}).some(error=>error.endsWith('independent exact-version review provenance required')))
})


test('original first6 records/576aliases reconstruct exactly after authorized repairs; actual raw references retained',async()=>{
 assert.equal(sitovHash(JSON.stringify(sitovBeforeRepair.drafts.slice(0,6))),'52af41c01a3b588ddbcc38e7ff43d4f0b6c9b12d1debe12335e2f293f387054d')
 const audio=sitovFrozenAudio12
 assert.equal(sitovHash(JSON.stringify(Object.fromEntries(Object.entries(sitovBeforeRepairAliases(audio)).slice(0,576)))),'69fa19b3b1851f749b16f80e85f1d32aa87399095b8b79155fe42b4480519d4e')
 const references=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/batch7-9-reference-audio-input.json','utf8'));assert.equal(Object.keys(references).length,3)
 for(const d of manifest.drafts.slice(6,9)){assert.equal(references['sitov-pretest-reference:'+d.textId],sources.rows.find(r=>r.id===d.textId).text);assert.equal(sitovHash(references['sitov-pretest-reference:'+d.textId]),d.textVersion)}
})
test('new source-specific seller/family/route keys and evidence reflect actual revised passages',()=>{
 const manifest=sitovBeforeMapping

 const [shop,family,route]=manifest.drafts.slice(6,9),key=(d,suffix)=>{const q=d.definition.tasks.find(q=>q.id.endsWith(suffix));return q.options.find(o=>o.id===q.correctOptionId).textDe}
 for(const d of [shop,family,route]){assert.equal(d.definition.competencies.length,4);assert.equal(new Set(d.definition.tasks.map(q=>q.assessmentUnit)).size,24);assert.equal(d.review.status,'independent_editorial_checked_draft_only');assert.notEqual(d.review.authorIdentity,d.review.reviewer);assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.active,false);assert.ok(!Object.hasOwn(d,'approval'));assert.ok(!Object.hasOwn(d,'preparedAudioProof'))}
 assert.equal(key(shop,'nominal.q5'),'Den Sprecher, dem das Brot gezeigt wird.');assert.equal(key(shop,'syntax.q3'),'Der Preis des Brotes beträgt zwei Euro.');assert.equal(key(shop,'nominal.q6'),'Meine')
 assert.equal(key(family,'nominal.q2'),'meiner');assert.equal(key(family,'nominal.q4'),'Den Onkel Mark.');assert.equal(key(family,'syntax.q4'),'Der Vater Oleg.');assert.equal(key(family,'words.q4'),'20 Jahre.')
 assert.equal(key(route,'verbs.q5'),'aussteigen');assert.equal(key(route,'nominal.q2'),'dem');assert.equal(key(route,'nominal.q5'),'der');assert.equal(key(route,'syntax.q1'),'Der Sprecher geht um acht weg; der Kurs beginnt um neun.')
 assert.ok(route.definition.competencies.find(c=>c.category==='verb_forms').mapping.topicIds.includes('sitov.topic.trennbare-verben'))
 for(const d of [shop,family,route])for(const q of d.definition.tasks)assert.ok(!q.options.some(o=>/\b(Frau|Nachbarin|Freundin|Lehrerin|Schülerin|Mutter|Schwester)\b/u.test(o.textDe)))
})

test('only M-confirmed33 repairs change first9; original baseline and final10–12 proof remain exact',async()=>{
 const manifest=sitovBeforeMapping

 const finalReviewRaw=await readFile('docs/releases/evidence/sitov-night-2026-10-08/pretest-first9-final-context-review.json','utf8'),finalReview=JSON.parse(finalReviewRaw)
 assert.equal(sitovHash(finalReviewRaw),'f8b0b262b11aeaf47ead7f591cafd166d7cc60979ee21abe1d1f4a1b299ebf12');assert.equal(finalReview.rows.length,6);assert.equal(finalReview.publicationAuthorized,false)
 for(const d of manifest.drafts.slice(3,9)){const row=finalReview.rows.find(r=>r.textId===d.textId);assert.equal(d.review.status,'independent_editorial_checked_draft_only');assert.equal(d.review.textVersion,row.textVersion);assert.equal(d.review.definitionContentHash,row.definitionContentHash);assert.equal(d.review.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(d.review.documentRef,finalReview.documentRef);assert.equal(d.review.documentSha256,sitovHash(finalReviewRaw));assert.equal(d.review.reviewedAt,finalReview.reviewedAt);assert.equal(d.review.reviewer,finalReview.reviewer);assert.equal(d.review.reviewerKind,finalReview.reviewerKind);assert.equal(d.review.authorIdentity,finalReview.authorIdentity);assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending')}
 const master=JSON.parse(await readFile(sitovRepair24.masterConfirmedFindingsRef,'utf8'))
 assert.equal(sitovHash(await readFile(sitovRepair24.masterConfirmedFindingsRef,'utf8')),sitovRepair24.masterConfirmedFindingsSha256)
 assert.deepEqual([...sitovRepair24.changedQuestions.map(r=>r.questionId)].sort(),master.rows.filter(r=>r.result!=='M_context_only_no_additional_blocker_found').map(r=>r.questionId).sort())
 assert.equal(sitovFinal25.questionId,'sitov.pretest.a11-05.syntax.q5');assert.equal(sitovFinal25.currentTask.promptDe,'Übung: »Im Gras spielt ein kleiner Hund.« Welches Wort wird durch »kleiner« genauer beschrieben?')
 assert.deepEqual(sitovFinal25.previousTask,sitovRepair24.changedQuestions.find(r=>r.questionId===sitovFinal25.questionId).currentTask)
 assert.deepEqual({...sitovFinal25.currentTask,promptDe:sitovFinal25.previousTask.promptDe},sitovFinal25.previousTask)
 assert.equal(sitovHash(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/first9-visible-context-repair-delta-epoch24.json','utf8')),sitovFinal25.historicalEpoch24DeltaSha256)
 assert.equal(sitovRepair24.changedQuestions.length,33);assert.equal(sitovRepair24.changedAliases.length,39);assert.equal(sitovRepair24.correctOptionIdsChanged,0);assert.equal(sitovRepair24.correctOptionTextsChanged,2)
 for(const row of sitovRepair24.changedQuestions){const q=manifest.drafts.flatMap(d=>d.definition.tasks).find(q=>q.id===row.questionId);assert.deepEqual(q,q.id===sitovFinal25.questionId?sitovFinal25.currentTask:row.currentTask);assert.equal(q.correctOptionId,row.previousTask.correctOptionId);assert.deepEqual({...q,promptDe:row.previousTask.promptDe,rationaleDe:row.previousTask.rationaleDe,options:row.previousTask.options},row.previousTask)}
 for(const pool of sitovRepair24.changedPools){const d=manifest.drafts.find(d=>d.textId===pool.textId);assert.equal(sitovHash(JSON.stringify(d.definition)),d.textId===sitovFinal25.textId?sitovFinal25.newDefinitionHash:pool.newDefinitionHash);assert.equal(d.review.status,'independent_editorial_checked_draft_only');assert.equal(d.review.reviewer,'sitov.agent.M');assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.active,false)}
 assert.equal(sitovHash(JSON.stringify(manifest.drafts.slice(9))),'5d1b19f3ead1bf62163e537dfd3b18d4bdaea534ded879789924d01c80acc156')
 assert.equal(manifest.drafts[6].definition.tasks.find(q=>q.id.endsWith('verbs.q6')).promptDe,'Welche Person gehört zur Form »bezahle« im Präsens Indikativ?')
 assert.equal(sitovHash(JSON.stringify(sitovBeforeRepair.drafts.slice(0,9))),'6587cc7b0e0da041b3056a4636f2d40863dbf97991e830f60402286a0a1bdfd8')
 const aliases=sitovFrozenAudio12;assert.equal(sitovHash(JSON.stringify(Object.fromEntries(Object.entries(sitovBeforeRepairAliases(aliases)).slice(0,864)))),'cd43a267a98050a19e6092ba622ef0bdc14e6398c459e92bff1c0481c4828be4')
 const refs=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/batch10-12-reference-audio-input.json','utf8'));assert.equal(Object.keys(refs).length,3)
 for(const d of manifest.drafts.slice(9)){assert.equal(refs['sitov-pretest-reference:'+d.textId],sources.rows.find(r=>r.id===d.textId).text);assert.equal(sitovHash(refs['sitov-pretest-reference:'+d.textId]),d.textVersion);assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.review.status,'independent_editorial_checked_draft_only');assert.equal(d.review.reviewer,'sitov.agent.M');assert.equal(d.review.reviewerKind,'independent_agent_editorial_review');assert.equal(d.review.authorIdentity,'sitov.agent.S3');assert.equal(d.review.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(d.review.documentSha256,'4d07d5c28c675f46bdf827adc8887ef3de0e2190180922f66d1775f7129c3945');assert.equal(d.definition.competencies.length,4)}
 const proofRaw=await readFile('docs/releases/evidence/sitov-night-2026-10-08/pretest10-12-final-editorial-review.json','utf8'),proof=JSON.parse(proofRaw);assert.equal(sitovHash(proofRaw),'4d07d5c28c675f46bdf827adc8887ef3de0e2190180922f66d1775f7129c3945')
 for(const d of manifest.drafts.slice(9)){const row=proof.rows.find(r=>r.textId===d.textId);assert.equal(d.review.textVersion,row.textVersion);assert.equal(d.review.definitionContentHash,row.definitionContentHash);assert.equal(d.review.documentRef,proof.documentRef);assert.equal(d.review.reviewedAt,proof.reviewedAt);assert.equal(d.review.reviewer,proof.reviewer)}
 assert.deepEqual(manifest.drafts.slice(9).map(d=>[d.level,sources.rows.find(r=>r.id===d.textId).sortOrder]),[['A1.1',10],['A1.2',1],['A1.2',2]])
})
test('actual evening/doctor/cooking clauses determine keys, pronoun reference, cases and split verbs',()=>{
 const manifest=sitovBeforeMapping

 const [evening,doctor,cooking]=manifest.drafts.slice(9),key=(d,suffix)=>{const q=d.definition.tasks.find(q=>q.id.endsWith(suffix));return q.options.find(o=>o.id===q.correctOptionId).textDe}
 assert.equal(key(evening,'nominal.q3'),'kleines');assert.equal(key(evening,'nominal.q5'),'in das Bett');assert.equal(key(evening,'words.q6'),'Um 10 Uhr.')
 assert.equal(key(doctor,'verbs.q1'),'wehtun');assert.equal(key(doctor,'verbs.q5'),'mitnehmen');assert.equal(key(doctor,'nominal.q5'),'Auf den Namen des Sprechers.');assert.equal(key(doctor,'nominal.q6'),'warmen')
 assert.equal(key(cooking,'verbs.q6'),'aufräumen');assert.equal(key(cooking,'nominal.q6'),'den');assert.equal(key(cooking,'syntax.q4'),'Karotten werden gewaschen und Kartoffeln geschnitten.')
 for(const d of [evening,doctor,cooking]){assert.equal(new Set(d.definition.tasks.map(q=>q.assessmentUnit)).size,24);for(const q of d.definition.tasks)assert.ok(!q.options.some(o=>/\b(Frau|Mitarbeiterin|Freundin|Lehrerin|Schülerin)\b/u.test(o.textDe)))}
 assert.ok(doctor.definition.competencies.find(c=>c.category==='verb_forms').mapping.topicIds.includes('sitov.topic.modalverben'));assert.ok(cooking.definition.competencies.find(c=>c.category==='verb_forms').mapping.topicIds.includes('sitov.topic.trennbare-verben'))
})

test('batch10–12 public-premise regression: formerly hidden facts have explicit practice contexts; author audit covers all72',async()=>{
 const audit=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/batch10-12-visible-context-epoch21.json','utf8'))
 const tasks=manifest.drafts.slice(9).flatMap(d=>d.definition.tasks)
 const delta=JSON.parse(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/batch10-12-final-wording-delta-epoch22.json','utf8'))
 assert.equal(delta.changedQuestions.length,5);assert.equal(delta.aliasesChanged,4);assert.equal(delta.humanReview,false);assert.equal(delta.calibrationStatus,'pending')
 const current=new Map(delta.changedQuestions.map(row=>[row.questionId,row.currentTask]))
 for(const row of delta.changedQuestions){assert.equal(row.keyIdUnchanged,true);assert.deepEqual(tasks.find(q=>q.id===row.questionId),row.currentTask)}
 assert.equal(audit.questions.length,72);assert.equal(audit.changedQuestionCount,30)
 assert.deepEqual(audit.questions.map(q=>q.questionId),tasks.map(q=>q.id))
 assert.equal(audit.status,'author_checked_independent_review_pending');assert.equal(audit.humanReview,false);assert.equal(audit.calibrationStatus,'pending')
 const required={
  'a11-10.words.q6':'um zehn Uhr','a11-10.syntax.q1':'Auf dem Tisch liegt ein Handy','a11-10.syntax.q2':'Heute / ich / lese / ein Buch','a11-10.syntax.q3':'Eine Katze schläft auf dem Sofa','a11-10.syntax.q4':'Paul trinkt Wasser und hört Musik',
  'a12-01.syntax.q1':'Seit gestern habe ich Durst','a12-01.syntax.q2':'möchte einen Termin beim Arzt vereinbaren','a12-01.syntax.q3':'Nach meinem Namen fragt der Mitarbeiter','a12-01.syntax.q4':'Ein Termin ist am Nachmittag frei','a12-01.syntax.q6':'bleibe ich zu Hause und trinke warmen Tee','a12-01.nominal.q5':'Ich nenne meinen Namen. Dann buchstabiere ich ihn',
  'a12-02.syntax.q1':'Paul sagt: Zwei Freunde kommen zu mir','a12-02.syntax.q2':'Wir möchten gemeinsam eine Suppe kochen','a12-02.syntax.q3':'Zuerst kaufen wir Gemüse. Dann waschen wir die Karotten','a12-02.syntax.q4':'Die Kartoffeln schneiden wir. Die Karotten waschen wir','a12-02.syntax.q5':'Wasser kocht mein Freund; den Tisch decke ich','a12-02.syntax.q6':'Wir essen Brot. Später räumen wir die Küche auf'
 }
 for(const [suffix,premise] of Object.entries(required)){const q=tasks.find(q=>q.id==='sitov.pretest.'+suffix);assert.ok(q.promptDe.includes(premise));assert.equal(q.fragmentDe,null)}
 for(const [i,q] of tasks.entries()){assert.equal(audit.questions[i].publicPromptDe,q.promptDe);assert.deepEqual(current.get(q.id)?.options ?? audit.questions[i].publicOptions,q.options);assert.equal(audit.questions[i].keyIdUnchanged,true);assert.equal(audit.questions[i].independentReview,'pending_M')}
 // These assertions prevent loss of reviewed public context; they do not certify pedagogy.
})

test('complete essential-category matrix accepts an empty omission list without inventing content',()=>{
 const errors=validate(m=>{const draft=m.drafts[0];draft.review={status:'author_checked_teacher_review_pending',reviewer:'sitov.fixture.author',notesDe:'Synthetic omission-contract fixture; no editorial or publication approval.'};draft.definition.omittedCategories=[]})
 assert.deepEqual(errors,[])
})
test('omission reasons remain substantive and missing categories cannot disappear silently',()=>{
 const pending=draft=>{draft.review={status:'author_checked_teacher_review_pending',reviewer:'sitov.fixture.author',notesDe:'Synthetic omission-contract fixture; no editorial or publication approval.'}}
 for(const reasonDe of ['Kurz.','                  Kurz.                  ','🙂'.repeat(10)]){
  const errors=validate(m=>{const draft=m.drafts[0];pending(draft);draft.definition.omittedCategories[0].reasonDe=reasonDe})
  assert.ok(errors.some(error=>error.endsWith('absent categories need reasons')))
 }
 const errors=validate(m=>{const draft=m.drafts[0];pending(draft);const d=draft.definition,core=d.competencies.find(c=>c.category==='nominal_forms'),removed=new Set(d.tasks.filter(q=>q.competencyId===core.id).map(q=>q.id));d.competencies=d.competencies.filter(c=>c.id!==core.id);d.tasks=d.tasks.filter(q=>!removed.has(q.id));for(const form of d.reviewForms)form.questionIds=form.questionIds.filter(q=>!removed.has(q));d.omittedCategories=[]})
 assert.ok(errors.some(error=>error.endsWith('missing matrix or justified absence nominal_forms')))
})


test('known cross-level topics are rejected in both directions despite existing canonical IDs',()=>{
 const originalErrors=sitovValidatePretestDrafts(sitovBeforeMapping,sources)
 assert.equal(originalErrors.filter(error=>error.endsWith('same-level topic mapping required')).length,4)

 for(const [index,category,topic] of [[4,'vocabulary','sitov.topic.zeit'],[10,'verb_forms','sitov.topic.trennbare-verben'],[11,'verb_forms','sitov.topic.trennbare-verben'],[11,'nominal_forms','sitov.topic.akkusativ']]){
  assert.ok(sources.topicIds.has(topic))
  assert.ok(validate(m=>{m.drafts[index].definition.competencies.find(c=>c.category===category).mapping.topicIds=[topic]}).some(error=>error.endsWith('same-level topic mapping required')))
 }
})
test('current partial mappings use canonical same-level evidence and retain exact uncovered gaps',()=>{
 assert.equal(sources.topicLevels.size,20)
 assert.deepEqual([...sources.topicLevels.values()].slice(16),['A2.1','A2.2','B1.1','B1.2'])
 assert.deepEqual(sitovValidatePretestDrafts(manifest,sources),[])
 for(const draft of manifest.drafts)for(const core of draft.definition.competencies){
  for(const topic of core.mapping.topicIds)assert.equal(sources.topicLevels.get(topic),draft.level)
  assert.ok(core.mapping.pendingReasonDe.length>40)
 }
 assert.deepEqual(manifest.drafts[8].definition.competencies.find(c=>c.category==='nominal_forms').mapping.topicIds,[])
 for(const draft of manifest.drafts.slice(10))assert.deepEqual(draft.definition.competencies.find(c=>c.category==='verb_forms').mapping.topicIds,[])
 assert.deepEqual(manifest.drafts[11].definition.competencies.find(c=>c.category==='vocabulary').mapping.topicIds,[])
 assert.deepEqual(manifest.drafts[8].definition.competencies.find(c=>c.category==='vocabulary').mapping.topicIds,['sitov.topic.tageszeit-a11'])
 assert.deepEqual(manifest.drafts[6].definition.competencies.find(c=>c.category==='nominal_forms').mapping.topicIds,['sitov.topic.nominativ'])
 assert.deepEqual(manifest.drafts[10].definition.competencies.find(c=>c.category==='vocabulary').mapping.topicIds,['sitov.topic.gesundheit-a12'])
})
test('explicit epoch33 delta exactly reconstructs frozen history while only mapping and honest pending review change',async()=>{
 assert.equal(sitovHash(JSON.stringify(sitovBeforeMapping)),sitovMapping33.previousManifestContentHash)
 assert.equal(sitovHash(JSON.stringify(sitovBeforeMapping,null,2)+'\n'),sitovMapping33.previousManifestByteSha256)
 assert.equal(sitovHash(JSON.stringify(manifest,null,2)+'\n'),sitovMapping33.currentManifestByteSha256)
 assert.equal(sitovHash(JSON.stringify(manifest)),sitovMapping33.currentManifestContentHash)
 const mappingRaw=await readFile('lib/learning/sitov-topic-mapping.ts','utf8'),array=mappingRaw.match(/export const SITOV_TOPIC_MAPPING[^=]*=\s*(\[[\s\S]*?\n\])/u)[1]
 const priorMapping=mappingRaw.replace("import type { AccessLevel } from '@/lib/access/levels'\n\n",'').replace('export type SitovMappedLevel = AccessLevel',"export type SitovMappedLevel = 'A1.1' | 'A1.2'").replace(array,JSON.stringify(JSON.parse(array).slice(0,16),null,2))
 assert.equal(sitovHash(priorMapping),sitovMapping33.sourceMappingSha256)
 assert.equal(sitovMapping33.changedPools.length,12)
 assert.equal(sitovMapping33.spokenFieldsChanged,0);assert.equal(sitovMapping33.keysChanged,0)
 for(const row of sitovMapping33.changedPools){
  const current=manifest.drafts.find(d=>d.textId===row.textId),previous=sitovBeforeMapping.drafts.find(d=>d.textId===row.textId)
  assert.equal(sitovHash(JSON.stringify(previous.definition)),row.previousDefinitionContentHash)
  assert.equal(sitovHash(JSON.stringify(current.definition)),row.currentDefinitionContentHash)
  assert.notEqual(row.previousDefinitionContentHash,row.currentDefinitionContentHash)
  assert.deepEqual(current.review,row.currentReview)
  assert.equal(current.review.status,'author_checked_independent_review_pending')
  assert.equal(current.review.reviewer,'sitov.agent.S3');assert.equal(current.review.authorIdentity,'sitov.agent.S3')
  assert.equal(current.review.humanReview,false);assert.equal(current.review.calibrationStatus,'pending')
  assert.equal(current.review.definitionContentHash,row.currentDefinitionContentHash)
  assert.equal(Object.hasOwn(current.review,'documentRef'),false)
  const restored=structuredClone(current);restored.review=row.previousReview
  for(const core of row.cores){const actual=restored.definition.competencies.find(c=>c.id===core.coreId);assert.deepEqual(actual.mapping,core.currentMapping);actual.mapping=core.previousMapping}
  assert.deepEqual(restored,previous)
 }
 const audioRaw=JSON.stringify(sitovFrozenAudio12,null,2)+'\n'
 assert.equal(sitovHash(audioRaw),sitovMapping33.audioAliasByteSha256)
 assert.equal(sitovHash(JSON.stringify(JSON.parse(audioRaw))),sitovMapping33.audioAliasContentHash)
 assert.deepEqual(sitovPublicPretestAudioAliases(manifest),sitovPublicPretestAudioAliases(sitovBeforeMapping))
})


test('current exact M review composes unchanged prior independently reviewed tasks and checked metadata without publication',async()=>{
 const path='docs/handoffs/SITOV-NIGHT-2026-10-08/M/core-mapping-editorial-review.json',raw=await readFile(path,'utf8'),proof=JSON.parse(raw)
 assert.equal(proof.humanReview,false);assert.equal(proof.calibrationStatus,'pending');assert.equal(proof.publicationAuthorized,false);assert.equal(proof.coresChecked,48)
 assert.deepEqual(sitovValidatePretestDrafts(currentManifest,sources),[])
 for(const d of originalManifest.drafts){
  const record=proof.approvedEditorialDrafts.find(r=>r.textId===d.textId),pending=manifest.drafts.find(r=>r.textId===d.textId)
  assert.deepEqual(d.definition,pending.definition);assert.equal(record.definitionContentHash,sitovHash(JSON.stringify(d.definition)))
  assert.equal(d.review.documentSha256,sitovHash(raw));assert.equal(d.review.documentRef,proof.documentRef);assert.equal(d.review.reviewer,proof.reviewer);assert.equal(d.review.authorIdentity,proof.authorIdentity)
  assert.notEqual(d.review.reviewer,d.review.authorIdentity);assert.equal(d.review.textVersion,d.textVersion);assert.equal(d.review.definitionContentHash,record.definitionContentHash)
  assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');assert.equal(d.active,false)
  for(const file of record.priorReviewDocuments)assert.equal(sitovHash(await readFile(file,'utf8')),record.priorReview.documentSha256)
  assert.equal(record.previousDefinitionContentHash,record.priorReview.definitionContentHash);assert.equal(record.nonMappingFieldsExactlyUnchanged,true)
 }
 const stale=structuredClone(currentManifest);stale.drafts[0].definition.tasks[0].correctOptionId='sitov.changed.key'
 assert.ok(sitovValidatePretestDrafts(stale,sources).some(e=>e.endsWith('independent exact-version review provenance required')))
 assert.deepEqual(sitovPublicPretestAudioAliases(originalManifest),sitovPublicPretestAudioAliases(manifest))
})


test('source reader accepts central levels and rejects forged level, mixed-level and duplicate topic metadata',async()=>{
 const fs=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join,resolve}=await import('node:path')
 const dir=await fs.mkdtemp(join(tmpdir(),'sitov-topic-source-'))
 try{
  await fs.mkdir(join(dir,'supabase'),{recursive:true});await fs.symlink(resolve('supabase/seeds'),join(dir,'supabase/seeds'))
  await fs.mkdir(join(dir,'lib/access'),{recursive:true});await fs.mkdir(join(dir,'lib/learning'),{recursive:true})
  const access=await readFile('lib/access/levels.ts','utf8'),mapping=await readFile('lib/learning/sitov-topic-mapping.ts','utf8')
  await fs.writeFile(join(dir,'lib/access/levels.ts'),access);await fs.writeFile(join(dir,'lib/learning/sitov-topic-mapping.ts'),mapping)
  const valid=await sitovReadAuthoringSources(dir);assert.equal(valid.rows.filter(r=>r.active).length,60);assert.equal(valid.topicLevels.size,20)
  for(const invalid of [mapping.replace('"level": "A2.1"','"level": "Z9.9"'),mapping.replace('"level": "A2.1"','"level": "B1.2"'),mapping.replace('sitov.topic.begruenden-a21','sitov.topic.nominativ')]){
   await fs.writeFile(join(dir,'lib/learning/sitov-topic-mapping.ts'),invalid);await assert.rejects(sitovReadAuthoringSources(dir),/Invalid canonical topic-level evidence/)
  }
  await fs.writeFile(join(dir,'lib/access/levels.ts'),access.replace("  'A1.1',","  'INVALID',"));await assert.rejects(sitovReadAuthoringSources(dir),/Invalid canonical access-level evidence/)
 }finally{await fs.rm(dir,{recursive:true,force:true})}
})


test('next three actual A1.2 sources append15/60 inactive pools with frozen12 Mreviews and1152aliases intact',()=>{
 assert.equal(sitovAuthor35.drafts.length,15);assert.deepEqual(sitovAuthor35.coverage,{total:60,authored:15,pending:45})
 assert.equal(sitovHash(JSON.stringify(originalManifest.drafts)),sitovEpoch34.original12ContentHash)
 assert.equal(sitovHash(JSON.stringify(originalManifest)),sitovEpoch34.originalManifestContentHash)
 assert.equal(sitovHash(JSON.stringify(sitovFrozenAudio12)),sitovEpoch34.original1152AliasContentHash)
 assert.equal(sitovHash(JSON.stringify(sitovFrozenAudio12,null,2)+'\n'),sitovEpoch34.original1152AliasByteSha256)
 assert.deepEqual(sitovValidatePretestDrafts(sitovAuthor35,sources),[])
 assert.equal(Object.keys(sitovAllAudio).length,1440);assert.deepEqual(sitovValidatePretestAudioAliases(sitovAuthor35,sitovAllAudio),[])
 for(const [index,draft] of sitovAuthor35.drafts.slice(12).entries()){
  assert.equal(sources.rows.find(s=>s.id===draft.textId).sortOrder,index+3);assert.equal(draft.level,'A1.2');assert.equal(draft.active,false)
  assert.equal(draft.definition.tasks.length,24);assert.equal(draft.definition.competencies.length,4)
  assert.equal(draft.review.status,'author_checked_independent_review_pending');assert.equal(draft.review.authorIdentity,draft.review.reviewer)
  assert.equal(draft.review.humanReview,false);assert.equal(draft.review.calibrationStatus,'pending')
  assert.equal(sitovHash(JSON.stringify(sitovBefore35.drafts.find(d=>d.textId===draft.textId).definition)),sitovEpoch34.pools[index].definitionContentHash)
  assert.equal(new Set(draft.definition.tasks.map(q=>q.assessmentUnit)).size,24)
 }
})
test('new source-specific answers and public premises distinguish swim ability, invitations and market roles',()=>{
 const added=sitovBefore35.drafts.slice(12),key=(index,suffix)=>{const q=added[index].definition.tasks.find(q=>q.id.endsWith(suffix));return q.options.find(o=>o.id===q.correctOptionId).textDe}
 assert.equal(key(0,'verbs.q1'),'Der Sohn hat die Fähigkeit dazu.');assert.equal(key(0,'verbs.q3'),'einpacken');assert.equal(key(0,'nominal.q5'),'Auf den Sohn.')
 assert.equal(key(1,'syntax.q2'),'Am Samstag um vier Uhr.');assert.equal(key(1,'nominal.q4'),'Auf die Einladung.');assert.equal(key(1,'nominal.q1'),'meinen')
 assert.equal(key(2,'syntax.q4'),'Der Sprecher, bezeichnet durch mich.');assert.equal(key(2,'nominal.q5'),'Auf den Apfel.');assert.equal(key(2,'nominal.q6'),'meine')
 for(const [index,draft] of added.entries())for(const [j,q] of draft.definition.tasks.entries()){
  const audit=sitovEpoch34.pools[index].questions[j];assert.equal(audit.publicPromptDe,q.promptDe);assert.deepEqual(audit.publicOptions,q.options);assert.equal(audit.correctOptionId,q.correctOptionId);assert.equal(audit.rationaleDe,q.rationaleDe)
  assert.equal(q.fragmentDe,null);assert.ok(!q.promptDe.includes(sources.rows.find(s=>s.id===draft.textId).text))
 }
 assert.ok(added[1].definition.tasks.find(q=>q.id.endsWith('syntax.q2')).promptDe.includes('Die Feier beginnt am Samstag um vier Uhr'))
 assert.ok(added[0].definition.tasks.find(q=>q.id.endsWith('syntax.q6')).promptDe.includes('Nach einer Stunde machen wir eine Pause'))
 const sourceQuestion=added[2].definition.tasks.find(q=>q.id.endsWith('nominal.q5'));assert.ok(sourceQuestion.promptDe.includes('Ich probiere einen Apfel. Er schmeckt süß'))
})
test('new pools reject duplicated assessed units, shared retake questions and false source spans',()=>{
 for(const mutate of [m=>{m.drafts[12].definition.tasks[1].assessmentUnit=m.drafts[12].definition.tasks[0].assessmentUnit},m=>{m.drafts[13].definition.reviewForms[1].questionIds[0]=m.drafts[13].definition.reviewForms[0].questionIds[0]},m=>{m.drafts[14].definition.tasks[0].sourceSpans[0].start++}]){
  const copy=structuredClone(sitovAuthor35);mutate(copy);assert.ok(sitovValidatePretestDrafts(copy,sources).length)
 }
})


const sitovDiversityErrors=drafts=>{
 const errors=[],labelPatterns=[],positionPatterns=[]
 for(const draft of drafts)for(const core of draft.definition.competencies){
  const qs=draft.definition.tasks.filter(q=>q.competencyId===core.id)
  const labels=qs.map(q=>q.correctOptionId.split('.').at(-1)),positions=qs.map(q=>q.options.findIndex(o=>o.id===q.correctOptionId))
  if(qs.length!==6||['a','b','c'].some(label=>labels.filter(l=>l===label).length!==2))errors.push('unbalanced_labels')
  if([0,1,2].some(position=>positions.filter(p=>p===position).length!==2))errors.push('unbalanced_positions')
  labelPatterns.push(labels.join(''));positionPatterns.push(positions.join(''))
 }
 if(new Set(labelPatterns).size!==labelPatterns.length)errors.push('repeated_label_schedule')
 if(new Set(positionPatterns).size!==positionPatterns.length)errors.push('repeated_position_schedule')
 for(let index=0;index<6;index++){
  if(new Set(labelPatterns.map(pattern=>pattern[index])).size!==3)errors.push('question_index_label_pattern')
  if(new Set(positionPatterns.map(pattern=>pattern[index])).size!==3)errors.push('question_index_position_pattern')
 }
 return errors
}
test('current new72 have independently varied balanced labels and positions; prior predictable state fails',()=>{
 assert.deepEqual(sitovDiversityErrors(sitovAuthor35.drafts.slice(12)),[])
 const previous=sitovDiversityErrors(sitovBefore35.drafts.slice(12))
 assert.ok(previous.includes('unbalanced_labels'));assert.ok(previous.includes('repeated_position_schedule'))
 const allFirst=structuredClone(sitovAuthor35.drafts.slice(12))
 for(const d of allFirst)for(const q of d.definition.tasks){const correct=q.options.find(o=>o.id===q.correctOptionId);q.options=[correct,...q.options.filter(o=>o!==correct)]}
 assert.ok(sitovDiversityErrors(allFirst).includes('unbalanced_positions'))
 const allA=structuredClone(sitovAuthor35.drafts.slice(12))
 for(const d of allA)for(const q of d.definition.tasks)q.correctOptionId=q.options.find(o=>o.id.endsWith('.a')).id
 assert.ok(sitovDiversityErrors(allA).includes('unbalanced_labels'))
})
test('epoch35 exact bijections preserve each correct answer and every other task/core/source/form field',async()=>{
 assert.equal(sitovDelta35.questions.length,72);assert.equal(sitovDelta35.pools.length,3)
 assert.equal(sitovDelta35.questionRecordCount,72)
 assert.equal(sitovDelta35.changedQuestionCount,sitovDelta35.questions.filter(row=>JSON.stringify(row.previousOptions)!==JSON.stringify(row.currentOptions)||row.previousCorrectOptionId!==row.currentCorrectOptionId).length)
 assert.equal(sitovHash(JSON.stringify(sitovBefore35)),sitovDelta35.previousManifestContentHash)
 assert.equal(sitovHash(JSON.stringify(sitovBefore35,null,2)+'\n'),sitovDelta35.previousManifestByteSha256)
 assert.equal(sitovHash(JSON.stringify(sitovAuthor35)),sitovDelta35.currentManifestContentHash)
 assert.equal(sitovHash(JSON.stringify(sitovAuthor35,null,2)+'\n'),sitovDelta35.currentManifestByteSha256)
 assert.equal(sitovHash(JSON.stringify(sitovAuthor35.drafts.slice(0,12))),sitovDelta35.original12ContentHash)
 for(const row of sitovDelta35.questions){
  const actual=sitovAuthor35.drafts.find(d=>d.textId===row.textId).definition.tasks.find(q=>q.id===row.questionId)
  const previous=sitovBefore35.drafts.find(d=>d.textId===row.textId).definition.tasks.find(q=>q.id===row.questionId)
  assert.deepEqual(actual.options,row.currentOptions);assert.equal(actual.correctOptionId,row.currentCorrectOptionId)
  assert.equal(actual.options.find(o=>o.id===actual.correctOptionId).textDe,row.correctAnswerTextDe)
  assert.equal(previous.options.find(o=>o.id===previous.correctOptionId).textDe,row.correctAnswerTextDe)
  assert.equal(new Set(Object.values(row.optionIdBijection)).size,3)
  for(const option of previous.options)assert.equal(actual.options.find(o=>o.id===row.optionIdBijection[option.id]).textDe,option.textDe)
  assert.deepEqual({...actual,options:previous.options,correctOptionId:previous.correctOptionId},previous)
 }
 for(const row of sitovDelta35.pools){
  const current=sitovAuthor35.drafts.find(d=>d.textId===row.textId),previous=sitovBefore35.drafts.find(d=>d.textId===row.textId)
  assert.equal(sitovHash(JSON.stringify(current.definition)),row.currentDefinitionContentHash)
  assert.equal(sitovHash(JSON.stringify(previous.definition)),row.previousDefinitionContentHash)
  assert.equal(current.review.status,'author_checked_independent_review_pending')
  assert.deepEqual({...current.review,definitionContentHash:previous.review.definitionContentHash},previous.review)
  const restored=structuredClone(current);restored.definition.tasks=previous.definition.tasks;restored.review=previous.review;assert.deepEqual(restored,previous)
 }
 assert.deepEqual(sitovValidatePretestDrafts(sitovAuthor35,sources),[])
})
test('new option aliases follow exact bijections/order while old1152 and all German spoken values stay unchanged',async()=>{
 assert.equal(sitovHash(JSON.stringify(sitovBeforeAudio35)),sitovDelta35.previousAudioContentHash)
 assert.equal(sitovHash(JSON.stringify(sitovBeforeAudio35,null,2)+'\n'),sitovDelta35.previousAudioByteSha256)
 assert.equal(sitovHash(JSON.stringify(sitovAllAudio)),sitovDelta35.currentAudioContentHash)
 assert.equal(sitovHash(await readFile('supabase/seeds/sitov-pronunciation-pretest-audio-2026-10-08.json','utf8')),sitovDelta35.currentAudioByteSha256)
 assert.deepEqual(Object.values(sitovAllAudio).sort(),Object.values(sitovBeforeAudio35).sort())
 assert.equal(sitovHash(JSON.stringify(Object.values(sitovAllAudio).sort())),sitovDelta35.spokenMultisetContentHash)
 const expected={...sitovFrozenAudio12}
 for(const row of sitovDelta35.questions)for(const alias of row.currentAliasEntries)expected[alias.key]=alias.textDe
 assert.deepEqual(Object.entries(sitovAllAudio),Object.entries(expected))
 assert.deepEqual(sitovValidatePretestAudioAliases(sitovAuthor35,sitovAllAudio),[])
 assert.equal(sitovHash(JSON.stringify(sitovFrozenAudio12)),sitovDelta35.original1152AliasContentHash)
 assert.ok(sitovValidatePretestAudioAliases(sitovAuthor35,sitovBeforeAudio35).length>0)
})

test('M exact independent review binds current new3 definitions without rewriting author history or claiming publication',async()=>{
 const raw=await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/M/pools13-15-editorial-review.json','utf8'),proof=JSON.parse(raw)
 assert.equal(proof.questionsChecked,72);assert.equal(proof.coresChecked,12);assert.equal(proof.humanReview,false);assert.equal(proof.calibrationStatus,'pending');assert.equal(proof.publicationAuthorized,false)
 assert.equal(proof.optionDeltaSha256,sitovHash(await readFile('docs/handoffs/SITOV-NIGHT-2026-10-08/S3/epoch35-option-diversity-delta.json','utf8')))
 for(const d of currentManifest.drafts.slice(12)){const r=proof.approvedEditorialDrafts.find(r=>r.textId===d.textId);assert.equal(d.active,false);assert.equal(d.review.status,'independent_editorial_checked_draft_only');assert.equal(d.review.reviewer,'sitov.agent.M');assert.equal(d.review.authorIdentity,'sitov.agent.S3');assert.equal(d.review.documentSha256,sitovHash(raw));assert.equal(d.review.textVersion,r.textVersion);assert.equal(d.review.definitionContentHash,r.definitionContentHash);assert.equal(r.definitionContentHash,sitovHash(JSON.stringify(d.definition)));assert.equal(d.review.humanReview,false);assert.equal(d.review.calibrationStatus,'pending');for(const q of d.definition.tasks)assert.equal(r.correctAnswerTexts.find(r=>r.questionId===q.id).correctTextDe,q.options.find(o=>o.id===q.correctOptionId).textDe)}
 assert.deepEqual(sitovValidatePretestDrafts(currentManifest,sources),[]);assert.deepEqual(sitovValidatePretestAudioAliases(currentManifest,sitovAllAudio),[])
})
