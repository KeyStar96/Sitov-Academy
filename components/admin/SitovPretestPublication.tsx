'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { z } from 'zod'
import { getSitovPronunciationPretestPublication, publishSitovPronunciationPretest } from '@/app/actions/sitov-pronunciation-pretest'
import { sitovPretestPublicationInputSchema, sitovPretestPublicationReadinessSchema, sitovPretestPublishedSchema, sitovPretestPublishInputSchema } from '@/lib/sitov-pronunciation-pretest-author-contract'
import { sitovPretestPublicationCopy } from '@/lib/sitov-pronunciation-pretest-staff-i18n'
import PressableCard from '@/components/motion/PressableCard'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
import SitovTrainerHelp from '@/components/motion/SitovTrainerHelp'
import { sitovTrainerHelpCopy } from '@/lib/sitov-trainer-help-copy'
import styles from './SitovPretestPublication.module.css'

export type SitovPublishedPretest = z.infer<typeof sitovPretestPublishedSchema>
interface Props { scopeKey: string; textId: string; textVersion: string; definition?: { id: string; text_version: string; test_version: string; active: boolean }; latestDefinitionId: string | null; baseActiveDefinitionId: string | null; lang: string; onPublished: (ack: SitovPublishedPretest) => void; onReload: () => void }
type State = 'loading' | 'ready' | 'missing' | 'readFailed' | 'pending' | 'uncertain' | 'conflict' | 'unavailable' | 'published'

/** A changed ownership/selection retires both readiness and in-flight receipts. */
export default function SitovPretestPublication(props: Props) {
  return <SitovPublicationScope key={`${props.scopeKey}:${props.lang}:${props.textId}:${props.textVersion}:${props.definition?.id}:${props.definition?.text_version}:${props.definition?.test_version}:${props.definition?.active}:${props.latestDefinitionId}:${props.baseActiveDefinitionId}`} {...props} />
}
function SitovPublicationScope({ textId, textVersion, definition, latestDefinitionId, baseActiveDefinitionId, lang, onPublished, onReload }: Props) {
  const copy = sitovPretestPublicationCopy(lang)
  const reason = !definition ? 'choose' : definition.text_version !== textVersion ? 'outdated' : definition.active ? 'active' : definition.id !== latestDefinitionId ? 'notLatest' : null
  const input = useMemo(() => sitovPretestPublicationInputSchema.safeParse({ textId, textVersion, definitionId: definition?.id, testVersion: definition?.test_version, baseActiveDefinitionId }), [textId, textVersion, definition?.id, definition?.test_version, baseActiveDefinitionId])
  const [state, setState] = useState<State>('loading')
  const [readVersion, setReadVersion] = useState(0)
  const live = useRef(true)
  const pending = useRef(false)
  const request = useRef<z.infer<typeof sitovPretestPublishInputSchema> | null>(null)
  const status = useRef<HTMLParagraphElement>(null)
  const id = useId()
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  useEffect(() => {
    if (reason || !input.success) return
    let cancelled = false
    setState('loading')
    async function read() {
      try {
        const result = await getSitovPronunciationPretestPublication(input.data)
        if (cancelled || !live.current) return
        if (result.ok === false) { setState(result.error === 'authoring_not_ready' ? 'missing' : result.error === 'version_conflict' || result.error === 'request_conflict' ? 'conflict' : result.retryable ? 'readFailed' : 'unavailable'); return }
        const value = sitovPretestPublicationReadinessSchema.safeParse(result.data)
        if (!value.success || value.data.textId !== input.data.textId || value.data.definitionId !== input.data.definitionId || value.data.textVersion !== input.data.textVersion || value.data.testVersion !== input.data.testVersion || value.data.activeDefinitionId !== input.data.baseActiveDefinitionId) { setState('readFailed'); return }
        setState(value.data.ready ? 'ready' : 'missing')
      } catch { if (!cancelled && live.current) setState('readFailed') }
    }
    void read()
    return () => { cancelled = true }
  }, [reason, input, readVersion])
  useEffect(() => { if (['uncertain', 'conflict', 'unavailable', 'published'].includes(state)) status.current?.focus({ preventScroll: true }) }, [state])
  async function publish() {
    if (pending.current || reason || !input.success || (state !== 'ready' && state !== 'uncertain')) return
    if (!request.current) {
      if (state !== 'ready') return
      try { request.current = { ...input.data, requestId: crypto.randomUUID() } }
      catch { setState('unavailable'); return }
    }
    const payload = request.current
    pending.current = true; setState('pending')
    try {
      const result = await publishSitovPronunciationPretest(payload)
      if (!live.current) return
      if (result.ok === false) { setState(result.retryable ? 'uncertain' : result.error === 'authoring_not_ready' ? 'missing' : result.error === 'version_conflict' || result.error === 'request_conflict' ? 'conflict' : 'unavailable'); return }
      const ack = sitovPretestPublishedSchema.safeParse(result.data)
      if (!ack.success || ack.data.textId !== payload.textId || ack.data.definitionId !== payload.definitionId || ack.data.textVersion !== payload.textVersion || ack.data.testVersion !== payload.testVersion) { setState('uncertain'); return }
      setState('published'); onPublished(ack.data)
    } catch { if (live.current) setState('uncertain') }
    finally { pending.current = false }
  }
  const message = reason ? copy[reason] : !input.success ? copy.unavailable : copy[state]
  return <SitovMotionStage className={styles.sitovPublication} aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}>{copy.title}</h3>
    <p ref={status} tabIndex={-1} role={['uncertain', 'conflict', 'unavailable', 'readFailed'].includes(state) && !reason ? 'alert' : 'status'}>{message}</p>
    <div className={styles.sitovActions}>
      <PressableCard disabled={!!reason || !input.success || state !== 'ready'} aria-busy={state === 'pending'} onClick={() => void publish()}>{state === 'pending' && !reason ? copy.pending : copy.publish}</PressableCard>
      {!reason && state === 'uncertain' && <PressableCard onClick={() => void publish()}>{copy.retry}</PressableCard>}
      {!reason && (state === 'readFailed' || state === 'missing') && <PressableCard onClick={() => setReadVersion(value => value + 1)}>{copy.check}</PressableCard>}
      {!reason && (state === 'conflict' || state === 'unavailable') && <PressableCard onClick={onReload}>{copy.reload}</PressableCard>}
    </div>
    <SitovTrainerHelp title={sitovTrainerHelpCopy(lang).label}><h3>{copy.help}</h3><p>{copy.helpBody}</p></SitovTrainerHelp>
  </SitovMotionStage>
}
