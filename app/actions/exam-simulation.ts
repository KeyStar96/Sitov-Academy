'use server'
import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/utils/supabase/admin'
import { EXAM_AUDIO_MIME_TYPES, EXAM_BUCKET, EXAM_MAX_UPLOAD_BYTES } from '@/lib/exam-preparation/server'
import { SIMULATION_LEVELS, getSimulationProfile } from '@/lib/exam-simulation/catalogue'
import { buildSimulation, finishSimulation, submitSimulationAnswer, reviewSimulationTask, publicSimulation, type StoredSimulationSession } from '@/lib/exam-simulation/engine'
import {
 getSimulationActor, hasSimulationFeatureAccess, requireSimulationLevel, loadSimulationState, loadSimulationRun, simulationSnapshot,
 simulationHash, persistSimulationChange, presentSimulation, preparedSimulationAudio, finishExpiredSimulation,
 verifySimulationAnswerMedia, loadSimulationTeacherState, requireSimulationStudentManagement, type SimulationTeacherState,
} from '@/lib/exam-simulation/server'
import type { Json } from '@/supabase/database.types'
import type { SimulationActionResult, SimulationAnswer, SimulationLevel, SimulationMode, SimulationProvider, SimulationState } from '@/lib/exam-simulation/types'

const uuid=z.uuid(),key=z.string().min(1).max(160)
const startSchema=z.object({level:z.enum(SIMULATION_LEVELS as [SimulationLevel,...SimulationLevel[]]),provider:z.literal('sitov').default('sitov'),mode:z.enum(['practice','exam']).default('exam'),requestId:uuid})
const answerSchema=z.union([z.string().max(20000),z.array(z.string().max(1000)).max(100),z.object({text:z.string().max(20000),audioPath:z.string().max(300).optional()})])
const saveSchema=z.object({runId:uuid,taskId:key,answer:answerSchema,requestId:uuid})
const refresh=()=>{try{revalidatePath('/[lang]/dashboard/exam-simulation','page');revalidatePath('/[lang]/admin/exam-simulation','page')}catch{console.error('Simulation saved; refresh failed')}}
function message(error:unknown):string {
 if(error instanceof z.ZodError)return 'Bitte prüfe deine Eingaben.'
 if(error instanceof Error&&!/postgres|supabase|secret|service_role|relation|column|violates|fingerprint/i.test(error.message))return error.message
 return 'Der Prüfungsdurchgang ist derzeit nicht verfügbar. Bitte versuche es erneut.'
}
const failure=(error:unknown):SimulationActionResult=>({success:false,error:message(error)})
export async function getSimulationState():Promise<SimulationState>{try{const actor=await getSimulationActor();if(!hasSimulationFeatureAccess(actor.profile))return {available:false,accessLocked:true,error:'Die simulierte Prüfung ist für dich noch nicht freigegeben. Bitte wende dich an deine Lehrkraft.',active:null,history:[]};return await loadSimulationState(actor)}catch(error){return {available:false,error:message(error),active:null,history:[]}}}

