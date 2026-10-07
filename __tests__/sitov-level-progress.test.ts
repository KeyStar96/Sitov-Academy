/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))

import { getAllLevelsProgress } from '@/app/actions/progress'
import { createClient } from '@/utils/supabase/server'

type SitovCard = { id: string; unit: { level: string; owner_auth_user_id: string | null; is_active: boolean } }
type SitovProgress = { id: string; auth_user_id: string; card_id: string; direction: string; box_number: number; next_review_date: null }
const sitovId = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
const sitovPath = {
  level: 'A1.1', completed: false, next_level: 'A1.2', next_level_available: false,
  paths: [{ id: sitovId(100), source_id: 'sitov-topic', title: 'Thema', sort_order: 1, available: true, completed: false,
    nodes: ['practice', 'practice', 'review', 'test', 'special'].map((kind, index) => ({
      id: sitovId(index + 1), kind, title: 'Station', sort_order: index + 1, available: true,
      status: index === 0 || kind === 'special' ? 'completed' : null, stars: index === 0 ? 3 : 0, tests: [],
    })) }],
}
const sitovCard = (id: string, owner: string | null = null, active = true): SitovCard => ({
  id, unit: { level: 'A1.1', owner_auth_user_id: owner, is_active: active },
})
const sitovProgress = (cardId: string, direction: string, box = 7): SitovProgress => ({
  id: `${cardId}-${direction}`, auth_user_id: 'sitov-student', card_id: cardId, direction, box_number: box, next_review_date: null,
})

function sitovSetup({ cards = [], progress = [], path = sitovPath, signedIn = true,
  failTable, failOffset = 0, rpcError }: {
  cards?: SitovCard[]; progress?: SitovProgress[]; path?: unknown; signedIn?: boolean;
  failTable?: string; failOffset?: number; rpcError?: unknown;
} = {}) {
  const ranges: { table: string; from: number; to: number; ordered: boolean }[] = []
  const tables: string[] = []
  const rpc = jest.fn(async (_name: string, args: { p_level: string }) => ({
    data: args.p_level === 'A1.1' ? path : { error: 'path_locked' }, error: rpcError ?? null,
  }))
  const from = (table: string) => {
    tables.push(table)
    let rows = table === 'learning_vocabulary_cards' ? [...cards] : [...progress]
    let ordered = false
    const filter = (field: string, value: unknown) => {
      rows = rows.filter(row => {
        const record = row as unknown as Record<string, unknown>
        const actual = field.startsWith('unit.') ? (record.unit as Record<string, unknown>)[field.slice(5)] : record[field]
        return actual === value
      }) as typeof rows
      return query
    }
    const query = {
      select: () => query, is: filter, eq: filter,
      order: (field: string) => { expect(field).toBe('id'); ordered = true; rows.sort((left, right) => left.id.localeCompare(right.id)); return query },
      range: async (start: number, end: number) => {
        ranges.push({ table, from: start, to: end, ordered })
        return table === failTable && start === failOffset
          ? { data: null, error: { code: 'XX001' } } : { data: rows.slice(start, end + 1), error: null }
      },
    }
    return query
  }
  jest.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'sitov-student' } : null } }) }, from, rpc,
  } as unknown as Awaited<ReturnType<typeof createClient>>)
  return { ranges, tables, rpc }
}

beforeEach(() => { jest.clearAllMocks(); jest.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => jest.restoreAllMocks())

it('combines current core nodes and course cards mastered in both directions without legacy grammar', async () => {
  const { tables } = sitovSetup({
    cards: [sitovCard('a'), sitovCard('b'), sitovCard('own', 'sitov-student'), sitovCard('archived', null, false)],
    progress: [sitovProgress('a', 'de_to_native'), sitovProgress('a', 'native_to_de'),
      sitovProgress('b', 'de_to_native'), sitovProgress('b', 'native_to_de', 6),
      sitovProgress('own', 'de_to_native'), sitovProgress('own', 'native_to_de'),
      sitovProgress('archived', 'de_to_native'), sitovProgress('archived', 'native_to_de')],
  })
  expect(await getAllLevelsProgress()).toEqual({ 'A1.1': 33 }) // (1 core node + 1 card) / (4 nodes + 2 cards)
  expect(new Set(tables)).toEqual(new Set(['learning_vocabulary_cards', 'vocabulary_direction_progress']))
})

it('reads the complete catalogue and both direction rows beyond PostgREST response limits', async () => {
  const cards = Array.from({ length: 1201 }, (_, index) => sitovCard(sitovId(index + 1)))
  const progress = cards.flatMap(card => [sitovProgress(card.id, 'de_to_native'), sitovProgress(card.id, 'native_to_de')])
  const { ranges } = sitovSetup({ cards, progress, path: { error: 'path_locked' } })
  expect(await getAllLevelsProgress()).toEqual({ 'A1.1': 100 })
  expect(ranges.filter(query => query.table === 'learning_vocabulary_cards').map(query => query.from)).toEqual([0, 500, 1000])
  expect(ranges.filter(query => query.table === 'vocabulary_direction_progress').map(query => query.from)).toEqual([0, 500, 1000, 1500, 2000])
  expect(ranges.every(query => query.ordered && query.to - query.from === 499)).toBe(true)
})

it('credits a directly passed topic test for its core curriculum even with untouched practice rounds', async () => {
  sitovSetup({ path: { ...sitovPath, completed: true,
    paths: sitovPath.paths.map(path => ({ ...path, completed: true,
      nodes: path.nodes.map(node => ({ ...node, status: node.kind === 'test' ? 'completed' : null })) })) } })
  expect(await getAllLevelsProgress()).toEqual({ 'A1.1': 100 })
})

it('includes learned cards after the first 1000 catalogue rows in the displayed percentage', async () => {
  const cards = Array.from({ length: 1201 }, (_, index) => sitovCard(sitovId(index + 1)))
  const progress = cards.slice(1000).flatMap(card => [sitovProgress(card.id, 'de_to_native'), sitovProgress(card.id, 'native_to_de')])
  sitovSetup({ cards, progress, path: { error: 'path_locked' } })
  expect(await getAllLevelsProgress()).toEqual({ 'A1.1': 17 }) // 201 / 1201; a truncated catalogue would report 0%.
})

it.each(['learning_vocabulary_cards', 'vocabulary_direction_progress'])('throws when a later %s page fails instead of returning incomplete progress', async table => {
  const cards = Array.from({ length: 600 }, (_, index) => sitovCard(sitovId(index + 1)))
  sitovSetup({ cards, progress: cards.map(card => sitovProgress(card.id, 'de_to_native')), failTable: table, failOffset: 500 })
  await expect(getAllLevelsProgress()).rejects.toThrow('XX001')
})

it('throws on unavailable learning-path statistics and skips all reads while signed out', async () => {
  sitovSetup({ rpcError: { code: 'PGRST202' } })
  await expect(getAllLevelsProgress()).rejects.toThrow('learning_path_statistics_unavailable')
  const { rpc, tables } = sitovSetup({ signedIn: false })
  expect(await getAllLevelsProgress()).toEqual({})
  expect(rpc).not.toHaveBeenCalled()
  expect(tables).toEqual([])
})
