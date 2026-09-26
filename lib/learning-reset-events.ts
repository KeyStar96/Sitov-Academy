/** Cross-tab coordination only. These messages cannot reset server data; they
 * invalidate learning UI after the authenticated server reset has succeeded. */
const CHANNEL = 'sitov-learning-reset'
const STORAGE_PREFIX = 'sitov_learning_reset:'
let currentOrigin: string | null = null

interface LearningResetNotice {
  userId: string
  resetId: string
  originId: string
  change?: 'carryover'
}

function randomId(): string {
  try { return window.crypto.randomUUID() }
  catch { return `${Date.now()}-${Math.random().toString(36).slice(2)}` }
}
function tabOrigin(): string {
  // Kept in memory, so a duplicated browser tab gets a different origin ID.
  currentOrigin ??= randomId()
  return currentOrigin
}
function parseNotice(value: unknown, userId: string): LearningResetNotice | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  if (candidate.userId !== userId || typeof candidate.resetId !== 'string'
    || !candidate.resetId || candidate.resetId.length > 100
    || typeof candidate.originId !== 'string' || !candidate.originId || candidate.originId.length > 100) return null
  return { userId, resetId: candidate.resetId, originId: candidate.originId,
    ...(candidate.change === 'carryover' ? { change: 'carryover' as const } : {}) }
}
function readNotice(raw: string | null, userId: string): LearningResetNotice | null {
  try { return raw ? parseNotice(JSON.parse(raw), userId) : null }
  catch { return null }
}
function storedNotice(userId: string): LearningResetNotice | null {
  try { return readNotice(window.localStorage.getItem(`${STORAGE_PREFIX}${userId}`), userId) }
  catch { return null }
}

/** Auth, theme and self-authored vocabulary are preserved. Carryover decisions
 * are authoritative in PostgreSQL; a reset invalidates every level's cached
 * queue because an origin reset can remove cards from any later target. */
export function clearLearningResetBrowserState(): void {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('sitov_lernkasten:') || key.startsWith('sitov_path:')
        || key.startsWith('sitov_vocab_carryover:')) window.localStorage.removeItem(key)
    }
  } catch { /* Storage may be disabled; the server reset already succeeded. */ }
  try {
    window.sessionStorage.removeItem('sitov_vocab_autostart')
    for (const key of Object.keys(window.sessionStorage)) {
      if (key.startsWith('sitov_path:') || key.startsWith('sitov_vocab_carryover:')) window.sessionStorage.removeItem(key)
    }
  }
  catch { /* Private browsing must not turn a completed reset into an error. */ }
}

/** Call only after the server reports a completed reset. userId is supplied by
 * the authenticated page, and is never sent as authorization to the Action. */
export function announceLearningReset(userId: string): void {
  clearLearningResetBrowserState()
  publishLearningChange(userId)
}

/** After a persisted switch/choice, other tabs discard their session snapshots.
 * This uses the existing reload subscriber; it does not reset any learning data
 * or clear unrelated path-resume preferences in the initiating tab. */
export function announceVocabularyCarryoverChange(userId: string): void {
  publishLearningChange(userId, 'carryover')
}

function publishLearningChange(userId: string, change?: 'carryover'): void {
  const notice: LearningResetNotice = { userId, resetId: randomId(), originId: tabOrigin(), ...(change ? { change } : {}) }
  try { window.localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(notice)) }
  catch { /* BroadcastChannel can still reach open tabs without local storage. */ }
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(CHANNEL)
      channel.postMessage(notice)
      channel.close()
    }
  } catch { /* Storage events provide the fallback on unsupported browsers. */ }
}

/** A hard refresh of another tab discards its in-memory exercise queues and
 * active media. Focus/pageshow cover suspended tabs that missed the live event. */
export function subscribeToLearningResets(userId: string, onExternalReset: () => void): () => void {
  const originId = tabOrigin()
  let lastResetId = storedNotice(userId)?.resetId ?? null
  let handled = false
  let channel: BroadcastChannel | null = null

  function receive(notice: LearningResetNotice | null) {
    if (!notice || notice.resetId === lastResetId || handled) return
    lastResetId = notice.resetId
    if (notice.originId === originId) return
    handled = true
    if (notice.change !== 'carryover') clearLearningResetBrowserState()
    onExternalReset()
  }
  const checkStored = () => receive(storedNotice(userId))
  const onVisible = () => { if (document.visibilityState === 'visible') checkStored() }
  const onStorage = (event: StorageEvent) => {
    if (event.key === `${STORAGE_PREFIX}${userId}`) receive(readNotice(event.newValue, userId))
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener('focus', checkStored)
  window.addEventListener('pageshow', checkStored)
  document.addEventListener('visibilitychange', onVisible)
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CHANNEL)
      channel.onmessage = (event: MessageEvent<unknown>) => receive(parseNotice(event.data, userId))
    }
  } catch { /* Storage and focus listeners remain active. */ }
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('focus', checkStored)
    window.removeEventListener('pageshow', checkStored)
    document.removeEventListener('visibilitychange', onVisible)
    channel?.close()
  }
}