export async function startExamSimulation(input:{level:SimulationLevel;provider?:SimulationProvider;mode?:SimulationMode;requestId:string}):Promise<SimulationActionResult>{try{
 const value=startSchema.parse(input),actor=await getSimulationActor();requireSimulationLevel(actor,value.level)
 const profile=getSimulationProfile(value.level,value.provider)
 if(!profile.available)throw new Error('Die Aufgaben für dieses Niveau werden noch vorbereitet.')
 if(value.mode!=='exam')throw new Error('Starte die vollständige simulierte Prüfung. Kurze Lernchecks gehören zur Prüfungsvorbereitung.')
 const admin=createAdminClient(),hash=simulationHash({level:value.level,provider:value.provider,mode:value.mode})
 const prior=await admin.from('sitov_simulation_runs').select('*').eq('student_id',actor.userId).eq('start_request_id',value.requestId).maybeSingle()
 if(prior.error)throw new Error('Der Prüfungsdurchgang konnte nicht vorbereitet werden.')
 if(prior.data){if(prior.data.start_request_hash!==hash)throw new Error('Diese Startanfrage gehört zu einem anderen Prüfungsdurchgang.');return {success:true,session:await presentSimulation(await finishExpiredSimulation(prior.data))}}
 const state=await loadSimulationState(actor)
 if(state.active){if(state.active.level!==value.level||state.active.provider!==value.provider||state.active.mode!==value.mode)throw new Error('Beende zuerst deinen laufenden Durchgang. Danach kannst du eine neue Prüfung starten.');return {success:true,session:state.active}}
 const previousTaskIds=state.history.filter(session=>session.level===value.level).flatMap(session=>session.tasks.map(task=>task.id))
 const snapshot=buildSimulation({level:value.level,provider:value.provider,mode:value.mode,previousTaskIds,preparedAudio:await preparedSimulationAudio(value.level)})
 const saved=await admin.from('sitov_simulation_runs').insert({id:snapshot.id,student_id:actor.userId,generation:actor.simulationGeneration,level:snapshot.level,provider:snapshot.provider,mode:snapshot.mode,status:snapshot.status,started_at:snapshot.startedAt,expires_at:snapshot.expiresAt,completed_at:null,start_request_id:value.requestId,start_request_hash:hash,server_snapshot:snapshot as unknown as Json}).select('*').single()
 if(saved.error||!saved.data){
  if(saved.error?.code==='23505'){
   const concurrent=await admin.from('sitov_simulation_runs').select('*').eq('student_id',actor.userId).eq('status','active').maybeSingle()
   if(concurrent.data&&concurrent.data.level===value.level&&concurrent.data.provider===value.provider&&concurrent.data.mode===value.mode)return {success:true,session:await presentSimulation(simulationSnapshot(concurrent.data))}
  }
  throw new Error('Der Prüfungsdurchgang konnte nicht gestartet werden. Bitte versuche es erneut.')
 }
 refresh();return {success:true,session:await presentSimulation(simulationSnapshot(saved.data))}
}catch(error){return failure(error)}}

async function replay(actor:Awaited<ReturnType<typeof getSimulationActor>>,runId:string,requestId:string,kind:'answer'|'finish'|'review',payload:unknown,studentId=actor.userId){
 const {data,error}=await createAdminClient().from('sitov_simulation_receipts').select('*').eq('student_id',studentId).eq('request_id',requestId).maybeSingle()
 if(error)throw new Error('Die Speicheranfrage konnte nicht geprüft werden.')
 if(data&&(data.run_id!==runId||data.kind!==kind||data.payload_hash!==simulationHash(payload)))throw new Error('Diese Speicheranfrage wurde bereits für eine andere Eingabe verwendet.')
 return !!data
}
export async function saveSimulationAnswer(input:{runId:string;taskId:string;answer:SimulationAnswer;requestId:string}):Promise<SimulationActionResult>{try{
 const value=saveSchema.parse(input),actor=await getSimulationActor()
 const payload={runId:value.runId,taskId:value.taskId,answer:value.answer}
 for(let attempt=0;attempt<3;attempt++){
  const row=await loadSimulationRun(actor,value.runId),snapshot=simulationSnapshot(row)
  if(await replay(actor,value.runId,value.requestId,'answer',payload))return {success:true,session:await presentSimulation(snapshot)}
  await verifySimulationAnswerMedia(value.answer,actor.userId)
  const next=submitSimulationAnswer(snapshot,value.taskId,value.answer)
  const saved=await persistSimulationChange(row,next,value.requestId,'answer',payload)
  if(saved)return {success:true,session:await presentSimulation(saved)}
 }
 throw new Error('Der Durchgang wurde auf einem anderen Gerät aktualisiert. Bitte speichere deine Antwort erneut.')
}catch(error){return failure(error)}}
export async function finishExamSimulation(input:{runId:string;requestId:string}):Promise<SimulationActionResult>{try{
 const value=z.object({runId:uuid,requestId:uuid}).parse(input),actor=await getSimulationActor(),payload={runId:value.runId}
 for(let attempt=0;attempt<3;attempt++){
  const row=await loadSimulationRun(actor,value.runId),snapshot=simulationSnapshot(row)
  if(snapshot.status==='completed'){
   await replay(actor,value.runId,value.requestId,'finish',payload)
   return {success:true,session:await presentSimulation(snapshot)}
  }
  const saved=await persistSimulationChange(row,finishSimulation(snapshot),value.requestId,'finish',payload)
  if(saved){refresh();return {success:true,session:await presentSimulation(saved)}}
 }
 throw new Error('Der Durchgang wurde aktualisiert. Bitte öffne deine Auswertung erneut.')
}catch(error){return failure(error)}}

