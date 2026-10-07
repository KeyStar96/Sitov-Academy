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
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'sitov-learner' } }, error: null }) } } as unknown as Awaited<ReturnType<typeof createClient>>)
  jest.mocked(loadLevelAccessProfile).mockResolvedValue({ role: 'student', allowed_levels: ['A1.1', 'A1.2'], trainer_grants: [] })
  jest.mocked(readAllRows)
    .mockResolvedValueOnce(mockEntries.map(entry => ({ id: entry.id, unit_id: 'sitov-unit', level: 'A1.1' })))
    .mockResolvedValueOnce([{ verb_id: 'sitov-first', selected: true }, { verb_id: 'sitov-learned', selected: true }, { verb_id: 'sitov-unselected', selected: false }])
    .mockResolvedValueOnce([{ verb_id: 'sitov-first', tense: 'present', box: 6 }, { verb_id: 'sitov-first', tense: 'perfect', box: 2 },
      { verb_id: 'sitov-learned', tense: 'present', box: 7 }, { verb_id: 'sitov-learned', tense: 'perfect', box: 7 }].map(row => ({
      ...row, attempts: 8, correct: 8, lapses: 0, next_review_at: '2099-01-01T10:00:00Z', last_answered_at: '2026-10-01T10:00:00Z',
    })))
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

test('the learned compartment remains eligible for the independent long-term verb review', async () => {
  const result = await nextSitovVerbExercise({ level: 'A1.2', box: 7 }, 'en')
  expect(result.data?.verbId).toBe('sitov-learned')
})

test('invalid compartments and locked tenses cannot issue a stored challenge', async () => {
  expect(await nextSitovVerbExercise({ level: 'A1.2', box: 8 }, 'en')).toEqual({ error: 'invalid_input' })
  expect(readAllRows).not.toHaveBeenCalled()
  expect(await nextSitovVerbExercise({ level: 'A1.2', box: 1, tenses: ['past'] }, 'en')).toEqual({ error: 'not_authorized' })
  expect(createAdminClient).not.toHaveBeenCalled()
})
