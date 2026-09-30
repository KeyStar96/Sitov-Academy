'use client'

import { useSyncExternalStore } from 'react'
import { defaultPlaybackRate, PLAYBACK_RATES } from './playback-settings'

export const PLAYBACK_RATE_STORAGE_KEY = 'smartgerman:audio:playback-rate'
const CHANGE_EVENT = 'smartgerman:audio:playback-rate-changed'
let unavailableStorageRate: number | null = null
let failedWrite: { rate: number; previous: string | null } | null = null

function validRate(value: number): boolean {
  return PLAYBACK_RATES.some(rate => rate === value)
}

function readRate(): number | null {
  try {
    const stored = window.localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY)
    // A full quota can allow reads while rejecting writes. Apply the new
    // choice in this page until storage changes or a later write succeeds.
    if (failedWrite?.previous === stored) return failedWrite.rate
    failedWrite = null
    const rate = stored === null ? NaN : Number(stored)
    return validRate(rate) ? rate : null
  } catch {
    // Private browsing can block storage. Keep an explicit choice for this page.
    return unavailableStorageRate
  }
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === PLAYBACK_RATE_STORAGE_KEY || event.key === null) {
      failedWrite = null
      onChange()
    }
  }
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

function saveRate(rate: number): void {
  if (!validRate(rate)) return
  unavailableStorageRate = rate
  let previous: string | null = null
  try {
    previous = window.localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY)
    window.localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, String(rate))
    failedWrite = null
  } catch {
    failedWrite = { rate, previous }
  }
  // storage events only reach other tabs; update every player in this tab too.
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** Explicit choices override level defaults across cards, trainers and visits. */
export function usePlaybackRate(level?: string): readonly [number, (rate: number) => void] {
  const manualRate = useSyncExternalStore(subscribe, readRate, () => null)
  return [manualRate ?? defaultPlaybackRate(level), saveRate]
}
