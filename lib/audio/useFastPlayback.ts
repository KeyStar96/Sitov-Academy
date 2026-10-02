'use client'

import { useSyncExternalStore } from 'react'

/** Lehrkräfte hören Aufnahmen wahlweise im natürlichen oder im doppelten Tempo ab. */
export const FAST_PLAYBACK_RATE = 2
export const FAST_PLAYBACK_STORAGE_KEY = 'sitov:audio:fast-playback'
const CHANGE_EVENT = 'sitov:audio:fast-playback-changed'
// Private browsing can block storage entirely; a full quota can allow reads
// while rejecting writes. Either way the choice still applies on this page.
let blockedChoice: boolean | null = null
let failedWrite: { enabled: boolean; previous: string | null } | null = null

function readChoice(): boolean {
  try {
    const stored = window.localStorage.getItem(FAST_PLAYBACK_STORAGE_KEY)
    if (failedWrite?.previous === stored) return failedWrite.enabled
    failedWrite = null
    return stored === '1'
  } catch {
    return blockedChoice ?? false
  }
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== FAST_PLAYBACK_STORAGE_KEY && event.key !== null) return
    failedWrite = null
    onChange()
  }
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

function saveChoice(enabled: boolean): void {
  let previous: string | null = null
  try {
    previous = window.localStorage.getItem(FAST_PLAYBACK_STORAGE_KEY)
    window.localStorage.setItem(FAST_PLAYBACK_STORAGE_KEY, enabled ? '1' : '0')
    failedWrite = null
    blockedChoice = null
  } catch {
    failedWrite = { enabled, previous }
    blockedChoice = enabled
  }
  // storage events only reach other tabs; update every player in this tab too.
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/**
 * One switch for every recording in the correction queue: turned on once, each
 * following recording starts at 2× as well. Kept apart from the learners'
 * tempo (`usePlaybackRate`), whose slower defaults follow the course level.
 */
export function useFastPlayback(): readonly [boolean, (enabled: boolean) => void] {
  const enabled = useSyncExternalStore(subscribe, readChoice, () => false)
  return [enabled, saveChoice]
}
