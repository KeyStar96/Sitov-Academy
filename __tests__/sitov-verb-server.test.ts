import { loadSitovVerbTrainer } from '@/lib/verbs/server'
import { createClient } from '@/utils/supabase/server'
import { loadLevelAccessProfile } from '@/lib/access/server'
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/utils/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/access/server', () => ({ loadLevelAccessProfile: jest.fn() }))
jest.mock('@/lib/verbs/catalog', () => ({ getSitovVerbCatalog: () => [{ id: 'sitov-verb-test' }], getSitovVerbById: () => null, getSitovVerbTenses: () => ['present'] }))
const from = jest.fn()
let log: jest.SpyInstance
beforeEach(() => {
  jest.clearAllMocks(); from.mockReset()
  log = jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'private-user' } }, error: null }) }, from } as unknown as Awaited<ReturnType<typeof createClient>>)
  jest.mocked(loadLevelAccessProfile).mockResolvedValue({ role: 'teacher', allowed_levels: ['A1.1'] })
})
afterEach(() => { log.mockRestore() })
function rows(table: string) {
  const data = table === 'sitov_verb_catalog' ? [{ id: 'sitov-verb-test', unit_id: 'private-unit', level: 'A1.1' }] : []
  const query = { select: () => query, eq: () => query, order: () => query, range: jest.fn().mockResolvedValue({ data, error: null }) }
  return query
}
it.each(['uk', 'tr'])('returns the same fail-closed result in %s while identifying the catalog read failure', async lang => {
  from.mockImplementation(table => {
    const query = rows(table)
    if (table === 'sitov_verb_catalog') query.range.mockResolvedValue({ data: null, error: { code: '42501', message: 'private-token', details: 'private-query' } })
    return query
  })
  expect(await loadSitovVerbTrainer('A1.1', lang)).toEqual({ error: 'request_failed' })
  expect(log).toHaveBeenCalledWith('[sitov-verbs] Request unavailable', { stage: 'verb_catalog', failure: 'sqlstate:42501' })
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/private/)
})
it('distinguishes invalid progress schema from database transport without logging row values', async () => {
  from.mockImplementation(table => {
    const query = rows(table)
    if (table === 'sitov_verb_progress') query.range.mockResolvedValue({ data: [{ verb_id: 'sitov-verb-test', tense: 'private-secret' }], error: null })
    return query
  })
  expect(await loadSitovVerbTrainer('A1.1')).toEqual({ error: 'request_failed' })
  expect(log).toHaveBeenCalledWith('[sitov-verbs] Request unavailable', { stage: 'work', failure: 'class:ZodError' })
  expect(JSON.stringify(log.mock.calls)).not.toContain('private-secret')
})
it('retains denied access before all catalog reads and keeps expected denial silent', async () => {
  jest.mocked(loadLevelAccessProfile).mockResolvedValue({ role: 'student', allowed_levels: [] })
  expect(await loadSitovVerbTrainer('A1.1')).toEqual({ error: 'not_authorized' })
  expect(from).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled()
})
it('identifies client creation transport failure without exposing its URL or stack', async () => {
  jest.mocked(createClient).mockRejectedValue(Object.assign(new TypeError('private-url'), { cause: { code: 'ECONNRESET', hostname: 'private-host' } }))
  expect(await loadSitovVerbTrainer('A1.1')).toEqual({ error: 'request_failed' })
  expect(log).toHaveBeenCalledWith('[sitov-verbs] Request unavailable', { stage: 'client', failure: 'network:ECONNRESET' })
  expect(from).not.toHaveBeenCalled(); expect(JSON.stringify(log.mock.calls)).not.toContain('private')
})
