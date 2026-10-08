'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSitovLearningRecommendations } from '@/app/actions/sitov-learning-recommendations'
import { sitovLearningRecommendationsResultSchema, type SitovLearningRecommendationsResult } from '@/lib/learning/sitov-learning-recommendations-contract'
import { sitovLearningRecommendationsCopy } from '@/lib/learning/sitov-learning-recommendations-copy'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
import SitovTrainerHelp from '@/components/motion/SitovTrainerHelp'
import styles from './SitovLearningRecommendations.module.css'

/** Optional read-only recommendations; stale responses never become visible links. */
export default function SitovLearningRecommendations({ topicIds, lang, accountKey }: { topicIds: string[]; lang: string; accountKey: string }) {
 const key = JSON.stringify({ topicIds, lang, accountKey })
 const [loaded, setLoaded] = useState<{ key: string; result: SitovLearningRecommendationsResult } | null>(null)
 const [retry, setRetry] = useState(0)
 const copy = sitovLearningRecommendationsCopy(lang)
 useEffect(() => {
  const input = JSON.parse(key) as { topicIds: string[]; lang: string }
  if (!input.topicIds.length) return
  let current = true
  void getSitovLearningRecommendations({ topicIds: input.topicIds, locale: input.lang, limit: 3 }).then(raw => {
   const parsed = sitovLearningRecommendationsResultSchema.safeParse(raw)
   if (current) setLoaded({ key, result: parsed.success ? parsed.data : { ok:false,error:'retryable_failure',retryable:true } })
  }).catch(() => { if (current) setLoaded({ key, result: { ok:false,error:'retryable_failure',retryable:true } }) })
  return () => { current = false }
 }, [key, retry]) // key binds the complete input, including locale.
 if (!topicIds.length) return null
 const result = loaded?.key === key ? loaded.result : null
 if (result?.ok && !result.data.items.length) return null
 return <SitovMotionStage className={styles.panel}>
  <h3>{copy.title}</h3>
  {!result ? <p role="status">{copy.loading}</p> : result.ok === false ? <><p role="alert">{copy.error}</p>
   {result.retryable && <button type="button" className={styles.link} onClick={() => { setLoaded(null); setRetry(value => value + 1) }}>{copy.retry}</button>}</> :
   <ul>{result.data.items.map(item => <li key={`${item.kind}/${item.targetId}`}><Link className={styles.link} href={item.href}>{copy[item.kind]} · {copy[item.action]} <span>{item.level}</span></Link></li>)}</ul>}
  <SitovTrainerHelp title={copy.help}><p>{copy.detail}</p></SitovTrainerHelp>
 </SitovMotionStage>
}
