jest.mock('server-only',()=>({}),{virtual:true})
jest.mock('next/cache',()=>({revalidatePath:jest.fn()}))
jest.mock('@/utils/supabase/server',()=>({createClient:jest.fn()}))
jest.mock('@/utils/supabase/admin',()=>({createAdminClient:jest.fn()}))
jest.mock('@/lib/access/server',()=>({loadLevelAccessProfile:jest.fn()}))
jest.mock('@/lib/audio/neural-cache',()=>({findCachedAudio:jest.fn(async()=>null),neuralAudioPath:jest.fn((text:string)=>text)}))
import {createClient} from '@/utils/supabase/server'
import {createAdminClient} from '@/utils/supabase/admin'
import {loadLevelAccessProfile} from '@/lib/access/server'
import {findCachedAudio} from '@/lib/audio/neural-cache'
import {hasSimulationFeatureAccess,hasSimulationLevelAccess} from '@/lib/exam-simulation/server'
import * as simulationServer from '@/lib/exam-simulation/server'
import {buildSimulation,finishSimulation,publicSimulation,type StoredSimulationSession} from '@/lib/exam-simulation/engine'
import {getSimulationState,startExamSimulation,saveSimulationAnswer,finishExamSimulation,startPreviewExamSimulation,savePreviewSimulationAnswer,finishPreviewExamSimulation,reviewExamSimulationTask,createSimulationUpload,grantSimulationFeature,resetStudentSimulationProgress} from '@/app/actions/exam-simulation'
import {SIMULATION_TASK_POOL} from '@/lib/exam-simulation/content'
import type {SimulationRunRow} from '@/supabase/exam-simulation.types'
import type {Json} from '@/supabase/database.types'
const student='00000000-0000-4000-8000-000000000001',outsider='00000000-0000-4000-8000-000000000002'
const request='00000000-0000-4000-8000-000000000060'
let runs:SimulationRunRow[]=[],receipts:Record<string,unknown>[]=[],mutations:Record<string,unknown>[]=[]
function row(snapshot:StoredSimulationSession,owner=student):SimulationRunRow {return {id:snapshot.id,student_id:owner,level:snapshot.level,provider:snapshot.provider,mode:snapshot.mode,status:snapshot.status,started_at:snapshot.startedAt,expires_at:snapshot.expiresAt,completed_at:snapshot.completedAt??null,revision:0,generation:0,start_request_id:request,start_request_hash:'hash',server_snapshot:snapshot as unknown as Json}}
function setup({authenticated=true,role='student',levels=['B1.2'],featureGranted=true,advancedLevels=[] as string[],assignedStudentIds=[] as string[],generation=0,resetPending=false}={}){
 runs=[];receipts=[];mutations=[]
 let featureGrants:Record<string,unknown>[]=featureGranted?[{student_id:student}]:[]
 const from=jest.fn((table:string)=>{
  const filters:Record<string,unknown>={};let inserted:Record<string,unknown>|undefined,removed=false
  const matching=()=>{
   const rows:Record<string,unknown>[]=table==='sitov_simulation_runs'?runs as unknown as Record<string,unknown>[]:table==='sitov_simulation_receipts'?receipts:table==='sitov_simulation_feature_grants'?featureGrants:table==='sitov_simulation_level_grants'?advancedLevels.map(level=>({student_id:student,level})):table==='sitov_simulation_learning_state'?[{student_id:student,generation,reset_pending:resetPending?request:null}]:table==='profiles'?[{id:student,role},{id:outsider,role:'student'}]:table==='sitov_exam_teacher_assignments'?assignedStudentIds.map(student_id=>({student_id,teacher_id:student})):[]
   return rows.filter(item=>Object.entries(filters).every(([key,value])=>item[key]===value))
  }
  const builder={select:jest.fn().mockReturnThis(),order:jest.fn().mockReturnThis(),eq:jest.fn((key:string,value:unknown)=>{filters[key]=value;return builder}),
   insert:jest.fn((value:Record<string,unknown>)=>{inserted=value;mutations.push(value);return builder}),
   upsert:jest.fn((value:Record<string,unknown>)=>{if(table==='sitov_simulation_feature_grants')featureGrants=[...featureGrants.filter(row=>row.student_id!==value.student_id),value];mutations.push(value);return builder}),
   delete:jest.fn(()=>{removed=true;return builder}),
   maybeSingle:jest.fn(async()=>({data:matching()[0]??null,error:null})),
   single:jest.fn(async()=>{if(inserted){const value={revision:0,...inserted} as SimulationRunRow;runs.push(value);return {data:value,error:null}}return {data:matching()[0]??null,error:null}}),
   range:jest.fn(async()=>({data:matching(),error:null})),then:(resolve:(value:unknown)=>unknown)=>{if(removed){featureGrants=featureGrants.filter(row=>!Object.entries(filters).every(([key,value])=>row[key]===value));mutations.push({table,...filters,deleted:true})}return Promise.resolve({data:matching(),error:null}).then(resolve)},
  };return builder
 })
 const rpc=jest.fn(async(_name:string,args:{p_run_id:string;p_snapshot:Json;p_revision:number;p_student_id:string;p_request_id:string;p_kind:string;p_payload_hash:string})=>{
  const target=runs.find(run=>run.id===args.p_run_id&&run.student_id===args.p_student_id)
  if(!target)return {data:null,error:{message:'simulation_not_found'}}
  if(target.revision!==args.p_revision)return {data:{conflict:true},error:null}
  target.server_snapshot=args.p_snapshot;target.status=(args.p_snapshot as unknown as StoredSimulationSession).status;target.revision++
  receipts.push({student_id:args.p_student_id,request_id:args.p_request_id,run_id:args.p_run_id,kind:args.p_kind,payload_hash:args.p_payload_hash})
  mutations.push(args as unknown as Record<string,unknown>)
  return {data:{snapshot:args.p_snapshot,revision:target.revision},error:null}
 })
 const remove=jest.fn(async()=>({data:[],error:null}))
 const client={auth:{getUser:jest.fn(async()=>({data:{user:authenticated?{id:student}:null},error:null}))},from,rpc,storage:{from:jest.fn(()=>({createSignedUrl:jest.fn(async()=>({data:{signedUrl:'https://private.test/own.webm'},error:null})),remove}))}}
 jest.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
 jest.mocked(createAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>)
 jest.mocked(loadLevelAccessProfile).mockResolvedValue({role,ui_language:'de',allowed_levels:levels})
 return {from,rpc,client,remove}
}
beforeEach(()=>{jest.clearAllMocks();jest.mocked(findCachedAudio).mockResolvedValue(null);setup()})
it('uses explicit level access regardless of UI language and rejects advanced student grants outside the catalogue',()=>{
 expect(hasSimulationFeatureAccess({role:'student',allowed_levels:['A1.1','A2.1','B1.2'],simulation_levels:['B2','C1','C2']})).toBe(false)
 expect(hasSimulationFeatureAccess({role:'student',allowed_levels:[],simulation_enabled:true})).toBe(true)
 expect(hasSimulationFeatureAccess({role:'teacher',allowed_levels:[]})).toBe(true)
 expect(hasSimulationLevelAccess({role:'student',ui_language:'de',allowed_levels:['B1.2']},'B1')).toBe(true)
 expect(hasSimulationLevelAccess({role:'student',allowed_levels:['A1.1']},'B1')).toBe(false)
 expect(hasSimulationLevelAccess({role:'student',allowed_levels:['C1']},'C1')).toBe(false)
 expect(hasSimulationLevelAccess({role:'student',allowed_levels:[],simulation_levels:['C1']},'C1')).toBe(true)
 expect(hasSimulationLevelAccess({role:'teacher',allowed_levels:[]},'C2')).toBe(true)
})
it('locks every student level behind a separate feature grant even when all course and advanced grants exist',async()=>{
 setup({featureGranted:false,levels:['A1.1','A2.1','B1.2'],advancedLevels:['B2','C1','C2']})
 for(const level of ['A1','A2','B1','B2','C1','C2'] as const)expect(await startExamSimulation({level,requestId:request})).toMatchObject({success:false,error:expect.stringContaining('noch nicht freigegeben')})
 expect(mutations).toEqual([]);expect(findCachedAudio).not.toHaveBeenCalled()
})
it('revoking feature access blocks read/save/finish/upload without closing or deleting an existing attempt',async()=>{
 const {from}=setup({featureGranted:false})
 const snapshot=buildSimulation({level:'B1',provider:'telc',mode:'practice'});runs.push(row(snapshot))
 expect(await getSimulationState()).toMatchObject({available:false,accessLocked:true,active:null,history:[]})
 expect(await saveSimulationAnswer({runId:snapshot.id,taskId:snapshot.tasks[0].id,answer:'a',requestId:request})).toMatchObject({success:false,error:expect.stringContaining('noch nicht freigegeben')})
 expect(await finishExamSimulation({runId:snapshot.id,requestId:request})).toMatchObject({success:false,error:expect.stringContaining('noch nicht freigegeben')})
 expect(await createSimulationUpload({runId:snapshot.id,taskId:snapshot.tasks.find(task=>task.type==='speaking')!.id,mimeType:'audio/webm',bytes:1000})).toMatchObject({success:false,error:expect.stringContaining('noch nicht freigegeben')})
 expect(from.mock.calls.every(([table])=>table!=='sitov_simulation_runs')).toBe(true)
 expect(mutations).toEqual([]);expect(runs[0].status).toBe('active');expect(runs[0].server_snapshot).toEqual(snapshot)
})
it('feature grants can only be changed by assigned teachers or administrators and remain distinct from level grants',async()=>{
 setup({featureGranted:false});expect(await grantSimulationFeature({studentId:outsider,enabled:true})).toMatchObject({success:false});expect(mutations).toEqual([])
 setup({role:'teacher',featureGranted:false});expect(await grantSimulationFeature({studentId:outsider,enabled:true})).toMatchObject({success:false});expect(mutations).toEqual([])
 setup({role:'teacher',featureGranted:false,assignedStudentIds:[outsider]})
 expect(await grantSimulationFeature({studentId:outsider,enabled:true})).toEqual({success:true})
 expect(mutations[0]).toMatchObject({student_id:outsider,granted_by:student})
 expect(await grantSimulationFeature({studentId:outsider,enabled:false})).toEqual({success:true})
 expect(mutations[1]).toMatchObject({table:'sitov_simulation_feature_grants',student_id:outsider,deleted:true})
})
it('does not misreport infrastructure failures as a personal feature lock',async()=>{
 setup({authenticated:false})
 expect(await getSimulationState()).toMatchObject({available:false})
 expect(await getSimulationState()).not.toHaveProperty('accessLocked',true)
})
it('only current assigned staff may reset simulation progress, never pupils or a former teacher',async()=>{
 let client=setup()
 expect(await resetStudentSimulationProgress({studentId:outsider,requestId:request})).toMatchObject({success:false})
 expect(client.rpc).not.toHaveBeenCalled();expect(client.remove).not.toHaveBeenCalled()
 client=setup({role:'teacher'})
 expect(await resetStudentSimulationProgress({studentId:outsider,requestId:request})).toMatchObject({success:false})
 expect(client.rpc).not.toHaveBeenCalled();expect(client.remove).not.toHaveBeenCalled()
})
it('resumes a durable staff reset after Storage failure with the same request and only the queued private media',async()=>{
 const {rpc,remove}=setup({role:'teacher',assignedStudentIds:[outsider]})
 const job={jobId:'00000000-0000-4000-8000-000000000091',status:'pending',generation:1,media:[{bucket:'sitov-exam-submissions',path:`${outsider}/speaking/own.webm`}]}
 rpc.mockImplementation(async name=>({data:name==='sitov_begin_simulation_reset'?job:true,error:null}) as unknown as Awaited<ReturnType<typeof rpc>>)
 remove.mockResolvedValueOnce({data:[],error:{message:'network failed'}} as unknown as Awaited<ReturnType<typeof remove>>)
 expect(await resetStudentSimulationProgress({studentId:outsider,requestId:request})).toMatchObject({success:false,pending:true})
 expect(rpc.mock.calls.filter(([name])=>name==='sitov_finish_simulation_reset')).toHaveLength(0)
 expect(await resetStudentSimulationProgress({studentId:outsider,requestId:request})).toEqual({success:true})
 const begin=rpc.mock.calls.filter(([name])=>name==='sitov_begin_simulation_reset')
 expect(begin).toHaveLength(2);expect(begin[0][1]).toEqual(begin[1][1])
 expect(begin[0][1]).toEqual({p_student_id:outsider,p_staff_id:student,p_request_id:request})
 expect(remove).toHaveBeenCalledWith([`${outsider}/speaking/own.webm`])
 expect(rpc).toHaveBeenLastCalledWith('sitov_finish_simulation_reset',{p_job_id:job.jobId,p_staff_id:student})
})
it('completed reset replay never removes media again and malformed queues cannot remove another learner files',async()=>{
 let client=setup({role:'admin'})
 client.rpc.mockResolvedValue({data:{jobId:request,status:'completed',generation:1,media:[]},error:null} as unknown as Awaited<ReturnType<typeof client.rpc>>)
 expect(await resetStudentSimulationProgress({studentId:outsider,requestId:request})).toEqual({success:true})
 expect(client.remove).not.toHaveBeenCalled()
 client=setup({role:'admin'})
 client.rpc.mockResolvedValue({data:{jobId:request,status:'pending',generation:1,media:[{bucket:'sitov-exam-submissions',path:`${student}/speaking/foreign.webm`}]},error:null} as unknown as Awaited<ReturnType<typeof client.rpc>>)
 expect(await resetStudentSimulationProgress({studentId:outsider,requestId:request})).toMatchObject({success:false,pending:true})
 expect(client.remove).not.toHaveBeenCalled()
})
it('blocks learner actions while staff cleanup is pending and records the current reset generation on new starts',async()=>{
 setup({resetPending:true})
 expect(await startExamSimulation({level:'B1',requestId:request})).toMatchObject({success:false,error:expect.stringContaining('zurück')})
 expect(await getSimulationState()).toMatchObject({available:false})
 expect(await getSimulationState()).not.toHaveProperty('accessLocked',true)
 expect(mutations).toEqual([])
 setup({generation:3})
 jest.mocked(findCachedAudio).mockResolvedValue({audioUrl:'https://prepared.test/verified.mp3',wordTimings:[{start:0,end:1}]})
 expect(await startExamSimulation({level:'B1',requestId:request})).toMatchObject({success:true})
 expect(mutations[0]).toMatchObject({generation:3})
})
it('refuses unauthenticated starts and B1 starts without B1 access before touching private persistence',async()=>{
 setup({authenticated:false});expect(await startExamSimulation({level:'B1',requestId:request})).toMatchObject({success:false});expect(mutations).toEqual([])
 setup({levels:['A1.1']});expect(await startExamSimulation({level:'B1',requestId:request})).toMatchObject({success:false,error:expect.stringContaining('Niveau-Freigabe')});expect(mutations).toEqual([])
})
it('creates one authoritative randomized run, resumes the same start receipt and refuses a changed provider under that receipt',async()=>{
 jest.mocked(findCachedAudio).mockResolvedValue({audioUrl:'https://prepared.test/verified.mp3',wordTimings:[{start:0,end:1}]})
 const first=await startExamSimulation({level:'B1',requestId:request})
 expect(first.success).toBe(true);expect(first.session?.id).toMatch(/^[0-9a-f-]{36}$/)
 expect(first.session?.tasks.length).toBeGreaterThan(5);expect(first.session?.result).toBeUndefined();expect(first.session?.provider).toBe('sitov');expect(first.session?.mode).toBe('exam');expect(first.session?.coverage.fullExam).toBe(true)
 expect(JSON.stringify(first.session)).not.toContain('correctAnswer');expect(runs).toHaveLength(1)
 const resumed=await startExamSimulation({level:'B1',requestId:request})
 expect(resumed.session?.id).toBe(first.session?.id);expect(runs).toHaveLength(1)
 expect(await startExamSimulation({level:'B1',provider:'goethe',requestId:request})).toMatchObject({success:false})
})
it('excludes tasks from older runs of the same level even when another provider was selected',async()=>{
 const newest=buildSimulation({level:'B1',provider:'telc',mode:'practice'}),second=buildSimulation({level:'B1',provider:'telc',mode:'practice'}),older=buildSimulation({level:'B1',provider:'goethe',mode:'practice'})
 runs.push(row(finishSimulation(newest)),row(finishSimulation(second)),row(finishSimulation({...older,tasks:SIMULATION_TASK_POOL.filter(task=>task.level==='B1')})))
 jest.mocked(findCachedAudio).mockResolvedValue({audioUrl:'https://prepared.test/verified.mp3',wordTimings:[{start:0,end:1}]})
 const result=await startExamSimulation({level:'B1',requestId:'00000000-0000-4000-8000-000000000090'})
 expect(result).toMatchObject({success:false});expect(result.error).toMatch(/bereits|neue Varianten|Aufgabenpool/i);expect(mutations).toEqual([])
})
it('refuses a full universal examination when mandatory verified hearing is absent',async()=>{
 expect(await startExamSimulation({level:'B1',requestId:request})).toMatchObject({success:false});expect(mutations).toEqual([])
})
it('never creates a new provider-specific or partial rehearsal after the universal correction',async()=>{
 expect(await startExamSimulation({level:'B1',provider:'goethe',requestId:request})).toMatchObject({success:false})
 expect(await startExamSimulation({level:'B1',mode:'practice',requestId:request})).toMatchObject({success:false});expect(mutations).toEqual([])
})
it('closes an inaccessible active snapshot privately so a revoked level cannot block another allowed level',async()=>{
 setup({levels:['A1.1']});const snapshot=buildSimulation({level:'B1',provider:'telc',mode:'practice'});runs.push(row(snapshot))
 const state=await getSimulationState()
 expect(state).toMatchObject({available:true,active:null,history:[]});expect(runs[0].status).toBe('completed')
 expect(JSON.stringify(state)).not.toContain('correctAnswer')
})
it('cannot overwrite another learner run with a guessed ID',async()=>{
 const snapshot=buildSimulation({level:'B1',provider:'telc',mode:'practice'});runs.push(row(snapshot,outsider))
 expect(await saveSimulationAnswer({runId:snapshot.id,taskId:snapshot.tasks[0].id,answer:'a',requestId:request})).toMatchObject({success:false});expect(mutations).toEqual([])
})
it('evaluates only a frozen server assignment and never returns correctness until finish',async()=>{
 const snapshot=buildSimulation({level:'B1',provider:'telc',mode:'practice'}),task=snapshot.tasks.find(task=>task.correctAnswer!==undefined)!
 runs.push(row(snapshot))
 const result=await saveSimulationAnswer({runId:snapshot.id,taskId:task.id,answer:task.correctAnswer!,requestId:request,...{correct:true,result:{examPass:true}}})
 expect(result.success).toBe(true);expect(result.session?.result).toBeUndefined()
 for(const task of result.session!.tasks){expect(task).not.toHaveProperty('correctAnswer');expect(task).not.toHaveProperty('explanation');expect(task).not.toHaveProperty('spokenText');expect(task).not.toHaveProperty('audioSource')}
 expect((runs[0].server_snapshot as unknown as StoredSimulationSession).tasks.some(task=>task.correctAnswer!==undefined)).toBe(true)
 const completed=await finishExamSimulation({runId:snapshot.id,requestId:'00000000-0000-4000-8000-000000000061'})
 expect(completed.success).toBe(true);expect(completed.session?.result?.examPass).toBeNull()
 expect(completed.session?.result?.feedback.find(item=>item.taskId===task.id)?.correct).toBe(true)
})
it('persists A1 form fields under the frozen own rubric without accepting student grading or exposing active keys',async()=>{
 setup({levels:['A1.1']})
 jest.mocked(findCachedAudio).mockResolvedValue({audioUrl:'https://prepared.test/verified.mp3',wordTimings:[{start:0,end:1}]})
 const started=await startExamSimulation({level:'A1',requestId:request})
 expect(started.success).toBe(true)
 const snapshot=runs[0].server_snapshot as unknown as StoredSimulationSession
 const rubric=JSON.stringify(snapshot.rubric),form=snapshot.tasks.find(task=>task.type==='form')!
 expect(form.fields).toHaveLength(4)
 const values=(form.correctAnswer as string[]).map(value=>`  ${value.toUpperCase()}  `)
 const saved=await saveSimulationAnswer({runId:snapshot.id,taskId:form.id,answer:values,requestId:'00000000-0000-4000-8000-000000000062',...{rubric:{skillMinimum:0},result:{examPass:true}}})
 expect(saved.success).toBe(true);expect(saved.session?.answers[form.id]).toEqual(values)
 expect(saved.session).not.toHaveProperty('rubric');expect(saved.session?.result).toBeUndefined()
 expect(saved.session?.tasks.find(task=>task.id===form.id)).not.toHaveProperty('correctAnswer')
 expect(JSON.stringify((runs[0].server_snapshot as unknown as StoredSimulationSession).rubric)).toBe(rubric)
 const finished=await finishExamSimulation({runId:snapshot.id,requestId:'00000000-0000-4000-8000-000000000063'})
 expect(finished.session?.result?.feedback.find(item=>item.taskId===form.id)).toMatchObject({correct:true,points:4,maxPoints:4})
 expect(finished.session?.result?.examPass).toBe(false)
 expect(JSON.stringify((runs[0].server_snapshot as unknown as StoredSimulationSession).rubric)).toBe(rubric)
})
it('rejects wrong task IDs and late saves without recording a mutation',async()=>{
 const snapshot=buildSimulation({level:'B1',provider:'telc',mode:'practice'});runs.push(row(snapshot))
 expect(await saveSimulationAnswer({runId:snapshot.id,taskId:'foreign-task',answer:'a',requestId:request})).toMatchObject({success:false})
 const expired={...snapshot,expiresAt:'2020-01-01T00:00:00Z'};runs[0]=row(expired)
 expect(await saveSimulationAnswer({runId:snapshot.id,taskId:snapshot.tasks[0].id,answer:'a',requestId:request})).toMatchObject({success:false});expect(mutations).toEqual([])
})
it('refuses storage tickets for a reading item and teacher review from a student',async()=>{
 const snapshot=buildSimulation({level:'B1',provider:'telc',mode:'practice'});runs.push(row(snapshot))
 expect(await createSimulationUpload({runId:snapshot.id,taskId:snapshot.tasks.find(task=>task.skill==='reading')!.id,mimeType:'audio/webm',bytes:1000})).toMatchObject({success:false})
 expect(await reviewExamSimulationTask({runId:snapshot.id,taskId:snapshot.tasks[0].id,score:100,comment:'Alles richtig',requestId:request})).toMatchObject({success:false});expect(mutations).toEqual([])
})
it('requires confirmed genuine dialogue for positive teacher speaking points and permits review after pupil feature revoke',async()=>{
 setup({role:'admin',featureGranted:false})
 const snapshot=buildSimulation({level:'B1',provider:'telc',mode:'practice'}),task=snapshot.tasks.find(task=>task.type==='speaking')!
 task.interactionRequired=true
 snapshot.answers[task.id]={text:'Mein Vorbereitungstext',audioPath:`${student}/speaking/own.webm`}
 const completed=finishSimulation(snapshot);runs.push(row(completed))
 const verified=jest.spyOn(simulationServer,'verifySimulationAnswerMedia').mockResolvedValue(undefined)
 try {
  const input={runId:snapshot.id,taskId:task.id,score:task.maxPoints,comment:'Antworten und Rückfragen wurden mit einem Partner verständlich bearbeitet.',requestId:request}
  expect(await reviewExamSimulationTask(input)).toMatchObject({success:false,error:expect.stringContaining('echten Dialog')})
  expect(mutations).toEqual([])
  const reviewed=await reviewExamSimulationTask({...input,interactionConfirmed:true})
  expect(reviewed.success).toBe(true)
  expect(reviewed.session?.result?.feedback.find(item=>item.taskId===task.id)?.teacherReview).toMatchObject({interactionConfirmed:true,score:task.maxPoints,teacherId:student})
  expect(verified).toHaveBeenCalledWith(snapshot.answers[task.id],student)
 }finally{verified.mockRestore()}
})
it('never opens the development preview or persists demonstration answers in production',async()=>{
 const prior=process.env.NODE_ENV;Object.defineProperty(process.env,'NODE_ENV',{value:'production',configurable:true,writable:true})
 try {expect(await startPreviewExamSimulation({level:'B1',provider:'telc',requestId:request})).toMatchObject({success:false});expect(createAdminClient).not.toHaveBeenCalled()}finally{Object.defineProperty(process.env,'NODE_ENV',{value:prior,configurable:true,writable:true})}
})
it('starts a complete development preview only from verified imported hearing without accessing learner records',async()=>{
 const prior=process.env.NODE_ENV;Object.defineProperty(process.env,'NODE_ENV',{value:'development',configurable:true,writable:true})
 try {
  expect(await startPreviewExamSimulation({level:'A1',requestId:request})).toMatchObject({success:false})
  expect(createAdminClient).not.toHaveBeenCalled();expect(createClient).not.toHaveBeenCalled()
  jest.mocked(findCachedAudio).mockResolvedValue({audioUrl:'https://prepared.test/verified.mp3',wordTimings:[{start:0,end:1}]})
  const started=await startPreviewExamSimulation({level:'A1',requestId:request})
  expect(started).toMatchObject({success:true,session:{provider:'sitov',mode:'exam',coverage:{fullExam:true,missing:[]}}})
  expect(started.session!.tasks.filter(task=>task.skill==='listening').every(task=>task.audio?.src==='https://prepared.test/verified.mp3')).toBe(true)
  const task=started.session!.tasks.find(task=>task.type==='choice')!
  const saved=await savePreviewSimulationAnswer({runId:started.session!.id,taskId:task.id,answer:task.options![0].id,requestId:request})
  expect(saved.success).toBe(true);expect(saved.session?.answers[task.id]).toBe(task.options![0].id)
  expect(saved.session?.result).toBeUndefined();expect(JSON.stringify(saved.session)).not.toContain('correctAnswer')
  const finished=await finishPreviewExamSimulation({runId:started.session!.id,requestId:request})
  expect(finished.session?.status).toBe('completed');expect(finished.session?.result?.examPass).not.toBe(true)
  expect(createAdminClient).not.toHaveBeenCalled();expect(createClient).not.toHaveBeenCalled();expect(mutations).toEqual([])
 }finally{Object.defineProperty(process.env,'NODE_ENV',{value:prior,configurable:true,writable:true})}
})
it('public engine serialization masks all secrets on active runs',()=>{
 const snapshot=buildSimulation({level:'B1',provider:'telc',mode:'practice'}),safe=publicSimulation(snapshot)
 expect(safe.result).toBeUndefined();expect(JSON.stringify(safe)).not.toContain('correctAnswer');expect(JSON.stringify(safe)).not.toContain('spokenText')
})
