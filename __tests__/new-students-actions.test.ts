jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/utils/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getNewStudents } from '@/app/actions/new-students'

type Row = Record<string, unknown>
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

/** Minimal PostgREST-Nachbildung: eq/neq/in-Filter und Seitenbereiche. */
function fakeAdmin(tables: Record<string, Row[]>) {
  const reads: string[] = []
  return {
    reads,
    client: {
      from(table: string) {
        reads.push(table)
        const filters: Array<(row: Row) => boolean> = []
        const builder = {
          select: () => builder,
          order: () => builder,
          eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return builder },
          neq: (key: string, value: unknown) => { filters.push(row => row[key] !== value); return builder },
          in: (key: string, values: unknown[]) => { filters.push(row => values.includes(row[key])); return builder },
          range: (from: number, to: number) => Promise.resolve({ data: (tables[table] ?? []).filter(row => filters.every(test => test(row))).slice(from, to + 1), error: null }),
        }
        return builder
      },
    },
  }
}

function session(role: string | null, user = true) {
  const chain = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { role }, error: null }) }
  jest.mocked(createClient).mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: user ? { id: 'staff' } : null }, error: null }) },
    from: jest.fn().mockReturnValue(chain),
  } as unknown as Awaited<ReturnType<typeof createClient>>)
}

const tables: Record<string, Row[]> = {
  profiles: [
    { id: id(1), role: 'student', created_at: '2026-09-28T10:00:00Z', native_language: 'uk' },
    { id: id(2), role: 'student', created_at: '2026-09-29T10:00:00Z', native_language: 'ru' },
    { id: id(3), role: 'student', created_at: '2026-09-30T08:00:00Z', native_language: null },
    { id: id(4), role: 'teacher', created_at: '2026-09-30T09:00:00Z', native_language: 'de' },
  ],
  student_level_access: [{ auth_user_id: id(2), level: 'A1.1' }],
  people: [
    { id: id(11), auth_user_id: id(1), display_name: 'Olena Test', email: 'olena@example.invalid', phone: '+49 1', city: 'Hannover' },
    { id: id(13), auth_user_id: id(3), display_name: '  ', email: 'neu@example.invalid', phone: null, city: null },
  ],
  bookings: [
    { id: id(21), person_id: id(11), kind: 'trial', status: 'confirmed', target_month: '2026-10-01', booking_items: [{ title_snapshot: 'Deutsch A1.1 (Online)' }] },
    { id: id(22), person_id: id(11), kind: 'registration', status: 'rejected', target_month: '2026-10-01', booking_items: [{ title_snapshot: 'Abgelehnt' }] },
  ],
}

beforeEach(() => { jest.clearAllMocks(); jest.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => jest.restoreAllMocks())

test.each(['student', null])('role %s cannot read new registrations', async role => {
  session(role)
  expect(await getNewStudents()).toEqual({ success: false, error: 'not_authorized' })
  expect(createAdminClient).not.toHaveBeenCalled()
})

test('unauthenticated callers are rejected', async () => {
  session('teacher', false)
  expect(await getNewStudents()).toEqual({ success: false, error: 'not_authenticated' })
})

test('lists only students without any level access, newest first, with context but no level suggestion', async () => {
  session('teacher')
  const fake = fakeAdmin(tables)
  jest.mocked(createAdminClient).mockReturnValue(fake.client as unknown as ReturnType<typeof createAdminClient>)
  const result = await getNewStudents()
  expect(result.success).toBe(true)
  if (!result.success) return
  expect(result.data.map(row => row.id)).toEqual([id(3), id(1)])
  expect(result.data[0]).toMatchObject({ name: '', email: 'neu@example.invalid', bookings: [] })
  expect(result.data[1]).toMatchObject({
    name: 'Olena Test', phone: '+49 1', city: 'Hannover', nativeLanguage: 'uk',
    bookings: [{ title: 'Deutsch A1.1 (Online)', kind: 'trial', status: 'confirmed', targetMonth: '2026-10-01' }],
  })
  expect(Object.keys(result.data[1])).not.toContain('suggestedLevel')
  // Nur Lesezugriffe.
  expect(fake.reads.every(table => ['profiles', 'student_level_access', 'people', 'bookings'].includes(table))).toBe(true)
})