export async function createSimulationUpload(input:{runId:string;taskId:string;mimeType:string;bytes:number}):Promise<{success:boolean;error?:string;path?:string;token?:string;signedUrl?:string;bucket?:string}>{try{
 const value=z.object({runId:uuid,taskId:key,mimeType:z.string().min(1).max(100),bytes:z.number().int().min(1).max(EXAM_MAX_UPLOAD_BYTES)}).parse(input),actor=await getSimulationActor()
 const snapshot=simulationSnapshot(await loadSimulationRun(actor,value.runId))
 if(snapshot.status!=='active'||Date.now()>=Date.parse(snapshot.expiresAt))throw new Error('Die Prüfungszeit ist beendet. Eine Aufnahme kann jetzt nicht mehr ergänzt werden.')
 if(snapshot.tasks.find(task=>task.id===value.taskId)?.type!=='speaking')throw new Error('Diese Aufgabe benötigt keine Sprechaufnahme.')
 const mime=value.mimeType.split(';')[0].trim().toLowerCase()
 if(!(EXAM_AUDIO_MIME_TYPES as readonly string[]).includes(mime))throw new Error('Bitte verwende eine unterstützte Audiodatei.')
 const extensions:Record<string,string>={'audio/webm':'webm','audio/mp4':'m4a','audio/mpeg':'mp3','audio/ogg':'ogg','audio/wav':'wav','audio/x-wav':'wav','audio/x-m4a':'m4a'}
 const path=`${actor.userId}/speaking/${randomUUID()}.${extensions[mime]}`,admin=createAdminClient()
 const ticket=await admin.from('sitov_exam_upload_tickets').insert({path,student_id:actor.userId,kind:'speaking',simulation_run_id:snapshot.id})
 if(ticket.error)throw new Error('Die Aufnahme kann während eines Lerndaten-Resets nicht hochgeladen werden.')
 const {data,error}=await admin.storage.from(EXAM_BUCKET).createSignedUploadUrl(path,{upsert:false})
 if(error||!data)throw new Error('Die Aufnahme konnte nicht zum Hochladen vorbereitet werden.')
 return {success:true,path,token:data.token,signedUrl:data.signedUrl,bucket:EXAM_BUCKET}
}catch(error){return {success:false,error:message(error)}}}

