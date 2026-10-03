import 'server-only'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { loadLevelAccessProfile } from '@/lib/access/server'
import { hasLevelAccess } from '@/lib/access/levels'
import { requirePreparedGermanAudio } from '@/lib/audio/prepared-content'
import { normalizeAudioText } from '@/lib/audio/neural-config'
import { EXAM_MODULES, EXAM_WORKSHOPS, EXAM_PRACTICE_MODULES } from './content'
import { getPublishedExamAudio } from './audio-production-server'
import type { ExamAttemptRow, ExamFeedbackRow, ExamSubmissionRow } from '@/supabase/exam-preparation.types'
import type { ExamAttempt, ExamModule, ExamProfileId, ExamState, ExamSubmission, ExamTask, ExamUnit } from './types'

export const EXAM_BUCKET = 'sitov-exam-submissions'
export const EXAM_AUDIO_MIME_TYPES = ['audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/wav','audio/x-wav','audio/x-m4a'] as const
export const EXAM_PHOTO_MIME_TYPES = ['image/jpeg','image/png','image/webp'] as const
export const EXAM_MAX_UPLOAD_BYTES = 20*1024*1024
export const EXAM_PROFILE_IDS:ExamProfileId[]=['general_b1','dtz_a2_b1','telc_deutsch_b1','goethe_b1','oesd_zb1','telc_deutsch_a2_b1','oesd_zdoe_b1']
export function emptyExamState(error?:string):ExamState {return {profileId:'general_b1',attempts:[],submissions:[],overrides:[],fallbackModules:[],teacher:null,available:false,...(error?{error}:{})}}
export async function getExamActor(staffOnly=false) {
 const client=await createClient();const {data:{user}}=await client.auth.getUser()
 if(!user) throw new Error('Bitte melde dich an.')
 const profile=await loadLevelAccessProfile(client,user.id)
 if(!profile || (staffOnly ? !['admin','teacher'].includes(profile.role??'') : !hasLevelAccess(profile,'B1.1')&&!hasLevelAccess(profile,'B1.2'))) throw new Error('Für diesen Prüfungstrainer fehlt die B1-Freigabe.')
 return {client,userId:user.id,role:profile.role??'student'}
}
export function findExamUnit(unitId:string):ExamUnit|undefined {return [...EXAM_MODULES,...EXAM_WORKSHOPS,...EXAM_PRACTICE_MODULES].flatMap(m=>[...m.units,...(m.fallbackUnits??[])]).find(u=>u.id===unitId)}
export function findExamTask(taskId:string,unitId:string):{task:ExamTask;unit:ExamUnit;variant:number}|null {
 const unit=findExamUnit(unitId);if(!unit) return null
 const groups=[unit.tasks,...(unit.variants??[])]
 for(let variant=0;variant<groups.length;variant++){const task=groups[variant].find(t=>t.id===taskId);if(task)return {task,unit,variant}}
 return null
}
/** Grade only the fixed server content. Never accept a score or answer key from a browser. */
export function evaluateExamAnswer(task:ExamTask,answer:string|string[]):boolean {
 const normalize=(s:string)=>s.normalize('NFC').trim().toLocaleLowerCase('de').replace(/\s+/g,' ')
 if(task.correctAnswer===undefined) throw new Error('Für diese Aufgabe fehlt die Freigabe zur Bewertung.')
 if(Array.isArray(task.correctAnswer)){
  if(task.type==='short-text') return typeof answer==='string'&&task.correctAnswer.some(x=>normalize(x)===normalize(answer))
  return Array.isArray(answer)&&answer.length===task.correctAnswer.length&&answer.every((x,i)=>normalize(x)===normalize((task.correctAnswer as string[])[i]))
 }
 return typeof answer==='string'&&normalize(answer)===normalize(task.correctAnswer)
}
export function isExamCheckpointReady(unitId:string,variant:number,rows:ExamAttemptRow[]):boolean {
 const unit=findExamUnit(unitId),tasks=unit&&[unit.tasks,...(unit.variants??[])][variant]
 if(!unit||unit.kind!=='checkpoint'||!tasks)return false
 const closed=tasks.filter(t=>!['writing','speaking'].includes(t.type))
 return closed.length===10&&closed.every(t=>rows.some(r=>r.task_id===t.id&&r.task_version===t.version&&r.unit_id===unitId&&r.mode==='checkpoint'&&r.variant===variant))
}
export function mapExamAttempt(row:ExamAttemptRow,checkpointReady=false):ExamAttempt {
 const visible=row.mode!=='checkpoint'||checkpointReady
 return {id:row.id,taskId:row.task_id,taskVersion:row.task_version,unitId:row.unit_id,answer:row.answer as string|string[],correct:visible?row.correct:null,helped:row.helped,feedbackViewed:row.feedback_viewed,seconds:row.seconds,mode:row.mode,variant:row.variant,createdAt:row.created_at,...(visible?{feedback:row.feedback as ExamAttempt['feedback']}:{})}
}
async function mediaUrl(client:Awaited<ReturnType<typeof createClient>>,path:string|null) {
 if(!path)return null;const {data,error}=await client.storage.from(EXAM_BUCKET).createSignedUrl(path,1800)
 return !error?data?.signedUrl??null:null
}
export async function mapExamSubmissions(client:Awaited<ReturnType<typeof createClient>>,rows:ExamSubmissionRow[],feedback:ExamFeedbackRow[],names:Map<string,string>=new Map()):Promise<ExamSubmission[]> {
 return Promise.all(rows.map(async row=>({id:row.id,taskId:row.task_id,taskVersion:row.task_version,unitId:row.unit_id,studentId:row.student_id,kind:row.kind,helped:row.helped,text:row.text_content,mediaPath:row.media_path,photoPath:row.photo_path,mediaUrl:await mediaUrl(client,row.media_path),photoUrl:await mediaUrl(client,row.photo_path),teacherId:row.teacher_id,teacherName:row.teacher_id?names.get(row.teacher_id):undefined,status:row.status,previousId:row.previous_id,reflection:row.reflection,createdAt:row.created_at,feedback:feedback.filter(f=>f.submission_id===row.id).map(f=>({id:f.id,text:f.text_content,strengths:f.strengths,priorities:f.priorities as string[],revision:f.revision,rating:f.rating,createdAt:f.created_at,rubric:f.rubric as {criterion:string;rating:'practice'|'assisted'|'independent'}[]}))})))
}
/** Read every durable receipt; PostgREST's default row cap must not truncate progress. */
export async function allExamRows<T>(query:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:unknown}>):Promise<T[]> {
 const rows:T[]=[]
 for(let offset=0;;offset+=1000){const result=await query(offset,offset+999);if(result.error)throw new Error('Der Prüfungsfortschritt konnte nicht vollständig geladen werden.');rows.push(...(result.data??[]));if((result.data?.length??0)<1000)return rows}
}
export async function loadExamState(actor:Awaited<ReturnType<typeof getExamActor>>):Promise<ExamState> {
 const {client,userId}=actor,gradeClient=createAdminClient()
 const [profile,attempts,submissions,feedback,unlocks,assignment]=await Promise.all([
  client.from('sitov_exam_profiles').select('*').eq('student_id',userId).maybeSingle(),
  allExamRows((from,to)=>gradeClient.from('sitov_exam_attempts').select('*').eq('student_id',userId).order('created_at').order('id').range(from,to)),
  allExamRows((from,to)=>client.from('sitov_exam_submissions').select('*').eq('student_id',userId).order('created_at').order('id').range(from,to)),
  allExamRows((from,to)=>client.from('sitov_exam_feedback').select('*').order('created_at').order('id').range(from,to)),
  client.from('sitov_exam_unlocks').select('*').eq('student_id',userId),
  client.from('sitov_exam_teacher_assignments').select('*').eq('student_id',userId).maybeSingle()
 ])
 if([profile,unlocks,assignment].some(r=>r.error)) throw new Error('Der Prüfungsfortschritt konnte nicht geladen werden. Bitte versuche es erneut.')
 const names=new Map<string,string>()
 let teacher:ExamState['teacher']=null
 if(assignment.data){const admin=createAdminClient();const {data:p}=await admin.from('people').select('auth_user_id,display_name').eq('auth_user_id',assignment.data.teacher_id).maybeSingle();const name=p?.display_name??'Zugewiesene Lehrkraft';names.set(assignment.data.teacher_id,name);teacher={id:assignment.data.teacher_id,name,responseDays:assignment.data.response_days}}
 return {available:true,profileId:(profile.data?.profile_id??'general_b1') as ExamProfileId,attempts:attempts.map(row=>mapExamAttempt(row,isExamCheckpointReady(row.unit_id,row.variant,attempts))),submissions:await mapExamSubmissions(client,submissions,feedback,names),overrides:(unlocks.data??[]).filter(x=>x.kind==='teacher').map(x=>({moduleId:x.module_id,reason:x.reason})),fallbackModules:(unlocks.data??[]).filter(x=>x.kind==='fallback').map(x=>x.module_id),teacher}
}
export async function requireExamTaskMedia(task:ExamTask):Promise<string|undefined> {
 if(task.releaseStatus==='draft'||task.image?.status==='awaiting_review')throw new Error('Diese Aufgabe wird noch vorbereitet.')
 if(!task.audio)return undefined
 if(task.audio.route==='qwen'){
  const assets=await requirePreparedGermanAudio([task.audio.script]);const asset=assets.get(normalizeAudioText(task.audio.script));return asset?.audioUrl
 }
 const assets=await getPublishedExamAudio();const asset=assets[task.audio.id]
 if(!asset)throw new Error('Die geprüfte Aufnahme für diese Aufgabe fehlt noch.')
 return asset.src
}
/** Public catalog is a presentation model. Answers, evidence and listening scripts stay on the server. */
export async function getPublicExamCatalog():Promise<{modules:ExamModule[];workshops:ExamModule[]}> {
 await getExamActor()
 const audio=new Map<string,Promise<string|undefined>>()
 const presentTask=async(task:ExamTask):Promise<ExamTask>=>{
  const safe={...task};delete safe.correctAnswer;delete safe.explanation;delete safe.evidence
  // Hints are deliberate actions; shipping their contents would make assistance unobservable.
  safe.hints=[]
  if(task.audio){
   if(!audio.has(task.audio.id))audio.set(task.audio.id,requireExamTaskMedia(task).catch(()=>undefined))
   const src=await audio.get(task.audio.id)
   safe.audio={...task.audio,script:'',notes:'',src,status:src?'prepared':'awaiting_recording'}
   safe.releaseStatus=src&&task.releaseStatus!=='draft'?'published':task.releaseStatus==='draft'?'draft':'awaiting_media'
  }
  return safe
 }
 const presentUnit=async(unit:ExamUnit):Promise<ExamUnit>=>{
  const tasks=await Promise.all(unit.tasks.map(presentTask)),variants=unit.variants?await Promise.all(unit.variants.map(v=>Promise.all(v.map(presentTask)))):undefined
  const unavailableHuman=tasks.length>0&&tasks.every(t=>t.audio?.route==='human'&&t.releaseStatus!=='published')
  return {...unit,tasks,variants,...(unavailableHuman?{releaseStatus:'draft' as const,description:'Die menschliche Aufnahme wird noch vorbereitet.'}:{})}
 }
 const present=async(module:ExamModule):Promise<ExamModule>=>({...module,units:await Promise.all(module.units.map(presentUnit)),fallbackUnits:module.fallbackUnits?await Promise.all(module.fallbackUnits.map(presentUnit)):undefined})
 const [modules,workshops]=await Promise.all([Promise.all(EXAM_MODULES.map(present)),Promise.all([...EXAM_WORKSHOPS,...EXAM_PRACTICE_MODULES].map(present))])
 return {modules,workshops}
}
export async function verifyExamStoredMedia(path:string,userId:string,kind:'speaking'|'photo'):Promise<void> {
 if(!path.startsWith(`${userId}/`)||path.includes('..')||!new RegExp(`^${userId}/(speaking|photo)/[0-9a-f-]+\\.[a-z0-9]+$`).test(path)||!path.startsWith(`${userId}/${kind}/`))throw new Error('Die Datei gehört nicht zu dieser Abgabe.')
 const admin=createAdminClient(),ticket=await admin.from('sitov_exam_upload_tickets').select('path').eq('student_id',userId).eq('path',path).maybeSingle()
 if(ticket.error||!ticket.data)throw new Error('Diese Upload-Freigabe ist abgelaufen. Bitte lade die Datei erneut hoch.')
 const slash=path.lastIndexOf('/'),dir=path.slice(0,slash),filename=path.slice(slash+1)
 const {data,error}=await createAdminClient().storage.from(EXAM_BUCKET).list(dir,{search:filename,limit:2})
 const object=data?.find(x=>x.name===filename);const size=Number(object?.metadata?.size);const type=String(object?.metadata?.mimetype??'').split(';')[0]
 const validTypes:readonly string[]=kind==='speaking'?EXAM_AUDIO_MIME_TYPES:EXAM_PHOTO_MIME_TYPES
 if(error||!object||!Number.isFinite(size)||size<=0||size>EXAM_MAX_UPLOAD_BYTES||!validTypes.includes(type))throw new Error('Die hochgeladene Datei ist nicht vollständig oder hat ein ungeeignetes Format.')
}
