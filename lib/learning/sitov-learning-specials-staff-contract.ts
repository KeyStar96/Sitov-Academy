import { z } from 'zod'
import { learningPathContentSchemas } from '@/lib/learning-path-schema'
import { sitovSpecialRunSchema } from './sitov-learning-specials-contract'
const hash=z.string().regex(/^[a-f0-9]{64}$/)
const translated=z.object({instruction:z.string().nullable().optional(),hint:z.string().nullable().optional(),explanation:z.string().nullable().optional(),prompt:z.string().nullable().optional()}).strict()
const snapshot=z.object({id:z.uuid(),type:z.enum(['multiple_choice','fill_in_blank','sentence_building']),content:z.unknown(),goal_id:z.string(),translations:z.partialRecord(z.enum(['de','en','ru','uk','tr']),translated)}).strict().superRefine((v,ctx)=>{
 if(!learningPathContentSchemas[v.type].safeParse(v.content).success)ctx.addIssue({code:'custom',message:'invalid_snapshot'})
})
const item=z.object({id:z.uuid(),stratum:z.string().min(1).max(120),snapshot}).strict().refine(v=>v.id===v.snapshot.id)
const definition=z.object({id:z.uuid(),node_id:z.uuid(),version:hash,source_ref:z.string().min(1).max(500),blueprint:z.record(z.string(),z.number().int().min(1).max(10)),pool:z.array(item).max(1000),published:z.boolean(),
 editorial_proof:z.object({reviewId:z.uuid(),definitionVersion:hash,sourceSha256:hash}).strict().nullable(),
 audio_import_proof:z.object({definitionVersion:hash,assets:z.array(z.object({textSha256:hash,audioSha256:hash,path:z.string().min(1).max(1000)}).strict()).max(10000)}).strict().nullable(),
 created_by:z.uuid().nullable(),created_at:z.string().min(1),
}).strict().refine(d=>new Set(d.pool.map(i=>i.id)).size===d.pool.length)
const run=z.object({id:z.uuid(),studentId:z.uuid(),mode:z.enum(['learning','test']),status:z.enum(['in_progress','completed']),revision:z.number().int().nonnegative(),result:sitovSpecialRunSchema.shape.result}).strict()
export const sitovSpecialStaffInputSchema=z.object({nodeId:z.uuid()}).strict()
export const sitovSpecialStaffResultSchema=z.discriminatedUnion('ok',[
 z.object({ok:z.literal(true),data:z.object({definitions:z.array(definition).max(1000),runs:z.array(run).max(10000)}).strict()}).strict(),
 z.object({ok:z.literal(false),error:z.enum(['authentication_required','invalid_input','not_found','retryable_failure']),retryable:z.boolean()}).strict(),
])
export type SitovSpecialStaffResult=z.infer<typeof sitovSpecialStaffResultSchema>
