import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
export const sitovHash = text => createHash('sha256').update(text,'utf8').digest('hex')
const read = async path => JSON.parse(await readFile(path,'utf8'))
const norm = value => value.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]+/gu,' ').trim()
const id = /^sitov[.:-][a-zA-Z0-9._:-]{1,90}$/
const fields = line => {
 const values=line.match(/VALUES \((.*)\) ON CONFLICT DO NOTHING;$/)?.[1]
 if(!values)throw Error('Unsupported source INSERT')
 return [...values.matchAll(/'(?:''|[^'])*'|\bNULL\b|\btrue\b|\bfalse\b|-?\d+/g)].map(([v])=>v.startsWith("'")?v.slice(1,-1).replaceAll("''","'"):v==='NULL'?null:v==='true'?true:v==='false'?false:Number(v))
}
/** Offline canonical repository inventory; this does not query live/custom accounts. */
export async function sitovReadAuthoringSources(root=process.cwd()) {
 const sql=await readFile(resolve(root,'supabase/seeds/vps-content.sql'),'utf8'),units=new Map(),rows=[]
 for(const line of sql.split('\n')) {
  if(line.startsWith('INSERT INTO public.learning_units ')){const [id,level,trainer,title,sortOrder,active]=fields(line);units.set(id,{level,trainer,title,sortOrder,active})}
  if(line.startsWith('INSERT INTO public.learning_reading_texts ')){const [id,text,focus,audioUrl,createdAt,unitId]=fields(line);rows.push({id,text,focus,audioUrl,createdAt,unitId})}
 }
 const revisions=await read(resolve(root,'supabase/seeds/sitov-pronunciation-revisions-2026.json'))
 for(const revision of revisions){const row=rows.find(r=>r.id===revision.id);if(!row||![revision.oldText,revision.text].includes(row.text))throw Error('Revision does not match stored body');row.text=revision.text;units.get(row.unitId).title=revision.title;row.revisionSource='supabase/seeds/sitov-pronunciation-revisions-2026.json'}
 const catalog=await read(resolve(root,'supabase/seeds/pronunciation-reading-2026.json'))
 const result=rows.map(row=>({...row,...units.get(row.unitId),textVersion:sitovHash(row.text)}))
 for(const entry of catalog){const row=result.find(r=>r.id===entry.id);if(!row||row.text!==entry.text||row.level!==entry.level||row.title!==entry.title||row.sortOrder!==entry.sortOrder||!row.active)throw Error('Canonical reading catalog/source mismatch')}
 if(result.length!==149||catalog.length!==60||result.filter(r=>r.active).length!==60||new Set(result.map(r=>r.id)).size!==149)throw Error('Unexpected inventory; review all source changes')
 const mapping=await readFile(resolve(root,'lib/learning/sitov-topic-mapping.ts'),'utf8')
 const topics=JSON.parse(mapping.match(/export const SITOV_TOPIC_MAPPING[^=]*=\s*(\[[\s\S]*?\n\])/u)?.[1]??'null')
 if(!Array.isArray(topics)||!topics.length||new Set(topics.map(t=>t.topicId)).size!==topics.length||topics.some(t=>!id.test(t.topicId)||!['A1.1','A1.2'].includes(t.level)||[...(t.anchors??[]),...(t.targets??[]),...(t.specialTargets??[])].some(target=>target.level!==t.level)))throw Error('Invalid canonical topic-level evidence')
 return {rows:result,topicIds:new Set(topics.map(t=>t.topicId)),topicLevels:new Map(topics.map(t=>[t.topicId,t.level]))}
}
/** Strict draft contract checks, never a semantic grader or a publication command. */
export function sitovValidatePretestDrafts(manifest,sources) {
 const errors=[],fail=(path,reason)=>errors.push(`${path}:${reason}`),expected=sources.rows.filter(r=>r.active),seen=new Set()
 if(manifest.schemaVersion!==1||manifest.private!==true||manifest.active!==false||manifest.publicationStatus!=='draft_only')fail('manifest','private inactive draft required')
 if(manifest.coverage?.total!==60||manifest.coverage?.authored!==manifest.drafts?.length||manifest.coverage?.pending!==60-manifest.drafts?.length)fail('coverage','counts')
 if(!Array.isArray(manifest.inventory)||manifest.inventory.length!==60)fail('inventory','all60 required')
 for(const row of manifest.inventory??[]){const source=expected.find(s=>s.id===row.textId);if(!source||seen.has(row.textId)||row.textVersion!==source.textVersion||row.unitId!==source.unitId||row.level!==source.level||row.sortOrder!==source.sortOrder||row.title!==source.title||row.focus!==source.focus||row.sourceAudioUrl!==source.audioUrl||row.active!==true)fail(`inventory.${row.textId}`,'exact source mismatch/duplicate');seen.add(row.textId)}
 const draftIds=new Set()
 for(const draft of manifest.drafts??[]){
  const path=`draft.${draft.textId}`,source=expected.find(s=>s.id===draft.textId)
  if(!source||draftIds.has(draft.textId)||draft.textVersion!==source.textVersion||draft.unitId!==source.unitId||draft.level!==source.level||draft.active!==false)fail(path,'exact current inactive source required');draftIds.add(draft.textId)
  if(!source)continue
  const def=draft.definition
  if(def?.policyId!=='sitov-pronunciation-language-prerequisites-v1'||draft.policy?.minimumPerCore!==3||draft.policy?.coreFraction!=='2/3'||draft.policy?.totalFraction!=='3/4')fail(path,'policy')
  const review=draft.review
  if(!review?.reviewer?.trim()||!review?.notesDe?.trim()||!['author_checked_teacher_review_pending','author_checked_independent_review_pending','independent_approved','independent_editorial_checked_draft_only'].includes(review?.status))fail(path,'explicit review limits required')
  if(review?.status==='author_checked_independent_review_pending'&&(review.authorIdentity!==review.reviewer||review.humanReview!==false||review.calibrationStatus!=='pending'))fail(path,'author-only review must retain independent/calibration limits')
  if(['independent_approved','independent_editorial_checked_draft_only'].includes(review?.status)&&(!review.authorIdentity?.trim()||review.authorIdentity===review.reviewer||review.textVersion!==draft.textVersion||review.definitionContentHash!==sitovHash(JSON.stringify(def))||!/^sitov[.:-]editorial[.:-]review[.:-]/.test(review.documentRef??'')||!/^[a-f0-9]{64}$/.test(review.documentSha256??'')||!Number.isFinite(Date.parse(review.reviewedAt))||Date.parse(review.reviewedAt)>Date.now()))fail(path,'independent exact-version review provenance required')
  if(review?.status==='independent_editorial_checked_draft_only'&&(review.reviewerKind!=='independent_agent_editorial_review'||review.humanReview!==false||review.calibrationStatus!=='pending'))fail(path,'agent review must retain honest human/calibration limits')
  const checkSpans=(spans,p)=>{if(!Array.isArray(spans)||!spans.length){fail(p,'source spans required');return}for(const span of spans)if(!Number.isInteger(span.start)||!Number.isInteger(span.end)||span.start<0||span.end<=span.start||Array.from(source.text).slice(span.start,span.end).join('')!==span.quote||!span.quote?.trim())fail(p,'exact body evidence required')}
  const cores=def?.competencies??[],coreIds=new Set(),categories=new Set()
  if(!cores.length)fail(path,'empty matrix')
  for(const core of cores){const cp=path+'.'+core.id;if(!id.test(core.id)||coreIds.has(core.id)||core.itemsPerAttempt!==3)fail(cp,'unique core/minimum');coreIds.add(core.id);categories.add(core.category);checkSpans(core.sourceSpans,cp);if(!core.necessityDe?.trim()||!Array.isArray(core.languageUnits)||core.languageUnits.length<3)fail(cp,'language matrix/necessity');if(!Array.isArray(core.mapping?.topicIds)||core.mapping.topicIds.some(t=>!sources.topicIds.has(t))||(!core.mapping.topicIds.length&&!core.mapping.pendingReasonDe?.trim()))fail(cp,'verified mapping or explicit gap');if(Array.isArray(core.mapping?.topicIds)&&core.mapping.topicIds.some(t=>sources.topicIds.has(t)&&sources.topicLevels?.get(t)!==draft.level))fail(cp,'same-level topic mapping required')}
  for(const c of ['vocabulary','verb_forms','syntax','nominal_forms'])if(!categories.has(c)&&!def?.omittedCategories?.some(o=>o.category===c&&typeof o.reasonDe==='string'&&Array.from(o.reasonDe.trim()).length>=20))fail(path,'missing matrix or justified absence '+c)
  if(!Array.isArray(def?.omittedCategories)||def.omittedCategories.some(c=>!c.category?.trim()||typeof c.reasonDe!=='string'||Array.from(c.reasonDe.trim()).length<20))fail(path,'absent categories need reasons')
  const taskIds=new Set(),equivalences=new Set(),prompts=new Set(),semanticUnits=new Set(),tasks=def?.tasks??[]
  for(const q of tasks){const qp=path+'.'+q.id;checkSpans(q.sourceSpans,qp);if(!id.test(q.id)||taskIds.has(q.id)||!coreIds.has(q.competencyId)||q.kind!=='single_choice'||typeof q.promptDe!=='string'||!q.promptDe.trim()||q.promptDe.length>500||q.fragmentDe!==null)fail(qp,'task shape/unique/private fragment');taskIds.add(q.id)
   const eq=q.competencyId+':'+norm(q.equivalenceKey??''),prompt=norm(q.promptDe??''),unit=q.competencyId+':'+norm(q.assessmentUnit??'');if(!q.equivalenceKey?.trim()||equivalences.has(eq)||prompts.has(prompt)||!q.assessmentUnit?.trim()||semanticUnits.has(unit))fail(qp,'repeated/equivalent item');equivalences.add(eq);prompts.add(prompt);semanticUnits.add(unit)
   if(typeof q.rationaleDe!=='string'||q.rationaleDe.length<35)fail(qp,'private rationale required')
   const options=q.options??[];if(options.length<3||options.length>5||new Set(options.map(o=>o.id)).size!==options.length||new Set(options.map(o=>norm(o.textDe??''))).size!==options.length||options.some(o=>!id.test(o.id)||typeof o.textDe!=='string'||!o.textDe.trim()||o.textDe.length>300)||options.filter(o=>o.id===q.correctOptionId).length!==1)fail(qp,'single key/distinct options')
  }
  for(const core of cores){const pool=tasks.filter(q=>q.competencyId===core.id);if(pool.length<2*core.itemsPerAttempt)fail(path+'.'+core.id,'two complete pools required');if(pool.some(q=>!core.languageUnits?.includes(q.assessmentUnit))||core.languageUnits?.some(unit=>!pool.some(q=>q.assessmentUnit===unit)))fail(path+'.'+core.id,'matrix units and assessed units must correspond')}
  const forms=def?.reviewForms??[]
  if(forms.length!==2)fail(path,'two balanced review forms required')
  const formUsed=new Set()
  for(const form of forms){if(!Array.isArray(form.questionIds)){fail(path,'form question IDs required');continue}for(const qid of form.questionIds){if(!taskIds.has(qid)||formUsed.has(qid))fail(path,'foreign/shared form item');formUsed.add(qid)}for(const core of cores)if(form.questionIds.filter(id=>tasks.find(q=>q.id===id)?.competencyId===core.id).length!==core.itemsPerAttempt)fail(path,'unbalanced form')}
 }
 for(const row of manifest.inventory??[])if(row.coverageStatus!==(draftIds.has(row.textId)?'draft_authored':'pending'))fail('coverage.'+row.textId,'status mismatch')
 return errors
}
/** Only spoken public fields; keys, IDs, source spans and rationales never become audio text. */
export function sitovPublicPretestAudioAliases(manifest) {
 const aliases={}
 for(const draft of manifest.drafts??[])for(const q of draft.definition?.tasks??[]){const prefix=`sitov-pretest:${draft.textId}:${q.id}`;aliases[prefix+':prompt']=q.promptDe;if(q.fragmentDe?.trim())aliases[prefix+':fragment']=q.fragmentDe;for(const option of q.options??[])aliases[prefix+':'+option.id]=option.textDe}
 return aliases
}
export function sitovValidatePretestAudioAliases(manifest,aliases) {
 const expected=sitovPublicPretestAudioAliases(manifest),errors=[]
 for(const [key,value] of Object.entries(expected))if(aliases[key]!==value)errors.push(`audio.${key}:exact public text required`)
 for(const key of Object.keys(aliases))if(!Object.hasOwn(expected,key))errors.push(`audio.${key}:foreign/private alias`)
 return errors
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const source=await sitovReadAuthoringSources(),manifest=await read('supabase/seeds/sitov-pronunciation-pretests-2026-10-08.json'),aliases=await read('supabase/seeds/sitov-pronunciation-pretest-audio-2026-10-08.json'),errors=[...sitovValidatePretestDrafts(manifest,source),...sitovValidatePretestAudioAliases(manifest,aliases)]
 if(errors.length){console.error('Sitov pretest authoring validation failed. Use the authoring validator for detailed checks.');process.exitCode=1}else console.log(`PASS: ${manifest.drafts.length}/60 private drafts; ${60-manifest.drafts.length} pending; ${Object.keys(aliases).length} public audio aliases; 89 inactive legacy; no publication/audio/live DB proof.`)
}
