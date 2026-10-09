'use client'
import {useEffect,useId,useRef,useState} from 'react'
import {useRouter} from 'next/navigation'
import {z} from 'zod'
import {getSitovLearningSpecialStaff} from '@/app/actions/sitov-learning-specials'
import {sitovSpecialStaffInputSchema,sitovSpecialStaffResultSchema,sitovSpecialPublicationResultSchema} from '@/lib/learning/sitov-learning-specials-staff-contract'
import {sitovSpecialStaffCopy} from '@/lib/learning/sitov-learning-specials-staff-i18n'
import SitovSpecialPublication from './SitovSpecialPublication'
import PressableCard from '@/components/motion/PressableCard'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
import styles from './SitovLearningSpecialStaff.module.css'
type Catalog=Extract<z.infer<typeof sitovSpecialStaffResultSchema>,{ok:true}>['data']
type Ack=Extract<z.infer<typeof sitovSpecialPublicationResultSchema>,{ok:true}>['data']
/** Mount only from a current staff-authorized target chooser. No target index or public seed is guessed here. */
export interface SitovLearningSpecialStaffProps{accountKey:string;nodeId:string;title:string;sourceSha256:string;baseActiveDefinitionId:string|null;lang:string}
export default function SitovLearningSpecialStaff(props:SitovLearningSpecialStaffProps){return <StaffScope key={`${props.accountKey}:${props.lang}:${props.nodeId}:${props.sourceSha256}:${props.baseActiveDefinitionId}`} {...props}/>}
function StaffScope(props:SitovLearningSpecialStaffProps){
 const copy=sitovSpecialStaffCopy(props.lang),id=useId(),router=useRouter()
 const [catalog,setCatalog]=useState<Catalog|null>(null),[selection,setSelection]=useState<string|null>(null),[status,setStatus]=useState<'loading'|'error'|'saved'|null>('loading')
 const live=useRef(true),sequence=useRef(0),busy=useRef(false),message=useRef<HTMLParagraphElement>(null)
 useEffect(()=>{live.current=true;const sequenceRef=sequence,busyRef=busy;return()=>{live.current=false;sequenceRef.current++;busyRef.current=false}},[])
 async function reload(ack?:Ack){
  if(busy.current)return
  busy.current=true;const current=++sequence.current;setStatus('loading')
  try{
   if(!sitovSpecialStaffInputSchema.safeParse({nodeId:props.nodeId}).success)throw new Error('invalid_target')
   const parsed=sitovSpecialStaffResultSchema.safeParse(await getSitovLearningSpecialStaff({nodeId:props.nodeId}))
   if(!live.current||current!==sequence.current)return
   if(!parsed.success||parsed.data.ok===false||parsed.data.data.definitions.some(d=>d.node_id!==props.nodeId||!Number.isFinite(Date.parse(d.created_at))))throw new Error('invalid_catalog')
   const value=parsed.data.data
   value.definitions.sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)||a.id.localeCompare(b.id))
   if(ack&&!value.definitions.some(d=>d.id===ack.definitionId&&d.node_id===ack.nodeId&&d.version===ack.definitionVersion&&d.published&&d.editorial_proof?.sourceSha256===ack.sourceSha256))throw new Error('publication_not_confirmed')
   setCatalog(value);setSelection(old=>old&&value.definitions.some(d=>d.id===old)?old:value.definitions.at(-1)?.id??null);setStatus(ack?'saved':null)
   if(ack)router.refresh()
  }catch{if(live.current&&current===sequence.current){setCatalog(null);setStatus('error')}}finally{if(current===sequence.current)busy.current=false}
 }
 // Scope remount retires old account/node/locale/catalog replies.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 useEffect(()=>{void reload()},[])
 useEffect(()=>{if(status==='error'||status==='saved')message.current?.focus({preventScroll:true})},[status])
 const definition=catalog?.definitions.find(d=>d.id===selection),latest=catalog?.definitions.at(-1)?.id??null
 return <SitovMotionStage className={styles.panel} lang={props.lang} aria-labelledby={`${id}-title`} aria-busy={status==='loading'}>
  <h2 id={`${id}-title`}>{copy.title}</h2><h3 lang="de" translate="no">{props.title}</h3>
  {status&&<p ref={message} tabIndex={-1} role={status==='error'?'alert':'status'}>{copy[status]}</p>}
  {catalog&&<>
   {!catalog.definitions.length?<p>{copy.empty}</p>:<label className={styles.label}>{copy.versions}<select className={styles.select} value={selection??''} disabled={status==='loading'} onChange={e=>setSelection(e.target.value)}>{catalog.definitions.map((d,n)=><option key={d.id} value={d.id}>{copy.version.replace('{number}',String(n+1))} · {d.published?(d.id===props.baseActiveDefinitionId?copy.published:copy.archived):copy.draft}</option>)}</select></label>}
   {definition&&<>
    <p>{copy.tasks}: {definition.pool.length}</p>
    <details className={styles.preview}><summary>{copy.preview}</summary><ol>{definition.pool.map(item=>{
     const c=item.snapshot.content as Record<string,unknown>
     return <li key={item.id}><div lang="de" translate="no"><p>{typeof c.instruction==='string'?c.instruction:null}</p><p>{typeof c.question==='string'?c.question:item.snapshot.type==='fill_in_blank'?`${c.text_before??''} ___ ${c.text_after??''}`:Array.isArray(c.parts)?c.parts.join(' · '):null}</p>{Array.isArray(c.options)&&<p>{c.options.join(' · ')}</p>}</div><p>{copy.solution}: <span lang="de" translate="no">{typeof c.correct_answer==='string'?c.correct_answer:null}</span></p>{item.snapshot.translations.de?.explanation&&<p lang="de" translate="no">{item.snapshot.translations.de.explanation}</p>}</li>
    })}</ol></details>
   </>}
   <SitovSpecialPublication accountKey={props.accountKey} nodeId={props.nodeId} definition={definition?{id:definition.id,version:definition.version,published:definition.published}:undefined} latestDefinitionId={latest} sourceSha256={props.sourceSha256} baseActiveDefinitionId={props.baseActiveDefinitionId} lang={props.lang} disabled={status==='loading'} onPublished={ack=>{void reload(ack)}} onReload={()=>{void reload();router.refresh()}}/>
   <section aria-labelledby={`${id}-history`}><h3 id={`${id}-history`}>{copy.history}</h3>{!catalog.runs.length?<p>{copy.noHistory}</p>:<ol className={styles.history}>{catalog.runs.map(run=><li key={run.id}><span>{run.mode==='learning'?copy.learning:copy.test} · {run.status==='completed'?copy.completed:copy.inProgress}</span>{run.result&&<span>{run.result.correct}/{run.result.total} · {run.result.passed?copy.passed:copy.failed}</span>}</li>)}</ol>}</section>
  </>}
  {status==='error'&&<PressableCard className={styles.button} onClick={()=>void reload()}>{copy.reload}</PressableCard>}
 </SitovMotionStage>
}
