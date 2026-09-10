'use client'

import { generateAudio } from '@/app/actions/generate-audio'
import { normalizeAudioText } from '@/lib/audio/neural-config'
import type { NeuralAudioLanguage } from '@/lib/types/audio'

export interface NeuralAudioSource {
  text: string
  language: NeuralAudioLanguage
  cardId?: string
  audioUrl?: string | null
}

const resolvedUrls = new Map<string, string>()
const pendingUrls = new Map<string, Promise<string>>()
const preloadedAudio = new Map<string, HTMLAudioElement>()
const MAX_URLS = 256
const MAX_PRELOADED_AUDIO = 4
const MAX_PREFETCH_REQUESTS = 2

export function neuralAudioKey(source: NeuralAudioSource): string {
  return JSON.stringify([source.cardId ?? null, source.language, normalizeAudioText(source.text), source.audioUrl ?? null])
}

export function cachedNeuralAudio(source: NeuralAudioSource): string | null {
  return resolvedUrls.get(neuralAudioKey(source)) || source.audioUrl || null
}

export function invalidateNeuralAudio(source: NeuralAudioSource): void {
  resolvedUrls.delete(neuralAudioKey(source))
}

/** Shared by the visible button and the small vocabulary lookahead window. */
export function resolveNeuralAudio(source: NeuralAudioSource, regenerate = false): Promise<string> {
  const key = neuralAudioKey(source)
  const cached = regenerate ? null : cachedNeuralAudio(source)
  if (cached) return Promise.resolve(cached)
  const pending = pendingUrls.get(key)
  if (pending) return pending
  const request = (async () => {
    try {
      const result = await generateAudio({
        text: normalizeAudioText(source.text), language: source.language,
        ...(source.cardId ? { cardId: source.cardId } : {}),
      })
      if (result.success === false) throw new Error(result.error)
      if (resolvedUrls.size >= MAX_URLS) {
        const oldest = resolvedUrls.keys().next().value
        if (oldest) resolvedUrls.delete(oldest)
      }
      resolvedUrls.set(key, result.audioUrl)
      return result.audioUrl
    } finally {
      pendingUrls.delete(key)
    }
  })()
  pendingUrls.set(key, request)
  return request
}

function preloadAudio(url: string): void {
  if (typeof Audio === 'undefined') return
  const existing = preloadedAudio.get(url)
  if (existing) {
    preloadedAudio.delete(url)
    preloadedAudio.set(url, existing)
    return
  }
  if (preloadedAudio.size >= MAX_PRELOADED_AUDIO) {
    const oldest = preloadedAudio.entries().next().value
    if (oldest) {
      oldest[1].removeAttribute('src')
      oldest[1].load()
      preloadedAudio.delete(oldest[0])
    }
  }
  const audio = new Audio()
  audio.preload = 'auto'
  audio.src = url
  audio.onerror = () => { preloadedAudio.delete(url) }
  preloadedAudio.set(url, audio)
  audio.load()
}

interface PrefetchJob { source: NeuralAudioSource; cancelled: boolean }
const prefetchQueue: PrefetchJob[] = []
let activePrefetchRequests = 0

function drainPrefetchQueue(): void {
  while (activePrefetchRequests < MAX_PREFETCH_REQUESTS && prefetchQueue.length) {
    const job = prefetchQueue.shift()
    if (!job || job.cancelled) continue
    activePrefetchRequests += 1
    void (async () => {
      try {
        const url = await resolveNeuralAudio(job.source)
        if (!job.cancelled) preloadAudio(url)
      } catch {
        // Speculation stays silent; an explicit tap can retry and show localized feedback.
      } finally {
        activePrefetchRequests -= 1
        drainPrefetchQueue()
      }
    })()
  }
}

/** Never synthesize a whole deck. Cancel obsolete queued work when the learner advances. */
export function prefetchNeuralAudio(sources: readonly NeuralAudioSource[]): () => void {
  const jobs = sources.slice(0, 2).filter(source => source.text.trim()).map(source => ({ source, cancelled: false }))
  prefetchQueue.push(...jobs)
  drainPrefetchQueue()
  return () => {
    jobs.forEach(job => { job.cancelled = true })
    for (let index = prefetchQueue.length - 1; index >= 0; index -= 1) {
      if (prefetchQueue[index].cancelled) prefetchQueue.splice(index, 1)
    }
  }
}
