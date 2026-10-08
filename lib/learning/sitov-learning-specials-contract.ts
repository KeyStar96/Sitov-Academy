import { z } from 'zod'
import { pathAnswerSchema, pathExerciseSchema } from '@/lib/learning-path-contract'
export const sitovSpecialErrors = ['authentication_required','invalid_input','not_found','authoring_not_ready','version_conflict','request_conflict','scope_insufficient_for_test','attempt_completed','revision_conflict','reveal_required','invalid_answer','incomplete_attempt','retryable_failure'] as const
export const sitovSpecialInputSchema = z.object({
 operation: z.enum(['start','get','reveal','right','wrong','save','submit']), nodeId:z.uuid().optional(),runId:z.uuid().optional(),
 mode:z.enum(['learning','test']).optional(),revision:z.number().int().nonnegative().optional(),requestId:z.uuid().optional(),
 answers:z.record(z.uuid(),pathAnswerSchema).optional(),locale:z.enum(['de','en','ru','uk','tr']).default('de'),
}).strict().superRefine((v,ctx)=>{
 if(v.operation==='start' ? !v.nodeId||!v.mode||!v.requestId : !v.runId)ctx.addIssue({code:'custom',message:'invalid_identity'})
 if(!['start','get'].includes(v.operation)&& (v.revision===undefined||!v.requestId))ctx.addIssue({code:'custom',message:'revision_request_required'})
 if(['save','submit'].includes(v.operation)&&!v.answers)ctx.addIssue({code:'custom',message:'answers_required'})
})
const privateSolution=z.object({content:z.record(z.string(),z.unknown()),explanation:z.string().nullable()}).strict()
export const sitovSpecialRunSchema=z.object({
 runId:z.uuid(),nodeId:z.uuid(),definitionVersion:z.string().regex(/^[a-f0-9]{64}$/),mode:z.enum(['learning','test']),status:z.enum(['in_progress','completed']),revision:z.number().int().nonnegative(),
 selected:z.array(z.uuid()).min(1).max(1000),queue:z.array(z.uuid()).max(1000),revealed:z.boolean(),answers:z.record(z.uuid(),pathAnswerSchema),tasks:z.array(pathExerciseSchema).max(1000),
 learningSolution:privateSolution.nullable(),result:z.object({correct:z.number().int().min(0).max(10),total:z.literal(10),passed:z.boolean(),feedback:z.array(z.object({itemId:z.uuid(),correct:z.boolean(),solution:z.record(z.string(),z.unknown()),explanation:z.string().nullable()}).strict()).length(10)}).strict().nullable(),
}).strict().superRefine((r,ctx)=>{
 const ids=new Set(r.selected)
 if(ids.size!==r.selected.length||new Set(r.queue).size!==r.queue.length||r.queue.some(id=>!ids.has(id))||r.tasks.length!==ids.size||new Set(r.tasks.map(t=>t.id)).size!==ids.size||r.tasks.some(t=>!ids.has(t.id))||Object.keys(r.answers).some(id=>!ids.has(id)))ctx.addIssue({code:'custom',message:'foreign_items'})
 if(r.mode==='test'&&(r.selected.length!==10||r.revealed||r.learningSolution||(r.status==='completed')!==Boolean(r.result)))ctx.addIssue({code:'custom',message:'invalid_test'})
 if(r.result&&(new Set(r.result.feedback.map(f=>f.itemId)).size!==10||r.result.feedback.some(f=>!ids.has(f.itemId))||r.result.feedback.filter(f=>f.correct).length!==r.result.correct))ctx.addIssue({code:'custom',message:'invalid_feedback'})
 if(r.result&&r.result.passed!==(r.result.correct>=8))ctx.addIssue({code:'custom',message:'invalid_grade'})
 if(r.mode==='learning'&&(r.result||Boolean(r.learningSolution)!==r.revealed||(r.status==='completed')!==(r.queue.length===0)))ctx.addIssue({code:'custom',message:'invalid_learning'})
})
export const sitovSpecialResultSchema=z.discriminatedUnion('ok',[
 z.object({ok:z.literal(true),data:sitovSpecialRunSchema}).strict(),
 z.object({ok:z.literal(false),error:z.enum(sitovSpecialErrors),retryable:z.boolean()}).strict(),
])
export type SitovSpecialResult=z.infer<typeof sitovSpecialResultSchema>
