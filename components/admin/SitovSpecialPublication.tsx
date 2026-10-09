'use client'
import {useEffect,useId,useMemo,useRef,useState} from 'react'
import {z} from 'zod'
import {getSitovLearningSpecialPublication,publishSitovLearningSpecial} from '@/app/actions/sitov-learning-specials'
import {sitovSpecialPublicationStateInputSchema,sitovSpecialPublicationInputSchema,sitovSpecialPublicationStateResultSchema,sitovSpecialPublicationResultSchema} from '@/lib/learning/sitov-learning-specials-staff-contract'
import {sitovSpecialStaffCopy} from '@/lib/learning/sitov-learning-specials-staff-i18n'
import PressableCard from '@/components/motion/PressableCard'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
import SitovTrainerHelp from '@/components/motion/SitovTrainerHelp'
import { sitovTrainerHelpCopy } from '@/lib/sitov-trainer-help-copy'
import styles from './SitovLearningSpecialStaff.module.css'
type Ack=Extract<z.infer<typeof sitovSpecialPublicationResultSchema>,{ok:true}>['data']
interface Props{accountKey:string;nodeId:string;definition?:{id:string;version:string;published:boolean};sourceSha256:string;latestDefinitionId:string|null;baseActiveDefinitionId:string|null;lang:string;disabled?:boolean;onPublished:(ack:Ack)=>void;onReload:()=>void}
type State='loading'|'ready'|'missing'|'readFailed'|'pending'|'uncertain'|'conflict'|'unavailable'|'published'
export default function SitovSpecialPublication(props:Props){return <PublicationScope key={`${props.accountKey}:${props.lang}:${props.nodeId}:${props.definition?.id}:${props.definition?.version}:${props.definition?.published}:${props.sourceSha256}:${props.latestDefinitionId}:${props.baseActiveDefinitionId}`} {...props}/>}
function PublicationScope({nodeId,definition,sourceSha256,latestDefinitionId,baseActiveDefinitionId,lang,disabled=false,onPublished,onReload}:Props){
 const copy=sitovSpecialStaffCopy(lang),id=useId(),reason=!definition?'choose':definition.published?'active':definition.id!==latestDefinitionId?'notLatest':null
 const input=useMemo(()=>sitovSpecialPublicationStateInputSchema.safeParse({nodeId,definitionId:definition?.id,definitionVersion:definition?.version,sourceSha256,baseActiveDefinitionId}),[nodeId,definition?.id,definition?.version,sourceSha256,baseActiveDefinitionId])
 const [state,setState]=useState<State>('loading'),[readVersion,setReadVersion]=useState(0)
 const live=useRef(true),pending=useRef(false),request=useRef<z.infer<typeof sitovSpecialPublicationInputSchema>|null>(null),status=useRef<HTMLParagraphElement>(null)
 useEffect(()=>{live.current=true;return()=>{live.current=false}},[])
 useEffect(()=>{
  if(reason||!input.success)return
  let retired=false
  setState('loading')
  async function read(){try{
   const parsed=sitovSpecialPublicationStateResultSchema.safeParse(await getSitovLearningSpecialPublication(input.data))
   if(retired||!live.current)return
   if(!parsed.success){setState('readFailed');return}
   const result=parsed.data
   if(result.ok===false){setState(result.error==='authoring_not_ready'?'missing':result.error==='version_conflict'||result.error==='request_conflict'?'conflict':result.retryable?'readFailed':'unavailable');return}
   const d=result.data
   if(d.nodeId!==input.data.nodeId||d.definitionId!==input.data.definitionId||d.definitionVersion!==input.data.definitionVersion||d.sourceSha256!==input.data.sourceSha256||d.activeDefinitionId!==input.data.baseActiveDefinitionId){setState('readFailed');return}
   setState(d.ready?'ready':'missing')
  }catch{if(!retired&&live.current)setState('readFailed')}}
  void read();return()=>{retired=true}
 },[reason,input,readVersion])
 useEffect(()=>{if(['uncertain','conflict','unavailable','published'].includes(state))status.current?.focus({preventScroll:true})},[state])
 async function publish(){
  if(disabled||pending.current||reason||!input.success||(state!=='ready'&&state!=='uncertain'))return
  if(!request.current){if(state!=='ready')return;try{request.current={...input.data,requestId:crypto.randomUUID()}}catch{setState('unavailable');return}}
  const payload=request.current;pending.current=true;setState('pending')
  try{
   const parsed=sitovSpecialPublicationResultSchema.safeParse(await publishSitovLearningSpecial(payload))
   if(!live.current)return
   if(!parsed.success){setState('uncertain');return}
   const result=parsed.data
   if(result.ok===false){setState(result.retryable?'uncertain':result.error==='authoring_not_ready'?'missing':result.error==='version_conflict'||result.error==='request_conflict'?'conflict':'unavailable');return}
   const ack=result.data
   if(ack.nodeId!==payload.nodeId||ack.definitionId!==payload.definitionId||ack.definitionVersion!==payload.definitionVersion||ack.sourceSha256!==payload.sourceSha256){setState('uncertain');return}
   setState('published');onPublished(ack)
  }catch{if(live.current)setState('uncertain')}finally{pending.current=false}
 }
 return <SitovMotionStage className={styles.panel} lang={lang} aria-labelledby={`${id}-title`} aria-busy={state==='pending'}>
  <h3 id={`${id}-title`}>{copy.publicationTitle}</h3>
  <p ref={status} tabIndex={-1} role={['uncertain','conflict','unavailable','readFailed'].includes(state)&&!reason?'alert':'status'}>{reason?copy[reason]:!input.success?copy.unavailable:state==='published'?copy.confirming:copy[state]}</p>
  <div className={styles.actions}>
   <PressableCard className={styles.button} disabled={disabled||!!reason||!input.success||state!=='ready'} onClick={()=>void publish()}>{state==='pending'?copy.pending:copy.publish}</PressableCard>
   {!reason&&state==='uncertain'&&<PressableCard className={styles.button} disabled={disabled} onClick={()=>void publish()}>{copy.retry}</PressableCard>}
   {!reason&&['readFailed','missing'].includes(state)&&<PressableCard className={styles.button} disabled={disabled} onClick={()=>setReadVersion(v=>v+1)}>{copy.check}</PressableCard>}
   {!reason&&['conflict','unavailable'].includes(state)&&<PressableCard className={styles.button} disabled={disabled} onClick={onReload}>{copy.reload}</PressableCard>}
  </div><SitovTrainerHelp title={sitovTrainerHelpCopy(lang).label}><h3>{copy.help}</h3><p>{copy.helpBody}</p></SitovTrainerHelp>
 </SitovMotionStage>
}
