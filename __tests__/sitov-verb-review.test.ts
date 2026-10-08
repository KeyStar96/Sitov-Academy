import { applySitovVerbReview, isSitovVerbDue, sitovVerbCalendarDay, sitovVerbReviewDate } from '@/lib/verbs/review'
import { PHASE_INTERVALS_IN_DAYS } from '@/lib/leitner'
import type { SitovVerbProgress } from '@/lib/verbs/types'

const now = new Date('2026-10-08T19:36:00Z')
const progress = (box = 1): SitovVerbProgress => ({ verbId: 'sitov-verb-fahren', tense: 'perfect', box,
  attempts: box === 1 ? 0 : 8, correct: box === 1 ? 0 : 7, lapses: box === 1 ? 0 : 1,
  nextReviewAt: '2026-10-01T22:00:00Z', lastAnsweredAt: box === 1 ? null : '2026-10-01T12:00:00Z' })

test.each([1, 2, 3, 4, 5])('a due correct first attempt advances phase %s with the shared calendar-day interval', box => {
  const before = progress(box)
  const after = applySitovVerbReview(before, true, now)
  const next = (box + 1) as keyof typeof PHASE_INTERVALS_IN_DAYS
  expect(after).toMatchObject({ box: next, attempts: before.attempts + 1, correct: before.correct + 1, lapses: before.lapses,
    nextReviewAt: sitovVerbReviewDate(now, PHASE_INTERVALS_IN_DAYS[next]), lastAnsweredAt: now.toISOString() })
  expect(before).toEqual(progress(box))
})

test('phase six is terminal archive after a correct answer', () => {
  const after = applySitovVerbReview(progress(6), true, now)
  expect(after).toMatchObject({ box: 7, nextReviewAt: null })
  expect(isSitovVerbDue(after, Date.parse('2099-01-01T00:00:00Z'))).toBe(false)
})

test.each([1, 2, 3, 4, 5, 6])('an incorrect phase %s answer resets the affected tense to phase one and returns tomorrow', box => {
  const after = applySitovVerbReview(progress(box), false, now)
  expect(after).toMatchObject({ box: 1, nextReviewAt: '2026-10-08T22:00:00.000Z', lapses: progress(box).lapses + 1,
    attempts: progress(box).attempts + 1, correct: progress(box).correct })
  expect(isSitovVerbDue(after, Date.parse('2026-10-08T21:59:59Z'))).toBe(false)
  expect(isSitovVerbDue(after, Date.parse('2026-10-08T22:00:00Z'))).toBe(true)
})

test('soft accepted spelling advances but caps the interval at the earlier phase', () => {
  const after = applySitovVerbReview(progress(3), true, now, true)
  expect(after).toMatchObject({ box: 4, nextReviewAt: sitovVerbReviewDate(now, 3) })
})

test('future, archive and same-day attempts cannot receive another grading write', () => {
  expect(() => applySitovVerbReview({ ...progress(4), nextReviewAt: '2099-01-01T00:00:00Z' }, true, now)).toThrow('review_not_due')
  expect(() => applySitovVerbReview(progress(7), false, now)).toThrow('review_not_due')
  expect(() => applySitovVerbReview({ ...progress(4), lastAnsweredAt: '2026-10-08T00:00:00Z' }, true, now)).toThrow('review_not_due')
})

test.each([
  ['2026-03-28T12:00:00Z', '2026-03-28T23:00:00.000Z'],
  ['2026-03-29T12:00:00Z', '2026-03-29T22:00:00.000Z'],
  ['2026-10-24T12:00:00Z', '2026-10-24T22:00:00.000Z'],
  ['2026-10-25T12:00:00Z', '2026-10-25T23:00:00.000Z'],
])('review-day midnight follows Europe/Berlin DST from %s', (instant, expected) => {
  expect(sitovVerbReviewDate(new Date(instant), 1)).toBe(expected)
})

test('day boundaries use Berlin regardless of the browser time zone', () => {
  expect(sitovVerbCalendarDay(new Date('2026-10-08T22:00:00Z'))).toBe('2026-10-09')
  expect(sitovVerbReviewDate(new Date('2026-10-08T22:00:00Z'), 1)).toBe('2026-10-09T22:00:00.000Z')
})
