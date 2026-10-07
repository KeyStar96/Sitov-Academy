/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })

import { readSitovLearningPathStatistics } from '@/lib/sitov-learning-path-statistics'
import type { Database } from '@/supabase/database.types'
import type { SupabaseClient } from '@supabase/supabase-js'

const sitovId = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
const sitovNode = (index: number, kind = 'practice', completed = false) => ({
  id: sitovId(index), kind, title: 'Thema', sort_order: index, available: true,
  status: completed ? 'completed' : null, stars: completed ? 3 : 0, tests: [],
})
const sitovMap = {
  level: 'A1.1', completed: false, next_level: 'A1.2', next_level_available: false,
  paths: [
    { id: sitovId(20), source_id: 'sitov-second', title: 'Zweites Thema', sort_order: 2,
      available: true, completed: true, nodes: [sitovNode(21, 'test', true)] },
    { id: sitovId(10), source_id: 'sitov-first', title: 'Erstes Thema', sort_order: 1,
      available: true, completed: false,
      nodes: [sitovNode(11, 'practice', true), sitovNode(12, 'review'), sitovNode(13, 'test'), sitovNode(14, 'special')] },
  ],
}

function sitovClient(data: unknown, error: unknown = null) {
  const rpc = jest.fn().mockResolvedValue({ data, error })
  return { client: { rpc } as unknown as SupabaseClient<Database>, rpc }
}

it('counts core nodes and uses the first unfinished topic in curriculum order', async () => {
  const { client, rpc } = sitovClient(sitovMap)
  expect(await readSitovLearningPathStatistics(client, 'A1.1', 'uk')).toEqual({
    total: 4, solved: 2, topics: 2, openTopics: 1, currentTopic: 1,
  })
  expect(rpc).toHaveBeenCalledWith('get_learning_path', { p_level: 'A1.1', p_locale: 'uk' })
})

it('considers passed topic tests complete even when optional special nodes remain open', async () => {
  const { client } = sitovClient({ ...sitovMap,
    paths: sitovMap.paths.map(path => ({ ...path, completed: true })) })
  expect(await readSitovLearningPathStatistics(client, 'A1.1', 'ru')).toMatchObject({ total: 4, solved: 4, openTopics: 0, currentTopic: null })
})

it('distinguishes deliberately locked trainers from failed or malformed reads', async () => {
  expect(await readSitovLearningPathStatistics(sitovClient({ error: 'path_locked' }).client, 'A1.1', 'de')).toBeNull()
  for (const data of [null, { error: 'authentication_required' }, { ...sitovMap, level: 'A1.2' }, { ...sitovMap, paths: [{}] }]) {
    await expect(readSitovLearningPathStatistics(sitovClient(data).client, 'A1.1', 'de')).rejects.toThrow('learning_path_statistics_unavailable')
  }
  await expect(readSitovLearningPathStatistics(sitovClient(null, { code: 'PGRST202' }).client, 'A1.1', 'de')).rejects.toThrow('PGRST202')
})
