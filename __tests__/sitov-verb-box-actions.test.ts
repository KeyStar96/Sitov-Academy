import { nextSitovVerbExercise } from '@/app/actions/verbs'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { loadLevelAccessProfile } from '@/lib/access/server'
import { readAllRows } from '@/lib/supabase-read'
import type { SitovVerbEntry } from '@/lib/verbs/types'

jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/utils/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/access/server', () => ({ loadLevelAccessProfile: jest.fn() }))
jest.mock('@/lib/supabase-read', () => ({ readAllRows: jest.fn() }))
jest.mock('@/lib/verbs/catalog', () => ({
  getSitovVerbCatalog: () => mockEntries,
  getSitovVerbById: (id: string) => mockEntries.find(entry => entry.id === id),
  getSitovVerbTenses: () => ['present', 'perfect'],
}))

const mockEntries: SitovVerbEntry[] = ['first', 'learned', 'unselected'].map(id => ({
  id: `sitov-${id}`, infinitive: 'fahren', level: 'A1.1',
  translations: { de: 'fahren', en: 'drive', ru: 'ехать', uk: 'їхати', tr: 'gitmek' },
  present: ['fahre', 'fährst', 'fährt', 'fahren', 'fahrt', 'fahren'], past: ['fuhr', 'fuhrst', 'fuhr', 'fuhren', 'fuhrt', 'fuhren'],
  presentParts: [['fahre', ''], ['fährst', ''], ['fährt', ''], ['fahren', ''], ['fahrt', ''], ['fahren', '']],
  pastParts: [['fuhr', ''], ['fuhrst', ''], ['fuhr', ''], ['fuhren', ''], ['fuhrt', ''], ['fuhren', '']],
  participles: ['gefahren'], auxiliaries: ['sein'],
}))
const insert = jest.fn()
const from = jest.fn()
const mockProgress = [{ verb_id: 'sitov-first', tense: 'present', box: 6 }, { verb_id: 'sitov-first', tense: 'perfect', box: 2 },
  { verb_id: 'sitov-learned', tense: 'present', box: 7 }, { verb_id: 'sitov-learned', tense: 'perfect', box: 7 }].map(row => ({
  ...row, attempts: 8, correct: 8, lapses: 0, next_review_at: row.box === 2 ? '2026-10-01T10:00:00Z' : row.box === 7 ? '2026-10-02T10:00:00Z' : '2099-01-01T10:00:00Z',
  last_answered_at: row.verb_id === 'sitov-learned' ? '2026-10-02T10:00:00Z' : '2026-10-01T10:00:00Z',
}))
function seedProgress(rows = mockProgress) {
  jest.mocked(readAllRows).mockReset()
    .mockResolvedValueOnce(mockEntries.map(entry => ({ id: entry.id, unit_id: 'sitov-unit', level: 'A1.1' })))
    .mockResolvedValueOnce([{ verb_id: 'sitov-first', selected: true }, { verb_id: 'sitov-learned', selected: true }, { verb_id: 'sitov-unselected', selected: false }])
    .mockResolvedValueOnce(rows)
}
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'sitov-learner' } }, error: null }) } } as unknown as Awaited<ReturnType<typeof createClient>>)
  jest.mocked(loadLevelAccessProfile).mockResolvedValue({ role: 'student', allowed_levels: ['A1.1', 'A1.2'], trainer_grants: [] })
  seedProgress()
  insert.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: 'sitov-challenge' }, error: null }) }) })
  from.mockReturnValue({ insert })
  jest.mocked(createAdminClient).mockReturnValue({ from } as unknown as ReturnType<typeof createAdminClient>)
})

test('compartment practice is selected server-side from the lowest unlocked verb tense', async () => {
  const result = await nextSitovVerbExercise({ level: 'A1.2', box: 2 }, 'en')
  expect(result.data?.verbId).toBe('sitov-first')
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ auth_user_id: 'sitov-learner', verb_id: 'sitov-first', context_level: 'A1.2' }))
})