export async function getSimulationTeacherState():Promise<SimulationTeacherState>{try{return await loadSimulationTeacherState(await getSimulationActor(true))}catch(error){return {success:false,error:message(error),actorRole:'teacher',runs:[],students:[],assignments:[],teachers:[],levelGrants:[],featureGrants:[]}}}
export async function grantSimulationFeature(input:{studentId:string;enabled:boolean}):Promise<{success:boolean;error?:string}>{try{
 const value=z.object({studentId:uuid,enabled:z.boolean()}).parse(input),actor=await getSimulationActor(true)
 await requireSimulationStudentManagement(actor,value.studentId)
 const admin=createAdminClient(),student=await admin.from('profiles').select('role').eq('id',value.studentId).maybeSingle()
 if(student.error||student.data?.role!=='student')throw new Error('Bitte wähle ein bestehendes Schülerprofil.')
 const saved=value.enabled?await admin.from('sitov_simulation_feature_grants').upsert({student_id:value.studentId,granted_by:actor.userId,granted_at:new Date().toISOString()}):await admin.from('sitov_simulation_feature_grants').delete().eq('student_id',value.studentId)
 if(saved.error)throw new Error('Die Freigabe der simulierten Prüfung konnte nicht gespeichert werden.')
 refresh();return {success:true}
}catch(error){return {success:false,error:message(error)}}}
/** The durable database job retains every private path until Storage confirms deletion. */
export async function resetStudentSimulationProgress(input:{studentId:string;requestId:string}):Promise<{success:boolean;error?:string;pending?:boolean}>{
 let started=false
 try {
  const value=z.object({studentId:uuid,requestId:uuid}).parse(input),actor=await getSimulationActor(true)
  await requireSimulationStudentManagement(actor,value.studentId)
  const admin=createAdminClient(),student=await admin.from('profiles').select('role').eq('id',value.studentId).maybeSingle()
  if(student.error||student.data?.role!=='student')throw new Error('Bitte wähle ein bestehendes Schülerprofil.')
  const begun=await admin.rpc('sitov_begin_simulation_reset',{p_student_id:value.studentId,p_staff_id:actor.userId,p_request_id:value.requestId})
  if(begun.error)throw new Error('Der Prüfungsfortschritt konnte nicht zurückgesetzt werden. Bitte versuche es erneut.')
  const job=z.object({jobId:uuid,status:z.enum(['pending','completed']),generation:z.number().int().nonnegative(),media:z.array(z.object({bucket:z.literal(EXAM_BUCKET),path:z.string().max(300)}))}).parse(begun.data)
  if(job.status==='completed'){refresh();return {success:true}}
  started=true
  if(job.media.some(media=>!media.path.startsWith(`${value.studentId}/speaking/`)||media.path.includes('..')))throw new Error('Die privaten Aufnahmewege konnten nicht geprüft werden.')
  const beganAt=Date.now()
  for(let offset=0;offset<job.media.length;offset+=100){
   if(Date.now()-beganAt>20000)return {success:false,pending:true,error:'Der Reset ist vorbereitet. Bitte wiederhole den Vorgang, um die übrigen privaten Aufnahmen zu entfernen.'}
   await requireSimulationStudentManagement(actor,value.studentId)
   const deleted=await admin.storage.from(EXAM_BUCKET).remove(job.media.slice(offset,offset+100).map(media=>media.path))
   if(deleted.error)throw new Error('Die privaten Aufnahmen konnten noch nicht vollständig entfernt werden.')
  }
  const completed=await admin.rpc('sitov_finish_simulation_reset',{p_job_id:job.jobId,p_staff_id:actor.userId})
  if(completed.error||completed.data!==true)throw new Error('Die Entfernung der privaten Aufnahmen ist noch nicht vollständig bestätigt.')
  refresh();return {success:true}
 }catch(error){
  return {success:false,...(started?{pending:true}:{}),error:started?'Der Prüfungsreset bleibt sicher zur Fortsetzung vorgemerkt. Bitte wiederhole den Vorgang.':message(error)}
 }
}
export async function grantSimulationLevel(input:{studentId:string;level:'B2'|'C1'|'C2';enabled:boolean}):Promise<{success:boolean;error?:string}>{try{
 const value=z.object({studentId:uuid,level:z.enum(['B2','C1','C2']),enabled:z.boolean()}).parse(input),actor=await getSimulationActor(true)
 await requireSimulationStudentManagement(actor,value.studentId)
 const admin=createAdminClient(),student=await admin.from('profiles').select('role').eq('id',value.studentId).maybeSingle()
 if(student.error||student.data?.role!=='student')throw new Error('Bitte wähle ein bestehendes Schülerprofil.')
 const saved=value.enabled?await admin.from('sitov_simulation_level_grants').upsert({student_id:value.studentId,level:value.level,granted_by:actor.userId,granted_at:new Date().toISOString()}):await admin.from('sitov_simulation_level_grants').delete().eq('student_id',value.studentId).eq('level',value.level)
 if(saved.error)throw new Error('Die Niveau-Freigabe konnte nicht gespeichert werden.')
 refresh();return {success:true}
}catch(error){return {success:false,error:message(error)}}}
export async function reviewExamSimulationTask(input:{runId:string;taskId:string;score:number;comment:string;requestId:string;interactionConfirmed?:boolean}):Promise<SimulationActionResult>{try{
 const value=z.object({runId:uuid,taskId:key,score:z.number().min(0).max(100),comment:z.string().trim().min(3).max(5000),requestId:uuid,interactionConfirmed:z.boolean().default(false)}).parse(input),actor=await getSimulationActor(true),admin=createAdminClient()
 const payload={runId:value.runId,taskId:value.taskId,score:value.score,comment:value.comment,teacherId:actor.userId,interactionConfirmed:value.interactionConfirmed}
 for(let attempt=0;attempt<3;attempt++){
  const {data:row,error}=await admin.from('sitov_simulation_runs').select('*').eq('id',value.runId).maybeSingle()
  if(error||!row||row.status!=='completed')throw new Error('Dieser Durchgang ist noch nicht zur Bewertung bereit.')
  await requireSimulationStudentManagement(actor,row.student_id)
  const snapshot=simulationSnapshot(row),task=snapshot.tasks.find(task=>task.id===value.taskId)
  if(!task||!['writing','speaking'].includes(task.type))throw new Error('Diese Aufgabe wird automatisch ausgewertet.')
  if(await replay(actor,row.id,value.requestId,'review',payload,row.student_id))return {success:true,session:await presentSimulation(snapshot)}
  if(task.type==='writing'){
   const answer=snapshot.answers[task.id]
   const text=typeof answer==='string'?answer:answer&&typeof answer==='object'&&!Array.isArray(answer)?answer.text:''
   if(!text.trim())throw new Error('Für die Schreibbewertung fehlt ein eigener Text.')
  }
  if(task.type==='speaking'){
   const answer=snapshot.answers[task.id]
   if(!answer||typeof answer!=='object'||Array.isArray(answer)||!answer.audioPath)throw new Error('Für die Sprechbewertung fehlt die Aufnahme. Ein geschriebenes Skript belegt keine mündliche Leistung.')
   await verifySimulationAnswerMedia(answer,row.student_id)
  }
  if(task.interactionRequired&&value.score>0&&!value.interactionConfirmed)throw new Error('Diese Sprechaufgabe braucht einen echten Dialog mit Partnerantworten oder Rückfragen. Bestätige die Interaktion, bevor du positive Punkte vergibst.')
  const next=reviewSimulationTask(snapshot,task.id,{interactionConfirmed:value.interactionConfirmed,score:value.score,maxPoints:task.maxPoints,comment:value.comment,teacherId:actor.userId,reviewedAt:new Date().toISOString()})
  const saved=await persistSimulationChange(row,next,value.requestId,'review',payload)
  if(saved){refresh();return {success:true,session:await presentSimulation(saved)}}
 }
 throw new Error('Die Bewertung wurde parallel geändert. Bitte prüfe den aktuellen Stand.')
}catch(error){return failure(error)}}

