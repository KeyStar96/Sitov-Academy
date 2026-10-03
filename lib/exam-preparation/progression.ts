import type { ExamModule, ExamSkill, ExamState, ExamSubmission, ExamTask, ExamUnit } from './types'

export const EXAM_PROGRESSION_RULES = { requiredUnits: 8, unlockPercent: 70, independentPercent: 80, failedVariants: 2, practiceTasks: 3, checkpointItems: 10 } as const
const skills: ExamSkill[] = ['vocabulary','listening','reading','writing','speaking']
const requiredEvidence = ['listening','reading','writing','speaking','checkpoint'] as const
export interface ExamUnitProgress { unitId:string; completedTasks:number; totalTasks:number; completed:boolean; independent:boolean }
export interface ExamModuleProgress {
 moduleId:string; available:boolean; completedUnits:number; totalUnits:number; completedTasks:number; totalTasks:number
 checkpointPercent:number|null; failedVariants:number; canActivateFallback:boolean; fallbackActive:boolean; unlocksNext:boolean; independent:boolean
 requiredEvidence:string[]; missingEvidence:string[]; repeatNeeded:boolean
}
export interface ExamProgress {
 modules:ExamModuleProgress[]; completedTasks:number; totalTasks:number; independentTasks:number; completedUnits:number; totalUnits:number
 skills:{skill:ExamSkill;completed:number;total:number;independent:number}[]; pendingFeedback:number; seconds:number
}
const identity = (task:{id:string;version:number}) => `${task.id}@${task.version}`
/** Content revisions never re-grade or mutate a historical receipt. */
function attemptsFor(task:ExamTask,state:ExamState) { return state.attempts.filter(a=>a.taskId===task.id && a.taskVersion===task.version).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)) }
function submissionsFor(task:ExamTask,state:ExamState) { return state.submissions.filter(s=>s.taskId===task.id && s.taskVersion===task.version) }
function substantive(submission:ExamSubmission) { return !!(submission.text.trim() || submission.mediaPath || submission.photoPath) }
function reflected(submission:ExamSubmission,state:ExamState) {
 if (!submission.previousId || !substantive(submission)) return false
 const previous=state.submissions.find(s=>s.id===submission.previousId && s.taskId===submission.taskId && s.studentId===submission.studentId)
 // Reflection/revision follows feedback, rather than inventing a self-awarded assessment.
 return !!previous?.feedback.some(f=>Date.parse(f.createdAt)<=Date.parse(submission.createdAt)) && (!!submission.reflection?.trim() || submission.text.trim()!==previous.text.trim() || submission.mediaPath!==previous.mediaPath || submission.photoPath!==previous.photoPath)
}
export function isExamTaskCompleted(task:ExamTask,state:ExamState):boolean {
 if (task.type==='writing'||task.type==='speaking') return submissionsFor(task,state).some(s=>reflected(s,state))
 return attemptsFor(task,state).some(a=>a.feedbackViewed)
}
export function isExamTaskIndependent(task:ExamTask,state:ExamState):boolean {
 if (task.type==='writing'||task.type==='speaking') return submissionsFor(task,state).some(s=>substantive(s) && !s.helped && s.feedback.at(-1)?.rating==='independent')
 const first=attemptsFor(task,state)[0]
 return !!first?.correct && !first.helped && first.feedbackViewed
}
function primaryTasks(unit:ExamUnit) { return unit.tasks }
export function getExamUnitProgress(unit:ExamUnit,state:ExamState):ExamUnitProgress {
 const tasks=primaryTasks(unit)
 // A checkpoint is a complete fixed variant, not a mixture of its easiest items.
 const groups=unit.kind==='checkpoint' ? [tasks,...(unit.variants??[])] : [tasks]
 const completedGroup=groups.find(g=>g.length>0 && g.every(t=>isExamTaskCompleted(t,state)))
 const completedTasks=completedGroup?.length ?? Math.max(0,...groups.map(g=>g.filter(t=>isExamTaskCompleted(t,state)).length))
 return {unitId:unit.id,completedTasks,totalTasks:tasks.length,completed:!!completedGroup,independent:!!completedGroup?.every(t=>isExamTaskIndependent(t,state))}
}
function checkpoints(module:ExamModule,state:ExamState) {
 return module.units.filter(u=>u.kind==='checkpoint').flatMap(unit=>[unit.tasks,...(unit.variants??[])].map((tasks,variant)=>{
  const closed=tasks.filter(t=>t.type!=='writing'&&t.type!=='speaking')
  const attempts=closed.map(t=>attemptsFor(t,state)[0])
  const complete=closed.length===EXAM_PROGRESSION_RULES.checkpointItems && attempts.every(a=>!!a && a.unitId===unit.id && a.mode==='checkpoint' && a.variant===variant && a.feedbackViewed && !a.helped)
  // Ten new listening/reading decisions are needed. Other tasks cannot substitute them.
  const listening=closed.filter(t=>t.skill==='listening').length,reading=closed.filter(t=>t.skill==='reading').length
  const valid=complete && listening===5 && reading===5
  return {variant,unitId:unit.id,valid,percent: valid ? attempts.filter(a=>a?.correct).length/closed.length*100 : null,at:Math.max(0,...attempts.map(a=>a?Date.parse(a.createdAt):0))}
 }))
}
function moduleResult(module:ExamModule,state:ExamState):ExamModuleProgress {
 const units=module.units.map(u=>({u,progress:getExamUnitProgress(u,state)}))
 const completed=units.filter(({progress})=>progress.completed)
 const evidence=new Set(completed.map(({u})=>u.kind))
 const missingEvidence=requiredEvidence.filter(kind=>!evidence.has(kind))
 const checks=checkpoints(module,state).filter(c=>c.valid)
 const best=checks.length?Math.max(...checks.map(c=>c.percent??0)):null
 const failed=checks.filter(c=>(c.percent??100)<EXAM_PROGRESSION_RULES.unlockPercent)
 const secondFailureAt=failed.length>=2?failed.sort((a,b)=>a.at-b.at)[1].at:Infinity
 const checkpointIds=new Set(module.units.filter(u=>u.kind==='checkpoint').flatMap(u=>[u.tasks,...(u.variants??[])].flat().map(identity)))
 const practice=new Set(state.attempts.filter(a=>a.mode==='practice'&&a.feedbackViewed&&Date.parse(a.createdAt)>secondFailureAt&&[...module.units,...(module.fallbackUnits??[])].some(u=>u.kind!=='checkpoint'&&u.kind!=='transfer'&&u.id===a.unitId)&&!checkpointIds.has(`${a.taskId}@${a.taskVersion}`)).map(a=>`${a.taskId}@${a.taskVersion}`))
 const transfer=[...module.units,...(module.fallbackUnits??[])].filter(u=>u.kind==='transfer').some(u=>u.tasks.length>0&&u.tasks.every(t=>{
  if(t.type==='writing'||t.type==='speaking') return submissionsFor(t,state).filter(s=>!s.previousId).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).slice(0,1).some(s=>substantive(s)&&Date.parse(s.createdAt)>secondFailureAt)
  const first=attemptsFor(t,state)[0];return !!first?.feedbackViewed&&Date.parse(first.createdAt)>secondFailureAt
 }))
 const canActivateFallback=failed.length>=2&&practice.size>=EXAM_PROGRESSION_RULES.practiceTasks&&transfer
 const fallbackActive=state.fallbackModules.includes(module.id)
 const normal=completed.length>=EXAM_PROGRESSION_RULES.requiredUnits&&!missingEvidence.length&&(best??0)>=EXAM_PROGRESSION_RULES.unlockPercent
 return {moduleId:module.id,available:false,completedUnits:completed.length,totalUnits:module.units.length,completedTasks:units.reduce((n,{progress})=>n+progress.completedTasks,0),totalTasks:units.reduce((n,{progress})=>n+progress.totalTasks,0),checkpointPercent:best,failedVariants:failed.length,canActivateFallback,fallbackActive,unlocksNext:normal||fallbackActive,independent:normal&&(best??0)>=EXAM_PROGRESSION_RULES.independentPercent&&completed.filter(({progress})=>progress.independent).length>=EXAM_PROGRESSION_RULES.requiredUnits,requiredEvidence:[...requiredEvidence],missingEvidence:[...missingEvidence],repeatNeeded:fallbackActive||failed.length>0&&!normal}
}
export function getExamProgress(state:ExamState,modules:ExamModule[],workshops:ExamModule[]=[]):ExamProgress {
 const results=modules.map(m=>moduleResult(m,state))
 results.forEach((result,index)=>{result.available=state.available&&(index===0||results[index-1].unlocksNext||state.overrides.some(o=>o.moduleId===result.moduleId))&&modules[index].releaseStatus==='published'})
 const published=[...modules,...workshops].filter(m=>m.releaseStatus==='published').flatMap(m=>[...m.units,...((results.find(r=>r.moduleId===m.id)?.failedVariants??0)>=2?(m.fallbackUnits??[]):[])]).filter(u=>u.releaseStatus==='published')
 const tasks=[...new Map(published.flatMap(u=>[u.tasks,...(u.variants??[])].flat()).filter(t=>t.releaseStatus!=='draft').map(t=>[identity(t),t])).values()]
 const unitProgress=published.map(u=>getExamUnitProgress(u,state))
 return {modules:results,completedTasks:tasks.filter(t=>isExamTaskCompleted(t,state)).length,totalTasks:tasks.length,independentTasks:tasks.filter(t=>isExamTaskIndependent(t,state)).length,completedUnits:unitProgress.filter(u=>u.completed).length,totalUnits:unitProgress.length,skills:skills.map(skill=>{const own=tasks.filter(t=>t.skill===skill);return {skill,completed:own.filter(t=>isExamTaskCompleted(t,state)).length,total:own.length,independent:own.filter(t=>isExamTaskIndependent(t,state)).length}}),pendingFeedback:state.submissions.filter(s=>s.status==='submitted'&&!s.feedback.length).length,seconds:state.attempts.reduce((n,a)=>n+a.seconds,0)}
}
export function isExamUnitAvailable(unit:ExamUnit,state:ExamState,modules:ExamModule[]):boolean {
 const result=getExamProgress(state,modules).modules.find(m=>m.moduleId===unit.moduleId)
 const owner=modules.find(m=>m.id===unit.moduleId)
 if(owner?.fallbackUnits?.some(u=>u.id===unit.id)&&(result?.failedVariants??0)<2)return false
 return state.available&&unit.releaseStatus==='published'&&(result?.available??true)
}
