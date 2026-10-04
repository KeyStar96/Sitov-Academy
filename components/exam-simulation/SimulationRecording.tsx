'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { CheckCircle2, Mic, Square, Upload, X } from 'lucide-react'
import { createSimulationUpload } from '@/app/actions/exam-simulation'
import { createClient } from '@/utils/supabase/client'
import { useAudioRecorder } from '@/lib/audio/useAudioRecorder'
import LiveWaveform from '@/components/audio/LiveWaveform'
import PressableCard from '@/components/motion/PressableCard'
import { sitovSimulationCopy, sitovSimulationError } from '@/lib/exam-simulation/ui-copy'
import type { SimulationAnswer } from '@/lib/exam-simulation/types'
import styles from './ExamSimulation.module.css'

const allowed=['audio/mpeg','audio/mp4','audio/x-m4a','audio/webm','audio/wav','audio/x-wav','audio/ogg']
export default function SimulationRecording({runId,taskId,value,preview,disabled,onChange,onBusy,lang='de'}: {
  lang?:string;runId:string;taskId:string;value:SimulationAnswer;preview:boolean;disabled:boolean;onChange:(value:SimulationAnswer)=>void;onBusy:(busy:boolean)=>void
}) {
  const copy=sitovSimulationCopy(lang)
  const recorder=useAudioRecorder({wavSampleRate:24000,maxWavBytes:20*1024*1024})
  const [file,setFile]=useState<File|null>(null)
  const [fileUrl,setFileUrl]=useState<string|null>(null)
  const [error,setError]=useState('')
  const [pending,startTransition]=useTransition()
  const uploaded=useRef<{blob:Blob;path:string}|null>(null)
  const saved=typeof value==='object'&&!Array.isArray(value)?value:null
  const blob=file??recorder.audioBlob
  const replacementPending=!!blob&&uploaded.current?.blob!==blob
  useEffect(()=>{onBusy(pending||recorder.isRecording||recorder.status==='requesting'||replacementPending);return ()=>onBusy(false)},[pending,recorder.isRecording,recorder.status,replacementPending,onBusy])
  useEffect(()=>{if(!file){setFileUrl(null);return}const url=URL.createObjectURL(file);setFileUrl(url);return ()=>URL.revokeObjectURL(url)},[file])
  useEffect(()=>{if(recorder.isRecording&&(recorder.elapsedSeconds>=300||disabled))recorder.stop()},[recorder,disabled])
  const choose=(selected?:File)=>{
    if(!selected)return
    if(!selected.size||selected.size>20*1024*1024||!allowed.includes(selected.type.split(';')[0])){setError(copy.t('errorFile'));return}
    setFile(selected);setError('');uploaded.current=null
  }
  const save=()=>startTransition(async()=>{
    if(!blob)return
    setError('')
    try {
      let path=uploaded.current?.blob===blob?uploaded.current.path:null
      if(!path){
        const mime=blob.type.split(';')[0]
        const ticket=await createSimulationUpload({runId,taskId,mimeType:mime,bytes:blob.size})
        if(!ticket.success||!ticket.path||!ticket.token||!ticket.bucket){setError(sitovSimulationError(lang,ticket.error,'errorRecordingPrepare'));return}
        const result=await createClient().storage.from(ticket.bucket).uploadToSignedUrl(ticket.path,ticket.token,blob,{contentType:mime,upsert:false})
        if(result.error)throw new Error('upload')
        path=ticket.path;uploaded.current={blob,path}
      }
      onChange({text:saved?.text??'',audioPath:path})
    }catch{setError(copy.t('errorRecordingUpload'))}
  })
  const micError=recorder.status==='denied'?copy.t('micDenied'):recorder.status==='unsupported'?copy.t('micUnsupported'):recorder.status==='failed'?copy.t('micFailed'):null
  const source=file?fileUrl:recorder.audioUrl??saved?.audioUrl??null
  return <div className={styles.recording} lang={copy.lang}>
    {!preview&&<p className={styles.muted}>{copy.t('recordingHint')}</p>}
    {preview ? <p className={styles.note}>{copy.t('recordingPreview')}</p> : <>
      <div className={styles.recorderActions}>{recorder.isRecording ? <PressableCard className={styles.primary} onClick={recorder.stop}><Square size={20} aria-hidden="true"/>{copy.t('stopRecording',{count:recorder.elapsedSeconds})}</PressableCard> : <PressableCard className={styles.secondary} disabled={disabled||pending||recorder.status==='requesting'} onClick={async()=>{setFile(null);setError('');uploaded.current=null;await recorder.start()}}><Mic size={20} aria-hidden="true"/>{recorder.status==='requesting'?copy.t('openingMic'):recorder.hasRecording||saved?.audioPath?copy.t('recordAgain'):copy.t('record')}</PressableCard>}</div>
      {recorder.isRecording&&<LiveWaveform levels={recorder.levels} isActive elapsedSeconds={recorder.elapsedSeconds} ariaLabel={copy.t('volume')} analyserRef={recorder.analyserRef}/>}
      {source&&<audio className={styles.audio} src={source} controls aria-label={copy.t('playRecording')}/>}
      {blob&&uploaded.current?.blob!==blob&&<PressableCard className={styles.primary} disabled={disabled||pending||recorder.isRecording} onClick={save}><Upload size={20} aria-hidden="true"/>{pending?copy.t('uploading'):copy.t('useRecording')}</PressableCard>}
      {replacementPending&&!recorder.isRecording&&<PressableCard className={styles.link} disabled={disabled||pending} onClick={()=>{setFile(null);recorder.reset();uploaded.current=null;setError('')}}><X size={18} aria-hidden="true"/>{copy.t('discardRecording')}</PressableCard>}
      {saved?.audioPath&&!replacementPending&&<p className={styles.row} role="status"><CheckCircle2 size={20} aria-hidden="true"/>{copy.t('recordingChosen')}</p>}
      <details className={styles.details}><summary>{copy.t('uploadExisting')}</summary><label className={styles.label}>{copy.t('audioFile')}<input type="file" className={styles.input} accept={allowed.join(',')} disabled={disabled||pending||recorder.isRecording} onChange={event=>choose(event.target.files?.[0])}/></label>{file&&<p className={styles.muted}>{file.name}</p>}</details>
    </>}
    {micError&&<p className={styles.note} role="status">{micError}</p>}{error&&<p className={styles.error} role="alert">{error}</p>}
    <details className={styles.details}><summary>{copy.t('notesSummary')}</summary><label className={styles.label}>{copy.t('notes')}<textarea lang="de" translate="no" className={styles.textarea} maxLength={12000} disabled={disabled||pending} value={saved?.text??(typeof value==='string'?value:'')} onChange={event=>onChange({text:event.target.value,...(saved?.audioPath?{audioPath:saved.audioPath,audioUrl:saved.audioUrl}:{})})}/></label><p className={styles.muted}>{copy.t('recordingRequired')}</p></details>
  </div>
}
