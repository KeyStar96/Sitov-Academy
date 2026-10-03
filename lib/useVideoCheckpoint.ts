'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { loadLearningCheckpoint } from '@/app/actions/learning-checkpoints'
import { sitovVideoProgressSchema, type LearningCheckpoint, type LearningCheckpointResult, type VideoProgress } from '@/lib/learning-checkpoints'

export function useVideoCheckpoint(level: string, initial: LearningCheckpoint | null, initialLearnerId: string | null, allowedIds: string[]) {
  const parse = useCallback((checkpoint: LearningCheckpoint | null): VideoProgress => {
    const value = sitovVideoProgressSchema.safeParse(checkpoint?.state.progress ?? {})
    return value.success ? Object.fromEntries(Object.entries(value.data).filter(([id]) => allowedIds.includes(id))) : {}
  }, [allowedIds])
  const [progress, setProgress] = useState(() => parse(initial))
  const [issue, setIssue] = useState<'unavailable' | 'conflict' | null>(initialLearnerId ? null : 'unavailable')
  const [ready, setReady] = useState(!!initialLearnerId)
  const current = useRef(progress), revision = useRef(initial?.revision ?? 0), learner = useRef(initialLearnerId)
  const dirty = useRef(false), saving = useRef<Promise<void> | null>(null), blocked = useRef(false)
  const persist = useCallback((): Promise<void> => {
    if (saving.current) return saving.current
    if (!dirty.current || !learner.current || blocked.current) return Promise.resolve()
    const work = async () => {
      while (dirty.current && !blocked.current) {
        const snapshot = current.current
        try {
          const body = JSON.stringify({ kind: 'videos', level, state: { progress: snapshot }, revision: revision.current, learnerId: learner.current })
          // Fetch keepalive has a browser byte limit; large libraries still
          // save normally during playback and on pause.
          const response = await fetch('/api/learning-checkpoints', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: new TextEncoder().encode(body).length <= 60000, cache: 'no-store' })
          const result = await response.json() as LearningCheckpointResult
          if (result.ok === false || !result.checkpoint) {
            blocked.current = result.ok === false && (result.error === 'conflict' || result.error === 'unauthorized')
            setIssue(result.ok === false && result.error === 'conflict' ? 'conflict' : 'unavailable')
            break
          }
          revision.current = result.checkpoint.revision
          dirty.current = current.current !== snapshot
          setIssue(null)
        } catch { setIssue('unavailable'); break }
      }
    }
    const promise = work().finally(() => { saving.current = null })
    saving.current = promise
    return promise
  }, [level])

  const track = useCallback((id: string, seconds: number, duration: number, force = false) => {
    if (!Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(duration) || duration <= 0 || seconds > duration || blocked.current || !learner.current) return
    const last = current.current[id]
    if (!force && last && Math.abs(last.t - seconds) < 4) return
    current.current = { ...current.current, [id]: { t: seconds, d: duration, at: Date.now() } }
    dirty.current = true
    setProgress(current.current)
    void persist()
  }, [persist])

  const reload = useCallback(async () => {
    await saving.current
    const result = await loadLearningCheckpoint('videos', level, learner.current ?? undefined)
    if (result.ok === false) { setIssue('unavailable'); return }
    learner.current = result.learnerId
    revision.current = result.checkpoint?.revision ?? 0
    current.current = parse(result.checkpoint)
    dirty.current = false; blocked.current = false
    setProgress(current.current); setReady(true); setIssue(null)
  }, [level, parse])
  useEffect(() => {
    // The retired key was not user-scoped and cannot safely identify its owner.
    try { localStorage.removeItem('sitov:media-progress') } catch { /* cleanup only */ }
    const flush = () => { void persist() }
    const visibility = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush); document.addEventListener('visibilitychange', visibility)
    return () => { flush(); window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', visibility) }
  }, [persist])
  return { progress, issue, ready, track, flush: persist, reload, retry: () => blocked.current ? reload() : persist() }
}
