import { displayDate } from '@/components/admin/TeacherDashboardShared'

test('dashboard timestamps use stable numeric text across ICU implementations', () => {
  expect(displayDate('2026-09-26T10:00:00Z', 'en')).toBe('09/26/2026 · 12:00')
  for (const lang of ['de', 'ru', 'uk', 'tr']) expect(displayDate('2026-09-26T10:00:00Z', lang)).toBe('26.09.2026 · 12:00')
})

test('Berlin timestamps respect winter time and midnight without an hour 24', () => {
  expect(displayDate('2026-01-01T23:00:00Z', 'de')).toBe('02.01.2026 · 00:00')
  expect(displayDate('2026-01-01T10:00:00Z', 'en')).toBe('01/01/2026 · 11:00')
})
