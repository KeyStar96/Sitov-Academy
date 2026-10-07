import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { loadLevelAccessProfile } from '@/lib/access/server'
import { hasLevelAccess, type LevelAccessProfile } from '@/lib/access/levels'
import { allExamRows, EXAM_BUCKET, verifyExamStoredMedia } from '@/lib/exam-preparation/server'
import { findCachedAudio, neuralAudioPath } from '@/lib/audio/neural-cache'
import { normalizeAudioText } from '@/lib/audio/neural-config'
import { publicSimulation, finishSimulation, getUniversalReadiness, SIMULATION_AUDIO_SOURCES, type StoredSimulationSession } from './engine'
import { isSimulationLevelOffered } from './catalogue'
import type { SimulationRunRow } from '@/supabase/exam-simulation.types'
import type { Json } from '@/supabase/database.types'
import type { SimulationAnswer, SimulationLevel, SimulationProfile, SimulationSession, SimulationState } from './types'

export function simulationHash(value:unknown):string { return createHash('sha256').update(JSON.stringify(value)).digest('hex') }
export type SimulationAccessProfile=LevelAccessProfile & {simulation_levels?:readonly SimulationLevel[];simulation_enabled?:boolean}
export function hasSimulationFeatureAccess(profile:SimulationAccessProfile|null):boolean {
 return ['teacher','admin'].includes(profile?.role??'')||profile?.simulation_enabled===true
}
export function hasSimulationLevelAccess(profile:SimulationAccessProfile|null,level:SimulationLevel,simulationLevels:readonly SimulationLevel[]=profile?.simulation_levels??[]):boolean {
 // A level that is not offered (currently C2) is closed for everyone, whatever grant is stored.
 if(!isSimulationLevelOffered(level))return false
 return hasLevelAccess(profile,`${level}.1`)||hasLevelAccess(profile,`${level}.2`)||(['B2','C1','C2'].includes(level)&&simulationLevels.includes(level))
}
export async function getSimulationActor(staffOnly=false) {
 const client=await createClient(),{data:{user}}=await client.auth.getUser()
 if(!user)throw new Error('Bitte melde dich an.')
 const baseProfile=await loadLevelAccessProfile(client,user.id)
 if(!baseProfile || (staffOnly&&!['admin','teacher'].includes(baseProfile.role??'')))throw new Error('Für diesen Bereich fehlt die Freigabe.')
 const admin=createAdminClient(),[grants,feature,state]=await Promise.all([
  admin.from('sitov_simulation_level_grants').select('level').eq('student_id',user.id),
  admin.from('sitov_simulation_feature_grants').select('student_id').eq('student_id',user.id).maybeSingle(),
  admin.from('sitov_simulation_learning_state').select('generation,reset_pending').eq('student_id',user.id).maybeSingle(),
 ])
 if(grants.error||feature.error||state.error)throw new Error('Die Freigaben für simulierte Prüfungen konnten nicht geladen werden.')
 const profile:SimulationAccessProfile={...baseProfile,simulation_enabled:!!feature.data,simulation_levels:(grants.data??[]).map(grant=>grant.level as SimulationLevel)}
 return {client,userId:user.id,role:profile.role??'student',profile,simulationGeneration:Number(state.data?.generation??0),simulationResetPending:!!state.data?.reset_pending}
}
export function requireSimulationFeature(actor:Awaited<ReturnType<typeof getSimulationActor>>) {
 if(!hasSimulationFeatureAccess(actor.profile))throw new Error('Die simulierte Prüfung ist für dich noch nicht freigegeben. Bitte wende dich an deine Lehrkraft.')
 if(actor.simulationResetPending)throw new Error('Deine Lehrkraft setzt den Prüfungsfortschritt gerade zurück. Bitte warte, bis der Vorgang beendet ist.')
}
export function requireSimulationLevel(actor:Awaited<ReturnType<typeof getSimulationActor>>,level:SimulationLevel) {
 requireSimulationFeature(actor)
 if(!hasSimulationLevelAccess(actor.profile,level))throw new Error(`Für ${level} fehlt die Niveau-Freigabe. Bitte wende dich an deine Lehrkraft.`)
}
export function simulationSnapshot(row:SimulationRunRow):StoredSimulationSession {
 const snapshot=row.server_snapshot as unknown as StoredSimulationSession
 if(!snapshot||snapshot.id!==row.id||snapshot.level!==row.level||snapshot.status!==row.status||!Array.isArray(snapshot.tasks))throw new Error('Dieser Prüfungsdurchgang kann nicht geladen werden.')
 return snapshot
}
export async function loadSimulationRun(actor:Awaited<ReturnType<typeof getSimulationActor>>,runId:string):Promise<SimulationRunRow> {
 requireSimulationFeature(actor)
 const {data,error}=await createAdminClient().from('sitov_simulation_runs').select('*').eq('id',runId).eq('student_id',actor.userId).maybeSingle()
 if(error||!data)throw new Error('Dieser Prüfungsdurchgang gehört nicht zu dir.')
 requireSimulationLevel(actor,data.level as SimulationLevel)
 return data
}
/** Add signed learner recording URLs only after ownership/assignment authorization. */
export async function presentSimulation(snapshot:StoredSimulationSession):Promise<SimulationSession> {
 const session=publicSimulation(snapshot),admin=createAdminClient()
 const urls=new Map<string,Promise<string|undefined>>()
 const audioUrl=async(path:string)=>{
  if(!urls.has(path))urls.set(path,admin.storage.from(EXAM_BUCKET).createSignedUrl(path,1800).then(({data,error})=>!error?data?.signedUrl:undefined))
  return urls.get(path)
 }
 const answer=async(value:SimulationAnswer):Promise<SimulationAnswer>=>typeof value==='object'&&!Array.isArray(value)&&value.audioPath?{...value,audioUrl:await audioUrl(value.audioPath)}:value
 session.answers=Object.fromEntries(await Promise.all(Object.entries(session.answers).map(async([key,value])=>[key,await answer(value)])))
 if(session.result)session.result.feedback=await Promise.all(session.result.feedback.map(async feedback=>({...feedback,answer:feedback.answer?await answer(feedback.answer):null})))
 return session
}
export async function simulationCatalog(actor?:Awaited<ReturnType<typeof getSimulationActor>>):Promise<SimulationProfile[]> {
 const profiles=getUniversalReadiness(await preparedSimulationAudio()).filter(profile=>isSimulationLevelOffered(profile.level))
 return profiles.map(profile=>({...profile,fullExamReleased:profile.fullExamReleased&&(!actor||(hasSimulationFeatureAccess(actor.profile)&&hasSimulationLevelAccess(actor.profile,profile.level))),practiceAvailable:profile.practiceAvailable&&(!actor||(hasSimulationFeatureAccess(actor.profile)&&hasSimulationLevelAccess(actor.profile,profile.level))),blockers:[...profile.blockers,...(actor&&!hasSimulationFeatureAccess(actor.profile)?['Deine Lehrkraft hat die simulierte Prüfung noch nicht freigegeben.']:[]),...(actor&&!hasSimulationLevelAccess(actor.profile,profile.level)?['Deine Niveau-Freigabe fehlt.']:[])]}))
}
/** Proof is read from the imported immutable Qwen cache. Missing media never synthesizes. */
export async function preparedSimulationAudio(level?:SimulationLevel) {
 const sources=SIMULATION_AUDIO_SOURCES.filter(source=>!level||source.level===level)
 const entries=[]
 for(let offset=0;offset<sources.length;offset+=8){
  const batch=await Promise.all(sources.slice(offset,offset+8).map(async source=>{
  try {const asset=await findCachedAudio(neuralAudioPath(normalizeAudioText(source.script),'de'),source.script);return asset?.wordTimings?[source.id,{src:asset.audioUrl,wordTimingsVerified:true as const}] as const:null}catch{return null}
  }))
  entries.push(...batch)
 }
 return Object.fromEntries(entries.filter((item):item is NonNullable<typeof item>=>item!==null))
}
/** A SQL transaction compares revision and commits snapshot+receipt together. */
export async function persistSimulationChange(row:SimulationRunRow,snapshot:StoredSimulationSession,requestId:string,kind:'answer'|'finish'|'review',payload:unknown) {
 const {data,error}=await createAdminClient().rpc('sitov_store_simulation_change',{
  p_run_id:row.id,p_student_id:row.student_id,p_revision:row.revision,p_snapshot:snapshot as unknown as Json,
  p_request_id:requestId,p_kind:kind,p_payload_hash:simulationHash(payload),
 })
 if(error){
  if(error.message.includes('simulation_time_expired'))throw new Error('Die Prüfungszeit ist abgelaufen. Beende den Durchgang, um deine Auswertung zu sehen.')
  if(error.message.includes('simulation_feature_not_granted'))throw new Error('Die simulierte Prüfung ist für dich noch nicht freigegeben. Bitte wende dich an deine Lehrkraft.')
  if(/simulation_reset_in_progress|simulation_generation_changed/.test(error.message))throw new Error('Der Prüfungsfortschritt wurde von deiner Lehrkraft zurückgesetzt. Bitte lade die Seite erneut.')
  if(error.message.includes('simulation_request_reused'))throw new Error('Diese Speicheranfrage wurde bereits für eine andere Eingabe verwendet.')
  if(error.message.includes('learning_reset_in_progress'))throw new Error('Deine Lerndaten werden gerade zurückgesetzt. Bitte warte, bis der Vorgang beendet ist.')
  throw new Error('Der Durchgang konnte nicht gespeichert werden. Deine Eingabe bleibt erhalten.')
 }
 const receipt=data as unknown as {conflict?:boolean;snapshot?:StoredSimulationSession;revision?:number;replayed?:boolean}
 if(receipt.conflict)return null
 if(!receipt.snapshot||receipt.snapshot.id!==row.id)throw new Error('Der gespeicherte Durchgang konnte nicht geprüft werden.')
 return receipt.snapshot
}
export async function finishExpiredSimulation(row:SimulationRunRow):Promise<StoredSimulationSession> {
 const snapshot=simulationSnapshot(row)
 if(snapshot.status==='completed'||Date.now()<Date.parse(snapshot.expiresAt))return snapshot
 const result=await persistSimulationChange(row,finishSimulation(snapshot),randomUUID(),'finish',{runId:row.id,reason:'expired'})
 if(result)return result
 const {data,error}=await createAdminClient().from('sitov_simulation_runs').select('*').eq('id',row.id).eq('student_id',row.student_id).single()
 if(error||!data)throw new Error('Der Durchgang konnte nicht aktualisiert werden.')
 return simulationSnapshot(data)
}
export async function loadSimulationState(actor:Awaited<ReturnType<typeof getSimulationActor>>):Promise<SimulationState> {
 requireSimulationFeature(actor)
 const rows=await allExamRows((from,to)=>createAdminClient().from('sitov_simulation_runs').select('*').eq('student_id',actor.userId).order('started_at',{ascending:false}).order('id').range(from,to))
 // A revoked level must not leave an invisible active run blocking every other level.
 // Keep the frozen attempt, but close it without exposing any of its tasks or keys.
 for(const row of rows.filter(row=>row.status==='active'&&!hasSimulationLevelAccess(actor.profile,row.level as SimulationLevel))){
  await persistSimulationChange(row,finishSimulation(simulationSnapshot(row)),randomUUID(),'finish',{runId:row.id,reason:'access-revoked'})
 }
 const allowed=rows.filter(row=>hasSimulationLevelAccess(actor.profile,row.level as SimulationLevel))
 const sessions=await Promise.all(allowed.map(async row=>presentSimulation(await finishExpiredSimulation(row))))
 return {available:true,active:sessions.find(session=>session.status==='active')??null,history:sessions.filter(session=>session.status==='completed')}
}
export async function verifySimulationAnswerMedia(answer:SimulationAnswer,userId:string) {
 if(typeof answer==='object'&&!Array.isArray(answer)&&answer.audioPath)await verifyExamStoredMedia(answer.audioPath,userId,'speaking')
}
export interface SimulationTeacherState {
 success:boolean;error?:string;actorRole:'teacher'|'admin';
 runs:{studentId:string;studentName:string;session:SimulationSession}[];
 students:{id:string;name:string}[];unassignedStudents?:{id:string;name:string}[];assignments:{studentId:string;teacherId:string}[];teachers:{id:string;name:string}[];levelGrants:{studentId:string;level:SimulationLevel}[];featureGrants:{studentId:string}[]
}
export async function requireSimulationStudentManagement(actor:Awaited<ReturnType<typeof getSimulationActor>>,studentId:string) {
 if(actor.role==='admin')return
 const {data,error}=await createAdminClient().from('sitov_exam_teacher_assignments').select('student_id').eq('student_id',studentId).eq('teacher_id',actor.userId).maybeSingle()
 if(error||!data)throw new Error('Dieser Lernende ist dir nicht zugewiesen.')
}
export async function loadSimulationTeacherState(actor:Awaited<ReturnType<typeof getSimulationActor>>):Promise<SimulationTeacherState> {
 const admin=createAdminClient()
 const [allAssignments,profiles,people]=await Promise.all([
  allExamRows((from,to)=>admin.from('sitov_exam_teacher_assignments').select('*').order('student_id').range(from,to)),
  allExamRows((from,to)=>admin.from('profiles').select('id,role').order('id').range(from,to)),
  allExamRows((from,to)=>admin.from('people').select('auth_user_id,display_name').order('id').range(from,to)),
 ])
 const assignments=allAssignments.filter(assignment=>actor.role==='admin'||assignment.teacher_id===actor.userId)
 const alreadyAssigned=new Set(allAssignments.map(assignment=>assignment.student_id))
 const assignedIds=assignments.map(assignment=>assignment.student_id)
 const rows=actor.role==='admin'||assignedIds.length?await allExamRows((from,to)=>{let query=admin.from('sitov_simulation_runs').select('*').eq('status','completed').order('completed_at',{ascending:false}).order('id');if(actor.role!=='admin')query=query.in('student_id',assignedIds);return query.range(from,to)}):[]
 const grantRows=actor.role==='admin'||assignedIds.length?await allExamRows((from,to)=>{let query=admin.from('sitov_simulation_level_grants').select('student_id,level').order('student_id').order('level');if(actor.role!=='admin')query=query.in('student_id',assignedIds);return query.range(from,to)}):[]
 const featureRows=actor.role==='admin'||assignedIds.length?await allExamRows((from,to)=>{let query=admin.from('sitov_simulation_feature_grants').select('student_id').order('student_id');if(actor.role!=='admin')query=query.in('student_id',assignedIds);return query.range(from,to)}):[]
 const names=new Map(people.filter(person=>person.auth_user_id).map(person=>[person.auth_user_id!,person.display_name]))
 return {success:true,actorRole:actor.role as 'admin'|'teacher',featureGrants:featureRows.map(grant=>({studentId:grant.student_id})),levelGrants:grantRows.map(grant=>({studentId:grant.student_id,level:grant.level as SimulationLevel})),
  runs:await Promise.all(rows.map(async row=>({studentId:row.student_id,studentName:names.get(row.student_id)??'Lernender',session:await presentSimulation(simulationSnapshot(row))}))),
  students:profiles.filter(profile=>profile.role==='student'&&(actor.role==='admin'||assignedIds.includes(profile.id))).map(profile=>({id:profile.id,name:names.get(profile.id)??'Lernender'})),
  // Only names of unassigned candidates leave the server. Their runs, grants and
  // private recordings remain unavailable until the database confirms assignment.
  unassignedStudents:actor.role==='teacher'?profiles.filter(profile=>profile.role==='student'&&!alreadyAssigned.has(profile.id)).map(profile=>({id:profile.id,name:names.get(profile.id)??'Lernender'})):[],
  assignments:assignments.map(assignment=>({studentId:assignment.student_id,teacherId:assignment.teacher_id})),
  teachers:profiles.filter(profile=>['admin','teacher'].includes(profile.role??'')).map(profile=>({id:profile.id,name:names.get(profile.id)??'Lehrkraft'}))}
}
