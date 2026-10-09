/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/utils/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/pronunciation-playback-server', () => ({ loadStaffPronunciationView: jest.fn() }))

import { SitovServerReadError } from '@/lib/sitov-server-failure'
import { getAdminStats } from '@/app/actions/admin'
import { loadSitovStudentStatistics } from '@/lib/sitov-student-statistics'
import { loadStaffPronunciationView } from '@/lib/pronunciation-playback-server'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

type Profile = { id: string; role: 'student' | 'teacher' | 'admin' | null; levels: string[] }
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const profile = (n: number, role: Profile['role'], levels: string[] = []): Profile => ({ id: id(n), role, levels })

/** Apply the actual role and join semantics to a mixed account population. */
function database(profiles: Profile[], options: { failPage?: number; pendingError?: boolean } = {}) {
  const reads: Array<{ table: string; columns: string; filters: Array<[string, unknown]>; range?: [number, number] }> = []
  const client = {
    from(table: string) {
      const read: typeof reads[number] = { table, columns: '', filters: [] }
      reads.push(read)
      const builder = {
        select(columns: string) { read.columns = columns; return builder },
        eq(key: string, value: unknown) { read.filters.push([key, value]); return builder },
        order(key: string) { expect(key).toBe('id'); return builder },
        async range(from: number, to: number) {
          read.range = [from, to]
          if (from === options.failPage) return { data: null, error: { code: '57P01' } }
          const rows = profiles.filter(row => read.filters.every(([key, value]) => row[key as keyof Profile] === value))
            .sort((a, b) => a.id.localeCompare(b.id))
            .filter(row => !read.columns.includes('!inner') || row.levels.length > 0)
            .slice(from, to + 1)
            .map(row => ({ id: row.id, level_access: row.levels.map(() => ({ auth_user_id: row.id })) }))
          return { data: rows, error: null }
        },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          expect(table).toBe('submissions')
          expect(read.filters).toEqual([['status', 'pending']])
          return Promise.resolve(options.pendingError
            ? { count: null, error: { code: '57P01' } }
            : { count: 5, error: null }).then(resolve, reject)
        },
      }
      return builder
    },
  }
  return { client: client as unknown as ReturnType<typeof createAdminClient>, reads }
}

function session(role: string | null = 'teacher', authenticated = true) {
  const builder = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { role }, error: null }) }
  jest.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'staff' } : null }, error: null }) },
    from: () => builder,
  } as unknown as Awaited<ReturnType<typeof createClient>>)
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  session()
  jest.mocked(loadStaffPronunciationView).mockResolvedValue({ hiddenMessages: new Set(), hiddenSubmissions: new Set(), pendingCount: 3 })
})
afterEach(() => jest.restoreAllMocks())

it('fixes the reported 71 students / 73 unlocked accounts without counting the two teachers', async () => {
  const db = database([
    ...Array.from({ length: 71 }, (_, n) => profile(n + 1, 'student', ['A1.1'])),
    profile(72, 'teacher', ['A1.1', 'A1.2']), profile(73, 'teacher', ['B1.1']),
  ])
  jest.mocked(createAdminClient).mockReturnValue(db.client)
  expect(await getAdminStats()).toEqual({ studentCount: 71, activatedCount: 71, newStudentCount: 0, pendingSubmissions: 3 })
  // One student population read supplies all three figures; no independent counts can drift.
  expect(db.reads.filter(read => read.table === 'profiles')).toHaveLength(1)
})

it('counts a student with several grants once and preserves students without access', async () => {
  const db = database([
    profile(1, 'student', ['A1.1', 'A1.2', 'A2.1']), profile(2, 'student'), profile(3, 'student'),
    profile(4, 'teacher', ['A1.1']), profile(5, 'admin', ['A1.1']), profile(6, null, ['A1.1']),
  ])
  expect(await loadSitovStudentStatistics(db.client)).toEqual({ studentCount: 3, activatedCount: 1, newStudentCount: 2 })
})

it.each([
  { profiles: [] },
  { profiles: [profile(1, 'teacher', ['A1.1']), profile(2, 'admin', ['A1.1'])] },
])('returns zero student counts for an empty student population', async ({ profiles }) => {
  expect(await loadSitovStudentStatistics(database(profiles).client)).toEqual({ studentCount: 0, activatedCount: 0, newStudentCount: 0 })
})

it('reads every page beyond the API row limit and partitions the same population', async () => {
  const profiles = Array.from({ length: 1101 }, (_, n) => profile(n + 1, 'student', n % 2 ? ['A1.1', 'A1.2'] : []))
  const db = database(profiles)
  expect(await loadSitovStudentStatistics(db.client)).toEqual({ studentCount: 1101, activatedCount: 550, newStudentCount: 551 })
  expect(db.reads.map(read => read.range)).toEqual([[0, 499], [500, 999], [1000, 1499]])
})

it.each([0, 500])('rejects a failed student page %s instead of displaying zero or partial counts', async failPage => {
  const db = database(Array.from({ length: 501 }, (_, n) => profile(n + 1, 'student', ['A1.1'])), { failPage })
  jest.mocked(createAdminClient).mockReturnValue(db.client)
  const result = getAdminStats()
  await expect(result).rejects.toBeInstanceOf(SitovServerReadError)
  await expect(result).rejects.toMatchObject({ message: 'Database read failed', source: 'read', failure: 'sqlstate:57P01' })
})

it('keeps failed correction counts visible as an error', async () => {
  jest.mocked(createAdminClient).mockReturnValue(database([profile(1, 'student')], { pendingError: true }).client)
  await expect(getAdminStats()).rejects.toThrow('admin_stats_unavailable: 57P01')
})

it('retains the legacy correction count when the staff view is unavailable', async () => {
  jest.mocked(createAdminClient).mockReturnValue(database([profile(1, 'student')]).client)
  jest.mocked(loadStaffPronunciationView).mockResolvedValue({ hiddenMessages: new Set(), hiddenSubmissions: new Set(), pendingCount: null })
  expect(await getAdminStats()).toEqual({ studentCount: 1, activatedCount: 0, newStudentCount: 1, pendingSubmissions: 5 })
})

it.each(['student', null])('blocks role %s before any privileged statistics query', async role => {
  session(role)
  await expect(getAdminStats()).rejects.toThrow('Not authorized')
  expect(createAdminClient).not.toHaveBeenCalled()
})

it('blocks unauthenticated callers before any privileged statistics query', async () => {
  session('teacher', false)
  await expect(getAdminStats()).rejects.toThrow('Not authenticated')
  expect(createAdminClient).not.toHaveBeenCalled()
})
