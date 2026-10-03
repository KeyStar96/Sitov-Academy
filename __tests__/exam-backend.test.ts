jest.mock('server-only',()=>({}),{virtual:true})
jest.mock('next/cache',()=>({revalidatePath:jest.fn()}))
jest.mock('@/utils/supabase/server',()=>({createClient:jest.fn()}))
jest.mock('@/utils/supabase/admin',()=>({createAdminClient:jest.fn()}))
jest.mock('@/lib/access/server',()=>({loadLevelAccessProfile:jest.fn()}))
jest.mock('@/lib/audio/prepared-content',()=>({requirePreparedGermanAudio:jest.fn(async(texts:string[])=>new Map(texts.map(text=>[text,{audioUrl:'https://audio.test/prepared.wav'}])))}))
jest.mock('@/lib/exam-preparation/audio-production-server',()=>({getPublishedExamAudio:jest.fn(async()=>({}))}))
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { loadLevelAccessProfile } from '@/lib/access/server'
import { EXAM_MODULES } from '@/lib/exam-preparation/content'
import { getExamActor,getPublicExamCatalog,evaluateExamAnswer,mapExamAttempt,isExamCheckpointReady } from '@/lib/exam-preparation/server'
import { getExamHint,submitExamAnswer,getExamCheckpointFeedback } from '@/app/actions/exam-preparation'
import type { ExamAttemptRow } from '@/supabase/exam-preparation.types'
const studentId='00000000-0000-4000-8000-000000000001'
const requestId='00000000-0000-4000-8000-000000000080'
const checkpoint=EXAM_MODULES[0].units.find(u=>u.kind==='checkpoint')!
const closed=checkpoint.tasks.filter(t=>!['writing','speaking'].includes(t.type))
let attempts:ExamAttemptRow[]=[]
let inserted:Record<string,unknown>[]=[]
function receipt(index:number):ExamAttemptRow {const t=closed[index];return {id:`00000000-0000-4000-8000-${String(index+100).padStart(12,'0')}`,student_id:studentId,task_id:t.id,task_version:t.version,unit_id:checkpoint.id,answer:'a',correct:true,helped:false,feedback_viewed:false,seconds:2,mode:'checkpoint',variant:0,request_id:requestId,feedback:{explanation:'Server feedback',evidence:'Beleg',correctAnswer:t.correctAnswer},created_at:`2026-10-03T10:00:${String(index).padStart(2,'0')}Z`}}
function setup(allowed=true){
 attempts=[];inserted=[]
 const from=jest.fn((table:string)=>{
  const filters:Record<string,unknown>={};let payload:Record<string,unknown>|undefined
  const rows=()=>table==='sitov_exam_attempts'?attempts.filter(r=>Object.entries(filters).every(([key,value])=>r[key as keyof ExamAttemptRow]===value)):[]
  const builder={
   select:jest.fn().mockReturnThis(),eq:jest.fn((key:string,value:unknown)=>{filters[key]=value;return builder}),order:jest.fn().mockReturnThis(),
   range:jest.fn(async()=>({data:rows(),error:null})),maybeSingle:jest.fn(async()=>({data:rows()[0]??null,error:null})),
   insert:jest.fn((value:Record<string,unknown>)=>{payload=value;inserted.push(value);return builder}),
   single:jest.fn(async()=>{if(payload){const saved={...payload,id:requestId,created_at:'2026-10-03T10:00:00Z',feedback_viewed:false} as ExamAttemptRow;attempts.push(saved);return {data:saved,error:null}}return {data:null,error:null}}),
   then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:rows(),error:null}).then(resolve),
  };return builder
 })
 const client={auth:{getUser:jest.fn(async()=>({data:{user:{id:studentId}},error:null}))},from}
 jest.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
 jest.mocked(createAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>)
 jest.mocked(loadLevelAccessProfile).mockResolvedValue({role:'student',ui_language:'de',allowed_levels:allowed?['B1.2']:['A1.1']})
 return {from,client}
}
beforeEach(()=>jest.clearAllMocks())
it('authorizes global B1.2 for the German UI and refuses A1-only access',async()=>{
 setup();await expect(getExamActor()).resolves.toMatchObject({userId:studentId,role:'student'})
 setup(false);await expect(getExamActor()).rejects.toThrow('B1-Freigabe')
})
it('public catalog strips answer keys, solution explanations, evidence, hints and listening scripts in every variant',async()=>{
 setup();const catalog=await getPublicExamCatalog()
 const studio=catalog.workshops.find(m=>m.id==='sitov-exam-b1-human-studio')
 expect(studio?.units).toHaveLength(8);expect(studio?.units.every(u=>u.releaseStatus==='draft')).toBe(true)
 for(const unit of [...catalog.modules,...catalog.workshops].flatMap(m=>[...m.units,...(m.fallbackUnits??[])]))for(const task of [unit.tasks,...(unit.variants??[])].flat()){
  expect(task).not.toHaveProperty('correctAnswer');expect(task).not.toHaveProperty('explanation');expect(task).not.toHaveProperty('evidence');expect(task.hints).toEqual([])
  if(task.audio)expect(task.audio.script).toBe('')
 }
})
it('grades fixed server keys, including exact ordering and permitted short-text answers',()=>{
 const base=closed[0]
 expect(evaluateExamAnswer({...base,type:'ordering',correctAnswer:['a','b']},['b','a'])).toBe(false)
 expect(evaluateExamAnswer({...base,type:'ordering',correctAnswer:['a','b']},['a','b'])).toBe(true)
 expect(evaluateExamAnswer({...base,type:'short-text',correctAnswer:['Mittwoch','am Mittwoch']},'  AM  Mittwoch ')).toBe(true)
 expect(()=>evaluateExamAnswer({...base,correctAnswer:undefined},'anything')).toThrow()
})
it('masks persisted checkpoint grades until all ten fixed task/version receipts exist',()=>{
 const rows=closed.map((_,i)=>receipt(i))
 expect(isExamCheckpointReady(checkpoint.id,0,rows.slice(0,9))).toBe(false)
 expect(mapExamAttempt(rows[0])).toMatchObject({correct:null});expect(mapExamAttempt(rows[0]).feedback).toBeUndefined()
 expect(isExamCheckpointReady(checkpoint.id,0,rows)).toBe(true)
 expect(mapExamAttempt(rows[0],true)).toMatchObject({correct:true,feedback:{explanation:'Server feedback'}})
 expect(isExamCheckpointReady(checkpoint.id,1,rows)).toBe(false)
})
it('refuses crafted checkpoint hints and prematurely requested feedback',async()=>{
 setup()
 const hints=await getExamHint({taskId:closed[0].id,unitId:checkpoint.id})
 expect(hints).toMatchObject({success:false});expect(hints.error).toContain('gesperrt');expect(inserted).toEqual([])
 expect(await getExamCheckpointFeedback({unitId:checkpoint.id,variant:0})).toMatchObject({success:false,results:[]})
})
it('ignores a forged score and keeps the first checkpoint grade hidden from action callers',async()=>{
 setup()
 const wrong=closed[0].options?.find(o=>o.id!==closed[0].correctAnswer)?.id??'obviously-wrong'
 const result=await submitExamAnswer({taskId:closed[0].id,unitId:checkpoint.id,answer:wrong,helped:false,seconds:2,mode:'checkpoint',variant:0,requestId,...{correct:true}})
 expect(result.success).toBe(true);expect(inserted[0].correct).toBe(false);expect(result.attempt?.correct).toBeNull();expect(result.feedback).toBeUndefined()
})
it('cannot submit another variant under a known task or write after access denial',async()=>{
 const first=setup();const input={taskId:closed[0].id,unitId:checkpoint.id,answer:'a',helped:false,seconds:2,mode:'checkpoint' as const,variant:1,requestId}
 expect(await submitExamAnswer(input)).toMatchObject({success:false});expect(inserted).toEqual([])
 setup(false);expect(await submitExamAnswer({...input,variant:0})).toMatchObject({success:false});expect(inserted).toEqual([])
 expect(first.from).toHaveBeenCalled()
})
