import { getExamProgress, getExamUnitProgress, isExamTaskCompleted, isExamTaskIndependent } from '@/lib/exam-preparation/progression'
import type { ExamAttempt, ExamModule, ExamState, ExamSubmission, ExamTask, ExamUnit } from '@/lib/exam-preparation/types'
const task=(id:string,skill:ExamTask['skill']='reading',type:ExamTask['type']='choice'):ExamTask=>({id,version:1,skill,type,title:id,instruction:'Lies.',correctAnswer:'a',hints:[],profiles:['general_b1'],competency:id,formatFamily:id,estimatedMinutes:1,releaseStatus:'published',provenance:'Eigene Aufgabe'})
const unit=(id:string,kind:ExamUnit['kind'],tasks:ExamTask[]):ExamUnit=>({id,moduleId:'m1',kind,tasks,title:id,description:id,required:true,order:1,estimatedMinutes:1,releaseStatus:'published'})
const empty=():ExamState=>({available:true,profileId:'general_b1',attempts:[],submissions:[],overrides:[],fallbackModules:[],teacher:null})
let receipt=0
const attempt=(t:ExamTask,u:ExamUnit,patch:Partial<ExamAttempt>={}):ExamAttempt=>({id:`attempt-${++receipt}`,taskId:t.id,taskVersion:t.version,unitId:u.id,answer:'a',correct:true,helped:false,feedbackViewed:true,seconds:3,mode:u.kind==='checkpoint'?'checkpoint':'practice',variant:0,createdAt:'2026-10-03T10:00:00Z',...patch})
const submission=(t:ExamTask,patch:Partial<ExamSubmission>={}):ExamSubmission=>({id:`submission-${++receipt}`,taskId:t.id,taskVersion:t.version,unitId:'u-writing',studentId:'student',kind:t.type==='speaking'?'speaking':'writing',text:'Meine eigene Leistung',mediaPath:null,mediaUrl:null,teacherId:'teacher',status:'submitted',previousId:null,reflection:null,createdAt:'2026-10-03T10:00:00Z',feedback:[],...patch})
const checkpoint=(variant:number)=>Array.from({length:10},(_,i)=>task(`check${variant}-${i}`,i<5?'listening':'reading'))
function moduleFixture():ExamModule {
 const units=[unit('listen','listening',[task('listen','listening')]),unit('read','reading',[task('read')]),unit('write','writing',[task('write','writing','writing')]),unit('speak','speaking',[task('speak','speaking','speaking')]),unit('vocab','vocabulary',[task('vocab','vocabulary')]),unit('orientation','orientation',[task('orientation')]),unit('vocab2','vocabulary',[task('vocab2','vocabulary')]),unit('transfer','transfer',[task('transfer')]),unit('optional','reading',[task('optional')]),{...unit('checkpoint','checkpoint',checkpoint(0)),variants:[checkpoint(1),checkpoint(2)]}]
 return {id:'m1',title:'Alltag',description:'Alltag',order:1,units,releaseStatus:'published'}
}
it('counts only an answer followed by viewed feedback; repeats never inflate unique work',()=>{
 const state=empty(),t=task('one'),u=unit('one','reading',[t])
 state.attempts.push(attempt(t,u,{feedbackViewed:false}));expect(getExamUnitProgress(u,state).completed).toBe(false)
 state.attempts[0].feedbackViewed=true
 for(let i=0;i<5;i++)state.attempts.push(attempt(t,u))
 expect(getExamUnitProgress(u,state)).toMatchObject({completedTasks:1,totalTasks:1,completed:true})
})
it('a later success or new content version never converts known work into independent evidence',()=>{
 const state=empty(),t=task('one'),u=unit('one','reading',[t])
 state.attempts=[attempt(t,u,{correct:false}),attempt(t,u,{createdAt:'2026-10-03T11:00:00Z'})]
 expect(isExamTaskIndependent(t,state)).toBe(false)
 expect(isExamTaskCompleted({...t,version:2},state)).toBe(false)
 state.attempts[0].correct=true;state.attempts[0].helped=true;expect(isExamTaskIndependent(t,state)).toBe(false)
})
it('open work requires original plus meaningful revision/reflection after actual feedback',()=>{
 const state=empty(),t=task('write','writing','writing'),original=submission(t)
 state.submissions=[original];expect(isExamTaskCompleted(t,state)).toBe(false)
 const revised=submission(t,{previousId:original.id,reflection:'Ich ergänze den Termin.',createdAt:'2026-10-03T10:20:00Z'});state.submissions.push(revised)
 expect(isExamTaskCompleted(t,state)).toBe(false)
 original.feedback=[{id:'f',text:'Bitte Termin ergänzen',strengths:'Der Anlass ist klar.',priorities:['Termin'],revision:'Ergänze den Termin',rating:'assisted',createdAt:'2026-10-03T10:10:00Z'}]
 expect(isExamTaskCompleted(t,state)).toBe(true);expect(isExamTaskIndependent(t,state)).toBe(false)
 revised.feedback=[{...original.feedback[0],id:'f2',rating:'independent'}];expect(isExamTaskIndependent(t,state)).toBe(true)
})
it('requires eight units, all five evidence areas and a complete fixed 70% check',()=>{
 const courseModule=moduleFixture(),state=empty()
 for(const u of courseModule.units.filter(u=>!['writing','speaking','checkpoint'].includes(u.kind)))state.attempts.push(...u.tasks.map(t=>attempt(t,u)))
 const check=courseModule.units.at(-1)!
 state.attempts.push(...check.tasks.map((t,i)=>attempt(t,check,{correct:i<7})))
 let progress=getExamProgress(state,[courseModule]).modules[0]
 expect(progress.checkpointPercent).toBe(70);expect(progress.unlocksNext).toBe(false);expect(progress.missingEvidence).toEqual(['writing','speaking'])
 for(const u of courseModule.units.filter(u=>['writing','speaking'].includes(u.kind))){const t=u.tasks[0],original=submission(t,{unitId:u.id,feedback:[{id:'f',text:'Gut',strengths:'Verständlich',priorities:[],revision:'Ergänzen',rating:'independent',createdAt:'2026-10-03T10:10:00Z'}]});state.submissions.push(original,submission(t,{unitId:u.id,previousId:original.id,reflection:'Ich habe den Termin ergänzt.',createdAt:'2026-10-03T10:20:00Z'}))}
 progress=getExamProgress(state,[courseModule]).modules[0];expect(progress.unlocksNext).toBe(true);expect(progress.independent).toBe(false)
})
it('rejects mixed variants, helped checks and practice-mode familiarity as independent checks',()=>{
 const courseModule=moduleFixture(),state=empty(),check=courseModule.units.at(-1)!
 state.attempts.push(...check.tasks.map((t,i)=>attempt(t,check,{variant:i<5?0:1})))
 expect(getExamProgress(state,[courseModule]).modules[0].checkpointPercent).toBeNull()
 state.attempts=check.tasks.map(t=>attempt(t,check,{helped:true}));expect(getExamProgress(state,[courseModule]).modules[0].failedVariants).toBe(0)
 state.attempts=check.tasks.flatMap(t=>[attempt(t,check,{mode:'practice'}),attempt(t,check,{createdAt:'2026-10-03T11:00:00Z'})]);expect(getExamProgress(state,[courseModule]).modules[0].checkpointPercent).toBeNull()
})
it('fallback needs two failed independent variants, three new practice tasks and a later transfer',()=>{
 const courseModule=moduleFixture(),state=empty(),check=courseModule.units.at(-1)!
 state.attempts=[...check.tasks.map((t,i)=>attempt(t,check,{correct:i<6})),...check.variants![0].map((t,i)=>attempt(t,check,{correct:i<6,variant:1,createdAt:'2026-10-03T11:00:00Z'}))]
 expect(getExamProgress(state,[courseModule]).modules[0]).toMatchObject({failedVariants:2,canActivateFallback:false})
 const practice=courseModule.units.filter(u=>['listening','reading','vocabulary'].includes(u.kind)).slice(0,3)
 for(const u of practice)state.attempts.push(attempt(u.tasks[0],u,{createdAt:'2026-10-03T12:00:00Z'}))
 const transfer=courseModule.units.find(u=>u.kind==='transfer')!
 state.attempts.push(attempt(transfer.tasks[0],transfer,{createdAt:'2026-10-03T10:30:00Z'}))
 expect(getExamProgress(state,[courseModule]).modules[0].canActivateFallback).toBe(false)
 state.attempts.push(attempt(transfer.tasks[0],transfer,{createdAt:'2026-10-03T12:01:00Z'}))
 expect(getExamProgress(state,[courseModule]).modules[0].canActivateFallback).toBe(false) // a familiar transfer cannot become new again
 state.attempts=state.attempts.filter(a=>a.taskId!==transfer.tasks[0].id)
 state.attempts.push(attempt(transfer.tasks[0],transfer,{createdAt:'2026-10-03T12:01:00Z'}))
 expect(getExamProgress(state,[courseModule]).modules[0]).toMatchObject({canActivateFallback:true,unlocksNext:false})
 state.fallbackModules.push(courseModule.id);expect(getExamProgress(state,[courseModule]).modules[0]).toMatchObject({unlocksNext:true,independent:false,repeatNeeded:true})
})
it('a reasoned override unlocks only the selected courseModule, without claiming independent mastery',()=>{
 const m1=moduleFixture(),m2={...moduleFixture(),id:'m2',order:2},state=empty()
 expect(getExamProgress(state,[m1,m2]).modules[1].available).toBe(false)
 state.overrides.push({moduleId:'m2',reason:'Prüfungstermin in zwei Wochen'});expect(getExamProgress(state,[m1,m2]).modules[1]).toMatchObject({available:true,independent:false})
})
it('offers fresh fallback transfer after every normal transfer was already consumed',()=>{
 const training=moduleFixture(),state=empty(),check=training.units.at(-1)!
 const practice=unit('fallback-practice','vocabulary',[task('new-practice-1'),task('new-practice-2'),task('new-practice-3')])
 const transfer=unit('fallback-transfer','transfer',[task('new-transfer')])
 training.fallbackUnits=[practice,transfer]
 for(const u of training.units.filter(u=>u.kind!=='checkpoint'))for(const t of u.tasks.filter(t=>!['writing','speaking'].includes(t.type)))state.attempts.push(attempt(t,u))
 state.attempts.push(...check.tasks.map(t=>attempt(t,check,{correct:false,createdAt:'2026-10-03T11:00:00Z'})),...check.variants![0].map(t=>attempt(t,check,{correct:false,variant:1,createdAt:'2026-10-03T12:00:00Z'})))
 expect(getExamProgress(state,[training]).modules[0].canActivateFallback).toBe(false)
 state.attempts.push(...practice.tasks.map(t=>attempt(t,practice,{createdAt:'2026-10-03T13:00:00Z'})),attempt(transfer.tasks[0],transfer,{createdAt:'2026-10-03T13:01:00Z'}))
 expect(getExamProgress(state,[training]).modules[0]).toMatchObject({canActivateFallback:true,failedVariants:2,totalUnits:10})
})
