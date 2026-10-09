import { z } from 'zod'
import { learningPathContentSchemas } from '@/lib/learning-path-schema'
import { sitovSpecialRunSchema } from './sitov-learning-specials-contract'
const hash=z.string().regex(/^[a-f0-9]{64}$/)
const translated=z.object({instruction:z.string().nullable().optional(),hint:z.string().nullable().optional(),explanation:z.string().nullable().optional(),prompt:z.string().nullable().optional()}).strict()
const snapshot=z.object({id:z.uuid(),type:z.enum(['multiple_choice','fill_in_blank','sentence_building']),content:z.json(),goal_id:z.string(),translations:z.partialRecord(z.enum(['de','en','ru','uk','tr']),translated)}).strict().superRefine((v,ctx)=>{
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

const sourceRef=z.literal('sitov.source.a11.wohnung.artikel.pdf.v1')
const sourceSha=z.literal('d59dd2bb1f019e6f9945347e69320245a18881ac53769de9a6a7328a38a8d507')
const span=z.object({page:z.number().int().min(1).max(8),exercise:z.string().min(1).max(100),item:z.number().int().positive(),span:z.string().min(1).max(4000)}).strict()
const sourceEvidence=z.object({sourceRef,sourceSha256:sourceSha,task:span,solution:span,adaptation:z.string().min(1).max(4000),rationale:z.object({noun:z.string().min(1).max(200),article:z.enum(['der','die','das']),case:z.literal('Nominativ'),number:z.literal('singular'),gender:z.enum(['masculine','feminine','neuter']),fictionalCharacters:z.array(z.never()).length(0)}).strict()}).strict()
const authorItem=z.object({id:z.uuid(),stableId:z.string().regex(/^sitov-special-a11-artikel-nominativ-v1-item-[0-9]{3}$/),stratum:z.enum(['masculine','feminine','neuter']),snapshot,sourceEvidence}).strict().refine(v=>v.id===v.snapshot.id&&v.snapshot.goal_id==='P4-G1'&&v.sourceEvidence.rationale.gender===v.stratum&&[1,2].includes(v.sourceEvidence.task.page)&&[5,6].includes(v.sourceEvidence.solution.page))
export const sitovSpecialAuthorContextInputSchema=z.object({unitId:z.uuid(),anchorNodeId:z.uuid(),sourceRef}).strict()
export const sitovSpecialAuthorInputSchema=z.object({requestId:z.uuid(),unitId:z.uuid(),anchorNodeId:z.uuid(),sourceRef,sourceSha256:sourceSha,expectedAnchorVersion:hash,specialSourceId:z.literal('sitov-special-a11-artikel-nominativ-v1'),title:z.string().min(1).max(200),topic:z.string().min(1).max(200),goalId:z.literal('P4-G1'),blueprint:z.object({masculine:z.number().int().min(1).max(10),feminine:z.number().int().min(1).max(10),neuter:z.number().int().min(1).max(10)}).strict(),items:z.array(authorItem).min(20).max(100)}).strict().superRefine((v,ctx)=>{
 if(new Set(v.items.map(i=>i.id)).size!==v.items.length||new Set(v.items.map(i=>i.stableId)).size!==v.items.length)ctx.addIssue({code:'custom',message:'duplicate_items'})
 if(Object.values(v.blueprint).reduce((a,b)=>a+b,0)!==10||Object.entries(v.blueprint).some(([stratum,quota])=>v.items.filter(i=>i.stratum===stratum).length<2*quota))ctx.addIssue({code:'custom',message:'unbalanced_pool'})
})
const authorFailure=z.object({ok:z.literal(false),error:z.enum(['authentication_required','invalid_input','not_found','source_conflict','stale_revision','request_conflict','already_exists','item_conflict','retryable_failure']),retryable:z.boolean()}).strict().refine(v=>v.retryable===(v.error==='retryable_failure'))
export const sitovSpecialAuthorContextResultSchema=z.discriminatedUnion('ok',[
 z.object({ok:z.literal(true),data:z.object({unitId:z.uuid(),anchorNodeId:z.uuid(),sourceRef,sourceSha256:sourceSha,anchorVersion:hash,specialExists:z.boolean()}).strict()}).strict(),authorFailure,
])
export const sitovSpecialAuthorResultSchema=z.discriminatedUnion('ok',[
 z.object({ok:z.literal(true),data:z.object({nodeId:z.uuid(),unitId:z.uuid(),anchorNodeId:z.uuid(),definitionId:z.uuid(),definitionVersion:hash,sourceRef,sourceSha256:sourceSha,itemIds:z.array(z.uuid()).min(20).max(100),active:z.literal(false),published:z.literal(false)}).strict()}).strict(),authorFailure,
])
export type SitovSpecialAuthorResult=z.infer<typeof sitovSpecialAuthorResultSchema>
export type SitovSpecialAuthorContextResult=z.infer<typeof sitovSpecialAuthorContextResultSchema>
