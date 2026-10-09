'use client'
import {useEffect,useId,useRef,useState} from 'react'
import {getSitovLearningSpecialStaffTargets} from '@/app/actions/sitov-learning-specials'
import {sitovSpecialStaffTargetsResultSchema,type SitovSpecialStaffTargetsResult} from '@/lib/learning/sitov-learning-specials-staff-contract'
import {sitovSpecialStaffTargetsCopy} from '@/lib/learning/sitov-learning-specials-staff-i18n'
import SitovLearningSpecialStaff from './SitovLearningSpecialStaff'
import PressableCard from '@/components/motion/PressableCard'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
import SitovTrainerHelp from '@/components/motion/SitovTrainerHelp'
import styles from './SitovLearningSpecialStaffTargets.module.css'
interface Props{accountKey:string;lang:string;initial:SitovSpecialStaffTargetsResult}
const unavailable:SitovSpecialStaffTargetsResult={ok:false,error:'not_found',retryable:false}
function validated(value:unknown){const p=sitovSpecialStaffTargetsResultSchema.safeParse(value);return p.success?p.data:unavailable}
export default function SitovLearningSpecialStaffTargets(props:Props){return <TargetsHost key={`${props.accountKey}:${props.lang}`} {...props}/>}
function TargetsHost(props:Props){
 const [preferred,setPreferred]=useState<string|null>(null)
 // A server refresh retires pending index replies and refreshes the actual activation/source base.
 return <TargetPicker key={JSON.stringify(props.initial)} {...props} preferred={preferred} onSelect={setPreferred}/>
}
function TargetPicker({accountKey,lang,initial,preferred,onSelect}:Props&{preferred:string|null;onSelect:(id:string|null)=>void}){
 const copy=sitovSpecialStaffTargetsCopy(lang),id=useId()
 const [result,setResult]=useState(()=>validated(initial)),[level,setLevel]=useState(''),[selected,setSelected]=useState<string|null>(preferred),[pending,setPending]=useState(false)
 const [levels,setLevels]=useState(()=>{const seed=validated(initial);return seed.ok?[...new Set(seed.data.map(t=>t.level))]:[]})
 const live=useRef(true),sequence=useRef(0),busy=useRef(false),message=useRef<HTMLParagraphElement>(null)
 useEffect(()=>{live.current=true;const seq=sequence,guard=busy;return()=>{live.current=false;seq.current++;guard.current=false}},[])
 useEffect(()=>{if(!result.ok&&!pending)message.current?.focus({preventScroll:true})},[result,pending])
 async function reload(nextLevel=level){
  if(busy.current)return
  busy.current=true;const request=++sequence.current;setPending(true);setLevel(nextLevel)
  try{
   const next=validated(await getSitovLearningSpecialStaffTargets({level:nextLevel||null}))
   if(!live.current||request!==sequence.current)return
   if(next.ok&&nextLevel&&next.data.some(t=>t.level!==nextLevel))throw new Error('foreign_level')
   setResult(next)
   if(next.ok){setLevels(old=>[...new Set([...old,...next.data.map(t=>t.level)])]);setSelected(old=>next.data.some(t=>t.nodeId===old)?old:null)}
   else setSelected(null)
  }catch{if(live.current&&request===sequence.current){setResult(unavailable);setSelected(null)}}
  finally{if(live.current&&request===sequence.current){busy.current=false;setPending(false)}}
 }
 const targets=result.ok?result.data:[],target=!pending?targets.find(t=>t.nodeId===selected):undefined
 return <div className={styles.root} lang={lang}>
  <SitovMotionStage className={styles.panel} aria-labelledby={`${id}-title`} aria-busy={pending}>
   <h1 id={`${id}-title`}>{copy.title}</h1><p>{copy.intro}</p>
   <SitovTrainerHelp title={copy.targetsHelp}><p>{copy.targetsHelpBody}</p></SitovTrainerHelp>
   <div className={styles.toolbar}><label className={styles.label}>{copy.level}<select className={styles.select} value={level} disabled={pending} onChange={e=>void reload(e.target.value)}><option value="">{copy.allLevels}</option>{levels.map(l=><option key={l} value={l}>{l}</option>)}</select></label><PressableCard className={styles.button} disabled={pending} onClick={()=>void reload()}>{copy.reload}</PressableCard></div>
   {pending?<p role="status">{copy.targetsLoading}</p>:result.ok===false?<p ref={message} role="alert" tabIndex={-1}>{result.error==='invalid_input'?copy.targetsError:copy.targetsDenied}</p>:!targets.length?<p role="status">{copy.targetsEmpty}</p>:<fieldset className={styles.fieldset}><legend>{copy.selectTarget}</legend><div className={styles.targets}>{targets.map(t=><PressableCard key={t.nodeId} className={styles.target} aria-pressed={selected===t.nodeId} onClick={()=>{setSelected(t.nodeId);onSelect(t.nodeId)}}><span lang="de" translate="no">{t.title}</span><span className={styles.level}>{t.level}</span></PressableCard>)}</div></fieldset>}
  </SitovMotionStage>
  {target&&<SitovLearningSpecialStaff accountKey={accountKey} nodeId={target.nodeId} title={target.title} sourceSha256={target.sourceSha256} baseActiveDefinitionId={target.activeDefinitionId} lang={lang}/>}
 </div>
}
