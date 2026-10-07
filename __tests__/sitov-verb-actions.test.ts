import { loadSitovVerbTrainer, setSitovVerbBox, submitSitovVerbAnswer } from '@/app/actions/verbs'
import { createClient } from '@/utils/supabase/server'
import { loadLevelAccessProfile } from '@/lib/access/server'

jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/utils/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/access/server', () => ({ loadLevelAccessProfile: jest.fn() }))
jest.mock('@/lib/verbs/catalog', () => ({ getSitovVerbCatalog: () => [], getSitovVerbById: () => null, getSitovVerbTenses: () => ['present'] }), { virtual: true })
jest.mock('@/lib/verbs/engine', () => ({ getSitovVerbTenses: () => ['present'], prioritizeSitovVerbTasks: () => [], buildSitovVerbExercise: jest.fn() }), { virtual: true })
const rpc = jest.fn()
const from = jest.fn()
const userId = '00000000-0000-4000-8000-000000000001'
const challengeId = '00000000-0000-4000-8000-000000000002'
beforeEach(() => {
 jest.clearAllMocks()
 jest.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) }, rpc, from } as unknown as Awaited<ReturnType<typeof createClient>>)
 jest.mocked(loadLevelAccessProfile).mockResolvedValue({ role: 'student', allowed_levels: ['A1.1'], ui_language: 'ru', trainer_grants: [] })
})
test('an unauthenticated action stops before content access or grading', async () => {
 jest.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: null }) }, rpc, from } as unknown as Awaited<ReturnType<typeof createClient>>)
 expect(await submitSitovVerbAnswer({ exerciseId: challengeId, answer: ['fährt'] })).toEqual({ error: 'not_authenticated' })
 expect(rpc).not.toHaveBeenCalled();expect(from).not.toHaveBeenCalled()
})
test('retired coarse contexts and trainer revocation stop server loads', async () => {
 for (const level of ['B2', 'C1']) expect(await loadSitovVerbTrainer(level)).toEqual({ error: 'invalid_input' })
 jest.mocked(loadLevelAccessProfile).mockResolvedValue({ role: 'student', allowed_levels: ['A1.1'], trainer_grants: [{ level: 'A1.1', trainer: 'verbs', enabled: false }] })
 expect(await loadSitovVerbTrainer('A1.1')).toEqual({ error: 'not_authorized' })
 expect(from).not.toHaveBeenCalled()
})
test('a forged correctness property or owner ID cannot reach the grading RPC', async () => {
 expect(await submitSitovVerbAnswer({ exerciseId: challengeId, answer: ['fährt'], correct: true } as Parameters<typeof submitSitovVerbAnswer>[0])).toEqual({ error: 'invalid_input' })
 expect(await setSitovVerbBox({ level: 'A1.1', verbIds: ['sitov-verb-fahren'], selected: true, learnerId: userId } as Parameters<typeof setSitovVerbBox>[0])).toEqual({ error: 'invalid_input' })
 expect(rpc).not.toHaveBeenCalled()
})
test('only the stored challenge ID and literal answer reach grading; revoked SQL receipt fails safely', async () => {
 rpc.mockResolvedValue({ data: { error: 'not_authorized' }, error: null })
 expect(await submitSitovVerbAnswer({ exerciseId: challengeId, answer: ['  fährt  '] })).toEqual({ error: 'not_authorized' })
 expect(rpc).toHaveBeenCalledWith('sitov_submit_verb_answer', { p_challenge_id: challengeId, p_answer: ['  fährt  '] })
})
