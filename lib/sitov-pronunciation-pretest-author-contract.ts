import { z } from 'zod'
import { sitovPronunciationPretestActionResultSchema } from './sitov-pronunciation-pretest-contract'
const id=z.string().regex(/^sitov[.:-][a-zA-Z0-9._:-]{1,90}$/),hash=z.string().regex(/^[a-f0-9]{64}$/)
const text=(max:number)=>z.string().min(1).max(max).refine(v=>Boolean(v.trim()),'empty_text')
const span=z.object({start:z.number().int().nonnegative(),end:z.number().int().positive(),quote:text(10000)}).strict().refine(s=>s.end>s.start,'invalid_span')
const option=z.object({id,textDe:text(300)}).strict()
const task=z.object({id,competencyId:id,kind:z.literal('single_choice'),promptDe:text(500),fragmentDe:text(300).nullable(),options:z.array(option).min(3).max(5),correctOptionId:id,assessmentUnit:text(200),equivalenceKey:text(200),sourceSpans:z.array(span).min(1).max(100),rationaleDe:text(3000).refine(v=>v.trim().length>=35,'short_rationale')}).strict().refine(q=>new Set(q.options.map(o=>o.id)).size===q.options.length&&new Set(q.options.map(o=>o.textDe.trim())).size===q.options.length&&q.options.some(o=>o.id===q.correctOptionId),'invalid_options')
export const sitovPretestAuthorDefinitionSchema=z.object({
 policyId:z.literal('sitov-pronunciation-language-prerequisites-v1'),
 competencies:z.array(z.object({id,category:text(100),itemsPerAttempt:z.number().int().min(3).max(40),necessityDe:text(3000),languageUnits:z.array(text(200)).min(3).max(1000),sourceSpans:z.array(span).min(1).max(100),mapping:z.object({topicIds:z.array(id).max(100),pendingReasonDe:text(3000).optional()}).strict()}).strict()).min(1).max(40),
 tasks:z.array(task).min(6).max(1000),omittedCategories:z.array(z.object({category:text(100),reasonDe:text(3000)}).strict()).min(1).max(40),reviewForms:z.array(z.object({id,questionIds:z.array(id).min(3).max(120)}).strict()).length(2),
}).strict().superRefine((d,ctx)=>{
 const ids=new Set(d.tasks.map(q=>q.id)),cores=new Set(d.competencies.map(c=>c.id)),used=d.reviewForms.flatMap(f=>f.questionIds)
 if(ids.size!==d.tasks.length||cores.size!==d.competencies.length||used.length!==new Set(used).size||used.some(q=>!ids.has(q))||d.tasks.some(q=>!cores.has(q.competencyId))||d.competencies.reduce((n,c)=>n+c.itemsPerAttempt,0)>120)ctx.addIssue({code:'custom',message:'invalid_pool'})
 for(const c of d.competencies)if(d.tasks.filter(q=>q.competencyId===c.id).length<2*c.itemsPerAttempt||d.reviewForms.some(f=>f.questionIds.filter(id=>d.tasks.find(q=>q.id===id)?.competencyId===c.id).length!==c.itemsPerAttempt))ctx.addIssue({code:'custom',message:'unbalanced_core'})
})
export const sitovPretestAuthorSaveInputSchema=z.object({textId:z.uuid(),textVersion:hash,baseDefinitionId:z.uuid().nullable(),definition:sitovPretestAuthorDefinitionSchema,requestId:z.uuid()}).strict()
// Same staffDefinition transport shape already used by the private staff read.
export const sitovPretestStaffDefinitionSchema=z.object({id:z.uuid(),text_id:z.uuid(),text_version:hash,test_version:hash,definition:z.record(z.string(),z.unknown()),active:z.boolean(),created_at:z.iso.datetime({offset:true})}).strict()
export const sitovPretestAuthorSavedSchema=sitovPretestStaffDefinitionSchema.extend({definition:sitovPretestAuthorDefinitionSchema,active:z.literal(false)}).strict()
export const sitovPretestAuthorSaveResultSchema=sitovPronunciationPretestActionResultSchema(sitovPretestAuthorSavedSchema)
export type SitovPretestAuthorSaveInput=z.infer<typeof sitovPretestAuthorSaveInputSchema>
