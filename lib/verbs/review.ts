import { applyLeitnerAnswer, intervalForPhase, isLearned, normalizeBox } from '@/lib/leitner'
import type { SitovVerbProgress } from './types'

const sitovCalendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
})
const sitovClock = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})

function sitovDateParts(date: Date, clock = false) {
  return Object.fromEntries((clock ? sitovClock : sitovCalendar).formatToParts(date)
    .filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]))
}

/** Same calendar day used by the vocabulary and verb database graders. */
export function sitovVerbCalendarDay(date: Date): string {
  const parts = sitovDateParts(date)
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

/** Beginning of the target Europe/Berlin calendar day, including DST changes. */
export function sitovVerbReviewDate(now: Date, days: number): string {
  const today = sitovDateParts(now)
  const target = Date.UTC(today.year, today.month - 1, today.day + days)
  let instant = target
  for (let iteration = 0; iteration < 3; iteration++) {
    const local = sitovDateParts(new Date(instant), true)
    const offset = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second) - instant
    const corrected = target - offset
    if (corrected === instant) break
    instant = corrected
  }
  return new Date(instant).toISOString()
}

export function isSitovVerbDue(progress: SitovVerbProgress | null | undefined, now = Date.now()): boolean {
  if (progress?.attempts && isLearned(progress.box)) return false
  const lastAnswered = progress?.lastAnsweredAt ? new Date(progress.lastAnsweredAt) : null
  if (lastAnswered && Number.isFinite(lastAnswered.getTime())
    && sitovVerbCalendarDay(lastAnswered) === sitovVerbCalendarDay(new Date(now))) return false
  const dueAt = progress?.nextReviewAt ? Date.parse(progress.nextReviewAt) : Number.NaN
  return !progress?.attempts || !Number.isFinite(dueAt) || dueAt <= now
}

/** Local development preview mirror of the shared first-attempt Leitner rule. */
export function applySitovVerbReview(previous: SitovVerbProgress, correct: boolean, now = new Date(), soft = false): SitovVerbProgress {
  if (!isSitovVerbDue(previous, now.getTime())) throw new Error('review_not_due')
  const result = applyLeitnerAnswer({ currentBox: previous.attempts ? normalizeBox(previous.box) : 1, isCorrect: correct, now })
  const days = correct && soft ? Math.min(result.intervalInDays, intervalForPhase(result.previousPhase)) : result.intervalInDays
  return { ...previous, box: result.newBox, attempts: previous.attempts + 1,
    correct: previous.correct + Number(correct), lapses: previous.lapses + Number(!correct),
    nextReviewAt: result.becameLearned ? null : sitovVerbReviewDate(now, days), lastAnsweredAt: now.toISOString() }
}
