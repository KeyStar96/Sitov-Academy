'use server'
import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/utils/supabase/admin'
import { EXAM_MODULES, EXAM_WORKSHOPS } from '@/lib/exam-preparation/content'
import { getExamProgress, isExamUnitAvailable } from '@/lib/exam-preparation/progression'
import {
 EXAM_AUDIO_MIME_TYPES, EXAM_PHOTO_MIME_TYPES, EXAM_MAX_UPLOAD_BYTES, EXAM_BUCKET, EXAM_PROFILE_IDS,
 emptyExamState, getExamActor, loadExamState, findExamTask, evaluateExamAnswer, mapExamAttempt,
 mapExamSubmissions, requireExamTaskMedia, verifyExamStoredMedia, isExamCheckpointReady, allExamRows,
} from '@/lib/exam-preparation/server'
import type { ExamActionResult, ExamProfileId, ExamState, ExamSubmission } from '@/lib/exam-preparation/types'

const id=z.uuid(),key=z.string().min(1).max(160)
const refresh=()=>{try{revalidatePath('/[lang]/dashboard/exam-preparation','page');revalidatePath('/[lang]/dashboard','page');revalidatePath('/[lang]/admin/exam-preparation','page')}catch{console.error('Exam preparation saved, cache refresh failed')}}
const failure=(error:unknown):ExamActionResult=>({success:false,error:error instanceof z.ZodError?'Bitte prüfe deine Eingaben.':error instanceof Error&& !/postgres|supabase|secret|service_role|relation|column|violates/i.test(error.message)?error.message:'Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.'})
async function finished(actor:Awaited<ReturnType<typeof getExamActor>>):Promise<ExamActionResult>{refresh();return {success:true,state:await loadExamState(actor)}}
async function authorizedTask(actor:Awaited<ReturnType<typeof getExamActor>>,taskId:string,unitId:string){
 const found=findExamTask(taskId,unitId);if(!found)throw new Error('Diese Aufgabe ist nicht verfügbar.')
 const state=await loadExamState(actor)
 if(actor.role==='student'&&!isExamUnitAvailable(found.unit,state,EXAM_MODULES))throw new Error('Dieses Modul ist noch nicht freigeschaltet.')
 await requireExamTaskMedia(found.task)
 return {...found,state}
}
export async function getExamState():Promise<ExamState>{try{return await loadExamState(await getExamActor())}catch(error){return emptyExamState(failure(error).error)}}
export async function saveExamProfile(input:{profileId:ExamProfileId}):Promise<ExamActionResult>{try{
 const value=z.object({profileId:z.enum(EXAM_PROFILE_IDS as [ExamProfileId,...ExamProfileId[]])}).parse(input),actor=await getExamActor()
 const {error}=await createAdminClient().from('sitov_exam_profiles').upsert({student_id:actor.userId,profile_id:value.profileId,updated_at:new Date().toISOString()})
 if(error)throw new Error('Das Prüfungsprofil konnte nicht gespeichert werden.')
 return finished(actor)
}catch(error){return failure(error)}}
export async function submitExamAnswer(input:{taskId:string;unitId:string;answer:string|string[];helped:boolean;seconds:number;mode:'practice'|'checkpoint';variant:number;requestId:string}):Promise<ExamActionResult>{try{
 const data=z.object({taskId:key,unitId:key,answer:z.union([z.string().min(1).max(5000),z.array(z.string().max(1000)).min(1).max(100)]),helped:z.boolean(),seconds:z.number().int().min(0).max(7200),mode:z.enum(['practice','checkpoint']),variant:z.number().int().min(0).max(99),requestId:id}).parse(input)
 const actor=await getExamActor(),admin=createAdminClient()
 const {data:receipt,error:receiptError}=await admin.from('sitov_exam_attempts').select('*').eq('student_id',actor.userId).eq('request_id',data.requestId).maybeSingle()
 if(receiptError)throw new Error('Die Antwort konnte nicht geprüft werden.')
 if(receipt){if(receipt.task_id!==data.taskId||receipt.unit_id!==data.unitId||JSON.stringify(receipt.answer)!==JSON.stringify(data.answer)||receipt.mode!==data.mode||receipt.variant!==data.variant)throw new Error('Diese Anfrage wurde bereits für eine andere Antwort verwendet.');const state=await loadExamState(actor),attempt=state.attempts.find(a=>a.id===receipt.id)!;return {success:true,attempt,feedback:attempt.feedback,state}}
 const {task,unit,variant}=await authorizedTask(actor,data.taskId,data.unitId)
 if(task.type==='writing'||task.type==='speaking')throw new Error('Bitte speichere diese Leistung als eigenen Beitrag.')
 if(data.variant!==variant||(unit.kind==='checkpoint'&&data.mode!=='checkpoint')||(unit.kind!=='checkpoint'&&data.mode!=='practice'))throw new Error('Der Bearbeitungsmodus passt nicht zu dieser Aufgabe.')
 const {data:hint,error:hintError}=await admin.from('sitov_exam_hints').select('task_id').eq('student_id',actor.userId).eq('task_id',task.id).eq('task_version',task.version).maybeSingle()
 if(hintError)throw new Error('Die Hilfenutzung konnte nicht geprüft werden.')
 const feedback={explanation:task.explanation??'Vergleiche deine Antwort mit dem Auftrag.',evidence:task.evidence??'',correctAnswer:task.correctAnswer}
 const row={student_id:actor.userId,task_id:task.id,task_version:task.version,unit_id:unit.id,answer:data.answer,helped:data.helped||!!hint,correct:evaluateExamAnswer(task,data.answer),seconds:data.seconds,mode:data.mode,variant,request_id:data.requestId,feedback}
 const {data:saved,error}=await admin.from('sitov_exam_attempts').insert(row).select('*').single()
 if(error){
  // A concurrent device may have submitted the same transport receipt.
  if(error.code==='23505'){const replay=await admin.from('sitov_exam_attempts').select('*').eq('student_id',actor.userId).eq('request_id',data.requestId).single();if(replay.data&&JSON.stringify(replay.data.answer)===JSON.stringify(data.answer)&&replay.data.task_id===data.taskId&&replay.data.unit_id===data.unitId&&replay.data.mode===data.mode&&replay.data.variant===data.variant){const state=await loadExamState(actor),attempt=state.attempts.find(a=>a.id===replay.data!.id)!;return {success:true,attempt,feedback:attempt.feedback,state}}}
  throw new Error('Die Antwort konnte nicht gespeichert werden.')
 }
 refresh();const state=await loadExamState(actor),attempt=state.attempts.find(a=>a.id===saved.id)!;return {success:true,attempt,feedback:attempt.feedback,state}
}catch(error){return failure(error)}}
export async function markExamFeedbackViewed(input:{attemptId:string}):Promise<ExamActionResult>{try{
 const data=z.object({attemptId:id}).parse(input),actor=await getExamActor(),state=await loadExamState(actor)
 const owned=state.attempts.find(a=>a.id===data.attemptId)
 if(!owned||!owned.feedback)throw new Error('Lies zuerst die Rückmeldung nach dem vollständigen Lerncheck.')
 const {data:updated,error}=await createAdminClient().from('sitov_exam_attempts').update({feedback_viewed:true}).eq('student_id',actor.userId).eq('id',data.attemptId).select('id').maybeSingle()
 if(error||!updated)throw new Error('Die Rückmeldung gehört nicht zu deinem Prüfungsfortschritt.')
 return finished(actor)
}catch(error){return failure(error)}}
export async function getExamHint(input:{taskId:string;unitId:string}):Promise<{success:boolean;error?:string;hints?:string[];transcript?:string}>{try{
 const data=z.object({taskId:key,unitId:key}).parse(input),actor=await getExamActor(),{task,state,unit}=await authorizedTask(actor,data.taskId,data.unitId)
 if(unit.kind==='checkpoint')throw new Error('Im Lerncheck sind Hilfen und Transkripte gesperrt.')
 if(task.audio&&!state.attempts.some(a=>a.taskId===task.id&&a.taskVersion===task.version))throw new Error('Höre zuerst die Aufnahme und gib eine eigene Antwort ab.')
 const {error}=await createAdminClient().from('sitov_exam_hints').upsert({student_id:actor.userId,task_id:task.id,task_version:task.version},{onConflict:'student_id,task_id,task_version',ignoreDuplicates:true})
 if(error)throw new Error('Die Hilfe konnte nicht geladen werden.')
 return {success:true,hints:task.hints,transcript:task.audio?.script}
}catch(error){return {success:false,error:failure(error).error}}}
export async function createExamUpload(input:{mimeType:string;bytes:number;kind:'speaking'|'photo'}):Promise<{success:boolean;error?:string;path?:string;token?:string;signedUrl?:string}>{try{
 const data=z.object({mimeType:z.string().min(1).max(100),bytes:z.number().int().min(1).max(EXAM_MAX_UPLOAD_BYTES),kind:z.enum(['speaking','photo'])}).parse(input),actor=await getExamActor()
 const type=data.mimeType.split(';')[0].toLowerCase(),allowed:readonly string[]=data.kind==='speaking'?EXAM_AUDIO_MIME_TYPES:EXAM_PHOTO_MIME_TYPES
 if(!allowed.includes(type))throw new Error('Bitte verwende eine unterstützte Audio- oder Bilddatei.')
 const extension:Record<string,string>={'audio/webm':'webm','audio/mp4':'m4a','audio/mpeg':'mp3','audio/ogg':'ogg','audio/wav':'wav','audio/x-wav':'wav','audio/x-m4a':'m4a','image/jpeg':'jpg','image/png':'png','image/webp':'webp'}
 const path=`${actor.userId}/${data.kind}/${randomUUID()}.${extension[type]}`
 const admin=createAdminClient(),ticket=await admin.from('sitov_exam_upload_tickets').insert({path,student_id:actor.userId,kind:data.kind})
 if(ticket.error)throw new Error('Der Upload kann während eines Lerndaten-Resets nicht begonnen werden.')
 const {data:signed,error}=await admin.storage.from(EXAM_BUCKET).createSignedUploadUrl(path,{upsert:false})
 if(error||!signed)throw new Error('Der Upload konnte nicht vorbereitet werden. Dein Entwurf bleibt erhalten.')
 return {success:true,path,token:signed.token,signedUrl:signed.signedUrl}
}catch(error){return {success:false,error:failure(error).error}}}
export async function saveExamSubmission(form:FormData):Promise<ExamActionResult>{try{
 const value=z.object({taskId:key,unitId:key,text:z.string().max(20000),audioPath:z.string().max(300).nullable(),photoPath:z.string().max(300).nullable(),previousId:id.nullable(),reflection:z.string().max(5000).nullable(),explicitSubmit:z.boolean(),requestId:id.optional()}).parse({taskId:form.get('taskId'),unitId:form.get('unitId'),text:form.get('text')??'',audioPath:form.get('audioPath')||null,photoPath:form.get('photoPath')||null,previousId:form.get('previousId')||null,reflection:form.get('reflection')||null,explicitSubmit:form.get('explicitSubmit')==='true',requestId:form.get('requestId')||undefined})
 const actor=await getExamActor(),admin=createAdminClient()
 if(value.requestId){const {data:receipt,error}=await admin.from('sitov_exam_submissions').select('*').eq('student_id',actor.userId).eq('request_id',value.requestId).maybeSingle();if(error)throw new Error('Der gespeicherte Entwurf konnte nicht geprüft werden.');if(receipt){if(receipt.task_id!==value.taskId||receipt.unit_id!==value.unitId||receipt.text_content!==value.text.trim()||receipt.media_path!==value.audioPath||receipt.photo_path!==value.photoPath||receipt.previous_id!==value.previousId||receipt.reflection!==(value.reflection?.trim()||null)||receipt.explicit_submit!==value.explicitSubmit)throw new Error('Diese Speicheranfrage gehört zu einer anderen Abgabe.');const state=await loadExamState(actor);return {success:true,state,submission:state.submissions.find(s=>s.id===receipt.id)}}}
 const {task,state}=await authorizedTask(actor,value.taskId,value.unitId)
 if(task.type!=='writing'&&task.type!=='speaking')throw new Error('Diese Aufgabe benötigt keine Einreichung.')
 if(value.previousId&&!state.submissions.some(s=>s.id===value.previousId&&s.taskId===task.id&&s.unitId===value.unitId&&s.kind===task.type))throw new Error('Die ursprüngliche Abgabe gehört nicht zu dieser Aufgabe.')
 if(value.audioPath)await verifyExamStoredMedia(value.audioPath,actor.userId,'speaking')
 if(value.photoPath)await verifyExamStoredMedia(value.photoPath,actor.userId,'photo')
 if(task.type==='speaking'&&!value.audioPath)throw new Error('Bitte wähle deine eigene Aufnahme aus.')
 if(!value.text.trim()&&!value.audioPath&&!value.photoPath)throw new Error('Bitte ergänze deinen eigenen Beitrag.')
 const teacherId=state.teacher?.id??null
 const {data:help,error:helpError}=await admin.from('sitov_exam_hints').select('task_id').eq('student_id',actor.userId).eq('task_id',task.id).eq('task_version',task.version).maybeSingle()
 if(helpError)throw new Error('Die Hilfenutzung konnte nicht gespeichert werden.')
 const row={student_id:actor.userId,request_id:value.requestId??randomUUID(),explicit_submit:value.explicitSubmit,task_id:task.id,task_version:task.version,unit_id:value.unitId,kind:task.type,helped:!!help||!!state.submissions.find(s=>s.id===value.previousId)?.helped,text_content:value.text.trim(),media_path:value.audioPath,photo_path:value.photoPath,previous_id:value.previousId,reflection:value.reflection?.trim()||null,teacher_id:value.explicitSubmit?teacherId:null,status:value.explicitSubmit&&teacherId?'submitted' as const:'draft' as const}
 const {data:saved,error}=await admin.from('sitov_exam_submissions').insert(row).select('*').single()
 if(error||!saved){if(error?.code==='23505'&&value.requestId){const replay=await admin.from('sitov_exam_submissions').select('*').eq('student_id',actor.userId).eq('request_id',value.requestId).maybeSingle();if(replay.data&&replay.data.task_id===value.taskId&&replay.data.unit_id===value.unitId&&replay.data.text_content===value.text.trim()&&replay.data.media_path===value.audioPath&&replay.data.photo_path===value.photoPath&&replay.data.previous_id===value.previousId&&replay.data.reflection===(value.reflection?.trim()||null)&&replay.data.explicit_submit===value.explicitSubmit){const state=await loadExamState(actor);return {success:true,state,submission:state.submissions.find(s=>s.id===replay.data!.id)}}}throw new Error('Die Abgabe konnte nicht gespeichert werden. Deine Eingabe bleibt erhalten.')}
 const result=await finished(actor);return {...result,submission:result.state?.submissions.find(s=>s.id===saved.id)}
}catch(error){return failure(error)}}
export async function deleteExamSubmission(input:{submissionId:string}):Promise<ExamActionResult>{try{
 const value=z.object({submissionId:id}).parse(input),actor=await getExamActor(),admin=createAdminClient()
 const {data:row,error}=await admin.from('sitov_exam_submissions').select('*').eq('id',value.submissionId).eq('student_id',actor.userId).maybeSingle()
 if(error||!row)throw new Error('Diese Abgabe gehört nicht zu dir.')
 for(const path of [row.media_path,row.photo_path].filter((p):p is string=>!!p)){
  const {count,error:referenceError}=await admin.from('sitov_exam_submissions').select('id',{count:'exact',head:true}).neq('id',row.id).or(`media_path.eq.${path},photo_path.eq.${path}`)
  if(referenceError)throw new Error('Die Datei konnte nicht sicher zur Löschung geprüft werden.')
  const simulationRuns=await allExamRows((from,to)=>admin.from('sitov_simulation_runs').select('server_snapshot').eq('student_id',actor.userId).order('id').range(from,to))
  const referencedInSimulation=simulationRuns.some(run=>{
   const snapshot=run.server_snapshot as {answers?:Record<string,unknown>}
   return Object.values(snapshot.answers??{}).some(answer=>typeof answer==='object'&&answer!==null&&!Array.isArray(answer)&&'audioPath' in answer&&answer.audioPath===path)
  })
  if(count===0&&!referencedInSimulation){
   // Fence any still-valid signed upload URL before removing its immutable object.
   const ticket=await admin.from('sitov_exam_upload_tickets').delete().eq('path',path).eq('student_id',actor.userId)
   if(ticket.error)throw new Error('Die Datei konnte nicht für die Löschung gesperrt werden.')
   const removedMedia=await admin.storage.from(EXAM_BUCKET).remove([path])
   if(removedMedia.error)throw new Error('Die Datei konnte nicht gelöscht werden. Deine Abgabe bleibt für einen erneuten Versuch gespeichert.')
  }
 }
 const removed=await admin.from('sitov_exam_submissions').delete().eq('id',row.id).eq('student_id',actor.userId)
 if(removed.error)throw new Error('Die Abgabe konnte nicht gelöscht werden. Bitte versuche es erneut.')
 return finished(actor)
}catch(error){return failure(error)}}
async function requireStudentManagement(actor:Awaited<ReturnType<typeof getExamActor>>,studentId:string) {
 if(actor.role==='admin')return
 const {data,error}=await createAdminClient().from('sitov_exam_teacher_assignments').select('student_id').eq('student_id',studentId).eq('teacher_id',actor.userId).maybeSingle()
 if(error||!data)throw new Error('Dieser Lernende ist dir nicht zugewiesen.')
}
export async function reviewExamSubmission(input:{submissionId:string;text:string;strengths:string;priorities:string[];revision:string;rating:'practice'|'assisted'|'independent';rubric?:{criterion:string;rating:'practice'|'assisted'|'independent'}[]}):Promise<ExamActionResult>{try{
 const value=z.object({submissionId:id,text:z.string().trim().min(1).max(10000),strengths:z.string().max(5000),priorities:z.array(z.string().trim().min(1).max(2000)).max(2),revision:z.string().trim().min(1).max(5000),rating:z.enum(['practice','assisted','independent']),rubric:z.array(z.object({criterion:z.string().trim().min(1).max(300),rating:z.enum(['practice','assisted','independent'])})).max(20).optional()}).parse(input)
 const actor=await getExamActor(true),admin=createAdminClient(),{data:submission,error}=await admin.from('sitov_exam_submissions').select('*').eq('id',value.submissionId).maybeSingle()
 if(error||!submission||submission.status==='draft')throw new Error('Diese Abgabe ist nicht zur Rückmeldung eingereicht.')
 await requireStudentManagement(actor,submission.student_id)
 if(value.rating==='independent'&&submission.helped)throw new Error('Ein Beitrag mit Hilfen kann als „mit Hilfe“ bewertet werden. Der selbstständige Nachweis braucht eine neue Leistung ohne Hilfen.')
 if(actor.role!=='admin'&&submission.teacher_id!==actor.userId)throw new Error('Diese Abgabe wurde einer anderen Lehrkraft gesendet.')
 const saved=await admin.from('sitov_exam_feedback').insert({submission_id:submission.id,teacher_id:actor.userId,text_content:value.text,strengths:value.strengths,priorities:value.priorities,revision:value.revision,rating:value.rating,rubric:value.rubric??[]})
 if(saved.error)throw new Error('Die Rückmeldung konnte nicht gespeichert werden.')
 refresh();return {success:true}
}catch(error){return failure(error)}}
export async function unlockExamModule(input:{studentId:string;moduleId:string;reason:string}):Promise<ExamActionResult>{try{
 const data=z.object({studentId:id,moduleId:key,reason:z.string().trim().min(3).max(5000)}).parse(input),actor=await getExamActor(true)
 if(!EXAM_MODULES.some(m=>m.id===data.moduleId))throw new Error('Dieses Prüfungsmodul ist nicht verfügbar.')
 await requireStudentManagement(actor,data.studentId)
 const {error}=await createAdminClient().from('sitov_exam_unlocks').upsert({student_id:data.studentId,module_id:data.moduleId,kind:'teacher',reason:data.reason,created_by:actor.userId},{onConflict:'student_id,module_id,kind'})
 if(error)throw new Error('Das Modul konnte nicht freigeschaltet werden.')
 refresh();return {success:true}
}catch(error){return failure(error)}}
export async function activateExamFallback(input:{moduleId:string;confirmed:true}):Promise<ExamActionResult>{try{
 const value=z.object({moduleId:key,confirmed:z.literal(true)}).parse(input),actor=await getExamActor(),state=await loadExamState(actor)
 const moduleProgress=getExamProgress(state,EXAM_MODULES).modules.find(m=>m.moduleId===value.moduleId)
 if(!moduleProgress?.available||!moduleProgress.canActivateFallback)throw new Error('Für diesen Lernweg fehlen noch die zwei Lerncheckvarianten, drei Förderübungen oder der neue Transferauftrag.')
 const {error}=await createAdminClient().from('sitov_exam_unlocks').upsert({student_id:actor.userId,module_id:value.moduleId,kind:'fallback',reason:'Ich möchte weiterlernen. Zwei neue Lernchecks, drei Förderübungen und ein Transferauftrag wurden bearbeitet.',created_by:actor.userId},{onConflict:'student_id,module_id,kind',ignoreDuplicates:true})
 if(error)throw new Error('Der alternative Lernweg konnte nicht gespeichert werden.')
 return finished(actor)
}catch(error){return failure(error)}}
export async function assignExamTeacher(input:{studentId:string;teacherId:string;responseDays:number}):Promise<ExamActionResult>{try{
 const value=z.object({studentId:id,teacherId:id,responseDays:z.number().int().min(1).max(90)}).parse(input),actor=await getExamActor(true)
 if(actor.role!=='admin')throw new Error('Nur die Administration kann eine Lehrkraft zuweisen.')
 const admin=createAdminClient(),[student,teacher]=await Promise.all([admin.from('profiles').select('role').eq('id',value.studentId).maybeSingle(),admin.from('profiles').select('role').eq('id',value.teacherId).maybeSingle()])
 if(student.error||!student.data||student.data.role!=='student'||teacher.error||!['teacher','admin'].includes(teacher.data?.role??''))throw new Error('Bitte wähle ein bestehendes Schülerprofil und eine bestehende Lehrkraft.')
 const {error}=await admin.from('sitov_exam_teacher_assignments').upsert({student_id:value.studentId,teacher_id:value.teacherId,response_days:value.responseDays,assigned_by:actor.userId,updated_at:new Date().toISOString()})
 if(error)throw new Error('Die Lehrkraft konnte nicht zugewiesen werden.')
 refresh();return {success:true}
}catch(error){return failure(error)}}
export async function getExamTeacherState():Promise<{success:boolean;error?:string;submissions:ExamSubmission[];students:{id:string;name:string;course:string|null}[];assignments:{studentId:string;teacherId:string;responseDays:number}[];teachers:{id:string;name:string}[];actorRole:'teacher'|'admin'}>{try{
 const actor=await getExamActor(true),admin=createAdminClient()
 const assignments=await allExamRows((from,to)=>actor.role==='admin'?admin.from('sitov_exam_teacher_assignments').select('*').order('student_id').range(from,to):admin.from('sitov_exam_teacher_assignments').select('*').eq('teacher_id',actor.userId).order('student_id').range(from,to))
 const assignedIds=assignments.map(a=>a.student_id)
 const [profiles,people,rows,feedback,levels]=await Promise.all([
  allExamRows((from,to)=>admin.from('profiles').select('id,role').order('id').range(from,to)),
  allExamRows((from,to)=>admin.from('people').select('id,auth_user_id,display_name').order('id').range(from,to)),
  allExamRows((from,to)=>actor.client.from('sitov_exam_submissions').select('*').neq('status','draft').order('created_at',{ascending:false}).order('id').range(from,to)),
  allExamRows((from,to)=>actor.client.from('sitov_exam_feedback').select('*').order('created_at').order('id').range(from,to)),
  allExamRows((from,to)=>admin.from('student_level_access').select('auth_user_id,level').in('level',['B1.1','B1.2']).order('auth_user_id').order('level').range(from,to))
 ])
 const names=new Map(people.filter(p=>p.auth_user_id).map(p=>[p.auth_user_id!,p.display_name])),b1Ids=new Set(levels.map(a=>a.auth_user_id))
 const students=profiles.filter(p=>p.role==='student'&&(actor.role==='admin'?b1Ids.has(p.id):assignedIds.includes(p.id))).map(p=>({id:p.id,name:names.get(p.id)??'Lernender',course:null as string|null}))
 // Current, confirmed course registration is only a filter label; it does not assign a teacher or grant B1 access.
 if(students.length){const personIds=people.filter(p=>p.auth_user_id&&students.some(s=>s.id===p.auth_user_id)).map(p=>p.id)
  const bookings=await allExamRows((from,to)=>admin.from('bookings').select('person_id,items:booking_items(title_snapshot)').in('person_id',personIds).eq('status','confirmed').order('created_at',{ascending:false}).order('id').range(from,to))
  for(const student of students){const person=people.find(p=>p.auth_user_id===student.id),booking=bookings?.find(b=>b.person_id===person?.id);student.course=booking?.items.map(i=>i.title_snapshot).join(', ')||null}
 }
 return {success:true,actorRole:actor.role as 'teacher'|'admin',submissions:await mapExamSubmissions(actor.client,rows,feedback,names),students,assignments:assignments.map(a=>({studentId:a.student_id,teacherId:a.teacher_id,responseDays:a.response_days})),teachers:profiles.filter(p=>['teacher','admin'].includes(p.role??'')).map(p=>({id:p.id,name:names.get(p.id)??'Lehrkraft'}))}
}catch(error){return {success:false,error:failure(error).error,actorRole:'teacher',submissions:[],students:[],assignments:[],teachers:[]}}}

