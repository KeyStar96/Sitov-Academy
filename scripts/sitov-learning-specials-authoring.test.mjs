import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { canonical,validateSpecialDraft,twoForms,audibleTexts,buildInactiveSpecialAuthorInput } from './sitov-learning-specials-authoring.mjs'
const original=JSON.parse(readFileSync(new URL('../supabase/seeds/sitov-learning-special-pools-2026-10-08.json',import.meta.url),'utf8'))
function edit(callback){const d=structuredClone(original);callback(d);const p=d.pools[0],body={...p};delete body.draftContentSha256;p.draftContentSha256=createHash('sha256').update(canonical(body)).digest('hex');return d}
test('actual PDF SHA, repository anchor and actual content schema validate inactive unbound20',()=>{
 const result=validateSpecialDraft(original,{verifySources:true});assert.equal(result.items,20);assert.equal(result.binding,'UNBOUND_DRAFT');assert.equal(result.sourceFilesVerified,true);assert.equal(original.pools[0].items.filter(i=>i.snapshot.type==='multiple_choice').length,15);assert.equal(original.pools[0].items.filter(i=>i.snapshot.type==='fill_in_blank').length,5)
})
test('two disjoint10 forms have exact3/4/3 quotas and preserve stable IDs/order',()=>{
 const before=JSON.stringify(original),pool=original.pools[0],forms=twoForms(pool);for(const f of forms){assert.equal(f.length,10);assert.equal(new Set(f).size,10);for(const [stratum,q] of Object.entries(pool.blueprint))assert.equal(f.filter(id=>pool.items.find(i=>i.id===id).stratum===stratum).length,q)}assert(forms[0].every(id=>!forms[1].includes(id)));assert.equal(JSON.stringify(original),before)
})
test('95 German audible set is complete and no task placeholder enters synthesis aliases',()=>{
 for(const t of audibleTexts(original.pools[0]))assert(original.audioManifest.aliases.some(a=>a.text===t));assert(original.audioManifest.aliases.every(a=>!a.text.includes('___')))
})
const negatives=[
 ['activation',d=>{d.pools[0].active=true}],['publication',d=>{d.pools[0].published=true}],['invented binding',d=>{d.pools[0].binding.nodeId=d.pools[0].definitionId}],['Boolean review',d=>{d.pools[0].editorialProof={reviewed:true}}],['fake source hash',d=>{d.sources[0].sha256='f'.repeat(64)}],['unsupported format',d=>{d.pools[0].items[0].snapshot.type='matching'}],['duplicate item',d=>{d.pools[0].items[1]=structuredClone(d.pools[0].items[0])}],['duplicate task',d=>{d.pools[0].items[1].snapshot.content=structuredClone(d.pools[0].items[0].snapshot.content)}],['wrong source span',d=>{d.pools[0].items[0].sourceEvidence.task.page=7}],['foreign anchor',d=>{d.pools[0].binding.candidate.anchorSourceId='P99-N1'}],['missing audio',d=>{d.audioManifest.aliases=d.audioManifest.aliases.filter(a=>a.text!==d.pools[0].items[0].snapshot.content.question)}],['unbalanced blueprint',d=>{d.pools[0].blueprint.masculine=4}],['malformed correct option',d=>{d.pools[0].items[0].snapshot.content.correct_answer='einen'}],['missing target form',d=>{delete d.pools[0].items[0].snapshot.content.target_form}],['wrong UUID',d=>{d.pools[0].items[0].id=d.pools[0].definitionId}],['fake audio imported',d=>{d.audioManifest.status='ready'}],['feminine fictive role',d=>{d.pools[0].items[0].sourceEvidence.rationale.fictionalCharacters=[{name:'Anna',gender:'female'}]}],
]
for(const [name,mutate] of negatives)test(`rejects ${name}`,()=>assert.throws(()=>validateSpecialDraft(edit(mutate))))
test('a changed original PDF byte fingerprint is rejected',()=>assert.throws(()=>validateSpecialDraft(edit(d=>{d.sources[1].sha256='e'.repeat(64)}),{verifySources:true}),/source_hash_mismatch/))
test('changed content without updated draft hash is rejected separately from95 DB version',()=>{const d=structuredClone(original);d.pools[0].title+=' geändert';assert.throws(()=>validateSpecialDraft(d),/draft_hash_mismatch/);assert.equal(d.pools[0].binding.definitionVersion,null)})

test('inactive author request uses fresh exact context and preserves new task IDs without asserting a Special node',()=>{
 const context={unitId:'f72f211a-9d44-41a2-af18-87976effe62d',anchorNodeId:'9f92ad82-cb5c-40cf-86d3-87b17b75c5bb',sourceRef:original.sources[0].ref,sourceSha256:original.sources[0].sha256,anchorVersion:'e'.repeat(64),specialExists:false},request='00000000-0000-4000-8000-000000000001',before=JSON.stringify(original)
 const input=buildInactiveSpecialAuthorInput(original,context,request);assert.equal(input.expectedAnchorVersion,context.anchorVersion);assert.deepEqual(input.items.map(i=>i.id),original.pools[0].items.map(i=>i.id));assert.equal(input.nodeId,undefined);assert.equal(input.published,undefined);assert.equal(input.items[0].published,undefined);assert.equal(JSON.stringify(original),before)
 for(const bad of [{...context,specialExists:true},{...context,sourceSha256:'f'.repeat(64)},{...context,unitId:null},{...context,anchorVersion:null}])assert.throws(()=>buildInactiveSpecialAuthorInput(original,bad,request),/invalid_actual_author_context/)
})