// Development-only runs use verified shared audio; no learner records are read or written.
// Keep only transient development fixtures across Next hot reloads. Production
// uses the persisted, authenticated runs above and never reads this memory.
const sitovPreviewMemory=globalThis as typeof globalThis&{sitovSimulationPreviewRuns?:Map<string,StoredSimulationSession>}
const previewRuns=process.env.NODE_ENV==='development'
 ? (sitovPreviewMemory.sitovSimulationPreviewRuns??=new Map<string,StoredSimulationSession>())
 : new Map<string,StoredSimulationSession>()
function previewOnly(){if(process.env.NODE_ENV!=='development')throw new Error('Die Oberflächenvorschau ist nicht verfügbar.')}
function previewRun(runId:string){previewOnly();const snapshot=previewRuns.get(runId);if(!snapshot)throw new Error('Die Vorschau wurde neu gestartet. Starte einen neuen Durchgang.');return snapshot}
export async function startPreviewExamSimulation(input:{level:SimulationLevel;provider?:SimulationProvider;mode?:SimulationMode;requestId:string}):Promise<SimulationActionResult>{try{
 previewOnly();const value=startSchema.parse(input)
 const previousTaskIds=[...previewRuns.values()].filter(run=>run.status==='completed'&&run.level===value.level).flatMap(run=>run.tasks.map(task=>task.id))
 const snapshot=buildSimulation({level:value.level,provider:value.provider,mode:'exam',previousTaskIds,preparedAudio:await preparedSimulationAudio(value.level)})
 snapshot.coverage.note='Oberflächenvorschau mit vollständig vorbereiteten Aufgaben. Ergebnisse und Antworten werden nicht in Lerndaten gespeichert.'
 snapshot.title=`Oberflächenvorschau · ${snapshot.title}`
 if(previewRuns.size>=50)previewRuns.delete(previewRuns.keys().next().value!)
 previewRuns.set(snapshot.id,snapshot);return {success:true,session:publicSimulation(snapshot)}
}catch(error){return failure(error)}}
export async function savePreviewSimulationAnswer(input:{runId:string;taskId:string;answer:SimulationAnswer;requestId:string}):Promise<SimulationActionResult>{try{
 const value=saveSchema.parse(input),snapshot=previewRun(value.runId)
 const answer=typeof value.answer==='object'&&!Array.isArray(value.answer)?{text:value.answer.text}:value.answer
 const updated=submitSimulationAnswer(snapshot,value.taskId,answer);previewRuns.set(updated.id,updated)
 return {success:true,session:publicSimulation(updated)}
}catch(error){return failure(error)}}
export async function finishPreviewExamSimulation(input:{runId:string;requestId:string}):Promise<SimulationActionResult>{try{
 const value=z.object({runId:uuid,requestId:uuid}).parse(input),snapshot=previewRun(value.runId)
 const updated=finishSimulation(snapshot);previewRuns.set(updated.id,updated);return {success:true,session:publicSimulation(updated)}
}catch(error){return failure(error)}}
