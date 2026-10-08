'use client'
import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { MOTION, EASE_OUT_SOFT, useReducedMotionSafe } from '@/lib/motion'
import { pathTranslator } from '@/lib/learning-path-i18n'
import type { PathAnswer, PathExercise } from '@/lib/learning-path-contract'
import { sitovSpecialInputSchema, sitovSpecialResultSchema, type SitovSpecialResult } from '@/lib/learning/sitov-learning-specials-contract'
import { sitovSpecialCopy, sitovSpecialErrorCopy } from '@/lib/learning/sitov-learning-specials-i18n'
import SitovTrainerHelp from '@/components/motion/SitovTrainerHelp'
import PressableCard from '@/components/motion/PressableCard'
import FeedbackMotion from '@/components/motion/FeedbackMotion'
import PathExerciseForm from './PathExerciseForm'
import styles from './SitovLearningSpecial.module.css'

type Input=z.infer<typeof sitovSpecialInputSchema>
type Run=Extract<SitovSpecialResult,{ok:true}>['data']
type Action=(input:unknown)=>Promise<SitovSpecialResult>
const realAction:Action=async input=>{const {runSitovLearningSpecial}=await import('@/app/actions/sitov-learning-specials');return runSitovLearningSpecial(input)}
function solutionText(content:Record<string,unknown>){return typeof content.correct_answer==='string'?content.correct_answer:Array.isArray(content.correct_answer)?content.correct_answer.filter(v=>typeof v==='string').join(' '):''}
function answerText(task:PathExercise|undefined,answer:PathAnswer|undefined){if(!task||!answer)return '';return 'text' in answer?answer.text:'index' in answer&&task.type==='multiple_choice'?task.content.options[answer.index]??'':'indices' in answer&&task.type==='sentence_building'?answer.indices.map(i=>task.content.parts[i]).join(' '):''}
function Prompt({task}:{task:PathExercise}){return <div lang="de" translate="no">{task.content.instruction&&<p>{task.content.instruction}</p>}{task.type==='multiple_choice'?<p>{task.content.question}</p>:task.type==='fill_in_blank'?<p>{task.content.text_before} … {task.content.text_after}</p>:<p>{task.content.parts.join(' · ')}</p>}</div>}

