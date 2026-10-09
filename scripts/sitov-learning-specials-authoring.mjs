import { readFileSync } from 'node:fs'
import { dirname, resolve, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import vm from 'node:vm'
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url)
const sha=(value,algorithm='sha256')=>createHash(algorithm).update(value).digest('hex')
export const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:value&&typeof value==='object'?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`:JSON.stringify(value)
const fail=message=>{throw new Error(message)}
/** Read-only compilation of actual repository authoring schemas, not a copied validator. */
function loadSchema(file,cache=new Map()){
 const path=resolve(repo,file);if(cache.has(path))return cache.get(path)
 const exports={};cache.set(path,exports)
 const source=readFileSync(path,'utf8'),ts=require('typescript')
 const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 vm.runInNewContext(output,{exports,require:id=>id==='zod'?require(id):id.startsWith('.')?loadSchema(resolve(dirname(path),id+'.ts'),cache):fail('unsupported_schema_dependency')},{filename:path})
 return exports
}
const schemas=loadSchema('lib/learning-path-schema.ts').learningPathContentSchemas
export function stableUuid(namespace,name){
 const bytes=Buffer.from(createHash('sha1').update(Buffer.from(namespace.replaceAll('-',''),'hex')).update(name).digest().subarray(0,16));bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128
 const h=bytes.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`
}
export function audibleTexts(pool){
 const all=[]
 for(const item of pool.items){const c=item.snapshot.content;all.push(c.question,c.instruction,c.correct_answer,...(c.options??[]),...(c.parts??[]));if('text_before'in c)all.push([c.text_before,c.correct_answer,c.text_after].filter(Boolean).join(' '))}
 return [...new Set(all.filter(v=>typeof v==='string').map(v=>v.normalize('NFC').trim().replace(/\s+/gu,' ')))].filter(Boolean)
}
export function twoForms(pool){
 const forms=[[],[]]
 for(const [stratum,quota] of Object.entries(pool.blueprint)){const items=pool.items.filter(item=>item.stratum===stratum).sort((a,b)=>a.stableId.localeCompare(b.stableId));forms[0].push(...items.slice(0,quota).map(item=>item.id));forms[1].push(...items.slice(quota,2*quota).map(item=>item.id))}
 return forms
}
export function validateSpecialDraft(draft,{verifySources=false}={}){
 if(draft.schemaVersion!==1||draft.brand!=='Sitov Academy'||draft.pools.length!==1)fail('invalid_draft_header')
 if(!/^[a-f0-9-]{36}$/.test(draft.uuidNamespace))fail('invalid_namespace')
 const sourceMap=new Map(draft.sources.map(source=>[source.ref,source]));if(sourceMap.size!==draft.sources.length)fail('duplicate_source')
 for(const source of draft.sources){if(!source.ref.startsWith('sitov.')||!/^[a-f0-9]{64}$/.test(source.sha256)||isAbsolute(source.path)||source.path.split('/').includes('..'))fail('invalid_source');if(verifySources&&sha(readFileSync(resolve(draft.sourceRoot,source.path)))!==source.sha256)fail('source_hash_mismatch')}
 const pool=draft.pools[0],source=sourceMap.get(pool.sourceRef)
 if(!source||pool.published!==false||pool.active!==false||pool.status!=='UNBOUND_DRAFT'||pool.editorialProof!==null||pool.audioImportProof!==null||source.independentReview!=='pending')fail('unsafe_publication_claim')
 if([pool.binding.unitId,pool.binding.nodeId,pool.binding.anchorNodeId,pool.binding.definitionVersion].some(v=>v!==null))fail('unverified_binding')
 if(!pool.specialId.startsWith('sitov-')||pool.definitionId!==stableUuid(draft.uuidNamespace,pool.specialId+'-definition-draft-v1'))fail('unstable_definition_id')
 const {draftContentSha256,...body}=pool;if(sha(canonical(body))!==draftContentSha256)fail('draft_hash_mismatch')
 const paths=JSON.parse(readFileSync(resolve(repo,'supabase/seeds/path-a1.1.json'),'utf8'));const candidate=pool.binding.candidate
 const path=paths.find(p=>p.level===pool.level&&p.id===candidate.pathSourceId),anchor=path?.nodes.find(n=>n.id===candidate.anchorSourceId)
 if(!path||!anchor||anchor.kind!=='practice'||!anchor.goals.includes(candidate.goalId)||candidate.proposedSpecialSourceId!==pool.specialId)fail('unknown_candidate_anchor')
 if(pool.items.length<20||new Set(pool.items.map(i=>i.id)).size!==pool.items.length||new Set(pool.items.map(i=>i.stableId)).size!==pool.items.length)fail('duplicate_or_small_pool')
 const seen=new Set()
 for(const item of pool.items){
  if(item.published!==false||item.id!==item.snapshot.id||item.id!==stableUuid(draft.uuidNamespace,item.stableId)||!item.stableId.startsWith(pool.specialId+'-item-'))fail('unstable_item_id')
  if(!['multiple_choice','fill_in_blank','sentence_building'].includes(item.snapshot.type)||!schemas[item.snapshot.type].safeParse(item.snapshot.content).success)fail('invalid_actual_content_schema')
  if(item.snapshot.goal_id!==candidate.goalId||Object.keys(item.snapshot).sort().join(',')!=='content,goal_id,id,translations,type')fail('invalid_snapshot_shape')
  if(!pool.blueprint[item.stratum])fail('unknown_stratum')
  const key=canonical({type:item.snapshot.type,content:item.snapshot.content});if(seen.has(key))fail('duplicate_task');seen.add(key)
  const ev=item.sourceEvidence;if(ev.sourceRef!==source.ref||ev.sourceSha256!==source.sha256||!source.reviewedPages.includes(ev.task.page)||!source.reviewedPages.includes(ev.solution.page)||!ev.task.exercise||!ev.task.item||!ev.solution.exercise||!ev.solution.item)fail('missing_source_span')
  const r=ev.rationale;if(r.case!=='Nominativ'||r.number!=='singular'||r.gender!==item.stratum||r.fictionalCharacters.length)fail('unreviewed_rationale')
  if(r.article!==ev.solution.span.toLowerCase()||!ev.task.span.includes(r.noun))fail('source_answer_span_mismatch')
  if(r.article!==item.snapshot.content.correct_answer.toLowerCase()||!['der','die','das'].includes(r.article))fail('article_rationale_mismatch')
  for(const locale of ['de','en','ru','uk','tr']){const translation=item.snapshot.translations[locale];if(typeof translation?.explanation!=='string'||Object.keys(translation).sort().join(',')!=='explanation,hint,instruction,prompt')fail('missing_explanation')}
  if(item.snapshot.type==='multiple_choice'&&item.snapshot.content.question!==`Welcher bestimmte Artikel gehört zu „${r.noun}“?`)fail('source_question_mismatch')
  if(item.snapshot.type==='fill_in_blank'&&(item.snapshot.content.text_before!==''||item.snapshot.content.text_after!==ev.task.span.replace(/^\([^)]*\) /,'')))fail('source_sentence_mismatch')
 }
 let total=0;for(const [stratum,quota] of Object.entries(pool.blueprint)){if(!Number.isInteger(quota)||quota<1||quota>10||pool.items.filter(i=>i.stratum===stratum).length<2*quota)fail('insufficient_balanced_stratum');total+=quota}if(total!==10)fail('invalid_test_size')
 const forms=twoForms(pool);if(forms.some(form=>form.length!==10||new Set(form).size!==10)||forms[0].some(id=>forms[1].includes(id)))fail('non_disjoint_forms')
 const audio=draft.audioManifest;if(audio.profile!=='sitov-qwen-male-de-v1'||audio.status!=='unprepared'||new Set(audio.aliases.map(a=>a.textSha256)).size!==audio.aliases.length)fail('unsafe_audio_claim')
 for(const alias of audio.aliases)if(alias.profile!==audio.profile||alias.status!=='unprepared'||alias.textSha256!==sha(alias.text)||alias.id!=='sitov-audio-'+alias.textSha256||!alias.uses.length)fail('invalid_audio_alias')
 const audible=audibleTexts(pool)
 for(const text of audible)if(!audio.aliases.some(a=>a.text===text&&a.requiredBy95===true))fail('missing_95_audio_text')
 for(const alias of audio.aliases)if(alias.requiredBy95!==audible.includes(alias.text))fail('invalid_audio_requirement_flag')
 return {items:pool.items.length,blueprint:pool.blueprint,forms,audible95:audibleTexts(pool).length,audioAliases:audio.aliases.length,binding:pool.status,sourceFilesVerified:verifySources}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const draft=JSON.parse(readFileSync(resolve(repo,'supabase/seeds/sitov-learning-special-pools-2026-10-08.json'),'utf8'));console.log(JSON.stringify(validateSpecialDraft(draft,{verifySources:true}),null,2))
}
