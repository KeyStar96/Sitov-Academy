import { announceLearningReset, subscribeToLearningResets } from '@/lib/learning-reset-events'

const userId = '00000000-0000-4000-8000-000000000001'
const otherId = '00000000-0000-4000-8000-000000000002'
const key = `sitov_learning_reset:${userId}`
const notice = (changes: Record<string, unknown> = {}) => ({ userId, resetId: 'reset-1', originId: 'another-browser-tab', ...changes })
const originalBroadcast = Object.getOwnPropertyDescriptor(globalThis, 'BroadcastChannel')
const cleanups: Array<() => void> = []

class TestChannel {
  static channels: TestChannel[] = []
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  closed = false
  constructor(readonly name: string) { TestChannel.channels.push(this) }
  postMessage(data: unknown) {
    for (const channel of TestChannel.channels) {
      if (channel !== this && channel.name === this.name && !channel.closed) channel.onmessage?.({ data } as MessageEvent<unknown>)
    }
  }
  close() { this.closed = true }
}
function listen(user = userId) {
  const callback = jest.fn()
  const cleanup = subscribeToLearningResets(user, callback)
  cleanups.push(cleanup)
  return { callback, cleanup }
}
function storageEvent(value: unknown, storageKey = key) {
  window.dispatchEvent(new StorageEvent('storage', { key: storageKey, newValue: JSON.stringify(value) }))
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear()
  TestChannel.channels = []
  Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: TestChannel })
})
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  if (originalBroadcast) Object.defineProperty(globalThis, 'BroadcastChannel', originalBroadcast)
  else Reflect.deleteProperty(globalThis, 'BroadcastChannel')
})

it('announces a completed reset without reloading the initiating tab', () => {
  const { callback } = listen()
  localStorage.setItem('sitov_lernkasten:A1.1', '["Lesson 1"]')
  sessionStorage.setItem('sitov_vocab_autostart', 'A1.1')
  announceLearningReset(userId)
  expect(callback).not.toHaveBeenCalled()
  expect(localStorage.getItem('sitov_lernkasten:A1.1')).toBeNull()
  expect(sessionStorage.getItem('sitov_vocab_autostart')).toBeNull()
  const stored = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>
  expect(stored.userId).toBe(userId)
  expect(typeof stored.resetId).toBe('string')
  window.dispatchEvent(new Event('focus'))
  expect(callback).not.toHaveBeenCalled()
})

it('clears the receiving tab learning state and coalesces duplicate channel/storage messages', () => {
  const { callback } = listen()
  localStorage.setItem('sitov_lernkasten:B1.2', '["Lesson 2"]')
  localStorage.setItem('theme', 'dark')
  localStorage.setItem('sitov_custom_vocab:B1.2:Lesson 2', '["das Haus"]')
  sessionStorage.setItem('sitov_vocab_autostart', 'B1.2')
  sessionStorage.setItem('sitov-intro-seen', '1')
  const anotherTab = new TestChannel('sitov-learning-reset')
  anotherTab.postMessage(notice())
  storageEvent(notice())
  expect(callback).toHaveBeenCalledTimes(1)
  expect(localStorage.getItem('sitov_lernkasten:B1.2')).toBeNull()
  expect(sessionStorage.getItem('sitov_vocab_autostart')).toBeNull()
  expect(localStorage.getItem('theme')).toBe('dark')
  expect(localStorage.getItem('sitov_custom_vocab:B1.2:Lesson 2')).toBe('["das Haus"]')
  expect(sessionStorage.getItem('sitov-intro-seen')).toBe('1')
})

it('ignores another account, malformed messages, and unrelated storage changes', () => {
  const { callback } = listen()
  const sender = new TestChannel('sitov-learning-reset')
  sender.postMessage(notice({ userId: otherId }))
  sender.postMessage({ userId })
  sender.postMessage(notice({ resetId: 42 }))
  sender.postMessage(null)
  storageEvent(notice(), `sitov_learning_reset:${otherId}`)
  storageEvent(notice(), 'theme')
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: '{invalid' }))
  expect(callback).not.toHaveBeenCalled()
})

it('uses storage events when BroadcastChannel is unavailable', () => {
  Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: undefined })
  const { callback } = listen()
  storageEvent(notice())
  expect(callback).toHaveBeenCalledTimes(1)
})

it.each(['focus', 'pageshow'])('detects a reset missed by a suspended tab on %s', event => {
  const { callback } = listen()
  localStorage.setItem(key, JSON.stringify(notice()))
  window.dispatchEvent(new Event(event))
  expect(callback).toHaveBeenCalledTimes(1)
})

it('checks the current marker when a suspended document becomes visible', () => {
  const { callback } = listen()
  localStorage.setItem(key, JSON.stringify(notice()))
  document.dispatchEvent(new Event('visibilitychange'))
  expect(callback).toHaveBeenCalledTimes(1)
})

it('does not create a reload loop when the page mounts after a completed reset', () => {
  localStorage.setItem(key, JSON.stringify(notice()))
  const { callback } = listen()
  window.dispatchEvent(new Event('focus'))
  storageEvent(notice())
  expect(callback).not.toHaveBeenCalled()
  storageEvent(notice({ resetId: 'reset-2' }))
  expect(callback).toHaveBeenCalledTimes(1)
})

it('removes every listener and closes the channel on unmount or account change', () => {
  const { callback, cleanup } = listen()
  cleanup()
  localStorage.setItem(key, JSON.stringify(notice()))
  window.dispatchEvent(new Event('focus'))
  window.dispatchEvent(new Event('pageshow'))
  document.dispatchEvent(new Event('visibilitychange'))
  storageEvent(notice())
  new TestChannel('sitov-learning-reset').postMessage(notice())
  expect(callback).not.toHaveBeenCalled()
  expect(TestChannel.channels[0].closed).toBe(true)
})

it('still delivers channel notifications when localStorage access is blocked', () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')!
  try {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Blocked', 'SecurityError') } })
    const { callback } = listen()
    expect(() => announceLearningReset(userId)).not.toThrow()
    expect(callback).not.toHaveBeenCalled()
    new TestChannel('sitov-learning-reset').postMessage(notice())
    expect(callback).toHaveBeenCalledTimes(1)
  } finally { Object.defineProperty(window, 'localStorage', descriptor) }
})
