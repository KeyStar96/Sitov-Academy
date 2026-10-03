'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { loadLearningCheckpoint } from '@/app/actions/learning-checkpoints'
import type { LearningCheckpointResult } from '@/lib/learning-checkpoints'
import { pronunciationReadingCheckpoint, type PronunciationCheckpointSnapshot, type PronunciationReadingCheckpoint } from '@/lib/pronunciation-checkpoint'
import type { PronunciationPrompt } from '@/lib/pronunciation-prompts'

type Notice = 'saving' | 'saved' | 'failed' | 'conflict' | null

export function usePronunciationCheckpoint({ level, prompts, initial, initialUnavailable, learnerId, fallbackPromptId }: {
  level: string
  prompts: readonly PronunciationPrompt[]
  initial?: PronunciationCheckpointSnapshot | null
  initialUnavailable?: boolean
  learnerId?: string
  fallbackPromptId?: string
}) {
  const fallback = useCallback((): PronunciationReadingCheckpoint => ({ promptId: fallbackPromptId ?? prompts[0]?.id ?? '', listened: false, referencePosition: 0 }), [fallbackPromptId, prompts])
  const [reading, setReading] = useState(() => pronunciationReadingCheckpoint(initial?.state, prompts) ?? fallback())
  const [notice, setNotice] = useState<Notice>(initialUnavailable ? 'failed' : null)
  const [restoreVersion, setRestoreVersion] = useState(0)
  const current = useRef(reading)
  const pending = useRef<PronunciationReadingCheckpoint | null>(null)
  const revision = useRef(initial?.revision ?? 0)
  const inFlight = useRef(false)
  const unavailable = useRef(Boolean(initialUnavailable))
  const owner = useRef(learnerId)
  const mounted = useRef(true)
  const lastPositionSave = useRef(0)
  const playbackStarted = useRef(false)
  const initialProgress = useRef(reading.referencePosition >= 0.99 ? 0 : reading.referencePosition)
  const promptsRef = useRef(prompts)
  promptsRef.current = prompts

  const apply = useCallback((next: PronunciationReadingCheckpoint) => {
    current.current = next
    initialProgress.current = next.referencePosition >= 0.99 ? 0 : next.referencePosition
    playbackStarted.current = false
    if (mounted.current) { setReading(next); setRestoreVersion(value => value + 1) }
  }, [])

  const flush = useCallback(async () => {
    if (inFlight.current || unavailable.current || !pending.current) return
    inFlight.current = true
    if (mounted.current) setNotice('saving')
    try {
      while (pending.current) {
        const next = pending.current
        pending.current = null
        // Every request in this one serialized loop can finish after pagehide.
        // A separate unload write would race its expected revision.
        const response = await fetch('/api/learning-checkpoints', { method: 'POST',
          headers: { 'Content-Type': 'application/json' }, cache: 'no-store', keepalive: true,
          body: JSON.stringify({ kind: 'pronunciation', level, state: next, revision: revision.current, learnerId: owner.current }),
        })
        const result = await response.json() as LearningCheckpointResult
        if (result.ok === false || !result.checkpoint) {
          if (result.ok === true) {
            pending.current ??= next
            if (mounted.current) setNotice('failed')
            return
          }
          if (result.error === 'conflict') {
            // A second device owns the newer checkpoint. Do not overwrite it
            // with a queued event from this device.
            pending.current = null
            revision.current = result.checkpoint?.revision ?? revision.current
            const canonical = pronunciationReadingCheckpoint(result.checkpoint?.state, promptsRef.current)
            apply(canonical ?? fallback())
            if (mounted.current) setNotice('conflict')
          } else {
            pending.current ??= next
            if (mounted.current) setNotice('failed')
          }
          return
        }
        owner.current = result.learnerId
        revision.current = result.checkpoint.revision
      }
      if (mounted.current) setNotice('saved')
    } catch {
      pending.current ??= current.current
      if (mounted.current) setNotice('failed')
    } finally { inFlight.current = false }
  }, [apply, fallback, level])

  const save = useCallback((next: PronunciationReadingCheckpoint) => {
    pending.current = next
    void flush()
  }, [flush])

  const select = useCallback((promptId: string) => {
    if (!promptsRef.current.some(prompt => prompt.id === promptId) || promptId === current.current.promptId) return
    const next = { promptId, listened: false, referencePosition: 0 }
    apply(next)
    save(next)
  }, [apply, save])

  const referenceProgress = useCallback((fraction: number | null) => {
    if (fraction === null) {
      if (playbackStarted.current) { playbackStarted.current = false; save(current.current) }
      return
    }
    if (!Number.isFinite(fraction) || fraction <= 0) return
    playbackStarted.current = true
    const firstListen = !current.current.listened
    const firstEnd = current.current.referencePosition < 0.99 && fraction >= 0.99
    const next = { ...current.current, listened: true, referencePosition: Math.min(1, fraction) }
    current.current = next
    if (firstListen) setReading(next)
    if (firstListen || Date.now() - lastPositionSave.current >= 5000 || firstEnd) {
      lastPositionSave.current = Date.now()
      save(next)
    }
  }, [save])

  const retry = useCallback(async () => {
    if (unavailable.current) {
      if (mounted.current) setNotice('saving')
      try {
        const result = await loadLearningCheckpoint('pronunciation', level, owner.current)
        if (!result.ok) { if (mounted.current) setNotice('failed'); return }
        unavailable.current = false
        owner.current = result.learnerId
        revision.current = result.checkpoint?.revision ?? 0
        // Restore the server checkpoint before accepting new events after a load failure.
        pending.current = null
        apply(pronunciationReadingCheckpoint(result.checkpoint?.state, promptsRef.current) ?? fallback())
        if (mounted.current) setNotice(null)
      } catch { if (mounted.current) setNotice('failed') }
      return
    }
    await flush()
  }, [apply, fallback, flush, level])

  useEffect(() => {
    mounted.current = true
    const flushPosition = () => { if (playbackStarted.current && !unavailable.current) save(current.current) }
    const hidden = () => { if (document.visibilityState === 'hidden') flushPosition() }
    window.addEventListener('pagehide', flushPosition)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      mounted.current = false
      flushPosition()
      window.removeEventListener('pagehide', flushPosition)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [save])

  useEffect(() => {
    if (!initial || initial.revision <= revision.current || pending.current || inFlight.current) return
    revision.current = initial.revision
    apply(pronunciationReadingCheckpoint(initial.state, promptsRef.current) ?? fallback())
  }, [apply, fallback, initial])

  return { reading, initialProgress: initialProgress.current, restoreVersion, notice, select, referenceProgress, retry }
}