/** Account/node/locale changes remount and discard any in-flight response. */
export default function SitovLearningSpecial(props:{nodeId:string;title:string;lang:string;accountKey?:string;onClose:()=>void;action?:Action}){
 return <SpecialSession key={`${props.accountKey}/${props.nodeId}/${props.lang}`} {...props}/>
}
function SpecialSession({nodeId,title,lang,accountKey,onClose,action=realAction}:{nodeId:string;title:string;lang:string;accountKey?:string;onClose:()=>void;action?:Action}){
 const reduced=useReducedMotionSafe()
 const c=sitovSpecialCopy(lang),[run,setRun]=useState<Run|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[retry,setRetry]=useState<Input|null>(null)
 const mounted=useRef(true),busyRef=useRef(false),pending=useRef<Input|null>(null),focus=useRef<HTMLDivElement>(null)
 useEffect(()=>{mounted.current=true;focus.current?.focus();return()=>{mounted.current=false}},[])
 async function send(input:Input){
  if(busyRef.current||!accountKey)return
  busyRef.current=true;setBusy(true);setError(null);pending.current=input
  try{
   const raw=await action(input);if(!mounted.current)return
   const parsed=sitovSpecialResultSchema.safeParse(raw)
   const result=parsed.success?parsed.data:{ok:false as const,error:'retryable_failure' as const,retryable:true}
   if(result.ok===false){setError(result.error);setRetry(result.retryable?input:null);if(!result.retryable)pending.current=null;return}
   if(result.data.nodeId!==nodeId||(input.runId&&result.data.runId!==input.runId)||(input.mode&&result.data.mode!==input.mode)||(run&&input.operation!=='start'&&result.data.definitionVersion!==run.definitionVersion)){
    setError('version_conflict');setRetry(null);pending.current=null;return
   }
   setRun(result.data);setRetry(null);pending.current=null
  }catch{if(mounted.current){setError('retryable_failure');setRetry(input)}}
  finally{busyRef.current=false;if(mounted.current)setBusy(false)}
 }
 function start(mode:'learning'|'test'){if(pending.current)return;void send({operation:'start',nodeId,mode,requestId:crypto.randomUUID(),locale:lang as Input['locale']})}
 function mutate(operation:'reveal'|'right'|'wrong'|'save'|'submit',answers?:Record<string,PathAnswer>){if(!run||pending.current)return;void send({operation,runId:run.runId,revision:run.revision,requestId:crypto.randomUUID(),locale:lang as Input['locale'],...(answers?{answers}:{})})}
 const task=run?.tasks.find(task=>task.id===(run.mode==='learning'?run.queue[0]:run.selected.find(id=>!run.answers[id])))
 const locked=busy||Boolean(retry)||Boolean(error&&['version_conflict','not_found','authentication_required','revision_conflict','attempt_completed','request_conflict'].includes(error))
 return <section className={styles.root} lang={lang} aria-busy={busy}>
  <button type="button" className={styles.button} onClick={onClose}>{c.back}</button>
  <div ref={focus} tabIndex={-1} className={styles.stage}>
   <h2 lang="de" translate="no">{title}</h2>
   {!accountKey&&<p role="alert">{c.auth}</p>}
   {error&&<div role="alert"><p>{sitovSpecialErrorCopy(lang,error)}</p>
    {retry?<button className={styles.button} disabled={busy} onClick={()=>void send(retry)}>{c.retry}</button>:run&&<button className={styles.button} disabled={busy} onClick={()=>void send({operation:'get',runId:run.runId,locale:lang as Input['locale']})}>{c.reload}</button>}
   </div>}
   {busy&&<p role="status">{c.loading}</p>}
   {!run?<div className={styles.actions}>
    <PressableCard className={styles.button} disabled={busy||Boolean(retry)||!accountKey} onClick={()=>start('learning')}>{c.learning}</PressableCard>
    <PressableCard className={styles.button} disabled={busy||Boolean(retry)||!accountKey} onClick={()=>start('test')}>{c.test}</PressableCard>
   </div>:run.mode==='learning'?<>
    {run.status==='completed'?<FeedbackMotion correct><p role="status">{c.done}</p></FeedbackMotion>:<>
     <p>{run.queue.length} {c.remaining}</p><p>{c.learnHint}</p>{task&&<motion.div className={styles.prompt} key={task.id} initial={reduced?false:{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:reduced?0:MOTION.base,ease:EASE_OUT_SOFT}}><Prompt task={task}/></motion.div>}
     <div className={styles.solution}>{run.learningSolution?<motion.div initial={reduced?false:{opacity:0,rotateX:-12}} animate={{opacity:1,rotateX:0}} transition={{duration:reduced?0:MOTION.base,ease:EASE_OUT_SOFT}}><p>{c.solution}: <span lang="de" translate="no">{solutionText(run.learningSolution.content)}</span></p>{run.learningSolution.explanation&&<p lang={lang}>{run.learningSolution.explanation}</p>}</motion.div>:null}</div>
     <div className={styles.actions}>{run.revealed?<><PressableCard className={styles.button} disabled={locked} onClick={()=>mutate('right')}>{c.right}</PressableCard><PressableCard className={styles.button} disabled={locked} onClick={()=>mutate('wrong')}>{c.wrong}</PressableCard></>:<PressableCard className={styles.button} disabled={locked} onClick={()=>mutate('reveal')}>{c.reveal}</PressableCard>}</div>
    </>}
   </>:run.result?<>
    <FeedbackMotion correct={run.result.passed}><p role="status">{run.result.passed?c.passed:c.failed} · {run.result.correct}/10 {c.score}</p></FeedbackMotion>
    <ul>{run.result.feedback.map(item=><li key={item.itemId}><p>{item.correct?c.right:c.wrong}</p><div lang="de" translate="no">{run.tasks.find(t=>t.id===item.itemId)&&<Prompt task={run.tasks.find(t=>t.id===item.itemId)!}/>}<p><span lang={lang} translate="yes">{pathTranslator(lang)('review_your_answer')}: </span>{answerText(run.tasks.find(t=>t.id===item.itemId),run.answers[item.itemId])}</p><p><span lang={lang} translate="yes">{c.solution}: </span>{solutionText(item.solution)}</p></div>{item.explanation&&<p lang={lang}>{item.explanation}</p>}</li>)}</ul>
    <PressableCard className={styles.button} disabled={locked} onClick={()=>start('test')}>{c.again}</PressableCard>
   </>:<>
    <p>{c.testHint}</p><p>{Object.keys(run.answers).length}/10 {c.saved}</p>
    {task?<PathExerciseForm key={task.id} exercise={task} lang={lang} busy={locked} isTest onSubmit={answer=>mutate('save',{[task.id]:answer})}/>:<PressableCard className={styles.button} disabled={locked} onClick={()=>mutate('submit',run.answers)}>{c.submit}</PressableCard>}
   </>}
  </div>
  <SitovTrainerHelp title={c.help}><p>{c.detail}</p></SitovTrainerHelp>
 </section>
}
