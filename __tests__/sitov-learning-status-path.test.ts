/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/app/actions/vocabulary', () => ({ getVocabularyOverview: jest.fn() }))
jest.mock('@/lib/sitov-pronunciation-readiness-server', () => ({ loadSitovPronunciationReadiness: jest.fn() }))
jest.mock('@/lib/request-session', () => ({ requestSession: jest.fn() }))
jest.mock('@/lib/learning-new-server', () => ({ loadLearningNewCounts: async () => null }))
jest.mock('@/lib/verbs/server', () => ({ loadSitovVerbTrainer: jest.fn(), sitovVerbStats: jest.fn() }))

import { loadLevelLearningStatus } from '@/lib/learning-status-server'
import type { LevelAccessProfile } from '@/lib/access/levels'
import type { createClient } from '@/utils/supabase/server'

const sitovId = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
const sitovProfile: LevelAccessProfile = {
  role: 'student', ui_language: 'uk', allowed_levels: ['A1.1'],
  trainer_grants: ['vocabulary', 'pronunciation', 'videos', 'verbs'].map(trainer => ({ level: 'A1.1', trainer, enabled: false })),
}
const sitovMap = {
  level: 'A1.1', completed: false, next_level: 'A1.2', next_level_available: false,
  paths: [{ id: sitovId(1), source_id: 'sitov-topic', title: 'Thema', sort_order: 1, available: true, completed: false,
    nodes: ['practice', 'review', 'test'].map((kind, index) => ({
      id: sitovId(index + 2), kind, title: 'Station', sort_order: index + 1, available: true,
      status: index === 0 ? 'completed' : null, stars: index === 0 ? 3 : 0, tests: [],
    })) }],
}
function sitovRead(data: unknown, error: unknown = null, lang = 'uk') {
  const rpc = jest.fn().mockResolvedValue({ data, error })
  const load = () => loadLevelLearningStatus({
    supabase: { rpc } as unknown as Awaited<ReturnType<typeof createClient>>,
    userId: 'sitov-student', profile: sitovProfile, level: 'A1.1', lang,
  })
  return { rpc, load }
}

beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}))
afterEach(() => jest.restoreAllMocks())

it('loads the current learning path for Home and Learn in the chosen interface language', async () => {
  const { rpc, load } = sitovRead(sitovMap)
  expect((await load()).grammar).toEqual({ locked: false, total: 3, solved: 1, topics: 1, openTopics: 1, currentTopic: 1 })
  expect(rpc).toHaveBeenCalledWith('get_learning_path', { p_level: 'A1.1', p_locale: 'uk' })
})

it('shows unavailable path statistics as unknown, preserving other status tiles', async () => {
  const { load } = sitovRead(null, { code: 'PGRST202' })
  const result = await load()
  expect(result.grammar).toBeNull()
  expect(result.vocabulary?.locked).toBe(true)
  expect(console.error).toHaveBeenCalledWith('[learning-status] path_unavailable')
})

it('does not query a language-locked path', async () => {
  const { rpc, load } = sitovRead(sitovMap, null, 'de')
  expect((await load()).grammar?.locked).toBe(true)
  expect(rpc).not.toHaveBeenCalled()
})