test('a higher tense does not put the same verb in two compartments or allow an unselected verb', async () => {
  expect(await nextSitovVerbExercise({ level: 'A1.2', box: 6 }, 'en')).toEqual({ data: null })
  expect(createAdminClient).not.toHaveBeenCalled()
  expect(insert).not.toHaveBeenCalled()
})

test('the learned compartment is an archive and cannot issue normal challenges', async () => {
  const result = await nextSitovVerbExercise({ level: 'A1.2', box: 7 }, 'en')
  expect(result).toEqual({ data: null })
  expect(createAdminClient).not.toHaveBeenCalled()
})

test('normal practice issues only a due form and stops when only a future tense is requested', async () => {
  const result = await nextSitovVerbExercise({ level: 'A1.2', tenses: ['present'] }, 'en')
  expect(result).toEqual({ data: null })
  expect(createAdminClient).not.toHaveBeenCalled()
})

test.each([undefined, 2])('spacing defers the only sibling task instead of reusing the excluded verb in box %s', async box => {
  expect(await nextSitovVerbExercise({ level: 'A1.2', excludeVerbId: 'sitov-first', ...(box == null ? {} : { box }) }, 'en')).toEqual({ data: null })
  expect(insert).not.toHaveBeenCalled()
})

test('restart and reload use the latest persisted graded verb even without caller exclusion', async () => {
  seedProgress(mockProgress.map(row => ({ ...row, last_answered_at: row.verb_id === 'sitov-first' ? '2026-10-03T10:00:00Z' : row.last_answered_at })))
  expect(await nextSitovVerbExercise({ level: 'A1.2' }, 'en')).toEqual({ data: null })
  expect(insert).not.toHaveBeenCalled()
})

test('a newer graded verb outside this context supplies the global spacing boundary', async () => {
  seedProgress([...mockProgress, { ...mockProgress[0], verb_id: 'sitov-outside-context', last_answered_at: '2026-10-04T10:00:00Z' }])
  expect((await nextSitovVerbExercise({ level: 'A1.2' }, 'en')).data?.verbId).toBe('sitov-first')
})

test('a compartment snapshot retains original selected verbs after their current aggregate phase changes', async () => {
  expect((await nextSitovVerbExercise({ level: 'A1.2', box: 6, verbIds: ['sitov-first'] }, 'en')).data).toMatchObject({ verbId: 'sitov-first', tense: 'perfect' })
})

test('snapshot IDs remain constrained to selected authorized verbs and cannot turn archive into practice', async () => {
  expect(await nextSitovVerbExercise({ level: 'A1.2', box: 1, verbIds: ['sitov-unselected', 'sitov-not-visible'] }, 'en')).toEqual({ data: null })
  seedProgress()
  expect(await nextSitovVerbExercise({ level: 'A1.2', box: 7, verbIds: ['sitov-first'] }, 'en')).toEqual({ data: null })
  expect(insert).not.toHaveBeenCalled()
})

test('empty or oversized snapshot lists and invalid compartments fail validation', async () => {
  expect(await nextSitovVerbExercise({ level: 'A1.2', verbIds: [] }, 'en')).toEqual({ error: 'invalid_input' })
  expect(await nextSitovVerbExercise({ level: 'A1.2', verbIds: Array(1001).fill('sitov-first') }, 'en')).toEqual({ error: 'invalid_input' })
  expect(await nextSitovVerbExercise({ level: 'A1.2', box: 8, verbIds: ['sitov-first'] }, 'en')).toEqual({ error: 'invalid_input' })
  expect(readAllRows).not.toHaveBeenCalled()
})

test('invalid compartments and locked tenses cannot issue a stored challenge', async () => {
  expect(await nextSitovVerbExercise({ level: 'A1.2', box: 8 }, 'en')).toEqual({ error: 'invalid_input' })
  expect(readAllRows).not.toHaveBeenCalled()
  expect(await nextSitovVerbExercise({ level: 'A1.2', box: 1, tenses: ['past'] }, 'en')).toEqual({ error: 'not_authorized' })
  expect(createAdminClient).not.toHaveBeenCalled()
})
