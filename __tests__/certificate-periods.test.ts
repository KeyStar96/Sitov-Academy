/** @jest-environment node */

import { berlinToday, groupCertificatePeriods } from '@/lib/certificates/periods'
import type { CertificateEligibilityPeriod } from '@/lib/certificates/types'

const TODAY = '2026-09-29'
function period(id: string, start: string, end: string, changes: Partial<CertificateEligibilityPeriod> = {}): CertificateEligibilityPeriod {
  return {
    id, person_id: 'person-test', course_id: 'course-b1', start_date: start, end_date: end, status: 'confirmed',
    title_snapshot: 'Deutsch B1', description_snapshot: 'Wortschatz und Grammatik.',
    schedule_snapshot: [{ weekday: 1, start_time: '14:30', end_time: '15:30' }],
    revision: 1, source_revision: 1, eligible: true, reason: null, allocations: [], ...changes,
  }
}

it('joins consecutive paid months while preserving the actual mid-month entry date', () => {
  const result = groupCertificatePeriods([
    period('may', '2026-05-01', '2026-05-31'), period('april', '2026-04-15', '2026-04-30'), period('june', '2026-06-01', '2026-06-30'),
  ], null, TODAY)
  expect(result).toHaveLength(1)
  expect(result[0]).toMatchObject({ start: '2026-04-15', end: '2026-06-30', periodIds: ['april', 'may', 'june'] })
})

it('preserves pauses and unpaid gaps rather than implying continuous attendance', () => {
  const result = groupCertificatePeriods([
    period('april', '2026-04-15', '2026-04-30'),
    period('may-unpaid', '2026-05-01', '2026-05-31', { eligible: false, reason: 'invoice_unpaid' }),
    period('june', '2026-06-01', '2026-06-30'), period('september', '2026-09-01', '2026-09-10'),
  ], null, TODAY)
  expect(result.map(segment => [segment.start, segment.end])).toEqual([
    ['2026-04-15', '2026-04-30'], ['2026-06-01', '2026-06-30'], ['2026-09-01', '2026-09-10'],
  ])
})

it.each([
  { title_snapshot: 'Deutsch B1 intensiv' },
  { description_snapshot: 'Neue Kursinhalte.' },
  { schedule_snapshot: [{ weekday: 2, start_time: '15:00', end_time: '16:00' }] },
])('retains a boundary when historical wording or teaching times change: %j', changes => {
  const result = groupCertificatePeriods([
    period('april', '2026-04-01', '2026-04-30'), period('may', '2026-05-01', '2026-05-31', changes),
  ], null, TODAY)
  expect(result).toHaveLength(2)
  expect(result[0].end).toBe('2026-04-30')
  expect(result[1].start).toBe('2026-05-01')
})

it('keeps parallel courses separate and merges overlapping matching periods without extending their end twice', () => {
  const result = groupCertificatePeriods([
    period('b1-first', '2026-09-01', '2026-09-20'), period('b1-overlap', '2026-09-15', '2026-09-25'),
    period('speech', '2026-09-01', '2026-09-25', { course_id: 'course-speech', title_snapshot: 'Sprechtraining' }),
  ], null, TODAY)
  expect(result).toHaveLength(2)
  expect(result.find(segment => segment.courseId === 'course-b1')).toMatchObject({ start: '2026-09-01', end: '2026-09-25', periodIds: ['b1-first', 'b1-overlap'] })
})

it('excludes blocked, unconfirmed, revoked and entirely future periods and clips an ongoing period to the issue date', () => {
  const result = groupCertificatePeriods([
    period('ongoing', '2026-09-01', '2026-09-30'),
    period('future', '2026-10-01', '2026-10-31'),
    period('unconfirmed', '2026-08-01', '2026-08-31', { status: 'pending' }),
    period('revoked', '2026-07-01', '2026-07-31', { status: 'revoked' }),
    period('unpaid', '2026-06-01', '2026-06-30', { eligible: false, reason: 'invoice_unpaid' }),
  ], null, TODAY)
  expect(result).toHaveLength(1)
  expect(result[0]).toMatchObject({ start: '2026-09-01', end: TODAY, periodIds: ['ongoing'] })
})

it('supports a single-month request without mutating the immutable source snapshot', () => {
  const original = [period('april', '2026-04-15', '2026-04-30'), period('may', '2026-05-01', '2026-05-31')]
  const frozen = original.map(entry => Object.freeze(entry))
  const result = groupCertificatePeriods(frozen, '2026-05-01', TODAY)
  expect(result).toHaveLength(1)
  expect(result[0]).toMatchObject({ start: '2026-05-01', end: '2026-05-31', periodIds: ['may'] })
  expect(frozen.map(entry => entry.id)).toEqual(['april', 'may'])
})

it('uses the Berlin calendar date at summer and winter UTC boundaries', () => {
  expect(berlinToday(new Date('2026-09-29T22:30:00Z'))).toBe('2026-09-30')
  expect(berlinToday(new Date('2026-01-29T23:30:00Z'))).toBe('2026-01-30')
})
