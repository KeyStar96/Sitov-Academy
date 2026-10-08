jest.mock('server-only', () => ({}), { virtual: true })
import { resolveSitovVocabularyTarget, resolveSitovVerbTarget } from '@/lib/learning/sitov-learning-target-server'
import { hasSitovCommercialItemAccess } from '@/lib/access/sitov-commercial'
import { getSitovVerbById } from '@/lib/verbs/catalog'
import type { SitovVerbTrainerState } from '@/lib/verbs/contracts'
jest.mock('@/lib/access/sitov-commercial', () => ({ hasSitovCommercialItemAccess: jest.fn() }))
const id = '12345678-1234-4234-8234-123456789012'
const profile = { role: 'student', allowed_levels: ['A1.1'] }
const row = { id, unit: { id: 'unit-id', level: 'A1.1', label: 'Die echte Lektion', is_active: true, owner_auth_user_id: null } }
const maybeSingle = jest.fn()
const eq = jest.fn()
const query = { select: jest.fn(), eq, maybeSingle }
query.select.mockReturnValue(query); eq.mockReturnValue(query)
const from = jest.fn(() => query)
const session = { user: { id: 'learner' }, supabase: { from } } as unknown as Parameters<typeof resolveSitovVocabularyTarget>[2]
beforeEach(() => { jest.clearAllMocks(); maybeSingle.mockResolvedValue({ data: row, error: null }); jest.mocked(hasSitovCommercialItemAccess).mockReturnValue(true) })
test('resolves canonical label and exact item permission through authenticated filtered read', async () => {
  expect(await resolveSitovVocabularyTarget(id, 'A1.1', session, profile)).toEqual({ target: { cardId: id, lesson: row.unit.label } })
  expect(eq.mock.calls).toEqual([['id', id], ['unit.level', 'A1.1'], ['unit.is_active', true]])
  expect(hasSitovCommercialItemAccess).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'learner' }), expect.objectContaining({ id, unit_id: 'unit-id', level: 'A1.1' }))
})
test.each(['', 'unit-id', [id], undefined])('rejects malformed input without reading: %s', async raw => {
  expect(await resolveSitovVocabularyTarget(raw, 'A1.1', session, profile)).toEqual(raw === undefined ? null : { error: 'unavailable' }); expect(from).not.toHaveBeenCalled()
})
test('anonymous and revoked item access fail closed', async () => {
  expect(await resolveSitovVocabularyTarget(id, 'A1.1', { ...session, user: null }, profile)).toEqual({ error: 'unavailable' })
  jest.mocked(hasSitovCommercialItemAccess).mockReturnValue(false)
  expect(await resolveSitovVocabularyTarget(id, 'A1.1', session, profile)).toEqual({ error: 'unavailable' })
})
test.each([null, { ...row, unit: { ...row.unit, level: 'A2.1' } }, { ...row, unit: { ...row.unit, is_active: false } }])('missing or foreign/inactive canonical parent is unavailable', async data => {
  maybeSingle.mockResolvedValue({ data, error: null }); expect(await resolveSitovVocabularyTarget(id, 'A1.1', session, profile)).toEqual({ error: 'unavailable' })
})
test('transport failure has distinct retryable state', async () => { maybeSingle.mockResolvedValue({ data: null, error: { code: 'timeout' } }); expect(await resolveSitovVocabularyTarget(id, 'A1.1', session, profile)).toEqual({ error: 'retryable' }) })
test('verb resolution uses only returned catalog and preserves selections and progress', () => {
  const verb = { ...getSitovVerbById('sitov-verb-fahren')!, unitId: 'unit' }
  const state: SitovVerbTrainerState = { learnerId: 'learner', level: 'A1.1', authorizedLevels: ['A1.1'], tenses: ['present'], verbs: [verb], selectedIds: [], progress: [] }
  const before = JSON.stringify(state)
  expect(resolveSitovVerbTarget(verb.id, 'present', state)).toEqual({ target: verb.id })
  expect(resolveSitovVerbTarget('foreign-verb', 'present', state)).toEqual({ error: 'unavailable' })
  expect(resolveSitovVerbTarget(verb.id, 'perfect', state)).toEqual({ error: 'unavailable' })
  expect(resolveSitovVerbTarget(verb.id, 'present', { ...state, tenses: [] })).toEqual({ error: 'unavailable' })
  expect(JSON.stringify(state)).toBe(before)
})