/** Feedback is delivered only after every closed item of this fixed variant is submitted. */
export async function getExamCheckpointFeedback(input:{unitId:string;variant:number}):Promise<{success:boolean;error?:string;results:ExamActionResult[]}>{try{
 const value=z.object({unitId:key,variant:z.number().int().min(0).max(99)}).parse(input),actor=await getExamActor()
 const unit=[...EXAM_MODULES,...EXAM_WORKSHOPS].flatMap(m=>m.units).find(u=>u.id===value.unitId)
 const tasks=unit&&[unit.tasks,...(unit.variants??[])][value.variant]
 if(!unit||unit.kind!=='checkpoint'||!tasks)throw new Error('Diese Lerncheckvariante ist nicht verfügbar.')
 const {data:rows,error}=await createAdminClient().from('sitov_exam_attempts').select('*').eq('student_id',actor.userId).eq('unit_id',value.unitId).eq('mode','checkpoint').eq('variant',value.variant).order('created_at').order('id')
 if(error||!rows||!isExamCheckpointReady(value.unitId,value.variant,rows))throw new Error('Bearbeite zuerst alle zehn geschlossenen Aufgaben dieser Lerncheckvariante.')
 return {success:true,results:tasks.filter(t=>!['writing','speaking'].includes(t.type)).map(t=>{
  const row=rows.find(r=>r.task_id===t.id&&r.task_version===t.version)!,attempt=mapExamAttempt(row,true)
  return {success:true,attempt,feedback:attempt.feedback}
 })}
}catch(error){return {success:false,error:failure(error).error,results:[]}}}
