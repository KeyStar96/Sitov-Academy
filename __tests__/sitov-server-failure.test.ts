import { sitovServerFailure } from '@/lib/sitov-server-failure'
import { loadLearningNewCounts, loadLearningNewItems } from '@/lib/learning-new-server'
import { loadLastActiveLevel } from '@/lib/last-active-level'
import { NO_NEW_ITEMS } from '@/lib/learning-new'
import { createClient } from '@/utils/supabase/server'
import { requestSession } from '@/lib/request-session'

jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/request-session', () => ({ requestSession: jest.fn() }))
const rpc = jest.fn()
const secret = 'private-user-token https://private.test?token=secret'
let log: jest.SpyInstance
beforeEach(() => {
  jest.clearAllMocks(); rpc.mockReset()
  log = jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.mocked(createClient).mockResolvedValue({ rpc } as unknown as Awaited<ReturnType<typeof createClient>>)
  jest.mocked(requestSession).mockResolvedValue({ supabase: { rpc }, user: { id: secret } } as unknown as Awaited<ReturnType<typeof requestSession>>)
})
afterEach(() => { log.mockRestore() })

it.each([
  [{ code: '42501', message: secret, details: secret }, 'sqlstate:42501'],
  [{ sqlstate: '42P01', error: secret, message: secret }, 'sqlstate:42P01'],
  [{ code: 'PGRST202', message: secret }, 'postgrest:PGRST202'],
  [Object.assign(new TypeError(secret), { cause: { code: 'ECONNRESET', address: secret } }), 'network:ECONNRESET'],
  [new TypeError(secret), 'class:TypeError'],
  [{ name: 'ZodError', issues: [{ path: [secret], message: secret }] }, 'class:ZodError'],
])('returns only a bounded discriminator for %p', (error, expected) => {
  expect(sitovServerFailure(error)).toBe(expected)
  expect(sitovServerFailure(error)).not.toContain(secret)
})
it.each(['TOKEN', secret, '42501\n', 'PGRST202\n', '42501 token', 'pgrst202', 'ZZ999', 'x'.repeat(10000)])('rejects hostile or non-code values', code => {
  expect(sitovServerFailure({ code, sqlstate: code, name: code, cause: { code } })).toBe('unknown')
})
it('never reads raw fields or coerces hostile code objects and survives throwing accessors', () => {
  const raw = { code: { toString: () => { throw new Error(secret) } }, get message() { throw new Error(secret) }, get details() { throw new Error(secret) } }
  expect(sitovServerFailure(raw)).toBe('unknown')
  expect(sitovServerFailure({ get code() { throw new Error(secret) } })).toBe('unknown')
  expect(sitovServerFailure(secret)).toBe('unknown')
})

it.each(['items', 'last-active'] as const)('keeps the %s RPC fallback and logs only its safe database code', async kind => {
  rpc.mockResolvedValue({ data: null, error: { code: '42501', message: secret, details: secret, hint: secret } })
  expect(await (kind === 'items' ? loadLearningNewItems('A1.1') : loadLastActiveLevel())).toEqual(kind === 'items' ? NO_NEW_ITEMS : null)
  expect(log).toHaveBeenCalledWith(kind === 'items' ? '[learning-new] items_unavailable' : '[last-active-level] unavailable', { failure: 'sqlstate:42501' })
  expect(JSON.stringify(log.mock.calls)).not.toContain(secret)
})
it('preserves JSONB RPC failure handling without logging its message', async () => {
  rpc.mockResolvedValue({ data: { error: secret, message: secret, sqlstate: '42883' }, error: null })
  expect(await loadLastActiveLevel()).toBeNull()
  expect(log).toHaveBeenCalledWith('[last-active-level] unavailable', { failure: 'sqlstate:42883' })
  expect(await loadLearningNewItems('A1.1')).toBe(NO_NEW_ITEMS)
  expect(log).toHaveBeenCalledWith('[learning-new] items_invalid', { failure: 'sqlstate:42883' })
  expect(JSON.stringify(log.mock.calls)).not.toContain(secret)
})
it('distinguishes invalid response from a transport class while retaining empty fallbacks', async () => {
  rpc.mockResolvedValue({ data: { private: secret }, error: null })
  expect(await loadLastActiveLevel()).toBeNull()
  expect(log).toHaveBeenCalledWith('[last-active-level] invalid_response', { failure: 'schema:invalid_response' })
  rpc.mockRejectedValue(new TypeError(secret))
  expect(await loadLearningNewItems('A1.1')).toBe(NO_NEW_ITEMS)
  expect(log).toHaveBeenCalledWith('[learning-new] items_unavailable', { failure: 'class:TypeError' })
  expect(await loadLearningNewCounts()).toBeNull()
  expect(log).toHaveBeenCalledWith('[learning-new] counts_unavailable', { failure: 'class:TypeError' })
  expect(JSON.stringify(log.mock.calls)).not.toContain(secret)
})
it('retains successful empty responses and makes no failure log', async () => {
  rpc.mockResolvedValue({ data: { success: true, items: {}, lessons: {} }, error: null })
  expect(await loadLearningNewItems('A1.1')).toEqual(NO_NEW_ITEMS)
  rpc.mockResolvedValue({ data: { level: null, mode: null, source: 'none', levels: [] }, error: null })
  expect(await loadLastActiveLevel()).toEqual({ level: null, mode: null, source: 'none', levels: [] })
  expect(log).not.toHaveBeenCalled()
})
